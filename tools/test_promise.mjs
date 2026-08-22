// **حارسُ وقوع الوعد — طفلٌ يُحاكى يوماً بيوم** (الجلسة ع١):
//   node tools/test_promise.mjs [--days N] [--seed N] [--trace] [--self-test]
//
// ————— لماذا حارسٌ ثانٍ وثلاثون، وما الذي لا يمسكه الواحدُ والثلاثون قبله —————
//
// حرّاسُنا كلُّهم يحرسون **الحال**: `test_measure` يطالب كلَّ محطةٍ بقياسٍ في ليتنر،
// و`test_gate` يصنع حالَ بوابةٍ بيده فيشهد أنها تُفتح وتُغلق، و`test_quran` يقايس
// عقدَ المرحلة بمسطَّحها. وثلاثتُهم يسألون: «أهذه اللحظةُ سليمة؟» — ولا أحدَ منهم
// يسأل: **«أيقع وعدُنا في مجرى الأيام؟»**
//
// والوعدُ المعلَن للناس في `app/welcome/` — ميتا الرئيسة «من الحرف الأول إلى
// القرآن»، وصدرُها «حتى يقرأ المصحف بنفسه»، وسطرا الدقائق — **لا حارسَ يشهد
// بوقوعه**. فهذا الحارسُ يمشي الرحلةَ بترتيبها الحقيقيّ (`progress.journey()`)،
// بسقف يومٍ منصوصٍ في التعريفية، وبمواعيد ليتنر كما هي (`BOX_DAYS`) — فالمهارةُ
// لا تنضج إلا في **أيامٍ** لا في جلسة — ثم يطبع رقمين ويقايسهما بنصّ الوعد.
//
// ————— وطفلُنا مثاليٌّ عن قصد: **أرضيةٌ لا وعد** —————
//
// يصيب كلَّ جولةٍ من أوّلها، ويجلس جلسةً واحدة كلَّ يوم بلا غياب. وذلك **أضيقُ
// الحالات على الرحلة لا أوسعُها**: الإصابةُ تُصعِّد صناديقَ ليتنر بأسرع ما يمكن،
// فتقع الأيامُ المطبوعة **أدنى ما يمكن أن تقع**. ورحلةُ طفلٍ حقيقيّ أطول، ولا
// يُقرأ رقمُنا وعداً — وهذا مكتوبٌ في الخرج نصّاً لا في تعليقٍ داخليّ، لأنّ
// الاعترافَ في التعليق لا يبلغ مَن يُرفَع إليه الرقم (سنّةُ اِسْمَعْ بنصّها).
//
// ————— ولا يُعيد كتابةَ قواعدنا: يستوردها —————
//
// الرحلةُ من `progress.journey()`، وجولاتُ كلِّ محطةٍ من **مُنشئات شاشتها الخالصة**
// أنفسِها (`lesson.buildRounds` · `words.buildBoard` · `skill.buildMarkRounds` ·
// `contrast.buildContrastRounds` · `roots.buildRootRounds` · `screens.buildReadRounds`
// · `quran.buildRasmRounds`/`buildMuqRounds`/`buildFindRounds`)، وتمارينُ المراجعة
// والبوابة من `review.buildSession` و`gate.gateItems`، ومفاتيحُ محطات المجموعات من
// `placement.skillKeys` — **لا قاعدةَ تُنسخ هنا فتفترق غداً**.
//
// **ولا يمسّ التطبيق بحرف**: قراءةٌ فقط على `app/`، وصفرُ صوتٍ وصفرُ نصٍّ منطوق.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);
const WELCOME = new URL('../app/welcome/', import.meta.url);

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const TRACE = args.includes('--trace');
const SELF = args.includes('--self-test');

// **حتميّةٌ ببذرةٍ معلَنة**: لا `Math.random` عارٍ في هذا الملف ولا فيما يُستدعى منه
// — كلُّ مُنشئٍ يأخذ `rnd`، فلا يرمش الحارسُ بين تشغيلين. والبذرةُ تُطبع مع الرقم.
const SEED = flag('seed', 20260819);
const MAX_DAYS = flag('days', 900);        // سقفُ أمانٍ لا نموذج: رحلةٌ لا تنتهي دونه عيب

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const p = await import(new URL('progress.js', APP));
const c = await import(new URL('curriculum.js', APP));
const review = await import(new URL('review.js', APP));
const gate = await import(new URL('gate.js', APP));
const placement = await import(new URL('placement.js', APP));
const support = await import(new URL('support.js', APP));
const lessonScr = await import(new URL('lesson.js', APP));
const wordsScr = await import(new URL('words.js', APP));
const skillScr = await import(new URL('skill.js', APP));
const contrastScr = await import(new URL('contrast.js', APP));
const rootsScr = await import(new URL('roots.js', APP));
const gardenScr = await import(new URL('garden.js', APP));
const quranScr = await import(new URL('quran.js', APP));
const screens = await import(new URL('screens.js', APP));
const sentencesScr = await import(new URL('sentences.js', APP));

const K = p.KINDS;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const num = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const keyOf = (k) => p.skillKey(k.letter, k.haraka, k.kind);

// ————— ١) نموذجُ الطفل وسقفُ يومه — **بمصادرها المكتوبة** —————
//
// **سقفُ اليوم ١٥ دقيقة**: التعريفيةُ تقول في `guide.html` «الحصة الجيدة **درس أو
// درسان ومراجعة اليوم**، لا جلسة طويلة» و«**ثلاث إلى خمس دقائق للدرس الواحد**» —
// فخمسٌ للمراجعة وخمسٌ لكلِّ درسٍ من درسين. **وسقفُ المحطات درسان** كذلك بنصّه،
// فلا يكفي سقفُ الدقائق وحدَه: طفلٌ يُنهي ثلاثَ محطاتٍ قصيرة في خمس عشرة دقيقة
// يخرق «درس أو درسان» وإن لم يخرق الدقائق.
const DAY_MINUTES = 15;
const DAY_STATIONS = 2;

// **والكلفةُ تُسعَّر بالمحتوى لا بثابتٍ واحد لكل محطة** (عبرةُ حسم اِسْمَعْ أ-٥):
// باقةُ بستانٍ بخمس كلماتٍ ذاتِ ثلاثة مقاطع ليست كدرسِ علامةٍ بجولتين. فثلاثةُ أصولٍ
// معلَنة، **ومعايرتُها على نصّ المنهج** (`METHOD.md §٤`: «حلقة الدرس ٣–٥ دقائق لكل
// حرف») — يفحصها الحارسُ نفسُه أدناه، فمن غيّر رقماً منها أحمرَّ عليه المعيار:
const VISIT_MINUTES = 1;      // الزيارة: الفتحُ والطقسُ المنطوق والاحتفال والانتقال
const CARD_MINUTES = 0.15;    // بطاقةٌ تُعرَض وتُنقَر لتُسمَع في خطوة التعليم
const ROUND_MINUTES = 0.5;    // جولةٌ محكومة: سؤالٌ فاختيارٌ فتغذيةٌ راجعة
// **وسطرُ القراءة قرارٌ معلَن بلا مصدرٍ مكتوب** (يُرفَع في التقرير): صفحةُ قصةٍ من
// ٣–٨ كلماتٍ يقرؤها طفلُ السادسة بصوته، أو آيةٌ يسمعها ويردّدها — أربعٌ وعشرون ثانية.
const LINE_MINUTES = 0.4;

// **حدُّ الانتظار مشتقٌّ لا مكتوب**: أطولُ موعدٍ في سلّم ليتنر — فوقفةُ عقدةٍ تنتظر
// نضجَ مادّتها دون ذلك مشروعة، وما جاوزته لا يفسّره نضجُ مهارةٍ فهو ثقبُ قفل.
const WAIT_LIMIT = p.BOX_DAYS[p.BOX_DAYS.length - 1];
// **وحدُّ أوّل قياسٍ دورةُ ليتنر كاملةً**: مجموعُ مواعيد صناديقها من أوّلها إلى آخرها
// — مفتاحٌ فُتح ولم يُقَس في زمنِ صعودِ الصندوق كلِّه لم يدخل الجدولَ أصلاً.
const FIRST_MEASURE_LIMIT = p.BOX_DAYS.reduce((a, b) => a + b, 0);
// **وحدُّ استفراد الصنف النصفُ**: عشرةُ أصنافٍ في حوض التنويع، فما جاوز نصفَه ابتلعه.
const FILLER_CEILING = 0.5;
// وكم يوماً بين مسبارٍ ومسبار (ثقلُ البناء لا يُنفَق يومياً على قياسِ نسبة)
const PROBE_EVERY = 3;

