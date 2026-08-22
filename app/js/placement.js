// بوابةُ اللحاق — امتحانُ تحديد المستوى الاختياريّ (ملفّ اللحاق، ١٦ أغسطس ٢٠٢٦).
//
// **الغاية**: تلميذُ مدرسةٍ أو مركزٍ يصل بمستوىً قائم — يمتحن فيُفتح له ما أثبته
// ويقف حيث ينكسر، بدل أن يمشي رحلةَ المبتدئ من الألف. وهو **اختياريّ**: بابُه
// الوحيد قسمٌ في لوحة وليّ الأمر، فلا يراه طفلٌ ولا يقع بنقرةٍ عابرة.
//
// وستُّ قواعد تحكم هذا الملف — وكلُّها قيودُ صدقٍ لا زينة:
//
// ١) **السلّمُ مشتقٌّ لا مكتوب، ودرجتُه شريحةٌ لا مجموعة** (حكمُ المدير أ على تسليم
//    ل١، ١٦ أغسطس ٢٠٢٦): درجاتُه مجموعاتُ `journey()` بترتيبها، **ومع كل مجموعةٍ ما
//    يتلوها حتى المجموعة التالية** من درسِ علامةٍ ومحطةِ مواجهةٍ وقصة. ومادّةُ كل
//    درجةٍ مفاتيحُ مهارات **عقدها كلِّها** (درسُ الحرف يكتب `quiz` و`haraka`، ولعبةُ
//    الكلمات `build`، ودرسُ العلامة نوعَيه، ومحطةُ المواجهة `contrast` — وهو عينُ
//    ما يعلنه جردُ `test_measure.mjs` لهذه الأنواع). فمجموعةٌ ثامنة تدخل السلّم
//    يومَ تُضاف، ومحطةٌ تُوضَع بين مجموعتين تدخل شريحتَها يومَ تُوضَع، بلا سطرٍ
//    يُعدَّل. **وعلّةُ الشريحة**: كانت الدرجةُ المجموعةَ وحدَها فيقف طفلٌ أثبت خمساً
//    عند درسِ مدٍّ لا عند مجموعته السادسة؛ وفتحُ ما بينها بلا امتحانٍ يخون قيدَ
//    الصدق الثاني — فالوسطُ الصادق أن **تُمتحَن الشريحةُ كلُّها فتُفتح كلُّها**.
//
// ٢) **صفرُ شكلِ تمرينٍ جديد**: التمارينُ تمارينُ المراجعة/البوابة نفسُها
//    (`buildSession` ثم `renderSession`) — فكلُّ ما تنطقه له ملفٌ مولَّد أصلاً،
//    و**صفرُ إضافةٍ صوتية** بالبناء لا بالوعد.
//
// ٣) **عتبةُ البوابة نفسُها لا رقمٌ ثانٍ**: `passed` من `gate.js` — فلو تحرّكت
//    ثمانون غداً تحرّكتا معاً، ولا يفترق حكمان على شيءٍ واحد.
//
// ٤) **حدودُ الفتح ثلاثة**: عقدُ الشريحة المجتازة كلُّها تُعلَّم — **وقد امتُحن في
//    كل محطةٍ منها** (`stationKeys`: مفتاحان من كل محطةٍ سوى المجموعة، فلا تُفتح
//    محطةٌ لم تُمَسّ)، والقصةُ فيها تتبع (مادّةُ قراءةٍ لا قياس — إعفاؤها المكتوب
//    في `test_measure.mjs`)؛ و**السلّمُ يقف عند أوّل بوّابة إتقانٍ لم تُجتز**
//    (البواباتُ لا تُقفز — تُجتاز بنفسها)؛ و**المرحلةُ القرآنية خارج السلّم كلياً**
//    (المصحفُ يُتلى لا يُمتحَن — إعفاؤه المكتوب هناك كذلك).
//
// ٥) **ليتنر يقرأ محاولاته كسائرها**: `renderSession` تكتب كلَّ محاولةٍ بـ
//    `recordAttempt` — لا وسمَ خاصاً ولا استثناء، وقواعدُ الخفوت بحالها.
//    **ولا تُقيَّد مراجعةَ يوم** (`markReview`): هذا امتحانُ تحديدِ موضعٍ لا جلسةُ
//    تثبيت، وعدُّه مراجعةَ اليوم يقول لوليّ الأمر «راجَع» وهو لم يراجع.
//
// ٦) **فتحٌ لا قفل**: لا يُغلق مفتوحٌ أبداً (النجمةُ ترتفع ولا تنخفض — قيدُ
//    `recordPlacement`)، والإعادةُ من اللوحة تستأنف من **آخر حدّ** لا من الألف.
//
// ٧) **مسطرةٌ واحدة لكل مُمتحَن** (قاعدةُ المالك، ١٧ أغسطس ٢٠٢٦ — بلاغ
//    `2026-08-17-support-and-placement-coexist.md`): طفلٌ في وضع الدعم يُمتحَن هنا
//    **بمقادير القائم لا بمقاديره**: العونُ الذي **يريح** يسري (صوتٌ أبطأ · هدوءٌ
//    حسّيّ · تشكيلٌ ثابت) فلا يُمتحَن بشاشةٍ تُربكه، والذي **يجيب** يُمنع قطعاً
//    (حوضٌ أضيق · تلميحٌ · وأيُّ مسٍّ بالعتبة) فلا يُفتح له بامتحانٍ أسهلَ من امتحان
//    غيره. وموضعُ التعطيل `rungItems` أدناه — حيث تُبنى التمارين وتُقرأ المقادير.

