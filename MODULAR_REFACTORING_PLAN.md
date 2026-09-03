# 📋 Kế Hoạch Tái Cấu Trúc & Tách Module JavaScript (Modular Architecture Plan)

> **Mục tiêu**: Tách nhỏ file nguyên khối [app.js](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/public/app.js) (4.584 dòng) thành các module độc lập, chuyên biệt theo nghiệp vụ để tăng hiệu năng, dễ đọc, dễ bảo trì và hạn chế lỗi xung đột, đồng thời **bảo toàn 100% logic và tính năng hiện hữu**.

---

## 🔒 1. Phương Án Bảo Toàn & Dự Phòng (Safety & Fallback)
- ✅ Đã tạo bản sao lưu nguyên vẹn: [app.backup.js](file:///c:/Users/Admin/Desktop/Du%20an%20web/edt/public/app.backup.js) (192.558 bytes).
- Mọi logic sau khi tách sẽ được đối chiếu từng dòng với `app.backup.js`.
- Bất kỳ biến hoặc hàm nào được dùng chéo giữa các module sẽ được quản lý qua Global Scope an toàn (`window` / namespace).

---

## 🧱 2. Cấu Trúc Các Module Đề Xuất (Folder `public/js/`)

```text
public/
├── index.html
├── style.css
├── app.backup.js           (Bản backup đối chiếu gốc)
├── subtitles.js            (Module Subtitles hiện có)
├── watermark.js            (Module Watermark hiện có)
├── qa.js                   (Module Script QA hiện có)
│
├── js/
│   ├── state.js            (📦 State quản lý dữ liệu, Undo/Redo history, Multi-select state, Getter/Setter)
│   ├── studio-player.js    (🎬 Trình phát Studio Canvas 16:9/9:16/1:1, Animation Loop, Render Frame, Transitions, Seek/Scrubber)
│   ├── timeline.js         (🎞️ Dải Storyboard Ribbon, Kéo thả Drag-Drop, Quick Inspector Panel, Audio Waveform Visualizer & Sync)
│   ├── ai-studio.js        (🤖 Bộ công cụ AI Studio: Phân tích kịch bản Gemini, Khớp hình ảnh thông minh, Cân bằng nhịp điệu Pacing)
│   ├── batch-tools.js      (⚡ Công cụ hàng loạt: Phân bổ Motion xoay vòng, Modal Custom Motion, Multi-Select Toolbar Actions)
│   └── export-render.js    (💾 Quản lý Dự Án: Lưu/Mở file .json/.edtproject, Gọi Render FFmpeg, SSE/Progress tracking)
└── app.js                  (🚀 Entry Point gọn nhẹ: Khởi tạo DOMContentLoaded, gắn sự kiện phím tắt, điều phối chung)
```

---

## 📑 3. Phân Chia Chi Tiết Từng Module

### 1. `js/state.js` (~350 dòng)
- **Nhiệm vụ**: Khai báo và quản lý tập trung toàn bộ biến trạng thái của ứng dụng.
- **Thành phần**:
  - `mediaItems`, `bgmTrack`, `currentSettings` (ratio, fps, qualityPreset, reframeMode).
  - `activeSegmentIndex`, `selectedSegmentIndices`, `lastClickedIndex`.
  - Hệ thống **Undo / Redo Stack**: `undoStack`, `redoStack`, `recordHistorySnapshot()`, `performUndoAction()`, `performRedoAction()`.
  - Utility helpers: `getTotalTimelineDurationSec()`, `getSceneAudioRange()`, `getMotionShortName()`.

### 2. `js/studio-player.js` (~700 dòng)
- **Nhiệm vụ**: Điều khiển Trình phát Video Studio trên Canvas.
- **Thành phần**:
  - Quản lý nạp cache ảnh / video: `studioLoadedImages`, `studioLoadedVideos`.
  - Render frame hình ảnh với hiệu ứng Motion (Zoom In/Out, Pan, Zoom Pan) & Transition (Fade Đen, Flash Trắng, Slide, Crossfade, Zoom Cut).
  - Trình phát Canvas Sequence (`playStudioSequence()`, `playSingleScene()`, `seekToTimelinePosition()`).
  - Render Text Overlay (Auto Word-Wrap an toàn theo tỷ lệ khung hình).
  - Đồng bộ Scrubber kéo tua thời gian thực.

### 3. `js/timeline.js` (~800 dòng)
- **Nhiệm vụ**: Quản lý Dải Storyboard Ribbon & Bảng Quick Inspector.
- **Thành phần**:
  - `renderMediaList()`: Vẽ các thẻ phân đoạn trên ribbon kèm badge thứ tự, thời lượng, hiệu ứng.
  - Xử lý kéo thả sắp xếp phân cảnh (`handleDragStart`, `handleDragOver`, `handleDrop`, `handleDragEnd`).
  - Xử lý tương tác chọn cảnh (`selectSegment()`, `toggleMultiSelectIndex()`).
  - Bảng **Quick Inspector**: Đồng bộ và cập nhật thông số khi người dùng thay đổi (Motion, Transition, Duration Stepper, Loop, Text Overlay).
  - Bổ sung ảnh bù cho thẻ chờ (`uploadImageForSegment`).
  - Dải Sóng Âm **Audio Waveform Visualizer** (`generateAndDrawAudioWaveform()`, `drawAudioWaveformCanvas()`, `fitTimelineToAudioDuration()`).

### 4. `js/ai-studio.js` (~900 dòng)
- **Nhiệm vụ**: Toàn bộ nghiệp vụ tích hợp AI Gemini trong Modal AI Studio.
- **Thành phần**:
  - Modal Phân tích kịch bản khớp hình ảnh (`/api/ai/match-script`).
  - Phân tích đánh giá độ khớp hình ảnh tự động (`/api/ai/audit-image-alignment`).
  - Cân bằng nhịp điệu phân cảnh theo giọng đọc Audio (`/api/ai/audit-pacing`).
  - Áp dụng kết quả phân cảnh AI vào Timeline.

### 5. `js/batch-tools.js` (~500 dòng)
- **Nhiệm vụ**: Các công cụ thao tác nhanh và xử lý hàng loạt.
- **Thành phần**:
  - Thanh công cụ **Multi-Select Toolbar**: Đổi thời lượng nhóm, gán Transition nhóm, gán Motion nhóm, Xóa nhóm cảnh.
  - Phân bổ hiệu ứng chuyển động xoay vòng (Round-Robin / Random) qua Modal Custom Motion Distribution.
  - Áp dụng thời lượng, cường độ, Fade In/Out đồng loạt cho toàn bộ Timeline.

### 6. `js/export-render.js` (~600 dòng)
- **Nhiệm vụ**: Quản lý tệp dự án và Kết xuất video hoàn chỉnh.
- **Thành phần**:
  - Lưu dự án ra tệp `.json` / `.edtproject` (`exportProjectToFile()`).
  - Mở dự án từ tệp tin (`importProjectFromFile()`, `applyLoadedProject()`).
  - Gửi lệnh Render Video lên Backend FFmpeg (`startRenderVideo()`).
  - Quản lý Modal Tiến Độ Xuất Video & Tải video về máy.

### 7. `app.js` (~150 dòng)
- **Nhiệm vụ**: Entry point chính.
- **Thành phần**:
  - Đăng ký sự kiện `DOMContentLoaded`.
  - Khởi tạo tỷ lệ khung hình mặc định (16:9).
  - Xử lý Upload file từ máy tính vào ứng dụng (`handleFilesUpload`, `uploadBgmFile`).
  - Đăng ký toàn bộ phím tắt bàn phím toàn cục (`Space`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+A`, `Delete`, `ArrowLeft/Right`, `Esc`).

---

## 🛠️ 4. Kế Hoạch Triển Khai & Kiểm Thử (Execution Steps)

1. **Tạo thư mục `public/js/`**.
2. **Trích xuất lần lượt 6 file module** từ `public/app.backup.js` sang `public/js/` với kiểm tra cú pháp độc lập (`node -c`).
3. **Cập nhật `public/app.js`** thành Entry Point tinh gọn.
4. **Cập nhật `public/index.html`** để nạp các module theo đúng thứ tự phụ thuộc.
5. **Kiểm tra cú pháp tổng thể**: Chạy `node -c` trên toàn bộ các file JS.
6. **Bàn giao và xác nhận** với User.
