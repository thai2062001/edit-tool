const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

/**
 * Setup Subtitles & Word-level Captions Routes
 * Modular extension for Ist-dev / FFmpeg Studio
 */
function setupSubtitlesRoutes(app, config) {
    const { UPLOADS_DIR, OUTPUTS_DIR, DEFAULT_GEMINI_API_KEY } = config;

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `sub_${uniqueSuffix}${ext}`);
        }
    });
    const subUpload = multer({ storage });

    // Track active subtitle burn jobs
    const activeSubJobs = new Map();

    // 1. Upload media specifically for subtitle analysis
    app.post('/api/subtitles/upload', subUpload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Không tìm thấy tệp tải lên' });
            }
            const ext = path.extname(req.file.originalname).toLowerCase();
            const isVideo = ['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext);
            const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);

            let duration = 0;
            try {
                duration = await probeMediaDuration(req.file.path);
            } catch (e) {
                duration = 10;
            }

            res.json({
                success: true,
                file: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    path: req.file.path,
                    url: `/uploads/${req.file.filename}`,
                    type: isVideo ? 'video' : (isAudio ? 'audio' : 'other'),
                    duration: parseFloat(duration.toFixed(2))
                }
            });
        } catch (err) {
            console.error('Subtitle upload error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 2. Generate Word-Level Subtitles via Gemini AI
    app.post('/api/subtitles/generate', async (req, res) => {
        try {
            const { mediaFilename, scriptText, customApiKey, mode, maxWordsPerSegment } = req.body;
            const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

            if (!apiKey) {
                return res.status(400).json({ error: 'Vui lòng cung cấp Gemini API Key' });
            }

            const ai = new GoogleGenAI({ apiKey });
            let mediaDuration = 10;
            let audioBase64 = null;
            let mimeType = 'audio/mp3';

            if (mediaFilename) {
                const mediaPath = path.join(UPLOADS_DIR, mediaFilename);
                if (fs.existsSync(mediaPath)) {
                    try {
                        const [dur, base64Audio] = await Promise.all([
                            probeMediaDuration(mediaPath),
                            extractLightweightAudioBuffer(mediaPath)
                        ]);
                        mediaDuration = dur || 10;
                        if (base64Audio) {
                            audioBase64 = base64Audio;
                            mimeType = 'audio/mp3';
                        }
                    } catch (mediaErr) {
                        console.warn('Media processing warning:', mediaErr.message);
                    }
                }
            }

            const contents = [];

            if (audioBase64) {
                contents.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: audioBase64
                    }
                });
            }

            const chunkWords = parseInt(maxWordsPerSegment) || 4;

            let promptText = `
Bạn là chuyên gia tạo phụ đề video chuyên nghiệp (CapCut / TikTok Style Subtitle Specialist).
Nhiệm vụ: Tạo danh sách các câu phụ đề kèm mốc thời gian chi tiết từng từ (word-level timestamps) để làm hiệu ứng Karaoke / Word-level Animation.

`;

            if (audioBase64) {
                promptText += `
Hãy lắng nghe kỹ file âm thanh đính kèm (tổng thời lượng: ${mediaDuration.toFixed(1)}s).
${scriptText && scriptText.trim() ? `Tham khảo kịch bản gốc nếu cần: """${scriptText.trim().slice(0, 5000)}"""` : 'Hãy tự động chép lời (transcribe) chính xác từng từ từ giọng nói.'}
`;
            } else if (scriptText && scriptText.trim()) {
                promptText += `
Phân tích kịch bản sau và căn chỉnh mốc thời gian ước tính hợp lý trong tổng thời lượng ${mediaDuration.toFixed(1)} giây:
"""
${scriptText.trim().slice(0, 8000)}
"""
`;
            } else {
                return res.status(400).json({ error: 'Cần cung cấp file âm thanh/video hoặc nội dung kịch bản' });
            }

            promptText += `
YÊU CẦU ĐỊNH DẠNG:
- Chia thành các cụm từ ngắn gọn, tự nhiên (${chunkWords} - ${chunkWords + 2} từ mỗi câu) phù hợp phong cách video ngắn TikTok/Shorts.
- Mỗi câu (cue/segment) có 'start' (giây, float), 'end' (giây, float), 'text' (nội dung câu), và mảng 'words' gồm từng từ riêng biệt với start, end của từng từ.
- 'start' và 'end' của từ phải liên tục và khớp với start/end của câu.
- Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:
{
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 2.4,
      "text": "Chào mừng bạn đến với",
      "words": [
        { "word": "Chào", "start": 0.0, "end": 0.5 },
        { "word": "mừng", "start": 0.5, "end": 1.0 },
        { "word": "bạn", "start": 1.0, "end": 1.5 },
        { "word": "đến", "start": 1.5, "end": 1.9 },
        { "word": "với", "start": 1.9, "end": 2.4 }
      ]
    }
  ]
}
`;

            contents.push({ text: promptText });

            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: contents,
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const rawText = response.text || '';
            let parsed = null;
            try {
                const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanJson);
            } catch (err) {
                console.error('Failed to parse Gemini subtitle JSON:', rawText);
                return res.status(500).json({ error: 'Không thể phân tích dữ liệu phụ đề từ AI', raw: rawText });
            }

            const rawSegments = parsed.segments || (Array.isArray(parsed) ? parsed : []);
            // Normalize segments
            const segments = rawSegments.map((seg, idx) => {
                const segStart = parseFloat(seg.start || 0);
                const segEnd = parseFloat(seg.end || (segStart + 2.0));
                const text = (seg.text || '').trim();
                let words = Array.isArray(seg.words) ? seg.words : [];

                if (words.length === 0 && text) {
                    // Fallback create even word breakdown
                    const splitted = text.split(/\s+/).filter(Boolean);
                    const wordDur = Math.max(0.1, (segEnd - segStart) / Math.max(1, splitted.length));
                    words = splitted.map((w, wIdx) => ({
                        word: w,
                        start: parseFloat((segStart + wIdx * wordDur).toFixed(2)),
                        end: parseFloat((segStart + (wIdx + 1) * wordDur).toFixed(2))
                    }));
                } else {
                    words = words.map(w => ({
                        word: (w.word || w.text || '').trim(),
                        start: parseFloat(Number(w.start || segStart).toFixed(2)),
                        end: parseFloat(Number(w.end || segEnd).toFixed(2))
                    }));
                }

                return {
                    id: seg.id || (idx + 1),
                    start: parseFloat(segStart.toFixed(2)),
                    end: parseFloat(segEnd.toFixed(2)),
                    text: text || words.map(w => w.word).join(' '),
                    words
                };
            });

            res.json({
                success: true,
                segments,
                totalSegments: segments.length,
                mediaDuration
            });

        } catch (err) {
            console.error('Subtitle generate error:', err);
            res.status(500).json({ error: err.message || 'Lỗi khi gọi Gemini AI Subtitle' });
        }
    });

    // 2.5. AI Audio-SRT-Image Sync & Semantic Validation
    app.post('/api/subtitles/sync-audio-srt', async (req, res) => {
        try {
            const { audioFilename, srtText, images, customApiKey } = req.body;
            const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

            if (!apiKey) {
                return res.status(400).json({ error: 'Vui lòng cung cấp Gemini API Key' });
            }
            if (!audioFilename) {
                return res.status(400).json({ error: 'Vui lòng chọn hoặc tải lên file Audio lồng tiếng' });
            }
            if (!srtText || !srtText.trim()) {
                return res.status(400).json({ error: 'Vui lòng cung cấp nội dung kịch bản hoặc file phụ đề SRT' });
            }

            const audioPath = path.join(UPLOADS_DIR, audioFilename);
            if (!fs.existsSync(audioPath)) {
                return res.status(404).json({ error: 'Không tìm thấy tệp audio trên server' });
            }

            let audioDuration = 10;
            try {
                audioDuration = await probeMediaDuration(audioPath);
            } catch (e) {}

            // Parse initial SRT cues
            const rawParsedSrt = parseSrtOrTextCues(srtText);

            // Extract audio base64 for Gemini
            let audioBase64 = null;
            try {
                const tempAudio = path.join(UPLOADS_DIR, `temp_sync_${Date.now()}.mp3`);
                await extractLightweightAudio(audioPath, tempAudio);
                if (fs.existsSync(tempAudio)) {
                    const buf = fs.readFileSync(tempAudio);
                    if (buf.length <= 20 * 1024 * 1024) {
                        audioBase64 = buf.toString('base64');
                    }
                    try { fs.unlinkSync(tempAudio); } catch (e) {}
                }
            } catch (e) {
                console.warn('Audio extraction warning:', e.message);
            }

            const ai = new GoogleGenAI({ apiKey });
            const contents = [];

            // 1. Add audio part
            if (audioBase64) {
                contents.push({
                    inlineData: {
                        mimeType: 'audio/mp3',
                        data: audioBase64
                    }
                });
            }

            // 2. Add image thumbnails in parallel for blazing speed
            const imageList = Array.isArray(images) ? images : [];
            const maxThumbs = Math.min(15, imageList.length);

            const thumbTasks = imageList.slice(0, maxThumbs).map(async (img, i) => {
                if (img && img.filename) {
                    const imgPath = path.join(UPLOADS_DIR, img.filename);
                    if (fs.existsSync(imgPath)) {
                        const thumbBase64 = await getThumbnailBase64(imgPath);
                        if (thumbBase64) {
                            return {
                                index: i,
                                name: img.originalName || img.filename,
                                data: thumbBase64
                            };
                        }
                    }
                }
                return null;
            });

            const processedThumbs = await Promise.all(thumbTasks);
            processedThumbs.forEach(t => {
                if (t && t.data) {
                    contents.push({ text: `[IMAGE_${t.index}] Tên: ${t.name}` });
                    contents.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: t.data
                        }
                    });
                }
            });

            // 3. Prompt for Gemini
            const srtSummary = rawParsedSrt.map((c, idx) => `#${idx + 1}: "${c.text}"`).join('\n');
            const promptText = `
Bạn là Đạo diễn kiêm Kỹ sư âm thanh chuyên nghiệp.
Nhiệm vụ:
1. Hãy nghe kỹ file audio lồng tiếng (tổng thời lượng: ${audioDuration.toFixed(2)} giây).
2. Khớp chính xác từng câu trong kịch bản/SRT sau với mốc thời gian bắt đầu (start) và kết thúc (end) trong Audio:
--- DANH SÁCH CÂU KỊCH BẢN / SRT ---
${srtSummary}
-------------------------------------
3. Đối chiếu câu thoại với ${imageList.length} bức ảnh đã cung cấp (IMAGE_0 đến IMAGE_${Math.max(0, imageList.length - 1)}):
   - Đánh giá xem bức ảnh nào khớp nhất với nội dung câu thoại (thường theo thứ tự hoặc ngữ cảnh).
   - Chấm điểm độ khớp (matchScore từ 0 đến 100).
   - Đưa ra lý do ngắn gọn bằng tiếng Việt (matchReason, ví dụ: "Ảnh quán cà phê ấm cúng khớp với lời thoại kể về dừng chân uống cà phê").
4. Chia nhỏ từng câu thành danh sách từng từ kèm start/end từng từ (word-level timestamps).

YÊU CẦU ĐỊNH DẠNG:
Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:
{
  "alignedCues": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.8,
      "duration": 3.8,
      "text": "Mùa đông Seoul tuyết rơi phủ trắng xóa",
      "imageIndex": 0,
      "matchScore": 98,
      "matchReason": "Ảnh tuyết trắng khớp hoàn hảo với câu mở đầu về mùa đông Seoul",
      "words": [
        { "word": "Mùa", "start": 0.0, "end": 0.5 },
        { "word": "đông", "start": 0.5, "end": 1.0 },
        { "word": "Seoul", "start": 1.0, "end": 1.8 },
        { "word": "tuyết", "start": 1.8, "end": 2.3 },
        { "word": "rơi", "start": 2.3, "end": 2.8 },
        { "word": "phủ", "start": 2.8, "end": 3.1 },
        { "word": "trắng", "start": 3.1, "end": 3.5 },
        { "word": "xóa", "start": 3.5, "end": 3.8 }
      ]
    }
  ]
}
`;

            contents.push({ text: promptText });

            let alignedCues = [];
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.6-flash',
                    contents: contents,
                    config: {
                        responseMimeType: 'application/json'
                    }
                });

                const rawText = response.text || '';
                const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                alignedCues = parsed.alignedCues || (Array.isArray(parsed) ? parsed : []);
            } catch (aiErr) {
                console.warn('Gemini sync call error, using fallback aligner:', aiErr.message);
                alignedCues = fallbackSrtAlignment(rawParsedSrt, audioDuration, imageList);
            }

            // Normalize and attach image metadata
            const finalCues = alignedCues.map((cue, idx) => {
                const start = parseFloat(Number(cue.start || (idx * (audioDuration / Math.max(1, alignedCues.length)))).toFixed(2));
                const end = parseFloat(Number(cue.end || (start + 3.0)).toFixed(2));
                const dur = parseFloat(Math.max(0.5, end - start).toFixed(2));
                const imgIdx = typeof cue.imageIndex === 'number' ? cue.imageIndex : (idx % Math.max(1, imageList.length));
                const matchedImg = imageList[imgIdx] || null;

                let words = Array.isArray(cue.words) ? cue.words : [];
                if (words.length === 0 && cue.text) {
                    const splitted = cue.text.split(/\s+/).filter(Boolean);
                    const wDur = dur / Math.max(1, splitted.length);
                    words = splitted.map((w, wIdx) => ({
                        word: w,
                        start: parseFloat((start + wIdx * wDur).toFixed(2)),
                        end: parseFloat((start + (wIdx + 1) * wDur).toFixed(2))
                    }));
                } else {
                    words = words.map(w => ({
                        word: (w.word || w.text || '').trim(),
                        start: parseFloat(Number(w.start || start).toFixed(2)),
                        end: parseFloat(Number(w.end || end).toFixed(2))
                    }));
                }

                return {
                    id: cue.id || (idx + 1),
                    start,
                    end,
                    duration: dur,
                    text: cue.text || (rawParsedSrt[idx] ? rawParsedSrt[idx].text : `Phân đoạn ${idx + 1}`),
                    imageIndex: imgIdx,
                    imageFilename: matchedImg ? matchedImg.filename : null,
                    imageOriginalName: matchedImg ? (matchedImg.originalName || matchedImg.filename) : `Ảnh ${imgIdx + 1}`,
                    imageUrl: matchedImg ? matchedImg.url : null,
                    matchScore: cue.matchScore || (matchedImg ? 92 : 80),
                    matchReason: cue.matchReason || (matchedImg ? `Khớp với hình ảnh #${imgIdx + 1}` : 'Tự động ghép theo thứ tự'),
                    words
                };
            });

            res.json({
                success: true,
                alignedCues: finalCues,
                totalDuration: parseFloat(audioDuration.toFixed(2)),
                audioFilename,
                audioUrl: `/uploads/${audioFilename}`,
                totalCues: finalCues.length
            });

        } catch (err) {
            console.error('Sync audio-srt error:', err);
            res.status(500).json({ error: err.message || 'Lỗi khi đồng bộ Audio và SRT' });
        }
    });

    // 3. Export Subtitle Files (.ASS, .SRT, .VTT)
    app.post('/api/subtitles/export', (req, res) => {
        try {
            const { segments, format, style, videoWidth, videoHeight } = req.body;
            if (!segments || segments.length === 0) {
                return res.status(400).json({ error: 'Không có dữ liệu phụ đề' });
            }

            const w = videoWidth || 1080;
            const h = videoHeight || 1920;
            const fmt = (format || 'ass').toLowerCase();

            let content = '';
            let contentType = 'text/plain';
            let fileExt = fmt;

            if (fmt === 'ass') {
                content = generateAssSubtitle(segments, style || {}, w, h);
                contentType = 'text/x-ssa';
            } else if (fmt === 'srt') {
                content = generateSrtSubtitle(segments);
                contentType = 'application/x-subrip';
            } else if (fmt === 'vtt') {
                content = generateVttSubtitle(segments);
                contentType = 'text/vtt';
            }

            res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
            res.setHeader('Content-Disposition', `attachment; filename="subtitles_${Date.now()}.${fileExt}"`);
            res.send(content);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 4. Burn Word-Level Subtitles into Video via FFmpeg
    app.post('/api/subtitles/burn', async (req, res) => {
        try {
            const { videoFilename, segments, style, videoWidth, videoHeight } = req.body;

            if (!videoFilename) {
                return res.status(400).json({ error: 'Chưa chọn video để gắn phụ đề' });
            }
            if (!segments || segments.length === 0) {
                return res.status(400).json({ error: 'Không có danh sách phụ đề' });
            }

            // Find video file in uploads or outputs
            let inputVideoPath = path.join(UPLOADS_DIR, videoFilename);
            if (!fs.existsSync(inputVideoPath)) {
                inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
            }
            if (!fs.existsSync(inputVideoPath)) {
                return res.status(404).json({ error: 'Không tìm thấy tệp video nguồn' });
            }

            const w = parseInt(videoWidth) || 1080;
            const h = parseInt(videoHeight) || 1920;

            const jobId = 'sub_burn_' + Date.now();
            const outputFilename = `subbed_${Date.now()}.mp4`;
            const outputPath = path.join(OUTPUTS_DIR, outputFilename);
            const assFilename = `temp_${jobId}.ass`;
            const assPath = path.join(OUTPUTS_DIR, assFilename);

            // Generate styled ASS file
            const assContent = generateAssSubtitle(segments, style || {}, w, h);
            fs.writeFileSync(assPath, assContent, 'utf8');

            const job = {
                id: jobId,
                status: 'processing',
                progress: 0,
                outputUrl: null,
                outputFilename,
                error: null,
                clients: []
            };
            activeSubJobs.set(jobId, job);

            res.json({ success: true, jobId, outputFilename });

            // Run FFmpeg to burn subtitles
            executeSubBurn(job, inputVideoPath, assPath, outputPath);

        } catch (err) {
            console.error('Subtitle burn error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 5. SSE Progress tracking for subtitle burning
    app.get('/api/subtitles/progress/:jobId', (req, res) => {
        const job = activeSubJobs.get(req.params.jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write(`data: ${JSON.stringify({
            status: job.status,
            progress: job.progress,
            outputUrl: job.outputUrl,
            error: job.error
        })}\n\n`);

        job.clients.push(res);

        req.on('close', () => {
            job.clients = job.clients.filter(c => c !== res);
        });
    });

    async function executeSubBurn(job, inputVideoPath, assPath, outputPath) {
        // Probe input video duration to compute accurate percentage
        let totalDuration = 10;
        try {
            totalDuration = await probeMediaDuration(inputVideoPath);
        } catch (e) {}

        // Run FFmpeg inside OUTPUTS_DIR so we can use simple relative filename for the ASS filter
        const relAssFilename = path.basename(assPath);
        const args = [
            '-y',
            '-threads', '0',
            '-i', inputVideoPath,
            '-vf', `ass=${relAssFilename}`,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '20',
            '-c:a', 'copy',
            '-movflags', '+faststart',
            outputPath
        ];

        console.log('Starting Subtitle Burn with FFmpeg (CWD:', OUTPUTS_DIR, '):', args.join(' '));

        const proc = spawn('ffmpeg', args, { cwd: OUTPUTS_DIR });
        let stderrLog = '';

        proc.stderr.on('data', data => {
            const str = data.toString();
            stderrLog += str;
            
            // Parse time format: time=00:01:23.45
            const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
            if (timeMatch && totalDuration > 0) {
                const hours = parseFloat(timeMatch[1]);
                const mins = parseFloat(timeMatch[2]);
                const secs = parseFloat(timeMatch[3]);
                const currentTime = (hours * 3600) + (mins * 60) + secs;
                const percent = Math.min(98, Math.round((currentTime / totalDuration) * 100));
                job.progress = Math.max(job.progress || 0, percent);
                notifySubJobClients(job);
            }
        });

        proc.on('close', (code) => {
            try { if (fs.existsSync(assPath)) fs.unlinkSync(assPath); } catch (e) {}

            if (code === 0) {
                job.status = 'completed';
                job.progress = 100;
                job.outputUrl = `/outputs/${job.outputFilename}`;
                notifySubJobClients(job);
                console.log('Subtitle Burn completed successfully:', job.outputFilename);
            } else {
                console.error('Sub burn error:', stderrLog.slice(-500));
                job.status = 'failed';
                job.error = `FFmpeg exit code ${code}: ${stderrLog.slice(-200)}`;
                notifySubJobClients(job);
            }
        });

        proc.on('error', (err) => {
            try { if (fs.existsSync(assPath)) fs.unlinkSync(assPath); } catch (e) {}
            job.status = 'failed';
            job.error = err.message;
            notifySubJobClients(job);
        });
    }

    function notifySubJobClients(job) {
        job.clients.forEach(res => {
            res.write(`data: ${JSON.stringify({
                status: job.status,
                progress: job.progress,
                outputUrl: job.outputUrl,
                error: job.error
            })}\n\n`);
        });
    }
}

/**
 * Probe media duration helper
 */
function probeMediaDuration(filePath) {
    return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath
        ]);
        let output = '';
        ffprobe.stdout.on('data', data => output += data.toString());
        ffprobe.on('close', () => {
            const dur = parseFloat(output.trim());
            resolve(isNaN(dur) ? 10 : dur);
        });
        ffprobe.on('error', () => resolve(10));
    });
}

/**
 * Extract low-bitrate MP3 directly to in-memory Base64 for fast AI processing
 */
function extractLightweightAudioBuffer(inputPath) {
    return new Promise((resolve) => {
        const proc = spawn('ffmpeg', [
            '-threads', '0',
            '-i', inputPath,
            '-vn',
            '-sn',
            '-dn',
            '-ar', '16000',
            '-ac', '1',
            '-b:a', '32k',
            '-f', 'mp3',
            'pipe:1'
        ]);
        const chunks = [];
        proc.stdout.on('data', d => chunks.push(d));
        proc.on('close', (code) => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks).toString('base64'));
            } else {
                resolve(null);
            }
        });
        proc.on('error', () => resolve(null));
    });
}

