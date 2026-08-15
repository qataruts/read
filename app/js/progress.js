// تقدّم الطفل: نجوم كل عقدة + قواعد فتح المجموعات + سجلّ المهارات ودقائق الاستخدام،
// محفوظ كله في localStorage. حساب واحد في هذه المرحلة.
//
// سجلّ المهارات (الجلسة ٥ · METHOD §٦): كل تمرين يسجَّل على مستوى
// **الحرف × الحركة × نوع التمرين**، ومنه يُبنى التكرار المتباعد وجلسة المراجعة
// ولوحة وليّ الأمر. لا نصّ منطوق جديد هنا — القياس لا يضيف محتوى.

import {
  GROUPS, SKILLS, STORIES, QURAN, GATES, CONTRASTS, ROOTS,
  gateBefore, quranParts, surahOfWordsPart, surahWordsPart, bareLetters,
  isLetterlessKey, quranLetterSkills, rasmLessons,
} from './curriculum.js';
import { GARDENS } from './lexicon.js';
import { ladderOf, stemOf } from './sentences.js';
import { libraryOf, shelfStories, storiesOfSurah } from './library.js';

const STORE_KEY = 'muallim.progress.v1';
export const VERSION = 2;            // ١ = نجوم فقط (تُرقّى تلقائياً بلا فقد)

/**
 * **ترتيبُ الرحلة** — رقمٌ يُختَم به تقدّمُ الطفل، لا نسخةُ تخزينٍ (رفعُ `VERSION`
 * يُسقِط حالةَ كل طفلٍ قائم). ١ = الكتلةُ القرآنية متّصلة قبل البساتين؛ **٢** =
 * الدفعاتُ الأربع تتخلّل البساتين (وز١، ١٥ أغسطس ٢٠٢٦). ومنه يعرف الترحيلُ أنّ
 * الفجوةَ التي يراها **إزاحةٌ** لا محطةٌ مستحدثة — انظر `migrateJourney`.
 */
export const ORDER = 2;
export const MAX_STARS = 3;
export const WORDS_PART = 'words';   // عقدة لعبة الكلمات في آخر كل مجموعة

/**
 * «ثلاثُ سورٍ لكل دفعة» — به تُشقّ السورُ محطاتٍ، ويتبعه عددُها بلا سطرٍ يُعدَّل.
 *
 * **وكانت أربعاً** (قرار المالك، ١٥ أغسطس ٢٠٢٦، على `REVIEW_METHOD §٢`): صارت ثلاثاً
 * حين تخلّلت الدفعاتُ البساتينَ — حجمٌ يوازن بين حضور المصحف المتجدّد وبين ألّا تعود
 * الكتلةُ جداراً، فأطولُ امتدادٍ قرآنيّ ستُّ عقدٍ (وسبعٌ في دفعة قصة الفيل).
 */
export const SURAHS_PER_STATION = 3;

/**
 * **باقاتُ نصف البستان** (الحكم ب١٠، ١٥ أغسطس ٢٠٢٦): الوحدةُ الموضوعية للبستان كانت
 * ١٩–٢٣ حلقةً متّصلة بميكانيكيّاتٍ متطابقة — تجاوزُ روحِ حدّ المالك ١٠–١٢. فتُشَقّ
 * **بالنوع** لا بالعدد: باقاتٌ ← درجاتُ سلّمٍ ← باقاتٌ ← بقيةُ السلّم ← المكتبة.
 */
export const GARDEN_HALF = 5;

// رقمٌ عربيّ لعنوان المحطة. ونسخةٌ صغيرة هنا لا استيرادٌ من `ui.js`: اتجاهُ الاعتماد
// واحد (`ui.js` ← `progress.js`)، ولا تُقلَب طبقةٌ لأجل سطرٍ من عشرة محارف.
// **وموضعُهما فوق**: `migrateJourney()` تعمل وقتَ تحميل الوحدة فتبني الرحلة —
// فتعريفٌ تحتها يقع في منطقة الموت الزمنيّ ويُسقِط الوحدة كلَّها عند أول استيراد.
const arNumeral = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

/** أنواع التمارين المقيسة — أسماؤها ثابتة لأنها تُخزَّن في مفاتيح المهارات. */
export const KINDS = {
  QUIZ: 'quiz', HARAKA: 'haraka', BUILD: 'build', ORDER: 'order', CONTRAST: 'contrast',
  ROOT: 'root', MARK_COMPARE: 'mark-compare', MARK_QUIZ: 'mark-quiz',
  RASM: 'rasm', MUQ: 'muq',
};

