/* BV Mudrana: document model: pages, masters, items, stories, styles. All lengths in points. */
(function () {
  const BV = (window.BV = window.BV || {});

  BV.UNITS = { mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12, pt: 1 };
  BV.UNIT_LABEL = { mm: 'mm', cm: 'cm', in: 'in', pc: 'picas', pt: 'pt' };
  BV.toPt = (v, u) => v * BV.UNITS[u];
  BV.fromPt = (v, u) => v / BV.UNITS[u];
  BV.fmt = (v, u) => {
    const x = BV.fromPt(v, u);
    return String(Math.round(x * (u === 'mm' || u === 'pt' ? 10 : 1000)) / (u === 'mm' || u === 'pt' ? 10 : 1000));
  };

  // Common Indian book sizes (trimmed, mm) plus international sizes
  BV.PAGE_SIZES = [
    { name: 'Demy 1/8 (140 × 216 mm)', w: 140, h: 216 },
    { name: 'Crown 1/8 (121 × 181 mm)', w: 121, h: 181 },
    { name: 'Crown 1/4 (184 × 241 mm)', w: 184, h: 241 },
    { name: 'Royal 1/8 (159 × 241 mm)', w: 159, h: 241 },
    { name: 'Demy 1/4 (216 × 280 mm)', w: 216, h: 280 },
    { name: 'A4 (210 × 297 mm)', w: 210, h: 297 },
    { name: 'A5 (148 × 210 mm)', w: 148, h: 210 },
    { name: 'B5 (176 × 250 mm)', w: 176, h: 250 },
    { name: 'Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
    { name: '6 × 9 in', w: 152.4, h: 228.6 },
  ];

  BV.PAGE_MARKER = '\uE000'; // auto page-number marker (shown as the page number)
  BV.SOFT_BREAK = '\u2028';

  // Fonts that come bundled with the app (work on every computer)
  BV.BUNDLED_FONTS = ['Noto Serif Kannada', 'Noto Sans Kannada', 'Noto Serif Devanagari', 'Noto Sans Devanagari', 'Noto Serif', 'Praja Unicode', 'Praja Unicode Demi', 'Praja Unicode Light', 'Praja01', 'Praja02', 'Praja03', 'Praja04', 'Praja05', 'Praja06', 'Praja07', 'Praja08', 'BVChitkala', 'BVChitkala Hindi', 'BVChitkala Hindi Heavy', 'BVChitkala Math', 'BVNanda', 'BVMatanga'];
  // Always appended so mixed-script text never shows boxes
  BV.FALLBACK_FONTS = ['Noto Serif Kannada', 'Noto Serif Devanagari', 'Noto Serif'];

  BV.defaultStyles = () => ({
    'Body text': { font: 'Noto Serif Kannada', size: 11, leading: 17, align: 'justify', firstIndent: 18, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 0, color: '#000000', bold: false, italic: false, next: '', breakBefore: false },
    'Body first': { font: 'Noto Serif Kannada', size: 11, leading: 17, align: 'justify', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 0, color: '#000000', bold: false, italic: false, next: 'Body text', breakBefore: false },
    'Chapter title': { font: 'Noto Serif Kannada', size: 22, leading: 30, align: 'center', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 48, spaceAfter: 24, color: '#000000', bold: true, italic: false, next: 'Body first', keepNext: true, breakBefore: true },
    'Heading 2': { font: 'Noto Serif Kannada', size: 14, leading: 20, align: 'left', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 14, spaceAfter: 6, color: '#000000', bold: true, italic: false, next: 'Body first', keepNext: true, breakBefore: false },
    'Shloka': { font: 'Noto Serif Devanagari', size: 12.5, leading: 21, align: 'center', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 8, spaceAfter: 2, color: '#000000', bold: false, italic: false, next: 'IAST', keepNext: true, breakBefore: false },
    'Shloka (Kannada)': { font: 'Noto Serif Kannada', size: 12, leading: 20, align: 'center', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 8, spaceAfter: 2, color: '#000000', bold: false, italic: false, next: 'IAST', keepNext: true, breakBefore: false },
    'IAST': { font: 'Noto Serif', size: 10.5, leading: 15, align: 'center', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 8, color: '#000000', bold: false, italic: true, next: 'Body text', breakBefore: false },
    'Translation': { font: 'Noto Serif Kannada', size: 10.5, leading: 16, align: 'justify', firstIndent: 0, leftIndent: 18, rightIndent: 18, spaceBefore: 0, spaceAfter: 10, color: '#000000', bold: false, italic: false, next: 'Body text', breakBefore: false },
    'Footnote': { font: 'Noto Serif Kannada', size: 8.5, leading: 12, align: 'justify', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 2, color: '#000000', bold: false, italic: false, next: '', breakBefore: false },
    'Running head': { font: 'Noto Serif Kannada', size: 8.5, leading: 12, align: 'center', firstIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 0, color: '#000000', bold: false, italic: false, next: '', breakBefore: false },
  });

  // PageMaker's default colour list
  BV.defaultColors = () => [
    { name: 'Registration', hex: '#000000', fixed: true },
    { name: 'Paper', hex: '#ffffff', fixed: true },
    { name: 'Black', hex: '#000000', fixed: true },
    { name: 'Blue', hex: '#0000ff' }, { name: 'Cyan', hex: '#00a0e9' }, { name: 'Green', hex: '#00a650' },
    { name: 'Magenta', hex: '#e4007f' }, { name: 'Red', hex: '#e60012' }, { name: 'Yellow', hex: '#fff100' },
  ];

  BV.PARA_KEYS = ['keepNext', 'align', 'firstIndent', 'leftIndent', 'rightIndent', 'spaceBefore', 'spaceAfter', 'leading', 'breakBefore',
    'pageBreak', 'keepTogether', 'keepWith', 'widow', 'orphan', 'toc', 'ruleAbove', 'ruleBelow', 'dropCap', 'hyphenate', 'tabs'];
  BV.CHAR_KEYS = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'caps', 'color', 'shift', 'track', 'width', 'pos', 'smallCaps', 'reverse', 'tint', 'outline', 'shadow'];
  // PageMaker's Type Options defaults
  BV.TYPE_OPTIONS = { smallCapsSize: 70, superSize: 58.3, superPos: 33.3, subSize: 58.3, subPos: 33.3 };

  BV.newDocument = function (opt = {}) {
    const mm = BV.UNITS.mm;
    const setup = Object.assign(
      {
        w: 140 * mm, h: 216 * mm,
        margins: { top: 16 * mm, bottom: 20 * mm, inside: 18 * mm, outside: 14 * mm },
        doubleSided: true, facing: true, startPage: 1, pageCount: 1,
        columns: 1, gutter: 5 * mm, numbering: 'arabic', units: 'mm',
      },
      opt
    );
    const doc = {
      format: 'bv-mudrana', version: 1,
      setup,
      pages: [],
      masterGuides: { L: { h: [], v: [] }, R: { h: [], v: [] } },
      items: {},
      stories: {},
      styles: BV.defaultStyles(),
      colors: BV.defaultColors(),
      layers: [{ id: 'L1', name: 'Default', visible: true, locked: false, color: '#4a6cf7' }],
      activeLayer: 'L1',
      masters: [],
      index: {},
      hyperlinks: [],
      nextId: 1,
    };
    for (let i = 0; i < setup.pageCount; i++) doc.pages.push(BV.newPage(doc));
    delete setup.pageCount;
    return doc;
  };

  BV.newId = (doc, prefix) => prefix + doc.nextId++;
  BV.newPage = (doc) => ({ id: BV.newId(doc, 'p'), guides: { h: [], v: [] }, columns: null, gutter: null, master: true });

  BV.newStory = function (doc, style = 'Body text') {
    const id = BV.newId(doc, 's');
    doc.stories[id] = { id, paras: [{ style, runs: [{ t: '' }] }], frames: [] };
    return doc.stories[id];
  };

  BV.newItem = function (doc, type, page, x, y, w, h, extra = {}) {
    const id = BV.newId(doc, 'i');
    const it = Object.assign({ id, type, page, x, y, w, h, stroke: '#000000', strokeWidth: 0.5, fill: 'none', layer: doc.activeLayer || 'L1' }, extra);
    doc.items[id] = it;
    return it;
  };

  // ---- page geometry ---------------------------------------------------------------
  BV.pageNumber = (doc, idx) => doc.setup.startPage + idx;
  BV.pageSide = (doc, idx) => {
    if (!doc.setup.doubleSided) return 'R';
    return BV.pageNumber(doc, idx) % 2 === 1 ? 'R' : 'L';
  };
  BV.pageLabel = (doc, idx) => BV.translit.numerals(BV.pageNumber(doc, idx), doc.setup.numbering);

  // margins in page coordinates for a side ('L' | 'R')
  BV.pageMargins = (doc, side) => {
    const m = doc.setup.margins;
    const left = side === 'L' ? m.outside : m.inside;
    const right = side === 'L' ? m.inside : m.outside;
    return { left, right, top: m.top, bottom: m.bottom };
  };
  // ---- master pages: the Document Master uses refs ML/MR; named masters use M<id>L / M<id>R
  BV.masterRef = (id, side) => 'M' + (id || '') + side;
  BV.masterIdOfRef = (ref) => String(ref).slice(1, -1);
  BV.isMasterRef = (ref) => /^M/.test(String(ref));
  BV.masterById = (doc, id) => (id ? (doc.masters || []).find((m) => m.id === id) : null);
  BV.masterName = (doc, id) => (id ? (BV.masterById(doc, id) || {}).name || 'Master' : 'Document Master');
  BV.pageMasterId = (doc, page) => (page.master === false ? null : page.masterId && BV.masterById(doc, page.masterId) ? page.masterId : '');
  BV.masterRefFor = (doc, page, side) => { const id = BV.pageMasterId(doc, page); return id === null ? null : BV.masterRef(id, side); };
  BV.pageColumns = (doc, pageRef) => {
    let side, cols = doc.setup.columns, gutter = doc.setup.gutter;
    if (BV.isMasterRef(pageRef)) {
      side = String(pageRef).slice(-1);
      const m = BV.masterById(doc, BV.masterIdOfRef(pageRef));
      if (m && m.columns) { cols = m.columns; gutter = m.gutter ?? gutter; }
    } else {
      const idx = doc.pages.findIndex((p) => p.id === pageRef);
      side = BV.pageSide(doc, idx);
      const p = doc.pages[idx];
      const m = p && BV.masterById(doc, p.masterId);
      if (p && p.columns) { cols = p.columns; gutter = p.gutter ?? gutter; }
      else if (m && m.columns && p.master !== false) { cols = m.columns; gutter = m.gutter ?? gutter; }
    }
    const m = BV.pageMargins(doc, side);
    const W = doc.setup.w - m.left - m.right;
    const colW = (W - gutter * (cols - 1)) / cols;
    const out = [];
    for (let c = 0; c < cols; c++) out.push({ x: m.left + c * (colW + gutter), y: m.top, w: colW, h: doc.setup.h - m.top - m.bottom });
    return out;
  };

  // Spreads: arrays of page indexes. Page 1 (odd) stands alone on the right.
  BV.spreads = function (doc) {
    const n = doc.pages.length;
    const out = [];
    if (!(doc.setup.doubleSided && doc.setup.facing)) {
      for (let i = 0; i < n; i++) out.push([i]);
      return out;
    }
    let i = 0;
    if (BV.pageSide(doc, 0) === 'R') { out.push([0]); i = 1; }
    for (; i < n; i += 2) out.push(i + 1 < n ? [i, i + 1] : [i]);
    return out;
  };
  BV.spreadOfPage = (doc, idx) => BV.spreads(doc).findIndex((s) => s.includes(idx));
  // x-offset of page within its spread
  BV.pageOffsetX = function (doc, idx) {
    if (!(doc.setup.doubleSided && doc.setup.facing)) return 0;
    return BV.pageSide(doc, idx) === 'L' ? 0 : doc.setup.w;
  };
  BV.spreadWidth = (doc) => (doc.setup.doubleSided && doc.setup.facing ? doc.setup.w * 2 : doc.setup.w);

  // items on a page in drawing order: layer order first, then stacking order
  BV.itemsOnPage = (doc, pageRef, includeHidden) => {
    const order = {};
    (doc.layers || []).forEach((l, i) => (order[l.id] = i));
    const vis = {};
    (doc.layers || []).forEach((l) => (vis[l.id] = l.visible !== false));
    return Object.values(doc.items)
      .filter((it) => it.page === pageRef && (includeHidden || vis[it.layer || 'L1'] !== false))
      .sort((a, b) => (order[a.layer || 'L1'] || 0) - (order[b.layer || 'L1'] || 0) || (a.z || 0) - (b.z || 0));
  };
  BV.layerOf = (doc, it) => (doc.layers || []).find((l) => l.id === (it.layer || 'L1')) || { locked: false, visible: true };

  // ---- styles ---------------------------------------------------------------------
  BV.paraProps = function (doc, para) {
    const st = doc.styles[para.style] || doc.styles['Body text'] || Object.values(doc.styles)[0];
    return Object.assign({}, st, para.ov || {});
  };
  BV.charProps = function (pp, run) {
    return {
      font: run.font || pp.font,
      size: run.size || pp.size,
      bold: run.bold !== undefined ? run.bold : pp.bold,
      italic: run.italic !== undefined ? run.italic : pp.italic,
      underline: !!run.underline,
      strike: !!run.strike,
      caps: run.caps !== undefined ? !!run.caps : !!pp.caps,
      color: run.color || pp.color,
      shift: run.shift || 0,
      track: run.track !== undefined ? run.track : pp.track || 0, // em
      width: run.width || pp.width || 100, // % horizontal scale
      pos: run.pos || null,
      smallCaps: !!run.smallCaps,
      reverse: !!run.reverse,
      tint: run.tint || 100,
      outline: !!run.outline,
      shadow: !!run.shadow,
      link: run.link || null,
    };
  };
  // superscript / subscript as PageMaker does it: 58% size, raised 33% / lowered 33%
  const _charProps = BV.charProps;
  BV.charProps = function (pp, run) {
    const cp = _charProps(pp, run);
    if (cp.reverse) cp.color = '#ffffff';
    else if (cp.tint < 100 && /^#[0-9a-f]{6}$/i.test(cp.color || '')) {
      const t = cp.tint / 100;
      cp.color = '#' + [1, 3, 5].map((k) => Math.round(parseInt(cp.color.slice(k, k + 2), 16) * t + 255 * (1 - t)).toString(16).padStart(2, '0')).join('');
    }
    if (cp.pos === 'sup') { cp.shift = (cp.shift || 0) + cp.size * 0.33; cp.size = cp.size * 0.583; }
    else if (cp.pos === 'sub') { cp.shift = (cp.shift || 0) - cp.size * 0.2; cp.size = cp.size * 0.583; }
    return cp;
  };
  // Nudi/Baraha ASCII fonts share one encoding, so a missing one is drawn with another installed Nudi font
  BV.NUDI_FONTS = [];
  BV.fontFamilyList = (font) => {
    const legacy = /^(nudi|baraha|brh|praja\s*0[1-8]$)/i.test(font || '') ? BV.NUDI_FONTS.filter((f) => f !== font) : [];
    const list = [font, ...legacy, ...BV.FALLBACK_FONTS.filter((f) => f !== font)];
    return list.map((f) => `"${f}"`).join(', ') + ', serif';
  };
  BV.cssFont = (cp) => `${cp.italic ? 'italic ' : ''}${cp.smallCaps ? 'small-caps ' : ''}${cp.bold ? 'bold ' : ''}${cp.size}px ${BV.fontFamilyList(cp.font)}`;

  // ---- serialization ------------------------------------------------------------
  BV.serialize = (doc) => JSON.stringify(doc);
  BV.deserialize = function (str) {
    const doc = JSON.parse(str);
    if (doc.format !== 'bv-mudrana') throw new Error('This is not a BV Mudrana document.');
    doc.masterGuides = doc.masterGuides || { L: { h: [], v: [] }, R: { h: [], v: [] } };
    doc.colors = doc.colors || BV.defaultColors();
    doc.layers = doc.layers || [{ id: 'L1', name: 'Default', visible: true, locked: false, color: '#4a6cf7' }];
    doc.activeLayer = doc.activeLayer || doc.layers[0].id;
    doc.masters = doc.masters || [];
    doc.index = doc.index || {};
    doc.hyperlinks = doc.hyperlinks || [];
    return doc;
  };
})();
