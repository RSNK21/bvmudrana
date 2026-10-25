/* BV Mudrana: menu commands, dialogs, Story Editor, Place, files, start-up. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text, UI = BV.UI;
  const $ = (id) => document.getElementById(id);
  const doc = () => App.doc;
  const esc = BV.Render.esc;

  // ------------------------------------------------------------------ formatting targets
  const textSel = () => (App.sel.kind === 'text' ? App.sel : null);
  function selectedStories() {
    if (App.sel.kind === 'text') return [doc().stories[App.sel.sid]];
    if (App.sel.kind === 'items') return [...new Set(App.sel.ids.map((id) => doc().items[id]).filter((it) => it && it.type === 'text').map((it) => it.storyId))].map((s) => doc().stories[s]);
    return [];
  }
  App.applyChar = function (attrs) {
    if (attrs.font && App.ensureFonts) App.ensureFonts([attrs.font]);
    const ts = textSel();
    if (ts) {
      const story = doc().stories[ts.sid];
      if (T.cmp(ts.a, ts.f) === 0) { App.typingAttrs = Object.assign({}, App.typingAttrs || {}, attrs); App.render(); App.focusIME(); return; }
      App.checkpoint();
      T.applyChar(story, ts.a, ts.f, attrs);
      App.changed(story.id);
      App.focusIME();
      return;
    }
    const stories = selectedStories();
    if (!stories.length) return UI.status('Select some text or a text block first.');
    App.checkpoint();
    for (const st of stories) T.applyChar(st, { p: 0, o: 0 }, T.storyEnd(st), attrs);
    App.changed();
  };
  App.applyPara = function (key, value) {
    const ts = textSel();
    App.checkpoint();
    if (ts) {
      const st = doc().stories[ts.sid];
      T.setParaOv(st, ts.a.p, ts.f.p, key, value);
      App.changed(st.id);
      App.focusIME();
      return;
    }
    const stories = selectedStories();
    if (!stories.length) { App.undoStack.pop(); return UI.status('Select some text or a text block first.'); }
    for (const st of stories) T.setParaOv(st, 0, st.paras.length - 1, key, value);
    App.changed();
  };
  App.applyStyle = function (name) {
    const ts = textSel();
    const stories = selectedStories();
    if (!ts && !stories.length) { App.defaultStyle = name; App.render(); return UI.status(`New text will use “${name}”.`); }
    App.checkpoint();
    const clearOv = (st, a, b) => { for (let p = a; p <= b; p++) delete st.paras[p].ov; };
    if (ts) {
      const st = doc().stories[ts.sid];
      const [a, b] = [Math.min(ts.a.p, ts.f.p), Math.max(ts.a.p, ts.f.p)];
      T.setParaStyle(st, a, b, name); clearOv(st, a, b);
      App.changed(st.id);
      App.focusIME();
    } else {
      for (const st of stories) { T.setParaStyle(st, 0, st.paras.length - 1, name); clearOv(st, 0, st.paras.length - 1); }
      App.changed();
    }
    App.defaultStyle = name;
  };
  function toggleChar(key) {
    const c = App.currentParaProps();
    App.applyChar({ [key]: !(c && c.cp[key]) });
  }

  // ------------------------------------------------------------------ transliteration
  function transliterate(spec) {
    let [from, to] = spec.includes('>') ? spec.split('>') : ['auto', spec];
    const ts = textSel();
    const conv = (s) => BV.translit.convert(s, from, to);
    const convertParaRange = (st, p, s, e) => {
      const para = st.paras[p];
      let a = 0, newLen = 0;
      const runs = [];
      for (const r of para.runs) {
        const b = a + r.t.length;
        if (b <= s || a >= e) runs.push(r);
        else {
          const x = Math.max(a, s) - a, y = Math.min(b, e) - a;
          const mid = conv(r.t.slice(x, y));
          newLen += mid.length;
          runs.push({ ...r, t: r.t.slice(0, x) + mid + r.t.slice(y) });
        }
        a = b;
      }
      para.runs = runs;
      T.normalize(para);
      return newLen;
    };
    if (ts) {
      const st = doc().stories[ts.sid];
      let [a, b] = T.order(ts.a, ts.f);
      App.checkpoint();
      if (T.cmp(a, b) === 0) { a = { p: a.p, o: 0 }; b = { p: a.p, o: T.paraText(st.paras[a.p]).length }; }
      let endO = b.o;
      for (let p = a.p; p <= b.p; p++) {
        const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(st.paras[p]).length;
        const nl = convertParaRange(st, p, s, e);
        if (p === b.p) endO = s + nl;
      }
      App.sel = { kind: 'text', sid: st.id, a, f: { p: b.p, o: endO } };
      App.changed(st.id);
      App.focusIME();
      return;
    }
    const stories = selectedStories();
    if (!stories.length) return UI.status('Select text (or a text block) to transliterate.');
    App.checkpoint();
    for (const st of stories) for (let p = 0; p < st.paras.length; p++) convertParaRange(st, p, 0, T.paraText(st.paras[p]).length);
    App.changed();
  }

  async function dupTranslit() {
    const ts = textSel();
    if (!ts) return UI.alert('Put the text cursor in (or select) the verse paragraphs first.');
    const styles = Object.keys(doc().styles);
    const r = await UI.dialog({
      title: 'Duplicate as Transliteration',
      html: `<p class="note">Adds a transliterated copy below each selected paragraph, for example an IAST line under every Devanagari śloka.</p>
        <div class="row"><label for="dt-to">Convert to</label><select id="dt-to"><option value="iast">IAST</option><option value="knda">Kannada</option><option value="deva">Devanagari</option></select></div>
        <div class="row"><label for="dt-st">Style for the copy</label><select id="dt-st">${styles.map((s) => `<option${s === 'IAST' ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>`,
    });
    if (!r) return;
    const to = UI.val(r.el, 'dt-to'), style = UI.val(r.el, 'dt-st');
    const st = doc().stories[ts.sid];
    const [a, b] = T.order(ts.a, ts.f);
    App.checkpoint();
    let added = 0;
    for (let p = b.p; p >= a.p; p--) {
      const src = st.paras[p];
      const text = T.paraText(src);
      if (!text.trim()) continue;
      st.paras.splice(p + 1, 0, { style, runs: [{ t: BV.translit.convert(text, 'auto', to) }] });
      added++;
    }
    App.changed(st.id);
    UI.status(`Added ${added} transliterated paragraph${added === 1 ? '' : 's'}.`);
  }

  // ------------------------------------------------------------------ dialogs
  const unitSel = (cur) => Object.keys(BV.UNITS).map((u) => `<option value="${u}"${u === cur ? ' selected' : ''}>${BV.UNIT_LABEL[u]}</option>`).join('');
  const fontDatalist = () => `<datalist id="dl-fonts">${App.fontList.map((f) => `<option value="${esc(f)}">`).join('')}</datalist>`;

  async function docSetup(isNew) {
    const s = isNew ? BV.newDocument().setup : doc().setup;
    const u = s.units;
    const f = (v) => BV.fmt(v, u);
    const sizes = BV.PAGE_SIZES.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
    const r = await UI.dialog({
      title: isNew ? 'New Publication: Document Setup' : 'Document Setup',
      width: 520,
      html: `
        <div class="row"><label for="ds-size">Page size</label><select id="ds-size"><option value="custom">Custom</option>${sizes}</select></div>
        <div class="row2">
          <label>Width<input type="number" step="any" id="ds-w" value="${f(s.w)}"></label>
          <label>Height<input type="number" step="any" id="ds-h" value="${f(s.h)}"></label>
          <label>Units<select id="ds-u">${unitSel(u)}</select></label>
          <label>Numbers<select id="ds-num">
            ${[['arabic', '1 2 3'], ['kannada', '೧ ೨ ೩'], ['devanagari', '१ २ ३'], ['roman', 'i ii iii'], ['ROMAN', 'I II III']].map(([v, l]) => `<option value="${v}"${s.numbering === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select></label>
        </div>
        <fieldset><legend>Options</legend>
          <div class="row2">
            <label class="check" style="flex-direction:row"><input type="checkbox" id="ds-ds" ${s.doubleSided ? 'checked' : ''}> Double-sided</label>
            <label class="check" style="flex-direction:row"><input type="checkbox" id="ds-fp" ${s.facing ? 'checked' : ''}> Facing pages</label>
            <label>Start page #<input type="number" id="ds-start" value="${s.startPage}"></label>
            ${isNew ? `<label>Number of pages<input type="number" id="ds-pages" value="1" min="1"></label>` : '<span></span>'}
          </div>
        </fieldset>
        <fieldset><legend>Margins</legend>
          <div class="row2">
            <label>Inside<input type="number" step="any" id="ds-mi" value="${f(s.margins.inside)}"></label>
            <label>Outside<input type="number" step="any" id="ds-mo" value="${f(s.margins.outside)}"></label>
            <label>Top<input type="number" step="any" id="ds-mt" value="${f(s.margins.top)}"></label>
            <label>Bottom<input type="number" step="any" id="ds-mb" value="${f(s.margins.bottom)}"></label>
          </div>
        </fieldset>
        <fieldset><legend>Column guides</legend>
          <div class="row2">
            <label>Columns<input type="number" id="ds-cols" value="${s.columns}" min="1" max="20"></label>
            <label>Space between<input type="number" step="any" id="ds-gut" value="${f(s.gutter)}"></label>
          </div>
        </fieldset>`,
      onOpen: (el) => {
        const sel = el.querySelector('#ds-size');
        const match = BV.PAGE_SIZES.findIndex((p) => Math.abs(p.w * BV.UNITS.mm - s.w) < 1 && Math.abs(p.h * BV.UNITS.mm - s.h) < 1);
        sel.value = match >= 0 ? String(match) : 'custom';
        sel.onchange = () => {
          if (sel.value === 'custom') return;
          const ps = BV.PAGE_SIZES[+sel.value], cu = el.querySelector('#ds-u').value;
          el.querySelector('#ds-w').value = BV.fmt(ps.w * BV.UNITS.mm, cu);
          el.querySelector('#ds-h').value = BV.fmt(ps.h * BV.UNITS.mm, cu);
        };
        let prevU = u;
        el.querySelector('#ds-u').onchange = (e) => {
          const nu = e.target.value;
          for (const id of ['ds-w', 'ds-h', 'ds-mi', 'ds-mo', 'ds-mt', 'ds-mb', 'ds-gut']) {
            const inp = el.querySelector('#' + id);
            inp.value = BV.fmt(BV.toPt(parseFloat(inp.value) || 0, prevU), nu);
          }
          prevU = nu;
        };
      },
    });
    if (!r) return null;
    const el = r.el, nu = UI.val(el, 'ds-u');
    const P = (id) => BV.toPt(UI.num(el, id), nu);
    const ns = {
      w: P('ds-w'), h: P('ds-h'), units: nu, numbering: UI.val(el, 'ds-num'),
      doubleSided: UI.checked(el, 'ds-ds'), facing: UI.checked(el, 'ds-fp'), startPage: Math.max(1, Math.round(UI.num(el, 'ds-start')) || 1),
      margins: { inside: P('ds-mi'), outside: P('ds-mo'), top: P('ds-mt'), bottom: P('ds-mb') },
      columns: Math.max(1, Math.round(UI.num(el, 'ds-cols')) || 1), gutter: P('ds-gut'),
    };
    if (isNew) {
      ns.pageCount = Math.max(1, Math.round(UI.num(el, 'ds-pages')) || 1);
      return ns;
    }
    App.checkpoint();
    const old = JSON.parse(JSON.stringify(doc().setup));
    Object.assign(doc().setup, ns);
    if (App.adjustLayout) App.adjustLayout(old, doc().setup);
    App.markAll();
    App.changed();
    App.fitZoom();
    return ns;
  }

  async function editStyle(name, isNew) {
    const styles = doc().styles;
    const base = styles[name] || styles[App.currentParaProps().style] || Object.values(styles)[0];
    const st = JSON.parse(JSON.stringify(base));
    const u = doc().setup.units;
    const names = Object.keys(styles);
    const r = await UI.dialog({
      title: isNew ? 'New Style' : `Edit Style: ${name}`,
      width: 560,
      html: `${fontDatalist()}
        <div class="row"><label for="es-name">Name</label><input type="text" id="es-name" value="${esc(isNew ? '' : name)}"></div>
        <div class="row"><label for="es-next">Next style</label><select id="es-next"><option value="">Same style</option>${names.map((n) => `<option${n === st.next ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <fieldset><legend>Type</legend><div class="row2">
          <label style="grid-column:span 2">Font<input type="text" list="dl-fonts" id="es-font" value="${esc(st.font)}"></label>
          <label>Size (pt)<input type="number" step="any" id="es-size" value="${st.size}"></label>
          <label>Leading (pt)<input type="text" id="es-lead" value="${st.leading}"></label>
          <label class="check" style="flex-direction:row"><input type="checkbox" id="es-b" ${st.bold ? 'checked' : ''}> Bold</label>
          <label class="check" style="flex-direction:row"><input type="checkbox" id="es-i" ${st.italic ? 'checked' : ''}> Italic</label>
          <label>Colour<input type="color" id="es-color" value="${st.color || '#000000'}" style="height:26px;padding:0"></label>
        </div></fieldset>
        <fieldset><legend>Paragraph</legend><div class="row2">
          <label>Alignment<select id="es-align">${['left', 'center', 'right', 'justify', 'force'].map((a) => `<option${a === st.align ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
          <label>First indent (${BV.UNIT_LABEL[u]})<input type="number" step="any" id="es-fi" value="${BV.fmt(st.firstIndent || 0, u)}"></label>
          <label>Left indent<input type="number" step="any" id="es-li" value="${BV.fmt(st.leftIndent || 0, u)}"></label>
          <label>Right indent<input type="number" step="any" id="es-ri" value="${BV.fmt(st.rightIndent || 0, u)}"></label>
          <label>Space before (pt)<input type="number" step="any" id="es-sb" value="${st.spaceBefore || 0}"></label>
          <label>Space after (pt)<input type="number" step="any" id="es-sa" value="${st.spaceAfter || 0}"></label>
          <label class="check" style="flex-direction:row;grid-column:span 2"><input type="checkbox" id="es-bb" ${st.breakBefore ? 'checked' : ''}> Start in a new text block (next page)</label>
          <label class="check" style="flex-direction:row;grid-column:span 2"><input type="checkbox" id="es-kn" ${st.keepNext ? 'checked' : ''}> Keep with next paragraph</label>
        </div></fieldset>`,
      validate: (el) => {
        const nm = UI.val(el, 'es-name').trim();
        if (!nm) return 'Please give the style a name.';
        if ((isNew || nm !== name) && styles[nm]) return `A style named “${nm}” already exists.`;
        return null;
      },
    });
    if (!r) return;
    const el = r.el;
    const lead = UI.val(el, 'es-lead').trim().toLowerCase();
    const ns = {
      font: UI.val(el, 'es-font').trim() || 'Noto Serif Kannada', size: UI.num(el, 'es-size') || 11,
      leading: lead === 'auto' ? 'auto' : parseFloat(lead) || 'auto', bold: UI.checked(el, 'es-b'), italic: UI.checked(el, 'es-i'),
      color: UI.val(el, 'es-color'), align: UI.val(el, 'es-align'),
      firstIndent: BV.toPt(UI.num(el, 'es-fi'), u), leftIndent: BV.toPt(UI.num(el, 'es-li'), u), rightIndent: BV.toPt(UI.num(el, 'es-ri'), u),
      spaceBefore: UI.num(el, 'es-sb'), spaceAfter: UI.num(el, 'es-sa'), breakBefore: UI.checked(el, 'es-bb'), keepNext: UI.checked(el, 'es-kn'), next: UI.val(el, 'es-next'),
    };
    const nm = UI.val(el, 'es-name').trim();
    App.checkpoint();
    if (!isNew && nm !== name) {
      // rename: rebuild in same order and repoint paragraphs
      const out = {};
      for (const k of Object.keys(styles)) out[k === name ? nm : k] = styles[k];
      doc().styles = out;
      for (const s of Object.values(doc().stories)) for (const p of s.paras) if (p.style === name) p.style = nm;
      for (const s of Object.values(doc().styles)) if (s.next === name) s.next = nm;
    }
    doc().styles[nm] = ns;
    App.refreshStyles();
    App.changed();
  }

  async function deleteStyle(name) {
    const names = Object.keys(doc().styles);
    if (names.length < 2) return;
    if (!(await UI.confirm(`Delete the style “${name}”? Paragraphs using it will change to “${names.find((n) => n !== name)}”.`, 'Delete'))) return;
    App.checkpoint();
    const repl = names.find((n) => n !== name);
    delete doc().styles[name];
    for (const s of Object.values(doc().stories)) for (const p of s.paras) if (p.style === name) p.style = repl;
    App.refreshStyles();
    App.changed();
  }

  App.editStyle = (n, isNew) => editStyle(n, isNew);
  App.deleteStyle = (n) => deleteStyle(n);
  App.docSetup = (isNew) => docSetup(isNew);
  App.selectedStories = selectedStories;
  App.transliterate = (spec) => transliterate(spec);

  async function typeSpecs() {
    const c = App.currentParaProps();
    const cp = c.cp;
    const r = await UI.dialog({
      title: 'Type Specifications',
      width: 480,
      html: `${fontDatalist()}<div class="row2">
        <label style="grid-column:span 2">Font<input type="text" list="dl-fonts" id="ts-font" value="${esc(cp.font)}"></label>
        <label>Size (pt)<input type="number" step="any" id="ts-size" value="${cp.size}"></label>
        <label>Colour<input type="color" id="ts-color" value="${cp.color || '#000000'}" style="height:26px;padding:0"></label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ts-b" ${cp.bold ? 'checked' : ''}> Bold</label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ts-i" ${cp.italic ? 'checked' : ''}> Italic</label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ts-u" ${cp.underline ? 'checked' : ''}> Underline</label>
        <label>Baseline shift (pt)<input type="number" step="any" id="ts-shift" value="${cp.shift || 0}"></label>
      </div><p class="note">Applies to the selected text. With only a cursor, it applies to what you type next.</p>`,
    });
    if (!r) return;
    const el = r.el;
    App.applyChar({ font: UI.val(el, 'ts-font').trim() || null, size: UI.num(el, 'ts-size') || null, color: UI.val(el, 'ts-color'), bold: UI.checked(el, 'ts-b'), italic: UI.checked(el, 'ts-i'), underline: UI.checked(el, 'ts-u') || null, shift: UI.num(el, 'ts-shift') || null });
  }

  async function paraSpecs() {
    const c = App.currentParaProps();
    const pp = c.pp, u = doc().setup.units;
    const r = await UI.dialog({
      title: 'Paragraph Specifications',
      width: 520,
      html: `<div class="row2">
        <label>Alignment<select id="ps-align">${['left', 'center', 'right', 'justify', 'force'].map((a) => `<option${a === pp.align ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
        <label>Leading (pt)<input type="text" id="ps-lead" value="${pp.leading}"></label>
        <label>Space before (pt)<input type="number" step="any" id="ps-sb" value="${pp.spaceBefore || 0}"></label>
        <label>Space after (pt)<input type="number" step="any" id="ps-sa" value="${pp.spaceAfter || 0}"></label>
        <label>First indent (${BV.UNIT_LABEL[u]})<input type="number" step="any" id="ps-fi" value="${BV.fmt(pp.firstIndent || 0, u)}"></label>
        <label>Left indent<input type="number" step="any" id="ps-li" value="${BV.fmt(pp.leftIndent || 0, u)}"></label>
        <label>Right indent<input type="number" step="any" id="ps-ri" value="${BV.fmt(pp.rightIndent || 0, u)}"></label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-bb" ${pp.breakBefore ? 'checked' : ''}> New block</label>
      </div>`,
    });
    if (!r) return;
    const el = r.el;
    const lead = UI.val(el, 'ps-lead').trim().toLowerCase();
    const vals = {
      align: UI.val(el, 'ps-align'), leading: lead === 'auto' ? 'auto' : parseFloat(lead) || 'auto',
      spaceBefore: UI.num(el, 'ps-sb'), spaceAfter: UI.num(el, 'ps-sa'),
      firstIndent: BV.toPt(UI.num(el, 'ps-fi'), u), leftIndent: BV.toPt(UI.num(el, 'ps-li'), u), rightIndent: BV.toPt(UI.num(el, 'ps-ri'), u), breakBefore: UI.checked(el, 'ps-bb'),
    };
    const ts = textSel();
    const stories = selectedStories();
    if (!stories.length) return UI.status('Select some text first.');
    App.checkpoint();
    for (const st of stories) {
      const [a, b] = ts ? [Math.min(ts.a.p, ts.f.p), Math.max(ts.a.p, ts.f.p)] : [0, st.paras.length - 1];
      for (const k in vals) T.setParaOv(st, a, b, k, vals[k]);
    }
    App.changed();
  }

  async function fillStroke() {
    const items = App.sel.kind === 'items' ? App.sel.ids.map((id) => doc().items[id]).filter((i) => i && i.type !== 'text' && i.type !== 'image') : [];
    if (!items.length) return UI.status('Select a line, rectangle or ellipse first.');
    const it = items[0];
    const r = await UI.dialog({
      title: 'Fill and Stroke',
      html: `<div class="row2">
        <label>Stroke colour<input type="color" id="fs-sc" value="${it.stroke && it.stroke !== 'none' ? it.stroke : '#000000'}" style="height:26px;padding:0"></label>
        <label>Stroke width (pt)<input type="number" step="any" id="fs-sw" value="${it.strokeWidth || 0}"></label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="fs-hasfill" ${it.fill && it.fill !== 'none' ? 'checked' : ''}> Fill</label>
        <label>Fill colour<input type="color" id="fs-fc" value="${it.fill && it.fill !== 'none' ? it.fill : '#dddddd'}" style="height:26px;padding:0"></label>
      </div>`,
    });
    if (!r) return;
    App.checkpoint();
    for (const x of items) {
      x.stroke = UI.val(r.el, 'fs-sc'); x.strokeWidth = UI.num(r.el, 'fs-sw');
      x.fill = UI.checked(r.el, 'fs-hasfill') ? UI.val(r.el, 'fs-fc') : 'none';
    }
    App.changed();
  }

  async function gotoPageDlg() {
    const v = await UI.prompt('Go to Page', 'Page number', String(BV.pageNumber(doc(), (BV.spreads(doc())[App.view.spread] || [0])[0])));
    if (v === null) return;
    const idx = parseInt(v, 10) - doc().setup.startPage;
    if (idx >= 0 && idx < doc().pages.length) App.gotoPage(idx);
    else UI.alert(`There is no page ${v}. This publication has pages ${doc().setup.startPage}–${doc().setup.startPage + doc().pages.length - 1}.`);
  }

  async function insertPagesDlg() {
    const cur = (BV.spreads(doc())[App.view.spread] || [0]);
    const r = await UI.dialog({
      title: 'Insert Pages',
      html: `<div class="row"><label for="ip-n">Number of pages</label><input type="number" id="ip-n" value="2" min="1"></div>
        <div class="row"><label for="ip-w">Where</label><select id="ip-w"><option value="after">After the current page(s)</option><option value="before">Before the current page(s)</option><option value="end">At the end</option></select></div>`,
    });
    if (!r) return;
    const n = Math.max(1, Math.round(UI.num(r.el, 'ip-n')) || 1);
    const w = UI.val(r.el, 'ip-w');
    App.checkpoint();
    let at = w === 'end' ? doc().pages.length : w === 'before' ? cur[0] : cur[cur.length - 1] + 1;
    const pages = [];
    for (let i = 0; i < n; i++) pages.push(BV.newPage(doc()));
    doc().pages.splice(at, 0, ...pages);
    App.changed();
    App.gotoPage(at);
  }

  async function removePagesDlg() {
    const cur = (BV.spreads(doc())[App.view.spread] || [0]);
    const sp = doc().setup.startPage;
    const r = await UI.dialog({
      title: 'Remove Pages',
      html: `<div class="row2"><label>From page<input type="number" id="rp-a" value="${cur[0] + sp}"></label><label>To page<input type="number" id="rp-b" value="${cur[cur.length - 1] + sp}"></label></div>
        <p class="note">Everything on these pages is removed. Text in threaded blocks flows on to the remaining blocks.</p>`,
      buttons: [{ label: 'Remove', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    let a = Math.round(UI.num(r.el, 'rp-a')) - sp, b = Math.round(UI.num(r.el, 'rp-b')) - sp;
    a = Math.max(0, a); b = Math.min(doc().pages.length - 1, b);
    if (b < a) return;
    if (b - a + 1 >= doc().pages.length) return UI.alert('A publication must keep at least one page.');
    App.checkpoint();
    const ids = new Set(doc().pages.slice(a, b + 1).map((p) => p.id));
    App.deleteItems(Object.values(doc().items).filter((it) => ids.has(it.page)).map((it) => it.id));
    doc().pages.splice(a, b - a + 1);
    App.sel = { kind: 'none' };
    App.changed();
    App.gotoPage(Math.min(a, doc().pages.length - 1));
  }

  async function columnGuidesDlg() {
    const cur = App.view.master ? null : (BV.spreads(doc())[App.view.spread] || [0]);
    const page = cur ? doc().pages[cur[0]] : null;
    const u = doc().setup.units;
    const r = await UI.dialog({
      title: 'Column Guides',
      html: `<div class="row2"><label>Number of columns<input type="number" id="cg-n" min="1" max="20" value="${(page && page.columns) || doc().setup.columns}"></label>
        <label>Space between (${BV.UNIT_LABEL[u]})<input type="number" step="any" id="cg-g" value="${BV.fmt((page && page.gutter) ?? doc().setup.gutter, u)}"></label></div>
        <p class="note">${App.view.master ? 'Sets the default columns for every page.' : 'Applies to the pages you are viewing. Columns guide where text flows when you place it.'}</p>`,
    });
    if (!r) return;
    const n = Math.max(1, Math.round(UI.num(r.el, 'cg-n')) || 1), g = BV.toPt(UI.num(r.el, 'cg-g'), u);
    App.checkpoint();
    if (!cur) { doc().setup.columns = n; doc().setup.gutter = g; }
    else for (const i of cur) { doc().pages[i].columns = n; doc().pages[i].gutter = g; }
    App.changed();
  }

  async function frameOptions() {
    const it = App.sel.kind === 'items' && doc().items[App.sel.ids[0]];
    if (!it || it.type !== 'text') return UI.status('Select a text block first.');
    const r = await UI.dialog({
      title: 'Text Frame Options',
      html: `<label class="check"><input type="checkbox" id="fo-ag" ${it.autoGrow ? 'checked' : ''}> Grow downward as text is added (up to the bottom margin)</label>`,
    });
    if (!r) return;
    App.checkpoint();
    it.autoGrow = UI.checked(r.el, 'fo-ag');
    if (it.autoGrow) {
      const p = App.itemPlacement(it);
      const m = BV.pageMargins(doc(), p ? p.side : 'R');
      it.maxH = Math.max(it.h, doc().setup.h - m.bottom - it.y);
    }
    App.changed(it.storyId);
  }

  async function findChange() {
    const st = selectedStories()[0];
    const r = await UI.dialog({
      title: 'Find and Change',
      width: 460,
      html: `<div class="row"><label for="fc-f">Find what</label><input type="text" id="fc-f" value="${esc(App.lastFind || '')}"></div>
        <div class="row"><label for="fc-c">Change to</label><input type="text" id="fc-c" value="${esc(App.lastChange || '')}"></div>
        <div class="row"><label for="fc-scope">Search</label><select id="fc-scope">${st ? '<option value="story">Current story</option>' : ''}<option value="all">All stories</option></select></div>`,
      buttons: [{ label: 'Find next', value: 'find', primary: true }, { label: 'Change all', value: 'all' }, { label: 'Close', value: null }],
    });
    if (!r) return;
    const f = UI.val(r.el, 'fc-f'), c = UI.val(r.el, 'fc-c');
    App.lastFind = f; App.lastChange = c;
    if (!f) return;
    const stories = UI.val(r.el, 'fc-scope') === 'story' && st ? [st] : Object.values(doc().stories);
    if (r.value === 'all') {
      App.checkpoint();
      let n = 0;
      for (const s of stories) for (const para of s.paras) for (const run of para.runs) { const parts = run.t.split(f); n += parts.length - 1; run.t = parts.join(c); }
      App.changed();
      UI.alert(`${n} change${n === 1 ? '' : 's'} made.`);
      return;
    }
    // find next from cursor
    const start = App.sel.kind === 'text' ? App.sel.f : null;
    for (const s of stories) {
      for (let p = 0; p < s.paras.length; p++) {
        const text = T.paraText(s.paras[p]);
        let from = 0;
        if (start && s.id === App.sel.sid) { if (p < start.p) continue; if (p === start.p) from = start.o; }
        const i = text.indexOf(f, from);
        if (i >= 0) {
          App.setTool('text');
          App.sel = { kind: 'text', sid: s.id, a: { p, o: i }, f: { p, o: i + f.length } };
          App.render();
          App.ensureCaretVisible();
          App.focusIME();
          return;
        }
      }
    }
    UI.alert(`“${f}” was not found.`);
  }

  function showShortcuts() {
    const groups = [
      ['File', [['Ctrl+N / Ctrl+O / Ctrl+W', 'New / Open / Close'], ['Ctrl+S / Ctrl+Shift+S', 'Save / Save As (.bvm, .pmd, .pm7, .p65, .pmt)'], ['Ctrl+D', 'Place text or graphic'], ['Ctrl+Shift+D', 'Links Manager'], ['Ctrl+Shift+P', 'Document Setup'], ['Ctrl+P', 'Print'], ['Ctrl+Alt+Shift+P', 'Export Adobe PDF'], ['Ctrl+K', 'Preferences']]],
      ['Zoom and scrolling', [
        ['Ctrl+= / Ctrl+-', 'Zoom in / out (to the cursor when typing)'], ['Ctrl+1 / Ctrl+0', 'Actual size / Fit in window'], ['Ctrl+Shift+0', 'Entire pasteboard'], ['Ctrl+5 / 7 / 2 / 4', '50% / 75% / 200% / 400%'],
        ['Ctrl+Alt+0', 'Fit page width'], ['Ctrl+Alt+Shift+0', 'Fit spread width'], ['Ctrl+Alt+=', 'Zoom to the selection'], ['Ctrl+Alt+-', 'Previous view'], ['Ctrl+Alt+Shift+= / -', 'Zoom in / out a little'],
        ['Ctrl + mouse wheel', 'Zoom at the mouse pointer'], ['Ctrl+Shift + wheel', 'Fine zoom'], ['Ctrl+Alt + wheel', 'Zoom in standard steps'], ['Alt + wheel', 'Previous / next spread'], ['Shift + wheel', 'Scroll sideways'], ['Wheel past the page edge', 'Turns the page'],
        ['Hold Ctrl+Space', 'Zoom tool: click = in, Alt+click = out, drag = zoom to area'], ['Right-click', 'Toggle Fit in window ↔ Actual size'], ['Shift+right-click', 'Toggle 200%'], ['Space + drag', 'Grabber hand'],
        ['Double-click ruler corner', 'Fit in window (or reset a moved zero point)'], ['Drag from ruler corner', 'Move the zero point']]],
      ['Pages', [['PageUp / PageDown', 'Previous / next spread'], ['Ctrl+PageUp / Ctrl+PageDown', 'Go back / Go forward (page history)'], ['Ctrl+Alt+G', 'Go to page']]],
      ['Tools', [['F9', 'Pointer ↔ text tool'], ['Shift+F1 / F4 / F2 / F6', 'Pointer / Text / Rotate / Crop'], ['Shift+F3 / F5 / F7 / F8', 'Line / Rectangle / Ellipse / Polygon']]],
      ['Type', [['Ctrl+T / Ctrl+M / Ctrl+I', 'Character / Paragraph / Indents-Tabs'], ['Ctrl+3', 'Define styles'], ['Ctrl+Shift+Space', 'Normal'], ['Ctrl+Shift+B / I / U', 'Bold / Italic / Underline'], ['Ctrl+Shift+/ / V', 'Strikethru / Reverse'],
        ['Ctrl+Shift+K / H', 'All caps / Small caps'], ['Ctrl+Shift+\\ / Ctrl+\\', 'Superscript / Subscript'], ['Ctrl+Shift+> / <', 'Larger / smaller'], ['Ctrl+Shift+X', 'Normal width'], ['Ctrl+Shift+Q', 'No track'],
        ['Ctrl+Backspace / Ctrl+Shift+Backspace', 'Kern closer / apart 1/25 em (add Alt: 1/100 em)'], ['Ctrl+Shift+-', 'Discretionary hyphen'], ['Ctrl+Alt+Shift+A', 'Auto leading'],
        ['Ctrl+Shift+L / C / R / J / F', 'Align left / center / right / justify / force'], ['Ctrl+Alt+P', 'Page number marker'], ['Shift+Enter', 'Line break']]],
      ['Element', [['Ctrl+U', 'Fill and stroke'], ['Ctrl+F (pointer)', 'Attach content to frame'], ['Ctrl+Alt+F / Ctrl+Alt+Shift+F', 'Frame options / Change to frame'], ['Ctrl+Alt+] / [', 'Next / previous frame in the thread'],
        ['Ctrl+Shift+] / Ctrl+] / Ctrl+[ / Ctrl+Shift+[', 'Front / Forward / Backward / Back'], ['Ctrl+Shift+E / Ctrl+Alt+E', 'Align objects / Text wrap'], ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'], ['Ctrl+L / Ctrl+Alt+L', 'Lock / Unlock'], ['Ctrl+6 / Ctrl+Shift+6', 'Mask / Unmask']]],
      ['Utilities and windows', [['Ctrl+F / Ctrl+G (text)', 'Find / Find next'], ['Ctrl+H', 'Change'], ['Ctrl+L (text)', 'Spelling'], ['Ctrl+Y', 'Index entry'], ['Ctrl+Alt+1 / 2 / 3', 'Transliterate to Devanagari / Kannada / IAST'], ['Ctrl+Alt+I', 'IAST characters'],
        ['Ctrl+\' / Ctrl+J / Ctrl+B', 'Control palette / Colors / Styles'], ['Ctrl+8 / Ctrl+Shift+8 / Ctrl+9', 'Layers / Master pages / Hyperlinks'], ['Ctrl+R / Ctrl+; / Ctrl+Shift+;', 'Rulers / Guides / Snap to guides'], ['Ctrl+Alt+R / Ctrl+Alt+;', 'Snap to rulers / Lock guides'], ['Ctrl+E', 'Story editor ↔ layout']]],
      ['Placing text', [['Click', 'Place one column'], ['Shift+click', 'Semi-autoflow'], ['Ctrl+click', 'Autoflow (adds pages)']]],
    ];
    const html = groups.map(([g, rows]) => `<h3 style="margin:10px 0 4px;font-size:12px">${esc(g)}</h3><table>${rows.map(([k, v]) => `<tr><td style="white-space:nowrap;padding-right:14px"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>`).join('');
    UI.dialog({ title: 'Keyboard Shortcuts', width: 640, html: `<div style="max-height:70vh;overflow:auto">${html}</div>`, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
  }

  // ------------------------------------------------------------------ Story Editor (Ctrl+E)
  App.openStoryEditor = function () {
    const st = selectedStories()[0];
    if (!st) return UI.status('Select a text block or click into text first, then press Ctrl+E.');
    App.seStory = st.id;
    App.seCaret = App.sel.kind === 'text' ? { ...App.sel.f } : null;
    const box = $('se-text');
    box.innerHTML = st.paras.map((para) => {
      const pp = BV.paraProps(doc(), para);
      const inner = para.runs.map((r) => {
        let t = esc(r.t).replace(/\u2028/g, '<br>').replace(/\uE000/g, '<span class="pm" contenteditable="false" data-marker="1" style="background:#eee;padding:0 3px;border-radius:2px">#</span>');
        const data = {};
        for (const k of T.ATTR_KEYS) if (!['bold', 'italic', 'underline'].includes(k) && r[k] !== undefined) data[k] = r[k];
        if (r.underline) t = `<u>${t}</u>`;
        if (r.italic === true) t = `<i>${t}</i>`;
        if (r.bold === true) t = `<b>${t}</b>`;
        if (r.bold === false || r.italic === false) data.nobi = [r.bold === false, r.italic === false];
        if (Object.keys(data).length) t = `<span data-a='${esc(JSON.stringify(data))}'>${t}</span>`;
        return t;
      }).join('');
      return `<div data-style="${esc(para.style)}" data-ov='${esc(JSON.stringify(para.ov || {}))}' style="font-family:${esc(BV.fontFamilyList(pp.font))}">${inner || '<br>'}</div>`;
    }).join('');
    $('se-title').textContent = 'Story: ' + (T.paraText(st.paras[0]).slice(0, 50) || 'Untitled');
    $('story-editor').hidden = false;
    if (window.native) native.menuState({ storyEditor: true });
    document.execCommand('defaultParagraphSeparator', false, 'div');
    seLabels();
    box.focus();
    // place cursor
    try {
      const target = box.children[App.seCaret ? App.seCaret.p : 0];
      if (target) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(!App.seCaret || App.seCaret.o === 0);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        target.scrollIntoView({ block: 'center' });
      }
    } catch (_) {}
  };
  function seLabels() {
    const box = $('se-text'), lab = $('se-styles');
    let h = '';
    for (const d of box.children) {
      if (!d.dataset.style) { const prev = d.previousElementSibling; d.dataset.style = prev ? prev.dataset.style : App.defaultStyle; d.dataset.ov = prev ? prev.dataset.ov : '{}'; }
      h += `<div style="top:${d.offsetTop}px;line-height:${Math.min(d.offsetHeight, 28)}px">${esc(d.dataset.style)}</div>`;
    }
    lab.innerHTML = h;
    lab.style.height = box.scrollHeight + 'px';
  }
  App.closeStoryEditor = function () {
    const st = doc().stories[App.seStory];
    $('story-editor').hidden = true;
    if (window.native) native.menuState({ storyEditor: false });
    if (!st) return;
    const box = $('se-text');
    const paras = [];
    const walk = (node, attrs, runs) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) runs.push(Object.assign({ t: n.nodeValue.replace(/\r?\n/g, ' ') }, attrs));
        else if (n.nodeType === 1) {
          if (n.dataset && n.dataset.marker) { runs.push(Object.assign({ t: BV.PAGE_MARKER }, attrs)); continue; }
          if (n.tagName === 'BR') { if (n.nextSibling || n.previousSibling) runs.push(Object.assign({ t: BV.SOFT_BREAK }, attrs)); continue; }
          const a = { ...attrs };
          const tag = n.tagName;
          if (tag === 'B' || tag === 'STRONG') a.bold = true;
          if (tag === 'I' || tag === 'EM') a.italic = true;
          if (tag === 'U') a.underline = true;
          if (n.dataset && n.dataset.a) {
            try { const d = JSON.parse(n.dataset.a); for (const k of T.ATTR_KEYS) if (!['bold', 'italic', 'underline'].includes(k) && d[k] !== undefined) a[k] = d[k]; if (d.nobi) { if (d.nobi[0] && a.bold === undefined) a.bold = false; if (d.nobi[1] && a.italic === undefined) a.italic = false; } } catch (_) {}
          }
          if (n.style && n.style.fontWeight === 'bold') a.bold = true;
          if (n.style && n.style.fontStyle === 'italic') a.italic = true;
          if (tag === 'DIV' || tag === 'P') { flush(); walkBlock(n); continue; }
          walk(n, a, runs);
        }
      }
    };
    let pending = null;
    const flush = () => { if (pending && pending.runs.length) { paras.push(pending); } pending = null; };
    const walkBlock = (div) => {
      const para = { style: div.dataset.style || App.defaultStyle, runs: [] };
      try { const ov = JSON.parse(div.dataset.ov || '{}'); if (Object.keys(ov).length) para.ov = ov; } catch (_) {}
      walk(div, {}, para.runs);
      if (!para.runs.length) para.runs = [{ t: '' }];
      // drop a trailing soft break that the editor adds
      const last = para.runs[para.runs.length - 1];
      if (last.t.endsWith(BV.SOFT_BREAK)) last.t = last.t.slice(0, -1);
      T.normalize(para);
      paras.push(para);
    };
    for (const n of box.childNodes) {
      if (n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P')) walkBlock(n);
      else if (n.nodeType === 3 && n.nodeValue.trim()) paras.push({ style: App.defaultStyle, runs: [{ t: n.nodeValue }] });
    }
    if (!paras.length) paras.push({ style: st.paras[0].style, runs: [{ t: '' }] });
    if (JSON.stringify(paras) !== JSON.stringify(st.paras)) {
      App.checkpoint();
      paras.forEach((p) => { if (!doc().styles[p.style]) p.style = Object.keys(doc().styles)[0]; });
      st.paras = paras;
      App.changed(st.id);
    }
    if (!st.frames.length) {
      // a New Story that is not on a page yet: load it into the cursor for placing, as PageMaker does
      delete doc().stories[st.id];
      if (st.paras.some((p) => T.paraText(p).trim())) { App.loadTextForPlacing(st.paras); UI.status('The new story is loaded: click a page to place it.', 0); }
      return;
    }
    // caret back into layout at paragraph where the editor cursor was
    const sel = window.getSelection();
    let p = 0;
    if (sel.rangeCount) { let n = sel.anchorNode; while (n && n.parentNode !== box) n = n.parentNode; if (n) p = Array.prototype.indexOf.call(box.children, n); }
    p = Math.max(0, Math.min(st.paras.length - 1, p));
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p, o: 0 }, f: { p, o: 0 } };
    App.render();
    App.ensureCaretVisible();
    App.focusIME();
  };

  // ------------------------------------------------------------------ Place (Ctrl+D)
  App.loadTextForPlacing = function (paras) {
    App.checkpoint();
    const st = BV.newStory(doc(), App.defaultStyle);
    st.paras = paras.length ? paras : st.paras;
    if (App.sel.kind === 'text') App.leaveText();
    App.sel = { kind: 'none' };
    App.setTool('pointer');
    App.setLoaded({ kind: 'text', sid: st.id });
  };

  async function place() {
    const f = await native.place();
    if (!f) return;
    if (f.kind === 'image') {
      const img = new Image();
      img.onload = () => App.setLoaded({ kind: 'image', src: f.dataURL, w: img.naturalWidth || 300, h: img.naturalHeight || 200, name: f.name, link: f.link });
      img.src = f.dataURL;
      return;
    }
    // text: ask how to read paragraphs (+ optional ITRANS conversion)
    const isDocx = f.kind === 'docx';
    const isRtf = f.kind === 'rtf';
    // fonts in Word and RTF files: text in Praja or Nudi fonts can be converted, formatting kept
    const legacyFonts = App.legacySurvey ? App.legacySurvey(f).filter((x) => x.enc) : [];
    if (App.sel.kind === 'text') {
      // PageMaker: with a text cursor, Place inserts at the cursor
    }
    const styles = Object.keys(doc().styles);
    const r = await UI.dialog({
      title: `Place “${f.name}”`,
      width: 500,
      html: `${isDocx || isRtf ? `<p class="note">${isDocx ? 'Word headings become “Chapter title” / “Heading 2”; bold and italic are kept.' : 'Paragraphs, bold and italic are kept.'}</p>${legacyFonts.length ? App.legacyPlanHTML(legacyFonts, { allowKeep: true }) : ''}` : `
        <div class="row"><label for="pl-mode">Paragraphs</label><select id="pl-mode">
          <option value="line">Each line is a paragraph</option>
          <option value="blank">Blank lines separate paragraphs (join lines)</option>
          <option value="verse">Blank lines separate paragraphs (keep line breaks, verses)</option>
        </select></div>`}
        <div class="row"><label for="pl-style">Style</label><select id="pl-style">${styles.map((s) => `<option${s === App.defaultStyle ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="row"><label for="pl-conv">Convert</label><select id="pl-conv"><option value="">No conversion</option><option value="itrans>deva">ITRANS → Devanagari</option><option value="itrans>knda">ITRANS → Kannada</option><option value="itrans>iast">ITRANS → IAST</option><option value="hk>iast">Harvard-Kyoto → IAST</option><option value="auto>knda">Devanagari → Kannada</option><option value="auto>deva">Kannada → Devanagari</option>${isDocx || isRtf ? '' : '<option value="praja>uni">Praja ASCII → Unicode Kannada (Praja Unicode font)</option><option value="nudi>uni">Nudi / Baraha ASCII → Unicode Kannada</option>'}</select></div>
        ${App.sel.kind === 'text' ? '<label class="check"><input type="checkbox" id="pl-insert" checked> Insert at the text cursor</label>' : ''}`,
      buttons: [{ label: 'Place', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
      onOpen: (el) => { if (legacyFonts.length) App.legacyWirePlan(el, legacyFonts); },
    });
    if (!r) return;
    const style = UI.val(r.el, 'pl-style');
    const plan = legacyFonts.length ? App.legacyReadPlan(r.el) : { praja: null, nudi: null };
    const conv = UI.val(r.el, 'pl-conv');
    const legacyConv = conv === 'praja>uni' || conv === 'nudi>uni';
    const cv = (s) => { if (!conv || legacyConv) return s.normalize('NFC'); const [a, b] = conv.split('>'); return BV.translit.convert(s.normalize('NFC'), a, b); };
    let paras;
    if (isRtf || (isDocx && legacyFonts.length && f.parts)) paras = App.legacyParas(f, style, plan).map((pa) => { pa.runs.forEach((run) => { if (!run.legacy) run.t = cv(run.t); }); return pa; });
    else if (isDocx) paras = parseDocxHTML(f.html, style, cv);
    else {
      const mode = UI.val(r.el, 'pl-mode');
      const text = f.text.replace(/\r\n?/g, '\n');
      let blocks;
      if (mode === 'line') blocks = text.split('\n');
      else blocks = text.split(/\n\s*\n/).map((b) => b.replace(/^\n+|\n+$/g, '')).map((b) => (mode === 'blank' ? b.replace(/\s*\n\s*/g, ' ') : b.replace(/\n/g, BV.SOFT_BREAK)));
      if (conv === 'praja>uni') paras = blocks.map((b) => ({ style, runs: [{ t: BV.Legacy.prajaToUnicode(b), font: 'Praja Unicode', legacy: 'praja:Praja' }] }));
      else if (conv === 'nudi>uni') paras = blocks.map((b) => ({ style, runs: [{ t: BV.Legacy.nudiToUnicode(b) }] }));
      else paras = blocks.map((b) => ({ style, runs: [{ t: cv(b) }] }));
    }
    const ins = r.el.querySelector('#pl-insert');
    if (ins && ins.checked && App.sel.kind === 'text') {
      const st = doc().stories[App.sel.sid];
      App.checkpoint();
      let pos = App.sel.f;
      if (T.cmp(App.sel.a, App.sel.f)) pos = T.deleteRange(st, App.sel.a, App.sel.f);
      const np = T.insertFragment(doc(), st, pos, paras);
      App.sel = { kind: 'text', sid: st.id, a: np, f: { ...np } };
      App.changed(st.id);
      App.focusIME();
      return;
    }
    App.loadTextForPlacing(paras);
  }

  function parseDocxHTML(html, baseStyle, cv) {
    const d = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const styles = doc().styles;
    const pick = (n) => (styles[n] ? n : baseStyle);
    const out = [];
    const inline = (node, attrs, runs) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { if (n.nodeValue) runs.push(Object.assign({ t: cv(n.nodeValue.replace(/\s+/g, ' ')) }, attrs)); continue; }
        if (n.nodeType !== 1) continue;
        const a = { ...attrs };
        if (/^(B|STRONG)$/.test(n.tagName)) a.bold = true;
        if (/^(I|EM)$/.test(n.tagName)) a.italic = true;
        if (n.tagName === 'U') a.underline = true;
        if (n.tagName === 'SUP') { a.shift = 3; a.size = 7; }
        if (n.tagName === 'BR') { runs.push(Object.assign({ t: BV.SOFT_BREAK }, attrs)); continue; }
        if (n.tagName === 'IMG') continue;
        inline(n, a, runs);
      }
    };
    const block = (el) => {
      for (const n of el.children) {
        const tag = n.tagName;
        if (/^(UL|OL|TABLE|TBODY|TR|THEAD|BLOCKQUOTE|DIV)$/.test(tag)) { block(n); continue; }
        let style = baseStyle, prefix = '';
        if (tag === 'H1') style = pick('Chapter title');
        else if (/^H[2-6]$/.test(tag)) style = pick('Heading 2');
        else if (tag === 'LI') prefix = n.parentElement && n.parentElement.tagName === 'OL' ? `${Array.prototype.indexOf.call(n.parentElement.children, n) + 1}. ` : '• ';
        const runs = prefix ? [{ t: prefix }] : [];
        inline(n, {}, runs);
        const para = { style, runs: runs.length ? runs : [{ t: '' }] };
        T.normalize(para);
        out.push(para);
      }
    };
    block(d.body);
    // first body paragraph after a heading gets "Body first" if it exists
    for (let i = 1; i < out.length; i++) if (out[i].style === baseStyle && baseStyle === 'Body text' && styles['Body first'] && /Chapter title|Heading 2/.test(out[i - 1].style)) out[i].style = 'Body first';
    return out;
  }

  // ------------------------------------------------------------------ files
  async function confirmDiscard() {
    if (!App.dirty) return true;
    const r = await native.confirm('Save changes to this publication first?', ['Save', "Don't Save", 'Cancel']);
    if (r === 2) return false;
    if (r === 0) return !!(await save(false));
    return true;
  }
  async function save(saveAs) {
    if (App.saveDoc) return App.saveDoc(saveAs);
    const name = App.filePath ? App.filePath.split(/[\\/]/).pop() : 'Untitled.bvm';
    const p = await native.save({ content: BV.serialize(doc()), filePath: App.filePath, saveAs, defaultName: name });
    if (!p) return null;
    App.filePath = p;
    App.setDirty(false);
    UI.status('Saved ' + p.split(/[\\/]/).pop());
    return p;
  }
  async function openContent(data) {
    if (!data) return;
    if (data.error) return UI.alert('Could not open this file: ' + data.error);
    // already open in a tab: just show it
    if (data.path && App.findTab && App.findTab(data.path) >= 0) return App.switchTab(App.findTab(data.path));
    App.wantNewTab = true;
    if (data.kind === 'pm') return App.importPageMaker(data);
    try {
      const d = BV.deserialize(data.content);
      App.setDoc(d, data.path);
      UI.status('Opened ' + data.path.split(/[\\/]/).pop());
    } catch (e) { UI.alert('Could not open this file: ' + e.message); }
  }
  App.openContent = openContent;
  App.confirmDiscard = confirmDiscard;
  App.saveCurrent = save;
  async function exportPdf() {
    if (App.sel.kind === 'text') App.leaveText();
    const { body, css } = BV.Render.printHTML(doc(), App.getLayout);
    const name = (App.filePath ? App.filePath.split(/[\\/]/).pop().replace(/\.bvm$/i, '') : 'Publication') + '.pdf';
    UI.status('Exporting PDF…', 0);
    try {
      const p = await native.exportPdf({ body, css, fontCss: App.fontCssText, defaultName: name });
      if (p) { UI.status('PDF saved: ' + p.split(/[\\/]/).pop()); native.openExternal(p); }
      else UI.status('');
    } catch (e) { UI.alert('PDF export failed: ' + e.message); }
  }

  // ------------------------------------------------------------------ command dispatcher
  App.command = async function (cmd, arg) {
    const af = document.activeElement;
    const inField = App.isFormField(af);
    const seOpen = !$('story-editor').hidden;
    if (seOpen && !['editStory', 'save', 'saveAs', 'bold', 'italic', 'underline', 'undo', 'redo', 'selectAll', 'saveAndQuit', 'exportPdf', 'print', 'iastPalette', 'shortcuts', 'about', 'showTools', 'showControl', 'showColors', 'showStyles', 'showLayers', 'showMasterPal', 'showToolbar', 'closeStory', 'newStory', 'toggleDisplayPara', 'toggleStyleNames', 'spelling', 'wordCount', 'close', 'findChange', 'findNext'].includes(cmd) && !cmd.startsWith('zoom')) return UI.status('Close the story editor (Ctrl+E) to use this.');
    if (inField && !seOpen) {
      if (cmd === 'undo') return document.execCommand('undo');
      if (cmd === 'redo') return document.execCommand('redo');
      if (cmd === 'selectAll') return af.select && af.select();
    }
    if (seOpen) {
      if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') return document.execCommand(cmd);
      if (cmd === 'undo') return document.execCommand('undo');
      if (cmd === 'redo') return document.execCommand('redo');
      if (cmd === 'selectAll') return document.execCommand('selectAll');
      if (cmd === 'editStory' || cmd === 'closeStory' || cmd === 'close') return App.closeStoryEditor();
      if (cmd === 'save' || cmd === 'saveAs' || cmd === 'saveAndQuit' || cmd === 'exportPdf') App.closeStoryEditor();
    }
    if (cmd.startsWith('tr:')) return transliterate(cmd.slice(3));
    if (cmd.startsWith('zoom:')) {
      const z = cmd.slice(5);
      const r = $('board').getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      if (z === 'fit') { App.rememberView(); App.view.fit = true; return App.fitZoom(); }
      if (z === 'in') return App.zoomStep(1, App.sel.kind === 'text' && App.caretClient ? App.caretClient : c);
      if (z === 'out') return App.zoomStep(-1, c);
      if (z === 'inSmall') return App.setZoom(App.view.zoom * 1.1, c);
      if (z === 'outSmall') return App.setZoom(App.view.zoom / 1.1, c);
      if (z === 'previous') return App.previousView();
      if (z === 'pasteboard') return App.command2('zoom:pasteboard');
      if (z === 'width' || z === 'spreadwidth') {
        const b = $('board');
        const W = z === 'width' ? doc().setup.w : BV.spreadWidth(doc());
        App.setZoom((b.clientWidth - 40) / (W * 96 / 72), null);
        const p0 = App.placements.find((p) => App.mouseSpread && App.mouseSpread.x >= p.x0 && App.mouseSpread.x <= p.x0 + doc().setup.w) || App.placements[App.placements.length - 1];
        const bd = $('board');
        const cy = App.clientToSpread(0, bd.getBoundingClientRect().top + bd.clientHeight / 2).y;
        return App.centerOn(z === 'width' ? p0.x0 + doc().setup.w / 2 : BV.spreadWidth(doc()) / 2, Math.max(0, Math.min(doc().setup.h, cy)));
      }
      if (z === 'selection') {
        let bx = null;
        if (App.sel.kind === 'items') { const its = App.sel.ids.map((id) => doc().items[id]).filter(Boolean); const p0 = App.itemPlacement(its[0]); if (p0) { const bb = App.selBounds(its); bx = { x: bb.x + p0.x0, y: bb.y, w: bb.w, h: bb.h }; } }
        else if (App.sel.kind === 'text') { const loc = App.locate(App.sel.sid, App.sel.f); if (loc && loc.p) bx = { x: loc.p.x0 + loc.it.x, y: loc.it.y + loc.top - 20, w: loc.it.w, h: loc.h + 40 }; }
        if (!bx) return UI.status('Select something to zoom to.');
        return App.zoomToBox(bx, 40);
      }
      if (z === 'other') { const v = await UI.prompt('Other View Size', 'Zoom (%)', Math.round(App.view.zoom * 100)); if (v) App.setZoom(parseFloat(v) / 100, c); return; }
      let anchor = c;
      if (App.sel.kind === 'text' && App.caretClient) anchor = App.caretClient;
      return App.setZoom(parseFloat(z), anchor);
    }
    switch (cmd) {
      case 'new': {
        // each publication opens in its own tab, so nothing needs saving first
        const s = await docSetup(true);
        if (s) { App.wantNewTab = true; App.setDoc(BV.newDocument(s), null); }
        return;
      }
      case 'open': {
        const d = await native.open();
        if (d) App.openContent(d);
        return;
      }
      case 'close': {
        if (!(await confirmDiscard())) return;
        App.setDoc(BV.newDocument(), null);
        return;
      }
      case 'save': return save(false);
      case 'saveAs': return save(true);
      case 'saveAndQuit': { const p = await save(false); if (p) native.quitNow(); return; }
      case 'revert': {
        if (!App.filePath) return;
        if (!(await UI.confirm('Go back to the last saved version? Changes since then will be lost.', 'Revert'))) return;
        App.setDirty(false);
        const d = await native.readFile(App.filePath).catch(() => null);
        if (d) openContent({ path: App.filePath, content: d });
        return;
      }
      case 'place': return place();
      case 'exportPdf': return App.exportPdfDialog ? App.exportPdfDialog() : exportPdf();
      case 'docSetup': return docSetup(false);
      case 'undo': return App.undo();
      case 'redo': return App.redo();
      case 'clear':
        if (App.sel.kind === 'items') { App.checkpoint(); App.deleteItems(App.sel.ids); App.sel = { kind: 'none' }; App.changed(); }
        else if (App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f)) { const st = doc().stories[App.sel.sid]; App.checkpoint(); const np = T.deleteRange(st, App.sel.a, App.sel.f); App.sel = { kind: 'text', sid: st.id, a: np, f: { ...np } }; App.changed(st.id); }
        return;
      case 'selectAll':
        if (App.sel.kind === 'text') { const st = doc().stories[App.sel.sid]; App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: 0 }, f: T.storyEnd(st) }; App.render(); }
        else { App.setTool('pointer'); const ids = App.visibleItems().filter((v) => !BV.layerOf(doc(), v.it).locked).map((v) => v.it.id); App.sel = ids.length ? { kind: 'items', ids } : { kind: 'none' }; App.render(); }
        return;
      case 'editStory': return App.openStoryEditor();
      case 'findChange': return findChange();
      case 'gotoPage': return gotoPageDlg();
      case 'prevPage': return App.gotoSpread(App.view.spread - 1);
      case 'nextPage': return App.gotoSpread(App.view.spread + 1);
      case 'insertPages': return insertPagesDlg();
      case 'removePages': return removePagesDlg();
      case 'columnGuides': return columnGuidesDlg();
      case 'toggleAutoflow': App.autoflow = !App.autoflow; native.menuState({ autoflow: App.autoflow }); UI.status(App.autoflow ? 'Autoflow on: placing text fills pages automatically.' : 'Autoflow off.'); return;
      case 'toggleMasterItems': {
        App.showMasters = !App.showMasters; native.menuState({ masters: App.showMasters }); App.render(); return;
      }
      case 'gotoMasters': return App.gotoSpread(0, true);
      case 'typeSpecs': return App.typeSpecs ? App.typeSpecs() : typeSpecs();
      case 'paraSpecs': return App.paraSpecs ? App.paraSpecs() : paraSpecs();
      case 'defineStyles': return editStyle(App.currentParaProps().style, false);
      case 'bold': return toggleChar('bold');
      case 'italic': return toggleChar('italic');
      case 'underline': return toggleChar('underline');
      case 'sizeUp': case 'sizeDown': { const c = App.currentParaProps(); return App.applyChar({ size: Math.max(4, Math.round((c.cp.size + (cmd === 'sizeUp' ? 1 : -1)) * 10) / 10) }); }
      case 'alignLeft': return App.applyPara('align', 'left');
      case 'alignCenter': return App.applyPara('align', 'center');
      case 'alignRight': return App.applyPara('align', 'right');
      case 'alignJustify': return App.applyPara('align', 'justify');
      case 'alignForce': return App.applyPara('align', 'force');
      case 'pageMarker':
        if (App.sel.kind !== 'text') return UI.status('Click into a text block (usually on a master page) first.');
        return App.insertText(BV.PAGE_MARKER);
      case 'iastPalette': return App.showPanel('iast-pal');
      case 'front': case 'back': case 'forward': case 'backward': {
        if (App.sel.kind !== 'items') return;
        App.checkpoint();
        const zs = Object.values(doc().items).map((i) => i.z || 0);
        const max = Math.max(0, ...zs), min = Math.min(0, ...zs);
        App.sel.ids.forEach((id, k) => {
          const it = doc().items[id];
          if (cmd === 'front') it.z = max + 1 + k;
          else if (cmd === 'back') it.z = min - 1 - k;
          else it.z = (it.z || 0) + (cmd === 'forward' ? 1.5 : -1.5);
        });
        App.changed();
        return;
      }
      case 'fillStroke': return fillStroke();
      case 'frameOptions': return frameOptions();
      case 'dupTranslit': return dupTranslit();
      case 'storyInfo': { const st = selectedStories()[0]; if (!st) return UI.status('Select a story first.'); const txt = st.paras.map(T.paraText).join('\n'); return UI.alert(`Paragraphs: ${st.paras.length}\nWords: ${(txt.match(/\S+/g) || []).length}\nCharacters: ${[...txt].length}\nText blocks: ${st.frames.length}`); }
      case 'toggleRulers': App.showRulers = !App.showRulers; document.body.classList.toggle('hide-rulers', !App.showRulers); native.menuState({ rulers: App.showRulers }); App.render(); return;
      case 'toggleGuides': App.showGuides = !App.showGuides; native.menuState({ guides: App.showGuides }); App.render(); return;
      case 'toggleSnap': App.snap = !App.snap; native.menuState({ snap: App.snap }); UI.status(App.snap ? 'Snap to guides on.' : 'Snap to guides off.'); return;

      case 'shortcuts': return showShortcuts();
      case 'about': return App.showWelcome();
      default: if (App.command2) return App.command2(cmd, arg);
    }
  };

  // ------------------------------------------------------------------ wiring
  function wire() {
    $('page-icons').addEventListener('click', (e) => {
      const b = e.target.closest('.pgicon');
      if (!b) return;
      if (b.dataset.m) {
        // go to the master used by the pages in view (PageMaker: the L/R icons)
        const pl = App.placements.find((p) => p.idx >= 0);
        const id = pl ? BV.pageMasterId(doc(), doc().pages[pl.idx]) : null;
        App.gotoSpread(0, App.view.master ? App.view.master : id || true);
      }
      else App.gotoPage(+b.dataset.i);
    });
    $('se-close').onclick = () => App.closeStoryEditor();
    $('se-text').addEventListener('input', seLabels);
    $('se-text').addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').normalize('NFC')); });
    window.addEventListener('resize', () => { if (!$('story-editor').hidden) seLabels(); });
  }

  // ------------------------------------------------------------------ start-up
  async function start() {
    App.initPanels();
    App.setDoc(BV.newDocument(), null);
    wire();
    App.initInput();
    App.setTool('pointer');
    App.refreshColors(); App.refreshLayers(); App.refreshMasters();
    if (window.native) {
      native.onMenu((cmd, arg) => App.command(cmd, arg));
      native.onOpenFile((d) => App.openContent(d));
    }
    const selftest = /selftest/.test(location.search);
    if (!selftest && App.store.get('welcome', true)) App.showWelcome();
    await App.loadFonts();
    App.markAll();
    App.render();
    App.readyResolve();
  }
  start().catch((e) => { window.__err = String(e && e.stack || e); console.error(e); });
})();
