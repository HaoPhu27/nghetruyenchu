export interface Novel {
  id: string;
  user_id?: string;
  title: string;
  author?: string;
  cover_url?: string;
  file_url: string;
  file_size?: number;
  chapter_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserProgress {
  user_id: string;
  novel_id: string;
  location_cfi: string | null;
  chapter_index: number;
  tts_sentence_index: number;
  updated_at?: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  index: number;
  href: string;
}

export interface ParsedBook {
  title: string;
  author: string;
  coverBlob: Blob | null;
  chapters: ChapterItem[];
}

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'amoled';

export interface TTSModelConfig {
  audio: {
    sample_rate: number;
  };
  espeak: {
    voice: string;
  };
  phoneme_type: string;
  num_symbols: number;
  num_speakers: number;
  inference: {
    noise_scale: number;
    length_scale: number;
    noise_w: number;
  };
  phoneme_id_map: Record<string, number[]>;
  hop_length: number;
  piper_version: string;
}

export type WorkerInMessage =
  | { type: 'init'; modelUrl: string; configUrl: string }
  | { type: 'synthesize'; id: number; text: string }
  | { type: 'cancel' };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'audio'; id: number; buffer: Float32Array; sampleRate: number }
  | { type: 'error'; id: number; message: string };
