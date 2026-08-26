const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Default API Key
const DEFAULT_GEMINI_API_KEY = 'AQ.Ab8RN6JMEe8jCjohN1xaI2N70KtihaOv6Jd_Q-Ke2baWI6n-nA';

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
const PUBLIC_DIR = path.join(__dirname, 'public');

[UPLOADS_DIR, OUTPUTS_DIR, PUBLIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/outputs', express.static(OUTPUTS_DIR));

// Modular Subtitle / Word-Level Captions Extension
try {
    const { setupSubtitlesRoutes } = require('./subtitles');
    setupSubtitlesRoutes(app, { UPLOADS_DIR, OUTPUTS_DIR, DEFAULT_GEMINI_API_KEY });
} catch (subErr) {
    console.error('Subtitle module load notice:', subErr.message);
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ storage });

// Active jobs tracker
const activeJobs = new Map();

// Helper to probe video duration
function getMediaDuration(filePath) {
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
            resolve(isNaN(dur) ? 5 : dur);
        });
        ffprobe.on('error', () => resolve(5));
    });
}

// Upload API
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const filesData = [];
        for (const file of req.files) {
            const ext = path.extname(file.originalname).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext);
            const isVideo = ['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext);
            const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);

            let type = 'unknown';
            let duration = 5.0; // default for images (5.0s for smooth, elegant pacing)

            if (isImage) {
                type = 'image';
                duration = 5.0;
            } else if (isVideo) {
                type = 'video';
                duration = await getMediaDuration(file.path);
            } else if (isAudio) {
                type = 'audio';
                duration = await getMediaDuration(file.path);
            }

            filesData.push({
                id: path.parse(file.filename).name,
                filename: file.filename,
                originalName: file.originalname,
                path: file.path,
                url: `/uploads/${file.filename}`,
                type,
                duration: parseFloat(duration.toFixed(2)),
                settings: {
                    duration: type === 'image' ? 5.0 : parseFloat(duration.toFixed(2)),
                    motion: 'zoom_in', // zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down, zoom_pan, zoom_in_left, zoom_in_right, none
                    zoomIntensity: 1.25,
                    fadeIn: 0.8,
                    fadeOut: 0.8,
                    fitMode: 'cover', // cover, contain
                    videoVolume: 1.0,
                    trimStart: 0,
                    trimEnd: type === 'video' ? parseFloat(duration.toFixed(2)) : 0,
                    overlayText: '',
                    textPosition: 'bottom',
                    textStyle: 'banner',
                    fontSize: 48,
                    textAnimation: 'always'
                }
            });
        }

        res.json({ success: true, files: filesData });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper to generate ultra-lightweight thumbnail base64 for Gemini vision
