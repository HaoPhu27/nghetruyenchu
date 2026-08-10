# 🎧 Nghe Truyện Chữ — Web App Đọc & Nghe Truyện AI (100% Client-Side TTS)

Web App đọc truyện chữ định dạng **EPUB** và nghe đọc bằng trí tuệ nhân tạo (AI Text-To-Speech giọng đọc **Ngọc Huyền**). Hệ thống xử lý tổng hợp âm thanh 100% trên trình duyệt người dùng bằng **WebAssembly (WASM)**, đồng thời hỗ trợ lưu trữ cục bộ persistent (IndexedDB) và đồng bộ Cloud (Supabase).

---

## ✨ Tính Năng Nổi Bật

- 📖 **Đọc sách EPUB:** Hỗ trợ render EPUB mượt mà với 4 theme đọc (`Light`, `Sepia`, `Dark`, `AMOLED`), tùy chỉnh cỡ chữ (14px - 26px).
- 🎙️ **Giọng đọc AI Ngọc Huyền (Piper TTS):** Chạy trực tiếp mô hình ONNX (`ngochuyennew.onnx`) bằng WebAssembly SIMD multi-threaded trên CPU trình duyệt.
- ⚡ **Cơ chế Streaming Playback:** Vừa phát câu hiện tại vừa tổng hợp trước các câu tiếp theo, không bị trễ hay ngắt quãng.
- 🎯 **Smart Highlight & Auto-scroll:** Tự động phát hiện và highlight câu chữ đang được giọng đọc AI đọc tới trong giao diện sách.
- 🇻🇳 **Chuẩn hóa văn bản tiếng Việt (Text Normalizer):**
  - Chuyển đổi số thành chữ tiếng Việt (`1.500.000` → `một triệu năm trăm nghìn`).
  - Đọc số La Mã (`Chương XIII` → `Chương mười ba`).
  - Tra cứu từ viết tắt và từ phiên âm nước ngoài (`acronyms.json`, `foreign-words.json`).
- 🔄 **Lưu trữ Persistent & Cloud Sync:**
  - **Local Mode (Chế độ mặc định):** Lưu trữ toàn bộ file EPUB và tiến độ vào IndexedDB / LocalStorage, không phụ thuộc server.
  - **Cloud Mode (Supabase):** Đồng bộ tiến độ đọc và lưu file sách trên Supabase Storage để nghe tiếp từ máy tính lên điện thoại.

---

## 🏗️ Kiến Trúc Công Nghệ (Tech Stack)

- **Frontend Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling & UI:** Tailwind CSS v4, shadcn/ui, Lucide Icons, Google Fonts (Literata + Inter)
- **State Management:** Zustand
- **EPUB Parser:** `epubjs`
- **TTS Engine & WASM:** `onnxruntime-web` + Custom Web Worker
- **Database & Storage:** Supabase Client (`@supabase/supabase-js`) + Persistent IndexedDB fallback

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Khởi chạy Development Server
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

### 2. Cấu hình Supabase (Tùy chọn cho Cloud Sync)
Nếu bạn muốn kích hoạt đồng bộ Cloud giữa nhiều thiết bị:
1. Mở file `docs/supabase_schema.sql` và chạy kịch bản SQL trên Supabase SQL Editor.
2. Tạo 3 buckets trong Storage: `novels`, `covers`, `tts-models`.
3. Điền các biến môi trường vào `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📂 Cấu Trúc Thư Mục Cốt Lõi

```text
├── public/
│   ├── models/
│   │   ├── ngochuyennew.onnx           # Model AI giọng đọc Ngọc Huyền (~63.5MB)
│   │   └── ngochuyennew.onnx.json      # File config siêu dữ liệu & phoneme map
│   └── data/
│       ├── acronyms.json               # Từ viết tắt tiếng Việt
│       └── foreign-words.json          # Từ nước ngoài phiên âm
├── src/
│   ├── app/
│   │   ├── (main)/                     # Trang chủ thư viện sách
│   │   └── reader/[id]/                # Trang đọc sách & phát TTS
│   ├── components/
│   │   ├── library/                    # Novel card, Upload dialog, Empty library
│   │   └── reader/                     # Epub viewer, TTS player bar, Chapter sidebar
│   ├── lib/
│   │   ├── epub/                       # EPUB parser & text extraction
│   │   ├── storage/                    # IndexedDB persistent local storage
│   │   ├── supabase/                   # Supabase queries & storage fallback
│   │   └── tts/                        # Text normalizer, Web Worker & TTS Engine
│   └── store/                          # Zustand stores (reader settings & TTS state)
└── docs/
    └── supabase_schema.sql             # SQL script cho Supabase database & storage
```
