"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// read_epub_chapter.ts — Extracts a chapter from EPUB and generates audio
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var os_1 = __importDefault(require("os"));
var child_process_1 = require("child_process");
var ort = __importStar(require("onnxruntime-node"));
var adm_zip_1 = __importDefault(require("adm-zip"));
var cheerio = __importStar(require("cheerio"));
var wavefile_1 = require("wavefile");
var EPUB_PATH = 'D:/Xuong_code/nghetruyenchu/docs/Co Chan Nhan - Co Chan Nhan.epub';
var ESPEAK_PATH = 'C:\\Program Files\\eSpeak NG\\espeak-ng.exe';
var MODEL_PATH = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx';
var CONFIG_PATH = 'd:/Xuong_code/nghetruyenchu/public/models/ngochuyennew.onnx.json';
var OUTPUT_WAV = 'co_chan_nhan_chuong_1.wav';
var modelConfig = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf8'));
var phonemeIdMap = modelConfig.phoneme_id_map;
// 1. Extract text from EPUB
function extractChapterText(epubPath) {
    var zip = new adm_zip_1.default(epubPath);
    // Get chapter 1 (Section0001.xhtml usually contains the first chapter in standard epubs)
    var c1 = zip.getEntries().find(function (e) { return e.entryName.match(/Section0001\.xhtml/i); });
    if (!c1)
        throw new Error("Could not find chapter 1");
    var content = zip.readAsText(c1.entryName);
    var $ = cheerio.load(content);
    // Extract text and clean it up
    var text = $('body').text().trim();
    // Split into sentences for processing
    // Vietnamese sentences usually end with . ! ? followed by space, or newline
    var sentences = text
        .split(/(?<=[.!?])\s+|\n+/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
    return sentences;
}
// 2. Generate eSpeak IPA
function espeakVietnamese(text) {
    var tmpFile = path_1.default.join(os_1.default.tmpdir(), "espeak_vi_".concat(Date.now(), ".txt"));
    try {
        var buf = Buffer.concat([
            Buffer.from('\uFEFF', 'utf8'),
            Buffer.from(text, 'utf8'),
        ]);
        fs_1.default.writeFileSync(tmpFile, buf);
        var result = (0, child_process_1.spawnSync)(ESPEAK_PATH, [
            '-v', 'vi',
            '-q',
            '--ipa=3',
            '-f', tmpFile,
        ], { encoding: 'buffer' });
        if (result.status !== 0) {
            throw new Error("eSpeak failed: ".concat(result.stderr.toString('utf8')));
        }
        return result.stdout.toString('utf8').trim();
    }
    finally {
        if (fs_1.default.existsSync(tmpFile))
            fs_1.default.unlinkSync(tmpFile);
    }
}
// 3. Convert IPA to Phoneme IDs
function ipaToPhonemeIds(ipa) {
    var ZERO_WIDTH_JOINER = '\u200D';
    var rawIds = [];
    if (phonemeIdMap['^'])
        rawIds.push(phonemeIdMap['^'][0]);
    for (var _i = 0, ipa_1 = ipa; _i < ipa_1.length; _i++) {
        var ch = ipa_1[_i];
        if (ch === ZERO_WIDTH_JOINER)
            continue;
        if (ch === '\n')
            ch = ' ';
        var ids_1 = phonemeIdMap[ch];
        if (ids_1 !== undefined) {
            rawIds.push(ids_1[0]);
        }
    }
    if (phonemeIdMap['$'])
        rawIds.push(phonemeIdMap['$'][0]);
    var ids = [0];
    for (var _a = 0, rawIds_1 = rawIds; _a < rawIds_1.length; _a++) {
        var id = rawIds_1[_a];
        ids.push(id);
        ids.push(0);
    }
    return ids;
}
// 4. Main synthesis loop
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var sentences, targetSentences, session, audioChunks, totalSamples, i, text, ipa, phonemeIds, inputTensor, inputLengthsTensor, scalesTensor, results, outputTensor, audioBuffer, pauseSamples, pauseBuffer, err_1, finalAudio, offset, _i, audioChunks_1, chunk, wav;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Extracting Chapter 1 from EPUB...');
                    sentences = extractChapterText(EPUB_PATH);
                    targetSentences = sentences.slice(0, 30);
                    console.log("Found ".concat(sentences.length, " sentences. Processing first ").concat(targetSentences.length, "..."));
                    console.log('Loading ONNX model...');
                    return [4 /*yield*/, ort.InferenceSession.create(MODEL_PATH)];
                case 1:
                    session = _b.sent();
                    audioChunks = [];
                    totalSamples = 0;
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < targetSentences.length)) return [3 /*break*/, 7];
                    text = targetSentences[i];
                    console.log("[".concat(i + 1, "/").concat(targetSentences.length, "] Generating: \"").concat(text.substring(0, 50), "...\""));
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    ipa = espeakVietnamese(text);
                    phonemeIds = ipaToPhonemeIds(ipa);
                    inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
                    inputLengthsTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
                    scalesTensor = new ort.Tensor('float32', Float32Array.from([0.667, 1.0, 0.8]), [3]);
                    return [4 /*yield*/, session.run({
                            input: inputTensor,
                            input_lengths: inputLengthsTensor,
                            scales: scalesTensor,
                        })];
                case 4:
                    results = _b.sent();
                    outputTensor = (_a = results.output) !== null && _a !== void 0 ? _a : Object.values(results)[0];
                    audioBuffer = outputTensor.data;
                    audioChunks.push(audioBuffer);
                    totalSamples += audioBuffer.length;
                    pauseSamples = Math.floor(modelConfig.audio.sample_rate * 0.5);
                    pauseBuffer = new Float32Array(pauseSamples);
                    audioChunks.push(pauseBuffer);
                    totalSamples += pauseSamples;
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _b.sent();
                    console.error("Error processing sentence: ".concat(err_1.message));
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 2];
                case 7:
                    console.log("\nStitching audio... Total samples: ".concat(totalSamples));
                    finalAudio = new Float32Array(totalSamples);
                    offset = 0;
                    for (_i = 0, audioChunks_1 = audioChunks; _i < audioChunks_1.length; _i++) {
                        chunk = audioChunks_1[_i];
                        finalAudio.set(chunk, offset);
                        offset += chunk.length;
                    }
                    wav = new wavefile_1.WaveFile();
                    wav.fromScratch(1, modelConfig.audio.sample_rate, '32f', finalAudio);
                    fs_1.default.writeFileSync(OUTPUT_WAV, wav.toBuffer());
                    console.log("\u2713 Chapter 1 exported to ".concat(OUTPUT_WAV, " (").concat((totalSamples / 22050).toFixed(2), "s)"));
                    return [2 /*return*/];
            }
        });
    });
}
run().catch(console.error);
