// التلاوة — تشغيل تسجيل قارئ متقن لنصّ المصحف (METHOD §٥.٦).
//
// **لماذا وحدةٌ مستقلّة عن `audio.js`؟** لأنّ القاعدة الملزمة هنا ليست «لا صوت»
// بل **«لا صوتَ مولَّداً»**: نصّ المصحف يُتلى من تسجيل قارئ، ولا يُولَّد بمولّد،
// ولا يُنطق نطقاً آلياً بالمتصفّح ولو تعذّر الملف. و`audio.js` احتياطُه الدائم
// هو النطق الآلي — فلو مرّت آيةٌ من هناك لسقطت القاعدة من حيث لا نشعر.
// هذه الوحدة **لا تعرف النطق الآلي أصلاً** (ويحرس ذلك `test_quran.mjs` بحرفه):
// إن غاب الملف صمتت وأعادت false، ولا ينوب عن القارئ أحد.
//
// المفتاح هو المفتاح نفسه في كل المشروع (sha1 نصّه، أول ١٢ خانة)، والملفات في
// `app/audio/` كبقية الأصوات — يجلبها `tools/fetch_recitation.py` مرةً واحدة
// ويكتب بيانَها `app/data/recitations.json` (لا تدخل فهرسَ الأصوات المولّدة أبداً).
//
// **والكلمةُ المفردة كالآية** (الحزمة ١٢ «الجسر القرآني»): كلماتُ السورة تُسمَع
// كلمةً-كلمة من تسجيل قارئ أيضاً — بيانُها `words` في الملف نفسه (يجلبها
// `tools/fetch_word_recitation.py`)، وتشغيلُها من هنا بالدالّة نفسها: المفتاح من
// النصّ، فلا تحتاج الشاشةُ أن تعرف أهي آيةٌ أم كلمة. وما لم يُجلب بعدُ **صمتٌ**.
//
// **وملفُّ الكلمة موسومٌ بـ`wbw-`** لا بمفتاحها وحده: الكلمة المفردة قد تطابق حرفياً
// كلمةً عربية عادية لها ملفٌّ مولَّد بحقّ («مَا» و«مِنَ» في سلّم الجمل)، والمفتاح من
// النصّ — فلولا الوسم لتشارك المصحفُ والمولَّدُ ملفاً واحداً، ولسمع الطفلُ كلمةَ الله
// بصوت مولّد من حيث لا نشعر. الوسمُ يجعل التصادم مستحيلاً بالبناء لا بالانتباه.

import { keyFor } from './audio.js';

const AUDIO_URL = new URL('../audio/', import.meta.url);
const MANIFEST_URL = new URL('../data/recitations.json', import.meta.url);

/** وسمُ ملفات تلاوة الكلمة المفردة — يفصلها عن ملفات المولَّد ذاتِ المفتاح نفسه. */
export const WORD_PREFIX = 'wbw-';

/* **والكلمةُ مقطعٌ من آيتها لا ملفٌّ ثانٍ** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦: نقرةُ الكلمة
   صامتة):

   كان الطريقُ المرسوم أن تُجلب لكل كلمةٍ تلاوةٌ مستقلّة (`words` أعلاه) — فبقيت
   المحطةُ صامتةً شهراً لأنّ مصادرَ الكلمة المفردة **بصوت قارئٍ غير الحصري**، ولا
   يجوز أن تُنسَب تلاوةٌ إلى غير صاحبها ولا أن تختلط أصواتٌ في محطةٍ واحدة.

   والحلُّ أنّ الكلمة **في آيتها أصلاً**: تلاواتُ الآيات الـ٦٨ بصوت الحصري على
   الجهاز منذ الحزمة ١٢، فيكفي أن نعرف موضعَ الكلمة فيها. فصار `spans` في البيان:
   لكل كلمةٍ مفتاحُ آيتها وحدَّا مقطعها بالملّي ثانية — يكتبها `tools/fetch_word_timings.py`
   من بيانٍ مفتوح (`quran-align`، CC BY 4.0، مولَّدٍ لملفات everyayah نفسِها).

   **والحاصلُ أربعة**: صوتُ الحصري عينُه · صفرُ ملفِّ صوتٍ جديد · يعمل دون إنترنت من
   أول يوم (الآياتُ مخزونة) · وعشرةُ كيلوبايت بيانٍ لا أربعون ميغابايت. */
