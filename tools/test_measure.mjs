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

const {
  QURAN, SKILLS, contrastPairs, isLetterlessKey, markSkillKey, muqSkillKey, quranLetterSkills,
  rasmSigns, rasmSkillKey, skillById,
} = await import(new URL('curriculum.js', APP));
const SURAHS = QURAN.surahs;
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
  shelf: {
    title: 'قصة رفّ المكتبة (القراءة الطويلة)',
    file: 'story.js',
    exempt: 'قراءةٌ لا امتحان — والإعفاءُ هنا **أوكدُ** منه في قصص البساتين: هذه '
      + 'محطةُ **حجمِ القراءة** نفسِها (reading volume)، وغايتُها أميالٌ تُقطَع لا '
      + 'مهارةٌ تُقاس. وأسئلةُ مقاطعها شواهدُ على فهم مقطعٍ لا على مهارةِ حرفٍ، '
      + 'فلا تدخل ليتنر. و**خطوةُ «اِقْرَأْ لِأُمِّكْ»** داخلها معفاةٌ بعينها كنظيرتِها '
      + 'خطوةِ الترديد: صوتُ الطفل يذهب إلى أذن أمّه لا إلى صندوق ليتنر، ولا مؤقّتَ '
      + 'يقيسه ولا نجمةَ تُنقَص لبطئه. **ووليُّ الأمر يقرأ أثرَها** حيث تُقرأ: '
      + 'في «نحو القراءة الحرة» بلوحته (عدّاداتُ الخفوت) وفي مدد تسجيلاته.',
  },
  // **المرحلة القرآنية محطتان لا محطة** (الحكم ب١، جلسة وز٢): كان إعفاءُ «يُتلى ولا
  // يُمتحَن» يغطّي المرحلة كلَّها — والصادقُ منه **نصُّ المصحف المتلوّ وحدَه**. أمّا
  // الهمزةُ وكلماتٌ إملائية وعلاماتُ رسمٍ وفواتحُ سورٍ فمهاراتُ فكّ شيفرة، فلها قياسُها.
  'quran-drill': {
    title: 'تمارين المرحلة القرآنية (الحرفان · الكلمات · الرسم · الفواتح · كلمات السورة)',
    file: 'quran.js',
    kinds: [K.MARK_COMPARE, K.BUILD, K.RASM, K.MUQ, K.QUIZ],
  },
  quran: {
    title: 'شاشةُ السورة (وفيها خطوةُ الترديد)',
    file: 'quran.js',
    // الإعفاءُ ضيّقٌ بحدّه: يُفحَص **قسمُ شاشة السورة** من الملف وحدَه، فلو كتبت
    // محاولةً على آيةٍ يوماً احمرّ هذا الاختبار — وما قبلها من تمارين يُفحَص بقياسه.
    region: ['export function renderSurah(', '// ————— التوجيه داخل المرحلة —————'],
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
  // **وشاشةٌ تقيس ولا تقع على الرحلة** (ملفّ اللحاق، ١٦ أغسطس ٢٠٢٦): امتحانُ اللحاق
  // ليس محطةً يمرّ بها الطفل، بل بابٌ في لوحة وليّ الأمر — فلا نوعَ عقدةٍ له في
  // `journey()`. ولولا إعلانُه هنا لسقط من جرد «لا تدريسَ بلا قياس» بابَ **الغياب**
  // نفسِه الذي كُتب هذا الحارس له: شاشةٌ تكتب في ليتنر ولا يسأل عنها أحد.
  placement: {
    title: 'امتحان اللحاق (تحديد المستوى، من لوحة وليّ الأمر)',
    file: 'placement.js',
    offJourney: 'ليست محطةً في الرحلة بل بابٌ في لوحة وليّ الأمر — يُفتح باختياره '
      + 'لطفلٍ يصل بمستوىً قائم، ولا يمرّ به سائرُ الأطفال. فيُعلَن هنا لأنه يكتب '
      + 'في ليتنر، ولا يُطلَب له نوعُ عقدةٍ لأنه لا عقدةَ له.',
    exempt: 'الامتحانُ **يقيس ولا يدرّس** — كالبوابة سواءً بسواء: تمارينُه تمارينُ '
      + 'المراجعة نفسُها (`buildSession` ثم `renderSession`)، فيكتب بأنواعِ غيرِها '
      + 'ولا نوعَ له. وكلُّ محاولةٍ فيه تدخل ليتنر قياساً حقيقياً بلا وسمٍ خاصّ، '
      + 'فيقرؤها وليُّ الأمر حيث يقرأ سائرَها — في لوحة الحروف والعلامات.',
  },
};

