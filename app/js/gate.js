// بوابة الإتقان (الحزمة ١٤ · قرار المالك على `PEDAGOGY_AUDIT.md` و٤):
// جلسة مراجعة **إجبارية** تقف قبل المفصلين الكبيرين — قبل المرحلة القرآنية وقبل
// البساتين — فلا يعبر الطفل إليهما بحروف هشّة لمجرّد أنه «أتمّ» ما قبلهما.
//
// أربع قواعد تحكم هذا الملف:
// ١) **مادّتها أضعف ما في يده** لا ما حان موعده: `progress.weakestSkills()` بدل
//    `dueSkills()` — البوابة سؤالٌ عن الإتقان، وليتنر جدولُ تثبيتٍ لا امتحان.
// ٢) **لا محتوى جديداً ولا نصّ منطوق جديد**: تمارينها تمارينُ المراجعة نفسُها
//    (`buildSession` في review.js)، فكل ما تنطقه له ملفٌ مولَّد أصلاً.
// ٣) **لا رسوب**: دون العتبة لا نجمة ولا عبور، لكن لا عقاب ولا حدّ للمحاولات —
//    «لَيْسَ بَعْدُ» ثم إعادةٌ فورية تُبنى تمارينها من جديد (لا نمط يُحفَظ فيُستظهَر).
// ٤) **الحكم بالمحاولة لا بالتمرين**: نسبة الإصابة = الصواب ÷ كل اللمسات، وهي
//    وحدةُ `markReview` نفسُها في لوحة وليّ الأمر — فلا يفترق ما يقرؤه الوالد عمّا
//    فتح البوابة أو أبقاها.

import { gateById } from './curriculum.js';
import * as progress from './progress.js';
import { buildSession, renderSession, starsForReview, studiedPairs } from './review.js';
import { h, go, arNum, starsRow, mascot, PAUSE_ACCENT } from './ui.js';

export const GATE_SIZE = 10;      // عشرة تمارين: أطول من مراجعة اليوم ودون إرهاق
export const PASS_RATE = 0.8;     // العبور بإصابة ≥٨٠٪ من المحاولات

/** هل تعبر هذه النتيجة البوابة؟ (بلا محاولة أصلاً لا عبور — لئلا تُفتح بجلسة فارغة) */
export const passed = (right, errors) =>
  right + errors > 0 && right / (right + errors) >= PASS_RATE;

/** تمارين محاولةٍ واحدة: الأضعف أولاً من سجلّ ليتنر، ثم تنويعٌ من حصيلته يكمل العدد. */
export function gateItems(rnd = Math.random) {
  const letters = progress.studiedLetters();
  const words = progress.studiedWords(letters);
  const sentences = progress.studiedSentences().filter((s) => s.mechanic === 'order');
  return buildSession({
    letters, words, sentences,
    pairs: studiedPairs(letters),
    due: progress.weakestSkills(),
    size: GATE_SIZE,
    rnd,
  });
}

export function renderGate(gateId) {
  const gate = gateById(gateId);
  if (!gate) return null;
  const nodeId = `gate:${gate.id}`;

  return renderSession({
    make: gateItems,
    pill: 'بوابة',
    accent: PAUSE_ACCENT,
    leaveAsk: 'تريد الخروج قبل إتمام البوابة؟',
    header: h('div', { class: 'gate-head' },
      h('span', { class: 'gate-face', 'aria-hidden': 'true' }, gate.face),
      h('div', {},
        h('h2', {}, gate.title),
        h('p', { class: 'hint' }, gate.hint),
      ),
    ),
    verdict: ({ right, errors, items, again }) => {
      const tries = right + errors;
      const rate = tries ? Math.round((right / tries) * 100) : 0;
      const open = passed(right, errors);
      progress.markReview(tries, right);           // البوابة مراجعةٌ كسائر المراجعات
      if (open) progress.setStars(nodeId, starsForReview(errors, items.length));

      const score = h('p', { class: 'hint' },
        `أصبتَ ${arNum(right)} من ${arNum(tries)} محاولة (${arNum(rate)}٪)`);

      // العبور: احتفال ونجوم. ودونه: «ليس بعدُ» — لا لفظ رسوب ولا حدّ للإعادة.
      return open
        ? h('div', { class: 'celebrate' },
          mascot('mascot mascot--cheer'),
          h('div', { class: 'celebrate-face' }, gate.face),
          h('h2', {}, 'فُتِحَتِ البَوَّابَة!'),
          starsRow(starsForReview(errors, items.length), 'big-stars'),
          score,
          h('div', { class: 'row foot' },
            h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة')),
        )
        : h('div', { class: 'celebrate celebrate--again' },
          mascot('mascot mascot--hello'),
          h('div', { class: 'celebrate-face' }, '🙂'),
          h('h2', {}, 'لَيْسَ بَعْدُ'),
          h('p', { class: 'rule' }, 'قَوِّ حُرُوفَكْ أَوَّلاً'),
          score,
          h('p', { class: 'note' }, 'أعِد المحاولة متى شئت — بتمارين جديدة في كل مرة.'),
          h('div', { class: 'row foot' },
            h('button', { class: 'btn btn--primary', onclick: again }, '↻ أعِد المحاولة'),
            h('button', { class: 'btn', onclick: () => go('#/') }, '→ الخريطة')),
        );
    },
  });
}
