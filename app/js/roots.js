// شاشة «شجرة الجذر» ولعبة «اجمع العائلة» (حزمة الجذور — ROADMAP §المرحلة ب).
//
// **العلّة**: الوعي الصرفيّ من أقوى روافع القراءة في العربية خاصةً (METHOD §٥.٨)،
// فصرفُها اشتقاقيّ شفّاف: مَن رأى «كَتَبَ» في «كَاتِب» و«مَكْتَب» و«مَكْتَبَة» قرأ
// الجديدَ منها بلا تهجٍّ. ولا يستثمر ذلك أيُّ تطبيق أطفالٍ نعرفه.
//
// خطوتان لا ثلاث:
//   ١) الشجرة — الجذعُ حروفُ الجذر، وسطرُ المعنى يُنقر فيُسمَع، والأغصانُ **ما درسه
//      الطفلُ وحدَه**؛ وكلُّ غصنٍ بطاقةٌ تُسمَع وتتبع الخفوت كسائر البطاقات.
//   ٢) اجمع العائلة — جولاتُ اختيار: أيُّ هذه من عائلة الجذر؟
//
// أربعةُ قيودٍ تحكم هذا الملف:
// ١) **لا يُعرَض غير المدروس أصلاً** — لا قفلٌ مرئيّ ولا إغراء. الشجرةُ تنمو مع
//    الطفل: يعود إليها بعد بستانٍ جديد فيجد غصناً زاد. وما لم يبلغه لا يعلم به.
// ٢) **حوضُ الخيارات ز١ دائماً** — حصانةُ الحوض القائمة (METHOD §٥.٧/ج): لو خفتت
//    كلمةٌ وبقيت أختُها مشكولةً لصار فرقُ التشكيل دليلاً على الجواب. فالأغصان تخفت
//    (`fadeWord`) والخياراتُ تُكتب بنصّها كاملاً — لا `fadeWord` ولا `textWord`
//    (وهي تخفت هي الأخرى)، فحصانةُ الحوض بنيويةٌ لا وصيّة.
// ٣) **صفرُ إضافةٍ صوتية في الأعضاء**: كلماتُ الشجرة كلماتُ المعجم والمنهج بأصواتها
//    القائمة. الجديدُ أسطرُ المعاني الثلاثة عشر وحدَها.
// ٤) **لا صوتَ قبل الاختيار** (DESIGN §٥.٥)، والخطأُ يُسمِع **ما نقره هو** لا الصواب.
//
// و«مشتّتُ الحروف بلا المعنى» (`stranger`) هو أذكى ما في اللعبة: «رُكْبَة» في حوض
// الرُّكوب، و«رَاحَة» في حوض الرِّيح — كلمتان من حروف الجذر نفسِها أسقطتهما قاعدةُ
// العائلة. فمن اختارهما جمع بالحروف، والدرسُ المقصود أن الحروف لا تكفي.

import { memberSay, rootById } from './curriculum.js';
import { fadeWord } from './fade.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
import { steppedScreen, nextButton } from './screens.js';
import {
  h, icon, arNum, arCount, shuffle, shake, PAUSE_ACCENT,
} from './ui.js';

export const ROUNDS = 4;          // أربعُ جولاتٍ: تكفي للمعنى ولا تُطيل الحلقة
export const OPTIONS = 3;

export const nodeIdOf = (rootId) => `roots:${rootId}`;

/** مفتاحُ قياس العائلة في ليتنر — عائلةٌ لا حرف، فيُميَّز بسابقةٍ لا تلتبس بحرف. */
export const skillKeyOf = (rootId) => `root-${rootId}`;

/**
 * أغصانُ الشجرة: أعضاءُ العائلة **التي درسها الطفل فعلاً** بترتيب إعلانها.
 * دالّة خالصة: حصيلةُ الطفل تُحقَن، فتُختبَر في node بلا متصفّح.
 */
export const branchesOf = (root, studied) => {
  const known = new Set(studied);
  return (root?.members || []).filter((m) => known.has(m));
};

/** هل بلغت الشجرةُ حدَّها؟ ثلاثةُ أغصانٍ أدنى ما تُرى به عائلةً لا مصادفة. */
export const MIN_BRANCHES = 3;

/**
 * جولاتُ «اجمع العائلة»: في كل جولة **عضوٌ واحد** من الشجرة ومعه مشتّتان من خارجها.
 * وأوّلُ المشتّتات «الحروفُ بلا المعنى» إن وُجد لهذه العائلة، ثم كلماتٌ من حصيلة
 * الطفل لا تنتمي إليها. تفشل مغلقةً: حوضٌ لا يكفي ⇒ لا جولات.
 */
export function buildRootRounds(root, branches, outsiders, rnd = Math.random) {
  if (branches.length < MIN_BRANCHES) return [];
  const rounds = [];
  const targets = shuffle(branches, rnd).slice(0, ROUNDS);
  for (const [i, target] of targets.entries()) {
    const pool = shuffle(outsiders.filter((w) => w !== target), rnd);
    // المشتّتُ الأذكى يدخل جولةً واحدة على الأقلّ: هو الدرسُ لا زينةُ الحوض
    const smart = root.stranger && (i === 0 || rnd() < 0.5) ? [root.stranger] : [];
    const others = [...smart, ...pool.filter((w) => w !== root.stranger)].slice(0, OPTIONS - 1);
    if (others.length < OPTIONS - 1) continue;
    rounds.push({ target, options: shuffle([target, ...others], rnd) });
  }
  return rounds;
}

