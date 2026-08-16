// اختبار «وضع الدعم» — الجلسة د١: إيقاعٌ يُعاير ولا منهجَ يُبدَّل.
//   node tools/test_support.mjs
// يخرج بـ١ عند أي إخفاق.
//
// المحروسُ هنا ستّة، وكلُّها من المبدأين الحاكمين للجلسة:
//   ١) **الافتراضُ الصامت هو السلوكُ القائم حرفاً** — مخزنٌ فارغ ⇒ لا فرقَ ببايت.
//   ٢) المقابضُ تعمل حين تُشغَّل، والإطفاءُ يردّ القائم بلا فقدِ اختيارات الوالد.
//   ٣) **الملقَّنُ لا يرقّي صندوقاً ولا يُحتسب إتقاناً** (القاعدة التي لا تُخرَق).
//   ٤) **لا تلقينَ خارج الاكتساب** — ولا في المراجعة ولا البوابتين ولا اللحاق:
//      حصانةٌ بنيوية تُجرد على المصدر (تلك الوحداتُ لا تعرف `mayPrompt` أصلاً).
//   ٥) **لا مِقبضَ يمسّ نصَّ محتوىً أو بيانَ منهج** — جردٌ على المصدر وعلى الجدول.
//   ٦) **المقاديرُ من مخزنٍ واحد** لا ثوابتَ متناثرة، و`parent.js` صفرُ `https://`.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const support = await import(new URL('support.js', APP));
const progress = await import(new URL('progress.js', APP));
const fade = await import(new URL('fade.js', APP));
const { buildSession, itemTexts, SESSION_SIZE } = await import(new URL('review.js', APP));
const { GROUPS } = await import(new URL('curriculum.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const src = (name) => readFileSync(new URL(name, APP), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const haveAudio = new Set(Object.values(manifest));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const pending = new Set(queue.filter((e) => e?.text && e.status !== 'done').map((e) => e.text));

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const LETTERS = GROUPS.slice(0, 4).flatMap((g) => g.letters);
const session = (rnd) => buildSession({ letters: LETTERS, rnd });

// ————— ١) الافتراضُ الصامت: السلوكُ القائم حرفاً —————

console.log('\n١. الافتراض الصامت = السلوك القائم');

support.reset();
ok(support.modeOn() === false, 'وضعُ الدعم مطفأٌ ابتداءً (مخزنٌ فارغ)');
ok(support.KEYS.every((k) => support.value(k) === support.KNOBS[k].standing),
  `وكلُّ مقبضٍ يقرأ قيمتَه القائمة (${support.KEYS.length} مقابض)`);
ok(support.KEYS.every((k) => support.isOn(k) === false), 'ولا مِقبضَ مشتغلٌ والوضعُ مطفأ');

ok(support.sessionSize() === 6, `جرعةُ الجلسة ستّة تمارين (${support.sessionSize()})`);
ok(support.distractors() === 2, `والمشتّتات اثنان (${support.distractors()})`);
ok(support.rate() === 1, 'وسرعةُ الصوت ١ — فلا يُمَسّ عنصرُ الصوت أصلاً');
ok(support.calm() === false && support.holdFade() === false,
  'ولا هدوءَ حسّياً ولا تجميدَ خفوت');
ok(progress.BOX_DAYS.every((d) => support.days(d) === d),
  `ومواعيدُ ليتنر كما هي (${progress.BOX_DAYS.map(support.days).join('،')})`);
ok(support.mayPrompt(0) === false, 'ولا تلقينَ ألبتّة — ولو في صندوق الاكتساب');

ok(SESSION_SIZE === support.KNOBS.dose.standing,
  'و`SESSION_SIZE` في المراجعة هو عينُ القائم في الجدول (لا رقمان يفترقان)');
const standing = session(rng(7));
ok(standing.length === SESSION_SIZE, `وجلسةُ المراجعة ${SESSION_SIZE} تمارين (${standing.length})`);
const quizOf = (items) => items.find((i) => i.kind === progress.KINDS.QUIZ);
ok(quizOf(standing)?.options.length === 3,
  `وتمرينُ التمييز ثلاثةُ خيارات (${quizOf(standing)?.options.length})`);

// الخفوت: كلمةٌ بلغت ضِعفَ العتبة تُعرض عاريةً كما كانت قبل هذه الجلسة
const WORD = 'بَابَا';
const DAY = progress.dayNumber();

// ————— ٢) المقابضُ تعمل حين تُشغَّل —————

console.log('\n٢. المقابض الستة تعمل من مفتاحٍ واحد');

support.setMode(true);
ok(support.KEYS.every((k) => support.isOn(k)), 'تشغيلُ الوضع يشغّل مقابضَه كلَّها');
ok(support.sessionSize() === 4, `الجرعة: أربعةُ تمارين (${support.sessionSize()})`);
ok(support.distractors() === 1, `الحوض: مشتّتٌ واحد (${support.distractors()})`);
ok(support.rate() < 1, `الصوت: أبطأ (${support.rate()})`);
ok(support.calm() === true, 'الهدوء الحسّي: مشتغل');
ok(support.holdFade() === true, 'تجميد الخفوت: مشتغل');
const closer = progress.BOX_DAYS.map(support.days);
ok(support.days(0) === 0 && closer.every((d, i) => d <= progress.BOX_DAYS[i])
  && closer.some((d, i) => d < progress.BOX_DAYS[i]) && closer.slice(1).every((d) => d >= 1),
  `التكرار: مواعيدُ أقربُ ولا موعدَ يسقط دون يوم (${closer.join('،')})`);

const helped = session(rng(7));
ok(helped.length === 4, `وجلسةُ المراجعة تُبنى بأربعة تمارين (${helped.length})`);
ok(quizOf(helped)?.options.length === 2,
  `وتمرينُ التمييز خيارانِ يُقرآن (${quizOf(helped)?.options.length})`);

// **لا نصَّ منطوقٌ جديد**: ضيقُ الحوض يقلّل الخيارات ولا يؤلّف كلمة
let unknown = null;
for (let seed = 1; seed <= 20 && !unknown; seed++) {
  for (const item of session(rng(seed))) {
    for (const text of itemTexts(item)) {
      if (!haveAudio.has(text) && !pending.has(text)) unknown = text;
    }
  }
}
ok(!unknown, `ولا نصَّ منطوقاً جديداً في عشرين جلسةَ دعم${unknown ? ` — «${unknown}»` : ''}`);

// **قراءاتٌ متباعدة تحت التجميد**: أيامٌ متتالية، والعدّادُ يمضي والدرجةُ ممسوكة
for (let i = 1; i < fade.BARE_AT; i++) progress.recordRead(WORD, DAY - fade.BARE_AT + i);
ok(fade.credit(WORD) === true, 'وشاهدُ القراءة يُحتسب تحت التجميد كما يُحتسب بدونه');
ok(fade.wordLevel(WORD) === 1, 'وتجميدُ الخفوت يمسك الدرجةَ عند ز١ ولو بلغت ضِعفَ العتبة');
ok(progress.readCount(progress.wordKey(WORD)) === fade.BARE_AT,
  `و**عدّادُ القراءات لا يُمَسّ** — يمضي تحت التجميد كما كان (${progress.readCount(progress.wordKey(WORD))})`);
ok(fade.levelOf(fade.BARE_AT) === 3, 'و`levelOf` تبقى دالّةً نقيّة (القاعدةُ لم تتبدّل)');

console.log('\n٣. مِقبضٌ يُطفأ وحده، والإطفاءُ يردّ القائم بلا فقد');

support.set('pool', false);
ok(support.distractors() === 2 && support.sessionSize() === 4,
  'إطفاءُ مقبضٍ بعينه يردّه وحدَه إلى القائم');
support.setMode(false);
ok(support.KEYS.every((k) => support.value(k) === support.KNOBS[k].standing),
  'وإطفاءُ الوضع يردّ الجميع');
ok(fade.wordLevel(WORD) === 3, 'وتعود الكلمةُ إلى درجتها التي بلغها تحت التجميد (ز٣)');
support.setMode(true);
ok(support.isOn('pool') === false && support.isOn('dose') === true,
  'وإعادةُ التشغيل تحفظ ما أطفأه الوالدُ بيده');
support.reset();

// ————— ٤) الملقَّنُ لا يرقّي صندوقاً ولا يُحتسب إتقاناً —————

console.log('\n٤. العون يُسجَّل ولا يُزوَّر القياس');

const KIND = progress.KINDS.QUIZ;
const boxOf = (k) => progress.getSkill(progress.skillKey('ب', 'fatha', k));

progress.recordAttempt('ب', 'fatha', KIND, true);
ok(boxOf(KIND)?.box === 1, 'محاولةٌ صحيحة بلا عون ترفع الصندوق (١)');

for (let i = 0; i < 5; i++) {
  progress.endRound();
  progress.recordAttempt('ت', 'fatha', KIND, true, progress.dayNumber(), true);
}
const aided = progress.getSkill(progress.skillKey('ت', 'fatha', KIND));
ok(aided?.box === 0, `خمسُ إجاباتٍ ملقَّنة صحيحة لا ترفع الصندوق (${aided?.box})`);
ok(aided?.right === 0 && aided?.wrong === 0, 'ولا تُحتسب صواباً ولا خطأً');
ok(aided?.helped === 5, `وتُسجَّل محاولاتٍ معانة (${aided?.helped})`);
ok(aided?.due <= progress.dayNumber(), 'وتبقى المهارةُ مستحقّةً للمراجعة — العونُ لا يُبعد موعداً');
ok(progress.helpedAttempts() === 5, 'ولوحةُ الوالد تقرأ عددَها من سجلّ المهارات');
ok(aided.box < progress.MASTERED_BOX,
  'و**لا يبلغ الملقَّنُ صندوقَ الإتقان أبداً** — فما في «الحروف المتقنة» أثبته بنفسه');

// ومحاولةٌ معانةٌ خاطئة لا تُسقِط ما كسبه بلا عون
for (let i = 0; i < 3; i++) { progress.endRound(); progress.recordAttempt('ب', 'fatha', KIND, true); }
const before = boxOf(KIND).box;
progress.endRound();
progress.recordAttempt('ب', 'fatha', KIND, false, progress.dayNumber(), true);
ok(boxOf(KIND).box === before && boxOf(KIND).wrong === 0,
  `وخطأٌ مع العون لا يُصفّر صندوقاً ولا يُسجَّل ضعفاً (${boxOf(KIND).box})`);

console.log('\n٥. لا تلقين خارج الاكتساب');

support.setMode(true);
ok(support.mayPrompt(0) === true, 'التلميحُ يجوز في صندوق الاكتساب (صفر) والوضعُ مشتغل');
ok([1, 2, 3, 4, 5].every((box) => support.mayPrompt(box) === false),
  'ولا يجوز في صندوقٍ ارتفع — الطلاقةُ لا تُلقَّن (Haring 1978)');
support.set('prompt', false);
ok(support.mayPrompt(0) === false, 'ومفتاحُه يُطفأ وحدَه');
support.reset();

// **ومفتاحُه لا يُعرَض قبل أن تبلغه شاشة**: شاشاتُ الاكتساب (درسُ الحرف واللعبة
// والمهارة والبستان) خارج ملفات الجلسة، فالقاعدةُ مبنيّةٌ محروسةٌ ولا تلميحَ يُعرَض
// اليوم — ومفتاحٌ يقلّبه الوالدُ ولا يرى له أثراً وعدٌ كاذب. فالمقبضُ `pending`،
// و**يُسقِط هذا السطرُ الوسمَ يومَ يُستدعى** فيظهر مفتاحُه في اللوحة.
ok(support.KNOBS.prompt.pending === true && !support.PANEL_KEYS.includes('prompt'),
  'ومفتاحُ التلقين لا يُعرَض في اللوحة ما دامت لا شاشةَ تستدعيه (`pending`)');
const CALLERS = ['lesson.js', 'words.js', 'skill.js', 'garden.js', 'ladder.js', 'story.js',
  'quran.js', 'contrast.js', 'roots.js', 'screens.js', 'sentences.js', 'library.js', 'main.js',
  'parent.js', 'review.js', 'gate.js', 'placement.js'];
ok(CALLERS.every((f) => !/mayPrompt\s*\(/.test(src(f))) === !support.PANEL_KEYS.includes('prompt'),
  'ووسمُ الانتظار يطابق الواقع: لا شاشةَ تستدعي التلميح اليوم');

const REVIEW_SIDE = ['review.js', 'gate.js', 'placement.js'];
ok(REVIEW_SIDE.every((f) => !/mayPrompt\s*\(/.test(src(f))),
  'ولا المراجعةُ ولا البوابتان ولا اللحاق تستدعي `mayPrompt` بحال (حصانةٌ بنيوية)');
ok(!/import[^;]*mayPrompt[^;]*support\.js/s.test(src('review.js')),
  'ومحرّكُ الجلسة يستورد المقادير ولا يستورد التلقين');

// ————— ٦) لا مِقبضَ يمسّ نصَّ محتوىً أو بيان منهج —————

console.log('\n٦. المقابض مقاديرُ لا مادّة');

const supportSrc = src('support.js');
ok(!/^\s*import\s/m.test(supportSrc),
  'وحدةُ الدعم **لا تستورد شيئاً** — فلا تبلغ منهجاً ولا معجماً ولا مكتبةً بحال');
ok(!/['"]\.\/(curriculum|lexicon|library|sentences|story|words)\.js['"]/.test(supportSrc),
  'ولا مسارَ ملفِّ بياناتٍ مكتوبٌ فيها ألبتّة');
const kinds = Object.values(support.KNOBS)
  .flatMap((k) => [typeof k.standing, typeof k.supported]);
ok(kinds.every((t) => t === 'number' || t === 'boolean'),
  `وكلُّ مقدارٍ رقمٌ أو نعم/لا — لا قيمةَ نصّية بينها (${[...new Set(kinds)].join('، ')})`);
ok(Object.values(support.KNOBS).every((k) => typeof k.standing === typeof k.supported),
  'والقائمُ وبديلُه من صنفٍ واحد في كل مقبض');
ok(Object.values(support.KNOBS).every((k) => k.title && k.line),
  'ولكلٍّ اسمُه وسطرُ شرحه في الجدول نفسِه (فلا يفترق ما يُقرأ عمّا يُفعَل)');

// ————— ٧) المقادير من مخزنٍ واحد، واللوحةُ بابُها —————

console.log('\n٧. مخزنٌ واحد لا ثوابتُ متناثرة');

const reviewSrc = src('review.js');
ok(!/const\s+OPTIONS\s*=/.test(reviewSrc) && reviewSrc.includes("from './support.js'"),
  'المراجعة تقرأ سعةَ الحوض من المخزن — لا ثابتَ `OPTIONS` فيها');
ok(!/=\s*sessionSize\(\)[\s\S]{0,40}export const SESSION_SIZE/.test(reviewSrc)
  && /size = sessionSize\(\)/.test(reviewSrc),
  'وجرعةُ الجلسة تُقرأ عند كل بناء لا مرّةً عند التحميل');
const progressSrc = src('progress.js');
ok(/s\.due = today \+ support\.days\(BOX_DAYS\[s\.box\]\)/.test(progressSrc)
  && !/s\.due = today \+ BOX_DAYS\[/.test(progressSrc),
  'وموعدُ ليتنر يمرّ بمعامل التقارُب في موضعٍ واحد');
ok(/holdFade\(\)/.test(src('fade.js')), 'والخفوتُ يسأل المخزنَ عن التجميد');
ok(/playbackRate/.test(src('audio.js')) && /rate\(\)/.test(src('audio.js')),
  'والصوتُ يسأل المخزنَ عن سرعته');
ok(/classList\.toggle\('calm'/.test(src('main.js')),
  'والهدوءُ صنفٌ على الجذر يصبغه `main.js` (والوحدةُ لا تعرف DOM)');

const parentSrc = src('parent.js');
ok(!parentSrc.includes('https://'), 'ولوحةُ وليّ الأمر تبقى صفرَ `https://`');
ok(/support\.PANEL_KEYS\.map/.test(parentSrc) && /support\.setMode/.test(parentSrc),
  'وبابُ الوضع قسمٌ في اللوحة — مفاتيحُه من الجدول لا مكتوبةً بيد');
ok(parentSrc.includes('لا يُحتسب ما أُعين عليه إتقاناً'),
  'وفيها السطرُ الصريح: «لا يُحتسب ما أُعين عليه إتقاناً»');
ok(/لا يشخّص/.test(parentSrc) && /غيرَ الناطق/.test(parentSrc),
  'ووعدُها صادقٌ بحدوده كما كتبته الدراسة');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «وضع الدعم» ناجحة');
process.exit(fails ? 1 : 0);