function getThumbnailBase64(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffmpeg', [
            '-y', '-i', filePath,
            '-vf', 'scale=400:-1',
            '-q:v', '5',
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
                // Fallback to reading file directly
                try {
                    const data = fs.readFileSync(filePath).toString('base64');
                    resolve(data);
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

// AI Script Matching API (Ultra-Fast Optimized)
app.post('/api/ai/match-script', async (req, res) => {
    try {
        const { scriptText, items, customApiKey } = req.body;
        const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

        if (!scriptText || !scriptText.trim()) {
            return res.status(400).json({ error: 'Vui lòng cung cấp nội dung kịch bản' });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Vui lòng tải lên ít nhất một ảnh để khớp kịch bản' });
        }

        const ai = new GoogleGenAI({ apiKey });
        const contents = [];

        // Attach top lightweight thumbnails (max 15 vision parts to maintain ultra-fast speed)
        const imageItems = items.filter(i => i.type === 'image');
        const maxVisionThumbs = Math.min(15, imageItems.length);

        const thumbPromises = imageItems.slice(0, maxVisionThumbs).map(async (item, i) => {
            const filePath = path.join(UPLOADS_DIR, item.filename);
            if (fs.existsSync(filePath)) {
                const base64Data = await getThumbnailBase64(filePath);
                return { index: i, name: item.originalName, base64Data };
            }
            return null;
        });

        const thumbResults = await Promise.all(thumbPromises);

        thumbResults.forEach(r => {
            if (r && r.base64Data) {
                contents.push({ text: `[IMAGE ${r.index}] ${r.name}` });
                contents.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: r.base64Data
                    }
                });
            }
        });

        // Ultra-compact array prompt for 4-second lightning generation
        const promptText = `
Đóng vai đạo diễn phim. Khớp kịch bản sau thành đúng ${items.length} phân cảnh tương ứng với ${items.length} ảnh (index 0 đến ${items.length - 1}):
--- KỊCH BẢN ---
${scriptText.trim().slice(0, 15000)}
---
Yêu cầu: Trả về JSON mảng các mảng [imageIndex, "tóm tắt câu thoại cảnh", "motion", duration, fadeIn, fadeOut]:
[
  [0, "Tóm tắt cảnh 1", "zoom_in", 4.0, 0.8, 0.8]
]
Motion gồm: 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'zoom_pan', 'none'.
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
        let parsed;
        try {
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (parseErr) {
            console.error('Failed to parse Gemini JSON:', rawText);
            return res.status(500).json({ error: 'Không thể phân tích dữ liệu từ Gemini AI', raw: rawText });
        }

        // Map compact array or object format to standard scenes
        let rawScenes = Array.isArray(parsed) ? parsed : (parsed.scenes || Object.values(parsed)[0] || []);
        
        // Allowed motion values
        const validMotions = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'zoom_pan', 'none'];
        const cleanMotion = (m) => {
            if (!m || typeof m !== 'string') return 'zoom_in';
            let norm = m.trim().toLowerCase().replace(/[\s-]+/g, '_');
            return validMotions.includes(norm) ? norm : 'zoom_in';
        };

        const scenes = rawScenes.map((s, idx) => {
            if (Array.isArray(s)) {
                return {
                    imageIndex: typeof s[0] === 'number' ? s[0] : (idx % items.length),
                    sceneText: s[1] || `Phân cảnh ${idx + 1}`,
                    suggestedMotion: cleanMotion(s[2]),
                    suggestedDuration: parseFloat(s[3] || 4.0),
                    fadeIn: parseFloat(s[4] || 0.8),
                    fadeOut: parseFloat(s[5] || 0.8)
                };
            }
            return {
                imageIndex: s.i !== undefined ? s.i : (s.imageIndex !== undefined ? s.imageIndex : idx % items.length),
                sceneText: s.t || s.sceneText || `Phân cảnh ${idx + 1}`,
                suggestedMotion: cleanMotion(s.m || s.suggestedMotion || s.motion),
                suggestedDuration: parseFloat(s.d || s.suggestedDuration || 4.0),
                fadeIn: parseFloat(s.fi || s.fadeIn || 0.8),
                fadeOut: parseFloat(s.fo || s.fadeOut || 0.8)
            };
        });

        res.json({ success: true, result: { scenes } });
    } catch (err) {
        console.error('Gemini match error:', err);
        res.status(500).json({ error: err.message || 'Lỗi khi gọi Gemini AI' });
    }
});

// =========================================================================
// AI AUDIT: TAB 1 VIDEO TIMELINE & SCRIPT QUALITY EVALUATION
// =========================================================================
app.post('/api/ai/audit-timeline', async (req, res) => {
    try {
        const { items, bgm, scriptText, settings, customApiKey } = req.body;
        const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Chưa có phân đoạn nào trên timeline để đánh giá' });
        }

        // 1. Local Rule-based Analysis
        let totalDuration = 0;
        let shortScenes = 0;
        let longScenes = 0;
        const motionCount = {};
        let textOverlayCount = 0;

        items.forEach((item, idx) => {
            const dur = Number(item.settings?.duration || 5.0);
            totalDuration += dur;
            if (dur < 2.0) shortScenes++;
            if (dur > 8.0) longScenes++;
            const m = item.settings?.motion || 'zoom_in';
            motionCount[m] = (motionCount[m] || 0) + 1;
            if (item.settings?.overlayText && item.settings.overlayText.trim()) textOverlayCount++;
        });

        const motionTypes = Object.keys(motionCount).length;
        const hasBgm = Boolean(bgm && bgm.filename);
        const bgmDuration = Number(bgm?.duration || 0);

        // 2. Gemini AI Deep Content & Alignment Assessment
        const ai = new GoogleGenAI({ apiKey });
        const timelineSummary = items.map((it, idx) => ({
            index: idx + 1,
            type: it.type,
            name: it.originalName,
            duration: Number(it.settings?.duration || 5.0),
            motion: it.settings?.motion || 'zoom_in',
            overlayText: it.settings?.overlayText || ''
        }));

        const promptText = `
Bạn là Đạo diễn Hậu kỳ Video chuyên nghiệp (Senior Video Editor & Quality Auditor).
Hãy đánh giá chất lượng của Timeline Video sau đây dựa trên cấu trúc, nhịp điệu và nội dung kịch bản:

THÔNG TIN VIDEO:
- Tổng số phân cảnh: ${items.length}
- Tổng thời lượng: ${totalDuration.toFixed(1)}s
- Tỷ lệ khung hình: ${settings?.aspectRatio || '16:9'}
- Nhạc nền (BGM): ${hasBgm ? `Có (${bgmDuration.toFixed(1)}s)` : 'Chưa có'}
- Số cảnh có tiêu đề chữ (Overlay Text): ${textOverlayCount}/${items.length}
- Các hiệu ứng chuyển động sử dụng: ${JSON.stringify(motionCount)}

KỊCH BẢN GỐC (nếu có):
${(scriptText && scriptText.trim()) ? scriptText.trim().slice(0, 5000) : '(Người dùng chưa cung cấp kịch bản gốc - hãy đánh giá dựa trên cấu trúc và nhịp điệu hình ảnh)'}

DANH SÁCH CÁC PHÂN CẢNH TRÊN TIMELINE:
${JSON.stringify(timelineSummary.slice(0, 30), null, 2)}

YÊU CẦU: Trả về kết quả JSON chính xác với cấu trúc sau:
{
  "overallScore": 85,
  "verdict": "Đánh giá tổng quan 1-2 câu súc tích",
  "categoryScores": {
    "scriptAlignment": 90,
    "pacing": 80,
    "visualVariety": 85,
    "audioBalance": 75
  },
  "strengths": [
    "Điểm mạnh 1",
    "Điểm mạnh 2"
  ],
  "warnings": [
    "Điểm cảnh báo/yếu 1 (nếu có)",
    "Điểm cảnh báo/yếu 2 (nếu có)"
  ],
  "recommendations": [
    "Đề xuất cải tiến hành động 1",
    "Đề xuất cải tiến hành động 2"
  ]
}
`;

        let auditResult = {
            overallScore: 80,
            verdict: 'Video có cấu trúc ổn định.',
            categoryScores: { scriptAlignment: 80, pacing: 80, visualVariety: 75, audioBalance: hasBgm ? 85 : 50 },
            strengths: ['Thời lượng video cân đối.'],
            warnings: [],
            recommendations: []
        };

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [{ text: promptText }],
                config: { responseMimeType: 'application/json' }
            });
            const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
            auditResult = JSON.parse(cleanJson);
        } catch (aiErr) {
            console.warn('AI audit fallback to rule-based evaluation:', aiErr.message);
            // Rule-based fallback if AI call fails
            let baseScore = 75;
            if (hasBgm) baseScore += 10;
            if (motionTypes >= 3) baseScore += 10;
            if (shortScenes > 0) baseScore -= 5;
            auditResult.overallScore = Math.min(95, baseScore);
            if (!hasBgm) auditResult.warnings.push('Chưa có nhạc nền (BGM) cho video');
            if (shortScenes > 0) auditResult.warnings.push(`Có ${shortScenes} cảnh thời lượng < 2.0s đọc quá nhanh`);
            if (motionTypes === 1) auditResult.warnings.push('Tất cả các cảnh chỉ dùng 1 hiệu ứng duy nhất, nên bấm "Phân Bổ Ngẫu Nhiên" để sinh động');
        }

        res.json({
            success: true,
            stats: {
                totalDuration,
                itemCount: items.length,
                motionTypes,
                hasBgm,
                textOverlayCount
            },
            audit: auditResult
        });
    } catch (err) {
        console.error('Audit timeline error:', err);
        res.status(500).json({ error: err.message || 'Lỗi khi đánh giá video' });
    }
});

// =========================================================================
// AI AUDIT: TAB 2 SUBTITLE, AUDIO & SYNC QUALITY EVALUATION
// =========================================================================
app.post('/api/ai/audit-subtitles', async (req, res) => {
    try {
        const { segments, mediaDuration, style, customApiKey } = req.body;
        const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

        if (!segments || segments.length === 0) {
            return res.status(400).json({ error: 'Chưa có phân đoạn phụ đề nào để đánh giá' });
        }

        // 1. Fast Computational Metrics & Local Checks
        let totalWords = 0;
        let fastSegments = [];
        let overlappingCount = 0;
        let gapCount = 0;
        let lastEnd = 0;

        segments.forEach((seg, idx) => {
            const dur = Math.max(0.1, (seg.end - seg.start));
            const words = (seg.text || '').trim().split(/\s+/).filter(Boolean);
            totalWords += words.length;
            const wps = words.length / dur; // Words Per Second
            const cps = (seg.text || '').length / dur; // Chars Per Second

            // Flag if reading speed is too fast (WPS > 4.5 or CPS > 22)
            if (wps > 4.2 || cps > 22) {
                fastSegments.push({
                    id: seg.id || idx + 1,
                    text: seg.text,
                    wps: parseFloat(wps.toFixed(1)),
                    duration: parseFloat(dur.toFixed(2)),
                    reason: `Đọc quá nhanh (${wps.toFixed(1)} từ/giây). Người xem khó đọc kịp.`
                });
            }

            if (idx > 0 && seg.start < lastEnd - 0.05) {
                overlappingCount++;
            }
            if (idx > 0 && seg.start > lastEnd + 4.0) {
                gapCount++;
            }
            lastEnd = seg.end;
        });

        const avgWpm = totalWords > 0 && lastEnd > 0 ? Math.round((totalWords / lastEnd) * 60) : 150;

        // 2. Gemini AI Deep Language & Readability Analysis
        const ai = new GoogleGenAI({ apiKey });
        const sampleCues = segments.slice(0, 25).map(s => ({
            id: s.id,
            start: s.start,
            end: s.end,
            text: s.text
        }));

        const promptText = `
Bạn là Chuyên gia Kiểm định Phụ đề Video (Subtitles & Caption Quality Inspector).
Hãy phân tích chất lượng của bộ phụ đề sau:

THÔNG TIN PHỤ ĐỀ:
- Số câu phụ đề: ${segments.length}
- Tổng số từ: ${totalWords}
- Tốc độ đọc trung bình: ${avgWpm} WPM
- Tỷ lệ khung hình: ${style?.aspectRatio || '16:9'}
- Cỡ chữ: ${style?.fontSize || 38}px, Font: ${style?.fontFamily || 'Arial'}
- Số câu bị trùng lấn thời gian (overlap): ${overlappingCount}
- Số câu đọc quá nhanh bị phát hiện: ${fastSegments.length}

MẪU PHÂN ĐOẠN PHỤ ĐỀ:
${JSON.stringify(sampleCues, null, 2)}

YÊU CẦU: Trả về JSON chính xác theo cấu trúc sau:
{
  "overallScore": 88,
  "verdict": "Đánh giá tổng quan chất lượng phụ đề 1-2 câu",
  "categoryScores": {
    "syncAccuracy": 90,
    "readingSpeed": 85,
    "visualReadability": 85,
    "typography": 90
  },
  "strengths": [
    "Điểm tốt 1",
    "Điểm tốt 2"
  ],
  "warnings": [
    "Cảnh báo lỗi phụ đề 1 (nếu có)",
    "Cảnh báo lỗi phụ đề 2 (nếu có)"
  ],
  "recommendations": [
    "Gợi ý tối ưu 1 (ví dụ: dùng Smart Chunking 3-4 từ)",
    "Gợi ý tối ưu 2"
  ]
}
`;

        let auditResult = {
            overallScore: 85,
            verdict: 'Bộ phụ đề có chất lượng tốt.',
            categoryScores: { syncAccuracy: 85, readingSpeed: fastSegments.length > 0 ? 70 : 90, visualReadability: 85, typography: 90 },
            strengths: ['Phụ đề có cấu trúc rõ ràng.'],
            warnings: [],
            recommendations: []
        };

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [{ text: promptText }],
                config: { responseMimeType: 'application/json' }
            });
            const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
            auditResult = JSON.parse(cleanJson);
        } catch (aiErr) {
            console.warn('Subtitle AI audit fallback to rule-based evaluation:', aiErr.message);
            let score = 90;
            if (fastSegments.length > 0) score -= Math.min(25, fastSegments.length * 5);
            if (overlappingCount > 0) score -= 15;
            auditResult.overallScore = Math.max(50, score);
            if (fastSegments.length > 0) {
                auditResult.warnings.push(`Có ${fastSegments.length} câu phụ đề nói quá nhanh, đề xuất dùng công cụ "Chia nhỏ từ (Smart Chunking)"`);
            }
            if (overlappingCount > 0) {
                auditResult.warnings.push(`Có ${overlappingCount} đoạn phụ đề bị trùng mốc thời gian`);
            }
        }

        res.json({
            success: true,
            stats: {
                totalCues: segments.length,
                totalWords,
                avgWpm,
                fastSegmentsCount: fastSegments.length,
                overlappingCount,
                fastSegments: fastSegments.slice(0, 5)
            },
            audit: auditResult
        });
    } catch (err) {
        console.error('Audit subtitles error:', err);
        res.status(500).json({ error: err.message || 'Lỗi khi kiểm định phụ đề' });
    }
});

// Calculate output width & height based on qualityPreset & aspectRatio
function getOutputDimensionsAndEncoding(aspectRatio, qualityPreset, customFps) {
    let w = 1920, h = 1080, fps = customFps || 30, crf = '20', preset = 'fast';

    if (qualityPreset === 'fast_720p') {
        fps = 30;
        crf = '26';
        preset = 'veryfast';
        if (aspectRatio === '9:16') { w = 720; h = 1280; }
        else if (aspectRatio === '1:1') { w = 720; h = 720; }
        else { w = 1280; h = 720; }
    } else if (qualityPreset === 'high_1080p_60fps') {
        fps = 60;
        crf = '18';
        preset = 'medium';
        if (aspectRatio === '9:16') { w = 1080; h = 1920; }
        else if (aspectRatio === '1:1') { w = 1080; h = 1080; }
        else { w = 1920; h = 1080; }
    } else if (qualityPreset === 'ultra_4k') {
        fps = customFps || 60;
        crf = '16';
        preset = 'medium';
        if (aspectRatio === '9:16') { w = 2160; h = 3840; }
        else if (aspectRatio === '1:1') { w = 2160; h = 2160; }
        else { w = 3840; h = 2160; }
    } else {
        // standard_1080p
        fps = customFps || 30;
        crf = '20';
        preset = 'fast';
        if (aspectRatio === '9:16') { w = 1080; h = 1920; }
        else if (aspectRatio === '1:1') { w = 1080; h = 1080; }
        else { w = 1920; h = 1080; }
    }

    return { width: w, height: h, fps, crf, preset };
}

// Render Video API
app.post('/api/render', async (req, res) => {
    const { items, bgm, settings } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for rendering' });
    }

    const jobId = 'render_' + Date.now();
    const outputFilename = `output_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    const aspectRatio = settings?.aspectRatio || '16:9';
    const qualityPreset = settings?.qualityPreset || 'standard_1080p';
    const reframeMode = settings?.reframeMode || 'cover'; // 'cover', 'contain_blur', 'contain_black'
    const customFps = settings?.fps ? parseInt(settings.fps) : null;

    const { width, height, fps, crf, preset } = getOutputDimensionsAndEncoding(aspectRatio, qualityPreset, customFps);

    // Calculate total duration
    let totalDuration = 0;
    items.forEach(item => {
        if (item.type === 'image') {
            totalDuration += Number(item.settings?.duration || 5.0);
        } else if (item.type === 'video') {
            const start = Number(item.settings?.trimStart || 0);
            const end = Number(item.settings?.trimEnd || item.duration || 5);
            totalDuration += Math.max(0.5, end - start);
        }
    });

    const job = {
        id: jobId,
        status: 'processing',
        progress: 0,
        outputUrl: null,
        outputFilename,
        totalDuration,
        error: null,
        logs: [],
        process: null,
        clients: []
    };

    activeJobs.set(jobId, job);
    res.json({ jobId, outputFilename, totalDuration, width, height, fps });

    // Start background FFmpeg execution
    executeFFmpegRender(job, items, bgm, { width, height, fps, crf, preset, reframeMode, aspectRatio, outputPath });
});

