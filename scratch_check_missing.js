const fs = require('fs');
const path = require('path');

const pContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'prompts_image_generation.md'), 'utf8');
const prompts = pContent.split('\n').map(l => l.trim()).filter(l => l.includes('--ar 16:9'));

const viContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'script_submarine_trapped_vi.md'), 'utf8');
const viLines = viContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

const voicevoxContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'script_submarine_trapped_voicevox.md'), 'utf8');
const voicevoxLines = voicevoxContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

console.log('VI Lines:', viLines.length);
console.log('Voicevox Lines:', voicevoxLines.length);
console.log('Prompts:', prompts.length);

for (let i = 0; i < viLines.length; i++) {
    console.log(`[${i+1}] VI: ${viLines[i].substring(0, 45)}`);
    console.log(`    JA: ${voicevoxLines[i] ? voicevoxLines[i].substring(0, 45) : 'N/A'}`);
    console.log(`    PR: ${prompts[i] ? prompts[i].substring(0, 60) : 'MISSING'}`);
    console.log('---');
}
