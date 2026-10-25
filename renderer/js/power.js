/* BV Mudrana: everyday power features.
   - Find a Command (Ctrl+Enter): type a few letters to run any menu command, apply a style or go to a page
   - Kannada and Devanagari keyboards built in: Nudi / KGP layout and phonetic typing (Scroll Lock switches)
   - Footnotes that sit at the bottom of the text block and renumber themselves
   - Page numbering sections (roman numbers for the front matter, a new start for each part)
   - Automatic saving every two minutes, with recovery after a crash
   - Preview mode, Clean Up Text, smart quotes, and a status-bar warning for text that does not fit */
(function () {
  const BV = window.BV, App = window.App, UI = BV.UI, T = BV.Text;
  const $ = (id) => document.getElementById(id);
  const esc = BV.Render.esc;
  const doc = () => App.doc;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ================================================================== Find a Command
  function paletteItems() {
    const out = [];
    const walk = (items, path) => {
      for (const it of items || []) {
        if (it.sep || it.enabled === false) continue;
        const label = String(it.label || '').replace(/&&/g, '\u0001').replace(/&/g, '').replace(/\u0001/g, '&').replace(/…$/, '');
        if (it.submenu) walk(it.submenu, [...path, label]);
        else if (it.cmd) out.push({ label, path: path.join(' › '), accel: it.accel, run: () => App.runMenuItem(it), kind: 'cmd' });
      }
    };
    walk(App.menuTemplate ? App.menuTemplate() : [], []);
    const d = doc();
    if (d) {
      for (const s of Object.keys(d.styles)) out.push({ label: s, path: 'Paragraph style', run: () => App.applyStyle(s), kind: 'style' });
      for (const s of Object.keys(d.charStyles || {})) out.push({ label: s, path: 'Character style', run: () => App.applyCharStyle && App.applyCharStyle(s), kind: 'style' });
      for (const m of d.masters || []) out.push({ label: m.name, path: 'Go to master page', run: () => App.gotoSpread(0, m.id), kind: 'page' });
    }
    return out;
  }
  function score(item, q) {
    const hay = (item.label + ' ' + item.path).toLowerCase();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let s = 0;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i < 0) return -1;
      s += i === 0 ? 30 : hay[i - 1] === ' ' ? 20 : 5;
    }
    if (item.label.toLowerCase().startsWith(q.toLowerCase())) s += 40;
    if (item.kind === 'cmd') s += 3;
    return s - item.label.length / 50;
  }
  App.openCommandPalette = function () {
    if ($('cmdpal')) return;
    const all = paletteItems();
    const wrap = document.createElement('div');
    wrap.id = 'cmdpal';
    wrap.innerHTML = `<div class="cp-box" role="dialog" aria-label="Find a command"><div class="cp-in"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg><input id="cp-q" placeholder="Type a command, a style, or a page number…" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><div class="cp-list" id="cp-list" role="listbox"></div><div class="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>Enter</kbd> run</span><span>Ctrl+Enter opens this anywhere</span></div></div>`;
    document.body.appendChild(wrap);
    const q = wrap.querySelector('#cp-q'), list = wrap.querySelector('#cp-list');
    let shown = [], sel = 0;
    const draw = () => {
      const v = q.value.trim();
      shown = [];
      if (/^\d+$/.test(v) && doc()) {
        const i = doc().pages.findIndex((_, k) => String(BV.pageNumber(doc(), k)) === v || BV.pageLabel(doc(), k) === v);
        if (i >= 0) shown.push({ label: `Go to page ${BV.pageLabel(doc(), i)}`, path: 'Pages', run: () => App.gotoPage(i), kind: 'page' });
      }
      const recent = App.store.get('cmdRecent', []);
      if (!v) shown.push(...recent.map((l) => all.find((x) => x.label + x.path === l)).filter(Boolean), ...all.filter((x) => x.kind === 'cmd' && !recent.includes(x.label + x.path)).slice(0, 40));
      else shown.push(...all.map((x) => [x, score(x, v)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([x]) => x));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length ? shown.map((x, i) => `<div class="cp-it${i === sel ? ' on' : ''}" data-i="${i}" role="option"><span class="cp-kind ${x.kind}"></span><span class="cp-l">${esc(x.label)}</span><span class="cp-p">${esc(x.path)}</span>${x.accel ? `<kbd>${esc(App.accelText ? App.accelText(x.accel) : x.accel)}</kbd>` : ''}</div>`).join('') : '<div class="cp-empty">Nothing matches. Try other words, for example “master”, “footnote”, “kannada”.</div>';
      const on = list.querySelector('.cp-it.on');
      if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const close = () => { wrap.remove(); if (App.sel.kind === 'text') App.focusIME(); };
    const go = (i) => {
      const x = shown[i];
      if (!x) return;
      close();
      if (x.kind === 'cmd') App.store.set('cmdRecent', [x.label + x.path, ...App.store.get('cmdRecent', []).filter((l) => l !== x.label + x.path)].slice(0, 8));
      setTimeout(() => x.run(), 0);
    };
    q.addEventListener('input', () => { sel = 0; draw(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      e.stopPropagation();
    });
    list.addEventListener('mousemove', (e) => { const it = e.target.closest('.cp-it'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; list.querySelectorAll('.cp-it').forEach((x) => x.classList.toggle('on', +x.dataset.i === sel)); } });
    list.addEventListener('click', (e) => { const it = e.target.closest('.cp-it'); if (it) go(+it.dataset.i); });
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    draw();
    q.focus();
  };

  // ================================================================== built-in keyboards
  // Nudi / KGP layout (Kannada Ganaka Parishat), the layout Kannada typists know from Nudi and Baraha
  const KGP_VOWEL = { a: ['ಅ', ''], A: ['ಆ', 'ಾ'], i: ['ಇ', 'ಿ'], I: ['ಈ', 'ೀ'], u: ['ಉ', 'ು'], U: ['ಊ', 'ೂ'], R: ['ಋ', 'ೃ'], e: ['ಎ', 'ೆ'], E: ['ಏ', 'ೇ'], Y: ['ಐ', 'ೈ'], o: ['ಒ', 'ೊ'], O: ['ಓ', 'ೋ'], V: ['ಔ', 'ೌ'] };
  const KGP_CONS = { k: 'ಕ', K: 'ಖ', g: 'ಗ', G: 'ಘ', Z: 'ಙ', c: 'ಚ', C: 'ಛ', j: 'ಜ', J: 'ಝ', z: 'ಞ', q: 'ಟ', Q: 'ಠ', w: 'ಡ', W: 'ಢ', N: 'ಣ', t: 'ತ', T: 'ಥ', d: 'ದ', D: 'ಧ', n: 'ನ', p: 'ಪ', P: 'ಫ', b: 'ಬ', B: 'ಭ', m: 'ಮ', y: 'ಯ', r: 'ರ', l: 'ಲ', v: 'ವ', S: 'ಶ', x: 'ಷ', s: 'ಸ', h: 'ಹ', L: 'ಳ' };
  const KGP_OTHER = { f: '್', M: 'ಂ', H: 'ಃ', F: 'ೞ', X: '಼' };
  const isCons = (ch) => !!ch && ((ch >= 'ಕ' && ch <= 'ಹ') || ch === 'ೞ');
  function kgpOutput(key, prev) {
    if (KGP_CONS[key]) return KGP_CONS[key];
    if (KGP_OTHER[key]) return KGP_OTHER[key];
    const v = KGP_VOWEL[key];
    if (v) return isCons(prev) ? v[1] : v[0];
    return null;
  }
  const KBD = {
    off: { label: 'English', short: 'EN' },
    kgp: { label: 'Kannada, Nudi / KGP layout', short: 'ಕ KGP' },
    knPh: { label: 'Kannada, phonetic (ka = ಕ)', short: 'ಕ Ph' },
    saPh: { label: 'Devanagari, phonetic (ka = क)', short: 'क Ph' },
    iastPh: { label: 'IAST, phonetic (aa = ā)', short: 'ā Ph' },
  };
  App.kbd = 'off';
  let lastKbd = App.store.get('lastKbd', 'kgp');
  let phon = null; // {buf, out, p, o, sid}
  App.setKeyboard = function (m) {
    App.kbd = KBD[m] ? m : 'off';
    if (App.kbd !== 'off') { lastKbd = App.kbd; App.store.set('lastKbd', lastKbd); }
    phon = null;
    const b = $('st-kbd');
    if (b) { b.textContent = KBD[App.kbd].short; b.classList.toggle('on', App.kbd !== 'off'); b.dataset.tip = `Keyboard: ${KBD[App.kbd].label}. Scroll Lock or Ctrl+Alt+K switches. Click to choose.`; }
    UI.status('Keyboard: ' + KBD[App.kbd].label, 2500);
  };
  App.toggleKeyboard = () => App.setKeyboard(App.kbd === 'off' ? lastKbd : 'off');
  function phonConvert(buf) {
    if (App.kbd === 'knPh') return BV.translit.convert(buf, 'itrans', 'knda');
    if (App.kbd === 'saPh') return BV.translit.convert(buf, 'itrans', 'deva');
    return BV.translit.convert(buf, 'itrans', 'iast');
  }
  function onImeKey(e) {
    if (App.kbd === 'off' || App.sel.kind !== 'text' || e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState('AltGraph')) || e.isComposing) return;
    const k = e.key;
    if (k.length !== 1) { if (k !== 'Shift') phon = null; return; }
    const st = doc().stories[App.sel.sid];
    const f = App.sel.f;
    const text = T.paraText(st.paras[f.p]);
    if (App.kbd === 'kgp') {
      const out = kgpOutput(k, text[f.o - 1]);
      if (out === null) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (out) App.insertText(out, { undoKey: 'type' });
      return;
    }
    // phonetic: the word typed so far is converted again with every key
    if (!/[A-Za-z~^.]/.test(k) || (k === '.' && !(phon && phon.buf))) { phon = null; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    const fresh = !phon || phon.sid !== st.id || phon.p !== f.p || phon.o + phon.out.length !== f.o || T.cmp(App.sel.a, App.sel.f) !== 0;
    if (fresh) phon = { buf: '', out: '', p: f.p, o: f.o, sid: st.id };
    phon.buf += k;
    const out = phonConvert(phon.buf).normalize('NFC');
    App.sel = { kind: 'text', sid: st.id, a: { p: f.p, o: phon.o }, f: { p: f.p, o: phon.o + phon.out.length } };
    App.insertText(out, { undoKey: 'type' });
    phon.out = out;
  }
  function onSeKey(e) {
    if (App.kbd !== 'kgp' || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const sel = window.getSelection();
    let prev = '';
    if (sel.rangeCount && sel.anchorNode && sel.anchorNode.nodeType === 3) prev = sel.anchorNode.nodeValue[sel.anchorOffset - 1] || '';
    const out = kgpOutput(e.key, prev);
    if (out === null) return;
    e.preventDefault();
    if (out) document.execCommand('insertText', false, out);
  }
  function kbdMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'menu-pop in';
    m.style.left = Math.max(6, r.right - 280) + 'px';
    m.style.top = r.top - 8 - Object.keys(KBD).length * 28 - 10 + 'px';
    m.innerHTML = Object.entries(KBD).map(([k, v]) => `<div class="mi${k === App.kbd ? ' sel' : ''}" data-k="${k}"><span class="mi-check${k === App.kbd ? ' on' : ''}"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span><span class="mi-label">${esc(v.label)}</span><span class="mi-accel">${v.short}</span></div>`).join('');
    document.body.appendChild(m);
    const close = () => { m.remove(); document.removeEventListener('mousedown', out, true); };
    const out = (e) => { if (!m.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', out, true), 0);
    m.addEventListener('mousedown', (e) => e.preventDefault());
    m.addEventListener('click', (e) => { const it = e.target.closest('[data-k]'); if (it) { App.setKeyboard(it.dataset.k); close(); if (App.sel.kind === 'text') App.focusIME(); } });
  }

  // ================================================================== footnotes
  const fnLabel = (n) => BV.translit.numerals(n, /kannada|devanagari/.test(doc().setup.numbering) ? doc().setup.numbering : 'arabic');
  const fnCache = new Map();
  App.footnoteLayout = function (id, w) {
    const d = App.doc;
    const fn = d.footnotes && d.footnotes[id];
    if (!fn) return { h: 0 };
    const key = `${id}|${Math.round(w * 10)}|${fn.num}|${JSON.stringify(fn.paras)}|${JSON.stringify(d.styles.Footnote || 0)}|${d.setup.numbering}`;
    const hit = fnCache.get(key);
    if (hit) return hit;
    const paras = clone(fn.paras);
    const style = d.styles.Footnote ? 'Footnote' : Object.keys(d.styles)[0];
    paras.forEach((p) => { if (!d.styles[p.style]) p.style = style; });
    paras[0].runs.unshift({ t: fnLabel(fn.num || 1), pos: 'sup' }, { t: ' ' });
    const tmp = Object.create(d);
    tmp.items = { __fn: { id: '__fn', type: 'text', x: 0, y: 0, w, h: 100000 } };
    const lay = BV.Layout.layoutStory(tmp, { id: 'fn_' + id, paras, frames: ['__fn'] }, {});
    const fl = lay.frames.__fn;
    const res = { fl, h: fl.usedH + 1 };
    if (fnCache.size > 2000) fnCache.clear();
    fnCache.set(key, res);
    return res;
  };
  App.renumberFootnotes = function (st) {
    const d = doc();
    if (!d.footnotes) return false;
    let n = 0, changed = false;
    for (const p of st.paras) {
      let pc = false;
      for (const r of p.runs) {
        if (!r.fn) continue;
        n++;
        const lbl = fnLabel(n);
        if (r.t !== lbl) { r.t = lbl; pc = true; }
        if (d.footnotes[r.fn] && d.footnotes[r.fn].num !== n) { d.footnotes[r.fn].num = n; changed = true; }
      }
      if (pc) { p.runs = p.runs.slice(); changed = true; }
    }
    return changed;
  };
  const storyHasNotes = (st) => st.paras.some((p) => p.runs.some((r) => r.fn));
  function fnAtCaret() {
    if (App.sel.kind !== 'text') return null;
    const st = doc().stories[App.sel.sid];
    const para = st.paras[App.sel.f.p];
    let off = 0;
    for (const r of para.runs) {
      const a = off, b = off + r.t.length;
      off = b;
      if (r.fn && App.sel.f.o >= a && App.sel.f.o <= b) return r.fn;
    }
    return null;
  }
  async function footnoteDialog() {
    if (App.sel.kind !== 'text') return UI.status('Click in the text where the footnote number should go.');
    const d = doc();
    d.footnotes = d.footnotes || {};
    const editId = fnAtCaret();
    const cur = editId ? d.footnotes[editId] : null;
    const r = await UI.dialog({
      title: editId ? `Edit Footnote ${cur.num || ''}` : 'Insert Footnote',
      width: 560,
      html: `<textarea id="fn-t" rows="6" style="width:100%;font-size:15px;line-height:1.7" lang="kn" placeholder="Footnote text">${esc(cur ? cur.paras.map(T.paraText).join('\n') : '')}</textarea>
        <p class="note">The number is put at the cursor and the note goes to the bottom of the same text block, in the “Footnote” style. Numbers follow the order in the story and update by themselves. ${editId ? '' : 'To edit a note later, click just after its number and choose this command again.'}</p>`,
      buttons: editId ? [{ label: 'Save', value: 'ok', primary: true }, { label: 'Delete footnote', value: 'del' }, { label: 'Cancel', value: null }] : [{ label: 'Insert', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return App.focusIME();
    const txt = r.el.querySelector('#fn-t').value.replace(/\r/g, '');
    const st = d.stories[App.sel.sid];
    App.checkpoint();
    if (editId && r.value === 'del') {
      for (const p of st.paras) { const n0 = p.runs.length; p.runs = p.runs.filter((x) => x.fn !== editId); if (p.runs.length !== n0) T.normalize(p); }
      delete d.footnotes[editId];
      App.sel = { kind: 'text', sid: st.id, a: { ...App.sel.f, o: Math.min(App.sel.f.o, T.paraText(st.paras[App.sel.f.p]).length) }, f: { ...App.sel.f, o: Math.min(App.sel.f.o, T.paraText(st.paras[App.sel.f.p]).length) } };
    } else {
      const paras = (txt.trim() ? txt : ' ').split('\n').map((t) => ({ style: 'Footnote', runs: [{ t: t.normalize('NFC') }] }));
      if (editId) d.footnotes[editId].paras = paras;
      else {
        const id = BV.newId(d, 'fn');
        d.footnotes[id] = { paras, num: 0 };
        const keep = App.typingAttrs;
        App.typingAttrs = Object.assign({}, keep || {}, { fn: id, pos: 'sup' });
        App.insertText('0', { undoKey: 'footnote', footnote: true });
        App.typingAttrs = Object.assign({}, keep || {}, { fn: undefined, pos: undefined });
      }
    }
    App.renumberFootnotes(st);
    App.markStory(st.id);
    App.changed(st.id);
    App.focusIME();
  }

  // ================================================================== page numbering sections
  const baseLabel = BV.pageLabel;
  BV.pageLabel = function (d, idx) {
    let j = idx;
    while (j >= 0 && !(d.pages[j] && d.pages[j].section)) j--;
    if (j < 0) return baseLabel(d, idx);
    const s = d.pages[j].section;
    return (s.prefix || '') + BV.translit.numerals((s.start || 1) + (idx - j), s.style || d.setup.numbering);
  };
  async function sectionDialog() {
    const d = doc();
    const pl = App.placements.find((p) => p.idx >= 0);
    if (!pl) return UI.status('Go to a page first.');
    const idx = pl.idx, pg = d.pages[idx];
    const s = pg.section || { style: d.setup.numbering, start: 1, prefix: '' };
    const styles = [['arabic', '1, 2, 3'], ['kannada', '೧, ೨, ೩'], ['devanagari', '१, २, ३'], ['lowerroman', 'i, ii, iii'], ['upperroman', 'I, II, III'], ['loweralpha', 'a, b, c'], ['upperalpha', 'A, B, C']];
    const r = await UI.dialog({
      title: `Numbering and Sections: page ${BV.pageLabel(d, idx)}`,
      html: `<label class="check"><input type="checkbox" id="sc-on" ${pg.section ? 'checked' : ''}> Start a new section on this page</label>
        <div class="row"><label for="sc-st">Numbers</label><select id="sc-st">${styles.map(([v, l]) => `<option value="${v}"${v === s.style ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="row"><label for="sc-n">Start at</label><input type="number" id="sc-n" min="1" value="${s.start || 1}"></div>
        <div class="row"><label for="sc-p">Prefix (optional)</label><input type="text" id="sc-p" value="${esc(s.prefix || '')}" placeholder="for example A-"></div>
        <p class="note">Typical book: roman numbers (i, ii, iii) for the front matter, then a new section at chapter one starting at 1. Page-number markers, running heads, the contents and the index all use these numbers.</p>`,
    });
    if (!r) return;
    App.checkpoint();
    if (!UI.checked(r.el, 'sc-on')) delete pg.section;
    else pg.section = { style: UI.val(r.el, 'sc-st'), start: Math.max(1, Math.round(UI.num(r.el, 'sc-n')) || 1), prefix: UI.val(r.el, 'sc-p') };
    App.markAll();
    App.changed();
  }

  // ================================================================== automatic saving and recovery
  App.autosaveId = 'doc-' + Date.now().toString(36);
  let lastAuto = 0;
  async function autosave() {
    if (!window.native || !native.autosaveWrite || !App.doc || !App.dirty) return;
    try {
      await native.autosaveWrite({ id: App.autosaveId, name: App.docName || (App.filePath ? App.filePath.split(/[\\/]/).pop() : 'Untitled'), path: App.filePath || '', content: BV.serialize(App.doc) });
      lastAuto = Date.now();
    } catch (_) {}
  }
  async function offerRecovery() {
    if (!window.native || !native.autosaveList) return;
    const list = (await native.autosaveList().catch(() => [])).filter((x) => x.id !== App.autosaveId);
    if (!list.length) return;
    const x = list[0];
    const r = await UI.dialog({
      title: 'Recover unsaved work?',
      html: `<p class="note" style="color:var(--ink)">BV Mudrana was closed before <b>${esc(x.name)}</b> was saved. A copy was kept automatically on ${esc(new Date(x.time).toLocaleString())}.</p>${list.length > 1 ? `<p class="note">${list.length - 1} more automatic ${list.length === 2 ? 'copy is' : 'copies are'} kept too; they are offered one at a time.</p>` : ''}`,
      buttons: [{ label: 'Recover', value: 'ok', primary: true }, { label: 'Discard', value: 'del' }, { label: 'Later', value: null }],
    });
    if (!r) return;
    if (r.value === 'del') { await native.autosaveDelete(x.id); return offerRecovery(); }
    const content = await native.autosaveRead(x.id);
    try {
      const d = BV.deserialize(content);
      document.getElementById('welcome').hidden = true;
      App.setDoc(d, x.path || null);
      App.docName = x.name.replace(/\.[^.]+$/, '');
      App.setDirty(true);
      await native.autosaveDelete(x.id);
      UI.status('Recovered ' + x.name + '. Save it now with Ctrl+S.', 10000);
    } catch (e) { UI.alert('That copy could not be read: ' + e.message); }
  }

  // ================================================================== preview, clean up, smart quotes
  let preview = null;
  function togglePreview() {
    if (preview) {
      Object.assign(App, preview);
      preview = null;
      document.body.classList.remove('preview-mode');
    } else {
      preview = { showGuides: App.showGuides, showNonPrinting: App.showNonPrinting };
      App.showGuides = false; App.showNonPrinting = false;
      if (App.sel.kind === 'items') App.sel = { kind: 'none' };
      document.body.classList.add('preview-mode');
    }
    native.menuState({ preview: !!preview, guides: App.showGuides, nonPrinting: App.showNonPrinting });
    App.render();
    UI.status(preview ? 'Preview: guides, frame edges and non-printing items are hidden. Same command to return.' : '', 4000);
  }
  function smartQuotesIn(s) {
    return s
      .replace(/(^|[\s(\[{—–-])"/g, '$1“').replace(/"/g, '”')
      .replace(/(^|[\s(\[{—–-])'/g, '$1‘').replace(/'/g, '’');
  }
  async function cleanUp() {
    let stories = App.selectedStories();
    const scope = stories.length ? 'the selected story' : 'every story in the publication';
    const r = await UI.dialog({
      title: 'Clean Up Text',
      width: 520,
      html: `<p class="note" style="color:var(--ink)">Tidies ${scope}. Each fix can be undone with Ctrl+Z.</p>
        <label class="check"><input type="checkbox" id="cu-sp" checked> Several spaces in a row become one space</label>
        <label class="check"><input type="checkbox" id="cu-ends" checked> Remove spaces at the start and end of paragraphs</label>
        <label class="check"><input type="checkbox" id="cu-punct" checked> Remove the space before , . ; : ? ! ) (English text only)</label>
        <label class="check"><input type="checkbox" id="cu-empty"> Remove empty paragraphs</label>
        <label class="check"><input type="checkbox" id="cu-q" checked> Straight quotes " ' become typographer’s quotes “ ” ‘ ’</label>
        <label class="check"><input type="checkbox" id="cu-zw" checked> Remove doubled invisible joiners (ZWNJ / ZWJ) left by conversions</label>
        <label class="check"><input type="checkbox" id="cu-danda"> Put a space before the danda (।, ॥) as in printed Sanskrit</label>`,
      buttons: [{ label: 'Clean up', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    if (!stories.length) stories = Object.values(doc().stories);
    const o = (id) => UI.checked(r.el, id);
    App.checkpoint();
    let n = 0;
    for (const st of stories) {
      for (const p of st.paras) {
        const before = T.paraText(p);
        for (const run of p.runs) {
          let t = run.t;
          if (o('cu-sp')) t = t.replace(/ {2,}/g, ' ');
          if (o('cu-punct')) t = t.replace(/([A-Za-z0-9]) +([,.;:?!)])/g, '$1$2');
          if (o('cu-q') && !run.fn) t = smartQuotesIn(t);
          if (o('cu-zw')) t = t.replace(/([‌‍])\1+/g, '$1');
          if (o('cu-danda')) t = t.replace(/([^\s])([।॥])/g, '$1 $2');
          run.t = t;
        }
        if (o('cu-ends')) {
          const f = p.runs.find((x) => x.t.length);
          if (f) f.t = f.t.replace(/^[  ]+/, '');
          const l = [...p.runs].reverse().find((x) => x.t.length);
          if (l) l.t = l.t.replace(/[  ]+$/, '');
        }
        p.runs = p.runs.slice();
        T.normalize(p);
        if (T.paraText(p) !== before) n++;
      }
      if (o('cu-empty') && st.paras.length > 1) { const k = st.paras.length; st.paras = st.paras.filter((p) => T.paraText(p).trim() || p.runs.some((x) => x.fn)); if (!st.paras.length) st.paras = [{ style: Object.keys(doc().styles)[0], runs: [{ t: '' }] }]; n += k - st.paras.length; }
      App.markStory(st.id);
    }
    if (App.sel.kind === 'text') { const st = doc().stories[App.sel.sid]; if (st) { const p = Math.min(App.sel.f.p, st.paras.length - 1); const o2 = Math.min(App.sel.f.o, T.paraText(st.paras[p]).length); App.sel = { kind: 'text', sid: st.id, a: { p, o: o2 }, f: { p, o: o2 } }; } }
    App.changed();
    UI.status(n ? `Cleaned up ${n} paragraph${n === 1 ? '' : 's'}.` : 'Nothing needed cleaning up.', 6000);
  }

  // ================================================================== text that does not fit (status bar)
  let overTimer = 0;
  function checkOverset() {
    clearTimeout(overTimer);
    overTimer = setTimeout(() => {
      const b = $('st-over');
      if (!b || !App.doc) return;
      const list = Object.values(App.doc.stories).filter((st) => st.frames.length && !App.isMasterStory(st) && App.layoutFor(st).overflow);
      b.hidden = !list.length;
      b.textContent = `${list.length} overset`;
      b.dataset.tip = `${list.length} ${list.length === 1 ? 'story has' : 'stories have'} text that does not fit its text blocks. Click to go to the next one.`;
      App.oversetList = list;
    }, 700);
  }
  function gotoOverset() {
    const list = App.oversetList || [];
    if (!list.length) return;
    App._overIdx = ((App._overIdx ?? -1) + 1) % list.length;
    const st = list[App._overIdx];
    const it = doc().items[st.frames[st.frames.length - 1]];
    const pi = doc().pages.findIndex((p) => p.id === it.page);
    if (pi >= 0) App.gotoPage(pi);
    if (App.sel.kind === 'text') App.leaveText();
    App.setTool('pointer');
    App.sel = { kind: 'items', ids: [it.id] };
    App.render();
    UI.status('This text block has more text than it can show (red ▼). Make it larger, thread another block, or reduce the size.', 7000);
  }

  // ================================================================== dispatcher and wiring
  const prev = App.command2;
  App.command2 = async function (cmd, arg) {
    switch (cmd) {
      case 'commandPalette': return App.openCommandPalette();
      case 'toggleKeyboard': return App.toggleKeyboard();
      case 'kbd:off': case 'kbd:kgp': case 'kbd:knPh': case 'kbd:saPh': case 'kbd:iastPh': return App.setKeyboard(cmd.slice(4));
      case 'footnote': return footnoteDialog();
      case 'sections': return sectionDialog();
      case 'preview': return togglePreview();
      case 'cleanUp': return cleanUp();
      case 'recover': return offerRecovery();
    }
    if (prev) return prev(cmd, arg);
  };
  // typing just after a footnote number must not continue the number
  const ins = App.insertText;
  App.insertText = function (str, opts = {}) {
    if (!opts.footnote && App.sel.kind === 'text') {
      const st = doc().stories[App.sel.sid];
      const at = st && T.attrsAt(st.paras[App.sel.f.p], App.sel.f.o);
      if (at && at.fn) App.typingAttrs = Object.assign({}, App.typingAttrs || {}, { fn: undefined, pos: undefined });
    }
    return ins.call(this, str, opts);
  };
  const changed = App.changed;
  App.changed = function (sid, ...rest) {
    const r = changed.call(this, sid, ...rest);
    const d = App.doc;
    if (d && d.footnotes && Object.keys(d.footnotes).length) {
      const sts = sid ? [d.stories[sid]].filter(Boolean) : Object.values(d.stories);
      for (const st of sts) if (storyHasNotes(st) && App.renumberFootnotes(st)) { App.markStory(st.id); App.render(); }
    }
    checkOverset();
    return r;
  };
  const setDoc = App.setDoc;
  App.setDoc = function (...a) {
    if (window.native && native.autosaveDelete && App.autosaveId) native.autosaveDelete(App.autosaveId).catch(() => {});
    App.autosaveId = 'doc-' + Date.now().toString(36);
    const r = setDoc.apply(this, a);
    checkOverset();
    return r;
  };
  const sd = App.setDirty;
  App.setDirty = function (v) {
    const r = sd.call(this, v);
    if (!v && window.native && native.autosaveDelete) native.autosaveDelete(App.autosaveId).catch(() => {});
    return r;
  };

  function init() {
    const ime = $('ime');
    if (!ime || !$('status')) return setTimeout(init, 30);
    ime.addEventListener('keydown', onImeKey, true);
    $('se-text').addEventListener('keydown', onSeKey, true);
    // the keyboard chip and the overset warning in the status bar
    const status = $('status');
    status.insertAdjacentHTML('afterbegin', '<button id="st-over" class="st-chip warn" hidden></button><button id="st-kbd" class="st-chip">EN</button>');
    $('st-kbd').addEventListener('mousedown', (e) => e.preventDefault());
    $('st-kbd').addEventListener('click', (e) => kbdMenu(e.currentTarget));
    $('st-over').addEventListener('click', gotoOverset);
    // a search button in the title bar opens Find a Command
    const tb = $('titlebar');
    if (tb && !$('tb-search')) {
      const b = document.createElement('button');
      b.id = 'tb-search';
      b.className = 'tb-search';
      b.innerHTML = '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg><span>Find a command</span><kbd>Ctrl+Enter</kbd>';
      b.addEventListener('click', () => App.openCommandPalette());
      $('tb-title').before(b);
    }
    // Scroll Lock switches the Kannada keyboard, as in Nudi
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ScrollLock' || (e.ctrlKey && e.altKey && !e.shiftKey && e.code === 'KeyK')) { e.preventDefault(); App.toggleKeyboard(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && !document.querySelector('#modal-root .dlg')) { e.preventDefault(); e.stopPropagation(); App.openCommandPalette(); }
    }, true);
    App.setKeyboard('off');
    setInterval(() => { if (App.dirty && Date.now() - lastAuto > 110000) autosave(); }, 15000);
    if (!/selftest/.test(location.search)) App.whenReady.then(() => setTimeout(offerRecovery, 1200));
  }
  init();
  App.cleanUpText = cleanUp;
  App.togglePreview = togglePreview;
  App.kgpOutput = kgpOutput;
})();
