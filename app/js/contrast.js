// محطة «ميّز بين» — مواجهة المتشابهات بعد فصلها (الحزمة ١٣ · الفجوة و١ من PEDAGOGY_AUDIT).
//
// المنهج يُباعد بين ت/ط وس/ص وك/ق… في مجموعات متفرّقة (METHOD §٢.٥) كي لا يلتبسا وهما
// يُتعلَّمان. والفصل نصفُ العلاج: علوم القراءة توصي بعده بمواجهةٍ **مقصودة** — يُجمع
// الحرفان في تمرينٍ لا فرق فيه إلا هما، فيتعلّم الطفل الفرقَ نفسَه لا يتجنّبه.
//
// خطوتان لا ثلاث: (١) قارِن — طرفا كل زوج جنباً إلى جنب بحركةٍ واحدة، النقر يُسمع؛
// (٢) أيَّ حرف سمعت؟ — جولتان لكل زوج، الخياران هما الزوج نفسُه **بحركة متطابقة**،
// فلا يُفرَّق بينهما إلا بالحرف. لا خطوة قاعدةٍ هنا: لا قاعدة تُقال، والفرق يُسمع لا يُشرح.
//
// ثلاثة قيود تحكم هذا الملف:
// ١) **صفرُ إضافةٍ صوتية**: كل ما ينطق حرفٌ بحركة، وله ملفٌ مولَّد منذ الجلسة الأولى.
// ٢) **القياس يدخل ليتنر** بنوع `contrast` — والزوج مشتقٌّ من الحرف (كل حرفٍ يُعلن
//    المنهجُ أزواجَه)، فيبقى مفتاح المهارة على شكله: حرف × حركة × تمرين، ولا تكذب
//    لوحةُ وليّ الأمر التي تجمع بالحرف. ولهذا التمرين نظيرُه في جلسة المراجعة
//    (`contrastItem` في review.js) — فلا مهارةَ تُقاس بلا تمرينٍ يراجعها.
// ٣) **«اسمع الفرق»**: الخطأ هنا يُسمع المختارَ ثم الهدفَ متعاقبين بفاصل — استثناءٌ
//    معلَن من قاعدة «لا تلقين للصواب» (DESIGN §٥.٥)، مسوّغه أن جوهر التمرين هو
//    السماع المقارن نفسُه.

import { HARAKAT, LETTERS, contrastById } from './curriculum.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
import { starsForReview, compareSounds } from './review.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, starsRow, topbar, letterTitle,
  PAUSE_ACCENT, mascot, shuffle, shake, pop, DEV,
} from './ui.js';

/**
 * **جولةٌ لكل مفتاحٍ تعلنه المحطة** (حكمُ المدير على جدول تغطية الجلسة ع٢: «تغطيةٌ تامّة
 * بلا تضييق»): المحطةُ تُعلن في `placement.skillKeys` كلَّ حرفٍ من أزواجها × الحركات
 * الثلاث، فصار لكلِّ مفتاحٍ منها جولتُه. وكان القائمُ **جولتين لكل زوج** بحركتين
 * مقترَعتين وحرفٍ مقترَع — فبقي **٣٣ مفتاحاً يُفتَح ولا يُقاس** في الرحلة كلِّها
 * (حارسُ الوعد، سورُه الأوّل)، وامتحنت بوابةُ اللحاق ما لا تقيسه محطتُه.
 */
export const ROUNDS_PER_LETTER = HARAKAT.length;

/**
 * جولات المحطة: **لكل حرفٍ ثلاثُ جولاتٍ بحركاته الثلاث** لا اقتراعَ فيها، ثم تُخلط
 * الجولات كلها فتتداخل الأزواج — التداخل يمنع الإجابة بالإيقاع، واختلافُ الحركة على
 * الحرف الواحد يمنع حفظَ الجواب بنغمةٍ واحدة. والخيارات حروف الزوج نفسها **بحركةٍ
 * واحدة**: التمييز على الحرف وحده.
 *
 * **وحرفٌ في زوجين يواجههما كليهما** (`ح` في «هـ/ح» و«ع/ح»): مفتاحُه واحدٌ لا يتكرّر
 * — فجولاتُه ثلاثٌ لا ستّ — وأزواجُه تتناوبها، فلا يُحرَم مواجهةً لأنّ أخرى سبقتها.
 * تفشل مغلقةً: محطةٌ بلا أزواج ⇒ لا جولات.
 */
