// تقدّم الطفل: نجوم كل عقدة + قواعد فتح المجموعات + سجلّ المهارات ودقائق الاستخدام،
// محفوظ كله في localStorage. حساب واحد في هذه المرحلة.
//
// سجلّ المهارات (الجلسة ٥ · METHOD §٦): كل تمرين يسجَّل على مستوى
// **الحرف × الحركة × نوع التمرين**، ومنه يُبنى التكرار المتباعد وجلسة المراجعة
// ولوحة وليّ الأمر. لا نصّ منطوق جديد هنا — القياس لا يضيف محتوى.

import {
  GROUPS, SKILLS, STORIES, QURAN, GATES, CONTRASTS, gateBefore, quranParts, bareLetters,
} from './curriculum.js';
import { GARDENS } from './lexicon.js';
import { ladderOf, stemOf } from './sentences.js';
import { libraryOf } from './library.js';

const STORE_KEY = 'muallim.progress.v1';
export const VERSION = 2;            // ١ = نجوم فقط (تُرقّى تلقائياً بلا فقد)
export const MAX_STARS = 3;
export const WORDS_PART = 'words';   // عقدة لعبة الكلمات في آخر كل مجموعة

/** أنواع التمارين المقيسة — أسماؤها ثابتة لأنها تُخزَّن في مفاتيح المهارات. */
export const KINDS = {
  QUIZ: 'quiz', HARAKA: 'haraka', BUILD: 'build', ORDER: 'order', CONTRAST: 'contrast',
};

/** تباعد ليتنر بالأيام: كل إجابة صحيحة ترفع الصندوق، والخطأ يعيده إلى الصفر. */
export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = BOX_DAYS.length - 1;
export const MASTERED_BOX = 3;       // من بلغه في كل تمارينه يُعدّ متقناً

const listeners = new Set();

// ————— ذاكرة البنية والجبهة —————
// بنية الرحلة ثابتة وقت التشغيل (بيانات منهج لا حالة طفل)، فتُبنى مرّة واحدة في
// الجلسة. وحدها «جبهة الفتح» تتحرّك بالنجوم، فتُبطَل مع كل حفظ لا مع كل قراءة.
let journeyCache = null;
let nodesCache = null;
let indexCache = null;      // معرّف العقدة ← موضعها في الرحلة (بحثٌ بزمن ثابت)
let frontierCache = null;   // موضع أول عقدة ناقصة — null = يحتاج حساباً

function blank() {
  return {
    v: VERSION,
    stars: {},        // معرّف عقدة ← نجوم
    skills: {},       // «حرف|حركة|تمرين» ← {right, wrong, box, due, seen}
    days: {},         // «YYYY-MM-DD» ← ثوانٍ من الاستعمال الفعلي
    reviews: {},      // «YYYY-MM-DD» ← {items, right, at}
    records: [],      // «اقرأ لي»: [{node, title, seconds, day, at}] — بيانٌ نصيّ لا صوت
    reads: {},        // «جذع كلمة» ← {n, day} — عدّاد خفوت التشكيل (حزمة الخفوت)
    mic: false,       // إذنُ وليّ الأمر بالتسجيل (يُعطى مرة واحدة خلف بوابته)
    seconds: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** ترقية حالة قديمة إلى النسخة الحالية دون فقد نجوم الطفل. */
function migrate(data) {
  if (!data || typeof data !== 'object' || typeof data.stars !== 'object') return null;
  if (data.v !== 1 && data.v !== VERSION) return null;
  const { errors, ...rest } = data;   // errors: حقل النسخة ١ المحجوز، حلّت محلّه skills
  return { ...blank(), ...rest, v: VERSION };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blank();
    return migrate(JSON.parse(raw)) || blank();
  } catch {
    return blank();   // تخزين معطّل أو ممتلئ: نكمل في الذاكرة بلا انهيار
  }
}

let state = load();

// ————— ترحيل إعادة ترتيب الرحلة (الحزمة ١٤) —————
// إعادةُ الترتيب شأنُنا نحن لا تقصيرُ الطفل، فلا يُحبَس أحد رجعياً: العقدةُ المشقوقة
// نجومُها لشطريها، والبوابةُ الجديدة تُعدّ مجتازةً لمن كان قد عبر مفصلَها قبل وجودها
// (نجمةٌ في عقدةٍ بعدها = عبورٌ فعليّ). ترحيلٌ بالبيانات لا برقم نسخة — فلا تُرفَع
// `VERSION` هنا: رفعُها يُسقِط حالةَ كل طفل قائم (`migrate` لا تقبل غير ١ والحالية).

/**
 * الدرسُ المشقوق ← شطراه: من درس المدّ كلَّه فقد درس شطريه، ومن درس «كلمات من القرآن»
 * الثمانَ فقد درس درجاتِها الثلاث (الحزمة ١٢ — الثمانُ موزَّعةٌ فيها كما هي).
 */
const SPLIT_NODES = {
  'skill:madd': ['skill:madd-alif', 'skill:madd-waw-ya'],
  'quran:words': ['quran:words1', 'quran:words2', 'quran:words3'],
};

function migrateJourney() {
  if (!Object.keys(state.stars).length) return;   // طفلٌ جديد: لا شيء يُرحَّل
  let changed = false;

  for (const [old, heirs] of Object.entries(SPLIT_NODES)) {
    const stars = state.stars[old];
    if (!stars) continue;
    for (const heir of heirs) if (!state.stars[heir]) state.stars[heir] = stars;
    delete state.stars[old];
    changed = true;
  }

  const nodes = allNodes();
  let last = -1;                                  // موضع آخر عقدة لها نجمة
  for (const [i, node] of nodes.entries()) if (state.stars[node.id] > 0) last = i;
  for (const [i, node] of nodes.entries()) {
    if (state.stars[node.id] || i >= last) continue;
    if (node.type === 'gate') {
      state.stars[node.id] = MAX_STARS;           // بوابةٌ عبَر مفصلَها قبل وجودها ⇒ مجتازة
      changed = true;
    } else if (node.type === 'contrast' || node.type === 'quran') {
      // محطةٌ استحدثناها خلف موضع الطفل: نجمةُ إتمامٍ واحدة تفكّ حبسه ولا تدّعي إتقاناً —
      // فتبقى تدعوه إلى لعبها (النجوم لا تنقص، فما يكسبه حين يلعبها يعلو عليها).
      // ويشمل ذلك محطاتِ «كلمات السورة» المستحدثة أمام سورٍ قرأها الطفل (الحزمة ١٢):
      // القفلُ تسلسليّ، فمحطةٌ جديدة قبل سورةٍ مقروءة كانت ستُعيد قفلَ ما بعدها كلِّه.
      state.stars[node.id] = 1;
      changed = true;
    }
  }

  if (changed) save();
}

function save() {
  frontierCache = null;   // النجوم وحدها تحرّك الجبهة، وكل تغيّر فيها يمرّ من هنا
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    console.warn('[progress] تعذّر الحفظ في localStorage');
  }
  for (const fn of listeners) fn(state);
}

