// اختبار الصفحة التعريفية (`app/welcome/` — جلسة الصفحة التعريفية):
//   node tools/test_welcome.mjs
//
// المحروس هنا خمسة، وكلها شروطُ قبولٍ لا زينة:
//   ١) **خارج التطبيق**: لا في قائمة SHELL، ولا يجيب عنها عاملُ الخدمة، ولا تسجّل
//      عاملاً، ولا تصل بيان التطبيق (manifest) — فلا تدخل PWA المثبَّتة بحال.
//   ٢) **لا مرجع شبكيّ خارجي البتّة**: كل ما تطلبه ملفٌّ في هذا المستودع، وكلّ ملفٍّ
//      تطلبه موجودٌ فعلاً (رابطٌ مكسور في صفحة عرضٍ للمدارس أسوأ من لا صفحة).
//   ٣) **زرّ البدء ينقل إلى التطبيق** (`../`) وهو الفعل الرئيس (DESIGN §٥.١).
//   ٤) **اللوح ليس منسوخاً**: الصفحة لا تكتب لوناً بقيمته، بل تستعمل متغيّرات
//      `app.css` — فلا لوحان يفترقان (DESIGN §٢).
//   ٥) **أرقامها صادقة**: كل رقمٍ تعده على المعلّم (المحطات، النجوم، الحروف،
//      الكلمات، الجمل، القصص، السور) يُحسب من بيانات المنهج نفسِها ويُقارَن.
//      ومعها: أقسامُ التكليف الخمسة، ومسوّغاتُ دليل المعلم الأربعة، ولقطاتُه.

