const fs = require('fs');
const path = require('path');

const baseDir = 'scripts/derinkuyu_underground/audio';
const kanaInspection = JSON.parse(fs.readFileSync(path.join(baseDir, 'kana_inspection.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf8'));
const quality = JSON.parse(fs.readFileSync(path.join(baseDir, 'quality_report.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(baseDir, 'audit_75_full.json'), 'utf8'));

console.log('Total items in kana_inspection:', kanaInspection.length);

const suspectItems = [];

kanaInspection.forEach((item, idx) => {
  const index = item.index;
  const kana = item.kana;
  const opt = item.optimizedText;
  const orig = manifest[idx] ? manifest[idx].originalText : '';
  const changes = manifest[idx] ? manifest[idx].changesCount : 0;
  
  // Checks:
  // 1. Double pauses or weird characters
  // 2. Misreadings of numbers or specialized terms
  // 3. Question marks at end of questions
  const endsWithQInText = opt.endsWith('？') || opt.endsWith('?');
  const endsWithQInKana = kana.includes('？') || kana.includes('?');

  // Check numbers
  const numsInText = opt.match(/\d+/g) || [];
  
  // Let's log any potential points of interest
  const issues = [];

  // Check if originalText was modified to optimizedText
  if (changes > 0) {
    // Show what was optimized
    // e.g. adding pauses, phonetic spelling
  }

  // Check pause density (pauses / length)
  const pauseCount = (kana.match(/、/g) || []).length;
  const slashCount = (kana.match(/\//g) || []).length; // accent phrases

  // Check for unresolved kanji or ascii in kana
  const weirdInKana = kana.match(/[^\u3040-\u309F\u30A0-\u30FF\u3000-\u303F'_\/？\?a-zA-Z0-9]/g);
  if (weirdInKana) {
    issues.push(`Unconverted characters in kana: ${weirdInKana.join('')}`);
  }

  // Check specific phonetic accuracy:
  // e.g. 1万5000本, 10キロメートル, 18層, 85メートル, 55メートル
  if (opt.includes('18層') && !opt.includes('じゅうはっそう') && !kana.includes('ハッソオ')) {
    issues.push(`18層 may be misread as juuhachisou instead of juuhassou`);
  }

  if (opt.includes('？') && !opt.endsWith('？') && !opt.endsWith('?')) {
    // question mark in middle
  }

  if (issues.length > 0) {
    suspectItems.push({ index, opt, kana, issues });
  }
});

console.log('Suspect items found:', suspectItems);
