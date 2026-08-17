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
// Tones: 1=ngang/bằng, 2=huyền, 3=hỏi, 4=ngã, 5=sắc, 6=nặng
// Phoneme sequence per syllable:
//   ^ [init_cons_ipa*] [glide_w?] [vowel_ipa+] [final_cons_ipa*] [tone_digit] [space] ... $
// ============================================================

// --------------- Vowel → base IPA phoneme mapping ---------------
// ă/a/â → 'a' (short/normal a)
// â     → 'ə' (schwa) — mid central
// ê     → 'e' (close-mid front)
// e     → 'ɛ' (open-mid front)
// ô     → 'o' (close-mid back)
// o     → 'ɔ' (open-mid back)
// ơ     → 'ɤ' (close-mid back unrounded) ← eSpeak vi uses ɤ
// ư     → 'ɯ' (close back unrounded)     ← eSpeak vi uses ɯ
// i/y   → 'i'
// u     → 'u'
const V2IPA: Record<string, string> = {
  'a':'a', 'à':'a', 'á':'a', 'ả':'a', 'ã':'a', 'ạ':'a',
  'ă':'a', 'ằ':'a', 'ắ':'a', 'ẳ':'a', 'ẵ':'a', 'ặ':'a',
  'â':'ə', 'ầ':'ə', 'ấ':'ə', 'ẩ':'ə', 'ẫ':'ə', 'ậ':'ə',
  'e':'ɛ', 'è':'ɛ', 'é':'ɛ', 'ẻ':'ɛ', 'ẽ':'ɛ', 'ẹ':'ɛ',
  'ê':'e', 'ề':'e', 'ế':'e', 'ể':'e', 'ễ':'e', 'ệ':'e',
  'i':'i', 'ì':'i', 'í':'i', 'ỉ':'i', 'ĩ':'i', 'ị':'i',
  'y':'i', 'ỳ':'i', 'ý':'i', 'ỷ':'i', 'ỹ':'i', 'ỵ':'i',
  'o':'ɔ', 'ò':'ɔ', 'ó':'ɔ', 'ỏ':'ɔ', 'õ':'ɔ', 'ọ':'ɔ',
  'ô':'o', 'ồ':'o', 'ố':'o', 'ổ':'o', 'ỗ':'o', 'ộ':'o',
  'ơ':'ɤ', 'ờ':'ɤ', 'ớ':'ɤ', 'ở':'ɤ', 'ỡ':'ɤ', 'ợ':'ɤ',
  'u':'u', 'ù':'u', 'ú':'u', 'ủ':'u', 'ũ':'u', 'ụ':'u',
  'ư':'ɯ', 'ừ':'ɯ', 'ứ':'ɯ', 'ử':'ɯ', 'ữ':'ɯ', 'ự':'ɯ',
};

// --------------- Tone digit mapping ---------------
const TONE_DIGIT: Record<string, string> = {
  'a':'1', 'à':'2', 'á':'5', 'ả':'3', 'ã':'4', 'ạ':'6',
  'ă':'1', 'ằ':'2', 'ắ':'5', 'ẳ':'3', 'ẵ':'4', 'ặ':'6',
  'â':'1', 'ầ':'2', 'ấ':'5', 'ẩ':'3', 'ẫ':'4', 'ậ':'6',
  'e':'1', 'è':'2', 'é':'5', 'ẻ':'3', 'ẽ':'4', 'ẹ':'6',
  'ê':'1', 'ề':'2', 'ế':'5', 'ể':'3', 'ễ':'4', 'ệ':'6',
  'i':'1', 'ì':'2', 'í':'5', 'ỉ':'3', 'ĩ':'4', 'ị':'6',
  'y':'1', 'ỳ':'2', 'ý':'5', 'ỷ':'3', 'ỹ':'4', 'ỵ':'6',
  'o':'1', 'ò':'2', 'ó':'5', 'ỏ':'3', 'õ':'4', 'ọ':'6',
  'ô':'1', 'ồ':'2', 'ố':'5', 'ổ':'3', 'ỗ':'4', 'ộ':'6',
  'ơ':'1', 'ờ':'2', 'ớ':'5', 'ở':'3', 'ỡ':'4', 'ợ':'6',
  'u':'1', 'ù':'2', 'ú':'5', 'ủ':'3', 'ũ':'4', 'ụ':'6',
  'ư':'1', 'ừ':'2', 'ứ':'5', 'ử':'3', 'ữ':'4', 'ự':'6',
};

