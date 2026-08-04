// المرحلة القرآنية — خاتمة الرحلة (METHOD §١.٢ و§٥.٦).
//
// خمس شاشات على خمس درجات: حرفان جديدان ← كلمات قرآنية مألوفة ← رسم المصحف ←
// الحروف المقطَّعة ← السور الأربع بالرسم العثماني.
//
// **قاعدة هذا الملف الأولى**: نصّ المصحف **لا يُولَّد آلياً**. لا تمرّ آيةٌ ولا كلمةٌ
// عثمانية على `audio.play()` أبداً — فاحتياطُه النطق الآلي بالمتصفّح، وكلاهما محرَّم
// على كلام الله (METHOD §٥.٦). تلاوتُه من `recitation.js` وحدها: تسجيلُ قارئ متقن
// جُلب مرةً واحدة (الحصري المرتّل)، وإن غاب ملفُه صمتت الآيةُ ولم يَنُبْ عنها مولّد.
// وما يمرّ على `audio.play()` هنا ثلاثة أصناف لا رابع لها: قواعدُنا نحن، وكلماتٌ
// بالرسم الإملائي، وأسماءُ حروف.
//
// **الثانية**: لا قياس (كما في دروس المهارات) — المقيس في §٦ حرفٌ بحركة في تمرين،
// والمقيس هنا علامةُ رسم أو كلمة كاملة، فلا يُبنى منه تكرارٌ متباعد لا تمرين له.

import {
  QURAN, SURAH_WORDS_FACE, surahById, surahWords, surahWordsPart, surahOfWordsPart,
  quranWordLevel,
} from './curriculum.js';
import * as progress from './progress.js';
import * as audio from './audio.js';
import * as recitation from './recitation.js';
import { starsForGame } from './words.js';
import { starsForStory } from './story.js';
import { steppedScreen, readQuizStep, nextButton } from './screens.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, arCount, starsRow, topbar,
  QURAN_ACCENT, shuffle, shake, giantInk, heroStep, DEV,
} from './ui.js';

const QUIZ_OPTIONS = 3;
const RASM_ROUNDS = 3;
const AFTER_PICK_MS = 750;
const FIND_ROUNDS = 6;      // جولات «جِدْها في الآية» في محطة كلمات السورة

const nodeIdOf = (part) => `quran:${part}`;

/** جولات رسم المصحف: كلمة عثمانية معروضة، وأيّ علامةٍ فيها؟ (بصريّ صامت). */
export function buildRasmRounds(signs, rnd = Math.random) {
  if (signs.length < QUIZ_OPTIONS) return [];
  return shuffle(signs, rnd).slice(0, RASM_ROUNDS).map((target) => {
    const others = shuffle(signs.filter((s) => s.sign !== target.sign), rnd);
    return { target, options: shuffle([target, ...others.slice(0, QUIZ_OPTIONS - 1)], rnd) };
  });
}

/** شاشة درجةٍ من المرحلة القرآنية: الهيكل المشترك بلونها ومعرّف عقدتها. */
const stepped = ({ part, pill, face, steps, celebrate }) => steppedScreen({
  nodeId: nodeIdOf(part), className: 'quran', accent: QURAN_ACCENT, pill, face, steps, celebrate,
});

const ruleHead = (title, face, rule) => [heroStep([
  h('h2', {}, title),
  h('button', {
    class: 'giant',
    'aria-label': `اسمع: ${rule}`,
    onclick: () => audio.play(rule),
  }, giantInk(face)),
], [
  h('p', { class: 'rule' }, rule),
  h('div', { class: 'row' },
    h('button', { class: 'btn btn--primary', onclick: () => audio.play(rule) }, icon('ear'), ' اسمع القاعدة')),
])];

/** كلمة إملائية تُنطق بنقرة (لا شيء من المصحف يمرّ من هنا). */
const spokenWord = (word) => h('button', {
  class: 'example-word',
  'aria-label': `اسمع كلمة ${word.read}`,
  onclick: () => audio.play(word.read),
},
  faceEl(word.emoji, 'word-emoji'),
  h('span', { class: 'word-text' }, word.read),
);

