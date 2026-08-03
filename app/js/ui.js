// أدوات واجهة مشتركة بين الشاشات (بلا إطار عمل): بناء DOM، أرقام عربية، رسائل عابرة.
// لا تلمس هذه الوحدة الـDOM وقت التحميل، فتبقى قابلة للاستيراد في اختبارات node.

import { GROUPS, LETTERS, QURAN } from './curriculum.js';

export const DEV = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('dev') === '1';

// ألوان المراحل — مصدر الحقيقة الوحيد للقيم في لوح `docs/DESIGN.md` §٢ (متغيرات CSS):
// لون واحد مطفأ يميز كل مرحلة، والمشهد يتغيّر بمعالم المحطات لا بصراخ الألوان.
export const ACCENTS = ['var(--accent-letters)'];

/** لون محطات ما بين المجموعات (دروس المهارات) — يميّزها عن محطات الحروف. */
export const PAUSE_ACCENT = 'var(--accent-skills)';

/** لون شاشات القصص (طيني دافئ) — عقدها تسكن محطة المهارات وتحمل لونها الخاص. */
export const STORY_ACCENT = 'var(--accent-stories)';

/** لون المرحلة القرآنية — أخضر مصحفي يميّز خاتمة الرحلة عن كل ما قبلها. */
export const QURAN_ACCENT = 'var(--accent-quran)';

/** لون بساتين المعجم — زيتوني ناعم. */
export const GARDEN_ACCENT = 'var(--accent-garden)';

/**
 * لون «سلّم الجمل» — لون القصص نفسُه (طيني دافئ): الجملة والقصة قراءةٌ متصلة واحدة،
 * والسلّم مدخلها. ولا لون جديد في اللوح (DESIGN §٢) — يميّزه معلمُ محطته لا صراخُ لونه.
 */
export const SENTENCE_ACCENT = 'var(--accent-stories)';

export const accentFor = () => ACCENTS[0];

export const accentForGarden = () => GARDEN_ACCENT;

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

/**
 * صياغة المعدود بالعربية الصحيحة: [مفرد، مثنى، جمع قلة (٣–١٠)، مفرد منصوب (١١+)].
 * الشاشة يقرؤها وليّ أمر عربي — «٨ دقيقة» غلط لا يليق بتطبيق يعلّم العربية.
 */
