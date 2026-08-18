import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchReadingProgress, saveReadingProgress } from '@/lib/supabase/queries';
import { UserProgress } from '@/types';

const SESSION_PROGRESS_PREFIX = 'reader_session_';

export function getSessionProgress(novelId: string): UserProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PROGRESS_PREFIX}${novelId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSessionProgress(novelId: string, progress: UserProgress): void {
  if (typeof window === 'undefined') return null as unknown as void;
  try {
    sessionStorage.setItem(`${SESSION_PROGRESS_PREFIX}${novelId}`, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function useReadingProgress(novelId: string) {
  const [progress, setProgress] = useState<UserProgress | null>(() => getSessionProgress(novelId));
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestProgressRef = useRef<UserProgress | null>(progress);

  latestProgressRef.current = progress;

  // Load progress on mount (Session first, then LocalStorage / Supabase)
  useEffect(() => {
    if (!novelId) return;

    let isMounted = true;
    const sessionData = getSessionProgress(novelId);
    if (sessionData && isMounted) {
      setProgress(sessionData);
      setIsLoading(false);
    }

    fetchReadingProgress(novelId)
      .then((data) => {
        if (isMounted) {
          // If session data exists, session has highest priority for the current active tab
          if (sessionData) {
            setProgress((prev) => prev || sessionData);
          } else if (data) {
            setProgress(data);
            setSessionProgress(novelId, data);
          }
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

  // Flush progress before unload / visibility loss
  useEffect(() => {
    if (!novelId) return;

    const flush = () => {
      if (latestProgressRef.current) {
        const p = latestProgressRef.current;
        setSessionProgress(novelId, p);
        saveReadingProgress(novelId, p.location_cfi, p.chapter_index, p.tts_sentence_index);
      }
    };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return () => {
      window.removeEventListener('beforeunload', flush);
    };
  }, [novelId]);

  // Update progress (synchronous local session storage + debounced cloud/local persistent storage)
  const updateProgress = useCallback(
    (locationCfi: string | null, chapterIndex: number, sentenceIndex = 0, immediate = false) => {
      const updated_at = new Date().toISOString();
      const updatedData: UserProgress = {
        user_id: latestProgressRef.current?.user_id || 'guest',
        novel_id: novelId,
        location_cfi: locationCfi ?? latestProgressRef.current?.location_cfi ?? null,
        chapter_index: chapterIndex,
        tts_sentence_index: sentenceIndex,
        updated_at,
      };

      // 1. Update state & SessionStorage immediately
      setProgress(updatedData);
      setSessionProgress(novelId, updatedData);

      // 2. Debounce cloud/localStorage sync
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (immediate) {
        saveReadingProgress(novelId, updatedData.location_cfi, chapterIndex, sentenceIndex);
      } else {
        saveTimeoutRef.current = setTimeout(() => {
          saveReadingProgress(novelId, updatedData.location_cfi, chapterIndex, sentenceIndex);
        }, 1500); // 1.5s debounce for persistent storage
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