import { HARAKAT, markSkillKey, syllableSkill } from './curriculum.js';
import { passed } from './gate.js';
import * as progress from './progress.js';
import { buildSession, renderSession } from './review.js';
// **مسطرةُ الامتحان الواحدة** (بلاغ `2026-08-17-support-and-placement-coexist.md`):
// يُستورَد نطاقُ الامتحان وحدَه — لا مقدارٌ من مقادير وضع الدعم يُقرأ هنا.
import { duringExam } from './support.js';
import { h, icon, arNum, arCount, faceEl, go, mascot, pick, shuffle, PAUSE_ACCENT } from './ui.js';

/**
 * عيّنةُ الدرجة الواحدة: ثمانيةُ تمارين — بين جلسة المراجعة (ستّ) والبوابة (عشر).
 * وكانت ستّاً يومَ كانت الدرجةُ مجموعةً؛ فلمّا صارت **شريحةً** بمحطاتها زادت ركنين
 * تسعان لمفاتيح تلك المحطات بلا أن تبتلعا مادّةَ المجموعة نفسِها.
 */
export const SAMPLE = 8;

/**
 * كم مفتاحاً يُمتحَن من كل محطةٍ في الشريحة **سوى مجموعتها**: اثنان — نوعا العلامة
 * (قراءةٌ صامتة وتمييزٌ بالأذن: مهارتان في ليتنر لا واحدة)، أو زوجان مختلفان من
 * محطة المواجهة. وهو الحدُّ الأدنى الذي يجعل الفتحَ **مُثبَتاً**: لا تُفتح محطةٌ
 * لم تُمَسّ، ولا تبتلع محطةٌ واحدةٌ العيّنةَ كلَّها.
 */
export const PER_STATION = 2;

/**
 * وجوهُ الشاشة — **من أيقونات الواجهة الخطية** لا من رموز البيانات (`ICONS` في
 * `ui.js`، DESIGN §٦): كتبٌ مصفوفةٌ تصعد سلّماً للامتحان، وهديّةُ «فتحِ المجموعة
 * التالية» لمن صعد درجة، ووثبةُ فرحٍ لمن أتمّ السلّم، وابتسامةٌ لمن وقف — وهي
 * وجهُ «لَيْسَ بَعْدُ» في البوابة نفسُه: لا وجهَ عبوسٍ في هذا التطبيق.
 */
const FACES = { exam: 'books', step: 'gift', done: 'party', stop: 'smile' };

// ————— السلّم —————

