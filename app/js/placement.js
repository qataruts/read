// بوابةُ اللحاق — امتحانُ تحديد المستوى الاختياريّ (ملفّ اللحاق، ١٦ أغسطس ٢٠٢٦).
//
// **الغاية**: تلميذُ مدرسةٍ أو مركزٍ يصل بمستوىً قائم — يمتحن فيُفتح له ما أثبته
// ويقف حيث ينكسر، بدل أن يمشي رحلةَ المبتدئ من الألف. وهو **اختياريّ**: بابُه
// الوحيد قسمٌ في لوحة وليّ الأمر، فلا يراه طفلٌ ولا يقع بنقرةٍ عابرة.
//
// وستُّ قواعد تحكم هذا الملف — وكلُّها قيودُ صدقٍ لا زينة:
//
// ١) **السلّمُ مشتقٌّ لا مكتوب**: درجاتُه مجموعاتُ `journey()` بترتيبها، ومادّةُ كل
//    درجةٍ مفاتيحُ مهارات **عقدها** (درسُ الحرف يكتب `quiz` و`haraka`، ولعبةُ
//    الكلمات تكتب `build` — وهو عينُ ما يعلنه جردُ `test_measure.mjs` لنوعيهما).
//    فمجموعةٌ ثامنة تدخل السلّم يومَ تُضاف، بلا سطرٍ يُعدَّل.
//
// ٢) **صفرُ شكلِ تمرينٍ جديد**: التمارينُ تمارينُ المراجعة/البوابة نفسُها
//    (`buildSession` ثم `renderSession`) — فكلُّ ما تنطقه له ملفٌ مولَّد أصلاً،
//    و**صفرُ إضافةٍ صوتية** بالبناء لا بالوعد.
//
// ٣) **عتبةُ البوابة نفسُها لا رقمٌ ثانٍ**: `passed` من `gate.js` — فلو تحرّكت
//    ثمانون غداً تحرّكتا معاً، ولا يفترق حكمان على شيءٍ واحد.
//
// ٤) **حدودُ الفتح ثلاثة**: عقدُ المجموعة المجتازة وحدَها تُعلَّم (لا ما بينها من
//    درسِ علامةٍ أو قصةٍ أو مواجهة — **لم يُمتحَن فيها فلا تُفتَح عليه**، وهي أصعبُ
//    أجزاء فكّ الشيفرة)؛ و**السلّمُ يقف عند أوّل بوّابة إتقانٍ لم تُجتز** (البواباتُ
//    لا تُقفز — تُجتاز بنفسها)؛ و**المرحلةُ القرآنية خارج السلّم كلياً** (المصحفُ
//    يُتلى لا يُمتحَن — إعفاؤه المكتوب في `test_measure.mjs`).
//
// ٥) **ليتنر يقرأ محاولاته كسائرها**: `renderSession` تكتب كلَّ محاولةٍ بـ
//    `recordAttempt` — لا وسمَ خاصاً ولا استثناء، وقواعدُ الخفوت بحالها.
//    **ولا تُقيَّد مراجعةَ يوم** (`markReview`): هذا امتحانُ تحديدِ موضعٍ لا جلسةُ
//    تثبيت، وعدُّه مراجعةَ اليوم يقول لوليّ الأمر «راجَع» وهو لم يراجع.
//
// ٦) **فتحٌ لا قفل**: لا يُغلق مفتوحٌ أبداً (النجمةُ ترتفع ولا تنخفض — قيدُ
//    `recordPlacement`)، والإعادةُ من اللوحة تستأنف من **آخر حدّ** لا من الألف.

import { HARAKAT, syllableSkill } from './curriculum.js';
import { passed } from './gate.js';
import * as progress from './progress.js';
import { buildSession, renderSession } from './review.js';
import { h, icon, arNum, arCount, faceEl, go, mascot, shuffle, PAUSE_ACCENT } from './ui.js';

