// App State
let mediaItems = [];
let bgmTrack = null;
let currentSettings = {
    ratio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    qualityPreset: 'standard_1080p',
    reframeMode: 'cover'
};

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');
const mediaList = document.getElementById('media-list');
const emptyState = document.getElementById('empty-state');
const itemCountEl = document.getElementById('item-count');
const totalDurationEl = document.getElementById('total-est-duration');
const btnRenderAll = document.getElementById('btn-render-all');
const btnClearAll = document.getElementById('btn-clear-all');
const btnSampleDemo = document.getElementById('btn-sample-demo');

// Project Save & Load Elements
const btnSaveProject = document.getElementById('btn-save-project');
const btnOpenProject = document.getElementById('btn-open-project');
const inputProjectFile = document.getElementById('input-project-file');
const btnRestoreAutosave = document.getElementById('btn-restore-autosave');
const btnDismissAutosave = document.getElementById('btn-dismiss-autosave');

// Aspect ratio selector & Smart Reframe Toggle
const rowReframeMode = document.getElementById("row-reframe-mode");

function updateReframeVisibility(ratio) {
    if (rowReframeMode) {
        if (ratio === "9:16" || ratio === "1:1") {
            rowReframeMode.classList.remove("hidden");
        } else {
            rowReframeMode.classList.add("hidden");
        }
    }
}

function updateStudioCanvasAspectRatio() {
    const canvas = document.getElementById("studio-preview-canvas");
    const container = document.getElementById("studio-player-container");
    if (!canvas) return;

    if (currentSettings.ratio === "9:16") {
        if (container) container.style.aspectRatio = "9 / 16";
        canvas.width = 1080;
        canvas.height = 1920;
    } else if (currentSettings.ratio === "1:1") {
        if (container) container.style.aspectRatio = "1 / 1";
        canvas.width = 1080;
        canvas.height = 1080;
    } else {
        if (container) container.style.aspectRatio = "16 / 9";
        canvas.width = 1920;
        canvas.height = 1080;
    }
    if (mediaItems.length > 0 && typeof drawStudioCanvasFrame === "function") {
        drawStudioCanvasFrame(activeSegmentIndex, 0);
    }
}

document.querySelectorAll(".ratio-option").forEach(option => {
    option.addEventListener("click", () => {
        document.querySelectorAll(".ratio-option").forEach(o => o.classList.remove("active"));
        option.classList.add("active");
        currentSettings.ratio = option.dataset.ratio;
        currentSettings.width = parseInt(option.dataset.width);
        currentSettings.height = parseInt(option.dataset.height);
        updateReframeVisibility(currentSettings.ratio);
        updateStudioCanvasAspectRatio();
        triggerAutoSave();
    });
});

// Initialize on page load
updateReframeVisibility(currentSettings.ratio);

const selectFps = document.getElementById("select-fps");
if (selectFps) {
    selectFps.addEventListener("change", (e) => {
        currentSettings.fps = parseInt(e.target.value);
        triggerAutoSave();
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
            // keep user's selected FPS or match preset
            if (selectFps) currentSettings.fps = parseInt(selectFps.value) || 30;
        }
        triggerAutoSave();
    });
}

const selectReframeMode = document.getElementById('select-reframe-mode');
if (selectReframeMode) {
    selectReframeMode.addEventListener('change', (e) => {
        currentSettings.reframeMode = e.target.value;
        triggerAutoSave();
    });
}

// Project Save / Open Event Listeners
if (btnSaveProject) {
    btnSaveProject.addEventListener('click', exportProjectToFile);
}
if (btnOpenProject) {
    btnOpenProject.addEventListener('click', () => {
        if (inputProjectFile) inputProjectFile.click();
    });
}
if (inputProjectFile) {
    inputProjectFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            importProjectFromFile(e.target.files[0]);
            inputProjectFile.value = '';
        }
    });
}
if (btnRestoreAutosave) {
    btnRestoreAutosave.addEventListener('click', restoreAutoSave);
}
if (btnDismissAutosave) {
    btnDismissAutosave.addEventListener('click', dismissAutoSave);
}

// Drag and drop handling
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

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFilesUpload(Array.from(e.target.files));
        fileInput.value = '';
    }
});

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
        const data = await res.json();
        if (data.success && data.files) {
            mediaItems = [...mediaItems, ...data.files];
            renderMediaList();
        }
    } catch (err) {
        alert('Lỗi tải tệp: ' + err.message);
    }
}

// BGM Handling
const bgmFileInput = document.getElementById('bgm-file-input');
const bgmEmptyState = document.getElementById('bgm-empty-state');
const bgmActiveState = document.getElementById('bgm-active-state');
const bgmTitle = document.getElementById('bgm-title');
const bgmDuration = document.getElementById('bgm-duration');
const bgmVolume = document.getElementById('bgm-volume');
const bgmVolumeVal = document.getElementById('bgm-volume-val');
const btnRemoveBgm = document.getElementById('btn-remove-bgm');

bgmFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        uploadBgmFile(e.target.files[0]);
        bgmFileInput.value = '';
    }
});

async function uploadBgmFile(file) {
    const formData = new FormData();
    formData.append('files', file);
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.files && data.files[0]) {
            const bgm = data.files[0];
            bgmTrack = {
                filename: bgm.filename,
                originalName: bgm.originalName,
                duration: bgm.duration,
                volume: parseFloat(bgmVolume.value)
            };
            updateBgmUI();
        }
    } catch (err) {
        alert('Lỗi tải nhạc nền: ' + err.message);
    }
}

function updateBgmUI() {
    if (bgmTrack) {
        bgmEmptyState.classList.add('hidden');
        bgmActiveState.classList.remove('hidden');
        bgmTitle.innerText = bgmTrack.originalName;
        bgmDuration.innerText = `${Math.floor(bgmTrack.duration / 60)}:${Math.floor(bgmTrack.duration % 60).toString().padStart(2, '0')}`;
    } else {
        bgmEmptyState.classList.remove('hidden');
        bgmActiveState.classList.add('hidden');
    }
}

bgmVolume.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    bgmVolumeVal.innerText = `${Math.round(vol * 100)}%`;
    if (bgmTrack) bgmTrack.volume = vol;
});

btnRemoveBgm.addEventListener('click', () => {
    bgmTrack = null;
    updateBgmUI();
});

let activeSegmentIndex = 0;
let studioAnimFrame = null;
let isStudioPlayingAll = false;
const studioLoadedImages = new Map();

function getMotionShortName(motion) {
    switch (motion) {
        case 'zoom_in': return '🔍 Zoom In';
        case 'zoom_out': return '🔎 Zoom Out';
        case 'pan_left': return '⬅️ Pan Trái';
        case 'pan_right': return '➡️ Pan Phải';
        case 'pan_up': return '⬆️ Pan Lên';
        case 'pan_down': return '⬇️ Pan Xuống';
        case 'zoom_pan': return '🎯 Zoom+Pan';
        case 'zoom_in_left': return '↖️ Zoom Trái';
        case 'zoom_in_right': return '↗️ Zoom Phải';
        case 'none': return '⏹️ Tĩnh';
        default: return '🎬 ' + (motion || 'Zoom');
    }
}

// Render Media Storyboard Ribbon List
function renderMediaList() {
    if (window.mediaItems && window.mediaItems !== mediaItems) {
        mediaItems = window.mediaItems;
    } else {
        window.mediaItems = mediaItems;
    }
    if (window.bgmTrack !== undefined && window.bgmTrack !== bgmTrack) {
        bgmTrack = window.bgmTrack;
    } else {
        window.bgmTrack = bgmTrack;
    }

    const quickInspector = document.getElementById('quick-inspector');

    if (mediaItems.length === 0) {
        emptyState.classList.remove('hidden');
        mediaList.innerHTML = '';
        mediaList.appendChild(emptyState);
        btnRenderAll.disabled = true;
        itemCountEl.innerText = '0';
        totalDurationEl.innerText = '0.0s';
        updateWorkflowStep(1);
        if (quickInspector) quickInspector.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    mediaList.innerHTML = '';
    btnRenderAll.disabled = false;
    itemCountEl.innerText = mediaItems.length;
    updateWorkflowStep(2);

    if (activeSegmentIndex >= mediaItems.length) {
        activeSegmentIndex = Math.max(0, mediaItems.length - 1);
    }

    let totalDur = 0;

    mediaItems.forEach((item, index) => {
        const isImage = item.type === 'image';
        const isPlaceholder = Boolean(item.isPlaceholder);
        const dur = isImage 
            ? Number(item.settings?.duration || 5.0) 
            : Math.max(0.5, Number(item.settings?.trimEnd || item.duration || 5) - Number(item.settings?.trimStart || 0));
        totalDur += Math.max(0.5, dur);

        const card = document.createElement('div');
        card.className = `storyboard-card ${index === activeSegmentIndex ? 'active' : ''} ${isPlaceholder ? 'is-placeholder' : ''}`;
        card.dataset.index = index;
        card.setAttribute('draggable', 'true');

        // Drag and Drop Event Listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        // Click to select
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-card-upload-img')) return; // Handled separately
            selectSegment(index);
        });

        const motionLabel = isPlaceholder 
            ? '📷 Cần thêm ảnh' 
            : (isImage ? getMotionShortName(item.settings?.motion || 'zoom_in') : '✂️ Video Trim');

        const textPreview = item.settings?.overlayText?.trim() 
            ? `✍️ ${item.settings.overlayText.trim()}` 
            : '';

        const loopCount = item.settings?.loopCount || 1;

        let thumbHtml = '';
        if (isPlaceholder) {
            thumbHtml = `
                <div class="storyboard-placeholder-thumb">
                    <span class="placeholder-icon">📷</span>
                    <span style="font-size: 9px; font-weight: 700; color: #FBBF24;">Chờ thêm ảnh</span>
                    <button type="button" class="placeholder-btn-mini btn-card-upload-img" data-index="${index}">➕ Bù ảnh</button>
                </div>
            `;
        } else if (isImage) {
            thumbHtml = `<img src="${item.url}" class="storyboard-thumb-img" alt="${item.originalName}">`;
        } else {
            thumbHtml = `<video src="${item.url}" class="storyboard-thumb-img" muted></video>`;
        }

        card.innerHTML = `
            <div class="storyboard-thumb-box">
                ${thumbHtml}
                <span class="storyboard-idx-tag">#${index + 1}</span>
                <span class="storyboard-dur-tag">⏱️ ${dur.toFixed(1)}s${loopCount > 1 ? ` (🔁 ${loopCount}x)` : ''}</span>
            </div>
            <div class="storyboard-meta-strip">
                <span class="storyboard-motion-tag">${motionLabel}</span>
                <span class="storyboard-text-indicator">${textPreview}</span>
            </div>
        `;
        mediaList.appendChild(card);
    });

    // Attach inline upload listeners for placeholder cards
    mediaList.querySelectorAll('.btn-card-upload-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            uploadImageForSegment(idx);
        });
    });

    totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
    
    // Update Quick Inspector & Studio Canvas Player
    selectSegment(activeSegmentIndex, false);
    triggerAutoSave();
}


function selectSegment(index, shouldScroll = true) {
    if (index < 0 || index >= mediaItems.length) return;
    activeSegmentIndex = index;

    // Highlight card
    const cards = mediaList.querySelectorAll('.storyboard-card');
    cards.forEach((c, idx) => {
        if (idx === index) {
            c.classList.add('active');
            if (shouldScroll) c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            c.classList.remove('active');
        }
    });

    updateQuickInspector(index);
    drawStudioCanvasFrame(index, 0);
}

