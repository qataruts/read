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

const starts = [...html.matchAll(/<a[^>]*href="\.\.\/"[^>]*>([^<]*)<\/a>/g)];
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
  ['who', 'ما «المُعلِّم» ولمن'],
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

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات الصفحة التعريفية ناجحة');
process.exit(fails ? 1 : 0);
