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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
const { LIBRARY: ALL_STORIES, libraryOf, libraryStory, libraryTexts, storyTexts } =
  await import(new URL('library.js', APP));
const { starsForLibrary, starsForStory } = await import(new URL('story.js', APP));
const p = await import(new URL('progress.js', APP));

// **محورا الموضع** (حزمة قصص الأنبياء): هذا الحارسُ حارسُ **المكتبة** — قصصُ
// البساتين بعد سلالمها. وقصصُ المرحلة القرآنية محورُها سورةٌ لا بستان، وموضعُها
// قبل البساتين كلِّها، فيحرسها `test_quran.mjs` حيث تقع. ولولا الفصلُ لقيس
// كلٌّ بميزان الآخر — فاختلط رصيدُ الكلمات وموضعُ العقدة.
const LIBRARY = ALL_STORIES.filter((s) => s.garden);
const SURAH_STORIES = ALL_STORIES.filter((s) => s.surah);
// و**رفُّ المكتبة** محورٌ ثالث (حزمة المكتبة، ١٢ أغسطس ٢٠٢٦): موضعُه ذيلُ الرحلة،
// ورصيدُه الرحلةُ كلُّها — فلا يُقاس بميزان البستان ولا بميزان السورة، وله §١أ أدناه.
const SHELF = ALL_STORIES.filter((s) => s.shelf);
const shelfIds = SHELF.map((s) => `shelf:${s.id}`);

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
ok(LIBRARY.every((s) => s.title && s.emoji && s.questions.length),
  `ولكل قصة عنوانٌ ووجهٌ وسؤالُ فهمٍ لكل مقطع (${LIBRARY.reduce((n, s) => n + s.questions.length, 0)} سؤالاً)`);

const texts = LIBRARY.flatMap((s) => s.pages.map((page) => page.text));
ok(new Set(texts).size === texts.length, `ولا جملة مكرَّرة في المكتبة (${texts.length} جملة)`);

// ————— ١ب. أغلفةُ الرفّ: غلافٌ لا أيقونةٌ مكبَّرة (أمر المالك) —————
//
// المحروسُ أربعةٌ **بنيوية** — ما لا تُؤتمَن فيه عينٌ متعجّلة:
//   • لكل قصةِ رفٍّ غلافٌ (ولا غلافَ لغيرها اليوم).
//   • مشهدُه **مركَّبٌ لا مفرد**: بطلٌ ومسانِدٌ أو مسانِدان — والصفُّ المتساوي هو ما
//     يجعله أيقونةً، فالتفاوتُ في `app.css` والتركيبُ هنا.
//   • عناصرُه **من رموز القصة نفسِها** («صدق الصورة»: لا يَعِد بغير حكايته).
//   • **العنوانُ نصٌّ حقيقيّ** في DOM لا محروقٌ في صورة — يقرؤه الطفل وقارئةُ الشاشة.
console.log('\n— أغلفةُ الرفّ —');
// **وأُلحقت العشرُ القديمة بعد رضا المالك بالنمط**: الغلافُ لقصص الرفّ والبساتين
// جميعاً. وتبقى قصةُ السورة بلا غلاف — موضعُها في المرحلة القرآنية لا على رفّ.
const COVERED = ALL_STORIES.filter((s) => !s.surah);
const SHELF_COVERS = COVERED.map((s) => s.cover);
ok(COVERED.length > 0 && SHELF_COVERS.every(Boolean),
  `لكل قصةٍ (رفّاً وبستاناً) غلافٌ معلَن (${COVERED.length} غلافاً)`);
ok(ALL_STORIES.filter((s) => s.surah).every((s) => !s.cover),
  'ولا غلافَ لقصة السورة — موضعُها في المرحلة القرآنية لا على رفّ، وبوّابتُها ثلاثية');
// **بطلٌ ومزاجٌ لا غير** (تبسيطُ المالك بعد معاينة اللقطة): المسانِدُ حُذفا لأنّهما
// رموزٌ مستقلّة تُصفّ لا عناصرُ لوحةٍ تُركَّب — فيُحرَس ألّا يعودا خلسةً.
ok(SHELF_COVERS.every((c) => Object.keys(c).sort().join() === 'hero,mood'),
  'وحقولُه بطلٌ ومزاجٌ لا غير — رمزٌ واحدٌ واضحٌ خيرٌ من ثلاثةٍ تتزاحم');
