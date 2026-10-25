/* BV Mudrana: turn a parsed PageMaker 6/7 publication into a BV Mudrana document.
   Legacy-font text (Nudi …) becomes Unicode; layout, threads, masters and shapes are kept. */
(function () {
  const BV = window.BV;
  const TW = 1 / 20; // twips → points
  const ALIGN = { 0: 'left', 1: 'right', 2: 'center', 3: 'justify', 4: 'force' };
  const cp1252 = new TextDecoder('windows-1252');
  const latin1 = new TextDecoder('latin1');
  const NUDI_MARKS = /^[ÀÁÂÃÄÅÆÇÈÉÊËïðõÌÍÎÏÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîü]+/;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function clean(s) {
    // PageMaker control codes: 0x05 dash, 0x18 page number, 0x0B/0x0A line break; others are invisible markers
    let o = '';
    for (const c of s) {
      const k = c.charCodeAt(0);
      if (k === 0x0d || k === 0x09) o += c;
      else if (k === 0x18 || k === 0x04) o += BV.PAGE_MARKER;
      else if (k === 0x05) o += '–';
      else if (k === 0x0a || k === 0x0b) o += BV.SOFT_BREAK;
      else if (k < 0x20 || k === 0x7f || k === 0xad) continue;
      else o += c;
    }
    return o;
  }

  /**
   * opts: { kannadaFont, nudiScale, fontMap: {old: new}, availableFonts: Set }
   * returns { doc, report }
   */
  function toDoc(pm, opts = {}) {
    const kfont = opts.kannadaFont || 'Noto Serif Kannada';
    const nudiScale = opts.nudiScale || 1;
    const fontMap = opts.fontMap || {};
    const report = { pages: 0, stories: 0, frames: 0, shapes: 0, images: 0, imagesMissing: 0, convertedChars: 0, legacyFonts: {}, missingFonts: {}, notes: [] };
    const S = pm.setup;
    const pageW = S.pageW * TW, pageH = S.pageH * TW;
    const doubleSided = !!S.doubleSided;
    const nPages = Math.max(1, pm.spreads.length);
    const doc = BV.newDocument({ w: pageW, h: pageH, doubleSided, facing: doubleSided, pageCount: nPages, columns: 1, units: 'mm', startPage: S.startPage || 1 });
    report.pages = nPages;
    // colours
    if (pm.colors && pm.colors.length) {
      const seen = new Set();
      doc.colors = [];
      for (const c of pm.colors) {
        if (!c.name || seen.has(c.name) || c.name === 'None') continue;
        seen.add(c.name);
        doc.colors.push({ name: c.name, hex: c.hex, fixed: ['Registration', 'Paper', 'Black'].includes(c.name) });
      }
    }
    const colorHex = (i, tint) => {
      const c = pm.colors[i];
      if (!c || c.name === 'None' || c.name === 'Paper' && tint == null) return c && c.name === 'Paper' ? '#ffffff' : '#000000';
      let hex = c.hex;
      if (tint != null && tint < 100 && tint >= 0) {
        const rgb = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
        hex = '#' + rgb.map((v) => Math.round(v * tint / 100 + 255 * (1 - tint / 100)).toString(16).padStart(2, '0')).join('');
      }
      return hex;
    };

    // position of a shape: which page, and page-relative coordinates in points
    function placeShape(sh, recIdx, isMaster) {
      const x0 = Math.min(sh.tl.x, sh.br.x), x1 = Math.max(sh.tl.x, sh.br.x);
      const y0 = Math.min(sh.tl.y, sh.br.y), y1 = Math.max(sh.tl.y, sh.br.y);
      let page, px;
      const cx = (x0 + x1) / 2;
      if (doubleSided) {
        const left = cx < 0;
        px = left ? x0 + S.pageW : x0;
        if (isMaster) page = left ? 'ML' : 'MR';
        else {
          let idx = left ? recIdx - 1 : recIdx;
          if (idx < 0) { idx = recIdx; px = x0 + S.pageW; }
          page = doc.pages[Math.min(idx, doc.pages.length - 1)].id;
        }
      } else {
        px = x0 + S.pageW / 2;
        page = isMaster ? 'MR' : doc.pages[Math.min(recIdx, doc.pages.length - 1)].id;
      }
      return { page, x: px * TW, y: (y0 + S.pageH / 2) * TW, w: (x1 - x0) * TW, h: (y1 - y0) * TW };
    }

    // ---------------- stories
    const storyMap = {};
    const sigCount = new Map();
    const builtParas = {};
    for (const [id, st] of Object.entries(pm.stories)) {
      const bytes = b64ToBytes(st.text);
      // character runs → decoded strings
      const runs = [];
      let off = 0;
      for (const c of st.chars) {
        const seg = bytes.subarray(off, off + c.len);
        off += c.len;
        const fname = pm.fonts[c.font] || 'Times New Roman';
        const enc = BV.Legacy.encodingForFont(fname);
        runs.push({ c, fname, enc, raw: cp1252.decode(seg) });
      }
      if (off < bytes.length) runs.push({ c: st.chars[st.chars.length - 1] || { size: 12, lead: 65535 }, fname: pm.fonts[(st.chars[st.chars.length - 1] || {}).font] || 'Times New Roman', enc: null, raw: cp1252.decode(bytes.subarray(off)) });
      // where each text block of the story begins in PageMaker: mark it, so the text is split there exactly
      const FB = '\uE00F';
      if (st.frames && st.frames.length > 1) {
        let acc = 0;
        const cuts = st.frames.slice(0, -1).map((f) => (acc += f.chars));
        let pos = 0, ci = 0;
        for (const r of runs) {
          const len = r.raw.length;
          let add = 0;
          let out = '';
          let last = 0;
          while (ci < cuts.length && cuts[ci] <= pos + len) {
            const at = cuts[ci] - pos;
            out += r.raw.slice(last, at) + FB;
            last = at;
            ci++;
            add++;
          }
          if (add) r.raw = out + r.raw.slice(last);
          pos += len;
        }
      }
      // keep Nudi syllables whole when formatting changes mid-syllable
      // per-font decisions from the Open dialog (convert or keep, which font, what size)
      const planOf = (r) => (opts.fontPlan && opts.fontPlan[r.fname]) || null;
      for (const r of runs) { const pl = planOf(r); r.convert = BV.Legacy.convertible(r.enc) && (pl ? pl.mode !== 'keep' : !opts.keepAscii); }
      for (let i = 1; i < runs.length; i++) {
        if (runs[i].convert && runs[i - 1].convert && runs[i].enc === runs[i - 1].enc) {
          if (runs[i].enc === 'praja') {
            // vowel signs, ottus and ticks that start this run belong to the last syllable of the one before
            let k = 0;
            while (k < runs[i].raw.length && BV.Legacy.prajaContinues(runs[i].raw[k])) k++;
            if (k) { runs[i - 1].raw += runs[i].raw.slice(0, k); runs[i].raw = runs[i].raw.slice(k); }
            continue;
          }
          if (BV.Legacy.isDev(runs[i].enc)) {
            // vowel signs, marks and the reph that start this run belong to the last syllable of the one before
            let k = 0;
            while (k < runs[i].raw.length && BV.DevLegacy.continues(runs[i].enc, runs[i].raw[k])) k++;
            if (k) { runs[i - 1].raw += runs[i].raw.slice(0, k); runs[i].raw = runs[i].raw.slice(k); }
            continue;
          }
          const m = runs[i].raw.match(NUDI_MARKS);
          if (m) { runs[i - 1].raw += m[0]; runs[i].raw = runs[i].raw.slice(m[0].length); }
        }
      }
      // build paragraphs
      const paras = [{ runs: [], lead: 0, size: 0 }];
      for (const r of runs) {
        let text = clean(r.raw);
        const convert = r.convert;
        const plan = planOf(r);
        const pj = BV.Legacy.unicodeFontFor(r.fname);
        if (convert) {
          text = text.split('\r').map((t) => BV.Legacy.toUnicode(t, r.enc)).join('\r');
          report.convertedChars += text.length;
          report.legacyFonts[r.fname] = BV.Legacy.label(r.enc);
        } else if (r.enc) report.legacyFonts[r.fname] = 'kept as ASCII in its own font';
        const c = r.c;
        let font = plan && plan.font ? plan.font : convert ? (pj ? pj.font : kfont) : fontMap[r.fname] || r.fname;
        if (!convert && opts.availableFonts && !opts.availableFonts.has(font) && !fontMap[r.fname]) report.missingFonts[r.fname] = true;
        const scale = plan && plan.scale ? plan.scale : convert ? (pj ? 1 : nudiScale) : 1;
        const size = Math.round(Math.max(4, (c.size || 12) * scale) * 10) / 10;
        const attrs = { font, size };
        // remember the original legacy font: used when saving back to PageMaker
        if (BV.Legacy.convertible(r.enc)) attrs.legacy = r.enc + (convert ? ':' : '-ascii:') + r.fname;
        if (c.bold || (convert && pj && pj.bold)) attrs.bold = true;
        if (c.italic || (convert && pj && pj.italic)) attrs.italic = true;
        if (c.underline) attrs.underline = true;
        if (c.strike) attrs.strike = true;
        if (c.caps) attrs.caps = true;
        if (c.outline) attrs.outline = true;
        if (c.shadow) attrs.shadow = true;
        if (c.smallCaps) attrs.smallCaps = true;
        if (c.sup) attrs.pos = 'sup';
        else if (c.sub) attrs.pos = 'sub';
        if (c.setWidth && c.setWidth !== 65535 && c.setWidth !== 1000 && c.setWidth >= 100 && c.setWidth <= 2500) attrs.width = c.setWidth / 10;
        if (c.baseShift && Math.abs(c.baseShift) < 3000) attrs.shift = c.baseShift / 10;
        if (c.color != null && c.color > 1) { const hx = colorHex(c.color, c.tint); if (hx !== '#000000') attrs.color = hx; }
        if (c.kern) attrs.track = c.kern / 1000;
        const lead = c.lead && c.lead !== 65535 ? c.lead / 10 : 0;
        const parts = text.split('\r');
        parts.forEach((t, k) => {
          if (k > 0) paras.push({ runs: [], lead: 0, size: 0 });
          const P = paras[paras.length - 1];
          P.runs.push(Object.assign({ t }, attrs));
          P.lead = Math.max(P.lead, lead);
          P.size = Math.max(P.size, attrs.size);
          if (!P.font && t.trim()) P.font = font;
        });
      }
      if (paras.length > 1 && !paras[paras.length - 1].runs.some((r) => r.t)) paras.pop();
      // paragraph formatting: PageMaker stores it as runs measured in characters
      const starts = [0];
      for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x0d) starts.push(i + 1);
      const runEnds = [];
      let acc = 0;
      for (const pr of st.paras) { acc += pr.len; runEnds.push(acc); }
      const paraRunAt = (o) => { for (let i = 0; i < runEnds.length; i++) if (o < runEnds[i]) return st.paras[i]; return st.paras[st.paras.length - 1] || {}; };
      paras.forEach((P, k) => {
        const pr = paraRunAt(starts[k] ?? 0) || {};
        P.ov = {
          align: ALIGN[pr.align] || 'left',
          leftIndent: (pr.left || 0) * TW,
          firstIndent: (pr.first || 0) * TW,
          rightIndent: (pr.right || 0) * TW,
          spaceBefore: (pr.before || 0) * TW,
          spaceAfter: (pr.after || 0) * TW,
          leading: P.lead || 'auto',
        };
        if (pr.keepNext) P.ov.keepNext = true;
        if (pr.hyphenate) P.ov.hyphenate = true;
        if (pr.wsMin > 0 && pr.wsMin < 100) P.ov.wordSpaceMin = pr.wsMin / 100;
        // tab stops (PageMaker keeps them as runs, like paragraph formatting)
        if (st.tabs && st.tabs.length) {
          let at = 0, tr = null;
          const o = starts[k] ?? 0;
          for (const t of st.tabs) { if (o < at + t.len) { tr = t; break; } at += t.len; }
          if (!window.__noTabs && tr && tr.stops.length) P.ov.tabs = tr.stops.map((t2) => ({ pos: Math.round(t2.pos * TW * 100) / 100, align: ['left', 'right', 'center', 'decimal'][t2.kind & 3] || 'left' }));
        }
        P.font = P.font || (P.runs[0] && P.runs[0].font) || kfont;
        const sig = [P.font, P.size, P.ov.leading, P.ov.align, n1(P.ov.firstIndent), n1(P.ov.leftIndent), n1(P.ov.spaceBefore), n1(P.ov.spaceAfter)].join('|');
        P.sig = sig;
        const chars = P.runs.reduce((a, r) => a + r.t.length, 0) + 1;
        sigCount.set(sig, (sigCount.get(sig) || 0) + chars);
      });
      // split paragraphs where a PageMaker text block ended, and start the rest in the next block
      if (st.frames && st.frames.length > 1) {
        const out = [];
        let fno = 0;
        let pending = false;
        for (const P of paras) {
          let cur = Object.assign({}, P, { runs: [], ov: Object.assign({}, P.ov) });
          if (pending) { cur.ov.frameStart = fno; pending = false; }
          for (const run of P.runs) {
            const bits = run.t.split(FB);
            bits.forEach((b, i) => {
              if (i > 0) {
                fno++;
                if (cur.runs.some((x) => x.t)) {
                  cur.ov.spaceAfter = 0;
                  cur.ov.justifyLast = true;
                  out.push(cur);
                  cur = Object.assign({}, P, { runs: [], ov: Object.assign({}, P.ov, { firstIndent: 0, spaceBefore: 0, frameStart: fno }) });
                  delete cur.ov.dropCap;
                } else cur.ov.frameStart = fno;
              }
              if (b) cur.runs.push(Object.assign({}, run, { t: b }));
            });
          }
          if (!cur.runs.length) cur.runs.push(Object.assign({}, P.runs[0] || {}, { t: '' }));
          out.push(cur);
        }
        paras.length = 0;
        paras.push(...out);
      }
      for (const P of paras) for (const run of P.runs) if (run.t.indexOf(FB) >= 0) run.t = run.t.split(FB).join('');
      builtParas[id] = paras;
    }
    // ---------------- styles from the most used paragraph formats
    const sigs = [...sigCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([s]) => s);
    const styles = {};
    const sigStyle = {};
    sigs.forEach((sig, i) => {
      const [font, size, lead, align, fi, li, sb, sa] = sig.split('|');
      const short = font.replace(/^Noto (Serif|Sans) /, '');
      let name = i === 0 ? 'Body text' : `${short} ${+size}/${lead === 'auto' ? 'auto' : +lead} ${align}`;
      while (styles[name]) name += '+';
      styles[name] = { font, size: +size, leading: lead === 'auto' ? 'auto' : +lead, align, firstIndent: +fi, leftIndent: +li, rightIndent: 0, spaceBefore: +sb, spaceAfter: +sa, color: '#000000', bold: false, italic: false, next: '', breakBefore: false };
      sigStyle[sig] = name;
    });
    // keep the app's Sanskrit styles available too
    const defaults = BV.defaultStyles();
    for (const k of ['Shloka', 'Shloka (Kannada)', 'IAST', 'Translation', 'Chapter title', 'Heading 2', 'Footnote', 'Running head']) if (!styles[k]) styles[k] = defaults[k];
    doc.styles = styles;
    for (const [id, paras] of Object.entries(builtParas)) {
      const story = BV.newStory(doc, 'Body text');
      story.paras = paras.map((P) => {
        const style = sigStyle[P.sig] || 'Body text';
        const st = styles[style];
        const ov = {};
        for (const k of Object.keys(P.ov)) if (String(P.ov[k]) !== String(st[k])) ov[k] = P.ov[k];
        const runs = P.runs.map((r) => {
          const o = { ...r };
          if (o.font === st.font) delete o.font;
          if (o.size === st.size) delete o.size;
          return o;
        });
        const para = { style, runs: runs.length ? runs : [{ t: '' }] };
        if (Object.keys(ov).length) para.ov = ov;
        BV.Text.normalize(para);
        return para;
      });
      storyMap[id] = story;
      report.stories++;
    }

    // ---------------- shapes
    function addShape(sh, recIdx, isMaster) {
      const g = placeShape(sh, recIdx, isMaster);
      const rot = sh.xform && sh.xform.rot ? -sh.xform.rot : 0;
      const stroke = sh.stroke ? { stroke: sh.stroke.width > 0 ? colorHex(sh.stroke.color, sh.stroke.tint) : 'none', strokeWidth: sh.stroke.width || 0, strokeStyle: sh.stroke.type === 5 ? 'dash' : sh.stroke.type >= 6 ? 'dot' : 'solid' } : {};
      if (sh.kind === 'text') {
        const story = storyMap[sh.story];
        if (!story) return;
        const it = BV.newItem(doc, 'text', g.page, g.x, g.y, Math.max(6, g.w), Math.max(6, g.h), { storyId: story.id, stroke: 'none', strokeWidth: 0, rot });
        it._pmFrame = sh.frameId;
        story.frames.push(it.id);
        report.frames++;
        return;
      }
      if (sh.kind === 'line') {
        let x1 = sh.tl.x, y1 = sh.tl.y, x2 = sh.br.x, y2 = sh.br.y;
        if (sh.mirrored) [y1, y2] = [y2, y1];
        const it = BV.newItem(doc, 'line', g.page, g.x, 0, 0, 0, stroke);
        const dx = g.x - Math.min(x1, x2) * TW;
        it.x = x1 * TW + dx; it.y = (y1 + S.pageH / 2) * TW; it.w = (x2 - x1) * TW; it.h = (y2 - y1) * TW;
        report.shapes++;
        return;
      }
      if (sh.kind === 'rect' || sh.kind === 'ellipse' || sh.kind === 'polygon') {
        const fill = sh.fill.type === 2 ? colorHex(sh.fill.color) : sh.fill.type === 1 ? '#ffffff' : 'none';
        const extra = Object.assign({ fill, rot }, stroke);
        const it = BV.newItem(doc, sh.kind, g.page, g.x, g.y, g.w, g.h, extra);
        if (sh.kind === 'polygon') {
          const xs = sh.points.map((p) => p.x), ys = sh.points.map((p) => p.y);
          const mx = Math.min(...xs), my = Math.min(...ys), w = Math.max(...xs) - mx || 1, h = Math.max(...ys) - my || 1;
          it.pts = sh.points.map((p) => [(p.x - mx) / w, (p.y - my) / h]);
          if (!sh.closed) it.open = true;
        }
        report.shapes++;
        return;
      }
      if (sh.kind === 'bitmap' || sh.kind === 'metafile') {
        const it = BV.newItem(doc, 'image', g.page, g.x, g.y, g.w, g.h, { src: sh.src || null, name: sh.src ? 'image' : `${sh.format || 'graphic'} (not shown)`, stroke: 'none', strokeWidth: 0, rot });
        // PageMaker crops by keeping the whole graphic and recording which part shows: place it the same way
        const c = sh.crop, f = sh.full;
        if (c && f) {
          const fw = f.br.x - f.tl.x, fh = f.br.y - f.tl.y, cw = c.br.x - c.tl.x, ch = c.br.y - c.tl.y;
          const cropped = cw > 0 && ch > 0 && fw > 0 && fh > 0 && (c.tl.x > f.tl.x || c.tl.y > f.tl.y || c.br.x < f.br.x || c.br.y < f.br.y);
          if (cropped && c.tl.x >= f.tl.x && c.tl.y >= f.tl.y && c.br.x <= f.br.x && c.br.y <= f.br.y) {
            const sx = g.w / cw, sy = g.h / ch;
            it.cx = -(c.tl.x - f.tl.x) * sx; it.cy = -(c.tl.y - f.tl.y) * sy;
            it.cw = fw * sx; it.ch = fh * sy;
            report.cropped = (report.cropped || 0) + 1;
          }
        }
        if (sh.src) report.images++; else report.imagesMissing++;
      }
    }
    pm.spreads.forEach((sp, i) => sp.shapes.forEach((sh) => addShape(sh, i, false)));
    (pm.masters || []).forEach((m) => m.shapes.forEach((sh) => addShape(sh, 0, true)));
    // PageMaker lets a line hang below a text block that is shorter than one line (running heads): give such blocks one line
    for (const st of Object.values(doc.stories)) {
      if (st.frames.length !== 1 || !st.paras.length) continue;
      const it = doc.items[st.frames[0]];
      const pp = BV.paraProps(doc, st.paras[0]);
      const sz = Math.max(pp.size || 12, ...st.paras[0].runs.map((r) => r.size || 0));
      const lead = pp.leading && pp.leading !== 'auto' ? Math.max(pp.leading, sz * 1.05) : sz * 1.25;
      const need = lead * Math.min(st.paras.length, 3) + 2;
      if (it && it.h < need && it.h < 40) it.h = need;
    }
    // thread order as PageMaker records it
    const threadOrder = {};
    for (const [sid, pst] of Object.entries(pm.stories)) if (pst.frames && pst.frames.length && storyMap[sid]) threadOrder[storyMap[sid].id] = pst.frames.map((f) => f.id);
    for (const st of Object.values(doc.stories)) {
      const ord = threadOrder[st.id];
      if (!ord || st.frames.length < 2) continue;
      const at = (fid) => { const k = ord.indexOf(doc.items[fid]._pmFrame); return k < 0 ? 1e6 : k; };
      st.frames.sort((a, b) => at(a) - at(b));
      st._pmOrdered = st.frames.every((f) => at(f) < 1e6);
    }
    for (const it of Object.values(doc.items)) delete it._pmFrame;
    // PageMaker 5 lists a spread's text blocks in any order: thread them in reading order (page, then column, then top)
    if (pm.format === 'pagemaker5') {
      const pidx = new Map(doc.pages.map((p, i) => [p.id, i]));
      for (const st of Object.values(doc.stories)) {
        if (st.frames.length < 2 || st._pmOrdered) continue;
        st.frames.sort((a, b) => {
          const A = doc.items[a], B = doc.items[b];
          return (pidx.get(A.page) ?? -1) - (pidx.get(B.page) ?? -1) || (Math.abs(A.x - B.x) > 20 ? A.x - B.x : 0) || A.y - B.y;
        });
      }
    }
    // z order = file order
    let z = 1;
    for (const it of Object.values(doc.items)) it.z = z++;
    for (const st of Object.values(doc.stories)) delete st._pmOrdered;
    // Pictures that sit on text: PageMaker breaks the text round them (text wrap), so do the same.
    // A picture that covers nearly all of a text block is a background and is left behind the text.
    if (opts.wrapPictures !== false) {
      const all = Object.values(doc.items);
      for (const im of all) {
        if (im.type !== 'image') continue;
        const ia = Math.abs(im.w * im.h);
        if (!ia) continue;
        for (const tf of all) {
          if (tf.type !== 'text' || tf.page !== im.page) continue;
          const ox = Math.min(im.x + im.w, tf.x + tf.w) - Math.max(im.x, tf.x), oy = Math.min(im.y + im.h, tf.y + tf.h) - Math.max(im.y, tf.y);
          if (ox <= 2 || oy <= 2) continue;
          const over = ox * oy;
          if (over / Math.abs(tf.w * tf.h) > 0.85) continue;
          if (over / ia < 0.25) continue;
          im.wrap = { type: 'rect', standoff: 4 };
          report.wrapped = (report.wrapped || 0) + 1;
          break;
        }
      }
    }
    // stories without frames would be lost: drop them
    for (const st of Object.values(doc.stories)) if (!st.frames.length) delete doc.stories[st.id];

    // ---------------- margins & columns from where text sits on the pages
    const tf = Object.values(doc.items).filter((it) => it.type === 'text' && !String(it.page).startsWith('M') && it.h > 100);
    if (tf.length) {
      const mode = (arr) => { const c = new Map(); for (const v of arr) { const k = Math.round(v); c.set(k, (c.get(k) || 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
      const sideOf = (it) => BV.pageSide(doc, doc.pages.findIndex((p) => p.id === it.page));
      const right = tf.filter((it) => sideOf(it) === 'R');
      const set = right.length ? right : tf;
      const top = mode(set.map((it) => it.y));
      const bottom = mode(set.map((it) => pageH - it.y - it.h));
      const inside = mode(set.map((it) => it.x));
      const outside = mode(set.map((it) => pageW - it.x - it.w));
      if (top > 0 && bottom > 0 && inside > 0 && outside > 0) doc.setup.margins = { top, bottom, inside, outside };
    }
    const scales = {};
    for (const [f, pl] of Object.entries(opts.fontPlan || {})) if (pl.mode === 'convert' || pl.mode === 'praja') scales[f] = pl.scale || 1;
    doc.pmImport = { nudiScale, scales, keepAscii: !!opts.keepAscii };
    return { doc, report };
  }
  const n1 = (v) => Math.round(v * 10) / 10;

  BV.PMImport = { toDoc };
})();
