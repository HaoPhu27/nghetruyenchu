'use client';

import React from 'react';
import { BookOpen, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyLibraryProps {
  onUploadClick: () => void;
}

export function EmptyLibrary({ onUploadClick }: EmptyLibraryProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40 p-12">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 mb-6 ring-8 ring-yellow-500/5">
        <BookOpen className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-zinc-100 mb-2">Thư viện của bạn đang trống</h3>
      <p className="text-zinc-400 max-w-md mb-8 text-sm leading-relaxed">
        Tải lên file sách EPUB để trải nghiệm đọc và nghe truyện AI offline với giọng đọc Ngọc Huyền mượt mà.
      </p>
      <Button
        onClick={onUploadClick}
        size="lg"
        className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-lg shadow-yellow-500/20 rounded-full px-8 gap-2"
      >
        <Upload className="w-5 h-5" />
        Thêm Truyện Mới
      </Button>
    </div>
  );
}