migrateJourney();

/** الاشتراك في تغيّر التقدّم (لإعادة رسم الخريطة). */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ————— العقد —————

/** معرّف عقدة: «g1:ب» لدرس حرف، «g1:words» للعبة الكلمات. */
export function nodeId(groupId, part) {
  return `${groupId}:${part}`;
}

/** عقد المجموعة بالترتيب: كل حرف ثم لعبة الكلمات. */
export function groupNodes(group) {
  const nodes = group.letters.map((letter) => ({
    id: nodeId(group.id, letter),
    type: 'letter',
    groupId: group.id,
    part: letter,
    letter,
  }));
  nodes.push({
    id: nodeId(group.id, WORDS_PART),
    type: 'words',
    groupId: group.id,
    part: WORDS_PART,
  });
  return nodes;
}

export function findGroup(groupId) {
  return GROUPS.find((g) => g.id === groupId) || null;
}

/**
 * عقد ما بين المجموعات (الجلسة ٤): دروس المهارات ثم القصص التي تلي مجموعةً ما.
 * المهارة قبل القصة لأن القصة تُوظّف علامتها (شدّة ← قصة فيها شدّة).
 */
export function interludeNodes(groupId) {
  return [
    ...SKILLS.filter((s) => s.after === groupId).map((skill) => ({
      id: `skill:${skill.id}`, type: 'skill', groupId, part: skill.id, skill,
    })),
    ...STORIES.filter((s) => s.after === groupId).map((story) => ({
      id: `story:${story.id}`, type: 'story', groupId, part: story.id, story,
    })),
  ];
}

/**
 * عقد المرحلة القرآنية (الجلسة ٦): خاتمة الرحلة بعد المجموعة السابعة وما تلاها.
 * ترتيبها من `quranParts()` — بيانات المنهج وحدها تحدّد ما فيها.
 */
export function quranNodes() {
  return quranParts().map(({ part, title, face }) => ({
    id: `quran:${part}`, type: 'quran', groupId: QURAN.after, part, title, face,
  }));
}

/**
 * عقدة «بوابة الإتقان» (الحزمة ١٤): عقدةٌ واحدة تقف قبل مفصلٍ كبير، لا تُجتاز
 * بالإتمام بل بالإصابة — وحدها في محطتها كي يراها الطفل بوّابةً لا درساً.
 */
export function gateNodes(gate) {
  return [{ id: `gate:${gate.id}`, type: 'gate', part: gate.id, gate }];
}

/**
 * عقدة «ميّز بين» (الحزمة ١٣): محطةُ مواجهةٍ واحدة بعد مجموعتها — عقدةٌ واحدة
 * تجمع أزواجها كلها، فجولتان لكل زوج درسٌ واحد لا دروسٌ من جولتين.
 */
export function contrastNodes(contrast) {
  return [{
    id: `contrast:${contrast.id}`, type: 'contrast',
    groupId: contrast.after, part: contrast.id, contrast,
  }];
}

/**
 * عقد بستان الموضوعات (الحزمة ٧): باقةٌ لكل عقدة، بترتيب `lexicon.js`.
 * موضعها بعد المرحلة القرآنية — حصيلة الطفل عندها كاملة، فالجديد رصيدٌ لا شيفرة.
 */
export function gardenNodes(garden) {
  return garden.bundles.map((bundle) => ({
    id: `garden:${bundle.id}`, type: 'garden', part: bundle.id, garden, bundle,
  }));
}

/**
 * عقد «سلّم الجمل» (الحزمة ٨): درجةٌ لكل عقدة، بعد باقات بستانها كلها —
 * فالجملة لا تُعرض إلا وكلماتها كلها مدروسة (`sentences.js` يضمن موضعها).
 */
