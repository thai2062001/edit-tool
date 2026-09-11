const fs = require('fs');

const pContent = fs.readFileSync('scripts/submarine_trapped/prompts_image_generation.md', 'utf8');
const prompts = pContent.split('\n').map(l => l.trim()).filter(l => l.includes('--ar 16:9'));

const viContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_vi.md', 'utf8');
const viLines = viContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

const jaContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_voicevox.md', 'utf8');
const jaLines = jaContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

for (let i = 0; i < jaLines.length; i++) {
    const vi = viLines[i] || '';
    const ja = jaLines[i] || '';
    const pr = prompts[i] || '*** MISSING PROMPT ***';
    console.log(`[Cảnh ${i+1}]`);
    console.log(`  VI: ${vi}`);
    console.log(`  JA: ${ja.substring(0, 60)}...`);
    console.log(`  PR: ${pr.substring(0, 80)}...`);
    console.log('');
}