/** كلُّ ما قد تنطقه الشاشة — للتحميل المسبق ولفحص تغطية الصوت. */
export const rootScreenTexts = (root, branches) => [root.sense, ...branches.map(memberSay)];

// ————— الشاشة —————

export function renderRoots(rootId) {
  const root = rootById(rootId);
  if (!root) return null;

  const studied = progress.studiedWords().map((w) => w.text || w.read || (w.tiles || []).join(''));
  const branches = branchesOf(root, studied);
  if (branches.length < MIN_BRANCHES) return null;

  // مشتّتاتٌ من حصيلته لا من العدم: كلماتٌ درسها ولا تنتمي إلى هذه العائلة
  const outsiders = [...new Set(studied)].filter((w) => !root.members.includes(w));
  let rounds = buildRootRounds(root, branches, outsiders);

  audio.preload(rootScreenTexts(root, branches).slice(0, 8));

  const steps = [
    { title: 'الشجرة', build: treeStep },
    ...(rounds.length ? [{ title: 'اجمع العائلة', build: gameStep }] : []),
  ];

  // ————— ١) الشجرة —————

  function treeStep({ next }) {
    const trunk = h('div', { class: 'root-trunk' },
      ...[...root.root].map((c) => h('span', { class: 'root-letter' }, c)));

    const senseBtn = h('button', {
      class: 'root-sense',
      'aria-label': `اسمع معنى ${root.title}`,
      onclick: () => audio.play(root.sense),
    }, h('span', { class: 'root-sense-text' }, root.sense));

    const grove = h('div', { class: 'row root-branches' }, branches.map((text) => {
      const face = h('span', { class: 'word-text' });
      const btn = h('button', {
        class: 'root-branch',
        'aria-label': `اسمع كلمة ${text}`,
        onclick: () => { btn.classList.add('good'); audio.play(memberSay(text)); },
      }, face);
      // الغصنُ بطاقةٌ كسائر البطاقات: تخفت بدرجة الكلمة، والنقرةُ تُسمع وتكشف
      fadeWord(face, text, btn);
      return btn;
    }));

    return h('div', {},
      h('h2', {}, `شجرةُ ${root.title}`),
      h('p', { class: 'hint' }, 'هذه كلماتٌ من أسرةٍ واحدة — اضغط كلًّا لتسمعها'),
      trunk,
      senseBtn,
      grove,
      h('p', { class: 'hint root-count' },
        `في شجرتك ${arCount(branches.length, ['غصن', 'غصنان', 'أغصان', 'غصناً'])}`
        + (branches.length < root.members.length ? ' — وتنمو كلما درست أكثر' : '')),
      nextButton(next),
    );
  }

  // ————— ٢) اجمع العائلة —————

  function gameStep({ next, fail }) {
    const state = { round: 0 };
    const wrap = h('div', {});
    const dots = h('ol', { class: 'dots' });
    const body = h('div', {});

    const paintDots = () => dots.replaceChildren(...rounds.map((_r, i) => h('li', {
      class: `dot${i === state.round ? ' dot--now' : ''}${i < state.round ? ' dot--done' : ''}`,
    })));

    function paint() {
      const round = rounds[state.round];
      let answered = false;

      const opts = h('div', { class: 'row root-options' }, round.options.map((text) => {
        // **حوضُ الخيارات ز١ دائماً**: النصُّ كاملُ الشكل يُكتب مباشرةً، ولا يمرّ
        // بـ`fadeWord` ولا بـ`textWord` (وهي تخفت هي الأخرى) — فرقُ التشكيل بين
        // الخيارات يفضح الجواب، فيجيب الطفل بعدّ الحركات لا بالقراءة.
        const btn = h('button', {
          class: 'root-option',
          'aria-label': `اختر ${text}`,
          onclick: () => choose(text, btn),
        }, text);
        return btn;
      }));

      function choose(text, btn) {
        if (answered) return;
        const correct = text === round.target;
        progress.recordAttempt(skillKeyOf(root.id), null, progress.KINDS.ROOT, correct);

        if (!correct) {
          fail();
          shake(btn);
          btn.classList.add('bad');
          audio.play(memberSay(text));   // يُسمِعه ما نقره هو — لا تلقينَ للصواب
          setTimeout(() => btn.classList.remove('bad'), 700);
          return;
        }
        answered = true;
        btn.classList.add('good');
        audio.play(memberSay(text));
        audio.afterSpeech(500, () => {          // بعد تمام الصدى لا فوقه (بلاغ احسب)
          if (!wrap.isConnected) return;
          if (state.round < rounds.length - 1) { state.round++; paint(); } else next();
        });
      }

      paintDots();
      body.replaceChildren(
        h('h2', {}, 'اجمع العائلة'),
        h('p', { class: 'hint' },
          `أيُّ كلمةٍ من شجرة ${root.title}؟ (${root.sense})`),
        h('div', { class: 'root-trunk root-trunk--small' },
          ...[...root.root].map((c) => h('span', { class: 'root-letter' }, c))),
        opts,
      );
    }

    paint();
    wrap.append(dots, body);
    return wrap;
  }

  return steppedScreen({
    nodeId: nodeIdOf(root.id),
    className: 'roots',
    accent: PAUSE_ACCENT,
    pill: 'شجرة الجذر',
    face: icon('roots'),
    steps,
    celebrate: ({ errors }) => ({
      stars: errors === 0 ? 3 : errors <= 2 ? 2 : 1,
      line: `عرفتَ عائلةَ ${root.title} — ${arNum(branches.length)} كلماتٍ من أصلٍ واحد`,
    }),
  });
}
