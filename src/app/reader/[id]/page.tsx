'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { Book } from 'epubjs';
import {
  ArrowLeft,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import { fetchNovelById, fetchNovelBinary } from '@/lib/supabase/queries';
import { parseEpubFile, getChapterText } from '@/lib/epub/epub-parser';
import { normalizeText, splitIntoSentences } from '@/lib/tts/text-normalizer';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { useTTS } from '@/hooks/use-tts';
import { Novel, ChapterItem } from '@/types';

import { EpubViewer } from '@/components/reader/epub-viewer';
import { TTSPlayerBar } from '@/components/reader/tts-player-bar';
import { ChapterSidebar } from '@/components/reader/chapter-sidebar';
import { ReaderSettings } from '@/components/reader/reader-settings';
import { ModelLoader } from '@/components/reader/model-loader';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReaderPage({ params }: PageProps) {
  const { id } = use(params);

  const [novel, setNovel] = useState<Novel | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { progress, updateProgress } = useReadingProgress(id);
  const { playChapter, currentSentenceIndex } = useTTS();

  // 1. Fetch novel data & parse EPUB ArrayBuffer
  useEffect(() => {
    let isMounted = true;

    async function loadNovelAndEpub() {
      try {
        setIsLoading(true);
        const data = await fetchNovelById(id);
        if (!data) {
          if (isMounted) setErrorMessage('Không tìm thấy thông tin truyện');
          return;
        }
        if (isMounted) setNovel(data);

        // Fetch EPUB file ArrayBuffer (handles both IndexedDB local storage & Supabase URLs)
        const buffer = await fetchNovelBinary(data);


        const { book: epubBook, metadata } = await parseEpubFile(buffer);

        if (isMounted) {
          setBook(epubBook);
          setChapters(metadata.chapters);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error loading EPUB:', err);
        const msg = err instanceof Error ? err.message : 'Lỗi đọc tệp EPUB';
        if (isMounted) {
          setErrorMessage(msg);
          setIsLoading(false);
        }
      }
    }

    loadNovelAndEpub();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Restore saved chapter index when progress loads
  useEffect(() => {
    if (progress && progress.chapter_index) {
      setCurrentChapterIndex(progress.chapter_index);
    }
  }, [progress]);

  // Load chapter text and start TTS playback
  const handleStartTTSForCurrentChapter = useCallback(async () => {
    if (!book || chapters.length === 0) return;
    const currentChap = chapters[currentChapterIndex];
    if (!currentChap) return;

    const rawText = await getChapterText(book, currentChap.href);
    const cleanedText = normalizeText(rawText);
    const sentences = splitIntoSentences(cleanedText);

    if (sentences.length > 0) {
      playChapter(sentences, 0, currentChap.title);
    }
  }, [book, chapters, currentChapterIndex, playChapter]);

  // Handle location/CFI changes from reader viewer
  const handleLocationChange = (cfi: string) => {
    updateProgress(cfi, currentChapterIndex, currentSentenceIndex);
  };

  const handleSelectChapter = (chap: ChapterItem) => {
    setCurrentChapterIndex(chap.index);
    updateProgress(null, chap.index, 0, true);
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      const prevChap = chapters[currentChapterIndex - 1];
      handleSelectChapter(prevChap);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      const nextChap = chapters[currentChapterIndex + 1];
      handleSelectChapter(nextChap);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 gap-3">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        <p className="text-sm font-medium text-zinc-400">Đang chuẩn bị cuốn sách của bạn...</p>
      </div>
    );
  }

  if (errorMessage || !novel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 px-4 text-center">
        <p className="text-red-400 font-bold mb-4">{errorMessage || 'Đã có lỗi xảy ra'}</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold hover:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại thư viện
        </Link>
      </div>
    );
  }

  const currentChapter = chapters[currentChapterIndex];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 pb-28">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              title="Về thư viện"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-100 truncate">{novel.title}</h1>
              <p className="text-[11px] text-yellow-500 truncate">
                {currentChapter ? currentChapter.title : 'Nội dung truyện'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-yellow-400 hover:border-yellow-500/30 transition-all"
            >
              <List className="w-4 h-4 text-yellow-500" />
              <span className="hidden sm:inline">Mục lục</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-all"
              title="Cài đặt giao diện"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main EPUB Reader Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* Navigation pagination bar */}
        <div className="flex items-center justify-between mb-4 text-xs font-medium text-zinc-400">
          <button
            onClick={handlePrevChapter}
            disabled={currentChapterIndex <= 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 hover:text-zinc-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Chương trước
          </button>

          <span>
            Chương {currentChapterIndex + 1} / {chapters.length}
          </span>

          <button
            onClick={handleNextChapter}
            disabled={currentChapterIndex >= chapters.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 hover:text-zinc-100 disabled:opacity-30"
          >
            Chương sau <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* EPUB Viewer Component */}
        <div className="flex-1 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <EpubViewer
            book={book}
            currentChapterHref={currentChapter?.href}
            initialCfi={progress?.location_cfi}
            onLocationChange={handleLocationChange}
          />
        </div>
      </main>

      {/* Chapter Navigation Sidebar Drawer */}
      <ChapterSidebar
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectChapter={handleSelectChapter}
      />

      {/* Settings Modal */}
      <ReaderSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* AI Model Loading Progress Toast */}
      <ModelLoader />

      {/* Sticky Audio Player Bar */}
      <TTSPlayerBar onPlayChapter={handleStartTTSForCurrentChapter} />
    </div>
  );
}