// ————— ١) الهمزة والتاء المربوطة —————

function renderQuranLetters() {
  const data = QURAN.letters;
  const words = data.signs.flatMap((s) => s.words);

  return stepped({
    part: data.id,
    pill: 'حروف',
    face: data.face,
    steps: [
      {
        title: 'الحرفان',
        build: ({ next }) => h('div', {},
          ...ruleHead(data.title, data.face, data.rule),
          ...data.signs.map((sign) => h('section', { class: 'sign-card' },
            h('div', { class: 'sign-head' },
              h('span', { class: 'sign-face' }, sign.sign),
              h('div', {},
                h('h3', {}, sign.name),
                h('p', { class: 'sign-shapes' }, sign.shapes.map((sh) =>
                  h('span', { class: 'sign-shape' }, sh))),
              ),
            ),
            h('div', { class: 'row wordrow' }, sign.words.map(spokenWord)),
          )),
          nextButton(next),
        ),
      },
      { title: 'اقرأ واختر', build: (api) => readQuizStep(words, api) },
    ],
    celebrate: (state) => ({
      stars: starsForGame(state.errors, words.length),
      line: state.errors === 0
        ? cheer('قرأتَ الهمزة والتاء المربوطة بلا خطأ!')
        : 'صارتا في يدك — وستلقاهما في المصحف كثيراً.',
    }),
  });
}

// ————— ٢) كلمات من القرآن — ثلاث درجات (الحزمة ١٢) —————

function renderQuranWords(level) {
  const items = level.items;

  return stepped({
    part: level.id,
    pill: 'كلمات',
    face: level.face,
    steps: [
      {
        title: 'الكلمات',
        build: ({ next }) => h('div', {},
          ...ruleHead(level.title, level.face, QURAN.words.rule),
          h('div', { class: 'row wordrow' }, items.map(spokenWord)),
          nextButton(next),
        ),
      },
      { title: 'اقرأ واختر', build: (api) => readQuizStep(items, api) },
    ],
    celebrate: (state) => ({
      stars: starsForGame(state.errors, items.length),
      line: state.errors === 0
        ? cheer('قرأتَ كلمات القرآن كلها بلا خطأ!')
        : 'أحسنت — هذه الكلمات ستراها في المصحف كثيراً.',
    }),
  });
}

// ————— ٣) رسم المصحف —————

