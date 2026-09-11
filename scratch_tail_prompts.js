const fs = require('fs');

const pContent = fs.readFileSync('scripts/submarine_trapped/prompts_image_generation.md', 'utf8');
const prompts = pContent.split('\n').map(l => l.trim()).filter(l => l.includes('--ar 16:9'));

const viContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_vi.md', 'utf8');
const viLines = viContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

const jaContent = fs.readFileSync('scripts/submarine_trapped/script_submarine_trapped_voicevox.md', 'utf8');
const jaLines = jaContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Key content matcher for prompts
// We want to map each of the 88 prompts to its true corresponding scene in viLines (0 to 90)
console.log('Total prompts:', prompts.length);
console.log('Total scenes:', viLines.length);

// Let's examine scenes 70 to 91 and which prompts match them:
for (let pIdx = 65; pIdx < prompts.length; pIdx++) {
    console.log(`P[${pIdx+1}]: ${prompts[pIdx].substring(0, 75)}...`);
}
