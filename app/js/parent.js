// لوحة وليّ الأمر (METHOD §٦) — خلف بوابة عملية حسابية بسيطة لا يحلّها طفل السادسة:
// أين يتعثّر بالضبط، وكم دقيقة تعلّم، وما توصية اليوم.
//
// الشاشة لا تنطق شيئاً (لا صوت فيها أصلاً)، وتُبنى من نفس مفردات التنسيق القائمة
// (pill · vchip · note · chip) وتُلوَّن بمتغيّر --accent، فلا تحتاج تنسيقاً جديداً.

import * as progress from './progress.js';
import * as recordings from './recordings.js';
import * as recorder from './recorder.js';
import { h, go, arNum, arCount, topbar, letterTitle, nodeTitle, nodeWhere, shake } from './ui.js';

const ACCENT = 'var(--accent-skills)';
const GOOD = 'var(--ok)';
const BAD = 'var(--err)';
const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const ENOUGH_MINUTES = 20;   // نصيب اليوم لطفل السادسة — بعده تُنصح الاستراحة

let unlocked = false;        // البوابة تُفتح لهذه الجلسة فقط (لا تُحفظ في التخزين)

/** ثوانٍ ← نصّ عربي مقروء. */
export function minutesText(seconds) {
  if (!seconds) return 'لا شيء';
  if (seconds < 60) return 'أقل من دقيقة';
  return arCount(Math.round(seconds / 60), ['دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة']);
}

/** «مهارة واحدة» · «مهارتين» · «٥ مهارات» · «١٢ مهارة» — مفعولاً به في سياق التثبيت. */
export const skillsText = (n) => arCount(n, ['مهارة واحدة', 'مهارتين', 'مهارات', 'مهارة']);

/** ثوانٍ ← نصّ عربي بدقّة الثانية: مدد القراءة الجهرية أقصر من أن تُقاس بالدقائق. */
export function secondsText(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (!total) return 'أقل من ثانية';
  const rest = total % 60;
  const restText = arCount(rest, ['ثانية واحدة', 'ثانيتان', 'ثوانٍ', 'ثانية']);
  if (total < 60) return restText;
  const minutes = arCount(Math.floor(total / 60), ['دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة']);
  return rest ? `${minutes} و${restText}` : minutes;
}

/** لحظة التسجيل كما يقرؤها وليّ الأمر: «أحد ٣/٨ · ٦:٤٠». */
export function whenText(at) {
  const d = new Date(at);
  const time = `${arNum(d.getHours())}:${arNum(String(d.getMinutes()).padStart(2, '0'))}`;
  return `${DAY_NAMES[d.getDay()]} ${arNum(d.getDate())}/${arNum(d.getMonth() + 1)} · ${time}`;
}

/**
 * توصية اليوم — دالّة خالصة تُختبر وحدها.
 * الترتيب مقصود: صحّة الطفل (سقف الوقت) قبل التحصيل، والمراجعة قبل الجديد
 * (ما تعثّر فيه أولى بالتثبيت من درس جديد يُبنى على متزعزع).
 */
export function recommend({ letters = 0, dueCount = 0, secondsToday = 0, reviewDone = false, next = null } = {}) {
  const minutes = Math.round(secondsToday / 60);
  if (!letters) {
    return { title: 'ابدآ الرحلة معاً', body: 'أول درس في المجموعة الأولى — اجلس معه في أول درسين حتى تتضح له اللعبة.', action: next && { label: 'افتح درسه الأول', hash: '#/' } };
  }
  if (minutes >= ENOUGH_MINUTES) {
    return { title: 'أخذ نصيبه اليوم', body: `تعلّم اليوم ${minutesText(secondsToday)} — الزيادة على هذا تُتعب طفل السادسة أكثر مما تنفعه. أعِده غداً.`, action: null };
  }
  if (dueCount && !reviewDone) {
    return { title: 'ابدأ بمراجعة اليوم', body: `حان وقت تثبيت ${skillsText(dueCount)} (تمارين قصيرة مما درسه). المراجعة قبل الدرس الجديد.`, action: { label: 'ابدأ المراجعة', hash: '#/review' } };
  }
  if (next) {
    return { title: 'واصِلا الدرس التالي', body: `التالي في رحلته: ${nodeTitle(next)}.`, action: { label: 'افتح الخريطة', hash: '#/' } };
  }
  return { title: 'أتمّ رحلة الحروف كلها', body: 'أعِد معه المراجعة اليومية حتى تُفتح المرحلة القرآنية.', action: { label: 'ابدأ المراجعة', hash: '#/review' } };
}

// ————— البوابة الحسابية —————

