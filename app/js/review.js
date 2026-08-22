// جلسة المراجعة اليومية — تُولَّد بالتكرار المتباعد من سجلّ المهارات (METHOD §٦).
//
// قيدان يحكمان هذا الملف:
// ١) **لا محتوى جديداً**: المراجعة لا تعرض إلا تمارين المحتوى القائم (تمييز الحرف،
//    تمييز الحركة، تركيب كلمة من مقاطعها، ترتيب جملة قرأها في سلّمها)، فكلّ نصّ تنطقه
//    له ملف مولَّد أو مكانٌ في قائمة الانتظار — لا نصّ يُؤلَّف من أجل المراجعة.
// ٢) **المفكوكية ١٠٠٪**: الحروف من `progress.studiedLetters()` (ما أتمّ دروسه فعلاً)
//    والكلمات من `progress.studiedWords()` (كل حروفها مدروسة)، والجمل من
//    `progress.studiedSentences()` (درجاتٌ أتمّها)، والمشتّتات من مقاطعها وكلماتها.
//
// **لا مهارةَ تُقاس بلا تمرينٍ يراجعها**: بدخول تمرين «رتّب» في الحزمة ٨ صار لكل نوع
// في `KINDS` تمرينُه هنا — وإلا لبقيت مهاراتُه في صندوق ليتنر الأول أبداً، فيكذب
// «الحروف المتقنة» في لوحة وليّ الأمر على وليّ الأمر.

import {
  HARAKAT, ROOTS, contrastPairs, markLabel, markOf, markSkillKey, memberSay, rootById,
  skillByMarkKey, syllableSkill, wordSkill,
  muqSays, muqSkillKey, quranLetterSkills, rasmSkillKey,
} from './curriculum.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
// **مقادير الجلسة من مخزنٍ واحد** (وضعُ الدعم، الجلسة د١): الجرعةُ وسعةُ الحوض
// تُقرآن من `support.js` لا من ثابتين هنا. و**لا يُستورد منه التلقين** (`mayPrompt`):
// «لا تلقينَ في المراجعة ولا في البوابتين ولا في اللحاق ألبتّة» — وهذه الشاشاتُ
// الثلاث تركب هذا المحرّك، فحصانتُها بنيويةٌ لا وصيّة (يجردها `test_support.mjs`).
import { KNOBS, sessionSize, distractors } from './support.js';
import { credit } from './fade.js';   // شاهدُ «رتّب» — الكلمةُ في موضعها (مدخلٌ واحد)
import { buildBoard } from './words.js';
// **حوضُ الجذر كتلةٌ واحدة تُستورَد ولا تُنسَخ** (الجلسة ع٢): كانت هنا نسخةٌ ثانية من
// القاعدة سقط منها إخراجُ الشائكة قبل الحشو، فوقع خياران متطابقان — والقاعدةُ التي
// تُنسخ تفترق غداً (سنّةُ `record.js`).
import { rootDistractors } from './roots.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, arCount, starsRow, topbar, letterTitle, wordText,
  mascot, shuffle, pick, shake, pop, DEV,
} from './ui.js';

/**
 * جلسة قصيرة تُنجَز في دقائق (لا تُرهق طفل السادسة). **والرقمُ من جدول `support.js`**
 * لا مكتوباً هنا: هذا هو القائم، و`sessionSize()` هو المقدارُ الفعليّ لحظةَ البناء
 * (يخفضه مِقبضُ «الجرعة» في وضع الدعم).
 */
export const SESSION_SIZE = KNOBS.dose.standing;
export const MAX_BUILD = 2;       // تركيب الكلمات أطول التمارين: اثنان على الأكثر
export const MAX_ORDER = 1;       // وترتيب الجملة أطولها: واحد

/** خياراتُ تمرين الاختيار = الهدفُ ومشتّتاته — تُقرأ عند كل بناء لا مرّةً عند التحميل. */
const options = () => 1 + distractors();
const ACCENT = 'var(--accent-skills)';   // المراجعة تثبيت مهارات — لونها لون المهارات

/** نجوم الجلسة: ٣ بلا خطأ، ٢ ما دامت الأخطاء ≤ عدد التمارين، وإلا ١ (عتبة متناسبة). */
export const starsForReview = (errors, items) => (errors === 0 ? 3 : errors <= items ? 2 : 1);

// ————— بناء التمارين —————

function quizItem(letter, haraka, letters, rnd) {
  const pool = [...new Set(letters)].filter((c) => c !== letter);
  if (!pool.length) return null;
  const mark = markOf(haraka) || HARAKAT[0].mark;
  const choices = shuffle([letter, ...shuffle(pool, rnd).slice(0, options() - 1)], rnd);
  return {
    id: `quiz|${letter}|${haraka}`, kind: progress.KINDS.QUIZ, letter, haraka, mark,
    options: choices,
  };
}

function harakaItem(letter, haraka, rnd) {
  const target = HARAKAT.find((k) => k.key === haraka) || pick(HARAKAT, rnd);
  return {
    id: `haraka|${letter}`,
    kind: progress.KINDS.HARAKA,
    letter,
    haraka: target.key,
    mark: target.mark,
    options: HARAKAT.map((k) => ({ ...k })),
  };
}

/**
 * تمرين «ميّز بين» — جولةٌ واحدة من محطة المواجهة (الحزمة ١٣): الخياران (أو الثلاثة)
 * هم الزوج المتشابه نفسُه بحركةٍ واحدة، فالتمييز يقع على الحرف وحده.
 *
 * **ولا مهارةَ تُقاس بلا تمرينٍ يراجعها**: المحطة تكتب مهاراتها بنوع `contrast`، فلولا
 * هذا التمرين لبقيت في صندوق ليتنر الأول أبداً — فلا يُعدّ حرفٌ متقناً وإن أُتقن.
 */