function updateQuickInspector(index) {
    const quickInspector = document.getElementById('quick-inspector');
    const item = mediaItems[index];
    if (!item) {
        if (quickInspector) quickInspector.classList.add('hidden');
        return;
    }
    if (quickInspector) quickInspector.classList.remove('hidden');

    const inspNum = document.getElementById('inspector-segment-num');
    const inspFilename = document.getElementById('inspector-filename');
    const inspTypeBadge = document.getElementById('inspector-type-badge');
    const inspImageControls = document.getElementById('inspector-image-controls');
    const inspVideoControls = document.getElementById('inspector-video-controls');
    const inspPlaceholderBanner = document.getElementById('inspector-placeholder-banner');
    const btnInspUploadPlaceholder = document.getElementById('btn-insp-upload-placeholder');

    const isPlaceholder = Boolean(item.isPlaceholder);

    if (inspNum) inspNum.innerText = `#${index + 1}`;
    if (inspFilename) inspFilename.innerText = item.originalName;
    if (inspTypeBadge) {
        inspTypeBadge.className = `card-type-badge ${isPlaceholder ? 'placeholder' : item.type}`;
        inspTypeBadge.innerText = isPlaceholder ? '⚠️ Chờ ảnh' : (item.type === 'image' ? '🖼️ Ảnh' : '🎬 Clip');
    }

    if (inspPlaceholderBanner) {
        inspPlaceholderBanner.classList.toggle('hidden', !isPlaceholder);
    }
    if (btnInspUploadPlaceholder) {
        btnInspUploadPlaceholder.onclick = () => uploadImageForSegment(index);
    }

    const isImage = item.type === 'image';
    if (inspImageControls) inspImageControls.classList.toggle('hidden', !isImage);
    if (inspVideoControls) inspVideoControls.classList.toggle('hidden', isImage);

    // Sync input values
    const inspMotion = document.getElementById('insp-motion');
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

    if (isImage) {
        if (inspMotion) inspMotion.value = item.settings?.motion || 'zoom_in';
        if (inspDuration) inspDuration.value = item.settings?.duration || 5.0;
        if (inspLoopCount) inspLoopCount.value = item.settings?.loopCount || 1;
        if (inspIntensity) inspIntensity.value = item.settings?.zoomIntensity || 1.25;
        if (inspFadeIn) inspFadeIn.value = item.settings?.fadeIn ?? 0.8;
        if (inspFadeOut) inspFadeOut.value = item.settings?.fadeOut ?? 0.8;
    } else {
        if (inspTrimStart) {
            inspTrimStart.max = item.duration || 10;
            inspTrimStart.value = item.settings?.trimStart || 0;
        }
        if (inspTrimEnd) {
            inspTrimEnd.max = item.duration || 10;
            inspTrimEnd.value = item.settings?.trimEnd || item.duration || 5;
        }
        if (inspLoopCountVideo) inspLoopCountVideo.value = item.settings?.loopCount || 1;
        if (inspVideoVolume) inspVideoVolume.value = item.settings?.videoVolume ?? 1.0;
    }

    if (inspText) inspText.value = item.settings?.overlayText || '';
    if (inspTextPos) inspTextPos.value = item.settings?.textPosition || 'bottom';
    if (inspTextStyle) inspTextStyle.value = item.settings?.textStyle || 'banner';
    if (inspTextSize) inspTextSize.value = item.settings?.fontSize || 48;

    // Actions
    const btnInspPrev = document.getElementById('btn-inspector-move-prev');
    const btnInspNext = document.getElementById('btn-inspector-move-next');
    const btnInspDelete = document.getElementById('btn-inspector-delete');

    if (btnInspPrev) {
        btnInspPrev.disabled = (index === 0);
        btnInspPrev.onclick = () => { moveItem(index, -1); selectSegment(Math.max(0, index - 1)); };
    }
    if (btnInspNext) {
        btnInspNext.disabled = (index === mediaItems.length - 1);
        btnInspNext.onclick = () => { moveItem(index, 1); selectSegment(Math.min(mediaItems.length - 1, index + 1)); };
    }
    if (btnInspDelete) {
        btnInspDelete.onclick = () => { removeItem(index); };
    }
}

function drawStudioCanvasFrame(index, progress = 0) {
    const canvas = document.getElementById('studio-preview-canvas') || document.getElementById('preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const item = mediaItems[index];
    if (!item) return;

    // Update overlay info
    const sceneLabel = document.getElementById('studio-scene-label');
    const sceneMotion = document.getElementById('studio-scene-motion');
    const timeDisplay = document.getElementById('studio-time-display');

    const dur = item.type === 'image' 
        ? (item.settings?.duration || 5.0) 
        : Math.max(0.5, (item.settings?.trimEnd || item.duration || 5) - (item.settings?.trimStart || 0));

    if (sceneLabel) sceneLabel.innerText = `Cảnh #${index + 1} / ${mediaItems.length}`;
    if (sceneMotion) sceneMotion.innerText = item.isPlaceholder ? '⚠️ Chờ thêm ảnh' : (item.type === 'image' ? getMotionShortName(item.settings?.motion) : '🎬 Video Clip');
    if (timeDisplay) timeDisplay.innerText = `${(progress * dur).toFixed(1)}s / ${dur.toFixed(1)}s`;

    if (item.isPlaceholder || !item.url) {
        ctx.fillStyle = '#18140E';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 50px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📷 [PHÂN CẢNH CHỜ THÊM ẢNH]', canvas.width / 2, canvas.height / 2 - 35);

        if (item.settings?.overlayText) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '32px Outfit, sans-serif';
            ctx.fillText(`"${item.settings.overlayText}"`, canvas.width / 2, canvas.height / 2 + 40);
        }
        return;
    }

    if (item.type === 'image') {
        let img = studioLoadedImages.get(item.url);
        if (!img) {
            img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = item.url;
            img.onload = () => {
                studioLoadedImages.set(item.url, img);
                renderImageFrameOnCanvas(ctx, canvas, item, img, progress);
            };
        } else {
            renderImageFrameOnCanvas(ctx, canvas, item, img, progress);
        }
    } else {
        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6366F1';
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🎬 Video: ${item.originalName}`, canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '24px Outfit, sans-serif';
        ctx.fillText(`Thời lượng: ${dur.toFixed(1)}s`, canvas.width / 2, canvas.height / 2 + 30);
    }
}


function renderImageFrameOnCanvas(ctx, canvas, item, img, progress) {
    const motion = item.settings.motion || 'zoom_in';
    const zoomIntensity = item.settings.zoomIntensity || 1.25;
    const delta = zoomIntensity - 1.0;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let zoom = 1.0;
    let offsetX = 0;
    let offsetY = 0;

    const maxPanX = (1 - 1 / zoomIntensity) * (canvas.width / 2);
    const maxPanY = (1 - 1 / zoomIntensity) * (canvas.height / 2);

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
        offsetX = (1 - 1 / zoom) * (canvas.width / 2);
        offsetY = (1 - 1 / zoom) * (canvas.height / 2);
    } else if (motion === 'zoom_in_right') {
        zoom = 1.0 + (delta * progress);
        offsetX = -(1 - 1 / zoom) * (canvas.width / 2);
        offsetY = (1 - 1 / zoom) * (canvas.height / 2);
    } else if (motion === 'zoom_pan') {
        zoom = 1.0 + (delta * progress);
        offsetX = -(1 - 1 / zoom) * (canvas.width / 2) * (1 - 2 * progress);
        offsetY = -(1 - 1 / zoom) * (canvas.height / 2) * (1 - 2 * progress);
    } else {
        zoom = 1.0;
        offsetX = 0;
        offsetY = 0;
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -canvas.width / 2 + offsetX, -canvas.height / 2 + offsetY, canvas.width, canvas.height);
    ctx.restore();

    // Render Text Overlay (Smart Auto Word-Wrap to prevent overflow)
    const overlayText = item.settings?.overlayText?.trim();
    if (overlayText) {
        const textPos = item.settings?.textPosition || 'bottom';
        const textStyle = item.settings?.textStyle || 'banner';
        const fontSize = Number(item.settings?.fontSize) || 48;
        const lineHeight = fontSize * 1.35;
        const maxTextWidth = canvas.width * 0.85; // Leave 7.5% safe margin on each side

        ctx.save();
        ctx.font = `bold ${fontSize}px Outfit, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Word wrap into lines
        const words = overlayText.split(/\s+/);
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxTextWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);

        const totalTextHeight = lines.length * lineHeight;
        const textX = canvas.width / 2;

        let startY = canvas.height - 120 - (totalTextHeight / 2);
        if (textPos === 'top') {
            startY = 100;
        } else if (textPos === 'center') {
            startY = (canvas.height - totalTextHeight) / 2;
        } else {
            startY = canvas.height - 90 - totalTextHeight;
        }

        if (textStyle === 'banner') {
            // Find max width among lines
            let maxLineWidth = 0;
            lines.forEach(l => {
                const w = ctx.measureText(l).width;
                if (w > maxLineWidth) maxLineWidth = w;
            });

            const boxWidth = Math.min(canvas.width * 0.94, maxLineWidth + 56);
            const boxHeight = totalTextHeight + 24;
            const rx = textX - boxWidth / 2;
            const ry = startY - 12;
            const r = 12;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
            ctx.beginPath();
            ctx.moveTo(rx + r, ry);
            ctx.lineTo(rx + boxWidth - r, ry);
            ctx.quadraticCurveTo(rx + boxWidth, ry, rx + boxWidth, ry + r);
            ctx.lineTo(rx + boxWidth, ry + boxHeight - r);
            ctx.quadraticCurveTo(rx + boxWidth, ry + boxHeight, rx + boxWidth - r, ry + boxHeight);
            ctx.lineTo(rx + r, ry + boxHeight);
            ctx.quadraticCurveTo(rx, ry + boxHeight, rx, ry + boxHeight - r);
            ctx.lineTo(rx, ry + r);
            ctx.quadraticCurveTo(rx, ry, rx + r, ry);
            ctx.closePath();
            ctx.fill();
        }

        lines.forEach((line, lIdx) => {
            const lineY = startY + (lIdx * lineHeight) + (lineHeight / 2);

            if (textStyle === 'outline') {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = Math.max(4, fontSize * 0.12);
                ctx.strokeText(line, textX, lineY);
            } else if (textStyle === 'glow') {
                ctx.shadowColor = '#06B6D4';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(line, textX, lineY);
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(line, textX, lineY);
        });

        ctx.restore();
    }
}

function playStudioSequence() {
    if (isStudioPlayingAll) {
        isStudioPlayingAll = false;
        if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
        const btn = document.getElementById('studio-btn-play');
        if (btn) btn.innerHTML = '▶ Phát Toàn Bộ Video';
        return;
    }

    if (mediaItems.length === 0) return;

    isStudioPlayingAll = true;
    const btn = document.getElementById('studio-btn-play');
    if (btn) btn.innerHTML = '⏸️ Tạm Dừng';

    let currentItemIdx = activeSegmentIndex;
    let itemStartTime = performance.now();
    let currentItem = mediaItems[currentItemIdx];
    let itemDur = (currentItem.type === 'image' ? (currentItem.settings.duration || 5.0) : (currentItem.duration || 5.0)) * 1000;

    function step(now) {
        if (!isStudioPlayingAll) return;
        const elapsed = now - itemStartTime;
        const progress = Math.min(1.0, elapsed / itemDur);

        drawStudioCanvasFrame(currentItemIdx, progress);

        if (progress >= 1.0) {
            currentItemIdx = (currentItemIdx + 1) % mediaItems.length;
            selectSegment(currentItemIdx, true);
            currentItem = mediaItems[currentItemIdx];
            itemDur = (currentItem.type === 'image' ? (currentItem.settings.duration || 5.0) : (currentItem.duration || 5.0)) * 1000;
            itemStartTime = performance.now();
        }

        studioAnimFrame = requestAnimationFrame(step);
    }

    studioAnimFrame = requestAnimationFrame(step);
}

function playSingleScene() {
    if (isStudioPlayingAll) {
        isStudioPlayingAll = false;
        if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
        const btn = document.getElementById('studio-btn-play');
        if (btn) btn.innerHTML = '▶ Phát Toàn Bộ Video';
    }

    if (!mediaItems[activeSegmentIndex]) return;

    if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
    const item = mediaItems[activeSegmentIndex];
    const itemDur = (item.type === 'image' ? (item.settings.duration || 5.0) : (item.duration || 5.0)) * 1000;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, (elapsed % itemDur) / itemDur);
        drawStudioCanvasFrame(activeSegmentIndex, progress);
        studioAnimFrame = requestAnimationFrame(step);
    }

    studioAnimFrame = requestAnimationFrame(step);
}

