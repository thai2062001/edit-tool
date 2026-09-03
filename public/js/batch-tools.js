// =========================================================================
// BATCH TOOLS, MULTI-SELECT & MOTION DISTRIBUTION (MODULE 5: batch-tools.js)
// =========================================================================

// Batch controls for Tab 1
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
        if (batchDurationVal) batchDurationVal.innerText = `${parseFloat(e.target.value).toFixed(1)}s`;
    });
}

if (btnApplyDurationAll) {
    btnApplyDurationAll.addEventListener('click', () => {
        const val = parseFloat(batchDurationSlider ? batchDurationSlider.value : 5.0);
        let count = 0;
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.duration = val;
                count++;
            }
        });
        if (count > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            alert(`✨ Đã đặt thời lượng ${val}s cho toàn bộ ${count} ảnh!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnApplyIntensityAll) {
    btnApplyIntensityAll.addEventListener('click', () => {
        const val = parseFloat(batchMotionIntensity ? batchMotionIntensity.value : 1.25);
        let count = 0;
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.zoomIntensity = val;
                count++;
            }
        });
        if (count > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            alert(`✨ Đã áp dụng cường độ chuyển động cho toàn bộ ${count} ảnh!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

if (btnApplyMotionAll) {
    btnApplyMotionAll.addEventListener('click', () => {
        const motion = batchMotionSelect ? batchMotionSelect.value : 'zoom_in';
        let count = 0;
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                item.settings.motion = motion;
                count++;
            }
        });
        if (count > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            alert(`✨ Đã chuyển toàn bộ ${count} ảnh sang hiệu ứng: ${motion.replace('_', ' ').toUpperCase()}!`);
        } else {
            alert('Chưa có ảnh nào trên timeline!');
        }
    });
}

const batchTransitionSelect = document.getElementById('batch-transition-select');
const btnApplyTransitionAll = document.getElementById('btn-apply-transition-all');

if (btnApplyTransitionAll) {
    btnApplyTransitionAll.addEventListener('click', () => {
        const trans = batchTransitionSelect ? batchTransitionSelect.value : 'fade_black';
        let count = 0;
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems.forEach(item => {
            if (!item.settings) item.settings = {};
            item.settings.transition = trans;
            count++;
        });
        if (count > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            alert(`✨ Đã gán hiệu ứng chuyển cảnh cho toàn bộ ${count} phân cảnh!`);
        } else {
            alert('Chưa có phân cảnh nào trên timeline!');
        }
    });
}

function randomizeMotions() {
    const availableMotions = [
        'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 
        'pan_up', 'pan_down', 'zoom_pan', 'zoom_in_left', 'zoom_in_right'
    ];
    let count = 0;
    let lastMotion = '';
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    mediaItems.forEach(item => {
        if (item.type === 'image') {
            if (!item.settings) item.settings = {};
            let candidates = availableMotions.filter(m => m !== lastMotion);
            let chosen = candidates[Math.floor(Math.random() * candidates.length)];
            item.settings.motion = chosen;
            lastMotion = chosen;
            count++;
        }
    });
    if (count > 0) {
        if (typeof renderMediaList === 'function') renderMediaList();
        alert(`🎲 Đã phân bổ ngẫu nhiên các hiệu ứng đa dạng cho ${count} ảnh thành công!`);
    } else {
        alert('Chưa có ảnh nào trên timeline!');
    }
}
window.randomizeMotions = randomizeMotions;

if (btnRandomizeMotions) {
    btnRandomizeMotions.addEventListener('click', randomizeMotions);
}

if (btnApplyFadeAll) {
    btnApplyFadeAll.addEventListener('click', () => {
        const fIn = parseFloat(batchFadeIn ? batchFadeIn.value : 0) || 0;
        const fOut = parseFloat(batchFadeOut ? batchFadeOut.value : 0) || 0;
        let count = 0;
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems.forEach(item => {
            if (!item.settings) item.settings = {};
            item.settings.fadeIn = fIn;
            item.settings.fadeOut = fOut;
            count++;
        });
        if (count > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            alert(`✨ Đã áp dụng Fade In (${fIn}s) & Fade Out (${fOut}s) cho ${count} phân đoạn!`);
        } else {
            alert('Chưa có phân đoạn nào trên timeline!');
        }
    });
}

