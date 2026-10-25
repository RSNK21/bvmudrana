/* Kannada ASCII (Nudi / Baraha) <-> Unicode converter.
   Conversion engine from the Brahmavidya Kannada converter
   (https://brahmavidya.co.in/kannada-ascii-to-unicode-converter/), used here unchanged
   except for indexing the lookup tables by first character for speed on whole books. */
(function () {
'use strict';
const KANNADA = "\u0C80-\u0CFF";

/** Longest-match table for the Nudi/Baraha ANSI family. */
const mapping = new Map();
const add = (legacy, unicode) => legacy && mapping.set(legacy, unicode);

[
  ["C", "ಅ"], [",,", "ಽ"], ["D", "ಆ"], ["E", "ಇ"], ["F", "ಈ"], ["G", "ಉ"],
  ["H", "ಊ"], ["IÄ", "ಋ"], ["IÆ2", "ೠ"], ["IÆA", "ೠಂ"], ["®ñA", "ಲೄಂ"], ["J", "ಎ"], ["K", "ಏ"],
  ["L", "ಐ"], ["M", "ಒ"], ["N", "ಓ"], ["O", "ಔ"], ["A", "ಂ"], ["B", "ಃ"],
].forEach(([a, u]) => add(a, u));

// These are context fragments in Nudi/Baraha output. A terminal z is the
// inherent-vowel form of ದ when the font omits its usual À suffix; a lone i is
// a positioning/control component and must never leak into Unicode output.
add("z", "ದ");
add("i", "");
// Alternate Nudi/Baraha-family single-byte forms seen in PDF extraction.
add("e", "ಜ");
add("¨", "ಬ");

// dead, base, aa, i, ii, u, uu, vocalic-r, e, ee, ai, o, oo, au
const series = [
  ["ಕ","Pï","PÀ","PÁ","Q","QÃ","PÀÄ","PÀÆ","PÀÈ","PÉ","PÉÃ","PÉÊ","PÉÆ","PÉÆÃ","PË"],
  ["ಖ","Sï","R","SÁ","T","TÃ","RÄ","RÆ","RÈ","SÉ","SÉÃ","SÉÊ","SÉÆ","SÉÆÃ","SË"],
  ["ಗ","Uï","UÀ","UÁ","V","VÃ","UÀÄ","UÀÆ","UÀÈ","UÉ","UÉÃ","UÉÊ","UÉÆ","UÉÆÃ","UË"],
  ["ಘ","Wï","WÀ","WÁ","X","XÃ","WÀÄ","WÀÆ","WÀÈ","WÉ","WÉÃ","WÉÊ","WÉÆ","WÉÆÃ","WË"],
  ["ಙ","Yï","Y","YÁ","YÂ","YÂÃ","YÄ","YÆ","YÈ","YÉ","YÉÃ","YÉÊ","YÉÆ","YÉÆÃ","YË"],
  ["ಚ","Zï","ZÀ","ZÁ","a","aÃ","ZÀÄ","ZÀÆ","ZÀÈ","ZÉ","ZÉÃ","ZÉÊ","ZÉÆ","ZÉÆÃ","ZË"],
  ["ಛ","bï","bÀ","bÁ","c","cÃ","bÀÄ","bÀÆ","bÀÈ","bÉ","bÉÃ","bÉÊ","bÉÆ","bÉÆÃ","bË"],
  ["ಜ","dï","d","eÁ","f","fÃ","dÄ","dÆ","dÈ","eÉ","eÉÃ","eÉÊ","eÉÆ","eÉÆÃ","eË"],
  ["ಝ","gÀhÄï","gÀhÄ","gÀhiÁ","jhÄ","jhÄÃ","gÀhÄÄ","gÀhÄÆ","gÀhÄÈ","gÉhÄ","gÉhÄÃ","gÉhÄÊ","gÉhÆ","gÉhÆÃ","gÀhiË"],
  ["ಞ","kï","k","kÁ","kÂ","kÂÃ","kÄ","kÆ","kÈ","kÉ","kÉÃ","kÉÊ","kÉÆ","kÉÆÃ","kË"],
  ["ಟ","mï","l","mÁ","n","nÃ","lÄ","lÆ","lÈ","mÉ","mÉÃ","mÉÊ","mÉÆ","mÉÆÃ","mË"],
  ["ಠ","oï","oÀ","oÁ","p","pÃ","oÀÄ","oÀÆ","oÀÈ","oÉ","oÉÃ","oÉÊ","oÉÆ","oÉÆÃ","oË"],
  ["ಡ","qï","qÀ","qÁ","r","rÃ","qÀÄ","qÀÆ","qÀÈ","qÉ","qÉÃ","qÉÊ","qÉÆ","qÉÆÃ","qË"],
  ["ಢ","qsï","qsÀ","qsÁ","rü","rüÃ","qsÀÄ","qsÀÆ","qsÀÈ","qsÉ","qsÉÃ","qsÉÊ","qsÉÆ","qsÉÆÃ","qsË"],
  ["ಣ","uï","t","uÁ","tÂ","tÂÃ","tÄ","tÆ","tÈ","uÉ","uÉÃ","uÉÊ","uÉÆ","uÉÆÃ","uË"],
  ["ತ","vï","vÀ","vÁ","w","wÃ","vÀÄ","vÀÆ","vÀÈ","vÉ","vÉÃ","vÉÊ","vÉÆ","vÉÆÃ","vË"],
  ["ಥ","xï","xÀ","xÁ","y","yÃ","xÀÄ","xÀÆ","xÀÈ","xÉ","xÉÃ","xÉÊ","xÉÆ","xÉÆÃ","xË"],
  ["ದ","zï","zÀ","zÁ","¢","¢Ã","zÀÄ","zÀÆ","zÀÈ","zÉ","zÉÃ","zÉÊ","zÉÆ","zÉÆÃ","zË"],
  ["ಧ","zsï","zsÀ","zsÁ","¢ü","¢üÃ","zsÀÄ","zsÀÆ","zsÀÈ","zsÉ","zsÉÃ","zsÉÊ","zsÉÆ","zsÉÆÃ","zsË"],
  ["ನ","£ï","£À","£Á","¤","¤Ã","£ÀÄ","£ÀÆ","£ÀÈ","£É","£ÉÃ","£ÉÊ","£ÉÆ","£ÉÆÃ","£Ë"],
  ["ಪ","¥ï","¥À","¥Á","¦","¦Ã","¥ÀÄ","¥ÀÆ","¥ÀÈ","¥É","¥ÉÃ","¥ÉÊ","¥ÉÆ","¥ÉÆÃ","¥Ë"],
  ["ಫ","¥sï","¥sÀ","¥sÁ","¦ü","¦üÃ","¥sÀÄ","¥sÀÆ","¥sÀÈ","¥sÉ","¥sÉÃ","¥sÉÊ","¥sÉÆ","¥sÉÆÃ","¥sË"],
  ["ಬ","§ï","§","¨Á","©","©Ã","§Ä","§Æ","§È","¨É","¨ÉÃ","¨ÉÊ","¨ÉÆ","¨ÉÆÃ","¨Ë"],
  ["ಭ","¨sï","¨sÀ","¨sÁ","©ü","©üÃ","¨sÀÄ","¨sÀÆ","¨sÀÈ","¨sÉ","¨sÉÃ","¨sÉÊ","¨sÉÆ","¨sÉÆÃ","¨sË"],
  ["ಮ","ªÀÄï","ªÀÄ","ªÀiÁ","«Ä","«ÄÃ","ªÀÄÄ","ªÀÄÆ","ªÀÄÈ","ªÉÄ","ªÉÄÃ","ªÉÄÊ","ªÉÆ","ªÉÆÃ","ªÀiË"],
  ["ಯ","AiÀÄï","AiÀÄ","AiÀiÁ","¬Ä","¬ÄÃ","AiÀÄÄ","AiÀÄÆ","AiÀÄÈ","AiÉÀÄ","AiÉÄÃ","AiÉÀÄÊ","AiÉÆ","AiÉÆÃ","AiÀiË"],
  ["ರ","gï","gÀ","gÁ","j","jÃ","gÀÄ","gÀÆ","gÀÈ","gÉ","gÉÃ","gÉÊ","gÉÆ","gÉÆÃ","gË"],
  ["ಲ","®ï","®","¯Á","°","°Ã","®Ä","®Æ","®È","¯É","¯ÉÃ","¯ÉÊ","¯ÉÆ","¯ÉÆÃ","¯Ë"],
  ["ವ","ªï","ªÀ","ªÁ","«","«Ã","ªÀÅ","ªÀÇ","ªÀÈ","ªÉ","ªÉÃ","ªÉÊ","ªÉÇ","ªÉÇÃ","ªË"],
  ["ಶ","±ï","±À","±Á","²","²Ã","±ÀÄ","±ÀÆ","±ÀÈ","±É","±ÉÃ","±ÉÊ","±ÉÆ","±ÉÆÃ","±Ë"],
  ["ಷ","µï","µÀ","µÁ","¶","¶Ã","µÀÄ","µÀÆ","µÀÈ","µÉ","µÉÃ","µÉÊ","µÉÆ","µÉÆÃ","µË"],
  ["ಸ","¸ï","¸À","¸Á","¹","¹Ã","¸ÀÄ","¸ÀÆ","¸ÀÈ","¸É","¸ÉÃ","¸ÉÊ","¸ÉÆ","¸ÉÆÃ","¸Ë"],
  ["ಹ","ºï","ºÀ","ºÁ","»","»Ã","ºÀÄ","ºÀÆ","ºÀÈ","ºÉ","ºÉÃ","ºÉÊ","ºÉÆ","ºÉÆÃ","ºË"],
  ["ಳ","¼ï","¼À","¼Á","½","½Ã","¼ÀÄ","¼ÀÆ","¼ÀÈ","¼É","¼ÉÃ","¼ÉÊ","¼ÉÆ","¼ÉÆÃ","¼Ë"],
];

const vowelSigns = ["್", "", "ಾ", "ಿ", "ೀ", "ು", "ೂ", "ೃ", "ೆ", "ೇ", "ೈ", "ೊ", "ೋ", "ೌ"];
for (const row of series) {
  const [letter, ...forms] = row;
  forms.forEach((form, index) => add(form, letter + vowelSigns[index]));
  add(forms[1] + "A", letter + "ಂ");
  add(forms[1] + "B", letter + "ಃ");
}

const subjoined = {
  "Ì":"ಕ","Í":"ಖ","Î":"ಗ","Ï":"ಘ","Ð":"ಙ","Ñ":"ಚ","Ò":"ಛ","Ó":"ಜ","Ô":"ಝ","Õ":"ಞ",
  "Ö":"ಟ","×":"ಠ","Ø":"ಡ","Ù":"ಢ","Ú":"ಣ","Û":"ತ","Ü":"ಥ","Ý":"ದ","Þ":"ಧ","ß":"ನ",
  "à":"ಪ","á":"ಫ","â":"ಬ","ã":"ಭ","ä":"ಮ","å":"ಯ","æ":"ರ","è":"ಲ","é":"ವ","ê":"ಶ",
  "ë":"ಷ","ì":"ಸ","í":"ಹ","î":"ಳ","¿":"ೞ",
};
Object.entries(subjoined).forEach(([a, u]) => add(a, "್" + u));

// NUDI01 uses a dedicated final-ra form for the three-consonant ಸ್ತ್ರ family.
// The final ç positions the ottakshara correctly; no visible prefix is required.
const canonicalLegacyClusters = new Map();
// NUDI01 requires this exact keypress order for ತ್ಯೇ. The leading marker is
// part of its visual cluster form, not a separate Kannada ರ.
canonicalLegacyClusters.set("ತ್ಯೇ", "ævÉåÃ");
add("ævÉåÃ", "ತ್ಯೇ");
// Avoid ambiguous NUDI byte sequences in repha + ವ vowel forms.
[
  ["", "gÀé"], ["ಾ", "gÀéÁ"], ["ಿ", "gÀéÂ"], ["ೀ", "gÀéÂÃ"],
  ["ು", "gÀéÄ"], ["ೂ", "gÀéÆ"], ["ೃ", "gÀéø"], ["ೆ", "gÀéÉ"],
  ["ೇ", "gÀéÉÃ"], ["ೈ", "gÀéÉÊ"], ["ೊ", "gÀéÉÆ"], ["ೋ", "gÀéÉÆÃ"], ["ೌ", "gÀéË"],
].forEach(([sign, legacy]) => {
  canonicalLegacyClusters.set("ರ್ವ" + sign, legacy);
  add(legacy, "ರ್ವ" + sign);
});
const saFormsForStra = series.find((row) => row[0] === "ಸ").slice(1);
vowelSigns.forEach((sign, index) => {
  const unicode = "ಸ್ತ್ರ" + sign;
  const legacy = saFormsForStra[index] + "Ûç";
  canonicalLegacyClusters.set(unicode, legacy);
  add(legacy, unicode);
  add("s" + legacy, unicode); // Accept the short-lived prefixed form without emitting it.
});

[
  ["PÀë", "ಕ್ಷ"], ["kÕ", "ಞ್ಞ"], ["gÀÜå", "ರ್ಥ್ಯ"], ["xÀåð", "ರ್ಥ್ಯ"],
  ["gÀå", "ರ್ಯ"], ["gÁå", "ರ್ಯಾ"], ["AiÀÄð", "ರ್ಯ"], ["ªÀÄåð", "ರ್ಮ್ಯ"],
  ["gÉæ", "ರ್ರೆ"], ["gÀä", "ರ್ಮ"], ["jä", "ರ್ಮಿ"], ["jäÃ", "ರ್ಮೀ"],
  ["gÀé", "ರ್ವ"], ["jÛ", "ರ್ತಿ"], ["VæÃ", "ಗ್ರೀ"], ["¶ÖæÃ", "ಷ್ಟ್ರೀ"],
  ["wÛ", "ತ್ತಿ"], ["¥Áæ", "ಪ್ರಾ"], ["¸ÀÌø", "ಸ್ಕೃ"], ["gÁ¶ÖçÃAiÀÄ", "ರಾಷ್ಟ್ರೀಯ"],
  ["EAVèµï", "ಇಂಗ್ಲಿಷ್"], ["«µÀAiÀÄ", "ವಿಷಯ"], ["¸ËPÀAiÀÄð", "ಸೌಕರ್ಯ"],
  ["0iÀÄÄ", "ಯು"], ["AiÉÄ", "ಯೆ"], ["0iÉÆ", "ಯೊ"], ["¥ÀÇ", "ಪೂ"],
  ["¥sÀÅ", "ಫು"], ["¥sÀÇ", "ಫೂ"], ["gÉå", "ರ್ಯೆ"], ["gÉåÃ", "ರ್ಯೇ"],
  ["gÉÆå", "ರ್ಯೊ"], ["gÉÆåÃ", "ರ್ಯೋ"], ["gÀÄå", "ರ್ಯು"], ["gÀÆå", "ರ್ಯೂ"],
  ["jå", "ರ್ಯಿ"], ["jåÃ", "ರ್ಯೀ"], ["gÀåA", "ರ್ಯಂ"], ["gÀåB", "ರ್ಯಃ"],
  ["gÉÆÜåÃ", "ರ್ಥ್ಯೋ"], ["ªÀiÁåð", "ರ್ಮ್ಯಾ"], ["gÁìöå", "ರ್ಸ್ಯಾ"],
  ["¢æ", "ದ್ರಿ"], ["ªÀÄ¢æ", "ಮುದ್ರಿ"], ["UÉÀ", "ಗೆ"], ["¥ÀÅ", "ಪು"],
  ["AiÀÄUÀ", "ಯಗ"], ["¥ÀÖ", "ಪ್ಟ"],
].forEach(([a, u]) => add(a, u));

const suspicious = /[A-Za-zÀ-ÿ¢£¤¥¦§¨©¬®¯°±²µ¶¸¹º»¼½¾¿]/;
// Preserve ZWNJ/ZWJ: they are meaningful Kannada shaping controls.
const invisibleFormatting = /[\u00AD\u034F\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const dependentVowelAtEnd = /[ಾಿೀುೂೃೆೇೈೊೋೌ]$/u;
const kannadaClusterAtEnd = /[\u0C80-\u0CFF\u200C\u200D]$/u;

function endsInKannadaCluster(output) {
  return kannadaClusterAtEnd.test(output);
}

function preprocessLegacy(input) {
  return input
    .normalize("NFC")
    .replace(invisibleFormatting, "")
    // Some legacy documents substitute Greek mu (U+03BC) for the NUDI
    // micro sign (U+00B5) used by every ಷ syllable.
    .replace(/μ/g, "µ")
    // Some NUDI variants encode final ಲ್ with a standalone macron. Preserve
    // the established ಲಾ/ಲೆ/ಲೈ/ಲೊ/ಲೋ/ಲೌ sequences that also begin with ¯.
    .replace(/¯ï/g, "®ï")
    .replace(/¯(?![ÁÉË])/g, "®ï")
    .replace(/À{2,}/g, "À")
    .replace(/É{2,}/g, "É");
}

function applySubjoined(output, consonant) {
  const vowel = output.match(dependentVowelAtEnd)?.[0] || "";
  if (vowel) {
    return output.slice(0, -vowel.length) + "್" + consonant + vowel;
  }
  return output + "್" + consonant;
}

function applyBrokenMark(output, mark) {
  const transforms = {
    "Ã": [[/ಿ$/u, "ೀ"], [/ೆ$/u, "ೇ"], [/ೊ$/u, "ೋ"]],
    "Ê": [[/ೆ$/u, "ೈ"]],
    "Æ": [[/ೆ$/u, "ೊ"]],
  };
  for (const [pattern, replacement] of transforms[mark] || []) {
    if (pattern.test(output)) return output.replace(pattern, replacement);
  }
  return output + ({ "Ã":"ೀ", "Ä":"ು", "Æ":"ೂ", "È":"ೃ", "Ê":"ೈ" }[mark] || mark);
}

function applyLooseModifier(output, mark) {
  if (mark === "À") return output;
  if (mark === "ç" || mark === "æ") return applySubjoined(output, "ರ");
  if (mark === "ü") return output + "ರ್";
  if (mark === "ï") return output.replace(dependentVowelAtEnd, "") + "್";
  const signs = { "Á":"ಾ", "Â":"ಿ", "É":"ೆ", "Ë":"ೌ", "ø":"ೃ" };
  const sign = signs[mark];
  if (!sign) return null;
  return output.replace(dependentVowelAtEnd, "") + sign;
}

/**
 * Converts Nudi/Baraha legacy text using longest-match-first and Kannada cluster rules.
 * Text between $...$ is preserved as English.
 */
function convertKannada(input, customEntries = []) {
  const localMap = new Map(mapping);
  for (const entry of customEntries) {
    if (entry?.from && entry?.to) localMap.set(entry.from, entry.to);
  }
  const keys = [...localMap.keys()].sort((a, b) => b.length - a.length);
  const keyIndex = new Map();
  for (const k of keys) { const c = k[0]; if (!keyIndex.has(c)) keyIndex.set(c, []); keyIndex.get(c).push(k); }
  const aLongKeys = keys.filter((nextKey) => nextKey.length > 1 && nextKey.startsWith("A"));
  const preparedInput = protectEnglishWords(preprocessLegacy(protectDigitFractions(input)), keys);
  let output = "";
  const unknown = [];
  let preserved = false;

  for (let i = 0; i < preparedInput.length;) {
    if (preparedInput[i] === "$") { preserved = !preserved; i += 1; continue; }
    if (preparedInput[i] === englishStartSentinel) { preserved = true; i += 1; continue; }
    if (preparedInput[i] === englishEndSentinel) { preserved = false; i += 1; continue; }
    if (preserved) { output += preparedInput[i++]; continue; }

    const key = (keyIndex.get(preparedInput[i]) || []).find((candidate) => {
      if (!preparedInput.startsWith(candidate, i)) return false;
      // Anusvara A is also the first byte of legacy Ya syllables. Do not let a
      // shorter consonant+A match steal it when A begins any valid longer key
      // (AiÀÄ, AiÉÄÃ, AiÉÆ...); this is the ಗಣಪತಯೇ / paryaya class of bug.
      if (candidate.endsWith("A")) {
        const possibleNextKey = preparedInput.slice(i + candidate.length - 1);
        const aStartsLongerMapping = aLongKeys.some((nextKey) => possibleNextKey.startsWith(nextKey));
        if (aStartsLongerMapping) return false;
      }
      return true;
    });
    if (key) {
      if (key.length === 1 && subjoined[key]) output = applySubjoined(output, subjoined[key]);
      else output += localMap.get(key);
      i += key.length;
      continue;
    }

    const char = preparedInput[i++];
    if (["Ã", "Ä", "Æ", "È", "Ê"].includes(char) && endsInKannadaCluster(output)) {
      output = applyBrokenMark(output, char);
    } else if (char === "ð") {
      output = output.replace(/([ಕ-ಹಳ](?:್[\u200C\u200D]?[ಕ-ಹಳ])*(?:[ಾಿೀುೂೃೆೇೈೊೋೌ])?)$/u, "ರ್$1");
    } else if (char === "ö" || char === "÷") {
      continue;
    } else if (char === "ü") {
      // Prefix repha used by some NUDI documents.
      output += "ರ್";
      continue;
    } else if (char === "ï") {
      // Ignore a truly orphaned legacy virama; otherwise attach it to its base.
      if (endsInKannadaCluster(output)) output = applyLooseModifier(output, char);
      continue;
    } else {
      const repaired = endsInKannadaCluster(output) ? applyLooseModifier(output, char) : null;
      if (repaired !== null) output = repaired;
      else {
        output += char;
        if (suspicious.test(char)) unknown.push({ char, position: i - 1 });
      }
    }
  }

  return {
    text: output
      .replace(/(^|[^\u0C95-\u0CB9\u0CBC])\u0CCD[\u200C\u200D]?/gu, "$1")
      .replace(/\u200D(?=\u0CCD)/gu, "")
      .replace(/\u0CCD{2,}/gu, "\u0CCD")
      .replace(/\u25CC/gu, "")
      .normalize("NFC")
      .replace(/\u093D/gu, "\u0CBD")
      .replace(/[\uE103-\uE105]/gu, (s) => sentinelToDigitFraction.get(s)),
    unknown,
    clean: unknown.length === 0,
  };
}

/**
 * Converts Unicode Kannada to the canonical legacy form already present in
 * this converter's mapping table. Longer mapped sequences take priority.
 */
function convertUnicode(input) {
  const reverseMap = new Map();
  for (const [legacy, unicode] of mapping) {
    if (unicode) reverseMap.set(unicode, legacy);
  }
  reverseMap.set("ಽ", "ಽ");
  "೦೧೨೩೪೫೬೭೮೯".split("").forEach((digit, index) => reverseMap.set(digit, String(index)));
  // Accept alternate legacy Ya spellings, but always emit the canonical
  // Ai... series in Unicode-to-ASCII output.
  const yaSeries = series.find((row) => row[0] === "ಯ");
  if (yaSeries) {
    yaSeries.slice(1).forEach((form, index) => reverseMap.set("ಯ" + vowelSigns[index], form));
  }
  const reverseKeys = [...reverseMap.keys()].sort((a, b) => b.length - a.length);
  const revIndex = new Map();
  for (const k of reverseKeys) { const c = k[0]; if (!revIndex.has(c)) revIndex.set(c, []); revIndex.get(c).push(k); }
  const formIndex = new Map(series.map((row) => [row[0], row.slice(1)]));
  const subjoinedReverse = new Map(
    Object.entries(subjoined).map(([legacy, letter]) => [letter, legacy]),
  );
  const vowelIndex = new Map([
    ["", 1], ["ಾ", 2], ["ಿ", 3], ["ೀ", 4], ["ು", 5], ["ೂ", 6],
    ["ೃ", 7], ["ೆ", 8], ["ೇ", 9], ["ೈ", 10], ["ೊ", 11], ["ೋ", 12], ["ೌ", 13],
  ]);
  const consonant = /^[ಕ-ಹಳ]$/u;
  const prepared = protectEnglishWords(protectLiteralFractions(input.replace(/\u0CCD\u0CBC/gu, "\u0CCD").normalize("NFC").replace(invisibleFormatting, "").replace(/([ಕ-ಹಳ])[\u200C\u200D]+(?=[ಾಿೀುೂೃೆೇೈೊೋೌ])/gu, "$1").replace(/ಅಾ/gu, "ಆ").replace(/ಅಿ/gu, "ಇ").replace(/ಅೀ/gu, "ಈ").replace(/ಅು/gu, "ಉ").replace(/ಅೂ/gu, "ಊ").replace(/ಅೃ/gu, "ಋ").replace(/ಅೆ/gu, "ಎ").replace(/ಅೇ/gu, "ಏ").replace(/ಅೈ/gu, "ಐ").replace(/ಅೊ/gu, "ಒ").replace(/ಅೋ/gu, "ಓ").replace(/ಅೌ/gu, "ಔ").normalize("NFC").replace(/\u093D/gu, "\u0CBD")));
  let text = "";
  const unknown = [];

  const canonicalClusterKeys = [...canonicalLegacyClusters.keys()].sort((a, b) => b.length - a.length);
  const canIndex = new Map();
  for (const k of canonicalClusterKeys) { const c = k[0]; if (!canIndex.has(c)) canIndex.set(c, []); canIndex.get(c).push(k); }

  for (let i = 0; i < prepared.length;) {
    const canonicalCluster = (canIndex.get(prepared[i]) || []).find((candidate) => prepared.startsWith(candidate, i));
    if (canonicalCluster) {
      text += canonicalLegacyClusters.get(canonicalCluster);
      i += canonicalCluster.length;
      continue;
    }
    const first = prepared[i];
    if (consonant.test(first) ? (prepared[i + 1] === "್" ?
        consonant.test(prepared[i + 2] || "") : false) : false) {
      const letters = [first];
      let cursor = i + 1;
      let finalVirama = false;
      while (prepared[cursor] === "್") {
        if (consonant.test(prepared[cursor + 1] || "")) {
          letters.push(prepared[cursor + 1]);
          cursor += 2;
          while (prepared[cursor] === "\u200C" || prepared[cursor] === "\u200D") cursor += 1;
        } else {
          finalVirama = true;
          cursor += 1;
          break;
        }
      }
      const sign = vowelIndex.has(prepared[cursor]) ? prepared[cursor++] : "";
      const isRepha = letters[0] === "ರ" ? (letters.length > 1 ? !finalVirama : false) : false;
      const baseLetter = isRepha ? letters[1] : letters[0];
      const tailLetters = isRepha ? letters.slice(2) : letters.slice(1);
      const forms = formIndex.get(baseLetter);
      const tails = tailLetters.map((letter) => subjoinedReverse.get(letter));
      if (forms ? tails.every(Boolean) : false) {
        const baseIndex = finalVirama
          ? (letters.length > 1 ? 1 : 0)
          : vowelIndex.get(sign);
        // NUDI01 subjoined glyphs have zero advance. The blank ö byte advances
        // successive ottaksharas so double and triple clusters do not overprint.
        const spacedTails = tails.join("ö");
        // Post-base vowel bytes must follow the complete ottakshara stack. Placing
        // them inside the base form causes forms such as ಶ್ರೀ and ತ್ಯೇ to jumble.
        const clusterForms = {
          "": forms[1] + spacedTails,
          "ಾ": forms[1] + spacedTails + "Á",
          "ಿ": forms[3] + spacedTails,
          "ೀ": forms[3] + spacedTails + "Ã",
          "ು": forms[1] + spacedTails + "Ä",
          "ೂ": forms[1] + spacedTails + "Æ",
          "ೃ": forms[1] + spacedTails + "ø",
          "ೆ": forms[8] + spacedTails,
          "ೇ": forms[8] + spacedTails + "Ã",
          "ೈ": forms[8] + spacedTails + "Ê",
          "ೊ": forms[8] + spacedTails + "Æ",
          "ೋ": forms[8] + spacedTails + "ÆÃ",
          "ೌ": forms[1] + spacedTails + "Ë",
        };
        const clusterForm = finalVirama
          ? forms[1] + spacedTails + "ï"
          : clusterForms[sign];
        // Repha follows the complete cluster, including its vowel bytes.
        text += clusterForm + (isRepha ? "ð" : "");
        if (prepared[cursor] === "ಂ") { text += "A"; cursor += 1; }
        else if (prepared[cursor] === "ಃ") { text += "B"; cursor += 1; }
        i = cursor;
        continue;
      }
    }

    const special = (revIndex.get(prepared[i]) || []).find((candidate) =>
      candidate.length > 1 && prepared.startsWith(candidate, i),
    );
    if (special) {
      text += reverseMap.get(special);
      i += special.length;
      continue;
    }

    const key = (revIndex.get(prepared[i]) || []).find((candidate) => prepared.startsWith(candidate, i));
    if (key) {
      text += reverseMap.get(key);
      i += key.length;
      continue;
    }

    text += first;
    if (/[ಀ-೿]/u.test(first)) unknown.push({ char: first, position: i });
    i += 1;
  }

  return { text, unknown, clean: unknown.length === 0 };
}

// ═══════════════════════════════════════════════════
// FRACTION & ENGLISH WORD PROTECTION
// Prevents conversion engine from consuming literal fractions
// and English words in mixed Kannada/English documents
// ═══════════════════════════════════════════════════

const literalFractionToSentinel = new Map([["¼", "\uE100"], ["½", "\uE101"], ["¾", "\uE102"]]);
const sentinelToLiteralFraction = new Map([...literalFractionToSentinel].map(([fraction, sentinel]) => [sentinel, fraction]));
function protectLiteralFractions(text) { return text.replace(/[¼½¾]/gu, (fraction) => literalFractionToSentinel.get(fraction)); }
function restoreLiteralFractions(text) { return text.replace(/[\uE100-\uE102]/gu, (sentinel) => sentinelToLiteralFraction.get(sentinel)); }
// CONV-001 fix: protect digit+fraction patterns (e.g. 3½) during ASCII→Unicode
// conversion so the legacy mapping does not consume the fraction character.
const digitFractionToSentinel = new Map([["¼", "\uE103"], ["½", "\uE104"], ["¾", "\uE105"]]);
const sentinelToDigitFraction = new Map([...digitFractionToSentinel].map(([fraction, sentinel]) => [sentinel, fraction]));
function protectDigitFractions(text) { return text.replace(/([0-9\u0CE6-\u0CE9])([¼½¾])/gu, (_, digit, frac) => digit + digitFractionToSentinel.get(frac)); }
function restoreDigitFractions(text) { return text.replace(/[\uE103-\uE105]/gu, (sentinel) => sentinelToDigitFraction.get(sentinel)); }
const englishStartSentinel = "\uE110";
const englishEndSentinel = "\uE111";
const clearEnglishWord = /(^|[\s([{<"'“‘,:;!?])([A-Z][A-Z0-9]{1,}|[A-Za-z][A-Za-z0-9]{2,}|a|I|an|as|at|be|by|if|in|is|it|of|on|or|to)(?=$|[\s)\]}>"'”’,:;!?])/gm;
const asciiKeyCache = new WeakMap();
function canParseAsLegacyWord(word, legacyKeys) {
  if (!legacyKeys || !legacyKeys.length) return false;
  const asciiKeys = asciiKeyCache.get(legacyKeys) || (asciiKeyCache.set(legacyKeys, legacyKeys.filter((key) => /^[A-Za-z0-9]+$/.test(key))), asciiKeyCache.get(legacyKeys));
  const reachable = new Uint8Array(word.length + 1);
  reachable[0] = 1;
  for (let index = 0; index < word.length; index += 1) {
    if (!reachable[index]) continue;
    for (const key of asciiKeys) {
      if (word.startsWith(key, index)) reachable[index + key.length] = 1;
    }
  }
  return reachable[word.length] === 1;
}
/* ═══════════════════════════════════════════════════════════════
   SECTION 2: ENGLISH WORD PROTECTION
   Sentinel-based protection for Latin words in mixed Kannada text.
   ═══════════════════════════════════════════════════════════════ */
function protectEnglishWords(text, legacyKeys = null) {
  const tokens = [...text.matchAll(clearEnglishWord)].map((match) => {
    const prefix = match[1] || "";
    const word = match[2];
    const start = match.index + prefix.length;
    return { word, start, end: start + word.length, ambiguous: canParseAsLegacyWord(word, legacyKeys) };
  });
  const englishGlue = /^[\s()\[\]{}<>"'“”‘’,:;!?-]*$/u;
  const selected = tokens.filter((token, index) => {
    if (!token.ambiguous) return true;
    const previous = tokens[index - 1];
    const next = tokens[index + 1];
    const followsEnglish = previous && !previous.ambiguous && englishGlue.test(text.slice(previous.end, token.start));
    const precedesEnglish = next && !next.ambiguous && englishGlue.test(text.slice(token.end, next.start));
    return Boolean(followsEnglish || precedesEnglish);
  });
  let result = "";
  let cursor = 0;
  for (const token of selected) {
    result += text.slice(cursor, token.start) + englishStartSentinel + token.word + englishEndSentinel;
    cursor = token.end;
  }
  return result + text.slice(cursor);
}
function restoreEnglishMarkers(text) { return text.replace(/[\uE110\uE111]/gu, ""); }


const keysCache = {};
function toUnicode(text, opts = {}) {
  const r = convertKannada(text, opts.custom || []);
  return r;
}
function toAscii(text) {
  const r = convertUnicode(text);
  return { text: restoreLiteralFractions(restoreEnglishMarkers(r.text)), unknown: r.unknown, clean: r.clean };
}
const api = { toUnicode, toAscii, convertKannada, convertUnicode };
if (typeof window !== 'undefined') { window.BV = window.BV || {}; window.BV.BVKannada = api; }
if (typeof module !== 'undefined') module.exports = api;
})();
