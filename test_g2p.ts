import fs from 'fs';

const modelConfig = JSON.parse(fs.readFileSync('d:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx.json', 'utf8'));

const V2IPA: Record<string, string> = {
  'a':'a','à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
  'ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a',
  'â':'ə','ầ':'ə','ấ':'ə','ẩ':'ə','ẫ':'ə','ậ':'ə',
  'e':'ɛ','è':'ɛ','é':'ɛ','ẻ':'ɛ','ẽ':'ɛ','ẹ':'ɛ',
  'ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e',
  'i':'i','ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
  'y':'i','ỳ':'i','ý':'i','ỷ':'i','ỹ':'i','ỵ':'i',
  'o':'ɔ','ò':'ɔ','ó':'ɔ','ỏ':'ɔ','õ':'ɔ','ọ':'ɔ',
  'ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o','ộ':'o',
  'ơ':'ə','ờ':'ə','ớ':'ə','ở':'ə','ỡ':'ə','ợ':'ə',
  'u':'u','ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
  'ư':'ɨ','ừ':'ɨ','ứ':'ɨ','ử':'ɨ','ữ':'ɨ','ự':'ɨ',
};

const TONE_DIGIT: Record<string, string> = {
  'a':'1','à':'2','á':'5','ả':'3','ã':'4','ạ':'6',
  'ă':'1','ằ':'2','ắ':'5','ẳ':'3','ẵ':'4','ặ':'6',
  'â':'1','ầ':'2','ấ':'5','ẩ':'3','ẫ':'4','ậ':'6',
  'e':'1','è':'2','é':'5','ẻ':'3','ẽ':'4','ẹ':'6',
  'ê':'1','ề':'2','ế':'5','ể':'3','ễ':'4','ệ':'6',
  'i':'1','ì':'2','í':'5','ỉ':'3','ĩ':'4','ị':'6',
  'y':'1','ỳ':'2','ý':'5','ỷ':'3','ỹ':'4','ỵ':'6',
  'o':'1','ò':'2','ó':'5','ỏ':'3','õ':'4','ọ':'6',
  'ô':'1','ồ':'2','ố':'5','ổ':'3','ỗ':'4','ộ':'6',
  'ơ':'1','ờ':'2','ớ':'5','ở':'3','ỡ':'4','ợ':'6',
  'u':'1','ù':'2','ú':'5','ủ':'3','ũ':'4','ụ':'6',
  'ư':'1','ừ':'2','ứ':'5','ử':'3','ữ':'4','ự':'6',
};

const INIT_CONS: [string, string][] = [
  ['ngh','ŋ'],['ng','ŋ'],['nh','ɲ'],['ch','c'],
  ['ph','f'],['kh','x'],['gh','ɣ'],['gi','z'],['qu','kw'],
  ['tr','ʈ'],['th','tʰ'],
  ['đ','ɗ'],['b','ɓ'],['c','k'],['d','z'],['g','ɣ'],
  ['h','h'],['k','k'],['l','l'],['m','m'],['n','n'],
  ['p','p'],['r','z'],['s','s'],['t','t'],['v','v'],['x','s'],
];

const FINAL_CONS: [string, string][] = [
  ['ngh','ŋ'],['ng','ŋ'],['nh','ɲ'],['ch','c'],
  ['m','m'],['n','n'],['c','k'],['p','p'],['t','t'],
];

function isVowel(c: string): boolean {
  return V2IPA[c] !== undefined;
}

function textToPhonemeIds(text: string, config: any): number[] {
  const pm = config.phoneme_id_map;
  const ids: number[] = [];

  function addPhoneme(ipaStr: string) {
    for (const ch of ipaStr) {
      if (pm[ch]) ids.push(pm[ch][0]);
    }
  }

  if (pm['^']) ids.push(pm['^'][0]);
  const words = text.toLowerCase().trim().split(/\s+/);
  
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    let cleanWord = word.replace(/[^a-zàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ]/g, '');
    if (!cleanWord) continue;
    
    // Quick phonetic patches before processing
    if (cleanWord.startsWith('gi') && cleanWord.length > 2 && isVowel(cleanWord[2])) {
        // "gia" -> "za", so 'i' is removed because it's just part of initial 'z'
        cleanWord = 'z' + cleanWord.slice(2);
    } else if (cleanWord === 'gì' || cleanWord === 'gí' || cleanWord === 'gỉ' || cleanWord === 'gĩ' || cleanWord === 'gị' || cleanWord === 'gi') {
        cleanWord = 'z' + cleanWord.slice(1); // 'zi'
    } else if (cleanWord.startsWith('gi')) {
        cleanWord = 'z' + cleanWord.slice(1);
    }
    
    let i = 0;
    const w = cleanWord;
    
    let currentSyllableTone = '1';
    let syllableVowelFound = false;

    while (i < w.length) {
      let initFound = false;
      for (const [graph, ipa] of INIT_CONS) {
        if (i + graph.length <= w.length && w.slice(i, i + graph.length) === graph && (!isVowel(graph[0]) || graph === 'qu')) {
          addPhoneme(ipa);
          i += graph.length;
          initFound = true;
          break;
        }
      }
      
      const vowelChars: string[] = [];
      while (i < w.length && isVowel(w[i])) {
        vowelChars.push(w[i]);
        i++;
      }
      
      if (vowelChars.length > 0) {
        syllableVowelFound = true;
        const tonedChar = vowelChars.find(c => TONE_DIGIT[c] && TONE_DIGIT[c] !== '1') ?? vowelChars[0];
        currentSyllableTone = TONE_DIGIT[tonedChar] ?? '1';
        
        for (const vc of vowelChars) {
          const ipaV = V2IPA[vc];
          if (ipaV && pm[ipaV]) ids.push(pm[ipaV][0]);
        }
      }
      
      let finalFound = false;
      for (const [graph, ipa] of FINAL_CONS) {
        if (i + graph.length <= w.length && w.slice(i, i + graph.length) === graph && !isVowel(graph[0])) {
          addPhoneme(ipa);
          i += graph.length;
          finalFound = true;
          break;
        }
      }
      
      if (!initFound && vowelChars.length === 0 && !finalFound) {
        if (w[i] === 'z') { // from our 'gi' replacement
            addPhoneme('z');
        }
        i++;
      }
    }
    
    // Add tone AT THE END of the syllable
    if (syllableVowelFound && pm[currentSyllableTone]) {
        ids.push(pm[currentSyllableTone][0]);
    }

    if (wi < words.length - 1 && pm[' ']) ids.push(pm[' '][0]);
  }
  if (pm['$']) ids.push(pm['$'][0]);
  return ids;
}

const sentences = ["xin chào", "không có", "tiếng việt", "người", "quá", "gì", "chuyện"];
const mapReversed = Object.fromEntries(Object.entries(modelConfig.phoneme_id_map).map(([k, v]: [string, any]) => [v[0], k]));

for (const s of sentences) {
    const ids = textToPhonemeIds(s, modelConfig);
    const phonemes = ids.map(id => mapReversed[id]).join(' ');
    console.log(`${s} -> ${phonemes}`);
}
