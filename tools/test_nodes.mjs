// حارسُ «لا عقدةَ بلا كاتبِ نجمة»:
//   node tools/test_nodes.mjs
//
// **العيبُ الذي وُلد منه** (بلاغ المالك، ١٣ أغسطس ٢٠٢٦): «البرنامج توقّف عند هذا
// الموضع، وعند الانتهاء منه لا يفتح الحلقة التالية».
//
// وعلّتُه معرّفان لعقدةٍ واحدة: الرحلةُ تنشئ قصةَ السورة `prophet:alfil-walkaaba`
// (`progress.js`)، والشاشةُ تكتب نجمتَها `library:alfil-walkaaba` (`story.js` كانت
// تعرف محورَي موضعٍ لا ثلاثة). فالنجمةُ تُحفظ في مكانٍ لا يُقرأ ⇒ `isDone` كاذبةٌ
// أبداً ⇒ **الجبهةُ تتجمّد عند تلك العقدة فلا يُفتَح بعدها شيءٌ ما حيي الجهاز**.
//
// وهو صنفٌ يستحقّ حارساً لا إصلاحاً: **كلُّ عقدةٍ في الرحلة يجب أن يكون لها شاشةٌ
// تكتب نجمتَها بمعرّفها هو**. وسابقةٌ لا كاتبَ لها تعني طريقاً مسدوداً في الرحلة —
// ولا يظهر في اختبارٍ ولا لقطة، بل في جهاز طفلٍ بعد أسابيع.
//
// **والاستثناءُ المكتوبُ بعلّته**: عقدُ مجموعات الحروف (`g1`…`g7`) تُبنى بمساعدٍ
// واحد (`nodeId(groupId, part)`) ومعرّفُها من بيانات المنهج لا من نصٍّ في شاشة —
// فلا سابقةَ مكتوبةً لها في ملفٍّ يُفتَّش. وهي مفحوصةٌ سلوكاً في `browser_test.py`.