// Helper to build FFmpeg drawtext filter for Text Overlay
function buildDrawtextFilter(settings, width, height) {
    if (!settings || !settings.overlayText || !settings.overlayText.trim()) {
        return '';
    }
    const text = settings.overlayText.trim();
    // Escape single quotes, colons, and backslashes for FFmpeg drawtext filter syntax
    const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:');

    const position = settings.textPosition || 'bottom';
    const style = settings.textStyle || 'banner';
    const baseFontSize = Number(settings.fontSize) || 48;
    const scaledFontSize = Math.max(20, Math.round(baseFontSize * (height / 1080)));

    let x = '(w-text_w)/2';
    let y = 'h-text_h-120';

    if (position === 'top') {
        y = `${Math.round(height * 0.10)}`;
    } else if (position === 'center') {
        y = '(h-text_h)/2';
    } else {
        // bottom
        y = `h-text_h-${Math.round(height * 0.10)}`;
    }

    let styleParams = ':fontcolor=white';
    if (style === 'banner') {
        styleParams = ':fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=16';
    } else if (style === 'outline') {
        styleParams = ':fontcolor=white:borderw=4:bordercolor=black';
    } else if (style === 'glow') {
        styleParams = ':fontcolor=white:shadowcolor=0x6366F1@0.8:shadowx=3:shadowy=3:borderw=2:bordercolor=black';
    } else if (style === 'plain') {
        styleParams = ':fontcolor=white';
    }

    let animParams = '';
    const textAnimation = settings.textAnimation || 'always';
    if (textAnimation === 'intro') {
        animParams = ":enable='between(t,0,2.8)'";
    }

    return `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':expansion=none:text='${escapedText}':fontsize=${scaledFontSize}:x=${x}:y=${y}${styleParams}${animParams}`;
}

