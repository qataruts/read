// درس المهارة — العلامات التي تُدرَّس بين المجموعات (METHOD §٥):
// المدّ الطبيعي، السكون، الشدّة، التنوين، اللام الشمسية والقمرية.
//
// بنيته نفس حلقة الدرس (§٤) بثلاث خطوات بدل أربع — لا خطوة تتبّع، فالمرسوم هنا
// علامة لا حرف: ١) القاعدة والأمثلة ٢) قارِن — سماعٌ حرّ ثم قراءةٌ صامتة تُقاس
// ٣) ميّز بأذنك ← نجوم واحتفال.
//
// المفكوكية ١٠٠٪: كل ما يُقرأ هنا (الأزواج والكلمات) من مادة الدرس نفسها، وموضعه
// في الخريطة مختار كي تكون حروفه وعلاماته مدروسة كلها — يفحص ذلك tools/check_decodable.py.
//
// **القياس** (حزمة «قياس العلامات» — الأحمر ٢ من المراجعة الخارجية): كانت هذه الدروس
// **لا تسجّل مهارةً واحدة**، بحجّة أن وحدة §٦ حرفٌ × حركة والمقيس هنا علامة. وثمنُ
// ذلك أن بوابتَي الإتقان ولوحةَ وليّ الأمر عمياوان عن **أصعب أجزاء فكّ الشيفرة**:
// الشدّةُ والتنوينُ والمدُّ واللام الشمسية. والعلاجُ سابقةُ الجذور نفسُها: مفتاحٌ
// لا حرفَ فيه (`mark-<الدرس>` — `curriculum.js`) بعقد ليتنر نفسِه، وقسمٌ مستقلّ في
// اللوحة، وتمرينٌ يراجعه في المراجعة والبوابتين (`markItem` في `review.js`).
//
// و**تمرينان لا واحد**، لأنّ العلامة تُسمَع وتُرى:
//   • `mark-compare` — **قراءةٌ صامتة**: «أيُّهما مَمدود؟» والخياران طرفا الزوج
//     مكتوبين بلا صوت، فالمقيس أن يرى العلامة ويعرف أثرها. وهو عينُ الفجوة التي
//     رصدتها المراجعة: فكُّ الشيفرة لا تمييزُ الصوت.
//   • `mark-quiz` — **تمييزٌ بالأذن**: «أيَّ واحدة سمعت؟» (خطوة الدرس القائمة).
//
// و**صفرُ إضافةٍ صوتية**: أزواجُ المقارنة لها ملفاتها منذ الجلسة ١، ونصّا السؤالين
// نصُّ واجهةٍ معروض لا منطوق — والخطأ يُسمِع ما نقره الطفل من ملفه.

import { markLabel, markSkillKey, skillById, skillExamples } from './curriculum.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
import { starsForReview } from './review.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, starsRow, topbar,
  PAUSE_ACCENT, mascot, shuffle, pick, shake, pop, giantInk, heroStep, DEV,
} from './ui.js';

const ROUNDS = 3;
const OPTIONS = 3;

/**
 * جولات «ميّز بأذنك»: الهدف أحد طرفَي زوج، ومعه الطرف الآخر (وهو ألصق المشتّتات به)
 * ثم نصّ من زوج آخر — كلها من مادة هذا الدرس فلا يظهر ما لم يُدرَّس.
 * تفشل مغلقةً: درس بلا أزواج ⇒ لا خطوة تمييز أصلاً.
 */
export function buildSkillRounds(skill, rnd = Math.random) {
  const pairs = skill?.compare?.pairs || [];
  if (pairs.length < 2) return [];

  const order = shuffle(pairs, rnd);
  const rounds = [];
  for (let i = 0; i < ROUNDS; i++) {
    const pair = order[i % order.length];
    const others = shuffle(pairs.filter((p) => p !== pair), rnd).flat();
    const options = [...pair, ...others].filter((t, k, all) => all.indexOf(t) === k);
    rounds.push({
      target: pick(pair, rnd),
      options: shuffle(options.slice(0, OPTIONS), rnd),
    });
  }
  return rounds;
}

/**
 * جولات «انظر واختر» — القراءة الصامتة للعلامة (حزمة «قياس العلامات»).
 *
 * السؤالُ من `compare.labels` التي يُعلنها الدرس أصلاً («قصير»/«ممدود»…)، والخياران
 * **طرفا الزوج نفسه مكتوبين**: لا فرق بينهما إلا العلامة، فلا يُجاب إلا بقراءتها.
 * ويُسأل عن الطرفين كليهما بالتناوب — فمعرفةُ الخالي من العلامة معرفةٌ بها.
 * تفشل مغلقةً: درسٌ بلا أزواج ⇒ لا جولات (ولا قياسَ يُدَّعى).
 */
export function buildMarkRounds(skill, rnd = Math.random) {
  const pairs = (skill?.compare?.pairs || []).filter((p) => p.length === 2);
  const labels = skill?.compare?.labels || [];
  if (!pairs.length || labels.length < 2) return [];

  const order = shuffle(pairs, rnd);
  const first = rnd() < 0.5 ? 0 : 1;      // أيُّ الطرفين يُسأل عنه أوّلاً
  return order.slice(0, ROUNDS).map((pair, i) => {
    const side = (first + i) % 2;
    return { label: markLabel(labels[side]), target: pair[side], options: shuffle(pair, rnd) };
  });
}

