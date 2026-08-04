// اختبار «صلابة التقدّم» (الحزمة ١١) — بلا متصفّح:
//   node tools/test_backup.mjs
//
// المحروس هنا أربعة، وكلها شروطُ قبولٍ لا زينة:
//   ١) **النسخة الاحتياطية عقدٌ محكم**: ما يخرج يعود كما خرج حرفاً بحرف (نجوماً
//      وصناديقَ ليتنر ودقائقَ ومراجعاتٍ ومددَ قراءات)، وما ليس نسخةً يُرفَض بسببه
//      المعلَن — الاستعادة تكتب فوق تقدّمٍ قائم فلا تقبل مجهولاً.
//   ٢) **ولا صوتَ فيها البتّة**: تسجيلات الطفل لا تغادر جهازه (الحزمة ١٠)، والنسخة
//      ملفٌّ يُنسَخ ويُرسَل — فدخولُ صوته فيها نقضٌ للقاعدة من بابٍ خلفيّ.
//   ٣) **تحكّم وليّ الأمر**: الفتح اليدويّ يفكّ القفل بنجمةٍ لا يدّعي بها إتقاناً،
//      والتصفير يمسّ النجوم **ولا يمسّ سجلّ ليتنر** ولا ما بعد المحطة من نجوم.
//   ٤) **عاملُ الخدمة لا يعرف طريقاً إلى التقدّم**: ترقية نسخته تمحو المخزون وحده،
//      وليس في `sw.js` سطرٌ واحد يمسّ `localStorage` أو `indexedDB` (والدورة كاملةً
//      في متصفّح حقيقي: `python3 tools/browser_test.py --parent`).

import { readFileSync } from 'node:fs';

