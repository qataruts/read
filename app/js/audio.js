// الصوت: ملفات mp3 مولَّدة مسبقاً في app/audio/ (انظر tools/generate_audio.py).
// اسم كل ملف = sha1 لنصّه العربي (أول ١٢ خانة) — نفس الاشتقاق هنا وفي بايثون،
// فاستبدال أي ملف بتسجيل بشري لاحقاً لا يمسّ الشيفرة.
// عند غياب الملف: احتياط بـ Web Speech API حتى لا يصمت الدرس أبداً.
//
// **وسمُ المحتوى (`?v=`)**: الاسم من النصّ لا من المحتوى، فاستبدال الصوت تحت
// المفتاح نفسه لا يغيّر الرابط — والجهاز الذي خزّن القديم في عامل الخدمة يبقى
// عليه، فيُسمع الحرفُ الواحد بصوتين بحسب تاريخ أول طلب. لذلك نطلب الملف موسوماً
// ببصمة بايتاته من `audio/versions.json` (يكتبها المولّد): تبديلُ المحتوى يغيّر
// الرابط فيُكسَر كاشُ ذلك الملف **وحده**، وما لم يُبدَّل يبقى مخزوناً كما هو.
// وغيابُ البيان لا يُعطّل شيئاً — رابطٌ بلا وسم كما كان.

const AUDIO_URL = new URL('../audio/', import.meta.url);
const MANIFEST_URL = new URL('manifest.json', AUDIO_URL);
const VERSIONS_URL = new URL('versions.json', AUDIO_URL);

// الوسم على http(s) وحده: بعض المتصفّحات ترفض عنوان `file:` بسلسلة استعلام،
// ولا كاش هناك أصلاً — فلا حاجة إلى الوسم ولا خسارة بتركه.
const TAGGABLE = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

let manifestKeys = null;   // Set لمفاتيح الملفات الموجودة (null = لم يُقرأ الفهرس بعد)
let versions = null;       // مفتاح ← بصمة محتواه (null = لا بيان بصمات)
let manifestLoad = null;
let current = null;        // آخر عنصر صوت شُغِّل (لإيقافه قبل التالي)
let epoch = 0;             // جيلُ التشغيل: كل stop() يزيده فيُبطل ما كان في الطريق
const cache = new Map();   // نص → مفتاح (تفادي إعادة حساب sha1)

