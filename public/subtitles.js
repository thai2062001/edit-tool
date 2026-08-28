/**
 * SUBTITLES & WORD-LEVEL ANIMATION & AUDIO-SRT SYNC MODULE
 * Ist-dev / FFmpeg Studio
 * Isolated & Modular Script
 */

(function () {
    'use strict';

    // Global Subtitle State
    const SubState = {
        currentMedia: null, // { filename, url, duration, type }
        syncAudio: null, // { filename, originalName, url, duration }
        segments: [], // [{ id, start, end, duration, text, imageIndex, imageFilename, imageOriginalName, imageUrl, matchScore, matchReason, words: [{ word, start, end }] }]
        activeSegmentId: null,
        activeWordIndex: -1,
        activeMode: 'sync', // 'sync' or 'transcribe'
        style: {
            preset: 'standard_clean',
            aspectRatio: '16:9', // '16:9', '9:16', '1:1'
            fontFamily: 'Arial',
            fontSize: 40,
            primaryColor: '#FFFFFF',
            highlightColor: '#FFE500',
            outlineColor: '#000000',
            outlineWidth: 3,
            shadow: 2,
            position: 'bottom', // 'top', 'center', 'bottom'
            animationType: 'none', // 'none', 'bounce', 'pop', 'glow', 'karaoke_fill', 'single_word'
            boxBg: 'transparent'
        },
        presets: {
            standard_clean: {
                name: 'Arial Trắng Chuẩn',
                fontFamily: 'Arial',
                fontSize: 38,
                primaryColor: '#FFFFFF',
                highlightColor: '#FFFFFF',
                outlineColor: '#000000',
                outlineWidth: 3,
                shadow: 2,
                position: 'bottom',
                animationType: 'none'
            },
            standard_yellow: {
                name: 'Arial Vàng Chuẩn',
                fontFamily: 'Arial',
                fontSize: 38,
                primaryColor: '#FFE500',
                highlightColor: '#FFE500',
                outlineColor: '#000000',
                outlineWidth: 3,
                shadow: 2,
                position: 'bottom',
                animationType: 'none'
            },
            montserrat_cinema: {
                name: 'Montserrat Cinema',
                fontFamily: 'Montserrat',
                fontSize: 36,
                primaryColor: '#FFFFFF',
                highlightColor: '#FFFFFF',
                outlineColor: '#000000',
                outlineWidth: 3,
                shadow: 2,
                position: 'bottom',
                animationType: 'none'
            },
            tiktok_yellow: {
                name: 'TikTok Pop',
                fontFamily: 'Outfit',
                fontSize: 44,
                primaryColor: '#FFFFFF',
                highlightColor: '#FFDF00',
                outlineColor: '#000000',
                outlineWidth: 4,
                shadow: 2,
                position: 'bottom',
                animationType: 'bounce'
            },
            capcut_neon: {
                name: 'CapCut Cyan',
                fontFamily: 'Outfit',
                fontSize: 42,
                primaryColor: '#F0F9FF',
                highlightColor: '#06B6D4',
                outlineColor: '#0F172A',
                outlineWidth: 3,
                shadow: 3,
                position: 'bottom',
                animationType: 'glow'
            },
            mrbeast_bounce: {
                name: 'MrBeast Pop',
                fontFamily: 'Outfit',
                fontSize: 48,
                primaryColor: '#FFFFFF',
                highlightColor: '#F97316',
                outlineColor: '#000000',
                outlineWidth: 5,
                shadow: 3,
                position: 'center',
                animationType: 'bounce'
            },
            clean_classic: {
                name: 'Classic White',
                fontFamily: 'Outfit',
                fontSize: 38,
                primaryColor: '#FFFFFF',
                highlightColor: '#38BDF8',
                outlineColor: '#000000',
                outlineWidth: 2,
                shadow: 1,
                position: 'bottom',
                animationType: 'karaoke_fill'
            }
        }
    };

    // Curated Multilingual Font Catalog (Grouped by Language with On-Demand Import URLs)
    const FontCatalog = {
        vi: [
            { name: 'Arial', label: 'Arial (Quốc dân / Không lỗi font)', googleFont: false },
            { name: 'Montserrat', label: 'Montserrat (Điện ảnh / Cao cấp)', googleQuery: 'Montserrat:wght@600;700;800;900' },
            { name: 'Outfit', label: 'Outfit (Bo tròn hiện đại)', googleQuery: 'Outfit:wght@600;700;800' },
            { name: 'Inter', label: 'Inter (Rõ nét / Tinh tế)', googleQuery: 'Inter:wght@600;700;800' },
            { name: 'Roboto', label: 'Roboto (Google / YouTube)', googleQuery: 'Roboto:wght@500;700;900' },
            { name: 'Poppins', label: 'Poppins (Trẻ trung / Viral)', googleQuery: 'Poppins:wght@600;700;800' },
            { name: 'Oswald', label: 'Oswald (Cao gọn / Tài liệu)', googleQuery: 'Oswald:wght@600;700' },
            { name: 'Bebas Neue', label: 'Bebas Neue (In hoa mạnh mẽ)', googleQuery: 'Bebas+Neue' },
            { name: 'Anton', label: 'Anton (Dày đậm / Nổi bật)', googleQuery: 'Anton' },
            { name: 'JetBrains Mono', label: 'JetBrains Mono (Code / Tech)', googleQuery: 'JetBrains+Mono:wght@600;700' }
        ],
        en: [
            { name: 'Arial', label: 'Arial (Standard / Clean)', googleFont: false },
            { name: 'Impact', label: 'Impact (Meme / Bold punchy)', googleFont: false },
            { name: 'Montserrat', label: 'Montserrat (Modern Editorial)', googleQuery: 'Montserrat:wght@700;800;900' },
            { name: 'Poppins', label: 'Poppins (Trendy TikTok/Reels)', googleQuery: 'Poppins:wght@700;800;900' },
            { name: 'Bebas Neue', label: 'Bebas Neue (Heavy All-Caps)', googleQuery: 'Bebas+Neue' },
            { name: 'Anton', label: 'Anton (Big Bold Display)', googleQuery: 'Anton' },
            { name: 'Righteous', label: 'Righteous (Retro / Neon)', googleQuery: 'Righteous' },
            { name: 'Cinzel', label: 'Cinzel (Cinematic Luxury / Cổ điển)', googleQuery: 'Cinzel:wght@700;900' },
            { name: 'Rubik', label: 'Rubik (Smooth Rounded)', googleQuery: 'Rubik:wght@700;900' },
            { name: 'Bungee', label: 'Bungee (Urban Street / Gamers)', googleQuery: 'Bungee' }
        ],
        ko: [
            { name: 'Noto Sans KR', label: 'Noto Sans KR (노토 산스 - Chuẩn Hàn)', googleQuery: 'Noto+Sans+KR:wght@500;700;900' },
            { name: 'Gowun Dodum', label: 'Gowun Dodum (고운 돋움 - Thanh lịch)', googleQuery: 'Gowun+Dodum' },
            { name: 'Nanum Gothic', label: 'Nanum Gothic (나눔고딕 - Truyền thống)', googleQuery: 'Nanum+Gothic:wght@700;800' },
            { name: 'Black Han Sans', label: 'Black Han Sans (블랙한산스 - Đậm nét/Tiêu đề)', googleQuery: 'Black+Han+Sans' },
            { name: 'Do Hyeon', label: 'Do Hyeon (도현 - Trẻ trung/Vlog)', googleQuery: 'Do+Hyeon' },
            { name: 'Jua', label: 'Jua (주아 - Dễ thương/Hoạt hình)', googleQuery: 'Jua' }
        ],
        ja: [
            { name: 'Noto Sans JP', label: 'Noto Sans JP (Chuẩn Nhật hiện đại)', googleQuery: 'Noto+Sans+JP:wght@500;700;900' },
            { name: 'M PLUS Rounded 1c', label: 'M PLUS Rounded 1c (Bo tròn Anime)', googleQuery: 'M+PLUS+Rounded+1c:wght@700;800' },
            { name: 'Yuji Boku', label: 'Yuji Boku (Thư pháp truyền thống)', googleQuery: 'Yuji+Boku' },
            { name: 'Dela Gothic One', label: 'Dela Gothic One (Dày đậm / Manga / Poster)', googleQuery: 'Dela+Gothic+One' },
            { name: 'Shippori Mincho', label: 'Shippori Mincho (Mincho Điện ảnh / Cổ điển)', googleQuery: 'Shippori+Mincho:wght@700;800' }
        ],
        zh: [
            { name: 'Noto Sans SC', label: 'Noto Sans SC (Chữ Giản Thể Chuẩn)', googleQuery: 'Noto+Sans+SC:wght@500;700;900' },
            { name: 'Noto Serif SC', label: 'Noto Serif SC (Kiểu Tống / Cổ phong)', googleQuery: 'Noto+Serif+SC:wght@600;700;900' },
            { name: 'ZCOOL QingKe HuangYou', label: 'ZCOOL HuangYou (Hình khối / Độc đáo)', googleQuery: 'ZCOOL+QingKe+HuangYou' },
            { name: 'Ma Shan Zheng', label: 'Ma Shan Zheng (Thư pháp nét cọ)', googleQuery: 'Ma+Shan+Zheng' }
        ]
    };

    // Track loaded fonts in browser DOM memory to prevent duplicate requests
    const loadedGoogleFonts = new Set(['Arial', 'Impact']);

    // Dynamic On-Demand Font Loader (Lazy Load only when user clicks/selects font)
    function loadGoogleFontDynamically(fontName) {
        if (!fontName || loadedGoogleFonts.has(fontName)) return;

        // Search in all languages for the query
        let query = null;
        for (const langKey in FontCatalog) {
            const found = FontCatalog[langKey].find(f => f.name === fontName);
            if (found && found.googleQuery) {
                query = found.googleQuery;
                break;
            }
        }

        if (!query) {
            query = fontName.replace(/\s+/g, '+') + ':wght@600;700;800;900';
        }

        const linkId = `gfont-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
            document.head.appendChild(link);
            loadedGoogleFonts.add(fontName);
        }
    }

    // Populate dynamic font dropdown based on selected language
    function updateFontDropdownByLanguage(langKey, preserveFont = null) {
        if (!dom.subFontFamily) return;
        const fontList = FontCatalog[langKey] || FontCatalog.vi;
        
        let html = '';
        fontList.forEach(f => {
            html += `<option value="${f.name}">${escapeHtml(f.label)}</option>`;
        });
        dom.subFontFamily.innerHTML = html;

        // Select preserved font if exists, otherwise first font in list
        const targetFont = preserveFont && fontList.some(f => f.name === preserveFont)
            ? preserveFont
            : fontList[0].name;

        dom.subFontFamily.value = targetFont;
        SubState.style.fontFamily = targetFont;
        loadGoogleFontDynamically(targetFont);
        applyStyleToOverlay();
    }

    // DOM Elements Cache
    let dom = {};

    document.addEventListener('DOMContentLoaded', () => {
        initSubtitleModule();
    });

    function initSubtitleModule() {
        cacheDom();
        bindEvents();
        setupCueListEventDelegation();
        setupTabSwitching();
        updateFontDropdownByLanguage('vi', 'Arial');
        applyPreset('standard_clean');
        loadSampleDataIfEmpty();
        updateTimelineImageCount();
    }

    function cacheDom() {
        dom = {
            // Tab buttons
            tabVideoEditor: document.getElementById('tab-btn-editor'),
            tabSubtitles: document.getElementById('tab-btn-subtitles'),
            paneVideoEditor: document.getElementById('tab-pane-editor'),
            paneSubtitles: document.getElementById('tab-pane-subtitles'),

            // Media & Player
            subVideoPlayer: document.getElementById('sub-video-player'),
            subVideoContainer: document.getElementById('sub-video-container'),
            btnAspectChips: document.querySelectorAll('.btn-aspect-chip'),
            subWordOverlay: document.getElementById('sub-word-overlay'),
            subCaptionBox: document.getElementById('sub-caption-box'),
            subBtnPlayPause: document.getElementById('sub-btn-play-pause'),
            subScrubber: document.getElementById('sub-scrubber'),
            subTimeLabel: document.getElementById('sub-time-label'),
            subMediaNameLabel: document.getElementById('sub-media-name-label'),
            subFileInput: document.getElementById('sub-file-input'),

            // Mode switchers
            subModeSync: document.getElementById('sub-mode-sync'),
            subModeTranscribe: document.getElementById('sub-mode-transcribe'),
            subPanelSyncMode: document.getElementById('sub-panel-sync-mode'),
            subPanelTranscribeMode: document.getElementById('sub-panel-transcribe-mode'),

            // Sync Mode Inputs
            syncAudioFileInput: document.getElementById('sync-audio-file-input'),
            syncAudioName: document.getElementById('sync-audio-name'),
            syncSrtFileInput: document.getElementById('sync-srt-file-input'),
            syncBtnSampleDemo: document.getElementById('sync-btn-sample-demo'),
            syncBtnRunAi: document.getElementById('sync-btn-run-ai'),
            syncTimelineImgCount: document.getElementById('sync-timeline-img-count'),

            // AI Panel
            subAiApiKey: document.getElementById('sub-input-api-key'),
            subScriptTextarea: document.getElementById('sub-script-textarea'),
            subChunkWordsSelect: document.getElementById('sub-chunk-words-select'),
            subBtnGenerateAi: document.getElementById('sub-btn-generate-ai'),
            subAiStatus: document.getElementById('sub-ai-status'),
            subBtnUseEditorVideo: document.getElementById('sub-btn-use-editor-video'),
            subBtnSampleScript: document.getElementById('sub-btn-sample-script'),

            // Editor List & Apply
            subCuesList: document.getElementById('sub-cues-list'),
            subCuesCountBadge: document.getElementById('sub-cues-count-badge'),
            subBtnApplyTimeline: document.getElementById('sub-btn-apply-timeline'),
            subBtnAddCue: document.getElementById('sub-btn-add-cue'),
            subBtnClearCues: document.getElementById('sub-btn-clear-cues'),

            // Pro Toolbar Elements (Smart Chunking, Find & Replace, Time Shift)
            btnChunkChips: document.querySelectorAll('.btn-chunk-chip'),
            btnShiftMinus500: document.getElementById('btn-shift-minus-500'),
            btnShiftMinus100: document.getElementById('btn-shift-minus-100'),
            btnShiftPlus100: document.getElementById('btn-shift-plus-100'),
            btnShiftPlus500: document.getElementById('btn-shift-plus-500'),
            btnToggleTimeScale: document.getElementById('btn-toggle-time-scale'),
            subTimeScaleBar: document.getElementById('sub-time-scale-bar'),
            btnScaleChips: document.querySelectorAll('.btn-scale-chip'),
            subCustomShiftSec: document.getElementById('sub-custom-shift-sec'),
            btnApplyCustomShift: document.getElementById('btn-apply-custom-shift'),
            btnToggleFindReplace: document.getElementById('btn-toggle-find-replace'),
            subFindReplaceBar: document.getElementById('sub-find-replace-bar'),
            subFindInput: document.getElementById('sub-find-input'),
            subReplaceInput: document.getElementById('sub-replace-input'),
            subFindCount: document.getElementById('sub-find-count'),
            subFindCaseSensitive: document.getElementById('sub-find-case-sensitive'),
            btnSubReplaceAll: document.getElementById('btn-sub-replace-all'),
            btnCloseFindReplace: document.getElementById('btn-close-find-replace'),

            // Presets & Styling Controls
            subPresetsContainer: document.getElementById('sub-presets-container'),
            subFontLang: document.getElementById('sub-style-font-lang'),
            subFontFamily: document.getElementById('sub-style-font'),
            subFontSize: document.getElementById('sub-style-size'),
            subFontSizeVal: document.getElementById('sub-style-size-val'),
            subPrimaryColor: document.getElementById('sub-style-primary-color'),
            subHighlightColor: document.getElementById('sub-style-highlight-color'),
            subOutlineColor: document.getElementById('sub-style-outline-color'),
            subPosition: document.getElementById('sub-style-position'),
            subAnimationType: document.getElementById('sub-style-animation'),
            subBtnApplyStyleAll: document.getElementById('sub-btn-apply-style-all'),

            // Export & Burn
            subBtnExportAss: document.getElementById('sub-btn-export-ass'),
            subBtnExportSrt: document.getElementById('sub-btn-export-srt'),
            subBtnBurnVideo: document.getElementById('sub-btn-burn-video'),

            // Render modal quick-jump
            btnSendToSubtitles: document.getElementById('btn-send-to-subtitles'),

            // Subtitle AI Audit Modal
            btnAuditSubtitles: document.getElementById('btn-audit-subtitles'),
            subAuditModal: document.getElementById('subtitle-audit-modal'),
            subAuditLoading: document.getElementById('subtitle-audit-loading'),
            subAuditResult: document.getElementById('subtitle-audit-result'),
            btnAuditAutochunk: document.getElementById('btn-audit-autochunk'),

            // Burn Modal
            subBurnModal: document.getElementById('sub-burn-modal'),
            subBurnPercent: document.getElementById('sub-burn-percent'),
            subBurnBar: document.getElementById('sub-burn-progress-bar'),
            subBurnStatusText: document.getElementById('sub-burn-status-text'),
            subBurnProcessing: document.getElementById('sub-burn-processing'),
            subBurnCompleted: document.getElementById('sub-burn-completed'),
            subBurnVideoPlayer: document.getElementById('sub-burn-video-player'),
            subBtnDownloadBurned: document.getElementById('sub-btn-download-burned')
        };
    }

    function bindEvents() {
        // Drag & Drop onto Subtitle Player Container (Local PC files)
        if (dom.subVideoContainer) {
            dom.subVideoContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                dom.subVideoContainer.style.border = '2px dashed var(--accent-cyan)';
            });
            dom.subVideoContainer.addEventListener('dragleave', () => {
                dom.subVideoContainer.style.border = 'none';
            });
            dom.subVideoContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                dom.subVideoContainer.style.border = 'none';
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    uploadLocalMediaFile(e.dataTransfer.files[0]);
                }
            });
        }

        // Aspect Ratio Preset Switcher
        if (dom.btnAspectChips) {
            dom.btnAspectChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    const ratio = chip.dataset.ratio || '16:9';
                    setAspectRatioPreset(ratio);
                });
            });
        }

        // Jump to Tab 2 from Tab 1 Render Completion Modal
        if (dom.btnSendToSubtitles) {
            dom.btnSendToSubtitles.addEventListener('click', () => {
                if (typeof window.closeRenderModal === 'function') {
                    window.closeRenderModal();
                }
                switchTab('subtitles');
                grabEditorVideo(false);
            });
        }
        // Player events
        if (dom.subVideoPlayer) {
            dom.subVideoPlayer.addEventListener('timeupdate', onPlayerTimeUpdate);
            dom.subVideoPlayer.addEventListener('loadedmetadata', onPlayerLoadedMetadata);
            dom.subVideoPlayer.addEventListener('play', () => updatePlayButton(true));
            dom.subVideoPlayer.addEventListener('pause', () => updatePlayButton(false));
            dom.subVideoPlayer.addEventListener('ended', () => updatePlayButton(false));
        }

        if (dom.subBtnPlayPause) {
            dom.subBtnPlayPause.addEventListener('click', togglePlayPause);
        }

        if (dom.subScrubber) {
            dom.subScrubber.addEventListener('input', (e) => {
                const targetTime = parseFloat(e.target.value);
                if (dom.subVideoPlayer && !isNaN(targetTime)) {
                    dom.subVideoPlayer.currentTime = targetTime;
                }
            });
        }

        // Mode Switching
        if (dom.subModeSync) {
            dom.subModeSync.addEventListener('click', () => switchAiMode('sync'));
        }
        if (dom.subModeTranscribe) {
            dom.subModeTranscribe.addEventListener('click', () => switchAiMode('transcribe'));
        }

        // Sync Mode File Handlers
        if (dom.syncAudioFileInput) {
            dom.syncAudioFileInput.addEventListener('change', handleSyncAudioUpload);
        }
        if (dom.syncSrtFileInput) {
            dom.syncSrtFileInput.addEventListener('change', handleSyncSrtUpload);
        }
        if (dom.syncBtnSampleDemo) {
            dom.syncBtnSampleDemo.addEventListener('click', loadSampleSrtDemo);
        }
        if (dom.syncBtnRunAi) {
            dom.syncBtnRunAi.addEventListener('click', runAiAudioSrtSync);
        }

        // Apply Timeline button
        if (dom.subBtnApplyTimeline) {
            dom.subBtnApplyTimeline.addEventListener('click', applyCuesToTimeline);
        }

        // File upload for video player
        if (dom.subFileInput) {
            dom.subFileInput.addEventListener('change', handleSubMediaUpload);
        }

        // Use video from editor tab
        if (dom.subBtnUseEditorVideo) {
            dom.subBtnUseEditorVideo.addEventListener('click', grabEditorVideo);
        }

        // Sample script button
        if (dom.subBtnSampleScript) {
            dom.subBtnSampleScript.addEventListener('click', loadSampleScript);
        }

        // Generate Subtitles AI Button
        if (dom.subBtnGenerateAi) {
            dom.subBtnGenerateAi.addEventListener('click', generateSubtitlesWithGemini);
        }

        // Add & Clear Cues
        if (dom.subBtnAddCue) {
            dom.subBtnAddCue.addEventListener('click', addNewEmptyCue);
        }
        if (dom.subBtnClearCues) {
            dom.subBtnClearCues.addEventListener('click', clearAllCues);
        }

        // --- PRO TOOLBAR EVENT BINDINGS ---
        // 3. Smart Word Chunking Chips
        if (dom.btnChunkChips) {
            dom.btnChunkChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    const chunkVal = parseInt(chip.dataset.chunk) || 4;
                    smartChunkSegments(chunkVal);
                });
            });
        }

        // 5. Time Shift Quick Buttons
        if (dom.btnShiftMinus500) dom.btnShiftMinus500.addEventListener('click', () => shiftAllCuesTime(-0.5));
        if (dom.btnShiftMinus100) dom.btnShiftMinus100.addEventListener('click', () => shiftAllCuesTime(-0.1));
        if (dom.btnShiftPlus100) dom.btnShiftPlus100.addEventListener('click', () => shiftAllCuesTime(0.1));
        if (dom.btnShiftPlus500) dom.btnShiftPlus500.addEventListener('click', () => shiftAllCuesTime(0.5));

        // Toggle Time Scale Bar & Custom Shift
        if (dom.btnToggleTimeScale) {
            dom.btnToggleTimeScale.addEventListener('click', () => {
                if (dom.subTimeScaleBar) dom.subTimeScaleBar.classList.toggle('hidden');
                dom.btnToggleTimeScale.classList.toggle('active');
            });
        }
        if (dom.btnScaleChips) {
            dom.btnScaleChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    const scaleFactor = parseFloat(chip.dataset.scale) || 1.0;
                    scaleAllCuesDuration(scaleFactor);
                });
            });
        }
        if (dom.btnApplyCustomShift) {
            dom.btnApplyCustomShift.addEventListener('click', () => {
                const customSec = parseFloat(dom.subCustomShiftSec ? dom.subCustomShiftSec.value : 0);
                if (!isNaN(customSec) && customSec !== 0) {
                    shiftAllCuesTime(customSec);
                } else {
                    alert('Vui lòng nhập số giây hợp lệ (ví dụ: +0.3 hoặc -0.2)!');
                }
            });
        }

        // 4. Find & Replace Toggle & Actions
        if (dom.btnToggleFindReplace) {
            dom.btnToggleFindReplace.addEventListener('click', () => {
                if (dom.subFindReplaceBar) {
                    dom.subFindReplaceBar.classList.toggle('hidden');
                    const isVisible = !dom.subFindReplaceBar.classList.contains('hidden');
                    dom.btnToggleFindReplace.classList.toggle('active', isVisible);
                    if (isVisible && dom.subFindInput) {
                        dom.subFindInput.focus();
                        updateFindCount();
                    }
                }
            });
        }
        if (dom.btnCloseFindReplace) {
            dom.btnCloseFindReplace.addEventListener('click', () => {
                if (dom.subFindReplaceBar) dom.subFindReplaceBar.classList.add('hidden');
                if (dom.btnToggleFindReplace) dom.btnToggleFindReplace.classList.remove('active');
            });
        }
        if (dom.subFindInput) {
            dom.subFindInput.addEventListener('input', updateFindCount);
        }
        if (dom.subFindCaseSensitive) {
            dom.subFindCaseSensitive.addEventListener('change', updateFindCount);
        }
        if (dom.btnSubReplaceAll) {
            dom.btnSubReplaceAll.addEventListener('click', handleReplaceAllSubtitles);
        }

        // Subtitle AI Audit Modal
        if (dom.btnAuditSubtitles) {
            dom.btnAuditSubtitles.addEventListener('click', openSubtitleAuditModal);
        }
        if (dom.btnAuditAutochunk) {
            dom.btnAuditAutochunk.addEventListener('click', () => {
                smartChunkSegments(4);
                closeSubtitleAuditModal();
            });
        }

        // Style controls
        if (dom.subFontLang) {
            dom.subFontLang.addEventListener('change', (e) => {
                updateFontDropdownByLanguage(e.target.value);
            });
        }
        if (dom.subFontFamily) {
            dom.subFontFamily.addEventListener('change', () => {
                loadGoogleFontDynamically(dom.subFontFamily.value);
                updateStyleFromControls();
            });
        }
        if (dom.subFontSize) {
            dom.subFontSize.addEventListener('input', (e) => {
                if (dom.subFontSizeVal) dom.subFontSizeVal.textContent = `${e.target.value}px`;
                updateStyleFromControls();
            });
        }
        if (dom.subPrimaryColor) dom.subPrimaryColor.addEventListener('input', updateStyleFromControls);
        if (dom.subHighlightColor) dom.subHighlightColor.addEventListener('input', updateStyleFromControls);
        if (dom.subOutlineColor) dom.subOutlineColor.addEventListener('input', updateStyleFromControls);
        if (dom.subPosition) dom.subPosition.addEventListener('change', updateStyleFromControls);
        if (dom.subAnimationType) dom.subAnimationType.addEventListener('change', updateStyleFromControls);
        if (dom.subBtnApplyStyleAll) dom.subBtnApplyStyleAll.addEventListener('click', applyStyleToAllCuesAndTimeline);

        // Export events
        if (dom.subBtnExportAss) dom.subBtnExportAss.addEventListener('click', () => exportSubtitlesFile('ass'));
        if (dom.subBtnExportSrt) dom.subBtnExportSrt.addEventListener('click', () => exportSubtitlesFile('srt'));
        if (dom.subBtnBurnVideo) dom.subBtnBurnVideo.addEventListener('click', burnSubtitlesIntoVideo);
    }

    function switchAiMode(mode) {
        SubState.activeMode = mode;
        if (mode === 'sync') {
            if (dom.subModeSync) dom.subModeSync.classList.add('active');
            if (dom.subModeTranscribe) dom.subModeTranscribe.classList.remove('active');
            if (dom.subPanelSyncMode) dom.subPanelSyncMode.classList.remove('hidden');
            if (dom.subPanelTranscribeMode) dom.subPanelTranscribeMode.classList.add('hidden');
            if (dom.subAiStatus) dom.subAiStatus.textContent = 'Chế độ: Đồng bộ giọng đọc theo kịch bản SRT và hình ảnh.';
        } else {
            if (dom.subModeTranscribe) dom.subModeTranscribe.classList.add('active');
            if (dom.subModeSync) dom.subModeSync.classList.remove('active');
            if (dom.subPanelTranscribeMode) dom.subPanelTranscribeMode.classList.remove('hidden');
            if (dom.subPanelSyncMode) dom.subPanelSyncMode.classList.add('hidden');
            if (dom.subAiStatus) dom.subAiStatus.textContent = 'Chế độ: AI tự động nhận diện giọng nói và tạo phụ đề word-level.';
        }
    }

    function updateTimelineImageCount() {
        const count = (window.mediaItems && window.mediaItems.length) ? window.mediaItems.length : 0;
        if (dom.syncTimelineImgCount) {
            dom.syncTimelineImgCount.textContent = `${count} ảnh`;
        }
    }

    // Aspect Ratio Presets Switcher
    function setAspectRatioPreset(ratio) {
        SubState.style.aspectRatio = ratio;

        // Update chip active states
        if (dom.btnAspectChips) {
            dom.btnAspectChips.forEach(c => {
                c.classList.toggle('active', c.dataset.ratio === ratio);
            });
        }

        // Update video container classes for live visual safe zones
        if (dom.subVideoContainer) {
            dom.subVideoContainer.classList.remove('ratio-16-9', 'ratio-9-16', 'ratio-1-1');
            if (ratio === '9:16') {
                dom.subVideoContainer.classList.add('ratio-9-16');
            } else if (ratio === '1:1') {
                dom.subVideoContainer.classList.add('ratio-1-1');
            } else {
                dom.subVideoContainer.classList.add('ratio-16-9');
            }
        }

        const label = ratio === '9:16' ? '📱 9:16 Dọc (TikTok/Shorts/Reels - Safe Zone)' : (ratio === '1:1' ? '⏹️ 1:1 Vuông (Instagram Feed)' : '🖥️ 16:9 Ngang (YouTube/Web)');
        showToast(`📐 Khung hình: ${label}`);
    }

    // Audio file upload for Sync Mode
    async function handleSyncAudioUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        if (dom.syncAudioName) dom.syncAudioName.textContent = `Đang tải: ${file.name}...`;

        try {
            const res = await fetch('/api/subtitles/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.file) {
                SubState.syncAudio = data.file;
                setSubMedia(data.file);
                if (dom.syncAudioName) {
                    dom.syncAudioName.textContent = `${data.file.originalName} (${data.file.duration.toFixed(1)}s)`;
                    dom.syncAudioName.style.color = 'var(--accent-emerald)';
                }
                showToast(`Đã tải audio: ${data.file.originalName}`);
            } else {
                alert('Lỗi tải audio: ' + (data.error || 'Thử lại'));
            }
        } catch (err) {
            alert('Lỗi kết nối khi tải audio');
        }
    }

    // SRT File upload for Sync Mode
    function handleSyncSrtUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target.result;
            if (dom.subScriptTextarea) {
                dom.subScriptTextarea.value = content;
            }
            showToast(`Đã đọc nội dung file: ${file.name}`);
        };
        reader.readAsText(file);
    }

    // Run AI Audio-SRT-Image Sync
    async function runAiAudioSrtSync() {
        const apiKey = dom.subAiApiKey ? dom.subAiApiKey.value.trim() : '';
        const srtText = dom.subScriptTextarea ? dom.subScriptTextarea.value.trim() : '';
        const audioFile = SubState.syncAudio || SubState.currentMedia;

        if (!audioFile || !audioFile.filename) {
            alert('Vui lòng chọn hoặc tải lên file Audio giọng đọc trước!');
            return;
        }
        if (!srtText) {
            alert('Vui lòng nhập hoặc nạp file kịch bản / phụ đề SRT!');
            return;
        }

        const images = (window.mediaItems && window.mediaItems.length > 0) ? window.mediaItems : [];

        if (dom.syncBtnRunAi) {
            dom.syncBtnRunAi.disabled = true;
            dom.syncBtnRunAi.innerHTML = '⏳ AI Đang nghe audio & khớp SRT...';
        }
        if (dom.subAiStatus) {
            dom.subAiStatus.innerHTML = '<span class="spinner-neon" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Gemini AI đang lắng nghe audio, đối soát từng câu SRT và so khớp với từng hình ảnh...';
        }

        try {
            const res = await fetch('/api/subtitles/sync-audio-srt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFilename: audioFile.filename,
                    srtText: srtText,
                    images: images,
                    customApiKey: apiKey
                })
            });

            const data = await res.json();

            if (data.success && data.alignedCues) {
                SubState.segments = data.alignedCues;
                renderCuesList();

                if (data.audioUrl) {
                    setSubMedia({
                        filename: data.audioFilename,
                        url: data.audioUrl,
                        duration: data.totalDuration,
                        type: 'audio',
                        originalName: audioFile.originalName || 'Voiceover Audio'
                    });
                }

                showToast(`✅ Đã đồng bộ thành công ${data.alignedCues.length} phân đoạn theo giọng đọc Audio!`);
                if (dom.subAiStatus) {
                    dom.subAiStatus.innerHTML = `✅ Đã đồng bộ <strong>${data.alignedCues.length} câu</strong> khớp với audio (${data.totalDuration.toFixed(1)}s) & hình ảnh!`;
                }
            } else {
                alert('Lỗi đồng bộ: ' + (data.error || 'Thử lại'));
                if (dom.subAiStatus) dom.subAiStatus.textContent = '❌ Lỗi: ' + (data.error || 'Thất bại');
            }

        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối khi gọi Gemini AI: ' + err.message);
            if (dom.subAiStatus) dom.subAiStatus.textContent = '❌ Lỗi kết nối';
        } finally {
            if (dom.syncBtnRunAi) {
                dom.syncBtnRunAi.disabled = false;
                dom.syncBtnRunAi.innerHTML = '⚡ AI Đồng Bộ Audio ➔ SRT ➔ Ảnh';
            }
        }
    }

    // Apply Aligned Cues Durations & Text Overlays to Tab 1 Video Editor Timeline
    function applyCuesToTimeline() {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có danh sách phân đoạn nào để áp dụng!');
            return;
        }

        if (!window.mediaItems || window.mediaItems.length === 0) {
            alert('Chưa có ảnh/video nào trên Timeline ở Tab 1 để áp dụng. Hãy sang Tab 1 tải ảnh lên trước nhé!');
            return;
        }

        let updatedCount = 0;
        SubState.segments.forEach((cue, cIdx) => {
            // Find matched image or round-robin if not directly mapped
            let imgIdx = (typeof cue.imageIndex === 'number' && cue.imageIndex >= 0) ? cue.imageIndex : (cIdx % window.mediaItems.length);
            if (imgIdx >= 0 && window.mediaItems[imgIdx]) {
                const targetItem = window.mediaItems[imgIdx];
                const dur = parseFloat(Number(cue.duration || (cue.end - cue.start)).toFixed(2));
                targetItem.duration = dur;
                if (!targetItem.settings) targetItem.settings = {};
                targetItem.settings.duration = dur;

                // 2-WAY SYNC: Automatically assign Subtitle text to Text Overlay of Tab 1!
                const cueText = cue.text || (cue.words && cue.words.map(w => w.word).join(' ')) || '';
                if (cueText) {
                    targetItem.settings.overlayText = cueText;
                    targetItem.settings.textPosition = SubState.style.position || 'bottom';
                    targetItem.settings.textStyle = SubState.style.boxBg !== 'transparent' ? 'banner' : 'outline';
                    targetItem.settings.fontSize = Math.min(64, Math.max(36, SubState.style.fontSize || 48));
                }
                updatedCount++;
            }
        });

        // If we have sync audio, set it as active BGM / Voiceover track in Tab 1
        const audioFile = SubState.syncAudio || SubState.currentMedia;
        if (audioFile && audioFile.filename && (audioFile.type === 'audio' || audioFile.type === 'video')) {
            window.bgmTrack = {
                filename: audioFile.filename,
                originalName: audioFile.originalName || 'Voiceover Audio',
                duration: audioFile.duration || 10,
                volume: 0.8
            };
            if (typeof window.updateBgmUI === 'function') {
                window.updateBgmUI();
            }
        }

        // Re-render Tab 1 Timeline List
        if (typeof window.renderMediaList === 'function') {
            window.renderMediaList();
        }
        if (typeof window.updateTotalDuration === 'function') {
            window.updateTotalDuration();
        }

        // Automatically switch back to Tab 1 so user sees the fully updated timeline with Text Overlays
        switchTab('editor');

        showToast(`🎉 Đã áp dụng ${updatedCount} phân cảnh & tự động gán toàn bộ Phụ đề vào Text Overlay của Timeline Tab 1!`);
    }

    // Tab Switching Logic
    function setupTabSwitching() {
        if (!dom.tabVideoEditor || !dom.tabSubtitles) return;

        dom.tabVideoEditor.addEventListener('click', () => switchTab('editor'));
        dom.tabSubtitles.addEventListener('click', () => switchTab('subtitles'));
    }

    function switchTab(tabKey) {
        document.querySelectorAll('.main-tab-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        if (tabKey === 'editor') {
            if (dom.tabVideoEditor) dom.tabVideoEditor.classList.add('active');
            if (dom.paneVideoEditor) dom.paneVideoEditor.classList.add('active');
            if (dom.subVideoPlayer && !dom.subVideoPlayer.paused) {
                dom.subVideoPlayer.pause();
            }
        } else if (tabKey === 'subtitles') {
            if (dom.tabSubtitles) dom.tabSubtitles.classList.add('active');
            if (dom.paneSubtitles) dom.paneSubtitles.classList.add('active');

            updateTimelineImageCount();
            syncTimelineToSubtitles();
            if (!SubState.currentMedia) {
                grabEditorVideo(true);
            }
        }
    }

    // Two-Way Sync: Sync Tab 1 MediaItems & Text Overlays into Subtitles Module
    function syncTimelineToSubtitles() {
        if (!window.mediaItems || window.mediaItems.length === 0) return;

        const hasTimelineTexts = window.mediaItems.some(item => item.settings?.overlayText && item.settings.overlayText.trim());
        if (!hasTimelineTexts && SubState.segments.length > 0) {
            return; // Keep existing SubState if Tab 1 has no text yet
        }

        let accumulatedTime = 0;
        const syncedSegments = [];

        window.mediaItems.forEach((item, idx) => {
            const isImage = item.type === 'image';
            const dur = isImage 
                ? Number(item.settings?.duration || 5.0) 
                : Math.max(0.5, Number(item.settings?.trimEnd || item.duration || 5) - Number(item.settings?.trimStart || 0));

            const startTime = parseFloat(accumulatedTime.toFixed(2));
            const endTime = parseFloat((accumulatedTime + dur).toFixed(2));
            accumulatedTime += dur;

            const text = item.settings?.overlayText?.trim() || '';
            const words = text ? text.split(/\s+/).filter(Boolean) : [];
            const wordDur = words.length > 0 ? (dur / words.length) : dur;
            const wordObjects = words.map((w, wIdx) => ({
                word: w,
                start: parseFloat((startTime + wIdx * wordDur).toFixed(2)),
                end: parseFloat((startTime + (wIdx + 1) * wordDur).toFixed(2))
            }));

            syncedSegments.push({
                id: idx + 1,
                start: startTime,
                end: endTime,
                duration: dur,
                text: text,
                imageIndex: idx,
                imageFilename: item.filename,
                imageOriginalName: item.originalName,
                imageUrl: item.url,
                matchScore: 95,
                matchReason: 'Đồng bộ từ Timeline Tab 1',
                words: wordObjects
            });
        });

        if (syncedSegments.length > 0) {
            SubState.segments = syncedSegments;
            renderCuesList();
        }
    }

    // Toggle Play/Pause
    function togglePlayPause() {
        if (!dom.subVideoPlayer) return;
        if (dom.subVideoPlayer.paused) {
            dom.subVideoPlayer.play().catch(() => {});
        } else {
            dom.subVideoPlayer.pause();
        }
    }

    function updatePlayButton(isPlaying) {
        if (dom.subBtnPlayPause) {
            dom.subBtnPlayPause.innerHTML = isPlaying ? '⏸ Tạm dừng' : '▶ Phát';
        }
    }

    function onPlayerLoadedMetadata() {
        if (!dom.subVideoPlayer) return;
        const dur = dom.subVideoPlayer.duration || 10;
        if (dom.subScrubber) {
            dom.subScrubber.max = dur;
            dom.subScrubber.value = dom.subVideoPlayer.currentTime || 0;
        }
        updateTimeDisplay(dom.subVideoPlayer.currentTime || 0, dur);
    }

    function updateTimeDisplay(cur, dur) {
        if (!dom.subTimeLabel) return;
        const format = (t) => {
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            const ms = Math.floor((t % 1) * 10);
            return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
        };
        dom.subTimeLabel.textContent = `${format(cur)} / ${format(dur)}`;
    }

    // Performance Cache for Real-time Playback
    let lastRenderedSegId = null;
    let lastRenderedWordIdx = null;
    let currentActiveCardEl = null;
    let currentActivePillEl = null;
    let cachedSegIndex = 0;

    function findActiveSegment(segments, curTime) {
        if (!segments || segments.length === 0) return null;
        if (cachedSegIndex >= 0 && cachedSegIndex < segments.length) {
            const cur = segments[cachedSegIndex];
            if (curTime >= cur.start && curTime <= cur.end) return cur;
            if (cachedSegIndex + 1 < segments.length) {
                const next = segments[cachedSegIndex + 1];
                if (curTime >= next.start && curTime <= next.end) {
                    cachedSegIndex++;
                    return next;
                }
            }
        }
        // Binary search fallback for timeline jumps
        let low = 0, high = segments.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const seg = segments[mid];
            if (curTime < seg.start) high = mid - 1;
            else if (curTime > seg.end) low = mid + 1;
            else {
                cachedSegIndex = mid;
                return seg;
            }
        }
        return null;
    }

    // Real-time Word-Level Subtitle Rendering on Video/Audio Playback (Optimized)
    function onPlayerTimeUpdate() {
        if (!dom.subVideoPlayer) return;
        const curTime = dom.subVideoPlayer.currentTime;
        const dur = dom.subVideoPlayer.duration || 10;

        if (dom.subScrubber) {
            dom.subScrubber.value = curTime;
        }
        updateTimeDisplay(curTime, dur);

        // O(1) Fast path search for active segment
        const activeSeg = findActiveSegment(SubState.segments, curTime);

        if (!activeSeg) {
            if (lastRenderedSegId !== null) {
                if (dom.subCaptionBox) dom.subCaptionBox.innerHTML = '';
                if (currentActiveCardEl) {
                    currentActiveCardEl.classList.remove('active-playing');
                    currentActiveCardEl = null;
                }
                if (currentActivePillEl) {
                    currentActivePillEl.classList.remove('active-highlight');
                    currentActivePillEl = null;
                }
                lastRenderedSegId = null;
                lastRenderedWordIdx = null;
                SubState.activeSegmentId = null;
                SubState.activeWordIndex = -1;
            }
            return;
        }

        // Highlight Cue in timeline list (O(1) fast pointer toggle)
        if (SubState.activeSegmentId !== activeSeg.id) {
            SubState.activeSegmentId = activeSeg.id;
            if (currentActiveCardEl) {
                currentActiveCardEl.classList.remove('active-playing');
            }
            currentActiveCardEl = dom.subCuesList ? dom.subCuesList.querySelector(`.sub-cue-card[data-id="${activeSeg.id}"]`) : null;
            if (currentActiveCardEl) {
                currentActiveCardEl.classList.add('active-playing');
            }
        }

        // Render words inside caption overlay
        renderLiveCaptionWords(activeSeg, curTime);
    }

    function renderLiveCaptionWords(seg, curTime) {
        if (!dom.subCaptionBox) return;

        const words = seg.words || [];
        const animType = SubState.style.animationType;

        // MODE: Standard static subtitle (No bounce, no pop, clean sentence)
        if (animType === 'none') {
            if (lastRenderedSegId !== seg.id) {
                lastRenderedSegId = seg.id;
                lastRenderedWordIdx = null;
                const fullText = seg.text || words.map(w => w.word).join(' ');
                dom.subCaptionBox.innerHTML = `<span class="sub-word-item" style="color: ${SubState.style.primaryColor}; font-weight: 700; transform: none; display: block; text-align: center;">${escapeHtml(fullText)}</span>`;
            }
            return;
        }

        if (words.length === 0) {
            if (lastRenderedSegId !== seg.id) {
                dom.subCaptionBox.innerHTML = `<span class="sub-word-item">${escapeHtml(seg.text)}</span>`;
                lastRenderedSegId = seg.id;
            }
            return;
        }

        // Find active word index
        const activeWordIdx = words.findIndex(w => curTime >= w.start && curTime <= w.end);

        // Skip DOM rewrite if active word and segment haven't changed (Except for karaoke_fill which updates progress)
        if (lastRenderedSegId === seg.id && lastRenderedWordIdx === activeWordIdx && animType !== 'karaoke_fill') {
            return;
        }

        lastRenderedSegId = seg.id;
        lastRenderedWordIdx = activeWordIdx;

        if (animType === 'single_word') {
            const activeWord = activeWordIdx >= 0 ? words[activeWordIdx] : words[0];
            dom.subCaptionBox.innerHTML = `<span class="sub-word-item active-word bounce-anim" style="color: ${SubState.style.highlightColor}; font-size: 1.25em;">${escapeHtml(activeWord.word)}</span>`;
            return;
        }

        let html = '';
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const isActive = i === activeWordIdx;
            const isPast = activeWordIdx > i || curTime > w.end;

            let wordClass = 'sub-word-item';
            let wordColor = SubState.style.primaryColor;

            if (isActive) {
                wordClass += ' active-word';
                if (animType === 'bounce') wordClass += ' bounce-anim';
                if (animType === 'glow') wordClass += ' glow-anim';
                wordColor = SubState.style.highlightColor;
            } else if (animType === 'karaoke_fill' && isPast) {
                wordColor = SubState.style.highlightColor;
            }

            html += `<span class="${wordClass}" style="color: ${wordColor};">${escapeHtml(w.word)}</span> `;
        }

        dom.subCaptionBox.innerHTML = html;

        // Fast O(1) highlight active word pill
        if (currentActiveCardEl) {
            if (currentActivePillEl) {
                currentActivePillEl.classList.remove('active-highlight');
                currentActivePillEl = null;
            }
            if (activeWordIdx >= 0) {
                currentActivePillEl = currentActiveCardEl.querySelector(`.word-pill[data-word-idx="${activeWordIdx}"]`);
                if (currentActivePillEl) {
                    currentActivePillEl.classList.add('active-highlight');
                }
            }
        }
    }

    // Media Upload & Grabber (Local PC vs Tab 1 Video)
    async function uploadLocalMediaFile(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        if (dom.subMediaNameLabel) {
            dom.subMediaNameLabel.innerHTML = `⏳ Đang tải lên: <strong>${escapeHtml(file.name)}</strong>...`;
        }

        try {
            const res = await fetch('/api/subtitles/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.file) {
                data.file.source = 'local';
                setSubMedia(data.file);
                showToast(`📁 Đã nạp thành công: ${data.file.originalName}`);
            } else {
                alert('Lỗi tải tệp: ' + (data.error || 'Thử lại'));
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối khi tải tệp từ máy tính');
        }
    }

    async function handleSubMediaUpload(e) {
        const file = e.target.files[0];
        if (file) {
            uploadLocalMediaFile(file);
            e.target.value = '';
        }
    }

    function grabEditorVideo(silent = false) {
        // 1. Check if user has already rendered a full video in Tab 1
        const renderedPlayer = document.getElementById('rendered-video-player');
        if (renderedPlayer && renderedPlayer.src && !renderedPlayer.src.endsWith('#')) {
            const url = renderedPlayer.src;
            const filename = url.substring(url.lastIndexOf('/') + 1);
            setSubMedia({
                filename,
                url,
                duration: renderedPlayer.duration || 10,
                type: 'video',
                source: 'tab1_render',
                originalName: `Video vừa render (${filename})`
            });
            if (!silent) showToast('🎬 Đã lấy video vừa xuất từ Tab Dựng phim!');
            return;
        }

        // 2. Check if user has uploaded a video file on Tab 1 Timeline
        if (window.mediaItems && window.mediaItems.length > 0) {
            const firstVideo = window.mediaItems.find(i => i.type === 'video');
            if (firstVideo) {
                setSubMedia({
                    filename: firstVideo.filename,
                    url: firstVideo.url,
                    duration: firstVideo.duration || 10,
                    type: 'video',
                    source: 'tab1_timeline',
                    originalName: firstVideo.originalName || 'Video từ Timeline'
                });
                if (!silent) showToast('🎬 Đã lấy video từ danh sách Timeline Tab 1!');
                return;
            }
        }

        // 3. NEW: Check if user has BGM / Audio Track in Tab 1
        if (window.bgmTrack && window.bgmTrack.filename) {
            const bgm = window.bgmTrack;
            setSubMedia({
                filename: bgm.filename,
                url: `/uploads/${bgm.filename}`,
                duration: bgm.duration || 10,
                type: 'audio',
                source: 'tab1_bgm',
                originalName: `Nhạc nền/Giọng đọc từ Tab 1 (${bgm.originalName || bgm.filename})`
            });
            SubState.syncAudio = SubState.currentMedia;
            updateTimelineImageCount();
            if (!silent) showToast('🎶 Đã lấy nhạc nền/giọng đọc từ Tab 1 để đồng bộ phụ đề!');
            return;
        }

        // 4. NEW: Check if user has image items on Tab 1 Timeline (preview & timeline sync without full render)
        if (window.mediaItems && window.mediaItems.length > 0) {
            const imgCount = window.mediaItems.filter(i => i.type === 'image').length;
            let totalDur = 0;
            window.mediaItems.forEach(i => {
                totalDur += Number(i.settings?.duration || i.duration || 5.0);
            });
            const firstImg = window.mediaItems[0];
            setSubMedia({
                filename: firstImg.filename,
                url: firstImg.url,
                duration: totalDur,
                type: 'image',
                source: 'tab1_timeline_images',
                originalName: `Timeline Tab 1 (${imgCount} ảnh, ~${totalDur.toFixed(1)}s)`
            });
            updateTimelineImageCount();
            if (!silent) showToast(`🖼️ Đã nạp ${imgCount} ảnh từ Timeline Tab 1! Bạn có thể tải thêm file Audio hoặc kịch bản SRT để đồng bộ.`);
            return;
        }

        if (!silent) {
            alert('Chưa có dữ liệu nào ở Tab 1. Bạn có thể bấm "Tải Từ Máy (PC)" hoặc kéo thả file video/audio vào đây!');
        }
    }

    function setSubMedia(fileObj) {
        SubState.currentMedia = fileObj;
        if (dom.subVideoPlayer) {
            if (fileObj.type === 'image') {
                dom.subVideoPlayer.poster = fileObj.url;
                dom.subVideoPlayer.src = '';
            } else {
                dom.subVideoPlayer.poster = '';
                dom.subVideoPlayer.src = fileObj.url;
                dom.subVideoPlayer.load();
            }
        }
        if (dom.subMediaNameLabel) {
            let sourceBadge = '<span class="badge-accent">🔊 Nguồn: Audio/Video</span>';
            if (fileObj.source === 'tab1_render') {
                sourceBadge = '<span class="badge-score-high">🎬 Nguồn: Video Render Tab 1</span>';
            } else if (fileObj.source === 'local') {
                sourceBadge = '<span class="badge-score-med">📁 Nguồn: Máy tính (PC Local)</span>';
            } else if (fileObj.source === 'tab1_bgm') {
                sourceBadge = '<span class="badge-score-high">🎶 Nguồn: Nhạc nền/Audio Tab 1</span>';
            } else if (fileObj.source === 'tab1_timeline_images') {
                sourceBadge = '<span class="badge-score-high">🖼️ Nguồn: Timeline Tab 1</span>';
            }

            dom.subMediaNameLabel.innerHTML = `${sourceBadge} <strong>${escapeHtml(fileObj.originalName || fileObj.filename)}</strong> (${fileObj.duration ? fileObj.duration.toFixed(1) + 's' : ''})`;
        }
    }

    // Gemini AI Subtitle Generation (Mode 2)
    async function generateSubtitlesWithGemini() {
        const apiKey = dom.subAiApiKey ? dom.subAiApiKey.value.trim() : '';
        const scriptText = dom.subScriptTextarea ? dom.subScriptTextarea.value.trim() : '';
        const maxWordsPerSegment = dom.subChunkWordsSelect ? parseInt(dom.subChunkWordsSelect.value) : 4;
        const mediaFilename = SubState.currentMedia ? SubState.currentMedia.filename : null;

        if (!scriptText && !mediaFilename) {
            alert('Vui lòng nhập nội dung kịch bản hoặc tải lên file âm thanh / video!');
            return;
        }

        if (dom.subBtnGenerateAi) {
            dom.subBtnGenerateAi.disabled = true;
            dom.subBtnGenerateAi.innerHTML = '⏳ AI Đang phân tích âm thanh & tạo từ...';
        }
        if (dom.subAiStatus) {
            dom.subAiStatus.innerHTML = '<span class="spinner-neon" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Gemini đang phân tích giọng nói & căn chỉnh mốc thời gian từng từ...';
        }

        try {
            const res = await fetch('/api/subtitles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mediaFilename,
                    scriptText,
                    customApiKey: apiKey,
                    maxWordsPerSegment
                })
            });

            const data = await res.json();

            if (data.success && data.segments) {
                SubState.segments = data.segments;
                renderCuesList();
                showToast(`Đã tạo thành công ${data.segments.length} phân đoạn phụ đề với word-level timestamps!`);
                if (dom.subAiStatus) {
                    dom.subAiStatus.innerHTML = `✅ Đã tạo xong <strong>${data.segments.length} câu</strong> (${data.mediaDuration ? data.mediaDuration.toFixed(1) + 's' : ''})`;
                }
            } else {
                alert('Lỗi tạo phụ đề: ' + (data.error || 'Thử lại với API Key'));
                if (dom.subAiStatus) dom.subAiStatus.textContent = '❌ Lỗi: ' + (data.error || 'Thất bại');
            }

        } catch (err) {
            console.error('AI Subtitle error:', err);
            alert('Lỗi kết nối khi gọi Gemini AI: ' + err.message);
            if (dom.subAiStatus) dom.subAiStatus.textContent = '❌ Lỗi kết nối';
        } finally {
            if (dom.subBtnGenerateAi) {
                dom.subBtnGenerateAi.disabled = false;
                dom.subBtnGenerateAi.innerHTML = '✨ Tạo Phụ Đề AI (Word-Level)';
            }
        }
    }

    // Render Subtitle Cues Editor List with Matched Images
    function renderCuesList() {
        if (!dom.subCuesList) return;

        if (dom.subCuesCountBadge) {
            dom.subCuesCountBadge.textContent = `${SubState.segments.length} câu`;
        }

        if (SubState.segments.length === 0) {
            dom.subCuesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h4>Chưa có phân đoạn nào</h4>
                    <p>Chọn audio, dán file SRT và bấm "AI Đồng Bộ Audio ➔ SRT ➔ Ảnh".</p>
                </div>
            `;
            return;
        }

        const timelineImages = (window.mediaItems && window.mediaItems.length > 0) ? window.mediaItems : [];

        let html = '';
        SubState.segments.forEach((seg, idx) => {
            const words = seg.words || [];
            const dur = parseFloat(Number(seg.duration || (seg.end - seg.start)).toFixed(2));
            const score = seg.matchScore || 95;
            const scoreClass = score >= 90 ? 'badge-score-high' : 'badge-score-med';

            // Find thumbnail
            let thumbUrl = seg.imageUrl || '';
            let matchedName = seg.imageOriginalName || `Ảnh #${(seg.imageIndex || 0) + 1}`;
            if (!thumbUrl && typeof seg.imageIndex === 'number' && timelineImages[seg.imageIndex]) {
                thumbUrl = timelineImages[seg.imageIndex].url;
                matchedName = timelineImages[seg.imageIndex].originalName || matchedName;
            }

            html += `
                <div class="sub-cue-card" data-id="${seg.id}" data-idx="${idx}">
                    <div class="sub-cue-header">
                        <div class="sub-cue-time-inputs">
                            <strong>#${idx + 1}</strong>
                            <input type="number" step="0.1" class="input-time-compact input-start" value="${seg.start}" data-idx="${idx}" title="Bắt đầu (giây)">
                            <span>➔</span>
                            <input type="number" step="0.1" class="input-time-compact input-end" value="${seg.end}" data-idx="${idx}" title="Kết thúc (giây)">
                            <span class="text-xs text-dim">(${dur}s)</span>
                            <button class="btn btn-icon btn-ghost btn-play-cue" data-start="${seg.start}" title="Phát câu này">▶</button>
                        </div>
                        <button class="btn btn-icon btn-ghost btn-delete-cue" data-idx="${idx}" title="Xóa câu">✕</button>
                    </div>

                    <div class="sub-cue-words-wrap">
                        ${words.map((w, wIdx) => `
                            <span class="word-pill" data-seg-idx="${idx}" data-word-idx="${wIdx}" data-start="${w.start}" data-end="${w.end}" title="Tua tới từ này: [${w.start}s - ${w.end}s]">
                                <strong class="word-text">${escapeHtml(w.word)}</strong>
                                <span class="word-pill-time">${w.start}s</span>
                            </span>
                        `).join('')}
                    </div>

                    <!-- Matched Image & Semantic Alignment Info -->
                    <div class="sub-cue-match-box">
                        <div class="sub-cue-match-info">
                            ${thumbUrl ? `<img src="${thumbUrl}" class="sub-cue-thumb" alt="thumb" loading="lazy" decoding="async">` : `<div class="sub-cue-thumb" style="display:flex;align-items:center;justify-content:center;font-size:14px;">🖼️</div>`}
                            <div class="sub-cue-match-text">
                                <div class="sub-cue-match-name">🖼️ ${escapeHtml(matchedName)}</div>
                                <div class="sub-cue-match-reason">${escapeHtml(seg.matchReason || 'Khớp theo ngữ cảnh câu thoại')}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="${scoreClass}">✅ ${score}%</span>
                            ${timelineImages.length > 1 ? `
                                <select class="sub-image-select" data-seg-idx="${idx}" title="Đổi sang ảnh khác trên timeline">
                                    ${timelineImages.map((img, iIdx) => `
                                        <option value="${iIdx}" ${seg.imageIndex === iIdx ? 'selected' : ''}>
                                            Ảnh ${iIdx + 1}: ${escapeHtml(img.originalName || img.filename).slice(0, 14)}...
                                        </option>
                                    `).join('')}
                                </select>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        dom.subCuesList.innerHTML = html;
    }

    // Event Delegation on subCuesList (Ultra-fast, zero memory leaks)
    function setupCueListEventDelegation() {
        if (!dom.subCuesList) return;

        dom.subCuesList.addEventListener('click', (e) => {
            // Play cue button
            const playBtn = e.target.closest('.btn-play-cue');
            if (playBtn) {
                e.stopPropagation();
                const start = parseFloat(playBtn.dataset.start);
                if (dom.subVideoPlayer && !isNaN(start)) {
                    dom.subVideoPlayer.currentTime = start;
                    dom.subVideoPlayer.play().catch(() => {});
                }
                return;
            }

            // Delete cue button
            const delBtn = e.target.closest('.btn-delete-cue');
            if (delBtn) {
                e.stopPropagation();
                const idx = parseInt(delBtn.dataset.idx);
                SubState.segments.splice(idx, 1);
                renderCuesList();
                return;
            }

            // Word pill click to seek
            const pill = e.target.closest('.word-pill');
            if (pill) {
                e.stopPropagation();
                const start = parseFloat(pill.dataset.start);
                if (dom.subVideoPlayer && !isNaN(start)) {
                    dom.subVideoPlayer.currentTime = start;
                    dom.subVideoPlayer.play().catch(() => {});
                }
                return;
            }
        });

        dom.subCuesList.addEventListener('change', (e) => {
            // Input start
            if (e.target.classList.contains('input-start')) {
                const idx = parseInt(e.target.dataset.idx);
                const val = parseFloat(e.target.value);
                if (SubState.segments[idx] && !isNaN(val)) {
                    SubState.segments[idx].start = val;
                    SubState.segments[idx].duration = parseFloat(Math.max(0.5, SubState.segments[idx].end - val).toFixed(2));
                }
                return;
            }

            // Input end
            if (e.target.classList.contains('input-end')) {
                const idx = parseInt(e.target.dataset.idx);
                const val = parseFloat(e.target.value);
                if (SubState.segments[idx] && !isNaN(val)) {
                    SubState.segments[idx].end = val;
                    SubState.segments[idx].duration = parseFloat(Math.max(0.5, val - SubState.segments[idx].start).toFixed(2));
                }
                return;
            }

            // Image switcher select
            if (e.target.classList.contains('sub-image-select')) {
                const segIdx = parseInt(e.target.dataset.segIdx);
                const newImgIdx = parseInt(e.target.value);
                if (SubState.segments[segIdx]) {
                    SubState.segments[segIdx].imageIndex = newImgIdx;
                    if (window.mediaItems && window.mediaItems[newImgIdx]) {
                        SubState.segments[segIdx].imageFilename = window.mediaItems[newImgIdx].filename;
                        SubState.segments[segIdx].imageOriginalName = window.mediaItems[newImgIdx].originalName;
                        SubState.segments[segIdx].imageUrl = window.mediaItems[newImgIdx].url;
                    }
                    renderCuesList();
                    showToast(`Đã gán câu #${segIdx + 1} sang Ảnh #${newImgIdx + 1}`);
                }
                return;
            }
        });
    }

    function addNewEmptyCue() {
        const lastSeg = SubState.segments[SubState.segments.length - 1];
        const start = lastSeg ? parseFloat((lastSeg.end + 0.2).toFixed(2)) : 0.0;
        const end = parseFloat((start + 2.5).toFixed(2));
        const newId = Date.now();

        const words = [
            { word: 'Phân', start: start, end: parseFloat((start + 0.8).toFixed(2)) },
            { word: 'đoạn', start: parseFloat((start + 0.8).toFixed(2)), end: parseFloat((start + 1.6).toFixed(2)) },
            { word: 'mới', start: parseFloat((start + 1.6).toFixed(2)), end: end }
        ];

        SubState.segments.push({
            id: newId,
            start,
            end,
            duration: 2.5,
            text: 'Phân đoạn mới',
            imageIndex: SubState.segments.length % Math.max(1, (window.mediaItems?.length || 1)),
            matchScore: 90,
            matchReason: 'Thêm thủ công',
            words
        });

        renderCuesList();
    }

    function clearAllCues() {
        if (confirm('Bạn có chắc muốn xóa tất cả phụ đề?')) {
            SubState.segments = [];
            renderCuesList();
            if (dom.subCaptionBox) dom.subCaptionBox.innerHTML = '';
        }
    }

    // =========================================================================
    // PRO EDITING TOOLS: 3. Smart Chunking, 4. Find & Replace, 5. Time Shift
    // =========================================================================

    // 3. Smart Word Chunking (1-2 words / 3-4 words / 5-7 words)
    function smartChunkSegments(maxWords) {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có phân đoạn phụ đề nào để chia nhỏ! Hãy nạp file SRT hoặc dùng AI tạo phụ đề trước nhé.');
            return;
        }

        const targetChunkSize = parseInt(maxWords) || 4;
        const newSegments = [];
        let newId = 1;

        SubState.segments.forEach((seg) => {
            let words = seg.words || [];

            // If no word array, construct from text and distribute duration
            if (words.length === 0 && seg.text) {
                const rawWords = seg.text.split(/\s+/).filter(Boolean);
                const dur = Math.max(0.15, (seg.end - seg.start) / Math.max(1, rawWords.length));
                words = rawWords.map((w, idx) => ({
                    word: w,
                    start: parseFloat((seg.start + idx * dur).toFixed(2)),
                    end: parseFloat((seg.start + (idx + 1) * dur).toFixed(2))
                }));
            }

            if (words.length <= targetChunkSize) {
                // Already small enough, keep as is
                newSegments.push({
                    ...JSON.parse(JSON.stringify(seg)),
                    id: newId++
                });
                return;
            }

            // Split into chunks of size targetChunkSize
            for (let i = 0; i < words.length; i += targetChunkSize) {
                const chunkWords = words.slice(i, i + targetChunkSize);
                const chunkStart = chunkWords[0].start;
                let chunkEnd = chunkWords[chunkWords.length - 1].end;
                if (chunkEnd <= chunkStart) {
                    chunkEnd = parseFloat((chunkStart + 0.5).toFixed(2));
                }
                const chunkText = chunkWords.map(w => w.word).join(' ');

                newSegments.push({
                    id: newId++,
                    start: chunkStart,
                    end: chunkEnd,
                    duration: parseFloat(Math.max(0.2, chunkEnd - chunkStart).toFixed(2)),
                    text: chunkText,
                    imageIndex: seg.imageIndex,
                    imageOriginalName: seg.imageOriginalName,
                    imageUrl: seg.imageUrl,
                    matchScore: seg.matchScore || 90,
                    matchReason: seg.matchReason || 'Chia nhỏ phân đoạn',
                    words: chunkWords
                });
            }
        });

        SubState.segments = newSegments;
        renderCuesList();
        showToast(`✂️ Đã chia nhỏ phụ đề thành ${newSegments.length} phân đoạn (${targetChunkSize} từ/câu)!`);
    }

    // 4. Find & Replace in Subtitles
    function updateFindCount() {
        if (!dom.subFindInput || !dom.subFindCount) return;
        const findText = dom.subFindInput.value;
        if (!findText || !findText.trim()) {
            dom.subFindCount.textContent = '0 kết quả';
            dom.subFindCount.style.color = 'var(--text-dim)';
            return;
        }

        const isCaseSensitive = dom.subFindCaseSensitive ? dom.subFindCaseSensitive.checked : false;
        const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, isCaseSensitive ? 'g' : 'gi');

        let totalMatches = 0;
        SubState.segments.forEach(seg => {
            const text = seg.text || '';
            const matches = text.match(regex);
            if (matches) totalMatches += matches.length;
        });

        dom.subFindCount.textContent = `${totalMatches} kết quả`;
        dom.subFindCount.style.color = totalMatches > 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)';
    }

    function handleReplaceAllSubtitles() {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có danh sách phụ đề nào để thay thế!');
            return;
        }

        const findText = dom.subFindInput ? dom.subFindInput.value : '';
        const replaceText = dom.subReplaceInput ? dom.subReplaceInput.value : '';

        if (!findText) {
            alert('Vui lòng nhập từ khóa cần tìm!');
            return;
        }

        const isCaseSensitive = dom.subFindCaseSensitive ? dom.subFindCaseSensitive.checked : false;
        const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let replaceCount = 0;
        SubState.segments.forEach(seg => {
            if (seg.text) {
                const textRegex = new RegExp(escaped, isCaseSensitive ? 'g' : 'gi');
                const matches = seg.text.match(textRegex);
                if (matches) {
                    replaceCount += matches.length;
                    seg.text = seg.text.replace(textRegex, replaceText);
                }
            }
            if (seg.words && Array.isArray(seg.words)) {
                seg.words.forEach(w => {
                    if (w.word) {
                        const wordRegex = new RegExp(escaped, isCaseSensitive ? 'g' : 'gi');
                        w.word = w.word.replace(wordRegex, replaceText);
                    }
                });
            }
        });

        if (replaceCount > 0) {
            renderCuesList();
            updateFindCount();
            showToast(`🎉 Đã thay thế thành công ${replaceCount} vị trí "${findText}" ➔ "${replaceText}"!`);
        } else {
            alert(`Không tìm thấy từ khóa "${findText}" trong phụ đề!`);
        }
    }

    // 5. Time Shift & Scale Duration Tool
    function shiftAllCuesTime(deltaSec) {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có phân đoạn phụ đề nào để dịch chuyển!');
            return;
        }

        const delta = parseFloat(deltaSec);
        if (isNaN(delta) || delta === 0) return;

        SubState.segments.forEach(seg => {
            seg.start = Math.max(0, parseFloat((seg.start + delta).toFixed(2)));
            seg.end = Math.max(parseFloat((seg.start + 0.1).toFixed(2)), parseFloat((seg.end + delta).toFixed(2)));
            seg.duration = parseFloat(Math.max(0.1, seg.end - seg.start).toFixed(2));

            if (seg.words && Array.isArray(seg.words)) {
                seg.words.forEach(w => {
                    w.start = Math.max(0, parseFloat((w.start + delta).toFixed(2)));
                    w.end = Math.max(parseFloat((w.start + 0.05).toFixed(2)), parseFloat((w.end + delta).toFixed(2)));
                });
            }
        });

        renderCuesList();
        showToast(`⏱️ Đã dời toàn bộ phụ đề ${delta > 0 ? '+' : ''}${delta}s!`);
    }

    function scaleAllCuesDuration(factor) {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có phân đoạn phụ đề nào để co giãn!');
            return;
        }

        const scale = parseFloat(factor);
        if (isNaN(scale) || scale <= 0) return;

        SubState.segments.forEach(seg => {
            seg.start = parseFloat((seg.start * scale).toFixed(2));
            seg.end = Math.max(parseFloat((seg.start + 0.1).toFixed(2)), parseFloat((seg.end * scale).toFixed(2)));
            seg.duration = parseFloat(Math.max(0.1, seg.end - seg.start).toFixed(2));

            if (seg.words && Array.isArray(seg.words)) {
                seg.words.forEach(w => {
                    w.start = parseFloat((w.start * scale).toFixed(2));
                    w.end = Math.max(parseFloat((w.start + 0.05).toFixed(2)), parseFloat((w.end * scale).toFixed(2)));
                });
            }
        });

        renderCuesList();
        showToast(`⚡ Đã co giãn thời lượng toàn bộ phụ đề theo tỉ lệ ${Math.round(scale * 100)}%!`);
    }

    // Presets & Styling Management
    function renderPresetButtons() {
        if (!dom.subPresetsContainer) return;
        let html = '';
        Object.keys(SubState.presets).forEach(key => {
            const p = SubState.presets[key];
            const isActive = SubState.style.preset === key;
            html += `
                <div class="preset-card ${isActive ? 'active' : ''}" data-preset="${key}">
                    <div class="preset-preview-text" style="color: ${p.highlightColor}; text-shadow: 0 0 6px ${p.highlightColor};">
                        ${escapeHtml(p.name)}
                    </div>
                    <div class="preset-name">${p.animationType}</div>
                </div>
            `;
        });
        dom.subPresetsContainer.innerHTML = html;

        dom.subPresetsContainer.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const presetKey = card.dataset.preset;
                applyPreset(presetKey);
            });
        });
    }

    function applyPreset(presetKey) {
        const preset = SubState.presets[presetKey];
        if (!preset) return;

        const currentAspect = SubState.style.aspectRatio || '16:9';
        SubState.style.preset = presetKey;
        Object.assign(SubState.style, preset);
        SubState.style.aspectRatio = currentAspect;

        // Update UI controls
        loadGoogleFontDynamically(preset.fontFamily);
        if (dom.subFontFamily) {
            // Check if font exists in current language dropdown, else switch to vi/en
            const hasOption = Array.from(dom.subFontFamily.options).some(o => o.value === preset.fontFamily);
            if (!hasOption) {
                updateFontDropdownByLanguage('vi', preset.fontFamily);
            } else {
                dom.subFontFamily.value = preset.fontFamily;
            }
        }
        if (dom.subFontSize) dom.subFontSize.value = preset.fontSize;
        if (dom.subFontSizeVal) dom.subFontSizeVal.textContent = `${preset.fontSize}px`;
        if (dom.subPrimaryColor) dom.subPrimaryColor.value = preset.primaryColor;
        if (dom.subHighlightColor) dom.subHighlightColor.value = preset.highlightColor;
        if (dom.subOutlineColor) dom.subOutlineColor.value = preset.outlineColor;
        if (dom.subPosition) dom.subPosition.value = preset.position;
        if (dom.subAnimationType) dom.subAnimationType.value = preset.animationType;

        renderPresetButtons();
        applyStyleToOverlay();
    }

    function updateStyleFromControls() {
        if (dom.subFontFamily) {
            SubState.style.fontFamily = dom.subFontFamily.value;
            loadGoogleFontDynamically(dom.subFontFamily.value);
        }
        if (dom.subFontSize) SubState.style.fontSize = parseInt(dom.subFontSize.value);
        if (dom.subPrimaryColor) SubState.style.primaryColor = dom.subPrimaryColor.value;
        if (dom.subHighlightColor) SubState.style.highlightColor = dom.subHighlightColor.value;
        if (dom.subOutlineColor) SubState.style.outlineColor = dom.subOutlineColor.value;
        if (dom.subPosition) SubState.style.position = dom.subPosition.value;
        if (dom.subAnimationType) SubState.style.animationType = dom.subAnimationType.value;

        applyStyleToOverlay();
    }

    function applyStyleToOverlay() {
        if (!dom.subWordOverlay || !dom.subCaptionBox) return;

        dom.subWordOverlay.className = `sub-word-overlay pos-${SubState.style.position}`;
        if (SubState.style.animationType === 'none') {
            dom.subCaptionBox.classList.add('anim-none');
        } else {
            dom.subCaptionBox.classList.remove('anim-none');
        }
        dom.subCaptionBox.style.fontFamily = `'${SubState.style.fontFamily}', sans-serif`;
        dom.subCaptionBox.style.fontSize = `${SubState.style.fontSize * 0.58}px`;
        dom.subCaptionBox.style.color = SubState.style.primaryColor;
        dom.subCaptionBox.style.paintOrder = 'stroke fill';
        dom.subCaptionBox.style.webkitTextStroke = `${SubState.style.outlineWidth * 0.45}px ${SubState.style.outlineColor}`;
        dom.subCaptionBox.style.textShadow = `0 2px 4px rgba(0,0,0,0.8), 0 0 ${SubState.style.outlineWidth}px ${SubState.style.outlineColor}`;
    }

    // Apply Current Typography & Animation Style To All Cues & Timeline Tab 1
    function applyStyleToAllCuesAndTimeline() {
        updateStyleFromControls();

        const currentStyle = SubState.style;
        let mappedTextStyle = 'banner';
        if (currentStyle.boxBg === 'transparent') {
            mappedTextStyle = currentStyle.animationType === 'glow' ? 'glow' : 'outline';
        }
        const mappedTextPos = currentStyle.position || 'bottom';
        const mappedFontSize = Math.min(64, Math.max(36, currentStyle.fontSize || 48));

        let timelineUpdated = 0;
        if (window.mediaItems && window.mediaItems.length > 0) {
            window.mediaItems.forEach(item => {
                if (!item.settings) item.settings = {};
                item.settings.textPosition = mappedTextPos;
                item.settings.textStyle = mappedTextStyle;
                item.settings.fontSize = mappedFontSize;
                timelineUpdated++;
            });
            if (typeof window.renderMediaList === 'function') {
                window.renderMediaList();
            }
        }

        applyStyleToOverlay();
        renderCuesList();

        const fontName = currentStyle.fontFamily || 'Arial';
        showToast(`✨ Đã áp dụng phong cách (${fontName}, ${currentStyle.fontSize}px, Vị trí: ${mappedTextPos}) cho toàn bộ ${SubState.segments.length} câu phụ đề & ${timelineUpdated} phân cảnh Timeline!`);
    }

    // Export Subtitles Files (.ASS, .SRT)
    async function exportSubtitlesFile(format) {
        if (SubState.segments.length === 0) {
            alert('Chưa có nội dung phụ đề để xuất!');
            return;
        }

        const ratio = SubState.style.aspectRatio || '16:9';
        const videoWidth = ratio === '9:16' ? 1080 : (ratio === '1:1' ? 1080 : 1920);
        const videoHeight = ratio === '9:16' ? 1920 : 1080;

        try {
            const res = await fetch('/api/subtitles/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segments: SubState.segments,
                    format: format,
                    style: SubState.style,
                    videoWidth: videoWidth,
                    videoHeight: videoHeight
                })
            });

            if (!res.ok) throw new Error('Lỗi xuất tệp phụ đề');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subtitles_${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast(`Đã tải về tệp phụ đề .${format.toUpperCase()}!`);
        } catch (err) {
            alert('Lỗi xuất tệp: ' + err.message);
        }
    }

    // Burn Word-Level Subtitles into Video via FFmpeg
    async function burnSubtitlesIntoVideo() {
        if (!SubState.currentMedia || !SubState.currentMedia.filename) {
            alert('Vui lòng chọn hoặc tải lên một tệp Video nguồn để gắn phụ đề!');
            return;
        }
        if (SubState.segments.length === 0) {
            alert('Chưa có câu phụ đề nào để gắn vào video!');
            return;
        }

        const ratio = SubState.style.aspectRatio || '16:9';
        const videoWidth = ratio === '9:16' ? 1080 : (ratio === '1:1' ? 1080 : 1920);
        const videoHeight = ratio === '9:16' ? 1920 : 1080;

        openBurnModal();

        try {
            const res = await fetch('/api/subtitles/burn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoFilename: SubState.currentMedia.filename,
                    segments: SubState.segments,
                    style: SubState.style,
                    videoWidth: videoWidth,
                    videoHeight: videoHeight
                })
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                showBurnError(`Lỗi server (${res.status}): ${text.substring(0, 150)}`);
                return;
            }

            if (data.success && data.jobId) {
                trackBurnProgress(data.jobId);
            } else {
                showBurnError(data.error || 'Không thể bắt đầu render phụ đề');
            }
        } catch (err) {
            showBurnError(err.message);
        }
    }

    function trackBurnProgress(jobId) {
        const eventSource = new EventSource(`/api/subtitles/progress/${jobId}`);

        eventSource.onmessage = (event) => {
            try {
                const job = JSON.parse(event.data);
                if (dom.subBurnPercent) dom.subBurnPercent.textContent = `${job.progress || 0}%`;
                if (dom.subBurnBar) dom.subBurnBar.style.width = `${job.progress || 0}%`;

                if (job.status === 'completed') {
                    eventSource.close();
                    if (dom.subBurnProcessing) dom.subBurnProcessing.classList.add('hidden');
                    if (dom.subBurnCompleted) dom.subBurnCompleted.classList.remove('hidden');
                    if (dom.subBurnVideoPlayer) {
                        dom.subBurnVideoPlayer.src = job.outputUrl;
                        dom.subBurnVideoPlayer.load();
                        dom.subBurnVideoPlayer.play().catch(() => {});
                    }
                    if (dom.subBtnDownloadBurned) {
                        dom.subBtnDownloadBurned.href = job.outputUrl;
                        dom.subBtnDownloadBurned.download = job.outputFilename;
                    }
                } else if (job.status === 'failed') {
                    eventSource.close();
                    showBurnError(job.error || 'Render phụ đề thất bại');
                }
            } catch (e) {
                console.error(e);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };
    }

    function openBurnModal() {
        if (!dom.subBurnModal) return;
        dom.subBurnModal.classList.remove('hidden');
        if (dom.subBurnProcessing) dom.subBurnProcessing.classList.remove('hidden');
        if (dom.subBurnCompleted) dom.subBurnCompleted.classList.add('hidden');
        if (dom.subBurnPercent) dom.subBurnPercent.textContent = '0%';
        if (dom.subBurnBar) dom.subBurnBar.style.width = '0%';
        if (dom.subBurnStatusText) dom.subBurnStatusText.textContent = 'Đang chuyển đổi hiệu ứng phụ đề hoạt họa Word-Level ASS...';
    }

    function showBurnError(msg) {
        if (dom.subBurnStatusText) dom.subBurnStatusText.textContent = `❌ Lỗi: ${msg}`;
    }

    window.closeSubBurnModal = function () {
        if (dom.subBurnModal) dom.subBurnModal.classList.add('hidden');
        if (dom.subBurnVideoPlayer) dom.subBurnVideoPlayer.pause();
    };

    // Sample Demo Loader (SRT + Audio Voiceover)
    function loadSampleSrtDemo() {
        if (dom.subScriptTextarea) {
            dom.subScriptTextarea.value = `1
00:00:00,000 --> 00:00:03,800
Mùa đông Seoul tuyết rơi phủ trắng xóa khắp mọi nẻo đường.

2
00:00:03,800 --> 00:00:07,500
Dừng chân tại một quán cà phê nhỏ ven phố cổ Bukchon.

3
00:00:07,500 --> 00:00:11,200
Hương cà phê thơm lừng xua tan đi cái lạnh buốt giá mùa đông.`;
            showToast('Đã nạp mẫu file phụ đề SRT tiếng Việt!');
        }
    }

    function loadSampleScript() {
        if (dom.subScriptTextarea) {
            dom.subScriptTextarea.value = `Mùa đông Seoul phủ đầy tuyết trắng xóa.
Những bông tuyết nhẹ nhàng rơi trên phố cổ Bukchon.
Cảm giác bình yên giữa lòng thủ đô hiện đại.
Hương thơm cà phê nóng hổi xua tan giá lạnh.`;
            showToast('Đã nạp mẫu kịch bản tiếng Việt!');
        }
    }

    function loadSampleDataIfEmpty() {
        if (SubState.segments.length === 0) {
            SubState.segments = [
                {
                    id: 1,
                    start: 0.0,
                    end: 3.2,
                    duration: 3.2,
                    text: 'Mùa đông Seoul tuyết trắng xóa',
                    imageIndex: 0,
                    matchScore: 98,
                    matchReason: 'Ảnh tuyết trắng Seoul khớp với mở đầu kịch bản',
                    words: [
                        { word: 'Mùa', start: 0.0, end: 0.5 },
                        { word: 'đông', start: 0.5, end: 1.0 },
                        { word: 'Seoul', start: 1.0, end: 1.8 },
                        { word: 'tuyết', start: 1.8, end: 2.3 },
                        { word: 'trắng', start: 2.3, end: 2.8 },
                        { word: 'xóa', start: 2.8, end: 3.2 }
                    ]
                },
                {
                    id: 2,
                    start: 3.2,
                    end: 6.8,
                    duration: 3.6,
                    text: 'Từng bông tuyết nhẹ nhàng rơi',
                    imageIndex: 1,
                    matchScore: 95,
                    matchReason: 'Ảnh phố cổ Bukchon phủ tuyết rơi êm đềm',
                    words: [
                        { word: 'Từng', start: 3.2, end: 3.7 },
                        { word: 'bông', start: 3.7, end: 4.3 },
                        { word: 'tuyết', start: 4.3, end: 5.0 },
                        { word: 'nhẹ', start: 5.0, end: 5.6 },
                        { word: 'nhàng', start: 5.6, end: 6.2 },
                        { word: 'rơi', start: 6.2, end: 6.8 }
                    ]
                },
                {
                    id: 3,
                    start: 6.8,
                    end: 10.5,
                    duration: 3.7,
                    text: 'Hương cà phê ấm nồng giữa lòng thủ đô',
                    imageIndex: 2,
                    matchScore: 94,
                    matchReason: 'Ảnh quán cà phê ấm cúng ven đường',
                    words: [
                        { word: 'Hương', start: 6.8, end: 7.3 },
                        { word: 'cà', start: 7.3, end: 7.8 },
                        { word: 'phê', start: 7.8, end: 8.4 },
                        { word: 'ấm', start: 8.4, end: 8.9 },
                        { word: 'nồng', start: 8.9, end: 9.5 },
                        { word: 'thủ', start: 9.5, end: 10.0 },
                        { word: 'đô', start: 10.0, end: 10.5 }
                    ]
                }
            ];
            renderCuesList();
        }
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 28px;
            right: 28px;
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
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
        }, 3200);
    }

    // =========================================================================
    // SUBTITLE & AUDIO AI AUDIT MODAL (TAB 2)
    // =========================================================================
    async function openSubtitleAuditModal() {
        if (!SubState.segments || SubState.segments.length === 0) {
            alert('Chưa có phân đoạn phụ đề nào để đánh giá! Hãy tạo phụ đề bằng AI hoặc nạp file SRT trước.');
            return;
        }

        if (dom.subAuditModal) dom.subAuditModal.classList.remove('hidden');
        if (dom.subAuditLoading) dom.subAuditLoading.classList.remove('hidden');
        if (dom.subAuditResult) dom.subAuditResult.classList.add('hidden');

        const key = dom.subAiApiKey ? dom.subAiApiKey.value.trim() : '';

        try {
            const res = await fetch('/api/ai/audit-subtitles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segments: SubState.segments,
                    mediaDuration: SubState.currentMedia ? SubState.currentMedia.duration : 0,
                    style: SubState.style,
                    customApiKey: key
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            renderSubtitleAuditResult(data);
        } catch (err) {
            alert('Lỗi kiểm định phụ đề AI: ' + err.message);
            closeSubtitleAuditModal();
        }
    }

    function renderSubtitleAuditResult(data) {
        if (dom.subAuditLoading) dom.subAuditLoading.classList.add('hidden');
        if (dom.subAuditResult) dom.subAuditResult.classList.remove('hidden');

        const audit = data.audit || {};
        const stats = data.stats || {};

        // Overall Score & Verdict
        const scoreVal = document.getElementById('audit-sub-score-val');
        const verdictEl = document.getElementById('audit-sub-verdict');
        const statsLabel = document.getElementById('audit-sub-stats-label');

        if (scoreVal) scoreVal.textContent = audit.overallScore || 90;
        if (verdictEl) verdictEl.textContent = audit.verdict || 'Phụ đề chuẩn xác và khớp giọng đọc!';
        if (statsLabel) statsLabel.textContent = `Tốc độ đọc trung bình: ${stats.avgWpm || 150} WPM • ${stats.totalWords || 0} từ • ${stats.fastSegmentsCount || 0} câu đọc nhanh • ${stats.overlappingCount || 0} câu trùng lấn`;

        // Category scores
        const cats = audit.categoryScores || {};
        setCategoryScoreSub('sub-sync', cats.syncAccuracy || 90);
        setCategoryScoreSub('sub-speed', cats.readingSpeed || 85);
        setCategoryScoreSub('sub-readability', cats.visualReadability || 88);
        setCategoryScoreSub('sub-typography', cats.typography || 92);

        // Strengths
        const strengthsUl = document.getElementById('audit-sub-strengths');
        if (strengthsUl) {
            strengthsUl.innerHTML = (audit.strengths || ['Phụ đề có cấu trúc câu chuẩn.']).map(s => `<li>${escapeHtml(s)}</li>`).join('');
        }

        // Warnings / Flagged Cues
        const warningsUl = document.getElementById('audit-sub-warnings');
        if (warningsUl) {
            let list = [];
            if (audit.warnings && audit.warnings.length > 0) {
                list = audit.warnings;
            } else if (stats.fastSegments && stats.fastSegments.length > 0) {
                list = stats.fastSegments.map(f => `Câu #${f.id}: "${f.text}" (${f.wps} từ/s) - quá nhanh so với thời lượng ${f.duration}s`);
            } else {
                list = ['Không có câu nào bị trùng lấn thời gian hoặc đọc quá nhanh.'];
            }
            warningsUl.innerHTML = list.map(w => `<li>${escapeHtml(w)}</li>`).join('');
        }

        // Recommendations
        const recsUl = document.getElementById('audit-sub-recs');
        if (recsUl) {
            const list = (audit.recommendations && audit.recommendations.length > 0) ? audit.recommendations : ['Có thể bấm "⚡ Gắn Phụ Đề Vào Video (Burn-in)" để xuất video hoàn chỉnh.'];
            recsUl.innerHTML = list.map(r => `<li>${escapeHtml(r)}</li>`).join('');
        }
    }

    function setCategoryScoreSub(id, score) {
        const bar = document.getElementById(`bar-${id}`);
        const num = document.getElementById(`score-${id}`);
        if (bar) bar.style.width = `${Math.min(100, Math.max(10, score))}%`;
        if (num) num.textContent = `${score}%`;
    }

    function closeSubtitleAuditModal() {
        if (dom.subAuditModal) dom.subAuditModal.classList.add('hidden');
    }

    window.closeSubtitleAuditModal = closeSubtitleAuditModal;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

})();
