// =========================================================================
// APPLICATION MAIN ENTRY POINT (public/app.js)
// =========================================================================

// File Upload & Input Elements
const fileInput = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');
const btnClearAll = document.getElementById('btn-clear-all');

// Project Save & Load Elements
const btnSaveProject = document.getElementById('btn-save-project');
const btnOpenProject = document.getElementById('btn-open-project');
const inputProjectFile = document.getElementById('input-project-file');

// Ratio, FPS, Quality & Reframe Selectors
document.querySelectorAll(".ratio-option").forEach(option => {
    option.addEventListener("click", () => {
        document.querySelectorAll(".ratio-option").forEach(o => o.classList.remove("active"));
        option.classList.add("active");
        currentSettings.ratio = option.dataset.ratio;
        currentSettings.width = parseInt(option.dataset.width);
        currentSettings.height = parseInt(option.dataset.height);
        if (typeof updateReframeVisibility === 'function') updateReframeVisibility(currentSettings.ratio);
        if (typeof updateStudioCanvasAspectRatio === 'function') updateStudioCanvasAspectRatio();
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
});

const selectFps = document.getElementById("select-fps");
if (selectFps) {
    selectFps.addEventListener("change", (e) => {
        currentSettings.fps = parseInt(e.target.value);
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
}

const selectExportQuality = document.getElementById('select-export-quality');
if (selectExportQuality) {
    selectExportQuality.addEventListener('change', (e) => {
        currentSettings.qualityPreset = e.target.value;
        if (e.target.value === 'high_1080p_60fps' || e.target.value === 'ultra_4k') {
            if (selectFps) selectFps.value = '60';
            currentSettings.fps = 60;
        } else if (e.target.value === 'fast_720p' || e.target.value === 'standard_1080p') {
            if (selectFps) currentSettings.fps = parseInt(selectFps.value) || 30;
        }
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
}

const selectReframeMode = document.getElementById('select-reframe-mode');
if (selectReframeMode) {
    selectReframeMode.addEventListener('change', (e) => {
        currentSettings.reframeMode = e.target.value;
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
}

// Project Save / Open Event Listeners
if (btnSaveProject) {
    btnSaveProject.addEventListener('click', () => {
        if (typeof exportProjectToFile === 'function') exportProjectToFile();
    });
}
if (btnOpenProject) {
    btnOpenProject.addEventListener('click', () => {
        if (inputProjectFile) inputProjectFile.click();
    });
}
if (inputProjectFile) {
    inputProjectFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            if (typeof importProjectFromFile === 'function') importProjectFromFile(e.target.files[0]);
            inputProjectFile.value = '';
        }
    });
}

// Drag and drop file upload handling
if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesUpload(Array.from(e.dataTransfer.files));
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFilesUpload(Array.from(e.target.files));
            fileInput.value = '';
        }
    });
}

// Upload files to backend
async function handleFilesUpload(files) {
    const formData = new FormData();
    const mediaFiles = [];
    let audioFile = null;

    files.forEach(f => {
        if (f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|m4a|aac)$/i)) {
            audioFile = f;
        } else {
            mediaFiles.push(f);
        }
    });

    if (audioFile) {
        uploadBgmFile(audioFile);
    }

    if (mediaFiles.length === 0) return;

    mediaFiles.forEach(f => formData.append('files', f));

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Máy chủ trả về phản hồi không hợp lệ (HTTP ${res.status}): ${text.slice(0, 120)}`);
        }
        if (data.success && data.files) {
            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            mediaItems = [...mediaItems, ...data.files];
            window.mediaItems = mediaItems;
            if (typeof renderMediaList === 'function') renderMediaList();
        } else {
            throw new Error(data.error || 'Không thể tải tệp lên');
        }
    } catch (err) {
        alert('Lỗi tải tệp: ' + err.message);
    }
}

// BGM Audio Upload & Handling
const bgmFileInput = document.getElementById('bgm-file-input');
const bgmEmptyState = document.getElementById('bgm-empty-state');
const bgmActiveState = document.getElementById('bgm-active-state');
const bgmTitle = document.getElementById('bgm-title');
const bgmDuration = document.getElementById('bgm-duration');
const bgmVolume = document.getElementById('bgm-volume');
const bgmVolumeVal = document.getElementById('bgm-volume-val');
const btnRemoveBgm = document.getElementById('btn-remove-bgm');

if (bgmFileInput) {
    bgmFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            uploadBgmFile(e.target.files[0]);
            bgmFileInput.value = '';
        }
    });
}

async function uploadBgmFile(file) {
    const formData = new FormData();
    formData.append('files', file);
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Máy chủ trả về phản hồi không hợp lệ (HTTP ${res.status}): ${text.slice(0, 120)}`);
        }
        if (data.success && data.files && data.files[0]) {
            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            const bgm = data.files[0];
            bgmTrack = {
                filename: bgm.filename,
                originalName: bgm.originalName,
                duration: bgm.duration,
                volume: bgmVolume ? parseFloat(bgmVolume.value) : 1.0,
                url: bgm.url || `/uploads/${bgm.filename}`
            };
            window.bgmTrack = bgmTrack;
            updateBgmUI();
        } else {
            throw new Error(data.error || 'Không thể tải nhạc nền');
        }
    } catch (err) {
        alert('Lỗi tải nhạc nền: ' + err.message);
    }
}