export function arCount(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${arNum(n)} ${few}`;
  return `${arNum(n)} ${many}`;
}

/** اسم الحرف كما يُقرأ في العناوين: «حرف باء». */
export const letterTitle = (ch) => `حرف ${LETTERS[ch]?.name ?? ch}`;

/**
 * الكلمة كما تُعرض للطفل. الأصل تركيب مقاطعها المشكولة، إلا أن يكون لها نصٌّ معروض
 * خاصّ (كلمات المعجم: تُكتب «سُكَّرْ» وتُتهجّى «سُ+كْ+كَ+رْ» — فالمعروض غير التهجّي).
 */
export const wordText = (word) => word.text ?? word.tiles.join('');

/** اسم عقدة الخريطة كما يُعرض للطفل ولوليّ أمره (حرف · لعبة · مهارة · قصة · قرآن · باقة). */
export function nodeTitle(node) {
  if (node.type === 'letter') return letterTitle(node.letter);
  if (node.type === 'words') return 'لعبة الكلمات';
  if (node.type === 'skill') return node.skill.title;
  if (node.type === 'story') return `قصة «${node.story.title}»`;
  if (node.type === 'quran') return node.title;
  if (node.type === 'gate') return node.gate.title;
  if (node.type === 'garden') return `باقة ${arNum(node.bundle.index)} — ${node.garden.title}`;
  if (node.type === 'ladder') return `جمل ${node.garden.title} — درجة ${arNum(node.rung.index)}`;
  if (node.type === 'library') return `قصة «${node.story.title}»`;
  return '';
}

/** موضع العقدة في الرحلة: اسم مجموعتها، أو محطة ما بين المجموعتين، أو الخاتمة، أو بستانها. */
export function nodeWhere(node) {
  if (node.type === 'letter' || node.type === 'words') {
    return GROUPS.find((g) => g.id === node.groupId)?.title ?? '';
  }
  if (node.type === 'quran') return QURAN.title;
  if (node.type === 'gate') return 'بوابة الإتقان';
  if (node.type === 'garden') return `بستان ${node.garden.title}`;
  if (node.type === 'ladder') return `سلّم جمل ${node.garden.title}`;
  if (node.type === 'library') return `مكتبة ${node.garden.title}`;
  return 'محطة المهارات والقصص';
}

/** وجه العقدة على الخريطة: الحرف نفسه، أو رمز يدلّ على نوعها. */
export function nodeFace(node) {
  if (node.type === 'letter') return node.letter;
  if (node.type === 'words') return '🧩';
  if (node.type === 'skill') return node.skill.face;
  if (node.type === 'story') return node.story.emoji;
  if (node.type === 'quran') return node.face;
  if (node.type === 'gate') return node.gate.face;
  if (node.type === 'garden') return node.garden.emoji;
  if (node.type === 'ladder') return '📖';
  if (node.type === 'library') return node.story.emoji;
  return '';
}

// ————— بناء DOM —————

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'css') for (const [k, v] of Object.entries(value)) el.style.setProperty(k, v);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(2)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

let toastTimer = 0;
export function toast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

export function go(hash) {
  location.hash = hash;
}

export function topbar(...extra) {
  return h('header', { class: 'topbar' }, extra);
}

export function starsRow(count, className = 'node-stars') {
  return h('span', { class: className, 'aria-hidden': 'true' },
    [0, 1, 2].map((i) => h('span', { class: i < count ? 'on' : '' }, i < count ? '★' : '☆')));
}

// ————— عناصر الهوية (DESIGN §٦): الشخصية المرشدة ومعالم المحطات — SVG مضمّن لا صور نقطية —————

// «نوري» — عصفور مرشد بسيط بعيون، ألوانه من لوح التصميم نفسه (متغيرات CSS داخل SVG).
const MASCOT_SVG = `
<svg viewBox="0 0 64 64" role="img">
  <ellipse cx="32" cy="58" rx="14" ry="3" fill="var(--ink)" opacity=".08"/>
  <circle cx="32" cy="34" r="21" fill="var(--star)"/>
  <circle cx="32" cy="34" r="21" fill="none" stroke="var(--ink)" stroke-width="2" opacity=".25"/>
  <ellipse cx="32" cy="42" rx="12" ry="9" fill="var(--card)"/>
  <path d="M13 34q-7 2-9 8 7 1 11-2z" fill="var(--star)" stroke="var(--ink)" stroke-width="1.5" opacity=".9"/>
  <path d="M51 34q7 2 9 8-7 1-11-2z" fill="var(--star)" stroke="var(--ink)" stroke-width="1.5" opacity=".9"/>
  <circle cx="25" cy="28" r="5.5" fill="var(--card)"/>
  <circle cx="39" cy="28" r="5.5" fill="var(--card)"/>
  <circle cx="26" cy="29" r="2.6" fill="var(--ink)"/>
  <circle cx="38" cy="29" r="2.6" fill="var(--ink)"/>
  <circle cx="26.9" cy="28.1" r=".9" fill="var(--card)"/>
  <circle cx="38.9" cy="28.1" r=".9" fill="var(--card)"/>
  <path d="M32 33l-3.5 4h7z" fill="var(--accent-stories)"/>
  <path d="M28 12q4-6 4 0 0-6 4 0" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" opacity=".55"/>
</svg>`;

/** الشخصية المرشدة — تظهر في بدايات الدروس والاحتفالات (لا تظهر في شاشات السور). */
export function mascot(className = 'mascot') {
  const el = h('span', { class: className, 'aria-hidden': 'true' });
  el.innerHTML = MASCOT_SVG;
  return el;
}

// معلم بصري لكل نوع محطة: بيت الحروف، جسر المهارات، قبة القرآنية، بستان المعجم، سلّم الجمل.
const LANDMARKS = {
  house: '<path d="M10 44V26L28 10l18 16v18" /><path d="M22 44V33h10v11" /><path d="M6 26L28 7l22 19" />',
  bridge: '<path d="M6 42h52" /><path d="M12 42v-9M52 42v-9" /><path d="M8 36q24-24 48 0" /><circle cx="50" cy="16" r="6" /><path d="M50 22v20" />',
  dome: '<path d="M32 8q13 9 13 19v15H19V27q0-10 13-19z" /><path d="M32 8V4" /><circle cx="32" cy="3" r="1.6" /><path d="M10 42V22l3-7 3 7v20" /><path d="M15 42h38" />',
  garden: '<path d="M8 44h48" /><circle cx="18" cy="36" r="8" /><circle cx="46" cy="34" r="10" /><path d="M32 44V28" /><circle cx="32" cy="24" r="4.5" /><path d="M32 34q-5-1-7-5M32 38q5-1 7-5" />',
  ladder: '<path d="M20 46V6M44 46V6" /><path d="M20 38h24M20 30h24M20 22h24M20 14h24" /><path d="M10 46h44" />',
  // المكتبة: كتابٌ مفتوح على منضدة — معلمُ محطة القصص المؤلَّفة
  book: '<path d="M32 16v26" /><path d="M32 16q-9-6-22-4v26q13-2 22 4" /><path d="M32 16q9-6 22-4v26q-13-2-22 4" /><path d="M8 44h48" />',
  // البوابة: قوسٌ على عمودين ومصراعاه — معلمُ محطة الإتقان قبل المفاصل الكبرى
  gate: '<path d="M6 44h52" /><path d="M13 44V25a19 19 0 0 1 38 0v19" /><path d="M32 44V6" /><path d="M22 44V27a10 10 0 0 1 20 0v17" />',
};

// ميكروفون «اقرأ لي» (الحزمة ١٠): شكلٌ هندسيّ لا إيموجي (DESIGN §٦)، يتبع لون زرّه.
const MIC_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" role="img">
  <rect x="9" y="2" width="6" height="11" rx="3"/>
  <path d="M5 11a7 7 0 0 0 14 0"/>
  <path d="M12 18v3"/><path d="M9 21h6"/>
</svg>`;

/** أيقونة الميكروفون — زرُّ القراءة الجهرية في شاشة القصة. */
export function micIcon() {
  const el = h('span', { class: 'mic-icon', 'aria-hidden': 'true' });
  el.innerHTML = MIC_SVG;
  return el;
}

// ————— توسيط الحرف البطل في صندوقه (بلاغ المالك ٦ أغسطس ٢٠٢٦) —————

/**
 * انزياح مركز حبر النصّ عن مركز سطره، بوحدة `em` فيصلح لكل مقاس.
 *
 * الخطّ العربي يُجلس الحرف على خطّ أساسٍ لا في وسط سطره: مع `line-height: 1` يقع خطّ
 * الأساس أسفلَ مركز السطر بمقدار `(صعود − هبوط) ÷ ٢` من مقاييس الخط، ثم يتوزّع حبرُ
 * الحرف حول خطّ الأساس بحسب جِرمه — فألفٌ صاعدة تعلو المركز، وباءٌ منقوطةٌ تحت تهبط
 * عنه، وميمٌ نازلة أشدّ هبوطاً. فالتوسيط الهندسي وحده يكذب على العين، والصادق أن
 * يُرفع كلُّ حرفٍ بمقدار انزياح حبره هو.
 *
 * موجبُ الناتج يعني أن الحبر يجلس **تحت** المركز، فالرفعة سالبُه.
 */
const LIFT_PROBE = 200;                       // مقاس قياسٍ ثابت: النسبة واحدة في كل الأحجام
const liftCache = new Map();
let liftCtx;

export function inkLift(text, family = 'Noto Naskh Arabic') {
  const key = `${family}|${text}`;
  if (liftCache.has(key)) return liftCache.get(key);
  let em = 0;
  try {
    liftCtx ??= document.createElement('canvas').getContext('2d');
    liftCtx.font = `${LIFT_PROBE}px "${family}", serif`;
    liftCtx.textBaseline = 'alphabetic';
    const m = liftCtx.measureText(text);
    const base = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    const ink = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    if (Number.isFinite(base + ink)) em = (base + ink) / LIFT_PROBE;
  } catch {
    em = 0;                                   // متصفّح بلا canvas: توسيطٌ هندسيّ كما كان
  }
  liftCache.set(key, em);
  return em;
}

/**
 * حبرُ الصندوق الكبير: نصٌّ مرفوعٌ إلى مركز الصندوق بصرياً.
 *
 * والقياس يُعاد مرةً واحدة بعد وصول الخطّ (`font-display: swap` يرسم بخطٍّ احتياطيّ
 * أولاً، ومقاييسه غير مقاييس النسخ) — فلا يُثبَّت على الشاشة رقمُ خطٍّ ليس المعروض.
 */
export function giantInk(text) {
  const span = h('span', { class: 'giant-ink' }, text);
  const apply = () => span.style.setProperty('--letter-lift', `${(-inkLift(text)).toFixed(4)}em`);
  apply();
  const fonts = typeof document !== 'undefined' && document.fonts;
  if (fonts && !fonts.check(`${LIFT_PROBE}px "Noto Naskh Arabic"`)) {
    fonts.ready.then(() => { liftCache.clear(); apply(); });
  }
  return span;
}

/**
 * خطوةٌ بطلُها صندوقٌ كبير: شقٌّ للبطل وشقٌّ لعُدّته.
 *
 * في الوضع الطولي — وهو المرجع الأول — الشقّان `display: contents` فيذوبان، ويبقى
 * الترتيب على الشاشة كما كان حرفاً بحرف. وفي الوضع العرضيّ القصير وحدَه يصطفّان
 * جنباً إلى جنب فتسع الخطوةُ الشاشةَ بلا سحب (بلاغ المالك ٦ أغسطس ٢٠٢٦، `app.css`).
 */
export const heroStep = (hero, rest) => h('div', { class: 'hero-step' },
  h('div', { class: 'hero-side' }, hero),
  h('div', { class: 'hero-rest' }, rest),
);

/** معلم المحطة على الخريطة — زخرفة صامتة بلون المرحلة (DESIGN §٦). */
export function landmark(kind) {
  if (!LANDMARKS[kind]) return null;
  const el = h('span', { class: 'station-mark', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 64 48" fill="none" stroke="var(--accent)"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${LANDMARKS[kind]}</svg>`;
  return el;
}

/** هزّة قصيرة تنبّه الطفل إلى خطأ دون كلام. */
export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;   // إعادة تشغيل الحركة
  el.classList.add('shake');
}

/**
 * وثبة قصيرة تحتفي بالصواب دون كلام — بديل الصوت في التمارين السماعية:
 * الإجابة الصحيحة هناك لا تُعاد قراءتها (DESIGN §٥.٢)، فيبقى للمسة أثرٌ يتحرّك.
 */
export function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;   // إعادة تشغيل الحركة
  el.classList.add('pop');
}

// ————— عشوائية (قابلة للحقن في الاختبارات) —————

export function shuffle(list, rnd = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];
