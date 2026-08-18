// اختبار «المرجع التعريفيّ» (`app/welcome/` — أربعُ صفحاتٍ بقشرةٍ واحدة):
//   node tools/test_welcome.mjs
//
// المحروس هنا تسعة، وكلها شروطُ قبولٍ لا زينة:
//   ١) **خارج التطبيق**: لا في قائمة SHELL، ولا يجيب عنها عاملُ الخدمة، ولا تسجّل
//      عاملاً، ولا تصل بيان التطبيق (manifest) — فلا تدخل PWA المثبَّتة بحال.
//   ٢) **لا مَورد شبكيّ خارجيّ البتّة**: كلُّ ما تجلبه الصفحةُ عند فتحها ملفٌّ في هذا
//      المستودع وموجودٌ فعلاً. **والاستثناءُ المعلَن واحد**: عنوانُ موقعنا في ترويسة
//      المطبوع — وهو `<a>` يُفتَح إن نُقر ولا يُجلَب (أمر المالك).
//   ٣) **قشرةٌ واحدة**: شريطُ التنقّل نفسُه في الصفحات الأربع، وصفحتُه الحالية معلَّمة.
//   ٤) **اللوح ليس منسوخاً**: لا لونَ بقيمته في التنسيق — بل متغيّرات `app.css`.
//   ٥) **أرقامُها صادقة**: كلُّ رقمٍ موسومٍ `data-stat` في أيّ صفحة يُحسب من بيانات
//      المنهج ويُقارَن — فتوسعةُ المنهج تُسقِط الفحصَ قبل أن تُسقِط صدقَ الصفحة.
//   ٦) **لا محطةَ تُترك**: لكل نوع محطةٍ في `journey()` بطاقتُه في صفحة المنهج بنمطها
//      الواحد وعددِ عقدها — ونوعٌ جديد يُسقِط الفحص يومَ يُضاف (نظيرُ `test_measure`).
//   ٧) **حارسُ التغطية** (حكم المدير، المرحلة الثانية): الرئيسةُ أُعيد تأليفُها ووُزّع
//      تفصيلُها على «الأسس» و«الدليل» — **فلا تسقط حقيقةٌ كانت معروضة**: تُجرد هنا
//      واحدةً واحدة ويُثبَت وجودُ كلٍّ في موضعها الجديد.
//   ٨) **لا وعدَ بما ليس في التطبيق**: كلُّ اسمِ زرٍّ تَعِد به الصفحةُ يُقابَل بنصّه في
//      `app/js/parent.js` و`app/js/main.js` — فلو غُيّر اسمٌ هناك احمرّ هنا.
//   ٩) **النصُّ منقولٌ لا مُعادُ الصياغة**: قواعدُ الدروس ومعاني الجذور وأسماءُ المحطات
//      تُقرأ من البيانات وقتَ الفحص، ولا حرفَ من نصّ المصحف يُكتب في صفحةِ عرض.

