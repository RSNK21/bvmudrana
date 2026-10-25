/* BV Mudrana: legacy (ASCII-font) Kannada to Unicode.
   Nudi stores a syllable as visual pieces: base shape, talakattu, vowel-sign parts,
   subscript ottus (after the vowel!), and the repha (arkavattu) last.
   This converter rebuilds each syllable in Unicode order.  Written for BV Mudrana;
   glyph codes cross-checked against the public Nudi layout. */
(function () {
  const BV = (typeof window !== 'undefined' ? (window.BV = window.BV || {}) : (globalThis.BV = globalThis.BV || {}));
  const H = '್'; // halant (virama)

  // base shapes that need a talakattu (À) or a vowel sign to complete them
  const BASE = {
    P: 'ಕ', S: 'ಖ', U: 'ಗ', W: 'ಘ', Z: 'ಚ', b: 'ಛ', e: 'ಜ', m: 'ಟ', o: 'ಠ', q: 'ಡ', qs: 'ಢ', u: 'ಣ', v: 'ತ', x: 'ಥ',
    z: 'ದ', zs: 'ಧ', '£': 'ನ', '¥': 'ಪ', '¥s': 'ಫ', '¨': 'ಬ', '¨s': 'ಭ', 'ª': 'ವ', g: 'ರ', '¯': 'ಲ', '±': 'ಶ',
    'µ': 'ಷ', '¸': 'ಸ', 'º': 'ಹ', '¼': 'ಳ', Ai: 'ಯ', '0i': 'ಯ',
  };
  // complete consonant shapes (inherent "a")
  const FULL = { R: 'ಖ', d: 'ಜ', l: 'ಟ', t: 'ಣ', '§': 'ಬ', '®': 'ಲ', k: 'ಞ', Y: 'ಙ' };
  // consonant + i
  const WITH_I = {
    Q: 'ಕ', T: 'ಖ', V: 'ಗ', X: 'ಘ', a: 'ಚ', c: 'ಛ', f: 'ಜ', n: 'ಟ', p: 'ಠ', r: 'ಡ', 'rü': 'ಢ', 'tÂ': 'ಣ', w: 'ತ', y: 'ಥ',
    '¢': 'ದ', '¢ü': 'ಧ', '¤': 'ನ', '¦': 'ಪ', '¦ü': 'ಫ', '©': 'ಬ', '©ü': 'ಭ', '«': 'ವ', '¬': 'ಯ', j: 'ರ', '°': 'ಲ',
    '²': 'ಶ', '¶': 'ಷ', '¹': 'ಸ', '»': 'ಹ', '½': 'ಳ', 'jh': 'ಝ',
  };
  const VOWELS = { C: 'ಅ', D: 'ಆ', E: 'ಇ', F: 'ಈ', G: 'ಉ', H: 'ಊ', 'IÄ': 'ಋ', J: 'ಎ', K: 'ಏ', L: 'ಐ', M: 'ಒ', N: 'ಓ', O: 'ಔ' };
  const VATTU = {
    'Ì': 'ಕ', 'Í': 'ಖ', 'Î': 'ಗ', 'Ï': 'ಘ', 'Õ': 'ಞ', 'Ñ': 'ಚ', 'Ò': 'ಛ', 'Ó': 'ಜ', 'Ô': 'ಝ', 'Ö': 'ಟ', '×': 'ಠ', 'Ø': 'ಡ',
    'Ù': 'ಢ', 'Ú': 'ಣ', 'Û': 'ತ', 'Ü': 'ಥ', 'Ý': 'ದ', 'Þ': 'ಧ', 'ß': 'ನ', 'à': 'ಪ', 'á': 'ಫ', 'â': 'ಬ', 'ã': 'ಭ', 'ä': 'ಮ',
    'å': 'ಯ', 'æ': 'ರ', 'ç': 'ರ', 'è': 'ಲ', 'é': 'ವ', 'ê': 'ಶ', 'ë': 'ಷ', 'ì': 'ಸ', 'í': 'ಹ', 'î': 'ಳ',
  };
  const IGNORE = new Set(['ö', '÷', 'ø', 'ù']);
  // longest keys first for greedy matching
  const KEYS = [...new Set([...Object.keys(BASE), ...Object.keys(FULL), ...Object.keys(WITH_I), ...Object.keys(VOWELS), 'gÀh', 'gÉh'])].sort((a, b) => b.length - a.length);

  function nudiToUnicode(input) {
    const out = [];
    let syl = null; // {repha, cons:[], vowel, tail:boolean (ma/ya tail pending), mods}
    const flush = () => {
      if (!syl) return;
      let s = '';
      if (syl.vowelOnly) s = syl.vowelOnly;
      else {
        if (syl.repha) s += 'ರ' + H;
        s += syl.cons.join(H);
        if (syl.halant) s += H;
        else if (syl.vowel) s += syl.vowel;
      }
      s += syl.mods;
      out.push(s);
      syl = null;
    };
    const start = (cons, vowel, opts = {}) => {
      // a lone halant consonant followed by another consonant keeps its visible halant
      if (syl && syl.halant && !syl.vowelOnly) { flush(); out.push('\u200C'); }
      flush();
      syl = { repha: false, cons: [cons], vowel, halant: false, mods: '', tail: !!opts.tail, base: opts.base };
    };
    let i = 0;
    const str = input;
    while (i < str.length) {
      const ch = str[i];
      if (IGNORE.has(ch)) { i++; continue; }
      // ya: "Ai"   (plain "A" is anusvara)
      let key = null;
      for (const k of KEYS) if (str.startsWith(k, i)) { key = k; break; }
      if (key === 'gÀh' || key === 'gÉh') {
        // jha: ರ-base + À/É + h + tail
        start('ಝ', key === 'gÀh' ? '' : 'ೆ', { tail: true, base: 'jha' });
        i += key.length;
        continue;
      }
      if (key && BASE[key] !== undefined) {
        start(BASE[key], null, { tail: key === 'ª' || key === 'Ai' || key === '0i', base: key });
        i += key.length;
        continue;
      }
      if (key && FULL[key] !== undefined) { start(FULL[key], ''); i += key.length; continue; }
      if (key && WITH_I[key] !== undefined) {
        start(WITH_I[key], 'ಿ', { tail: key === '«' || key === '¬' || key === 'jh', base: key });
        i += key.length;
        continue;
      }
      if (key && VOWELS[key] !== undefined) { flush(); syl = { vowelOnly: VOWELS[key], mods: '' }; i += key.length; continue; }

      // marks that modify the current syllable
      if (syl && !syl.vowelOnly) {
        let used = true;
        switch (ch) {
          case 'À': if (syl.vowel === null) syl.vowel = ''; break; // talakattu
          case 'Á': syl.vowel = 'ಾ'; break;
          case 'É': syl.vowel = 'ೆ'; break;
          case 'Ë': syl.vowel = 'ೌ'; break;
          case 'ï': syl.halant = true; break;
          case 'Â': break; // part of ಣಿ, already handled
          case 'h': break; // jha piece
          case 'i':
          case 'Ä':
            if (syl.tail) {
              // ma / ya tail, not a vowel
              syl.tail = false;
              if (syl.base === 'ª' || syl.base === '«') syl.cons[0] = 'ಮ';
              if (syl.vowel === null) syl.vowel = '';
            } else if (ch === 'Ä') syl.vowel = syl.vowel === 'ೆ' ? 'ೆ' : 'ು';
            else used = false;
            break;
          case 'Å': syl.vowel = 'ು'; break;
          case 'Æ':
            if (syl.base === 'ª' && syl.tail && syl.vowel === 'ೆ') { syl.cons[0] = 'ಮ'; syl.tail = false; }
            syl.vowel = syl.vowel === 'ೆ' ? 'ೊ' : 'ೂ';
            break;
          case 'Ç': syl.vowel = syl.vowel === 'ೆ' ? 'ೊ' : 'ೂ'; break;
          case 'È': syl.vowel = 'ೃ'; break;
          case 'Ã': syl.vowel = syl.vowel === 'ಿ' ? 'ೀ' : syl.vowel === 'ೆ' ? 'ೇ' : syl.vowel === 'ೊ' ? 'ೋ' : syl.vowel === 'ೃ' ? 'ೄ' : syl.vowel; break;
          case 'Ê': syl.vowel = 'ೈ'; break;
          case 'ð': syl.repha = true; break;
          case 'õ': // ಙ joiner piece (as in ಶಾರ್ಙ್ಗ): swallow a following ಾ shape
            if (str[i + 1] === 'Á') i++;
            if (syl.vowel === null) syl.vowel = '';
            break;
          case 'ü': // mahaprana mark on i-forms (ಧಿ ಫಿ ಭಿ ಢಿ handled in table); also ಘ variants
            break;
          case 's': {
            const asp = { 'ದ': 'ಧ', 'ಪ': 'ಫ', 'ಬ': 'ಭ', 'ಡ': 'ಢ' };
            if (asp[syl.cons[0]] && syl.cons.length === 1) syl.cons[0] = asp[syl.cons[0]];
            else used = false;
            break;
          }
          default:
            if (VATTU[ch]) { syl.cons.push(VATTU[ch]); if (syl.vowel === null) syl.vowel = ''; }
            else used = false;
        }
        if (used) { i++; continue; }
      }
      if (ch === 'A') { if (syl) syl.mods += 'ಂ'; else out.push('ಂ'); i++; continue; }
      if (ch === 'B') { if (syl) syl.mods += 'ಃ'; else out.push('ಃ'); i++; continue; }
      if (ch === 'ð' && !syl) { i++; continue; }
      if (VATTU[ch] && !syl) { out.push(H + VATTU[ch]); i++; continue; }
      // anything else: punctuation, digits, spaces
      flush();
      if (str.startsWith('||', i)) { out.push('॥'); i += 2; continue; }
      if (ch === '|') { out.push('।'); i++; continue; }
      out.push(ch);
      i++;
    }
    flush();
    return out.join('').normalize('NFC');
  }

  // Which legacy encoding does a font name use?
  function encodingForFont(name) {
    const n = (name || '').toLowerCase();
    if (isPrajaNudi(name)) return 'nudi'; // Praja01-Praja08: the Praja design in the Nudi layout
    if (isPrajaFont(name)) return 'praja'; // Prajavani's Praja fonts have their own layout
    if (/^nudi\b/.test(n) || /^nudi/.test(n)) return 'nudi';
    if (/^brh\s*(kannada|kan)/.test(n) || /^baraha\s*kan/.test(n)) return 'nudi'; // Baraha Kannada shares the Nudi layout
    if (/^brh\s*devanagari|^baraha\s*dev/.test(n)) return 'brh-deva';
    // Chanakya, Chanakyamath, Walkman-Chanakya (Devanagari) and Nalanda (IAST)
    if (BV.DevLegacy) return BV.DevLegacy.encodingForFont(name);
    return null;
  }

  // All conversions use the Brahmavidya converter engine (bvkannada.js) when it is loaded;
  // the older built-in routine stays only as a fallback.
  const CUSTOM = [{ from: 'YõÁÎð', to: 'ರ್ಙ್ಗ' }];
  const toUnicode0 = (s) => {
    const K = BV.BVKannada || (typeof require !== 'undefined' ? require('./bvkannada.js') : null);
    return K ? K.toUnicode(s, { custom: CUSTOM }).text : nudiToUnicode(s);
  };
  // In Nudi, “ï” is a visible halant (ಟ್ in ಷಟ್\u200Cಶ್ರುತಿ). The converter joins the next consonant into a conjunct
  // (ಟ್ಶ), so the text is converted in pieces at each visible halant and a ZWNJ keeps the halant visible.
  const toUnicode = (s) => {
    if (s.indexOf('\u00EF') < 0) return toUnicode0(s);
    const parts = s.split(/(?<=\u00EF)(?=[^\s\u00EF])/);
    let out = '';
    for (const part of parts) {
      const u = toUnicode0(part);
      if (/\u0CCD$/.test(out) && /^[\u0C95-\u0CB9\u0CDE]/.test(u)) out += '\u200C';
      out += u;
    }
    return out;
  };
  const toAscii = (s) => {
    const K = BV.BVKannada || (typeof require !== 'undefined' ? require('./bvkannada.js') : null);
    return K.toAscii(s).text;
  };
  // ---- Praja (Prajavani) fonts: the Brahmavidya Praja Unicode converter (praja.js)
  const PJ = () => BV.Praja2Unicode || (typeof window !== 'undefined' && window.Praja2Unicode) || (typeof require !== 'undefined' ? require('./praja.js') : null);
  // Praja01-Praja08 (Brahmavidya Praja Unicode kit): Praja letters on the Nudi ASCII layout
  const PRAJA_NUDI = { 1: ['Praja Unicode Light', false, false], 2: ['Praja Unicode Light', false, true], 3: ['Praja Unicode', false, false], 4: ['Praja Unicode', false, true],
    5: ['Praja Unicode Demi', false, false], 6: ['Praja Unicode Demi', false, true], 7: ['Praja Unicode', true, false], 8: ['Praja Unicode', true, true] };
  const prajaNudiNum = (name) => { const m = /^praja\s*0?([1-8])$/i.exec(String(name || '').trim()); return m ? +m[1] : 0; };
  function isPrajaNudi(name) { return prajaNudiNum(name) > 0; }
  // the Praja Unicode face that matches a Praja01-08 font, or null
  function prajaNudiUnicodeFont(name) { const v = PRAJA_NUDI[prajaNudiNum(name)]; return v ? { font: v[0], bold: v[1], italic: v[2] } : null; }
  function isPrajaFont(name) {
    const n = String(name || '').trim();
    if (!n || /unicode/i.test(n) || isPrajaNudi(n)) return false;
    const P = PJ();
    return (P && P.isPrajaFont(n)) || /^praja([\s_-]|$)/i.test(n);
  }
  // 'Praja_Demi Italic' -> { font: 'Praja Unicode Demi', bold: false, italic: true }
  function prajaUnicodeFont(name) {
    const n = String(name || '');
    const P = PJ();
    const font = (P && P.unicodeFontFor(n)) || (/demi/i.test(n) ? 'Praja Unicode Demi' : /light|lit/i.test(n) ? 'Praja Unicode Light' : 'Praja Unicode');
    return { font, bold: /bold|bld/i.test(n), italic: /ital|itl/i.test(n) };
  }
  const isDev = (enc) => !!(BV.DevLegacy && BV.DevLegacy.isDev(enc));
  const prajaToUnicode = (s) => { const P = PJ(); return P ? P.prajaToUnicode(s) : s; };
  const unicodeToPraja = (s) => { const P = PJ(); return P ? P.unicodeToPraja(s) : s; };
  const prajaContinues = (ch) => { const P = PJ(); return !!(P && P.isContinuation(ch)); };
  BV.Legacy = { nudiToUnicode: toUnicode, oldNudiToUnicode: nudiToUnicode, unicodeToNudi: toAscii, encodingForFont,
    isPrajaFont, prajaUnicodeFont, prajaToUnicode, unicodeToPraja, prajaContinues, isPrajaNudi, prajaNudiUnicodeFont,
    // any legacy Kannada encoding to Unicode
    toUnicode: (s, enc) => (enc === 'praja' ? prajaToUnicode(s) : isDev(enc) ? BV.DevLegacy.toUnicode(s, enc) : toUnicode(s)),
    // Unicode back to a legacy encoding (for saving to PageMaker)
    fromUnicode: (s, enc) => (enc === 'praja' ? unicodeToPraja(s) : isDev(enc) ? BV.DevLegacy.fromUnicode(s, enc) : toAscii(s)),
    // the Unicode font with the same design as a legacy font, if there is one
    unicodeFontFor: (name) => { const enc = encodingForFont(name); return enc === 'praja' ? prajaUnicodeFont(name) : enc === 'nudi' ? prajaNudiUnicodeFont(name) : isDev(enc) ? BV.DevLegacy.unicodeFont(name) : null; },
    isDev,
    convertible: (enc) => enc === 'nudi' || enc === 'praja' || isDev(enc),
    label: (enc) => (enc === 'praja' ? 'Praja → Unicode' : enc === 'nudi' ? 'Nudi → Unicode' : isDev(enc) ? BV.DevLegacy.label(enc) : ''),
    // legacy tags kept on converted runs: nudi:, praja:, chanakya:, nalanda: ... and their -ascii: forms
    LEGACY_TAG: /^(nudi|praja|chanakya|chanakyamath|walkman|nalanda)(-ascii)?:/ };
  if (typeof module !== 'undefined') module.exports = BV.Legacy;
})();
