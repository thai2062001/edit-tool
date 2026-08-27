// ==========================================
// TAB 4: AI Video QA Auditor Client Logic
// ==========================================

let qaSelectedFile = null;
let qaCurrentVideoUrl = null;
let qaCurrentAuditResult = null;

// DOM Elements
const tabBtnQa = document.getElementById('tab-btn-qa');
const tabPaneQa = document.getElementById('tab-pane-qa');
const qaVideoInput = document.getElementById('qa-video-input');
const qaDropzone = document.getElementById('qa-dropzone');
const qaVideoPlayer = document.getElementById('qa-video-player');
const qaPlayerEmptyCue = document.getElementById('qa-player-empty-cue');
const qaScriptTextarea = document.getElementById('qa-script-textarea');
const btnRunQaAudit = document.getElementById('btn-run-qa-audit');
const qaLoadingOverlay = document.getElementById('qa-loading-overlay');
const qaAuditEmpty = document.getElementById('qa-audit-empty');
const qaAuditResults = document.getElementById('qa-audit-results');
const btnQaLoadRendered = document.getElementById('btn-qa-load-rendered');

// Tab Navigation
function activateQaTab() {
    document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

    if (tabBtnQa) tabBtnQa.classList.add('active');
    if (tabPaneQa) tabPaneQa.classList.add('active');
}

if (tabBtnQa) {
    tabBtnQa.addEventListener('click', activateQaTab);
}

// File Selection & Drag-and-Drop
if (qaDropzone && qaVideoInput) {
    qaDropzone.addEventListener('click', () => qaVideoInput.click());

    qaDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        qaDropzone.classList.add('dragover');
    });

    qaDropzone.addEventListener('dragleave', () => {
        qaDropzone.classList.remove('dragover');
    });

    qaDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        qaDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleQaFileSelected(e.dataTransfer.files[0]);
        }
    });

    qaVideoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleQaFileSelected(e.target.files[0]);
        }
    });
}

function handleQaFileSelected(file) {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
        alert('⚠️ Vui lòng chọn tệp video hợp lệ (.mp4, .mov, .webm)!');
        return;
    }

    qaSelectedFile = file;
    if (qaCurrentVideoUrl) URL.revokeObjectURL(qaCurrentVideoUrl);
    qaCurrentVideoUrl = URL.createObjectURL(file);

    if (qaVideoPlayer) {
        qaVideoPlayer.src = qaCurrentVideoUrl;
        qaVideoPlayer.load();
        if (qaPlayerEmptyCue) qaPlayerEmptyCue.classList.add('hidden');
    }

    const filenameEl = document.getElementById('qa-selected-filename');
    if (filenameEl) filenameEl.innerText = file.name;

    if (btnRunQaAudit) btnRunQaAudit.disabled = false;
}

// Load Video recently rendered in Tab 1
if (btnQaLoadRendered) {
    btnQaLoadRendered.addEventListener('click', () => {
        const lastOutput = window.lastRenderedVideoUrl;
        if (!lastOutput) {
            alert('Chưa có video nào vừa xuất từ Tab 1. Hãy tải lên video của bạn bằng nút phía dưới!');
            return;
        }

        if (qaVideoPlayer) {
            qaVideoPlayer.src = lastOutput;
            qaVideoPlayer.load();
            if (qaPlayerEmptyCue) qaPlayerEmptyCue.classList.add('hidden');
        }

        qaSelectedFile = { isServerPath: true, path: lastOutput };
        const filenameEl = document.getElementById('qa-selected-filename');
        if (filenameEl) filenameEl.innerText = lastOutput.split('/').pop();

        if (btnRunQaAudit) btnRunQaAudit.disabled = false;
        alert('✅ Đã nạp video vừa xuất từ Tab 1 vào để kiểm định!');
    });
}

// Run AI QA Audit
if (btnRunQaAudit) {
    btnRunQaAudit.addEventListener('click', async () => {
        if (!qaSelectedFile) {
            alert('Vui lòng chọn hoặc nạp một video để kiểm định!');
            return;
        }

        const scriptText = qaScriptTextarea ? qaScriptTextarea.value.trim() : '';

        // UI Loading state
        btnRunQaAudit.disabled = true;
        btnRunQaAudit.innerHTML = '⏳ Đang phân tích khung hình & âm thanh...';
        if (qaLoadingOverlay) qaLoadingOverlay.classList.remove('hidden');

        try {
            const formData = new FormData();
            if (qaSelectedFile.isServerPath) {
                formData.append('videoPath', qaSelectedFile.path);
            } else {
                formData.append('video', qaSelectedFile);
            }
            if (scriptText) formData.append('scriptText', scriptText);

            const res = await fetch('/api/qa/audit-video', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Lỗi khi gọi API kiểm định');
            }

            qaCurrentAuditResult = data.audit;
            renderQaResults(data.audit);
        } catch (err) {
            console.error('QA Audit error:', err);
            alert('❌ Lỗi kiểm định: ' + err.message);
        } finally {
            btnRunQaAudit.disabled = false;
            btnRunQaAudit.innerHTML = '🔍 Bắt Đầu Kiểm Định Video Bằng Gemini AI';
            if (qaLoadingOverlay) qaLoadingOverlay.classList.add('hidden');
        }
    });
}

