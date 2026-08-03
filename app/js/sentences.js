// «سلّم الجمل» — طبقة البيانات (الحزم ٨ و٩أ · ROADMAP §المرحلة ج).
//
// **المادّة كلها في `app/data/lexicon.json` ولا تُؤلَّف هنا**، وهي مصدران:
//   ١) جملةُ مثالٍ لكل كلمة معجم (الحزمة ٧) — **كلمتان**، مدّخرةٌ مفحوصة؛
//   ٢) **الجمل المتدرّجة** (الحزمة ٩أ) — ٣–٥ كلمات، تُؤلَّف بمولّد مقيَّد
//      (`tools/make_sentences.py`) لا بيد، ويرفض `check_lexicon.py` ما خالف العقد.
// هذا الملف يرتّبهما سلّماً لا أكثر: درجاتٍ بعد كل بستان، ولكل جملةٍ ميكانيكيتُها.
//
// **التدرّج داخل السلّم** (بند الحزمة ٩أ): جمل البستان تُرتَّب بالطول قبل تقسيمها
// درجاتٍ — فالدرجات الأولى كلمتان، ثم ثلاث، ثم أربع وخمس. والترتيب **ثابتٌ** (فرزٌ
// مستقرّ على الطول وحده)، فموضع كل جملة معروفٌ سلفاً كما تعرفه قائمة الصوت.
//
// **قاعدة موضع الجملة** (امتداد قاعدة الجلسة ٤ في مواضع دروس المهارات): الجملة تظهر
// في أوّل موضعٍ تكون فيه كلماتها كلها مدروسة. فجملةٌ من بستان «البيت» تستعمل كلمةً من
// بستان الألوان (الأخير) تُؤجَّل إلى درجاته — «لا جملة تعرض كلمة خارج المدروس» مفروضةً
// بالبنية نفسها لا بالوعد، ويحرسها `tools/check_lexicon.py` و`tools/test_sentences.mjs`.
//
// **الميكانيكية بالتناوب لا بالعشوائية**: ثابتةٌ لكل جملة (دالّة موضعها في السلّم)،
// فيُعرف سلفاً أيُّ نصٍّ سيُنطق — وعليه تُبنى قائمة الانتظار الصوتية بلا تخمين.

import { bareLetters } from './curriculum.js';
import { GARDENS, GRADED, WORDS } from './lexicon.js';

/** أكثر ما تحمله الدرجة الواحدة من جمل — حلقةٌ في دقائق كالباقة (٢٥ جملة تُرهق طفلاً). */
export const RUNG_MAX = 9;

/** الميكانيكيات الثلاث بترتيب تناوبها (بند الحزمة ٨). */
export const MECHANICS = ['read', 'order', 'fill'];

/**
 * أطولُ جملةٍ تُعطى ميكانيكية «رتّب» (الحزمة ٩أ): الترتيب يُقرأ كلمةً كلمة ثم تُوضع،
 * وجملةُ خمسِ كلماتٍ تصير ستَّ بلاطاتٍ أو سبعاً — نشاطٌ يُرهق طفل السادسة ويُطيل
 * الدرجة. فالطويلة تدور بين «اقرأ ونفّذ» و«أكمل الجملة»، وهما عين ما تُحسنه:
 * سياقٌ أطول ⇒ جوابٌ **مقروءٌ** لا مخمَّن (وهي علّة تأليف هذه المادة أصلاً).
 */
export const ORDER_MAX_WORDS = 3;

export const MECHANIC_TITLES = {
  read: 'اقرأ ونفّذ',
  order: 'رتّب الجملة',
  fill: 'أكمل الجملة',
};

const SHADDA = 'ّ';
const AL = /^اْ?لْ?(.+)$/;   // «الْ» التعريف — والشمسية بلا سكون على لامها
const TAIL = /[ً-ِْ]+$/;                // علامة الإعراب الأخيرة وحدها (الشدّة ليست منها)
const ALIF_TANWEEN = /َا$/;             // ألف تنوين النصب في الوقف: «زَيْدَا» ← «زَيْد»