// Multi-select batch actions
function applyBatchDurationToSelected(dur) {
    if (selectedSegmentIndices.size === 0) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    selectedSegmentIndices.forEach(idx => {
        if (mediaItems[idx] && mediaItems[idx].type === 'image') {
            if (!mediaItems[idx].settings) mediaItems[idx].settings = {};
            mediaItems[idx].settings.duration = dur;
        }
    });
    if (typeof renderMediaList === 'function') renderMediaList();
}

function applyBatchMotionToSelected(motion) {
    if (selectedSegmentIndices.size === 0 || !motion) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    selectedSegmentIndices.forEach(idx => {
        if (mediaItems[idx] && mediaItems[idx].type === 'image') {
            if (!mediaItems[idx].settings) mediaItems[idx].settings = {};
            mediaItems[idx].settings.motion = motion;
        }
    });
    if (typeof renderMediaList === 'function') renderMediaList();
}

function applyBatchTransitionToSelected(trans) {
    if (selectedSegmentIndices.size === 0 || !trans) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    selectedSegmentIndices.forEach(idx => {
        if (mediaItems[idx]) {
            if (!mediaItems[idx].settings) mediaItems[idx].settings = {};
            mediaItems[idx].settings.transition = trans;
        }
    });
    if (typeof renderMediaList === 'function') renderMediaList();
}

function deleteSelectedSegments() {
    if (selectedSegmentIndices.size === 0) return;
    if (confirm(`Bạn có chắc muốn xóa ${selectedSegmentIndices.size} phân cảnh đã chọn không?`)) {
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        const sortedIndices = Array.from(selectedSegmentIndices).sort((a, b) => b - a);
        sortedIndices.forEach(idx => {
            if (idx >= 0 && idx < mediaItems.length) {
                mediaItems.splice(idx, 1);
            }
        });
        if (typeof clearMultiSelection === 'function') clearMultiSelection();
        activeSegmentIndex = Math.max(0, Math.min(activeSegmentIndex, mediaItems.length - 1));
        if (typeof renderMediaList === 'function') renderMediaList();
    }
}

window.applyBatchDurationToSelected = applyBatchDurationToSelected;
window.applyBatchMotionToSelected = applyBatchMotionToSelected;
window.applyBatchTransitionToSelected = applyBatchTransitionToSelected;
window.deleteSelectedSegments = deleteSelectedSegments;

// Custom Motion Distribution Modal Logic
const btnOpenCustomMotionModal = document.getElementById('btn-open-custom-motion-modal');
const customMotionModal = document.getElementById('custom-motion-modal');
const btnMotionSelectAll = document.getElementById('btn-motion-select-all');
const btnMotionSelectZoomOnly = document.getElementById('btn-motion-select-zoomonly');
const btnMotionClearAll = document.getElementById('btn-motion-clear-all');
const btnApplyCustomMotionDist = document.getElementById('btn-apply-custom-motion-dist');
const motionDistPreviewRibbon = document.getElementById('motion-dist-preview-ribbon');
const motionDistCount = document.getElementById('motion-dist-count');
const motionDistPatternBadge = document.getElementById('motion-dist-pattern-badge');

function getSelectedMotionsList() {
    const checkboxes = document.querySelectorAll('input[name="selected-motion"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getActiveMotionDistMode() {
    const activeCard = document.querySelector('.dist-mode-card.active');
    return activeCard ? activeCard.dataset.mode : 'sequential';
}

function updateMotionCheckboxClasses() {
    document.querySelectorAll('.motion-check-item').forEach(item => {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
            item.classList.add('is-checked');
        } else {
            item.classList.remove('is-checked');
        }
    });
}

