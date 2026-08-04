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
import { libraryStory, readsAloud, storyTexts as libraryStoryTexts } from './library.js';
import { textWord } from './fade.js';   // عرضٌ بدرجات الخفوت — ولا احتساب هنا (الشاهد الواحد)
import * as progress from './progress.js';
import * as audio from './audio.js';
import * as recorder from './recorder.js';   // لإسكات صوت الطفل وحده — والالتقاطُ في record.js
import { recordBlock } from './record.js';
import {
  h, icon, faceEl, coverEl, cheer, toast, go, arNum, arCount, starsRow, topbar, shake,
  STORY_ACCENT, mascot, shuffle, DEV,
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

/**
 * نجوم قصص **رفّ المكتبة** (حزمة المكتبة): لا جملَ تُسمَع هنا أصلاً، فعدّادُ المسموع
 * لا يقيس شيئاً. والمقياسُ **الفهم**: نجمةٌ للقراءة دائماً، ونجمةٌ لكل مقطعٍ أُجيب من
 * أوّل مرّة، بحدّ ثلاث. والحدُّ الأدنى نجمةٌ كسائر القصص — القراءةُ نفسُها إنجاز.
 */
export function starsForShelf(clean) {
  return Math.max(1, Math.min(3, 1 + clean));
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
  // **قصةُ الرفّ تُقرأ لا تُسمَع** (بند الحزمة): يسقط الكاريوكي وأذنُ السطر، فلا
  // تدخل جملُها قائمةَ الصوت أصلاً — وتبقى نقرةُ الكلمة شبكةَ الأمان الوحيدة.
  const shelf = Boolean(story.shelf);
  return readingScreen({
    nodeId: `${shelf ? 'shelf' : 'library'}:${story.id}`,
    title: story.title,
    emoji: story.emoji,
    pill: `قصة · مستوى ${arNum(story.level)}`,
    texts: [...libraryStoryTexts(story),
      ...story.questions.flatMap((q) => q.options.map((w) => w.say))],
    lines: story.pages.map((p) => ({ words: p.words, emoji: p.emoji, text: p.text })),
    // غلافُ القصة في صدر شاشتها — كما يُفتَح الكتابُ على غلافه (أمر المالك)
    cover: story.cover ? story : null,
    questions: story.questions,
    aloud: readsAloud(story),
    readToMother: shelf,
    stars: ({ heard, total, clean, asked }) => (shelf
      ? starsForShelf(clean)
      : starsForLibrary(heard, total, asked ? clean === asked : false)),
  });
}

/**
 * @param {object[]} questions  سؤالٌ لكل مقطع، لكلٍّ `upto` (رقمُ صفحته الأخيرة).
 *   والمقطعُ وحدةُ العرض: يقرأ صفحاتِه ثم يُسأل عنها ثم ينتقل. وقصصُ البساتين
 *   والمنهج مقطعٌ واحد يسع الصفحات كلَّها، فالمسارُ واحدٌ لا مساران.
 * @param {boolean} aloud       أتُسمَع جملُها؟ (كاريوكي وأذنُ السطر) — لا في الرفّ.
 * @param {boolean} readToMother أتُختَم بخطوة «اِقْرَأْ لِأُمِّكْ»؟
 */
function readingScreen({ nodeId, title, emoji, pill, texts, lines, questions = [],
  aloud = true, readToMother = false, cover = null, stars }) {
  const total = lines.length;
  const heard = new Set();      // فهارس الجمل التي سمعها الطفل (كلمةً كلمةً أو كاملةً)

  // **المقاطع وحدةُ العرض**: حدودُها من `upto` الذي حسبه الفاحص من عدد الصفحات.
  // وبلا سؤالٍ (قصةُ منهج) فمقطعٌ واحد يسع الصفحات كلَّها.
  const segments = questions.length
    ? questions.map((q, i) => ({
      from: i ? questions[i - 1].upto : 0, to: q.upto, question: q,
    }))
    : [{ from: 0, to: total, question: null }];

  let done = false;
  let seg = 0;                  // المقطع المعروض
  let asking = false;           // أفي سؤال هذا المقطع نحن؟
  let mothered = false;         // أعُرضت خطوةُ «اقرأ لأمّك»؟
  let clean = 0;                // مقاطعُ أُجيبت من أوّل مرّة
  let missedHere = false;       // أخطأ في سؤال هذا المقطع
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
    const many = segments.length > 1;
    foot.replaceChildren(
      // **عدّادُ المسموع لا معنى له حيث لا تُسمَع جملة** — فيُستبدل بموضع القراءة:
      // الطفلُ في الرفّ قارئٌ، وما يهمّه أين بلغ لا كم سمع.
      h('p', { class: 'hint' }, aloud
        ? `سمعتَ ${arNum(heard.size)} من ${arCount(total, ['جملة', 'جملتين', 'جمل', 'جملة'])}`
        : `المقطع ${arNum(seg + 1)} من ${arNum(segments.length)}`
          + ` · ${arCount(segments[seg].to - segments[seg].from, ['صفحة', 'صفحتان', 'صفحات', 'صفحة'])}`),
      h('button', { class: 'btn btn--primary btn--wide next', onclick: finish },
        segments[seg].question ? 'أتممتُ القراءة ← السؤال'
          : many ? 'أتممتُ القراءة ←' : 'أتممتُ القراءة ←'),
    );
  }

  // ————— صفحة القصة —————

  function page() {
    lineEls.length = 0;
    const sheet = h('div', { class: 'sheet' },
      // الغلافُ في صدر المقطع الأول وحدَه: يُفتَح الكتابُ على غلافه ثم يُقرأ
      seg === 0 && coverEl(cover, { className: 'story-cover' }),
      h('button', {
        class: 'story-title',
        'aria-label': `اسمع عنوان القصة: ${title}`,
        onclick: () => { stopAll(); audio.play(title); },
      },
        faceEl(emoji, 'word-emoji'),
        h('span', { class: 'story-title-text' }, title),
      ),
    );

    // **يُعرَض مقطعُ القصة لا القصةُ كلُّها**: عشرُ صفحاتٍ في شاشةٍ واحدة تفيض عن
    // الآيباد وتُرهق العين — والمقطعُ هو نفسُه وحدةُ السؤال، فالعرضُ يتبع الفهم.
    const { from, to } = segments[seg];
    lines.slice(from, to).forEach((line, offset) => {
      const index = from + offset;
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
        // أذنُ السطر لا تُعرَض حيث لا صوتَ للجملة (الرفّ) — ولا يُعرَض زرٌّ لا يعمل
        aloud && h('button', {
          class: 'btn line-ear',
          'aria-label': `اسمع الجملة كاملة: ${line.text}`,
          onclick: () => readAloud(index, false),
        }, icon('ear')),
      );
      lineEls.push(el);
      sheet.append(el);
    });

    // زرّ الكاريوكي: يتلو من أول جملة ويُظلّل المسموعة (بند الحزمة ٩/٥).
    // **ولا كاريوكي في الرفّ**: «القصةُ تُقرأ لا تُسمع» — الطفلُ هناك قارئ.
    if (aloud) {
      sheet.append(h('div', { class: 'row karaoke' },
        h('button', {
          class: 'btn btn--wide read-all',
          onclick: (e) => (e.currentTarget.dataset.on ? stopAll() : readAloud(from, true)),
        }, icon('ear'), ' اسمع القصة كاملة'),
      ));
      // و«اقرأ لي» تحته: يسمع القصةَ بصوتنا، ثم يقرؤها بصوته (الحزمة ١٠)
      if (recordRow) sheet.append(recordRow);
    }
    return sheet;
  }

  /** تظليل الجملة المسموعة وحدها — يتبعها الطفل بعينه كما يتبع السطر المتلوّ. */
  function highlight(index) {
    const base = segments[seg].from;      // `lineEls` مقطعُ الشاشة لا القصةُ كلُّها
    lineEls.forEach((el, i) => el.classList.toggle('line--now', base + i === index));
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
    for (let i = from; i < segments[seg].to; i++) {   // ولا يتعدّى الكاريوكي مقطعَه
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
  // كاملة» مباشرةً: يسمعها بصوتنا ثم يقرؤها بصوته. والكتلةُ نفسُها في `record.js`
  // — تشاركها فيها خطوةُ ترديد السورة (حزمة «القرآني الموسّع»)، فحاملُ صوت الطفل
  // ملفٌّ واحد لا نسختان تفترقان.

  const recordRow = recordBlock({
    nodeId,
    title,
    // **وسمُ الرفّ «اِقْرَأْ لِأُمِّكْ»** (حكم المدير، ١٢ أغسطس ٢٠٢٦) — مذكَّراً
    // كخطاب التطبيق كلِّه («اقرأ بعينك»، «أتممتَ القراءة»)، ولا يُشقّ لشاشةٍ وحدها.
    label: readToMother ? 'اِقْرَأْ لِأُمِّكْ' : 'اقرأ لي',
    hint: readToMother ? 'نسمعك… اقرأ القصة لأمّك بصوتك' : 'نسمعك… اقرأ القصة بصوتك',
    stopAll,
    root: () => root,
  });

  // ————— سؤال الفهم (قصص المكتبة) —————
  //
  // «لعبة لا امتحان»: لا صوت قبل الاختيار (الحكم على القراءة لا على السمع)، والخطأ
  // يُسمعه ما اختاره ليقارنه بما قرأ — ولا يُحجَب عنه الجواب ولا تُقفل الشاشة.

  function askView(question) {
    let locked = false;
    const options = shuffle(question.options);
    const many = segments.length > 1;

    const row = h('div', { class: 'row picrow' }, options.map((word) => {
      const btn = h('button', {
        class: 'piccard',
        'aria-label': word.word,
        onclick: async () => {
          if (locked) return;
          if (word !== question.answer) {
            missedHere = true;
            shake(btn);
            btn.classList.add('bad');
            setTimeout(() => btn.classList.remove('bad'), 700);
            audio.play(word.say);
            return;
          }
          locked = true;
          btn.classList.add('good');
          if (!missedHere) clean++;     // مقطعٌ أُجيب من أوّل مرّة
          // **لا احتساب هنا** (قاعدة الشاهد الواحد — `fade.js`): إصابةُ صورةِ السؤال
          // شاهدٌ على فهم جملته لا على قراءة كلِّ كلمةٍ فيها، واحتمالُها الثلث.
          const mine = ++token;
          await audio.play(word.say);
          if (!live(mine)) return;
          await new Promise((r) => setTimeout(r, AFTER_PICK_MS));
          if (live(mine)) advance();
        },
      }, faceEl(word.emoji, 'pic-emoji'));
      return btn;
    }));

    return h('div', { class: 'ask' },
      h('h2', {}, many ? `سؤال المقطع ${arNum(seg + 1)}` : 'سؤال القصة'),
      h('p', { class: 'hint' }, 'اقرأ السؤال، ثم اختر صورته'),
      h('p', { class: 'sentence' },
        question.words.map((word) => textWord(word, { className: 'sentence-word' }))),
      row,
    );
  }

  // ————— «اِقْرَأْ لِأُمِّكْ» — خطوةٌ أخيرة لا عقدةٌ ثانية —————
  //
  // نظيرُ «الترديد» في شاشة السورة بحرفه: خطوةٌ في الشاشة نفسِها، **بلا مؤقّت**،
  // والانتقالُ بيده. وكتلتُها `record.js` نفسُها — فحاملُ صوت الطفل ملفٌّ واحد لا
  // نسختان تفترقان، والخصوصيةُ مطلقة (محليّ، `blob:`، صفرُ شبكة).

  function motherView() {
    return h('div', { class: 'ask' },
      h('h2', {}, 'اِقْرَأْ لِأُمِّكْ'),
      h('p', { class: 'hint' }, 'قرأتَ القصة كلها — اقرأها الآن بصوتك، واسمع نفسك'),
      // **أيقونتُنا الخطية لا إيموجي**: هذه لغةُ الواجهة لا بيانٌ من المنهج
      // («أيقونات لا إيموجي» — DESIGN §٦)، ولا وجهَ لهذه الخطوة في بياناتٍ تُقرأ.
      faceEl(icon('family'), 'celebrate-face', 'div'),
      recordRow || h('p', { class: 'note' }, 'اقرأ القصة لأمّك بصوتك — ثم أتمِم'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary btn--wide next', onclick: celebrate },
          'أتممتُ ←'),
      ),
    );
  }

  // ————— الختام —————

  /** «أتممتُ القراءة»: إلى سؤال المقطع إن كان له سؤال، وإلا إلى ما بعده. */
  function finish() {
    stopAll();
    recorder.release();     // انتهت القراءة: يُطلق الميكروفون ولو كان مفتوحاً
    const question = segments[seg].question;
    if (question && !asking) {
      asking = true;
      missedHere = false;
      body.replaceChildren(askView(question));
      foot.replaceChildren();
      return;
    }
    advance();
  }

  /** بعد سؤال المقطع (أو بلا سؤال): إلى المقطع الذي يليه، أو إلى خاتمة القصة. */
  function advance() {
    asking = false;
    if (seg < segments.length - 1) {
      seg++;
      paint();
      return;
    }
    // **خطوةُ «اِقْرَأْ لِأُمِّكْ» آخِرَ القصة** — بعد أن قرأها كلَّها وأجاب عن مقاطعها
    if (readToMother && !mothered) {
      mothered = true;
      body.replaceChildren(motherView());
      foot.replaceChildren();
      return;
    }
    celebrate();
  }

  function celebrate() {
    stopAll();
    done = true;
    const asked = questions.length;
    const won = stars({ heard: heard.size, total, clean, asked });
    const before = progress.getStars(nodeId);
    progress.setStars(nodeId, won);
    const last = !progress.nextNode();

    body.replaceChildren(h('div', { class: 'celebrate' },
      mascot('mascot mascot--cheer'),
      faceEl(emoji, 'celebrate-face', 'div'),
      h('h2', {}, 'قرأتَ قصة كاملة!'),
      starsRow(won, 'big-stars'),
      h('p', { class: 'hint' }, won === 3
        ? cheer(aloud ? 'سمعتَ الجمل كلها وأجبتَ عن السؤال — أحسنت!'
          : `قرأتَ ${arCount(total, ['صفحة', 'صفحتين', 'صفحات', 'صفحة'])} وأجبتَ عن الأسئلة كلها — أحسنت!`)
        : !asked ? 'أعِد القراءة واسمع كل جملة لتزيد نجومك.'
          : aloud ? 'أعِد القراءة واسمع كل جملة، وأجب عن السؤال من أول مرة.'
            : 'أعِد القراءة، وأجب عن أسئلة المقاطع من أول مرة.'),
      before > won && h('p', { class: 'hint' }, `نجومك السابقة محفوظة: ${arNum(before)} ★`),
      last && h('p', { class: 'note' }, icon('party'),
        ' أتممتَ الرحلة كلها — من الحرف الأول إلى المكتبة.'),
      h('div', { class: 'row foot' },
        h('button', { class: 'btn btn--primary', onclick: () => go('#/') }, '→ الخريطة'),
        h('button', {
          class: 'btn',
          onclick: () => {
            done = false;
            seg = 0;
            asking = false;
            mothered = false;
            clean = 0;
            missedHere = false;
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
