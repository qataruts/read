// اختبار «صدق الصورة» — حكم المدير على `docs/REVIEW_ICONS.md` (٦ أغسطس ٢٠٢٦):
//   node tools/test_icons.mjs
//
// المبدأ (DESIGN §٦): الصورة تدلّ على الكلمة نفسِها لا مرادفِها ولا جارتِها. وحيث لا
// تُوجد صورةٌ صادقة، **تُخرَج الكلمة من موضع الإجابة ولا تُخرَج من حصيلة الطفل**:
// تُعلَن `pictured: false` فتبقى بطاقةً تُنقَر وتُسمع، وتُهجَّى وتُركَّب، وتدخل الجمل —
// ويُمنع وحدَه أن يُحكَم على قراءتها بصورة.
//
// وهذا الملف يثبت **الشقّين معاً**، فالحارس نصفُه منعٌ ونصفُه إبقاء:
//   ١) لا تظهر غيرُ المصوَّرة هدفاً ولا خياراً مصوَّراً في أيٍّ من أحواض الأسئلة
//      الثلاثة: باقات «اقرأ واختر»، وخيارات سلّم الجمل، وسؤال فهم القصة.
//   ٢) وتظهر — في التهجئة و«ركّب الكلمة» وبطاقة «شاهد واسمع» وجمل السلّم.
// ويثبت زيادةً أن الإخراج **لم يُفرِغ حوضاً**: كل باقةٍ تبقى لها جولةٌ واحدة فأكثر.

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { QURAN, quranWordItems } = await import(new URL('curriculum.js', APP));
const { GARDENS, WORDS, lexiconTexts } = await import(new URL('lexicon.js', APP));
const { buildReadRounds } = await import(new URL('screens.js', APP));
const { buildBoard } = await import(new URL('words.js', APP));
const { bundlePool } = await import(new URL('garden.js', APP));
const { pickOptions } = await import(new URL('ladder.js', APP));
const { SENTENCES } = await import(new URL('sentences.js', APP));
const { LIBRARY } = await import(new URL('library.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const blind = WORDS.filter((w) => w.pictured === false);
const blindWords = new Set(blind.map((w) => w.word));
const quranBlind = quranWordItems().filter((i) => i.pictured === false);

console.log('— المستعصيات المعلَنة —');
ok(blind.length > 0 && quranBlind.length > 0,
  `${blind.length} كلمة معجمٍ و${quranBlind.length} كلمة قرآنية أُعلنت غيرَ مصوَّرة`);
ok(WORDS.every((w) => w.pictured === undefined || w.pictured === false),
  'ولا كلمةَ تُعلن `pictured: true` (الأصل مصوَّرة، والحقل إعلانُ الاستثناء)');
ok(blind.every((w) => String(w.emoji || '').trim()),
  'ولكلٍّ منها صورتُها الحالية باقية (بطاقتُها لا تُفرَّغ — تحفّظٌ مسجَّل لا حذف)');

// ————— ١) لا تظهر هدفاً ولا خياراً مصوَّراً —————

console.log('\n— حوض ١: باقات «اقرأ واختر» —');
let rounds = 0;
let empty = 0;
const badTarget = [];
for (const garden of GARDENS) {
  for (const bundle of garden.bundles) {
    const built = buildReadRounds(bundle.words, rng(bundle.id.length * 977 + 13));
    if (!built.length) empty++;
    rounds += built.length;
    for (const r of built) if (blindWords.has(r.target.word)) badTarget.push(r.target.word);
  }
}
ok(badTarget.length === 0,
  `لا غيرَ مصوَّرةٍ هدفاً في ${rounds} جولة (الصورة هي السؤال كلُّه هناك)`
  + (badTarget.length ? ` — ${[...new Set(badTarget)].join('، ')}` : ''));
ok(empty === 0, `ولا باقةَ فقدت جولاتِها كلَّها (${GARDENS.flatMap((g) => g.bundles).length} باقة)`);

const asOption = new Set();
for (const garden of GARDENS) {
  for (const bundle of garden.bundles) {
    for (const r of buildReadRounds(bundle.words, rng(bundle.id.length * 31 + 7))) {
      for (const o of r.options) if (blindWords.has(o.word)) asOption.add(o.word);
    }
  }
}
ok(asOption.size > 0,
  `وتبقى **خياراً مكتوباً** يقرؤه الطفل ويميّزه (${asOption.size} كلمة) — `
  + 'الخارجُ هو الحكمُ بصورتها لا الكلمةُ نفسها');

console.log('\n— حوض ٢: خيارات سلّم الجمل —');
const badMechanic = SENTENCES.filter((s) => s.mechanic === 'read' && s.target.pictured === false);
ok(badMechanic.length === 0,
  `لا جملةَ هدفُها غيرُ مصوَّر تأخذ «اقرأ ونفّذ» (${SENTENCES.length} جملة)`
  + (badMechanic.length ? ` — ${badMechanic.slice(0, 3).map((s) => s.text).join(' · ')}` : ''));

const blindTargets = SENTENCES.filter((s) => s.target.pictured === false);
ok(blindTargets.length > 0 && blindTargets.every((s) => s.mechanic !== 'read'),
  `و${blindTargets.length} جملةً هدفُها غيرُ مصوَّر بقيت في السلّم `
  + `(${[...new Set(blindTargets.map((s) => s.mechanic))].sort().join(' و')}) — لم تُحذف`);

const badPick = new Set();
for (const s of SENTENCES) {
  for (let seed = 1; seed <= 40; seed++) {
    for (const byGender of [false, true]) {
      for (const w of pickOptions(s, rng(seed * 101 + s.words.length), byGender)) {
        if (w !== s.target && w.pictured === false) badPick.add(w.word);
      }
    }
  }
}
ok(badPick.size === 0,
  `ولا غيرَ مصوَّرةٍ مشتّتاً مصوَّراً في ${SENTENCES.length * 80} سحبةَ خيارات`
  + (badPick.size ? ` — ${[...badPick].join('، ')}` : ''));

console.log('\n— حوض ٣: أسئلة فهم القصة (سؤالٌ لكل مقطع) —');
// **العددُ محسوبٌ من الملفات لا مكتوبٌ بيد** (قاعدة «لا رقمَ مكتوبٌ بيدٍ في حارس»):
// كان هنا `LIBRARY.length === 11` فانكسر بأوّل قصةٍ تُضاف. والمقيسُ الحقيقيّ أنّ
// **الإخراجَ لم يُسقِط سؤالاً**: يقارَن ما في القرص بما بلغ الشاشة، عدداً بعدد.
const { readFileSync } = await import('node:fs');
const STORIES = new URL('../app/data/stories/', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, STORIES), 'utf8'));
const onDisk = readJson('index.json').stories
  .reduce((sum, id) => sum + (readJson(`${id}.json`).questions || []).length, 0);