// ————— ١) الإعلان: لا نوعَ محطةٍ في الرحلة خارج الجرد —————

console.log('\n— جرد الرحلة: كل نوع محطةٍ مُعلَن —');

// عقدُ المرحلة القرآنية نوعُها واحد وحكمُها اثنان: ما يُتلى (السورة) وما يُدرَّس
// ويُقاس (ما عداها) — فيُفرَّق بينهما هنا كما يفرّق بينهما الإعفاء.
const SURAH_IDS = new Set(SURAHS.map((s) => `quran:${s.id}`));
const typeOf = (node) =>
  (node.type === 'quran' && !SURAH_IDS.has(node.id) ? 'quran-drill' : node.type);

const types = [...new Set(p.allNodes().map(typeOf))].sort();
const unknown = types.filter((t) => !STATIONS[t]);
ok(unknown.length === 0,
  `${types.length} نوعَ محطةٍ في الرحلة، كلُّها في الجرد (${types.join('، ')})`
  + (unknown.length ? ` — **خارج الجرد: ${unknown.join('، ')}** (قياساً أو إعفاءً)` : ''));

// **وما ليس محطةً يُعلَن كذلك** (`offJourney`): شاشةٌ تكتب في ليتنر ولا تقع على
// الرحلة (امتحانُ اللحاق) — تدخل الجردَ بسببها المكتوب ولا تُطالَب بنوع عقدة.
const offJourney = Object.entries(STATIONS).filter(([, s]) => s.offJourney);
const stale = Object.keys(STATIONS)
  .filter((t) => !types.includes(t) && !STATIONS[t].offJourney);
ok(stale.length === 0,
  'ولا سطرَ في الجرد لمحطةٍ سقطت من الرحلة'
  + (stale.length ? ` — بائدة: ${stale.join('، ')}` : ''));

// والإعلانُ خارج الرحلة **يُثبَت خارجَها**: فلو صار له نوعُ عقدةٍ يوماً لزم أن
// يُراجَع سطرُه هنا (قياساً أو إعفاءَ محطةٍ)، لا أن يمرّ بعذرٍ لم يعد صادقاً.
ok(offJourney.every(([t, s]) => !types.includes(t) && s.offJourney.length > 40),
  `وما أُعلن خارجَ الرحلة (${offJourney.map(([t]) => t).join('، ') || 'لا شيء'}) `
  + 'ليس له نوعُ عقدةٍ فيها فعلاً، وسببُ خروجه جملةٌ تُقرأ');

const declared = Object.entries(STATIONS)
  .filter(([t, s]) => types.includes(t) || s.offJourney);
ok(declared.every(([, s]) => (s.kinds?.length > 0) !== Boolean(s.exempt)),
  'ولكلٍّ قياسُها **أو** إعفاؤها المكتوب — لا الاثنان ولا لا شيء');
ok(declared.filter(([, s]) => s.exempt).every(([, s]) => s.exempt.length > 40),
  'وسببُ الإعفاء جملةٌ تُقرأ لا كلمةٌ تُكتب للمرور');

// ————— ٢) الشيفرة: المالكةُ تكتب فعلاً، والمعفاةُ لا تكتب —————