function renderQuranRasm() {
  const data = QURAN.rasm;

  return stepped({
    part: data.id,
    pill: 'رسم',
    face: data.face,
    steps: [
      {
        title: 'العلامات',
        build: ({ next }) => h('div', {},
          ...ruleHead(data.title, data.face, data.rule),
          h('div', { class: 'rasm-list' }, data.signs.map((sign) => h('button', {
            class: 'rasm-card',
            'aria-label': `${sign.name}: ${sign.rule}`,
            onclick: () => audio.play(sign.rule),      // القاعدة كلامنا، والمثال يبقى صامتاً
          },
            h('span', { class: 'rasm-sign' }, sign.sign),
            h('span', { class: 'rasm-text' },
              h('b', {}, sign.name),
              h('small', {}, sign.rule),
              h('span', { class: 'rasm-example' },
                h('span', { class: 'mushaf' }, sign.read),
                h('small', {}, `من سورة ${sign.from}`)),
            ),
          ))),
          h('p', { class: 'note' }, 'الكلمات هنا من المصحف — نقرؤها بأعيننا، وتلاوتها بصوت قارئ متقن.'),
          nextButton(next),
        ),
      },
      {
        title: 'ميّز العلامة',
        build: ({ next, fail }) => {
          const rounds = buildRasmRounds(data.signs);
          if (!rounds.length) {
            setTimeout(next, 0);
            return h('p', { class: 'hint' }, '…');
          }
          let index = 0;
          let locked = false;

          const word = h('p', { class: 'mushaf mushaf--big' });
          const counter = h('p', { class: 'hint' });
          const row = h('div', { class: 'row vrow' });

          function startRound() {
            const r = rounds[index];
            locked = false;
            word.textContent = r.target.read;
            counter.textContent = `الجولة ${arNum(index + 1)} من ${arNum(rounds.length)}`;
            row.replaceChildren(...r.options.map((sign) => {
              const btn = h('button', {
                class: 'vchip vchip--sign',
                'aria-label': sign.name,
                onclick: () => onPick(sign, btn, r),
              },
                h('span', { class: 'vchip-face' }, sign.sign),
                h('small', {}, sign.name),
              );
              return btn;
            }));
          }

          function onPick(sign, btn, r) {
            if (locked) return;
            if (sign.sign === r.target.sign) {
              locked = true;
              btn.classList.add('good');
              setTimeout(() => {
                index++;
                if (index < rounds.length) startRound();
                else next();
              }, AFTER_PICK_MS);
            } else {
              fail();
              shake(btn);
              btn.classList.add('bad');
              setTimeout(() => btn.classList.remove('bad'), 700);
              audio.play(sign.rule);      // يسمع قاعدة ما اختاره فيعرف لِمَ لم تكن هي
            }
          }

          const screen = h('div', {},
            h('h2', {}, 'أيّ علامة في هذه الكلمة؟'),
            word,
            counter,
            row,
          );
          startRound();
          return screen;
        },
      },
    ],
    celebrate: (state) => ({
      stars: starsForGame(state.errors, RASM_ROUNDS),
      line: state.errors === 0
        ? cheer('عرفتَ علامات المصحف بلا خطأ!')
        : 'صارت مألوفة لعينك — وستراها في كل صفحة.',
    }),
  });
}

// ————— ٤) الحروف المقطَّعة —————

function renderQuranMuqattaat() {
  const data = QURAN.muqattaat;
  const heard = new Set();

  return stepped({
    part: data.id,
    pill: 'مقطَّعة',
    face: data.face,
    steps: [
      {
        title: 'اقرأ بأسمائها',
        build: ({ next }) => {
          heard.clear();          // إعادة الدرس تبدأ العدّ من جديد
          const foot = h('p', { class: 'hint' });
          const paintFoot = () => {
            foot.textContent = `قرأتَ ${arNum(heard.size)} من `
              + arCount(data.items.length, ['واحدة', 'اثنتين', 'مجموعات', 'مجموعة']);
          };

          const list = h('div', { class: 'muq-list' }, data.items.map((item) => {
            const said = new Set();
            const chips = item.parts.map((p, i) => {
              const btn = h('button', {
                class: 'vchip vchip--name',
                'aria-label': `اسم الحرف ${p.say}`,
                onclick: () => {
                  btn.classList.add('good');
                  said.add(i);
                  if (said.size === item.parts.length) {
                    heard.add(item.read);
                    paintFoot();
                  }
                  audio.play(p.say);
                },
              }, h('span', { class: 'vchip-face' }, p.say));
              return btn;
            });

            return h('section', { class: 'muq-card' },
              h('div', { class: 'muq-head' },
                h('span', { class: 'mushaf mushaf--big' }, item.read),
                h('small', {}, `أول سورة ${item.surah}`),
              ),
              h('div', { class: 'row vrow' }, chips),
            );
          }));

          paintFoot();
          return h('div', {},
            ...ruleHead(data.title, data.face, data.rule),
            h('p', { class: 'hint' }, 'اضغط أسماء الحروف واقرأ بها'),
            list,
            foot,
            nextButton(next, 'أتممتُ ←'),
          );
        },
      },
    ],
    celebrate: () => ({
      stars: starsForStory(heard.size, data.items.length),
      line: heard.size >= data.items.length
        ? cheer('قرأتَ الحروف المقطَّعة بأسمائها كلها!')
        : 'أعِد واقرأ كل مجموعة بأسماء حروفها لتزيد نجومك.',
    }),
  });
}

