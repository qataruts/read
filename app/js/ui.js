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
  if (node.type === 'contrast') return node.contrast.title;
  if (node.type === 'roots') return `شجرة ${node.root.title}`;
  if (node.type === 'garden') return `باقة ${arNum(node.bundle.index)} — ${node.garden.title}`;
  if (node.type === 'ladder') return `جمل ${node.garden.title} — درجة ${arNum(node.rung.index)}`;
  if (node.type === 'library' || node.type === 'shelf') return `قصة «${node.story.title}»`;
  return '';
}

/** موضع العقدة في الرحلة: اسم مجموعتها، أو محطة ما بين المجموعتين، أو الخاتمة، أو بستانها. */
export function nodeWhere(node) {
  if (node.type === 'letter' || node.type === 'words') {
    return GROUPS.find((g) => g.id === node.groupId)?.title ?? '';
  }
  if (node.type === 'quran') return QURAN.title;
  if (node.type === 'gate') return 'بوابة الإتقان';
  if (node.type === 'contrast') return 'محطة ميّز بين';
  if (node.type === 'roots') return 'شبكات الجذور';
  if (node.type === 'garden') return `بستان ${node.garden.title}`;
  if (node.type === 'ladder') return `سلّم جمل ${node.garden.title}`;
  if (node.type === 'library') return `مكتبة ${node.garden.title}`;
  if (node.type === 'shelf') return 'رفّ المكتبة';
  return 'محطة المهارات والقصص';
}

/**
 * وجه العقدة على الخريطة: الحرف نفسه، أو رمز يدلّ على نوعها.
 *
 * ووجها «لعبة الكلمات» و«سلّم الجمل» أيقونتانا الخطيتان لا إيموجي (مهمة «أيقونات
 * لا إيموجي»): لا بيانَ لهما في المنهج — هما تسميةُ نوعِ محطةٍ من صنع الواجهة،
 * ولغةُ الواجهة عندنا SVG خطيّ كمعالم المحطات وأيقونة الميكروفون.
 */
