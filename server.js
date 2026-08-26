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

// Render Video API
app.post('/api/render', async (req, res) => {
    const { items, bgm, settings } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for rendering' });
    }

    const jobId = 'render_' + Date.now();
    const outputFilename = `output_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    const width = settings?.width || 1920;
    const height = settings?.height || 1080;
    const fps = settings?.fps || 30;

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
    res.json({ jobId, outputFilename, totalDuration });

    // Start background FFmpeg execution
    executeFFmpegRender(job, items, bgm, { width, height, fps, outputPath });
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
        const { width, height, fps } = config;
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

                let vFilters = `trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${fps},format=yuv420p`;

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
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p');
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

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎬 Video Tool Web UI is running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