/**
 * درجاتُ السلّم: **شرائحُ** الرحلة قبل المرحلة القرآنية بترتيبها — **مشتقّةٌ من
 * `journey()` لا مكتوبة**. والشريحةُ مجموعةٌ وما يتلوها من أقسامٍ حتى المجموعة
 * التالية (درسُ علامةٍ · محطةُ مواجهةٍ · قصة)، فهي **وحدةُ الامتحان والفتح معاً**.
 *
 * والحدّان مرسومان هنا لا في موضعٍ آخر، فيُقرآن حيث يعملان:
 *   • **المرحلةُ القرآنية تقطع السلّم** — لا تُمتحَن ولا يُمتحَن ما بعدها.
 *   • **البوّابةُ التي لم تُجتز تقطعه كذلك** — «تُجتاز بنفسها»؛ وإن كان الطفلُ قد
 *     عبَرها بنفسه مضى السلّمُ إلى ما بعدها. فبوّابةٌ تُوضَع بين مجموعتين غداً
 *     تقصُر السلّمَ عندها **يومَ تُوضَع** بلا سطرٍ يُعدَّل. (والبوّابةُ المجتازة
 *     لا تدخل شريحةً: تُتخطّى ولا تُضمّ — لا يُفتح ما يُجتاز بنفسه.)
 *
 * والشريحةُ **تحمل أقسامَها لا نسخةً عنها** (`sections` مراجعُ `journey()` أنفسُها)،
 * وعقدُها مسطَّحُ عقدها، واسمُها اسمُ مجموعتها — فما يقرؤه وليُّ الأمر لا يتبدّل.
 */
/**
 * القاعدةُ **دالّةً خالصة** — تُحقَن بأقسام الرحلة وبمن يعرف البوّابةَ المجتازة،
 * فيمتحنها حارسُها بأقسامٍ مصنوعة: بوّابةٌ في وسط المجموعات تقصُر السلّمَ عندها،
 * ومجتازةٌ لا تقصُره، ومرحلةٌ قرآنية تقطعه، ومحطةٌ بين مجموعتين تنضمّ إلى شريحتها.
 * ولولا الحقنُ لكان الحدّان **صامتين** (لا بوّابةَ اليومَ بين المجموعتين) — والحدُّ
 * الصامت لا يُعرَف صحيحاً من فاسد.
 */
export function rungsOf(sections, crossed) {
  const parts = [];
  for (const section of sections) {
    if (section.kind === 'quran') break;
    if (section.kind === 'gate') {
      if (crossed(section.id)) continue;
      break;
    }
    if (section.kind === 'group') parts.push([section]);
    else if (parts.length) parts[parts.length - 1].push(section);
  }
  return parts.map((slice) => ({
    id: slice[0].id,
    group: slice[0].group,
    sections: slice,
    nodes: slice.flatMap((section) => section.nodes),
  }));
}

export function rungs() {
  return rungsOf(progress.journey(), (id) => progress.getStars(id) > 0);
}

/**
 * موضعُ الاستئناف: أوّلُ درجةٍ لم تكتمل عقدُها بعد — **«من آخر حدّ»**. فالإعادةُ
 * لا تُعيد امتحانَ ما فُتح، ولا حاجةَ إلى سجلٍّ ثانٍ يقول أين وقف: النجومُ تقوله.
 * (وتعود بطول القائمة إن لم يبق شيء — أي: لا امتحانَ له.)
 */
export function startRung(list = rungs()) {
  const at = list.findIndex((rung) => rung.nodes.some((node) => !progress.isDone(node.id)));
  return at < 0 ? list.length : at;
}

/**
 * أنواعُ عقدِ الشريحة التي **تُقاس**، ولكلٍّ مُشتقُّ مفاتيحه أدناه. ونوعٌ خامسٌ يدخل
 * شريحةً غداً **يُسقِط حارسَه** (`test_placement.mjs` يجرد أنواعَ عقد الدرجات): فلا
 * يمرّ صامتاً بلا مفاتيحَ تُمتحَن ثم يُفتح بامتحانٍ لم يمسّه.
 */
export const MEASURED = new Set(['letter', 'words', 'skill', 'contrast']);

/**
 * وما يُقرأ ولا يُقاس — **مكتوبٌ بسببه** كإعفاءات `test_measure.mjs`: القصةُ مادّةُ
 * قراءةٍ لا مهارةَ فيها تُمتحَن، فتُفتح تبعاً لشريحتها وتبقى متاحةً للقراءة الحرّة.
 */
export const READ_ONLY = new Set(['story']);

/**
 * مفاتيحُ مهارات الدرجة المتمايزة — **من عقدها لا من قائمةٍ تُكتب**: لكل حرفٍ
 * تمييزُه بأذنه (`quiz`) وتمييزُ حركته (`haraka`) بحركاتها الثلاث، ولكل مقطعٍ في
 * كلمات مجموعتها تركيبُه (`build`)، **ولكل درسِ علامةٍ نوعاه** (`mark-compare`
 * و`mark-quiz` بمفتاح `mark-<الدرس>`)، **ولكل زوجٍ في محطة المواجهة** حروفُه
 * بحركاتها (`contrast`) — وهي مفاتيحُ تلك المحطات أنفسِها في ليتنر لا مفاتيحُ
 * أُخَرُ تشبهها.
 */
