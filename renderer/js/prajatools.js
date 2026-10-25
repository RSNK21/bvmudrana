/* BV Mudrana: Praja (Prajavani) Kannada fonts.
   Praja text can become Unicode in two ways, always keeping the formatting:
     - in Praja Unicode, the same Praja letters as Unicode Kannada, so nothing moves on the page;
     - in another Unicode font (a Nudi Unicode font, Noto…), sized to keep the original line lengths.
   This works on the open publication (Utilities > Kannada), on text being placed (Word, RTF, text files)
   and on whole documents (Word .docx, .rtf and .txt are converted in place and saved as a new file). */
(function () {
  const BV = window.BV, App = window.App, UI = BV.UI, T = BV.Text;
  const L = BV.Legacy;
  const esc = (s) => BV.Render.esc(String(s == null ? '' : s));
  const doc = () => App.doc;
  const KN = /[ಀ-೿]/;
  const NUDI_MARKS = /^[ÀÁÂÃÄÅÆÇÈÉÊËïðõÌÍÎÏÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîü]+/;
  const NUDI_UNI_PREF = ['NudiParijatha', 'Nudi Parijatha', 'Nudi Akshara', 'NudiAkshara', 'Nudi Uni 01 e', 'NudiUni01e', 'Nudi Unicode', 'Noto Sans Kannada'];
  const installed = (f) => (App.fontSet || new Set(App.fontList || [])).has(f);
  const otherFont = () => NUDI_UNI_PREF.find(installed) || 'Noto Sans Kannada';
  const fontBox = (id, value) => `<div class="fontbox"><input id="${id}" value="${esc(value)}" spellcheck="false" autocomplete="off" style="width:100%"><button class="fdrop" tabindex="-1" data-fontfor="${id}">▾</button></div>`;
  const prefs = () => Object.assign({ prajaTarget: 'praja', prajaOther: '', kannadaFont: 'Noto Serif Kannada' }, App.store.get('prefs', {}));
  const savePrefs = (o) => App.store.set('prefs', Object.assign(App.store.get('prefs', {}), o));

  // legacy encoding of a font, for Praja and Nudi only
  const encOf = (font) => { const e = L.encodingForFont(font); return L.convertible(e) ? e : null; };
  const toUni = (t, enc) => L.toUnicode(t, enc);
  // leading characters of b that finish the last syllable of a
  function carryLen(text, enc) {
    if (enc === 'praja') { let k = 0; while (k < text.length && L.prajaContinues(text[k])) k++; return k; }
    if (L.isDev(enc)) { let k = 0; while (k < text.length && BV.DevLegacy.continues(enc, text[k])) k++; return k; }
    const m = text.match(NUDI_MARKS);
    return m ? m[0].length : 0;
  }
  // segs: [{t, enc}] in reading order, null between unrelated text; moves syllable tails back to the segment they belong to
  function joinSyllables(segs) {
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i];
      if (!a || !b || !a.enc || a.enc !== b.enc) continue;
      const k = carryLen(b.t, b.enc);
      if (k) { a.t += b.t.slice(0, k); b.t = b.t.slice(k); }
    }
  }

  // ---------------------------------------------------------------- measuring
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (font, text, bold) => { ctx.font = `${bold ? 'bold ' : ''}100px "${font}", "Noto Sans Kannada", sans-serif`; return ctx.measureText(text).width; };
  // size (as a fraction) that gives the new font the same line length as Praja had
  function prajaScale(uniSample, prajaUni, target) {
    if (!uniSample.trim() || target === prajaUni) return 1;
    const a = width(prajaUni, uniSample), b = width(target, uniSample);
    return a && b ? Math.max(0.6, Math.min(1.4, a / b)) : 1;
  }

  // ================================================================== the open publication
  // split the paragraph's runs so that [s, e) is made of whole runs; returns the runs with an `in` flag
  function cutRuns(para, s, e) {
    const out = [];
    let a = 0;
    for (const r of para.runs) {
      const b = a + r.t.length;
      const pieces = [[a, Math.min(b, Math.max(a, s))], [Math.max(a, s), Math.min(b, e)], [Math.max(a, Math.min(b, e)), b]];
      for (const [x, y] of pieces) if (y > x) out.push({ run: Object.assign({}, r, { t: r.t.slice(x - a, y - a) }), in: x >= s && y <= e });
      if (b === a) out.push({ run: Object.assign({}, r), in: a >= s && a <= e });
      a = b;
    }
    return out;
  }
  /* opts: { target: 'praja'|'other', font, scale, any (convert selected text whatever its font), styles } */
  function convertParas(st, from, to, opts, stats) {
    for (let p = from.p; p <= to.p; p++) {
      const para = st.paras[p];
      const len = T.paraText(para).length;
      const s = p === from.p ? from.o : 0, e = p === to.p ? to.o : len;
      const pp = BV.paraProps(doc(), para);
      const parts = cutRuns(para, s, e);
      const segs = parts.map((x) => {
        if (!x.in || !x.run.t) return null;
        const cp = BV.charProps(pp, x.run);
        const leg = x.run.legacy || '';
        let enc = /^praja-ascii:/.test(leg) ? 'praja' : L.isPrajaFont(cp.font) ? 'praja' : null;
        if (!enc && opts.any && !KN.test(x.run.t)) enc = 'praja';
        if (!enc) return null;
        x.enc = enc; x.cp = cp;
        return { t: x.run.t, enc, x };
      });
      if (!segs.some(Boolean)) continue;
      joinSyllables(segs);
      for (const sg of segs) {
        if (!sg) continue;
        const { x } = sg;
        const r = x.run;
        const orig = /^praja-ascii:/.test(r.legacy || '') ? r.legacy.replace(/^praja-ascii:/, '') : L.isPrajaFont(x.cp.font) ? x.cp.font : 'Praja';
        const v = L.prajaUnicodeFont(orig);
        r.t = L.prajaToUnicode(sg.t);
        r.font = opts.target === 'praja' ? v.font : opts.font;
        r.legacy = 'praja:' + orig;
        if (v.bold) r.bold = true;
        if (v.italic) r.italic = true;
        if (opts.target !== 'praja' && opts.scale && Math.abs(opts.scale - 1) > 0.004) r.size = Math.round(x.cp.size * opts.scale * 10) / 10;
        stats.chars += [...r.t].length;
      }
      para.runs = parts.map((x) => x.run);
      T.normalize(para);
      stats.paras++;
    }
    App.markStory(st.id);
  }
  function scopeRanges(scope) {
    const d = doc();
    if (scope === 'sel' && App.sel.kind === 'text') {
      const st = d.stories[App.sel.sid];
      const [a, b] = T.order(App.sel.a, App.sel.f);
      return [{ st, a, b }];
    }
    const stories = scope === 'all' ? Object.values(d.stories) : App.selectedStories();
    return stories.map((st) => ({ st, a: { p: 0, o: 0 }, b: T.storyEnd(st) }));
  }
  function prajaTextIn(ranges, any) {
    let s = '';
    for (const { st, a, b } of ranges) {
      for (let p = a.p; p <= b.p && s.length < 1200; p++) {
        const para = st.paras[p];
        const pp = BV.paraProps(doc(), para);
        for (const r of para.runs) {
          const cp = BV.charProps(pp, r);
          if (L.isPrajaFont(cp.font) || /^praja-ascii:/.test(r.legacy || '') || (any && !KN.test(r.t))) s += r.t + ' ';
        }
      }
    }
    return s;
  }
  function prajaFontsUsed() {
    const d = doc(), n = new Map();
    for (const st of Object.values(d.stories)) for (const pa of st.paras) {
      const pp = BV.paraProps(d, pa);
      for (const r of pa.runs) {
        const f = /^praja-ascii:/.test(r.legacy || '') ? r.legacy.slice(12) : BV.charProps(pp, r).font;
        if (L.isPrajaFont(f)) n.set(f, (n.get(f) || 0) + r.t.length);
      }
    }
    return n;
  }

  async function convertPrajaDialog() {
    if (!doc()) return UI.status('Open a publication first.');
    const hasRange = App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0;
    const hasBlocks = App.selectedStories().length > 0 && App.sel.kind !== 'text';
    const used = prajaFontsUsed();
    const p = prefs();
    const scope0 = hasRange ? 'sel' : hasBlocks ? 'stories' : 'all';
    const other = p.prajaOther || otherFont();
    await App.ensureFonts(['Praja Unicode', 'Praja Unicode Demi', 'Praja Unicode Light', other]).catch(() => {});
    const r = await UI.dialog({
      title: 'Convert Praja Text to Unicode',
      width: 600,
      html: `<p class="note" style="color:var(--ink)">${used.size ? `This publication has text in ${[...used.entries()].map(([f, n]) => `<b>${esc(f)}</b> (${n.toLocaleString()} characters)`).join(', ')}.` : 'No text in a Praja font was found. To convert Praja text that was pasted in another font, select it and tick the box below.'} Bold, italic, size, colour and every other setting are kept.</p>
        <fieldset><legend>Which text</legend>
          <label class="check"><input type="radio" name="pj-scope" value="sel" ${scope0 === 'sel' ? 'checked' : ''} ${hasRange ? '' : 'disabled'}> The selected text</label>
          <label class="check"><input type="radio" name="pj-scope" value="stories" ${scope0 === 'stories' ? 'checked' : ''} ${hasBlocks || App.sel.kind === 'text' ? '' : 'disabled'}> The selected text blocks (whole stories)</label>
          <label class="check"><input type="radio" name="pj-scope" value="all" ${scope0 === 'all' ? 'checked' : ''}> The whole publication</label>
          <label class="check" style="margin-top:6px"><input type="checkbox" id="pj-any" ${used.size ? '' : 'checked'}> Also convert selected text that is not in a Praja font (Praja text pasted from elsewhere)</label>
        </fieldset>
        <fieldset><legend>Unicode font</legend>
          <label class="check"><input type="radio" name="pj-t" value="praja" ${p.prajaTarget !== 'other' ? 'checked' : ''}> <span><b>Praja Unicode</b>: the same Praja letters and widths, so every line breaks exactly as before</span></label>
          <label class="check"><input type="radio" name="pj-t" value="other" ${p.prajaTarget === 'other' ? 'checked' : ''}> <span>Another Unicode font, for example a Nudi Unicode font</span></label>
          <div class="row" style="margin-top:6px"><label for="pj-f">Font</label>${fontBox('pj-f', other)}</div>
          <div class="row"><label for="pj-s">Size</label><div class="so-size"><input type="number" id="pj-s" min="50" max="150" step="1" value="100"><span>% of the Praja size (worked out from your text to keep line lengths)</span></div></div>
        </fieldset>
        <label class="check"><input type="checkbox" id="pj-st" checked> Also change paragraph styles that use a Praja font</label>
        <div class="so-prev" style="width:auto;max-width:none"><div class="so-line" id="pj-pv" lang="kn" style="font-size:20px"></div></div>`,
      buttons: [{ label: 'Convert', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
      onOpen: (el) => {
        const upd = async (remeasure) => {
          const scope = el.querySelector('input[name=pj-scope]:checked').value;
          const any = el.querySelector('#pj-any').checked;
          const tgt = el.querySelector('input[name=pj-t]:checked').value;
          const f = el.querySelector('#pj-f');
          f.closest('.fontbox').style.opacity = tgt === 'other' ? 1 : 0.45;
          el.querySelector('#pj-s').disabled = tgt !== 'other';
          const sample = L.prajaToUnicode(prajaTextIn(scopeRanges(scope), any && scope === 'sel'));
          const pjFont = L.prajaUnicodeFont([...used.keys()][0] || 'Praja').font;
          const font = tgt === 'praja' ? pjFont : f.value;
          if (remeasure && tgt === 'other') { await App.ensureFonts([font]).catch(() => {}); el.querySelector('#pj-s').value = Math.round(prajaScale(sample, pjFont, font) * 100); }
          const pv = el.querySelector('#pj-pv');
          pv.textContent = (sample.trim() || 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ').slice(0, 80);
          pv.style.fontFamily = `"${font}", "Noto Sans Kannada", sans-serif`;
          pv.style.fontSize = `${20 * (tgt === 'other' ? (+el.querySelector('#pj-s').value || 100) / 100 : 1)}px`;
        };
        el.addEventListener('change', (e) => upd(e.target.id === 'pj-f' || e.target.name === 'pj-t' || e.target.name === 'pj-scope' || e.target.id === 'pj-any'));
        el.querySelector('#pj-s').addEventListener('input', () => upd(false));
        upd(true);
      },
    });
    if (!r) return;
    const scope = r.el.querySelector('input[name=pj-scope]:checked').value;
    const target = r.el.querySelector('input[name=pj-t]:checked').value;
    const font = UI.val(r.el, 'pj-f').trim() || otherFont();
    const scale = target === 'other' ? (parseFloat(UI.val(r.el, 'pj-s')) || 100) / 100 : 1;
    const opts = { target, font, scale, any: UI.checked(r.el, 'pj-any') && scope === 'sel', styles: UI.checked(r.el, 'pj-st') };
    savePrefs({ prajaTarget: target, prajaOther: target === 'other' ? font : p.prajaOther });
    App.checkpoint();
    const stats = convertPraja(scope, opts);
    UI.status(stats.chars ? `${stats.chars.toLocaleString()} Praja characters are now Unicode${target === 'praja' ? ' in Praja Unicode' : ' in ' + font}${stats.styles ? `, ${stats.styles} style(s) changed` : ''}.` : 'No Praja text found there.', 8000);
    return stats;
  }
  function convertPraja(scope, opts) {
    const stats = { chars: 0, paras: 0, styles: 0 };
    for (const { st, a, b } of scopeRanges(scope)) convertParas(st, a, b, opts, stats);
    if (opts.styles) {
      for (const s of Object.values(doc().styles)) {
        if (!L.isPrajaFont(s.font)) continue;
        const v = L.prajaUnicodeFont(s.font);
        s.font = opts.target === 'praja' ? v.font : opts.font;
        if (v.bold) s.bold = true;
        if (v.italic) s.italic = true;
        if (opts.target !== 'praja' && opts.scale && Math.abs(opts.scale - 1) > 0.004) s.size = Math.round(s.size * opts.scale * 10) / 10;
        stats.styles++;
      }
      if (stats.styles) { App.markAll(); App.refreshStyles && App.refreshStyles(); }
    }
    App.ensureFonts([opts.target === 'praja' ? 'Praja Unicode' : opts.font]).catch(() => {});
    App.changed();
    return stats;
  }
  App.convertPraja = convertPraja;

  // Unicode Kannada -> Praja ASCII (for sending text to old Praja workflows)
  function convertToPraja() {
    if (!doc()) return;
    let ranges;
    if (App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0) ranges = scopeRanges('sel');
    else ranges = scopeRanges('stories');
    if (!ranges.length) return UI.status('Select the Unicode Kannada text (or its text block) first.');
    App.checkpoint();
    let n = 0;
    for (const { st, a, b } of ranges) {
      for (let p = a.p; p <= b.p; p++) {
        const para = st.paras[p];
        const s = p === a.p ? a.o : 0, e = p === b.p ? b.o : T.paraText(para).length;
        para.runs = cutRuns(para, s, e).map((x) => {
          const r = x.run;
          if (!x.in || !KN.test(r.t)) return r;
          const orig = /^praja:/.test(r.legacy || '') ? r.legacy.slice(6) : 'Praja';
          n += [...r.t].length;
          return Object.assign({}, r, { t: L.unicodeToPraja(r.t).replace(/[​-‍]/g, ''), font: orig, legacy: 'praja-ascii:' + orig });
        });
        T.normalize(para);
      }
      App.markStory(st.id);
    }
    App.changed();
    UI.status(n ? `${n.toLocaleString()} Kannada characters converted to Praja ASCII. They show correctly only where the Praja fonts are installed.` : 'No Unicode Kannada found in the selection.', 8000);
  }

  // ================================================================== Word documents (.docx)
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
  const kid = (el, name) => { if (!el) return null; for (const c of el.children) if (c.namespaceURI === W && c.localName === name) return c; return null; };
  const wattr = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute('w:' + name) : null);
  const onOff = (el) => { if (!el) return null; const v = wattr(el, 'val'); return !(v === '0' || v === 'false' || v === 'off'); };
  function readStyles(xml) {
    const out = { styles: {}, def: {} };
    if (!xml) return out;
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    const rprInfo = (rPr) => {
      if (!rPr) return {};
      const f = kid(rPr, 'rFonts'), sz = kid(rPr, 'sz');
      return { font: f ? wattr(f, 'ascii') || wattr(f, 'hAnsi') || null : null, b: onOff(kid(rPr, 'b')), i: onOff(kid(rPr, 'i')), sz: sz ? +wattr(sz, 'val') : null };
    };
    const dd = d.getElementsByTagNameNS(W, 'rPrDefault')[0];
    if (dd) out.def = rprInfo(kid(dd, 'rPr'));
    for (const s of d.getElementsByTagNameNS(W, 'style')) {
      const id = wattr(s, 'styleId');
      const based = kid(s, 'basedOn');
      out.styles[id] = Object.assign({ type: wattr(s, 'type'), basedOn: based ? wattr(based, 'val') : null, name: kid(s, 'name') ? wattr(kid(s, 'name'), 'val') : id }, rprInfo(kid(s, 'rPr')));
    }
    return out;
  }
  function styleProp(S, id, key, guard = 0) {
    const s = id && S.styles[id];
    if (!s || guard > 20) return null;
    if (s[key] != null) return s[key];
    return styleProp(S, s.basedOn, key, guard + 1);
  }
  // effective font, bold, italic and size of a run
  function runProps(S, r, pStyle) {
    const rPr = kid(r, 'rPr');
    const rs = kid(rPr, 'rStyle');
    const rStyle = rs ? wattr(rs, 'val') : null;
    const f = kid(rPr, 'rFonts');
    const pick = (key, direct) => (direct != null ? direct : styleProp(S, rStyle, key) ?? styleProp(S, pStyle, key) ?? S.def[key] ?? null);
    const sz = kid(rPr, 'sz');
    return {
      font: pick('font', f ? wattr(f, 'ascii') || wattr(f, 'hAnsi') || null : null),
      b: !!pick('b', onOff(kid(rPr, 'b'))),
      i: !!pick('i', onOff(kid(rPr, 'i'))),
      sz: pick('sz', sz ? +wattr(sz, 'val') : null) || 22,
      u: !!kid(rPr, 'u') && wattr(kid(rPr, 'u'), 'val') !== 'none',
    };
  }
  const ownRuns = (p) => [...p.getElementsByTagNameNS(W, 'r')].filter((r) => { let a = r.parentElement; while (a && !(a.namespaceURI === W && a.localName === 'p')) a = a.parentElement; return a === p; });
  const pStyleOf = (p) => { const ps = kid(kid(p, 'pPr'), 'pStyle'); return ps ? wattr(ps, 'val') : null; };

  // fonts used in a Word document, with character counts and their legacy encoding
  function surveyDocx(parts) {
    const S = readStyles(parts['word/styles.xml']);
    const fonts = new Map();
    for (const [name, xml] of Object.entries(parts)) {
      if (name === 'word/styles.xml') continue;
      const d = new DOMParser().parseFromString(xml, 'application/xml');
      for (const p of d.getElementsByTagNameNS(W, 'p')) {
        const ps = pStyleOf(p);
        for (const r of ownRuns(p)) {
          let t = '';
          for (const x of r.getElementsByTagNameNS(W, 't')) t += x.textContent;
          if (!t) continue;
          const f = runProps(S, r, ps).font || '(default)';
          const o = fonts.get(f) || { name: f, chars: 0, enc: encOf(f), sample: '' };
          o.chars += t.length;
          if (o.sample.length < 800) o.sample += t;
          fonts.set(f, o);
        }
      }
    }
    return { S, fonts: [...fonts.values()].sort((a, b) => b.chars - a.chars) };
  }
  function setRPr(doc_, r, props) {
    let rPr = kid(r, 'rPr');
    if (!rPr) { rPr = doc_.createElementNS(W, 'w:rPr'); r.insertBefore(rPr, r.firstChild); }
    const put = (name, attrs) => {
      let el = kid(rPr, name);
      if (!el) {
        el = doc_.createElementNS(W, 'w:' + name);
        const idx = RPR_ORDER.indexOf(name);
        const next = [...rPr.children].find((c) => c.namespaceURI === W && RPR_ORDER.indexOf(c.localName) > idx);
        rPr.insertBefore(el, next || null);
      }
      for (const [k, v] of Object.entries(attrs)) { if (v === null) { el.removeAttributeNS(W, k); el.removeAttribute('w:' + k); } else el.setAttributeNS(W, 'w:' + k, v); }
      return el;
    };
    put('rFonts', { ascii: props.font, hAnsi: props.font, cs: props.font, asciiTheme: null, hAnsiTheme: null, cstheme: null });
    if (props.b) { put('b', {}); put('bCs', {}); }
    if (props.i) { put('i', {}); put('iCs', {}); }
    if (props.sz) { put('sz', { val: String(props.sz) }); put('szCs', { val: String(props.sz) }); }
    put('lang', { bidi: props.lang || 'kn-IN' });
  }
  // where converted text goes: font, bold, italic and size factor, for a legacy font under a plan
  function target(enc, orig, plan) {
    if (L.isDev(enc)) { const v = L.unicodeFontFor(orig); return { font: v.font, bold: v.bold, italic: v.italic, scale: 1 }; }
    if (enc === 'praja') {
      const v = L.prajaUnicodeFont(orig);
      return plan.praja.target === 'praja' ? { font: v.font, bold: v.bold, italic: v.italic, scale: 1 } : { font: plan.praja.font, bold: v.bold, italic: v.italic, scale: plan.praja.scale || 1 };
    }
    const pn = L.prajaNudiUnicodeFont(orig);
    if (pn && plan.nudi.prajaLook !== false) return { font: pn.font, bold: pn.bold, italic: pn.italic, scale: 1 };
    return { font: plan.nudi.font, bold: false, italic: false, scale: plan.nudi.scale || 1 };
  }
  /* Convert the legacy-font runs of a Word document in place. plan: { praja: {target, font, scale}, nudi: {font, scale} | null } */
  function convertDocxParts(parts, plan) {
    const S = readStyles(parts['word/styles.xml']);
    const out = {};
    let chars = 0;
    const fontFor = (enc, orig) => target(enc, orig, plan).font;
    for (const [name, xml] of Object.entries(parts)) {
      if (name === 'word/styles.xml') continue;
      const d = new DOMParser().parseFromString(xml, 'application/xml');
      if (d.getElementsByTagName('parsererror').length) continue;
      let touched = false;
      for (const p of [...d.getElementsByTagNameNS(W, 'p')]) {
        const ps = pStyleOf(p);
        const segs = [];
        for (const r of ownRuns(p)) {
          const rp = runProps(S, r, ps);
          const enc = encOf(rp.font);
          const ok = enc && plan[enc];
          for (const c of r.children) {
            if (c.namespaceURI !== W) continue;
            if (c.localName === 't') segs.push(ok ? { t: c.textContent, enc, node: c, r, rp } : null);
            else if (c.localName === 'tab' || c.localName === 'br' || c.localName === 'cr') segs.push(null);
          }
        }
        if (!segs.some(Boolean)) continue;
        joinSyllables(segs);
        const doneRuns = new Set();
        for (const sg of segs) {
          if (!sg) continue;
          const u = toUni(sg.t, sg.enc);
          chars += [...u].length;
          sg.node.textContent = u;
          sg.node.setAttribute('xml:space', 'preserve');
          if (!doneRuns.has(sg.r)) {
            doneRuns.add(sg.r);
            const v = target(sg.enc, sg.rp.font, plan);
            setRPr(d, sg.r, { font: v.font, b: sg.rp.b || v.bold, i: sg.rp.i || v.italic, sz: Math.round(sg.rp.sz * v.scale), lang: L.isDev(sg.enc) ? (sg.enc === 'nalanda' ? 'en-IN' : 'hi-IN') : null });
          }
        }
        touched = true;
      }
      if (touched) {
        const decl = /^<\?xml[^>]*\?>/.exec(xml);
        out[name] = (decl ? decl[0] + '\r\n' : '') + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
      }
    }
    // styles that use a legacy font: point them at the new font too, so new typing is Unicode
    if (parts['word/styles.xml']) {
      const d = new DOMParser().parseFromString(parts['word/styles.xml'], 'application/xml');
      let n = 0;
      for (const s of d.getElementsByTagNameNS(W, 'style')) {
        const rPr = kid(s, 'rPr'), f = kid(rPr, 'rFonts');
        const font = f ? wattr(f, 'ascii') || wattr(f, 'hAnsi') : null;
        const enc = encOf(font);
        if (!enc || !plan[enc]) continue;
        const nf = fontFor(enc, font);
        for (const k of ['ascii', 'hAnsi', 'cs']) f.setAttributeNS(W, 'w:' + k, nf);
        n++;
      }
      if (n) {
        const decl = /^<\?xml[^>]*\?>/.exec(parts['word/styles.xml']);
        out['word/styles.xml'] = (decl ? decl[0] + '\r\n' : '') + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
      }
    }
    return { parts: out, chars };
  }
  // paragraphs for Place, from a Word document's own XML (keeps fonts, so legacy text can be converted)
  function docxParas(parts, baseStyle, plan) {
    const S = readStyles(parts['word/styles.xml']);
    const xml = parts['word/document.xml'];
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    const styles = doc().styles;
    const pick = (n) => (styles[n] ? n : baseStyle);
    const out = [];
    const body = d.getElementsByTagNameNS(W, 'body')[0];
    if (!body) return out;
    for (const p of body.getElementsByTagNameNS(W, 'p')) {
      const ps = pStyleOf(p);
      const sname = (ps && S.styles[ps] && S.styles[ps].name) || '';
      let style = baseStyle;
      if (/^(heading 1|title)$/i.test(sname)) style = pick('Chapter title');
      else if (/^heading [2-9]$/i.test(sname)) style = pick('Heading 2');
      const segs = [];
      for (const r of ownRuns(p)) {
        const rp = runProps(S, r, ps);
        const enc = encOf(rp.font);
        for (const c of r.children) {
          if (c.namespaceURI !== W) continue;
          if (c.localName === 't') segs.push({ t: c.textContent, enc: enc && plan[enc] ? enc : null, rp, keepEnc: enc });
          else if (c.localName === 'tab') segs.push({ t: '\t', rp });
          else if (c.localName === 'br' || c.localName === 'cr') segs.push({ t: BV.SOFT_BREAK, rp });
        }
      }
      joinSyllables(segs.map((x) => (x.enc ? x : null)));
      const runs = segs.filter((x) => x.t).map((x) => {
        const run = { t: x.t };
        if (x.rp.b) run.bold = true;
        if (x.rp.i) run.italic = true;
        if (x.rp.u) run.underline = true;
        if (x.enc) {
          run.t = toUni(x.t, x.enc);
          const v = target(x.enc, x.rp.font, plan);
          run.font = v.font;
          run.legacy = x.enc + ':' + x.rp.font;
          if (v.bold) run.bold = true;
          if (v.italic) run.italic = true;
        } else if (x.keepEnc) { run.font = x.rp.font; run.legacy = x.keepEnc + '-ascii:' + x.rp.font; }
        return run;
      });
      const para = { style, runs: runs.length ? runs : [{ t: '' }] };
      T.normalize(para);
      out.push(para);
    }
    return out;
  }

  // ================================================================== RTF
  // tokens: {k:'{'|'}'|'cw'|'cs'|'hex'|'txt', ...}
  function rtfTokens(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === '{' || c === '}') { toks.push({ k: c, s: c }); i++; continue; }
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i, i + 40));
        if (m) { toks.push({ k: 'cw', w: m[1], n: m[2] != null ? +m[2] : null, s: m[0] }); i += m[0].length; continue; }
        if (src[i + 1] === "'") { toks.push({ k: 'hex', v: parseInt(src.substr(i + 2, 2), 16), s: src.substr(i, 4) }); i += 4; continue; }
        toks.push({ k: 'cs', c: src[i + 1], s: src.substr(i, 2) }); i += 2; continue;
      }
      if (c === '\r' || c === '\n') { toks.push({ k: 'nl', s: c }); i++; continue; }
      let j = i;
      while (j < n && !'{}\\\r\n'.includes(src[j])) j++;
      toks.push({ k: 'txt', t: src.slice(i, j), s: src.slice(i, j) });
      i = j;
    }
    return toks;
  }
  const cp1252 = new TextDecoder('windows-1252');
  const DEST = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|headerl|headerr|headerf|footerl|footerr|footerf|footnote|fldinst|listtable|listoverridetable|rsidtbl|xmlnstbl|themedata|colorschememapping|datastore|latentstyles|generator|mmathPr|pgdsctbl|bkmkstart|bkmkend|filetbl|revtbl)$/;
  // the font table: number -> name, plus where each legacy name sits (for renaming)
  function rtfFonts(toks) {
    const fonts = {};
    let depth = 0, tbl = -1, cur = null, name = '', done = false;
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.k === '{') { depth++; continue; }
      if (t.k === '}') { depth--; if (tbl >= 0 && depth < tbl) { tbl = -1; done = true; } continue; }
      if (done) break;
      if (t.k === 'cw' && t.w === 'fonttbl') { tbl = depth; continue; }
      if (tbl < 0 || depth > tbl + 1) continue;
      if (t.k === 'cw' && t.w === 'f') { cur = t.n; name = ''; continue; }
      if (cur == null) continue;
      if (t.k === 'txt' || t.k === 'hex') {
        name += t.k === 'txt' ? t.t : cp1252.decode(new Uint8Array([t.v]));
        if (name.includes(';')) { fonts[cur] = name.split(';')[0].trim(); cur = null; name = ''; }
      }
    }
    return fonts;
  }
  /* Walk an RTF document. Segments are unbroken stretches of text (no control words inside),
     so replacing one never loses formatting. Returns { fonts, segs: [{start, end, text, font, fs, b, i, para}], toks } */
  function rtfWalk(src) {
    const toks = rtfTokens(src);
    const fonts = rtfFonts(toks);
    const stack = [];
    let st = { f: null, fs: 24, b: false, i: false, skip: false, uc: 1 };
    let para = 0, ucSkip = 0, cur = null;
    const segs = [];
    const endSeg = () => { if (cur) { segs.push(cur); cur = null; } };
    const addText = (idx, text) => {
      if (st.skip) return;
      if (cur) { cur.end = idx; cur.text += text; return; }
      cur = { start: idx, end: idx, text, font: st.f, fs: st.fs, b: st.b, i: st.i, para };
    };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.k === 'nl') { if (cur) cur.end = k; continue; }
      if (t.k === '{') { endSeg(); stack.push(st); st = Object.assign({}, st); if (toks[k + 1] && toks[k + 1].k === 'cs' && toks[k + 1].c === '*') st.skip = true; continue; }
      if (t.k === '}') { endSeg(); st = stack.pop() || st; continue; }
      if (t.k === 'cw') {
        if (t.w === 'u' && !st.skip) { const c = t.n < 0 ? t.n + 65536 : t.n; addText(k, String.fromCharCode(c)); ucSkip = st.uc; continue; }
        endSeg();
        if (DEST.test(t.w)) st.skip = true;
        else if (t.w === 'f') st.f = t.n;
        else if (t.w === 'fs') st.fs = t.n || 24;
        else if (t.w === 'b') st.b = t.n !== 0;
        else if (t.w === 'i') st.i = t.n !== 0;
        else if (t.w === 'plain') { st.b = false; st.i = false; st.fs = 24; }
        else if (t.w === 'uc') st.uc = t.n;
        else if (/^(par|line|sect|page|cell|row)$/.test(t.w)) para++;
        continue;
      }
      if (t.k === 'cs') { if (!st.skip && (t.c === '\\' || t.c === '{' || t.c === '}')) addText(k, t.c); else endSeg(); continue; }
      if (t.k === 'hex') {
        if (ucSkip) { ucSkip--; if (cur) cur.end = k; continue; }
        addText(k, cp1252.decode(new Uint8Array([t.v])));
        continue;
      }
      if (t.k === 'txt') {
        let s = t.t;
        if (ucSkip) { const cut = Math.min(ucSkip, s.length); s = s.slice(cut); ucSkip -= cut; if (!s) { if (cur) cur.end = k; continue; } }
        addText(k, s);
      }
    }
    endSeg();
    return { fonts, segs, toks };
  }
  // neighbours for syllable joining: legacy segments of the same paragraph, with null where they may not join
  function withBreaks(list) {
    const seq = [];
    for (const s of list) {
      const last = seq[seq.length - 1];
      if (s && last && last.para !== s.para) seq.push(null);
      seq.push(s);
    }
    return seq;
  }
  const rtfEsc = (s) => {
    let o = '';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (ch === '\\' || ch === '{' || ch === '}') o += '\\' + ch;
      else if (c < 0x80) o += ch;
      else if (c < 0x10000) o += `\\u${c > 32767 ? c - 65536 : c}?`;
      else o += '?';
    }
    return o;
  };
  function convertRtf(src, plan) {
    const { fonts, segs, toks } = rtfWalk(src);
    const encs = {};
    for (const [num, name] of Object.entries(fonts)) { const e = encOf(name); if (e && plan[e]) encs[num] = e; }
    const list = segs.map((s) => (encs[s.font] ? Object.assign(s, { enc: encs[s.font], t: s.text }) : null));
    joinSyllables(withBreaks(list));
    const newName = {};
    for (const [num, e] of Object.entries(encs)) newName[num] = target(e, fonts[num], plan).font;
    let chars = 0;
    const replace = new Map();
    for (const s of list) {
      if (!s) continue;
      const u = toUni(s.t, s.enc);
      chars += [...u].length;
      const v = target(s.enc, fonts[s.font], plan);
      const scale = v.scale;
      const fs = Math.round(s.fs * scale);
      // Kannada is a complex script: Word takes its font, size, bold and italic from \af \afs \ab \ai
      const cw = `\\af${s.font}\\afs${fs}${s.b || v.bold ? '\\ab\\b' : ''}${s.i || v.italic ? '\\ai\\i' : ''}${fs !== s.fs ? `\\fs${fs}` : ''} `;
      replace.set(s.start, { end: s.end, text: u ? `{${cw}${rtfEsc(u)}}` : '' });
    }
    // write it out, renaming the legacy fonts in the font table
    let out = '', depth = 0, tbl = -1, cur = null, renaming = false;
    for (let k = 0; k < toks.length; k++) {
      const r = replace.get(k);
      if (r) { out += r.text; k = r.end; continue; }
      const t = toks[k];
      if (t.k === '{') depth++;
      if (t.k === '}') { depth--; if (tbl >= 0 && depth < tbl) tbl = -1; }
      if (t.k === 'cw' && t.w === 'fonttbl') tbl = depth;
      if (tbl >= 0 && depth <= tbl + 1) {
        if (t.k === 'cw' && t.w === 'f') { cur = t.n; renaming = !!newName[cur]; }
        else if (renaming && t.k === 'cw' && t.w === 'fcharset') { out += '\\fcharset0 '; continue; }
        else if (renaming && (t.k === 'txt' || t.k === 'hex')) {
          const txt = t.k === 'txt' ? t.t : '';
          if (txt.includes(';')) { out += newName[cur] + txt.slice(txt.indexOf(';')); renaming = false; }
          continue;
        }
      }
      out += t.s;
    }
    return { rtf: out, chars };
  }
  function rtfParas(src, baseStyle, plan) {
    const { fonts, segs } = rtfWalk(src);
    const list = segs.map((s) => { const e = encOf(fonts[s.font]); return Object.assign(s, { enc: e && plan[e] ? e : null, keepEnc: e, t: s.text }); });
    joinSyllables(withBreaks(list.map((s) => (s.enc ? s : null))));
    const paras = [];
    for (const s of list) {
      while (paras.length <= s.para) paras.push({ style: baseStyle, runs: [] });
      const run = { t: s.t };
      if (s.b) run.bold = true;
      if (s.i) run.italic = true;
      const name = fonts[s.font];
      if (s.enc) {
        run.t = toUni(s.t, s.enc);
        const v = target(s.enc, name, plan);
        run.font = v.font;
        run.legacy = s.enc + ':' + name;
        if (v.bold) run.bold = true;
        if (v.italic) run.italic = true;
      } else if (s.keepEnc) { run.font = name; run.legacy = s.keepEnc + '-ascii:' + name; }
      paras[s.para].runs.push(run);
    }
    for (const p of paras) { if (!p.runs.length) p.runs = [{ t: '' }]; T.normalize(p); }
    return paras;
  }
  function surveyRtf(src) {
    const { fonts, segs } = rtfWalk(src);
    const m = new Map();
    for (const s of segs) {
      const f = fonts[s.font] || '(default)';
      const o = m.get(f) || { name: f, chars: 0, enc: encOf(f), sample: '' };
      o.chars += s.text.length;
      if (o.sample.length < 800) o.sample += s.text;
      m.set(f, o);
    }
    return [...m.values()].sort((a, b) => b.chars - a.chars);
  }

  // ================================================================== the plan dialog (shared by Place and the document converter)
  // fonts: [{name, chars, enc, sample}]; returns plan {praja:{target,font,scale}|null, nudi:{font,scale}|null} or null
  function planHTML(fonts, opts = {}) {
    const p = prefs();
    const pj = fonts.filter((f) => f.enc === 'praja'), nd = fonts.filter((f) => f.enc === 'nudi'), dv = fonts.filter((f) => L.isDev(f.enc));
    const list = (arr) => arr.map((f) => `<b>${esc(f.name)}</b> (${f.chars.toLocaleString()})`).join(', ');
    let h = '';
    if (pj.length) h += `<fieldset><legend>Praja fonts: ${list(pj)}</legend>
        <label class="check"><input type="radio" name="lp-pj" value="praja" ${p.prajaTarget !== 'other' ? 'checked' : ''}> <span>Unicode in <b>Praja Unicode</b>: the same Praja letters and widths</span></label>
        <label class="check"><input type="radio" name="lp-pj" value="other" ${p.prajaTarget === 'other' ? 'checked' : ''}> <span>Unicode in another font</span></label>
        <div class="row" style="margin-top:4px"><label for="lp-pf">Font</label>${fontBox('lp-pf', p.prajaOther || otherFont())}</div>
        <div class="row"><label for="lp-ps">Size</label><div class="so-size"><input type="number" id="lp-ps" min="50" max="150" value="100"><span>% (worked out from the text to keep line lengths)</span></div></div>
        ${opts.allowKeep ? '<label class="check"><input type="radio" name="lp-pj" value="keep"> Keep as ASCII text in the Praja fonts</label>' : ''}
        <div class="so-line" id="lp-pv" lang="kn" style="font-size:19px;margin-top:6px"></div>
      </fieldset>`;
    if (nd.length) h += `<fieldset><legend>Nudi / Baraha fonts: ${list(nd)}</legend>
        <label class="check"><input type="checkbox" id="lp-nd" checked> Convert to Unicode (Brahmavidya Kannada converter)</label>
        <div class="row" style="margin-top:4px"><label for="lp-nf">Font</label>${fontBox('lp-nf', p.kannadaFont || 'Noto Serif Kannada')}</div>
        ${nd.some((f) => L.isPrajaNudi(f.name)) ? '<label class="check"><input type="checkbox" id="lp-pn" checked> <span>Text in Praja01–Praja08 goes to the matching <b>Praja Unicode</b> face (same letters)</span></label>' : ''}
      </fieldset>`;
    if (dv.length) h += `<fieldset><legend>Devanagari and IAST fonts: ${list(dv)}</legend>
        <label class="check"><input type="checkbox" id="lp-dv" checked> <span>Convert to Unicode: Chanakya, Chanakyamath and Walkman-Chanakya go to <b>BV Chitkala</b>, Nalanda to <b>BV Nanda</b> (the same letters and widths)</span></label>
        <div class="so-line" style="font-size:18px;margin-top:6px">${dv.slice(0, 3).map((f) => `<span style="font-family:'${esc(L.unicodeFontFor(f.name).font)}'">${esc(L.toUnicode(f.sample.slice(0, 50), f.enc))}</span>`).join('<br>')}</div>
      </fieldset>`;
    return h;
  }
  function wirePlan(el, fonts) {
    const pj = fonts.filter((f) => f.enc === 'praja');
    if (!pj.length) return;
    const sample = L.prajaToUnicode(pj.map((f) => f.sample).join(' ').slice(0, 1200));
    const pjFont = L.prajaUnicodeFont(pj[0].name).font;
    const upd = async (remeasure) => {
      const t = el.querySelector('input[name=lp-pj]:checked').value;
      const f = el.querySelector('#lp-pf');
      f.closest('.fontbox').style.opacity = t === 'other' ? 1 : 0.45;
      el.querySelector('#lp-ps').disabled = t !== 'other';
      const font = t === 'other' ? f.value : pjFont;
      if (remeasure && t === 'other') { await App.ensureFonts([font]).catch(() => {}); el.querySelector('#lp-ps').value = Math.round(prajaScale(sample, pjFont, font) * 100); }
      const pv = el.querySelector('#lp-pv');
      pv.textContent = t === 'keep' ? pj[0].sample.slice(0, 60) : (sample.trim() || 'ಕನ್ನಡ').slice(0, 70);
      pv.style.fontFamily = t === 'keep' ? `"${pj[0].name}"` : `"${font}", "Noto Sans Kannada", sans-serif`;
      pv.style.fontSize = `${19 * (t === 'other' ? (+el.querySelector('#lp-ps').value || 100) / 100 : 1)}px`;
    };
    App.ensureFonts(['Praja Unicode', 'Praja Unicode Demi', 'Praja Unicode Light']).catch(() => {}).then(() => upd(true));
    el.addEventListener('change', (e) => { if (e.target.name === 'lp-pj' || e.target.id === 'lp-pf') upd(true); });
    el.querySelector('#lp-ps').addEventListener('input', () => upd(false));
  }
  function readPlan(el) {
    const plan = { praja: null, nudi: null };
    const pjSel = el.querySelector('input[name=lp-pj]:checked');
    if (pjSel && pjSel.value !== 'keep') {
      plan.praja = { target: pjSel.value, font: UI.val(el, 'lp-pf').trim() || otherFont(), scale: pjSel.value === 'other' ? (parseFloat(UI.val(el, 'lp-ps')) || 100) / 100 : 1 };
      savePrefs({ prajaTarget: plan.praja.target, prajaOther: plan.praja.target === 'other' ? plan.praja.font : prefs().prajaOther });
    }
    const nd = el.querySelector('#lp-nd');
    const pn = el.querySelector('#lp-pn');
    const dv = el.querySelector('#lp-dv');
    if (!dv || dv.checked) for (const e of ['chanakya', 'chanakyamath', 'walkman', 'nalanda']) plan[e] = { dev: true };
    if (nd && nd.checked) plan.nudi = { font: UI.val(el, 'lp-nf').trim() || 'Noto Serif Kannada', scale: 1, prajaLook: pn ? pn.checked : true };
    return plan;
  }
  App.legacyPlanHTML = planHTML;
  App.legacyWirePlan = wirePlan;
  App.legacyReadPlan = readPlan;
  App.legacySurvey = (f) => (f.kind === 'docx' && f.parts && f.parts['word/document.xml'] ? surveyDocx(f.parts).fonts : f.kind === 'rtf' && f.rtf ? surveyRtf(f.rtf) : []);
  App.legacyParas = (f, baseStyle, plan) => (f.kind === 'rtf' ? rtfParas(f.rtf, baseStyle, plan) : docxParas(f.parts, baseStyle, plan));

  // ================================================================== Convert a Praja or Nudi document
  async function convertDocument() {
    const f = await native.legacyPickFile();
    if (!f) return;
    let fonts = [];
    if (f.ext === 'docx') fonts = surveyDocx(f.parts).fonts;
    else if (f.ext === 'rtf') fonts = surveyRtf(f.rtf);
    const legacy = fonts.filter((x) => x.enc);
    const isTxt = f.ext === 'txt';
    if (!isTxt && !legacy.length) return UI.alert(`${f.name} has no text in Praja, Nudi, Baraha, Chanakya, Walkman-Chanakya or Nalanda fonts, so there is nothing to convert.\n\nFonts in it: ${fonts.map((x) => x.name).join(', ') || 'none'}.`);
    const txtFonts = isTxt ? [{ name: 'Praja', chars: [...f.text].length, enc: 'praja', sample: f.text.slice(0, 800) }] : legacy;
    const r = await UI.dialog({
      title: `Convert ${f.name}`,
      width: 600,
      html: `<p class="note" style="color:var(--ink)">${isTxt ? 'A text file has no fonts, so say how it was typed.' : `Fonts in this document: ${fonts.map((x) => `${esc(x.name)}${x.enc ? ` <span class="so-tag ok">${x.enc === 'praja' ? 'Praja' : x.enc === 'nudi' ? 'Nudi' : esc(L.label(x.enc).split(' ')[0])}</span>` : ''}`).join(', ')}.`} Only the old Kannada, Devanagari and IAST fonts are converted; English text, numbers and all formatting stay as they are. The original file is not changed.</p>
        ${isTxt ? `<div class="row"><label for="lp-txt">Typed in</label><select id="lp-txt"><option value="praja">Praja (Prajavani) fonts</option><option value="nudi">Nudi or Baraha fonts</option></select></div>` : ''}
        ${planHTML(isTxt ? txtFonts : legacy)}
        ${f.ext === 'docx' ? '<p class="note">In Word, Kannada uses the “Complex scripts” font. BV Mudrana sets it, and Kannada bold, italic and size, on every converted run. Install Praja Unicode on the computer that opens the document (Utilities &gt; Kannada &gt; Install the Praja Fonts).</p>' : ''}`,
      buttons: [{ label: 'Convert and Save…', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
      onOpen: (el) => {
        wirePlan(el, txtFonts);
        const sel = el.querySelector('#lp-txt');
        if (sel) sel.addEventListener('change', () => { const fs = el.querySelector('fieldset'); if (fs) fs.style.display = sel.value === 'praja' ? '' : 'none'; });
      },
    });
    if (!r) return;
    let plan = readPlan(r.el);
    const base = f.name.replace(/\.[^.]+$/, '');
    const out = await native.legacySaveAs({ defaultPath: f.path.replace(/[^\\/]+$/, '') + base + ' (Unicode).' + f.ext, ext: f.ext });
    if (!out) return;
    UI.status('Converting…', 0);
    let chars = 0;
    try {
      if (f.ext === 'docx') {
        const res = convertDocxParts(f.parts, plan);
        chars = res.chars;
        await native.docxWrite({ src: f.path, out, parts: res.parts });
      } else if (f.ext === 'rtf') {
        const res = convertRtf(f.rtf, plan);
        chars = res.chars;
        await native.writeText({ filePath: out, content: res.rtf, encoding: 'latin1' });
      } else {
        const how = UI.val(r.el, 'lp-txt');
        const u = how === 'nudi' ? f.text.split(/(\r?\n)/).map((t) => (/\r?\n/.test(t) ? t : L.nudiToUnicode(t))).join('') : L.prajaToUnicode(f.text);
        chars = [...u].length;
        await native.writeText({ filePath: out, content: u, encoding: 'utf8' });
      }
    } catch (e) {
      UI.status('');
      return UI.alert('Could not convert this document: ' + (e && e.message ? e.message : e));
    }
    UI.status(`${f.name} converted: ${chars.toLocaleString()} Kannada characters are now Unicode.`, 10000);
    const again = await UI.dialog({ title: 'Converted', html: `<p class="note" style="color:var(--ink)">Saved as <b>${esc(out.split(/[\\/]/).pop())}</b>.<br>${chars.toLocaleString()} Kannada characters are now Unicode.</p>`, buttons: [{ label: 'Show the File', value: 'show', primary: true }, { label: 'Close', value: null }] });
    if (again && again.value === 'show') native.reveal(out);
  }

  // ================================================================== Praja Unicode fonts on this computer
  async function installFonts() {
    const dir = window.native && native.prajaFontsDir ? await native.prajaFontsDir() : null;
    const r = await UI.dialog({
      title: 'Praja Fonts',
      width: 560,
      html: `<p class="note" style="color:var(--ink)">BV Mudrana carries two sets of Praja fonts (Praja Unicode kit 1.11) and uses them on screen, in PDF and in print:</p>
        <ul class="note" style="margin:0;padding-left:18px;line-height:1.6;color:var(--ink)">
          <li><b>Praja Unicode</b>, <b>Praja Unicode Demi</b> and <b>Praja Unicode Light</b> (8 files, PrajaUnicode-…): Unicode Kannada in the Praja design.</li>
          <li><b>Praja01 to Praja08</b>: the same design for typing with the Nudi keyboard in ASCII mode.</li>
          <li><b>BV Chitkala</b> (with Hindi, Hindi Heavy and Math) and <b>BV Nanda</b>: Unicode Devanagari and IAST made from Chanakya and Nalandagar. They are in the <b>bv</b> folder beside the Praja folder.</li>
        </ul>
        <p class="note" style="color:var(--ink)">BV Mudrana installs all of them in Windows for you (for your user account) the first time each version starts, so Word, LibreOffice, PageMaker and other programs show them. Utilities &gt; Install Brahmavidya Fonts in Windows does it again. To install them for all users instead:</p>
        <ol class="qs-list" style="margin-top:6px">
          <li><span class="qs-n">1</span><div><p>Close Word and PageMaker. If an older Praja Unicode or Praja01–Praja08 is installed, uninstall it first (Settings &gt; Fonts), otherwise Windows keeps the old copy.</p></div></li>
          <li><span class="qs-n">2</span><div><p>Click <b>Show the Fonts</b>, select the .ttf files you want (Ctrl+A for all 16), right-click and choose <b>Install for all users</b>.</p></div></li>
          <li><span class="qs-n">3</span><div><p>In Word, set the <b>Complex scripts</b> font to Praja Unicode (Ctrl+D). For Praja01–Praja08 in Word, tick <b>Kerning for fonts</b> (Ctrl+D &gt; Advanced) so ottaksharas sit apart.</p></div></li>
        </ol>
        <p class="note">The old Praja fonts can stay installed: the new ones have different names. The lower bowl of ಈ is open in every face.</p>`,
      buttons: [{ label: 'Show the Fonts', value: 'show', primary: true }, { label: 'Close', value: null }],
    });
    if (r && r.value === 'show') {
      if (dir) native.reveal(dir + (native.platform === 'win32' ? '\\' : '/') + 'PrajaUnicode-Regular.ttf');
      else UI.alert('The font folder could not be found in this installation.');
    }
  }

  // ================================================================== commands
  const prev = App.command2;
  App.command2 = async function (cmd, arg) {
    switch (cmd) {
      case 'convertPraja': return convertPrajaDialog();
      case 'convertToPraja': return convertToPraja();
      case 'legacyFile': return convertDocument();
      case 'prajaFonts': return installFonts();
    }
    if (prev) return prev(cmd, arg);
  };
  // for tests
  App.prajaInternals = { convertDocxParts, surveyDocx, convertRtf, rtfParas, surveyRtf, docxParas, prajaScale };
})();