export function buildContrastRounds(contrast, rnd = Math.random) {
  const pairsOf = new Map();          // حرف ← أزواجُه في هذه المحطة بترتيب إعلانها
  for (const pair of contrast?.pairs || []) {
    if (pair.letters.length < 2) continue;
    for (const letter of pair.letters) {
      if (!pairsOf.has(letter)) pairsOf.set(letter, []);
      pairsOf.get(letter).push(pair);
    }
  }

  const rounds = [];
  for (const [letter, own] of pairsOf) {
    for (const [i, k] of HARAKAT.entries()) {
      const pair = own[i % own.length];
      rounds.push({
        pair: pair.id,
        letter,
        haraka: k.key,
        mark: k.mark,
        options: shuffle(pair.letters, rnd),
      });
    }
  }
  return shuffle(rounds, rnd);
}

/** نصوص المحطة كلها (للتحميل المسبق ولفحص تغطية الصوت). */
export const contrastRoundTexts = (contrast) =>
  [...new Set((contrast?.pairs || []).flatMap((p) =>
    p.letters.flatMap((c) => HARAKAT.map((k) => c + k.mark))))];

// ————— الشاشة —————

export function renderContrast(contrastId) {
  const contrast = contrastById(contrastId);
  if (!contrast) return null;

  const nodeId = `contrast:${contrast.id}`;
  let rounds = buildContrastRounds(contrast);
  if (!rounds.length) return null;

  audio.preload(contrastRoundTexts(contrast).slice(0, 12));

  const state = { step: 0, errors: 0, round: 0, done: false };

  const steps = [
    { title: 'قارِن', build: stepCompare },
    { title: 'ميّز بأذنك', build: stepQuiz },
  ];

  const stepsBar = h('ol', { class: 'steps' });
  const body = h('div', { class: 'lesson-body' });

  function paintSteps() {
    stepsBar.replaceChildren(...steps.map((s, i) => h('li', {
      class: `step${i === state.step ? ' step--now' : ''}${i < state.step ? ' step--done' : ''}`,
    },
      h('span', { class: 'step-dot' }, i < state.step ? '✓' : arNum(i + 1)),
      h('span', { class: 'step-name' }, s.title),
    )));
  }

  function paint() {
    audio.stop();
    paintSteps();
    body.replaceChildren(steps[state.step].build());
  }

  function next() {
    if (state.step < steps.length - 1) {
      state.step++;
      paint();
    } else {
      finish();
    }
  }

  // ————— ١) قارِن: طرفا كل زوج بحركةٍ واحدة —————

  function stepCompare() {
    const chip = (letter) => {
      const text = letter + HARAKAT[0].mark;
      return h('button', {
        class: 'vchip vchip--pair',
        'aria-label': `${letterTitle(letter)} بالفتحة`,
        onclick: () => audio.play(text),
      },
        h('span', { class: 'vchip-face' }, text),
        h('small', {}, LETTERS[letter]?.name ?? letter),
      );
    };

    return h('div', {},
      h('h2', {}, 'قارِن بأذنك'),
      h('p', { class: 'hint' }, 'اضغط كل حرف واسمع الفرق بينهما'),
      h('div', { class: 'pairs pairs--grid' },
        contrast.pairs.map((pair) => h('div', { class: 'pair' }, pair.letters.map(chip))),
      ),
      h('button', { class: 'btn btn--primary btn--wide next', onclick: next }, 'تابع ←'),
    );
  }

  // ————— ٢) أيَّ حرف سمعت؟ —————

  function stepQuiz() {
    const counter = h('p', { class: 'hint' });
    const row = h('div', { class: 'row vrow' });
    let locked = false;

    const target = () => rounds[state.round].letter + rounds[state.round].mark;
    const playTarget = () => audio.play(target());

    function startRound() {
      const r = rounds[state.round];
      locked = false;
      counter.textContent = `الجولة ${arNum(state.round + 1)} من ${arNum(rounds.length)}`;
      row.replaceChildren(...r.options.map((letter) => {
        const text = letter + r.mark;
        const btn = h('button', {
          class: 'vchip vchip--big',
          'aria-label': text,
          onclick: () => onPick(letter, text, btn, r),
        }, h('span', { class: 'vchip-face' }, text));
        return btn;
      }));
      audio.afterSpeech(250, playTarget);   // نداءُ الجولة بعد سكوت ما قبلها
    }

    function onPick(letter, text, btn, r) {
      if (locked) return;
      const correct = letter === r.letter;
      progress.recordAttempt(r.letter, r.haraka, progress.KINDS.CONTRAST, correct);
      if (correct) {
        // الصواب لا يُعاد نطقه (DESIGN §٥.٢) — والانتقالُ بعد سكوت القناة والمهلة معاً:
        // تتابعُ «اسمع الفرق» ثانيتان، وكان سياجُ ٧٥٠ الثابت يقطشه (قياسُ --voice)
        locked = true;
        btn.classList.add('good');
        pop(btn);
        audio.afterSpeech(750, () => {
          state.round++;
          if (state.round < rounds.length) startRound();
          else finish();
        });
        return;
      }
      state.errors++;
      shake(btn);
      btn.classList.add('bad');
      setTimeout(() => btn.classList.remove('bad'), 700);
      compareSounds(text, r.letter + r.mark);   // «اسمع الفرق»: المختار ثم الهدف
    }

    const screen = h('div', {},
      h('h2', {}, 'أيَّ حرف سمعت؟'),
      counter,
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: playTarget }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
    startRound();
    return screen;
  }

  // ————— الختام —————
  // عتبةٌ متناسبة مع طول النشاط (المُقَرّ في الجلسة ٣): ٣ بلا خطأ، ٢ ما دام الخطأ
  // ≤ عدد الجولات — والجولات هنا ست أو ثمان، فحرفيّةُ «خطأ واحد ⇒ نجمتان» تظلمه.

  function finish() {
    audio.stop();
    const stars = starsForReview(state.errors, rounds.length);
    const before = progress.getStars(nodeId);
    progress.setStars(nodeId, stars);

    state.step = steps.length;
    state.done = true;
    paintSteps();

    body.replaceChildren(h('div', { class: 'celebrate' },
      mascot('mascot mascot--cheer'),
      faceEl(contrast.face, 'celebrate-face', 'div'),
      h('h2', {}, 'أحسنت!'),
      starsRow(stars, 'big-stars'),
      h('p', { class: 'hint' }, state.errors === 0
        ? cheer('ميّزتَ بينها كلها بلا خطأ!')
        : 'صار الفرق في أذنك — وستلقاه في المراجعة.'),
      before > stars && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => {
            Object.assign(state, { step: 0, errors: 0, round: 0, done: false });
            rounds = buildContrastRounds(contrast);
            paint();
          },
        }, '↻ أعِد المحطة'),
      ),
    ));
  }

  paint();

  return h('div', { class: 'screen lesson', css: { '--accent': PAUSE_ACCENT } },
    topbar(
      h('button', {
        class: 'btn',
        onclick: () => {
          if (state.step === 0 || state.done || confirm('تريد الخروج قبل إتمام المحطة؟')) go('#/');
        },
      }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, 'ميّز بين'),
    ),
    h('main', { class: 'screen-card' },
      h('div', { class: 'contrast-head' },
        faceEl(contrast.face, 'contrast-face'),
        h('div', {},
          h('h2', {}, contrast.title),
          h('p', { class: 'hint' }, contrast.hint),
        ),
      ),
      stepsBar,
      body,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `الأزواج: ${contrast.pairs.length} · الجولات: ${rounds.length}`),
          h('button', { class: 'btn', onclick: () => toast(`أخطاء: ${arNum(state.errors)}`) }, 'عدّ الأخطاء'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء المحطة الآن'),
        )),
    ),
  );
}
