# Báo Cáo Phân Tích Kỹ Thuật & Hướng Dẫn Triển Khai: Kiến Trúc AI Text-To-Speech (TTS) Client-Side

> **Ngày tạo:** 09/08/2026  
> **Dự án:** Phân tích & Nghiên cứu Kiến trúc Hệ thống Đọc Truyện AI (`nghetruyenchu`)  
> **Vị trí tài liệu:** `D:\Xuong_code\nghetruyenchu\docs\voznovel_analysis\voznovel_tts_architecture.md`  

---

## 📋 MỤC LỤC
1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Cơ Chế Chống Debug & Cách Bypass (Anti-F12)](#2-cơ-chế-chống-debug--cách-bypass-anti-f12)
3. [Kịch Bản Vận Hành Thực Tế 5 Bước (Execution Flow)](#3-kịch-bản-vận-hành-thực-tế-5-bước-execution-flow)
4. [Phân Tích Chi Tiết Các Tệp Tài Nguyên AI](#4-phân-tích-chi-tiết-các-tệp-tài-nguyên-ai)
   - [4.1. File Model `ngochuyennew.onnx`](#41-file-model-ngochuyennewonnx)
   - [4.2. File Cấu Hình `ngochuyennew.onnx.json`](#42-file-cấu-hình-ngochuyennewonnxjson)
   - [4.3. Bản Chất Của File `ngochuyen.txt`](#43-bản-chất-của-file-ngochuyentxt)
5. [So Sánh Mô Hình Chi Phí & Lưu Trữ (Supabase / Server)](#5-so-sánh-mô-hình-chi-phí--lưu-trữ-supabase--server)
6. [Đánh Giá & Hướng Dẫn Triển Khai 100% Trên Frontend (FE)](#6-đánh-giá--hướng-dẫn-triển-khai-100-trên-frontend-fe)
   - [6.1. Đánh giá tính khả thi từng hạng mục](#61-đánh-giá-tính-khả-thi-từng-hạng-mục)
   - [6.2. Thách thức & Giải pháp tối ưu UI/UX](#62-thách-thức--giải-pháp-tối-ưu-uiux)
   - [6.3. Cấu trúc thư mục Frontend chuẩn cho dự án `nghetruyenchu`](#63-cấu-trúc-thư-mục-frontend-chuẩn-cho-dự-án-nghetruyenchu)
7. [Hướng Dẫn Trích Xuất & Tái Sử Dụng Giọng Đọc Offline](#7-hướng-dẫn-trích-xuất--tái-sử-dụng-giọng-đọc-offline)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

Trang web `https://voznovel.com/convert` cung cấp tính năng chuyển đổi văn bản truyện thành giọng đọc tiếng Việt (Text-to-Speech - TTS). 

Mặc dù bề ngoài tính năng có vẻ giống các dịch vụ gọi API trả về file âm thanh (như Google TTS, FPT.AI, Viettel AI), nhưng qua phân tích sâu luồng mạng và mã nguồn, trang web sử dụng mô hình **Client-Side Neural Text-to-Speech** chạy hoàn toàn bằng công nghệ **WebAssembly (WASM)** và **Piper TTS** ngay trên trình duyệt của người dùng.

---

## 2. CƠ CHẾ CHỐNG DEBUG & CÁCH BYPASS (ANTI-F12)

Khi mở Developer Tools (`F12`), trang web sẽ rơi vào trạng thái khựng lại liên tục (`Paused in debugger`).

### Nguyên nhân:
Trang web nhúng script bảo vệ `convert-protection.js` chứa các vòng lặp kích hoạt lệnh `debugger;` liên tục nhằm ngăn cản việc soi mã nguồn và theo dõi luồng mạng.

### 3 Phương pháp Bypass:
1. **Phương pháp 1 - Deactivate Breakpoints (Nhanh nhất):**
   - Mở tab **Sources** trong F12 ➔ Bấm tổ hợp phím **`Ctrl + F8`** (hoặc click biểu tượng dấu gạch chéo qua điểm dừng).
   - Bấm `F8` để tiếp tục chạy code.
2. **Phương pháp 2 - Never Pause Here:**
   - Chuột phải vào số dòng code chứa lệnh `debugger;` ở lề trái ➔ Chọn **Never pause here**.
3. **Phương pháp 3 - Request Blocking:**
   - Tại tab **Network**, chuột phải vào `convert-protection.js` ➔ Chọn **Block request URL** ➔ Bấm `F5` tải lại trang.

---

## 3. KỊCH BẢN VẬN HÀNH THỰC TẾ 5 BƯỚC (EXECUTION FLOW)

Hệ thống hoạt động theo quy trình 5 bước độc lập với máy chủ âm thanh:

```
[Người dùng nhập chữ] 
       │
       ▼
[Lưu IndexedDB: VozerConvertDB] ──► [Tiền xử lý chuỗi: tts-engine.js + CSV dictionaries]
                                               │
                                               ▼
[Phát Audio: Web Audio API] ◄── [Sinh sóng âm PCM] ◄── [WebWorker + WASM SIMD + ngochuyennew.onnx]
```

1. **Bước 1: Lưu trữ văn bản cục bộ (IndexedDB Storage)**
   - Văn bản chương truyện được lưu trực tiếp vào cơ sở dữ liệu `VozerConvertDB` (bảng `chapter_content`) của trình duyệt bằng script `convert-chapter-store.js`.
2. **Bước 2: Tiền xử lý ngữ âm (Text Normalization)**
   - Script `tts-engine.js` bóc tách văn bản, chuyển đổi qua bộ lọc `chinese-script-normalizer.js`, `acronyms.csv` (viết tắt) và `non-vietnamese-words.csv` (từ phiên âm tiếng nước ngoài).
3. **Bước 3: Khởi chạy AI Worker & Nạp Model**
   - Khởi tạo WebWorker ngầm `piper-tts-worker.js`.
   - Nạp bộ dịch đa nhân **WebAssembly** `ort-wasm-simd-threaded.jsep.wasm` (~21.8 MB) và mô hình **ONNX** `ngochuyennew.onnx` (~63.5 MB). Các tài nguyên này được trình duyệt Cache tự động.
4. **Bước 4: Tổng hợp âm thanh bằng CPU máy người dùng (Client Synthesis)**
   - WebWorker chạy mô hình AI nơ-rôn hoàn toàn offline trên CPU người dùng để tính toán và xuất ra mảng dữ liệu sóng âm (PCM Audio Buffer).
5. **Bước 5: Phát âm thanh (Audio Playback)**
   - Dữ liệu sóng âm được chuyển về main thread và phát ra loa bằng **Web Audio API** (`AudioContext`). **Không có bất kỳ file `.mp3` nào được truyền qua mạng.**

---

## 4. PHÂN TÍCH CHI TIẾT CÁC TỆP TÀI NGUYÊN AI

### 4.1. File Model `ngochuyennew.onnx`
- **Bản chất:** Là tệp chứa toàn bộ ma trận trọng số (weights) của mạng nơ-rôn nhân tạo đã được huấn luyện.
- **Dung lượng:** `~63.5 MB`.
- **Kiến trúc:** Dựa trên mô hình **VITS** (Variational Inference with adversarial learning for end-to-end Text-to-Speech).

### 4.2. File Cấu Hình `ngochuyennew.onnx.json`
Chứa các thông số siêu dữ liệu (Metadata) cho trình tổng hợp Piper TTS:
```json
{
  "audio": {
    "sample_rate": 22050
  },
  "espeak": {
    "voice": "vi"
  },
  "phoneme_type": "espeak",
  "num_symbols": 256,
  "num_speakers": 1,
  "inference": {
    "noise_scale": 0.667,
    "length_scale": 1.0,
    "noise_w": 0.8
  }
}
```
- **Tần số lấy mẫu:** 22,050 Hz.
- **Ngôn ngữ:** Tiếng Việt (`vi`) qua bộ mã hóa `espeak`.
- **Giọng đọc:** Nữ (Ngọc Huyền).

### 4.3. Bản Chất Của File `ngochuyen.txt`
- **Định nghĩa:** Là file kịch bản dữ liệu đầu vào (Dataset Transcription File) dùng ở giai đoạn **huấn luyện (Training)**.
- **Cấu trúc:** Cung cấp cặp dữ liệu `tệp_ghi_âm.wav|câu_chữ_tương_ứng`.
- **Mối quan hệ:** 
  $$\text{Dữ liệu âm thanh (.wav)} + \text{Kịch bản (ngochuyen.txt)} \xrightarrow{\text{Huấn luyện AI (VITS)}} \text{Model hoàn chỉnh (ngochuyennew.onnx)}$$
- **Trạng thái:** File `.txt` này chỉ dùng trong giai đoạn train trên server kỹ sư, không cần thiết và không tồn tại trên môi trường chạy thực tế (Production).

---

## 5. SO SÁNH MÔ HÌNH CHI PHÍ & LƯU TRỮ (SUPABASE / SERVER)

Website lựa chọn mô hình **Trường hợp 2 (Client-Side AI)** với hiệu quả kinh tế tối đa:

| Tiêu chí | Mô hình 1 (Server MP3 / Cloud TTS) | Mô hình 2 của VozNovel (Client-Side Piper TTS) |
| :--- | :--- | :--- |
| **File Storage (Supabase)** | **Tốn rất lớn:** Phải lưu hàng ngàn file `.mp3` nặng. | **0 Byte:** Không lưu bất kỳ file âm thanh nào. |
| **Băng thông Egress** | **Tốn rất lớn:** Mỗi lần nghe đều tải file MP3 về. | **Cực kỳ thấp:** Chỉ truyền tải chữ (văn bản) vài KB. |
| **Chi phí API TTS** | **Đắt đỏ:** Trả tiền theo từng 1.000 ký tự (FPT/Google). | **0 VNĐ:** Chạy offline bằng CPU người dùng. |
| **Tải Server** | **Cao:** Server phải xử lý tổng hợp hoặc làm trung gian. | **Không đáng kể:** Server chỉ phục vụ file tĩnh. |

---

## 6. ĐÁNH GIÁ & HƯỚNG DẪN TRIỂN KHAI 100% TRÊN FRONTEND (FE)

Bạn **HOÀN TOÀN CÓ THỂ** tự xây dựng hệ thống đọc truyện xử lý 100% trên Frontend cho dự án `nghetruyenchu`.

### 6.1. Đánh giá tính khả thi từng hạng mục
1. **Lưu trữ văn bản:** Dùng `IndexedDB` lưu trữ hàng nghìn chương truyện trực tiếp trên trình duyệt client.
2. **Tiền xử lý văn bản:** Viết module JS (Regex/Dictionary) chạy trên main thread hoặc worker.
3. **Tổng hợp AI:** Dùng `onnxruntime-web` + `piper-tts-worker.js` nạp file `.onnx` chạy trên WebWorker.
4. **Phát âm thanh:** Dùng `Web Audio API` (`AudioContext`) phát trực tiếp sóng âm PCM.

### 6.2. Thách thức & Giải pháp tối ưu UI/UX

#### A. Tải bộ máy AI lần đầu (Tệp `.onnx` & `.wasm` ~80MB)
* **Giải pháp:**
  - **Lưu Cache:** Dùng `CacheStorage` hoặc `IndexedDB` lưu lại file `.onnx` ngay lần tải đầu tiên. Những lần sau web sẽ mở **tức thì (Instant Load)**.
  - **Preload ngầm:** Khởi động Web Worker và tải ngầm model ngay khi người dùng vừa vào trang đọc truyện.
  - **UX Progress bar:** Hiển thị phần trăm tải dữ liệu giọng đọc lần đầu.

#### B. Giữ hiệu năng mượt mà trên thiết bị di động yếu
* **Giải pháp (Cơ chế Cuốn chiếu - Streaming):**
  - **Cắt đoạn nhỏ (Chunking):** Chia nhỏ chương truyện thành từng đoạn 100 - 200 từ.
  - **Sinh cuốn chiếu:** Vừa phát âm thanh đoạn 1, Worker vừa tranh thủ sinh sẵn âm thanh đoạn 2.

### 6.3. Cấu trúc thư mục Frontend chuẩn cho dự án `nghetruyenchu`

```text
D:\Xuong_code\nghetruyenchu\
├── docs\
│   └── voznovel_analysis\
│       └── voznovel_tts_architecture.md   <-- File tài liệu tổng hợp này
├── index.html                 <-- Giao diện chính & Audio Player
├── js/
│   ├── app.js                 <-- Điều khiển giao diện & Player UI
│   ├── text-normalizer.js     <-- Đổi số thành chữ, chuẩn hóa ngữ âm
│   ├── storage.js             <-- Quản lý lưu trữ văn bản bằng IndexedDB
│   └── tts-worker.js          <-- Web Worker chứa ONNX Runtime & Piper TTS
├── models/
│   ├── ngochuyennew.onnx      <-- Model AI giọng đọc (63.5 MB)
│   └── ngochuyennew.onnx.json <-- File cấu hình model
└── wasm/
    ├── ort-wasm-simd-threaded.jsep.wasm  <-- Bộ dịch AI WebAssembly
    └── ort.bundle.min.mjs                <-- Thư viện ONNX Runtime Web
```

---

## 7. HƯỚNG DẪN TRÍCH XUẤT & TÁI SỬ DỤNG GIỌNG ĐỌC OFFLINE

Vì hệ thống chạy mô hình mở, bạn có thể trích xuất hoàn toàn giọng đọc "Ngọc Huyền" để sử dụng cho ứng dụng riêng:

1. **Tải bộ Mô hình AI:**
   - Model weights: `https://voznovel.com/piper-tts/models/vi/ngochuyennew.onnx`
   - Config file: `https://voznovel.com/piper-tts/models/vi/ngochuyennew.onnx.json`
2. **Sử dụng với Piper TTS:**
   - Cài đặt công cụ mã nguồn mở **Piper TTS** (Python hoặc C++ binary từ Github `rhasspy/piper`).
   - Chạy lệnh đọc offline không cần kết nối mạng:
     ```bash
     echo "Xin chào, đây là giọng đọc Ngọc Huyền offline." | piper --model ngochuyennew.onnx --output_file output.wav
     ```
