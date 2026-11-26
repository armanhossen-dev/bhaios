/* ==========================================================================
   BhaiOS Avro Phonetic Engine + Bilingual Study Autocomplete
   Converts Romanized Bangla (e.g., "ami banglay likhi") -> "আমি বাংলায় লিখি"
   ========================================================================== */

const COMMON_WORDS = {
  ami: ['আমি'],
  amar: ['আমার', 'আমাদের'],
  amader: ['আমাদের'],
  tumi: ['তুমি', 'তোমার'],
  tomar: ['তোমার', 'তোমাকে'],
  tomake: ['তোমাকে'],
  apni: ['আপনি', 'আপনার'],
  eta: ['এটা', 'এটি'],
  ota: ['ওটা', 'ওটি'],
  ki: ['কি', 'কী'],
  keno: ['কেন'],
  kivabe: ['কীভাবে', 'কিভাবে'],
  kothay: ['কোথায়'],
  kokhon: ['কখন'],
  koto: ['কত'],
  shohoj: ['সহজ', 'সহজে'],
  shohoje: ['সহজে'],
  kore: ['করে', 'করো'],
  koro: ['করো', 'কর'],
  korbo: ['করব', 'করবো'],
  dao: ['দাও'],
  bolo: ['বলো', 'বল'],
  bol: ['বল', 'বলো'],
  toron: ['ত্বরণ'],
  vor: ['ভর'],
  goti: ['গতি'],
  sutra: ['সূত্র', 'সূত্রটা'],
  sutro: ['সূত্র', 'সূত্রটি'],
  niuton: ['নিউটন', 'নিউটনের'],
  niutoner: ['নিউটনের'],
  ditiyo: ['দ্বিতীয়'],
  prothom: ['প্রথম'],
  tritiyo: ['তৃতীয়'],
  bujhiye: ['বুঝিয়ে'],
  bujhao: ['বোঝাও', 'বুঝাও'],
  bujhte: ['বুঝতে'],
  parchi: ['পারছি'],
  parchina: ['পারছি না'],
  na: ['না'],
  ha: ['হ্যাঁ'],
  hyan: ['হ্যাঁ'],
  bangla: ['বাংলা', 'বাংলায়'],
  banglay: ['বাংলায়'],
  ingreji: ['ইংরেজি'],
  podartho: ['পদার্থবিজ্ঞান'],
  rosayon: ['রসায়ন'],
  gonit: ['গণিত'],
  proshno: ['প্রশ্ন', 'প্রশ্নোত্তর'],
  uttor: ['উত্তর'],
  udaho: ['উদাহরণ'],
  udahoron: ['উদাহরণ'],
  note: ['নোট', 'নোটস'],
  adhyay: ['অধ্যায়'],
  shomoy: ['সময়'],
  kaj: ['কাজ'],
  ajke: ['আজকে', 'আজ'],
  kal: ['কাল', 'কালকে'],
  valobashi: ['ভালোবাসি'],
  valo: ['ভালো'],
  bhalo: ['ভালো'],
  dhonnobad: ['ধন্যবাদ'],
  shuvo: ['শুভ'],
  ekta: ['একটা', 'একটি'],
  ektu: ['একটু'],
  aro: ['আরো', 'আরও'],
  ei: ['এই'],
  oi: ['ওই'],
  ar: ['আর'],
  ebong: ['এবং'],
  ba: ['বা'],
  kintu: ['কিন্তু'],
  tobe: ['তবে'],
  jodi: ['যদি'],
  tahole: ['তাহলে'],
  karon: ['কারণ'],
  ache: ['আছে'],
  nei: ['নেই'],
  hobe: ['হবে'],
  hoy: ['হয়'],
  hole: ['হলে'],
  theke: ['থেকে'],
  jonno: ['জন্য'],
  niye: ['নিয়ে'],
  diye: ['দিয়ে'],
  shathe: ['সাথে'],
  sate: ['সাথে'],
  poriksha: ['পরীক্ষা'],
  porikkha: ['পরীক্ষা'],
  shikhbo: ['শিখব'],
  lekho: ['লেখো'],
  likho: ['লিখো'],
  poro: ['পড়ো'],
  porchi: ['পড়ছি'],
  chobi: ['ছবি'],
  hint: ['হিন্ট'],
  guide: ['গাইড'],
};

const VOWELS = {
  o: 'অ',
  a: 'আ',
  i: 'ই',
  I: 'ঈ',
  ee: 'ঈ',
  u: 'উ',
  U: 'ঊ',
  oo: 'ঊ',
  rri: 'ঋ',
  e: 'এ',
  OI: 'ঐ',
  oi: 'ঐ',
  O: 'ও',
  ou: 'ঔ',
  OU: 'ঔ',
};

