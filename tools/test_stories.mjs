// اختبار «مصنع القصص» (الحزمة ٩) بلا متصفّح:
//   node tools/test_stories.mjs
//
// المحروس هنا ستة:
//   ١) بنية المكتبة: عشرُ قصص على ثلاثة مستويات، لكلٍّ صفحاتُها وسؤالُها، وعقدةٌ في الرحلة.
//   ٢) موضعها: قصصُ كل بستان تلي **سلّم جمله** مباشرةً، وقفلُها يتبع قاعدة الرحلة الواحدة.
//   ٣) **لا كلمة خارج المدروس**: كل كلمة في كل قصة إمّا كلمة معجمٍ من باقةٍ **سبقتها في
//      الرحلة فعلاً**، أو كلمة منهجٍ درسها، أو من معجمٍ معلَن (جملٍ أو مكتبة) — يُقاس
//      على ترتيب `allNodes()` نفسه لا على البستان المعلَن.
//   ٤) سؤال الفهم: ثلاث صور متمايزة، جوابُه في نصّ القصة ومشتّتاه خارجه، وكلُّها كلمات
//      معجمٍ بلغها الطفل — فالجواب **مقروءٌ من القصة** لا مخمَّن.
//   ٥) النجوم: متابعةٌ + نجمةُ فهم، ولا تنزل عن نجمةٍ أبداً (لا تُقفَل عقدةٌ على طفل).
//   ٦) الصوت: ما تنطقه المكتبة معدودٌ كلُّه — مُصرَّفٌ أو منتظِر في القائمة، ولا مولّد
//      يُشغَّل. (دخلت مادّتُها القائمة بعد اعتماد المدير — بند الحزمة ٩/٤.)

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { GROUPS, SKILLS, QURAN, quranWordItems, bareLetters, skillExamples } =
  await import(new URL('curriculum.js', APP));
const { GARDENS, WORDS } = await import(new URL('lexicon.js', APP));
const { stemOf } = await import(new URL('sentences.js', APP));
const { LIBRARY, libraryOf, libraryStory, libraryTexts, storyTexts } =
  await import(new URL('library.js', APP));