export function ladderNodes(ladder) {
  return ladder.rungs.map((rung) => ({
    id: `ladder:${rung.id}`, type: 'ladder', part: rung.id, garden: ladder.garden, rung,
  }));
}

/**
 * عقد «مكتبة القصص» (الحزمة ٩): قصةٌ لكل عقدة، بعد سلّم جمل بستانها —
 * فلا تُعرض قصةٌ إلا وكلماتُها كلها مدروسة (`library.js` وفاحصُه يضمنان موضعها).
 * وبها يكتمل تدرّج البستان: كلماتُه ← جملُه ← قصةٌ تجمعها.
 */
export function libraryNodes(garden) {
  return libraryOf(garden.id).map((story) => ({
    id: `library:${story.id}`, type: 'library', part: story.id, garden, story,
  }));
}

/**
 * الرحلة كاملةً بأقسامها بالترتيب: مجموعة ← ما بعدها من مهارات وقصص ← محطة «ميّز بين»
 * إن كانت لها ← … ← بوابة المصحف ← المرحلة القرآنية ← بوابة الحديقة ←
 * (بستان ← سلّم جمله ← قصصه) × البساتين.
 *
 * ومحطة المواجهة **بعد مهارات مجموعتها وقصصها**: الحرف يُدرَس، ثم تُسمّى علامته،
 * ثم تُقرأ قصته، ثم يُواجَه بشبيهه — فالمواجهة مراجعةٌ لما استقرّ لا امتحانٌ لما جدّ.
 */
export function journey() {
  if (journeyCache) return journeyCache;
  const out = [];
  // البوابة بيانٌ مُعلَن: إن سقطت من `GATES` سقطت من الرحلة، ولا يبقى لها أثر في القفل
  const pushGate = (where) => {
    const gate = gateBefore(where);
    if (gate) out.push({ kind: 'gate', id: `gate:${gate.id}`, gate, nodes: gateNodes(gate) });
  };

  for (const group of GROUPS) {
    out.push({ kind: 'group', id: group.id, group, nodes: groupNodes(group) });
    const nodes = interludeNodes(group.id);
    if (nodes.length) out.push({ kind: 'interlude', id: `after:${group.id}`, after: group.id, nodes });
    for (const contrast of CONTRASTS.filter((c) => c.after === group.id)) {
      out.push({
        kind: 'contrast', id: `contrast:${contrast.id}`, contrast, nodes: contrastNodes(contrast),
      });
    }
  }
  pushGate('quran');
  out.push({ kind: 'quran', id: 'quran', nodes: quranNodes() });
  pushGate('gardens');
  for (const garden of GARDENS) {
    out.push({ kind: 'garden', id: `garden:${garden.id}`, garden, nodes: gardenNodes(garden) });
    const ladder = ladderOf(garden.id);
    if (ladder?.rungs.length) {
      out.push({ kind: 'ladder', id: `ladder:${garden.id}`, garden, ladder, nodes: ladderNodes(ladder) });
    }
    const stories = libraryNodes(garden);
    if (stories.length) {
      out.push({ kind: 'library', id: `library:${garden.id}`, garden, nodes: stories });
    }
  }
  journeyCache = out;
  return out;
}

/** كل عقد الرحلة بالترتيب — عليها يقوم القفل التسلسلي وحساب النجوم. */
export function allNodes() {
  if (!nodesCache) nodesCache = journey().flatMap((section) => section.nodes);
  return nodesCache;
}

/** موضع العقدة في الرحلة أو ‑١ — من فهرسٍ مبنيّ مرّة، لا بمسح القائمة في كل نداء. */
function indexOf(id) {
  if (!indexCache) indexCache = new Map(allNodes().map((n, i) => [n.id, i]));
  const index = indexCache.get(id);
  return index === undefined ? -1 : index;
}

export function findNode(id) {
  const index = indexOf(id);
  return index < 0 ? null : allNodes()[index];
}

// ————— النجوم —————

export function getStars(id) {
  return state.stars[id] || 0;
}

export function isDone(id) {
  return getStars(id) > 0;
}

/**
 * تسجيل نتيجة عقدة. لا يُنقص ما سبق: تكرار الدرس يرفع النجوم ولا يخفضها.
 * @returns {boolean} هل تحسّنت النتيجة؟
 */
export function setStars(id, stars) {
  const n = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
  if (n <= getStars(id)) return false;
  state.stars[id] = n;
  save();
  return true;
}

/** نجوم المجموعة الحالية وسقفها. */
export function groupStars(group) {
  const nodes = groupNodes(group);
  return {
    earned: nodes.reduce((sum, n) => sum + getStars(n.id), 0),
    max: nodes.length * MAX_STARS,
    doneNodes: nodes.filter((n) => isDone(n.id)).length,
    totalNodes: nodes.length,
  };
}

export function totalStars() {
  return allNodes().reduce((sum, n) => sum + getStars(n.id), 0);
}

export function maxTotalStars() {
  return allNodes().length * MAX_STARS;
}

// ————— القفل التسلسلي —————
// قاعدة واحدة تحكم الرحلة كلها: العقدة تُفتح بإتمام كل ما قبلها في `allNodes()`.
// فينتظم في حبل واحد: حروف المجموعة، ثم لعبة كلماتها، ثم مهارات ما بعدها وقصصه.
//
// والحبلُ الواحد يختصر القاعدة في رقم: ما دام كل ما قبل العقدة يجب أن يكون منجَزاً،
// فيكفي موضعُ **أول عقدة ناقصة** — «جبهة الفتح». وبها صار القفل قراءةَ رقمٍ لكل
// عقدة بدل مسحِ كل سوابقها (١٦٢ عقدة كانت تُكلّف الرسمة الواحدة عشرات الآلاف من
// المقارنات، وتزداد كلما تقدّم الطفل — بلاغ بطء الخريطة على آيباد قديم).