// --------------- Initial consonant clusters → IPA ---------------
// Order matters: longer clusters must come first (greedy match)
const INIT_CONS: [string, string][] = [
  ['ngh', 'ŋ'],  // nghề
  ['ng',  'ŋ'],  // ngày
  ['nh',  'ɲ'],  // nhà
  ['ch',  'c'],  // cha
  ['ph',  'f'],  // phở
  ['kh',  'x'],  // khô
  ['gh',  'ɣ'],  // ghế
  ['th',  'tʰ'], // thì
  ['tr',  'ʈ'],  // trời — retroflex in Southern VN; eSpeak uses ʈ
  ['gi',  'z'],  // giờ (special: 'i' is part of consonant cluster → z)
  ['qu',  'kw'], // quả (special: 'u' becomes labio-velar glide)
  ['đ',   'ɗ'],  // đất (implosive)
  ['b',   'ɓ'],  // bàn (implosive in VI)
  ['c',   'k'],  // cá
  ['d',   'z'],  // dân (South: j, eSpeak vi: z)
  ['g',   'ɣ'],  // gà
  ['h',   'h'],  // hoa
  ['k',   'k'],  // khi
  ['l',   'l'],  // la
  ['m',   'm'],  // mà
  ['n',   'n'],  // na
  ['p',   'p'],  // pa (loanwords)
  ['r',   'z'],  // rau (South: r, eSpeak vi: z)
  ['s',   's'],  // sa
  ['t',   't'],  // ta
  ['v',   'v'],  // và
  ['x',   's'],  // xa (eSpeak vi maps x→s)
  ['z',   'z'],  // synthetic 'z' from gi→z transform
];

// --------------- Final consonant clusters → IPA ---------------
const FINAL_CONS: [string, string][] = [
  ['ngh', 'ŋ'],  // rare
  ['ng',  'ŋ'],  // không, rồng
  ['nh',  'ɲ'],  // anh, sinh
  ['ch',  'c'],  // ách, tích
  ['m',   'm'],  // tam
  ['n',   'n'],  // tan
  ['c',   'k'],  // tác
  ['p',   'p'],  // tập
  ['t',   't'],  // tất
  ['i',   'j'],  // mai, ngài (trailing glide)
  ['y',   'j'],  // tây, đây
  ['u',   'w'],  // sau, cau (trailing glide)
  ['o',   'w'],  // cao, bao (trailing glide — after non-o vowel)
];

// Vietnamese characters set for stripping
const VIET_CHARS = 'a-zàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ';
const VIET_REGEX = new RegExp(`[^${VIET_CHARS}]`, 'g');

function isVowel(c: string): boolean {
  return V2IPA[c] !== undefined;
}

// Bare base vowel letter (without tone marks) for structural checks
function baseOf(c: string): string {
  if ('aàáảãạăằắẳẵặ'.includes(c)) return 'a';
  if ('âầấẩẫậ'.includes(c)) return 'â';
  if ('eèéẻẽẹ'.includes(c)) return 'e';
  if ('êềếểễệ'.includes(c)) return 'ê';
  if ('iìíỉĩị'.includes(c)) return 'i';
  if ('yỳýỷỹỵ'.includes(c)) return 'y';
  if ('oòóỏõọ'.includes(c)) return 'o';
  if ('ôồốổỗộ'.includes(c)) return 'ô';
  if ('ơờớởỡợ'.includes(c)) return 'ơ';
  if ('uùúủũụ'.includes(c)) return 'u';
  if ('ưừứửữự'.includes(c)) return 'ư';
  return c;
}

