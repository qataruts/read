// اختبار حزمة «الخفوت» — خفوت التشكيل المتدرّج ز١→ز٣ (ROADMAP §المرحلة ز).
//   node tools/test_fade.mjs
// يخرج بـ١ عند أي إخفاق.
//
// ثلاثة أبواب:
//   ١) **القاعدة**: الدرجات وعتباتها، وصورةُ الكلمة في كلٍّ منها.
//   ٢) **التاريخ**: عدّاد القراءات المتباعد، والتراجعُ الجزئيّ عند كشف الشكل.
//   ٣) **المواضع المحظورة**: فحصٌ آليّ على المصدر — لا وحدةَ تهجٍّ أو مصحفٍ أو
//      حوضِ خياراتٍ تعرف الخفوت أصلاً (الحصانة بنيويةٌ لا وعدٌ في تعليق).

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

// بديل localStorage في بيئة node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const fade = await import(new URL('fade.js', APP));
const p = await import(new URL('progress.js', APP));
const { bareLetters } = await import(new URL('curriculum.js', APP));
const { WORDS } = await import(new URL('lexicon.js', APP));
const { SENTENCES } = await import(new URL('sentences.js', APP));
const { LIBRARY } = await import(new URL('library.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const src = (name) => readFileSync(new URL(name, APP), 'utf8');

// ————— ١) القاعدة: الدرجات الثلاث وصورةُ الكلمة في كلٍّ منها —————

console.log('\n— الدرجات وعتباتها —');
ok(fade.FADE_AT === 3, `العتبة ثلاث قراءات صحيحة متباعدة (${fade.FADE_AT})`);
ok(fade.BARE_AT === fade.FADE_AT * 2, `والعري عند ضِعفها (${fade.BARE_AT})`);
ok([0, 1, 2].every((n) => fade.levelOf(n) === 1), 'دون العتبة: ز١ كامل الشكل');
ok([3, 4, 5].every((n) => fade.levelOf(n) === 2), 'عند العتبة: ز٢ هيكلٌ بمفاتيحه');
ok([6, 7, 40].every((n) => fade.levelOf(n) === 3), 'عند ضِعفها فما فوق: ز٣ عارٍ');

console.log('\n— صورة الكلمة في كل درجة —');
const T = {
  gurfa: 'الْغُرْفَةُ',       // «ال» بسكونها وحركات وتاء مربوطة
  sarir: 'السَّرِيرُ',        // شدّةٌ شمسية
  zaydan: 'زَيْدًا',          // تنوين نصب
  rahman: 'الرَّحْمَٰنُ',      // ألف خنجرية (مدّ)
};
ok(fade.fadeText(T.gurfa, 1) === T.gurfa, 'ز١ لا تمسّ حرفاً ولا حركة');
ok(fade.fadeText(T.gurfa, 2) === 'الغرفة', 'ز٢ تنزع الحركات القصيرة والسكون');
ok(fade.fadeText(T.sarir, 2) === 'السّرير', 'ز٢ **تُبقي الشدّة**');
ok(fade.fadeText(T.zaydan, 2) === 'زيدًا', 'ز٢ **تُبقي التنوين**');
ok(fade.fadeText(T.rahman, 2) === 'الرّحمٰن', 'ز٢ **تُبقي المدود** (الألف الخنجرية)');
ok(fade.fadeText(T.sarir, 3) === 'السرير' && fade.fadeText(T.zaydan, 3) === 'زيدا'
  && fade.fadeText(T.rahman, 3) === 'الرحمن', 'ز٣ تنزع التشكيل كلّه بشدّته وتنوينه ومدوده');
ok(fade.fadeText('١٢٣ أُذُنِي', 3) === '١٢٣ أذني',
  'ولا تمسّ الأرقام العربية ولا صور الهمزة (نطاقُ العلامات وحدَه)');

// **الحرف لا يُمسّ أبداً**: مقايسةُ الحروف قبل الخفوت وبعده على كل مادّة معروضة.
console.log('\n— الخفوت ينزع علامةً ولا يحذف حرفاً (المفكوكية باقية) —');
const DISPLAYED = [...new Set([
  ...WORDS.map((w) => w.word),
  ...SENTENCES.flatMap((s) => s.words),
  ...LIBRARY.flatMap((s) => [...s.pages.flatMap((page) => page.words),
    ...(s.question?.words || [])]),
])];
const keptLetters = DISPLAYED.filter((t) => [2, 3]
  .some((level) => bareLetters(fade.fadeText(t, level)) !== bareLetters(t)));
ok(!keptLetters.length,
  `حروف ${DISPLAYED.length} كلمةً معروضة كما هي في الدرجتين (${keptLetters.slice(0, 3).join('، ')})`);
const stillMarked = DISPLAYED.filter((t) => fade.fadeText(t, 3) !== bareLetters(t));
ok(!stillMarked.length, `وز٣ عاريةٌ تماماً في كلٍّ منها (${stillMarked.slice(0, 3).join('، ')})`);

// ————— ٢) التاريخ: عدّاد القراءات المتباعد والتراجع الجزئي —————

console.log('\n— عدّاد القراءات: لكل كلمة تاريخُها —');
p.reset();
const DAY = 20000;
ok(p.readCount(p.wordKey(T.gurfa)) === 0, 'كلمةٌ لم تُقرأ بعد: صفر');
ok(p.wordKey('الْغُرْفَةُ') === p.wordKey('غُرْفَةْ'),
  'الجملةُ والبطاقة كلمةٌ واحدة: «الْغُرْفَةُ» و«غُرْفَةْ» مفتاحُهما واحد');
ok(p.wordKey('رَجُلْ') !== p.wordKey('رِجْلْ'), 'والمطابقة بالحركات: «رَجُل» ليست «رِجْل»');

ok(p.recordRead(T.gurfa, DAY) === true, 'أول قراءة صحيحة تُحتسب');
ok(p.recordRead(T.gurfa, DAY) === false, '**والثانية في اليوم نفسه لا** (القراءات متباعدة)');
ok(p.readCount(p.wordKey(T.gurfa)) === 1, 'فبقي العدّاد على واحد');
p.recordRead('غُرْفَةْ', DAY + 1);
ok(p.readCount(p.wordKey(T.gurfa)) === 2, 'واليوم التالي يزيده — ولو بصيغتها المعجمية');
ok(fade.wordLevel(T.gurfa) === 1, 'ودون العتبة تبقى ز١ كاملة الشكل');

p.recordRead(T.gurfa, DAY + 2);
ok(p.readCount(p.wordKey(T.gurfa)) === 3 && fade.wordLevel(T.gurfa) === 2,
  'ثلاثُ قراءاتٍ متباعدة ⇒ ز٢');
ok(fade.faded(T.gurfa) === 'الغرفة' && fade.faded('غُرْفَةْ') === 'غرفة',
  'فتُعرض مخفوتةً في الجملة وعلى البطاقة معاً');

ok(p.revealRead(T.gurfa) === 2, 'كشفُ الشكل تراجعٌ جزئيّ: درجةٌ واحدة إلى الوراء');
ok(fade.wordLevel(T.gurfa) === 1 && fade.faded(T.gurfa) === T.gurfa,
  '**فترتدّ ز١ مشكولةً** حتى يقرأها متباعداً من جديد');

for (const day of [DAY + 3, DAY + 4, DAY + 5, DAY + 6, DAY + 7]) p.recordRead(T.gurfa, day);
ok(p.readCount(p.wordKey(T.gurfa)) === 7 && fade.wordLevel(T.gurfa) === 3, 'وعند ضِعف العتبة: ز٣');
ok(fade.faded(T.sarir) === T.sarir, 'وكلمةٌ أخرى لم تُقرأ تبقى كاملة الشكل — العتبة فردية');

console.log('\n— السجلّ في التقدّم: يُنقل ولا يتضخّم —');
ok(p.wordReads().some((w) => w.key === p.wordKey(T.gurfa) && w.n === 7),
  'لوحةُ وليّ الأمر تقرأ العدّاد من `wordReads`');
ok(p.backupSummary(p.backup()).reads >= 1, 'والنسخة الاحتياطية تحمل تاريخ خفوت كلماته');
p.reset();
for (let i = 0; i < 9; i++) p.revealRead(T.gurfa);
ok(p.readCount(p.wordKey(T.gurfa)) === 0 && !p.wordReads().length,
  'والتراجع لا ينزل تحت الصفر ولا يُبقي أثراً فارغاً في التخزين');
ok(p.recordRead('', DAY) === false && p.revealRead('') === 0, 'ونصٌّ فارغ لا يدخل السجلّ');

// ————— ٣) المواضع المحظورة: حصانةٌ بنيوية يفحصها المصدر —————
//
// «لا كلمة تخفت في المواضع المحظورة» لا تُصان بتعليق: الوحدةُ التي لا تستورد
// `fade.js` لا تستطيع أن تخفت شيئاً. فهذا فحصٌ على المصدر لا على النيّة.

console.log('\n— حصانة التهجّي والمصحف وحوض الخيارات (فحص المصدر) —');
const IMMUNE = {
  'words.js': 'لعبة تركيب الكلمات — المقاطع مادّةُ التهجّي',
  'lesson.js': 'درس الحرف — الحركة هي الدرس نفسه',
  'skill.js': 'دروس المهارات — الشدّة والمدّ والتنوين موضوعُها',
  'contrast.js': 'محطتا «ميّز بين» — الحرف بحركته هو المقيس',
  'quran.js': 'نصّ المصحف — رسمُه كما هو، لا يُنقص منه شيء',
  'screens.js': 'حوض «اقرأ واختر» — فرقُ التشكيل بين الخيارات يفضح الجواب',
};
for (const [file, why] of Object.entries(IMMUNE)) {
  ok(!/from '\.\/fade\.js'/.test(src(file)), `${file} لا يعرف الخفوت أصلاً — ${why}`);
}

// **المراجعةُ حالةٌ ثالثة: تشهد ولا تعرض** (حكم المدير، ١٢ أغسطس ٢٠٢٦ — حزمة المكتبة).
//
// كانت في قائمة المحظور المطلق، والعلّةُ **عرضٌ لا احتساب**: مادّةُ المراجعة تهجٍّ،
// فلو خفتت بلاطةٌ وبقيت أختُها مشكولةً لفضح فرقُ التشكيل الجوابَ. ثمّ فُتح فيها
// **شاهدُ «رتّب»** — الكلمةُ المطلوبة في موضعها، وهو موضعُ شاهدٍ مُقَرّ في `fade.js`.
//
// فالحصانةُ تُقسَّى ولا تُرخَّص: يجوز لها `credit` **وحدَها**، ويُمنع عليها كلُّ
// مُصيِّرٍ يخفت (`fadeWord` و`textWord` و`faded` و`fadeText`). فما كان يُصان بغياب
// الملفّ كلِّه صار يُصان **باسم ما يُستورَد منه** — وهو أدقّ لا أضعف.
const reviewSrc = src('review.js');
const imported = (reviewSrc.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/fade\.js'/) || [, ''])[1]
  .split(',').map((s) => s.trim()).filter(Boolean);
ok(imported.length === 0 || (imported.length === 1 && imported[0] === 'credit'),
  `review.js لا تستورد من الخفوت إلا الشاهد (${imported.join('، ') || 'لا شيء'}) — `
  + 'تشهد ولا تعرض: مادّتُها تهجٍّ، وفرقُ التشكيل بين البلاطات يفضح الجواب');
ok(!/\b(fadeWord|textWord|faded|fadeText)\s*\(/.test(reviewSrc),
  'ولا مُصيِّرَ خفوتٍ في المراجعة (بلاطاتُها ز١ دائماً بالبناء)');
ok(/\bcredit\s*\(/.test(reviewSrc),
  'و**الشاهدُ قائمٌ فيها**: «رتّب» يُحتسب كما يُحتسب في السلّم — وهو اتّساقٌ لا توسيع، '
  + 'بل تباعدُه أنظف (وحدةُ يوم ليتنر هي وحدةُ يوم العدّاد)');

ok(!/from '\.\/fade\.js'/.test(src('progress.js')),
  'واتجاه الاعتماد واحد: `fade.js` ← `progress.js` لا العكس');

// والعدّادُ نفسُه مقصورٌ على `fade.js`: لا شاشةَ تكتب فيه من وراء القاعدة — فلو
// نادت وحدةٌ محظورةٌ `recordRead` مباشرةً لصنعت لكلمةٍ تاريخاً بلا مُصيِّرٍ يعرضه.
const WRITERS = /\b(recordRead|revealRead)\s*\(/;
const SCREENS = ['story.js', 'ladder.js', 'garden.js', 'parent.js', 'quran.js', 'review.js',
  'words.js', 'lesson.js', 'skill.js', 'contrast.js', 'screens.js', 'gate.js', 'main.js'];
const writers = SCREENS.filter((file) => WRITERS.test(src(file)));
ok(!writers.length,
  `ولا شاشةَ تكتب في العدّاد إلا من باب \`fade.js\` (${writers.join('، ') || 'صفر'})`);

const USERS = ['story.js', 'ladder.js', 'garden.js'];
for (const file of USERS) {
  ok(/from '\.\/fade\.js'/.test(src(file)), `${file} يعرض بدرجات الخفوت`);
}
ok(/from '\.\/fade\.js'/.test(src('parent.js')), 'ولوحةُ وليّ الأمر تقرأ الدرجات لتعرضها');

// حوضُ «رتّب» و«أكمل» في `ladder.js`: بلاطاتُه وخياراتُه تُبنى بـ`h` لا بمُصيِّر الخفوت
const ladder = src('ladder.js');
for (const [what, where] of [['tile-face', 'بلاطات «رتّب»'], ['vchip-face', 'خيارات «أكمل»']]) {
  const line = ladder.split('\n').find((l) => l.includes(what)) || '';
  ok(!/textWord|fadeWord|faded\(/.test(line), `${where} بدرجةٍ واحدة لا تخفت`);
}

// ————— ٤) «قاعدة الشاهد الواحد» (حزمة «قياس العلامات») —————
//
// الإشارةُ التي تُشترى بالتخمين لا تُبنى عليها درجةُ عرضٍ تلاحق الطفل. فلا يُحتسب
// إلا موضعٌ شهد **لكلمةٍ بعينها** — والقاعدةُ بنيوية: `credit` تقبل كلمةً واحدة.

console.log('\n— قاعدة الشاهد الواحد: لا احتساب إلا بشاهدٍ لكلمة —');
p.reset();
ok(fade.credit('غُرْفَةْ') === true && p.readCount(p.wordKey('غُرْفَةْ')) === 1,
  'الكلمةُ الواحدة تُحتسب');
ok(fade.credit(['غُرْفَةْ', 'سَرِيرْ', 'بَابْ']) === false,
  '**وقائمةُ كلماتٍ تُردّ صامتةً** — فاحتسابُ جملةٍ كاملة مستحيلٌ لا ممنوع');
ok(p.readCount(p.wordKey('سَرِيرْ')) === 0 && p.readCount(p.wordKey('بَابْ')) === 0,
  'ولم تُسجَّل منها كلمةٌ واحدة');
ok(fade.credit() === false && fade.credit(null) === false && fade.credit(0) === false,
  'والفارغُ وغيرُ النصّ يُردّان بلا انهيار');
ok(fade.credit.length === 1,
  'وتوقيعُ الدالّة كلمةٌ واحدة لا `...texts` — الحصانةُ في الشكل لا في التعليق');

// المواضعُ على المصدر: مَن يحتسب، وبماذا يحتسب
const ladderSrc = src('ladder.js');
const storySrc = src('story.js');
const gardenSrc = src('garden.js');
const calls = (text) => (text.match(/\bcredit\s*\(([^)]*)\)/g) || [])
  .filter((c) => !c.startsWith('credit()'));

ok(calls(storySrc).length === 0,
  'سؤالُ الفهم لا يحتسب: نقرةٌ بين ثلاث صورٍ شاهدٌ على الجملة لا على كلماتها');
ok(!/from '\.\/fade\.js'[\s\S]{0,80}credit/.test(storySrc) && !/\bcredit\b/.test(storySrc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')),
  'ولا يستورد `credit` أصلاً — عرضٌ بالخفوت بلا احتساب');

const ladderCalls = calls(ladderSrc);
ok(ladderCalls.length === 2,
  `و«سلّم الجمل» يحتسب من موضعين لا أربعة (${ladderCalls.join(' · ')})`);
ok(ladderCalls.some((c) => c.includes('expected')),
  'الأول: «رتّب» بالكلمة المطلوبة في موضعها');
ok(ladderCalls.some((c) => c.includes('sentence.blank')),
  'والثاني: «أكمل» بالكلمة التي ملأت الفراغ وحدَها');
ok(!ladderCalls.some((c) => /credit\(sentence\.words\)/.test(c)),
  '**ولا موضعَ يحتسب الجملةَ كلها** (كان يفعل: ٣–٥ كلماتٍ من نقرةٍ احتمالُها الثلث)');
ok(calls(gardenSrc).length === 1 && calls(gardenSrc)[0].includes('word.read'),
  'و«اقرأ واختر» يحتسب الكلمة المختارة من ثلاثٍ مكتوبة');

// «اقرأ ونفّذ» — الميكانيكية الثلاثية الصور: لا احتساب في جسمها
const readView = ladderSrc.slice(ladderSrc.indexOf('function readView'),
  ladderSrc.indexOf('function orderView'));
ok(!/\bcredit\s*\(/.test(readView.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')),
  'و«اقرأ ونفّذ» بلا احتسابٍ البتّة');

console.log('\n— صفر إضافة صوتية —');
const fadeSrc = src('fade.js');
ok(!/audio\.js|speechSynthesis|SpeechSynthesis/.test(fadeSrc),
  'وحدة الخفوت لا تعرف الصوت: لا نصَّ منطوقاً جديداً ولا مفتاحَ ملفٍّ جديد');
ok(/js\/fade\.js/.test(readFileSync(new URL('../sw.js', APP), 'utf8')),
  'و`fade.js` في قشرة عامل الخدمة — تعمل دون إنترنت كبقية الوحدات');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات الخفوت ناجحة');
process.exit(fails ? 1 : 0);
