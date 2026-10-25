/* BV Mudrana: saving to PageMaker 7 (.pmd / .pm7 / .p65 / .pmt).

   PageMaker's file format is private, so BV Mudrana does not write it byte by byte. Instead it writes what
   PageMaker itself understands, a PageMaker script plus PageMaker Tagged Text files and graphics, and lets
   PageMaker 7 build and save the publication. On Windows with PageMaker 7 installed this runs automatically
   (pmsave.js drives PageMaker over DDE); otherwise a "PageMaker kit" folder is written with the script.

   Unicode Kannada is converted to Nudi ASCII with the Brahmavidya converter, because PageMaker 7 cannot
   shape Unicode Kannada. Lengths in the script are in inches (PageMaker's script units). */
(function () {
  const G = typeof window !== 'undefined' ? window : global;
  const BV = (G.BV = G.BV || {});

  // ---------------------------------------------------------------- Windows-1252 encoding (what PageMaker reads)
  const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
  function encode1252(str, bad) {
    const out = [];
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (c < 0x100) out.push(c);
      else if (CP1252[c] !== undefined) out.push(CP1252[c]);
      else if (c === 0x2028) out.push(0x0d);
      else { out.push(0x3f); if (bad) bad.push(ch); }
    }
    return out;
  }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
      s += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : B64[c & 63]);
    }
    return s;
  }

  const KN = /[ಀ-೿]/;
  const KN_SEG = /([ಀ-೿\u200C\u200D]+(?:[  ]+[ಀ-೿\u200C\u200D]+)*)/;
  const isUnicodeKannadaFont = (f) => /kannada|tunga|kedage|mallige|sampige|nirmala|baraha\s*uni|akshar\s*unicode|lohit|gubbi|navilu|jogi|vijaya/i.test(f || '');
  const r2 = (v) => Math.round(v * 100) / 100;
  const I = (pt) => (Math.round((pt / 72) * 10000) / 10000) + 'i';
  const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
  // PageMaker 7 names (styles, colours, masters, layers) must be in its Windows character set
  const latin = (s) => !/[^\x20-\x7E\u00A0-\u00FF]/.test(s);
  const nameMap = new Map();
  const safe = (kind, s) => {
    const key = kind + '\u0001' + s;
    if (nameMap.has(key)) return nameMap.get(key);
    let n = String(s).replace(/[@=\-<>|"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
    if (!n || !latin(n)) n = `${kind} ${[...nameMap.keys()].filter((k) => k.startsWith(kind + '\u0001')).length + 1}`;
    nameMap.set(key, n);
    return n;
  };
  const styleName = (s) => safe('Style', s);
  // fonts that only exist inside BV Mudrana get a Windows font with the same look
  const winFont = (f) => (/^Noto Serif/i.test(f) ? 'Times New Roman' : /^Noto Sans/i.test(f) ? 'Arial' : f);

  // ---------------------------------------------------------------- colours
  function colorTable(doc) {
    const byHex = {};
    for (const c of doc.colors) { const h = c.hex.toLowerCase(); if (!byHex[h] || c.name === 'Black' || c.name === 'Paper') byHex[h] = c.fixed ? c.name : safe('Color', c.name); }
    byHex['#000000'] = 'Black'; byHex['#ffffff'] = 'Paper';
    const extra = {};
    const name = (hex) => {
      if (!hex || hex === 'none') return null;
      const h = hex.toLowerCase();
      if (byHex[h]) return byHex[h];
      const n = 'BV ' + h.slice(1);
      byHex[h] = n; extra[n] = h;
      return n;
    };
    return { name, extra, byHex };
  }
  const cmyk = (hex) => {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    const k = 1 - Math.max(r, g, b);
    const f = (v) => (k >= 1 ? 0 : Math.round(((1 - v - k) / (1 - k)) * 100));
    return [f(r), f(g), f(b), Math.round(k * 100)];
  };

  // ---------------------------------------------------------------- tagged text
  function makeTagger(doc, opts, colors, warnings) {
    const nudiFont = opts.nudiFont || 'Nudi 01 e';
    const nudiScale = (doc.pmImport && doc.pmImport.nudiScale) || 1;
    const prajaDefault = BV.Legacy.isPrajaFont(nudiFont); // the user picked a Praja font for new Kannada text
    const lost = [];
    const LEG = BV.Legacy.LEGACY_TAG;
    const legacyFont = (run) => (run.legacy && LEG.test(run.legacy) ? run.legacy.replace(LEG, '') : null);
    const isPrajaRun = (run) => !!(run.legacy && /^praja:/.test(run.legacy));
    const esc = (s) => s.replace(/[\\<>@]/g, (c) => (c === '\\' ? '<\\#92>' : '\\' + c));
    // text with PageMaker's special-character tags; Kannada converted to Nudi ASCII
    function textOut(t) {
      let o = '';
      for (const part of t.split(/([\uE000\u2028\u00AD\uE001\uE002])/)) {
        if (part === '\uE000') o += '<\\d>';
        else if (part === '\u2028') o += '<r>';
        else if (part === '\u00AD') o += '<d>';
        else if (part === '\uE001' || part === '\uE002') continue;
        else o += esc(part);
      }
      return o;
    }
    function styleDef(name, s) {
      const kn = opts.nudi !== false && isUnicodeKannadaFont(s.font);
      const f = kn ? nudiFont : winFont(s.font);
      const a = ['p', `f"${f}"`, `s${r2(s.size)}`];
      if (s.leading && s.leading !== 'auto') a.push(`cl${r2(s.leading)}`);
      a.push(`ga${{ left: 0, right: 1, center: 2, justify: 3, force: 4 }[s.align] ?? 0}`);
      a.push(`gl${r2(s.leftIndent || 0)}`, `gf${r2(s.firstIndent || 0)}`, `gr${r2(s.rightIndent || 0)}`, `g+b${r2(s.spaceBefore || 0)}`, `g+a${r2(s.spaceAfter || 0)}`);
      if (s.bold) a.push('b');
      if (s.italic) a.push('i');
      if (s.color && s.color !== '#000000') a.push(`cc"${colors.name(s.color)}"`);
      if (s.keepTogether) a.push('gkt');
      const kw = s.keepWith ?? (s.keepNext ? 2 : 0);
      if (kw) a.push(`gkn${kw}`);
      if (s.widow) a.push(`gkw${s.widow}`);
      if (s.orphan) a.push(`gko${s.orphan}`);
      if (s.pageBreak) a.push('g+p'); else if (s.breakBefore) a.push('g+c');
      if (s.toc) a.push('gc');
      if (s.tabs && s.tabs.length) a.push('gtabs' + s.tabs.map((t) => ` (${r2(t.pos)} ${{ left: 0, right: 1, center: 2 }[t.align] ?? 0} "")`).join(''));
      return `<@${styleName(name)}=${a.join('|')}>`;
    }
    function paraOverrides(ov) {
      if (!ov) return '';
      let o = '';
      if (ov.align) o += `<ga${{ left: 0, right: 1, center: 2, justify: 3, force: 4 }[ov.align] ?? 0}>`;
      if (ov.leftIndent !== undefined) o += `<gl${r2(ov.leftIndent)}>`;
      if (ov.firstIndent !== undefined) o += `<gf${r2(ov.firstIndent)}>`;
      if (ov.rightIndent !== undefined) o += `<gr${r2(ov.rightIndent)}>`;
      if (ov.spaceBefore !== undefined) o += `<g+b${r2(ov.spaceBefore)}>`;
      if (ov.spaceAfter !== undefined) o += `<g+a${r2(ov.spaceAfter)}>`;
      if (ov.keepTogether) o += '<gkt>';
      if (ov.keepWith) o += `<gkn${ov.keepWith}>`;
      if (ov.widow) o += `<gkw${ov.widow}>`;
      if (ov.orphan) o += `<gko${ov.orphan}>`;
      if (ov.pageBreak) o += '<g+p>'; else if (ov.breakBefore) o += '<g+c>';
      if (ov.toc) o += '<gc>';
      if (ov.tabs && ov.tabs.length) o += '<gtabs' + ov.tabs.map((t) => ` (${r2(t.pos)} ${{ left: 0, right: 1, center: 2 }[t.align] ?? 0} "")`).join('') + '>';
      for (const [k, tag] of [['ruleAbove', 'gbabove'], ['ruleBelow', 'gbbelow']]) {
        const R = ov[k];
        if (R) o += `<${tag} ${R.extent === 'text' ? 'Text' : 'Col'} F ${r2(-(R.indL || 0))} ${r2(-(R.indR || 0))} ${r2(R.offset || 0)} "${colors.name(R.color || '#000000')}" (0 ${r2(R.w || 1)} ${{ solid: 1, dash: 2, dot: 3 }[R.style] || 1})>`;
      }
      return o;
    }
    function runOut(doc, pp, run, text, kannada) {
      const cp = BV.charProps(pp, Object.assign({}, run, { pos: null }));
      let font = winFont(cp.font), size = cp.size;
      if (kannada) {
        font = legacyFont(run) || nudiFont;
        if (run.legacy && /^(nudi|praja):/.test(run.legacy)) { const sc = doc.pmImport && doc.pmImport.scales && doc.pmImport.scales[legacyFont(run)]; size = size / (sc || (isPrajaRun(run) ? 1 : nudiScale)); }
      } else if (run.legacy && /-ascii:/.test(run.legacy)) font = cp.font;
      let o = `<f"${font}"><s${r2(size)}><p>`;
      if (cp.bold) o += '<b>';
      if (cp.italic) o += '<i>';
      if (cp.underline) o += '<u>';
      if (cp.strike) o += '<x>';
      if (cp.outline) o += '<o>';
      if (cp.shadow) o += '<~>';
      if (cp.caps) o += '<ca>';
      if (cp.smallCaps) o += '<cs>';
      if (run.pos === 'sup') o += '<+>';
      if (run.pos === 'sub') o += '<->';
      o += `<cc"${run.reverse ? 'Paper' : colors.name(run.color || pp.color || '#000000') || 'Black'}">`;
      o += `<h${r2(cp.width || 100)}>`;
      o += `<cb${r2(run.shift || 0)}>`;
      if (run.track) o += `<l${Math.round(run.track * 1000) / 1000}>`;
      else o += '<l0>';
      return o + textOut(text);
    }
    function storyText(story) {
      const used = new Set(story.paras.map((p) => p.style));
      let out = '<PMTags1.0 Win>\r\n';
      for (const n of used) if (doc.styles[n]) out += styleDef(n, doc.styles[n]) + '\r\n';
      const paras = story.paras.map((para) => {
        const pp = BV.paraProps(doc, para);
        let o = `<@${styleName(doc.styles[para.style] ? para.style : Object.keys(doc.styles)[0])}:>` + paraOverrides(para.ov);
        if (pp.leading && pp.leading !== 'auto' && para.ov && para.ov.leading !== undefined) o += `<cl${r2(pp.leading)}>`;
        for (const run of para.runs) {
          if (!run.t) continue;
          const isAsciiNudi = run.legacy && /^[a-z]+-ascii:/.test(run.legacy);
          // Devanagari and IAST that came from Chanakya, Walkman-Chanakya or Nalanda go back to the same font
          const dev = run.legacy && /^(chanakya|chanakyamath|walkman|nalanda):/.exec(run.legacy);
          if (dev && opts.nudi !== false) { o += runOut(doc, pp, run, BV.Legacy.fromUnicode(run.t, dev[1]).replace(/[\u200B-\u200D]/g, ''), true); continue; }
          // text that came from a Praja font goes back to Praja; everything else Kannada goes to Nudi
          const toLegacy = isPrajaRun(run) || (!legacyFont(run) && prajaDefault) ? (t) => BV.Legacy.unicodeToPraja(t) : (t) => BV.Legacy.unicodeToNudi(t);
          if (opts.nudi === false || isAsciiNudi || !KN.test(run.t)) { o += runOut(doc, pp, run, run.t, false); continue; }
          for (const seg of run.t.split(KN_SEG)) {
            if (!seg) continue;
            if (KN.test(seg)) o += runOut(doc, pp, run, toLegacy(seg).replace(/[\u200B-\u200D]/g, ''), true);
            else o += runOut(doc, pp, run, seg, false);
          }
        }
        return o;
      });
      out += paras.join('\r\n');
      const bytes = encode1252(out, lost);
      return bytes;
    }
    return { storyText, styleDef, lost };
  }

  function taggedText(doc, stories, opts = {}) {
    const warnings = [];
    const colors = colorTable(doc);
    const tg = makeTagger(doc, opts, colors, warnings);
    let bytes = [];
    stories.forEach((st, i) => { const b = tg.storyText(st); bytes = bytes.concat(i ? b.slice(b.indexOf(0x0a) + 1) : b); if (i < stories.length - 1) bytes.push(0x0d, 0x0a); });
    if (tg.lost.length) warnings.push(`${tg.lost.length} character(s) cannot be written in PageMaker's character set and became “?” (${[...new Set(tg.lost)].slice(0, 12).join(' ')})`);
    return { base64: b64(bytes), warnings };
  }

  // ---------------------------------------------------------------- the publication script
  /**
   * opts: { kind: 'pmd'|'p65'|'pmt', nudiFont, images: {itemId: {name, base64}} (PNG/JPEG data prepared by the caller) }
   * returns { steps: [{c, q?, v?, i?, try?}], spt, files: [{name, base64}], warnings }
   * Paths use %DIR% for the job folder and %OUT% for the file PageMaker saves; pmsave.js fills them in.
   */
  function build(doc, opts = {}) {
    const S = doc.setup;
    const W = S.w;
    const facing = !!(S.doubleSided && S.facing);
    const warnings = [];
    const colors = colorTable(doc);
    const tg = makeTagger(doc, opts, colors, warnings);
    const steps = [];
    const cmd = (c) => steps.push({ c });
    const tryc = (c) => steps.push({ c, try: true });
    const query = (c, v, i) => steps.push({ c, q: true, v, i });
    const files = [];
    const layerName = (id) => safe('Layer', ((doc.layers || []).find((l) => l.id === id) || {}).name || 'Default');
    const sideOfRef = (ref) => {
      if (BV.isMasterRef(ref)) return String(ref).slice(-1);
      const i = doc.pages.findIndex((p) => p.id === ref);
      return BV.pageSide(doc, i);
    };
    // PageMaker's zero point: where facing pages meet (top), else the page's top-left corner
    const X = (side, x) => (facing ? (side === 'R' ? x : x - W) : x);

    // pre-pass: every colour used, so custom ones can be defined first
    for (const it of Object.values(doc.items)) { colors.name(it.stroke); colors.name(it.fill); }
    for (const st of Object.values(doc.stories)) for (const p of st.paras) for (const r of p.runs) if (r.color) colors.name(r.color);
    for (const s of Object.values(doc.styles)) colors.name(s.color);

    cmd('-- BV Mudrana -> PageMaker 7');
    cmd(`new ${doc.pages.length}`);
    cmd('measureunits inches, inches, dontcare');
    cmd(`pageoptions ${S.doubleSided ? 1 : 0}, ${facing ? 1 : 0}`);
    cmd(`pagesize ${I(S.w)}, ${I(S.h)}, 0`);
    cmd(`pagemargins ${I(S.margins.inside)}, ${I(S.margins.top)}, ${I(S.margins.outside)}, ${I(S.margins.bottom)}, 0`);
    if (S.startPage !== 1) tryc(`pagenumbers ${S.startPage}, dontcare, 0, ${{ upperroman: 1, ROMAN: 1, lowerroman: 2, roman: 2, upperalpha: 3, loweralpha: 4 }[S.numbering] || 0}, ""`);
    for (const c of doc.colors) {
      if (c.fixed) continue;
      const [cc, m, y, k] = cmyk(c.hex);
      tryc(`definecolor ${q(safe('Color', c.name))}, process, cmyk, 0, ${cc}, ${m}, ${y}, ${k}`);
    }
    for (const [n, h] of Object.entries(colors.extra)) { const [cc, m, y, k] = cmyk(h); tryc(`definecolor ${q(n)}, process, cmyk, 0, ${cc}, ${m}, ${y}, ${k}`); }
    (doc.layers || []).forEach((l, i) => { if (i > 0) tryc(`newlayer ${q(layerName(l.id))}, ${l.visible === false ? 0 : 1}, 0, ${i % 8}, 0, 0, 0`); });
    // named master pages
    const masters = doc.masters || [];
    const mName = (m) => safe('Master', m.name);
    for (const m of masters) tryc(`definemasterpage ${q(mName(m))}, 1, ${facing ? 1 : 0}, ${I(S.margins.inside)}, ${I(S.margins.top)}, ${I(S.margins.outside)}, ${I(S.margins.bottom)}, ${m.columns || S.columns}, ${I(m.gutter ?? S.gutter)}`);

    // ---- objects
    let fid = 0;
    const storyFrames = {}; // storyId -> [{v, pageCmd}]
    const lineStyle = (it) => {
      const w = it.strokeWidth || 0;
      if (!it.stroke || it.stroke === 'none' || w <= 0) return [0, -2];
      const st = { dash: 14, dot: 17, double: 9, thickthin: 10, thinthick: 11, triple: 12 }[it.strokeStyle];
      return st ? [st, -2] : [31, r2(w)];
    };
    const fillLine = (it) => {
      const [ls, w] = lineStyle(it);
      const hasFill = it.fill && it.fill !== 'none' && it.type !== 'line';
      const fc = hasFill ? colors.name(it.fill) : null;
      const fs = !hasFill ? 0 : fc === 'Paper' ? 1 : 2;
      const lc = ls ? colors.name(it.stroke) : null;
      tryc(`fillandline ${fs}, ${q(fc || 'dontcare')}, 0, ${ls}, 0, ${w}, 0, ${q(lc || 'dontcare')}, 0, ${hasFill ? Math.round(it.fillTint || 100) : 100}, 100`);
    };
    const after = (it, side) => {
      if (it.rot) tryc(`rotate center, ${r2(-it.rot)}`);
      if (it.wrap && it.wrap.type === 'rect') { const so = I(it.wrap.standoff ?? 6); tryc(`textwrap rect, allsides, ${so}, ${so}, ${so}, ${so}, 0`); }
      if (it.nonPrint) tryc('nonprinting 1');
      if (it.locked) tryc('lock 1');
    };
    let curLayer = null;
    const setLayer = (it) => { const n = layerName(it.layer || 'L1'); if (n !== curLayer) { if ((doc.layers || []).length > 1) tryc(`targetlayer ${q(n)}`); curLayer = n; } };
    let imgN = 0;
    function emitItem(it, pageCmd) {
      const side = sideOfRef(it.page);
      const b = BV.Render.box(it);
      const L = I(X(side, b.x)), T = I(b.y), R = I(X(side, b.x + b.w)), Bm = I(b.y + b.h);
      setLayer(it);
      switch (it.type) {
        case 'rect':
          cmd(`box ${L}, ${T}, ${R}, ${Bm}`);
          if (it.radius) tryc(`roundedcorners ${Math.min(5, Math.max(1, Math.round(it.radius / 4)))}`);
          fillLine(it); after(it, side); break;
        case 'ellipse': cmd(`oval ${L}, ${T}, ${R}, ${Bm}`); fillLine(it); after(it, side); break;
        case 'line': cmd(`line ${I(X(side, it.x))}, ${I(it.y)}, ${I(X(side, it.x + it.w))}, ${I(it.y + it.h)}`); fillLine(it); after(it, side); break;
        case 'polygon': {
          const pts = (it.pts || []).map(([u, v]) => `${I(X(side, it.x + u * it.w))}, ${I(it.y + v * it.h)}`);
          if (pts.length < 2) break;
          cmd(`createpolygon ${pts.length}, ${pts.join(', ')}`);
          if (!it.open) tryc('polygontype 2');
          fillLine(it); after(it, side); break;
        }
        case 'image': case 'frame': {
          if (it.type === 'frame' && !it.src) {
            if (it.shape === 'ellipse') cmd(`oval ${L}, ${T}, ${R}, ${Bm}`); else cmd(`box ${L}, ${T}, ${R}, ${Bm}`);
            tryc('toggleframe'); fillLine(it); after(it, side); break;
          }
          const img = opts.images && opts.images[it.id];
          if (!img) { warnings.push(`A graphic (${it.name || it.id}) could not be prepared and was left out.`); break; }
          const fn = `g${String(++imgN).padStart(3, '0')}.${img.ext}`;
          files.push({ name: fn, base64: img.base64 });
          const cx = it.cx ?? 0, cy = it.cy ?? 0, cw = it.cw ?? b.w, ch = it.ch ?? b.h;
          cmd(`import "%DIR%\\${fn}", independent`);
          cmd(`place ${I(X(side, b.x + cx))}, ${I(b.y + cy)}`);
          tryc(`resize lefttop, ${I(X(side, b.x + cx))}, ${I(b.y + cy)}`);
          tryc(`resize rightbottom, ${I(X(side, b.x + cx + cw))}, ${I(b.y + cy + ch)}`);
          if (cx < -0.5 || cy < -0.5) tryc(`crop lefttop, ${L}, ${T}`);
          if (cx + cw > b.w + 0.5 || cy + ch > b.h + 0.5) tryc(`crop rightbottom, ${R}, ${Bm}`);
          if (it.flipX) tryc('reflect center, horizontal');
          if (it.flipY) tryc('reflect center, vertical');
          if (it.strokeWidth > 0 && it.stroke && it.stroke !== 'none') fillLine(Object.assign({}, it, { fill: 'none' }));
          after(it, side);
          break;
        }
        case 'text': {
          if (!doc.stories[it.storyId]) break;
          // a filled or stroked text block gets a box behind it (PageMaker text blocks have no fill or stroke)
          if ((it.fill && it.fill !== 'none') || (it.strokeWidth > 0 && it.stroke && it.stroke !== 'none')) { cmd(`box ${L}, ${T}, ${R}, ${Bm}`); fillLine(it); }
          // the text itself is placed later as PageMaker text blocks of exactly this size, threaded in story order
          (storyFrames[it.storyId] = storyFrames[it.storyId] || []).push({ pageCmd, order: doc.stories[it.storyId].frames.indexOf(it.id), rect: `${L}, ${T}, ${R}, ${Bm}`, it, side });
          break;
        }
      }
    }
    const emitRef = (ref, pageCmd) => { for (const it of BV.itemsOnPage(doc, ref, true)) emitItem(it, pageCmd); };
    // Document Master
    if (facing) { cmd('page lm'); tryc('zeropointreset'); emitRef('ML', 'page lm'); cmd('page rm'); tryc('zeropointreset'); emitRef('MR', 'page rm'); }
    else { cmd('page rm'); tryc('zeropointreset'); emitRef('MR', 'page rm'); }
    for (const m of masters) {
      const nm = q(mName(m));
      for (const side of facing ? ['L', 'R'] : ['R']) {
        const pc = `page ${side === 'L' ? 'lm' : 'rm'}, ${nm}`;
        if (!BV.itemsOnPage(doc, BV.masterRef(m.id, side), true).length) continue;
        tryc(pc); tryc('zeropointreset'); emitRef(BV.masterRef(m.id, side), pc);
      }
    }
    // which master each page uses (runs of pages)
    const mname = (pg) => { const id = BV.pageMasterId(doc, pg); return id === null ? '[None]' : id && BV.masterById(doc, id) ? mName(BV.masterById(doc, id)) : 'Document Master'; };
    for (let i = 0; i < doc.pages.length;) {
      const n = mname(doc.pages[i]);
      let j = i;
      while (j + 1 < doc.pages.length && mname(doc.pages[j + 1]) === n) j++;
      if (n !== 'Document Master') tryc(`masterpage ${q(n)}, ${q(n)}, "${S.startPage + i}-${S.startPage + j}"`);
      i = j + 1;
    }
    doc.pages.forEach((pg, i) => {
      const pc = `page ${S.startPage + i}`;
      cmd(pc); tryc('zeropointreset');
      emitRef(pg.id, pc);
    });
    // ---- text: thread the frames, then flow the tagged text in
    let sn = 0;
    for (const [sid, fr] of Object.entries(storyFrames)) {
      const st = doc.stories[sid];
      const text = st.paras.map((p) => p.runs.map((r) => r.t).join('')).join('');
      if (!text.trim()) continue;
      fr.sort((a, b) => a.order - b.order);
      const fn = `s${String(++sn).padStart(3, '0')}.txt`;
      files.push({ name: fn, base64: b64(tg.storyText(st)) });
      // Import loads the text icon; PlaceSized drag-places it; PlaceNext + PlaceSized threads the next block
      // (only commands, no queries, so the same steps run from the Scripts palette and over DDE)
      tryc('deselect');
      cmd(fr[0].pageCmd);
      steps.push({ c: `import "%DIR%\\${fn}", newstory, 1, 0, 1, 0, 1, "Tagged Text", ""`, alt: [`import "%DIR%\\${fn}", newstory, 1, 0, 1`, `import "%DIR%\\${fn}", newstory`] });
      cmd(`placesized ${fr[0].rect}`);
      if (fr[0].it.rot) tryc(`rotate center, ${r2(-fr[0].it.rot)}`);
      for (let k = 1; k < fr.length; k++) {
        tryc('placenext bottom');
        if (fr[k].pageCmd !== fr[k - 1].pageCmd) cmd(fr[k].pageCmd);
        tryc(`placesized ${fr[k].rect}`);
      }
      tryc('deselect');
    }
    if (tg.lost.length) warnings.push(`${tg.lost.length} character(s) (usually Devanagari or IAST) cannot be written in PageMaker 7's character set and became “?”: ${[...new Set(tg.lost)].slice(0, 16).join(' ')}`);
    cmd('page 1'.replace('1', String(S.startPage)));
    const kindArg = opts.kind === 'p65' ? ', 2' : opts.kind === 'pmt' ? ', template' : ', publication';
    steps.push({ c: `saveas "%OUT%"${kindArg}`, save: true });
    return { steps, spt: toSpt(steps), files, warnings };
  }

  // the same steps as a script for PageMaker's Scripts palette (queries go into variables)
  function toSpt(steps) {
    const L = ['-- Made by BV Mudrana. Run it from PageMaker 7: Window > Plug-in Palettes > Show Scripts.', '-- It builds the publication and saves it.', ''];
    for (const s of steps) {
      const c = s.c.replace(/%(f\d+)%/g, '$1');
      if (c.startsWith('--')) { L.push(c); continue; }
      if (s.q) { L.push(`${c} >> ${Array.from({ length: s.i }, () => '...').join(',')}${s.i ? ',' : ''}${s.v},...`); continue; }
      if (s.alt) { L.push(`try ${c}`, 'getlasterror >> err', 'if err', ...s.alt.map((a) => '  ' + a), 'endif'); continue; }
      L.push(s.try ? 'try ' + c : c);
    }
    return L.join('\r\n') + '\r\n';
  }

  BV.PMExport = { build, taggedText, encode1252, b64, toSpt };
  if (typeof module !== 'undefined') module.exports = BV.PMExport;
})();
