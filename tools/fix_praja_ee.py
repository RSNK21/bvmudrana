#!/usr/bin/env python3
"""Open the lower bowl of ಈ in Praja fonts.

The original Praja fonts draw the lower half of ಈ solid (Regular, Italic) or with only a thin
slit (Bold, Bold Italic), which looks like shading. Demi and Light have it open. This tool gives
every face the open bowl: the letter's own upper counter is turned over and fitted inside the
lower bowl, with the same side strokes and the same height as the upper counter.

Works on both kinds of Praja fonts:
  - Praja Unicode (ಈ = U+0C88)
  - Praja01-Praja08 and other Nudi-layout ASCII Praja fonts (ಈ = "F")
Faces whose ಈ is already open are left alone.

usage: fix_praja_ee.py FONT.ttf [FONT.ttf ...] [-o OUT_DIR]   (default: fix in place)
"""
import math
import os
import sys
from array import array
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates


def flatten(pts, flags, steps=24):
    """TrueType contour (on/off-curve points) -> polyline."""
    n = len(pts)
    on = [bool(f & 1) for f in flags]
    # start at an on-curve point
    start = next((i for i in range(n) if on[i]), None)
    if start is None:  # all off-curve: use a midpoint
        pts = [((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2) for i in range(n)]
        return pts
    seq = [(pts[(start + i) % n], on[(start + i) % n]) for i in range(n)] + [(pts[start], True)]
    out = [seq[0][0]]
    i = 1
    cur = seq[0][0]
    while i < len(seq):
        p, o = seq[i]
        if o:
            out.append(p); cur = p; i += 1; continue
        # off-curve: next point or implied midpoint
        q, qo = seq[i + 1] if i + 1 < len(seq) else (seq[0][0], True)
        end = q if qo else ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        for s in range(1, steps + 1):
            t = s / steps
            out.append(((1 - t) ** 2 * cur[0] + 2 * (1 - t) * t * p[0] + t * t * end[0],
                        (1 - t) ** 2 * cur[1] + 2 * (1 - t) * t * p[1] + t * t * end[1]))
        cur = end
        i += 1 if not qo else 2
    return out


def area(poly):
    return sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly))) / 2


def hits(poly, y):
    xs = []
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        if (y0 - y) * (y1 - y) < 0:
            xs.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
    return sorted(xs)