/**
 * Extract low-bitrate MP3 for fast AI processing (file-based legacy fallback)
 */
function extractLightweightAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
            '-y',
            '-threads', '0',
            '-i', inputPath,
            '-vn',
            '-sn',
            '-dn',
            '-ar', '16000',
            '-ac', '1',
            '-b:a', '32k',
            outputPath
        ]);
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Extract audio code ${code}`));
        });
        proc.on('error', reject);
    });
}

/**
 * Generate ultra-lightweight thumbnail base64 for Gemini vision
 */
function getThumbnailBase64(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffmpeg', [
            '-y', '-i', filePath,
            '-vf', 'scale=320:-1:flags=bilinear',
            '-q:v', '7',
            '-frames:v', '1',
            '-f', 'image2pipe',
            '-vcodec', 'mjpeg',
            'pipe:1'
        ]);
        const chunks = [];
        proc.stdout.on('data', d => chunks.push(d));
        proc.on('close', (code) => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks).toString('base64'));
            } else {
                try {
                    resolve(fs.readFileSync(filePath).toString('base64'));
                } catch (e) {
                    resolve(null);
                }
            }
        });
        proc.on('error', () => {
            try {
                resolve(fs.readFileSync(filePath).toString('base64'));
            } catch (e) {
                resolve(null);
            }
        });
    });
}

/**
 * Parse SRT, VTT, or plain text lines into structured cues
 */
function parseSrtOrTextCues(content) {
    if (!content || !content.trim()) return [];
    const cues = [];
    
    // Normalize newlines
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Check if standard SRT / VTT format
    const srtBlockRegex = /(?:(\d+)\n)?(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\n([\s\S]*?)(?=\n\s*\n|\n*$)/g;
    let match;
    let hasSrtMatches = false;

    while ((match = srtBlockRegex.exec(text)) !== null) {
        hasSrtMatches = true;
        const id = match[1] ? parseInt(match[1]) : (cues.length + 1);
        const startTime = parseTimeToSeconds(match[2]);
        const endTime = parseTimeToSeconds(match[3]);
        const rawText = match[4].replace(/<[^>]+>/g, '').trim(); // strip html tags

        if (rawText) {
            cues.push({
                id,
                start: startTime,
                end: endTime,
                text: rawText.replace(/\n+/g, ' ')
            });
        }
    }

    if (hasSrtMatches && cues.length > 0) {
        return cues;
    }

    // Fallback: parse by non-empty lines / paragraphs
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^\d+$/.test(l) && !/^\d{2}:/.test(l));
    return lines.map((line, idx) => ({
        id: idx + 1,
        start: 0,
        end: 0,
        text: line
    }));
}

function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().replace(',', '.').split(':');
    if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr) || 0;
}

/**
 * Fallback alignment when Gemini AI fails or returns invalid JSON
 */
function fallbackSrtAlignment(parsedCues, totalDuration, imageList) {
    const count = Math.max(1, parsedCues.length);
    const avgDuration = Math.max(1.5, totalDuration / count);

    return parsedCues.map((cue, idx) => {
        const start = parseFloat((idx * avgDuration).toFixed(2));
        const end = parseFloat(Math.min(totalDuration, (idx + 1) * avgDuration).toFixed(2));
        const dur = Math.max(0.5, end - start);
        const imgIdx = idx % Math.max(1, imageList.length);
        const img = imageList[imgIdx];

        const words = cue.text.split(/\s+/).filter(Boolean);
        const wDur = dur / Math.max(1, words.length);
        const timedWords = words.map((w, wIdx) => ({
            word: w,
            start: parseFloat((start + wIdx * wDur).toFixed(2)),
            end: parseFloat((start + (wIdx + 1) * wDur).toFixed(2))
        }));

        return {
            id: idx + 1,
            start,
            end,
            duration: parseFloat(dur.toFixed(2)),
            text: cue.text,
            imageIndex: imgIdx,
            matchScore: 90,
            matchReason: img ? `Ghép nối tiếp với hình ảnh ${img.originalName || img.filename}` : 'Khớp phân cảnh chuẩn',
            words: timedWords
        };
    });
}

/**
 * Convert seconds to ASS timestamp (H:MM:SS.CC)
 */
function formatAssTime(sec) {
    const s = Math.max(0, parseFloat(sec) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const centis = Math.floor((s % 1) * 100);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/**
 * Convert color hex (e.g. #FFFF00) to ASS format &H00BBGGRR&
 */
function hexToAssColor(hex, defaultAss = '&H00FFFFFF&') {
    if (!hex) return defaultAss;
    const clean = hex.replace('#', '').trim();
    if (clean.length === 6) {
        const r = clean.substring(0, 2);
        const g = clean.substring(2, 4);
        const b = clean.substring(4, 6);
        return `&H00${b}${g}${r}&`;
    }
    return defaultAss;
}

/**
 * Windows Safe System Font Map for FFmpeg libass subtitle burning
 */
const FONT_SYSTEM_MAP = {
    'montserrat': 'Segoe UI',
    'inter': 'Segoe UI',
    'roboto': 'Arial',
    'poppins': 'Segoe UI',
    'outfit': 'Segoe UI',
    'oswald': 'Impact',
    'bebas neue': 'Impact',
    'anton': 'Impact',
    'righteous': 'Arial Black',
    'cinzel': 'Times New Roman',
    'rubik': 'Segoe UI',
    'bungee': 'Impact',
    'jetbrains mono': 'Consolas',
    'noto sans kr': 'Malgun Gothic',
    'gowun dodum': 'Malgun Gothic',
    'nanum gothic': 'Malgun Gothic',
    'black han sans': 'Malgun Gothic',
    'do hyeon': 'Malgun Gothic',
    'noto sans jp': 'MS Gothic',
    'noto sans sc': 'Microsoft YaHei',
    'noto sans ru': 'Arial'
};

function resolveSafeSystemFont(fontName) {
    if (!fontName) return 'Arial';
    const clean = fontName.trim().toLowerCase();
    return FONT_SYSTEM_MAP[clean] || fontName.trim();
}

/**
 * Generate Advanced SubStation Alpha (.ass) with Word-Level Karaoke Animation & Aspect Ratio Safe Zones
 */
function generateAssSubtitle(segments, style, videoWidth = 1080, videoHeight = 1920) {
    const ratio = style.aspectRatio || '16:9';
    let resX = videoWidth;
    let resY = videoHeight;
    let defaultMarginV = Math.round(resY * 0.10);
    let defaultMarginL = 40;
    let defaultMarginR = 40;

    if (ratio === '9:16' || (resY > resX)) {
        resX = 1080;
        resY = 1920;
        // Safe zone for TikTok / Shorts / Reels (avoids right like/share buttons and bottom caption/sound bar)
        defaultMarginV = style.position === 'center' ? 0 : (style.position === 'top' ? 180 : 380);
        defaultMarginL = 60;
        defaultMarginR = 140; // Avoid TikTok right-hand action column
    } else if (ratio === '1:1') {
        resX = 1080;
        resY = 1080;
        defaultMarginV = style.position === 'center' ? 0 : (style.position === 'top' ? 80 : 140);
        defaultMarginL = 50;
        defaultMarginR = 50;
    } else {
        // 16:9
        resX = 1920;
        resY = 1080;
        defaultMarginV = style.position === 'center' ? 0 : (style.position === 'top' ? 80 : 100);
        defaultMarginL = 60;
        defaultMarginR = 60;
    }

    const rawFontName = style.fontFamily || 'Arial';
    const fontName = resolveSafeSystemFont(rawFontName);
    const baseFontSize = parseInt(style.fontSize) || 40;
    const scaledFontSize = Math.round(baseFontSize * (resY / 1080));

    const primaryColor = hexToAssColor(style.primaryColor, '&H00FFFFFF&');
    const highlightColor = hexToAssColor(style.highlightColor || '#FFDD00', '&H0000FFFF&');
    const outlineColor = hexToAssColor(style.outlineColor || '#000000', '&H00000000&');
    const backColor = hexToAssColor(style.boxColor || '#000000', '&H80000000&');
    const outline = parseInt(style.outlineWidth) || 3;
    const shadow = parseInt(style.shadow) || 2;
    const alignment = style.position === 'top' ? 8 : (style.position === 'center' ? 5 : 2);
    const marginV = parseInt(style.marginV) || defaultMarginV;
    const marginL = parseInt(style.marginL) || defaultMarginL;
    const marginR = parseInt(style.marginR) || defaultMarginR;

    const animationType = style.animationType || 'karaoke_fill'; // 'karaoke_fill', 'bounce', 'pop', 'word_flash'

    let ass = `[Script Info]
