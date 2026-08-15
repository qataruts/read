// لوحة وليّ الأمر (METHOD §٦) — خلف بوابة عملية حسابية بسيطة لا يحلّها طفل السادسة:
// أين يتعثّر بالضبط، وكم دقيقة تعلّم، وما توصية اليوم.
//
// الشاشة لا تنطق شيئاً (لا صوت فيها أصلاً)، وتُبنى من نفس مفردات التنسيق القائمة
// (pill · vchip · note · chip) وتُلوَّن بمتغيّر --accent، فلا تحتاج تنسيقاً جديداً.

import * as progress from './progress.js';
import { feedbackSection } from './feedback.js';
import {
  QURAN, SKILLS, muqByKey, muqSkillKey, rasmSignByKey, rasmSigns, rasmSkillKey,
  rootById, skillByMarkKey,
} from './curriculum.js';
import * as recordings from './recordings.js';
import * as recorder from './recorder.js';
import { FADE_AT, BARE_AT, levelOf, fadeText } from './fade.js';
import {
  h, go, toast, arNum, arCount, topbar, letterTitle, nodeTitle, nodeWhere, shake,
} from './ui.js';

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
    if (readNumber(input.value) === q.answer) {
      // بند الحزمة ١١: عند أول بوابةِ وليّ أمر يُطلب التخزين الدائم — فعلُ بالغٍ لا
      // فعلُ طفل، ووراءه نيّةٌ معلَنة (فتحُ لوحته أو الإذن بالتسجيل). ورفضُه لا يعطّل
      // شيئاً، ولا ننتظر جوابه كي لا تتأخّر الشاشة على وليّ الأمر.
      progress.askPersistence();
      return onPass();
    }
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

/**
 * حصيلةُ كل علامةٍ من سجلّها (حزمة «قياس العلامات») — نظيرُ `letterStats` للحروف،
 * وموضعُه هنا لا في `progress.js` لأنه عرضٌ لا قياس: يجمع مفتاحَي الدرس (القراءة
 * والسماع) في بطاقةٍ واحدة باسم الدرس، ويأخذ **أدنى الصندوقين** — فمن أتقن السماع
 * وحده لم يتقن العلامة. دالّة خالصة: السجلّ يُحقَن فتُختبَر بلا متصفّح.
 */
export function markStats(skills) {
  const byMark = new Map();
  for (const s of skills) {
    if (!progress.isMarkSkill(s)) continue;
    const skill = skillByMarkKey(s.letter);
    if (!skill) continue;                      // درسٌ سقط من المنهج: لا بطاقةَ وهمية
    const acc = byMark.get(skill.id)
      || {
        id: skill.id, title: skill.title, face: skill.face,
        right: 0, wrong: 0, box: progress.MAX_BOX, kinds: 0,
      };
    acc.right += s.right;
    acc.wrong += s.wrong;
    acc.box = Math.min(acc.box, s.box);        // أدنى الصندوقين: القراءةُ والسماع معاً
    acc.kinds++;
    byMark.set(skill.id, acc);
  }
  // ترتيبُ المنهج، وحرفا المرحلة القرآنية (`mark-hamza`/`mark-taa`) في آخر القسم —
  // فهما آخرُ ما يدرسه، ولا يُقحَمان بين دروس العلامات الستة.
  const order = SKILLS.map((s) => s.id);
  const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id));
  return [...byMark.values()].sort((a, b) => rank(a.id) - rank(b.id));
}

/**
 * حصيلةُ المرحلة القرآنية من سجلّها (الحكمان ب١ وب٣، جلسة وز٢) — علاماتُ الرسم
 * وفواتحُ السور: لا حرفَ لهما فلا تدخلان لوحةَ الحروف، ومقيستان في ليتنر فيقرؤهما
 * وليُّ الأمر هنا. **بطاقةٌ لكل علامةٍ باسمها** لا بمفتاحها، ودالّةٌ خالصة كأختها.
 */