/**
 * «جبهة الفتح»: موضع أول عقدة لم تُنجَز (وطولُ الرحلة إن أُتمّت كلها).
 * كل ما قبلها منجَزٌ بالضرورة، فالعقدة مفتوحة إن كان موضعها ≤ الجبهة — وهي عينُ
 * القاعدة الأصلية لا تقريبٌ لها. تُحسب كسولاً مرّةً وتُبطَل مع كل حفظ.
 */
export function unlockFrontier() {
  if (frontierCache === null) {
    const nodes = allNodes();
    let i = 0;
    while (i < nodes.length && isDone(nodes[i].id)) i++;
    frontierCache = i;
  }
  return frontierCache;
}

/** العقدة مفتوحة = كل ما سبقها في الرحلة مُنجَز (أي: موضعها ≤ الجبهة). */
export function isNodeUnlockedById(id) {
  const index = indexOf(id);
  return index >= 0 && index <= unlockFrontier();
}

/** المجموعة مكتملة = كل حروفها ولعبة كلماتها أُنجزت. */
export function isGroupComplete(group) {
  return groupNodes(group).every((n) => isDone(n.id));
}

/** تُفتح المجموعة الأولى دائماً، وما بعدها بإتمام سابقتها وما تلاها من مهارات وقصص. */
export function isGroupUnlocked(groupId) {
  const group = findGroup(groupId);
  return group ? isNodeUnlockedById(groupNodes(group)[0].id) : false;
}

/** عقدة داخل مجموعة (حرف أو لعبة كلمات) بمعرّفها المركّب. */
export function isNodeUnlocked(groupId, part) {
  return isNodeUnlockedById(nodeId(groupId, part));
}

/** أول عقدة لم تُنجَز في الرحلة — «تابع من هنا». */
export function nextNode() {
  return allNodes()[unlockFrontier()] || null;   // خارج القائمة = اكتملت الرحلة
}

// ————— حصيلة الطفل (ما يجوز أن يظهر له في المراجعة) —————

/** الحروف التي أتمّ دروسها فعلاً، بترتيب المنهج — مرجع المفكوكية في المراجعة. */
export function studiedLetters() {
  const out = [];
  for (const group of GROUPS) {
    for (const letter of group.letters) {
      if (isDone(nodeId(group.id, letter))) out.push(letter);
    }
  }
  return out;
}

/**
 * كلمات المنهج المفكوكة بحصيلته: كل حروفها مدروسة (لا يشترط إتمام لعبة مجموعتها)،
 * **يليها ما أتمّه من كلمات البساتين** — فما قِيس في بستانٍ يُراجَع بكلماته نفسها.
 * (الباقة المُنجَزة دليلُ فكّها: لا تُفتح إلا بعد الرحلة كلها بحروفها وعلاماتها.)
 */
export function studiedWords(letters = studiedLetters()) {
  const known = new Set(letters);
  const out = [];
  for (const group of GROUPS) {
    for (const word of group.words) {
      if ([...bareLetters(word.tiles.join(''))].every((c) => known.has(c))) out.push(word);
    }
  }
  return [...out, ...studiedLexicon()];
}

/** كلمات الباقات التي أتمّها الطفل — رصيدُه الجديد من «حديقة الكلمات». */
export function studiedLexicon() {
  const out = [];
  for (const garden of GARDENS) {
    for (const bundle of garden.bundles) {
      if (isDone(`garden:${bundle.id}`)) out.push(...bundle.words);
    }
  }
  return out;
}

/**
 * جمل الدرجات التي أتمّها الطفل — مادّة مراجعة «رتّب الجملة» (الحزمة ٨).
 * الدرجة المُنجَزة دليلُ قراءتها: لا تُفتح إلا بعد بستانها كله وما قبله.
 */
export function studiedSentences() {
  const out = [];
  for (const garden of GARDENS) {
    for (const rung of ladderOf(garden.id)?.rungs || []) {
      if (isDone(`ladder:${rung.id}`)) out.push(...rung.sentences);
    }
  }
  return out;
}

// ————— سجلّ المهارات والتكرار المتباعد —————