function bindQuickInspectorInputs() {
    const inspMotion = document.getElementById('insp-motion');
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
        const item = mediaItems[activeSegmentIndex];
        if (!item) return;

        if (item.type === 'image') {
            if (inspMotion) item.settings.motion = inspMotion.value;
            if (inspDuration) item.settings.duration = parseFloat(inspDuration.value) || 5.0;
            if (inspLoopCount) item.settings.loopCount = parseInt(inspLoopCount.value) || 1;
            if (inspIntensity) item.settings.zoomIntensity = parseFloat(inspIntensity.value) || 1.25;
            if (inspFadeIn) item.settings.fadeIn = parseFloat(inspFadeIn.value) || 0;
            if (inspFadeOut) item.settings.fadeOut = parseFloat(inspFadeOut.value) || 0;
        } else {
            if (inspTrimStart) item.settings.trimStart = parseFloat(inspTrimStart.value) || 0;
            if (inspTrimEnd) item.settings.trimEnd = parseFloat(inspTrimEnd.value) || item.duration || 5;
            if (inspLoopCountVideo) item.settings.loopCount = parseInt(inspLoopCountVideo.value) || 1;
            if (inspVideoVolume) item.settings.videoVolume = parseFloat(inspVideoVolume.value) || 1.0;
        }

        if (inspText) item.settings.overlayText = inspText.value;
        if (inspTextPos) item.settings.textPosition = inspTextPos.value;
        if (inspTextStyle) item.settings.textStyle = inspTextStyle.value;
        if (inspTextSize) item.settings.fontSize = parseInt(inspTextSize.value) || 48;

        // Update card in ribbon
        const activeCard = mediaList.querySelector(`.storyboard-card[data-index="${activeSegmentIndex}"]`);
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

        drawStudioCanvasFrame(activeSegmentIndex, 0);
        triggerAutoSave();
    }

    [inspMotion, inspDuration, inspLoopCount, inspLoopCountVideo, inspIntensity, inspFadeIn, inspFadeOut, inspTrimStart, inspTrimEnd, inspVideoVolume, inspText, inspTextPos, inspTextStyle, inspTextSize].forEach(el => {
        if (el) {
            el.addEventListener('input', onInspectorChange);
            el.addEventListener('change', onInspectorChange);
        }
    });

    const btnPlay = document.getElementById("studio-btn-play");
    if (btnPlay) btnPlay.addEventListener("click", playStudioSequence);

    const btnPlayScene = document.getElementById("studio-btn-play-scene");
    if (btnPlayScene) btnPlayScene.addEventListener("click", playSingleScene);
}

// Bind studio inspector and batch events on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    bindQuickInspectorInputs();

    const batchDurSlider = document.getElementById("batch-duration-slider");
    const batchDurVal = document.getElementById("batch-duration-val");
    const btnApplyDurAll = document.getElementById("btn-apply-duration-all");

    if (batchDurSlider && batchDurVal) {
        batchDurSlider.addEventListener("input", (e) => {
            batchDurVal.innerText = parseFloat(e.target.value).toFixed(1) + "s";
        });
    }
    if (btnApplyDurAll && batchDurSlider) {
        btnApplyDurAll.addEventListener("click", () => {
            const val = parseFloat(batchDurSlider.value) || 5.0;
            mediaItems.forEach(it => {
                if (it.type === "image") it.settings.duration = val;
            });
            renderMediaList();
        });
    }

    const batchMotionSelect = document.getElementById("batch-motion-select");
    const btnApplyMotionAll = document.getElementById("btn-apply-motion-all");
    if (btnApplyMotionAll && batchMotionSelect) {
        btnApplyMotionAll.addEventListener("click", () => {
            const val = batchMotionSelect.value;
            mediaItems.forEach(it => {
                if (it.type === "image") it.settings.motion = val;
            });
            renderMediaList();
        });
    }

    const btnRandomize = document.getElementById("btn-randomize-motions");
    if (btnRandomize) {
        btnRandomize.addEventListener("click", () => {
            const motions = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "pan_down", "zoom_pan", "zoom_in_left", "zoom_in_right"];
            mediaItems.forEach((it, idx) => {
                if (it.type === "image") {
                    it.settings.motion = motions[idx % motions.length];
                }
            });
            renderMediaList();
        });
    }

    // Timeline Scrubber Dragging
    const studioScrubber = document.getElementById('studio-scrubber');
    if (studioScrubber) {
        studioScrubber.addEventListener('input', (e) => {
            if (mediaItems.length === 0) return;
            const pct = parseFloat(e.target.value) / 100;
            let totalDur = 0;
            mediaItems.forEach(it => {
                const d = it.type === 'image' ? (it.settings.duration || 5.0) : Math.max(0.5, (it.settings.trimEnd || it.duration || 5) - (it.settings.trimStart || 0));
                totalDur += d;
            });

            const targetSec = pct * totalDur;
            let accumulated = 0;
            let foundIdx = 0;
            let sceneProgress = 0;

            for (let i = 0; i < mediaItems.length; i++) {
                const it = mediaItems[i];
                const d = it.type === 'image' ? (it.settings.duration || 5.0) : Math.max(0.5, (it.settings.trimEnd || it.duration || 5) - (it.settings.trimStart || 0));
                if (targetSec <= accumulated + d || i === mediaItems.length - 1) {
                    foundIdx = i;
                    sceneProgress = Math.max(0, Math.min(1.0, (targetSec - accumulated) / d));
                    break;
                }
                accumulated += d;
            }

            selectSegment(foundIdx, true);
            drawStudioCanvasFrame(foundIdx, sceneProgress);

            const scrubberTime = document.getElementById('studio-scrubber-time');
            if (scrubberTime) {
                const curMin = Math.floor(targetSec / 60);
                const curSec = Math.floor(targetSec % 60);
                const totMin = Math.floor(totalDur / 60);
                const totSec = Math.floor(totalDur % 60);
                scrubberTime.innerText = curMin + ':' + curSec.toString().padStart(2, '0') + ' / ' + totMin + ':' + totSec.toString().padStart(2, '0');
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;

        if (e.code === 'Space') {
            e.preventDefault();
            playStudioSequence();
        } else if (e.code === 'ArrowLeft') {
            if (activeSegmentIndex > 0) {
                e.preventDefault();
                selectSegment(activeSegmentIndex - 1);
            }
        } else if (e.code === 'ArrowRight') {
            if (activeSegmentIndex < mediaItems.length - 1) {
                e.preventDefault();
                selectSegment(activeSegmentIndex + 1);
            }
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
            if (mediaItems.length > 0 && activeSegmentIndex >= 0) {
                e.preventDefault();
                removeItem(activeSegmentIndex);
            }
        }
    });
});

let draggedIndex = null;

function handleDragStart(e) {
    const target = e.target;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "OPTION", "A"].includes(target.tagName) || target.closest("button") || target.closest(".form-control")) {
        e.preventDefault();
        return;
    }
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedIndex);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    this.classList.add("drag-over-target");
}

function handleDragLeave(e) {
    this.classList.remove("drag-over-target");
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove("drag-over-target");
    const targetIndex = parseInt(this.dataset.index);
    if (draggedIndex !== null && !isNaN(draggedIndex) && draggedIndex !== targetIndex) {
        const item = mediaItems.splice(draggedIndex, 1)[0];
        mediaItems.splice(targetIndex, 0, item);
        activeSegmentIndex = targetIndex;
        renderMediaList();
    }
}

function handleDragEnd(e) {
    this.classList.remove("is-dragging");
    document.querySelectorAll(".storyboard-card").forEach(c => {
        c.classList.remove("drag-over-target");
        c.classList.remove("is-dragging");
    });
    draggedIndex = null;
}

// Workflow Step Dynamic Progress
function updateWorkflowStep(step) {
    const steps = document.querySelectorAll('.workflow-steps-bar .step-item');
    steps.forEach((el, idx) => {
        if (idx + 1 <= step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// Expose utilities to window for Tab 2 Sync integration
window.renderMediaList = renderMediaList;
window.updateBgmUI = updateBgmUI;
window.updateWorkflowStep = updateWorkflowStep;

function moveToTop(index) {
    if (index <= 0 || index >= mediaItems.length) return;
    const item = mediaItems.splice(index, 1)[0];
    mediaItems.unshift(item);
    renderMediaList();
}

function moveToBottom(index) {
    if (index < 0 || index >= mediaItems.length - 1) return;
    const item = mediaItems.splice(index, 1)[0];
    mediaItems.push(item);
    renderMediaList();
}

function updateItemSetting(index, key, val) {
    if (mediaItems[index] && mediaItems[index].settings) {
        mediaItems[index].settings[key] = val;
        if (key === 'duration' || key === 'trimStart' || key === 'trimEnd') {
            let totalDur = 0;
            mediaItems.forEach(item => {
                const isImage = item.type === 'image';
                const dur = isImage ? item.settings.duration : (item.settings.trimEnd - item.settings.trimStart);
                totalDur += Math.max(0.5, dur);
            });
            totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
        }
        triggerAutoSave();
    }
}

function moveItem(index, dir) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= mediaItems.length) return;
    const temp = mediaItems[index];
    mediaItems[index] = mediaItems[newIdx];
    mediaItems[newIdx] = temp;
    renderMediaList();
}


function duplicateItem(index) {
    if (!mediaItems[index]) return;
    const clone = JSON.parse(JSON.stringify(mediaItems[index]));
    clone.originalName = clone.originalName + ' (Bản sao)';
    mediaItems.splice(index + 1, 0, clone);
    activeSegmentIndex = index + 1;
    renderMediaList();
}

function removeItem(index) {
    mediaItems.splice(index, 1);
    renderMediaList();
}

btnClearAll.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tất cả các phân đoạn?')) {
        mediaItems = [];
        renderMediaList();
    }
});

// ==========================================
// BATCH CONTROLS FOR TAB 1
// ==========================================
const batchDurationSlider = document.getElementById('batch-duration-slider');
const batchDurationVal = document.getElementById('batch-duration-val');
const btnApplyDurationAll = document.getElementById('btn-apply-duration-all');
const batchMotionIntensity = document.getElementById('batch-motion-intensity');
const btnApplyIntensityAll = document.getElementById('btn-apply-intensity-all');
const batchMotionSelect = document.getElementById('batch-motion-select');
const btnApplyMotionAll = document.getElementById('btn-apply-motion-all');
const btnRandomizeMotions = document.getElementById('btn-randomize-motions');
const batchFadeIn = document.getElementById('batch-fade-in');
const batchFadeOut = document.getElementById('batch-fade-out');
const btnApplyFadeAll = document.getElementById('btn-apply-fade-all');

if (batchDurationSlider) {
    batchDurationSlider.addEventListener('input', (e) => {
        batchDurationVal.innerText = `${parseFloat(e.target.value).toFixed(1)}s`;
    });
}