async function generateAndDrawAudioWaveform(url) {
    const container = document.getElementById('audio-waveform-container');
    const canvas = document.getElementById('audio-waveform-canvas');
    const metaInfo = document.getElementById('waveform-meta-info');
    if (!container || !canvas) return;

    if (!url || !bgmTrack) {
        container.classList.add('hidden');
        audioWaveformPeaks = null;
        return;
    }

    container.classList.remove('hidden');
    if (metaInfo) {
        const m = Math.floor(bgmTrack.duration / 60);
        const s = Math.floor(bgmTrack.duration % 60);
        metaInfo.innerText = `File: ${bgmTrack.originalName} (${m}:${s.toString().padStart(2, '0')})`;
    }

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioContextInstance) audioContextInstance = new AudioContext();
        
        const audioBuffer = await audioContextInstance.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const samples = 400;
        const blockSize = Math.floor(rawData.length / samples);
        const peaks = [];

        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j] || 0);
            }
            peaks.push(sum / blockSize);
        }

        const maxPeak = Math.max(...peaks) || 1;
        audioWaveformPeaks = peaks.map(p => Math.max(0.12, p / maxPeak));

        drawAudioWaveformCanvas();
    } catch (err) {
        console.warn('Audio Waveform generation notice:', err);
        const samples = 300;
        const peaks = [];
        for (let i = 0; i < samples; i++) {
            peaks.push(0.2 + 0.6 * Math.abs(Math.sin(i * 0.15) * Math.cos(i * 0.05)));
        }
        audioWaveformPeaks = peaks;
        drawAudioWaveformCanvas();
    }
}

function drawAudioWaveformCanvas() {
    const canvas = document.getElementById('audio-waveform-canvas');
    if (!canvas || !audioWaveformPeaks) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth || 800;
    const height = canvas.offsetHeight || 42;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const barWidth = width / audioWaveformPeaks.length;
    const centerY = height / 2;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#6366F1');
    gradient.addColorStop(0.5, '#06B6D4');
    gradient.addColorStop(1, '#38BDF8');
    ctx.fillStyle = gradient;

    audioWaveformPeaks.forEach((peak, i) => {
        const barHeight = peak * (height - 6);
        const x = i * barWidth;
        const y = centerY - barHeight / 2;
        ctx.fillRect(x, y, Math.max(1.5, barWidth - 1), barHeight);
    });
}

function updateWaveformPlayhead(progressSec, totalSec) {
    const playhead = document.getElementById('waveform-playhead');
    if (!playhead || totalSec <= 0) return;
    const pct = Math.max(0, Math.min(100, (progressSec / totalSec) * 100));
    playhead.style.left = `${pct}%`;
}

function updateBgmUI() {
    if (bgmTrack) {
        if (bgmEmptyState) bgmEmptyState.classList.add('hidden');
        if (bgmActiveState) bgmActiveState.classList.remove('hidden');
        if (bgmTitle) bgmTitle.innerText = bgmTrack.originalName;
        if (bgmDuration) bgmDuration.innerText = `${Math.floor(bgmTrack.duration / 60)}:${Math.floor(bgmTrack.duration % 60).toString().padStart(2, '0')}`;
        
        generateAndDrawAudioWaveform(bgmTrack.url || `/uploads/${bgmTrack.filename}`);
    } else {
        if (bgmEmptyState) bgmEmptyState.classList.remove('hidden');
        if (bgmActiveState) bgmActiveState.classList.add('hidden');
        const container = document.getElementById('audio-waveform-container');
        if (container) container.classList.add('hidden');
    }
}
window.updateBgmUI = updateBgmUI;

