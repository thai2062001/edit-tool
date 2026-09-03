// =========================================================================
// PROJECT EXPORT, IMPORT & RENDER SUITE (MODULE 6: export-render.js)
// =========================================================================

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
    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const items = project.mediaItems || (Array.isArray(project) ? project : []);
    mediaItems = items;
    window.mediaItems = items;
    if (project.bgmTrack) {
        bgmTrack = project.bgmTrack;
        window.bgmTrack = bgmTrack;
        if (typeof updateBgmUI === 'function') updateBgmUI();
    }
    if (project.currentSettings) {
        currentSettings = { ...currentSettings, ...project.currentSettings };
        window.currentSettings = currentSettings;
        
        document.querySelectorAll('.ratio-option').forEach(o => {
            o.classList.toggle('active', o.dataset.ratio === currentSettings.ratio);
        });
        const selectExportQuality = document.getElementById('select-export-quality');
        if (selectExportQuality && currentSettings.qualityPreset) {
            selectExportQuality.value = currentSettings.qualityPreset;
        }
        const selectReframeMode = document.getElementById('select-reframe-mode');
        if (selectReframeMode && currentSettings.reframeMode) {
            selectReframeMode.value = currentSettings.reframeMode;
        }
        const selectFpsEl = document.getElementById('select-fps');
        if (selectFpsEl && currentSettings.fps) {
            selectFpsEl.value = currentSettings.fps;
        }
        if (typeof updateReframeVisibility === 'function') updateReframeVisibility(currentSettings.ratio);
        if (typeof updateStudioCanvasAspectRatio === 'function') updateStudioCanvasAspectRatio();
    }
    if (typeof renderMediaList === 'function') renderMediaList();
}

window.exportProjectToFile = exportProjectToFile;
window.importProjectFromFile = importProjectFromFile;
window.applyLoadedProject = applyLoadedProject;

// ==========================================
// RENDER VIDEO WITH FFMPEG & SSE MODAL
// ==========================================
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
const btnRenderAllEl = document.getElementById('btn-render-all');

let currentEventSource = null;

if (btnRenderAllEl) {
    btnRenderAllEl.addEventListener('click', async () => {
        if (mediaItems.length === 0) return;

        const placeholderCount = mediaItems.filter(i => i.isPlaceholder).length;
        if (placeholderCount > 0) {
            const confirmRender = confirm(`⚠️ Hiện còn ${placeholderCount} phân cảnh trên Timeline chưa được bù ảnh (đang là thẻ giữ chỗ viền vàng).\n\nNếu tiếp tục, những cảnh này sẽ hiển thị nền tối kèm chữ phụ đề kịch bản.\n\nBạn có muốn tiếp tục xuất video không?`);
            if (!confirmRender) return;
        }

        if (typeof updateWorkflowStep === 'function') updateWorkflowStep(3);
        if (renderModal) renderModal.classList.remove('hidden');
        if (renderStateProcessing) renderStateProcessing.classList.remove('hidden');
        if (renderStateCompleted) renderStateCompleted.classList.add('hidden');
        if (renderStateError) renderStateError.classList.add('hidden');
        if (renderPercent) renderPercent.innerText = '0%';
        if (renderProgressBar) renderProgressBar.style.width = '0%';
        if (renderStatusText) renderStatusText.innerText = 'Đang khởi chạy FFmpeg filter graph (zoompan + fade + transitions + concat)...';

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

            if (currentEventSource) currentEventSource.close();
            currentEventSource = new EventSource(`/api/progress/${data.jobId}`);

            currentEventSource.onmessage = (event) => {
                const update = JSON.parse(event.data);
                if (update.progress !== undefined) {
                    if (renderPercent) renderPercent.innerText = `${update.progress}%`;
                    if (renderProgressBar) renderProgressBar.style.width = `${update.progress}%`;
                    if (renderStatusText) renderStatusText.innerText = `Đang xử lý xuất video... (${update.progress}%)`;
                }

                if (update.status === 'completed') {
                    currentEventSource.close();
                    if (renderStateProcessing) renderStateProcessing.classList.add('hidden');
                    if (renderStateCompleted) renderStateCompleted.classList.remove('hidden');
                    if (renderedVideoPlayer) renderedVideoPlayer.src = update.outputUrl;
                    if (btnDownloadVideo) btnDownloadVideo.href = update.outputUrl;
                } else if (update.status === 'failed') {
                    currentEventSource.close();
                    if (renderStateProcessing) renderStateProcessing.classList.add('hidden');
                    if (renderStateError) renderStateError.classList.remove('hidden');
                    if (renderErrorMsg) renderErrorMsg.innerText = update.error || 'FFmpeg render thất bại';
                }
            };

            currentEventSource.onerror = () => {
                currentEventSource.close();
            };

        } catch (err) {
            if (renderStateProcessing) renderStateProcessing.classList.add('hidden');
            if (renderStateError) renderStateError.classList.remove('hidden');
            if (renderErrorMsg) renderErrorMsg.innerText = err.message;
        }
    });
}

function closeRenderModal() {
    if (renderModal) renderModal.classList.add('hidden');
    if (renderedVideoPlayer) renderedVideoPlayer.pause();
    if (currentEventSource) currentEventSource.close();
}
window.closeRenderModal = closeRenderModal;

// Sample Demo Generation
const btnSampleDemoEl = document.getElementById('btn-sample-demo');
if (btnSampleDemoEl) {
    btnSampleDemoEl.addEventListener('click', async () => {
        btnSampleDemoEl.disabled = true;
        btnSampleDemoEl.innerHTML = '<span class="icon">⏳</span> Đang tạo mẫu demo...';

        try {
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

                const grad = c.createLinearGradient(0, 0, 1920, 1080);
                grad.addColorStop(0, s.gradient[0]);
                grad.addColorStop(1, s.gradient[1]);
                c.fillStyle = grad;
                c.fillRect(0, 0, 1920, 1080);

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

            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            mediaItems = [...mediaItems, ...uploadedSamples];
            window.mediaItems = mediaItems;
            if (typeof renderMediaList === 'function') renderMediaList();

        } catch (err) {
            alert('Lỗi tạo demo: ' + err.message);
        } finally {
            btnSampleDemoEl.disabled = false;
            btnSampleDemoEl.innerHTML = '<span class="icon">✨</span> Nạp Mẫu Thử Nghiệm';
        }
    });
}
