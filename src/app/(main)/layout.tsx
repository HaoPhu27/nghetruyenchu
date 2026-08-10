import React from 'react';
import Link from 'next/link';
import { Headphones, BookMarked } from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-bold shadow-lg shadow-yellow-500/20 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none text-zinc-100 tracking-tight">
                NgheTruyệnChữ
              </span>
              <span className="text-[10px] text-yellow-500 font-medium tracking-wide">
                AI OFFLINE VOICE
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-200 border border-zinc-800 hover:text-yellow-400 transition-colors"
            >
              <BookMarked className="w-4 h-4 text-yellow-500" />
              Thư viện
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-600">
        <p>Nghe Truyện Chữ AI — 100% Processing in Browser with Piper TTS & ONNX Runtime Web</p>
      </footer>
    </div>
  );
}