const KAR = {
  o: '',
  a: 'া',
  i: 'ি',
  I: 'ী',
  ee: 'ী',
  u: 'ু',
  U: 'ূ',
  oo: 'ূ',
  rri: 'ৃ',
  e: 'ে',
  OI: 'ৈ',
  oi: 'ৈ',
  O: 'ো',
  ou: 'ৌ',
  OU: 'ৌ',
};

const CONSONANTS = [
  ['kSh', 'ক্ষ'],
  ['kkh', 'ক্ষ'],
  ['ngg', 'ঙ্গ'],
  ['ngk', 'ঙ্ক'],
  ['chh', 'ছ'],
  ['sh', 'শ'],
  ['Sh', 'ষ'],
  ['ch', 'চ'],
  ['kh', 'খ'],
  ['gh', 'ঘ'],
  ['Ng', 'ঙ'],
  ['ng', 'ং'],
  ['jh', 'ঝ'],
  ['NG', 'ঞ'],
  ['Th', 'ঠ'],
  ['Dh', 'ঢ'],
  ['th', 'থ'],
  ['dh', 'ধ'],
  ['ph', 'ফ'],
  ['bh', 'ভ'],
  ['Rh', 'ঢ়'],
  ['k', 'ক'],
  ['g', 'গ'],
  ['c', 'চ'],
  ['j', 'জ'],
  ['T', 'ট'],
  ['D', 'ড'],
  ['N', 'ণ'],
  ['t', 'ত'],
  ['d', 'দ'],
  ['n', 'ন'],
  ['p', 'প'],
  ['f', 'ফ'],
  ['b', 'ব'],
  ['v', 'ভ'],
  ['m', 'ম'],
  ['z', 'য'],
  ['r', 'র'],
  ['l', 'ল'],
  ['S', 'ষ'],
  ['s', 'স'],
  ['h', 'হ'],
  ['R', 'ড়'],
  ['y', 'য়'],
  ['Y', 'য়'],
  ['w', 'ও'],
  [':', 'ঃ'],
  ['^', 'ঁ'],
];

const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length);

export function phoneticToBangla(word) {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (COMMON_WORDS[lower]) return COMMON_WORDS[lower][0];

  let out = '';
  let i = 0;
  let lastWasConsonant = false;

  while (i < word.length) {
    // Check consonant clusters / single consonants first
    let matchedC = null;
    for (const [pat, ch] of CONSONANTS) {
      if (word.startsWith(pat, i)) {
        matchedC = [pat, ch];
        break;
      }
    }

    if (matchedC) {
      // Handle phala: 'r' after consonant -> ্র, 'y'/'Z' after consonant -> ্য
      if (lastWasConsonant && matchedC[0] === 'r' && out.length > 0 && !'ংঃঁ'.includes(out.slice(-1))) {
        out += '্র';
      } else if (lastWasConsonant && (matchedC[0] === 'y' || matchedC[0] === 'Z') && out.length > 0) {
        out += '্য';
      } else {
        out += matchedC[1];
      }
      i += matchedC[0].length;
      lastWasConsonant = !['ং', 'ঃ', 'ঁ'].includes(matchedC[1]);
      continue;
    }

    // Check vowels
    let matchedV = null;
    for (const vk of VOWEL_KEYS) {
      if (word.startsWith(vk, i)) {
        matchedV = vk;
        break;
      }
    }

    if (matchedV) {
      if (lastWasConsonant) {
        out += KAR[matchedV];
      } else {
        out += VOWELS[matchedV];
      }
      i += matchedV.length;
      lastWasConsonant = false;
      continue;
    }

    // Digits & punctuation pass through
    out += word[i];
    i += 1;
    lastWasConsonant = false;
  }

  return out;
}

export function getAvroSuggestions(prefix) {
  if (!prefix || !/[a-zA-Z]/.test(prefix)) return [];
  const lower = prefix.toLowerCase();
  const results = new Set();

  const direct = phoneticToBangla(prefix);
  if (direct) results.add(direct);

  if (COMMON_WORDS[lower]) {
    COMMON_WORDS[lower].forEach((w) => results.add(w));
  }

  for (const [k, vals] of Object.entries(COMMON_WORDS)) {
    if (k.startsWith(lower)) {
      vals.forEach((v) => results.add(v));
    }
    if (results.size >= 5) break;
  }

  return Array.from(results).slice(0, 5);
}

export const AI_STUDY_PROMPTS_BN = [
  'নিউটনের দ্বিতীয় সূত্রটা সহজ করে বুঝিয়ে দাও',
  'বল ও ত্বরণের সম্পর্ক কী? উদাহরণ দাও',
  'এই অধ্যায় থেকে ৩টা প্র্যাকটিস প্রশ্ন দাও',
  'আমার নোটের মূল পয়েন্টগুলো সংক্ষেপে বলো',
];
