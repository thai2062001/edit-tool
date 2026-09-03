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

    if (timelineAuditModal) timelineAuditModal.classList.remove('hidden');
    if (timelineAuditLoading) timelineAuditLoading.classList.remove('hidden');
    if (timelineAuditResult) timelineAuditResult.classList.add('hidden');

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
    if (timelineAuditLoading) timelineAuditLoading.classList.add('hidden');
    if (timelineAuditResult) timelineAuditResult.classList.remove('hidden');

    const audit = data.audit || {};
    const stats = data.stats || {};

    const scoreVal = document.getElementById('audit-timeline-score-val');
    const verdictEl = document.getElementById('audit-timeline-verdict');
    const submetaEl = document.getElementById('audit-timeline-submeta');

    if (scoreVal) scoreVal.textContent = audit.overallScore || 85;
    if (verdictEl) verdictEl.textContent = audit.verdict || 'Video có cấu trúc hoàn chỉnh.';
    if (submetaEl) submetaEl.textContent = `Đã phân tích ${stats.itemCount || mediaItems.length} phân cảnh • Tổng thời lượng ${(stats.totalDuration || 0).toFixed(1)}s • ${stats.hasBgm ? 'Có nhạc nền' : 'Chưa có nhạc nền'}`;

    const cats = audit.categoryScores || {};
    setCategoryScore('script-alignment', cats.scriptAlignment || 85);
    setCategoryScore('pacing', cats.pacing || 80);
    setCategoryScore('visual-variety', cats.visualVariety || 75);
    setCategoryScore('audio-balance', cats.audioBalance || (stats.hasBgm ? 90 : 50));

    const strengthsUl = document.getElementById('audit-timeline-strengths');
    if (strengthsUl) {
        strengthsUl.innerHTML = (audit.strengths || ['Phân cảnh có bố cục rõ ràng.']).map(s => `<li>${escapeHtml(s)}</li>`).join('');
    }

    const warningsUl = document.getElementById('audit-timeline-warnings');
    if (warningsUl) {
        const list = (audit.warnings && audit.warnings.length > 0) ? audit.warnings : ['Không phát hiện lỗi nghiêm trọng nào.'];
        warningsUl.innerHTML = list.map(w => `<li>${escapeHtml(w)}</li>`).join('');
    }

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

window.openTimelineAuditModal = openTimelineAuditModal;
window.closeTimelineAuditModal = closeTimelineAuditModal;

// Script matching elements
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
const scriptStatsText = document.getElementById('script-stats-text');
const btnCleanScript = document.getElementById('btn-clean-script');

let currentAiMatchedScenes = [];
let aiModalSelectedAudioFile = null;
let aiModalMatchedAudioTrack = null;

const aiModalAudioFile = document.getElementById('ai-modal-audio-file');
const aiModalAudioStatus = document.getElementById('ai-modal-audio-status');
const btnAiUseCurrentBgm = document.getElementById('btn-ai-use-current-bgm');
const aiModalPauseInterval = document.getElementById('ai-modal-pause-interval');