export function skillKeys(rung) {
  const keys = new Map();
  const put = (letter, haraka, kind) => {
    if (!letter) return;
    const key = progress.skillKey(letter, haraka, kind);
    if (!keys.has(key)) keys.set(key, { letter, haraka, kind });
  };
  for (const node of rung.nodes) {
    if (node.type === 'letter') {
      // **بُعدُ الحركة تملكه خطوةُ الحركات وحدَها** (حكمُ المدير في بوابة تصميم ع٢):
      // «ميّز بأذنك» خياراتُها حروفٌ بحركةٍ **واحدة متطابقة** فلا يُفرَّق بينها إلا
      // بالحرف — فمقيسُها الحرفُ لا الحركة، ومفتاحُها الفتحةُ وحدَها. وكان يُعلَن
      // ثلاثةً وتُبنى له ثلاثُ جولاتٍ مقترَعة، فبقي **٢٩ مفتاحاً يُفتَح ولا يُقاس**
      // في الرحلة كلِّها (حارسُ الوعد، سورُه الأوّل) وامتحنت بوابةُ اللحاق ما لا
      // تقيسه محطتُه. وأما الحركاتُ فثلاثتُها معلَنةٌ ومقيسةٌ في درسها (لا تضييق).
      put(node.letter, HARAKAT[0].key, progress.KINDS.QUIZ);
      for (const k of HARAKAT) put(node.letter, k.key, progress.KINDS.HARAKA);
    } else if (node.type === 'words') {
      for (const word of rung.group.words || []) {
        for (const tile of word.tiles || []) {
          const skill = syllableSkill(tile);
          if (skill) put(skill.letter, skill.haraka, progress.KINDS.BUILD);
        }
      }
    } else if (node.type === 'skill') {
      for (const kind of [progress.KINDS.MARK_COMPARE, progress.KINDS.MARK_QUIZ]) {
        put(markSkillKey(node.skill.id), null, kind);
      }
    } else if (node.type === 'contrast') {
      for (const pair of node.contrast?.pairs || []) {
        for (const letter of pair.letters) {
          for (const k of HARAKAT) put(letter, k.key, progress.KINDS.CONTRAST);
        }
      }
    }
  }
  return [...keys.values()];
}

/**
 * **مفاتيحُ المحطات المضمونة**: `PER_STATION` من كل محطةٍ في الشريحة سوى مجموعتها.
 *
 * وعلّتُها أنّ العيّنةَ خلطٌ: لو أُلقيت مفاتيحُ درسِ العلامة في حوضٍ فيه أربعةٌ
 * وعشرون مفتاحَ حرفٍ لَما ظهرت إلا نادراً — **فيُفتح درسُ المدّ بامتحانٍ لم يذكره**.
 * فتُقدَّم هنا على غيرها في `due`، ويتكفّل الحوضُ بالباقي. والمواجهةُ **زوجان
 * مختلفان** لا زوجٌ مرتين: المحطةُ ستّةُ أزواج، وزوجٌ واحدٌ لا يشهد لها.
 *
 * **وحرفان مختلفان كذلك**: الحرفُ قد يقع في زوجين من المحطة نفسِها (`ح` في «هـ/ح»
 * و«ع/ح»)، فزوجان مختلفان قد يعطيان مفتاحاً واحداً — ومفتاحان متّحدان تمرينٌ واحد
 * في `buildSession` (تُسقِطه مطابقةُ المعرّف)، فتُفلت المحطةُ بنصف حصّتها.
 */
export function stationKeys(rung, rnd = Math.random) {
  const out = [];
  for (const node of rung.nodes) {
    if (node.type === 'skill') {
      for (const kind of [progress.KINDS.MARK_COMPARE, progress.KINDS.MARK_QUIZ]) {
        out.push({ letter: markSkillKey(node.skill.id), haraka: null, kind });
      }
    } else if (node.type === 'contrast') {
      const taken = new Set();
      for (const pair of shuffle(node.contrast?.pairs || [], rnd)) {
        if (taken.size >= PER_STATION) break;
        const fresh = pair.letters.filter((letter) => !taken.has(letter));
        if (!fresh.length) continue;
        const letter = pick(fresh, rnd);
        taken.add(letter);
        out.push({ letter, haraka: pick(HARAKAT, rnd).key, kind: progress.KINDS.CONTRAST });
      }
    }
  }
  return out;
}

