/* BV Mudrana: transliteration between Devanagari, Kannada, IAST, ITRANS and Harvard-Kyoto.
   Works on plain strings; no external libraries. */
(function () {
  const BV = (window.BV = window.BV || {});

  // ---- Devanagari <-> IAST tables ------------------------------------------------
  const VOWELS = [ // [independent, matra, iast]
    ['अ', '', 'a'], ['आ', 'ा', 'ā'], ['इ', 'ि', 'i'], ['ई', 'ी', 'ī'], ['उ', 'ु', 'u'], ['ऊ', 'ू', 'ū'],
    ['ऋ', 'ृ', 'ṛ'], ['ॠ', 'ॄ', 'ṝ'], ['ऌ', 'ॢ', 'ḷ'], ['ॡ', 'ॣ', 'ḹ'],
    ['ए', 'े', 'e'], ['ऐ', 'ै', 'ai'], ['ओ', 'ो', 'o'], ['औ', 'ौ', 'au'],
  ];
  const CONSONANTS = [
    ['क', 'k'], ['ख', 'kh'], ['ग', 'g'], ['घ', 'gh'], ['ङ', 'ṅ'],
    ['च', 'c'], ['छ', 'ch'], ['ज', 'j'], ['झ', 'jh'], ['ञ', 'ñ'],
    ['ट', 'ṭ'], ['ठ', 'ṭh'], ['ड', 'ḍ'], ['ढ', 'ḍh'], ['ण', 'ṇ'],
    ['त', 't'], ['थ', 'th'], ['द', 'd'], ['ध', 'dh'], ['न', 'n'],
    ['प', 'p'], ['फ', 'ph'], ['ब', 'b'], ['भ', 'bh'], ['म', 'm'],
    ['य', 'y'], ['र', 'r'], ['ल', 'l'], ['व', 'v'], ['श', 'ś'], ['ष', 'ṣ'], ['स', 's'], ['ह', 'h'], ['ळ', 'ḻ'],
  ];
  const OTHERS = [['ं', 'ṃ'], ['ः', 'ḥ'], ['ँ', 'm̐'], ['ऽ', "'"], ['॥', '||'], ['।', '|'], ['ॐ', 'oṃ']];
  const DIGITS_DEV = '०१२३४५६७८९';
  const VIRAMA = '्';

  const indep2iast = {}, matra2iast = {}, cons2iast = {}, other2iast = {};
  VOWELS.forEach(([iv, m, l]) => { indep2iast[iv] = l; if (m) matra2iast[m] = l; });
  CONSONANTS.forEach(([c, l]) => (cons2iast[c] = l));
  OTHERS.forEach(([c, l]) => (other2iast[c] = l));

  // ---- Script offsets (Kannada is laid out like Devanagari in Unicode) -------------
  const KN_OFFSET = 0x0c80 - 0x0900;
  function devToKannada(s) {
    let out = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x0900 && cp <= 0x097f && cp !== 0x0964 && cp !== 0x0965) {
        const k = cp + KN_OFFSET;
        out += isKannadaAssigned(k) ? String.fromCodePoint(k) : ch;
      } else out += ch;
    }
    return out;
  }
  function kannadaToDev(s) {
    let out = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x0c80 && cp <= 0x0cff) {
        // short e/o (ಎ ಒ ೆ ೊ) have no Sanskrit Devanagari twin; map to long forms
        const fix = { 0x0c8e: 0x0c8f, 0x0c92: 0x0c93, 0x0cc6: 0x0cc7, 0x0cca: 0x0ccb }[cp] || cp;
        const d = fix - KN_OFFSET;
        out += d >= 0x0900 && d <= 0x097f ? String.fromCodePoint(d) : ch;
      } else out += ch;
    }
    return out;
  }
  function isKannadaAssigned(cp) {
    const unassigned = [0x0c84, 0x0c8d, 0x0c91, 0x0ca9, 0x0cb4, 0x0cba, 0x0cbb, 0x0cc5, 0x0cc9, 0x0cce, 0x0ccf];
    if (unassigned.includes(cp)) return false;
    if (cp >= 0x0cd0 && cp <= 0x0cd4) return false;
    if (cp >= 0x0cd7 && cp <= 0x0cdc) return false;
    return cp >= 0x0c80 && cp <= 0x0cf3;
  }

  // ---- Devanagari -> IAST ----------------------------------------------------------
  function devToIAST(s) {
    s = s.normalize('NFC');
    const chars = Array.from(s);
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const next = chars[i + 1];
      if (cons2iast[c] !== undefined) {
        out += cons2iast[c];
        if (next === VIRAMA) { i++; continue; }
        if (next !== undefined && matra2iast[next] !== undefined) { out += matra2iast[next]; i++; continue; }
        // inherent a, mark diaeresis if followed by independent i/u (ka-i, ka-u)
        out += 'a';
        if (next === 'इ') { out += 'ï'; i++; continue; }
        if (next === 'उ') { out += 'ü'; i++; continue; }
        continue;
      }
      if (indep2iast[c] !== undefined) { out += indep2iast[c]; continue; }
      if (other2iast[c] !== undefined) { out += other2iast[c]; continue; }
      const di = DIGITS_DEV.indexOf(c);
      if (di >= 0) { out += String(di); continue; }
      if (c === '़') continue; // nukta: drop
      out += c;
    }
    return out;
  }

  // ---- IAST -> Devanagari ----------------------------------------------------------
  const iastCons = CONSONANTS.map(([d, l]) => [l, d]).sort((a, b) => b[0].length - a[0].length);
  const iastVow = VOWELS.map(([iv, m, l]) => [l, iv, m]).sort((a, b) => b[0].length - a[0].length);
  function matchAt(list, s, i) {
    for (const e of list) if (s.startsWith(e[0], i)) return e;
    return null;
  }
  function iastToDev(src) {
    let s = src.normalize('NFC').toLowerCase();
    // common alternative spellings
    s = s.replace(/ṁ/g, 'ṃ').replace(/r̥̄/g, 'ṝ').replace(/r̥/g, 'ṛ').replace(/l̥̄/g, 'ḹ').replace(/l̥/g, 'ḷ').replace(/ṟ/g, 'r');
    let out = '';
    let i = 0;
    while (i < s.length) {
      if (s.startsWith('m̐', i)) { out += 'ँ'; i += 2; continue; }
      if (s.startsWith('oṃ', i) && !/[a-zāīūṛṝḷḹṅñṭḍṇśṣḻ]/.test(s[i - 1] || '') && !/[a-zāīūṛṝḷḹṅñṭḍṇśṣḻ]/.test(s[i + 2] || '')) { out += 'ॐ'; i += 2; continue; }
      const c = matchAt(iastCons, s, i);
      if (c) {
        // 'ḷ' as consonant only when followed by a vowel? vocalic ḷ is rare; treat ḷ as vowel (handled below)
        out += c[1];
        i += c[0].length;
        const v = matchAt(iastVow, s, i);
        if (v) {
          // ai/au after consonant but written a+ï / a+ü
          if (v[0] === 'a' && (s[i + 1] === 'ï' || s[i + 1] === 'ü')) { out += s[i + 1] === 'ï' ? 'इ' : 'उ'; i += 2; continue; }
          out += v[2];
          i += v[0].length;
        } else out += VIRAMA;
        continue;
      }
      const v = matchAt(iastVow, s, i);
      if (v) { out += v[1]; i += v[0].length; continue; }
      const ch = s[i];
      if (ch === 'ï') { out += 'इ'; i++; continue; }
      if (ch === 'ü') { out += 'उ'; i++; continue; }
      if (ch === 'ṃ') { out += 'ं'; i++; continue; }
      if (ch === 'ḥ') { out += 'ः'; i++; continue; }
      if (ch === "'" || ch === '’') { out += 'ऽ'; i++; continue; }
      if (s.startsWith('||', i)) { out += '॥'; i += 2; continue; }
      if (ch === '|') { out += '।'; i++; continue; }
      if (ch >= '0' && ch <= '9') { out += DIGITS_DEV[+ch]; i++; continue; }
      out += ch;
      i++;
    }
    return out;
  }

  // ---- ITRANS / Harvard-Kyoto -> IAST ---------------------------------------------
  const ITRANS = [
    ['RRI', 'ṝ'], ['R^I', 'ṝ'], ['RRi', 'ṛ'], ['R^i', 'ṛ'], ['LLI', 'ḹ'], ['L^I', 'ḹ'], ['LLi', 'ḷ'], ['L^i', 'ḷ'],
    ['shh', 'ṣ'], ['Sh', 'ṣ'], ['sh', 'ś'], ['chh', 'ch'], ['Ch', 'ch'], ['ch', 'c'],
    ['~N', 'ṅ'], ['N^', 'ṅ'], ['~n', 'ñ'], ['JN', 'ñ'], ['GY', 'jñ'], ['dny', 'jñ'], ['j~n', 'jñ'],
    ['Th', 'ṭh'], ['Dh', 'ḍh'], ['T', 'ṭ'], ['D', 'ḍ'], ['N', 'ṇ'],
    ['aa', 'ā'], ['ii', 'ī'], ['ee', 'ī'], ['uu', 'ū'], ['oo', 'ū'], ['A', 'ā'], ['I', 'ī'], ['U', 'ū'],
    ['.N', 'm̐'], ['.m', 'ṃ'], ['.n', 'ṃ'], ['M', 'ṃ'], ['.h', ''], ['H', 'ḥ'], ['.a', "'"], ['x', 'kṣ'], ['w', 'v'], ['OM', 'oṃ'], ['AUM', 'oṃ'],
  ];
  const HK = [
    ['RR', 'ṝ'], ['lRR', 'ḹ'], ['lR', 'ḷ'], ['R', 'ṛ'], ['A', 'ā'], ['I', 'ī'], ['U', 'ū'],
    ['M', 'ṃ'], ['H', 'ḥ'], ['G', 'ṅ'], ['J', 'ñ'], ['T', 'ṭ'], ['D', 'ḍ'], ['N', 'ṇ'], ['z', 'ś'], ['S', 'ṣ'],
  ];
  function tableReplace(s, table) {
    const t = table.slice().sort((a, b) => b[0].length - a[0].length);
    let out = '';
    let i = 0;
    while (i < s.length) {
      let hit = null;
      for (const e of t) if (s.startsWith(e[0], i)) { hit = e; break; }
      if (hit) { out += hit[1]; i += hit[0].length; } else { out += s[i]; i++; }
    }
    return out;
  }
  const itransToIAST = (s) => tableReplace(s, ITRANS);
  const hkToIAST = (s) => tableReplace(s, HK);

  // ---- Detection & dispatcher ------------------------------------------------------
  function detect(s) {
    if (/[ऀ-ॿ]/.test(s)) return 'deva';
    if (/[ಀ-೿]/.test(s)) return 'knda';
    if (/[āīūṛṝḷḹṅñṭḍṇśṣṃḥ]/i.test(s.normalize('NFC'))) return 'iast';
    return 'latin';
  }
  // Convert text from one scheme to another. from: 'auto'|'deva'|'knda'|'iast'|'itrans'|'hk'
  function convert(text, from, to) {
    if (from === 'auto') from = detect(text);
    if (from === 'latin') from = 'iast';
    let deva;
    if (from === 'deva') deva = text;
    else if (from === 'knda') deva = kannadaToDev(text);
    else if (from === 'iast') deva = iastToDev(text);
    else if (from === 'itrans') deva = iastToDev(itransToIAST(text));
    else if (from === 'hk') deva = iastToDev(hkToIAST(text));
    else deva = text;
    if (to === 'deva') return deva;
    if (to === 'knda') return devToKannada(deva);
    if (to === 'iast') return from === 'itrans' ? itransToIAST(text) : from === 'hk' ? hkToIAST(text) : devToIAST(deva);
    return text;
  }

  // Numerals for page numbers
  function numerals(n, style) {
    const s = String(n);
    if (style === 'lowerroman') style = 'roman';
    if (style === 'upperroman') style = 'ROMAN';
    if (style === 'loweralpha' || style === 'upperalpha') { let x = n, r = ''; while (x > 0) { x--; r = String.fromCharCode(97 + (x % 26)) + r; x = Math.floor(x / 26); } return style === 'upperalpha' ? r.toUpperCase() : r; }
    if (style === 'kannada') return s.replace(/\d/g, (d) => String.fromCodePoint(0x0ce6 + +d));
    if (style === 'devanagari') return s.replace(/\d/g, (d) => DIGITS_DEV[+d]);
    if (style === 'roman' || style === 'ROMAN') {
      const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
      let r = '';
      let x = n;
      for (const [v, t] of map) while (x >= v) { r += t; x -= v; }
      return style === 'ROMAN' ? r.toUpperCase() : r;
    }
    return s;
  }

  BV.translit = { convert, detect, devToIAST, iastToDev, devToKannada, kannadaToDev, itransToIAST, hkToIAST, numerals };
  BV.IAST_CHARS = ['ā', 'ī', 'ū', 'ṛ', 'ṝ', 'ḷ', 'ḹ', 'ṃ', 'ḥ', 'ṅ', 'ñ', 'ṭ', 'ḍ', 'ṇ', 'ś', 'ṣ', 'm̐', 'Ā', 'Ī', 'Ū', 'Ṛ', 'Ṝ', 'Ḷ', 'Ṃ', 'Ḥ', 'Ṅ', 'Ñ', 'Ṭ', 'Ḍ', 'Ṇ', 'Ś', 'Ṣ'];
})();