if (aiModalAudioFile) {
    aiModalAudioFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            aiModalSelectedAudioFile = file;
            if (aiModalAudioStatus) {
                aiModalAudioStatus.innerHTML = `🎵 <strong>Đã chọn tệp:</strong> <span style="color: var(--accent-cyan);">${file.name}</span> (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            }
        }
    });
}

if (btnAiUseCurrentBgm) {
    btnAiUseCurrentBgm.addEventListener('click', () => {
        if (window.bgmTrack && window.bgmTrack.url) {
            aiModalSelectedAudioFile = null; // Use current bgm on server
            if (aiModalAudioStatus) {
                aiModalAudioStatus.innerHTML = `🎵 <strong>Đang dùng BGM Timeline:</strong> <span style="color: var(--accent-cyan);">${window.bgmTrack.originalName || 'BGM Track'}</span>`;
            }
        }
    });
}

if (btnOpenAiModal) {
    btnOpenAiModal.addEventListener('click', () => {
        const imgCount = mediaItems.filter(i => i.type === 'image').length;
        if (aiImageCount) aiImageCount.innerText = `${imgCount} ảnh`;
        if (btnAiUseCurrentBgm) {
            if (window.bgmTrack && window.bgmTrack.url) {
                btnAiUseCurrentBgm.classList.remove('hidden');
            } else {
                btnAiUseCurrentBgm.classList.add('hidden');
            }
        }
        if (aiModal) aiModal.classList.remove('hidden');
    });
}

function closeAiModal() {
    if (aiModal) aiModal.classList.add('hidden');
}
window.closeAiModal = closeAiModal;

// Toggle key visibility
if (btnToggleKeyVisibility && inputGeminiKey) {
    btnToggleKeyVisibility.addEventListener('click', () => {
        if (inputGeminiKey.type === 'password') {
            inputGeminiKey.type = 'text';
            btnToggleKeyVisibility.innerText = '🙈';
        } else {
            inputGeminiKey.type = 'password';
            btnToggleKeyVisibility.innerText = '👁️';
        }
    });
}

// Clean and group script into complete paragraphs
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
    if (!scriptTextarea || !scriptStatsText) return;
    const raw = scriptTextarea.value.trim();
    if (!raw) {
        scriptStatsText.innerText = 'Chưa có kịch bản';
        return;
    }
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    const paragraphs = raw.split(/\n\n+/).filter(p => p.trim().length > 0).length;
    scriptStatsText.innerHTML = `📊 Trạng thái: <strong>${lines} dòng</strong> | <strong>${paragraphs} phân đoạn</strong> (${raw.length} ký tự)`;
}

if (scriptTextarea) {
    scriptTextarea.addEventListener('input', updateScriptStats);
}

if (btnCleanScript && scriptTextarea) {
    btnCleanScript.addEventListener('click', () => {
        const raw = scriptTextarea.value;
        if (!raw.trim()) return;
        scriptTextarea.value = cleanAndGroupScript(raw);
        updateScriptStats();
    });
}

if (scriptFileInput && scriptTextarea) {
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
}

if (btnLoadSampleScript && scriptTextarea) {
    btnLoadSampleScript.addEventListener('click', () => {
        const sample = `Hãy tưởng tượng... Một buổi sáng, bạn thức dậy tại Seoul. Nhưng hôm nay có điều gì đó không đúng. Không còn tiếng xe cộ chen chúc trên những con đường đông đúc. Không còn ánh sáng từ những màn hình LED khổng lồ ở Myeongdong.

Không còn tiếng người gọi nhau trong những con phố vốn chưa bao giờ thực sự ngủ. Chỉ có tuyết. Tuyết phủ kín đường phố, phủ lên những chiếc xe đang nằm bất động, phủ lên những biển hiệu rực rỡ của Seoul.

Và bên ngoài cửa sổ... không có một bóng người. Nhiệt độ đã giảm xuống âm 40 độ C. Nhưng điều đáng sợ nhất không phải là cái lạnh, mà là việc nó không hề có dấu hiệu kết thúc. Ngày mai vẫn lạnh như hôm nay. Năm sau vẫn lạnh như năm nay. Và 100 năm sau... mùa đông vẫn chưa kết thúc.`;
        scriptTextarea.value = sample;
        updateScriptStats();
    });
}

// Run AI Match
if (btnRunAiMatch) {
    btnRunAiMatch.addEventListener('click', async () => {
        const script = scriptTextarea ? scriptTextarea.value.trim() : '';
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

        const key = inputGeminiKey ? inputGeminiKey.value.trim() : '';
        const pauseIntervalVal = aiModalPauseInterval ? parseFloat(aiModalPauseInterval.value) : 0.5;

        btnRunAiMatch.disabled = true;
        btnRunAiMatch.innerHTML = '<span class="icon">⏳</span> Gemini AI Đang Phân Tích Kịch Bản & Audio...';

        try {
            const formData = new FormData();
            formData.append('scriptText', script);
            formData.append('items', JSON.stringify(mediaItems));
            formData.append('customApiKey', key);
            formData.append('pauseInterval', pauseIntervalVal);

            if (aiModalSelectedAudioFile) {
                formData.append('audioFile', aiModalSelectedAudioFile);
            } else if (window.bgmTrack && window.bgmTrack.filename) {
                formData.append('bgmFilename', window.bgmTrack.filename);
                formData.append('bgmOriginalName', window.bgmTrack.originalName || '');
            }

            const res = await fetch('/api/ai/match-script', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.audioTrack) {
                aiModalMatchedAudioTrack = data.audioTrack;
            } else {
                aiModalMatchedAudioTrack = null;
            }

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
}

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
    if (!aiResultsContainer || !aiScenesList || !aiScenesCountBadge) return;
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

    aiScenesList.querySelectorAll('.btn-scene-upload').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sIdx = parseInt(btn.dataset.sceneIdx);
            uploadImageForAiScene(sIdx);
        });
    });
}

if (btnApplyAiTimeline) {
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
                cloned.settings.textPosition = cloned.settings.textPosition || 'bottom';
                cloned.settings.textStyle = cloned.settings.textStyle || 'banner';
                cloned.settings.fontSize = cloned.settings.fontSize || 48;
                cloned.isPlaceholder = false;
                newTimeline.push(cloned);
            } else {
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
            if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
            
            // Backup full original images pool for single-scene smart picking
            if (sourceItems && sourceItems.length > 0) {
                const originalImages = sourceItems.filter(i => i.type === 'image' && !i.isPlaceholder && i.filename);
                if (originalImages.length > 0) {
                    libraryPool = JSON.parse(JSON.stringify(originalImages));
                    window.libraryPool = libraryPool;
                }
            }

            mediaItems = newTimeline;
            window.mediaItems = newTimeline;

            // Automatically set matched Audio track into Timeline BGM if uploaded
            if (aiModalMatchedAudioTrack) {
                bgmTrack = {
                    filename: aiModalMatchedAudioTrack.filename,
                    originalName: aiModalMatchedAudioTrack.originalName,
                    url: aiModalMatchedAudioTrack.url,
                    duration: aiModalMatchedAudioTrack.duration,
                    volume: 0.8
                };
                window.bgmTrack = bgmTrack;
                if (typeof updateBgmUI === 'function') updateBgmUI();
            }

            if (typeof renderMediaList === 'function') renderMediaList();
            closeAiModal();
            
            let msg = `🎉 Đã áp dụng toàn bộ ${newTimeline.length} phân cảnh theo kịch bản & Audio vào Timeline!`;
            if (aiModalMatchedAudioTrack) {
                msg += `\n\n🎵 Đã đồng bộ & nạp Audio giọng đọc "${aiModalMatchedAudioTrack.originalName}" vào Timeline thành công.`;
            }
            if (placeholderCount > 0) {
                msg += `\n\nℹ️ Có ${placeholderCount} phân cảnh chưa có ảnh (thẻ viền vàng trên Timeline). Bạn có thể bấm trực tiếp vào nút "➕ Bù ảnh" trên từng thẻ để tải ảnh khớp vào đúng vị trí nhé!`;
            }
            alert(msg);
        } else {
            alert('Không có phân cảnh nào để đưa vào Timeline!');
        }
    });
}

// ==========================================
// AI SCRIPT & PACING AUDITOR CONTROLLER
// ==========================================
const btnAuditScriptPacing = document.getElementById('btn-audit-script-pacing');
const btnQuickPacingAudit = document.getElementById('btn-quick-pacing-audit');
const scriptPacingModal = document.getElementById('script-pacing-modal');
const pacingAuditLoading = document.getElementById('pacing-audit-loading');
const pacingAuditResult = document.getElementById('pacing-audit-result');
const btnApplyAllPacing = document.getElementById('btn-apply-all-pacing');
const btnApplyAllPacingFooter = document.getElementById('btn-apply-all-pacing-footer');

let currentPacingEvaluationScenes = [];

if (btnAuditScriptPacing) btnAuditScriptPacing.addEventListener('click', openScriptPacingModal);
if (btnQuickPacingAudit) btnQuickPacingAudit.addEventListener('click', openScriptPacingModal);

async function openScriptPacingModal() {
    if (mediaItems.length === 0) {
        alert('Chưa có phân cảnh nào trên timeline! Hãy thêm ảnh/video hoặc nạp mẫu demo trước.');
        return;
    }

    if (scriptPacingModal) scriptPacingModal.classList.remove('hidden');
    if (pacingAuditLoading) pacingAuditLoading.classList.remove('hidden');
    if (pacingAuditResult) pacingAuditResult.classList.add('hidden');

    const scriptText = document.getElementById('script-textarea') ? document.getElementById('script-textarea').value : '';
    const key = document.getElementById('input-gemini-key') ? document.getElementById('input-gemini-key').value.trim() : '';

    try {
        const res = await fetch('/api/ai/audit-script-pacing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: mediaItems,
                scriptText: scriptText,
                customApiKey: key
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        renderScriptPacingResult(data);
    } catch (err) {
        alert('Lỗi đánh giá nhịp điệu kịch bản: ' + err.message);
        closeScriptPacingModal();
    }
}

function renderScriptPacingResult(data) {
    if (pacingAuditLoading) pacingAuditLoading.classList.add('hidden');
    if (pacingAuditResult) pacingAuditResult.classList.remove('hidden');

    currentPacingEvaluationScenes = data.scenes || [];
    const stats = data.stats || {};

    const scoreVal = document.getElementById('pacing-score-val');
    const verdictEl = document.getElementById('pacing-verdict');
    const submetaEl = document.getElementById('pacing-submeta');
    const badgeFast = document.getElementById('badge-count-fast');
    const badgeSlow = document.getElementById('badge-count-slow');
    const badgeOptimal = document.getElementById('badge-count-optimal');
    const scenesList = document.getElementById('pacing-scenes-list');

    if (scoreVal) scoreVal.textContent = data.overallSyncScore || 90;
    if (verdictEl) verdictEl.textContent = data.summary || 'Nhịp điệu phân cảnh rất cân đối!';
    if (submetaEl) {
        submetaEl.textContent = `Phân tích ${stats.itemCount || mediaItems.length} phân cảnh • Thời lượng hiện tại: ${(stats.totalCurrentDuration || 0).toFixed(1)}s ➔ Đề xuất: ${(stats.totalSuggestedDuration || 0).toFixed(1)}s (${(stats.totalDiff || 0) >= 0 ? '+' : ''}${(stats.totalDiff || 0).toFixed(1)}s)`;
    }

    if (badgeFast) badgeFast.textContent = `⚡ ${stats.fastCount || 0} cảnh quá nhanh`;
    if (badgeSlow) badgeSlow.textContent = `🐢 ${stats.slowCount || 0} cảnh quá chậm`;
    if (badgeOptimal) badgeOptimal.textContent = `✅ ${stats.optimalCount || 0} cảnh chuẩn khớp`;

    if (!scenesList) return;
    scenesList.innerHTML = '';

    currentPacingEvaluationScenes.forEach((scene, sIdx) => {
        const card = document.createElement('div');
        const statusClass = scene.pacingStatus === 'too_fast' ? 'is-too-fast' : (scene.pacingStatus === 'too_slow' ? 'is-too-slow' : 'is-optimal');
        card.className = `pacing-scene-card ${statusClass}`;
        card.id = `pacing-card-${sIdx}`;

        const diffNum = scene.diffSeconds || 0;
        let diffBadgeHtml = '';
        if (diffNum > 0) {
            diffBadgeHtml = `<span class="pacing-diff-badge pacing-diff-plus">+${diffNum.toFixed(1)}s (Kéo dài)</span>`;
        } else if (diffNum < 0) {
            diffBadgeHtml = `<span class="pacing-diff-badge pacing-diff-minus">${diffNum.toFixed(1)}s (Rút ngắn)</span>`;
        } else {
            diffBadgeHtml = `<span class="pacing-diff-badge pacing-diff-zero">Khớp chuẩn</span>`;
        }

        const thumbSrc = scene.url || (scene.isPlaceholder ? '' : 'images/1_2k.jpg');
        const thumbHtml = scene.isPlaceholder || !thumbSrc
            ? `<div class="pacing-scene-thumb-wrap" style="display:flex;align-items:center;justify-content:center;background:#1E293B;"><span style="font-size:20px;">📷</span><span class="pacing-scene-idx-tag">#${scene.index}</span></div>`
            : `<div class="pacing-scene-thumb-wrap"><img src="${thumbSrc}" class="pacing-scene-thumb" alt="Scene ${scene.index}"><span class="pacing-scene-idx-tag">#${scene.index}</span></div>`;

        const motionLabel = getMotionShortName ? getMotionShortName(scene.motion) : (scene.motion || 'Zoom');
        const textPreview = scene.overlayText 
            ? `<div class="pacing-scene-text-preview">📜 "${escapeHtml(scene.overlayText)}"</div>`
            : `<div class="pacing-scene-text-preview text-dim" style="font-style:italic;">(Không có tiêu đề chữ / câu thoại)</div>`;

        card.innerHTML = `
            ${thumbHtml}
            <div class="pacing-scene-info">
                <div class="pacing-scene-title-row">
                    <span class="pacing-scene-title">Cảnh ${scene.index}: ${escapeHtml(scene.name)}</span>
                    <span class="storyboard-motion-tag">${motionLabel}</span>
                    ${scene.contentMatchScore ? `<span class="badge" style="background:rgba(56,189,248,0.15);color:#38BDF8;font-size:10px;">🎯 Khớp ${scene.contentMatchScore}%</span>` : ''}
                </div>
                ${textPreview}
                <div class="pacing-scene-reason">💡 ${escapeHtml(scene.reason || '')}</div>
            </div>
            <div class="pacing-scene-comparator">
                <div class="pacing-duration-diff-row">
                    <span class="pacing-cur-dur">${scene.currentDuration.toFixed(1)}s</span>
                    <span>➔</span>
                    <span class="pacing-sug-dur">${scene.suggestedDuration.toFixed(1)}s</span>
                    ${diffBadgeHtml}
                </div>
                <button type="button" class="btn btn-xs btn-outline btn-apply-single-pacing" onclick="applySingleScenePacing(${sIdx})">
                    ${diffNum === 0 ? '✓ Đã chuẩn' : '✅ Áp dụng cảnh này'}
                </button>
            </div>
        `;

        scenesList.appendChild(card);
    });
}

