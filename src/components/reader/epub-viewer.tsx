'use client';

import React, { useEffect, useRef } from 'react';
import { Book, Rendition } from 'epubjs';
import { useReaderStore } from '@/lib/store/reader-store';
import { useTTSStore } from '@/lib/store/tts-store';

interface EpubViewerProps {
  book: Book | null;
  initialCfi?: string | null;
  onLocationChange?: (cfi: string) => void;
}

export function EpubViewer({ book, initialCfi, onLocationChange }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const { theme, fontSize } = useReaderStore();
  const { currentSentenceIndex, sentences } = useTTSStore();

  // Initialize EPUB rendition
  useEffect(() => {
    if (!book || !viewerRef.current) return;

    viewerRef.current.innerHTML = '';

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc', // Continuous scroll mode for seamless novel reading
    });

    renditionRef.current = rendition;

    if (initialCfi) {
      rendition.display(initialCfi);
    } else {
      rendition.display();
    }

    rendition.on('relocated', (location: { start: { cfi: string } }) => {
      if (location && location.start && onLocationChange) {
        onLocationChange(location.start.cfi);
      }
    });

    return () => {
      rendition.destroy();
    };
  }, [book, initialCfi, onLocationChange]);

  // Apply theme & font size updates
  useEffect(() => {
    if (!renditionRef.current) return;

    const themeColors: Record<string, { bg: string; text: string }> = {
      light: { bg: '#ffffff', text: '#1a1a2e' },
      sepia: { bg: '#f4ecd8', text: '#5c4033' },
      dark: { bg: '#1a1a2e', text: '#e8e6e3' },
      amoled: { bg: '#000000', text: '#cccccc' },
    };

    const currentColors = themeColors[theme] || themeColors.dark;

    renditionRef.current.themes.default({
      body: {
        background: `${currentColors.bg} !important`,
        color: `${currentColors.text} !important`,
        'font-family': 'var(--font-serif), Georgia, serif !important',
        'font-size': `${fontSize}px !important`,
        'line-height': '1.7 !important',
        padding: '20px 40px !important',
      },
      p: {
        'margin-bottom': '1.2em !important',
      },
    });
  }, [theme, fontSize]);

  // Highlight current sentence being spoken
  useEffect(() => {
    if (!renditionRef.current || !sentences[currentSentenceIndex]) return;

    const sentenceText = sentences[currentSentenceIndex];

    try {
      // Find and highlight matching text inside iframe
      const getContentsFn = (renditionRef.current as unknown as { getContents?: () => Array<{ document?: Document }> }).getContents;
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
