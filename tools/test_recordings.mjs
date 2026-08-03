// اختبار «اقرأ لي» (الحزمة ١٠) بلا متصفّح:
//   node tools/test_recordings.mjs
//
// المحروس هنا خمسة:
//   ١) **الخصوصية بنيويّاً**: كل ملفٍّ يمرّ به صوتُ الطفل لا يعرف الشبكة أصلاً —
//      يُقرأ نصُّه مجرَّداً من التعليقات فلا يمرّ فيه `fetch` ولا رفعٌ ولا عنوانٌ خارجيّ.
//      (وحدةٌ لا تعرف الطريق أرسخُ من حارسٍ يمنع سلوكها — سابقة `recitation.js`.)
//   ٢) **الحصة القصوى**: `planPrune` تحذف الأقدم عند تجاوز العدد أو الحجم،
//      ولا تمسّ الأحدث أبداً (الطفل سجّله لتوّه ليسمعه).
//   ٣) **سجلّ المدد** في `progress.js`: يُكتب ويُقلَّم، ويبقى بعد تقليم الصوت —
//      فمنحنى الطلاقة الذي يقرؤه الوالد لا ينقطع بانقطاع ما يسمعه.
//   ٤) **لا قياس حرفيّ** في القراءة الجهرية، وإذنُ الوالد يُحفظ مرة واحدة لا كل جلسة.
//   ٥) الوصل: زرُّ الشاشة، وإطلاقُ الميكروفون عند التنقّل، وملفّا الوحدتين في مخزون PWA.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);
const read = (p) => readFileSync(new URL(p, new URL('../app/', import.meta.url)), 'utf8');

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const clips = await import(new URL('recordings.js', APP));
const { secondsText, whenText } = await import(new URL('parent.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

// ————— ١. الخصوصية: صوت الطفل لا يمرّ بملفٍّ يعرف الشبكة —————

/** نصُّ الشيفرة وحدها — بلا تعليقات (وإلا لأمسك الحارسُ توثيقَ القاعدة نفسها). */
const codeOf = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, ' ');

const NET = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
  'FormData', 'navigator.connection', 'http://', 'https://', '.upload'];

const carriers = ['recorder.js', 'recordings.js', 'story.js', 'parent.js'];
for (const file of carriers) {
  const code = codeOf(read(`js/${file}`));
  const found = NET.filter((token) => code.includes(token));
  ok(found.length === 0,
    `${file}: لا يعرف الشبكة — صوتُ الطفل لا يجد فيه طريقاً خارج الجهاز`
    + `${found.length ? ' — وُجد: ' + found.join('، ') : ''}`);
}

const recorderCode = codeOf(read('js/recorder.js'));
const storeCode = codeOf(read('js/recordings.js'));
ok(recorderCode.includes('getUserMedia') && recorderCode.includes('MediaRecorder')
  && recorderCode.includes('createObjectURL'),
  'والالتقاط بالميكروفون والتشغيل من الذاكرة (blob) لا من ملفٍ ولا من شبكة');
ok(storeCode.includes('indexedDB') && !storeCode.includes('localStorage'),
  'والخزن في IndexedDB لا في localStorage (الصوت ميغابايتات، وlocalStorage يشاركه تقدّمُ الطفل)');
ok(!recorderCode.includes("from './audio.js'") && !storeCode.includes("from './audio.js'"),
  'ولا تعرفان `audio.js` — احتياطُه نطقٌ آليّ، ولا يُنطَق صوتُ طفلٍ آلياً');

// ولا يُسرَّب الصوت عبر وحدةٍ أخرى: كل ملفٍّ يذكر `blob` هو أحد حامليه المفحوصين
const modules = ['audio.js', 'curriculum.js', 'garden.js', 'ladder.js', 'lesson.js', 'lexicon.js',
  'library.js', 'main.js', 'parent.js', 'progress.js', 'quran.js', 'recitation.js', 'recorder.js',
  'recordings.js', 'review.js', 'screens.js', 'sentences.js', 'skill.js', 'story.js', 'ui.js',
  'words.js'];
const blobbed = modules.filter((f) => /blob/i.test(codeOf(read(`js/${f}`))));
ok(blobbed.every((f) => carriers.includes(f)),
  `ولا يمسّ الصوتَ ملفٌّ خارج هؤلاء الأربعة (${blobbed.join('، ')})`);