import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('app/', ROOT);
const WELCOME = new URL('welcome/', APP);
const read = (path, base = WELCOME) => readFileSync(new URL(path, base), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const PAGE_NAMES = ['index.html', 'curriculum.html', 'method.html', 'guide.html'];
const PAGES = Object.fromEntries(PAGE_NAMES.map((name) => [name, read(name)]));
const html = PAGES['index.html'];
const cur = PAGES['curriculum.html'];
const method = PAGES['method.html'];
const guide = PAGES['guide.html'];
const css = read('welcome.css');
const sw = read('sw.js', APP);
const parentJs = read('js/parent.js', APP);
const mainJs = read('js/main.js', APP);

// بيانات المنهج — منها تُحسب أرقام الصفحات (لا تُصدَّق كما كُتبت)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const JS = new URL('js/', APP);
const progress = await import(new URL('progress.js', JS));
const {
  GROUPS, LETTERS, STORIES, QURAN, SKILLS, CONTRASTS, GATES, ROOTS, surahWords, rasmSigns,
} = await import(new URL('curriculum.js', JS));
const { GARDENS } = await import(new URL('lexicon.js', JS));
const { RUNGS, SENTENCES } = await import(new URL('sentences.js', JS));
const { LIBRARY } = await import(new URL('library.js', JS));
const { KNOBS, PANEL_KEYS } = await import(new URL('support.js', JS));
const emojiIndex = JSON.parse(read('emoji/index.json', APP));
// **بنكُ الصوت يُحسب من بيانه لا يُقدَّر**: بصمةٌ لكل ملفٍّ مولَّد في `versions.json`،
// وآيةٌ لكل ملفِّ تلاوةٍ في `recitations.json` — فدفعةٌ جديدة تُسقِط الفحصَ يومَ
// تُصرَّف، وذاك الحارسُ يعمل لا عيبٌ فيه (حكم المدير حين أُجّل الرقم).
const audioVersions = JSON.parse(read('audio/versions.json', APP));
const recitations = JSON.parse(read('data/recitations.json', APP));

const SITE = 'https://read.mishkat.qa/';          // عنوانُنا في ترويسة المطبوع
// **بوابةُ العائلة** (أمر المالك، ١٣ أغسطس ٢٠٢٦): رابطُ المجموعة في كل تعريفية —
// ثاني الاستثناءين المعلَنين، و`<a>` يُفتح إن نُقر ولا يُجلَب كأخيه.
const FAMILY = 'https://learn.mishkat.qa/';
const KIT = 'https://learn.mishkat.qa/teacher.html';

// ————— ١. خارج التطبيق وخارج قشرة عامل الخدمة —————

console.log('\n١. خارج التطبيق');

for (const [name, text] of Object.entries(PAGES)) {
  ok(!/<link[^>]*rel=["']manifest["']/.test(text) && !/serviceWorker/.test(text)
    && !/<script/i.test(text),
    `${name}: لا بيانَ تطبيقٍ ولا عاملَ خدمة ولا سطرَ جافاسكربت واحداً`);
}
ok(/const WELCOME = new URL\('welcome\/'/.test(sw), 'وعامل الخدمة يعرف مسارها مشتقّاً من نطاقه');
// ردُّ التنقّل يجيب index.html عن كل تنقّلٍ في النطاق — فلولا الاستثناء **قبله**
// لفُتح التطبيقُ مكان الصفحة على كل جهازٍ ثبّته، فلا تُرى الصفحة أبداً.
const bypass = sw.indexOf('url.pathname.startsWith(WELCOME)');
ok(bypass > 0, 'ويستثنيها من الاعتراض فلا تُخزَّن ولا يُجاب عنها من المخزون');
ok(bypass > 0 && bypass < sw.indexOf("request.mode === 'navigate'"),
  'والاستثناء قبل ردّ التنقّل (وإلا ابتلعها فتح التطبيق مكانها)');

// **وبابُ التعريف في التطبيق** (أمر المالك، ١٢ أغسطس ٢٠٢٦): من فتح التطبيق وأراد
// أن يعرف ما هو يجد رابطَ المرجع في ذيل الخريطة — انتقالُ صفحةٍ لا تنقّلُ تطبيق.
ok(/class: 'map-about', href: 'welcome\/'/.test(mainJs),
  'وللتطبيق بابٌ إليها في ذيل خريطته (لا في صدرها فيزاحم درسَ الطفل)');
ok(/\.map-about\s*{/.test(read('css/app.css', APP)), 'وله تنسيقُه الهادئ في لوح التطبيق');

// ————— ٢. لا مَورد شبكيّ خارجيّ، ولا رابط مكسور —————

console.log('\n٢. المَوارد والروابط');

for (const [name, text] of Object.entries(PAGES)) {
  // **المحروسُ مرجعُ المَورد لا رابطُ التصفّح**: `src` و`<link>` تُجلَب عند الفتح
  // فلا يجوز فيها خارجيّ البتّة؛ و`<a href>` لا يُجلَب — يُفتَح إن نُقر.
  const fetched = [...text.matchAll(/(?:src|<link[^>]*href)="([^"]+)"/g)].map((m) => m[1])
    .filter((v) => /^(?:https?:)?\/\//.test(v) || v.startsWith('data:'));
  ok(fetched.length === 0,
    `${name}: صفرُ مَوردٍ خارجيّ يُجلَب${fetched.length ? ' — ' + fetched.join('، ') : ''}`);

  const outward = [...text.matchAll(/<a[^>]*href="(https?:[^"]+)"/g)].map((m) => m[1]);
  // **وحقيبةُ المعلم ثالثُ المسموح** (سؤال المالك، ١٧ أغسطس ٢٠٢٦): صفحةُ العائلة
  // الواحدة التي تُشغّل الأربعة — يُحال إليها ولا يُنسَخ نصُّها، ودليلُنا أخصُّ
  // منها. وهي بالقاعدة نفسِها: `<a>` يُفتَح إن نُقر ولا يُجلَب.
  ok(outward.every((v) => v === SITE || v === FAMILY || v === KIT),
    `${name}: ولا رابطَ خارجيّ إلا عنوانَنا وبوابةَ العائلة وحقيبةَ المعلم`);
  ok(text.includes(FAMILY),
    `${name}: ورابطُ عائلة التعليم الأولي حاضرٌ في القشرة (أمر المالك)`);

  // **و`mailto:` ليس ملفّاً يُطلَب**: هو فعلُ مراسلةٍ يفتحه المتصفّح إن نُقر، ولا
  // يُجلَب من شبكةٍ ولا من قرص — فيُستثنى من جرد الملفّات كما يُستثنى من الخارجيّ.
  const links = [...text.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1])
    .filter((v) => !/^(?:https?:)?\/\//.test(v) && !/^(?:mailto|tel):/.test(v));
  const missing = links.filter((v) => !existsSync(new URL(v, WELCOME)));
  ok(missing.length === 0,
    `${name}: وكلُّ ملفٍّ تطلبه موجود (${links.length} مرجعاً)`
    + (missing.length ? ' — مفقود: ' + missing.join('، ') : ''));

  const ids = new Set([...text.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const dangling = [...text.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => !ids.has(a));
  ok(dangling.length === 0,
    `${name}: وكلُّ رابطِ قفزٍ يجد قسمه`
    + (dangling.length ? ' — معلَّق: ' + dangling.join('، ') : ''));

  // **الصورةُ لا تُزحزح السطرَ ولا تُجلَب قبل أوانها** (شرطُ المدير في المرحلة
  // الثانية): صفحةٌ بثلاث عشرة لقطة تُحمَّل من الشبكة على جهاز معلّم.
  // **ويُستثنى صدرُ الصفحة**: تأجيلُ أول ما تراه العين يؤخّر أهمَّ صورةٍ فيها —
  // فصورُ الصدر (وهي التي قبل أول `</header>`) تُجلَب فوراً، وما بعدها يُؤجَّل.
  const imgs = [...text.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const heroEnd = text.indexOf('</header>', text.indexOf('class="w-hero"'));
  const inHero = (t) => text.indexOf(t) < heroEnd && heroEnd > 0;
  const loose = imgs.filter((t) => !/alt="/.test(t) || !/width="\d+"/.test(t)
    || !/height="\d+"/.test(t) || (!/loading="lazy"/.test(t) && !inHero(t)));
  ok(loose.length === 0,
    `${name}: ولكل صورةٍ (${imgs.length}) وصفُها وأبعادُها، و\`loading="lazy"\` لما بعد الصدر`
    + (loose.length ? ` — شذّت ${loose.length}` : ''));
}
ok(!/@import|url\(\s*["']?https?:/.test(css), 'والتنسيقُ لا يجلب من شبكة');

// ————— ٣. القشرة الواحدة وزرّ البدء —————

console.log('\n٣. القشرة الواحدة');

const TOP = /<header class="w-top">[\s\S]*?<\/header>/;
for (const [name, text] of Object.entries(PAGES)) {
  const bar = text.match(TOP)?.[0] || '';
  const tabs = ['./', 'curriculum.html', 'method.html', 'guide.html'];
  ok(tabs.every((href) => bar.includes(`href="${href}"`)),
    `${name}: شريطُ التنقّل الواحد بصفحاته الأربع`);
  ok((bar.match(/aria-current="page"/g) || []).length === 1,
    `${name}: وصفحتُها الحالية معلَّمةٌ لقارئ الشاشة (واحدةٌ لا اثنتان)`);
  ok(bar.includes('class="brand-word"'), `${name}: والعلامةُ في الشريط بصندوقها من app.css`);
  ok(/<a class="btn btn--primary" href="\.\.\/">/.test(bar), `${name}: وفيه دعوةٌ إلى التطبيق`);
  ok(text.includes('class="w-print-head"') && text.includes(SITE),
    `${name}: ولها ترويسةُ مطبوعٍ فيها عنوانُ الموقع`);
}

// الفعلُ الرئيس في متن الصفحة — والشريطُ مستثنىً بعلّته (دعوةٌ بحجم الشريط)
for (const [name, text] of Object.entries(PAGES)) {
  const body = text.replace(TOP, '');
  const starts = [...body.matchAll(/<a[^>]*href="\.\.\/"[^>]*>([^<]*)<\/a>/g)];
  if (!starts.length) continue;
  ok(starts.every((m) => /btn--primary/.test(m[0]) && /w-start/.test(m[0])),
    `${name}: وزرُّ «ابدأ الآن» في المتن هو الفعل الرئيس (${starts.length} موضعاً)`);
}
ok(/\.w-start\s*{[^}]*min-height:\s*4rem/.test(css), 'وارتفاعه في التنسيق ٤rem (٦٤ بكسل)');

// ————— ٤. اللوح من التطبيق لا منسوخاً، والخطوط محلّية —————

console.log('\n٤. اللوح والخطوط والطباعة');

const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
  .filter((c) => c !== '#fff' && c !== '#ffffff');
ok(hexes.length === 0,
  `تنسيق المرجع لا يكتب لوناً بقيمته${hexes.length ? ' — ' + [...new Set(hexes)].join('، ') : ''}`);
ok(PAGE_NAMES.every((n) => /href="\.\.\/css\/app\.css"/.test(PAGES[n])),
  'بل ترث الصفحاتُ الأربع لوح التطبيق وخطوطه من app.css');
ok(/var\(--paper\)|var\(--card\)/.test(css) && /var\(--ink/.test(css),
  'وتستعمل متغيّراته (ورق وبطاقة وحبر)');
ok(/@font-face\s*{[^}]*'Cairo'[^}]*fonts\/Cairo-arabic\.woff2/s.test(css)
  && existsSync(new URL('fonts/Cairo-arabic.woff2', WELCOME))
  && existsSync(new URL('fonts/Cairo-latin.woff2', WELCOME)),
  'وخطُّ العناوين Cairo مضمَّنٌ محلياً في welcome/fonts/ (حكم المدير)');
ok(!read('css/app.css', APP).includes('Cairo'), 'والتطبيق لم يُمَسّ خطاً (لا Cairo في app.css)');
const bareCss = css.replace(/\/\*[\s\S]*?\*\//g, '');   // بلا تعليقات: المنتقي لا شرحُه
ok(!/--font-brand|Marhey/.test(bareCss),
  'وعلامةُ «اِقْرَأْ» تبقى لخطّها وحدها (لا يطلبه هذا التنسيق)');

const print = css.slice(css.indexOf('@media print'));
for (const [rule, why] of [
  ['.w-top', 'شريطُ التنقّل يسقط من المطبوع'],
  ['break-inside: avoid', 'ولا تُقصّ بطاقةٌ بين ورقتين'],
  ['.w-print-head', 'وترويسةُ المطبوع تظهر على الورق وحدَه'],
]) ok(print.includes(rule), `الطباعة: ${why}`);
const head = cur.slice(cur.indexOf('class="w-print-head"'),
  cur.indexOf('</div>', cur.indexOf('class="w-print-head"')));
ok(/icons\/icon-192\.png/.test(head) && /class="brand-word"/.test(head) && head.includes(SITE),
  'وفيها أيقونةُ التطبيق وعلامتُه وعنوانُ الموقع (أمر المالك — من وقعت الورقةُ في يده بلغ صاحبَها)');

// ————— ٥. الأرقام — كلُّها محسوبة —————

console.log('\n٥. الأرقام');

const AR = '٠١٢٣٤٥٦٧٨٩';
const num = (s) => Number([...s].map((d) => (AR.indexOf(d) < 0 ? d : AR.indexOf(d))).join(''));

const shelf = LIBRARY.filter((s) => s.shelf);
const gardenTales = LIBRARY.filter((s) => s.garden);
const pageWords = (s) => s.pages.reduce((t, p) => t + p.words.length, 0);
const sections = progress.journey();
const nodesOf = (pick) => sections.filter(pick).reduce((t, s) => t + s.nodes.length, 0);
const gateOf = (id) => (s) => s.kind === 'gate' && s.gate.id === id;

const expected = {
  nodes: progress.allNodes().length,
  stars: progress.maxTotalStars(),
  letters: Object.keys(LETTERS).length,
  words: GROUPS.reduce((s, g) => s + g.words.length, 0)
    + GARDENS.reduce((s, g) => s + g.bundles.reduce((t, b) => t + b.words.length, 0), 0),
  sentences: RUNGS.reduce((s, r) => s + r.sentences.length, 0),
  stories: STORIES.length + LIBRARY.length,
  surahs: QURAN.surahs.length,
  groups: GROUPS.length,
  groupWords: GROUPS.reduce((s, g) => s + g.words.length, 0),
  skills: SKILLS.length,
  contrasts: CONTRASTS.length,
  pairs: CONTRASTS.reduce((s, c) => s + c.pairs.length, 0),
  quranStations: progress.quranSections().length,
  quranWords: QURAN.words.levels.reduce((s, l) => s + l.items.length, 0),
  quranLevels: QURAN.words.levels.length,
  hamzaShapes: QURAN.letters.signs[0].shapes.length,
  rasmSigns: rasmSigns().length,      // درسان بعد شقّ وز٢ — والعددُ عددُهما مجموعين
  muqattaat: QURAN.muqattaat.items.length,
  ayat: QURAN.surahs.reduce((s, x) => s + x.ayat.length, 0),
  surahWords: QURAN.surahs.reduce((s, x) => s + surahWords(x).length, 0),
  lexicon: GARDENS.reduce((s, g) => s + g.bundles.reduce((t, b) => t + b.words.length, 0), 0),
  bundlesPer: GARDENS[0].bundles.length,
  rungs: RUNGS.length,
  gardenStories: gardenTales.length,
  shelfStories: shelf.length,
  shelfPages: shelf.reduce((s, x) => s + x.pages.length, 0),
  shelfWords: shelf.reduce((s, x) => s + pageWords(x), 0),
  roots: ROOTS.length,
  rootMembers: ROOTS.reduce((s, r) => s + r.members.length, 0),
  icons: Object.keys(emojiIndex.files).length,
  audio: Object.keys(audioVersions).length + Object.keys(recitations.ayat).length,
  // المراحلُ الخمس الكبرى في الخطّ الزمنيّ — محسوبةٌ من الرحلة نفسِها
  stageFound: nodesOf((s) => ['group', 'interlude', 'contrast'].includes(s.kind)),
  stageQuran: nodesOf((s) => s.kind === 'quran') + nodesOf(gateOf('quran')),
  stageGarden: nodesOf((s) => ['garden', 'ladder'].includes(s.kind)) + nodesOf(gateOf('gardens')),
  stageLibrary: nodesOf((s) => ['library', 'roots'].includes(s.kind)),
  stageShelf: nodesOf((s) => s.kind === 'shelf'),
};

let statCount = 0;
for (const [name, text] of Object.entries(PAGES)) {
  const declared = [...new Set([...text.matchAll(/data-stat="([^"]+)"/g)].map((m) => m[1]))].sort();
  for (const key of declared) {
    const found = [...text.matchAll(new RegExp(`data-stat="${key}"[^>]*>([٠-٩]+)<`, 'g'))]
      .map((m) => num(m[1]));
    statCount += found.length;
    ok(expected[key] !== undefined && found.length > 0 && found.every((v) => v === expected[key]),
      `${name}: «${key}» = ${expected[key] ?? '؟'} في ${found.length} موضعاً`);
  }
}
ok(statCount > 40, `ومجموعُ المواضع المحسوبة ${statCount} في الصفحات الأربع`);
ok(expected.stageFound + expected.stageQuran + expected.stageGarden
  + expected.stageLibrary + expected.stageShelf === progress.allNodes().length,
  'ومجموعُ المراحل الخمس هو الرحلةُ كلُّها — لا محطةَ خارج مرحلة');

// ————— ٦. «لا محطةَ تُترك» — بطاقةٌ لكل نوع محطة بنمطها الواحد —————

console.log('\n٦. تغطية المحطات');

// **المطابقةُ محايدةٌ لهيئة الملف** (١١ أغسطس ٢٠٢٦): مرّت الصفحاتُ بمُنسِّقٍ آليّ
// في محرّر المالك (التزام «update email») فتوزّعت السماتُ والنصوصُ على أسطر —
// والمحتوى سليم. فالحارسُ يقارن **المعنى بعد توحيد الفراغات**، لا الهيئةَ التي
// يملكها المنسِّق: `\s+` بين السمات، و`flat()` للنصوص المنقولة.
const covers = [...cur.matchAll(/data-covers="([^"]+)"\s+data-count="([٠-٩]+)"/g)];
const nodeTypes = {};
for (const node of progress.allNodes()) nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
const covered = new Set(covers.map((m) => m[1]));
const missingTypes = Object.keys(nodeTypes).filter((t) => !covered.has(t));
const strayTypes = [...covered].filter((t) => !(t in nodeTypes));
ok(missingTypes.length === 0 && strayTypes.length === 0,
  `لكل نوع محطةٍ بطاقتُه (${covered.size} نوعاً)`
  + (missingTypes.length ? ` — بلا بطاقة: ${missingTypes.join('، ')}` : '')
  + (strayTypes.length ? ` — بطاقةٌ بلا محطة: ${strayTypes.join('، ')}` : ''));
for (const [, type, count] of covers) {
  ok(num(count) === nodeTypes[type], `وعددُ «${type}» في بطاقته = ${nodeTypes[type]}`);
}

// النمطُ الواحد لا يتبدّل: ثلاثةُ حقولٍ بترتيبها في كل بطاقةٍ في المرجع كلِّه
const PATTERN = ['ماذا ي', 'كيف يعمل', 'دورك أنت'];
let cardCount = 0;
const offPattern = [];
for (const [name, text] of Object.entries(PAGES)) {
  for (const card of text.split('<article class="w-station"').slice(1)) {
    cardCount++;
    const dts = [...card.slice(0, card.indexOf('</article>')).matchAll(/<dt>([^<]+)<\/dt>/g)]
      .map((m) => m[1]);
    if (dts.length !== 3) offPattern.push(`${name}: ${dts.length} حقول`);
  }
}
ok(offPattern.length === 0,
  `ونمطُ البطاقة ثلاثةُ حقولٍ في ${cardCount} بطاقة`
  + (offPattern.length ? ' — شذّت: ' + offPattern.join('، ') : ''));
const curCards = cur.split('<article class="w-station"').slice(1);
ok(curCards.every((card) => {
  const dts = [...card.slice(0, card.indexOf('</article>')).matchAll(/<dt>([^<]+)<\/dt>/g)]
    .map((m) => m[1]);
  return PATTERN.every((label, i) => (dts[i] || '').startsWith(label));
}), 'وترتيبُه في صفحة المنهج واحد: ماذا يتعلّم الطفل · كيف يعمل التمرين · دورُك أنت');

// اللقطاتُ من الشاشات نفسِها بمولّدها — ولكل بطاقةِ محطةٍ لقطتُها
const SHOTS = ['map', 'lesson', 'words', 'story', 'quran', 'parent',
  'gate', 'contrast', 'garden', 'ladder', 'roots', 'shelf', 'fade'];
const shown = new Set(Object.values(PAGES)
  .flatMap((t) => [...t.matchAll(/src="shots\/([a-z]+)\.png"/g)].map((m) => m[1])));
ok(SHOTS.every((s) => shown.has(s) && existsSync(new URL(`shots/${s}.png`, WELCOME)))
  && [...shown].every((s) => SHOTS.includes(s)),
  `و${SHOTS.length} لقطةً كلُّها معروضةٌ وموجودة (لا يتيمةَ ولا مفقودة)`);
ok([...cur.matchAll(/<div class="w-pair">/g)].length >= 12,
  'ولكل بطاقةِ محطةٍ في صفحة المنهج لقطتُها بجوارها');

// رموزُ الصفحات صورُ `app/emoji/` نفسِها لا محارفُ خطّ نظام
const faces = Object.values(PAGES)
  .flatMap((t) => [...t.matchAll(/\.\.\/emoji\/([0-9a-f-]+)\.svg/g)].map((m) => m[1]));
ok(faces.length > 0 && faces.every((k) => k in emojiIndex.files),
  `ورموزُها كلُّها من فهرس الأيقونات (${new Set(faces).size} رمزاً)`);

// ————— ٧. حارسُ التغطية: لا تسقط حقيقةٌ في إعادة التأليف —————
//
// حكمُ المدير: «أعِد التأليف ولا تنقل — وشرطُه حارسُ تغطية: لا تسقط في إعادة
// التأليف حقيقةٌ كانت معروضة». فهذا جردُ ما كانت الرئيسةُ تعرضه قبل الشقّ، ولكلٍّ
// **موضعُه الجديد** — والمحروسُ وجودُ الحقيقة لا حرفيّةُ صياغتها.

console.log('\n٧. تغطية ما كان في الرئيسة');

const WHERE = { 'index.html': html, 'curriculum.html': cur, 'method.html': method, 'guide.html': guide };
const INVENTORY = [
  // الأسسُ الخمسة التي كانت في الرئيسة — أُعيد تأليفُها بين «الرئيسة» و«الأسس»
  ['نورانية بتعديلات لا منقولة حرفاً', 'method.html',
    ['النورانية', 'مع تعديلات', 'لا منقولة حرفا']],
  ['ترتيب الحروف بالتواتر', 'method.html', ['التواتر', 'الأبجدي']],
  // **المحروسُ وجودُ الحقيقة لا حرفيّةُ صياغتها** (حكم المدير): فالكلماتُ المفتاحية
  // دالّةٌ على المعنى تحتمل إعادةَ الصياغة — وقد أُعيدت صياغةُ الرئيسة بلغةٍ قريبة
  // (أمر المالك، ١٣ أغسطس ٢٠٢٦) فبقيت الحقائقُ وتبدّل اللباس.
  ['لا حرفَ قبل درسه', 'index.html', ['لم يتعلمه', 'برنامج فحص']],
  ['صوتٌ مخزون وقارئٌ للمصحف', 'index.html', ['الحصري', 'بصوت آلي']],
  ['خصوصية مطلقة', 'index.html', ['خصوصية', 'لا يغادر']],
  // مسوّغاتُ دليل المعلم الأربعة وحدودُ النطاق
  ['مسوّغ: ترتيب المهارات مقابل النورانية', 'method.html', ['التنوين', 'السكون']],
  ['مسوّغ: القمرية قبل درس اللام', 'method.html', ['القمرية', 'الشمسية']],
  // وز١ (١٥ أغسطس ٢٠٢٦): كانت «البساتين بعد المرحلة القرآنية» بمسوّغ «تأسيسٌ ←
  // تتويجٌ ← توسُّع» — فصار التوزيعُ دفعاتٍ تتخلّلها، والخاتمةُ قرآنيةٌ كما كانت.
  ['مسوّغ: توزيعُ المرحلة القرآنية على البساتين', 'method.html',
    ['أربع دفعات تتخلل البساتين', 'الخاتمة تبقى قرآنية']],
  ['حدّ: لا يشخّص عسر القراءة', 'method.html', ['عسر القراءة']],
  ['حدّ: قراءةٌ لا كتابة', 'method.html', ['مسار القلم']],
  ['حدّ: الازدواجية تخفيفٌ لا إلغاء', 'method.html', ['لا إلغاء له']],
  ['حدّ: جمهورُه ٥–٧ سنوات', 'method.html', ['دون الخامسة']],
  // بابُ الصفّ
  ['في الصفّ: جهازٌ لكل طفل', 'guide.html', ['جهاز لكل طفل']],
  ['في الصفّ: اللوحة خلف البوابة', 'guide.html', ['خلف البوابة']],
  ['في الصفّ: التقدّم محليّ', 'guide.html', ['في هذا الجهاز وحده']],
  ['في الصفّ: ثلاثٌ إلى خمس دقائق', 'guide.html', ['ثلاث إلى خمس دقائق']],
  ['في الصفّ: البوّابتان نقطتا التوقّف', 'guide.html', ['البوابتان']],
  // التثبيت والنسخة الاحتياطية
  ['التثبيت: سفاري', 'guide.html', ['سفاري']],
  ['التثبيت: كروم', 'guide.html', ['كروم']],
  ['التثبيت: إيدج', 'guide.html', ['إيدج']],
  ['التثبيت: من التطبيق لا من الصفحة', 'guide.html', ['التعريفية ليست منه']],
  ['التنبيه: محو بيانات المتصفّح وعلاجه', 'guide.html', ['محو بيانات المتصفح', 'نسخة تحفظها أنت']],
  ['النسخة: بلا صوت الطفل', 'guide.html', ['ليس فيه صوت الطفل']],
  // ما زاد بعد الشقّ (تكليفُ المرحلة الثانية)
  ['الدليل: ‏?dev=1‏ وأدواته', 'guide.html', ['?dev=1']],
  ['الدليل: القفز والتصفير من اللوحة', 'guide.html', ['تحكّم في الرحلة']],
  ['الدليل: لوحة وليّ الأمر وكيف تُقرأ', 'guide.html', ['نحو القراءة الحرة', 'عائلات الجذور']],
  // **بوابة اللحاق** (الجلسة ل١، ١٦ أغسطس ٢٠٢٦): ميزةٌ تخصّ المدارس والمراكز
  // بعينها — فالمرجعُ يُعرَض عليها. وجردُها **حدودُها لا اسمُها**: تلميذٌ بمستوىً
  // قائم، وعتبةُ الاجتياز، والوقوفُ عند الشرخ، ولا-قفلَ-رجوعاً، وحدُّ البوّابة
  // والقرآنية — فوعدٌ أوسعُ من التطبيق يُسقِط هذا السطر يومَ يُكتب.
  ['الدليل: امتحان اللحاق ولمن هو', 'guide.html', ['امتحان اللحاق', 'يعرف حروفه أصلا']],
  ['الدليل: اللحاق — عتبتُه ووقوفُه عند الشرخ', 'guide.html',
    ['٨٠٪ يفتح له ويصعد', 'أول إخفاق ينهي']],
  ['الدليل: اللحاق — لا قفلَ رجوعاً وحدُّ البوّابة والقرآنية', 'guide.html',
    ['لا يغلق أبدا', 'بوابة إتقان', 'المصحف يتلى ولا يمتحن']],
  // **بطاقةُ أول تشغيل** (الجلسة د٣، ١٨ أغسطس ٢٠٢٦): بابٌ يُدَلّ عليه مرّةً واحدة —
  // وجردُه **حدودُه لا اسمُه**: رحلةٌ بكرٌ وحدَها، وتُخفى إلى الأبد، وزرُّها اللوحةُ
  // لا الامتحان، والتثبيتُ يتقدّم في المتصفّح. فوعدٌ أوسعُ يُسقِط هذا السطر.
  ['الدليل: بطاقةُ أول تشغيل وحدودُها', 'guide.html',
    ['على رحلة بكر', 'لا الامتحان رأسا', 'إلى الأبد بـ«لاحقاً» أو بأول نجمة',
      'ثبته على الجهاز', 'ولا تدعو إلى الامتحان']],
  // **وضعُ الدعم** (الجلسة د١، ١٧ أغسطس ٢٠٢٦): طبقةٌ تُعرَض على مركزٍ يمتحنها —
  // فجردُها **وعدُها وحدودُه** لا اسمُها: المنهجُ نفسُه (إيقاعٌ لا مادّة)، ومطفأٌ
  // ابتداءً، ولا يُحتسب المُعان إتقاناً، ومَن لا يخدمهم مسمَّون بأعيانهم، ولا وعدَ
  // بحجم أثر. فوعدٌ أوسعُ من التطبيق يُسقِط هذه السطور **يومَ يُكتب**.
  ['الدليل: وضعُ الدعم — إيقاعٌ لا مادّة', 'guide.html',
    ['وضع الدعم', 'المنهج نفسه بمحطاته نفسها', 'أبطأ لا أسهل']],
  ['الدليل: الدعم — مطفأٌ ابتداءً ومقابضُه تُطفأ فرادى', 'guide.html',
    ['مطفأ ابتداء', 'جرعةٌ أقصر', 'تشكيل ثابت']],
  ['الدليل: الدعم — لا يُحتسب المُعانُ إتقاناً', 'guide.html',
    ['لا يحتسب ما أعين', 'محاولةً معانة']],
  ['الدليل: الدعم — حدودُ وعده', 'guide.html',
    ['لا يشخص', 'غير الناطق', 'ولا يعد بحجم أثر']],
  // وثلاثةٌ من الجلسة د٢ (١٧ أغسطس ٢٠٢٦): التلميحُ **بنطاقه** لا مطلقاً، ومسطرةُ
  // الامتحان الواحدة، ومؤشّرُ الوضع على شاشة الطفل — فوعدٌ بلا حدّه يُسقِط سطرَه.
  ['الدليل: الدعم — التلميحُ في أوّل لقاءٍ وحدَه', 'guide.html',
    ['تلميحٌ في أول لقاء', 'أول لقاء بالمهارة وحده', 'لا في المراجعة ولا في الامتحانات']],
  ['الدليل: الدعم — مسطرةُ الامتحان الواحدة', 'guide.html',
    ['امتحان اللحاق بمسطرة واحدة', 'أسهل من امتحان غيره']],
  ['الدليل: الدعم — مؤشّرُ الوضع على شاشة الطفل', 'guide.html',
    ['علامة هادئة أعلى شاشة طفلك', 'تغيب حين تطفئ الوضع']],
  ['الرئيسة: وضعُ الدعم بسطره', 'index.html', ['وضع الدعم', 'ولا يعد بحجم أثر']],
];
// **والمقابلةُ على النصّ لا على الوسم** (١٨ أغسطس ٢٠٢٦): صار في الصفحات وسمُ
// عيّنةٍ (`w-word`) يلفّ الكلمة المشكولة داخل حقيقةٍ مجرودة، فيشقّ الوسمُ الحقيقةَ
// نصفين ويحمرّ الجردُ على محتوىً سليم. فتُنزَع الوسومُ قبل المطابقة — **والمحروسُ
// ما يقرؤه المعلّم لا ما يكتبه المؤلّف**.
const readable = (t) => t.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
for (const [label, page, needles] of INVENTORY) {
  const text = readable(WHERE[page]);
  const gone = needles.filter((n) => !text.includes(n.replace(/\s+/g, ' ')));
  ok(gone.length === 0, `«${label}» ← ${page}${gone.length ? ' — سقط: ' + gone.join('، ') : ''}`);
}

// ————— ٨. لا وعدَ بما ليس في التطبيق —————

console.log('\n٨. الوعود مقابلَ التطبيق');

for (const [label, src, where] of [
  ['انسخ تقدّم طفلي', parentJs, 'parent.js'],
  ['استعِد من ملف', parentJs, 'parent.js'],
  ['نسخة احتياطية من تقدّمه', parentJs, 'parent.js'],
  ['تحكّم في الرحلة', parentJs, 'parent.js'],
  ['افتح الطريق إلى هنا', parentJs, 'parent.js'],
  ['صفِّر هذه المحطة', parentJs, 'parent.js'],
  ['نحو القراءة الحرة', parentJs, 'parent.js'],
  ['عائلات الجذور', parentJs, 'parent.js'],
  ['امتحان اللحاق', parentJs, 'parent.js'],
  ['وضعُ الدعم', parentJs, 'parent.js'],
  ['أدوات التجربة (?dev=1)', mainJs, 'main.js'],
  ['أنجِز الكل بنجمة', mainJs, 'main.js'],
  ['أنجِز الكل بثلاث', mainJs, 'main.js'],
  ['محو التقدّم', mainJs, 'main.js'],
]) {
  ok(guide.includes(label) && src.includes(label),
    `«${label}» موعودٌ في الدليل وموجودٌ بنصّه في ${where}`);
}
ok(parentJs.includes('backupText') && /askPersistence|persistedStorage/.test(parentJs),
  'والتطبيق يصدّر النسخة ويطلب تخزيناً دائماً فعلاً');

// **ومقابضُ وضع الدعم بأسمائها من جدولها** (الجلسة د١): الصفحةُ تسمّيها لمعلّمٍ
// يقرؤها، والجدولُ يسمّيها لواليدٍ يقلّبها — فمقبضٌ يُعاد تسميتُه في `support.js`
// يُسقِط هذا السطر حتى تُصحَّح الصفحة، ولا يفترق الوعدُ عن المفتاح.
const guideFlat = guide.replace(/\s+/g, ' ');
const missingKnobs = PANEL_KEYS.map((k) => KNOBS[k].title).filter((t) => !guideFlat.includes(t));
ok(missingKnobs.length === 0,
  `ومقابضُ «وضع الدعم» كلُّها (${PANEL_KEYS.length}) بأسمائها من جدول support.js`
  + `${missingKnobs.length ? ' — سقط: ' + missingKnobs.join('، ') : ''}`);
// **وعددُها في الصفحة يطابق عددَها في الجدول**: مقبضٌ يُضاف ولا يُصحَّح عددُه في
// الدليل يُسقِط هذا السطر — كما وقع يومَ صار سابعَها «تلميحٌ في أول لقاء». (والعددُ
// مكتوبٌ لفظاً في نثر الصفحة، فجدولُ الألفاظ هنا مفتاحُ المقابلة لا رقمٌ ثانٍ.)
const COUNT_WORD = { 5: 'خمسة', 6: 'ستة', 7: 'سبعة', 8: 'ثمانية', 9: 'تسعة' };
const knobWord = COUNT_WORD[PANEL_KEYS.length];
ok(knobWord && guideFlat.includes(`${knobWord} مفاتيح`),
  `وعددُها في الدليل عددُها في الجدول (${knobWord || PANEL_KEYS.length} مفاتيح)`);

// ————— ٩. النصوصُ منقولةٌ من مصدرها لا مُعادةُ الصياغة —————

console.log('\n٩. النقل الحرفيّ من البيانات');

const flat = (t) => t.replace(/\s+/g, ' ');
const curFlat = flat(cur);
const has = (needle) => curFlat.includes(flat(needle));
const tatweel = (s) => s.replace(/ـ/g, '');
ok(GROUPS.every((g) => tatweel(curFlat).includes(g.letters.join(' '))),
  'وحروفُ كل مجموعةٍ مكتوبةٌ كما في البيانات');
ok(SKILLS.every((s) => has(s.title) && has(s.rule)), 'وقاعدةُ كل درسِ علامةٍ منقولةٌ بحرفها');
ok(CONTRASTS.every((c) => c.pairs.every((p) => tatweel(curFlat).includes(p.letters.join('/')))),
  'وأزواجُ «ميّز بين» السبعةُ كلُّها معروضة');
ok(GATES.every((g) => has(g.title)), 'والبوّابتان باسميهما');
ok(QURAN.surahs.every((s) => has(s.name)), 'وسورُ المرحلة الاثنتا عشرة بأسمائها');
ok(progress.quranSections().every((s) => has(s.title)),
  'ومحطاتُ المرحلة القرآنية بأسمائها المحسوبة من البيانات');
ok(GARDENS.every((g) => has(g.title)), 'والبساتين العشرة بأسمائها');
ok(ROOTS.every((r) => has(r.title) && has(r.sense)),
  'وشبكاتُ الجذور بأسمائها وسطورِ معانيها حرفاً بحرف');
ok(ROOTS.every((r) => r.members.every((m) => has(m))), 'وأعضاؤها السبعةُ والأربعون');
ok(LIBRARY.every((s) => has(s.title)), 'وقصصُ المكتبة والرفّ بعناوينها');

// عيّناتُ القراءة: بخطّ التطبيق، **ومن بياناته** — لا جملةً مؤلَّفةً لصفحة عرض
const samples = Object.values(PAGES)
  .flatMap((t) => [...t.matchAll(/<span class="w-sample"\s*>([^<]+)<\/span\s*>/g)].map((m) => flat(m[1]).trim()));
const sentenceTexts = new Set(SENTENCES.map((s) => s.text));
const storyLines = new Set(STORIES.flatMap((s) => s.sentences.map((x) => x.words.join(' '))));
ok(samples.length >= 3 && samples.every((t) => sentenceTexts.has(t) || storyLines.has(t)),
  `وعيّناتُ القراءة (${samples.length}) منقولةٌ من بيانات المنهج لا مؤلَّفةً هنا`);
ok(/\.w-sample\s*{[^}]*font-family:\s*var\(--font-letter\)/s.test(css),
  'وهي بخطّ التطبيق نفسِه — «ما يراه الوليّ هو ما ستراه الطفلة»');

// **ولا نصَّ مصحفٍ في صفحةِ عرض**: نصُّه لا يُكتب بأيدينا، فما يُرى منه لقطةُ تطبيق
const ayat = QURAN.surahs.flatMap((s) => s.ayat);
ok(PAGE_NAMES.every((n) => !/ٱ/.test(PAGES[n]) && !ayat.some((a) => PAGES[n].includes(a))),
  'ولا حرفَ من نصّ المصحف مكتوبٌ في صفحاتها (صورتُه من التطبيق لا نسخُه)');

// ————— ١٠. لغةُ الصفحات: نصٌّ للبالغ لا للطفل —————
//
// **أمرُ المالك** (١٣ أغسطس ٢٠٢٦): «الكلام كله غير واضح… راجع النص وتأكد من قابلية
// قراءته بدون تعليقات من المعلمين وأولياء الأمور». وعلله ثلاثٌ مقيسة: مصطلحاتٌ
// اخترعناها، وتركيبٌ أدبيّ يُقرأ مرّتين، **ونصٌّ مشكول** — والبالغُ يقرأ غيرَ
// المشكول أسرع، فالتشكيلُ للطفل لا لمن يقرأ عنه. **وحكمُ مدير المجموعة** (١٨
// أغسطس ٢٠٢٦): الحارسُ يُبنى **ولو قبل التنقية** — فقاعدةٌ بلا حارسٍ تعود بأوّل
// جلسةٍ تكتب فقرة، وهو عينُ صنفِ «فحصٌ لا يُشغَّل ليس حارساً».
//
// **والعتبةُ معلَنةٌ قبل القياس لا بعده** (سنّةُ اكتب في الرفض الكاذب): العتبةُ
// **صفرُ حركةٍ** في نثر المتن خارج العيّنات — لا نسبةٌ متسامحة يُتفاوَض عليها بعد
// أن يُرى الرقم. والمقيسُ **يومَ كُتب هذا الحارس وقبل أن تُنقَّى صفحةٌ واحدة**:
// الرئيسة ٣٠٢ حركة (٦٫٣٪) · المنهج ١٦٠٠ (١٢٫٠٪) · الأسس ٥٥٦ (٨٫٤٪) · الدليل ٧٤٨ (٨٫٤٪).
//
// **والاستثناءُ يُعلنه المؤلّفُ بالوسم لا يخمّنه الحارس**: قائمةٌ **مقفلة** من
// أصناف العيّنات (`w-word` · `w-sample` · `brand-word`) — ما داخلها مادّةُ طفلٍ
// تُعرَض كما يراها أو علامةُ «اِقْرَأْ»، فيبقى مشكولاً بحقّه؛ وما خرج عنها نثرٌ
// عتبتُه صفر. فلا يحكم الحارسُ بالظنّ على ما هو عيّنةٌ وما هو نثر.

console.log('\n١٠. لغةُ الصفحات');

// **المعروضُ لا الملفّ**: التعليقاتُ لا يراها قارئ (وفي تعليق رأس الرئيسة لفظان
// اليوم)، ولا `<script>` ولا `<style>` — ولا واحدَ منهما في هذه الصفحات أصلاً.
const shownOf = (t) => t.replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');

// **معجمُ الاستبدال المُلزِم** (بند «لغةُ البوّابة»): لكلِّ لفظٍ داخليٍّ بديلُه
// بكلماتٍ عادية — والحارسُ يمنع عودةَ الأوّل ويذكر الثاني في نصّ حمرته، فمن
// أحمره وجد العلاجَ معه ولا يعود إلى الوثائق.
const JARGON = {
  'مفكوكية': 'لا يقرأ الطفل حرفاً لم يتعلّمه',
  'معلَن': 'محدَّد مسبقاً',
  'مسوّغ': 'سبب',
  'رصيد': 'ما تعلّمه حتى الآن',
  'خفوت': 'تخفيف التشكيل تدريجياً',
  'عقدة': 'محطة',
  'جرد': 'حصر',
  'بنيويّ': 'في التصميم نفسه',
  'مطوَّعة': 'مع تعديلات',
  'تواتريّ': 'حسب كثرة استعماله',
  'مشقوقة': 'مأخوذة من نصّ السورة نفسه',
  'دفتر نسب': 'سجل يبيّن مصدر كل ملف',
  'لجام': 'ضابط',
};
// **ويُطابَق على العاري لا على المشكول**: النثرُ بعد التنقية بلا تشكيل، فمن كتب
// «معلن» عارياً وقع في اللفظ نفسِه — ولولا التعرية لأفلت من الحارس بحركةٍ ناقصة.
const bareOf = (s) => s.replace(/[ً-ْٰ]/g, '');
// **وحدودُ الكلمة بسوابقها لا بفراغها**: العربيةُ تلزق حروف الجرّ والتعريف، فلا
// يكفي `\b`. فالسابقةُ من قائمةٍ مقفلة واللاحقةُ حرّة — وبها لا تُمسك «الجامع»
// ولا «الجامد» بـ«لجام» (سابقتُهما ألفٌ ليست منها)، وتُمسك «تجرده» بـ«جرد».
const PREFIX = '(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل|ت|ي|ن)?';
const jargonRx = (term) => new RegExp(
  `(?:^|[^\\u0621-\\u064A\\u0671])(${PREFIX}${bareOf(term).replace(/ /g, '\\s+')}[\\u0621-\\u064A]*)`, 'g');

for (const [name, text] of Object.entries(PAGES)) {
  const shown = bareOf(shownOf(text));
  const hits = [];
  for (const [term, plain] of Object.entries(JARGON)) {
    const forms = [...new Set([...shown.matchAll(jargonRx(term))].map((m) => m[1].trim()))];
    if (forms.length) hits.push(`«${term}» (${forms.join('، ')}) ⇐ «${plain}»`);
  }
  // **و«يُصيَّر» تُطابَق مشكولةً وحدَها بعلّةٍ معلَنة**: «يصير» العارية كلمةٌ
  // عربية عادية، ومنعُها رفضٌ كاذب — والمشكولةُ يمنعها حارسُ التشكيل تحتها أصلاً.
  if (shownOf(text).includes('يُصيَّر')) hits.push('«يُصيَّر» ⇐ «يُعرض»');
  ok(hits.length === 0,
    `${name}: صفرُ لفظٍ داخليّ في معروضها${hits.length ? ` — ${hits.length}: ` + hits.join(' · ') : ''}`);
}

// **والتشكيلُ يُقاس في المتن وحدَه**: ما في `<head>` ليس نثراً يقرؤه معلّم — عنوانٌ
// في لسان المتصفّح ووصفٌ لمحرّك البحث، وفيهما العلامةُ مشكولةٌ بحكم الهوية ولا
// موضعَ لوسمٍ داخل `<title>`. فيُستثنى بعلّته لا صامتاً.
const SAMPLE_CLASSES = ['w-word', 'w-sample', 'brand-word'];
const dropSamples = (t) => t.replace(new RegExp(
  `<(\\w+)[^>]*class="[^"]*\\b(?:${SAMPLE_CLASSES.join('|')})\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'g'), ' ');
const HARAKAT = /[ً-ْٰ]/g;
const ARLETTER = /[ء-ي]/g;

for (const [name, text] of Object.entries(PAGES)) {
  const body = shownOf(text.slice(text.indexOf('<body')));
  const prose = dropSamples(body).replace(/<[^>]+>/g, ' ');   // العُقَدُ النصّية وحدَها
  const marks = (prose.match(HARAKAT) || []).length;
  const letters = (prose.match(ARLETTER) || []).length;
  const pct = ((100 * marks) / (letters || 1)).toFixed(2);
  // مواضعُ الحمرة بأعيانها: من أحمره عرف أيَّ سطرٍ يُنقّي أو أيَّ عيّنةٍ يوسم
  const worst = prose.split(/[\n.·—]/).map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => HARAKAT.test(s))
    .sort((a, b) => (b.match(HARAKAT) || []).length - (a.match(HARAKAT) || []).length)
    .slice(0, 3).map((s) => `«${s.slice(0, 60)}»`);
  ok(marks === 0,
    `${name}: تشكيلُ النثر خارج العيّنات ${marks} حركة في ${letters} حرفاً = ${pct}٪`
    + ` (العتبة المعلَنة: صفر)${marks ? ' — أثقلُها: ' + worst.join(' · ') : ''}`);
}

// **ولا وسمَ عيّنةٍ داخل سمة**: الوسمُ آليّةٌ جديدة، وأوّلُ ما تعطبه أن يقع
// `<span>` داخل `alt="…"` فينقطع نصُّ السمة عند أوّل علامة تنصيص — **والعطبُ لا
// يُرى في القياس** (قياسُ التشكيل على العُقَد النصّية، والسمةُ ليست عقدةً نصّية)
// وإنما يُرى حرفاً غريباً على الشاشة. وقع مرّتين يومَ وُسمت الصفحات فحُرِس.
{
  const inside = [];
  for (const [name, text] of Object.entries(PAGES)) {
    for (const m of text.matchAll(/<span class="(?:w-word|brand|brand-word)"/g)) {
      const before = text.slice(0, m.index);
      if (before.lastIndexOf('<') > before.lastIndexOf('>')) {
        inside.push(`${name}: …${text.slice(Math.max(0, m.index - 40), m.index).replace(/\s+/g, ' ')}`);
      }
    }
  }
  ok(inside.length === 0,
    'ولا وسمَ عيّنةٍ وقع داخل سمةٍ فقطعَ نصَّها'
    + (inside.length ? ` — ${inside.length}: ` + inside.join(' · ') : ''));
}

// وأصنافُ العيّنات مقفلةٌ فعلاً: صنفٌ رابع يُخترَع لإخفاء تشكيلٍ لا يعمل
{
  const declared = [...new Set(Object.values(PAGES).flatMap((t) => [...t.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(?:w-word|w-sample|brand-word)$/.test(c))))];
  ok(declared.length > 0 && declared.every((c) => SAMPLE_CLASSES.includes(c)),
    `وأصنافُ العيّنات المستعمَلة من القائمة المقفلة (${declared.sort().join(' · ')})`);
}

// ————— ١١. أيقوناتُ الواجهة: نسخةٌ واحدةٌ محروسة —————
//
// **خرقُ قاعدتنا نحن** (`DESIGN §٦`، وحكمُ المالك بالنظر ١٣ أغسطس ٢٠٢٦): رموزُ
// **البيانات** من Twemoji — كلماتُ الطفل وقصصُه ومحطاتُه — ورموزُ **الواجهة**
// أيقوناتُنا الخطية في `ICONS` بـ`ui.js`. وبطاقاتُ `w-card` بطاقاتُ واجهةٍ لا
// بيانات، فكانت تحمل ملصقاتٍ متناثرة لا لغةً بصرية واحدة مع التطبيق.
//
// **والفارقُ محروسٌ بموضعه**: وجهُ بطاقةِ واجهة (`.w-card .w-face`) أيقونةٌ خطية
// لا صورةَ رمز، ووجهُ بطاقةِ محطةٍ (`.w-station-head`) يبقى Twemoji — «أتصوّر
// البطاقةُ شيئاً من مادّة الطفل أم تزيّن فكرةَ واجهة؟».
//
// **والمصدرُ واحدٌ ولو نُسخ**: الصفحاتُ بلا جافاسكربت فلا تستورد `ui.js`، فيُدرَج
// المسارُ في HTML — **وهذه نسخةٌ تفترق يوماً ما لم تُحرَس**. فيُوسَم كلُّ
// `<svg data-icon="الاسم">` ويثبت الحارسُ أنّ مسارَه **عينُ** مسار `ICONS` حرفاً.

console.log('\n١١. أيقونات الواجهة');

// **ICONS تُقرأ من مصدرها لا تُستورَد**: `ui.js` يبني DOM فلا يعمل في node —
// والمقروءُ حرفيّةُ الكائن نفسِه: تعبيراتُ وصلٍ نصّية بلا سطرٍ يُنفَّذ.
const uiJs = read('js/ui.js', APP);
const iconsSrc = uiJs.slice(uiJs.indexOf('const ICONS = {'));
const ICONS = new Function(`return ${iconsSrc.slice(iconsSrc.indexOf('{'), iconsSrc.indexOf('\n};') + 2)}`)();
ok(Object.keys(ICONS).length > 10, `و\`ICONS\` مقروءةٌ من \`ui.js\` (${Object.keys(ICONS).length} أيقونة)`);

// **والمقابلةُ على المعنى لا الهيئة**: منسِّقُ المالك الآليّ يوزّع سماتَ الـSVG
// أسطراً ويزيد فراغاً قبل `/>` — فيُوحَّد الفراغُ بين الوسوم كما وُحّد في القسم ٦.
const svgNorm = (s) => s.replace(/\s*\/>/g, '/>').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
let iconUses = 0;
const wrongIcon = [];
for (const [name, text] of Object.entries(PAGES)) {
  for (const m of text.matchAll(/<svg[^>]*data-icon="([a-z]+)"[^>]*>([\s\S]*?)<\/svg\s*>/g)) {
    iconUses++;
    const [, icon, inner] = m;
    if (!ICONS[icon]) wrongIcon.push(`${name}: «${icon}» ليست في ICONS`);
    else if (svgNorm(inner) !== svgNorm(ICONS[icon])) wrongIcon.push(`${name}: «${icon}» مسارُها فارق مسارَ ICONS`);
  }
}
ok(wrongIcon.length === 0,
  `وكلُّ أيقونةٍ مُدرَجة عينُ مسارها في ICONS (${iconUses} إدراجاً)`
  + (wrongIcon.length ? ' — فارقت: ' + wrongIcon.join('، ') : ''));

// ولا `<svg>` يفلت من الوسم: إمّا أيقونةٌ محروسةٌ بمسارها، أو رسمٌ معلَنٌ بعنوانه
{
  const stray = [];
  for (const [name, text] of Object.entries(PAGES)) {
    for (const m of text.matchAll(/<svg[\s\S]*?>/g)) {
      const tag = m[0];
      if (/data-icon="/.test(tag)) continue;
      if (/role="img"/.test(tag) && /<title/.test(text.slice(m.index, m.index + 600))) continue;
      stray.push(`${name}: ${svgNorm(tag).slice(0, 60)}`);
    }
  }
  ok(stray.length === 0,
    `ولا رسمَ بلا وسم: أيقونةٌ بـ\`data-icon\` أو رسمٌ بـ\`role="img"\` وعنوانه`
    + (stray.length ? ' — شذّ: ' + stray.join('، ') : ''));
}

// وصفرُ Twemoji على وجه بطاقةِ واجهة — وهو العيبُ المقيس بعينه
{
  const CARD_FACE = /<div class="w-face"[^>]*>([\s\S]*?)<\/div\s*>/g;
  const leaks = [];
  let faces = 0;
  for (const [name, text] of Object.entries(PAGES)) {
    for (const m of text.matchAll(CARD_FACE)) {
      faces++;
      const code = m[1].match(/emoji\/([0-9a-f-]+)\.svg/);
      if (code) leaks.push(`${name}: ${code[1]}`);
    }
  }
  ok(faces > 0 && leaks.length === 0,
    `وصفرُ رمزِ بياناتٍ على وجه بطاقةِ واجهة (${faces} وجهاً)`
    + (leaks.length ? ` — بقي ${leaks.length}: ` + leaks.join('، ') : ''));
  // ورموزُ البيانات في موضعها باقية: وجوهُ المحطات Twemoji كما كانت
  const heads = Object.values(PAGES)
    .flatMap((t) => [...t.matchAll(/<div class="w-station-head"[^>]*>([\s\S]*?)<\/div\s*>/g)])
    .filter((m) => /emoji\/[0-9a-f-]+\.svg/.test(m[1]));
  ok(heads.length > 0, `ووجوهُ المحطات تبقى رموزَ بيانات من app/emoji/ (${heads.length} محطة)`);
}

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «المرجع التعريفي» ناجحة');
process.exit(fails ? 1 : 0);