/** رقم اليوم المحلي (لا UTC): وحدة الجدولة في التكرار المتباعد. */
export function dayNumber(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

/** مفتاح اليوم «YYYY-MM-DD» بالتقويم المحلي (لسجلّ الدقائق والمراجعات). */
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** مفتاح المهارة: حرف × حركة × نوع تمرين. */
export function skillKey(letter, haraka, kind) {
  return `${letter}|${haraka || 'none'}|${kind}`;
}

export function parseSkillKey(key) {
  const [letter, haraka, kind] = String(key).split('|');
  return { letter, haraka, kind };
}

export function getSkill(key) {
  return state.skills[key] || null;
}

/** كل المهارات المسجّلة: [{key, letter, haraka, kind, right, wrong, box, due, seen}] */
export function skills() {
  return Object.entries(state.skills).map(([key, s]) => ({ key, ...parseSkillKey(key), ...s }));
}

/**
 * تسجيل محاولة واحدة. الصحيحة ترفع صندوق ليتنر فيتباعد موعدها،
 * والخاطئة تعيده إلى الصفر فتعود المهارة في مراجعة اليوم نفسه (METHOD §٦).
 * @returns {object|null} حالة المهارة بعد التسجيل
 */
export function recordAttempt(letter, haraka, kind, correct, today = dayNumber()) {
  if (!letter || !kind) return null;
  const key = skillKey(letter, haraka, kind);
  const s = state.skills[key] || { right: 0, wrong: 0, box: 0, due: today, seen: today };
  if (correct) {
    s.right++;
    s.box = Math.min(MAX_BOX, s.box + 1);
  } else {
    s.wrong++;
    s.box = 0;
  }
  s.due = today + BOX_DAYS[s.box];
  s.seen = today;
  state.skills[key] = s;
  save();
  return s;
}

/** ترتيب الضعف: أدنى صندوق، ثم أكثر أخطاءً، ثم أقدم استحقاقاً (وأخيراً المفتاح لثبات الترتيب). */
const byWeakness = (a, b) =>
  a.box - b.box || b.wrong - a.wrong || a.due - b.due || a.key.localeCompare(b.key);

/**
 * المستحقّ للمراجعة اليوم، الأضعف أولاً.
 * (المهارة التي لم تُلمس بعدُ ليست هنا — المراجعة تراجع ما مرّ به الطفل فعلاً.)
 */
export function dueSkills(today = dayNumber()) {
  return skills().filter((s) => s.due <= today).sort(byWeakness);
}

/**
 * كل المهارات المسجّلة بالأضعف أولاً **بلا نظر إلى موعد ليتنر** — مادّةُ بوابة الإتقان
 * (الحزمة ١٤): البوابة تسأل عن أضعف ما في يده لا عمّا حان موعده، فقد يحين موعد القويّ
 * وحده يوم البوابة فتمرّ بلا معنى.
 */
export function weakestSkills() {
  return skills().sort(byWeakness);
}

/**
 * حصيلة كل حرف من سجلّه: متقن (كل تمارينه بلغت صندوق الإتقان)،
 * أو متعثّر (خطآن فأكثر وما زال في الصناديق الدنيا)، أو قيد التعلّم.
 */
export function letterStats() {
  const byLetter = new Map();
  for (const s of skills()) {
    const acc = byLetter.get(s.letter)
      || { letter: s.letter, right: 0, wrong: 0, minBox: MAX_BOX, kinds: 0, seen: 0 };
    acc.right += s.right;
    acc.wrong += s.wrong;
    acc.minBox = Math.min(acc.minBox, s.box);
    acc.kinds++;
    acc.seen = Math.max(acc.seen, s.seen);
    byLetter.set(s.letter, acc);
  }
  // ترتيب المنهج، وما ليس في المجموعات (حرفا المرحلة القرآنية) في آخر اللوحة
  const order = GROUPS.flatMap((g) => g.letters);
  const rank = (ch) => (order.indexOf(ch) < 0 ? order.length : order.indexOf(ch));
  return [...byLetter.values()]
    .map((a) => ({
      ...a,
      attempts: a.right + a.wrong,
      mastered: a.minBox >= MASTERED_BOX,
      struggling: a.wrong >= 2 && a.minBox <= 1,
    }))
    .sort((a, b) => rank(a.letter) - rank(b.letter));
}

// ————— عدّاد القراءات الصحيحة لكل كلمة (حزمة «الخفوت» — ROADMAP §المرحلة ز) —————
//
// **لكل كلمة عتبةُ خفوتها الخاصة بتاريخ الطفل معها** — لا خفوت جماعي اعتباطي.
// وهذا مخزنُ التاريخ وحدَه: رقمٌ لكل كلمة ويومُ آخر ما احتُسب لها. أمّا العتبةُ
// والدرجاتُ وصورةُ الكلمة المخفوتة فتملكها `fade.js` (ولذلك لا تعرف هذه الوحدةُ
// شيئاً عن الخفوت — الاتجاه في اتجاهٍ واحد: `fade.js` ← `progress.js`).
//
// **مفتاح الكلمة جذعُها** (`stemOf` في `sentences.js` — القاعدة نفسُها التي يُطابَق
// بها هدفُ الجملة): «الْغُرْفَةُ» في جملةٍ و«غُرْفَةْ» على بطاقة بستانٍ كلمةٌ واحدة
// بعدّادٍ واحد، فتاريخُ الطفل معها تاريخٌ واحد لا تاريخان.
//
// و**التباعد شرطٌ بنيويّ**: لا تُحتسب للكلمة قراءتان في يومٍ واحد مهما تكرّرت في
// الدرجة الواحدة — «٣ قراءات صحيحة **متباعدة**» تعني ثلاثة أيام، لا ثلاث نقرات في
// جلسة. (والوحدة يومُ `dayNumber()` نفسُه الذي يجدول به ليتنر — لا وحدةَ زمنٍ ثانية.)

/** مفتاح الكلمة في عدّاد القراءات — جذعُها المشكول. */
export const wordKey = (text) => stemOf(String(text ?? ''));

/** السجلّ مضموناً كائناً — نسخةٌ احتياطية معطوبة لا تُسقِط قراءةً ولا كتابة. */
function reads() {
  if (!state.reads || typeof state.reads !== 'object') state.reads = {};
  return state.reads;
}

/** قراءات هذه الكلمة الصحيحة المتباعدة (صفرٌ لما لم يُقرأ بعد). */
export function readCount(key) {
  return reads()[key]?.n || 0;
}

/**
 * تسجيل قراءةٍ صحيحة لكلمة. **يومٌ واحد لا يزيد العدّاد إلا مرة**، فما تكرّر في
 * الجلسة الواحدة قراءةٌ واحدة — وهو معنى «متباعدة».
 * @returns {boolean} هل ارتفع العدّاد فعلاً؟
 */
export function recordRead(text, today = dayNumber()) {
  const key = wordKey(text);
  if (!key) return false;
  const before = reads()[key];
  if (before && before.day >= today) return false;
  reads()[key] = { n: (before?.n || 0) + 1, day: today };
  save();
  return true;
}

/**
 * «الشكل عند الطلب»: كشفُ تشكيل كلمةٍ مخفوتة **تراجعٌ جزئيّ** في عدّادها — درجةٌ
 * واحدة إلى الوراء لا تصفيرٌ. فالكلمةُ التي احتاج إلى شكلها لم تنضج بعدُ للعري،
 * وتعود إلى ما دون عتبتها فتُعرض مشكولةً حتى يقرأها متباعداً من جديد.
 * @returns {number} العدّاد بعد التراجع
 */
export function revealRead(text) {
  const key = wordKey(text);
  if (!key || !reads()[key]) return 0;
  const n = Math.max(0, reads()[key].n - 1);
  if (n) reads()[key] = { ...reads()[key], n };
  else delete reads()[key];         // لا نُبقي صفراً في التخزين
  save();
  return n;
}

/** كل الكلمات التي لها تاريخُ قراءة: [{key, n, day}] — مادّةُ لوحة وليّ الأمر. */
export function wordReads() {
  return Object.entries(reads()).map(([key, r]) => ({ key, ...r }));
}

// ————— دقائق الاستخدام —————

/** إضافة زمن استعمال فعلي (يُستدعى بنبضة من main.js وقت انتباه الطفل فقط). */
export function addSeconds(sec, key = dayKey()) {
  const n = Math.max(0, Math.round(sec));
  if (!n) return;
  state.seconds += n;
  state.days[key] = (state.days[key] || 0) + n;
  save();
}

export function secondsOn(key = dayKey()) {
  return state.days[key] || 0;
}

export function totalSeconds() {
  return state.seconds;
}

/** آخر N يوماً منتهيةً باليوم: [{key, seconds}] — للوحة وليّ الأمر. */
export function usageDays(count = 7, today = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({ key: dayKey(d), seconds: secondsOn(dayKey(d)) });
  }
  return out;
}