// ————— ٢. الحصة القصوى وتقليم الأقدم —————

const made = (n, size = 1_000_000, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, at: 1000 + i, size }));

ok(clips.MAX_CLIPS === 20 && clips.MAX_BYTES === 50 * 1024 * 1024,
  `الحصة معلنة: آخر ${clips.MAX_CLIPS} تسجيلاً أو ${clips.MAX_BYTES / 1024 / 1024} ميغابايت`);
ok(clips.planPrune(made(20)).length === 0, 'وعشرون تسجيلاً صغيراً لا يُقلَّم منها شيء');

const over = clips.planPrune(made(25));
ok(over.length === 5 && over.every((id) => id <= 5),
  `وخمسةٌ وعشرون ⇒ يسقط الخمسة الأقدم وحدهم (${over.join('،')})`);

const heavy = clips.planPrune(made(10, 8 * 1024 * 1024));
ok(heavy.length === 4 && heavy.every((id) => id <= 4),
  `وعشرةٌ بثمانية ميغا (٨٠) ⇒ يبقى ستةٌ في حدّ الخمسين ويسقط أربعةٌ أقدم (${heavy.join('،')})`);

ok(clips.planPrune([{ id: 7, at: 5, size: 200 * 1024 * 1024 }]).length === 0,
  'والأحدثُ لا يُقلَّم ولو تجاوز وحده حدَّ الحجم — سجّله الطفل لتوّه ليسمعه');

const byId = (list) => [...list].sort((a, b) => a - b).join(',');
ok(byId(clips.planPrune([...made(25)].reverse())) === byId(over),
  'والترتيب لا يغيّر الحكم (يُفرز بالزمن لا بترتيب المخزن)');

const tiny = clips.planPrune(made(25), { maxClips: 3, maxBytes: 50 * 1024 * 1024 });
ok(tiny.length === 22 && !tiny.includes(25), 'والحدّان قابلان للحقن في الفحص (٣ ⇒ يسقط ٢٢)');

// ————— ٣. سجلّ المدد ومنحنى الطلاقة —————

p.reset();
ok(p.recordingLog().length === 0 && p.micAllowed() === false,
  'البداية: لا تسجيل ولا إذن ميكروفون');

ok(p.allowMic() === true && p.micAllowed() === true
  && JSON.parse(store.get('muallim.progress.v1')).mic === true,
  'وإذن وليّ الأمر يُحفظ (مرة واحدة لا في كل جلسة)');

const entry = p.logRecording({ node: 'library:x', title: 'قصة', seconds: 41.2345 });
ok(entry.seconds === 41.23 && entry.node === 'library:x' && entry.day && entry.at,
  `والتسجيل يُكتب بقصته وتاريخه ومدّته (${entry.seconds} ثانية · ${entry.day})`);
ok(p.recordingLog().length === 1, 'ويدخل السجلّ');
ok(p.logRecording({ node: '', seconds: 5 }) === null && p.recordingLog().length === 1,
  'وحدثٌ بلا عقدة لا يُكتب');

ok(Object.keys(p.snapshot().skills).length === 0,
  'ولا مهارة حرفية تُسجَّل — القراءة الجهرية ليست امتحاناً (امتداد المُقَرّ في الجلسات ٤ و٦)');

for (let i = 0; i < p.RECORD_LOG_MAX + 5; i++) {
  p.logRecording({ node: 'library:y', title: 'أخرى', seconds: i, at: 2000 + i });
}
const log = p.recordingLog();
ok(log.length === p.RECORD_LOG_MAX,
  `والسجلّ يُقلَّم عند سقفه (${p.RECORD_LOG_MAX} حدثاً) فلا ينتفخ التخزين`);
ok(log[log.length - 1].seconds === p.RECORD_LOG_MAX + 4 && log[0].node === 'library:y',
  'ويحتفظ بالأحدث لا بالأقدم');

p.reset();
const at = Date.UTC(2026, 7, 1);
for (const [i, seconds] of [52, 44, 38].entries()) {
  p.logRecording({ node: 'library:a', title: 'قصة الأولى', seconds, at: at + i * 86400000 });
}
p.logRecording({ node: 'library:b', title: 'قصة الثانية', seconds: 30, at: at + 4 * 86400000 });

