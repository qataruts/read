// ورقة مراجعة المدير لمكتبة «مصنع القصص» (الحزمة ٩) — ثالثةُ خطّ الإنتاج:
//   تأليف مقيَّد (make_stories.py) ← فاحص آليّ (check_lexicon.py) ← **عينُ المدير**
//
// الفاحص يحكم في الحرف والمفردة والموضع وحدود المستوى وسلامة السؤال، ولا يحكم في
// المعنى ولا الحبكة ولا الذوق — فهذه الورقة تعرض المادّة **بترتيب لقاء الطفل بها**
// (بستاناً فقصةً فصفحة) ومعها مستواها وسؤالها، ليُقرأ كلٌّ في سياقه الذي سيراه فيه.
//
// **بوّابة إلزامية** (بند الحزمة ٩/٤): لا اعتماد ولا قائمة صوت قبل حكم المدير عيناً.
//
// **ووضعان لا وضع** (حزمة المكتبة، ١٢ أغسطس ٢٠٢٦): الافتراضيّ ورقةُ **مكتبة
// البساتين** (الحزمة ٩) كما كانت، و`--shelf` ورقةُ **رفّ المكتبة** — القصصُ الطويلة
// في ذيل الرحلة. وفُصلتا لأنّ ورقةَ الحزمة ٩ **حكمٌ مضى وقد أُقرّ**: لا يُعاد كتابةُ
// الماضي، ولكل بوابةٍ ورقتُها.
//
//   node tools/review_stories.mjs [docs/REVIEW_STORIES.md]
//   node tools/review_stories.mjs --shelf [docs/REVIEW_SHELF.md]

