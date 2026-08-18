import ePub, { Book, NavItem } from 'epubjs';
import '@/lib/epub/epub-patch';
import { ParsedBook, ChapterItem } from '@/types';

export async function parseEpubFile(fileBuffer: ArrayBuffer): Promise<{
  book: Book;
  metadata: ParsedBook;
}> {
  const book = ePub(fileBuffer);
  await book.ready;

  // Patch book.spine.get to be resilient to relative paths (e.g. "../Text/C1.xhtml"), fragments, and filename lookups
  if (book.spine) {
    const originalSpineGet = book.spine.get.bind(book.spine);
    book.spine.get = function (target: string | number) {
      if (typeof target === 'undefined' || target === null) return originalSpineGet(target);

      let section = originalSpineGet(target);
      if (section) return section;

      if (typeof target === 'string') {
        const clean = target.split('?')[0].split('#')[0].replace(/^(\.\.\/|\.\/|\/)+/, '');
        section = originalSpineGet(clean);
        if (section) return section;

        const filename = clean.split('/').pop();
        if (filename) {
          const found = this.spineItems.find(
            (s: any) =>
              s.href === filename ||
              s.href?.endsWith('/' + filename) ||
              s.idref === filename ||
              s.idref === filename.replace(/\.[^/.]+$/, '')
          );
          if (found) return found;
        }

        try {
          const decoded = decodeURIComponent(clean);
          section = originalSpineGet(decoded);
          if (section) return section;
        } catch {}
      }

      return null;
    };
  }

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

    let doc: Document | null = null;
    if (typeof loadedSection === 'string') {
      doc = new DOMParser().parseFromString(loadedSection, 'text/html');
    } else if (typeof document !== 'undefined') {
      if (loadedSection instanceof Document) {
        doc = loadedSection;
      } else if ((loadedSection as Element)?.outerHTML) {
        doc = new DOMParser().parseFromString((loadedSection as Element).outerHTML, 'text/html');
      }
    }

    if (doc) {
      // Remove scripts and styles
      doc.querySelectorAll('script, style, head').forEach((el) => el.remove());
      const raw = doc.body?.textContent || doc.body?.innerText || doc.documentElement?.textContent || '';
      return raw.trim();
    }

    return '';
  } catch (error) {
    console.error('Error fetching chapter text:', error);
    return '';
  }
}
