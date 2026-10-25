/* BV Mudrana: PageMaker commands: import, colours, object transforms, alignment, wrap, groups,
   frames, tabs, table of contents, preferences, printing. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text, UI = BV.UI;
  const $ = (id) => document.getElementById(id);
  const doc = () => App.doc;
  const esc = BV.Render.esc;
  const selItems = () => (App.sel.kind === 'items' ? App.sel.ids.map((id) => doc().items[id]).filter(Boolean) : []);
  const fontBox = (id, value) => `<div class="fontbox"><input id="${id}" value="${esc(value)}" spellcheck="false" autocomplete="off" style="width:100%"><button class="fdrop" tabindex="-1" data-fontfor="${id}">▾</button></div>`;
  const prefs = () => Object.assign({ kannadaFont: 'Noto Serif Kannada', nudiScale: 90, units: 'mm', welcome: true }, App.store.get('prefs', {}));

  // ------------------------------------------------------------------ PageMaker import
  App.importPageMaker = async function (data) {
    const pm = data.pm;
    const p = prefs();
    const fontsUsed = new Map();
    for (const st of Object.values(pm.stories)) for (const c of st.chars) { const f = pm.fonts[c.font]; if (f) fontsUsed.set(f, (fontsUsed.get(f) || 0) + c.len); }
    const avail = App.fontSet || new Set(App.fontList);
    const rows = [...fontsUsed.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => {
      const enc = BV.Legacy.encodingForFont(f);
      const what = enc === 'nudi' ? '<b>Nudi → Unicode</b>' : enc ? 'legacy (kept as is)' : avail.has(f) ? 'installed' : '<span style="color:#b33">not installed</span>';
      return `<tr><td>${esc(f)}</td><td>${n.toLocaleString()} chars</td><td>${what}</td></tr>`;
    }).join('');
    const S = pm.setup;
    const mm = (tw) => Math.round(tw / 20 / BV.UNITS.mm);
    const hasNudi = [...fontsUsed.keys()].some((f) => BV.Legacy.encodingForFont(f) === 'nudi');
    const r = await UI.dialog({
      title: `Open PageMaker publication: ${data.name}`,
      width: 660,
      html: `<p class="note" style="font-size:12px;color:var(--ink)">${pm.spreads.length} pages · ${mm(S.pageW)} × ${mm(S.pageH)} mm · ${S.doubleSided ? 'double-sided' : 'single-sided'} · ${Object.keys(pm.stories).length} stories</p>
        <div style="max-height:180px;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff"><table>${rows}</table></div>
        ${hasNudi ? `<fieldset><legend>Kannada text typed in Nudi / Baraha (ASCII) fonts</legend>
          <label class="check" style="flex-direction:row;color:var(--ink)"><input type="radio" name="im-mode" value="convert" ${p.keepAscii ? '' : 'checked'}> Convert to Unicode Kannada (recommended, searchable, works with any Unicode font)</label>
          <label class="check" style="flex-direction:row;color:var(--ink)"><input type="radio" name="im-mode" value="keep" ${p.keepAscii ? 'checked' : ''}> Keep as ASCII text in its original Nudi font (looks exactly as in PageMaker; needs the Nudi fonts installed)</label>
          <div id="im-conv" style="display:grid;gap:8px;margin-top:8px">
            <div class="row"><label for="im-kf">Unicode font for Kannada</label>${fontBox('im-kf', p.kannadaFont)}</div>
            <div class="row"><label for="im-scale">Kannada type size</label><select id="im-scale">${[80, 85, 90, 95, 100, 105, 110].map((v) => `<option value="${v}"${v === +p.nudiScale ? ' selected' : ''}>${v}% of the Nudi size</option>`).join('')}</select></div>
            <p class="note">Converted with the Brahmavidya Kannada converter. Nudi letters are drawn smaller than most Unicode fonts at the same point size, so 85–90% usually keeps the original line breaks closest.</p>
          </div>
        </fieldset>` : ''}
        <p class="note">The original file is not changed. Save the result as .bvm, or back to PageMaker format with File ▸ Save As.</p>`,
      onOpen: (el) => {
        const sync = () => { const c = el.querySelector('#im-conv'); if (c) c.style.opacity = el.querySelector('input[name=im-mode]:checked').value === 'convert' ? 1 : 0.45; };
        el.querySelectorAll('input[name=im-mode]').forEach((i) => i.addEventListener('change', sync));
        if (hasNudi) sync();
      },
      buttons: [{ label: 'Open', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const keepAscii = hasNudi && r.el.querySelector('input[name=im-mode]:checked').value === 'keep';
    const kfont = hasNudi ? UI.val(r.el, 'im-kf').trim() || 'Noto Serif Kannada' : p.kannadaFont;
    const scale = hasNudi ? +UI.val(r.el, 'im-scale') / 100 : p.nudiScale / 100;
    App.store.set('prefs', Object.assign(prefs(), { kannadaFont: kfont, nudiScale: scale * 100, keepAscii }));
    UI.status('Opening…', 0);
    await new Promise((res) => setTimeout(res, 30));
    try {
      const { doc: d, report } = BV.PMImport.toDoc(pm, { kannadaFont: kfont, nudiScale: scale, availableFonts: avail, keepAscii });
      App.setDoc(d, null);
      App.docName = data.name.replace(/\.(pmd|pm7|p65|pm6|pt6|t65|pmt)$/i, '');
      App.setDirty(true);
      App.refreshColors(); App.refreshLayers();
      const missing = Object.keys(report.missingFonts);
      UI.status(`Opened ${data.name}: ${report.pages} pages, ${report.stories} stories` + (keepAscii ? ', Kannada kept as ASCII.' : `, ${report.convertedChars.toLocaleString()} Kannada characters converted to Unicode.`), 12000);
      App.pmSource = { name: data.name, path: data.path };
      if (missing.length || report.imagesMissing) {
        UI.alert(`${data.name} is open.${missing.length ? `\n\nThese fonts are not installed, so a similar font is used: ${missing.join(', ')}.` : ''}${report.imagesMissing ? `\n\n${report.imagesMissing} graphic(s) could not be shown (linked or in an unsupported format); grey boxes mark where they were.` : ''}`);
      }
    } catch (e) {
      console.error(e);
      UI.alert('Could not convert this PageMaker file: ' + e.message);
    }
  };

  // ------------------------------------------------------------------ colours
  function tintHex(hex, tint) {
    if (!tint || tint >= 100) return hex;
    const rgb = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    return '#' + rgb.map((v) => Math.round(v * tint / 100 + 255 * (1 - tint / 100)).toString(16).padStart(2, '0')).join('');
  }
  App.applyColor = function (name, tint) {
    const c = doc().colors.find((x) => x.name === name);
    const hex = name === '[None]' ? 'none' : c ? tintHex(c.hex, tint) : '#000000';
    if (App.sel.kind === 'text') return App.applyChar({ color: hex === 'none' ? null : hex });
    const its = selItems();
    if (!its.length) return UI.status('Select text or objects, then click a colour.');
    App.checkpoint();
    for (const it of its) {
      if (it.type === 'text') {
        const st = doc().stories[it.storyId];
        if (App.colorMode === 'fill') it.fill = hex;
        else T.applyChar(st, { p: 0, o: 0 }, T.storyEnd(st), { color: hex === 'none' ? null : hex });
        continue;
      }
      if (App.colorMode !== 'fill') { it.stroke = hex; if (hex !== 'none' && !(it.strokeWidth > 0)) it.strokeWidth = 0.5; }
      if (App.colorMode !== 'stroke' && it.type !== 'line') it.fill = hex;
    }
    App.changed();
  };
  App.editColor = async function (name) {
    const c = name ? doc().colors.find((x) => x.name === name) : null;
    if (c && c.fixed && name !== 'Black' && name !== 'Registration') return UI.status(`“${name}” cannot be edited.`);
    const r = await UI.dialog({
      title: c ? `Color Options: ${c.name}` : 'New Color',
      html: `<div class="row"><label for="ce-n">Name</label><input type="text" id="ce-n" value="${esc(c ? c.name : 'New color')}" ${c && c.fixed ? 'disabled' : ''}></div>
        <div class="row"><label for="ce-c">Colour</label><input type="color" id="ce-c" value="${c ? c.hex : '#2a6be0'}" style="height:30px;padding:0;width:80px"></div>
        <div class="grid3"><label>C %<input type="number" id="ce-cc" min="0" max="100"></label><label>M %<input type="number" id="ce-cm" min="0" max="100"></label><label>Y %<input type="number" id="ce-cy" min="0" max="100"></label><label>K %<input type="number" id="ce-ck" min="0" max="100"></label></div>
        <p class="note">Pick a colour or type CMYK values (for printing presses).</p>`,
      onOpen: (el) => {
        const cIn = el.querySelector('#ce-c');
        const fromHex = () => {
          const [r0, g0, b0] = [1, 3, 5].map((k) => parseInt(cIn.value.slice(k, k + 2), 16) / 255);
          const k = 1 - Math.max(r0, g0, b0);
          const f = (v) => (k >= 1 ? 0 : Math.round(((1 - v - k) / (1 - k)) * 100));
          el.querySelector('#ce-cc').value = f(r0); el.querySelector('#ce-cm').value = f(g0); el.querySelector('#ce-cy').value = f(b0); el.querySelector('#ce-ck').value = Math.round(k * 100);
        };
        const fromCmyk = () => {
          const v = (id) => (+el.querySelector(id).value || 0) / 100;
          const C = v('#ce-cc'), M = v('#ce-cm'), Y = v('#ce-cy'), K = v('#ce-ck');
          cIn.value = '#' + [C, M, Y].map((x) => Math.round(255 * (1 - x) * (1 - K)).toString(16).padStart(2, '0')).join('');
        };
        cIn.addEventListener('input', fromHex);
        el.querySelectorAll('.grid3 input').forEach((i) => i.addEventListener('input', fromCmyk));
        fromHex();
      },
    });
    if (!r) return;
    const nm = UI.val(r.el, 'ce-n').trim() || 'Color';
    const hex = UI.val(r.el, 'ce-c');
    App.checkpoint();
    if (c) {
      const old = c.hex;
      c.hex = hex;
      if (!c.fixed) c.name = nm;
      // recolour objects that used the old colour
      for (const it of Object.values(doc().items)) { if (it.stroke === old) it.stroke = hex; if (it.fill === old) it.fill = hex; }
    } else doc().colors.push({ name: nm, hex });
    App.selectedColor = nm;
    App.refreshColors();
    App.changed();
  };
  App.deleteColor = async function (name) {
    const c = doc().colors.find((x) => x.name === name);
    if (!c) return UI.status('Click a colour first.');
    if (c.fixed) return UI.status(`“${name}” is a standard colour and cannot be removed.`);
    if (!(await UI.confirm(`Remove the colour “${name}”? Objects keep their current colour.`, 'Remove'))) return;
    App.checkpoint();
    doc().colors = doc().colors.filter((x) => x !== c);
    App.selectedColor = null;
    App.refreshColors();
    App.setDirty(true);
  };

  // ------------------------------------------------------------------ control palette: object fields
  App.setObjField = function (k, v) {
    const its = selItems().filter((i) => !i.locked);
    if (!its.length) return;
    const u = doc().setup.units;
    const val = parseFloat(v);
    if (isNaN(val)) return App.syncControls(true);
    App.checkpoint();
    const b = App.selBounds(its);
    const ref = App.refRef || 0;
    const fx = (ref % 3) / 2, fy = Math.floor(ref / 3) / 2;
    const rx = b.x + fx * b.w, ry = b.y + fy * b.h;
    const scaleAll = (sx, sy) => {
      for (const it of its) {
        const ob = BV.Render.box(it);
        const nx = rx + (ob.x - rx) * sx, ny = ry + (ob.y - ry) * sy;
        if (it.type === 'line') { it.x = rx + (it.x - rx) * sx; it.y = ry + (it.y - ry) * sy; it.w *= sx; it.h *= sy; continue; }
        if (it.src) { it.cx = (it.cx ?? 0) * sx; it.cy = (it.cy ?? 0) * sy; it.cw = (it.cw ?? ob.w) * sx; it.ch = (it.ch ?? ob.h) * sy; }
        it.x = nx; it.y = ny; it.w = ob.w * sx; it.h = ob.h * sy;
        if (it.type === 'text') { it.autoGrow = false; }
      }
    };
    if (k === 'x' || k === 'y') {
      const target = BV.toPt(val, u);
      const dx = k === 'x' ? target - rx : 0, dy = k === 'y' ? target - ry : 0;
      for (const it of its) { it.x += dx; it.y += dy; }
    } else if (k === 'w' || k === 'h') {
      const target = Math.max(1, BV.toPt(val, u));
      if (k === 'w') scaleAll(target / (b.w || 1), 1); else scaleAll(1, target / (b.h || 1));
    } else if (k === 'sw' || k === 'sh') {
      const f = Math.max(1, val) / 100;
      if (k === 'sw') scaleAll(f, 1); else scaleAll(1, f);
    } else if (k === 'rot') {
      for (const it of its) it.rot = ((val + 540) % 360) - 180 || 0;
    } else if (k === 'stroke') {
      for (const it of its) if (it.type !== 'text') { it.strokeWidth = Math.max(0, val); if (val > 0 && (!it.stroke || it.stroke === 'none')) it.stroke = '#000000'; }
    }
    App.changed();
  };

  // ------------------------------------------------------------------ dialogs
  async function alignObjects() {
    const its = selItems();
    if (its.length < 2) return UI.status('Select two or more objects to align.');
    const r = await UI.dialog({
      title: 'Align Objects',
      html: `<div class="row"><label for="al-h">Horizontal</label><select id="al-h"><option value="">No change</option><option value="left">Align left edges</option><option value="center">Align centres</option><option value="right">Align right edges</option><option value="dist">Distribute evenly</option></select></div>
        <div class="row"><label for="al-v">Vertical</label><select id="al-v"><option value="">No change</option><option value="top">Align top edges</option><option value="middle">Align centres</option><option value="bottom">Align bottom edges</option><option value="dist">Distribute evenly</option></select></div>`,
    });
    if (!r) return;
    const h = UI.val(r.el, 'al-h'), v = UI.val(r.el, 'al-v');
    App.checkpoint();
    const B = App.selBounds(its);
    const boxes = its.map((it) => ({ it, b: BV.Render.box(it) }));
    const move = (it, dx, dy) => { it.x += dx; it.y += dy; };
    if (h === 'left') boxes.forEach(({ it, b }) => move(it, B.x - b.x, 0));
    if (h === 'right') boxes.forEach(({ it, b }) => move(it, B.x + B.w - b.x - b.w, 0));
    if (h === 'center') boxes.forEach(({ it, b }) => move(it, B.x + B.w / 2 - b.x - b.w / 2, 0));
    if (h === 'dist') { const s = boxes.sort((a, b) => a.b.x - b.b.x); const total = s.reduce((a, x) => a + x.b.w, 0); const gap = (B.w - total) / (s.length - 1); let x = B.x; s.forEach(({ it, b }) => { move(it, x - b.x, 0); x += b.w + gap; }); }
    if (v === 'top') boxes.forEach(({ it, b }) => move(it, 0, B.y - b.y));
    if (v === 'bottom') boxes.forEach(({ it, b }) => move(it, 0, B.y + B.h - b.y - b.h));
    if (v === 'middle') boxes.forEach(({ it, b }) => move(it, 0, B.y + B.h / 2 - b.y - b.h / 2));
    if (v === 'dist') { const s = boxes.sort((a, b) => a.b.y - b.b.y); const total = s.reduce((a, x) => a + x.b.h, 0); const gap = (B.h - total) / (s.length - 1); let y = B.y; s.forEach(({ it, b }) => { move(it, 0, y - b.y); y += b.h + gap; }); }
    App.changed();
  }

  async function textWrap() {
    const its = selItems();
    if (!its.length) return UI.status('Select a graphic or object to wrap text around.');
    const w = its[0].wrap || { type: 'none', standoff: 6 };
    const u = doc().setup.units;
    const r = await UI.dialog({
      title: 'Text Wrap',
      html: `<div class="row"><label for="tw-t">Wrap option</label><select id="tw-t"><option value="none"${w.type !== 'rect' ? ' selected' : ''}>None: text runs over</option><option value="rect"${w.type === 'rect' ? ' selected' : ''}>Rectangular, text flows around all sides</option></select></div>
        <div class="row"><label for="tw-s">Standoff (${BV.UNIT_LABEL[u]})</label><input type="number" step="any" id="tw-s" value="${BV.fmt(w.standoff ?? 6, u)}"></div>
        <p class="note">Text on the same page flows around the object, on both sides when there is room.</p>`,
    });
    if (!r) return;
    App.checkpoint();
    const t = UI.val(r.el, 'tw-t'), so = BV.toPt(UI.num(r.el, 'tw-s'), u);
    for (const it of its) { if (t === 'none') delete it.wrap; else it.wrap = { type: 'rect', standoff: so }; }
    App.changed();
  }

  async function roundedCorners() {
    const cur = App.store.get('cornerRadius', 0);
    const r = await UI.dialog({
      title: 'Rounded Corners',
      html: `<div class="row"><label for="rc-r">Corner radius (pt)</label><select id="rc-r">${[0, 3, 6, 9, 12, 18, 24].map((v) => `<option value="${v}"${v === cur ? ' selected' : ''}>${v === 0 ? 'Square' : v + ' pt'}</option>`).join('')}</select></div>`,
    });
    if (!r) return;
    const v = +UI.val(r.el, 'rc-r');
    App.store.set('cornerRadius', v);
    const rects = selItems().filter((i) => i.type === 'rect');
    if (rects.length) { App.checkpoint(); rects.forEach((i) => (i.radius = v)); App.changed(); }
  }

  async function polygonSettings() {
    const set = App.store.get('polygon', { sides: 6, star: 0 });
    const r = await UI.dialog({
      title: 'Polygon Settings',
      html: `<div class="row"><label for="pg-n">Number of sides</label><input type="number" id="pg-n" min="3" max="100" value="${set.sides}"></div>
        <div class="row"><label for="pg-s">Star inset (%)</label><input type="number" id="pg-s" min="0" max="95" value="${set.star}"></div>
        <p class="note">Drag with the polygon tool to draw a regular polygon or star. Click instead to draw any shape point by point.</p>`,
    });
    if (!r) return;
    App.store.set('polygon', { sides: Math.max(3, Math.round(UI.num(r.el, 'pg-n')) || 6), star: Math.max(0, Math.min(95, UI.num(r.el, 'pg-s'))) });
  }

  async function indentsTabs() {
    const c = App.currentParaProps();
    if (!c || App.sel.kind !== 'text') return UI.status('Click into a paragraph first.');
    const u = doc().setup.units;
    const tabs = (c.pp.tabs || []).slice();
    const row = (t) => `<div class="row2 tabrow"><label>Position (${BV.UNIT_LABEL[u]})<input type="number" step="any" class="tp" value="${BV.fmt(t.pos, u)}"></label><label>Alignment<select class="ta">${['left', 'center', 'right'].map((a) => `<option${a === t.align ? ' selected' : ''}>${a}</option>`).join('')}</select></label><label>&nbsp;<button class="btn tdel" type="button">Remove</button></label></div>`;
    const r = await UI.dialog({
      title: 'Indents / Tabs',
      width: 560,
      html: `<div class="row2"><label>Left indent<input type="number" step="any" id="it-li" value="${BV.fmt(c.pp.leftIndent || 0, u)}"></label><label>First line<input type="number" step="any" id="it-fi" value="${BV.fmt(c.pp.firstIndent || 0, u)}"></label><label>Right indent<input type="number" step="any" id="it-ri" value="${BV.fmt(c.pp.rightIndent || 0, u)}"></label></div>
        <fieldset><legend>Tab stops</legend><div id="it-tabs">${tabs.map(row).join('')}</div><button class="btn" type="button" id="it-add" style="margin-top:6px">Add tab stop</button></fieldset>
        <p class="note">Without tab stops, tabs jump every half inch, like PageMaker. A right tab at the end of the line is handy for page numbers in a contents list.</p>`,
      onOpen: (el) => {
        el.querySelector('#it-add').onclick = () => { el.querySelector('#it-tabs').insertAdjacentHTML('beforeend', row({ pos: 36 * (el.querySelectorAll('.tabrow').length + 1), align: 'left' })); };
        el.addEventListener('click', (e) => { if (e.target.classList.contains('tdel')) e.target.closest('.tabrow').remove(); });
      },
    });
    if (!r) return;
    const nt = [...r.el.querySelectorAll('.tabrow')].map((rw) => ({ pos: BV.toPt(parseFloat(rw.querySelector('.tp').value) || 0, u), align: rw.querySelector('.ta').value })).filter((t) => t.pos > 0).sort((a, b) => a.pos - b.pos);
    const st = doc().stories[App.sel.sid];
    App.checkpoint();
    const [a, b] = [Math.min(App.sel.a.p, App.sel.f.p), Math.max(App.sel.a.p, App.sel.f.p)];
    T.setParaOv(st, a, b, 'tabs', nt.length ? nt : null);
    T.setParaOv(st, a, b, 'leftIndent', BV.toPt(UI.num(r.el, 'it-li'), u));
    T.setParaOv(st, a, b, 'firstIndent', BV.toPt(UI.num(r.el, 'it-fi'), u));
    T.setParaOv(st, a, b, 'rightIndent', BV.toPt(UI.num(r.el, 'it-ri'), u));
    App.changed(st.id);
    App.focusIME();
  }

  async function fontDialog() {
    const c = App.currentParaProps();
    const r = await UI.dialog({ title: 'Font', html: `<div class="row"><label for="fd-f">Font</label>${fontBox('fd-f', c.cp.font)}</div><p class="note">Every font installed on this computer is listed, plus the Unicode fonts that come with BV Mudrana.</p>` });
    if (!r) return;
    const f = UI.val(r.el, 'fd-f').trim();
    if (f) App.applyChar({ font: f });
  }

  async function preferences() {
    const p = prefs();
    const r = await UI.dialog({
      title: 'Preferences',
      width: 520,
      html: `<div class="row"><label for="pf-u">Measurements in</label><select id="pf-u">${Object.keys(BV.UNITS).map((u) => `<option value="${u}"${u === doc().setup.units ? ' selected' : ''}>${BV.UNIT_LABEL[u]}</option>`).join('')}</select></div>
        <div class="row"><label for="pf-kf">Kannada font for Nudi text</label>${fontBox('pf-kf', p.kannadaFont)}</div>
        <div class="row"><label for="pf-ns">Nudi size when converting</label><select id="pf-ns">${[80, 85, 90, 95, 100, 105, 110].map((v) => `<option value="${v}"${v === +p.nudiScale ? ' selected' : ''}>${v}%</option>`).join('')}</select></div>
        <label class="check"><input type="checkbox" id="pf-w" ${App.store.get('welcome', true) ? 'checked' : ''}> Show the welcome screen at startup</label>
        <label class="check"><input type="checkbox" id="pf-snap" ${App.snap ? 'checked' : ''}> Snap to guides</label>`,
    });
    if (!r) return;
    App.store.set('prefs', Object.assign(p, { kannadaFont: UI.val(r.el, 'pf-kf').trim() || 'Noto Serif Kannada', nudiScale: +UI.val(r.el, 'pf-ns') }));
    App.store.set('welcome', UI.checked(r.el, 'pf-w'));
    App.snap = UI.checked(r.el, 'pf-snap');
    native.menuState({ snap: App.snap });
    const nu = UI.val(r.el, 'pf-u');
    if (nu !== doc().setup.units) { App.checkpoint(); doc().setup.units = nu; App.changed(); }
  }

  async function pasteMultiple() {
    if (!App.clipItems) return UI.status('Copy one or more objects first.');
    const u = doc().setup.units;
    const r = await UI.dialog({
      title: 'Paste Multiple',
      html: `<div class="row"><label for="pm-n">Paste how many copies</label><input type="number" id="pm-n" min="1" value="3"></div>
        <div class="row2"><label>Horizontal offset (${BV.UNIT_LABEL[u]})<input type="number" step="any" id="pm-x" value="${BV.fmt(18, u)}"></label><label>Vertical offset<input type="number" step="any" id="pm-y" value="0"></label></div>`,
    });
    if (!r) return;
    const n = Math.max(1, Math.round(UI.num(r.el, 'pm-n'))), dx = BV.toPt(UI.num(r.el, 'pm-x'), u), dy = BV.toPt(UI.num(r.el, 'pm-y'), u);
    const base = JSON.parse(JSON.stringify(App.clipItems));
    for (let k = 1; k <= n; k++) {
      App.clipItems = JSON.parse(JSON.stringify(base));
      App.clipItems.items.forEach((it) => { it.x += dx * k - 9; it.y += dy * k - 9; });
      App.pasteItems();
    }
    App.clipItems = base;
  }

  // Table of contents from heading styles
  async function createToc() {
    const styles = Object.keys(doc().styles);
    const guess = styles.filter((s) => /chapter|heading|title|ಅಧ್ಯಾಯ/i.test(s) && !/running|toc/i.test(s));
    const r = await UI.dialog({
      title: 'Create Table of Contents',
      width: 460,
      html: `<div class="row"><label for="toc-t">Title</label><input type="text" id="toc-t" value="ಪರಿವಿಡಿ"></div>
        <fieldset><legend>Include paragraphs in these styles</legend><div style="max-height:180px;overflow:auto">${styles.map((s) => `<label class="check" style="flex-direction:row"><input type="checkbox" value="${esc(s)}" ${guess.includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div></fieldset>
        <p class="note">The contents list is loaded into the cursor like placed text: click a page to put it there.</p>`,
    });
    if (!r) return;
    const inc = new Set([...r.el.querySelectorAll('fieldset input:checked')].map((i) => i.value));
    if (!inc.size) return UI.status('Choose at least one style.');
    const entries = [];
    for (const st of Object.values(doc().stories)) {
      const lay = App.layoutFor(st);
      st.paras.forEach((para, p) => {
        if (!inc.has(para.style)) return;
        const text = T.paraText(para).replace(/\u2028/g, ' ').trim();
        if (!text) return;
        const line = lay.lines.find((l) => l.para === p);
        const it = line && doc().items[line.frame];
        const pi = it ? doc().pages.findIndex((pg) => pg.id === it.page) : -1;
        entries.push({ text, page: pi >= 0 ? BV.pageLabel(doc(), pi) : '', idx: pi, level: [...inc].indexOf(para.style), y: line ? line.top : 0 });
      });
    }
    entries.sort((a, b) => a.idx - b.idx || a.y - b.y);
    const col = BV.pageColumns(doc(), doc().pages[0].id)[0];
    if (!doc().styles['TOC title']) doc().styles['TOC title'] = Object.assign({}, doc().styles['Chapter title'] || BV.defaultStyles()['Chapter title'], { breakBefore: false, spaceBefore: 0 });
    if (!doc().styles['TOC entry']) doc().styles['TOC entry'] = Object.assign({}, BV.defaultStyles()['Body first'], { align: 'left', spaceAfter: 4, tabs: [{ pos: col.w, align: 'right' }] });
    const paras = [{ style: 'TOC title', runs: [{ t: UI.val(r.el, 'toc-t') }] }];
    for (const e of entries) paras.push({ style: 'TOC entry', runs: [{ t: e.text + '\t' + e.page }], ...(e.level > 0 ? { ov: { leftIndent: 18 * e.level } } : {}) });
    App.refreshStyles();
    App.loadTextForPlacing(paras);
    UI.status(`Contents list with ${entries.length} entries is loaded, click to place it.`, 0);
  }

  // Convert pasted Nudi text (ASCII) to Unicode
  function convertNudi() {
    const kf = prefs().kannadaFont;
    const conv = (st, a, b) => {
      for (let p = a.p; p <= b.p; p++) {
        const para = st.paras[p];
        let off = 0;
        const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(para).length;
        para.runs = para.runs.map((r) => {
          const r0 = off, r1 = off + r.t.length;
          off = r1;
          if (r1 <= s || r0 >= e) return r;
          const x = Math.max(s, r0) - r0, y = Math.min(e, r1) - r0;
          return Object.assign({}, r, { t: r.t.slice(0, x) + BV.Legacy.nudiToUnicode(r.t.slice(x, y)) + r.t.slice(y), font: kf });
        });
        T.normalize(para);
      }
    };
    if (App.sel.kind === 'text') {
      const st = doc().stories[App.sel.sid];
      let [a, b] = T.order(App.sel.a, App.sel.f);
      if (T.cmp(a, b) === 0) { a = { p: 0, o: 0 }; b = T.storyEnd(st); }
      App.checkpoint(); conv(st, a, b);
      App.sel = { kind: 'text', sid: st.id, a: { ...a }, f: { ...a } };
      return App.changed(st.id);
    }
    const stories = App.selectedStories();
    if (!stories.length) return UI.status('Select the Nudi text (or its text block) first.');
    App.checkpoint();
    for (const st of stories) conv(st, { p: 0, o: 0 }, T.storyEnd(st));
    App.changed();
  }

  // frames
  function frameAttach() {
    const its = selItems();
    const frame = its.find((i) => i.type === 'frame');
    const content = its.find((i) => i !== frame && (i.type === 'image' || i.type === 'text'));
    if (!frame || !content) return UI.status('Select a frame and a picture (or text block) together, then choose Attach Content.');
    App.checkpoint();
    if (content.type === 'image') {
      frame.src = content.src;
      const b = BV.Render.box(frame);
      const ar = (content.ch || content.h) / (content.cw || content.w);
      let cw = b.w, ch = b.w * ar;
      if (ch < b.h) { ch = b.h; cw = b.h / ar; }
      Object.assign(frame, { cx: (b.w - cw) / 2, cy: (b.h - ch) / 2, cw, ch });
      delete doc().items[content.id];
    } else {
      if (frame.shape !== 'rect') return UI.status('Text can go into rectangle frames only.');
      Object.assign(content, { x: frame.x, y: frame.y, w: frame.w, h: frame.h, autoGrow: false });
      App.markStory(content.storyId);
      delete doc().items[frame.id];
    }
    App.sel = { kind: 'items', ids: [content.type === 'image' ? frame.id : content.id] };
    App.changed();
  }
  function frameDelete() {
    const its = selItems().filter((i) => i.type === 'frame' && i.src);
    if (!its.length) return UI.status('Select a frame that holds a picture.');
    App.checkpoint();
    its.forEach((i) => { delete i.src; delete i.cx; delete i.cy; delete i.cw; delete i.ch; });
    App.changed();
  }
  function frameConvert() {
    const its = selItems().filter((i) => ['rect', 'ellipse', 'polygon'].includes(i.type));
    if (!its.length) return UI.status('Select a rectangle, ellipse or polygon to change into a frame.');
    App.checkpoint();
    its.forEach((i) => { i.shape = i.type; i.type = 'frame'; });
    App.changed();
  }
  function flip(axis) {
    const its = selItems().filter((i) => i.type === 'polygon' || i.type === 'line' || i.type === 'image' || i.type === 'frame');
    if (!its.length) return UI.status('Select a picture, polygon or line to reflect.');
    App.checkpoint();
    for (const it of its) {
      if (it.type === 'line') { if (axis === 'x') { it.x += it.w; it.w = -it.w; } else { it.y += it.h; it.h = -it.h; } continue; }
      if (it.pts) it.pts = it.pts.map(([u, v]) => (axis === 'x' ? [1 - u, v] : [u, 1 - v]));
      if (it.src) { const b = BV.Render.box(it); if (axis === 'x') it.cx = b.w - (it.cx ?? 0) - (it.cw ?? b.w); else it.cy = b.h - (it.cy ?? 0) - (it.ch ?? b.h); it[axis === 'x' ? 'flipX' : 'flipY'] = !it[axis === 'x' ? 'flipX' : 'flipY']; }
    }
    App.changed();
  }

  function zoomPasteboard() {
    const b = $('board');
    const W = BV.spreadWidth(doc()) + App.pad.x * 2, H = doc().setup.h + App.pad.y * 2;
    App.setZoom(Math.min((b.clientWidth - 10) / (W * 96 / 72), (b.clientHeight - 10) / (H * 96 / 72)), null, false);
    b.scrollLeft = 0; b.scrollTop = 0;
  }

  async function printDoc() {
    if (App.sel.kind === 'text') App.leaveText();
    const { body, css } = BV.Render.printHTML(doc(), App.getLayout);
    UI.status('Preparing pages for the printer…', 0);
    const res = await native.print({ body, css, fontCss: App.fontCssText });
    UI.status(res && res.ok ? 'Sent to the printer.' : res && res.reason === 'cancelled' ? '' : 'Printing did not finish' + (res && res.reason ? ': ' + res.reason : '.'));
  }

  async function exportText() {
    const st = App.selectedStories()[0];
    if (!st) return UI.status('Select a story first.');
    const text = st.paras.map(T.paraText).join('\r\n').replace(/\u2028/g, '\r\n').replace(/\uE000/g, '#');
    const p = await native.saveText({ content: text, defaultName: (App.docName || 'Story') + '.txt' });
    if (p) UI.status('Saved ' + p.split(/[\\/]/).pop());
  }

  // ------------------------------------------------------------------ dispatcher for the new commands
  App.command2 = async function (cmd, arg) {
    if (cmd.startsWith('size:')) { const v = cmd.slice(5); if (v === 'other') { const n = await UI.prompt('Size', 'Point size', App.currentParaProps().cp.size); if (n) App.applyChar({ size: parseFloat(n) || null }); return; } return App.applyChar({ size: +v }); }
    if (cmd.startsWith('lead:')) { const v = cmd.slice(5); if (v === 'other') { const n = await UI.prompt('Leading', 'Leading (pt) or auto', App.currentParaProps().pp.leading); if (n) App.applyPara('leading', n.trim().toLowerCase() === 'auto' ? 'auto' : parseFloat(n) || 'auto'); return; } return App.applyPara('leading', v === 'auto' ? 'auto' : +v); }
    if (cmd.startsWith('width:')) { const v = cmd.slice(6); if (v === 'other') { const n = await UI.prompt('Set Width', 'Width (%)', App.currentParaProps().cp.width); if (n) App.applyChar({ width: parseFloat(n) === 100 ? null : parseFloat(n) || null }); return; } return App.applyChar({ width: +v === 100 ? null : +v }); }
    if (cmd.startsWith('track:')) return App.applyChar({ track: parseFloat(cmd.slice(6)) || null });
    if (cmd.startsWith('fill:')) {
      const its = selItems().filter((i) => i.type !== 'line');
      if (!its.length) return UI.status('Select a shape first.');
      App.checkpoint();
      const sc = doc().colors.find((c) => c.name === App.selectedColor);
      its.forEach((i) => (i.fill = cmd === 'fill:none' ? 'none' : cmd === 'fill:paper' ? '#ffffff' : sc ? sc.hex : '#000000'));
      return App.changed();
    }
    if (cmd.startsWith('stroke:')) {
      const v = cmd.slice(7);
      const its = selItems().filter((i) => i.type !== 'text');
      if (['dash', 'dot', 'solid'].includes(v)) { if (!its.length) return UI.status('Select a line or shape first.'); App.checkpoint(); its.forEach((i) => (i.strokeStyle = v)); return App.changed(); }
      const w = +v;
      App.store.set('defaultStroke', { stroke: '#000000', strokeWidth: w });
      if (!its.length) return UI.status(`New lines and shapes will use a ${w ? w + ' pt' : 'no'} stroke.`);
      App.checkpoint();
      its.forEach((i) => { i.strokeWidth = w; if (w && (!i.stroke || i.stroke === 'none')) i.stroke = '#000000'; });
      return App.changed();
    }
    switch (cmd) {
      case 'recent': { const d = await native.openPath(arg); return App.openContent(d); }
      case 'clearRecent': return native.clearRecent();
      case 'welcome': return App.showWelcome();
      case 'print': return printDoc();
      case 'exportText': return exportText();
      case 'preferences': return preferences();
      case 'deselectAll': if (App.sel.kind === 'text') App.leaveText(); App.sel = { kind: 'none' }; return App.render();
      case 'pasteMultiple': return pasteMultiple();
      case 'copyMasterGuides': if (App.view.master) return; App.checkpoint(); for (const p of App.placements) { const pg = doc().pages[p.idx]; pg.guides = JSON.parse(JSON.stringify(doc().masterGuides[p.side])); pg.columns = null; pg.gutter = null; } return App.changed();
      case 'clearGuides': App.checkpoint(); for (const p of App.placements) { const g = App.guidesFor(p); g.h = []; g.v = []; } return App.changed();
      case 'toggleLockGuides': App.lockGuides = !App.lockGuides; native.menuState({ lockGuides: App.lockGuides }); return UI.status(App.lockGuides ? 'Ruler guides are locked.' : 'Ruler guides can be moved.');
      case 'toggleNonPrinting': App.showNonPrinting = !App.showNonPrinting; native.menuState({ nonPrinting: App.showNonPrinting }); return App.render();
      case 'zoom:pasteboard': return zoomPasteboard();
      case 'fontDialog': return fontDialog();
      case 'normalStyle': return App.applyChar({ bold: null, italic: null, underline: null, strike: null, caps: null, shift: null, pos: null });
      case 'strike': { const c = App.currentParaProps(); return App.applyChar({ strike: c.cp.strike ? null : true }); }
      case 'caps': { const c = App.currentParaProps(); return App.applyChar({ caps: c.cp.caps ? null : true }); }
      case 'superscript': { const c = App.currentParaProps(); return App.applyChar({ pos: c.cp.pos === 'sup' ? null : 'sup' }); }
      case 'subscript': { const c = App.currentParaProps(); return App.applyChar({ pos: c.cp.pos === 'sub' ? null : 'sub' }); }
      case 'indentsTabs': return indentsTabs();
      case 'alignObjects': return alignObjects();
      case 'textWrap': return textWrap();
      case 'group': {
        const its = selItems();
        if (its.length < 2) return UI.status('Select two or more objects to group.');
        if (new Set(its.map((i) => i.page)).size > 1) return UI.status('Objects on different pages cannot be grouped.');
        App.checkpoint();
        const g = BV.newId(doc(), 'g');
        its.forEach((i) => (i.group = g));
        return App.changed();
      }
      case 'ungroup': { const its = selItems().filter((i) => i.group); if (!its.length) return UI.status('Select a group first.'); App.checkpoint(); its.forEach((i) => delete i.group); return App.changed(); }
      case 'lock': { const its = selItems(); if (!its.length) return; App.checkpoint(); its.forEach((i) => (i.locked = true)); return App.changed(); }
      case 'unlock': { const its = selItems(); if (!its.length) return; App.checkpoint(); its.forEach((i) => delete i.locked); return App.changed(); }
      case 'toggleLock': { const its = selItems(); if (!its.length) return; const any = its.some((i) => i.locked); App.checkpoint(); its.forEach((i) => (any ? delete i.locked : (i.locked = true))); return App.changed(); }
      case 'nonPrint': { const its = selItems(); if (!its.length) return UI.status('Select objects first.'); App.checkpoint(); const any = its.some((i) => i.nonPrint); its.forEach((i) => (any ? delete i.nonPrint : (i.nonPrint = true))); UI.status(any ? 'Objects will print.' : 'Objects marked non-printing.'); return App.changed(); }
      case 'roundedCorners': return roundedCorners();
      case 'polygonSettings': return polygonSettings();
      case 'frameAttach': return frameAttach();
      case 'frameDelete': return frameDelete();
      case 'frameConvert': return frameConvert();
      case 'flipH': return flip('x');
      case 'flipV': return flip('y');
      case 'convertNudi': return convertNudi();
      case 'createToc': return createToc();
      case 'findNext': {
        if (!App.lastFind) return App.command('findChange');
        const f = App.lastFind;
        const stories = Object.values(doc().stories);
        let started = App.sel.kind !== 'text';
        for (const s of stories) for (let p = 0; p < s.paras.length; p++) {
          const text = T.paraText(s.paras[p]);
          let from = 0;
          if (!started) { if (s.id !== App.sel.sid) continue; if (p < App.sel.f.p) continue; if (p === App.sel.f.p) from = App.sel.f.o; started = true; }
          const i = text.indexOf(f, from);
          if (i >= 0) { App.setTool('text'); App.sel = { kind: 'text', sid: s.id, a: { p, o: i }, f: { p, o: i + f.length } }; App.render(); App.ensureCaretVisible(); App.focusIME(); return; }
        }
        return UI.status(`No more “${f}”.`);
      }
      case 'showTools': return App.showPanel('pal-tools');
      case 'showControl': return App.showPanel('pal-control');
      case 'showColors': return App.togglePanelTab('pal-sc', 'Colors');
      case 'showStyles': return App.togglePanelTab('pal-sc', 'Styles');
      case 'showLayers': return App.togglePanelTab('pal-lm', 'Layers');
      case 'showMasterPal': return App.togglePanelTab('pal-lm', 'Master Pages');
      case 'showToolbar': { const h = !document.body.classList.toggle('hide-toolbar'); App.store.set('hideToolbar', !h); App.syncMenuChecks(); return; }
      case 'balanceColumns': return UI.status('Balance columns is not available yet.');
    }
  };
})();