export function nodeFace(node) {
  if (node.type === 'letter') return node.letter;
  if (node.type === 'words') return icon('puzzle');
  if (node.type === 'skill') return node.skill.face;
  if (node.type === 'story') return node.story.emoji;
  if (node.type === 'quran') return node.face;
  if (node.type === 'gate') return node.gate.face;
  if (node.type === 'contrast') return node.contrast.face;
  if (node.type === 'roots') return icon('roots');   // أيقونتُنا الخطية لا إيموجي
  if (node.type === 'garden') return node.garden.emoji;
  if (node.type === 'ladder') return icon('book');
  if (node.type === 'library' || node.type === 'shelf') return node.story.emoji;
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
/** رسالةٌ عابرة — ومعها أيقونةُ واجهةٍ اختيارية (لا محرفَ إيموجي في نصّها). */
export function toast(message, iconName) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.replaceChildren(...[iconName && icon(iconName), message].filter(Boolean));
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

// اسمُ التطبيق ورسمُ علامته: مشكولٌ بالكامل بقرار المالك (٨ أغسطس ٢٠٢٦) — وهو تمايزُنا
// وبيانُ منهجٍ في آن. لا يُكتب هذا الرسم في موضعٍ آخر: كلُّ من يعرضه يستورده من هنا.
export const BRAND = 'اِقْرَأْ';

/**
 * علامةُ التطبيق: الكلمةُ مشكولةً بخطّ العلامة، ونوري حاطٌّ على رأس ألف الوصل
 * (أوّلِ الكلمة، يمينَها) — لا فوق «أ» الأخيرة، فتلك يعلوها سكونُها وهمزتُها
 * فيحجب الطائرُ التشكيلَ الذي هو تمايزُ العلامة. التركيب ١ في `docs/REVIEW_BRAND.md`.
 */
export function brandMark(tag = 'span') {
  return h(tag, { class: 'brand' },
    h('span', { class: 'brand-word' }, BRAND),
    mascot('brand-bird'));
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
  // الميزان: كفّتان في مستوى واحد — معلمُ محطة «ميّز بين» (وزنُ الشبيهين بالأذن)
  roots: '<path d="M32 56V26" /><path d="M32 34 18 20" /><path d="M32 34l14-14" /><path d="M32 26 24 12" /><path d="M32 26l8-14" />',
  scales: '<path d="M32 8v34" /><path d="M22 42h20" /><path d="M8 18h48" /><path d="M8 18v10" />'
    + '<path d="M56 18v10" /><path d="M2 28a6 6 0 0 0 12 0" /><path d="M50 28a6 6 0 0 0 12 0" />',
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

// ————— مهمة «أيقونات لا إيموجي» (أمر المالك، ٧ أغسطس ٢٠٢٦) —————
//
// **العلّة**: إيموجي خطِّ النظام ليس صورةً واحدة — هو صورةٌ لكل جهاز. فما راجعه
// المالك والمدير في `docs/REVIEW_ICONS.md` على أبل يراه طفلٌ آخر على أندرويد أو
// ويندوز رسماً مختلفاً، فينقلب عليه حكمُ «صدق الصورة» (DESIGN §٦)؛ والرموزُ
// الحديثة (يونيكود ١٤–١٥) تظهر في الأجهزة الأقدم مربّعاً فارغاً، فتصير الإجابةُ
// المصوَّرة بلا صورةٍ أصلاً. والعلاج قسمان:
//
//   • **رموز البيانات** (كلمات المنهج والمعجم ومشاهد القصص ووجوه المحطات):
//     تُرسم من Twemoji المخزونة في `app/emoji/` — الرمز نفسُه لا يتغيّر، وإنما
//     صار رسمُه ملفَّ SVG واحداً لكل طفل. ويجلبها `tools/fetch_twemoji.py`.
//   • **رموز الواجهة** (زرّ السماع، الاحتفال، القفل، الإعادة…): أيقوناتُنا
//     الخطية أدناه لا Twemoji — لغةُ الواجهة عندنا SVG خطيّ أصلاً (المعالم
//     والميكروفون)، وليست هذه الرموز من بياناتٍ يراجعها أحد.
//
// ولا يبقى في التطبيق محرفُ إيموجي واحد يُسلَّم إلى خطّ النظام — يحرسه
// `tools/test_emoji.mjs` على الشيفرة و`browser_test.py` على الشاشة نفسِها.

// «رمزٌ مصوَّر» قاعدةُ يونيكود لا ذوق: `Emoji_Presentation=Yes` (رسمُه الملوّن هو
// الأصل)، أو محرفٌ أُلحق به مُحدِّدُ التصوير `U+FE0F`. وبها تخرج «✦» و«✓» و«★»
// و«←» — محارفُ نصّية تُرسم بخطّ النصّ نفسِه ولا شأن لها بهذه المهمة. وهذه عينُ
// القاعدة المكتوبة في `tools/fetch_twemoji.py`، ويقابل `test_emoji.mjs` بينهما
// رمزاً رمزاً فلا تنحرف إحداهما عن الأخرى.
const PRESENTATION = '\u{231A}-\u{231B}\u{23E9}-\u{23EC}\u{23F0}\u{23F3}\u{25FD}-\u{25FE}\u{2614}-\u{2615}'
  + '\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-'
  + '\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2705}'
  + '\u{270A}-\u{270B}\u{2728}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2795}-\u{2797}'
  + '\u{27B0}\u{27BF}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{1F004}\u{1F0CF}\u{1F18E}\u{1F191}-'
  + '\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}-\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F236}'
  + '\u{1F238}-\u{1F23A}\u{1F250}-\u{1F251}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F335}\u{1F337}-'
  + '\u{1F37C}\u{1F37E}-\u{1F393}\u{1F3A0}-\u{1F3CA}\u{1F3CF}-\u{1F3D3}\u{1F3E0}-\u{1F3F0}'
  + '\u{1F3F4}\u{1F3F8}-\u{1F43E}\u{1F440}\u{1F442}-\u{1F4FC}\u{1F4FF}-\u{1F53D}\u{1F54B}-'
  + '\u{1F54E}\u{1F550}-\u{1F567}\u{1F57A}\u{1F595}-\u{1F596}\u{1F5A4}\u{1F5FB}-\u{1F64F}'
  + '\u{1F680}-\u{1F6C5}\u{1F6CC}\u{1F6D0}-\u{1F6D2}\u{1F6D5}-\u{1F6D7}\u{1F6DC}-\u{1F6DF}'
  + '\u{1F6EB}-\u{1F6EC}\u{1F6F4}-\u{1F6FC}\u{1F7E0}-\u{1F7EB}\u{1F7F0}\u{1F90C}-\u{1F93A}'
  + '\u{1F93C}-\u{1F945}\u{1F947}-\u{1F9FF}\u{1FA70}-\u{1FA7C}\u{1FA80}-\u{1FA88}\u{1FA90}-'
  + '\u{1FABD}\u{1FABF}-\u{1FAC5}\u{1FACE}-\u{1FADB}\u{1FAE0}-\u{1FAE8}\u{1FAF0}-\u{1FAF8}';
const BASE_CHARS = '\u{A9}\u{AE}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{21AA}\u{231A}-\u{231B}\u{2328}'
  + '\u{23CF}-\u{23FA}\u{24C2}\u{25AA}-\u{25FE}\u{2600}-\u{27BF}\u{2934}-\u{2935}\u{2B00}-'
  + '\u{2BFF}\u{3030}\u{303D}\u{3297}\u{3299}\u{1F000}-\u{1FAFF}';
const ZWJ = '\u{200D}';
const VS16 = '\u{FE0F}';
const EMOJI_RE = new RegExp(
  `^(?:[${PRESENTATION}]${VS16}?|[${BASE_CHARS}]${VS16})`
  + `(?:${ZWJ}(?:[${PRESENTATION}]|[${BASE_CHARS}])${VS16}?)*$`, 'u');

/** أهذا النصُّ رمزٌ مصوَّر بتمامه؟ (حرفٌ عربيّ أو «۞» أو «✦»: لا). */
export const isEmoji = (text) => typeof text === 'string' && EMOJI_RE.test(text);

/**
 * مسارُ ملف الرمز في `app/emoji/` — نقاطُه بالست عشري موصولةً بشرطة.
 * وقاعدةُ `U+FE0F` قاعدةُ مجموعة Twemoji نفسِها: يُحذف المُحدِّد إلا في تسلسل ZWJ —
 * فالميزان (U+2696 U+FE0F) ملفُّه `2696.svg`، والطبيب (U+1F468 U+200D U+2695 U+FE0F)
 * ملفُّه `1f468-200d-2695-fe0f.svg` بمُحدِّده. (ولا يُكتب في هذا الملف محرفُ إيموجي
 * واحد ولو في تعليق — النطاقات أعلاه بالهروب لذلك، ويحرسه `tools/test_emoji.mjs`.)
 */
export function emojiSrc(glyph) {
  const text = glyph.includes(ZWJ) ? glyph : glyph.replaceAll(VS16, '');
  return `emoji/${[...text].map((ch) => ch.codePointAt(0).toString(16)).join('-')}.svg`;
}

/**
 * صورةُ الرمز — مربّعةٌ بمقاس سطرها (`1em`) فتحلّ محلّ المحرف في مكانه بلا إزاحة.
 * و`data-emoji` تُعلن أيَّ رمزٍ ترسم: كان الرمزُ نصّاً يُقرأ من الشاشة فصار صورة،
 * فلولا الإعلانُ لعميت عنه اختباراتُ المتصفّح التي تتحقّق أنّ المعروض هو المقصود.
 */
export const emojiImg = (glyph) => h('img', {
  class: 'emoji', src: emojiSrc(glyph), alt: '', 'aria-hidden': 'true',
  draggable: false, 'data-emoji': glyph,
});

/**
 * **المُصيِّر الواحد**: وجهٌ في صندوقه — رمزاً مصوَّراً كان أو حرفاً أو أيقونةً خطية.
 *
 * الصندوقُ الخارجيّ يبقى كما كان بصنفه وتنسيقه (فحجم الرمز ولونه من CSS كما هما)،
 * وإنما يتبدّل ما بداخله: `<img>` للمصوَّر، ونصٌّ للحرف العربي («ب»، «ـَا»، «۞»).
 * فما من موضعٍ في التطبيق يكتب رمزاً في DOM إلا من هنا.
 */
export function faceEl(value, className, tag = 'span') {
  const drawn = !!value?.nodeType || isEmoji(value);      // صورةٌ أو أيقونة، لا حرفاً
  const inner = value?.nodeType ? value : (drawn ? emojiImg(value) : value);
  // الصورةُ زينةٌ لا نصّ: تُخفى عن قارئ الشاشة كما كان الرمزُ يُخفى قبلها، أما
  // الحرفُ العربيّ فيبقى مقروءاً (وجهُ عقدةِ الحرف وحبرُ الاحتفال يُقرآن).
  return h(tag, { class: className, 'aria-hidden': drawn ? 'true' : null }, inner);
}

// أيقونات الواجهة — لغةُ المعالم نفسُها: خطٌّ بلا ملء، يتبع لون نصّه (`currentColor`).
// كلُّها في صندوق 24×24، فيكفي المقاسَ سطرُها.
const ICONS = {
  // شجرةُ الجذر — جذعٌ يتفرّع: وجهُ محطة العائلة الصرفية (لغةُ الواجهة SVG لا إيموجي)
  roots: '<path d="M12 21v-8"/><path d="M12 15 7.5 10.5"/><path d="m12 15 4.5-4.5"/>'
    + '<path d="M12 12 8.5 6"/><path d="m12 12 3.5-6"/><circle cx="7.5" cy="9.6" r="1.5"/>'
    + '<circle cx="16.5" cy="9.6" r="1.5"/><circle cx="8.5" cy="5" r="1.5"/>'
    + '<circle cx="15.5" cy="5" r="1.5"/>',
  // مكبّر الصوت — زرّ «اسمع» وأذنُ الصورة
  ear: '<path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"/>'
    + '<path d="M15.6 9.2a4 4 0 0 1 0 5.6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/>',
  // سمّاعتان — «أيها سمعت؟»
  headphones: '<path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/>'
    + '<path d="M4 15.5a2.4 2.4 0 0 1 4.8 0v2.6a2.4 2.4 0 0 1-4.8 0z"/>'
    + '<path d="M15.2 15.5a2.4 2.4 0 0 1 4.8 0v2.6a2.4 2.4 0 0 1-4.8 0z"/>',
  // وثبةُ فرح — احتفالُ الختام (وهي شقيقةُ النجمة في اللوح لا صورةُ مفرقعات)
  party: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3"/>'
    + '<path d="M2.5 12h3M18.5 12h3"/><path d="m5.3 5.3 2.1 2.1M16.6 16.6l2.1 2.1"/>'
    + '<path d="m18.7 5.3-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  // قفلٌ مغلق — المحطة التي لم يبلغها بعد
  lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2"/>'
    + '<path d="M8.2 10.5V7.2a3.8 3.8 0 0 1 7.6 0v3.3"/>',
  // سهمان يدوران — المراجعة و«تابع من هنا»
  repeat: '<path d="M4 11V9.6A4.6 4.6 0 0 1 8.6 5H19"/><path d="m16.4 2.4 2.9 2.6-2.9 2.6"/>'
    + '<path d="M20 13v1.4a4.6 4.6 0 0 1-4.6 4.6H5"/><path d="m7.6 21.6-2.9-2.6 2.9-2.6"/>',
  // قطعةُ أُحجية — لعبة تركيب الكلمات
  puzzle: '<path d="M4.5 9.6V4.5h5.1a2.4 2.4 0 0 1 4.8 0h5.1v5.1a2.4 2.4 0 0 0 0 4.8v5.1h-5.1'
    + 'a2.4 2.4 0 0 0-4.8 0H4.5v-5.1a2.4 2.4 0 0 0 0-4.8z"/>',
  // كتابٌ مفتوح — سلّم الجمل وشاشة القراءة (شقيقُ معلم المكتبة على الخريطة)
  book: '<path d="M12 6.5v14"/><path d="M12 6.5C9.4 4.6 6.3 4 3.5 4.4v13.9c2.8-.4 5.9.2 8.5 2.2"/>'
    + '<path d="M12 6.5c2.6-1.9 5.7-2.5 8.5-2.1v13.9c-2.8-.4-5.9.2-8.5 2.2"/>',
  // كتبٌ مصفوفة — المكتبة
  books: '<path d="M4 20V5.5h3.6V20z"/><path d="M8.8 20V7.5h3.6V20z"/>'
    + '<path d="m14 20 3-13.2 3.5.8L17.6 20z"/><path d="M3 20h18"/>',
  // أسرة — بوابةُ وليّ الأمر (لا وجهَ طفلٍ يُنقر عليه بالخطأ)
  family: '<circle cx="7.5" cy="6.8" r="2.8"/><circle cx="16.8" cy="7.6" r="2.4"/>'
    + '<circle cx="12.2" cy="14.4" r="2"/><path d="M3 15.5a4.5 4.5 0 0 1 8.2-2.6"/>'
    + '<path d="M13.2 13.2a4 4 0 0 1 7.3 2.3"/><path d="M8.6 21a3.7 3.7 0 0 1 7.2 0"/>',
  // وجهٌ يبتسم — بشرى العبور واللمسات اللطيفة
  smile: '<circle cx="12" cy="12" r="8.8"/><path d="M8.2 14.4a4.7 4.7 0 0 0 7.6 0"/>'
    + '<circle cx="9.2" cy="10" r=".9" fill="currentColor" stroke="none"/>'
    + '<circle cx="14.8" cy="10" r=".9" fill="currentColor" stroke="none"/>',
  // لهبٌ — سلسلةُ أيام المراجعة المتتالية
  flame: '<path d="M12 2.8c.4 3.4 4.6 5.3 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-1.9.9-3.2 1.9-4.2'
    + '.1 1.5.9 2.4 1.8 2.4 1.3 0 1.4-2.4-.5-4.4z"/>'
    + '<path d="M12 20.9a2.6 2.6 0 0 1-2.6-2.6c0-1.5 2.6-3.4 2.6-3.4s2.6 1.9 2.6 3.4'
    + 'A2.6 2.6 0 0 1 12 20.9z"/>',
  // هديّةٌ معقودة — فتحُ المجموعة التالية
  gift: '<rect x="3.5" y="9.4" width="17" height="4" rx="1"/>'
    + '<path d="M5.2 13.4V20h13.6v-6.6"/><path d="M12 9.4V20"/>'
    + '<path d="M12 9.4c-3.4 0-5-.7-5-2.3S9.6 4.5 12 9.4z"/>'
    + '<path d="M12 9.4c3.4 0 5-.7 5-2.3S14.4 4.5 12 9.4z"/>',
};

/**
 * أيقونةُ واجهة — رمزٌ من صنع الواجهة لا من بيانات المنهج (DESIGN §٦).
 * تتبع لون نصّها ومقاسَه، فتقع من الزرّ موقعَ محرفها الذي كانت. وحيث كان الرمز
 * في **شارةٍ** مقيسةٍ بالبكسل (أذنُ الصورة، قفلُ العقدة) تُوضع داخلها لا مكانَها:
 * الشارةُ صندوقُها والأيقونةُ حبرُها، فلا يتنازع صنفان على مقاسٍ واحد.
 */
export function icon(name) {
  if (!ICONS[name]) return null;
  const el = h('span', { class: 'ui-icon', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return el;
}

/** أسماء أيقونات الواجهة — يقرؤها حارسُ `tools/test_emoji.mjs`. */
export const ICON_NAMES = Object.keys(ICONS);

/**
 * سطرُ الإتقان: نصُّه ثم وثبةُ الفرح — بديلُ محرف الاحتفال الذي كان يُختم به النصّ.
 * (يُمرَّر إلى `h` كما يُمرَّر النصّ، فهي تفرد المصفوفة على أبنائها.)
 */
export const cheer = (text) => [text, ' ', icon('party')];

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
  // رمزٌ مصوَّر: لا خطَّ أساسٍ له ولا حبرَ يُقاس — صورةٌ في موضع الحبر وكفى
  if (isEmoji(text)) return faceEl(text, 'giant-ink');
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