if (bgmVolume) {
    bgmVolume.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        if (bgmVolumeVal) bgmVolumeVal.innerText = `${Math.round(vol * 100)}%`;
        if (bgmTrack) bgmTrack.volume = vol;
    });
}

if (btnRemoveBgm) {
    btnRemoveBgm.addEventListener('click', () => {
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        bgmTrack = null;
        window.bgmTrack = null;
        updateBgmUI();
    });
}

// Fit Timeline to Audio Duration
function fitTimelineToAudioDuration() {
    if (!bgmTrack || !bgmTrack.duration || bgmTrack.duration <= 0) {
        alert('⚠️ Chưa có bài nhạc nền BGM hoặc file âm thanh giọng đọc nào được nạp!');
        return;
    }

    const imageItems = mediaItems.filter(i => i.type === 'image');
    if (imageItems.length === 0) {
        alert('⚠️ Không có bức ảnh nào trên Timeline để co dãn!');
        return;
    }

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const totalAudioSec = bgmTrack.duration;
    let currentTotalImageDur = 0;
    imageItems.forEach(it => {
        currentTotalImageDur += Number(it.settings?.duration || 5.0);
    });

    if (currentTotalImageDur <= 0) currentTotalImageDur = imageItems.length * 5.0;

    const scaleRatio = totalAudioSec / currentTotalImageDur;

    let appliedTotal = 0;
    imageItems.forEach((it) => {
        if (!it.settings) it.settings = {};
        const curD = Number(it.settings.duration || 5.0);
        let newD = parseFloat((curD * scaleRatio).toFixed(1));
        newD = Math.max(1.0, newD);
        it.settings.duration = newD;
        appliedTotal += newD;
    });

    const diff = parseFloat((totalAudioSec - appliedTotal).toFixed(1));
    if (Math.abs(diff) > 0.05 && imageItems.length > 0) {
        const last = imageItems[imageItems.length - 1];
        last.settings.duration = Math.max(1.0, parseFloat((last.settings.duration + diff).toFixed(1)));
    }

    if (typeof renderMediaList === 'function') renderMediaList();

    const m = Math.floor(totalAudioSec / 60);
    const s = Math.floor(totalAudioSec % 60);
    alert(`🎉 Đã tự động co dãn thời lượng ${imageItems.length} bức ảnh vừa khít 100% với Audio!\n• Tổng thời lượng Audio: ${m}:${s.toString().padStart(2, '0')} (${totalAudioSec.toFixed(1)}s)\n• Toàn bộ ảnh đã phủ kín từ đầu đến cuối audio.`);
}
window.fitTimelineToAudioDuration = fitTimelineToAudioDuration;

if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa tất cả các phân đoạn?')) {
            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            mediaItems = [];
            window.mediaItems = [];
            if (typeof renderMediaList === 'function') renderMediaList();
        }
    });
}

