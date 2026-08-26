/**
 * Tab 4: AI Voice Clone & TTS Studio
 * Frontend Controller for ElevenLabs Instant Voice Cloning & Multilingual Text-to-Speech
 */

(function () {
    'use strict';

    const VoiceState = {
        apiKey: localStorage.getItem('elevenlabs_api_key') || '',
        activeVoiceId: 'g5CIjZEefAph4nZVvUGo', // Default Kyoko (JA)
        selectedLang: 'ja', // 'ja' | 'ko' | 'en' | 'vi' | 'all'
        voices: [],
        recordedBlob: null,
        isRecording: false,
        mediaRecorder: null,
        recordTimerInterval: null,
        recordSeconds: 0,
        generatedAudio: null,
        settings: {
            stability: 0.5,
            similarity: 0.85,
            style: 0.0
        }
    };

    const SampleScripts = {
        ja: 'こんにちは！今回は日本の伝統的な文化と東京の最新人気スポットをご紹介します。美しい景色と美味しいグルメをぜひお楽しみください！',
        ko: '안녕하세요 여러분! 오늘은 한국의 아름다운 명소와 서울에서 가장 핫한 맛집들을 소개해 드리겠습니다. 끝까지 재미있게 시청해 주세요!',
        en: 'Welcome back everyone! Today we are exploring the most stunning and breathtaking places around the world. Make sure to stay until the very end!',
        vi: 'Xin chào các bạn! Hôm nay chúng ta sẽ cùng khám phá những địa điểm du lịch tuyệt đẹp và những câu chuyện thú vị nhất. Hãy theo dõi đến cuối video nhé!'
    };

    let dom = {};

    function init() {
        getDomElements();
        bindEvents();
        loadVoiceList('ja');
        if (VoiceState.apiKey && dom.voiceApiKeyInput) {
            dom.voiceApiKeyInput.value = VoiceState.apiKey;
        }
    }

    function getDomElements() {
        dom = {
            // Tab Switchers
            tabBtnVoice: document.getElementById('tab-btn-voice'),
            tabPaneVoice: document.getElementById('tab-pane-voice'),

            // API Key
            voiceApiKeyInput: document.getElementById('voice-api-key-input'),

            // Clone Voice Panel
            btnRecordMic: document.getElementById('btn-record-mic'),
            recordTimerLabel: document.getElementById('record-timer-label'),
            voiceSampleInput: document.getElementById('voice-sample-input'),
            voiceSampleName: document.getElementById('voice-sample-name'),
            voiceCustomNameInput: document.getElementById('voice-custom-name-input'),
            voiceCloneLangSelect: document.getElementById('voice-clone-lang-select'),
            btnSubmitClone: document.getElementById('btn-submit-clone'),
            cloneStatusLabel: document.getElementById('clone-status-label'),

            // Voice List & Language Filter Chips
            voiceLangChips: document.querySelectorAll('.btn-voice-lang-chip'),
            voiceListGrid: document.getElementById('voice-list-grid'),

            // Sample scripts buttons
            sampleLangButtons: document.querySelectorAll('.btn-sample-lang-script'),

            // TTS Generator Panel
            voiceScriptTextarea: document.getElementById('voice-script-textarea'),
            btnPullScriptTab1: document.getElementById('btn-pull-script-tab1'),
            btnGenerateTts: document.getElementById('btn-generate-tts'),
            ttsStatusLabel: document.getElementById('tts-status-label'),

            // Sliders
            sliderStability: document.getElementById('slider-stability'),
            valStability: document.getElementById('val-stability'),
            sliderSimilarity: document.getElementById('slider-similarity'),
            valSimilarity: document.getElementById('val-similarity'),

            // Output Player & Quick-Jump CTA
            voiceResultBox: document.getElementById('voice-result-box'),
            voiceAudioPlayer: document.getElementById('voice-audio-player'),
            btnAuditVoice: document.getElementById('btn-audit-voice'),
            btnSendToTab1Bgm: document.getElementById('btn-send-to-tab1-bgm'),
            btnSendToTab2Sub: document.getElementById('btn-send-to-tab2-sub'),

            // AI Voice Quality & Pronunciation Audit Modal
            voiceAuditModal: document.getElementById('voice-audit-modal'),
            voiceAuditLoading: document.getElementById('voice-audit-loading'),
            voiceAuditResult: document.getElementById('voice-audit-result'),
            ringVoiceScore: document.getElementById('ring-voice-score'),
            voiceAuditScoreNum: document.getElementById('voice-audit-score-num'),
            voiceAuditRatingTitle: document.getElementById('voice-audit-rating-title'),
            voiceAuditBadge: document.getElementById('voice-audit-badge'),
            voiceAuditSummaryDesc: document.getElementById('voice-audit-summary-desc'),
            voiceAuditLangTag: document.getElementById('voice-audit-lang-tag'),
            voiceAuditSpeedTag: document.getElementById('voice-audit-speed-tag'),
            voiceAuditDurTag: document.getElementById('voice-audit-dur-tag'),
            barVoicePronunciation: document.getElementById('bar-voice-pronunciation'),
            scoreVoicePronunciation: document.getElementById('score-voice-pronunciation'),
            barVoiceIntonation: document.getElementById('bar-voice-intonation'),
            scoreVoiceIntonation: document.getElementById('score-voice-intonation'),
            barVoicePacing: document.getElementById('bar-voice-pacing'),
            scoreVoicePacing: document.getElementById('score-voice-pacing'),
            barVoiceFidelity: document.getElementById('bar-voice-fidelity'),
            scoreVoiceFidelity: document.getElementById('score-voice-fidelity'),
            auditVoiceStrengths: document.getElementById('audit-voice-strengths'),
            auditVoiceWarnings: document.getElementById('audit-voice-warnings'),
            auditVoiceRecs: document.getElementById('audit-voice-recs'),
            btnVoiceAutofix: document.getElementById('btn-voice-autofix')
        };
    }

    function bindEvents() {
        // Tab switching
        if (dom.tabBtnVoice) {
            dom.tabBtnVoice.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                dom.tabBtnVoice.classList.add('active');
                if (dom.tabPaneVoice) dom.tabPaneVoice.classList.add('active');
            });
        }

        // Save API Key
        if (dom.voiceApiKeyInput) {
            dom.voiceApiKeyInput.addEventListener('input', (e) => {
                const key = e.target.value.trim();
                VoiceState.apiKey = key;
                localStorage.setItem('elevenlabs_api_key', key);
            });
        }

        // Language Filter Chips
        if (dom.voiceLangChips) {
            dom.voiceLangChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    dom.voiceLangChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    const lang = chip.dataset.lang;
                    VoiceState.selectedLang = lang;
                    loadVoiceList(lang);
                });
            });
        }

        // Sample Language Scripts
        if (dom.sampleLangButtons) {
            dom.sampleLangButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const lang = btn.dataset.lang;
                    if (SampleScripts[lang] && dom.voiceScriptTextarea) {
                        dom.voiceScriptTextarea.value = SampleScripts[lang];
                        showToast(`📑 Đã nạp kịch bản mẫu: ${btn.textContent}`);
                    }
                });
            });
        }

        // Mic Recording (3-5s Instant Voice Sample)
        if (dom.btnRecordMic) {
            dom.btnRecordMic.addEventListener('click', toggleMicRecording);
        }

        // Audio Sample File Upload
        if (dom.voiceSampleInput) {
            dom.voiceSampleInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    VoiceState.recordedBlob = file;
                    if (dom.voiceSampleName) {
                        dom.voiceSampleName.textContent = `📁 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    }
                    if (dom.voiceCustomNameInput && !dom.voiceCustomNameInput.value) {
                        dom.voiceCustomNameInput.value = file.name.replace(/\.[^/.]+$/, "");
                    }
                }
            });
        }

        // Submit Clone Button
        if (dom.btnSubmitClone) {
            dom.btnSubmitClone.addEventListener('click', submitCloneVoice);
        }

        // Sliders
        if (dom.sliderStability) {
            dom.sliderStability.addEventListener('input', (e) => {
                VoiceState.settings.stability = parseFloat(e.target.value);
                if (dom.valStability) dom.valStability.textContent = `${Math.round(VoiceState.settings.stability * 100)}%`;
            });
        }
        if (dom.sliderSimilarity) {
            dom.sliderSimilarity.addEventListener('input', (e) => {
                VoiceState.settings.similarity = parseFloat(e.target.value);
                if (dom.valSimilarity) dom.valSimilarity.textContent = `${Math.round(VoiceState.settings.similarity * 100)}%`;
            });
        }

        // Pull script from Tab 1 / Tab 2
        if (dom.btnPullScriptTab1) {
            dom.btnPullScriptTab1.addEventListener('click', pullScriptFromEditor);
        }

        // Generate TTS Button
        if (dom.btnGenerateTts) {
            dom.btnGenerateTts.addEventListener('click', generateVoiceTTS);
        }

        // Audit Voice Button
        if (dom.btnAuditVoice) {
            dom.btnAuditVoice.addEventListener('click', runVoiceAudit);
        }

        // Auto-fix Voice Settings Button
        if (dom.btnVoiceAutofix) {
            dom.btnVoiceAutofix.addEventListener('click', applyOptimalVoiceSettings);
        }

        // Send to Tab 1
        if (dom.btnSendToTab1Bgm) {
            dom.btnSendToTab1Bgm.addEventListener('click', sendAudioToTab1);
        }

        // Send to Tab 2
        if (dom.btnSendToTab2Sub) {
            dom.btnSendToTab2Sub.addEventListener('click', sendAudioToTab2);
        }
    }

    // Browser Mic Recording (3-5s Instant Voice Sample)
    async function toggleMicRecording() {
        if (VoiceState.isRecording) {
            stopMicRecording();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(chunks, { type: 'audio/mp3' });
                VoiceState.recordedBlob = blob;
                if (dom.voiceSampleName) {
                    dom.voiceSampleName.textContent = `🎙️ Đã thu âm (${VoiceState.recordSeconds}s)`;
                }
                if (dom.voiceCustomNameInput && !dom.voiceCustomNameInput.value) {
                    dom.voiceCustomNameInput.value = `Giọng Thu Âm ${new Date().toLocaleTimeString('vi-VN')}`;
                }
                showToast(`✨ Đã thu âm xong (${VoiceState.recordSeconds}s)! Bạn có thể bấm "Bắt Đầu Clone Giọng".`);
            };

            mediaRecorder.start();
            VoiceState.mediaRecorder = mediaRecorder;
            VoiceState.isRecording = true;
            VoiceState.recordSeconds = 0;

            if (dom.btnRecordMic) {
                dom.btnRecordMic.classList.add('recording');
                dom.btnRecordMic.innerHTML = '⏹️ Dừng Thu Âm (Đã đủ 3-5s)';
            }

            // Start counter & auto-stop after 6 seconds
            VoiceState.recordTimerInterval = setInterval(() => {
                VoiceState.recordSeconds++;
                if (dom.recordTimerLabel) {
                    dom.recordTimerLabel.textContent = `0:0${VoiceState.recordSeconds} / 0:05`;
                }
                if (VoiceState.recordSeconds >= 5) {
                    stopMicRecording();
                }
            }, 1000);

        } catch (err) {
            console.error('Microphone error:', err);
            alert('Không thể truy cập Microphone trên trình duyệt. Bạn có thể chọn tải file ghi âm từ máy tính!');
        }
    }

    function stopMicRecording() {
        if (VoiceState.mediaRecorder && VoiceState.mediaRecorder.state !== 'inactive') {
            VoiceState.mediaRecorder.stop();
        }
        clearInterval(VoiceState.recordTimerInterval);
        VoiceState.isRecording = false;
        if (dom.btnRecordMic) {
            dom.btnRecordMic.classList.remove('recording');
            dom.btnRecordMic.innerHTML = '🎙️ Bấm Để Thu Âm Lại (3 - 5 Giây)';
        }
    }

    // Submit Voice Clone to ElevenLabs API
    async function submitCloneVoice() {
        const apiKey = VoiceState.apiKey || dom.voiceApiKeyInput?.value?.trim();
        if (!apiKey) {
            alert('Vui lòng nhập ElevenLabs API Key để tiến hành Clone Giọng!');
            if (dom.voiceApiKeyInput) dom.voiceApiKeyInput.focus();
            return;
        }

        if (!VoiceState.recordedBlob) {
            alert('Vui lòng thu âm 3-5s hoặc tải file ghi âm mẫu lên trước!');
            return;
        }

        const voiceName = dom.voiceCustomNameInput?.value?.trim() || `Giọng Clone ${new Date().toLocaleTimeString('vi-VN')}`;
        const voiceLang = dom.voiceCloneLangSelect?.value || 'ja';

        const formData = new FormData();
        formData.append('apiKey', apiKey);
        formData.append('voiceName', voiceName);
        formData.append('lang', voiceLang);
        formData.append('description', `Instant Voice Clone 3-5s (${voiceLang.toUpperCase()}) via Web Editor Studio`);
        formData.append('sample', VoiceState.recordedBlob, 'sample_3s.mp3');

        if (dom.btnSubmitClone) {
            dom.btnSubmitClone.disabled = true;
            dom.btnSubmitClone.innerHTML = '<span class="icon">⏳</span> Đang Trích Xuất & Clone Giọng...';
        }
        if (dom.cloneStatusLabel) {
            dom.cloneStatusLabel.textContent = `Đang gửi mẫu âm thanh (${voiceLang.toUpperCase()}) lên ElevenLabs AI...`;
        }

        try {
            const res = await fetch('/api/voice/clone', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Lỗi khi clone giọng');
            }

            showToast(`🎉 ${data.message}`);
            if (dom.cloneStatusLabel) {
                dom.cloneStatusLabel.textContent = `✅ Đã tạo Voice ID: ${data.voice.voice_id}`;
            }

            VoiceState.activeVoiceId = data.voice.voice_id;
            loadVoiceList(VoiceState.selectedLang);

        } catch (err) {
            alert('Lỗi Clone Giọng: ' + err.message);
            if (dom.cloneStatusLabel) dom.cloneStatusLabel.textContent = `❌ ${err.message}`;
        } finally {
            if (dom.btnSubmitClone) {
                dom.btnSubmitClone.disabled = false;
                dom.btnSubmitClone.innerHTML = '<span class="icon">⚡</span> Bắt Đầu Clone Giọng Tức Thì';
            }
        }
    }

    // Load Voice Library
    async function loadVoiceList(langFilter) {
        try {
            const lang = langFilter || VoiceState.selectedLang || 'ja';
            const url = lang ? `/api/voice/list?lang=${lang}` : '/api/voice/list';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success && data.voices) {
                VoiceState.voices = data.voices;
                if (data.voices.length > 0 && !data.voices.some(v => v.voice_id === VoiceState.activeVoiceId)) {
                    VoiceState.activeVoiceId = data.voices[0].voice_id;
                }
                renderVoiceList();
            }
        } catch (err) {
            console.error('Load voices error:', err);
        }
    }

    function renderVoiceList() {
        if (!dom.voiceListGrid) return;
        let html = '';
        VoiceState.voices.forEach(v => {
            const isActive = v.voice_id === VoiceState.activeVoiceId;
            const isCloned = v.category === 'cloned';
            const langTag = v.langName || (v.lang ? `[${v.lang.toUpperCase()}]` : '');
            html += `
                <div class="voice-item-card ${isActive ? 'active' : ''}" data-id="${v.voice_id}">
                    <div class="voice-item-name">
                        <span>${isCloned ? '🧬' : '🗣️'} ${escapeHtml(v.name)}</span>
                        <span class="badge-voice-type">${isCloned ? 'CLONE' : 'NATIVE'}</span>
                    </div>
                    <div class="voice-item-desc">${escapeHtml(v.description || '')}</div>
                </div>
            `;
        });
        dom.voiceListGrid.innerHTML = html;

        dom.voiceListGrid.querySelectorAll('.voice-item-card').forEach(card => {
            card.addEventListener('click', () => {
                dom.voiceListGrid.querySelectorAll('.voice-item-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                VoiceState.activeVoiceId = card.dataset.id;
                showToast(`Đã chọn: ${card.querySelector('.voice-item-name span').textContent}`);
            });
        });
    }

    // Pull script text from Tab 1 or Tab 2
    function pullScriptFromEditor() {
        let script = '';
        if (window.mediaItems && window.mediaItems.length > 0) {
            script = window.mediaItems
                .map(item => item.settings?.overlayText)
                .filter(Boolean)
                .join(' ');
        }
        if (!script) {
            const subScript = document.getElementById('sub-script-textarea');
            if (subScript && subScript.value) script = subScript.value;
        }

        if (script && dom.voiceScriptTextarea) {
            dom.voiceScriptTextarea.value = script;
            showToast('📜 Đã nạp kịch bản từ phân đoạn Timeline!');
        } else {
            alert('Chưa có câu thoại nào ở Tab 1 hoặc Tab 2. Bạn có thể bấm các nút "Mẫu Tiếng Nhật/Hàn/Anh" ở trên!');
        }
    }

    // Generate Multilingual TTS Audio
    async function generateVoiceTTS() {
        const apiKey = VoiceState.apiKey || dom.voiceApiKeyInput?.value?.trim();
        if (!apiKey) {
            alert('Vui lòng nhập ElevenLabs API Key để tạo giọng đọc!');
            if (dom.voiceApiKeyInput) dom.voiceApiKeyInput.focus();
            return;
        }

        const text = dom.voiceScriptTextarea?.value?.trim();
        if (!text) {
            alert('Vui lòng nhập kịch bản cần đọc!');
            if (dom.voiceScriptTextarea) dom.voiceScriptTextarea.focus();
            return;
        }

        const activeLang = VoiceState.selectedLang !== 'all' ? VoiceState.selectedLang : 'ja';

        if (dom.btnGenerateTts) {
            dom.btnGenerateTts.disabled = true;
            dom.btnGenerateTts.innerHTML = '<span class="icon">⏳</span> Đang Đọc Kịch Bản...';
        }
        if (dom.ttsStatusLabel) {
            dom.ttsStatusLabel.textContent = `Mô hình Eleven Multilingual v2 đang sinh audio chuẩn [${activeLang.toUpperCase()}]...`;
        }

        try {
            const res = await fetch('/api/voice/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    voiceId: VoiceState.activeVoiceId,
                    text,
                    lang: activeLang,
                    settings: VoiceState.settings
                })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Lỗi khi tạo giọng đọc');
            }

            VoiceState.generatedAudio = data.file;

            if (dom.voiceResultBox) dom.voiceResultBox.classList.remove('hidden');
            if (dom.voiceAudioPlayer) {
                dom.voiceAudioPlayer.src = data.file.url;
                dom.voiceAudioPlayer.play().catch(() => {});
            }
            if (dom.ttsStatusLabel) {
                dom.ttsStatusLabel.textContent = `✅ Đã tạo giọng đọc [${activeLang.toUpperCase()}]: ${(data.file.duration || 5).toFixed(1)}s`;
            }

            showToast(`🎙️ Đã tạo xong giọng đọc AI (${(data.file.duration || 5).toFixed(1)}s)!`);

        } catch (err) {
            alert('Lỗi tạo giọng đọc: ' + err.message);
            if (dom.ttsStatusLabel) dom.ttsStatusLabel.textContent = `❌ ${err.message}`;
        } finally {
            if (dom.btnGenerateTts) {
                dom.btnGenerateTts.disabled = false;
                dom.btnGenerateTts.innerHTML = '<span class="icon">🎙️</span> Đọc Kịch Bản Bằng Giọng Clone (Multilingual AI)';
            }
        }
    }

    // Send Audio to Tab 1 as BGM/Voiceover Track
    function sendAudioToTab1() {
        if (!VoiceState.generatedAudio) return;

        window.bgmTrack = {
            filename: VoiceState.generatedAudio.filename,
            originalName: VoiceState.generatedAudio.originalName || 'Giọng AI Clone',
            duration: VoiceState.generatedAudio.duration || 10,
            volume: 0.9
        };

        if (typeof window.updateBgmUI === 'function') {
            window.updateBgmUI();
        }

        // Switch to Tab 1
        const tab1Btn = document.getElementById('tab-btn-editor');
        if (tab1Btn) tab1Btn.click();

        showToast('🎬 Đã nạp giọng đọc AI vào âm thanh chính của Tab 1 Dựng Phim!');
    }

    // Send Audio to Tab 2 for Subtitle Sync
    function sendAudioToTab2() {
        if (!VoiceState.generatedAudio) return;

        const tab2Btn = document.getElementById('tab-btn-subtitles');
        if (tab2Btn) tab2Btn.click();

        const syncAudioName = document.getElementById('sync-audio-name');
        if (syncAudioName) {
            syncAudioName.textContent = `${VoiceState.generatedAudio.originalName} (${(VoiceState.generatedAudio.duration || 5).toFixed(1)}s)`;
            syncAudioName.style.color = 'var(--accent-emerald)';
        }

        const subScript = document.getElementById('sub-script-textarea');
        if (subScript && dom.voiceScriptTextarea && dom.voiceScriptTextarea.value) {
            subScript.value = dom.voiceScriptTextarea.value;
        }

        showToast('💬 Đã nạp giọng đọc sang Tab 2 để đồng bộ phụ đề và canh ảnh AI!');
    }

    // =========================================================================
    // AI VOICE QUALITY & PRONUNCIATION AUDITOR
    // =========================================================================

    let currentOptimalSettings = null;

    async function runVoiceAudit() {
        const text = dom.voiceScriptTextarea?.value?.trim();
        if (!text) {
            alert('Chưa có kịch bản giọng đọc để đánh giá!');
            return;
        }

        const activeLang = VoiceState.selectedLang !== 'all' ? VoiceState.selectedLang : 'ja';
        const duration = VoiceState.generatedAudio?.duration || 5.0;
        const currentVoice = VoiceState.voices.find(v => v.voice_id === VoiceState.activeVoiceId);
        const voiceName = currentVoice ? currentVoice.name : 'Giọng AI';

        // Open Modal
        if (dom.voiceAuditModal) dom.voiceAuditModal.classList.remove('hidden');
        if (dom.voiceAuditLoading) dom.voiceAuditLoading.classList.remove('hidden');
        if (dom.voiceAuditResult) dom.voiceAuditResult.classList.add('hidden');

        try {
            const res = await fetch('/api/ai/audit-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    lang: activeLang,
                    duration,
                    voiceSettings: VoiceState.settings,
                    voiceName
                })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Lỗi khi gọi AI Auditor');
            }

            const audit = data.audit;
            currentOptimalSettings = audit.optimalSettings;

            // Render Hero Score
            if (dom.voiceAuditScoreNum) dom.voiceAuditScoreNum.textContent = audit.overallScore;
            if (dom.voiceAuditRatingTitle) dom.voiceAuditRatingTitle.textContent = audit.rating;
            if (dom.voiceAuditBadge) {
                dom.voiceAuditBadge.textContent = audit.rating;
                dom.voiceAuditBadge.className = audit.ratingClass || 'badge-score-high';
            }

            // Animate SVG Ring
            if (dom.ringVoiceScore) {
                const circumference = 2 * Math.PI * 50; // 314.159
                const offset = circumference - (audit.overallScore / 100) * circumference;
                dom.ringVoiceScore.style.strokeDashoffset = offset;
            }

            // Tags
            if (dom.voiceAuditLangTag) dom.voiceAuditLangTag.textContent = audit.lang;
            if (dom.voiceAuditSpeedTag) {
                dom.voiceAuditSpeedTag.textContent = (audit.lang === 'JA' || audit.lang === 'KO') ? `${audit.metrics.cps} ký tự/s` : `${audit.metrics.wpm} từ/phút`;
            }
            if (dom.voiceAuditDurTag) dom.voiceAuditDurTag.textContent = `${audit.metrics.duration.toFixed(1)}s`;

            // 4 Category Progress Bars
            if (dom.barVoicePronunciation) dom.barVoicePronunciation.style.width = `${audit.categories.pronunciation}%`;
            if (dom.scoreVoicePronunciation) dom.scoreVoicePronunciation.textContent = `${audit.categories.pronunciation}%`;

            if (dom.barVoiceIntonation) dom.barVoiceIntonation.style.width = `${audit.categories.intonation}%`;
            if (dom.scoreVoiceIntonation) dom.scoreVoiceIntonation.textContent = `${audit.categories.intonation}%`;

            if (dom.barVoicePacing) dom.barVoicePacing.style.width = `${audit.categories.pacing}%`;
            if (dom.scoreVoicePacing) dom.scoreVoicePacing.textContent = `${audit.categories.pacing}%`;

            if (dom.barVoiceFidelity) dom.barVoiceFidelity.style.width = `${audit.categories.fidelity}%`;
            if (dom.scoreVoiceFidelity) dom.scoreVoiceFidelity.textContent = `${audit.categories.fidelity}%`;

            // Strengths List
            if (dom.auditVoiceStrengths) {
                dom.auditVoiceStrengths.innerHTML = audit.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li>✅ Phát âm chuẩn xác, ngữ điệu ổn định.</li>';
            }

            // Warnings List
            if (dom.auditVoiceWarnings) {
                dom.auditVoiceWarnings.innerHTML = audit.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('') || '<li>🎉 Không phát hiện lỗi phát âm hay ngắt câu nào bất thường!</li>';
            }

            // Recommendations List
            if (dom.auditVoiceRecs) {
                dom.auditVoiceRecs.innerHTML = audit.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('') || '<li>💡 Giữ nguyên cài đặt hiện tại để xuất video đạt chất lượng tối ưu nhất.</li>';
            }

            if (dom.voiceAuditLoading) dom.voiceAuditLoading.classList.add('hidden');
            if (dom.voiceAuditResult) dom.voiceAuditResult.classList.remove('hidden');

        } catch (err) {
            alert('Lỗi đánh giá giọng đọc: ' + err.message);
            closeVoiceAuditModal();
        }
    }

    function applyOptimalVoiceSettings() {
        if (!currentOptimalSettings) return;

        VoiceState.settings.stability = currentOptimalSettings.stability;
        VoiceState.settings.similarity = currentOptimalSettings.similarity;

        if (dom.sliderStability) dom.sliderStability.value = currentOptimalSettings.stability;
        if (dom.valStability) dom.valStability.textContent = `${Math.round(currentOptimalSettings.stability * 100)}%`;

        if (dom.sliderSimilarity) dom.sliderSimilarity.value = currentOptimalSettings.similarity;
        if (dom.valSimilarity) dom.valSimilarity.textContent = `${Math.round(currentOptimalSettings.similarity * 100)}%`;

        showToast(`⚡ Đã tự động áp dụng thông số tối ưu (Stability: ${Math.round(currentOptimalSettings.stability * 100)}%, Similarity: ${Math.round(currentOptimalSettings.similarity * 100)}%)!`);
        closeVoiceAuditModal();
    }

    window.closeVoiceAuditModal = function () {
        const modal = document.getElementById('voice-audit-modal');
        if (modal) modal.classList.add('hidden');
    };

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 28px;
            right: 28px;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 9999;
            animation: fadeInTab 0.25s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
