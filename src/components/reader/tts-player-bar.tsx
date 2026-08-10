'use client';

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Gauge,
  Headphones,
} from 'lucide-react';
import { useTTS } from '@/hooks/use-tts';

interface TTSPlayerBarProps {
  onPlayChapter: () => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export function TTSPlayerBar({ onPlayChapter }: TTSPlayerBarProps) {
  const {
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
    setSpeed,
    setVolume,
    nextSentence,
    prevSentence,
  } = useTTS();

  const currentSentenceText = sentences[currentSentenceIndex] || '';

  const handlePlayToggle = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused && sentences.length > 0) {
      resume();
    } else {
      onPlayChapter();
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/90 border-t border-zinc-800/80 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Sentence text preview */}
        <div className="flex items-center gap-3 w-full md:w-1/3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-yellow-500 truncate">
              {currentChapterTitle || 'Đọc bằng giọng AI'}
            </div>
            <p className="text-xs text-zinc-300 truncate italic">
              {currentSentenceText ? `"${currentSentenceText}"` : 'Nhấn phát để bắt đầu nghe...'}
            </p>
          </div>
        </div>

        {/* Player controls (Center) */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevSentence}
            disabled={currentSentenceIndex <= 0}
            className="p-2 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors"
            title="Câu trước"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={handlePlayToggle}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-500/25 transition-transform hover:scale-105"
            title={isPlaying ? 'Tạm dừng' : 'Phát giọng đọc'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextSentence}
            disabled={currentSentenceIndex >= sentences.length - 1}
            className="p-2 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors"
            title="Câu tiếp"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Counter badge */}
          {sentences.length > 0 && (
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
              {currentSentenceIndex + 1} / {sentences.length}
            </span>
          )}
        </div>

        {/* Speed & Volume controls (Right) */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          {/* Speed selector */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
            <Gauge className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={playbackSpeed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-pointer"
            >
              {SPEED_OPTIONS.map((spd) => (
                <option key={spd} value={spd} className="bg-zinc-900 text-zinc-100">
                  {spd}x
                </option>
              ))}
            </select>
          </div>

          {/* Volume slider */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-yellow-500 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
