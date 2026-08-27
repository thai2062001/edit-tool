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
const DEFAULT_GEMINI_API_KEY = 'AQ.Ab8RN6L9WwF4De3rEa4B08uhBkkzhc6Kf59yMn2ew0-GeG9fHQ';

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

// Helper to probe media dimensions & duration
function getMediaInfo(filePath) {
    return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,duration:format=duration',
            '-of', 'json',
            filePath
        ]);
        let output = '';
        ffprobe.stdout.on('data', data => output += data.toString());
        ffprobe.on('close', () => {
            try {
                const info = JSON.parse(output);
                const stream = info.streams && info.streams[0] ? info.streams[0] : {};
                const format = info.format || {};
                const width = parseInt(stream.width) || 1920;
                const height = parseInt(stream.height) || 1080;
                const duration = parseFloat(stream.duration || format.duration) || 5;
                resolve({ width, height, duration });
            } catch (e) {
                resolve({ width: 1920, height: 1080, duration: 5 });
            }
        });
        ffprobe.on('error', () => resolve({ width: 1920, height: 1080, duration: 5 }));
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

// AI Script Matching API (Ultra-Fast Optimized with Strict Non-Duplicate Image Policy)
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

        // Attach lightweight thumbnails for vision matching (supports up to 40 images)
        const imageItems = items.filter(i => i.type === 'image');
        const maxVisionThumbs = Math.min(40, imageItems.length);

        const thumbPromises = imageItems.slice(0, maxVisionThumbs).map(async (item, i) => {
            let filePath = path.join(UPLOADS_DIR, item.filename);
            if (!fs.existsSync(filePath)) {
                if (item.path && fs.existsSync(item.path)) filePath = item.path;
                else if (fs.existsSync(path.join(OUTPUTS_DIR, item.filename))) filePath = path.join(OUTPUTS_DIR, item.filename);
            }
            if (fs.existsSync(filePath)) {
                const base64Data = await getThumbnailBase64(filePath);
                return { index: i, name: item.originalName, base64Data };
            }
            return { index: i, name: item.originalName, base64Data: null };
        });

        const thumbResults = await Promise.all(thumbPromises);

        // Header for available images
        const imageCatalogText = `--- KHO ẢNH KHẢ DỤNG HIỆN CÓ (${imageItems.length} ảnh, index từ 0 đến ${imageItems.length - 1}) ---\n` +
            imageItems.map((item, idx) => `[IMAGE ${idx}]: ${item.originalName}`).join('\n');
        contents.push({ text: imageCatalogText });

        // Add visual images
        thumbResults.forEach(r => {
            if (r && r.base64Data) {
                contents.push({ text: `[VISUAL PREVIEW CHO IMAGE ${r.index} - ${r.name}]` });
                contents.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: r.base64Data
                    }
                });
            }
        });

        // Advanced AI Director Prompt strictly forbidding duplicate image reuse
        const promptText = `
Bạn là một Đạo Diễn Dựng Phim & Biên Tập Video Chuyên Nghiệp (Senior Film Director & AI Video Editor).
Nhiệm vụ của bạn là: Đọc kịch bản dưới đây, phân tích câu chuyện thành các phân cảnh logic theo mạch diễn tiến thời gian, và chọn bức ảnh phù hợp nhất từ kho ảnh có sẵn (index 0 đến ${imageItems.length - 1}).

--- NỘI DUNG KỊCH BẢN ---
${scriptText.trim().slice(0, 15000)}
---

=== CÁC NGUYÊN TẮC BẮT BUỘC ĐỂ TRÁNH NHÀM CHÁN (STRICT CRITICAL RULES) ===
1. 🛑 NGUYÊN TẮC 1: TUYỆT ĐỐI KHÔNG DÙNG TRÙNG ẢNH (ZERO DUPLICATE IMAGES)
   - Mỗi ảnh trong kho (index từ 0 đến ${imageItems.length - 1}) CHỈ ĐƯỢC SỬ DỤNG TỐI ĐA 1 LẦN DUY NHẤT trong toàn bộ video.
   - Khi một ảnh index [i] đã được gán cho một phân cảnh nào đó rồi, thì TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP dùng lại ở bất kỳ phân cảnh nào khác!

2. 🛑 NGUYÊN TẮC 2: ĐỂ TRỐNG (imageIndex: -1) NẾU KHÔNG CÓ ẢNH PHÙ HỢP HOẶC ẢNH TƯƠNG TỰ ĐÃ DÙNG
   - Nếu phân cảnh đó KHÔNG CÓ ảnh nào thực sự khớp với nội dung câu thoại;
   - HOẶC nếu các ảnh còn lại trong kho có bối cảnh/nội dung/nhân vật quá giống với ảnh đã dùng trước đó gây cảm giác trùng lặp, nhàm chán;
   - HOẶC khi kho ảnh đã hết ảnh mới chưa dùng:
   👉 BẮT BUỘC đặt "imageIndex": -1 (ĐỂ TRỐNG).
   👉 TUYỆT ĐỐI KHÔNG fill lại ảnh cũ đã dùng, KHÔNG cố gán bừa ảnh không liên quan!

3. 🛑 NGUYÊN TẮC 3: GIỮ NGUYÊN 100% NGÔN NGỮ KỊCH BẢN CHO PHỤ ĐỀ (sceneText)
   - Trường "sceneText" sẽ được dùng trực tiếp làm PHỤ ĐỀ (subtitle / overlay text) hiển thị trên video.
   - BẮT BUỘC PHẢI GIỮ NGUYÊN 100% NGÔN NGỮ GỐC của kịch bản đầu vào:
     👉 Nếu kịch bản nhập vào là TIẾNG ANH (English) -> "sceneText" PHẢI LÀ TIẾNG ANH (English). TUYỆT ĐỐI KHÔNG DỊCH sang tiếng Việt!
     👉 Nếu kịch bản nhập vào là TIẾNG VIỆT -> "sceneText" LÀ TIẾNG VIỆT.
     👉 Nếu là bất kỳ ngôn ngữ nào khác (Pháp, Tây Ban Nha, Nhật...) -> Giữ nguyên ngôn ngữ đó.
   - "sceneText" cần trích xuất chính xác hoặc tóm tắt đúng câu thoại/nội dung tương ứng của cảnh đó từ kịch bản gốc.

4. 🎬 CHỌN ẢNH VÀ HIỆU ỨNG TƯƠNG THÍCH:
   - Hãy quan sát visual từng ảnh và tên file để chọn ảnh mô tả sát nhất ý đồ phân cảnh.
   - suggestedMotion: 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'zoom_pan', 'zoom_in_left', 'zoom_in_right', 'none'.
   - suggestedDuration: từ 3.0s đến 6.0s tùy theo độ dài câu thoại kịch bản.
   - fadeIn, fadeOut: 0.6s - 0.8s.

=== CẤU TRÚC JSON TRẢ VỀ ===
Trả về JSON mảng các phân cảnh:
[
  {
    "imageIndex": 0, // Số nguyên từ 0 đến ${imageItems.length - 1}, HOẶC -1 NẾU ĐỂ TRỐNG
    "sceneText": "Trích dẫn/tóm tắt câu thoại cảnh này đúng 100% bằng ngôn ngữ của kịch bản gốc (English if English script, Vietnamese if Vietnamese script)",
    "suggestedMotion": "zoom_in",
    "suggestedDuration": 4.5,
    "fadeIn": 0.8,
    "fadeOut": 0.8,
    "reason": "Giải thích ngắn lý do chọn ảnh hoặc lý do để trống"
  }
]
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
        const validMotions = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'zoom_pan', 'zoom_in_left', 'zoom_in_right', 'none'];
        const cleanMotion = (m) => {
            if (!m || typeof m !== 'string') return 'zoom_in';
            let norm = m.trim().toLowerCase().replace(/[\s-]+/g, '_');
            return validMotions.includes(norm) ? norm : 'zoom_in';
        };

        // Strict deduplication tracker: ensure every imageIndex is used AT MOST ONCE
        const usedImageIndices = new Set();

        const scenes = rawScenes.map((s, idx) => {
            let candidateIdx = -1;
            if (Array.isArray(s)) {
                candidateIdx = (typeof s[0] === 'number') ? s[0] : -1;
            } else {
                candidateIdx = (typeof s.imageIndex === 'number') ? s.imageIndex : ((typeof s.i === 'number') ? s.i : -1);
            }

            let finalImageIndex = -1;
            // Check if valid index in range and NOT already used
            if (candidateIdx >= 0 && candidateIdx < imageItems.length) {
                if (!usedImageIndices.has(candidateIdx)) {
                    finalImageIndex = candidateIdx;
                    usedImageIndices.add(candidateIdx);
                } else {
                    // Duplicate detected -> Strictly mark as empty (-1) to avoid viewer boredom
                    console.log(`[AI Script Match] Duplicate image index ${candidateIdx} at scene ${idx + 1}. Enforcing empty slot.`);
                    finalImageIndex = -1;
                }
            } else {
                finalImageIndex = -1;
            }

            const sceneText = Array.isArray(s) ? (s[1] || `Phân cảnh ${idx + 1}`) : (s.sceneText || s.t || `Phân cảnh ${idx + 1}`);
            const motion = Array.isArray(s) ? cleanMotion(s[2]) : cleanMotion(s.suggestedMotion || s.motion || s.m);
            const duration = Array.isArray(s) ? parseFloat(s[3] || 4.0) : parseFloat(s.suggestedDuration || s.duration || s.d || 4.0);
            const fadeIn = Array.isArray(s) ? parseFloat(s[4] || 0.8) : parseFloat(s.fadeIn || s.fi || 0.8);
            const fadeOut = Array.isArray(s) ? parseFloat(s[5] || 0.8) : parseFloat(s.fadeOut || s.fo || 0.8);
            const reason = Array.isArray(s) ? (s[6] || '') : (s.reason || s.matchReason || '');

            return {
                imageIndex: finalImageIndex,
                sceneText: sceneText.trim(),
                suggestedMotion: motion,
                suggestedDuration: Math.max(1.0, Math.min(30.0, isNaN(duration) ? 4.0 : duration)),
                fadeIn: Math.max(0, Math.min(3.0, isNaN(fadeIn) ? 0.8 : fadeIn)),
                fadeOut: Math.max(0, Math.min(3.0, isNaN(fadeOut) ? 0.8 : fadeOut)),
                reason: finalImageIndex === -1 
                    ? (reason || 'Để trống để tránh lặp ảnh cũ / cần bổ sung ảnh mới cho câu này') 
                    : reason
            };
        });

        const matchedCount = usedImageIndices.size;
        const emptyCount = scenes.filter(s => s.imageIndex === -1).length;

        console.log(`[AI Script Match] Completed: ${scenes.length} scenes, ${matchedCount} matched unique images, ${emptyCount} empty slots (no duplicate images).`);

        res.json({ 
            success: true, 
            result: { 
                scenes,
                totalScenes: scenes.length,
                matchedCount,
                emptyCount
            } 
        });
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
    let w = 1920, h = 1080;
    let fps = customFps ? parseInt(customFps) : 30;
    let crf = '20';
    let preset = 'fast';

    if (qualityPreset === 'fast_720p') {
        crf = '26';
        preset = 'veryfast';
        if (aspectRatio === '9:16') { w = 720; h = 1280; }
        else if (aspectRatio === '1:1') { w = 720; h = 720; }
        else { w = 1280; h = 720; }
    } else if (qualityPreset === 'high_1080p_60fps') {
        fps = customFps ? parseInt(customFps) : 60;
        crf = '18';
        preset = 'medium';
        if (aspectRatio === '9:16') { w = 1080; h = 1920; }
        else if (aspectRatio === '1:1') { w = 1080; h = 1080; }
        else { w = 1920; h = 1080; }
    } else if (qualityPreset === 'ultra_4k') {
        fps = customFps ? parseInt(customFps) : 60;
        crf = '16';
        preset = 'medium';
        if (aspectRatio === '9:16') { w = 2160; h = 3840; }
        else if (aspectRatio === '1:1') { w = 2160; h = 2160; }
        else { w = 3840; h = 2160; }
    } else {
        // standard_1080p
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

    const aspectRatio = settings?.aspectRatio || settings?.ratio || '16:9';
    const qualityPreset = settings?.qualityPreset || 'standard_1080p';
    const reframeMode = settings?.reframeMode || 'cover'; // 'cover', 'contain_blur', 'contain_black'
    const customFps = settings?.fps ? parseInt(settings.fps) : null;

    const { width, height, fps, crf, preset } = getOutputDimensionsAndEncoding(aspectRatio, qualityPreset, customFps);

    // Expand items by loopCount if specified (e.g. repetition 2x, 3x for fitness/workout videos)
    const expandedItems = [];
    items.forEach(item => {
        const loopCount = Math.max(1, parseInt(item.settings?.loopCount) || 1);
        for (let l = 0; l < loopCount; l++) {
            expandedItems.push(item);
        }
    });

    // Calculate total duration across expanded items
    let totalDuration = 0;
    expandedItems.forEach(item => {
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

    // Start background FFmpeg execution with expandedItems
    executeFFmpegRender(job, expandedItems, bgm, { width, height, fps, crf, preset, reframeMode, aspectRatio, outputPath });
});

// Helper to build FFmpeg drawtext filter for Text Overlay
// Helper to auto-wrap long subtitle text to prevent edge overflow
function wrapTextSmart(text, maxChars = 50) {
    if (!text || text.length <= maxChars) return text;
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        if (!currentLine) {
            currentLine = word;
        } else if ((currentLine + ' ' + word).length <= maxChars) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.join('\n');
}

// Helper to build FFmpeg drawtext filter for Text Overlay safely via textfile
function buildDrawtextFilter(settings, width, height, tempFiles = []) {
    if (!settings || !settings.overlayText || !settings.overlayText.trim()) {
        return '';
    }
    const text = settings.overlayText.trim();
    
    // Calculate max characters per line based on aspect ratio & width
    let maxChars = 48;
    if (width < height) {
        // 9:16 portrait format (Shorts / TikTok)
        maxChars = 26;
    } else if (width === height) {
        // 1:1 square format (Instagram)
        maxChars = 34;
    }

    const wrappedText = wrapTextSmart(text, maxChars);

    // Write text to temporary UTF-8 file to avoid all FFmpeg command line & filter graph escaping issues
    const textTmpFile = path.join(OUTPUTS_DIR, `txt_${Date.now()}_${Math.round(Math.random() * 1e8)}.txt`);
    fs.writeFileSync(textTmpFile, wrappedText, 'utf8');
    tempFiles.push(textTmpFile);

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

    let styleParams = ':fontcolor=white:line_spacing=10';
    if (style === 'banner') {
        styleParams = ':fontcolor=white:box=1:boxcolor=black@0.78:boxborderw=18:line_spacing=10';
    } else if (style === 'outline') {
        styleParams = ':fontcolor=white:borderw=4:bordercolor=black:line_spacing=10';
    } else if (style === 'glow') {
        styleParams = ':fontcolor=white:shadowcolor=0x6366F1@0.8:shadowx=3:shadowy=3:borderw=2:bordercolor=black:line_spacing=10';
    } else if (style === 'plain') {
        styleParams = ':fontcolor=white:line_spacing=10';
    }

    let animParams = '';
    const textAnimation = settings.textAnimation || 'always';
    if (textAnimation === 'intro') {
        animParams = ":enable='between(t,0,2.8)'";
    }

    const safeTextFilePath = textTmpFile.replace(/\\/g, '/').replace(/:/g, '\\:');
    return `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':expansion=none:textfile='${safeTextFilePath}':fontsize=${scaledFontSize}:x=${x}:y=${y}${styleParams}${animParams}`;
}

