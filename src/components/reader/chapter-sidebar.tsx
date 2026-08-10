'use client';

import React from 'react';
import { List, X, BookOpen, ChevronRight } from 'lucide-react';
import { ChapterItem } from '@/types';

interface ChapterSidebarProps {
  chapters: ChapterItem[];
  currentChapterIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapter: ChapterItem) => void;
}

export function ChapterSidebar({
  chapters,
  currentChapterIndex,
  isOpen,
  onClose,
  onSelectChapter,
}: ChapterSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-zinc-950/95 border-r border-zinc-800 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-left duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
          <List className="w-5 h-5 text-yellow-500" />
          <span>Mục Lục Chương ({chapters.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chapters list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {chapters.map((chap, idx) => {
          const isActive = idx === currentChapterIndex;
          return (
            <button
              key={chap.id || idx}
              onClick={() => {
                onSelectChapter(chap);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-medium transition-all ${
                isActive
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-yellow-500' : 'text-zinc-600'}`} />
                <span className="truncate">{chap.title}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-yellow-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