/**
 * حصيلةُ الدرجة: حروفُ شريحتها وما قبلها وكلماتُها **ودروسُ علاماتها وأزواجُ
 * مواجهاتها** — **حوضُ المادّة كما يراه الطفلُ في تلك المحطة من الرحلة** (لا حرفٌ
 * لم يبلغه ولا علامةٌ لم تُدرَّس، ولا مجموعتُه وحدها فيلتبس بابُ الاختيار على
 * ثلاثة أحرفٍ متشابهة). وبها تعمل مُنشئاتُ المراجعة: `markItem` ترفض درساً ليس في
 * `marks`، و`contrastItem` ترفض حرفاً ليس في `pairs` — فالمفكوكيةُ بالبناء.
 */
function stock(list, index) {
  const upto = list.slice(0, index + 1);
  const nodes = upto.flatMap((rung) => rung.nodes);
  return {
    letters: upto.flatMap((rung) => rung.group.letters),
    words: upto.flatMap((rung) => rung.group.words),
    marks: nodes.filter((node) => node.type === 'skill').map((node) => node.skill),
    pairs: nodes.filter((node) => node.type === 'contrast')
      .flatMap((node) => node.contrast?.pairs || []),
  };
}

/**
 * تمارينُ درجةٍ واحدة — بمُنشئات المراجعة نفسِها، ومادّتُها **حصّتان**:
 *   • مفاتيحُ محطاتها المضمونة أوّلاً — فلا تُفتح محطةٌ لم تُمَسّ؛
 *   • ثم مفاتيحُ **مجموعتها** مخلوطةً تُكمل العدد — فلا تُستظهَر عيّنةٌ ولا تُمتحَن
 *     حركةُ الفتحة وحدَها في كل مرة.
 *
 * **ولِمَ كان الباقي للمجموعة وحدَها**: هي أكبرُ محطات الشريحة وأجدُّ مادّتها (خمسةُ
 * حروفٍ جديدة)، وقد أخذت كلُّ محطةٍ سواها حصّتَها المضمونة — فلولا ذلك لابتلعت محطةُ
 * مواجهةٍ بأربعة أزواجٍ نصفَ الامتحان لأنّ مفاتيحَها أكثرُ عدداً لا أعظمُ شأناً.
 *
 * **وهنا تُشدّ مسطرةُ الامتحان الواحدة** (القيد ٧): البناءُ كلُّه داخل `duringExam`،
 * وفيه تُقرأ مقاديرُ الصعوبة كلُّها — سعةُ الحوض في مُنشئات المراجعة، وحجمُ العيّنة
 * (وهو `SAMPLE` هنا لا جرعةَ وليّ الأمر)، والتلقينُ الذي لا تعرفه هذه الشاشة أصلاً.
 * فطفلُ الدعم وطفلُ القائم يُمتحَنان بحوضٍ واحد وعيّنةٍ واحدة، **ومقابضُ الراحة
 * تسري في الحالين** لأنّها لا تُقرأ هنا: سرعةُ الصوت عند التشغيل، والهدوءُ صنفٌ على
 * الجذر، وموعدُ ليتنر عند تسجيل المحاولة — كلُّها بعد انقضاء هذا النطاق.
 */
export function rungItems(index, rnd = Math.random) {
  const list = rungs();
  const rung = list[index];
  if (!rung) return [];
  const { letters, words, marks, pairs } = stock(list, index);
  const own = skillKeys({ group: rung.group, nodes: rung.sections[0].nodes });
  return duringExam(() => buildSession({
    letters,
    words,
    marks,
    pairs,
    due: [...shuffle(stationKeys(rung, rnd), rnd), ...shuffle(own, rnd)],
    size: SAMPLE,
    rnd,
  }));
}