function contrastItem(letter, haraka, pairs, rnd) {
  const hits = pairs.filter((p) => p.letters.includes(letter));
  if (!hits.length) return null;
  const k = HARAKAT.find((x) => x.key === haraka) || pick(HARAKAT, rnd);
  return {
    id: `contrast|${letter}|${k.key}`,
    kind: progress.KINDS.CONTRAST,
    letter,
    haraka: k.key,
    mark: k.mark,
    options: shuffle(pick(hits, rnd).letters, rnd),
  };
}

/**
 * تمرين «اجمع العائلة» — جولةٌ واحدة من شجرة الجذر (حزمة الجذور): الخيارات عضوٌ
 * من العائلة ومشتّتان من خارجها، وأذكاهما «الحروفُ بلا المعنى» إن وُجد.
 *
 * **ولا مهارةَ تُقاس بلا تمرينٍ يراجعها**: الشجرة تكتب مهاراتها بنوع `root`، فلولا
 * هذا التمرين لبقيت في صندوق ليتنر الأول أبداً. ومادّتُه كلماتٌ منطوقةٌ محسوبة
 * (أعضاءُ العائلة وحصيلةُ الطفل)، فلا نصَّ جديد يدخل المراجعة.
 */
function rootItem(rootId, words, rnd) {
  const root = rootById(String(rootId).replace(/^root-/, ''));
  if (!root) return null;
  const texts = words.map((w) => w.text ?? w.read ?? (w.tiles || []).join(''));
  const known = new Set(texts);
  const branches = root.members.filter((m) => known.has(m));
  if (!branches.length) return null;
  const outside = [...new Set(texts)].filter((t) => !root.members.includes(t));
  const target = pick(branches, rnd);
  const others = rootDistractors(root, target, outside, distractors(), { rnd });
  if (others.length < distractors()) return null;
  return {
    id: `root|${root.id}`,
    kind: progress.KINDS.ROOT,
    root,
    target,
    options: shuffle([target, ...others], rnd),
  };
}

/**
 * تمرينا العلامة — جولةٌ واحدة من درس المهارة (حزمة «قياس العلامات»):
 *   `mark-compare` — **صامت**: «أيُّهما مَمدود؟» والخياران طرفا الزوج مكتوبين.
 *   `mark-quiz`    — **سماعيّ**: «أيَّ واحدة سمعت؟» والخيارات من مادّة الدرس.
 *
 * **ولا مهارةَ تُقاس بلا تمرينٍ يراجعها**: الدرس يكتب مهاراته بنوعَي العلامة، فلولا
 * هذان لبقيا في صندوق ليتنر الأول أبداً — وهي عينُ العلّة التي أبقت العلامات خارج
 * القياس أربع عشرة حزمة. ومادّتُه **أزواجُ درسه وحدَه**، فلا يُسأل عن مدّ الواو من لم
 * يدرسه (المفكوكية بالبناء)، ولا نصَّ منطوقاً جديداً: الأزواج لها ملفاتها منذ الجلسة ١.
 */
/**
 * تمرينُ حرفَي المرحلة القرآنية (الحكم ب١، جلسة وز٢): كلمتان مكتوبتان، إحداهما فيها
 * الهمزةُ (أو التاء المربوطة) والأخرى من الحرف الآخر — **قراءةٌ صامتة** كأخيه
 * `mark-compare`، والحكمُ على أن يرى العلامةَ في الرسم. ومادّتُه كلماتُ الدرس نفسِه،
 * فلا نصَّ منطوقٌ جديد ولا صورةَ تُطلَب.
 */
function quranLetterItem(skill, kind, rnd) {
  if (kind !== progress.KINDS.MARK_COMPARE) return null;   // لا تمرينَ سمعيّ لهما
  const own = skill.quranSign.words;
  const others = quranLetterSkills()
    .filter((s) => s.id !== skill.id).flatMap((s) => s.quranSign.words);
  if (!own.length || !others.length) return null;
  const target = pick(own, rnd);
  return {
    id: `mark-compare|${skill.id}|${target.read}`,
    kind: progress.KINDS.MARK_COMPARE,
    letter: markSkillKey(skill.id),
    haraka: null,
    mark: skill,
    label: `فيه ${skill.title}`,
    note: 'اقرأ الكلمتين بعينك — العلامةُ في إحداهما',
    target: target.read,
    options: shuffle([target.read, pick(others, rnd).read], rnd),
  };
}

function markItem(key, kind, marks, rnd) {
  const skill = skillByMarkKey(key);
  if (!skill || !marks.some((m) => m.id === skill.id)) return null;   // درسٌ لم يبلغه بعد
  if (skill.quranSign) return quranLetterItem(skill, kind, rnd);
  const pairs = (skill.compare?.pairs || []).filter((p) => p.length === 2);
  const labels = skill.compare?.labels || [];
  if (!pairs.length || labels.length < 2) return null;

  const pair = pick(pairs, rnd);
  const base = { mark: skill, letter: markSkillKey(skill.id), haraka: null };

  if (kind === progress.KINDS.MARK_COMPARE) {
    const side = rnd() < 0.5 ? 0 : 1;   // يُسأل عن الطرفين كليهما — لا عن المعلَّم وحده
    return {
      ...base,
      id: `mark-compare|${skill.id}|${pair[side]}`,
      kind: progress.KINDS.MARK_COMPARE,
      label: markLabel(labels[side]),
      target: pair[side],
      options: shuffle(pair, rnd),
    };
  }

  const others = shuffle(pairs.filter((p) => p !== pair), rnd).flat();
  const choices = [...pair, ...others].filter((t, i, all) => all.indexOf(t) === i);
  if (choices.length < 2) return null;
  return {
    ...base,
    id: `mark-quiz|${skill.id}`,
    kind: progress.KINDS.MARK_QUIZ,
    target: pick(pair, rnd),
    options: shuffle(choices.slice(0, options()), rnd),
  };
}

/**
 * تمرينُ علامةِ الرسم — جولةٌ واحدة من درسها (الحكم ب١): كلمةٌ عثمانية معروضة وثلاثُ
 * علاماتٍ، أيُّها فيها؟ **صامتٌ قبل الاختيار** (نصُّ المصحف يُقرأ بالعين ولا يُنطق
 * آلياً — METHOD §٥.٦)، والخطأُ يُسمِع **قاعدةَ ما اختاره** فيعرف لِمَ لم تكن هي.
 * ومادّتُه علاماتُ الدروس التي أتمّها وحدَها، فالمفكوكية بالبناء.
 */