export function quranStats(skills) {
  const out = [];
  for (const s of skills) {
    const sign = rasmSignByKey(s.letter);
    const muq = sign ? null : muqByKey(s.letter);
    if (!sign && !muq) continue;
    out.push({
      key: s.letter,
      face: sign ? sign.sign : muq.read,
      title: sign ? sign.name : `فواتح ${muq.surah}`,
      right: s.right,
      wrong: s.wrong,
      box: s.box,
    });
  }
  const order = [...rasmSigns().map((s) => rasmSkillKey(s.sign)),
    ...QURAN.muqattaat.items.map((m) => muqSkillKey(m.read))];
  return out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

// ————— «نحو القراءة الحرة» (حزمة الخفوت — ROADMAP §المرحلة ز) —————
//
// وليّ الأمر يرى الشكل يخفت عن كلمات طفله فيسأل: أعطبٌ هذا أم مقصود؟ فهنا جوابُه —
// كم كلمةً بلغت كلَّ درجة، وأمثلةٌ حيّة **كما يراها الطفل بجانب أصلها**، وسطرٌ واحد
// يشرح الفكرة. ولا يُعرض هذا للطفل: عدُّ كلماته العارية ليس سباقاً يُلهيه عن القراءة.

const FADE_EXAMPLES = 12;   // ما يسع سطرين من اللوحة — أمثلةٌ لا جردٌ كامل

/** الكلمة كما يراها الطفل الآن، وتحتها أصلُها مشكولاً — بيانٌ في نظرة. */
function fadedChip(word) {
  return h('span', {
    class: 'vchip',
    css: { '--accent': word.level === 3 ? GOOD : ACCENT },
    title: `${word.key} — ${arCount(word.n, ['قراءة صحيحة', 'قراءتان صحيحتان', 'قراءات صحيحة', 'قراءة صحيحة'])}`,
  },
    h('span', { class: 'vchip-face' }, fadeText(word.key, word.level)),
    h('small', {}, word.key));
}

function fadingSection() {
  const words = progress.wordReads()
    .filter((w) => w.key)
    .map((w) => ({ ...w, level: levelOf(w.n) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
  const bare = words.filter((w) => w.level === 3);
  const partial = words.filter((w) => w.level === 2);
  const onWay = words.filter((w) => w.level === 1);
  const shown = [...bare, ...partial].slice(0, FADE_EXAMPLES);

  return h('div', {},
    h('div', { class: 'audit-row' },
      pill('هيكلٌ بمفاتيحه', arNum(partial.length)),
      pill('عاريةٌ تماماً', arNum(bare.length)),
      pill('في الطريق', arNum(onWay.length)),
    ),
    shown.length
      ? h('div', { class: 'audit-row' }, shown.map(fadedChip))
      : h('p', { class: 'hint' },
        'لم تبلغ كلمةٌ عتبتها بعد — الشكل كاملٌ في كل ما يقرؤه، وهو الصواب في أوّل الطريق.'),
    h('p', { class: 'hint' },
      `الكتب والصحف بلا شكل. فكلُّ كلمةٍ يقرؤها طفلك صحيحةً في ${arNum(FADE_AT)} أيام`
      + ` متباعدة تخفت حركاتُها القصيرة، وفي ${arNum(BARE_AT)} تتعرّى تماماً —`
      + ' لكلِّ كلمةٍ عتبتُها بتاريخه معها وحدها، لا خفوتٌ جماعيّ بيومٍ ولا بمرحلة.'
      + ' وإن تعثّر في كلمةٍ خافتة نقرها فظهر شكلها ثوانيَ، وتراجعت درجتُها فعادت مشكولةً.'),
    h('p', { class: 'note' },
      'ولا يخفت الشكل في التهجّي (المقاطع ودروس الحروف والمهارات) ولا في نصّ المصحف —'
      + ' هناك الشكلُ مادّةُ الدرس لا كسوتَه.'),
  );
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

// ————— «نسخة احتياطية» و«تحكّم في الرحلة» (الحزمة ١١) —————
//
// قسمان لوليّ الأمر وحدَه — خلف بوابته الحسابية كبقية اللوحة، ولا أثر لهما في شاشة
// الطفل. الأول يحمي رحلته من ضياع التخزين وتبديل الجهاز، والثاني يجعل التسلسل
// طوعَ وليّ الأمر: يتخطّى به ما يعرفه الطفل، ويعيد به تدريبَ ما تزعزع.

/**
 * تأكيدٌ صريح **في الصفحة** لا بـ`confirm()` — وهذه الأفعال تكتب فوق رحلة الطفل
 * فلا تقع بنقرةٍ واحدة. ونافذة المتصفّح لا تصلح هنا: أزرارها بلغة الجهاز لا بلغتنا،
 * ولا تتّسع لشرح أثر الفعل — وهنا يُقرأ ما سيقع بالضبط قبل أن يقع.
 */
function askThen(box, { question, body, yes, onYes }) {
  const close = () => box.replaceChildren();
  box.replaceChildren(h('div', { class: 'note confirm' },
    h('b', {}, question),
    body && h('p', { class: 'hint', css: { margin: '.35rem 0 0' } }, body),
    h('div', { class: 'row', css: { 'justify-content': 'flex-start', 'margin-top': '.6rem' } },
      h('button', { class: 'btn btn--primary confirm-yes', onclick: () => { close(); onYes(); } }, yes),
      h('button', { class: 'btn confirm-no', onclick: close }, 'إلغاء')),
  ));
}

const nodesText = (n) => arCount(n, ['عقدة واحدة', 'عقدتين', 'عقد', 'عقدة']);

/** تنزيل ملف النسخة — نصٌّ في `Blob`، بلا شبكةٍ ولا خادم (كل شيء في الجهاز). */
function saveBackupFile() {
  const url = URL.createObjectURL(
    new Blob([progress.backupText()], { type: 'application/json' }));
  const link = h('a', { href: url, download: progress.backupName() });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

/** ما في النسخة بعبارة وليّ الأمر — يُقرأ قبل التأكيد لا بعده. */
function summaryText(sum) {
  return `★ ${arNum(sum.stars)} في ${nodesText(sum.nodes)} · ${skillsText(sum.skills)} مقيسة`
    + (sum.reads ? ` · ${arCount(sum.reads, ['كلمة واحدة', 'كلمتان', 'كلمات', 'كلمة'])} لها تاريخ قراءة` : '')
    + (sum.records ? ` · ${arCount(sum.records, ['قراءة واحدة', 'قراءتان', 'قراءات', 'قراءة'])} مسجَّلة` : '')
    + (sum.savedAt ? ` · حُفظت ${whenText(sum.savedAt)}` : '');
}

/** **بابُ وضع المعاينة — خلف بوابة وليّ الأمر** (أمر المالك، ١٣ أغسطس ٢٠٢٦):
 *
 *  المقيّمُ يحتاج أن يرى المحطات كلَّها، والطفلُ يحتاج ألّا يقفز إلى ما لم يبلغه.
 *  ولو وُضع الزرُّ في شاشة الطفل لَفتحه بنفسه ولو باللمس العابر — **فموضعُه هذه
 *  اللوحة**: هي محميّةٌ سلفاً بمسألةِ ضربٍ يعجز عنها طفلُ السادسة، وزرُّها ظاهرٌ
 *  أعلى الخريطة. فالتحقّقُ من أنّ المستعمل ليس الطفل قائمٌ بالبناء لا بزرٍّ ثانٍ.
 *
 *  ولا يكتب شيئاً: المعاينةُ تفتح القفلَ وحدَه، ويقول شريطُها ذلك في أعلى الشاشة. */
function previewSection() {
  return h('div', {},
    h('p', { class: 'hint' },
      'تفتح المحطاتِ كلَّها للاطّلاع — درساً وبستاناً وقصةً وسورة — '
      + '**ولا يُحفَظ أيُّ تقدّم**: تُغلق الصفحةَ فيعود الجهازُ كما كان.'
      .replace(/\*\*/g, '')),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn btn--primary',
        onclick: () => { location.href = `${location.pathname}?preview=1`; },
      }, 'افتح وضع المعاينة')),
    h('p', { class: 'note' },
      'وهو للمعلّم أو وليّ الأمر يقيّم التطبيق — لا للطفل: القفلُ التسلسليّ'
      + ' (لا يُعرض عليه ما لم يبلغه) من أسس المنهج لا قيدٍ عليه.'),
  );
}

function backupSection(rerender) {
  const slot = h('div', { class: 'confirm-slot' });
  const storage = h('p', { class: 'hint' }, 'التخزين على هذا الجهاز: جارٍ الفحص…');
  // سطرُ الأصوات المخزونة (حزمة «خفّة التخزين»): كان إخفاقُ الخزن يُبتلَع صامتاً —
  // ومنه تجاوزُ حصة التخزين على الأجهزة الأقدم — فتنقص ملفاتٌ ولا يعلم أحد، ثم يصمت
  // الصوت في الطائرة أو في السيارة. فالعدد معروضٌ لوليّ الأمر: يرى النقص قبل أن يفاجئه.
  /* **حالُ التحميل تُرى وتُدار** (أمر المالك، ١٣ أغسطس ٢٠٢٦: «يجب أن نُظهر التحميل
     ليتأكّد المستعمل أنّ التحميلات جاهزة… وأن تكون هناك طريقة لمتابعة التحميل أو
     إعادته»): كان الخزنُ يجري صامتاً فلا يعرف أحدٌ أتمَّ أم لا — حتى فُتح التطبيقُ
     بلا شبكةٍ فصمت الصوت، وظُنّ العيبُ في البرنامج. فصار السطرُ **شريطاً حيّاً**
     يتحرّك مع كل دفعة، ومعه **زرٌّ يبدأ التحميل الآن** بدل انتظار مهلة الشفاء. */
  const cached = h('p', { class: 'hint' });
  const bar = h('div', { class: 'dl-bar' }, h('span', { class: 'dl-fill' }));
  const fill = bar.firstChild;
  const dlBtn = h('button', { class: 'btn', onclick: () => askSync() }, 'نزّل الأصوات الآن');
  const dlRow = h('div', { class: 'dl' }, cached, bar, dlBtn);

  const paint = (stored, total, busy) => {
    if (!cached.isConnected || !total) return;
    const pct = Math.min(100, Math.round((stored / total) * 100));
    fill.style.width = `${pct}%`;
    bar.classList.toggle('dl-bar--done', stored >= total);
    const head = `الأصوات المخزونة: ${arNum(stored)} من ${arNum(total)} (${arNum(pct)}٪)`;
    cached.textContent = stored >= total
      ? `${head} — كلُّها على الجهاز، فيعمل التطبيق بلا إنترنت.`
      : busy
        ? `${head} — يُنزَّل الآن، أبقِ التطبيق مفتوحاً.`
        : `${head} — ما نقص يُجلَب عند سماعه، ويكتمل حين يُفتح التطبيق متصلاً.`;
    dlBtn.hidden = stored >= total;
    dlBtn.textContent = busy ? 'يُنزَّل…' : 'نزّل الأصوات الآن';
    dlBtn.disabled = Boolean(busy);
  };

  /** طلبٌ صريح إلى عامل الخدمة — هو وحده يملك المخزن. */
  const askSync = () => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return void toast('التحميل يبدأ بعد تثبيت التطبيق');
    sw.postMessage({ type: 'audio-sync' });
    dlBtn.disabled = true;
    dlBtn.textContent = 'يُنزَّل…';
  };

  // بلاغاتُ العامل بعد كل دفعة — فالشريطُ يتحرّك بما يجري لا بتقديرٍ منّا
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'audio-progress') paint(e.data.stored, e.data.total, e.data.busy);
  });

  progress.audioStored().then((count) => {
    if (count) paint(count.stored, count.total, false);
  });

  // **رقمُ النسخة تحت حال التخزين** (أمر المالك): سطرٌ هادئ يقرؤه الوالد فيعرف
  // أنّ التحديث بلغ جهازَه — ومن قبله كان يُظنّ ولا يُرى.
  const version = h('p', { class: 'note', id: 'app-version' }, 'نسخة التطبيق: …');
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'version' && version.isConnected) {
      version.textContent = `نسخة التطبيق: ${e.data.version}`;
      version.dataset.v = e.data.version;      // تقرؤه «بلِّغنا» فيدخل السياقَ
    }
  });
  const askVersion = () => {
    const sw = navigator.serviceWorker?.controller;
    if (sw) sw.postMessage({ type: 'version' });
    else version.textContent = 'نسخة التطبيق: تظهر بعد تثبيته (يعمل العاملُ حينها)';
  };
  askVersion();

  progress.persistedStorage().then((persisted) => {
    if (!storage.isConnected) return;
    storage.textContent = persisted === null
      ? 'هذا المتصفّح لا يعلن حال تخزينه — والنسخة الاحتياطية تكفيك مؤونته.'
      : persisted
        ? 'تخزين هذا الجهاز موسومٌ دائماً: لا يخليه المتصفّح عند ضيق المساحة.'
        : 'لم يسم المتصفّح تخزين التطبيق دائماً بعدُ — قد يُخليه عند ضيق المساحة،'
          + ' فاحتفظ بنسخةٍ حديثة. (تثبيت التطبيق على الشاشة الرئيسية يرجّح تثبيته.)';
  });

  const file = h('input', {
    type: 'file',
    accept: '.json,application/json',
    class: 'file-pick',
    'aria-label': 'اختر ملف نسخةٍ لاستعادته',
    onchange: async (event) => {
      const chosen = event.target.files?.[0];
      if (!chosen) return;
      const read = progress.readBackup(await chosen.text());
      file.value = '';                       // كي يقبل اختيار الملف نفسه ثانيةً
      if (read.error) {
        slot.replaceChildren(h('p', { class: 'note note--bad' }, read.error));
        return;
      }
      const sum = progress.backupSummary(read.bundle);
      askThen(slot, {
        question: 'استعادة هذه النسخة؟',
        body: `فيها: ${summaryText(sum)}. وستحلّ محلّ ما في هذا الجهاز الآن`
          + ` (${summaryText(progress.backupSummary(progress.backup()))}) — فلا رجعة بعدها.`,
        yes: 'استعِد الآن',
        onYes: () => {
          if (!progress.restore(read.bundle)) {
            slot.replaceChildren(h('p', { class: 'note note--bad' }, 'تعذّرت الاستعادة.'));
            return;
          }
          toast('استُعيد تقدّم طفلك');
          rerender();
        },
      });
    },
  });

  return h('div', {},
    h('p', { class: 'hint' },
      'تقدّم طفلك محفوظ في هذا الجهاز وحده — لا حساب ولا سحابة. فاحفظ نسخةً بين'
      + ' حينٍ وآخر: ملفٌّ صغير يعيد رحلته كما هي إن حذفتَ التطبيق أو بدّلتَ الجهاز.'),
    h('div', { class: 'row', css: { 'justify-content': 'flex-start' } },
      h('button', {
        class: 'btn btn--primary backup-save',
        onclick: () => { saveBackupFile(); toast('حُفظت نسخةُ التقدّم'); },
      }, 'انسخ تقدّم طفلي'),
      // الملصق زرٌّ بحقّ: يُفتح باللمس وبالفأرة **وبلوحة المفاتيح** — ومدخلُ الملف
      // مخفيٌّ فيه لأن مظهره الأصليّ نصٌّ بلغة الجهاز لا بلغة اللوحة.
      h('label', {
        class: 'btn file-label',
        role: 'button',
        tabindex: '0',
        onkeydown: (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          file.click();
        },
      }, 'استعِد من ملف', file),
    ),
    slot,
    storage,
    version,
    dlRow,
    h('p', { class: 'note' },
      'في النسخة: النجوم وصناديق المراجعة ودقائق التعلّم ومدد قراءاته الجهرية'
      + ' وتاريخ خفوت كلماته. وليس فيها تسجيلات صوته — تلك لا تغادر جهازه أبداً.'),
  );
}

