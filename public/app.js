// App State
let mediaItems = [];
let bgmTrack = null;
let currentSettings = {
    ratio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30
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

// Aspect ratio selector
document.querySelectorAll('.ratio-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.ratio-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        currentSettings.ratio = option.dataset.ratio;
        currentSettings.width = parseInt(option.dataset.width);
        currentSettings.height = parseInt(option.dataset.height);
    });
});

document.getElementById('select-fps').addEventListener('change', (e) => {
    currentSettings.fps = parseInt(e.target.value);
});

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

// Render Media List
function renderMediaList() {
    if (mediaItems.length === 0) {
        emptyState.classList.remove('hidden');
        mediaList.innerHTML = '';
        mediaList.appendChild(emptyState);
        btnRenderAll.disabled = true;
        itemCountEl.innerText = '0';
        totalDurationEl.innerText = '0.0s';
        return;
    }

    emptyState.classList.add('hidden');
    mediaList.innerHTML = '';
    btnRenderAll.disabled = false;
    itemCountEl.innerText = mediaItems.length;

    let totalDur = 0;

    mediaItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.index = index;

        const isImage = item.type === 'image';
        const dur = isImage ? item.settings.duration : (item.settings.trimEnd - item.settings.trimStart);
        totalDur += Math.max(0.5, dur);

        card.innerHTML = `
            <div class="card-index">#${index + 1}</div>
            <div class="card-thumb-wrapper">
                ${isImage 
                    ? `<img src="${item.url}" class="card-thumb" alt="${item.originalName}">` 
                    : `<video src="${item.url}" class="card-thumb" muted></video>`
                }
                <span class="card-type-badge ${item.type}">${item.type === 'image' ? 'Ảnh' : 'Video'}</span>
            </div>
            <div class="card-controls">
                <div class="card-title-row">
                    <span class="card-filename" title="${item.originalName}">${item.originalName}</span>
                    ${isImage ? `<button class="btn btn-small btn-outline" onclick="previewItemMotion(${index})">👁️ Xem Trước Chuyển Động</button>` : ''}
                </div>
                <div class="card-form-grid">
                    ${isImage ? `
                        <div class="form-group">
                            <label>Hiệu ứng Motion:</label>
                            <select class="form-control" onchange="updateItemSetting(${index}, 'motion', this.value)">
                                <option value="zoom_in" ${item.settings.motion === 'zoom_in' ? 'selected' : ''}>🔍 Zoom In (Phóng to vào tâm)</option>
                                <option value="zoom_out" ${item.settings.motion === 'zoom_out' ? 'selected' : ''}>🔎 Zoom Out (Thu nhỏ ra ngoài)</option>
                                <option value="pan_left" ${item.settings.motion === 'pan_left' ? 'selected' : ''}>⬅️ Pan Trái</option>
                                <option value="pan_right" ${item.settings.motion === 'pan_right' ? 'selected' : ''}>➡️ Pan Phải</option>
                                <option value="zoom_pan" ${item.settings.motion === 'zoom_pan' ? 'selected' : ''}>🎯 Zoom + Pan Chéo</option>
                                <option value="none" ${item.settings.motion === 'none' ? 'selected' : ''}>⏹️ Tĩnh (Không zoom)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Thời lượng (giây):</label>
                            <input type="number" class="form-control" min="1" max="30" step="0.5" value="${item.settings.duration}" onchange="updateItemSetting(${index}, 'duration', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label>Fade In (giây):</label>
                            <input type="number" class="form-control" min="0" max="3" step="0.1" value="${item.settings.fadeIn}" onchange="updateItemSetting(${index}, 'fadeIn', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label>Fade Out (giây):</label>
                            <input type="number" class="form-control" min="0" max="3" step="0.1" value="${item.settings.fadeOut}" onchange="updateItemSetting(${index}, 'fadeOut', parseFloat(this.value))">
                        </div>
                    ` : `
                        <div class="form-group">
                            <label>Cắt từ (giây):</label>
                            <input type="number" class="form-control" min="0" max="${item.duration}" step="0.5" value="${item.settings.trimStart}" onchange="updateItemSetting(${index}, 'trimStart', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label>Đến (giây):</label>
                            <input type="number" class="form-control" min="0.5" max="${item.duration}" step="0.5" value="${item.settings.trimEnd}" onchange="updateItemSetting(${index}, 'trimEnd', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label>Âm lượng video:</label>
                            <select class="form-control" onchange="updateItemSetting(${index}, 'videoVolume', parseFloat(this.value))">
                                <option value="1.0" ${item.settings.videoVolume === 1.0 ? 'selected' : ''}>🔊 100% Gốc</option>
                                <option value="0.5" ${item.settings.videoVolume === 0.5 ? 'selected' : ''}>🔉 50% Nhỏ</option>
                                <option value="0" ${item.settings.videoVolume === 0 ? 'selected' : ''}>🔇 Tắt tiếng (Mute)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fade In / Out:</label>
                            <input type="number" class="form-control" min="0" max="2" step="0.1" value="${item.settings.fadeIn}" placeholder="Fade In (s)" onchange="updateItemSetting(${index}, 'fadeIn', parseFloat(this.value))">
                        </div>
                    `}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-icon btn-secondary" onclick="moveItem(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Di chuyển lên">▲</button>
                <button class="btn btn-icon btn-secondary" onclick="moveItem(${index}, 1)" ${index === mediaItems.length - 1 ? 'disabled' : ''} title="Di chuyển xuống">▼</button>
                <button class="btn btn-icon btn-ghost" onclick="removeItem(${index})" title="Xóa">✕</button>
            </div>
        `;
        mediaList.appendChild(card);
    });

    totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
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