function renderMotionDistributionPreview() {
    if (!motionDistPreviewRibbon) return;
    const selectedMotions = getSelectedMotionsList();
    const mode = getActiveMotionDistMode();
    const imageItems = mediaItems.filter(i => i.type === 'image');
    
    if (motionDistCount) motionDistCount.innerText = imageItems.length;
    if (motionDistPatternBadge) {
        motionDistPatternBadge.innerText = mode === 'sequential' ? '🔁 Lần lượt chu kỳ' : '🎲 Xáo trộn ngẫu nhiên';
    }

    if (imageItems.length === 0) {
        motionDistPreviewRibbon.innerHTML = '<span class="text-xs text-dim">Chưa có ảnh nào trên Timeline để xem trước.</span>';
        return;
    }

    if (selectedMotions.length === 0) {
        motionDistPreviewRibbon.innerHTML = '<span class="text-xs text-danger">⚠️ Vui lòng chọn ít nhất 1 hiệu ứng ở trên!</span>';
        return;
    }

    let previewPlan = [];
    if (mode === 'sequential') {
        imageItems.forEach((_, idx) => {
            const motion = selectedMotions[idx % selectedMotions.length];
            previewPlan.push({ idx: idx + 1, motion });
        });
    } else {
        let lastM = '';
        imageItems.forEach((_, idx) => {
            let pool = selectedMotions.filter(m => m !== lastM);
            if (pool.length === 0) pool = selectedMotions;
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            previewPlan.push({ idx: idx + 1, motion: chosen });
            lastM = chosen;
        });
    }

    motionDistPreviewRibbon.innerHTML = previewPlan.map(p => `
        <div class="motion-pill-item">
            <span class="motion-pill-idx">Cảnh #${p.idx}</span>
            <span class="motion-pill-val">${getMotionShortName(p.motion)}</span>
        </div>
    `).join('');
}

function openCustomMotionModal() {
    if (!customMotionModal) return;
    customMotionModal.classList.remove('hidden');
    updateMotionCheckboxClasses();
    renderMotionDistributionPreview();
}

function closeCustomMotionModal() {
    if (customMotionModal) customMotionModal.classList.add('hidden');
}

window.openCustomMotionModal = openCustomMotionModal;
window.closeCustomMotionModal = closeCustomMotionModal;

if (btnOpenCustomMotionModal) {
    btnOpenCustomMotionModal.addEventListener('click', openCustomMotionModal);
}

document.querySelectorAll('input[name="selected-motion"]').forEach(cb => {
    cb.addEventListener('change', () => {
        updateMotionCheckboxClasses();
        renderMotionDistributionPreview();
    });
});

if (btnMotionSelectAll) {
    btnMotionSelectAll.addEventListener('click', () => {
        document.querySelectorAll('input[name="selected-motion"]').forEach(cb => cb.checked = true);
        updateMotionCheckboxClasses();
        renderMotionDistributionPreview();
    });
}

if (btnMotionSelectZoomOnly) {
    btnMotionSelectZoomOnly.addEventListener('click', () => {
        document.querySelectorAll('input[name="selected-motion"]').forEach(cb => {
            cb.checked = (cb.value === 'zoom_in' || cb.value === 'zoom_out');
        });
        updateMotionCheckboxClasses();
        renderMotionDistributionPreview();
    });
}

if (btnMotionClearAll) {
    btnMotionClearAll.addEventListener('click', () => {
        document.querySelectorAll('input[name="selected-motion"]').forEach(cb => cb.checked = false);
        updateMotionCheckboxClasses();
        renderMotionDistributionPreview();
    });
}

document.querySelectorAll('.dist-mode-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.dist-mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        renderMotionDistributionPreview();
    });
});

if (btnApplyCustomMotionDist) {
    btnApplyCustomMotionDist.addEventListener('click', () => {
        const selectedMotions = getSelectedMotionsList();
        if (selectedMotions.length === 0) {
            alert('⚠️ Vui lòng tích chọn ít nhất 1 hiệu ứng!');
            return;
        }

        const mode = getActiveMotionDistMode();
        let imageCount = 0;
        let lastMotion = '';
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();

        mediaItems.forEach(item => {
            if (item.type === 'image') {
                if (!item.settings) item.settings = {};
                let chosen = selectedMotions[0];

                if (mode === 'sequential') {
                    chosen = selectedMotions[imageCount % selectedMotions.length];
                } else {
                    let pool = selectedMotions.filter(m => m !== lastMotion);
                    if (pool.length === 0) pool = selectedMotions;
                    chosen = pool[Math.floor(Math.random() * pool.length)];
                    lastMotion = chosen;
                }

                item.settings.motion = chosen;
                imageCount++;
            }
        });

        if (imageCount > 0) {
            if (typeof renderMediaList === 'function') renderMediaList();
            closeCustomMotionModal();
            const modeText = mode === 'sequential' ? 'lần lượt xoay vòng' : 'xáo trộn ngẫu nhiên';
            alert(`✨ Đã áp dụng phân bổ ${modeText} cho toàn bộ ${imageCount} ảnh trên Timeline!`);
        } else {
            alert('⚠️ Chưa có ảnh nào trên Timeline để áp dụng!');
        }
    });
}