// ————— الشاشة —————

export function renderSkillLesson(skillId) {
  const skill = skillById(skillId);
  if (!skill) return null;

  const nodeId = `skill:${skill.id}`;
  const markKey = markSkillKey(skill.id);
  const examples = skillExamples(skill);
  let rounds = buildSkillRounds(skill);
  let marks = buildMarkRounds(skill);

  audio.preload([skill.rule, ...skill.compare.pairs.flat(), ...examples.map((w) => w.say)]);

  const state = { step: 0, errors: 0, round: 0, mark: 0, done: false };

  const steps = [
    { title: 'القاعدة', build: stepRule },
    { title: 'قارِن', build: stepCompare },
    ...(rounds.length ? [{ title: 'ميّز بأذنك', build: stepQuiz }] : []),
  ];

  /** كل ما يُحكَم فيه في هذا الدرس — به تُقاس النجوم قياساً متناسباً مع طوله. */
  const judged = () => marks.length + rounds.length;

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

  const nextButton = (label = 'تابع ←') =>
    h('button', { class: 'btn btn--primary btn--wide next', onclick: next }, label);

  // ————— ١) القاعدة وأمثلتها —————

  function stepRule() {
    return heroStep([
      mascot('mascot mascot--hello'),
      h('h2', {}, skill.title),
      h('button', {
        class: 'giant',
        'aria-label': `اسمع قاعدة ${skill.title}`,
        onclick: () => audio.play(skill.rule),
      }, giantInk(skill.face)),
    ], [
      h('p', { class: 'rule' }, skill.rule),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--primary',
          onclick: () => audio.play(skill.rule),
        }, icon('ear'), ' اسمع القاعدة'),
      ),
      h('h3', { class: 'sub' }, 'أمثلة'),
      h('div', { class: 'row wordrow' }, examples.map((word) => h('button', {
        class: 'example-word',
        'aria-label': `اسمع كلمة ${word.say}`,
        onclick: () => audio.play(word.say),
      },
        faceEl(word.emoji, 'word-emoji'),
        h('span', { class: 'word-text' }, word.text),
      ))),
      nextButton(),
    ]);
  }

  // ————— ٢) قارِن: سماعٌ حرّ ثم قراءةٌ صامتة تُقاس —————
  //
  // شطران في خطوةٍ واحدة: يسمع الفرق أوّلاً بلا حكم (فالسماع مدخلُ العلامة)، ثم
  // يُسأل عنها **مكتوبةً بلا صوت** — والشطر الثاني هو المقيس (`mark-compare`).

  function stepCompare() {
    const wrap = h('div', {});
    const paintPart = (node) => wrap.replaceChildren(node);

    // (أ) السماع الحرّ: طرفا كل زوج جنباً إلى جنب، النقر يُسمع
    function listenPart() {
      const [left, right] = skill.compare.labels;
      const chip = (text) => h('button', {
        class: 'vchip vchip--pair',
        'aria-label': text,
        onclick: () => audio.play(text),
      }, h('span', { class: 'vchip-face' }, text));

      return h('div', {},
        h('h2', {}, 'قارِن بأذنك'),
        h('p', { class: 'hint' }, 'اضغط الاثنين واسمع الفرق'),
        h('div', { class: 'pairs' },
          h('div', { class: 'pair pair--head' },
            h('small', {}, left),
            h('small', {}, right)),
          ...skill.compare.pairs.map(([a, b]) => h('div', { class: 'pair' }, chip(a), chip(b))),
        ),
        marks.length
          ? h('button', {
            class: 'btn btn--primary btn--wide next',
            onclick: () => { audio.stop(); paintPart(readPart()); },
          }, 'تابع ←')
          : nextButton(),
      );
    }

    // (ب) القراءة الصامتة المقيسة: «أيُّهما ممدود؟» — لا صوت قبل الاختيار، والخطأ
    // يُسمِع ما نقره هو (لا تلقين للصواب — DESIGN §٥.٥).
    function readPart() {
      const prompt = h('h2', {});
      const counter = h('p', { class: 'hint' });
      const row = h('div', { class: 'row vrow' });
      let locked = false;

      function startRound() {
        const r = marks[state.mark];
        locked = false;
        prompt.textContent = `أيُّهما ${r.label}؟`;
        counter.textContent = `الجولة ${arNum(state.mark + 1)} من ${arNum(marks.length)}`;
        row.replaceChildren(...r.options.map((text) => {
          const btn = h('button', {
            class: 'vchip vchip--pair',
            'aria-label': text,
            onclick: () => onPick(text, btn, r),
          }, h('span', { class: 'vchip-face' }, text));
          return btn;
        }));
      }

      function onPick(text, btn, r) {
        if (locked) return;
        const correct = text === r.target;
        progress.recordAttempt(markKey, null, progress.KINDS.MARK_COMPARE, correct);
        if (!correct) {
          state.errors++;
          shake(btn);
          btn.classList.add('bad');
          setTimeout(() => btn.classList.remove('bad'), 700);
          audio.play(text);                     // يسمع ما اختاره فيقارنه بما قرأ
          return;
        }
        locked = true;
        btn.classList.add('good');
        pop(btn);
        audio.play(text);                       // الآن يُنطق ما قرأه: قراءةٌ ثم سماع
        audio.afterSpeech(750, () => {          // «لا انتقالَ وكلامٌ في الجوّ» (بلاغ احسب)
          if (!wrap.isConnected) return;        // غادر الشاشة قبل انقضاء المهلة
          state.mark++;
          if (state.mark < marks.length) startRound();
          else next();
        });
      }

      const screen = h('div', {},
        prompt,
        counter,
        h('p', { class: 'hint' }, 'اقرأ الاثنين — الفرق في العلامة وحدها'),
        row,
      );
      startRound();
      return screen;
    }

    paintPart(listenPart());
    return wrap;
  }

  // ————— ٣) ميّز بأذنك —————

  function stepQuiz() {
    const prompt = h('h2', {});
    const counter = h('p', { class: 'hint' });
    const row = h('div', { class: 'row vrow' });
    let locked = false;

    const playTarget = () => audio.play(rounds[state.round].target);

    function startRound() {
      const r = rounds[state.round];
      locked = false;
      prompt.textContent = 'أيَّ واحدة سمعت؟';
      counter.textContent = `الجولة ${arNum(state.round + 1)} من ${arNum(rounds.length)}`;
      row.replaceChildren(...r.options.map((text) => {
        const btn = h('button', {
          class: 'vchip vchip--pair',
          'aria-label': text,
          onclick: () => onPick(text, btn, r),
        }, h('span', { class: 'vchip-face' }, text));
        return btn;
      }));
      audio.afterSpeech(250, playTarget);   // نداءُ الجولة بعد سكوت ما قبلها
    }

    function onPick(text, btn, r) {
      if (locked) return;
      progress.recordAttempt(markKey, null, progress.KINDS.MARK_QUIZ, text === r.target);
      if (text === r.target) {
        // الصواب لا يُعاد نطقه (DESIGN §٥.٢) — والانتقالُ بعد سكوت القناة والمهلة معاً.
        locked = true;
        btn.classList.add('good');
        pop(btn);
        audio.afterSpeech(750, () => {
          state.round++;
          if (state.round < rounds.length) startRound();
          else finish();
        });
      } else {
        state.errors++;
        shake(btn);
        btn.classList.add('bad');
        setTimeout(() => btn.classList.remove('bad'), 700);
        audio.play(text);                       // يسمع ما اختاره ليقارنه (بلا تلقين)
        audio.afterSpeech(500, playTarget);     // الهدفُ بعد تمام صدى المختار
      }
    }

    const screen = h('div', {},
      prompt,
      counter,
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: playTarget }, icon('ear'), ' اسمع مرة أخرى')),
      row,
    );
    startRound();
    return screen;
  }

  // ————— الختام —————

  // الختام — عتبةٌ **متناسبة مع طول النشاط** (حكمُ محطة «ميّز بين» نفسُه): صار الدرس
  // يُحكَم في جولتَي القراءة والسماع معاً، فحرفيّةُ «خطأ واحد ⇒ نجمتان» تظلمه.

  function finish() {
    audio.stop();
    const stars = starsForReview(state.errors, judged());
    const before = progress.getStars(nodeId);
    progress.setStars(nodeId, stars);

    state.step = steps.length;
    state.done = true;
    paintSteps();

    body.replaceChildren(h('div', { class: 'celebrate' },
      mascot('mascot mascot--cheer'),
      faceEl(skill.face, 'celebrate-face', 'div'),
      h('h2', {}, 'أحسنت!'),
      starsRow(stars, 'big-stars'),
      h('p', { class: 'hint' }, state.errors === 0
        ? cheer(`عرفتَ ${skill.title} بلا خطأ!`)
        : 'صارت في يدك — وستراها في القصص والكلمات بعدها.'),
      before > stars && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => {
            Object.assign(state, { step: 0, errors: 0, round: 0, mark: 0, done: false });
            rounds = buildSkillRounds(skill);
            marks = buildMarkRounds(skill);
            paint();
          },
        }, '↻ أعِد الدرس'),
      ),
    ));
  }

  paint();

  return h('div', { class: 'screen lesson', css: { '--accent': PAUSE_ACCENT } },
    topbar(
      h('button', {
        class: 'btn',
        onclick: () => {
          if (state.step === 0 || state.done || confirm('تريد الخروج قبل إتمام الدرس؟')) go('#/');
        },
      }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, 'مهارة'),
    ),
    h('main', { class: 'screen-card' },
      stepsBar,
      body,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `الأزواج: ${skill.compare.pairs.length} · المقيس: ${judged()}`),
          h('button', { class: 'btn', onclick: () => toast(`أخطاء: ${arNum(state.errors)}`) }, 'عدّ الأخطاء'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء الدرس الآن'),
        )),
    ),
  );
}