const untrue = COVERED.filter((s) => {
  const own = new Set([s.emoji, ...s.pages.map((p) => p.emoji)]);
  return !own.has(s.cover.hero);
});
ok(untrue.length === 0,
  'وبطلُه من رموز قصته — الغلافُ يَعِد بحكايته لا بغيرها («صدق الصورة»)'
  + (untrue.length ? ` — ${untrue.map((s) => s.id).join('، ')}` : ''));
// والمُصيِّرُ يُثبِت الشقّ الأخير: العنوانُ عقدةُ نصٍّ في DOM لا صورة
const uiSrc = readFileSync(new URL('ui.js', APP), 'utf8');
ok(/class: 'cover-title' \}, story\.title/.test(uiSrc),
  'وعنوانُه **نصُّ القصة نفسُه** في DOM — لا محروقاً في صورة ولا منسوخاً في بيان');
ok(!/<image|\.png|\.jpg|background-image/.test(uiSrc.slice(uiSrc.indexOf('export function coverEl'),
  uiSrc.indexOf('/** هزّة قصيرة'))),
  'ولا صورةَ نقطية في تركيبه — رموزُ SVG المخزونة وحدها (كيلوباتٌ لا ميغابايت)');

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
// أشجارُ الجذور تلي كتلةَ بستانها فقد تقع في الذيل (حزمة الجذور)، و**رفُّ المكتبة
// بعدها كلِّها** (حزمة المكتبة) — والمحروسُ أن آخرَ **صلب** الرحلة قراءةٌ لا تمرين:
// تدرّجُ البستان كلماتٌ ← جملٌ ← قصة، ثم الرفُّ يتوّجها بالقراءة الطويلة.
const spine = ids.filter((id) => !id.startsWith('roots:'));
ok(spine.at(-1) === shelfIds.at(-1) && shelfIds.length > 0,
  `وآخر الرحلة قصةُ رفٍّ لا درجةُ جمل (${shelfIds.length} على الرفّ)`);
ok(ids.indexOf(shelfIds[0]) > ids.lastIndexOf(storyIds.at(-1)),
  'ورفُّ المكتبة بعد مكتبات البساتين كلِّها — رصيدُه الرحلةُ كلُّها');
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
    ...story.questions.flatMap((q) => q.words)];
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
// المعجمُ المعلَن حقلٌ واحد يشترك فيه المحوران (`index.support`)، فيُجرد استعمالُه
// عليهما معاً — وإلا حُسبت مفرداتُ قصةِ السورة «معطَّلة» وهي مستعمَلة.
for (const story of SURAH_STORIES) {
  for (const word of [...story.title.split(' '),
    ...story.pages.flatMap((page) => page.words), ...story.questions.flatMap((q) => q.words)]) {
    const st = stemOf(word);
    if (support.has(st)) usedSupport.add(support.get(st));
  }
}
// وقصصُ الرفّ تشترك في الحقل نفسِه — فيُجرد استعمالُها معهما (لا معجم ميت)
for (const story of SHELF) {
  for (const word of [...story.title.split(' '),
    ...story.pages.flatMap((page) => page.words), ...story.questions.flatMap((q) => q.words)]) {
    const st = stemOf(word);
    if (support.has(st)) usedSupport.add(support.get(st));
  }
}
ok((index.support || []).every((t) => usedSupport.has(t)),
  `ومعجم المكتبة المعلَن مستعمَل كلُّه (${(index.support || []).length} مفردة)`);
ok((index.support || []).every((t) => !(lexicon.support || []).includes(t)),
  'ولا مفردة معلَنة مرّتين (معجمُ الجمل متاحٌ للقصص كما هو)');

const heroes = ['سَامِي', 'حَسَنْ', 'زَيْدْ'];
ok(heroes.every((hero) => LIBRARY.some((s) => s.pages.some((page) =>
  page.words.some((w) => stemOf(w) === stemOf(hero))))),
  `وشخصياتُ المكتبة من مادّتنا نفسها (${heroes.join('، ')} — أبطالُ قصص المنهج)`);

// ————— ٤. سؤال الفهم: جوابٌ مقروءٌ من القصة لا مخمَّن —————

