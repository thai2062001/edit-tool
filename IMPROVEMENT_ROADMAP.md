# 🚀 Kế Hoạch Cải Tiến & Roadmap Nâng Cấp Tab 1 (Dựng Video Timeline)

Tài liệu này tổng hợp 4 nhóm tính năng cải tiến cốt lõi đã được thảo luận nhằm nâng cấp trải nghiệm dựng video, đồng bộ âm thanh và tối ưu thao tác biên tập trên hệ thống.

---

## 1. 🎵 Đồng Bộ Âm Thanh Chuyên Nghiệp & Audio Waveform
- **Hiển thị Dải sóng âm (Audio Waveform)**:
  - Tích hợp biểu đồ sóng âm thanh trực quan bên dưới thanh Storyboard Ribbon khi nạp BGM / File giọng đọc.
  - Người dùng có thể nhìn thấy rõ các đoạn nói to, nói nhỏ, khoảng ngắt nhịp (silence/pause) để căn chỉnh mép từng bức ảnh cho khớp chính xác từng giây.
- **Tự động Co / Dãn Timeline phủ kín Audio (Fit Timeline to Audio)**:
  - Cung cấp nút 1-chạm tự động co dãn theo tỷ lệ hoặc chia đều thời lượng toàn bộ ảnh hiện có trên Timeline sao cho vừa khít 100% độ dài bài nhạc hoặc file thu âm giọng đọc.

---

## 2. ⚡ Hệ Thống Undo / Redo & Chọn Nhiều Phân Cảnh (Multi-Select)
- **Lịch sử thao tác (Undo / Redo)**:
  - Hỗ trợ phím tắt `Ctrl + Z` (Hoàn tác) và `Ctrl + Y` (Làm lại) khi lỡ tay xóa nhầm cảnh, di chuyển vị trí, hoặc gán nhầm hiệu ứng.
- **Chọn nhiều ảnh cùng lúc (Multi-Select)**:
  - Hỗ trợ giữ phím `Ctrl + Click` (hoặc `Shift + Click`) để chọn một nhóm nhiều phân cảnh bất kỳ trên Timeline.
  - Cho phép thực hiện thao tác hàng loạt cho riêng nhóm ảnh đã chọn: đổi thời lượng, đổi hiệu ứng chuyển động, xóa đồng thời nhiều cảnh.
- **Tùy chỉnh Điểm Trọng Tâm Zoom (Focus Point)**:
  - Cho phép người dùng bấm trực tiếp vào ảnh để đặt điểm neo trọng tâm muốn Zoom (ví dụ: Zoom vào khuôn mặt nhân vật hoặc góc sản phẩm cụ thể).

---

## 3. 🎬 Kho Hiệu Ứng Chuyển Cảnh Giữa Các Cảnh (Transitions)
- Mở rộng kho chuyển cảnh giữa các phân đoạn thay vì chỉ có Fade In/Fade Out màu đen cơ bản:
  - **Cross Dissolve / Crossfade**: Mờ chồng mượt mà giữa cảnh A sang cảnh B.
  - **Flash White / Glow Flash**: Chớp sáng chuyển cảnh điện ảnh.
  - **Slide Left / Right / Up / Down**: Trượt cảnh linh hoạt kiểu Shorts/TikTok.
  - **Wipe / Zoom Transition**: Hiệu ứng phóng to lướt qua cảnh mới.

---

## 4. ✅ 🎨 Tùy Chỉnh Màu Sắc, Font Chữ & Kiểu Dáng Text Overlay (ĐÃ HOÀN THÀNH)
- **Color Picker tự do**:
  - Tích hợp 2 bộ Color Picker trực tiếp trên Quick Inspector: Chọn màu chữ (Text Color) và màu viền/phát sáng Neon (Accent/Glow Color) theo mã màu hex bất kỳ.
- **Kho Font chữ Google Fonts Việt Hóa**:
  - Hỗ trợ đa dạng font chữ thời thượng: `Outfit`, `Montserrat`, `Inter`, `Roboto`, `Be Vietnam Pro`, `Bangers (Comic)`, `Playfair Display (Sang trọng)`.
- **Căn lề & Định dạng đoạn văn**:
  - Hỗ trợ căn lề Trái / Giữa / Phải qua cụm nút toggle nhanh.
  - Tự động ngắt dòng thông minh (Smart Word-Wrap) chống tràn khung hình trên cả Canvas Studio Preview và Render Engine FFmpeg backend.
  - Hỗ trợ nút "✨ Đồng bộ tất cả" để áp dụng toàn bộ phong cách chữ cho tất cả các phân cảnh trên Timeline chỉ với 1 click.

---

*Ngày tạo: 03/09/2026 - Dự án Ist-dev Video Editor*