import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('app/', ROOT);
const WELCOME = new URL('welcome/', APP);
const read = (path, base = WELCOME) => readFileSync(new URL(path, base), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const html = read('index.html');
const css = read('welcome.css');
const sw = read('sw.js', APP);

// بيانات المنهج — منها تُحسب أرقام الصفحة (لا تُصدَّق كما كُتبت)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const JS = new URL('js/', APP);
const progress = await import(new URL('progress.js', JS));
const { GROUPS, LETTERS, STORIES, QURAN } = await import(new URL('curriculum.js', JS));
const { GARDENS } = await import(new URL('lexicon.js', JS));
const { RUNGS } = await import(new URL('sentences.js', JS));
const { LIBRARY } = await import(new URL('library.js', JS));

// ————— ١. خارج التطبيق وخارج قشرة عامل الخدمة —————

ok(!/<link[^>]*rel=["']manifest["']/.test(html), 'الصفحة لا تصل بيان التطبيق (لا تُثبَّت مكانه)');
ok(!/serviceWorker/.test(html), 'ولا تسجّل عامل خدمة');
ok(!/<script/i.test(html), 'ولا تحمل سطر جافاسكربت واحداً (لا شيء يعمل فيها أصلاً)');
ok(/const WELCOME = new URL\('welcome\/'/.test(sw), 'وعامل الخدمة يعرف مسارها مشتقّاً من نطاقه');
// ردُّ التنقّل يجيب index.html عن كل تنقّلٍ في النطاق — فلولا الاستثناء **قبله**
// لفُتح التطبيقُ مكان الصفحة على كل جهازٍ ثبّته، فلا تُرى الصفحة أبداً.
const bypass = sw.indexOf('url.pathname.startsWith(WELCOME)');
ok(bypass > 0, 'ويستثنيها من الاعتراض فلا تُخزَّن ولا يُجاب عنها من المخزون');
ok(bypass > 0 && bypass < sw.indexOf("request.mode === 'navigate'"),
  'والاستثناء قبل ردّ التنقّل (وإلا ابتلعها فتح التطبيق مكانها)');

// ————— ٢. لا مرجع شبكيّ خارجي، ولا رابط مكسور —————

const external = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
  .filter((v) => /^(https?:)?\/\//.test(v) || v.startsWith('data:'));
ok(external.length === 0,
  `لا مرجع شبكيّ خارجي في الصفحة${external.length ? ' — ' + external.join('، ') : ''}`);
ok(!/@import|url\(\s*["']?https?:/.test(css), 'ولا في تنسيقها');

const links = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1])
  .filter((v) => !v.startsWith('#'));
const missing = links.filter((v) => !existsSync(new URL(v, WELCOME)));
ok(missing.length === 0,
  `وكل ملفٍّ تطلبه موجود (${links.length} مرجعاً)${missing.length ? ' — مفقود: ' + missing.join('، ') : ''}`);

const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
const dangling = anchors.filter((a) => !ids.has(a));
ok(dangling.length === 0,
  `وكل رابطٍ داخليّ يجد قسمه${dangling.length ? ' — معلَّق: ' + dangling.join('، ') : ''}`);

// ————— ٣. زرّ البدء —————
//
// **وشريطُ التنقّل مستثنىً بعلّته** (حزمة «المرجع التعريفي»): فيه دعوةٌ صغيرة إلى
// التطبيق بحجم الشريط لا بحجم الفعل الرئيس — والمحروسُ هنا الفعلُ الرئيس في متن
// الصفحة. فيُقصّ الشريطُ قبل الجرد، ويُفحَص وحدَه في §٧.
const body = html.replace(/<header class="w-top">[\s\S]*?<\/header>/, '');
const starts = [...body.matchAll(/<a[^>]*href="\.\.\/"[^>]*>([^<]*)<\/a>/g)];
ok(starts.length >= 1, `زرّ «ابدأ الآن» ينقل إلى التطبيق (../) — ${starts.length} موضعاً`);
ok(starts.every((m) => /btn--primary/.test(m[0]) && /w-start/.test(m[0])),
  'وهو الفعل الرئيس بلون النجمة وبهدف لمسٍ ≥ ٦٤ بكسل');
ok(/\.w-start\s*{[^}]*min-height:\s*4rem/.test(css), 'وارتفاعه في التنسيق ٤rem (٦٤ بكسل)');

// ————— ٤. اللوح من التطبيق لا منسوخاً —————

const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
  .filter((c) => c !== '#fff' && c !== '#ffffff');
ok(hexes.length === 0,
  `تنسيق الصفحة لا يكتب لوناً بقيمته${hexes.length ? ' — ' + [...new Set(hexes)].join('، ') : ''}`);
ok(/href="\.\.\/css\/app\.css"/.test(html), 'بل يرث لوح التطبيق وخطوطه من app.css');
ok(/var\(--paper\)|var\(--card\)/.test(css) && /var\(--ink/.test(css),
  'ويستعمل متغيّراته (ورق وبطاقة وحبر)');

// ————— ٥. الأرقام والأقسام —————

const AR = '٠١٢٣٤٥٦٧٨٩';
const num = (s) => Number([...s].map((d) => (AR.indexOf(d) < 0 ? d : AR.indexOf(d))).join(''));
const stat = (name) => {
  const m = html.match(new RegExp(`data-stat="${name}"[^>]*>([٠-٩]+)<`));
  return m ? num(m[1]) : null;
};

const expected = {
  nodes: progress.allNodes().length,
  stars: progress.maxTotalStars(),
  letters: Object.keys(LETTERS).length,
  words: GROUPS.reduce((s, g) => s + g.words.length, 0)
    + GARDENS.reduce((s, g) => s + g.bundles.reduce((t, b) => t + b.words.length, 0), 0),
  sentences: RUNGS.reduce((s, r) => s + r.sentences.length, 0),
  stories: STORIES.length + LIBRARY.length,
  surahs: QURAN.surahs.length,
};
for (const [name, value] of Object.entries(expected)) {
  ok(stat(name) === value, `الرقم «${name}» في الصفحة = ${value} (المحسوب من المنهج)`);
}

for (const [id, title] of [
  ['who', 'ما «اِقْرَأْ» ولمن'],
  ['basis', 'الأسس الخمسة'],
  ['journey', 'رحلة التعلم بلقطات حقيقية'],
  ['install', 'تثبيت التطبيق على الجهاز'],
  ['guide', 'دليل المعلم'],
]) {
  ok(ids.has(id) && anchors.includes(id), `قسم «${title}» موجودٌ وله رابطه المباشر`);
}

ok((html.match(/class="w-num"/g) || []).length === 5, 'والأسس المعروضة خمسة');

// مسوّغات الدليل الأربعة (تكليف الجلسة، ومادّتها في docs/PEDAGOGY_AUDIT.md)
const guide = html.slice(html.indexOf('id="guide"'));
const guideWhys = guide.split('<div class="w-why"').slice(1);
ok(guideWhys.length === 4, `مسوّغات دليل المعلم أربعة (وجدت ${guideWhys.length})`);
for (const [key, label] of [
  ['التنوين', 'ترتيب المهارات مقابل النورانية'],
  ['القمرية', 'القمرية قبل درس اللام'],
  ['البساتين', 'البساتين بعد المرحلة القرآنية'],
  ['عسر القراءة', 'حدود النطاق'],
]) {
  ok(guideWhys.some((w) => w.includes(key)), `ومنها مسوّغ «${label}»`);
}

ok(/جهازٌ لكل طفل/.test(html) && /خلف البوابة/.test(html) && /في هذا الجهاز وحده/.test(html),
  'وباب استعماله مع مجموعة يذكر: جهازاً لكل طفل، واللوحة خلف البوابة، والتقدّم محليّاً');

// خطوات التثبيت الثلاث (بأمر المالك في هذه الجلسة): آيباد وأندرويد وحاسوب
for (const key of ['سفاري', 'كروم', 'إيدج']) {
  ok(html.includes(key), `ودليل التثبيت يذكر «${key}»`);
}
ok(/هذه الصفحة\s+التعريفية ليست منه/.test(html.replace(/\s+/g, ' ')),
  'وينبّه أن التثبيت من التطبيق لا من هذه الصفحة (لا بيان لها فلا تُثبَّت)');

// ————— ٦. حفظ التقدّم واستعادته (الحزمة ١١) —————
//
// أمرُ المالك: تُشرَح النسخة الاحتياطية في قسم التثبيت **بعد** أن يُنجزها التطبيق.
// فالمحروس هنا شقّان: أن الشرح موجود بخطواته، و**أن التطبيق يفي به حرفياً** —
// أسماءُ الأزرار التي تَعِد بها الصفحة تُقابَل بأسمائها في `app/js/parent.js` نفسِه،
// فلا تَعِد الصفحةُ المعلّمَ بزرٍّ لا وجود له (وهي عينُ علّة تأجيل هذه الفقرة).

const install = html.slice(html.indexOf('id="install"'), html.indexOf('id="guide"'));
const parentJs = read('js/parent.js', APP);

for (const label of ['انسخ تقدّم طفلي', 'استعِد من ملف']) {
  ok(install.includes(label), `قسم التثبيت يشرح زرّ «${label}»`);
  ok(parentJs.includes(label), `وهو موجودٌ بنصّه في لوحة وليّ الأمر (لا وعدَ بما ليس في التطبيق)`);
}
ok(/لوحة وليّ الأمر/.test(install), 'ويدلّ على موضعه: لوحة وليّ الأمر خلف بوابتها');
ok((install.match(/<ol>/g) || []).length >= 4,
  'والاستعادة مشروحة خطواتٍ مرقّمة كخطوات التثبيت');
ok(/محو بيانات المتصفّح/.test(install) && /نسخةٌ تحفظها أنت/.test(install),
  'والتنبيه القائم صار يدلّ على علاجه (لا تحذيرٌ بلا مخرج)');
ok(/ليس فيه صوتُ الطفل/.test(install) && /لا تغادر\s+جهازه/.test(install.replace(/\s+/g, ' ')),
  'ويصرّح بأن النسخة بلا صوت الطفل (قاعدة الخصوصية لا تُنقض بملفٍّ يُنسَخ)');
ok(parentJs.includes('backupText') && /askPersistence|persistedStorage/.test(parentJs),
  'والتطبيق يصدّر النسخة ويطلب تخزيناً دائماً فعلاً');

const shots = [...html.matchAll(/src="(shots\/[^"]+)"/g)].map((m) => m[1]);
ok(shots.length === 6 && new Set(shots).size === 6, `ومعرضُ الرحلة ست لقطاتٍ (${shots.length})`);
ok(shots.every((s) => existsSync(new URL(s, WELCOME))), 'وكلها ملفات موجودة');
ok([...html.matchAll(/<img[^>]*>/g)].every((m) => /alt="/.test(m[0])), 'ولكل صورةٍ وصفُها البديل');

// ————— ٧. «المرجع التعريفي» — القشرة الواحدة وصفحةُ المنهج (١٢ أغسطس ٢٠٢٦) —————
//
// أمرُ المالك: «كل أقسام والمراحل الرئيسية للتعليم… البيانات واضحة ومكتملة بطريقة
// عرض احترافية». والمحروسُ هنا ثلاثةٌ لا يُدرَك أحدُها بالنظر:
//   (أ) **قشرةٌ واحدة**: شريطُ التنقّل نفسُه في كل صفحة، وما لم يُبنَ يُعلَن ولا يُربَط.
//   (ب) **لا محطةَ تُترك**: لكل **نوع محطةٍ** في `journey()` بطاقتُه بوسم `data-covers`،
//       وعددُها في البطاقة هو عددُها في الرحلة — فنوعٌ جديد يُضاف غداً يُسقِط الفحص.
//   (ج) **الأرقام والنصوص محسوبةٌ ومنقولة**: كلُّ رقمٍ من البيانات، وقواعدُ الدروس
//       ومعاني الجذور وعيّناتُ القراءة **منقولةٌ حرفاً** من مصدرها لا مُعادةُ الصياغة.

console.log('\n٧. المرجع التعريفي — القشرة وصفحة المنهج');

const cur = read('curriculum.html');
const { SKILLS, CONTRASTS, GATES, ROOTS, surahWords } = await import(new URL('curriculum.js', JS));
const { SENTENCES } = await import(new URL('sentences.js', JS));
const emojiIndex = JSON.parse(read('emoji/index.json', APP));

// (أ) القشرة الواحدة
const TOP = /<header class="w-top">[\s\S]*?<\/header>/;
const PAGES = { 'index.html': html, 'curriculum.html': cur };
for (const [name, text] of Object.entries(PAGES)) {
  const bar = text.match(TOP)?.[0] || '';
  ok(bar.includes('href="./"') && bar.includes('href="curriculum.html"'),
    `${name}: شريطُ التنقّل الواحد فيه الرئيسةُ والمنهج`);
  ok(/<span>الأسس<\/span>/.test(bar) && /<span>الدليل العملي<\/span>/.test(bar),
    `${name}: والصفحتان اللتان لم تُبنيا مُعلَنتان بلا رابطٍ مكسور`);
  ok((bar.match(/aria-current="page"/g) || []).length === 1,
    `${name}: وصفحتُها الحالية معلَّمةٌ لقارئ الشاشة`);
  ok(bar.includes('class="brand-word"'), `${name}: والعلامةُ في الشريط بصندوقها من app.css`);
}

// (ب) صفحةُ المنهج تخضع لقوانين `welcome/` كلِّها كأختها
ok(!/<script/i.test(cur), 'صفحة المنهج: صفر جافاسكربت');
ok(!/<link[^>]*rel=["']manifest["']/.test(cur) && !/serviceWorker/.test(cur),
  'ولا تصل بيان التطبيق ولا تسجّل عاملاً');
const curExternal = [...cur.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
  .filter((v) => /^(?:https?:)?\/\//.test(v) || v.startsWith('data:'));
ok(curExternal.length === 0,
  `ولا مرجعَ شبكيّاً خارجياً${curExternal.length ? ' — ' + curExternal.join('، ') : ''}`);
const curLinks = [...cur.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);
const curMissing = curLinks.filter((v) => !existsSync(new URL(v, WELCOME)));
ok(curMissing.length === 0,
  `وكل ملفٍّ تطلبه موجود (${curLinks.length} مرجعاً)${curMissing.length ? ' — مفقود: ' + curMissing.join('، ') : ''}`);
const curIds = new Set([...cur.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
const curDangling = [...cur.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => !curIds.has(a));
ok(curDangling.length === 0,
  `وكل رابطِ قفزٍ يجد قسمه${curDangling.length ? ' — معلَّق: ' + curDangling.join('، ') : ''}`);
ok([...cur.matchAll(/<img[^>]*>/g)].every((m) => /alt="/.test(m[0])), 'ولكل صورةٍ وصفُها البديل');

// رموزُها صورُ `app/emoji/` نفسِها لا محارفُ خطّ نظام (مهمة «أيقونات لا إيموجي»)
const curFaces = [...cur.matchAll(/\.\.\/emoji\/([0-9a-f-]+)\.svg/g)].map((m) => m[1]);
ok(curFaces.length > 0 && curFaces.every((k) => k in emojiIndex.files),
  `ورموزُها من فهرس الأيقونات (${new Set(curFaces).size} رمزاً)`);

// خطّ العناوين: عربيُّ الأصل، محلّيّ، ولا يُمَسّ خطُّ التطبيق ولا خطُّ العلامة
ok(/@font-face\s*{[^}]*'Cairo'[^}]*fonts\/Cairo-arabic\.woff2/s.test(css),
  'خطّ العناوين Cairo مضمَّنٌ محلياً في welcome.css (لا شبكة)');
ok(existsSync(new URL('fonts/Cairo-arabic.woff2', WELCOME))
  && existsSync(new URL('fonts/Cairo-latin.woff2', WELCOME)), 'وملفّاه في welcome/fonts/');
ok(!read('css/app.css', APP).includes('Cairo'), 'والتطبيق لم يُمَسّ خطاً (لا Cairo في app.css)');
const bareCss = css.replace(/\/\*[\s\S]*?\*\//g, '');   // بلا تعليقات: المطلوب المنتقي لا شرحُه
ok(!/--font-brand|Marhey/.test(bareCss),
  'وعلامةُ «اِقْرَأْ» تبقى لخطّها وحدها (لا يطلبه هذا التنسيق)');

// (ج) الطباعة النظيفة: صفحةُ المنهج تخرج ملفاً يُسلَّم لمدرسة
const print = css.slice(css.indexOf('@media print'));
for (const [rule, why] of [
  ['.w-top', 'شريطُ التنقّل يسقط من المطبوع'],
  ['break-inside: avoid', 'ولا تُقصّ بطاقةٌ بين ورقتين'],
  ['.w-print-head', 'وترويسةُ المطبوع تظهر على الورق وحدَه'],
]) ok(print.includes(rule), `الطباعة: ${why}`);
ok(cur.includes('class="w-print-head"'), 'وصفحةُ المنهج تحمل ترويسةَ مطبوعها');

// ————— «لا محطةَ تُترك»: بطاقةٌ لكل نوع محطة، بنمطها الواحد —————

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

// النمطُ الواحد لا يتبدّل: ثلاثةُ حقولٍ بترتيبها في كل بطاقة
const cards = cur.split('<article class="w-station"').slice(1);
const PATTERN = ['ماذا يتعلّم الطفل', 'كيف يعمل التمرين', 'دورُك أنت'];
const offPattern = cards.filter((card) => {
  const dts = [...card.slice(0, card.indexOf('</article>')).matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  return dts.length !== 3 || dts.some((d, i) => !d.startsWith(PATTERN[i].slice(0, 6)));
});
ok(offPattern.length === 0,
  `ونمطُ البطاقة واحدٌ في ${cards.length} بطاقة: ${PATTERN.join(' · ')}`
  + (offPattern.length ? ` — شذّت ${offPattern.length}` : ''));

// ————— أرقامُ صفحة المنهج — كلُّها محسوبة —————

const stats = (name, text = cur) =>
  [...text.matchAll(new RegExp(`data-stat="${name}"[^>]*>([٠-٩]+)<`, 'g'))].map((m) => num(m[1]));

const shelf = LIBRARY.filter((s) => s.shelf);
const gardenTales = LIBRARY.filter((s) => s.garden);
const pageWords = (s) => s.pages.reduce((t, p) => t + p.words.length, 0);
const sections = progress.journey();
const nodesOf = (pick) => sections.filter(pick).reduce((t, s) => t + s.nodes.length, 0);
const gateOf = (id) => (s) => s.kind === 'gate' && s.gate.id === id;

const curExpected = {
  ...expected,
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

const declared = new Set([...cur.matchAll(/data-stat="([^"]+)"/g)].map((m) => m[1]));
for (const name of [...declared].sort()) {
  const found = stats(name);
  const want = curExpected[name];
  ok(want !== undefined && found.length > 0 && found.every((v) => v === want),
    `الرقم «${name}» = ${want ?? '؟'} في ${found.length} موضعاً (المحسوب من المنهج)`);
}
ok(curExpected.stageFound + curExpected.stageQuran + curExpected.stageGarden
  + curExpected.stageLibrary + curExpected.stageShelf === progress.allNodes().length,
  'ومجموعُ المراحل الخمس هو الرحلةُ كلُّها — لا محطةَ خارج مرحلة');

// ————— النصوصُ منقولةٌ من مصدرها لا مُعادةُ الصياغة —————

const has = (needle) => cur.includes(needle);
const tatweel = (s) => s.replace(/ـ/g, '');
ok(GROUPS.every((g) => tatweel(cur).includes(g.letters.join(' '))),
  'وحروفُ كل مجموعةٍ مكتوبةٌ كما في البيانات');
ok(SKILLS.every((s) => has(s.title) && has(s.rule)),
  'وقاعدةُ كل درسِ علامةٍ منقولةٌ بحرفها');
ok(CONTRASTS.every((c) => c.pairs.every((p) => tatweel(cur).includes(p.letters.join('/')))),
  'وأزواجُ «ميّز بين» السبعةُ كلُّها معروضة');
ok(GATES.every((g) => has(g.title)), 'والبوّابتان باسميهما');
ok(QURAN.surahs.every((s) => has(s.name)), `وسورُ المرحلة الاثنتا عشرة بأسمائها`);
ok(progress.quranSections().every((s) => has(s.title)),
  'ومحطاتُ المرحلة القرآنية بأسمائها المحسوبة من البيانات');
ok(GARDENS.every((g) => has(g.title)), 'والبساتين العشرة بأسمائها');
ok(ROOTS.every((r) => has(r.title) && has(r.sense)),
  'وشبكاتُ الجذور بأسمائها وسطورِ معانيها حرفاً بحرف');
ok(ROOTS.every((r) => r.members.every((m) => has(m))), 'وأعضاؤها السبعةُ والأربعون');
ok(LIBRARY.every((s) => has(s.title)), 'وقصصُ المكتبة والرفّ بعناوينها');

// عيّناتُ القراءة: بخطّ التطبيق، **ومن بياناته** — لا جملةً مؤلَّفةً لصفحة عرض
const samples = [...cur.matchAll(/<span class="w-sample">([^<]+)<\/span>/g)].map((m) => m[1].trim());
const sentenceTexts = new Set(SENTENCES.map((s) => s.text));
const storyLines = new Set(STORIES.flatMap((s) => s.sentences.map((x) => x.words.join(' '))));
ok(samples.length >= 3 && samples.every((t) => sentenceTexts.has(t) || storyLines.has(t)),
  `وعيّناتُ القراءة (${samples.length}) منقولةٌ من بيانات المنهج لا مؤلَّفةً هنا`);
ok(/\.w-sample\s*{[^}]*font-family:\s*var\(--font-letter\)/s.test(css),
  'وهي بخطّ التطبيق نفسِه — «ما يراه الوليّ هو ما ستراه الطفلة»');

// **ولا نصَّ مصحفٍ في صفحة عرض**: نصُّه لا يُكتب بأيدينا، فما يُرى منه لقطةُ تطبيق
const ayat = QURAN.surahs.flatMap((s) => s.ayat);
ok(!/ٱ/.test(cur) && !ayat.some((a) => cur.includes(a)),
  'ولا حرفَ من نصّ المصحف مكتوبٌ في الصفحة (صورتُه من التطبيق لا نسخُه)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات الصفحة التعريفية ناجحة');
process.exit(fails ? 1 : 0);
