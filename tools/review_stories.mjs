// ورقة مراجعة المدير لمكتبة «مصنع القصص» (الحزمة ٩) — ثالثةُ خطّ الإنتاج:
//   تأليف مقيَّد (make_stories.py) ← فاحص آليّ (check_lexicon.py) ← **عينُ المدير**
//
// الفاحص يحكم في الحرف والمفردة والموضع وحدود المستوى وسلامة السؤال، ولا يحكم في
// المعنى ولا الحبكة ولا الذوق — فهذه الورقة تعرض المادّة **بترتيب لقاء الطفل بها**
// (بستاناً فقصةً فصفحة) ومعها مستواها وسؤالها، ليُقرأ كلٌّ في سياقه الذي سيراه فيه.
//
// **بوّابة إلزامية** (بند الحزمة ٩/٤): لا اعتماد ولا قائمة صوت قبل حكم المدير عيناً.
//
//   node tools/review_stories.mjs [docs/REVIEW_STORIES.md]

import { readFileSync, writeFileSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const ROOT = new URL('../', import.meta.url);
const { GARDENS } = await import(new URL('app/js/lexicon.js', ROOT));
const { LIBRARY, libraryOf, libraryTexts } = await import(new URL('app/js/library.js', ROOT));
const { LADDERS } = await import(new URL('app/js/sentences.js', ROOT));

const index = JSON.parse(readFileSync(new URL('app/data/stories/index.json', ROOT), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('app/audio/manifest.json', ROOT), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('tools/audio_queue.json', ROOT), 'utf8'));
const voiced = new Set([...Object.values(manifest),
  ...queue.filter((e) => e.status !== 'done').map((e) => e.text)]);

const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const pages = LIBRARY.reduce((s, x) => s + x.pages.length, 0);
const waiting = libraryTexts().filter((t) => !voiced.has(t)).length;

const lines = [];
const P = (s = '') => lines.push(s);

P('# ورقة مراجعة: «مصنع القصص» — الحزمة ٩');
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
P(`**المؤلَّف**: ${arNum(LIBRARY.length)} قصص في ${arNum(pages)} صفحة — `
  + [1, 2, 3].map((lv) => {
    const mine = LIBRARY.filter((s) => s.level === lv);
    const sizes = [...new Set(mine.map((s) => s.pages.length))].sort();
    return `مستوى ${arNum(lv)}: ${arNum(mine.length)} قصص × ${sizes.map(arNum).join('/')} جمل`;
  }).join('، ') + '.');
P();
P(`**معجم المكتبة المعلَن**: ${arNum(index.support.length)} مفردة زائدةً على معجم البساتين `
  + 'ومعجم الجمل المساند — وهي وحدها ما يحتاج إقراراً جديداً:');
P();
P('> ' + index.support.join(' · '));
P();
P('**الموضع**: قصةٌ لكل بستان، بعد سلّم جمله مباشرةً — كلماتُ البستان ← جملُه ← قصةٌ تجمعها.');
P();
P('---');
P();

for (const garden of GARDENS) {
  const mine = libraryOf(garden.id);
  if (!mine.length) continue;
  const rungs = LADDERS.find((l) => l.id === garden.id)?.rungs.length || 0;
  P(`## ${garden.emoji} ${garden.title}`);
  P();
  P(`_بعد ${arNum(garden.bundles.length)} باقات و${arNum(rungs)} درجات جمل._`);
  P();
  for (const story of mine) {
    P(`### ${story.emoji} ${story.title} — مستوى ${arNum(story.level)} `
      + `(${arNum(story.pages.length)} جمل)`);
    P();
    P('| # | المشهد | الجملة |');
    P('|---|---|---|');
    story.pages.forEach((page, i) => P(`| ${arNum(i + 1)} | ${page.emoji} | ${page.text} |`));
    P();
    P(`**سؤال الفهم**: ${story.question.text} — `
      + `الجواب ${story.question.answer.emoji} ${story.question.answer.word}، `
      + 'ومعه '
      + story.question.options.filter((w) => w !== story.question.answer)
        .map((w) => `${w.emoji} ${w.word}`).join(' و') + '.');
    P();
  }
}

const path = process.argv[2] || 'docs/REVIEW_STORIES.md';
writeFileSync(new URL(path, ROOT), `${lines.join('\n')}\n`, 'utf8');
console.log(`ورقة المراجعة: ${path} — ${LIBRARY.length} قصة في ${pages} صفحة، `
  + `و${waiting} نصاً ينتظر اعتمادك قبل قائمة الصوت`);
