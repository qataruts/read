// شاشة القراءة — قصص المنهج (METHOD §٥.٥) ومكتبة «مصنع القصص» (الحزمة ٩).
//
// صفحة كتاب لا لعبة: القصة كلها معروضة مشكولةً بالكامل، والطفل يقرأ بعينه؛
// فإن تعثّر في كلمة نقرها فسمعها، وإن أراد الجملة كاملةً فزرّها إلى جانبها.
// لا خطأ في القراءة نفسها ولا مشتّتات — القراءة هي النشاط.
//
// **شاشةٌ واحدة لمصدرَي القصص** (بند الحزمة ٩/٥: «الشاشة ترث `story.js`»)، وتزيد
// لقصص المكتبة شيئين:
//   • **الكاريوكي**: زرُّ «اسمع القصة» يتلو الجمل بالتتابع ويُظلِّل المسموعة منها
//     (نمط تتبّع السطر في وصلة التلاوة) — فيربط الطفل ما يسمعه بما يراه.
//   • **سؤال فهم مصوَّر** في الختام: جملةٌ تُقرأ ← ثلاث صور، **بلا صوت قبل الاختيار**
//     (نمط «اقرأ واختر» المُقَرّ) — لعبةٌ لا امتحان: الخطأ يُسمعه ما اختاره ويعيده.
//
// المفكوكية ١٠٠٪: موضع كل قصة في الرحلة بعد ما تكتمل به كلماتُها — قصص المنهج بعد
// المهارة التي تُوظّفها، وقصص المكتبة بعد سلّم جمل بستانها. يفحص ذلك
// `tools/check_decodable.py` و`tools/check_lexicon.py`.

import { storyById, storyTexts, sentenceText } from './curriculum.js';
import { libraryStory, storyTexts as libraryStoryTexts } from './library.js';
import { textWord } from './fade.js';   // عرضٌ بدرجات الخفوت — ولا احتساب هنا (الشاهد الواحد)
import * as progress from './progress.js';
import * as audio from './audio.js';
import * as recorder from './recorder.js';
import * as recordings from './recordings.js';
import { gateCard } from './parent.js';
import {
  h, icon, faceEl, cheer, toast, go, arNum, arCount, starsRow, topbar, shake,
  STORY_ACCENT, mascot, micIcon, shuffle, DEV,
} from './ui.js';

const LINE_GAP_MS = 500;     // فاصلٌ بين جملتين في الكاريوكي — مهلةُ عينٍ تنتقل
const AFTER_PICK_MS = 900;   // مهلة سماع الجواب قبل الاحتفال

/**
 * نجوم قصص المنهج: ٣ لمن استمع إلى الجمل كلها، ٢ لمن استمع إلى نصفها فأكثر، وإلا ١.
 * لا خطأ يُحتسب هنا (لا سؤال أصلاً)، فالمقياس هو المتابعة لا الإصابة.
 */
export function starsForStory(heard, total) {
  if (total && heard >= total) return 3;
  return heard * 2 >= total ? 2 : 1;
}

/**
 * نجوم قصص المكتبة: **متابعةٌ + نجمةُ فهم** (بند الحزمة ٩/٥).
 * المتابعة نجمتان لمن تابع الجمل كلها، ونجمةٌ لمن تابع نصفها، ولا شيء لمن مرّ مروراً؛
 * وسؤال الفهم يزيد نجمةً إن أصاب من أول مرة. والحدّ الأدنى نجمةٌ دائماً: القصة
 * تُقرأ بالعين أيضاً، فلا يُحرَم منها طفلٌ لم ينقر شيئاً (سابقة الجلسة ٤ المُقرّة).
 */
export function starsForLibrary(heard, total, correct) {
  return Math.max(1, starsForStory(heard, total) - 1 + (correct ? 1 : 0));
}

export function renderStory(storyId) {
  const story = storyById(storyId);
  if (!story) return null;
  return readingScreen({
    nodeId: `story:${story.id}`,
    title: story.title,
    emoji: story.emoji,
    pill: 'قصة',
    texts: storyTexts(story),
    lines: story.sentences.map((s) => ({ words: s.words, emoji: s.emoji, text: sentenceText(s) })),
    stars: ({ heard, total }) => starsForStory(heard, total),
  });
}

export function renderLibraryStory(storyId) {
  const story = libraryStory(storyId);
  if (!story) return null;
  return readingScreen({
    nodeId: `library:${story.id}`,
    title: story.title,
    emoji: story.emoji,
    pill: `قصة · مستوى ${arNum(story.level)}`,
    texts: [...libraryStoryTexts(story), ...(story.question?.options || []).map((w) => w.say)],
    lines: story.pages.map((p) => ({ words: p.words, emoji: p.emoji, text: p.text })),
    question: story.question,
    stars: ({ heard, total, correct }) => starsForLibrary(heard, total, correct),
  });
}

