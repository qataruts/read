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

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات عقد الرحلة ناجحة');
process.exit(fails ? 1 : 0);
