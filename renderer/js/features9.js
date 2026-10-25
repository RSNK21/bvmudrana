/* BV Mudrana 0.9: publications in tabs, the start screen, InDesign (IDML, INDD) and PageMaker 4/5 files,
   Chanakya / Walkman-Chanakya / Nalanda to Unicode, Smart Guides, typographer's quotes, live preflight
   and word count in the status bar. */
(function () {
  const BV = window.BV, App = window.App, UI = BV.UI, T = BV.Text;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => BV.Render.esc(String(s == null ? '' : s));
  const doc = () => App.doc;
  const store = App.store;
  const extOf = (p) => (String(p || '').match(/\.([^.\\/]+)$/) || [])[1]?.toLowerCase() || '';
  const baseName = (p) => String(p || '').split(/[\\/]/).pop();

  // ================================================================== What's new
  App.WHATS_NEW_PREV = App.WHATS_NEW;
  App.WHATS_NEW = {
    version: '0.9.2',
    groups: [
      ['Fixed in 0.9.2', [
        'PageMaker files keep their layout: every text block now starts with exactly the text it had in PageMaker, threaded in PageMaker\u2019s own order.',
        'Tab stops from PageMaker are kept, so tables line up; right-aligned tabs work for whole running heads.',
        'Lines and rules in PageMaker 5 files are drawn where they belong (they were slanted across the page).',
        'Paragraphs that PageMaker hyphenated are hyphenated here too (US English patterns), and justified lines may squeeze word spaces to the paragraph\u2019s minimum, as in PageMaker.',
        'BV Matanga (Kannada display type) now comes with BV Mudrana, and all the Brahmavidya fonts (Praja Unicode, Praja01-08, BV Chitkala, BV Nanda, BV Matanga) are installed in Windows for your account, so other programs can use them too.',
      ]],
      ['Fixed in 0.9.1', [
        'PageMaker 5 publications (.pm5) now open directly, without PageMaker 7: pages, text blocks in reading order, running heads, lines and boxes.',
        'Nalanda accents typed before their letter (ū, ṛ and the like) now become the right Unicode letters.',
        'Running heads in text blocks shorter than one line now show.',
      ]],
      ['Several publications at once', [
        'Every publication opens in its own tab above the pages. Open as many as you like (File > Open can now pick several files at once); nothing has to be closed first.',
        'Ctrl+Tab and Ctrl+Shift+Tab move between tabs, Ctrl+W closes one, Ctrl+Shift+T brings back the last one you closed. Tabs can be dragged into a new order; middle-click closes a tab.',
        'The Window menu lists the open publications.',
      ]],
      ['A new start screen', [
        'A quieter start screen: new publication sizes used in Indian book printing (Demy, Crown, Royal) and A4/A5 in one click, and your recent files as pictures of their first page, with a filter box.',
      ]],
      ['More files', [
        'InDesign: open IDML files directly (InDesign CS4 to 2026). INDD, INDT and INX open through an installed InDesign, which BV Mudrana drives in the background.',
        'InDesign: File > Save As or File > Export can now write IDML (opens in InDesign CS4 and later), and INDD or INDT when InDesign is installed. Indian-language paragraphs use the World-Ready composer so they shape correctly in InDesign.',
        'PageMaker 5 publications (.pm5) open directly. PageMaker 4 files open through PageMaker 7 on this computer, which converts them.',
      ]],
      ['Old Devanagari and IAST fonts', [
        'Text in Chanakya, Chanakyamath and Walkman-Chanakya-901 becomes Unicode Devanagari in BV Chitkala, BV Chitkala Math and BV Chitkala Hindi (the same letters and widths). Nalanda (Nalandagar, Nalandagara and the other Nalanda cuts) becomes Unicode IAST in BV Nanda.',
        'This works when opening PageMaker files, placing Word or RTF files, in Utilities > Convert Legacy Text to Unicode, and the other way round when saving back to PageMaker.',
        'The BV Chitkala and BV Nanda fonts come with BV Mudrana.',
      ]],
      ['Pictures from PageMaker', [
        'Pictures that sit on text now push the text aside, as PageMaker’s text wrap does (an option in the Open dialog).',
      ]],
      ['Working faster', [
        'View > Smart Guides (InDesign): while you drag, objects snap to the edges and centres of other objects and the page centre, with a pink line to show it.',
        'Type > Use Typographer’s Quotes (InDesign, Word): straight quotes become curly quotes as you type.',
        'The status bar shows the word count of the story you are in, and a live preflight light: green when all is well, red with the number of problems (missing fonts, overset text). Click it for the full report.',
      ]],
    ],
  };

  // ================================================================== tabs
  const tabs = [];
  let cur = 0;
  const closed = [];
  const blankState = () => null;
  function capture() {
    const b = $('board');
    return {
      doc: App.doc, filePath: App.filePath, docName: App.docName, dirty: App.dirty,
      undo: App.undoStack, redo: App.redoStack, view: Object.assign({}, App.view), sel: App.sel,
      zeroPt: App.zeroPt, ph: App.pageHistory, pf: App.pageFuture, pmSource: App.pmSource, idSource: App.idSource,
      sl: b ? b.scrollLeft : 0, st: b ? b.scrollTop : 0, key: tabs[cur] && tabs[cur].key,
    };
  }
  let keySeq = 1;
  function apply(t) {
    App.doc = t.doc;
    App.filePath = t.filePath;
    App.docName = t.docName;
    App.undoStack = t.undo || [];
    App.redoStack = t.redo || [];
    App.view = Object.assign({}, t.view);
    App.sel = t.sel || { kind: 'none' };
    App.zeroPt = t.zeroPt || null;
    App.pageHistory = t.ph || [];
    App.pageFuture = t.pf || [];
    App.pmSource = t.pmSource || null;
    App.idSource = t.idSource || null;
    App.loaded = null;
    App.typingAttrs = null;
    App.markAll();
    App.refreshStyles();
    App.refreshColors && App.refreshColors();
    App.refreshLayers && App.refreshLayers();
    App.refreshMasters && App.refreshMasters();
    App.setDirty(!!t.dirty);
    App.renderNow();
    if (App.view.fit) App.fitZoom();
    else { App.setZoom(App.view.zoom, null, false, true); const b = $('board'); b.scrollLeft = t.sl; b.scrollTop = t.st; App.drawRulers(); }
    if (App.ensureFonts) App.ensureFonts(App.docFonts(App.doc));
    if (window.native && native.menuStyles) native.menuStyles(Object.keys(App.doc.styles));
    if (App.syncControls) App.syncControls();
  }
  const pristine = () => !App.dirty && !App.filePath && !App.docName && !App.pmSource && !App.idSource && App.doc && !Object.keys(App.doc.items).length && (App.undoStack || []).length === 0;
  const labelOf = (i) => {
    const t = i === cur ? { filePath: App.filePath, docName: App.docName, dirty: App.dirty, pmSource: App.pmSource, idSource: App.idSource } : tabs[i] || {};
    const name = t.filePath ? baseName(t.filePath) : t.docName ? t.docName : 'Untitled';
    const kind = extOf(t.filePath) || (t.pmSource ? extOf(t.pmSource.name) : t.idSource ? 'idml' : 'bvm');
    return { name, kind, dirty: !!t.dirty, path: t.filePath || (t.pmSource && t.pmSource.path) || (t.idSource && t.idSource.path) || '' };
  };
  App.tabCount = () => tabs.length;
  App.findTab = (p) => {
    if (!p) return -1;
    const n = String(p).toLowerCase();
    for (let i = 0; i < tabs.length; i++) { const l = labelOf(i); if (l.path && l.path.toLowerCase() === n) return i; }
    return -1;
  };
  App.switchTab = function (i) {
    if (i < 0 || i >= tabs.length || i === cur) return;
    if (!$('story-editor').hidden && App.closeStoryEditor) App.closeStoryEditor();
    if (App.sel.kind === 'text') App.leaveText();
    tabs[cur] = capture();
    cur = i;
    App.wantNewTab = false;
    apply(tabs[cur]);
    renderTabs();
  };
  // the core keeps one publication in App; wrapping setDoc gives each new one its own tab
  const baseSetDoc = App.setDoc;
  App.setDoc = function (d, filePath) {
    if (App.wantNewTab && tabs.length && App.doc && !pristine()) {
      if (App.sel.kind === 'text') App.leaveText();
      tabs[cur] = capture();
      tabs.push(null);
      cur = tabs.length - 1;
    }
    App.wantNewTab = false;
    App.pmSource = null;
    App.idSource = null;
    const r = baseSetDoc.apply(this, arguments);
    if (!tabs.length) tabs.push(null);
    tabs[cur] = { key: keySeq++ };
    renderTabs();
    if (filePath) setTimeout(captureThumb, 1500);
    return r;
  };
  const baseSetDirty = App.setDirty;
  App.setDirty = function (v) {
    baseSetDirty.apply(this, arguments);
    // the window asks before closing when any publication has changes
    const any = !!v || tabs.some((t, i) => i !== cur && t && t.dirty);
    if (window.native) native.setDirty(any);
    renderTabsSoon();
  };
  async function closeTab(i) {
    if (i !== cur) App.switchTab(i);
    if (App.dirty) {
      const r = await native.confirm(`Save changes to ${labelOf(cur).name} first?`, ['Save', "Don't Save", 'Cancel']);
      if (r === 2) return false;
      if (r === 0 && !(await App.saveCurrent(false))) return false;
    }
    const st = capture();
    if (st.filePath || st.pmSource || st.idSource || Object.keys(st.doc.items).length) closed.push(st);
    if (closed.length > 10) closed.shift();
    if (tabs.length > 1) {
      tabs.splice(cur, 1);
      cur = Math.min(cur, tabs.length - 1);
      apply(tabs[cur]);
      renderTabs();
    } else {
      baseSetDoc.call(App, BV.newDocument(), null);
      App.pmSource = null; App.idSource = null;
      tabs[0] = { key: keySeq++ };
      renderTabs();
      App.showWelcome();
    }
    return true;
  }
  App.closeTab = closeTab;
  function reopenTab() {
    const t = closed.pop();
    if (!t) return UI.status('No closed publication to bring back.');
    if (App.sel.kind === 'text') App.leaveText();
    if (!pristine()) { tabs[cur] = capture(); tabs.push(null); cur = tabs.length - 1; }
    tabs[cur] = t;
    apply(t);
    renderTabs();
  }
  async function saveAllAndQuit() {
    for (let i = 0; i < tabs.length; i++) {
      const dirty = i === cur ? App.dirty : tabs[i] && tabs[i].dirty;
      if (!dirty) continue;
      App.switchTab(i);
      if (!(await App.saveCurrent(false))) return;
    }
    native.quitNow();
  }

  // ---------- the tab bar
  let tabsTimer = 0;
  function renderTabsSoon() { if (!tabsTimer) tabsTimer = setTimeout(() => { tabsTimer = 0; renderTabs(); }, 30); }
  function ensureBar() {
    let bar = $('doctabs');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'doctabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Open publications');
    $('main').before(bar);
    bar.addEventListener('mousedown', (e) => {
      const t = e.target.closest('.dt');
      if (e.button === 1 && t) { e.preventDefault(); closeTab(+t.dataset.i); return; }
    });
    bar.addEventListener('click', (e) => {
      const x = e.target.closest('.dt-x');
      if (x) { e.stopPropagation(); closeTab(+x.closest('.dt').dataset.i); return; }
      if (e.target.closest('.dt-new')) { App.command('new'); return; }
      if (e.target.closest('.dt-home')) { App.showWelcome(); return; }
      const t = e.target.closest('.dt');
      if (t) App.switchTab(+t.dataset.i);
    });
    bar.addEventListener('keydown', (e) => {
      const t = e.target.closest('.dt');
      if (!t) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); App.switchTab(+t.dataset.i); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = bar.querySelectorAll('.dt'); const k = Math.max(0, Math.min(n.length - 1, +t.dataset.i + (e.key === 'ArrowRight' ? 1 : -1))); n[k].focus(); }
      if (e.key === 'Delete') closeTab(+t.dataset.i);
    });
    // drag a tab to a new place
    let dragFrom = -1;
    bar.addEventListener('dragstart', (e) => { const t = e.target.closest('.dt'); if (!t) return; dragFrom = +t.dataset.i; e.dataTransfer.effectAllowed = 'move'; t.classList.add('dragging'); });
    bar.addEventListener('dragover', (e) => { if (dragFrom < 0) return; e.preventDefault(); const t = e.target.closest('.dt'); bar.querySelectorAll('.dt').forEach((x) => x.classList.toggle('drop', x === t)); });
    bar.addEventListener('dragend', () => { dragFrom = -1; bar.querySelectorAll('.dt').forEach((x) => x.classList.remove('drop', 'dragging')); });
    bar.addEventListener('drop', (e) => {
      e.preventDefault();
      const t = e.target.closest('.dt');
      if (!t || dragFrom < 0) return;
      const to = +t.dataset.i;
      if (to === dragFrom) return;
      tabs[cur] = capture();
      const activeKey = tabs[cur].key;
      const [m] = tabs.splice(dragFrom, 1);
      tabs.splice(to, 0, m);
      cur = Math.max(0, tabs.findIndex((x) => x && x.key === activeKey));
      renderTabs();
    });
    return bar;
  }
  const KIND = { bvm: 'BVM', bvt: 'BVT', pmd: 'PMD', pm7: 'PM7', p65: 'P65', pm6: 'PM6', pm5: 'PM5', pm4: 'PM4', idml: 'IDML', indd: 'INDD', indt: 'INDT', pmt: 'PMT' };
  function renderTabs() {
    const bar = ensureBar();
    let h = '<button class="dt-home" title="Start screen" aria-label="Start screen"><svg viewBox="0 0 20 20"><path d="M3.5 9.5L10 4l6.5 5.5M5.5 8v8h9V8"/></svg></button>';
    tabs.forEach((_, i) => {
      const l = labelOf(i);
      h += `<div class="dt${i === cur ? ' on' : ''}${l.dirty ? ' dirty' : ''}" role="tab" tabindex="${i === cur ? 0 : -1}" aria-selected="${i === cur}" data-i="${i}" draggable="true" title="${esc(l.path || l.name)}"><span class="dt-k">${esc(KIND[l.kind] || l.kind.toUpperCase())}</span><span class="dt-name">${esc(l.name)}</span><span class="dt-dot" aria-label="${l.dirty ? 'not saved' : ''}"></span><button class="dt-x" tabindex="-1" aria-label="Close ${esc(l.name)}" title="Close (Ctrl+W)"><svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg></button></div>`;
    });
    h += '<button class="dt-new" title="New publication (Ctrl+N)" aria-label="New publication"><svg viewBox="0 0 20 20"><path d="M10 4.5v11M4.5 10h11"/></svg></button>';
    if (bar.dataset.sig !== h) { bar.innerHTML = h; bar.dataset.sig = h; }
    if (window.native && native.menuState) native.menuState({ docs: tabs.map((_, i) => labelOf(i).name + (labelOf(i).dirty ? ' •' : '')), curDoc: cur });
  }

  // ================================================================== thumbnails of first pages, for the start screen
  async function captureThumb() {
    const key = App.filePath || (App.pmSource && App.pmSource.path) || (App.idSource && App.idSource.path);
    if (!key || !window.native || !native.thumbCapture) return;
    if (!$('welcome').hidden || document.querySelector('#modal-root .dlg')) return;
    const p = App.placements[0];
    if (!p) return;
    const a = App.spreadToClient(p.x0, 0), b = App.spreadToClient(p.x0 + doc().setup.w, doc().setup.h);
    const br = $('board').getBoundingClientRect();
    const x0 = Math.max(a.x, br.left), y0 = Math.max(a.y, br.top), x1 = Math.min(b.x, br.right), y1 = Math.min(b.y, br.bottom);
    if (x1 - x0 < 40 || y1 - y0 < 40) return;
    try {
      const jpg = await native.thumbCapture({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      if (!jpg) return;
      const th = store.get('thumbs', {});
      th[key] = { img: 'data:image/jpeg;base64,' + jpg, t: Date.now() };
      // keep the newest 30
      const keys = Object.keys(th).sort((m, n) => th[n].t - th[m].t);
      for (const k of keys.slice(30)) delete th[k];
      store.set('thumbs', th);
    } catch (_) {}
  }
  App.captureThumb = captureThumb;

  // ================================================================== the start screen
  const PRESETS = [
    { name: 'Demy 1/8', w: 140, h: 216, note: 'Books', ds: true },
    { name: 'Crown 1/8', w: 121, h: 181, note: 'Small books', ds: true },
    { name: 'Crown 1/4', w: 184, h: 241, note: 'Large books', ds: true },
    { name: 'Royal 1/8', w: 159, h: 241, note: 'Books', ds: true },
    { name: 'A5', w: 148, h: 210, note: 'Booklets', ds: true },
    { name: 'A4', w: 210, h: 297, note: 'Magazines, forms', ds: false },
    { name: 'Letter', w: 215.9, h: 279.4, note: 'US paper', ds: false, label: '8.5 × 11 in' },
  ];
  const ago = (t) => {
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 7) { const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`; }
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const pageGlyph = (w, h, ds) => {
    const k = 64 / Math.max(w, h), W = w * k, H = h * k;
    const m = 7 * k * 2.2;
    return `<svg class="st-pg" viewBox="0 0 ${ds ? 2 * W + 2 : W} ${H}" width="${ds ? 2 * W + 2 : W}" height="${H}" aria-hidden="true">${ds ? `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" class="st-pg-p"/><rect x="${W + 1.5}" y="0.5" width="${W - 1}" height="${H - 1}" class="st-pg-p"/><rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2.4 * m}" class="st-pg-m"/><rect x="${W + 1 + m}" y="${m}" width="${W - 2 * m}" height="${H - 2.4 * m}" class="st-pg-m"/>` : `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" class="st-pg-p"/><rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2.4 * m}" class="st-pg-m"/>`}</svg>`;
  };
  let startView = store.get('startView', 'grid');
  App.showWelcome = async function () {
    const w = $('welcome');
    let recent = [];
    try { recent = native.recentInfo ? await native.recentInfo() : (await native.recent()).map((p) => ({ path: p })); } catch (_) {}
    let ver = App.WHATS_NEW.version;
    try { ver = (await native.appInfo()).version; } catch (_) {}
    const th = store.get('thumbs', {});
    const name = App.userName;
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const card = (r) => {
      const p = r.path, k = extOf(p), t = th[p];
      const folder = p.replace(/[\\/][^\\/]*$/, '');
      return `<li class="st-file" data-path="${esc(p)}" tabindex="0" title="${esc(p)}">
        <div class="st-thumb">${t ? `<img src="${t.img}" alt="">` : `<div class="st-nothumb"><svg viewBox="0 0 40 52"><path d="M4 2h22l10 10v38H4z"/><path d="M26 2v10h10"/></svg></div>`}<span class="st-kind k-${esc(k)}">${esc(KIND[k] || k.toUpperCase())}</span></div>
        <div class="st-meta"><b>${esc(baseName(p))}</b><span class="st-folder">${esc(folder)}</span><span class="st-when">${esc(ago(r.mtime))}</span></div>
      </li>`;
    };
    w.className = 'start';
    w.innerHTML = `<div class="st-wrap" role="dialog" aria-modal="true" aria-label="Start">
      <aside class="st-side">
        <div class="st-brand"><img src="img/mandapa-sm.png" alt=""><div><b>BV Mudrana</b><span>Version ${esc(ver)}</span></div></div>
        <button class="st-btn primary" data-act="new"><svg viewBox="0 0 20 20"><path d="M10 4.5v11M4.5 10h11"/></svg>New publication…</button>
        <button class="st-btn" data-act="open"><svg viewBox="0 0 20 20"><path d="M2.5 15.5v-10h5l1.5 2h8.5v8z"/></svg>Open…</button>
        <nav class="st-nav" aria-label="Help and settings">
          <button data-act="quickStart">Learn the basics</button>
          <button data-act="whatsNew">What's new in ${esc(String(App.WHATS_NEW.version).replace(/\.0$/, ''))}</button>
          <button data-act="appearance">Workspace and theme</button>
          <button data-act="name">${name ? 'Change your name' : 'Tell BV Mudrana your name'}</button>
        </nav>
        <div class="st-scripts" lang="kn">ಮುದ್ರಣ <span lang="sa">मुद्रणम्</span> <span lang="sa-Latn">mudraṇa</span></div>
        <div class="st-foot">
          <label class="check"><input type="checkbox" id="st-show" ${store.get('welcome', true) ? 'checked' : ''}> Show at startup</label>
          <p class="st-credit">Designed By Tejas H Badala and Dr R S Nandakumar for Brahmavidya</p>
        </div>
      </aside>
      <main class="st-main">
        <header class="st-head">
          <div><h1>${name ? `Namaste, ${esc(name)}` : 'Namaste'}</h1><p class="st-date">${esc(today)}</p></div>
          <button class="st-close" data-act="close" aria-label="Close the start screen" title="Close (Esc)"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
        </header>
        <section class="st-sec">
          <h2>Start a new publication</h2>
          <div class="st-presets">${PRESETS.map((p, i) => `<button class="st-preset" data-preset="${i}" title="${esc(p.name)}: ${p.w} × ${p.h} mm, ${p.ds ? 'facing pages' : 'single-sided'}">${pageGlyph(p.w, p.h, p.ds)}<b>${esc(p.name)}</b><span>${p.label || `${p.w} × ${p.h} mm`}</span></button>`).join('')}<button class="st-preset more" data-act="new"><svg class="st-pg" viewBox="0 0 46 64" width="46" height="64"><rect x="0.5" y="0.5" width="45" height="63" class="st-pg-d"/><path d="M23 24v16M15 32h16" class="st-pg-plus"/></svg><b>Custom…</b><span>Any size</span></button></div>
        </section>
        <section class="st-sec st-rec">
          <div class="st-sec-head">
            <h2>Recent</h2>
            <input type="search" id="st-filter" placeholder="Filter by name" aria-label="Filter recent files" ${recent.length ? '' : 'disabled'}>
            <div class="st-viewseg" role="group" aria-label="View">
              <button data-view="grid" class="${startView === 'grid' ? 'on' : ''}" aria-label="Thumbnails" title="Thumbnails"><svg viewBox="0 0 20 20"><path d="M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z"/></svg></button>
              <button data-view="list" class="${startView === 'list' ? 'on' : ''}" aria-label="List" title="List"><svg viewBox="0 0 20 20"><path d="M3.5 5h13M3.5 10h13M3.5 15h13"/></svg></button>
            </div>
          </div>
          ${recent.length ? `<ul class="st-files ${startView}">${recent.map(card).join('')}</ul><p class="st-nomatch" hidden>No recent file matches.</p>` : `<div class="st-empty"><p>Publications you open or save appear here.</p><p class="st-hint">BV Mudrana opens BV Mudrana (.bvm), PageMaker 4 to 7 (.pmd, .p65, .pm6, .pm5) and InDesign (.idml, and .indd through InDesign) files.</p></div>`}
        </section>
      </main>
    </div>`;
    const bar = $('titlebar');
    w.style.top = bar ? bar.getBoundingClientRect().bottom + 'px' : '0';
    w.hidden = false;
    const done = () => { w.hidden = true; document.removeEventListener('keydown', onKey, true); };
    w.querySelector('#st-show').onchange = (e) => store.set('welcome', e.target.checked);
    const filter = w.querySelector('#st-filter');
    if (filter) filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      let shown = 0;
      w.querySelectorAll('.st-file').forEach((li) => { const ok = !q || baseName(li.dataset.path).toLowerCase().includes(q); li.hidden = !ok; if (ok) shown++; });
      const nm = w.querySelector('.st-nomatch');
      if (nm) nm.hidden = shown > 0;
    });
    w.onclick = async (e) => {
      const v = e.target.closest('[data-view]');
      if (v) {
        startView = v.dataset.view; store.set('startView', startView);
        w.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === v));
        const ul = w.querySelector('.st-files');
        if (ul) ul.className = 'st-files ' + startView;
        return;
      }
      const li = e.target.closest('.st-file');
      if (li) { done(); App.command('recent', li.dataset.path); return; }
      const pr = e.target.closest('[data-preset]');
      if (pr) {
        done();
        const p = PRESETS[+pr.dataset.preset];
        const mm = BV.UNITS.mm;
        const small = p.w < 160;
        App.wantNewTab = true;
        App.setDoc(BV.newDocument({ w: p.w * mm, h: p.h * mm, doubleSided: p.ds, facing: p.ds, pageCount: p.ds ? 2 : 1, margins: small ? { top: 16 * mm, bottom: 20 * mm, inside: 18 * mm, outside: 14 * mm } : { top: 20 * mm, bottom: 22 * mm, inside: 20 * mm, outside: 18 * mm }, columns: p.w >= 200 ? 2 : 1 }), null);
        UI.status(`New ${p.name} publication (${p.w} × ${p.h} mm). Change it any time in File > Document Setup.`, 6000);
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      done();
      if (act === 'new') App.command('new');
      if (act === 'open') App.command('open');
      if (act === 'quickStart') App.command('quickStart');
      if (act === 'whatsNew') App.command('whatsNew');
      if (act === 'appearance') App.command('appearance');
      if (act === 'name' && App.askName) App.askName(false).then(() => App.showWelcome());
    };
    w.addEventListener('keydown', (e) => {
      const li = e.target.closest && e.target.closest('.st-file');
      if (li && e.key === 'Enter') { done(); App.command('recent', li.dataset.path); }
    });
    const onKey = (e) => { if (e.key === 'Escape' && !w.hidden && !document.querySelector('#modal-root .dlg')) { e.stopPropagation(); done(); } };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { const f = w.querySelector('.st-btn.primary'); if (f) f.focus(); }, 40);
  };

  // ================================================================== opening more kinds of files
  const baseOpen = App.openContent;
  App.openContent = async function (data) {
    if (!data) return;
    if (data.error) return UI.alert('Could not open this file: ' + data.error);
    if (data.multi) {
      for (const p of data.multi) { const d = await native.openPath(p); if (d) await App.openContent(d); }
      return;
    }
    if (data.path && App.findTab(data.path) >= 0) return App.switchTab(App.findTab(data.path));
    try {
      if (data.kind === 'pmold') return await openOldPageMaker(data);
      if (data.kind === 'idml') return await openIdml(data);
      if (data.kind === 'indd') return await openIndd(data);
      return await baseOpen.call(this, data);
    } finally {
      App.wantNewTab = false;
      setTimeout(captureThumb, 1800);
    }
  };
  async function openOldPageMaker(data) {
    const r = await UI.dialog({
      title: `Open ${data.name}`,
      width: 520,
      html: `<p class="note" style="color:var(--ink)"><b>${esc(data.name)}</b> is a PageMaker 4 or 5 publication. Its file layout is older than the one BV Mudrana reads, but PageMaker 7 converts these publications itself.</p>
        <p class="note">BV Mudrana will ask PageMaker 7 on this computer to open it and save a PageMaker 7 copy in a temporary folder, then open that copy here. Your file is not changed.</p>`,
      buttons: [{ label: 'Convert with PageMaker 7', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    UI.status('PageMaker 7 is converting ' + data.name + '…', 0);
    const c = await native.pmConvertOld(data.path).catch((e) => ({ ok: false, reason: String(e.message || e) }));
    UI.status('');
    if (c && c.kind === 'pm') { App.wantNewTab = true; return App.importPageMaker(c); }
    return UI.alert(`${data.name} could not be converted.\n\n${(c && c.reason) || ''}\n\nYou can do it by hand: open it in PageMaker 7 (File > Open), choose File > Save As, save it as a PageMaker 7 publication (.pmd), and open that file here.`);
  }
  async function openIdml(data) {
    UI.status('Reading ' + data.name + '…', 0);
    let built;
    try { built = BV.IDML.toDoc(data); } catch (e) { UI.status(''); return UI.alert('Could not read this InDesign file: ' + e.message); }
    const { doc: d, report } = built;
    App.wantNewTab = true;
    App.setDoc(d, null);
    App.docName = data.name.replace(/\.(idml|indd|indt|inx|idms)$/i, '');
    App.idSource = { name: data.name, path: data.path };
    App.setDirty(false);
    if (App.ensureFonts) await App.ensureFonts(App.docFonts(d)).catch(() => {});
    App.markAll(); App.render();
    const bits = [`${report.pages} page${report.pages === 1 ? '' : 's'}`, `${report.frames} text frame${report.frames === 1 ? '' : 's'}`];
    if (report.images) bits.push(`${report.images} picture${report.images === 1 ? '' : 's'}`);
    UI.status(`Opened ${data.name}${data.via ? ' (converted by ' + data.via.replace(/^InDesign\.Application\.?/, 'InDesign ') + ')' : ''}: ${bits.join(', ')}.`, 9000);
    if (report.notes.length) UI.alert(`${data.name} is open.\n\n` + report.notes.map((n) => '• ' + n).join('\n'));
  }
  async function openIndd(data) {
    const what = { indd: 'InDesign document', indt: 'InDesign template', inx: 'InDesign Interchange file (CS2, CS3)', idms: 'InDesign snippet' }[data.ext] || 'InDesign file';
    const r = await UI.dialog({
      title: `Open ${data.name}`,
      width: 540,
      html: `<p class="note" style="color:var(--ink)"><b>${esc(data.name)}</b> is an ${esc(what)}. Its format is private to Adobe and only InDesign can read it.</p>
        <p class="note">If InDesign (CS3 or any later version) is installed on this computer, BV Mudrana asks it to convert the file to IDML in the background and opens the result. Your file is not changed.</p>
        <p class="note">Without InDesign: open the file in InDesign on any computer, choose File > Save As (or File > Export) and pick <b>InDesign Markup (IDML)</b>, then open the .idml file here.</p>`,
      buttons: [{ label: 'Open through InDesign', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    UI.status('InDesign is converting ' + data.name + '…', 0);
    const c = await native.indesignToIdml(data.path).catch((e) => ({ ok: false, reason: String(e.message || e) }));
    UI.status('');
    if (c && c.ok) return openIdml(c.data);
    return UI.alert(`${data.name} could not be opened.\n\n${(c && c.reason) || ''}${c && c.notFound ? '\n\nInstall InDesign on this computer, or ask someone with InDesign to save it as IDML (File > Save As > InDesign Markup) and open the .idml file here.' : ''}`);
  }

  // ================================================================== saving InDesign files
  App.saveToInDesign = async function (target) {
    if (App.sel.kind === 'text') App.leaveText();
    const ext = extOf(target);
    const base = target.replace(/\.[^.\\/]+$/, '');
    const linksDir = (ext === 'idml' ? base : base) + ' Links';
    UI.status('Writing InDesign Markup…', 0);
    let pkg;
    try { pkg = await BV.IDML.fromDoc(doc(), { name: baseName(base), linksDir }); } catch (e) { UI.status(''); UI.alert('Could not make the InDesign file: ' + e.message); return null; }
    if (ext === 'idml') {
      await native.idmlWrite({ filePath: target, files: pkg.files, images: pkg.images });
      App.filePath = target;
      App.docName = baseName(base);
      App.setDirty(false);
      UI.status(`Saved ${baseName(target)}${Object.keys(pkg.images).length ? ` and its pictures in “${baseName(linksDir)}”` : ''}. It opens in InDesign CS4 and later.`, 9000);
      setTimeout(captureThumb, 300);
      return target;
    }
    UI.status('InDesign is saving ' + baseName(target) + '…', 0);
    const r = await native.indesignSave({ target, files: pkg.files, images: pkg.images }).catch((e) => ({ ok: false, reason: String(e.message || e) }));
    UI.status('');
    if (r && r.ok) {
      App.filePath = target;
      App.docName = baseName(base);
      App.setDirty(false);
      UI.status(`Saved ${baseName(target)} with ${String(r.app || 'InDesign').replace(/^InDesign\.Application\.?/, 'InDesign ')}.`, 9000);
      return target;
    }
    // no InDesign: the IDML copy is there
    App.filePath = r && r.idml ? r.idml : target.replace(/\.[^.]+$/, '.idml');
    App.docName = baseName(base);
    App.setDirty(false);
    UI.alert(`${baseName(target)} needs InDesign to be written, and ${r && r.notFound ? 'InDesign is not installed on this computer' : 'InDesign did not finish: ' + ((r && r.reason) || '')}.\n\nAn IDML copy was saved instead:\n${App.filePath}\n\nOpen it in InDesign CS4 or later and choose File > Save As to make the .${ext} file.`);
    return App.filePath;
  };
  async function exportInDesign(kind) {
    const name = (App.filePath ? baseName(App.filePath) : App.docName || 'Publication').replace(/\.[^.]+$/, '');
    const target = await native.saveAsDialog({ defaultName: name, defaultExt: kind });
    if (!target) return;
    const keep = { filePath: App.filePath, docName: App.docName, dirty: App.dirty };
    const r = await App.saveToInDesign(target);
    // exporting does not change which file the publication is saved to
    if (r) { App.filePath = keep.filePath; App.docName = keep.docName; App.setDirty(keep.dirty); }
  }

  // ================================================================== Convert legacy text in the publication
  async function convertLegacyAll() {
    const L = BV.Legacy;
    const found = new Map();
    for (const st of Object.values(doc().stories)) for (const p of st.paras) {
      const pp = BV.paraProps(doc(), p);
      for (const r of p.runs) {
        if (!r.t) continue;
        const asc = /^([a-z]+)-ascii:(.*)$/.exec(r.legacy || '');
        const font = asc ? asc[2] : BV.charProps(pp, r).font;
        const enc = asc ? asc[1] : L.encodingForFont(font);
        if (!L.convertible(enc)) continue;
        const k = enc + '|' + font;
        const f = found.get(k) || { enc, font, chars: 0, sample: '' };
        f.chars += r.t.length;
        if (f.sample.length < 60) f.sample += r.t;
        found.set(k, f);
      }
    }
    if (!found.size) return UI.alert('This publication has no text in old (ASCII) fonts: Nudi, Baraha, Praja, Chanakya, Walkman-Chanakya or Nalanda.');
    const list = [...found.values()];
    const p = store.get('prefs', {});
    const target = (f) => (f.enc === 'nudi' ? (L.prajaNudiUnicodeFont(f.font) || { font: p.kannadaFont || 'Noto Serif Kannada' }).font : (L.unicodeFontFor(f.font) || { font: 'Noto Serif' }).font);
    const r = await UI.dialog({
      title: 'Convert Legacy Text to Unicode',
      width: 640,
      html: `<p class="note" style="color:var(--ink)">These old fonts are used in this publication. Ticked ones become Unicode text in the font shown; formatting stays as it is.</p>
        <div class="so-table"><table><thead><tr><th></th><th>Font</th><th>Encoding</th><th>Becomes</th><th>Preview</th></tr></thead><tbody>${list.map((f, i) => `<tr><td><input type="checkbox" id="cl-${i}" checked aria-label="Convert ${esc(f.font)}"></td><td><b>${esc(f.font)}</b><div class="so-sub">${f.chars.toLocaleString()} characters</div></td><td>${esc(L.label(f.enc))}</td><td>${esc(target(f))}</td><td><div class="so-line" style="font-family:'${esc(target(f))}'">${esc(L.toUnicode(f.sample.slice(0, 40), f.enc))}</div></td></tr>`).join('')}</tbody></table></div>`,
      buttons: [{ label: 'Convert', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const on = new Set(list.filter((_, i) => UI.checked(r.el, 'cl-' + i)).map((f) => f.enc + '|' + f.font));
    if (!on.size) return;
    App.checkpoint();
    let chars = 0;
    for (const st of Object.values(doc().stories)) {
      let touched = false;
      for (const p of st.paras) {
        const pp = BV.paraProps(doc(), p);
        // runs of the same encoding are converted together, so syllables split by a formatting change stay whole
        for (let i = 0; i < p.runs.length; i++) {
          const r0 = p.runs[i];
          const asc = /^([a-z]+)-ascii:(.*)$/.exec(r0.legacy || '');
          const font = asc ? asc[2] : BV.charProps(pp, r0).font;
          const enc = asc ? asc[1] : L.encodingForFont(font);
          if (!r0.t || !on.has(enc + '|' + font)) continue;
          if (L.isDev(enc) && i + 1 < p.runs.length) {
            const nx = p.runs[i + 1];
            const nf = /^([a-z]+)-ascii:(.*)$/.exec(nx.legacy || '');
            const nEnc = nf ? nf[1] : L.encodingForFont(BV.charProps(pp, nx).font);
            if (nEnc === enc) { let k = 0; while (k < nx.t.length && BV.DevLegacy.continues(enc, nx.t[k])) k++; if (k) { r0.t += nx.t.slice(0, k); nx.t = nx.t.slice(k); } }
          }
          const u = r0.t.split('\r').map((t) => L.toUnicode(t, enc)).join('\r');
          const tf = enc === 'nudi' ? L.prajaNudiUnicodeFont(font) || { font: p.kannadaFont || 'Noto Serif Kannada' } : L.unicodeFontFor(font) || { font: 'Noto Serif' };
          r0.t = u;
          r0.font = tf.font;
          if (tf.bold) r0.bold = true;
          if (tf.italic) r0.italic = true;
          r0.legacy = enc + ':' + font;
          chars += [...u].length;
          touched = true;
        }
        T.normalize(p);
      }
      if (touched) App.markStory(st.id);
    }
    App.changed();
    if (App.ensureFonts) App.ensureFonts(App.docFonts());
    UI.status(`${chars.toLocaleString()} characters are now Unicode.`, 8000);
  }
  App.convertLegacyAll = convertLegacyAll;

  // ================================================================== typographer's quotes
  App.smartQuotes = store.get('smartQuotes', true);
  App.smartGuides = store.get('smartGuides', true);
  const baseInsert = App.insertText;
  App.insertText = function (str, opts) {
    if (App.smartQuotes && (str === '"' || str === "'") && App.sel.kind === 'text') {
      const st = doc().stories[App.sel.sid];
      const [a] = T.order(App.sel.a, App.sel.f);
      const para = st && st.paras[a.p];
      const prev = para ? T.paraText(para)[a.o - 1] : '';
      const open = !prev || /[\s(\[{—–\-“‘/]/.test(prev);
      str = str === '"' ? (open ? '“' : '”') : open ? '‘' : '’';
    }
    return baseInsert.call(this, str, opts);
  };

  // ================================================================== status bar: word count and live preflight
  function buildStatus() {
    const st = $('status');
    if (!st || $('st-wc')) return;
    const wc = document.createElement('span');
    wc.id = 'st-wc'; wc.className = 'st-wc';
    const pf = document.createElement('button');
    pf.id = 'st-pf'; pf.className = 'st-pf'; pf.title = 'Preflight: click for the full report';
    pf.innerHTML = '<i></i><span>Checking</span>';
    pf.addEventListener('click', () => App.command('preflight'));
    const z = $('st-zs') || $('st-zoom');
    z.before(wc);
    z.before(pf);
  }
  const words = (s) => (s.match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu) || []).length;
  let pfTimer = 0;
  function liveCheck() {
    clearTimeout(pfTimer);
    pfTimer = setTimeout(() => {
      const pf = $('st-pf');
      if (!pf || !doc()) return;
      let problems = 0;
      const why = [];
      const have = App.fontSet || new Set(App.fontList || []);
      const missing = (App.docFonts ? App.docFonts() : []).filter((f) => have.size && !have.has(f));
      if (missing.length) { problems += missing.length; why.push(`${missing.length} missing font${missing.length === 1 ? '' : 's'}`); }
      let over = 0;
      for (const s of Object.values(doc().stories)) { try { if (App.layoutFor(s).overflow) over++; } catch (_) {} }
      if (over) { problems += over; why.push(`${over} overset stor${over === 1 ? 'y' : 'ies'}`); }
      const miss = Object.values(doc().items).filter((i) => (i.type === 'image' || i.type === 'frame') && !i.src && i.name).length;
      if (miss) { problems += miss; why.push(`${miss} missing picture${miss === 1 ? '' : 's'}`); }
      pf.classList.toggle('bad', problems > 0);
      pf.querySelector('span').textContent = problems ? `${problems} problem${problems === 1 ? '' : 's'}` : 'No problems';
      pf.title = (problems ? why.join(', ') : 'Fonts, pictures and text all look fine') + '. Click for the full preflight report.';
    }, 900);
  }
  function updateWordCount() {
    const el = $('st-wc');
    if (!el) return;
    if (App.sel.kind === 'text' && doc() && doc().stories[App.sel.sid]) {
      const st = doc().stories[App.sel.sid];
      const [a, b] = T.order(App.sel.a, App.sel.f);
      let sel = 0;
      if (T.cmp(a, b) !== 0) {
        let txt = '';
        for (let p = a.p; p <= b.p; p++) { const t = T.paraText(st.paras[p]); txt += t.slice(p === a.p ? a.o : 0, p === b.p ? b.o : t.length) + ' '; }
        sel = words(txt);
      }
      const all = words(st.paras.map((p) => T.paraText(p)).join(' '));
      el.textContent = sel ? `${sel.toLocaleString()} of ${all.toLocaleString()} words` : `${all.toLocaleString()} words`;
      el.hidden = false;
    } else el.hidden = true;
  }

  // ================================================================== commands
  const prev = App.command2;
  App.command2 = async function (cmd, arg) {
    switch (cmd) {
      case 'tab': return App.switchTab(+arg);
      case 'tabNext': return tabs.length > 1 && App.switchTab((cur + 1) % tabs.length);
      case 'tabPrev': return tabs.length > 1 && App.switchTab((cur - 1 + tabs.length) % tabs.length);
      case 'tabReopen': return reopenTab();
      case 'exportIdml': return exportInDesign('idml');
      case 'exportIndd': return exportInDesign('indd');
      case 'convertLegacyAll': return convertLegacyAll();
      case 'installBvFonts': {
        if (!native.installFontsWindows) return;
        UI.status('Installing the fonts…', 0);
        const r = await native.installFontsWindows().catch((e) => ({ ok: false, errors: [String(e.message || e)] }));
        UI.status('');
        if (r.reason === 'Windows only') return UI.alert('Installing fonts in the system works on Windows.');
        return UI.alert(r.ok ? `${r.count} fonts are installed for you in Windows: Praja Unicode (Regular, Demi, Light), Praja01 to Praja08, BV Chitkala (with Hindi, Hindi Heavy and Math), BV Nanda and BV Matanga.\n\nWord, LibreOffice, PageMaker and other programs show them after they are restarted.` : `Some fonts could not be installed:\n${(r.errors || []).slice(0, 6).join('\n')}\n\nIf a font is in use, close the program that uses it and try again.`);
      }
      case 'smartGuides': App.smartGuides = !App.smartGuides; store.set('smartGuides', App.smartGuides); native.menuState({ smartGuides: App.smartGuides }); return UI.status(App.smartGuides ? 'Smart Guides on: objects line up with other objects and the page centre while you drag.' : 'Smart Guides off.', 5000);
      case 'smartQuotes': App.smartQuotes = !App.smartQuotes; store.set('smartQuotes', App.smartQuotes); native.menuState({ smartQuotes: App.smartQuotes }); return UI.status(App.smartQuotes ? 'Typographer’s quotes on: “ ” and ‘ ’ as you type.' : 'Straight quotes.', 5000);
    }
    return prev ? prev.apply(this, arguments) : undefined;
  };
  // Close, Save and Quit work per tab
  const baseCommand = App.command;
  App.command = async function (cmd, arg) {
    if (cmd === 'close' && $('story-editor').hidden) return closeTab(cur);
    if (cmd === 'saveAndQuit' && tabs.length > 1) return saveAllAndQuit();
    const r = await baseCommand.apply(this, arguments);
    if (cmd === 'save' || cmd === 'saveAs') setTimeout(captureThumb, 400);
    return r;
  };
  // ================================================================== start
  function init() {
    if (!$('status') || !$('main') || !App.doc) return setTimeout(init, 40);
    if (!tabs.length) { tabs.push({ key: keySeq++ }); cur = 0; }
    renderTabs();
    buildStatus();
    if (window.native && native.menuState) native.menuState({ smartGuides: App.smartGuides, smartQuotes: App.smartQuotes });
    const wrap = (name, after) => { const f = App[name]; if (typeof f !== 'function') return; App[name] = function () { const r = f.apply(this, arguments); try { after(); } catch (_) {} return r; }; };
    wrap('renderNow', () => { updateWordCount(); liveCheck(); renderTabsSoon(); });
    liveCheck();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
