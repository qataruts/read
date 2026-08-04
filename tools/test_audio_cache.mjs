// اختبار كسر كاش الصوت ببصمة المحتوى (إصلاح عيب خلط الأصوات القديمة بالجديدة):
//   node tools/test_audio_cache.mjs
//
// **العيب المحروس هنا**: اسم ملف الصوت sha1 **نصّه** لا محتواه، فاستبدال صوتٍ
// تحت المفتاح نفسه (edge ← Sulafat، وانتقاء المدود، وأي تسجيل بشري بديل) لا
// يغيّر الرابط — والجهاز الذي خزّن النسخة القديمة في عامل الخدمة يبقى عليها،
// فيُسمع الحرف الواحد بصوتين بحسب تاريخ أول طلبٍ لكل جهاز.
//
// والفحص شطران:
//   ١) على الشجرة الحقيقية: كل بصمة في البيانين تطابق بايتات ملفها فعلاً
//      (بصمةٌ كاذبة أخطر من غيابها: رابطٌ لا يتغيّر باستبدال المحتوى = العيب عائداً)،
//      والتطبيق يطلب الرابط موسوماً.
//   ٢) على `app/sw.js` **نفسِه** يُشغَّل في بيئة كاشٍ وشبكةٍ مزيَّفين: نستبدل
//      محتوى ملفٍ واحد ونثبت أن التطبيق يخدم الجديد فوراً، وأن غير المستبدل
//      يبقى من المخزون بلا طلبٍ شبكيّ واحد.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

// ————————————— ١. البصمات على الشجرة الحقيقية —————————————

console.log('\n١. بصمات المحتوى تطابق البايتات');

const audioManifest = JSON.parse(read('app/audio/manifest.json'));
const versionsPath = new URL('app/audio/versions.json', ROOT);
ok(existsSync(versionsPath), 'بيان البصمات موجود (app/audio/versions.json)');
const versions = existsSync(versionsPath) ? JSON.parse(read('app/audio/versions.json')) : {};

const fingerprint = (key) =>
  createHash('sha1').update(readFileSync(new URL(`app/audio/${key}.mp3`, ROOT))).digest('hex').slice(0, 8);

const onDisk = Object.keys(audioManifest)
  .filter((key) => existsSync(new URL(`app/audio/${key}.mp3`, ROOT)));
const wrong = onDisk.filter((key) => versions[key] !== fingerprint(key));
ok(wrong.length === 0,
  `كل ملفات الفهرس مبصومة ببايتاتها (${onDisk.length} ملفاً)`
  + (wrong.length ? ` — مخالفة أو غائبة: ${wrong.slice(0, 6).join('، ')}`
    + ' (أصلحها بـ`generate_audio.py --sync-versions`)' : ''));

const extra = Object.keys(versions).filter((key) => !(key in audioManifest));
ok(extra.length === 0, `ولا بصمة لمفتاح خارج الفهرس${extra.length ? ' — ' + extra.slice(0, 6).join('، ') : ''}`);

const recitations = JSON.parse(read('app/data/recitations.json'));
const rKeys = Object.keys(recitations.ayat || {})
  .filter((key) => existsSync(new URL(`app/audio/${key}.mp3`, ROOT)));
const rWrong = rKeys.filter((key) => (recitations.v || {})[key] !== fingerprint(key));
ok(rWrong.length === 0,
  `وتلاواتُ القارئ مبصومة ببيانها المستقلّ (${rKeys.length} تلاوة)`
  + (rWrong.length ? ` — مخالفة: ${rWrong.slice(0, 6).join('، ')}` : ''));

const shared = Object.keys(versions).filter((key) => key in (recitations.ayat || {}));
ok(shared.length === 0, 'والبيانان منفصلان: لا مفتاح مصحفٍ في بصمات المولَّد');

// ————————————— ٢. التطبيق يطلب الرابط موسوماً —————————————

console.log('\n٢. وحدتا الصوت تطلبان الرابط موسوماً');

const audioJs = read('app/js/audio.js');
const recitationJs = read('app/js/recitation.js');
ok(audioJs.includes('versions.json') && /\?v=\$\{tag\}/.test(audioJs),
  'audio.js يقرأ البصمات ويطلب `<key>.mp3?v=<بصمة>`');