/**
 * جذع الكلمة للمطابقة: بلا «ال» ولا شدّة الشمسية ولا علامة إعرابها.
 * «الْغُرْفَةُ» و«غُرْفَةْ» جذعُهما واحد، و«الرَّجُلُ» ← «رَجُل» لا يطابق «رِجْل»
 * — فالمطابقة على الحروف **بحركاتها** لا على الرسم المجرّد.
 * وألفُ تنوين النصب في الوقف علامةُ آخرٍ كسائرها: «زَيْدَا» ← «زَيْد» (الحزمة ٩).
 * (نظيرتها في الأدوات `stem` في `tools/check_lexicon.py` — القاعدة واحدة في الجهتين.)
 */
export function stemOf(text) {
  let out = String(text ?? '');
  const rest = AL.exec(out);
  if (rest && bareLetters(rest[1]).length >= 2) {   // «ال» تعريفٍ لا أوّلَ كلمة
    out = rest[1];
    out = out[0] + out.slice(1, 3).replace(SHADDA, '') + out.slice(3);
  }
  if (bareLetters(out.replace(ALIF_TANWEEN, '')).length >= 2) out = out.replace(ALIF_TANWEEN, '');
  return out.replace(TAIL, '');
}

/** كلمات الجملة كما تُعرض وتُنطق — لا مصدر ثانٍ لها (الفراغ يفصلها). */
export const sentenceWords = (text) => String(text ?? '').split(/\s+/).filter(Boolean);

// ————— لباس الموضع: صيغة كلمة المعجم في الجملة (إصلاح عيب «أكمل الجملة») —————
//
// كلمةُ المعجم مفردةٌ موقوفة («غُرْفَةْ») وفي الجملة تلبس ثوب موضعها («الْغُرْفَةُ»).
// وكان خيار «أكمل الجملة» يُعرض بالصيغة المعجمية ثم يملأ الفراغ بصيغة الجملة — تحوّلٌ
// صامت يخرق «ما تراه هو ما يحدث». فصار **الخيار يُعرض بالرمز الحرفي الذي سيملأ
// الفراغ**، والمشتّتان يلبسان الثوب نفسه اشتقاقاً.
//
// والاشتقاق **نظير `definite`/`strip_end` في `tools/make_sentences.py`** — هو مالكُ
// القاعدة، وهذه صورتُها في التطبيق (كما `stemOf` نظيرةُ `stem`). ولا تُصدَّق الصورة
// بالوعد: `dressOf` تستنبط الثوبَ **بالمقايسة** — أيُّ اشتقاقٍ يعيد بناء رمز الفراغ
// حرفاً بحرف — فإن عجزت الأربعةُ كلُّها عن رمزِ فراغٍ واحد سقط الفاحصُ والاختبار
// (`check_lexicon.py` و`test_sentences.mjs`) قبل أن يبلغ الشاشةَ خيارٌ يكذب.

const SUN = new Set('تثدذرزسشصضطظلن');   // الحروف الشمسية: تُدغم فيها لام «ال»
const FATHA = 'َ', KASRA = 'ِ', DAMMA = 'ُ';
const SUKUN = 'ْ', TANWEEN = 'ًٌٍ';
/** ما يقع آخر الكلمة: حركةٌ أو سكونٌ أو تنوين (نظير `END_MARKS` في المولّد). */
const END_MARKS = new Set([FATHA, KASRA, DAMMA, SUKUN, ...TANWEEN]);

/** نزع علامة الآخر (سكون الوقف أو حركة أو تنوين) — وما عداها يبقى. */
const stripEnd = (base) => (END_MARKS.has(base.slice(-1)) ? base.slice(0, -1) : base);

/**
 * «الـ» + الكلمة + علامة الآخر، بالإدغام الشمسي كما تُكتب في المصادر:
 * قمريّ بلامٍ ساكنة («الْغُرْفَةُ»)، وشمسيّ بلامٍ بلا حركة وشدّةٍ بعد حركة أوّله
 * («السَّرِيرُ») — وهو عين ما يقبله فاحص المفكوكية بعد درس اللام الشمسية.
 */
function definite(base, mark) {
  const body = stripEnd(base);
  if (SUN.has(body[0])) return `ال${body[0]}${body[1]}${SHADDA}${body.slice(2)}${mark}`;
  return `ال${SUKUN}${body}${mark}`;
}

/** المضاف إلى ياء المتكلم: «أُذُنْ» ← «أُذُنِي»، والتاء المربوطة تُبسَط («جَدَّةْ» ← «جَدَّتِي»). */
function possessed(base) {
  const body = stripEnd(base);
  return `${body.endsWith('ة') ? `${body.slice(0, -1)}ت` : body}${KASRA}ي`;
}