/**
 * ما يُفتَح باجتياز درجة: عقدُ شريحتها كلُّها — دروسُها ومواجهتُها وقصّتُها،
 * **ولا بوّابةَ ولا عقدةً قرآنيةً بحال**. والحدُّ مكتوبٌ هنا وإن لم تقع في شريحةٍ
 * اليومَ بوّابةٌ ولا عقدةٌ قرآنية: هو الذي يبقى صحيحاً حين تتبدّل الرحلة، والحارسُ
 * يقرؤه لا يقرأ حالَ اليوم.
 */
const NEVER_OPENED = new Set(['gate', 'quran', 'prophet']);

export function openableNodes(rung) {
  return rung.nodes.filter((node) => !NEVER_OPENED.has(node.type)).map((node) => node.id);
}

// ————— ما يقرؤه وليُّ الأمر —————

/**
 * حالُ اللحاق لقسم اللوحة: كم درجةً بقيت، وأين يستأنف، وسجلُّ آخر نتيجة
 * بأسماء المجموعات لا بمعرّفاتها.
 */
export function state() {
  const list = rungs();
  const at = startRung(list);
  const log = progress.placementLog();
  const titleOf = (id) => list.find((rung) => rung.id === id)?.group?.title || id;
  return {
    total: list.length,
    at,
    left: Math.max(0, list.length - at),
    next: list[at]?.group?.title || null,
    log: log && {
      ...log,
      titles: log.groups.map(titleOf),
      stoppedTitle: log.stopped ? titleOf(log.stopped) : null,
    },
  };
}

// ————— بطاقةُ أول تشغيل: البابُ يُدَلّ عليه مرّةً واحدة (الجلسة د٣) —————
//
// **سببُها ميدانيّ** (سؤال المالك، ١٧ أغسطس ٢٠٢٦): بوابةُ العائلة تدعو الوالدَ
// «اختبر مستوى طفلك»، فيفتح التطبيق **في المتصفّح** ويمتحن — **وعلى iOS للتطبيق
// المثبَّت مخزنٌ مستقلٌّ عن سفاري**، فيثبّت بعدها فيجد الرحلةَ من أوّلها. وبابُ
// الامتحان قسمٌ في لوحة وليّ الأمر (وهو بابُه الوحيد، ويبقى)، فمن لم يفتح اللوحةَ
// لم يعرف أنّ ثمّة امتحاناً أصلاً. **فالعلاجُ في موضع العيب**: مَن دخل أوّلَ مرّةٍ
// يُدَلّ على البابين قبل أن يمشي، لا أن نعتمد على أن يقرأ صفحةً قبل أن يدخل.
//
// وأربعةُ قيودٍ تحكمها — وكلُّها ضيقُ نافذةٍ لا زينة:
//
// ١) **رحلةٌ بكرٌ وحدَها**: `isPristine` — صفرُ نجومٍ وصفرُ محاولاتٍ في ليتنر. فطفلٌ
//    يمشي منذ أسبوع لا يراها أبداً، ولا يُدعى إلى امتحان موضعٍ مَن له موضعٌ بالفعل.
//
// ٢) **وتُخفى إلى الأبد ولا تعود**: بـ«لاحقاً» (بمذكّرةٍ تعبر إعادةَ التحميل) أو
//    بأوّل نجمةٍ يكسبها الطفل (فتكذب `isPristine` من نفسها بلا مذكّرة). ودعوةٌ
//    تُلحّ مرّتين ليست دعوةً — وهذا عينُ ما يفعله شريطُ التثبيت برقاده.
//
// ٣) **ولا تقع بنقرةٍ عابرة**: `cta.hash` **بوابةُ وليّ الأمر** (مسألةُ الضرب) لا
//    الامتحانَ رأساً — فالطفلُ لا يفتح على نفسه امتحاناً، وبابُ اللحاق يبقى واحداً.
//
// ٤) **والتثبيتُ أولاً في المتصفّح**: ما دام يعمل في متصفّحٍ لا مثبَّتاً **تُقدَّم
//    دعوةُ التثبيت وحدَها** (`cta === null` بالبناء لا بشرطٍ في الشاشة) — لأنّ
//    القياسَ في المتصفّح قد لا ينتقل إلى المثبَّت، وامتحانٌ يضيع أسوأُ من امتحانٍ
//    يتأخّر ساعة.
//
// **ونصّها بيانٌ لا شاشة**: الجدولُ أدناه هو ما يُعرض، و`main.js` يصيّره ولا يكتب
// حرفاً — فيُقرأ حكمُ «لا دعوةَ امتحانٍ قبل التثبيت» في سطرٍ واحد يفحصه الحارس.
// **وهي بطاقةُ بالغٍ لا شاشةُ طفل**: تُقرأ بالعين، **صفرُ نصٍّ منطوقٍ جديد**.

