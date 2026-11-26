/* ==========================================================================
   BhaiOS Avro Phonetic Engine
   Accurate Romanized Bangla -> Unicode Bangla (e.g., "ami banglay likhi" -> "আমি বাংলায় লিখি")
   ========================================================================== */

const COMMON_WORDS = {
  ami: ['আমি'],
  amar: ['আমার', 'আমাদের'],
  amader: ['আমাদের'],
  amake: ['আমাকে'],
  tumi: ['তুমি', 'তোমার'],
  tomar: ['তোমার', 'তোমাকে'],
  tomake: ['তোমাকে'],
  apni: ['আপনি', 'আপনার'],
  apnar: ['আপনার'],
  she: ['সে'],
  tara: ['তারা'],
  eta: ['এটা', 'এটি'],
  eti: ['এটি'],
  ota: ['ওটা', 'ওটি'],
  ki: ['কি', 'কী'],
  keno: ['কেন'],
  kivabe: ['কীভাবে', 'কিভাবে'],
  kibhabe: ['কীভাবে', 'কিভাবে'],
  kothay: ['কোথায়'],
  kokhon: ['কখন'],
  koto: ['কত'],
  ke: ['কে'],
  kar: ['কার'],
  kake: ['কাকে'],
  kon: ['কোন', 'কোন্'],
  shohoj: ['সহজ', 'সহজে'],
  shohoje: ['সহজে'],
  sohoj: ['সহজ', 'সহজে'],
  sohoje: ['সহজে'],
  kore: ['করে', 'করো'],
  koro: ['করো', 'কর'],
  korbo: ['করব', 'করবো'],
  korchi: ['করছি'],
  korche: ['করছে'],
  korte: ['করতে'],
  kora: ['করা'],
  dao: ['দাও'],
  din: ['দিন'],
  bolo: ['বলো', 'বল'],
  bol: ['বল', 'বলো'],
  bolchi: ['বলছি'],
  bolte: ['বলতে'],
  toron: ['ত্বরণ'],
  vor: ['ভর'],
  bhor: ['ভর'],
  goti: ['গতি'],
  beg: ['বেগ'],
  bolbidya: ['বলবিদ্যা'],
  sutra: ['সূত্র', 'সূত্রটা'],
  sutro: ['সূত্র', 'সূত্রটি'],
  shutro: ['সূত্র', 'সূত্রটি'],
  niuton: ['নিউটন', 'নিউটনের'],
  niutoner: ['নিউটনের'],
  ditiyo: ['দ্বিতীয়'],
  dwitiyo: ['দ্বিতীয়'],
  prothom: ['প্রথম'],
  tritiyo: ['তৃতীয়'],
  bujhiye: ['বুঝিয়ে'],
  bujhao: ['বোঝাও', 'বুঝাও'],
  bojhao: ['বোঝাও'],
  bujhte: ['বুঝতে'],
  bujhi: ['বুঝি'],
  parchi: ['পারছি'],
  parchina: ['পারছি না'],
  pari: ['পারি'],
  paro: ['পারো'],
  pare: ['পারে'],
  na: ['না'],
  nai: ['নাই'],
  ha: ['হ্যাঁ'],
  hyan: ['হ্যাঁ'],
  bangla: ['বাংলা', 'বাংলায়'],
  banglay: ['বাংলায়'],
  bangladesh: ['বাংলাদেশ'],
  ingreji: ['ইংরেজি'],
  podartho: ['পদার্থবিজ্ঞান', 'পদার্থ'],
  podarthobiggan: ['পদার্থবিজ্ঞান'],
  rosayon: ['রসায়ন'],
  gonit: ['গণিত'],
  jibbiggan: ['জীববিজ্ঞান'],
  biggan: ['বিজ্ঞান'],
  itihas: ['ইতিহাস'],
  proshno: ['প্রশ্ন', 'প্রশ্নোত্তর'],
  uttor: ['উত্তর'],
  udaho: ['উদাহরণ'],
  udahoron: ['উদাহরণ'],
  note: ['নোট', 'নোটস'],
  adhyay: ['অধ্যায়'],
  shomoy: ['সময়'],
  somoy: ['সময়'],
  kaj: ['কাজ'],
  ajke: ['আজকে', 'আজ'],
  aj: ['আজ'],
  kal: ['কাল', 'কালকে'],
  valobashi: ['ভালোবাসি'],
  bhalobashi: ['ভালোবাসি'],
  valo: ['ভালো', 'ভাল'],
  bhalo: ['ভালো', 'ভাল'],
  dhonnobad: ['ধন্যবাদ'],
  shuvo: ['শুভ'],
  ekta: ['একটা', 'একটি'],
  ekti: ['একটি'],
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
  achhe: ['আছে'],
  nei: ['নেই'],
  hobe: ['হবে'],
  hoy: ['হয়'],
  hole: ['হলে'],
  hocche: ['হচ্ছে'],
  theke: ['থেকে'],
  jonno: ['জন্য'],
  jonne: ['জন্যে'],
  niye: ['নিয়ে'],
  diye: ['দিয়ে'],
  shathe: ['সাথে'],
  sathe: ['সাথে'],
  sate: ['সাথে'],
  poriksha: ['পরীক্ষা'],
  porikkha: ['পরীক্ষা'],
  shikkha: ['শিক্ষা'],
  shikhbo: ['শিখব', 'শিখবো'],
  lekho: ['লেখো'],
  likho: ['লিখো'],
  likhi: ['লিখি'],
  poro: ['পড়ো'],
  porchi: ['পড়ছি'],
  pora: ['পড়া'],
  chobi: ['ছবি'],
  hint: ['হিন্ট'],
  guide: ['গাইড'],
  manush: ['মানুষ'],
  desh: ['দেশ'],
  bhasha: ['ভাষা'],
  bhasa: ['ভাষা'],
  kotha: ['কথা'],
  kothin: ['কঠিন'],
  sundor: ['সুন্দর'],
  shundor: ['সুন্দর'],
  bondhu: ['বন্ধু'],
  chinta: ['চিন্তা'],
  gyan: ['জ্ঞান'],
  bissho: ['বিশ্ব'],
  bishwo: ['বিশ্ব'],
  somossa: ['সমস্যা'],
  shomossa: ['সমস্যা'],
  somadhan: ['সমাধান'],
  shomadhan: ['সমাধান'],
  tumi_kemon_acho: ['তুমি কেমন আছো'],
  kemon: ['কেমন'],
  acho: ['আছো', 'আছ'],
  achho: ['আছো'],
  mon: ['মন'],
  khabar: ['খাবার'],
  pani: ['পানি'],
  jol: ['জল'],
  bari: ['বাড়ি'],
  ghor: ['ঘর'],
  boi: ['বই'],
  khata: ['খাতা'],
  kolom: ['কলম'],
  school: ['স্কুল'],
  skul: ['স্কুল'],
  college: ['কলেজ'],
  university: ['বিশ্ববিদ্যালয়'],
  bishwabidyaloy: ['বিশ্ববিদ্যালয়'],
  shokal: ['সকাল'],
  rat: ['রাত'],
  bikal: ['বিকাল'],
  sondhya: ['সন্ধ্যা'],
  dhaka: ['ঢাকা'],
  chittagong: ['চট্টগ্রাম'],
  rajshahi: ['রাজশাহী'],
  sylhet: ['সিলেট'],
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

// Ordered longest-first so conjuncts and digraphs match before single letters
const CONSONANTS = [
  ['shch', 'শ্চ'],
  ['chchh', 'চ্ছ'],
  ['chch', 'চ্চ'],
  ['kSh', 'ক্ষ'],
  ['kkh', 'ক্ষ'],
  ['ShTh', 'ষ্ঠ'],
  ['ShT', 'ষ্ট'],
  ['ShN', 'ষ্ণ'],
  ['Shp', 'ষ্প'],
  ['Shk', 'ষ্ক'],
  ['ngsh', 'ংশ'],
  ['ngk', 'ঙ্ক'],
  ['ngg', 'ঙ্গ'],
  ['mbh', 'ম্ভ'],
  ['ndh', 'ন্ধ'],
  ['sth', 'স্থ'],
  ['shr', 'শ্র'],
  ['shw', 'শ্ব'],
  ['shm', 'শ্ম'],
  ['bhr', 'ভ্র'],
  ['ddh', 'দ্ধ'],
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
  ['nt', 'ন্ত'],
  ['nd', 'ন্দ'],
  ['st', 'স্ত'],
  ['sp', 'স্প'],
  ['sk', 'স্ক'],
  ['sm', 'স্ম'],
  ['sw', 'স্ব'],
  ['kt', 'ক্ত'],
  ['kr', 'ক্র'],
  ['tr', 'ত্র'],
  ['dr', 'দ্র'],
  ['pr', 'প্র'],
  ['br', 'ব্র'],
  ['gr', 'গ্র'],
  ['sr', 'শ্র'],
  ['gg', 'জ্ঞ'],
  ['gy', 'জ্ঞ'],
  ['jj', 'জ্জ'],
  ['tt', 'ত্ত'],
  ['dd', 'দ্দ'],
  ['nn', 'ন্ন'],
  ['mm', 'ম্ম'],
  ['ll', 'ল্ল'],
  ['kk', 'ক্ক'],
  ['pp', 'প্প'],
  ['bb', 'ব্ব'],
  ['mp', 'ম্প'],
  ['mb', 'ম্ব'],
  ['nj', 'ঞ্জ'],
  ['nch', 'ঞ্চ'],
  ['hm', 'হ্ম'],
  ['hn', 'হ্ন'],
  ['hl', 'হ্ল'],
  ['hr', 'হ্র'],
  ['k', 'ক'],
  ['g', 'গ'],
  ['c', 'চ'],
  ['j', 'জ'],
  ['z', 'জ'],
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
  ['r', 'র'],
  ['l', 'ল'],
  ['S', 'ষ'],
  ['s', 'স'],
  ['h', 'হ'],
  ['R', 'ড়'],
  ['y', 'য়'],
  ['Y', 'য়'],
  ['Z', '্য'],
  ['w', 'ও'],
  [':', 'ঃ'],
  ['^', 'ঁ'],
];

const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length);