// ————— ٥) كلمات السورة — «لا سورة قبل كلماتها» (الحزمة ١٢ «الجسر القرآني») —————
//
// **علّةُ المحطة**: كانت الرحلة تعبر من ثمانِ كلماتٍ إملائية إلى الفاتحة رأساً —
// خلافاً للنورانية، فهي تُكثر تدريباتِ الكلمات قبل التلاوة. فصار لكل سورةٍ محطةٌ
// قبلها: كلماتُها **بالرسم العثماني من نصّ آياتها نفسِه** (لا تُكتب بيد أحد —
// `surahWords` تشقّها عند الفراغ)، تُقرأ بطاقاتٍ تُسمَع كلمةً-كلمة بصوت قارئ، ثم
// جولاتُ «جِدْها في الآية»: يقرأ الكلمة ويمسح الآية حتى يجدها.
//
// **والحكم على القراءة قبل السماع** (عقد `readQuizStep` نفسُه — DESIGN §٥.٢):
// لا صوتَ قبل الاختيار، والخطأ يُسمعه **ما نقره هو** بتلاوة القارئ فيقارن، ولا
// يُلقَّن الصواب. وكلُّ ما يُسمع هنا من `recitation.js` وحدها: نصّ مصحفٍ لا يُولَّد
// صوتُه ولا يُنطق آلياً (METHOD §٥.٦) — وإن لم تُجلب تلاوةُ كلمةٍ بعدُ فصمتٌ.

/**
 * جولات «جِدْها في الآية»: أهدافٌ من كلمات السورة، **موزَّعةٌ على آياتها** ما أمكن
 * (لا ثلاثُ جولاتٍ من آيةٍ واحدة والطفلُ قد حفظ موضعَها).
 */
export function buildFindRounds(words, rounds = FIND_ROUNDS, rnd = Math.random) {
  const pool = shuffle(words, rnd);
  const out = [];
  let used = new Set();
  while (out.length < Math.min(rounds, pool.length)) {
    const fresh = pool.find((w) => !out.includes(w) && !used.has(w.ayah));
    const pick = fresh || pool.find((w) => !out.includes(w));
    if (!pick) break;
    if (!fresh) used = new Set();          // دارت الآيات كلها: نبدأ دورةً جديدة
    used.add(pick.ayah);
    out.push(pick);
  }
  return out;
}

