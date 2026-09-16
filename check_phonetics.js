const fs = require('fs');
const path = require('path');

const baseDir = 'scripts/derinkuyu_underground/audio';
const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf8'));
const kanaInspection = JSON.parse(fs.readFileSync(path.join(baseDir, 'kana_inspection.json'), 'utf8'));

console.log('=== OPTIMIZATIONS PERFORMED IN MANIFEST ===');
manifest.forEach(m => {
  if (m.changesCount > 0 || m.originalText !== m.optimizedText) {
    console.log(`[#${m.index}] changes: ${m.changesCount}`);
    console.log(`   Orig: ${m.originalText}`);
    console.log(`   Opt : ${m.optimizedText}`);
  }
});

console.log('\n=== CHECKING SENSITIVE READINGS ACROSS ALL 75 SENTENCES ===');
// Check all sentences with numbers, special kanji, names
kanaInspection.forEach(item => {
  const m = manifest.find(x => x.index === item.index);
  const orig = m.originalText;
  const kana = item.kana;

  // Let's inspect kanas of key words:
  const checkWords = [
    { kanji: '18層', expected: 'ハッソオ' },
    { kanji: '85メートル', expected: 'ハチジュウ' },
    { kanji: '1963年', expected: 'セン' },
    { kanji: '2万人', expected: 'ニマン' },
    { kanji: '一本', expected: 'イッポン' },
    { kanji: '1トン', expected: 'イットン' },
    { kanji: '50センチ', expected: 'ゴジュッ' },
    { kanji: '2メートル', expected: 'ニメエトル' },
    { kanji: '30階建て', expected: 'サンジュッカイ' },
    { kanji: '1万5000本', expected: 'イチマン' },
    { kanji: '55メートル', expected: 'ゴジュウ' },
    { kanji: '10キロメートル', expected: 'ジュウ' },
    { kanji: '1万2000年前', expected: 'イチマン' },
    { kanji: '13度から15度', expected: 'ジュウサン' },
    { kanji: '凝灰岩', expected: 'ギョオカイガン' },
    { kanji: '通気坑', expected: 'ツウキ' },
    { kanji: '石扉', expected: 'イシトビラ' },
    { kanji: '覗き穴', expected: 'ノゾキアナ' },
    { kanji: '籠城', expected: 'ロオジョオ' },
    { kanji: '煮炊き', expected: 'ニタキ' },
    { kanji: '墓坑', expected: 'ボコオ' },
    { kanji: 'ヴァラ', expected: 'ヴァラ' },
    { kanji: 'アフラ・マズダ', expected: 'アフラ' },
    { kanji: 'ジャムシード', expected: 'ジャムシード' },
    { kanji: 'ヤンガードリアス', expected: 'ヤンガードリアス' },
    { kanji: '槌', expected: 'ツチ' }
  ];

  checkWords.forEach(w => {
    if (orig.includes(w.kanji)) {
      const match = kana.toLowerCase().includes(w.expected.toLowerCase()) || kana.includes(w.expected);
      console.log(`[#${item.index}] '${w.kanji}' -> Expected '${w.expected}' in kana: ${match ? 'YES' : 'NO'}`);
      if (!match) {
        console.log(`   Full Kana: ${kana}`);
      }
    }
  });
});
