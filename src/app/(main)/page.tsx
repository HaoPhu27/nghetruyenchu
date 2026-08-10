'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NovelCard } from '@/components/library/novel-card';
import { EmptyLibrary } from '@/components/library/empty-library';
import { UploadDialog } from '@/components/library/upload-dialog';
import { fetchNovelList } from '@/lib/supabase/queries';
import { Novel } from '@/types';

export default function LibraryPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const loadNovels = async () => {
    setIsLoading(true);
    try {
      const data = await fetchNovelList();
      setNovels(data);
    } catch (err) {
      console.error('Error fetching library:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNovels();
  }, []);

  const handleNovelAdded = (newNovel: Novel) => {
    setNovels((prev) => [newNovel, ...prev]);
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Thư Viện Sách
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Quản lý và nghe lại các bộ truyện EPUB của bạn với giọng đọc AI offline
          </p>
        </div>

        <Button
          onClick={() => setIsUploadOpen(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-lg shadow-yellow-500/20 rounded-xl gap-2 self-start sm:self-auto px-5"
        >
          <Plus className="w-5 h-5" />
          Thêm Truyện Mới
        </Button>
      </div>

      {/* Novel grid or loading / empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        </div>
      ) : novels.length === 0 ? (
        <EmptyLibrary onUploadClick={() => setIsUploadOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {novels.map((novel) => (
            <NovelCard key={novel.id} novel={novel} />
          ))}
        </div>
      )}

      {/* Upload Dialog Modal */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleNovelAdded}
      />
    </div>
  );
}