// ————— sha1 خالص (بلا اعتماد على crypto.subtle كي يعمل من file:// أيضاً) —————
function sha1Hex(bytes) {
  const total = ((((bytes.length + 8) >> 6) + 1) << 6);
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  const bits = bytes.length * 8;
  dv.setUint32(total - 8, Math.floor(bits / 4294967296), false);
  dv.setUint32(total - 4, bits >>> 0, false);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 80; j++) {
      const n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (n << 1) | (n >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** مفتاح النص = اسم ملفه الصوتي (بلا امتداد). */
export function keyFor(text) {
  let key = cache.get(text);
  if (!key) {
    key = sha1Hex(new TextEncoder().encode(text)).slice(0, 12);
    cache.set(text, key);
  }
  return key;
}

/** قراءة فهرس الأصوات مرة واحدة — لمعرفة الموجود قبل محاولة تشغيله.
 *  ومعه بيانُ البصمات: غيابُه لا يمنع التشغيل (روابط بلا وسم)، فلا يُربَط
 *  سماعُ الطفل بملفٍّ ثانٍ قد يتأخّر. */
export function ready() {
  if (!manifestLoad) {
    const index = fetch(MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((m) => { manifestKeys = new Set(Object.keys(m)); })
      .catch(() => { manifestKeys = null; });   // بلا فهرس: نجرّب الملف ثم نحتاط بالنطق
    const tags = fetch(VERSIONS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((v) => { versions = v; })
      .catch(() => { versions = null; });
    manifestLoad = Promise.all([index, tags]).then(() => undefined);
  }
  return manifestLoad;
}

function urlFor(text) {
  const key = keyFor(text);
  const href = new URL(`${key}.mp3`, AUDIO_URL).href;
  const tag = TAGGABLE && versions ? versions[key] : null;
  return tag ? `${href}?v=${tag}` : href;
}

/** هل للنص ملف مولَّد؟ (null = الفهرس غير مقروء بعد — نادِ ready() أولاً). */
export function hasFile(text) {
  return manifestKeys ? manifestKeys.has(keyFor(text)) : null;
}

/** **إطلاقُ موارد عنصرٍ فرغنا منه** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦: بطءُ الصوت على
 *  الآيباد، ثم صمتٌ تامّ لا يزيله إلا إعادةُ تشغيل الجهاز):
 *
 *  لكل نطقٍ عنصرُه — مئاتٌ في الجلسة الواحدة — وكان كلٌّ يبقى معلَّقاً بمصدره بعد أن
 *  يصمت. وiOS يحدّ ما تفكّه الصفحةُ من وسائطَ حيّة، وحدُّه في **خادم الوسائط** لا في
 *  الصفحة — ولذلك لا تُصلحه إعادةُ تثبيت التطبيق وتُصلحه إعادةُ تشغيل الجهاز. فصار
 *  العنصرُ يُطلَق فورَ فراغه: يُوقَف، ويُنزَع مصدرُه، ويُعاد تحميله فارغاً.
 *
 *  **ولم يُمَسّ تسلسلُ التشغيل بحرف**: العنصرُ لكل نطقٍ كما كان، والوعدُ يُحلّ عند
 *  `ended` ويُرفَض عند `error` كما كان. وجُرّبت بدائلُ أوسع (عنصرٌ واحد يُعاد
 *  استعماله، ثم عنصران يتناوبان) **فأسقطت حارسَ «صفر طلبات شبكية في دورة التسجيل»
 *  متقطّعاً**، فرُدّت — والخصوصيةُ لا تُقايَض بجزءٍ من ثانية. */
function releaseEl(el) {
  if (!el) return;
  const hush = el._hush;
  el._hush = null;
  if (hush) hush();                      // إيقافٌ متعمَّد: وعدُ التشغيل يُسوّى بهدوء لا يُرمى
  try {
    el.pause();
    el.removeAttribute('src');
    el.load();
  } catch { /* عنصرٌ لم يبلغ حالةً تسمح — لا يمنع شيئاً */ }
}

/** إيقاف ما يُشغَّل الآن (ملفاً كان أو نطقاً آلياً)، وإبطالُ ما كان في طريقه إليه. */
export function stop() {
  epoch++;                               // يُبطل تتابعاتٍ ومحاولاتِ إعادةٍ ما زالت في الطريق
  if (current) {
    releaseEl(current);
    current = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// **الإيقافُ المتعمَّد ليس عطلاً** (بلاغ الابنة، ١١ أغسطس ٢٠٢٦: النقرُ المتكرر السريع
// يكدّس الأصوات بعضَها فوق بعض):
//
// كانت نقرةٌ أحدث تُوقف عنصرَ سابقتها، فيرفض وعدُ تشغيله، **فيسقط في `catch` إعادةِ
// المحاولة** — وهي مكتوبةٌ لملفٍّ تأخّر لا لملفٍّ أُسكت عمداً — فيُبعَث الصوتُ الموقوف
// من جديدٍ فوق الجديد، وتتكاثر بعدد النقرات. فصار الإيقافُ المتعمَّد **تسويةً هادئة**
// (`_hush` يحلّ الوعد بـfalse قبل الإيقاف) فلا `catch` يراه ولا إعادةَ بعده، وبقيت
// الإعادةُ لعطبها الحقيقيّ: ملفٌّ موجودٌ في الفهرس تعثّر تحميلُه.
function playFile(text) {
  return new Promise((resolve, reject) => {
    const el = new Audio(urlFor(text));
    el.preload = 'auto';
    current = el;
    el._hush = () => resolve(false);
    el.addEventListener('ended', () => {
      if (current === el) current = null;
      el._hush = null;
      releaseEl(el);                     // بعد `ended`: صمت فلا حاجة إلى موارده
      resolve(true);
    }, { once: true });
    el.addEventListener('error', () => reject(new Error('audio')), { once: true });
    el.play().catch(reject);
  });
}

/**
 * احتياط: نطق آلي من المتصفح — أبطأ قليلاً كي تتضح الحروف لأذن الطفل.
 * لا يرمي أبداً: متصفّح بلا نطق (أو يرفض النصّ) يعود بـfalse، فلا يسقط الدرس
 * على طفل بسبب صوت — وهذا الاحتياط هو ما يشتغل للنصوص المنتظِرة في قائمة الصوت.
 */
function speak(text) {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || !window.SpeechSynthesisUtterance) return resolve(false);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = 0.75;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      synth.cancel();
      synth.speak(u);
    } catch {
      resolve(false);
    }
  });
}

/**
 * تشغيل نصّ عربي: يبحث عن ملفه المولَّد، فإن غاب نطقه المتصفح.
 * يُوقِف أي صوت سابق كي لا تتداخل الأصوات على الطفل.
 * @returns {Promise<boolean>} صحيح إن سُمع شيء فعلاً.
 */
export async function play(text) {
  if (!text) return false;
  stop();
  const run = playAs(text, epoch);
  tail = run;
  return run;
}

async function playAs(text, my) {
  await ready();
  if (my !== epoch) return false;               // نقرةٌ أحدث سبقتنا ونحن ننتظر الفهرس

  // **الاحتياطُ لغياب الملف لا لبطء الشبكة** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦: «عند
  // التقدّم بسرعة في الحروف يبدأ الصوتُ الآليّ»):
  //
  // كان `catch` واحدٌ يبتلع الحالتين — فمَن تصفّح بسرعةٍ قبل أن يكتمل خزنُ الصوت
  // سمع **نطقاً آلياً لحرفٍ له ملفٌّ بحقّ**، لأنّ ملفَّه تأخّر لا لأنّه غائب. وهو
  // نقضٌ لوعدٍ معلَن على بوّابتنا: «لا ينطق التطبيق شيئاً بصوت آليّ لحظيّ».
  //
  // فصارت الحالتان اثنتين: **ما لا ملفَّ له في الفهرس** يُنطَق آلياً (وهو المقصود
  // أصلاً — نصوصُ قائمة الصوت المنتظِرة)، **وما له ملفٌّ ولم يُحمَّل** يُعاد طلبُه
  // مرّةً ثم يصمت — فالصمتُ ثانيةً خيرٌ من صوتٍ آليّ يسمعه معلّمٌ يقيّم التطبيق.
  const known = manifestKeys ? manifestKeys.has(keyFor(text)) : null;
  if (known === false) {
    console.warn(`[audio] لا ملف لـ «${text}» — احتياط بالنطق الآلي`);
    return speak(text);
  }
  try {
    return await playFile(text);
  } catch {
    if (my !== epoch) return false;             // أُسكتنا عمداً — لا إعادةَ ولا نطق
    if (known !== true) return speak(text);     // فهرسٌ لم يُقرأ: لا نعرف، فالاحتياط
    try {
      return await playFile(text);              // موجودٌ وتأخّر: محاولةٌ ثانية
    } catch {
      console.warn(`[audio] تعذّر تحميل ملف «${text}» — صمتٌ ولا نطق آليّ`);
      return false;
    }
  }
}

/** تشغيل نصوص متتابعة (مقاطع كلمة مثلاً) مع فاصل قصير بينها.
 *  التتابعُ جيلٌ واحد: نقرةٌ أحدث (أو stop) تُبطل بقيّتَه — كان يمضي إلى آخره
 *  فيتداخل تتابعان على أذن الطفل بعدد نقراته. */
export async function playSequence(texts, gapMs = 220) {
  stop();
  const my = epoch;
  const run = (async () => {
    for (const t of texts) {
      if (my !== epoch) return;
      await playAs(t, my);
      if (gapMs && my === epoch) await new Promise((r) => setTimeout(r, gapMs));
    }
  })();
  tail = run;
  return run;
}

// ————— «لا انتقالَ وكلامٌ في الجوّ» (بلاغٌ عائليّ من «احسب»، ١١ أغسطس ٢٠٢٦) —————
//
// بلاغُ ميدانهم الأول: «البرنامج لا ينتظر الصوت فينتقل» — والصنفُ نفسُه كان عندنا:
// مواضعُ انتقالٍ مبرمَجٍ على **سياج مهلةٍ ثابت** (٧٥٠ م.ث ونحوها) يفترض أن الطفل
// يجيب بعد تمام السؤال — وطفلٌ سريع يجيب والصوتُ في الجو، فيُقطَش كلامٌ بانتقالٍ
// لم ينتظره (تغذيةُ «يسمع ما اختاره»، وتتابعُ «اسمع الفرق»، وقاعدةُ العلامة).
// و`words.js` كان نموذجَ الصواب منذ بُني: انتظارُ كل صوتٍ ثم مهلة ثم انتقال.
//
// فصار للقناة **ذيلٌ** (`tail`: وعدُ آخرِ نداءٍ قُدّم) و`quiet()` تتمّ حين يسكت —
// وإن استجدّ نداءٌ ونحن ننتظر (طفلٌ ينقر «اسمع مرة أخرى») انتظرناه هو أيضاً.
// و`afterSpeech(fenceMs, fn)` هي قاعدةُ الانتقال المبرمَج: **السكوتُ ومهلةُ العين
// معاً** — فالشاشة الصامتة تنتقل بمهلتها كما كانت حرفاً، والناطقة تُتمّ كلامها.
// (وقطعُ الطفل بيده — نقرةٌ تُسكت وتُبدّل — مشروعٌ وليس من هذا الباب.)

let tail = Promise.resolve(false);   // ذيلُ القناة: وعدُ آخر تشغيلٍ قُدّم

/** تتمّ حين تسكت القناة — لا كلامَ يعمل ولا نداءَ لحق بنا ونحن ننتظر. */
export async function quiet() {
  for (;;) {
    const last = tail;
    await last;
    if (last === tail) return;
  }
}

/** انتقالٌ مبرمَج بعد سكوت القناة **و**مهلة العين معاً — لا يقع وكلامٌ في الجوّ. */
export function afterSpeech(fenceMs, fn) {
  Promise.all([quiet(), new Promise((r) => setTimeout(r, fenceMs))]).then(fn);
}

/** تحميل مسبق لأصوات الشاشة التالية (لا يشغّلها). */
export function preload(texts) {
  for (const t of texts) {
    if (manifestKeys && !manifestKeys.has(keyFor(t))) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = urlFor(t);
  }
}