// ————— جلسة المراجعة اليومية —————

export function reviewOf(key = dayKey()) {
  return state.reviews[key] || null;
}

/**
 * تسجيل مراجعة أُتمّت اليوم. الوحدة **محاولة** لا تمرين — تمرين التركيب فيه
 * محاولة لكل مقطع، فخلطهما يكذب على وليّ الأمر في نسبة الإصابة.
 */
export function markReview(tries, right, key = dayKey()) {
  const before = state.reviews[key];
  state.reviews[key] = {
    tries: (before?.tries || 0) + tries,
    right: (before?.right || 0) + right,
    at: Date.now(),
  };
  save();
  return state.reviews[key];
}

/** أيام المراجعة المتتالية المنتهية باليوم أو بالأمس (لا تنكسر السلسلة قبل نوم الطفل). */
export function reviewStreak(today = new Date()) {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (state.reviews[dayKey(d)]) streak++;
    else if (i > 0 || streak) break;
  }
  return streak;
}

// ————— «اقرأ لي»: سجلّ القراءة الجهرية وإذن وليّ الأمر (الحزمة ١٠) —————
//
// **بيانٌ نصيّ لا صوت**: صوتُ الطفل في IndexedDB (`recordings.js`) بحصةٍ تُقلَّم،
// وهنا مدّةُ كل قراءة وتاريخُها وحدهما — خفيفتان فتبقيان بعد تقليم الصوت، فلا ينقطع
// منحنى الطلاقة الذي يقرؤه الوالد بانقطاع ما يسمعه.
//
// و**لا قياس حرفيّ هنا البتّة**: وحدةُ §٦ حرفٌ بحركة في تمرين، والقراءة الجهرية
// ليست امتحاناً — لا خطأ يُسجَّل ولا مهارة (امتداد المُقَرّ في الجلسات ٤ و٦ والحزم ٧–٩).

export const RECORD_LOG_MAX = 400;   // ~نصف سنة من قراءتين في اليوم

/** هل أذن وليّ الأمر بالتسجيل؟ (البوابة الحسابية تُمرَّر مرة واحدة لا كل جلسة). */
export function micAllowed() {
  return Boolean(state.mic);
}

export function allowMic(allowed = true) {
  state.mic = Boolean(allowed);
  save();
  return state.mic;
}

/** سجلّ القراءات الجهرية بالترتيب الزمني — الأقدم أولاً. */
export function recordingLog() {
  return Array.isArray(state.records) ? [...state.records] : [];
}

/**
 * تسجيل حدث قراءة جهرية: قصة × تاريخ × مدّة (بند الحزمة ١٠/٥).
 * ويُقلَّم أقدمُ السجلّ عند بلوغ سقفه كما يُقلَّم الصوت — بلا تضخّم في localStorage.
 */
