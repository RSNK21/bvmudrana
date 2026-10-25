/* BV Mudrana 0.8: reflowing overset text, a fuller Find and Change, special characters and fields,
   format painter, Find Font, watermark and page border, Read Aloud, fit frame to text, text threads,
   sticky notes, the user's name (Namaste), and the "What's New" list. */
(function () {
  const BV = window.BV, App = window.App, UI = BV.UI, T = BV.Text;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => BV.Render.esc(String(s == null ? '' : s));
  const doc = () => App.doc;
  const store = App.store;
  const fontBox = (id, value) => `<div class="fontbox"><input id="${id}" value="${esc(value)}" spellcheck="false" autocomplete="off" style="width:100%"><button class="fdrop" tabindex="-1" data-fontfor="${id}">▾</button></div>`;

  // ================================================================== What's new
  App.WHATS_NEW = {
    version: '0.8.0',
    groups: [
      ['Opening PageMaker files', [
        'Cropped pictures now show exactly the part that was visible in PageMaker, at the right size and place (they were squeezed whole into their frames before).',
        'New option in the Open dialog: reflow overset text onto new pages automatically.',
      ]],
      ['Text that does not fit', [
        'Layout > Reflow Overset Text: adds pages and threaded text blocks (following the page columns) until every story fits. Choose where the new pages go.',
        'Layout > Smart Text Reflow (as in InDesign): while you type, pages are added at the end when a story runs over its last page.',
        'Element > Fit Frame to Text shrinks or grows a text block to its text.',
        'View > Show Text Threads draws the links between threaded text blocks.',
      ]],
      ['Find, fonts and formatting', [
        'Find and Change (Ctrl+H) now finds across bold and italic changes, with Match case, Whole word (works for Kannada and Devanagari too), Regular expressions, Change, Change All and Count.',
        'Utilities > Find Font lists every font in the publication and replaces one font with another everywhere (text and styles), as in InDesign.',
        'Format Painter (Word and LibreOffice): Edit > Copy Formatting, then Paste Formatting, or the brush button to paint the next text you select.',
      ]],
      ['Typing', [
        'Type > Insert Special Character: danda, double danda, avagraha, Om, ZWJ and ZWNJ for Kannada conjuncts, rupee, copyright, quotes, bullets, non-breaking and thin spaces.',
        'Type > Insert Field: today\'s date (also in Kannada or Devanagari digits), time, publication name, number of pages, your name.',
      ]],
      ['Pages', [
        'Layout > Watermark and Page Border (Word): a light text watermark such as DRAFT or the publisher\'s name behind every page, and a border round the page, both in print and PDF.',
        'Utilities > Insert Sticky Note: yellow notes that never print, for proof comments.',
      ]],
      ['Listening and greeting', [
        'Utilities > Read Aloud (Review tab in Word style) reads the selected text or story (Kannada, Devanagari or English, with the voices Windows has).',
        'Your name: the setup asks for it, and BV Mudrana greets you with Namaste and shows it in the title bar. Change it in File > Your Name.',
      ]],
    ],
  };
  function whatsNew() {
    const W = App.WHATS_NEW;
    const html = `<p class="note" style="color:var(--ink)">Version ${esc(W.version)} brings these, on top of everything in earlier versions.</p>
      <div class="wn-list">${W.groups.map(([g, items]) => `<section><h3>${esc(g)}</h3><ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`).join('')}</div>`;
    return UI.dialog({ title: `New in BV Mudrana ${W.version}`, html, width: 680, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
  }
  App.whatsNew = whatsNew;

  // ================================================================== the user's name
  App.userName = '';
  const possessive = (n) => (n ? `${n}'s` : '');
  App.titleOwner = () => (App.userName ? `${possessive(App.userName)} Mudrana` : 'BV Mudrana');
  async function loadUser() {
    try { const u = window.native && native.userGet ? await native.userGet() : null; App.userName = (u && u.name) || ''; } catch (_) {}
    refreshTitle();
  }
  function refreshTitle() {
    if (App.setDirty && App.doc) App.setDirty(!!App.dirty);
    const el = $('tb-title');
    if (el) el.dataset.t = '';
  }
  async function askName(first) {
    const r = await UI.dialog({
      title: first ? 'Namaste! What is your name?' : 'Your Name',
      width: 460,
      html: `<p class="note" style="color:var(--ink)">BV Mudrana greets you with it, and the title bar shows it, for example <b>${esc(possessive(App.userName || 'Tejas'))} Mudrana</b>.</p>
        <div class="row"><label for="un-n">Your name</label><input type="text" id="un-n" value="${esc(App.userName)}" maxlength="40"></div>`,
      buttons: [{ label: 'Save', value: 'ok', primary: true }, { label: first ? 'Later' : 'Cancel', value: null }],
    });
    if (!r) return;
    App.userName = UI.val(r.el, 'un-n').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (window.native && native.userSet) await native.userSet(App.userName);
    refreshTitle();
    UI.status(App.userName ? `Namaste ${App.userName}!` : 'Name cleared.', 5000);
  }
  App.askName = askName;

  // the welcome screen: Namaste, the name, and What's New
  const sw = App.showWelcome;
  if (sw) App.showWelcome = async function () {
    const r = await sw.apply(this, arguments);
    const w = $('welcome');
    if (!w) return r;
    const a = w.querySelector('.wl-actions');
    const h2 = a && a.querySelector('h2');
    const eb = a && a.querySelector('.wl-eyebrow');
    if (eb) eb.textContent = App.userName ? 'Welcome back' : 'Welcome';
    if (h2) h2.innerHTML = App.userName ? `Namaste, ${esc(App.userName)}` : 'Namaste! What would you like to do?';
    if (h2 && App.userName) h2.insertAdjacentHTML('afterend', '<div class="wl-sub">What would you like to do today?</div>');
    if (h2 && !App.userName) h2.insertAdjacentHTML('afterend', '<div class="wl-sub"><button class="wl-link" data-wname>Tell BV Mudrana your name</button> and it will greet you each time.</div>');
    const ver = w.querySelector('.wl-ver');
    if (ver && !w.querySelector('.wl-new')) ver.insertAdjacentHTML('afterend', `<button class="wl-new" data-wnew>✦ New features in this version</button>`);
    if (!w.dataset.f8) {
      w.dataset.f8 = '1';
      w.addEventListener('click', (e) => {
        if (!e.target.closest) return;
        if (e.target.closest('[data-wnew]')) { e.stopPropagation(); whatsNew(); }
        if (e.target.closest('[data-wname]')) { e.stopPropagation(); w.hidden = true; askName(true).then(() => App.showWelcome()); }
      }, true);
    }
    return r;
  };

  // ================================================================== reflow overset text
  const overset = (st) => !!App.layoutFor(st).overflow;
  function storyPages(st) {
    const idx = new Map(doc().pages.map((p, i) => [p.id, i]));
    return st.frames.map((fid) => idx.get((doc().items[fid] || {}).page)).filter((i) => i != null);
  }
  /* Adds pages with threaded text blocks until the story fits. where: 'after' (after the story's last page) or 'end'. */
  function reflowStory(st, where = 'after', limit = 400) {
    const d = doc();
    if (!st.frames.length || !overset(st)) return 0;
    const last = d.items[st.frames[st.frames.length - 1]];
    if (!last || BV.isMasterRef(last.page) || last.h < 30) return 0;
    const lastPage = Math.max(...storyPages(st));
    // new blocks follow the page columns when the last block was a column; otherwise they copy the last block
    const lastCols = BV.pageColumns(d, last.page);
    const isColumn = lastCols.some((c) => Math.abs(c.x - last.x) < 3 && Math.abs(c.w - last.w) < 3);
    let at = where === 'end' ? d.pages.length : lastPage + 1;
    const facing = d.setup.doubleSided;
    let added = 0;
    while (overset(st) && added < limit) {
      // keep left and right pages where they were: add pages in pairs inside a double-sided publication
      const n = facing && at < d.pages.length ? 2 : 1;
      const pages = [];
      for (let i = 0; i < n; i++) pages.push(BV.newPage(d));
      d.pages.splice(at, 0, ...pages);
      for (const pg of pages) {
        const cols = isColumn ? BV.pageColumns(d, pg.id) : [{ x: last.x, y: last.y, w: last.w, h: last.h }];
        for (const c of cols) {
          const it = BV.newItem(d, 'text', pg.id, c.x, c.y, c.w, c.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
          st.frames.push(it.id);
        }
      }
      at += n;
      added += n;
      App.markStory(st.id);
      App.markAll();
    }
    return added;
  }
  App.reflowStory = reflowStory;
  function reflowAll(where, quiet) {
    const d = doc();
    if (!d) return { pages: 0, stories: 0, left: 0 };
    let pages = 0, stories = 0;
    for (const st of Object.values(d.stories)) {
      if (!st.frames.length || App.isMasterStory(st) || !overset(st)) continue;
      const n = reflowStory(st, where);
      if (n) { pages += n; stories++; }
    }
    const left = Object.values(d.stories).filter((st) => st.frames.length && !App.isMasterStory(st) && overset(st)).length;
    App.markAll();
    App.changed();
    if (!quiet) UI.status(pages ? `${stories} ${stories === 1 ? 'story' : 'stories'} reflowed onto ${pages} new ${pages === 1 ? 'page' : 'pages'}.` : 'No story has overset text.', 8000);
    return { pages, stories, left };
  }
  App.reflowAll = reflowAll;
  async function reflowDialog() {
    if (!doc()) return;
    const over = Object.values(doc().stories).filter((st) => st.frames.length && overset(st));
    if (!over.length) return UI.alert('Every story fits its text blocks. Nothing to reflow.');
    const r = await UI.dialog({
      title: 'Reflow Overset Text',
      width: 520,
      html: `<p class="note" style="color:var(--ink)">${over.length} ${over.length === 1 ? 'story has' : 'stories have'} more text than ${over.length === 1 ? 'its' : 'their'} text blocks can show. BV Mudrana adds pages with threaded text blocks (in the page's columns) until all of it shows, the way PageMaker's Autoflow does.</p>
        <fieldset><legend>Where the new pages go</legend>
          <label class="check"><input type="radio" name="rf-w" value="after" checked> <span>Right after the story's last page</span></label>
          <label class="check"><input type="radio" name="rf-w" value="end"> <span>At the end of the publication</span></label>
        </fieldset>
        <p class="note">In a double-sided publication pages are added in pairs inside the book, so left and right pages stay where they were.</p>`,
      buttons: [{ label: 'Reflow', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    App.checkpoint();
    const res = reflowAll(r.el.querySelector('input[name=rf-w]:checked').value);
    if (res.left) UI.alert(`${res.left} ${res.left === 1 ? 'story still runs' : 'stories still run'} over: ${res.left === 1 ? 'its last block is' : 'their last blocks are'} probably too small for even one line.`);
  }
  // Smart Text Reflow: pages are added at the end while typing
  App.smartReflow = store.get('smartReflow', false);
  const ch = App.changed;
  let reflowTimer = 0;
  App.changed = function (sid) {
    const r = ch.apply(this, arguments);
    if (App.smartReflow && sid && doc() && doc().stories[sid]) {
      clearTimeout(reflowTimer);
      reflowTimer = setTimeout(() => {
        const st = doc().stories[sid];
        if (!st || !st.frames.length || !overset(st)) return;
        const lastPage = Math.max(...storyPages(st));
        if (lastPage !== doc().pages.length - 1) return; // only when the story ends on the last page, as in InDesign
        const n = reflowStory(st, 'end', 20);
        if (n) { App.markAll(); App.render(); UI.status(`Smart Text Reflow added ${n} ${n === 1 ? 'page' : 'pages'}.`, 4000); }
      }, 500);
    }
    return r;
  };

  // ================================================================== Find and Change
  const WORD = '[\\p{L}\\p{M}\\p{N}_]';
  function buildRegex(f, o) {
    let src = o.regex ? f : f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (o.word) src = `(?<!${WORD})(?:${src})(?!${WORD})`;
    return new RegExp(src, 'gu' + (o.matchCase ? '' : 'i'));
  }
  // replace [s, e) in a paragraph, keeping the formatting of the run where the match starts
  function replaceInPara(para, s, e, text) {
    let a = 0;
    const out = [];
    let put = false;
    for (const r of para.runs) {
      const b = a + r.t.length;
      if (b <= s || a >= e) { if (a >= e && !put) { out.push(Object.assign({}, r, { t: text })); put = true; } out.push(r); a = b; continue; }
      const keepL = r.t.slice(0, Math.max(0, s - a)), keepR = r.t.slice(Math.max(0, Math.min(r.t.length, e - a)));
      const t = keepL + (put ? '' : text) + keepR;
      put = true;
      out.push(Object.assign({}, r, { t }));
      a = b;
    }
    if (!put) out.push({ t: text });
    para.runs = out;
    T.normalize(para);
  }
  function expand(text, m, rep, regex) {
    if (!regex) return rep;
    return rep.replace(/\$(\d|&)/g, (_, k) => (k === '&' ? m[0] : m[+k] || ''));
  }
  async function findChange() {
    const d = doc();
    if (!d) return;
    const st = App.selectedStories()[0];
    const o = Object.assign({ matchCase: false, word: false, regex: false }, store.get('findOpts', {}));
    const selText = App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0 ? (() => { const s = d.stories[App.sel.sid]; const [a, b] = T.order(App.sel.a, App.sel.f); return a.p === b.p ? T.paraText(s.paras[a.p]).slice(a.o, b.o) : ''; })() : '';
    const r = await UI.dialog({
      title: 'Find and Change',
      width: 540,
      html: `<div class="row"><label for="fc-f">Find what</label><input type="text" id="fc-f" value="${esc(selText || App.lastFind || '')}"></div>
        <div class="row"><label for="fc-c">Change to</label><input type="text" id="fc-c" value="${esc(App.lastChange || '')}"></div>
        <div class="row"><label for="fc-scope">Search</label><select id="fc-scope">${st ? '<option value="story">Current story</option>' : ''}<option value="all"${st ? '' : ' selected'}>All stories</option></select></div>
        <div class="fc-opts"><label class="check"><input type="checkbox" id="fc-case" ${o.matchCase ? 'checked' : ''}> Match case</label>
        <label class="check"><input type="checkbox" id="fc-word" ${o.word ? 'checked' : ''}> Whole word</label>
        <label class="check"><input type="checkbox" id="fc-re" ${o.regex ? 'checked' : ''}> Regular expression</label></div>
        <p class="note" id="fc-msg">Regular expressions: <code>\\d</code> digit, <code>\\s</code> space, <code>.</code> any letter, <code>( )</code> a group used as <code>$1</code> in Change to. Example: find <code>\\s+([,.;:])</code>, change to <code>$1</code> removes spaces before punctuation.</p>`,
      buttons: [{ label: 'Find Next', value: 'find', primary: true }, { label: 'Change', value: 'one' }, { label: 'Change All', value: 'all' }, { label: 'Count', value: 'count' }, { label: 'Close', value: null }],
      validate: (el) => { try { buildRegex(UI.val(el, 'fc-f') || 'x', { regex: UI.checked(el, 'fc-re') }); return null; } catch (e) { return 'This regular expression is not valid: ' + e.message; } },
    });
    if (!r) return;
    const f = UI.val(r.el, 'fc-f'), c = UI.val(r.el, 'fc-c');
    const opts = { matchCase: UI.checked(r.el, 'fc-case'), word: UI.checked(r.el, 'fc-word'), regex: UI.checked(r.el, 'fc-re') };
    store.set('findOpts', opts);
    App.lastFind = f; App.lastChange = c; App.lastFindOpts = opts;
    if (!f) return;
    const stories = UI.val(r.el, 'fc-scope') === 'story' && st ? [st] : Object.values(d.stories);
    const re = buildRegex(f, opts);
    if (r.value === 'count') {
      let n = 0;
      for (const s of stories) for (const p of s.paras) n += [...T.paraText(p).matchAll(re)].filter((m) => m[0].length).length;
      return UI.alert(`${n} ${n === 1 ? 'match' : 'matches'} found.`);
    }
    if (r.value === 'all') {
      App.checkpoint();
      let n = 0;
      for (const s of stories) {
        let touched = false;
        for (const p of s.paras) {
          const ms = [...T.paraText(p).matchAll(re)].filter((m) => m[0].length);
          for (let i = ms.length - 1; i >= 0; i--) { replaceInPara(p, ms[i].index, ms[i].index + ms[i][0].length, expand(T.paraText(p), ms[i], c, opts.regex)); n++; touched = true; }
        }
        if (touched) App.markStory(s.id);
      }
      App.changed();
      return UI.alert(`${n} ${n === 1 ? 'change' : 'changes'} made.`);
    }
    if (r.value === 'one' && App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0) {
      const s = d.stories[App.sel.sid];
      const [a, b] = T.order(App.sel.a, App.sel.f);
      if (a.p === b.p) {
        const txt = T.paraText(s.paras[a.p]).slice(a.o, b.o);
        re.lastIndex = 0;
        const m = new RegExp(`^(?:${re.source})$`, re.flags.replace('g', '')).exec(txt);
        if (m) { App.checkpoint(); replaceInPara(s.paras[a.p], a.o, b.o, expand(txt, m, c, opts.regex)); App.sel = { kind: 'text', sid: s.id, a: { ...a }, f: { p: a.p, o: a.o + expand(txt, m, c, opts.regex).length } }; App.changed(s.id); }
      }
    }
    findNext(stories, re);
  }
  function findNext(stories, re) {
    const d = doc();
    if (!re) { if (!App.lastFind) return App.command('findChange'); re = buildRegex(App.lastFind, App.lastFindOpts || {}); stories = Object.values(d.stories); }
    const start = App.sel.kind === 'text' ? T.order(App.sel.a, App.sel.f)[1] : null;
    const order = stories.slice();
    if (start) { const i = order.findIndex((s) => s.id === App.sel.sid); if (i > 0) order.push(...order.splice(0, i)); }
    for (let pass = 0; pass < 2; pass++) for (const s of order) {
      for (let p = 0; p < s.paras.length; p++) {
        if (pass === 0 && start && s.id === App.sel.sid && p < start.p) continue;
        const text = T.paraText(s.paras[p]);
        re.lastIndex = pass === 0 && start && s.id === App.sel.sid && p === start.p ? start.o : 0;
        let m;
        while ((m = re.exec(text)) && !m[0].length) re.lastIndex++;
        if (m) {
          App.setTool('text');
          App.sel = { kind: 'text', sid: s.id, a: { p, o: m.index }, f: { p, o: m.index + m[0].length } };
          App.render(); App.ensureCaretVisible && App.ensureCaretVisible(); App.focusIME && App.focusIME();
          return true;
        }
      }
    }
    UI.status('Not found: ' + (App.lastFind || ''), 5000);
    return false;
  }

  // ================================================================== special characters and fields
  const SPECIAL = [
    ['Danda ।', '।'], ['Double danda ॥', '॥'], ['Avagraha ಽ', 'ಽ'], ['Avagraha (Devanagari) ऽ', 'ऽ'], ['Om ॐ', 'ॐ'],
    ['Zero-width non-joiner (shows the halant: ಷಟ್‌ಶ)', '‌'], ['Zero-width joiner', '‍'],
    ['Rupee ₹', '₹'], ['Copyright ©', '©'], ['Registered ®', '®'], ['Trademark ™', '™'], ['Section §', '§'], ['Pilcrow ¶', '¶'], ['Degree °', '°'],
    ['Bullet •', '•'], ['En dash –', '–'], ['Ellipsis …', '…'], ['Single quotes ‘ ’', '‘’'], ['Double quotes “ ”', '“”'], ['Multiplication ×', '×'], ['Division ÷', '÷'],
    ['Non-breaking space', ' '], ['Thin space', ' '], ['En space', ' '], ['Hair space', ' '], ['Figure space', ' '],
  ];
  App.SPECIAL_CHARS = SPECIAL;
  function insertChars(s) {
    if (App.sel.kind !== 'text') return UI.status('Click into text with the text tool first.');
    if (s.length === 2 && /[‘“]/.test(s[0])) {
      // a pair of quotes goes round the selection
      const st = doc().stories[App.sel.sid];
      const [a, b] = T.order(App.sel.a, App.sel.f);
      if (T.cmp(a, b) !== 0 && a.p === b.p) {
        const mid = T.paraText(st.paras[a.p]).slice(a.o, b.o);
        return App.insertText(s[0] + mid + s[1]);
      }
      return App.insertText(s[0]);
    }
    App.insertText(s);
  }
  async function specialChars() {
    if (App.sel.kind !== 'text') return UI.status('Click into text with the text tool first.');
    let chosen = null;
    const r = await UI.dialog({
      title: 'Insert Special Character',
      width: 560,
      html: `<div class="sc-grid">${SPECIAL.map(([l, s], i) => `<button class="sc-b" data-i="${i}" title="${esc(l)}"><b>${/^[\u2000-\u200F\u00A0]$/.test(s) ? '␣' : esc(s.length === 2 && /[‘“]/.test(s[0]) ? s[0] + '…' + s[1] : s)}</b><span>${esc(l.replace(/\s+\S+$/, (m) => (/[^\x00-\x7F]/.test(m) ? '' : m)))}</span></button>`).join('')}</div>`,
      buttons: [{ label: 'Close', value: null }],
      onOpen: (el) => el.addEventListener('click', (e) => { const b = e.target.closest('.sc-b'); if (b) { chosen = SPECIAL[+b.dataset.i][1]; el.querySelector('.dfoot .btn').click(); } }),
    });
    if (chosen) { App.focusIME && App.focusIME(); insertChars(chosen); }
  }
  async function insertField(kind) {
    if (App.sel.kind !== 'text') return UI.status('Click into text with the text tool first.');
    const d = doc();
    const now = new Date();
    const numbering = d.setup.numbering || 'arabic';
    const digits = (s) => (/kannada|devanagari/.test(numbering) ? String(s).replace(/\d/g, (x) => BV.translit.numerals(+x, numbering)) : String(s));
    let t = '';
    if (kind === 'date') t = digits(`${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`);
    else if (kind === 'dateLong') t = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    else if (kind === 'dateKn') t = now.toLocaleDateString('kn-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    else if (kind === 'time') t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    else if (kind === 'pubName') t = App.docName || (App.filePath ? App.filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'Untitled');
    else if (kind === 'pageCount') t = digits(d.pages.length);
    else if (kind === 'userName') t = App.userName || '';
    if (t) App.insertText(t);
  }

  // ================================================================== Format Painter
  const CHAR_KEYS = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'caps', 'smallCaps', 'color', 'track', 'width', 'shift'];
  const PARA_KEYS = ['align', 'leading', 'leftIndent', 'firstIndent', 'rightIndent', 'spaceBefore', 'spaceAfter'];
  App.copiedFormat = null;
  function copyFormat() {
    const c = App.currentParaProps && App.currentParaProps();
    if (!c) return UI.status('Click into text (or select a text block) first.');
    App.copiedFormat = { style: c.style, cp: Object.fromEntries(CHAR_KEYS.map((k) => [k, c.cp[k]])), pp: Object.fromEntries(PARA_KEYS.map((k) => [k, c.pp[k]])) };
    UI.status(`Formatting copied: ${c.cp.font} ${c.cp.size} pt${c.cp.bold ? ' bold' : ''}${c.cp.italic ? ' italic' : ''}, style ${c.style}. Select text and choose Paste Formatting.`, 6000);
  }
  function pasteFormat() {
    const f = App.copiedFormat;
    if (!f) return UI.status('Copy some formatting first (Edit > Copy Formatting).');
    if (App.sel.kind !== 'text' && !App.selectedStories().length) return UI.status('Select the text to format first.');
    if (doc().styles[f.style]) App.applyStyle(f.style);
    const attrs = {};
    for (const k of CHAR_KEYS) attrs[k] = f.cp[k] === undefined ? null : f.cp[k];
    attrs.track = f.cp.track || null; attrs.width = f.cp.width && f.cp.width !== 100 ? f.cp.width : null; attrs.shift = f.cp.shift || null;
    App.applyChar(attrs);
    for (const k of PARA_KEYS) if (f.pp[k] !== undefined) App.applyPara(k, f.pp[k]);
    UI.status('Formatting pasted.', 3000);
  }
  App.formatBrush = false;
  function toggleBrush() {
    if (!App.formatBrush) { copyFormat(); if (!App.copiedFormat) return; }
    App.formatBrush = !App.formatBrush;
    document.body.classList.toggle('brush-on', App.formatBrush);
    if (App.formatBrush) UI.status('Format Painter: select the text to paint (Esc to stop).', 0);
    else UI.status('');
  }
  window.addEventListener('mouseup', () => {
    if (!App.formatBrush) return;
    setTimeout(() => {
      if (App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0) { pasteFormat(); App.formatBrush = false; document.body.classList.remove('brush-on'); }
    }, 30);
  }, true);
  window.addEventListener('keydown', (e) => { if (App.formatBrush && e.key === 'Escape') { App.formatBrush = false; document.body.classList.remove('brush-on'); UI.status(''); } }, true);

  // ================================================================== Find Font
  function fontsUsed() {
    const d = doc(), m = new Map();
    const add = (f, n, where) => { if (!f) return; const o = m.get(f) || { name: f, chars: 0, styles: [] }; o.chars += n; if (where) o.styles.push(where); m.set(f, o); };
    for (const [n, s] of Object.entries(d.styles)) add(s.font, 0, n);
    for (const st of Object.values(d.stories)) for (const p of st.paras) { const pp = BV.paraProps(d, p); for (const r of p.runs) add(BV.charProps(pp, r).font, r.t.length); }
    return [...m.values()].sort((a, b) => b.chars - a.chars);
  }
  async function findFont() {
    const d = doc();
    if (!d) return;
    const list = fontsUsed();
    const avail = App.fontSet || new Set(App.fontList);
    const r = await UI.dialog({
      title: 'Find Font',
      width: 620,
      html: `<div class="ff-list"><table><thead><tr><th></th><th>Font</th><th>Characters</th><th>Styles</th><th></th></tr></thead><tbody>${list.map((f, i) => `<tr><td><input type="radio" name="ff" value="${i}" ${i ? '' : 'checked'}></td><td style="font-family:'${esc(f.name)}',var(--font-ui)">${esc(f.name)}</td><td>${f.chars.toLocaleString()}</td><td class="note">${esc(f.styles.slice(0, 3).join(', '))}${f.styles.length > 3 ? '…' : ''}</td><td>${avail.has(f.name) ? '' : '<span class="so-tag warn">missing</span>'}</td></tr>`).join('')}</tbody></table></div>
        <div class="row"><label for="ff-to">Replace with</label>${fontBox('ff-to', '')}</div>
        <label class="check"><input type="checkbox" id="ff-st" checked> Also change paragraph styles that use it</label>`,
      buttons: [{ label: 'Change All', value: 'ok', primary: true }, { label: 'Close', value: null }],
    });
    if (!r) return;
    const from = list[+r.el.querySelector('input[name=ff]:checked').value];
    const to = UI.val(r.el, 'ff-to').trim();
    if (!from || !to) return;
    App.checkpoint();
    let runs = 0, styles = 0;
    for (const st of Object.values(d.stories)) {
      let touched = false;
      for (const p of st.paras) for (const run of p.runs) if (run.font === from.name) { run.font = to; runs++; touched = true; }
      if (touched) App.markStory(st.id);
    }
    if (UI.checked(r.el, 'ff-st')) for (const s of Object.values(d.styles)) if (s.font === from.name) { s.font = to; styles++; }
    App.ensureFonts([to]);
    App.markAll(); App.refreshStyles && App.refreshStyles(); App.changed();
    UI.status(`${from.name} replaced by ${to}: ${runs} text run${runs === 1 ? '' : 's'}, ${styles} style${styles === 1 ? '' : 's'}.`, 8000);
  }

  // ================================================================== watermark and page border
  BV.Render.pageDecor = function (d, pageIdx) {
    const S = d.setup;
    let s = '';
    const W = S.w, H = S.h;
    const b = S.pageBorder;
    if (b && b.width > 0) {
      const i = b.inset || 0;
      const dash = b.style === 'dash' ? ` stroke-dasharray="${b.width * 4} ${b.width * 2}"` : b.style === 'dot' ? ` stroke-dasharray="${b.width} ${b.width * 2}" stroke-linecap="round"` : '';
      s += `<rect x="${i}" y="${i}" width="${W - 2 * i}" height="${H - 2 * i}" fill="none" stroke="${esc(b.color || '#000000')}" stroke-width="${b.width}"${dash}/>`;
      if (b.style === 'double') s += `<rect x="${i + b.width * 3}" y="${i + b.width * 3}" width="${W - 2 * i - b.width * 6}" height="${H - 2 * i - b.width * 6}" fill="none" stroke="${esc(b.color || '#000000')}" stroke-width="${b.width}"/>`;
    }
    const w = S.watermark;
    if (w && w.text && !(w.skipFirst && pageIdx === 0)) {
      const ang = w.diagonal ? -Math.atan2(H, W) * 180 / Math.PI : 0;
      s += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="central" transform="rotate(${ang.toFixed(2)} ${W / 2} ${H / 2})" fill="${esc(w.color || '#9a9a9a')}" fill-opacity="${(w.opacity || 25) / 100}" style="font:${w.bold ? 'bold ' : ''}${w.size || 72}px ${BV.fontFamilyList(w.font || 'Noto Serif').replace(/"/g, "'")}" xml:space="preserve">${esc(w.text)}</text>`;
    }
    return s;
  };
  async function decorDialog() {
    const d = doc();
    if (!d) return;
    const w = Object.assign({ text: '', font: 'Noto Serif', size: 72, color: '#9a9a9a', opacity: 25, diagonal: true, bold: true, skipFirst: false }, d.setup.watermark || {});
    const b = Object.assign({ width: 0, color: '#000000', style: 'solid', inset: 24 }, d.setup.pageBorder || {});
    const r = await UI.dialog({
      title: 'Watermark and Page Border',
      width: 560,
      html: `<fieldset><legend>Watermark</legend>
          <div class="row"><label for="wm-t">Text</label><input type="text" id="wm-t" value="${esc(w.text)}" placeholder="for example DRAFT, ಮಾದರಿ, or the publisher's name"></div>
          <div class="row"><label for="wm-f">Font</label>${fontBox('wm-f', w.font)}</div>
          <div class="row2"><label>Size (pt)<input type="number" id="wm-s" value="${w.size}" min="8" max="400"></label><label>Colour<input type="color" id="wm-c" value="${esc(w.color)}"></label><label>Strength %<input type="number" id="wm-o" value="${w.opacity}" min="3" max="100"></label><label>&nbsp;<span class="check"><input type="checkbox" id="wm-b" ${w.bold ? 'checked' : ''}> Bold</span></label></div>
          <label class="check"><input type="checkbox" id="wm-d" ${w.diagonal ? 'checked' : ''}> Diagonal, corner to corner</label>
          <label class="check"><input type="checkbox" id="wm-1" ${w.skipFirst ? 'checked' : ''}> Not on the first page</label>
        </fieldset>
        <fieldset><legend>Page border</legend>
          <div class="row2"><label>Line (pt, 0 = none)<input type="number" id="pb-w" value="${b.width}" min="0" max="20" step="0.25"></label><label>Colour<input type="color" id="pb-c" value="${esc(b.color)}"></label><label>Style<select id="pb-s">${[['solid', 'Solid'], ['double', 'Double'], ['dash', 'Dashed'], ['dot', 'Dotted']].map(([v, l]) => `<option value="${v}"${b.style === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label>From the edge (pt)<input type="number" id="pb-i" value="${b.inset}" min="0" max="200"></label></div>
        </fieldset>
        <p class="note">Both show on every page, in print and in PDF. The watermark sits behind the text.</p>`,
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Remove Both', value: 'rm' }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    App.checkpoint();
    if (r.value === 'rm') { delete d.setup.watermark; delete d.setup.pageBorder; }
    else {
      const t = UI.val(r.el, 'wm-t').trim();
      if (t) d.setup.watermark = { text: t, font: UI.val(r.el, 'wm-f').trim() || 'Noto Serif', size: UI.num(r.el, 'wm-s') || 72, color: UI.val(r.el, 'wm-c'), opacity: Math.max(3, Math.min(100, UI.num(r.el, 'wm-o') || 25)), bold: UI.checked(r.el, 'wm-b'), diagonal: UI.checked(r.el, 'wm-d'), skipFirst: UI.checked(r.el, 'wm-1') };
      else delete d.setup.watermark;
      const bw = UI.num(r.el, 'pb-w');
      if (bw > 0) d.setup.pageBorder = { width: bw, color: UI.val(r.el, 'pb-c'), style: UI.val(r.el, 'pb-s'), inset: UI.num(r.el, 'pb-i') };
      else delete d.setup.pageBorder;
      if (d.setup.watermark) App.ensureFonts([d.setup.watermark.font]);
    }
    App.markAll(); App.changed();
  }

  // ================================================================== Read Aloud
  let speaking = false;
  function readAloud() {
    const synth = window.speechSynthesis;
    if (!synth) return UI.alert('This computer has no speech voices.');
    if (speaking || synth.speaking) { synth.cancel(); speaking = false; return UI.status('Stopped reading.', 3000); }
    let text = '';
    if (App.sel.kind === 'text') {
      const st = doc().stories[App.sel.sid];
      const [a, b] = T.order(App.sel.a, App.sel.f);
      if (T.cmp(a, b) !== 0) for (let p = a.p; p <= b.p; p++) { const t = T.paraText(st.paras[p]); text += t.slice(p === a.p ? a.o : 0, p === b.p ? b.o : t.length) + '\n'; }
      else text = st.paras.map(T.paraText).join('\n');
    } else {
      const sts = App.selectedStories();
      if (!sts.length) return UI.status('Select some text or a text block to read.');
      text = sts.map((s) => s.paras.map(T.paraText).join('\n')).join('\n');
    }
    text = text.replace(/[-]/g, ' ').trim();
    if (!text) return;
    const lang = /[ಀ-೿]/.test(text) ? 'kn' : /[ऀ-ॿ]/.test(text) ? 'hi' : 'en';
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang)) || (lang === 'kn' ? voices.find((v) => /^(hi|mr)/i.test(v.lang || '')) : null);
    if (lang !== 'en' && !voice) UI.status(`No ${lang === 'kn' ? 'Kannada' : 'Hindi'} voice is installed in Windows (Settings > Time & language > Speech > Add voices). Reading with the default voice.`, 9000);
    const parts = text.match(/[^\n।॥.?!]+[\n।॥.?!]*/g) || [text];
    speaking = true;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      u.rate = 0.95;
      if (i === parts.length - 1) u.onend = () => { speaking = false; };
      synth.speak(u);
    });
    UI.status('Reading aloud. Choose Read Aloud again to stop.', 5000);
  }

  // ================================================================== Fit Frame to Text, text threads, sticky notes
  function fitFrame() {
    const its = App.sel.kind === 'items' ? App.sel.ids.map((id) => doc().items[id]).filter((it) => it && it.type === 'text') : [];
    if (!its.length) return UI.status('Select a text block with the pointer first.');
    App.checkpoint();
    let n = 0;
    for (const it of its) {
      const st = doc().stories[it.storyId];
      if (!st) continue;
      const L = App.layoutFor(st);
      const isLast = st.frames[st.frames.length - 1] === it.id;
      if (L.overflow && isLast) {
        // grow until the text fits (up to the page bottom)
        const maxH = doc().setup.h - it.y;
        let lo = it.h, hi = maxH;
        for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; it.h = mid; App.markStory(st.id); if (App.layoutFor(st).overflow) lo = mid; else hi = mid; }
        it.h = Math.ceil(hi);
      } else {
        const fr = L.frames[it.id];
        if (fr && fr.lines.length && isLast) it.h = Math.max(12, Math.ceil(fr.usedH + 2));
      }
      App.markStory(st.id);
      n++;
    }
    App.changed();
    UI.status(`${n} text block${n === 1 ? '' : 's'} fitted to the text.`, 4000);
  }
  App.showThreads = store.get('showThreads', false);
  App.overlayHooks = App.overlayHooks || [];
  App.overlayHooks.push((p, s, px) => {
    if (!App.showThreads || !doc() || App.view.master) return '';
    const d = doc();
    let out = '';
    for (const st of Object.values(d.stories)) {
      for (let i = 0; i < st.frames.length - 1; i++) {
        const a = d.items[st.frames[i]], b = d.items[st.frames[i + 1]];
        if (!a || !b || a.page !== p.ref) continue;
        const q = App.placementOf(b.page);
        const x1 = a.x + a.w, y1 = a.y + a.h;
        if (q) {
          const x2 = b.x + (q.x0 - p.x0), y2 = b.y;
          out += `<path d="M${x1} ${y1} C${x1 + 30 * px * 10} ${y1}, ${x2 - 30 * px * 10} ${y2}, ${x2} ${y2}" fill="none" stroke="#2f80ed" stroke-width="${1.5 * px}" stroke-dasharray="${4 * px} ${3 * px}"/><circle cx="${x2}" cy="${y2}" r="${3 * px}" fill="#2f80ed"/>`;
        } else out += `<text x="${x1 + 4 * px}" y="${y1}" fill="#2f80ed" style="font:bold ${11 * px}px sans-serif">→ p. ${esc(BV.pageLabel(d, d.pages.findIndex((pg) => pg.id === b.page)))}</text>`;
        out += `<circle cx="${x1}" cy="${y1}" r="${3 * px}" fill="#2f80ed"/>`;
      }
    }
    return out;
  });
  function stickyNote() {
    const d = doc();
    if (!d) return;
    const pl = App.placements[App.placements.length - 1];
    if (!pl || App.view.master) return UI.status('Go to a page first.');
    App.checkpoint();
    const st = BV.newStory(d, Object.keys(d.styles)[0]);
    st.paras = [{ style: st.paras[0].style, runs: [{ t: `Note${App.userName ? ' from ' + App.userName : ''}: `, font: 'Noto Sans Kannada', size: 9, color: '#5a4300' }] }];
    const W = d.setup.w;
    const it = BV.newItem(d, 'text', pl.ref, W - 170, 40 + Math.random() * 40, 150, 90, { storyId: st.id, fill: '#fff4a8', stroke: '#e0c040', strokeWidth: 0.75, nonPrint: true, note: true });
    st.frames.push(it.id);
    App.showNonPrinting = true;
    App.markAll(); App.changed();
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: T.paraText(st.paras[0]).length }, f: { p: 0, o: T.paraText(st.paras[0]).length } };
    App.render(); App.focusIME && App.focusIME();
    UI.status('Sticky note added. It never prints or goes into the PDF.', 5000);
  }

  // ================================================================== commands
  const prev = App.command2;
  App.command2 = async function (cmd, arg) {
    if (cmd.startsWith('char:')) return insertChars(String.fromCodePoint(...cmd.slice(5).split('+').map((h) => parseInt(h, 16))));
    if (cmd.startsWith('field:')) return insertField(cmd.slice(6));
    switch (cmd) {
      case 'reflowOverset': return reflowDialog();
      case 'smartReflow': App.smartReflow = !App.smartReflow; store.set('smartReflow', App.smartReflow); native.menuState({ smartReflow: App.smartReflow }); return UI.status(App.smartReflow ? 'Smart Text Reflow on: pages are added at the end when a story runs over its last page.' : 'Smart Text Reflow off.', 6000);
      case 'copyFormat': return copyFormat();
      case 'pasteFormat': return pasteFormat();
      case 'formatBrush': return toggleBrush();
      case 'findFont': return findFont();
      case 'pageDecor': return decorDialog();
      case 'readAloud': return readAloud();
      case 'fitFrameText': return fitFrame();
      case 'showThreads': App.showThreads = !App.showThreads; store.set('showThreads', App.showThreads); native.menuState({ showThreads: App.showThreads }); return App.render();
      case 'stickyNote': return stickyNote();
      case 'whatsNew': return whatsNew();
      case 'specialChars': return specialChars();
      case 'userName': return askName(false);
    }
    if (prev) return prev(cmd, arg);
  };
  // the new Find and Change takes over Ctrl+F / Ctrl+H and Find Next
  const baseCommand = App.command;
  App.command = function (cmd, arg) {
    const seOpen = $('story-editor') && !$('story-editor').hidden;
    if (cmd === 'findChange' && !seOpen) return findChange();
    if (cmd === 'findNext' && !seOpen) return findNext();
    return baseCommand.apply(this, arguments);
  };

  function init() {
    if (!window.native) return;
    native.menuState({ smartReflow: App.smartReflow, showThreads: App.showThreads });
    loadUser().then(() => {
      if (!App.userName && !/selftest/.test(location.search) && !store.get('askedName', false)) {
        store.set('askedName', true);
        App.whenReady && App.whenReady.then(() => setTimeout(() => { if ($('welcome') && !$('welcome').hidden) return; askName(true); }, 1500));
      }
    });
    // show What's New once after an update
    const seen = store.get('seenVersion', '');
    if (seen !== App.WHATS_NEW.version && !/selftest/.test(location.search)) {
      store.set('seenVersion', App.WHATS_NEW.version);
      if (seen) App.whenReady && App.whenReady.then(() => setTimeout(whatsNew, 2500));
    }
  }
  App.prefsUser = askName;
  init();
  App.f8 = { reflowStory, reflowAll, buildRegex, replaceInPara, fontsUsed, possessive };
})();