// Quick Inspector inputs and change binding
function bindQuickInspectorInputs() {
    const inspMotion = document.getElementById('insp-motion');
    const inspTransition = document.getElementById('insp-transition');
    const inspDuration = document.getElementById('insp-duration');
    const inspLoopCount = document.getElementById('insp-loopcount');
    const inspLoopCountVideo = document.getElementById('insp-loopcount-video');
    const inspIntensity = document.getElementById('insp-intensity');
    const inspFadeIn = document.getElementById('insp-fadein');
    const inspFadeOut = document.getElementById('insp-fadeout');
    const inspTrimStart = document.getElementById('insp-trimstart');
    const inspTrimEnd = document.getElementById('insp-trimend');
    const inspVideoVolume = document.getElementById('insp-videovolume');
    const inspText = document.getElementById('insp-text');
    const inspTextPos = document.getElementById('insp-textpos');
    const inspTextStyle = document.getElementById('insp-textstyle');
    const inspTextSize = document.getElementById('insp-textsize');

    function onInspectorChange() {
        if (isUpdatingInspector) return;
        const item = mediaItems[activeSegmentIndex];
        if (!item) return;

        if (item.type === 'image') {
            if (inspMotion) item.settings.motion = inspMotion.value;
            if (inspTransition) item.settings.transition = inspTransition.value;
            if (inspDuration) item.settings.duration = parseFloat(inspDuration.value) || 5.0;
            if (inspLoopCount) item.settings.loopCount = parseInt(inspLoopCount.value) || 1;
            if (inspIntensity) item.settings.zoomIntensity = parseFloat(inspIntensity.value) || 1.25;
            if (inspFadeIn) item.settings.fadeIn = parseFloat(inspFadeIn.value) || 0;
            if (inspFadeOut) item.settings.fadeOut = parseFloat(inspFadeOut.value) || 0;
        } else {
            if (inspTransition) item.settings.transition = inspTransition.value;
            if (inspTrimStart) item.settings.trimStart = parseFloat(inspTrimStart.value) || 0;
            if (inspTrimEnd) item.settings.trimEnd = parseFloat(inspTrimEnd.value) || item.duration || 5;
            if (inspLoopCountVideo) item.settings.loopCount = parseInt(inspLoopCountVideo.value) || 1;
            if (inspVideoVolume) item.settings.videoVolume = parseFloat(inspVideoVolume.value) || 1.0;
        }

        if (inspText) item.settings.overlayText = inspText.value;
        if (inspTextPos) item.settings.textPosition = inspTextPos.value;
        if (inspTextStyle) item.settings.textStyle = inspTextStyle.value;
        if (inspTextSize) item.settings.fontSize = parseInt(inspTextSize.value) || 48;

        const mediaListEl = document.getElementById('media-list');
        const activeCard = mediaListEl ? mediaListEl.querySelector(`.storyboard-card[data-index="${activeSegmentIndex}"]`) : null;
        if (activeCard) {
            const durTag = activeCard.querySelector('.storyboard-dur-tag');
            const motionTag = activeCard.querySelector('.storyboard-motion-tag');
            const textInd = activeCard.querySelector('.storyboard-text-indicator');

            const dur = item.type === 'image' 
                ? (item.settings.duration || 5.0) 
                : Math.max(0.5, (item.settings.trimEnd || item.duration || 5) - (item.settings.trimStart || 0));

            if (durTag) durTag.innerText = `⏱️ ${dur.toFixed(1)}s`;
            if (motionTag) motionTag.innerText = item.type === 'image' ? getMotionShortName(item.settings.motion) : '✂️ Video Trim';
            if (textInd) textInd.innerText = item.settings?.overlayText?.trim() ? `✍️ ${item.settings.overlayText.trim()}` : '';
        }

        if (typeof drawStudioCanvasFrame === 'function') {
            drawStudioCanvasFrame(activeSegmentIndex, 0);
        }
    }

    [inspMotion, inspTransition, inspDuration, inspLoopCount, inspLoopCountVideo, inspIntensity, inspFadeIn, inspFadeOut, inspTrimStart, inspTrimEnd, inspVideoVolume, inspText, inspTextPos, inspTextStyle, inspTextSize].forEach(el => {
        if (el) {
            el.addEventListener('input', onInspectorChange);
            el.addEventListener('change', () => {
                if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
                onInspectorChange();
            });
        }
    });

    const btnApplyTextStyleAll = document.getElementById("btn-apply-text-style-all");
    if (btnApplyTextStyleAll) {
        btnApplyTextStyleAll.addEventListener("click", applyTextStyleToAllScenes);
    }

    const btnPlay = document.getElementById("studio-btn-play");
    if (btnPlay) btnPlay.addEventListener("click", playStudioSequence);

    const btnPlayScene = document.getElementById("studio-btn-play-scene");
    if (btnPlayScene) btnPlayScene.addEventListener("click", playSingleScene);

    const btnSeekBwd = document.getElementById("studio-btn-seek-backward");
    if (btnSeekBwd) {
        btnSeekBwd.addEventListener("click", () => {
            const curSec = currentStudioTimelineTimeMs / 1000;
            seekToTimelinePosition(Math.max(0, curSec - 5));
        });
    }

    const btnSeekFwd = document.getElementById("studio-btn-seek-forward");
    if (btnSeekFwd) {
        btnSeekFwd.addEventListener("click", () => {
            const curSec = currentStudioTimelineTimeMs / 1000;
            const totalDur = getTotalTimelineDurationSec();
            seekToTimelinePosition(Math.min(totalDur, curSec + 5));
        });
    }

    const btnPrevScene = document.getElementById("studio-btn-prev-scene");
    if (btnPrevScene) {
        btnPrevScene.addEventListener("click", () => {
            if (activeSegmentIndex > 0) {
                const range = getSceneAudioRange(activeSegmentIndex - 1);
                seekToTimelinePosition(range.startTime);
            } else {
                seekToTimelinePosition(0);
            }
        });
    }

    const btnNextScene = document.getElementById("studio-btn-next-scene");
    if (btnNextScene) {
        btnNextScene.addEventListener("click", () => {
            if (activeSegmentIndex < mediaItems.length - 1) {
                const range = getSceneAudioRange(activeSegmentIndex + 1);
                seekToTimelinePosition(range.startTime);
            }
        });
    }
}

