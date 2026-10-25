/* BV Mudrana: features from Scribus (and PageMaker's Table Editor) added to the PageMaker layout:
   Pages and Outline palette, Align & Distribute palette, Glyphs palette, tables, PDF export with bleed and
   printer's marks, gradient fills and transparency, character styles, insert special characters, sample text,
   baseline grid, duplicate, eyedropper colour, document information. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text, UI = BV.UI;
  const $ = (id) => document.getElementById(id);
  const doc = () => App.doc;
  const esc = BV.Render.esc;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const selItems = () => (App.sel.kind === 'items' ? App.sel.ids.map((id) => doc().items[id]).filter(Boolean) : []);
  const U = () => doc().setup.units;
  const UL = () => BV.UNIT_LABEL[U()];
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;
  const icon = (k) => App.tbIcon(k);
  const docBase = () => App.docName || (App.filePath ? App.filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'Publication');

  // extra icons for the new palettes
  const SVG = (d) => `<svg viewBox="0 0 20 20">${d}</svg>`;
  const AL = {
    left: SVG('<path d="M3 2.5v15"/><rect x="5" y="4.5" width="10" height="4" rx=".6"/><rect x="5" y="11.5" width="6" height="4" rx=".6"/>'),
    hcenter: SVG('<path d="M10 2.5v15"/><rect x="4" y="4.5" width="12" height="4" rx=".6"/><rect x="6.5" y="11.5" width="7" height="4" rx=".6"/>'),
    right: SVG('<path d="M17 2.5v15"/><rect x="5" y="4.5" width="10" height="4" rx=".6"/><rect x="9" y="11.5" width="6" height="4" rx=".6"/>'),
    top: SVG('<path d="M2.5 3h15"/><rect x="4.5" y="5" width="4" height="10" rx=".6"/><rect x="11.5" y="5" width="4" height="6" rx=".6"/>'),
    vcenter: SVG('<path d="M2.5 10h15"/><rect x="4.5" y="4" width="4" height="12" rx=".6"/><rect x="11.5" y="6.5" width="4" height="7" rx=".6"/>'),
    bottom: SVG('<path d="M2.5 17h15"/><rect x="4.5" y="5" width="4" height="10" rx=".6"/><rect x="11.5" y="9" width="4" height="6" rx=".6"/>'),
    hdist: SVG('<path d="M2.5 3v14M17.5 3v14"/><rect x="5" y="6" width="3.5" height="8" rx=".6"/><rect x="11.5" y="6" width="3.5" height="8" rx=".6"/>'),
    vdist: SVG('<path d="M3 2.5h14M3 17.5h14"/><rect x="6" y="5" width="8" height="3.5" rx=".6"/><rect x="6" y="11.5" width="8" height="3.5" rx=".6"/>'),
    hspace: SVG('<rect x="2.5" y="6" width="3.5" height="8" rx=".6"/><rect x="8.25" y="6" width="3.5" height="8" rx=".6"/><rect x="14" y="6" width="3.5" height="8" rx=".6"/><path d="M6 10h2.2M11.8 10H14" stroke-dasharray="1 1"/>'),
    vspace: SVG('<rect x="6" y="2.5" width="8" height="3.5" rx=".6"/><rect x="6" y="8.25" width="8" height="3.5" rx=".6"/><rect x="6" y="14" width="8" height="3.5" rx=".6"/>'),
    samew: SVG('<rect x="3" y="4" width="14" height="4" rx=".6"/><rect x="3" y="12" width="14" height="4" rx=".6"/>'),
    sameh: SVG('<rect x="4" y="3" width="4" height="14" rx=".6"/><rect x="12" y="3" width="4" height="14" rx=".6"/>'),
  };

  // ------------------------------------------------------------------ Align & Distribute palette
  App.alignTo = function (how, rel) {
    const its = selItems().filter((i) => !i.locked);
    if (!its.length || (its.length < 2 && rel === 'sel')) return UI.status(its.length ? 'Choose “Page” or “Margins” to align one object, or select more objects.' : 'Select objects first.');
    App.checkpoint();
    const boxes = its.map((it) => ({ it, b: BV.Render.box(it) }));
    let B = App.selBounds(its);
    if (rel === 'page' || rel === 'margins') {
      const pl = App.itemPlacement(its[0]);
      const side = pl ? pl.side : 'R';
      const m = rel === 'margins' ? BV.pageMargins(doc(), side) : { left: 0, right: 0, top: 0, bottom: 0 };
      B = { x: m.left, y: m.top, w: doc().setup.w - m.left - m.right, h: doc().setup.h - m.top - m.bottom };
    } else if (rel === 'first') { B = boxes[0].b; }
    const mv = (it, dx, dy) => { it.x += dx; it.y += dy; };
    const sorted = (k) => boxes.slice().sort((a, b) => a.b[k] - b.b[k]);
    switch (how) {
      case 'left': boxes.forEach(({ it, b }) => mv(it, B.x - b.x, 0)); break;
      case 'hcenter': boxes.forEach(({ it, b }) => mv(it, B.x + B.w / 2 - b.x - b.w / 2, 0)); break;
      case 'right': boxes.forEach(({ it, b }) => mv(it, B.x + B.w - b.x - b.w, 0)); break;
      case 'top': boxes.forEach(({ it, b }) => mv(it, 0, B.y - b.y)); break;
      case 'vcenter': boxes.forEach(({ it, b }) => mv(it, 0, B.y + B.h / 2 - b.y - b.h / 2)); break;
      case 'bottom': boxes.forEach(({ it, b }) => mv(it, 0, B.y + B.h - b.y - b.h)); break;
      case 'hdist': { const s = sorted('x'); if (s.length < 3) break; const c0 = s[0].b.x + s[0].b.w / 2, c1 = s[s.length - 1].b.x + s[s.length - 1].b.w / 2; s.forEach(({ it, b }, k) => mv(it, c0 + ((c1 - c0) * k) / (s.length - 1) - b.x - b.w / 2, 0)); break; }
      case 'vdist': { const s = sorted('y'); if (s.length < 3) break; const c0 = s[0].b.y + s[0].b.h / 2, c1 = s[s.length - 1].b.y + s[s.length - 1].b.h / 2; s.forEach(({ it, b }, k) => mv(it, 0, c0 + ((c1 - c0) * k) / (s.length - 1) - b.y - b.h / 2)); break; }
      case 'hspace': { const s = sorted('x'); const gap = App.alignGap ?? null; const tot = s.reduce((a, x) => a + x.b.w, 0); const g = gap ?? (B.w - tot) / Math.max(1, s.length - 1); let x = s[0].b.x; s.forEach(({ it, b }) => { mv(it, x - b.x, 0); x += b.w + g; }); break; }
      case 'vspace': { const s = sorted('y'); const gap = App.alignGap ?? null; const tot = s.reduce((a, x) => a + x.b.h, 0); const g = gap ?? (B.h - tot) / Math.max(1, s.length - 1); let y = s[0].b.y; s.forEach(({ it, b }) => { mv(it, 0, y - b.y); y += b.h + g; }); break; }
      case 'samew': { const w = boxes[0].b.w; boxes.forEach(({ it }) => { if (it.type !== 'line') it.w = w; if (it.type === 'text') it.autoGrow = false; }); break; }
      case 'sameh': { const h = boxes[0].b.h; boxes.forEach(({ it }) => { if (it.type !== 'line') it.h = h; if (it.type === 'text') it.autoGrow = false; }); break; }
    }
    App.changed();
  };
  function buildAlign() {
    const body = $('pal-align').querySelector('.fp-body');
    const b = (k, t) => `<button class="mini al" data-al="${k}" title="${esc(t)}">${AL[k]}</button>`;
    body.innerHTML = `<div class="al-row"><span class="clabel">Relative to</span><select id="al-rel" class="fld"><option value="sel">Selection</option><option value="first">First selected</option><option value="margins">Margins</option><option value="page">Page</option></select></div>
      <div class="al-grp"><span class="clabel">Align</span><div class="al-btns">${b('left', 'Left edges')}${b('hcenter', 'Centres (horizontal)')}${b('right', 'Right edges')}${b('top', 'Top edges')}${b('vcenter', 'Centres (vertical)')}${b('bottom', 'Bottom edges')}</div></div>
      <div class="al-grp"><span class="clabel">Distribute</span><div class="al-btns">${b('hdist', 'Distribute centres horizontally')}${b('vdist', 'Distribute centres vertically')}${b('hspace', 'Equal spacing horizontally')}${b('vspace', 'Equal spacing vertically')}${b('samew', 'Same width as the first')}${b('sameh', 'Same height as the first')}</div></div>
      <div class="al-row"><label class="check"><input type="checkbox" id="al-gapon"> Fixed gap</label><input type="number" id="al-gap" class="num" step="any" value="0" disabled><span class="clabel" id="al-gapu"></span></div>`;
    body.querySelector('#al-gapon').onchange = (e) => { body.querySelector('#al-gap').disabled = !e.target.checked; };
    body.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-al]');
      if (!btn) return;
      App.alignGap = body.querySelector('#al-gapon').checked ? BV.toPt(parseFloat(body.querySelector('#al-gap').value) || 0, U()) : null;
      App.alignTo(btn.dataset.al, body.querySelector('#al-rel').value);
    });
  }

  // ------------------------------------------------------------------ Pages and Outline palette (Scribus: Arrange Pages / Outline)
  let pagesTimer = 0;
  function schedulePages() { clearTimeout(pagesTimer); pagesTimer = setTimeout(refreshPages, 250); }
  const thumbSVG = (i, H) => {
    const d = doc(), W = d.setup.w, Hp = d.setup.h, s = H / Hp;
    return `<svg width="${Math.round(W * s)}" height="${H}" viewBox="0 0 ${W} ${Hp}" class="pg-thumb-svg">${BV.Render.pageContentSVG(d, i, App.getLayout, true)}</svg>`;
  };
  function refreshPages() {
    const el = $('pal-pages');
    if (!el || el.hidden || !App.doc) return;
    const d = doc();
    const pp = el.querySelector('[data-page="Pages"] .pg-grid');
    const op = el.querySelector('[data-page="Outline"] .ol-tree');
    if (pp && !pp.closest('.fp-page').hidden) {
      const cur = new Set(App.view.master ? [] : BV.spreads(d)[App.view.spread] || []);
      const sig = JSON.stringify([d.pages.map((p) => p.id + (p.masterId || '') + (p.master === false ? 'n' : '')), [...cur], App.doc.nextId, App.dirty, d.setup.w, d.setup.h]);
      if (pp.dataset.sig !== sig) {
        pp.dataset.sig = sig;
        const facing = d.setup.doubleSided && d.setup.facing;
        pp.innerHTML = BV.spreads(d).map((sp) => `<div class="pg-spread${facing ? '' : ' single'}">${sp.map((i) => {
          const pg = d.pages[i];
          const mid = BV.pageMasterId(d, pg);
          const mname = mid === null ? 'None' : mid ? (BV.masterById(d, mid) || {}).name || 'M' : 'Doc';
          return `<div class="pg-cell ${BV.pageSide(d, i)}${cur.has(i) ? ' on' : ''}" draggable="true" data-i="${i}" title="Page ${esc(BV.pageLabel(d, i))} · master: ${esc(mname)}"><div class="pg-thumb" data-i="${i}"></div><span class="pg-num">${esc(BV.pageLabel(d, i))}</span></div>`;
        }).join('')}</div>`).join('');
        // draw thumbnails lazily
        const io = new IntersectionObserver((ents) => {
          for (const en of ents) if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; en.target.innerHTML = thumbSVG(+en.target.dataset.i, 74); io.unobserve(en.target); }
        }, { root: pp });
        pp.querySelectorAll('.pg-thumb').forEach((t) => io.observe(t));
        const on = pp.querySelector('.pg-cell.on');
        if (on) on.scrollIntoView({ block: 'nearest' });
      }
    }
    if (op && !op.closest('.fp-page').hidden) {
      const name = (it) => {
        if (it.type === 'text') { const st = d.stories[it.storyId]; const t = st ? T.paraText(st.paras[0]).replace(/[\u2028\uE000-\uE003\u00AD]/g, ' ').trim() : ''; return t.slice(0, 34) || 'Text block'; }
        return it.name || { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', polygon: 'Polygon', image: 'Picture', frame: 'Frame' }[it.type] || it.type;
      };
      const typeIcon = (it) => ({ text: '¶', image: '▣', frame: '⊠', rect: '▭', ellipse: '◯', line: '╱', polygon: '⬠' }[it.type] || '•');
      const selSet = new Set(App.sel.kind === 'items' ? App.sel.ids : []);
      const grp = (ref, title) => {
        const its = BV.itemsOnPage(d, ref, true).slice().reverse();
        return `<details class="ol-pg"${App.placements.some((p) => p.ref === ref) ? ' open' : ''}><summary data-ref="${esc(ref)}">${esc(title)} <span class="meta">${its.length}</span></summary>${its.map((it) => `<div class="ol-it${selSet.has(it.id) ? ' on' : ''}" data-id="${it.id}"><span class="ol-ic">${typeIcon(it)}</span><span class="ol-nm" lang="kn">${esc(name(it))}</span>${it.locked ? '<span class="meta">🔒</span>' : ''}</div>`).join('')}</details>`;
      };
      const sig = JSON.stringify([d.nextId, App.dirty, [...selSet], App.view.spread, App.view.master]);
      if (op.dataset.sig !== sig) {
        op.dataset.sig = sig;
        let h = grp('ML', 'Document Master (left)') + grp('MR', 'Document Master (right)');
        for (const m of d.masters || []) h += grp(BV.masterRef(m.id, 'L'), m.name + ' (left)') + grp(BV.masterRef(m.id, 'R'), m.name + ' (right)');
        d.pages.forEach((pg, i) => { h += grp(pg.id, 'Page ' + BV.pageLabel(d, i)); });
        op.innerHTML = h;
      }
    }
  }
  App.refreshPagesPalette = () => { const el = $('pal-pages'); if (el) { el.querySelectorAll('[data-sig]').forEach((x) => delete x.dataset.sig); refreshPages(); } };
  function buildPages() {
    const el = $('pal-pages');
    const P = el.querySelector('[data-page="Pages"]');
    P.innerHTML = `<div class="fp-body pg-grid" aria-label="Pages"></div>
      <div class="fp-foot"><button class="mini" id="pg-ins" title="Insert a page after the current one">${icon('plus')}</button><button class="mini" id="pg-del" title="Remove the current page(s)">${icon('trash')}</button><span class="sp"></span><button class="mini" id="pg-master" title="Apply a master to the selected pages">${icon('tomaster')}</button><button class="mini" id="pg-sort" title="Sort pages…">${icon('pages')}</button></div>`;
    const O = el.querySelector('[data-page="Outline"]');
    O.innerHTML = '<div class="fp-body ol-tree" aria-label="Outline"></div>';
    const grid = P.querySelector('.pg-grid');
    grid.addEventListener('click', (e) => { const c = e.target.closest('.pg-cell'); if (c) App.gotoPage(+c.dataset.i); });
    grid.addEventListener('dblclick', (e) => { const c = e.target.closest('.pg-cell'); if (c) { App.gotoPage(+c.dataset.i); App.view.fit = true; App.fitZoom(); } });
    let from = null;
    grid.addEventListener('dragstart', (e) => { const c = e.target.closest('.pg-cell'); if (c) { from = +c.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
    grid.addEventListener('dragover', (e) => { if (from !== null) { e.preventDefault(); grid.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); const c = e.target.closest('.pg-cell'); if (c) c.classList.add('drop'); } });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const c = e.target.closest('.pg-cell');
      if (from === null || !c) return;
      const to = +c.dataset.i;
      if (to !== from) {
        App.checkpoint();
        const pages = doc().pages;
        const [pg] = pages.splice(from, 1);
        pages.splice(to, 0, pg);
        App.markAll(); App.changed();
        App.gotoPage(to);
      }
      from = null;
    });
    P.querySelector('#pg-ins').onclick = () => { App.checkpoint(); const cur = BV.spreads(doc())[App.view.spread] || [0]; const at = cur[cur.length - 1] + 1; doc().pages.splice(at, 0, BV.newPage(doc())); App.changed(); App.gotoPage(at); };
    P.querySelector('#pg-del').onclick = () => App.command('removePages');
    P.querySelector('#pg-master').onclick = () => App.command('applyMaster');
    P.querySelector('#pg-sort').onclick = () => App.command('sortPages');
    const tree = O.querySelector('.ol-tree');
    tree.addEventListener('click', (e) => {
      const it = e.target.closest('.ol-it');
      if (!it) return;
      const obj = doc().items[it.dataset.id];
      if (!obj) return;
      if (App.sel.kind === 'text') App.leaveText();
      if (BV.isMasterRef(obj.page)) App.gotoSpread(0, BV.masterIdOfRef(obj.page) || true);
      else App.gotoPage(doc().pages.findIndex((p) => p.id === obj.page));
      App.setTool('pointer');
      App.sel = { kind: 'items', ids: e.shiftKey && App.sel.kind === 'items' ? [...App.sel.ids, obj.id] : [obj.id] };
      App.render();
    });
    el.querySelectorAll('.fp-tab').forEach((t) => t.addEventListener('click', () => setTimeout(App.refreshPagesPalette, 0)));
  }

  // ------------------------------------------------------------------ Glyphs palette (Scribus: Insert Glyph)
  const BLOCKS = [
    ['Kannada', 0x0c80, 0x0cff], ['Devanagari', 0x0900, 0x097f], ['Vedic', 0x1cd0, 0x1cff], ['Devanagari ext.', 0xa8e0, 0xa8ff],
    ['IAST / Latin', null, null, 'āĀīĪūŪṛṚṝṜḷḶḹḸṅṄñÑṭṬḍḌṇṆśŚṣṢṃṂḥḤēĒōŌ'], ['Punctuation', null, null, '–—‘’“”‚„…•·‹›«»†‡§¶©®™°′″‰¦¿¡'],
    ['Signs', null, null, '।॥ऽॐ₹₨×÷±≈≠≤≥∞√∑∏∫∆←→↑↓↔★☆✓✗♪♫'], ['Spaces & joiners', null, null, '     \u200C\u200D\u00AD'],
  ];
  const GNAME = { ' ': 'NBSP', ' ': 'thin', ' ': 'hair', ' ': 'en', ' ': 'em', '\u200C': 'ZWNJ', '\u200D': 'ZWJ', '\u00AD': 'SHY' };
  function buildGlyphs() {
    const body = $('pal-glyph').querySelector('.fp-body');
    body.innerHTML = `<div class="gl-top"><select id="gl-blk" class="fld">${BLOCKS.map((b, i) => opt(i, b[0], App.store.get('glyphBlock', 0))).join('')}</select><span class="clabel" id="gl-font"></span></div><div class="gl-grid" id="gl-grid"></div><div class="gl-info clabel" id="gl-info">Click a glyph to insert it at the text cursor.</div>`;
    const draw = () => {
      const i = +body.querySelector('#gl-blk').value;
      App.store.set('glyphBlock', i);
      const [, a, b, list] = BLOCKS[i];
      const chars = list ? [...list] : Array.from({ length: b - a + 1 }, (_, k) => String.fromCodePoint(a + k)).filter((c) => /\p{L}|\p{M}|\p{N}|\p{P}|\p{S}/u.test(c));
      const c = App.currentParaProps && App.currentParaProps();
      const font = c ? c.cp.font : 'Noto Serif Kannada';
      body.querySelector('#gl-font').textContent = font;
      const isMark = (ch) => /\p{M}/u.test(ch);
      body.querySelector('#gl-grid').innerHTML = chars.map((ch) => `<button class="gl" data-c="${esc(ch)}" style="font-family:${esc(BV.fontFamilyList(font))}" title="U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}${GNAME[ch] ? ' ' + GNAME[ch] : ''}">${GNAME[ch] ? `<small>${GNAME[ch]}</small>` : isMark(ch) ? '◌' + esc(ch) : esc(ch)}</button>`).join('');
    };
    body.querySelector('#gl-blk').onchange = draw;
    body.addEventListener('mousedown', (e) => { if (e.target.closest('.gl')) e.preventDefault(); });
    body.addEventListener('mouseover', (e) => { const g = e.target.closest('.gl'); if (g) body.querySelector('#gl-info').textContent = `U+${g.dataset.c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ${GNAME[g.dataset.c] || ''}`; });
    body.addEventListener('click', (e) => {
      const g = e.target.closest('.gl');
      if (!g) return;
      if (!$('story-editor').hidden) document.execCommand('insertText', false, g.dataset.c);
      else if (App.sel.kind === 'text') App.insertText(g.dataset.c, { undoKey: 'type' });
      else UI.status('Click into text first.');
    });
    App.refreshGlyphs = draw;
    draw();
  }

  // ------------------------------------------------------------------ Tables (PageMaker Table Editor / Scribus tables)
  async function insertTable() {
    const d = doc();
    const pl = App.placements.find((p) => p.idx >= 0) || App.placements[0];
    const m = BV.pageMargins(d, pl.side);
    const W = d.setup.w - m.left - m.right;
    const r = await UI.dialog({
      title: 'Insert Table',
      width: 600,
      html: `<div class="grid3"><label>Rows<input type="number" id="tb-r" min="1" value="4"></label><label>Columns<input type="number" id="tb-c" min="1" value="3"></label><label>Width (${UL()})<input type="number" step="any" id="tb-w" value="${BV.fmt(W, U())}"></label>
        <label>Cell inset (pt)<input type="number" step="any" id="tb-in" value="3"></label><label>Rule (pt)<input type="number" step="any" id="tb-sw" value="0.5"></label><label>Text size (pt)<input type="number" step="any" id="tb-sz" value="10"></label></div>
        <label class="check"><input type="checkbox" id="tb-h" checked> First row is a header (bold, shaded)</label>
        <label class="check"><input type="checkbox" id="tb-z"> Zebra rows</label>
        <fieldset><legend>Contents (optional)</legend><textarea id="tb-data" rows="6" placeholder="Paste from a spreadsheet or type: columns separated by tabs or commas, one row per line" style="width:100%;font-family:inherit"></textarea></fieldset>
        <p class="note">Each cell is its own text block, so you can type Kannada, Devanagari or IAST in it and use any style. The whole table is grouped; rows grow to fit their text.</p>`,
    });
    if (!r) return;
    let rows = Math.max(1, Math.round(UI.num(r.el, 'tb-r'))), cols = Math.max(1, Math.round(UI.num(r.el, 'tb-c')));
    const data = UI.val(r.el, 'tb-data').trim();
    let cells = null;
    if (data) { cells = App.parseCSV(data.replace(/\r\n?/g, '\n') + '\n'); rows = Math.max(rows, cells.length); cols = Math.max(cols, ...cells.map((x) => x.length)); }
    const width = Math.max(36, BV.toPt(UI.num(r.el, 'tb-w'), U()));
    const inset = Math.max(0, UI.num(r.el, 'tb-in')), sw = Math.max(0, UI.num(r.el, 'tb-sw')), size = UI.num(r.el, 'tb-sz') || 10;
    const header = UI.checked(r.el, 'tb-h'), zebra = UI.checked(r.el, 'tb-z');
    App.checkpoint();
    if (!d.styles['Table text']) d.styles['Table text'] = Object.assign({}, BV.defaultStyles()['Body first'], { size, leading: Math.round(size * 1.35 * 10) / 10, align: 'left', spaceAfter: 0 });
    if (!d.styles['Table head']) d.styles['Table head'] = Object.assign({}, d.styles['Table text'], { bold: true });
    const g = BV.newId(d, 'g');
    const colW = width / cols;
    const x0 = m.left, y0 = m.top;
    const z0 = App.nextZ();
    const grid = [];
    for (let i = 0; i < rows; i++) {
      grid.push([]);
      for (let j = 0; j < cols; j++) {
        const st = BV.newStory(d, header && i === 0 ? 'Table head' : 'Table text');
        st.paras[0].runs = [{ t: (cells && cells[i] && cells[i][j] || '').trim() }];
        const it = BV.newItem(d, 'text', pl.ref, x0 + j * colW + inset, y0, colW - inset * 2, 20, { storyId: st.id, stroke: 'none', strokeWidth: 0, group: g, z: z0 + 2, cell: [i, j] });
        st.frames.push(it.id);
        grid[i].push(it);
      }
    }
    // rows grow to fit their text
    App.markAll();
    let y = y0;
    const rowY = [];
    for (let i = 0; i < rows; i++) {
      let h = (d.styles['Table text'].leading || size * 1.35);
      for (const it of grid[i]) {
        it.autoGrow = true; it.maxH = 2000; it.h = 2000;
        const lay = App.layoutFor(d.stories[it.storyId]);
        h = Math.max(h, (lay.frames[it.id] || {}).usedH || 0);
      }
      rowY.push(y);
      for (const it of grid[i]) { it.y = y + inset; it.h = h; it.autoGrow = false; delete it.maxH; }
      y += h + inset * 2;
    }
    rowY.push(y);
    const H = y - y0;
    const shade = (yy, hh, fill) => BV.newItem(d, 'rect', pl.ref, x0, yy, width, hh, { fill, stroke: 'none', strokeWidth: 0, group: g, z: z0 });
    if (header) shade(rowY[0], rowY[1] - rowY[0], '#e8e4dc');
    if (zebra) for (let i = header ? 2 : 1; i < rows; i += 2) shade(rowY[i], rowY[i + 1] - rowY[i], '#f4f2ee');
    if (sw > 0) {
      BV.newItem(d, 'rect', pl.ref, x0, y0, width, H, { fill: 'none', stroke: '#000000', strokeWidth: sw, group: g, z: z0 + 1 });
      for (let i = 1; i < rows; i++) BV.newItem(d, 'line', pl.ref, x0, rowY[i], width, 0, { stroke: '#000000', strokeWidth: header && i === 1 ? sw * 2 : sw, group: g, z: z0 + 1 });
      for (let j = 1; j < cols; j++) BV.newItem(d, 'line', pl.ref, x0 + j * colW, y0, 0, H, { stroke: '#000000', strokeWidth: sw, group: g, z: z0 + 1 });
    }
    App.refreshStyles();
    App.setTool('pointer');
    App.sel = { kind: 'items', ids: Object.values(d.items).filter((it) => it.group === g).map((it) => it.id) };
    App.changed();
    UI.status(`Table ${rows} × ${cols} added. Click into a cell with the text tool to type; drag the group to move it.`);
  }

  // ------------------------------------------------------------------ PDF export with bleed and printer's marks (Scribus PDF options)
  App.exportPdfDialog = async function () {
    if (App.sel.kind === 'text') App.leaveText();
    const d = doc();
    const P = Object.assign({ range: 'all', spreads: false, bleed: 0, crop: false, reg: false, info: false, nonprint: false }, App.store.get('pdfOpts', {}));
    const sp = d.setup.startPage;
    const r = await UI.dialog({
      title: 'Export Adobe PDF',
      width: 560,
      html: `<div class="row"><label for="pd-r">Pages</label><select id="pd-r">${opt('all', 'All ' + d.pages.length + ' pages', P.range)}${opt('cur', 'Pages in view', P.range)}${opt('some', 'Range…', P.range)}</select></div>
        <div class="row2"><label>From<input type="number" id="pd-a" value="${sp}"></label><label>To<input type="number" id="pd-b" value="${sp + d.pages.length - 1}"></label></div>
        <label class="check"><input type="checkbox" id="pd-sp" ${P.spreads ? 'checked' : ''}> Reader spreads (facing pages side by side)</label>
        <fieldset><legend>Marks and bleed</legend>
          <div class="row"><label for="pd-bl">Bleed (${UL()})</label><input type="number" step="any" id="pd-bl" value="${BV.fmt(P.bleed || 0, U())}"></div>
          <label class="check"><input type="checkbox" id="pd-cm" ${P.crop ? 'checked' : ''}> Crop marks</label>
          <label class="check"><input type="checkbox" id="pd-rg" ${P.reg ? 'checked' : ''}> Registration marks</label>
          <label class="check"><input type="checkbox" id="pd-in" ${P.info ? 'checked' : ''}> Page information (file, page, date)</label>
        </fieldset>
        <p class="note">Fonts are embedded and the text stays vector, exactly as on screen. Objects that run past the page edge print into the bleed.</p>`,
      buttons: [{ label: 'Export', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const o = { range: UI.val(r.el, 'pd-r'), spreads: UI.checked(r.el, 'pd-sp'), bleed: BV.toPt(UI.num(r.el, 'pd-bl'), U()), crop: UI.checked(r.el, 'pd-cm'), reg: UI.checked(r.el, 'pd-rg'), info: UI.checked(r.el, 'pd-in') };
    App.store.set('pdfOpts', o);
    let a = 0, b = d.pages.length - 1;
    if (o.range === 'cur') { const c = App.placements.filter((p) => p.idx >= 0).map((p) => p.idx); if (c.length) { a = Math.min(...c); b = Math.max(...c); } }
    if (o.range === 'some') { a = Math.max(0, Math.round(UI.num(r.el, 'pd-a')) - sp); b = Math.min(d.pages.length - 1, Math.round(UI.num(r.el, 'pd-b')) - sp); }
    const { body, css } = App.pdfHTML(d, a, b, o);
    UI.status('Exporting PDF…', 0);
    try {
      const p = await native.exportPdf({ body, css, fontCss: App.fontCssText, defaultName: docBase() + '.pdf' });
      UI.status(p ? 'PDF saved: ' + p.split(/[\\/]/).pop() : '');
      if (p) native.openExternal(p);
    } catch (e) { UI.alert('PDF export failed: ' + e.message); }
  };
  App.pdfHTML = function (d, a, b, o) {
    const W = d.setup.w, H = d.setup.h, bl = o.bleed || 0;
    const slug = o.crop || o.reg || o.info ? 36 : 0;
    const facing = d.setup.doubleSided && d.setup.facing;
    const sheets = [];
    if (o.spreads && facing) { for (const s of BV.spreads(d)) { const inRange = s.filter((i) => i >= a && i <= b); if (inRange.length) sheets.push(inRange); } }
    else for (let i = a; i <= b; i++) sheets.push([i]);
    const date = new Date().toLocaleString();
    let body = '', maxW = 0, maxH = 0;
    for (const sh of sheets) {
      const tw = W * sh.length; // trim width of this sheet
      const SW = tw + 2 * bl + 2 * slug, SH = H + 2 * bl + 2 * slug;
      maxW = Math.max(maxW, SW); maxH = Math.max(maxH, SH);
      const ox = slug + bl, oy = slug + bl;
      let s = '';
      sh.forEach((i, k) => {
        // each page clips to its bleed on the outside edges only
        const left = k === 0 ? bl : 0, right = k === sh.length - 1 ? bl : 0;
        s += `<svg x="${ox + k * W - left}" y="${oy - bl}" width="${W + left + right}" height="${H + 2 * bl}" viewBox="${-left} ${-bl} ${W + left + right} ${H + 2 * bl}" overflow="hidden">${BV.Render.pageContentSVG(d, i, App.getLayout, true)}</svg>`;
      });
      const k = 0.25;
      if (o.crop) {
        const L = 18, off = bl + 6;
        const c = (x, y, dx, dy) => `<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="#000" stroke-width="${k}"/>`;
        const X0 = ox, X1 = ox + tw, Y0 = oy, Y1 = oy + H;
        s += c(X0 - off, Y0, -L, 0) + c(X0, Y0 - off, 0, -L) + c(X1 + off, Y0, L, 0) + c(X1, Y0 - off, 0, -L) + c(X0 - off, Y1, -L, 0) + c(X0, Y1 + off, 0, L) + c(X1 + off, Y1, L, 0) + c(X1, Y1 + off, 0, L);
        if (sh.length === 2) s += c(ox + W, Y0 - off, 0, -L) + c(ox + W, Y1 + off, 0, L);
      }
      if (o.reg) {
        const reg = (x, y) => `<g stroke="#000" stroke-width="${k}" fill="none"><circle cx="${x}" cy="${y}" r="5"/><circle cx="${x}" cy="${y}" r="2.5"/><line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}"/><line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}"/></g>`;
        s += reg(ox + tw / 2, slug / 2) + reg(ox + tw / 2, SH - slug / 2) + reg(slug / 2, oy + H / 2) + reg(SW - slug / 2, oy + H / 2);
      }
      if (o.info) s += `<text x="${ox}" y="${SH - 8}" style="font:6px sans-serif" fill="#000">${esc(docBase())}  ·  page ${sh.map((i) => esc(BV.pageLabel(d, i))).join('–')}  ·  ${esc(date)}  ·  BV Mudrana</text>`;
      body += `<div class="pg" style="width:${SW}pt;height:${SH}pt"><svg xmlns="http://www.w3.org/2000/svg" width="${SW}pt" height="${SH}pt" viewBox="0 0 ${SW} ${SH}" text-rendering="geometricPrecision">${s}</svg></div>`;
    }
    const css = `@page{size:${maxW}pt ${maxH}pt;margin:0}html,body{margin:0;padding:0}.pg{overflow:hidden;break-after:page}.pg:last-child{break-after:auto}svg{display:block}`;
    return { body, css };
  };

  // ------------------------------------------------------------------ gradients and transparency (Scribus colour & transparency)
  async function gradientDialog() {
    const its = selItems().filter((i) => i.type !== 'line');
    const all = selItems();
    if (!all.length) return UI.status('Select objects first.');
    const it = its[0] || all[0];
    const g = it.gradient || { type: 'none', from: it.fill && it.fill !== 'none' ? it.fill : '#f47920', to: '#ffffff', angle: 90 };
    const r = await UI.dialog({
      title: 'Gradient and Transparency',
      width: 520,
      html: `<fieldset><legend>Fill gradient</legend><div class="grid3">
          <label>Type<select id="gd-t">${opt('none', 'None (solid)', it.gradient ? g.type : 'none')}${opt('linear', 'Linear', it.gradient ? g.type : 'none')}${opt('radial', 'Radial', it.gradient ? g.type : 'none')}</select></label>
          <label>From<input type="color" id="gd-a" value="${esc(g.from || '#f47920')}"></label><label>To<input type="color" id="gd-b" value="${esc(g.to || '#ffffff')}"></label>
          <label>Angle (°)<input type="number" id="gd-g" value="${g.angle ?? 90}"></label></div><div id="gd-prev" class="gd-prev"></div></fieldset>
        <fieldset><legend>Transparency</legend><div class="grid3"><label>Opacity (%)<input type="number" id="gd-o" min="0" max="100" value="${it.opacity ?? 100}"></label>
          <label>Blend mode<select id="gd-m">${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-burn', 'color-dodge', 'difference'].map((m) => opt(m, m[0].toUpperCase() + m.slice(1).replace('-', ' '), it.blend || 'normal')).join('')}</select></label></div></fieldset>`,
      onOpen: (el) => {
        const pv = () => { const t = el.querySelector('#gd-t').value, a = el.querySelector('#gd-a').value, b = el.querySelector('#gd-b').value, ang = +el.querySelector('#gd-g').value || 0; el.querySelector('#gd-prev').style.background = t === 'radial' ? `radial-gradient(${a}, ${b})` : t === 'linear' ? `linear-gradient(${ang + 90}deg, ${a}, ${b})` : a; el.querySelector('#gd-prev').style.opacity = (+el.querySelector('#gd-o').value || 0) / 100; };
        el.querySelectorAll('input,select').forEach((x) => x.addEventListener('input', pv));
        pv();
      },
    });
    if (!r) return;
    App.checkpoint();
    const t = UI.val(r.el, 'gd-t'), op = Math.max(0, Math.min(100, UI.num(r.el, 'gd-o'))), bm = UI.val(r.el, 'gd-m');
    for (const x of all) {
      if (x.type !== 'line') {
        if (t === 'none') delete x.gradient;
        else { x.gradient = { type: t, from: UI.val(r.el, 'gd-a'), to: UI.val(r.el, 'gd-b'), angle: UI.num(r.el, 'gd-g') }; x.fill = x.gradient.from; }
      }
      if (op >= 100) delete x.opacity; else x.opacity = op;
      if (bm === 'normal') delete x.blend; else x.blend = bm;
    }
    App.changed();
  }

  // ------------------------------------------------------------------ character styles (Scribus)
  const CS_KEYS = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'caps', 'smallCaps', 'color', 'tint', 'shift', 'track', 'width', 'pos', 'reverse', 'outline', 'shadow'];
  async function charStyles() {
    const d = doc();
    d.charStyles = d.charStyles || {};
    const desc = (s) => [s.font, s.size && s.size + 'pt', s.bold && 'bold', s.italic && 'italic', s.smallCaps && 'small caps', s.caps && 'caps', s.color && s.color !== '#000000' && s.color, s.track && 'track ' + s.track].filter(Boolean).join(' · ');
    const draw = (el) => { el.querySelector('#cs-l').innerHTML = Object.entries(d.charStyles).map(([n, s]) => `<option value="${esc(n)}">${esc(n)}, ${esc(desc(s))}</option>`).join('') || ''; };
    const r = await UI.dialog({
      title: 'Character Styles',
      width: 560,
      html: `<select id="cs-l" size="8" style="width:100%"></select>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" type="button" id="cs-new">New from selection…</button><button class="btn" type="button" id="cs-del">Delete</button></div>
        <p class="note">A character style stores font, size, type style, colour, tracking and so on. Applying it gives the selected text exactly that formatting (use it for words like Sanskrit terms or names that recur through a book).</p>`,
      onOpen: (el) => {
        draw(el);
        el.querySelector('#cs-new').onclick = async () => {
          const c = App.currentParaProps();
          if (!c) return UI.status('Click into formatted text first.');
          const nm = await UI.prompt('New Character Style', 'Name', 'Emphasis');
          if (!nm) return;
          const s = {};
          for (const k of CS_KEYS) if (c.cp[k] !== undefined && c.cp[k] !== null && c.cp[k] !== false && !(k === 'track' && !c.cp[k]) && !(k === 'width' && c.cp[k] === 100) && !(k === 'tint' && c.cp[k] === 100) && !(k === 'shift' && !c.cp[k])) s[k] = c.cp[k];
          if (App.sel.kind === 'text') { const st = d.stories[App.sel.sid]; const run = T.attrsAt(st.paras[App.sel.f.p], App.sel.f.o); if (run.size) s.size = run.size; if (run.pos) s.pos = run.pos; }
          d.charStyles[nm.trim()] = s;
          App.setDirty(true);
          draw(el);
        };
        el.querySelector('#cs-del').onclick = () => { const v = el.querySelector('#cs-l').value; if (v) { delete d.charStyles[v]; App.setDirty(true); draw(el); } };
      },
      buttons: [{ label: 'Apply', value: 'apply', primary: true }, { label: 'Close', value: null }],
    });
    if (!r) return;
    const v = r.el.querySelector('#cs-l').value;
    if (v && d.charStyles[v]) App.applyCharStyle(v);
  }
  App.applyCharStyle = function (name) {
    const s = doc().charStyles && doc().charStyles[name];
    if (!s) return;
    const attrs = {};
    for (const k of CS_KEYS) attrs[k] = s[k] === undefined ? null : s[k];
    App.applyChar(attrs);
  };

  // ------------------------------------------------------------------ sample text (Scribus: Insert ▸ Sample Text)
  const SAMPLES = {
    kn: 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ಪವಿತ್ರವಾದ ಸಾಮಗಾನವೇ ತದನಂತರದ ದಿನಗಳಲ್ಲಿ ಕಲೆಯಾಗಿ ಹೊರಹೊಮ್ಮಿದ ಭಾರತೀಯ ಸಂಗೀತದ ಮೂಲ ಮತ್ತು ಉಗಮಸ್ಥಾನವೆಂಬುದು ಸರ್ವವಿದಿತ.',
    sa: 'नृत्यं सङ्गीतं योगः साहित्यं च भारतीयसंस्कृतेः प्राणभूतानि। गीतं वाद्यं तथा नृत्तं त्रयं सङ्गीतमुच्यते। आनन्दरूपममृतं यद्विभाति।',
    iast: 'nṛtyaṁ saṅgītaṁ yogaḥ sāhityaṁ ca bhāratīya-saṁskṛteḥ prāṇabhūtāni. gītaṁ vādyaṁ tathā nṛttaṁ trayaṁ saṅgītam ucyate.',
    en: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  };
  async function sampleText() {
    const r = await UI.dialog({
      title: 'Insert Sample Text',
      html: `<div class="row"><label for="sm-l">Language</label><select id="sm-l">${opt('kn', 'Kannada', 'kn')}${opt('sa', 'Sanskrit (Devanagari)', '')}${opt('iast', 'Sanskrit (IAST)', '')}${opt('en', 'Latin (Lorem ipsum)', '')}</select></div>
        <div class="row"><label for="sm-n">Paragraphs</label><input type="number" id="sm-n" min="1" value="3"></div>
        <p class="note">With a text cursor, the text goes in there; otherwise it is loaded for placing.</p>`,
    });
    if (!r) return;
    const l = UI.val(r.el, 'sm-l'), n = Math.max(1, Math.round(UI.num(r.el, 'sm-n')));
    const paras = Array.from({ length: n }, () => SAMPLES[l]);
    if (App.sel.kind === 'text') return App.insertText(paras.join('\n'));
    const style = App.defaultStyle || 'Body text';
    const font = l === 'sa' ? 'Noto Serif Devanagari' : l === 'kn' ? null : 'Noto Serif';
    App.loadTextForPlacing(paras.map((t) => ({ style, runs: [Object.assign({ t }, font ? { font } : {})] })));
    UI.status('Sample text loaded: click a page to place it.', 0);
  }

  // ------------------------------------------------------------------ baseline grid (Scribus / PageMaker grid)
  App.showBaseline = App.store.get('showBaseline', false);
  App.overlayHooks = App.overlayHooks || [];
  App.overlayHooks.push((p, s, px) => {
    if (!App.showBaseline) return '';
    const d = doc();
    const g = Object.assign({ inc: 14, start: null }, App.store.get('baselineGrid', {}));
    const m = BV.pageMargins(d, p.side);
    const y0 = g.start ?? m.top;
    let out = '<g class="baseline" shape-rendering="crispEdges">';
    for (let y = y0 + g.inc; y <= d.setup.h - m.bottom + 0.01; y += g.inc) out += `<line x1="${m.left}" x2="${d.setup.w - m.right}" y1="${y}" y2="${y}" stroke="#3bb3a7" stroke-opacity=".55" stroke-width="${px}"/>`;
    return out + '</g>';
  });

  // ------------------------------------------------------------------ eyedropper, duplicate, document information
  function addColorFromSelection() {
    let hex = null;
    const its = selItems();
    if (its.length) hex = [its[0].fill, its[0].stroke].find((h) => h && h !== 'none');
    else if (App.sel.kind === 'text') hex = App.currentParaProps().cp.color;
    if (!hex) return UI.status('Select an object or text with a colour first.');
    const d = doc();
    if (d.colors.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) return UI.status('That colour is already in the Colors palette.');
    App.checkpoint();
    d.colors.push({ name: 'Colour ' + hex.slice(1).toUpperCase(), hex });
    App.refreshColors(); App.setDirty(true);
    UI.status('Added ' + hex + ' to the Colors palette.');
  }
  function duplicate() {
    const its = selItems();
    if (!its.length) return UI.status('Select objects to duplicate.');
    const stories = {};
    for (const it of its) if (it.type === 'text') stories[it.storyId] = doc().stories[it.storyId];
    const keep = App.clipItems;
    App.clipItems = clone({ items: its, stories });
    App.pasteItems();
    App.clipItems = keep;
  }
  async function docInfo() {
    const d = doc();
    const info = Object.assign({ title: docBase(), author: '', subject: '', keywords: '', publisher: 'Brahmavidya', language: 'kn' }, d.info || {});
    const r = await UI.dialog({
      title: 'Document Information',
      html: ['title', 'author', 'subject', 'keywords', 'publisher', 'language'].map((k) => `<div class="row"><label for="di-${k}">${k[0].toUpperCase() + k.slice(1)}</label><input type="text" id="di-${k}" value="${esc(info[k])}"></div>`).join('') + '<p class="note">Kept with the publication and written into exported PDF and HTML.</p>',
    });
    if (!r) return;
    App.checkpoint();
    d.info = {};
    for (const k of ['title', 'author', 'subject', 'keywords', 'publisher', 'language']) d.info[k] = UI.val(r.el, 'di-' + k).trim();
    App.setDirty(true);
  }

  // ------------------------------------------------------------------ ISBN / EAN-13 barcode (Scribus: Barcode Generator)
  const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN_G = EAN_L.map((p) => [...p].reverse().map((b) => (b === '0' ? '1' : '0')).join(''));
  const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
  const EAN_PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const eanCheck = (d12) => { let s = 0; for (let i = 0; i < 12; i++) s += +d12[i] * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10; };
  function isbnTo13(raw) {
    const d = String(raw).replace(/[^0-9Xx]/g, '').toUpperCase();
    if (d.length === 10) { const b = '978' + d.slice(0, 9); return b + eanCheck(b); }
    if (d.length === 12) return d + eanCheck(d);
    if (d.length === 13) return d;
    return null;
  }
  App.ean13SVG = function (code, label) {
    const m = 1; // one module = 1 unit; the SVG is scaled when placed
    const bits = '101' + [...code.slice(1, 7)].map((c, i) => (EAN_PAR[+code[0]][i] === 'L' ? EAN_L : EAN_G)[+c]).join('') + '01010' + [...code.slice(7)].map((c) => EAN_R[+c]).join('') + '101';
    const qz = 11, W = bits.length + qz + 7, top = label ? 13 : 3, H = 69 + top + 12;
    let bars = '';
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== '1') continue;
      let j = i; while (j + 1 < bits.length && bits[j + 1] === '1') j++;
      const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      bars += `<rect x="${qz + i * m}" y="${top}" width="${(j - i + 1) * m}" height="${guard ? 74 : 69}"/>`;
      i = j;
    }
    const t = (x, s, anchor = 'middle') => `<text x="${x}" y="${top + 80}" text-anchor="${anchor}" font-family="OCR B, Consolas, Arial, sans-serif" font-size="10" letter-spacing="1.2">${s}</text>`;
    const human = t(qz - 2, code[0], 'end') + t(qz + 3 + 21, code.slice(1, 7)) + t(qz + 50 + 21, code.slice(7));
    const lab = label ? `<text x="${W / 2}" y="9" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" letter-spacing=".4">${label}</text>` : '';
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${bars}${human}${lab}</g></svg>`, W, H };
  };
  async function barcode() {
    const r = await UI.dialog({
      title: 'ISBN Barcode',
      html: `<div class="row"><label for="bc-n">ISBN (10 or 13 digits)</label><input type="text" id="bc-n" placeholder="978-81-…" value="${esc(App.store.get('lastIsbn', ''))}"></div>
        <div class="row"><label for="bc-w">Width (mm)</label><input type="number" id="bc-w" step="any" value="37.29"></div>
        <label class="check"><input type="checkbox" id="bc-l" checked> Print “ISBN …” above the bars</label>
        <p class="note">Makes a standard EAN-13 Bookland barcode (the check digit is worked out for you). Place it on the back cover; 37.29 mm is the standard 100% size.</p>`,
      validate: (el) => (isbnTo13(UI.val(el, 'bc-n')) ? null : 'Type an ISBN of 10 or 13 digits.'),
    });
    if (!r) return;
    const raw = UI.val(r.el, 'bc-n');
    App.store.set('lastIsbn', raw);
    const code = isbnTo13(raw);
    const given = raw.replace(/[^0-9Xx]/g, '');
    if (given.length === 13 && eanCheck(given.slice(0, 12)) !== +given[12]) UI.status(`Note: the last digit of that ISBN should be ${eanCheck(given.slice(0, 12))}; the barcode uses the digits as typed.`, 8000);
    const pretty = raw.trim().length ? raw.trim().replace(/^isbn[:\s]*/i, '') : code;
    const { svg, W, H } = App.ean13SVG(code, UI.checked(r.el, 'bc-l') ? 'ISBN ' + esc(pretty) : '');
    const w = BV.UNITS.mm * (UI.num(r.el, 'bc-w') || 37.29) * (W / 102), h = w * (H / W);
    const pl = App.placements.find((p) => p.idx >= 0) || App.placements[0];
    const d = doc();
    App.checkpoint();
    const it = BV.newItem(d, 'image', pl.ref, d.setup.w - BV.pageMargins(d, pl.side).right - w, d.setup.h - BV.pageMargins(d, pl.side).bottom - h, w, h, { src: 'data:image/svg+xml;base64,' + btoa(svg), name: 'ISBN ' + code, stroke: 'none', strokeWidth: 0, z: App.nextZ() });
    App.setTool('pointer');
    App.sel = { kind: 'items', ids: [it.id] };
    App.changed();
    UI.status('Barcode placed: ' + code);
  }

  // ------------------------------------------------------------------ fit picture / frame (Scribus image frame options)
  function fitPicture(mode) {
    const its = selItems().filter((i) => i.src);
    if (!its.length) return UI.status('Select a placed picture or a frame with a picture.');
    App.checkpoint();
    let pending = its.length;
    for (const it of its) {
      const img = new Image();
      img.onload = () => {
        const b = BV.Render.box(it);
        const ar = (img.naturalHeight || 1) / (img.naturalWidth || 1);
        if (mode === 'frame') { const cw = it.cw ?? b.w, ch = it.ch ?? b.h; it.x = b.x + (it.cx ?? 0); it.y = b.y + (it.cy ?? 0); it.w = cw; it.h = ch; it.cx = 0; it.cy = 0; it.cw = cw; it.ch = ch; }
        else if (mode === 'prop') { let cw = b.w, ch = b.w * ar; if (ch > b.h) { ch = b.h; cw = b.h / ar; } Object.assign(it, { cx: (b.w - cw) / 2, cy: (b.h - ch) / 2, cw, ch }); }
        else Object.assign(it, { cx: 0, cy: 0, cw: b.w, ch: b.h });
        if (--pending === 0) App.changed();
      };
      img.onerror = () => { if (--pending === 0) App.changed(); };
      img.src = it.src;
    }
  }

  // ------------------------------------------------------------------ dispatcher
  const prev = App.command2;
  App.command2 = async function (cmd, arg) {
    if (cmd.startsWith('ins:')) {
      const ch = String.fromCodePoint(parseInt(cmd.slice(4), 16));
      if (!$('story-editor').hidden) return document.execCommand('insertText', false, ch);
      if (App.sel.kind !== 'text') return UI.status('Click into text first.');
      return App.insertText(ch);
    }
    if (cmd.startsWith('cstyle:')) return App.applyCharStyle(cmd.slice(7));
    switch (cmd) {
      case 'showPages': App.showPanel('pal-pages'); return App.refreshPagesPalette();
      case 'showOutline': App.showPanel('pal-pages', true); App.selectTab('pal-pages', 'Outline'); return App.refreshPagesPalette();
      case 'showAlign': return App.showPanel('pal-align');
      case 'showGlyphs': App.showPanel('pal-glyph'); return App.refreshGlyphs && App.refreshGlyphs();
      case 'insertTable': return insertTable();
      case 'gradientFill': return gradientDialog();
      case 'charStyles': return charStyles();
      case 'sampleText': return sampleText();
      case 'toggleBaseline': App.showBaseline = !App.showBaseline; App.store.set('showBaseline', App.showBaseline); native.menuState({ baseline: App.showBaseline }); return App.render();
      case 'baselineSetup': {
        const g = Object.assign({ inc: 14, start: null }, App.store.get('baselineGrid', {}));
        const r = await UI.dialog({ title: 'Baseline Grid', html: `<div class="row"><label for="bg-i">Increment (pt)</label><input type="number" step="any" id="bg-i" value="${g.inc}"></div><div class="row"><label for="bg-s">Start (pt from top; blank = top margin)</label><input type="text" id="bg-s" value="${g.start ?? ''}"></div><p class="note">Set the increment to the body leading so lines across columns line up.</p>` });
        if (!r) return;
        const s = UI.val(r.el, 'bg-s').trim();
        App.store.set('baselineGrid', { inc: Math.max(2, UI.num(r.el, 'bg-i')), start: s === '' ? null : parseFloat(s) || 0 });
        App.showBaseline = true; App.store.set('showBaseline', true); native.menuState({ baseline: true });
        return App.render();
      }
      case 'eyedropper': return addColorFromSelection();
      case 'duplicate': return duplicate();
      case 'docInfo': return docInfo();
      case 'barcode': return barcode();
      case 'fitContent': return fitPicture('fill');
      case 'fitContentProp': return fitPicture('prop');
      case 'fitFrame': return fitPicture('frame');
    }
    if (prev) return prev(cmd, arg);
  };

  // ------------------------------------------------------------------ wiring
  function init() {
    if (!$('pal-pages') || !$('pal-pages').querySelector('.fp-page')) return setTimeout(init, 30);
    buildPages(); buildAlign(); buildGlyphs();
    const ch = App.changed;
    App.changed = function (...a) { const r = ch.apply(this, a); schedulePages(); return r; };
    const go = App.gotoSpread;
    App.gotoSpread = function (...a) { const r = go.apply(this, a); schedulePages(); return r; };
    const sd = App.setDoc;
    App.setDoc = function (...a) { const r = sd.apply(this, a); App.refreshPagesPalette(); return r; };
    const rn = App.render;
    let selSig = '';
    App.render = function (...a) { const r = rn.apply(this, a); const s = App.sel.kind === 'items' ? App.sel.ids.join() : ''; if (s !== selSig) { selSig = s; schedulePages(); } return r; };
    const sp = App.showPanel;
    App.showPanel = function (id, show) { const r = sp.call(this, id, show); if (id === 'pal-pages') schedulePages(); if (window.native) native.menuState({ pagesPal: !$('pal-pages').hidden, alignPal: !$('pal-align').hidden, glyphPal: !$('pal-glyph').hidden }); return r; };
    $('pal-align').querySelector('#al-gapu').textContent = UL();
    if (App.store.get('show.pal-pages', false)) { $('pal-pages').hidden = false; schedulePages(); }
    if (App.store.get('show.pal-align', false)) $('pal-align').hidden = false;
    if (App.store.get('show.pal-glyph', false)) $('pal-glyph').hidden = false;
    if (window.native) native.menuState({ baseline: !!App.showBaseline });
  }
  init();
})();
