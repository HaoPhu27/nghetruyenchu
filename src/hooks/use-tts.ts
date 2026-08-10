import { useEffect } from 'react';
import { ttsEngine } from '@/lib/tts/tts-engine';
import { useTTSStore } from '@/lib/store/tts-store';

export function useTTS() {
  const {
    modelStatus,
    modelProgress,
    errorMessage,
    isPlaying,
    isPaused,
    currentSentenceIndex,
    sentences,
    currentChapterTitle,
    playbackSpeed,
    volume,
  } = useTTSStore();

  useEffect(() => {
    // Lazy initialize TTS worker on mount
    ttsEngine.initWorker();
  }, []);

  const playChapter = (sentences: string[], startIndex = 0, chapterTitle = '') => {
    ttsEngine.playSentences(sentences, startIndex, chapterTitle);
  };

  const pause = () => {
    ttsEngine.pause();
  };

  const resume = () => {
    ttsEngine.resume();
  };

  const stop = () => {
    ttsEngine.stopPlayback();
  };

  const setSpeed = (speed: number) => {
    ttsEngine.setSpeed(speed);
  };

  const setVolume = (vol: number) => {
    ttsEngine.setVolume(vol);
  };

  const nextSentence = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      ttsEngine.playSentences(sentences, currentSentenceIndex + 1, currentChapterTitle);
    }
  };

  const prevSentence = () => {
    if (currentSentenceIndex > 0) {
      ttsEngine.playSentences(sentences, currentSentenceIndex - 1, currentChapterTitle);
    }
  };

  return {
    modelStatus,
    modelProgress,
    errorMessage,
    isPlaying,
    isPaused,
    currentSentenceIndex,
    sentences,
    currentChapterTitle,
    playbackSpeed,
    volume,
    playChapter,
    pause,
    resume,
    stop,
    setSpeed,
    setVolume,
    nextSentence,
    prevSentence,
  };
}
