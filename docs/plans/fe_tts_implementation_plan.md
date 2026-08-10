# 🎧 Implementation Plan: Nghe Truyện Chữ — Web App Đọc Truyện AI Offline (100% Frontend)

> **Dự án:** `D:\Xuong_code\nghetruyenchu`  
> **Vị trí tài liệu:** `D:\Xuong_code\nghetruyenchu\docs\plans\fe_tts_implementation_plan.md`  
> **Mục tiêu:** Xây dựng web app FE thuần cho phép người dùng tải file EPUB/PDF/TXT lên, đọc truyện bằng mắt và nghe đọc bằng AI — 100% xử lý trên trình duyệt, không cần server.  
> **Tham khảo kiến trúc:** [voznovel_tts_architecture.md](file:///D:/Xuong_code/nghetruyenchu/docs/voznovel_analysis/voznovel_tts_architecture.md)

---

## User Review Required

> [!IMPORTANT]
> **Lựa chọn Tech Stack:** Plan này sử dụng **Vite + Vanilla JS** (không framework React/Vue) để giữ bundle nhẹ và đơn giản. Nếu bạn muốn dùng React/Next.js, hãy phản hồi trước khi execute.

> [!IMPORTANT]
> **Model AI (~63.5 MB):** File `ngochuyennew.onnx` hiện đã có sẵn trong thư mục dự án. Plan sẽ di chuyển nó vào `public/models/`. Model này sẽ được trình duyệt người dùng tải về và cache lại lần đầu tiên. Bạn có muốn host model ở CDN bên ngoài thay vì đặt trong project không?

> [!WARNING]
> **Thư viện `@mintplex-labs/piper-tts-web`:** Đây là thư viện open-source đóng gói sẵn Piper TTS + ONNX Runtime Web cho trình duyệt. Nó xử lý phonemization (espeak-ng WASM) và inference. Tuy nhiên, nó được thiết kế cho các model có sẵn trong registry của họ. Ta sẽ cần custom lại phần loading model để nạp file `ngochuyennew.onnx` tùy chỉnh của bạn. Nếu gặp vấn đề tương thích, phương án dự phòng là tích hợp trực tiếp `onnxruntime-web` + `piper-tts-worker.js` giống kiến trúc VozNovel.

## Open Questions

> [!IMPORTANT]
> 1. **Bạn có muốn hỗ trợ thêm định dạng nào ngoài EPUB, PDF, TXT không?** (ví dụ: `.docx`, `.mobi`, `.cbz`)
> 2. **Về giọng đọc:** Hiện tại chỉ có 1 giọng nữ "Ngọc Huyền". Bạn có muốn hỗ trợ chọn nhiều giọng đọc (nam/nữ) trong tương lai không? (Sẽ ảnh hưởng cách thiết kế UI chọn giọng)
> 3. **Về deploy:** Bạn dự định host web app này ở đâu? (Vercel, Netlify, GitHub Pages, hoặc self-host?) — Ảnh hưởng đến cách cấu hình build output và xử lý file model lớn.

---

## Proposed Changes

### Phase 1: Khởi tạo dự án Vite & Cấu trúc thư mục

#### [NEW] Khởi tạo Vite project (Vanilla JS)

Chạy lệnh:
```bash
npm create vite@latest ./ -- --template vanilla
npm install
```

#### [NEW] Cấu trúc thư mục hoàn chỉnh sau khi build

```text
D:\Xuong_code\nghetruyenchu\
├── docs/                              # Thư mục tài liệu dự án
│   ├── plans/
│   │   └── fe_tts_implementation_plan.md  <-- File Kế hoạch triển khai này
│   └── voznovel_analysis/
│       └── voznovel_tts_architecture.md   <-- Báo cáo phân tích kiến trúc
│
├── public/                            # Static assets (Vite sẽ copy nguyên vẹn)
│   ├── models/
│   │   ├── ngochuyennew.onnx          # Model AI giọng đọc (~63.5 MB)
│   │   └── ngochuyennew.onnx.json     # Config model
│   └── data/
│       ├── acronyms.csv               # Từ viết tắt
│       └── non-vietnamese-words.csv   # Từ nước ngoài phiên âm
│
├── src/
│   ├── main.js                        # Entry point — khởi tạo app
│   ├── style.css                      # Global styles + Design System
│   │
│   ├── core/                          # Business logic modules
│   │   ├── file-parser.js             # Module đọc EPUB/PDF/TXT → plain text
│   │   ├── text-normalizer.js         # Chuẩn hóa văn bản tiếng Việt
│   │   ├── tts-engine.js              # Điều phối TTS: chunking, queue, playback
│   │   ├── tts-worker.js              # Web Worker: ONNX Runtime + Piper inference
│   │   └── book-store.js              # IndexedDB: lưu sách & vị trí đọc
│   │
│   ├── ui/                            # UI Components (DOM manipulation)
│   │   ├── reader-view.js             # Hiển thị nội dung đọc + highlight câu đang đọc
│   │   ├── player-bar.js              # Thanh điều khiển audio (Play/Pause/Tốc độ/Giọng)
│   │   ├── file-upload.js             # Khu vực kéo thả & chọn file
│   │   ├── chapter-nav.js             # Sidebar danh sách chương (EPUB TOC)
│   │   └── settings-panel.js          # Panel cài đặt (theme đọc, cỡ chữ, tốc độ đọc)
│   │
│   └── utils/                         # Tiện ích dùng chung
│       ├── constants.js               # Hằng số (DB name, model URLs, ...)
│       └── helpers.js                 # Hàm tiện ích nhỏ
│
├── index.html                         # Entry HTML
├── package.json
└── vite.config.js                     # Cấu hình Vite (WASM support, worker config)
```

---

### Phase 2: File Parser — Đọc EPUB / PDF / TXT

#### [NEW] [file-parser.js](file:///D:/Xuong_code/nghetruyenchu/src/core/file-parser.js)

Module chịu trách nhiệm nhận file từ người dùng và trích xuất văn bản thuần (plain text) theo từng chương/trang.

**Dependencies cần cài:**
```bash
npm install epubjs
```
> PDF.js sẽ load qua CDN (`<script>` tag) vì nó có Web Worker riêng phức tạp.

**Xử lý từng định dạng:**

| Định dạng | Thư viện | Cách trích xuất |
| :--- | :--- | :--- |
| **EPUB** | `epubjs` | Parse file `.epub` → Lấy TOC (Table of Contents) → Lặp qua từng chapter → Trích nội dung HTML → Strip tags lấy plain text |
| **PDF** | `pdf.js` (CDN) | `getDocument(arrayBuffer)` → Lặp qua từng page → `page.getTextContent()` → Join `.items[].str` |
| **TXT** | Native `FileReader` | `reader.readAsText(file, 'UTF-8')` → Tách chương bằng regex (ví dụ: `Chương \d+`, `Chapter \d+`, dòng trống kép) |

**Output chuẩn hóa (Interface chung):**
```javascript
// file-parser.js trả về cấu trúc thống nhất bất kể định dạng đầu vào
{
  title: "Tên sách",
  author: "Tác giả",           // nếu có metadata
  chapters: [
    { id: "ch-0", title: "Chương 1: Khởi đầu", content: "Toàn bộ văn bản chương 1..." },
    { id: "ch-1", title: "Chương 2: Cuộc gặp gỡ", content: "..." },
    // ...
  ]
}
```

---

### Phase 3: Text Normalizer — Chuẩn hóa văn bản

#### [NEW] [text-normalizer.js](file:///D:/Xuong_code/nghetruyenchu/src/core/text-normalizer.js)

Module tiền xử lý văn bản trước khi đưa vào AI TTS. Đây là bước **cực kỳ quan trọng** vì model AI chỉ hiểu ngữ âm (phonemes), không hiểu ký hiệu đặc biệt.

**Các bước chuẩn hóa (theo thứ tự):**

1. **Loại bỏ ký tự thừa:** HTML tags, emoji, ký tự đặc biệt (`※`, `★`, `♦`...)
2. **Chuyển số thành chữ tiếng Việt:** `123` → `một trăm hai mươi ba`, `1.500.000` → `một triệu năm trăm nghìn`, số La Mã `XIII` → `mười ba`.
3. **Xử lý từ viết tắt:** `VD` → `ví dụ`, `TP.HCM` → `thành phố Hồ Chí Minh`.
4. **Xử lý từ nước ngoài:** `iPhone` → `ai phôn`, `email` → `i meo`.
5. **Tách câu thông minh:** Tách theo `.`, `!`, `?`, `;` (không tách số thập phân `3.14`).

---

### Phase 4: TTS Engine — Bộ máy tổng hợp giọng nói

#### [NEW] [tts-worker.js](file:///D:/Xuong_code/nghetruyenchu/src/core/tts-worker.js) (Web Worker)

**Dependency:** `npm install onnxruntime-web`

**Luồng xử lý:**
```
[Main Thread gửi câu text] 
  → Worker nhận message
  → Chuyển text → phonemes (espeak-ng WASM)
  → Chuyển phonemes → phoneme IDs (dùng phoneme_id_map từ .json)
  → Chạy ONNX inference (model ngochuyennew.onnx)
  → Trả PCM audio buffer về Main Thread
```

#### [NEW] [tts-engine.js](file:///D:/Xuong_code/nghetruyenchu/src/core/tts-engine.js) (Main Thread Controller)

**Cơ chế Streaming Playback (Cuốn chiếu):**
```
Câu 1: [Đang phát ▶️]
Câu 2: [Đã sinh xong, đợi trong hàng đợi ⏳]
Câu 3: [Worker đang tổng hợp 🔄]
Câu 4: [Chưa gửi ⬜]
...
```

---

### Phase 5: Book Store — Lưu trữ sách bằng IndexedDB

#### [NEW] [book-store.js](file:///D:/Xuong_code/nghetruyenchu/src/core/book-store.js)

Quản lý toàn bộ dữ liệu sách offline trên trình duyệt.

**Database:** `NghetruyenchuDB`  
**Stores:** `books`, `chapters`, `reading_progress`, `tts_cache`.

---

### Phase 6: UI Components — Giao diện người dùng

- **`index.html`:** Layout 4 vùng (Header, Reader, Chapter Sidebar, Sticky Player Bar).
- **`file-upload.js`:** Drag & Drop `.epub, .pdf, .txt`.
- **`reader-view.js`:** Đọc truyện + highlight câu đang phát + auto-scroll.
- **`player-bar.js`:** Thanh điều khiển Play/Pause/Speed/Volume/Progress.
- **`chapter-nav.js`:** Sidebar danh sách chương.
- **`settings-panel.js`:** Cài đặt Theme (Trắng/Sepia/Tối), Cỡ chữ, Tốc độ.

---

### Phase 7: Styling & Design System

#### [NEW] [style.css](file:///D:/Xuong_code/nghetruyenchu/src/style.css)

- Mặc định Dark mode, 4 theme đọc.
- Font: Google Fonts `Literata` (reader), `Inter` (UI).
- Glassmorphism & Micro-animations.

---

### Phase 8: Vite Config & Build

#### [NEW] [vite.config.js](file:///D:/Xuong_code/nghetruyenchu/vite.config.js)

- Target `esnext`, cấu hình COOP/COEP headers cho SharedArrayBuffer (WASM SIMD multi-threaded).

---

### Phase 9: Tích hợp & Luồng hoạt động End-to-End

#### [NEW] [main.js](file:///D:/Xuong_code/nghetruyenchu/src/main.js)

Tích hợp hoàn chỉnh từ kéo thả file ➔ Parse ➔ Lưu IndexedDB ➔ Tải model AI ➔ Tiền xử lý text ➔ Worker sinh audio ➔ Phát loa + highlight câu.

---

## Verification Plan

### Manual Verification
1. **File parsing:** Kiểm tra parse file EPUB, PDF, TXT tiếng Việt hiển thị đúng chương & nội dung.
2. **TTS Engine:** Model tải thành công, giọng Ngọc Huyền phát chuẩn, highlight câu & auto-scroll hoạt động.
3. **Offline:** Tắt mạng sau lần tải đầu ➔ Vẫn đọc & phát âm thanh bình thường.
4. **Responsive:** Thử nghiệm trên cả Desktop & Mobile.

---

## Thứ tự Execute (Ưu tiên)

| Phase | Mô tả | Ước lượng |
| :--- | :--- | :--- |
| **Phase 1** | Khởi tạo Vite + cấu trúc thư mục + di chuyển model | 10 phút |
| **Phase 7** | CSS Design System + Layout HTML | 30 phút |
| **Phase 6** | UI Components (File Upload, Reader, Player Bar) | 45 phút |
| **Phase 2** | File Parser (EPUB, PDF, TXT) | 30 phút |
| **Phase 5** | IndexedDB Book Store | 20 phút |
| **Phase 3** | Text Normalizer | 25 phút |
| **Phase 4** | TTS Engine + Worker | 60 phút |
| **Phase 8** | Vite Config + WASM headers | 10 phút |
| **Phase 9** | Tích hợp E2E + Polish | 30 phút |
| | **Tổng ước lượng** | **~4 giờ** |