// Function to render a single batch/chunk of items
function renderChunk(job, chunkItems, chunkOutputPath, chunkIndex, totalChunks, config) {
    return new Promise((resolve, reject) => {
        const { width, height, fps, crf, preset, reframeMode } = config;
        const args = ['-y'];

        chunkItems.forEach((item) => {
            const filePath = path.join(UPLOADS_DIR, item.filename);
            args.push('-i', filePath);
        });

        const filterComplex = [];
        const videoStreamTags = [];
        const audioStreamTags = [];

        chunkItems.forEach((item, idx) => {
            const vTag = `v_${idx}`;
            const aTag = `a_${idx}`;
            const dur = Number(item.settings?.duration || 5.0);
            const frames = Math.round(dur * fps);
            const fadeIn = Number(item.settings?.fadeIn || 0);
            const fadeOut = Number(item.settings?.fadeOut || 0);
            const motion = item.settings?.motion || 'zoom_in';
            const zoomIntensity = Math.max(1.05, Math.min(2.0, Number(item.settings?.zoomIntensity || 1.25)));
            const delta = zoomIntensity - 1.0;

            if (item.type === 'image') {
                let zExpr = '1.0';
                let xExpr = 'iw/2-(iw/zoom/2)';
                let yExpr = 'ih/2-(ih/zoom/2)';

                if (motion === 'zoom_in') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = 'iw/2-(iw/zoom/2)';
                    yExpr = 'ih/2-(ih/zoom/2)';
                } else if (motion === 'zoom_out') {
                    zExpr = `${zoomIntensity}-(${delta}*(on/${frames}))`;
                    xExpr = 'iw/2-(iw/zoom/2)';
                    yExpr = 'ih/2-(ih/zoom/2)';
                } else if (motion === 'pan_left') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = `(iw-iw/zoom)*(1-(on/${frames}))`;
                    yExpr = 'ih/2-(ih/zoom/2)';
                } else if (motion === 'pan_right') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = `(iw-iw/zoom)*(on/${frames})`;
                    yExpr = 'ih/2-(ih/zoom/2)';
                } else if (motion === 'pan_up') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = 'iw/2-(iw/zoom/2)';
                    yExpr = `(ih-ih/zoom)*(1-(on/${frames}))`;
                } else if (motion === 'pan_down') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = 'iw/2-(iw/zoom/2)';
                    yExpr = `(ih-ih/zoom)*(on/${frames})`;
                } else if (motion === 'zoom_in_left') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = '0';
                    yExpr = '0';
                } else if (motion === 'zoom_in_right') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = '(iw-iw/zoom)';
                    yExpr = '0';
                } else if (motion === 'zoom_pan') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = `(iw-iw/zoom)*(on/${frames})`;
                    yExpr = `(ih-ih/zoom)*(on/${frames})`;
                } else {
                    zExpr = '1.0';
                    xExpr = 'iw/2-(iw/zoom/2)';
                    yExpr = 'ih/2-(ih/zoom/2)';
                }

                // Smart Reframe for images: High-res scaling with cover crop and center zoompan
                const preScale = `scale=w=${width * 2}:h=${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2}`;
                const zoompan = `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${width}x${height}:fps=${fps}`;

                let vFilters = `${preScale},${zoompan},format=yuv420p,setsar=1`;

                if (fadeIn > 0) {
                    vFilters += `,fade=t=in:st=0:d=${fadeIn}`;
                }
                if (fadeOut > 0) {
                    const fadeStart = Math.max(0, dur - fadeOut);
                    vFilters += `,fade=t=out:st=${fadeStart}:d=${fadeOut}`;
                }

                // Append Drawtext Filter if Text Overlay is provided
                const drawtextFilter = buildDrawtextFilter(item.settings, width, height);
                if (drawtextFilter) {
                    vFilters += `,${drawtextFilter}`;
                }

                filterComplex.push(`[${idx}:v]${vFilters}[${vTag}]`);
                videoStreamTags.push(`[${vTag}]`);
                filterComplex.push(`anullsrc=r=44100:cl=stereo:d=${dur}[${aTag}]`);
                audioStreamTags.push(`[${aTag}]`);
            } else {
                const trimStart = Number(item.settings?.trimStart || 0);
                const trimEnd = Number(item.settings?.trimEnd || item.duration || 5);
                const videoDur = Math.max(0.5, trimEnd - trimStart);
                const vol = Number(item.settings?.videoVolume ?? 1.0);

                // Video Smart Reframe modes
                let reframeFilter = '';
                if (reframeMode === 'cover') {
                    reframeFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
                } else if (reframeMode === 'contain_blur') {
                    reframeFilter = `split=2[rawmain][rawbg];[rawbg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5[bgblur];[rawmain]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[bgblur][fg]overlay=(W-w)/2:(H-h)/2`;
                } else {
                    reframeFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
                }

                let vFilters = `trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS,${reframeFilter},setsar=1,fps=${fps},format=yuv420p`;

                if (fadeIn > 0) {
                    vFilters += `,fade=t=in:st=0:d=${fadeIn}`;
                }
                if (fadeOut > 0) {
                    const fadeStart = Math.max(0, videoDur - fadeOut);
                    vFilters += `,fade=t=out:st=${fadeStart}:d=${fadeOut}`;
                }

                // Append Drawtext Filter if Text Overlay is provided
                const drawtextFilter = buildDrawtextFilter(item.settings, width, height);
                if (drawtextFilter) {
                    vFilters += `,${drawtextFilter}`;
                }

                filterComplex.push(`[${idx}:v]${vFilters}[${vTag}]`);
                videoStreamTags.push(`[${vTag}]`);

                if (vol > 0) {
                    filterComplex.push(`[${idx}:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${vol},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${aTag}]`);
                } else {
                    filterComplex.push(`anullsrc=r=44100:cl=stereo:d=${videoDur}[${aTag}]`);
                }
                audioStreamTags.push(`[${aTag}]`);
            }
        });

        let concatSegments = '';
        for (let i = 0; i < chunkItems.length; i++) {
            concatSegments += `${videoStreamTags[i]}${audioStreamTags[i]}`;
        }
        filterComplex.push(`${concatSegments}concat=n=${chunkItems.length}:v=1:a=1[v_concat][a_concat]`);

        args.push('-filter_complex', filterComplex.join('; '));
        args.push('-map', '[v_concat]');
        args.push('-map', '[a_concat]');
        args.push('-c:v', 'libx264', '-preset', preset || 'fast', '-crf', crf || '20', '-pix_fmt', 'yuv420p');
        args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart');
        args.push(chunkOutputPath);

        const proc = spawn('ffmpeg', args);
        let stderrLog = '';
        proc.stderr.on('data', d => {
            stderrLog += d.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.error(`Chunk ${chunkIndex + 1} FFmpeg stderr:`, stderrLog.slice(-500));
                reject(new Error(`Chunk ${chunkIndex + 1} failed with exit code ${code}`));
            }
        });

        proc.on('error', (err) => {
            if (fs.existsSync(filterScriptPath)) {
                try { fs.unlinkSync(filterScriptPath); } catch (e) {}
            }
            reject(err);
        });
    });
}

