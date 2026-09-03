// =========================================================================
// STUDIO CANVAS PLAYER & RENDER ENGINE (MODULE 2: studio-player.js)
// =========================================================================

const studioAudio = new Audio();
window.studioAudio = studioAudio;
let lastStudioPlayTick = 0;

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
        // Render real video clip frame onto Canvas
        let vid = studioLoadedVideos.get(item.url);
        if (!vid) {
            vid = document.createElement('video');
            vid.crossOrigin = 'anonymous';
            vid.src = item.url;
            vid.preload = 'auto';
            vid.muted = true;
            vid.playsInline = true;
            
            // Force redraw as soon as video frame is decoded or seek completes
            const onFrameReady = () => {
                if (activeSegmentIndex === index && !isStudioPlayingAll && !isStudioPlayingSingle) {
                    drawStudioCanvasFrame(index, progress);
                }
            };
            vid.addEventListener('loadeddata', onFrameReady);
            vid.addEventListener('seeked', onFrameReady);
            vid.addEventListener('canplay', onFrameReady);

            studioLoadedVideos.set(item.url, vid);
        }

        const trimStart = parseFloat(item.settings?.trimStart || 0);
        const targetVideoTime = trimStart + (progress * dur);

        // Keep video frame synchronized with canvas progress
        if (Math.abs(vid.currentTime - targetVideoTime) > 0.1 && !vid.seeking) {
            try {
                vid.currentTime = targetVideoTime;
            } catch (e) {}
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (vid.readyState >= 2) {
            const vidW = vid.videoWidth || canvas.width;
            const vidH = vid.videoHeight || canvas.height;
            const vidRatio = vidW / vidH;
            const canvasRatio = canvas.width / canvas.height;

            let sx = 0, sy = 0, sWidth = vidW, sHeight = vidH;
            if (vidRatio > canvasRatio) {
                sWidth = vidH * canvasRatio;
                sx = (vidW - sWidth) / 2;
            } else {
                sHeight = vidW / canvasRatio;
                sy = (vidH - sHeight) / 2;
            }

            ctx.drawImage(vid, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
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

        // Render Text Overlay if available
        const overlayText = item.settings?.overlayText?.trim();
        if (overlayText) {
            const textPos = item.settings?.textPosition || 'bottom';
            const textStyle = item.settings?.textStyle || 'banner';
            const fontSize = Number(item.settings?.fontSize || 48);
            renderCanvasTextOverlay(ctx, canvas, overlayText, textPos, textStyle, fontSize);
        }
    }
}

function renderImageFrameOnCanvas(ctx, canvas, item, img, progress) {
    const motion = item.settings.motion || 'zoom_in';
    const zoomIntensity = Math.max(1.05, Math.min(2.0, Number(item.settings.zoomIntensity || 1.25)));
    const delta = zoomIntensity - 1.0;
    const dur = Number(item.settings.duration || 5.0);
    const fadeIn = Number(item.settings.fadeIn || 0);
    const fadeOut = Number(item.settings.fadeOut || 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate smart aspect-ratio cover crop coordinates matching FFmpeg preScaleFilter
    const imgW = img.naturalWidth || img.width || canvas.width;
    const imgH = img.naturalHeight || img.height || canvas.height;
    const imgRatio = imgW / imgH;
    const canvasRatio = canvas.width / canvas.height;

    let sx = 0, sy = 0, sWidth = imgW, sHeight = imgH;
    if (imgRatio > canvasRatio) {
        sWidth = imgH * canvasRatio;
        sx = (imgW - sWidth) / 2;
    } else {
        sHeight = imgW / canvasRatio;
        sy = (imgH - sHeight) / 2;
    }

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

    // Apply Transition / Fade effects smoothly on canvas
    const currentTime = progress * dur;
    let alpha = 1.0;
    const transition = item.settings?.transition || (fadeIn > 0 ? 'fade_black' : 'none');
    
    // Transition offsets / extra transforms
    let transOffsetX = 0;
    let transOffsetY = 0;
    let transScale = 1.0;
    let flashWhiteOpacity = 0.0;

    if (fadeIn > 0 && currentTime < fadeIn) {
        const transProgress = currentTime / fadeIn; // 0.0 -> 1.0
        
        if (transition === 'flash_white') {
            alpha = Math.min(1.0, transProgress * 1.5);
            flashWhiteOpacity = Math.max(0, 1.0 - transProgress);
        } else if (transition === 'slide_left') {
            transOffsetX = (1.0 - transProgress) * canvas.width;
            alpha = transProgress;
        } else if (transition === 'slide_right') {
            transOffsetX = -(1.0 - transProgress) * canvas.width;
            alpha = transProgress;
        } else if (transition === 'slide_up') {
            transOffsetY = (1.0 - transProgress) * canvas.height;
            alpha = transProgress;
        } else if (transition === 'zoom_transition') {
            transScale = 0.6 + (0.4 * transProgress);
            alpha = transProgress;
        } else if (transition === 'wipe_left') {
            alpha = transProgress;
        } else {
            // fade_black or default
            alpha = Math.min(alpha, Math.max(0, transProgress));
        }
    }

    if (fadeOut > 0 && currentTime > dur - fadeOut) {
        alpha = Math.min(alpha, Math.max(0, (dur - currentTime) / fadeOut));
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
    ctx.translate(canvas.width / 2 + transOffsetX, canvas.height / 2 + transOffsetY);
    ctx.scale(zoom * transScale, zoom * transScale);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -canvas.width / 2 + offsetX, -canvas.height / 2 + offsetY, canvas.width, canvas.height);
    ctx.restore();

    // Render Flash White overlay if active
    if (flashWhiteOpacity > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${flashWhiteOpacity.toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Render Text Overlay (Smart Auto Word-Wrap to prevent overflow)
    const overlayText = item.settings?.overlayText?.trim();
    if (overlayText) {
        const textPos = item.settings?.textPosition || 'bottom';
        const textStyle = item.settings?.textStyle || 'banner';
        const fontSize = Number(item.settings?.fontSize) || 48;
        renderCanvasTextOverlay(ctx, canvas, overlayText, textPos, textStyle, fontSize);
    }
}

function renderCanvasTextOverlay(ctx, canvas, overlayText, textPos, textStyle, fontSize) {
    if (!overlayText) return;
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

// Convert global timeline time (seconds) to scene index & scene progress (0..1)
function getSceneAtTimelineSec(targetSec) {
    if (mediaItems.length === 0) return { sceneIndex: 0, progress: 0, totalDuration: 0 };
    const totalDur = getTotalTimelineDurationSec();
    const clampedSec = Math.max(0, Math.min(totalDur, targetSec));

    let accumulated = 0;
    for (let i = 0; i < mediaItems.length; i++) {
        const it = mediaItems[i];
        const d = it.type === 'image' 
            ? Number(it.settings?.duration || 5.0) 
            : Math.max(0.5, Number(it.settings?.trimEnd || it.duration || 5) - Number(it.settings?.trimStart || 0));
        
        if (clampedSec < accumulated + d || i === mediaItems.length - 1) {
            const sceneProgress = d > 0 ? Math.max(0, Math.min(1.0, (clampedSec - accumulated) / d)) : 0;
            return { sceneIndex: i, progress: sceneProgress, totalDuration: totalDur, currentSec: clampedSec };
        }
        accumulated += d;
    }
    return { sceneIndex: mediaItems.length - 1, progress: 1.0, totalDuration: totalDur, currentSec: clampedSec };
}

// Main function to seek / scrub timeline anywhere
function seekToTimelinePosition(targetSec, shouldAutoScroll = true) {
    if (mediaItems.length === 0) return;
    const { sceneIndex, progress, totalDuration, currentSec } = getSceneAtTimelineSec(targetSec);
    
    currentStudioTimelineTimeMs = currentSec * 1000;
    lastStudioPlayTick = performance.now();

    // Select scene if changed
    if (sceneIndex !== activeSegmentIndex && typeof selectSegment === 'function') {
        selectSegment(sceneIndex, shouldAutoScroll);
    }

    // Draw canvas at exact progress
    drawStudioCanvasFrame(sceneIndex, progress);

    // Sync Audio BGM
    if (bgmTrack && bgmTrack.url) {
        try {
            if (Math.abs(studioAudio.currentTime - currentSec) > 0.25) {
                studioAudio.currentTime = currentSec;
            }
        } catch (e) {}
    }

    // Update scrubber UI
    const studioScrubber = document.getElementById('studio-scrubber');
    const scrubberTime = document.getElementById('studio-scrubber-time');

    if (studioScrubber && totalDuration > 0) {
        studioScrubber.value = ((currentSec / totalDuration) * 100).toFixed(1);
    }
    if (scrubberTime && totalDuration > 0) {
        const curMin = Math.floor(currentSec / 60);
        const curSecInt = Math.floor(currentSec % 60);
        const totMin = Math.floor(totalDuration / 60);
        const totSecInt = Math.floor(totalDuration % 60);
        scrubberTime.innerText = `${curMin}:${curSecInt.toString().padStart(2, '0')} / ${totMin}:${totSecInt.toString().padStart(2, '0')}`;
    }

    // Sync waveform playhead
    if (typeof updateWaveformPlayhead === 'function' && bgmTrack && bgmTrack.duration) {
        updateWaveformPlayhead(currentSec, bgmTrack.duration);
    }
}

function playStudioSequence() {
    if (isStudioPlayingSingle) {
        isStudioPlayingSingle = false;
        const btnScene = document.getElementById('studio-btn-play-scene');
        if (btnScene) btnScene.innerHTML = '🔁 Xem Cảnh Này';
    }

    if (isStudioPlayingAll) {
        isStudioPlayingAll = false;
        if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
        studioAudio.pause();
        const btn = document.getElementById('studio-btn-play');
        if (btn) btn.innerHTML = '▶ Phát Toàn Bộ';
        return;
    }

    if (mediaItems.length === 0) return;

    const totalDur = getTotalTimelineDurationSec();
    if (totalDur <= 0) return;

    // If at the end, restart from beginning
    if (currentStudioTimelineTimeMs >= totalDur * 1000 - 100) {
        currentStudioTimelineTimeMs = 0;
    }

    isStudioPlayingAll = true;
    const btn = document.getElementById('studio-btn-play');
    if (btn) btn.innerHTML = '⏸️ Tạm Dừng';

    lastStudioPlayTick = performance.now();

    if (bgmTrack && bgmTrack.url) {
        try {
            studioAudio.src = bgmTrack.url;
            studioAudio.currentTime = currentStudioTimelineTimeMs / 1000;
            studioAudio.volume = bgmTrack.volume ?? 1.0;
            studioAudio.play().catch(() => {});
        } catch (e) {}
    }

    function step(now) {
        if (!isStudioPlayingAll) return;
        const delta = now - lastStudioPlayTick;
        lastStudioPlayTick = now;

        currentStudioTimelineTimeMs += delta;
        const totalMs = totalDur * 1000;

        if (currentStudioTimelineTimeMs >= totalMs) {
            // Loop video playback from start smoothly
            currentStudioTimelineTimeMs = 0;
            if (bgmTrack && bgmTrack.url) {
                try {
                    studioAudio.currentTime = 0;
                    studioAudio.play().catch(() => {});
                } catch (e) {}
            }
        }

        const curSec = currentStudioTimelineTimeMs / 1000;
        const { sceneIndex, progress } = getSceneAtTimelineSec(curSec);

        if (sceneIndex !== activeSegmentIndex && typeof selectSegment === 'function') {
            selectSegment(sceneIndex, true);
        }
        drawStudioCanvasFrame(sceneIndex, progress);

        // Update scrubber UI
        const studioScrubber = document.getElementById('studio-scrubber');
        const scrubberTime = document.getElementById('studio-scrubber-time');
        if (studioScrubber && totalDur > 0) {
            studioScrubber.value = ((curSec / totalDur) * 100).toFixed(1);
        }
        if (scrubberTime && totalDur > 0) {
            const curMin = Math.floor(curSec / 60);
            const curSecInt = Math.floor(curSec % 60);
            const totMin = Math.floor(totalDur / 60);
            const totSecInt = Math.floor(totalDur % 60);
            scrubberTime.innerText = `${curMin}:${curSecInt.toString().padStart(2, '0')} / ${totMin}:${totSecInt.toString().padStart(2, '0')}`;
        }

        // Sync Audio Waveform Playhead
        if (typeof updateWaveformPlayhead === 'function' && bgmTrack && bgmTrack.duration) {
            updateWaveformPlayhead(curSec, bgmTrack.duration);
        }

        studioAnimFrame = requestAnimationFrame(step);
    }

    studioAnimFrame = requestAnimationFrame(step);
}

function playSingleScene() {
    if (isStudioPlayingAll) {
        isStudioPlayingAll = false;
        if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
        const btnAll = document.getElementById('studio-btn-play');
        if (btnAll) btnAll.innerHTML = '▶ Phát Toàn Bộ';
    }

    const btnScene = document.getElementById('studio-btn-play-scene');
    if (isStudioPlayingSingle) {
        isStudioPlayingSingle = false;
        if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
        studioAudio.pause();
        if (btnScene) btnScene.innerHTML = '🔁 Xem Cảnh Này';
        return;
    }

    if (!mediaItems[activeSegmentIndex]) return;

    if (studioAnimFrame) cancelAnimationFrame(studioAnimFrame);
    isStudioPlayingSingle = true;
    if (btnScene) btnScene.innerHTML = '⏸️ Tạm Dừng Cảnh';

    const item = mediaItems[activeSegmentIndex];
    const itemDur = (item.type === 'image' ? (item.settings?.duration || 5.0) : (item.duration || 5.0)) * 1000;
    const { startTime: audioStart } = getSceneAudioRange(activeSegmentIndex);

    // Play per-scene audio slice
    if (bgmTrack && bgmTrack.url) {
        try {
            studioAudio.src = bgmTrack.url;
            studioAudio.currentTime = audioStart;
            studioAudio.volume = bgmTrack.volume ?? 1.0;
            studioAudio.play().catch(() => {});
        } catch (e) {}
    }

    let cycleStartTime = performance.now();

    function step(now) {
        if (!isStudioPlayingSingle) return;
        const elapsed = now - cycleStartTime;

        if (elapsed >= itemDur) {
            // Loop restart for single scene preview
            cycleStartTime = performance.now();
            if (bgmTrack && bgmTrack.url) {
                try {
                    studioAudio.currentTime = audioStart;
                    studioAudio.play().catch(() => {});
                } catch (e) {}
            }
        }

        const progress = Math.min(1.0, Math.max(0, elapsed / itemDur));
        drawStudioCanvasFrame(activeSegmentIndex, progress);

        // Update scrubber & time during single scene playback
        const range = getSceneAudioRange(activeSegmentIndex);
        const currentPlaySec = range.startTime + (progress * range.duration);
        const totalTimelineDur = getTotalTimelineDurationSec();

        const scrubberTime = document.getElementById('studio-scrubber-time');
        const studioScrubber = document.getElementById('studio-scrubber');
        if (scrubberTime && totalTimelineDur > 0) {
            const curMin = Math.floor(currentPlaySec / 60);
            const curSec = Math.floor(currentPlaySec % 60);
            const totMin = Math.floor(totalTimelineDur / 60);
            const totSec = Math.floor(totalTimelineDur % 60);
            scrubberTime.innerText = `${curMin}:${curSec.toString().padStart(2, '0')} / ${totMin}:${totSec.toString().padStart(2, '0')}`;
        }
        if (studioScrubber && totalTimelineDur > 0) {
            studioScrubber.value = ((currentPlaySec / totalTimelineDur) * 100).toFixed(1);
        }

        studioAnimFrame = requestAnimationFrame(step);
    }

    studioAnimFrame = requestAnimationFrame(step);
}

// ==========================================
// LIVE CANVAS MOTION PREVIEW MODAL
// ==========================================
let previewAnimFrame = null;
let previewCurrentIndex = -1;
let previewImg = new Image();
let previewItemData = null;

function previewItemMotion(index) {
    const item = mediaItems[index];
    if (!item || item.type !== 'image') return;

    previewCurrentIndex = index;
    previewItemData = JSON.parse(JSON.stringify(item));

    const modalPreviewMotion = document.getElementById('modal-preview-motion');
    const modalPreviewDuration = document.getElementById('modal-preview-duration');
    const modalPreviewIntensity = document.getElementById('modal-preview-intensity');
    const modalPreviewFadeIn = document.getElementById('modal-preview-fadein');
    const modalPreviewFadeOut = document.getElementById('modal-preview-fadeout');
    const modalPreviewText = document.getElementById('modal-preview-text');
    const modalPreviewTextPos = document.getElementById('modal-preview-text-pos');
    const modalPreviewTextStyle = document.getElementById('modal-preview-text-style');
    const modalPreviewTextSize = document.getElementById('modal-preview-text-size');
    const previewEffectName = document.getElementById('preview-effect-name');
    const previewModal = document.getElementById('preview-modal');

    if (modalPreviewMotion) modalPreviewMotion.value = previewItemData.settings.motion || 'zoom_in';
    if (modalPreviewDuration) modalPreviewDuration.value = previewItemData.settings.duration || 5.0;
    if (modalPreviewIntensity) modalPreviewIntensity.value = previewItemData.settings.zoomIntensity || 1.25;
    if (modalPreviewFadeIn) modalPreviewFadeIn.value = previewItemData.settings.fadeIn ?? 0.8;
    if (modalPreviewFadeOut) modalPreviewFadeOut.value = previewItemData.settings.fadeOut ?? 0.8;
    if (modalPreviewText) modalPreviewText.value = previewItemData.settings.overlayText || '';
    if (modalPreviewTextPos) modalPreviewTextPos.value = previewItemData.settings.textPosition || 'bottom';
    if (modalPreviewTextStyle) modalPreviewTextStyle.value = previewItemData.settings.textStyle || 'banner';
    if (modalPreviewTextSize) modalPreviewTextSize.value = previewItemData.settings.fontSize || 48;

    if (previewEffectName) previewEffectName.innerText = (previewItemData.settings.motion || 'zoom_in').replace('_', ' ').toUpperCase();
    if (previewModal) previewModal.classList.remove('hidden');

    previewImg = new Image();
    previewImg.crossOrigin = 'anonymous';
    previewImg.src = item.url;
    previewImg.onload = () => {
        startPreviewAnimation();
    };
}

function startPreviewAnimation() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
    if (!previewItemData) return;

    const previewCanvas = document.getElementById('preview-canvas');
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    const previewTimeDisplay = document.getElementById('preview-time-display');

    const dur = previewItemData.settings.duration || 5.0;
    const fadeIn = previewItemData.settings.fadeIn || 0;
    const fadeOut = previewItemData.settings.fadeOut || 0;
    const motion = previewItemData.settings.motion || 'zoom_in';
    const zoomIntensity = previewItemData.settings.zoomIntensity || 1.25;
    const delta = zoomIntensity - 1.0;

    if (bgmTrack && bgmTrack.url && previewCurrentIndex >= 0) {
        const { startTime: audioStart } = getSceneAudioRange(previewCurrentIndex);
        try {
            studioAudio.src = bgmTrack.url;
            studioAudio.currentTime = audioStart;
            studioAudio.volume = bgmTrack.volume ?? 1.0;
            studioAudio.play().catch(() => {});
        } catch (e) {}
    }

    const startTime = performance.now();
    const totalMs = dur * 1000;

    function renderFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / totalMs);
        const currentSec = (progress * dur).toFixed(1);
        if (previewTimeDisplay) previewTimeDisplay.innerText = `${currentSec}s / ${dur}s`;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

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
        }

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

        const overlayText = previewItemData.settings.overlayText?.trim();
        if (overlayText) {
            const textPos = previewItemData.settings.textPosition || 'bottom';
            const textStyle = previewItemData.settings.textStyle || 'banner';
            const fontSize = Number(previewItemData.settings.fontSize) || 48;
            renderCanvasTextOverlay(ctx, previewCanvas, overlayText, textPos, textStyle, fontSize);
        }

        let alpha = 1.0;
        const timeSec = progress * dur;
        if (fadeIn > 0 && timeSec < fadeIn) {
            alpha = timeSec / fadeIn;
        } else if (fadeOut > 0 && timeSec > (dur - fadeOut)) {
            alpha = Math.max(0, (dur - timeSec) / fadeOut);
        }

        if (alpha < 1.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - alpha})`;
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        }

        if (progress < 1.0) {
            previewAnimFrame = requestAnimationFrame(renderFrame);
        } else {
            const previewModal = document.getElementById('preview-modal');
            setTimeout(() => {
                if (previewModal && !previewModal.classList.contains('hidden')) {
                    startPreviewAnimation();
                }
            }, 600);
        }
    }

    previewAnimFrame = requestAnimationFrame(renderFrame);
}

function closePreviewModal() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
    if (typeof studioAudio !== 'undefined') studioAudio.pause();
    const previewModal = document.getElementById('preview-modal');
    if (previewModal) previewModal.classList.add('hidden');
}

window.previewItemMotion = previewItemMotion;
window.startPreviewAnimation = startPreviewAnimation;
window.closePreviewModal = closePreviewModal;