function applyTextStyleToAllScenes() {
    if (mediaItems.length === 0) {
        alert('Chưa có phân cảnh nào trên Timeline!');
        return;
    }
    const currentPos = document.getElementById('insp-textpos')?.value || 'bottom';
    const currentStyle = document.getElementById('insp-textstyle')?.value || 'banner';
    const currentSize = parseInt(document.getElementById('insp-textsize')?.value) || 48;

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    mediaItems.forEach(item => {
        if (!item.settings) item.settings = {};
        item.settings.textPosition = currentPos;
        item.settings.textStyle = currentStyle;
        item.settings.fontSize = currentSize;
    });

    if (typeof renderMediaList === 'function') renderMediaList();
    if (typeof drawStudioCanvasFrame === 'function') {
        drawStudioCanvasFrame(activeSegmentIndex, 0);
    }

    const styleNames = { banner: 'Banner mờ', outline: 'Viền đen', glow: 'Neon sáng', plain: 'Chữ trắng' };
    const posNames = { bottom: 'Dưới đáy', center: 'Giữa khung', top: 'Trên đỉnh' };
    alert(`✨ Đã đồng bộ thành công:\n• Kiểu chữ: ${styleNames[currentStyle] || currentStyle}\n• Vị trí: ${posNames[currentPos] || currentPos}\n• Cỡ chữ: ${currentSize}px\n\nCho toàn bộ ${mediaItems.length} phân cảnh trên Timeline!`);
}

// Universal Tab Switching
function switchMainTab(targetTabBtnId) {
    if (typeof isStudioPlayingAll !== 'undefined' && isStudioPlayingAll) {
        isStudioPlayingAll = false;
        const btnPlay = document.getElementById('studio-btn-play');
        if (btnPlay) btnPlay.innerHTML = '▶ Phát Toàn Bộ';
    }

    document.querySelectorAll('video, audio').forEach(media => {
        try {
            if (!media.paused) media.pause();
        } catch (e) {}
    });

    document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === targetTabBtnId);
    });

    const tabMap = {
        'tab-btn-editor': 'tab-pane-editor',
        'tab-btn-subtitles': 'tab-pane-subtitles',
        'tab-btn-watermark': 'tab-pane-watermark',
        'tab-btn-qa': 'tab-pane-qa'
    };

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabMap[targetTabBtnId]);
    });
}
window.switchMainTab = switchMainTab;

