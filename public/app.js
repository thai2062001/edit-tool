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
const rowReframeMode = document.getElementById('row-reframe-mode');

function updateReframeVisibility(ratio) {
    if (rowReframeMode) {
        if (ratio === '9:16' || ratio === '1:1') {
            rowReframeMode.classList.remove('hidden');
        } else {
            rowReframeMode.classList.add('hidden');
        }
    }
}

document.querySelectorAll('.ratio-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.ratio-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        currentSettings.ratio = option.dataset.ratio;
        currentSettings.width = parseInt(option.dataset.width);
        currentSettings.height = parseInt(option.dataset.height);
        updateReframeVisibility(currentSettings.ratio);
        triggerAutoSave();
    });
});

// Initialize on page load
updateReframeVisibility(currentSettings.ratio);

const selectFps = document.getElementById('select-fps');
if (selectFps) {
    selectFps.addEventListener('change', (e) => {
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

// Render Media List
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
    if (mediaItems.length === 0) {
        emptyState.classList.remove('hidden');
        mediaList.innerHTML = '';
        mediaList.appendChild(emptyState);
        btnRenderAll.disabled = true;
        itemCountEl.innerText = '0';
        totalDurationEl.innerText = '0.0s';
        updateWorkflowStep(1);
        return;
    }

    emptyState.classList.add('hidden');
    mediaList.innerHTML = '';
    btnRenderAll.disabled = false;
    itemCountEl.innerText = mediaItems.length;
    updateWorkflowStep(2);

    let totalDur = 0;

    mediaItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.index = index;
        card.setAttribute('draggable', 'true');

        // Drag and Drop Event Listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        const isImage = item.type === 'image';
        const dur = isImage ? Number(item.settings.duration || 5.0) : Math.max(0.5, Number(item.settings.trimEnd || item.duration || 5) - Number(item.settings.trimStart || 0));
        totalDur += Math.max(0.5, dur);

        card.innerHTML = `
            <div class="card-drag-handle" title="Kéo thả chuột để đổi vị trí phân đoạn">
                <span>⠿</span>
            </div>
            
            <div class="card-index-badge">#${index + 1}</div>

            <div class="card-thumb-wrapper">
                ${isImage 
                    ? `<img src="${item.url}" class="card-thumb" alt="${item.originalName}">` 
                    : `<video src="${item.url}" class="card-thumb" muted></video>`
                }
                <span class="card-type-badge ${item.type}">${item.type === 'image' ? '🖼️ Ảnh' : '🎬 Clip'}</span>
                <span class="card-duration-tag">⏱️ ${dur.toFixed(1)}s</span>
            </div>

            <div class="card-controls">
                <div class="card-title-row">
                    <div class="card-filename-wrap">
                        <span class="card-filename" title="${item.originalName}">${item.originalName}</span>
                    </div>
                    <div class="card-quick-actions">
                        ${isImage ? `<button type="button" class="btn btn-xs btn-preview-card" onclick="previewItemMotion(${index})" title="Xem trước chuyển động & chữ">👁️ Xem Thử</button>` : ''}
                    </div>
                </div>

                <div class="card-form-grid">
                    ${isImage ? `
                        <div class="form-group motion-select-group">
                            <label class="form-label-xs">🎬 Hiệu ứng Motion:</label>
                            <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'motion', this.value)">
                                <option value="zoom_in" ${item.settings.motion === 'zoom_in' ? 'selected' : ''}>🔍 Zoom In (Phóng to tâm)</option>
                                <option value="zoom_out" ${item.settings.motion === 'zoom_out' ? 'selected' : ''}>🔎 Zoom Out (Thu nhỏ tâm)</option>
                                <option value="pan_left" ${item.settings.motion === 'pan_left' ? 'selected' : ''}>⬅️ Pan Trái</option>
                                <option value="pan_right" ${item.settings.motion === 'pan_right' ? 'selected' : ''}>➡️ Pan Phải</option>
                                <option value="pan_up" ${item.settings.motion === 'pan_up' ? 'selected' : ''}>⬆️ Pan Lên Trên</option>
                                <option value="pan_down" ${item.settings.motion === 'pan_down' ? 'selected' : ''}>⬇️ Pan Xuống Dưới</option>
                                <option value="zoom_pan" ${item.settings.motion === 'zoom_pan' ? 'selected' : ''}>🎯 Zoom + Pan Chéo</option>
                                <option value="zoom_in_left" ${item.settings.motion === 'zoom_in_left' ? 'selected' : ''}>↖️ Zoom Góc Trái</option>
                                <option value="zoom_in_right" ${item.settings.motion === 'zoom_in_right' ? 'selected' : ''}>↗️ Zoom Góc Phải</option>
                                <option value="none" ${item.settings.motion === 'none' ? 'selected' : ''}>⏹️ Tĩnh (Không zoom)</option>
                            </select>
                        </div>
                        <div class="form-group duration-input-group">
                            <label class="form-label-xs">⏱️ Thời lượng (s):</label>
                            <input type="number" class="form-control form-control-sm" min="1" max="30" step="0.5" value="${item.settings.duration || 5.0}" onchange="updateItemSetting(${index}, 'duration', parseFloat(this.value))">
                        </div>
                        <div class="form-group intensity-group">
                            <label class="form-label-xs">🌊 Tốc độ/Cường độ:</label>
                            <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'zoomIntensity', parseFloat(this.value))">
                                <option value="1.15" ${(item.settings.zoomIntensity || 1.25) === 1.15 ? 'selected' : ''}>🌿 Rất chậm (15%)</option>
                                <option value="1.25" ${(item.settings.zoomIntensity || 1.25) === 1.25 ? 'selected' : ''}>✨ Chuẩn mượt (25%)</option>
                                <option value="1.40" ${(item.settings.zoomIntensity || 1.25) === 1.40 ? 'selected' : ''}>⚡ Kịch tính (40%)</option>
                            </select>
                        </div>
                        <div class="form-group fade-group">
                            <label class="form-label-xs">✨ Fade In / Out:</label>
                            <div class="flex-row-gap">
                                <input type="number" class="form-control form-control-sm" min="0" max="3" step="0.1" value="${item.settings.fadeIn}" title="Fade In (giây)" placeholder="In" onchange="updateItemSetting(${index}, 'fadeIn', parseFloat(this.value))">
                                <input type="number" class="form-control form-control-sm" min="0" max="3" step="0.1" value="${item.settings.fadeOut}" title="Fade Out (giây)" placeholder="Out" onchange="updateItemSetting(${index}, 'fadeOut', parseFloat(this.value))">
                            </div>
                        </div>
                    ` : `
                        <div class="form-group">
                            <label class="form-label-xs">✂️ Cắt từ (giây):</label>
                            <input type="number" class="form-control form-control-sm" min="0" max="${item.duration}" step="0.5" value="${item.settings.trimStart}" onchange="updateItemSetting(${index}, 'trimStart', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label class="form-label-xs">✂️ Đến (giây):</label>
                            <input type="number" class="form-control form-control-sm" min="0.5" max="${item.duration}" step="0.5" value="${item.settings.trimEnd}" onchange="updateItemSetting(${index}, 'trimEnd', parseFloat(this.value))">
                        </div>
                        <div class="form-group">
                            <label class="form-label-xs">🔊 Âm lượng video:</label>
                            <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'videoVolume', parseFloat(this.value))">
                                <option value="1.0" ${item.settings.videoVolume === 1.0 ? 'selected' : ''}>🔊 100% Gốc</option>
                                <option value="0.5" ${item.settings.videoVolume === 0.5 ? 'selected' : ''}>🔉 50% Nhỏ</option>
                                <option value="0" ${item.settings.videoVolume === 0 ? 'selected' : ''}>🔇 Tắt tiếng</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label-xs">✨ Fade In / Out:</label>
                            <div class="flex-row-gap">
                                <input type="number" class="form-control form-control-sm" min="0" max="2" step="0.1" value="${item.settings.fadeIn}" placeholder="In" onchange="updateItemSetting(${index}, 'fadeIn', parseFloat(this.value))">
                                <input type="number" class="form-control form-control-sm" min="0" max="2" step="0.1" value="${item.settings.fadeOut}" placeholder="Out" onchange="updateItemSetting(${index}, 'fadeOut', parseFloat(this.value))">
                            </div>
                        </div>
                    `}
                </div>

                <!-- Text Overlay / Headline Row -->
                <div class="card-text-overlay-row">
                    <div class="text-overlay-input-wrap">
                        <span class="text-overlay-icon">✍️ Tiêu đề/Chữ:</span>
                        <input type="text" class="form-control form-control-sm text-overlay-input" 
                               placeholder="Nhập chữ/tiêu đề xuất hiện trên phân đoạn này..." 
                               value="${item.settings?.overlayText || ''}" 
                               onchange="updateItemSetting(${index}, 'overlayText', this.value)">
                    </div>
                    <div class="text-overlay-options">
                        <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'textPosition', this.value)" title="Vị trí hiển thị chữ">
                            <option value="bottom" ${(item.settings?.textPosition || 'bottom') === 'bottom' ? 'selected' : ''}>📍 Dưới đáy</option>
                            <option value="center" ${(item.settings?.textPosition || 'bottom') === 'center' ? 'selected' : ''}>📍 Giữa khung</option>
                            <option value="top" ${(item.settings?.textPosition || 'bottom') === 'top' ? 'selected' : ''}>📍 Trên đỉnh</option>
                        </select>
                        <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'textStyle', this.value)" title="Kiểu hiển thị chữ">
                            <option value="banner" ${(item.settings?.textStyle || 'banner') === 'banner' ? 'selected' : ''}>🎨 Banner mờ</option>
                            <option value="outline" ${(item.settings?.textStyle || 'banner') === 'outline' ? 'selected' : ''}>🎨 Viền đen</option>
                            <option value="glow" ${(item.settings?.textStyle || 'banner') === 'glow' ? 'selected' : ''}>🎨 Neon sáng</option>
                            <option value="plain" ${(item.settings?.textStyle || 'banner') === 'plain' ? 'selected' : ''}>🎨 Chữ trắng</option>
                        </select>
                        <select class="form-control form-control-sm" onchange="updateItemSetting(${index}, 'fontSize', parseInt(this.value))" title="Cỡ chữ">
                            <option value="36" ${(item.settings?.fontSize || 48) === 36 ? 'selected' : ''}>36px (Vừa)</option>
                            <option value="48" ${(item.settings?.fontSize || 48) === 48 ? 'selected' : ''}>48px (Lớn)</option>
                            <option value="64" ${(item.settings?.fontSize || 48) === 64 ? 'selected' : ''}>64px (To)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <button type="button" class="btn btn-icon btn-secondary" onclick="moveToTop(${index})" ${index === 0 ? 'disabled' : ''} title="Đưa lên đầu danh sách">⏫</button>
                <button type="button" class="btn btn-icon btn-secondary" onclick="moveItem(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Di chuyển lên một bậc">▲</button>
                <button type="button" class="btn btn-icon btn-secondary" onclick="moveItem(${index}, 1)" ${index === mediaItems.length - 1 ? 'disabled' : ''} title="Di chuyển xuống một bậc">▼</button>
                <button type="button" class="btn btn-icon btn-secondary" onclick="moveToBottom(${index})" ${index === mediaItems.length - 1 ? 'disabled' : ''} title="Đưa xuống cuối danh sách">⏬</button>
                <button type="button" class="btn btn-icon btn-ghost btn-delete-card" onclick="removeItem(${index})" title="Xóa phân đoạn">✕</button>
            </div>
        `;
        mediaList.appendChild(card);
    });

    totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
    triggerAutoSave();
}

