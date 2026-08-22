// درس الحرف — حلقة الدرس في §٤ من المنهج، بأربع خطوات متتابعة:
//   ١) اسمع وشاهد  ٢) الحركات  ٣) تتبّع  ٤) ميّز بأذنك  ← نجوم وعودة للخريطة.
//
// المفكوكية ١٠٠٪: كل حرف يظهر في هذه الشاشة (خياراتٍ كان أو كلمةَ مثال) مأخوذ من
// lettersThrough(group, letter) — أي المدروس فعلاً حتى هذا الدرس، لا حتى نهاية المجموعة.

import {
  LETTERS, HARAKAT, HARAKA_BY_MARK, harakaText, letterForms, lettersThrough, exampleWordFor,
} from './curriculum.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
import { mayPrompt } from './support.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, starsRow, topbar, letterTitle, wordText,
  accentFor, mascot, shuffle, pick, shake, pop, giantInk, heroStep, DEV,
} from './ui.js';

// **جولتا «ميّز بأذنك»** (حكمُ المدير على جدول تغطية الجلسة ع٢): سقفُ §٤ خمسُ جولاتٍ
// بتسعيرة حارس الوعد (زيارةٌ ١ + ١٠ بطاقاتٍ ١٫٥ + ٠٫٥ للجولة)، وخطوةُ الحركات تأخذ
// ثلاثاً — فبقيت اثنتان. وثمنُها مدفوعٌ في الجرد: مفتاحُ هذا التمرين **الفتحةُ وحدَها**.
const ROUNDS = 2;              // جولات «ميّز بأذنك»
const OPTIONS = 3;             // خيارات كل جولة
const FATHA = HARAKAT[0].mark; // الفتحة أولاً (§٥.١)

/** النجوم من الأخطاء: ٣ بلا خطأ، ٢ بخطأ واحد، ١ بأكثر. */
export const starsForErrors = (errors) => (errors === 0 ? 3 : errors === 1 ? 2 : 1);

/**
 * **تلميحُ أوّل لقاء** (وضعُ الدعم — الجلسة د٢، حكمُ الدراسة ٣/أ): هل يُبرَز الصحيحُ
 * **قبل** المحاولة في هذه الجولة؟ — إن أذن المخزنُ وكان صندوقُ ليتنر صفراً: أوّلُ
 * لقاءٍ بهذه المهارة (أو عودتُها إليه بعد خطأ)، وما ارتفع صندوقُه فقد جاوز الاكتساب.
 *
 * **وثمنُه مدفوعٌ في مكانه**: كلُّ محاولةٍ تقع والتلميحُ معروضٌ تُسجَّل **معانة**
 * فلا ترفع صندوقاً ولا تنقصه — والقاعدةُ في `progress.js` لا في هذه الشاشة، وهذا
 * عرضُها وحدَه. ودالّةٌ واحدة لخطوتَي الدرس: لا شرطَ يُكتب مرّتين فيفترقا.
 */
const promptFor = (letter, haraka, kind) =>
  mayPrompt(progress.getSkill(progress.skillKey(letter, haraka, kind))?.box ?? 0);

/**
 * جولات «ميّز بأذنك»: الهدف وكل المشتّتات من الحروف المدروسة فقط، **وبالفتحة كلُّها**.
 *
 * **والحركةُ هنا مركبٌ لا مقيس** (حكمُ المدير في بوابة تصميم ع٢): خيارات الجولة حروفٌ
 * بحركةٍ **واحدة متطابقة** فلا يُفرَّق بينها إلا بالحرف — فهذا التمرين يقيس تمييزَ
 * الحرف بالأذن، وبُعدُ الحركة تملكه خطوةُ الحركات بمفاتيحها الثلاثة. ولذلك صار المُعلَن
 * في `placement.skillKeys` **الفتحةَ وحدَها** لهذا النوع، وكان ثلاثاً فيُفتَح ما لا
 * يُقاس (٢٩ مفتاحاً في سور حارس الوعد الأوّل) وتمتحن بوابةُ اللحاق ما لا تدرّسه محطتُه.
 *
 * **ومفاتيحُها مضمونةٌ في كل تشغيل** (نمطُ `placement.stationKeys`): الجولةُ الأولى على
 * حرف الدرس — مفتاحُه المُعلَن — والثانيةُ **مراجعةٌ لحرفٍ سبقه** لا اقتراعٌ من الحوض
 * كلِّه، وبها يُقاس مفتاحُ أوّلِ حروف الرحلة في درس ثانيها (لا جولةَ في درسه هو: حرفٌ
 * واحدٌ مدروس لا مشتّتَ له).
 *
 * تعود [] إن لم يكن للطفل حرفان مدروسان بعدُ (أول درس في الرحلة) فتُطوى الخطوة.
 */
