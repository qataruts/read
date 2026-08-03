// «اقرأ لي» — مخزن تسجيلات الطفل (الحزمة ١٠ · ROADMAP §المرحلة و).
//
// **قاعدة الخصوصية المطلقة** (CLAUDE.md — قواعد ثابتة): تسجيل صوت الطفل **لا يغادر
// جهازه أبداً** — لا رفع ولا شبكة ولا تحليل خارجي. ولذلك **لا تعرف هذه الوحدة الشبكة
// أصلاً**: ليس فيها `fetch` ولا `XMLHttpRequest` ولا `sendBeacon` ولا عنوانٌ خارجيّ
// واحد — كما لا تعرف `recitation.js` النطقَ الآليّ. وحدةٌ لا تعرف الطريق أرسخُ من
// حارسٍ يمنع سلوكه، ويقرأ `tools/test_recordings.mjs` نصَّ الملف نفسه فيرفض دخولها.
//
// **لماذا IndexedDB لا localStorage**: الصوت ملفّاتٌ بالميغابايت، وlocalStorage نصٌّ
// محدودٌ بميغابايتين يشاركه تقدّمُ الطفل — فامتلاؤه بصوته يُفقده نجومه.
//
// **الحصة القصوى**: آخر ٢٠ تسجيلاً أو ٥٠ ميغابايت، أيّهما بلغ أولاً — والتقليم يحذف
// الأقدم فالأقدم. جهازُ الطفل ليس أرشيفاً، والقيمةُ في آخر قراءاته لا في أولها.
// و**مدد التسجيلات تبقى في `progress.js`** بعد تقليم صوتها (بيانٌ نصيّ لا يُثقل)،
// فمنحنى الطلاقة الذي يقرؤه الوالد لا ينقطع بانقطاع الصوت.

const DB_NAME = 'muallim.recordings';
const DB_VERSION = 1;
const STORE = 'clips';

/** حدّا الحصة — الأول منهما بلوغاً يُقلِّم (بند الحزمة ١٠/٢). */
export const MAX_CLIPS = 20;
export const MAX_BYTES = 50 * 1024 * 1024;

/** هل يدعم الجهاز خزنَ الصوت؟ (متصفّح بلا IndexedDB: الزرّ يختفي بهدوء). */
export function supported() {
  return typeof indexedDB !== 'undefined';
}

let dbLoad = null;

function open() {
  if (!supported()) return Promise.reject(new Error('لا IndexedDB في هذا المتصفّح'));
  if (!dbLoad) {
    dbLoad = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
            .createIndex('at', 'at');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((e) => { dbLoad = null; throw e; });
  }
  return dbLoad;
}

/** تنفيذ عمل واحد على المخزن وانتظار **إتمام معاملته** (لا نعِد بما لم يُكتب بعد). */
async function withStore(mode, run) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    run(tx.objectStore(STORE), (value) => { result = value; });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * **دالّة خالصة** تحدّد ما يُقلَّم من التسجيلات (تُختبر وحدها بلا متصفّح).
 * الأحدث أولاً، ويسقط ما تجاوز عدد الحصة أو حجمها.
 * و**الأحدثُ لا يُقلَّم أبداً** ولو تجاوز وحده حدَّ الحجم: الطفل سجّله لتوّه ليسمعه.
 * @returns {number[]} معرّفات ما يُحذف
 */
export function planPrune(clips, { maxClips = MAX_CLIPS, maxBytes = MAX_BYTES } = {}) {
  const newestFirst = [...clips].sort((a, b) => (b.at - a.at) || (b.id - a.id));
  const drop = [];
  let bytes = 0;
  newestFirst.forEach((clip, index) => {
    bytes += clip.size || 0;
    if (index > 0 && (index >= maxClips || bytes > maxBytes)) drop.push(clip.id);
  });
  return drop;
}

/** بطاقة التسجيل كما تُعرض لوليّ الأمر — بلا الصوت نفسه (يُطلَب عند التشغيل). */
const asMeta = ({ blob, ...rest }) => ({ ...rest, size: rest.size ?? blob?.size ?? 0 });

/**
 * حفظ تسجيلٍ جديد ثم تقليم الحصة فوراً.
 * @returns {Promise<object>} بطاقة التسجيل المحفوظ (بمعرّفه)
 */
export async function saveClip({ node, title, seconds, blob, at = Date.now(), day }) {
  const record = {
    node, title, seconds, blob, at, day,
    size: blob?.size || 0,
    type: blob?.type || '',
  };
  const id = await withStore('readwrite', (store, done) => {
    const request = store.add(record);
    request.onsuccess = () => done(request.result);
  });
  await prune();
  return asMeta({ ...record, id });
}

/** كل التسجيلات المحفوظة، الأحدث أولاً — بطاقاتٍ بلا صوت (الصوت بـ`clipBlob`). */
export async function listClips() {
  const all = await withStore('readonly', (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result);
  });
  return (all || []).map(asMeta).sort((a, b) => (b.at - a.at) || (b.id - a.id));
}

/** صوت تسجيلٍ بعينه (Blob محليّ لا غير). */
export async function clipBlob(id) {
  const record = await withStore('readonly', (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result);
  });
  return record?.blob || null;
}

export async function removeClip(id) {
  await withStore('readwrite', (store) => store.delete(id));
}

/** محو كل تسجيلات الطفل — بيدِ وليّ الأمر وحده (زرّ في لوحته). */
export async function clearClips() {
  await withStore('readwrite', (store) => store.clear());
}

/** تطبيق الحصة: يحذف ما تقرّره `planPrune` ويعيد عدد المحذوف. */
export async function prune(limits) {
  const clips = await listClips();
  const drop = planPrune(clips, limits);
  for (const id of drop) await removeClip(id);
  return drop.length;
}