function question() {
  const a = 6 + Math.floor(Math.random() * 7);    // ٦…١٢
  const b = 7 + Math.floor(Math.random() * 6);    // ٧…١٢
  return { a, b, answer: a * b };
}

/** يقبل الرقمين العربي والهندي معاً. */
export function readNumber(text) {
  const normalized = String(text ?? '').trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN;
}

/**
 * بطاقة البوابة — عمليةُ ضربٍ لا يحلّها طفل السادسة.
 * تُستعمل شاشةً كاملة للوحة، و**نافذةً فوق شاشة القصة** حين يُطلب إذنُ الميكروفون
 * أول مرة (بند الحزمة ١٠/٤): بوابةٌ واحدة لا نسختان منها.
 */
export function gateCard({ hint: hintText = 'هذه الشاشة لوليّ الأمر — أجب لتدخل.', onPass, onCancel } = {}) {
  let q = question();
  const prompt = h('div', { class: 'giant', css: { '--accent': ACCENT, 'font-size': '2.6rem' } },
    `${arNum(q.a)} × ${arNum(q.b)}`);
  const input = h('input', {
    class: 'chip',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    'aria-label': 'ناتج الضرب',
    css: { 'min-width': '8rem', 'text-align': 'center', border: '2px solid var(--line)', font: 'inherit' },
  });
  const hint = h('p', { class: 'hint' }, hintText);

  function check() {
    if (readNumber(input.value) === q.answer) return onPass();
    shake(input);
    input.value = '';
    q = question();
    prompt.textContent = `${arNum(q.a)} × ${arNum(q.b)}`;
    hint.textContent = 'ليس هذا الناتج — جرّب هذه.';
    input.focus();
  }

  return h('div', { class: 'gate', css: { '--accent': ACCENT } },
    h('h2', {}, 'كم الناتج؟'),
    prompt,
    hint,
    h('div', { class: 'row' },
      input,
      h('button', { class: 'btn btn--primary gate-go', onclick: check }, 'ادخل'),
      onCancel && h('button', { class: 'btn gate-cancel', onclick: onCancel }, 'ليس الآن'),
    ),
  );
}

function gateScreen(onPass) {
  return h('div', { class: 'screen', css: { '--accent': ACCENT } },
    topbar(
      h('button', { class: 'btn', onclick: () => go('#/') }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, 'لوحة وليّ الأمر'),
    ),
    h('main', { class: 'screen-card' }, gateCard({ onPass })),
  );
}

// ————— اللوحة —————

function pill(label, value) {
  return h('span', { class: 'pill' }, `${label}: `, h('b', {}, value));
}

function letterChip(stat, color) {
  return h('span', {
    class: 'vchip',
    css: { '--accent': color },
    title: `${letterTitle(stat.letter)} — ${arNum(stat.right)} صواب، ${arNum(stat.wrong)} خطأ`,
  },
    h('span', { class: 'vchip-face' }, stat.letter),
    h('small', {}, `${arNum(stat.right)} ✓ · ${arNum(stat.wrong)} ✗`));
}

// ————— «تسجيلات طفلي» (الحزمة ١٠) —————
//
// قسمٌ في اللوحة وحدها — خلف البوابة: يسمع الوالدُ قراءات طفله ويحذف ما شاء،
// ويرى **منحنى المدد** لكل قصة. والطفل لا يرى شيئاً من هذا: التسجيل عنده لعبةُ
// «أسمعُ صوتي»، والقياسُ عند والده صامتٌ لا يصير سباقاً.

