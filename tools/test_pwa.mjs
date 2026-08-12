// اختبار العمل دون إنترنت (PWA — الجلسة ٦):
//   node tools/test_pwa.mjs
// المحروس هنا ثلاثة:
//   ١) قائمة SHELL في app/sw.js لا تنسى ملفاً موجوداً في app/ ولا تعِد بملف غير موجود
//      — نسيانُ وحدة جافاسكربت واحدة يعني تطبيقاً معطوباً دون إنترنت، ولا يظهر إلا هناك.
//   ٢) بيان التطبيق (manifest) صالح: أيقوناته موجودة بمقاساتها، ولغته عربية.
//   ٣) الأصوات كلها مخزونة من بياناتها (لا قائمة يدوية تتخلّف عن المنهج) — والبيانان
//      اثنان: فهرس المولَّد، وبيان تلاوة القارئ (وصلة الجلسة ٩)، فتعمل التلاوة دون إنترنت.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const APP = new URL('../app/', import.meta.url);
const read = (p) => readFileSync(new URL(p, APP), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const audioManifest = JSON.parse(read('audio/manifest.json'));
const recitations = JSON.parse(read('data/recitations.json'));

// ————— ١. قائمة الهيكل تطابق ما في app/ فعلاً —————

const shell = [...sw.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1])
  .filter((p) => p !== './' && !p.includes('${'));

const onDisk = [];
const walk = (dir, prefix = '') => {
  for (const name of readdirSync(new URL(dir, APP))) {
    if (name.startsWith('.')) continue;
    const path = `${prefix}${name}`;
    if (statSync(new URL(path, APP)).isDirectory()) walk(`${path}/`, `${path}/`);
    else onDisk.push(path);
  }
};
walk('./');

// ملفات الهيكل: كل ما في app/ عدا ما يُخزَن من فهرسه (الأصوات وقصص المكتبة
// وأيقونات الرموز) وعامل الخدمة نفسه، **وعدا الصفحة التعريفية**: `welcome/` ليست
// من التطبيق — صفحةُ عرضٍ للمعلمين خارج القشرة عمداً (لا تُخزَّن ولا تَعُدّ نفسها
// منه)، ويحرس خروجَها `tools/test_welcome.mjs` بالشقّين: لا في SHELL، ولا يمسّها
// ردُّ التنقّل. والقصةُ الجديدة — والرمزُ الجديد — يدخلان المخزون بفهرسهما لا
// بسطرٍ يدويّ في sw.js.
const wanted = onDisk.filter((p) => !p.startsWith('audio/')
    || p === 'audio/manifest.json' || p === 'audio/versions.json')
  .filter((p) => !p.startsWith('data/stories/') || p === 'data/stories/index.json')
  .filter((p) => !p.startsWith('emoji/') || p === 'emoji/index.json')
  .filter((p) => !p.startsWith('welcome/'))
  .filter((p) => p !== 'sw.js');

const forgotten = wanted.filter((p) => !shell.includes(p));
ok(forgotten.length === 0,
  `قائمة SHELL تشمل كل ملفات التطبيق (${wanted.length} ملفاً)${forgotten.length ? ' — نُسي: ' + forgotten.join('، ') : ''}`);

const phantom = shell.filter((p) => !existsSync(new URL(p, APP)));
ok(phantom.length === 0,
  `ولا تعِد بملف غير موجود${phantom.length ? ' — ' + phantom.join('، ') : ''}`);
ok(sw.includes("'./'") && /index\.html/.test(sw), 'وتشمل جذر التطبيق وصفحته');

const inShell = shell.filter((p) => p.startsWith('welcome/'));
ok(inShell.length === 0,
  `ولا تشمل الصفحة التعريفية (خارج القشرة عمداً)${inShell.length ? ' — دخلت: ' + inShell.join('، ') : ''}`);

// كل وحدة جافاسكربت مستوردة فعلاً من شجرة main.js (لا ملف ميت في القائمة)
const modules = onDisk.filter((p) => p.startsWith('js/'));
const reachable = new Set(['js/main.js']);
for (let changed = true; changed;) {
  changed = false;
  for (const mod of [...reachable]) {
    for (const m of read(mod).matchAll(/from '\.\/([\w.]+\.js)'/g)) {
      const path = `js/${m[1]}`;
      if (!reachable.has(path)) { reachable.add(path); changed = true; }
    }
  }
}
const dead = modules.filter((p) => !reachable.has(p));
ok(dead.length === 0, `كل وحدات js مستوردة من شجرة main.js${dead.length ? ' — ميتة: ' + dead.join('، ') : ''}`);

// ————— ٢. الاستراتيجيتان: الأصوات من المخزون، والهيكل يُحدَّث في الخلفية —————