const { starsForLibrary, starsForStory } = await import(new URL('story.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const bad = (msg) => { fails++; console.log('  ✗', msg); };

const LEVELS = { 1: { pages: [3, 3], words: [2, 3] },
                 2: { pages: [5, 6], words: [2, 4] },
                 3: { pages: [8, 8], words: [3, 5] } };

// ————— ١. بنية المكتبة —————

const pages = LIBRARY.reduce((s, x) => s + x.pages.length, 0);
ok(LIBRARY.length === 10 && pages === 55,
  `المكتبة: ${LIBRARY.length} قصص في ${pages} صفحة `
  + `(${[1, 2, 3].map((lv) => `مستوى ${lv}: ${LIBRARY.filter((s) => s.level === lv).length}`).join('، ')})`);
ok(new Set(LIBRARY.map((s) => s.id)).size === LIBRARY.length
  && LIBRARY.every((s) => libraryStory(s.id) === s),
  'ولكل قصة معرّف فريد يُعثر عليه');
ok(LIBRARY.every((s) => LEVELS[s.level]
  && s.pages.length >= LEVELS[s.level].pages[0] && s.pages.length <= LEVELS[s.level].pages[1]),
  'وعددُ صفحات كل قصة في حدود مستواها (٣ · ٥–٦ · ٨)');
ok(LIBRARY.every((s) => s.pages.every((page) => page.words.length >= LEVELS[s.level].words[0]
  && page.words.length <= LEVELS[s.level].words[1])),
  'وطولُ كل جملة كذلك (٢–٣ · ٢–٤ · ٣–٥)');
ok(LIBRARY.map((s) => s.level).every((lv, i, a) => !i || lv >= a[i - 1]),
  `والمستوى يرتفع مع الرحلة ولا ينزل (${LIBRARY.map((s) => s.level).join('')})`);
ok(LIBRARY.every((s) => s.pages.every((page) => page.emoji && page.text
  && page.words.join(' ') === page.text)),
  'ولكل صفحة مشهدُها ونصُّها، ونصُّها المنطوق هو كلماتها بعينها (لا مصدر ثانٍ)');
ok(LIBRARY.every((s) => s.title && s.emoji && s.question),
  'ولكل قصة عنوانٌ ووجهٌ وسؤالُ فهم');

const texts = LIBRARY.flatMap((s) => s.pages.map((page) => page.text));
ok(new Set(texts).size === texts.length, `ولا جملة مكرَّرة في المكتبة (${texts.length} جملة)`);

// ————— ٢. موضع القصص من الرحلة وقفلها —————

const nodes = p.allNodes();
const ids = nodes.map((n) => n.id);
const storyIds = LIBRARY.map((s) => `library:${s.id}`);
ok(storyIds.every((id) => ids.includes(id)), `عقد المكتبة في الرحلة (${storyIds.length} عقدة)`);
ok(LIBRARY.every((s) => GARDENS.some((g) => g.id === s.garden))
  && GARDENS.every((g) => libraryOf(g.id).length >= 1),
  'ولكل بستان قصةٌ في مكتبته');

const misplaced = GARDENS.filter((garden) => {
  const mine = libraryOf(garden.id);
  if (!mine.length) return false;
  const lastRung = ids.findLastIndex((id) => id.startsWith(`ladder:${garden.id}:`));
  return ids.indexOf(`library:${mine[0].id}`) !== lastRung + 1;
});
ok(misplaced.length === 0,
  `وقصصُ كل بستان تلي درجاتِ سلّمه مباشرةً${misplaced.length ? ' — ' + misplaced.map((g) => g.id).join('، ') : ''}`);
// أشجارُ الجذور تلي كتلةَ بستانها فقد تقع في الذيل (حزمة الجذور) — والمحروسُ أن
// آخرَ **صلب** الرحلة قصةُ مكتبة: تدرّجُ البستان كلماتٌ ← جملٌ ← قصة.
ok(ids.filter((id) => !id.startsWith('roots:')).at(-1) === storyIds.at(-1),
  'وآخر الرحلة قصةُ مكتبةٍ لا درجةُ جمل');
ok(p.maxTotalStars() === ids.length * p.MAX_STARS,
  `والرحلة صارت ${ids.length} عقدة و${p.maxTotalStars()} نجمة`);

p.reset();
const first = LIBRARY[0];
ok(!p.isNodeUnlockedById(`library:${first.id}`), 'المكتبة مقفلة في بداية الرحلة');
for (const n of nodes) {
  if (n.id === `library:${first.id}`) break;
  p.setStars(n.id, 3);
}
ok(p.isNodeUnlockedById(`library:${first.id}`)
  && p.nextNode().id === `library:${first.id}`,
  'وأول قصة تُفتح بإتمام سلّم جمل بستانها كله (بند الحزمة)');
ok(!p.isNodeUnlockedById(`library:${LIBRARY[1].id}`), 'والقصة التالية تنتظر التي قبلها');

// ————— ٣. لا كلمة خارج المدروس — بمقياس ترتيب الرحلة نفسه —————

const lexicon = JSON.parse(readFileSync(new URL('../app/data/lexicon.json', import.meta.url), 'utf8'));
const index = JSON.parse(readFileSync(new URL('../app/data/stories/index.json', import.meta.url), 'utf8'));
const support = new Map([...(lexicon.support || []), ...(index.support || [])]
  .map((t) => [stemOf(t), t]));
const curriculum = new Set([
  ...GROUPS.flatMap((g) => g.words).map((w) => bareLetters(w.tiles.join(''))),
  ...SKILLS.flatMap(skillExamples).map((w) => bareLetters(w.say)),
  ...quranWordItems().map((w) => bareLetters(w.read)),
  ...QURAN.letters.signs.flatMap((s) => s.words.map((w) => bareLetters(w.read))),
]);

/** كلمات المعجم التي أتمّ الطفل باقاتها قبل هذه العقدة — حصيلتُه الحقيقية عندها. */
function stemsBefore(nodeId) {
  const out = new Set();
  for (const node of nodes) {
    if (node.id === nodeId) return out;
    if (node.type === 'garden') for (const w of node.bundle.words) out.add(stemOf(w.word));
  }
  return out;
}

let checked = 0;
const usedSupport = new Set();
for (const story of LIBRARY) {
  const known = stemsBefore(`library:${story.id}`);
  const words = [...story.title.split(' '),
    ...story.pages.flatMap((page) => page.words),
    ...story.question.words];
  for (const word of words) {
    checked++;
    const stem = stemOf(word);
    if (known.has(stem)) continue;
    if (curriculum.has(bareLetters(stem)) || curriculum.has(bareLetters(word))) continue;
    if (support.has(stem)) { usedSupport.add(support.get(stem)); continue; }
    bad(`[${story.id}] «${word}» خارج حصيلة الطفل عند هذه القصة`);
  }
}
ok(true, `لا كلمة خارج المدروس في المكتبة كلها (${checked} كلمة مفحوصة بترتيب الرحلة)`);
ok((index.support || []).every((t) => usedSupport.has(t)),
  `ومعجم المكتبة المعلَن مستعمَل كلُّه (${(index.support || []).length} مفردة)`);
ok((index.support || []).every((t) => !(lexicon.support || []).includes(t)),
  'ولا مفردة معلَنة مرّتين (معجمُ الجمل متاحٌ للقصص كما هو)');

const heroes = ['سَامِي', 'حَسَنْ', 'زَيْدْ'];
ok(heroes.every((hero) => LIBRARY.some((s) => s.pages.some((page) =>
  page.words.some((w) => stemOf(w) === stemOf(hero))))),
  `وشخصياتُ المكتبة من مادّتنا نفسها (${heroes.join('، ')} — أبطالُ قصص المنهج)`);

// ————— ٤. سؤال الفهم: جوابٌ مقروءٌ من القصة لا مخمَّن —————

for (const story of LIBRARY) {
  const q = story.question;
  const inStory = new Set(story.pages.flatMap((page) => page.words.map(stemOf)));
  const known = stemsBefore(`library:${story.id}`);
  if (q.options.length !== 3) bad(`[${story.id}] خيارات السؤال ≠ ٣`);
  if (!q.options.includes(q.answer)) bad(`[${story.id}] الجواب ليس بين الخيارات`);
  if (new Set(q.options.map((w) => w.emoji)).size !== 3) bad(`[${story.id}] صورتان متشابهتان`);
  if (!inStory.has(stemOf(q.answer.word))) bad(`[${story.id}] الجواب ليس في نصّ القصة`);
  for (const option of q.options) {
    if (!WORDS.includes(option)) bad(`[${story.id}] خيارٌ ليس كلمةَ معجم`);
    if (!known.has(stemOf(option.word))) bad(`[${story.id}] خيارٌ لم يبلغه الطفل بعد`);
    if (option !== q.answer && inStory.has(stemOf(option.word))) {
      bad(`[${story.id}] مشتّتٌ «${option.word}» في نصّ القصة (السؤال يحتمل جوابين)`);
    }
  }
  const body = q.words.filter((w) => !['مَنْ', 'مَاذَا', 'أَيْنَ'].includes(w));
  if (body.some((w) => !inStory.has(stemOf(w)))) {
    bad(`[${story.id}] في السؤال كلمةٌ خارج نصّ القصة`);
  }
}
ok(true, `وسؤالُ كل قصة يُجاب من نصّها وحده (${LIBRARY.length} سؤالاً بثلاث صور)`);

// ————— ٥. النجوم: متابعةٌ + نجمةُ فهم —————

ok(starsForLibrary(8, 8, true) === 3 && starsForLibrary(8, 8, false) === 2
  && starsForLibrary(4, 8, true) === 2 && starsForLibrary(4, 8, false) === 1
  && starsForLibrary(0, 8, false) === 1 && starsForLibrary(0, 8, true) === 1,
  'نجوم القصة: متابعةٌ (نجمتان لكل الجمل) + نجمةُ سؤال الفهم');
ok(starsForLibrary(0, 3, false) >= 1,
  'ولا تنزل عن نجمةٍ أبداً — فلا تُقفَل الرحلةُ على طفلٍ قرأ بعينه ولم ينقر');
ok(starsForStory(5, 5) === 3, 'ونجومُ قصص المنهج على حالها (٣ لمن سمع الجمل كلها)');

// ————— ٦. الصوت: معدودٌ كلُّه، ولا شيء خارج الحسبان —————

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
const voiced = (t) => have.has(t) || pending.has(t);

const spoken = new Set([
  ...libraryTexts(),
  ...LIBRARY.flatMap((s) => s.question.options.map((w) => w.say)),
]);
const stray = [...spoken].filter((t) => !voiced(t));
ok(stray.length === 0,
  `كل ما تنطقه شاشات المكتبة له ملف أو مكان في القائمة (${spoken.size} نصاً: `
  + `${[...spoken].filter((t) => have.has(t)).length} جاهز، `
  + `${[...spoken].filter((t) => pending.has(t) && !have.has(t)).length} منتظِر)`
  + `${stray.length ? ' — بلا حساب: ' + stray.slice(0, 6).join('، ') : ''}`);
ok(libraryTexts().every((t) => voiced(t)),
  'ومادّةُ القصص دخلت القائمة بعد اعتماد المدير (بند الحزمة ٩/٤: لا صوت قبل حكم العين)');
ok(LIBRARY.every((s) => storyTexts(s).length === new Set(storyTexts(s)).size),
  'ولا تكرار في قائمة نصوص أي قصة');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات مصنع القصص ناجحة');
process.exit(fails ? 1 : 0);