function applySingleScenePacing(sceneIndex) {
    const scene = currentPacingEvaluationScenes[sceneIndex];
    if (!scene || !mediaItems[sceneIndex]) return;

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    mediaItems[sceneIndex].settings.duration = scene.suggestedDuration;
    scene.currentDuration = scene.suggestedDuration;
    scene.diffSeconds = 0;
    scene.pacingStatus = 'optimal';

    if (typeof renderMediaList === 'function') renderMediaList();
    if (typeof selectSegment === 'function') selectSegment(sceneIndex);

    const card = document.getElementById(`pacing-card-${sceneIndex}`);
    if (card) {
        card.className = 'pacing-scene-card is-optimal';
        const comp = card.querySelector('.pacing-scene-comparator');
        if (comp) {
            comp.innerHTML = `
                <div class="pacing-duration-diff-row">
                    <span class="pacing-sug-dur">${scene.suggestedDuration.toFixed(1)}s</span>
                    <span class="pacing-diff-badge pacing-diff-zero">✓ Đã áp dụng</span>
                </div>
                <button type="button" class="btn btn-xs btn-ghost" disabled>✓ Hoàn tất</button>
            `;
        }
    }
}

function applyAllPacingSuggestions() {
    if (!currentPacingEvaluationScenes || currentPacingEvaluationScenes.length === 0) return;

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    let modifiedCount = 0;
    currentPacingEvaluationScenes.forEach((scene, sIdx) => {
        if (mediaItems[sIdx] && typeof scene.suggestedDuration === 'number') {
            if (mediaItems[sIdx].settings.duration !== scene.suggestedDuration) {
                mediaItems[sIdx].settings.duration = scene.suggestedDuration;
                modifiedCount++;
            }
        }
    });

    if (typeof renderMediaList === 'function') renderMediaList();
    if (typeof triggerAutoSave === 'function') triggerAutoSave();
    closeScriptPacingModal();

    alert(`🎉 Đã tự động cân chỉnh thời lượng thành công cho ${modifiedCount > 0 ? modifiedCount : currentPacingEvaluationScenes.length} phân cảnh!\n\nNhịp điệu video trên Timeline hiện đã chuẩn khớp 100% với tốc độ đọc kịch bản.`);
}

