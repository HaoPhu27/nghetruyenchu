'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Headphones, Play } from 'lucide-react';
import { Novel } from '@/types';
import { resolveCoverUrl } from '@/lib/supabase/queries';

interface NovelCardProps {
  novel: Novel;
}

export function NovelCard({ novel }: NovelCardProps) {
  const [displayCover, setDisplayCover] = useState<string | undefined>(novel.cover_url);

  useEffect(() => {
    let isMounted = true;
    if (novel.cover_url && novel.cover_url.startsWith('indexeddb://')) {
      resolveCoverUrl(novel.cover_url).then((url) => {
        if (isMounted && url) setDisplayCover(url);
      });
    } else {
      setDisplayCover(novel.cover_url);
    }
    return () => {
      isMounted = false;
    };
  }, [novel.cover_url]);

  return (
    <div className="group relative flex flex-col bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/5">
      {/* Cover Image Container */}
      <div className="relative aspect-[3/4] w-full bg-zinc-950 overflow-hidden">
        {displayCover ? (
          <Image
            src={displayCover}
            alt={novel.title}
            fill
            unoptimized={displayCover.startsWith('blob:')}
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-900 via-zinc-950 to-yellow-950/20 text-center">
            <BookOpen className="w-12 h-12 text-zinc-700 mb-3 group-hover:text-yellow-500/60 transition-colors" />
            <span className="text-xs text-zinc-500 font-serif line-clamp-3 italic">
              {novel.title}
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
          <Link
            href={`/reader/${novel.id}`}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 text-black font-semibold hover:scale-110 transition-transform shadow-lg shadow-yellow-500/30"
            title="Bắt đầu đọc / nghe"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </Link>
        </div>

        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
          <Headphones className="w-3 h-3" /> AI TTS
        </div>
      </div>

      {/* Novel Info */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-bold text-zinc-100 text-base line-clamp-2 leading-snug group-hover:text-yellow-400 transition-colors">
          {novel.title}
        </h3>
        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
          {novel.author || 'Chưa rõ tác giả'}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/60">
          <span>{novel.chapter_count ? `${novel.chapter_count} chương` : 'File EPUB'}</span>
          <Link
            href={`/reader/${novel.id}`}
            className="text-yellow-500 hover:underline font-medium"
          >
            Đọc tiếp →
          </Link>
        </div>
      </div>
    </div>
  );
}
