// اختبار «وضع الدعم» — الجلسة د١: إيقاعٌ يُعاير ولا منهجَ يُبدَّل.
//   node tools/test_support.mjs
// يخرج بـ١ عند أي إخفاق.
//
// المحروسُ هنا تسعة، وكلُّها من المبدأين الحاكمين للجلسة:
//   ١) **الافتراضُ الصامت هو السلوكُ القائم حرفاً** — مخزنٌ فارغ ⇒ لا فرقَ ببايت.
//   ٢) المقابضُ تعمل حين تُشغَّل، والإطفاءُ يردّ القائم بلا فقدِ اختيارات الوالد.
//   ٣) **الملقَّنُ لا يرقّي صندوقاً ولا يُحتسب إتقاناً** (القاعدة التي لا تُخرَق).
//   ٤) **لا تلقينَ خارج الاكتساب** — ولا في المراجعة ولا البوابتين ولا اللحاق:
//      حصانةٌ بنيوية تُجرد على المصدر (تلك الوحداتُ لا تعرف `mayPrompt` أصلاً).
//   ٥) **لا مِقبضَ يمسّ نصَّ محتوىً أو بيانَ منهج** — جردٌ على المصدر وعلى الجدول.
//   ٦) **المقاديرُ من مخزنٍ واحد** لا ثوابتَ متناثرة، و`parent.js` صفرُ `https://`.
// وثلاثةٌ من الجلسة د٢ (١٧ أغسطس ٢٠٢٦):
//   ٧) **عرضُ التلقين**: الوسمُ `pending` رُفع، و**المطابقةُ في الاتجاهين** — مفتاحٌ
//      في اللوحة ⇔ شاشةُ اكتسابٍ تستدعيه، وكلُّ موضعِ قياسٍ فيها يمرّر وسمَ العون.
//   ٨) **مسطرةُ الامتحان الواحدة**: ما يمسّ القياسَ يُعطَّل في `duringExam` وما يريح
//      يسري — والنطاقُ يُردّ ولو رمى، ولا يُخزَّن في جهاز.
//   ٩) **مؤشّرُ الوضع**: يظهر بالاشتغال ويغيب بالإطفاء، بلا نصٍّ يقرؤه طفل، وغيرُ
//      تفاعليّ، وخارجَ التدفّق فلا فرقَ في التخطيط بين الحالين.

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

// **ومفتاحُه يُعرَض يومَ تستدعيه شاشة** (الجلسة د٢): كان موسوماً `pending` لأنّ
// شاشات الاكتساب كانت خارج ملفات د١ — ومفتاحٌ يقلّبه الوالدُ ولا يرى له أثراً وعدٌ
// كاذب. فلمّا صارت الأربعُ تعرضه رُفع الوسمُ. **والمطابقةُ في الاتجاهين**: مفتاحٌ في
// اللوحة ⇔ شاشةُ اكتسابٍ تستدعيه — فمن أعاد الوسمَ أو حذف الاستدعاء أحمرَّ.
const ACQUIRE = ['lesson.js', 'words.js', 'skill.js', 'garden.js'];
const OTHER = ['ladder.js', 'story.js', 'quran.js', 'contrast.js', 'roots.js', 'screens.js',
  'sentences.js', 'library.js', 'main.js', 'parent.js', 'review.js', 'gate.js', 'placement.js'];