/**
 * **المهاراتُ التي لا حرفَ لها**: العائلةُ الصرفية (`root-<العائلة>`) والعلامةُ
 * (`mark-<الدرس>`) وعلامةُ الرسم (`rasm-<العلامة>`) وفواتحُ السور (`muq-<المجموعة>`)
 * مقيسةٌ في ليتنر كسائر المهارات، ووحدةُ §٦ فيها ليست حرفاً × حركة. فتُستثنى من لوحة
 * الحروف كي **لا يظهر حرفٌ وهميّ في لوحة وليّ الأمر** (حكم المدير في الحزمة ١٣ — صار
 * قاعدةً تسري على كل نوعٍ جديد بعده)، ولكلٍّ قسمُه.
 *
 * **والفصلُ بالمفتاح لا بالنوع** (جلسة وز٢): كان بنوع التمرين، فلمّا صار لحرفَي
 * المرحلة القرآنية مفتاحٌ `mark-` بنوعٍ قد يتبدّل، لزم أن يكون المقياسُ ما يُخزَّن
 * فعلاً — **سابقةُ المفتاح** (`LETTERLESS_PREFIXES` في `curriculum.js`، جردٌ واحد).
 */
export const isRootSkill = (skill) => skill?.kind === KINDS.ROOT;

export const isMarkSkill = (skill) =>
  skill?.kind === KINDS.MARK_COMPARE || skill?.kind === KINDS.MARK_QUIZ;

/** هل مهارةٌ وحدتُها حرفٌ × حركة؟ (ما عداها له قسمُه في اللوحة وشرطُه في المراجعة) */
export const isLetterSkill = (skill) => !isLetterlessKey(skill?.letter);

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
    order: ORDER,     // ترتيبُ الرحلة الذي بُنيت عليه هذه الحالة (انظر `migrateJourney`)
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
  // **وسمُ الترتيب يُقرأ من المحفوظ لا من الفراغ**: `blank()` يسم الجديد بالترتيب
  // القائم، فلو تُرك الدمجُ لظاهره لادّعت كلُّ حالةٍ قديمة أنها مبنيّةٌ عليه —
  // وضاع على الترحيل أنّ فجوتَها إزاحةٌ لا محطةٌ مستحدثة.
  return { ...blank(), ...rest, v: VERSION, order: data.order || 1 };
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

/**
 * **العقدةُ المُزاحة لا تُوهَب نجمة** (ترحيل وز١، ١٥ أغسطس ٢٠٢٦): وهبةُ النجمة أدناه
 * علّتُها «محطةٌ استحدثناها خلف موضع الطفل» — فتفكّ حبسه عن شيءٍ لم يكن موجوداً يوم
 * مرّ. أمّا توزيعُ الدفعات فلم يستحدث عقدةً واحدة: **أزاح** سورَ الدفعات الثلاث
 * الأخيرة وبوابةَ الحديقة إلى ما بعد بساتينَ لم يبلغها الطفل بعد. فلو وُهبت لها
 * نجمةٌ لتخطّى الطفلُ سورةً لم يقرأها وبوابةً لم يعبرها — وهو ضدُّ الرحمة لا وجهُها.
 *
 * **ولا حبسَ في تركها**: القفلُ جبهةٌ لا شرطٌ رجعيّ — فمن أزاحه الترتيبُ إلى الوراء
 * يستأنف من أول عقدةٍ ناقصة، ونجومُه كلُّها محفوظةٌ بمعرّفاتها تُتخطّى حين يبلغها.
 *
 * **والمُزاحُ معدودٌ لا مقيسٌ بنوعه**: التوزيعُ حفظ ترتيبَ السور بينها إلا اثنين —
 * **الكوثرَ** (صار ثانيَ الدفعة الأولى بعد أن كان خامسَ السور) و**بوابةَ الحديقة**
 * (صارت قبل الدفعة الثانية بعد أن كانت بعد السور كلِّها) — فهذان وحدهما يقعان خلف
 * نجمةٍ لصاحبها بلا أن يكون مرّ بهما. وما عداهما على ترتيبه النسبيّ، فتبقى له
 * قاعدةُ الوهبة كما هي (ومنها محطاتُ «كلمات السورة» المستحدَثة في الحزمة ١٢).
 *
 * **وشاهدُ المجاوَزة نجمةٌ فيما بعد المرحلة**: مَن بلغ بستاناً أو سلّماً أو مكتبةً أو
 * شجرةً أو رفّاً فقد عبَر المرحلةَ كلَّها حقاً — فالفجوةُ عنده **محطةٌ استُحدثت خلفه**
 * (سورُ حزمة «القرآني الموسّع») وتُوهَب له كما كانت. ومَن هو في المرحلة بعدُ فالفجوةُ
 * عنده **إزاحة**، فيقرأ ما أُزيح أمامه ولا يتخطّاه.
 *
 * والقيدُ كلُّه **لحالةٍ واحدة**: المبنيّةُ على الترتيب القديم (`order < ORDER`).
 */
const DISPLACED = new Set(['quran:s108', 'quran:sw-s108', 'gate:gardens']);

const BEYOND_QURAN = new Set(['garden', 'ladder', 'library', 'roots', 'shelf']);