function rasmItem(key, signs, rnd) {
  const target = signs.find((s) => rasmSkillKey(s.sign) === String(key));
  if (!target) return null;
  const others = shuffle(signs.filter((s) => s.sign !== target.sign), rnd).slice(0, options() - 1);
  if (others.length < options() - 1) return null;
  return {
    id: `rasm|${target.sign}`,
    kind: progress.KINDS.RASM,
    letter: rasmSkillKey(target.sign),
    haraka: null,
    target,
    options: shuffle([target, ...others], rnd),
  };
}

/**
 * تمرينُ فواتح السور — جولةٌ واحدة من محطتها (الحكم ب٣): تُسمَع أسماءُ الحروف
 * بالتتابع وتُختار المجموعةُ مكتوبةً. ونصُّ المقطَّعة **يُعرَض ولا يُنطَق**، والمنطوقُ
 * أسماءُ الحروف وحدها — ولها ملفاتُها منذ الحزمة ٦.
 */
function muqItem(key, items, rnd) {
  const target = items.find((i) => muqSkillKey(i.read) === String(key));
  if (!target) return null;
  const others = shuffle(items.filter((i) => i.read !== target.read), rnd).slice(0, options() - 1);
  if (others.length < options() - 1) return null;
  return {
    id: `muq|${target.read}`,
    kind: progress.KINDS.MUQ,
    letter: muqSkillKey(target.read),
    haraka: null,
    target,
    options: shuffle([target, ...others], rnd),
  };
}

function buildItem(word, words, rnd) {
  // تفشل مغلقةً: كلمةٌ بلا مقاطع لا لوحَ لها (وحوضُ التنويع يمرّ على كل كلمةٍ في حصيلته)
  if (!word?.tiles?.length) return null;
  const pool = [...new Set(words.flatMap((w) => w.tiles || []))];
  return {
    id: `build|${word.say}`,
    kind: progress.KINDS.BUILD,
    word,
    board: buildBoard(word, pool, rnd),
  };
}

/**
 * تمرين «رتّب الجملة» — لوحٌ واحد من سلّم الجمل (الحزمة ٨).
 * مادّته جملةٌ أتمّ درجتها، وبلاطاته كلماتها ومشتّتاتٌ من كلمات جملٍ رتّبها مثلها
 * (فكلّها منطوقةٌ محسوبة، ولا نصّ جديد يدخل المراجعة).
 */
function orderItem(sentence, sentences, rnd) {
  if (!sentence?.words?.length) return null;
  const pool = [...new Set(sentences.flatMap((s) => s.words))];
  return {
    id: `order|${sentence.id}`,
    kind: progress.KINDS.ORDER,
    sentence,
    board: buildBoard({ tiles: sentence.words }, pool, rnd),
  };
}

/** كلمة تحوي مقطعاً بهذه المهارة (حرف × حركة) — لإعادة ما تعثّر فيه في سياقه. */
function wordForSkill(letter, haraka, words, rnd) {
  const hits = words.filter((w) => (w.tiles || []).some((t) => {
    const s = syllableSkill(t);
    return s && s.letter === letter && s.haraka === haraka;
  }));
  return hits.length ? pick(hits, rnd) : null;
}

/** جملةٌ فيها كلمةٌ بهذه المهارة — يُقاس فيها ما قِيس في السلّم (أول حرف متحرّك). */
function sentenceForSkill(letter, haraka, sentences, rnd) {
  const hits = sentences.filter((s) => s.words.some((w) => {
    const k = wordSkill(w);
    return k && k.letter === letter && k.haraka === haraka;
  }));
  return hits.length ? pick(hits, rnd) : null;
}

function itemForSkill(skill, ctx, rnd) {
  const { letters, words, sentences, pairs, marks, signs, muq } = ctx;
  if (skill.kind === progress.KINDS.QUIZ) return quizItem(skill.letter, skill.haraka, letters, rnd);
  if (skill.kind === progress.KINDS.HARAKA) return harakaItem(skill.letter, skill.haraka, rnd);
  if (skill.kind === progress.KINDS.CONTRAST) {
    return contrastItem(skill.letter, skill.haraka, pairs, rnd);
  }
  if (skill.kind === progress.KINDS.ROOT) return rootItem(skill.letter, words, rnd);
  if (progress.isMarkSkill(skill)) return markItem(skill.letter, skill.kind, marks, rnd);
  if (skill.kind === progress.KINDS.RASM) return rasmItem(skill.letter, signs, rnd);
  if (skill.kind === progress.KINDS.MUQ) return muqItem(skill.letter, muq, rnd);
  if (skill.kind === progress.KINDS.BUILD) {
    return buildItem(wordForSkill(skill.letter, skill.haraka, words, rnd), words, rnd);
  }
  if (skill.kind === progress.KINDS.ORDER) {
    return orderItem(sentenceForSkill(skill.letter, skill.haraka, sentences, rnd), sentences, rnd);
  }
  return null;
}

/**
 * جلسة اليوم: المستحقّ من سجلّ المهارات أولاً (الأضعف أولاً)، ثم — إن لم يكتمل
 * العدد — تمارين من حصيلة الطفل تنويعاً. تعود [] إن لم يبلغ الطفل حرفين مدروسين.
 * دالّة خالصة: كل ما تحتاجه يُحقَن، فتُختبر في node بلا متصفّح.
 */