// ————— ٢) الجرد: نوعُ المحطة ← مفاتيحُها المُعلَنة أو إعفاؤها —————
//
// **هذا الجدول هو العقد** (نظيرُ `STATIONS` في `test_measure.mjs`): مَن أضاف نوعَ
// محطةٍ إلى الرحلة فعليه أن يُدخله هنا — بمفاتيحَ يُعلنها، أو بإعفاءٍ يبرّره. ومنه
// يُعرَف **متى يُفتح المفتاح**: يومَ تُلعَب المحطةُ التي تُعلنه.
//
// ومحطاتُ المجموعات الأربع تُعلن مفاتيحَها **بـ`placement.skillKeys` نفسِها** — هي
// إعلانُ التطبيق لمفاتيح تلك المحطات (تمتحن بها بوابةُ اللحاق قبل أن تفتحها)، فلا
// يُكتب هنا جردٌ ثانٍ يفترق عنه غداً.
const stationRung = (node) => ({ group: p.findGroup(node.groupId), nodes: [node] });

const OPENS = {
  letter: {
    title: 'درس الحرف',
    keys: (n) => placement.skillKeys(stationRung(n)),
  },
  words: {
    title: 'لعبة تركيب الكلمات',
    keys: (n) => placement.skillKeys(stationRung(n)),
  },
  skill: {
    title: 'درس العلامة',
    keys: (n) => placement.skillKeys(stationRung(n)),
  },
  contrast: {
    title: 'محطة «ميّز بين»',
    keys: (n) => placement.skillKeys(stationRung(n)),
  },
  roots: {
    title: 'شجرة الجذر',
    keys: (n) => [{ letter: rootsScr.skillKeyOf(n.root.id), haraka: null, kind: K.ROOT }],
  },
  garden: {
    title: 'باقة البستان',
    keys: (n) => n.bundle.words.flatMap((w) => (w.tiles || [])
      .map((t) => ({ ...c.syllableSkill(t), kind: K.BUILD }))).filter((k) => k.letter),
  },
  ladder: {
    title: 'درجة سلّم الجمل',
    keys: (n) => n.rung.sentences.filter((s) => s.mechanic === 'order')
      .flatMap((s) => s.words.map((w) => ({ ...c.wordSkill(w), kind: K.ORDER })))
      .filter((k) => k.letter),
  },
  'quran-drill': {
    title: 'تمارين المرحلة القرآنية',
    keys: (n) => quranKeys(n.part),
  },
  // ————— المعفاةُ بسببٍ مكتوب (وهي إعفاءاتُ `test_measure.mjs` أنفسُها) —————
  quran: {
    title: 'شاشةُ السورة',
    exempt: 'المصحفُ يُتلى ولا يُمتحَن (METHOD §٥.٦): لا خطأ يُسجَّل على نصّه، '
      + 'وخطوةُ الترديد تعبّديةٌ لا تُختبَر آلياً — فلا مفتاحَ لها يُفتح ولا يُقاس.',
  },
  story: {
    title: 'قصة ما بين المجموعات',
    exempt: 'قراءةٌ لا امتحان (قرار الجلسة ٤): تُقرأ ولا يُحكَم على الطفل فيها، '
      + 'وسؤالُ فهمها شاهدٌ على جملةٍ لا على مهارةِ حرف — فلا مفتاحَ فيها.',
  },
  library: {
    title: 'قصة المكتبة',
    exempt: 'قراءةٌ لا امتحان (امتداد قرار الجلسة ٤ إلى الحزمة ٩) — سؤالُ الفهم '
      + 'شاهدٌ على فهم جملةٍ لا على مهارةِ حرفٍ بعينه، فلا يدخل ليتنر.',
  },
  prophet: {
    title: 'قصة السورة',
    exempt: 'قراءةٌ لا امتحان: القصةُ تمهيدٌ لفهم سورتها لا اختبارٌ عليها، '
      + 'ومحطتُها تُقفَل بالإتمام لا بالإصابة.',
  },
  shelf: {
    title: 'قصة رفّ المكتبة',
    exempt: 'قراءةٌ لا امتحان — وهي محطةُ **حجمِ القراءة** نفسِها: غايتُها أميالٌ '
      + 'تُقطَع لا مهارةٌ تُقاس، وأسئلةُ مقاطعها شواهدُ فهمٍ لا مفاتيحُ ليتنر.',
  },
  gate: {
    title: 'بوابة الإتقان',
    exempt: 'البوابةُ **تقيس ولا تدرّس**: تمارينُها تمارينُ المراجعة نفسُها، فتكتب '
      + 'بمفاتيح غيرِها ولا مفتاحَ لها تفتحه — ولذلك تُلعَب هنا بمحرّكها لا بخطّة.',
  },
};

/** مفاتيحُ جزءٍ من المرحلة القرآنية — كما تكتبها شاشتُه في `quran.js` حرفاً. */
function quranKeys(part) {
  if (part === c.QURAN.letters.id) {
    return c.QURAN.letters.signs
      .map((s) => ({ letter: c.markSkillKey(s.id), haraka: null, kind: K.MARK_COMPARE }));
  }
  const level = c.quranWordLevel(part);
  if (level) {
    return level.items.map((i) => ({ ...c.wordSkill(i.read), kind: K.BUILD })).filter((k) => k.letter);
  }
  const rasm = c.rasmLessonById(part);
  if (rasm) return rasm.signs.map((s) => ({ letter: c.rasmSkillKey(s.sign), haraka: null, kind: K.RASM }));
  if (part === c.QURAN.muqattaat.id) {
    return c.QURAN.muqattaat.items.map((i) => ({ letter: c.muqSkillKey(i.read), haraka: null, kind: K.MUQ }));
  }
  const surah = c.surahOfWordsPart(part);
  if (surah) {
    return c.surahWords(surah)
      .map((w) => ({ ...(mushafSkill(w.text) || {}), kind: K.QUIZ })).filter((k) => k.letter);
  }
  return [];
}

// **مهارةُ الكلمة العثمانية** — سطرُ `quran.js` نفسُه (`mushafSkill` خاصٌّ بملفّه):
// حرفا المرحلة يُنزَعان أوّلاً، ثم أوّلُ حرفٍ متحرّكٍ من حروف المجموعات.
const mushafSkill = (text) =>
  c.wordSkill([...String(text)].filter((ch) => !c.QURAN_LETTERS.has(ch)).join(''));

// عقدُ المرحلة القرآنية نوعُها واحد وحكمُها اثنان (كما يفرّق `test_measure`):
// ما يُتلى (السورة) وما يُدرَّس ويُقاس (ما عداها).
const SURAH_IDS = new Set(c.QURAN.surahs.map((s) => `quran:${s.id}`));
const typeOf = (node) => (node.type === 'quran' && !SURAH_IDS.has(node.id) ? 'quran-drill' : node.type);

// ————— ٣) خطةُ المحطة: بطاقاتُها وسطورُها وجولاتُها —————
//
// **تُبنى بمُنشئات الشاشة أنفسِها** لا بنسخةٍ عنها. وكلُّ جولةٍ تحمل ما **يراه**
// الطفلُ فيها (`seen`) وما **يسمعه** (`heard`) ولوحَها إن كانت لوحاً (`board`) —
// وبها يعمل السورُ الرابع؛ ومفتاحَها إن كانت مقيسة (`key`).

const R = (key, seen = null, heard = null) => ({ key, seen, heard });

