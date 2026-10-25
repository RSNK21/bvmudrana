/* BV Mudrana: interface modes and themes.
   Modes: PageMaker (the classic layout), Advanced (everything visible, compact), Word style (a tabbed ribbon)
   and Basic (a few big labelled buttons). Themes: Studio Dark, Paper Light, Material You (light and dark,
   coloured from one seed colour), Classic PageMaker 7, Modern Expressive and Generic. */
(function () {
  const App = window.App, BV = window.BV;
  const UI = BV.UI;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => BV.Render.esc(String(s == null ? '' : s));
  const store = App.store;
  const root = document.documentElement;

  // ================================================================== definitions
  const THEMES = [
    { id: 'dark', name: 'Studio Dark', note: 'Calm dark studio with saffron accents. Easy on the eyes for long sessions.', p: { chrome: '#17181c', bar: '#1c1d22', board: '#2a2a2f', accent: '#f28a2e', ink: '#ece7de', pal: '#24252b', r: 6 } },
    { id: 'light', name: 'Paper Light', note: 'Warm paper tones for daylight work.', p: { chrome: '#efeae2', bar: '#f6f2ec', board: '#cfc9c0', accent: '#d9661c', ink: '#2a2520', pal: '#ffffff', r: 6 } },
    { id: 'material', name: 'Material You', note: 'Pixel style. Soft tonal colours made from one seed colour, big rounded shapes.', seed: true, p: { chrome: '#f6eee8', bar: '#fbf5f1', board: '#e6d9cf', accent: '#9a4a12', ink: '#2a211b', pal: '#ffe1cc', r: 14 } },
    { id: 'materialDark', name: 'Material You Dark', note: 'The Pixel look at night, with the same seed colour.', seed: true, p: { chrome: '#211a16', bar: '#2b231e', board: '#18120f', accent: '#ffb68a', ink: '#f1dfd5', pal: '#5a3a24', r: 14 } },
    { id: 'classic', name: 'Classic PageMaker 7', note: 'The grey Windows 2000 look with navy title bars, just as PageMaker 7 looked.', p: { chrome: '#d4d0c8', bar: '#d4d0c8', board: '#ffffff', accent: '#0a246a', ink: '#000000', pal: '#d4d0c8', r: 0, title: 'linear-gradient(90deg,#0a246a,#a6caf0)' } },
    { id: 'expressive', name: 'Modern Expressive', note: 'Bold colour, glass panels and lively motion.', p: { chrome: '#120c1e', bar: 'rgba(40,28,66,.8)', board: '#0b0814', accent: 'linear-gradient(135deg,#ffb347,#ff6a3d 45%,#e94dff)', ink: '#f6f0ff', pal: '#271e40', r: 12, title: 'radial-gradient(120% 140% at 0% 0%,#4b1f63,#120c1e 60%)' } },
    { id: 'generic', name: 'Generic', note: 'A plain, neutral Windows look that stays out of the way.', p: { chrome: '#f3f3f3', bar: '#f9f9f9', board: '#e6e6e6', accent: '#005fb8', ink: '#1b1b1b', pal: '#ffffff', r: 4 } },
  ];
  const SEEDS = [['Saffron', 48], ['Rose', 10], ['Violet', 305], ['Blue', 255], ['Teal', 195], ['Green', 145], ['Gold', 85]];
  const MODES = [
    { id: 'pagemaker', name: 'PageMaker', note: 'The PageMaker 7 layout you know: toolbox, control palette, styles and colours palettes.', good: 'Everyday typesetting' },
    { id: 'advanced', name: 'Advanced', note: 'Everything at once: every palette, the pages panel and align palette, tighter spacing.', good: 'Big books and power users' },
    { id: 'word', name: 'Word style', note: 'A tabbed ribbon like Microsoft Word: Home, Insert, Layout, Language, Review, View.', good: 'People who know Word' },
    { id: 'basic', name: 'Basic', note: 'A few big, clearly labelled buttons. Nothing else gets in the way.', good: 'First-time users' },
  ];
  App.THEMES = THEMES; App.MODES = MODES;

  // ================================================================== icons (20 x 20, drawn with the stroke)
  const P = {
    paste: '<rect x="4" y="4" width="12" height="13.5" rx="1"/><path d="M7.5 4V2.5h5V4M7 9h6M7 12h6M7 15h4"/>',
    dup: '<rect x="2.5" y="2.5" width="10" height="10" rx="1"/><rect x="7.5" y="7.5" width="10" height="10" rx="1"/>',
    replace: '<path d="M3 6h9l-2.5-2.5M17 14H8l2.5 2.5"/>',
    selall: '<rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="2.2 2"/><path d="M6.5 10l2.5 2.5 4.5-5"/>',
    sizeup: '<path d="M2.5 16L6.5 5l4 11M4 12h5"/><path d="M14.5 4v6M11.5 7h6"/>',
    sizedown: '<path d="M2.5 16L6.5 5l4 11M4 12h5"/><path d="M11.5 7h6"/>',
    case: '<path d="M2 15L5.5 5 9 15M3.2 12h4.6"/><path d="M12 9.5a2.5 2.5 0 015 0V15M17 12.2c-1-.6-5-.8-5 1.2 0 2 3.5 1.8 5 0"/>',
    smallcaps: '<path d="M3 15V5h5M3 10h4"/><path d="M11 15V9h4M11 12h3"/>',
    bullets: '<circle cx="4" cy="5" r="1.2" fill="currentColor"/><circle cx="4" cy="10" r="1.2" fill="currentColor"/><circle cx="4" cy="15" r="1.2" fill="currentColor"/><path d="M8 5h9M8 10h9M8 15h9"/>',
    indent: '<path d="M3 4h14M9 8h8M9 12h8M3 16h14M3 7.5l3 2.5-3 2.5"/>',
    rules: '<path d="M3 4h14M3 16h14"/><path d="M5 8h10M5 12h7"/>',
    hyph: '<path d="M3 6h6M3 10h9M3 14h6M12 14h5"/><path d="M14 6h3"/>',
    dropcap: '<path d="M3 13V4h3.5a4.5 4.5 0 010 9z"/><path d="M12 5h5M12 9h5M3 16h14"/>',
    story: '<rect x="3" y="2.5" width="14" height="15" rx="1.5"/><path d="M6 6h8M6 9h8M6 12h5"/>',
    sample: '<path d="M3 5h14M3 9h14M3 13h9"/><path d="M14 13l1.5 3 1.5-3"/>',
    footnote: '<path d="M3 4h11M3 8h11"/><path d="M3 14h7M3 17h5"/><path d="M15.5 9.5V3.5l-1.5 1"/><path d="M3 11.5h14" stroke-dasharray="1.5 1.5"/>',
    glyph: '<path d="M4 16L10 3l6 13M6.5 11h7"/><path d="M8 1.5l2 1.2 2-1.2"/>',
    pagenum: '<path d="M4 2.5h8l3.5 3.5v11.5H4z"/><text x="9.8" y="15" text-anchor="middle" style="font:700 7.5px Segoe UI,sans-serif" fill="currentColor" stroke="none">#</text>',
    table: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M2.5 8h15M2.5 12.5h15M7.5 3.5v13M12.5 3.5v13"/>',
    barcode: '<path d="M3 4v12M5.5 4v12M7 4v12M10 4v12M12 4v12M13.5 4v12M16.5 4v12"/>',
    frame: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 4l14 12M17 4L3 16"/>',
    links: '<path d="M8.5 11.5a3 3 0 004.2 0l2.6-2.6a3 3 0 00-4.2-4.2l-1 1"/><path d="M11.5 8.5a3 3 0 00-4.2 0l-2.6 2.6a3 3 0 004.2 4.2l1-1"/>',
    setup: '<path d="M4 2.5h12v15H4z"/><path d="M6.5 5.5h7v9h-7z" stroke-dasharray="1.6 1.4"/>',
    columns: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 3v14"/><path d="M5 6h3M5 9h3M12 6h3M12 9h3"/>',
    sections: '<path d="M4 2.5h12v15H4z"/><text x="10" y="13.5" text-anchor="middle" style="font:700 7px Georgia,serif" fill="currentColor" stroke="none">iv</text>',
    master: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M6 13V7l4 3.5L14 7v6"/>',
    front: '<rect x="2.5" y="2.5" width="9" height="9" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="8.5" y="8.5" width="9" height="9" rx="1"/>',
    back: '<rect x="2.5" y="2.5" width="9" height="9" rx="1"/><rect x="8.5" y="8.5" width="9" height="9" rx="1" fill="currentColor" fill-opacity=".25"/>',
    ungroup: '<rect x="2.5" y="2.5" width="7" height="7" rx="1"/><rect x="10.5" y="10.5" width="7" height="7" rx="1"/>',
    heads: '<path d="M4 2.5h12v15H4z"/><path d="M6.5 5h7M6.5 15h7"/><path d="M6.5 8.5h7M6.5 11h5" stroke-opacity=".45"/>',
    balance: '<path d="M3.5 4h5M3.5 7h5M3.5 10h5M11.5 4h5M11.5 7h5M11.5 10h5"/><path d="M3 14h14"/>',
    booklet: '<path d="M10 4.5C8 3 5 3 2.5 3.5v12c2.5-.5 5.5-.5 7.5 1 2-1.5 5-1.5 7.5-1v-12C15 3 12 3 10 4.5zM10 4.5v12"/>',
    book: '<path d="M4 3h9.5a2 2 0 012 2v12H6a2 2 0 01-2-2z"/><path d="M4 15a2 2 0 012-2h9.5"/>',
    toc: '<path d="M3 5h9M3 10h9M3 15h9"/><path d="M14.5 5h2.5M14.5 10h2.5M14.5 15h2.5"/>',
    index: '<path d="M4 3h12v14H4z"/><path d="M7 7h6M7 10h6M7 13h3"/><path d="M16 5h1.5M16 9h1.5"/>',
    keyboard: '<rect x="2" y="5" width="16" height="10" rx="1.5"/><path d="M5 8h1M8 8h1M11 8h1M14 8h1M5 11h1M14 11h1M8 11h4"/>',
    translit: '<path d="M2.5 5h7M6 3.5v1.5M4 5c.3 3 2.5 5 5 6M9 5c-.5 3-3 6-6 7"/><path d="M11 16l3-8 3 8M12 13.5h4"/>',
    convert: '<path d="M3 7h12l-3-3M17 13H5l3 3"/>',
    clean: '<path d="M12.5 3l4.5 4.5-8 8H4.5v-4.5z"/><path d="M10 5.5l4.5 4.5"/>',
    spell: '<path d="M3 13L6.5 4 10 13M4.2 10h4.6"/><path d="M10.5 14.5l2.5 2.5 4.5-6"/>',
    count: '<path d="M4 7h12M4 13h12M8 3l-1.5 14M13.5 3L12 17"/>',
    preflight: '<path d="M10 2.5l6.5 3v4.5c0 4-3 6.5-6.5 7.5-3.5-1-6.5-3.5-6.5-7.5V5.5z"/><path d="M7 10l2 2 4-4.5"/>',
    info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v.3"/>',
    zoomin: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3L17 17M6.3 8.5h4.4M8.5 6.3v4.4"/>',
    zoomout: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3L17 17M6.3 8.5h4.4"/>',
    width: '<rect x="4" y="3" width="12" height="14" rx="1"/><path d="M1.5 10h4M18.5 10h-4M3 8.5L1.5 10 3 11.5M17 8.5l1.5 1.5-1.5 1.5"/>',
    ruler: '<rect x="2" y="6" width="16" height="8" rx="1"/><path d="M5 6v3M8 6v2M11 6v3M14 6v2"/>',
    guides: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 7.5h14M12 3v14" stroke-dasharray="2 1.6"/>',
    grid: '<path d="M3 5h14M3 8.5h14M3 12h14M3 15.5h14" stroke-opacity=".7"/>',
    preview: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
    palette: '<rect x="2.5" y="3" width="15" height="14" rx="1.5"/><path d="M12 3v14"/><path d="M13.8 6.5h2M13.8 9h2"/>',
    mode: '<rect x="2.5" y="3" width="15" height="14" rx="1.5"/><path d="M2.5 7h15M6.5 7v10"/>',
    help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.7 7.8a2.4 2.4 0 114 1.8c-.9.6-1.7 1.1-1.7 2.4M10 14.4v.3"/>',
    menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
    textbox: '<rect x="3" y="3.5" width="14" height="13" rx="1" stroke-dasharray="2.2 1.8"/><path d="M7 7h6M10 7v7"/>',
    picture: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M2.5 13.5l4-4 3 3 3-3 5 5"/><circle cx="13" cy="7.5" r="1.4"/>',
    shape: '<rect x="2.5" y="8" width="8" height="8" rx="1"/><circle cx="13" cy="7" r="4.5"/>',
    bold: '<path d="M6 4h5a3 3 0 010 6H6zM6 10h6a3 3 0 010 6H6z" stroke-width="2"/>',
    italic: '<path d="M9 4h6M5 16h6M12 4L8 16"/>',
    underline: '<path d="M6 3.5v6a4 4 0 008 0v-6M4.5 17h11"/>',
    strike: '<path d="M3 10h14M13.5 6c-.5-1.5-2-2.5-3.7-2.5-2.2 0-3.8 1.2-3.8 2.8M6.5 14c.6 1.5 2 2.5 3.7 2.5 2.3 0 3.8-1.2 3.8-3"/>',
    sup: '<path d="M3 16l6-8M3 8l6 8"/><path d="M12.5 4.5a1.6 1.6 0 113 .8L12.5 8.5h3.5"/>',
    sub: '<path d="M3 13l6-8M3 5l6 8"/><path d="M12.5 12.5a1.6 1.6 0 113 .8l-3 3.2h3.5"/>',
    caps: '<text x="10" y="13.5" text-anchor="middle" style="font:700 8px Segoe UI,sans-serif" fill="currentColor" stroke="none">AB</text>',
    alignLeft: '<path d="M3 4h14M3 8h9M3 12h14M3 16h9"/>',
    alignCenter: '<path d="M3 4h14M5.5 8h9M3 12h14M5.5 16h9"/>',
    alignRight: '<path d="M3 4h14M8 8h9M3 12h14M8 16h9"/>',
    alignJustify: '<path d="M3 4h14M3 8h14M3 12h14M3 16h8"/>',
    alignForce: '<path d="M3 4h14M3 8h14M3 12h14M3 16h14"/>',
    lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.2"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',
    brush: '<path d="M13.5 2.5l4 4-6 6-4-4z"/><path d="M7.5 8.5L5 11c-1.5 1.5-1 3-2.5 5.5C5 16 6.5 16 8 14.5l2.5-2.5"/>',
    watermark: '<path d="M4 2.5h12v15H4z"/><text x="10" y="13" text-anchor="middle" transform="rotate(-35 10 10)" style="font:700 6px Segoe UI,sans-serif" fill="currentColor" stroke="none" opacity=".7">DRAFT</text>',
    speaker: '<path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13 7.5a3.5 3.5 0 010 5M15 5a7 7 0 010 10"/>',
    note: '<path d="M3.5 3.5h13v9l-4 4h-9z"/><path d="M12.5 16.5v-4h4M6.5 7.5h7M6.5 10.5h4"/>',
    thread: '<rect x="2.5" y="3" width="6" height="8" rx="1"/><rect x="11.5" y="9" width="6" height="8" rx="1"/><path d="M8.5 11c2 0 1 -2 3 -2" stroke-dasharray="1.5 1.2"/>',
    fitframe: '<rect x="4" y="3" width="12" height="14" rx="1" stroke-dasharray="2 1.6"/><path d="M7 7h6M7 10h6M7 13h3"/>',
    reflow: '<path d="M3 3.5h6v10H3zM11 6.5h6v10h-6z"/><path d="M9 13.5c1.5 0 1-6 2-7"/><path d="M10 5.5l1 1 1-1"/>',
    field: '<rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M6 8v4M6 8h2.5M6 10h2M11 8h3M12.5 8v4"/>',
    fontfind: '<path d="M2.5 15L6 5l3.5 10M3.7 12h4.6"/><circle cx="13.5" cy="10.5" r="3"/><path d="M15.7 12.7L18 15"/>',
    special: '<text x="10" y="15" text-anchor="middle" style="font:600 13px Segoe UI,sans-serif" fill="currentColor" stroke="none">।</text><text x="5" y="9" style="font:600 7px Segoe UI,sans-serif" fill="currentColor" stroke="none">₹</text><text x="13" y="9" style="font:600 7px Segoe UI,sans-serif" fill="currentColor" stroke="none">©</text>',
  };
  function icon(k) {
    if (P[k]) return `<svg viewBox="0 0 20 20" aria-hidden="true">${P[k]}</svg>`;
    if (App.ICON && App.ICON[k]) return App.ICON[k];
    return App.tbIcon(k);
  }

  // ================================================================== themes
  function toHex(css) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 1;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillStyle = css; x.fillRect(0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    } catch (_) { return '#17181c'; }
  }
  App.seedHue = store.get('seedHue', 48);
  function applySeed() { root.style.setProperty('--seed', String(App.seedHue)); }
  App.setSeed = function (h) {
    App.seedHue = Math.round(((+h % 360) + 360) % 360);
    store.set('seedHue', App.seedHue);
    applySeed();
    syncChrome();
    if (App.doc) App.render();
  };
  function syncChrome() {
    requestAnimationFrame(() => {
      const tb = $('titlebar');
      if (!tb || !window.native || !native.chromeTheme) return;
      const cs = getComputedStyle(tb);
      const rs = getComputedStyle(root);
      const sym = rs.getPropertyValue('--wc-symbol').trim() || cs.color;
      native.chromeTheme({ color: toHex(cs.backgroundColor), symbolColor: toHex(sym), bg: toHex(rs.getPropertyValue('--chrome').trim() || '#17181c'), height: 36 });
    });
  }
  App.setTheme = function (t) {
    if (!THEMES.some((x) => x.id === t)) t = 'dark';
    root.dataset.theme = t;
    App.theme = t;
    store.set('theme', t);
    applySeed();
    syncChrome();
    if (window.native) native.menuState(Object.fromEntries(THEMES.map((x) => ['theme_' + x.id, x.id === t])));
    if (App.doc && App.render) App.render();
    refreshAppearance();
  };
  // the light / dark switch some older code paths use
  App.isDarkTheme = () => ['dark', 'materialDark', 'expressive'].includes(App.theme);

  // ================================================================== modes
  const PALETTES = ['pal-tools', 'pal-control', 'pal-sc', 'pal-lm', 'pal-pages', 'pal-align'];
  const LAYOUT = {
    pagemaker: { 'pal-tools': 1, 'pal-control': 1, 'pal-sc': 1, 'pal-lm': 1, 'pal-pages': 0, 'pal-align': 0, rulers: 1 },
    advanced: { 'pal-tools': 1, 'pal-control': 1, 'pal-sc': 1, 'pal-lm': 1, 'pal-pages': 1, 'pal-align': 1, rulers: 1 },
    word: { 'pal-tools': 0, 'pal-control': 0, 'pal-sc': 0, 'pal-lm': 0, 'pal-pages': 0, 'pal-align': 0, rulers: 1 },
    basic: { 'pal-tools': 0, 'pal-control': 0, 'pal-sc': 0, 'pal-lm': 0, 'pal-pages': 0, 'pal-align': 0, rulers: 0 },
  };
  function setRulers(on) {
    App.showRulers = !!on;
    document.body.classList.toggle('hide-rulers', !on);
    if (window.native) native.menuState({ rulers: !!on });
  }
  App.setMode = function (m, initial) {
    if (!LAYOUT[m]) m = 'pagemaker';
    const before = App.mode;
    App.mode = m;
    store.set('mode', m);
    MODES.forEach((x) => document.body.classList.toggle('mode-' + x.id, x.id === m));
    const L = LAYOUT[m];
    // on start-up PageMaker and Advanced keep the palettes where the user left them
    if (!initial || m === 'word' || m === 'basic') {
      for (const id of PALETTES) { const el = $(id); if (el && el.hidden === !!L[id]) App.showPanel(id, !!L[id]); }
      if (!initial || !L.rulers) setRulers(L.rulers);
    }
    if (window.native) native.menuState(Object.fromEntries(MODES.map((x) => ['mode_' + x.id, x.id === m])));
    const chip = $('st-mode');
    if (chip) chip.textContent = MODES.find((x) => x.id === m).name;
    App.closeMenus && App.closeMenus();
    if (m === 'word') selectTab(store.get('ribbonTab', 'Home'));
    syncBars();
    if (App.doc) {
      requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); App.render(); if (before && before !== m && App.view && App.view.fit) App.command('zoom:fit'); });
    }
    refreshAppearance();
    if (!initial && before && before !== m) UI.status(`${MODES.find((x) => x.id === m).name} mode. Change it any time from Window > Interface Mode or the chip at the bottom right.`, 6000);
  };

  // ================================================================== ribbon (Word style)
  const sm = (i, label, cmd, title) => ({ i, label, cmd, title });
  const big = (i, label, cmd, title) => ({ big: true, i, label, cmd, title });
  const tool = (i, label, t, title) => ({ i, label, tool: t, title });
  const RIBBON = {
    Home: [
      { g: 'Clipboard', items: [big('paste', 'Paste', 'paste', 'Paste (Ctrl+V)'), { col: [sm('cut', 'Cut', 'cut', 'Cut (Ctrl+X)'), sm('copy', 'Copy', 'copy', 'Copy (Ctrl+C)'), sm('brush', 'Format Painter', 'formatBrush', 'Copy the formatting here, then select the text to paint')] }] },
      { g: 'Font', launch: 'typeSpecs', custom: 'font' },
      { g: 'Paragraph', launch: 'paraSpecs', custom: 'para' },
      { g: 'Styles', launch: 'defineStyles', custom: 'styles' },
      { g: 'Editing', items: [{ col: [sm('find', 'Find', 'findChange', 'Find (Ctrl+F)'), sm('replace', 'Replace', 'findChange', 'Change (Ctrl+H)'), sm('selall', 'Select All', 'selectAll', 'Select all (Ctrl+A)')] }] },
    ],
    Insert: [
      { g: 'Pages', items: [big('pages', 'Insert Pages', 'insertPages'), { col: [sm('trash', 'Remove Pages', 'removePages'), sm('sections', 'Go to Page', 'gotoPage'), sm('master', 'Sort Pages', 'sortPages')] }] },
      { g: 'Text', items: [{ big: true, i: 'textbox', label: 'Text Box', tool: 'text', title: 'Text tool: click in a column, or drag to draw a text box' }, { col: [sm('story', 'Story Editor', 'editStory', 'Story editor (Ctrl+E)'), sm('sample', 'Sample Text', 'sampleText'), sm('footnote', 'Footnote', 'footnote', 'Insert footnote (Ctrl+Alt+Shift+N)')] }] },
      { g: 'Pictures', items: [big('picture', 'Place', 'place', 'Place a picture or text file (Ctrl+D)'), { col: [tool('frame', 'Frame', 'rframe', 'Rectangle frame tool'), sm('links', 'Links', 'linksManager'), sm('fit', 'Fit to Frame', 'fitContentProp')] }] },
      { g: 'Shapes', items: [{ grid: [tool('line', '', 'line', 'Line'), tool('rect', '', 'rect', 'Rectangle'), tool('ellipse', '', 'ellipse', 'Ellipse'), tool('polygon', '', 'polygon', 'Polygon'), tool('cline', '', 'cline', 'Constrained line'), tool('rframe', '', 'rframe', 'Rectangle frame'), tool('eframe', '', 'eframe', 'Ellipse frame'), tool('pframe', '', 'pframe', 'Polygon frame')] }] },
      { g: 'Symbols', items: [big('special', 'Special Character', 'specialChars', 'Danda, avagraha, Om, ZWNJ, rupee, quotes, spaces…'), { col: [sm('glyph', 'Glyph', 'showGlyphs', 'Insert glyph'), sm('caps', 'IAST Letters', 'iastPalette', 'IAST characters (Ctrl+Alt+I)'), sm('pagenum', 'Page Number', 'pageMarker', 'Page number marker (Ctrl+Alt+P)')] }, { col: [sm('field', 'Date', 'field:date', 'Insert today\'s date'), sm('field', 'Your Name', 'field:userName'), sm('note', 'Sticky Note', 'stickyNote', 'A note that never prints')] }] },
      { g: 'Extras', items: [big('table', 'Table', 'insertTable'), { col: [sm('dropcap', 'Drop Cap', 'dropCap'), sm('barcode', 'ISBN Barcode', 'barcode'), sm('bullets', 'Bullets', 'bullets')] }] },
    ],
    Layout: [
      { g: 'Page Setup', items: [big('setup', 'Document Setup', 'docSetup', 'Page size, margins and sides (Ctrl+Shift+P)'), { col: [sm('columns', 'Columns', 'columnGuides'), sm('sections', 'Numbering', 'sections', 'Numbering and sections'), sm('heads', 'Headers', 'runningHeads', 'Running headers and footers')] }] },
      { g: 'Flow', items: [big('reflow', 'Reflow Overset', 'reflowOverset', 'Add pages until every story fits'), { col: [sm('reflow', 'Smart Reflow', 'smartReflow', 'Add pages at the end while typing'), sm('fitframe', 'Fit Frame to Text', 'fitFrameText', 'Ctrl+Alt+C'), sm('thread', 'Text Threads', 'showThreads', 'Show the links between threaded text blocks')] }] },
      { g: 'Background', items: [big('watermark', 'Watermark and Border', 'pageDecor', 'A watermark behind every page, and a page border')] },
      { g: 'Master Pages', items: [big('master', 'Apply Master', 'applyMaster'), { col: [sm('plus', 'New Master', 'newMaster'), sm('tomaster', 'Page as Master', 'savePageAsMaster'), sm('edit', 'Edit Masters', 'gotoMasters')] }] },
      { g: 'Arrange', items: [{ col: [sm('front', 'Bring to Front', 'front'), sm('back', 'Send to Back', 'back'), sm('lock', 'Lock', 'lock')] }, { col: [sm('group', 'Group', 'group'), sm('ungroup', 'Ungroup', 'ungroup'), sm('align', 'Align', 'alignObjects')] }, big('wrap', 'Text Wrap', 'textWrap')] },
      { g: 'Book', items: [{ col: [sm('balance', 'Balance Columns', 'balanceColumns'), sm('booklet', 'Build Booklet', 'buildBooklet'), sm('book', 'Book List', 'book')] }, { col: [sm('toc', 'Contents', 'createToc'), sm('index', 'Index', 'createIndex'), sm('pages', 'Continuation', 'continuation')] }] },
    ],
    Language: [
      { g: 'Keyboard', custom: 'kbd' },
      { g: 'Transliterate', items: [{ col: [sm('translit', 'To Devanagari', 'tr:deva', 'Ctrl+Alt+1'), sm('translit', 'To Kannada', 'tr:knda', 'Ctrl+Alt+2'), sm('translit', 'To IAST', 'tr:iast', 'Ctrl+Alt+3')] }, big('dup', 'Duplicate as Script', 'dupTranslit', 'Make a transliterated copy of the story')] },
      { g: 'Nudi and Baraha', items: [big('convert', 'Nudi to Unicode', 'convertNudi', 'Kannada ASCII (Nudi or Baraha) to Unicode'), big('convert', 'Unicode to Nudi', 'convertToNudi', 'Kannada Unicode to ASCII (Nudi or Baraha)')] },
      { g: 'Praja', items: [big('convert', 'Praja to Unicode', 'convertPraja', 'Text in Praja fonts to Unicode, in Praja Unicode or another font'), { col: [sm('convert', 'Unicode to Praja', 'convertToPraja'), sm('book', 'Convert a Document', 'legacyFile', 'Convert a Word, RTF or text file typed in Praja or Nudi fonts'), sm('caps', 'Praja Fonts', 'prajaFonts', 'Install the Praja fonts (Praja Unicode and Praja01 to Praja08)')] }] },
      { g: 'Tidy', items: [big('clean', 'Clean Up Text', 'cleanUp'), { col: [sm('glyph', 'Glyphs', 'showGlyphs'), sm('caps', 'IAST Letters', 'iastPalette'), sm('case', 'Change Case', 'changeCase')] }] },
    ],
    Review: [
      { g: 'Proofing', items: [big('spell', 'Spelling', 'spelling'), { col: [sm('count', 'Word Count', 'wordCount'), sm('find', 'Find and Change', 'findChange'), sm('fontfind', 'Find Font', 'findFont')] }, big('speaker', 'Read Aloud', 'readAloud', 'Read the selected text or story aloud (again to stop)')] },
      { g: 'Checks', items: [big('preflight', 'Preflight', 'preflight', 'Check fonts, pictures and overset text before printing'), { col: [sm('info', 'Document Info', 'docInfo'), sm('links', 'Links', 'linksManager'), sm('index', 'Index Entry', 'indexEntry')] }] },
      { g: 'Output', items: [big('pdf', 'Export PDF', 'exportPdf'), { col: [sm('print', 'Print', 'print'), sm('save', 'Save As PageMaker', 'saveAs'), sm('booklet', 'Package', 'packageFiles')] }] },
    ],
    View: [
      { g: 'Zoom', items: [big('fit', 'Fit Page', 'zoom:fit'), { col: [sm('actual', '100%', 'zoom:1'), sm('width', 'Page Width', 'zoom:width'), sm('zoomin', 'Zoom In', 'zoom:in')] }, { col: [sm('zoomout', 'Zoom Out', 'zoom:out'), sm('fit', 'Pasteboard', 'zoom:pasteboard'), sm('find', 'Selection', 'zoom:selection')] }] },
      { g: 'Show', items: [{ col: [sm('ruler', 'Rulers', 'toggleRulers'), sm('guides', 'Guides', 'toggleGuides'), sm('grid', 'Baseline Grid', 'toggleBaseline')] }, big('preview', 'Preview', 'preview', 'Hide guides and frame edges (Ctrl+Alt+Shift+W)')] },
      { g: 'Palettes', items: [{ col: [sm('tools', 'Tools', 'showTools'), sm('control', 'Control', 'showControl'), sm('styles', 'Styles', 'showStyles')] }, { col: [sm('colors', 'Colours', 'showColors'), sm('layers', 'Layers', 'showLayers'), sm('pages', 'Pages', 'showPages')] }] },
      { g: 'Workspace', items: [big('mode', 'Mode and Theme', 'appearance', 'Choose the interface mode and theme')] },
    ],
  };
  const TABS = Object.keys(RIBBON);

  function btnHTML(b) {
    const data = b.tool ? `data-tool="${b.tool}"` : `data-cmd="${esc(b.cmd)}"`;
    const t = esc(b.title || b.label);
    if (b.big) return `<button class="rb-big" ${data} title="${t}">${icon(b.i)}<span>${esc(b.label)}</span></button>`;
    if (!b.label) return `<button class="rb-ic" ${data} title="${t}" aria-label="${t}">${icon(b.i)}</button>`;
    return `<button class="rb-sm" ${data} title="${t}">${icon(b.i)}<span>${esc(b.label)}</span></button>`;
  }
  const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72];
  function customHTML(kind) {
    if (kind === 'font') return `<div class="rb-rows">
        <div class="rb-row"><div class="fontbox rb-font"><input id="rb-font" spellcheck="false" autocomplete="off" aria-label="Font" data-sync="cc-font"><button class="fdrop" tabindex="-1" data-fontfor="rb-font">▾</button></div>
        <input id="rb-size" class="rb-num" list="dl-sizes" aria-label="Size" title="Size" data-sync="cc-size">
        <button class="rb-ic" data-cmd="sizeUp" title="Larger (Ctrl+Shift+.)">${icon('sizeup')}</button><button class="rb-ic" data-cmd="sizeDown" title="Smaller (Ctrl+Shift+,)">${icon('sizedown')}</button></div>
        <div class="rb-row"><span class="rb-seg">${[['bold', 'Bold (Ctrl+Shift+B)'], ['italic', 'Italic (Ctrl+Shift+I)'], ['underline', 'Underline (Ctrl+Shift+U)'], ['strike', 'Strikethru']].map(([k, t]) => `<button class="rb-ic" data-cmd="${k}" title="${t}">${icon(k)}</button>`).join('')}</span>
        <span class="rb-seg"><button class="rb-ic" data-cmd="superscript" title="Superscript">${icon('sup')}</button><button class="rb-ic" data-cmd="subscript" title="Subscript">${icon('sub')}</button></span>
        <span class="rb-seg"><button class="rb-ic" data-cmd="caps" title="All caps (Ctrl+Shift+K)">${icon('caps')}</button><button class="rb-ic" data-cmd="smallCaps" title="Small caps (Ctrl+Shift+H)">${icon('smallcaps')}</button><button class="rb-ic" data-cmd="changeCase" title="Change case">${icon('case')}</button></span></div></div>`;
    if (kind === 'para') return `<div class="rb-rows">
        <div class="rb-row"><span class="rb-seg"><button class="rb-ic" data-cmd="bullets" title="Bullets and numbering">${icon('bullets')}</button><button class="rb-ic" data-cmd="indentsTabs" title="Indents and tabs (Ctrl+I)">${icon('indent')}</button><button class="rb-ic" data-cmd="dropCap" title="Drop cap">${icon('dropcap')}</button></span>
        <label class="rb-lbl" title="Leading (line spacing) in points">Leading<input id="rb-lead" class="rb-num" list="dl-leads" data-sync="cc-lead"></label></div>
        <div class="rb-row"><span class="rb-seg">${['Left', 'Center', 'Right', 'Justify', 'Force'].map((a) => `<button class="rb-ic" data-cmd="align${a}" title="${a === 'Force' ? 'Force justify' : a === 'Justify' ? 'Justify' : 'Align ' + a.toLowerCase()}">${icon('align' + a)}</button>`).join('')}</span>
        <span class="rb-seg"><button class="rb-ic" data-cmd="paraRules" title="Paragraph rules">${icon('rules')}</button><button class="rb-ic" data-cmd="hyphenation" title="Hyphenation">${icon('hyph')}</button></span></div></div>`;
    if (kind === 'styles') return `<div class="rb-gallery" id="rb-gallery"></div>`;
    if (kind === 'kbd') return `<div class="rb-kbds">${[['off', 'EN', 'English'], ['kgp', 'ಕ', 'Kannada KGP'], ['knPh', 'ಕ ka', 'Kannada phonetic'], ['saPh', 'क ka', 'Devanagari'], ['iastPh', 'ā', 'IAST']].map(([k, g, l]) => `<button class="rb-big rb-kbd" data-kbd="${k}" title="${esc(l)} keyboard"><b>${g}</b><span>${esc(l)}</span></button>`).join('')}</div>`;
    return '';
  }
  function groupHTML(gr) {
    const body = gr.custom ? customHTML(gr.custom) : gr.items.map((it) => {
      if (it.col) return `<div class="rb-col">${it.col.map(btnHTML).join('')}</div>`;
      if (it.grid) return `<div class="rb-grid">${it.grid.map(btnHTML).join('')}</div>`;
      return btnHTML(it);
    }).join('');
    const launch = gr.launch ? `<button class="rb-launch" data-cmd="${gr.launch}" title="More ${esc(gr.g.toLowerCase())} settings">${icon('down').replace('viewBox="0 0 20 20"', 'viewBox="0 0 20 20" style="transform:rotate(-45deg)"')}</button>` : '';
    return `<div class="rb-group" data-g="${esc(gr.g)}"><div class="rb-body">${body}</div><div class="rb-label"><span>${esc(gr.g)}</span>${launch}</div></div>`;
  }
  function buildRibbon() {
    const app = $('app'), tbEl = $('toolbar');
    if (!app || $('ribbon')) return;
    const r = document.createElement('div');
    r.id = 'ribbon';
    r.setAttribute('role', 'toolbar');
    r.setAttribute('aria-label', 'Ribbon');
    r.innerHTML = TABS.map((t) => `<div class="rb-panel" data-tab="${t}" role="tabpanel" hidden>${RIBBON[t].map(groupHTML).join('<span class="rb-sep"></span>')}</div>`).join('') +
      '<button class="rb-collapse" title="Collapse the ribbon (Ctrl+F1)" aria-label="Collapse the ribbon"><svg viewBox="0 0 20 20"><path d="M5 12.5l5-5 5 5"/></svg></button>';
    tbEl.after(r);
    // tabs, quick-access buttons and the "tell me" box go in the title bar
    const brand = $('tb-logo');
    const qat = document.createElement('div');
    qat.className = 'tb-qat';
    qat.innerHTML = [['save', 'Save (Ctrl+S)'], ['undo', 'Undo (Ctrl+Z)'], ['redo', 'Redo (Ctrl+Shift+Z)']].map(([k, t]) => `<button data-cmd="${k}" title="${t}" aria-label="${t}">${icon(k)}</button>`).join('');
    brand.after(qat);
    const tabs = document.createElement('div');
    tabs.className = 'rb-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = `<button class="rb-tab file" data-menu-btn data-menu="File">File</button>` + TABS.map((t) => `<button class="rb-tab" role="tab" data-tab="${t}">${t}</button>`).join('') +
      `<button class="rb-tell" title="Find any command (Ctrl+Enter)"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg><span>Tell me what you want to do</span></button>`;
    qat.after(tabs);
    // basic mode: one "Menus" button stands in for the menu bar
    const mb = document.createElement('button');
    mb.className = 'tb-menubtn';
    mb.setAttribute('data-menu-btn', '');
    mb.title = 'All menus (Alt)';
    mb.innerHTML = icon('menu') + '<span>Menus</span>';
    tabs.after(mb);

    // events
    qat.addEventListener('mousedown', (e) => e.preventDefault());
    qat.addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) App.command(b.dataset.cmd); });
    tabs.addEventListener('mousedown', (e) => {
      const f = e.target.closest('.rb-tab.file');
      if (f) { e.preventDefault(); toggleMenuFrom(f, 'File'); }
    });
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.rb-tab[data-tab]');
      if (t) {
        if (document.body.classList.contains('ribbon-min')) document.body.classList.remove('ribbon-min');
        else if (t.classList.contains('on') && e.detail === 2) document.body.classList.add('ribbon-min');
        selectTab(t.dataset.tab);
        return;
      }
      if (e.target.closest('.rb-tell')) App.openCommandPalette();
    });
    tabs.addEventListener('dblclick', (e) => { if (e.target.closest('.rb-tab[data-tab]')) { document.body.classList.toggle('ribbon-min'); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); } });
    mb.addEventListener('mousedown', (e) => { e.preventDefault(); toggleMenuFrom(mb, null); });
    r.querySelector('.rb-collapse').addEventListener('click', () => { document.body.classList.add('ribbon-min'); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
    wireButtons(r);
    wireFields(r);
    r.addEventListener('click', (e) => {
      const k = e.target.closest('[data-kbd]');
      if (k) { App.setKeyboard(k.dataset.kbd); if (App.sel && App.sel.kind === 'text') App.focusIME(); syncBars(); }
      const s = e.target.closest('.rb-style');
      if (s) { App.applyStyle(s.dataset.name); if (App.sel && App.sel.kind === 'text') App.focusIME(); }
    });
    window.addEventListener('keydown', (e) => {
      if (App.mode === 'word' && e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'F1') { e.preventDefault(); document.body.classList.toggle('ribbon-min'); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); }
    }, true);
  }
  let menuOpenFrom = null;
  function toggleMenuFrom(btn, name) {
    if (App.menusOpen && App.menusOpen() && menuOpenFrom === btn) { App.closeMenus(); menuOpenFrom = null; return; }
    const tpl = App.menuTemplate ? App.menuTemplate() : [];
    const r = btn.getBoundingClientRect();
    let items;
    if (name) { const i = App.menuIndex(name); items = i >= 0 ? tpl[i].submenu || [] : []; }
    else items = tpl.map((m) => ({ label: m.label, submenu: m.submenu || [] }));
    App.openMenuItems(items, r.left, r.bottom + 4);
    menuOpenFrom = btn;
  }
  function selectTab(t) {
    if (!TABS.includes(t)) t = 'Home';
    store.set('ribbonTab', t);
    document.querySelectorAll('.rb-tab[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); });
    document.querySelectorAll('.rb-panel').forEach((p) => (p.hidden = p.dataset.tab !== t));
    syncBars();
  }
  App.selectRibbonTab = selectTab;

  // shared wiring for the ribbon and the basic bar
  function runCmd(cmd) {
    if (cmd === 'cut' || cmd === 'copy' || cmd === 'paste') { if (App.sel && App.sel.kind === 'text') App.focusIME(); document.execCommand(cmd); return; }
    App.command(cmd);
  }
  function wireButtons(el) {
    el.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cmd], button[data-tool]');
      if (!b || !el.contains(b)) return;
      if (b.dataset.tool) {
        App.setTool(b.dataset.tool);
        const tips = { text: 'Text tool: click inside a column to start typing, or drag to draw a text box.', rect: 'Drag on the page to draw a rectangle.', rframe: 'Drag to draw a frame, then Place a picture into it.' };
        UI.status(tips[b.dataset.tool] || 'Drag on the page to draw.', 6000);
        syncBars();
        return;
      }
      runCmd(b.dataset.cmd);
      setTimeout(syncBars, 60);
    });
  }
  function wireFields(el) {
    const field = (id, fn) => {
      const f = el.querySelector('#' + id);
      if (!f) return;
      const go = () => { if (f.dataset.dirty) { delete f.dataset.dirty; fn(f.value); } };
      f.addEventListener('input', () => (f.dataset.dirty = '1'));
      f.addEventListener('change', go);
      f.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); f.dataset.dirty = '1'; go(); if (App.sel && App.sel.kind === 'text') App.focusIME(); }
        if (e.key === 'Escape') { delete f.dataset.dirty; syncBars(true); f.blur(); }
      });
    };
    const font = (v) => v.trim() && App.applyChar({ font: v.trim() });
    const size = (v) => { const n = parseFloat(v); if (n > 0) App.applyChar({ size: n }); };
    field('rb-font', font); field('bb-font', font);
    field('rb-size', size); field('bb-size', size);
    field('rb-lead', (v) => { const t = v.trim().toLowerCase(); App.applyPara('leading', t === 'auto' || t === '' ? 'auto' : parseFloat(t) || 'auto'); });
  }

  // style gallery
  let gallerySig = '';
  function sampleFor(st) {
    const f = (st.font || '').toLowerCase();
    if (/nudi|baraha|akshar|praja/.test(f)) return 'AaBbCc';
    if (/kannada|tunga|kedage|mallige|sampige|parijatha|lohit k/.test(f)) return 'ಕನ್ನಡ';
    if (/devanagari|mangal|sanskrit|kokila|aparajita|utsaah/.test(f)) return 'संस्कृत';
    return 'AaBbCc';
  }
  function buildGallery() {
    const g = $('rb-gallery');
    if (!g) return;
    const styles = App.doc ? App.doc.styles : null;
    const sig = styles ? JSON.stringify(Object.entries(styles).map(([n, s]) => [n, s.font, s.size, s.bold, s.italic, s.color])) : '';
    if (sig === gallerySig) return;
    gallerySig = sig;
    if (!styles) { g.innerHTML = '<div class="rb-empty">Open or create a publication to see its styles here.</div>'; return; }
    g.innerHTML = Object.entries(styles).map(([n, s]) => {
      const px = Math.max(11, Math.min(19, (s.size || 11) * 1.05));
      const css = `font-family:'${String(s.font || '').replace(/'/g, '')}',var(--font-ui);font-size:${px}px;font-weight:${s.bold ? 700 : 400};font-style:${s.italic ? 'italic' : 'normal'}`;
      return `<button class="rb-style" data-name="${esc(n)}" title="${esc(n)}: ${esc(s.font)} ${esc(s.size)} pt"><span class="rb-sample" style="${esc(css)}">${sampleFor(s)}</span><span class="rb-sname">${esc(n)}</span></button>`;
    }).join('');
  }

  // ================================================================== basic bar
  function buildBasic() {
    if ($('basicbar')) return;
    const b = document.createElement('div');
    b.id = 'basicbar';
    b.setAttribute('role', 'toolbar');
    b.setAttribute('aria-label', 'Basic toolbar');
    const bb = (i, label, cmd, title, extra = '') => `<button class="bb" data-cmd="${cmd}" title="${esc(title || label)}" ${extra}>${icon(i)}<span>${esc(label)}</span></button>`;
    const bt = (i, label, t, title) => `<button class="bb" data-tool="${t}" title="${esc(title)}">${icon(i)}<span>${esc(label)}</span></button>`;
    b.innerHTML = `
      <div class="bb-grp">${bb('new', 'New', 'new', 'New publication (Ctrl+N)')}${bb('open', 'Open', 'open', 'Open a BV Mudrana or PageMaker file (Ctrl+O)')}${bb('save', 'Save', 'save', 'Save (Ctrl+S)')}</div>
      <div class="bb-grp">${bb('undo', 'Undo', 'undo', 'Undo (Ctrl+Z)')}${bb('redo', 'Redo', 'redo', 'Redo (Ctrl+Shift+Z)')}</div>
      <div class="bb-grp">${bt('pointer', 'Select', 'pointer', 'Select and move things (pointer)')}${bt('textbox', 'Text box', 'text', 'Type text: click in a column or drag a box')}${bb('picture', 'Picture', 'place', 'Place a picture or a text file (Ctrl+D)')}${bt('shape', 'Shape', 'rect', 'Draw a rectangle')}</div>
      <div class="bb-grp bb-fmt">
        <div class="bb-fmt-top"><div class="fontbox bb-font"><input id="bb-font" spellcheck="false" autocomplete="off" aria-label="Font" data-sync="cc-font" placeholder="Font"><button class="fdrop" tabindex="-1" data-fontfor="bb-font">▾</button></div><input id="bb-size" class="bb-num" list="dl-sizes" aria-label="Size" title="Size in points" data-sync="cc-size"></div>
        <div class="bb-fmt-bot">${['bold', 'italic', 'underline'].map((k) => `<button class="bb-ic" data-cmd="${k}" title="${k[0].toUpperCase() + k.slice(1)}">${icon(k)}</button>`).join('')}<span class="bb-gap"></span>${['Left', 'Center', 'Right', 'Justify'].map((a) => `<button class="bb-ic" data-cmd="align${a}" title="${a === 'Justify' ? 'Justify' : 'Align ' + a.toLowerCase()}">${icon('align' + a)}</button>`).join('')}</div>
      </div>
      <div class="bb-grp"><button class="bb bb-kbd" id="bb-kbd" title="Type Kannada with the Nudi (KGP) keyboard. Scroll Lock also switches."><b class="bb-glyph">ಕ</b><span>Kannada</span></button>${bb('styles', 'Styles', 'showStyles', 'Paragraph styles (Ctrl+B)')}</div>
      <span class="bb-fill"></span>
      <div class="bb-grp">${bb('pdf', 'PDF', 'exportPdf', 'Save as PDF')}${bb('print', 'Print', 'print', 'Print (Ctrl+P)')}${bb('help', 'Help', 'quickStart', 'How to make your first page')}</div>`;
    $('toolbar').after(b);
    wireButtons(b);
    wireFields(b);
    $('bb-kbd').addEventListener('click', () => { App.toggleKeyboard(); syncBars(); });
  }

  // ================================================================== keep the bars in step with the selection
  function syncBars(force) {
    const bars = [$('ribbon'), $('basicbar')].filter(Boolean);
    if (!bars.length) return;
    const ctl = $('pal-control');
    for (const bar of bars) {
      bar.querySelectorAll('input[data-sync]').forEach((f) => {
        const src = $(f.dataset.sync);
        if (src && (force || (document.activeElement !== f && !f.dataset.dirty))) f.value = App.doc ? src.value : '';
      });
      bar.querySelectorAll('button[data-cmd]').forEach((b) => {
        const c = ctl && ctl.querySelector(`.cb[data-cmd="${b.dataset.cmd}"]`);
        if (c) b.classList.toggle('on', c.classList.contains('on') && !!App.doc);
      });
      bar.querySelectorAll('button[data-tool]').forEach((b) => b.classList.toggle('on', App.tool === b.dataset.tool));
    }
    // view toggles
    const vt = { toggleRulers: !!App.showRulers, toggleGuides: !!App.showGuides, preview: document.body.classList.contains('preview-mode'), smartReflow: !!App.smartReflow, showThreads: !!App.showThreads, formatBrush: !!App.formatBrush };
    for (const [k, v] of Object.entries(vt)) document.querySelectorAll(`#ribbon [data-cmd="${k}"]`).forEach((b) => b.classList.toggle('on', v));
    document.querySelectorAll('#ribbon [data-kbd]').forEach((b) => b.classList.toggle('on', b.dataset.kbd === (App.kbd || 'off')));
    const k = $('bb-kbd');
    if (k) { k.classList.toggle('on', !!App.kbd && App.kbd !== 'off'); k.querySelector('span').textContent = App.kbd && App.kbd !== 'off' ? 'Kannada on' : 'Kannada'; }
    buildGallery();
    const cur = $('cp-style') ? $('cp-style').value : '';
    document.querySelectorAll('#rb-gallery .rb-style').forEach((s) => s.classList.toggle('on', !!App.doc && s.dataset.name === cur));
    const zs = $('st-zs');
    if (zs && App.view && document.activeElement !== zs) zs.value = Math.round(App.view.zoom * 100);
  }
  App.syncBars = syncBars;

  // ================================================================== status bar: mode chip and zoom slider
  function buildStatus() {
    const st = $('status');
    if (!st || $('st-mode')) return;
    const zs = document.createElement('input');
    zs.type = 'range'; zs.id = 'st-zs'; zs.min = 10; zs.max = 400; zs.step = 5; zs.title = 'Zoom'; zs.setAttribute('aria-label', 'Zoom');
    zs.addEventListener('input', () => { if (App.doc) App.setZoom(+zs.value / 100); });
    const z = $('st-zoom');
    z.before(zs);
    const chip = document.createElement('button');
    chip.id = 'st-mode'; chip.className = 'st-chip st-mode'; chip.title = 'Interface mode and theme';
    chip.setAttribute('data-menu-btn', '');
    st.appendChild(chip);
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (App.menusOpen() && menuOpenFrom === chip) { App.closeMenus(); menuOpenFrom = null; return; }
      const items = [
        ...MODES.map((m) => ({ label: m.name + ' mode', sublabel: m.good, check: true, checked: App.mode === m.id, cmd: 'mode:' + m.id })),
        { sep: true },
        { label: 'Theme', submenu: THEMES.map((t) => ({ label: t.name, check: true, checked: App.theme === t.id, cmd: 'theme:' + t.id })) },
        { label: 'Appearance Settings…', cmd: 'appearance' },
      ];
      const r = chip.getBoundingClientRect();
      const p = App.openMenuItems(items, r.right - 260, r.top);
      p.el.style.top = Math.max(6, r.top - p.el.offsetHeight - 6) + 'px';
      p.el.style.left = Math.max(6, Math.min(window.innerWidth - p.el.offsetWidth - 6, r.right - p.el.offsetWidth)) + 'px';
      p.el.style.transformOrigin = 'bottom right';
      menuOpenFrom = chip;
    });
    chip.textContent = (MODES.find((m) => m.id === App.mode) || MODES[0]).name;
  }

  // ================================================================== Appearance dialog
  function miniMode(id) {
    const pal = '<i class="mm-pal"></i>';
    if (id === 'pagemaker') return '<i class="mm-menu"></i><i class="mm-bar"></i><i class="mm-tools"></i><i class="mm-page"></i><i class="mm-pal r1"></i><i class="mm-pal r2"></i><i class="mm-ctl"></i>';
    if (id === 'advanced') return '<i class="mm-menu"></i><i class="mm-bar thin"></i><i class="mm-tools"></i><i class="mm-pal l2"></i><i class="mm-page sm"></i><i class="mm-pal r1"></i><i class="mm-pal r2"></i><i class="mm-pal r3"></i><i class="mm-ctl"></i>';
    if (id === 'word') return '<i class="mm-tabs"></i><i class="mm-ribbon"></i><i class="mm-page wide"></i>';
    if (id === 'basic') return '<i class="mm-menu short"></i><i class="mm-basic"></i><i class="mm-page wide"></i>';
    return pal;
  }
  function miniTheme(t) {
    const p = t.p;
    const r = p.r;
    const title = p.title || p.chrome;
    return `<div class="mt-win" style="background:${p.chrome};border-radius:${Math.min(r, 10)}px">
      <div class="mt-title" style="background:${title}"></div>
      <div class="mt-bar" style="background:${p.bar}"><i style="background:${p.accent};border-radius:${Math.min(r, 8)}px"></i><i style="background:${p.ink};opacity:.35;border-radius:${Math.min(r, 8)}px"></i><i style="background:${p.ink};opacity:.35;border-radius:${Math.min(r, 8)}px"></i></div>
      <div class="mt-board" style="background:${p.board}"><div class="mt-page"></div><div class="mt-pal" style="background:${p.pal};border-radius:${Math.min(r, 8)}px"><i style="background:${p.accent}"></i><i style="background:${p.ink};opacity:.3"></i><i style="background:${p.ink};opacity:.3"></i></div></div>
    </div>`;
  }
  let apDlg = null;
  function refreshAppearance() {
    if (!apDlg || !document.body.contains(apDlg)) { apDlg = null; return; }
    apDlg.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === App.mode));
    apDlg.querySelectorAll('[data-theme-id]').forEach((b) => b.classList.toggle('on', b.dataset.themeId === App.theme));
    const seed = apDlg.querySelector('.ap-seed');
    if (seed) seed.hidden = !THEMES.find((x) => x.id === App.theme).seed;
    apDlg.querySelectorAll('[data-seed]').forEach((b) => b.classList.toggle('on', +b.dataset.seed === App.seedHue));
  }
  async function appearanceDialog() {
    const html = `
      <p class="note ap-lead">Pick how BV Mudrana is laid out and how it looks. Changes show straight away, and you can come back here any time from View &gt; Interface Theme or the chip at the bottom right.</p>
      <div class="ap-h">Interface mode</div>
      <div class="ap-modes">${MODES.map((m) => `<button class="ap-card" data-mode="${m.id}"><div class="ap-mini ap-mini-${m.id}">${miniMode(m.id)}</div><b>${esc(m.name)}</b><span>${esc(m.note)}</span><em>Good for: ${esc(m.good)}</em></button>`).join('')}</div>
      <div class="ap-h">Theme</div>
      <div class="ap-themes">${THEMES.map((t) => `<button class="ap-card ap-theme" data-theme-id="${t.id}">${miniTheme(t)}<b>${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div>
      <div class="ap-seed" hidden><span class="ap-k">Seed colour</span>${SEEDS.map(([n, h]) => `<button class="ap-sw" data-seed="${h}" title="${n}" aria-label="${n}" style="background:oklch(0.62 0.15 ${h})"></button>`).join('')}<label class="ap-custom" title="Any colour"><input type="range" min="0" max="359" step="1" id="ap-hue" aria-label="Seed hue"></label></div>`;
    const p = UI.dialog({
      title: 'Appearance', html, width: 980, buttons: [{ label: 'Done', value: 'ok', primary: true }],
      onOpen: (d) => {
        apDlg = d;
        d.classList.add('ap-dlg');
        d.addEventListener('click', (e) => {
          const m = e.target.closest('[data-mode]'); if (m) App.setMode(m.dataset.mode);
          const t = e.target.closest('[data-theme-id]'); if (t) App.setTheme(t.dataset.themeId);
          const s = e.target.closest('[data-seed]'); if (s) { App.setSeed(+s.dataset.seed); d.querySelector('#ap-hue').value = App.seedHue; refreshAppearance(); }
        });
        const hue = d.querySelector('#ap-hue');
        hue.value = App.seedHue;
        hue.addEventListener('input', () => { App.setSeed(+hue.value); refreshAppearance(); });
        refreshAppearance();
        // start at the top, with the current mode focused (not the colour slider)
        const cur = d.querySelector('.ap-card.on') || d.querySelector('.ap-card');
        requestAnimationFrame(() => { if (cur) cur.focus({ preventScroll: true }); d.querySelector('.dbody').scrollTop = 0; });
      },
    });
    await p;
    apDlg = null;
  }
  App.appearanceDialog = appearanceDialog;

  // ================================================================== Quick Start
  async function quickStart() {
    const m = App.mode;
    const steps = {
      basic: [
        ['Start a publication', 'Click <b>New</b>. Choose the page size, margins and columns, then OK. To work on an old PageMaker file, click <b>Open</b> instead; BV Mudrana suggests the fonts and sizes for you.'],
        ['Add text', 'Click <b>Text box</b>, then click inside a column on the page and start typing. Or click <b>Picture</b> to place a Word or text file.'],
        ['Type Kannada', 'Click <b>Kannada</b> (or press Scroll Lock) to type with the Nudi KGP keyboard. Click again for English.'],
        ['Make it look right', 'Select text, then choose a font and size, or click <b>Styles</b> and pick a style such as Body text or Chapter title.'],
        ['Save and share', 'Click <b>Save</b>. Choose PageMaker 7 (.pmd) in the file type list to open it in PageMaker. Click <b>PDF</b> for the printer.'],
      ],
      word: [
        ['Start a publication', '<b>File &gt; New</b> (Ctrl+N), or <b>File &gt; Open</b> for a PageMaker file. BV Mudrana suggests fonts and sizes after you pick it.'],
        ['Add text', '<b>Insert &gt; Text Box</b>, then click inside a column. <b>Insert &gt; Place</b> brings in a Word or text file.'],
        ['Type Kannada', '<b>Language &gt; Kannada KGP</b>, or press Scroll Lock.'],
        ['Format', '<b>Home</b> has the font, size, bold, alignment and the styles gallery. The small arrow beside each group opens the full dialog.'],
        ['Save and share', '<b>File &gt; Save As</b> and pick PageMaker 7 (.pmd), or <b>Review &gt; Export PDF</b>.'],
      ],
    };
    const def = [
      ['Start a publication', '<b>File &gt; New</b> (Ctrl+N), or <b>File &gt; Open</b> (Ctrl+O) for a PageMaker file. BV Mudrana suggests the fonts and sizes after you pick it.'],
      ['Add text', 'Choose the <b>Text tool</b> (the A in the toolbox, or F9), click inside a column and type. <b>File &gt; Place</b> (Ctrl+D) brings in a whole file.'],
      ['Type Kannada', 'Press <b>Scroll Lock</b> or Ctrl+Alt+K for the Nudi KGP keyboard. The chip at the bottom shows which keyboard is on.'],
      ['Format', 'Use the <b>Control palette</b> at the bottom, or Type &gt; Character (Ctrl+T) and Paragraph (Ctrl+M). Styles are in Ctrl+B.'],
      ['Save and share', '<b>File &gt; Save As</b> and pick PageMaker 7 (.pmd), 6.5 (.p65) or BV Mudrana (.bvm). Export a PDF with Ctrl+Alt+Shift+P.'],
    ];
    const list = steps[m] || def;
    const html = `<ol class="qs-list">${list.map(([h, t], i) => `<li><span class="qs-n">${i + 1}</span><div><b>${h}</b><p>${t}</p></div></li>`).join('')}</ol>
      <p class="note">Lost? Press <b>Ctrl+Enter</b> and type what you want, for example “footnote” or “page numbers”.</p>`;
    const r = await UI.dialog({ title: 'Your first page in five steps', html, width: 560, buttons: [{ label: 'Got it', value: 'ok', primary: true }, { label: 'Change Mode…', value: 'mode' }] });
    if (r && r.value === 'mode') appearanceDialog();
  }

  // ================================================================== commands
  const baseCommand = App.command;
  App.command = function (cmd, arg) {
    if (typeof cmd === 'string') {
      if (cmd.startsWith('mode:')) return App.setMode(cmd.slice(5));
      if (cmd.startsWith('theme:')) return App.setTheme(cmd.slice(6));
      if (cmd === 'appearance') return appearanceDialog();
      if (cmd === 'quickStart') return quickStart();
    }
    return baseCommand.apply(this, arguments);
  };

  // follow the selection, the keyboard and the zoom
  const wrap = (name, after) => {
    const f = App[name];
    if (typeof f !== 'function') return;
    App[name] = function () { const r = f.apply(this, arguments); try { after(); } catch (_) {} return r; };
  };

  // welcome screen: a one-click workspace picker
  function decorateWelcome() {
    const a = document.querySelector('#welcome .wl-actions');
    if (!a || a.querySelector('.wl-modes')) return;
    const box = document.createElement('div');
    box.className = 'wl-modes';
    box.innerHTML = `<div class="clabel" style="font-size:11px">Workspace</div><div class="wl-seg">${MODES.map((m) => `<button data-wmode="${m.id}" class="${m.id === App.mode ? 'on' : ''}" title="${esc(m.note)}">${esc(m.name)}</button>`).join('')}<button data-wtheme title="Themes: Material You, Classic PageMaker 7, Expressive and more">Theme…</button></div>`;
    const foot = a.querySelector('.wl-foot');
    foot.before(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-wmode]');
      if (b) { App.setMode(b.dataset.wmode); box.querySelectorAll('[data-wmode]').forEach((x) => x.classList.toggle('on', x === b)); }
      if (e.target.closest('[data-wtheme]')) { $('welcome').hidden = true; appearanceDialog(); }
    });
  }

  // ================================================================== start
  function init() {
    if (!$('toolbar') || !$('status') || !App.showPanel || !App.openMenuItems) return setTimeout(init, 30);
    buildRibbon();
    buildBasic();
    buildStatus();
    wrap('syncControls', () => syncBars());
    wrap('setTool', () => syncBars());
    wrap('setKeyboard', () => syncBars());
    wrap('toggleKeyboard', () => syncBars());
    wrap('setZoom', () => { const zs = $('st-zs'); if (zs && App.view && document.activeElement !== zs) zs.value = Math.round(App.view.zoom * 100); });
    wrap('setDoc', () => { gallerySig = ''; setTimeout(() => syncBars(true), 0); });
    wrap('render', () => { if (App.mode === 'word') buildGallery(); });
    const sw = App.showWelcome;
    if (sw) App.showWelcome = async function () { const r = await sw.apply(this, arguments); decorateWelcome(); return r; };
    App.setMode(store.get('mode', 'pagemaker'), true);
    syncChrome();
  }
  applySeed();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
