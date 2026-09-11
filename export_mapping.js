const fs = require('fs');

const pContent = fs.readFileSync('scripts/submarine_trapped/prompts_image_generation.md', 'utf8');
const prompts = pContent.split('\n').map(l => l.trim()).filter(l => l.includes('--ar 16:9'));

const viContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_vi.md', 'utf8');
const viLines = viContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

const jaContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_voicevox.md', 'utf8');
const jaLines = jaContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

let out = '';
for (let i = 0; i < jaLines.length; i++) {
    const vi = viLines[i] || '';
    const pr = prompts[i] || '*** MISSING PROMPT ***';
    out += `[Cảnh ${i+1}]\n  VI: ${vi}\n  PR: ${pr.substring(0, 90)}...\n\n`;
}
fs.writeFileSync('mapping_utf8.txt', out, 'utf8');
console.log('Done mapping_utf8.txt');