function planOf(node, rnd) {
  switch (node.type) {
    case 'letter': {
      const studied = c.lettersThrough(node.groupId, node.letter);
      const quiz = lessonScr.buildRounds(studied, node.letter, rnd);
      // بطاقاتُ «اسمع وشاهد»: اسمُه وصوتُه وأشكالُه الأربعة وكلمةُ مثاله، ثم بطاقاتُ
      // الحركات الثلاث في خطوتها.
      const cards = 2 + 4 + c.HARAKAT.length + (c.exampleWordFor(node.groupId, node.letter) ? 1 : 0);
      return {
        cards,
        lines: 0,
        rounds: [
          // **خطوةُ الحركات تُشتقّ من `harakaRounds` نفسِها** (تصحيحُ المدير، ٢٢ أغسطس ٢٠٢٦:
          // كان السطرُ يكتب جولةً واحدة على الفتحة بيدٍ — صورةَ العيب القديم لا اشتقاقاً —
          // فلمّا أُصلح الدرسُ في ع٢ بقي القاضي يحاكم بذاكرة الأمس. **نموذجُ الحارس يُشتقّ
          // من المُنشئ كسائر خطواته ولا يُكتب بيد** — وهو عينُ قاعدته على الآخرين.)
          // الذيلُ زرَّ «تابع» (`harakaTarget(0, …)` = أوّلُ الحركات) — لا تُخمَّن.
          ...lessonScr.harakaRounds(c.HARAKAT, rnd).map((kk) => R(
            { letter: node.letter, haraka: kk.key, kind: K.HARAKA },
            c.HARAKAT.map((k) => c.harakaText(node.letter, k.mark)))),
          ...quiz.map((r) => R(
            { letter: r.target, haraka: c.HARAKA_BY_MARK[r.mark], kind: K.QUIZ },
            r.options.map((ch) => c.harakaText(ch, r.mark)))),
        ],
      };
    }
    case 'words': {
      const group = p.findGroup(node.groupId);
      const pool = wordsScr.syllablePool(group.id);
      const rounds = [];
      for (const word of group.words) {
        const board = wordsScr.buildBoard(word, pool, rnd);
        for (const tile of word.tiles) {
          const skill = c.syllableSkill(tile);
          rounds.push({ ...R(skill && { ...skill, kind: K.BUILD }), board });
        }
      }
      return { cards: group.words.length, lines: 0, rounds };
    }
    case 'skill': {
      const key = { letter: c.markSkillKey(node.skill.id), haraka: null };
      const marks = skillScr.buildMarkRounds(node.skill, rnd);
      const quiz = skillScr.buildSkillRounds(node.skill, rnd);
      return {
        cards: c.skillExamples(node.skill).length + (node.skill.compare?.pairs || []).length,
        lines: 0,
        rounds: [
          ...marks.map((r) => R({ ...key, kind: K.MARK_COMPARE }, r.options)),
          ...quiz.map((r) => R({ ...key, kind: K.MARK_QUIZ }, r.options, r.options)),
        ],
      };
    }
    case 'contrast': {
      const rounds = contrastScr.buildContrastRounds(node.contrast, rnd);
      return {
        cards: (node.contrast.pairs || []).flatMap((pair) => pair.letters).length,
        lines: 0,
        rounds: rounds.map((r) => R(
          { letter: r.letter, haraka: r.haraka, kind: K.CONTRAST },
          r.options.map((ch) => ch + r.mark), r.options.map((ch) => ch + r.mark))),
      };
    }
    case 'roots': {
      const studied = p.studiedWords().map((w) => w.text ?? w.read ?? (w.tiles || []).join(''));
      const branches = rootsScr.branchesOf(node.root, studied);
      const outsiders = [...new Set(studied)].filter((w) => !node.root.members.includes(w));
      const rounds = rootsScr.buildRootRounds(node.root, branches, outsiders, rnd);
      const key = { letter: rootsScr.skillKeyOf(node.root.id), haraka: null, kind: K.ROOT };
      return { cards: branches.length, lines: 0, rounds: rounds.map((r) => R(key, r.options)) };
    }
    case 'garden': {
      const pool = gardenScr.bundlePool(node.bundle);
      const rounds = screens.buildReadRounds(node.bundle.words, rnd)
        .map((r) => R(null, r.options.map((w) => w.read)));   // «اقرأ واختر» يخفت ولا يُقاس
      for (const word of node.bundle.words) {
        const board = wordsScr.buildBoard(word, pool, rnd);
        for (const tile of word.tiles) {
          const skill = c.syllableSkill(tile);
          rounds.push({ ...R(skill && { ...skill, kind: K.BUILD }), board });
        }
      }
      return { cards: node.bundle.words.length, lines: 0, rounds };
    }
    case 'ladder': {
      const pool = sentencesScr.orderPool(node.garden);
      const rounds = [];
      for (const sentence of node.rung.sentences) {
        if (sentence.mechanic !== 'order') {
          // «اقرأ ونفّذ» و«أكمل الجملة»: اختيارٌ بلا قياس (قاعدةُ الشاهد الواحد)
          rounds.push({ ...R(null), pics: sentencesScr.optionPool(sentence).map((w) => w.emoji) });
          continue;
        }
        const board = wordsScr.buildBoard({ tiles: sentence.words }, pool, rnd);
        for (const word of sentence.words) {
          const skill = c.wordSkill(word);
          rounds.push({ ...R(skill && { ...skill, kind: K.ORDER }), board });
        }
      }
      return { cards: 0, lines: node.rung.sentences.length, rounds };
    }
    case 'quran': return quranPlan(node.part, rnd);
    case 'story': {
      const ask = c.storyAsk(node.story);
      return {
        cards: 0,
        lines: node.story.sentences.length,
        rounds: ask ? [{ ...R(null, ask.options.map((w) => w.word)), pics: ask.options.map((w) => w.emoji) }] : [],
      };
    }
    case 'library': case 'prophet': case 'shelf':
      return {
        cards: 0,
        lines: node.story.pages.length,
        rounds: (node.story.questions || []).map((q) => ({
          ...R(null, q.options.map((w) => w.word)), pics: q.options.map((w) => w.emoji),
        })),
      };
    default: return null;
  }
}

function quranPlan(part, rnd) {
  if (part === c.QURAN.letters.id) {
    const words = c.QURAN.letters.signs.flatMap((s) => s.words);
    const signOf = (w) => c.QURAN.letters.signs.find((s) => s.words.includes(w));
    return {
      cards: words.length + c.QURAN.letters.signs.length,
      lines: 0,
      rounds: screens.buildReadRounds(words, rnd).map((r) => R(
        { letter: c.markSkillKey(signOf(r.target).id), haraka: null, kind: K.MARK_COMPARE },
        r.options.map((w) => w.read))),
    };
  }
  const level = c.quranWordLevel(part);
  if (level) {
    return {
      cards: level.items.length,
      lines: 0,
      rounds: screens.buildReadRounds(level.items, rnd).map((r) => R(
        { ...c.wordSkill(r.target.read), kind: K.BUILD }, r.options.map((w) => w.read))),
    };
  }
  const rasm = c.rasmLessonById(part);
  if (rasm) {
    // حوضُ المشتّتات كما تكتبه الشاشة حرفاً: علاماتُ درسه وما أتمّه من دروسٍ قبله
    const pool = [...rasm.signs, ...p.studiedRasm()];
    return {
      cards: rasm.signs.length,
      lines: 0,
      rounds: quranScr.buildRasmRounds(rasm.signs, pool, rnd).map((r) => R(
        { letter: c.rasmSkillKey(r.target.sign), haraka: null, kind: K.RASM },
        r.options.map((s) => s.sign))),
    };
  }
  if (part === c.QURAN.muqattaat.id) {
    const items = c.QURAN.muqattaat.items;
    return {
      cards: items.length,
      lines: 0,
      rounds: quranScr.buildMuqRounds(items, rnd).map((r) => R(
        { letter: c.muqSkillKey(r.target.read), haraka: null, kind: K.MUQ },
        r.options.map((i) => i.read), r.options.map((i) => c.muqSays(i).join(' ')))),
    };
  }
  const surah = c.surahOfWordsPart(part);
  if (surah) {
    const words = c.surahWords(surah);
    return {
      cards: words.length,
      lines: 0,
      // «جِدْها في الآية»: الخياراتُ كلماتُ الآية نفسِها (نصُّ مصحفٍ لا يُقاس تطابقُه
      // هنا — الكلمةُ قد تتكرّر في الآية وكلُّ موضعٍ لها صواب، وذلك مكتوبٌ في الشاشة)
      rounds: quranScr.buildFindRounds(words, undefined, rnd)
        .map((r) => R({ ...(mushafSkill(r.text) || {}), kind: K.QUIZ })),
    };
  }
  const s = c.surahById(part);
  return { cards: 0, lines: s ? [c.QURAN.basmala, ...s.ayat].length : 0, rounds: [] };
}