import { readFileSync, writeFileSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const ROOT = new URL('../', import.meta.url);
const { GARDENS } = await import(new URL('app/js/lexicon.js', ROOT));
const { LIBRARY: ALL, libraryOf, libraryTexts, shelfStories, storyTexts } =
  await import(new URL('app/js/library.js', ROOT));
const { LADDERS, stemOf } = await import(new URL('app/js/sentences.js', ROOT));

const index = JSON.parse(readFileSync(new URL('app/data/stories/index.json', ROOT), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('app/audio/manifest.json', ROOT), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('tools/audio_queue.json', ROOT), 'utf8'));
const voiced = new Set([...Object.values(manifest),
  ...queue.filter((e) => e.status !== 'done').map((e) => e.text)]);

const SHELF_MODE = process.argv.includes('--shelf');
const LIBRARY = SHELF_MODE ? shelfStories() : ALL.filter((s) => s.garden);
const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const pages = LIBRARY.reduce((s, x) => s + x.pages.length, 0);
const waiting = SHELF_MODE
  ? [...new Set(LIBRARY.flatMap(storyTexts))].filter((t) => !voiced.has(t)).length
  : libraryTexts().filter((t) => !voiced.has(t)).length;
const asks = (story) => story.questions.map((q, i) =>
  `**سؤال المقطع ${arNum(i + 1)}** (إلى الصفحة ${arNum(q.upto)}): ${q.text} — `
  + `الجواب ${q.answer.emoji} ${q.answer.word}، ومعه `
  + q.options.filter((w) => w !== q.answer).map((w) => `${w.emoji} ${w.word}`).join(' و') + '.');

const lines = [];
const P = (s = '') => lines.push(s);

P(SHELF_MODE ? '# ورقة مراجعة: رفّ المكتبة — المستوى الرابع (حزمة المكتبة)'
  : '# ورقة مراجعة: «مصنع القصص» — الحزمة ٩');
P();
P('> **المطلوب من المدير**: قراءةُ المعنى والحبكة والذوق، وأن تكون الخاتمة طيبة،');
P('> وأن يكون سؤالُ الفهم سؤالاً يستحقّ أن يُسأل. أمّا الحرفُ والمفردةُ والموضعُ');
P('> وحدودُ المستوى وسلامةُ السؤال فقد حكم فيها الفاحص آلياً:');
P('> كل كلمة مشكولة بالكامل ومن معجمٍ معلَن، ولا قصةَ تُعرض قبل أن تكتمل كلماتُها في');
P('> حصيلة الطفل، وجوابُ كل سؤال في نصّ قصته ومشتّتاه خارجه.');
P('>');
P('> التوليد: `python3 tools/make_stories.py` — والنصّ **مشتقّ** من كلمات أساسٍ معلَنة');
P('> بأدوارٍ إعرابية، فلا شكلَ مكتوباً بيد. وإعادةُ توليده تعطي الملفّات نفسَها (`--check`).');
P('>');
P('> **بوّابة**: لا تدخل نصوصُ المكتبة قائمةَ الصوت قبل حكمك — '
  + `وهي اليوم ${arNum(waiting)} نصاً منتظِراً.`);
P();
const shownLevels = [...new Set(LIBRARY.map((s) => s.level))].sort();
P(`**المؤلَّف**: ${arNum(LIBRARY.length)} قصص في ${arNum(pages)} صفحة — `
  + shownLevels.map((lv) => {
    const mine = LIBRARY.filter((s) => s.level === lv);
    const sizes = [...new Set(mine.map((s) => s.pages.length))].sort();
    return `مستوى ${arNum(lv)}: ${arNum(mine.length)} قصص × ${sizes.map(arNum).join('/')} جمل`;
  }).join('، ') + '.');
P();
// **المعلَنُ الذي تستعمله هذه الشريحة وحدَها** — لا المعجمُ كلُّه: بوّابةٌ لهذه
// القصص، فلا يُعاد على المدير إقرارُ ما أقرّه في حزمةٍ ماضية.
const mineStems = new Set(LIBRARY.flatMap(storyTexts).flatMap((t) => t.split(' ')).map(stemOf));
const declared = index.support.filter((t) => mineStems.has(stemOf(t)));
P(`**المعجم المعلَن لهذه الشريحة**: ${arNum(declared.length)} مفردة زائدةً على كلمات المنهج `
  + 'ومعجم البساتين ومعجم الجمل المساند — وهي وحدها ما يحتاج إقراراً جديداً:');
P();
P('> ' + declared.join(' · '));
P();
P(SHELF_MODE
  ? '**الموضع**: قسمٌ واحد في **ذيل الرحلة** — بعد البساتين وسلالمها ومكتباتها '
    + 'وأشجارها كلِّها، فرصيدُه الرحلةُ كلُّها (٧٩١ مفردة معلَنة). ولا موضعَ بستانيَّ '
    + 'له: القراءةُ الطويلة ثمرةُ الرحلة لا محطةٌ فيها.'
  : '**الموضع**: قصةٌ لكل بستان، بعد سلّم جمله مباشرةً — كلماتُ البستان ← جملُه ← قصةٌ تجمعها.');
P();
P('---');
P();

/** جسدُ القصة: صفحاتُها جدولاً، وأسئلةُ مقاطعها تحتها. */
function body(story) {
  P(`### ${story.emoji} ${story.title} — مستوى ${arNum(story.level)} `
    + `(${arNum(story.pages.length)} ${SHELF_MODE ? 'صفحة' : 'جمل'})`);
  P();
  P('| # | المشهد | الجملة |');
  P('|---|---|---|');
  story.pages.forEach((page, i) => P(`| ${arNum(i + 1)} | ${page.emoji} | ${page.text} |`));
  P();
  for (const line of asks(story)) { P(line); P(); }
}

if (SHELF_MODE) {
  const words = LIBRARY.reduce((n, s) => n + s.pages.reduce((m, p2) => m + p2.text.split(' ').length, 0), 0);
  P(`## 📚 رفّ المكتبة — ${arNum(LIBRARY.length)} قصص، ${arNum(words)} كلمةً تُقرأ`);
  P();
  P('_يقرؤها الطفلُ **بعينه**: لا كاريوكي ولا أذنَ سطرٍ ولا صوتَ لجملة — ونقرةُ الكلمة');
  P('وحدَها تبقى (تُسمعها وتكشف شكلها). ويُعرَض **مقطعٌ ثم سؤالُه** ثم الذي يليه،');
  P('وتُختَم بخطوة **«اِقْرَأْ لِأُمِّكْ»** بكتلة التسجيل القائمة._');
  P();
  for (const story of LIBRARY) body(story);
} else {
  for (const garden of GARDENS) {
    const mine = libraryOf(garden.id);
    if (!mine.length) continue;
    const rungs = LADDERS.find((l) => l.id === garden.id)?.rungs.length || 0;
    P(`## ${garden.emoji} ${garden.title}`);
    P();
    P(`_بعد ${arNum(garden.bundles.length)} باقات و${arNum(rungs)} درجات جمل._`);
    P();
    for (const story of mine) body(story);
  }
}

// **ولا يُكتب فوق ورقةٍ مضت**: `docs/REVIEW_STORIES.md` حكمٌ أُقرّ في الحزمة ٩،
// وإعادةُ توليده اليوم تُبدّل أرقامَه (نمت البساتين من خمس باقاتٍ إلى عشر) — فيصير
// سجلُّ ما حكم فيه المديرُ غيرَ ما حكم فيه. فالكتابةُ فوقه تحتاج مساراً صريحاً.
const named = process.argv.filter((a) => a.endsWith('.md'))[0];
if (!SHELF_MODE && !named) {
  console.error('ورقةُ الحزمة ٩ سجلٌّ مضى — لا تُعاد كتابتُه.\n'
    + 'للرفّ: node tools/review_stories.mjs --shelf\n'
    + 'ولإعادة توليدها عمداً: node tools/review_stories.mjs docs/REVIEW_STORIES.md');
  process.exit(1);
}
const path = named || 'docs/REVIEW_SHELF.md';
writeFileSync(new URL(path, ROOT), `${lines.join('\n')}\n`, 'utf8');
console.log(`ورقة المراجعة: ${path} — ${LIBRARY.length} قصة في ${pages} صفحة، `
  + `و${waiting} نصاً ينتظر اعتمادك قبل قائمة الصوت`);
