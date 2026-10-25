/* BV Mudrana: PageMaker-style palettes: toolbox, control palette, styles/colors, layers/master pages,
   toolbar, font picker and the welcome (About) screen. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text;
  const $ = (id) => document.getElementById(id);
  const esc = BV.Render.esc;
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('bv.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set: (k, v) => { try { localStorage.setItem('bv.' + k, JSON.stringify(v)); } catch (_) {} },
  };
  App.store = store;

  // ------------------------------------------------------------------ icons
  const I = (d, extra = '') => `<svg viewBox="0 0 20 20" ${extra}>${d}</svg>`;
  const ICON = {
    pointer: I('<path d="M5 2.5l10 9.2-4.6.5 2.6 5.2-2 1-2.5-5.3L5 16z" fill="currentColor"/>'),
    text: I('<text x="10" y="16" text-anchor="middle" style="font:700 16px Georgia,serif" fill="currentColor">A</text>'),
    rotate: I('<path d="M15.5 8.5A6 6 0 1 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16.8 4.2l-.9 4.9-4.7-1.5z" fill="currentColor"/>'),
    crop: I('<path d="M6 2v12h12M2 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    line: I('<path d="M4 16L16 4" stroke="currentColor" stroke-width="1.8"/>'),
    cline: I('<path d="M3 10h14M10 6v8" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h14" stroke="currentColor" stroke-width="2.2"/>'),
    rect: I('<rect x="3.5" y="5" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
    rframe: I('<rect x="3.5" y="5" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 5l13 10M16.5 5l-13 10" stroke="currentColor" stroke-width="1"/>'),
    ellipse: I('<ellipse cx="10" cy="10" rx="7" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
    eframe: I('<ellipse cx="10" cy="10" rx="7" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 6.3l10 7.4M15 6.3l-10 7.4" stroke="currentColor" stroke-width="1"/>'),
    polygon: I('<path d="M10 3l7 5-2.7 8.5H5.7L3 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
    pframe: I('<path d="M10 3l7 5-2.7 8.5H5.7L3 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 8l10 8M16 8L6 16" stroke="currentColor" stroke-width="1"/>'),
    hand: I('<path d="M7 9V4.5a1 1 0 012 0V9V3.5a1 1 0 012 0V9V4.5a1 1 0 012 0V10V7a1 1 0 012 0v5c0 3-2 5-5 5h-1c-2 0-3-1-4-2.5L3.5 11a1 1 0 011.6-1.2L7 12z" fill="currentColor"/>'),
    zoom: I('<circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.5 12.5L17 17" stroke="currentColor" stroke-width="2.2"/>'),
  };
  const TB = {
    new: '<path d="M5 2.5h7l3.5 3.5v11.5H5z"/><path d="M12 2.5V6h3.5"/>',
    open: '<path d="M2.5 6V15.5h13l2-7H6.5l-2 7"/><path d="M2.5 6V4h5l1.5 1.5h6V8.5"/>',
    save: '<path d="M3.5 3.5h11l2 2v11h-13z"/><path d="M6.5 3.5v4h6v-4M6 16.5v-5h8v5"/>',
    print: '<path d="M5.5 8V3h9v5"/><rect x="2.5" y="8" width="15" height="6" rx="1"/><path d="M5.5 12h9v5h-9z"/>',
    pdf: '<path d="M5 2.5h7l3.5 3.5v11.5H5z"/><path d="M7 12.5h1.5a1.2 1.2 0 000-2.4H7v4M11 10.1v4M11 10.1h2M11 12h1.6"/>',
    cut: '<circle cx="6" cy="14.5" r="2.3"/><circle cx="14" cy="14.5" r="2.3"/><path d="M7.5 12.8L14 3M12.5 12.8L6 3"/>',
    copy: '<rect x="7" y="7" width="9.5" height="10" rx="1"/><path d="M13 7V3.5H3.5V13H7"/>',
    paste: '<rect x="4" y="4" width="12" height="13.5" rx="1"/><path d="M7.5 4V2.5h5V4M7 9h6M7 12h6M7 15h4"/>',
    undo: '<path d="M7 5L3.5 8.5 7 12"/><path d="M3.5 8.5H12a4.5 4.5 0 010 9H8"/>',
    redo: '<path d="M13 5l3.5 3.5L13 12"/><path d="M16.5 8.5H8a4.5 4.5 0 000 9h4"/>',
    place: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M2.5 13.5l4-4 3 3 3-3 5 5"/><circle cx="13" cy="7.5" r="1.4"/>',
    find: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3L17 17"/>',
    pages: '<path d="M4 3.5h8l3.5 3.5v9.5H4z"/><path d="M9.75 8v6M6.75 11h6"/>',
    typespecs: '<path d="M3 16L8 4l5 12M5 12h6"/><path d="M14 9h4M16 7v4"/>',
    para: '<path d="M9 16V3.5h7M13 3.5V16M9 3.5a3.5 3.5 0 000 7"/>',
    fillstroke: '<rect x="3" y="3" width="10" height="10" rx="1"/><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" fill-opacity=".25"/>',
    wrap: '<rect x="7" y="7" width="6" height="6"/><path d="M2.5 4h15M2.5 16h15M2.5 8.5H5M2.5 11.5H5M15 8.5h2.5M15 11.5h2.5"/>',
    align: '<path d="M3 2.5v15"/><rect x="5" y="4.5" width="10" height="4"/><rect x="5" y="11.5" width="6" height="4"/>',
    group: '<rect x="2.5" y="2.5" width="15" height="15" rx="1" stroke-dasharray="2 2"/><rect x="5" y="5" width="6" height="5"/><circle cx="12.5" cy="12.5" r="2.7"/>',
    fit: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M6 8V7h2M14 8V7h-2M6 12v1h2M14 12v1h-2"/>',
    actual: '<rect x="3" y="4" width="14" height="12" rx="1"/><text x="10" y="13.4" text-anchor="middle" style="font:600 7px Segoe UI,sans-serif" fill="currentColor" stroke="none">1:1</text>',
    tools: '<path d="M5 2.5l7 6.5-3.3.4 1.9 3.8-1.5.7-1.8-3.8L5 12.5z"/><path d="M13 17h5"/>',
    control: '<rect x="2.5" y="6" width="15" height="8" rx="1"/><path d="M5 10h3M10 10h5"/>',
    styles: '<path d="M4 5h12M4 10h8M4 15h10"/>',
    colors: '<circle cx="7" cy="8" r="3.5"/><circle cx="13" cy="8" r="3.5"/><circle cx="10" cy="13" r="3.5"/>',
    layers: '<path d="M10 3l7.5 4L10 11 2.5 7z"/><path d="M2.5 10.5L10 14.5l7.5-4M2.5 13.5L10 17.5l7.5-4"/>',
    trash: '<path d="M4 6h12M8 6V4h4v2M5.5 6l1 11h7l1-11"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    edit: '<path d="M4 16l1-4 8-8 3 3-8 8z"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
    lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.2"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',
    unlock: '<rect x="4.5" y="9" width="11" height="8" rx="1.2"/><path d="M7 9V6.5a3 3 0 015.6-1.5"/>',
    up: '<path d="M10 15V5M6 9l4-4 4 4"/>',
    down: '<path d="M10 5v10M6 11l4 4 4-4"/>',
    apply: '<path d="M4 10.5l4 4 8-9"/>',
    stroke: '<rect x="4" y="4" width="12" height="12" rx="1"/>',
    fill: '<rect x="4" y="4" width="12" height="12" rx="1" fill="currentColor"/>',
    both: '<rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" fill-opacity=".35"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
    tomaster: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M6 13V7l4 3.5L14 7v6"/>',
  };
  const tbIcon = (k) => `<svg viewBox="0 0 20 20">${TB[k]}</svg>`;
  App.ICON = ICON;
  App.tbIcon = tbIcon;

  // ------------------------------------------------------------------ floating panels
  function makePanel(el) {
    const tabs = el.dataset.tabs ? el.dataset.tabs.split(',') : null;
    const head = document.createElement('div');
    head.className = 'fp-head';
    if (tabs) {
      tabs.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'fp-tab' + (i === 0 ? ' on' : '');
        b.textContent = t;
        b.dataset.tab = t;
        b.onclick = () => selectTab(el, t);
        head.appendChild(b);
      });
      const f = document.createElement('div'); f.className = 'fp-fill'; head.appendChild(f);
    } else {
      const t = document.createElement('div'); t.className = 'fp-title'; t.textContent = el.dataset.title || ''; head.appendChild(t);
    }
    const close = document.createElement('button');
    close.className = 'fp-btn'; close.title = 'Hide'; close.innerHTML = '×';
    close.onclick = () => App.showPanel(el.id, false);
    head.appendChild(close);
    el.appendChild(head);
    if (tabs) tabs.forEach((t, i) => { const b = document.createElement('div'); b.className = 'fp-page'; b.dataset.page = t; if (i) b.hidden = true; el.appendChild(b); });
    else { const b = document.createElement('div'); b.className = 'fp-body'; el.appendChild(b); }
    // dragging
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - ox));
        const y = Math.max(80, Math.min(window.innerHeight - 30, ev.clientY - oy));
        Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
      };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); store.set('panel.' + el.id, { left: el.style.left, top: el.style.top }); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
    const pos = store.get('panel.' + el.id, null);
    if (pos && pos.left) {
      const l = parseFloat(pos.left), t = parseFloat(pos.top);
      if (l < window.innerWidth - 40 && t < window.innerHeight - 20 && t >= 80) Object.assign(el.style, { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' });
    }
  }
  function selectTab(el, t) {
    el.querySelectorAll('.fp-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    el.querySelectorAll('.fp-page').forEach((p) => (p.hidden = p.dataset.page !== t));
    store.set('tab.' + el.id, t);
    if (typeof syncMenuChecks === 'function' && App.doc) syncMenuChecks();
  }
  App.selectTab = (id, t) => selectTab($(id), t);
  const PANEL_KEYS = { 'pal-tools': 'tools', 'pal-control': 'control', 'pal-sc': null, 'pal-lm': null, 'iast-pal': null };
  App.showPanel = function (id, show) {
    const el = $(id);
    if (show === undefined) show = el.hidden;
    el.hidden = !show;
    store.set('show.' + id, show);
    syncMenuChecks();
  };
  function syncMenuChecks() {
    const sc = $('pal-sc'), lm = $('pal-lm');
    const tabOn = (el, t) => !el.hidden && el.querySelector(`.fp-tab.on`)?.dataset.tab === t;
    window.native && native.menuState({
      tools: !$('pal-tools').hidden, control: !$('pal-control').hidden,
      styles: tabOn(sc, 'Styles'), colors: tabOn(sc, 'Colors'), layers: tabOn(lm, 'Layers'), masterPal: tabOn(lm, 'Master Pages'),
      toolbar: !document.body.classList.contains('hide-toolbar'),
    });
    document.querySelectorAll('.tb[data-panel]').forEach((b) => {
      const [id, tab] = b.dataset.panel.split(':');
      const el = $(id);
      b.classList.toggle('on', !el.hidden && (!tab || el.querySelector('.fp-tab.on')?.dataset.tab === tab));
    });
  }
  App.togglePanelTab = function (id, tab) {
    const el = $(id);
    const cur = el.querySelector('.fp-tab.on')?.dataset.tab;
    if (!el.hidden && cur === tab) App.showPanel(id, false);
    else { selectTab(el, tab); App.showPanel(id, true); }
    syncMenuChecks();
  };

  // ------------------------------------------------------------------ toolbar
  const TOOLBAR = [
    ['new', 'New publication (Ctrl+N)', 'new'], ['open', 'Open (Ctrl+O)', 'open'], ['save', 'Save (Ctrl+S)', 'save'], '|',
    ['print', 'Print (Ctrl+P)', 'print'], ['pdf', 'Export Adobe PDF', 'exportPdf'], '|',
    ['cut', 'Cut', 'cut'], ['copy', 'Copy', 'copy'], ['paste', 'Paste', 'paste'], '|',
    ['undo', 'Undo (Ctrl+Z)', 'undo'], ['redo', 'Redo (Ctrl+Y)', 'redo'], '|',
    ['place', 'Place (Ctrl+D)', 'place'], ['find', 'Find (Ctrl+8)', 'findChange'], ['pages', 'Insert pages', 'insertPages'], '|',
    ['typespecs', 'Type specs (Ctrl+T)', 'typeSpecs'], ['para', 'Paragraph (Ctrl+M)', 'paraSpecs'], '|',
    ['fillstroke', 'Fill and stroke (Ctrl+U)', 'fillStroke'], ['wrap', 'Text wrap', 'textWrap'], ['align', 'Align objects (Ctrl+Shift+E)', 'alignObjects'], ['group', 'Group (Ctrl+G)', 'group'], '|',
    ['fit', 'Fit in window (Ctrl+0)', 'zoom:fit'], ['actual', 'Actual size (Ctrl+1)', 'zoom:1'], '|',
    ['tools', 'Tools palette (Ctrl+6)', null, 'pal-tools'], ['control', "Control palette (Ctrl+')", null, 'pal-control'], ['styles', 'Styles (Ctrl+Y)', null, 'pal-sc:Styles'], ['colors', 'Colors (Ctrl+J)', null, 'pal-sc:Colors'], ['layers', 'Layers', null, 'pal-lm:Layers'], '|',
    ['txt:देव', 'Transliterate selection to Devanagari (Ctrl+Alt+1)', 'tr:deva'], ['txt:ಕನ್ನ', 'Transliterate selection to Kannada (Ctrl+Alt+2)', 'tr:knda'], ['txt:IAST', 'Transliterate selection to IAST (Ctrl+Alt+3)', 'tr:iast'], ['txt:ā ṣ', 'IAST characters (Ctrl+Alt+I)', 'iastPalette'],
  ];
  function buildToolbar() {
    const tb = $('toolbar');
    tb.innerHTML = TOOLBAR.map((x) => {
      if (x === '|') return '<span class="tbsep"></span>';
      const [k, title, cmd, panel] = x;
      const content = k.startsWith('txt:') ? esc(k.slice(4)) : tbIcon(k);
      return `<button class="tb${k.startsWith('txt:') ? ' txt' : ''}" title="${esc(title)}" aria-label="${esc(title)}" ${cmd ? `data-cmd="${cmd}"` : ''} ${panel ? `data-panel="${panel}"` : ''}>${content}</button>`;
    }).join('');
    tb.addEventListener('mousedown', (e) => { if (e.target.closest('.tb')) e.preventDefault(); });
    tb.addEventListener('click', (e) => {
      const b = e.target.closest('.tb');
      if (!b) return;
      if (b.dataset.panel) { const [id, tab] = b.dataset.panel.split(':'); if (tab) App.togglePanelTab(id, tab); else App.showPanel(id); return; }
      const cmd = b.dataset.cmd;
      if (cmd === 'cut' || cmd === 'copy' || cmd === 'paste') { App.focusIME && App.sel.kind === 'text' && App.focusIME(); document.execCommand(cmd); return; }
      App.command(cmd);
    });
  }

  // ------------------------------------------------------------------ toolbox
  const TOOLS = [
    ['pointer', 'Pointer (F9, Shift+F1)'], ['text', 'Text (F9, Shift+F4)'],
    ['rotate', 'Rotate (Shift+F2)'], ['crop', 'Crop (Shift+F6)'],
    ['line', 'Line (Shift+F3)'], ['cline', 'Constrained line (Shift+F3 with Shift)'],
    ['rect', 'Rectangle (Shift+F5)'], ['rframe', 'Rectangle frame'],
    ['ellipse', 'Ellipse (Shift+F7)'], ['eframe', 'Ellipse frame'],
    ['polygon', 'Polygon (Shift+F8)'], ['pframe', 'Polygon frame'],
    ['hand', 'Hand (hold Space, or Alt+drag)'], ['zoom', 'Zoom (Ctrl+Space; Alt-click zooms out)'],
  ];
  function buildToolbox() {
    const body = $('pal-tools').querySelector('.fp-body');
    body.innerHTML = TOOLS.map(([t, title]) => `<button class="tool" data-tool="${t}" title="${esc(title)}" aria-label="${esc(title)}">${ICON[t]}</button>`).join('');
    body.addEventListener('click', (e) => { const b = e.target.closest('.tool'); if (b) App.setTool(b.dataset.tool); });
    body.addEventListener('dblclick', (e) => {
      const b = e.target.closest('.tool');
      if (!b) return;
      if (b.dataset.tool === 'polygon' || b.dataset.tool === 'pframe') App.command('polygonSettings');
      if (b.dataset.tool === 'rect' || b.dataset.tool === 'rframe') App.command('roundedCorners');
      if (b.dataset.tool === 'zoom') App.command('zoom:1');
      if (b.dataset.tool === 'hand') App.command('zoom:fit');
    });
  }

  // ------------------------------------------------------------------ control palette
  App.controlMode = store.get('controlMode', 'char');
  const TRACKS = [['No track', 0], ['Very loose', 0.1], ['Loose', 0.05], ['Normal', 0.02], ['Tight', -0.02], ['Very tight', -0.05]];
  function buildControl() {
    const body = $('pal-control').querySelector('.fp-body');
    body.innerHTML = `
      <div class="cp-modes">
        <button class="cp-mode" data-mode="char" title="Character view">A</button>
        <button class="cp-mode" data-mode="para" title="Paragraph view">¶</button>
      </div>
      <button class="cp-apply" title="Apply" id="cp-apply">${tbIcon('apply')}</button>
      <div class="cp-view" data-view="char">
        <div class="cgroup"><label class="clabel">Font</label><div class="fontbox"><input id="cc-font" spellcheck="false" autocomplete="off"><button class="fdrop" tabindex="-1" data-fontfor="cc-font">▾</button></div></div>
        <div class="cgroup"><label class="clabel" for="cc-size">Size</label><input id="cc-size" class="num" list="dl-sizes"></div>
        <div class="cgroup"><label class="clabel" for="cc-lead">Leading</label><input id="cc-lead" class="num" list="dl-leads"></div>
        <div class="cgroup"><label class="clabel" for="cc-track">Track</label><select id="cc-track">${TRACKS.map(([l, v]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="cgroup"><label class="clabel" for="cc-width">Set width %</label><input id="cc-width" class="num"></div>
        <div class="cgroup"><label class="clabel" for="cc-shift">Baseline</label><input id="cc-shift" class="num"></div>
        <div class="cgroup row">
          <button class="cb" data-cmd="normalStyle" title="Normal (Ctrl+Shift+Space)">N</button>
          <button class="cb" data-cmd="bold" title="Bold (Ctrl+Shift+B)"><b>B</b></button>
          <button class="cb" data-cmd="italic" title="Italic (Ctrl+Shift+I)"><i>I</i></button>
          <button class="cb" data-cmd="underline" title="Underline (Ctrl+Shift+U)"><u>U</u></button>
          <button class="cb" data-cmd="strike" title="Strikethru"><s>S</s></button>
          <button class="cb" data-cmd="caps" title="All caps (Ctrl+Shift+K)" style="font-size:10px">CAP</button>
          <button class="cb" data-cmd="superscript" title="Superscript">x²</button>
          <button class="cb" data-cmd="subscript" title="Subscript">x₂</button>
        </div>
      </div>
      <div class="cp-view" data-view="para" hidden>
        <div class="cgroup"><label class="clabel" for="cp-style">Paragraph style</label><select id="cp-style" style="width:170px"></select></div>
        <div class="cgroup row">
          <button class="cb" data-cmd="alignLeft" title="Align left (Ctrl+Shift+L)"><svg viewBox="0 0 16 16"><path d="M2 3h12M2 6h8M2 9h12M2 12h8"/></svg></button>
          <button class="cb" data-cmd="alignCenter" title="Align center (Ctrl+Shift+C)"><svg viewBox="0 0 16 16"><path d="M2 3h12M4 6h8M2 9h12M4 12h8"/></svg></button>
          <button class="cb" data-cmd="alignRight" title="Align right (Ctrl+Shift+R)"><svg viewBox="0 0 16 16"><path d="M2 3h12M6 6h8M2 9h12M6 12h8"/></svg></button>
          <button class="cb" data-cmd="alignJustify" title="Justify (Ctrl+Shift+J)"><svg viewBox="0 0 16 16"><path d="M2 3h12M2 6h12M2 9h12M2 12h7"/></svg></button>
          <button class="cb" data-cmd="alignForce" title="Force justify (Ctrl+Shift+F)"><svg viewBox="0 0 16 16"><path d="M2 3h12M2 6h12M2 9h12M2 12h12"/></svg></button>
        </div>
        <div class="cgroup"><label class="clabel" for="cp-li">Left indent</label><input id="cp-li" class="num"></div>
        <div class="cgroup"><label class="clabel" for="cp-fi">First indent</label><input id="cp-fi" class="num"></div>
        <div class="cgroup"><label class="clabel" for="cp-ri">Right indent</label><input id="cp-ri" class="num"></div>
        <div class="cgroup"><label class="clabel" for="cp-sb">Space before</label><input id="cp-sb" class="num"></div>
        <div class="cgroup"><label class="clabel" for="cp-sa">Space after</label><input id="cp-sa" class="num"></div>
      </div>
      <div class="cp-view" data-view="obj" hidden>
        <div class="proxy" id="co-proxy">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<button data-ref="${i}" title="Reference point"></button>`).join('')}</div>
        <div class="cgroup"><label class="clabel" for="co-x">X</label><input id="co-x" class="num"></div>
        <div class="cgroup"><label class="clabel" for="co-y">Y</label><input id="co-y" class="num"></div>
        <div class="cgroup"><label class="clabel" for="co-w">W</label><input id="co-w" class="num"></div>
        <div class="cgroup"><label class="clabel" for="co-h">H</label><input id="co-h" class="num"></div>
        <div class="cgroup"><label class="clabel" for="co-sw">Scale W %</label><input id="co-sw" class="num" value="100"></div>
        <div class="cgroup"><label class="clabel" for="co-sh">Scale H %</label><input id="co-sh" class="num" value="100"></div>
        <div class="cgroup"><label class="clabel" for="co-rot">Rotation °</label><input id="co-rot" class="num"></div>
        <div class="cgroup"><label class="clabel" for="co-stroke">Stroke pt</label><input id="co-stroke" class="num"></div>
        <div class="cgroup row"><button class="cb" data-cmd="flipH" title="Reflect horizontally">⇋</button><button class="cb" data-cmd="flipV" title="Reflect vertically">⇵</button><button class="cb" id="co-lock" data-cmd="toggleLock" title="Lock position">${tbIcon('lock')}</button></div>
      </div>
      <datalist id="dl-sizes">${[6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72].map((s) => `<option value="${s}">`).join('')}</datalist>
      <datalist id="dl-leads"><option value="auto">${[10, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((s) => `<option value="${s}">`).join('')}</datalist>`;
    body.querySelectorAll('.cp-mode').forEach((b) => b.addEventListener('click', () => { App.controlMode = b.dataset.mode; store.set('controlMode', App.controlMode); App.syncControls(); }));
    body.querySelectorAll('.cb[data-cmd]').forEach((b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => App.command(b.dataset.cmd)); });
    App.refRef = store.get('proxyRef', 0);
    body.querySelectorAll('#co-proxy button').forEach((b) => b.addEventListener('click', () => { App.refRef = +b.dataset.ref; store.set('proxyRef', App.refRef); App.syncControls(); }));
    const u = () => App.doc.setup.units;
    const field = (id, fn) => {
      const el = $(id);
      const go = () => { if (el.dataset.dirty) { delete el.dataset.dirty; fn(el.value); } };
      el.addEventListener('input', () => (el.dataset.dirty = '1'));
      el.addEventListener('change', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.dataset.dirty = '1'; go(); if (App.sel.kind === 'text') App.focusIME(); } if (e.key === 'Escape') { delete el.dataset.dirty; App.syncControls(true); el.blur(); } });
    };
    field('cc-font', (v) => v.trim() && App.applyChar({ font: v.trim() }));
    field('cc-size', (v) => { const n = parseFloat(v); if (n > 0) App.applyChar({ size: n }); });
    field('cc-lead', (v) => { const t = v.trim().toLowerCase(); App.applyPara('leading', t === 'auto' || t === '' ? 'auto' : parseFloat(t) || 'auto'); });
    $('cc-track').addEventListener('change', (e) => App.applyChar({ track: parseFloat(e.target.value) || null }));
    field('cc-width', (v) => { const n = parseFloat(v); if (n > 0) App.applyChar({ width: n === 100 ? null : n }); });
    field('cc-shift', (v) => App.applyChar({ shift: parseFloat(v) || null }));
    $('cp-style').addEventListener('change', (e) => App.applyStyle(e.target.value));
    field('cp-li', (v) => App.applyPara('leftIndent', BV.toPt(parseFloat(v) || 0, u())));
    field('cp-fi', (v) => App.applyPara('firstIndent', BV.toPt(parseFloat(v) || 0, u())));
    field('cp-ri', (v) => App.applyPara('rightIndent', BV.toPt(parseFloat(v) || 0, u())));
    field('cp-sb', (v) => App.applyPara('spaceBefore', BV.toPt(parseFloat(v) || 0, u())));
    field('cp-sa', (v) => App.applyPara('spaceAfter', BV.toPt(parseFloat(v) || 0, u())));
    for (const k of ['x', 'y', 'w', 'h', 'sw', 'sh', 'rot', 'stroke']) field('co-' + k, (v) => App.setObjField(k, v));
    $('cp-apply').addEventListener('click', () => {
      body.querySelectorAll('input').forEach((el) => { if (el.dataset.dirty) el.dispatchEvent(new Event('change')); });
    });
  }

  App.syncControls = function (force) {
    if (!App.doc) return;
    const ctl = $('pal-control');
    const mode = App.sel.kind === 'items' ? 'obj' : App.controlMode === 'obj' ? 'char' : App.controlMode;
    ctl.querySelectorAll('.cp-view').forEach((v) => (v.hidden = v.dataset.view !== mode));
    ctl.querySelectorAll('.cp-mode').forEach((b) => { b.classList.toggle('on', b.dataset.mode === mode); b.hidden = mode === 'obj'; });
    ctl.querySelector('.fp-title').textContent = mode === 'obj' ? 'Control: Object' : mode === 'para' ? 'Control: Paragraph' : 'Control: Character';
    const setv = (id, v) => { const el = $(id); if (!el) return; if (force || (document.activeElement !== el && !el.dataset.dirty)) el.value = v; };
    const u = App.doc.setup.units;
    if (mode === 'obj') {
      const its = App.sel.ids.map((id) => App.doc.items[id]).filter(Boolean);
      if (!its.length) return;
      const b = App.selBounds(its);
      const ref = App.refRef || 0;
      const rx = b.x + (ref % 3) * b.w / 2, ry = b.y + Math.floor(ref / 3) * b.h / 2;
      setv('co-x', BV.fmt(rx, u)); setv('co-y', BV.fmt(ry, u)); setv('co-w', BV.fmt(b.w, u)); setv('co-h', BV.fmt(b.h, u));
      setv('co-rot', its.length === 1 ? Math.round((its[0].rot || 0) * 10) / 10 : '');
      setv('co-stroke', its.length === 1 && its[0].type !== 'text' ? its[0].strokeWidth || 0 : '');
      setv('co-sw', 100); setv('co-sh', 100);
      ctl.querySelectorAll('#co-proxy button').forEach((bt) => bt.classList.toggle('on', +bt.dataset.ref === ref));
      $('co-lock').classList.toggle('on', its.some((i) => i.locked));
      ctl.querySelectorAll('.clabel').forEach((l) => { if (/^(X|Y|W|H)$/.test(l.textContent.split(' ')[0])) l.textContent = l.textContent.split(' ')[0] + ' (' + BV.UNIT_LABEL[u] + ')'; });
      return;
    }
    const c = App.currentParaProps();
    if (!c) return;
    setv('cc-font', c.cp.font);
    setv('cc-size', +(+c.cp.size).toFixed(2));
    setv('cc-lead', c.pp.leading && c.pp.leading !== 'auto' ? +(+c.pp.leading).toFixed(2) : 'auto');
    const tr = TRACKS.reduce((best, t) => (Math.abs(t[1] - (c.cp.track || 0)) < Math.abs(best[1] - (c.cp.track || 0)) ? t : best), TRACKS[0]);
    setv('cc-track', tr[1]);
    setv('cc-width', c.cp.width || 100);
    setv('cc-shift', c.cp.shift || 0);
    const on = (cmd, v) => ctl.querySelectorAll(`.cb[data-cmd="${cmd}"]`).forEach((b) => b.classList.toggle('on', !!v));
    on('bold', c.cp.bold); on('italic', c.cp.italic); on('underline', c.cp.underline); on('strike', c.cp.strike); on('caps', c.cp.caps);
    on('superscript', c.cp.shift > 0); on('subscript', c.cp.shift < 0);
    ['Left', 'Center', 'Right', 'Justify', 'Force'].forEach((a) => on('align' + a, c.pp.align === a.toLowerCase()));
    setv('cp-style', c.style);
    setv('cp-li', BV.fmt(c.pp.leftIndent || 0, u)); setv('cp-fi', BV.fmt(c.pp.firstIndent || 0, u)); setv('cp-ri', BV.fmt(c.pp.rightIndent || 0, u));
    setv('cp-sb', BV.fmt(c.pp.spaceBefore || 0, u)); setv('cp-sa', BV.fmt(c.pp.spaceAfter || 0, u));
    const ul = BV.UNIT_LABEL[u];
    for (const [id, l] of [['cp-li', 'Left indent'], ['cp-fi', 'First indent'], ['cp-ri', 'Right indent'], ['cp-sb', 'Space before'], ['cp-sa', 'Space after']]) {
      const lab = ctl.querySelector(`label[for=${id}]`); if (lab) lab.textContent = `${l} (${ul})`;
    }
    document.querySelectorAll('#style-list li').forEach((li) => li.classList.toggle('on', li.dataset.name === c.style));
  };
  App.selBounds = function (its) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of its) {
      const b = BV.Render.box(it);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  // ------------------------------------------------------------------ styles & colors palette
  function buildSC() {
    const el = $('pal-sc');
    const ps = el.querySelector('[data-page="Styles"]');
    ps.innerHTML = `<div class="fp-body"><ul id="style-list" class="plist" role="listbox" aria-label="Paragraph styles"></ul></div>
      <div class="fp-foot"><span class="sp"></span><button class="mini" id="st-new" title="New style">${tbIcon('plus')}</button><button class="mini" id="st-edit" title="Edit style">${tbIcon('edit')}</button><button class="mini" id="st-del" title="Delete style">${tbIcon('trash')}</button></div>`;
    const pc = el.querySelector('[data-page="Colors"]');
    pc.innerHTML = `<div class="fp-foot" style="border-top:0;border-bottom:1px solid var(--line)">
        <div class="colmode"><button class="mini" data-cm="stroke" title="Apply to stroke (or text)">${tbIcon('stroke')}</button><button class="mini" data-cm="fill" title="Apply to fill">${tbIcon('fill')}</button><button class="mini" data-cm="both" title="Apply to stroke and fill">${tbIcon('both')}</button></div>
        <span class="sp"></span><label class="clabel" for="col-tint">Tint</label><select id="col-tint" style="height:22px">${[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((t) => `<option value="${t}">${t}%</option>`).join('')}</select></div>
      <div class="fp-body"><ul id="color-list" class="plist" role="listbox" aria-label="Colours"></ul></div>
      <div class="fp-foot"><span class="sp"></span><button class="mini" id="col-new" title="New colour">${tbIcon('plus')}</button><button class="mini" id="col-edit" title="Edit colour">${tbIcon('edit')}</button><button class="mini" id="col-del" title="Delete colour">${tbIcon('trash')}</button></div>`;
    App.colorMode = store.get('colorMode', 'stroke');
    pc.querySelectorAll('[data-cm]').forEach((b) => b.addEventListener('click', () => { App.colorMode = b.dataset.cm; store.set('colorMode', App.colorMode); App.refreshColors(); }));
    const list = $('style-list');
    list.addEventListener('mousedown', (e) => e.preventDefault());
    list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) App.applyStyle(li.dataset.name); });
    list.addEventListener('dblclick', (e) => { const li = e.target.closest('li'); if (li) App.editStyle(li.dataset.name, false); });
    $('st-new').onclick = () => App.editStyle(App.currentParaProps().style, true);
    $('st-edit').onclick = () => App.editStyle(App.currentParaProps().style, false);
    $('st-del').onclick = () => App.deleteStyle(App.currentParaProps().style);
    const cl = $('color-list');
    cl.addEventListener('mousedown', (e) => e.preventDefault());
    cl.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) { App.selectedColor = li.dataset.name; App.applyColor(li.dataset.name, +$('col-tint').value); App.refreshColors(); } });
    cl.addEventListener('dblclick', (e) => { const li = e.target.closest('li'); if (li) App.editColor(li.dataset.name); });
    $('col-new').onclick = () => App.editColor(null);
    $('col-edit').onclick = () => App.editColor(App.selectedColor || 'Black');
    $('col-del').onclick = () => App.deleteColor(App.selectedColor);
    selectTab(el, store.get('tab.pal-sc', 'Styles'));
  }
  App.refreshStyles = function () {
    const names = Object.keys(App.doc.styles);
    const sel = $('cp-style');
    if (sel) sel.innerHTML = names.map((n) => `<option>${esc(n)}</option>`).join('');
    const list = $('style-list');
    if (list) list.innerHTML = names.map((n) => {
      const st = App.doc.styles[n];
      return `<li role="option" data-name="${esc(n)}"><span>${esc(n)}</span><span class="meta">${+st.size}/${st.leading === 'auto' ? 'A' : +st.leading}</span></li>`;
    }).join('');
    if (!App.doc.styles[App.defaultStyle]) App.defaultStyle = names[0];
    App.syncControls && App.syncControls();
  };
  App.refreshColors = function () {
    const cl = $('color-list');
    if (!cl) return;
    cl.innerHTML = '<li data-name="[None]"><span class="swatch" style="background:linear-gradient(135deg,#fff 45%,#e00 47%,#e00 53%,#fff 55%)"></span><span>[None]</span></li>' +
      App.doc.colors.map((c) => `<li role="option" data-name="${esc(c.name)}" class="${App.selectedColor === c.name ? 'on' : ''}"><span class="swatch" style="background:${esc(c.hex)}"></span><span>${esc(c.name)}</span>${c.fixed ? '<span class="meta">•</span>' : ''}</li>`).join('');
    document.querySelectorAll('[data-cm]').forEach((b) => b.classList.toggle('on', b.dataset.cm === App.colorMode));
  };

  // ------------------------------------------------------------------ layers & master pages palette
  function buildLM() {
    const el = $('pal-lm');
    const pl = el.querySelector('[data-page="Layers"]');
    pl.innerHTML = `<div class="fp-body"><ul id="layer-list" class="plist" aria-label="Layers"></ul></div>
      <div class="fp-foot"><button class="mini" id="ly-move" title="Move selected objects to the highlighted layer">${tbIcon('tomaster')}</button><button class="mini" id="ly-up" title="Move layer up">${tbIcon('up')}</button><button class="mini" id="ly-down" title="Move layer down">${tbIcon('down')}</button><span class="sp"></span><button class="mini" id="ly-new" title="New layer">${tbIcon('plus')}</button><button class="mini" id="ly-del" title="Delete layer">${tbIcon('trash')}</button></div>`;
    const pm = el.querySelector('[data-page="Master Pages"]');
    pm.innerHTML = `<div class="fp-body"><ul id="master-list" class="plist" aria-label="Master pages"></ul></div>
      <div class="fp-foot"><span class="clabel" style="padding:0 4px" id="ms-hint">Click: apply · Double-click: edit</span><span class="sp"></span><button class="mini" id="ms-edit" title="Edit master page">${tbIcon('edit')}</button><button class="mini" id="ms-new" title="New master page">${tbIcon('plus')}</button><button class="mini" id="ms-del" title="Delete master page">${tbIcon('trash')}</button></div>`;
    const ll = $('layer-list');
    ll.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const L = App.doc.layers.find((l) => l.id === li.dataset.id);
      if (e.target.closest('.lyr-eye')) { App.checkpoint(); L.visible = !L.visible; App.changed(); App.refreshLayers(); return; }
      if (e.target.closest('.lyr-lock')) { App.checkpoint(); L.locked = !L.locked; App.changed(); App.refreshLayers(); return; }
      App.doc.activeLayer = L.id;
      App.refreshLayers();
    });
    ll.addEventListener('dblclick', async (e) => {
      const li = e.target.closest('li');
      if (!li || e.target.closest('button')) return;
      const L = App.doc.layers.find((l) => l.id === li.dataset.id);
      const v = await BV.UI.prompt('Layer Options', 'Name', L.name);
      if (v) { App.checkpoint(); L.name = v.trim() || L.name; App.setDirty(true); App.refreshLayers(); }
    });
    $('ly-new').onclick = () => { App.checkpoint(); const id = BV.newId(App.doc, 'L'); App.doc.layers.push({ id, name: 'Layer ' + App.doc.layers.length, visible: true, locked: false, color: ['#e0544a', '#3aa655', '#d68a1a', '#8e5bd6', '#2b9fc4'][App.doc.layers.length % 5] }); App.doc.activeLayer = id; App.setDirty(true); App.refreshLayers(); };
    $('ly-del').onclick = async () => {
      if (App.doc.layers.length < 2) return BV.UI.status('A publication needs at least one layer.');
      const L = App.doc.layers.find((l) => l.id === App.doc.activeLayer);
      const count = Object.values(App.doc.items).filter((it) => (it.layer || 'L1') === L.id).length;
      if (count && !(await BV.UI.confirm(`Delete layer “${L.name}” and the ${count} object${count === 1 ? '' : 's'} on it?`, 'Delete'))) return;
      App.checkpoint();
      App.deleteItems(Object.values(App.doc.items).filter((it) => (it.layer || 'L1') === L.id).map((it) => it.id));
      App.doc.layers = App.doc.layers.filter((l) => l.id !== L.id);
      App.doc.activeLayer = App.doc.layers[0].id;
      App.sel = { kind: 'none' };
      App.changed(); App.refreshLayers();
    };
    const moveLayer = (d) => { const i = App.doc.layers.findIndex((l) => l.id === App.doc.activeLayer); const j = i + d; if (j < 0 || j >= App.doc.layers.length) return; App.checkpoint(); const a = App.doc.layers; [a[i], a[j]] = [a[j], a[i]]; App.changed(); App.refreshLayers(); };
    $('ly-up').onclick = () => moveLayer(1);
    $('ly-down').onclick = () => moveLayer(-1);
    $('ly-move').onclick = () => { if (App.sel.kind !== 'items') return BV.UI.status('Select objects first.'); App.checkpoint(); for (const id of App.sel.ids) App.doc.items[id].layer = App.doc.activeLayer; App.changed(); };
    const ml = $('master-list');
    ml.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      App.masterSel = li.dataset.m;
      if (App.view.master) {
        // in master view a click switches to that master
        if (li.dataset.m !== 'none') App.gotoSpread(0, li.dataset.m === '' ? true : li.dataset.m);
        return App.refreshMasters();
      }
      App.applyMaster(li.dataset.m === 'none' ? null : li.dataset.m, App.placements.map((p) => p.idx));
    });
    ml.addEventListener('dblclick', (e) => {
      const li = e.target.closest('li');
      if (!li || li.dataset.m === 'none') return;
      App.gotoSpread(0, li.dataset.m === '' ? true : li.dataset.m);
    });
    $('ms-edit').onclick = () => { const m = App.masterSel; App.gotoSpread(0, m && m !== 'none' ? m : true); };
    $('ms-new').onclick = () => App.command('newMaster');
    $('ms-del').onclick = () => App.command('deleteMaster');
    selectTab(el, store.get('tab.pal-lm', 'Layers'));
  }
  App.refreshLayers = function () {
    const ll = $('layer-list');
    if (!ll) return;
    // topmost layer first, like PageMaker
    ll.innerHTML = [...App.doc.layers].reverse().map((l) => `<li data-id="${l.id}" class="${App.doc.activeLayer === l.id ? 'on' : ''}">
      <button class="lyr-eye ${l.visible === false ? 'lyr-off' : ''}" title="Show/hide">${tbIcon('eye')}</button>
      <button class="lyr-lock ${l.locked ? '' : 'lyr-off'}" title="Lock/unlock">${tbIcon(l.locked ? 'lock' : 'unlock')}</button>
      <span class="swatch" style="background:${esc(l.color)};width:10px;height:10px"></span><span>${esc(l.name)}</span></li>`).join('');
  };
  App.refreshMasters = function () {
    const ml = $('master-list');
    if (!ml || !App.doc) return;
    const d = App.doc;
    let cur;
    if (App.view.master) cur = App.masterId();
    else { const ids = new Set(App.placements.map((p) => (d.pages[p.idx] ? BV.pageMasterId(d, d.pages[p.idx]) : ''))); cur = ids.size === 1 ? [...ids][0] : undefined; }
    const lr = d.setup.doubleSided && d.setup.facing ? 'L R' : 'R';
    const row = (id, name) => `<li data-m="${id === null ? 'none' : esc(id)}" class="${cur === id ? 'on' : ''}"><span>${esc(name)}</span>${id === null ? '' : `<span class="meta">${lr}</span>`}</li>`;
    const sig = JSON.stringify([cur, lr, d.masters]);
    if (ml.dataset.sig === sig) return;
    ml.dataset.sig = sig;
    ml.innerHTML = (App.view.master ? '' : row(null, '[None]')) + row('', 'Document Master') + (d.masters || []).map((m) => row(m.id, m.name)).join('');
  };

  // ------------------------------------------------------------------ IAST palette
  function buildIAST() {
    const body = $('iast-pal').querySelector('.fp-body');
    body.innerHTML = BV.IAST_CHARS.map((c) => `<button title="${c}">${c}</button>`).join('');
    body.addEventListener('mousedown', (e) => e.preventDefault());
    body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (!$('story-editor').hidden) document.execCommand('insertText', false, b.textContent);
      else if (App.sel.kind === 'text') App.insertText(b.textContent, { undoKey: 'type' });
      else BV.UI.status('Click into text first.');
    });
  }

  // ------------------------------------------------------------------ font picker
  App.fontList = BV.BUNDLED_FONTS.slice();
  App.recentFonts = store.get('recentFonts', []);
  App.loadSystemFonts = async function () {
    let sys = [], symbol = [];
    try { const r = await native.fonts(); sys = r.list || []; symbol = r.symbol || []; } catch (_) {}
    App.systemFonts = sys.filter((f) => !BV.BUNDLED_FONTS.includes(f));
    App.symbolFonts = new Set(symbol);
    App.fontList = [...BV.BUNDLED_FONTS, ...App.systemFonts];
    App.fontSet = new Set(App.fontList);
    BV.NUDI_FONTS = [...App.systemFonts.filter((f) => /^nudi/i.test(f)), 'Praja03', 'Praja01', 'Praja05', 'Praja07'];
  };
  // Make sure installed fonts used in the document are loaded straight from their font files,
  // so they draw (and print) correctly even when Windows lists them under another name.
  App.loadedFonts = new Set(BV.BUNDLED_FONTS);
  App.fontCssText = '';
  App.ensureFonts = async function (families) {
    if (families.some((f) => /^(nudi|baraha|brh)/i.test(f || ''))) families = [...families, ...BV.NUDI_FONTS];
    const need = [...new Set(families)].filter((f) => f && !App.loadedFonts.has(f) && (!App.fontSet || App.fontSet.has(f)));
    if (!need.length || !window.native) return false;
    need.forEach((f) => App.loadedFonts.add(f));
    let css = '';
    try { css = await native.fontCss(need); } catch (_) { return false; }
    if (!css) return false;
    App.fontCssText += css;
    let st = document.getElementById('sysfonts');
    if (!st) { st = document.createElement('style'); st.id = 'sysfonts'; document.head.appendChild(st); }
    st.textContent = App.fontCssText;
    await Promise.all(need.map((f) => document.fonts.load(`12px "${f}"`, 'Aa ಕ अ').catch(() => {})));
    await Promise.all(need.map((f) => document.fonts.load(`bold 12px "${f}"`, 'Aa').catch(() => {})));
    BV.Layout.clearCache();
    if (App.doc) { App.markAll(); App.render(); }
    return true;
  };
  App.docFonts = function (d = App.doc) {
    const out = new Set();
    for (const st of Object.values(d.styles)) out.add(st.font);
    for (const s of Object.values(d.stories)) for (const p of s.paras) for (const r of p.runs) if (r.font) out.add(r.font);
    return [...out];
  };
  function openFontPicker(input) {
    const pop = $('font-pop');
    const r = input.getBoundingClientRect();
    const filter = input.value.trim().toLowerCase();
    const showAll = input.dataset.showAll === '1';
    const match = (f) => showAll || !filter || f.toLowerCase().includes(filter);
    const row = (f) => `<div class="fi" data-f="${esc(f)}"><span class="fname">${esc(f)}</span><span class="fs" style="font-family:'${esc(f).replace(/'/g, '')}', 'Segoe UI'">Aa ಕನ್ನಡ अ</span></div>`;
    let h = '';
    const rec = App.recentFonts.filter((f) => App.fontList.includes(f) && match(f));
    if (rec.length) h += `<div class="fgrp">Recent</div>` + rec.map(row).join('');
    const bun = BV.BUNDLED_FONTS.filter(match);
    if (bun.length) h += `<div class="fgrp">Included with BV Mudrana (Unicode)</div>` + bun.map(row).join('');
    const sys = (App.systemFonts || []).filter(match);
    if (sys.length) h += `<div class="fgrp">Installed on this computer (${sys.length})</div>` + sys.map(row).join('');
    if (!h) h = `<div class="fgrp">No font matches “${esc(filter)}”, it will be used if installed</div>`;
    pop.innerHTML = h;
    pop.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
    const below = window.innerHeight - r.bottom;
    if (below < 260) { pop.style.top = ''; pop.style.bottom = (window.innerHeight - r.top + 2) + 'px'; } else { pop.style.bottom = ''; pop.style.top = r.bottom + 2 + 'px'; }
    pop.hidden = false;
    pop.dataset.for = input.id;
    const cur = pop.querySelector(`.fi[data-f="${CSS.escape(input.value)}"]`);
    if (cur) { cur.classList.add('on'); cur.scrollIntoView({ block: 'center' }); }
  }
  App.openFontPicker = openFontPicker;
  function closeFontPicker() { $('font-pop').hidden = true; }
  function wireFontPicker() {
    const pop = $('font-pop');
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.addEventListener('click', (e) => {
      const fi = e.target.closest('.fi');
      if (!fi) return;
      const input = document.getElementById(pop.dataset.for);
      input.value = fi.dataset.f;
      App.recentFonts = [fi.dataset.f, ...App.recentFonts.filter((f) => f !== fi.dataset.f)].slice(0, 8);
      store.set('recentFonts', App.recentFonts);
      window.native && native.menuFonts(App.recentFonts);
      closeFontPicker();
      input.dataset.dirty = '1';
      input.dispatchEvent(new Event('change'));
    });
    document.addEventListener('mousedown', (e) => { if (!pop.hidden && !e.target.closest('#font-pop') && !e.target.closest('.fontbox')) closeFontPicker(); });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.fdrop');
      if (!b) return;
      const input = document.getElementById(b.dataset.fontfor);
      if (!pop.hidden && pop.dataset.for === input.id) return closeFontPicker();
      input.dataset.showAll = '1';
      openFontPicker(input);
    });
    document.addEventListener('input', (e) => {
      if (e.target.closest && e.target.closest('.fontbox') && e.target.tagName === 'INPUT') { e.target.dataset.showAll = ''; openFontPicker(e.target); }
    });
    document.addEventListener('keydown', (e) => {
      if (pop.hidden) return;
      if (e.key === 'Escape') { closeFontPicker(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...pop.querySelectorAll('.fi')];
        let i = items.findIndex((x) => x.classList.contains('on'));
        items.forEach((x) => x.classList.remove('on'));
        i = Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
        if (items[i]) { items[i].classList.add('on'); items[i].scrollIntoView({ block: 'nearest' }); document.getElementById(pop.dataset.for).value = items[i].dataset.f; }
      }
      if (e.key === 'Enter') closeFontPicker();
    }, true);
  }

  // ------------------------------------------------------------------ welcome / about screen
  App.showWelcome = async function () {
    const w = $('welcome');
    let recent = [];
    try { recent = await native.recent(); } catch (_) {}
    let ver = '0.2';
    try { ver = (await native.appInfo()).version; } catch (_) {}
    const recentHTML = recent.length
      ? `<ul class="wl-recent">${recent.map((p) => `<li data-path="${esc(p)}" title="${esc(p)}"><b>${esc(p.split(/[\\/]/).pop())}</b><span>${esc(p)}</span></li>`).join('')}</ul>`
      : `<div class="wl-recent"><div class="wl-empty">No recent publications yet.</div></div>`;
    w.innerHTML = `<div class="wl-card" role="dialog" aria-modal="true" aria-label="Welcome to BV Mudrana">
      <div class="wl-about">
        <img class="wl-logo-img" src="img/brahmavidya-logo.png" alt="Brahmavidya">
        <div><div class="wl-name">BV Mudrana</div><div class="wl-ver">VERSION ${esc(ver)}</div></div>
        <div class="wl-tag">Page layout the PageMaker way, with real Unicode for Kannada, Devanagari and IAST. Opens and saves PageMaker 6.5 and 7 publications.</div>
        <div class="wl-scripts" lang="kn">ಮುದ್ರಣ · <span lang="sa">मुद्रणम्</span> · <span lang="sa-Latn">mudraṇa</span></div>
        <div class="wl-credit"><b>Designed By Tejas H Badala and Dr R S Nandakumar for Brahmavidya</b>Kannada conversion: Brahmavidya Kannada converter · Fonts: Noto (SIL OFL), Inter, Fraunces · PageMaker file reading based on libpagemaker (MPL 2.0)</div>
      </div>
      <div class="wl-actions">
        <div class="wl-eyebrow">Welcome</div>
        <h2>What would you like to do?</h2>
        <button class="wl-big primary" data-act="new"><span class="wl-ic">${tbIcon('new')}</span><div><b>New publication…</b><span>Page size, margins, columns and page numbering</span></div></button>
        <button class="wl-big" data-act="open"><span class="wl-ic">${tbIcon('open')}</span><div><b>Open publication…</b><span>BV Mudrana (.bvm) or PageMaker (.pmd, .pm7, .p65, .pm6)</span></div></button>
        <div class="clabel" style="font-size:11px;margin-top:6px">Recent publications</div>
        ${recentHTML}
        <div class="wl-foot"><label class="check"><input type="checkbox" id="wl-show" ${store.get('welcome', true) ? 'checked' : ''}> Show this at startup</label><span class="sp"></span><button class="btn" data-act="close">Close</button></div>
      </div></div>`;
    w.hidden = false;
    const done = () => { w.hidden = true; };
    w.querySelector('#wl-show').onchange = (e) => store.set('welcome', e.target.checked);
    w.onclick = async (e) => {
      const li = e.target.closest('li[data-path]');
      if (li) { done(); App.command('recent', li.dataset.path); return; }
      const b = e.target.closest('[data-act]');
      if (!b) { if (e.target === w) done(); return; }
      done();
      if (b.dataset.act === 'new') App.command('new');
      if (b.dataset.act === 'open') App.command('open');
    };
    const onKey = (e) => { if (e.key === 'Escape' && !w.hidden) { done(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    setTimeout(() => w.querySelector('[data-act="new"]').focus(), 50);
  };

  // ------------------------------------------------------------------ status / info
  App.updateInfo = function () {
    const pos = $('st-pos');
    if (App.mouseSpread && App.doc) {
      const p = App.placementAt(App.mouseSpread.x);
      const u = App.doc.setup.units;
      pos.textContent = `x ${BV.fmt(App.mouseSpread.x - p.x0, u)}  y ${BV.fmt(App.mouseSpread.y, u)} ${BV.UNIT_LABEL[u]}`;
    }
  };

  App.initPanels = function () {
    document.querySelectorAll('.fpanel').forEach(makePanel);
    buildToolbar();
    buildToolbox();
    buildControl();
    buildSC();
    buildLM();
    buildIAST();
    wireFontPicker();
    for (const id of ['pal-tools', 'pal-control', 'pal-sc', 'pal-lm']) $(id).hidden = !store.get('show.' + id, true);
    if (store.get('hideToolbar', false)) document.body.classList.add('hide-toolbar');
    syncMenuChecks();
  };
  App.syncMenuChecks = syncMenuChecks;
})();