console.log('\n— الشيفرة: مَن أعلن قياساً كتبه —');
const KIND_CONST = Object.fromEntries(Object.entries(K).map(([name, value]) => [value, name]));
for (const [type, station] of declared) {
  const whole = src(station.file);
  // الإعفاءُ قد يكون لقسمٍ من ملفٍ لا لملفٍ كامل (شاشةُ السورة في `quran.js`)
  const body = station.region
    ? whole.slice(whole.indexOf(station.region[0]), whole.indexOf(station.region[1]))
    : whole;
  if (station.exempt) {
    ok(station.region ? body.length > 200 : true,
      `[${type}] حدُّ الإعفاء موجودٌ في ${station.file}${station.region ? ` (${station.region[0]}…)` : ''}`);
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

const signs = rasmSigns();
const muq = QURAN.muqattaat.items;

const DUE = {
  [K.QUIZ]: { letter: 'ب', haraka: 'fatha' },
  [K.HARAKA]: { letter: 'ب', haraka: 'damma' },
  [K.BUILD]: { letter: 'ب', haraka: 'fatha' },
  [K.ORDER]: { letter: 'ب', haraka: 'fatha' },
  [K.CONTRAST]: { letter: pairs[0]?.letters[0], haraka: 'fatha' },
  [K.ROOT]: { letter: `root-${rootId}`, haraka: 'none' },
  [K.MARK_COMPARE]: { letter: markSkillKey('shadda'), haraka: 'none' },
  [K.MARK_QUIZ]: { letter: markSkillKey('shadda'), haraka: 'none' },
  [K.RASM]: { letter: rasmSkillKey(signs[0].sign), haraka: 'none' },
  [K.MUQ]: { letter: muqSkillKey(muq[0].read), haraka: 'none' },
};

const session = (due, seed) => buildSession({
  letters,
  words,
  sentences,
  pairs,
  marks: [skillById('shadda'), ...quranLetterSkills()],
  signs,
  muq,
  due,
  rnd: rng(seed),
});

// **والمستحقُّ أولُ الجلسة لا في حشوها**: حوضُ التنويع قد يُنتج النوعَ نفسَه صدفةً
// فيستر انقطاعَ مسار المستحقّ — والمهارةُ الضعيفة بعينها تبقى في الصندوق الأول أبداً.
// فيُطلَب أن يكون **أولُ التمارين** تمرينَ المستحقّ (وبمفتاحه إن كان لا حرفَ له).
// مفتاحُ التمرين في ليتنر كما تكتبه شاشتُه (والعائلةُ تركّبه من شجرتها لا من حقلٍ)
const keyOf = (item) => item?.letter ?? (item?.root ? `root-${item.root.id}` : null);

for (const kind of Object.values(K)) {
  const due = [{ kind, box: 0, wrong: 1, ...DUE[kind] }];
  const keyed = isLetterlessKey(DUE[kind].letter);
  const built = [1, 5, 11, 23].some((seed) => {
    const first = session(due, seed)[0];
    return first?.kind === kind && (!keyed || keyOf(first) === DUE[kind].letter);
  });
  ok(built, `[${kind}] مهارةٌ مستحقّة تُنتج تمرينَها **أولَ** جلسة المراجعة`);
}

// **وحرفا المرحلة القرآنية بمفتاحيهما**: النوعُ وحده لا يكفي — `mark-compare` يُنتَج
// من درس الشدّة، فلو بقي `mark-hamza` بلا تمرينٍ لظلّ في الصندوق الأول أبداً.
for (const sign of quranLetterSkills()) {
  const due = [{ kind: K.MARK_COMPARE, letter: markSkillKey(sign.id), haraka: 'none', box: 0, wrong: 1 }];
  const built = [1, 5, 11, 23].some((seed) => keyOf(session(due, seed)[0]) === markSkillKey(sign.id));
  ok(built, `[mark-${sign.id}] ${sign.title}: مهارتُها تُنتج تمرينَها في المراجعة`);
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
// **بمفاتيحها الحقيقية لا بحرفٍ متخيَّل**: الفصلُ بسابقة المفتاح (`isLetterlessKey`)،
// فعيّنةٌ مفتاحُها «ب» تدّعي أنّ كلّ نوعٍ يدخل لوحةَ الحروف — وتُخفي الغياب.
const SECTION = {
  [K.ROOT]: [/عائلات الجذور/, 'قسم «عائلات الجذور»'],
  [K.MARK_COMPARE]: [/العلامات \(/, 'قسم «العلامات»'],
  [K.MARK_QUIZ]: [/العلامات \(/, 'قسم «العلامات»'],
  [K.RASM]: [/رسمُ المصحف \(/, 'قسم «رسمُ المصحف»'],
  [K.MUQ]: [/رسمُ المصحف \(/, 'قسم «رسمُ المصحف»'],
};

for (const kind of Object.values(K)) {
  const sample = { kind, ...DUE[kind] };
  const inLetters = p.isLetterSkill(sample);
  const [pattern, name] = SECTION[kind] || [];
  ok(inLetters ? !pattern : Boolean(pattern) && pattern.test(parentSrc),
    `[${kind}] يقرؤه وليُّ الأمر في ${inLetters ? 'لوحة الحروف' : name || '**لا موضعَ له**'}`);
}
ok(/quranStats\(progress\.skills\(\)\)/.test(parentSrc),
  'وقسمُ المرحلة القرآنية يُبنى من سجلّ ليتنر نفسِه');
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