let asks = 0;
for (const story of LIBRARY) {
  const inStory = new Set(story.pages.flatMap((page) => page.words.map(stemOf)));
  const known = stemsBefore(`library:${story.id}`);
  for (const q of story.questions) {
    asks++;
    // **حدُّ المقطع**: الجوابُ ممّا قرأه إلى صفحته لا ممّا بعدها
    const upto = new Set(story.pages.slice(0, q.upto).flatMap((page) => page.words.map(stemOf)));
    if (q.options.length !== 3) bad(`[${story.id}] خيارات السؤال ≠ ٣`);
    if (!q.options.includes(q.answer)) bad(`[${story.id}] الجواب ليس بين الخيارات`);
    if (new Set(q.options.map((w) => w.emoji)).size !== 3) bad(`[${story.id}] صورتان متشابهتان`);
    if (!upto.has(stemOf(q.answer.word))) bad(`[${story.id}/${q.upto}] الجواب ليس فيما قرأه`);
    for (const option of q.options) {
      if (!WORDS.includes(option)) bad(`[${story.id}] خيارٌ ليس كلمةَ معجم`);
      if (!known.has(stemOf(option.word))) bad(`[${story.id}] خيارٌ لم يبلغه الطفل بعد`);
      if (option !== q.answer && inStory.has(stemOf(option.word))) {
        bad(`[${story.id}] مشتّتٌ «${option.word}» في نصّ القصة (السؤال يحتمل جوابين)`);
      }
    }
    const body = q.words.filter((w) => !['مَنْ', 'مَاذَا', 'أَيْنَ'].includes(w));
    if (body.some((w) => !upto.has(stemOf(w)))) {
      bad(`[${story.id}/${q.upto}] في السؤال كلمةٌ خارج ما قرأه`);
    }
  }
}
ok(true, `وسؤالُ كل مقطع يُجاب ممّا قرأه إليه (${asks} سؤالاً بثلاث صور)`);

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

// **بوّابةُ الصوت حالةٌ يعرفها الحارس، لا ثغرةٌ يتغاضى عنها** (١٢ أغسطس ٢٠٢٦):
// عقدُ الحزمة ٩ أنّ **مادّةَ القصة لا تدخل قائمةَ الصوت قبل حكم المدير بعينه**.
// فبين التأليف والحكم تمرّ القصةُ بحالٍ مشروعة: مبنيّةٌ ولا صوتَ لها. وكان هذا
// الحارسُ يُحمِرّ فيها (بينما `check_lexicon` يكتفي بتنبيه) — فيدفع الجلسةَ إمّا إلى
// إطعام القائمة قبل الحكم أو إلى الالتزام على شجرةٍ حمراء، وكلاهما نقضٌ للعقد.
//
// فالتمييزُ **مشتقٌّ لا معلَن**: قصةٌ **لا نصَّ لها مصروفٌ ولا منتظِر** هي المنتظرةُ
// للبوابة (تُذكَر بأسمائها ولا تُخفى)، وقصةٌ **بعضُها مصروفٌ وبعضُه ضائع** انحدارٌ
// حقيقيّ يُحمِرّ. فالحالةُ الوسطى وحدَها مأذونة، وتُغلَق من نفسها يوم تُطعَم القائمة.
// **ولكلِّ خيارٍ صوتٌ منطوق** (إصلاح ١٢ أغسطس ٢٠٢٦): قاعدةُ الخطأ أن «يُسمعه ما
// اختاره ليقارنه بما قرأ» — فخيارٌ بلا `say` يُنقَر فلا يُسمِع شيئاً، وهو سقوطٌ
// **صامت** لا يُحمِرّ شيئاً (كان في قصة الفيل منذ حزمة الأنبياء: خياراها من كلمات
// المنهج، و`curriculumWord` كانت تعود بلا صوت).
const mute = ALL_STORIES.flatMap((st) => st.questions.flatMap((q) =>
  q.options.filter((o) => !o.say).map((o) => `${st.id}/${q.upto}: ${o.word}`)));
ok(mute.length === 0,
  'ولكلِّ خيارٍ في كل سؤالٍ صوتُه المنطوق — والخطأُ يُسمعه ما اختاره'
  + (mute.length ? ` — بلا صوت: ${mute.slice(0, 5).join('، ')}` : ''));

const storyOf = new Map();
for (const st of ALL_STORIES) {
  for (const t of [...storyTexts(st), ...st.questions.flatMap((q) => q.options.map((w) => w.say))]) {
    if (!storyOf.has(t)) storyOf.set(t, st.id);
  }
}
const spoken = new Set(storyOf.keys());
// و**العلامةُ عنوانُ القصة**: نصٌّ يُؤلَّف لها وحدها ويدخل القائمة أوّلَ ما تدخل،
// فإن كان بلا صوتٍ فالقصةُ كلُّها لم تُطعَم بعد. وإن كان مصروفاً فقد عبرت البوابة —
// وكلُّ نصٍّ ضائعٍ بعدها انحدارٌ يُحمِرّ.
const atGate = new Set(ALL_STORIES.filter((st) => !voiced(st.title)).map((st) => st.id));
const stray = [...spoken].filter((t) => !voiced(t) && !atGate.has(storyOf.get(t)));
ok(stray.length === 0,
  `كل ما تنطقه شاشات المكتبة له ملف أو مكان في القائمة (${spoken.size} نصاً: `
  + `${[...spoken].filter((t) => have.has(t)).length} جاهز، `
  + `${[...spoken].filter((t) => pending.has(t) && !have.has(t)).length} منتظِر)`
  + `${stray.length ? ' — بلا حساب: ' + stray.slice(0, 6).join('، ') : ''}`);