function renderSurahWords(surahId) {
  const surah = surahById(surahId);
  if (!surah) return null;
  const words = surahWords(surah);
  const heard = new Set();

  // نسبةُ التلاوة إلى صاحبها — **قارئُ الكلمة وحده** لا قارئُ الآية: هما مصدران
  // مختلفان قد يختلف قارئاهما، ونسبةُ تلاوةٍ إلى غير صاحبها كذبٌ على الطفل ووليّه.
  // فما لم يُجلب بيانُ الكلمات بعدُ يبقى السطر عاماً بلا اسم (والكلماتُ صامتة).
  const credit = h('p', { class: 'note' }, 'اضغط الكلمة لتسمعها بصوت قارئ متقن.');
  recitation.ready().then(() => {
    const name = recitation.wordReciter();
    if (name) credit.textContent = `الكلمات بصوت ${name}. اضغط الكلمة لتسمعها.`;
    recitation.prefetch(words.map((w) => w.text));
  });

  return stepped({
    part: surahWordsPart(surah.id),
    pill: 'كلمات السورة',
    face: SURAH_WORDS_FACE,
    steps: [
      {
        title: 'كلماتها',
        build: ({ next }) => {
          heard.clear();                   // إعادةُ المحطة تبدأ العدّ من جديد
          const foot = h('p', { class: 'hint' });
          const paintFoot = () => {
            foot.textContent = `سمعتَ ${arNum(heard.size)} من `
              + arCount(words.length, ['كلمة', 'كلمتين', 'كلمات', 'كلمة']);
          };

          const grid = h('div', { class: 'sw-grid' }, words.map((word) => {
            const btn = h('button', {
              class: 'vchip vchip--mushaf',
              'aria-label': `اسمع كلمة ${word.text}`,
              onclick: () => {
                btn.classList.add('good');
                heard.add(word.text);
                paintFoot();
                recitation.play(word.text);
              },
            }, h('span', { class: 'vchip-face mushaf' }, word.text));
            return btn;
          }));

          paintFoot();
          return h('div', {},
            heroStep([
              h('h2', {}, `كلمات سورة ${surah.name}`),
              // زخرفةٌ صامتة لا زرّ: لا قاعدةَ منطوقة في هذه المحطة (صفر نصّ مولَّد)
              h('span', { class: 'giant', 'aria-hidden': 'true' }, giantInk(SURAH_WORDS_FACE)),
            ], [
              h('p', { class: 'rule' },
                'اقرأ كلمات السورة كلمةً كلمة، ثم اقرأ السورة كلها — كما يفعل معلّم القرآن.'),
            ]),
            grid,
            foot,
            credit,
            nextButton(next),
          );
        },
      },
      {
        title: 'جِدْها في الآية',
        build: ({ next, fail }) => {
          const rounds = buildFindRounds(words);
          if (!rounds.length) {
            setTimeout(next, 0);
            return h('p', { class: 'hint' }, '…');
          }
          let index = 0;
          let locked = false;

          const target = h('p', { class: 'mushaf mushaf--big sw-target' });
          const counter = h('p', { class: 'hint' });
          const line = h('div', { class: 'sw-ayah' });

          function startRound() {
            const r = rounds[index];
            locked = false;
            target.textContent = r.text;
            counter.textContent = `الجولة ${arNum(index + 1)} من ${arNum(rounds.length)}`;
            // الآيةُ كاملةً بكلماتها أزراراً — نصُّها حرفيّ، والتقطيعُ عرضٌ لا تعديل
            line.replaceChildren(...surah.ayat[r.ayah - 1].split(' ').map((text) => {
              const btn = h('button', {
                class: 'sw-word mushaf',
                'aria-label': text,
                onclick: () => onPick(text, btn, r),
              }, text);
              return btn;
            }));
          }

          function onPick(text, btn, r) {
            if (locked) return;
            if (text === r.text) {         // الكلمة قد تتكرّر في الآية — وكلُّ موضعٍ لها صواب
              locked = true;
              btn.classList.add('good');
              setTimeout(() => {
                index++;
                if (index < rounds.length) startRound();
                else next();
              }, AFTER_PICK_MS);
            } else {
              fail();
              shake(btn);
              btn.classList.add('bad');
              setTimeout(() => btn.classList.remove('bad'), 700);
              recitation.play(text);       // يسمع ما اختاره هو فيقارنه (بلا تلقين)
            }
          }

          const screen = h('div', {},
            h('h2', {}, 'جِدْ هذه الكلمة في الآية'),
            target,
            counter,
            line,
            h('p', { class: 'hint' }, `من سورة ${surah.name}`),
          );
          startRound();
          return screen;
        },
      },
    ],
    celebrate: (state) => ({
      stars: starsForGame(state.errors, Math.min(FIND_ROUNDS, words.length)),
      line: state.errors === 0
        ? cheer(`صارت كلمات سورة ${surah.name} في يدك — اقرأها الآن!`)
        : 'أعِد النظر في الكلمات، ثم اقرأ السورة على مهل.',
    }),
  });
}

// ————— ٦) شاشة السورة: قراءة بالعين، وتلاوةٌ بصوت قارئ —————

const LISTEN = '◀';       // مثلث تشغيل هندسيّ (لا إيموجي في شاشات السور — DESIGN §٦)
const HALT = '■';

