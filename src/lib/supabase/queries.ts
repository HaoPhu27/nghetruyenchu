import { createClient } from './client';
import { Novel, UserProgress } from '@/types';
import { saveLocalFile, getLocalFile } from '@/lib/storage/indexed-db';

const LOCAL_STORAGE_NOVELS_KEY = 'nghetruyenchu_local_novels';
const LOCAL_STORAGE_PROGRESS_KEY = 'nghetruyenchu_local_progress';

// Helper for local storage fallback when Supabase credentials aren't set
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
}

export async function fetchNovelList(): Promise<Novel[]> {
  if (!isSupabaseConfigured()) {
    if (typeof window === 'undefined') return [];
    const local = localStorage.getItem(LOCAL_STORAGE_NOVELS_KEY);
    return local ? JSON.parse(local) : [];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('novels')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch error, fallback to local:', error);
    const local = localStorage.getItem(LOCAL_STORAGE_NOVELS_KEY);
    return local ? JSON.parse(local) : [];
  }

  return data as Novel[];
}

export async function fetchNovelById(id: string): Promise<Novel | null> {
  if (!isSupabaseConfigured()) {
    const local = localStorage.getItem(LOCAL_STORAGE_NOVELS_KEY);
    const novels: Novel[] = local ? JSON.parse(local) : [];
    return novels.find((n) => n.id === id) || null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('novels')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    const local = localStorage.getItem(LOCAL_STORAGE_NOVELS_KEY);
    const novels: Novel[] = local ? JSON.parse(local) : [];
    return novels.find((n) => n.id === id) || null;
  }

  return data as Novel;
}

export async function uploadNovel(
  file: File,
  meta: { title: string; author?: string; coverBlob?: Blob | null; chapterCount?: number }
): Promise<Novel> {
  const fileId = crypto.randomUUID();

  if (!isSupabaseConfigured()) {
    // Save raw file in IndexedDB for permanent local storage across reloads
    await saveLocalFile(fileId, file);

    let coverUrl: string | undefined = undefined;
    if (meta.coverBlob) {
      const coverId = `cover_${fileId}`;
      await saveLocalFile(coverId, meta.coverBlob);
      coverUrl = `indexeddb://${coverId}`;
    }

    const newNovel: Novel = {
      id: fileId,
      title: meta.title || file.name.replace(/\.epub$/i, ''),
      author: meta.author || 'Chưa rõ',
      cover_url: coverUrl,
      file_url: `indexeddb://${fileId}`,
      file_size: file.size,
      chapter_count: meta.chapterCount || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const local = localStorage.getItem(LOCAL_STORAGE_NOVELS_KEY);
    const novels: Novel[] = local ? JSON.parse(local) : [];
    novels.unshift(newNovel);
    localStorage.setItem(LOCAL_STORAGE_NOVELS_KEY, JSON.stringify(novels));

    return newNovel;
  }

  const supabase = createClient();
  const fileExt = file.name.split('.').pop();
  const storageFilePath = `${fileId}.${fileExt}`;

  // 1. Upload EPUB to Supabase storage 'novels' bucket
  const { error: uploadError } = await supabase.storage
    .from('novels')
    .upload(storageFilePath, file, {
      contentType: 'application/epub+zip',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: fileData } = supabase.storage
    .from('novels')
    .getPublicUrl(storageFilePath);

  let coverUrl: string | undefined = undefined;

  // 2. Upload cover if available to 'covers' bucket
  if (meta.coverBlob) {
    const coverPath = `${fileId}.jpg`;
    const { error: coverError } = await supabase.storage
      .from('covers')
      .upload(coverPath, meta.coverBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (!coverError) {
      const { data: cData } = supabase.storage
        .from('covers')
        .getPublicUrl(coverPath);
      coverUrl = cData.publicUrl;
    }
  }

  // 3. Insert record into novels table
  const newNovel: Partial<Novel> = {
    id: fileId,
    title: meta.title || file.name.replace(/\.epub$/i, ''),
    author: meta.author || 'Chưa rõ',
    cover_url: coverUrl,
    file_url: fileData.publicUrl,
    file_size: file.size,
    chapter_count: meta.chapterCount || 0,
  };

  const { data, error } = await supabase
    .from('novels')
    .insert(newNovel)
    .select()
    .single();

  if (error) throw error;
  return data as Novel;
}

// Universal binary fetcher: retrieves ArrayBuffer from IndexedDB (local mode) or HTTP URL (Supabase)
export async function fetchNovelBinary(novel: Novel): Promise<ArrayBuffer> {
  if (novel.file_url.startsWith('indexeddb://') || !isSupabaseConfigured()) {
    const localData = await getLocalFile(novel.id);
    if (localData) {
      if (localData instanceof ArrayBuffer) return localData;
      if (localData instanceof Blob) return await localData.arrayBuffer();
    }
  }

  const response = await fetch(novel.file_url);
  if (!response.ok) throw new Error('Không thể tải tệp EPUB');
  return await response.arrayBuffer();
}

// Universal cover URL resolver
export async function resolveCoverUrl(coverUrl?: string): Promise<string | undefined> {
  if (!coverUrl) return undefined;
  if (coverUrl.startsWith('indexeddb://')) {
    const coverId = coverUrl.replace('indexeddb://', '');
    const data = await getLocalFile(coverId);
    if (data instanceof Blob) {
      return URL.createObjectURL(data);
    }
  }
  return coverUrl;
}

export async function saveReadingProgress(
  novelId: string,
  locationCfi: string | null,
  chapterIndex: number,
  sentenceIndex: number = 0
): Promise<void> {
  const updated_at = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const local = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    const progressMap: Record<string, UserProgress> = local ? JSON.parse(local) : {};
    progressMap[novelId] = {
      user_id: 'local_user',
      novel_id: novelId,
      location_cfi: locationCfi,
      chapter_index: chapterIndex,
      tts_sentence_index: sentenceIndex,
      updated_at,
    };
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progressMap));
    return;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    const local = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    const progressMap: Record<string, UserProgress> = local ? JSON.parse(local) : {};
    progressMap[novelId] = {
      user_id: 'guest',
      novel_id: novelId,
      location_cfi: locationCfi,
      chapter_index: chapterIndex,
      tts_sentence_index: sentenceIndex,
      updated_at,
    };
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progressMap));
    return;
  }

  await supabase.from('user_progress').upsert({
    user_id: userId,
    novel_id: novelId,
    location_cfi: locationCfi,
    chapter_index: chapterIndex,
    tts_sentence_index: sentenceIndex,
    updated_at,
  });
}

export async function fetchReadingProgress(novelId: string): Promise<UserProgress | null> {
  if (!isSupabaseConfigured()) {
    const local = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    const progressMap: Record<string, UserProgress> = local ? JSON.parse(local) : {};
    return progressMap[novelId] || null;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    const local = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    const progressMap: Record<string, UserProgress> = local ? JSON.parse(local) : {};
    return progressMap[novelId] || null;
  }

  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('novel_id', novelId)
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data as UserProgress;
}
