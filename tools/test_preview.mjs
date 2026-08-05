// اختبار «وضع المعاينة» (`?preview=1` — أمر المالك، ١٣ أغسطس ٢٠٢٦):
//   node tools/test_preview.mjs
//
// **السؤال الذي وُلد منه**: «بصفتي مدرّساً يريد أن يقيّم البرنامج، هل ينبغي أن نفتح
// كلَّ شيء للتجربة أم يمشي خطوة خطوة؟» — والجواب: **القفلُ التسلسليّ جوهرُ المنهج
// للطفل، والمقيّمُ يحتاج أن يرى المحطات كلَّها**. فوضعٌ ثالثٌ لا يخلط بينهما.
//
// والمحروس هنا ثلاثة، وكلُّها شروطُ قبولٍ لا زينة:
//   ١) **يفتح**: كلُّ عقدةٍ في الرحلة مفتوحةٌ للتصفّح.
//   ٢) **ولا يكتب**: لا يُمَسّ `localStorage` بحرف — فمن قيّم على جهاز طفلٍ أعاده
//      كما كان، لا نجمةً زُرعت ولا محواً وقع.
//   ٣) **ولا يكذب**: الجبهةُ تبقى على حقيقتها، فلا تقول الخريطةُ «أتممتَ الرحلة».
//      (وقد قالتها في أول تنفيذ حين دُفعت الجبهةُ إلى آخر الرحلة — فأُصلح.)

const store = new Map();
let writes = 0;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { writes += 1; store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
};
// وضعُ المعاينة يُقرأ من العنوان عند تحميل الوحدة — فيُهيَّأ قبل الاستيراد
globalThis.location = { search: '?preview=1', protocol: 'https:', origin: 'https://muallim.test' };

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const progress = await import(new URL('../app/js/progress.js', import.meta.url));

console.log('\n١. يفتح المحطات كلَّها');

ok(progress.PREVIEW === true, 'وضعُ المعاينة مقروءٌ من العنوان (`?preview=1`)');

const nodes = progress.journey().flatMap((section) => section.nodes || []);
ok(nodes.length > 100, `الرحلةُ فيها ${nodes.length} عقدة`);
const locked = nodes.filter((n) => !progress.isNodeUnlockedById(n.id));
ok(locked.length === 0,
  `وكلُّها مفتوحةٌ للتصفّح${locked.length ? ` — بقي مقفلاً: ${locked.length}` : ''}`);

// تُلتقط قبل أي تغيير: نجمةٌ تُزرع في الجلسة تحرّك الجبهةَ في الذاكرة (وهو صواب —
// المعاينةُ تُرسم كما تجري) فلا تصلح للقياس بعدها.
const frontierAtStart = progress.unlockFrontier();
const lastNode = nodes[nodes.length - 1].id;

console.log('\n٢. ولا يكتب في تقدّم أحد');

const before = writes;
progress.setStars(nodes[0].id, 3);
progress.logRecording({ node: nodes[0].id, title: 'تجربة', seconds: 3 });
ok(writes === before,
  `لا كتابةَ واحدة في المخزن بعد نجومٍ وتسجيل (${writes - before} كتابة)`);
ok(store.size === 0, 'والمخزنُ فارغٌ كما كان — لا أثرَ لزيارة المقيّم');

console.log('\n٣. ولا يكذب على المقيّم');

// الجبهةُ تُحسب من الإتمام الحقيقيّ: لا نجومَ محفوظةً ⇒ الجبهةُ أولُ عقدة
ok(frontierAtStart === 0,
  `الجبهةُ عند الفتح على حقيقتها (${frontierAtStart}) — لا تُدفَع إلى آخر الرحلة`);
ok(progress.unlockFrontier() < nodes.length,
  `وتبقى دون نهاية الرحلة بعد التصفّح (${progress.unlockFrontier()} من ${nodes.length})`);
ok(progress.nextNode() && progress.nextNode().id !== lastNode,
  '«تابع من هنا» يشير إلى موضعٍ حقيقيّ لا إلى نهايتها (فلا تقول الخريطةُ «أتممتَ الرحلة»)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات وضع المعاينة ناجحة');
process.exit(fails ? 1 : 0);
