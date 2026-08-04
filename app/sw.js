// عامل الخدمة — التطبيق يعمل دون إنترنت (الجلسة ٦).
//
// لماذا هذا مهمّ هنا بالذات: الصوت كله ملفات مخزونة أصلاً (قاعدة المشروع الثابتة)،
// فلا ينقص التطبيقَ للعمل دون شبكة إلا خزنُ الهيكل والملفات. بعد أول فتح يعمل
// «المُعلِّم» كاملاً في الطائرة وفي السيارة وفي بيت بلا إنترنت — وهو حال أكثر
// من يحتاجه.
//
// استراتيجيتان لا ثالثة:
//   • الهيكل (HTML/CSS/JS/الفهارس): اعرض المخزون فوراً وحدِّثه في الخلفية
//     (stale-while-revalidate) — فتحٌ فوريّ، والتحديث يظهر في الفتحة التالية.
//   • الصوت (mp3): من المخزون دائماً — **بالرابط الموسوم ببصمة محتواه**.
//
// **ولماذا الوسم؟** اسم ملف الصوت sha1 **نصّه** لا محتواه، فاستبدال الصوت تحت
// المفتاح نفسه (edge ← Sulafat، وانتقاء المدود، وأيّ تسجيل بشري بديل) لا يغيّر
// الرابط — والجهاز الذي خزّن النسخة القديمة يبقى عليها إلى الأبد، فيُسمع الحرف
// الواحد بصوتين بحسب تاريخ أول طلبٍ لكل جهاز (بلاغ المالك، ٥ أغسطس ٢٠٢٦).
// فصار التطبيق يطلب `<key>.mp3?v=<بصمة البايتات>` من `audio/versions.json`
// و`data/recitations.json`، وهنا **يُخزَن بالرابط الموسوم ويُنظَّف الوسم الأقدم
// لذلك الملف وحده** — فتبديل ملفٍّ واحد لا يُسقِط مخزون البقية.
//
// والصوت هنا **بيانان لا واحد**: فهرس الأصوات المولّدة (`audio/manifest.json`
// وبصماتُه `audio/versions.json`) وبيان التلاوة بصوت القارئ مع بصماته
// (`data/recitations.json`) — منفصلان عمداً (نصّ المصحف ممنوع من فهرس المولَّد)،
// ويُخزَن كلاهما فتعمل التلاوة دون إنترنت كبقية الأصوات.
//
// عند تغيير أي ملف من ملفات الهيكل: ارفع VERSION فيُمحى المخزون القديم كله.
// ويحرس اختبار `tools/test_pwa.mjs` أن قائمة SHELL لا تنسى ملفاً موجوداً في app/،
// و`tools/test_audio_cache.mjs` يشغّل هذا الملف نفسَه على كاشٍ وشبكةٍ مزيَّفين.

const VERSION = 'v17';  // v17: خفوت التشكيل ز١→ز٣ (وحدة fade.js في القشرة)
const SHELL_CACHE = `muallim-shell-${VERSION}`;
const AUDIO_CACHE = `muallim-audio-${VERSION}`;
const KEEP = [SHELL_CACHE, AUDIO_CACHE];

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'data/lexicon.json',
  'data/recitations.json',
  'data/stories/index.json',
  'fonts/NotoNaskhArabic-arabic.woff2',
  'fonts/NotoNaskhArabic-latin.woff2',
  'fonts/BalooBhaijaan2-arabic.woff2',
  'fonts/BalooBhaijaan2-latin.woff2',
  'fonts/KFGQPCUthmanicHafs.woff2',
  'fonts/Marhey-arabic.woff2',
  'js/audio.js',
  'js/contrast.js',
  'js/curriculum.js',
  'js/fade.js',
  'js/garden.js',
  'js/roots.js',
  'js/gate.js',
  'js/ladder.js',
  'js/lesson.js',
  'js/library.js',
  'js/lexicon.js',
  'js/main.js',
  'js/parent.js',
  'js/progress.js',
  'js/quran.js',
  'js/recitation.js',
  'js/recorder.js',
  'js/recordings.js',
  'js/review.js',
  'js/screens.js',
  'js/sentences.js',
  'js/skill.js',
  'js/story.js',
  'js/ui.js',
  'js/words.js',
  'audio/manifest.json',
  'audio/versions.json',
  'emoji/index.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

// ملفات الصوت: مفتاحٌ من ١٢ خانة، وقد يسبقه وسمُ تلاوة الكلمة المفردة `wbw-`
// (الحزمة ١٢) — وهو يفصل ملفَّ المصحف عن ملفٍّ مولَّد له المفتاح نفسُه.
const AUDIO_RE = /\/audio\/(wbw-)?[0-9a-f]{12}\.mp3$/;

// مسار الصفحة التعريفية (`app/welcome/`) — ليست من التطبيق: لا في SHELL ولا في
// المخزون ولا في ردّ التنقّل. مشتقٌّ من النطاق فيصحّ في أي مجلدٍ نُشر فيه التطبيق.
const WELCOME = new URL('welcome/', self.registration.scope).pathname;

const json = (path) => fetch(new URL(path, self.registration.scope))
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);

/** خزن قصص المكتبة **من فهرسها** لا من قائمة يدوية (كما تُخزَن الأصوات من بيانها):
 *  فإضافة قصةٍ جديدة لا تحتاج سطراً في هذا الملف — الفهرس وحده مصدر الحقيقة. */
async function precacheStories() {
  const index = await json('data/stories/index.json');
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all((index?.stories || []).map((id) =>
    cache.add(new URL(`data/stories/${id}.json`, self.registration.scope)).catch(() => {})));
}