import { readFileSync, readdirSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);
const read = (name) => readFileSync(new URL(name, APP), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const progress = await import(new URL('progress.js', APP));
const { GROUPS } = await import(new URL('curriculum.js', APP));

console.log('\n١. لكل سابقةِ عقدةٍ شاشةٌ تكتب نجمتَها');

const nodes = progress.allNodes();
ok(nodes.length > 200, `الرحلةُ فيها ${nodes.length} عقدة`);

// **مصنعُ العقد والموجِّه يُستثنيان**: `progress.js` ينشئ المعرّفات و`main.js`
// يحرس بها الطريق — وكلاهما يذكر كلَّ سابقة. والمقيسُ **مَن يكتب النجمة** لا مَن
// يذكر الاسم؛ ولولا هذا الاستثناء لمرّ العيبُ نفسُه (كان `prophet:` في كليهما).
const FACTORY = new Set(['progress.js', 'main.js']);
const GROUP_IDS = new Set(GROUPS.map((g) => g.id));

const writers = new Map();
for (const name of readdirSync(APP).filter((f) => f.endsWith('.js'))) {
  if (FACTORY.has(name)) continue;
  const src = read(name);
  if (!src.includes('setStars(') && !src.includes('nodeId')) continue;
  const literals = new Set([...src.matchAll(/['"`]([a-z][a-z0-9]*)['"`:]/g)].map((m) => m[1]));
  writers.set(name, literals);
}
ok(writers.size >= 6, `وشاشاتٌ تكتب النجوم: ${writers.size} وحدة`);

const prefixes = [...new Set(nodes.map((n) => n.id.split(':')[0]))].sort();
const orphans = [];
for (const prefix of prefixes) {
  if (GROUP_IDS.has(prefix)) continue;                 // الاستثناءُ المعلَن أعلاه
  const who = [...writers].filter(([, set]) => set.has(prefix)).map(([name]) => name);
  if (!who.length) orphans.push(prefix);
}
ok(orphans.length === 0,
  `ولا سابقةَ بلا كاتب (${prefixes.length} سابقة، منها ${GROUP_IDS.size} مجموعةَ حروف)`
  + (orphans.length ? ` — يتيمة: ${orphans.join('، ')}` : ''));

console.log('\n٢. ولا معرّفَ يتكرّر ولا عقدةَ بلا معرّف');

const ids = nodes.map((n) => n.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
ok(dupes.length === 0,
  `كلُّ معرّفٍ فريد${dupes.length ? ` — مكرَّر: ${[...new Set(dupes)].join('، ')}` : ''}`);
ok(ids.every((id) => id && id.includes(':')), 'ولكلٍّ سابقةٌ ومعرّف');

console.log('\n٣. وقصةُ السورة تُكتب بمحورها لا بمحورِ غيرها');

// العيبُ بعينه: المحاورُ الثلاثة (بستان · رفّ · سورة) لكلٍّ سابقتُه، ومصدرُها
// حقلُ القصة نفسِه — فقصةٌ بمحورٍ رابع غداً لا تحتاج سطراً هنا ولا هناك.
const storySrc = read('story.js');
ok(/story\.surah \? 'prophet'/.test(storySrc),
  'شاشةُ القصة تشتقّ سابقتَها من محور القصة (`surah` ⇒ `prophet`)');
const prophetNodes = nodes.filter((n) => n.id.startsWith('prophet:'));
ok(prophetNodes.length > 0, `وللمرحلة القرآنية قصصُها (${prophetNodes.length})`);

// والترحيلُ الرحيم: مَن قرأ القصة قبل الإصلاح نجمتُه في المكان القديم — تُنقَل
// مرّةً ولا يُعاد عليه ما أتمّ.
ok(/library:\$\{node\.id\.slice/.test(read('progress.js')),
  'وترحيلٌ رحيم ينقل نجمةً كُتبت تحت السابقة القديمة');

// ————— ٤. الرحلةُ كلُّها تُفتَح عقدةً عقدة —————
//
// **حارسُ الطريق المسدود** (وز١، ١٥ أغسطس ٢٠٢٦): إعادةُ قسمة الرحلة تحرّك مواضعَ
// مئتي عقدة، وعطبُ القفل لا يظهر في اختبارِ محطةٍ واحدة بل في **مشيةٍ كاملة**: طفلٌ
// يبدأ من الصفر ويتمّ عقدةً عقدة حتى الرفّ، فإن استعصت واحدةٌ وقفت الرحلةُ عندها.

console.log('\n٤. الرحلةُ كلُّها تُفتَح عقدةً عقدة حتى الرفّ');

progress.reset();
let walked = 0;
let stuck = null;
for (const node of nodes) {
  if (!progress.isNodeUnlockedById(node.id)) { stuck = node.id; break; }
  progress.setStars(node.id, 3);
  walked++;
}
ok(stuck === null && walked === nodes.length,
  `${walked} عقدة تُفتح بالتسلسل حتى آخرها${stuck ? ` — وقفت عند ${stuck}` : ''}`);
ok(progress.nextNode() === null, 'وبإتمام آخرها لا يبقى شيء (الجبهةُ خارج القائمة)');

// ————— ٥. الترحيلُ لا يحبس ولا يهب —————
//
// **توزيعُ الدفعات أزاح ولم يستحدث** (وز١): من كان في منتصف الكتلة القرآنية القديمة
// صار أمامه بستانان ودفعةٌ لم يبلغها. فالمحروسُ شيئان متقابلان:
//   (أ) **لا حبس**: نجومُه كلُّها باقيةٌ بمعرّفاتها، ويستأنف من أول عقدةٍ ناقصة.
//   (ب) **لا هبة**: العقدةُ المُزاحة لا تُوهَب نجمةَ إتمام — فلا يتخطّى سورةً لم
//       يقرأها ولا بوابةً لم يعبرها (وهبةُ النجمة لمحطةٍ **استُحدثت** خلفه لا لمُزاحة).

console.log('\n٥. ترحيلُ تقدّمٍ مزروعٍ في منتصف الكتلة القديمة');

// تقدّمٌ كما كان يُحفظ تحت الترتيب القديم: التأسيسُ كلُّه ثم التهيئةُ والرسمُ ثم
// ثلاثُ سورٍ بكلماتها (الفاتحة · الإخلاص · الفلق) — وهي أوائل السور في الترتيب القديم.
const OLD_DONE = ['sw-s1', 's1', 'sw-s112', 's112', 'sw-s113', 's113'];
const seeded = {};
for (const node of nodes) {
  if (node.id.startsWith('quran:') || node.id === 'gate:gardens') break;
  seeded[node.id] = 3;
}
for (const part of ['letters', 'words1', 'words2', 'words3', 'rasm', 'muqattaat', ...OLD_DONE]) {
  seeded[`quran:${part}`] = 3;
}
store.set('muallim.progress.v1', JSON.stringify({ v: 2, stars: seeded }));   // بلا `order` — حالةٌ قديمة
const migrated = await import(new URL('progress.js?wz1', APP));

ok(OLD_DONE.every((part) => migrated.getStars(`quran:${part}`) === 3),
  'نجومُ ما أتمّه باقيةٌ بمعرّفاتها (ثلاثُ سورٍ بكلماتها)');
ok(migrated.getStars('quran:s108') === 0 && migrated.getStars('quran:sw-s108') === 0,
  '**ولا هبة**: الكوثرُ أُزيح إلى ما قبل الإخلاص فلم يُوهَب نجمة — يقرؤه ولا يتخطّاه');
ok(migrated.getStars('gate:gardens') === 0,
  'وبوابةُ الحديقة أُزيحت إلى ما بعد الدفعة الأولى فلم تُعَدّ مجتازة — يعبرها بإصابته');
ok(migrated.nextNode()?.id === 'quran:sw-s108',
  `**ولا حبس**: يستأنف من أول عقدةٍ ناقصة (${migrated.nextNode()?.id})`);
ok(migrated.isNodeUnlockedById('quran:sw-s108')
  && !migrated.isNodeUnlockedById('quran:s113'),
  'وما بعدها مقفلٌ بالتسلسل كما هو — ولو كانت له فيه نجمة');

// ————— ٦. جردُ حدّ المحطة (١٠–١٢ حلقة — حدُّ المالك) —————
//
// **الحدُّ يُقاس بالمحطة لا بالعقدة** (`REVIEW_METHOD §٣`): «المجموعة» محطةٌ مسمّاة
// على الخريطة و«الحلقة» عقدةٌ فيها. وكان المتجاوزان اثنين: الكتلةُ القرآنية (٣١
// عقدةً تحت خمس محطاتٍ متتالية) والوحدةُ الموضوعية للبستان (١٩–٢٣ حلقةً متّصلة) —
// عولجا في وز١ بالتوزيع وبالشقّ بالنوع. **والجردُ يُطبع** ليُقرأ في المراجعة.

console.log('\n٦. جردُ حدّ المحطة: أطولُ امتدادٍ من نوعٍ واحد');

const LIMIT = 12;                       // حدُّ المالك الأعلى
const TIGHT = 7;                        // ما شُقّ في وز١ لا يعود إلى ما فوقه
const sections = progress.journey();
const byKind = new Map();
for (const section of sections) {
  const kind = section.kind;
  byKind.set(kind, Math.max(byKind.get(kind) || 0, section.nodes.length));
}
const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
for (const [kind, max] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${kind.padEnd(10)} أطولُ محطةٍ ${arNum(max)}`);
}
const widest = sections.reduce((a, b) => (b.nodes.length > a.nodes.length ? b : a));
ok(widest.nodes.length <= LIMIT,
  `أطولُ محطةٍ في الرحلة ${arNum(widest.nodes.length)} حلقات (${widest.id}) — حدُّ المالك ${arNum(LIMIT)}`);
ok((byKind.get('quran') || 0) <= TIGHT && (byKind.get('garden') || 0) <= TIGHT
  && (byKind.get('ladder') || 0) <= TIGHT,
  `والمشقوقان في وز١ دون ${arNum(TIGHT)}: قرآنيةٌ ${arNum(byKind.get('quran'))} · `
  + `باقاتٌ ${arNum(byKind.get('garden'))} · سلّمٌ ${arNum(byKind.get('ladder'))}`);

// **ورقمان يُطبعان ولا يُحكَم بهما** — لأنّ لكلٍّ منهما علّةً بنيوية معلَنة:
//   (أ) **الامتدادُ الموضوعيّ**: البستانُ كلُّه على موضوعه (٢١ حلقةً في اللعب)
//       والشقُّ لم يقصده — إنما شقّ **النوع** ليتقارب التعليمُ (الباقة) والتوظيفُ
//       (الجملة)، فصارت المحطةُ خمساً وستّاً بدل عشرٍ وعشر.
//   (ب) **الامتدادُ أحاديُّ نوعِ العقدة**: أطولُه رأسُ المرحلة القرآنية (التهيئةُ
//       والرسمُ والدفعةُ الأولى) — ثلاثُ محطاتٍ بثلاث ميكانيكيّات، وتجاورُها
//       **تفرضه المفكوكية**: لا نصَّ عثمانيّ قبل درس الحرفين وعلامات الرسم.
const runOf = (key) => {
  let run = 0;
  let last = null;
  let top = { n: 0, of: '' };
  for (const node of nodes) {
    const its = key(node);
    run = its === last ? run + 1 : 1;
    last = its;
    if (run > top.n) top = { n: run, of: its };
  }
  return top;
};
const topic = runOf((n) => n.garden?.id || n.type);
const typed = runOf((n) => n.type);
console.log(`    أطولُ امتدادٍ موضوعيّ: ${arNum(topic.n)} حلقة (${topic.of}) — البستانُ كلُّه على موضوعه`);
console.log(`    أطولُ امتدادٍ أحاديّ النوع: ${arNum(typed.n)} حلقة (${typed.of}) — رأسُ المرحلة، تفرضه المفكوكية`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات عقد الرحلة ناجحة');
process.exit(fails ? 1 : 0);