// Master execution with chunking for large jobs
async function executeFFmpegRender(job, items, bgm, config) {
    const { outputPath } = config;
    const CHUNK_SIZE = 6;
    const tempFiles = [];

    try {
        if (items.length <= CHUNK_SIZE && (!bgm || !bgm.filename)) {
            // Direct single render
            await renderChunk(job, items, outputPath, 0, 1, config);
            job.status = 'completed';
            job.progress = 100;
            job.outputUrl = `/outputs/${job.outputFilename}`;
            sendJobUpdate(job);
            return;
        }

        // Split into chunks of CHUNK_SIZE
        const chunks = [];
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            chunks.push(items.slice(i, i + CHUNK_SIZE));
        }

        console.log(`Job ${job.id}: Processing in ${chunks.length} chunks (Parallel workers: 2)...`);
        const chunkOutputPaths = [];

        // Run chunks with controlled concurrency (2 workers)
        const concurrency = 2;
        let completedChunks = 0;

        for (let i = 0; i < chunks.length; i += concurrency) {
            const batch = chunks.slice(i, i + concurrency);
            const promises = batch.map((chunk, batchIdx) => {
                const chunkIdx = i + batchIdx;
                const chunkFile = path.join(OUTPUTS_DIR, `temp_chunk_${job.id}_${chunkIdx}.mp4`);
                tempFiles.push(chunkFile);
                chunkOutputPaths[chunkIdx] = chunkFile;
                return renderChunk(job, chunk, chunkFile, chunkIdx, chunks.length, config).then(() => {
                    completedChunks++;
                    const pct = Math.min(88, Math.round((completedChunks / chunks.length) * 88));
                    job.progress = pct;
                    sendJobUpdate(job);
                });
            });

            await Promise.all(promises);
        }

        // Create concat list file
        const listFilePath = path.join(OUTPUTS_DIR, `list_${job.id}.txt`);
        tempFiles.push(listFilePath);
        const listContent = chunkOutputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent, 'utf8');

        job.progress = 92;
        sendJobUpdate(job);

        // Final fast concat with stream copy (-c copy) and BGM mix if present
        await new Promise((resolve, reject) => {
            const finalArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listFilePath];

            let bgmPath = null;
            if (bgm && bgm.filename) {
                const bp = path.join(UPLOADS_DIR, bgm.filename);
                if (fs.existsSync(bp)) bgmPath = bp;
            }

            if (bgmPath) {
                const bgmVol = Number(bgm.volume ?? 0.6);
                const bgmFadeOut = Math.max(0, job.totalDuration - 2);
                finalArgs.push(
                    '-i', bgmPath,
                    '-filter_complex', `[1:a]aloop=loop=-1:size=2e+09,atrim=0:${job.totalDuration},asetpts=PTS-STARTPTS,volume=${bgmVol},afade=t=out:st=${bgmFadeOut}:d=2,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[bgm_proc]; [0:a][bgm_proc]amix=inputs=2:duration=first:dropout_transition=2[a_mixed]`,
                    '-map', '0:v',
                    '-map', '[a_mixed]',
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    outputPath
                );
            } else {
                finalArgs.push('-c', 'copy', '-movflags', '+faststart', outputPath);
            }

            console.log(`Job ${job.id}: Final stream-copy concat...`);
            const concatProc = spawn('ffmpeg', finalArgs);

            concatProc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Final concat failed with code ${code}`));
            });

            concatProc.on('error', reject);
        });

        // Clean up temporary chunk files
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (e) {}
            }
        });

        job.status = 'completed';
        job.progress = 100;
        job.outputUrl = `/outputs/${job.outputFilename}`;
        console.log(`Job ${job.id} completed successfully in multi-chunk mode!`);
        sendJobUpdate(job);

    } catch (err) {
        console.error(`Job ${job.id} failed:`, err);
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (e) {}
            }
        });
        job.status = 'failed';
        job.error = err.message;
        sendJobUpdate(job);
    }
}

function sendJobUpdate(job) {
    job.clients.forEach(res => {
        res.write(`data: ${JSON.stringify({
            status: job.status,
            progress: job.progress,
            outputUrl: job.outputUrl,
            error: job.error
        })}\n\n`);
    });
}

// SSE endpoint for progress tracking
app.get('/api/progress/:jobId', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send immediate initial status
    res.write(`data: ${JSON.stringify({
        status: job.status,
        progress: job.progress,
        outputUrl: job.outputUrl,
        error: job.error
    })}\n\n`);

    job.clients.push(res);

    req.on('close', () => {
        job.clients = job.clients.filter(client => client !== res);
    });
});

// =========================================================================
// TAB 3: LOGO & WATERMARK STUDIO APIS
// =========================================================================

// Upload Logo File
app.post('/api/watermark/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Chưa chọn file logo' });
        }
        res.json({
            success: true,
            file: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                url: `/uploads/${req.file.filename}`,
                size: req.file.size
            }
        });
    } catch (err) {
        console.error('Logo upload error:', err);
        res.status(500).json({ error: err.message || 'Lỗi tải logo' });
    }
});

// Process Watermark / Delogo on Video or Image
app.post('/api/watermark/process-video', async (req, res) => {
    try {
        const { sourceFilename, mode, logoSettings, delogoSettings } = req.body;
        if (!sourceFilename) {
            return res.status(400).json({ error: 'Chưa có file nguồn để xử lý' });
        }

        // Find file in uploads or output
        let inputPath = path.join(UPLOADS_DIR, sourceFilename);
        if (!fs.existsSync(inputPath)) {
            inputPath = path.join(OUTPUT_DIR, sourceFilename);
        }
        if (!fs.existsSync(inputPath)) {
            return res.status(404).json({ error: 'Không tìm thấy file nguồn trên máy chủ' });
        }

        const jobId = `wm_${Date.now()}`;
        const outputFilename = `watermark_result_${Date.now()}.mp4`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);

        const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(sourceFilename);

        renderJobs.set(jobId, {
            status: 'processing',
            progress: 10,
            outputUrl: null,
            error: null,
            clients: []
        });

        res.json({ success: true, jobId, outputUrl: `/output/${outputFilename}` });

        // Build FFmpeg arguments asynchronously
        (async () => {
            const job = renderJobs.get(jobId);
            try {
                let ffmpegArgs = [];

                if (mode === 'logo' && logoSettings && logoSettings.logoFilename) {
                    const logoPath = path.join(UPLOADS_DIR, logoSettings.logoFilename);
                    if (!fs.existsSync(logoPath)) throw new Error('Không tìm thấy file logo');

                    const scalePct = Math.min(50, Math.max(5, Number(logoSettings.scalePercent || 18))) / 100;
                    const opacity = Math.min(1.0, Math.max(0.1, Number(logoSettings.opacity || 0.9)));
                    const margin = Math.max(5, Number(logoSettings.margin || 20));
                    const pos = logoSettings.position || 'bottom_right';

                    let overlayX = `main_w-w-${margin}`;
                    let overlayY = `main_h-h-${margin}`;

                    switch (pos) {
                        case 'top_left': overlayX = `${margin}`; overlayY = `${margin}`; break;
                        case 'top_center': overlayX = `(main_w-w)/2`; overlayY = `${margin}`; break;
                        case 'top_right': overlayX = `main_w-w-${margin}`; overlayY = `${margin}`; break;
                        case 'center_left': overlayX = `${margin}`; overlayY = `(main_h-h)/2`; break;
                        case 'center': overlayX = `(main_w-w)/2`; overlayY = `(main_h-h)/2`; break;
                        case 'center_right': overlayX = `main_w-w-${margin}`; overlayY = `(main_h-h)/2`; break;
                        case 'bottom_left': overlayX = `${margin}`; overlayY = `main_h-h-${margin}`; break;
                        case 'bottom_center': overlayX = `(main_w-w)/2`; overlayY = `main_h-h-${margin}`; break;
                        case 'bottom_right': overlayX = `main_w-w-${margin}`; overlayY = `main_h-h-${margin}`; break;
                    }

                    if (isImage) {
                        ffmpegArgs = [
                            '-y',
                            '-loop', '1',
                            '-i', inputPath,
                            '-i', logoPath,
                            '-filter_complex',
                            `[1:v]scale=main_w*${scalePct}:-1,format=rgba,colorchannelmixer=aa=${opacity}[logo];[0:v][logo]overlay=${overlayX}:${overlayY}[v]`,
                            '-map', '[v]',
                            '-t', '5',
                            '-pix_fmt', 'yuv420p',
                            '-c:v', 'libx264',
                            '-preset', 'fast',
                            outputPath
                        ];
                    } else {
                        ffmpegArgs = [
                            '-y',
                            '-i', inputPath,
                            '-i', logoPath,
                            '-filter_complex',
                            `[1:v]scale=main_w*${scalePct}:-1,format=rgba,colorchannelmixer=aa=${opacity}[logo];[0:v][logo]overlay=${overlayX}:${overlayY}[v]`,
                            '-map', '[v]',
                            '-map', '0:a?',
                            '-pix_fmt', 'yuv420p',
                            '-c:v', 'libx264',
                            '-c:a', 'aac',
                            '-preset', 'fast',
                            outputPath
                        ];
                    }
                } else if (mode === 'delogo' && delogoSettings) {
                    const x = Math.max(0, parseInt(delogoSettings.x || 0));
                    const y = Math.max(0, parseInt(delogoSettings.y || 0));
                    const w = Math.max(10, parseInt(delogoSettings.w || 140));
                    const h = Math.max(10, parseInt(delogoSettings.h || 60));
                    const filterType = delogoSettings.filterType || 'delogo';

                    let filterGraph = '';
                    if (filterType === 'blur') {
                        filterGraph = `split=2[main][crop];[crop]crop=${w}:${h}:${x}:${y},boxblur=20:5[blur];[main][blur]overlay=${x}:${y}[v]`;
                    } else if (filterType === 'crop') {
                        filterGraph = `scale=iw*1.05:ih*1.05,crop=iw/1.05:ih/1.05:0:0[v]`;
                    } else {
                        // Standard Delogo Interpolation
                        filterGraph = `delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0[v]`;
                    }

                    if (isImage) {
                        ffmpegArgs = [
                            '-y',
                            '-loop', '1',
                            '-i', inputPath,
                            '-filter_complex', filterGraph,
                            '-map', '[v]',
                            '-t', '5',
                            '-pix_fmt', 'yuv420p',
                            '-c:v', 'libx264',
                            '-preset', 'fast',
                            outputPath
                        ];
                    } else {
                        ffmpegArgs = [
                            '-y',
                            '-i', inputPath,
                            '-filter_complex', filterGraph,
                            '-map', '[v]',
                            '-map', '0:a?',
                            '-pix_fmt', 'yuv420p',
                            '-c:v', 'libx264',
                            '-c:a', 'copy',
                            '-preset', 'fast',
                            outputPath
                        ];
                    }
                } else {
                    throw new Error('Cấu hình xử lý watermark không hợp lệ');
                }

                console.log(`[Watermark Studio] Running FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
                const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

                ffmpegProcess.stderr.on('data', (chunk) => {
                    const msg = chunk.toString();
                    if (msg.includes('frame=')) {
                        job.progress = Math.min(95, job.progress + 5);
                        broadcastJobStatus(jobId, job);
                    }
                });

                ffmpegProcess.on('close', (code) => {
                    if (code === 0) {
                        job.status = 'completed';
                        job.progress = 100;
                        job.outputUrl = `/output/${outputFilename}`;
                        broadcastJobStatus(jobId, job);
                    } else {
                        job.status = 'error';
                        job.error = `FFmpeg kết thúc với mã lỗi ${code}`;
                        broadcastJobStatus(jobId, job);
                    }
                });
            } catch (err) {
                console.error('[Watermark Studio Error]:', err);
                job.status = 'error';
                job.error = err.message || 'Lỗi trong quá trình xử lý';
                broadcastJobStatus(jobId, job);
            }
        })();
    } catch (err) {
        console.error('Process video error:', err);
        res.status(500).json({ error: err.message || 'Lỗi hệ thống' });
    }
});

