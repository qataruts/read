// اختبار بوابتَي الإتقان (الحزمة ١٤) بلا متصفّح:
//   node tools/test_gate.mjs
// المحروس هنا خمسة: موضع البوابتين من الرحلة وقفلُهما، وبناءُ تمارينهما من **أضعف**
// مهارات ليتنر (لا من المستحقّ وحده)، وعتبةُ العبور بالمحاولة، **والترحيل الرحيم**
// (مَن عبر المفصل قبل وجود البوابة لا يُحبَس)، و**صفرُ إضافةٍ صوتية** (تمارين قائمة).

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { GATES, gateById, gateBefore } = await import(new URL('curriculum.js', APP));
const p = await import(new URL('progress.js', APP));
const { buildSession, itemTexts, starsForReview } = await import(new URL('review.js', APP));
const { GATE_SIZE, PASS_RATE, passed } = await import(new URL('gate.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const nodes = p.allNodes();
const ids = nodes.map((n) => n.id);
const upTo = (id) => {                       // إنجاز كل ما قبل عقدة بعينها
  p.reset();
  for (const n of nodes) {
    if (n.id === id) break;
    p.setStars(n.id, 3);
  }
};

// ————— ١. البيانات والموضع من الرحلة —————

ok(GATES.length === 2 && GATES.map((g) => g.before).join('،') === 'quran،gardens',
  `بوابتان: قبل المرحلة القرآنية وقبل البساتين (${GATES.map((g) => g.title).join(' · ')})`);
ok(GATES.every((g) => g.id && g.title && g.face && g.hint),
  'لكل بوابة معرّفها وعنوانها ووجهها وسطرُ توجيهها');
ok(gateById('quran') && !gateById('لا-وجود-لها') && gateBefore('gardens')?.id === 'gardens',
  'البحث عنها بمعرّفها وبموضعها، والمجهول يعود بلا شيء');

const gateNodes = nodes.filter((n) => n.type === 'gate');
ok(gateNodes.length === 2 && gateNodes.every((n) => n.gate && n.id === `gate:${n.gate.id}`),
  'ولكل واحدة عقدة في الرحلة بمعرّف «gate:…»');
ok(ids[ids.indexOf('quran:letters') - 1] === 'gate:quran',
  'بوابة المصحف تقف قبل أول عقدة قرآنية مباشرةً');
const firstGarden = ids.find((id) => id.startsWith('garden:'));
ok(ids[ids.indexOf(firstGarden) - 1] === 'gate:gardens',
  'وبوابة الحديقة قبل أول باقة مباشرةً');
ok(ids.indexOf('gate:quran') < ids.indexOf('gate:gardens'),
  'وترتيبهما على الرحلة: المصحف ثم الحديقة');

// ————— ٢. القفل: البوابة تُفتح بما قبلها، وما بعدها ينتظر عبورها —————

upTo('gate:quran');
ok(p.isNodeUnlockedById('gate:quran'), 'البوابة تُفتح بإتمام كل ما قبلها');
ok(!p.isNodeUnlockedById('quran:letters'), 'والمرحلة القرآنية مقفلة قبل عبورها');
ok(p.nextNode().id === 'gate:quran', '«تابع من هنا» يشير إلى البوابة');

p.setStars('gate:quran', 2);
ok(p.isNodeUnlockedById('quran:letters'), 'وبعبورها تُفتح المرحلة القرآنية');

upTo('gate:gardens');
ok(p.isNodeUnlockedById('gate:gardens') && !p.isNodeUnlockedById(firstGarden),
  'وبوابة الحديقة كذلك: مفتوحة، والبساتين خلفها');

// ————— ٣. عتبة العبور: **بالتمرين لا باللمسة** (الحكم ب٧)، ولا رسوب —————

ok(PASS_RATE === 0.8 && GATE_SIZE === 10, 'عشرة تمارين وعتبة ٨٠٪ (نصّ التكليف)');
ok(passed(8, 2) && passed(10, 0), 'ثمانٍ من عشر ⇒ عبور');
ok(!passed(7, 3) && !passed(0, 5), 'وسبعٌ من عشر ⇒ لا عبور');
ok(!passed(0, 0), 'وجلسةٌ بلا محاولة لا تفتح البوابة');
ok(passed(16, 4) && !passed(15, 5), 'والحكم على النسبة لا على العدد');

// **وحدةُ الحكم تمرينٌ لا لمسة** (الحكم ب٧، جلسة وز٢): كان محرّك الجلسة يعطي البوابةَ
// عدَّ اللمسات، فلوحُ تركيبٍ من أربعة مقاطع يزن أربعةَ أضعاف تمييزٍ في نسبة الـ٨٠٪.
// والمحروسُ أنّ ما يصل إلى `passed` هو `rightItems/missedItems` — يُقرأ من الشيفرة
// نصّاً، فمن أعادها إلى اللمسات أحمرَّ هذا السطر يومَ يفعل.
const gateSrc = readFileSync(new URL('../app/js/gate.js', import.meta.url), 'utf8');
const reviewSrc = readFileSync(new URL('../app/js/review.js', import.meta.url), 'utf8');
ok(/verdict:\s*\(\{\s*rightItems,\s*missedItems/.test(gateSrc)
  && /passed\(rightItems, missedItems\)/.test(gateSrc)
  && /markReview\(tries, rightItems\)/.test(gateSrc),
  'والبوابةُ تحكم بـ`rightItems/missedItems` — تمارينَ لا لمسات، ولوحةُ الوالد تتبعها');
ok(/state\.missed = true/.test(reviewSrc) && /function tally\(\)/.test(reviewSrc),
  'ومحرّكُ الجلسة يطوي كلَّ تمرينٍ مرّةً واحدة مهما بلغت لمساتُه');
ok(starsForReview(0, 10) === 3 && starsForReview(2, 10) === 2,
  'ونجومها بعتبة المراجعة نفسها (٣ بلا خطأ، ٢ ما دام الخطأ ≤ عدد التمارين)');

// ————— ٤. مادّة البوابة: الأضعف أولاً، وعشرةٌ، وتُبنى من جديد كل محاولة —————

upTo('gate:quran');                          // طفلٌ أتمّ الرحلة حتى البوابة
const letters = p.studiedLetters();
const words = p.studiedWords(letters);
ok(letters.length === 28, `حصيلته عند البوابة كل الحروف (${letters.length})`);

const today = p.dayNumber();
// **كلُّ محاولةٍ هنا جولةٌ مستقلّة**: `endRound()` بينها — فبعد الحكم ب٨ لا تُسجَّل
// إلا أولى محاولات الجولة، والمزروعُ هنا محاولاتُ جولاتٍ متفرّقة لا نقراتُ جولةٍ واحدة.
const seedSkill = (letter, haraka, kind, box, wrong) => {
  for (let i = 0; i < wrong; i++) { p.endRound(); p.recordAttempt(letter, haraka, kind, false, today); }
  for (let i = 0; i < box; i++) { p.endRound(); p.recordAttempt(letter, haraka, kind, true, today); }
};
// الضعيف (صندوق ٠ بأخطاء) موعده اليوم، والقويّ (صندوق ٥) موعده بعد ١٦ يوماً:
// `dueSkills` لا ترى القويّ، و`weakestSkills` ترى الكلّ مرتّباً بالضعف.
seedSkill('ك', 'fatha', p.KINDS.QUIZ, 0, 3);
seedSkill('ق', 'kasra', p.KINDS.QUIZ, 0, 2);
seedSkill('ب', 'fatha', p.KINDS.HARAKA, 5, 0);

const weak = p.weakestSkills();
ok(weak[0].letter === 'ك' && weak[1].letter === 'ق' && weak.at(-1).letter === 'ب',
  `أضعف المهارات أولاً وأقواها آخراً (${weak.map((s) => s.letter).join('،')})`);
ok(p.dueSkills().every((s) => s.letter !== 'ب') && weak.some((s) => s.letter === 'ب'),
  'والبوابة ترى ما لم يحن موعده — فلا تمرّ يومَ لا مستحقَّ فيه');

const build = (seed) => buildSession({
  letters, words, sentences: [], due: p.weakestSkills(), size: GATE_SIZE, rnd: rng(seed),
});
const session = build(1);
ok(session.length === GATE_SIZE, `الجلسة عشرة تمارين (${session.length})`);
ok(session[0].letter === 'ك' && session[1].letter === 'ق',
  'وتبدأ بأضعف مهارتين (ك ثم ق)');
ok(new Set(session.map((i) => i.id)).size === session.length, 'ولا تمرين مكرَّر فيها');

const seen = new Set();
let studiedOnly = true;
for (let seed = 1; seed <= 40; seed++) {
  const items = build(seed);
  if (items.length !== GATE_SIZE) fails += 1;
  seen.add(items.map((i) => i.id).join('|'));
  for (const item of items) {
    const texts = itemTexts(item);
    if (item.letter && !letters.includes(item.letter)) studiedOnly = false;
    if (item.word && !words.some((w) => w.say === item.word.say)) studiedOnly = false;
    if (!texts.length) studiedOnly = false;
  }
}
ok(studiedOnly, 'ولا تمرين خارج حصيلة الطفل في ٤٠ بذرة');
ok(seen.size > 1, `والتوليد يتجدّد كل محاولة (${seen.size} تشكيلة في ٤٠ بذرة — لا نمط يُستظهَر)`);

// ————— ٥. الصوت: صفرُ إضافة (تمارين قائمة كلها) —————

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
const spoken = [...new Set([...Array(40).keys()].flatMap((i) => build(i + 1).flatMap(itemTexts)))];
const orphan = spoken.filter((t) => !have.has(t) && !pending.has(t));
ok(orphan.length === 0,
  `كل ما تنطقه البوابة له ملف أو مكان في القائمة (${spoken.length} نصاً)${orphan.length ? ' — بلا شيء: ' + orphan.join('،') : ''}`);

// ————— ٦. الترحيل الرحيم: مَن عبر المفصل قبل وجود البوابة —————
// الترحيل يجري عند تحميل الحالة، فيُحاكى بكتابة حالةٍ خامٍ ثم إعادة استيراد الوحدة.

async function loadWith(stars) {
  store.set('muallim.progress.v1', JSON.stringify({
    v: 2, stars, skills: {}, days: {}, reviews: {}, records: [], mic: false,
    seconds: 0, startedAt: Date.now(), updatedAt: Date.now(),
  }));
  return import(`${new URL('progress.js', APP).href}?t=${Math.random()}`);
}

// (أ) طفلٌ في المصحف قبل وجود البوابة: نجومٌ بعدها ولا نجمة لها
const crossed = await loadWith({ 'quran:letters': 3, 'quran:words': 2 });
ok(crossed.getStars('gate:quran') === crossed.MAX_STARS,
  'مَن كانت له نجومٌ بعد البوابة تُعدّ بوابته مجتازة (لا يُحبَس رجعياً)');
ok(crossed.getStars('gate:gardens') === 0,
  'والبوابة التي لم يبلغها بعدُ تبقى على حالها');

// (ب) طفلٌ لم يبلغ البوابة: لا شيء يُرحَّل
const before = await loadWith({ 'g1:ا': 3, 'g1:ب': 2 });
ok(before.getStars('gate:quran') === 0, 'ومَن لم يبلغها لا تُفتح له');

// (ج) الدرس المشقوق: نجوم «skill:madd» تصير لشطريه
const split = await loadWith({ 'g1:ا': 3, 'skill:madd': 2 });
ok(split.getStars('skill:madd-alif') === 2 && split.getStars('skill:madd-waw-ya') === 2,
  'ونجوم درس المدّ القديم تنتقل إلى شطريه (الشقّ شأننا لا تقصيرُه)');
ok(!JSON.parse(store.get('muallim.progress.v1')).stars['skill:madd'],
  'ولا يبقى للعقدة المحذوفة أثرٌ في المخزون');
ok(split.getStars('g1:ا') === 3, 'وسائر نجومه كما هي');

// (ج٢) الجسر القرآني (الحزمة ١٢): «quran:words» شُقّت ثلاث درجات، ومحطاتُ كلمات
//      السور استُحدثت أمام سورٍ قرأها الطفل — فلا يُعاد قفلُ ما بعدها عليه.
const bridged = await loadWith({ 'quran:letters': 3, 'quran:words': 2, 'quran:s1': 3 });
ok([1, 2, 3].every((n) => bridged.getStars(`quran:words${n}`) === 2)
  && !JSON.parse(store.get('muallim.progress.v1')).stars['quran:words'],
  'ونجوم «كلمات من القرآن» القديمة تصير لدرجاتها الثلاث');
ok(bridged.getStars('quran:sw-s1') === 1,
  'ومحطةُ كلماتٍ استُحدثت خلف موضعه تُمنح نجمةَ إتمامٍ واحدة — تفكّ الحبس ولا تدّعي إتقاناً');
ok(bridged.getStars('quran:sw-s112') === 0,
  'وما أمام موضعه يبقى بلا نجمة — يدعوه إلى لعبه ولا يُمنَح عنه');
// الغايةُ من الترحيل كلِّه: ألّا تبقى خلف آخر ما أنجزه عقدةٌ صفرٌ تسدّ جبهة الفتح
const upToLast = bridged.allNodes().slice(0,
  bridged.allNodes().findLastIndex((n) => bridged.getStars(n.id) > 0));
ok(upToLast.filter((n) => bridged.getStars(n.id) === 0)
  .every((n) => !['gate', 'contrast', 'quran'].includes(n.type)),
  'ولا تبقى خلف موضعه محطةٌ مستحدثة صفرٌ تسدّ عليه الطريق');

// (د) طفلٌ جديد: لا ترحيل ولا كتابة
store.clear();
const fresh = await import(`${new URL('progress.js', APP).href}?t=${Math.random()}`);
ok(fresh.totalStars() === 0 && store.size === 0,
  'وطفلٌ جديد لا يُكتب له شيء (الترحيل لا يخترع تقدّماً)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات بوابتَي الإتقان ناجحة');
process.exit(fails ? 1 : 0);
