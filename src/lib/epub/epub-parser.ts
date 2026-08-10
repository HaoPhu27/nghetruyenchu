import ePub, { Book, NavItem } from 'epubjs';
import { ParsedBook, ChapterItem } from '@/types';

export async function parseEpubFile(fileBuffer: ArrayBuffer): Promise<{
  book: Book;
  metadata: ParsedBook;
}> {
  const book = ePub(fileBuffer);
  await book.ready;

  const meta = await book.loaded.metadata;
  const navigation = await book.loaded.navigation;

  // Extract cover image if available
  let coverBlob: Blob | null = null;
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const response = await fetch(coverUrl);
      if (response.ok) {
        coverBlob = await response.blob();
      }
    }
  } catch (err) {
    console.warn('Could not extract EPUB cover image:', err);
  }

  // Build chapters list from TOC
  const chapters: ChapterItem[] = [];
  let index = 0;

  function processNavItems(items: NavItem[]) {
    for (const item of items) {
      chapters.push({
        id: item.id || `chap-${index}`,
        title: item.label ? item.label.trim() : `Chương ${index + 1}`,
        index,
        href: item.href,
      });
      index++;
      if (item.subitems && item.subitems.length > 0) {
        processNavItems(item.subitems);
      }
    }
  }

  if (navigation && navigation.toc) {
    processNavItems(navigation.toc);
  }

  // Fallback if no TOC found: iterate spine
  if (chapters.length === 0 && book.spine) {
    const spineItems = (book.spine as unknown as { items: Array<{ idref?: string; href?: string }> }).items || [];
    spineItems.forEach((item, idx: number) => {
      chapters.push({
        id: item.idref || `chap-${idx}`,
        title: `Chương ${idx + 1}`,
        index: idx,
        href: item.href || '',
      });
    });
  }

  return {
    book,
    metadata: {
      title: meta.title || 'Truyện không tên',
      author: meta.creator || 'Chưa rõ tác giả',
      coverBlob,
      chapters,
    },
  };
}

// Helper to extract plain text of a chapter from EPUB section for TTS processing
export async function getChapterText(book: Book, href: string): Promise<string> {
  try {
    const section = book.spine.get(href);
    if (!section) return '';

    const loadedSection = await section.load(book.load.bind(book));
    if (!loadedSection) return '';

    // Create temporary element to parse DOM and extract text
    if (typeof document !== 'undefined') {
      const htmlContent = typeof loadedSection === 'string' ? loadedSection : (loadedSection as unknown as Element).outerHTML || '';
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    }
    return '';
  } catch (error) {
    console.error('Error fetching chapter text:', error);
    return '';
  }
}