ok(/AUDIO_RE\s*=\s*\/.*audio.*mp3/.test(sw), 'الأصوات لها مسار خزنٍ خاص (اسمها sha1 نصِّها)');
// اسمُ الملف من نصّه لا من محتواه، فالخزن بالرابط وحده يُبقي جهازاً على صوتٍ
// قديم بعد أي استبدال — التفصيل والسيناريو الكامل في tools/test_audio_cache.mjs
ok(shell.includes('audio/versions.json') && sw.includes("json('audio/versions.json')"),
  'وبيانُ بصمات المحتوى مخزونٌ ومقروء (كسر الكاش عند استبدال صوتٍ تحت مفتاحه)');
// اسمُ المتغيّر ليس عقداً (صار `stem` حين دخلت ملفاتُ `wbw-` في الحزمة ١٢) — المقيس
// أن يُطلَب الرابط موسوماً ببصمة الملف، وأن يُكنَس وسمُه الأقدم.
ok(/\?v=\$\{tags\[\w+\]\}/.test(sw) && sw.includes('dropOtherTags'),
  'والخزن بالرابط الموسوم مع كنس الوسم الأقدم لذلك الملف وحده');
ok(sw.includes('cacheFirst') && sw.includes('staleWhileRevalidate'),
  'واستراتيجيتان: المخزون أولاً للصوت، والتحديث في الخلفية للهيكل');
ok(sw.includes('precacheAudio') && sw.includes('audio/manifest.json'),
  'وخزن الأصوات مشتقّ من الفهرس لا من قائمة يدوية '
  + `(${Object.keys(audioManifest).length} ملفاً اليوم)`);
ok(sw.includes('data/recitations.json') && /recitations\?\.ayat/.test(sw),
  'وتلاوةُ القارئ مخزونة معها من بيانها المستقلّ '
  + `(${Object.keys(recitations.ayat).length} تلاوة — فتعمل دون إنترنت)`);
ok(shell.includes('data/recitations.json'), 'وبيانُ التلاوة نفسه من ملفات الهيكل');
ok(sw.includes('precacheStories') && sw.includes('data/stories/index.json'),
  'وقصص المكتبة مخزونة من فهرسها لا من قائمة يدوية '
  + `(${JSON.parse(read('data/stories/index.json')).stories.length} قصة — فتُقرأ دون إنترنت)`);
ok(shell.includes('data/stories/index.json'), 'وفهرسُ المكتبة نفسه من ملفات الهيكل');
// أيقونات الرموز (مهمة «أيقونات لا إيموجي»): صارت الصورةُ ملفاً بعد أن كانت محرفاً
// يرسمه خطُّ الجهاز — وهي في «اقرأ واختر» و«أكمل الجملة» السؤالُ نفسُه لا زينتُه،
// فلولا خزنُها لظهر الطفلُ دون إنترنت أمام سؤالٍ بلا صورة.
const emojiIndex = JSON.parse(read('emoji/index.json'));
ok(sw.includes('precacheEmoji') && sw.includes('emoji/index.json'),
  'وأيقونات الرموز مخزونة من فهرسها لا من قائمة يدوية '
  + `(${Object.keys(emojiIndex.files).length} أيقونة — فتُرى دون إنترنت)`);
ok(shell.includes('emoji/index.json'), 'وفهرسُ الأيقونات نفسه من ملفات الهيكل');
ok(/request\.method !== 'GET'/.test(sw), 'ولا يعترض إلا طلبات GET');
ok(sw.includes('self.location.origin'), 'ولا يمسّ أي مصدر خارجي');
ok(/caches\.delete/.test(sw) && /SHELL_CACHE = `muallim-shell-\$\{VERSION\}`/.test(sw),
  'ورفع النسخة يمحو مخزون **القشرة** القديم (لا يعلَق طفل على نسخة قديمة)');

// ————— خفّة التخزين: مخزنُ الصوت يعبر النسخ، والجلبُ مدفَّعٌ معدودُ الإخفاق —————
//
// العيب المُغلَق هنا: مخزنُ الصوت كان موسوماً بالنسخة، فكلُّ تحديثٍ يولّد مخزناً فارغاً
// ويمحو السابق ⇒ إعادةُ تنزيل الصوت كلِّه على جهاز الطفلة في كل حزمة. والسلوكُ نفسُه
// مُثبَتٌ على `sw.js` الحيّ في `tools/test_audio_cache.mjs` (ترقيةٌ حقيقية بصفر جلب)
// وعلى Chrome في `browser_test.py --parent`؛ وهذه الثلاثةُ تحرس شكلَه في المصدر.