const stationMinutes = (plan) =>
  VISIT_MINUTES + plan.cards * CARD_MINUTES + plan.lines * LINE_MINUTES
  + plan.rounds.length * ROUND_MINUTES;
const sessionMinutes = (items) => VISIT_MINUTES + items * ROUND_MINUTES;

// ————— ٤) المحاكاة: يومُ الطفل — مراجعةٌ ثم محطةٌ أو محطتان —————

/** حصيلةُ الطفل الآن كما تقرؤها شاشتا المراجعة والبوابة. */
function stock() {
  const letters = p.studiedLetters();
  return {
    letters,
    words: p.studiedWords(letters),
    sentences: p.studiedSentences().filter((s) => s.mechanic === 'order'),
    pairs: review.studiedPairs(letters),
    marks: p.studiedMarks(),
    signs: p.studiedRasm(),
    muq: p.studiedMuqattaat(),
  };
}

/** ما يراه الطفل في تمرين مراجعةٍ خياراً خياراً — كما تصيّره `renderSession`. */
function itemSeen(item) {
  if (item.kind === K.ROOT) return item.options;
  if (item.kind === K.RASM) return item.options.map((s) => s.sign);
  if (item.kind === K.MUQ) return item.options.map((i) => i.read);
  // **بالوصل الخام كما تكتبه الشاشة** (`ch + item.mark` في `quizView`/`contrastView`
  // و`item.letter + k.mark` في `harakaView`) لا بـ`harakaText`: ذاك رسمُ الدرس.
  if (item.kind === K.HARAKA) return item.options.map((k) => item.letter + k.mark);
  if (item.kind === K.QUIZ || item.kind === K.CONTRAST) return item.options.map((ch) => ch + item.mark);
  if (item.kind === K.BUILD || item.kind === K.ORDER) return null;   // لوحٌ لا قائمةَ خيارات
  return item.options;
}

/** جولاتُ تمرين مراجعةٍ واحد — بمفاتيحها كما يكتبها محرّك الجلسة (`score`). */
function itemRounds(item) {
  if (item.kind === K.BUILD) {
    return item.word.tiles.map((tile) => {
      const skill = c.syllableSkill(tile) || {};
      return { ...R({ letter: skill.letter, haraka: skill.haraka, kind: K.BUILD }), board: item.board };
    });
  }
  if (item.kind === K.ORDER) {
    return item.sentence.words.map((word) => {
      const skill = c.wordSkill(word) || {};
      return { ...R({ letter: skill.letter, haraka: skill.haraka, kind: K.ORDER }), board: item.board };
    });
  }
  const letter = item.kind === K.ROOT ? `root-${item.root.id}` : item.letter;
  return [R({ letter, haraka: item.haraka, kind: item.kind }, itemSeen(item), itemHeard(item))];
}
/**
 * وما يسمعه **خياراً خياراً**: الفواتحُ أسماءَ حروف كلِّ مجموعةٍ مضمومةً (لا مسطَّحةً
 * — مجموعتان تشتركان في اسمِ حرفٍ ليستا خيارَين متطابقين)، والعلامةُ نصَّ ما ينقره.
 * وما عداهما سؤالُه صوتٌ واحد لا صوتٌ لكل خيار، فلا قائمةَ له.
 */
const itemHeard = (item) => {
  if (item.kind === K.MUQ) return item.options.map((i) => c.muqSays(i).join(' '));
  if (item.kind === K.MARK_QUIZ) return [...item.options];
  return null;
};

/**
 * **السورُ الرابع لحظةَ البناء**: لا خياران يتطابقان فيما يراه الطفل أو يسمعه أو
 * في صورةٍ يختارها. واللوحُ حكمُه غيرُ حكم القائمة: بلاطتان متماثلتان من بلاطات
 * الكلمة صوابٌ في موضعيهما، وإنما العيبُ **مشتّتٌ يساوي بلاطةً مطلوبة** (فيُردّ
 * صوابٌ ظاهر) أو مشتّتان متماثلان.
 */
function twins(round) {
  const out = [];
  const dupes = (list) => {
    const seen = new Set(); const bad = [];
    for (const t of list || []) { if (seen.has(t)) bad.push(t); seen.add(t); }
    return bad;
  };
  for (const [what, list] of [['المعروض', round.seen], ['المسموع', round.heard], ['الصورة', round.pics]]) {
    const bad = dupes(list);
    if (bad.length) out.push(`${what}: ${bad.join('، ')}`);
  }
  if (round.board) {
    const tiles = round.board.filter((b) => !b.distractor).map((b) => b.text);
    const others = round.board.filter((b) => b.distractor).map((b) => b.text);
    const clash = others.filter((t, i) => others.indexOf(t) !== i || tiles.includes(t));
    if (clash.length) out.push(`اللوح: ${[...new Set(clash)].join('، ')}`);
  }
  return out;
}

/**
 * محاكاةُ رحلةٍ كاملة. `dope` حقنُ العيب **في طبقة المحاكاة لا في التطبيق** —
 * تستعمله الدسّةُ وحدَها (`--self-test`)، وهو في التشغيل العاديّ فارغ.
 */