// DOMContentLoaded Entry Initialization
document.addEventListener("DOMContentLoaded", () => {
    updateReframeVisibility(currentSettings.ratio);
    bindQuickInspectorInputs();

    // Universal tab switcher
    document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchMainTab(btn.id);
        });
    });

    // AI Magic Tools Dropdown Toggle
    const btnAiToggle = document.getElementById('btn-ai-dropdown-toggle');
    const aiMenu = document.getElementById('ai-magic-dropdown-menu');

    if (btnAiToggle && aiMenu) {
        btnAiToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            aiMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!aiMenu.contains(e.target) && e.target !== btnAiToggle) {
                aiMenu.classList.add('hidden');
            }
        });

        aiMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                aiMenu.classList.add('hidden');
            });
        });
    }

    // Stepper buttons for inspector duration
    const btnDurMinus = document.getElementById('btn-dur-minus');
    const btnDurPlus = document.getElementById('btn-dur-plus');
    const inspDurInput = document.getElementById('insp-duration');

    if (btnDurMinus && inspDurInput) {
        btnDurMinus.addEventListener('click', () => {
            let val = parseFloat(inspDurInput.value) || 5.0;
            val = Math.max(1.0, parseFloat((val - 0.5).toFixed(1)));
            inspDurInput.value = val;
            inspDurInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    if (btnDurPlus && inspDurInput) {
        btnDurPlus.addEventListener('click', () => {
            let val = parseFloat(inspDurInput.value) || 5.0;
            val = Math.min(30.0, parseFloat((val + 0.5).toFixed(1)));
            inspDurInput.value = val;
            inspDurInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    // Fit Timeline to Audio Button
    const btnFitAudio = document.getElementById('btn-fit-timeline-audio');
    if (btnFitAudio) {
        btnFitAudio.addEventListener('click', fitTimelineToAudioDuration);
    }

    // Audio Waveform Canvas Click to Seek
    const waveformCanvasWrap = document.querySelector('.waveform-canvas-wrap');
    if (waveformCanvasWrap) {
        waveformCanvasWrap.addEventListener('click', (e) => {
            if (!bgmTrack || !bgmTrack.duration) return;
            const rect = waveformCanvasWrap.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1.0, clickX / rect.width));
            const targetSec = pct * bgmTrack.duration;
            seekToTimelinePosition(targetSec, true);
        });
    }

    // Timeline Scrubber Dragging & Realtime Seeking
    const studioScrubber = document.getElementById('studio-scrubber');
    if (studioScrubber) {
        studioScrubber.addEventListener('input', (e) => {
            if (mediaItems.length === 0) return;
            const pct = parseFloat(e.target.value) / 100;
            const totalDur = getTotalTimelineDurationSec();
            const targetSec = pct * totalDur;
            seekToTimelinePosition(targetSec, true);
        });
    }

    // Undo / Redo Top Bar Buttons
    const btnUndo = document.getElementById('btn-undo-action');
    const btnRedo = document.getElementById('btn-redo-action');
    if (btnUndo) btnUndo.addEventListener('click', performUndoAction);
    if (btnRedo) btnRedo.addEventListener('click', performRedoAction);

    // Multi-select Toolbar Action Handlers
    document.querySelectorAll('.btn-multi-dur').forEach(btn => {
        btn.addEventListener('click', () => {
            const dur = parseFloat(btn.dataset.dur);
            if (!isNaN(dur)) applyBatchDurationToSelected(dur);
        });
    });

    const multiMotionSel = document.getElementById('multi-select-motion');
    if (multiMotionSel) {
        multiMotionSel.addEventListener('change', (e) => {
            if (e.target.value) {
                applyBatchMotionToSelected(e.target.value);
                e.target.value = '';
            }
        });
    }

    const multiTransSel = document.getElementById('multi-select-transition');
    if (multiTransSel) {
        multiTransSel.addEventListener('change', (e) => {
            if (e.target.value) {
                applyBatchTransitionToSelected(e.target.value);
                e.target.value = '';
            }
        });
    }

    const btnMultiDel = document.getElementById('btn-multi-delete');
    if (btnMultiDel) btnMultiDel.addEventListener('click', deleteSelectedSegments);

    const btnMultiSelAll = document.getElementById('btn-multi-select-all');
    if (btnMultiSelAll) btnMultiSelAll.addEventListener('click', selectAllSegments);

    const btnMultiClear = document.getElementById('btn-multi-clear');
    if (btnMultiClear) btnMultiClear.addEventListener('click', clearMultiSelection);

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;

        // Undo / Redo Shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) {
                performRedoAction();
            } else {
                performUndoAction();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
            e.preventDefault();
            performRedoAction();
            return;
        }

        // Select All on Timeline (Ctrl+A)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
            e.preventDefault();
            selectAllSegments();
            return;
        }

        // Escape to clear multi selection
        if (e.code === 'Escape') {
            clearMultiSelection();
            return;
        }

        if (e.code === 'Space') {
            e.preventDefault();
            playStudioSequence();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            const curSec = currentStudioTimelineTimeMs / 1000;
            seekToTimelinePosition(Math.max(0, curSec - 5));
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            const curSec = currentStudioTimelineTimeMs / 1000;
            const totalDur = getTotalTimelineDurationSec();
            seekToTimelinePosition(Math.min(totalDur, curSec + 5));
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
            if (selectedSegmentIndices.size > 1) {
                e.preventDefault();
                deleteSelectedSegments();
            } else if (mediaItems.length > 0 && activeSegmentIndex >= 0) {
                e.preventDefault();
                recordHistorySnapshot();
                removeItem(activeSegmentIndex);
            }
        }
    });
});