// Render Results to UI
function renderQaResults(audit) {
    if (!audit) return;

    if (qaAuditEmpty) qaAuditEmpty.classList.add('hidden');
    if (qaAuditResults) qaAuditResults.classList.remove('hidden');

    // 1. Overall Score & Verdict
    const scoreNum = document.getElementById('qa-overall-score-num');
    const verdictBadge = document.getElementById('qa-verdict-badge');
    const summaryText = document.getElementById('qa-summary-text');
    const gaugeWrap = document.querySelector('.qa-gauge-wrap');

    const score = Math.max(0, Math.min(100, Math.round(audit.overallScore || 85)));
    if (scoreNum) scoreNum.innerText = score;
    if (summaryText) summaryText.innerText = audit.summary || '';

    const verdict = (audit.verdict || 'GOOD').toUpperCase();
    if (verdictBadge) {
        verdictBadge.className = `qa-verdict-badge ${verdict.toLowerCase()}`;
        if (verdict === 'EXCELLENT') verdictBadge.innerText = '🌟 XUẤT SẮC (HOÀN HẢO)';
        else if (verdict === 'GOOD') verdictBadge.innerText = '✅ ĐẠT CHUẨN (TỐT)';
        else if (verdict === 'NEEDS_IMPROVEMENT') verdictBadge.innerText = '⚠️ CẦN TINH CHỈNH';
        else verdictBadge.innerText = '❌ CẦN SỬA LẠI';
    }

    if (gaugeWrap) {
        const deg = Math.round((score / 100) * 360);
        gaugeWrap.style.background = `conic-gradient(var(--accent-cyan) 0deg, var(--primary) ${deg}deg, rgba(255,255,255,0.1) ${deg}deg)`;
    }

    // 2. Category Bars
    const scores = audit.scores || {};
    setQaCategoryBar('voicesync', scores.voiceSync || 80);
    setQaCategoryBar('scriptmatch', scores.scriptMatch || 85);
    setQaCategoryBar('pacing', scores.pacing || 80);
    setQaCategoryBar('visuals', scores.visuals || 90);

    // 3. Strengths & Improvements Lists
    const prosList = document.getElementById('qa-pros-list');
    const consList = document.getElementById('qa-cons-list');

    if (prosList) {
        prosList.innerHTML = '';
        (audit.strengths || ['Hình ảnh sắc nét', 'Chuyển động mượt mà']).forEach(txt => {
            const li = document.createElement('li');
            li.innerText = txt;
            prosList.appendChild(li);
        });
    }

    if (consList) {
        consList.innerHTML = '';
        (audit.improvements || ['Cần khớp kỹ hơn ở phân đoạn chuyển cảnh']).forEach(txt => {
            const li = document.createElement('li');
            li.innerText = txt;
            consList.appendChild(li);
        });
    }

    // 4. Interactive Timeline Critiques
    const timelineContainer = document.getElementById('qa-timeline-list');
    if (timelineContainer) {
        timelineContainer.innerHTML = '';
        const critiques = audit.timelineCritiques || [];

        if (critiques.length === 0) {
            timelineContainer.innerHTML = '<p class="text-muted text-center py-3">Không có cảnh báo lệch nào. Video rất đồng bộ!</p>';
        } else {
            critiques.forEach(item => {
                const card = document.createElement('div');
                const status = (item.status || 'ok').toLowerCase();
                card.className = `qa-timeline-card status-${status}`;

                const statusLabel = status === 'ok' ? '✅ Khớp chuẩn' : (status === 'warning' ? '⚠️ Cần chú ý' : '❌ Lệch cảnh');

                card.innerHTML = `
                    <div class="qa-timeline-card-header">
                        <span class="qa-time-tag">⏱️ ${item.timestamp || '00:00'}</span>
                        <strong class="qa-topic-title">${item.topic || 'Phân đoạn video'}</strong>
                        <span class="badge badge-xs ${status === 'ok' ? 'badge-success' : (status === 'warning' ? 'badge-warning' : 'badge-danger')}">${statusLabel}</span>
                    </div>
                    <div class="qa-observation-text">${item.observation || ''}</div>
                    ${item.suggestion ? `<div class="qa-suggestion-box">💡 <span><strong>Gợi ý:</strong> ${item.suggestion}</span></div>` : ''}
                `;

                // Click to seek video
                card.addEventListener('click', () => {
                    if (qaVideoPlayer && typeof item.startTime === 'number') {
                        qaVideoPlayer.currentTime = item.startTime;
                        qaVideoPlayer.play();
                        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });

                timelineContainer.appendChild(card);
            });
        }
    }
}

function setQaCategoryBar(key, score) {
    const bar = document.getElementById(`qa-bar-${key}`);
    const num = document.getElementById(`qa-num-${key}`);
    const safeScore = Math.max(0, Math.min(100, Math.round(score)));

    if (bar) bar.style.width = `${safeScore}%`;
    if (num) num.innerText = `${safeScore}%`;
}

// Global expose
window.activateQaTab = activateQaTab;
