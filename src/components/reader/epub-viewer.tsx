'use client';

import React, { useEffect, useRef } from 'react';
import { Book, Rendition } from 'epubjs';
import '@/lib/epub/epub-patch';
import { useReaderStore } from '@/lib/store/reader-store';
import { useTTSStore } from '@/lib/store/tts-store';

interface EpubViewerProps {
  book: Book | null;
  currentChapterHref?: string;
  initialCfi?: string | null;
  onLocationChange?: (cfi: string) => void;
  onSectionDisplayed?: (href: string) => void;
}

const themeColors: Record<string, { bg: string; text: string }> = {
  light: { bg: '#ffffff', text: '#1a1a2e' },
  sepia: { bg: '#f4ecd8', text: '#5c4033' },
  dark: { bg: '#1a1a2e', text: '#e8e6e3' },
  amoled: { bg: '#000000', text: '#cccccc' },
};

export function EpubViewer({
  book,
  currentChapterHref,
  initialCfi,
  onLocationChange,
  onSectionDisplayed,
}: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const prevChapterHrefRef = useRef<string | undefined>(undefined);
  const { theme, fontSize } = useReaderStore();
  const { currentSentenceIndex, sentences } = useTTSStore();

  const themeRef = useRef(theme);
  const fontSizeRef = useRef(fontSize);
  themeRef.current = theme;
  fontSizeRef.current = fontSize;

  const onSectionDisplayedRef = useRef(onSectionDisplayed);
  onSectionDisplayedRef.current = onSectionDisplayed;

  // Initialize EPUB rendition
  useEffect(() => {
    if (!book || !viewerRef.current) return;

    let isMounted = true;
    const container = viewerRef.current;
    container.innerHTML = '';

    let rendition: Rendition | null = null;

    try {
      rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        flow: 'scrolled-doc', // Continuous scroll mode
      });
      renditionRef.current = rendition;

      // Inject custom styling to iframe on content render
      rendition.hooks.content.register((contents: any) => {
        if (!isMounted) return;
        const doc = contents.document;
        if (!doc) return;

        const currentTheme = themeRef.current;
        const currentSize = fontSizeRef.current;
        const colors = themeColors[currentTheme] || themeColors.dark;

        const style = doc.createElement('style');
        style.id = 'epub-reader-custom-theme';
        style.innerHTML = `
          html, body {
            background-color: ${colors.bg} !important;
            color: ${colors.text} !important;
            font-family: var(--font-sans), system-ui, -apple-system, sans-serif !important;
            font-size: ${currentSize}px !important;
            line-height: 1.8 !important;
            padding: 24px 28px !important;
            margin: 0 !important;
            word-break: break-word !important;
          }
          p, div, span, h1, h2, h3, h4, h5, h6, li {
            color: ${colors.text} !important;
            background-color: transparent !important;
          }
          a {
            color: #eab308 !important;
            text-decoration: underline;
            cursor: pointer;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
            margin: 16px auto !important;
            display: block !important;
            border-radius: 8px;
          }
          .tts-highlight {
            background-color: rgba(234, 179, 8, 0.35) !important;
            border-radius: 4px;
            padding: 2px 4px;
          }
        `;
        doc.head.appendChild(style);

        // Intercept relative chapter clicks inside the chapter text
        doc.querySelectorAll('a').forEach((anchor: HTMLAnchorElement) => {
          anchor.addEventListener('click', (e) => {
            const rawHref = anchor.getAttribute('href');
            if (rawHref && !rawHref.startsWith('http') && !rawHref.startsWith('//')) {
              e.preventDefault();
              if (renditionRef.current) {
                renditionRef.current.display(rawHref).catch(() => {});
              }
            }
          });
        });
      });

      // Track section displayed
      rendition.on('displayed', (section: any) => {
        if (isMounted && section?.href && onSectionDisplayedRef.current) {
          onSectionDisplayedRef.current(section.href);
        }
      });

      // Apply initial display
      const target = currentChapterHref || initialCfi;
      prevChapterHrefRef.current = currentChapterHref;
      if (target) {
        rendition.display(target).catch((err) => {
          console.warn('Initial display fallback:', err);
          if (isMounted && rendition) {
            rendition.display().catch(() => {});
          }
        });
      } else {
        rendition.display().catch((err) => console.warn('Display error:', err));
      }

      rendition.on('relocated', (location: { start: { cfi: string } }) => {
        if (isMounted && location?.start?.cfi && onLocationChange) {
          onLocationChange(location.start.cfi);
        }
      });
    } catch (err) {
      console.error('Error rendering book:', err);
    }

    return () => {
      isMounted = false;
      if (rendition) {
        try {
          rendition.destroy();
        } catch {}
      }
      renditionRef.current = null;
    };
  }, [book]);

  // Navigate to new chapter when currentChapterHref changes
  useEffect(() => {
    if (!renditionRef.current || !currentChapterHref) return;
    if (prevChapterHrefRef.current === currentChapterHref) return;
    prevChapterHrefRef.current = currentChapterHref;

    renditionRef.current.display(currentChapterHref).catch((err) => {
      console.warn(`Failed to display chapter ${currentChapterHref}:`, err);
    });
  }, [currentChapterHref]);

  // Apply theme & font size updates dynamically
  useEffect(() => {
    if (!renditionRef.current) return;

    const colors = themeColors[theme] || themeColors.dark;

    try {
      renditionRef.current.themes.default({
        '*': {
          color: `${colors.text} !important`,
        },
        body: {
          background: `${colors.bg} !important`,
          color: `${colors.text} !important`,
          'font-size': `${fontSize}px !important`,
        },
      });

      const getContentsFn = (renditionRef.current as any).getContents;
      const contents = getContentsFn ? getContentsFn.call(renditionRef.current) : [];
      for (const content of contents) {
        const doc = content.document;
        if (doc) {
          let styleEl = doc.getElementById('epub-reader-custom-theme');
          if (!styleEl) {
            styleEl = doc.createElement('style');
            styleEl.id = 'epub-reader-custom-theme';
            doc.head.appendChild(styleEl);
          }
          styleEl.innerHTML = `
            html, body {
              background-color: ${colors.bg} !important;
              color: ${colors.text} !important;
              font-family: var(--font-sans), system-ui, -apple-system, sans-serif !important;
              font-size: ${fontSize}px !important;
              line-height: 1.8 !important;
              padding: 24px 28px !important;
              margin: 0 !important;
              word-break: break-word !important;
            }
            p, div, span, h1, h2, h3, h4, h5, h6, li {
              color: ${colors.text} !important;
              background-color: transparent !important;
            }
            a {
              color: #eab308 !important;
              text-decoration: underline;
            }
            .tts-highlight {
              background-color: rgba(234, 179, 8, 0.35) !important;
              border-radius: 4px;
              padding: 2px 4px;
            }
          `;
        }
      }
    } catch (e) {
      console.warn('Failed to update reader theme:', e);
    }
  }, [theme, fontSize]);

  // Highlight current sentence being spoken
  useEffect(() => {
    if (!renditionRef.current || !sentences[currentSentenceIndex]) return;

    const sentenceText = sentences[currentSentenceIndex];

    try {
      const getContentsFn = (renditionRef.current as any).getContents;
      const contents = getContentsFn ? getContentsFn.call(renditionRef.current) : [];
      for (const content of contents) {
        const doc = content.document as Document;
        if (!doc) continue;

        // Clear previous highlights
        const oldHighlights = doc.querySelectorAll('.tts-highlight');
        oldHighlights.forEach((el) => {
          const parent = el.parentNode;
          if (parent) {
            parent.replaceChild(doc.createTextNode(el.textContent || ''), el);
            parent.normalize();
          }
        });

        // Search text node and wrap in span.tts-highlight
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && node.nodeValue.includes(sentenceText.slice(0, 20))) {
            const span = doc.createElement('span');
            span.className = 'tts-highlight';
            span.style.backgroundColor = 'rgba(234, 179, 8, 0.35)';
            span.style.borderRadius = '4px';
            span.style.padding = '2px 4px';

            const parent = node.parentNode;
            if (parent) {
              span.textContent = node.nodeValue;
              parent.replaceChild(span, node);
              span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          }
        }
      }
    } catch (e) {
      // ignore DOM highlight errors
    }
  }, [currentSentenceIndex, sentences]);

  return (
    <div
      className={`w-full h-full min-h-[70vh] rounded-2xl overflow-hidden transition-colors duration-300 ${
        theme === 'light'
          ? 'theme-light'
          : theme === 'sepia'
          ? 'theme-sepia'
          : theme === 'amoled'
          ? 'theme-amoled'
          : 'theme-dark'
      }`}
    >
      <div ref={viewerRef} className="w-full h-full" />
    </div>
  );
}
