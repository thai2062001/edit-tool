// =========================================================================
// TIMELINE STORYBOARD RIBBON & QUICK INSPECTOR (MODULE 3: timeline.js)
// =========================================================================

let draggedIndex = null;
let isUpdatingInspector = false;

// DOM Elements
const mediaList = document.getElementById('media-list');
const emptyState = document.getElementById('empty-state');
const itemCountEl = document.getElementById('item-count');
const totalDurationEl = document.getElementById('total-est-duration');
const btnRenderAll = document.getElementById('btn-render-all');

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
        if (emptyState) emptyState.classList.remove('hidden');
        if (mediaList) {
            mediaList.innerHTML = '';
            if (emptyState) mediaList.appendChild(emptyState);
        }
        if (btnRenderAll) btnRenderAll.disabled = true;
        if (itemCountEl) itemCountEl.innerText = '0';
        if (totalDurationEl) totalDurationEl.innerText = '0.0s';
        if (typeof updateWorkflowStep === 'function') updateWorkflowStep(1);
        if (quickInspector) quickInspector.classList.add('hidden');
        if (typeof clearMultiSelection === 'function') clearMultiSelection();
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (mediaList) mediaList.innerHTML = '';
    if (btnRenderAll) btnRenderAll.disabled = false;
    if (itemCountEl) itemCountEl.innerText = mediaItems.length;
    if (typeof updateWorkflowStep === 'function') updateWorkflowStep(2);

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

        const isMultiSelected = selectedSegmentIndices.has(index);

        const card = document.createElement('div');
        card.className = `storyboard-card ${index === activeSegmentIndex ? 'active' : ''} ${isPlaceholder ? 'is-placeholder' : ''} ${isMultiSelected ? 'is-multi-selected' : ''}`;
        card.dataset.index = index;
        card.setAttribute('draggable', 'true');

        // Drag and Drop Event Listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        // Click to select (Single / Multi Select with Ctrl / Shift)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-card-upload-img')) return; // Handled separately
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                if (typeof toggleMultiSelectIndex === 'function') {
                    toggleMultiSelectIndex(index, e.ctrlKey || e.metaKey, e.shiftKey);
                }
            } else {
                if (typeof clearMultiSelection === 'function') clearMultiSelection();
                selectSegment(index);
            }
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
                    <div class="placeholder-btn-group">
                        <button type="button" class="placeholder-btn-mini btn-card-ai-pick-img" data-index="${index}" title="Nhờ Gemini AI quét kho ảnh chọn ảnh khớp nhất">✨ AI Lựa</button>
                        <button type="button" class="placeholder-btn-mini btn-card-upload-img" data-index="${index}" title="Tải ảnh từ máy">📤 Tải</button>
                    </div>
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
        if (mediaList) mediaList.appendChild(card);
    });

    // Attach inline upload and AI pick listeners for placeholder cards
    if (mediaList) {
        mediaList.querySelectorAll('.btn-card-upload-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                uploadImageForSegment(idx);
            });
        });

        mediaList.querySelectorAll('.btn-card-ai-pick-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                autoPickImageForSegment(idx);
            });
        });
    }

    if (totalDurationEl) totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
    
    // Update Quick Inspector & Studio Canvas Player
    selectSegment(activeSegmentIndex, false);
    if (typeof triggerAutoSave === 'function') triggerAutoSave();
    if (typeof updateMultiSelectUI === 'function') updateMultiSelectUI();
}

// Expose renderMediaList to window
window.renderMediaList = renderMediaList;

function commitCurrentInspectorSettings() {
    if (activeSegmentIndex < 0 || activeSegmentIndex >= mediaItems.length) return;
    const item = mediaItems[activeSegmentIndex];
    if (!item) return;
    if (!item.settings) item.settings = {};

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
    const inspTextFont = document.getElementById('insp-textfont');
    const inspTextPos = document.getElementById('insp-textpos');
    const inspTextStyle = document.getElementById('insp-textstyle');
    const inspTextSize = document.getElementById('insp-textsize');
    const inspTextColor = document.getElementById('insp-textcolor');
    const inspTextAccent = document.getElementById('insp-textaccent');
    const activeAlignBtn = document.querySelector('.btn-align-option.active');

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
    if (inspTextFont) item.settings.fontFamily = inspTextFont.value;
    if (inspTextPos) item.settings.textPosition = inspTextPos.value;
    if (inspTextStyle) item.settings.textStyle = inspTextStyle.value;
    if (inspTextSize) item.settings.fontSize = parseInt(inspTextSize.value) || 48;
    if (inspTextColor) item.settings.textColor = inspTextColor.value;
    if (inspTextAccent) item.settings.textAccent = inspTextAccent.value;
    if (activeAlignBtn) item.settings.textAlign = activeAlignBtn.dataset.align || 'center';
}