ok(/m\.v \|\| null/.test(recitationJs) && /\?v=\$\{tag\}/.test(recitationJs),
  'وrecitation.js كذلك من بيان التلاوة');
ok(/https\?:/.test(audioJs) && /https\?:/.test(recitationJs),
  'والوسم على http(s) وحده (عنوان file: قد يرفض سلسلة الاستعلام)');
ok(!/await .*VERSIONS_URL/.test(audioJs) && audioJs.includes('.catch(() => { versions = null; })'),
  'وغيابُ بيان البصمات لا يمنع التشغيل (رابطٌ بلا وسم كما كان)');

// ————————————— ٣. عامل الخدمة على كاشٍ وشبكةٍ مزيَّفين —————————————

console.log('\n٣. سيناريو الاستبدال في عامل الخدمة (app/sw.js نفسه)');

const SCOPE = 'https://muallim.test/app/';
const KEY_A = 'aaaaaaaaaaaa';       // حرفٌ سيُستبدل صوته
const KEY_B = 'bbbbbbbbbbbb';       // حرفٌ لن يُمسّ
const KEY_R = 'cccccccccccc';       // آيةٌ بصوت القارئ
const KEY_W = 'dddddddddddd';       // كلمةٌ مفردة بصوت القارئ (ملفُّها موسوم `wbw-`)

const disk = new Map();
const put = (path, body) => disk.set(path, typeof body === 'string' ? body : JSON.stringify(body));

const setSite = ({ aBody, aTag }) => {
  put('audio/manifest.json', { [KEY_A]: 'أَلِف', [KEY_B]: 'بَاء' });
  put('audio/versions.json', { [KEY_A]: aTag, [KEY_B]: '2222bbbb' });
  put('data/recitations.json', {
    reciter: 'Husary_64kbps', reciterName: 'الحصري',
    ayat: { [KEY_R]: 'آية' },
    words: { [KEY_W]: 'كلمة' }, wordReciterName: 'قارئ الكلمة',
    v: { [KEY_R]: '3333cccc', [`wbw-${KEY_W}`]: '4444dddd' },
  });
  put('data/stories/index.json', { stories: ['s1'] });
  put('data/stories/s1.json', { id: 's1' });
  put(`audio/${KEY_A}.mp3`, aBody);
  put(`audio/${KEY_B}.mp3`, 'صوت باء');
  put(`audio/${KEY_R}.mp3`, 'تلاوة');
  put(`audio/wbw-${KEY_W}.mp3`, 'تلاوة كلمة');
};
setSite({ aBody: 'صوت ألف — القديم (edge)', aTag: '1111aaaa' });

let net = [];
let offline = false;

async function fakeFetch(input) {
  const url = String(input?.url ?? input);      // نصّاً كان أو Request أو URL
  net.push(url);
  if (offline) throw new TypeError('offline');
  const rel = new URL(url).pathname.replace('/app/', '');
  const body = disk.get(rel);
  if (body !== undefined) return new Response(body, { status: 200 });
  // ملفات الهيكل الأخرى (html/css/js/خطوط/أيقونات) تُخدَم بمحتوى وهميّ
  return /\.(mp3|json)$/.test(rel)
    ? new Response('', { status: 404 })
    : new Response(`shell:${rel}`, { status: 200 });
}

const urlOf = (req) => String(typeof req === 'string' ? req : req.url);
const bare = (url) => url.split('?')[0];

class FakeCache {
  constructor() { this.entries = new Map(); }        // رابط ← نصّ الجسم
  async add(url) {
    const res = await fakeFetch(String(url));
    if (!res.ok) throw new Error(`add ${url}`);
    this.entries.set(String(url), await res.text());
  }
  async put(req, res) { this.entries.set(urlOf(req), await res.text()); }
  async match(req, opts = {}) {
    const url = urlOf(req);
    if (this.entries.has(url)) return new Response(this.entries.get(url));
    if (opts.ignoreSearch) {
      for (const [k, v] of this.entries) if (bare(k) === bare(url)) return new Response(v);
    }
    return undefined;
  }
  async keys(req, opts = {}) {
    const all = [...this.entries.keys()];
    const want = req ? urlOf(req) : null;
    const hit = (u) => (opts.ignoreSearch ? bare(u) === bare(want) : u === want);
    return (want ? all.filter(hit) : all).map((u) => new Request(u));
  }
  async delete(req) { return this.entries.delete(urlOf(req)); }
}