const APP = new URL('../app/', import.meta.url);
const read = (p) => readFileSync(new URL(p, APP), 'utf8');

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const p = await import(new URL('js/progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

// ————— حالةُ طفلٍ في منتصف رحلته: نجومٌ ومهاراتٌ ودقائقُ وقراءاتٌ ومراجعات —————

const NODES = p.allNodes();
const seeded = NODES.slice(0, 12);
for (const [i, node] of seeded.entries()) p.setStars(node.id, (i % 3) + 1);
p.recordAttempt('ب', 'fatha', p.KINDS.QUIZ, true);
p.recordAttempt('ب', 'fatha', p.KINDS.QUIZ, true);
p.recordAttempt('م', 'kasra', p.KINDS.BUILD, false);
p.addSeconds(420);
p.markReview(8, 7);
p.logRecording({ node: 'story:s1', title: 'قصة', seconds: 31.5 });
p.allowMic(true);

const before = p.snapshot();

// ————— ١. الملف: ترويسةٌ تعرّف نفسها وحالةٌ كاملة —————

console.log('\n١. ملف النسخة');

const bundle = p.backup();
ok(bundle.kind === p.BACKUP_KIND && bundle.format === p.BACKUP_FORMAT && bundle.savedAt > 0,
  `النسخة تعرّف نفسها (${bundle.kind} · شكل ${bundle.format})`);
const text = p.backupText(bundle);
ok(JSON.parse(text).state.stars[seeded[0].id] === before.stars[seeded[0].id],
  'ونصُّها JSON يحمل حالة الطفل كما هي');
ok(/^muallim-progress-\d{4}-\d{2}-\d{2}\.json$/.test(p.backupName()),
  `واسمُ الملف بيومه فلا تطمس نسخةٌ أختَها (${p.backupName()})`);

// ————— ٢. لا صوتَ في النسخة (قاعدة الخصوصية) —————

console.log('\n٢. لا صوت في النسخة');

const flat = JSON.stringify(bundle);
const audioWords = ['blob', 'base64', 'audio/webm', 'clip', 'IndexedDB'];
const leaked = audioWords.filter((w) => flat.includes(w));
ok(leaked.length === 0,
  `ولا أثرَ لصوت الطفل فيها${leaked.length ? ' — تسرّب: ' + leaked.join('، ') : ''}`);
ok(bundle.state.records.length === 1 && bundle.state.records[0].seconds === 31.5
  && !('blob' in bundle.state.records[0]),
  'والمحفوظ من «اقرأ لي» مدّةٌ وتاريخٌ لا صوت (فيبقى منحنى الطلاقة بعد الاستعادة)');
const parentJs = read('js/parent.js');
ok(!/recordings\.(listClips|clipBlob)[\s\S]{0,400}backup/.test(parentJs)
  && !/backupText\(\)[\s\S]{0,200}clip/.test(parentJs),
  'ولا تجمع اللوحةُ صوتاً مع النسخة');

// ————— ٣. الدورة: تصدير ← محوٌ كامل ← استعادة مطابقة —————

console.log('\n٣. الدورة الكاملة (تصدير ← محو ← استعادة)');

p.reset();
ok(p.totalStars() === 0 && p.skills().length === 0, 'المحو أفرغ الجهاز (كحذف التطبيق)');

const readBack = p.readBackup(text);
ok(!readBack.error && readBack.bundle, `والملف يُقرأ بلا خطأ (${readBack.error || 'سليم'})`);
ok(p.restore(readBack.bundle), 'والاستعادة تقبله');

const after = p.snapshot();
const same = (key) => JSON.stringify(after[key]) === JSON.stringify(before[key]);
for (const key of ['stars', 'skills', 'days', 'reviews', 'records', 'mic', 'seconds']) {
  ok(same(key), `«${key}» عاد كما كان حرفاً بحرف`);
}
ok(p.totalStars() === seeded.reduce((s, n, i) => s + (i % 3) + 1, 0)
  && p.nextNode().id === NODES[12].id,
  'والجبهة عادت إلى موضعها (القفل يُحسب من الحالة المستعادة لا من ذاكرةٍ قديمة)');
ok(p.getSkill('ب|fatha|quiz').box === 2 && p.getSkill('م|kasra|build').box === 0,
  'وصناديق ليتنر عادت بأرقامها (المراجعة تكمل من حيث وقفت)');

// ————— ٤. لا يُستعاد مجهول —————

console.log('\n٤. ما يُرفَض من الملفات');

const bad = [
  ['ليس json أصلاً', 'تعذّرت'],
  [JSON.stringify({ stars: { 'g1:ا': 3 } }), 'ليس نسخة'],
  [JSON.stringify({ kind: p.BACKUP_KIND, format: 99, state: { stars: {} } }), 'إصدار أحدث'],
  [JSON.stringify({ kind: p.BACKUP_KIND, state: { v: 2, stars: {} } }), 'بلا إعلان شكله'],
  [JSON.stringify({ kind: p.BACKUP_KIND, format: 1, state: { v: 2 } }), 'معطوب'],
  [JSON.stringify({ kind: p.BACKUP_KIND, format: 1, state: { v: 9, stars: {} } }), 'نسخة حالة مجهولة'],
];
for (const [raw, why] of bad) {
  const res = p.readBackup(raw);
  ok(!!res.error && !res.bundle, `يُرفَض (${why}) برسالةٍ بالعربية: «${res.error || '—'}»`);
}
ok(p.totalStars() > 0, 'ولا يمسّ الرفضُ تقدّمَ الطفل القائم');
ok(!p.restore(null) && !p.restore({ state: null }), 'والاستعادة نفسها ترفض ما ليس حالة');

// نسخةٌ من النسخة ١ (طفلٌ بدأ قبل سجلّ المهارات) تُرقّى ولا تُرفَض
const old = p.readBackup(JSON.stringify({
  kind: p.BACKUP_KIND, format: 1, savedAt: 1,
  state: { v: 1, stars: { 'g1:ا': 3, 'g1:ب': 2 }, seconds: 60, errors: { x: 1 } },
}));
ok(!old.error && old.bundle.state.v === p.VERSION && old.bundle.state.stars['g1:ا'] === 3,
  'ونسخةٌ من إصدارٍ أقدم تُرقّى بلا فقد (لا يُحبَس طفلٌ نسخ تقدّمه قديماً)');

// ملخّصُ النسخة كما يقرؤه وليّ الأمر قبل التأكيد
const sum = p.backupSummary(readBack.bundle);
ok(sum.nodes === seeded.length && sum.stars === p.totalStars() && sum.skills === 2
  && sum.records === 1,
  `وملخّصُها صادق قبل التأكيد (★${sum.stars} في ${sum.nodes} عقدة · ${sum.skills} مهارات)`);
ok(p.backupSummary({ state: { stars: { 'لا-وجود-لها': 3 } } }).stars === 0,
  'ولا يَعُدّ نجومَ عقدةٍ لا وجود لها في رحلة اليوم');

// ————— ٥. تحكّم وليّ الأمر: الفتح اليدويّ —————

console.log('\n٥. الفتح اليدويّ والتصفير');

p.reset();
const target = NODES[30];
ok(!p.isNodeUnlockedById(target.id), 'العقدة البعيدة مقفلة ابتداءً');
ok(p.pendingBefore(target.id) === 30, `والناقص قبلها ٣٠ عقدة (${p.pendingBefore(target.id)})`);
p.setStars(NODES[0].id, 3);                       // نجمةٌ كسبها الطفل بحقّ
const opened = p.unlockUpTo(target.id);
ok(opened === 29, `الفتح اليدويّ فتح ما نقص وحده (${opened} عقدة)`);
ok(p.isNodeUnlockedById(target.id) && p.nextNode().id === target.id,
  'والعقدة صارت جبهته (تجاوزٌ للأمام كما أراد وليّ الأمر)');
ok(p.getStars(NODES[5].id) === 1, 'وما فُتح بنجمةٍ واحدة — تفكّ القفل ولا تدّعي إتقاناً');
ok(p.getStars(NODES[0].id) === 3, 'ولا تُنقَص نجمةٌ كسبها الطفل');
ok(p.skills().length === 0, 'ولا يُخترع للفتح قياسٌ لم يقع (سجلّ المهارات فارغ كما كان)');
ok(p.pendingBefore(target.id) === 0 && p.unlockUpTo('لا-وجود-لها') === 0,
  'وعقدةٌ مجهولة لا تفتح شيئاً');

// ————— ٦. تصفير محطةٍ لإعادة التدريب —————

p.reset();
for (const node of NODES) p.setStars(node.id, 3);
p.recordAttempt('ب', 'fatha', p.KINDS.QUIZ, true);
const skillsBefore = JSON.stringify(p.snapshot().skills);
const daysBefore = JSON.stringify(p.snapshot().days);

const section = p.journey()[0];
const info = p.sectionProgress(section.id);
ok(info.nodes === section.nodes.length && info.done === info.nodes
  && info.stars === info.nodes * p.MAX_STARS,
  `حصيلةُ المحطة تُقرأ قبل التصفير (${info.done} عقدة · ★${info.stars})`);

const cleared = p.clearSection(section.id);
ok(cleared === section.nodes.length, `التصفير مسّ عقد المحطة كلها (${cleared})`);
ok(p.getStars(section.nodes[0].id) === 0 && p.nextNode().id === section.nodes[0].id,
  'وأعاد الطفل إلى أولها (وما بعدها مقفلٌ حتى يتمّها)');
ok(!p.isNodeUnlockedById(NODES.at(-1).id), 'والقفل التسلسلي هو الذي أعاد قفل ما بعدها');
ok(p.getStars(NODES.at(-1).id) === 3,
  'ونجومُ ما بعدها محفوظة تعود كما كانت — إعادةُ قفلٍ لا محو');
ok(JSON.stringify(p.snapshot().skills) === skillsBefore,
  'و**سجلّ ليتنر لم يُمسّ** (ما قِيس من مهاراته حقٌّ له لا تمحوه إعادة التدريب)');
ok(JSON.stringify(p.snapshot().days) === daysBefore, 'ولا دقائقُ تعلّمه');
ok(p.clearSection('لا-وجود-لها') === 0, 'ومحطةٌ مجهولة لا تصفّر شيئاً');

// ————— ٧. عاملُ الخدمة لا يعرف طريقاً إلى التقدّم —————

console.log('\n٧. ترقية عامل الخدمة لا تمسّ التقدّم');

const sw = read('sw.js');
ok(!/localStorage|indexedDB|IDBFactory/.test(sw),
  'ليس في sw.js سطرٌ يمسّ تخزين التقدّم (localStorage/IndexedDB)');
const deletes = [...sw.matchAll(/caches\.delete\(([^)]*)\)/g)].map((m) => m[1]);
ok(deletes.length > 0 && /muallim-/.test(sw.slice(0, sw.indexOf('caches.delete'))),
  `وما يمحوه عند الترقية مخزونُ الكاش وحده (${deletes.length} موضعاً، بشرط الاسم muallim-)`);
ok(/filter\(\(n\) => n\.startsWith\('muallim-'\)/.test(sw),
  'ولا يمحو كاشاً ليس منه (شرطُ الاسم صريح)');
ok(!/clearStorage|storage\.clear|Clear-Site-Data/i.test(sw), 'ولا يطلب محو تخزين الموقع');
ok(/navigator\.storage|persist/.test(read('js/progress.js')),
  'والتقدّم يطلب لنفسه تخزيناً دائماً (يخفّف إخلاء iOS)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات صلابة التقدّم ناجحة');
process.exit(fails ? 1 : 0);
