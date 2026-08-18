// read_epub_chapter.ts — Extracts a chapter from EPUB and generates audio
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import * as ort from 'onnxruntime-node';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { WaveFile } from 'wavefile';

const EPUB_PATH = 'D:/Xuong_code/nghetruyenchu/docs/Co Chan Nhan - Co Chan Nhan.epub';
const ESPEAK_PATH = 'C:\\Program Files\\eSpeak NG\\espeak-ng.exe';
const MODEL_PATH  = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx';
const CONFIG_PATH = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx.json';
const OUTPUT_WAV  = 'co_chan_nhan_chuong_1.wav';

const modelConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const phonemeIdMap: Record<string, number[]> = modelConfig.phoneme_id_map;

// 1. Extract text from EPUB
function extractChapterText(epubPath: string): string[] {
  const zip = new AdmZip(epubPath);
  // Get chapter 1 (Section0001.xhtml usually contains the first chapter in standard epubs)
  const c1 = zip.getEntries().find(e => e.entryName.match(/Section0001\.xhtml/i));
  if (!c1) throw new Error("Could not find chapter 1");
  
  const content = zip.readAsText(c1.entryName);
  const $ = cheerio.load(content);
  
  // Extract text and clean it up
  const text = $('body').text().trim();
  
  // Split into sentences for processing
  // Vietnamese sentences usually end with . ! ? followed by space, or newline
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  return sentences;
}

// 2. Generate eSpeak IPA
function espeakVietnamese(text: string): string {
  const tmpFile = path.join(os.tmpdir(), `espeak_vi_${Date.now()}.txt`);
  try {
    const buf = Buffer.concat([
      Buffer.from('\uFEFF', 'utf8'),
      Buffer.from(text, 'utf8'),
    ]);
    fs.writeFileSync(tmpFile, buf);

    const result = spawnSync(ESPEAK_PATH, [
      '-v', 'vi',
      '-q',
      '--ipa=3',
      '-f', tmpFile,
    ], { encoding: 'buffer' });

    if (result.status !== 0) {
      throw new Error(`eSpeak failed: ${result.stderr.toString('utf8')}`);
    }

    return result.stdout.toString('utf8').trim();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// 3. Convert IPA to Phoneme IDs
function ipaToPhonemeIds(ipa: string): number[] {
  const ZERO_WIDTH_JOINER = '\u200D';
  const rawIds: number[] = [];

  if (phonemeIdMap['^']) rawIds.push(phonemeIdMap['^'][0]);

  for (let ch of ipa) {
    if (ch === ZERO_WIDTH_JOINER) continue;
    if (ch === '\n') ch = ' ';

    const ids = phonemeIdMap[ch];
    if (ids !== undefined) {
      rawIds.push(ids[0]);
    }
  }

  if (phonemeIdMap['$']) rawIds.push(phonemeIdMap['$'][0]);

  const ids: number[] = [0];
  for (const id of rawIds) {
    ids.push(id);
    ids.push(0);
  }
  return ids;
}

// 4. Main synthesis loop
async function run() {
  console.log('Extracting Chapter 1 from EPUB...');
  const sentences = extractChapterText(EPUB_PATH);
  
  // Just take the first 30 sentences to avoid making it run for too long
  // 30 sentences is about ~3-4 minutes of audio.
  const targetSentences = sentences.slice(0, 30);
  
  console.log(`Found ${sentences.length} sentences. Processing first ${targetSentences.length}...`);

  console.log('Loading ONNX model...');
  const session = await ort.InferenceSession.create(MODEL_PATH);
  
  const audioChunks: Float32Array[] = [];
  let totalSamples = 0;

  for (let i = 0; i < targetSentences.length; i++) {
    const text = targetSentences[i];
    console.log(`[${i+1}/${targetSentences.length}] Generating: "${text.substring(0, 50)}..."`);
    
    try {
      const ipa = espeakVietnamese(text);
      const phonemeIds = ipaToPhonemeIds(ipa);
      
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
      const inputLengthsTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
      const scalesTensor = new ort.Tensor('float32', Float32Array.from([0.667, 1.0, 0.8]), [3]);

      const results = await session.run({
        input: inputTensor,
        input_lengths: inputLengthsTensor,
        scales: scalesTensor,
      });

      const outputTensor = results.output ?? Object.values(results)[0];
      const audioBuffer = outputTensor.data as Float32Array;
      
      audioChunks.push(audioBuffer);
      totalSamples += audioBuffer.length;
      
      // Add a small 0.5s pause between sentences
      const pauseSamples = Math.floor(modelConfig.audio.sample_rate * 0.5);
      const pauseBuffer = new Float32Array(pauseSamples);
      audioChunks.push(pauseBuffer);
      totalSamples += pauseSamples;
      
    } catch (err: any) {
      console.error(`Error processing sentence: ${err?.message || err}`);
    }
  }

  console.log(`\nStitching audio... Total samples: ${totalSamples}`);
  const finalAudio = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of audioChunks) {
    finalAudio.set(chunk, offset);
    offset += chunk.length;
  }

  const wav = new WaveFile();
  wav.fromScratch(1, modelConfig.audio.sample_rate, '32f', finalAudio);
  fs.writeFileSync(OUTPUT_WAV, wav.toBuffer());
  
  console.log(`✓ Chapter 1 exported to ${OUTPUT_WAV} (${(totalSamples / 22050).toFixed(2)}s)`);
}

run().catch(console.error);
