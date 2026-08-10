'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseEpubFile } from '@/lib/epub/epub-parser';
import { uploadNovel } from '@/lib/supabase/queries';
import { Novel } from '@/types';

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newNovel: Novel) => void;
}

export function UploadDialog({ isOpen, onClose, onSuccess }: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setErrorMessage('Chỉ chấp nhận tệp định dạng .epub');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      setStatusMessage('Đang đọc và phân tích file EPUB...');
      const buffer = await file.arrayBuffer();
      const { metadata } = await parseEpubFile(buffer);

      setStatusMessage('Đang tải tệp lên và tạo bản ghi...');
      const createdNovel = await uploadNovel(file, {
        title: metadata.title,
        author: metadata.author,
        coverBlob: metadata.coverBlob,
        chapterCount: metadata.chapters.length,
      });

      setStatusMessage('Thành công!');
      onSuccess(createdNovel);
      onClose();
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi xử lý file EPUB';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-yellow-500" />
            Tải Lên Truyện EPUB
          </h3>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`mt-6 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
            isDragging
              ? 'border-yellow-500 bg-yellow-500/10 scale-[0.99]'
              : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'
          } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".epub"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
              <p className="text-sm font-medium text-zinc-300">{statusMessage}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Kéo thả file <span className="text-yellow-500 font-semibold">.epub</span> vào đây
                </p>
                <p className="text-xs text-zinc-500 mt-1">hoặc nhấn để duyệt tệp từ máy tính</p>
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
            className="text-zinc-400 hover:text-zinc-100"
          >
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
}