const caches = {
  store: new Map(),
  async open(name) {
    if (!this.store.has(name)) this.store.set(name, new FakeCache());
    return this.store.get(name);
  },
  async keys() { return [...this.store.keys()]; },
  async delete(name) { return this.store.delete(name); },
};

/** تركيبُ نسخةٍ من `app/sw.js` في بيئتها المزيَّفة — تُعيد أذرعَ قيادتها.
 *  والنسخُ تتشارك `caches` و`fetch` أنفسَها، فترقيةُ نسخةٍ فوق أخرى تقع كما تقع
 *  على جهاز الطفل: عاملٌ جديد يجد مخزون سابقه على حاله. */
function loadSw(source) {
  const listeners = {};
  const selfObj = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    registration: { scope: SCOPE },
    location: { origin: 'https://muallim.test' },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  vm.runInContext(source,
    vm.createContext({ self: selfObj, caches, fetch: fakeFetch, URL, Request, Response, console }));
  return {
    fire: async (type) => {
      let waited;
      listeners[type]({ waitUntil: (p) => { waited = p; } });
      await waited;
    },
    request: async (path) => {
      let answer;
      listeners.fetch({
        request: new Request(new URL(path, SCOPE)),
        respondWith: (p) => { answer = p; },
      });
      return answer ? answer : null;
    },
  };
}

const swSource = read('app/sw.js');
const { fire, request } = loadSw(swSource);

// اسم مخزن الصوت من `sw.js` نفسِه لا مكتوباً هنا. و**بلا رقم نسخة**: حزمة «خفّة
// التخزين» فصلته عن `VERSION` كي لا يعيد كلُّ تحديثٍ تنزيلَ الصوت كلِّه — ويُقرأ من
// المصدر فلا يكذب هذا الملف إن تغيّر الاسم غداً.
const AUDIO_CACHE = swSource.match(/const AUDIO_CACHE = '([^']+)'/)[1];

const audioCache = async () => caches.open(AUDIO_CACHE);
const cachedUrls = async () => [...(await audioCache()).entries.keys()].sort();
const mp3Hits = () => net.filter((u) => /\.mp3/.test(u));

// ——— التركيب الأول: تُخزَن الأصوات بروابطها الموسومة ———
await fire('install');
await fire('activate');

const first = await cachedUrls();
ok(first.length === 4 && first.every((u) => u.includes('?v=')),
  `التركيب يخزن الأصوات الأربعة بروابط موسومة (${first.length})`);
ok(first.includes(`${SCOPE}audio/${KEY_A}.mp3?v=1111aaaa`), 'ومنها ملف ألف بوسمه القديم');
ok(first.includes(`${SCOPE}audio/${KEY_R}.mp3?v=3333cccc`), 'وتلاوةُ القارئ بوسمها من بيانها');
// الحزمة ١٢: تلاوةُ الكلمة المفردة ملفُّها موسوم `wbw-` — لولا خزنُها لصمتت المحطة دون إنترنت
ok(first.includes(`${SCOPE}audio/wbw-${KEY_W}.mp3?v=4444dddd`),
  'وتلاوةُ الكلمة المفردة كذلك باسمها الموسوم (فتعمل محطة كلمات السورة دون إنترنت)');
const shellCache = await caches.open(
  `muallim-shell-${swSource.match(/const VERSION = '([^']+)'/)[1]}`);
ok([...shellCache.entries.keys()].some((u) => u.endsWith('audio/versions.json')),
  'وبيان البصمات نفسه مخزون في الهيكل (فيُقرأ دون إنترنت)');

// ——— الاستبدال: نفس المفتاح، محتوى جديد، بصمة جديدة ———
setSite({ aBody: 'صوت ألف — الجديد (Sulafat)', aTag: '9999aaaa' });