const onScreen = LIBRARY.reduce((sum, s) => sum + s.questions.length, 0);
const badAsk = LIBRARY.filter((s) => s.questions.some(
  (q) => q.options.some((o) => o.pictured === false)));
ok(onScreen === onDisk && onDisk > 0,
  `كل سؤالٍ على القرص بلغ الشاشة (${onScreen}/${onDisk} في ${LIBRARY.length} قصة) — `
  + 'لم يسقط سؤالٌ بالإخراج');
ok(badAsk.length === 0,
  'ولا خيارَ غيرَ مصوَّر في أيّ سؤال (خياراتُه صورٌ لا نصّ)'
  + (badAsk.length ? ` — ${badAsk.map((s) => s.id).join('، ')}` : ''));

// ————— ٢) وتبقى في التهجئة والبطاقة والجمل —————

console.log('\n— الإبقاء: التهجئة والبطاقة —');
const inBundle = blind.filter((w) => GARDENS.some((g) => g.bundles.some(
  (b) => b.words.includes(w))));
ok(inBundle.length === blind.length,
  `كل المستعصيات الـ${blind.length} باقيةٌ في باقاتها (بطاقةُ «شاهد واسمع» تعرضها بصورتها وصوتها)`);

const noBoard = [];
for (const garden of GARDENS) {
  for (const bundle of garden.bundles) {
    const pool = bundlePool(bundle);
    for (const word of bundle.words) {
      if (!blindWords.has(word.word)) continue;
      const board = buildBoard(word, pool);
      const tiles = board.map((t) => t.text);
      if (!word.tiles.every((t) => tiles.includes(t))) noBoard.push(word.word);
    }
  }
}
ok(noBoard.length === 0,
  `وكلُّها تُهجَّى وتُركَّب: لوحُ «ركّب الكلمة» يحوي مقاطعَها كلَّها`
  + (noBoard.length ? ` — ${noBoard.join('، ')}` : ''));

const texts = new Set(lexiconTexts());
const unvoiced = blind.filter((w) => !texts.has(w.say) || !w.tiles.every((t) => texts.has(t)));
ok(unvoiced.length === 0,
  'وأصواتُها ومقاطعُها كلها في نصوص البساتين (لم تخرج من قائمة الصوت)'
  + (unvoiced.length ? ` — ${unvoiced.map((w) => w.word).join('، ')}` : ''));

const quranTexts = quranWordItems().map((i) => i.read);
ok(quranBlind.every((i) => quranTexts.includes(i.read)),
  `و«${quranBlind.map((i) => i.read).join('، ')}» باقيةٌ في بطاقات المرحلة القرآنية تُنقَر وتُسمع`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «صدق الصورة» ناجحة');
process.exit(fails ? 1 : 0);
