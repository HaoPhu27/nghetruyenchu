import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchReadingProgress, saveReadingProgress } from '@/lib/supabase/queries';
import { UserProgress } from '@/types';

export function useReadingProgress(novelId: string) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!novelId) return;

    let isMounted = true;
    fetchReadingProgress(novelId)
      .then((data) => {
        if (isMounted) {
          setProgress(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error reading progress:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [novelId]);

  // Debounce saving progress to Supabase/localStorage
  const updateProgress = useCallback(
    (locationCfi: string | null, chapterIndex: number, sentenceIndex = 0, immediate = false) => {
      setProgress((prev) => ({
        user_id: prev?.user_id || 'guest',
        novel_id: novelId,
        location_cfi: locationCfi,
        chapter_index: chapterIndex,
        tts_sentence_index: sentenceIndex,
      }));

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (immediate) {
        saveReadingProgress(novelId, locationCfi, chapterIndex, sentenceIndex);
      } else {
        saveTimeoutRef.current = setTimeout(() => {
          saveReadingProgress(novelId, locationCfi, chapterIndex, sentenceIndex);
        }, 15000); // 15s debounce
      }
    },
    [novelId]
  );

  return {
    progress,
    isLoading,
    updateProgress,
  };
}