function runSim({ days = MAX_DAYS, seed = SEED, dope = {}, trace = false } = {}) {
  p.reset();
  p.endRound();
  const rnd = rng(seed);
  const nodes = p.allNodes();

  const st = {
    days: 0,
    opened: new Map(),          // مفتاح ← يومُ فتحِ محطته
    openedBy: new Map(),        // مفتاح ← معرّفُ محطته
    measured: new Map(),        // مفتاح ← يومُ أوّل قياسٍ حقيقيّ
    playedAt: new Map(),        // عقدة ← يومُ لعبها
    gatesAt: new Map(),
    waits: new Map(),           // عقدةٌ واقفة ← عددُ أيام وقوفها
    stalls: [],
    twins: [],
    fillers: new Map(),         // حوضُ التنويع وحدَه: صنف ← عدد
    reviewKinds: new Map(),      // جلساتُ المراجعة الحقيقية: صنف ← عدد
    fillerSeen: new Set(),      // صنفٌ ظهر في جلسةٍ بلا مستحقٍّ من صنفه ⇒ بدلٌ يقيناً
    fullDue: 0,                 // أيامٌ ملأ المستحقُّ فيها الجلسة وحدَه
    reviews: 0,
    costs: [],
    spread: new Map(),
    paying: null,
    outside: [],                // مفتاحٌ كُتب ولا محطةَ تُعلنه (انحرافُ الجرد)
    checked: 0,                 // جولاتٌ فُحص تطابقُ خياراتها
  };

  // جردٌ ساكن: كلُّ مفتاحٍ تعلنه محطةٌ في الرحلة، ومَن يُعلنه
  const INVENTORY = new Map();
  for (const node of nodes) {
    const station = OPENS[typeOf(node)];
    for (const k of (station?.keys?.(node) || [])) {
      if (k.letter && !INVENTORY.has(keyOf(k))) INVENTORY.set(keyOf(k), node.id);
    }
  }
  st.inventory = INVENTORY;

  const play = (where, day, round) => {
    st.checked++;
    const bad = twins(round);
    if (bad.length) st.twins.push({ day, where, bad });
    if (!round.key?.letter) return;
    const key = keyOf(round.key);
    if (dope.skipMeasure === key) return;      // **الدسّة**: مفتاحٌ لا يُسجَّل قياسُه
    p.endRound();
    p.recordAttempt(round.key.letter, round.key.haraka, round.key.kind, true, day);
    if (!st.measured.has(key)) st.measured.set(key, day);
    if (!INVENTORY.has(key)) st.outside.push({ day, where, key });
  };

  const open = (node, day) => {
    for (const k of (OPENS[typeOf(node)]?.keys?.(node) || [])) {
      const key = keyOf(k);
      if (k.letter && !st.opened.has(key)) { st.opened.set(key, day); st.openedBy.set(key, node.id); }
    }
  };

  for (st.days = 1; st.days <= days; st.days++) {
    const day = st.days;
    let minutes = 0;
    let played = 0;
    const now = stock();          // حصيلةُ اليوم تُقرأ مرّةً: المراجعةُ والمسبارُ يقرآنها

    // ١) **المراجعةُ أوّلاً كما في التطبيق** («ابدأ بالمراجعة» — `guide.html`)
    const due = p.dueSkills(day);
    if (due.length) {
      const items = review.buildSession({ ...now, due, rnd });
      if (items.length) {
        st.reviews++;
        if (due.length >= review.SESSION_SIZE) st.fullDue++;
        const dueKinds = new Set(due.map((s) => s.kind));
        for (const item of items) {
          st.reviewKinds.set(item.kind, (st.reviewKinds.get(item.kind) || 0) + 1);
          if (!dueKinds.has(item.kind)) st.fillerSeen.add(item.kind);
          for (const round of itemRounds(item)) play('مراجعة اليوم', day, round);
        }
        p.markReview(items.length, items.length);
        minutes += sessionMinutes(items.length);
      }
    }

    // **مسبارُ البدلاء**: جلسةٌ تُبنى من حوض التنويع وحدَه بحصيلة يومه — بها يُقاس
    // السورُ الثالث. (قياسٌ على حالٍ حقيقية، لا فِقرةٌ تُلعَب: لا تُسجَّل في ليتنر.)
    // **وكلَّ ثالث يوم**: النسبةُ لا تتبدّل ببناءٍ يوميّ، والبناءُ أثقلُ ما في المحاكاة.
    if (day % PROBE_EVERY === 0 && now.letters.length >= 2) {
      const probe = dope.oneKind
        ? [{ kind: dope.oneKind }, { kind: dope.oneKind }, { kind: dope.oneKind }]
        : review.buildSession({ ...now, due: [], rnd });
      for (const item of probe) st.fillers.set(item.kind, (st.fillers.get(item.kind) || 0) + 1);
    }

    // ٢) ثم محطةٌ أو محطتان حتى يُستنفَد سقفُ اليوم
    let stalled = false;
    while (minutes < DAY_MINUTES && played < DAY_STATIONS) {
      const node = p.nextNode();
      if (!node) break;

      if (node.type === 'gate') {
        const items = gate.gateItems(rnd);
        if (!items.length) { stalled = true; break; }   // بوابةٌ بلا تمارين لا تُعبَر
        const cost = sessionMinutes(items.length);
        if (minutes + cost > DAY_MINUTES && minutes > 0) break;
        for (const item of items) for (const round of itemRounds(item)) play(node.id, day, round);
        p.markReview(items.length, items.length);
        p.setStars(node.id, p.MAX_STARS);
        st.gatesAt.set(node.id, day);
        st.playedAt.set(node.id, day);
        minutes += cost;
        played++;
        if (trace) console.log(`  يوم ${day}: 🚪 ${node.gate.title}`);
        continue;
      }

      const plan = planOf(node, rnd);
      const declared = (OPENS[typeOf(node)]?.keys?.(node) || []).filter((k) => k.letter);
      const measured = plan ? plan.rounds.filter((r) => r.key?.letter) : [];
      // **عقدةٌ تُعلن مفاتيحَ ولا تبني لها جولةً واقفةٌ بالجبهة**: لا يعبرها الطفل
      // ولا يُقاس فيها شيء — والانتظارُ يُعَدّ، فإن جاوز الحدَّ فهو ثقبُ قفلٍ يُسمّى.
      if (!plan || dope.deadNode === node.id || (declared.length && !measured.length)) {
        const waited = (st.waits.get(node.id) || 0) + 1;
        st.waits.set(node.id, waited);
        stalled = true;
        break;
      }

      // **والثقيلةُ تُستوفى على أيام ولا تُبتَر**: يُنفَق فيها ما بقي من اليوم،
      // فإن لم تُستوفَ حُملت بقيّتُها إلى الغد — ولا تُلعَب حتى تُدفَع كلُّها.
      const cost = stationMinutes(plan);
      const paid = st.paying?.id === node.id ? st.paying.paid : 0;
      const spend = Math.max(0, Math.min(cost - paid, DAY_MINUTES - minutes));
      minutes += spend;
      st.spread.set(node.id, (st.spread.get(node.id) || 0) + 1);
      if (paid + spend < cost - 1e-9) { st.paying = { id: node.id, paid: paid + spend }; break; }
      st.paying = null;

      open(node, day);
      for (const round of plan.rounds) play(node.id, day, round);
      p.setStars(node.id, p.MAX_STARS);
      st.playedAt.set(node.id, day);
      st.costs.push({ id: node.id, type: typeOf(node), minutes: cost });
      played++;
      if (trace) console.log(`  يوم ${day}: ${node.id} (${cost.toFixed(1)} دقيقة)`);
    }

    // ٣) وما بقي من اليوم مراجعةٌ إن وقف بابٌ ينتظر — والرحلةُ تنتهي بآخر عقدة
    if (!stalled && !p.nextNode()) break;
  }
  return st;
}

// ————— ٥) الأسوارُ الأربعة — دوالُّ خالصة على ما جمعته المحاكاة —————

/** السور ١: كلُّ مفتاحٍ فُتح يبلغ قياسَه الأوّل في حدٍّ معلَن. */
function wall1(st, limit = FIRST_MEASURE_LIMIT) {
  const never = [];
  const gaps = [];
  for (const [key, openedAt] of st.opened) {
    const at = st.measured.get(key);
    if (at === undefined) never.push({ key, by: st.openedBy.get(key), openedAt });
    // **والفجوةُ صفرٌ لا سالبة**: كلمةٌ تدخل حصيلةَ المراجعة بمجرّد أن تُدرَس حروفُها،
    // فقد يُقاس مفتاحُها قبل أن تُلعَب محطتُه المُعلِنة — وذاك سبقٌ لا فجوة.
    else gaps.push({ key, by: st.openedBy.get(key), gap: Math.max(0, at - openedAt) });
  }
  gaps.sort((a, b) => b.gap - a.gap);
  return { never, gaps, late: gaps.filter((g) => g.gap > limit) };
}

/** السور ٢: لا عقدةَ تقف بالجبهة فوق حدّ الانتظار. */
function wall2(st, limit = WAIT_LIMIT) {
  return [...st.waits].filter(([, waited]) => waited > limit)
    .map(([id, waited]) => ({ id, waited }));
}

/** السور ٣: لا صنفَ يبتلع حوضَ التنويع، ولا صنفَ ذا مادّةٍ يغيب عنه. */
function wall3(fillers, ceiling = FILLER_CEILING) {
  const total = [...fillers.values()].reduce((a, b) => a + b, 0);
  const share = [...fillers].map(([kind, n]) => ({ kind, n, share: total ? n / total : 0 }))
    .sort((a, b) => b.share - a.share);
  return { total, share, greedy: share.filter((s) => s.share > ceiling) };
}

/** السور ٤: لا سؤالَ جوابُه اثنان — تعود قائمةَ الخروق كما جمعتها المحاكاة. */
const wall4 = (st) => st.twins;

// ————— ٦) نصوصُ الوعد: تُجرَد من `app/welcome/` آلياً ولا تُكتب هنا —————
//
// **والجردُ على فراغٍ موحَّد** (سنّةُ `test_welcome`): المنسِّقُ يملك الهيئة، والمحروسُ
// وجودُ الحقيقة. وغيابُ نصٍّ منها يُحمِرّ الحارس — فإمّا تبدّل الوعدُ وإمّا تبدّل مَن
// يقرؤه، وكلاهما يُرفَع ولا يُطوى.
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const page = (name) => flat(readFileSync(new URL(name, WELCOME), 'utf8'));