/** منحنى مدد قراءات قصةٍ واحدة — رسمٌ صامت بلون اللوحة، وخلفه سطرٌ يقرؤه الوالد. */
function fluencyChart(story) {
  const values = story.reads.map((r) => Math.max(0.1, r.seconds));
  const top = Math.max(...values);
  const floor = Math.min(...values);
  const span = Math.max(top - floor, 1);
  const x = (i) => (values.length === 1 ? 120 : 10 + (i * 220) / (values.length - 1));
  const y = (v) => 50 - ((v - floor) / span) * 38;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);

  const el = h('span', { class: 'rec-chart', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 240 60" fill="none">
    <polyline points="${points.join(' ')}" stroke="var(--accent)" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4"
      fill="var(--card)" stroke="var(--accent)" stroke-width="2.5"/>`).join('')}
  </svg>`;
  return el;
}

function fluencyBlock(story) {
  const reads = story.reads.length;
  return h('div', { class: 'rec-fluency' },
    h('b', {}, story.title || story.node),
    reads > 1 && fluencyChart(story),
    h('p', { class: 'hint' },
      `${arCount(reads, ['قراءة واحدة', 'قراءتان', 'قراءات', 'قراءة'])} — `
      + `الأولى ${secondsText(story.first)}، والأخيرة ${secondsText(story.last)}`
      + (story.best < story.last ? `، وأسرعها ${secondsText(story.best)}` : '')),
  );
}

function clipRow(clip, refresh) {
  const play = h('button', {
    class: 'btn rec-play',
    'aria-label': `اسمع تسجيل ${clip.title}`,
    onclick: async () => {
      row.classList.add('rec-row--on');
      const blob = await recordings.clipBlob(clip.id);
      await recorder.playClip(blob);
      row.classList.remove('rec-row--on');
    },
  }, '▶');

  const row = h('div', { class: 'rec-row' },
    play,
    h('span', { class: 'rec-what' },
      h('b', {}, clip.title || clip.node),
      h('small', {}, `${whenText(clip.at)} · ${secondsText(clip.seconds)}`)),
    h('button', {
      class: 'btn rec-del',
      'aria-label': `احذف تسجيل ${clip.title}`,
      onclick: async () => {
        recorder.stopPlayback();
        await recordings.removeClip(clip.id);
        refresh();
      },
    }, '✕'),
  );
  return row;
}

/**
 * القسم كلّه. **المنحنى يُرسم فوراً** من سجلّ `progress` (تخزينٌ نصيّ متزامن)، و**قائمة
 * الأصوات تُملأ حين تصل** من IndexedDB (قراءتُه غير متزامنة) — فلا يرى وليّ الأمر
 * قسماً فارغاً ينتظر القرص. وهذا عينُ مسوّغ فصل البيانين: المدد تبقى بعد تقليم الصوت.
 */
function recordingsSection() {
  const box = h('div', { class: 'recs' });

  const refresh = () => {
    const stories = progress.fluencyByStory();
    const list = h('div', { class: 'rec-list' },
      h('p', { class: 'hint' }, 'جارٍ فتح التسجيلات المحفوظة…'));
    const tools = h('div', { class: 'row', css: { 'justify-content': 'flex-start' } });

    box.replaceChildren(
      ...(stories.length ? [
        list,
        tools,
        h('h4', {}, 'مدّة القراءة عبر الأيام'),
        h('div', { class: 'rec-charts' }, stories.map(fluencyBlock)),
        h('p', { class: 'hint' },
          'تناقصُ المدّة مع إعادة القراءة علامةُ طلاقة تنمو — ولا يُحكم بها على يومٍ واحد.'
          + ' ولا تُعرض للطفل: القراءة ليست سباقاً.'),
      ] : [
        h('p', { class: 'hint' },
          'لا تسجيل بعد. في كل قصة زرُّ ميكروفون: يقرأ الطفل بصوته ثم يسمع نفسه —'
          + ' وأنت تسمعه هنا.'),
      ]),
      h('p', { class: 'note' },
        'التسجيلات في هذا الجهاز وحده — لا تُرفع إلى أي مكان ولا تُرسل لأحد.'
        + ` ويُحفَظ آخر ${arNum(recordings.MAX_CLIPS)} تسجيلاً، ويُحذف الأقدم تلقائياً.`),
    );
    if (stories.length) fillClips(list, tools, refresh);
  };

  refresh();
  return box;
}

/** قائمة الأصوات المحفوظة — تصل من المخزن فتحلّ محلّ سطر الانتظار. */
async function fillClips(list, tools, refresh) {
  let clips = [];
  try {
    if (recordings.supported()) clips = await recordings.listClips();
  } catch {
    clips = [];   // مخزنٌ معطّل (تصفّح خاص مثلاً): تبقى المدد ولا تظهر الأصوات
  }
  if (!list.isConnected) return;   // غادر وليّ الأمر اللوحة قبل أن تصل

  list.replaceChildren(...(clips.length
    ? clips.map((clip) => clipRow(clip, refresh))
    : [h('p', { class: 'hint' }, 'لا صوت محفوظاً الآن — والمدد أدناه محفوظة.')]));
  tools.replaceChildren(...(clips.length ? [h('button', {
    class: 'btn',
    onclick: async () => {
      recorder.stopPlayback();
      await recordings.clearClips();
      refresh();
    },
  }, '✕ احذف كل التسجيلات')] : []));
}

function dashboard() {
  const letters = progress.studiedLetters();
  const stats = progress.letterStats();
  const mastered = stats.filter((s) => s.mastered);
  const weak = stats.filter((s) => s.struggling);
  const learning = stats.filter((s) => !s.mastered && !s.struggling);
  const due = progress.dueSkills();
  const next = progress.nextNode();
  const today = progress.secondsOn();
  const week = progress.usageDays(7);
  const streak = progress.reviewStreak();
  const tip = recommend({
    letters: letters.length,
    dueCount: due.length,
    secondsToday: today,
    reviewDone: Boolean(progress.reviewOf()),
    next,
  });

  const section = (title, ...children) => [h('h3', {}, title), ...children];
  const emptyNote = (text) => h('p', { class: 'hint' }, text);

  const main = h('main', { class: 'screen-card audit' },
    h('h2', {}, 'لوحة وليّ الأمر'),

    h('div', { class: 'audit-row' },
      pill('اليوم', minutesText(today)),
      pill('هذا الأسبوع', minutesText(week.reduce((s, d) => s + d.seconds, 0))),
      pill('المجموع', minutesText(progress.totalSeconds())),
      pill('النجوم', `${arNum(progress.totalStars())} / ${arNum(progress.maxTotalStars())}`),
      pill('حروف درسها', arNum(letters.length)),
      pill('مراجعات متتابعة', arNum(streak)),
    ),

    ...section('توصية اليوم',
      h('div', { class: 'note', css: { 'text-align': 'start' } },
        h('b', {}, tip.title),
        h('p', { class: 'hint', css: { margin: '.25rem 0 0' } }, tip.body)),
      tip.action && h('div', { class: 'row', css: { 'justify-content': 'flex-start', 'margin-top': '.75rem' } },
        h('button', { class: 'btn btn--primary', onclick: () => go(tip.action.hash) }, tip.action.label))),

    ...section(`الحروف المتقنة (${arNum(mastered.length)})`,
      mastered.length
        ? h('div', { class: 'audit-row' }, mastered.map((s) => letterChip(s, GOOD)))
        : emptyNote('لم يثبت حرف بعدُ — الإتقان يحتاج إصابات متتابعة في أيام متباعدة.')),

    ...section(`الحروف المتعثّرة (${arNum(weak.length)})`,
      weak.length
        ? [h('div', { class: 'audit-row' }, weak.map((s) => letterChip(s, BAD))),
          h('p', { class: 'hint' }, 'هذه تعود في مراجعة اليوم تلقائياً. أعِد معه أصواتها بصوتك أيضاً.')]
        : emptyNote('لا حرف متعثّر — ما أخطأ فيه لم يتكرّر خطؤه.')),

    ...section(`قيد التعلّم (${arNum(learning.length)})`,
      learning.length
        ? h('div', { class: 'audit-row' }, learning.map((s) => letterChip(s, ACCENT)))
        : emptyNote('لا شيء في المنتصف.')),

    ...section('دقائق آخر سبعة أيام',
      h('div', { class: 'audit-row' }, week.map((day) => {
        const d = new Date(`${day.key}T00:00:00`);
        const minutes = Math.round(day.seconds / 60);
        return h('span', {
          class: 'pill',
          css: day.seconds ? { color: 'var(--star-text)' } : { opacity: '.55' },
        }, `${DAY_NAMES[d.getDay()]}: `, h('b', {}, minutes ? arNum(minutes) : '—'));
      })),
      h('p', { class: 'hint' }, 'الزمن يُحسب وقت انتباهه للشاشة فقط (لا يُحسب إن تركها مفتوحة).')),

    ...section('أين هو الآن',
      h('p', { class: 'hint' }, next
        ? `التالي: ${nodeTitle(next)} — ${nodeWhere(next)}.`
        : 'أتمّ كل عقد الخريطة.'),
      h('p', { class: 'hint' },
        `بانتظار التثبيت الآن: ${arNum(due.length)} من ${arNum(progress.skills().length)} مهارة سُجّلت.`)),

    ...section('تسجيلات طفلي', recordingsSection()),

    h('p', { class: 'note' }, 'المهارة = حرف × حركة × نوع تمرين. الخطأ يعيدها إلى مراجعة الغد، والإصابة تُباعد موعدها (١ ← ٢ ← ٤ ← ٨ ← ١٦ يوماً).'),
  );

  return h('div', { class: 'screen', css: { '--accent': ACCENT } },
    topbar(
      h('button', { class: 'btn', onclick: () => go('#/') }, '→ الخريطة'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'pill' }, 'لوحة وليّ الأمر'),
    ),
    main,
  );
}

/** الشاشة: البوابة أولاً، ثم اللوحة — والفتح يبقى ما دامت الصفحة مفتوحة. */
export function renderParent(rerender) {
  if (unlocked) return dashboard();
  return gateScreen(() => {
    unlocked = true;
    rerender();
  });
}

/** لإعادة إغلاق البوابة في الاختبارات. */
export function lockGate() {
  unlocked = false;
}
