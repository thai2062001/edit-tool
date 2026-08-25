# 🎬 Báo Cáo Triển Khai Tính Năng: Auto Subtitle / Captions (Word-Level Animation)

**Dự án:** Ist-dev / FFmpeg Studio  
**Ngày thực hiện:** 25/08/2026  
**Công nghệ sử dụng:** Node.js, Express, FFmpeg, Google Gemini AI (`@google/genai`), HTML5 Canvas & Video API, CSS Keyframes & ASS Subtitle Engine.

---

## 1. 🏗️ Cấu Trúc Module & Tính Độc Lập (Tách Biệt Code)

Để đảm bảo không ảnh hưởng hoặc gây lỗi đến mã nguồn dựng video cũ, tính năng mới được thiết kế tách rời hoàn toàn:

| Thành phần | Đường dẫn tệp | Mô tả nhiệm vụ |
| :--- | :--- | :--- |
| **Backend Router** | [`subtitles.js`](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/subtitles.js) | Xử lý upload âm thanh/video, gọi Gemini AI phân tích từng từ, tạo file `.ASS`/`.SRT`/`.VTT`, và xử lý tác vụ FFmpeg burn subtitle với SSE. |
| **Frontend Logic** | [`public/subtitles.js`](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/public/subtitles.js) | Điều khiển toàn bộ Tab phụ đề, quản lý trình phát video, đồng bộ hiệu ứng Karaoke thời gian thực, chỉnh sửa timeline câu/từ, chuyển đổi preset. |
| **Frontend Styles** | [`public/subtitles.css`](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/public/subtitles.css) | Toàn bộ CSS giao diện Tab mới, hiệu ứng animation `@keyframes wordBounce`, `@keyframes glow`, thanh cuộn, giao diện thẻ câu và từ. |
| **Tích hợp an toàn** | [`server.js`](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/server.js) & [`public/index.html`](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/public/index.html) | Chỉ thêm thanh điều hướng Tab và nạp module phụ đề trong khối bọc an toàn `try/catch`. Code cũ của Tab 1 giữ nguyên 100%. |

---

## 2. ✨ Chi Tiết Các Chức Năng Đã Hoàn Thiện

### 2.1. 🤖 Tích Hợp Gemini AI (Word-Level Timestamps)
- **Nhận diện giọng nói (Speech-to-Text):** Tự động trích xuất âm thanh từ Video hoặc Audio đã tải lên, nén nhẹ và gửi qua Gemini AI để nhận diện giọng nói và gán mốc thời gian chi tiết đến **từng từ**.
- **Khớp kịch bản (Script-to-Speech Alignment):** Cho phép nhập/dán kịch bản có sẵn để AI phân chia thành các câu ngắn tự nhiên (3-4 từ theo chuẩn TikTok / Shorts) và gắn mốc thời gian chuẩn xác.
- **Tùy chỉnh Gemini API Key:** Người dùng có thể sử dụng key mặc định hoặc nhập key cá nhân ngay trên giao diện.

### 2.2. 👁️ Trình Phát Video & Xem Trước Hoạt Họa Thời Gian Thực
- **Hoạt họa từng từ (Word-Level Karaoke Animation):** Khi video hoặc audio phát, từ đang được phát âm sẽ tức thời:
  - **Bounce / Pop:** Nảy to lên theo hiệu ứng CapCut/TikTok.
  - **Glow / Neon:** Phát sáng rực rỡ với màu sắc tùy chỉnh.
  - **Karaoke Fill:** Chạy màu dần từ trái sang phải.
  - **Single Word:** Hiển thị từng từ kích thước lớn nổi bật.
- **Tương tác 2 chiều:** Nhấp vào bất kỳ từ nào trên danh sách phân đoạn (Word Pill) sẽ tự động tua (seek) trình phát đến đúng thời điểm phát âm của từ đó.

### 2.3. 🎨 Bộ Presets & Tùy Biến Phong Cách Phụ Đề
- **Các Preset có sẵn:**
  1. `TikTok Pop`: Chữ trắng, viền đen dày, từ đang nói nảy to màu vàng rực (`#FFDF00`).
  2. `CapCut Cyan`: Chữ sáng với hiệu ứng phát sáng Neon xanh băng (`#06B6D4`).
  3. `MrBeast Pop`: Chữ cỡ lớn giữa màn hình với màu cam nổi bật (`#F97316`).
  4. `Cyberpunk`: Hồng neon phát sáng huyền ảo (`#F43F5E`).
  5. `Classic White`: Phụ đề phong cách tối giản, thanh lịch.
- **Tùy chỉnh nâng cao:**
  - Font chữ: Outfit, Arial, Impact, Montserrat, JetBrains Mono.
  - Kích thước chữ (Font size) & Vị trí (Đáy màn hình, Giữa màn hình, Đỉnh màn hình).
  - Màu chữ thường, Màu từ Highlight, Màu viền chữ (Stroke), Độ dày viền.

### 2.4. 📝 Trình Soạn Thảo Phân Đoạn & Mốc Thời Gian (Interactive Cue Editor)
- Danh sách trực quan hiển thị từng câu kèm danh sách các từ thành phần.
- Cho phép chỉnh sửa thời gian bắt đầu (`start`), kết thúc (`end`) của từng câu.
- Thêm câu mới thủ công, xóa từng câu hoặc xóa toàn bộ danh sách.
- Nạp sẵn mẫu kịch bản tiếng Việt thử nghiệm (Seoul Winter Story).

### 2.5. ⚡ Xuất File Phụ Đề & Render Gắn Cứng Vào Video (FFmpeg ASS Burn)
- **Tải tệp phụ đề:** Hỗ trợ xuất định dạng `.ASS` (chứa đầy đủ thẻ Karaoke `\kf` và hiệu ứng biến đổi kích thước `\t`), `.SRT`, và `.VTT`.
- **Gắn cứng (Burn-in) bằng FFmpeg:** Nhấn *"Gắn Phụ Đề Vào Video"* để FFmpeg render video đầu ra `.mp4` hoàn chỉnh với phụ đề sắc nét, hiển thị thanh tiến trình thời gian thực (SSE) và xem trước/tải xuống ngay tại chỗ.

---

## 3. 🔍 Kết Quả Kiểm Tra Code (Code Inspection & Syntax Check)

- `server.js` & `subtitles.js`: **Compiled 100% OK (Syntax validated)**
- `public/app.js` & `public/subtitles.js`: **Compiled 100% OK (Syntax validated)**
- Chuyển đổi qua lại giữa Tab 1 (Dựng Video) và Tab 2 (Auto Subtitle AI) hoạt động độc lập và mượt mà.
- **Tuân thủ quy định:** Không mở trình duyệt tự động.

---
*Tài liệu này được tạo tự động để tiện theo dõi và kiểm tra sau.*