const PROMISES = [
  {
    id: 'meta',
    where: 'index.html · ميتا الوصف',
    find: () => page('index.html').match(/name="description"[^>]*content="([^"]+)"/)?.[1],
    must: 'من الحرف الأول إلى القرآن',
  },
  {
    id: 'tagline',
    where: 'index.html · صدرُ الرئيسة',
    find: () => page('index.html').match(/<h1 class="w-tagline">\s*(.*?)\s*<\/h1>/)?.[1],
    must: 'حتى يقرأ المصحف بنفسه',
  },
  {
    id: 'minutes-home',
    where: 'index.html · «ما اِقْرَأْ، ولمن؟»',
    find: () => page('index.html').match(/يلعب (ثلاث إلى[^<]*?المناسب)\./)?.[1],
    must: 'خمس دقائق في الدرس الواحد',
  },
  {
    id: 'session',
    where: 'guide.html · عنوانُ «في البيت»',
    find: () => page('guide.html').match(/<h2>(جلسة من خمس دقائق[^<]*)<\/h2>/)?.[1],
    must: 'خير من ساعة في الأسبوع',
  },
  {
    id: 'lesson-cap',
    where: 'guide.html · «في الصف»',
    find: () => page('guide.html').match(/<b>(ثلاث إلى خمس دقائق للدرس الواحد)<\/b>:\s*([^<]*?)،/)
      ?.slice(1).join(': '),
    must: 'الحصة الجيدة درس أو درسان',
  },
];

// ————— ٧) مسحُ الإشباع: النادرُ لا يُترَك للحظّ —————
//
// جولةُ اختيارٍ يقع فيها التطابقُ باحتمال ١/سعةِ الحوض لا تظهر في رحلةٍ واحدة —
// فيها ثلاثٌ وثلاثون جولةَ جذورٍ مثلاً، والاحتمالُ ١/٥٣٠. **فحجمُ المسح مشتقٌّ من
// الحوض لا رقمٌ يُخترَع**: أربعةُ أضعاف سعةِ حوض مشتّتات الصنف، فتقع الحالةُ التي
// احتمالُها ١/الحوض أربعَ مرّاتٍ في المتوسط. وأرضيةٌ لأصنافٍ حوضُها ضيّق.
const SWEEP_FLOOR = 100;
const SWEEP_FACTOR = 4;

function sweepSizes(now) {
  const tiles = new Set(now.words.flatMap((w) => w.tiles || []));
  const words = new Set(now.sentences.flatMap((s) => s.words));
  const pairLetters = Math.max(1, ...now.pairs.map((pair) => pair.letters.length));
  const markTexts = new Set(now.marks.flatMap((m) => (m.compare?.pairs || []).flat()));
  return {
    [K.QUIZ]: now.letters.length,
    [K.HARAKA]: c.HARAKAT.length,
    [K.CONTRAST]: pairLetters,
    [K.ROOT]: now.words.length,
    [K.MARK_COMPARE]: markTexts.size,
    [K.MARK_QUIZ]: markTexts.size,
    [K.RASM]: now.signs.length,
    [K.MUQ]: now.muq.length,
    [K.BUILD]: tiles.size,
    [K.ORDER]: words.size,
  };
}

const SWEEP_DUE = (now) => ({
  [K.QUIZ]: { letter: now.letters[0], haraka: 'fatha' },
  [K.HARAKA]: { letter: now.letters[0], haraka: 'damma' },
  [K.CONTRAST]: { letter: now.pairs[0]?.letters[0], haraka: 'fatha' },
  [K.ROOT]: { letter: rootsScr.skillKeyOf(c.ROOTS.find((r) => r.stranger)?.id ?? c.ROOTS[0].id), haraka: 'none' },
  [K.MARK_COMPARE]: { letter: c.markSkillKey(now.marks[0]?.id), haraka: null },
  [K.MARK_QUIZ]: { letter: c.markSkillKey(now.marks[0]?.id), haraka: null },
  [K.RASM]: { letter: c.rasmSkillKey(now.signs[0]?.sign), haraka: null },
  [K.MUQ]: { letter: c.muqSkillKey(now.muq[0]?.read), haraka: null },
  [K.BUILD]: { letter: now.letters[0], haraka: 'fatha' },
  [K.ORDER]: { letter: now.letters[0], haraka: 'fatha' },
});

/** يبني لكلِّ صنفٍ جولاتِه على حصيلةٍ تامّة ويجرد التطابق. */
function sweep(seed = SEED, dope = {}) {
  const now = stock();
  const kinds = dope.only ? [dope.only] : Object.values(K);
  const sizes = sweepSizes(now);
  const dues = SWEEP_DUE(now);
  const found = new Map();
  const built = new Map();
  for (const kind of kinds) {
    const rounds = dope.rounds ?? Math.max(SWEEP_FLOOR, SWEEP_FACTOR * (sizes[kind] || 0));
    for (let i = 0; i < rounds; i++) {
      const rnd = rng((seed + i * 7919 + kind.length * 104729) >>> 0);
      // **حجمُ واحد**: التمرينُ المستحقُّ وحدَه يُبنى — فلا يُنفَق الوقتُ في حشوٍ
      // لا يُفحَص، ويُبنى من كل صنفٍ ما يكفي لظهور نادره.
      const items = review.buildSession({ ...now, due: [{ ...dues[kind], kind, box: 0, wrong: 1 }], size: 1, rnd });
      for (const item of items) {
        if (item.kind !== kind) continue;
        built.set(kind, (built.get(kind) || 0) + 1);
        const rs = itemRounds(item);
        if (dope.twinKind === kind && i === 0) rs[0].seen = ['مدسوسة', 'مدسوسة'];
        for (const round of rs) {
          const bad = twins(round);
          if (bad.length) {
            const list = found.get(kind) || new Set();
            list.add(`${item.id} ⟵ ${bad.join(' · ')}`);
            found.set(kind, list);
          }
        }
      }
    }
  }
  return { sizes, built, found };
}

// ————— ٨) الدسّة: «لا يُصدَّق حارسٌ لم يُرَ وهو يمسك» —————
//
// **والحقنُ في طبقة المحاكاة لا في التطبيق**: `dope` يمرّ إلى `runSim`/`sweep` ولا
// يُمَسّ بايتٌ في `app/`. وكلُّ سورٍ يُجرَّب بمقايسةِ رحلةٍ نظيفة برحلةٍ مدسوسة —
// **فالفرقُ بين القائمتين هو المدسوسُ بعينه**، لا حمرةٌ عامّة قد تأتي من غيره.

const SELF_DAYS = 30;