function selectSegment(index, shouldScroll = true) {
    if (index < 0 || index >= mediaItems.length) return;
    if (index !== activeSegmentIndex) {
        commitCurrentInspectorSettings();
        if (typeof isStudioPlayingSingle !== 'undefined' && isStudioPlayingSingle) {
            isStudioPlayingSingle = false;
            const btnScene = document.getElementById('studio-btn-play-scene');
            if (btnScene) btnScene.innerHTML = '🔁 Xem Cảnh Này';
            if (typeof studioAudio !== 'undefined') studioAudio.pause();
        }
    }
    activeSegmentIndex = index;

    // Highlight card
    if (mediaList) {
        const cards = mediaList.querySelectorAll('.storyboard-card');
        cards.forEach((c, idx) => {
            if (idx === index) {
                c.classList.add('active');
                if (shouldScroll) {
                    const ribbonRect = mediaList.getBoundingClientRect();
                    const cardRect = c.getBoundingClientRect();
                    const scrollLeftTarget = mediaList.scrollLeft + (cardRect.left - ribbonRect.left) - (ribbonRect.width / 2) + (cardRect.width / 2);
                    mediaList.scrollTo({ left: scrollLeftTarget, behavior: 'smooth' });
                }
            } else {
                c.classList.remove('active');
            }
        });
    }

    updateQuickInspector(index);
    if (typeof drawStudioCanvasFrame === 'function') {
        drawStudioCanvasFrame(index, 0);
    }

    // Sync timeline position and scrubber when user clicks on a storyboard card
    if (!isStudioPlayingAll && !isStudioPlayingSingle && typeof getSceneAudioRange === 'function') {
        const range = getSceneAudioRange(index);
        currentStudioTimelineTimeMs = range.startTime * 1000;
        const totalDur = typeof getTotalTimelineDurationSec === 'function' ? getTotalTimelineDurationSec() : 0;
        const studioScrubber = document.getElementById('studio-scrubber');
        const scrubberTime = document.getElementById('studio-scrubber-time');
        if (studioScrubber && totalDur > 0) {
            studioScrubber.value = ((range.startTime / totalDur) * 100).toFixed(1);
        }
        if (scrubberTime && totalDur > 0) {
            const curMin = Math.floor(range.startTime / 60);
            const curSecInt = Math.floor(range.startTime % 60);
            const totMin = Math.floor(totalDur / 60);
            const totSecInt = Math.floor(totalDur % 60);
            scrubberTime.innerText = `${curMin}:${curSecInt.toString().padStart(2, '0')} / ${totMin}:${totSecInt.toString().padStart(2, '0')}`;
        }
    }
}

function updateQuickInspector(index) {
    const quickInspector = document.getElementById('quick-inspector');
    const item = mediaItems[index];
    if (!item) {
        if (quickInspector) quickInspector.classList.add('hidden');
        return;
    }
    if (quickInspector) quickInspector.classList.remove('hidden');

    isUpdatingInspector = true;
    try {
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
        const btnInspAiPickPlaceholder = document.getElementById('btn-insp-ai-pick-placeholder');
        if (btnInspAiPickPlaceholder) {
            btnInspAiPickPlaceholder.onclick = () => autoPickImageForSegment(index);
        }

        const isImage = item.type === 'image';
        if (inspImageControls) inspImageControls.classList.toggle('hidden', !isImage);
        if (inspVideoControls) inspVideoControls.classList.toggle('hidden', isImage);

        // Sync input values
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
        const inspTextFont = document.getElementById('insp-textfont');
        const inspTextPos = document.getElementById('insp-textpos');
        const inspTextStyle = document.getElementById('insp-textstyle');
        const inspTextSize = document.getElementById('insp-textsize');
        const inspTextColor = document.getElementById('insp-textcolor');
        const inspTextAccent = document.getElementById('insp-textaccent');

        if (inspTransition) inspTransition.value = item.settings?.transition || 'fade_black';

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
        if (inspTextFont) inspTextFont.value = item.settings?.fontFamily || 'Outfit';
        if (inspTextPos) inspTextPos.value = item.settings?.textPosition || 'bottom';
        if (inspTextStyle) inspTextStyle.value = item.settings?.textStyle || 'banner';
        if (inspTextSize) inspTextSize.value = item.settings?.fontSize || 48;
        if (inspTextColor) inspTextColor.value = item.settings?.textColor || '#FFFFFF';
        if (inspTextAccent) inspTextAccent.value = item.settings?.textAccent || '#06B6D4';

        const align = item.settings?.textAlign || 'center';
        document.querySelectorAll('.btn-align-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === align);
        });

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
    } finally {
        isUpdatingInspector = false;
    }
}