// =========================================================================
// TAB 4: AI VOICE CLONE & TTS STUDIO APIS (ElevenLabs Instant Voice Clone)
// =========================================================================

// In-memory or persisted list of cloned voices
const clonedVoicesStore = [
    {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel (Nữ - Truyền cảm & Ấm áp)',
        description: 'Giọng đọc nữ phổ biến, phù hợp kể chuyện và review',
        category: 'premade'
    },
    {
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam (Nam - Trầm ấm & Rõ ràng)',
        description: 'Giọng đọc nam MC, tự tin, chuyên nghiệp',
        category: 'premade'
    },
    {
        voice_id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni (Nam - Trẻ trung & Năng động)',
        description: 'Giọng đọc trẻ trung, phù hợp video TikTok / Shorts',
        category: 'premade'
    }
];

// List Available Voices
app.get('/api/voice/list', (req, res) => {
    res.json({ success: true, voices: clonedVoicesStore });
});

// Instant Clone Voice from 3-5s Audio Sample
app.post('/api/voice/clone', upload.single('sample'), async (req, res) => {
    try {
        const { apiKey, voiceName, description } = req.body;
        const key = apiKey || process.env.ELEVENLABS_API_KEY;

        if (!key) {
            return res.status(400).json({ error: 'Vui lòng nhập ElevenLabs API Key để tiến hành Clone Voice!' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Chưa có file mẫu âm thanh (3-5 giây) để clone' });
        }

        const samplePath = path.join(UPLOADS_DIR, req.file.filename);
        const name = voiceName || `Giọng Clone ${new Date().toLocaleTimeString('vi-VN')}`;
        const desc = description || 'Clone tức thì từ mẫu âm thanh 3-5 giây';

        // Read audio file buffer
        const fileBuffer = fs.readFileSync(samplePath);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype || 'audio/mpeg' });

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', desc);
        formData.append('files', blob, req.file.originalname || 'sample.mp3');

        console.log(`[Voice Studio] Sending Clone Voice request to ElevenLabs for "${name}"...`);

        const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: {
                'xi-api-key': key
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[ElevenLabs Clone Error]:', data);
            return res.status(response.status).json({
                error: data.detail?.message || data.detail || 'Lỗi khi gọi ElevenLabs Clone Voice API'
            });
        }

        const newVoice = {
            voice_id: data.voice_id,
            name: name,
            description: desc,
            category: 'cloned',
            created_at: Date.now()
        };

        clonedVoicesStore.unshift(newVoice);

        res.json({
            success: true,
            voice: newVoice,
            message: `Clone giọng thành công! Đã tạo Voice ID: ${data.voice_id}`
        });

    } catch (err) {
        console.error('Voice Clone error:', err);
        res.status(500).json({ error: err.message || 'Lỗi xử lý Clone Voice' });
    }
});