if (btnApplyDurationAll) {
    btnApplyDurationAll.addEventListener('click', () => {
        const val = parseFloat(batchDurationSlider.value);
        let count = 0;
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.duration = val;
                count++;
            }
        });
        if (count > 0) {
            renderMediaList();
            alert(`✨ Đã đặt thời lượng ${val}s cho toàn bộ ${count} ảnh!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnApplyIntensityAll) {
    btnApplyIntensityAll.addEventListener('click', () => {
        const val = parseFloat(batchMotionIntensity.value);
        let count = 0;
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.zoomIntensity = val;
                count++;
            }
        });
        if (count > 0) {
            renderMediaList();
            alert(`✨ Đã áp dụng cường độ chuyển động cho toàn bộ ${count} ảnh!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnApplyMotionAll) {
    btnApplyMotionAll.addEventListener('click', () => {
        const motion = batchMotionSelect.value;
        let count = 0;
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.motion = motion;
                count++;
            }
        });
        if (count > 0) {
            renderMediaList();
            alert(`✨ Đã chuyển toàn bộ ${count} ảnh sang hiệu ứng: ${motion.replace('_', ' ').toUpperCase()}!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnRandomizeMotions) {
    btnRandomizeMotions.addEventListener('click', () => {
        const availableMotions = [
            'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 
            'pan_up', 'pan_down', 'zoom_pan', 'zoom_in_left', 'zoom_in_right'
        ];
        let count = 0;
        let lastMotion = '';
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                // Pick a motion different from the previous one for visual variety
                let candidates = availableMotions.filter(m => m !== lastMotion);
                let chosen = candidates[Math.floor(Math.random() * candidates.length)];
                item.settings.motion = chosen;
                lastMotion = chosen;
                count++;
            }
        });
        if (count > 0) {
            renderMediaList();
            alert(`🎲 Đã phân bổ ngẫu nhiên các hiệu ứng đa dạng cho ${count} ảnh thành công!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnApplyFadeAll) {
    btnApplyFadeAll.addEventListener('click', () => {
        const fIn = parseFloat(batchFadeIn.value) || 0;
        const fOut = parseFloat(batchFadeOut.value) || 0;
        let count = 0;
        mediaItems.forEach(item => {
            if (!item.settings) item.settings = {};
            item.settings.fadeIn = fIn;
            item.settings.fadeOut = fOut;
            count++;
        });
        if (count > 0) {
            renderMediaList();
            alert(`✨ Đã áp dụng Fade In (${fIn}s) & Fade Out (${fOut}s) cho ${count} phân đoạn!`);
        } else {
            alert('Chưa có phân đoạn nào trên timeline!');
        }
    });
}

// Live Canvas Motion Preview
let previewAnimFrame = null;
let previewCurrentIndex = -1;
const previewModal = document.getElementById('preview-modal');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const previewEffectName = document.getElementById('preview-effect-name');
const previewTimeDisplay = document.getElementById('preview-time-display');
const modalPreviewMotion = document.getElementById('modal-preview-motion');
const modalPreviewDuration = document.getElementById('modal-preview-duration');
const modalPreviewIntensity = document.getElementById('modal-preview-intensity');
const modalPreviewFadeIn = document.getElementById('modal-preview-fadein');
const modalPreviewFadeOut = document.getElementById('modal-preview-fadeout');
const modalPreviewText = document.getElementById('modal-preview-text');
const modalPreviewTextPos = document.getElementById('modal-preview-text-pos');
const modalPreviewTextStyle = document.getElementById('modal-preview-text-style');
const modalPreviewTextSize = document.getElementById('modal-preview-text-size');
const btnSavePreviewSettings = document.getElementById('btn-save-preview-settings');
let previewImg = new Image();
let previewItemData = null;

function previewItemMotion(index) {
    const item = mediaItems[index];
    if (!item || item.type !== 'image') return;

    previewCurrentIndex = index;
    previewItemData = JSON.parse(JSON.stringify(item)); // clone for modal preview

    // Sync modal input controls
    if (modalPreviewMotion) modalPreviewMotion.value = previewItemData.settings.motion || 'zoom_in';
    if (modalPreviewDuration) modalPreviewDuration.value = previewItemData.settings.duration || 5.0;
    if (modalPreviewIntensity) modalPreviewIntensity.value = previewItemData.settings.zoomIntensity || 1.25;
    if (modalPreviewFadeIn) modalPreviewFadeIn.value = previewItemData.settings.fadeIn ?? 0.8;
    if (modalPreviewFadeOut) modalPreviewFadeOut.value = previewItemData.settings.fadeOut ?? 0.8;
    if (modalPreviewText) modalPreviewText.value = previewItemData.settings.overlayText || '';
    if (modalPreviewTextPos) modalPreviewTextPos.value = previewItemData.settings.textPosition || 'bottom';
    if (modalPreviewTextStyle) modalPreviewTextStyle.value = previewItemData.settings.textStyle || 'banner';
    if (modalPreviewTextSize) modalPreviewTextSize.value = previewItemData.settings.fontSize || 48;

    previewEffectName.innerText = (previewItemData.settings.motion || 'zoom_in').replace('_', ' ').toUpperCase();
    previewModal.classList.remove('hidden');

    previewImg = new Image();
    previewImg.crossOrigin = 'anonymous';
    previewImg.src = item.url;
    previewImg.onload = () => {
        startPreviewAnimation();
    };
}

// Attach live changes inside Preview Modal
[modalPreviewMotion, modalPreviewDuration, modalPreviewIntensity, modalPreviewFadeIn, modalPreviewFadeOut, modalPreviewText, modalPreviewTextPos, modalPreviewTextStyle, modalPreviewTextSize].forEach(el => {
    if (el) {
        el.addEventListener('input', () => {
            if (!previewItemData) return;
            previewItemData.settings.motion = modalPreviewMotion.value;
            previewItemData.settings.duration = parseFloat(modalPreviewDuration.value) || 5.0;
            previewItemData.settings.zoomIntensity = parseFloat(modalPreviewIntensity.value) || 1.25;
            previewItemData.settings.fadeIn = parseFloat(modalPreviewFadeIn.value) || 0;
            previewItemData.settings.fadeOut = parseFloat(modalPreviewFadeOut.value) || 0;
            previewItemData.settings.overlayText = modalPreviewText ? modalPreviewText.value : '';
            previewItemData.settings.textPosition = modalPreviewTextPos ? modalPreviewTextPos.value : 'bottom';
            previewItemData.settings.textStyle = modalPreviewTextStyle ? modalPreviewTextStyle.value : 'banner';
            previewItemData.settings.fontSize = modalPreviewTextSize ? parseInt(modalPreviewTextSize.value) : 48;
            previewEffectName.innerText = previewItemData.settings.motion.replace('_', ' ').toUpperCase();
            startPreviewAnimation();
        });
    }
});

if (btnSavePreviewSettings) {
    btnSavePreviewSettings.addEventListener('click', () => {
        if (previewCurrentIndex >= 0 && mediaItems[previewCurrentIndex] && previewItemData) {
            mediaItems[previewCurrentIndex].settings = JSON.parse(JSON.stringify(previewItemData.settings));
            renderMediaList();
            alert('💾 Đã lưu cài đặt cho phân đoạn này!');
        }
    });
}

function startPreviewAnimation() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
    if (!previewItemData) return;

    const dur = previewItemData.settings.duration || 5.0;
    const fadeIn = previewItemData.settings.fadeIn || 0;
    const fadeOut = previewItemData.settings.fadeOut || 0;
    const motion = previewItemData.settings.motion || 'zoom_in';
    const zoomIntensity = previewItemData.settings.zoomIntensity || 1.25;
    const delta = zoomIntensity - 1.0;

    const startTime = performance.now();
    const totalMs = dur * 1000;

    function renderFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / totalMs);
        const currentSec = (progress * dur).toFixed(1);
        previewTimeDisplay.innerText = `${currentSec}s / ${dur}s`;

        // Clear canvas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Compute Ken Burns scale & offsets
        let zoom = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        const maxPanX = (1 - 1 / zoomIntensity) * (previewCanvas.width / 2);
        const maxPanY = (1 - 1 / zoomIntensity) * (previewCanvas.height / 2);

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
            offsetX = (1 - 1 / zoom) * (previewCanvas.width / 2);
            offsetY = (1 - 1 / zoom) * (previewCanvas.height / 2);
        } else if (motion === 'zoom_in_right') {
            zoom = 1.0 + (delta * progress);
            offsetX = -(1 - 1 / zoom) * (previewCanvas.width / 2);
            offsetY = (1 - 1 / zoom) * (previewCanvas.height / 2);
        } else if (motion === 'zoom_pan') {
            zoom = 1.0 + (delta * progress);
            offsetX = -(1 - 1 / zoom) * (previewCanvas.width / 2) * (1 - 2 * progress);
            offsetY = -(1 - 1 / zoom) * (previewCanvas.height / 2) * (1 - 2 * progress);
        } else {
            zoom = 1.0;
            offsetX = 0;
            offsetY = 0;
        }

        // Draw image scaled
        ctx.save();
        ctx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.drawImage(
            previewImg, 
            -previewCanvas.width / 2 + offsetX, 
            -previewCanvas.height / 2 + offsetY, 
            previewCanvas.width, 
            previewCanvas.height
        );
        ctx.restore();

        // Render Text Overlay if available
        const overlayText = previewItemData.settings.overlayText?.trim();
        if (overlayText) {
            const textPos = previewItemData.settings.textPosition || 'bottom';
            const textStyle = previewItemData.settings.textStyle || 'banner';
            const fontSize = Number(previewItemData.settings.fontSize) || 48;

            ctx.save();
            ctx.font = `bold ${fontSize}px Outfit, -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textX = previewCanvas.width / 2;
            let textY = previewCanvas.height - 120;
            if (textPos === 'top') textY = 120;
            else if (textPos === 'center') textY = previewCanvas.height / 2;

            const metrics = ctx.measureText(overlayText);
            const boxWidth = metrics.width + 48;
            const boxHeight = fontSize * 1.6;

            if (textStyle === 'banner') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                const rx = textX - boxWidth / 2;
                const ry = textY - boxHeight / 2;
                const r = 12;
                ctx.beginPath();
                ctx.moveTo(rx + r, ry);
                ctx.lineTo(rx + boxWidth - r, ry);
                ctx.quadraticCurveTo(rx + boxWidth, ry, rx + boxWidth, ry + r);
                ctx.lineTo(rx + boxWidth, ry + boxHeight - r);
                ctx.quadraticCurveTo(rx + boxWidth, ry + boxHeight, rx + boxWidth - r, ry + boxHeight);
                ctx.lineTo(rx + r, ry + boxHeight);
                ctx.quadraticCurveTo(rx, ry + boxHeight, rx, ry + boxHeight - r);
                ctx.lineTo(rx, ry + r);
                ctx.quadraticCurveTo(rx, ry, rx + r, ry);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(overlayText, textX, textY);
            } else if (textStyle === 'outline') {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = Math.max(6, fontSize * 0.15);
                ctx.lineJoin = 'round';
                ctx.strokeText(overlayText, textX, textY);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(overlayText, textX, textY);
            } else if (textStyle === 'glow') {
                ctx.shadowColor = '#6366F1';
                ctx.shadowBlur = 24;
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = 4;
                ctx.strokeText(overlayText, textX, textY);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(overlayText, textX, textY);
            } else {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(overlayText, textX, textY);
            }

            ctx.restore();
        }

        // Calculate Fade Alpha
        let alpha = 1.0;
        const timeSec = progress * dur;
        if (fadeIn > 0 && timeSec < fadeIn) {
            alpha = timeSec / fadeIn;
        } else if (fadeOut > 0 && timeSec > (dur - fadeOut)) {
            alpha = Math.max(0, (dur - timeSec) / fadeOut);
        }

        // Apply Fade Overlay if alpha < 1
        if (alpha < 1.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - alpha})`;
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        }

        if (progress < 1.0) {
            previewAnimFrame = requestAnimationFrame(renderFrame);
        } else {
            // Auto loop after pause
            setTimeout(() => {
                if (!previewModal.classList.contains('hidden')) {
                    startPreviewAnimation();
                }
            }, 600);
        }
    }

    previewAnimFrame = requestAnimationFrame(renderFrame);
}

document.getElementById('btn-play-preview').addEventListener('click', () => {
    startPreviewAnimation();
});

function closePreviewModal() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
    previewModal.classList.add('hidden');
}

// Render Video with FFmpeg
const renderModal = document.getElementById('render-modal');
const renderPercent = document.getElementById('render-percent');
const renderProgressBar = document.getElementById('render-progress-bar');
const renderStatusText = document.getElementById('render-status-text');
const renderStateProcessing = document.getElementById('render-state-processing');
const renderStateCompleted = document.getElementById('render-state-completed');
const renderStateError = document.getElementById('render-state-error');
const renderedVideoPlayer = document.getElementById('rendered-video-player');
const btnDownloadVideo = document.getElementById('btn-download-video');
const renderErrorMsg = document.getElementById('render-error-msg');