// Drag and drop handling on cards
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
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
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

function moveToTop(index) {
    if (index <= 0 || index >= mediaItems.length) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const item = mediaItems.splice(index, 1)[0];
    mediaItems.unshift(item);
    renderMediaList();
}

function moveToBottom(index) {
    if (index < 0 || index >= mediaItems.length - 1) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const item = mediaItems.splice(index, 1)[0];
    mediaItems.push(item);
    renderMediaList();
}

function moveItem(index, dir) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= mediaItems.length) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const temp = mediaItems[index];
    mediaItems[index] = mediaItems[newIdx];
    mediaItems[newIdx] = temp;
    renderMediaList();
}

function duplicateItem(index) {
    if (!mediaItems[index]) return;
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const clone = JSON.parse(JSON.stringify(mediaItems[index]));
    clone.originalName = clone.originalName + ' (Bản sao)';
    mediaItems.splice(index + 1, 0, clone);
    activeSegmentIndex = index + 1;
    renderMediaList();
}

function removeItem(index) {
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    mediaItems.splice(index, 1);
    renderMediaList();
}

function updateItemSetting(index, key, val) {
    if (mediaItems[index] && mediaItems[index].settings) {
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        mediaItems[index].settings[key] = val;
        if (key === 'duration' || key === 'trimStart' || key === 'trimEnd') {
            let totalDur = 0;
            mediaItems.forEach(item => {
                const isImage = item.type === 'image';
                const dur = isImage ? item.settings.duration : (item.settings.trimEnd - item.settings.trimStart);
                totalDur += Math.max(0.5, dur);
            });
            if (totalDurationEl) totalDurationEl.innerText = `${totalDur.toFixed(1)}s`;
        }
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    }
}
window.updateItemSetting = updateItemSetting;

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
                    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
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

// Auto-pick best matching image from library pool via Gemini AI for a specific placeholder segment
async function autoPickImageForSegment(itemIndex) {
    const targetItem = mediaItems[itemIndex];
    if (!targetItem) return;

    // Collect all valid images in library
    let pool = [];
    if (window.libraryPool && Array.isArray(window.libraryPool) && window.libraryPool.length > 0) {
        pool = window.libraryPool;
    } else if (typeof libraryImages !== 'undefined' && Array.isArray(libraryImages) && libraryImages.length > 0) {
        pool = libraryImages;
    } else {
        pool = mediaItems.filter(i => i.type === 'image' && !i.isPlaceholder && i.filename);
    }

    if (pool.length === 0) {
        alert('Chưa có ảnh nào trong kho tải lên để Gemini lựa chọn! Vui lòng tải ít nhất 1 ảnh lên hoặc bấm "Nạp Mẫu Thử Nghiệm".');
        return;
    }

    const sceneText = targetItem.settings?.overlayText || targetItem.originalName || `Phân cảnh ${itemIndex + 1}`;
    const key = (typeof inputGeminiKey !== 'undefined' && inputGeminiKey) ? inputGeminiKey.value.trim() : '';

    const btnInspAiPick = document.getElementById('btn-insp-ai-pick-placeholder');
    if (btnInspAiPick) {
        btnInspAiPick.disabled = true;
        btnInspAiPick.innerHTML = '⏳ Gemini Đang Lựa Ảnh...';
    }

    try {
        const res = await fetch('/api/ai/auto-pick-library-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sceneIndex: itemIndex + 1,
                sceneText: sceneText,
                libraryPool: pool,
                currentTimelineItems: mediaItems,
                customApiKey: key
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.selectedImage) {
            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            targetItem.filename = data.selectedImage.filename;
            targetItem.originalName = data.selectedImage.originalName;
            targetItem.url = data.selectedImage.url;
            targetItem.type = 'image';
            targetItem.isPlaceholder = false;
            
            renderMediaList();
            selectSegment(itemIndex);

            alert(`✨ Gemini AI đã chọn ảnh: "${data.selectedImage.originalName}" (Độ khớp: ${data.matchScore}%)\n\n💡 Lý do: ${data.reason}`);
        } else {
            throw new Error('Không tìm thấy ảnh phù hợp trong kho');
        }

    } catch (err) {
        alert('Lỗi khi nhờ Gemini lựa ảnh: ' + err.message);
    } finally {
        if (btnInspAiPick) {
            btnInspAiPick.disabled = false;
            btnInspAiPick.innerHTML = '✨ Gemini Lựa Ảnh Trong Kho';
        }
    }
}