const calls = (f) => /mayPrompt\s*\(/.test(src(f)) || /promptFor\w*\s*\(/.test(src(f));

ok(!support.KNOBS.prompt.pending && support.PANEL_KEYS.includes('prompt'),
  'ومفتاحُ التلقين يُعرَض في اللوحة — رُفع وسمُ الانتظار لأنّ الشاشاتِ صارت تعرضه');
ok(ACQUIRE.every(calls) === support.PANEL_KEYS.includes('prompt'),
  `والوسمُ يطابق الواقع في الاتجاهين: شاشاتُ الاكتساب الأربع تستدعيه (${ACQUIRE.join('، ')})`);
// و**البستانُ يستعير قاعدةَ اللعبة ولا ينسخها**: تمرينُ التركيب فيهما واحد، فمدخلُ
// إذنه واحد (`promptForTile` في `words.js`) — نسختان تفترقان يوماً في شرط الصندوق.
ok(/import[^;]*promptForTile[^;]*'\.\/words\.js'/.test(src('garden.js'))
  && !/mayPrompt/.test(src('garden.js')),
  'والبستانُ يستعير قاعدةَ اللعبة (`promptForTile`) ولا يكتب لنفسه شرطاً ثانياً');

// **وكلُّ موضعِ قياسٍ في شاشة اكتسابٍ يمرّر وسمَ العون**: موضعٌ جديد يُكتب بلا الوسم
// يسجّل إتقاناً كاذباً على تلميحٍ معروض — فيُجرد على المصدر لا يُوثَق بتعليق.
const CALL = /recordAttempt\((?:[^()]|\([^()]*\))*\)/g;
const TAGGED = /,\s*progress\.dayNumber\(\)\s*,\s*\w+\s*\)$/;
for (const file of ACQUIRE) {
  const found = src(file).match(CALL) || [];
  const bare = found.filter((c) => !TAGGED.test(c));
  ok(found.length > 0 && bare.length === 0,
    `[${file}] كلُّ مواضع القياس فيه تمرّر وسمَ العون (${found.length} موضعاً`
    + `${bare.length ? ` — بلا وسم: ${bare.length}` : ''})`);
}

const REVIEW_SIDE = ['review.js', 'gate.js', 'placement.js'];
ok(REVIEW_SIDE.every((f) => !/mayPrompt\s*\(/.test(src(f))),
  'ولا المراجعةُ ولا البوابتان ولا اللحاق تستدعي `mayPrompt` بحال (حصانةٌ بنيوية)');
ok(OTHER.every((f) => !/mayPrompt\s*\(/.test(src(f))),
  `ولا شاشةَ خارج الاكتساب تعرض تلميحاً (${OTHER.length} وحدة)`);
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

// ————— ٨) مسطرةُ الامتحان الواحدة (الجلسة د٢) —————
//
// **قاعدةُ المالك**: العونُ الذي يريح يُسمح في امتحان اللحاق، والذي يجيب يُمنع.
// فالمحروسُ هنا **القسمةُ نفسُها** (كلُّ مقبضٍ مصنَّفٌ في الجدول) و**أثرُها**:
// ما يمسّ القياسَ يعود إلى القائم داخل النطاق، وما يريح يبقى على حاله.

console.log('\n٨. مسطرةُ الامتحان الواحدة');

support.reset();
support.setMode(true);

ok(support.KEYS.every((k) => typeof support.KNOBS[k].measures === 'boolean'),
  `كلُّ مقبضٍ مصنَّفٌ في الجدول: أيمسّ ما يُقاس أم يريح؟ (${support.KEYS.length} مقابض)`);
ok(support.EXAM_OFF.join('،') === 'dose،pool،prompt',
  `والذي يُعطَّل في الامتحان ما يمسّ القياسَ وحدَه (${support.EXAM_OFF.join('، ')})`);
ok(support.EXAM_OFF.every((k) => support.PANEL_KEYS.includes(k)),
  'وكلُّه معروضٌ في اللوحة — فلا مقبضَ خفيّ يُعطَّل خفيةً');

ok(!support.examOn(), 'وخارج النطاق لا امتحانَ مشتغل');
const inExam = support.duringExam(() => ({
  on: support.examOn(),
  dose: support.sessionSize(),
  pool: support.distractors(),
  prompt: support.mayPrompt(0),
  pace: support.rate(),
  calm: support.calm(),
  hold: support.holdFade(),
  days: progress.BOX_DAYS.map(support.days),
}));
ok(inExam.on && !support.examOn(), 'والنطاق يُفتَح ويُغلَق مع النداء المتزامن');
ok(inExam.pool === support.KNOBS.pool.standing
  && inExam.dose === support.KNOBS.dose.standing && inExam.prompt === false,
  `وفيه يعود ما يجيب إلى القائم: حوضٌ ${inExam.pool} · جرعةٌ ${inExam.dose} · لا تلقين`);
ok(inExam.pace === support.KNOBS.pace.supported && inExam.calm === true && inExam.hold === true,
  `ويسري ما يريح: صوتٌ ${inExam.pace} · هدوءٌ · تشكيلٌ ثابت`);
ok(inExam.days.join('،') === progress.BOX_DAYS.map(support.days).join('،'),
  `وموعدُ ليتنر كما هو داخلَه وخارجَه (${inExam.days.join('،')}) — امتحانُ موضعٍ لا يقطع إيقاعَه`);
ok(support.distractors() === support.KNOBS.pool.supported,
  'وبعد انقضائه يعود الوضعُ إلى مقاديره — لا أثرَ يبقى على شاشات الطفل');

let threw = false;
try { support.duringExam(() => { throw new Error('عطب'); }); } catch { threw = true; }
ok(threw && !support.examOn(), 'ولو رمى النداءُ رُدّ الحالُ — لا يعلق الامتحانُ مفتوحاً');
ok(!String(store.get('muallim.support.v1') || '').includes('exam'),
  'ولا يُخزَّن النطاقُ في الجهاز أصلاً — مدّةُ بناءٍ لا عَلَمٌ يعبر النسخ');

const placementSrc = src('placement.js');
ok(/duringExam\(\(\) => buildSession\(/.test(placementSrc),
  'وامتحانُ اللحاق يبني تمارينَه داخل النطاق (`duringExam(() => buildSession(`)');
ok(!/sessionSize|distractors|mayPrompt|holdFade|\brate\(/.test(placementSrc),
  'ولا يقرأ مقداراً من مقادير الوضع بيده — يستورد النطاقَ وحدَه');
ok(/from '\.\/gate\.js'/.test(placementSrc) && !/PASS_RATE\s*=/.test(placementSrc)
  && !/passed\s*=/.test(placementSrc),
  'وعتبتُه عتبةُ البوابة المستوردة — لا مقبضَ يمسّها ولا رقمَ ثانٍ في الملف');

support.reset();

// ————— ٩) مؤشّرُ الوضع على شاشة الطفل (أمر المالك، ١٧ أغسطس ٢٠٢٦) —————
//
// «يعرفه البالغ ولا يشغل الطفل»: يظهر بالاشتغال ويغيب بالإطفاء، بلا كلمةٍ يقرؤها
// طفل، وغيرُ تفاعليّ، و**خارجَ التدفّق** فلا يزحزح تخطيطاً ولا يحجز فراغاً.

console.log('\n٩. مؤشّرُ وضع الدعم');

const mainSrc = src('main.js');
const css = readFileSync(new URL('../app/css/app.css', import.meta.url), 'utf8');
const markCall = mainSrc.match(/const supportMark = h\((?:[^()]|\([^()]*\))*\);/s)?.[0] || '';
const markCss = css.match(/\.support-mark\s*\{[^}]*\}/)?.[0] || '';

ok(support.MARK.label && support.MARK.note,
  `واسمُها وسطرُها في جدول support.js حيث تُملَك العلامة («${support.MARK.label}»)`);
ok(/const paintSupport[\s\S]*support\.modeOn\(\)[\s\S]*supportMark/.test(mainSrc)
  && /supportMark\.remove\(\)/.test(mainSrc) && /support\.onChange\(paintSupport\)/.test(mainSrc),
  'وظهورُها معلَّقٌ بالمفتاح الأعلى وحدَه — تُلحَق باشتغاله وتُنزَع بإطفائه في اللحظة نفسِها');
ok(markCall.includes("class: 'support-mark'") && markCall.includes('support.MARK.label'),
  'وتُبنى مرّةً واحدة خارجَ الشاشات كلِّها — فتُرى في كل شاشة ولا تعرفها شاشة');
// **بلا أبناء**: النداءُ ينتهي بـ`})` — فلا وسيطَ ثالثَ فيه نصٌّ ولا عنصر، ولا
// يُكتب نصُّها بعدُ (`textContent`). فحلقةٌ فارغة لا كلمةَ فيها ولا رمز.
ok(/\}\s*\);?\s*$/.test(markCall.trim()) && !/supportMark\.textContent/.test(mainSrc),
  'ولا نصَّ فيها يقرؤه طفل — اسمُها في `aria-label` و`title` للبالغ وحدَه');
ok(markCall.includes("'aria-label'") && markCall.includes('title:')
  && !/onclick|tabindex|tabIndex|role: 'button'/.test(markCall),
  'وغيرُ تفاعلية: لا نقرَ ولا تركيزَ ولا فتحَ لوحة');
ok(/pointer-events:\s*none/.test(markCss) && /position:\s*fixed/.test(markCss),
  'ولا تُنقَر ولا تدخل تدفّقَ الصفحة — فلا فرقَ في تخطيط الشاشة بين الحالين');
ok(!/\bcontent:\s*['"]/.test(markCss),
  'ولا حرفَ يُرسَم فيها بـ`content` — حلقةٌ بلون اللوح لا رمزٌ ولا كلمة');
ok(/var\(--accent-skills\)/.test(markCss) && !/#[0-9a-fA-F]{3,6}/.test(markCss),
  'ولونُها من لوح `app.css` لا قيمةٌ منسوخة');
const barCss = css.match(/\.support-on \.pill--stars\s*\{[^}]*\}/)?.[0] || '';
ok(/support-on/.test(mainSrc) && /modeOn\(\)/.test(mainSrc.split('paintSupport')[1] || ''),
  'ومعها خطُّ شارة النجوم: صنفُ `support-on` على الجذر يتبع المفتاح الأعلى');
ok(barCss && !/\bcontent:\s*['"]/.test(barCss) && !/#[0-9a-fA-F]{3,6}/.test(barCss),
  'والخطُّ بلون اللوح بلا حرفٍ يُرسَم — يُرى في الجوّال حيث تُبتلَع الحلقةُ العائمة');
ok(/box-shadow/.test(barCss) && !/\b(height|padding|margin|border(-bottom)?:)/.test(barCss),
  'ولا يزحزح تخطيطاً: ظلٌّ داخليّ لا حدٌّ يزيد ارتفاعَ الشارة');
ok(src('parent.js').includes('support.MARK.note'),
  'ولوحةُ وليّ الأمر تذكرها بنصّها من الجدول — فلا يفترق ما يقرؤه عمّا يراه');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «وضع الدعم» ناجحة');
process.exit(fails ? 1 : 0);
