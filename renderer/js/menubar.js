/* BV Mudrana: the title bar and PageMaker's menus, drawn in the window (not the browser-style system menu),
   with keyboard shortcuts, Alt access keys, submenus, and custom tooltips. */
(function () {
  const App = window.App;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let template = [];
  let stack = []; // open popups: {el, items, sel, parentIdx}
  let barIdx = -1; // which top-level menu is open (or focused in Alt mode)
  let altMode = false;
  let altArmed = false;
  let hoverTimer = 0;

  // ---------------------------------------------------------------- labels and accelerators
  const label = (l, showMn) => {
    let s = esc(String(l || '').replace(/&&/g, '\u0001'));
    s = s.replace(/&amp;(.)/, showMn ? '<u>$1</u>' : '$1').replace(/&amp;/g, '');
    return s.replace(/\u0001/g, '&amp;');
  };
  const mnemonic = (l) => { const m = String(l || '').replace(/&&/g, '').match(/&(.)/); return m ? m[1].toLowerCase() : String(l || '').trim()[0]?.toLowerCase(); };
  const accelText = (a) => (a ? a.replace(/CmdOrCtrl|CommandOrControl/g, 'Ctrl').replace(/\+Plus$/, '++').replace(/Space$/, 'Space') : '');
  const CODES = {
    '=': ['Equal', 'NumpadAdd'], Plus: ['Equal', 'NumpadAdd'], '-': ['Minus', 'NumpadSubtract'], '.': ['Period'], ',': ['Comma'], ']': ['BracketRight'], '[': ['BracketLeft'],
    '\\': ['Backslash', 'IntlBackslash'], "'": ['Quote'], ';': ['Semicolon'], '/': ['Slash'], Space: ['Space'], PageUp: ['PageUp'], PageDown: ['PageDown'], Home: ['Home'], End: ['End'],
    Backspace: ['Backspace'], Delete: ['Delete'], Tab: ['Tab'], Enter: ['Enter', 'NumpadEnter'], Esc: ['Escape'], Escape: ['Escape'], Up: ['ArrowUp'], Down: ['ArrowDown'], Left: ['ArrowLeft'], Right: ['ArrowRight'],
  };
  function parseAccel(a) {
    const parts = a.split('+');
    let key = parts.pop();
    if (key === '' && parts[parts.length - 1] === '') { parts.pop(); key = '+'; }
    const mods = new Set(parts.map((p) => p.toLowerCase()));
    let codes;
    if (/^[A-Za-z]$/.test(key)) codes = ['Key' + key.toUpperCase()];
    else if (/^[0-9]$/.test(key)) codes = ['Digit' + key, 'Numpad' + key];
    else if (/^F\d{1,2}$/.test(key)) codes = [key];
    else codes = CODES[key] || [key];
    return { ctrl: mods.has('cmdorctrl') || mods.has('ctrl') || mods.has('control') || mods.has('commandorcontrol'), alt: mods.has('alt'), shift: mods.has('shift'), anyShift: key === 'Plus', codes };
  }
  let accelList = [];
  function indexAccels() {
    accelList = [];
    const walk = (items) => {
      for (const it of items) {
        if (it.submenu) walk(it.submenu);
        if (!it.accel || it.noAccel || !it.cmd) continue;
        if (/^role:(cut|copy|paste)$/.test(it.cmd)) continue; // Chromium does these itself
        accelList.push(Object.assign(parseAccel(it.accel), { it }));
      }
    };
    walk(template);
  }
  function matchAccel(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    for (const a of accelList) {
      if (a.ctrl !== ctrl || a.alt !== e.altKey) continue;
      if (!a.anyShift && a.shift !== e.shiftKey) continue;
      if (a.codes.includes(e.code)) return a.it;
    }
    return null;
  }

  // ---------------------------------------------------------------- running a command
  function run(it) {
    closeAll();
    if (!it || !it.cmd || it.enabled === false) return;
    const cmd = it.cmd;
    if (cmd.startsWith('role:')) return native.menuRole(cmd.slice(5));
    if (cmd.startsWith('theme:')) return App.setTheme(cmd.slice(6));
    App.command(cmd, it.arg);
  }

  // ---------------------------------------------------------------- menu bar
  function renderBar() {
    const bar = $('menubar');
    bar.innerHTML = template.map((m, i) => `<button class="mb-item${i === barIdx ? ' on' : ''}" role="menuitem" aria-haspopup="true" aria-expanded="${i === barIdx && stack.length ? 'true' : 'false'}" data-i="${i}" tabindex="-1">${label(m.label, altMode)}</button>`).join('');
  }
  function itemHTML(it, i, showMn) {
    if (it.sep) return '<div class="mi-sep" role="separator"></div>';
    const dis = it.enabled === false ? ' disabled' : '';
    const check = it.check ? `<span class="mi-check${it.checked ? ' on' : ''}" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>` : '<span class="mi-check" aria-hidden="true"></span>';
    const right = it.submenu ? '<span class="mi-arrow" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg></span>' : `<span class="mi-accel">${esc(accelText(it.accel))}</span>`;
    const sub = it.sublabel ? `<span class="mi-sub">${esc(it.sublabel)}</span>` : '';
    return `<div class="mi${dis}${it.submenu ? ' has-sub' : ''}" role="${it.check ? 'menuitemcheckbox' : 'menuitem'}"${it.check ? ` aria-checked="${!!it.checked}"` : ''} data-i="${i}">${check}<span class="mi-label">${label(it.label, showMn)}${sub}</span>${right}</div>`;
  }
  function openPopup(items, x, y, level, anchorRect) {
    while (stack.length > level) stack.pop().el.remove();
    const el = document.createElement('div');
    el.className = 'menu-pop';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => itemHTML(it, i, altMode)).join('');
    document.body.appendChild(el);
    const r = el.getBoundingClientRect();
    let left = x, top = y;
    if (left + r.width > window.innerWidth - 6) left = anchorRect && level > 0 ? anchorRect.left - r.width + 4 : window.innerWidth - r.width - 6;
    if (top + r.height > window.innerHeight - 6) top = Math.max(6, window.innerHeight - r.height - 6);
    el.style.left = Math.max(4, left) + 'px';
    el.style.top = top + 'px';
    const entry = { el, items, sel: -1 };
    stack.push(entry);
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('mousemove', (e) => {
      const mi = e.target.closest('.mi');
      if (!mi) return;
      const i = +mi.dataset.i;
      if (entry.sel === i) return;
      setSel(entry, i);
      clearTimeout(hoverTimer);
      const it = items[i];
      hoverTimer = setTimeout(() => { if (it.submenu && it.enabled !== false) openSub(entry, i); else while (stack.length > stack.indexOf(entry) + 1) stack.pop().el.remove(); }, 140);
    });
    el.addEventListener('click', (e) => {
      const mi = e.target.closest('.mi');
      if (!mi || mi.classList.contains('disabled')) return;
      const it = items[+mi.dataset.i];
      if (it.submenu) { openSub(entry, +mi.dataset.i); return; }
      run(it);
    });
    requestAnimationFrame(() => el.classList.add('in'));
    return entry;
  }
  function setSel(entry, i) {
    entry.sel = i;
    entry.el.querySelectorAll('.mi').forEach((m) => m.classList.toggle('sel', +m.dataset.i === i));
  }
  function openSub(entry, i) {
    const lvl = stack.indexOf(entry) + 1;
    const mi = entry.el.querySelector(`.mi[data-i="${i}"]`);
    const r = mi.getBoundingClientRect();
    const sub = openPopup(entry.items[i].submenu, r.right - 4, r.top - 5, lvl, r);
    return sub;
  }
  function openBar(i, focusFirst) {
    closeAll(true);
    barIdx = i;
    renderBar();
    const b = $('menubar').querySelector(`[data-i="${i}"]`);
    let r = b.getBoundingClientRect();
    if (!r.width) { // the menu bar is hidden (Word style and Basic modes): drop the menu from the visible menu button
      const alt = [...document.querySelectorAll('[data-menu-btn]')].find((x) => x.getClientRects().length);
      r = alt ? alt.getBoundingClientRect() : { left: 8, bottom: 36 };
    }
    const p = openPopup(template[i].submenu || [], r.left, r.bottom + 4, 0);
    if (focusFirst) { const k = p.items.findIndex((it) => !it.sep && it.enabled !== false); if (k >= 0) setSel(p, k); }
    renderBar();
  }
  function closeAll(keepBar) {
    clearTimeout(hoverTimer);
    while (stack.length) stack.pop().el.remove();
    if (!keepBar) { barIdx = -1; altMode = false; }
    renderBar();
  }
  App.closeMenus = () => closeAll();
  // opens a list of menu items (the same look and keyboard handling as the menu bar) at a point
  App.openMenuItems = (items, x, y) => { closeAll(true); const p = openPopup(items, x, y, 0); return p; };
  App.menuIndex = (name) => template.findIndex((m) => m.label.replace(/&/g, '').toLowerCase() === String(name).toLowerCase());
  App.menusOpen = () => stack.length > 0;

  function step(entry, dir) {
    const n = entry.items.length;
    let i = entry.sel;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      const it = entry.items[i];
      if (!it.sep && it.enabled !== false) { setSel(entry, i); return; }
    }
  }

  // ---------------------------------------------------------------- keyboard
  function onKeyDown(e) {
    if (e.key === 'Alt') { altArmed = !e.repeat; return; }
    altArmed = false;
    if (stack.length || altMode) {
      const top = stack[stack.length - 1];
      const k = e.key;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 'Escape') { stop(); if (stack.length > 1) stack.pop().el.remove(); else closeAll(); return; }
      if (!stack.length) {
        // Alt mode: only the bar is highlighted
        if (k === 'ArrowLeft' || k === 'ArrowRight') { stop(); barIdx = (barIdx + (k === 'ArrowRight' ? 1 : -1) + template.length) % template.length; renderBar(); return; }
        if (k === 'Enter' || k === 'ArrowDown' || k === ' ') { stop(); openBar(Math.max(0, barIdx), true); return; }
        const j = template.findIndex((m) => mnemonic(m.label) === k.toLowerCase());
        if (j >= 0) { stop(); openBar(j, true); return; }
        closeAll();
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowUp') { stop(); step(top, k === 'ArrowDown' ? 1 : -1); return; }
      if (k === 'ArrowRight') {
        stop();
        const it = top.items[top.sel];
        if (it && it.submenu) { const s = openSub(top, top.sel); step(s, 1); } else openBar((barIdx + 1) % template.length, true);
        return;
      }
      if (k === 'ArrowLeft') { stop(); if (stack.length > 1) stack.pop().el.remove(); else openBar((barIdx - 1 + template.length) % template.length, true); return; }
      if (k === 'Enter' || k === ' ') {
        stop();
        const it = top.items[top.sel];
        if (!it) return;
        if (it.submenu) { const s = openSub(top, top.sel); step(s, 1); } else run(it);
        return;
      }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey) {
        stop();
        const lc = k.toLowerCase();
        const hits = top.items.map((it, i) => (!it.sep && it.enabled !== false && mnemonic(it.label) === lc ? i : -1)).filter((i) => i >= 0);
        if (hits.length === 1) { const it = top.items[hits[0]]; setSel(top, hits[0]); if (it.submenu) { const s = openSub(top, hits[0]); step(s, 1); } else run(it); }
        else if (hits.length) setSel(top, hits.find((i) => i > top.sel) ?? hits[0]);
        return;
      }
      if (e.altKey || e.ctrlKey) closeAll();
      else return;
    }
    // Alt + access key opens a menu (Alt+F = File …)
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^Key[A-Z]$/.test(e.code)) {
      const ch = e.code.slice(3).toLowerCase();
      const j = template.findIndex((m) => mnemonic(m.label) === ch);
      if (j >= 0 && !document.querySelector('#modal-root .dlg')) { e.preventDefault(); e.stopPropagation(); altMode = true; openBar(j, true); return; }
    }
    // keyboard shortcuts
    if (document.querySelector('#modal-root .dlg')) return; // a dialog is open: its own keys only
    const it = matchAccel(e);
    if (it && it.enabled !== false) {
      e.preventDefault();
      e.stopPropagation();
      run(it);
    }
  }
  function onKeyUp(e) {
    if (e.key === 'Alt' && altArmed) {
      altArmed = false;
      e.preventDefault();
      if (stack.length || altMode) { closeAll(); return; }
      if (document.querySelector('#modal-root .dlg')) return;
      altMode = true; barIdx = 0; renderBar();
    }
  }

  // ---------------------------------------------------------------- title
  function syncTitle() {
    const el = $('tb-title');
    if (!el || !App.doc) return;
    const name = App.docName || (App.filePath ? App.filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'Untitled');
    const owner = App.titleOwner ? App.titleOwner() : '';
    const t = `${owner}|${App.dirty ? '● ' : ''}${name}`;
    if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = `${App.userName ? `<span class="tb-owner">${esc(owner)}</span><span class="tb-sep">·</span>` : ''}<span class="tb-doc">${esc(name)}</span>${App.dirty ? '<span class="tb-dirty" title="Not saved">●</span>' : ''}`; }
  }

  // ---------------------------------------------------------------- tooltips (instead of the browser's yellow ones)
  function initTips() {
    const tip = document.createElement('div');
    tip.id = 'tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let timer = 0, cur = null;
    const hide = () => { clearTimeout(timer); tip.classList.remove('in'); cur = null; };
    document.addEventListener('mouseover', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[title], [data-tip]') : null;
      if (!el || el === cur) return;
      if (el.closest('.dlg') && !el.closest('.mini,.tb,.tool')) return;
      if (el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
      if (!el.dataset.tip) return;
      cur = el;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (cur !== el || !el.isConnected) return;
        const [main, ...rest] = el.dataset.tip.split(/ \(|\s—\s/);
        const keys = (el.dataset.tip.match(/\(([^)]+)\)\s*$/) || [])[1];
        tip.innerHTML = `<span>${esc(keys ? el.dataset.tip.replace(/\s*\([^)]+\)\s*$/, '') : el.dataset.tip)}</span>${keys ? `<kbd>${esc(keys)}</kbd>` : ''}`;
        void main; void rest;
        const r = el.getBoundingClientRect();
        tip.classList.add('in');
        const tr = tip.getBoundingClientRect();
        let x = r.left + r.width / 2 - tr.width / 2, y = r.bottom + 8;
        if (y + tr.height > window.innerHeight - 4) y = r.top - tr.height - 8;
        tip.style.left = Math.max(6, Math.min(window.innerWidth - tr.width - 6, x)) + 'px';
        tip.style.top = y + 'px';
      }, 450);
    });
    document.addEventListener('mouseout', (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
    document.addEventListener('mousedown', hide, true);
  }

  // ---------------------------------------------------------------- theme
  if (!App.setTheme) App.setTheme = function (t) {
    t = t === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('bv.theme', JSON.stringify(t)); } catch (_) {}
    if (window.native && native.chromeTheme) native.chromeTheme(t);
    if (window.native) native.menuState({ themeDark: t === 'dark', themeLight: t === 'light' });
    if (App.doc) { App.render && App.render(); }
  };

  App.menuTemplate = () => template;
  App.runMenuItem = (it) => run(it);
  App.accelText = accelText;
  // ---------------------------------------------------------------- start
  function init() {
    const bar = $('menubar');
    bar.addEventListener('mousedown', (e) => {
      const b = e.target.closest('.mb-item');
      if (!b) return;
      e.preventDefault();
      const i = +b.dataset.i;
      if (stack.length && barIdx === i) closeAll(); else openBar(i, false);
    });
    bar.addEventListener('mouseover', (e) => {
      const b = e.target.closest('.mb-item');
      if (b && stack.length && +b.dataset.i !== barIdx) openBar(+b.dataset.i, false);
    });
    document.addEventListener('mousedown', (e) => { if (stack.length && !e.target.closest('.menu-pop, #menubar, [data-menu-btn]')) closeAll(); }, true);
    window.addEventListener('blur', () => closeAll());
    window.addEventListener('resize', () => closeAll());
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    $('tb-logo').addEventListener('click', () => App.command('about'));
    initTips();
    setInterval(syncTitle, 400);
    let theme = 'dark';
    try { theme = JSON.parse(localStorage.getItem('bv.theme')) || 'dark'; } catch (_) {}
    App.setTheme(theme);
    if (window.native && native.menuTemplate) {
      native.onMenuTemplate((t) => { template = t || []; indexAccels(); if (!stack.length) renderBar(); });
      native.menuTemplate().then((t) => { if (t && t.length) { template = t; indexAccels(); renderBar(); } });
      if (native.platform === 'darwin') document.body.classList.add('mac');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