// Generate Text-to-Speech using Cloned Voice ID
app.post('/api/voice/generate-tts', async (req, res) => {
    try {
        const { apiKey, voiceId, text, settings } = req.body;
        const key = apiKey || process.env.ELEVENLABS_API_KEY;

        if (!key) {
            return res.status(400).json({ error: 'Vui lòng nhập ElevenLabs API Key!' });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập nội dung kịch bản cần đọc!' });
        }

        const targetVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel
        const stability = parseFloat(settings?.stability ?? 0.5);
        const similarity = parseFloat(settings?.similarity ?? 0.8);
        const style = parseFloat(settings?.style ?? 0.0);

        console.log(`[Voice Studio] Generating TTS for voice ${targetVoiceId}, text length: ${text.length} chars...`);

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text.trim(),
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: stability,
                    similarity_boost: similarity,
                    style: style,
                    use_speaker_boost: true
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('[ElevenLabs TTS Error]:', errData);
            return res.status(response.status).json({
                error: errData.detail?.message || errData.detail || 'Lỗi khi tạo giọng đọc từ ElevenLabs'
            });
        }

        const audioArrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(audioArrayBuffer);

        const filename = `tts_voice_${Date.now()}.mp3`;
        const outputPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(outputPath, buffer);

        // Probe duration with ffprobe
        let duration = 5.0;
        try {
            const probeData = await probeMedia(outputPath);
            duration = probeData.duration || 5.0;
        } catch (e) {
            console.warn('Probe audio duration warning:', e.message);
        }

        res.json({
            success: true,
            file: {
                filename: filename,
                url: `/uploads/${filename}`,
                duration: duration,
                type: 'audio',
                originalName: `Giọng AI (${filename})`
            }
        });

    } catch (err) {
        console.error('TTS Generation error:', err);
        res.status(500).json({ error: err.message || 'Lỗi khi tạo giọng đọc' });
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎬 Video Tool Web UI is running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