const audioFiles = Object.keys(audioManifest).length
  + Object.keys(recitations.ayat || {}).length + Object.keys(recitations.words || {}).length;
const audioCacheName = (sw.match(/const AUDIO_CACHE = ([^;]+);/) || [])[1] || '';
ok(!audioCacheName.includes('VERSION') && /^'[^'$]+'$/.test(audioCacheName.trim()),
  `اسمُ مخزن الصوت ثابتٌ لا يحمل النسخة (${audioCacheName.trim() || 'غائب'})`
  + ` — فلا يعيد التحديثُ تنزيل ${audioFiles} ملفاً صوتياً`);

const precache = sw.slice(sw.indexOf('async function precacheAudio'))
  .split('\n}\n')[0];
const batch = Number((sw.match(/const AUDIO_BATCH = (\d+);/) || [])[1]);
ok(batch >= 12 && batch <= 16 && /for \(.*AUDIO_BATCH\)/.test(precache) && /\.slice\(/.test(precache),
  `والتخزين المسبق مُدفَّعٌ متتابع (${batch || 'بلا حدّ'} في الدفعة، لا ${audioFiles} طلباً دفعةً واحدة)`);
ok(/\.keys\(\)/.test(precache) && /filter\(\(url\) => !have\.has\(url\)\)/.test(precache),
  'ولا يُطلَب من الشبكة إلا الناقص (`cache.add` يجلب دائماً وإن كان مخزوناً)');
ok(!/catch\(\(\) => \{\}\)/.test(precache) && /failed \+=/.test(precache)
  && /if \(failed\) return\b/.test(precache),
  'والإخفاقاتُ معدودةٌ لا مبتلعة، وإن وقع إخفاقٌ فلا كنسَ (صيانةً للقديم الصالح)');

// **ولا يُحذف مخزونٌ قديم إلا بعد ثبوت تمام الجديد** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦:
// جهازٌ صمت صوتُه لأنّ الكامل حُذف والجديدُ لم يكتمل). والتمامُ يُحسب من البيانات
// والمخزن معاً في `audioComplete()` — لا من متغيّرٍ في ذاكرة عاملٍ قد يُبعث من جديد.
const activate = sw.slice(sw.indexOf("addEventListener('activate'"));
ok(/async function audioComplete/.test(sw) && /await audioComplete\(\)/.test(activate),
  'ولا يُمحى مخزونُ صوتٍ قديم إلا بعد جردٍ يثبت تمامَ الجديد');
ok(/await syncAudio\(\)/.test(activate)
  && activate.indexOf('syncAudio()') < activate.indexOf('audioComplete()'),
  'والتبنّي والاستكمالُ قبل الحكم بالتمام (وإلا حُكم بالنقص على مخزنٍ لم يُملأ بعد)');
// **وحالُ التحميل تُرى وتُدار** (أمر المالك، ١٣ أغسطس ٢٠٢٦): الخزنُ الصامت أوقع
// المالكَ نفسَه في ظنٍّ خاطئ يوم صمت الصوت — فصار العاملُ يبلّغ تقدّمَه بعد كل دفعة،
// ويقبل طلباً صريحاً بالتحميل الآن؛ وتعرضهما لوحةُ وليّ الأمر شريطاً وزرّاً.
ok(/type: 'audio-progress'/.test(sw) && /clients\.matchAll/.test(sw),
  'والعاملُ يبلّغ النوافذَ بتقدّم خزن الصوت (لا يخزّن صامتاً)');
ok(/addEventListener\('message'/.test(sw) && /'audio-sync'/.test(sw),
  'ويقبل طلبَ «نزّل الأصوات الآن» صريحاً بلا انتظار مهلة');
const panelSrc = read('js/parent.js');
ok(/audio-progress/.test(panelSrc) && /audio-sync/.test(panelSrc) && /dl-bar/.test(panelSrc),
  'ولوحةُ وليّ الأمر تعرض شريطاً حيّاً وزرَّ تحميلٍ يدويّ');

ok(/event\.waitUntil\(healAudio\(\)\)/.test(sw) && /HEAL_AFTER/.test(sw)
  && /if \(healed \|\| syncing\) return;/.test(sw)
  && /if \(await audioComplete\(\)\) return;/.test(sw),
  'وللناقص شفاءٌ — مرّةً في عمر العامل، بعد مهلةٍ تمضي للطفل، ولا يعمل على مخزونٍ تامّ');
const panel = read('js/parent.js');
ok(read('js/progress.js').includes('export async function audioStored')
  && panel.includes('progress.audioStored()') && panel.includes('الأصوات المخزونة'),
  'وعددُ المخزون معروضٌ في لوحة وليّ الأمر (فلا يفاجئه صمتٌ لا يعرف سببه)');

// ————— ٣. بيان التطبيق —————

ok(manifest.name && manifest.short_name, `اسم التطبيق: ${manifest.short_name}`);
ok(manifest.lang === 'ar' && manifest.dir === 'rtl', 'لغته عربية واتجاهه من اليمين');
ok(manifest.display === 'standalone', 'ويُفتح كتطبيق مستقلّ (لا شريط متصفّح يشتّت الطفل)');
ok(manifest.start_url === './' && manifest.scope === './',
  'ومساره نسبيّ (يعمل من أي مجلد على أي خادم)');
ok(manifest.icons.length >= 3, `وله ${manifest.icons.length} أيقونات`);
ok(manifest.icons.some((i) => i.purpose === 'maskable'),
  'منها مقنَّعة (maskable) لأيقونة أندرويد المستديرة');

const png = (path) => {
  const data = readFileSync(new URL(path, APP));
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) return null;
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};
for (const icon of manifest.icons) {
  const [w] = png(icon.src) || [];
  ok(String(w) === icon.sizes.split('x')[0], `${icon.src}: ملف PNG بمقاس ${icon.sizes}`);
}
ok(!!png('icons/apple-touch-icon.png'), 'وأيقونة آيفون/آيباد موجودة');

// ————— ٤. الوصل في الصفحة والتسجيل في الشيفرة —————

const html = read('index.html');
ok(/rel="manifest"/.test(html), 'الصفحة توصل البيان (rel="manifest")');
ok(/apple-touch-icon/.test(html), 'وأيقونة آبل موصولة');
ok(/theme-color/.test(html) && html.includes(manifest.theme_color),
  `ولون الواجهة موحَّد بين الصفحة والبيان (${manifest.theme_color})`);

const main = read('js/main.js');
ok(main.includes('serviceWorker') && main.includes('sw.js'), 'وmain.js يسجّل عامل الخدمة');
ok(main.includes("location.protocol.startsWith('http')"),
  'ولا يحاول التسجيل من file:// (يرفضه المتصفّح فيلوّث السجلّ)');
ok(/\.catch\(/.test(main.slice(main.indexOf('registerServiceWorker'))),
  'ورفضُ التسجيل لا يُسقِط التطبيق');

// ————— ٥. المقياس: قرصةُ الطفل حرة، والعودةُ من الخلفية بمقياس ١ —————
//
// بلاغان متعاقبان من المالك (١١ أغسطس ٢٠٢٦): الأول — iPadOS يسترجع المثبَّتَ
// مكبَّراً أحياناً؛ والثاني **نقضَ علاجَ الأول** — قفلُ الميتا الشامل حرم الطفلَ
// قرصةً كان يكبّر بها الصفحةَ ليرى التشكيل («أمرٌ مريح وتلقائي»). فالعقدُ الآن:
// **لا قفلَ في الميتا** (القرصةُ حق)، والعودةُ للواجهة تشدّ المقياسَ إلى ١ لحظةً
// ثم تردّ الحرية (`resetZoom` في main.js)، والنقرُ المزدوج العارض وحدَه ساقطٌ
// باللوح. وهذا الحارسُ نفسُه كان يحرس القفلَ فقُلب — **بلاغُ الميدان فوق الحارس**.

const viewport = (html.match(/<meta name="viewport" content="([^"]+)"/) || [])[1] || '';
ok(!/maximum-scale|user-scalable/.test(viewport),
  'ميتا التطبيق لا تقفل المقياس — قرصةُ الطفل لرؤية التشكيل حقٌّ (بلاغ الميدان الثاني)');
ok(/touch-action:\s*manipulation/.test(read('css/app.css')),
  'واللوح يُسقِط تكبيرَ النقر المزدوج العارض وحدَه (touch-action) — والقرصةُ لا تُمَسّ');
ok(main.includes("meta[name=\"viewport\"]") && main.includes('pageshow')
  && /resetZoom[\s\S]{0,400}maximum-scale=1/.test(main)
  && /setTimeout\(\(\) => viewportMeta\.setAttribute\('content', viewportFree\)/.test(main),
  'والعودةُ من الخلفية تشدّ المقياس إلى ١ لحظةً ثم تردّ الحرية — علاجُ الاسترجاع في موضعه وحده');
for (const page of ['index.html', 'curriculum.html', 'method.html', 'guide.html']) {
  ok(!/user-scalable=no|maximum-scale/.test(read(`welcome/${page}`)),
    `welcome/${page}: تبقى قابلةً للتكبير — صفحةُ كبارٍ والتكبيرُ فيها حقّ`);
}

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات العمل دون إنترنت ناجحة');
process.exit(fails ? 1 : 0);
