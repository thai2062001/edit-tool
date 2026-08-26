/**
 * Tab 4: AI Voice Clone & TTS Studio
 * Frontend Controller for ElevenLabs Instant Voice Cloning & Multilingual Text-to-Speech
 */

(function () {
    'use strict';

    const VoiceState = {
        apiKey: localStorage.getItem('elevenlabs_api_key') || '',
        activeVoiceId: '21m00Tcm4TlvDq8ikWAM',
        voices: [],
        recordedBlob: null,
        isRecording: false,
        mediaRecorder: null,
        recordTimerInterval: null,
        recordSeconds: 0,
        generatedAudio: null,
        settings: {
            stability: 0.5,
            similarity: 0.8,
            style: 0.0
        }
    };

    let dom = {};

    function init() {
        getDomElements();
        bindEvents();
        loadVoiceList();
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
            btnSubmitClone: document.getElementById('btn-submit-clone'),
            cloneStatusLabel: document.getElementById('clone-status-label'),

            // Voice List
            voiceListGrid: document.getElementById('voice-list-grid'),

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
            btnSendToTab1Bgm: document.getElementById('btn-send-to-tab1-bgm'),
            btnSendToTab2Sub: document.getElementById('btn-send-to-tab2-sub')
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

        const formData = new FormData();
        formData.append('apiKey', apiKey);
        formData.append('voiceName', voiceName);
        formData.append('description', 'Instant Voice Clone 3-5s via Web Editor Studio');
        formData.append('sample', VoiceState.recordedBlob, 'sample_3s.mp3');

        if (dom.btnSubmitClone) {
            dom.btnSubmitClone.disabled = true;
            dom.btnSubmitClone.innerHTML = '<span class="icon">⏳</span> Đang Trích Xuất & Clone Giọng...';
        }
        if (dom.cloneStatusLabel) {
            dom.cloneStatusLabel.textContent = 'Đang gửi mẫu âm thanh lên ElevenLabs AI...';
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
            loadVoiceList();

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
    async function loadVoiceList() {
        try {
            const res = await fetch('/api/voice/list');
            const data = await res.json();
            if (data.success && data.voices) {
                VoiceState.voices = data.voices;
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
            html += `
                <div class="voice-item-card ${isActive ? 'active' : ''}" data-id="${v.voice_id}">
                    <div class="voice-item-name">
                        <span>${isCloned ? '🧬' : '🗣️'} ${escapeHtml(v.name)}</span>
                        <span class="badge-voice-type">${isCloned ? 'CLONE' : 'PRESET'}</span>
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
            alert('Chưa có câu thoại nào ở Tab 1 hoặc Tab 2. Bạn có thể nhập kịch bản trực tiếp vào khung.');
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

        if (dom.btnGenerateTts) {
            dom.btnGenerateTts.disabled = true;
            dom.btnGenerateTts.innerHTML = '<span class="icon">⏳</span> Đang Đọc Kịch Bản...';
        }
        if (dom.ttsStatusLabel) {
            dom.ttsStatusLabel.textContent = 'Mô hình Eleven Multilingual v2 đang sinh audio...';
        }

        try {
            const res = await fetch('/api/voice/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    voiceId: VoiceState.activeVoiceId,
                    text,
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
                dom.ttsStatusLabel.textContent = `✅ Đã tạo giọng đọc: ${(data.file.duration || 5).toFixed(1)}s`;
            }

            showToast(`🎙️ Đã tạo xong giọng đọc AI (${(data.file.duration || 5).toFixed(1)}s)!`);

        } catch (err) {
            alert('Lỗi tạo giọng đọc: ' + err.message);
            if (dom.ttsStatusLabel) dom.ttsStatusLabel.textContent = `❌ ${err.message}`;
        } finally {
            if (dom.btnGenerateTts) {
                dom.btnGenerateTts.disabled = false;
                dom.btnGenerateTts.innerHTML = '<span class="icon">🎙️</span> Đọc Kịch Bản Bằng Giọng Clone';
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
