/* BV Mudrana: application core: state, rendering of the current spread, undo, commands. */
(function () {
  const BV = window.BV;
  const T = BV.Text;
  const L = BV.Layout;
  const $ = (id) => document.getElementById(id);
  const PX_PER_PT = 96 / 72;

  let readyResolve;
  const whenReady = new Promise((r) => (readyResolve = r));
  const App = (window.App = {
    whenReady,
    readyResolve: () => readyResolve(),
    doc: null,
    filePath: null,
    dirty: false,
    view: { master: false, spread: 0, zoom: 1, fit: true },
    tool: 'pointer',
    altTool: 'text',
    sel: { kind: 'none' },
    typingAttrs: null,
    loaded: null,
    autoflow: false,
    showRulers: true,
    showGuides: true,
    snap: true,
    showMasters: true,
    showNonPrinting: true,
    lockGuides: false,
    undoStack: [],
    redoStack: [],
    lastUndoKey: null,
    lastUndoTime: 0,
    placements: [],
    pad: { x: 0, y: 0 },
    goalX: null,
    defaultStyle: 'Body text',
  });

  // ------------------------------------------------------------------ layout cache
  let cache = new Map();
  let globalVer = 1;
  const storyVer = {};
  App.markStory = (sid) => { storyVer[sid] = (storyVer[sid] || 0) + 1; };
  App.markAll = () => { globalVer++; cache = new Map(); };
  App.isMasterStory = (story) => {
    const f = story.frames.map((id) => App.doc.items[id]).find(Boolean);
    return !!(f && String(f.page).startsWith('M'));
  };
  App.getLayout = function (story, pageText) {
    const master = App.isMasterStory(story);
    const key = story.id + '|' + (master ? pageText || '' : '');
    const v = (storyVer[story.id] || 0) + ':' + globalVer;
    const c = cache.get(key);
    if (c && c.v === v) return c.lay;
    const lay = L.layoutStory(App.doc, story, { pageText: master ? pageText : undefined, obstacles: App.obstaclesFor, footnote: App.doc.footnotes && Object.keys(App.doc.footnotes).length ? App.footnoteLayout : null });
    // auto-growing frames take the height of their text
    for (const fid of story.frames) {
      const it = App.doc.items[fid];
      if (it && it.autoGrow && lay.frames[fid]) {
        const minH = BV.paraProps(App.doc, story.paras[0]).leading || 14;
        it.h = Math.max(minH, Math.min(it.maxH || it.h, lay.frames[fid].usedH || minH));
      }
    }
    cache.set(key, { v, lay });
    return lay;
  };
  // text wrap: objects on the same page with a wrap setting push text aside
  App.obstaclesFor = function (frame) {
    const out = [];
    for (const it of Object.values(App.doc.items)) {
      if (it === frame || it.page !== frame.page || !it.wrap || it.wrap.type !== 'rect') continue;
      if (it.type === 'text' && it.storyId === frame.storyId) continue;
      const b = BV.Render.box(it);
      const so = it.wrap.standoff ?? 6;
      const o = { x0: b.x - so - frame.x, y0: b.y - so - frame.y, x1: b.x + b.w + so - frame.x, y1: b.y + b.h + so - frame.y };
      if (o.x1 <= 0 || o.x0 >= frame.w || o.y1 <= 0 || o.y0 >= (frame.autoGrow ? frame.maxH || frame.h : frame.h)) continue;
      out.push(o);
    }
    return out;
  };
  App.layoutFor = (story) => App.getLayout(story, App.pageTextForStory(story));
  App.pageTextForStory = (story) => {
    const f = story.frames.map((id) => App.doc.items[id]).find(Boolean);
    if (!f || !String(f.page).startsWith('M')) return undefined;
    const pl = App.placements.find((p) => p.ref === f.page);
    return pl ? pl.pageText : f.page === 'ML' ? 'LM' : 'RM';
  };

  // ------------------------------------------------------------------ document lifecycle
  App.setDoc = function (doc, filePath) {
    App.doc = doc;
    App.docName = null;
    App.filePath = filePath || null;
    App.sel = { kind: 'none' };
    App.loaded = null;
    App.undoStack = [];
    App.redoStack = [];
    App.view.master = false;
    App.view.spread = 0;
    App.zeroPt = null;
    App.view.fit = true;
    App.markAll();
    App.setDirty(false);
    App.refreshStyles();
    App.refreshColors && App.refreshColors();
    App.refreshLayers && App.refreshLayers();
    App.render();
    App.fitZoom();
    if (App.ensureFonts) App.ensureFonts(App.docFonts(doc));
    if (window.native && native.menuStyles) native.menuStyles(Object.keys(doc.styles));
  };
  App.setDirty = function (v) {
    App.dirty = v;
    window.native && native.setDirty(v);
    const name = App.filePath ? App.filePath.split(/[\\/]/).pop() : App.docName ? App.docName + ' (not saved yet)' : 'Untitled';
    const t = `${App.titleOwner ? App.titleOwner() : 'BV Mudrana'} | ${name}${v ? ' •' : ''}`;
    document.title = t;
    window.native && native.setTitle(t);
  };

  // ------------------------------------------------------------------ undo
  const snapshot = () => JSON.stringify({ doc: App.doc, sel: App.sel });
  App.checkpoint = function (key) {
    const now = Date.now();
    if (key && key === App.lastUndoKey && now - App.lastUndoTime < 1500) { App.lastUndoTime = now; return; }
    App.undoStack.push(snapshot());
    const limit = JSON.stringify(App.doc.stories).length > 2e6 ? 25 : 80;
    while (App.undoStack.length > limit) App.undoStack.shift();
    App.redoStack = [];
    App.lastUndoKey = key || null;
    App.lastUndoTime = now;
  };
  App.changed = function (sid) {
    if (sid) App.markStory(sid); else App.markAll();
    App.setDirty(true);
    App.render();
  };
  function restore(s) {
    const o = JSON.parse(s);
    App.doc = o.doc;
    App.sel = o.sel || { kind: 'none' };
    if (App.sel.kind === 'text' && !App.doc.stories[App.sel.sid]) App.sel = { kind: 'none' };
    if (App.sel.kind === 'items') App.sel.ids = App.sel.ids.filter((id) => App.doc.items[id]);
    App.view.spread = Math.min(App.view.spread, BV.spreads(App.doc).length - 1);
    App.markAll();
    App.refreshStyles();
    App.setDirty(true);
    App.render();
  }
  App.undo = () => { if (!App.undoStack.length) return BV.UI.status('Nothing to undo'); App.redoStack.push(snapshot()); restore(App.undoStack.pop()); App.lastUndoKey = null; };
  App.redo = () => { if (!App.redoStack.length) return BV.UI.status('Nothing to redo'); App.undoStack.push(snapshot()); restore(App.redoStack.pop()); App.lastUndoKey = null; };

  // ------------------------------------------------------------------ view geometry
  App.scale = () => App.view.zoom * PX_PER_PT;
  App.computePlacements = function () {
    const doc = App.doc;
    const W = doc.setup.w;
    const facing = doc.setup.doubleSided && doc.setup.facing;
    if (App.view.master) {
      const mid = App.masterId();
      App.placements = facing
        ? [{ ref: BV.masterRef(mid, 'L'), idx: -1, side: 'L', x0: 0, pageText: 'LM' }, { ref: BV.masterRef(mid, 'R'), idx: -1, side: 'R', x0: W, pageText: 'RM' }]
        : [{ ref: BV.masterRef(mid, 'R'), idx: -1, side: 'R', x0: 0, pageText: '#' }];
    } else {
      const sp = BV.spreads(doc)[App.view.spread] || [0];
      App.placements = sp.map((idx) => ({ ref: doc.pages[idx].id, idx, side: BV.pageSide(doc, idx), x0: BV.pageOffsetX(doc, idx), pageText: BV.pageLabel(doc, idx) }));
    }
    // a generous pasteboard on every side, as in PageMaker, so there is always room to scroll
    const SW = BV.spreadWidth(doc);
    App.pad = { x: Math.max(SW * 0.6, 260), y: Math.max(doc.setup.h * 0.45, 180) };
  };
  App.masterId = () => (App.view.master === true || !App.view.master ? '' : App.view.master);
  App.placementOf = (ref) => App.placements.find((p) => p.ref === ref);
  App.clientToSpread = function (cx, cy) {
    const r = $('spread').getBoundingClientRect();
    const s = App.scale();
    return { x: (cx - r.left) / s - App.pad.x, y: (cy - r.top) / s - App.pad.y };
  };
  App.spreadToClient = function (x, y) {
    const r = $('spread').getBoundingClientRect();
    const s = App.scale();
    return { x: r.left + (x + App.pad.x) * s, y: r.top + (y + App.pad.y) * s };
  };
  App.placementAt = function (x) {
    const W = App.doc.setup.w;
    let best = App.placements[0], bd = Infinity;
    for (const p of App.placements) {
      const d = x < p.x0 ? p.x0 - x : x > p.x0 + W ? x - p.x0 - W : 0;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  App.fitZoom = function () {
    const b = $('board');
    const W = BV.spreadWidth(App.doc), H = App.doc.setup.h;
    const z = Math.min((b.clientWidth - 40) / (W * PX_PER_PT), (b.clientHeight - 40) / (H * PX_PER_PT));
    App.setZoom(Math.max(0.05, z), null, true);
  };
  // zoom so a box (spread coordinates) fills the window
  App.zoomToBox = function (bx, margin = 24) {
    const b = $('board');
    const z = Math.min((b.clientWidth - margin * 2) / (Math.max(bx.w, 4) * PX_PER_PT), (b.clientHeight - margin * 2) / (Math.max(bx.h, 4) * PX_PER_PT));
    App.setZoom(Math.max(0.05, Math.min(16, z)), null, false);
    App.centerOn(bx.x + bx.w / 2, bx.y + bx.h / 2);
  };
  App.centerOn = function (x, y) {
    const b = $('board');
    const c = App.spreadToClient(x, y);
    const r = b.getBoundingClientRect();
    b.scrollLeft += c.x - (r.left + r.width / 2);
    b.scrollTop += c.y - (r.top + r.height / 2);
    App.drawRulers();
  };
  App.viewHistory = [];
  App.rememberView = function () {
    const b = $('board');
    App.viewHistory.push({ zoom: App.view.zoom, fit: App.view.fit, l: b.scrollLeft, t: b.scrollTop });
    if (App.viewHistory.length > 30) App.viewHistory.shift();
  };
  App.previousView = function () {
    const v = App.viewHistory.pop();
    if (!v) return BV.UI.status('No previous view.');
    if (v.fit) return App.fitZoom();
    App.setZoom(v.zoom, null, false, true);
    const b = $('board');
    b.scrollLeft = v.l; b.scrollTop = v.t;
  };
  App.setZoom = function (z, anchor, fit, noHistory) {
    const b = $('board');
    z = Math.max(0.05, Math.min(16, z));
    if (!noHistory && Math.abs(z - App.view.zoom) > 1e-6) App.rememberView();
    let ax;
    if (anchor) ax = App.clientToSpread(anchor.x, anchor.y);
    App.view.zoom = z;
    App.view.fit = !!fit;
    App.renderNow();
    const s = App.scale();
    if (fit) {
      App.centerOn(BV.spreadWidth(App.doc) / 2, App.doc.setup.h / 2);
    } else if (anchor) {
      const c = App.spreadToClient(ax.x, ax.y);
      b.scrollLeft += c.x - anchor.x;
      b.scrollTop += c.y - anchor.y;
    }
    void s;
    $('st-zoom').textContent = Math.round(z * 100) + '%';
    App.drawRulers();
  };
  App.ZOOM_STEPS = [0.05, 0.1, 0.125, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16];
  App.zoomStep = function (dir, anchor) {
    const z = App.view.zoom;
    const steps = App.ZOOM_STEPS;
    const next = dir > 0 ? steps.find((v) => v > z * 1.01) || steps[steps.length - 1] : [...steps].reverse().find((v) => v < z * 0.99) || steps[0];
    App.setZoom(next, anchor);
  };
  App.gotoSpread = function (i, master, opts = {}) {
    const n = BV.spreads(App.doc).length;
    const prev = { master: App.view.master, spread: App.view.spread };
    App.view.master = master ? (master === true || !BV.masterById(App.doc, master) ? true : master) : false;
    if (!master) App.view.spread = Math.max(0, Math.min(n - 1, i));
    if (prev.master !== App.view.master || prev.spread !== App.view.spread) {
      if (!opts.noHistory) { App.pageHistory = App.pageHistory || []; App.pageHistory.push(prev); App.pageFuture = []; }
    }
    if (App.sel.kind === 'items') App.sel = { kind: 'none' };
    App.renderNow();
    if (App.view.fit) App.fitZoom();
    else if (opts.at === 'top' || opts.at === 'bottom') {
      const b = $('board');
      const c = App.spreadToClient(0, opts.at === 'top' ? -12 : App.doc.setup.h + 12);
      const r = b.getBoundingClientRect();
      b.scrollTop += opts.at === 'top' ? c.y - r.top : c.y - r.bottom;
    }
  };
  App.goBack = function () {
    const h = App.pageHistory || [];
    const v = h.pop();
    if (!v) return BV.UI.status('No earlier page to go back to.');
    (App.pageFuture = App.pageFuture || []).push({ master: App.view.master, spread: App.view.spread });
    App.gotoSpread(v.spread, v.master, { noHistory: true });
  };
  App.goForward = function () {
    const v = (App.pageFuture || []).pop();
    if (!v) return BV.UI.status('No later page to go forward to.');
    (App.pageHistory = App.pageHistory || []).push({ master: App.view.master, spread: App.view.spread });
    App.gotoSpread(v.spread, v.master, { noHistory: true });
  };
  App.gotoPage = (idx) => App.gotoSpread(BV.spreadOfPage(App.doc, idx));

  // ------------------------------------------------------------------ rendering
  let raf = 0;
  App.render = function () {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; App.renderNow(); });
  };
  App.renderNow = function () {
    const doc = App.doc;
    if (!doc) return;
    App.computePlacements();
    const s = App.scale();
    const W = doc.setup.w, H = doc.setup.h;
    const spreadW = BV.spreadWidth(doc);
    const vbW = spreadW + App.pad.x * 2, vbH = H + App.pad.y * 2;
    const svg = $('spread');
    svg.setAttribute('viewBox', `${-App.pad.x} ${-App.pad.y} ${vbW} ${vbH}`);
    svg.setAttribute('width', vbW * s);
    svg.setAttribute('height', vbH * s);
    const bd = $('board');
    const iw = Math.max(vbW * s, bd.clientWidth), ih = Math.max(vbH * s, bd.clientHeight);
    $('board-inner').style.width = iw + 'px';
    $('board-inner').style.height = ih + 'px';
    svg.style.left = (iw - vbW * s) / 2 + 'px';
    svg.style.top = (ih - vbH * s) / 2 + 'px';

    const px = 1 / s;
    let out = '';
    for (const p of App.placements) out += `<rect class="shadow" x="${p.x0 + 3 * px * 1.5}" y="${3 * px * 1.5}" width="${W}" height="${H}"/>`;
    for (const p of App.placements) out += `<rect class="pagebg" x="${p.x0}" y="0" width="${W}" height="${H}"/>`;
    // guides behind content (PageMaker default)
    if (App.showGuides && !App.guidesFront) for (const p of App.placements) out += `<g transform="translate(${p.x0},0)">${BV.Render.guidesSVG(doc, p.ref, p.side, s, App.guidesFor(p))}</g>`;
    for (const p of App.placements) {
      out += `<g transform="translate(${p.x0},0)">`;
      if (!App.view.master && BV.Render.pageDecor) out += BV.Render.pageDecor(doc, p.idx);
      if (!App.view.master) {
        const page = doc.pages[p.idx];
        const mref = BV.masterRefFor(doc, page, p.side);
        if (mref && App.showMasters) for (const it of BV.itemsOnPage(doc, mref)) out += BV.Render.itemSVG(doc, it, App.getLayout, p.pageText, { px });
      }
      for (const it of BV.itemsOnPage(doc, p.ref)) {
        if (it.nonPrint && !App.showNonPrinting) continue;
        out += BV.Render.itemSVG(doc, it, App.getLayout, p.pageText, { px });
        if (it.type === 'text' && App.showGuides && App.isEmptyFrame(it)) out += `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="none" stroke="#9a9a9a" stroke-dasharray="${3 * px} ${3 * px}" stroke-width="${px}"/>`;
      }
      out += '</g>';
    }
    if (App.overlayHooks) for (const p of App.placements) for (const h of App.overlayHooks) out += `<g transform="translate(${p.x0},0)">${h(p, s, px) || ''}</g>`;
    if (App.guidesFront && App.showGuides) for (const p of App.placements) out += `<g transform="translate(${p.x0},0)">${BV.Render.guidesSVG(doc, p.ref, p.side, s, App.guidesFor(p))}</g>`;
    out += App.selectionSVG(px);
    out += App.dragOverlay ? App.dragOverlay(px) : '';
    svg.innerHTML = out;
    App.positionIME();
    App.renderPageIcons();
    App.syncControls();
    App.updateInfo();
    App.refreshMasters && App.refreshMasters();
    App.drawRulers();
  };
  App.isEmptyFrame = function (it) {
    const st = App.doc.stories[it.storyId];
    if (!st) return true;
    const lay = App.layoutFor(st);
    const fl = lay.frames[it.id];
    return !fl || !fl.lines.some((l) => l.segs.length);
  };
  App.guidesFor = function (p) {
    if (p.idx < 0) {
      const m = BV.masterById(App.doc, App.masterId());
      if (m) { m.guides = m.guides || { L: { h: [], v: [] }, R: { h: [], v: [] } }; return m.guides[p.side]; }
      return App.doc.masterGuides[p.side];
    }
    return App.doc.pages[p.idx].guides;
  };

  // items visible & selectable in the current view (page items only, topmost last)
  App.visibleItems = function () {
    const out = [];
    for (const p of App.placements) for (const it of BV.itemsOnPage(App.doc, p.ref)) out.push({ it, p });
    return out;
  };
  App.itemPlacement = (it) => App.placementOf(it.page);

  // ------------------------------------------------------------------ selection drawing
  App.selectionSVG = function (px) {
    const doc = App.doc;
    let s = '';
    if (App.sel.kind === 'items') {
      const groups = new Set();
      for (const id of App.sel.ids) {
        const it = doc.items[id];
        const p = it && App.itemPlacement(it);
        if (!p) continue;
        const locked = it.locked || BV.layerOf(doc, it).locked;
        const color = locked ? '#9a9a9a' : '#2a6be0';
        const b = BV.Render.box(it);
        const x = p.x0 + b.x, y = b.y, w = b.w, h = b.h;
        let g = '';
        if (it.type === 'text') g += App.windowshadeSVG(it, p, px, locked);
        else if (it.type === 'line') {
          for (const [hx, hy] of [[it.x, it.y], [it.x + it.w, it.y + it.h]]) g += handle(p.x0 + hx, hy, px, locked);
        } else {
          g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${px}"/>`;
          if (App.tool === 'crop' && (it.type === 'image' || (it.type === 'frame' && it.src))) {
            // show the full picture faintly while cropping
            const cx = it.cx ?? 0, cy = it.cy ?? 0, cw = it.cw ?? w, ch = it.ch ?? h;
            g += `<rect x="${x + cx}" y="${y + cy}" width="${cw}" height="${ch}" fill="none" stroke="#2a6be0" stroke-dasharray="${3 * px} ${3 * px}" stroke-width="${px}"/>`;
          }
          for (const [hx, hy] of handlePoints(x, y, w, h)) g += handle(hx, hy, px, locked);
        }
        if (it.rot) g = `<g transform="rotate(${it.rot} ${x + w / 2} ${y + h / 2})">${g}</g>`;
        s += g;
        if (it.group) groups.add(it.group);
      }
      // a dashed box around a whole group
      for (const gid of groups) {
        const mem = Object.values(doc.items).filter((i) => i.group === gid && App.itemPlacement(i));
        if (mem.length < 2) continue;
        const p = App.itemPlacement(mem[0]);
        const b = App.selBounds(mem);
        s += `<rect x="${p.x0 + b.x - 3 * px}" y="${b.y - 3 * px}" width="${b.w + 6 * px}" height="${b.h + 6 * px}" fill="none" stroke="#2a6be0" stroke-dasharray="${4 * px} ${3 * px}" stroke-width="${px}"/>`;
      }
    } else if (App.sel.kind === 'text') {
      s += App.textSelectionSVG(px);
    }
    if (App.polyDraft && App.polyDraft.pts.length) {
      const d = App.polyDraft;
      const pts = d.pts.map((q) => q.x + ',' + q.y).join(' ') + (d.cur ? ' ' + d.cur.x + ',' + d.cur.y : '');
      s += `<polyline points="${pts}" fill="none" stroke="#000" stroke-width="${px}"/>`;
      s += `<circle cx="${d.pts[0].x}" cy="${d.pts[0].y}" r="${4 * px}" fill="#fff" stroke="#2a6be0" stroke-width="${px}"/>`;
    }
    return s;
  };
  const handle = (x, y, px, locked) => `<rect x="${x - 3 * px}" y="${y - 3 * px}" width="${6 * px}" height="${6 * px}" fill="${locked ? '#d8d8d8' : '#fff'}" stroke="${locked ? '#888' : '#000'}" stroke-width="${px}"/>`;
  const handlePoints = (x, y, w, h) => [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  App.handlePoints = handlePoints;

  // PageMaker windowshade: lines across top & bottom with loops in the middle
  App.windowshadeSVG = function (it, p, px, locked) {
    const story = App.doc.stories[it.storyId];
    const lay = App.layoutFor(story);
    const fi = story.frames.indexOf(it.id);
    const isFirst = fi === 0;
    const isLast = fi === story.frames.length - 1;
    const x = p.x0 + it.x, y = it.y, w = it.w, h = it.h;
    let s = `<g class="wshade">`;
    s += `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#000" stroke-width="${px}"/>`;
    s += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="#000" stroke-width="${px}"/>`;
    for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) s += handle(hx, hy, px, locked);
    const lw = 18 * px, lh = 9 * px, cx = x + w / 2;
    // top loop
    s += `<path d="M${cx - lw / 2} ${y} v${-lh} h${lw} v${lh}" fill="#fff" stroke="#000" stroke-width="${px}"/>`;
    if (!isFirst) s += plus(cx, y - lh / 2, px);
    // bottom loop
    s += `<path d="M${cx - lw / 2} ${y + h} v${lh} h${lw} v${-lh}" fill="#fff" stroke="#000" stroke-width="${px}"/>`;
    if (isLast && lay.overflow) s += `<path d="M${cx - 5 * px} ${y + h + 2 * px} h${10 * px} l${-5 * px} ${6 * px}z" fill="#e01b1b"/>`;
    else if (!isLast) s += plus(cx, y + h + lh / 2, px);
    return s + '</g>';
  };
  const plus = (cx, cy, px) => `<path d="M${cx - 4 * px} ${cy}h${8 * px}M${cx} ${cy - 4 * px}v${8 * px}" stroke="#000" stroke-width="${1.4 * px}"/>`;

  // where is a text position on screen?  returns {line, it, p, x, top, h}
  App.locate = function (sid, pos) {
    const story = App.doc.stories[sid];
    if (!story) return null;
    const lay = App.layoutFor(story);
    let line = null;
    for (const l of lay.lines) {
      if (l.para !== pos.p) continue;
      if (pos.o >= l.s && (pos.o < l.e || (l.paraEnd && pos.o <= l.e))) { line = l; break; }
      if (pos.o === l.e && !l.paraEnd) line = l; // fallback, may be replaced by next line
    }
    if (!line) return null;
    const it = App.doc.items[line.frame];
    const p = it && App.itemPlacement(it);
    const x = L.caretX(App.doc, story, line, pos.o, App.pageTextForStory(story));
    return { line, it, p, x, top: line.top, h: line.h, story };
  };

  App.textSelectionSVG = function (px) {
    const { sid, a, f } = App.sel;
    const story = App.doc.stories[sid];
    if (!story) return '';
    let s = '';
    const [x0, x1] = T.order(a, f);
    if (T.cmp(x0, x1) === 0) {
      const loc = App.locate(sid, f);
      if (loc && loc.p) {
        const X = loc.p.x0 + loc.it.x + loc.x;
        const top = loc.it.y + loc.top + loc.h * 0.08;
        s += `<line class="caret" x1="${X}" y1="${top}" x2="${X}" y2="${top + loc.h * 0.86}" stroke="#000" stroke-width="${Math.max(px, 0.6)}"/>`;
        App.caretClient = App.spreadToClient(X, top + loc.h);
      }
      return s;
    }
    const lay = App.layoutFor(story);
    const pt = App.pageTextForStory(story);
    for (const l of lay.lines) {
      if (l.para < x0.p || l.para > x1.p) continue;
      const ls = l.s, le = l.e;
      const s0 = l.para === x0.p ? Math.max(ls, x0.o) : ls;
      const e0 = l.para === x1.p ? Math.min(le, x1.o) : le;
      const includesBreak = l.paraEnd && l.para < x1.p;
      if (e0 < s0 || (e0 === s0 && !includesBreak)) continue;
      if (l.para === x0.p && x0.o > le && !(l.paraEnd && x0.o === le)) continue;
      const it = App.doc.items[l.frame];
      const p = App.itemPlacement(it);
      if (!p) continue;
      const xa = L.caretX(App.doc, story, l, s0, pt);
      let xb = L.caretX(App.doc, story, l, e0, pt);
      if (includesBreak) xb += 4;
      s += `<rect x="${p.x0 + it.x + xa}" y="${it.y + l.top}" width="${Math.max(xb - xa, px)}" height="${l.h}" fill="#000" style="mix-blend-mode:difference" opacity="1" fill-opacity="1"/>`;
    }
    // use invert look like PageMaker
    return `<g style="mix-blend-mode:difference">${s.replace(/fill="#000"/g, 'fill="#fff"')}</g>`;
  };

  App.positionIME = function () {
    const ime = $('ime');
    if (App.sel.kind === 'text' && App.caretClient) {
      ime.style.left = Math.round(App.caretClient.x) + 'px';
      ime.style.top = Math.round(App.caretClient.y - 18) + 'px';
    } else ime.style.left = '-9999px';
  };

  // ------------------------------------------------------------------ page icons
  App.renderPageIcons = function () {
    const doc = App.doc;
    const box = $('page-icons');
    const cur = App.view.master ? new Set() : new Set(BV.spreads(doc)[App.view.spread] || []);
    const facing = doc.setup.doubleSided && doc.setup.facing;
    let h = '';
    const mn = App.view.master ? BV.masterName(doc, App.masterId()) : 'master pages';
    h += facing ? `<button class="pgicon master L${App.view.master ? ' on' : ''}" data-m="1" title="Left ${BV.Render.esc(mn)}">L</button><button class="pgicon master${App.view.master ? ' on' : ''}" data-m="1" title="Right ${BV.Render.esc(mn)}">R</button>` : `<button class="pgicon master${App.view.master ? ' on' : ''}" data-m="1" title="${BV.Render.esc(mn)}">M</button>`;
    h += '<span class="pgsep"></span>';
    doc.pages.forEach((p, i) => {
      h += `<button class="pgicon ${BV.pageSide(doc, i)}${cur.has(i) ? ' on' : ''}" data-i="${i}" title="Page ${BV.pageLabel(doc, i)}">${BV.pageLabel(doc, i)}</button>`;
    });
    if (box.dataset.sig !== h) { box.innerHTML = h; box.dataset.sig = h; const on = box.querySelector('.pgicon.on:not(.master)'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };

  // ------------------------------------------------------------------ rulers
  App.drawRulers = function () {
    if (!App.doc || !App.showRulers) return;
    const s = App.scale();
    const u = App.doc.setup.units;
    const unit = BV.UNITS[u];
    const board = $('board');
    const svgR = $('spread').getBoundingClientRect();
    const facing = App.placements.length === 2;
    const originX = App.zeroPt ? App.zeroPt.x : facing ? App.doc.setup.w : App.placements[0] ? App.placements[0].x0 : 0;
    const originY = App.zeroPt ? App.zeroPt.y : 0;
    const steps = { mm: [1, 5, 10], cm: [0.1, 0.5, 1], in: [0.125, 0.5, 1], pc: [1, 6, 6], pt: [6, 36, 72] }[u];
    let [minor, mid, major] = steps;
    // keep ticks readable at low zoom
    while (minor * unit * s < 4) { minor *= 2; mid *= 2; major *= 2; }
    const draw = (cv, horiz) => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const len = horiz ? r.width : r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      const cs = getComputedStyle(document.documentElement);
      const cv_ = (k, d) => (cs.getPropertyValue(k) || d).trim();
      g.fillStyle = cv_('--ruler-bg', '#f3f3f3'); g.fillRect(0, 0, r.width, r.height);
      g.strokeStyle = cv_('--ruler-tick', '#777'); g.fillStyle = cv_('--ruler-text', '#444'); g.font = '500 9px "Inter UI", Segoe UI, sans-serif'; g.lineWidth = 1;
      const zero = horiz ? svgR.left - r.left + (originX + App.pad.x) * s : svgR.top - r.top + (originY + App.pad.y) * s;
      const startU = Math.floor((-zero / s) / unit / minor) * minor;
      const endU = ((len - zero) / s) / unit;
      g.beginPath();
      for (let v = startU; v <= endU; v += minor) {
        const pos = Math.round(zero + v * unit * s) + 0.5;
        const isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        const isMid = Math.abs(v / mid - Math.round(v / mid)) < 1e-6;
        const t = isMaj ? 12 : isMid ? 7 : 4;
        const thick = horiz ? 22 : 22;
        if (horiz) { g.moveTo(pos, thick); g.lineTo(pos, thick - t); } else { g.moveTo(thick, pos); g.lineTo(thick - t, pos); }
        if (isMaj) {
          const label = String(Math.round(Math.abs(v) * 1000) / 1000);
          if (horiz) g.fillText(label, pos + 2, 9);
          else { g.save(); g.translate(9, pos + 2); g.rotate(-Math.PI / 2); g.fillText(label, -g.measureText(label).width - 2, 0); g.restore(); }
        }
      }
      g.stroke();
      // mouse marker
      if (App.mouseSpread) {
        g.strokeStyle = cv_('--ruler-mark', '#d01010');
        g.beginPath();
        const m = horiz ? svgR.left - r.left + (App.mouseSpread.x + App.pad.x) * s : svgR.top - r.top + (App.mouseSpread.y + App.pad.y) * s;
        if (horiz) { g.moveTo(m + 0.5, 0); g.lineTo(m + 0.5, 22); } else { g.moveTo(0, m + 0.5); g.lineTo(22, m + 0.5); }
        g.stroke();
      }
    };
    draw($('ruler-h'), true);
    draw($('ruler-v'), false);
    void board;
  };

  App.currentParaProps = function () {
    if (App.sel.kind === 'text') {
      const st = App.doc.stories[App.sel.sid];
      const para = st && st.paras[App.sel.f.p];
      if (!para) return null;
      const pp = BV.paraProps(App.doc, para);
      const run = App.typingAttrs ? Object.assign(T.attrsAt(para, App.sel.f.o), App.typingAttrs) : T.attrsAt(para, T.cmp(App.sel.a, App.sel.f) !== 0 ? T.order(App.sel.a, App.sel.f)[0].o + 1 : App.sel.f.o);
      return { style: para.style, pp, cp: BV.charProps(pp, run) };
    }
    if (App.sel.kind === 'items') {
      const it = App.doc.items[App.sel.ids[0]];
      if (it && it.type === 'text' && App.doc.stories[it.storyId]) {
        const para = App.doc.stories[it.storyId].paras[0];
        const pp = BV.paraProps(App.doc, para);
        return { style: para.style, pp, cp: BV.charProps(pp, para.runs[0]) };
      }
    }
    const pp = App.doc.styles[App.defaultStyle] || Object.values(App.doc.styles)[0];
    return { style: App.defaultStyle, pp, cp: BV.charProps(pp, {}) };
  };

  // ------------------------------------------------------------------ tools
  App.setTool = function (t) {
    if (App.tool === 'text' && t !== 'text') App.leaveText();
    App.tool = t;
    if (t !== 'pointer') App.altTool = t;
    document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    $('board').className = 'tool-' + t + (App.loaded ? ' loaded' : '');
    App.polyDraft = null;
    App.render();
  };
  App.setLoaded = function (l) {
    App.loaded = l;
    $('board').classList.toggle('loaded', !!l);
    if (l) BV.UI.status(l.kind === 'image' ? 'Loaded graphic: click to place it.' : 'Loaded text: click to place · Shift-click semi-autoflow · Ctrl-click autoflow · Esc cancels', 0);
    else BV.UI.status('');
    App.render();
  };
  // leaving text editing: remove empty fresh frames
  App.leaveText = function () {
    if (App.sel.kind !== 'text') return;
    const story = App.doc.stories[App.sel.sid];
    if (story && story.frames.length === 1) {
      const it = App.doc.items[story.frames[0]];
      const empty = story.paras.length === 1 && !T.paraText(story.paras[0]);
      if (it && it.fresh && empty) { delete App.doc.items[it.id]; delete App.doc.stories[story.id]; App.markAll(); }
    }
    for (const it of Object.values(App.doc.items)) delete it.fresh;
    App.sel = { kind: 'none' };
    App.typingAttrs = null;
  };

  App.nextZ = () => Math.max(0, ...Object.values(App.doc.items).map((i) => i.z || 0)) + 1;

  // delete items (text flows to remaining frames)
  App.deleteItems = function (ids) {
    for (const id of ids) {
      const it = App.doc.items[id];
      if (!it) continue;
      if (it.type === 'text') {
        const st = App.doc.stories[it.storyId];
        if (st) {
          st.frames = st.frames.filter((f) => f !== id);
          if (!st.frames.length) delete App.doc.stories[st.id];
        }
      }
      delete App.doc.items[id];
    }
  };

  // ------------------------------------------------------------------ fonts
  App.loadFonts = async function () {
    const samples = ['ಕನ್ನಡ ಸಂಗೀತ', 'संस्कृतम्', 'āīūṛṣṇḥṃ Abc'];
    const jobs = [];
    for (const f of BV.BUNDLED_FONTS) for (const w of ['400', '700']) for (const t of samples) jobs.push(document.fonts.load(`${w} 12px "${f}"`, t).catch(() => {}));
    jobs.push(document.fonts.load('italic 400 12px "Noto Serif"', 'āīūṛṣṇ Abc').catch(() => {}));
    await Promise.all(jobs);
    await document.fonts.ready;
    L.clearCache();
    if (App.loadSystemFonts) await App.loadSystemFonts();
    if (App.doc && App.ensureFonts) await App.ensureFonts(App.docFonts());
  };
  document.fonts.addEventListener('loadingdone', () => { L.clearCache(); if (App.doc) { App.markAll(); App.render(); } });

  window.addEventListener('resize', () => { if (App.doc) { if (App.view.fit) App.fitZoom(); else App.render(); } });
})();