/** الأثواب الأربعة، بترتيب المقايسة: ما تلبسه كلمةُ المعجم في مواضع جملنا كلها. */
const DRESSES = {
  none: (base) => base,                             // آخرُ الجملة موقوفاً كما في المعجم
  def: definite,                                    // «الـ» وعلامة الموضع
  bare: (base, mark) => stripEnd(base) + mark,      // نكرةٌ بعلامة الموضع (المضاف)
  poss: possessed,                                  // مضافٌ إلى ياء المتكلم
};

/**
 * ثوبُ هذا الموضع مستنبَطاً بالمقايسة: أيُّ اشتقاقٍ يبني رمزَ الفراغ من كلمة المعجم.
 * ويعود `null` إن عجزت الأربعة، فتعود الثلاثةُ إلى صيغتها المعجمية كما كانت قبل
 * الإصلاح — **ولا تبلغ الشاشةَ مادّةٌ كهذه**: `check_lexicon.py` يرفض جملةً لا
 * يُستنبَط ثوبُها (كلَّ جملةٍ في الملف لا جملَ «أكمل» وحدها)، ويسقط بها الاختبار.
 */
export function dressOf(base, token) {
  const mark = END_MARKS.has(token.slice(-1)) ? token.slice(-1) : '';
  for (const kind of Object.keys(DRESSES)) {
    if (DRESSES[kind](base, mark) === token) return { kind, mark };
  }
  return null;
}

/** كلمةُ معجمٍ ← صيغتُها في ذلك الموضع. */
export const dressed = (base, dress) => (dress ? DRESSES[dress.kind](base, dress.mark) : base);

// ————— بناء السلّم —————

const gardenIndex = new Map(GARDENS.map((garden, i) => [garden.id, i]));

const stemGarden = new Map();
for (const word of WORDS) {
  const stem = stemOf(word.word);
  if (!stemGarden.has(stem)) stemGarden.set(stem, gardenIndex.get(word.theme) ?? 0);
}

/**
 * مادّة السلّم موحَّدةً من مصدريها: جملةُ كلِّ كلمةٍ (كلمتان) ثم الجملُ المتدرّجة
 * (٣–٥). لكلٍّ نصُّها وهدفُها — والهدف صورةُ الجملة وفراغُ «أكمل الجملة».
 */
// المعرّف بنيويّ لا نصّي: نصّان في الحزمة ٧ متطابقان («الْمَوْزُ أَصْفَرْ» جملةُ
// «مَوْزْ» و«أَصْفَرْ» معاً)، فالنصّ لا يصلح معرّفاً — والفاحص ينبّه عليهما.
const MATERIAL = [
  ...WORDS.map((word) => ({ id: word.word, text: word.sentence, target: word })),
  ...GRADED.map((entry, i) => ({ id: `graded:${i + 1}`, ...entry })),
].filter((item) => item.text && item.target);

/** موضع الجملة: أبعدُ بستانٍ تنتمي إليه كلمةٌ من كلماتها (وبستانُ هدفها أدناه). */
function placeOf(item) {
  let place = gardenIndex.get(item.target.theme) ?? 0;
  for (const token of sentenceWords(item.text)) {
    const garden = stemGarden.get(stemOf(token));
    if (garden !== undefined && garden > place) place = garden;
  }
  return place;
}

/** تقسيمٌ متوازن إلى قطعٍ لا تتجاوز `max` (٢٢ جملة ← ٨+٧+٧ لا ٩+٩+٤). */
function chunk(list, max) {
  const parts = Math.max(1, Math.ceil(list.length / max));
  const out = [];
  for (let i = 0, start = 0; i < parts; i++) {
    const size = Math.floor(list.length / parts) + (i < list.length % parts ? 1 : 0);
    out.push(list.slice(start, start + size));
    start += size;
  }
  return out;
}

/**
 * موضع الكلمة المصوَّرة في جملتها — هي فراغ «أكمل الجملة» وصاحبة صورتها.
 * تُطابَق بجذعها، وإلا فبما بُني عليه («أُخْتْ» ← «أُخْتِي» بياء الإضافة).
 */
