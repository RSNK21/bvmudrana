/* BV Mudrana: InDesign Markup (IDML), read and written directly.
   Reading: pages, master spreads, layers, colours, paragraph and character styles, threaded text frames,
   rectangles, ovals, polygons, lines, groups (flattened, rotation kept), pictures (linked or embedded,
   with their crop), and text in old Kannada, Devanagari and IAST fonts (made Unicode on the way in).
   Writing: the same, as an IDML package that InDesign CS4 and later open; Indic paragraphs use the
   Adobe World-Ready Paragraph Composer so Kannada and Devanagari shape correctly in InDesign. */
(function () {
  const BV = window.BV;
  const T = BV.Text;

  // ================================================================== helpers
  const r2 = (v) => Math.round(v * 100) / 100;
  const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const mat = (s) => { const a = String(s || '1 0 0 1 0 0').trim().split(/\s+/).map(Number); return a.length === 6 && a.every(isFinite) ? a : [1, 0, 0, 1, 0, 0]; };
  const mul = (p, c) => [p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1], p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3], p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const kids = (el, name) => (el ? [...el.children].filter((c) => !name || c.localName === name) : []);
  const kid = (el, name) => kids(el, name)[0] || null;
  const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const strip = (ref, pre) => String(ref || '').replace(new RegExp('^' + pre + '/'), '').replace(/^\$ID\//, '');
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  // a property that may be an attribute or a <Properties> child
  function prop(el, name) {
    if (!el) return null;
    if (el.hasAttribute(name)) return el.getAttribute(name);
    const pr = kid(el, 'Properties');
    const p = pr && kid(pr, name);
    return p ? p.textContent : null;
  }

  // ================================================================== reading
  function colorTable(xml) {
    const out = { 'Swatch/None': 'none', 'Color/Black': '#000000', 'Color/Paper': '#ffffff', 'Color/Registration': '#000000' };
    const names = {};
    if (!xml) return { map: out, names };
    const d = parse(xml);
    for (const c of d.getElementsByTagName('Color')) {
      const self = c.getAttribute('Self');
      const v = String(c.getAttribute('ColorValue') || '').split(/\s+/).map(Number);
      const sp = c.getAttribute('Space');
      let hex = '#000000';
      if (sp === 'RGB' && v.length >= 3) hex = rgbHex(v[0], v[1], v[2]);
      else if (sp === 'CMYK' && v.length >= 4) { const [C, M, Y, K] = v.map((x) => x / 100); hex = rgbHex(255 * (1 - C) * (1 - K), 255 * (1 - M) * (1 - K), 255 * (1 - Y) * (1 - K)); }
      else if (sp === 'LAB' && v.length >= 3) { const L = v[0]; hex = rgbHex(L * 2.55, L * 2.55, L * 2.55); }
      out[self] = hex;
      const n = c.getAttribute('Name');
      if (n && !/^\$ID\//.test(n)) names[n] = hex;
    }
    for (const t of d.getElementsByTagName('Tint')) {
      const base = out[t.getAttribute('BaseColor')];
      const k = num(t.getAttribute('TintValue'), 100) / 100;
      if (base && base !== 'none') { const c = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16)); out[t.getAttribute('Self')] = rgbHex(...c.map((x) => 255 - (255 - x) * k)); }
    }
    return { map: out, names };
  }

  const JUST = { LeftAlign: 'left', CenterAlign: 'center', RightAlign: 'right', LeftJustified: 'justify', CenterJustified: 'justify', RightJustified: 'justify', FullyJustified: 'justify', ToBindingSide: 'left', AwayFromBindingSide: 'right' };
  // paragraph and character attributes of an IDML element, in BV terms
  function attrsOf(el, colors) {
    const o = {};
    if (!el) return o;
    const font = prop(el, 'AppliedFont');
    if (font) o.font = font.replace(/^\$ID\//, '');
    const fs = el.getAttribute('FontStyle');
    if (fs) { o.bold = /bold|black|heavy|semibold|demi/i.test(fs); o.italic = /italic|oblique/i.test(fs); o.fontStyle = fs; }
    if (el.hasAttribute('PointSize')) o.size = r2(num(el.getAttribute('PointSize'), 12));
    const lead = prop(el, 'Leading');
    if (lead != null && lead !== '') o.leading = /auto/i.test(lead) ? 'auto' : r2(num(lead, 14));
    const j = el.getAttribute('Justification');
    if (j && JUST[j]) o.align = JUST[j];
    for (const [a, b] of [['FirstLineIndent', 'firstIndent'], ['LeftIndent', 'leftIndent'], ['RightIndent', 'rightIndent'], ['SpaceBefore', 'spaceBefore'], ['SpaceAfter', 'spaceAfter']]) if (el.hasAttribute(a)) o[b] = r2(num(el.getAttribute(a)));
    const fc = el.getAttribute('FillColor');
    if (fc && colors.map[fc] && colors.map[fc] !== 'none') o.color = colors.map[fc];
    const cap = el.getAttribute('Capitalization');
    if (cap === 'AllCaps') o.caps = true;
    if (cap === 'SmallCaps' || cap === 'CapToSmallCap') o.smallCaps = true;
    if (el.getAttribute('Underline') === 'true') o.underline = true;
    if (el.getAttribute('StrikeThru') === 'true') o.strike = true;
    const pos = el.getAttribute('Position');
    if (pos === 'Superscript' || pos === 'OTSuperscript') o.pos = 'sup';
    if (pos === 'Subscript' || pos === 'OTSubscript') o.pos = 'sub';
    if (el.hasAttribute('HorizontalScale')) o.width = num(el.getAttribute('HorizontalScale'), 100);
    if (el.hasAttribute('BaselineShift')) o.shift = num(el.getAttribute('BaselineShift'));
    if (el.getAttribute('KeepWithNext') && num(el.getAttribute('KeepWithNext')) > 0) o.keepNext = true;
    const sb = el.getAttribute('StartParagraph');
    if (sb === 'NextPage' || sb === 'NextOddPage' || sb === 'NextEvenPage') o.pageBreak = true;
    return o;
  }
  // styles with their BasedOn chains resolved
  function styleTable(xml, kind, colors) {
    const raw = {};
    if (!xml) return raw;
    const d = parse(xml);
    for (const s of d.getElementsByTagName(kind)) raw[s.getAttribute('Self')] = { el: s, based: prop(s, 'BasedOn'), name: s.getAttribute('Name') || '' };
    const done = {};
    const resolve = (self, depth = 0) => {
      if (done[self]) return done[self];
      const r = raw[self];
      if (!r || depth > 20) return {};
      const base = r.based && raw[r.based] ? resolve(r.based, depth + 1) : {};
      return (done[self] = Object.assign({}, base, attrsOf(r.el, colors)));
    };
    const out = {};
    for (const self of Object.keys(raw)) out[self] = { name: raw[self].name, attrs: resolve(self) };
    return out;
  }
  const NICE = { 'NormalParagraphStyle': 'Basic Paragraph', '[No paragraph style]': 'No Paragraph Style' };
  const styleName = (self, st) => { const n = (st && st.name) || strip(self, 'ParagraphStyle'); const k = n.replace(/^\$ID\//, ''); return NICE[k] || k.replace(/:/g, ' / '); };

  // legacy fonts in InDesign files are made Unicode like everywhere else
  function convertRun(run) {
    const L = BV.Legacy;
    if (!L || !run.font) return run;
    const enc = L.encodingForFont(run.font);
    if (!L.convertible(enc)) return run;
    const target = L.unicodeFontFor(run.font);
    const orig = run.font;
    run.t = run.t.split('\r').map((t) => L.toUnicode(t, enc)).join('\r');
    run.font = target ? target.font : enc === 'nudi' || enc === 'praja' ? 'Noto Serif Kannada' : 'Noto Serif Devanagari';
    if (target && target.bold) run.bold = true;
    if (target && target.italic) run.italic = true;
    run.legacy = enc + ':' + orig;
    return run;
  }

  function storyParas(xml, ctx) {
    const d = parse(xml);
    const story = d.getElementsByTagName('Story')[0];
    const paras = [];
    let cur = null;
    const newPara = (style, ov) => { cur = { style, runs: [], ov: Object.assign({}, ov) }; paras.push(cur); };
    let psrStyle = null, psrOv = {};
    const addText = (t, ca) => {
      if (!cur) newPara(psrStyle, psrOv);
      if (!t) return;
      const run = Object.assign({ t }, ca);
      cur.runs.push(run);
    };
    function walkChars(el, ca) {
      for (const n of el.childNodes) {
        if (n.nodeType === 7) { // processing instructions: <?ACE 18?> is the page number
          if (n.target === 'ACE' && /^\s*18\b/.test(n.data)) addText(BV.PAGE_MARKER, ca);
          else if (n.target === 'ACE' && /^\s*8\b/.test(n.data)) addText('\t', ca);
          continue;
        }
        if (n.nodeType !== 1) continue;
        const nm = n.localName;
        if (nm === 'Content') addText(n.textContent.replace(/\u2029/g, '\r').replace(/[\ufeff]/g, ''), ca);
        else if (nm === 'Br') { if (!cur) newPara(psrStyle, psrOv); cur.closed = true; newPara(psrStyle, psrOv); }
        else if (nm === 'Footnote') { ctx.report.footnotes++; }
        else if (nm === 'Table') {
          ctx.report.tables++;
          for (const cell of n.getElementsByTagName('Cell')) {
            for (const psr of kids(cell, 'ParagraphStyleRange')) walkPSR(psr);
            if (!cur) newPara(psrStyle, psrOv);
            cur.closed = true; newPara(psrStyle, psrOv);
          }
        } else if (nm === 'Rectangle' || nm === 'Group' || nm === 'TextFrame' || nm === 'Oval' || nm === 'Polygon') { ctx.report.anchored++; }
        else if (nm === 'XMLElement' || nm === 'HyperlinkTextSource' || nm === 'Change' || nm === 'HiddenText') walkChars(n, ca);
      }
    }
    function walkPSR(psr) {
      const pself = psr.getAttribute('AppliedParagraphStyle') || 'ParagraphStyle/$ID/NormalParagraphStyle';
      psrStyle = ctx.styleOf(pself);
      psrOv = attrsOf(psr, ctx.colors);
      for (const k of Object.keys(psrOv)) if (!BV.PARA_KEYS.includes(k)) delete psrOv[k];
      if (cur && !cur.runs.length) { cur.style = psrStyle; cur.ov = Object.assign({}, psrOv); }
      for (const n of psr.children) {
        if (n.localName === 'CharacterStyleRange') {
          const cs = ctx.cstyles[n.getAttribute('AppliedCharacterStyle')];
          const ca = Object.assign({}, cs ? cs.attrs : {}, attrsOf(n, ctx.colors));
          for (const k of Object.keys(ca)) if (!BV.CHAR_KEYS.includes(k)) delete ca[k];
          // paragraph-level formatting set on the range (font, size) belongs to the run too
          walkChars(n, ca);
        } else if (n.nodeType === 1) walkChars(psr, {});
      }
    }
    if (story) for (const n of story.children) {
      if (n.localName === 'ParagraphStyleRange') walkPSR(n);
      else if (n.localName === 'XMLElement') for (const p of n.getElementsByTagName('ParagraphStyleRange')) walkPSR(p);
    }
    // tidy: drop a trailing empty paragraph left by the last <Br/>, convert legacy fonts
    while (paras.length > 1 && !paras[paras.length - 1].runs.length) paras.pop();
    for (const p of paras) {
      if (!p.style) p.style = ctx.styleOf('ParagraphStyle/$ID/NormalParagraphStyle');
      if (!Object.keys(p.ov || {}).length) delete p.ov;
      delete p.closed;
      p.runs = p.runs.map((r) => convertRun(r));
      if (!p.runs.length) p.runs = [{ t: '' }];
      const st = ctx.doc.styles[p.style] || {};
      for (const r of p.runs) for (const k of Object.keys(r)) if (k !== 't' && k !== 'legacy' && r[k] === st[k]) delete r[k];
      T.normalize(p);
      if (/[ಀ-೿]/.test(T.paraText(p))) ctx.report.kannada = true;
      if (/[ऀ-ॿ]/.test(T.paraText(p))) ctx.report.devanagari = true;
    }
    return paras.length ? paras : [{ style: 'Body text', runs: [{ t: '' }] }];
  }

  // path points of a page item: [{a:[x,y]}] and whether it is open
  function geometry(el) {
    const out = [];
    let open = false;
    const pr = kid(el, 'Properties');
    const pg = pr && kid(pr, 'PathGeometry');
    if (pg) {
      const gpt = kid(pg, 'GeometryPathType');
      if (gpt) {
        open = gpt.getAttribute('PathOpen') === 'true';
        const arr = kid(gpt, 'PathPointArray');
        for (const p of kids(arr, 'PathPointType')) { const a = String(p.getAttribute('Anchor') || '0 0').split(/\s+/).map(Number); out.push(a); }
      }
    }
    if (!out.length && el.hasAttribute('GeometricBounds')) {
      const [t, l, b, r] = String(el.getAttribute('GeometricBounds')).split(/\s+/).map(Number);
      out.push([l, t], [l, b], [r, b], [r, t]);
    }
    return { pts: out, open };
  }

  function toDoc(data) {
    const X = data.xml || {};
    const report = { pages: 0, frames: 0, shapes: 0, images: 0, imagesMissing: 0, groups: 0, tables: 0, footnotes: 0, anchored: 0, masters: 0, notes: [] };
    const dm = parse(X['designmap.xml'] || '<Document/>');
    const D = dm.documentElement;
    const colors = colorTable(X['Resources/Graphic.xml']);
    const pstyles = styleTable(X['Resources/Styles.xml'], 'ParagraphStyle', colors);
    const cstyles = styleTable(X['Resources/Styles.xml'], 'CharacterStyle', colors);
    const prefs = parse(X['Resources/Preferences.xml'] || '<Preferences/>');
    const dp = prefs.getElementsByTagName('DocumentPreference')[0];
    const W = num(dp && dp.getAttribute('PageWidth'), 612), H = num(dp && dp.getAttribute('PageHeight'), 792);
    const facing = dp ? dp.getAttribute('FacingPages') !== 'false' : true;
    const mp = prefs.getElementsByTagName('MarginPreference')[0];
    const sections = [...D.getElementsByTagName('Section')];
    const startPage = sections[0] && sections[0].hasAttribute('PageNumberStart') ? num(sections[0].getAttribute('PageNumberStart'), 1) : 1;
    const numStyle = sections[0] && sections[0].getAttribute('PageNumberStyle');
    const doc = BV.newDocument({ w: W, h: H, doubleSided: facing, facing, startPage, pageCount: 0, units: 'mm', numbering: /roman/i.test(numStyle || '') ? (/upper/i.test(numStyle) ? 'ROMAN' : 'roman') : 'arabic' });
    if (mp) {
      doc.setup.margins = { top: num(mp.getAttribute('Top'), 36), bottom: num(mp.getAttribute('Bottom'), 36), inside: num(mp.getAttribute('Left'), 36), outside: num(mp.getAttribute('Right'), 36) };
      doc.setup.columns = Math.max(1, num(mp.getAttribute('ColumnCount'), 1));
      doc.setup.gutter = num(mp.getAttribute('ColumnGutter'), 12);
    }
    // colours that have names become swatches
    const known = new Set(doc.colors.map((c) => c.name));
    for (const [n, hex] of Object.entries(colors.names)) if (!known.has(n)) { doc.colors.push({ name: n, hex }); known.add(n); }
    // paragraph styles
    const ctx = { doc, colors, cstyles, report, styleOf: null };
    const styles = {};
    const def = { font: 'Minion Pro', size: 12, leading: 14.4, align: 'left', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 0, color: '#000000', bold: false, italic: false, next: '', breakBefore: false };
    const nameOf = {};
    for (const [self, st] of Object.entries(pstyles)) {
      if (/\[No paragraph style\]/.test(self)) continue;
      const n = styleName(self, st);
      const a = Object.assign({}, def, st.attrs);
      delete a.fontStyle;
      if (a.leading === 'auto') a.leading = Math.round(a.size * 1.2 * 10) / 10;
      for (const k of Object.keys(a)) if (!(k in def) && !BV.PARA_KEYS.includes(k)) delete a[k];
      // a legacy-font style points at its Unicode font
      if (BV.Legacy && BV.Legacy.convertible(BV.Legacy.encodingForFont(a.font))) { const u = BV.Legacy.unicodeFontFor(a.font); a.font = u ? u.font : 'Noto Serif Kannada'; }
      styles[n] = a;
      nameOf[self] = n;
    }
    if (!Object.keys(styles).length) styles['Basic Paragraph'] = def;
    for (const [k, v] of Object.entries(BV.defaultStyles())) if (!styles[k]) styles[k] = v;
    doc.styles = styles;
    ctx.styleOf = (self) => nameOf[self] || (styles[styleName(self, pstyles[self])] ? styleName(self, pstyles[self]) : Object.keys(styles)[0]);

    // layers
    const layerMap = {};
    const layers = [...D.getElementsByTagName('Layer')];
    if (layers.length) {
      doc.layers = layers.map((l, i) => { const id = 'L' + (i + 1); layerMap[l.getAttribute('Self')] = id; return { id, name: l.getAttribute('Name') || 'Layer ' + (i + 1), visible: l.getAttribute('Visible') !== 'false', locked: l.getAttribute('Locked') === 'true', color: ['#4a6cf7', '#e0533d', '#2fa36b', '#c79a1d', '#8a4fd8'][i % 5] }; });
      // InDesign lists layers top first; BV draws the first layer first
      doc.layers.reverse();
      doc.activeLayer = doc.layers[doc.layers.length - 1].id;
    }

    // stories
    const storyEls = {};
    for (const [k, s] of Object.entries(X)) if (/^Stories\//.test(k)) { const m = /Self="([^"]+)"/.exec(s.slice(s.indexOf('<Story'))); if (m) storyEls[m[1]] = s; }
    const storyOf = {};
    const getStory = (self) => {
      if (storyOf[self]) return storyOf[self];
      if (!storyEls[self]) return null;
      const st = BV.newStory(doc, Object.keys(styles)[0]);
      st.paras = storyParas(storyEls[self], ctx);
      storyOf[self] = st;
      return st;
    };

    // masters
    const masterOf = {};
    const masterFiles = [...D.children].filter((c) => c.localName === 'MasterSpread').map((c) => c.getAttribute('src'));
    const pageDefs = [];
    const frameChain = []; // [{it, self, prev, next, story}]
    let groupSeq = 0;

    function addItems(parentEl, m, pageRefOf, isMaster, gid) {
      for (const el of parentEl.children) {
        const nm = el.localName;
        if (!['TextFrame', 'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group', 'Button'].includes(nm)) continue;
        const mm = mul(m, mat(el.getAttribute('ItemTransform')));
        if (nm === 'Group' || nm === 'Button') { report.groups++; addItems(el, mm, pageRefOf, isMaster, gid || 'g' + ++groupSeq); continue; }
        if (el.getAttribute('Visible') === 'false') continue;
        const g = geometry(el);
        if (!g.pts.length) continue;
        const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]);
        const lx0 = Math.min(...xs), ly0 = Math.min(...ys), lx1 = Math.max(...xs), ly1 = Math.max(...ys);
        const sx = Math.hypot(mm[0], mm[1]) || 1, sy = Math.hypot(mm[2], mm[3]) || 1;
        const rot = (Math.atan2(mm[1], mm[0]) * 180) / Math.PI;
        const flipY = mm[0] * mm[3] - mm[1] * mm[2] < 0;
        const [cxs, cys] = ap(mm, (lx0 + lx1) / 2, (ly0 + ly1) / 2);
        const pg = pageRefOf(cxs, cys);
        if (!pg) continue;
        const w = (lx1 - lx0) * sx, h = (ly1 - ly0) * sy;
        const x = cxs - pg.x0 - w / 2, y = cys - pg.y0 - h / 2;
        const layer = layerMap[el.getAttribute('ItemLayer')] || doc.activeLayer;
        const fillRef = el.getAttribute('FillColor');
        const strokeRef = el.getAttribute('StrokeColor');
        const sw = num(el.getAttribute('StrokeWeight'), nm === 'GraphicLine' ? 1 : 0);
        const fill = fillRef && colors.map[fillRef] ? colors.map[fillRef] : 'none';
        const stroke = strokeRef ? colors.map[strokeRef] || 'none' : nm === 'GraphicLine' ? '#000000' : 'none';
        const tint = el.hasAttribute('FillTint') && num(el.getAttribute('FillTint'), -1) >= 0 ? num(el.getAttribute('FillTint'), 100) : undefined;
        const base = { layer, stroke: sw > 0 ? stroke : 'none', strokeWidth: stroke === 'none' ? 0 : sw, fill };
        if (tint !== undefined && tint < 100) base.fillTint = tint;
        if (Math.abs(rot) > 0.01) base.rot = Math.round(rot * 100) / 100;
        if (gid) base.group = gid;
        if (el.hasAttribute('StrokeType') && /Dash/i.test(el.getAttribute('StrokeType'))) base.strokeStyle = 'dash';
        if (el.hasAttribute('StrokeType') && /Dot/i.test(el.getAttribute('StrokeType'))) base.strokeStyle = 'dot';
        const tw = kid(el, 'TextWrapPreference');
        if (tw && /BoundingBox|Contour|JumpObject/.test(tw.getAttribute('TextWrapMode') || '')) {
          const off = kid(kid(tw, 'Properties'), 'TextWrapOffset');
          base.wrap = { type: 'rect', standoff: off ? num(off.getAttribute('Top'), 6) : 6 };
        }
        if (nm === 'TextFrame') {
          const it = BV.newItem(doc, 'text', pg.ref, x, y, Math.max(4, w), Math.max(4, h), Object.assign(base, { stroke: base.stroke, storyId: null }));
          frameChain.push({ it, self: el.getAttribute('Self'), prev: el.getAttribute('PreviousTextFrame'), next: el.getAttribute('NextTextFrame'), story: el.getAttribute('ParentStory') });
          report.frames++;
          continue;
        }
        if (nm === 'GraphicLine' && g.pts.length === 2) {
          const [ax, ay] = ap(mm, g.pts[0][0], g.pts[0][1]);
          const [bx, by] = ap(mm, g.pts[1][0], g.pts[1][1]);
          BV.newItem(doc, 'line', pg.ref, ax - pg.x0, ay - pg.y0, bx - ax, by - ay, Object.assign(base, { rot: undefined, fill: 'none' }));
          report.shapes++;
          continue;
        }
        // pictures
        const pic = kids(el).find((c) => ['Image', 'PDF', 'EPS', 'ImportedPage', 'PICT', 'WMF'].includes(c.localName));
        if (pic) {
          const link = kid(pic, 'Link');
          const uri = link && link.getAttribute('LinkResourceURI');
          let src = null;
          const contents = prop(pic, 'Contents');
          if (contents && contents.trim()) src = 'data:image/' + (/^\/9j/.test(contents.trim()) ? 'jpeg' : 'png') + ';base64,' + contents.trim().replace(/\s+/g, '');
          if (!src && uri && data.links && data.links[uri]) src = data.links[uri].src;
          const name = uri ? decodeURIComponent(uri.split(/[\\/]/).pop()) : pic.localName;
          const it = BV.newItem(doc, 'image', pg.ref, x, y, w, h, Object.assign(base, { src, name: src ? name : `${name} (not found)`, fill: 'none' }));
          if (flipY) it.flipY = true;
          // where the whole picture sits inside the frame (InDesign keeps the whole picture and crops by the frame)
          const gb = kid(kid(pic, 'Properties'), 'GraphicBounds');
          if (gb) {
            const im = mat(pic.getAttribute('ItemTransform'));
            const L = num(gb.getAttribute('Left')), Tp = num(gb.getAttribute('Top')), R = num(gb.getAttribute('Right')), B = num(gb.getAttribute('Bottom'));
            const c1 = ap(im, L, Tp), c2 = ap(im, R, B);
            const ix0 = Math.min(c1[0], c2[0]), iy0 = Math.min(c1[1], c2[1]), ix1 = Math.max(c1[0], c2[0]), iy1 = Math.max(c1[1], c2[1]);
            it.cx = (ix0 - lx0) * sx; it.cy = (iy0 - ly0) * sy; it.cw = (ix1 - ix0) * sx; it.ch = (iy1 - iy0) * sy;
            if (Math.abs(it.cx) < 0.05 && Math.abs(it.cy) < 0.05 && Math.abs(it.cw - w) < 0.05 && Math.abs(it.ch - h) < 0.05) { delete it.cx; delete it.cy; delete it.cw; delete it.ch; }
          }
          if (src) report.images++; else report.imagesMissing++;
          continue;
        }
        const type = nm === 'Oval' ? 'ellipse' : nm === 'Polygon' || nm === 'GraphicLine' || g.pts.length !== 4 ? 'polygon' : 'rect';
        const it = BV.newItem(doc, type, pg.ref, x, y, Math.max(0.5, w), Math.max(0.5, h), base);
        if (type === 'polygon') {
          const ww = lx1 - lx0 || 1, hh = ly1 - ly0 || 1;
          it.pts = g.pts.map(([px, py]) => [(px - lx0) / ww, (py - ly0) / hh]);
          if (g.open) { it.open = true; it.fill = 'none'; }
        }
        if (type === 'rect') {
          const cr = el.getAttribute('CornerRadius') || el.getAttribute('TopLeftCornerRadius');
          const co = el.getAttribute('CornerOption') || el.getAttribute('TopLeftCornerOption');
          if (cr && co && co !== 'None') it.radius = num(cr);
        }
        report.shapes++;
      }
    }
    function readSpread(xml, isMaster) {
      const d = parse(xml);
      const sp = d.getElementsByTagName(isMaster ? 'MasterSpread' : 'Spread')[0];
      if (!sp) return;
      const sm = mat(sp.getAttribute('ItemTransform'));
      let mid = null;
      if (isMaster) {
        const self = sp.getAttribute('Self');
        const name = [sp.getAttribute('NamePrefix'), sp.getAttribute('BaseName')].filter(Boolean).join('-') || sp.getAttribute('Name') || 'Master';
        if (!Object.keys(masterOf).length) mid = ''; // the first master spread is the document master
        else { mid = BV.newId(doc, 'm'); doc.masters.push({ id: mid, name, guides: { L: { h: [], v: [] }, R: { h: [], v: [] } } }); }
        masterOf[self] = mid;
        report.masters++;
      }
      const pages = kids(sp, 'Page').map((p, i, arr) => {
        const pm = mul(sm, mat(p.getAttribute('ItemTransform')));
        const [t, l] = String(p.getAttribute('GeometricBounds') || `0 0 ${H} ${W}`).split(/\s+/).map(Number);
        const [x0, y0] = ap(pm, l, t);
        let ref;
        if (isMaster) {
          const side = arr.length > 1 ? (i === 0 ? 'L' : 'R') : 'R';
          ref = BV.masterRef(mid, side);
          // a single-page master in a facing publication serves both sides
          if (arr.length === 1 && facing) pageDefs.push({ ref: BV.masterRef(mid, 'L'), x0, y0, master: true, dup: true });
        } else {
          const pg = BV.newPage(doc);
          doc.pages.push(pg);
          const am = p.getAttribute('AppliedMaster');
          pg._am = am;
          const mpf = kid(p, 'MarginPreference');
          if (mpf && num(mpf.getAttribute('ColumnCount'), 1) !== doc.setup.columns) { pg.columns = num(mpf.getAttribute('ColumnCount'), 1); pg.gutter = num(mpf.getAttribute('ColumnGutter'), doc.setup.gutter); }
          ref = pg.id;
          report.pages++;
        }
        return { ref, x0, y0, x1: x0 + W, y1: y0 + H };
      });
      const pageRefOf = (x, y) => {
        let best = null, bd = Infinity;
        for (const p of pages) {
          const dx = x < p.x0 ? p.x0 - x : x > p.x1 ? x - p.x1 : 0;
          const dy = y < p.y0 ? p.y0 - y : y > p.y1 ? y - p.y1 : 0;
          const dd = dx + dy;
          if (dd < bd) { bd = dd; best = p; }
        }
        return best;
      };
      addItems(sp, sm, pageRefOf, isMaster, null);
    }
    for (const f of masterFiles) if (X[f]) readSpread(X[f], true);
    for (const c of D.children) if (c.localName === 'Spread' && X[c.getAttribute('src')]) readSpread(X[c.getAttribute('src')], false);
    if (!doc.pages.length) doc.pages.push(BV.newPage(doc));
    // pages take their master
    for (const pg of doc.pages) {
      const am = pg._am;
      delete pg._am;
      if (!am || am === 'n') pg.master = false;
      else if (masterOf[am] !== undefined && masterOf[am] !== '') pg.masterId = masterOf[am];
    }
    // single-page masters in a facing publication: copy their items to the left side too
    if (facing) for (const mid of Object.values(masterOf)) {
      const R = BV.masterRef(mid, 'R'), Lr = BV.masterRef(mid, 'L');
      if (Object.values(doc.items).some((it) => it.page === Lr)) continue;
      for (const it of Object.values(doc.items).filter((i) => i.page === R)) {
        if (it.type === 'text') continue;
        const c = JSON.parse(JSON.stringify(it));
        c.id = BV.newId(doc, 'i');
        c.page = Lr;
        doc.items[c.id] = c;
      }
    }
    // threads: frames of a story in their InDesign order
    const bySelf = {};
    for (const f of frameChain) bySelf[f.self] = f;
    const seen = new Set();
    for (const f of frameChain) {
      if (seen.has(f.self)) continue;
      // go back to the first frame of the thread
      let first = f;
      let guard = 0;
      while (first.prev && first.prev !== 'n' && bySelf[first.prev] && guard++ < 5000) first = bySelf[first.prev];
      const st = getStory(first.story);
      let cur = first;
      guard = 0;
      while (cur && !seen.has(cur.self) && guard++ < 5000) {
        seen.add(cur.self);
        if (st) { cur.it.storyId = st.id; st.frames.push(cur.it.id); }
        cur = cur.next && cur.next !== 'n' ? bySelf[cur.next] : null;
      }
    }
    for (const f of frameChain) if (!f.it.storyId) { const st = BV.newStory(doc, Object.keys(styles)[0]); f.it.storyId = st.id; st.frames.push(f.it.id); }
    let z = 1;
    for (const it of Object.values(doc.items)) it.z = z++;
    if (report.tables) report.notes.push(`${report.tables} table${report.tables === 1 ? ' was' : 's were'} turned into plain paragraphs.`);
    if (report.footnotes) report.notes.push(`${report.footnotes} footnote${report.footnotes === 1 ? ' was' : 's were'} left out.`);
    if (report.anchored) report.notes.push(`${report.anchored} anchored object${report.anchored === 1 ? ' was' : 's were'} left out of the text.`);
    if (report.imagesMissing) report.notes.push(`${report.imagesMissing} picture${report.imagesMissing === 1 ? ' was' : 's were'} not found (put the Links folder next to the file, or relink them with Element > Link Options).`);
    return { doc, report };
  }

  // ================================================================== writing
  const xe = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f2 = (v) => String(Math.round(v * 1000) / 1000);
  const DOM = '6.0';
  const AID = (type) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<?aid style="50" type="${type}" readerVersion="6.0" featureSet="257" product="6.0(352)" ?>\n`;
  const PKG = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';
  const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [0, 0, 0]; };
  const INDIC = /[ऀ-෿]/;

  async function imageInfo(src) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(src || '');
    if (!m) return null;
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.onerror = res; img.src = src; });
    let ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[m[1]];
    let b64 = m[2] ? m[3] : null;
    if (!ext || !b64) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, img.naturalWidth || 1); c.height = Math.max(1, img.naturalHeight || 1);
      c.getContext('2d').drawImage(img, 0, 0);
      ext = 'png'; b64 = c.toDataURL('image/png').split(',')[1];
    }
    return { ext, b64, w: img.naturalWidth || 100, h: img.naturalHeight || 100 };
  }

  async function fromDoc(doc, opts = {}) {
    let seq = 0x100;
    const id = () => 'u' + (seq++).toString(16);
    const files = {};
    const images = {};
    const linksDir = opts.linksDir || '';
    const fileUri = (p) => 'file:' + p.replace(/\\/g, '/').split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
    const W = doc.setup.w, H = doc.setup.h;
    const facing = !!(doc.setup.doubleSided && doc.setup.facing);

    // ---------- colours
    const colorSelf = { '#000000': 'Color/Black', '#ffffff': 'Color/Paper' };
    let colorXml = '';
    const named = new Map();
    for (const c of doc.colors || []) if (!c.fixed && c.name && !named.has(c.hex)) named.set(c.hex.toLowerCase(), c.name);
    const colorRef = (hex) => {
      if (!hex || hex === 'none' || hex === 'transparent') return 'Swatch/None';
      const h = hex.toLowerCase();
      if (colorSelf[h]) return colorSelf[h];
      const name = named.get(h) || 'R=' + hexToRgb(h).join(' G=').replace(/ G=(\d+) G=/, ' G=$1 B=');
      const self = 'Color/' + name;
      colorSelf[h] = self;
      colorXml += `\t<Color Self="${xe(self)}" Model="Process" Space="RGB" ColorValue="${hexToRgb(h).join(' ')}" ColorOverride="Normal" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="${xe(name)}" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>\n`;
      return self;
    };
    for (const [h] of named) colorRef(h);

    // ---------- fonts used
    const fonts = new Map();
    const fontOf = (f) => { if (f && !fonts.has(f)) fonts.set(f, id()); return f; };

    // ---------- styles
    const ALIGN = { left: 'LeftAlign', center: 'CenterAlign', right: 'RightAlign', justify: 'LeftJustified' };
    const indicStyle = {};
    for (const st of Object.values(doc.stories)) for (const p of st.paras) if (INDIC.test(T.paraText(p))) indicStyle[p.style] = true;
    const fontStyle = (b, i) => (b && i ? 'Bold Italic' : b ? 'Bold' : i ? 'Italic' : 'Regular');
    const paraAttrs = (pp, all) => {
      let a = '';
      if (all || pp.size !== undefined) a += ` PointSize="${f2(pp.size || 12)}"`;
      if (all || pp.align !== undefined) a += ` Justification="${ALIGN[pp.align] || 'LeftAlign'}"`;
      for (const [k, n] of [['firstIndent', 'FirstLineIndent'], ['leftIndent', 'LeftIndent'], ['rightIndent', 'RightIndent'], ['spaceBefore', 'SpaceBefore'], ['spaceAfter', 'SpaceAfter']]) if (all || pp[k] !== undefined) a += ` ${n}="${f2(pp[k] || 0)}"`;
      if (all || pp.bold !== undefined || pp.italic !== undefined) a += ` FontStyle="${fontStyle(pp.bold, pp.italic)}"`;
      if (all || pp.color !== undefined) a += ` FillColor="${xe(colorRef(pp.color || '#000000'))}"`;
      if (pp.keepNext) a += ' KeepWithNext="1"';
      if (pp.pageBreak || pp.breakBefore) a += ' StartParagraph="NextPage"';
      return a;
    };
    const paraProps = (pp, all) => {
      let p = '';
      if (all || pp.font !== undefined) p += `<AppliedFont type="string">${xe(fontOf(pp.font || 'Minion Pro'))}</AppliedFont>`;
      if (all || pp.leading !== undefined) p += pp.leading === 'auto' || !pp.leading ? '<Leading type="enumeration">Auto</Leading>' : `<Leading type="unit">${f2(pp.leading)}</Leading>`;
      return p;
    };
    let pstyleXml = '';
    const styleSelf = {};
    for (const [name, st] of Object.entries(doc.styles)) {
      const self = 'ParagraphStyle/' + name.replace(/[/:]/g, ' ');
      styleSelf[name] = self;
      const comp = indicStyle[name] || INDIC.test(st.font || '') || /kannada|devanagari|nudi|praja|chitkala|tunga|mangal|sanskrit/i.test(st.font || '') ? ' Composer="$ID/HL Composer Optyca"' : '';
      pstyleXml += `\t\t<ParagraphStyle Self="${xe(self)}" Name="${xe(name.replace(/[/:]/g, ' '))}" Imported="false" NextStyle="${xe(st.next && doc.styles[st.next] ? 'ParagraphStyle/' + st.next.replace(/[/:]/g, ' ') : self)}" KeyboardShortcut="0 0"${paraAttrs(st, true)}${comp}>\n\t\t\t<Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><PreviewColor type="enumeration">Nothing</PreviewColor>${paraProps(st, true)}</Properties>\n\t\t</ParagraphStyle>\n`;
    }

    // ---------- stories
    const storySelf = {};
    const storyFiles = [];
    for (const st of Object.values(doc.stories)) {
      if (!st.frames.length) continue;
      const self = id();
      storySelf[st.id] = self;
      let body = '';
      st.paras.forEach((para, pi) => {
        const pp = BV.paraProps(doc, para);
        const ov = para.ov || {};
        const comp = INDIC.test(T.paraText(para)) ? ' Composer="$ID/HL Composer Optyca"' : '';
        body += `\t\t<ParagraphStyleRange AppliedParagraphStyle="${xe(styleSelf[para.style] || 'ParagraphStyle/$ID/NormalParagraphStyle')}"${paraAttrs(ov, false)}${comp}>\n`;
        const runs = para.runs.length ? para.runs : [{ t: '' }];
        runs.forEach((run, ri) => {
          const cp = BV.charProps(pp, run);
          let a = ` AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="${f2(cp.size)}" FontStyle="${fontStyle(cp.bold, cp.italic)}" FillColor="${xe(colorRef(run.color || pp.color || '#000000'))}"`;
          if (cp.underline) a += ' Underline="true"';
          if (cp.strike) a += ' StrikeThru="true"';
          if (cp.caps) a += ' Capitalization="AllCaps"';
          else if (cp.smallCaps) a += ' Capitalization="SmallCaps"';
          if (run.pos === 'sup') a += ' Position="Superscript"';
          if (run.pos === 'sub') a += ' Position="Subscript"';
          if (cp.width && cp.width !== 100) a += ` HorizontalScale="${f2(cp.width)}"`;
          if (run.shift) a += ` BaselineShift="${f2(run.shift)}"`;
          if (run.track) a += ` Tracking="${Math.round(run.track * 1000)}"`;
          let inner = `\t\t\t\t<Properties><AppliedFont type="string">${xe(fontOf(cp.font))}</AppliedFont>${pp.leading && pp.leading !== 'auto' ? `<Leading type="unit">${f2(pp.leading)}</Leading>` : ''}</Properties>\n`;
          for (const part of String(run.t || '').split(/(\ue000)/)) {
            if (part === '\ue000') inner += '\t\t\t\t<?ACE 18?>\n';
            else if (part) inner += `\t\t\t\t<Content>${xe(part.replace(/[\ue001\ue002]/g, ''))}</Content>\n`;
          }
          if (ri === runs.length - 1 && pi < st.paras.length - 1) inner += '\t\t\t\t<Br/>\n';
          body += `\t\t\t<CharacterStyleRange${a}>\n${inner}\t\t\t</CharacterStyleRange>\n`;
        });
        body += '\t\t</ParagraphStyleRange>\n';
      });
      files[`Stories/Story_${self}.xml`] = AID('snippet') + `<idPkg:Story ${PKG} DOMVersion="${DOM}">\n\t<Story Self="${self}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">\n\t\t<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>\n\t\t<InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false"/>\n${body}\t</Story>\n</idPkg:Story>\n`;
      storyFiles.push(self);
    }

    // ---------- page items
    const layerSelf = {};
    (doc.layers || []).forEach((l) => (layerSelf[l.id] = id()));
    const frameSelf = {};
    for (const it of Object.values(doc.items)) if (it.type === 'text') frameSelf[it.id] = id();
    const path4 = (w, h) => `<PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>${[[-w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2]].map(([x, y]) => `<PathPointType Anchor="${f2(x)} ${f2(y)}" LeftDirection="${f2(x)} ${f2(y)}" RightDirection="${f2(x)} ${f2(y)}"/>`).join('')}</PathPointArray></GeometryPathType></PathGeometry>`;
    const ellipsePath = (w, h) => {
      const k = 0.5523, rx = w / 2, ry = h / 2;
      const pts = [[[-rx, 0], [-rx, -ry * k], [-rx, ry * k]], [[0, ry], [-rx * k, ry], [rx * k, ry]], [[rx, 0], [rx, ry * k], [rx, -ry * k]], [[0, -ry], [rx * k, -ry], [-rx * k, -ry]]];
      return `<PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>${pts.map(([a, l, r]) => `<PathPointType Anchor="${f2(a[0])} ${f2(a[1])}" LeftDirection="${f2(l[0])} ${f2(l[1])}" RightDirection="${f2(r[0])} ${f2(r[1])}"/>`).join('')}</PathPointArray></GeometryPathType></PathGeometry>`;
    };
    const polyPath = (it, w, h) => `<PathGeometry><GeometryPathType PathOpen="${it.open ? 'true' : 'false'}"><PathPointArray>${(it.pts || []).map(([u, v]) => { const x = -w / 2 + u * w, y = -h / 2 + v * h; return `<PathPointType Anchor="${f2(x)} ${f2(y)}" LeftDirection="${f2(x)} ${f2(y)}" RightDirection="${f2(x)} ${f2(y)}"/>`; }).join('')}</PathPointArray></GeometryPathType></PathGeometry>`;
    async function itemXml(it, ox, oy) {
      const b = BV.Render.box(it);
      const cx = ox + b.x + b.w / 2, cy = oy + b.y + b.h / 2;
      const r = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      const tf = `${f2(c)} ${f2(s)} ${f2(-s)} ${f2(c)} ${f2(cx)} ${f2(cy)}`;
      const lay = layerSelf[it.layer || 'L1'] || Object.values(layerSelf)[0];
      const strokeOn = it.stroke && it.stroke !== 'none' && (it.strokeWidth || 0) > 0;
      const paint = ` FillColor="${xe(colorRef(it.fill))}"${it.fillTint && it.fillTint < 100 ? ` FillTint="${f2(it.fillTint)}"` : ''} StrokeColor="${xe(strokeOn ? colorRef(it.stroke) : 'Swatch/None')}" StrokeWeight="${f2(strokeOn ? it.strokeWidth : 0)}"${it.strokeStyle === 'dash' ? ' StrokeType="StrokeStyle/$ID/Dashed"' : it.strokeStyle === 'dot' ? ' StrokeType="StrokeStyle/$ID/Dotted"' : ''}`;
      const wrap = it.wrap && it.wrap.type && it.wrap.type !== 'none' ? `<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="BoundingBoxTextWrap"><Properties><TextWrapOffset Top="${f2(it.wrap.standoff ?? 6)}" Left="${f2(it.wrap.standoff ?? 6)}" Bottom="${f2(it.wrap.standoff ?? 6)}" Right="${f2(it.wrap.standoff ?? 6)}"/></Properties></TextWrapPreference>` : '';
      if (it.type === 'text') {
        const st = doc.stories[it.storyId];
        if (!st || !storySelf[st.id]) return '';
        const i = st.frames.indexOf(it.id);
        const prev = i > 0 ? frameSelf[st.frames[i - 1]] : 'n', next = i >= 0 && i < st.frames.length - 1 ? frameSelf[st.frames[i + 1]] : 'n';
        return `\t\t<TextFrame Self="${frameSelf[it.id]}" ParentStory="${storySelf[st.id]}" PreviousTextFrame="${prev || 'n'}" NextTextFrame="${next || 'n'}" ContentType="TextType" ItemLayer="${lay}" ItemTransform="${tf}"${paint} AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]">\n\t\t\t<Properties>${path4(b.w, b.h)}</Properties>\n\t\t\t<TextFramePreference TextColumnCount="1" TextColumnGutter="12" FirstBaselineOffset="AscentOffset" VerticalJustification="TopAlign"><Properties><InsetSpacing type="list"><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem></InsetSpacing></Properties></TextFramePreference>\n\t\t\t${wrap}\n\t\t</TextFrame>\n`;
      }
      if (it.type === 'line') {
        const x1 = ox + it.x, y1 = oy + it.y, x2 = x1 + it.w, y2 = y1 + it.h;
        return `\t\t<GraphicLine Self="${id()}" ItemLayer="${lay}" ItemTransform="1 0 0 1 0 0" FillColor="Swatch/None" StrokeColor="${xe(colorRef(it.stroke || '#000000'))}" StrokeWeight="${f2(it.strokeWidth || 1)}" AppliedObjectStyle="ObjectStyle/$ID/[None]">\n\t\t\t<Properties><PathGeometry><GeometryPathType PathOpen="true"><PathPointArray><PathPointType Anchor="${f2(x1)} ${f2(y1)}" LeftDirection="${f2(x1)} ${f2(y1)}" RightDirection="${f2(x1)} ${f2(y1)}"/><PathPointType Anchor="${f2(x2)} ${f2(y2)}" LeftDirection="${f2(x2)} ${f2(y2)}" RightDirection="${f2(x2)} ${f2(y2)}"/></PathPointArray></GeometryPathType></PathGeometry></Properties>\n\t\t</GraphicLine>\n`;
      }
      if (it.type === 'image' || (it.type === 'frame' && it.src)) {
        let inner = '';
        if (it.src) {
          const info = await imageInfo(it.src);
          if (info) {
            const name = `${it.id}.${info.ext}`;
            images[name] = info.b64;
            const iw = it.cw ?? b.w, ih = it.ch ?? b.h;
            const sx = iw / info.w, sy = ih / info.h;
            const tx = -b.w / 2 + (it.cx ?? 0), ty = -b.h / 2 + (it.cy ?? 0);
            const uri = linksDir ? fileUri(linksDir + '/' + name) : 'file:' + name;
            inner = `\n\t\t\t<Image Self="${id()}" ItemTransform="${f2(sx)} 0 0 ${f2(sy)} ${f2(tx)} ${f2(ty)}" AppliedObjectStyle="ObjectStyle/$ID/[None]">\n\t\t\t\t<Properties><Profile type="string">$ID/Embedded</Profile><GraphicBounds Left="0" Top="0" Right="${info.w}" Bottom="${info.h}"/></Properties>\n\t\t\t\t<Link Self="${id()}" AssetURL="$ID/" AssetID="$ID/" LinkResourceURI="${xe(uri)}" LinkResourceFormat="$ID/${info.ext === 'jpg' ? 'JPEG' : info.ext.toUpperCase()}" StoredState="Normal" LinkClassID="35906" LinkClientID="257" LinkResourceModified="false" LinkObjectModified="false" ShowInUI="true" CanEmbed="true" CanUnembed="true" CanPackage="true" ImportPolicy="NoAutoImport" ExportPolicy="NoAutoExport" LinkImportStamp="" LinkImportModificationTime="2026-01-01T00:00:00" LinkImportTime="2026-01-01T00:00:00"/>\n\t\t\t</Image>`;
          }
        }
        const shape = it.type === 'frame' && it.shape === 'ellipse' ? 'Oval' : 'Rectangle';
        return `\t\t<${shape} Self="${id()}" ContentType="GraphicType" ItemLayer="${lay}" ItemTransform="${tf}"${paint} AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]">\n\t\t\t<Properties>${shape === 'Oval' ? ellipsePath(b.w, b.h) : path4(b.w, b.h)}</Properties>${wrap}${inner}\n\t\t</${shape}>\n`;
      }
      if (it.type === 'rect' || it.type === 'frame') return `\t\t<Rectangle Self="${id()}" ContentType="Unassigned" ItemLayer="${lay}" ItemTransform="${tf}"${paint}${it.radius ? ` CornerRadius="${f2(it.radius)}" CornerOption="RoundedCorner"` : ''} AppliedObjectStyle="ObjectStyle/$ID/[None]">\n\t\t\t<Properties>${path4(b.w, b.h)}</Properties>${wrap}\n\t\t</Rectangle>\n`;
      if (it.type === 'ellipse') return `\t\t<Oval Self="${id()}" ContentType="Unassigned" ItemLayer="${lay}" ItemTransform="${tf}"${paint} AppliedObjectStyle="ObjectStyle/$ID/[None]">\n\t\t\t<Properties>${ellipsePath(b.w, b.h)}</Properties>${wrap}\n\t\t</Oval>\n`;
      if (it.type === 'polygon') return `\t\t<Polygon Self="${id()}" ContentType="Unassigned" ItemLayer="${lay}" ItemTransform="${tf}"${paint} AppliedObjectStyle="ObjectStyle/$ID/[None]">\n\t\t\t<Properties>${polyPath(it, b.w, b.h)}</Properties>${wrap}\n\t\t</Polygon>\n`;
      return '';
    }
    const marginXml = (side, cols, gutter) => {
      const m = BV.pageMargins(doc, side);
      const inner = W - m.left - m.right;
      const cw = (inner - gutter * (cols - 1)) / cols;
      const pos = [];
      for (let i = 0; i < cols; i++) pos.push(f2(i * (cw + gutter)), f2(i * (cw + gutter) + cw));
      return `<MarginPreference ColumnCount="${cols}" ColumnGutter="${f2(gutter)}" Top="${f2(m.top)}" Bottom="${f2(m.bottom)}" Left="${f2(m.left)}" Right="${f2(m.right)}" ColumnDirection="Horizontal" ColumnsPositions="${pos.join(' ')}"/>`;
    };
    const pageX = (side) => (facing ? (side === 'L' ? -W : 0) : 0);

    // ---------- master spreads
    const masterSelf = {};
    const masterList = [{ id: '', name: 'Master' }, ...(doc.masters || [])];
    const prefixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const masterFiles = [];
    for (let mi = 0; mi < masterList.length; mi++) {
      const m = masterList[mi];
      const self = id();
      masterSelf[m.id] = self;
      const sides = facing ? ['L', 'R'] : ['R'];
      let pages = '', items = '';
      for (const side of sides) {
        const cols = m.columns || doc.setup.columns, gut = m.gutter ?? doc.setup.gutter;
        pages += `\t\t<Page Self="${id()}" Name="${prefixes[mi % 26]}" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" OverrideList="" AppliedMaster="n" MasterPageTransform="1 0 0 1 0 0" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true" GeometricBounds="0 0 ${f2(H)} ${f2(W)}" ItemTransform="1 0 0 1 ${f2(pageX(side))} ${f2(-H / 2)}">\n\t\t\t<Properties><PageColor type="enumeration">UseMasterColor</PageColor></Properties>\n\t\t\t${marginXml(side, cols, gut)}\n\t\t</Page>\n`;
        for (const it of BV.itemsOnPage(doc, BV.masterRef(m.id, side), true)) items += await itemXml(it, pageX(side), -H / 2);
      }
      const name = m.name || 'Master';
      files[`MasterSpreads/MasterSpread_${self}.xml`] = AID('snippet') + `<idPkg:MasterSpread ${PKG} DOMVersion="${DOM}">\n\t<MasterSpread Self="${self}" ItemTransform="1 0 0 1 0 0" OverriddenPageItemProps="" PrimaryTextFrame="n" NamePrefix="${prefixes[mi % 26]}" BaseName="${xe(name)}" ShowMasterItems="true" PageCount="${sides.length}" Name="${xe(prefixes[mi % 26] + '-' + name)}">\n${pages}${items}\t</MasterSpread>\n</idPkg:MasterSpread>\n`;
      masterFiles.push(self);
    }

    // ---------- spreads
    const spreadFiles = [];
    let firstPageSelf = null;
    for (const sp of BV.spreads(doc)) {
      const self = id();
      let pages = '', items = '';
      for (const idx of sp) {
        const page = doc.pages[idx];
        const side = BV.pageSide(doc, idx);
        const pself = id();
        if (!firstPageSelf) firstPageSelf = pself;
        const mid = BV.pageMasterId(doc, page);
        const am = mid === null ? 'n' : masterSelf[mid] || masterSelf[''];
        const mstr = BV.masterById(doc, mid);
        const cols = page.columns || (mstr && mstr.columns) || doc.setup.columns, gut = page.gutter ?? (mstr && mstr.gutter) ?? doc.setup.gutter;
        const ox = facing ? pageX(side) : 0;
        pages += `\t\t<Page Self="${pself}" Name="${xe(BV.pageLabel(doc, idx))}" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" OverrideList="" AppliedMaster="${am}" MasterPageTransform="1 0 0 1 0 0" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true" GeometricBounds="0 0 ${f2(H)} ${f2(W)}" ItemTransform="1 0 0 1 ${f2(ox)} ${f2(-H / 2)}">\n\t\t\t<Properties><PageColor type="enumeration">UseMasterColor</PageColor></Properties>\n\t\t\t${marginXml(side, cols, gut)}\n\t\t</Page>\n`;
        for (const it of BV.itemsOnPage(doc, page.id, true)) items += await itemXml(it, ox, -H / 2);
      }
      const binding = facing ? (sp.length === 2 ? 1 : BV.pageSide(doc, sp[0]) === 'L' ? 1 : 0) : 0;
      files[`Spreads/Spread_${self}.xml`] = AID('snippet') + `<idPkg:Spread ${PKG} DOMVersion="${DOM}">\n\t<Spread Self="${self}" PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" ShowMasterItems="true" PageCount="${sp.length}" BindingLocation="${binding}" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 0" FlattenerOverride="Default">\n${pages}${items}\t</Spread>\n</idPkg:Spread>\n`;
      spreadFiles.push(self);
    }

    // ---------- resources
    files['Resources/Graphic.xml'] = AID('snippet') + `<idPkg:Graphic ${PKG} DOMVersion="${DOM}">
	<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
	<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
	<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" ColorOverride="Specialregistration" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
${colorXml}	<Ink Self="Ink/$ID/Process Cyan" Name="$ID/Process Cyan" Angle="75" ConvertToProcess="false" Frequency="70" NeutralDensity="0.61" PrintInk="true" TrapOrder="1" InkType="Normal"/>
	<Ink Self="Ink/$ID/Process Magenta" Name="$ID/Process Magenta" Angle="15" ConvertToProcess="false" Frequency="70" NeutralDensity="0.76" PrintInk="true" TrapOrder="2" InkType="Normal"/>
	<Ink Self="Ink/$ID/Process Yellow" Name="$ID/Process Yellow" Angle="0" ConvertToProcess="false" Frequency="70" NeutralDensity="0.16" PrintInk="true" TrapOrder="3" InkType="Normal"/>
	<Ink Self="Ink/$ID/Process Black" Name="$ID/Process Black" Angle="45" ConvertToProcess="false" Frequency="70" NeutralDensity="1.7" PrintInk="true" TrapOrder="4" InkType="Normal"/>
	<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>
	<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>
	<StrokeStyle Self="StrokeStyle/$ID/Dashed" Name="$ID/Dashed"/>
	<StrokeStyle Self="StrokeStyle/$ID/Dotted" Name="$ID/Dotted"/>
</idPkg:Graphic>
`;
    let fontXml = '';
    for (const [f, fid] of fonts) fontXml += `\t<FontFamily Self="di${fid}" Name="${xe(f)}">\n\t\t<Font Self="di${fid}Font${fid}" FontFamily="${xe(f)}" Name="${xe(f)}" PostScriptName="${xe(f.replace(/\s+/g, ''))}" Status="Installed" FontStyleName="Regular" FontType="OpenTypeTT" WritingScript="0" FullName="${xe(f)}" FullNameNative="${xe(f)}" FontStyleNameNative="Regular" PlatformName="$ID/" Version=""/>\n\t</FontFamily>\n`;
    files['Resources/Fonts.xml'] = AID('snippet') + `<idPkg:Fonts ${PKG} DOMVersion="${DOM}">\n${fontXml}</idPkg:Fonts>\n`;
    files['Resources/Styles.xml'] = AID('snippet') + `<idPkg:Styles ${PKG} DOMVersion="${DOM}">
	<RootCharacterStyleGroup Self="${id()}">
		<CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" Name="$ID/[No character style]"/>
	</RootCharacterStyleGroup>
	<RootParagraphStyleGroup Self="${id()}">
		<ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" NextStyle="ParagraphStyle/$ID/[No paragraph style]" KeyboardShortcut="0 0" PointSize="12" Justification="LeftAlign" Composer="$ID/HL Composer Optyca">
			<Properties><AppliedFont type="string">Minion Pro</AppliedFont><Leading type="enumeration">Auto</Leading></Properties>
		</ParagraphStyle>
		<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" Imported="false" NextStyle="ParagraphStyle/$ID/NormalParagraphStyle" KeyboardShortcut="0 0">
			<Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><PreviewColor type="enumeration">Nothing</PreviewColor></Properties>
		</ParagraphStyle>
${pstyleXml}	</RootParagraphStyleGroup>
	<RootCellStyleGroup Self="${id()}">
		<CellStyle Self="CellStyle/$ID/[None]" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[None]"/>
	</RootCellStyleGroup>
	<RootTableStyleGroup Self="${id()}">
		<TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/>
		<TableStyle Self="TableStyle/$ID/[Basic Table]" Name="$ID/[Basic Table]"/>
	</RootTableStyleGroup>
	<RootObjectStyleGroup Self="${id()}">
		<ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" FillColor="Swatch/None" StrokeWeight="0" StrokeColor="Swatch/None"/>
		<ObjectStyle Self="ObjectStyle/$ID/[Normal Graphics Frame]" Name="$ID/[Normal Graphics Frame]" AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle" FillColor="Swatch/None" StrokeWeight="1" StrokeColor="Swatch/None">
			<Properties><BasedOn type="object">ObjectStyle/$ID/[None]</BasedOn></Properties>
		</ObjectStyle>
		<ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]" Name="$ID/[Normal Text Frame]" AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle" FillColor="Swatch/None" StrokeWeight="1" StrokeColor="Swatch/None">
			<Properties><BasedOn type="object">ObjectStyle/$ID/[None]</BasedOn></Properties>
		</ObjectStyle>
	</RootObjectStyleGroup>
</idPkg:Styles>
`;
    const m = doc.setup.margins;
    files['Resources/Preferences.xml'] = AID('snippet') + `<idPkg:Preferences ${PKG} DOMVersion="${DOM}">
	<DocumentPreference PageHeight="${f2(H)}" PageWidth="${f2(W)}" PagesPerDocument="${doc.pages.length}" FacingPages="${facing}" DocumentBleedTopOffset="0" DocumentBleedBottomOffset="0" DocumentBleedInsideOrLeftOffset="0" DocumentBleedOutsideOrRightOffset="0" DocumentBleedUniformSize="true" SlugTopOffset="0" SlugBottomOffset="0" SlugInsideOrLeftOffset="0" SlugRightOrOutsideOffset="0" DocumentSlugUniformSize="false" PreserveLayoutWhenShuffling="true" AllowPageShuffle="true" OverprintBlack="true" PageBinding="LeftToRight" ColumnDirection="Horizontal" ColumnGuideLocked="true" MasterTextFrame="false" SnippetImportUsesOriginalLocation="false" Intent="PrintIntent">
		<Properties><ColumnGuideColor type="enumeration">Violet</ColumnGuideColor><MarginGuideColor type="enumeration">Magenta</MarginGuideColor></Properties>
	</DocumentPreference>
	<MarginPreference ColumnCount="${doc.setup.columns}" ColumnGutter="${f2(doc.setup.gutter)}" Top="${f2(m.top)}" Bottom="${f2(m.bottom)}" Left="${f2(m.inside)}" Right="${f2(m.outside)}" ColumnDirection="Horizontal" ColumnsPositions="0 ${f2(W - m.inside - m.outside)}"/>
	<TextDefault AppliedFont="Minion Pro" PointSize="12" Composer="$ID/HL Composer Optyca"/>
	<ViewPreference HorizontalMeasurementUnits="Millimeters" VerticalMeasurementUnits="Millimeters"/>
</idPkg:Preferences>
`;
    files['META-INF/container.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">\n\t<rootfiles>\n\t\t<rootfile full-path="designmap.xml" media-type="text/xml"/>\n\t</rootfiles>\n</container>\n`;
    files['XML/Tags.xml'] = AID('snippet') + `<idPkg:Tags ${PKG} DOMVersion="${DOM}">\n\t<XMLTag Self="XMLTag/Root" Name="Root"><Properties><TagColor type="enumeration">LightBlue</TagColor></Properties></XMLTag>\n</idPkg:Tags>\n`;
    files['XML/BackingStory.xml'] = AID('snippet') + `<idPkg:BackingStory ${PKG} DOMVersion="${DOM}">\n\t<XmlStory Self="${id()}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">\n\t\t<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"/></ParagraphStyleRange>\n\t</XmlStory>\n</idPkg:BackingStory>\n`;
    const layerXml = (doc.layers || []).slice().reverse().map((l) => `\t<Layer Self="${layerSelf[l.id]}" Name="${xe(l.name)}" Visible="${l.visible !== false}" Locked="${!!l.locked}" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"><Properties><LayerColor type="enumeration">LightBlue</LayerColor></Properties></Layer>\n`).join('');
    const numStyle = { roman: 'LowerRoman', ROMAN: 'UpperRoman', alpha: 'LowerLetters', ALPHA: 'UpperLetters' }[doc.setup.numbering] || 'Arabic';
    files['designmap.xml'] = AID('document') + `<Document ${PKG} DOMVersion="${DOM}" Self="d" StoryList="${storyFiles.join(' ')}" Name="${xe(opts.name || 'Publication')}" ZeroPoint="0 0" ActiveLayer="${layerSelf[doc.activeLayer] || Object.values(layerSelf)[0]}" CMYKProfile="$ID/" RGBProfile="$ID/" SolidColorIntent="UseColorSettings" AfterBlendingIntent="UseColorSettings" DefaultImageIntent="UseColorSettings" RGBPolicy="PreserveEmbeddedProfiles" CMYKPolicy="CombinationOfPreserveAndSafeCmyk" AccurateLABSpots="false">
	<Language Self="Language/$ID/English%3a USA" Name="$ID/English: USA" SingleQuotes="‘’" DoubleQuotes="“”" PrimaryLanguageName="$ID/English" SublanguageName="$ID/USA" Id="269" HyphenationVendor="Hunspell" SpellingVendor="Hunspell"/>
	<idPkg:Graphic src="Resources/Graphic.xml"/>
	<idPkg:Fonts src="Resources/Fonts.xml"/>
	<idPkg:Styles src="Resources/Styles.xml"/>
	<idPkg:Preferences src="Resources/Preferences.xml"/>
	<idPkg:Tags src="XML/Tags.xml"/>
${layerXml}${masterFiles.map((s) => `\t<idPkg:MasterSpread src="MasterSpreads/MasterSpread_${s}.xml"/>\n`).join('')}${spreadFiles.map((s) => `\t<idPkg:Spread src="Spreads/Spread_${s}.xml"/>\n`).join('')}	<Section Self="${id()}" Length="${doc.pages.length}" Name="" ContinueNumbering="false" IncludeSectionPrefix="false" PageNumberStyle="${numStyle}" PageStart="${firstPageSelf}" SectionPrefix="" PageNumberStart="${doc.setup.startPage || 1}" Marker=""/>
	<idPkg:BackingStory src="XML/BackingStory.xml"/>
${storyFiles.map((s) => `\t<idPkg:Story src="Stories/Story_${s}.xml"/>\n`).join('')}</Document>
`;
    return { files, images };
  }

  BV.IDML = { toDoc, fromDoc };
})();
