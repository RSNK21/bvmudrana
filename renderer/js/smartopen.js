/* BV Mudrana: opening PageMaker publications with recommendations.
   Before anything is converted, every font in the publication is looked at. For each Nudi / Baraha (ASCII)
   Kannada font a Unicode font of the same character is recommended, and its size is worked out by measuring
   the publication's own text in both fonts, so lines break where they broke in PageMaker. Latin fonts that are
   not installed get the closest installed font. Stories that still run long can be fitted automatically. */
(function () {
  const BV = window.BV, App = window.App, UI = BV.UI, T = BV.Text;
  const esc = BV.Render.esc;
  const TW = 1 / 20; // twips to points
  const cp1252 = new TextDecoder('windows-1252');
  const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const prefs = () => Object.assign({ kannadaFont: 'Noto Serif Kannada', nudiScale: 90, autoFit: true, keepAscii: false }, App.store.get('prefs', {}));

  // Unicode Kannada fonts, best first, for the two families of Nudi fonts
  const KN_UNICODE = /kannada|tunga|kedage|mallige|sampige|parijatha|nudi\s*uni|baraha\s*(kan.*uni|unicode)|akshar\s*unicode|lohit|gubbi|navilu|jogi|vijaya|nirmala/i;
  const SERIF_PREF = ['NudiParijatha', 'Nudi Parijatha', 'Noto Serif Kannada', 'Tunga', 'Kedage', 'Mallige', 'Sampige', 'Baloo Tamma 2', 'Nirmala UI', 'Noto Sans Kannada'];
  const SANS_PREF = ['Noto Sans Kannada', 'Nirmala UI', 'Tunga', 'Baloo Tamma 2', 'NudiParijatha', 'Noto Serif Kannada'];
  // Latin fonts PageMaker files often use, with good substitutes found on Windows
  const LATIN_SUBS = [
    [/^times|tms rmn|^roman/i, ['Times New Roman', 'Noto Serif']],
    [/helvetica|^helv|^swiss|^arial/i, ['Arial', 'Segoe UI', 'Noto Sans']],
    [/garamond/i, ['Garamond', 'EB Garamond', 'Georgia', 'Noto Serif']],
    [/palatino|book antiqua/i, ['Palatino Linotype', 'Book Antiqua', 'Noto Serif']],
    [/bookman/i, ['Bookman Old Style', 'Noto Serif']],
    [/century|schoolbook/i, ['Century Schoolbook', 'Century', 'Noto Serif']],
    [/futura|avant/i, ['Century Gothic', 'Segoe UI', 'Noto Sans']],
    [/courier/i, ['Courier New', 'Consolas']],
    [/symbol/i, ['Symbol']],
    [/zapf|dingbat|wingding/i, ['Wingdings', 'Segoe UI Symbol']],
  ];

  const ctx = document.createElement('canvas').getContext('2d');
  function width(font, text, bold) {
    ctx.font = `${bold ? 'bold ' : ''}100px "${font}", "Noto Serif Kannada", serif`;
    return ctx.measureText(text).width;
  }
  const isNudiFamilySans = (f) => /akshar|praja/i.test(f);
  const installed = (f) => (App.fontSet || new Set(App.fontList)).has(f);
  const firstInstalled = (list) => list.find(installed);

  // what is in the publication: per font, characters, sizes and a sample of its text
  function survey(pm) {
    const out = new Map();
    for (const st of Object.values(pm.stories)) {
      const bytes = b64ToBytes(st.text);
      let off = 0;
      for (const c of st.chars) {
        const fname = pm.fonts[c.font] || 'Times New Roman';
        const seg = bytes.subarray(off, off + c.len);
        off += c.len;
        let f = out.get(fname);
        if (!f) out.set(fname, (f = { name: fname, chars: 0, sizes: new Map(), sample: '', bold: 0, enc: BV.Legacy.encodingForFont(fname) }));
        f.chars += c.len;
        const sz = Math.round((c.size || 12) * 10) / 10;
        f.sizes.set(sz, (f.sizes.get(sz) || 0) + c.len);
        if (c.bold) f.bold += c.len;
        if (f.sample.length < 1600) f.sample += cp1252.decode(seg).replace(/[\r\n\t\x00-\x1f]+/g, ' ');
      }
    }
    return [...out.values()].sort((a, b) => b.chars - a.chars);
  }

  // the size (as a % of the Nudi size) that makes the Unicode text as wide as the original was
  function matchScale(nudiFont, uniFont, sample, bold) {
    const ascii = sample.slice(0, 1200);
    if (!ascii.trim()) return null;
    const uni = BV.Legacy.nudiToUnicode(ascii);
    let measureFont = installed(nudiFont) ? nudiFont : (BV.NUDI_FONTS || []).find((f) => f !== nudiFont && !/akshar/i.test(f) === !/akshar/i.test(nudiFont)) || (BV.NUDI_FONTS || [])[0];
    if (!measureFont) return null;
    const wNudi = width(measureFont, ascii, bold);
    const wUni = width(uniFont, uni, bold);
    if (!wNudi || !wUni) return null;
    // letter height, for those who prefer the Unicode text to look the same size
    const letters = 'ಕನಮದರಸವಲ';
    const hgt = (font, t) => { ctx.font = `100px "${font}", "Noto Serif Kannada", serif`; const m = ctx.measureText(t); return (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0); };
    const hN = hgt(measureFont, BV.Legacy.unicodeToNudi(letters)), hU = hgt(uniFont, letters);
    const clamp = (v) => Math.max(0.6, Math.min(1.4, v));
    return { scale: clamp(wNudi / wUni), heightScale: hN && hU ? clamp(hN / hU) : null, measuredWith: measureFont, exact: measureFont === nudiFont };
  }

  // Praja: the Praja Unicode fonts have the original Praja outlines and widths, so the original width is
  // measured exactly by setting the converted text in Praja Unicode.
  const NUDI_UNI_PREF = ['NudiParijatha', 'Nudi Parijatha', 'Nudi Akshara', 'NudiAkshara', 'Nudi Uni 01 e', 'NudiUni01e', 'Nudi Unicode', 'Noto Sans Kannada'];
  const prajaSample = (f) => BV.Legacy.prajaToUnicode(f.sample.slice(0, 1200));
  function matchScalePraja(f, uniFont) {
    const uni = prajaSample(f);
    if (!uni.trim()) return null;
    const pj = BV.Legacy.prajaUnicodeFont(f.name).font;
    const bold = f.bold > f.chars / 2;
    const wO = width(pj, uni, bold), wN = width(uniFont, uni, bold);
    if (!wO || !wN) return null;
    const letters = 'ಕನಮದರಸವಲ';
    const hgt = (font) => { ctx.font = `100px "${font}", "Noto Sans Kannada", sans-serif`; const m = ctx.measureText(letters); return (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0); };
    const hO = hgt(pj), hN = hgt(uniFont);
    const clamp = (v) => Math.max(0.6, Math.min(1.4, v));
    return { scale: uniFont === pj ? 1 : clamp(wO / wN), heightScale: uniFont === pj ? 1 : hO && hN ? clamp(hO / hN) : null, measuredWith: pj, exact: true };
  }
  const prajaOtherFont = () => firstInstalled(NUDI_UNI_PREF) || 'Noto Sans Kannada';

  function recommend(f) {
    if (BV.Legacy.isDev(f.enc)) return { mode: 'convert', font: BV.Legacy.unicodeFontFor(f.name).font, dev: true };
    if (f.enc === 'praja') return { mode: 'praja', font: BV.Legacy.prajaUnicodeFont(f.name).font };
    if (f.enc === 'nudi' && BV.Legacy.prajaNudiUnicodeFont(f.name)) return { mode: 'convert', font: BV.Legacy.prajaNudiUnicodeFont(f.name).font };
    if (f.enc === 'nudi') {
      const pool = (isNudiFamilySans(f.name) ? SANS_PREF : SERIF_PREF);
      const sys = (App.fontList || []).filter((x) => KN_UNICODE.test(x) && !/^nudi\s*\d|akshar-\d/i.test(x));
      const font = firstInstalled(pool) || sys[0] || 'Noto Serif Kannada';
      return { mode: 'convert', font };
    }
    if (installed(f.name)) return { mode: 'keep', font: f.name };
    for (const [re, list] of LATIN_SUBS) if (re.test(f.name)) { const hit = firstInstalled(list); if (hit) return { mode: 'keep', font: hit, substitute: true }; }
    return { mode: 'keep', font: 'Noto Serif', substitute: true };
  }

  const sizeRange = (f) => { const s = [...f.sizes.keys()].sort((a, b) => a - b); return s.length ? (s[0] === s[s.length - 1] ? `${s[0]} pt` : `${s[0]} to ${s[s.length - 1]} pt`) : ''; };
  const pageSizeName = (S) => {
    const w = (S.pageW * TW) / BV.UNITS.mm, h = (S.pageH * TW) / BV.UNITS.mm;
    const hit = BV.PAGE_SIZES.find((p) => (Math.abs(p.w - w) < 2 && Math.abs(p.h - h) < 2) || (Math.abs(p.w - h) < 2 && Math.abs(p.h - w) < 2));
    return `${Math.round(w * 10) / 10} × ${Math.round(h * 10) / 10} mm${hit ? ` (${hit.name.replace(/\s*\(.*\)$/, '')})` : ''}`;
  };

  App.importPageMaker = async function (data) {
    const pm = data.pm;
    const p = prefs();
    UI.status('Looking at the fonts in ' + data.name + '…', 0);
    const fonts = survey(pm);
    const recs = fonts.map((f) => Object.assign({ f }, recommend(f)));
    // load every font that is needed for measuring and the previews
    await App.ensureFonts([...new Set(recs.flatMap((r) => [r.f.name, r.font]))]).catch(() => {});
    await App.ensureFonts(['Praja Unicode', 'Praja Unicode Demi', 'Praja Unicode Light', prajaOtherFont()]).catch(() => {});
    for (const r of recs) {
      if (r.dev) {
        // BV Chitkala and BV Nanda were made from these fonts: same letters, same widths
        r.scale = 1;
        r.measured = { exact: true, same: true, measuredWith: r.font };
      } else if (r.f.enc === 'praja') {
        const m = matchScalePraja(r.f, r.font);
        r.scale = m ? m.scale : 1;
        r.measured = m;
      } else if (r.mode === 'convert') {
        const m = matchScale(r.f.name, r.font, r.f.sample, r.f.bold > r.f.chars / 2);
        r.scale = m ? m.scale : p.nudiScale / 100;
        r.measured = m;
      } else r.scale = 1;
    }
    UI.status('');
    const S = pm.setup;
    const isLegacy = (f) => BV.Legacy.convertible(f.enc);
    const nudiRows = recs.filter((r) => isLegacy(r.f)).length;
    const prajaRows = recs.filter((r) => r.f.enc === 'praja').length;
    const row = (r, i) => {
      const f = r.f;
      const legacy = isLegacy(f);
      const hasFont = installed(f.name);
      const sample = f.sample.trim().slice(0, 60);
      const opt = (v, l) => `<option value="${v}"${r.mode === v ? ' selected' : ''}>${l}</option>`;
      const how = f.enc === 'praja'
        ? `<select class="so-mode" data-i="${i}">${opt('praja', 'Unicode, Praja look (Praja Unicode)')}${opt('convert', 'Unicode, another font (Nudi Unicode…)')}${opt('keep', 'Keep ASCII (Praja)')}</select><div class="so-sub">Praja layout (Prajavani)</div>`
        : legacy
        ? `<select class="so-mode" data-i="${i}">${opt('convert', 'Convert to Unicode')}${opt('keep', BV.Legacy.isPrajaNudi(f.name) || r.dev ? `Keep ASCII (${esc(f.name)})` : 'Keep ASCII (Nudi)')}</select>${r.dev ? `<div class="so-sub">${esc(BV.Legacy.label(f.enc))}</div>` : ''}`
        : `<span class="so-tag ${hasFont ? 'ok' : 'warn'}">${hasFont ? 'Installed' : 'Not installed'}</span>`;
      const note = f.enc === 'praja'
        ? (r.mode === 'praja' ? 'same letters and widths as Praja' : 'measured on your text')
        : legacy
        ? r.measured && r.measured.same ? `same letters and widths as ${esc(f.name)}` : r.measured ? (r.measured.exact ? 'measured on your text' : `estimated with ${esc(r.measured.measuredWith)}`) : 'Nudi font not installed: usual size'
        : r.substitute ? 'closest installed font' : '';
      return `<tr data-i="${i}">
        <td><b>${esc(f.name)}</b><div class="so-sub">${f.chars.toLocaleString()} characters · ${esc(sizeRange(f))}</div></td>
        <td>${how}</td>
        <td><div class="fontbox"><input id="so-f${i}" value="${esc(r.font)}" spellcheck="false" autocomplete="off"><button class="fdrop" tabindex="-1" data-fontfor="so-f${i}">▾</button></div><div class="so-sub" id="so-n${i}">${note}</div></td>
        <td><div class="so-size"><input type="number" id="so-s${i}" min="50" max="150" step="1" value="${Math.round(r.scale * 100)}"><span>%</span></div></td>
        <td class="so-prev">${f.enc === 'praja' && !hasFont ? `<div class="so-line" style="font-family:'${esc(BV.Legacy.prajaUnicodeFont(f.name).font)}'" title="As it was in PageMaker" lang="kn">${esc(BV.Legacy.prajaToUnicode(sample))}</div><div class="so-line uni" id="so-p${i}" lang="kn"></div>` : legacy ? `<div class="so-line" style="font-family:'${esc(f.name)}', '${esc(BV.NUDI_FONTS[0] || '')}'" title="As it was in PageMaker">${esc(sample)}</div><div class="so-line uni" id="so-p${i}" lang="kn"></div>` : `<div class="so-line" id="so-p${i}"></div>`}</td>
      </tr>`;
    };
    const r = await UI.dialog({
      title: `Open ${data.name}`,
      width: 1020,
      html: `<div class="so-head">
          <div><span class="so-k">Pages</span><b>${pm.spreads.length}</b></div>
          <div><span class="so-k">Page size</span><b>${esc(pageSizeName(S))}</b></div>
          <div><span class="so-k">Sides</span><b>${S.doubleSided ? 'Double-sided' : 'Single-sided'}</b></div>
          <div><span class="so-k">Stories</span><b>${Object.keys(pm.stories).length}</b></div>
          <div><span class="so-k">Fonts</span><b>${fonts.length}</b></div>
        </div>
        <p class="note">BV Mudrana has looked at every font in this publication and suggests a font and size for each. ${nudiRows ? 'For Nudi / Baraha Kannada the size is worked out by measuring your own text in both fonts, so lines break where they did in PageMaker.' : ''} ${prajaRows ? 'Text in Praja fonts can become Unicode in <b>Praja Unicode</b> (the same Praja letters, so nothing moves) or in another Unicode font such as a Nudi Unicode font.' : ''} You can change anything before opening.</p>
        <div class="so-table"><table><thead><tr><th>Font in the publication</th><th>What to do</th><th>Use this font</th><th>Size</th><th>Preview</th></tr></thead><tbody>${recs.map(row).join('')}</tbody></table></div>
        <div class="row" style="grid-template-columns:auto 1fr"><label for="so-by">Size the Unicode Kannada to</label><select id="so-by"><option value="width">keep PageMaker’s line breaks (recommended)</option><option value="height">look the same size as the Nudi letters</option></select></div>
        <label class="check"><input type="checkbox" id="so-fit" ${p.autoFit ? 'checked' : ''}> If converted text runs longer than its text blocks, tighten it slightly (horizontal scale down to 95%) so it fits</label>
        <label class="check"><input type="checkbox" id="so-wrap" ${p.wrapPictures !== false ? 'checked' : ''}> Make text wrap round pictures that sit on text, as PageMaker's text wrap does (pictures behind a whole text block stay behind it)</label>
        <label class="check"><input type="checkbox" id="so-reflow" ${p.reflow ? 'checked' : ''}> Reflow text that still runs over (overset) onto new pages after the story's last page</label>
        <p class="note">The original file is not changed. Save as .bvm to keep this version, or back to PageMaker with File > Save As.</p>`,
      onOpen: (el) => {
        const upd = (i) => {
          const rr = recs[i];
          const fEl = el.querySelector('#so-f' + i), sEl = el.querySelector('#so-s' + i), pv = el.querySelector('#so-p' + i);
          if (!pv) return;
          const mode = el.querySelector(`.so-mode[data-i="${i}"]`);
          const leg = isLegacy(rr.f);
          const conv = leg && (!mode || mode.value !== 'keep');
          const txt = rr.f.sample.trim().slice(0, 60);
          pv.textContent = conv ? BV.Legacy.toUnicode(txt, rr.f.enc) : txt;
          pv.style.fontFamily = `"${(conv || !leg) ? fEl.value : rr.f.name}", "Noto Serif Kannada", serif`;
          pv.style.fontSize = `${(+sEl.value || 100) * 0.15}px`;
          pv.style.opacity = conv || !leg ? 1 : 0.35;
          fEl.disabled = leg && !conv;
        };
        recs.forEach((_, i) => upd(i));
        el.querySelector('#so-by').addEventListener('change', (e) => {
          recs.forEach((rr, i) => {
            if (!rr.measured) return;
            const v = e.target.value === 'height' && rr.measured.heightScale ? rr.measured.heightScale : rr.measured.scale;
            el.querySelector('#so-s' + i).value = Math.round(v * 100);
            upd(i);
          });
        });
        el.addEventListener('input', (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) upd(+tr.dataset.i); });
        el.addEventListener('change', async (e) => {
          const tr = e.target.closest('tr[data-i]');
          if (!tr) return;
          const i = +tr.dataset.i, rr = recs[i];
          const sizeBy = () => el.querySelector('#so-by').value;
          // Praja: switching between the Praja look and another Unicode font picks the font and measures again
          if (rr.f.enc === 'praja' && (e.target.classList.contains('so-mode') || e.target.id === 'so-f' + i)) {
            const mode = el.querySelector(`.so-mode[data-i="${i}"]`).value;
            const fEl = el.querySelector('#so-f' + i);
            if (e.target.classList.contains('so-mode')) fEl.value = mode === 'praja' ? BV.Legacy.prajaUnicodeFont(rr.f.name).font : mode === 'convert' ? prajaOtherFont() : rr.f.name;
            if (mode !== 'keep') {
              await App.ensureFonts([fEl.value]).catch(() => {});
              const m = matchScalePraja(rr.f, fEl.value);
              if (m) { rr.measured = m; el.querySelector('#so-s' + i).value = Math.round((sizeBy() === 'height' && m.heightScale ? m.heightScale : m.scale) * 100); }
            } else el.querySelector('#so-s' + i).value = 100;
            const n = el.querySelector('#so-n' + i);
            if (n) n.textContent = mode === 'keep' ? 'needs the Praja fonts installed' : fEl.value === BV.Legacy.prajaUnicodeFont(rr.f.name).font ? 'same letters and widths as Praja' : 'measured on your text';
            upd(i);
            return;
          }
          // a different Unicode font: measure again
          if (e.target.id === 'so-f' + i && rr.f.enc === 'nudi') {
            await App.ensureFonts([e.target.value]).catch(() => {});
            const m = matchScale(rr.f.name, e.target.value, rr.f.sample, rr.f.bold > rr.f.chars / 2);
            if (m) { rr.measured = m; el.querySelector('#so-s' + i).value = Math.round((el.querySelector('#so-by').value === 'height' && m.heightScale ? m.heightScale : m.scale) * 100); }
          }
          upd(i);
        });
      },
      buttons: [{ label: 'Open', value: 'ok', primary: true }, { label: 'Cancel', value: null }],
    });
    if (!r) return;
    const plan = {};
    recs.forEach((rr, i) => {
      const mode = r.el.querySelector(`.so-mode[data-i="${i}"]`);
      const font = r.el.querySelector('#so-f' + i).value.trim();
      const scale = (parseFloat(r.el.querySelector('#so-s' + i).value) || 100) / 100;
      if (isLegacy(rr.f)) plan[rr.f.name] = { mode: mode ? mode.value : 'convert', font: mode && mode.value === 'keep' ? rr.f.name : font, scale: mode && mode.value === 'keep' ? 1 : scale };
      else plan[rr.f.name] = { mode: 'keep', font: font || rr.f.name, scale };
    });
    const autoFit = UI.checked(r.el, 'so-fit');
    const reflow = UI.checked(r.el, 'so-reflow');
    const wrapPictures = UI.checked(r.el, 'so-wrap');
    const anyConvert = Object.values(plan).some((x) => x.mode === 'convert' || x.mode === 'praja');
    const firstKn = Object.entries(plan).find(([f, x]) => x.mode === 'convert' && !BV.Legacy.isPrajaFont(f) && !BV.Legacy.isDev(BV.Legacy.encodingForFont(f)));
    const firstKnPlan = firstKn ? firstKn[1] : null;
    App.store.set('prefs', Object.assign(prefs(), { autoFit, reflow, wrapPictures, keepAscii: !anyConvert && nudiRows > 0, kannadaFont: firstKnPlan ? firstKnPlan.font : p.kannadaFont }));
    UI.status('Opening…', 0);
    await new Promise((res) => setTimeout(res, 30));
    let built;
    try {
      built = BV.PMImport.toDoc(pm, { kannadaFont: firstKnPlan ? firstKnPlan.font : p.kannadaFont, nudiScale: firstKnPlan ? firstKnPlan.scale : 1, availableFonts: App.fontSet, keepAscii: !anyConvert, fontPlan: plan, wrapPictures });
    } catch (e) {
      console.error(e);
      UI.status('');
      return UI.alert('Could not convert this PageMaker file: ' + e.message);
    }
    const { doc: d, report } = built;
    App.setDoc(d, null);
    App.docName = data.name.replace(/\.(pmd|pm7|p65|pm6|pt6|t65|pmt|pt7)$/i, '');
    App.pmSource = { name: data.name, path: data.path };
    App.setDirty(true);
    App.refreshColors(); App.refreshLayers();
    await App.ensureFonts(App.docFonts()).catch(() => {});
    // fit stories whose converted text now runs longer than its text blocks
    let fitted = 0, still = 0;
    if (autoFit && anyConvert) {
      UI.status('Checking that every story still fits…', 0);
      await new Promise((res) => setTimeout(res, 20));
      for (const st of Object.values(d.stories)) {
        if (!App.layoutFor(st).overflow) continue;
        const conv = [];
        for (const pa of st.paras) for (const run of pa.runs) if (run.legacy && /^[a-z]+:/.test(run.legacy)) conv.push(run);
        if (!conv.length) { still++; continue; }
        let ok = false;
        for (const w of [99, 98, 97, 96, 95]) {
          for (const run of conv) run.width = w;
          st.paras.forEach((pa) => (pa.runs = pa.runs.slice()));
          App.markStory(st.id);
          if (!App.layoutFor(st).overflow) { ok = true; break; }
        }
        if (ok) fitted++;
        else { for (const run of conv) delete run.width; st.paras.forEach((pa) => (pa.runs = pa.runs.slice())); App.markStory(st.id); still++; }
      }
      App.markAll();
    } else for (const st of Object.values(d.stories)) if (App.layoutFor(st).overflow) still++;
    let reflowed = null;
    if (reflow && still && App.reflowAll) { reflowed = App.reflowAll('after', true); still = reflowed.left; }
    App.render();
    const missing = Object.keys(report.missingFonts).filter((f) => !Object.values(plan).some((x) => x.font === f && installed(f)));
    UI.status(`Opened ${data.name}: ${report.pages} pages, ${report.stories} stories${report.convertedChars ? `, ${report.convertedChars.toLocaleString()} Kannada characters converted` : ''}.`, 12000);
    const notes = [];
    if (reflowed && reflowed.pages) notes.push(`${reflowed.stories} ${reflowed.stories === 1 ? 'story was' : 'stories were'} reflowed onto ${reflowed.pages} new ${reflowed.pages === 1 ? 'page' : 'pages'}, so no text is hidden.`);
    if (fitted) notes.push(`${fitted} ${fitted === 1 ? 'story was' : 'stories were'} tightened slightly so the converted text fits its text blocks as before.`);
    if (still) notes.push(still === 1 ? 'One story runs longer than its text blocks (a red ▼ at the bottom of the block). It was probably like that in PageMaker too; if not, lower its size a little. The “overset” button in the status bar takes you there.' : `${still} stories run longer than their text blocks (a red ▼ at the bottom of each block). They were probably like that in PageMaker too; if not, lower their size a little. The “overset” button in the status bar takes you to each one.`);
    if (missing.length) notes.push(`These fonts are not installed, so a similar font is used: ${missing.join(', ')}.`);
    if (report.wrapped) notes.push(`Text wraps round ${report.wrapped} picture${report.wrapped === 1 ? '' : 's'} (Element > Text Wrap changes it).`);
    if (report.cropped) notes.push(`${report.cropped} cropped picture${report.cropped === 1 ? ' is' : 's are'} shown cropped as in PageMaker.`);
    if (report.imagesMissing) notes.push(`${report.imagesMissing} graphic(s) could not be shown (linked, or in a format that cannot be read); grey boxes mark where they were.`);
    if (notes.length) {
      if (still && App.reflowAll) {
        const q = await UI.dialog({ title: 'BV Mudrana', html: `<p class="note" style="font-size:12px;color:var(--ink);white-space:pre-wrap">${esc(data.name + ' is open.\n\n' + notes.join('\n\n'))}</p>`, buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Reflow Overset Text…', value: 'reflow' }] });
        if (q && q.value === 'reflow') App.command('reflowOverset');
      } else UI.alert(`${data.name} is open.\n\n${notes.join('\n\n')}`);
    }
  };
})();