/** خزن أيقونات الرموز **من فهرسها** (مهمة «أيقونات لا إيموجي»).
 *
 *  رفعُ نسخةٍ مبرَّرٌ هنا: كانت الصور محارفَ يرسمها خطُّ الجهاز فلا وزنَ لها، وصارت
 *  ملفات SVG — فلولا خزنُها لظهر الطفلُ دون إنترنت أمام كلماتٍ بلا صور، وهي في
 *  «اقرأ واختر» و«أكمل الجملة» السؤالُ نفسُه لا زينتَه. وثمنُها نصفُ ميغابايت مرّةً
 *  واحدة (أقلُّ من ملفَّي صوت).
 *
 *  ومن الفهرس لا من قائمةٍ يدوية هنا — كالأصوات والقصص سواءً: رمزٌ جديد في المنهج
 *  غداً يجلبه `tools/fetch_twemoji.py` فيدخل المخزون بلا سطرٍ في هذا الملف. */
async function precacheEmoji() {
  const index = await json('emoji/index.json');
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(Object.keys(index?.files || {}).map((key) =>
    cache.add(new URL(`emoji/${key}.svg`, self.registration.scope)).catch(() => {})));
}

/** رابط ملف صوتٍ باسمه على القرص، موسوماً ببصمة محتواه (بلا بصمة: الرابط كما هو). */
function audioUrl(stem, tags) {
  const href = new URL(`audio/${stem}.mp3`, self.registration.scope).href;
  return tags[stem] ? `${href}?v=${tags[stem]}` : href;
}

/** خزن الأصوات كلها من بياناتها — بعدها لا يحتاج التطبيق شبكةً البتّة.
 *  البيانان: فهرس المولَّد، وبيان التلاوة بصوت القارئ (كلاهما «مفتاح ← نصّ»)،
 *  ومع كلٍّ بصماتُ محتواه فيُخزَن بالرابط الذي يطلبه التطبيق نفسِه.
 *  ثم **تُكنَس الأوسمة الغابرة**: كل مخزونٍ ليس في المتوقَّع اليوم (وسمٌ أقدم
 *  لملفٍ استُبدل، أو رابطٌ بلا وسم خُزن قبل قراءة البصمات) يُحذف — فلا يبقى في
 *  الجهاز أثرٌ للصوت القديم يُسمَع من طريقٍ آخر. */
async function precacheAudio() {
  const cache = await caches.open(AUDIO_CACHE);
  const [generated, versions, recitations] = await Promise.all([
    json('audio/manifest.json'), json('audio/versions.json'), json('data/recitations.json'),
  ]);
  const tags = { ...(versions || {}), ...(recitations?.v || {}) };
  // أسماءُ الملفات لا المفاتيح: تلاوةُ الكلمة المفردة تُخزَن باسمها الموسوم `wbw-`
  const stems = [...Object.keys(generated || {}), ...Object.keys(recitations?.ayat || {}),
    ...Object.keys(recitations?.words || {}).map((key) => `wbw-${key}`)];
  const urls = stems.map((stem) => audioUrl(stem, tags));
  // واحداً واحداً: ملفٌ ناقص لا يُسقِط الخزن كله (بخلاف cache.addAll)
  await Promise.all(urls.map((url) => cache.add(url).catch(() => {})));

  if (!generated) return;            // بيانٌ لم يصل: لا نكنس على غير علم
  const wanted = new Set(urls);
  const stale = (await cache.keys()).filter((request) => !wanted.has(request.url));
  await Promise.all(stale.map((request) => cache.delete(request)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map((path) =>
      cache.add(new URL(path, self.registration.scope)).catch(() => {})));
    await precacheStories();
    await precacheEmoji();
    await precacheAudio();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('muallim-') && !KEEP.includes(n))
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

/**
 * الصوت: المخزون أولاً **بالرابط الموسوم**.
 * وسمٌ جديد = مفتاحُ خزنٍ جديد = طلبُ شبكةٍ لهذا الملف وحده، وبعد خزنه يُحذف
 * وسمُه الأقدم فوراً (فلا نسختان لملفٍ واحد، ولا يعود القديم من باب خلفيّ).
 * وإن سقطت الشبكة ولم يكن الوسمُ الجديد مخزوناً: نسخةٌ بوسمٍ أقدم خيرٌ من صمتٍ
 * في أذن الطفل — نُخرجها ولا نخزنها بالوسم الجديد، فتُصحَّح أول اتصال.
 */
async function cacheFirst(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request).catch(() => null);
  if (response && response.ok) {
    await cache.put(request, response.clone());
    await dropOtherTags(cache, request);
    return response;
  }
  return (await cache.match(request, { ignoreSearch: true })) || response || Response.error();
}

/** حذف ما خُزن لهذا الملف بأوسمةٍ أخرى (أو بلا وسم) — إبقاءُ الجديد وحده. */
async function dropOtherTags(cache, request) {
  const siblings = await cache.keys(request, { ignoreSearch: true });
  await Promise.all(siblings
    .filter((other) => other.url !== request.url)
    .map((other) => cache.delete(other)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // لا مصدر خارجياً في هذا التطبيق أصلاً

  // الصفحة التعريفية خارج القشرة عمداً (جلسة الصفحة التعريفية): لا تُخزَّن، ولا
  // يبتلعها ردُّ التنقّل أدناه — ولولا هذا السطر لفُتح التطبيقُ مكانَها على كل جهازٍ
  // ثبّته، فلا يبلغ المعلّمُ الصفحةَ أصلاً. تُترك للشبكة كأنّ لا عاملَ خدمةٍ هنا.
  if (url.pathname.startsWith(WELCOME)) return;

  if (AUDIO_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // التنقّل دائماً إلى index.html: التطبيق صفحة واحدة بمسارات hash
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(new Request(new URL('index.html', self.registration.scope))));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