export function buildRounds(studied, letter, rnd = Math.random) {
  const pool = [...new Set(studied)];
  if (pool.length < 2) return [];
  const size = Math.min(OPTIONS, pool.length);
  const earlier = pool.filter((c) => c !== letter);

  const targets = [letter, pick(earlier, rnd)].slice(0, ROUNDS);
  return targets.map((target) => {
    const others = shuffle(pool.filter((c) => c !== target), rnd).slice(0, size - 1);
    return { target, mark: FATHA, options: shuffle([target, ...others], rnd) };
  });
}

/**
 * أسئلةُ خطوة الحركات بترتيبها: **الفتحةُ أولاً ثم الأخريان مقترَعتَي الترتيب**
 * (الحكم ج٨، جلسة وز٣ — تنفيذُ نصّ METHOD §٥.١ «الفتحة أولاً، ثم الكسرة والضمة»).
 *
 * وكان الفرعُ «ثم عشوائية» **شيفرةً ميتة**: `ask()` تُنادى مرّةً واحدة ثم يصير الذيلُ
 * زرَّ «تابع»، فلا يُسأل الطفلُ إلا عن الفتحة — و**٥٦ مفتاحاً** (٢٨ حرفاً × كسرةٍ
 * وضمّة) تُفتَح في الجرد ولا يقيسها أحدٌ في الرحلة كلِّها، وبوابةُ اللحاق تمتحن بها.
 * فصار السؤالُ ثلاثةً و**الحركاتُ الثلاث مضمونةٌ في كل تشغيل** لا واحدةً تُقترَع
 * (حكمُ المدير على تسليم ع١: «مفاتيحُ الحركات تُقاس في درسها — لا تضييقَ للجرد هنا»).
 *
 * دالّةٌ نقيّة: `items` بترتيب HARAKAT (الفتحة أولها).
 */
export const harakaRounds = (items, rnd = Math.random) =>
  [items[0], ...shuffle(items.slice(1), rnd)];

