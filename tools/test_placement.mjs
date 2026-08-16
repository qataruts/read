// حارسُ «بوابة اللحاق» — امتحانُ تحديد المستوى الاختياريّ (الجلسة ل١):
//   node tools/test_placement.mjs
//
// **العلّة التي يحرسها**: امتحانٌ **يفتح عقداً بلا أن يلعبها الطفل**. فخطؤه ليس
// شاشةً تُخفق بل رحلةً تُختصَر بغير حقّ — ولا يُرى ذلك في شاشةٍ ولا يشتكي منه أحد.
// فالمحروسُ ستّةٌ كلُّها قيودُ صدق:
//   ١) **السلّمُ مشتقٌّ لا مكتوب** — مجموعاتُ `journey()` بترتيبها، ومادّتُها مفاتيحُ
//      مهارات عقدها. ونوعُ عقدةٍ جديد في مجموعةٍ يُسقِط هذا الحارسَ يومَ يُضاف.
//   ٢) **عتبةُ الثمانين عتبةُ البوابة نفسُها** — لا رقمَ ثانٍ يفترق عنها غداً.
//   ٣) **الوقوفُ عند الشرخ** — أوّلُ إخفاقٍ يُنهي، وما بعده لا يُفتح.
//   ٤) **حدُّ البوّابة والقرآنية** — البواباتُ لا تُقفز، والمصحفُ يُتلى لا يُمتحَن.
//   ٥) **الكتابةُ في ليتنر** — كلُّ محاولةٍ قياسٌ حقيقيّ بلا وسمٍ خاصّ.
//   ٦) **لا قفلَ رجوعاً** — ما فُتح لا يُغلق، والإعادةُ تستأنف من آخر حدّ.
//
// **ومُجرَّبٌ سالباً** (١٦ أغسطس ٢٠٢٦): جُرِّبت أربعُ نقائض على شيفرةٍ مُعدَّلة عمداً
// ثم رُدَّت — كلُّها أحمرَّت هنا **بالاسم**، ورجعت خضراء بالردّ:
//   • حذفُ `if (section.kind === 'quran') break;`      ⇒ §٥ «القرآنيةُ تقطع السلّم»
//   • جعلُ البوّابة غيرِ المجتازة تُتخطّى (`continue`)  ⇒ §٥ «البواباتُ لا تُقفز»
//   • إسقاطُ مُرشِّح `NEVER_OPENED` من `openableNodes`  ⇒ §٥ «الفتحُ يستثني البوّابة»
//   • ردُّ نجمةِ `recordPlacement` بلا شرط `getStars`   ⇒ §٦ «لا تُنقص نجمةً كسبها»
//
// **وحدَّا §٥ صامتان في رحلة اليوم** (لا بوّابةَ بين المجموعتين، والقرآنيةُ بعدها
// كلِّها) — فلولا حقنُ `rungsOf` بأقسامٍ مصنوعة لمرّا ولو كانا فاسدَين. وذلك عينُ
// ما أظهره النقيضان الأوّلان: أحدُهما لم يُحرِّك §١ حرفاً وأحمرَّ §٥ وحدَه.
//
// و**حدودُ الحارس معلَنة**: لا يفتح متصفّحاً — المشهدُ الحيّ في
// `browser_test.py --placement` (دخولٌ من اللوحة، اجتيازُ مجموعتين، إخفاقٌ يوقف).

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { GROUPS, HARAKAT, isLetterlessKey } = await import(new URL('curriculum.js', APP));
const p = await import(new URL('progress.js', APP));
const { itemTexts } = await import(new URL('review.js', APP));
const gate = await import(new URL('gate.js', APP));
const pl = await import(new URL('placement.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const src = (name) => readFileSync(new URL(name, APP), 'utf8');

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ————— ١) السلّمُ مشتقٌّ من الرحلة لا مكتوب —————

console.log('\n١. السلّم مشتقٌّ من `journey()`');

p.reset();
const list = pl.rungs();
const sections = p.journey();

ok(list.length === GROUPS.length,
  `درجاتُ السلّم مجموعاتُ الرحلة كلُّها (${list.length} من ${GROUPS.length})`);
ok(list.every((s) => s.kind === 'group'), 'وكلُّها من نوع «مجموعة» لا غير');
ok(list.map((s) => s.id).join('،') === GROUPS.map((g) => g.id).join('،'),
  `وبترتيب الرحلة نفسِه (${list.map((s) => s.id).join(' ← ')})`);

// **مشتقٌّ لا منسوخ**: القسمُ في السلّم هو عينُه في `journey()` (المرجعُ نفسُه)
ok(list.every((s) => sections.includes(s)),
  'وكلُّ درجةٍ هي القسمُ نفسُه من الرحلة — لا نسخةٌ تفترق عنه يوماً');

// ولا درجةَ بعد أوّل قسمٍ قرآنيّ
const firstQuran = sections.findIndex((s) => s.kind === 'quran');
const lastRung = sections.indexOf(list[list.length - 1]);
ok(firstQuran > 0 && lastRung < firstQuran,
  `والسلّمُ كلُّه قبل المرحلة القرآنية (آخرُ درجةٍ ${lastRung} < ${firstQuran})`);

// **أنواعُ عقد الدرجة معروفةٌ كلُّها**: نوعٌ ثالث يدخل مجموعةً غداً بلا مفاتيحَ
// تُمتحَن يُسقِط هذا السطر يومَ يُضاف — فلا يمرّ صامتاً بعيّنةٍ ناقصة.
const KNOWN = new Set(['letter', 'words']);
const strange = [...new Set(list.flatMap((s) => s.nodes.map((n) => n.type)))]
  .filter((t) => !KNOWN.has(t));
ok(strange.length === 0,
  `وأنواعُ عقدها معروفةٌ لمُشتقّ المفاتيح (${[...KNOWN].join('، ')})`
  + (strange.length ? ` — **بلا مفاتيح: ${strange.join('، ')}**` : ''));

// ————— ٢) مفاتيحُ المهارات: من العقد لا من قائمةٍ تُكتب —————

console.log('\n٢. مفاتيحُ الدرجة مشتقّةٌ من عقدها');

for (const section of list) {
  const keys = pl.skillKeys(section);
  const letters = section.group.letters;
  const quiz = keys.filter((k) => k.kind === p.KINDS.QUIZ);
  const haraka = keys.filter((k) => k.kind === p.KINDS.HARAKA);
  const build = keys.filter((k) => k.kind === p.KINDS.BUILD);
  const want = letters.length * HARAKAT.length;
  ok(quiz.length === want && haraka.length === want && build.length > 0,
    `[${section.id}] ${letters.length} حروفٍ × ${HARAKAT.length} حركات ⇒ `
    + `${quiz.length} تمييزاً و${haraka.length} حركةً و${build.length} مقطعاً`);
  ok(keys.every((k) => new Set(keys.map((x) => p.skillKey(x.letter, x.haraka, x.kind))).size === keys.length),
    `[${section.id}] ولا مفتاحَ مكرَّر`);
  // **المفكوكية بالبناء**: لا مفتاحَ لحرفٍ من خارج المجموعة (والمقاطعُ من كلماتها،
  // وكلماتُها مفكوكةٌ بحصيلته — يحرسه `check_decodable.py`).
  const own = new Set(letters);
  const alien = [...quiz, ...haraka].filter((k) => !own.has(k.letter));
  ok(alien.length === 0,
    `[${section.id}] ولا يُمتحَن بحرفٍ من خارجها${alien.length ? ' — ' + alien.map((k) => k.letter).join('،') : ''}`);
}

// ————— ٣) العيّنة: ستّةٌ بمُنشئات المراجعة، ومن حصيلة موضعها —————

console.log('\n٣. العيّنة ≤٦ بتمارين قائمة');

const cumulative = (index) => new Set(GROUPS.slice(0, index + 1).flatMap((g) => g.letters));
let sane = true;
let shapes = new Set();
const seen = new Set();
for (let i = 0; i < list.length; i++) {
  const known = cumulative(i);
  for (let seed = 1; seed <= 12; seed++) {
    const items = pl.rungItems(i, rng(seed * 31 + i));
    if (items.length !== pl.SAMPLE) sane = false;
    seen.add(items.map((x) => x.id).join('|'));
    for (const item of items) {
      shapes.add(item.kind);
      if (item.letter && !isLetterlessKey(item.letter) && !known.has(item.letter)) sane = false;
      if (!itemTexts(item).length && item.kind !== p.KINDS.BUILD) sane = false;
    }
  }
}
ok(pl.SAMPLE === 6, `عيّنةُ الدرجة ستّةُ تمارين (${pl.SAMPLE} — نصُّ التكليف)`);
ok(sane, 'وكلُّ تمرينٍ من حصيلة موضعه: لا حرفَ لم يبلغه، ولكلٍّ نصٌّ يُنطق');
ok(seen.size > 10, `وتتجدّد كلَّ محاولة (${seen.size} تشكيلةً — لا نمطَ يُستظهَر)`);

// **صفرُ شكلِ تمرينٍ جديد**: كلُّ ما تُنتجه من أنواع `KINDS` القائمة، ومن مُنشئات
// المراجعة نفسِها — يُقرأ من الشيفرة نصّاً، فمن نسخ مُنشئاً هنا احمرَّ يومَ يفعل.
const placementSrc = src('placement.js');
ok([...shapes].every((k) => Object.values(p.KINDS).includes(k)),
  `وأنواعُها من KINDS القائمة (${[...shapes].sort().join('، ')})`);
ok(/from '\.\/review\.js'/.test(placementSrc)
  && /buildSession\(/.test(placementSrc) && /renderSession\(/.test(placementSrc),
  'وتُبنى بـ`buildSession` وتُعرض بـ`renderSession` — لا محرّكَ ثانياً');
ok(!/options:\s*\[/.test(placementSrc) && !/board:\s*/.test(placementSrc),
  'ولا تصنع تمريناً بيدها (لا `options` ولا `board` في الملف)');

// ————— ٤) العتبةُ عتبةُ البوابة نفسُها، والوقوفُ عند الشرخ —————

console.log('\n٤. عتبةُ الثمانين والوقوفُ عند الشرخ');

ok(/from '\.\/gate\.js'/.test(placementSrc) && /\bpassed\(/.test(placementSrc),
  'الحكمُ بـ`passed` من `gate.js` — عتبةٌ واحدة لا اثنتان تفترقان');
ok(gate.PASS_RATE === 0.8, `والعتبةُ ٨٠٪ (${gate.PASS_RATE * 100})`);
ok(gate.passed(5, 1) && gate.passed(6, 0) && !gate.passed(4, 2) && !gate.passed(0, 0),
  'خمسٌ من ستّ ⇒ عبور، وأربعٌ ⇒ لا عبور، وجلسةٌ فارغة لا تفتح شيئاً');
ok(/أولُ إخفاقٍ يُنهي|أوّلُ إخفاقٍ يُنهي/.test(placementSrc) && !/again\(\)/.test(
  placementSrc.slice(placementSrc.indexOf('if (!open)'), placementSrc.indexOf('const more'))),
  'وشاشةُ الإخفاق بلا زرِّ إعادةٍ — أوّلُ إخفاقٍ يُنهي (والإعادةُ من اللوحة)');

// ————— ٥) حدُّ البوّابة والقرآنية — **مُمتحَنٌ بأقسامٍ مصنوعة** —————
//
// الحدّان صامتان في رحلة اليوم (لا بوّابةَ بين المجموعتين)، فلو امتُحنا بها وحدَها
// لمرّا ولو كانا فاسدَين. فتُحقَن `rungsOf` بأقسامٍ مصنوعة يقع فيها ما لا يقع اليوم.

console.log('\n٥. البواباتُ لا تُقفز، والقرآنيةُ خارج السلّم');

const fake = (kind, id) => ({ kind, id, nodes: [], group: { id, title: id, letters: [], words: [] } });
const ids = (out) => out.map((s) => s.id).join('،');
const never = () => false;
const always = () => true;

const withGate = [fake('group', 'a'), fake('gate', 'gate:x'), fake('group', 'b')];
ok(ids(pl.rungsOf(withGate, never)) === 'a',
  'بوّابةٌ لم تُجتز تقصُر السلّمَ عندها — «البواباتُ لا تُقفز، تُجتاز بنفسها»');
ok(ids(pl.rungsOf(withGate, always)) === 'a،b',
  'وإن اجتازها بنفسه مضى السلّمُ إلى ما بعدها');

ok(ids(pl.rungsOf([fake('group', 'a'), fake('quran', 'quran:prep'), fake('group', 'b')], always)) === 'a',
  'والمرحلةُ القرآنية تقطع السلّمَ كلياً — المصحفُ يُتلى لا يُمتحَن');
ok(ids(pl.rungsOf([fake('group', 'a'), fake('interlude', 'after:a'), fake('contrast', 'c'),
  fake('group', 'b')], always)) === 'a،b',
  'وما بينهما من مهارةٍ وقصةٍ ومواجهةٍ لا يقطعه ولا يدخله — لا يُمتحَن فيها فلا تُفتح');

// وحدُّ الفتح نفسُه: عقدةُ بوّابةٍ أو قرآنيةٍ لا تُعلَّم منجزةً بحال
const mixed = {
  kind: 'group',
  nodes: [{ id: 'g1:ا', type: 'letter' }, { id: 'g1:words', type: 'words' },
    { id: 'gate:x', type: 'gate' }, { id: 'quran:s1', type: 'quran' },
    { id: 'prophet:p1', type: 'prophet' }],
};
ok(pl.openableNodes(mixed).join('،') === 'g1:ا،g1:words',
  `والفتحُ يستثني البوّابةَ والقرآنيةَ وقصتَها (${pl.openableNodes(mixed).join('،')})`);
ok(pl.rungs().every((s) => pl.openableNodes(s).length === s.nodes.length),
  'ودرجاتُ اليوم كلُّها عقدُ مجموعاتٍ محضة — فلا شيءَ يُستثنى منها فعلاً');

// ولا عقدةَ قرآنيةٍ ولا بوّابةٍ في السلّم أصلاً (الحدُّ الأول قبل الثاني)
const forbidden = pl.rungs().flatMap((s) => s.nodes)
  .filter((n) => ['gate', 'quran', 'prophet'].includes(n.type));
ok(forbidden.length === 0, `ولا عقدةَ من هذه الأنواع في السلّم (${forbidden.length})`);

// ————— ٦) الفتحُ والكتابة: نجمةٌ واحدة، وسجلٌّ يقرؤه وليُّ الأمر —————

console.log('\n٦. الفتحُ بمصدرٍ مميَّز');

p.reset();
store.clear();
const g1 = pl.rungs()[0];
const opened = p.recordPlacement({
  groups: [g1.id], nodes: pl.openableNodes(g1), stopped: pl.rungs()[1].id, right: 6, tries: 6,
});
ok(opened === g1.nodes.length, `اجتيازُ المجموعة الأولى يفتح عقدَها (${opened})`);
ok(g1.nodes.every((n) => p.getStars(n.id) === p.PLACEMENT_STARS),
  'بنجمةٍ واحدة — تفكّ القفل ولا تدّعي إتقاناً (حكمُ `unlockUpTo` والترحيلِ الرحيم)');
ok(p.placementLog().groups.join('،') === g1.id
  && p.placementLog().nodes.length === g1.nodes.length,
  'وسجلُّه يسمّي المجموعةَ وعقدَها — «فُتح باللحاق» بمصدرٍ مميَّز');

// **الوقوفُ عند الشرخ**: ما بعد الدرجة المُخفَقة لا يُفتح منه شيء
const beyond = pl.rungs().slice(1).flatMap((s) => s.nodes);
ok(beyond.every((n) => !p.isDone(n.id)),
  `وما بعد الشرخ لم يُفتح منه شيء (${beyond.length} عقدةً على حالها)`);
ok(p.nextNode() && p.allNodes().indexOf(p.nextNode()) === g1.nodes.length,
  `و«تابع من هنا» يقف عند أوّل ما لم يُثبته (${p.nextNode()?.id})`);

// **لا قفلَ رجوعاً**: نجمةٌ مكسوبةٌ لا تُنقَص، ومفتوحٌ لا يُغلَق
p.setStars('g1:ا', 3);
p.recordPlacement({ groups: [g1.id], nodes: pl.openableNodes(g1) });
ok(p.getStars('g1:ا') === 3, 'وإعادةُ الامتحان لا تُنقص نجمةً كسبها بلعبه');
ok(p.placementLog().groups.length === 1,
  'وسجلُّه يتّحد مع سابقه لا يحلّ محلّه (لا مجموعةَ تُنسى)');
ok(p.recordPlacement({ nodes: ['لا-وجود-لها'] }) === 0
  && !p.snapshot().stars['لا-وجود-لها'],
  'ولا يُعلَّم معرّفٌ لا موضعَ له في الرحلة');

// **الاستئنافُ من آخر حدّ**: الدرجةُ التالية لا الأولى
ok(pl.startRung() === 1, `والإعادةُ تستأنف من الدرجة التالية (${pl.startRung()})`);
p.reset();
ok(pl.startRung() === 0 && p.placementLog() === null,
  'وطفلٌ جديد يبدأ من أولها بلا سجلّ');

// ————— ٧) ليتنر: كلُّ محاولةٍ قياسٌ حقيقيّ بلا وسمٍ خاصّ —————

console.log('\n٧. ليتنر يقرأ محاولاته كسائرها');

ok(!/recordAttempt/.test(placementSrc.replace(/\/\/[^\n]*/g, '')),
  'الامتحانُ لا يكتب في ليتنر بيده — `renderSession` تكتب كلَّ محاولةٍ كما تكتبها المراجعة');
const reviewSrc = src('review.js');
ok(/progress\.recordAttempt\(letter, haraka, item\.kind, correct\)/.test(reviewSrc),
  'والمحرّكُ يكتب بنوع التمرين نفسِه — لا وسمَ «لحاق» ولا استثناء');
ok(!/markReview\(/.test(placementSrc),
  'ولا يُقيَّد مراجعةَ يوم: امتحانُ موضعٍ لا جلسةُ تثبيت — فلا يقول للوالد «راجَع» ولم يراجع');

// وقواعدُ الخفوت بحالها: الوحدةُ لا تعرف `fade.js` أصلاً (حصانةٌ بنيوية)
ok(!/fade\.js/.test(placementSrc), 'وقواعدُ الخفوت بحالها — الوحدةُ لا تعرف `fade.js`');

// ————— ٨) الصوت: صفرُ إضافة (تمارينٌ لها ملفاتُها) —————

console.log('\n٨. صفرُ إضافةٍ صوتية');

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
const spoken = new Set();
for (let i = 0; i < pl.rungs().length; i++) {
  for (let seed = 1; seed <= 12; seed++) {
    for (const item of pl.rungItems(i, rng(seed * 7 + i))) for (const t of itemTexts(item)) spoken.add(t);
  }
}
const orphan = [...spoken].filter((t) => !have.has(t) && !pending.has(t));
ok(orphan.length === 0,
  `كلُّ ما ينطقه الامتحان له ملفٌّ مولَّد (${spoken.size} نصاً)`
  + (orphan.length ? ` — بلا ملفّ: ${orphan.slice(0, 5).join('، ')}` : ''));

// ————— ٩) البابُ واحد: لوحةُ وليّ الأمر لا شاشةُ طفل —————

console.log('\n٩. بابُه لوحةُ وليّ الأمر وحدَها');

const parentSrc = src('parent.js');
ok(/placementSection/.test(parentSrc) && /امتحان اللحاق/.test(parentSrc),
  'قسمُ «امتحان اللحاق» في اللوحة');
ok(/فُتح باللحاق/.test(parentSrc), 'وسجلُّ آخر نتيجةٍ يُقرأ فيها «فُتح باللحاق»');
ok(/placement\.renderPlacement\(/.test(parentSrc) && /examining/.test(parentSrc),
  'والامتحانُ يحلّ محلّ اللوحة خلف بوابتها — لا مسارَ ثانياً يبلغه طفل');
ok(!/https:\/\//.test(parentSrc), 'واللوحةُ تبقى صفرَ عناوينَ خارجية');
ok(!src('main.js').includes('placement'),
  'ولا بابَ له في التوجيه — فلا يفتحه طفلٌ بعنوانٍ يكتبه');

const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
ok(/'js\/placement\.js'/.test(sw) && /const VERSION = 'v32'/.test(sw),
  'وهو في قشرة v32 فيعمل دون إنترنت');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «بوابة اللحاق» ناجحة');
process.exit(fails ? 1 : 0);
