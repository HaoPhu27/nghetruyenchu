// generate_audio4.ts — Vietnamese TTS using eSpeak NG for proper G2P
// Uses the same pipeline as voznovel.com:
//   text → eSpeak NG (voice=vi, IPA) → strip ZWJ + stress markers → phoneme_id_map → ONNX
//
// Prerequisites:
//   - eSpeak NG installed: https://github.com/espeak-ng/espeak-ng/releases
//   - ONNX model: public/models/ngochuyennew.onnx
//
// Run: npx ts-node generate_audio4.ts

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import * as ort from 'onnxruntime-node';
import { WaveFile } from 'wavefile';

// ─── Config ───────────────────────────────────────────────────
const ESPEAK_PATH = 'C:\\Program Files\\eSpeak NG\\espeak-ng.exe';
const MODEL_PATH  = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx';
const CONFIG_PATH = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx.json';
const OUTPUT_WAV  = 'test_audio4.wav';

const modelConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const phonemeIdMap: Record<string, number[]> = modelConfig.phoneme_id_map;

// ─── eSpeak G2P ───────────────────────────────────────────────
/**
 * Convert Vietnamese text → IPA phonemes using eSpeak NG.
 * Mirrors what voznovel's piper-tts-worker.js does via eSpeak WASM.
 */
function espeakVietnamese(text: string): string {
  // Write UTF-8 text to temp file (avoids shell encoding issues)
  const tmpFile = path.join(os.tmpdir(), `espeak_vi_${Date.now()}.txt`);
  try {
    // Write with UTF-8 BOM for eSpeak compatibility on Windows
    const buf = Buffer.concat([
      Buffer.from('\uFEFF', 'utf8'),
      Buffer.from(text, 'utf8'),
    ]);
    fs.writeFileSync(tmpFile, buf);

    const result = spawnSync(ESPEAK_PATH, [
      '-v', 'vi',    // Vietnamese voice
      '-q',          // Quiet (no audio output)
      '--ipa=3',     // IPA mode 3 = continuous phoneme string
      '-f', tmpFile, // Read from file
    ], { encoding: 'buffer' });

    if (result.status !== 0) {
      const err = result.stderr.toString('utf8').trim();
      throw new Error(`eSpeak failed (code ${result.status}): ${err}`);
    }

    return result.stdout.toString('utf8').trim();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ─── Phoneme → ID conversion ─────────────────────────────────
/**
 * Convert eSpeak IPA string → phoneme ID array for Piper ONNX model.
 *
 * eSpeak output chars that we need to handle:
 *   - Regular IPA chars: mapped directly via phoneme_id_map
 *   - ˈ (primary stress): map as-is (model has it)
 *   - ˌ (secondary stress): map as-is (model has it)
 *   - ː (long vowel): map as-is (model has it)
 *   - 1-7 (tone digits): map as-is (model has them)
 *   - \u200D (Zero Width Joiner): SKIP — joins digraphs, not in model
 *   - \n (newline between sentences): treat as space
 *   - spaces: map as space (ID for ' ')
 */
function ipaToPhonemeIds(ipa: string): number[] {
  const ZERO_WIDTH_JOINER = '\u200D';

  const rawIds: number[] = [];

  function pushChar(ch: string) {
    if (ch === ZERO_WIDTH_JOINER) return; // skip ZWJ
    if (ch === '\n') ch = ' ';            // newline → space

    const ids = phonemeIdMap[ch];
    if (ids !== undefined) {
      rawIds.push(ids[0]);
    }
    // else: unknown char, skip silently
  }

  // Add start token
  if (phonemeIdMap['^']) rawIds.push(phonemeIdMap['^'][0]);

  // Push each IPA character
  for (const ch of ipa) {
    pushChar(ch);
  }

  // Add end token
  if (phonemeIdMap['$']) rawIds.push(phonemeIdMap['$'][0]);

  // Interleave with blank tokens (Piper/CTC requirement)
  const ids: number[] = [0]; // leading blank
  for (const id of rawIds) {
    ids.push(id);
    ids.push(0); // blank after each phoneme
  }
  return ids;
}

// ─── Debug helper ─────────────────────────────────────────────
function debugText(text: string) {
  console.log(`\nText: "${text}"`);
  const ipa = espeakVietnamese(text);
  console.log(`eSpeak IPA: [${ipa}]`);
  const ids = ipaToPhonemeIds(ipa);
  // Show human-readable mapping
  const revMap: Record<number, string> = {};
  for (const [k, v] of Object.entries(phonemeIdMap)) {
    revMap[(v as number[])[0]] = k;
  }
  const decoded = ids.map(id => revMap[id] ?? `?${id}`).join(' ');
  console.log(`Phoneme IDs (${ids.length}): [${decoded}]`);
  return ids;
}

// ─── Main ─────────────────────────────────────────────────────
async function run() {
  console.log('=== Vietnamese TTS via eSpeak NG → Piper ONNX ===\n');

  // Debug a few test cases
  const debugCases = [
    'xin chào',
    'học sinh giỏi',
    'chuyện tiếng Việt',
    'nước',
    'người',
  ];

  for (const tc of debugCases) {
    debugText(tc);
  }

  // Full sentence for audio output
  const text = 'Có dấu câu. Xin chào! Tôi là Ngọc Huyền. Hôm nay là một ngày đẹp trời. Bạn có khỏe không?';
  console.log(`\n=== Generating audio for: "${text}" ===`);

  const ipa = espeakVietnamese(text);
  console.log(`eSpeak IPA: ${ipa}`);

  const phonemeIds = ipaToPhonemeIds(ipa);
  console.log(`Phoneme IDs count: ${phonemeIds.length}`);

  console.log('Loading ONNX model...');
  const session = await ort.InferenceSession.create(MODEL_PATH);
  console.log('Model loaded. Running inference...');

  const inputTensor = new ort.Tensor(
    'int64',
    BigInt64Array.from(phonemeIds.map(BigInt)),
    [1, phonemeIds.length]
  );
  const inputLengthsTensor = new ort.Tensor(
    'int64',
    BigInt64Array.from([BigInt(phonemeIds.length)]),
    [1]
  );
  const scalesTensor = new ort.Tensor(
    'float32',
    Float32Array.from([
      modelConfig.inference.noise_scale,   // 0.667
      modelConfig.inference.length_scale,  // 1.0
      modelConfig.inference.noise_w,       // 0.8
    ]),
    [3]
  );

  const results = await session.run({
    input: inputTensor,
    input_lengths: inputLengthsTensor,
    scales: scalesTensor,
  });

  const outputTensor = results.output ?? Object.values(results)[0];
  const audioBuffer = outputTensor.data as Float32Array;
  console.log(`Generated audio samples: ${audioBuffer.length} (${(audioBuffer.length / 22050).toFixed(2)}s)`);

  const wav = new WaveFile();
  wav.fromScratch(1, modelConfig.audio.sample_rate, '32f', audioBuffer);
  fs.writeFileSync(OUTPUT_WAV, wav.toBuffer());
  console.log(`\n✓ Saved to ${OUTPUT_WAV}`);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