/** عيّنةُ الدرجة الواحدة: ستّةُ تمارين — جلسةُ المراجعة اليومية نفسُها طولاً. */
export const SAMPLE = 6;

/**
 * وجوهُ الشاشة — **من أيقونات الواجهة الخطية** لا من رموز البيانات (`ICONS` في
 * `ui.js`، DESIGN §٦): كتبٌ مصفوفةٌ تصعد سلّماً للامتحان، وهديّةُ «فتحِ المجموعة
 * التالية» لمن صعد درجة، ووثبةُ فرحٍ لمن أتمّ السلّم، وابتسامةٌ لمن وقف — وهي
 * وجهُ «لَيْسَ بَعْدُ» في البوابة نفسُه: لا وجهَ عبوسٍ في هذا التطبيق.
 */
const FACES = { exam: 'books', step: 'gift', done: 'party', stop: 'smile' };

// ————— السلّم —————

/**
 * درجاتُ السلّم: مجموعاتُ الرحلة قبل المرحلة القرآنية بترتيبها — **مشتقّةٌ من
 * `journey()` لا مكتوبة**.
 *
 * والحدّان مرسومان هنا لا في موضعٍ آخر، فيُقرآن حيث يعملان:
 *   • **المرحلةُ القرآنية تقطع السلّم** — لا تُمتحَن ولا يُمتحَن ما بعدها.
 *   • **البوّابةُ التي لم تُجتز تقطعه كذلك** — «تُجتاز بنفسها»؛ وإن كان الطفلُ قد
 *     عبَرها بنفسه مضى السلّمُ إلى ما بعدها. فبوّابةٌ تُوضَع بين مجموعتين غداً
 *     تقصُر السلّمَ عندها **يومَ تُوضَع** بلا سطرٍ يُعدَّل.
 */
/**
 * القاعدةُ **دالّةً خالصة** — تُحقَن بأقسام الرحلة وبمن يعرف البوّابةَ المجتازة،
 * فيمتحنها حارسُها بأقسامٍ مصنوعة: بوّابةٌ في وسط المجموعات تقصُر السلّمَ عندها،
 * ومجتازةٌ لا تقصُره، ومرحلةٌ قرآنية تقطعه. ولولا الحقنُ لكان الحدّان **صامتين**
 * (لا بوّابةَ اليومَ بين المجموعتين) — والحدُّ الصامت لا يُعرَف صحيحاً من فاسد.
 */
export function rungsOf(sections, crossed) {
  const out = [];
  for (const section of sections) {
    if (section.kind === 'quran') break;
    if (section.kind === 'gate') {
      if (crossed(section.id)) continue;
      break;
    }
    if (section.kind === 'group') out.push(section);
  }
  return out;
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
  const at = list.findIndex((section) => section.nodes.some((node) => !progress.isDone(node.id)));
  return at < 0 ? list.length : at;
}

/**
 * مفاتيحُ مهارات الدرجة المتمايزة — **من عقدها لا من قائمةٍ تُكتب**: لكل حرفٍ
 * تمييزُه بأذنه (`quiz`) وتمييزُ حركته (`haraka`) بحركاتها الثلاث، ولكل مقطعٍ في
 * كلمات مجموعتها تركيبُه (`build`).
 *
 * ونوعٌ ثالثٌ يدخل عقدَ المجموعة غداً **يُسقِط حارسَه** (`test_placement.mjs` يجرد
 * أنواعَ عقد الدرجات): فلا يمرّ صامتاً بلا مفاتيحَ تُمتحَن.
 */
export function skillKeys(section) {
  const keys = new Map();
  const put = (letter, haraka, kind) => {
    if (!letter) return;
    keys.set(progress.skillKey(letter, haraka, kind), { letter, haraka, kind });
  };
  for (const node of section.nodes) {
    if (node.type === 'letter') {
      for (const k of HARAKAT) {
        put(node.letter, k.key, progress.KINDS.QUIZ);
        put(node.letter, k.key, progress.KINDS.HARAKA);
      }
    } else if (node.type === 'words') {
      for (const word of section.group.words || []) {
        for (const tile of word.tiles || []) {
          const skill = syllableSkill(tile);
          if (skill) put(skill.letter, skill.haraka, progress.KINDS.BUILD);
        }
      }
    }
  }
  return [...keys.values()];
}