export function buildSession({
  letters = [], words = [], sentences = [], pairs = [], marks = [], signs = [], muq = [],
  due = [], size = sessionSize(), rnd = Math.random,
} = {}) {
  const known = [...new Set(letters)];
  if (known.length < 2) return [];
  const ctx = { letters: known, words, sentences, pairs, marks, signs, muq };

  const items = [];
  const seen = new Set();
  const longs = { [progress.KINDS.BUILD]: MAX_BUILD, [progress.KINDS.ORDER]: MAX_ORDER };
  const used = { [progress.KINDS.BUILD]: 0, [progress.KINDS.ORDER]: 0 };

  const add = (item) => {
    if (!item || seen.has(item.id)) return false;
    if (item.kind in longs) {
      if (used[item.kind] >= longs[item.kind]) return false;
      used[item.kind]++;
    }
    seen.add(item.id);
    items.push(item);
    return true;
  };

  for (const skill of due) {
    if (items.length >= size) break;
    // تمييز الحرف والحركة يحتاج الحرف في جدول حصيلته؛ أمّا التركيب والترتيب فمادّتهما
    // كلمةٌ أو جملةٌ من حصيلته — فشرطُهما وجودها (الهمزة والتاء المربوطة تُدرَّسان في
    // المرحلة القرآنية ولا تظهران في المجموعات، وترد في كلمات البساتين)، وإلا فلا تمرين.
    // العائلةُ الصرفية والعلامةُ مادّتُهما ليست حرفاً بعينه (مفتاحاهما `root-<العائلة>`
    // و`mark-<الدرس>`)، فتُستثنيان من شرط الحرف كما استُثني التركيبُ والترتيب.
    if (progress.isLetterSkill(skill)
      && !(skill.kind in longs) && !known.includes(skill.letter)) continue;
    add(itemForSkill(skill, ctx, rnd));
  }

  // تنويع الباقي: تمييز الحرف والحركة على حروف مدروسة، ومواجهة زوجٍ متشابه،
  // وقراءةُ علامةٍ وسماعُها، وجمعُ عائلة، وتركيب كلمة، وترتيب جملة
  const fillers = [
    ...shuffle(known, rnd).map((c) => () => quizItem(c, HARAKAT[0].key, known, rnd)),
    ...shuffle(known, rnd).map((c) => () => harakaItem(c, pick(HARAKAT, rnd).key, rnd)),
    ...shuffle(pairs, rnd).map((p) => () =>
      contrastItem(pick(p.letters, rnd), pick(HARAKAT, rnd).key, pairs, rnd)),
    ...shuffle(marks, rnd).flatMap((m) =>
      [progress.KINDS.MARK_COMPARE, progress.KINDS.MARK_QUIZ].map((kind) => () =>
        markItem(markSkillKey(m.id), kind, marks, rnd))),
    ...shuffle(ROOTS, rnd).map((r) => () => rootItem(r.id, words, rnd)),
    // علاماتُ الرسم وفواتحُ السور — ما أتمّ درسَه منها وحدَه (الحكمان ب١ وب٣)
    ...shuffle(signs, rnd).map((s) => () => rasmItem(rasmSkillKey(s.sign), signs, rnd)),
    ...shuffle(muq, rnd).map((m) => () => muqItem(muqSkillKey(m.read), muq, rnd)),
    ...shuffle(words, rnd).map((w) => () => buildItem(w, words, rnd)),
    ...shuffle(sentences, rnd).map((s) => () => orderItem(s, sentences, rnd)),
  ];
  // **يُخلَط الحوضُ كلُّه لا كلُّ صنفٍ على حدة**: قائمةٌ مرتَّبةً بالأصناف يبتلع صدرُها
  // الجلسةَ كلَّها (حروفُ الطفل عشراتٌ وعلاماتُه ستّ)، فلا تُرى علامةٌ ولا عائلةٌ في
  // التنويع أبداً — وهو عينُ ما جعل الرتابةَ مرفوعاً في المراجعة الخارجية.
  const mixed = shuffle(fillers, rnd);
  for (let i = 0; items.length < size && i < mixed.length * 2; i++) {
    add(mixed[i % mixed.length]());
  }

  return items.slice(0, size);
}

/** كل النصوص التي قد ينطقها تمرين — للتحميل المسبق ولفحص تغطية الصوت في الاختبارات. */
export function itemTexts(item) {
  if (item.kind === progress.KINDS.QUIZ) return item.options.map((c) => c + item.mark);
  if (item.kind === progress.KINDS.CONTRAST) return item.options.map((c) => c + item.mark);
  if (item.kind === progress.KINDS.HARAKA) return item.options.map((k) => item.letter + k.mark);
  if (progress.isMarkSkill(item)) return [...item.options];   // أزواجُ الدرس بملفاتها القائمة
  // **علامةُ الرسم: قواعدُها لا كلمتُها** — الكلمةُ نصُّ مصحفٍ يُقرأ بالعين ولا يُنطق
  // آلياً أبداً (METHOD §٥.٦)، والمنطوقُ قاعدةُ ما يختاره الطفل عند الخطأ.
  if (item.kind === progress.KINDS.RASM) return item.options.map((s) => s.rule);
  // وفواتحُ السور: أسماءُ حروفها وحدها (نصُّ المقطَّعة معروضٌ لا منطوق)
  if (item.kind === progress.KINDS.MUQ) return item.options.flatMap(muqSays);
  if (item.kind === progress.KINDS.BUILD) return [...item.board.map((t) => t.text), item.word.say];
  // سطرُ معنى العائلة **معروضٌ لا منطوق** في المراجعة (تنطقه شاشةُ الشجرة وحدَها)،
  // فلا يدخل هنا: نصٌّ يُحمَّل مسبقاً بلا أن يُنطق يطلب ملفاً لا يحتاجه أحد.
  if (item.kind === progress.KINDS.ROOT) return item.options.map(memberSay);
  if (item.kind === progress.KINDS.ORDER) {
    return [...item.board.map((t) => t.text), item.sentence.text, item.sentence.target.say];
  }
  return [];
}