function normalizeWordCase(word) {
  // If user capitalized only the first letter (e.g. "Ami", "Bangla"), lowercase the first char
  // unless it's a deliberate Avro retroflex/long vowel like "Taka", "Dhaka", "Nadi", "Onek"
  if (/^[A-Z][a-z]+$/.test(word) && !/^[TDNSROIU]/.test(word)) {
    return word[0].toLowerCase() + word.slice(1);
  }
  return word;
}

export function phoneticToBangla(rawWord) {
  if (!rawWord) return '';
  const lower = rawWord.toLowerCase();
  if (COMMON_WORDS[lower]) return COMMON_WORDS[lower][0];

  const word = normalizeWordCase(rawWord);
  let out = '';
  let i = 0;
  let lastWasConsonant = false;

  while (i < word.length) {
    let matchedC = null;
    for (const [pat, ch] of CONSONANTS) {
      if (word.startsWith(pat, i)) {
        matchedC = [pat, ch];
        break;
      }
    }

    if (matchedC) {
      const [pat, ch] = matchedC;
      // Handle phala & word-initial 'y'
      if (lastWasConsonant && pat === 'r' && out.length > 0 && !'ংঃঁ'.includes(out.slice(-1))) {
        out += '্র';
      } else if (lastWasConsonant && (pat === 'y' || pat === 'Y' || pat === 'Z') && out.length > 0) {
        out += '্য';
      } else if (lastWasConsonant && pat === 'w' && out.length > 0) {
        out += '্ব';
      } else if (!lastWasConsonant && i === 0 && (pat === 'y' || pat === 'Y')) {
        out += 'য';
      } else {
        out += ch;
      }
      i += pat.length;
      lastWasConsonant = !['ং', 'ঃ', 'ঁ'].includes(ch);
      continue;
    }

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

    out += word[i];
    i += 1;
    lastWasConsonant = false;
  }

  return out;
}

export function getAvroSuggestions(word) {
  if (!word) return [];
  const lower = word.toLowerCase();
  const results = [];

  if (COMMON_WORDS[lower]) {
    results.push(...COMMON_WORDS[lower]);
  }

  const primary = phoneticToBangla(word);
  if (primary && !results.includes(primary)) {
    results.push(primary);
  }

  // If word ends in 'o' after a consonant, also offer the 'ো' form (e.g. koro -> কর / করো)
  if (lower.length >= 3 && lower.endsWith('o') && !lower.endsWith('oo')) {
    const withOkar = phoneticToBangla(word.slice(0, -1) + 'O');
    if (withOkar && !results.includes(withOkar)) {
      results.push(withOkar);
    }
  }

  // Prefix matches from common words
  for (const [key, vals] of Object.entries(COMMON_WORDS)) {
    if (key.startsWith(lower) && key !== lower) {
      for (const v of vals) {
        if (!results.includes(v)) results.push(v);
      }
    }
    if (results.length >= 4) break;
  }

  return results.slice(0, 4);
}