if (atGate.size) {
  const waiting = [...spoken].filter((t) => atGate.has(storyOf.get(t))).length;
  console.log(`  ⏸ ${atGate.size} قصةً عند بوابة الاعتماد بلا صوت (${waiting} نصاً): `
    + `${[...atGate].join('، ')} — لا قائمةَ صوت قبل حكم المدير (بند الحزمة ٩/٤)`);
}
ok([...spoken].every((t) => voiced(t) || atGate.has(storyOf.get(t))),
  'ومادّةُ القصص المعتمَدة دخلت القائمة كلُّها (بند الحزمة ٩/٤: لا صوت قبل حكم العين)');
ok(LIBRARY.every((s) => storyTexts(s).length === new Set(storyTexts(s)).size),
  'ولا تكرار في قائمة نصوص أي قصة');

// ————— ٧. المولّد نفسُه في السَّوقة — «فحصٌ لا يُشغَّل ليس حارساً» —————
//
// **عيبٌ بنيويّ كشفته حزمةُ الأنبياء** (حكم المدير، ١١ أغسطس ٢٠٢٦): `make_stories.py`
// له `--self-test` و`--check` منذ الحزمة ٩، ولم يكونا في سَوقةِ أحد. فلمّا وسّعت
// حزمةُ ب٢ معجمَ البساتين بكلمةٍ كانت معلَنةً في معجم المكتبة (`تَقْفِزْ`) بقي الفحصُ
// أحمرَ **صامتاً** حتى صادفتْه هذه الحزمة. فمن اليوم: **المولّد يُشغَّل هنا**، في
// حارسٍ تشمله السَّوقة القياسية (`tools/test_*.mjs`) — فلا يعود فحصٌ يملكه المشروع
// ولا يراه أحد.

// **وثمرةُ العهد نفسِه، ثانيةً** (١٢ أغسطس ٢٠٢٦): `check_lexicon.py --self-test` —
// وهو **فحصُ الفاحص** الذي يحرس عقدَ القصص كلَّه — لم يكن في سَوقةِ أحدٍ كذلك، فبقي
// **أحمرَ بتسع عشرة شكوى** على HEAD (ثبّتُّه بشجرة عملٍ نظيفة قبل أن أنسبه لنفسي).
// وعلّتُه أنّ حدودَ حجم المنظومة (٨ بساتين، ٢٥٠ كلمة، باقتان) أُضيفت إليه بعد كتابته
// فصارت مادّتُه المُصطنَعة الصغيرة تخالفها — لا لأنّ قاعدةً انكسرت. فعُزلت الحدودُ
// بمفتاح `corpus` المعلَن، ودخل الفحصُ السَّوقة: **فحصُ الفاحص أولى ما لا يُترك أعمى.**
console.log('\n— المولّد والفاحص في السَّوقة (فحصٌ لا يُشغَّل ليس حارساً) —');
for (const [tool, flag, what] of [
  ['make_stories.py', '--self-test', 'المولّد ومادّتُه سليمان (المعجم المعلَن، وحدود المستوى، والسؤال)'],
  ['make_stories.py', '--check', 'وملفاتُ app/data/stories هي عينُ خرج المولّد (لا تُحرَّر قصةٌ بيد)'],
  ['check_lexicon.py', '--self-test', 'والفاحصُ نفسُه يمسك المخالفات كلَّها (فحصُ الفاحص)'],
]) {
  const run = spawnSync('python3',
    [fileURLToPath(new URL(tool, import.meta.url)), flag], { encoding: 'utf8' });
  ok(run.status === 0, `[${tool} ${flag}] ${what}`
    + (run.status === 0 ? '' : `\n${(run.stdout || '').split('\n').filter((l) => l.includes('✗')).join('\n')}`));
}

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات مصنع القصص ناجحة');
process.exit(fails ? 1 : 0);