function blankIndex(target, words) {
  const stem = stemOf(target.word);
  const exact = words.findIndex((w) => stemOf(w) === stem);
  return exact >= 0 ? exact : words.findIndex((w) => stemOf(w).startsWith(stem));
}

/**
 * كلماتُ المعجم التي **لا تلبس ثوباً** — والمعجمُ هو الذي يعلنها، فلا تخمينَ صرفٍ
 * هنا: الكلمة التي تظهر في **جملتها هي** بصيغتها المفردة إمّا مضافةٌ إلى ياء المتكلم
 * («أَبِي كَرِيمْ») أو صفةٌ خبر («الْبَحْرُ أَزْرَقْ») — وكلتاهما لا تُعرَّف ولا تُضاف
 * («الْأَبِيُ» و«أَحْمَرِي» ليستا عربيتين). فلا تكون واحدةٌ منها مشتّتاً ملبوساً.
 *
 * وخطؤُه — إن وقع — يضيّق الحوض ولا يُخرج صيغةً فاسدة: أسوأُ ما فيه مشتّتٌ أقلّ.
 * وحيث الثوبُ «none» يعود الحوضُ كلَّه (وهناك الألوان أحسنُ مشتّتٍ لبعضها بعضاً).
 */
const DRESSLESS = new Set(WORDS.filter((word) => {
  const words = sentenceWords(word.sentence);
  const at = blankIndex(word, words);
  const dress = at >= 0 ? dressOf(word.word, words[at]) : null;
  return !dress || dress.kind === 'none';
}).map((word) => word.word));

/** هل تقبل هذه الكلمةُ لباسَ الموضع؟ (انظر `DRESSLESS` أعلاه) */
export const wearable = (base, dress) => !dress || dress.kind === 'none' || !DRESSLESS.has(base);

// جمل كل بستان مرتَّبةً **بالطول** — به يتدرّج سلّمه: كلمتان ← ثلاث ← أربع فخمس.
// الفرز مستقرّ، فالمتساويات تبقى بترتيب مصدرها (لا عشوائية في موضع جملة).
const byPlace = GARDENS.map(() => []);
for (const item of MATERIAL) byPlace[placeOf(item)]?.push(item);
for (const list of byPlace) list.sort((a, b) => sentenceWords(a.text).length - sentenceWords(b.text).length);

let serial = 0;   // ترتيب الدرجة في السلّم كله — به تدور الميكانيكيات فلا تبدأ الدرجات كلها بواحدة

/**
 * السلالم: سلّمٌ لكل بستان، ودرجاته عقدٌ على الخريطة بعد باقاته.
 * كل درجة: جملٌ لكل واحدة ميكانيكيتها ({read, order, fill} بالتناوب) — والدورة
 * **تتخطّى «رتّب» في الجملة الطويلة** (≥٤ كلمات) فتبقى دورةَ اثنتين هناك. وبهذا
 * لا تتجاور جملتان بموضعٍ واحد من الدورة أبداً: العدّاد يتقدّم عند كل جملة.
 *
 * و`slot` موضعُ الجملة من الدورة، و`mechanic` ما يُعرَض فعلاً — ولا يفترقان إلا في
 * حالةٍ واحدة معلَنة: هدفٌ غير مصوَّر في موضع «اقرأ ونفّذ» يُعرَض «أكمل» (انظر أدناه).
 */
export const LADDERS = GARDENS.map((garden, index) => {
  const ladder = { id: garden.id, garden, rungs: [] };
  ladder.rungs = chunk(byPlace[index], RUNG_MAX).map((slice, i) => {
    const rung = { id: `${garden.id}:${i + 1}`, index: i + 1, garden, ladder, sentences: [] };
    let turn = serial++;
    rung.sentences = slice.map((item) => {
      const words = sentenceWords(item.text);
      while (MECHANICS[turn % MECHANICS.length] === 'order' && words.length > ORDER_MAX_WORDS) turn++;
      const slot = MECHANICS[turn++ % MECHANICS.length];   // موضعُ الجملة من الدورة
      let mechanic = slot;
      // «اقرأ ونفّذ» صورتُها هي الجوابُ كلُّه، فهدفٌ **غير مصوَّر** لا يُحكَم بها عليه
      // («صدق الصورة» — DESIGN §٦) ⇒ «أكمل الجملة» بلا صورٍ أصلاً (انظر `ladder.js`).
      // و**استبدالٌ موضعيّ لا تخطٍّ**: العدّاد لا يُزحزَح، فلا تتبدّل ميكانيكيةُ جملةٍ
      // أخرى ولا يدخل قائمةَ الصوت نصٌّ جديد — الاستثناء يقع حيث وقع ولا يتعدّاه.
      if (mechanic === 'read' && item.target.pictured === false) mechanic = 'fill';
      const blank = blankIndex(item.target, words);
      return {
        id: item.id,
        rung,
        target: item.target,
        text: item.text,
        words,
        blank,
        // ثوبُ الهدف في هذا الموضع — به تُلبَس المشتّتات مثلَه في «أكمل الجملة»
        dress: blank >= 0 ? dressOf(item.target.word, words[blank]) : null,
        slot,
        mechanic,
      };
    });
    return rung;
  });
  return ladder;
});