def vhits(poly, x):
    ys = []
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        if (x0 - x) * (x1 - x) < 0:
            ys.append(y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    return sorted(ys)


def ee_glyph(font):
    cmap = font.getBestCmap()
    name = cmap.get(0x0C88)
    if not name:
        name = cmap.get(0x46) or cmap.get(0xF046)  # Nudi ASCII layout: ಈ is "F"
    if not name:
        return None
    g = font['glyf'][name]
    while g.isComposite() and len(g.components) == 1:
        name = g.components[0].glyphName
        g = font['glyf'][name]
    return None if g.isComposite() else name


def fix(font):
    glyf = font['glyf']
    name = ee_glyph(font)
    if not name:
        return 'no ಈ glyph'
    g = glyf[name]
    coords, ends, flags = g.getCoordinates(glyf)
    cons, s = [], 0
    for e in ends:
        cons.append((list(coords[s:e + 1]), list(flags[s:e + 1])))
        s = e + 1
    polys = [flatten(p, f) for p, f in cons]
    areas = [area(p) for p in polys]
    outer = max(range(len(cons)), key=lambda i: abs(areas[i]))
    sign = 1 if areas[outer] > 0 else -1
    counters = [i for i in range(len(cons)) if i != outer and areas[i] * sign < 0 and abs(areas[i]) > 1]
    degenerate = [i for i in range(len(cons)) if i != outer and abs(areas[i]) <= 1]
    bb = lambda poly: (min(x for x, _ in poly), min(y for _, y in poly), max(x for x, _ in poly), max(y for _, y in poly))
    if not counters:
        return 'no counters'
    # the bowl's counters are wide (the loop on the right is small); the upper one is the highest
    ow = bb(polys[outer])[2] - bb(polys[outer])[0]
    bowl = [i for i in counters if bb(polys[i])[2] - bb(polys[i])[0] > 0.28 * ow]
    if not bowl:
        return 'no bowl counter'
    up = max(bowl, key=lambda i: bb(polys[i])[3])
    uL, uB, uR, uT = bb(polys[up])
    upH = uT - uB
    lower = [i for i in counters if i != up and bb(polys[i])[3] < uB and bb(polys[i])[2] > uL and bb(polys[i])[0] < uR]
    if lower and max(bb(polys[i])[3] - bb(polys[i])[1] for i in lower) >= 0.85 * upH:
        return 'already open'
    # the bar: its left end is the outer contour's leftmost on-curve point and the one above it
    opts, ofl = cons[outer]
    onpts = [p for p, f in zip(opts, ofl) if f & 1]
    i0 = min(range(len(onpts)), key=lambda i: (onpts[i][0], onpts[i][1]))
    kb = 0.0
    for j in (i0 - 1, (i0 + 1) % len(onpts)):
        dx, dy = onpts[j][0] - onpts[i0][0], onpts[j][1] - onpts[i0][1]
        if dy > 30:
            kb = dx / dy
            break
    obar = [(x - kb * y, y) for x, y in polys[outer]]
    ys = vhits(obar, min(x for x, _ in obar) + 10)
    if len(ys) < 2:
        return 'bar not found'
    barB, barT = ys[0], ys[1]
    lower = [i for i in counters if i != up and bb(polys[i])[3] <= barB + 8]
    def centre(poly, y, around):
        xs = hits(poly, y)
        left = [x for x in xs if x < around]
        right = [x for x in xs if x > around]
        return (max(left) + min(right)) / 2 if left and right else None
    # The new counter follows the lower bowl row by row: at each height it is centred in the bowl
    # (so it leans exactly as an italic bowl leans) and its width follows the upper counter's
    # profile turned over, scaled so the side strokes match the upper bowl's.
    mid = (uL + uR) / 2
    def span(poly, y, around):
        xs = hits(poly, y)
        left = [x for x in xs if x < around]
        right = [x for x in xs if x > around]
        return (max(left), min(right)) if left and right else None
    yA = max(barT, uB) + 12
    a = span(polys[up], yA, mid)
    o = span(polys[outer], yA, mid)
    if not a or not o:
        return 'bowl strokes not found'
    sL, sR = a[0] - o[0], o[1] - a[1]
    H = upH
    N = 28
    rows = []
    cen = mid
    for j in range(N + 1):
        h = H * (1 - math.cos(math.pi / 2 * j / N))  # finer towards the bottom
        h = min(h, H - 0.5)
        u = span(polys[up], uB + max(h, 1.0), (uL + uR) / 2 if j == 0 else ucen)
        if not u:
            break
        ucen = (u[0] + u[1]) / 2
        w = (u[1] - u[0]) / 2
        y = barB - max(h, 1.0)
        b = span(polys[outer], y, cen)
        if not b:
            break
        cen = (b[0] + b[1]) / 2
        rows.append((y, cen, w, b))
    if len(rows) < 6:
        return 'lower bowl not found'
    # scale so the side strokes just under the bar match the upper bowl's
    y0, c0, w0, b0 = rows[1]
    avail = ((b0[1] - sR) - (b0[0] + sL)) / 2
    sc = avail / w0 if w0 else 1
    left = [(c - w * sc, y) for y, c, w, b in rows]
    right = [(c + w * sc, y) for y, c, w, b in rows]
    top_y = barB
    bottom = ((left[-1][0] + right[-1][0]) / 2, min(left[-1][1], right[-1][1]))
    # flat top along the bar (two corners on the curve), then one smooth curve (off-curve points) round the bottom
    ring = [(left[0][0], top_y)] + left[1:-1] + [bottom] + right[1:-1][::-1] + [(right[0][0], top_y)]
    fl = [1] + [0] * (len(left) - 2) + [0] + [0] * (len(right) - 2) + [1]
    ring = [(round(x), round(y)) for x, y in ring]
    # same winding as the other counters
    up_sign = 1 if areas[up] > 0 else -1
    if area(ring) * up_sign < 0:
        ring, fl = ring[::-1], fl[::-1]
    new, nfl = ring, fl
    k = 0.0
    nL, nR = min(x for x, _ in new), max(x for x, _ in new)
    innerB = min(y for _, y in new)
    drop = set(degenerate) | set(lower)
    cons = [c for i, c in enumerate(cons) if i not in drop] + [(new, nfl)]
    allpts, allfl, newends = [], [], []
    for p, f in cons:
        allpts += p; allfl += f; newends.append(len(allpts) - 1)
    g.coordinates = GlyphCoordinates(allpts)
    g.flags = array('B', allfl)
    g.endPtsOfContours = newends
    g.numberOfContours = len(newends)
    g.recalcBounds(glyf)
    return f'opened ({name}; bar {barB:.0f}-{barT:.0f}; new counter x {nL:.0f}-{nR:.0f}, y {innerB:.0f}-{barB:.0f})'


def main(argv):
    out = None
    files = []
    i = 0
    while i < len(argv):
        if argv[i] == '-o':
            out = argv[i + 1]; i += 2; continue
        files.append(argv[i]); i += 1
    for f in files:
        t = TTFont(f)
        msg = fix(t)
        dst = os.path.join(out, os.path.basename(f)) if out else f
        if msg.startswith('opened'):
            t.save(dst)
        elif out and os.path.abspath(dst) != os.path.abspath(f):
            t.save(dst)
        print(f'{os.path.basename(f)}: {msg}')


if __name__ == '__main__':
    main(sys.argv[1:])
