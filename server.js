const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
const PUBLIC_DIR = path.join(__dirname, 'public');

[UPLOADS_DIR, OUTPUTS_DIR, PUBLIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/outputs', express.static(OUTPUTS_DIR));

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
            let duration = 3.0; // default for images

            if (isImage) {
                type = 'image';
                duration = 3.5;
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
                    duration: type === 'image' ? 3.5 : parseFloat(duration.toFixed(2)),
                    motion: 'zoom_in', // zoom_in, zoom_out, pan_left, pan_right, zoom_pan, none
                    zoomIntensity: 1.3,
                    fadeIn: 0.8,
                    fadeOut: 0.8,
                    fitMode: 'cover', // cover, contain
                    videoVolume: 1.0,
                    trimStart: 0,
                    trimEnd: type === 'video' ? parseFloat(duration.toFixed(2)) : 0
                }
            });
        }

        res.json({ success: true, files: filesData });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
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
            totalDuration += Number(item.settings?.duration || 3.5);
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

// Function to construct and run FFmpeg command
async function executeFFmpegRender(job, items, bgm, config) {
    const { width, height, fps, outputPath } = config;
    const args = ['-y'];

    // Add input files
    const inputIndices = [];
    items.forEach((item, index) => {
        const filePath = path.join(UPLOADS_DIR, item.filename);
        args.push('-i', filePath);
        inputIndices.push(index);
    });

    let bgmIndex = -1;
    if (bgm && bgm.filename) {
        const bgmPath = path.join(UPLOADS_DIR, bgm.filename);
        if (fs.existsSync(bgmPath)) {
            bgmIndex = items.length;
            args.push('-i', bgmPath);
        }
    }

    // Build filter complex
    const filterComplex = [];
    const videoStreamTags = [];
    const audioStreamTags = [];

    items.forEach((item, idx) => {
        const vTag = `v_${idx}`;
        const aTag = `a_${idx}`;
        const dur = Number(item.settings?.duration || 3.5);
        const frames = Math.round(dur * fps);
        const fadeIn = Number(item.settings?.fadeIn || 0);
        const fadeOut = Number(item.settings?.fadeOut || 0);
        const motion = item.settings?.motion || 'zoom_in';

        if (item.type === 'image') {
            // Zoompan expressions using 'on' (output frame index from 0 to frames-1)
            let zExpr = '1.0';
            let xExpr = 'iw/2-(iw/zoom/2)';
            let yExpr = 'ih/2-(ih/zoom/2)';

            if (motion === 'zoom_in') {
                zExpr = `1.0+(0.3*(on/${frames}))`;
                xExpr = 'iw/2-(iw/zoom/2)';
                yExpr = 'ih/2-(ih/zoom/2)';
            } else if (motion === 'zoom_out') {
                zExpr = `1.3-(0.3*(on/${frames}))`;
                xExpr = 'iw/2-(iw/zoom/2)';
                yExpr = 'ih/2-(ih/zoom/2)';
            } else if (motion === 'pan_left') {
                zExpr = '1.2';
                xExpr = `(iw-iw/zoom)*(1-(on/${frames}))`;
                yExpr = 'ih/2-(ih/zoom/2)';
            } else if (motion === 'pan_right') {
                zExpr = '1.2';
                xExpr = `(iw-iw/zoom)*(on/${frames})`;
                yExpr = 'ih/2-(ih/zoom/2)';
            } else if (motion === 'zoom_pan') {
                zExpr = `1.0+(0.25*(on/${frames}))`;
                xExpr = `(iw-iw/zoom)*(on/${frames})`;
                yExpr = `(ih-ih/zoom)*(on/${frames})`;
            }

            // High-res pre-scale to avoid zoompan jitter
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

            filterComplex.push(`[${idx}:v]${vFilters}[${vTag}]`);
            videoStreamTags.push(`[${vTag}]`);

            // Generate silent audio matching image duration
            filterComplex.push(`anullsrc=r=44100:cl=stereo:d=${dur}[${aTag}]`);
            audioStreamTags.push(`[${aTag}]`);
        } else {
            // Video item
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

            filterComplex.push(`[${idx}:v]${vFilters}[${vTag}]`);
            videoStreamTags.push(`[${vTag}]`);

            // Process video audio
            if (vol > 0) {
                filterComplex.push(`[${idx}:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${vol},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${aTag}]`);
            } else {
                filterComplex.push(`anullsrc=r=44100:cl=stereo:d=${videoDur}[${aTag}]`);
            }
            audioStreamTags.push(`[${aTag}]`);
        }
    });

    // Concat all segments
    let concatSegments = '';
    for (let i = 0; i < items.length; i++) {
        concatSegments += `${videoStreamTags[i]}${audioStreamTags[i]}`;
    }
    filterComplex.push(`${concatSegments}concat=n=${items.length}:v=1:a=1[v_concat][a_concat]`);

    // Handle BGM mixing if present
    let finalAudioTag = '[a_concat]';
    if (bgmIndex !== -1) {
        const bgmVol = Number(bgm.volume ?? 0.6);
        const bgmFadeOut = Math.max(0, job.totalDuration - 2);
        // Loop BGM to cover total duration, adjust volume, fade out
        filterComplex.push(`[${bgmIndex}:a]aloop=loop=-1:size=2e+09,atrim=0:${job.totalDuration},asetpts=PTS-STARTPTS,volume=${bgmVol},afade=t=out:st=${bgmFadeOut}:d=2,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[bgm_proc]`);
        filterComplex.push(`[a_concat][bgm_proc]amix=inputs=2:duration=first:dropout_transition=2[a_mixed]`);
        finalAudioTag = '[a_mixed]';
    }

    args.push('-filter_complex', filterComplex.join('; '));
    args.push('-map', '[v_concat]');
    args.push('-map', finalAudioTag);
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
    args.push('-progress', 'pipe:1');
    args.push(outputPath);

    console.log('Spawning FFmpeg with args:', args.join(' '));
    const ffmpegProc = spawn('ffmpeg', args);
    job.process = ffmpegProc;

    ffmpegProc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.startsWith('out_time_us=')) {
                const us = parseInt(line.split('=')[1]);
                if (!isNaN(us) && job.totalDuration > 0) {
                    const currentSec = us / 1000000;
                    const percent = Math.min(99, Math.round((currentSec / job.totalDuration) * 100));
                    job.progress = percent;
                    sendJobUpdate(job);
                }
            } else if (line.startsWith('progress=end')) {
                job.progress = 100;
                sendJobUpdate(job);
            }
        });
    });

    ffmpegProc.stderr.on('data', (data) => {
        const str = data.toString();
        job.logs.push(str);
        if (job.logs.length > 50) job.logs.shift();
    });

    ffmpegProc.on('close', (code) => {
        job.process = null;
        if (code === 0) {
            job.status = 'completed';
            job.progress = 100;
            job.outputUrl = `/outputs/${job.outputFilename}`;
            console.log(`Job ${job.id} completed successfully: ${job.outputUrl}`);
        } else {
            job.status = 'failed';
            job.error = `FFmpeg process exited with code ${code}`;
            console.error(`Job ${job.id} failed with code ${code}`);
        }
        sendJobUpdate(job);
    });

    ffmpegProc.on('error', (err) => {
        job.status = 'failed';
        job.error = err.message;
        sendJobUpdate(job);
    });
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
