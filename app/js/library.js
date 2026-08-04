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
import { curriculumWord } from './curriculum.js';

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
 * القصة في شكلٍ تفهمه الشاشة: صفحاتُها كلماتٌ مفصولة، وخيارات أسئلتها **كلمات معجمٍ**
 * بصورها (يفرض الفاحص أن الجواب في مقطعه وأن المشتّتين خارج القصة).
 *
 * و**سؤالٌ لكل مقطع** (حزمة المكتبة): `questions` قائمةٌ، لكلٍّ `upto` — رقمُ الصفحة
 * التي يُسأل عندها، محسوبةً من عدد الصفحات في الفاحص لا مكتوبةً بيد. وقصصُ البساتين
 * والسور سؤالٌ واحد `upto` آخِرُ صفحاتها، فالشكلُ واحدٌ للجميع.
 *
 * وخياراتُ سؤال الفهم **صورٌ** لا نصّ — فالكلمةُ غير المصوَّرة تُسقِط سؤالَها
 * («صدق الصورة» — DESIGN §٦). ويرفضها `check_lexicon.py` في البيانات أصلاً،
 * وهذا حارسُ الشاشة إن تسرّبت: سؤالٌ لا يُسأل خيرٌ من سؤالٍ يظلم.
 */
function asStory(raw) {
  // وحوضُ الخيارات يتبع محورَ القصة: قصةُ البستان من معجمه، وقصةُ السورة من كلمات
  // المنهج (قبل البساتين كلِّها)، و**قصةُ الرفّ من الاثنين** — فهي في ذيل الرحلة
  // وأبطالُها كلماتُ منهجٍ غالباً (حكم المدير، ١٢ أغسطس ٢٠٢٦).
  const fromCurriculum = Boolean(raw.surah || raw.shelf);
  const ask = (q) => {
    const options = [q?.answer, ...(q?.distractors || [])]
      .map((word) => (fromCurriculum ? curriculumWord(word) || lexiconWord(word) : lexiconWord(word)))
      .filter((word) => word && word.pictured !== false);
    return options.length === 3 ? {
      upto: q.upto,
      text: q.text,
      words: wordsOf(q.text),
      answer: options[0],
      options,
    } : null;
  };
  return {
    ...raw,
    pages: (raw.pages || []).map((page) => ({ ...page, words: wordsOf(page.text) })),
    questions: (raw.questions || []).map(ask).filter(Boolean),
  };
}

export const LIBRARY = (await readLibrary()).map(asStory).filter((s) => s.pages.length);

export const libraryStory = (id) => LIBRARY.find((s) => s.id === id) || null;

/** قصص بستانٍ بعينه — عقدُها على الخريطة بعد سلّم جمله. */
export const libraryOf = (gardenId) => LIBRARY.filter((s) => s.garden === gardenId);

/**
 * قصصُ سورةٍ بعينها — عقدُها **قبل محطة كلماتها**: كما لا تُقرأ سورةٌ قبل كلماتها،
 * لا تُقرأ سورةٌ قَصَصيّةٌ قبل قصتها؛ يعرف الطفلُ الخبرَ ثم يقرؤه في كلام الله.
 */
export const storiesOfSurah = (surahId) => LIBRARY.filter((s) => s.surah === surahId);

/**
 * قصصُ «رفّ المكتبة» — القسمُ الأخير من الرحلة (حزمة المكتبة، ١٢ أغسطس ٢٠٢٦).
 *
 * **ولِمَ محورٌ ثالث؟** لأنّ موضعَ قصةِ البستان **محسوبٌ من كلماتها**، فالقصةُ
 * الطويلة تنجرّ إلى بستانٍ مبكّر أو تُجبَر على حشو كلمةٍ لتستقيم للحساب. والرفُّ
 * رصيدُه الرحلةُ كلُّها، فلا موضعَ بستانيَّ له أصلاً — وهناك وحدَه يحتمل الطول.
 */
export const shelfStories = () => LIBRARY.filter((s) => s.shelf);

/**
 * **هل تُسمَع جملُ هذه القصة؟** لا في الرفّ (بند الحزمة: «القصةُ تُقرأ لا تُسمع» —
 * الطفلُ هناك قارئٌ لا مستمع، فيسقط الكاريوكي وأذنُ السطر). وتبقى **نقرةُ الكلمة**
 * في الرفّ وغيره: شبكةُ الأمان الوحيدة لمن تعثّر في كلمة.
 */
export const readsAloud = (story) => !story.shelf;

/** كل ما تنطقه القصة: عنوانها، وجملُها (إن كانت تُسمَع)، وكلماتُها مفردةً. */
export function storyTexts(story) {
  return [...new Set([
    story.title,
    ...story.pages.flatMap((page) => (readsAloud(story) ? [page.text, ...page.words] : page.words)),
    ...story.questions.map((q) => q.text),
  ])];
}

/**
 * كل ما تنطقه المكتبة بترتيب لقاء الطفل به (وهو ترتيب تصريف قائمة الانتظار).
 * خيارات سؤال الفهم كلماتُ معجمٍ لها أصواتها من الحزمة ٧، فلا تُعدّ جديداً هنا.
 */
export function libraryTexts() {
  return [...new Set(LIBRARY.flatMap(storyTexts))];
}