let ayat = null;            // Set لمفاتيح الآيات المسجَّلة (null = لم يُقرأ البيان بعد)
let words = null;           // Set لمفاتيح الكلمات المفردة المسجَّلة
let spans = null;           // مفتاحُ كلمة ← { a: مفتاح آيتها، s، e } بالملّي ثانية
let tags = null;            // مفتاح ← بصمة محتوى ملفه (وسمُ كسر الكاش — انظر audio.js)
let reciterName = '';
let wordReciterName = '';
let manifestLoad = null;

// كما في `audio.js`: الوسم على http(s) وحده.
const TAGGABLE = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

let players = null;         // مشغّلان يتناوبان (الجلب المسبق — انظر playSequence)
let active = 0;
let session = 0;            // رقم الجلسة: يُبطل ما بقي من تسلسلٍ أوقفه المستعمل
const pending = [];         // مُنهيات الانتظارات الجارية — يستدعيها stop() فلا يعلَق تسلسل

/** قراءة بيان التلاوات مرة واحدة. */
export function ready() {
  if (!manifestLoad) {
    manifestLoad = fetch(MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((m) => {
        ayat = new Set(Object.keys(m.ayat || {}));
        words = new Set(Object.keys(m.words || {}));
        spans = m.spans || null;
        tags = m.v || null;
        reciterName = m.reciterName || '';
        wordReciterName = m.wordReciterName || '';
      })
      .catch(() => { ayat = null; words = null; spans = null; });   // بلا بيان: لا تلاوة (ولا نطق آلي بديلاً)
  }
  return manifestLoad;
}

/** اسم قارئ الآيات كما يُعرَض (فارغ قبل قراءة البيان). */
export const reciter = () => reciterName;

/** اسم قارئ الكلمة المفردة — قد يكون غير قارئ الآيات، فيُنسب كلٌّ إلى صاحبه.
 *  **وحين تكون الكلمةُ مقطعاً من الآية فالقارئُ هو هو** — لا يُخترع اسمٌ ولا يُترك
 *  السطرُ عاماً بينما الصوتُ معلومُ الصاحب. */
export const wordReciter = () => wordReciterName || (spans ? reciterName : '');

/**
 * هل لهذا النصّ تلاوة مسجَّلة؟ (null = البيان لم يُقرأ بعد — نادِ ready() أولاً).
 * الآيةُ والكلمةُ سواءٌ هنا: المفتاح من النصّ، والملفّ في المجلد نفسه.
 */
export function has(text) {
  if (!ayat) return null;
  const key = keyFor(text);
  return ayat.has(key) || Boolean(words?.has(key)) || Boolean(spans?.[key]);
}

/** اسمُ ملف النصّ: الآيةُ بمفتاحها، والكلمةُ المفردة بمفتاحها موسوماً — لا تصادمَ بينهما. */
function stemFor(text) {
  const key = keyFor(text);
  return ayat?.has(key) ? key : `${WORD_PREFIX}${key}`;
}

/** رابط الملف موسوماً ببصمة محتواه إن عُرفت — فاستبدال تلاوةٍ يكسر كاشَها وحدها. */
function urlFor(text) {
  const stem = stemFor(text);
  const href = new URL(`${stem}.mp3`, AUDIO_URL).href;
  const tag = TAGGABLE && tags ? tags[stem] : null;
  return tag ? `${href}?v=${tag}` : href;
}

function pair() {
  if (!players) players = [new Audio(), new Audio()];
  return players;
}

/** إيقاف التلاوة الجارية وإبطال ما بقي من تسلسلها. */
export function stop() {
  session++;
  for (const cancel of pending.splice(0)) cancel();   // «انتهت» لا تأتي بعد pause
  for (const el of players || []) {
    el.pause();
    el.currentTime = 0;
  }
}

/**
 * تلاوة نصٍّ واحد من ملفه. **لا احتياط بالنطق الآلي**: غياب الملف صمتٌ وfalse.
 * @returns {Promise<boolean>} صحيح إن سُمعت التلاوة إلى آخرها.
 */
export async function play(text) {
  stop();
  const mine = session;
  await ready();
  if (!text || has(text) === false) return false;

  const span = spans?.[keyFor(text)];
  const el = pair()[active];
  if (span && !ayat?.has(keyFor(text))) return playSpan(el, span, mine);

  el.src = urlFor(text);
  el.preload = 'auto';
  return waitFor(el, mine);
}

/** تشغيل مقطعٍ من داخل ملفّ آية: من `s` إلى `e` بالملّي ثانية.
 *
 *  **والوقوفُ بمؤقّتٍ لا بـ`timeupdate`**: سفاري تُطلق `timeupdate` أربعَ مرّاتٍ في
 *  الثانية، فقد تتجاوز نهايةَ الكلمة بربع ثانيةٍ تُسمِع أولَ التالية. والمؤقّتُ يقف
 *  في حينه، ويبقى `timeupdate` شبكةَ أمانٍ إن تأخّر المؤقّت.
 *
 *  **والانتقالُ بعد `loadedmetadata`**: ضبطُ `currentTime` قبل معرفة المدّة يُهمَل
 *  في بعض المتصفّحات فتبدأ التلاوةُ من أول الآية — والطفلُ ينقر كلمةً فيسمع غيرَها. */
function playSpan(el, span, mine) {
  const href = new URL(`${span.a}.mp3`, AUDIO_URL).href;
  const tag = TAGGABLE && tags ? tags[span.a] : null;
  const url = tag ? `${href}?v=${tag}` : href;

  return new Promise((resolve) => {
    let timer = 0;
    const done = (value) => {
      clearTimeout(timer);
      el.removeEventListener('timeupdate', onTick);
      el.removeEventListener('error', onError);
      const i = pending.indexOf(cancel);
      if (i >= 0) pending.splice(i, 1);
      resolve(value);
    };
    const finish = () => { el.pause(); done(mine === session); };
    const cancel = () => done(false);
    const onError = () => done(false);
    const onTick = () => { if (el.currentTime * 1000 >= span.e) finish(); };
    pending.push(cancel);
    el.addEventListener('timeupdate', onTick);
    el.addEventListener('error', onError, { once: true });

    const start = () => {
      if (mine !== session) return done(false);
      try { el.currentTime = span.s / 1000; } catch { /* يُضبط بعد التحميل */ }
      timer = setTimeout(finish, Math.max(120, span.e - span.s) + 60);
      el.play().catch(() => done(false));
    };

    el.preload = 'auto';
    if (el.src === url && el.readyState >= 1) return start();
    el.src = url;
    el.addEventListener('loadedmetadata', start, { once: true });
    el.load();
  });
}

function waitFor(el, mine) {
  return new Promise((resolve) => {
    const done = (value) => {
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
      const i = pending.indexOf(cancel);
      if (i >= 0) pending.splice(i, 1);
      resolve(value);
    };
    const cancel = () => done(false);
    const onEnd = () => done(mine === session);
    const onError = () => done(false);
    pending.push(cancel);
    el.addEventListener('ended', onEnd, { once: true });
    el.addEventListener('error', onError, { once: true });
    el.play().catch(() => done(false));
  });
}

/**
 * تلاوة نصوص متتابعة (سورةٌ آيةً آية) **بجلبٍ مسبق للتالية**: بينما يُتلى نصٌّ
 * بالمشغّل الفعّال يحمّل الاحتياطيُّ الذي يليه، فيتسلّم عند نهايته بلا فجوة —
 * نمط مشروع القرآن، وهو ما يُبقي التلاوة متصلة على الهاتف والشاشة مطفأة.
 * `onEach(text, index)` قبل كل نصّ — **بموضعه من القائمة الأصلية** لا من المتلوّ،
 * فما لا تلاوةَ له يُتخطّى ولا يزيح ما بعده عن موضعه في الصفحة.
 * @returns {Promise<number>} عدد ما تُلي فعلاً (يقلّ إن أوقفه المستعمل).
 */
export async function playSequence(texts, onEach) {
  stop();
  const mine = session;
  await ready();
  const playable = texts.map((t) => has(t) !== false);
  const after = (i) => texts.findIndex((t, j) => j > i && playable[j]);

  let heard = 0;
  for (let i = 0; i < texts.length; i++) {
    if (mine !== session) break;
    if (!playable[i]) continue;

    const el = pair()[active];
    if (el.src !== urlFor(texts[i])) el.src = urlFor(texts[i]);   // قد يكون مجلوباً مسبقاً
    el.preload = 'auto';

    const nextIndex = after(i);                                   // الجلب المسبق للتالية
    if (nextIndex >= 0) {
      const next = pair()[1 - active];
      next.src = urlFor(texts[nextIndex]);
      next.preload = 'auto';
      next.load();
    }

    if (onEach) onEach(texts[i], i);
    if (!(await waitFor(el, mine))) break;
    heard++;
    active = 1 - active;
  }
  return heard;
}

/** تحميل مسبق لتلاوات شاشةٍ يوشك الطفل أن يفتحها (لا يشغّلها). */
export function prefetch(texts) {
  for (const text of texts) {
    if (has(text) === false) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = urlFor(text);
  }
}