if (SELF) {
  console.log('\n— دسّةُ حارس الوعد: كلُّ سورٍ يُرى وهو يمسك —');
  const clean = runSim({ days: SELF_DAYS });

  // (١) مفتاحٌ يُفتح ولا يُقاس
  const victim = [...clean.measured.keys()].find((k) => clean.opened.has(k));
  const doped1 = runSim({ days: SELF_DAYS, dope: { skipMeasure: victim } });
  const before = new Set(wall1(clean).never.map((x) => x.key));
  const after = wall1(doped1).never.find((x) => x.key === victim);
  // **والمقايسةُ على المدسوس بعينه لا على فرق القائمتين**: تعطيلُ قياسٍ يغيّر مجرى
  // الرحلة بعده (المستحقُّ يتبدّل فتتبدّل الجلسات)، فالفرقُ يحمل معه أثرَ التغيّر —
  // والمحروسُ أنّ المفتاح كان مقيساً فصار بلا قياس.
  ok(!before.has(victim) && Boolean(after),
    `**السور ١** يمسك مفتاحاً عُطِّل تسجيلُ قياسه: «${victim}»`
    + (after ? ` ⇐ بلا قياسٍ وقد فتحته ${after.by}` : ' ⇐ **لم يُمسَك**'));

  // (٢) عقدةٌ تقف بالجبهة
  const dead = [...clean.playedAt.keys()].find((id) => !id.startsWith('gate:'));
  const doped2 = runSim({ days: SELF_DAYS, dope: { deadNode: dead } });
  const stalls = wall2(doped2);
  ok(wall2(clean).length === 0 && stalls.length === 1 && stalls[0].id === dead,
    `**السور ٢** يمسك عقدةً أُقفلت قفلاً صناعياً: «${dead}»`
    + (stalls.length ? ` ⇐ وقفت ${num(stalls[0].waited)} يوماً (الحدّ ${num(WAIT_LIMIT)})` : ' ⇐ **لم تُمسَك**'));

  // (٣) صنفٌ يبتلع حوضَ التنويع
  const doped3 = runSim({ days: SELF_DAYS, dope: { oneKind: K.QUIZ } });
  const greedy = wall3(doped3.fillers).greedy;
  ok(wall3(clean.fillers).greedy.length === 0 && greedy.length === 1 && greedy[0].kind === K.QUIZ,
    '**السور ٣** يمسك صنفاً استفرد بحوض التنويع'
    + (greedy.length ? ` ⇐ «${greedy[0].kind}» ${num(Math.round(greedy[0].share * 100))}٪` : ' ⇐ **لم يُمسَك**'));

  // (٤) سؤالٌ جوابُه اثنان
  for (const n of p.allNodes()) p.setStars(n.id, p.MAX_STARS);   // حصيلةٌ تامّة للمسح
  const clean4 = sweep(SEED, { only: K.HARAKA, rounds: 3 });
  const doped4 = sweep(SEED, { twinKind: K.HARAKA, only: K.HARAKA, rounds: 3 });
  ok(!clean4.found.size && [...(doped4.found.get(K.HARAKA) || [])].some((t) => t.includes('مدسوسة')),
    '**السور ٤** يمسك جولةً خيارَاها متطابقان في المعروض (مدسوسة في المسح)'
    + (doped4.found.has(K.HARAKA) ? '' : ' ⇐ **لم تُمسَك**'));

  console.log(fails ? `\n${num(fails)} فشل في الدسّة` : '\n✓ الأسوارُ الأربعة تمسك المدسوسَ كلَّه');
  process.exit(fails ? 1 : 0);
}

// ————— ٩) التشغيل —————

// **ودسّتُه تُشغَّل مع كلِّ تشغيل** («فحصٌ لا يُشغَّل ليس حارساً» — أمرُ المالك):
// في عمليةٍ مستقلّة، لأنّ الدسّةَ تمشي خمسَ رحلاتٍ قصيرة في سجلٍّ تُعيد تصفيره،
// والرحلةُ الكاملة تحتاج سجلَّها من الصفر — فلا يلوّث أحدُهما الآخر.
{
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const own = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--self-test'],
    { encoding: 'utf8' });
  process.stdout.write(own.stdout || '');
  if (own.status !== 0) { fails++; console.log('  ✗ دسّةُ حارس الوعد نفسُها حمراء (`--self-test`)'); }
}

console.log('\n— المحاكاة: طفلٌ يمشي الرحلةَ يوماً بيوم —');
ok(!support.modeOn() && review.SESSION_SIZE === support.KNOBS.dose.standing,
  'وضعُ الدعم مطفأ والمقاديرُ مقاديرُ القائم — فالرقمُ مقيسٌ على ما يراه كلُّ طفل');

const t0 = Date.now();
const st = runSim({ trace: TRACE });
const elapsed = Date.now() - t0;

const nodes = p.allNodes();
const done = nodes.filter((n) => p.isDone(n.id));
const quranGate = st.gatesAt.get('gate:quran');
const firstQuran = [...st.playedAt].find(([id]) => id.startsWith('quran:'));
const firstSurah = [...st.playedAt].find(([id]) => SURAH_IDS.has(id));
const lastNode = [...st.playedAt].at(-1);

ok(done.length === nodes.length,
  `كلُّ عقد الرحلة بُلغت ولُعبت: ${num(done.length)} من ${num(nodes.length)}`
  + (done.length < nodes.length ? ` — بقيت ${num(nodes.length - done.length)}` : ''));
ok(st.days < MAX_DAYS, `والرحلةُ تنتهي دون سقف الأمان (${num(MAX_DAYS)} يوماً)`);
ok(st.outside.length === 0,
  `ولا مفتاحَ يُكتب خارج الجرد المعلَن (${num(st.inventory.size)} مفتاحاً في الجرد)`
  + (st.outside.length ? ` — خارجه: ${st.outside.slice(0, 6).map((x) => `${x.key} من ${x.where}`).join('، ')}` : ''));

// **جردُ الأنواع**: نوعُ محطةٍ جديد بلا سطرٍ في `OPENS` يُسقِط الحارسَ يومَ يُضاف
const types = [...new Set(nodes.map(typeOf))].sort();
const unknown = types.filter((t) => !OPENS[t]);
ok(unknown.length === 0,
  `و${num(types.length)} نوعَ محطةٍ كلُّها في الجرد (${types.join('، ')})`
  + (unknown.length ? ` — **خارجه: ${unknown.join('، ')}**` : ''));
ok(Object.values(OPENS).every((s) => Boolean(s.keys) !== Boolean(s.exempt))
  && Object.values(OPENS).filter((s) => s.exempt).every((s) => s.exempt.length > 40),
  'ولكلٍّ مفاتيحُها **أو** إعفاؤها المكتوب بجملةٍ تُقرأ — لا الاثنان ولا لا شيء');

// ————— الرقم الأول: كم يوماً حتى بوابة المصحف —————

console.log('\n— الرقم الأول: كم يوماً حتى بوابة المصحف —');
console.log(`  🚪 بوابةُ الإتقان قبل المرحلة القرآنية: **اليوم ${num(quranGate ?? 0)}**`);
console.log(`  · أوّلُ فتحٍ للمرحلة القرآنية: اليوم ${num(firstQuran?.[1] ?? 0)} (${firstQuran?.[0] ?? '—'})`);
console.log(`  · أوّلُ سورةٍ تُبلَغ: اليوم ${num(firstSurah?.[1] ?? 0)} (${firstSurah?.[0] ?? '—'})`);
console.log(`  · آخرُ عقدةٍ في الرحلة: اليوم ${num(lastNode?.[1] ?? 0)} (${lastNode?.[0] ?? '—'})`);
console.log('  (وهو **أضيقُ الحالات**: طفلٌ يصيب كلَّ جولةٍ ولا يغيب يوماً، بسقف يومٍ كامل\n'
  + '   — أرضيةُ زمنٍ تُقاس لا وعدَ إتقانِ لغة، ورحلةُ طفلٍ حقيقيّ أطول.)');
ok(Boolean(quranGate), 'وبوابةُ المصحف عُبرت فعلاً في مجرى الأيام');
ok(Boolean(firstQuran) && quranGate <= firstQuran[1],
  'ولا تُفتَح المرحلةُ القرآنية قبل عبورها (القفلُ يعمل في مجرى الأيام لا في لحظةٍ مصنوعة)');

// ————— الرقم الثاني: متى يتمّ القياسُ لكل مفتاح —————

console.log('\n— الرقم الثاني: متى يبلغ كلُّ مفتاحٍ قياسَه الأوّل —');
const w1 = wall1(st);
const worst = w1.gaps[0];
console.log(`  · مفاتيحُ فُتحت: ${num(st.opened.size)} · بلغت قياسَها: ${num(st.opened.size - w1.never.length)}`
  + ` · بلا قياسٍ إلى آخر يوم: **${num(w1.never.length)}**`);
console.log(`  · أقصى فجوةٍ بين الفتح والقياس: **${num(worst?.gap ?? 0)} يوماً** — «${worst?.key ?? '—'}»`
  + ` (فتحتها ${worst?.by ?? '—'})`);