export function renderSurah(surahId) {
  const surah = surahById(surahId);
  if (!surah) return null;

  const nodeId = nodeIdOf(surah.id);
  const total = surah.ayat.length;
  const read = new Set();
  let done = false;

  // سطور الصفحة بترتيبها: البسملة سطراً مستقلاً في السور الثلاث ثم الآيات.
  // هي نفسها ترتيب التلاوة، فموضع ما يُتلى موضعُه في الصفحة بلا حساب ثانٍ.
  const lines = [...(surah.basmalaIsAyah ? [] : [QURAN.basmala]), ...surah.ayat];
  const rows = [];          // عنصر كل سطر (لتعليم ما يُتلى الآن)
  let listenBtn = null;
  let playingIndex = -1;
  let listenRun = 0;        // رقم تسلسل «اسمع السورة» الجاري (يُبطل تعليمَ ما أوقفه)

  const body = h('div', { class: 'story-body' });
  const foot = h('div', { class: 'row foot' });

  function paintFoot() {
    foot.replaceChildren(
      h('p', { class: 'hint' },
        `قرأتَ ${arNum(read.size)} من ${arCount(total, ['آية', 'آيتين', 'آيات', 'آية'])}`),
      h('button', { class: 'btn btn--primary btn--wide next', onclick: finish }, 'أتممتُ القراءة ←'),
    );
  }

  function markRead(index) {
    if (read.has(index) || done) return;
    read.add(index);
    paintFoot();
  }

  // ——— التلاوة: من ملف قارئ متقن وحده، ولا يمسّ نجومَ القراءة بالعين ———

  /** تعليم السطر الذي يُتلى الآن (-1 = لا تلاوة) وإتباع الطفل موضعَه. */
  function markPlaying(index) {
    playingIndex = index;
    rows.forEach((row, i) => {
      row.classList.toggle('ayah-row--playing', i === index);
      row.querySelector('.ayah-listen').textContent = i === index ? HALT : LISTEN;
    });
    if (index >= 0) rows[index]?.scrollIntoView?.({ block: 'nearest' });
    if (listenBtn) {
      const on = index >= 0;
      listenBtn.textContent = on ? `${HALT} أوقف التلاوة` : `${LISTEN} اسمع السورة`;
      listenBtn.classList.toggle('btn--primary', !on);
    }
  }

  const halt = () => { recitation.stop(); markPlaying(-1); };

  /** تلاوة سطرٍ واحد — والضغط عليه وهو يُتلى يوقفه. */
  async function reciteLine(index) {
    if (playingIndex === index) return halt();
    markPlaying(index);
    await recitation.play(lines[index]);
    if (playingIndex === index) markPlaying(-1);
  }

  /** «اسمع السورة»: البسملة ثم الآيات بالتتابع، بجلبٍ مسبق فلا تنقطع بينها. */
  async function reciteAll() {
    if (playingIndex >= 0) return halt();
    const mine = ++listenRun;
    await recitation.playSequence(lines, (_text, index) => markPlaying(index));
    if (mine === listenRun) markPlaying(-1);
  }

  /** سطرٌ من الصفحة: نصّه (يُضغط للقراءة) وزرّ تلاوته. */
  function line(index, textEl, label) {
    const listen = h('button', {
      class: 'ayah-listen',
      'aria-label': `اسمع ${label} بصوت القارئ`,
      onclick: () => reciteLine(index),
    }, LISTEN);
    const row = h('div', { class: 'ayah-row' }, textEl, listen);
    rows[index] = row;
    return row;
  }

  function page() {
    // لا إيموجي داخل شاشات السور (DESIGN §٦) — الزخرفة ذهبيّ مطفأ من CSS
    const sheet = h('div', { class: 'sheet sheet--mushaf' },
      h('div', { class: 'surah-title' },
        h('span', { class: 'surah-title-text' }, `سورة ${surah.name}`),
        h('span', { class: 'pill' }, `${arNum(surah.number)}`),
      ),
    );

    rows.length = 0;
    // البسملة سطرٌ مستقلّ في السور الثلاث، وهي الآية الأولى في الفاتحة وحدها
    if (!surah.basmalaIsAyah) {
      sheet.append(line(0, h('p', { class: 'mushaf basmala' }, QURAN.basmala), 'البسملة'));
    }

    surah.ayat.forEach((ayah, index) => {
      const at = index + (surah.basmalaIsAyah ? 0 : 1);   // موضع الآية من سطور الصفحة
      const btn = h('button', {
        class: 'ayah',
        'aria-label': `الآية ${arNum(index + 1)}`,
        onclick: () => {
          btn.classList.add('ayah--read');
          markRead(index);
        },
      },
        h('span', { class: 'mushaf' }, ayah),
        h('span', { class: 'ayah-num' }, arNum(index + 1)),
      );
      sheet.append(line(at, btn, `الآية ${arNum(index + 1)}`));
    });

    return sheet;
  }

  function paint() {
    audio.stop();
    recitation.stop();
    playingIndex = -1;
    listenBtn = h('button', {
      class: 'btn btn--primary btn--wide listen-all',
      onclick: reciteAll,
    }, `${LISTEN} اسمع السورة`);

    body.replaceChildren(
      h('div', { class: 'row listen-row' }, listenBtn),
      page(),
    );
    paintFoot();
    // تلاواتُ الصفحة كلها مسبقاً (كما تفعل القصة بأصواتها) — فأول نقرةٍ فوريّة
    recitation.ready().then(() => recitation.prefetch(lines));
  }

  function finish() {
    halt();
    done = true;
    const stars = starsForStory(read.size, total);
    const before = progress.getStars(nodeId);
    progress.setStars(nodeId, stars);
    const last = !progress.nextNode();

    body.replaceChildren(h('div', { class: 'celebrate' },
      h('div', { class: 'celebrate-face' }, '۞'),
      h('h2', {}, `قرأتَ سورة ${surah.name}!`),
      starsRow(stars, 'big-stars'),
      h('p', { class: 'hint' }, stars === 3
        ? 'قرأتَ آياتها كلها — بارك الله فيك'
        : 'أعِد القراءة على مهل، آيةً آية.'),
      before > stars && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      last && h('p', { class: 'note' }, 'أتممتَ الرحلة كلها — من الحرف الأول إلى المصحف.'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => { done = false; read.clear(); paint(); },
        }, '↻ أعِد القراءة'),
      ),
    ));
    foot.replaceChildren();
  }

  paint();

  // اسم القارئ يُذكر حين يُقرأ بيانُه — أمانةُ نسبةِ التلاوة إلى صاحبها
  const credit = h('p', { class: 'note' },
    'التلاوة بصوت قارئ متقن. استمع واتبعْ بعينك، ثم اقرأها بنفسك.');
  recitation.ready().then(() => {
    if (recitation.reciter()) credit.textContent = `التلاوة بصوت ${recitation.reciter()}. `
      + 'استمع واتبعْ بعينك، ثم اقرأها بنفسك.';
  });

  return h('div', { class: 'screen story quran', css: { '--accent': QURAN_ACCENT } },
    topbar(
      h('button', { class: 'btn', onclick: () => go('#/') }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, 'سورة'),
    ),
    h('main', { class: 'screen-card' },
      h('p', { class: 'hint' }, `اقرأ بعينك واضغط الآية إذا أتممتها، و${LISTEN} لتسمعها`),
      body,
      foot,
      credit,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `الآيات: ${arNum(total)}`),
          h('button', { class: 'btn', onclick: () => toast(`قُرئت: ${arNum(read.size)}`) }, 'عدّ المقروء'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء القراءة الآن'),
        )),
    ),
  );
}

// ————— التوجيه داخل المرحلة —————

const SCREENS = {
  letters: renderQuranLetters,
  rasm: renderQuranRasm,
  muqattaat: renderQuranMuqattaat,
};

/** شاشة عقدة قرآنية بمعرّف جزئها — أو null إن كان مجهولاً (فيعود التوجيه بالطفل للخريطة). */
export function renderQuran(part) {
  if (SCREENS[part]) return SCREENS[part]();
  const level = quranWordLevel(part);
  if (level) return renderQuranWords(level);
  const surah = surahOfWordsPart(part);
  if (surah) return renderSurahWords(surah.id);
  return renderSurah(part);
}
