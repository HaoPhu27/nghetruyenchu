import { create } from 'zustand';

export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

interface TTSState {
  modelStatus: ModelStatus;
  modelProgress: number; // 0-100%
  errorMessage: string | null;

  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  sentences: string[];
  currentChapterTitle: string;
  playbackSpeed: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0

  setModelStatus: (status: ModelStatus, progress?: number, error?: string | null) => void;
  setSentences: (sentences: string[], chapterTitle?: string, initialIndex?: number) => void;
  setCurrentSentenceIndex: (index: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  resetTTS: () => void;
}

export const useTTSStore = create<TTSState>((set) => ({
  modelStatus: 'unloaded',
  modelProgress: 0,
  errorMessage: null,

  isPlaying: false,
  isPaused: false,
  currentSentenceIndex: 0,
  sentences: [],
  currentChapterTitle: '',
  playbackSpeed: 1.0,
  volume: 1.0,

  setModelStatus: (status, progress = 0, error = null) =>
    set({
      modelStatus: status,
      modelProgress: progress,
      errorMessage: error,
    }),

  setSentences: (sentences, chapterTitle = '', initialIndex = 0) =>
    set({
      sentences,
      currentChapterTitle: chapterTitle,
      currentSentenceIndex: initialIndex,
    }),

  setCurrentSentenceIndex: (currentSentenceIndex) => set({ currentSentenceIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying, isPaused: !isPlaying }),
  setIsPaused: (isPaused) => set({ isPaused, isPlaying: !isPaused }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setVolume: (volume) => set({ volume }),

  resetTTS: () =>
    set({
      isPlaying: false,
      isPaused: false,
      currentSentenceIndex: 0,
      sentences: [],
    }),
}));
