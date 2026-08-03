// «اقرأ لي» — التقاط صوت الطفل وهو يقرأ (الحزمة ١٠ · ROADMAP §المرحلة و).
//
// **قاعدة الخصوصية المطلقة** (CLAUDE.md — قواعد ثابتة): صوت الطفل **لا يغادر جهازه
// أبداً** — لا رفع ولا شبكة ولا تحليل خارجي. وهذه الوحدة **لا تعرف الشبكة أصلاً**:
// ما فيها إلا الميكروفون والذاكرة ومشغّلٌ محليّ لعنوان `blob:` (يحرس ذلك
// `tools/test_recordings.mjs` بقراءة نصّ الملف، ويثبت اختبار المتصفّح **صفرَ طلبات**
// طوال دورة التسجيل). وهي كذلك **لا تعرف `audio.js`**: احتياطُ ذاك نطقٌ آليّ، ولا
// معنى لأن يُنطَق صوتُ طفلٍ آلياً حين يغيب ملفه.
//
// **بلا مؤقّت ظاهر** (DESIGN §٥.٦: «لا مؤقتات ولا عدّ تنازلي — القراءة ليست سباقاً»):
// المدّة تُلتقط **ضمنياً** بفارق ما بين الضغطتين، فتصير مقياس الطلاقة الصامت في لوحة
// وليّ الأمر — يقرؤه الوالد ولا يراه الطفل عدّاداً يسابقه.
//
// **الميكروفون يُطلَق فور التوقف**: لا نُبقي المجرى مفتوحاً بين تسجيلين (مؤشّر
// التسجيل في الجهاز يجب أن ينطفئ حين لا نسجّل)، و`release()` تُنادى من التوجيه
// في `main.js` فلا يتبع الميكروفونُ الطفلَ إلى شاشة أخرى.

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

let stream = null;        // مجرى الميكروفون — مفتوحٌ أثناء التسجيل وحده
let recorder = null;
let chunks = [];
let startedAt = 0;
let player = null;        // مشغّل صوت الطفل (عنوان blob محليّ)
let playerUrl = '';

/** هل يقدر هذا الجهاز على التسجيل؟ (غيابُه لا يكسر شيئاً — الزرّ يختفي بهدوء). */
export function supported() {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && Boolean(navigator?.mediaDevices?.getUserMedia);
}

export function isRecording() {
  return Boolean(recorder) && recorder.state !== 'inactive';
}

function options() {
  if (!supported() || typeof MediaRecorder.isTypeSupported !== 'function') return {};
  const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : {};
}

function releaseMic() {
  for (const track of stream?.getTracks() || []) track.stop();
  stream = null;
}

/**
 * بدء التسجيل — يطلب إذن الميكروفون إن لم يكن ممنوحاً.
 * يرمي إن رُفض الإذن أو تعذّر الجهاز، ويتكفّل النداءُ بإخفاء الزرّ بهدوء.
 */
export async function start() {
  release();
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream, options());
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  });
  startedAt = Date.now();
  recorder.start();
  return true;
}

/**
 * إيقاف التسجيل وتسليم صوته.
 * @returns {Promise<{blob: Blob, seconds: number}|null>} null إن لم يُسجَّل شيء
 */
export function stop() {
  if (!isRecording()) {
    releaseMic();
    return Promise.resolve(null);
  }
  const active = recorder;
  // المدّة = ما بين الضغطتين (تُلتقط ضمنياً بلا عدّادٍ يراه الطفل) — بخانتين عشريتين
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 10) / 100);
  return new Promise((resolve) => {
    active.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: active.mimeType || chunks[0]?.type || 'audio/webm' });
      chunks = [];
      recorder = null;
      releaseMic();
      resolve(blob.size ? { blob, seconds } : null);
    }, { once: true });
    active.stop();
  });
}

/** إلغاء أي تسجيل جارٍ وإطلاق الميكروفون وإسكات المشغّل — عند مغادرة الشاشة. */
export function release() {
  if (recorder) {
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* أُوقف سلفاً */ }
    recorder = null;
  }
  chunks = [];
  releaseMic();
  stopPlayback();
}

/** إسكات صوت الطفل وإسقاط عنوانه المؤقّت من الذاكرة. */
export function stopPlayback() {
  if (player) {
    player.pause();
    player = null;
  }
  if (playerUrl) {
    URL.revokeObjectURL(playerUrl);
    playerUrl = '';
  }
}

/**
 * إسماع الطفل صوتَه — من الذاكرة مباشرةً (`blob:`)، لا من ملفٍ ولا من شبكة.
 * @returns {Promise<boolean>} صحيح إن سُمع فعلاً
 */
export function playClip(blob) {
  stopPlayback();
  return new Promise((resolve) => {
    if (!blob) return resolve(false);
    playerUrl = URL.createObjectURL(blob);
    const element = new Audio(playerUrl);
    player = element;
    const finish = (heard) => {
      if (player === element) stopPlayback();
      resolve(heard);
    };
    element.addEventListener('ended', () => finish(true), { once: true });
    element.addEventListener('error', () => finish(false), { once: true });
    const started = element.play();
    if (started && typeof started.catch === 'function') started.catch(() => finish(false));
  });
}
