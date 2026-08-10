import * as ort from 'onnxruntime-web';
import { TTSModelConfig, WorkerInMessage, WorkerOutMessage } from '@/types';

let session: ort.InferenceSession | null = null;
let modelConfig: TTSModelConfig | null = null;

// Set local WASM path matching installed package onnxruntime-web@1.27.0
ort.env.wasm.wasmPaths = '/wasm/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

// Vietnamese Grapheme-to-Phoneme (G2P) converter for Piper / ngochuyennew model
const G2P_MAP: Record<string, string> = {
  // Initial consonants
  'ngh': 'ŋ', 'ng': 'ŋ', 'nh': 'ɲ', 'ch': 'c', 'ph': 'f', 'th': 't', 'tr': 't', 'kh': 'x', 'gh': 'ɣ', 'gi': 'z', 'qu': 'kw',
  'b': 'ɓ', 'c': 'k', 'd': 'z', 'đ': 'ɗ', 'g': 'ɣ', 'h': 'h', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n',
  'p': 'p', 'q': 'k', 'r': 'z', 's': 's', 't': 't', 'v': 'v', 'x': 's',

  // Diphthongs & special vowels
  'iê': 'iə', 'yê': 'iə', 'ia': 'iə', 'ya': 'iə',
  'uô': 'uə', 'ua': 'uə',
  'ươ': 'ɨə', 'ưa': 'ɨə',

  // Single Vowels with tones (1: ngang, 2: huyền, 3: hỏi, 4: ngã, 5: sắc, 6: nặng)
  'a': 'a', 'à': 'a2', 'á': 'a5', 'ả': 'a3', 'ã': 'a4', 'ạ': 'a6',
  'ă': 'a', 'ằ': 'a2', 'ắ': 'a5', 'ẳ': 'a3', 'ẵ': 'a4', 'ặ': 'a6',
  'â': 'ə', 'ầ': 'ə2', 'ấ': 'ə5', 'ẩ': 'ə3', 'ẫ': 'ə4', 'ậ': 'ə6',
  'e': 'ɛ', 'è': 'ɛ2', 'é': 'ɛ5', 'ẻ': 'ɛ3', 'ẽ': 'ɛ4', 'ẹ': 'ɛ6',
  'ê': 'e', 'ề': 'e2', 'ế': 'e5', 'ể': 'e3', 'ễ': 'e4', 'ệ': 'e6',
  'i': 'i', 'ì': 'i2', 'í': 'i5', 'ỉ': 'i3', 'ĩ': 'i4', 'ị': 'i6',
  'y': 'i', 'ỳ': 'i2', 'ý': 'i5', 'ỷ': 'i3', 'ỹ': 'i4', 'ỵ': 'i6',
  'o': 'ɔ', 'ò': 'ɔ2', 'ó': 'ɔ5', 'ỏ': 'ɔ3', 'õ': 'ɔ4', 'ọ': 'ɔ6',
  'ô': 'o', 'ồ': 'o2', 'ố': 'o5', 'ổ': 'o3', 'ỗ': 'o4', 'ộ': 'o6',
  'ơ': 'ə', 'ờ': 'ə2', 'ớ': 'ə5', 'ở': 'ə3', 'ỡ': 'ə4', 'ợ': 'ə6',
  'u': 'u', 'ù': 'u2', 'ú': 'u5', 'ủ': 'u3', 'ũ': 'u4', 'ụ': 'u6',
  'ư': 'ɨ', 'ừ': 'ɨ2', 'ứ': 'ɨ5', 'ử': 'ɨ3', 'ữ': 'ɨ4', 'ự': 'ɨ6',
};

function vietnameseToPhonemes(text: string): string {
  let str = text.toLowerCase().trim();
  const words = str.split(/\s+/);
  const phonemes: string[] = [];

  for (const word of words) {
    let w = word.replace(/[^a-zàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ]/g, '');
    if (!w) continue;

    let idx = 0;
    let wordPhonemes: string[] = [];
    while (idx < w.length) {
      let matched = false;
      for (const len of [3, 2, 1]) {
        if (idx + len <= w.length) {
          const sub = w.slice(idx, idx + len);
          if (G2P_MAP[sub]) {
            wordPhonemes.push(G2P_MAP[sub]);
            idx += len;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        wordPhonemes.push(w[idx]);
        idx++;
      }
    }
    phonemes.push(wordPhonemes.join(''));
  }

  return phonemes.join(' ');
}

// Map character/phoneme string into array of phoneme ID numbers
function textToPhonemeIds(text: string, config: TTSModelConfig): number[] {
  const map = config.phoneme_id_map;
  const ids: number[] = [];

  // Start symbol ^ (id 1)
  if (map['^']) ids.push(...map['^']);

  const phonemesStr = vietnameseToPhonemes(text);
  for (let i = 0; i < phonemesStr.length; i++) {
    const char = phonemesStr[i];
    if (map[char]) {
      ids.push(...map[char]);
    } else if (map[' ']) {
      // Fallback for unmapped chars to space
      ids.push(...map[' ']);
    }
  }

  // End symbol $ (id 2)
  if (map['$']) ids.push(...map['$']);

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

      // Fetch ONNX model binary directly as ArrayBuffer to avoid memory duplication
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
      if (phonemeIds.length === 0) {
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

      const feeds: Record<string, ort.Tensor> = {};
      const inputNames = session.inputNames;

      for (const name of inputNames) {
        if (name === 'input' || name === 'text') {
          feeds[name] = inputTensor;
        } else if (name === 'input_lengths' || name === 'text_lengths') {
          feeds[name] = inputLengthsTensor;
        } else if (name === 'scales') {
          feeds[name] = scalesTensor;
        } else if (name === 'sid') {
          feeds[name] = new ort.Tensor('int64', BigInt64Array.from([BigInt(0)]), [1]);
        }
      }

      if (Object.keys(feeds).length === 0) {
        feeds['input'] = inputTensor;
        feeds['input_lengths'] = inputLengthsTensor;
        feeds['scales'] = scalesTensor;
      }

      const results = await session.run(feeds);

      // Extract output audio Float32Array
      const outputTensor = results.output || Object.values(results)[0];
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