// Function to render a single batch/chunk of items
function renderChunk(job, chunkItems, chunkOutputPath, chunkIndex, totalChunks, config, tempFiles = []) {
    return new Promise((resolve, reject) => {
        const { width, height, fps, crf, preset, reframeMode } = config;
        const args = ['-y'];

        // Ensure fallback 1x1 black image exists for empty placeholder scenes
        const defaultPlaceholderPath = path.join(OUTPUTS_DIR, 'default_placeholder.png');
        if (!fs.existsSync(defaultPlaceholderPath)) {
            const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
            fs.writeFileSync(defaultPlaceholderPath, png1x1);
        }

        chunkItems.forEach((item) => {
            let filePath = path.join(UPLOADS_DIR, item.filename || 'empty.png');
            if (!fs.existsSync(filePath)) {
                if (item.path && fs.existsSync(item.path)) {
                    filePath = item.path;
                } else if (item.filename && fs.existsSync(path.join(OUTPUTS_DIR, item.filename))) {
                    filePath = path.join(OUTPUTS_DIR, item.filename);
                } else {
                    filePath = defaultPlaceholderPath;
                }
            }
            args.push('-i', filePath);
        });

        const filterComplex = [];
        const videoStreamTags = [];
        const audioStreamTags = [];

        let chunkDuration = 0;

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
                chunkDuration += dur;
                let zExpr = '1.0';
                let xExpr = '(iw-iw/zoom)/2';
                let yExpr = '(ih-ih/zoom)/2';

                if (motion === 'zoom_in') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = '(iw-iw/zoom)/2';
                    yExpr = '(ih-ih/zoom)/2';
                } else if (motion === 'zoom_out') {
                    zExpr = `${zoomIntensity}-(${delta}*(on/${frames}))`;
                    xExpr = '(iw-iw/zoom)/2';
                    yExpr = '(ih-ih/zoom)/2';
                } else if (motion === 'pan_left') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = `(iw-iw/zoom)*(1-(on/${frames}))`;
                    yExpr = '(ih-ih/zoom)/2';
                } else if (motion === 'pan_right') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = `(iw-iw/zoom)*(on/${frames})`;
                    yExpr = '(ih-ih/zoom)/2';
                } else if (motion === 'pan_up') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = '(iw-iw/zoom)/2';
                    yExpr = `(ih-ih/zoom)*(1-(on/${frames}))`;
                } else if (motion === 'pan_down') {
                    zExpr = `${zoomIntensity}`;
                    xExpr = '(iw-iw/zoom)/2';
                    yExpr = `(ih-ih/zoom)*(on/${frames})`;
                } else if (motion === 'zoom_in_left') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = '0';
                    yExpr = '0';
                } else if (motion === 'zoom_in_right') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = 'iw-iw/zoom';
                    yExpr = '0';
                } else if (motion === 'zoom_pan') {
                    zExpr = `1.0+(${delta}*(on/${frames}))`;
                    xExpr = `(iw-iw/zoom)*(on/${frames})`;
                    yExpr = `(ih-ih/zoom)*(on/${frames})`;
                } else {
                    // none or fallback static
                    zExpr = '1.0';
                    xExpr = '(iw-iw/zoom)/2';
                    yExpr = '(ih-ih/zoom)/2';
                }

                // High-resolution canvas to eliminate subpixel rounding jitter across all resolutions (720p, 1080p, 16:9, 9:16, 1:1)
                const scaleFactor = Math.max(2, Math.ceil(3840 / Math.max(width, height)));
                const highW = width * scaleFactor;
                const highH = height * scaleFactor;

                let preScaleFilter = '';
                if (reframeMode === 'contain_blur') {
                    preScaleFilter = `split=2[rawmain_${idx}][rawbg_${idx}];[rawbg_${idx}]scale=w=${highW}:h=${highH}:force_original_aspect_ratio=increase,crop=${highW}:${highH},boxblur=25:5[bg_${idx}];[rawmain_${idx}]scale=w=${highW}:h=${highH}:force_original_aspect_ratio=decrease[fg_${idx}];[bg_${idx}][fg_${idx}]overlay=(W-w)/2:(H-h)/2`;
                } else if (reframeMode === 'contain_black') {
                    preScaleFilter = `scale=w=${highW}:h=${highH}:force_original_aspect_ratio=decrease,pad=${highW}:${highH}:(ow-iw)/2:(oh-ih)/2:black`;
                } else {
                    preScaleFilter = `scale=w=${highW}:h=${highH}:force_original_aspect_ratio=increase,crop=${highW}:${highH}`;
                }

                let vFilters = `${preScaleFilter},zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${width}x${height}:fps=${fps},setsar=1,format=yuv420p`;

                if (fadeIn > 0) {
                    vFilters += `,fade=t=in:st=0:d=${fadeIn}`;
                }
                if (fadeOut > 0) {
                    const fadeStart = Math.max(0, dur - fadeOut);
                    vFilters += `,fade=t=out:st=${fadeStart}:d=${fadeOut}`;
                }

                const drawtextFilter = buildDrawtextFilter(item.settings, width, height, tempFiles);
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
                chunkDuration += videoDur;
                const vol = Number(item.settings?.videoVolume ?? 1.0);

                let reframeFilter = '';
                if (reframeMode === 'cover') {
                    reframeFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
                } else if (reframeMode === 'contain_blur') {
                    reframeFilter = `split=2[rawmain_${idx}][rawbg_${idx}];[rawbg_${idx}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5[bgblur_${idx}];[rawmain_${idx}]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg_${idx}];[bgblur_${idx}][fg_${idx}]overlay=(W-w)/2:(H-h)/2`;
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

                const drawtextFilter = buildDrawtextFilter(item.settings, width, height, tempFiles);
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
            const str = d.toString();
            stderrLog += str;
            const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
            if (timeMatch && chunkDuration > 0) {
                const hours = parseFloat(timeMatch[1]);
                const mins = parseFloat(timeMatch[2]);
                const secs = parseFloat(timeMatch[3]);
                const currentTime = (hours * 3600) + (mins * 60) + secs;
                const chunkPct = Math.min(100, Math.round((currentTime / chunkDuration) * 100));
                if (totalChunks === 1) {
                    job.progress = Math.min(95, Math.max(job.progress || 0, Math.round(chunkPct * 0.95)));
                    sendJobUpdate(job);
                }
            }
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
        job.progress = 5;
        sendJobUpdate(job);

        if (items.length <= CHUNK_SIZE && (!bgm || !bgm.filename)) {
            // Direct single render
            await renderChunk(job, items, outputPath, 0, 1, config, tempFiles);
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
                return renderChunk(job, chunk, chunkFile, chunkIdx, chunks.length, config, tempFiles).then(() => {
                    completedChunks++;
                    const pct = Math.min(88, Math.round((completedChunks / chunks.length) * 88));
                    job.progress = Math.max(job.progress || 0, pct);
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
    if (!job.clients || !Array.isArray(job.clients)) return;
    job.clients.forEach(res => {
        try {
            res.write(`data: ${JSON.stringify({
                status: job.status,
                progress: job.progress,
                outputUrl: job.outputUrl,
                error: job.error
            })}\n\n`);
        } catch (e) {}
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
            inputPath = path.join(OUTPUTS_DIR, sourceFilename);
        }
        if (!fs.existsSync(inputPath)) {
            return res.status(404).json({ error: 'Không tìm thấy file nguồn trên máy chủ' });
        }

        const jobId = `wm_${Date.now()}`;
        const outputFilename = `watermark_result_${Date.now()}.mp4`;
        const outputPath = path.join(OUTPUTS_DIR, outputFilename);

        const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(sourceFilename);
        const mediaInfo = await getMediaInfo(inputPath);
        const totalDuration = isImage ? 5 : mediaInfo.duration;

        const job = {
            id: jobId,
            status: 'processing',
            progress: 10,
            outputUrl: `/outputs/${outputFilename}`,
            error: null,
            clients: []
        };
        activeJobs.set(jobId, job);

        res.json({ success: true, jobId, outputUrl: `/outputs/${outputFilename}` });

        // Build FFmpeg arguments asynchronously
        (async () => {
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

                    if (pos === 'custom' && logoSettings.xPct !== undefined && logoSettings.yPct !== undefined) {
                        const xPct = Math.min(99, Math.max(0, Number(logoSettings.xPct)));
                        const yPct = Math.min(99, Math.max(0, Number(logoSettings.yPct)));
                        overlayX = `${Math.round((xPct / 100) * mediaInfo.width)}`;
                        overlayY = `${Math.round((yPct / 100) * mediaInfo.height)}`;
                    } else {
                        switch (pos) {
                            case 'top_left': overlayX = `${margin}`; overlayY = `${margin}`; break;
                            case 'top_center': overlayX = `(main_w-w)/2`; overlayY = `${margin}`; break;
                            case 'top_right': overlayX = `main_w-w-${margin}`; overlayY = `${margin}`; break;
                            case 'center_left': overlayX = `${margin}`; overlayY = `(main_h-h)/2`; break;
                            case 'center': overlayX = `(main_w-w)/2`; overlayY = `(main_h-h)/2`; break;
                            case 'center_right': overlayX = `main_w-w-${margin}`; overlayY = `(main_h-h)/2`; break;
                            case 'bottom_left': overlayX = `${margin}`; overlayY = `main_h-h-${margin}`; break;
                            case 'bottom_center': overlayX = `(main_w-w)/2`; overlayY = `main_h-h-${margin}`; break;
                            case 'bottom_right':
                            default: overlayX = `main_w-w-${margin}`; overlayY = `main_h-h-${margin}`; break;
                        }
                    }

                    const logoTargetWidth = Math.max(20, Math.round((mediaInfo.width * scalePct) / 2) * 2);
                    const filterGraph = `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[base];[1:v]scale=${logoTargetWidth}:-2,format=rgba,colorchannelmixer=aa=${opacity}[logo];[base][logo]overlay=${overlayX}:${overlayY}:format=auto[v]`;

                    if (isImage) {
                        ffmpegArgs = [
                            '-y',
                            '-loop', '1',
                            '-i', inputPath,
                            '-i', logoPath,
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
                            '-i', logoPath,
                            '-filter_complex', filterGraph,
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
                    const xPct = delogoSettings.xPct !== undefined ? Number(delogoSettings.xPct) : (Number(delogoSettings.x) <= 100 ? Number(delogoSettings.x) : (Number(delogoSettings.x) / 1920) * 100);
                    const yPct = delogoSettings.yPct !== undefined ? Number(delogoSettings.yPct) : (Number(delogoSettings.y) <= 100 ? Number(delogoSettings.y) : (Number(delogoSettings.y) / 1080) * 100);
                    const wPct = delogoSettings.wPct !== undefined ? Number(delogoSettings.wPct) : (Number(delogoSettings.w) <= 100 ? Number(delogoSettings.w) : (Number(delogoSettings.w) / 1920) * 100);
                    const hPct = delogoSettings.hPct !== undefined ? Number(delogoSettings.hPct) : (Number(delogoSettings.h) <= 100 ? Number(delogoSettings.h) : (Number(delogoSettings.h) / 1080) * 100);

                    const mediaW = Math.round(mediaInfo.width / 2) * 2;
                    const mediaH = Math.round(mediaInfo.height / 2) * 2;

                    let pxX = Math.max(1, Math.round((xPct / 100) * mediaW));
                    let pxY = Math.max(1, Math.round((yPct / 100) * mediaH));
                    let pxW = Math.max(8, Math.round((wPct / 100) * mediaW));
                    let pxH = Math.max(8, Math.round((hPct / 100) * mediaH));

                    if (pxX + pxW >= mediaW) pxW = mediaW - pxX - 1;
                    if (pxY + pxH >= mediaH) pxH = mediaH - pxY - 1;
                    if (pxW < 8) { pxX = Math.max(1, mediaW - 10); pxW = 8; }
                    if (pxH < 8) { pxY = Math.max(1, mediaH - 10); pxH = 8; }

                    const filterType = delogoSettings.filterType || 'delogo';

                    let filterGraph = '';
                    if (filterType === 'blur') {
                        filterGraph = `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,split=2[main][crop];[crop]crop=${pxW}:${pxH}:${pxX}:${pxY},boxblur=20:5[blur];[main][blur]overlay=${pxX}:${pxY}[v]`;
                    } else if (filterType === 'crop') {
                        filterGraph = `[0:v]scale=iw*1.06:ih*1.06,crop=iw/1.06:ih/1.06:0:0,scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`;
                    } else {
                        // Standard Delogo Interpolation
                        filterGraph = `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,delogo=x=${pxX}:y=${pxY}:w=${pxW}:h=${pxH}:show=0[v]`;
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
                const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

                ffmpegProcess.stderr.on('data', (chunk) => {
                    const str = chunk.toString();
                    const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
                    if (timeMatch && totalDuration > 0) {
                        const hours = parseFloat(timeMatch[1]);
                        const mins = parseFloat(timeMatch[2]);
                        const secs = parseFloat(timeMatch[3]);
                        const currentTime = (hours * 3600) + (mins * 60) + secs;
                        const pct = Math.min(95, Math.max(10, Math.round((currentTime / totalDuration) * 95)));
                        job.progress = pct;
                        sendJobUpdate(job);
                    } else if (str.includes('frame=')) {
                        job.progress = Math.min(95, (job.progress || 10) + 5);
                        sendJobUpdate(job);
                    }
                });

                ffmpegProcess.on('close', (code) => {
                    if (code === 0) {
                        job.status = 'completed';
                        job.progress = 100;
                        job.outputUrl = `/outputs/${outputFilename}`;
                        sendJobUpdate(job);
                    } else {
                        job.status = 'error';
                        job.error = `FFmpeg kết thúc với mã lỗi ${code}`;
                        sendJobUpdate(job);
                    }
                });

                ffmpegProcess.on('error', (err) => {
                    job.status = 'error';
                    job.error = err.message || 'Lỗi khi khởi chạy FFmpeg';
                    sendJobUpdate(job);
                });
            } catch (err) {
                console.error('[Watermark Studio Error]:', err);
                job.status = 'error';
                job.error = err.message || 'Lỗi trong quá trình xử lý';
                sendJobUpdate(job);
            }
        })();
    } catch (err) {
        console.error("Process video error:", err);
        res.status(500).json({ error: err.message || "Lỗi hệ thống" });
    }
});

// ==========================================
// TAB 4: AI Video QA Auditor
// ==========================================

function extractVideoKeyframes(videoPath, duration) {
    return new Promise((resolve) => {
        const targetFrames = Math.min(30, Math.max(8, Math.floor(duration / 15)));
        const frameInterval = Math.max(2.0, duration / targetFrames);
        const tempDir = path.join(UPLOADS_DIR, `qa_frames_${Date.now()}_${Math.round(Math.random() * 1e4)}`);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const proc = spawn('ffmpeg', [
            '-i', videoPath,
            '-vf', `fps=1/${frameInterval.toFixed(2)},scale=420:-1`,
            '-q:v', '7',
            path.join(tempDir, 'frame_%03d.jpg')
        ]);

        proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.jpg')).sort();
                const results = files.map((f, idx) => {
                    const filePath = path.join(tempDir, f);
                    const timeSec = parseFloat((idx * frameInterval).toFixed(1));
                    const base64 = fs.readFileSync(filePath).toString('base64');
                    try { fs.unlinkSync(filePath); } catch (e) {}
                    return {
                        timeSec,
                        timeFormatted: formatTimeSec(timeSec),
                        base64
                    };
                });
                try { fs.rmdirSync(tempDir); } catch (e) {}
                resolve(results);
            } else {
                try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir); } catch (e) {}
                resolve([]);
            }
        });
        proc.on('error', () => {
            try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir); } catch (e) {}
            resolve([]);
        });
    });
}