Title: Auto Word-Level Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${resX}
PlayResY: ${resY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${scaledFontSize},${primaryColor},${highlightColor},${outlineColor},${backColor},-1,0,0,0,100,100,1,0,1,${outline},${shadow},${alignment},${marginL},${marginR},${marginV},1
Style: Highlight,${fontName},${scaledFontSize},${highlightColor},${primaryColor},${outlineColor},${backColor},-1,0,0,0,100,100,1,0,1,${outline},${shadow},${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    segments.forEach(seg => {
        const segStart = seg.start;
        const segEnd = seg.end;
        const words = seg.words || [];

        if (animationType === 'none' || words.length === 0) {
            ass += `Dialogue: 0,${formatAssTime(segStart)},${formatAssTime(segEnd)},Default,,0,0,0,,${escapeAssText(seg.text || words.map(w => w.word).join(' '))}\n`;
            return;
        }

        if (animationType === 'karaoke_fill') {
            // Standard ASS Karaoke tag (\k<centiseconds>)
            let karaokeLine = '';
            words.forEach(w => {
                const durCentis = Math.max(1, Math.round(((w.end - w.start) * 100)));
                karaokeLine += `{\\kf${durCentis}}${escapeAssText(w.word)} `;
            });
            ass += `Dialogue: 0,${formatAssTime(segStart)},${formatAssTime(segEnd)},Default,,0,0,0,,${karaokeLine.trim()}\n`;

        } else if (animationType === 'bounce' || animationType === 'pop') {
            // Distinct dialog line for each active word highlighting with zoom/bounce
            words.forEach((activeWord, wIdx) => {
                const wStart = Math.max(segStart, activeWord.start);
                const wEnd = Math.min(segEnd, activeWord.end);

                let lineContent = '';
                words.forEach((w, i) => {
                    if (i === wIdx) {
                        // Highlight active word with color & slight scale pop
                        lineContent += `{\\c${highlightColor}\\t(0,80,\\fscx115\\fscy115)\\t(80,160,\\fscx100\\fscy100)}${escapeAssText(w.word)}{\\rDefault} `;
                    } else {
                        lineContent += `${escapeAssText(w.word)} `;
                    }
                });

                ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Default,,0,0,0,,${lineContent.trim()}\n`;
            });

        } else if (animationType === 'single_word') {
            // Only show the single active word in big impact style
            words.forEach(w => {
                const wStart = w.start;
                const wEnd = w.end;
                ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Highlight,,0,0,0,,{\\fscx110\\fscy110}${escapeAssText(w.word)}\n`;
            });

        } else {
            // Word highlight without pop
            words.forEach((activeWord, wIdx) => {
                const wStart = Math.max(segStart, activeWord.start);
                const wEnd = Math.min(segEnd, activeWord.end);

                let lineContent = '';
                words.forEach((w, i) => {
                    if (i === wIdx) {
                        lineContent += `{\\c${highlightColor}}${escapeAssText(w.word)}{\\c${primaryColor}} `;
                    } else {
                        lineContent += `${escapeAssText(w.word)} `;
                    }
                });

                ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Default,,0,0,0,,${lineContent.trim()}\n`;
            });
        }
    });

    return ass;
}

function escapeAssText(text) {
    if (!text) return '';
    return text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

function generateSrtSubtitle(segments) {
    let srt = '';
    segments.forEach((seg, idx) => {
        srt += `${idx + 1}\n`;
        srt += `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n`;
        srt += `${seg.text}\n\n`;
    });
    return srt;
}

function formatSrtTime(sec) {
    const s = Math.max(0, parseFloat(sec) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function generateVttSubtitle(segments) {
    let vtt = 'WEBVTT\n\n';
    segments.forEach((seg, idx) => {
        vtt += `${idx + 1}\n`;
        vtt += `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n`;
        vtt += `${seg.text}\n\n`;
    });
    return vtt;
}

function formatVttTime(sec) {
    const s = Math.max(0, parseFloat(sec) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

module.exports = {
    setupSubtitlesRoutes,
    generateAssSubtitle,
    generateSrtSubtitle,
    generateVttSubtitle
};