// ————— «اسمع الفرق»: استثناءُ تمرين المواجهة المعلَن (الحزمة ١٣) —————
//
// قاعدةُ الخطأ في التطبيق كلّه: يسمع الطفل **ما اختاره** ولا يُلقَّن الصواب (DESIGN §٥.٥)
// — كي يقرأ ويقارن بدل أن يُملى عليه. وفي «ميّز بين» وحدها يُستثنى ذلك: يسمع ما اختاره
// **ثم الهدف** بفاصلٍ يفصل بينهما، لأنّ جوهرَ هذا التمرين هو السماع المقارن نفسُه —
// فمنعُ المقارنة فيه منعٌ لمادّته لا صيانةٌ لها. والفاصل مقصود: صوتان متلاصقان
// يُسمَعان صوتاً واحداً في أذن طفل السادسة.
export const CONTRAST_GAP_MS = 520;

/** فاصلُ أسماء الفواتح — نظيرُ فاصل المواجهة: اسمان متلاصقان يُسمَعان اسماً واحداً. */
export const MUQ_GAP_MS = 380;

export const compareSounds = (chosen, target) =>
  audio.playSequence([chosen, target], CONTRAST_GAP_MS);

// ————— محرّك الجلسة —————
//
// شاشتان تركبانه: «مراجعة اليوم» و«بوابة الإتقان» (الحزمة ١٤). ما يفترقان فيه
// **مادّةُ الجلسة وحكمُ ختامها** لا ميكانيكية التمارين، فبقيت التمارين الأربعة هنا
// وحدها لا تُنسَخ: نسختان منها تفترقان يوماً في تسجيل الخطأ أو في «لا تلقين للجواب».
//
// @param {() => object[]} make  بناء تمارين المحاولة — يُستدعى في كل إعادة (لا نمط يُحفظ)
// @param {(ctx) => Node} verdict  شاشة الختام: تتلقّى {right, errors, items, again}
// @param {string} pill · accent · leaveAsk  زينة الشاشة وسؤال المغادرة