/** مذكّرةُ «لاحقاً» — مستقلّةٌ عن حالة الطفل: قرارُ بالغٍ لا تقدُّمُ رحلة. */
export const CARD_KEY = 'muallim.placement.card.v1';

let hiddenNow = false;      // إخفاءُ هذه الجلسة (وفي المعاينة: لا شيءَ سواه)

export const CARD = {
  install: {
    text: 'ثبّت التطبيق على الجهاز أولاً — ما يتقدّمه طفلك في المتصفّح قد لا ينتقل إلى التطبيق المثبَّت.',
    bar: 'زرُّ التثبيت في الشريط أعلى الشاشة.',
    cta: null,
  },
  exam: {
    text: 'طفلُك يعرف حروفه من مدرسةٍ أو مركز؟ امتحنه أولاً فيبدأ من موضعه لا من الحرف الأول.',
    bar: null,
    cta: { label: 'امتحان اللحاق', hash: '#/parent' },
  },
  later: 'لاحقاً',
};

/**
 * قرارُ العرض **دالّةً نقيّة** (نظيرُ `installState` في `install.js`): ماذا تُري
 * هذا الوالدَ الآن؟ — تُحقَن بحاله فيمتحنها حارسُها بجدول حالاتٍ كامل.
 * @returns {'hidden'|'install'|'exam'}
 */
export function firstRunState({ pristine, dismissed, standalone }) {
  if (!pristine || dismissed) return 'hidden';
  return standalone ? 'exam' : 'install';
}

/** أأُخفيت البطاقةُ بيد وليّ الأمر؟ — يعبر الجوابُ إعادةَ التحميل. */
export function cardDismissed() {
  if (hiddenNow) return true;
  try { return localStorage.getItem(CARD_KEY) === '1'; } catch { return false; }
}

/** «لاحقاً»: تُخفى إلى الأبد. **والمعاينةُ لا تمسّ القرص** — تُخفى لجلستها وحدها. */
export function dismissCard() {
  hiddenNow = true;
  if (progress.PREVIEW) return;
  try { localStorage.setItem(CARD_KEY, '1'); } catch { /* تخزينٌ ممتلئ: تعود مرّةً، ولا تضرّ */ }
}

/** لردّ المذكّرة في الاختبارات. */
export function resetCard() {
  hiddenNow = false;
  try { localStorage.removeItem(CARD_KEY); } catch { /* لا شيء */ }
}

// ————— الشاشة: جلسةُ ملء شاشةٍ بنسق البوابة —————

const groupsText = (n) =>
  arCount(n, ['مجموعةً واحدة', 'مجموعتين', 'مجموعات', 'مجموعةً']);

const nodesText = (n) => arCount(n, ['عقدةً واحدة', 'عقدتين', 'عقد', 'عقدةً']);

/**
 * @param {{onDone: () => void}} opts `onDone` تُنهي الامتحان وتعيد وليَّ الأمر إلى لوحته.
 * @returns {Node|null} `null` إن لم تبق درجةٌ تُمتحَن (فتعرض اللوحةُ نفسَها).
 */
