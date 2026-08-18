import * as ort from 'onnxruntime-web';
import { TTSModelConfig, WorkerInMessage, WorkerOutMessage } from '@/types';

let session: ort.InferenceSession | null = null;
let modelConfig: TTSModelConfig | null = null;
let createPiperPhonemizeFn: any = null;

// Set local WASM path matching installed package onnxruntime-web@1.27.0
ort.env.wasm.wasmPaths = '/wasm/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

/**
 * Dynamically load createPiperPhonemize from static asset /piper/piper_phonemize.js
 */
async function getCreatePiperPhonemize(): Promise<any> {
  if (createPiperPhonemizeFn) return createPiperPhonemizeFn;

  const globalScope = self as unknown as {
    importScripts?: (...urls: string[]) => void;
    createPiperPhonemize?: any;
  };

  if (typeof globalScope.importScripts === 'function') {
    try {
      globalScope.importScripts('/piper/piper_phonemize.js');
      if (typeof globalScope.createPiperPhonemize !== 'undefined') {
        createPiperPhonemizeFn = globalScope.createPiperPhonemize;
        return createPiperPhonemizeFn;
      }
    } catch {
      // Fallback to fetch
    }
  }

  const res = await fetch('/piper/piper_phonemize.js');
  if (!res.ok) {
    throw new Error(`Không thể tải script eSpeak WASM (${res.status})`);
  }
  const code = await res.text();
  const getFn = new Function(`${code}; return createPiperPhonemize;`);
  createPiperPhonemizeFn = getFn();
  return createPiperPhonemizeFn;
}

/**
 * Phonemize Vietnamese text using real eSpeak-NG WebAssembly (piper_phonemize).
 * Produces the exact eSpeak-NG IPA phoneme IDs required by the Piper model.
 */
async function textToPhonemeIds(text: string, voice: string = 'vi'): Promise<number[]> {
  const createPhonemize = await getCreatePiperPhonemize();
  const input = JSON.stringify([{ text: text.trim() }]);

  return new Promise(async (resolve, reject) => {
    try {
      const module = await createPhonemize({
        noExitRuntime: true,
        print: (data: string) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed && Array.isArray(parsed.phoneme_ids)) {
              resolve(parsed.phoneme_ids);
            }
          } catch {
            // ignore non-JSON stdout
          }
        },
        printErr: (err: string) => {
          console.warn('piper_phonemize:', err);
        },
        locateFile: (url: string) => {
          if (url.endsWith('.wasm')) return '/piper/piper_phonemize.wasm';
          if (url.endsWith('.data')) return '/piper/piper_phonemize.data';
          return `/piper/${url}`;
        },
      });

      module.callMain([
        '-l', voice,
        '--input', input,
        '--espeak_data', '/espeak-ng-data',
      ]);
    } catch (err) {
      reject(err);
    }
  });
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

      // Warm up eSpeak NG WASM phonemizer in background
      textToPhonemeIds('khởi động', modelConfig.espeak?.voice || 'vi').catch(() => {});

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
      const voice = modelConfig.espeak?.voice || 'vi';
      const phonemeIds = await textToPhonemeIds(msg.text, voice);

      if (!phonemeIds || phonemeIds.length <= 2) {
        // Only boundary tokens or empty, skip
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
