// مكتبة «مصنع القصص» — طبقة البيانات (الحزمة ٩ · ROADMAP §المرحلة د).
//
// **المادّة ليست هنا**: عشر قصص في `app/data/stories/` (ملفٌّ لكل قصة وفهرسٌ يرتّبها)،
// تُؤلَّف بمولّد مقيَّد (`tools/make_stories.py`) لا تُكتب بيد، ويرفض `check_lexicon.py`
// ما خالف العقد. وهذا الملف يقرؤها ويقدّمها للشاشة في شكلٍ واحد لا أكثر.
//
// **موضع القصة من الرحلة**: بستانُها المعلَن — وهو أبعدُ بستانٍ تنتمي إليه كلمةٌ منها
// (قاعدة «أوّل موضعٍ تكتمل فيه كلماتُه»)، يفرضها الفاحص. فعقدُها تلي **سلّم جمل
// بستانها**: كلماتُ البستان أولاً، ثم جملُه، ثم قصةٌ تجمعها — وهو تدرّج المرحلة د.
//
// تُقرأ **مرة واحدة عند تحميل الوحدة** (top-level await) كما يُقرأ المعجم، فتبقى
// `progress.journey()` متزامنة. وإن تعذّرت القراءة تعمل الرحلة كاملةً بلا مكتبة.

import { lexiconWord } from './lexicon.js';

const INDEX_URL = new URL('../data/stories/index.json', import.meta.url);

async function readJson(url) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFileSync } = await import('node:fs');      // اختبارات node تقرأ الملف مباشرة
    return JSON.parse(readFileSync(url, 'utf8'));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function readLibrary() {
  try {
    const index = await readJson(INDEX_URL);
    const ids = index.stories || [];
    return await Promise.all(ids.map((id) => readJson(new URL(`${id}.json`, INDEX_URL))));
  } catch (e) {
    console.warn('[library] تعذّرت قراءة المكتبة — تعمل الرحلة بلا قصص جديدة:', e);
    return [];
  }
}

/** كلمات النصّ كما تُعرض وتُنطق — لا مصدر ثانٍ لها (الفراغ يفصلها). */
const wordsOf = (text) => String(text ?? '').split(/\s+/).filter(Boolean);

/**
 * القصة في شكلٍ تفهمه الشاشة: صفحاتُها كلماتٌ مفصولة، وخيارات سؤالها **كلمات معجمٍ**
 * بصورها (يفرض الفاحص أن الجواب في نصّ القصة وأن المشتّتين خارجه).
 */
function asStory(raw) {
  const options = [raw.question?.answer, ...(raw.question?.distractors || [])]
    .map((word) => lexiconWord(word))
    .filter(Boolean);
  return {
    ...raw,
    pages: (raw.pages || []).map((page) => ({ ...page, words: wordsOf(page.text) })),
    question: options.length === 3 ? {
      text: raw.question.text,
      words: wordsOf(raw.question.text),
      answer: options[0],
      options,
    } : null,
  };
}

export const LIBRARY = (await readLibrary()).map(asStory).filter((s) => s.pages.length);

export const libraryStory = (id) => LIBRARY.find((s) => s.id === id) || null;

/** قصص بستانٍ بعينه — عقدُها على الخريطة بعد سلّم جمله. */
export const libraryOf = (gardenId) => LIBRARY.filter((s) => s.garden === gardenId);

/** كل ما تنطقه القصة: عنوانها، وجملُها، وكلماتُها مفردةً (كلُّ كلمةٍ زرٌّ يُسمعها). */
export function storyTexts(story) {
  return [...new Set([
    story.title,
    ...story.pages.flatMap((page) => [page.text, ...page.words]),
    ...(story.question ? [story.question.text] : []),
  ])];
}

/**
 * كل ما تنطقه المكتبة بترتيب لقاء الطفل به (وهو ترتيب تصريف قائمة الانتظار).
 * خيارات سؤال الفهم كلماتُ معجمٍ لها أصواتها من الحزمة ٧، فلا تُعدّ جديداً هنا.
 */
export function libraryTexts() {
  return [...new Set(LIBRARY.flatMap(storyTexts))];
}