/** اسم المحطة كما يقرؤه وليّ الأمر في قائمة الاختيار. */
function sectionLabel(section, index) {
  const name = section.kind === 'gate' ? section.gate.title
    : section.kind === 'contrast' ? section.contrast.title
      : nodeWhere(section.nodes[0]);
  // شرطةٌ لا نقطةٌ فاصلة: النقطة تجاور الرقم المشرقيّ في الاتجاهين فتُقرأ صفراً ملتصقاً به
  return `${arNum(index + 1)} — ${name}`;
}

function journeySection(rerender) {
  const sections = progress.journey();
  const next = progress.nextNode();
  const here = sections.findIndex((s) => s.nodes.some((n) => n.id === next?.id));

  // ١) تخطٍّ للأمام: القفل التسلسلي طوعُ وليّ الأمر — لطفلٍ يعرف حروفه أصلاً
  const nodePick = h('select', { class: 'chip pick', 'aria-label': 'العقدة التي يُفتح الطريق إليها' },
    sections.map((section, i) => h('optgroup', { label: sectionLabel(section, i) },
      section.nodes.map((node) => h('option', { value: node.id }, nodeTitle(node))))));
  if (next) nodePick.value = next.id;
  const openSlot = h('div', { class: 'confirm-slot' });

  const openBtn = h('button', {
    class: 'btn open-to',
    onclick: () => {
      const node = progress.findNode(nodePick.value);
      const count = progress.pendingBefore(nodePick.value);
      if (!node) return;
      if (!count) { toast('هذه مفتوحة له أصلاً'); return; }
      askThen(openSlot, {
        question: `تفتح الطريق إلى «${nodeTitle(node)}»؟`,
        body: `${nodesText(count)} قبلها ستُعدّ منجَزةً بنجمةٍ واحدة — تبقى مفتوحةً`
          + ' يلعبها متى شاء، ولا تُنقَص نجمةٌ كسبها. والقياس لا يتغيّر: لم يُمتحن فيها بعد.',
        yes: 'افتح الطريق',
        onYes: () => {
          toast(`فُتحت ${nodesText(progress.unlockUpTo(node.id))}`);
          rerender();
        },
      });
    },
  }, 'افتح الطريق إلى هنا');

  // ٢) إعادة التدريب: تصفير محطةٍ بعينها — نجومُها وحدها، وسجلّ ليتنر لا يُمسّ
  const sectionPick = h('select', { class: 'chip pick', 'aria-label': 'المحطة التي تُصفَّر' },
    sections.map((section, i) => h('option', { value: section.id }, sectionLabel(section, i))));
  if (here >= 0) sectionPick.value = sections[here].id;
  const resetSlot = h('div', { class: 'confirm-slot' });

  const resetBtn = h('button', {
    class: 'btn reset-section',
    css: { color: 'var(--err-text)' },
    onclick: () => {
      const index = sections.findIndex((s) => s.id === sectionPick.value);
      const section = sections[index];
      const info = progress.sectionProgress(sectionPick.value);
      if (!section || !info) return;
      if (!info.done) { toast('لم يبدأ هذه المحطة بعد'); return; }
      askThen(resetSlot, {
        question: `تصفّر محطة «${sectionLabel(section, index)}» ليعيدها؟`,
        body: `${nodesText(info.done)} فيها تعود إلى أولها و${arNum(info.stars)} نجمة تسقط،`
          + ' ويُقفل ما بعدها حتى يتمّها من جديد — ونجومُه هناك محفوظة تعود كما كانت.'
          + ' أما سجلّ مهاراته ودقائق تعلّمه وتسجيلاته فلا يمسّها التصفير.',
        yes: 'صفِّر المحطة',
        onYes: () => {
          toast(`صُفِّرت ${nodesText(progress.clearSection(section.id))}`);
          rerender();
        },
      });
    },
  }, 'صفِّر هذه المحطة');

  return h('div', {},
    h('p', { class: 'hint' },
      'الرحلة مقفلة بالتسلسل: لا تُفتح عقدةٌ قبل ما قبلها. وهنا تتجاوز القفل إن كان'
      + ' طفلك يعرف ما قبله، أو تعيد محطةً كاملة إن رأيت أن يعيد تدريبها.'),
    h('div', { class: 'row parent-tool' }, nodePick, openBtn),
    openSlot,
    h('div', { class: 'row parent-tool' }, sectionPick, resetBtn),
    resetSlot,
  );
}

