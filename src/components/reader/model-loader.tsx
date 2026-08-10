'use client';

import React from 'react';
import { Loader2, Headphones, AlertTriangle } from 'lucide-react';
import { useTTSStore } from '@/lib/store/tts-store';

export function ModelLoader() {
  const { modelStatus, modelProgress, errorMessage } = useTTSStore();

  if (modelStatus === 'ready' || modelStatus === 'unloaded') return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 max-w-sm w-full bg-zinc-900/95 border border-zinc-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
      {modelStatus === 'loading' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-500 shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-200 mb-1">
              <span className="flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5 text-yellow-500" /> Tải giọng đọc Ngọc Huyền AI
              </span>
              <span className="text-yellow-500">{modelProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Lần đầu tải ~63MB, các lần sau sẽ mở tức thì.</p>
          </div>
        </div>
      )}

      {modelStatus === 'error' && (
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 text-red-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-red-400">Không thể tải giọng đọc AI</p>
            <p className="text-zinc-400 mt-0.5">{errorMessage || 'Vui lòng kiểm tra lại kết nối mạng.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