const neverBy = new Map();
for (const x of w1.never) {
  const t = typeOf(p.findNode(x.by) || {}) || x.by;
  const kinds = neverBy.get(t) || new Map();
  const kind = p.parseSkillKey(x.key).kind;
  kinds.set(kind, (kinds.get(kind) || 0) + 1);
  neverBy.set(t, kinds);
}
if (w1.never.length) {
  console.log(`  · وأصحابُها: ${[...neverBy].map(([t, kinds]) => {
    const n = [...kinds.values()].reduce((a, b) => a + b, 0);
    return `${OPENS[t]?.title ?? t} ${num(n)} (${[...kinds].map(([k, v]) => `${k} ${num(v)}`).join(' · ')})`;
  }).join(' · ')}`);
  console.log(`  · عيّنة: ${w1.never.slice(0, 8).map((x) => x.key).join(' · ')}`);
}

// ————— الأسوار الأربعة —————

console.log('\n— الأسوار الأربعة —');
ok(w1.never.length === 0 && w1.late.length === 0,
  `**١) لا مفتاحَ يُفتح ولا يُقاس** — الحدّ ${num(FIRST_MEASURE_LIMIT)} يوماً `
  + `(دورةُ ليتنر كاملةً: ${p.BOX_DAYS.map(num).join('+')})`
  + (w1.never.length || w1.late.length
    ? `\n      ⇐ ${num(w1.never.length)} مفتاحاً بلا قياسٍ ألبتّة، و${num(w1.late.length)} جاوزت الحدَّ`
      + (w1.late.length ? `: ${w1.late.slice(0, 4).map((x) => `${x.key} (${num(x.gap)} يوماً)`).join('، ')}` : '')
    : ''));

const w2 = wall2(st);
const longest = Math.max(0, ...st.waits.values());
ok(w2.length === 0,
  `**٢) لا عقدةَ تقف بالجبهة** — أطولُ وقفة ${num(longest)} يوماً `
  + `(الحدُّ ${num(WAIT_LIMIT)}: أطولُ موعدٍ في سلّم ليتنر)`
  + (w2.length ? ` ⇐ ${w2.map((x) => `«${x.id}» ${num(x.waited)} يوماً`).join('، ')}` : ''));

const w3 = wall3(st.fillers);
ok(w3.greedy.length === 0 && w3.share.length === Object.values(K).length,
  `**٣) لا بدلاءَ يبتلعون الجلسة** — ${num(w3.share.length)} أصنافٍ في حوض التنويع، `
  + `أعلاها «${w3.share[0]?.kind}» ${num(Math.round((w3.share[0]?.share ?? 0) * 100))}٪ `
  + `(السقفُ ${num(FILLER_CEILING * 100)}٪)`
  + (w3.greedy.length ? ` ⇐ استفرد: ${w3.greedy.map((s) => s.kind).join('، ')}` : '')
  + (w3.share.length < Object.values(K).length
    ? ` ⇐ غاب: ${Object.values(K).filter((k) => !st.fillers.has(k)).join('، ')}` : ''));
console.log(`      الحوض: ${w3.share.map((s) => `${s.kind} ${num(Math.round(s.share * 100))}٪`).join(' · ')}`);

console.log('\n  — ومسحُ الإشباع للسور الرابع (النادرُ لا يُترَك للحظّ) —');
const sw = sweep();
const swept = [...sw.built.values()].reduce((a, b) => a + b, 0);
const w4 = wall4(st);
ok(w4.length === 0 && sw.found.size === 0,
  `**٤) لا سؤالَ جوابُه اثنان** — ${num(st.checked + swept)} جولةً فُحصت `
  + `(${num(st.checked)} في الرحلة و${num(swept)} في المسح)`
  + (w4.length ? `\n      ⇐ في المحاكاة: ${w4.slice(0, 3).map((x) => `يوم ${num(x.day)} · ${x.where} · ${x.bad.join(' · ')}`).join('، ')}` : '')
  + (sw.found.size
    ? `\n      ⇐ في المسح: ${[...sw.found].map(([k, v]) => `[${k}] ${num(v.size)} شكلاً — ${[...v][0]}`).join('؛ ')}`
    : ''));

// ————— التسعير: يُرى في المخرَج لا في تعليقٍ داخليّ —————

console.log('\n— التسعير: زمنُ المحطة دالّةُ محتواها —');
console.log(`  · الأصل: زيارةٌ ${VISIT_MINUTES} دقيقة + ${CARD_MINUTES} للبطاقة + ${ROUND_MINUTES} للجولة`
  + ` + ${LINE_MINUTES} لسطر القراءة (سقفُ اليوم ${num(DAY_MINUTES)} دقيقة و${num(DAY_STATIONS)} محطتان)`);
const byType = new Map();
for (const x of st.costs) {
  const list = byType.get(x.type) || [];
  list.push(x.minutes);
  byType.set(x.type, list);
}
for (const [type, list] of byType) {
  console.log(`  · ${OPENS[type]?.title ?? type}: ${Math.min(...list).toFixed(1)}–${Math.max(...list).toFixed(1)}`
    + ` دقيقة (${num(list.length)} محطة)`);
}
// **والمعايرةُ على نصّ المنهج**: `METHOD.md §٤` — «حلقة الدرس ٣–٥ دقائق لكل حرف».
// **واستثناءُ الدرس الأوّل مكتوبٌ بسببه**: لا خطوةَ «ميّز بأذنك» في أوّل درسٍ في
// الرحلة — لا حرفَ ثانياً يُميَّز عنه (`buildRounds` تعود فارغةً بأقلّ من حرفين).
const letterCosts = st.costs.filter((x) => x.type === 'letter');
const first = letterCosts[0];
const rest = letterCosts.slice(1).map((x) => x.minutes);
ok(rest.every((m) => m >= 3 && m <= 5),
  `والمعايرة على METHOD §٤ (٣–٥ دقائق للحرف): دروسُ الحروف ${Math.min(...rest).toFixed(1)}–${Math.max(...rest).toFixed(1)} دقيقة`
  + ` — عدا أوّل درسٍ في الرحلة (${first?.id}: ${first?.minutes.toFixed(1)}) وهو بلا خطوة تمييزٍ بسببها المكتوب`);
const spread = [...st.spread].filter(([, d]) => d > 1);
console.log(`  · محطاتٌ لم تُستوفَ في يومٍ واحد: ${num(spread.length)} من ${num(st.costs.length)}`
  + ` (الأثقل: ${st.costs.reduce((a, b) => (b.minutes > a.minutes ? b : a), st.costs[0]).id})`);
console.log(`  · جلساتُ المراجعة: ${num(st.reviews)} · أيامٌ ملأ المستحقُّ فيها الجلسةَ وحدَه: `
  + `${num(st.fullDue)} من ${num(st.days)}`
  + ` · أصنافٌ وقعت في جلسةٍ بلا مستحقٍّ من صنفها (بدلٌ يقيناً): `
  + `${st.fillerSeen.size ? [...st.fillerSeen].join('، ') : 'لا شيء'}`);

// ————— المقايسة بنصّ الوعد —————

console.log('\n— نصوصُ الوعد كما هي في `app/welcome/`، بجوار المقيس —');
for (const promise of PROMISES) {
  const text = promise.find();
  ok(Boolean(text) && flat(text).includes(promise.must),
    `[${promise.where}] «${text ? flat(text).slice(0, 96) : '**لم يُوجَد**'}»`);
}
console.log(`\n  والمقيسُ بجوارها: بوابةُ المصحف اليوم ${num(quranGate ?? 0)} · أوّلُ سورةٍ اليوم `
  + `${num(firstSurah?.[1] ?? 0)} · آخرُ عقدةٍ اليوم ${num(lastNode?.[1] ?? 0)} — بجلسةٍ يومية واحدة`
  + ` سقفُها ${num(DAY_MINUTES)} دقيقة ومحطتان.`);
console.log(`  (البذرة ${num(SEED)} · ${num(elapsed)} مللي ثانية للمحاكاة)`);

console.log(fails
  ? `\n${num(fails)} فشل`
  : `\nوعدُنا يقع: المصحفُ بيده في اليوم ${num(firstSurah?.[1] ?? 0)}، والرحلةُ تتمّ في اليوم ${num(st.days)}`);
process.exit(fails ? 1 : 0);
