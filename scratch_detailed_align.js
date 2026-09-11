const fs = require('fs');
const path = require('path');

const pContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'prompts_image_generation.md'), 'utf8');
const prompts = pContent.split('\n').map(l => l.trim()).filter(l => l.includes('--ar 16:9'));

const viContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'script_submarine_trapped_vi.md'), 'utf8');
const viLines = viContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

const voicevoxContent = fs.readFileSync(path.join(__dirname, 'scripts', 'submarine_trapped', 'script_submarine_trapped_voicevox.md'), 'utf8');
const voicevoxLines = voicevoxContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Let's find where the semantic alignment differs
for (let i = 0; i < Math.min(viLines.length, prompts.length); i++) {
    console.log(`[${i+1}]`);
    console.log(`  VI: ${viLines[i]}`);
    console.log(`  PR: ${prompts[i].substring(0, 80)}...`);
}