const curve = p.fluencyByStory();
ok(curve.length === 2 && curve[0].node === 'library:b',
  'ومنحنى الطلاقة يجمع القراءات بقصصها، الأحدث قراءةً أولاً');
const first = curve.find((s) => s.node === 'library:a');
ok(first.reads.length === 3 && first.first === 52 && first.last === 38 && first.best === 38,
  `وقراءاتُ القصة مرتّبةٌ زمنياً بمددها (${first.reads.map((r) => r.seconds).join(' ← ')})`);
ok(first.title === 'قصة الأولى', 'وعنوانُها معه — يقرؤه الوالد بلا فتح القصة');

// السجلّ نصيٌّ خفيف يبقى بعد تقليم الصوت: هذا هو مسوّغ فصله عن IndexedDB
const kept = JSON.parse(store.get('muallim.progress.v1')).records;
ok(Array.isArray(kept) && kept.length === 4 && !JSON.stringify(kept).includes('blob'),
  'والسجلّ في localStorage بيانٌ نصيّ بلا صوت — يبقى بعد تقليم الحصة فلا ينقطع المنحنى');

// حالة قديمة (نسخة ٢ بلا حقلَي التسجيل) تُقرأ بلا فقد ولا انهيار
store.set('muallim.progress.v1', JSON.stringify({
  v: 2, stars: { 'g1:ا': 3 }, skills: {}, days: {}, reviews: {}, seconds: 12,
}));
const old = await import(new URL('progress.js?old=1', APP));
ok(old.getStars('g1:ا') === 3 && old.recordingLog().length === 0 && old.micAllowed() === false,
  'وحالةٌ محفوظة قبل الحزمة تُقرأ بنجومها، وحقلا التسجيل يبدآن فارغين');

// ————— ٤. نصوص اللوحة —————

ok(secondsText(0) === 'أقل من ثانية' && secondsText(1) === 'ثانية واحدة'
  && secondsText(2) === 'ثانيتان' && secondsText(5) === '٥ ثوانٍ' && secondsText(41) === '٤١ ثانية',
  `صياغة المدّة بالعربية الصحيحة (${[1, 2, 5, 41].map(secondsText).join(' · ')})`);
ok(secondsText(60) === 'دقيقة واحدة' && secondsText(75) === 'دقيقة واحدة و١٥ ثانية',
  `وما تجاوز الدقيقة يُقرأ دقائقَ وثوانيَ (${secondsText(75)})`);
ok(/^[؀-ۿ]+ [٠-٩]+\/[٠-٩]+ · [٠-٩]+:[٠-٩]+$/.test(whenText(Date.now())),
  `ولحظةُ التسجيل بأرقام المشرق (${whenText(Date.now())})`);

// ————— ٥. الوصل: الشاشة والتوجيه والمخزون —————

const story = read('js/story.js');
ok(story.includes('recordBlock') && story.includes('micIcon'),
  'شاشةُ القصة فيها زرُّ التسجيل بأيقونته الهندسية (SVG لا إيموجي — DESIGN §٦)');
ok(!/عدّاد|setInterval/.test(codeOf(story).split('recordBlock')[1] || ''),
  'وبلا مؤقّت ولا عدّاد يراه الطفل (DESIGN §٥.٦)');
ok(story.includes('micAllowed') && story.includes('gateCard'),
  'وأول استعمال يمرّ ببوابة وليّ الأمر نفسِها (لا نسخة ثانية منها)');
ok(codeOf(read('js/main.js')).includes('recorder.release()'),
  'والتوجيه يُطلق الميكروفون عند مغادرة الشاشة (لا يتبع الطفلَ إلى غيرها)');

const sw = read('sw.js');
const swVersion = Number((sw.match(/VERSION = 'v(\d+)'/) || [])[1]);
ok(sw.includes("'js/recorder.js'") && sw.includes("'js/recordings.js'") && swVersion >= 7,
  `ووحدتا التسجيل في مخزون العمل دون إنترنت بنسخةٍ مرفوعة (v${swVersion} ≥ v7)`);
ok(!/recordings|clips|blob/i.test(codeOf(sw).replace(/js\/recordings\.js/g, '')),
  'ولا يمرّ صوتُ الطفل بعامل الخدمة أصلاً — لا خزنَ له ولا اعتراض');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «اقرأ لي» ناجحة');
process.exit(fails ? 1 : 0);