function readingScreen({ nodeId, title, emoji, pill, texts, lines, question, stars }) {
  const total = lines.length;
  const heard = new Set();      // فهارس الجمل التي سمعها الطفل (كلمةً كلمةً أو كاملةً)
  let done = false;
  let asked = false;
  let missed = false;           // أخطأ في سؤال الفهم مرةً على الأقل
  let token = 0;                // يُبطِل الكاريوكي المعلَّق عند أي انتقال
  let root = null;

  audio.preload(texts);

  const body = h('div', { class: 'story-body' });
  const foot = h('div', { class: 'row foot' });
  const lineEls = [];

  const live = (mine) => mine === token && (!root || root.isConnected);

  function paint() {
    stopAll();
    body.replaceChildren(page());
    paintFoot();
  }

  function paintFoot() {
    foot.replaceChildren(
      h('p', { class: 'hint' },
        `سمعتَ ${arNum(heard.size)} من ${arCount(total, ['جملة', 'جملتين', 'جمل', 'جملة'])}`),
      h('button', { class: 'btn btn--primary btn--wide next', onclick: finish },
        question ? 'أتممتُ القراءة ← السؤال' : 'أتممتُ القراءة ←'),
    );
  }

  // ————— صفحة القصة —————

  function page() {
    lineEls.length = 0;
    const sheet = h('div', { class: 'sheet' },
      h('button', {
        class: 'story-title',
        'aria-label': `اسمع عنوان القصة: ${title}`,
        onclick: () => { stopAll(); audio.play(title); },
      },
        faceEl(emoji, 'word-emoji'),
        h('span', { class: 'story-title-text' }, title),
      ),
    );

    lines.forEach((line, index) => {
      const said = new Set();

      // كلُّ كلمةٍ بدرجة خفوتها (حزمة الخفوت)، ونقرتُها تُسمعها **وتكشف شكلها** ثوانيَ:
      // فالنقرة هنا هي «الشكل عند الطلب» بعينها — من احتاج أن يسمع كلمةً احتاج شكلها،
      // ولذلك يُحتسب لها التراجعُ الجزئيّ نفسُه.
      const words = line.words.map((word, i) => textWord(word, {
        className: 'story-word',
        label: `اسمع كلمة ${word}`,
        onclick: (e) => {
          stopAll();
          e.currentTarget.classList.add('story-word--said');
          said.add(i);
          if (said.size === line.words.length) markHeard(index);
          audio.play(word);
        },
      }));

      const el = h('div', { class: 'line' },
        faceEl(line.emoji, 'line-emoji'),
        h('p', { class: 'line-words' }, words),
        h('button', {
          class: 'btn line-ear',
          'aria-label': `اسمع الجملة كاملة: ${line.text}`,
          onclick: () => readAloud(index, false),
        }, icon('ear')),
      );
      lineEls.push(el);
      sheet.append(el);
    });

    // زرّ الكاريوكي: يتلو من أول جملة ويُظلّل المسموعة (بند الحزمة ٩/٥)
    sheet.append(h('div', { class: 'row karaoke' },
      h('button', {
        class: 'btn btn--wide read-all',
        onclick: (e) => (e.currentTarget.dataset.on ? stopAll() : readAloud(0, true)),
      }, icon('ear'), ' اسمع القصة كاملة'),
    ));
    // و«اقرأ لي» تحته: يسمع القصةَ بصوتنا، ثم يقرؤها بصوته (الحزمة ١٠)
    if (recordRow) sheet.append(recordRow);
    return sheet;
  }

  /** تظليل الجملة المسموعة وحدها — يتبعها الطفل بعينه كما يتبع السطر المتلوّ. */
  function highlight(index) {
    lineEls.forEach((el, i) => el.classList.toggle('line--now', i === index));
  }

  function stopAll() {
    token++;
    audio.stop();
    recorder.stopPlayback();   // ولا يتداخل صوتُ الطفل مع صوت القصة
    highlight(-1);
    const btn = body.querySelector('.read-all');
    if (btn) {
      delete btn.dataset.on;
      btn.replaceChildren(icon('ear'), ' اسمع القصة كاملة');
    }
  }

  /** قراءةٌ جهرية: جملةً واحدة، أو القصة كلها بالتتابع (`chain`). */
  async function readAloud(from, chain) {
    stopAll();
    const mine = ++token;
    const btn = body.querySelector('.read-all');
    if (chain && btn) {
      btn.dataset.on = '1';
      btn.textContent = '■ أوقِف القراءة';
    }
    for (let i = from; i < total; i++) {
      highlight(i);
      markHeard(i);
      await audio.play(lines[i].text);
      if (!live(mine)) return;
      if (!chain) break;
      await new Promise((r) => setTimeout(r, LINE_GAP_MS));
      if (!live(mine)) return;
    }
    stopAll();
  }

  function markHeard(index) {
    if (heard.has(index) || done) return;
    heard.add(index);
    paintFoot();
  }

  // ————— «اقرأ لي»: يقرأ الطفل بصوته ثم يسمع نفسه (الحزمة ١٠) —————
  //
  // فعلٌ ثانويّ لا يزاحم «أتممتُ القراءة» (DESIGN §٥.١)، وموضعه تحت «اسمع القصة
  // كاملة» مباشرةً: يسمعها بصوتنا ثم يقرؤها بصوته. و**لا مؤقّت ولا عدّاد** يراه
  // (DESIGN §٥.٦) — المدّة تُلتقط ضمنياً وتذهب إلى لوحة والده وحدها.
  //
  // **إعادة القراءة هي المقصود**: زرُّ «سجّل من جديد» حاضرٌ دائماً بلا حدّ، فالطلاقة
  // تُبنى بإعادة قراءة النصّ نفسه مرّاتٍ (repeated reading — ROADMAP §المرحلة و).

  function recordBlock() {
    // غيابُ الميكروفون أو المخزن لا يكسر شيئاً: لا يظهر الزرّ أصلاً (بند الحزمة ١٠/٤)
    if (!recorder.supported() || !recordings.supported()) return null;

    const row = h('div', { class: 'row record' });
    let clip = null;      // آخر تسجيل في هذه الجلسة — يُسمَع من الذاكرة بلا فتح المخزن
    let busy = false;

    function paintIdle() {
      const buttons = [h('button', {
        class: 'btn rec-mic',
        'aria-label': clip ? 'سجّل قراءتك من جديد' : 'سجّل قراءتك بصوتك',
        onclick: begin,
      }, micIcon(), clip ? 'سجّل من جديد' : 'اقرأ لي')];
      if (clip) {
        buttons.push(h('button', {
          class: 'btn rec-hear',
          'aria-label': 'اسمع صوتك مرة أخرى',
          onclick: hear,
        }, '▶ اسمع صوتك'));
      }
      row.replaceChildren(...buttons);   // لا فراغ ولا `null` — replaceChildren لا يُصفّي كـ`h`
    }

    function paintRecording() {
      row.replaceChildren(
        h('button', {
          class: 'btn rec-mic rec-mic--on',
          'aria-label': 'أوقِف التسجيل',
          onclick: end,
        }, h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), 'أوقِف التسجيل'),
        h('span', { class: 'hint rec-hint' }, 'نسمعك… اقرأ القصة بصوتك'),
      );
    }

    /** إذنُ وليّ الأمر مرة واحدة (بند الحزمة ١٠/٤) — بالبوابة الحسابية نفسها. */
    function askParent() {
      const overlay = h('div', { class: 'overlay' },
        h('div', { class: 'overlay-card' }, gateCard({
          hint: 'التسجيل يحتاج إذن وليّ الأمر مرة واحدة — أجب لتفتحه لطفلك.',
          onPass: () => { overlay.remove(); progress.allowMic(); begin(); },
          onCancel: () => overlay.remove(),
        })));
      root?.append(overlay);
      overlay.querySelector('input')?.focus();
    }

    async function begin() {
      if (busy || recorder.isRecording()) return;
      if (!progress.micAllowed()) return askParent();
      busy = true;
      stopAll();                    // لا يدخل صوتُ التطبيق في تسجيل الطفل
      try {
        await recorder.start();
        paintRecording();
      } catch (e) {
        console.warn('[record] تعذّر التسجيل:', e);
        row.replaceChildren();      // يختفي بهدوء — الرفض لا يكسر شيئاً
        toast('لم يُسمح باستعمال الميكروفون');
      }
      busy = false;
    }

    async function end() {
      if (busy) return;
      busy = true;
      const taken = await recorder.stop().catch(() => null);
      busy = false;
      if (!taken) {
        paintIdle();          // لم يُلتقط شيء: يعود الزرّ كما كان بلا شكوى
        return;
      }

      // **يسمع نفسه أولاً** — أحبُّ صوتٍ إلى الطفل صوتُه، فلا يُؤخَّر سماعُه بانتظار
      // كتابة القرص. والصوت في الذاكرة أصلاً، وحفظُه لوليّ أمره يجري خلفه.
      clip = taken.blob;
      paintIdle();
      hear();
      progress.logRecording({ node: nodeId, title, seconds: taken.seconds });
      recordings.saveClip({
        node: nodeId, title, seconds: taken.seconds, blob: taken.blob, day: progress.dayKey(),
      }).catch((e) => console.warn('[record] تعذّر حفظ التسجيل:', e));
    }

    function hear() {
      if (!clip) return;
      stopAll();
      recorder.playClip(clip);
    }

    paintIdle();
    return row;
  }

  const recordRow = recordBlock();

  // ————— سؤال الفهم (قصص المكتبة) —————
  //
  // «لعبة لا امتحان»: لا صوت قبل الاختيار (الحكم على القراءة لا على السمع)، والخطأ
  // يُسمعه ما اختاره ليقارنه بما قرأ — ولا يُحجَب عنه الجواب ولا تُقفل الشاشة.

  function askView() {
    let locked = false;
    const options = shuffle(question.options);

    const row = h('div', { class: 'row picrow' }, options.map((word) => {
      const btn = h('button', {
        class: 'piccard',
        'aria-label': word.word,
        onclick: async () => {
          if (locked) return;
          if (word !== question.answer) {
            missed = true;
            shake(btn);
            btn.classList.add('bad');
            setTimeout(() => btn.classList.remove('bad'), 700);
            audio.play(word.say);
            return;
          }
          locked = true;
          btn.classList.add('good');
          // **لا احتساب هنا** (قاعدة الشاهد الواحد — `fade.js`): إصابةُ صورةِ السؤال
          // شاهدٌ على فهم جملته لا على قراءة كلِّ كلمةٍ فيها، واحتمالُها الثلث.
          const mine = ++token;
          await audio.play(word.say);
          if (!live(mine)) return;
          await new Promise((r) => setTimeout(r, AFTER_PICK_MS));
          if (live(mine)) celebrate();
        },
      }, faceEl(word.emoji, 'pic-emoji'));
      return btn;
    }));

    return h('div', { class: 'ask' },
      h('h2', {}, 'سؤال القصة'),
      h('p', { class: 'hint' }, 'اقرأ السؤال، ثم اختر صورته'),
      h('p', { class: 'sentence' },
        question.words.map((word) => textWord(word, { className: 'sentence-word' }))),
      row,
    );
  }

  // ————— الختام —————

  function finish() {
    stopAll();
    recorder.release();     // انتهت القراءة: يُطلق الميكروفون ولو كان مفتوحاً
    if (question && !asked) {
      asked = true;
      body.replaceChildren(askView());
      foot.replaceChildren();
      return;
    }
    celebrate();
  }

  function celebrate() {
    stopAll();
    done = true;
    const won = stars({ heard: heard.size, total, correct: question ? !missed : false });
    const before = progress.getStars(nodeId);
    progress.setStars(nodeId, won);
    const last = !progress.nextNode();

    body.replaceChildren(h('div', { class: 'celebrate' },
      mascot('mascot mascot--cheer'),
      faceEl(emoji, 'celebrate-face', 'div'),
      h('h2', {}, 'قرأتَ قصة كاملة!'),
      starsRow(won, 'big-stars'),
      h('p', { class: 'hint' }, won === 3
        ? cheer('سمعتَ الجمل كلها وأجبتَ عن السؤال — أحسنت!')
        : question
          ? 'أعِد القراءة واسمع كل جملة، وأجب عن السؤال من أول مرة.'
          : 'أعِد القراءة واسمع كل جملة لتزيد نجومك.'),
      before > won && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      last && h('p', { class: 'note' }, icon('party'),
        ' أتممتَ الرحلة كلها — من الحرف الأول إلى المكتبة.'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => {
            done = false;
            asked = false;
            missed = false;
            heard.clear();
            paint();
          },
        }, '↻ أعِد القراءة'),
      ),
    ));
    foot.replaceChildren();
  }

  paint();

  root = h('div', { class: 'screen story', css: { '--accent': STORY_ACCENT } },
    topbar(
      // الخروج من القراءة لا يُستأذَن فيه (بخلاف الدرس واللعبة): لا شيء يضيع،
      // والقصة تبقى مفتوحة يعود إليها متى شاء.
      h('button', { class: 'btn', onclick: () => go('#/') }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, pill),
    ),
    h('main', { class: 'screen-card' },
      h('p', { class: 'hint' }, 'اقرأ بعينك، وانقر أي كلمة لتسمعها'),
      body,
      foot,
      DEV && h('div', { class: 'dev' },
        h('div', { class: 'dev-title' }, 'أدوات التجربة (?dev=1)'),
        h('div', { class: 'dev-row' },
          h('span', {}, `الجمل: ${arNum(total)}`),
          h('button', { class: 'btn', onclick: () => toast(`سُمعت: ${arNum(heard.size)}`) }, 'عدّ المسموع'),
          h('button', { class: 'btn', onclick: finish }, 'إنهاء القراءة الآن'),
        )),
    ),
  );

  return root;
}
