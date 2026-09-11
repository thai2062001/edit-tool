/**
 * TAB 5: AUDIO TO VISUAL (AUDIO ➔ ẢNH KHÔNG PHỤ ĐỀ)
 * Tự động đồng bộ giọng đọc và chuỗi ảnh tài liệu không phụ đề
 * Chuyển cảnh cắt thẳng mượt mà, thuần visual + audio kể chuyện.
 */

(function () {
    'use strict';

    // State for Tab 5 Audio Visual
    const AVState = {
        audioMode: 'single', // 'single' (1 file duy nhất) | 'batch' (loạt audio rời theo từng cảnh)
        audioFile: null,
        audioDuration: 0,
        audioUrl: '',
        audioName: '',
        audioElement: new Audio(),
        batchAudioFiles: [], // [{ file, filename, originalName, url, duration, path }]
        images: [], // [{ id, filename, originalName, url, duration }]
        scenes: [], // [{ id, startTime, endTime, duration, imageIndex, sceneText, reason, voiceAudio }]
        activeSceneIndex: 0,
        isPlaying: false,
        isSwitchingTrack: false,
        animationFrameId: null,
        aspectRatio: '16:9',
        transition: 'none', // Mặc định cắt thẳng (Cut)
        motion: 'zoom_in',   // Mặc định Zoom In nhẹ điện ảnh (mượt mà như Tab 1)
        isRendering: false,
        // Subtitle Sync 1-to-1 State
        enableSubtitles: true,
        subtitleStyle: {
            style: 'banner',       // 'banner' | 'outline' | 'glow' | 'plain'
            position: 'bottom',    // 'bottom' | 'center' | 'top'
            fontSize: 48,
            textColor: '#FFFFFF',
            textAccent: '#06B6D4'
        }
    };

    // Helper: Normalize URL comparison for HTMLAudioElement.src vs relative URL
    function isSameAudioSrc(currentSrc, newUrl) {
        if (!currentSrc || !newUrl) return false;
        try {
            const a = new URL(currentSrc, window.location.origin).href;
            const b = new URL(newUrl, window.location.origin).href;
            return a === b;
        } catch (e) {
            return currentSrc === newUrl || currentSrc.endsWith(newUrl);
        }
    }

    // DOM Elements Cache
    let dom = {};

    function initDOMElements() {
        dom = {
            tabBtn: document.getElementById('tab-btn-audio-visual'),
            tabPane: document.getElementById('tab-pane-audio-visual'),

            // Audio Mode Selector (Option: Single vs Batch)
            btnAudioModeSingle: document.getElementById('btn-av-mode-single'),
            btnAudioModeBatch: document.getElementById('btn-av-mode-batch'),
            audioSingleSection: document.getElementById('av-audio-single-section'),
            audioBatchSection: document.getElementById('av-audio-batch-section'),

            // Single Audio Controls
            audioInput: document.getElementById('av-audio-input'),
            audioDropzone: document.getElementById('av-audio-dropzone'),
            btnLoadAudio: document.getElementById('btn-av-load-audio'),
            btnUseTimelineBgm: document.getElementById('btn-av-use-timeline-bgm'),
            audioBanner: document.getElementById('av-audio-banner'),
            audioNameLabel: document.getElementById('av-audio-name'),
            audioDurLabel: document.getElementById('av-audio-dur'),

            // Batch Audio Controls (Option Mới)
            batchAudioInput: document.getElementById('av-batch-audio-input'),
            batchAudioDropzone: document.getElementById('av-batch-audio-dropzone'),
            btnLoadBatchAudio: document.getElementById('btn-av-load-batch-audio'),
            btnSortBatchAudio: document.getElementById('btn-av-sort-batch-audio'),
            btnClearBatchAudio: document.getElementById('btn-av-clear-batch-audio'),
            batchAudioBanner: document.getElementById('av-batch-audio-banner'),
            batchAudioCountLabel: document.getElementById('av-batch-audio-count-label'),
            batchAudioDurLabel: document.getElementById('av-batch-audio-dur-label'),
            batchAudioSampleLabel: document.getElementById('av-batch-audio-sample-label'),

            // Images Controls
            imagesInput: document.getElementById('av-images-input'),
            imagesDropzone: document.getElementById('av-images-dropzone'),
            btnLoadImages: document.getElementById('btn-av-load-images'),
            btnUseTimelineImages: document.getElementById('btn-av-use-timeline-images'),
            btnSortImages: document.getElementById('btn-av-sort-images'),
            btnClearImages: document.getElementById('btn-av-clear-images'),
            imagesGrid: document.getElementById('av-images-grid'),
            imagesCountBadge: document.getElementById('av-images-count'),

            // Script/Text Input & Settings
            scriptFileInput: document.getElementById('av-script-file-input'),
            btnLoadScriptFile: document.getElementById('btn-av-load-script-file'),
            scriptTextarea: document.getElementById('av-script-textarea'),
            btnCleanScript: document.getElementById('btn-av-clean-script'),
            enableSubtitlesCheck: document.getElementById('av-enable-subtitles'),
            subStyleSelect: document.getElementById('av-sub-style'),
            subPositionSelect: document.getElementById('av-sub-position'),
            subFontSizeSelect: document.getElementById('av-sub-fontsize'),
            subColorInput: document.getElementById('av-sub-color'),
            subAccentInput: document.getElementById('av-sub-accent'),
            subtitleOptionsBox: document.getElementById('av-subtitle-options'),

            transitionSelect: document.getElementById('av-transition-select'),
            motionSelect: document.getElementById('av-motion-select'),
            pauseSelect: document.getElementById('av-pause-select'),
            matchModeSelect: document.getElementById('av-match-mode-select'),
            densitySelect: document.getElementById('av-density-select'),
            validationBanner: document.getElementById('av-match-validation-banner'),
            validationText: document.getElementById('av-validation-text'),
            validationStatus: document.getElementById('av-validation-status'),
            btnRunMatch: document.getElementById('btn-av-run-match'),

            // Player & Canvas
            canvas: document.getElementById('av-live-canvas'),
            playerContainer: document.getElementById('av-player-container'),
            playerBadge: document.getElementById('av-player-badge'),
            btnPlayPause: document.getElementById('btn-av-play-pause'),
            scrubber: document.getElementById('av-scrubber'),
            timeLabel: document.getElementById('av-time-label'),
            aspectChips: document.querySelectorAll('.btn-av-aspect-chip'),

            // Scenes List & Results
            scenesList: document.getElementById('av-scenes-list'),
            scenesCountBadge: document.getElementById('av-scenes-count-badge'),
            btnExportSrt: document.getElementById('btn-av-export-srt'),
            btnExportAss: document.getElementById('btn-av-export-ass'),
            btnApplyToTimeline: document.getElementById('btn-av-apply-timeline'),
            btnExportDirect: document.getElementById('btn-av-export-direct')
        };
    }

    function showToast(msg) {
        if (typeof window.showToastNotification === 'function') {
            window.showToastNotification(msg);
        } else {
            console.log('[AudioVisual]', msg);
        }
    }

    // Bind Event Listeners
    function setupEventListeners() {
        // Tab switching handler
        if (dom.tabBtn) {
            dom.tabBtn.addEventListener('click', () => {
                if (typeof window.switchMainTab === 'function') {
                    window.switchMainTab('tab-btn-audio-visual');
                } else {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    dom.tabBtn.classList.add('active');
                    if (dom.tabPane) dom.tabPane.classList.add('active');
                }
            });
        }

            // Switch between Single Audio Mode and Batch Audio Mode (Option Mới)
            if (dom.btnAudioModeSingle && dom.btnAudioModeBatch) {
                dom.btnAudioModeSingle.addEventListener('click', () => {
                    AVState.audioMode = 'single';
                    dom.btnAudioModeSingle.classList.add('btn-primary', 'active');
                    dom.btnAudioModeSingle.classList.remove('btn-outline');
                    dom.btnAudioModeBatch.classList.remove('btn-primary', 'active');
                    dom.btnAudioModeBatch.classList.add('btn-outline');
                    if (dom.audioSingleSection) dom.audioSingleSection.classList.remove('hidden');
                    if (dom.audioBatchSection) dom.audioBatchSection.classList.add('hidden');
                    updateValidationIndicator();
                });

                dom.btnAudioModeBatch.addEventListener('click', () => {
                    AVState.audioMode = 'batch';
                    dom.btnAudioModeBatch.classList.add('btn-primary', 'active');
                    dom.btnAudioModeBatch.classList.remove('btn-outline');
                    dom.btnAudioModeSingle.classList.remove('btn-primary', 'active');
                    dom.btnAudioModeSingle.classList.add('btn-outline');
                    if (dom.audioBatchSection) dom.audioBatchSection.classList.remove('hidden');
                    if (dom.audioSingleSection) dom.audioSingleSection.classList.add('hidden');
                    updateValidationIndicator();
                });
            }

            // Load Single Audio File
            if (dom.btnLoadAudio && dom.audioInput) {
                dom.btnLoadAudio.addEventListener('click', () => dom.audioInput.click());
                dom.audioInput.addEventListener('change', handleAudioUpload);
            }

            // Drag and drop for Single Audio
            if (dom.audioDropzone) {
                dom.audioDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dom.audioDropzone.style.borderColor = '#06B6D4';
                    dom.audioDropzone.style.background = 'rgba(6, 182, 212, 0.15)';
                });
                dom.audioDropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dom.audioDropzone.style.borderColor = '';
                    dom.audioDropzone.style.background = '';
                });
                dom.audioDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dom.audioDropzone.style.borderColor = '';
                    dom.audioDropzone.style.background = '';
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleAudioUpload({ target: { files: e.dataTransfer.files } });
                    }
                });
            }

            // Batch Audio Controls (Option Mới Thêm)
            if (dom.btnLoadBatchAudio && dom.batchAudioInput) {
                dom.btnLoadBatchAudio.addEventListener('click', () => dom.batchAudioInput.click());
                dom.batchAudioInput.addEventListener('change', handleBatchAudioUpload);
            }

            if (dom.batchAudioDropzone) {
                dom.batchAudioDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dom.batchAudioDropzone.style.borderColor = '#38BDF8';
                    dom.batchAudioDropzone.style.background = 'rgba(56, 189, 248, 0.15)';
                });
                dom.batchAudioDropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dom.batchAudioDropzone.style.borderColor = '';
                    dom.batchAudioDropzone.style.background = '';
                });
                dom.batchAudioDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dom.batchAudioDropzone.style.borderColor = '';
                    dom.batchAudioDropzone.style.background = '';
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleBatchAudioUpload({ target: { files: e.dataTransfer.files } });
                    }
                });
            }

            if (dom.btnSortBatchAudio) {
                dom.btnSortBatchAudio.addEventListener('click', () => {
                    if (!AVState.batchAudioFiles || AVState.batchAudioFiles.length === 0) {
                        alert('Chưa có loạt audio nào để sắp xếp!');
                        return;
                    }
                    sortBatchAudioNaturally();
                    updateBatchAudioUI();
                    showToast(`🔢 Đã sắp xếp ${AVState.batchAudioFiles.length} tệp audio phân cảnh theo thứ tự tự nhiên (1 ➔ N)!`);
                });
            }

            if (dom.btnClearBatchAudio) {
                dom.btnClearBatchAudio.addEventListener('click', () => {
                    if (confirm('Bạn có chắc muốn xóa toàn bộ loạt file audio phân cảnh đã nạp?')) {
                        AVState.batchAudioFiles = [];
                        if (dom.batchAudioInput) dom.batchAudioInput.value = '';
                        if (dom.batchAudioBanner) dom.batchAudioBanner.classList.add('hidden');
                        updateValidationIndicator();
                        showToast('🗑️ Đã xóa toàn bộ loạt file audio!');
                    }
                });
            }

            // Use Timeline BGM
            if (dom.btnUseTimelineBgm) {
                dom.btnUseTimelineBgm.addEventListener('click', () => {
                    if (window.bgmTrack && window.bgmTrack.url) {
                        AVState.audioFile = null;
                        AVState.audioUrl = window.bgmTrack.url;
                        AVState.audioDuration = window.bgmTrack.duration || 0;
                        AVState.audioName = window.bgmTrack.originalName || 'BGM Từ Timeline';
                        AVState.audioElement.src = AVState.audioUrl;
                        updateAudioUI();
                        showToast(`🎵 Đã nhận Voice/Audio từ Timeline: ${AVState.audioName}`);
                    } else {
                        alert('Chưa có nhạc nền/audio nào được nạp trên Timeline Tab 1!');
                    }
                });
            }

            // Load Images
            if (dom.btnLoadImages && dom.imagesInput) {
                dom.btnLoadImages.addEventListener('click', () => dom.imagesInput.click());
                dom.imagesInput.addEventListener('change', handleImagesUpload);
            }

            // Drag and drop for Images
            if (dom.imagesDropzone) {
                dom.imagesDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dom.imagesDropzone.style.borderColor = '#A78BFA';
                    dom.imagesDropzone.style.background = 'rgba(167, 139, 250, 0.15)';
                });
                dom.imagesDropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dom.imagesDropzone.style.borderColor = '';
                    dom.imagesDropzone.style.background = '';
                });
                dom.imagesDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dom.imagesDropzone.style.borderColor = '';
                    dom.imagesDropzone.style.background = '';
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleImagesUpload({ target: { files: e.dataTransfer.files } });
                    }
                });
            }

            // Use Timeline Images
        if (dom.btnUseTimelineImages) {
            dom.btnUseTimelineImages.addEventListener('click', () => {
                if (window.mediaItems && window.mediaItems.length > 0) {
                    const imgs = window.mediaItems.filter(i => i.type === 'image' && !i.isPlaceholder && i.url);
                    if (imgs.length > 0) {
                        AVState.images = JSON.parse(JSON.stringify(imgs));
                        sortImagesNaturally();
                        renderImagesGrid();
                        showToast(`🖼️ Đã lấy và xếp tự nhiên ${imgs.length} ảnh từ Timeline Tab 1!`);
                    } else {
                        alert('Timeline hiện chưa có bức ảnh nào hợp lệ!');
                    }
                } else {
                    alert('Timeline Tab 1 đang trống!');
                }
            });
        }

        // Sort Images by Name (1 -> N natural sorting)
        if (dom.btnSortImages) {
            dom.btnSortImages.addEventListener('click', () => {
                if (!AVState.images || AVState.images.length === 0) {
                    alert('Chưa có ảnh nào để sắp xếp!');
                    return;
                }
                sortImagesNaturally();
                renderImagesGrid();
                showToast(`🔢 Đã sắp xếp ${AVState.images.length} ảnh theo đúng thứ tự tên file (1 ➔ N)!`);
            });
        }

        // Clear Images Pool
        if (dom.btnClearImages) {
            dom.btnClearImages.addEventListener('click', () => {
                if (confirm('Bạn có chắc muốn xóa toàn bộ ảnh trong kho của Tab này không?')) {
                    AVState.images = [];
                    renderImagesGrid();
                    showToast('🗑️ Đã xóa sạch kho ảnh!');
                }
            });
        }

        // Script File Loader (.md / .txt / .srt)
        if (dom.btnLoadScriptFile && dom.scriptFileInput) {
            dom.btnLoadScriptFile.addEventListener('click', () => dom.scriptFileInput.click());
            dom.scriptFileInput.addEventListener('change', handleScriptFileUpload);
        }

        // Clean Script Button & Textarea Input Listener
        if (dom.scriptTextarea) {
            dom.scriptTextarea.addEventListener('input', updateValidationIndicator);
        }
        if (dom.btnCleanScript && dom.scriptTextarea) {
            dom.btnCleanScript.addEventListener('click', () => {
                const raw = dom.scriptTextarea.value.trim();
                if (!raw) return;
                const lines = parseScriptLinesSmart(raw);
                dom.scriptTextarea.value = lines.join('\n');
                updateValidationIndicator();
                showToast(`🧹 Đã chuẩn hóa ${lines.length} câu thoại kịch bản!`);
            });
        }

        // Subtitle Style Customization Listeners
        if (dom.enableSubtitlesCheck) {
            dom.enableSubtitlesCheck.addEventListener('change', (e) => {
                AVState.enableSubtitles = e.target.checked;
                if (dom.subtitleOptionsBox) {
                    dom.subtitleOptionsBox.style.opacity = e.target.checked ? '1' : '0.4';
                    dom.subtitleOptionsBox.style.pointerEvents = e.target.checked ? 'auto' : 'none';
                }
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }

        if (dom.subStyleSelect) {
            dom.subStyleSelect.addEventListener('change', (e) => {
                AVState.subtitleStyle.style = e.target.value;
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }
        if (dom.subPositionSelect) {
            dom.subPositionSelect.addEventListener('change', (e) => {
                AVState.subtitleStyle.position = e.target.value;
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }
        if (dom.subFontSizeSelect) {
            dom.subFontSizeSelect.addEventListener('change', (e) => {
                AVState.subtitleStyle.fontSize = parseInt(e.target.value) || 48;
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }
        if (dom.subColorInput) {
            dom.subColorInput.addEventListener('input', (e) => {
                AVState.subtitleStyle.textColor = e.target.value;
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }
        if (dom.subAccentInput) {
            dom.subAccentInput.addEventListener('input', (e) => {
                AVState.subtitleStyle.textAccent = e.target.value;
                drawCanvasAtTime(AVState.audioElement.currentTime || 0);
            });
        }

        // Run AI Match
        if (dom.btnRunMatch) {
            dom.btnRunMatch.addEventListener('click', handleRunAiMatch);
        }

        // Player Controls
        if (dom.btnPlayPause) {
            dom.btnPlayPause.addEventListener('click', togglePlayPause);
        }
        if (dom.scrubber) {
            dom.scrubber.addEventListener('input', (e) => {
                const targetTime = parseFloat(e.target.value);
                if (AVState.audioMode === 'batch') {
                    // Find scene containing targetTime
                    const sIdx = AVState.scenes.findIndex(s => targetTime >= s.startTime && targetTime <= (s.endTime + 0.05));
                    if (sIdx !== -1) {
                        AVState.activeSceneIndex = sIdx;
                        highlightActiveSceneCard(sIdx);
                        const scene = AVState.scenes[sIdx];
                        const localOffset = Math.max(0, targetTime - scene.startTime);
                        const trackUrl = scene.voiceAudio?.url || AVState.batchAudioFiles[sIdx]?.url;
                        if (trackUrl && AVState.audioElement) {
                            if (!isSameAudioSrc(AVState.audioElement.src, trackUrl)) {
                                AVState.isSwitchingTrack = true;
                                AVState.audioElement.src = trackUrl;
                                AVState.audioElement.currentTime = localOffset;
                                AVState.isSwitchingTrack = false;
                            } else {
                                AVState.audioElement.currentTime = localOffset;
                            }
                        }
                    }
                } else if (AVState.audioElement) {
                    AVState.audioElement.currentTime = targetTime;
                }
                drawCanvasAtTime(targetTime);
                updateActiveSceneByTime(targetTime);
            });
        }

        // Aspect Ratio Switcher
        if (dom.aspectChips) {
            dom.aspectChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    dom.aspectChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    const ratio = chip.dataset.ratio || '16:9';
                    setAspectRatio(ratio);
                });
            });
        }

        // Transition & Motion Selectors
        if (dom.transitionSelect) {
            dom.transitionSelect.addEventListener('change', (e) => {
                AVState.transition = e.target.value;
                applySettingsToCurrentScenes();
            });
        }
        if (dom.motionSelect) {
            dom.motionSelect.addEventListener('change', (e) => {
                AVState.motion = e.target.value;
                applySettingsToCurrentScenes();
            });
        }

        // Subtitle Export Handlers (.SRT & .ASS)
        if (dom.btnExportSrt) {
            dom.btnExportSrt.addEventListener('click', handleExportSrt);
        }
        if (dom.btnExportAss) {
            dom.btnExportAss.addEventListener('click', handleExportAss);
        }

        // Apply to Timeline
        if (dom.btnApplyToTimeline) {
            dom.btnApplyToTimeline.addEventListener('click', applyToTimelineEditor);
        }

        // Direct Render
        if (dom.btnExportDirect) {
            dom.btnExportDirect.addEventListener('click', handleExportDirect);
        }

        // 60 FPS RequestAnimationFrame Animation Loop (Kế thừa từ Tab 1 Studio Player)
        function start60FpsAnimationLoop() {
            if (AVState.animationFrameId) {
                cancelAnimationFrame(AVState.animationFrameId);
            }

            function frameStep() {
                if (!AVState.isPlaying) return;

                let cur = 0;
                if (AVState.audioMode === 'batch') {
                    const activeScene = AVState.scenes[AVState.activeSceneIndex];
                    if (activeScene) {
                        cur = parseFloat((activeScene.startTime + (AVState.audioElement.currentTime || 0)).toFixed(2));
                        if (cur > AVState.audioDuration) cur = AVState.audioDuration;
                    }
                } else {
                    cur = AVState.audioElement.currentTime || 0;
                    updateActiveSceneByTime(cur);
                }

                // Smooth scrubber & time label update
                if (dom.scrubber && !dom.scrubber.matches(':active')) {
                    dom.scrubber.value = cur;
                }
                if (dom.timeLabel) {
                    dom.timeLabel.textContent = `${formatTime(cur)} / ${formatTime(AVState.audioDuration)}`;
                }

                // Render 60 FPS canvas with precise sub-frame interpolation
                drawCanvasAtTime(cur);

                AVState.animationFrameId = requestAnimationFrame(frameStep);
            }

            AVState.animationFrameId = requestAnimationFrame(frameStep);
        }

        function stop60FpsAnimationLoop() {
            if (AVState.animationFrameId) {
                cancelAnimationFrame(AVState.animationFrameId);
                AVState.animationFrameId = null;
            }
        }

        // Expose functions for playback control
        AVState.start60FpsAnimationLoop = start60FpsAnimationLoop;
        AVState.stop60FpsAnimationLoop = stop60FpsAnimationLoop;

        // Audio element fallback timeupdate for UI consistency
        AVState.audioElement.addEventListener('timeupdate', () => {
            if (AVState.isSwitchingTrack) return;
            // Chỉ cập nhật tĩnh nếu player đang tạm dừng
            if (!AVState.isPlaying) {
                let cur = AVState.audioElement.currentTime || 0;
                if (AVState.audioMode === 'batch') {
                    const activeScene = AVState.scenes[AVState.activeSceneIndex];
                    if (activeScene) {
                        cur = parseFloat((activeScene.startTime + cur).toFixed(2));
                    }
                }
                drawCanvasAtTime(cur);
            }
        });

        AVState.audioElement.addEventListener('ended', () => {
            if (AVState.isSwitchingTrack) return;
            if (AVState.audioMode === 'batch') {
                if (!AVState.isPlaying) return;
                // In batch mode, proceed to next scene audio track automatically
                const nextIdx = AVState.activeSceneIndex + 1;
                if (nextIdx < AVState.scenes.length) {
                    playSceneAudio(nextIdx);
                    return;
                } else {
                    // Reached the very end of all scenes
                    stop60FpsAnimationLoop();
                    AVState.isPlaying = false;
                    AVState.activeSceneIndex = 0;
                    if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
                    if (dom.scrubber) dom.scrubber.value = 0;
                    if (dom.timeLabel) dom.timeLabel.textContent = `0:00.0 / ${formatTime(AVState.audioDuration)}`;
                    drawCanvasAtTime(0);
                    highlightActiveSceneCard(0, true);
                    return;
                }
            }
            stop60FpsAnimationLoop();
            AVState.isPlaying = false;
            if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
        });
    }

    // Aspect Ratio Changer
    function setAspectRatio(ratio) {
        AVState.aspectRatio = ratio;
        if (dom.playerContainer) {
            dom.playerContainer.classList.remove('ratio-9-16', 'ratio-1-1');
            if (ratio === '9:16') dom.playerContainer.classList.add('ratio-9-16');
            else if (ratio === '1:1') dom.playerContainer.classList.add('ratio-1-1');
        }
        if (dom.canvas) {
            if (ratio === '9:16') {
                dom.canvas.width = 720;
                dom.canvas.height = 1280;
            } else if (ratio === '1:1') {
                dom.canvas.width = 1080;
                dom.canvas.height = 1080;
            } else {
                dom.canvas.width = 1280;
                dom.canvas.height = 720;
            }
        }
        drawCanvasAtTime(AVState.audioElement ? (AVState.audioElement.currentTime || 0) : 0);
        showToast(`📐 Đã đổi tỉ lệ: ${ratio}`);
    }

    // Audio Upload Handler
    async function handleAudioUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        if (dom.audioNameLabel) dom.audioNameLabel.textContent = `Đang tải ${file.name}...`;

        try {
            const res = await fetch('/api/subtitles/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.file) {
                AVState.audioFile = data.file;
                AVState.audioUrl = data.file.url;
                AVState.audioDuration = data.file.duration || 0;
                AVState.audioName = data.file.originalName;
                AVState.audioElement.src = AVState.audioUrl;
                updateAudioUI();
                showToast(`🎙️ Đã tải Voice thành công: ${data.file.originalName}`);
            } else {
                alert('Tải file thất bại: ' + (data.error || 'Lỗi'));
            }
        } catch (err) {
            alert('Lỗi nạp audio: ' + err.message);
        }
    }

    function updateAudioUI() {
        if (dom.audioBanner) dom.audioBanner.classList.remove('hidden');
        if (dom.audioNameLabel) dom.audioNameLabel.textContent = AVState.audioName;
        if (dom.audioDurLabel) dom.audioDurLabel.textContent = `${AVState.audioDuration.toFixed(1)}s`;
        if (dom.scrubber) {
            dom.scrubber.max = AVState.audioDuration || 10;
            dom.scrubber.value = 0;
        }
        if (dom.timeLabel) {
            dom.timeLabel.textContent = `0:00.0 / ${formatTime(AVState.audioDuration)}`;
        }
    }

    // Smart parser for script text (.md Voicevox, .srt, .txt)
    function parseScriptLinesSmart(rawContent) {
        if (!rawContent || !rawContent.trim()) return [];

        const lines = rawContent.split(/\r?\n/);
        const result = [];

        // Check if file is SRT format
        const isSrt = /-->\s*\d{2}:\d{2}/.test(rawContent);
        if (isSrt) {
            let currentText = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) {
                    if (currentText.length > 0) {
                        result.push(currentText.join(' '));
                        currentText = [];
                    }
                } else if (/^\d+$/.test(line)) {
                    // index number, skip
                } else if (line.includes('-->')) {
                    // timestamp line, skip
                } else {
                    currentText.push(line);
                }
            }
            if (currentText.length > 0) result.push(currentText.join(' '));
            return result.filter(Boolean);
        }

        // Check if file is Markdown (Voicevox Script)
        // Typically structured with lines or Japanese/Vietnamese sentences
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;

            // Skip Markdown headers (# Title, ## Scene)
            if (line.startsWith('#')) continue;
            // Skip dividers (---, ===)
            if (/^[-=_*]{3,}$/.test(line)) continue;
            // Skip blockquotes or meta tags
            if (line.startsWith('> [!') || line.startsWith('<!--')) continue;

            // If line is format: **Scene 01**: "Text" or Scene 01: Text
            const sceneMatch = line.match(/^(?:(?:\*\*|__)?Scene\s*\d+(?:\*\*|__)?\s*[:\-\.]\s*)(.*)$/i);
            if (sceneMatch && sceneMatch[1]) {
                line = sceneMatch[1].trim();
            }

            // Strip enclosing quotes if any
            if ((line.startsWith('"') && line.endsWith('"')) || (line.startsWith('「') && line.endsWith('」'))) {
                line = line.slice(1, -1).trim();
            }

            if (line) {
                result.push(line);
            }
        }

        return result;
    }

    // Handle Script File Upload (.md, .txt, .srt)
    function handleScriptFileUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const rawText = event.target.result;
            const parsedLines = parseScriptLinesSmart(rawText);
            if (parsedLines.length === 0) {
                alert('Không trích xuất được câu thoại nào từ file kịch bản!');
                return;
            }

            if (dom.scriptTextarea) {
                dom.scriptTextarea.value = parsedLines.join('\n');
            }
            updateValidationIndicator();
            showToast(`📜 Đã nạp thành công ${parsedLines.length} câu thoại từ tệp ${file.name}!`);
        };
        reader.readAsText(file, 'utf-8');
    }

    // Sort batch audio files naturally by filename (e.g., segment_0001.wav, segment_0002.wav... segment_0091.wav)
    function sortBatchAudioNaturally() {
        if (!AVState.batchAudioFiles || AVState.batchAudioFiles.length === 0) return;
        AVState.batchAudioFiles.sort((a, b) => {
            const nameA = a.originalName || a.filename || '';
            const nameB = b.originalName || b.filename || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    // Batch Audio Upload Handler (Option Mới Thêm: Loạt Audio Phân Cảnh)
    async function handleBatchAudioUpload(e) {
        const rawFiles = Array.from(e.target.files || []);
        if (rawFiles.length === 0) return;

        // Filter valid audio files
        const audioFiles = rawFiles.filter(f => {
            const ext = (f.name || '').split('.').pop().toLowerCase();
            return ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext);
        });

        if (audioFiles.length === 0) {
            alert('Không tìm thấy tệp audio hợp lệ (.mp3, .wav, .m4a, .aac, .ogg)!');
            return;
        }

        // Natural sort files before uploading
        audioFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        if (dom.batchAudioCountLabel) {
            dom.batchAudioCountLabel.textContent = `Đang tải ${audioFiles.length} tệp audio...`;
        }
        if (dom.batchAudioBanner) dom.batchAudioBanner.classList.remove('hidden');

        try {
            // Upload in chunks of 30 if large to avoid payload size limit
            const chunkSize = 30;
            const uploadedAudioData = [];

            for (let i = 0; i < audioFiles.length; i += chunkSize) {
                const chunk = audioFiles.slice(i, i + chunkSize);
                const formData = new FormData();
                chunk.forEach(f => formData.append('files', f));

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.files) {
                    uploadedAudioData.push(...data.files);
                } else {
                    throw new Error(data.error || `Tải đợt ${Math.floor(i / chunkSize) + 1} thất bại`);
                }
            }

            AVState.batchAudioFiles = uploadedAudioData;
            sortBatchAudioNaturally();
            updateBatchAudioUI();
            updateValidationIndicator();

            showToast(`📂 Đã nạp thành công ${uploadedAudioData.length} tệp audio phân cảnh (Đã xếp 1 ➔ N)!`);
        } catch (err) {
            alert('Lỗi nạp loạt audio: ' + err.message);
            if (dom.batchAudioCountLabel) {
                dom.batchAudioCountLabel.textContent = `${AVState.batchAudioFiles.length} tệp audio`;
            }
        }
    }

    function updateBatchAudioUI() {
        if (!dom.batchAudioBanner) return;
        const count = AVState.batchAudioFiles ? AVState.batchAudioFiles.length : 0;
        if (count === 0) {
            dom.batchAudioBanner.classList.add('hidden');
            return;
        }

        dom.batchAudioBanner.classList.remove('hidden');

        const totalDur = AVState.batchAudioFiles.reduce((sum, a) => sum + (a.duration || 0), 0);
        if (dom.batchAudioCountLabel) {
            dom.batchAudioCountLabel.textContent = `${count} tệp audio phân cảnh`;
        }
        if (dom.batchAudioDurLabel) {
            dom.batchAudioDurLabel.textContent = `${totalDur.toFixed(1)}s (~${formatTime(totalDur)})`;
        }

        if (dom.batchAudioSampleLabel) {
            const first = AVState.batchAudioFiles[0]?.originalName || '';
            const last = AVState.batchAudioFiles[count - 1]?.originalName || '';
            dom.batchAudioSampleLabel.textContent = count > 1 
                ? `Thứ tự: ${first} ➔ ... ➔ ${last}` 
                : `Tệp: ${first}`;
        }

        // Update main preview audio to first track or cumulative duration
        if (AVState.audioMode === 'batch') {
            AVState.audioDuration = totalDur;
            if (dom.scrubber) {
                dom.scrubber.max = totalDur || 10;
                dom.scrubber.value = 0;
            }
            if (dom.timeLabel) {
                dom.timeLabel.textContent = `0:00.0 / ${formatTime(totalDur)}`;
            }
            if (AVState.batchAudioFiles[0]?.url) {
                AVState.audioElement.src = AVState.batchAudioFiles[0].url;
            }
        }
    }

    // Natural sort helper (e.g. scene_1, scene_2, 01.png, 2.png, 10.png)
    function sortImagesNaturally() {
        if (!AVState.images || AVState.images.length === 0) return;
        AVState.images.sort((a, b) => {
            const nameA = a.originalName || a.filename || '';
            const nameB = b.originalName || b.filename || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    // Images Upload Handler
    async function handleImagesUpload(e) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort selected files before upload
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.files) {
                AVState.images = [...AVState.images, ...data.files];
                sortImagesNaturally();
                renderImagesGrid();
                showToast(`🖼️ Đã nạp và tự động sắp xếp ${data.files.length} ảnh theo thứ tự tên file!`);
            } else {
                alert('Tải ảnh thất bại');
            }
        } catch (err) {
            alert('Lỗi tải ảnh: ' + err.message);
        }
    }

    function renderImagesGrid() {
        if (!dom.imagesGrid) return;
        dom.imagesGrid.innerHTML = '';
        if (dom.imagesCountBadge) dom.imagesCountBadge.textContent = `${AVState.images.length} ảnh`;

        AVState.images.forEach((img, idx) => {
            const pill = document.createElement('div');
            pill.className = 'av-img-pill';
            pill.title = `#${idx + 1}: ${img.originalName || img.filename}`;
            pill.innerHTML = `
                <img src="${img.url}" alt="${img.originalName}" loading="lazy">
                <span class="av-pill-idx">#${idx + 1}</span>
            `;
            dom.imagesGrid.appendChild(pill);
        });

        updateValidationIndicator();
    }

    // Smart Validation: Check Images Count vs Script Lines Count (or Batch Audio Files Count)
    function updateValidationIndicator() {
        if (!dom.validationBanner || !dom.validationText || !dom.validationStatus) return;

        const imgCount = AVState.images ? AVState.images.length : 0;

        // MODE BATCH AUDIO: So sánh trực tiếp số tệp audio phân cảnh với số lượng ảnh
        if (AVState.audioMode === 'batch') {
            const batchCount = AVState.batchAudioFiles ? AVState.batchAudioFiles.length : 0;
            if (batchCount === 0 && imgCount === 0) {
                dom.validationBanner.classList.add('hidden');
                return;
            }

            dom.validationBanner.classList.remove('hidden');

            if (batchCount > 0 && imgCount > 0) {
                if (batchCount === imgCount) {
                    dom.validationBanner.style.background = 'rgba(16, 185, 129, 0.15)';
                    dom.validationBanner.style.border = '1px solid #10B981';
                    dom.validationText.innerHTML = `✅ <strong>Khớp 1:1 hoàn hảo:</strong> Đã có <b>${batchCount} file audio phân cảnh</b> = Kho ảnh có đúng <b>${imgCount} ảnh</b> (Mỗi audio tương ứng đúng 1 ảnh)`;
                    dom.validationStatus.style.background = '#10B981';
                    dom.validationStatus.textContent = 'Khớp 100%';
                } else if (imgCount < batchCount) {
                    const diff = batchCount - imgCount;
                    dom.validationBanner.style.background = 'rgba(245, 158, 11, 0.15)';
                    dom.validationBanner.style.border = '1px solid #F59E0B';
                    dom.validationText.innerHTML = `⚠️ <strong>Thiếu ${diff} ảnh:</strong> Có <b>${batchCount} file audio</b> nhưng mới nạp <b>${imgCount} ảnh</b> (Sẽ lặp lại ảnh hoặc để trống chờ bù)`;
                    dom.validationStatus.style.background = '#F59E0B';
                    dom.validationStatus.textContent = `Thiếu ${diff} ảnh`;
                } else {
                    const diff = imgCount - batchCount;
                    dom.validationBanner.style.background = 'rgba(56, 189, 248, 0.15)';
                    dom.validationBanner.style.border = '1px solid #38BDF8';
                    dom.validationText.innerHTML = `ℹ️ <strong>Dư ${diff} ảnh:</strong> Có <b>${batchCount} file audio</b> trong khi kho có <b>${imgCount} ảnh</b> (Sẽ ưu tiên lấy đúng ${batchCount} ảnh đầu tiên)`;
                    dom.validationStatus.style.background = '#38BDF8';
                    dom.validationStatus.textContent = `Dư ${diff} ảnh`;
                }
            } else if (batchCount > 0) {
                dom.validationBanner.style.background = 'rgba(255, 255, 255, 0.05)';
                dom.validationBanner.style.border = '1px solid rgba(255,255,255,0.1)';
                dom.validationText.innerHTML = `🎧 Đã nạp <b>${batchCount} file audio phân cảnh</b> (Chưa nạp kho ảnh minh họa)`;
                dom.validationStatus.textContent = 'Chờ nạp ảnh';
            } else {
                dom.validationBanner.style.background = 'rgba(255, 255, 255, 0.05)';
                dom.validationBanner.style.border = '1px solid rgba(255,255,255,0.1)';
                dom.validationText.innerHTML = `🖼️ Đã nạp <b>${imgCount} ảnh</b> vào kho (Chưa nạp loạt file audio phân cảnh)`;
                dom.validationStatus.textContent = 'Chờ nạp audio';
            }
            return;
        }

        // MODE SINGLE AUDIO (NGUYÊN BẢN CŨ 100%): So sánh số câu thoại kịch bản với số lượng ảnh
        const raw = dom.scriptTextarea ? dom.scriptTextarea.value.trim() : '';
        const scriptLines = raw ? raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('---') && !l.startsWith('===')).length : 0;

        if (scriptLines === 0 && imgCount === 0) {
            dom.validationBanner.classList.add('hidden');
            return;
        }

        dom.validationBanner.classList.remove('hidden');

        if (scriptLines > 0 && imgCount > 0) {
            if (scriptLines === imgCount) {
                dom.validationBanner.style.background = 'rgba(16, 185, 129, 0.15)';
                dom.validationBanner.style.border = '1px solid #10B981';
                dom.validationText.innerHTML = `✅ <strong>Khớp hoàn hảo:</strong> Kịch bản có <b>${scriptLines} câu</b> = Kho ảnh có đúng <b>${imgCount} ảnh</b> (Tỉ lệ 1:1 chuẩn xác)`;
                dom.validationStatus.style.background = '#10B981';
                dom.validationStatus.textContent = 'Khớp 100%';
            } else if (imgCount < scriptLines) {
                const diff = scriptLines - imgCount;
                dom.validationBanner.style.background = 'rgba(245, 158, 11, 0.15)';
                dom.validationBanner.style.border = '1px solid #F59E0B';
                dom.validationText.innerHTML = `⚠️ <strong>Thiếu ${diff} ảnh:</strong> Kịch bản có <b>${scriptLines} câu</b> nhưng mới có <b>${imgCount} ảnh</b> (AI sẽ lặp lại hoặc để trống chờ bù)`;
                dom.validationStatus.style.background = '#F59E0B';
                dom.validationStatus.textContent = `Thiếu ${diff} ảnh`;
            } else {
                const diff = imgCount - scriptLines;
                dom.validationBanner.style.background = 'rgba(56, 189, 248, 0.15)';
                dom.validationBanner.style.border = '1px solid #38BDF8';
                dom.validationText.innerHTML = `ℹ️ <strong>Dư ${diff} ảnh:</strong> Kịch bản có <b>${scriptLines} câu</b> trong khi kho có <b>${imgCount} ảnh</b> (Sẽ ưu tiên lấy đúng ${scriptLines} ảnh đầu tiên)`;
                dom.validationStatus.style.background = '#38BDF8';
                dom.validationStatus.textContent = `Dư ${diff} ảnh`;
            }
        } else if (scriptLines > 0) {
            dom.validationBanner.style.background = 'rgba(255, 255, 255, 0.05)';
            dom.validationBanner.style.border = '1px solid rgba(255,255,255,0.1)';
            dom.validationText.innerHTML = `📜 Đã nhận diện <b>${scriptLines} câu thoại</b> kịch bản (Chưa nạp kho ảnh)`;
            dom.validationStatus.textContent = 'Chờ nạp ảnh';
        } else {
            dom.validationBanner.style.background = 'rgba(255, 255, 255, 0.05)';
            dom.validationBanner.style.border = '1px solid rgba(255,255,255,0.1)';
            dom.validationText.innerHTML = `🖼️ Đã nạp <b>${imgCount} ảnh</b> vào kho (Chưa dán kịch bản)`;
            dom.validationStatus.textContent = 'Chờ kịch bản';
        }
    }

    // Format Seconds to MM:SS.S
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00.0';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // AI Match Script & Voice to Images (Hỗ trợ 2 chế độ: 1 Audio Tổng Hợp vs Loạt Audio Phân Cảnh)
    async function handleRunAiMatch() {
        if (AVState.audioMode === 'batch') {
            if (!AVState.batchAudioFiles || AVState.batchAudioFiles.length === 0) {
                alert('⚠️ Vui lòng nạp loạt file Audio phân cảnh trước (kéo thả hoặc chọn file từ máy)!');
                return;
            }
        } else {
            if (!AVState.audioUrl && (!AVState.audioDuration || AVState.audioDuration <= 0)) {
                alert('⚠️ Vui lòng nạp Voice Audio trước (bấm Tải Tệp Audio hoặc Lấy BGM từ Timeline)!');
                return;
            }
        }

        if (!AVState.images || AVState.images.length === 0) {
            alert('⚠️ Vui lòng nạp Kho Ảnh minh họa trước!');
            return;
        }

        const script = dom.scriptTextarea ? dom.scriptTextarea.value.trim() : '';
        const pauseInterval = dom.pauseSelect ? parseFloat(dom.pauseSelect.value) : 0.0;
        const selectedTrans = dom.transitionSelect ? dom.transitionSelect.value : 'none';
        const selectedMotion = dom.motionSelect ? dom.motionSelect.value : 'none';
        const matchMode = dom.matchModeSelect ? dom.matchModeSelect.value : 'sequential'; // 'sequential' | 'ai_vision'
        const densityMode = dom.densitySelect ? dom.densitySelect.value : '1_per_scene'; // '1_per_scene' | '2_per_scene' | 'smart_split'

        // Đảm bảo ảnh luôn xếp theo số thứ tự tên file tự nhiên
        sortImagesNaturally();

        // XỬ LÝ CHẾ ĐỘ OPTION B: LOẠT AUDIO PHÂN CẢNH (BATCH AUDIO MODE)
        if (AVState.audioMode === 'batch') {
            sortBatchAudioNaturally();

            if (dom.btnRunMatch) {
                dom.btnRunMatch.disabled = true;
                dom.btnRunMatch.innerHTML = '⚡ Đang gán 1-1 từng tệp Audio vào từng Phân Cảnh...';
            }

            try {
                let currentCursor = 0.0;
                const batchList = AVState.batchAudioFiles;
                
                // Tách các dòng kịch bản nếu người dùng có dán kịch bản
                const scriptLines = script 
                    ? script.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('---') && !l.startsWith('==='))
                    : [];

                const baseScenes = batchList.map((audioItem, idx) => {
                    const audioDur = parseFloat((audioItem.duration || 4.0).toFixed(2));
                    const durWithPause = parseFloat((audioDur + pauseInterval).toFixed(2));
                    const st = parseFloat(currentCursor.toFixed(2));
                    const et = parseFloat((st + durWithPause).toFixed(2));
                    currentCursor = et;

                    // Gán ảnh: 1-to-1 theo thứ tự ảnh đã sắp xếp tự nhiên
                    let assignedImageIdx = 0;
                    if (matchMode === 'sequential') {
                        assignedImageIdx = idx < AVState.images.length ? idx : (idx % AVState.images.length);
                    } else {
                        assignedImageIdx = idx < AVState.images.length ? idx : (idx % AVState.images.length);
                    }

                    // Lấy câu thoại tương ứng nếu có
                    const text = scriptLines[idx] || `Âm thanh: ${audioItem.originalName || ('Cảnh #' + (idx + 1))}`;

                    return {
                        imageIndex: assignedImageIdx,
                        startTime: st,
                        endTime: et,
                        duration: durWithPause,
                        sceneText: text,
                        voiceAudio: {
                            filename: audioItem.filename,
                            originalName: audioItem.originalName,
                            url: audioItem.url,
                            duration: audioDur
                        },
                        reason: `Tệp audio: ${audioItem.originalName} (${audioDur}s) khớp ảnh #${assignedImageIdx + 1}`,
                        transition: selectedTrans,
                        motion: selectedMotion,
                        fadeIn: (selectedTrans === 'none') ? 0.0 : 0.25,
                        fadeOut: (selectedTrans === 'none') ? 0.0 : 0.25
                    };
                });

                AVState.scenes = baseScenes.map((s, idx) => ({ ...s, id: idx + 1 }));
                AVState.audioDuration = currentCursor;

                if (dom.scrubber) {
                    dom.scrubber.max = currentCursor || 10;
                    dom.scrubber.value = 0;
                }
                if (dom.timeLabel) {
                    dom.timeLabel.textContent = `0:00.0 / ${formatTime(currentCursor)}`;
                }

                renderScenesList();
                showToast(`🎉 Đã khớp chuẩn 1:1 thành công ${AVState.scenes.length} phân cảnh từ loạt file audio!`);
                drawCanvasAtTime(0);
                return;
            } catch (err) {
                alert('Lỗi ghép loạt audio: ' + err.message);
                return;
            } finally {
                if (dom.btnRunMatch) {
                    dom.btnRunMatch.disabled = false;
                    dom.btnRunMatch.innerHTML = '✨ Bắt Đầu Tự Động Khớp Voice ➔ Ảnh (Không Phụ Đề)';
                }
            }
        }

        // XỬ LÝ CHẾ ĐỘ OPTION A: 1 FILE AUDIO DUY NHẤT (GIỮ NGUYÊN 100% CŨ)
        const formData = new FormData();
        formData.append('scriptText', script || 'Kịch bản tự động theo nhịp audio');
        formData.append('items', JSON.stringify(AVState.images));
        formData.append('pauseInterval', pauseInterval);

        // Append audio file if uploaded from disk, otherwise reference bgm
        if (AVState.audioFile && AVState.audioFile.filename) {
            formData.append('audioFileRef', AVState.audioFile.filename);
        } else if (window.bgmTrack && window.bgmTrack.filename) {
            formData.append('audioFileRef', window.bgmTrack.filename);
        }

        if (dom.btnRunMatch) {
            dom.btnRunMatch.disabled = true;
            dom.btnRunMatch.innerHTML = matchMode === 'sequential' 
                ? '⚡ Đang căn nhịp Voice & gán ảnh theo đúng số thứ tự (1 ➔ N)...' 
                : '🤖 Đang phân tích Voice & khớp ảnh theo AI Vision...';
        }

        try {
            const res = await fetch('/api/ai/match-script', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.result && data.result.scenes) {
                const rawList = data.result.scenes;
                let currentCursor = 0.0;
                
                // Base 1-to-1 parsing
                const baseScenes = rawList.map((s, idx) => {
                    const dur = (typeof s.suggestedDuration === 'number' && s.suggestedDuration > 0)
                        ? s.suggestedDuration
                        : (AVState.audioDuration > 0 ? (AVState.audioDuration / rawList.length) : 4.0);

                    let st = (typeof s.startTime === 'number' && s.startTime >= currentCursor) ? s.startTime : currentCursor;
                    let et = (typeof s.endTime === 'number' && s.endTime > st) ? s.endTime : (st + dur);
                    
                    if (idx === rawList.length - 1 && AVState.audioDuration > 0) {
                        et = Math.max(st + 0.5, AVState.audioDuration);
                    }

                    st = parseFloat(st.toFixed(2));
                    et = parseFloat(et.toFixed(2));
                    currentCursor = et;

                    // Quyết định gán ảnh: Nếu chọn 'sequential' -> Gán tuần tự 0, 1, 2, 3... tương ứng theo tên file đã sắp xếp
                    let assignedImageIdx = 0;
                    if (matchMode === 'sequential') {
                        assignedImageIdx = idx < AVState.images.length ? idx : (idx % AVState.images.length);
                    } else {
                        assignedImageIdx = (typeof s.imageIndex === 'number' && s.imageIndex >= 0) ? s.imageIndex : (idx % AVState.images.length);
                    }

                    return {
                        imageIndex: assignedImageIdx,
                        startTime: st,
                        endTime: et,
                        duration: parseFloat((et - st).toFixed(2)),
                        sceneText: s.sceneText || `Ý thoại đoạn #${idx + 1}`,
                        reason: matchMode === 'sequential' ? `Ảnh #${assignedImageIdx + 1} khớp theo thứ tự tên file` : (s.reason || 'Mô tả trực quan chuẩn theo giọng đọc'),
                        transition: selectedTrans,
                        motion: selectedMotion,
                        fadeIn: (selectedTrans === 'none') ? 0.0 : 0.25,
                        fadeOut: (selectedTrans === 'none') ? 0.0 : 0.25
                    };
                });

                // Apply Pacing Mode (1_per_scene | 2_per_scene | smart_split) linh hoạt
                let expandedScenes = [];
                let nextAvailableImgIdx = baseScenes.length % (AVState.images.length || 1);

                baseScenes.forEach((bs, bIdx) => {
                    const sceneDur = bs.duration;
                    const shouldSplit = (densityMode === '2_per_scene') || (densityMode === 'smart_split' && sceneDur >= 4.0);

                    if (shouldSplit && sceneDur >= 1.5) {
                        // Chia câu thành 2 phân cảnh ảnh liên tiếp
                        const midTime = parseFloat((bs.startTime + (sceneDur / 2)).toFixed(2));
                        
                        // Ảnh 1: Ảnh gốc do AI chọn
                        expandedScenes.push({
                            ...bs,
                            endTime: midTime,
                            duration: parseFloat((midTime - bs.startTime).toFixed(2)),
                            sceneText: bs.sceneText,
                            subPart: '1/2',
                            reason: `${bs.reason} (Nửa đầu câu)`
                        });

                        // Ảnh 2: Ảnh tiếp theo trong kho ảnh để tạo nhịp đổi cảnh
                        let secondImgIdx = (bs.imageIndex + 1) % AVState.images.length;
                        if (secondImgIdx === bs.imageIndex && AVState.images.length > 1) {
                            secondImgIdx = (secondImgIdx + 1) % AVState.images.length;
                        }

                        expandedScenes.push({
                            ...bs,
                            imageIndex: secondImgIdx,
                            startTime: midTime,
                            endTime: bs.endTime,
                            duration: parseFloat((bs.endTime - midTime).toFixed(2)),
                            sceneText: bs.sceneText,
                            subPart: '2/2',
                            reason: `Đổi ảnh tạo nhịp kể chuyện (Nửa sau câu)`
                        });
                    } else {
                        // Giữ nguyên 1 câu = 1 ảnh
                        expandedScenes.push({
                            ...bs,
                            subPart: null
                        });
                    }
                });

                // Gán ID lại tuần tự
                AVState.scenes = expandedScenes.map((s, idx) => ({ ...s, id: idx + 1 }));

                renderScenesList();
                const modeLabel = densityMode === '2_per_scene' ? '1 câu 2 ảnh' : (densityMode === 'smart_split' ? 'Tự động tách câu dài' : '1 câu 1 ảnh');
                showToast(`🎉 Đã khớp xong ${AVState.scenes.length} phân cảnh (${modeLabel})!`);
                drawCanvasAtTime(0);
            } else {
                throw new Error('Dữ liệu AI trả về không đúng cấu trúc.');
            }
        } catch (err) {
            alert('Lỗi khớp Audio & Ảnh: ' + err.message);
        } finally {
            if (dom.btnRunMatch) {
                dom.btnRunMatch.disabled = false;
                dom.btnRunMatch.innerHTML = '✨ Bắt Đầu Tự Động Khớp Voice ➔ Ảnh (Không Phụ Đề)';
            }
        }
    }

    // Render Matched Storyboard Scenes with Quick Split/Merge & Swap Tools
    function renderScenesList() {
        if (!dom.scenesList) return;
        dom.scenesList.innerHTML = '';
        if (dom.scenesCountBadge) {
            dom.scenesCountBadge.textContent = `${AVState.scenes.length} cảnh`;
        }

        AVState.scenes.forEach((scene, sIdx) => {
            const img = AVState.images[scene.imageIndex] || AVState.images[0];
            const card = document.createElement('div');
            card.className = `av-scene-card ${sIdx === AVState.activeSceneIndex ? 'playing' : ''}`;
            card.dataset.sceneIdx = sIdx;

            const partBadge = scene.subPart ? `<span class="av-badge" style="background: rgba(167, 139, 250, 0.2); color: #C084FC; margin-left: 6px; font-size: 11px;">Phần ${scene.subPart}</span>` : '';
            const canMerge = sIdx < AVState.scenes.length - 1;

            card.innerHTML = `
                <div class="av-scene-thumb" title="Bấm để đổi ảnh cho phân cảnh này">
                    <img src="${img ? img.url : ''}" alt="Cảnh ${sIdx + 1}">
                    <div class="av-thumb-hover-edit">🔄 Đổi ảnh</div>
                </div>
                <div class="av-scene-content">
                    <div class="av-scene-top-meta flex-between align-center">
                        <div class="flex-row align-center">
                            <strong style="color: #FFF; font-size: 13px;">Cảnh #${sIdx + 1}: ${img ? img.originalName : 'Ảnh'}</strong>
                            ${partBadge}
                        </div>
                        <div class="flex-row align-center gap-xs">
                            <span class="av-scene-timebadge">⏱️ [${scene.startTime.toFixed(1)}s ➔ ${scene.endTime.toFixed(1)}s] (${scene.duration.toFixed(1)}s)</span>
                            <button type="button" class="btn btn-xs btn-ghost btn-split-scene" title="Tách cảnh này thành 2 ảnh (Chia đôi thời lượng)" style="padding: 2px 6px; font-size: 11px; border: 1px solid rgba(56, 189, 248, 0.3); color: #38BDF8;">
                                ✂️ Tách
                            </button>
                            ${canMerge ? `
                            <button type="button" class="btn btn-xs btn-ghost btn-merge-scene" title="Gộp cảnh này với cảnh tiếp theo thành 1 ảnh" style="padding: 2px 6px; font-size: 11px; border: 1px solid rgba(167, 139, 250, 0.3); color: #C084FC;">
                                🔗 Gộp sau
                            </button>` : ''}
                        </div>
                    </div>
                    <div class="av-scene-script-text">🎙️ "${scene.sceneText}"</div>
                    <div class="av-scene-reason">💡 ${scene.reason}</div>
                </div>
            `;

            // Action: Split this specific scene into 2 images on-demand
            const btnSplit = card.querySelector('.btn-split-scene');
            if (btnSplit) {
                btnSplit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    splitSpecificScene(sIdx);
                });
            }

            // Action: Merge this specific scene with next scene on-demand
            const btnMerge = card.querySelector('.btn-merge-scene');
            if (btnMerge) {
                btnMerge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    mergeWithNextScene(sIdx);
                });
            }

            // Click scene card to seek
            card.addEventListener('click', (e) => {
                if (e.target.closest('.av-scene-thumb')) {
                    pickImageForScene(sIdx);
                } else if (!e.target.closest('.btn-split-scene') && !e.target.closest('.btn-merge-scene')) {
                    seekToScene(sIdx);
                }
            });

            dom.scenesList.appendChild(card);
        });
    }

    // On-demand merge scene with next scene
    function mergeWithNextScene(sceneIdx) {
        if (sceneIdx >= AVState.scenes.length - 1) return;
        const cur = AVState.scenes[sceneIdx];
        const next = AVState.scenes[sceneIdx + 1];
        if (!cur || !next) return;

        cur.endTime = next.endTime;
        cur.duration = parseFloat((cur.endTime - cur.startTime).toFixed(2));
        cur.sceneText = `${cur.sceneText} / ${next.sceneText}`;
        cur.reason = `Đã gộp câu (Giữ ảnh #${cur.imageIndex + 1})`;
        cur.subPart = null;

        AVState.scenes.splice(sceneIdx + 1, 1);
        AVState.scenes.forEach((s, i) => s.id = i + 1);

        renderScenesList();
        showToast(`🔗 Đã gộp Cảnh #${sceneIdx + 1} và Cảnh #${sceneIdx + 2} thành 1 ảnh!`);
    }

    // On-demand split a single scene into 2 images
    function splitSpecificScene(sceneIdx) {
        const target = AVState.scenes[sceneIdx];
        if (!target || target.duration < 1.0) {
            alert('Cảnh này quá ngắn (< 1s), không thể tách thêm!');
            return;
        }

        const mid = parseFloat((target.startTime + (target.duration / 2)).toFixed(2));
        const originalEnd = target.endTime;

        // Cảnh 1
        target.endTime = mid;
        target.duration = parseFloat((mid - target.startTime).toFixed(2));
        target.subPart = '1/2';

        // Cảnh 2
        let nextImg = (target.imageIndex + 1) % AVState.images.length;
        const newScene = {
            ...target,
            imageIndex: nextImg,
            startTime: mid,
            endTime: originalEnd,
            duration: parseFloat((originalEnd - mid).toFixed(2)),
            subPart: '2/2',
            reason: 'Tách bổ sung trực tiếp từ cảnh #' + (sceneIdx + 1)
        };

        AVState.scenes.splice(sceneIdx + 1, 0, newScene);
        AVState.scenes.forEach((s, i) => s.id = i + 1);

        renderScenesList();
        showToast(`✂️ Đã tách Cảnh #${sceneIdx + 1} thành 2 phân cảnh ảnh liên tiếp!`);
    }

    // Pick a different image for a specific scene
    function pickImageForScene(sceneIdx) {
        if (!AVState.images || AVState.images.length === 0) return;
        const targetScene = AVState.scenes[sceneIdx];
        if (!targetScene) return;

        // Simple prompt or cycle to next image
        const nextIdx = (targetScene.imageIndex + 1) % AVState.images.length;
        targetScene.imageIndex = nextIdx;
        renderScenesList();
        drawCanvasAtTime(AVState.audioElement.currentTime || targetScene.startTime);
        showToast(`🔄 Đã đổi sang ảnh #${nextIdx + 1}`);
    }

    function seekToScene(sceneIdx) {
        const scene = AVState.scenes[sceneIdx];
        if (!scene) return;
        AVState.activeSceneIndex = sceneIdx;
        
        if (AVState.audioMode === 'batch') {
            const trackUrl = scene.voiceAudio?.url || AVState.batchAudioFiles[sceneIdx]?.url;
            if (trackUrl && AVState.audioElement) {
                if (!isSameAudioSrc(AVState.audioElement.src, trackUrl)) {
                    AVState.isSwitchingTrack = true;
                    AVState.audioElement.src = trackUrl;
                    AVState.audioElement.currentTime = 0;
                    AVState.isSwitchingTrack = false;
                } else {
                    AVState.audioElement.currentTime = 0;
                }
                if (AVState.isPlaying) {
                    AVState.audioElement.play().catch(e => console.warn(e));
                }
            }
        } else if (AVState.audioElement) {
            AVState.audioElement.currentTime = scene.startTime;
        }

        drawCanvasAtTime(scene.startTime);
        highlightActiveSceneCard(sceneIdx, true);
    }

    function updateActiveSceneByTime(currentTime) {
        const idx = AVState.scenes.findIndex(s => currentTime >= s.startTime && currentTime <= s.endTime);
        if (idx !== -1 && idx !== AVState.activeSceneIndex) {
            AVState.activeSceneIndex = idx;
            highlightActiveSceneCard(idx);
        }
    }

    function highlightActiveSceneCard(idx, shouldScroll = false) {
        if (!dom.scenesList) return;
        const cards = dom.scenesList.querySelectorAll('.av-scene-card');
        cards.forEach((c, i) => {
            c.classList.toggle('playing', i === idx);
            if (i === idx && shouldScroll) {
                // Cuộn mượt mà chỉ bên trong khung danh sách scenesList, KHÔNG cuộn cả trang web
                const containerRect = dom.scenesList.getBoundingClientRect();
                const cardRect = c.getBoundingClientRect();
                const offsetTop = cardRect.top - containerRect.top;
                if (offsetTop < 0 || offsetTop > (containerRect.height - cardRect.height)) {
                    dom.scenesList.scrollTop += offsetTop - (containerRect.height / 2) + (cardRect.height / 2);
                }
            }
        });
    }

    // Apply user selected transition/motion settings across current scenes
    function applySettingsToCurrentScenes() {
        if (!AVState.scenes || AVState.scenes.length === 0) return;
        AVState.scenes.forEach(s => {
            s.transition = AVState.transition;
            s.motion = AVState.motion;
            s.fadeIn = (AVState.transition === 'none') ? 0.0 : 0.25;
            s.fadeOut = (AVState.transition === 'none') ? 0.0 : 0.25;
        });
        showToast(`⚡ Đã cập nhật chuyển cảnh "${AVState.transition}" và chuyển động "${AVState.motion}"`);
    }

    // Live Canvas Drawing (Clean, No Subtitles)
    const imageCache = new Map();
    function getImageElement(url) {
        if (imageCache.has(url)) return imageCache.get(url);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        imageCache.set(url, img);
        return img;
    }

    function drawCanvasAtTime(currentTime) {
        if (!dom.canvas) return;
        const ctx = dom.canvas.getContext('2d');
        const w = dom.canvas.width;
        const h = dom.canvas.height;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        if (!AVState.scenes || AVState.scenes.length === 0) {
            // Draw placeholder image or prompt
            if (AVState.images && AVState.images.length > 0) {
                const img = getImageElement(AVState.images[0].url);
                if (img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, 0, 0, w, h);
                }
            }
            return;
        }

        // Find current scene
        let scene = AVState.scenes.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
        if (!scene) scene = AVState.scenes[AVState.scenes.length - 1];
        if (!scene) return;

        const imgData = AVState.images[scene.imageIndex] || AVState.images[0];
        if (!imgData) return;

        const img = getImageElement(imgData.url);
        if (!img.complete || img.naturalWidth === 0) return;

        // Calculate progress in current scene
        const sceneDur = Math.max(0.1, scene.endTime - scene.startTime);
        const progress = Math.min(1.0, Math.max(0, (currentTime - scene.startTime) / sceneDur));

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Calculate smart aspect-ratio cover crop coordinates (100% matching Tab 1 & FFmpeg preScaleFilter)
        const imgW = img.naturalWidth || img.width || w;
        const imgH = img.naturalHeight || img.height || h;
        const imgRatio = imgW / imgH;
        const canvasRatio = w / h;

        let sx = 0, sy = 0, sWidth = imgW, sHeight = imgH;
        if (imgRatio > canvasRatio) {
            sWidth = imgH * canvasRatio;
            sx = (imgW - sWidth) / 2;
        } else {
            sHeight = imgW / canvasRatio;
            sy = (imgH - sHeight) / 2;
        }

        // 2. Motion Transform (100% matching Tab 1 & FFmpeg zoompan formula)
        const motion = scene.motion || AVState.motion || 'zoom_in';
        const zoomIntensity = 1.22;
        const delta = zoomIntensity - 1.0;

        let zoom = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        const maxPanX = (1 - 1 / zoomIntensity) * (w / 2);
        const maxPanY = (1 - 1 / zoomIntensity) * (h / 2);

        if (motion === 'zoom_in') {
            zoom = 1.0 + (delta * progress);
        } else if (motion === 'zoom_out') {
            zoom = zoomIntensity - (delta * progress);
        } else if (motion === 'pan_left') {
            zoom = zoomIntensity;
            offsetX = maxPanX * (1 - 2 * progress);
        } else if (motion === 'pan_right') {
            zoom = zoomIntensity;
            offsetX = maxPanX * (2 * progress - 1);
        } else if (motion === 'pan_up') {
            zoom = zoomIntensity;
            offsetY = maxPanY * (1 - 2 * progress);
        } else if (motion === 'pan_down') {
            zoom = zoomIntensity;
            offsetY = maxPanY * (2 * progress - 1);
        } else if (motion === 'zoom_in_left') {
            zoom = 1.0 + (delta * progress);
            offsetX = (1 - 1 / zoom) * (w / 2);
            offsetY = (1 - 1 / zoom) * (h / 2);
        } else if (motion === 'zoom_in_right') {
            zoom = 1.0 + (delta * progress);
            offsetX = -(1 - 1 / zoom) * (w / 2);
            offsetY = (1 - 1 / zoom) * (h / 2);
        } else if (motion === 'zoom_pan') {
            zoom = 1.0 + (delta * progress);
            offsetX = -(1 - 1 / zoom) * (w / 2) * (1 - 2 * progress);
            offsetY = -(1 - 1 / zoom) * (h / 2) * (1 - 2 * progress);
        } else {
            zoom = 1.0;
            offsetX = 0;
            offsetY = 0;
        }

        // 3. Smooth Transitions (Fade, Crossfade, Flash White)
        const sceneTime = currentTime - scene.startTime;
        const fadeIn = Number(scene.fadeIn !== undefined ? scene.fadeIn : 0.25);
        const fadeOut = Number(scene.fadeOut !== undefined ? scene.fadeOut : 0.25);
        const transition = scene.transition || AVState.transition || 'none';

        let alpha = 1.0;
        let transOffsetX = 0;
        let transOffsetY = 0;
        let transScale = 1.0;
        let flashWhiteOpacity = 0.0;

        if (transition !== 'none' && fadeIn > 0 && sceneTime < fadeIn) {
            const transProgress = sceneTime / fadeIn;
            if (transition === 'flash_white') {
                alpha = Math.min(1.0, transProgress * 1.5);
                flashWhiteOpacity = Math.max(0, 1.0 - transProgress);
            } else if (transition === 'crossfade' || transition === 'fade_black') {
                alpha = Math.min(1.0, Math.max(0, transProgress));
            }
        }
        if (transition !== 'none' && fadeOut > 0 && sceneTime > (sceneDur - fadeOut)) {
            alpha = Math.min(alpha, Math.max(0, (sceneDur - sceneTime) / fadeOut));
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
        ctx.translate(w / 2 + transOffsetX, h / 2 + transOffsetY);
        ctx.scale(zoom * transScale, zoom * transScale);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, -w / 2 + offsetX, -h / 2 + offsetY, w, h);
        ctx.restore();

        if (flashWhiteOpacity > 0.01) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${flashWhiteOpacity.toFixed(3)})`;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // RENDER LIVE SUBTITLE OVERLAY ON CANVAS (If enabled and scene has text)
        if (AVState.enableSubtitles && scene.sceneText && scene.sceneText.trim()) {
            drawLiveSubtitleOnCanvas(ctx, scene.sceneText.trim(), w, h, AVState.subtitleStyle, progress);
        }
    }

    // Helper: Split long sentence (especially CJK/Japanese without spaces) into neat readable display pages
    function splitTextIntoDisplayPages(text, maxCharsPerPage = 36) {
        if (!text) return [];
        const cleanText = text.trim();
        if (cleanText.length <= maxCharsPerPage) {
            return [cleanText];
        }

        // 1. Tách theo các dấu ngắt câu tự nhiên
        const rawTokens = [];
        let currentBuf = '';
        for (let i = 0; i < cleanText.length; i++) {
            const ch = cleanText[i];
            currentBuf += ch;
            if (/[。、,.;:!?！？\n]/.test(ch)) {
                rawTokens.push(currentBuf);
                currentBuf = '';
            }
        }
        if (currentBuf) rawTokens.push(currentBuf);

        // 2. Nếu một token vượt quá maxCharsPerPage, tách thông minh
        const refinedTokens = [];
        rawTokens.forEach(tok => {
            if (tok.length <= maxCharsPerPage) {
                refinedTokens.push(tok);
            } else {
                let rem = tok;
                while (rem.length > maxCharsPerPage) {
                    let cutPos = maxCharsPerPage;
                    const spaceIdx = rem.lastIndexOf(' ', maxCharsPerPage);
                    if (spaceIdx > maxCharsPerPage * 0.5) {
                        cutPos = spaceIdx + 1;
                    }
                    refinedTokens.push(rem.slice(0, cutPos));
                    rem = rem.slice(cutPos);
                }
                if (rem) refinedTokens.push(rem);
            }
        });

        // 3. Gom các token thành các page
        const pages = [];
        let pageBuf = '';
        refinedTokens.forEach(tok => {
            if (!pageBuf) {
                pageBuf = tok;
            } else if ((pageBuf + tok).length <= maxCharsPerPage) {
                pageBuf += tok;
            } else {
                pages.push(pageBuf);
                pageBuf = tok;
            }
        });
        if (pageBuf) pages.push(pageBuf);

        // 4. RÀO LỖI TUYỆT ĐỐI (Orphan Punctuation Protection):
        // Không bao giờ để lại page chỉ có dấu câu hoặc chỉ 1-2 ký tự lẻ loi!
        const consolidated = [];
        for (let i = 0; i < pages.length; i++) {
            let p = pages[i].trim();
            if (!p) continue;

            const isOnlyPunctuationOrTiny = /^[。、,.;:!?！？…\s\-_]+$/.test(p) || p.length <= 2;
            if (isOnlyPunctuationOrTiny && consolidated.length > 0) {
                consolidated[consolidated.length - 1] += p;
            } else {
                consolidated.push(p);
            }
        }

        const result = consolidated.filter(p => p && !/^[。、,.;:!?！？…\s\-_]+$/.test(p));
        return result.length > 0 ? result : [cleanText];
    }

    // Helper: Wrap words or CJK characters into lines fitting within maxTextWidth
    function wrapTextToLines(ctx, text, maxTextWidth) {
        if (!text) return [];
        // Test if text contains whitespace (Latin / Vietnamese) or is continuous (Japanese / Chinese)
        const hasWhitespace = /\s+/.test(text.trim());
        const tokens = hasWhitespace ? text.split(/\s+/) : text.split('');
        const lines = [];
        let currentLine = '';

        tokens.forEach((token, idx) => {
            const joiner = hasWhitespace ? (currentLine ? ' ' : '') : '';
            const testLine = currentLine + joiner + token;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextWidth && currentLine) {
                lines.push(currentLine);
                currentLine = token;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    // Helper: Draw Live Subtitle with Smart Paged Chunks, CJK wrapping, Box/Outline/Glow styling
    function drawLiveSubtitleOnCanvas(ctx, fullText, w, h, styleConf, progress = 0.0) {
        ctx.save();

        const baseFontSize = styleConf.fontSize || 48;
        const fontSize = Math.round(baseFontSize * (h / 1080));
        ctx.font = `bold ${fontSize}px "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans JP", "Hiragino Sans", "Meiryo", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Chia câu dài thành các trang (pages/chunks) để hiển thị tuần tự theo tiến trình audio
        // Khung an toàn chừa chỗ cho Watermark / Avatar góc phải:
        // - 16:9 hoặc 1:1: tối đa ~36 ký tự (khoảng 16-18 ký tự/dòng x 2 dòng, chừa rộng 2 mép)
        // - 9:16 (dọc): tối đa ~24 ký tự
        const maxChars = (w < h) ? 24 : 36;
        const pages = splitTextIntoDisplayPages(fullText, maxChars);
        
        let activeText = fullText;
        if (pages.length > 1) {
            // TÍNH TOÁN THEO TỈ LỆ SỐ KÝ TỰ (Character-weighted Timing):
            // Giúp đồng bộ chính xác với voice đọc: câu ngắn chuyển trang nhanh, câu dài giữ lâu hơn,
            // triệt tiêu hoàn toàn hiện tượng câu ngắn bị giữ quá lâu làm trễ sub so với tiếng!
            const totalChars = pages.reduce((sum, p) => sum + p.length, 0) || 1;
            let acc = 0;
            let pageIndex = 0;
            for (let i = 0; i < pages.length; i++) {
                acc += pages[i].length;
                if (progress <= acc / totalChars || i === pages.length - 1) {
                    pageIndex = i;
                    break;
                }
            }
            activeText = pages[pageIndex] || pages[0];
        }

        // Bỏ qua nếu activeText trống hoặc chỉ toàn dấu ngắt câu lẻ loi
        if (!activeText || /^[。、,.;:!?！？…\s\-_]+$/.test(activeText.trim())) {
            ctx.restore();
            return;
        }

        // 2. Wrap trang hiện tại thành tối đa 1-2 dòng (hỗ trợ cả tiếng Nhật CJK và tiếng Latin/Việt)
        // Dành ra khoảng an toàn ~15% mỗi bên (tổng chiều rộng chiếm 70% ở giữa) để né hoàn toàn Avatar/Watermark
        const maxTextWidth = w * 0.70;
        let lines = wrapTextToLines(ctx, activeText, maxTextWidth);
        if (lines.length > 2) {
            lines = lines.slice(0, 2); // Chuẩn phụ đề tối đa 2 dòng
        }

        const lineHeight = fontSize * 1.35;
        const totalBlockHeight = lines.length * lineHeight;

        // Position Y calculation
        let startY = h - (totalBlockHeight / 2) - Math.round(h * 0.08); // default bottom
        if (styleConf.position === 'top') {
            startY = (totalBlockHeight / 2) + Math.round(h * 0.10);
        } else if (styleConf.position === 'center') {
            startY = (h / 2) - (totalBlockHeight / 2) + (lineHeight / 2);
        }

        const textColor = styleConf.textColor || '#FFFFFF';
        const textAccent = styleConf.textAccent || '#06B6D4';
        const subStyle = styleConf.style || 'banner';

        lines.forEach((lineText, lIdx) => {
            const lineY = startY + (lIdx * lineHeight);
            const lineMetrics = ctx.measureText(lineText);
            const lineW = lineMetrics.width;

            if (subStyle === 'banner') {
                // Semi-transparent rounded backdrop banner
                const padX = 22;
                const padY = 8;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
                ctx.beginPath();
                ctx.roundRect((w / 2) - (lineW / 2) - padX, lineY - (fontSize / 2) - padY, lineW + (padX * 2), fontSize + (padY * 2), 8);
                ctx.fill();

                ctx.fillStyle = textColor;
                ctx.fillText(lineText, w / 2, lineY);
            } else if (subStyle === 'outline') {
                ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.12));
                ctx.strokeStyle = textAccent;
                ctx.strokeText(lineText, w / 2, lineY);

                ctx.fillStyle = textColor;
                ctx.fillText(lineText, w / 2, lineY);
            } else if (subStyle === 'glow') {
                ctx.shadowColor = textAccent;
                ctx.shadowBlur = 18;
                ctx.fillStyle = textColor;
                ctx.fillText(lineText, w / 2, lineY);

                // Re-draw text clean on top
                ctx.shadowBlur = 0;
                ctx.fillText(lineText, w / 2, lineY);
            } else {
                // Plain
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 6;
                ctx.fillStyle = textColor;
                ctx.fillText(lineText, w / 2, lineY);
            }
        });

        ctx.restore();
    }

    // Play audio for a specific scene in batch mode
    function playSceneAudio(sceneIdx) {
        if (!AVState.scenes || !AVState.scenes[sceneIdx]) return;
        AVState.activeSceneIndex = sceneIdx;
        const scene = AVState.scenes[sceneIdx];
        highlightActiveSceneCard(sceneIdx, true);
        drawCanvasAtTime(scene.startTime);

        const trackUrl = scene.voiceAudio?.url || AVState.batchAudioFiles[sceneIdx]?.url;
        if (trackUrl) {
            AVState.isSwitchingTrack = true;
            if (!isSameAudioSrc(AVState.audioElement.src, trackUrl)) {
                AVState.audioElement.src = trackUrl;
            }
            AVState.audioElement.currentTime = 0;
            AVState.isSwitchingTrack = false;

            AVState.audioElement.play().then(() => {
                AVState.isPlaying = true;
                if (dom.btnPlayPause) dom.btnPlayPause.textContent = '⏸ Tạm Dừng';
                if (typeof AVState.start60FpsAnimationLoop === 'function') {
                    AVState.start60FpsAnimationLoop();
                }
            }).catch(e => {
                console.warn('Audio play notice:', e);
            });
        }
    }

    // Play / Pause Toggle
    function togglePlayPause() {
        if (AVState.audioMode === 'batch') {
            if (!AVState.scenes || AVState.scenes.length === 0) {
                if (AVState.batchAudioFiles.length > 0 && AVState.batchAudioFiles[0].url) {
                    if (AVState.isPlaying) {
                        AVState.audioElement.pause();
                        AVState.isPlaying = false;
                        if (typeof AVState.stop60FpsAnimationLoop === 'function') AVState.stop60FpsAnimationLoop();
                        if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
                    } else {
                        AVState.audioElement.src = AVState.batchAudioFiles[0].url;
                        AVState.audioElement.play();
                        AVState.isPlaying = true;
                        if (typeof AVState.start60FpsAnimationLoop === 'function') AVState.start60FpsAnimationLoop();
                        if (dom.btnPlayPause) dom.btnPlayPause.textContent = '⏸ Tạm Dừng';
                    }
                    return;
                }
                alert('Chưa có loạt audio hoặc phân cảnh để phát!');
                return;
            }

            if (AVState.isPlaying) {
                AVState.audioElement.pause();
                AVState.isPlaying = false;
                if (typeof AVState.stop60FpsAnimationLoop === 'function') AVState.stop60FpsAnimationLoop();
                if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
            } else {
                playSceneAudio(AVState.activeSceneIndex || 0);
            }
            return;
        }

        // Original Single Mode
        if (!AVState.audioElement.src) {
            alert('Chưa có Voice Audio để phát!');
            return;
        }

        if (AVState.isPlaying) {
            AVState.audioElement.pause();
            AVState.isPlaying = false;
            if (typeof AVState.stop60FpsAnimationLoop === 'function') AVState.stop60FpsAnimationLoop();
            if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
        } else {
            AVState.audioElement.play();
            AVState.isPlaying = true;
            if (typeof AVState.start60FpsAnimationLoop === 'function') AVState.start60FpsAnimationLoop();
            if (dom.btnPlayPause) dom.btnPlayPause.textContent = '⏸ Tạm Dừng';
        }
    }

    // Apply entire visual storyboard to Timeline Tab 1
    function applyToTimelineEditor() {
        if (!AVState.scenes || AVState.scenes.length === 0) {
            alert('⚠️ Chưa có phân cảnh nào được khớp! Vui lòng bấm "Bắt Đầu Tự Động Khớp Voice ➔ Ảnh" trước.');
            return;
        }

        const newTimeline = [];
        AVState.scenes.forEach((scene, sIdx) => {
            const img = AVState.images[scene.imageIndex] || AVState.images[0];
            if (!img) return;

            const cloned = JSON.parse(JSON.stringify(img));
            if (!cloned.settings) cloned.settings = {};

            cloned.settings.motion = scene.motion || 'none';
            cloned.settings.transition = scene.transition || 'none';
            cloned.settings.duration = parseFloat((scene.endTime - scene.startTime).toFixed(2));
            cloned.settings.startTime = scene.startTime;
            cloned.settings.endTime = scene.endTime;
            cloned.settings.fadeIn = (scene.transition === 'none') ? 0.0 : 0.25;
            cloned.settings.fadeOut = (scene.transition === 'none') ? 0.0 : 0.25;
            // ATTACH SUBTITLES & OVERLAY TEXT (If enabled)
            if (AVState.enableSubtitles && scene.sceneText && scene.sceneText.trim()) {
                cloned.settings.overlayText = scene.sceneText.trim();
                cloned.settings.textStyle = AVState.subtitleStyle.style || 'banner';
                cloned.settings.textPosition = AVState.subtitleStyle.position || 'bottom';
                cloned.settings.fontSize = AVState.subtitleStyle.fontSize || 48;
                cloned.settings.textColor = AVState.subtitleStyle.textColor || '#FFFFFF';
                cloned.settings.textAccent = AVState.subtitleStyle.textAccent || '#06B6D4';
                cloned.settings.textAlign = 'center';
            } else {
                cloned.settings.overlayText = '';
            }
            cloned.isPlaceholder = false;

            // Discrete per-scene voice audio (nếu dùng chế độ loạt Audio Phân Cảnh)
            if (scene.voiceAudio) {
                cloned.voiceAudio = scene.voiceAudio;
                cloned.settings.voiceAudio = scene.voiceAudio;
            }

            newTimeline.push(cloned);
        });

        if (newTimeline.length > 0) {
            if (typeof window.recordHistorySnapshot === 'function') window.recordHistorySnapshot();

            window.mediaItems = newTimeline;

            // Voice audio setup
            if (AVState.audioMode === 'batch') {
                // Ở chế độ loạt audio, từng phân cảnh đã có audio riêng gắn trực tiếp trong item.settings.voiceAudio
                // Xóa hoặc không đè BGM đơn lẻ để tránh lặp âm thanh
                window.bgmTrack = null;
                if (typeof window.updateBgmUI === 'function') window.updateBgmUI();
            } else if (AVState.audioUrl) {
                // Ở chế độ 1 file duy nhất, đưa vào BGM của Timeline (Giữ nguyên 100% cũ)
                window.bgmTrack = {
                    filename: AVState.audioFile?.filename || (window.bgmTrack && window.bgmTrack.filename) || 'voiceover.mp3',
                    originalName: AVState.audioName,
                    url: AVState.audioUrl,
                    duration: AVState.audioDuration
                };
                if (typeof window.updateBgmUI === 'function') window.updateBgmUI();
            }

            // Sync Aspect Ratio to Tab 1 Settings Modal if available
            if (AVState.aspectRatio) {
                const ratioRadio = document.querySelector(`input[name="aspect-ratio"][value="${AVState.aspectRatio}"]`);
                if (ratioRadio) {
                    ratioRadio.checked = true;
                    ratioRadio.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const ratioChip = document.querySelector(`.ratio-option[data-ratio="${AVState.aspectRatio}"]`);
                if (ratioChip) {
                    document.querySelectorAll('.ratio-option').forEach(o => o.classList.remove('active'));
                    ratioChip.classList.add('active');
                }
            }

            if (typeof window.renderMediaList === 'function') window.renderMediaList();
            if (typeof window.updateTotalDuration === 'function') window.updateTotalDuration();

            // Switch to Timeline
            if (typeof window.switchMainTab === 'function') {
                window.switchMainTab('tab-btn-editor');
            }

            const subNotice = AVState.enableSubtitles ? 'kèm Phụ Đề Chuẩn 1:1' : 'Thuần Visual (Không phụ đề)';
            showToast(`🎉 Đã đưa thành công ${newTimeline.length} phân cảnh (${subNotice}) vào Timeline!`);
        }
    }

    // Direct Export Video
    function handleExportDirect() {
        if (!AVState.scenes || AVState.scenes.length === 0) {
            alert('Vui lòng khớp kịch bản và ảnh trước khi xuất video!');
            return;
        }

        applyToTimelineEditor();

        // Trigger render
        const btnRender = document.getElementById('btn-render-all');
        if (btnRender) {
            btnRender.click();
        }
    }

    // Format Seconds to SRT Timecode: 00:00:00,000
    function formatSrtTimecode(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }

    // Export .SRT Subtitle File
    function handleExportSrt() {
        if (!AVState.scenes || AVState.scenes.length === 0) {
            alert('⚠️ Chưa có phân cảnh nào để xuất phụ đề! Vui lòng khớp Audio và Kịch bản trước.');
            return;
        }

        let srtContent = '';
        let cueCounter = 1;
        const maxChars = (AVState.aspectRatio === '9:16') ? 24 : 36;

        AVState.scenes.forEach((s) => {
            const fullText = (s.sceneText || '').trim();
            if (!fullText) return;

            const sceneDur = Math.max(0.2, s.endTime - s.startTime);
            const pages = splitTextIntoDisplayPages(fullText, maxChars);

            if (pages.length <= 1) {
                const st = formatSrtTimecode(s.startTime);
                const et = formatSrtTimecode(s.endTime);
                srtContent += `${cueCounter++}\n`;
                srtContent += `${st} --> ${et}\n`;
                srtContent += `${fullText}\n\n`;
            } else {
                // Chia thời lượng phân cảnh theo tỉ lệ số ký tự để đồng bộ chính xác với voice
                const totalChars = pages.reduce((sum, p) => sum + p.length, 0) || 1;
                let currentStart = s.startTime;
                pages.forEach((pText, pIdx) => {
                    const frac = pText.length / totalChars;
                    const chunkDur = sceneDur * frac;
                    const chunkEt = (pIdx === pages.length - 1) ? s.endTime : (currentStart + chunkDur);
                    srtContent += `${cueCounter++}\n`;
                    srtContent += `${formatSrtTimecode(currentStart)} --> ${formatSrtTimecode(chunkEt)}\n`;
                    srtContent += `${pText.trim()}\n\n`;
                    currentStart = chunkEt;
                });
            }
        });

        const blob = new Blob([srtContent], { type: 'application/x-subrip;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitles_${Date.now()}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`📥 Đã xuất thành công file SRT gồm ${cueCounter - 1} phân đoạn câu phụ đề!`);
    }

    // Export .ASS Subtitle File
    function handleExportAss() {
        if (!AVState.scenes || AVState.scenes.length === 0) {
            alert('⚠️ Chưa có phân cảnh nào để xuất phụ đề! Vui lòng khớp Audio và Kịch bản trước.');
            return;
        }

        const maxChars = (AVState.aspectRatio === '9:16') ? 24 : 36;
        const segments = [];
        let segCounter = 1;

        AVState.scenes.forEach((s) => {
            const fullText = (s.sceneText || '').trim();
            if (!fullText) return;

            const sceneDur = Math.max(0.2, s.endTime - s.startTime);
            const pages = splitTextIntoDisplayPages(fullText, maxChars);

            if (pages.length <= 1) {
                segments.push({
                    id: segCounter++,
                    start: s.startTime,
                    end: s.endTime,
                    text: fullText,
                    words: [{ word: fullText, start: s.startTime, end: s.endTime }]
                });
            } else {
                const totalChars = pages.reduce((sum, p) => sum + p.length, 0) || 1;
                let currentStart = s.startTime;
                pages.forEach((pText, pIdx) => {
                    const frac = pText.length / totalChars;
                    const chunkDur = sceneDur * frac;
                    const chunkEt = (pIdx === pages.length - 1) ? s.endTime : (currentStart + chunkDur);
                    segments.push({
                        id: segCounter++,
                        start: currentStart,
                        end: chunkEt,
                        text: pText.trim(),
                        words: [{ word: pText.trim(), start: currentStart, end: chunkEt }]
                    });
                    currentStart = chunkEt;
                });
            }
        });

        fetch('/api/subtitles/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segments,
                format: 'ass',
                style: {
                    aspectRatio: AVState.aspectRatio || '16:9',
                    fontFamily: 'Arial',
                    fontSize: AVState.subtitleStyle.fontSize || 48,
                    primaryColor: AVState.subtitleStyle.textColor || '#FFFFFF',
                    highlightColor: AVState.subtitleStyle.textAccent || '#06B6D4',
                    position: AVState.subtitleStyle.position || 'bottom'
                }
            })
        })
        .then(res => res.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subtitles_${Date.now()}.ass`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`📥 Đã xuất thành công file ASS gồm ${segments.length} phân đoạn câu!`);
        })
        .catch(err => {
            alert('Lỗi xuất file ASS: ' + err.message);
        });
    }

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        initDOMElements();
        setupEventListeners();
    });

})();
