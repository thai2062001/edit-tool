// =========================================================================
// STATE MANAGEMENT & GLOBAL HELPERS (MODULE 1: state.js)
// =========================================================================

// Global App State
let mediaItems = [];
let libraryPool = []; // Preserves all original uploaded images for AI re-matching and smart pick
let bgmTrack = null;
let currentSettings = {
    ratio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    qualityPreset: 'standard_1080p',
    reframeMode: 'cover'
};

// Selection & Navigation Index
let activeSegmentIndex = 0;
let lastClickedIndex = 0;
let selectedSegmentIndices = new Set();

// Cache & Player Loop State
const studioLoadedImages = new Map();
const studioLoadedVideos = new Map();
let studioAnimFrame = null;
let isStudioPlayingAll = false;
let isStudioPlayingSingle = false;
let currentStudioTimelineTimeMs = 0;
let audioContextInstance = null;
let audioWaveformPeaks = null;

// Expose state variables to window for cross-module integration
window.mediaItems = mediaItems;
window.libraryPool = libraryPool;
window.bgmTrack = bgmTrack;
window.currentSettings = currentSettings;

// ==========================================
// MOTION NAMES & UTILITY HELPERS
// ==========================================
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

function getTotalTimelineDurationSec() {
    let total = 0;
    mediaItems.forEach(item => {
        const dur = item.type === 'image' 
            ? (Number(item.settings?.duration) || 5.0) 
            : Math.max(0.5, (Number(item.settings?.trimEnd) || item.duration || 5) - (Number(item.settings?.trimStart) || 0));
        total += Math.max(0.5, dur);
    });
    return total;
}