let currentEventSource = null;

btnRenderAll.addEventListener('click', async () => {
    if (mediaItems.length === 0) return;

    const placeholderCount = mediaItems.filter(i => i.isPlaceholder).length;
    if (placeholderCount > 0) {
        const confirmRender = confirm(`⚠️ Hiện còn ${placeholderCount} phân cảnh trên Timeline chưa được bù ảnh (đang là thẻ giữ chỗ viền vàng).\n\nNếu tiếp tục, những cảnh này sẽ hiển thị nền tối kèm chữ phụ đề kịch bản.\n\nBạn có muốn tiếp tục xuất video không?`);
        if (!confirmRender) return;
    }

    updateWorkflowStep(3);
    renderModal.classList.remove('hidden');
    renderStateProcessing.classList.remove('hidden');
    renderStateCompleted.classList.add('hidden');
    renderStateError.classList.add('hidden');
    renderPercent.innerText = '0%';
    renderProgressBar.style.width = '0%';
    renderStatusText.innerText = 'Đang khởi chạy FFmpeg filter graph (zoompan + fade + concat)...';

    try {
        const res = await fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: mediaItems,
                bgm: bgmTrack,
                settings: currentSettings
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Listen for real-time SSE progress
        if (currentEventSource) currentEventSource.close();
        currentEventSource = new EventSource(`/api/progress/${data.jobId}`);

        currentEventSource.onmessage = (event) => {
            const update = JSON.parse(event.data);
            if (update.progress !== undefined) {
                renderPercent.innerText = `${update.progress}%`;
                renderProgressBar.style.width = `${update.progress}%`;
                renderStatusText.innerText = `Đang xử lý xuất video... (${update.progress}%)`;
            }

            if (update.status === 'completed') {
                currentEventSource.close();
                renderStateProcessing.classList.add('hidden');
                renderStateCompleted.classList.remove('hidden');
                renderedVideoPlayer.src = update.outputUrl;
                btnDownloadVideo.href = update.outputUrl;
            } else if (update.status === 'failed') {
                currentEventSource.close();
                renderStateProcessing.classList.add('hidden');
                renderStateError.classList.remove('hidden');
                renderErrorMsg.innerText = update.error || 'FFmpeg render thất bại';
            }
        };

        currentEventSource.onerror = () => {
            currentEventSource.close();
        };

    } catch (err) {
        renderStateProcessing.classList.add('hidden');
        renderStateError.classList.remove('hidden');
        renderErrorMsg.innerText = err.message;
    }
});

function closeRenderModal() {
    renderModal.classList.add('hidden');
    renderedVideoPlayer.pause();
    if (currentEventSource) currentEventSource.close();
}

// Generate Demo Sample Images & Test Flow
btnSampleDemo.addEventListener('click', async () => {
    btnSampleDemo.disabled = true;
    btnSampleDemo.innerHTML = '<span class="icon">⏳</span> Đang tạo mẫu demo...';

    try {
        // Create 3 sample SVG/Canvas images and upload them
        const samples = [
            { title: 'Scene 1: Bình Minh', textOverlay: 'Bình Minh Rực Rỡ', gradient: ['#FF512F', '#DD2476'], motion: 'zoom_in', fadeIn: 1.0, fadeOut: 0.5 },
            { title: 'Scene 2: Đại Dương Xanh', textOverlay: 'Đại Dương Vô Tận', gradient: ['#1A2980', '#26D0CE'], motion: 'zoom_out', fadeIn: 0.5, fadeOut: 0.5 },
            { title: 'Scene 3: Hoàng Hôn Neon', textOverlay: 'Thành Phố Về Đêm', gradient: ['#8E2DE2', '#4A00E0'], motion: 'pan_right', fadeIn: 0.5, fadeOut: 1.0 }
        ];

        const uploadedSamples = [];
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const c = canvas.getContext('2d');

            // Draw beautiful gradient
            const grad = c.createLinearGradient(0, 0, 1920, 1080);
            grad.addColorStop(0, s.gradient[0]);
            grad.addColorStop(1, s.gradient[1]);
            c.fillStyle = grad;
            c.fillRect(0, 0, 1920, 1080);

            // Add text
            c.fillStyle = '#FFFFFF';
            c.font = 'bold 72px Outfit, sans-serif';
            c.textAlign = 'center';
            c.fillText(s.title, 960, 500);

            c.fillStyle = 'rgba(255, 255, 255, 0.7)';
            c.font = '36px Outfit, sans-serif';
            c.fillText(`Hiệu ứng: ${s.motion.toUpperCase()} | Fade In: ${s.fadeIn}s | Fade Out: ${s.fadeOut}s`, 960, 580);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            const file = new File([blob], `demo_scene_${i + 1}.jpg`, { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('files', file);

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.files[0]) {
                const item = data.files[0];
                item.settings.motion = s.motion;
                item.settings.duration = 5.0;
                item.settings.zoomIntensity = 1.25;
                item.settings.fadeIn = s.fadeIn;
                item.settings.fadeOut = s.fadeOut;
                item.settings.overlayText = s.textOverlay;
                item.settings.textPosition = 'bottom';
                item.settings.textStyle = 'banner';
                item.settings.fontSize = 48;
                uploadedSamples.push(item);
            }
        }

        mediaItems = [...mediaItems, ...uploadedSamples];
        renderMediaList();

    } catch (err) {
        alert('Lỗi tạo demo: ' + err.message);
    } finally {
        btnSampleDemo.disabled = false;
        btnSampleDemo.innerHTML = '<span class="icon">✨</span> Nạp Mẫu Thử Nghiệm';
    }
});

// ==========================================
// GEMINI AI SCRIPT MATCHING LOGIC
// ==========================================
const btnOpenAiModal = document.getElementById('btn-open-ai-modal');
const aiModal = document.getElementById('ai-modal');
const inputGeminiKey = document.getElementById('input-gemini-key');
const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
const scriptFileInput = document.getElementById('script-file-input');
const scriptTextarea = document.getElementById('script-textarea');
const btnLoadSampleScript = document.getElementById('btn-load-sample-script');
const aiImageCount = document.getElementById('ai-image-count');
const btnRunAiMatch = document.getElementById('btn-run-ai-match');
const aiResultsContainer = document.getElementById('ai-results-container');
const aiScenesList = document.getElementById('ai-scenes-list');
const aiScenesCountBadge = document.getElementById('ai-scenes-count-badge');
const btnApplyAiTimeline = document.getElementById('btn-apply-ai-timeline');

let currentAiMatchedScenes = [];

btnOpenAiModal.addEventListener('click', () => {
    const imgCount = mediaItems.filter(i => i.type === 'image').length;
    aiImageCount.innerText = `${imgCount} ảnh`;
    aiModal.classList.remove('hidden');
});

function closeAiModal() {
    aiModal.classList.add('hidden');
}

// Toggle key visibility
btnToggleKeyVisibility.addEventListener('click', () => {
    if (inputGeminiKey.type === 'password') {
        inputGeminiKey.type = 'text';
        btnToggleKeyVisibility.innerText = '🙈';
    } else {
        inputGeminiKey.type = 'password';
        btnToggleKeyVisibility.innerText = '👁️';
    }
});

const scriptStatsText = document.getElementById('script-stats-text');
const btnCleanScript = document.getElementById('btn-clean-script');

// Function to clean blank lines and group short sentences into complete scenes
function cleanAndGroupScript(raw) {
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && l !== '---');
    const paragraphs = [];
    let current = '';

    for (const line of lines) {
        if (line.startsWith('#')) {
            if (current) { paragraphs.push(current); current = ''; }
            paragraphs.push(line);
        } else {
            if (!current) {
                current = line;
            } else if (current.length + line.length < 240) {
                current += ' ' + line;
            } else {
                paragraphs.push(current);
                current = line;
            }
        }
    }
    if (current) paragraphs.push(current);
    return paragraphs.join('\n\n');
}

function updateScriptStats() {
    const raw = scriptTextarea.value.trim();
    if (!raw) {
        scriptStatsText.innerText = 'Chưa có kịch bản';
        return;
    }
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    const paragraphs = raw.split(/\n\n+/).filter(p => p.trim().length > 0).length;
    scriptStatsText.innerHTML = `📊 Trạng thái: <strong>${lines} dòng</strong> | <strong>${paragraphs} phân đoạn</strong> (${raw.length} ký tự)`;
}

scriptTextarea.addEventListener('input', updateScriptStats);

// Manual clean script button
btnCleanScript.addEventListener('click', () => {
    const raw = scriptTextarea.value;
    if (!raw.trim()) return;
    scriptTextarea.value = cleanAndGroupScript(raw);
    updateScriptStats();
});

// Upload script file (with auto-clean)
scriptFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            scriptTextarea.value = cleanAndGroupScript(event.target.result);
            updateScriptStats();
        };
        reader.readAsText(file);
    }
});

// Load sample script (Seoul Winter)
btnLoadSampleScript.addEventListener('click', () => {
    const sample = `Hãy tưởng tượng... Một buổi sáng, bạn thức dậy tại Seoul. Nhưng hôm nay có điều gì đó không đúng. Không còn tiếng xe cộ chen chúc trên những con đường đông đúc. Không còn ánh sáng từ những màn hình LED khổng lồ ở Myeongdong.

Không còn tiếng người gọi nhau trong những con phố vốn chưa bao giờ thực sự ngủ. Chỉ có tuyết. Tuyết phủ kín đường phố, phủ lên những chiếc xe đang nằm bất động, phủ lên những biển hiệu rực rỡ của Seoul.

Và bên ngoài cửa sổ... không có một bóng người. Nhiệt độ đã giảm xuống âm 40 độ C. Nhưng điều đáng sợ nhất không phải là cái lạnh, mà là việc nó không hề có dấu hiệu kết thúc. Ngày mai vẫn lạnh như hôm nay. Năm sau vẫn lạnh như năm nay. Và 100 năm sau... mùa đông vẫn chưa kết thúc.`;
    scriptTextarea.value = sample;
    updateScriptStats();
});

// Run AI Match
btnRunAiMatch.addEventListener('click', async () => {
    const script = scriptTextarea.value.trim();
    if (!script) {
        alert('Vui lòng nhập hoặc tải lên nội dung kịch bản!');
        return;
    }

    const images = mediaItems.filter(i => i.type === 'image');
    if (images.length === 0) {
        alert('Bạn chưa có ảnh nào trên timeline! Vui lòng tải ảnh lên trước hoặc nhấn "Nạp Mẫu Thử Nghiệm".');
        return;
    }

    const scriptLines = script
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('---') && !line.startsWith('==='));

    if (images.length < scriptLines.length) {
        const missingCount = scriptLines.length - images.length;
        const confirmMsg = `⚠️ Phát hiện kịch bản có ${scriptLines.length} phân cảnh, nhưng kho hiện chỉ có ${images.length} ảnh (đang thiếu ${missingCount} ảnh).\n\nBởi vì thiếu một lượng lớn ảnh so với kịch bản, các phân cảnh chưa có ảnh sẽ được đặt thành thẻ giữ chỗ (chờ bù ảnh) để bạn tự chọn/tải ảnh bù vào sau.\n\nBạn có muốn tiếp tục không?`;
        if (!confirm(confirmMsg)) {
            return;
        }
    }

    const key = inputGeminiKey.value.trim();

    btnRunAiMatch.disabled = true;
    btnRunAiMatch.innerHTML = '<span class="icon">⏳</span> Gemini AI Đang Phân Tích...';

    try {
        const res = await fetch('/api/ai/match-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scriptText: script,
                items: mediaItems,
                customApiKey: key
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.result && data.result.scenes) {
            currentAiMatchedScenes = data.result.scenes;
            renderAiScenesResult(currentAiMatchedScenes);
        } else {
            throw new Error('Dữ liệu trả về không đúng cấu trúc');
        }

    } catch (err) {
        alert('Lỗi phân tích AI: ' + err.message);
    } finally {
        btnRunAiMatch.disabled = false;
        btnRunAiMatch.innerHTML = '✨ Phân Tích & Khớp Ảnh Tự Động';
    }
});