net = [];
const fresh = await request(`audio/${KEY_A}.mp3?v=9999aaaa`);
const freshBody = await fresh.text();
ok(freshBody === 'صوت ألف — الجديد (Sulafat)',
  'استبدال المحتوى تحت المفتاح نفسه: التطبيق يخدم **الجديد فوراً** لا المخزون القديم');
ok(net.length === 1 && net[0].endsWith('?v=9999aaaa'),
  `وبطلب شبكيّ واحد لهذا الملف وحده (${net.length})`);

const afterSwap = await cachedUrls();
ok(afterSwap.includes(`${SCOPE}audio/${KEY_A}.mp3?v=9999aaaa`), 'والجديد صار مخزوناً');
ok(!afterSwap.includes(`${SCOPE}audio/${KEY_A}.mp3?v=1111aaaa`),
  'ووسمُه الأقدم حُذف — فلا نسختان لملفٍ واحد ولا يعود القديم من بابٍ خلفيّ');
ok(afterSwap.length === 4, `والمخزون ما زال أربعة لا خمسة (${afterSwap.length})`);

// ——— وغير المستبدل يبقى من الكاش بلا شبكة ———
net = [];
const kept = await request(`audio/${KEY_B}.mp3?v=2222bbbb`);
ok((await kept.text()) === 'صوت باء' && net.length === 0,
  'وغيرُ المستبدل يُخدَم من المخزون بلا طلب شبكيّ واحد (لا إعادة تنزيل للبقية)');
net = [];
const ayah = await request(`audio/${KEY_R}.mp3?v=3333cccc`);
ok((await ayah.text()) === 'تلاوة' && net.length === 0, 'وكذلك تلاوة القارئ');

// ——— بلا شبكة ووسمٌ غير مخزون: صوتٌ أقدم خيرٌ من صمت ———
offline = true;
net = [];
const stale = await request(`audio/${KEY_A}.mp3?v=7777aaaa`);
ok(stale && stale.ok && (await stale.text()) === 'صوت ألف — الجديد (Sulafat)',
  'وبلا شبكة: وسمٌ غير مخزون يُخدَم بأقرب نسخةٍ عندنا (لا صمت في أذن الطفل)');
ok((await cachedUrls()).length === 4, 'ولا تُخزَّن تلك الاستجابة بالوسم الجديد (تُصحَّح أول اتصال)');
offline = false;

// ——— الكنس: كل أثرٍ لصوتٍ قديم يزول عند التركيب التالي ———
(await audioCache()).entries.set(`${SCOPE}audio/${KEY_A}.mp3`, 'صوت ألف — القديم (edge)');
(await audioCache()).entries.set(`${SCOPE}audio/${KEY_B}.mp3?v=0000old0`, 'قديم');
await fire('install');
const swept = await cachedUrls();
ok(swept.length === 4 && !swept.some((u) => !u.includes('?v=')),
  'والتركيب يكنس الأوسمة الغابرة والروابط بلا وسم (لا يبقى في الجهاز أثرٌ للقديم)');
ok((await (await audioCache()).match(new Request(`${SCOPE}audio/${KEY_A}.mp3?v=9999aaaa`))) !== undefined,
  'ويُبقي المتوقَّع اليوم');

// ——————— ٤. ترقيةُ نسخةٍ حقيقية لا تعيد تنزيل الصوت (حزمة «خفّة التخزين») ———————
//
// **العيب المحروس**: كان اسم مخزن الصوت `muallim-audio-${VERSION}`، ورقمُ النسخة يتغيّر
// مع كل حزمة — فيولد مخزنٌ فارغ ويُحذف السابق عند التفعيل، فيعيد جهازُ الطفلة جلب
// آلاف الملفات (٤١ ميغابايت) في **كل** تحديث. وهو هدرٌ محض: بصماتُ المحتوى تحكم
// الطزاجة سلفاً. والفحصُ هنا ترقيةٌ حقيقية: `app/sw.js` نفسُه برقم نسخةٍ مرفوع يُركَّب
// فوق المخزون القائم، ويُقاس ما جُلب من الشبكة — والمطلوب صفر.

console.log('\n٤. ترقيةُ النسخة لا تعيد جلب صوتٍ لم تتغيّر بصمتُه');

