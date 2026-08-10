'use client';

import React from 'react';
import { Settings, Sun, Moon, Sparkles, Check } from 'lucide-react';
import { useReaderStore } from '@/lib/store/reader-store';
import { ReaderTheme } from '@/types';

interface ReaderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES: { id: ReaderTheme; label: string; bg: string; text: string }[] = [
  { id: 'light', label: 'Sáng', bg: '#ffffff', text: '#1a1a2e' },
  { id: 'sepia', label: 'Sepia', bg: '#f4ecd8', text: '#5c4033' },
  { id: 'dark', label: 'Tối', bg: '#1a1a2e', text: '#e8e6e3' },
  { id: 'amoled', label: 'Đen', bg: '#000000', text: '#cccccc' },
];

export function ReaderSettings({ isOpen, onClose }: ReaderSettingsProps) {
  const { theme, fontSize, setTheme, setFontSize } = useReaderStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-yellow-500" /> Cài Đặt Giao Diện Đọc
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded-lg hover:bg-zinc-800"
          >
            Đóng
          </button>
        </div>

        {/* Theme selection */}
        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-3">
            Chủ Đề (Theme)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col items-center justify-center h-14 rounded-xl border text-xs font-medium transition-all ${
                  theme === t.id
                    ? 'border-yellow-500 ring-2 ring-yellow-500/20'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                style={{ backgroundColor: t.bg, color: t.text }}
              >
                <span>{t.label}</span>
                {theme === t.id && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-yellow-500 text-black flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Font size slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Cỡ Chữ
            </label>
            <span className="text-xs font-bold text-yellow-500">{fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">A-</span>
            <input
              type="range"
              min="14"
              max="26"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="flex-1 accent-yellow-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <span className="text-base text-zinc-300 font-bold">A+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