/**
 * Convert Vietnamese text to a flat array of phoneme IDs for Piper TTS.
 *
 * Algorithm per syllable:
 *   1. Initial consonant (greedy longest match from INIT_CONS)
 *   2. Medial glide 'w' from:
 *      - 'qu' cluster already consumed → u was emitted as part of 'kw'
 *      - 'u/o' before another vowel in diphthong position (not 'qu')
 *   3. Vowel nucleus (all consecutive toned vowel chars, strip trailing glide-o/u)
 *   4. Final consonant (greedy longest match from FINAL_CONS)
 *   5. Trailing glide (i/y/u/o acting as coda glide after vowel nucleus)
 *   6. Tone digit (from the marked vowel in nucleus)
 */
function textToPhonemeIds(text: string, config: TTSModelConfig): number[] {
  const pm = config.phoneme_id_map;
  const rawIds: number[] = [];

  function pushIpa(ipaStr: string) {
    for (const ch of ipaStr) {
      const idArr = pm[ch];
      if (idArr) rawIds.push(idArr[0]);
    }
  }

  // Start boundary
  if (pm['^']) rawIds.push(pm['^'][0]);

  // Vietnamese syllable-by-syllable processing
  // In Vietnamese each space-separated token is a monosyllable (one syllable word)
  const tokens = text.toLowerCase().trim().split(/\s+/);

  for (let wi = 0; wi < tokens.length; wi++) {
    const token = tokens[wi];

    // Strip non-Vietnamese characters
    let w = token.replace(VIET_REGEX, '');
    if (!w) continue;

    // ── Special pre-processing for tricky letter clusters ──

    // ── 'gi' initial cluster: In Vietnamese, 'gi' = /z/ initial consonant ──
    // Cases:
    //  (A) 'g' + TONED-i only (gì, gí, gỉ, gĩ, gị): rare standalone, treated as z + i-vowel
    //  (B) 'gi' + non-i vowel (gia, giă, giâ, gio, giô, giơ, giê, giu, giư): z + vowel (i silent)
    //  (C) 'gi' + i-variant or 'gi' alone (gi, giên, giêng, giểng, ...): z + i + rest
    const TONED_I = new Set(['ì','í','ỉ','ĩ','ị']); // toned i (not plain 'i')
    if (w[0] === 'g' && TONED_I.has(w[1])) {
      // 'gì', 'gí', etc. → z + toned-i (zi-toned)
      w = 'z' + w.slice(1);
    } else if (w.startsWith('gi')) {
      const afterGi = w.slice(2);
      if (afterGi.length > 0 && isVowel(afterGi[0]) && !('iìíỉĩị'.includes(afterGi[0]))) {
        // gi + non-i vowel: gia → za, gio → zo, giư → zư, giê → zê, giu → zu
        w = 'z' + afterGi;
      } else {
        // gi alone, gi + i-variant, gi + consonant
        w = 'z' + w.slice(1); // → zi, zì, zí, ziê, ziêng
      }
    }

    // 'qu' + vowel: the 'u' in 'qu' is actually part of initial 'kw'
    // → we handle this by encoding 'qu' → 'kw' in INIT_CONS, so 'u' after 'q' is consumed
    // No pre-processing needed here.

    let i = 0;
    const len = w.length;

    // Track tone for the syllable
    let syllableTone = '1';
    let hasVowel = false;
    let quCluster = false; // whether we just matched 'qu'

    // ──── 1. Initial consonant ────
    let initMatched = false;
    for (const [graph, ipa] of INIT_CONS) {
      if (i + graph.length <= len && w.slice(i, i + graph.length) === graph) {
        // For graph starting with vowel chars: only allow 'qu'
        if (isVowel(graph[0]) && graph !== 'qu') continue;
        pushIpa(ipa);
        i += graph.length;
        initMatched = true;
        if (graph === 'qu') quCluster = true;
        break;
      }
    }

    // ──── 2 + 3. Medial glide + Vowel nucleus ────
    // Collect all consecutive vowel characters
    const vowelChars: string[] = [];
    while (i < len && isVowel(w[i])) {
      vowelChars.push(w[i]);
      i++;
    }

    if (vowelChars.length > 0) {
      hasVowel = true;

      // Determine tone from the marked vowel in the nucleus
      const markedChar = vowelChars.find(c => TONE_DIGIT[c] !== '1') ?? vowelChars[0];
      syllableTone = TONE_DIGIT[markedChar] ?? '1';

      // Emit phonemes for each vowel character
      for (let vi = 0; vi < vowelChars.length; vi++) {
        const vc = vowelChars[vi];
        const bvc = baseOf(vc);
        let ipaV = V2IPA[vc];

        if (!quCluster) {
          // Medial/semivowel glide rules (o/u before another vowel → 'w')
          if (vi === 0 || (vi > 0 && !isVowel(vowelChars[vi - 1]))) {
            // Leading position in vowel group:
            if ((bvc === 'o' || bvc === 'u') && vi < vowelChars.length - 1) {
              const nextBase = baseOf(vowelChars[vi + 1]);
              // o + a/ă/e/ê → w (oa, oă, oe, ...)
              if (bvc === 'o' && ['a', 'ă', 'e', 'ê', 'â'].includes(nextBase)) {
                ipaV = 'w';
              }
              // u + a/ă/â/e/ê/i/y/ơ/ư → w (ua, uê, ui, ...)
              if (bvc === 'u' && ['a', 'ă', 'â', 'e', 'ê', 'i', 'y', 'ơ', 'ư'].includes(nextBase)) {
                ipaV = 'w';
              }
            }
          }

          // Trailing glide rules (i/y/u/o after main vowel → j/w)
          if (vi > 0 && vi === vowelChars.length - 1) {
            const prevBase = baseOf(vowelChars[vi - 1]);
            // Trailing i/y after non-i vowel → 'j' glide
            if ((bvc === 'i' || bvc === 'y') && !['i', 'y'].includes(prevBase)) {
              ipaV = 'j';
            }
            // Trailing u/o after non-u/o vowel → 'w' glide (au, âu, ou, iu)
            if ((bvc === 'u' || bvc === 'o') && !['u', 'o'].includes(prevBase)) {
              ipaV = 'w';
            }
          }
        }

        if (ipaV && pm[ipaV]) rawIds.push(pm[ipaV][0]);
      }
    }

    // ──── 4. Final consonant ────
    for (const [graph, ipa] of FINAL_CONS) {
      // Only match true consonant finals (skip glide-only finals already handled)
      if (!['i', 'y', 'u', 'o'].includes(graph)) {
        if (i + graph.length <= len &&
            w.slice(i, i + graph.length) === graph &&
            !isVowel(graph[0])) {
          pushIpa(ipa);
          i += graph.length;
          break;
        }
      }
    }

    // ──── 5. Tone digit (after all phonemes in the syllable) ────
    if (hasVowel && pm[syllableTone]) {
      rawIds.push(pm[syllableTone][0]);
    }

    // Word boundary space (not after last word)
    if (wi < tokens.length - 1 && pm[' ']) {
      rawIds.push(pm[' '][0]);
    }
  }

  // End boundary
  if (pm['$']) rawIds.push(pm['$'][0]);

  // Interleave with blank tokens (id=0) as required by Piper/VITS
  const ids: number[] = [0];
  for (const id of rawIds) {
    ids.push(id);
    ids.push(0);
  }

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