const bumped = swSource.replace(/(const VERSION = '[^']*)'/, "$1-bump'");
const next = loadSw(bumped);
net = [];
await next.fire('install');
ok(mp3Hits().length === 0,
  `التركيبُ الجديد لم يجلب ملفاً صوتياً واحداً (${mp3Hits().length} طلباً)`);
await next.fire('activate');
ok((await caches.keys()).filter((n) => n.startsWith('muallim-audio')).length === 1
  && (await caches.keys()).includes(AUDIO_CACHE),
  `ومخزن الصوت واحدٌ باسمه الثابت عبر النسخ (${AUDIO_CACHE})`);
ok((await cachedUrls()).length === 4, `والأصوات الأربعة في مواضعها (${(await cachedUrls()).length})`);
ok(!(await caches.keys()).some((n) => n.startsWith('muallim-shell') && !n.includes('bump')),
  'وقشرةُ النسخة السابقة وحدَها مُحيت (ملفاتُها تتبدّل تحت أسمائها فتحتاج الوسم)');

// ——— الجهاز العابر من الاسم الموسوم: يتبنّى صوته مرّةً ولا ينزّله ———
// (مرحلةُ عمرٍ واحدة لكل جهاز: يوم يبلغه هذا الإصلاح. ولولاها لدفع ثمنَ الإصلاح نفسِه
//  تنزيلاً كاملاً أخيراً.) ويُدسّ فيه أثرٌ مخلوط بلا وسم: يُتبنّى ثم يكنسه الكنسُ نفسُه.
const legacy = new FakeCache();
for (const [url, body] of (await audioCache()).entries) legacy.entries.set(url, body);
legacy.entries.set(`${SCOPE}audio/${KEY_A}.mp3`, 'قديم مخلوط');
caches.store.set('muallim-audio-v18', legacy);
caches.store.delete(AUDIO_CACHE);

net = [];
await next.fire('install');
ok(mp3Hits().length === 0,
  `العابرُ من مخزنٍ موسومٍ بنسخة يتبنّى صوته بلا تنزيل (${mp3Hits().length} طلباً)`);
const adopted = await cachedUrls();
ok(adopted.length === 4 && adopted.every((u) => u.includes('?v=')),
  `والمخزونُ أربعةٌ موسومة لا خمسة (${adopted.length}) — فما خُلط يكنسه الكنسُ نفسُه`);
await next.fire('activate');
ok(!(await caches.keys()).includes('muallim-audio-v18'),
  'ثم يُمحى المخزون الموسوم القديم عن آخره (لا نسختان على الجهاز)');

// ——— الإخفاق يُعدّ ولا يُبتلَع: وإن وقع فلا كنسَ (صيانةً للقديم الصالح) ———
// حصةُ التخزين تضيق على الأجهزة الأقدم فيفشل الخزن — وكنسُ «ما بَطَل» عندئذٍ يمحو
// صالحاً قائماً ولا يضع مكانه شيئاً، فيصمت الصوت خارج الشبكة.
disk.delete(`audio/${KEY_B}.mp3`);                       // ملفٌ يُخفق جلبه
(await audioCache()).entries.delete(`${SCOPE}audio/${KEY_B}.mp3?v=2222bbbb`);
(await audioCache()).entries.set(`${SCOPE}audio/${KEY_A}.mp3?v=0000old0`, 'وسمٌ بطل');
await next.fire('install');
const afterFail = await cachedUrls();
ok(afterFail.includes(`${SCOPE}audio/${KEY_A}.mp3?v=0000old0`),
  'إخفاقُ ملفٍ يمنع الكنس — لا يُمحى مخزونٌ قائم في جولةٍ ناقصة');
setSite({ aBody: 'صوت ألف — الجديد (Sulafat)', aTag: '9999aaaa' });   // عاد الملف
await next.fire('install');
ok(!(await cachedUrls()).includes(`${SCOPE}audio/${KEY_A}.mp3?v=0000old0`)
  && (await cachedUrls()).length === 4,
  'وأولُ جولةٍ تامّة تكنسه (الكنس مؤجَّلٌ لا مُلغى)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات كسر كاش الصوت ناجحة');
process.exit(fails ? 1 : 0);
