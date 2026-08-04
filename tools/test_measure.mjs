// حارس «لا تدريسَ بلا قياس» (حزمة «قياس العلامات» — الدرس البنيويّ من المراجعة الخارجية):
//   node tools/test_measure.mjs
//
// **العلّة**: فجوةُ العلامات عاشت أربع عشرة حزمةً صامتة. لا لأنّ أحداً أخطأ، بل لأنّ
// **غياب القياس لا يُفشِل اختباراً**: كلُّ حارسٍ يفحص ما كُتب، ولا حارسَ يسأل عمّا لم
// يُكتب. فدرسُ المهارات كان يعلّم الشدّة والتنوين والمدّ ولا يسجّل مهارةً واحدة، وكانت
// كلُّ الاختبارات خضراء — والبوابةُ ولوحةُ وليّ الأمر عمياوان.
//
// وهذا الحارس يقلب القاعدة: **يجرد الرحلةَ نفسَها** نوعَ محطةٍ نوعَ محطة، ويطالب كلَّ
// محطةٍ تدرّس مهارةً بقياسٍ مقابلٍ في ليتنر — فالغيابُ نفسُه صار فشلاً أحمر. ومحطةٌ
// جديدة تدخل الرحلة بلا قياسٍ ولا إعفاءٍ مكتوب **تُسقِط هذا الاختبار يومَ تُضاف**.
//
// وثلاثةُ أبوابٍ يفحصها لكل نوع محطة:
//   ١) **الإعلان**: لكل نوعٍ في الرحلة إمّا أنواعُ قياسٍ، وإمّا إعفاءٌ بسببٍ مكتوب.
//   ٢) **الشيفرة**: الشاشةُ المالكة تكتب فعلاً بذلك النوع (`recordAttempt`)،
//      والمعفاةُ لا تكتب شيئاً.
//   ٣) **المراجعة**: لكل نوع قياسٍ تمرينٌ يراجعه فعلاً — تُبنى منه جلسةٌ حقيقية،
//      وإلا بقيت المهارة في صندوق ليتنر الأول أبداً فكذبت لوحةُ وليّ الأمر.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { SKILLS, contrastPairs, markSkillKey, skillById } = await import(new URL('curriculum.js', APP));
const { buildSession } = await import(new URL('review.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const src = (name) => readFileSync(new URL(name, APP), 'utf8');
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const K = p.KINDS;

// ————— الجرد المُعلَن: نوعُ المحطة ← قياسُها أو سببُ إعفائها —————
//
// **هذا الجدول هو العقد**. مَن أضاف محطةً إلى الرحلة فعليه أن يُدخلها هنا: بقياسٍ
// يملكه، أو بإعفاءٍ يبرّره — ولا ثالث. وليس التعديلُ فيه هروباً من الفشل: كتابةُ
// «هذه المحطة تعلّم ولا تقيس» سطراً صريحاً هي عينُ ما نريده أن يُقرأ في المراجعة.

const STATIONS = {
  letter: {
    title: 'درس الحرف',
    file: 'lesson.js',
    kinds: [K.QUIZ, K.HARAKA],
  },
  words: {
    title: 'لعبة تركيب الكلمات',
    file: 'words.js',
    kinds: [K.BUILD],
  },
  skill: {
    title: 'درس العلامة (مدّ · سكون · شدّة · تنوين · لام)',
    file: 'skill.js',
    kinds: [K.MARK_COMPARE, K.MARK_QUIZ],
  },
  contrast: {
    title: 'محطة «ميّز بين»',
    file: 'contrast.js',
    kinds: [K.CONTRAST],
  },
  roots: {
    title: 'شجرة الجذر',
    file: 'roots.js',
    kinds: [K.ROOT],
  },
  garden: {
    title: 'باقة البستان',
    file: 'garden.js',
    kinds: [K.BUILD],
  },
  ladder: {
    title: 'درجة سلّم الجمل',
    file: 'ladder.js',
    kinds: [K.ORDER],
  },
  // ————— المعفاة بسببٍ مُعلَن —————
  story: {
    title: 'قصة ما بين المجموعات',
    file: 'story.js',
    exempt: 'قراءةٌ لا امتحان: الطفل يقرأ سطوراً بصوته ولا يُحكَم عليه فيها '
      + '(المُقَرّ في الجلسة ٤) — ولا تُقفَل بحكمٍ ولا تُبنى منها مهارة.',
  },
  library: {
    title: 'قصة المكتبة',
    file: 'story.js',
    exempt: 'قراءةٌ لا امتحان (امتداد قرار الجلسة ٤ إلى الحزمة ٩): سؤالُ الفهم '
      + 'شاهدٌ على فهم جملةٍ لا على مهارةِ حرفٍ بعينه، فلا يدخل ليتنر.',
  },
  prophet: {
    title: 'قصة السورة (قصص الأنبياء)',
    file: 'story.js',
    exempt: 'قراءةٌ لا امتحان، امتداداً لقرار الجلسة ٤ وقرارِ الحزمة ٩ إلى قصص '
      + 'المرحلة القرآنية: القصةُ تمهيدٌ لفهم سورتها لا اختبارٌ عليها — يعرف الطفلُ '
      + 'الخبرَ ثم يقرؤه في كلام الله. وسؤالُ فهمها شاهدٌ على جملةٍ لا على مهارةِ '
      + 'حرفٍ بعينه، ومحطتُها لا تُقفَل بإصابةٍ بل بالإتمام كسائر القراءة.',
  },
  quran: {
    title: 'المرحلة القرآنية (وفيها خطوةُ الترديد)',
    file: 'quran.js',
    exempt: 'المصحفُ يُتلى ولا يُمتحَن (METHOD §٥.٦): لا خطأ يُسجَّل على نصّه، '
      + 'والقفلُ فيه تسلسليّ بالإتمام لا بالإصابة. و**خطوةُ الترديد** داخلها معفاةٌ '
      + 'بعينها (حزمة «القرآني الموسّع»، حكم المدير): الترديد تعبّديٌّ تلقينيّ لا '
      + 'يُختبَر آلياً — لا نحكم على لسان طفلٍ يردّد كلام الله بمطابقةِ آلة، ولا '
      + 'مؤقّتَ يقيسه، ولا نجمةَ تُنقَص لبطئه. وتسجيلُه («رتّل وسجّل») يذهب إلى '
      + 'أذن وليّ أمره لا إلى صندوق ليتنر.',
  },
  gate: {
    title: 'بوابة الإتقان',
    file: 'gate.js',
    exempt: 'البوابةُ **تقيس ولا تدرّس**: تمارينُها تمارينُ المراجعة نفسُها '
      + '(`buildSession`)، فتكتب بأنواعِ غيرِها ولا نوعَ لها.',
  },
};

// ————— ١) الإعلان: لا نوعَ محطةٍ في الرحلة خارج الجرد —————

console.log('\n— جرد الرحلة: كل نوع محطةٍ مُعلَن —');
const types = [...new Set(p.allNodes().map((n) => n.type))].sort();
const unknown = types.filter((t) => !STATIONS[t]);
ok(unknown.length === 0,
  `${types.length} نوعَ محطةٍ في الرحلة، كلُّها في الجرد (${types.join('، ')})`
  + (unknown.length ? ` — **خارج الجرد: ${unknown.join('، ')}** (قياساً أو إعفاءً)` : ''));

const stale = Object.keys(STATIONS).filter((t) => !types.includes(t));
ok(stale.length === 0,
  'ولا سطرَ في الجرد لمحطةٍ سقطت من الرحلة'
  + (stale.length ? ` — بائدة: ${stale.join('، ')}` : ''));

const declared = Object.entries(STATIONS).filter(([t]) => types.includes(t));
ok(declared.every(([, s]) => (s.kinds?.length > 0) !== Boolean(s.exempt)),
  'ولكلٍّ قياسُها **أو** إعفاؤها المكتوب — لا الاثنان ولا لا شيء');
ok(declared.filter(([, s]) => s.exempt).every(([, s]) => s.exempt.length > 40),
  'وسببُ الإعفاء جملةٌ تُقرأ لا كلمةٌ تُكتب للمرور');

// ————— ٢) الشيفرة: المالكةُ تكتب فعلاً، والمعفاةُ لا تكتب —————

console.log('\n— الشيفرة: مَن أعلن قياساً كتبه —');
const KIND_CONST = Object.fromEntries(Object.entries(K).map(([name, value]) => [value, name]));
for (const [type, station] of declared) {
  const body = src(station.file);
  if (station.exempt) {
    ok(!/progress\.recordAttempt\s*\(/.test(body),
      `[${type}] ${station.title}: لا تسجّل مهارةً — ${station.exempt.split('(')[0].trim()}`);
    continue;
  }
  const written = station.kinds.filter((kind) =>
    new RegExp(`recordAttempt\\([^;]*KINDS\\.${KIND_CONST[kind]}\\b`, 's').test(body));
  ok(written.length === station.kinds.length,
    `[${type}] ${station.title} تكتب ${station.kinds.join(' و')} في ${station.file}`
    + (written.length < station.kinds.length
      ? ` — **غائب: ${station.kinds.filter((k) => !written.includes(k)).join('، ')}**` : ''));
}

// ولا نوعَ في `KINDS` بلا محطةٍ تكتبه (وإلا فهو قياسٌ لا يقيس شيئاً)
const owned = new Set(declared.flatMap(([, s]) => s.kinds || []));
const orphan = Object.values(K).filter((kind) => !owned.has(kind));
ok(orphan.length === 0,
  `وكلُّ نوعٍ في KINDS تملكه محطةٌ في الرحلة (${Object.values(K).length} نوعاً)`
  + (orphan.length ? ` — يتيم: ${orphan.join('، ')}` : ''));

// ————— ٣) المراجعة: لكل قياسٍ تمرينٌ يراجعه فعلاً —————
//
// **لا مهارةَ تُقاس بلا تمرينٍ يراجعها**: فحصٌ حيّ لا نصيّ — يُبنى لكل نوعٍ مستحقٌّ
// وتُطلَب منه جلسة، فإن لم تُنتج تمرينَه بقيت مهاراتُه في الصندوق الأول أبداً.

console.log('\n— المراجعة: لكل نوع قياسٍ تمرينُه —');
const letters = ['ا', 'ب', 'م', 'ل', 'ن', 'د', 'ر', 'س', 'ت'];
const words = [
  { tiles: ['بَ', 'ا', 'بْ'], say: 'باب', emoji: '🚪' },
  { tiles: ['مَ', 'ا', 'لْ'], say: 'مال', emoji: '💰' },
  { tiles: ['دَ', 'ا', 'رْ'], say: 'دار', emoji: '🏠' },
  { text: 'كِتَابْ' }, { text: 'مَكْتَبْ' }, { text: 'مَكْتَبَةْ' }, { text: 'خُبْزْ' },
];
const sentences = [{
  id: 's1',
  words: ['الْبَابُ', 'مَفْتُوحْ'],
  text: 'الْبَابُ مَفْتُوحْ',
  mechanic: 'order',
  target: { word: 'بَابْ', say: 'باب', emoji: '🚪' },
}];
const pairs = contrastPairs();
const rootId = (await import(new URL('curriculum.js', APP))).ROOTS
  .find((r) => r.members.some((m) => words.some((w) => w.text === m)))?.id;

const DUE = {
  [K.QUIZ]: { letter: 'ب', haraka: 'fatha' },
  [K.HARAKA]: { letter: 'ب', haraka: 'damma' },
  [K.BUILD]: { letter: 'ب', haraka: 'fatha' },
  [K.ORDER]: { letter: 'ب', haraka: 'fatha' },
  [K.CONTRAST]: { letter: pairs[0]?.letters[0], haraka: 'fatha' },
  [K.ROOT]: { letter: `root-${rootId}`, haraka: 'none' },
  [K.MARK_COMPARE]: { letter: markSkillKey('shadda'), haraka: 'none' },
  [K.MARK_QUIZ]: { letter: markSkillKey('shadda'), haraka: 'none' },
};

for (const kind of Object.values(K)) {
  const due = [{ kind, box: 0, wrong: 1, ...DUE[kind] }];
  const built = [1, 5, 11, 23].some((seed) => buildSession({
    letters,
    words,
    sentences,
    pairs,
    marks: [skillById('shadda')],
    due,
    rnd: rng(seed),
  }).some((item) => item.kind === kind));
  ok(built, `[${kind}] مهارةٌ مستحقّة تُنتج تمرينَها في جلسة المراجعة`);
}

// والبوابةُ تُبنى بالمحرّك نفسِه، فما دخل المراجعةَ دخلها
ok(/buildSession/.test(src('gate.js')) && /weakestSkills/.test(src('gate.js')),
  'والبوابةُ تبني بالمحرّك نفسِه من أضعف المهارات — فما يُقاس يُسأل عنه فيها');

// ————— ٤) لوحة وليّ الأمر: لا مهارةَ مقيسةٌ لا يقرؤها الوالد —————
//
// كلُّ نوعٍ إمّا أن يدخل لوحةَ الحروف (وحدتُه حرفٌ × حركة)، وإمّا أن يكون له **قسمُه**
// (العلامةُ والعائلةُ لا حرفَ لهما) — ولا نوعَ يُقاس ثم يختفي من اللوحة كلها.

console.log('\n— لوحة وليّ الأمر: لكل مقيسٍ موضعُه —');
const parentSrc = src('parent.js');
for (const kind of Object.values(K)) {
  const sample = { kind, letter: 'ب', haraka: 'fatha' };
  const inLetters = p.isLetterSkill(sample);
  const section = inLetters ? 'لوحة الحروف'
    : kind === K.ROOT ? 'قسم «عائلات الجذور»' : 'قسم «العلامات»';
  const shown = inLetters
    || (kind === K.ROOT ? /عائلات الجذور/.test(parentSrc) : /العلامات \(/.test(parentSrc));
  ok(shown, `[${kind}] يقرؤه وليُّ الأمر في ${section}`);
}
ok(/markStats\(progress\.skills\(\)\)/.test(parentSrc) && /KINDS\.ROOT/.test(parentSrc),
  'وقسما العلامات والجذور يُبنيان من سجلّ ليتنر نفسِه — لا من عدٍّ ثانٍ يفترق عنه');

// ————— ٥) دروس العلامات الستّة كلُّها مقيسة (لا واحدٌ ينجو) —————

console.log('\n— لا درسَ علامةٍ خارج القياس —');
store.clear();
p.reset();
const unmeasured = SKILLS.filter((skill) => {
  p.recordAttempt(markSkillKey(skill.id), null, K.MARK_QUIZ, true);
  p.recordAttempt(markSkillKey(skill.id), null, K.MARK_COMPARE, true);
  const keys = p.skills().filter((s) => s.letter === markSkillKey(skill.id));
  return keys.length !== 2;
});
ok(unmeasured.length === 0,
  `${SKILLS.length} دروسِ علاماتٍ لكلٍّ مفتاحاه في ليتنر`
  + (unmeasured.length ? ` — بلا قياس: ${unmeasured.map((s) => s.id).join('، ')}` : ''));
ok(p.skills().filter(p.isMarkSkill).length === SKILLS.length * 2,
  `والمجموع ${SKILLS.length * 2} مهارةً للعلامات وحدها`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «لا تدريسَ بلا قياس» ناجحة');
process.exit(fails ? 1 : 0);