// Drag and Drop Reordering Handlers
let draggedIndex = null;

function handleDragStart(e) {
    const target = e.target;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'OPTION', 'A'].includes(target.tagName) || target.closest('button') || target.closest('.form-control')) {
        e.preventDefault();
        return;
    }
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over-target');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over-target');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over-target');
    const targetIndex = parseInt(this.dataset.index);
    if (draggedIndex !== null && !isNaN(draggedIndex) && draggedIndex !== targetIndex) {
        const item = mediaItems.splice(draggedIndex, 1)[0];
        mediaItems.splice(targetIndex, 0, item);
        renderMediaList();
    }
}

function handleDragEnd(e) {
    this.classList.remove('is-dragging');
    document.querySelectorAll('.media-card').forEach(c => {
        c.classList.remove('drag-over-target');
        c.classList.remove('is-dragging');
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
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Compute Ken Burns scale & offsets
        let zoom = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        if (motion === 'zoom_in') {
            zoom = 1.0 + (delta * progress);
        } else if (motion === 'zoom_out') {
            zoom = zoomIntensity - (delta * progress);
        } else if (motion === 'pan_left') {
            zoom = zoomIntensity;
            offsetX = (1 - progress) * (previewCanvas.width * delta * 0.5);
        } else if (motion === 'pan_right') {
            zoom = zoomIntensity;
            offsetX = -progress * (previewCanvas.width * delta * 0.5);
        } else if (motion === 'pan_up') {
            zoom = zoomIntensity;
            offsetY = (1 - progress) * (previewCanvas.height * delta * 0.5);
        } else if (motion === 'pan_down') {
            zoom = zoomIntensity;
            offsetY = -progress * (previewCanvas.height * delta * 0.5);
        } else if (motion === 'zoom_in_left') {
            zoom = 1.0 + (delta * progress);
            offsetX = (zoom - 1.0) * (previewCanvas.width * 0.45);
            offsetY = (zoom - 1.0) * (previewCanvas.height * 0.45);
        } else if (motion === 'zoom_in_right') {
            zoom = 1.0 + (delta * progress);
            offsetX = -(zoom - 1.0) * (previewCanvas.width * 0.45);
            offsetY = (zoom - 1.0) * (previewCanvas.height * 0.45);
        } else if (motion === 'zoom_pan') {
            zoom = 1.0 + (delta * progress);
            offsetX = progress * (previewCanvas.width * 0.08);
            offsetY = progress * (previewCanvas.height * 0.08);
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

function renderAiScenesResult(scenes) {
    aiResultsContainer.classList.remove('hidden');
    aiScenesCountBadge.innerText = `${scenes.length} phân cảnh`;
    aiScenesList.innerHTML = '';

    scenes.forEach((scene, index) => {
        const imgItem = mediaItems[scene.imageIndex] || mediaItems[index % mediaItems.length];
        const card = document.createElement('div');
        card.className = 'ai-scene-card';
        card.innerHTML = `
            <img src="${imgItem ? imgItem.url : ''}" class="ai-scene-thumb" alt="Scene ${index + 1}">
            <div class="ai-scene-info">
                <h5>Cảnh ${index + 1}: ${imgItem ? imgItem.originalName : ''}</h5>
                <p class="ai-scene-text">${scene.sceneText || scene.reason || ''}</p>
            </div>
            <div class="ai-scene-meta">
                <span class="badge-motion">${(scene.suggestedMotion || 'zoom_in').replace('_', ' ')}</span>
                <span class="ai-scene-dur">${scene.suggestedDuration || 4.0}s | Fade ${scene.fadeIn || 0.8}s</span>
            </div>
        `;
        aiScenesList.appendChild(card);
    });
}

// Apply AI Match to Timeline
btnApplyAiTimeline.addEventListener('click', () => {
    if (!currentAiMatchedScenes || currentAiMatchedScenes.length === 0) return;

    const sourceItems = (window.mediaItems && window.mediaItems.length > 0) ? window.mediaItems : mediaItems;
    const newTimeline = [];

    currentAiMatchedScenes.forEach((scene, sIdx) => {
        const originalItem = sourceItems[scene.imageIndex] || sourceItems[sIdx % sourceItems.length];
        if (originalItem) {
            // Deep clone item with new AI settings
            const cloned = JSON.parse(JSON.stringify(originalItem));
            if (!cloned.settings) cloned.settings = {};
            cloned.settings.motion = scene.suggestedMotion || 'zoom_in';
            cloned.settings.duration = parseFloat(scene.suggestedDuration || 5.0);
            cloned.settings.fadeIn = parseFloat(scene.fadeIn || 0.8);
            cloned.settings.fadeOut = parseFloat(scene.fadeOut || 0.8);
            if (scene.sceneText) {
                cloned.settings.overlayText = scene.sceneText;
            }
            newTimeline.push(cloned);
        }
    });

    if (newTimeline.length > 0) {
        mediaItems = newTimeline;
        window.mediaItems = newTimeline;
        renderMediaList();
        closeAiModal();
        alert('🎉 Đã áp dụng thành công kịch bản và tự động sắp xếp lại Timeline theo gợi ý của Gemini AI!');
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



