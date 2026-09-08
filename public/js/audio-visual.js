/**
 * TAB 5: AUDIO TO VISUAL (AUDIO ➔ ẢNH KHÔNG PHỤ ĐỀ)
 * Tự động đồng bộ giọng đọc và chuỗi ảnh tài liệu không phụ đề
 * Chuyển cảnh cắt thẳng mượt mà, thuần visual + audio kể chuyện.
 */

(function () {
    'use strict';

    // State for Tab 5 Audio Visual
    const AVState = {
        audioFile: null,
        audioDuration: 0,
        audioUrl: '',
        audioName: '',
        audioElement: new Audio(),
        images: [], // [{ id, filename, originalName, url, duration }]
        scenes: [], // [{ id, startTime, endTime, duration, imageIndex, sceneText, reason }]
        activeSceneIndex: 0,
        isPlaying: false,
        animationFrameId: null,
        aspectRatio: '16:9',
        transition: 'none', // Mặc định cắt thẳng (Cut)
        motion: 'zoom_in',  // Mặc định zoom nhẹ hoặc tĩnh
        isRendering: false
    };

    // DOM Elements Cache
    let dom = {};

    function initDOMElements() {
        dom = {
            tabBtn: document.getElementById('tab-btn-audio-visual'),
            tabPane: document.getElementById('tab-pane-audio-visual'),

            // Audio Controls
            audioInput: document.getElementById('av-audio-input'),
            audioDropzone: document.getElementById('av-audio-dropzone'),
            btnLoadAudio: document.getElementById('btn-av-load-audio'),
            btnUseTimelineBgm: document.getElementById('btn-av-use-timeline-bgm'),
            audioBanner: document.getElementById('av-audio-banner'),
            audioNameLabel: document.getElementById('av-audio-name'),
            audioDurLabel: document.getElementById('av-audio-dur'),

            // Images Controls
            imagesInput: document.getElementById('av-images-input'),
            imagesDropzone: document.getElementById('av-images-dropzone'),
            btnLoadImages: document.getElementById('btn-av-load-images'),
            btnUseTimelineImages: document.getElementById('btn-av-use-timeline-images'),
            imagesGrid: document.getElementById('av-images-grid'),
            imagesCountBadge: document.getElementById('av-images-count'),

            // Script/Text Input & Settings
            scriptTextarea: document.getElementById('av-script-textarea'),
            btnCleanScript: document.getElementById('btn-av-clean-script'),
            transitionSelect: document.getElementById('av-transition-select'),
            motionSelect: document.getElementById('av-motion-select'),
            pauseSelect: document.getElementById('av-pause-select'),
            densitySelect: document.getElementById('av-density-select'),
            btnRunMatch: document.getElementById('btn-av-run-match'),

            // Player & Canvas
            canvas: document.getElementById('av-live-canvas'),
            playerContainer: document.getElementById('av-player-container'),
            btnPlayPause: document.getElementById('btn-av-play-pause'),
            scrubber: document.getElementById('av-scrubber'),
            timeLabel: document.getElementById('av-time-label'),
            aspectChips: document.querySelectorAll('.btn-av-aspect-chip'),

            // Scenes List & Results
            scenesList: document.getElementById('av-scenes-list'),
            scenesCountBadge: document.getElementById('av-scenes-count-badge'),
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

        // Load Audio File
        if (dom.btnLoadAudio && dom.audioInput) {
            dom.btnLoadAudio.addEventListener('click', () => dom.audioInput.click());
            dom.audioInput.addEventListener('change', handleAudioUpload);
        }

        // Drag and drop for Audio
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
                        renderImagesGrid();
                        showToast(`🖼️ Đã lấy ${imgs.length} ảnh từ Timeline Tab 1!`);
                    } else {
                        alert('Timeline hiện chưa có bức ảnh nào hợp lệ!');
                    }
                } else {
                    alert('Timeline Tab 1 đang trống!');
                }
            });
        }

        // Clean Script Button
        if (dom.btnCleanScript && dom.scriptTextarea) {
            dom.btnCleanScript.addEventListener('click', () => {
                const raw = dom.scriptTextarea.value.trim();
                if (!raw) return;
                const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('---') && !l.startsWith('==='));
                dom.scriptTextarea.value = lines.join('\n');
                showToast(`🧹 Đã chuẩn hóa ${lines.length} câu thoại kịch bản!`);
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
                if (AVState.audioElement) {
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

        // Apply to Timeline
        if (dom.btnApplyToTimeline) {
            dom.btnApplyToTimeline.addEventListener('click', applyToTimelineEditor);
        }

        // Direct Render
        if (dom.btnExportDirect) {
            dom.btnExportDirect.addEventListener('click', handleExportDirect);
        }

        // Audio element events
        AVState.audioElement.addEventListener('timeupdate', () => {
            const cur = AVState.audioElement.currentTime;
            if (dom.scrubber && !dom.scrubber.matches(':active')) {
                dom.scrubber.value = cur;
            }
            if (dom.timeLabel) {
                dom.timeLabel.textContent = `${formatTime(cur)} / ${formatTime(AVState.audioDuration)}`;
            }
            drawCanvasAtTime(cur);
            updateActiveSceneByTime(cur);
        });

        AVState.audioElement.addEventListener('ended', () => {
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

    // Images Upload Handler
    async function handleImagesUpload(e) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

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
                renderImagesGrid();
                showToast(`🖼️ Đã nạp thêm ${data.files.length} ảnh!`);
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
            pill.innerHTML = `
                <img src="${img.url}" alt="${img.originalName}" loading="lazy">
                <span class="av-pill-idx">#${idx + 1}</span>
            `;
            dom.imagesGrid.appendChild(pill);
        });
    }

    // Format Seconds to MM:SS.S
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00.0';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // AI Match Script & Voice to Images
    async function handleRunAiMatch() {
        if (!AVState.audioUrl && (!AVState.audioDuration || AVState.audioDuration <= 0)) {
            alert('⚠️ Vui lòng nạp Voice Audio trước (bấm Tải Tệp Audio hoặc Lấy BGM từ Timeline)!');
            return;
        }
        if (!AVState.images || AVState.images.length === 0) {
            alert('⚠️ Vui lòng nạp Kho Ảnh minh họa trước!');
            return;
        }

        const script = dom.scriptTextarea ? dom.scriptTextarea.value.trim() : '';
        const pauseInterval = dom.pauseSelect ? parseFloat(dom.pauseSelect.value) : 0.0;
        const selectedTrans = dom.transitionSelect ? dom.transitionSelect.value : 'none';
        const selectedMotion = dom.motionSelect ? dom.motionSelect.value : 'none';
        const densityMode = dom.densitySelect ? dom.densitySelect.value : '1_per_scene'; // '1_per_scene' | '2_per_scene' | 'smart_split'

        // Prepare request
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
            dom.btnRunMatch.innerHTML = '🤖 Đang phân tích Voice & khớp ảnh không phụ đề...';
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

                    return {
                        imageIndex: (typeof s.imageIndex === 'number' && s.imageIndex >= 0) ? s.imageIndex : (idx % AVState.images.length),
                        startTime: st,
                        endTime: et,
                        duration: parseFloat((et - st).toFixed(2)),
                        sceneText: s.sceneText || `Ý thoại đoạn #${idx + 1}`,
                        reason: s.reason || 'Mô tả trực quan chuẩn theo giọng đọc',
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
                            <button type="button" class="btn btn-xs btn-ghost btn-split-scene" title="Tách cảnh này thành 2 ảnh (Chia đôi thời lượng)" style="padding: 2px 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); color: #38BDF8;">
                                ✂️ Tách 2 ảnh
                            </button>
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

            // Click scene card to seek
            card.addEventListener('click', (e) => {
                if (e.target.closest('.av-scene-thumb')) {
                    pickImageForScene(sIdx);
                } else if (!e.target.closest('.btn-split-scene')) {
                    seekToScene(sIdx);
                }
            });

            dom.scenesList.appendChild(card);
        });
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
        if (AVState.audioElement) {
            AVState.audioElement.currentTime = scene.startTime;
        }
        drawCanvasAtTime(scene.startTime);
        highlightActiveSceneCard(sceneIdx);
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

        // Motion transform
        let scale = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        if (scene.motion === 'zoom_in') {
            scale = 1.0 + (0.15 * progress);
        } else if (scene.motion === 'zoom_out') {
            scale = 1.15 - (0.15 * progress);
        } else if (scene.motion === 'pan_left') {
            scale = 1.1;
            offsetX = -(progress * 40);
        } else if (scene.motion === 'pan_right') {
            scale = 1.1;
            offsetX = (progress * 40);
        }

        // Transition fade (if not 'none')
        let alpha = 1.0;
        if (scene.transition !== 'none' && scene.fadeIn > 0 && (currentTime - scene.startTime) < scene.fadeIn) {
            alpha = (currentTime - scene.startTime) / scene.fadeIn;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2 + offsetX, -h / 2 + offsetY);

        // Aspect ratio cover fill
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = w / h;
        let dw, dh, dx, dy;
        if (imgRatio > canvasRatio) {
            dh = h;
            dw = h * imgRatio;
            dx = (w - dw) / 2;
            dy = 0;
        } else {
            dw = w;
            dh = w / imgRatio;
            dx = 0;
            dy = (h - dh) / 2;
        }

        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
    }

    // Play / Pause Toggle
    function togglePlayPause() {
        if (!AVState.audioElement.src) {
            alert('Chưa có Voice Audio để phát!');
            return;
        }

        if (AVState.isPlaying) {
            AVState.audioElement.pause();
            AVState.isPlaying = false;
            if (dom.btnPlayPause) dom.btnPlayPause.textContent = '▶ Phát';
        } else {
            AVState.audioElement.play();
            AVState.isPlaying = true;
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
            // CRITICAL: NO SUBTITLES / NO OVERLAY TEXT
            cloned.settings.overlayText = '';
            cloned.isPlaceholder = false;

            newTimeline.push(cloned);
        });

        if (newTimeline.length > 0) {
            if (typeof window.recordHistorySnapshot === 'function') window.recordHistorySnapshot();

            window.mediaItems = newTimeline;

            // Set voice audio into Timeline BGM
            if (AVState.audioUrl) {
                window.bgmTrack = {
                    filename: AVState.audioFile?.filename || (window.bgmTrack && window.bgmTrack.filename) || 'voiceover.mp3',
                    originalName: AVState.audioName,
                    url: AVState.audioUrl,
                    duration: AVState.audioDuration
                };
                if (typeof window.updateBgmUI === 'function') window.updateBgmUI();
            }

            if (typeof window.renderMediaList === 'function') window.renderMediaList();
            if (typeof window.updateTotalDuration === 'function') window.updateTotalDuration();

            // Switch to Timeline
            if (typeof window.switchMainTab === 'function') {
                window.switchMainTab('tab-btn-editor');
            }

            showToast(`🎉 Đã đưa thành công ${newTimeline.length} phân cảnh sạch (Không phụ đề) vào Timeline!`);
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

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        initDOMElements();
        setupEventListeners();
    });

})();
