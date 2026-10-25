/* BV Mudrana: the rest of PageMaker 7: Character/Paragraph specifications with all options, paragraph rules,
   kerning and tracking, hyphenation, master pages, frames and threads, masks, image control, links,
   the PageMaker plug-ins (Balance Columns, Build Booklet, Bullets and Numbering, Change Case, Continuation,
   Drop Cap, Grid Manager, Keyline, Running Headers/Footers, Sort Pages, Word Counter, Data Merge,
   Save for Service Provider), Book, Index, Spelling, Define Colors, Preflight, Library, Hyperlinks, exports. */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text, UI = BV.UI;
  const $ = (id) => document.getElementById(id);
  const doc = () => App.doc;
  const esc = BV.Render.esc;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const selItems = () => (App.sel.kind === 'items' ? App.sel.ids.map((id) => doc().items[id]).filter(Boolean) : []);
  const textSel = () => (App.sel.kind === 'text' ? App.sel : null);
  const fontBox = (id, value) => `<div class="fontbox"><input id="${id}" value="${esc(value)}" spellcheck="false" autocomplete="off" style="width:100%"><button class="fdrop" tabindex="-1" data-fontfor="${id}">▾</button></div>`;
  const U = () => doc().setup.units;
  const UL = () => BV.UNIT_LABEL[U()];
  const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
  const colorOptions = (curHex) => doc().colors.filter((c) => c.name !== 'Registration').map((c) => opt(c.hex, c.name, curHex)).join('') + (doc().colors.some((c) => c.hex === curHex) || !curHex ? '' : opt(curHex, 'Custom ' + curHex, curHex));
  const docBase = () => (App.docName || (App.filePath ? App.filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'Publication'));

  // paragraph ranges touched by the selection: [{st, a, b}]
  function paraRanges() {
    const ts = textSel();
    if (ts) return [{ st: doc().stories[ts.sid], a: Math.min(ts.a.p, ts.f.p), b: Math.max(ts.a.p, ts.f.p) }];
    return App.selectedStories().map((st) => ({ st, a: 0, b: st.paras.length - 1 }));
  }
  function setParaMany(vals) {
    const rs = paraRanges();
    if (!rs.length) { UI.status('Click into a paragraph or select a text block first.'); return false; }
    App.checkpoint();
    for (const { st, a, b } of rs) { for (const k in vals) T.setParaOv(st, a, b, k, vals[k]); App.markStory(st.id); }
    App.markAll();
    App.changed();
    if (textSel()) App.focusIME();
    return true;
  }
  // character ranges: [{st, a, b}] with positions
  function charRanges() {
    const ts = textSel();
    if (ts) { const [a, b] = T.order(ts.a, ts.f); return [{ st: doc().stories[ts.sid], a, b }]; }
    return App.selectedStories().map((st) => ({ st, a: { p: 0, o: 0 }, b: T.storyEnd(st) }));
  }
  function toggleCharAttr(k) {
    const c = App.currentParaProps();
    if (!c) return UI.status('Click into text first.');
    App.applyChar({ [k]: c.cp[k] ? null : true });
  }
  // add `delta` em to the tracking of every run in a range (kerning keys and Expert Kerning)
  function adjustTrack(st, a, b, delta) {
    [a, b] = T.order(a, b);
    for (let p = a.p; p <= b.p; p++) {
      const para = st.paras[p];
      const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(para).length;
      if (e <= s) continue;
      const runs = [];
      let off = 0;
      for (const r of para.runs) {
        const a0 = off, b0 = off + r.t.length;
        off = b0;
        if (b0 <= s || a0 >= e) { runs.push(r); continue; }
        const x = Math.max(s, a0) - a0, y = Math.min(e, b0) - a0;
        if (x > 0) runs.push(Object.assign({}, r, { t: r.t.slice(0, x) }));
        const mid = Object.assign({}, r, { t: r.t.slice(x, y) });
        const v = Math.round(((r.track || 0) + delta) * 1000) / 1000;
        if (v) mid.track = v; else delete mid.track;
        runs.push(mid);
        if (y < r.t.length) runs.push(Object.assign({}, r, { t: r.t.slice(y) }));
      }
      para.runs = runs;
      T.normalize(para);
    }
  }
  App.kern = function (delta) {
    const ts = textSel();
    if (!ts) return UI.status('Click between two letters (or select text) to kern.');
    const st = doc().stories[ts.sid];
    let [a, b] = T.order(ts.a, ts.f);
    if (T.cmp(a, b) === 0) {
      // kerning between the letter (akshara) before the cursor and the next one
      const text = T.paraText(st.paras[a.p]);
      const bounds = BV.Layout.graphemeBounds(text);
      const e = bounds.find((x) => x >= a.o) ?? text.length;
      const s0 = [...bounds].reverse().find((x) => x < e);
      if (s0 === undefined) return;
      a = { p: a.p, o: s0 }; b = { p: a.p, o: e };
    }
    App.checkpoint();
    adjustTrack(st, a, b, delta);
    App.changed(st.id);
    App.focusIME();
    UI.status(`Kerning ${delta > 0 ? '+' : ''}${delta} em`, 1500);
  };
  App.ATTR_HELP = 1;

  // ------------------------------------------------------------------ Character Specifications (Ctrl+T)
  App.typeSpecs = async function () {
    const c = App.currentParaProps();
    if (!c) return UI.status('Click into text or select a text block first.');
    const cp = c.cp, pp = c.pp;
    const run = (() => { const ts = textSel(); if (!ts) return {}; const st = doc().stories[ts.sid]; return T.attrsAt(st.paras[ts.f.p], T.cmp(ts.a, ts.f) ? T.order(ts.a, ts.f)[0].o + 1 : ts.f.o); })();
    const baseColor = run.color || pp.color || '#000000';
    const tracks = [[0, 'No track'], [0.1, 'Very loose'], [0.05, 'Loose'], [0.02, 'Normal'], [-0.02, 'Tight'], [-0.05, 'Very tight']];
    const curTrack = run.track || 0;
    const r = await UI.dialog({
      title: 'Character Specifications',
      width: 600,
      html: `<div class="row"><label for="cs-font">Font</label>${fontBox('cs-font', cp.font)}</div>
        <div class="grid3">
          <label>Size (pt)<input type="number" step="any" id="cs-size" value="${run.size || pp.size}"></label>
          <label>Leading<input type="text" id="cs-lead" value="${pp.leading}"></label>
          <label>Horizontal scale (%)<input type="number" step="any" id="cs-hs" value="${cp.width || 100}"></label>
          <label>Colour<select id="cs-color">${colorOptions(baseColor)}</select></label>
          <label>Tint (%)<input type="number" min="0" max="100" id="cs-tint" value="${run.tint || 100}"></label>
          <label>Position<select id="cs-pos">${opt('', 'Normal', cp.pos || '')}${opt('sup', 'Superscript', cp.pos || '')}${opt('sub', 'Subscript', cp.pos || '')}</select></label>
          <label>Case<select id="cs-case">${opt('', 'Normal', cp.caps ? 'caps' : cp.smallCaps ? 'sc' : '')}${opt('caps', 'All caps', cp.caps ? 'caps' : cp.smallCaps ? 'sc' : '')}${opt('sc', 'Small caps', cp.caps ? 'caps' : cp.smallCaps ? 'sc' : '')}</select></label>
          <label>Track<select id="cs-track">${tracks.map(([v, l]) => opt(v, l, tracks.some((t) => t[0] === curTrack) ? curTrack : 'x')).join('')}${tracks.some((t) => t[0] === curTrack) ? '' : opt(curTrack, `Custom (${curTrack} em)`, curTrack)}</select></label>
          <label>Baseline shift (pt)<input type="number" step="any" id="cs-shift" value="${run.shift || 0}"></label>
        </div>
        <fieldset><legend>Type style</legend><div class="grid3">
          ${[['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['strike', 'Strikethru'], ['reverse', 'Reverse'], ['outline', 'Outline'], ['shadow', 'Shadow']].map(([k, l]) => `<label class="check" style="flex-direction:row"><input type="checkbox" id="cs-${k}" ${cp[k] ? 'checked' : ''}> ${l}</label>`).join('')}
        </div></fieldset>
        <p class="note">Applies to the selected text; with only a cursor, to what you type next.</p>`,
    });
    if (!r) return;
    const el = r.el;
    const lead = UI.val(el, 'cs-lead').trim().toLowerCase();
    const cs = UI.val(el, 'cs-case');
    const hs = UI.num(el, 'cs-hs');
    const tint = Math.max(0, Math.min(100, UI.num(el, 'cs-tint')));
    const attrs = {
      font: UI.val(el, 'cs-font').trim() || null, size: UI.num(el, 'cs-size') || null,
      width: hs && hs !== 100 ? hs : null, color: UI.val(el, 'cs-color') || null, tint: tint && tint < 100 ? tint : null,
      pos: UI.val(el, 'cs-pos') || null, caps: cs === 'caps' || null, smallCaps: cs === 'sc' || null,
      track: parseFloat(UI.val(el, 'cs-track')) || null, shift: UI.num(el, 'cs-shift') || null,
    };
    for (const k of ['bold', 'italic']) attrs[k] = UI.checked(el, 'cs-' + k);
    for (const k of ['underline', 'strike', 'reverse', 'outline', 'shadow']) attrs[k] = UI.checked(el, 'cs-' + k) || null;
    App.applyChar(attrs);
    if (String(lead) !== String(pp.leading).toLowerCase()) App.applyPara('leading', lead === 'auto' ? 'auto' : parseFloat(lead) || 'auto');
  };

  // ------------------------------------------------------------------ Paragraph Specifications (Ctrl+M)
  async function rulesDialog(pp) {
    const one = (k, label, R) => {
      R = R || {};
      const on = !!pp[k];
      return `<fieldset><legend><label class="check" style="flex-direction:row;display:inline-flex"><input type="checkbox" id="${k}-on" ${on ? 'checked' : ''}> ${label}</label></legend><div class="grid3">
        <label>Stroke (pt)<select id="${k}-w">${[0.25, 0.5, 1, 2, 4, 6, 8, 12].map((v) => opt(v, v === 0.25 ? 'Hairline' : v + ' pt', R.w ?? 1)).join('')}</select></label>
        <label>Style<select id="${k}-s">${opt('solid', 'Solid', R.style || 'solid')}${opt('dash', 'Dashed', R.style)}${opt('dot', 'Dotted', R.style)}${opt('double', 'Double', R.style)}</select></label>
        <label>Colour<select id="${k}-c">${colorOptions(R.color || '#000000')}</select></label>
        <label>Width<select id="${k}-x">${opt('text', 'Width of text', R.extent || 'column')}${opt('column', 'Width of column', R.extent || 'column')}</select></label>
        <label>Indent left (${UL()})<input type="number" step="any" id="${k}-il" value="${BV.fmt(-(R.indL || 0), U())}"></label>
        <label>Indent right<input type="number" step="any" id="${k}-ir" value="${BV.fmt(-(R.indR || 0), U())}"></label>
        <label>${k === 'ruleAbove' ? 'Distance above (pt)' : 'Distance below (pt)'}<input type="number" step="any" id="${k}-o" value="${R.offset || 0}"></label>
      </div></fieldset>`;
    };
    const r = await UI.dialog({ title: 'Paragraph Rules', width: 600, html: one('ruleAbove', 'Rule above paragraph', pp.ruleAbove) + one('ruleBelow', 'Rule below paragraph', pp.ruleBelow) });
    if (!r) return undefined;
    const get = (k) => UI.checked(r.el, k + '-on') ? { w: +UI.val(r.el, k + '-w'), style: UI.val(r.el, k + '-s'), color: UI.val(r.el, k + '-c'), extent: UI.val(r.el, k + '-x'), indL: -BV.toPt(UI.num(r.el, k + '-il'), U()), indR: -BV.toPt(UI.num(r.el, k + '-ir'), U()), offset: UI.num(r.el, k + '-o') } : null;
    return { ruleAbove: get('ruleAbove'), ruleBelow: get('ruleBelow') };
  }
  App.paraSpecs = async function () {
    const c = App.currentParaProps();
    if (!c) return UI.status('Click into a paragraph or select a text block first.');
    const pp = c.pp, u = U();
    let rules = { ruleAbove: pp.ruleAbove || null, ruleBelow: pp.ruleBelow || null };
    const kw = pp.keepWith !== undefined && pp.keepWith !== null ? pp.keepWith : pp.keepNext ? 2 : 0;
    const r = await UI.dialog({
      title: 'Paragraph Specifications',
      width: 620,
      html: `<div class="grid3">
          <label>Left indent (${UL()})<input type="number" step="any" id="ps-li" value="${BV.fmt(pp.leftIndent || 0, u)}"></label>
          <label>First line<input type="number" step="any" id="ps-fi" value="${BV.fmt(pp.firstIndent || 0, u)}"></label>
          <label>Right indent<input type="number" step="any" id="ps-ri" value="${BV.fmt(pp.rightIndent || 0, u)}"></label>
          <label>Space before (pt)<input type="number" step="any" id="ps-sb" value="${pp.spaceBefore || 0}"></label>
          <label>Space after (pt)<input type="number" step="any" id="ps-sa" value="${pp.spaceAfter || 0}"></label>
          <label>Leading (pt or auto)<input type="text" id="ps-lead" value="${pp.leading}"></label>
          <label>Alignment<select id="ps-align">${[['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify'], ['force', 'Force justify']].map(([v, l]) => opt(v, l, pp.align)).join('')}</select></label>
          <label>Dictionary<select id="ps-dict">${opt('en', 'US English', pp.dict || 'en')}${opt('kn', 'Kannada', pp.dict)}${opt('sa', 'Sanskrit', pp.dict)}${opt('none', 'None', pp.dict)}</select></label>
          <label>Drop cap (lines)<select id="ps-dc">${[0, 2, 3, 4, 5].map((v) => opt(v, v ? v + ' lines' : 'None', pp.dropCap || 0)).join('')}</select></label>
        </div>
        <fieldset><legend>Options</legend><div class="grid3">
          <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-kt" ${pp.keepTogether ? 'checked' : ''}> Keep lines together</label>
          <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-cb" ${pp.breakBefore ? 'checked' : ''}> Column break before</label>
          <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-pb" ${pp.pageBreak ? 'checked' : ''}> Page break before</label>
          <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-toc" ${pp.toc ? 'checked' : ''}> Include in table of contents</label>
          <label>Keep with next<select id="ps-kw">${[0, 1, 2, 3].map((v) => opt(v, v ? v + ' lines' : 'Off', kw)).join('')}</select></label>
          <label>Widow control<select id="ps-wc">${[0, 1, 2, 3].map((v) => opt(v, v ? v + ' lines' : 'Off', pp.widow || 0)).join('')}</select></label>
          <label>Orphan control<select id="ps-oc">${[[-1, 'Automatic'], [0, 'Off'], [1, '1 line'], [2, '2 lines'], [3, '3 lines']].map(([v, l]) => opt(v, l, pp.orphan === undefined ? -1 : pp.orphan)).join('')}</select></label>
        </div></fieldset>
        <div style="display:flex;gap:8px"><button class="btn" type="button" id="ps-rules">Rules…</button><button class="btn" type="button" id="ps-hyph">Hyphenation…</button><span class="note" id="ps-rnote" style="align-self:center">${rules.ruleAbove || rules.ruleBelow ? 'Rules are on.' : ''}</span></div>`,
      onOpen: (el) => {
        el.querySelector('#ps-rules').onclick = async () => { const x = await rulesDialog(Object.assign({}, pp, rules)); if (x) { rules = x; el.querySelector('#ps-rnote').textContent = rules.ruleAbove || rules.ruleBelow ? 'Rules are on.' : 'No rules.'; } };
        el.querySelector('#ps-hyph').onclick = () => hyphenation();
      },
    });
    if (!r) return;
    const el = r.el;
    const lead = UI.val(el, 'ps-lead').trim().toLowerCase();
    const oc = +UI.val(el, 'ps-oc');
    setParaMany({
      leftIndent: BV.toPt(UI.num(el, 'ps-li'), u), firstIndent: BV.toPt(UI.num(el, 'ps-fi'), u), rightIndent: BV.toPt(UI.num(el, 'ps-ri'), u),
      spaceBefore: UI.num(el, 'ps-sb'), spaceAfter: UI.num(el, 'ps-sa'), leading: lead === 'auto' ? 'auto' : parseFloat(lead) || 'auto',
      align: UI.val(el, 'ps-align'), dict: UI.val(el, 'ps-dict'), dropCap: +UI.val(el, 'ps-dc') || null,
      keepTogether: UI.checked(el, 'ps-kt'), breakBefore: UI.checked(el, 'ps-cb'), pageBreak: UI.checked(el, 'ps-pb'), toc: UI.checked(el, 'ps-toc'),
      keepWith: +UI.val(el, 'ps-kw'), keepNext: +UI.val(el, 'ps-kw') > 0, widow: +UI.val(el, 'ps-wc') || null, orphan: oc < 0 ? null : oc,
      ruleAbove: rules.ruleAbove, ruleBelow: rules.ruleBelow,
    });
  };

  async function hyphenation() {
    const c = App.currentParaProps();
    if (!c) return UI.status('Click into a paragraph first.');
    const r = await UI.dialog({
      title: 'Hyphenation',
      html: `<label class="check" style="flex-direction:row"><input type="radio" name="hy" value="on" ${c.pp.hyphenate !== false ? 'checked' : ''}> On: break words at discretionary hyphens</label>
        <label class="check" style="flex-direction:row"><input type="radio" name="hy" value="off" ${c.pp.hyphenate === false ? 'checked' : ''}> Off</label>
        <p class="note">Put a discretionary hyphen into a word with <b>Ctrl+Shift+-</b> (as in PageMaker). The word breaks there, with a hyphen, only when it falls at the end of a line. “Add hyphens to selection” below inserts them into the English words of the selected text automatically.</p>
        <button class="btn" type="button" id="hy-auto">Add hyphens to selection</button>`,
      onOpen: (el) => { el.querySelector('#hy-auto').onclick = () => { autoHyphenate(); }; },
    });
    if (!r) return;
    setParaMany({ hyphenate: r.el.querySelector('input[name=hy]:checked').value === 'on' ? null : false });
  }
  // a small English hyphenator (vowel-consonant rules); Indic scripts are never hyphenated
  function hyphenateWord(w) {
    if (w.length < 6 || /[^A-Za-z]/.test(w)) return w;
    const V = /[aeiouyAEIOUY]/;
    const out = [];
    let last = 0;
    for (let i = 2; i < w.length - 3; i++) {
      const a = w[i - 1], b = w[i], c2 = w[i + 1];
      // vowel + consonant + consonant + vowel  →  split between the consonants
      if (V.test(a) && !V.test(b) && !V.test(c2) && V.test(w[i + 2] || '') && !/^(ch|sh|th|ph|wh|ck|ng|qu)$/i.test(b + c2)) { out.push(w.slice(last, i + 1)); last = i + 1; i++; }
    }
    out.push(w.slice(last));
    return out.filter(Boolean).join('\u00AD');
  }
  function autoHyphenate() {
    const rs = charRanges();
    if (!rs.length) return UI.status('Select text first.');
    App.checkpoint();
    let n = 0;
    for (const { st, a, b } of rs) {
      for (let p = a.p; p <= b.p; p++) {
        for (const run of st.paras[p].runs) {
          const t2 = run.t.replace(/[A-Za-z]{6,}/g, (w) => { const h = hyphenateWord(w); if (h !== w) n++; return h; });
          run.t = t2;
        }
      }
      App.markStory(st.id);
    }
    App.changed();
    UI.status(`Discretionary hyphens added to ${n} words.`);
  }

  async function expertKerning() {
    if (!textSel() || !T.cmp(App.sel.a, App.sel.f)) return UI.status('Select the text to kern first.');
    const r = await UI.dialog({
      title: 'Expert Kerning',
      html: `<div class="row"><label for="ek-v">Kern amount (em, + looser, − tighter)</label><input type="number" step="0.01" id="ek-v" value="-0.02"></div>
        <p class="note">Adds the amount between every pair of letters in the selection. With only a cursor, use Ctrl+Backspace (tighter) and Ctrl+Shift+Backspace (looser), 1/25 em per press; add Alt for 1/100 em.</p>`,
    });
    if (!r) return;
    const v = UI.num(r.el, 'ek-v');
    const st = doc().stories[App.sel.sid];
    App.checkpoint(); adjustTrack(st, App.sel.a, App.sel.f, v); App.changed(st.id);
  }
  async function editTracks() {
    const c = App.currentParaProps();
    if (!c) return UI.status('Click into text first.');
    const v = await UI.prompt('Edit Tracks', 'Tracking for the selection (em; Normal = 0.02, Tight = −0.02)', c.cp.track || 0);
    if (v === null) return;
    App.applyChar({ track: parseFloat(v) || null });
  }

  // ------------------------------------------------------------------ master pages
  App.applyMaster = function (id, pageIdxs) {
    // id: '' = Document Master, null = [None], otherwise a named master
    App.checkpoint();
    for (const i of pageIdxs) { const pg = doc().pages[i]; if (!pg) continue; if (id === null) pg.master = false; else { pg.master = true; if (id) pg.masterId = id; else delete pg.masterId; } }
    App.markAll();
    App.changed();
    App.refreshMasters();
  };
  async function newMaster(fromPage) {
    const r = await UI.dialog({
      title: fromPage ? 'Save Page as Master' : 'New Master Page',
      html: `<div class="row"><label for="nm-n">Name</label><input type="text" id="nm-n" value="Master ${(doc().masters || []).length + 1}"></div>
        <div class="row2"><label>Columns<input type="number" id="nm-c" min="1" value="${doc().setup.columns}"></label><label>Gutter (${UL()})<input type="number" step="any" id="nm-g" value="${BV.fmt(doc().setup.gutter, U())}"></label></div>`,
    });
    if (!r) return;
    App.checkpoint();
    const id = BV.newId(doc(), 'm');
    const m = { id, name: UI.val(r.el, 'nm-n').trim() || 'Master', columns: Math.max(1, Math.round(UI.num(r.el, 'nm-c'))), gutter: BV.toPt(UI.num(r.el, 'nm-g'), U()), guides: { L: { h: [], v: [] }, R: { h: [], v: [] } } };
    doc().masters.push(m);
    if (fromPage) {
      // copy the items of the pages in view onto the new master
      for (const p of App.placements) {
        if (p.idx < 0) continue;
        const ref = BV.masterRef(id, p.side);
        copyItemsTo(BV.itemsOnPage(doc(), p.ref, true), ref, 0);
        m.guides[p.side] = clone(doc().pages[p.idx].guides);
      }
    }
    App.changed();
    App.refreshMasters();
    if (!fromPage) App.gotoSpread(0, id);
  }
  // copy items (and their stories) onto another page ref, keeping text threads within the copy
  function copyItemsTo(items, ref, dy) {
    const d = doc();
    const storyMap = {};
    const made = [];
    for (const it of items.slice().sort((a, b) => (a.z || 0) - (b.z || 0))) {
      const n = clone(it);
      n.id = BV.newId(d, 'i'); n.page = ref; n.y += dy || 0;
      if (n.type === 'text') {
        const src = d.stories[it.storyId];
        if (!storyMap[it.storyId]) { const ns = BV.newStory(d); ns.paras = clone(src.paras); storyMap[it.storyId] = ns; }
        const ns = storyMap[it.storyId];
        // keep the frame order of the original thread
        n.storyId = ns.id;
        ns.frames.push(n.id);
        ns._order = ns._order || {}; ns._order[n.id] = src.frames.indexOf(it.id);
      }
      delete n.group;
      d.items[n.id] = n;
      made.push(n);
    }
    for (const ns of Object.values(storyMap)) { ns.frames.sort((a, b) => ns._order[a] - ns._order[b]); delete ns._order; }
    return made;
  }
  async function deleteMaster() {
    const id = App.masterSel && App.masterSel !== 'none' ? App.masterSel : App.view.master ? App.masterId() : null;
    if (!id) return UI.status('Click a named master page in the Master Pages palette first (the Document Master cannot be deleted).');
    const m = BV.masterById(doc(), id);
    if (!(await UI.confirm(`Delete the master page “${m.name}”? Pages that use it go back to the Document Master.`, 'Delete'))) return;
    App.checkpoint();
    App.deleteItems(Object.values(doc().items).filter((it) => it.page === BV.masterRef(id, 'L') || it.page === BV.masterRef(id, 'R')).map((it) => it.id));
    doc().masters = doc().masters.filter((x) => x.id !== id);
    doc().pages.forEach((p) => { if (p.masterId === id) delete p.masterId; });
    App.masterSel = '';
    if (App.view.master && App.view.master !== true) App.gotoSpread(0, true);
    App.markAll(); App.changed(); App.refreshMasters();
  }
  async function duplicateMaster() {
    const id = App.view.master ? App.masterId() : App.masterSel && App.masterSel !== 'none' ? App.masterSel : '';
    App.checkpoint();
    const src = BV.masterById(doc(), id);
    const nid = BV.newId(doc(), 'm');
    const m = { id: nid, name: (src ? src.name : 'Document Master') + ' copy', columns: src ? src.columns : doc().setup.columns, gutter: src ? src.gutter : doc().setup.gutter, guides: clone(src ? src.guides || {} : doc().masterGuides) };
    doc().masters.push(m);
    for (const side of ['L', 'R']) copyItemsTo(BV.itemsOnPage(doc(), BV.masterRef(id, side), true), BV.masterRef(nid, side), 0);
    App.changed(); App.refreshMasters();
    UI.status(`Made “${m.name}”.`);
  }
  async function applyMasterDlg() {
    const d = doc();
    const cur = App.placements.filter((p) => p.idx >= 0).map((p) => p.idx);
    const sp = d.setup.startPage;
    const r = await UI.dialog({
      title: 'Apply Master',
      html: `<div class="row"><label for="am-m">Master page</label><select id="am-m">${opt('none', '[None]', '')}${opt('', 'Document Master', '')}${(d.masters || []).map((m) => opt(m.id, m.name, '')).join('')}</select></div>
        <div class="row2"><label>From page<input type="number" id="am-a" value="${(cur[0] ?? 0) + sp}"></label><label>To page<input type="number" id="am-b" value="${(cur[cur.length - 1] ?? 0) + sp}"></label></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="am-all"> All pages</label>`,
    });
    if (!r) return;
    const all = UI.checked(r.el, 'am-all');
    const a = all ? 0 : Math.max(0, Math.round(UI.num(r.el, 'am-a')) - sp), b = all ? d.pages.length - 1 : Math.min(d.pages.length - 1, Math.round(UI.num(r.el, 'am-b')) - sp);
    const v = UI.val(r.el, 'am-m');
    const idxs = []; for (let i = a; i <= b; i++) idxs.push(i);
    App.applyMaster(v === 'none' ? null : v, idxs);
  }
  async function masterOptions() {
    const id = App.view.master ? App.masterId() : App.masterSel;
    const m = BV.masterById(doc(), id);
    if (!m) return UI.status('Choose a named master page first.');
    const r = await UI.dialog({
      title: 'Master Page Options',
      html: `<div class="row"><label for="mo-n">Name</label><input type="text" id="mo-n" value="${esc(m.name)}"></div>
        <div class="row2"><label>Columns<input type="number" id="mo-c" min="1" value="${m.columns || doc().setup.columns}"></label><label>Gutter (${UL()})<input type="number" step="any" id="mo-g" value="${BV.fmt(m.gutter ?? doc().setup.gutter, U())}"></label></div>`,
    });
    if (!r) return;
    App.checkpoint();
    m.name = UI.val(r.el, 'mo-n').trim() || m.name; m.columns = Math.max(1, Math.round(UI.num(r.el, 'mo-c'))); m.gutter = BV.toPt(UI.num(r.el, 'mo-g'), U());
    App.changed(); App.refreshMasters();
  }

  // ------------------------------------------------------------------ frames and threads
  function stepFrame(dir) {
    const it = selItems().find((i) => i.type === 'text') || (textSel() && doc().items[doc().stories[App.sel.sid].frames[0]]);
    if (!it) return UI.status('Select a text block that is part of a thread.');
    const st = doc().stories[it.storyId];
    const i = st.frames.indexOf(it.id) + dir;
    if (i < 0 || i >= st.frames.length) return UI.status(dir > 0 ? 'This is the last text block of the story.' : 'This is the first text block of the story.');
    const nx = doc().items[st.frames[i]];
    if (App.sel.kind === 'text') App.leaveText();
    App.setTool('pointer');
    if (BV.isMasterRef(nx.page)) App.gotoSpread(0, BV.masterIdOfRef(nx.page) || true);
    else App.gotoPage(doc().pages.findIndex((p) => p.id === nx.page));
    App.sel = { kind: 'items', ids: [nx.id] };
    App.render();
  }
  function removeFromThreads() {
    const its = selItems().filter((i) => i.type === 'text');
    if (!its.length) return UI.status('Select the text block to take out of its thread.');
    App.checkpoint();
    for (const it of its) {
      const st = doc().stories[it.storyId];
      if (!st || st.frames.length < 2) continue;
      st.frames = st.frames.filter((f) => f !== it.id);
      const ns = BV.newStory(doc(), st.paras[0].style);
      ns.frames = [it.id];
      it.storyId = ns.id;
      App.markStory(st.id); App.markStory(ns.id);
    }
    App.changed();
    UI.status('Taken out of the thread: its text flowed on to the other blocks.');
  }

  // ------------------------------------------------------------------ masks, image control, transformations
  function mask() {
    const its = selItems();
    if (its.length < 2) return UI.status('Select a drawn shape and the objects it should mask (the shape must be on top).');
    const shape = its.slice().sort((a, b) => (b.z || 0) - (a.z || 0)).find((i) => ['rect', 'ellipse', 'polygon'].includes(i.type));
    if (!shape) return UI.status('One of the selected objects must be a rectangle, ellipse or polygon.');
    App.checkpoint();
    const g = BV.newId(doc(), 'g');
    for (const it of its) { it.group = g; if (it !== shape) it.maskBy = shape.id; }
    App.changed();
    UI.status('Masked (and grouped). Element ▸ Unmask removes the mask.');
  }
  function unmask() {
    const its = selItems();
    const ids = new Set(its.map((i) => i.id));
    const all = Object.values(doc().items).filter((i) => i.maskBy && (ids.has(i.id) || ids.has(i.maskBy)));
    if (!all.length) return UI.status('Select a masked object or its mask.');
    App.checkpoint();
    all.forEach((i) => delete i.maskBy);
    App.changed();
  }
  async function imageControl() {
    const its = selItems().filter((i) => i.src);
    if (!its.length) return UI.status('Select a placed picture first.');
    const ic = Object.assign({ bright: 0, contrast: 0, gray: false, invert: false }, its[0].imgCtl || {});
    const r = await UI.dialog({
      title: 'Image Control',
      html: `<div class="row"><label for="ic-b">Lightness (−100…100)</label><input type="range" id="ic-b" min="-100" max="100" value="${ic.bright}"></div>
        <div class="row"><label for="ic-c">Contrast (−100…100)</label><input type="range" id="ic-c" min="-100" max="100" value="${ic.contrast}"></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ic-g" ${ic.gray ? 'checked' : ''}> Grayscale</label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ic-i" ${ic.invert ? 'checked' : ''}> Negative</label>`,
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Default', value: 'reset' }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    App.checkpoint();
    for (const it of its) {
      if (r.value === 'reset') delete it.imgCtl;
      else it.imgCtl = { bright: +UI.val(r.el, 'ic-b'), contrast: +UI.val(r.el, 'ic-c'), gray: UI.checked(r.el, 'ic-g'), invert: UI.checked(r.el, 'ic-i') };
    }
    App.changed();
  }
  function removeTransform() {
    const its = selItems();
    if (!its.length) return UI.status('Select objects first.');
    App.checkpoint();
    for (const it of its) {
      delete it.rot; delete it.skew;
      if (it.flipX || it.flipY) { const b = BV.Render.box(it); if (it.flipX) it.cx = b.w - (it.cx ?? 0) - (it.cw ?? b.w); if (it.flipY) it.cy = b.h - (it.cy ?? 0) - (it.ch ?? b.h); delete it.flipX; delete it.flipY; }
    }
    App.changed();
  }

  // ------------------------------------------------------------------ links
  async function linksManager() {
    const its = Object.values(doc().items).filter((i) => i.src || i.link);
    if (!its.length) return UI.alert('This publication has no placed graphics.');
    const links = its.map((i) => i.link || { path: '' });
    const st = await native.linkStatus(links.filter((l) => l.path)).catch(() => []);
    let k = 0;
    const status = links.map((l) => (l.path ? st[k++] : null));
    const pageOf = (it) => { if (BV.isMasterRef(it.page)) return 'Master'; const i = doc().pages.findIndex((p) => p.id === it.page); return i >= 0 ? BV.pageLabel(doc(), i) : '?'; };
    const rows = its.map((it, i) => {
      const s = status[i];
      const state = !it.link ? 'Stored in publication' : !s || !s.exists ? '<b style="color:#b33">Missing</b>' : s.modified ? '<b style="color:#c70">Modified</b>' : 'OK';
      return `<tr data-id="${it.id}"><td>${esc(it.name || (it.link && it.link.path.split(/[\\/]/).pop()) || 'graphic')}</td><td>${esc(pageOf(it))}</td><td>${state}</td><td><button class="btn lk-up" type="button" ${it.link && s && s.exists ? '' : 'disabled'}>Update</button> <button class="btn lk-re" type="button">Relink…</button></td></tr>`;
    }).join('');
    await UI.dialog({
      title: 'Links Manager',
      width: 640,
      html: `<div style="max-height:320px;overflow:auto;border:1px solid var(--line);background:#fff"><table style="width:100%"><tr><th align="left">Graphic</th><th>Page</th><th>Status</th><th></th></tr>${rows}</table></div>
        <p class="note">Graphics are stored inside the publication, so it prints even if the originals move. Update reloads a changed original; Relink points a graphic at another file.</p>`,
      buttons: [{ label: 'Close', value: 'ok', primary: true }],
      onOpen: (el) => {
        el.addEventListener('click', async (e) => {
          const tr = e.target.closest('tr[data-id]');
          if (!tr) return;
          const it = doc().items[tr.dataset.id];
          let path = null;
          if (e.target.classList.contains('lk-up')) path = it.link.path;
          else if (e.target.classList.contains('lk-re')) path = await native.choosePath({ title: 'Relink', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'bmp'] }] });
          if (!path) return;
          const f = await native.place({ path });
          if (!f || f.kind !== 'image') return UI.status('That file could not be read as a graphic.');
          App.checkpoint();
          it.src = f.dataURL; it.link = f.link; it.name = f.name;
          App.changed();
          tr.children[2].textContent = 'OK';
          tr.children[0].textContent = f.name;
        });
      },
    });
  }
  async function linkInfo() {
    const it = selItems().find((i) => i.src || i.link);
    if (!it) return UI.status('Select a placed graphic first.');
    const l = it.link;
    let s = null;
    if (l) s = (await native.linkStatus([l]).catch(() => [null]))[0];
    UI.alert(`Name: ${it.name || 'graphic'}\nOriginal: ${l ? l.path : '(pasted, no original file)'}\n${l ? `Size: ${Math.round((l.size || 0) / 1024)} KB\nPlaced: ${new Date(l.mtime || 0).toLocaleString()}\nStatus: ${s && s.exists ? (s.modified ? 'the original has changed since it was placed' : 'up to date') : 'the original cannot be found'}\n` : ''}A full copy is stored in the publication.`);
  }

  // ------------------------------------------------------------------ plug-ins
  async function balanceColumns() {
    let its = selItems().filter((i) => i.type === 'text');
    if (its.length < 2) return UI.status('Select two or more threaded text blocks (columns) to balance.');
    const st = doc().stories[its[0].storyId];
    if (!its.every((i) => i.storyId === st.id)) return UI.status('The text blocks must belong to the same story.');
    its = st.frames.map((id) => doc().items[id]).filter((i) => its.includes(i));
    const r = await UI.dialog({
      title: 'Balance Columns',
      html: `<div class="row"><label for="bc-a">Alignment</label><select id="bc-a"><option value="top">Align to top</option><option value="bottom">Align to bottom</option></select></div>
        <div class="row"><label for="bc-l">Leftover lines</label><select id="bc-l"><option value="left">Add to left column</option><option value="right">Add to right column</option></select></div>`,
    });
    if (!r) return;
    App.checkpoint();
    const align = UI.val(r.el, 'bc-a');
    const top = Math.min(...its.map((i) => i.y)), bottom = Math.max(...its.map((i) => i.y + i.h));
    const lay0 = App.layoutFor(st);
    const lines = its.reduce((n, i) => n + (lay0.frames[i.id] ? lay0.frames[i.id].lines.length : 0), 0);
    const lh = lay0.lines.length ? lay0.lines.reduce((s, l) => s + l.h, 0) / lay0.lines.length : 14;
    const per = Math.ceil(lines / its.length);
    let h = Math.max(lh, per * lh);
    for (let tries = 0; tries < 60; tries++) {
      its.forEach((i) => { i.autoGrow = false; i.h = h; if (align === 'top') i.y = top; else i.y = bottom - h; });
      App.markStory(st.id);
      const lay = App.layoutFor(st);
      const used = its.map((i) => (lay.frames[i.id] || { lines: [] }).lines.length);
      const lastOk = its.indexOf(its[its.length - 1]);
      if (!lay.overflow && used[lastOk] > 0) break;
      h += lh / 2;
    }
    App.changed();
  }

  async function buildBooklet() {
    const d = doc();
    const r = await UI.dialog({
      title: 'Build Booklet',
      width: 520,
      html: `<div class="row"><label for="bb-l">Layout</label><select id="bb-l"><option value="saddle">2-up saddle stitch</option><option value="perfect">2-up perfect bound</option><option value="consec">2-up consecutive</option><option value="none">None (one page per sheet)</option></select></div>
        <div class="row2"><label>Space between pages (${UL()})<input type="number" step="any" id="bb-g" value="0"></label><label>Creep (${UL()}, total)<input type="number" step="any" id="bb-c" value="0"></label></div>
        <p class="note">${d.pages.length} pages. Blank pages are added to make a multiple of four for saddle stitching. The result is saved as a PDF of printer spreads; your publication is not changed.</p>`,
      buttons: [{ label: 'Build PDF…', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const lay = UI.val(r.el, 'bb-l');
    const gap = BV.toPt(UI.num(r.el, 'bb-g'), U()), creep = BV.toPt(UI.num(r.el, 'bb-c'), U());
    if (App.sel.kind === 'text') App.leaveText();
    const W = d.setup.w, H = d.setup.h;
    const pageSVG = (i, dx) => (i === null || i >= d.pages.length ? '' : `<svg x="${dx}" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="hidden">${BV.Render.pageContentSVG(d, i, App.getLayout, true)}</svg>`);
    let n = d.pages.length;
    const sheets = [];
    if (lay === 'none') for (let i = 0; i < n; i++) sheets.push([i]);
    else if (lay === 'consec') for (let i = 0; i < n; i += 2) sheets.push([i, i + 1 < n ? i + 1 : null]);
    else {
      const N = Math.ceil(n / 4) * 4;
      const sig = lay === 'perfect' ? 4 : N; // perfect bound: 4-page signatures, saddle: one nested signature
      for (let s0 = 0; s0 < N; s0 += sig) {
        const P = Math.min(sig, N - s0);
        for (let k = 0; k < P / 2; k++) {
          const a = s0 + P - 1 - k, b = s0 + k;
          sheets.push(k % 2 === 0 ? [a < n ? a : null, b < n ? b : null] : [b < n ? b : null, a < n ? a : null]);
        }
      }
    }
    const two = sheets[0].length === 2;
    const SW = two ? W * 2 + gap : W;
    let body = '';
    sheets.forEach((sh, si) => {
      const c = two && sheets.length > 1 ? creep * Math.abs((sheets.length / 2 - Math.floor(si / 2)) / (sheets.length / 2)) / 2 : 0;
      body += `<div class="pg"><svg xmlns="http://www.w3.org/2000/svg" width="${SW}pt" height="${H}pt" viewBox="0 0 ${SW} ${H}" text-rendering="geometricPrecision">${pageSVG(sh[0], -c)}${two ? pageSVG(sh[1], W + gap + c) : ''}</svg></div>`;
    });
    const css = `@page{size:${SW}pt ${H}pt;margin:0}html,body{margin:0}.pg{width:${SW}pt;height:${H}pt;overflow:hidden;break-after:page}.pg:last-child{break-after:auto}svg{display:block}`;
    UI.status('Building the booklet…', 0);
    const p = await native.exportPdf({ body, css, fontCss: App.fontCssText, defaultName: docBase() + ' booklet.pdf' });
    UI.status(p ? 'Booklet saved: ' + p.split(/[\\/]/).pop() : '');
    if (p) native.openExternal(p);
  }

  const KN_DIGITS = '೦೧೨೩೪೫೬೭೮೯', DV_DIGITS = '०१२३४५६७८९';
  const roman = (n) => { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
  const numFmt = (n, f) => f === 'kn' ? String(n).replace(/\d/g, (d) => KN_DIGITS[d]) : f === 'dv' ? String(n).replace(/\d/g, (d) => DV_DIGITS[d]) : f === 'I' ? roman(n).toUpperCase() : f === 'i' ? roman(n) : f === 'A' ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : f === 'a' ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : String(n);
  async function bullets() {
    const rs = paraRanges();
    if (!rs.length) return UI.status('Click into the paragraphs to number first.');
    const r = await UI.dialog({
      title: 'Bullets and Numbering',
      width: 520,
      html: `<div class="row"><label for="bn-k">Kind</label><select id="bn-k"><option value="bullet">Bullets</option><option value="num">Numbers</option><option value="remove">Remove bullets or numbers</option></select></div>
        <div class="row"><label for="bn-b">Bullet</label><select id="bn-b">${['•', '◦', '■', '□', '▪', '–', '—', '✓', '➢', '❖', '॰', '✽'].map((b) => opt(b, b, '•')).join('')}</select></div>
        <div class="row2"><label>Numbering style<select id="bn-f">${opt('1', '1, 2, 3', '1')}${opt('kn', '೧, ೨, ೩ (Kannada)', '')}${opt('dv', '१, २, ३ (Devanagari)', '')}${opt('I', 'I, II, III', '')}${opt('i', 'i, ii, iii', '')}${opt('A', 'A, B, C', '')}${opt('a', 'a, b, c', '')}</select></label>
          <label>Separator<select id="bn-s">${opt('.', '1.', '.')}${opt(')', '1)', '.')}${opt('', '1', '.')}${opt(':', '1:', '.')}</select></label>
          <label>Start at<input type="number" id="bn-n" value="1" min="0"></label>
          <label>Hanging indent (${UL()})<input type="number" step="any" id="bn-h" value="${BV.fmt(18, U())}"></label></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="bn-st"> Only paragraphs in the same style as the first one</label>`,
    });
    if (!r) return;
    const kind = UI.val(r.el, 'bn-k'), bch = UI.val(r.el, 'bn-b'), f = UI.val(r.el, 'bn-f'), sepc = UI.val(r.el, 'bn-s');
    let n = Math.round(UI.num(r.el, 'bn-n'));
    const hang = BV.toPt(UI.num(r.el, 'bn-h'), U());
    const only = UI.checked(r.el, 'bn-st');
    const re = /^([•◦■□▪–—✓➢❖॰✽]|[0-9೦-೯०-९]+[.):]?|[ivxlcdmIVXLCDM]+[.):]|[A-Za-z][.):])\t/;
    App.checkpoint();
    for (const { st, a, b } of rs) {
      const style0 = st.paras[a].style;
      for (let p = a; p <= b; p++) {
        const para = st.paras[p];
        if (only && para.style !== style0) continue;
        if (!T.paraText(para).trim() && kind !== 'remove') continue;
        const old = T.paraText(para).match(re);
        if (old) T.deleteRange(st, { p, o: 0 }, { p, o: old[0].length });
        if (kind === 'remove') { T.setParaOv(st, p, p, 'leftIndent', null); T.setParaOv(st, p, p, 'firstIndent', null); continue; }
        const mark = kind === 'bullet' ? bch : numFmt(n++, f) + sepc;
        T.insert(st, { p, o: 0 }, mark + '\t', T.attrsAt(para, 0));
        T.setParaOv(st, p, p, 'leftIndent', hang);
        T.setParaOv(st, p, p, 'firstIndent', -hang);
        T.setParaOv(st, p, p, 'tabs', [{ pos: hang, align: 'left' }]);
      }
      App.markStory(st.id);
    }
    App.sel.kind === 'text' && (App.sel = { kind: 'text', sid: App.sel.sid, a: { p: App.sel.a.p, o: 0 }, f: { p: App.sel.a.p, o: 0 } });
    App.changed();
  }

  async function changeCase() {
    const rs = charRanges();
    if (!rs.length) return UI.status('Select text first.');
    const r = await UI.dialog({
      title: 'Change Case',
      html: ['lower', 'UPPER', 'Title', 'Sentence'].map((v, i) => `<label class="check" style="flex-direction:row"><input type="radio" name="cc" value="${v}" ${i === 0 ? 'checked' : ''}> ${{ lower: 'lowercase', UPPER: 'UPPERCASE', Title: 'Title Case', Sentence: 'Sentence case' }[v]}</label>`).join('') + '<p class="note">Kannada and Devanagari have no capital letters and stay as they are.</p>',
    });
    if (!r) return;
    const mode = r.el.querySelector('input[name=cc]:checked').value;
    App.checkpoint();
    for (const { st, a, b } of rs) {
      for (let p = a.p; p <= b.p; p++) {
        const para = st.paras[p];
        const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(para).length;
        let off = 0, sentenceStart = s === 0, wordStart = true;
        for (const run of para.runs) {
          const r0 = off, r1 = off + run.t.length; off = r1;
          if (r1 <= s || r0 >= e) continue;
          const x = Math.max(s, r0) - r0, y = Math.min(e, r1) - r0;
          let out = '';
          for (const ch of run.t.slice(x, y)) {
            let c2 = ch;
            if (mode === 'lower') c2 = ch.toLowerCase();
            else if (mode === 'UPPER') c2 = ch.toUpperCase();
            else if (mode === 'Title') c2 = wordStart ? ch.toUpperCase() : ch.toLowerCase();
            else c2 = sentenceStart && /\p{L}/u.test(ch) ? ch.toUpperCase() : ch.toLowerCase();
            if (c2.length !== ch.length) c2 = ch;
            if (/\p{L}/u.test(ch)) sentenceStart = false;
            if (/[.!?।॥]/.test(ch)) sentenceStart = true;
            wordStart = /[\s\-–—(\[“"']/.test(ch);
            out += c2;
          }
          run.t = run.t.slice(0, x) + out + run.t.slice(y);
        }
      }
      App.markStory(st.id);
    }
    App.changed();
  }

  async function continuation() {
    const it = selItems().find((i) => i.type === 'text');
    if (!it) return UI.status('Select a threaded text block first.');
    const st = doc().stories[it.storyId];
    const i = st.frames.indexOf(it.id);
    const r = await UI.dialog({
      title: 'Continuation',
      html: `<label class="check" style="flex-direction:row"><input type="radio" name="cn" value="bottom" checked> Bottom of text block: “Continued on page…”</label>
        <label class="check" style="flex-direction:row"><input type="radio" name="cn" value="top"> Top of text block: “Continued from page…”</label>
        <div class="row2"><label>Wording (on)<input type="text" id="cn-on" value="Continued on page"></label><label>Wording (from)<input type="text" id="cn-from" value="Continued from page"></label></div>`,
    });
    if (!r) return;
    const where = r.el.querySelector('input[name=cn]:checked').value;
    const target = where === 'bottom' ? st.frames[i + 1] : st.frames[i - 1];
    if (!target) return UI.status(where === 'bottom' ? 'The text does not continue in another block.' : 'The text does not come from an earlier block.');
    const tp = doc().items[target];
    const pi = doc().pages.findIndex((p) => p.id === tp.page);
    const label = pi >= 0 ? BV.pageLabel(doc(), pi) : '?';
    App.checkpoint();
    if (!doc().styles['Cont. On']) doc().styles['Cont. On'] = Object.assign({}, BV.defaultStyles()['Body first'], { size: 8, leading: 11, italic: true, align: 'right' });
    if (!doc().styles['Cont. From']) doc().styles['Cont. From'] = Object.assign({}, BV.defaultStyles()['Body first'], { size: 8, leading: 11, italic: true, align: 'left' });
    const H = 13;
    it.autoGrow = false;
    let y;
    if (where === 'bottom') { it.h = Math.max(H, it.h - H); y = it.y + it.h; } else { y = it.y; it.y += H; it.h = Math.max(H, it.h - H); }
    const ns = BV.newStory(doc(), where === 'bottom' ? 'Cont. On' : 'Cont. From');
    ns.paras = [{ style: where === 'bottom' ? 'Cont. On' : 'Cont. From', runs: [{ t: `(${UI.val(r.el, where === 'bottom' ? 'cn-on' : 'cn-from')} ${label})` }] }];
    const n = BV.newItem(doc(), 'text', it.page, it.x, y, it.w, H, { storyId: ns.id, stroke: 'none', strokeWidth: 0, z: App.nextZ() });
    ns.frames = [n.id];
    App.markStory(st.id);
    App.refreshStyles();
    App.changed();
  }

  async function dropCap() {
    const c = App.currentParaProps();
    if (!c || !textSel()) return UI.status('Click into the paragraph that should start with a drop cap.');
    const r = await UI.dialog({
      title: 'Drop Cap',
      html: `<div class="row"><label for="dc-n">Size (lines)</label><input type="number" id="dc-n" min="2" max="10" value="${c.pp.dropCap || 3}"></div>
        <p class="note">The first letter (a whole Kannada or Devanagari akshara with its ottus) is enlarged across this many lines.</p>`,
      buttons: [{ label: 'Apply', value: 'ok', primary: true }, { label: 'Remove', value: 'rm' }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    setParaMany({ dropCap: r.value === 'rm' ? null : Math.max(2, Math.round(UI.num(r.el, 'dc-n'))) });
  }

  async function gridManager() {
    const d = doc();
    const r = await UI.dialog({
      title: 'Grid Manager',
      width: 520,
      html: `<div class="row2"><label>Columns<input type="number" id="gm-c" min="1" value="${d.setup.columns}"></label><label>Column gutter (${UL()})<input type="number" step="any" id="gm-g" value="${BV.fmt(d.setup.gutter, U())}"></label>
        <label>Rows<input type="number" id="gm-r" min="0" value="0"></label><label>Row gutter (${UL()})<input type="number" step="any" id="gm-rg" value="${BV.fmt(d.setup.gutter, U())}"></label>
        <label>Baseline grid (pt, 0 = none)<input type="number" step="any" id="gm-b" value="0"></label><label>Apply to<select id="gm-to"><option value="view">Pages in view</option><option value="all">All pages</option><option value="master">Current master page</option></select></label></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="gm-clear" checked> Replace the existing ruler guides</label>`,
    });
    if (!r) return;
    App.checkpoint();
    const cols = Math.max(1, Math.round(UI.num(r.el, 'gm-c'))), gut = BV.toPt(UI.num(r.el, 'gm-g'), U());
    const rows = Math.max(0, Math.round(UI.num(r.el, 'gm-r'))), rg = BV.toPt(UI.num(r.el, 'gm-rg'), U());
    const base = UI.num(r.el, 'gm-b');
    const to = UI.val(r.el, 'gm-to'), clear = UI.checked(r.el, 'gm-clear');
    const hGuides = (side) => {
      const m = BV.pageMargins(d, side), H = d.setup.h - m.top - m.bottom;
      const out = [];
      if (rows > 1) { const rh = (H - rg * (rows - 1)) / rows; for (let i = 1; i < rows; i++) { const y = m.top + i * rh + (i - 1) * rg; out.push(y, y + rg); } }
      if (base > 0) for (let y = m.top + base; y < d.setup.h - m.bottom; y += base) out.push(Math.round(y * 100) / 100);
      return out;
    };
    const applyTo = (g, side) => { if (clear) { g.h = []; g.v = []; } g.h.push(...hGuides(side)); };
    if (to === 'master') {
      const m = BV.masterById(d, App.masterId());
      if (m) { m.columns = cols; m.gutter = gut; } else { d.setup.columns = cols; d.setup.gutter = gut; }
      for (const side of ['L', 'R']) applyTo(m ? (m.guides = m.guides || { L: { h: [], v: [] }, R: { h: [], v: [] } })[side] : d.masterGuides[side], side);
    } else {
      const idxs = to === 'all' ? d.pages.map((_, i) => i) : App.placements.filter((p) => p.idx >= 0).map((p) => p.idx);
      for (const i of idxs) { const pg = d.pages[i]; pg.columns = cols; pg.gutter = gut; applyTo(pg.guides, BV.pageSide(d, i)); }
    }
    App.markAll(); App.changed();
  }

  async function keyline() {
    const its = selItems();
    if (!its.length) return UI.status('Select the object(s) to draw a keyline around.');
    const r = await UI.dialog({
      title: 'Keyline',
      html: `<div class="row"><label for="kl-e">Extends (pt; − inside)</label><input type="number" step="any" id="kl-e" value="3"></div>
        <div class="row2"><label>Stroke (pt)<input type="number" step="any" id="kl-w" value="0.5"></label><label>Stroke colour<select id="kl-c">${colorOptions('#000000')}</select></label>
        <label>Fill<select id="kl-f"><option value="none">None</option>${colorOptions('')}</select></label><label>Position<select id="kl-p"><option value="back">Behind the object</option><option value="front">In front</option></select></label></div>`,
    });
    if (!r) return;
    App.checkpoint();
    const e = UI.num(r.el, 'kl-e');
    const b = App.selBounds(its);
    const z = UI.val(r.el, 'kl-p') === 'back' ? Math.min(...its.map((i) => i.z || 0)) - 1 : App.nextZ();
    const k = BV.newItem(doc(), 'rect', its[0].page, b.x - e, b.y - e, b.w + 2 * e, b.h + 2 * e, { stroke: UI.val(r.el, 'kl-c'), strokeWidth: UI.num(r.el, 'kl-w'), fill: UI.val(r.el, 'kl-f') || 'none', z });
    App.sel = { kind: 'items', ids: [...its.map((i) => i.id), k.id] };
    App.changed();
  }

  async function runningHeads() {
    const d = doc();
    const styles = Object.keys(d.styles);
    const guess = styles.find((s) => /chapter|heading/i.test(s)) || styles[0];
    const r = await UI.dialog({
      title: 'Running Headers/Footers',
      width: 560,
      html: `<div class="row2"><label>Content: paragraphs in style<select id="rh-s">${styles.map((s) => opt(s, s, guess)).join('')}</select></label>
          <label>Which one on the page<select id="rh-w"><option value="first">First on the page</option><option value="last">Last on the page</option></select></label>
          <label>When the page has none<select id="rh-c"><option value="carry">Repeat the last one used</option><option value="blank">Leave blank</option></select></label>
          <label>Pages<select id="rh-p"><option value="both">Left and right</option><option value="L">Left pages</option><option value="R">Right pages</option></select></label>
          <label>Position<select id="rh-pos"><option value="top">Header (above the top margin)</option><option value="bottom">Footer (below the bottom margin)</option></select></label>
          <label>Text style<select id="rh-ts">${styles.map((s) => opt(s, s, d.styles['Running head'] ? 'Running head' : styles[0])).join('')}</select></label>
          <label>Prefix<input type="text" id="rh-pre" value=""></label><label>Suffix<input type="text" id="rh-suf" value=""></label></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="rh-skip" checked> Skip pages where a paragraph in that style starts (chapter openers)</label>
        <p class="note">Text blocks are added to each page (as PageMaker’s plug-in does). Run it again after editing to bring them up to date, earlier ones are replaced.</p>`,
    });
    if (!r) return;
    const sty = UI.val(r.el, 'rh-s'), which = UI.val(r.el, 'rh-w'), carry = UI.val(r.el, 'rh-c') === 'carry';
    const pages = UI.val(r.el, 'rh-p'), pos = UI.val(r.el, 'rh-pos'), ts = UI.val(r.el, 'rh-ts');
    const pre = UI.val(r.el, 'rh-pre'), suf = UI.val(r.el, 'rh-suf'), skip = UI.checked(r.el, 'rh-skip');
    App.checkpoint();
    App.deleteItems(Object.values(d.items).filter((i) => i.rhGen).map((i) => i.id));
    // find paragraphs of that style per page
    const perPage = d.pages.map(() => []);
    for (const st of Object.values(d.stories)) {
      if (App.isMasterStory(st)) continue;
      const lay = App.layoutFor(st);
      for (const l of lay.lines) {
        if (!l.first || st.paras[l.para].style !== sty) continue;
        const it = d.items[l.frame];
        const pi = d.pages.findIndex((p) => p.id === it.page);
        if (pi >= 0) perPage[pi].push({ y: it.y + l.top, x: it.x, text: T.paraText(st.paras[l.para]).replace(/[\u2028\t]/g, ' ').replace(/[\u00AD\uE001\uE002]/g, '').trim() });
      }
    }
    let last = '';
    let made = 0;
    d.pages.forEach((pg, i) => {
      const list = perPage[i].sort((a, b) => a.y - b.y || a.x - b.x);
      const hit = list.length ? (which === 'first' ? list[0] : list[list.length - 1]).text : '';
      const text = hit || (carry ? last : '');
      if (list.length) last = list[list.length - 1].text;
      const side = BV.pageSide(d, i);
      if (pages !== 'both' && pages !== side) return;
      if (skip && list.length && list[0].y < d.setup.margins.top + 80) return;
      if (!text) return;
      const m = BV.pageMargins(d, side);
      const H = 14;
      const y = pos === 'top' ? Math.max(4, m.top - H - 6) : d.setup.h - m.bottom + 6;
      const ns = BV.newStory(d, ts);
      ns.paras = [{ style: ts, runs: [{ t: pre + text + suf }] }];
      const it = BV.newItem(d, 'text', pg.id, m.left, y, d.setup.w - m.left - m.right, H, { storyId: ns.id, stroke: 'none', strokeWidth: 0, z: App.nextZ(), rhGen: true });
      ns.frames = [it.id];
      made++;
    });
    App.changed();
    UI.status(`Running ${pos === 'top' ? 'headers' : 'footers'} placed on ${made} pages.`);
  }

  async function sortPages() {
    const d = doc();
    let order = d.pages.map((_, i) => i);
    const label = (i) => BV.pageLabel(d, i);
    const thumb = (i) => {
      const W = d.setup.w, H = d.setup.h, s = 90 / H;
      return `<svg width="${Math.round(W * s)}" height="90" viewBox="0 0 ${W} ${H}" style="background:#fff;border:1px solid #999;display:block">${BV.Render.pageContentSVG(d, i, App.getLayout, true)}</svg>`;
    };
    const draw = (box) => {
      box.innerHTML = order.map((i, k) => `<div class="sp-pg" draggable="true" data-k="${k}" style="display:inline-block;margin:4px;text-align:center;cursor:grab">${thumb(i)}<div style="font-size:11px">${esc(label(i))}${k !== i ? ' → ' + esc(BV.translit.numerals(d.setup.startPage + k, d.setup.numbering)) : ''}</div></div>`).join('');
    };
    const r = await UI.dialog({
      title: 'Sort Pages',
      width: 760,
      html: `<p class="note">Drag pages into the new order. Numbers show old → new.</p><div id="sp-box" style="max-height:420px;overflow:auto;background:#e8e8e8;padding:6px;border:1px solid var(--line)"></div>`,
      onOpen: (el) => {
        const box = el.querySelector('#sp-box');
        draw(box);
        let from = null;
        box.addEventListener('dragstart', (e) => { const t = e.target.closest('.sp-pg'); if (t) from = +t.dataset.k; });
        box.addEventListener('dragover', (e) => e.preventDefault());
        box.addEventListener('drop', (e) => {
          e.preventDefault();
          const t = e.target.closest('.sp-pg');
          if (from === null || !t) return;
          const to = +t.dataset.k;
          const [x] = order.splice(from, 1);
          order.splice(to, 0, x);
          from = null;
          draw(box);
        });
      },
    });
    if (!r) return;
    if (order.every((v, i) => v === i)) return;
    App.checkpoint();
    d.pages = order.map((i) => d.pages[i]);
    App.markAll(); App.changed();
    App.gotoSpread(App.view.spread);
  }

  function wordCount() {
    let stories = App.selectedStories();
    const scope = stories.length ? 'Selected story' : 'Whole publication';
    if (!stories.length) stories = Object.values(doc().stories);
    let chars = 0, words = 0, sents = 0, paras = 0;
    for (const st of stories) for (const p of st.paras) {
      const t = T.paraText(p).replace(/[\u00AD\uE001\uE002]/g, '');
      if (t.trim()) paras++;
      chars += [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)].length;
      words += [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(t)].filter((s) => s.isWordLike).length;
      sents += (t.match(/[.!?।॥]+(\s|$)/g) || []).length;
    }
    UI.alert(`${scope}\n\nCharacters (aksharas count as one): ${chars.toLocaleString()}\nWords: ${words.toLocaleString()}\nSentences: ${sents.toLocaleString()}\nParagraphs: ${paras.toLocaleString()}`);
  }

  // CSV parsing for Data Merge
  function parseCSV(text) {
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"') q = true;
      else if (c === ',' || c === '\t') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  async function dataMerge() {
    const p = await native.choosePath({ title: 'Data Merge: choose the data source', filters: [{ name: 'CSV or tab-separated text', extensions: ['csv', 'txt', 'tsv'] }] });
    if (!p) return;
    const rows = parseCSV(await native.readFile(p));
    if (rows.length < 2) return UI.alert('The data file needs a header row with field names and at least one record.');
    const fields = rows[0].map((s) => s.trim());
    const d = doc();
    const used = new Set();
    for (const st of Object.values(d.stories)) for (const pa of st.paras) for (const m of T.paraText(pa).matchAll(/<<([^<>]+)>>/g)) used.add(m[1]);
    const r = await UI.dialog({
      title: 'Data Merge',
      width: 520,
      html: `<p class="note">${rows.length - 1} records · fields: ${fields.map(esc).join(', ')}</p>
        <p class="note">Type field names in your text as <b>&lt;&lt;Field&gt;&gt;</b>. ${used.size ? 'Found in the publication: ' + [...used].map(esc).join(', ') : '<b>No &lt;&lt;fields&gt;&gt; found in the text yet.</b>'}</p>
        <p class="note">A copy of all ${d.pages.length} page(s) is made for each record, in a new untitled publication.</p>`,
      buttons: [{ label: 'Merge', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const nd = clone(d);
    nd.pages = []; nd.items = {}; nd.stories = {};
    for (const [k, v] of Object.entries(d.items)) if (BV.isMasterRef(v.page)) nd.items[k] = clone(v);
    for (const st of Object.values(d.stories)) if (App.isMasterStory(st)) nd.stories[st.id] = clone(st);
    const fill = (t, rec) => t.replace(/<<([^<>]+)>>/g, (m, f) => { const i = fields.indexOf(f.trim()); return i >= 0 ? rec[i] ?? '' : m; });
    for (const rec of rows.slice(1)) {
      const map = {};
      for (const pg of d.pages) { const np = clone(pg); np.id = BV.newId(nd, 'p'); map[pg.id] = np.id; nd.pages.push(np); }
      const smap = {};
      for (const it of Object.values(d.items)) {
        if (!map[it.page]) continue;
        const n = clone(it); n.id = BV.newId(nd, 'i'); n.page = map[it.page];
        if (n.type === 'text') {
          if (!smap[it.storyId]) { const s0 = d.stories[it.storyId]; const ns = { id: BV.newId(nd, 's'), paras: clone(s0.paras), frames: [] }; ns.paras.forEach((pa) => pa.runs.forEach((rr) => (rr.t = fill(rr.t, rec)))); smap[it.storyId] = { ns, src: s0 }; nd.stories[ns.id] = ns; }
          n.storyId = smap[it.storyId].ns.id;
        }
        delete n.group;
        nd.items[n.id] = n;
        if (n.type === 'text') { const { ns, src } = smap[it.storyId]; ns.frames[src.frames.indexOf(it.id)] = n.id; }
      }
      for (const { ns } of Object.values(smap)) ns.frames = ns.frames.filter(Boolean);
    }
    App.setDoc(nd, null);
    App.docName = docBase() + ' merged';
    App.setDirty(true);
    UI.status(`Merged ${rows.length - 1} records into ${nd.pages.length} pages.`);
  }

  async function packageFiles() {
    const dir = await native.chooseFolder({ title: 'Save for Service Provider: choose an empty folder' });
    if (!dir) return;
    const d = doc();
    UI.status('Packaging…', 0);
    const name = docBase();
    const files = [{ name: name + '.bvm', text: BV.serialize(d) }];
    let n = 0;
    for (const it of Object.values(d.items)) {
      if (!it.src || !/^data:/.test(it.src)) continue;
      const m = it.src.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) continue;
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[m[1]] || 'bin';
      files.push({ name: `Links/${String(++n).padStart(3, '0')}-${(it.name || 'graphic').replace(/\.[^.]+$/, '').replace(/[^\wಀ-೿ऀ-ॿ -]/g, '_')}.${ext}`, base64: m[2] });
    }
    const pf = await preflightReport();
    files.push({ name: 'Report.txt', text: pf.text });
    await native.writeMany({ dir, files });
    const copied = await native.copyFonts({ dir: dir + '/Fonts', families: App.docFonts() }).catch(() => []);
    // the PDF goes with it, so the press can check
    const { body, css } = BV.Render.printHTML(d, App.getLayout);
    await native.exportPdfTo({ body, css, fontCss: App.fontCssText, filePath: dir + '/' + name + '.pdf' }).catch(() => null);
    UI.status('');
    UI.alert(`Saved in ${dir}:\n• ${name}.bvm and ${name}.pdf\n• ${n} graphic(s) in Links\n• ${copied.length} font file(s) in Fonts\n• Report.txt (preflight)${pf.problems ? `\n\nPreflight found ${pf.problems} problem(s), see Report.txt.` : ''}`);
    native.reveal(dir + '/' + name + '.bvm');
  }

  // ------------------------------------------------------------------ Unicode Kannada → Nudi/Baraha ASCII
  function convertToNudi() {
    const rs = charRanges();
    if (!rs.length) return UI.status('Select the Unicode Kannada text (or its text block) first.');
    App.checkpoint();
    let n = 0;
    for (const { st, a, b } of rs) {
      for (let p = a.p; p <= b.p; p++) {
        const para = st.paras[p];
        const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(para).length;
        let off = 0;
        const out = [];
        for (const run of para.runs) {
          const r0 = off, r1 = off + run.t.length; off = r1;
          if (r1 <= s || r0 >= e || !/[ಀ-೿]/.test(run.t)) { out.push(run); continue; }
          const x = Math.max(s, r0) - r0, y = Math.min(e, r1) - r0;
          const mid = run.t.slice(x, y);
          const asc = BV.Legacy.unicodeToNudi(mid).replace(/[\u200B-\u200D]/g, ''); // Nudi shows the halant itself
          const prevFont = run.legacy && /^nudi(-ascii)?:/.test(run.legacy) ? run.legacy.replace(/^nudi(-ascii)?:/, '') : 'Nudi 01 e';
          if (x > 0) out.push(Object.assign({}, run, { t: run.t.slice(0, x) }));
          out.push(Object.assign({}, run, { t: asc, font: prevFont, legacy: 'nudi-ascii:' + prevFont }));
          if (y < run.t.length) out.push(Object.assign({}, run, { t: run.t.slice(y) }));
          n += [...mid].length;
        }
        para.runs = out;
        T.normalize(para);
      }
      App.markStory(st.id);
    }
    App.ensureFonts(['Nudi 01 e']);
    App.changed();
    UI.status(n ? `${n.toLocaleString()} Kannada characters converted to Nudi ASCII (Brahmavidya converter).` : 'No Unicode Kannada found in the selection.');
  }

  // ------------------------------------------------------------------ spelling
  async function spelling() {
    let stories = App.selectedStories();
    if (!stories.length) stories = Object.values(doc().stories);
    const list = [];
    const seg = new Intl.Segmenter('en', { granularity: 'word' });
    for (const st of stories) st.paras.forEach((para, p) => {
      const t = T.paraText(para).replace(/\u00AD/g, ' ');
      for (const w of seg.segment(t)) {
        if (!w.isWordLike || !/^[A-Za-z][A-Za-z'’]*$/.test(w.segment) || w.segment.length < 2) continue;
        if (native.isMisspelled(w.segment)) list.push({ st, p, o: w.index, w: w.segment });
      }
    });
    if (!list.length) return UI.alert('Spelling: no misspelled English words found.\n\n(Kannada, Devanagari and IAST words are not checked.)');
    const ignore = new Set();
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (ignore.has(x.w)) continue;
      const cur = T.paraText(x.st.paras[x.p]).slice(x.o, x.o + x.w.length);
      if (cur !== x.w) continue;
      // show the word
      const fr = x.st.frames.map((id) => doc().items[id]).find(Boolean);
      if (fr && !App.isMasterStory(x.st)) App.gotoPage(doc().pages.findIndex((pg) => pg.id === fr.page));
      App.setTool('text');
      App.sel = { kind: 'text', sid: x.st.id, a: { p: x.p, o: x.o }, f: { p: x.p, o: x.o + x.w.length } };
      App.render(); App.ensureCaretVisible();
      const sug = native.suggestions(x.w) || [];
      const r = await UI.dialog({
        title: 'Spelling',
        html: `<p class="note" style="color:var(--ink)">Unknown word: <b>${esc(x.w)}</b> (${i + 1} of ${list.length})</p>
          <div class="row"><label for="sp-to">Change to</label><input type="text" id="sp-to" value="${esc(sug[0] || x.w)}"></div>
          <select id="sp-s" size="5" style="width:100%">${sug.map((s) => `<option>${esc(s)}</option>`).join('')}</select>`,
        onOpen: (el) => { el.querySelector('#sp-s').onchange = (e) => (el.querySelector('#sp-to').value = e.target.value); },
        buttons: [{ label: 'Replace', value: 'rep', primary: true }, { label: 'Ignore', value: 'ign' }, { label: 'Ignore all', value: 'all' }, { label: 'Stop', value: null }],
      });
      if (!r) return;
      if (r.value === 'all') { ignore.add(x.w); continue; }
      if (r.value === 'ign') continue;
      const to = UI.val(r.el, 'sp-to');
      App.checkpoint();
      const attrs = T.attrsAt(x.st.paras[x.p], x.o + 1);
      T.deleteRange(x.st, { p: x.p, o: x.o }, { p: x.p, o: x.o + x.w.length });
      T.insert(x.st, { p: x.p, o: x.o }, to, attrs);
      const d0 = to.length - x.w.length;
      for (let j = i + 1; j < list.length; j++) if (list[j].st === x.st && list[j].p === x.p) list[j].o += d0;
      App.changed(x.st.id);
    }
    UI.status('Spelling check complete.');
  }

  // ------------------------------------------------------------------ Book
  async function book() {
    const d = doc();
    d.book = d.book || [];
    const draw = (el) => { el.querySelector('#bk-l').innerHTML = d.book.map((p) => `<option>${esc(p)}</option>`).join(''); };
    const r = await UI.dialog({
      title: 'Book Publication List',
      width: 620,
      html: `<p class="note">The publications of a book, in order. Use it to number pages through the whole book and to export the whole book as one PDF.</p>
        <select id="bk-l" size="8" style="width:100%"></select>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" type="button" id="bk-add">Add…</button><button class="btn" type="button" id="bk-rm">Remove</button><button class="btn" type="button" id="bk-up">Move up</button><button class="btn" type="button" id="bk-dn">Move down</button></div>
        <div class="row" style="margin-top:8px"><label for="bk-num">Auto renumbering</label><select id="bk-num"><option value="none">None</option><option value="next">Next page</option><option value="odd">Next odd page</option></select></div>`,
      onOpen: (el) => {
        draw(el);
        const L = el.querySelector('#bk-l');
        el.querySelector('#bk-add').onclick = async () => { const ps = await native.openMany({ title: 'Add publications to the book', filters: [{ name: 'BV Mudrana', extensions: ['bvm'] }] }); if (ps) { d.book.push(...ps.filter((p) => !d.book.includes(p))); draw(el); } };
        el.querySelector('#bk-rm').onclick = () => { if (L.selectedIndex >= 0) { d.book.splice(L.selectedIndex, 1); draw(el); } };
        const mv = (k) => { const i = L.selectedIndex, j = i + k; if (i < 0 || j < 0 || j >= d.book.length) return; [d.book[i], d.book[j]] = [d.book[j], d.book[i]]; draw(el); L.selectedIndex = j; };
        el.querySelector('#bk-up').onclick = () => mv(-1);
        el.querySelector('#bk-dn').onclick = () => mv(1);
        el.querySelector('#bk-num').value = d.bookNumbering || 'none';
      },
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Export book PDF…', value: 'pdf' }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    d.bookNumbering = UI.val(r.el, 'bk-num');
    App.setDirty(true);
    if (r.value === 'pdf') return exportBookPdf();
  }
  async function exportBookPdf() {
    const d = doc();
    if (!d.book || !d.book.length) return UI.status('Add publications to the book list first.');
    if (App.sel.kind === 'text') App.leaveText();
    const keep = App.doc;
    let body = '', css = '', page = null, fonts = [];
    try {
      UI.status('Collecting the book…', 0);
      for (const p of d.book) {
        const content = await native.readFile(p);
        const bd = BV.deserialize(content);
        if (page !== null && d.bookNumbering && d.bookNumbering !== 'none') { let s = page; if (d.bookNumbering === 'odd' && s % 2 === 0) s++; bd.setup.startPage = s; }
        App.doc = bd; App.markAll();
        fonts.push(...App.docFonts());
        await App.ensureFonts(App.docFonts());
        const h = BV.Render.printHTML(bd, App.getLayout);
        body += h.body; css = h.css;
        page = bd.setup.startPage + bd.pages.length;
      }
    } catch (e) { App.doc = keep; App.markAll(); App.render(); return UI.alert('Could not read a book publication: ' + e.message); }
    App.doc = keep; App.markAll(); App.render();
    const out = await native.exportPdf({ body, css, fontCss: App.fontCssText, defaultName: docBase() + ' (book).pdf' });
    UI.status(out ? 'Book PDF saved.' : '');
    if (out) native.openExternal(out);
  }

  // ------------------------------------------------------------------ Index
  async function indexEntry() {
    const ts = textSel();
    if (!ts) return UI.status('Click into the text where the index entry should point (or select the word to index).');
    const st = doc().stories[ts.sid];
    const [a, b] = T.order(ts.a, ts.f);
    const word = a.p === b.p ? T.paraText(st.paras[a.p]).slice(a.o, b.o).replace(/[\u00AD\uE001\uE002]/g, '').trim() : '';
    const r = await UI.dialog({
      title: 'Add Index Entry',
      width: 520,
      html: `<div class="row"><label for="ie-1">Topic (level 1)</label><input type="text" id="ie-1" value="${esc(word)}"></div>
        <div class="row"><label for="ie-2">Level 2</label><input type="text" id="ie-2"></div>
        <div class="row"><label for="ie-3">Level 3</label><input type="text" id="ie-3"></div>
        <div class="row"><label for="ie-sort">Sort as</label><input type="text" id="ie-sort" placeholder="(same as topic)"></div>
        <div class="row"><label for="ie-t">Type</label><select id="ie-t"><option value="page">Page reference: current page</option><option value="see">Cross-reference: See</option><option value="seealso">Cross-reference: See also</option></select></div>
        <div class="row"><label for="ie-x">Cross-reference to</label><input type="text" id="ie-x"></div>`,
    });
    if (!r) return;
    const topics = ['ie-1', 'ie-2', 'ie-3'].map((k) => UI.val(r.el, k).trim()).filter(Boolean);
    if (!topics.length) return;
    App.checkpoint();
    const id = BV.newId(doc(), 'x');
    doc().index[id] = { topics, sort: UI.val(r.el, 'ie-sort').trim() || null, type: UI.val(r.el, 'ie-t'), see: UI.val(r.el, 'ie-x').trim() };
    const pos = T.insert(st, a, '\uE001', Object.assign({}, T.attrsAt(st.paras[a.p], a.o), { ix: id }));
    App.sel = { kind: 'text', sid: st.id, a: pos, f: pos };
    App.changed(st.id);
    UI.status('Index entry added: ' + topics.join(' › '));
  }
  // where every index marker lands: {id: [page labels]}
  function indexPages() {
    const d = doc();
    const out = {};
    for (const st of Object.values(d.stories)) {
      const lay = App.layoutFor(st);
      st.paras.forEach((para, p) => {
        let off = 0;
        for (const run of para.runs) {
          if (run.ix && run.t.includes('\uE001')) {
            const o = off + run.t.indexOf('\uE001');
            const line = lay.lines.find((l) => l.para === p && o >= l.s && o <= l.e) || lay.lines.find((l) => l.para === p);
            const it = line && d.items[line.frame];
            const pi = it ? d.pages.findIndex((pg) => pg.id === it.page) : -1;
            (out[run.ix] = out[run.ix] || []).push(pi >= 0 ? { label: BV.pageLabel(d, pi), n: pi } : null);
          }
          off += run.t.length;
        }
      });
    }
    return out;
  }
  async function showIndex() {
    const d = doc();
    const pages = indexPages();
    const ids = Object.keys(d.index).filter((id) => pages[id]);
    if (!ids.length) return UI.alert('There are no index entries yet. Use Utilities ▸ Index Entry (Ctrl+Y).');
    const rows = ids.sort((a, b) => d.index[a].topics.join('\u0001').localeCompare(d.index[b].topics.join('\u0001'))).map((id) => {
      const e = d.index[id];
      const where = e.type === 'page' ? pages[id].filter(Boolean).map((x) => x.label).join(', ') || '(not on a page)' : (e.type === 'see' ? 'See ' : 'See also ') + e.see;
      return `<tr data-id="${id}"><td>${esc(e.topics.join(' › '))}</td><td>${esc(where)}</td><td><button class="btn ix-rm" type="button">Remove</button></td></tr>`;
    }).join('');
    await UI.dialog({
      title: 'Show Index',
      width: 600,
      html: `<div style="max-height:360px;overflow:auto;border:1px solid var(--line);background:#fff"><table style="width:100%">${rows}</table></div>`,
      buttons: [{ label: 'Close', value: 'ok', primary: true }],
      onOpen: (el) => el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('ix-rm')) return;
        const tr = e.target.closest('tr');
        const id = tr.dataset.id;
        App.checkpoint();
        for (const st of Object.values(d.stories)) { let ch = false; for (const p of st.paras) { for (const run of p.runs) if (run.ix === id) { run.t = run.t.replace(/\uE001/g, ''); delete run.ix; ch = true; } T.normalize(p); } if (ch) App.markStory(st.id); }
        delete d.index[id];
        tr.remove();
        App.changed();
      }),
    });
  }
  async function createIndex() {
    const d = doc();
    const pages = indexPages();
    const ids = Object.keys(d.index).filter((id) => pages[id]);
    if (!ids.length) return UI.alert('There are no index entries yet. Use Utilities ▸ Index Entry (Ctrl+Y).');
    const r = await UI.dialog({
      title: 'Create Index',
      html: `<div class="row"><label for="ci-t">Title</label><input type="text" id="ci-t" value="Index"></div>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ci-h" checked> Section headings (A, B, C…)</label>
        <div class="row"><label for="ci-s">Between topic and page numbers</label><select id="ci-s"><option value=", ">comma</option><option value="\t">tab (with a right tab)</option><option value="  ">two spaces</option></select></div>`,
    });
    if (!r) return;
    const sepr = UI.val(r.el, 'ci-s');
    // build a tree
    const tree = {};
    for (const id of ids) {
      const e = d.index[id];
      let node = tree;
      e.topics.forEach((t, k) => {
        node[t] = node[t] || { pages: new Set(), xref: [], kids: {}, sort: k === 0 && e.sort ? e.sort : t };
        if (k === e.topics.length - 1) { if (e.type === 'page') pages[id].filter(Boolean).forEach((x) => node[t].pages.add(x.n)); else node[t].xref.push((e.type === 'see' ? 'See ' : 'See also ') + e.see); }
        node = node[t].kids;
      });
    }
    for (const n of ['Index title', 'Index level 1', 'Index level 2', 'Index level 3', 'Index section']) if (!d.styles[n]) {
      const b = BV.defaultStyles()['Body first'];
      d.styles[n] = Object.assign({}, b, n === 'Index title' ? { size: 16, bold: true, align: 'center', spaceAfter: 12 } : n === 'Index section' ? { bold: true, spaceBefore: 8, keepNext: true, align: 'left' } : { align: 'left', size: 10, leading: 14, leftIndent: 12 * (+n.slice(-1) - 1) + 12, firstIndent: -12, tabs: sepr === '\t' ? [{ pos: 1000, align: 'right' }] : null });
    }
    const paras = [{ style: 'Index title', runs: [{ t: UI.val(r.el, 'ci-t') }] }];
    const head = UI.checked(r.el, 'ci-h');
    let lastHead = '';
    const walk = (node, lvl) => {
      for (const t of Object.keys(node).sort((a, b) => node[a].sort.localeCompare(node[b].sort))) {
        const n = node[t];
        if (lvl === 1 && head) { const h = [...n.sort][0].toUpperCase(); if (h !== lastHead) { lastHead = h; paras.push({ style: 'Index section', runs: [{ t: h }] }); } }
        const pg = [...n.pages].sort((a, b) => a - b).map((i) => BV.pageLabel(d, i));
        const tail = [pg.join(', '), ...n.xref].filter(Boolean).join('. ');
        paras.push({ style: 'Index level ' + lvl, runs: [{ t: t + (tail ? sepr + tail : '') }] });
        walk(n.kids, Math.min(3, lvl + 1));
      }
    };
    walk(tree, 1);
    App.refreshStyles();
    App.loadTextForPlacing(paras);
    UI.status(`Index with ${paras.length - 1} lines is loaded, click to place it.`, 0);
  }

  // ------------------------------------------------------------------ Define Colors
  async function defineColors() {
    const d = doc();
    const draw = (el) => { el.querySelector('#dc-l').innerHTML = d.colors.map((c) => `<option value="${esc(c.name)}">■ ${esc(c.name)}  (${c.hex})</option>`).join(''); [...el.querySelectorAll('#dc-l option')].forEach((o, i) => (o.style.color = d.colors[i].hex === '#ffffff' ? '#999' : d.colors[i].hex)); };
    await UI.dialog({
      title: 'Define Colors',
      html: `<select id="dc-l" size="10" style="width:100%"></select>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" type="button" id="dc-new">New…</button><button class="btn" type="button" id="dc-ed">Edit…</button><button class="btn" type="button" id="dc-rm">Remove</button></div>`,
      buttons: [{ label: 'Close', value: 'ok', primary: true }],
      onOpen: (el) => {
        draw(el);
        const L = el.querySelector('#dc-l');
        // the colour dialogs open on top; the list is redrawn when they close
        el.querySelector('#dc-new').onclick = async () => { await App.editColor(null); draw(el); };
        el.querySelector('#dc-ed').onclick = async () => { if (L.value) { await App.editColor(L.value); draw(el); } };
        L.ondblclick = async () => { if (L.value) { await App.editColor(L.value); draw(el); } };
        el.querySelector('#dc-rm').onclick = async () => { if (L.value) { await App.deleteColor(L.value); draw(el); } };
      },
    });
  }

  // ------------------------------------------------------------------ Preflight
  async function preflightReport() {
    const d = doc();
    const lines = [];
    let problems = 0;
    const fonts = App.docFonts();
    const missing = fonts.filter((f) => !(App.fontSet || new Set(App.fontList)).has(f));
    lines.push(`Publication: ${docBase()}`, `Pages: ${d.pages.length}  ·  Page size: ${Math.round(d.setup.w / BV.UNITS.mm)} × ${Math.round(d.setup.h / BV.UNITS.mm)} mm`, '');
    lines.push('FONTS', ...fonts.map((f) => `  ${missing.includes(f) ? '✗ MISSING  ' : '✓ '}${f}${App.symbolFonts && App.symbolFonts.has(f) ? '  (symbol/legacy encoding)' : ''}`), '');
    problems += missing.length;
    const imgs = Object.values(d.items).filter((i) => i.src || i.link);
    const links = imgs.filter((i) => i.link).map((i) => i.link);
    const st = links.length ? await native.linkStatus(links).catch(() => []) : [];
    lines.push('GRAPHICS');
    let k = 0;
    for (const it of imgs) {
      const s = it.link ? st[k++] : null;
      const img = new Image(); img.src = it.src || '';
      const b = BV.Render.box(it);
      const dpi = img.naturalWidth ? Math.round(img.naturalWidth / (b.w / 72)) : 0;
      const bad = (it.link && s && !s.exists) || (dpi && dpi < 150);
      if (bad) problems++;
      lines.push(`  ${bad ? '✗' : '✓'} ${it.name || 'graphic'}${dpi ? `  ${dpi} dpi` : ''}${dpi && dpi < 150 ? ' (low for print)' : ''}${it.link && s && !s.exists ? '  original missing (copy in publication is used)' : ''}`);
    }
    if (!imgs.length) lines.push('  none');
    lines.push('', 'TEXT');
    let overset = 0, empties = 0;
    for (const s of Object.values(d.stories)) { const lay = App.layoutFor(s); if (lay.overflow) { overset++; lines.push(`  ✗ Overset text: “${T.paraText(s.paras[0]).slice(0, 40)}…” does not fit its text blocks`); } }
    for (const it of Object.values(d.items)) if (it.type === 'text' && App.isEmptyFrame(it)) empties++;
    problems += overset;
    if (!overset) lines.push('  ✓ All text fits');
    if (empties) lines.push(`  · ${empties} empty text block(s)`);
    const offPage = Object.values(d.items).filter((it) => { if (BV.isMasterRef(it.page)) return false; const b = BV.Render.box(it); return b.x + b.w < 0 || b.x > d.setup.w || b.y + b.h < 0 || b.y > d.setup.h; }).length;
    if (offPage) lines.push(`  · ${offPage} object(s) on the pasteboard (they do not print)`);
    const nudi = Object.values(d.stories).some((s) => s.paras.some((p) => p.runs.some((r) => r.legacy && /ascii/.test(r.legacy))));
    if (nudi) lines.push('  · Some Kannada is kept as Nudi ASCII text, the Nudi fonts must be installed at the press');
    lines.push('', problems ? `${problems} problem(s) found.` : 'No problems found.');
    return { text: lines.join('\r\n'), problems };
  }
  async function preflight() {
    UI.status('Checking…', 0);
    const r = await preflightReport();
    UI.status('');
    const res = await UI.dialog({ title: 'Preflight', width: 620, html: `<pre style="max-height:420px;overflow:auto;background:#fff;border:1px solid var(--line);padding:8px;font:12px Consolas,monospace;white-space:pre-wrap">${esc(r.text)}</pre>`, buttons: [{ label: 'Close', value: 'ok', primary: true }, { label: 'Save report…', value: 'save' }] });
    if (res && res.value === 'save') native.saveText({ content: r.text, defaultName: docBase() + ' preflight.txt' });
  }

  // ------------------------------------------------------------------ Library palette (objects kept between publications)
  async function library() {
    const lib = App.store.get('library', []);
    const draw = (el) => { el.querySelector('#lb-l').innerHTML = lib.map((x, i) => `<option value="${i}">${esc(x.name)}: ${x.items.items.length} object(s)</option>`).join(''); };
    const r = await UI.dialog({
      title: 'Library',
      width: 520,
      html: `<select id="lb-l" size="10" style="width:100%"></select>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" type="button" id="lb-add">Add selected objects</button><button class="btn" type="button" id="lb-ren">Rename…</button><button class="btn" type="button" id="lb-rm">Remove</button></div>
        <p class="note">Library items stay available in every publication. Choose one and click Place.</p>`,
      buttons: [{ label: 'Place', value: 'place', primary: true }, { label: 'Close', value: null }],
      onOpen: (el) => {
        draw(el);
        const L = el.querySelector('#lb-l');
        el.querySelector('#lb-add').onclick = async () => {
          const its = selItems();
          if (!its.length) return UI.status('Select objects on the page first.');
          const items = its.map(clone);
          const stories = {};
          for (const it of items) if (it.type === 'text') stories[it.storyId] = clone(doc().stories[it.storyId]);
          const name = await UI.prompt('Library', 'Name', its[0].name || (its[0].type === 'text' ? T.paraText(doc().stories[its[0].storyId].paras[0]).slice(0, 30) : its[0].type));
          if (name === null) return;
          lib.push({ name: name || 'Item', items: { items, stories } });
          App.store.set('library', lib);
          draw(el);
        };
        el.querySelector('#lb-ren').onclick = async () => { const i = +L.value; if (isNaN(i) || !lib[i]) return; const v = await UI.prompt('Library', 'Name', lib[i].name); if (v) { lib[i].name = v; App.store.set('library', lib); draw(el); } };
        el.querySelector('#lb-rm').onclick = () => { const i = +L.value; if (isNaN(i) || !lib[i]) return; lib.splice(i, 1); App.store.set('library', lib); draw(el); };
      },
    });
    if (!r) return;
    const i = +r.el.querySelector('#lb-l').value;
    const x = lib[i];
    if (!x) return;
    placeLibrary(x);
  }
  function placeLibrary(x) {
    const d = doc();
    const pl = App.placements[0];
    App.checkpoint();
    const smap = {};
    const ids = [];
    const b = App.selBounds(x.items.items);
    const W = d.setup.w, H = d.setup.h;
    const dx = (W - b.w) / 2 - b.x, dy = (H - b.h) / 2 - b.y;
    for (const it0 of x.items.items) {
      const it = clone(it0);
      it.id = BV.newId(d, 'i'); it.page = pl.ref; it.x += dx; it.y += dy; it.z = App.nextZ(); it.layer = d.activeLayer;
      delete it.group;
      if (it.type === 'text') {
        if (!smap[it0.storyId]) { const ns = BV.newStory(d); ns.paras = clone(x.items.stories[it0.storyId].paras); ns.paras.forEach((p) => { if (!d.styles[p.style]) p.style = Object.keys(d.styles)[0]; }); smap[it0.storyId] = ns; }
        it.storyId = smap[it0.storyId].id;
        smap[it0.storyId].frames.push(it.id);
      }
      d.items[it.id] = it;
      ids.push(it.id);
    }
    App.setTool('pointer');
    App.sel = { kind: 'items', ids };
    App.changed();
  }

  // ------------------------------------------------------------------ Hyperlinks
  async function hyperlinks() {
    const d = doc();
    const cur = (() => { const ts = textSel(); if (!ts) return null; return T.attrsAt(d.stories[ts.sid].paras[ts.f.p], ts.f.o).link || null; })();
    const its = selItems();
    const r = await UI.dialog({
      title: 'Hyperlinks',
      width: 520,
      html: `<div class="row"><label for="hl-u">URL or e-mail</label><input type="text" id="hl-u" list="hl-dl" value="${esc(cur || (its[0] && its[0].link && typeof its[0].link === 'string' ? its[0].link : 'https://'))}"><datalist id="hl-dl">${d.hyperlinks.map((u) => `<option value="${esc(u)}">`).join('')}</datalist></div>
        <p class="note">Select text (or an object) and add a link. Links work in exported PDF and HTML.</p>`,
      buttons: [{ label: 'Apply', value: 'ok', primary: true }, { label: 'Remove link', value: 'rm' }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    let u = UI.val(r.el, 'hl-u').trim();
    if (u && !/^(https?:|mailto:|file:)/i.test(u)) u = /@/.test(u) ? 'mailto:' + u : 'https://' + u;
    const val = r.value === 'rm' || !u || u === 'https://' ? null : u;
    if (val && !d.hyperlinks.includes(val)) d.hyperlinks.push(val);
    if (textSel()) return App.applyChar({ link: val });
    if (!its.length) return UI.status('Select text or an object first.');
    App.checkpoint(); its.forEach((i) => { if (val) i.href = val; else delete i.href; }); App.changed();
  }

  // ------------------------------------------------------------------ Paste Special
  async function pasteSpecial() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (_) {}
    const r = await UI.dialog({
      title: 'Paste Special',
      html: `<label class="check" style="flex-direction:row"><input type="radio" name="ps" value="plain" checked> Text only (no formatting)</label>
        <label class="check" style="flex-direction:row"><input type="radio" name="ps" value="nudi"> Nudi / Baraha ASCII text → convert to Unicode Kannada</label>
        <label class="check" style="flex-direction:row"><input type="radio" name="ps" value="praja"> Praja ASCII text → convert to Unicode Kannada</label>
        <label class="check" style="flex-direction:row"><input type="radio" name="ps" value="objects" ${App.clipItems ? '' : 'disabled'}> BV Mudrana objects (as copied)</label>
        <p class="note">${text ? `${[...text].length} characters on the clipboard.` : 'No text on the clipboard.'}</p>`,
    });
    if (!r) return;
    const mode = r.el.querySelector('input[name=ps]:checked').value;
    if (mode === 'objects') return App.pasteItems();
    if (!text) return;
    if (mode === 'nudi') text = BV.Legacy.nudiToUnicode(text);
    if (mode === 'praja') text = BV.Legacy.prajaToUnicode(text);
    if (App.sel.kind !== 'text') return UI.status('Click into text with the text tool first.');
    App.insertText(text.replace(/\r\n?/g, '\n').normalize('NFC'));
  }

  // ------------------------------------------------------------------ preferences: layout adjustment
  async function prefsLayout() {
    const p = Object.assign({ adjust: true, guides: true, ignoreOutside: true }, App.store.get('layoutAdjust', {}));
    const r = await UI.dialog({
      title: 'Layout Adjustment Preferences',
      html: `<label class="check" style="flex-direction:row"><input type="checkbox" id="la-a" ${p.adjust ? 'checked' : ''}> Adjust layout when page size or margins change</label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="la-g" ${p.guides ? 'checked' : ''}> Allow ruler guides to move</label>
        <label class="check" style="flex-direction:row"><input type="checkbox" id="la-o" ${p.ignoreOutside ? 'checked' : ''}> Ignore objects outside the page</label>`,
    });
    if (!r) return;
    App.store.set('layoutAdjust', { adjust: UI.checked(r.el, 'la-a'), guides: UI.checked(r.el, 'la-g'), ignoreOutside: UI.checked(r.el, 'la-o') });
  }
  // Layout adjustment: objects inside the live area move and resize with the new margins and page size
  App.adjustLayout = function (o, n) {
    const p = Object.assign({ adjust: true, guides: true, ignoreOutside: true }, App.store.get('layoutAdjust', {}));
    if (!p.adjust) return;
    const same = o.w === n.w && o.h === n.h && JSON.stringify(o.margins) === JSON.stringify(n.margins) && o.doubleSided === n.doubleSided;
    if (same) return;
    const d = doc();
    const area = (S, side) => { const m = side === 'L' ? { l: S.margins.outside, r: S.margins.inside } : { l: S.margins.inside, r: S.margins.outside }; if (!S.doubleSided) { m.l = S.margins.inside; m.r = S.margins.outside; } return { x: m.l, y: S.margins.top, w: S.w - m.l - m.r, h: S.h - S.margins.top - S.margins.bottom }; };
    const sideOf = (ref) => { if (BV.isMasterRef(ref)) return String(ref).slice(-1); const i = d.pages.findIndex((pg) => pg.id === ref); return i >= 0 ? BV.pageSide(d, i) : 'R'; };
    const mapX = (x, A, B) => B.x + (x - A.x) * (B.w / A.w), mapY = (y, A, B) => B.y + (y - A.y) * (B.h / A.h);
    for (const it of Object.values(d.items)) {
      const side = sideOf(it.page);
      const A = area(o, side), B = area(n, side);
      const b = BV.Render.box(it);
      if (p.ignoreOutside && (b.x + b.w < 0 || b.x > o.w || b.y + b.h < 0 || b.y > o.h)) continue;
      const nx = mapX(b.x, A, B), ny = mapY(b.y, A, B);
      const resize = it.type === 'text' || it.type === 'line' || it.type === 'rect';
      const sx = resize ? B.w / A.w : 1, sy = resize && it.type !== 'text' ? B.h / A.h : 1;
      if (it.type === 'line') { it.x = mapX(it.x, A, B); it.y = mapY(it.y, A, B); it.w *= sx; it.h *= sy; continue; }
      it.x = nx; it.y = ny;
      if (resize) { it.w = b.w * sx; it.h = b.h * (it.type === 'text' ? B.h / A.h : sy); }
    }
    if (p.guides) {
      const mv = (g, side) => { const A = area(o, side), B = area(n, side); g.v = g.v.map((x) => mapX(x, A, B)); g.h = g.h.map((y) => mapY(y, A, B)); };
      d.pages.forEach((pg, i) => mv(pg.guides, BV.pageSide(d, i)));
      for (const s of ['L', 'R']) mv(d.masterGuides[s], s);
    }
  };

  // ------------------------------------------------------------------ exports
  async function exportGraphic() {
    if (App.sel.kind === 'text') App.leaveText();
    const d = doc();
    const pl = App.placements.find((p) => p.idx >= 0) || App.placements[0];
    const r = await UI.dialog({
      title: 'Export Graphic',
      html: `<div class="row"><label for="eg-w">What</label><select id="eg-w"><option value="page">Page ${esc(pl.pageText || '')}</option>${selItems().length ? '<option value="sel">Selected objects</option>' : ''}<option value="all">Every page (one file each)</option></select></div>
        <div class="row"><label for="eg-f">Format</label><select id="eg-f"><option value="png">PNG</option><option value="jpg">JPEG</option><option value="svg">SVG (vector)</option></select></div>
        <div class="row"><label for="eg-r">Resolution (dpi)</label><select id="eg-r">${[72, 150, 300, 600].map((v) => opt(v, v + ' dpi', 300)).join('')}</select></div>`,
    });
    if (!r) return;
    const what = UI.val(r.el, 'eg-w'), fmt = UI.val(r.el, 'eg-f'), dpi = +UI.val(r.el, 'eg-r');
    const W = d.setup.w, H = d.setup.h;
    const pageIdx = what === 'all' ? d.pages.map((_, i) => i) : [pl.idx >= 0 ? pl.idx : 0];
    let vb = [0, 0, W, H];
    let inner = (i) => BV.Render.pageContentSVG(d, i, App.getLayout, true);
    if (what === 'sel') {
      const its = selItems();
      const b = App.selBounds(its);
      vb = [b.x - 2, b.y - 2, b.w + 4, b.h + 4];
      inner = () => its.map((it) => BV.Render.itemSVG(d, it, App.getLayout, pl.pageText)).join('');
    }
    const svgOf = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="${vb[2]}pt" height="${vb[3]}pt" viewBox="${vb.join(' ')}"${fmt !== 'png' ? ' style="background:#fff"' : ''}>${fmt === 'jpg' ? `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#fff"/>` : ''}${inner(i)}</svg>`;
    if (fmt === 'svg') {
      for (const i of pageIdx) {
        const p = await native.exportFile({ defaultName: `${docBase()} p${BV.pageLabel(d, i)}.svg`, filters: [{ name: 'SVG', extensions: ['svg'] }], data: `<?xml version="1.0" encoding="UTF-8"?>\n<style>${App.fontCssText ? '' : ''}</style>` + svgOf(i) });
        if (!p) return;
      }
      return UI.status('Exported.');
    }
    const scale = dpi / 72;
    let dir = null;
    if (pageIdx.length > 1) { dir = await native.chooseFolder({ title: 'Export every page: choose a folder' }); if (!dir) return; }
    UI.status('Exporting…', 0);
    for (const i of pageIdx) {
      const body = `<div style="width:${vb[2] * scale}px;height:${vb[3] * scale}px">${svgOf(i).replace(/width="[^"]+pt" height="[^"]+pt"/, `width="${vb[2] * scale}" height="${vb[3] * scale}"`)}</div>`;
      const opts = { body, css: 'html,body{margin:0;background:' + (fmt === 'png' ? 'transparent' : '#fff') + '}svg{display:block}', fontCss: App.fontCssText, width: vb[2] * scale, height: vb[3] * scale, format: fmt, defaultName: `${docBase()} p${BV.pageLabel(d, i)}.${fmt}` };
      if (dir) opts.filePath = `${dir}/${docBase()} p${BV.pageLabel(d, i)}.${fmt}`;
      const p = await native.exportPng(opts);
      if (!p) break;
    }
    UI.status('Exported.');
  }

  function storyOrder() {
    // stories in reading order: by the page of their first text block, then top to bottom
    const d = doc();
    const pageNo = (ref) => (BV.isMasterRef(ref) ? -1 : d.pages.findIndex((p) => p.id === ref));
    return Object.values(d.stories).filter((s) => s.frames.length && !App.isMasterStory(s) && !s.frames.every((f) => d.items[f] && d.items[f].rhGen)).map((s) => { const f = d.items[s.frames[0]]; return { s, k: pageNo(f.page) * 1e6 + f.y * 10 + f.x / 100 }; }).sort((a, b) => a.k - b.k).map((x) => x.s);
  }
  App.storyOrder = storyOrder;
  async function exportHtml() {
    const d = doc();
    const slug = (s) => 'st-' + s.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
    const css = Object.entries(d.styles).map(([n, s]) => `.${slug(n)}{font-family:"${s.font}",serif;font-size:${s.size}pt;line-height:${s.leading === 'auto' ? 1.2 : s.leading / s.size};text-align:${s.align === 'force' ? 'justify' : s.align};margin:${s.spaceBefore || 0}pt ${s.rightIndent || 0}pt ${s.spaceAfter || 0}pt ${s.leftIndent || 0}pt;text-indent:${s.firstIndent || 0}pt;${s.bold ? 'font-weight:bold;' : ''}${s.italic ? 'font-style:italic;' : ''}color:${s.color || '#000'}}`).join('\n');
    const runHTML = (r, pp) => {
      let t = esc(r.t.replace(/[\u00AD\uE001\uE002]/g, '').replace(/\uE000/g, '#')).replace(/\u2028/g, '<br>').replace(/\t/g, '&emsp;');
      const st = [];
      if (r.font) st.push(`font-family:"${r.font}"`);
      if (r.size) st.push(`font-size:${r.size}pt`);
      if (r.color) st.push(`color:${r.color}`);
      if (r.bold !== undefined) st.push(`font-weight:${r.bold ? 'bold' : 'normal'}`);
      if (r.italic !== undefined) st.push(`font-style:${r.italic ? 'italic' : 'normal'}`);
      if (r.underline) st.push('text-decoration:underline');
      if (r.strike) st.push('text-decoration:line-through');
      if (r.caps) st.push('text-transform:uppercase');
      if (r.smallCaps) st.push('font-variant:small-caps');
      if (r.track) st.push(`letter-spacing:${r.track}em`);
      if (st.length) t = `<span style='${st.join(';')}'>${t}</span>`;
      if (r.pos === 'sup') t = `<sup>${t}</sup>`; else if (r.pos === 'sub') t = `<sub>${t}</sub>`;
      if (r.link) t = `<a href="${esc(r.link)}">${t}</a>`;
      return t;
    };
    let body = '';
    for (const s of storyOrder()) {
      body += '<section>\n';
      for (const p of s.paras) {
        const pp = BV.paraProps(d, p);
        const tag = /chapter|title/i.test(p.style) ? 'h1' : /heading/i.test(p.style) ? 'h2' : 'p';
        body += `<${tag} class="${slug(p.style)}">${p.runs.map((r) => runHTML(r, pp)).join('') || '&nbsp;'}</${tag}>\n`;
      }
      body += '</section>\n';
    }
    const imgs = Object.values(d.items).filter((i) => i.src && !BV.isMasterRef(i.page));
    if (imgs.length) body += imgs.map((i) => `<figure><img src="${i.src}" alt="${esc(i.name || '')}" style="max-width:100%"></figure>`).join('\n');
    const html = `<!doctype html>\n<html lang="kn"><head><meta charset="utf-8"><title>${esc(docBase())}</title>\n<style>body{max-width:42em;margin:2em auto;padding:0 1em}\n${css}</style></head><body>\n${body}</body></html>`;
    const p = await native.exportFile({ defaultName: docBase() + '.html', filters: [{ name: 'HTML', extensions: ['html', 'htm'] }], data: html });
    if (p) UI.status('HTML saved: ' + p.split(/[\\/]/).pop());
  }
  async function exportTags() {
    const stories = App.selectedStories();
    const list = stories.length ? stories : storyOrder();
    if (!list.length) return UI.status('There is no text to export.');
    const hasKn = list.some((s) => s.paras.some((p) => /[ಀ-೿]/.test(T.paraText(p))));
    const r = await UI.dialog({
      title: 'Export PageMaker Tagged Text',
      html: `<p class="note">${stories.length ? 'The selected story' : `All ${list.length} stories, in page order,`} will be saved as PageMaker tagged text (Place it in PageMaker with “Read tags”).</p>
        ${hasKn ? `<fieldset><legend>Unicode Kannada</legend><label class="check" style="flex-direction:row"><input type="radio" name="tk" value="nudi" checked> Convert to Nudi ASCII (PageMaker 7 cannot show Unicode Kannada)</label><label class="check" style="flex-direction:row"><input type="radio" name="tk" value="keep"> Keep Unicode (for programs that read Unicode)</label></fieldset>` : ''}`,
    });
    if (!r) return;
    const nudi = !hasKn || r.el.querySelector('input[name=tk]:checked').value === 'nudi';
    const res = BV.PMExport.taggedText(doc(), list, { nudi });
    const p = await native.exportFile({ defaultName: docBase() + '.txt', filters: [{ name: 'PageMaker tagged text', extensions: ['txt'] }], data: { base64: res.base64 } });
    if (p) UI.status('Tagged text saved' + (res.warnings.length ? '. ' + res.warnings[0] : '.'));
  }

  // ------------------------------------------------------------------ zero point, snap to rulers, view toggles
  App.zeroPt = null;
  function syncState() {
    native.menuState({ snapRulers: !!App.snapRulers, zeroLock: !!App.zeroLock, guidesFront: !!App.guidesFront, scrollbars: !document.body.classList.contains('no-scrollbars'), displayPara: !!App.seShowPara, displayStyleNames: App.seShowStyles !== false });
  }
  function resetPalettes() {
    const defaults = { 'pal-tools': 'left:34px;top:112px', 'pal-control': 'left:110px;bottom:50px', 'pal-sc': 'right:28px;top:112px', 'pal-lm': 'right:28px;top:470px', 'iast-pal': 'right:280px;top:120px', 'pal-pages': 'left:110px;top:112px', 'pal-align': 'left:370px;top:112px', 'pal-glyph': 'right:290px;top:140px' };
    for (const [id, css] of Object.entries(defaults)) {
      const el = $(id);
      if (!el) continue;
      el.style.left = el.style.top = el.style.right = el.style.bottom = '';
      for (const kv of css.split(';')) { const [k, v] = kv.split(':'); el.style[k] = v; }
      App.store.set('panel.' + id, null);
      if (id !== 'iast-pal') App.showPanel(id, true);
    }
  }

  // ------------------------------------------------------------------ Save / Save As (.bvm, .bvt, .pmd, .pm7, .p65, .pmt)
  const extOf = (p) => (String(p).match(/\.([^.\\/]+)$/) || [, ''])[1].toLowerCase();
  App.saveDoc = async function (saveAs) {
    if (!$('story-editor').hidden) App.closeStoryEditor();
    let target = App.filePath;
    if (!target || saveAs) {
      const defExt = target ? extOf(target) : App.idSource ? 'idml' : App.pmSource ? ({ p65: 'p65', pm7: 'pm7', pmt: 'pmt' }[extOf(App.pmSource.name)] || 'pmd') : 'bvm';
      target = await native.saveAsDialog({ defaultName: docBase(), defaultExt: defExt });
      if (!target) return null;
    }
    const ext = extOf(target);
    if (['pmd', 'pm7', 'p65', 'pmt', 't65'].includes(ext)) return App.saveToPageMaker(target);
    if (['idml', 'indd', 'indt'].includes(ext) && App.saveToInDesign) return App.saveToInDesign(target);
    if (ext === 'pm6' || ext === 'pt6') { UI.alert('PageMaker 7 cannot save in PageMaker 6.0 format (it saves 7.0 and 6.5). Choose .p65 for PageMaker 6.5, or .pmd for PageMaker 7.'); return null; }
    const content = BV.serialize(doc());
    const p = await native.writeBvm({ filePath: target, content });
    if (!p) return null;
    App.filePath = p;
    App.docName = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    App.setDirty(false);
    UI.status('Saved ' + p.split(/[\\/]/).pop());
    return p;
  };
  // graphics as PNG/JPEG/GIF files that PageMaker 7 can import
  async function prepareImages(d) {
    const out = {};
    for (const it of Object.values(d.items)) {
      if (!it.src) continue;
      const m = it.src.match(/^data:([^;,]+)(;base64)?,(.*)$/);
      if (!m) continue;
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[m[1]];
      if (ext && m[2]) { out[it.id] = { ext, base64: m[3] }; continue; }
      try {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = it.src; });
        const b = BV.Render.box(it);
        const cw = it.cw ?? b.w, ch = it.ch ?? b.h;
        const sc = Math.max(1, 300 / 72);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth || cw * sc)); c.height = Math.max(1, Math.round(img.naturalHeight || ch * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out[it.id] = { ext: 'png', base64: c.toDataURL('image/png').split(',')[1] };
      } catch (_) { /* left out; reported by the exporter */ }
    }
    return out;
  }
  App.saveToPageMaker = async function (target) {
    if (App.sel.kind === 'text') App.leaveText();
    const d = doc();
    const p = Object.assign({ nudiFont: 'Nudi 01 e', alsoBvm: true }, App.store.get('pmSave', {}));
    const legacy = {};
    for (const st of Object.values(d.stories)) for (const pa of st.paras) for (const r of pa.runs) if (r.legacy && /^(nudi|praja)/.test(r.legacy)) { const f = r.legacy.replace(/^(nudi|praja)(-ascii)?:/, ''); legacy[f] = (legacy[f] || 0) + r.t.length; }
    const common = Object.entries(legacy).sort((a, b) => b[1] - a[1])[0];
    const hasKn = Object.values(d.stories).some((st) => st.paras.some((pa) => /[\u0C80-\u0CFF]/.test(T.paraText(pa))));
    const hasDeva = Object.values(d.stories).some((st) => st.paras.some((pa) => /[\u0900-\u097F\u0100-\u017F\u1E00-\u1EFF]/.test(T.paraText(pa))));
    let pm = await native.pmFind().catch(() => null);
    const name = target.split(/[\\/]/).pop();
    const onWindows = native.platform === 'win32';
    let kitOnly = false;
    if (!pm && onWindows) {
      // PageMaker 7 is needed to write its own file format: ask where it is instead of silently making a kit
      const q = await UI.dialog({
        title: 'Where is PageMaker 7?',
        width: 560,
        html: `<p class="note" style="color:var(--ink)">To save <b>${esc(name)}</b> in PageMaker format, BV Mudrana has PageMaker 7 build and save it (PageMaker’s file format is private, so only PageMaker itself can write it).</p>
          <p class="note">PageMaker 7 was not found in the usual folders. Show BV Mudrana where <b>Pm70.exe</b> is, usually <b>C:\\Program Files (x86)\\Adobe\\PageMaker 7.0\\</b>. It is remembered for next time.</p>`,
        buttons: [{ label: 'Locate Pm70.exe…', value: 'locate', primary: true }, { label: 'Make a PageMaker kit instead', value: 'kit' }, { label: 'Cancel', value: null }],
      });
      if (!q) return null;
      if (q.value === 'locate') { pm = await native.pmLocate(); if (!pm) return null; }
      else kitOnly = true;
    }
    const r = await UI.dialog({
      title: 'Save as PageMaker publication',
      width: 600,
      html: `<p class="note" style="color:var(--ink)">Saving <b>${esc(name)}</b>. ${pm ? `PageMaker 7 (<span style="word-break:break-all">${esc(pm)}</span>) builds and saves the publication. It opens while this runs, please don’t click in it until BV Mudrana says the file is saved.` : onWindows ? 'A <b>PageMaker kit</b> folder is made next to the file: run its script in PageMaker 7 to get the publication.' : 'PageMaker 7 runs on Windows only, so a <b>PageMaker kit</b> folder is made next to the file: run its script in PageMaker 7 on a Windows computer.'}</p>
        ${hasKn ? `<div class="row"><label for="ps-nf">ASCII font for Kannada</label>${fontBox('ps-nf', common ? common[0] : p.nudiFont)}</div><p class="note">PageMaker 7 cannot show Unicode Kannada, so it is turned back into ASCII: text that came from Praja goes back to Praja, the rest to the font named here. Name a Nudi or Baraha font for the Nudi layout, or a Praja font (for example Praja) for the Praja layout.</p>` : ''}
        ${hasDeva ? '<p class="note" style="color:var(--danger)">Devanagari and IAST letters (ā, ś, ṛ…) have no place in PageMaker 7’s character set; they will appear as “?”. Keep the .bvm for those.</p>' : ''}
        <label class="check" style="flex-direction:row"><input type="checkbox" id="ps-bvm" ${p.alsoBvm ? 'checked' : ''}> Also save a BV Mudrana copy (.bvm) beside it, it keeps everything exactly</label>`,
      buttons: [{ label: 'Save', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return null;
    const nudiFont = hasKn ? UI.val(r.el, 'ps-nf').trim() || 'Nudi 01 e' : p.nudiFont;
    const alsoBvm = UI.checked(r.el, 'ps-bvm');
    App.store.set('pmSave', { nudiFont, alsoBvm });
    UI.status('Preparing the PageMaker files…', 0);
    let job;
    try {
      const images = await prepareImages(d);
      const ext = extOf(target);
      job = BV.PMExport.build(d, { kind: ext === 'p65' ? 'p65' : ext === 'pmt' || ext === 't65' ? 'pmt' : 'pmd', nudiFont, images });
    } catch (e) {
      UI.status('');
      console.error(e);
      UI.alert('BV Mudrana could not prepare the PageMaker files: ' + (e.message || e) + '\n\nNothing was saved. Please send this message to the developers.');
      return null;
    }
    if (alsoBvm) {
      const bp = target.replace(/\.[^.\\/]+$/, '.bvm');
      await native.writeBvm({ filePath: bp, content: BV.serialize(d) });
      App.filePath = bp;
    }
    if (native.onPmProgress && !App._pmProg) { App._pmProg = true; native.onPmProgress((m) => { if (App._pmListener) App._pmListener(m); }); }
    App._pmListener = (m) => { if (m.message) UI.status(m.message, 0); else if (m.step) UI.status(`PageMaker is building the publication… ${Math.round((m.step / m.of) * 100)}%`, 0); };
    const res = await native.pmSave({ target, steps: job.steps, spt: job.spt, files: job.files, name: docBase(), exe: pm || undefined, kitOnly }).catch((e) => ({ ok: false, reason: e.message }));
    App._pmListener = null;
    UI.status('');
    const warn = job.warnings.concat((res.errors || []).slice(0, 5).map((e) => 'PageMaker reported: ' + e));
    if (alsoBvm) App.setDirty(false);
    if (res.ok) {
      UI.status('Saved ' + name + ' (PageMaker 7)', 8000);
      const r3 = await UI.dialog({
        title: 'Saved in PageMaker format',
        html: `<p class="note" style="color:var(--ink)"><b>${esc(name)}</b> was saved by PageMaker 7:<br><span style="word-break:break-all">${esc(target)}</span></p>${warn.length ? `<p class="note" style="white-space:pre-wrap">${esc(warn.join('\n\n'))}</p>` : ''}`,
        buttons: [{ label: 'Show in folder', value: 'show', primary: true }, { label: 'Close', value: null }],
      });
      if (r3) native.reveal(target);
      return target;
    }
    const msg = res.kitOnly
      ? `A PageMaker kit was saved:\n${res.kit}\n\nOpen its README.txt: copy the folder as it says, then run “Build publication.spt” from PageMaker’s Scripts palette. PageMaker then builds and saves ${name}.`
      : `${name} was NOT saved in PageMaker format.\n\n${res.reason || 'PageMaker could not be driven.'}${res.kit ? `\n\nEverything needed is kept in a PageMaker kit:\n${res.kit}\n(Its README.txt explains how to finish in PageMaker.)` : ''}${res.log ? `\n\nPageMaker’s answers are in “PageMaker log.txt” in that folder, please send it to the developers.` : ''}${warn.length ? '\n\n' + warn.join('\n\n') : ''}`;
    const btns = [{ label: res.kit ? 'Show the kit' : 'OK', value: 'show', primary: true }];
    if (!res.kitOnly && onWindows) btns.push({ label: 'Locate PageMaker…', value: 'locate' });
    btns.push({ label: 'Close', value: null });
    const r2 = await UI.dialog({ title: res.kitOnly ? 'PageMaker kit saved' : 'Not saved in PageMaker format', html: `<p class="note" style="color:var(--ink);white-space:pre-wrap">${esc(msg)}</p>`, buttons: btns });
    if (r2 && r2.value === 'show' && res.kit) native.reveal((res.log || res.kit + '/README.txt'));
    if (r2 && r2.value === 'locate') { const np = await native.pmLocate(); if (np) return App.saveToPageMaker(target); }
    return null;
  };

  // ------------------------------------------------------------------ dispatcher
  const prev2 = App.command2;
  App.command2 = async function (cmd, arg) {
    if (cmd.startsWith('fill:tint')) {
      const its = selItems().filter((i) => i.type !== 'line');
      if (!its.length) return UI.status('Select a shape first.');
      App.checkpoint();
      const sc = doc().colors.find((c) => c.name === App.selectedColor);
      its.forEach((i) => { i.fill = sc && sc.name !== 'Paper' ? sc.hex : '#000000'; i.fillTint = +cmd.slice(9); });
      return App.changed();
    }
    if (cmd === 'fill:solid') { selItems().forEach((i) => delete i.fillTint); }
    if (cmd.startsWith('stroke:') && ['double', 'thickthin', 'thinthick', 'triple', 'transparent', 'reverse'].includes(cmd.slice(7))) {
      const v = cmd.slice(7);
      const its = selItems().filter((i) => i.type !== 'text');
      if (!its.length) return UI.status('Select a line or shape first.');
      App.checkpoint();
      its.forEach((i) => {
        if (v === 'transparent') i.strokeTransparent = !i.strokeTransparent;
        else if (v === 'reverse') { i.stroke = '#ffffff'; if (!(i.strokeWidth > 0)) i.strokeWidth = 1; }
        else { i.strokeStyle = v; if (!(i.strokeWidth >= 2)) i.strokeWidth = 3; if (!i.stroke || i.stroke === 'none') i.stroke = '#000000'; }
      });
      return App.changed();
    }
    switch (cmd) {
      case 'reverse': return toggleCharAttr('reverse');
      case 'smallCaps': return toggleCharAttr('smallCaps');
      case 'insertSHY': if (App.sel.kind === 'text') return App.insertText('\u00AD'); return;
      case 'kernApart': return App.kern(0.04);
      case 'kernTogether': return App.kern(-0.04);
      case 'kernApartFine': return App.kern(0.01);
      case 'kernTogetherFine': return App.kern(-0.01);
      case 'clearKern': { const ts = textSel(); if (!ts) return; return App.applyChar({ track: null }); }
      case 'expertKerning': return expertKerning();
      case 'editTracks': return editTracks();
      case 'hyphenation': return hyphenation();
      case 'paraRules': { const c = App.currentParaProps(); if (!c) return UI.status('Click into a paragraph first.'); const x = await rulesDialog(c.pp); if (x) setParaMany(x); return; }
      case 'ctxF': return App.sel.kind === 'text' ? App.command('findChange') : App.command('frameAttach');
      case 'ctxG': return App.sel.kind === 'text' ? App.command('findNext') : App.command('group');
      case 'ctxL': return App.sel.kind === 'text' ? spelling() : App.command('lock');
      case 'nextFrame': return stepFrame(1);
      case 'prevFrame': return stepFrame(-1);
      case 'removeFromThreads': return removeFromThreads();
      case 'mask': return mask();
      case 'unmask': return unmask();
      case 'imageControl': return imageControl();
      case 'removeTransform': return removeTransform();
      case 'linksManager': return linksManager();
      case 'linkInfo': case 'linkOptions': return linkInfo();
      case 'goBack': return App.goBack();
      case 'goForward': return App.goForward();
      case 'newMaster': return newMaster(false);
      case 'savePageAsMaster': return newMaster(true);
      case 'deleteMaster': return deleteMaster();
      case 'duplicateMaster': return duplicateMaster();
      case 'applyMaster': return applyMasterDlg();
      case 'masterOptions': return masterOptions();
      case 'newStory': {
        if (!$('story-editor').hidden) App.closeStoryEditor();
        App.checkpoint();
        const st = BV.newStory(doc(), App.defaultStyle);
        if (App.sel.kind === 'text') App.leaveText();
        App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
        App.openStoryEditor();
        $('se-title').textContent = 'Untitled story (not placed yet)';
        return;
      }
      case 'closeStory': if (!$('story-editor').hidden) App.closeStoryEditor(); return;
      case 'toggleDisplayPara': App.seShowPara = !App.seShowPara; $('story-editor').classList.toggle('show-para', App.seShowPara); return syncState();
      case 'toggleStyleNames': App.seShowStyles = App.seShowStyles === false; $('story-editor').classList.toggle('hide-styles', App.seShowStyles === false); return syncState();
      case 'balanceColumns': return balanceColumns();
      case 'buildBooklet': return buildBooklet();
      case 'bullets': return bullets();
      case 'changeCase': return changeCase();
      case 'continuation': return continuation();
      case 'dropCap': return dropCap();
      case 'gridManager': return gridManager();
      case 'keyline': return keyline();
      case 'runningHeads': return runningHeads();
      case 'sortPages': return sortPages();
      case 'wordCount': return wordCount();
      case 'dataMerge': return dataMerge();
      case 'packageFiles': return packageFiles();
      case 'convertToNudi': return convertToNudi();
      case 'spelling': return spelling();
      case 'book': return book();
      case 'exportBook': return exportBookPdf();
      case 'indexEntry': return indexEntry();
      case 'showIndex': return showIndex();
      case 'createIndex': return createIndex();
      case 'defineColors': return defineColors();
      case 'preflight': return preflight();
      case 'showLibrary': return library();
      case 'showHyperlinks': return hyperlinks();
      case 'pasteSpecial': return pasteSpecial();
      case 'prefsLayout': return prefsLayout();
      case 'exportGraphic': return exportGraphic();
      case 'exportHtml': return exportHtml();
      case 'exportTags': return exportTags();
      case 'toggleSnapRulers': App.snapRulers = !App.snapRulers; UI.status(App.snapRulers ? 'Snap to rulers on: objects snap to ruler tick marks.' : 'Snap to rulers off.'); return syncState();
      case 'toggleZeroLock': App.zeroLock = !App.zeroLock; UI.status(App.zeroLock ? 'Zero point locked.' : 'Zero point unlocked: drag from the ruler corner to move it, double-click the corner to reset.'); return syncState();
      case 'toggleGuidesFront': App.guidesFront = !App.guidesFront; App.render(); return syncState();
      case 'toggleScrollbars': document.body.classList.toggle('no-scrollbars'); App.store.set('noScrollbars', document.body.classList.contains('no-scrollbars')); return syncState();
      case 'resetPalettes': return resetPalettes();
    }
    if (prev2) return prev2(cmd, arg);
  };
  App.preflightReport = preflightReport;
  App.parseCSV = parseCSV;
  App.hyphenateWord = hyphenateWord;
  App.syncViewState = syncState;
})();
(function () {
  try { if (window.App.store.get('noScrollbars', false)) document.body.classList.add('no-scrollbars'); } catch (_) {}
})();