function migrateJourney() {
  const reordered = (state.order || 1) < ORDER;
  if (!Object.keys(state.stars).length) {          // طفلٌ جديد: لا شيء يُرحَّل
    if (reordered) { state.order = ORDER; save(); }
    return;
  }
  let changed = reordered;
  state.order = ORDER;
  const passedStage = allNodes().some(
    (node) => BEYOND_QURAN.has(node.type) && state.stars[node.id] > 0);

  /* **إنقاذُ نجمةٍ كُتبت تحت معرّفٍ خطأ** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦): قصةُ السورة
     كانت تُحفظ تحت `library:` والرحلةُ تنتظرها تحت `prophet:` — فتجمّدت الجبهةُ عند
     «سُوَرٌ قصار ٣» ولم يُفتح بعدها شيء. والشيفرةُ أُصلحت، **لكنّ مَن قرأ القصة قبل
     الإصلاح نجمتُه في المكان القديم** — فتُنقَل هنا مرّةً واحدة، ولا يُعاد عليه ما
     أتمّه. والترحيلُ رحيمٌ كسائر ما في هذه الدالّة. */
  for (const node of allNodes()) {
    if (!node.id.startsWith('prophet:')) continue;
    const stray = `library:${node.id.slice('prophet:'.length)}`;
    if (state.stars[stray] && !state.stars[node.id]) {
      state.stars[node.id] = state.stars[stray];
      delete state.stars[stray];
      changed = true;
    }
  }

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
    // مُزاحةٌ لا مستحدثة، وصاحبُها لم يجاوز المرحلة بعدُ — انظر `DISPLACED` أعلاه
    if (reordered && !passedStage && DISPLACED.has(node.id)) continue;
    if (node.type === 'gate') {
      state.stars[node.id] = MAX_STARS;           // بوابةٌ عبَر مفصلَها قبل وجودها ⇒ مجتازة
      changed = true;
    } else if (['contrast', 'quran', 'prophet', 'roots'].includes(node.type)) {
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

/* **وضعُ المعاينة** (أمر المالك، ١٣ أغسطس ٢٠٢٦: «هل ينبغي أن نفتح كل شيء لمن
   يقيّم التطبيق؟»): المعلّمُ الذي يفحص يحتاج أن يرى المحطات كلَّها، والطفلُ يحتاج
   ألّا يقفز إلى ما لم يبلغه — **والقفلُ التسلسليّ جوهرُ المنهج لا قيدٌ عليه**.

   فبـ`?preview=1`: تُفتَح الرحلةُ كلُّها للتصفّح، **ولا يُكتب حرفٌ في تقدّم أحد** —
   `save()` يصير بلا أثرٍ على القرص (ويبقى إخطارُ الشاشات ليُرسَم ما يجري في الجلسة).
   فيدور المقيّمُ في كل شاشة ثم يُغلق، ويعود الجهازُ كما كان بلا محوٍ ولا زرعِ نجوم.

   **وهو غيرُ `?dev=1`**: ذاك يملأ التقدّمَ فعلاً (أدواتُ تطوير)، وهذا لا يمسّه. */
export const PREVIEW = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('preview') === '1';

function save() {
  frontierCache = null;   // النجوم وحدها تحرّك الجبهة، وكل تغيّر فيها يمرّ من هنا
  state.updatedAt = Date.now();
  if (!PREVIEW) {                       // معاينةٌ: تُرسَم الجلسةُ ولا يُمَسّ القرص
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      console.warn('[progress] تعذّر الحفظ في localStorage');
    }
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
  const out = [];
  for (const { part, title, face } of quranParts()) {
    // **«لا سورةَ قَصَصيّةٌ قبل قصتها»** (حزمة قصص الأنبياء): قصةُ السورة تسبق محطةَ
    // كلماتها — يعرف الطفلُ الخبرَ ثم يقرأ كلماتِه ثم يقرؤه في كلام الله. وهي عقدةٌ
    // من نوعها (`prophet`) لأنها **قراءةٌ لا امتحان**: لا تُقاس ولا يُبنى منها مهارة
    // (إعفاؤها منصوصٌ بسببه في `tools/test_measure.mjs`).
    const surah = surahOfWordsPart(part);
    if (surah) {
      for (const story of storiesOfSurah(surah.id)) {
        out.push({
          id: `prophet:${story.id}`, type: 'prophet', groupId: QURAN.after,
          part: story.id, title: story.title, face: story.emoji, story,
        });
      }
    }
    out.push({ id: `quran:${part}`, type: 'quran', groupId: QURAN.after, part, title, face });
  }
  return out;
}

/**
 * **مفاصلُ المرحلة القرآنية** (بلاغ المالك، ١٢ أغسطس ٢٠٢٦): كانت **٣١ عقدةً في
 * محطةٍ واحدة**، والبساتينُ مئةُ عقدةٍ في عشر محطاتٍ مسمّاة فلا تثقل — **فالعلّة
 * كتلةٌ بلا مفاصل لا عددٌ كثير**. فتُشقّ محطاتٍ مسمّاةً بعدّاداتها كالبساتين والرفّ.
 *
 * **ولا يتغيّر ترتيبُ عقدةٍ ولا قفلُها ولا نجومُها**: الشقُّ **قسمةُ القائمة نفسِها
 * بترتيبها** — تُوزَّع عقدُ `quranNodes()` على محطاتها بلا فرزٍ ولا إعادةِ بناء،
 * فتسلسلُها المسطَّح هو هو حرفاً بحرف (يثبته `test_quran.mjs` بمقايسة الاثنين).
 * فالترحيلُ **بلا أثر**: العقدةُ نفسُها بمعرّفها نفسِه في موضعها نفسِه، وإنما تبدّل
 * العنوانُ فوقها والصندوقُ حولها.
 *
 * **والمحطاتُ محسوبةٌ من `QURAN` لا مكتوبة**: سورةٌ ثالثةَ عشرةَ تُضاف غداً تفتح
 * محطةً رابعة بلا سطرٍ يُعدَّل. وقصةُ السورة تتبع محطةَ سورتها — «في موضعها».
 */
export function quranSections() {
  const station = new Map();      // معرّفُ الجزء ← مفتاحُ محطته
  const at = (part, key) => station.set(part, key);
  at(QURAN.letters.id, 'prep');
  for (const level of QURAN.words.levels) at(level.id, 'prep');
  at(QURAN.rasm.id, 'rasm');
  at(QURAN.muqattaat.id, 'rasm');
  at(QURAN.rasm2.id, 'rasm2');
  QURAN.surahs.forEach((surah, i) => {
    const key = `short${Math.floor(i / SURAHS_PER_STATION) + 1}`;
    at(surah.id, key);
    at(surahWordsPart(surah.id), key);
  });

  const titles = { prep: 'التهيئة', rasm: 'رسمُ المصحف', rasm2: 'رسمُ المصحف ٢' };
  const faces = { prep: QURAN.letters.face, rasm: QURAN.rasm.face, rasm2: QURAN.rasm2.face };
  const subs = {
    prep: 'الحرفان وكلماتٌ من القرآن',
    rasm: 'علاماتُ الرسم والحروف المقطَّعة',
    rasm2: 'ثلاثُ علاماتٍ أُخرى',
  };
  let shorts = 0;
  const out = [];
  for (const node of quranNodes()) {
    // عقدةُ القصة تتبع سورتَها (`part` معرّفُ القصة لا الجزء) — «في موضعها»
    const key = station.get(node.part)
      || (node.story ? station.get(node.story.surah) : null) || 'prep';
    const last = out[out.length - 1];
    if (last && last.key === key) { last.nodes.push(node); continue; }
    const isShort = key.startsWith('short');
    if (isShort) shorts++;
    out.push({
      key,
      kind: 'quran',
      id: `quran:${key}`,
      title: titles[key] || `سورٌ قصار ${arNumeral(shorts)}`,
      face: faces[key] || node.face,
      sub: subs[key] || '',
      nodes: [node],
    });
  }
  // وصفُ محطة السور يُكتب بعد امتلائها: عددُ سورها لا عددُ عقدها
  for (const section of out) {
    if (!section.sub) {
      const n = section.nodes.filter((x) => x.type === 'quran' && !x.part.startsWith('sw-')).length;
      section.sub = `${arNumeral(n)} سور بكلماتها`;
    }
  }
  return out;
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
 *
 * **والعقدةُ تحمل بستانَها كاملاً** وإن شُقَّت محطتُه نصفين (`gardenSections`):
 * الشقُّ عرضٌ على الخريطة، ومادّةُ الشاشة (مشتّتاتُها وحوضُها) بستانٌ واحد لا نصفُه.
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
 * **موضعُ شقّ السلّم محسوبٌ لا مكتوب** (الحكم ب١٠): أطولُ بادئةٍ من الدرجات كلُّ
 * كلماتِ جملها المعجمية في **باقات أ** — فالشقُّ لا يخرق المفكوكية بحرف، وباقةٌ
 * تنتقل من نصفٍ إلى نصفٍ غداً تحرّك موضعَ الشقّ وحدَها بلا سطرٍ يُعدَّل.
 *
 * والمطابقةُ بالجذع كما في `sentences.js` نفسِه (`stemGarden`)، وما ليس من كلمات
 * البستان (المعجمُ المساند وكلماتُ المنهج) مدروسٌ قبل البستان كلِّه فلا يقيّد شيئاً.
 */
function ladderCut(garden, ladder) {
  const at = new Map();                        // جذعُ كلمة البستان ← رقمُ باقتها
  garden.bundles.forEach((bundle, index) => {
    for (const word of bundle.words) {
      const stem = stemOf(word.word);
      if (!at.has(stem)) at.set(stem, index);
    }
  });
  const beyond = (rung) => rung.sentences.some((sentence) => sentence.words
    .some((token) => at.get(stemOf(token)) >= GARDEN_HALF));
  const first = ladder.rungs.findIndex(beyond);
  return first < 0 ? ladder.rungs.length : first;
}

/**
 * **محطاتُ البستان الواحد** (الحكم ب١٠، ١٥ أغسطس ٢٠٢٦): كان البستانُ كتلةً من
 * ١٩–٢٣ عقدة بميكانيكيّاتٍ متطابقة، فيُشَقّ بالنوع: **باقات أ ← درجاتُ سلّمه الأولى
 * ← باقات ب ← بقيةُ السلّم ← المكتبة**.
 *
 * **والعقدُ لا تُمَسّ**: معرّفاتُها وترتيبُها المسطَّح هما هما حرفاً بحرف — قسمةُ
 * القائمة لا إعادةُ بنائها، فلا نجمةَ تُفقَد ولا قفلٌ يتبدّل (كشقّ المرحلة القرآنية).
 *
 * **والعنوانُ يصدُق نصفَه**: يحمل القسمُ نسخةَ عرضٍ من بستانه بعنوانٍ مرقَّم وكلماتِ
 * نصفِه وحدَها — فلا يقول للطفل «خمسون كلمة» وأمامه خمسٌ وعشرون. والعقدُ تبقى على
 * بستانها الكامل (`gardenNodes`)، فمادّةُ الشاشة لا تعرف الشقَّ أصلاً.
 */
export function gardenSections(garden) {
  const bundles = gardenNodes(garden);
  const ladder = ladderOf(garden.id);
  const rungs = ladder ? ladderNodes(ladder) : [];
  const cut = ladder ? ladderCut(garden, ladder) : 0;
  const half = (index, nodes) => ({
    ...garden,
    title: `${garden.title} ${arNumeral(index)}`,
    words: nodes.flatMap((node) => node.bundle.words),
  });

  const out = [];
  const push = (part, index) => {
    const slice = bundles.slice(part === 'a' ? 0 : GARDEN_HALF, part === 'a' ? GARDEN_HALF : undefined);
    if (slice.length) {
      out.push({
        kind: 'garden', id: `garden:${garden.id}:${part}`, garden: half(index, slice), nodes: slice,
      });
    }
    const steps = part === 'a' ? rungs.slice(0, cut) : rungs.slice(cut);
    if (steps.length) {
      out.push({
        kind: 'ladder',
        id: `ladder:${garden.id}:${part}`,
        garden: half(index, slice),
        ladder: { ...ladder, rungs: steps.map((node) => node.rung) },
        nodes: steps,
      });
    }
  };
  push('a', 1);
  push('b', 2);

  const stories = libraryNodes(garden);
  if (stories.length) out.push({ kind: 'library', id: `library:${garden.id}`, garden, nodes: stories });
  return out;
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
 * عقد «رفّ المكتبة» (حزمة المكتبة، ١٢ أغسطس ٢٠٢٦): القصص الطويلة في **ذيل الرحلة**.
 *
 * **علّةُ الموضع**: الطلاقةُ تُبنى بأميال قراءةٍ حقيقية، والقصةُ الطويلة تحتاج رصيداً
 * واسعاً — وأوسعُ نقطةٍ في الرحلة هي آخرُها (٧٩١ مفردة معلَنة). فهنا وحدَه تحتمل
 * الصفحاتُ عشراً والجملةُ ستّ كلمات.
 *
 * **والترحيلُ رحيمٌ بالبناء**: القسمُ يُلحَق في الذيل، فمن أتمّ الرحلة يجد عقداً
 * جديدةً تُفتَح له بالتسلسل، ولا يُقفَل عليه شيءٌ أتمّه ولا يُزحزَح موضعُ عقدةٍ قبله.
 */
export function shelfNodes() {
  return shelfStories().map((story) => ({
    id: `shelf:${story.id}`, type: 'shelf', part: story.id, story,
  }));
}

/**
 * عقدة «شجرة الجذر» (حزمة الجذور): عقدةٌ واحدة لكل عائلة.
 */
export function rootNodes(root) {
  return [{ id: `roots:${root.id}`, type: 'roots', part: root.id, root }];
}

/**
 * **موضعُ كل شجرةٍ محسوبٌ لا مكتوب**: العقدةُ التي يكتمل بها **ثالثُ عضوٍ مدروس**.
 *
 * فالشجرة لا تُفتح على غصنين — ثلاثةٌ أدنى ما تُرى به عائلةً لا مصادفة. وكلُّ عضوٍ
 * تُسلِّمه عقدةٌ بعينها: كلمةُ المعجم باقتُها، وكلمةُ المنهج عقدةُ درسها. فتُرتَّب
 * مواضعُ الأعضاء ويُؤخذ ثالثُها، وتُوضَع الشجرةُ بعد **القسم** الذي يحويه.
 *
 * وبهذا تتحرّك المواضعُ وحدَها: كلمةٌ تُضاف إلى عائلةٍ في الدفعة القادمة قد تُقدّم
 * شجرتَها، ولا سطرَ يُعدَّل. تعود: معرّف القسم ← عائلاتٌ تليه.
 */
function rootPlacement(sections) {
  const deliver = new Map();          // نصّ الكلمة ← رقم القسم الذي يُسلّمها
  sections.forEach((section, index) => {
    for (const node of section.nodes) {
      if (node.type === 'garden') {
        for (const word of node.bundle.words) if (!deliver.has(word.word)) deliver.set(word.word, index);
      } else if (node.type === 'group') {
        for (const word of node.group.words || []) {
          const text = (word.tiles || []).join('');
          if (text && !deliver.has(text)) deliver.set(text, index);
        }
      } else if (node.type === 'quran' && node.item?.read && !deliver.has(node.item.read)) {
        deliver.set(node.item.read, index);
      }
    }
  });

  const after = new Map();
  for (const root of ROOTS) {
    const places = root.members.map((m) => deliver.get(m)).filter((i) => i !== undefined).sort((a, b) => a - b);
    if (places.length < 3) continue;        // تفشل مغلقةً: عائلةٌ لا يبلغها الطفلُ ثلاثاً لا عقدةَ لها
    const at = places[2];
    if (!after.has(at)) after.set(at, []);
    after.get(at).push(root);
  }
  return after;
}

/**
 * الرحلة كاملةً بأقسامها بالترتيب: مجموعة ← ما بعدها من مهارات وقصص ← محطة «ميّز بين»
 * إن كانت لها ← … ← بوابة المصحف ← تهيئةُ المرحلة القرآنية ورسمُها ودفعتُها الأولى
 * ← بوابة الحديقة ← (بستانان ← دفعةُ سورٍ) × ثلاث ← البساتين الأربعة الباقية ← الرفّ.
 *
 * ومحطة المواجهة **بعد مهارات مجموعتها وقصصها**: الحرف يُدرَس، ثم تُسمّى علامته،
 * ثم تُقرأ قصته، ثم يُواجَه بشبيهه — فالمواجهة مراجعةٌ لما استقرّ لا امتحانٌ لما جدّ.
 *
 * **وتوزيعُ الدفعات** (قرار المالك، ١٥ أغسطس ٢٠٢٦، على `REVIEW_METHOD §٢.٤`): كانت
 * المرحلةُ القرآنية ٣١ عقدةً متّصلة بين البوابتين — أطولُ امتدادٍ في الرحلة، يقرؤها
 * الطفلُ بأقلّ طلاقةٍ يملكها، وخلفَها **محبوسٌ** رصيدُ الطلاقة كلُّه (٥٠٠ كلمة معجم
 * وسلالمُ جملها وقصصُها). فصارت **دفعاتٍ تتخلّل البساتين**: أميالُ القراءة السهلة
 * تسبق النصَّ الصعب لا العكس، والسورُ الطوالُ يقرؤها طفلٌ عبَر مئات الكلمات فيقرؤها
 * قراءةً لا فكّاً متعثراً. **والقيودُ الأربعةُ محفوظة**: التهيئةُ والرسمُ قبل كل نصٍّ
 * عثماني (كتلةً واحدة في موضعها)، وقصةُ السورة قبل كلماتها، وكلماتُها قبلها، والقفلُ
 * تسلسليّ كما هو. **والخاتمةُ قرآنية**: الدفعةُ الرابعة (وفيها أطولُ السور) آخرُ ما
 * قبل الرفّ — فالتتويجُ صعودٌ موزون لا جدارٌ يُتسلَّق.
 *
 * **ومواضعُ الدفعات محسوبةٌ لا مكتوبة**: الأولى قبل البساتين، وما بعدها بعد كل
 * بستانين — فسورةٌ ثالثةَ عشرةَ تفتح دفعةً خامسة في موضعها بلا سطرٍ يُعدَّل.
 */
/**
 * **موضعُ درس الرسم محسوبٌ لا مكتوب** (الحكم ب٢، جلسة وز٢): رقمُ أوّلِ دفعةٍ يُظهر
 * نصُّها علامةً من علاماته — فيُدرَّس عند أوّل ما يوظّفه لا قبل السور كلِّها. وعلامةٌ
 * تنتقل من درسٍ إلى درس غداً تحرّك موضعَ درسها وحدَه بلا سطرٍ يُعدَّل، **والمفكوكيةُ
 * بالبناء**: لا تُرى علامةٌ في نصٍّ قبل أن تُدرَّس (ويحرسه `check_decodable.py` كذلك).
 *
 * وما ليس درسَ رسمٍ (التهيئة) فقبل الدفعة الأولى — موضعُه المُقَرّ في وز١.
 */
function headBatch(section) {
  const lesson = rasmLessons().find((l) => l.id === section.key);
  if (!lesson) return 0;
  const marks = lesson.signs.map((sign) => sign.sign.split('ـ').join(''));
  const at = QURAN.surahs.findIndex((surah) =>
    [QURAN.basmala, ...surah.ayat].some((line) => marks.some((mark) => line.includes(mark))));
  return at < 0 ? 0 : Math.floor(at / SURAHS_PER_STATION);
}

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
  // التهيئةُ والرسمُ والدفعةُ الأولى قبل البوابة الثانية، وبقيةُ الدفعات بين البساتين
  const quran = quranSections();
  const batches = quran.filter((section) => section.key.startsWith('short'));
  const heads = quran.filter((section) => !section.key.startsWith('short'));
  const before = (batch) => heads.filter((section) => headBatch(section) === batch);
  pushGate('quran');
  out.push(...before(0), ...batches.slice(0, 1));
  pushGate('gardens');
  GARDENS.forEach((garden, index) => {
    out.push(...gardenSections(garden));
    // بعد كل بستانين دفعةٌ — والباقي من الدفعات (إن نفدت البساتين قبلها) في الذيل
    const at = index % 2 === 1 ? (index + 1) / 2 : null;
    if (at !== null && batches[at]) out.push(...before(at), batches[at]);
  });
  const placed = new Set(out);
  out.push(...heads.filter((section) => !placed.has(section)),
    ...batches.filter((batch) => !placed.has(batch)));
  // أقسامُ الأشجار تُدرَج بعد بنائها كلِّها — فموضعُها يُقاس على الرحلة التامّة.
  // وتُؤخَّر إلى آخر كتلة بستانها (باقاتُه ثم سلّمُه ثم مكتبتُه): الشجرةُ ثمرةُ ما
  // دُرِس، فلا تُقحَم بين البستان ودرجاته فتقطع تدرّجَه المُقَرّ في الحزمة ٨.
  const after = rootPlacement(out);
  const sameGarden = (a, b) => a?.garden && b?.garden && a.garden.id === b.garden.id;
  const withRoots = [];
  out.forEach((section, index) => {
    withRoots.push(section);
    const trees = after.get(index) || [];
    if (!trees.length) return;
    // إن تلت هذا القسمَ أقسامُ بستانِه نفسِه (نصفُه الثاني أو سلّمٌ أو مكتبة) فالشجرةُ
    // بعدها — والمقياسُ البستانُ لا نوعُ القسم: شقُّ ب١٠ جعل للبستان الواحد محطاتٍ
    // من نوع `garden` مرّتين، فلو وقف المسحُ عندها لأُقحمت الشجرةُ في وسط بستانها.
    let tail = index;
    while (sameGarden(out[tail + 1], out[index])) tail++;
    if (tail !== index) { (after.get(tail) || after.set(tail, []).get(tail)).push(...trees); return; }
    for (const root of trees) {
      withRoots.push({ kind: 'roots', id: `roots:${root.id}`, root, nodes: rootNodes(root) });
    }
  });

  // **رفُّ المكتبة آخِرَ الرحلة** — بعد البساتين وسلالمها ومكتباتها وأشجارها كلِّها:
  // القراءةُ الطويلة ثمرةُ الرحلة لا محطةٌ فيها، ورصيدُها الرصيدُ كلُّه.
  const shelf = shelfNodes();
  if (shelf.length) withRoots.push({ kind: 'shelf', id: 'shelf', nodes: shelf });

  journeyCache = withRoots;
  return withRoots;
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
  if (index < 0) return false;
  // **المعاينةُ تفتح القفلَ ولا تدّعي إتماماً**: جُرِّب دفعُ الجبهة إلى آخر الرحلة
  // فقالت الخريطةُ للمقيّم «أتممتَ الرحلة كلها» — وهو خبرٌ كاذب. فالجبهةُ تبقى
  // على حقيقتها (ومنها «تابع من هنا» ونسبةُ الإنجاز)، والقفلُ وحدَه يُرفَع.
  if (PREVIEW) return true;
  return index <= unlockFrontier();
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
 * دروسُ العلامات التي أتمّها فعلاً، بترتيب المنهج — مرجعُ المفكوكية في تمارين
 * العلامات (حزمة «قياس العلامات»): مادّةُ التمرين أزواجُ درسه، فلا يُسأل عن مدّ الواو
 * من لم يبلغ درسه بعدُ. وهو نظيرُ `studiedLetters` للحروف: **حصيلةٌ لا نيّة**.
 */
export function studiedMarks() {
  return [
    ...SKILLS.filter((skill) => isDone(`skill:${skill.id}`)),
    // **وحرفا المرحلة القرآنية درسٌ كدروسها** (الحكم ب١): مفتاحُهما `mark-` ومراجعتُهما
    // مراجعةُ العلامات نفسُها، فحصيلتُهما تُقرأ من حيث تُقرأ حصيلتُها.
    ...(isDone('quran:letters') ? quranLetterSkills() : []),
  ];
}

/**
 * علاماتُ الرسم التي أتمّ درسَها (الحكم ب١) — مادّةُ تمرين «أيّ علامة؟» في المراجعة.
 * درسان لا درس، فمن أتمّ الأول لا يُسأل عن علامةٍ في الثاني: **المفكوكية بالبناء**.
 */
export function studiedRasm() {
  return rasmLessons().filter((lesson) => isDone(`quran:${lesson.id}`))
    .flatMap((lesson) => lesson.signs);
}

/** فواتحُ السور إن أتمّ محطتها — مادّةُ تمرين «أيُّ فواتح سمعت؟» (الحكم ب٣). */
export function studiedMuqattaat() {
  return isDone('quran:muqattaat') ? QURAN.muqattaat.items : [];
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
/**
 * **أولُ محاولةٍ في الجولة وحدَها تدخل ليتنر** (الحكم ب٨، جلسة وز٢): كان كلُّ نقرةٍ
 * خاطئة تصفّر صندوقَ المهارة، فجولةٌ بثلاثة خيارات يخطئ فيها الطفلُ مرّتين تُسجَّل
 * **خطأين** — تضخيمٌ للضعف المقيس، وأقساه في الجذور حيث المشتّت مقصودٌ أن يُغري.
 * فما بعد الأولى **تعلُّمٌ لا قياس**: يقرأ ويقارن حتى يصيب، ولا يُحاسَب مرّتين على
 * تعثّرٍ واحد.
 *
 * **والجولةُ تُعرَف بلا أن تُعلَن**: كلُّ شاشاتنا تسجّل **مفتاحَ المطلوب** لا مفتاحَ ما
 * نقره الطفل (تعليقُ «القياس على المقطع المطلوب» في `words.js` و`garden.js`، ونظائرُه)
 * — فمحاولاتُ الجولة الواحدة متتابعةٌ على مفتاحٍ واحد. فالجولةُ تُفتَح بخطأٍ مسجَّل
 * وتُغلَق بأوّل صواب، وما بينهما لا يُسجَّل. وجولةٌ تالية بالمفتاح نفسِه بعد إغلاقها
 * تُسجَّل كسائرها.
 *
 * ومَن غادر الشاشةَ وسط جولةٍ مفتوحة تُغلقها أوّلُ مهارةٍ أخرى تُسجَّل — و`endRound()`
 * تُغلقها صراحةً لمن يملك حدَّ تمرينه (محرّك المراجعة يناديها عند كل تمرين).
 */
let openRound = null;      // مفتاحُ جولةٍ سُجِّلت وما زالت تنتظر صوابَها

export function endRound() {
  openRound = null;
}

export function recordAttempt(letter, haraka, kind, correct, today = dayNumber()) {
  if (!letter || !kind) return null;
  const key = skillKey(letter, haraka, kind);
  if (openRound === key) {                 // إعادةٌ داخل الجولة نفسِها: تعلُّمٌ لا قياس
    if (correct) openRound = null;
    return state.skills[key] || null;
  }
  openRound = correct ? null : key;
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
    if (!isLetterSkill(s)) continue;   // العائلةُ والعلامةُ ليستا حرفاً — لكلٍّ قسمُها
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

/**
 * كم صوتاً على هذا الجهاز من كم (حزمة «خفّة التخزين»): `{stored, total}` أو `null`.
 *
 * موضعُها هنا لأنها أختُ `persistedStorage` لا أختُ `audio.js`: كلتاهما **قياسُ حال
 * التخزين على الجهاز** يُعرض لوليّ الأمر في سطرٍ واحد، ولا تشغّل صوتاً ولا تعرف مفتاحاً.
 *
 * **والقياس من المخزن نفسِه لا من تقريرٍ يكتبه عاملُ الخدمة**: خبرٌ عن نفسه قد يكذب
 * (يُكتب قبل أن يُخفق التخزين، أو يبقى بعد إخلاء المتصفّح للمخزون) — أما عدُّ مفاتيح
 * المخزن فهو الحاصلُ الآن. واسمُ المخزن يُلتمس بسابقته لا بحرفه، فلا ينكسر السطر إن
 * تغيّر اسمٌ في `sw.js` — والسابقة عقدٌ واحد بين الملفين.
 *
 * **وبيانا الصوت يُقرآن من المخزون لا من الشبكة** (`caches.match` لا `fetch`): عهدُ
 * «صفر طلبٍ شبكيّ في دورة التسجيل» (الحزمة ١٠) عهدٌ مطلق لا يُستثنى منه سطرُ عرضٍ —
 * وهذه اللوحةُ نفسُها تعرض تسجيلات الطفل. وهو أصحُّ أيضاً: العددُ يُقرأ دون إنترنت.
 * فإن لم يُخزَّن البيانان بعدُ (أولُ فتحةٍ قبل تمام التركيب) يسقط السطر ولا يكذب.
 */
export async function audioStored() {
  if (typeof caches === 'undefined') return null;
  try {
    const name = (await caches.keys()).find((n) => n.startsWith('muallim-audio'));
    if (!name) return null;
    const stored = new URL('../', import.meta.url);
    const read = async (path) => {
      const hit = await caches.match(new URL(path, stored));
      return hit ? hit.json() : null;
    };
    const [manifest, recitations] = await Promise.all([
      read('audio/manifest.json'), read('data/recitations.json'),
    ]);
    if (!manifest) return null;
    const total = Object.keys(manifest).length
      + Object.keys(recitations?.ayat || {}).length
      + Object.keys(recitations?.words || {}).length;
    if (!total) return null;
    const have = (await (await caches.open(name)).keys()).length;
    return { stored: Math.min(have, total), total };
  } catch {
    return null;      // متصفّح بلا Cache API أو تصفّح خاص: السطر يسقط ولا ينكسر شيء
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
