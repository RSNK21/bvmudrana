/* BV Mudrana: text layout engine.
   Shaping is done by Chromium (HarfBuzz) through canvas measureText, so Kannada ottus,
   Devanagari conjuncts and IAST diacritics measure exactly as they will be drawn.
   Supports tracking, set width, all caps, tab stops and text wrap around objects. */
(function () {
  const BV = (window.BV = window.BV || {});
  const ctx = document.createElement('canvas').getContext('2d');
  let cache = new Map();
  let curFont = '', curLS = '0px';
  let gen = 1;
  let paraCache = new WeakMap(); // para.runs array -> measured tokens (runs arrays are replaced on every edit)
  const DEFAULT_TAB = 36; // PageMaker default: every 0.5 inch

  function measure(css, str, ls) {
    if (!str) return 0;
    const lsv = ls ? ls.toFixed(3) + 'px' : '0px';
    const key = css + '\u0001' + lsv + '\u0001' + str;
    let w = cache.get(key);
    if (w === undefined) {
      if (curFont !== css) { ctx.font = css; curFont = css; }
      if (curLS !== lsv) { try { ctx.letterSpacing = lsv; } catch (_) {} curLS = lsv; }
      w = ctx.measureText(str).width;
      if (cache.size > 400000) cache = new Map();
      cache.set(key, w);
    }
    return w;
  }
  function clearCache() { cache = new Map(); curFont = ''; curLS = '0px'; gen++; paraCache = new WeakMap(); }

  const paraText = (para) => para.runs.map((r) => r.t).join('');
  const capsOf = (s) => { let o = ''; for (const c of s) { const u = c.toUpperCase(); o += u.length === c.length ? u : c; } return o; };

  // Prepare run info for a paragraph: [{a, b, cp, css, ls, ws}]
  function runInfo(doc, para, pp) {
    const out = [];
    let a = 0;
    for (const r of para.runs) {
      const cp = BV.charProps(pp, r);
      out.push({ a, b: a + r.t.length, cp, css: BV.cssFont(cp), ls: (cp.track || 0) * cp.size, ws: (cp.width || 100) / 100, run: r });
      a += r.t.length;
    }
    return out;
  }
  const subst = (s, ctxPage, caps) => {
    if (s.indexOf(BV.PAGE_MARKER) >= 0) s = s.split(BV.PAGE_MARKER).join(ctxPage || '#');
    if (s.indexOf('\t') >= 0) s = s.replace(/\t/g, '');
    if (/[\u00AD\uE001\uE002]/.test(s)) s = s.replace(/[\u00AD\uE001\uE002]/g, ''); // discretionary hyphen, index and anchor markers
    return caps ? capsOf(s) : s;
  };
  const runWidth = (r, str) => measure(r.css, str, r.ls) * r.ws;

  function measureRange(text, runs, a, b, pageText) {
    let w = 0;
    for (const r of runs) {
      if (r.b <= a || r.a >= b) continue;
      const s = Math.max(a, r.a), e = Math.min(b, r.b);
      w += runWidth(r, subst(text.slice(s, e), pageText, r.cp.caps));
    }
    return w;
  }

  // Grapheme cluster boundaries (Chromium's ICU keeps conjuncts together)
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  function graphemeBounds(text) {
    const b = [];
    for (const s of seg.segment(text)) b.push(s.index);
    b.push(text.length);
    return b;
  }

  function tokenize(text, runs, pageText) {
    const re = /\u2028|[^ \t\u2028]+[ \t]*|[ \t]+/g;
    const toks = [];
    let m;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (m[0] === BV.SOFT_BREAK) { toks.push({ s, we: s, e, ww: 0, sw: 0, br: true }); continue; }
      let we = e;
      while (we > s && (text[we - 1] === ' ' || text[we - 1] === '\t')) we--;
      const space = text.slice(we, e);
      toks.push({ s, we, e, ww: measureRange(text, runs, s, we, pageText), sw: measureRange(text, runs, we, e, pageText), br: false, tab: space.indexOf('\t') >= 0 });
    }
    return toks;
  }

  // Split an over-long token at the last grapheme boundary that fits `avail`
  function splitToken(text, runs, tk, avail, pageText) {
    const bounds = graphemeBounds(text.slice(tk.s, tk.we)).map((x) => x + tk.s);
    let cut = bounds[1];
    for (let i = 1; i < bounds.length - 1; i++) {
      if (measureRange(text, runs, tk.s, bounds[i], pageText) <= avail) cut = bounds[i];
      else break;
    }
    const a = { s: tk.s, we: cut, e: cut, ww: measureRange(text, runs, tk.s, cut, pageText), sw: 0, br: false };
    const b = { s: cut, we: tk.we, e: tk.e, ww: measureRange(text, runs, cut, tk.we, pageText), sw: tk.sw, br: tk.br, tab: tk.tab };
    return [a, b];
  }

  // break a word at a discretionary hyphen (Ctrl+- in PageMaker) so the first part + '-' fits `room`
  // automatic hyphenation (Liang's patterns, US English) for paragraphs that ask for it
  let hyphenator = null;
  function autoBreaks(word) {
    if (!hyphenator && window.createHyphenator && window.hyphenationPatternsEnUs) hyphenator = window.createHyphenator(window.hyphenationPatternsEnUs, { hyphenChar: '\u00AD' });
    if (!hyphenator || word.length < 6 || !/^[\p{L}\p{M}'’-]+[.,;:!?)\]’”]*$/u.test(word.replace(/^[(\[‘“]+/, ''))) return [];
    const h = hyphenator(word);
    const out = [];
    let k = 0;
    for (const ch of h) { if (ch === '\u00AD') out.push(k); else k += ch.length; }
    return out;
  }
  function hyphenSplit(text, runs, tk, room, pageText, auto) {
    const word = text.slice(tk.s, tk.we);
    if (word.indexOf('\u00AD') < 0) {
      if (!auto) return null;
      const br = autoBreaks(word);
      const r = runs.find((x) => x.a <= tk.s && x.b > tk.s) || runs[0];
      const hw = runWidth(r, '-');
      for (let i = br.length - 1; i >= 0; i--) {
        const cut = tk.s + br[i];
        const w = measureRange(text, runs, tk.s, cut, pageText) + hw;
        if (w <= room) return [{ s: tk.s, we: cut, e: cut, ww: w, sw: 0, br: false, hy: true }, { s: cut, we: tk.we, e: tk.e, ww: measureRange(text, runs, cut, tk.we, pageText), sw: tk.sw, br: tk.br, tab: tk.tab }];
      }
      return null;
    }
    const r = runs.find((x) => x.a <= tk.s && x.b > tk.s) || runs[0];
    const hw = runWidth(r, '-');
    for (let i = word.lastIndexOf('\u00AD'); i > 0; i = word.lastIndexOf('\u00AD', i - 1)) {
      const cut = tk.s + i + 1;
      const w = measureRange(text, runs, tk.s, cut, pageText) + hw;
      if (w <= room) return [{ s: tk.s, we: cut, e: cut, ww: w, sw: 0, br: false, hy: true }, { s: cut, we: tk.we, e: tk.e, ww: measureRange(text, runs, cut, tk.we, pageText), sw: tk.sw, br: tk.br, tab: tk.tab }];
      if (i === 0) break;
    }
    return null;
  }

  function nextTabStop(pp, absX, frameW) {
    const stops = (pp.tabs || []).filter((t) => t.pos > absX + 0.5).sort((a, b) => a.pos - b.pos);
    if (stops.length) return stops[0];
    const p = (Math.floor(absX / DEFAULT_TAB) + 1) * DEFAULT_TAB;
    return { pos: Math.min(p, frameW), align: 'left' };
  }

  // free horizontal intervals of a frame for a band [top, bottom] given wrap obstacles
  function freeIntervals(W, top, bottom, obstacles) {
    let iv = [[0, W]];
    for (const o of obstacles) {
      if (o.y0 >= bottom || o.y1 <= top) continue;
      const next = [];
      for (const [a, b] of iv) {
        if (o.x1 <= a || o.x0 >= b) { next.push([a, b]); continue; }
        if (o.x0 > a) next.push([a, o.x0]);
        if (o.x1 < b) next.push([o.x1, b]);
      }
      iv = next;
    }
    return iv.filter(([a, b]) => b - a >= 18);
  }

  /**
   * Lay out a story into its frames.
   * opts.pageText: string used for the auto page-number marker.
   * opts.obstacles(frame): wrap rectangles in frame coordinates.
   * Returns { frames: {itemId: {lines, usedH}}, overflow, lines: [all lines] }
   */
  function layoutStory(doc, story, opts = {}) {
    const pageText = opts.pageText;
    const frames = story.frames.map((id) => doc.items[id]).filter(Boolean);
    const res = { frames: {}, overflow: false, lines: [] };
    frames.forEach((f) => (res.frames[f.id] = { lines: [], usedH: 0, rules: [], notes: [], fnH: 0 }));
    if (!frames.length) { res.overflow = paraText(story.paras[0] || { runs: [] }).length > 0 || story.paras.length > 1; return res; }

    let fi = 0;
    let y = 0;
    let frame = frames[0];
    const obsCache = new Map();
    const obstaclesOf = (f) => {
      if (!opts.obstacles) return [];
      if (!obsCache.has(f.id)) obsCache.set(f.id, opts.obstacles(f) || []);
      return obsCache.get(f.id);
    };
    const frameH = (f) => (f.autoGrow ? f.maxH || f.h : f.h) - ((res.frames[f.id] && res.frames[f.id].fnH) || 0);
    const W0 = (f, pp) => f.w - pp.leftIndent - pp.firstIndent - pp.rightIndent;
    const nextFrame = () => {
      fi++;
      if (fi >= frames.length) return false;
      frame = frames[fi];
      y = 0;
      return true;
    };

    const FN_GAP = 9; // space and the short rule above the footnotes
    let fnBump = false;
    outer: for (let p = 0; p < story.paras.length; p++) {
      const para = story.paras[p];
      const pp = BV.paraProps(doc, para);
      const ckey = gen + '|' + para.style + '|' + JSON.stringify(para.ov || 0) + '|' + JSON.stringify(doc.styles[para.style] || 0) + '|' + (pageText || '');
      let pc = paraCache.get(para.runs);
      if (!pc || pc.key !== ckey) {
        const t0 = paraText(para);
        const r0 = runInfo(doc, para, pp);
        pc = { key: ckey, text: t0, runs: r0, toks: tokenize(t0, r0, pageText) };
        paraCache.set(para.runs, pc);
      }
      const text = pc.text;
      const runs = pc.runs;
      const maxSize = Math.max(...runs.map((r) => r.cp.size), pp.size);
      const leading = pp.leading && pp.leading !== 'auto' ? pp.leading : maxSize * 1.2;

      const started = () => y > 0 || res.frames[frame.id].lines.length;
      if (pp.pageBreak && p > 0 && started()) {
        // page break before: go to the first text block on another page
        const pg = frame.page;
        do { if (!nextFrame()) { res.overflow = true; break outer; } } while (frame.page === pg);
      } else if (pp.breakBefore && started() && p > 0) {
        if (!nextFrame()) { res.overflow = true; break outer; }
      } else if (pp.frameStart != null && fi < pp.frameStart && p > 0) {
        // this text starts in a given text block of the story (as it did in PageMaker)
        while (fi < pp.frameStart) if (!nextFrame()) { res.overflow = true; break outer; }
      }
      let toks = pc.toks.slice();
      // drop cap: the first letter (grapheme cluster) is drawn across `dropCap` lines
      let dc = null;
      if (pp.dropCap > 1 && text.length && text[0] !== BV.SOFT_BREAK && text[0] !== '\t') {
        const e = graphemeBounds(text)[1];
        const r0 = runs.find((r) => r.a <= 0 && r.b >= e) || runs[0];
        const n = pp.dropCap;
        const cp = Object.assign({}, r0.cp, { size: r0.cp.size + (leading * (n - 1)) / 0.7, shift: -(leading * (n - 1)), pos: null });
        const css = BV.cssFont(cp);
        const t = subst(text.slice(0, e), pageText, cp.caps);
        dc = { e, cp, css, t, n, w: measure(css, t, 0) * r0.ws + (pp.dropGap ?? 2), ls: 0, ws: r0.ws };
        if (toks.length && toks[0].s === 0) {
          const t0 = toks[0];
          if (t0.we <= e) toks.shift();
          else toks[0] = Object.assign({}, t0, { s: e, ww: measureRange(text, runs, e, t0.we, pageText) });
        }
      }
      const totalW = toks.reduce((s0, t) => s0 + t.ww + t.sw, 0);
      const estLines = Math.max(1, Math.ceil(totalW / Math.max(10, W0(frame, pp))) + (text.match(/\u2028/g) || []).length);
      let ti = 0;
      let firstLine = true;
      let lineNo = 0;
      let guard = 0;
      do {
        if (guard++ > 20000) break outer;
        // vertical fit
        let top = y + (firstLine && res.frames[frame.id].lines.length ? pp.spaceBefore : 0);
        let need = leading;
        const keepWith = pp.keepWith !== undefined && pp.keepWith !== null ? +pp.keepWith : pp.keepNext ? 2 : 0;
        if (firstLine && res.frames[frame.id].lines.length) {
          if (keepWith > 0 && p + 1 < story.paras.length) {
            // keep a heading/śloka together with the first lines of what follows
            const np = BV.paraProps(doc, story.paras[p + 1]);
            const nl = np.leading && np.leading !== 'auto' ? np.leading : np.size * 1.2;
            const ownLines = pp.keepTogether !== false ? estLines : 1;
            need = leading * ownLines + pp.spaceAfter + np.spaceBefore + nl * keepWith;
          } else if (pp.keepTogether) {
            need = leading * estLines;
          } else if (pp.orphan > 0) {
            need = leading * Math.min(estLines, pp.orphan);
          } else if (pp.orphan === undefined && estLines > 1) {
            // no orphans by default: don't leave a lone first line of a long paragraph at the bottom
            need = leading * 2;
          }
          if (need > frameH(frame)) need = leading; // could never fit: just flow
        }
        if (top + need > frameH(frame) + 0.5 && (top + leading > frameH(frame) + 0.5 || fi < frames.length - 1)) {
          // widow control: carry enough lines over that the next block doesn't start with a lone line
          if (!firstLine && pp.widow > 0 && fi < frames.length - 1) {
            const remW = toks.slice(ti).reduce((s0, t) => s0 + t.ww + t.sw, 0);
            const rem = Math.max(1, Math.ceil(remW / Math.max(10, W0(frame, pp))));
            if (rem < pp.widow) {
              const fl = res.frames[frame.id].lines;
              const mine = fl.filter((l) => l.para === p);
              let back = Math.min(pp.widow - rem, mine.length);
              if (mine.length - back < Math.max(1, pp.orphan || 1)) back = mine.length;
              if (back > 0) {
                const popped = mine.slice(mine.length - back);
                const drop = new Set(popped);
                res.frames[frame.id].lines = fl.filter((l) => !drop.has(l));
                res.lines = res.lines.filter((l) => !drop.has(l));
                ti = popped[0].ti0;
                lineNo -= back;
                if (back === mine.length) { firstLine = true; res.frames[frame.id].rules = res.frames[frame.id].rules.filter((r) => r.para !== p); }
              }
            }
          }
          if (!nextFrame()) { res.overflow = true; break outer; }
          top = y + (firstLine && res.frames[frame.id].lines.length ? pp.spaceBefore : 0);
        }
        const W = frame.w;
        // text wrap: which parts of this band are free?
        const obs = obstaclesOf(frame);
        let intervals = obs.length ? freeIntervals(W, top, top + leading, obs) : [[0, W]];
        if (!intervals.length) {
          // band fully blocked: jump below the lowest blocking object
          const blockers = obs.filter((o) => o.y0 < top + leading && o.y1 > top);
          y = Math.max(top + 1, Math.min(...blockers.map((o) => o.y1)));
          continue;
        }
        intervals.forEach(([ia, ib], k) => {
          if (ti >= toks.length && !(k === 0 && toks.length === 0)) return;
          const isFirstIv = k === 0;
          const dcIn = dc && lineNo < dc.n && isFirstIv ? dc.w : 0;
          const li = (ia < 0.5 ? pp.leftIndent : 0) + (firstLine && isFirstIv && !dc ? pp.firstIndent : 0) + dcIn;
          const ti0 = ti;
          const ri = ib > W - 0.5 ? pp.rightIndent : 0;
          const avail = Math.max(10, ib - ia - li - ri);
          // fill line
          const lt = [];
          let cur = 0; // x of the end of the last placed word (relative to line start)
          let hasTab = false;
          while (ti < toks.length) {
            let tk = toks[ti];
            if (!lt.length && tk.ww > avail && tk.we - tk.s > 1) {
              const [a, b] = splitToken(text, runs, tk, avail, pageText);
              if (a.we > a.s && b.we > b.s) { toks.splice(ti, 1, a, b); tk = a; }
            }
            let start = 0;
            if (lt.length) {
              const prev = lt[lt.length - 1];
              if (prev.tab) {
                hasTab = true;
                const stop = nextTabStop(pp, ia + li + cur + prev.sw, W);
                const rel = stop.align === 'right' || stop.align === 'center' ? Math.min(stop.pos - ia - li, avail) : stop.pos - ia - li;
                // a right or centre tab aligns everything up to the next tab, not just the next word
                let gw = tk.ww;
                if (stop.align === 'right' || stop.align === 'center') for (let j = ti; j < toks.length - 1 && !toks[j].tab && !toks[j].br; j++) gw += toks[j].sw + toks[j + 1].ww;
                start = stop.align === 'right' ? Math.max(cur + prev.sw, rel - gw) : stop.align === 'center' ? Math.max(cur + prev.sw, rel - gw / 2) : Math.max(cur + prev.sw, rel);
              } else start = cur + prev.sw;
            } else if (firstLine === false && tk.tab === undefined) start = 0;
            // justified text may squeeze its word spaces down to the paragraph's minimum (PageMaker, InDesign)
            const lastTk = lt[lt.length - 1];
            const shrink = lt.length && pp.wordSpaceMin != null && pp.wordSpaceMin < 1 && (pp.align === 'justify' || pp.align === 'force') && !hasTab && !(lastTk && lastTk.tab) ? lt.reduce((a2, t2) => a2 + t2.sw, 0) * (1 - pp.wordSpaceMin) : 0;
            if (lt.length && start + tk.ww > avail + 0.01 + shrink) {
              const hs = pp.hyphenate !== false && hyphenSplit(text, runs, tk, avail - start + shrink, pageText, pp.hyphenate === true && pp.autoHyphen !== false);
              if (hs) { toks.splice(ti, 1, hs[0], hs[1]); lt.push(Object.assign({}, hs[0], { x0: start })); cur = start + hs[0].ww; ti++; }
              break;
            }
            tk = Object.assign({}, tk, { x0: start });
            lt.push(tk);
            cur = start + tk.ww;
            ti++;
            if (tk.br) break;
          }
          // a trailing tab at the very end of a paragraph still advances (tab leaders, TOC)
          const lastLine = ti >= toks.length;
          const forced = lt.length && lt[lt.length - 1].br;
          let free = avail - cur;
          let off = 0, extra = 0;
          const align = hasTab ? 'left' : pp.align;
          if (align === 'right') off = free;
          else if (align === 'center') off = free / 2;
          else if ((align === 'justify' && (!lastLine || (pp.justifyLast && free < avail * 0.2)) && !forced) || align === 'force') {
            const gaps = lt.slice(0, -1).filter((t) => t.sw > 0).length;
            if (gaps > 0 && free > 0) extra = free / gaps;
          }
          if (free < -0.01 && !hasTab) {
            // a line that only fits with squeezed word spaces
            const gaps = lt.slice(0, -1).filter((t) => t.sw > 0).length;
            if (gaps > 0) { extra = free / gaps; off = 0; }
          }
          const base0 = ia + li + off;
          const toksOut = [];
          const segs = [];
          let gapsSoFar = 0;
          lt.forEach((tk, j) => {
            const x = base0 + tk.x0 + gapsSoFar * extra;
            const t = { s: tk.s, we: tk.we, e: tk.e, x, ww: tk.ww, sw: 0 };
            // drawing segments for the word part
            let sx = x;
            const single = runs.length === 1 ? runs[0] : runs.find((r) => r.a <= tk.s && r.b >= tk.we);
            if (single && tk.we > tk.s) {
              segs.push({ x: sx, s: tk.s, e: tk.we, t: subst(text.slice(tk.s, tk.we), pageText, single.cp.caps), cp: single.cp, w: tk.ww, ls: single.ls, ws: single.ws });
            } else for (const r of runs) {
              if (r.b <= tk.s || r.a >= tk.we) continue;
              const s = Math.max(tk.s, r.a), e = Math.min(tk.we, r.b);
              const str = subst(text.slice(s, e), pageText, r.cp.caps);
              const w = runWidth(r, str);
              segs.push({ x: sx, s, e, t: str, cp: r.cp, w, ls: r.ls, ws: r.ws });
              sx += w;
            }
            if (tk.hy && segs.length) segs[segs.length - 1].t += '-';
            if (j < lt.length - 1) {
              const nx = lt[j + 1].x0 - tk.x0 - tk.ww;
              if (tk.sw > 0 && !tk.tab) gapsSoFar++;
              t.sw = nx + (tk.sw > 0 && !tk.tab ? extra : 0);
            } else t.sw = tk.sw;
            toksOut.push(t);
          });
          const ls = lt.length ? lt[0].s : (toks.length ? toks[Math.min(ti, toks.length) - 1].e : 0);
          const le = lastLine ? text.length : lt.length ? lt[lt.length - 1].e : ls;
          if (dc && firstLine && isFirstIv) segs.unshift({ x: ia + (ia < 0.5 ? pp.leftIndent : 0), s: 0, e: dc.e, t: dc.t, cp: dc.cp, w: dc.w, ls: 0, ws: dc.ws, dropCap: true });
          const line = {
            frame: frame.id, para: p, s: lt.length ? ls : (firstLine ? 0 : ls), e: le,
            top, h: leading, base: top + leading * 0.74, x0: base0, toks: toksOut, segs,
            paraEnd: lastLine, first: firstLine, avail, li: ia + li, ti0,
          };
          // paragraph rules (Type ▸ Paragraph ▸ Rules)
          const ruleOf = (R, yy) => {
            const lw = Math.max(0.1, R.w || 1);
            let x0, x1;
            if (R.extent === 'text' && lt.length) { x0 = base0 + lt[0].x0; x1 = base0 + lt[lt.length - 1].x0 + lt[lt.length - 1].ww; }
            else { x0 = (pp.leftIndent || 0); x1 = W - (pp.rightIndent || 0); }
            res.frames[frame.id].rules.push({ para: p, x0: x0 - (R.indL || 0), x1: x1 + (R.indR || 0), y: yy, w: lw, color: R.color || '#000000', style: R.style || 'solid' });
          };
          if (firstLine && isFirstIv && pp.ruleAbove) ruleOf(pp.ruleAbove, top - (pp.ruleAbove.offset || 0) - Math.max(0.1, pp.ruleAbove.w || 1) / 2);
          if (lastLine && isFirstIv && pp.ruleBelow) ruleOf(pp.ruleBelow, top + leading + (pp.ruleBelow.offset || 0) + Math.max(0.1, pp.ruleBelow.w || 1) / 2);
          // footnotes: notes whose markers are on this line go to the bottom of this text block
          if (opts.footnote && isFirstIv && intervals.length === 1) {
            const ids = [];
            for (const r of runs) if (r.run.fn && r.b > line.s && r.a < Math.max(line.e, line.s + 1) && !ids.includes(r.run.fn)) ids.push(r.run.fn);
            const fr = res.frames[frame.id];
            const fresh = ids.filter((id) => !fr.notes.some((n) => n.id === id));
            if (fresh.length) {
              const notes = fresh.map((id) => Object.assign({ id }, opts.footnote(id, frame.w))).filter((n) => n.h > 0);
              const add = notes.reduce((a, n) => a + n.h, 0) + (fr.notes.length ? 0 : FN_GAP);
              const full = (frame.autoGrow ? frame.maxH || frame.h : frame.h);
              if (top + leading + fr.fnH + add > full + 0.5 && fr.lines.length && fi < frames.length - 1) { fnBump = true; ti = ti0; return; }
              for (const n of notes) fr.notes.push(n);
              fr.fnH += add;
            }
          }
          res.frames[frame.id].lines.push(line);
          res.lines.push(line);
          firstLine = false;
          if (isFirstIv) lineNo++;
        });
        if (fnBump) { fnBump = false; if (!nextFrame()) { res.overflow = true; break outer; } continue; }
        y = top + leading;
        res.frames[frame.id].usedH = y;
      } while (ti < toks.length);
      y += pp.spaceAfter;
    }
    return res;
  }

  // x position (frame coords) of a caret offset within a line
  function caretX(doc, story, line, offset, pageText) {
    const para = story.paras[line.para];
    const pp = BV.paraProps(doc, para);
    const text = paraText(para);
    const runs = runInfo(doc, para, pp);
    if (!line.toks.length) return line.x0;
    for (let i = 0; i < line.toks.length; i++) {
      const t = line.toks[i];
      if (offset <= t.we || i === line.toks.length - 1 || offset < t.e) {
        if (offset <= t.s) return t.x;
        if (offset <= t.we) return t.x + measureRange(text, runs, t.s, offset, pageText);
        const spaceChars = t.e - t.we;
        const frac = spaceChars ? Math.min(1, (offset - t.we) / spaceChars) : 0;
        return t.x + t.ww + frac * t.sw;
      }
    }
    const t = line.toks[line.toks.length - 1];
    return t.x + t.ww;
  }

  // nearest offset in line for x (frame coords)
  function offsetAtX(doc, story, line, x, pageText) {
    const text = paraText(story.paras[line.para]);
    const bounds = graphemeBounds(text).filter((b) => b >= line.s && b <= line.e);
    let best = line.s, bd = Infinity;
    for (const b of bounds) {
      const cx = caretX(doc, story, line, b, pageText);
      const d = Math.abs(cx - x);
      if (d < bd) { bd = d; best = b; }
    }
    // wrapped line: its end offset belongs to the next line, so stop before the trailing space
    if (!line.paraEnd && best >= line.e && line.toks.length) {
      const last = line.toks[line.toks.length - 1];
      best = last.we < line.e ? last.we : Math.max(line.s, bounds[bounds.length - 2] ?? line.s);
    }
    return best;
  }

  BV.Layout = { measure, clearCache, layoutStory, caretX, offsetAtX, paraText, graphemeBounds, measureRange, runInfo, capsOf };
})();