export const RUNGS = LADDERS.flatMap((ladder) => ladder.rungs);
export const SENTENCES = RUNGS.flatMap((rung) => rung.sentences);

export const ladderOf = (gardenId) => LADDERS.find((l) => l.id === gardenId) || null;
export const rungById = (id) => RUNGS.find((r) => r.id === id) || null;

/**
 * كلمات «رتّب الجملة» في بستانٍ واحد — منها تُؤخذ بلاطات اللوح ومشتّتاته
 * (كما تُؤخذ مقاطع «ركّب الكلمة» من مقاطع البستان). كلها منطوقة بالضرورة:
 * جملُ «رتّب» وحدها هي التي تدخل كلماتُها قائمةَ الصوت.
 */
export function orderPool(garden) {
  const words = (ladderOf(garden.id)?.rungs || [])
    .flatMap((rung) => rung.sentences)
    .filter((s) => s.mechanic === 'order')
    .flatMap((s) => s.words);
  return [...new Set(words)];
}

/**
 * حوضُ خيارات الجملة: كلمات بستانها المصوَّرة سوى هدفها (`pickOptions` تسحب منه).
 * وفي «أكمل الجملة» يُزاد شرطٌ: أن تقبل الكلمةُ لباسَ الموضع — فالمضاف إلى ياء
 * المتكلم لا يُعرَّف («الْأَبِيُ» ليست عربية)، ولا يصحّ عرضُه بصيغته وحده بين
 * ملبوسَين فيفضح نفسه.
 */
export function optionPool(sentence) {
  return sentence.rung.garden.words.filter((w) => w !== sentence.target
    && w.pictured !== false
    && (sentence.mechanic !== 'fill' || wearable(w.word, sentence.dress)));
}

/**
 * نصُّ خيارٍ في «أكمل الجملة» — **هو بعينه ما سيستقرّ في الفراغ**: الهدفُ يعود
 * برمز الفراغ حرفاً بحرف (يثبته الاختبار في كل جملة)، والمشتّتُ يلبس ثوبَه نفسه.
 */
export const fillText = (sentence, word) => dressed(word.word, sentence.dress);

/** ما قد يُسمعه الطفلُ من خيارات «أكمل» عند الخطأ: صيغُ مشتّتاتها الملبوسة. */
export const fillOptionTexts = (sentence) => (sentence.mechanic === 'fill'
  ? optionPool(sentence).map((w) => fillText(sentence, w))
  : []);

/**
 * كل ما ينطقه السلّم، بترتيب لقاء الطفل به (وهو ترتيب تصريف قائمة الانتظار):
 * الجملة كاملةً في كل ميكانيكية، وكلماتُها مفردةً في «رتّب»، **وصيغُ خيارات «أكمل»
 * الملبوسة** — فبها يُسمَع الطفلُ ما اختاره عند الخطأ، وهي غيرُ كلمة المعجم المفردة.
 * وما سوى هذين لا يُنقر فيه على كلمة (خيارات «اقرأ ونفّذ» صورٌ لها أصواتُ معجمها).
 */
export function ladderTexts() {
  const out = [];
  for (const rung of RUNGS) {
    for (const sentence of rung.sentences) {
      out.push(sentence.text);
      if (sentence.mechanic === 'order') out.push(...sentence.words);
      out.push(...fillOptionTexts(sentence));
    }
  }
  return [...new Set(out)];
}