function dashboard(rerender = () => {}) {
  const letters = progress.studiedLetters();
  const stats = progress.letterStats();
  const roots = progress.skills()
    .filter((s) => s.kind === progress.KINDS.ROOT)
    .map((s) => ({ ...s, title: rootById(String(s.letter).replace(/^root-/, ''))?.title || s.letter }))
    .filter((s) => s.title);
  // **العلامات صفٌّ إلى جوار الحروف**: مفتاحان لكل درس (قراءةً وسماعاً) يُجمعان في
  // بطاقةٍ واحدة — فوليّ الأمر يقرأ «الشدّة» لا «mark-shadda|none|mark-quiz» مرتين.
  const marks = markStats(progress.skills());
  const quran = quranStats(progress.skills());
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

    // **العلاماتُ صفٌّ إلى جوار الحروف** (حزمة «قياس العلامات»): كانت هذه أصعبَ ما
    // في فكّ الشيفرة وأخفاه عن وليّ الأمر — يدرسها الطفل ولا يُقاس منها حرفٌ واحد،
    // فتمرّ البوابةُ واللوحةُ عمياوين عنها. وهي علامةٌ لا حرف، فقسمُها مستقلّ.
    ...section(`العلامات (${arNum(marks.length)})`,
      marks.length
        ? [h('div', { class: 'audit-row' }, marks.map((s) => h('span', {
          class: 'vchip',
          css: { '--accent': s.box >= progress.MASTERED_BOX ? GOOD : s.wrong >= 2 ? BAD : ACCENT },
          title: `${s.title} — ${arNum(s.right)} صواب، ${arNum(s.wrong)} خطأ`,
        },
          h('span', { class: 'vchip-face' }, s.face),
          h('small', {}, `${s.title} · ${arNum(s.right)} ✓ · ${arNum(s.wrong)} ✗`)))),
          h('p', { class: 'hint' },
            'المدّ والسكون والشدّة والتنوين واللام: تُقاس مرّتين — أن يقرأ العلامة بعينه '
            + 'وأن يميّزها بأذنه، واللون لأدنى الاثنين. والهمزةُ والتاء المربوطة '
            + 'قراءةً بالعين وحدها (درسُهما في المرحلة القرآنية).')]
        : emptyNote('لم يبلغ درس علامةٍ بعدُ — أوّلها مدّ الألِف بعد المجموعة الأولى.')),

    // **المرحلة القرآنية تُقرأ كما تُقرأ الحروف** (الحكمان ب١ وب٣، جلسة وز٢): كانت
    // تدرّس ولا تقيس، فاللوحةُ عمياء عن علامات المصحف وفواتح السور — وهي مهاراتُ فكّ
    // شيفرةٍ صريحة لا تلاوةً معفاة. والحرفان (الهمزةُ والتاء) في قسم العلامات أعلاه.
    ...section(`رسمُ المصحف (${arNum(quran.length)})`,
      quran.length
        ? [h('div', { class: 'audit-row' }, quran.map((s) => h('span', {
          class: 'vchip',
          css: { '--accent': s.box >= progress.MASTERED_BOX ? GOOD : s.wrong >= 2 ? BAD : ACCENT },
          title: `${s.title} — ${arNum(s.right)} صواب، ${arNum(s.wrong)} خطأ`,
        },
          h('span', { class: 'vchip-face' }, s.face),
          h('small', {}, `${s.title} · ${arNum(s.right)} ✓ · ${arNum(s.wrong)} ✗`)))),
          h('p', { class: 'hint' },
            'علاماتُ المصحف الصغيرة وفواتحُ السور: يراها في كل صفحة، فتُقاس كما تُقاس '
            + 'حروفُه — والنصُّ نفسُه يُتلى ولا يُمتحَن.')]
        : emptyNote('لم يبلغ رسم المصحف بعدُ — موضعُه في المرحلة القرآنية.')),

    // **الجذور قسمٌ خاصٌّ بها**: العائلةُ ليست حرفاً، فلا تدخل لوحةَ الحروف (وإلا ظهر
    // «حرفٌ» اسمُه `root-katb`)، ولكنها مقيسةٌ في ليتنر كسائر المهارات فتُقرأ هنا.
    ...section(`عائلات الجذور (${arNum(roots.length)})`,
      roots.length
        ? [h('div', { class: 'audit-row' }, roots.map((s) => h('span', {
          class: 'vchip vchip--tag',
          css: { '--chip': s.box >= progress.MASTERED_BOX ? GOOD : s.wrong >= 2 ? BAD : ACCENT },
          title: `${s.title} — ${arNum(s.right)} صواب، ${arNum(s.wrong)} خطأ`,
        }, s.title))),
          h('p', { class: 'hint' },
            'الوعي الصرفي: أن يعرف أن «كَاتِب» و«مَكْتَب» و«مَكْتَبَة» من أصلٍ واحد '
            + '— من أقوى ما يسرّع القراءة في العربية.')]
        : emptyNote('لم يبلغ شجرةً بعدُ — تُفتح حين يدرس ثلاث كلمات من أسرةٍ واحدة.')),

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

    ...section('نحو القراءة الحرة', fadingSection()),

    ...section('تسجيلات طفلي', recordingsSection()),

    ...section('نسخة احتياطية من تقدّمه', backupSection(rerender)),

    ...section('تحكّم في الرحلة', journeySection(rerender)),

    ...section('معاينةُ التطبيق كلِّه', previewSection()),

    ...section('بلِّغنا عن خطأ أو اقتراح', feedbackSection()),

    h('p', { class: 'note' }, 'المهارة = حرف × حركة × نوع تمرين — وللعلامات والعائلات الصرفية مهاراتُها كذلك بلا حرف. الخطأ يعيدها إلى مراجعة الغد، والإصابة تُباعد موعدها (١ ← ٢ ← ٤ ← ٨ ← ١٦ يوماً).'),
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
  if (unlocked) return dashboard(rerender);
  return gateScreen(() => {
    unlocked = true;
    rerender();
  });
}

/** لإعادة إغلاق البوابة في الاختبارات. */
export function lockGate() {
  unlocked = false;
}