function extractAudioBase64(videoPath, maxDuration = 1800) {
    return new Promise((resolve) => {
        const proc = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', maxDuration.toString(),
            '-vn',
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

function formatTimeSec(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

app.post('/api/qa/audit-video', upload.single('video'), async (req, res) => {
    try {
        let videoPath = null;
        let videoFilename = '';
        let originalName = '';

        if (req.file) {
            videoPath = req.file.path;
            videoFilename = req.file.filename;
            originalName = req.file.originalname;
        } else if (req.body.videoPath) {
            videoPath = path.isAbsolute(req.body.videoPath) ? req.body.videoPath : path.join(__dirname, req.body.videoPath);
            videoFilename = path.basename(videoPath);
            originalName = videoFilename;
        }

        if (!videoPath || !fs.existsSync(videoPath)) {
            return res.status(400).json({ error: 'Không tìm thấy tệp video để kiểm định' });
        }

        const scriptText = req.body.scriptText || '';
        const customApiKey = req.body.customApiKey || '';
        const apiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : DEFAULT_GEMINI_API_KEY;

        console.log(`[QA Auditor] Starting video audit on: ${videoFilename}`);
        const mediaInfo = await getMediaInfo(videoPath);
        const duration = mediaInfo.duration || 10;

        // 1 & 2. High-performance concurrent extraction of Keyframes & Audio in parallel
        const [keyframes, audioBase64] = await Promise.all([
            extractVideoKeyframes(videoPath, duration),
            extractAudioBase64(videoPath, Math.min(1800, duration))
        ]);

        console.log(`[QA Auditor] Fast extracted ${keyframes.length} keyframes and audio`);

        // 3. Build Gemini multimodal payload
        const ai = new GoogleGenAI({ apiKey });
        const contents = [];

        // Add audio if available
        if (audioBase64) {
            contents.push({ text: `[AUDIO TRACK CỦA VIDEO - Thời lượng: ${duration.toFixed(1)}s]` });
            contents.push({
                inlineData: {
                    mimeType: 'audio/mp3',
                    data: audioBase64
                }
            });
        }

        // Add keyframes
        keyframes.forEach((kf) => {
            contents.push({ text: `[KHUNG HÌNH TẠI GIÂY ${kf.timeFormatted} (${kf.timeSec}s)]` });
            contents.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: kf.base64
                }
            });
        });

        const promptText = `
Bạn là Trợ Lý Đạo Diễn & Chuyên Gia Kiểm Định Chất Lượng Video Cao Cấp (Senior Multimodal Video QA Auditor).
Hãy phân tích và đánh giá toàn diện video trên (gồm âm thanh/giọng nói và chuỗi khung hình theo các mốc giây).

${scriptText.trim() ? `--- KỊCH BẢN / NỘI DUNG GỐC ĐƯỢC CUNG CẤP ---\n${scriptText.trim()}\n---` : ''}

Nhiệm vụ kiểm định cốt lõi:
1. ĐỒNG BỘ GIỌNG ĐỌC & KHUNG HÌNH (Voice-Visual Sync): Lời nói/giọng đọc có khớp với hình ảnh đang diễn ra không? Chuyển cảnh có bị trễ, sớm hoặc lệch so với câu thoại không?
2. KHỚP KỊCH BẢN & HÌNH ẢNH (Script-Visual Accuracy): Hình ảnh tại từng thời điểm có diễn tả đúng chủ đề kịch bản không? Có hình ảnh nào bị "lạc quẻ" không liên quan không?
3. NHỊP ĐIỆU & CẢM XÚC (Pacing & Transition): Tốc độ chuyển động, nhịp độ nói và chuyển cảnh có hài hòa cuốn hút không?
4. ĐÁNH GIÁ CHI TIẾT TỪNG MỐC THỜI GIAN (Timeline Critiques): Chỉ rõ từng đoạn (ví dụ 00:00 - 00:04) xem đoạn nào làm tốt (status: "ok"), đoạn nào cần chú ý (status: "warning"), đoạn nào bị lệch nặng (status: "error") kèm lời khuyên chỉnh sửa cụ thể.

Trả về DUY NHẤT một chuỗi JSON hợp lệ theo schema sau (không thêm markdown backticks thừa ngoài JSON):
{
  "overallScore": 88,
  "verdict": "GOOD",
  "summary": "Video có nhịp điệu tốt và hình ảnh đẹp mắt. Cần căn chỉnh lại phân đoạn ở giây 00:06 để khớp trọn vẹn với câu thoại.",
  "scores": {
    "voiceSync": 85,
    "scriptMatch": 90,
    "pacing": 88,
    "visuals": 92
  },
  "strengths": [
    "Hình ảnh minh họa có độ sắc nét và màu sắc rất cuốn hút",
    "Hiệu ứng chuyển động mượt mà"
  ],
  "improvements": [
    "Cần kéo dài thời lượng đoạn thứ 2 thêm 1 giây để khớp hết lời đọc",
    "Thêm phụ đề nhấn mạnh vào từ khóa quan trọng"
  ],
  "timelineCritiques": [
    {
      "timestamp": "00:00 - 00:04",
      "startTime": 0,
      "endTime": 4,
      "status": "ok",
      "topic": "Khởi đầu thu hút",
      "observation": "Khung hình mở đầu khớp với lời chào, chuyển động zoom vào trọng tâm rất tốt.",
      "suggestion": "Giữ nguyên"
    },
    {
      "timestamp": "00:04 - 00:09",
      "startTime": 4,
      "endTime": 9,
      "status": "warning",
      "topic": "Độ trễ chuyển cảnh",
      "observation": "Lời đọc đã chuyển sang nội dung mới nhưng khung hình cũ vẫn còn lưu lại khoảng 1.5s.",
      "suggestion": "Nên cắt ngắn ảnh trước 1s hoặc đẩy câu thoại chậm lại 1 nhịp."
    }
  ]
}
`;
        contents.push({ text: promptText });

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents,
            config: {
                responseMimeType: "application/json"
            }
        });

        const rawText = response.text ? response.text.trim() : "";
        let auditData = null;
        try {
            auditData = JSON.parse(rawText);
        } catch (parseErr) {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                auditData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Không thể phân tích dữ liệu JSON từ AI: " + rawText);
            }
        }

        res.json({
            success: true,
            video: {
                filename: videoFilename,
                originalName,
                url: `/uploads/${videoFilename}`,
                duration,
                width: mediaInfo.width,
                height: mediaInfo.height
            },
            audit: auditData
        });
    } catch (err) {
        console.error('[QA Auditor Error]:', err);
        res.status(500).json({ error: err.message || 'Lỗi trong quá trình kiểm định video' });
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎬 Video Tool Web UI is running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