// Upload and assign new image to a specific segment on Timeline
function uploadImageForSegment(itemIndex) {
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.style.display = 'none';
    document.body.appendChild(tempInput);

    tempInput.onchange = async (e) => {
        if (!e.target.files || !e.target.files[0]) {
            document.body.removeChild(tempInput);
            return;
        }
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('files', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.files && data.files[0]) {
                const newUploaded = data.files[0];
                const targetItem = mediaItems[itemIndex];
                if (targetItem) {
                    targetItem.filename = newUploaded.filename;
                    targetItem.originalName = newUploaded.originalName;
                    targetItem.url = newUploaded.url;
                    targetItem.type = 'image';
                    targetItem.isPlaceholder = false;
                    targetItem.width = newUploaded.width;
                    targetItem.height = newUploaded.height;
                    
                    renderMediaList();
                    selectSegment(itemIndex);
                }
            } else {
                alert('Tải ảnh thất bại: ' + (data.error || 'Lỗi không xác định'));
            }
        } catch (err) {
            alert('Lỗi tải ảnh: ' + err.message);
        } finally {
            document.body.removeChild(tempInput);
        }
    };

    tempInput.click();
}

// Upload and assign new image to a specific scene in AI Match Modal
function uploadImageForAiScene(sceneIndex) {
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.style.display = 'none';
    document.body.appendChild(tempInput);

    tempInput.onchange = async (e) => {
        if (!e.target.files || !e.target.files[0]) {
            document.body.removeChild(tempInput);
            return;
        }
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('files', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.files && data.files[0]) {
                const newUploaded = data.files[0];
                mediaItems.push(newUploaded);
                if (window.mediaItems) window.mediaItems.push(newUploaded);

                if (currentAiMatchedScenes && currentAiMatchedScenes[sceneIndex]) {
                    currentAiMatchedScenes[sceneIndex].imageIndex = mediaItems.length - 1;
                    currentAiMatchedScenes[sceneIndex].reason = 'Đã tự chọn ảnh mới tải lên';
                }
                renderAiScenesResult(currentAiMatchedScenes);
            } else {
                alert('Tải ảnh thất bại: ' + (data.error || 'Lỗi không xác định'));
            }
        } catch (err) {
            alert('Lỗi tải ảnh: ' + err.message);
        } finally {
            document.body.removeChild(tempInput);
        }
    };

    tempInput.click();
}

function renderAiScenesResult(scenes, meta = {}) {
    aiResultsContainer.classList.remove('hidden');
    
    const matchedCount = scenes.filter(s => typeof s.imageIndex === 'number' && s.imageIndex >= 0).length;
    const emptyCount = scenes.length - matchedCount;

    aiScenesCountBadge.innerHTML = `<span style="color:#38BDF8">✨ ${matchedCount} ảnh độc nhất</span>${emptyCount > 0 ? ` &bull; <span style="color:#F59E0B">⚠️ ${emptyCount} cảnh để trống</span>` : ''}`;
    aiScenesList.innerHTML = '';

    scenes.forEach((scene, index) => {
        const hasImage = typeof scene.imageIndex === 'number' && scene.imageIndex >= 0 && mediaItems[scene.imageIndex];
        const imgItem = hasImage ? mediaItems[scene.imageIndex] : null;
        
        const card = document.createElement('div');
        card.className = `ai-scene-card ${hasImage ? '' : 'is-empty'}`;
        
        const thumbHtml = hasImage 
            ? `<div class="ai-scene-thumb-wrapper">
                 <img src="${imgItem.url}" class="ai-scene-thumb" alt="Scene ${index + 1}">
                 <span class="ai-scene-img-idx">#${scene.imageIndex + 1}</span>
               </div>`
            : `<div class="ai-scene-thumb is-empty">
                 <span class="empty-icon">📷</span>
                 <span class="empty-label">Để trống</span>
               </div>`;

        const titleHtml = hasImage
            ? `<h5>Cảnh ${index + 1}: ${imgItem.originalName}</h5>`
            : `<h5 class="empty-title">Cảnh ${index + 1} <span class="badge-empty-scene">⚠️ Để trống (Chờ bù ảnh)</span></h5>`;

        const reasonHtml = scene.reason 
            ? `<div class="ai-scene-reason text-xs text-dim mt-1">💡 <em>${scene.reason}</em></div>`
            : '';

        card.innerHTML = `
            ${thumbHtml}
            <div class="ai-scene-info">
                ${titleHtml}
                <p class="ai-scene-text">${scene.sceneText || ''}</p>
                ${reasonHtml}
            </div>
            <div class="ai-scene-meta">
                <button type="button" class="btn-scene-upload" data-scene-idx="${index}">📤 ${hasImage ? 'Đổi ảnh' : 'Tải ảnh bù'}</button>
                <span class="badge-motion">${(scene.suggestedMotion || 'zoom_in').replace(/_/g, ' ')}</span>
                <span class="ai-scene-dur">⏱️ ${scene.suggestedDuration || 4.0}s | Fade ${scene.fadeIn || 0.8}s</span>
            </div>
        `;
        aiScenesList.appendChild(card);
    });

    // Attach click event to upload buttons in modal
    aiScenesList.querySelectorAll('.btn-scene-upload').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sIdx = parseInt(btn.dataset.sceneIdx);
            uploadImageForAiScene(sIdx);
        });
    });
}

// Apply AI Match to Timeline (Preserves 100% of scenes with placeholders for empty slots)
btnApplyAiTimeline.addEventListener('click', () => {
    if (!currentAiMatchedScenes || currentAiMatchedScenes.length === 0) return;

    const emptyCount = currentAiMatchedScenes.filter(s => typeof s.imageIndex !== 'number' || s.imageIndex < 0).length;
    if (emptyCount > 0) {
        const confirmApply = confirm(`ℹ️ Kịch bản gồm ${currentAiMatchedScenes.length} phân cảnh, trong đó có ${emptyCount} phân cảnh chưa có ảnh (sẽ là thẻ chờ bù ảnh viền vàng).\n\nKhi đưa vào Timeline, bạn có thể tự chọn/bấm "➕ Bù ảnh" vào những cảnh còn thiếu này.\n\nBạn có muốn tiếp tục áp dụng vào Timeline không?`);
        if (!confirmApply) return;
    }

    const sourceItems = (window.mediaItems && window.mediaItems.length > 0) ? window.mediaItems : mediaItems;
    const newTimeline = [];
    let placeholderCount = 0;

    currentAiMatchedScenes.forEach((scene, sIdx) => {
        if (typeof scene.imageIndex === 'number' && scene.imageIndex >= 0 && sourceItems[scene.imageIndex]) {
            const originalItem = sourceItems[scene.imageIndex];
            const cloned = JSON.parse(JSON.stringify(originalItem));
            if (!cloned.settings) cloned.settings = {};
            cloned.settings.motion = scene.suggestedMotion || 'zoom_in';
            cloned.settings.duration = parseFloat(scene.suggestedDuration || 5.0);
            cloned.settings.fadeIn = parseFloat(scene.fadeIn || 0.8);
            cloned.settings.fadeOut = parseFloat(scene.fadeOut || 0.8);
            if (scene.sceneText) {
                cloned.settings.overlayText = scene.sceneText;
            }
            cloned.isPlaceholder = false;
            newTimeline.push(cloned);
        } else {
            // Create placeholder item to preserve timeline sequence and script text
            placeholderCount++;
            newTimeline.push({
                id: 'ph_' + Date.now() + '_' + sIdx,
                filename: '',
                originalName: `[Cần thêm ảnh] Cảnh ${sIdx + 1}`,
                type: 'image',
                isPlaceholder: true,
                url: '',
                settings: {
                    motion: scene.suggestedMotion || 'zoom_in',
                    duration: parseFloat(scene.suggestedDuration || 5.0),
                    fadeIn: parseFloat(scene.fadeIn || 0.8),
                    fadeOut: parseFloat(scene.fadeOut || 0.8),
                    overlayText: scene.sceneText || '',
                    textPosition: 'bottom',
                    textStyle: 'banner',
                    fontSize: 48
                }
            });
        }
    });

    if (newTimeline.length > 0) {
        mediaItems = newTimeline;
        window.mediaItems = newTimeline;
        renderMediaList();
        closeAiModal();
        
        let msg = `🎉 Đã áp dụng toàn bộ ${newTimeline.length} phân cảnh theo kịch bản vào Timeline!`;
        if (placeholderCount > 0) {
            msg += `\n\nℹ️ Có ${placeholderCount} phân cảnh chưa có ảnh (thẻ viền vàng trên Timeline). Bạn có thể bấm trực tiếp vào nút "➕ Bù ảnh" trên từng thẻ để tải ảnh khớp vào đúng vị trí nhé!`;
        }
        alert(msg);
    } else {
        alert('Không có phân cảnh nào để đưa vào Timeline!');
    }
});


// =========================================================================
// PROJECT AUTO-SAVE, EXPORT & IMPORT SYSTEM
// =========================================================================
let autoSaveTimer = null;

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (mediaItems.length === 0 && !bgmTrack) return;
        try {
            const projectData = {
                version: '1.0',
                timestamp: Date.now(),
                mediaItems,
                bgmTrack,
                currentSettings
            };
            localStorage.setItem('edt_project_autosave', JSON.stringify(projectData));
        } catch (e) {
            console.warn('Auto-save error:', e);
        }
    }, 800);
}

