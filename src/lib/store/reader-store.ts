import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ReaderTheme } from '@/types';

interface ReaderState {
  theme: ReaderTheme;
  fontSize: number; // 14 to 26 px
  lineHeight: number; // 1.4 to 2.0
  setTheme: (theme: ReaderTheme) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.6,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
    }),
    {
      name: 'nghetruyenchu_reader_settings',
    }
  )
);