function getSceneAudioRange(targetIndex) {
    let startTime = 0;
    for (let i = 0; i < targetIndex && i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const dur = item.type === 'image' 
            ? (Number(item.settings?.duration) || 5.0) 
            : Math.max(0.5, (Number(item.settings?.trimEnd) || item.duration || 5) - (Number(item.settings?.trimStart) || 0));
        startTime += Math.max(0.5, dur);
    }
    const currentItem = mediaItems[targetIndex];
    let duration = 5.0;
    if (currentItem) {
        duration = currentItem.type === 'image' 
            ? (Number(currentItem.settings?.duration) || 5.0) 
            : Math.max(0.5, (Number(currentItem.settings?.trimEnd) || currentItem.duration || 5) - (Number(currentItem.settings?.trimStart) || 0));
    }
    return { startTime, duration, endTime: startTime + duration };
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

function updateReframeVisibility(ratio) {
    const rowReframeMode = document.getElementById("row-reframe-mode");
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

function triggerAutoSave() {
    // Disabled auto saving large blobs into localStorage per memory policy
}

// ==========================================
// UNDO / REDO HISTORY MANAGER (TAB 1)
// ==========================================
const undoStack = [];
const redoStack = [];
const MAX_HISTORY_STEPS = 30;
let isApplyingHistory = false;

function recordHistorySnapshot() {
    if (isApplyingHistory) return;
    try {
        const snapshot = {
            mediaItems: JSON.parse(JSON.stringify(mediaItems)),
            bgmTrack: bgmTrack ? JSON.parse(JSON.stringify(bgmTrack)) : null,
            activeSegmentIndex: activeSegmentIndex
        };
        undoStack.push(snapshot);
        if (undoStack.length > MAX_HISTORY_STEPS) {
            undoStack.shift();
        }
        // Clear redo stack on new user action
        redoStack.length = 0;
        updateUndoRedoButtonsUI();
    } catch (e) {
        console.warn('History snapshot warning:', e);
    }
}

function performUndoAction() {
    if (undoStack.length === 0) return;
    try {
        isApplyingHistory = true;
        const currentSnapshot = {
            mediaItems: JSON.parse(JSON.stringify(mediaItems)),
            bgmTrack: bgmTrack ? JSON.parse(JSON.stringify(bgmTrack)) : null,
            activeSegmentIndex: activeSegmentIndex
        };
        redoStack.push(currentSnapshot);

        const prevState = undoStack.pop();
        mediaItems = prevState.mediaItems;
        window.mediaItems = mediaItems;
        bgmTrack = prevState.bgmTrack;
        window.bgmTrack = bgmTrack;
        activeSegmentIndex = Math.min(mediaItems.length - 1, Math.max(0, prevState.activeSegmentIndex || 0));

        if (typeof updateBgmUI === 'function') updateBgmUI();
        if (typeof renderMediaList === 'function') renderMediaList();
        clearMultiSelection();
    } finally {
        isApplyingHistory = false;
        updateUndoRedoButtonsUI();
    }
}

function performRedoAction() {
    if (redoStack.length === 0) return;
    try {
        isApplyingHistory = true;
        const currentSnapshot = {
            mediaItems: JSON.parse(JSON.stringify(mediaItems)),
            bgmTrack: bgmTrack ? JSON.parse(JSON.stringify(bgmTrack)) : null,
            activeSegmentIndex: activeSegmentIndex
        };
        undoStack.push(currentSnapshot);

        const nextState = redoStack.pop();
        mediaItems = nextState.mediaItems;
        window.mediaItems = mediaItems;
        bgmTrack = nextState.bgmTrack;
        window.bgmTrack = bgmTrack;
        activeSegmentIndex = Math.min(mediaItems.length - 1, Math.max(0, nextState.activeSegmentIndex || 0));

        if (typeof updateBgmUI === 'function') updateBgmUI();
        if (typeof renderMediaList === 'function') renderMediaList();
        clearMultiSelection();
    } finally {
        isApplyingHistory = false;
        updateUndoRedoButtonsUI();
    }
}

function updateUndoRedoButtonsUI() {
    const btnUndo = document.getElementById('btn-undo-action');
    const btnRedo = document.getElementById('btn-redo-action');
    if (btnUndo) btnUndo.disabled = (undoStack.length === 0);
    if (btnRedo) btnRedo.disabled = (redoStack.length === 0);
}

// ==========================================
// MULTI-SELECTION SYSTEM (TAB 1)
// ==========================================
function clearMultiSelection() {
    selectedSegmentIndices.clear();
    updateMultiSelectUI();
}

function toggleMultiSelectIndex(index, isCtrl, isShift) {
    if (isShift) {
        // Range selection from lastClickedIndex to index
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i++) {
            selectedSegmentIndices.add(i);
        }
    } else if (isCtrl) {
        // Toggle single item in selection
        if (selectedSegmentIndices.has(index)) {
            selectedSegmentIndices.delete(index);
        } else {
            selectedSegmentIndices.add(index);
        }
    } else {
        // Single selection mode
        selectedSegmentIndices.clear();
        selectedSegmentIndices.add(index);
    }
    lastClickedIndex = index;
    updateMultiSelectUI();
}

function updateMultiSelectUI() {
    const bar = document.getElementById('multi-select-action-bar');
    const countEl = document.getElementById('multi-select-count');
    const mediaListEl = document.getElementById('media-list');
    const cards = mediaListEl ? mediaListEl.querySelectorAll('.storyboard-card') : [];

    cards.forEach((c, idx) => {
        if (selectedSegmentIndices.has(idx)) {
            c.classList.add('is-multi-selected');
        } else {
            c.classList.remove('is-multi-selected');
        }
    });

    if (bar && countEl) {
        if (selectedSegmentIndices.size > 1) {
            bar.classList.remove('hidden');
            countEl.innerText = selectedSegmentIndices.size;
        } else {
            bar.classList.add('hidden');
        }
    }
}

function selectAllSegments() {
    selectedSegmentIndices.clear();
    mediaItems.forEach((_, idx) => selectedSegmentIndices.add(idx));
    updateMultiSelectUI();
}