if (btnApplyAllPacing) btnApplyAllPacing.addEventListener('click', applyAllPacingSuggestions);
if (btnApplyAllPacingFooter) btnApplyAllPacingFooter.addEventListener('click', applyAllPacingSuggestions);

function closeScriptPacingModal() {
    if (scriptPacingModal) scriptPacingModal.classList.add('hidden');
}

window.openScriptPacingModal = openScriptPacingModal;
window.closeScriptPacingModal = closeScriptPacingModal;
window.applySingleScenePacing = applySingleScenePacing;
window.applyAllPacingSuggestions = applyAllPacingSuggestions;

// ==========================================
// AI VISUAL-SCRIPT ALIGNMENT & SMART SWAPPER
// ==========================================
const btnAuditImageAlignment = document.getElementById('btn-audit-image-alignment');
const btnQuickImageAlignment = document.getElementById('btn-quick-image-alignment');
const imageAlignmentModal = document.getElementById('image-alignment-modal');
const alignmentAuditLoading = document.getElementById('alignment-audit-loading');
const alignmentAuditResult = document.getElementById('alignment-audit-result');
const btnSwapAllImages = document.getElementById('btn-swap-all-images');
const btnSwapAllImagesFooter = document.getElementById('btn-swap-all-images-footer');

let currentImageAlignmentScenes = [];

