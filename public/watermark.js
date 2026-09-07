/**
 * Tab 3: Logo & Watermark Studio
 * Frontend Controller for Brand Logo Watermarking and AI Delogo/Inpaint
 */

(function () {
    'use strict';

    const WmState = {
        currentMedia: null,
        activeMode: 'logo', // 'logo' | 'delogo'
        logoSettings: {
            logoFilename: null,
            logoUrl: null,
            position: 'bottom_right',
            opacity: 0.9,
            scalePercent: 18,
            margin: 20
        },
        delogoSettings: {
            x: 80,
            y: 80,
            w: 160,
            h: 65,
            filterType: 'delogo' // 'delogo' | 'blur' | 'crop'
        }
    };

    let dom = {};

    function init() {
        getDomElements();
        bindEvents();
    }

    function getDomElements() {
        dom = {
            // Tab Buttons
            tabBtnWatermark: document.getElementById('tab-btn-watermark'),
            tabPaneWatermark: document.getElementById('tab-pane-watermark'),

            // Preview elements
            wmVideoContainer: document.getElementById('wm-video-container'),
            wmVideoPlayer: document.getElementById('wm-video-player'),
            wmLogoOverlay: document.getElementById('wm-logo-overlay'),
            wmDelogoGuide: document.getElementById('wm-delogo-guide'),
            wmMediaNameLabel: document.getElementById('wm-media-name-label'),
            wmBtnUseEditorVideo: document.getElementById('wm-btn-use-editor-video'),
            wmFileInput: document.getElementById('wm-file-input'),

            // Mode Navigation
            btnModeLogo: document.getElementById('btn-mode-logo'),
            btnModeDelogo: document.getElementById('btn-mode-delogo'),
            wmPanelLogo: document.getElementById('wm-panel-logo'),
            wmPanelDelogo: document.getElementById('wm-panel-delogo'),

            // Logo Controls
            wmLogoInput: document.getElementById('wm-logo-input'),
            wmLogoDropzone: document.getElementById('wm-logo-dropzone'),
            wmLogoPreviewImg: document.getElementById('wm-logo-preview-img'),
            wmScaleSlider: document.getElementById('wm-scale-slider'),
            wmScaleVal: document.getElementById('wm-scale-val'),
            wmOpacitySlider: document.getElementById('wm-opacity-slider'),
            wmOpacityVal: document.getElementById('wm-opacity-val'),
            wmMarginSlider: document.getElementById('wm-margin-slider'),
            wmMarginVal: document.getElementById('wm-margin-val'),
            wmPosButtons: document.querySelectorAll('.wm-position-grid .pos-btn'),

            // Delogo Controls
            delogoPresets: document.querySelectorAll('.delogo-preset-chip'),
            delogoFilterType: document.getElementById('delogo-filter-type'),
            delogoX: document.getElementById('delogo-x'),
            delogoY: document.getElementById('delogo-y'),
            delogoW: document.getElementById('delogo-w'),
            delogoH: document.getElementById('delogo-h'),

            // Action CTA
            btnProcessWatermark: document.getElementById('btn-process-watermark')
        };
    }

    function bindEvents() {
        // Tab switching
        if (dom.tabBtnWatermark) {
            dom.tabBtnWatermark.addEventListener('click', () => {
                if (typeof window.switchMainTab === 'function') {
                    window.switchMainTab('tab-btn-watermark');
                } else {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    dom.tabBtnWatermark.classList.add('active');
                    if (dom.tabPaneWatermark) dom.tabPaneWatermark.classList.add('active');
                }
                if (!WmState.currentMedia) {
                    grabMediaFromEditor(true);
                }
            });
        }

        // Mode Switching
        if (dom.btnModeLogo) {
            dom.btnModeLogo.addEventListener('click', () => switchMode('logo'));
        }
        if (dom.btnModeDelogo) {
            dom.btnModeDelogo.addEventListener('click', () => switchMode('delogo'));
        }

        // Media Source selection
        if (dom.wmBtnUseEditorVideo) {
            dom.wmBtnUseEditorVideo.addEventListener('click', () => grabMediaFromEditor(false));
        }
        if (dom.wmFileInput) {
            dom.wmFileInput.addEventListener('change', handleMediaUpload);
        }

        // Logo Upload
        if (dom.wmLogoDropzone) {
            dom.wmLogoDropzone.addEventListener('click', () => dom.wmLogoInput.click());
            dom.wmLogoDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dom.wmLogoDropzone.style.borderColor = 'var(--accent-cyan)';
            });
            dom.wmLogoDropzone.addEventListener('dragleave', () => {
                dom.wmLogoDropzone.style.borderColor = '';
            });
            dom.wmLogoDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dom.wmLogoDropzone.style.borderColor = '';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    uploadLogoFile(e.dataTransfer.files[0]);
                }
            });
        }
        if (dom.wmLogoInput) {
            dom.wmLogoInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    uploadLogoFile(e.target.files[0]);
                }
            });
        }

        // Logo Position grid
        if (dom.wmPosButtons) {
            dom.wmPosButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    dom.wmPosButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    WmState.logoSettings.position = btn.dataset.pos;
                    updatePreviewOverlay();
                });
            });
        }

        // Logo Sliders
        if (dom.wmScaleSlider) {
            dom.wmScaleSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                WmState.logoSettings.scalePercent = val;
                if (dom.wmScaleVal) dom.wmScaleVal.textContent = `${val}%`;
                updatePreviewOverlay();
            });
        }
        if (dom.wmOpacitySlider) {
            dom.wmOpacitySlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                WmState.logoSettings.opacity = val;
                if (dom.wmOpacityVal) dom.wmOpacityVal.textContent = `${Math.round(val * 100)}%`;
                updatePreviewOverlay();
            });
        }
        if (dom.wmMarginSlider) {
            dom.wmMarginSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                WmState.logoSettings.margin = val;
                if (dom.wmMarginVal) dom.wmMarginVal.textContent = `${val}px`;
                updatePreviewOverlay();
            });
        }

        // Delogo Presets
        if (dom.delogoPresets) {
            dom.delogoPresets.forEach(chip => {
                chip.addEventListener('click', () => {
                    dom.delogoPresets.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    applyDelogoPreset(chip.dataset.preset);
                });
            });
        }

        // Delogo Inputs
        [dom.delogoX, dom.delogoY, dom.delogoW, dom.delogoH].forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    WmState.delogoSettings.x = parseInt(dom.delogoX.value) || 0;
                    WmState.delogoSettings.y = parseInt(dom.delogoY.value) || 0;
                    WmState.delogoSettings.w = parseInt(dom.delogoW.value) || 120;
                    WmState.delogoSettings.h = parseInt(dom.delogoH.value) || 50;
                    updatePreviewOverlay();
                });
            }
        });

        if (dom.delogoFilterType) {
            dom.delogoFilterType.addEventListener('change', (e) => {
                WmState.delogoSettings.filterType = e.target.value;
            });
        }

        // Action Trigger
        if (dom.btnProcessWatermark) {
            dom.btnProcessWatermark.addEventListener('click', processWatermarkVideo);
        }

        // Initialize Interactive Drag & Drop on Video Player
        setupDragAndDrop();
    }

    // Setup Drag-and-Drop for Logo Overlay and Delogo Bounding Box
    function setupDragAndDrop() {
        // Draggable Logo Overlay
        setupDraggableElement(dom.wmLogoOverlay, (xPct, yPct) => {
            WmState.logoSettings.position = 'custom';
            WmState.logoSettings.xPct = Math.round(xPct);
            WmState.logoSettings.yPct = Math.round(yPct);
            if (dom.wmPosButtons) {
                dom.wmPosButtons.forEach(b => b.classList.remove('active'));
            }
        });

        // Draggable Delogo Guide Box
        setupDraggableElement(dom.wmDelogoGuide, (xPct, yPct) => {
            WmState.delogoSettings.x = Math.round(xPct);
            WmState.delogoSettings.y = Math.round(yPct);
            if (dom.delogoX) dom.delogoX.value = Math.round(xPct);
            if (dom.delogoY) dom.delogoY.value = Math.round(yPct);
            if (dom.delogoPresets) {
                dom.delogoPresets.forEach(c => c.classList.remove('active'));
                const customChip = document.querySelector('.delogo-preset-chip[data-preset="custom"]');
                if (customChip) customChip.classList.add('active');
            }
        });
    }

    function setupDraggableElement(el, onMoveCallback) {
        if (!el) return;

        let isDragging = false;
        let startMouseX = 0, startMouseY = 0;
        let startElemLeft = 0, startElemTop = 0;

        function startDrag(e) {
            if (!dom.wmVideoContainer) return;
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            el.classList.add('dragging');

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            startMouseX = clientX;
            startMouseY = clientY;

            const rect = dom.wmVideoContainer.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();

            startElemLeft = elRect.left - rect.left;
            startElemTop = elRect.top - rect.top;

            window.addEventListener('mousemove', moveDrag);
            window.addEventListener('mouseup', endDrag);
            window.addEventListener('touchmove', moveDrag, { passive: false });
            window.addEventListener('touchend', endDrag);
        }

        function moveDrag(e) {
            if (!isDragging || !dom.wmVideoContainer) return;
            if (e.cancelable) e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startMouseX;
            const dy = clientY - startMouseY;

            const rect = dom.wmVideoContainer.getBoundingClientRect();
            const elWidth = el.offsetWidth;
            const elHeight = el.offsetHeight;

            let newLeft = Math.max(0, Math.min(rect.width - elWidth, startElemLeft + dx));
            let newTop = Math.max(0, Math.min(rect.height - elHeight, startElemTop + dy));

            const xPct = (newLeft / rect.width) * 100;
            const yPct = (newTop / rect.height) * 100;

            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.transform = 'none';

            if (typeof onMoveCallback === 'function') {
                onMoveCallback(xPct, yPct);
            }
        }

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging');
            window.removeEventListener('mousemove', moveDrag);
            window.removeEventListener('mouseup', endDrag);
            window.removeEventListener('touchmove', moveDrag);
            window.removeEventListener('touchend', endDrag);
        }

        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive: false });
    }

    function switchMode(mode) {
        WmState.activeMode = mode;
        if (mode === 'logo') {
            dom.btnModeLogo.classList.add('active');
            dom.btnModeDelogo.classList.remove('active');
            dom.wmPanelLogo.classList.remove('hidden');
            dom.wmPanelDelogo.classList.add('hidden');
            if (dom.btnProcessWatermark) {
                dom.btnProcessWatermark.innerHTML = '<span class="icon">⚡</span> Xuất Video Với Logo Đã Chèn';
            }
        } else {
            dom.btnModeDelogo.classList.add('active');
            dom.btnModeLogo.classList.remove('active');
            dom.wmPanelDelogo.classList.remove('hidden');
            dom.wmPanelLogo.classList.add('hidden');
            if (dom.btnProcessWatermark) {
                dom.btnProcessWatermark.innerHTML = '<span class="icon">🧹</span> Xuất Video Đã Xóa Watermark';
            }
        }
        updatePreviewOverlay();
    }

    // Media Grabber from Tab 1
    function grabMediaFromEditor(silent = false) {
        const renderedPlayer = document.getElementById('rendered-video-player');
        if (renderedPlayer && renderedPlayer.src && !renderedPlayer.src.endsWith('#')) {
            const url = renderedPlayer.src;
            const filename = url.substring(url.lastIndexOf('/') + 1);
            setMedia({
                filename,
                url,
                duration: renderedPlayer.duration || 10,
                type: 'video',
                originalName: `Video vừa render (${filename})`
            });
            if (!silent) showToast('🎬 Đã lấy video vừa xuất từ Tab 1!');
            return;
        }

        if (window.mediaItems && window.mediaItems.length > 0) {
            const firstItem = window.mediaItems[0];
            setMedia({
                filename: firstItem.filename,
                url: firstItem.url,
                duration: Number(firstItem.settings?.duration || firstItem.duration || 5.0),
                type: firstItem.type,
                originalName: firstItem.originalName || 'Tệp từ Timeline Tab 1'
            });
            if (!silent) showToast(`🖼️ Đã nạp ${firstItem.type === 'image' ? 'ảnh' : 'video'} từ Tab 1!`);
            return;
        }

        if (!silent) {
            alert('Chưa có video/ảnh nào ở Tab 1. Hãy sang Tab 1 nạp dữ liệu hoặc tải tệp từ máy tính.');
        }
    }

    function handleMediaUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        if (dom.wmMediaNameLabel) {
            dom.wmMediaNameLabel.textContent = `Đang tải: ${file.name}...`;
        }

        fetch('/api/subtitles/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.file) {
                setMedia(data.file);
                showToast(`📁 Đã nạp tệp: ${data.file.originalName}`);
            } else {
                alert('Lỗi tải tệp: ' + (data.error || 'Thử lại'));
            }
        })
        .catch(err => {
            alert('Lỗi kết nối khi tải tệp');
        });
    }

    function setMedia(fileObj) {
        WmState.currentMedia = fileObj;
        if (dom.wmVideoPlayer) {
            if (fileObj.type === 'image') {
                dom.wmVideoPlayer.poster = fileObj.url;
                dom.wmVideoPlayer.src = '';
            } else {
                dom.wmVideoPlayer.poster = '';
                dom.wmVideoPlayer.src = fileObj.url;
                dom.wmVideoPlayer.load();
            }
        }
        if (dom.wmMediaNameLabel) {
            dom.wmMediaNameLabel.innerHTML = `🎥 Đang chọn: <strong>${escapeHtml(fileObj.originalName)}</strong> (${(fileObj.duration || 5.0).toFixed(1)}s)`;
        }
        updatePreviewOverlay();
    }

    // Logo Upload Function
    function uploadLogoFile(file) {
        if (!file) return;
        const formData = new FormData();
        formData.append('logo', file);

        fetch('/api/watermark/upload-logo', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.file) {
                WmState.logoSettings.logoFilename = data.file.filename;
                WmState.logoSettings.logoUrl = data.file.url;
                if (dom.wmLogoPreviewImg) {
                    dom.wmLogoPreviewImg.src = data.file.url;
                    dom.wmLogoPreviewImg.classList.remove('hidden');
                }
                showToast(`✨ Đã nạp Logo: ${data.file.originalName}`);
                updatePreviewOverlay();
            } else {
                alert('Lỗi tải logo: ' + (data.error || 'Thử lại'));
            }
        })
        .catch(err => {
            alert('Lỗi kết nối khi tải logo');
        });
    }

    // Delogo Preset Selection
    function applyDelogoPreset(preset) {
        switch (preset) {
            case 'gemini_br': // Bottom Right (Standard Gemini/AI watermark)
                WmState.delogoSettings.x = 82;
                WmState.delogoSettings.y = 88;
                WmState.delogoSettings.w = 15;
                WmState.delogoSettings.h = 9;
                break;
            case 'bottom_left':
                WmState.delogoSettings.x = 3;
                WmState.delogoSettings.y = 88;
                WmState.delogoSettings.w = 16;
                WmState.delogoSettings.h = 9;
                break;
            case 'top_right':
                WmState.delogoSettings.x = 82;
                WmState.delogoSettings.y = 4;
                WmState.delogoSettings.w = 15;
                WmState.delogoSettings.h = 8;
                break;
            case 'custom':
                break;
        }

        if (dom.delogoX) dom.delogoX.value = WmState.delogoSettings.x;
        if (dom.delogoY) dom.delogoY.value = WmState.delogoSettings.y;
        if (dom.delogoW) dom.delogoW.value = WmState.delogoSettings.w;
        if (dom.delogoH) dom.delogoH.value = WmState.delogoSettings.h;

        updatePreviewOverlay();
    }

    // Real-time Visual Overlay on Live Preview
    function updatePreviewOverlay() {
        if (WmState.activeMode === 'logo') {
            if (dom.wmDelogoGuide) dom.wmDelogoGuide.style.display = 'none';

            if (WmState.logoSettings.logoUrl && dom.wmLogoOverlay) {
                dom.wmLogoOverlay.style.display = 'block';
                dom.wmLogoOverlay.innerHTML = `<img src="${WmState.logoSettings.logoUrl}" style="opacity: ${WmState.logoSettings.opacity}; width: 100%;">`;
                dom.wmLogoOverlay.style.width = `${WmState.logoSettings.scalePercent}%`;

                // Calculate Position in Container
                const margin = WmState.logoSettings.margin;
                const pos = WmState.logoSettings.position;

                dom.wmLogoOverlay.style.top = 'auto';
                dom.wmLogoOverlay.style.bottom = 'auto';
                dom.wmLogoOverlay.style.left = 'auto';
                dom.wmLogoOverlay.style.right = 'auto';
                dom.wmLogoOverlay.style.transform = 'none';

                if (pos === 'custom' && WmState.logoSettings.xPct !== undefined && WmState.logoSettings.yPct !== undefined) {
                    dom.wmLogoOverlay.style.left = `${WmState.logoSettings.xPct}%`;
                    dom.wmLogoOverlay.style.top = `${WmState.logoSettings.yPct}%`;
                    dom.wmLogoOverlay.style.right = 'auto';
                    dom.wmLogoOverlay.style.bottom = 'auto';
                    dom.wmLogoOverlay.style.transform = 'none';
                } else {
                    switch (pos) {
                        case 'top_left':
                            dom.wmLogoOverlay.style.top = `${margin}px`;
                            dom.wmLogoOverlay.style.left = `${margin}px`;
                            break;
                        case 'top_center':
                            dom.wmLogoOverlay.style.top = `${margin}px`;
                            dom.wmLogoOverlay.style.left = '50%';
                            dom.wmLogoOverlay.style.transform = 'translateX(-50%)';
                            break;
                        case 'top_right':
                            dom.wmLogoOverlay.style.top = `${margin}px`;
                            dom.wmLogoOverlay.style.right = `${margin}px`;
                            break;
                        case 'center_left':
                            dom.wmLogoOverlay.style.top = '50%';
                            dom.wmLogoOverlay.style.left = `${margin}px`;
                            dom.wmLogoOverlay.style.transform = 'translateY(-50%)';
                            break;
                        case 'center':
                            dom.wmLogoOverlay.style.top = '50%';
                            dom.wmLogoOverlay.style.left = '50%';
                            dom.wmLogoOverlay.style.transform = 'translate(-50%, -50%)';
                            break;
                        case 'center_right':
                            dom.wmLogoOverlay.style.top = '50%';
                            dom.wmLogoOverlay.style.right = `${margin}px`;
                            dom.wmLogoOverlay.style.transform = 'translateY(-50%)';
                            break;
                        case 'bottom_left':
                            dom.wmLogoOverlay.style.bottom = `${margin}px`;
                            dom.wmLogoOverlay.style.left = `${margin}px`;
                            break;
                        case 'bottom_center':
                            dom.wmLogoOverlay.style.bottom = `${margin}px`;
                            dom.wmLogoOverlay.style.left = '50%';
                            dom.wmLogoOverlay.style.transform = 'translateX(-50%)';
                            break;
                        case 'bottom_right':
                        default:
                            dom.wmLogoOverlay.style.bottom = `${margin}px`;
                            dom.wmLogoOverlay.style.right = `${margin}px`;
                            break;
                    }
                }
            } else if (dom.wmLogoOverlay) {
                dom.wmLogoOverlay.style.display = 'none';
            }
        } else {
            // Mode: Delogo Bounding Box
            if (dom.wmLogoOverlay) dom.wmLogoOverlay.style.display = 'none';

            if (dom.wmDelogoGuide) {
                dom.wmDelogoGuide.style.display = 'block';
                const x = WmState.delogoSettings.x;
                const y = WmState.delogoSettings.y;
                const w = WmState.delogoSettings.w;
                const h = WmState.delogoSettings.h;

                dom.wmDelogoGuide.style.left = `${x}%`;
                dom.wmDelogoGuide.style.top = `${y}%`;
                dom.wmDelogoGuide.style.width = `${w}%`;
                dom.wmDelogoGuide.style.height = `${h}%`;
            }
        }
    }

    // Process Video / Image through Backend FFmpeg
    async function processWatermarkVideo() {
        if (!WmState.currentMedia) {
            alert('Vui lòng chọn video hoặc ảnh nguồn trước khi xử lý!');
            return;
        }

        if (WmState.activeMode === 'logo' && !WmState.logoSettings.logoFilename) {
            alert('Vui lòng tải lên file Logo trước khi xuất video!');
            return;
        }

        const renderModal = document.getElementById('render-modal');
        const renderPercent = document.getElementById('render-percent');
        const renderProgressBar = document.getElementById('render-progress-bar');
        const renderStatusText = document.getElementById('render-status-text');
        const renderStateProcessing = document.getElementById('render-state-processing');
        const renderStateCompleted = document.getElementById('render-state-completed');
        const renderStateError = document.getElementById('render-state-error');
        const renderedVideoPlayer = document.getElementById('rendered-video-player');
        const btnDownloadVideo = document.getElementById('btn-download-video');
        const renderTitle = document.getElementById('render-modal-title');

        if (renderTitle) {
            renderTitle.textContent = WmState.activeMode === 'logo' ? '🛡️ Đang Đóng Dấu Logo Với FFmpeg' : '🧹 Đang Xóa Watermark Với FFmpeg Delogo';
        }

        renderModal.classList.remove('hidden');
        renderStateProcessing.classList.remove('hidden');
        renderStateCompleted.classList.add('hidden');
        renderStateError.classList.add('hidden');
        renderPercent.innerText = '0%';
        renderProgressBar.style.width = '0%';
        renderStatusText.innerText = 'Đang khởi chạy bộ lọc FFmpeg...';

        try {
            const res = await fetch('/api/watermark/process-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceFilename: WmState.currentMedia.filename,
                    mode: WmState.activeMode,
                    logoSettings: WmState.logoSettings,
                    delogoSettings: {
                        xPct: Number(WmState.delogoSettings.x),
                        yPct: Number(WmState.delogoSettings.y),
                        wPct: Number(WmState.delogoSettings.w),
                        hPct: Number(WmState.delogoSettings.h),
                        filterType: WmState.delogoSettings.filterType
                    }
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Listen to SSE progress
            const eventSource = new EventSource(`/api/progress/${data.jobId}`);
            eventSource.onmessage = (e) => {
                const job = JSON.parse(e.data);
                renderPercent.innerText = `${job.progress}%`;
                renderProgressBar.style.width = `${job.progress}%`;

                if (job.status === 'completed') {
                    eventSource.close();
                    renderStateProcessing.classList.add('hidden');
                    renderStateCompleted.classList.remove('hidden');
                    renderedVideoPlayer.src = job.outputUrl;
                    btnDownloadVideo.href = job.outputUrl;
                } else if (job.status === 'error') {
                    eventSource.close();
                    renderStateProcessing.classList.add('hidden');
                    renderStateError.classList.remove('hidden');
                    const errorMsg = document.getElementById('render-error-msg');
                    if (errorMsg) errorMsg.innerText = job.error || 'Lỗi khi xử lý video';
                }
            };
        } catch (err) {
            renderStateProcessing.classList.add('hidden');
            renderStateError.classList.remove('hidden');
            const errorMsg = document.getElementById('render-error-msg');
            if (errorMsg) errorMsg.innerText = err.message || 'Lỗi khi gọi máy chủ';
        }
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 28px;
            right: 28px;
            background: linear-gradient(135deg, #6366f1, #06b6d4);
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 9999;
            animation: fadeInTab 0.25s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