export function renderSession({ make, verdict, pill, accent = ACCENT, leaveAsk, header = null }) {
  let items = make();
  if (!items.length) return null;   // لا حصيلة بعدُ: main.js يعيده إلى الخريطة

  // `errors`/`right` **لمسات**، و`missedItems`/`rightItems` **تمارين** (الحكم ب٧):
  // البوابةُ تحكم بالتمارين — تركيبٌ من أربعة مقاطع تمرينٌ واحد مهما بلغت لمساتُه،
  // فلا يزن أربعةَ أضعاف تمييزٍ في نسبة العبور. والمراجعةُ تبقى على لمساتها.
  const state = {
    index: 0, errors: 0, right: 0, done: false, token: 0,
    missed: false, missedItems: 0, rightItems: 0,
  };

  const dots = h('ol', { class: 'dots' });
  const body = h('div', { class: 'lesson-body' });
  let root = null;

  audio.preload(items.slice(0, 2).flatMap(itemTexts));

  function paintDots() {
    dots.replaceChildren(...items.map((item, i) => h('li', {
      class: `dot${!state.done && i === state.index ? ' dot--now' : ''}${state.done || i < state.index ? ' dot--done' : ''}`,
      'aria-label': `تمرين ${arNum(i + 1)}`,
    }, i < state.index || state.done ? '✓' : arNum(i + 1))));
  }

  function paint() {
    audio.stop();
    state.token++;
    progress.endRound();      // تمرينٌ جديد ⇒ جولةٌ جديدة (الحكم ب٨)
    paintDots();
    const item = items[state.index];
    audio.preload(itemTexts(item));
    body.replaceChildren(
      item.kind === progress.KINDS.BUILD ? buildView(item)
        : item.kind === progress.KINDS.ORDER ? orderView(item)
          : item.kind === progress.KINDS.HARAKA ? harakaView(item)
            : item.kind === progress.KINDS.CONTRAST ? contrastView(item)
              : item.kind === progress.KINDS.ROOT ? rootView(item)
                : item.kind === progress.KINDS.MARK_COMPARE ? markCompareView(item)
                  : item.kind === progress.KINDS.MARK_QUIZ ? markQuizView(item)
                    : item.kind === progress.KINDS.RASM ? rasmView(item)
                      : item.kind === progress.KINDS.MUQ ? muqView(item)
                        : quizView(item));
    const ahead = items[state.index + 1];
    if (ahead) audio.preload(itemTexts(ahead));
  }

  /** طيُّ التمرين الجاري: تمرينٌ أصابه أو أخطأ فيه — لا لمساتُه (الحكم ب٧). */
  function tally() {
    if (state.missed) state.missedItems++;
    else state.rightItems++;
    state.missed = false;
  }

  function next() {
    tally();
    if (state.index < items.length - 1) {
      state.index++;
      paint();
    } else {
      finish();
    }
  }

  const score = (item, letter, haraka, correct) => {
    progress.recordAttempt(letter, haraka, item.kind, correct);
    if (correct) state.right++;
    else { state.errors++; state.missed = true; }
  };

  /** خطأ: هزّة وتلوين ثم إعادة السماع — بلا تلقين الجواب (كما في الدرس واللعبة). */
  function wrong(btn, replay) {
    shake(btn);
    btn.classList.add('bad');
    setTimeout(() => btn.classList.remove('bad'), 700);
    if (replay) audio.afterSpeech(450, replay);   // الإعادة بعد تمام ما يُسمَع لا فوقه
  }

  /** صواب في تمرين سماعيّ: أثرٌ بصريّ بلا إعادة قراءة، ثم التمرين التالي (DESIGN §٥.٢).
   *  والانتقالُ بقاعدة «لا انتقالَ وكلامٌ في الجوّ» (بلاغ احسب): سكوتُ القناة ومهلةُ
   *  العين معاً — فالتمرين الصامت ينتقل بمهلته كما كان، والناطق يُتمّ كلامه أولاً. */
  function right(btn) {
    btn.classList.add('good');
    pop(btn);
    audio.afterSpeech(750, next);   // ثم ٢٥٠ م.ث قبل نداء التمرين التالي: فاصلٌ يُسمع
  }

  // ————— ١) ميّز بأذنك: أيَّ حرف سمعت؟ —————

  function quizView(item) {
    let locked = false;
    const play = () => audio.play(item.letter + item.mark);
    const row = h('div', { class: 'row vrow' }, item.options.map((ch) => {
      const text = ch + item.mark;
      const btn = h('button', {
        class: 'vchip vchip--big',
        'aria-label': text,
        onclick: () => {
          if (locked) return;
          const correct = ch === item.letter;
          score(item, item.letter, item.haraka, correct);
          if (!correct) return wrong(btn, play);
          locked = true;
          right(btn);
        },
      }, h('span', { class: 'vchip-face' }, text));
      return btn;
    }));

    audio.afterSpeech(250, play);   // نداءُ التمرين بعد سكوت ما قبله
    return h('div', {},
      h('h2', {}, 'أيَّ حرف سمعت؟'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: play }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
  }

  // ————— ١ب) ميّز بين: الخياران هما الزوج المتشابه نفسه (الحزمة ١٣) —————

  /**
   * «اجمع العائلة» في المراجعة: **لا صوتَ قبل الاختيار** (القراءةُ هي المقيسة هنا
   * لا السماع)، والخطأُ يُسمِع ما نُقر. والخياراتُ بنصّها كاملَ الشكل — حصانةُ الحوض.
   */
  function rootView(item) {
    let locked = false;
    const row = h('div', { class: 'row vrow' }, item.options.map((text) => {
      const btn = h('button', {
        class: 'vchip root-option',
        'aria-label': text,
        onclick: () => {
          if (locked) return;
          const correct = text === item.target;
          score(item, `root-${item.root.id}`, null, correct);
          if (!correct) return void wrong(btn, () => audio.play(memberSay(text)));
          locked = true;
          right(btn);
          audio.play(memberSay(text));
        },
      }, h('span', { class: 'vchip-face' }, text));
      return btn;
    }));

    return h('div', {},
      h('h2', {}, `أيُّ كلمةٍ من شجرة ${item.root.title}؟`),
      h('p', { class: 'hint' }, item.root.sense),
      h('div', { class: 'root-trunk root-trunk--small' },
        ...[...item.root.root].map((c) => h('span', { class: 'root-letter' }, c))),
      row,
    );
  }

  // ————— ١ج) العلامة: قراءةً صامتة ثم سماعاً (حزمة «قياس العلامات») —————

  /**
   * «أيُّهما مَمدود؟» — **لا صوتَ قبل الاختيار**: المقيسُ هنا أن يرى الطفلُ العلامةَ
   * في الرسم ويعرف أثرها، لا أن يميّزها بأذنه (لذلك تمرينان لا واحد). والخطأُ يُسمِع
   * ما نقره هو، والصوابُ يُنطق بعد قراءته — قراءةٌ ثم تصديقٌ بالأذن.
   */
  function markCompareView(item) {
    let locked = false;
    const row = h('div', { class: 'row vrow' }, item.options.map((text) => {
      const btn = h('button', {
        class: 'vchip vchip--pair',
        'aria-label': text,
        onclick: () => {
          if (locked) return;
          const correct = text === item.target;
          score(item, item.letter, item.haraka, correct);
          if (!correct) return void wrong(btn, () => audio.play(text));
          locked = true;
          right(btn);
          audio.play(text);
        },
      }, h('span', { class: 'vchip-face' }, text));
      return btn;
    }));

    return h('div', {},
      h('h2', {}, `أيُّهما ${item.label}؟`),
      h('p', { class: 'hint' }, item.note || `${item.mark.title} — الفرق في العلامة وحدها`),
      row,
    );
  }

  // ————— ١د) المرحلة القرآنية: علامةُ الرسم وفواتحُ السور (الحكمان ب١ وب٣) —————

  /**
   * «أيُّ علامة في هذه الكلمة؟» — كلمةٌ عثمانية معروضة بلا صوت (كلامُ الله يُقرأ
   * بالعين هنا ولا يُنطق آلياً)، والخطأُ يُسمِع **قاعدةَ ما اختاره** لا الصواب.
   */
  function rasmView(item) {
    let locked = false;
    const row = h('div', { class: 'row vrow' }, item.options.map((sign) => {
      const btn = h('button', {
        class: 'vchip vchip--sign',
        'aria-label': sign.name,
        onclick: () => {
          if (locked) return;
          const correct = sign.sign === item.target.sign;
          score(item, item.letter, item.haraka, correct);
          if (!correct) return void wrong(btn, () => audio.play(sign.rule));
          locked = true;
          right(btn);
        },
      },
        h('span', { class: 'vchip-face' }, sign.sign),
        h('small', {}, sign.name));
      return btn;
    }));

    return h('div', {},
      h('h2', {}, 'أيُّ علامة في هذه الكلمة؟'),
      h('p', { class: 'mushaf mushaf--big' }, item.target.read),
      h('p', { class: 'hint' }, `من سورة ${item.target.from}`),
      row,
    );
  }

  /** «أيَّ فواتحَ سمعت؟» — أسماءُ الحروف بالتتابع، والمقطَّعةُ تُقرأ بالعين. */
  function muqView(item) {
    let locked = false;
    const say = (m) => audio.playSequence(muqSays(m), MUQ_GAP_MS);
    const row = h('div', { class: 'row vrow' }, item.options.map((m) => {
      const btn = h('button', {
        class: 'vchip vchip--sign',
        'aria-label': muqSays(m).join(' '),
        onclick: () => {
          if (locked) return;
          const correct = m.read === item.target.read;
          score(item, item.letter, item.haraka, correct);
          if (!correct) return void wrong(btn, () => say(m));
          locked = true;
          right(btn);
        },
      }, h('span', { class: 'vchip-face mushaf' }, m.read));
      return btn;
    }));

    audio.afterSpeech(250, () => say(item.target));   // نداءُ التمرين بعد سكوت ما قبله
    return h('div', {},
      h('h2', {}, 'أيَّ فواتحَ سمعت؟'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => say(item.target) },
          icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
  }

  /** «أيَّ واحدة سمعت؟» على مادّة الدرس نفسِها — تمييزُ العلامة بالأذن. */
  function markQuizView(item) {
    let locked = false;
    const play = () => audio.play(item.target);
    const row = h('div', { class: 'row vrow' }, item.options.map((text) => {
      const btn = h('button', {
        class: 'vchip vchip--pair',
        'aria-label': text,
        onclick: () => {
          if (locked) return;
          const correct = text === item.target;
          score(item, item.letter, item.haraka, correct);
          if (!correct) {
            // يسمع ما اختاره ليقارنه، ثم يُعاد الهدف بمهلةٍ تفصل الصوتين (كما في الدرس)
            wrong(btn);
            audio.play(text);
            return void audio.afterSpeech(500, play);   // الهدفُ بعد تمام صدى المختار
          }
          locked = true;
          right(btn);
        },
      }, h('span', { class: 'vchip-face' }, text));
      return btn;
    }));

    audio.afterSpeech(250, play);   // نداءُ التمرين بعد سكوت ما قبله
    return h('div', {},
      h('h2', {}, 'أيَّ واحدة سمعت؟'),
      h('p', { class: 'hint' }, item.mark.title),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: play }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
  }

  function contrastView(item) {
    let locked = false;
    const play = () => audio.play(item.letter + item.mark);
    const row = h('div', { class: 'row vrow' }, item.options.map((ch) => {
      const text = ch + item.mark;
      const btn = h('button', {
        class: 'vchip vchip--big',
        'aria-label': text,
        onclick: () => {
          if (locked) return;
          const correct = ch === item.letter;
          score(item, item.letter, item.haraka, correct);
          if (!correct) {
            wrong(btn);
            return void compareSounds(text, item.letter + item.mark);   // «اسمع الفرق»
          }
          locked = true;
          right(btn);
        },
      }, h('span', { class: 'vchip-face' }, text));
      return btn;
    }));

    audio.afterSpeech(250, play);   // نداءُ التمرين بعد سكوت ما قبله
    return h('div', {},
      h('h2', {}, 'أيَّ حرف سمعت؟'),
      h('p', { class: 'hint' }, 'الحرفان متشابهان — أنصت للفرق'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: play }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
  }

  // ————— ٢) الحركات: أيَّ حركة سمعت؟ —————

  function harakaView(item) {
    let locked = false;
    const play = () => audio.play(item.letter + item.mark);
    const row = h('div', { class: 'row vrow' }, item.options.map((k) => {
      const text = item.letter + k.mark;
      const btn = h('button', {
        class: 'vchip',
        'aria-label': `${item.letter} بال${k.name}`,
        onclick: () => {
          if (locked) return;
          const correct = k.key === item.haraka;
          score(item, item.letter, item.haraka, correct);
          if (!correct) return wrong(btn, play);
          locked = true;
          right(btn);
        },
      },
        h('span', { class: 'vchip-face' }, text),
        h('small', {}, k.name));
      return btn;
    }));

    audio.afterSpeech(250, play);   // نداءُ التمرين بعد سكوت ما قبله
    return h('div', {},
      h('h2', {}, `أيَّ حركة سمعت مع ${letterTitle(item.letter)}؟`),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: play }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
  }

  // ————— ٣) ركّب الكلمة (لوح واحد من لعبة الكلمات) —————

  function buildView(item) {
    const { word, board } = item;
    let filled = 0;
    const token = state.token;

    const slotEls = word.tiles.map(() => h('span', { class: 'slot' }));
    const slots = h('div', { class: 'slots' }, slotEls);
    const built = h('div', { class: 'built' });

    const tiles = h('div', { class: 'tiles' }, board.map((tile) => {
      const btn = h('button', {
        class: 'tile',
        'aria-label': `مقطع ${tile.text}`,
        onclick: () => onTile(tile, btn),
      }, h('span', { class: 'tile-face' }, tile.text));
      return btn;
    }));

    function onTile(tile, btn) {
      if (filled >= word.tiles.length) return;
      const expected = word.tiles[filled];
      const skill = syllableSkill(expected) || {};
      const correct = tile.text === expected;
      score(item, skill.letter, skill.haraka, correct);
      if (!correct) {
        audio.play(tile.text);        // يسمع ما اختاره فيقارنه بما تحتاجه الكلمة
        return wrong(btn);
      }
      btn.disabled = true;
      btn.classList.add('tile--used');
      slotEls[filled].textContent = tile.text;
      slotEls[filled].classList.add('slot--filled');
      filled++;
      if (filled < word.tiles.length) return void audio.play(tile.text);

      for (const b of tiles.children) b.disabled = true;
      slots.classList.add('slots--done');
      built.replaceChildren(h('div', { class: 'word-built' }, wordText(word)));
      (async () => {
        await audio.play(word.say);
        if (token !== state.token || !root?.isConnected) return;   // سبقنا الطفل أو غادر
        next();
      })();
    }

    return h('div', {},
      h('h2', {}, 'ركّب الكلمة'),
      h('button', {
        class: 'wgame-pic',
        'aria-label': `اسمع كلمة ${word.say}`,
        onclick: () => audio.play(word.say),
      },
        faceEl(word.emoji, 'pic-emoji'),
        h('span', { class: 'pic-ear' }, icon('ear')),
      ),
      slots,
      built,
      tiles,
    );
  }

  // ————— ٤) رتّب الجملة (لوح واحد من سلّم الجمل) —————

  function orderView(item) {
    const { sentence, board } = item;
    let filled = 0;
    const token = state.token;

    const slotEls = sentence.words.map(() => h('span', { class: 'slot slot--word' }));
    const slots = h('div', { class: 'slots' }, slotEls);
    const built = h('div', { class: 'built' });

    const tiles = h('div', { class: 'tiles tiles--words' }, board.map((tile) => {
      const btn = h('button', {
        class: 'tile tile--word',
        'aria-label': `كلمة ${tile.text}`,
        onclick: () => onTile(tile, btn),
      }, h('span', { class: 'tile-face' }, tile.text));
      return btn;
    }));

    function onTile(tile, btn) {
      if (filled >= sentence.words.length) return;
      const expected = sentence.words[filled];
      const skill = wordSkill(expected) || {};
      const correct = tile.text === expected;
      score(item, skill.letter, skill.haraka, correct);
      if (!correct) {
        audio.play(tile.text);         // يسمع ما اختاره فيقارنه بما تحتاجه الجملة
        return wrong(btn);
      }
      // **شاهدُ المراجعة** (حكم المدير، ١٢ أغسطس ٢٠٢٦ — حزمة المكتبة): «رتّب» هنا هو
      // «رتّب» في السلّم بعينه — الكلمةُ المطلوبة **في موضعها** بين بلاطاتٍ ومشتّتات،
      // فهو **موضعُ شاهدٍ واحد** بحدّه المُقَرّ في `fade.js`. وكان يُقاس في ليتنر ولا
      // يُحتسب في عدّاد الخفوت، فبقيت العتباتُ لا تُبلَغ: ٨ كلماتٍ في الرحلة كلِّها
      // تبلغ ز٣ و٥٢٩ تبقى ز١ (محسوبٌ من البيانات، `docs/REVIEW_LIBRARY.md` §٧).
      //
      // **وهو اتّساقٌ لا توسيع**: المادّةُ جملةٌ أتمّ الطفلُ درجتَها، والتمرينُ هو هو،
      // بل **تباعدُه أنظف** — وحدةُ يوم ليتنر هي وحدةُ يوم العدّاد نفسُها. والحدُّ
      // قائمٌ كما هو (`MAX_ORDER = 1` لكل جلسة ⇒ خمسُ كلماتٍ في اليوم على الأكثر).
      credit(expected);
      btn.disabled = true;
      btn.classList.add('tile--used');
      slotEls[filled].textContent = tile.text;
      slotEls[filled].classList.add('slot--filled');
      filled++;
      if (filled < sentence.words.length) return void audio.play(tile.text);

      for (const b of tiles.children) b.disabled = true;
      slots.classList.add('slots--done');
      built.replaceChildren(h('p', { class: 'sentence sentence--built' }, sentence.text));
      (async () => {
        await audio.play(sentence.text);
        if (token !== state.token || !root?.isConnected) return;   // سبقنا الطفل أو غادر
        next();
      })();
    }

    return h('div', {},
      h('h2', {}, 'رتّب الجملة'),
      h('button', {
        class: 'wgame-pic',
        'aria-label': `اسمع كلمة ${sentence.target.word}`,
        onclick: () => audio.play(sentence.target.say),
      },
        faceEl(sentence.target.emoji, 'pic-emoji'),
        h('span', { class: 'pic-ear' }, icon('ear')),
      ),
      slots,
      built,
      tiles,
    );
  }

  // ————— الختام —————

  /** إعادة المحاولة: تمارين تُبنى من جديد (لا نمط يُحفظ) وحالةٌ نظيفة. */
  function again() {
    const next = make();
    if (!next.length) return void go('#/');
    items = next;
    Object.assign(state, {
      index: 0, errors: 0, right: 0, done: false, missed: false, missedItems: 0, rightItems: 0,
    });
    paint();
  }

  function finish() {
    audio.stop();
    state.done = true;
    state.token++;
    paintDots();
    body.replaceChildren(verdict({
      right: state.right,
      errors: state.errors,
      rightItems: state.rightItems,
      missedItems: state.missedItems,
      items,
      again,
    }));
  }

  paint();

  root = h('div', { class: 'screen lesson', css: { '--accent': accent } },
    topbar(
      h('button', {
        class: 'btn',
        onclick: () => { if (state.done || state.index === 0 || confirm(leaveAsk)) go('#/'); },
      }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, pill),
    ),
    h('main', { class: 'screen-card' },
      header,
      dots,
      body,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `التمارين: ${items.map((i) => i.kind).join('، ')}`),
          h('button', { class: 'btn', onclick: () => toast(`أخطاء: ${arNum(state.errors)}`) }, 'عدّ الأخطاء'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء الجلسة الآن'),
        )),
    ),
  );
  return root;
}

// ————— شاشة مراجعة اليوم —————

/** أزواج المواجهة التي صار الطفل يملك حرفيها كليهما — وما نقص حرفُه لا يُسأل عنه. */
export const studiedPairs = (letters) =>
  contrastPairs().filter((p) => p.letters.every((c) => letters.includes(c)));

export function renderReview() {
  const make = () => {
    const letters = progress.studiedLetters();
    const words = progress.studiedWords(letters);
    const sentences = progress.studiedSentences().filter((s) => s.mechanic === 'order');
    return buildSession({
      letters, words, sentences, pairs: studiedPairs(letters), marks: progress.studiedMarks(),
      signs: progress.studiedRasm(), muq: progress.studiedMuqattaat(),
      due: progress.dueSkills(),
    });
  };

  return renderSession({
    make,
    pill: 'مراجعة اليوم',
    leaveAsk: 'تريد الخروج قبل إتمام المراجعة؟',
    verdict: ({ right, errors, items }) => {
      progress.markReview(right + errors, right);
      const stars = starsForReview(errors, items.length);
      const streak = progress.reviewStreak();
      const line = errors === 0
        ? cheer('مراجعة بلا خطأ واحد!')
        : `أصبتَ ${arNum(right)} من ${arNum(right + errors)} محاولة — وما أخطأتَ فيه يعود غداً.`;

      return h('div', { class: 'celebrate' },
        mascot('mascot mascot--cheer'),
        h('div', { class: 'celebrate-face' }, icon('repeat')),
        h('h2', {}, 'أتممتَ مراجعة اليوم!'),
        starsRow(stars, 'big-stars'),
        h('p', { class: 'hint' }, line),
        streak > 1 && h('p', { class: 'note' },
          icon('flame'),
        ` ${arCount(streak, ['يوم', 'يومان متتاليان', 'أيام متتالية', 'يوماً متتالياً'])} من المراجعة`),
        h('div', { class: 'row foot' },
          h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة')),
      );
    },
  });
}