if (btnAuditImageAlignment) btnAuditImageAlignment.addEventListener('click', openImageAlignmentModal);
if (btnQuickImageAlignment) btnQuickImageAlignment.addEventListener('click', openImageAlignmentModal);

async function openImageAlignmentModal() {
    if (mediaItems.length === 0) {
        alert('Chưa có phân cảnh nào trên timeline! Hãy thêm ảnh/video hoặc nạp mẫu demo trước.');
        return;
    }

    if (imageAlignmentModal) imageAlignmentModal.classList.remove('hidden');
    if (alignmentAuditLoading) alignmentAuditLoading.classList.remove('hidden');
    if (alignmentAuditResult) alignmentAuditResult.classList.add('hidden');

    const scriptText = document.getElementById('script-textarea') ? document.getElementById('script-textarea').value : '';
    const key = document.getElementById('input-gemini-key') ? document.getElementById('input-gemini-key').value.trim() : '';
    const pool = (window.mediaItems && window.mediaItems.length > 0) ? window.mediaItems : mediaItems;

    try {
        const res = await fetch('/api/ai/audit-image-alignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: mediaItems,
                libraryPool: pool,
                scriptText: scriptText,
                customApiKey: key
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        renderImageAlignmentResult(data);
    } catch (err) {
        alert('Lỗi đánh giá độ khớp hình ảnh: ' + err.message);
        closeImageAlignmentModal();
    }
}

function renderImageAlignmentResult(data) {
    if (alignmentAuditLoading) alignmentAuditLoading.classList.add('hidden');
    if (alignmentAuditResult) alignmentAuditResult.classList.remove('hidden');

    currentImageAlignmentScenes = data.scenes || [];
    const stats = data.stats || {};

    const scoreVal = document.getElementById('alignment-score-val');
    const verdictEl = document.getElementById('alignment-verdict');
    const submetaEl = document.getElementById('alignment-submeta');
    const badgeMismatch = document.getElementById('badge-align-mismatch');
    const badgeAcceptable = document.getElementById('badge-align-acceptable');
    const badgePerfect = document.getElementById('badge-align-perfect');
    const scenesList = document.getElementById('alignment-scenes-list');

    if (scoreVal) scoreVal.textContent = data.overallAlignmentScore || 85;
    if (verdictEl) verdictEl.textContent = data.summary || 'Độ khớp hình ảnh tốt!';
    if (submetaEl) {
        submetaEl.textContent = `Phân tích ${stats.totalScenes || mediaItems.length} phân cảnh • Đã tìm thấy ${stats.swappableCount || 0} ảnh thay thế tối ưu hơn trong thư viện`;
    }

    if (badgeMismatch) badgeMismatch.textContent = `⚠️ ${stats.mismatchCount || 0} cảnh chưa khớp`;
    if (badgeAcceptable) badgeAcceptable.textContent = `ℹ️ ${stats.acceptableCount || 0} cảnh tạm chấp nhận`;
    if (badgePerfect) badgePerfect.textContent = `✨ ${stats.perfectCount || 0} cảnh khớp chuẩn`;

    if (!scenesList) return;
    scenesList.innerHTML = '';

    currentImageAlignmentScenes.forEach((scene, sIdx) => {
        const card = document.createElement('div');
        const statusClass = scene.matchGrade === 'mismatch' || scene.matchGrade === 'placeholder' 
            ? 'is-mismatch' 
            : (scene.matchGrade === 'acceptable' ? 'is-acceptable' : 'is-perfect');
        card.className = `alignment-scene-card ${statusClass}`;
        card.id = `alignment-card-${sIdx}`;

        const scoreBadgeClass = scene.matchScore >= 80 
            ? 'badge-score-perfect' 
            : (scene.matchScore >= 60 ? 'badge-score-acceptable' : 'badge-score-mismatch');

        const curThumbSrc = scene.url || (scene.isPlaceholder ? '' : 'images/1_2k.jpg');
        const curThumbHtml = scene.isPlaceholder || !curThumbSrc
            ? `<div class="alignment-thumb-box">
                 <span class="alignment-thumb-label text-danger">Hiện tại (Trống)</span>
                 <div class="alignment-thumb-wrap" style="display:flex;align-items:center;justify-content:center;background:#1E293B;"><span style="font-size:20px;">📷</span></div>
               </div>`
            : `<div class="alignment-thumb-box">
                 <span class="alignment-thumb-label text-dim">Hiện tại</span>
                 <div class="alignment-thumb-wrap"><img src="${curThumbSrc}" class="alignment-thumb-img" alt="Current"></div>
               </div>`;

        let replacementHtml = '';
        let actionBtnHtml = '';

        if (scene.suggestedReplacement) {
            const sug = scene.suggestedReplacement;
            replacementHtml = `
                <span class="alignment-swap-arrow">➔</span>
                <div class="alignment-thumb-box">
                    <span class="alignment-thumb-label text-cyan">Đề xuất đổi</span>
                    <div class="alignment-thumb-wrap is-suggested">
                        <img src="${sug.url}" class="alignment-thumb-img" alt="Suggested Replacement">
                    </div>
                </div>
            `;
            actionBtnHtml = `
                <button type="button" class="btn btn-xs btn-primary btn-apply-single-swap" onclick="applySingleImageSwap(${sIdx})">
                    ✅ Đổi sang ảnh này
                </button>
            `;
        } else {
            actionBtnHtml = `
                <button type="button" class="btn btn-xs btn-ghost" disabled style="opacity:0.75;">
                    ✓ Đã tối ưu
                </button>
            `;
        }

        const textPreview = scene.overlayText 
            ? `<div class="pacing-scene-text-preview">📜 "${escapeHtml(scene.overlayText)}"</div>`
            : `<div class="pacing-scene-text-preview text-dim" style="font-style:italic;">(Không có câu thoại)</div>`;

        const reasonHtml = scene.suggestedReplacement 
            ? `<div class="pacing-scene-reason text-cyan">💡 <strong>Đề xuất:</strong> ${escapeHtml(scene.suggestedReplacement.reason)}</div>`
            : `<div class="pacing-scene-reason">💡 ${escapeHtml(scene.explanation || 'Ảnh đã khớp với nội dung')}</div>`;

        card.innerHTML = `
            <div class="alignment-thumbs-comparison">
                ${curThumbHtml}
                ${replacementHtml}
            </div>
            <div class="alignment-scene-info">
                <div class="alignment-scene-header">
                    <span class="pacing-scene-title">Cảnh ${scene.index}: ${escapeHtml(scene.originalName)}</span>
                    <span class="alignment-score-badge ${scoreBadgeClass}">🎯 Khớp ${scene.matchScore}%</span>
                    ${scene.suggestedReplacement ? `<span class="badge" style="background:rgba(56,189,248,0.2);color:#38BDF8;font-size:10px;">✨ Ảnh mới khớp ${scene.suggestedReplacement.newMatchScore || 90}%</span>` : ''}
                </div>
                ${textPreview}
                ${reasonHtml}
            </div>
            <div class="alignment-actions-column">
                ${actionBtnHtml}
            </div>
        `;

        scenesList.appendChild(card);
    });
}

function applySingleImageSwap(sceneIndex) {
    const scene = currentImageAlignmentScenes[sceneIndex];
    if (!scene || !scene.suggestedReplacement || !mediaItems[sceneIndex]) return;

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    const sug = scene.suggestedReplacement;
    mediaItems[sceneIndex].filename = sug.filename;
    mediaItems[sceneIndex].originalName = sug.originalName;
    mediaItems[sceneIndex].url = sug.url;
    mediaItems[sceneIndex].isPlaceholder = false;
    mediaItems[sceneIndex].type = 'image';

    scene.originalName = sug.originalName;
    scene.filename = sug.filename;
    scene.url = sug.url;
    scene.isPlaceholder = false;
    scene.matchScore = sug.newMatchScore || 95;
    scene.matchGrade = 'perfect';
    scene.suggestedReplacement = null;

    if (typeof renderMediaList === 'function') renderMediaList();
    if (typeof selectSegment === 'function') selectSegment(sceneIndex);

    const card = document.getElementById(`alignment-card-${sceneIndex}`);
    if (card) {
        card.className = 'alignment-scene-card is-perfect';
        const actionCol = card.querySelector('.alignment-actions-column');
        if (actionCol) {
            actionCol.innerHTML = `<button type="button" class="btn btn-xs btn-ghost" disabled>✓ Đã đổi ảnh</button>`;
        }
    }
}

function applyAllImageSwaps() {
    if (!currentImageAlignmentScenes || currentImageAlignmentScenes.length === 0) return;

    if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();
    let swappedCount = 0;
    currentImageAlignmentScenes.forEach((scene, sIdx) => {
        if (scene.suggestedReplacement && mediaItems[sIdx]) {
            const sug = scene.suggestedReplacement;
            mediaItems[sIdx].filename = sug.filename;
            mediaItems[sIdx].originalName = sug.originalName;
            mediaItems[sIdx].url = sug.url;
            mediaItems[sIdx].isPlaceholder = false;
            mediaItems[sIdx].type = 'image';
            swappedCount++;
        }
    });

    if (typeof renderMediaList === 'function') renderMediaList();
    if (typeof triggerAutoSave === 'function') triggerAutoSave();
    closeImageAlignmentModal();

    alert(`🎉 Đã tự động thay thế thành công ${swappedCount} bức ảnh phù hợp nhất vào Timeline!\n\nToàn bộ phân cảnh video hiện đã chuẩn xác và ăn khớp với kịch bản.`);
}

if (btnSwapAllImages) btnSwapAllImages.addEventListener('click', applyAllImageSwaps);
if (btnSwapAllImagesFooter) btnSwapAllImagesFooter.addEventListener('click', applyAllImageSwaps);

function closeImageAlignmentModal() {
    if (imageAlignmentModal) imageAlignmentModal.classList.add('hidden');
}

window.openImageAlignmentModal = openImageAlignmentModal;
window.closeImageAlignmentModal = closeImageAlignmentModal;
window.applySingleImageSwap = applySingleImageSwap;
window.applyAllImageSwaps = applyAllImageSwaps;

// ==========================================
// ONE-CLICK AI AUDIO & VOICEOVER DIRECTOR
// ==========================================
let currentVoiceoverSyncData = null;

const btnAutoSyncVoiceover = document.getElementById('btn-auto-sync-voiceover');
const btnBgmVoiceoverSync = document.getElementById('btn-bgm-voiceover-sync');
const inputVoiceoverFile = document.getElementById('input-voiceover-file');
const voiceoverSyncModal = document.getElementById('voiceover-sync-modal');
const voiceoverSyncLoading = document.getElementById('voiceover-sync-loading');
const voiceoverSyncResult = document.getElementById('voiceover-sync-result');
const voiceoverStatSentences = document.getElementById('voiceover-stat-sentences');
const voiceoverStatTitle = document.getElementById('voiceover-stat-title');
const voiceoverStatDesc = document.getElementById('voiceover-stat-desc');
const voiceoverSentencesList = document.getElementById('voiceover-sentences-list');
const btnConfirmVoiceoverSync = document.getElementById('btn-confirm-voiceover-sync');
const btnCloseVoiceoverModal = document.getElementById('btn-close-voiceover-modal');
const btnCancelVoiceoverModal = document.getElementById('btn-cancel-voiceover-modal');

if (btnAutoSyncVoiceover && inputVoiceoverFile) {
    btnAutoSyncVoiceover.addEventListener('click', () => {
        if (bgmTrack && bgmTrack.filename) {
            executeVoiceoverSync(null, bgmTrack);
        } else {
            inputVoiceoverFile.click();
        }
    });
}

if (btnBgmVoiceoverSync && inputVoiceoverFile) {
    btnBgmVoiceoverSync.addEventListener('click', () => {
        if (bgmTrack && bgmTrack.filename) {
            executeVoiceoverSync(null, bgmTrack);
        } else {
            inputVoiceoverFile.click();
        }
    });
}

if (inputVoiceoverFile) {
    inputVoiceoverFile.addEventListener('change', async (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        await executeVoiceoverSync(file);
        inputVoiceoverFile.value = '';
    });
}

async function executeVoiceoverSync(file, existingBgm = null) {
    if (!voiceoverSyncModal) return;

    voiceoverSyncModal.classList.remove('hidden');
    if (voiceoverSyncLoading) voiceoverSyncLoading.classList.remove('hidden');
    if (voiceoverSyncResult) voiceoverSyncResult.classList.add('hidden');
    if (btnConfirmVoiceoverSync) btnConfirmVoiceoverSync.disabled = true;

    const formData = new FormData();
    let displayName = 'Audio giọng đọc';

    if (file) {
        formData.append('audioFile', file);
        displayName = file.name;
    } else if (existingBgm) {
        formData.append('bgmFilename', existingBgm.filename);
        formData.append('bgmOriginalName', existingBgm.originalName || existingBgm.filename);
        displayName = existingBgm.originalName || existingBgm.filename;
    } else {
        alert('Vui lòng chọn hoặc nạp một file audio.');
        voiceoverSyncModal.classList.add('hidden');
        return;
    }

    formData.append('items', JSON.stringify(mediaItems || []));

    const scriptInput = document.getElementById('ai-script-input') || document.getElementById('sub-script-textarea') || document.getElementById('script-textarea');
    if (scriptInput && scriptInput.value) {
        formData.append('scriptText', scriptInput.value);
    }

    const keyInput = document.getElementById('input-gemini-key') || document.getElementById('sub-input-api-key');
    if (keyInput && keyInput.value) {
        formData.append('customApiKey', keyInput.value.trim());
    }

    try {
        const res = await fetch('/api/ai/auto-sync-voiceover', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Lỗi xử lý file giọng đọc từ AI');
        }

        currentVoiceoverSyncData = data;
        renderVoiceoverSyncResults(data, displayName);

    } catch (err) {
        alert('❌ Lỗi đồng bộ giọng đọc: ' + err.message);
        voiceoverSyncModal.classList.add('hidden');
    }
}

function renderVoiceoverSyncResults(data, originalFileName) {
    if (voiceoverSyncLoading) voiceoverSyncLoading.classList.add('hidden');
    if (voiceoverSyncResult) voiceoverSyncResult.classList.remove('hidden');
    if (btnConfirmVoiceoverSync) btnConfirmVoiceoverSync.disabled = false;

    if (voiceoverStatSentences) voiceoverStatSentences.innerText = data.totalSentences || 0;
    if (voiceoverStatTitle) voiceoverStatTitle.innerText = `Đã phân tích thành công: ${originalFileName}`;
    if (voiceoverStatDesc) {
        voiceoverStatDesc.innerText = `Tổng thời lượng: ${data.totalDuration}s | Khớp chính xác ${data.totalSentences} câu thoại với từng phân cảnh.`;
    }

    if (voiceoverSentencesList) {
        let html = '';
        const sentences = data.sentences || [];
        const items = data.updatedItems || [];

        sentences.forEach((sent, idx) => {
            const item = items[idx];
            const dur = sent.duration || (sent.end - sent.start);
            const thumbUrl = item?.url ? item.url : '';

            html += `
                <div class="alignment-scene-card is-perfect mb-2" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                    <div class="flex-row align-center gap-md flex-wrap">
                        <div style="width: 80px; height: 50px; border-radius: 6px; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${thumbUrl ? `<img src="${thumbUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 1.5rem;">🖼️</span>`}
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <div class="flex-row align-center gap-xs">
                                <span class="badge" style="background: var(--accent-cyan); color: #000; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">Cảnh #${idx + 1}</span>
                                <span class="text-xs text-dim">⏱️ ${sent.start.toFixed(1)}s ➔ ${sent.end.toFixed(1)}s (${dur.toFixed(1)}s)</span>
                            </div>
                            <div class="mt-1" style="font-size: 14px; font-weight: 500; color: #fff;">
                                ✍️ "${escapeHtml(sent.text)}"
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        voiceoverSentencesList.innerHTML = html;
    }
}

if (btnConfirmVoiceoverSync) {
    btnConfirmVoiceoverSync.addEventListener('click', () => {
        if (!currentVoiceoverSyncData) return;

        if (typeof recordHistorySnapshot === 'function') recordHistorySnapshot();

        if (currentVoiceoverSyncData.updatedItems) {
            mediaItems = currentVoiceoverSyncData.updatedItems;
            window.mediaItems = mediaItems;
        }

        if (currentVoiceoverSyncData.bgmTrack) {
            bgmTrack = currentVoiceoverSyncData.bgmTrack;
            window.bgmTrack = bgmTrack;
            if (typeof updateBgmUI === 'function') updateBgmUI();
        }

        if (typeof renderMediaList === 'function') renderMediaList();
        if (typeof triggerAutoSave === 'function') triggerAutoSave();

        if (voiceoverSyncModal) voiceoverSyncModal.classList.add('hidden');
        alert(`🎉 Đã đồng bộ thành công ${currentVoiceoverSyncData.totalSentences} câu thoại từ Audio vào toàn bộ Timeline!`);
    });
}

if (btnCloseVoiceoverModal) {
    btnCloseVoiceoverModal.addEventListener('click', () => {
        if (voiceoverSyncModal) voiceoverSyncModal.classList.add('hidden');
    });
}

if (btnCancelVoiceoverModal) {
    btnCancelVoiceoverModal.addEventListener('click', () => {
        if (voiceoverSyncModal) voiceoverSyncModal.classList.add('hidden');
    });
}
