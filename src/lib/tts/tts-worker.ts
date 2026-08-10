import * as ort from 'onnxruntime-web';
import { TTSModelConfig, WorkerInMessage, WorkerOutMessage } from '@/types';

let session: ort.InferenceSession | null = null;
let modelConfig: TTSModelConfig | null = null;

// Set local WASM path matching installed package onnxruntime-web@1.27.0
ort.env.wasm.wasmPaths = '/wasm/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

// ============================================================
// VIETNAMESE GRAPHEME-TO-PHONEME (G2P) FOR PIPER TTS
// Piper model uses eSpeak IPA phoneme IDs (single Unicode chars)
// Tones encoded as digit characters: 1=ngang, 2=huyền, 3=hỏi, 4=ngã, 5=sắc, 6=nặng
// Phoneme sequence: ^ [consonant_ipa*] [vowel_ipa+] [tone_digit] [final_cons_ipa*] [space] ... $
// ============================================================

// Toned vowel -> base IPA phoneme (single char, all in phoneme_id_map)
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

// Toned vowel -> tone digit (Vietnamese 6 tones)
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

// Initial consonant clusters -> IPA (greedy longest-match)
const INIT_CONS: [string, string][] = [
  ['ngh','ŋ'],['ng','ŋ'],['nh','ɲ'],['ch','c'],
  ['ph','f'],['kh','x'],['gh','ɣ'],['gi','z'],['qu','kw'],
  ['tr','ʈ'],['th','tʰ'],
  ['đ','ɗ'],['b','ɓ'],['c','k'],['d','z'],['g','ɣ'],
  ['h','h'],['k','k'],['l','l'],['m','m'],['n','n'],
  ['p','p'],['r','z'],['s','s'],['t','t'],['v','v'],['x','s'],
];

// Final consonant clusters -> IPA (greedy longest-match)
const FINAL_CONS: [string, string][] = [
  ['ngh','ŋ'],['ng','ŋ'],['nh','ɲ'],['ch','c'],
  ['m','m'],['n','n'],['c','k'],['p','p'],['t','t'],
];

function isVowel(c: string): boolean {
  return V2IPA[c] !== undefined;
}

/**
 * Convert Vietnamese text to a flat array of phoneme IDs for Piper TTS.
 * Each word is processed syllable by syllable.
 * Structure per syllable: [init_ipa*] [vowel_ipa+] [final_ipa*] [tone_digit]
 */