export function logRecording({ node, title = '', seconds = 0, at = Date.now(), day = dayKey() }) {
  if (!node) return null;
  const entry = { node, title, seconds: Math.max(0, Math.round(seconds * 100) / 100), day, at };
  const log = recordingLog();
  log.push(entry);
  state.records = log.slice(-RECORD_LOG_MAX);
  save();
  return entry;
}

/**
 * منحنى الطلاقة لوليّ الأمر: لكل قصة قراءاتُها بالترتيب الزمني ومدّةُ كل واحدة.
 * القصةُ الواحدة تُقرأ مراراً، وتناقصُ مدّتها عبر الأيام هو **مؤشّر الطلاقة** —
 * ولا يراه الطفل (اللوحة خلف بوابة)، فلا يستحيل عندَه سباقاً.
 */
export function fluencyByStory() {
  const byNode = new Map();
  for (const entry of recordingLog()) {
    const acc = byNode.get(entry.node) || { node: entry.node, title: entry.title, reads: [] };
    if (entry.title) acc.title = entry.title;   // آخر عنوان معروف للعقدة
    acc.reads.push(entry);
    byNode.set(entry.node, acc);
  }
  return [...byNode.values()]
    .map((story) => {
      const reads = [...story.reads].sort((a, b) => a.at - b.at);
      return {
        ...story,
        reads,
        first: reads[0].seconds,
        last: reads[reads.length - 1].seconds,
        best: Math.min(...reads.map((r) => r.seconds)),
        lastAt: reads[reads.length - 1].at,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

// ————— النسخة الاحتياطية: نقلُ تقدّم الطفل بين الأجهزة (الحزمة ١١) —————
//
// **العلّة**: التقدّم في هذا الجهاز وحده — لا حساب ولا سحابة (قاعدة الخصوصية،
// وهي عينُ ما تَعِد به الصفحة التعريفية). وثمنُها أن **محو بيانات المتصفّح أو حذف
// التطبيق المثبَّت يمحو رحلة الطفل كلها**، وأن تبديل الجهاز يبدأ من الصفر. فالمخرج
// ملفٌّ صغير يملكه وليّ الأمر: نجومٌ وصناديقُ ليتنر ودقائقُ ومراجعاتٌ ومددُ قراءات.
//
// و**لا ملفَّ صوتٍ واحداً فيه**: تسجيلات الطفل لا تغادر جهازه أبداً (الحزمة ١٠)،
// والنسخة ملفٌّ يُنسَخ ويُرسَل ويُخزَّن حيث شاء وليّه — فدخولُ صوته فيها نقضٌ للقاعدة
// من بابٍ خلفيّ. ولذلك بقيت مددُ القراءات هنا (`records`) وصوتُها في IndexedDB.

export const BACKUP_KIND = 'muallim.progress';
export const BACKUP_FORMAT = 1;      // شكل الملف نفسه — لا نسخة حالة الطفل (`VERSION`)

/** النسخة كما تُكتب في الملف: ترويسةٌ تعرّف نفسها، وحالةُ الطفل كاملةً. */
export function backup(at = Date.now()) {
  return { kind: BACKUP_KIND, format: BACKUP_FORMAT, savedAt: at, state: snapshot() };
}

export function backupText(bundle = backup()) {
  return JSON.stringify(bundle, null, 1);
}

/** اسم الملف بيومه — فتتراكم نسخُ وليّ الأمر مرتَّبةً بلا أن يطمس بعضها بعضاً. */
export function backupName(date = new Date()) {
  return `muallim-progress-${dayKey(date)}.json`;
}

/**
 * قراءة ملفٍ اختاره وليّ الأمر. **لا يُستعاد مجهولٌ**: كل رفضٍ يُعلَن بسببه بالعربية،
 * لأن الاستعادة تكتب فوق تقدّم قائم — وخطؤها لا يُستدرك.
 * @returns {{bundle: object}|{error: string}}
 */
export function readBackup(text) {
  let raw;
  try {
    raw = JSON.parse(String(text ?? ''));
  } catch {
    return { error: 'تعذّرت قراءة الملف — ليس ملفَ نسخةٍ صالحاً.' };
  }
  if (!raw || typeof raw !== 'object' || raw.kind !== BACKUP_KIND) {
    return { error: 'هذا الملف ليس نسخةَ تقدّمٍ من «اِقْرَأْ».' };
  }
  const format = Number(raw.format);
  if (!Number.isFinite(format)) return { error: 'ملف النسخة معطوب — لا يعلن شكله.' };
  if (format > BACKUP_FORMAT) {
    return { error: 'هذه النسخة من إصدارٍ أحدث من التطبيق — حدِّث التطبيق ثم استعِدها.' };
  }
  const state = migrate(raw.state);
  if (!state) return { error: 'ملف النسخة معطوب — لا تقدّم فيه.' };
  return { bundle: { ...raw, state } };
}

/**
 * ما في النسخة بعبارة وليّ الأمر — يُعرض **قبل** التأكيد: نسخةٌ خاطئة تُستعاد فوق
 * تقدّمٍ حقيقيّ خسارةٌ لا رجعة فيها، ورقمُ نجومها ويومُها يميّزانها في نظرة.
 * والنجومُ تُحسب على عقد الرحلة الحالية وحدها (لا على مفاتيح لا وجود لها اليوم).
 */
export function backupSummary(bundle) {
  const stars = bundle?.state?.stars || {};
  const done = allNodes().filter((n) => stars[n.id] > 0);
  return {
    savedAt: bundle?.savedAt || 0,
    nodes: done.length,
    stars: done.reduce((sum, n) => sum + Math.min(MAX_STARS, stars[n.id]), 0),
    skills: Object.keys(bundle?.state?.skills || {}).length,
    reads: Object.keys(bundle?.state?.reads || {}).length,
    records: (bundle?.state?.records || []).length,
    seconds: bundle?.state?.seconds || 0,
  };
}

/**
 * الاستعادة: حالةُ النسخة تحلّ محلّ الحالة القائمة كاملةً (لا دمج — دمجُ رحلتين
 * يصنع طفلاً ثالثاً لا وجود له). وتمرّ بترحيل الرحلة نفسِه، فنسخةٌ من إصدارٍ سابق
 * لا تُحبَس عند عقدةٍ استُحدثت بعدها.
 */
export function restore(bundle) {
  const next = bundle?.state;
  if (!next || typeof next.stars !== 'object') return false;
  state = { ...blank(), ...next, v: VERSION };
  save();
  migrateJourney();
  return true;
}

// ————— تحكّم وليّ الأمر في الرحلة (الحزمة ١١، خلف بوابته الحسابية) —————

/**
 * فتحٌ يدويّ إلى عقدةٍ بعينها — لطفلٍ يعرف حروفه فلا يُحبَس في أوّلها.
 * كل ما قبلها يُعدّ متماً **بنجمةٍ واحدة**: تفكّ القفل ولا تدّعي إتقاناً، فتبقى
 * العقدةُ تدعوه إلى لعبها والنجومُ تعلو حين يلعبها (حكمُ الترحيل الرحيم نفسُه).
 * ولا تُنقَص نجمةٌ كُسبت.
 * @returns {number} عدد العقد التي فُتحت فعلاً
 */
export function unlockUpTo(id) {
  const pending = unfinishedBefore(id);
  for (const node of pending) state.stars[node.id] = 1;
  if (pending.length) save();
  return pending.length;
}

function unfinishedBefore(id) {
  const index = indexOf(id);
  return index < 0 ? [] : allNodes().slice(0, index).filter((n) => !getStars(n.id));
}

/** كم عقدةً ناقصة قبل هذه العقدة — ما سيفتحه `unlockUpTo` **قبل** أن يفعله. */
export const pendingBefore = (id) => unfinishedBefore(id).length;

/**
 * تصفير محطةٍ لإعادة التدريب: نجومُ عقدها إلى الصفر، فتعود جبهةُ الفتح إليها.
 *
 * وثلاثة قيود مقصودة: **سجلّ ليتنر لا يُمسّ** (ما قِيس من مهارات الطفل حقٌّ له،
 * وإعادةُ التدريب لا تمحو تاريخه — بند الحزمة)؛ و**نجومُ ما بعدها تبقى محفوظة**
 * (تُقفل حتى يتمّ المحطة، فإذا أتمّها عادت كما كانت — إعادةُ قفلٍ لا محو)؛
 * ودقائقُ الاستعمال والمراجعات ومددُ القراءات لا تُمسّ.
 * @returns {number} عدد العقد التي صُفِّرت
 */
export function clearSection(sectionId) {
  const section = journey().find((s) => s.id === sectionId);
  if (!section) return 0;
  let cleared = 0;
  for (const node of section.nodes) {
    if (!state.stars[node.id]) continue;
    delete state.stars[node.id];
    cleared++;
  }
  if (cleared) save();
  return cleared;
}

/** حصيلةُ محطةٍ (عقدُها والمنجَز منها ونجومُه) — لعرض أثر التصفير **قبل** وقوعه. */
export function sectionProgress(sectionId) {
  const section = journey().find((s) => s.id === sectionId);
  if (!section) return null;
  const done = section.nodes.filter((n) => getStars(n.id) > 0);
  return {
    nodes: section.nodes.length,
    done: done.length,
    stars: done.reduce((sum, n) => sum + getStars(n.id), 0),
  };
}

// ————— صلابة التخزين —————
//
// التقدّم في `localStorage`، والمتصفّح **يُخلي** تخزين المواقع حين يضيق القرص —
// وiOS أشدّها في ذلك — فيذهب تقدّم الطفل بلا فعلٍ من أحد. والوسمُ الدائم يستثنيه
// من الإخلاء. يُطلب عند بوابة وليّ الأمر (فعلُ بالغٍ لا فعلُ طفل)، و**رفضُه لا
// يعطّل شيئاً**: الجواب يُعرض على وليّ الأمر ليعرف أنّ النسخة الاحتياطية آكد.

const storageApi = () => (typeof navigator !== 'undefined' && navigator.storage) || null;

/** طلب التخزين الدائم. يردّ `true`/`false`، و`null` إن كان المتصفّح لا يعرفه. */
export async function askPersistence() {
  const api = storageApi();
  if (!api?.persist) return null;
  try {
    return await api.persist();
  } catch {
    return null;   // تصفّح خاص أو منعٌ من المستخدم: لا شيء ينكسر
  }
}

/** حال التخزين اليوم بلا طلبٍ جديد (للعرض في اللوحة). */
export async function persistedStorage() {
  const api = storageApi();
  if (!api?.persisted) return null;
  try {
    return await api.persisted();
  } catch {
    return null;
  }
}

// ————— إدارة —————

export function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

export function reset() {
  state = blank();
  save();
}