// Live Canvas Motion Preview
let previewAnimFrame = null;
const previewModal = document.getElementById('preview-modal');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const previewEffectName = document.getElementById('preview-effect-name');
const previewTimeDisplay = document.getElementById('preview-time-display');
let previewImg = new Image();
let previewItemData = null;

function previewItemMotion(index) {
    const item = mediaItems[index];
    if (!item || item.type !== 'image') return;

    previewItemData = item;
    previewEffectName.innerText = item.settings.motion.replace('_', ' ').toUpperCase();
    previewModal.classList.remove('hidden');

    previewImg = new Image();
    previewImg.crossOrigin = 'anonymous';
    previewImg.src = item.url;
    previewImg.onload = () => {
        startPreviewAnimation();
    };
}

function startPreviewAnimation() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);

    const dur = previewItemData.settings.duration || 3.5;
    const fadeIn = previewItemData.settings.fadeIn || 0;
    const fadeOut = previewItemData.settings.fadeOut || 0;
    const motion = previewItemData.settings.motion || 'zoom_in';

    const startTime = performance.now();
    const totalMs = dur * 1000;

    function renderFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / totalMs);
        const currentSec = (progress * dur).toFixed(1);
        previewTimeDisplay.innerText = `${currentSec}s / ${dur}s`;

        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Compute Ken Burns scale & offsets
        let zoom = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        if (motion === 'zoom_in') {
            zoom = 1.0 + (0.35 * progress);
        } else if (motion === 'zoom_out') {
            zoom = 1.35 - (0.35 * progress);
        } else if (motion === 'pan_left') {
            zoom = 1.2;
            offsetX = (1 - progress) * (previewCanvas.width * 0.15);
        } else if (motion === 'pan_right') {
            zoom = 1.2;
            offsetX = -progress * (previewCanvas.width * 0.15);
        } else if (motion === 'zoom_pan') {
            zoom = 1.0 + (0.3 * progress);
            offsetX = progress * (previewCanvas.width * 0.1);
            offsetY = progress * (previewCanvas.height * 0.1);
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
            { title: 'Scene 1: Bình Minh', gradient: ['#FF512F', '#DD2476'], motion: 'zoom_in', fadeIn: 1.0, fadeOut: 0.5 },
            { title: 'Scene 2: Đại Dương Xanh', gradient: ['#1A2980', '#26D0CE'], motion: 'zoom_out', fadeIn: 0.5, fadeOut: 0.5 },
            { title: 'Scene 3: Hoàng Hôn Neon', gradient: ['#8E2DE2', '#4A00E0'], motion: 'pan_right', fadeIn: 0.5, fadeOut: 1.0 }
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
                item.settings.duration = 4.0;
                item.settings.fadeIn = s.fadeIn;
                item.settings.fadeOut = s.fadeOut;
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
