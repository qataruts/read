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
  GROUPS, LETTERS, STORIES, QURAN, SKILLS, CONTRASTS, GATES, ROOTS, surahWords,
} = await import(new URL('curriculum.js', JS));
const { GARDENS } = await import(new URL('lexicon.js', JS));
const { RUNGS, SENTENCES } = await import(new URL('sentences.js', JS));
const { LIBRARY } = await import(new URL('library.js', JS));
const emojiIndex = JSON.parse(read('emoji/index.json', APP));

const SITE = 'https://read.mishkat.qa/';          // الاستثناءُ المعلَن الوحيد

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
  ok(outward.every((v) => v === SITE) && outward.length <= 1,
    `${name}: ولا رابطَ خارجيّ إلا عنوانَ موقعنا في ترويسة المطبوع`);

  const links = [...text.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1])
    .filter((v) => !/^(?:https?:)?\/\//.test(v));
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
  const imgs = [...text.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const loose = imgs.filter((t) => !/alt="/.test(t) || !/width="\d+"/.test(t)
    || !/height="\d+"/.test(t) || !/loading="lazy"/.test(t));
  ok(loose.length === 0,
    `${name}: ولكل صورةٍ (${imgs.length}) وصفُها وأبعادُها و\`loading="lazy"\``
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
  rasmSigns: QURAN.rasm.signs.length,
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

const covers = [...cur.matchAll(/data-covers="([^"]+)" data-count="([٠-٩]+)"/g)];
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
const PATTERN = ['ماذا ي', 'كيف يعمل', 'دورُك أنت'];
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
  ['نورانية مطوَّعة', 'method.html', ['النورانية', 'مطوَّعةً']],
  ['ترتيب الحروف بالتواتر', 'method.html', ['التواتر', 'الأبجديّ']],
  ['مفكوكية ١٠٠٪ مفروضة آلياً', 'index.html', ['مفكوكيةٌ ١٠٠٪ مفروضةٌ آلياً']],
  ['صوتٌ مخزون وقارئٌ للمصحف', 'index.html', ['الحصري', 'لا نطقَ آليّاً']],
  ['خصوصية مطلقة', 'index.html', ['خصوصيةٌ مطلقة', 'لا يغادر جهازه']],
  // مسوّغاتُ دليل المعلم الأربعة وحدودُ النطاق
  ['مسوّغ: ترتيب المهارات مقابل النورانية', 'method.html', ['التنوين', 'السكون']],
  ['مسوّغ: القمرية قبل درس اللام', 'method.html', ['القمرية', 'الشمسية']],
  ['مسوّغ: البساتين بعد المرحلة القرآنية', 'method.html', ['تأسيسٌ ← تتويجٌ ← توسُّع']],
  ['حدّ: لا يشخّص عسر القراءة', 'method.html', ['عسر القراءة']],
  ['حدّ: قراءةٌ لا كتابة', 'method.html', ['مسارَ القلم']],
  ['حدّ: الازدواجية تخفيفٌ لا إلغاء', 'method.html', ['لا إلغاءٌ له']],
  ['حدّ: جمهورُه ٥–٧ سنوات', 'method.html', ['دون الخامسة']],
  // بابُ الصفّ
  ['في الصفّ: جهازٌ لكل طفل', 'guide.html', ['جهازٌ لكل طفل']],
  ['في الصفّ: اللوحة خلف البوابة', 'guide.html', ['خلف البوابة']],
  ['في الصفّ: التقدّم محليّ', 'guide.html', ['في هذا الجهاز وحده']],
  ['في الصفّ: ثلاثٌ إلى خمس دقائق', 'guide.html', ['ثلاثٌ إلى خمس دقائق']],
  ['في الصفّ: البوّابتان نقطتا التوقّف', 'guide.html', ['البوّابتان']],
  // التثبيت والنسخة الاحتياطية
  ['التثبيت: سفاري', 'guide.html', ['سفاري']],
  ['التثبيت: كروم', 'guide.html', ['كروم']],
  ['التثبيت: إيدج', 'guide.html', ['إيدج']],
  ['التثبيت: من التطبيق لا من الصفحة', 'guide.html', ['التعريفية ليست منه']],
  ['التنبيه: محو بيانات المتصفّح وعلاجه', 'guide.html', ['محو بيانات المتصفّح', 'نسخةٌ تحفظها أنت']],
  ['النسخة: بلا صوت الطفل', 'guide.html', ['ليس فيه صوتُ الطفل']],
  // ما زاد بعد الشقّ (تكليفُ المرحلة الثانية)
  ['الدليل: ‏?dev=1‏ وأدواته', 'guide.html', ['?dev=1']],
  ['الدليل: القفز والتصفير من اللوحة', 'guide.html', ['تحكّم في الرحلة']],
  ['الدليل: لوحة وليّ الأمر وكيف تُقرأ', 'guide.html', ['نحو القراءة الحرة', 'عائلات الجذور']],
];
for (const [label, page, needles] of INVENTORY) {
  const text = WHERE[page].replace(/\s+/g, ' ');
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

// ————— ٩. النصوصُ منقولةٌ من مصدرها لا مُعادةُ الصياغة —————

console.log('\n٩. النقل الحرفيّ من البيانات');

const has = (needle) => cur.includes(needle);
const tatweel = (s) => s.replace(/ـ/g, '');
ok(GROUPS.every((g) => tatweel(cur).includes(g.letters.join(' '))),
  'وحروفُ كل مجموعةٍ مكتوبةٌ كما في البيانات');
ok(SKILLS.every((s) => has(s.title) && has(s.rule)), 'وقاعدةُ كل درسِ علامةٍ منقولةٌ بحرفها');
ok(CONTRASTS.every((c) => c.pairs.every((p) => tatweel(cur).includes(p.letters.join('/')))),
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
  .flatMap((t) => [...t.matchAll(/<span class="w-sample">([^<]+)<\/span>/g)].map((m) => m[1].trim()));
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

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «المرجع التعريفي» ناجحة');
process.exit(fails ? 1 : 0);
