/* BV Mudrana: mouse, keyboard and text editing. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text, L = BV.Layout;
  const $ = (id) => document.getElementById(id);
  const doc = () => App.doc;

  // ------------------------------------------------------------------ snapping
  function snapTargets(p, exclude) {
    const d = doc(), W = d.setup.w, H = d.setup.h;
    const m = BV.pageMargins(d, p.side);
    const xs = [0, W, m.left, W - m.right], ys = [0, H, m.top, H - m.bottom];
    for (const c of BV.pageColumns(d, p.ref)) xs.push(c.x, c.x + c.w);
    const g = App.guidesFor(p);
    xs.push(...g.v); ys.push(...g.h);
    const out = { xs: xs.map((x) => x + p.x0), ys, smartX: [], smartY: [] };
    // Smart Guides (InDesign): edges and centres of the other objects on the spread, and the page centre
    if (App.smartGuides && exclude) {
      out.smartX.push(p.x0 + W / 2); out.smartY.push(H / 2);
      for (const pl of App.placements) for (const it of BV.itemsOnPage(d, pl.ref)) {
        if (exclude.has(it.id)) continue;
        const b = BV.Render.box(it);
        out.smartX.push(pl.x0 + b.x, pl.x0 + b.x + b.w / 2, pl.x0 + b.x + b.w);
        out.smartY.push(b.y, b.y + b.h / 2, b.y + b.h);
      }
      out.xs.push(...out.smartX); out.ys.push(...out.smartY);
    }
    return out;
  }
  function snapVal(v, list) {
    if (!App.snap) return v;
    const tol = 6 / App.scale();
    let best = v, bd = tol;
    for (const t of list) { const dd = Math.abs(t - v); if (dd < bd) { bd = dd; best = t; } }
    return best;
  }
  function rulerSnap(v, origin) {
    const u = doc().setup.units;
    const step = { mm: 1, cm: 1, in: 1 / 16, pc: 1 / 12, pt: 1 }[u] * BV.UNITS[u];
    return origin + Math.round((v - origin) / step) * step;
  }
  App.snapPoint = (pt, p) => {
    const t = snapTargets(p);
    let x = snapVal(pt.x, t.xs), y = snapVal(pt.y, t.ys);
    if (App.snapRulers) {
      const z = App.zeroPt || { x: App.placements.length === 2 ? doc().setup.w : p.x0, y: 0 };
      if (x === pt.x) x = rulerSnap(x, z.x);
      if (y === pt.y) y = rulerSnap(y, z.y);
    }
    return { x, y };
  };

  // ------------------------------------------------------------------ hit testing
  function itemBox(it, p) {
    return { x: p.x0 + Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) };
  }
  function hitItem(pt, filter) {
    const tol = 4 / App.scale();
    const list = App.visibleItems();
    for (let i = list.length - 1; i >= 0; i--) {
      const { it, p } = list[i];
      if (filter && !filter(it)) continue;
      if (BV.layerOf(App.doc, it).locked) continue;
      if (it.type === 'line') {
        const x1 = p.x0 + it.x, y1 = it.y, x2 = x1 + it.w, y2 = y1 + it.h;
        const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((pt.x - x1) * (x2 - x1) + (pt.y - y1) * (y2 - y1)) / len2));
        const dx = x1 + t * (x2 - x1) - pt.x, dy = y1 + t * (y2 - y1) - pt.y;
        if (Math.hypot(dx, dy) <= tol + (it.strokeWidth || 0) / 2) return { it, p };
        continue;
      }
      const b = itemBox(it, p);
      if (pt.x >= b.x - tol && pt.x <= b.x + b.w + tol && pt.y >= b.y - tol && pt.y <= b.y + b.h + tol) return { it, p };
    }
    return null;
  }
  // handles of selected items: returns {it, p, kind, idx}
  function hitHandle(pt) {
    if (App.sel.kind !== 'items') return null;
    const s = App.scale(), tol = 5 / s;
    for (const id of App.sel.ids) {
      const it = doc().items[id];
      const p = it && App.itemPlacement(it);
      if (!p) continue;
      if (it.type === 'text') {
        const cx = p.x0 + it.x + it.w / 2, lh = 9 / s, lw = 18 / s;
        if (Math.abs(pt.x - cx) <= lw / 2 + tol && pt.y >= it.y + it.h - tol && pt.y <= it.y + it.h + lh + tol) return { it, p, kind: 'shadeBottom' };
        if (Math.abs(pt.x - cx) <= lw / 2 + tol && pt.y <= it.y + tol && pt.y >= it.y - lh - tol) return { it, p, kind: 'shadeTop' };
        const corners = [[0, it.x, it.y], [2, it.x + it.w, it.y], [6, it.x, it.y + it.h], [4, it.x + it.w, it.y + it.h]];
        for (const [idx, hx, hy] of corners) if (Math.abs(pt.x - p.x0 - hx) <= tol && Math.abs(pt.y - hy) <= tol) return { it, p, kind: 'resize', idx };
      } else if (it.type === 'line') {
        if (Math.hypot(pt.x - p.x0 - it.x, pt.y - it.y) <= tol) return { it, p, kind: 'lineEnd', idx: 0 };
        if (Math.hypot(pt.x - p.x0 - it.x - it.w, pt.y - it.y - it.h) <= tol) return { it, p, kind: 'lineEnd', idx: 1 };
      } else {
        const b = itemBox(it, p);
        const pts = App.handlePoints(b.x, b.y, b.w, b.h);
        for (let i = 0; i < 8; i++) if (Math.abs(pt.x - pts[i][0]) <= tol && Math.abs(pt.y - pts[i][1]) <= tol) return { it, p, kind: 'resize', idx: i };
      }
    }
    return null;
  }
  function hitGuide(pt) {
    const tol = 3 / App.scale();
    for (const p of App.placements) {
      if (pt.x < p.x0 || pt.x > p.x0 + doc().setup.w) continue;
      const g = App.guidesFor(p);
      for (let i = 0; i < g.h.length; i++) if (Math.abs(g.h[i] - pt.y) <= tol) return { p, dir: 'h', i };
      for (let i = 0; i < g.v.length; i++) if (Math.abs(g.v[i] + p.x0 - pt.x) <= tol) return { p, dir: 'v', i };
    }
    return null;
  }

  App.groupMembers = (it) => (it.group ? Object.values(doc().items).filter((x) => x.group === it.group && x.page === it.page).map((x) => x.id) : [it.id]);

  // text position at a point inside a text frame
  function posInFrame(it, pt, p) {
    const story = doc().stories[it.storyId];
    const lay = App.layoutFor(story);
    const fl = lay.frames[it.id];
    if (!fl || !fl.lines.length) {
      // empty frame: before first line of the next frame that has lines, or story end
      const fi = story.frames.indexOf(it.id);
      for (let j = fi - 1; j >= 0; j--) { const f2 = lay.frames[story.frames[j]]; if (f2 && f2.lines.length) { const l = f2.lines[f2.lines.length - 1]; return { p: l.para, o: l.e }; } }
      return { p: 0, o: 0 };
    }
    const ly = pt.y - it.y, lx = pt.x - p.x0 - it.x;
    let line = fl.lines[fl.lines.length - 1];
    for (const l of fl.lines) if (ly < l.top + l.h) { line = l; break; }
    return { p: line.para, o: L.offsetAtX(doc(), story, line, lx, App.pageTextForStory(story)) };
  }

  // ------------------------------------------------------------------ mouse
  App.drag = null;
  let lastClick = { t: 0, x: 0, y: 0, n: 0 };
  let spaceDown = false;

  let zoomKey = false; // Ctrl+Space held: temporary zoom tool (Alt as well: zoom out)
  App.isZoomKey = () => zoomKey;
  function onMouseDown(e) {
    // right-click: toggle Fit in Window / Actual Size (Shift: Actual Size / 200%), like PageMaker
    if (e.button === 2) {
      e.preventDefault();
      const pt = App.clientToSpread(e.clientX, e.clientY);
      const z = App.view.zoom;
      if (e.shiftKey) { App.setZoom(Math.abs(z - 2) < 0.01 ? 1 : 2, null); App.centerOn(pt.x, pt.y); }
      else if (App.view.fit || Math.abs(z - 1) > 0.01) { App.setZoom(1, null); App.centerOn(pt.x, pt.y); }
      else App.fitZoom();
      return;
    }
    if (e.button === 0 && (zoomKey || App.tool === 'zoom')) {
      e.preventDefault();
      const pt = App.clientToSpread(e.clientX, e.clientY);
      App.drag = { type: 'zoombox', start: pt, cur: pt, out: e.altKey || e.ctrlKey && App.tool === 'zoom', cx: e.clientX, cy: e.clientY };
      return;
    }
    if (e.button === 1 || (e.button === 0 && (e.altKey && App.tool !== 'zoom') ) || (e.button === 0 && (App.tool === 'hand' || spaceDown))) {
      e.preventDefault();
      const b = $('board');
      App.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, l: b.scrollLeft, t: b.scrollTop };
      b.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    const pt = App.clientToSpread(e.clientX, e.clientY);
    const p = App.placementAt(pt.x);
    // multi-click detection
    const now = Date.now();
    if (now - lastClick.t < 450 && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 5) lastClick.n++;
    else lastClick.n = 1;
    lastClick = { t: now, x: e.clientX, y: e.clientY, n: lastClick.n };

    if (App.loaded) {
      App.drag = { type: 'place', start: App.snapPoint(pt, p), cur: pt, p, mods: e };
      return;
    }
    switch (App.tool) {
      case 'rotate': return rotateDown(e, pt, p);
      case 'crop': return cropDown(e, pt, p);
      case 'polygon': case 'pframe': return polygonDown(e, pt, p);
      case 'cline': App.drag = { type: 'create', shape: 'line', constrain: true, start: App.snapPoint(pt, p), cur: pt, p }; return;
      case 'rframe': case 'eframe': App.drag = { type: 'create', shape: App.tool, start: App.snapPoint(pt, p), cur: pt, p }; return;
      case 'zoom':
        App.setZoom(App.view.zoom * (e.altKey ? 1 / 1.5 : 1.5), { x: e.clientX, y: e.clientY });
        return;
      case 'text': return textDown(e, pt, p);
      case 'pointer': return pointerDown(e, pt, p);
      case 'line': case 'rect': case 'ellipse':
        App.drag = { type: 'create', shape: App.tool, start: App.snapPoint(pt, p), cur: pt, p };
        return;
    }
  }

  function textDown(e, pt, p) {
    const hit = hitItem(pt, (it) => it.type === 'text');
    if (hit) {
      const pos = posInFrame(hit.it, pt, hit.p);
      const sid = hit.it.storyId;
      if (App.sel.kind === 'text' && App.sel.sid !== sid) App.leaveText();
      if (lastClick.n === 2) {
        const text = T.paraText(doc().stories[sid].paras[pos.p]);
        const [a, b] = T.wordBounds(text, pos.o);
        App.sel = { kind: 'text', sid, a: { p: pos.p, o: a }, f: { p: pos.p, o: b } };
      } else if (lastClick.n >= 3) {
        const text = T.paraText(doc().stories[sid].paras[pos.p]);
        App.sel = { kind: 'text', sid, a: { p: pos.p, o: 0 }, f: { p: pos.p, o: text.length } };
      } else if (e.shiftKey && App.sel.kind === 'text' && App.sel.sid === sid) {
        App.sel.f = pos;
      } else {
        App.sel = { kind: 'text', sid, a: pos, f: { ...pos } };
      }
      App.typingAttrs = null;
      App.goalX = null;
      App.drag = { type: 'textsel', sid, start: App.sel.a };
      focusIME();
      App.render();
      return;
    }
    App.leaveText();
    App.drag = { type: 'newtext', start: App.snapPoint(pt, p), cur: pt, p };
    App.render();
  }

  function pointerDown(e, pt, p) {
    const h = hitHandle(pt);
    if (h && h.it.locked && h.kind !== 'shadeBottom') { BV.UI.status('This object is locked (Element ▸ Unlock).'); return; }
    if (h) {
      if (h.kind === 'shadeBottom' || h.kind === 'shadeTop') {
        App.drag = { type: 'shade', h, start: pt, moved: false, orig: { y: h.it.y, h: h.it.h } };
        return;
      }
      App.checkpoint();
      App.drag = { type: 'resize', h, start: pt, orig: JSON.parse(JSON.stringify(h.it)) };
      return;
    }
    const hit = hitItem(pt);
    if (hit) {
      if (lastClick.n >= 2 && hit.it.type === 'text') {
        // double-click a text block with the pointer → edit text there
        App.setTool('text');
        textDown(e, pt, p);
        return;
      }
      const members = App.groupMembers(hit.it);
      if (e.shiftKey && App.sel.kind === 'items') {
        const on = App.sel.ids.includes(hit.it.id);
        App.sel.ids = on ? App.sel.ids.filter((id) => !members.includes(id)) : [...new Set([...App.sel.ids, ...members])];
        if (!App.sel.ids.length) App.sel = { kind: 'none' };
      } else if (!(App.sel.kind === 'items' && App.sel.ids.includes(hit.it.id))) {
        App.sel = { kind: 'items', ids: members };
      }
      if (App.sel.kind !== 'items') { App.render(); return; }
      if (App.sel.ids.some((id) => doc().items[id].locked)) { App.render(); BV.UI.status('This object is locked (Element ▸ Unlock).'); return; }
      App.drag = { type: 'move', start: pt, moved: false, orig: App.sel.ids.map((id) => ({ id, x: doc().items[id].x, y: doc().items[id].y, page: doc().items[id].page })) };
      App.render();
      return;
    }
    const g = !App.lockGuides && hitGuide(pt);
    if (g) {
      App.checkpoint();
      App.drag = { type: 'guide', g };
      return;
    }
    App.sel = { kind: 'none' };
    App.drag = { type: 'marquee', start: pt, cur: pt, add: e.shiftKey };
    App.render();
  }

  function onMouseMove(e) {
    const pt = App.clientToSpread(e.clientX, e.clientY);
    App.mouseSpread = pt;
    const d = App.drag;
    if (!d && App.polyDraft) { App.polyDraft.cur = App.snapPoint(pt, App.polyDraft.p); App.render(); }
    if (!d) { App.drawRulers(); App.updateInfo(); return; }
    if (d.type === 'pan') {
      const b = $('board');
      b.scrollLeft = d.l - (e.clientX - d.sx);
      b.scrollTop = d.t - (e.clientY - d.sy);
      return;
    }
    if (d.type === 'textsel') {
      const hit = hitItem(pt, (it) => it.type === 'text' && it.storyId === d.sid);
      if (hit) { App.sel.f = posInFrame(hit.it, pt, hit.p); App.render(); }
      return;
    }
    if (d.type === 'move') {
      let dx = pt.x - d.start.x, dy = pt.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * App.scale() < 3) return;
      if (!d.moved) { App.checkpoint(); d.moved = true; }
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // snap the first item's edges
      const first = doc().items[d.orig[0].id], fp = App.placementOf(d.orig[0].page);
      d.smart = null;
      if (first && fp) {
        const t = snapTargets(fp, new Set(d.orig.map((o) => o.id)));
        const nx = fp.x0 + d.orig[0].x + dx, ny = d.orig[0].y + dy;
        const fw = Math.abs(first.w), fh = Math.abs(first.h);
        const sxl = snapVal(nx, t.xs), sxr = snapVal(nx + fw, t.xs), sxc = App.smartGuides ? snapVal(nx + fw / 2, t.smartX) : nx + fw / 2;
        let gx = null, gy = null;
        if (sxl !== nx) { dx += sxl - nx; gx = sxl; } else if (sxr !== nx + fw) { dx += sxr - nx - fw; gx = sxr; } else if (sxc !== nx + fw / 2) { dx += sxc - nx - fw / 2; gx = sxc; }
        const syt = snapVal(ny, t.ys), syb = snapVal(ny + fh, t.ys), syc = App.smartGuides ? snapVal(ny + fh / 2, t.smartY) : ny + fh / 2;
        if (syt !== ny) { dy += syt - ny; gy = syt; } else if (syb !== ny + fh) { dy += syb - ny - fh; gy = syb; } else if (syc !== ny + fh / 2) { dy += syc - ny - fh / 2; gy = syc; }
        if (App.smartGuides && App.snap) d.smart = { x: gx != null && t.smartX.some((v) => Math.abs(v - gx) < 0.01) ? gx : null, y: gy != null && t.smartY.some((v) => Math.abs(v - gy) < 0.01) ? gy : null };
      }
      for (const o of d.orig) { const it = doc().items[o.id]; it.x = o.x + dx; it.y = o.y + dy; if (it.autoGrow && it.type === 'text') it.autoGrow = false; }
      App.markAll();
      App.render();
      return;
    }
    if (d.type === 'resize') return doResize(d, pt, e);
    if (d.type === 'rotate') {
      let a = Math.atan2(pt.y - d.cy, pt.x - d.cx) * 180 / Math.PI;
      let rot = d.orig + (a - d.a0);
      if (e.shiftKey) rot = Math.round(rot / 45) * 45;
      rot = ((rot + 540) % 360) - 180;
      for (const id of d.ids) doc().items[id].rot = Math.round(rot * 10) / 10 || 0;
      App.markAll();
      App.render();
      return;
    }
    if (d.type === 'cropmove') {
      const it = d.it;
      it.cx = d.ocx + (pt.x - d.start.x);
      it.cy = d.ocy + (pt.y - d.start.y);
      App.render();
      return;
    }
    if (d.type === 'polyreg') { d.cur = pt; d.shift = e.shiftKey; App.render(); return; }
    if (d.type === 'shade') {
      const dy = pt.y - d.start.y;
      if (!d.moved && Math.abs(dy) * App.scale() < 3) return;
      if (!d.moved) { App.checkpoint(); d.moved = true; }
      const it = d.h.it;
      const sy = snapVal(d.h.kind === 'shadeBottom' ? d.orig.y + d.orig.h + dy : d.orig.y + dy, snapTargets(d.h.p).ys);
      it.autoGrow = false;
      if (d.h.kind === 'shadeBottom') it.h = Math.max(6, sy - it.y);
      else { const bottom = d.orig.y + d.orig.h; it.y = Math.min(sy, bottom - 6); it.h = bottom - it.y; }
      App.markStory(it.storyId);
      App.render();
      return;
    }
    if (d.type === 'guide') {
      const g = d.g;
      const arr = App.guidesFor(g.p)[g.dir];
      arr[g.i] = g.dir === 'h' ? pt.y : pt.x - g.p.x0;
      d.out = g.dir === 'h' ? (pt.x < -App.pad.x * 0.9 || e.clientY < $('board').getBoundingClientRect().top) : (e.clientX < $('board').getBoundingClientRect().left);
      App.render();
      return;
    }
    if (d.type === 'newguide') {
      d.pos = d.dir === 'h' ? pt.y : pt.x;
      App.render();
      return;
    }
    d.cur = pt;
    d.shift = e.shiftKey;
    App.render();
  }

  function doResize(d, pt, e) {
    const it = d.h.it, o = d.orig, p = d.h.p;
    const t = snapTargets(p);
    const X = snapVal(pt.x, t.xs) - p.x0, Y = snapVal(pt.y, t.ys);
    if (d.h.kind === 'lineEnd') {
      if (d.h.idx === 0) { const x2 = o.x + o.w, y2 = o.y + o.h; it.x = X; it.y = Y; it.w = x2 - X; it.h = y2 - Y; }
      else { it.w = X - o.x; it.h = Y - o.y; if (e.shiftKey) constrainLine(it); }
    } else {
      let x1 = Math.min(o.x, o.x + o.w), y1 = Math.min(o.y, o.y + o.h), x2 = x1 + Math.abs(o.w), y2 = y1 + Math.abs(o.h);
      const i = d.h.idx;
      if ([0, 6, 7].includes(i)) x1 = X;
      if ([2, 3, 4].includes(i)) x2 = X;
      if ([0, 1, 2].includes(i)) y1 = Y;
      if ([4, 5, 6].includes(i)) y2 = Y;
      if (e.shiftKey && it.type === 'image') { const r = Math.abs(o.h / o.w); y2 = y1 + Math.abs(x2 - x1) * r; }
      const nb = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(4, Math.abs(x2 - x1)), h: Math.max(4, Math.abs(y2 - y1)) };
      if (it.src && (it.type === 'image' || it.type === 'frame')) {
        const ob = { x: Math.min(o.x, o.x + o.w), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w), h: Math.abs(o.h) };
        const cx = o.cx ?? 0, cy = o.cy ?? 0, cw = o.cw ?? ob.w, ch = o.ch ?? ob.h;
        if (d.crop) { it.cx = ob.x + cx - nb.x; it.cy = ob.y + cy - nb.y; it.cw = cw; it.ch = ch; }
        else { const sx = nb.w / ob.w, sy = nb.h / ob.h; it.cx = cx * sx; it.cy = cy * sy; it.cw = cw * sx; it.ch = ch * sy; }
      }
      Object.assign(it, nb);
      if (it.type === 'text') { it.autoGrow = false; App.markStory(it.storyId); }
    }
    App.setDirty(true);
    App.render();
  }
  function constrainLine(it, orthogonalOnly) {
    const a = Math.atan2(it.h, it.w), len = Math.hypot(it.w, it.h);
    const step = orthogonalOnly ? Math.PI / 2 : Math.PI / 4;
    const s = Math.round(a / step) * step;
    it.w = Math.cos(s) * len; it.h = Math.sin(s) * len;
  }

  function onMouseUp(e) {
    const d = App.drag;
    App.drag = null;
    if (!d) return;
    const pt = App.clientToSpread(e.clientX, e.clientY);
    if (d.type === 'pan') { $('board').classList.remove('panning'); return; }
    if (d.type === 'textsel') { focusIME(); App.render(); return; }
    if (d.type === 'move') { if (d.moved) { reassignPages(d.orig.map((o) => o.id)); App.changed(); } return; }
    if (d.type === 'resize') { App.changed(); return; }
    if (d.type === 'shade') {
      if (!d.moved) {
        // click on a loop: red ▼ or + loads the remaining text (PageMaker style)
        const it = d.h.it;
        const story = doc().stories[it.storyId];
        const isLast = story.frames[story.frames.length - 1] === it.id;
        const lay = App.layoutFor(story);
        if (d.h.kind === 'shadeBottom' && (lay.overflow || !isLast)) {
          App.setLoaded({ kind: 'text', sid: story.id, after: it.id });
          App.sel = { kind: 'none' };
        }
        App.render();
      } else App.changed(it_story(d));
      return;
    }
    if (d.type === 'guide') {
      if (d.out) { App.guidesFor(d.g.p)[d.g.dir].splice(d.g.i, 1); }
      App.changed();
      return;
    }
    if (d.type === 'newguide') {
      if (d.pos === undefined) return;
      const inside = d.dir === 'h' ? e.clientY > $('board').getBoundingClientRect().top : e.clientX > $('board').getBoundingClientRect().left;
      if (!inside) { App.render(); return; }
      App.checkpoint();
      if (d.dir === 'h') for (const p of App.placements) App.guidesFor(p).h.push(d.pos);
      else { const p = App.placementAt(d.pos); App.guidesFor(p).v.push(d.pos - p.x0); }
      App.changed();
      return;
    }
    if (d.type === 'zoombox') {
      const w = Math.abs(pt.x - d.start.x), h = Math.abs(pt.y - d.start.y);
      if (w * App.scale() > 6 && h * App.scale() > 6 && !d.out) App.zoomToBox({ x: Math.min(d.start.x, pt.x), y: Math.min(d.start.y, pt.y), w, h }, 8);
      else App.zoomStep(d.out ? -1 : 1, { x: d.cx, y: d.cy });
      App.render();
      return;
    }
    if (d.type === 'marquee') {
      const x1 = Math.min(d.start.x, pt.x), x2 = Math.max(d.start.x, pt.x), y1 = Math.min(d.start.y, pt.y), y2 = Math.max(d.start.y, pt.y);
      if ((x2 - x1) * App.scale() < 3 && (y2 - y1) * App.scale() < 3) { App.render(); return; }
      const ids = App.visibleItems().filter(({ it, p }) => { const b = itemBox(it, p); return b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2; }).map(({ it }) => it.id);
      App.sel = ids.length ? { kind: 'items', ids } : { kind: 'none' };
      App.render();
      return;
    }
    if (d.type === 'create') return finishCreate(d, pt);
    if (d.type === 'rotate') { App.changed(); return; }
    if (d.type === 'cropmove') { App.changed(); return; }
    if (d.type === 'polyreg') return finishPolyReg(d, pt);
    if (d.type === 'newtext') return finishNewText(d, pt);
    if (d.type === 'place') return finishPlace(d, pt);
  }
  const it_story = (d) => d.h.it.storyId;

  // items dragged onto the other page of a spread change page
  function reassignPages(ids) {
    for (const id of ids) {
      const it = doc().items[id];
      const p = App.itemPlacement(it);
      if (!p) continue;
      const cx = p.x0 + it.x + it.w / 2;
      const np = App.placementAt(cx);
      if (np.ref !== p.ref && cx >= np.x0 && cx <= np.x0 + doc().setup.w) { it.x += p.x0 - np.x0; it.page = np.ref; }
    }
  }

  function dragRect(d, pt) {
    const s = d.start, c = App.snapPoint(pt, d.p);
    return { x: Math.min(s.x, c.x), y: Math.min(s.y, c.y), w: Math.abs(c.x - s.x), h: Math.abs(c.y - s.y), moved: Math.hypot(pt.x - s.x, pt.y - s.y) * App.scale() > 4 };
  }

  // ---- rotate tool: drag around the object's centre (PageMaker rotates around the reference point)
  function rotateDown(e, pt, p) {
    let ids = App.sel.kind === 'items' ? App.sel.ids.slice() : [];
    const hit = hitItem(pt);
    if (hit && !ids.includes(hit.it.id)) ids = App.groupMembers(hit.it);
    ids = ids.filter((id) => !doc().items[id].locked);
    if (!ids.length) { BV.UI.status('Rotate tool: drag on an object to turn it. Hold Shift for 45° steps.'); return; }
    App.sel = { kind: 'items', ids };
    const its = ids.map((id) => doc().items[id]);
    const b = App.selBounds(its);
    const ip = App.itemPlacement(its[0]);
    App.checkpoint();
    App.drag = { type: 'rotate', ids, cx: ip.x0 + b.x + b.w / 2, cy: b.y + b.h / 2, a0: Math.atan2(pt.y - (b.y + b.h / 2), pt.x - (ip.x0 + b.x + b.w / 2)) * 180 / Math.PI, orig: its[0].rot || 0 };
    App.render();
  }
  // ---- crop tool: drag a handle to trim; drag inside to slide the picture in its frame
  function cropDown(e, pt, p) {
    const h = hitHandle(pt);
    if (h && h.kind === 'resize' && h.it.src) { App.checkpoint(); App.drag = { type: 'resize', crop: true, h, start: pt, orig: JSON.parse(JSON.stringify(h.it)) }; return; }
    const hit = hitItem(pt, (it) => !!it.src);
    if (!hit) { BV.UI.status('Crop tool: select a picture, then drag its handles.'); return; }
    App.sel = { kind: 'items', ids: [hit.it.id] };
    const it = hit.it;
    App.checkpoint();
    App.drag = { type: 'cropmove', it, start: pt, ocx: it.cx ?? 0, ocy: it.cy ?? 0 };
    App.render();
  }
  // ---- polygon tool: click points (click the first point or double-click to close); drag for a regular polygon
  function polygonDown(e, pt, p) {
    const sp = App.snapPoint(pt, p);
    const d = App.polyDraft;
    if (d && d.pts.length) {
      const first = d.pts[0];
      const close = Math.hypot(sp.x - first.x, sp.y - first.y) * App.scale() < 8 || lastClick.n >= 2;
      if (close && d.pts.length >= 3) return finishPolygon();
      d.pts.push(sp);
      App.render();
      return;
    }
    App.drag = { type: 'polyreg', start: sp, cur: pt, p };
  }
  function finishPolyReg(d, pt) {
    const r = dragRect(d, pt);
    if (!r.moved) { App.polyDraft = { pts: [d.start], p: d.p, frame: App.tool === 'pframe' }; App.render(); BV.UI.status('Click to add corners. Click the first point (or double-click) to close. Esc cancels.', 0); return; }
    const set = App.store.get('polygon', { sides: 6, star: 0 });
    const n = Math.max(3, set.sides | 0);
    const pts = [];
    for (let i = 0; i < n * (set.star ? 2 : 1); i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / (n * (set.star ? 2 : 1));
      const rr = set.star && i % 2 ? 1 - set.star / 100 : 1;
      pts.push([0.5 + 0.5 * rr * Math.cos(a), 0.5 + 0.5 * rr * Math.sin(a)]);
    }
    if (e_shift(d)) { const m = Math.max(r.w, r.h); r.w = r.h = m; }
    makePolygon(d.p, r.x, r.y, r.w, r.h, pts, App.tool === 'pframe');
  }
  const e_shift = (d) => !!d.shift;
  function finishPolygon() {
    const d = App.polyDraft;
    App.polyDraft = null;
    BV.UI.status('');
    const xs = d.pts.map((q) => q.x), ys = d.pts.map((q) => q.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
    makePolygon(d.p, x, y, w, h, d.pts.map((q) => [(q.x - x) / w, (q.y - y) / h]), d.frame);
  }
  App.finishPolygon = () => { if (App.polyDraft && App.polyDraft.pts.length >= 3) finishPolygon(); else { App.polyDraft = null; App.render(); } };
  function makePolygon(p0, x, y, w, h, pts, frame) {
    App.checkpoint();
    const p = App.placementAt(x + w / 2);
    const st = App.store.get('defaultStroke', { stroke: '#000000', strokeWidth: 0.5 });
    const it = frame
      ? BV.newItem(doc(), 'frame', p.ref, x - p.x0, y, w, h, { z: App.nextZ(), shape: 'polygon', pts, stroke: 'none', strokeWidth: 0 })
      : BV.newItem(doc(), 'polygon', p.ref, x - p.x0, y, w, h, { z: App.nextZ(), pts, stroke: st.stroke, strokeWidth: st.strokeWidth });
    App.sel = { kind: 'items', ids: [it.id] };
    App.setTool('pointer');
    App.changed();
  }

  function finishCreate(d, pt) {
    const r = dragRect(d, pt);
    if (!r.moved) { App.render(); return; }
    App.checkpoint();
    const p = App.placementAt(Math.min(d.start.x, pt.x) + 1);
    let it;
    const st = App.store.get('defaultStroke', { stroke: '#000000', strokeWidth: 0.5 });
    if (d.shape === 'line') {
      const c = App.snapPoint(pt, d.p);
      it = BV.newItem(doc(), 'line', p.ref, d.start.x - p.x0, d.start.y, c.x - d.start.x, c.y - d.start.y, { z: App.nextZ(), strokeWidth: Math.max(0.25, st.strokeWidth || 0.75), stroke: st.stroke });
      if (d.shift || d.constrain) constrainLine(it, d.constrain && !d.shift);
    } else if (d.shape === 'rframe' || d.shape === 'eframe') {
      if (d.shift) { const m = Math.max(r.w, r.h); r.w = r.h = m; }
      it = BV.newItem(doc(), 'frame', p.ref, r.x - p.x0, r.y, r.w, r.h, { z: App.nextZ(), shape: d.shape === 'rframe' ? 'rect' : 'ellipse', stroke: 'none', strokeWidth: 0 });
    } else {
      if (d.shift) { const m = Math.max(r.w, r.h); r.w = r.h = m; }
      it = BV.newItem(doc(), d.shape, p.ref, r.x - p.x0, r.y, r.w, r.h, { z: App.nextZ(), stroke: st.stroke, strokeWidth: st.strokeWidth, radius: d.shape === 'rect' ? App.store.get('cornerRadius', 0) : 0 });
    }
    App.sel = { kind: 'items', ids: [it.id] };
    App.setTool('pointer');
    App.changed();
  }

  function columnAt(p, x) {
    const cols = BV.pageColumns(doc(), p.ref);
    const lx = x - p.x0;
    let best = 0, bd = Infinity;
    cols.forEach((c, i) => { const dd = lx < c.x ? c.x - lx : lx > c.x + c.w ? lx - c.x - c.w : 0; if (dd < bd) { bd = dd; best = i; } });
    return { cols, i: best, col: cols[best] };
  }

  function finishNewText(d, pt) {
    const r = dragRect(d, pt);
    App.checkpoint();
    const p = App.placementAt(d.start.x);
    const story = BV.newStory(doc(), App.defaultStyle);
    let it;
    if (r.moved) {
      it = BV.newItem(doc(), 'text', p.ref, r.x - p.x0, r.y, Math.max(12, r.w), Math.max(12, r.h), { storyId: story.id, z: App.nextZ(), fresh: true, stroke: 'none', strokeWidth: 0 });
    } else {
      const { col } = columnAt(p, d.start.x);
      const inCol = d.start.y >= col.y && d.start.y <= col.y + col.h;
      const y = inCol ? d.start.y : col.y;
      const maxH = Math.max(14, col.y + col.h - y);
      it = BV.newItem(doc(), 'text', p.ref, col.x, y, col.w, 14, { storyId: story.id, z: App.nextZ(), fresh: true, autoGrow: true, maxH, stroke: 'none', strokeWidth: 0 });
    }
    story.frames.push(it.id);
    App.sel = { kind: 'text', sid: story.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
    App.lastUndoKey = 'newtext';
    focusIME();
    App.changed();
  }

  // ------------------------------------------------------------------ placing loaded text / graphics
  function finishPlace(d, pt) {
    const r = dragRect(d, pt);
    const p = App.placementAt(d.start.x);
    const ld = App.loaded;
    App.checkpoint();
    if (ld.kind === 'image') {
      const { col } = columnAt(p, d.start.x);
      let w, h, x, y;
      if (r.moved) { w = r.w; h = w * (ld.h / ld.w); x = r.x - p.x0; y = r.y; }
      else { w = Math.min(ld.w * 0.75, col.w); h = w * (ld.h / ld.w); x = d.start.x - p.x0; y = d.start.y; }
      const it = BV.newItem(doc(), 'image', p.ref, x, y, w, h, { src: ld.src, z: App.nextZ(), stroke: 'none', strokeWidth: 0, name: ld.name, ...(ld.link ? { link: ld.link } : {}) });
      App.setLoaded(null);
      App.sel = { kind: 'items', ids: [it.id] };
      App.setTool('pointer');
      App.changed();
      return;
    }
    const story = doc().stories[ld.sid];
    const mode = d.mods.ctrlKey !== App.autoflow ? 'auto' : d.mods.shiftKey ? 'semi' : 'manual';
    let rect, colInfo = columnAt(p, d.start.x);
    if (r.moved) rect = { x: r.x - p.x0, y: r.y, w: r.w, h: r.h };
    else {
      const col = colInfo.col;
      const inCol = d.start.y >= col.y && d.start.y < col.y + col.h - 12;
      const y = inCol ? d.start.y : col.y;
      rect = { x: col.x, y, w: col.w, h: col.y + col.h - y };
    }
    const it = BV.newItem(doc(), 'text', p.ref, rect.x, rect.y, rect.w, rect.h, { storyId: story.id, z: App.nextZ(), stroke: 'none', strokeWidth: 0 });
    const at = ld.after ? story.frames.indexOf(ld.after) + 1 : story.frames.length;
    story.frames.splice(at, 0, it.id);
    App.markStory(story.id);
    let last = it;
    if (mode === 'auto') last = App.autoflow(story, p, colInfo.i, it) || it;
    const lay = App.layoutFor(story);
    if (lay.overflow && mode !== 'manual') App.setLoaded({ kind: 'text', sid: story.id, after: last.id });
    else App.setLoaded(null);
    App.sel = App.loaded ? { kind: 'none' } : { kind: 'items', ids: [last.id] };
    if (!App.loaded) App.setTool('pointer');
    const lp = App.itemPlacement(last);
    if (!lp && !App.view.master) App.gotoPage(doc().pages.findIndex((pg) => pg.id === last.page));
    App.changed();
    BV.UI.status(lay.overflow ? 'Text continues, click the red ▼ to keep placing.' : 'All text placed.');
  }

  // Fill following columns and pages (adding pages at the end) until the story fits.
  App.autoflow = function (story, p, colIdx, firstItem) {
    const d = doc();
    let pageIdx = p.idx; // -1 on master pages
    let col = colIdx + 1;
    let insertAt = story.frames.indexOf(firstItem.id) + 1;
    const created = [];
    const newPages = [];
    let batch = 3;
    let last = firstItem;
    let guard = 0;
    const nextSlot = () => {
      for (;;) {
        const ref = pageIdx < 0 ? p.ref : d.pages[pageIdx].id;
        const cols = BV.pageColumns(d, ref);
        if (col < cols.length) return { ref, c: cols[col++] };
        if (pageIdx < 0) return null; // master spread: don't add pages
        pageIdx++;
        col = 0;
        if (pageIdx >= d.pages.length) { const np = BV.newPage(d); d.pages.push(np); newPages.push(np.id); }
      }
    };
    while (guard++ < 60) {
      App.markStory(story.id);
      const lay = App.layoutFor(story);
      if (!lay.overflow) break;
      if (d.pages.length > 3000) break;
      let added = 0;
      for (let k = 0; k < batch; k++) {
        const slot = nextSlot();
        if (!slot) break;
        const it = BV.newItem(d, 'text', slot.ref, slot.c.x, slot.c.y, slot.c.w, slot.c.h, { storyId: story.id, z: App.nextZ(), stroke: 'none', strokeWidth: 0 });
        story.frames.splice(insertAt++, 0, it.id);
        created.push(it.id);
        last = it;
        added++;
      }
      if (!added) break;
      batch = Math.min(batch * 2, 400);
    }
    // remove frames (and new pages) that ended up empty
    App.markStory(story.id);
    const lay = App.layoutFor(story);
    for (let i = created.length - 1; i >= 0; i--) {
      const id = created[i];
      const fl = lay.frames[id];
      if (fl && fl.lines.length) break;
      story.frames = story.frames.filter((f) => f !== id);
      delete d.items[id];
    }
    for (let i = newPages.length - 1; i >= 0; i--) {
      const pid = newPages[i];
      if (Object.values(d.items).some((it) => it.page === pid)) break;
      d.pages = d.pages.filter((pg) => pg.id !== pid);
    }
    App.markStory(story.id);
    void last;
    const remaining = created.filter((id) => d.items[id]);
    return remaining.length ? d.items[remaining[remaining.length - 1]] : firstItem;
  };

  // ------------------------------------------------------------------ text editing
  function focusIME() {
    const ime = $('ime');
    if (document.activeElement !== ime) ime.focus({ preventScroll: true });
  }
  App.focusIME = focusIME;
  const curStory = () => (App.sel.kind === 'text' ? doc().stories[App.sel.sid] : null);
  const collapsed = () => T.cmp(App.sel.a, App.sel.f) === 0;

  App.insertText = function (str, opts = {}) {
    const story = curStory();
    if (!story) return;
    str = str.normalize('NFC');
    App.checkpoint(opts.undoKey || (/\s/.test(str) ? 'type-space' : 'type'));
    let pos = App.sel.f;
    if (!collapsed()) pos = T.deleteRange(story, App.sel.a, App.sel.f);
    const para = story.paras[pos.p];
    const attrs = Object.assign(T.attrsAt(para, pos.o), App.typingAttrs || {});
    let nextStyle;
    if (str.includes('\n')) {
      const atEnd = pos.o >= T.paraText(para).length;
      const st = doc().styles[para.style];
      if (atEnd && st && st.next && doc().styles[st.next]) nextStyle = st.next;
    }
    const np = T.insert(story, pos, str, attrs, { nextStyle });
    App.sel = { kind: 'text', sid: story.id, a: np, f: { ...np } };
    if (str.includes('\n')) App.typingAttrs = null;
    App.goalX = null;
    App.changed(story.id);
    App.ensureCaretVisible();
  };

  function deleteBackward(word) {
    const story = curStory();
    App.checkpoint('delete');
    let a = App.sel.a, f = App.sel.f;
    if (collapsed()) {
      if (f.o > 0) {
        const text = T.paraText(story.paras[f.p]);
        let o = f.o - 1;
        if (word) o = T.wordBounds(text, Math.max(0, f.o - 1))[0];
        // Indic: Backspace removes one letter/sign, like Windows does (not the whole conjunct)
        else if (o > 0 && /[\uDC00-\uDFFF]/.test(text[o]) && /[\uD800-\uDBFF]/.test(text[o - 1])) o--;
        a = { p: f.p, o };
      } else if (f.p > 0) a = { p: f.p - 1, o: T.paraText(story.paras[f.p - 1]).length };
      else return;
    }
    const np = T.deleteRange(story, a, f);
    App.sel = { kind: 'text', sid: story.id, a: np, f: { ...np } };
    App.changed(story.id);
    App.ensureCaretVisible();
  }
  function deleteForward(word) {
    const story = curStory();
    App.checkpoint('delete');
    let a = App.sel.a, f = App.sel.f;
    if (collapsed()) {
      const text = T.paraText(story.paras[f.p]);
      if (f.o < text.length) f = { p: f.p, o: word ? T.wordBounds(text, f.o)[1] || T.nextBoundary(text, f.o) : T.nextBoundary(text, f.o) };
      else if (f.p < story.paras.length - 1) f = { p: f.p + 1, o: 0 };
      else return;
    }
    const np = T.deleteRange(story, a, f);
    App.sel = { kind: 'text', sid: story.id, a: np, f: { ...np } };
    App.changed(story.id);
  }

  function moveCaret(key, e) {
    const story = curStory();
    let f = { ...App.sel.f };
    const text = T.paraText(story.paras[f.p]);
    const ctrl = e.ctrlKey;
    if (!e.shiftKey && !collapsed() && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      const [s, en] = T.order(App.sel.a, App.sel.f);
      f = key === 'ArrowLeft' ? s : en;
      App.sel = { kind: 'text', sid: story.id, a: f, f: { ...f } };
      App.render();
      return;
    }
    if (key === 'ArrowLeft') {
      if (ctrl) { const wb = T.wordBounds(text, Math.max(0, f.o - 1)); f.o = f.o > 0 ? wb[0] : 0; if (f.o === App.sel.f.o && f.p > 0) f = { p: f.p - 1, o: T.paraText(story.paras[f.p - 1]).length }; }
      else if (f.o > 0) f.o = T.prevBoundary(text, f.o);
      else if (f.p > 0) f = { p: f.p - 1, o: T.paraText(story.paras[f.p - 1]).length };
      App.goalX = null;
    } else if (key === 'ArrowRight') {
      if (ctrl) { let o = f.o; while (o < text.length && /\s/.test(text[o])) o++; const wb = T.wordBounds(text, o); f.o = Math.max(wb[1], o); if (f.o === App.sel.f.o && f.p < story.paras.length - 1) f = { p: f.p + 1, o: 0 }; }
      else if (f.o < text.length) f.o = T.nextBoundary(text, f.o);
      else if (f.p < story.paras.length - 1) f = { p: f.p + 1, o: 0 };
      App.goalX = null;
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (ctrl) {
        f = key === 'ArrowUp' ? { p: f.p > 0 && f.o === 0 ? f.p - 1 : f.p, o: 0 } : { p: Math.min(story.paras.length - 1, f.p + (f.o >= text.length ? 1 : 0)), o: 0 };
        if (key === 'ArrowDown') f.o = f.p === App.sel.f.p ? text.length : 0;
      } else {
        const loc = App.locate(story.id, f);
        const lay = App.layoutFor(story);
        if (loc) {
          const idx = lay.lines.indexOf(loc.line);
          const X = App.goalX ?? loc.x;
          App.goalX = X;
          const tl = lay.lines[idx + (key === 'ArrowUp' ? -1 : 1)];
          if (tl) f = { p: tl.para, o: L.offsetAtX(doc(), story, tl, X, App.pageTextForStory(story)) };
          else f = key === 'ArrowUp' ? { p: 0, o: 0 } : T.storyEnd(story);
        }
        const keep = App.goalX;
        setF(f, e.shiftKey);
        App.goalX = keep;
        return;
      }
    } else if (key === 'Home' || key === 'End') {
      if (ctrl) f = key === 'Home' ? { p: 0, o: 0 } : T.storyEnd(story);
      else {
        const loc = App.locate(story.id, f);
        if (loc) {
          const l = loc.line;
          if (key === 'Home') f.o = l.s;
          else f.o = l.paraEnd ? l.e : (l.toks.length ? l.toks[l.toks.length - 1].we : l.e);
        }
      }
      App.goalX = null;
    }
    setF(f, e.shiftKey);
  }
  function setF(f, extend) {
    App.sel = { kind: 'text', sid: App.sel.sid, a: extend ? App.sel.a : { ...f }, f };
    App.typingAttrs = null;
    App.render();
    App.ensureCaretVisible();
  }

  // bring the caret's spread into view and scroll to it
  App.ensureCaretVisible = function () {
    requestAnimationFrame(() => {
      if (App.sel.kind !== 'text') return;
      const story = curStory();
      if (!story) return;
      const loc = App.locate(story.id, App.sel.f);
      if (!loc) return;
      const it = loc.it;
      if (!App.itemPlacement(it)) {
        if (String(it.page).startsWith('M')) App.gotoSpread(0, true);
        else App.gotoPage(doc().pages.findIndex((p) => p.id === it.page));
        return;
      }
      if (!App.caretClient) return;
      const b = $('board').getBoundingClientRect();
      const c = App.caretClient;
      const board = $('board');
      if (c.y > b.bottom - 20) board.scrollTop += c.y - b.bottom + 60;
      else if (c.y - loc.h * App.scale() < b.top + 10) board.scrollTop -= b.top - c.y + loc.h * App.scale() + 60;
      if (c.x > b.right - 20) board.scrollLeft += c.x - b.right + 60;
      else if (c.x < b.left + 10) board.scrollLeft -= b.left - c.x + 60;
    });
  };

  // ------------------------------------------------------------------ IME / typing
  const ime = $('ime');
  ime.addEventListener('input', (e) => {
    if (e.isComposing) return;
    const v = ime.value;
    ime.value = '';
    if (v && App.sel.kind === 'text') App.insertText(v);
  });
  ime.addEventListener('compositionend', () => {
    const v = ime.value;
    ime.value = '';
    if (v && App.sel.kind === 'text') App.insertText(v);
  });
  ime.addEventListener('keydown', (e) => {
    if (App.sel.kind !== 'text' || e.isComposing) return;
    const k = e.key;
    if (['Backspace', 'Delete', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape', 'F9'].includes(k)) e.stopPropagation();
    if (k === 'Backspace' && (e.ctrlKey || e.metaKey)) {
      // PageMaker kerning keys: Ctrl+Backspace closer, Ctrl+Shift+Backspace apart (1/25 em; with Alt 1/100 em)
      e.preventDefault();
      App.kern((e.shiftKey ? 1 : -1) * (e.altKey ? 0.01 : 0.04));
    }
    else if (k === 'Backspace') { e.preventDefault(); deleteBackward(false); }
    else if ((k === '-' || k === '_') && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); App.insertText('\u00AD'); }
    else if (k === 'Delete') { e.preventDefault(); deleteForward(e.ctrlKey); }
    else if (k === 'Enter') { e.preventDefault(); App.insertText(e.shiftKey ? BV.SOFT_BREAK : '\n', { undoKey: 'enter' }); }
    else if (k === 'Tab') { e.preventDefault(); App.insertText('\t'); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k)) { e.preventDefault(); moveCaret(k, e); }
    else if (k === 'Escape') {
      e.preventDefault();
      const sid = App.sel.sid, f = App.sel.f;
      const loc = App.locate(sid, f);
      App.setTool('pointer');
      const st = doc().stories[sid];
      if (st && st.frames.length) { const id = loc && doc().items[loc.it.id] ? loc.it.id : st.frames.find((x) => doc().items[x]); if (id) App.sel = { kind: 'items', ids: [id] }; }
      App.render();
    }
    else if (k === 'F9') { e.preventDefault(); App.setTool('pointer'); }
  });

  // clipboard
  App.clipItems = null;
  function onCopy(e, cut) {
    if (isFormField(document.activeElement) || !$('story-editor').hidden) return;
    if (App.sel.kind === 'text' && !collapsed()) {
      const story = curStory();
      const frag = T.extract(story, App.sel.a, App.sel.f);
      e.clipboardData.setData('text/plain', T.plain(frag).replace(/\u2028/g, '\n').replace(/\uE000/g, '#'));
      e.clipboardData.setData('application/x-bvm-text', JSON.stringify(frag));
      e.preventDefault();
      if (cut) { App.checkpoint(); const np = T.deleteRange(story, App.sel.a, App.sel.f); App.sel = { kind: 'text', sid: story.id, a: np, f: { ...np } }; App.changed(story.id); }
    } else if (App.sel.kind === 'items') {
      const items = App.sel.ids.map((id) => doc().items[id]).filter(Boolean);
      const stories = {};
      for (const it of items) if (it.type === 'text') stories[it.storyId] = doc().stories[it.storyId];
      App.clipItems = JSON.parse(JSON.stringify({ items, stories }));
      e.clipboardData.setData('text/plain', Object.values(stories).map((s) => s.paras.map(T.paraText).join('\n')).join('\n\n'));
      e.clipboardData.setData('application/x-bvm-items', '1');
      e.preventDefault();
      if (cut) { App.checkpoint(); App.deleteItems(App.sel.ids); App.sel = { kind: 'none' }; App.changed(); }
    }
  }
  document.addEventListener('copy', (e) => onCopy(e, false));
  document.addEventListener('cut', (e) => onCopy(e, true));
  document.addEventListener('paste', (e) => {
    if (isFormField(document.activeElement) || !$('story-editor').hidden) return;
    const cd = e.clipboardData;
    if (App.sel.kind === 'text') {
      e.preventDefault();
      const story = curStory();
      const raw = cd.getData('application/x-bvm-text');
      App.checkpoint();
      let pos = App.sel.f;
      if (!collapsed()) pos = T.deleteRange(story, App.sel.a, App.sel.f);
      let np;
      if (raw) np = T.insertFragment(doc(), story, pos, JSON.parse(raw));
      else {
        const text = (cd.getData('text/plain') || '').normalize('NFC');
        const para = story.paras[pos.p];
        np = T.insert(story, pos, text, Object.assign(T.attrsAt(para, pos.o), App.typingAttrs || {}));
      }
      App.sel = { kind: 'text', sid: story.id, a: np, f: { ...np } };
      App.changed(story.id);
      App.ensureCaretVisible();
      return;
    }
    if (cd.getData('application/x-bvm-items') && App.clipItems) {
      e.preventDefault();
      App.pasteItems();
      return;
    }
    const text = cd.getData('text/plain');
    if (text) {
      // paste plain text with nothing selected: load it like Place
      e.preventDefault();
      App.loadTextForPlacing(BV.Text.fromPlain(text.normalize('NFC'), App.defaultStyle));
    }
  });
  App.pasteItems = function () {
    App.checkpoint();
    const c = JSON.parse(JSON.stringify(App.clipItems));
    const p = App.placements[App.placements.length - 1];
    const sidMap = {};
    const ids = [];
    for (const it of c.items) {
      const nid = BV.newId(doc(), 'i');
      it.id = nid;
      it.z = App.nextZ();
      const samePage = App.placementOf(it.page);
      if (samePage) { it.x += 9; it.y += 9; } else it.page = p.ref;
      if (it.type === 'text') {
        if (!sidMap[it.storyId]) {
          const st = c.stories[it.storyId];
          const ns = { id: BV.newId(doc(), 's'), paras: JSON.parse(JSON.stringify(st.paras)), frames: [] };
          doc().stories[ns.id] = ns;
          sidMap[it.storyId] = ns.id;
        }
        it.storyId = sidMap[it.storyId];
        doc().stories[it.storyId].frames.push(nid);
      }
      doc().items[nid] = it;
      ids.push(nid);
    }
    App.sel = { kind: 'items', ids };
    App.setTool('pointer');
    App.changed();
  };
  const isFormField = (el) => el && el !== ime && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  App.isFormField = isFormField;

  // ------------------------------------------------------------------ global keys
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('modal-root').children.length) return;
    if (!$('story-editor').hidden) { if (e.key === 'Escape') { e.preventDefault(); App.closeStoryEditor(); } return; }
    if (isFormField(e.target)) { if (e.key === 'Escape') { e.target.blur(); App.render(); } return; }
    const k = e.key;
    if (k === 'F9') { e.preventDefault(); App.setTool(App.tool === 'pointer' ? (App.altTool === 'pointer' ? 'text' : App.altTool) : 'pointer'); return; }
    if (e.shiftKey && /^F[1-8]$/.test(k)) {
      e.preventDefault();
      App.setTool({ F1: 'pointer', F2: 'rotate', F3: 'line', F4: 'text', F5: 'rect', F6: 'crop', F7: 'ellipse', F8: 'polygon' }[k]);
      return;
    }
    if (App.polyDraft && (k === 'Escape' || k === 'Enter')) { e.preventDefault(); if (k === 'Enter') App.finishPolygon(); else { App.polyDraft = null; BV.UI.status(''); App.render(); } return; }
    if (e.ctrlKey && k === ' ') { e.preventDefault(); zoomKey = true; $('board').classList.add(e.altKey ? 'zoomout' : 'zoomin'); return; }
    if (App.sel.kind === 'text' && document.activeElement === ime) return; // handled by IME
    if (k === ' ' && !e.repeat) { spaceDown = true; $('board').classList.add('panning'); e.preventDefault(); return; }
    if (k === 'Escape') {
      if (App.loaded) { App.setLoaded(null); return; }
      if (App.sel.kind === 'text') { App.leaveText(); }
      App.sel = { kind: 'none' };
      App.render();
      return;
    }
    if ((k === 'Delete' || k === 'Backspace') && App.sel.kind === 'items') {
      e.preventDefault();
      App.checkpoint();
      App.deleteItems(App.sel.ids.filter((id) => !doc().items[id].locked));
      App.sel = { kind: 'none' };
      App.changed();
      return;
    }
    if (App.sel.kind === 'items' && k.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      App.checkpoint('nudge');
      for (const id of App.sel.ids) {
        const it = doc().items[id];
        if (it.locked) continue;
        if (k === 'ArrowLeft') it.x -= step; if (k === 'ArrowRight') it.x += step;
        if (k === 'ArrowUp') it.y -= step; if (k === 'ArrowDown') it.y += step;
      }
      App.changed();
      return;
    }
    if (k === 'PageDown') { e.preventDefault(); App.gotoSpread(App.view.spread + 1); return; }
    if (k === 'PageUp') { e.preventDefault(); App.gotoSpread(App.view.spread - 1); return; }
    if (k === 'Home' && !e.ctrlKey) { e.preventDefault(); App.gotoSpread(0); return; }
    if (k === 'End' && !e.ctrlKey) { e.preventDefault(); App.gotoSpread(1e9); return; }
  });
  document.addEventListener('keyup', (e) => {
    if ((e.key === ' ' || e.key === 'Control') && zoomKey) { zoomKey = false; $('board').classList.remove('zoomin', 'zoomout'); }
    if (e.key === ' ' && spaceDown) { spaceDown = false; if (!App.drag || App.drag.type !== 'pan') $('board').classList.remove('panning'); }
  });

  // ------------------------------------------------------------------ wire up board & rulers
  App.initInput = function () {
    const board = $('board');
    board.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    board.addEventListener('scroll', () => App.drawRulers());
    // Mouse wheel:  plain = scroll (turns the page at the end), Shift = scroll sideways,
    // Ctrl = zoom at the pointer, Ctrl+Shift = fine zoom, Ctrl+Alt = jump between zoom steps, Alt = previous/next page
    let edgePush = 0, edgeTimer = 0, wheelLock = 0;
    board.addEventListener('wheel', (e) => {
      const at = { x: e.clientX, y: e.clientY };
      const dy = e.deltaY || e.deltaX;
      if (e.ctrlKey && e.altKey) { e.preventDefault(); if (Date.now() - wheelLock > 120) { wheelLock = Date.now(); App.zoomStep(dy < 0 ? 1 : -1, at); } return; }
      if (e.ctrlKey && e.shiftKey) { e.preventDefault(); App.setZoom(App.view.zoom * (dy < 0 ? 1.04 : 1 / 1.04), at, false, true); return; }
      if (e.ctrlKey) { e.preventDefault(); App.setZoom(App.view.zoom * (dy < 0 ? 1.15 : 1 / 1.15), at, false, true); return; }
      if (e.altKey) {
        e.preventDefault();
        if (Date.now() - wheelLock > 220) { wheelLock = Date.now(); if (App.view.master) return; App.gotoSpread(App.view.spread + (dy > 0 ? 1 : -1)); }
        return;
      }
      if (e.shiftKey) {
        // Chromium scrolls sideways with Shift on Windows; do it ourselves so every platform behaves the same
        e.preventDefault();
        board.scrollLeft += e.deltaY || e.deltaX;
        return;
      }
      // turning pages by scrolling past the top or bottom of the pasteboard
      if (!App.store.get('wheelTurnsPages', true) || App.view.master || e.deltaX) return;
      const atBottom = board.scrollTop + board.clientHeight >= board.scrollHeight - 1;
      const atTop = board.scrollTop <= 0;
      if ((dy > 0 && atBottom) || (dy < 0 && atTop)) {
        edgePush += Math.abs(dy);
        clearTimeout(edgeTimer);
        edgeTimer = setTimeout(() => (edgePush = 0), 400);
        if (edgePush > 260) {
          edgePush = 0;
          const n = BV.spreads(doc()).length;
          const next = App.view.spread + (dy > 0 ? 1 : -1);
          if (next >= 0 && next < n) { App.gotoSpread(next, false, { at: dy > 0 ? 'top' : 'bottom' }); BV.UI.status(`Page ${BV.spreads(doc())[next].map((i) => BV.pageLabel(doc(), i)).join('–')}`); }
        }
      } else edgePush = 0;
    }, { passive: false });
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    const startGuide = (dir) => (e) => { e.preventDefault(); App.drag = { type: 'newguide', dir }; };
    $('ruler-h').addEventListener('mousedown', startGuide('h'));
    $('ruler-v').addEventListener('mousedown', startGuide('v'));
    $('ruler-corner').addEventListener('dblclick', () => {
      if (App.zeroPt) { App.zeroPt = null; App.drawRulers(); BV.UI.status('Zero point reset.'); return; }
      App.view.fit = true; App.fitZoom();
    });
    // drag the zero point out of the ruler corner (PageMaker)
    $('ruler-corner').addEventListener('mousedown', (e) => {
      if (App.zeroLock || e.button !== 0) return;
      e.preventDefault();
      const mv = (ev) => { App.mouseSpread = App.clientToSpread(ev.clientX, ev.clientY); App.drawRulers(); };
      const up = (ev) => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        const r = $('board').getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientY < r.top) return;
        const pt = App.clientToSpread(ev.clientX, ev.clientY);
        App.zeroPt = { x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 };
        App.drawRulers();
        BV.UI.status('Zero point moved. Double-click the ruler corner to reset it.');
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });

    // overlay while dragging
    App.dragOverlay = (px) => {
      const d = App.drag;
      if (!d) return '';
      const W = doc().setup.w;
      if (d.type === 'newguide' && d.pos !== undefined) {
        if (d.dir === 'h') return `<line x1="${-App.pad.x}" x2="${BV.spreadWidth(doc()) + App.pad.x}" y1="${d.pos}" y2="${d.pos}" stroke="#00b2f0" stroke-width="${px}"/>`;
        return `<line y1="${-App.pad.y}" y2="${doc().setup.h + App.pad.y}" x1="${d.pos}" x2="${d.pos}" stroke="#00b2f0" stroke-width="${px}"/>`;
      }
      if (d.type === 'move' && d.smart && (d.smart.x != null || d.smart.y != null)) {
        // Smart Guides: the line the object lines up with
        let o = '';
        if (d.smart.x != null) o += `<line x1="${d.smart.x}" x2="${d.smart.x}" y1="${-App.pad.y}" y2="${doc().setup.h + App.pad.y}" stroke="#ff2fa0" stroke-width="${px}"/>`;
        if (d.smart.y != null) o += `<line y1="${d.smart.y}" y2="${d.smart.y}" x1="${-App.pad.x}" x2="${BV.spreadWidth(doc()) + App.pad.x}" stroke="#ff2fa0" stroke-width="${px}"/>`;
        return o;
      }
      if (!d.cur || !d.start) return '';
      const c = App.snapPoint(d.cur, d.p || App.placementAt(d.cur.x));
      const x = Math.min(d.start.x, c.x), y = Math.min(d.start.y, c.y), w = Math.abs(c.x - d.start.x), h = Math.abs(c.y - d.start.y);
      void W;
      if (d.type === 'zoombox') return `<rect x="${Math.min(d.start.x, d.cur.x)}" y="${Math.min(d.start.y, d.cur.y)}" width="${Math.abs(d.cur.x - d.start.x)}" height="${Math.abs(d.cur.y - d.start.y)}" fill="none" stroke="#2a6be0" stroke-dasharray="${4 * px} ${3 * px}" stroke-width="${px}"/>`;
      if (d.type === 'marquee') return `<rect x="${Math.min(d.start.x, d.cur.x)}" y="${Math.min(d.start.y, d.cur.y)}" width="${Math.abs(d.cur.x - d.start.x)}" height="${Math.abs(d.cur.y - d.start.y)}" fill="rgba(42,107,224,.08)" stroke="#2a6be0" stroke-dasharray="${4 * px} ${3 * px}" stroke-width="${px}"/>`;
      if (d.type === 'create' && d.shape === 'line') return `<line x1="${d.start.x}" y1="${d.start.y}" x2="${c.x}" y2="${c.y}" stroke="#000" stroke-width="${px}"/>`;
      if (d.type === 'polyreg') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-dasharray="${3 * px} ${2 * px}" stroke-width="${px}"/>`;
      if (d.type === 'create' && (d.shape === 'ellipse' || d.shape === 'eframe')) return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="#000" stroke-width="${px}"/>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-dasharray="${d.type === 'create' ? 'none' : `${3 * px} ${2 * px}`}" stroke-width="${px}"/>`;
    };
  };
})();