// Expose functions to window
window.uploadImageForSegment = uploadImageForSegment;
window.autoPickImageForSegment = autoPickImageForSegment;

// ==========================================
// Video Trimmer & Splitter Modal Logic
// ==========================================
let currentTrimItemIndex = -1;
let trimVideoDuration = 10;
let trimStartSec = 0;
let trimEndSec = 5;
let isPreviewLoopActive = false;
let isDraggingTrimHandle = null;

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

        if (trimmerPlayhead && trimVideoDuration > 0) {
            const pct = Math.max(0, Math.min(100, (cur / trimVideoDuration) * 100));
            trimmerPlayhead.style.left = `${pct}%`;
        }

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

window.adjustTrimTime = adjustTrimTime;
window.openTrimmerModal = openTrimmerModal;
window.closeTrimmerModal = closeTrimmerModal;

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

['m05', 'm01', 'p01', 'p05'].forEach(btnKey => {
    const val = btnKey === 'm05' ? -0.5 : (btnKey === 'm01' ? -0.1 : (btnKey === 'p01' ? 0.1 : 0.5));
    const btnS = document.getElementById(`btn-trim-start-${btnKey}`);
    if (btnS) btnS.addEventListener('click', () => adjustTrimTime('start', val));
    const btnE = document.getElementById(`btn-trim-end-${btnKey}`);
    if (btnE) btnE.addEventListener('click', () => adjustTrimTime('end', val));
});

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

if (btnTrimmerApply) {
    btnTrimmerApply.addEventListener('click', () => {
        if (currentTrimItemIndex < 0 || currentTrimItemIndex >= mediaItems.length) return;
        const item = mediaItems[currentTrimItemIndex];
        
        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        item.settings.trimStart = parseFloat(trimStartSec.toFixed(2));
        item.settings.trimEnd = parseFloat(trimEndSec.toFixed(2));
        item.duration = parseFloat((trimEndSec - trimStartSec).toFixed(2));

        renderMediaList();
        closeTrimmerModal();
    });
}

if (btnTrimmerSplit) {
    btnTrimmerSplit.addEventListener('click', () => {
        if (currentTrimItemIndex < 0 || currentTrimItemIndex >= mediaItems.length) return;
        const curTime = trimmerVideoPlayer ? trimmerVideoPlayer.currentTime : (trimStartSec + (trimEndSec - trimStartSec)/2);
        
        if (curTime <= trimStartSec + 0.3 || curTime >= trimEndSec - 0.3) {
            alert('Vị trí cắt phải nằm ở giữa điểm Bắt đầu và Kết thúc (cách ít nhất 0.3s)! Hãy kéo con trỏ video vào vị trí muốn tách.');
            return;
        }

        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
        const originalItem = mediaItems[currentTrimItemIndex];
        
        const seg1Settings = JSON.parse(JSON.stringify(originalItem.settings));
        seg1Settings.trimStart = trimStartSec;
        seg1Settings.trimEnd = parseFloat(curTime.toFixed(2));

        originalItem.settings = seg1Settings;
        originalItem.duration = parseFloat((curTime - trimStartSec).toFixed(2));

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

        mediaItems.splice(currentTrimItemIndex + 1, 0, seg2Item);

        renderMediaList();
        closeTrimmerModal();
        alert(`✅ Đã tách video thành công thành 2 đoạn riêng biệt trên Timeline!\n- Đoạn 1: ${trimStartSec.toFixed(1)}s -> ${curTime.toFixed(1)}s\n- Đoạn 2: ${curTime.toFixed(1)}s -> ${trimEndSec.toFixed(1)}s`);
    });
}

if (btnOpenTrimmerModal) {
    btnOpenTrimmerModal.addEventListener('click', () => {
        openTrimmerModal(activeSegmentIndex);
    });
}

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

    trimmerTimelineTrack.addEventListener('click', (e) => {
        if (e.target.closest('.trimmer-handle')) return;
        const rect = trimmerTimelineTrack.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const timeAtPos = (offsetX / rect.width) * trimVideoDuration;
        if (trimmerVideoPlayer) trimmerVideoPlayer.currentTime = timeAtPos;
    });
}