function checkAutoSaveOnLoad() {
    try {
        const saved = localStorage.getItem('edt_project_autosave');
        if (!saved) return;
        const project = JSON.parse(saved);
        if (project && project.mediaItems && project.mediaItems.length > 0 && mediaItems.length === 0) {
            const banner = document.getElementById('autosave-banner');
            const timeLabel = document.getElementById('autosave-time-label');
            if (banner && timeLabel) {
                const date = new Date(project.timestamp || Date.now());
                timeLabel.textContent = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} (${project.mediaItems.length} ảnh/clip)`;
                banner.classList.remove('hidden');
            }
        }
    } catch (e) {}
}

function restoreAutoSave() {
    try {
        const saved = localStorage.getItem('edt_project_autosave');
        if (!saved) return;
        const project = JSON.parse(saved);
        applyLoadedProject(project);
        const banner = document.getElementById('autosave-banner');
        if (banner) banner.classList.add('hidden');
        alert(`🎉 Đã khôi phục thành công dự án với ${project.mediaItems.length} phân đoạn!`);
    } catch (e) {
        alert('Lỗi khôi phục: ' + e.message);
    }
}

function dismissAutoSave() {
    const banner = document.getElementById('autosave-banner');
    if (banner) banner.classList.add('hidden');
}

// Export Project File (.json / .edtproject)
function exportProjectToFile() {
    if (mediaItems.length === 0 && !bgmTrack) {
        alert('Dự án hiện đang trống! Hãy thêm ít nhất 1 ảnh hoặc video để lưu dự án.');
        return;
    }

    const projectData = {
        appName: 'Antigravity Video Editor',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        currentSettings,
        mediaItems,
        bgmTrack
    };

    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `DuAn_Video_${dateStr}_${Date.now().toString().slice(-4)}.edtproject`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import Project File
function importProjectFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const project = JSON.parse(e.target.result);
            if (!project || (!project.mediaItems && !Array.isArray(project))) {
                alert('Tệp dự án không đúng định dạng!');
                return;
            }
            applyLoadedProject(project);
            alert(`🎉 Đã nạp thành công dự án với ${mediaItems.length} phân đoạn!`);
        } catch (err) {
            alert('Lỗi đọc tệp dự án: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function applyLoadedProject(project) {
    const items = project.mediaItems || (Array.isArray(project) ? project : []);
    mediaItems = items;
    window.mediaItems = items;
    if (project.bgmTrack) {
        bgmTrack = project.bgmTrack;
        updateBgmUI();
    }
    if (project.currentSettings) {
        currentSettings = { ...currentSettings, ...project.currentSettings };
        // Update ratio UI
        document.querySelectorAll('.ratio-option').forEach(o => {
            o.classList.toggle('active', o.dataset.ratio === currentSettings.ratio);
        });
        if (selectExportQuality && currentSettings.qualityPreset) {
            selectExportQuality.value = currentSettings.qualityPreset;
        }
        if (selectReframeMode && currentSettings.reframeMode) {
            selectReframeMode.value = currentSettings.reframeMode;
        }
        const selectFpsEl = document.getElementById('select-fps');
        if (selectFpsEl && currentSettings.fps) {
            selectFpsEl.value = currentSettings.fps;
        }
        updateReframeVisibility(currentSettings.ratio);
    }
    renderMediaList();
}

// =========================================================================
// AI TIMELINE & SCRIPT AUDIT SYSTEM (TAB 1)
// =========================================================================
const btnAuditTimeline = document.getElementById('btn-audit-timeline');
const timelineAuditModal = document.getElementById('timeline-audit-modal');
const timelineAuditLoading = document.getElementById('timeline-audit-loading');
const timelineAuditResult = document.getElementById('timeline-audit-result');
const btnAuditAutofixMotion = document.getElementById('btn-audit-autofix-motion');

if (btnAuditTimeline) {
    btnAuditTimeline.addEventListener('click', openTimelineAuditModal);
}

if (btnAuditAutofixMotion) {
    btnAuditAutofixMotion.addEventListener('click', () => {
        if (typeof randomizeMotions === 'function') {
            randomizeMotions();
        } else {
            const btnRand = document.getElementById('btn-randomize-motions');
            if (btnRand) btnRand.click();
        }
        alert('✨ Đã phân bổ ngẫu nhiên lại hiệu ứng cho các cảnh!');
        closeTimelineAuditModal();
    });
}

async function openTimelineAuditModal() {
    if (mediaItems.length === 0) {
        alert('Chưa có phân đoạn nào trên timeline để đánh giá! Hãy thêm ảnh/video trước.');
        return;
    }

    timelineAuditModal.classList.remove('hidden');
    timelineAuditLoading.classList.remove('hidden');
    timelineAuditResult.classList.add('hidden');

    const scriptText = document.getElementById('script-textarea') ? document.getElementById('script-textarea').value : '';
    const key = document.getElementById('input-gemini-key') ? document.getElementById('input-gemini-key').value.trim() : '';

    try {
        const res = await fetch('/api/ai/audit-timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: mediaItems,
                bgm: bgmTrack,
                scriptText: scriptText,
                settings: currentSettings,
                customApiKey: key
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        renderTimelineAuditResult(data);
    } catch (err) {
        alert('Lỗi đánh giá AI: ' + err.message);
        closeTimelineAuditModal();
    }
}

function renderTimelineAuditResult(data) {
    timelineAuditLoading.classList.add('hidden');
    timelineAuditResult.classList.remove('hidden');

    const audit = data.audit || {};
    const stats = data.stats || {};

    // Overall Score & Verdict
    const scoreVal = document.getElementById('audit-timeline-score-val');
    const verdictEl = document.getElementById('audit-timeline-verdict');
    const submetaEl = document.getElementById('audit-timeline-submeta');

    if (scoreVal) scoreVal.textContent = audit.overallScore || 85;
    if (verdictEl) verdictEl.textContent = audit.verdict || 'Video có cấu trúc hoàn chỉnh.';
    if (submetaEl) submetaEl.textContent = `Đã phân tích ${stats.itemCount || mediaItems.length} phân cảnh • Tổng thời lượng ${(stats.totalDuration || 0).toFixed(1)}s • ${stats.hasBgm ? 'Có nhạc nền' : 'Chưa có nhạc nền'}`;

    // Category scores
    const cats = audit.categoryScores || {};
    setCategoryScore('script-alignment', cats.scriptAlignment || 85);
    setCategoryScore('pacing', cats.pacing || 80);
    setCategoryScore('visual-variety', cats.visualVariety || 75);
    setCategoryScore('audio-balance', cats.audioBalance || (stats.hasBgm ? 90 : 50));

    // Strengths
    const strengthsUl = document.getElementById('audit-timeline-strengths');
    if (strengthsUl) {
        strengthsUl.innerHTML = (audit.strengths || ['Phân cảnh có bố cục rõ ràng.']).map(s => `<li>${escapeHtml(s)}</li>`).join('');
    }

    // Warnings
    const warningsUl = document.getElementById('audit-timeline-warnings');
    if (warningsUl) {
        const list = (audit.warnings && audit.warnings.length > 0) ? audit.warnings : ['Không phát hiện lỗi nghiêm trọng nào.'];
        warningsUl.innerHTML = list.map(w => `<li>${escapeHtml(w)}</li>`).join('');
    }

    // Recommendations
    const recsUl = document.getElementById('audit-timeline-recs');
    if (recsUl) {
        const list = (audit.recommendations && audit.recommendations.length > 0) ? audit.recommendations : ['Có thể chuyển sang Tab 2 để tạo phụ đề tự động bằng AI.'];
        recsUl.innerHTML = list.map(r => `<li>${escapeHtml(r)}</li>`).join('');
    }
}

function setCategoryScore(id, score) {
    const bar = document.getElementById(`bar-${id}`);
    const num = document.getElementById(`score-${id}`);
    if (bar) bar.style.width = `${Math.min(100, Math.max(10, score))}%`;
    if (num) num.textContent = `${score}%`;
}

function closeTimelineAuditModal() {
    if (timelineAuditModal) timelineAuditModal.classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Expose modal close to window
window.closeTimelineAuditModal = closeTimelineAuditModal;

// Initialize Auto-Save check on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAutoSaveOnLoad();
});
setTimeout(checkAutoSaveOnLoad, 300);





// ==========================================
// Video Trimmer & Splitter Modal Logic
// ==========================================

let currentTrimItemIndex = -1;
let trimVideoDuration = 10;
let trimStartSec = 0;
let trimEndSec = 5;
let isPreviewLoopActive = false;
let isDraggingTrimHandle = null; // 'start' | 'end' | null

const videoTrimmerModal = document.getElementById('video-trimmer-modal');
const trimmerVideoPlayer = document.getElementById('trimmer-video-player');
const trimmerVideoFilename = document.getElementById('trimmer-video-filename');
const trimmerPlaybackTime = document.getElementById('trimmer-playback-time');
const trimmerDurLabel = document.getElementById('trimmer-dur-label');
const trimmerTotalDurLabel = document.getElementById('trimmer-total-dur-label');
const trimmerRangePercentLabel = document.getElementById('trimmer-range-percent-label');
const trimmerTimelineTrack = document.getElementById('trimmer-timeline-track');
const trimmerActiveRange = document.getElementById('trimmer-active-range');
const trimmerDimLeft = document.getElementById('trimmer-dim-left');
const trimmerDimRight = document.getElementById('trimmer-dim-right');
const trimmerPlayhead = document.getElementById('trimmer-playhead');
const trimmerHandleStart = document.getElementById('trimmer-handle-start');
const trimmerHandleEnd = document.getElementById('trimmer-handle-end');
const trimmerHandleStartTag = document.getElementById('trimmer-handle-start-tag');
const trimmerHandleEndTag = document.getElementById('trimmer-handle-end-tag');
const trimmerInputStart = document.getElementById('trimmer-input-start');
const trimmerInputEnd = document.getElementById('trimmer-input-end');
const trimmerRulers = document.getElementById('trimmer-timeline-rulers');

const btnTrimmerPlayPause = document.getElementById('btn-trimmer-play-pause');
const btnTrimmerStepBack = document.getElementById('btn-trimmer-step-back');
const btnTrimmerStepFwd = document.getElementById('btn-trimmer-step-fwd');
const btnTrimmerPreviewLoop = document.getElementById('btn-trimmer-preview-loop');
const btnTrimmerSetStartNow = document.getElementById('btn-trimmer-set-start-now');
const btnTrimmerSetEndNow = document.getElementById('btn-trimmer-set-end-now');
const btnTrimmerReset = document.getElementById('btn-trimmer-reset');
const btnTrimmerSplit = document.getElementById('btn-trimmer-split');
const btnTrimmerApply = document.getElementById('btn-trimmer-apply');
const btnOpenTrimmerModal = document.getElementById('btn-open-trimmer-modal');

function openTrimmerModal(itemIndex) {
    if (itemIndex < 0 || itemIndex >= mediaItems.length) return;
    const item = mediaItems[itemIndex];
    if (item.type !== 'video') return;

    currentTrimItemIndex = itemIndex;
    if (trimmerVideoFilename) trimmerVideoFilename.innerText = item.originalName || item.filename;

    if (trimmerVideoPlayer) {
        trimmerVideoPlayer.src = item.url;
        trimmerVideoPlayer.load();
    }

    if (videoTrimmerModal) videoTrimmerModal.classList.remove('hidden');
}

function closeTrimmerModal() {
    if (videoTrimmerModal) videoTrimmerModal.classList.add('hidden');
    if (trimmerVideoPlayer) trimmerVideoPlayer.pause();
    isPreviewLoopActive = false;
}

if (trimmerVideoPlayer) {
    trimmerVideoPlayer.addEventListener('loadedmetadata', () => {
        const item = mediaItems[currentTrimItemIndex];
        trimVideoDuration = trimmerVideoPlayer.duration || 10;
        
        trimStartSec = Number(item.settings?.trimStart || 0);
        trimEndSec = Number(item.settings?.trimEnd || trimVideoDuration);
        if (trimEndSec <= trimStartSec || trimEndSec > trimVideoDuration) {
            trimEndSec = trimVideoDuration;
        }

        if (trimmerInputStart) {
            trimmerInputStart.max = trimVideoDuration;
            trimmerInputStart.value = trimStartSec.toFixed(1);
        }
        if (trimmerInputEnd) {
            trimmerInputEnd.max = trimVideoDuration;
            trimmerInputEnd.value = trimEndSec.toFixed(1);
        }

        trimmerVideoPlayer.currentTime = trimStartSec;
        updateTrimmerTrackUI();
        renderTrimmerRulers();
    });

    trimmerVideoPlayer.addEventListener('timeupdate', () => {
        const cur = trimmerVideoPlayer.currentTime;
        if (trimmerPlaybackTime) {
            trimmerPlaybackTime.innerText = `${formatTrimmerTime(cur)} / ${formatTrimmerTime(trimVideoDuration)}`;
        }

        // Update playhead cursor position
        if (trimmerPlayhead && trimVideoDuration > 0) {
            const pct = Math.max(0, Math.min(100, (cur / trimVideoDuration) * 100));
            trimmerPlayhead.style.left = `${pct}%`;
        }

        // Preview loop constraint
        if (isPreviewLoopActive && (cur >= trimEndSec || cur < trimStartSec)) {
            trimmerVideoPlayer.currentTime = trimStartSec;
        }
    });

    trimmerVideoPlayer.addEventListener('play', () => {
        if (btnTrimmerPlayPause) btnTrimmerPlayPause.innerHTML = '⏸ Tạm dừng';
    });

    trimmerVideoPlayer.addEventListener('pause', () => {
        if (btnTrimmerPlayPause) btnTrimmerPlayPause.innerHTML = '▶ Phát';
    });
}

function formatTrimmerTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

function updateTrimmerTrackUI() {
    if (trimVideoDuration <= 0) return;

    const startPct = Math.max(0, Math.min(100, (trimStartSec / trimVideoDuration) * 100));
    const endPct = Math.max(0, Math.min(100, (trimEndSec / trimVideoDuration) * 100));
    const dur = Math.max(0.1, trimEndSec - trimStartSec);

    if (trimmerHandleStart) trimmerHandleStart.style.left = `${startPct}%`;
    if (trimmerHandleEnd) trimmerHandleEnd.style.left = `${endPct}%`;

    if (trimmerHandleStartTag) trimmerHandleStartTag.innerText = `${trimStartSec.toFixed(1)}s`;
    if (trimmerHandleEndTag) trimmerHandleEndTag.innerText = `${trimEndSec.toFixed(1)}s`;

    if (trimmerActiveRange) {
        trimmerActiveRange.style.left = `${startPct}%`;
        trimmerActiveRange.style.width = `${endPct - startPct}%`;
    }

    if (trimmerDimLeft) trimmerDimLeft.style.width = `${startPct}%`;
    if (trimmerDimRight) trimmerDimRight.style.width = `${100 - endPct}%`;

    if (trimmerDurLabel) trimmerDurLabel.innerText = `${dur.toFixed(1)}s`;
    if (trimmerTotalDurLabel) trimmerTotalDurLabel.innerText = `${trimVideoDuration.toFixed(1)}s`;
    if (trimmerRangePercentLabel) trimmerRangePercentLabel.innerText = `${Math.round((dur / trimVideoDuration) * 100)}% video`;

    if (trimmerInputStart) trimmerInputStart.value = trimStartSec.toFixed(1);
    if (trimmerInputEnd) trimmerInputEnd.value = trimEndSec.toFixed(1);
}

function renderTrimmerRulers() {
    if (!trimmerRulers || trimVideoDuration <= 0) return;
    trimmerRulers.innerHTML = '';
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
        const span = document.createElement('span');
        const t = (trimVideoDuration * i) / steps;
        span.innerText = `${t.toFixed(1)}s`;
        trimmerRulers.appendChild(span);
    }
}

function adjustTrimTime(type, delta) {
    if (type === 'start') {
        trimStartSec = Math.max(0, Math.min(trimEndSec - 0.2, trimStartSec + delta));
        trimStartSec = parseFloat(trimStartSec.toFixed(2));
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimStartSec;
    } else if (type === 'end') {
        trimEndSec = Math.min(trimVideoDuration, Math.max(trimStartSec + 0.2, trimEndSec + delta));
        trimEndSec = parseFloat(trimEndSec.toFixed(2));
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimEndSec;
    }
    updateTrimmerTrackUI();
}

// Global expose for inline buttons
window.adjustTrimTime = adjustTrimTime;
window.openTrimmerModal = openTrimmerModal;
window.closeTrimmerModal = closeTrimmerModal;

// Inputs change handlers
if (trimmerInputStart) {
    trimmerInputStart.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 0;
        trimStartSec = Math.max(0, Math.min(trimEndSec - 0.2, val));
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimStartSec;
        updateTrimmerTrackUI();
    });
}

if (trimmerInputEnd) {
    trimmerInputEnd.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || trimVideoDuration;
        trimEndSec = Math.min(trimVideoDuration, Math.max(trimStartSec + 0.2, val));
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimEndSec;
        updateTrimmerTrackUI();
    });
}

// Micro Buttons bindings
['m05', 'm01', 'p01', 'p05'].forEach(btnKey => {
    const val = btnKey === 'm05' ? -0.5 : (btnKey === 'm01' ? -0.1 : (btnKey === 'p01' ? 0.1 : 0.5));
    const btnS = document.getElementById(`btn-trim-start-${btnKey}`);
    if (btnS) btnS.addEventListener('click', () => adjustTrimTime('start', val));
    const btnE = document.getElementById(`btn-trim-end-${btnKey}`);
    if (btnE) btnE.addEventListener('click', () => adjustTrimTime('end', val));
});

// Playhead & Button actions
if (btnTrimmerPlayPause && trimmerVideoPlayer) {
    btnTrimmerPlayPause.addEventListener('click', () => {
        if (trimmerVideoPlayer.paused) {
            trimmerVideoPlayer.play();
        } else {
            trimmerVideoPlayer.pause();
        }
    });
}

if (btnTrimmerStepBack && trimmerVideoPlayer) {
    btnTrimmerStepBack.addEventListener('click', () => {
        trimmerVideoPlayer.currentTime = Math.max(0, trimmerVideoPlayer.currentTime - 1.0);
    });
}

if (btnTrimmerStepFwd && trimmerVideoPlayer) {
    btnTrimmerStepFwd.addEventListener('click', () => {
        trimmerVideoPlayer.currentTime = Math.min(trimVideoDuration, trimmerVideoPlayer.currentTime + 1.0);
    });
}

if (btnTrimmerPreviewLoop && trimmerVideoPlayer) {
    btnTrimmerPreviewLoop.addEventListener('click', () => {
        isPreviewLoopActive = !isPreviewLoopActive;
        if (isPreviewLoopActive) {
            btnTrimmerPreviewLoop.classList.remove('btn-secondary');
            btnTrimmerPreviewLoop.classList.add('btn-primary');
            btnTrimmerPreviewLoop.innerHTML = '🔁 Đang lặp vùng cắt...';
            trimmerVideoPlayer.currentTime = trimStartSec;
            trimmerVideoPlayer.play();
        } else {
            btnTrimmerPreviewLoop.classList.remove('btn-primary');
            btnTrimmerPreviewLoop.classList.add('btn-secondary');
            btnTrimmerPreviewLoop.innerHTML = '🔁 Phát Lặp Vùng Cắt';
        }
    });
}

if (btnTrimmerSetStartNow && trimmerVideoPlayer) {
    btnTrimmerSetStartNow.addEventListener('click', () => {
        const cur = trimmerVideoPlayer.currentTime;
        trimStartSec = Math.max(0, Math.min(trimEndSec - 0.2, cur));
        updateTrimmerTrackUI();
    });
}

if (btnTrimmerSetEndNow && trimmerVideoPlayer) {
    btnTrimmerSetEndNow.addEventListener('click', () => {
        const cur = trimmerVideoPlayer.currentTime;
        trimEndSec = Math.min(trimVideoDuration, Math.max(trimStartSec + 0.2, cur));
        updateTrimmerTrackUI();
    });
}

if (btnTrimmerReset) {
    btnTrimmerReset.addEventListener('click', () => {
        trimStartSec = 0;
        trimEndSec = trimVideoDuration;
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = 0;
        updateTrimmerTrackUI();
    });
}

// Apply Trim
if (btnTrimmerApply) {
    btnTrimmerApply.addEventListener('click', () => {
        if (currentTrimItemIndex < 0 || currentTrimItemIndex >= mediaItems.length) return;
        const item = mediaItems[currentTrimItemIndex];
        
        item.settings.trimStart = parseFloat(trimStartSec.toFixed(2));
        item.settings.trimEnd = parseFloat(trimEndSec.toFixed(2));
        item.duration = parseFloat((trimEndSec - trimStartSec).toFixed(2));

        renderMediaList();
        closeTrimmerModal();
    });
}

// Split Video Segment
if (btnTrimmerSplit) {
    btnTrimmerSplit.addEventListener('click', () => {
        if (currentTrimItemIndex < 0 || currentTrimItemIndex >= mediaItems.length) return;
        const curTime = trimmerVideoPlayer ? trimmerVideoPlayer.currentTime : (trimStartSec + (trimEndSec - trimStartSec)/2);
        
        if (curTime <= trimStartSec + 0.3 || curTime >= trimEndSec - 0.3) {
            alert('Vị trí cắt phải nằm ở giữa điểm Bắt đầu và Kết thúc (cách ít nhất 0.3s)! Hãy kéo con trỏ video vào vị trí muốn tách.');
            return;
        }

        const originalItem = mediaItems[currentTrimItemIndex];
        
        // Segment 1: from trimStart to curTime
        const seg1Settings = JSON.parse(JSON.stringify(originalItem.settings));
        seg1Settings.trimStart = trimStartSec;
        seg1Settings.trimEnd = parseFloat(curTime.toFixed(2));

        originalItem.settings = seg1Settings;
        originalItem.duration = parseFloat((curTime - trimStartSec).toFixed(2));

        // Segment 2: from curTime to trimEnd
        const seg2Settings = JSON.parse(JSON.stringify(originalItem.settings));
        seg2Settings.trimStart = parseFloat(curTime.toFixed(2));
        seg2Settings.trimEnd = trimEndSec;

        const seg2Item = {
            id: 'item_' + Date.now(),
            filename: originalItem.filename,
            originalName: originalItem.originalName + ' (Phần 2)',
            path: originalItem.path,
            url: originalItem.url,
            type: originalItem.type,
            duration: parseFloat((trimEndSec - curTime).toFixed(2)),
            settings: seg2Settings
        };

        // Insert seg2 right after originalItem
        mediaItems.splice(currentTrimItemIndex + 1, 0, seg2Item);

        renderMediaList();
        closeTrimmerModal();
        alert(`✅ Đã tách video thành công thành 2 đoạn riêng biệt trên Timeline!\n- Đoạn 1: ${trimStartSec.toFixed(1)}s -> ${curTime.toFixed(1)}s\n- Đoạn 2: ${curTime.toFixed(1)}s -> ${trimEndSec.toFixed(1)}s`);
    });
}

// Open Trimmer from Quick Inspector button
if (btnOpenTrimmerModal) {
    btnOpenTrimmerModal.addEventListener('click', () => {
        openTrimmerModal(activeSegmentIndex);
    });
}

// Event Delegation on mediaList for card trim buttons
if (mediaList) {
    mediaList.addEventListener('click', (e) => {
        const trimBtn = e.target.closest('.btn-card-trim');
        if (trimBtn) {
            e.stopPropagation();
            const idx = parseInt(trimBtn.dataset.index);
            openTrimmerModal(idx);
        }
    });
}

// Dragging Trimmer Handles
if (trimmerTimelineTrack) {
    function handleTrackMouse(e) {
        if (!isDraggingTrimHandle || trimVideoDuration <= 0) return;
        const rect = trimmerTimelineTrack.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const timeAtPos = parseFloat(((offsetX / rect.width) * trimVideoDuration).toFixed(2));

        if (isDraggingTrimHandle === 'start') {
            trimStartSec = Math.max(0, Math.min(trimEndSec - 0.2, timeAtPos));
            if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimStartSec;
        } else if (isDraggingTrimHandle === 'end') {
            trimEndSec = Math.min(trimVideoDuration, Math.max(trimStartSec + 0.2, timeAtPos));
            if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = trimEndSec;
        }
        updateTrimmerTrackUI();
    }

    if (trimmerHandleStart) {
        trimmerHandleStart.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingTrimHandle = 'start';
        });
    }

    if (trimmerHandleEnd) {
        trimmerHandleEnd.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingTrimHandle = 'end';
        });
    }

    document.addEventListener('mousemove', handleTrackMouse);
    document.addEventListener('mouseup', () => {
        isDraggingTrimHandle = null;
    });

    // Clicking anywhere on track seeks video
    trimmerTimelineTrack.addEventListener('click', (e) => {
        if (e.target.closest('.trimmer-handle')) return;
        const rect = trimmerTimelineTrack.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const timeAtPos = (offsetX / rect.width) * trimVideoDuration;
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = timeAtPos;
    });
}


// ==========================================
// Universal Tab Switching & Zero-Overhead Isolation
// ==========================================

function switchMainTab(targetTabBtnId) {
    // 1. Stop Tab 1 Canvas Studio sequence loop
    if (typeof isStudioPlayingAll !== 'undefined' && isStudioPlayingAll) {
        isStudioPlayingAll = false;
        const btnPlay = document.getElementById('studio-btn-play');
        if (btnPlay) btnPlay.innerHTML = '▶ Toàn bộ';
        const container = document.getElementById('studio-player-container');
        if (container) container.classList.remove('is-playing');
    }

    // 2. Pause all playing video and audio elements across all tabs
    document.querySelectorAll('video, audio').forEach(media => {
        try {
            if (!media.paused) media.pause();
        } catch (e) {}
    });

    // 3. Update tab buttons
    document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === targetTabBtnId);
    });

    // 4. Update tab panes
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

// Bind universal tab switcher
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchMainTab(btn.id);
        });
    });
});