function textToPhonemeIds(text: string, config: TTSModelConfig): number[] {
  const pm = config.phoneme_id_map;
  const ids: number[] = [];

  function addPhoneme(ipaStr: string) {
    for (const ch of ipaStr) {
      if (pm[ch]) ids.push(pm[ch][0]);
    }
  }

  // Start boundary
  if (pm['^']) ids.push(pm['^'][0]);

  const words = text.toLowerCase().trim().split(/\s+/);

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    // Strip non-Vietnamese characters
    let cleanWord = word.replace(/[^a-zàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ]/g, '');
    if (!cleanWord) continue;

    // Quick phonetic patches for specific tricky spellings before processing
    if (cleanWord.startsWith('gi') && cleanWord.length > 2 && isVowel(cleanWord[2])) {
        // "gia" -> "za", 'i' is silent
        cleanWord = 'z' + cleanWord.slice(2);
    } else if (['gì', 'gí', 'gỉ', 'gĩ', 'gị', 'gi'].includes(cleanWord)) {
        cleanWord = 'z' + cleanWord.slice(1);
    } else if (cleanWord.startsWith('gi')) {
        cleanWord = 'z' + cleanWord.slice(1);
    }

    let i = 0;
    const w = cleanWord;

    let currentSyllableTone = '1';
    let syllableVowelFound = false;

    // Process word character by character (syllable components)
    while (i < w.length) {
      // 1. Initial consonant (greedy longest match, must not start with vowel except for 'qu' which expands to kw)
      let initFound = false;
      for (const [graph, ipa] of INIT_CONS) {
        if (i + graph.length <= w.length &&
          w.slice(i, i + graph.length) === graph &&
          (!isVowel(graph[0]) || graph === 'qu')) {
          addPhoneme(ipa);
          i += graph.length;
          initFound = true;
          break;
        }
      }

      // 2. Vowel nucleus: collect all consecutive vowel characters
      const vowelChars: string[] = [];
      while (i < w.length && isVowel(w[i])) {
        vowelChars.push(w[i]);
        i++;
      }

      if (vowelChars.length > 0) {
        syllableVowelFound = true;
        // Determine tone from the marked character
        const tonedChar = vowelChars.find(c => TONE_DIGIT[c] && TONE_DIGIT[c] !== '1') ?? vowelChars[0];
        currentSyllableTone = TONE_DIGIT[tonedChar] ?? '1';

        // Output each vowel's IPA phoneme
        for (const vc of vowelChars) {
          const ipaV = V2IPA[vc];
          if (ipaV && pm[ipaV]) ids.push(pm[ipaV][0]);
        }
      }

      // 3. Final consonant (greedy longest match)
      let finalFound = false;
      for (const [graph, ipa] of FINAL_CONS) {
        if (i + graph.length <= w.length &&
          w.slice(i, i + graph.length) === graph &&
          !isVowel(graph[0])) {
          addPhoneme(ipa);
          i += graph.length;
          finalFound = true;
          break;
        }
      }

      // Safety: skip any unrecognized character to avoid infinite loop
      if (!initFound && vowelChars.length === 0 && !finalFound) {
        if (w[i] === 'z') {
            addPhoneme('z');
        }
        i++;
      }
    }
    
    // 4. Output tone digit AFTER all phonemes in the syllable
    if (syllableVowelFound && pm[currentSyllableTone]) {
        ids.push(pm[currentSyllableTone][0]);
    }

    // Word boundary space (not after last word)
    if (wi < words.length - 1 && pm[' ']) {
      ids.push(pm[' '][0]);
    }
  }

  // End boundary
  if (pm['$']) ids.push(pm['$'][0]);

  return ids;
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      // Fetch model config JSON
      const configRes = await fetch(msg.configUrl);
      if (!configRes.ok) {
        throw new Error(`Không thể tải cấu hình giọng đọc (${configRes.status})`);
      }
      modelConfig = (await configRes.json()) as TTSModelConfig;

      // Fetch ONNX model binary directly as ArrayBuffer
      const modelRes = await fetch(msg.modelUrl);
      if (!modelRes.ok) {
        throw new Error(`Không thể tải mô hình giọng đọc (${modelRes.status})`);
      }

      const buffer = await modelRes.arrayBuffer();
      postMessage({ type: 'progress', loaded: buffer.byteLength, total: buffer.byteLength } as WorkerOutMessage);

      session = await ort.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
      });

      postMessage({ type: 'ready' } as WorkerOutMessage);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi tải mô hình AI';
      postMessage({ type: 'error', id: -1, message: errorMessage } as WorkerOutMessage);
    }
  } else if (msg.type === 'synthesize') {
    if (!session || !modelConfig) {
      postMessage({
        type: 'error',
        id: msg.id,
        message: 'Mô hình AI chưa được khởi tạo',
      } as WorkerOutMessage);
      return;
    }

    try {
      const phonemeIds = textToPhonemeIds(msg.text, modelConfig);
      if (phonemeIds.length <= 2) {
        // Only boundary tokens, skip empty sentence
        postMessage({
          type: 'audio',
          id: msg.id,
          buffer: new Float32Array(0),
          sampleRate: modelConfig.audio.sample_rate,
        } as WorkerOutMessage);
        return;
      }

      // Prepare tensors for ONNX inference
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [
        1,
        phonemeIds.length,
      ]);
      const inputLengthsTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
      const scalesTensor = new ort.Tensor(
        'float32',
        Float32Array.from([
          modelConfig.inference.noise_scale,
          modelConfig.inference.length_scale,
          modelConfig.inference.noise_w,
        ]),
        [3]
      );

      const results = await session.run({
        input: inputTensor,
        input_lengths: inputLengthsTensor,
        scales: scalesTensor,
      });

      // Extract output audio Float32Array
      const outputTensor = results.output ?? Object.values(results)[0];
      const audioBuffer = outputTensor.data as Float32Array;

      (postMessage as (message: unknown, transfer?: Transferable[]) => void)(
        {
          type: 'audio',
          id: msg.id,
          buffer: audioBuffer,
          sampleRate: modelConfig.audio.sample_rate,
        } as WorkerOutMessage,
        [audioBuffer.buffer]
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi tổng hợp giọng nói';
      postMessage({ type: 'error', id: msg.id, message: errorMessage } as WorkerOutMessage);
    }
  }
};