export function renderPlacement({ onDone = () => go('#/') } = {}) {
  const list = rungs();
  let at = startRung(list);
  if (at >= list.length) return null;

  const opened = [];       // معرّفاتُ المجموعات التي فُتحت في هذه الجلسة
  let count = 0;           // كم عقدةً فُتحت فعلاً

  /**
   * **الترويسةُ تتبع الدرجة**: المحرّكُ يرسم `header` مرّةً واحدة عند التركيب ولا
   * يعيده مع كل جلسة — فلو كُتب اسمُ المجموعة فيه نصّاً ساكناً لبقي «المجموعة
   * الأولى» فوق تمارين الثالثة (أمسكه مشهدُ المتصفّح ساعةَ كُتب). فيُملَك السطرُ
   * هنا ويُعاد طلاؤه عند كل صعود — وهذا كلُّ ما تحتاجه الدرجةُ من المحرّك.
   */
  const where = h('p', { class: 'hint' });
  const paintHead = () => {
    where.textContent = `${list[at]?.group?.title || ''} — ${arNum(SAMPLE)} تمارين،`
      + ' وما تجتازه يُفتح لك بدروسه وقصصه.';
  };
  paintHead();
  const head = h('div', { class: 'gate-head' },
    faceEl(icon(FACES.exam), 'gate-face'),
    h('div', {}, h('h2', {}, 'امْتِحَانُ اللَّحَاقْ'), where),
  );

  return renderSession({
    make: () => rungItems(at),
    pill: 'امتحان اللحاق',
    accent: PAUSE_ACCENT,
    leaveAsk: 'تريد إنهاء امتحان اللحاق؟ ما فُتح يبقى مفتوحاً.',
    header: head,
    verdict: ({ rightItems, missedItems, again }) => {
      const rung = list[at];
      const tries = rightItems + missedItems;
      const rate = tries ? Math.round((rightItems / tries) * 100) : 0;
      const open = passed(rightItems, missedItems);

      // **الكتابةُ عند كل درجة لا عند الختام**: مَن أغلق الجهاز في منتصف السلّم
      // يبقى له ما أثبته — والامتحانُ لا يُطالَب بأن يُتَمّ ليُثمر.
      if (open) {
        opened.push(rung.id);
        count += progress.recordPlacement({
          groups: opened,
          nodes: openableNodes(rung),
          stopped: list[at + 1]?.id || null,
          right: rightItems,
          tries,
        });
      } else if (opened.length) {
        progress.recordPlacement({ groups: opened, stopped: rung.id, right: rightItems, tries });
      } else {
        progress.recordPlacement({ stopped: rung.id, right: rightItems, tries });
      }

      // **اسمُ المجموعة في سطر الخبر لا في سطر القراءة**: `.rule` يقرؤه الطفلُ
      // بعينه فيلزمه الشكلُ الكامل، وعناوينُ المنهج عاريةٌ — فمزجُهما يعطيه سطراً
      // نصفُه مشكول. فالعنوانُ هنا مع الأرقام (خبرٌ لوليّ أمره)، والمشكولُ وحدَه ثمّة.
      const score = h('p', { class: 'hint' },
        `${rung.group.title} — أصبتَ ${arNum(rightItems)} من ${arNum(tries)} `
        + `تمريناً (${arNum(rate)}٪)`);
      const tally = count
        ? h('p', { class: 'note' },
          `فُتح لك حتى الآن: ${groupsText(opened.length)} · ${nodesText(count)}.`)
        : null;
      const toMap = h('button', { class: 'btn', onclick: () => { onDone(); go('#/'); } }, '→ الخريطة');

      // **أولُ إخفاقٍ يُنهي**: لا إعادةَ داخل الامتحان — الإعادةُ من اللوحة، وهي
      // تستأنف من آخر حدّ. فلا يدور الطفلُ على درجةٍ واحدة حتى يصيبها بالحظّ.
      if (!open) {
        return h('div', { class: 'celebrate celebrate--again' },
          mascot('mascot mascot--hello'),
          h('div', { class: 'celebrate-face' }, icon(FACES.stop)),
          h('h2', {}, 'وَقَفْنَا هُنَا'),
          h('p', { class: 'rule' }, 'مِنْ هُنَا تَبْدَأُ رِحْلَتُكْ'),
          score,
          tally,
          h('p', { class: 'note' }, 'وهذه بدايتُك لا نهايتُك — الرحلةُ تبدأ من هنا بالضبط.'),
          h('div', { class: 'row foot' }, toMap),
        );
      }

      const more = at + 1 < list.length;
      return h('div', { class: 'celebrate' },
        mascot('mascot mascot--cheer'),
        h('div', { class: 'celebrate-face' }, icon(more ? FACES.step : FACES.done)),
        h('h2', {}, more ? 'أَحْسَنْتْ!' : 'أَتْمَمْتَ السُّلَّمْ!'),
        h('p', { class: 'rule' }, more ? 'فُتِحَتْ لَكْ' : 'فُتِحَ لَكَ السُّلَّمُ كُلُّهْ'),
        score,
        tally,
        h('div', { class: 'row foot' },
          more && h('button', {
            class: 'btn btn--primary',
            onclick: () => { at++; paintHead(); again(); },
          }, `↑ ${list[at + 1].group.title}`),
          more && h('button', { class: 'btn', onclick: onDone }, 'يكفي اليوم'),
          !more && toMap),
      );
    },
  });
}
