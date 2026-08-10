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

      // Configure ONNX Runtime Web for stable single-thread WASM execution
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

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

      const feeds: Record<string, ort.Tensor> = {
        input: inputTensor,
        input_lengths: inputLengthsTensor,
        scales: scalesTensor,
      };

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