/**
 * حصيلةُ الدرجة: حروفُ مجموعتها وما قبلها وكلماتُها — **حوضُ المشتّتات كما يراه
 * الطفلُ في تلك المحطة من الرحلة** (لا حرفٌ لم يبلغه، ولا مجموعتُه وحدها فيلتبس
 * بابُ الاختيار على ثلاثة أحرفٍ متشابهة).
 */
function stock(list, index) {
  const upto = list.slice(0, index + 1);
  return {
    letters: upto.flatMap((section) => section.group.letters),
    words: upto.flatMap((section) => section.group.words),
  };
}

/**
 * تمارينُ درجةٍ واحدة — بمُنشئات المراجعة نفسِها. والمفاتيحُ تُخلَط قبل أن تُعرَض
 * على المُنشئ، فلا تُستظهَر عيّنةٌ ولا تُمتحَن حركةُ الفتحة وحدَها في كل مرة.
 */
export function rungItems(index, rnd = Math.random) {
  const list = rungs();
  const section = list[index];
  if (!section) return [];
  const { letters, words } = stock(list, index);
  return buildSession({
    letters,
    words,
    due: shuffle(skillKeys(section), rnd),
    size: SAMPLE,
    rnd,
  });
}

/**
 * ما يُفتَح باجتياز درجة: عقدُها وحدَها، **ولا بوّابةَ ولا عقدةً قرآنيةً بحال**.
 * والحدُّ مكتوبٌ هنا وإن كانت الدرجةُ اليومَ مجموعةً محضة: هو الذي يبقى صحيحاً
 * حين تتبدّل الرحلة، والحارسُ يقرؤه لا يقرأ حالَ اليوم.
 */
const NEVER_OPENED = new Set(['gate', 'quran', 'prophet']);

export function openableNodes(section) {
  return section.nodes.filter((node) => !NEVER_OPENED.has(node.type)).map((node) => node.id);
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
  const titleOf = (id) => list.find((section) => section.id === id)?.group?.title || id;
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
      + ' وكلُّ مجموعةٍ تُجتاز تُفتح لك.';
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
      const section = list[at];
      const tries = rightItems + missedItems;
      const rate = tries ? Math.round((rightItems / tries) * 100) : 0;
      const open = passed(rightItems, missedItems);

      // **الكتابةُ عند كل درجة لا عند الختام**: مَن أغلق الجهاز في منتصف السلّم
      // يبقى له ما أثبته — والامتحانُ لا يُطالَب بأن يُتَمّ ليُثمر.
      if (open) {
        opened.push(section.id);
        count += progress.recordPlacement({
          groups: opened,
          nodes: openableNodes(section),
          stopped: list[at + 1]?.id || null,
          right: rightItems,
          tries,
        });
      } else if (opened.length) {
        progress.recordPlacement({ groups: opened, stopped: section.id, right: rightItems, tries });
      } else {
        progress.recordPlacement({ stopped: section.id, right: rightItems, tries });
      }

      // **اسمُ المجموعة في سطر الخبر لا في سطر القراءة**: `.rule` يقرؤه الطفلُ
      // بعينه فيلزمه الشكلُ الكامل، وعناوينُ المنهج عاريةٌ — فمزجُهما يعطيه سطراً
      // نصفُه مشكول. فالعنوانُ هنا مع الأرقام (خبرٌ لوليّ أمره)، والمشكولُ وحدَه ثمّة.
      const score = h('p', { class: 'hint' },
        `${section.group.title} — أصبتَ ${arNum(rightItems)} من ${arNum(tries)} `
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
