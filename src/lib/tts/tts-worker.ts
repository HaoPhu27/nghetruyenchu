import * as ort from 'onnxruntime-web';
import { TTSModelConfig, WorkerInMessage, WorkerOutMessage } from '@/types';

let session: ort.InferenceSession | null = null;
let modelConfig: TTSModelConfig | null = null;

// Map character/phoneme string into array of phoneme ID numbers
function textToPhonemeIds(text: string, config: TTSModelConfig): number[] {
  const map = config.phoneme_id_map;
  const ids: number[] = [];

  // Start symbol ^ (id 1)
  if (map['^']) ids.push(...map['^']);

  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
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
      modelConfig = (await configRes.json()) as TTSModelConfig;

      // Fetch ONNX model binary with progress reporting
      const modelRes = await fetch(msg.modelUrl);
      const contentLength = modelRes.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = modelRes.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            if (total > 0) {
              const progress = Math.round((loaded / total) * 100);
              postMessage({ type: 'progress', loaded, total } as WorkerOutMessage);
            }
          }
        }
      }

      // Combine chunks into ArrayBuffer
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Configure ONNX Runtime Web WASM options
      ort.env.wasm.numThreads = 2;
      ort.env.wasm.simd = true;

      session = await ort.InferenceSession.create(combined.buffer, {
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

      const feeds: Record<string, ort.Tensor> = {
        input: inputTensor,
        input_lengths: inputLengthsTensor,
        scales: scalesTensor,
      };

      const results = await session.run(feeds);

      // Extract output audio Float32Array
      const outputTensor = results.output || Object.values(results)[0];
      const audioBuffer = outputTensor.data as Float32Array;

      postMessage({
        type: 'audio',
        id: msg.id,
        buffer: audioBuffer,
        sampleRate: modelConfig.audio.sample_rate,
      } as WorkerOutMessage);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi tổng hợp giọng nói';
      postMessage({ type: 'error', id: msg.id, message: errorMessage } as WorkerOutMessage);
    }
  }
};
