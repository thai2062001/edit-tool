# 🎬 FFmpeg Studio - Trình Ghép Video & Hiệu Ứng Chuyên Nghiệp

Ứng dụng Web UI trực quan hỗ trợ ghép nhiều ảnh và video clip với các hiệu ứng chuyển động Ken Burns (Zoom In, Zoom Out, Pan) và độ mờ (Fade In, Fade Out) sử dụng sức mạnh xử lý của **FFmpeg**.

---

## ✨ Tính Năng Nổi Bật

- 🖼️ **Ghép Ảnh & Video:** Kéo thả nhiều ảnh (`JPG`, `PNG`, `WEBP`) và video (`MP4`, `MOV`, `MKV`).
- 🔍 **Hiệu ứng Motion trên Ảnh (Ken Burns):**
  - Zoom In (Phóng to vào tâm)
  - Zoom Out (Thu nhỏ ra toàn cảnh)
  - Pan Trái / Pan Phải (Lướt camera)
  - Zoom + Pan (Phóng to kết hợp đổi góc nhìn)
  - Tĩnh (Không zoom)
- 👁️ **Xem trước trực quan:** Mô phỏng chuyển động trực tiếp trên HTML5 Canvas trước khi render.
- 🌫️ **Hiệu ứng Fade In / Fade Out:** Tùy chỉnh số giây mờ dần đầu và cuối mỗi ảnh.
- 📐 **Đa dạng tỉ lệ khung hình:**
  - `16:9` (1920x1080 - YouTube, TV)
  - `9:16` (1080x1920 - TikTok, Reels, Shorts)
  - `1:1` (1080x1080 - Instagram)
- 🎵 **Chèn Nhạc Nền (BGM):** Tự động loop theo độ dài video, chỉnh âm lượng và tự động fade out âm thanh cuối video.
- ⚡ **Render siêu tốc & Nhẹ máy:** Xử lý qua FFmpeg đa luồng với thanh tiến trình % thời gian thực (SSE).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống:
- Đã cài đặt **[Node.js](https://nodejs.org/)** (v16 trở lên).
- Đã cài đặt **[FFmpeg](https://ffmpeg.org/)** và thêm vào biến môi trường PATH.

### 2. Cài đặt thư viện:
```bash
npm install
```

### 3. Khởi chạy ứng dụng:
```bash
npm start
```

Mở trình duyệt và truy cập: **[http://localhost:3000](http://localhost:3000)**
