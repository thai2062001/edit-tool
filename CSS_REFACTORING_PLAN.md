# KẾ HOẠCH TÁCH VÀ MODULAR HÓA CSS THEO TỪNG TAB (CSS REFACTORING PLAN)

> **Mục tiêu**: Tách nhỏ file CSS đồ sộ (`style.css` ~3330 dòng) thành các module CSS chuyên biệt, độc lập theo từng Tab và Component dùng chung; tạo bản backup toàn diện để đối chiếu đối sánh, đảm bảo **100% không mất mát hay lệch giao diện**.

---

## 1. Hiện trạng kiến trúc CSS hiện tại

Hiện tại thư mục `public/` đang có:
1. `public/style.css` (3331 dòng, ~70KB): Đang chứa lẫn lộn:
   - Các biến `:root` & reset styles, fonts, body.
   - Header bar, top navigation, menu AI Studio dropdown.
   - Thanh Tab Switcher `.main-tab-nav` và hướng dẫn Workflow (`.workflow-steps-bar`).
   - Các nút bấm chung (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ai`...).
   - Toàn bộ giao diện **Tab 1: Dựng Video (Timeline)**:
     - Studio workspace grid, Studio player canvas preview, Scrubber & Controls.
     - Quick Inspector Panel (chỉnh text, font, màu sắc, vị trí từng ảnh/clip).
     - Multi-selection toolbar & Storyboard ribbon (dải phân cảnh cuộn ngang).
     - Audio waveform container & playhead.
     - Sidebar settings (Aspect ratio, Quality, Zoom, Pan, Fade, BGM).
   - Hệ thống Modals của Tab 1:
     - Fullscreen canvas preview modal & Render Progress modal.
     - AI Script Match modal & AI Scene cards.
     - Video Trimmer & Splitter modal (dual-range scrubber, micro-adjust).
     - AI Script & Pacing Auditor modal.
     - AI Visual Alignment (Smart Image Swapper) modal.
     - Custom Motion Distribution modal.
2. `public/subtitles.css` (852 dòng): Giao diện **Tab 2: Auto Subtitle AI (Word-Level)**. Đang chứa cả định nghĩa `.main-tab-nav` và `.tab-pane`.
3. `public/watermark.css` (298 dòng): Giao diện **Tab 3: Logo & Watermark Studio**.
4. `public/qa.css` (399 dòng): Giao diện **Tab 4: Kiểm Định Video AI (QA Final)**.

---

## 2. Kiến trúc Module CSS mục tiêu (Target Architecture)

Tương tự như cấu trúc module hóa JavaScript đã thành công rất tốt trong `public/js/`, chúng ta sẽ tổ chức cấu trúc CSS dạng thư mục `public/css/`:

```text
public/
├── style.backup.css           <-- [BACKUP GỐC] Bản sao nguyên vẹn của style.css để đối chiếu tham chiếu
├── css/
│   ├── base.css               <-- 1. Biến CSS (:root), Reset, Typography, Body background, Animations chung
│   ├── components.css         <-- 2. Nút bấm (.btn, .btn-ai...), Form controls, Sliders, Stepper, Dropdown menu (.top-nav, .ai-dropdown-menu)
│   ├── tabs-nav.css           <-- 3. Thanh chuyển Tab (.main-tab-nav, .tab-btn), .workflow-steps-bar, .tab-pane container
│   ├── tab1-editor.css        <-- 4. Toàn bộ Workspace Tab 1 (Canvas player, Timeline ribbon, Storyboard cards, Media cards, Sidebar settings, BGM)
│   ├── tab1-modals.css        <-- 5. Toàn bộ Modals của Tab 1 (Render modal, Video Trimmer, AI Modals: Pacing, Alignment, Motion distribution)
│   ├── tab2-subtitles.css     <-- 6. Di chuyển/chuẩn hóa từ subtitles.css (Tab 2: Word-Level Subtitles & Waveform)
│   ├── tab3-watermark.css     <-- 7. Di chuyển/chuẩn hóa từ watermark.css (Tab 3: Watermark & Delogo)
│   └── tab4-qa.css            <-- 8. Di chuyển/chuẩn hóa từ qa.css (Tab 4: AI QA Auditor)
└── index.html                 <-- Cập nhật danh sách link rel="stylesheet"
```

---

## 3. Phân rã chi tiết nội dung các file

### 🔹 File 0: `public/style.backup.css`
- **Mục đích**: Lưu giữ nguyên vẹn 100% nội dung của `public/style.css` trước bất kỳ chỉnh sửa nào.
- **Tác dụng**: Dùng lệnh so sánh diff (`git diff` hoặc công cụ so sánh) để kiểm tra đảm bảo từng class CSS, thuộc tính và animation không bị sót hoặc thay đổi ngoài ý muốn.

---

### 🔹 File 1: `public/css/base.css` (~100 dòng)
- **Nội dung trích xuất từ `style.css`**:
  - Dòng 1 - 54:
    - `:root` (biến màu sắc `--primary`, `--bg-main`, `--accent-cyan`, `--radius-md`, v.v.).
    - Global reset `* { box-sizing: border-box; margin: 0; padding: 0; }`.
    - `body` style (nền radial-gradient, font Outfit, line-height).
    - `.app-container` (max-width: 1540px, padding).
  - Các animation keyframes dùng chung:
    - `@keyframes spin`, `@keyframes fadeInTab`, `@keyframes pulseCta`, `@keyframes gradientShift`, v.v.

---

### 🔹 File 2: `public/css/components.css` (~350 dòng)
- **Nội dung trích xuất từ `style.css`**:
  - Header & Top Navbar:
    - `.top-nav` (với `position: relative; z-index: 100;`), `.nav-brand`, `.brand-icon`, `.brand-text`, `.nav-actions`, `.nav-btn-group`.
  - AI Dropdown Menu:
    - `.nav-ai-dropdown-wrap`, `.dropdown-caret`, `.ai-dropdown-menu`, `.dropdown-category`, `.dropdown-item`, `.item-icon`, `.item-text`.
  - Buttons System:
    - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-small`, `.btn-xs`, `.btn-icon`, `.btn-ai`, `.btn-ai-action`, `.btn-render-cta`.
  - Common Form Controls:
    - `.custom-select`, `.custom-range`, `.custom-textarea`, `.stepper-input-group`, `.btn-stepper`, `.color-picker-wrap`, `.form-label-xs`, `.form-label-micro`.
  - Utility Classes:
    - `.text-center`, `.flex-between`, `.hidden`, `.mt-2`, `.mt-3`, `.mt-4`, `.w-100`, v.v.

---

### 🔹 File 3: `public/css/tabs-nav.css` (~120 dòng)
- **Nội dung**:
  - Gom từ `subtitles.css` (dòng 1 - 58) và `style.css` (dòng 239 - 305):
    - `.main-tab-nav`, `.tab-btn`, `.tab-btn.active`, `.tab-badge`.
    - `.tab-pane`, `.tab-pane.active`.
    - Workflow progress guide: `.workflow-steps-bar`, `.step-item`, `.step-badge`, `.step-info`, `.step-arrow`.
- **Lợi ích**: Tách hẳn phần điều hướng chuyển đổi giữa các tab ra riêng biệt, không bị phụ thuộc vào file của Tab 2 như trước.

---

### 🔹 File 4: `public/css/tab1-editor.css` (~1200 dòng)
- **Nội dung trích xuất từ `style.css`**:
  - Dựng layout Studio:
    - `.studio-workspace-grid`, `.studio-sidebar-left`, `.studio-center-stage`, `.studio-bottom-timeline`.
  - Player Canvas:
    - `.studio-player-wrap`, `.studio-player-container`, `#studio-preview-canvas`, `.studio-player-overlay-info`, `.studio-player-controls`, `.studio-scrubber`, `.studio-time-badge`.
  - Upload & Dropzone:
    - `.upload-zone-compact`, `.upload-compact-content`, `.upload-mini-icon`.
  - Quick Inspector Panel:
    - `.quick-inspector-panel`, `.inspector-header`, `.inspector-title`, `.inspector-fields-grid`, `.inspector-text-row`, text overlay styling.
  - Multi-Selection Toolbar:
    - `.multi-select-action-bar`, `.multi-select-info`, `.multi-btn-subgroup`.
  - Storyboard Ribbon & Cards:
    - `.storyboard-ribbon`, `.storyboard-card`, `.storyboard-thumb-box`, `.storyboard-meta-strip`, `.storyboard-add-card`, `.storyboard-placeholder-card`.
  - Audio Waveform Bar:
    - `.audio-waveform-container`, `.waveform-header`, `.waveform-canvas-wrap`, `#audio-waveform-canvas`, `.waveform-playhead`.
  - Sidebar Controls:
    - `.settings-card`, `.aspect-ratio-selector`, `.ratio-option`, `.setting-row`, `.fade-inputs-grid`, `.bgm-panel`, `.tips-card`.
  - Drag & Drop Storyboard cards, hotkey hints.

---

### 🔹 File 5: `public/css/tab1-modals.css` (~1500 dòng)
- **Nội dung trích xuất từ `style.css`**:
  - Base Modal Framework:
    - `.modal`, `.modal-backdrop`, `.modal-dialog`, `.modal-header`, `.btn-close`.
  - Fullscreen Canvas Preview & Render Progress:
    - `.preview-dialog`, `.canvas-container`, `#preview-canvas`, `.render-body`, `.progress-ring-container`, `.spinner-neon`, `.progress-bar-fill`.
  - AI Script Match Modal:
    - `.ai-dialog`, `.ai-badge`, `.api-key-box`, `.ai-scenes-list`, `.ai-scene-card`.
  - AI Video Trimmer & Splitter Modal:
    - `.trimmer-dialog`, `.trimmer-video-wrapper`, `.trimmer-timeline-box`, `.trimmer-timeline-track`, `.trimmer-handle`, `.trimmer-adjust-grid`.
  - AI Script & Pacing Auditor Modal:
    - `.modal-pacing-dialog`, `.pacing-scenes-list`, `.pacing-scene-card`, `.pacing-duration-diff-row`.
  - AI Visual Alignment (Smart Swapper) Modal:
    - `.modal-alignment-dialog`, `.alignment-scenes-list`, `.alignment-scene-card`, `.alignment-thumbs-comparison`.
  - Custom Motion Distribution Modal:
    - `.motion-checkboxes-grid`, `.distribution-mode-grid`, `.motion-preview-ribbon`.

---

### 🔹 File 6, 7, 8: Chuẩn hóa các Tab 2, Tab 3, Tab 4
- `public/css/tab2-subtitles.css`: Chuyển từ `public/subtitles.css` (đã lược bỏ `.main-tab-nav` vì đã đưa vào `tabs-nav.css`).
- `public/css/tab3-watermark.css`: Chuyển từ `public/watermark.css`.
- `public/css/tab4-qa.css`: Chuyển từ `public/qa.css`.

---

## 4. Kế hoạch nhập stylesheet tại `index.html`

Cập nhật thẻ `<head>` trong [public/index.html](file:///c:/Users/ADMIN/Desktop/VideoTool/edit%20tool/public/index.html):
```html
<!-- Core & Global Layout Styles -->
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/tabs-nav.css">

<!-- Tab 1: Video Editor & Modals -->
<link rel="stylesheet" href="css/tab1-editor.css">
<link rel="stylesheet" href="css/tab1-modals.css">

<!-- Tab 2, 3, 4 Extensions -->
<link rel="stylesheet" href="css/tab2-subtitles.css">
<link rel="stylesheet" href="css/tab3-watermark.css">
<link rel="stylesheet" href="css/tab4-qa.css">
```

---

## 5. Các bước thực hiện an toàn (Execution Steps)

1. **Bước 1: Tạo bản sao lưu dự phòng (Backup)**
   - Sao chép nguyên trạng `public/style.css` thành `public/style.backup.css`.
   - Sao chép `public/subtitles.css` thành `public/subtitles.backup.css`.
2. **Bước 2: Tạo thư mục `public/css/`**
3. **Bước 3: Chiết xuất lần lượt các file CSS mới theo danh sách phân rã**
   - Đảm bảo giữ đúng thứ tự quy tắc cascade để không bị lỗi đè thuộc tính.
4. **Bước 4: Cập nhật thẻ liên kết stylesheet trong `public/index.html`**
5. **Bước 5: Kiểm tra xác thực (Validation)**
   - Kiểm tra giao diện Tab 1: Timeline, Canvas, Drag/Drop, Settings, Inspector.
   - Kiểm tra mở các Modal: AI Studio Dropdown, Trimmer modal, Pacing modal, Alignment modal, Render modal.
   - Kiểm tra giao diện Tab 2 (Auto Subtitle AI), Tab 3 (Watermark), Tab 4 (QA).
   - Đảm bảo console trình duyệt không có lỗi cú pháp hoặc 404 CSS.

---
*Kế hoạch đã được lưu lại để sẵn sàng thực hiện khi bạn duyệt.*