/** تقطيع نص مشكول إلى «حرف + حركاته» لتلوين الحرف المستهدف داخل الكلمة. */
export function clusters(text) {
  const out = [];
  for (const ch of text) {
    if (out.length && /[ً-ْٰ]/.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

// ————— الشاشة —————

export function renderLesson(groupId, letter) {
  const group = progress.findGroup(groupId);
  if (!group) return null;

  const name = LETTERS[letter]?.name ?? letter;
  const studied = lettersThrough(groupId, letter);
  const example = exampleWordFor(groupId, letter);
  let rounds = buildRounds(studied, letter);   // تُبنى من جديد عند إعادة الدرس (تنويع المراجعة)

  audio.preload([
    name,
    ...HARAKAT.map((k) => harakaText(letter, k.mark)),
    ...rounds.flatMap((r) => r.options.map((c) => harakaText(c, r.mark))),
    ...(example ? [example.say] : []),
  ]);

  const state = { step: 0, errors: 0, round: 0, done: false };

  const steps = [
    { title: 'اسمع وشاهد', build: stepListen },
    { title: 'الحركات', build: stepHarakat },
    { title: 'تتبّع', build: stepTrace },
    ...(rounds.length ? [{ title: 'ميّز بأذنك', build: stepQuiz }] : []),
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

  /** زر «تابع» أسفل الخطوة — لا يظهر في خطوة سؤال إلا بعد الإجابة الصحيحة. */
  function nextButton(label = 'تابع ←') {
    return h('button', { class: 'btn btn--primary btn--wide next', onclick: next }, label);
  }

  // ————— ١) اسمع وشاهد —————

  function stepListen() {
    const forms = letterForms(letter);
    const sound = harakaText(letter, FATHA);   // رسمُ الصوت ومفتاحُه (الألفُ «أَ» — الحكم ب٩)
    const cell = (label, text) => h('div', { class: 'form-cell' },
      h('span', { class: 'form-face' }, text),
      h('small', {}, label));

    return heroStep([
      mascot('mascot mascot--hello'),
      h('h2', {}, letterTitle(letter)),
      h('button', {
        class: 'giant',
        'aria-label': `اسمع صوت ${letterTitle(letter)}`,
        onclick: () => audio.play(sound),
      }, giantInk(letter)),
    ], [
      h('div', { class: 'row' },
        h('button', {
          class: 'btn',
          'aria-label': `اسمع اسم الحرف: ${name}`,
          onclick: () => audio.play(name),
        }, icon('ear'), ` اسمه: ${name}`),
        h('button', {
          class: 'btn btn--primary',
          'aria-label': `اسمع صوت الحرف: ${sound}`,
          onclick: () => audio.play(sound),
        }, icon('ear'), ` صوته: ${sound}`),
      ),
      h('h3', { class: 'sub' }, 'أشكاله في الكلمة'),
      h('div', { class: 'forms' },
        cell('منفرد', forms.isolated),
        cell('في أوله', forms.initial),
        cell('في وسطه', forms.medial),
        cell('في آخره', forms.final),
      ),
      example && h('div', { class: 'example' },
        h('button', {
          class: 'example-word',
          'aria-label': `اسمع كلمة ${example.say}`,
          onclick: () => audio.play(example.say),
        },
          faceEl(example.emoji, 'word-emoji'),
          h('span', { class: 'word-text' },
            clusters(wordText(example)).map((piece) => (piece[0] === letter
              ? h('span', { class: 'lit' }, piece)
              : piece))),
        ),
        h('p', { class: 'hint' }, 'اضغط الكلمة لتسمعها'),
      ),
      nextButton(),
    ]);
  }

  // ————— ٢) الحركات: استماع ثم «أيها سمعت؟» —————

  function stepHarakat() {
    // البطاقاتُ بترتيب HARAKAT: الفتحة أولاً (§٥.١)، ورسمُها `harakaText` — فبطاقاتُ
    // الألف «أَ إِ أُ» لا «اَ اِ اُ» (الحكم ب٩).
    const items = HARAKAT.map((k) => ({ ...k, text: harakaText(letter, k.mark) }));
    const order = harakaRounds(items);   // الفتحةُ أولاً ثم الأخريان — والثلاثُ مضمونة
    let target = null;
    let solved = false;
    let asked = 0;
    let hinted = false;      // أُبرِز الصحيحُ في هذه الجولة؟ ⇒ محاولاتُها معانة

    const prompt = h('p', { class: 'hint' }, 'اضغط كلَّ واحدة لتسمعها');
    const foot = h('div', { class: 'row foot' });

    const cards = items.map((item) => {
      const btn = h('button', {
        class: 'vchip',
        'aria-label': `${letter} بال${item.name}`,
        onclick: () => onPick(item, btn),
      },
        h('span', { class: 'vchip-face' }, item.text),
        h('small', {}, item.name));
      return btn;
    });

    function onPick(item, btn) {
      if (!target || solved) {          // وضع الاستماع الحر (لا يُقاس)
        audio.play(item.text);
        return;
      }
      // القياس على مستوى (حرف × حركة × تمرين) — METHOD §٦، والمعانُ يُسجَّل ولا يُرقّي
      progress.recordAttempt(letter, target.key, progress.KINDS.HARAKA,
        item.text === target.text, progress.dayNumber(), hinted);
      if (item.text === target.text) {
        // لا إعادة قراءةٍ للصواب (DESIGN §٥.٢): أثرٌ بصريّ وتقدُّم — والصوت الذي سمعه
        // كافٍ، وإعادته هنا تصطدم بنداءٍ لاحق فتلتبس على الطفل.
        solved = true;
        btn.classList.add('good');
        pop(btn);
        prompt.textContent = `أحسنت! هذه ${target.name} ✓`;
        // **الانتقالُ بقاعدة «لا انتقالَ وكلامٌ في الجوّ»** (بلاغ احسب): سكوتُ القناة
        // ومهلةُ العين معاً — فإن سبق الطفلُ بالإجابة والصوتُ في الجو لم يُقطَش سؤالُه
        // بنداء السؤال التالي. وذيلُ الخطوة يبقى كما هو في المهلة («أعِد السماع» بيده،
        // ونقرتُه تمدّ السياج) ثم يستبدله `ask` — فلا يومض فراغٌ ولا تزحزح الشاشةُ.
        if (asked < order.length) audio.afterSpeech(750, ask);
        else foot.replaceChildren(nextButton());
      } else {
        state.errors++;
        shake(btn);
        btn.classList.add('bad');
        setTimeout(() => btn.classList.remove('bad'), 700);
        prompt.textContent = 'ليست هي… استمع مرة أخرى';
        audio.afterSpeech(450, () => audio.play(target.text));
      }
    }

    function ask() {
      target = order[asked];                 // الفتحةُ أولاً ثم الأخريان (الحكم ج٨)
      asked++;
      solved = false;
      for (const c of cards) c.classList.remove('good', 'bad', 'prompted');
      hinted = promptFor(letter, target.key, progress.KINDS.HARAKA);
      if (hinted) cards[items.indexOf(target)]?.classList.add('prompted');
      // عدّادُ الأسئلة في النصّ نفسِه لا في سطرٍ جديد: لا عنصرَ يُضاف فتزحزح الشاشة
      prompt.textContent = `اضغط ما سمعت — ${arNum(asked)} من ${arNum(order.length)}`;
      audio.play(target.text);
      foot.replaceChildren(h('button', {
        class: 'btn',
        onclick: () => audio.play(target.text),
      }, icon('ear'), ' أعِد السماع'));
    }

    foot.append(h('button', { class: 'btn btn--primary btn--wide', onclick: ask }, icon('headphones'), ' أيها سمعت؟'));

    return h('div', {},
      h('h2', {}, `${letterTitle(letter)} مع الحركات`),
      prompt,
      h('div', { class: 'row vrow' }, cards),
      foot,
    );
  }

  // ————— ٣) تتبّع بالإصبع (بلا تحقّق من المسار في هذه الجلسة) —————

  function stepTrace() {
    const canvas = h('canvas', {
      class: 'trace',
      role: 'img',
      'aria-label': `تتبّع ${letterTitle(letter)} بإصبعك`,
    });
    const ctx = canvas.getContext('2d');
    let box = { width: 0, height: 0 };

    function guide() {
      ctx.clearRect(0, 0, box.width, box.height);
      const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#317873';
      const font = getComputedStyle(document.body).getPropertyValue('--font-letter').trim();
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(box.height * 0.72)}px ${font || 'serif'}`;
      ctx.textAlign = 'center';
      // مركز الحبر في مركز اللوح لا خطُّ الأساس (كتوسيط الحرف البطل في `ui.js`):
      // `middle` تجلس الحرف على منتصف مربّع الخطّ، فتهبط الباء بنقطتها تحت المنتصف.
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(letter);
      const mid = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      ctx.fillText(letter, box.width / 2, box.height / 2 + (Number.isFinite(mid) ? mid : 0));
      ctx.restore();
    }

    function size() {
      if (!canvas.isConnected) {          // استُبدلت الشاشة: أزِل المستمع ولا تعمل شيئاً
        window.removeEventListener('resize', size);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      box = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = Math.max(10, rect.width * 0.055);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      guide();
    }

    let drawing = false;
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* مؤشّر غير نشط */ }
      const p = at(e);
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#317873';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y);   // نقطة واحدة تُرى ولو لم يتحرّك الإصبع
      ctx.stroke();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = at(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      canvas.addEventListener(type, () => { drawing = false; });
    }

    function at(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    requestAnimationFrame(size);
    window.addEventListener('resize', size);   // تُزال مع استبدال الشاشة (الرسم يُعاد بناؤه)

    return h('div', {},
      h('h2', {}, 'تتبّع بإصبعك'),
      h('p', { class: 'hint' }, `ارسم ${letterTitle(letter)} فوق النموذج الباهت`),
      canvas,
      h('div', { class: 'row foot' },
        h('button', { class: 'btn', onclick: guide }, '↺ امسح'),
        nextButton('تمّ ←'),
      ),
    );
  }

  // ————— ٤) ميّز بأذنك —————

  function stepQuiz() {
    const prompt = h('h2', {});
    const counter = h('p', { class: 'hint' });
    const row = h('div', { class: 'row vrow' });
    let locked = false;
    let hinted = false;      // أُبرِز الصحيحُ في هذه الجولة؟ ⇒ محاولاتُها معانة

    const playTarget = () => audio.play(harakaText(rounds[state.round].target, rounds[state.round].mark));

    function startRound() {
      const r = rounds[state.round];
      locked = false;
      hinted = promptFor(r.target, HARAKA_BY_MARK[r.mark], progress.KINDS.QUIZ);
      prompt.textContent = 'أيَّ حرف سمعت؟';
      counter.textContent = `الجولة ${arNum(state.round + 1)} من ${arNum(rounds.length)}`;
      row.replaceChildren(...r.options.map((ch) => {
        const text = harakaText(ch, r.mark);
        const btn = h('button', {
          class: `vchip vchip--big${hinted && ch === r.target ? ' prompted' : ''}`,
          'aria-label': text,
          onclick: () => onPick(ch, btn, r),
        }, h('span', { class: 'vchip-face' }, text));
        return btn;
      }));
      audio.afterSpeech(250, playTarget);   // نداءُ الجولة بعد سكوت ما قبلها
    }

    function onPick(ch, btn, r) {
      if (locked) return;
      progress.recordAttempt(r.target, HARAKA_BY_MARK[r.mark], progress.KINDS.QUIZ,
        ch === r.target, progress.dayNumber(), hinted);
      if (ch === r.target) {
        // الصواب لا يُعاد نطقه (DESIGN §٥.٢). والانتقالُ بقاعدة «لا انتقالَ وكلامٌ
        // في الجوّ» (بلاغ احسب): سكوتُ القناة والمهلةُ معاً — فطفلٌ سريعٌ أجاب
        // والسؤالُ في الجو لا يُقطَش سؤالُه بنداء الجولة التالية.
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
        audio.afterSpeech(450, playTarget);   // الإعادة بعد تمام ما في الجو
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

  // ————— الختام: النجوم والاحتفال —————

  function finish() {
    audio.stop();
    const stars = starsForErrors(state.errors);
    const before = progress.getStars(progress.nodeId(groupId, letter));
    progress.setStars(progress.nodeId(groupId, letter), stars);

    state.step = steps.length;   // كل الخطوات مُنجزة
    state.done = true;
    paintSteps();

    const line = state.errors === 0 ? cheer('بلا خطأ واحد!')
      : state.errors === 1 ? 'خطأ واحد فقط — ممتاز!'
        : 'أتممتَ الدرس، وبالتكرار تزيد نجومك.';

    body.replaceChildren(h('div', { class: 'celebrate' },
      mascot('mascot mascot--cheer'),
      h('div', { class: 'celebrate-face' }, letter),
      h('h2', {}, 'أحسنت!'),
      starsRow(stars, 'big-stars'),
      h('p', { class: 'hint' }, line),
      before > stars && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => {
            Object.assign(state, { step: 0, errors: 0, round: 0, done: false });
            rounds = buildRounds(studied, letter);
            paint();
          },
        }, '↻ أعِد الدرس'),
      ),
    ));
  }

  paint();

  return h('div', { class: 'screen lesson', css: { '--accent': accentFor(group) } },
    topbar(
      h('button', {
        class: 'btn',
        // الخروج من منتصف الدرس يُستأذَن فيه (وليّ الأمر)، أما قبل بدئه أو بعد إتمامه فلا
        onclick: () => {
          if (state.step === 0 || state.done || confirm('تريد الخروج قبل إتمام الدرس؟')) go('#/');
        },
      }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, group.title),
    ),
    h('main', { class: 'screen-card' },
      stepsBar,
      body,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `المدروس: ${studied.join(' ')}`),
          h('button', { class: 'btn', onclick: () => { toast(`أخطاء: ${arNum(state.errors)}`); } }, 'عدّ الأخطاء'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء الدرس الآن'),
        )),
    ),
  );
}
