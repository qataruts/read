// حارسُ «بوابة اللحاق» — امتحانُ تحديد المستوى الاختياريّ (الجلسة ل١):
//   node tools/test_placement.mjs
//
// **العلّة التي يحرسها**: امتحانٌ **يفتح عقداً بلا أن يلعبها الطفل**. فخطؤه ليس
// شاشةً تُخفق بل رحلةً تُختصَر بغير حقّ — ولا يُرى ذلك في شاشةٍ ولا يشتكي منه أحد.
// فالمحروسُ سبعةٌ كلُّها قيودُ صدق:
//   ١) **السلّمُ مشتقٌّ لا مكتوب، ودرجتُه شريحة** — مجموعاتُ `journey()` بترتيبها ومع
//      كلٍّ ما يتلوها حتى التالية، ومادّتُها مفاتيحُ مهارات عقدها كلِّها. ونوعُ عقدةٍ
//      جديد في شريحةٍ يُسقِط هذا الحارسَ يومَ يُضاف.
//   ٢) **لا تُفتح محطةٌ لم تُمَسّ** (حكمُ المدير أ، الجلسة ل٢) — لكل محطةٍ في الشريحة
//      سوى مجموعتها `PER_STATION` مفتاحاً **في كل محاولة**، لا بحظّ خلطة.
//   ٣) **عتبةُ الثمانين عتبةُ البوابة نفسُها** — لا رقمَ ثانٍ يفترق عنها غداً.
//   ٤) **الوقوفُ عند الشرخ** — أوّلُ إخفاقٍ يُنهي، وما بعده لا يُفتح.
//   ٥) **حدُّ البوّابة والقرآنية** — البواباتُ لا تُقفز، والمصحفُ يُتلى لا يُمتحَن.
//   ٦) **الكتابةُ في ليتنر** — كلُّ محاولةٍ قياسٌ حقيقيّ بلا وسمٍ خاصّ.
//   ٧) **لا قفلَ رجوعاً** — ما فُتح لا يُغلق، والإعادةُ تستأنف من آخر حدّ.
//
// **ومُجرَّبٌ سالباً**: أربعُ نقائض يومَ كُتب (١٦ أغسطس ٢٠٢٦، بأرقام أبوابه يومَها ٥ و٦)
// واثنتان يومَ صارت الدرجةُ شريحة (الجلسة ل٢) — على شيفرةٍ مُعدَّلة عمداً ثم رُدَّت،
// كلُّها أحمرَّت هنا **بالاسم** ورجعت خضراء بالردّ:
//   • حذفُ `if (section.kind === 'quran') break;`      ⇒ §٦ «القرآنيةُ تقطع السلّم»
//   • جعلُ البوّابة غيرِ المجتازة تُتخطّى (`continue`)  ⇒ §٦ «البواباتُ لا تُقفز»
//   • إسقاطُ مُرشِّح `NEVER_OPENED` من `openableNodes`  ⇒ §٦ «الفتحُ يستثني البوّابة»
//   • ردُّ نجمةِ `recordPlacement` بلا شرط `getStars`   ⇒ §٧ «لا تُنقص نجمةً كسبها»
//   • **إسقاطُ فرع `skill` من `stationKeys`** (فتُترَك مفاتيحُ العلامة لحظّ الخلطة)
//        ⇒ §٣ يحمرّ **ستَّ مرّات** بأسماء الدروس: «سقط: madd-alif (0)» …
//   • **قصرُ الشريحة على قسم مجموعتها** (`parts.push` بلا ضمّ ما يليه)
//        ⇒ §١ «أقسامُها متتالية» و«تضمّ ما بين المجموعات»، و§٦ «يدخل شريحةَ مجموعته
//          قبله» و«عقدُها عقدُ أقسامها» و«ما يُفتَح يبلغ درسَ علامتها» — خمسةٌ بالاسم
//
// **وحدَّا §٦ صامتان في رحلة اليوم** (لا بوّابةَ بين المجموعتين، والقرآنيةُ بعدها
// كلِّها) — فلولا حقنُ `rungsOf` بأقسامٍ مصنوعة لمرّا ولو كانا فاسدَين. وذلك عينُ
// ما أظهره النقيضان الأوّلان: أحدُهما لم يُحرِّك §١ حرفاً وأحمرَّ §٦ وحدَه.
//
// و**حدودُ الحارس معلَنة**: لا يفتح متصفّحاً — المشهدُ الحيّ في
// `browser_test.py --placement` (دخولٌ من اللوحة، اجتيازُ مجموعتين، إخفاقٌ يوقف).

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GROUPS, HARAKAT, isLetterlessKey, markSkillKey,
} = await import(new URL('curriculum.js', APP));
const p = await import(new URL('progress.js', APP));
const { itemTexts } = await import(new URL('review.js', APP));
const gate = await import(new URL('gate.js', APP));
const pl = await import(new URL('placement.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const src = (name) => readFileSync(new URL(name, APP), 'utf8');

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ————— ١) السلّمُ مشتقٌّ من الرحلة لا مكتوب —————

console.log('\n١. السلّم مشتقٌّ من `journey()`، ودرجتُه شريحة');

p.reset();
const list = pl.rungs();
const sections = p.journey();

ok(list.length === GROUPS.length,
  `درجاتُ السلّم مجموعاتُ الرحلة كلُّها (${list.length} من ${GROUPS.length})`);
ok(list.map((r) => r.id).join('،') === GROUPS.map((g) => g.id).join('،'),
  `وبترتيب الرحلة نفسِه (${list.map((r) => r.id).join(' ← ')})`);

// **مشتقٌّ لا منسوخ**: أقسامُ الشريحة هي أقسامُ `journey()` أنفسُها (المراجعُ نفسُها)
ok(list.every((r) => r.sections.every((s) => sections.includes(s))),
  'وكلُّ قسمٍ في الشريحة هو القسمُ نفسُه من الرحلة — لا نسخةٌ تفترق عنه يوماً');
ok(list.every((r) => r.sections[0].kind === 'group' && r.sections[0].group === r.group),
  'وصدرُ كل شريحةٍ مجموعتُها — وباسمها تُسمّى في اللوحة');

// **الشريحةُ متّصلةٌ بترتيب الرحلة**: أقسامُها متتاليةٌ فيها، ومسطَّحُ الشرائح كلِّها
// هو عينُ أقسام الرحلة إلى حدّ السلّم — فلا قسمَ يُقفَز ولا يُكرَّر ولا يُعاد ترتيبه.
const flat = list.flatMap((r) => r.sections);
const at = flat.map((s) => sections.indexOf(s));
ok(at.every((n, i) => i === 0 || n === at[i - 1] + 1),
  `وأقسامُها متتاليةٌ بترتيب الرحلة بلا فجوة (${at[0]} ← ${at[at.length - 1]})`);
ok(list.every((r) => r.nodes.length === r.sections.reduce((n, s) => n + s.nodes.length, 0)),
  'وعقدُ الشريحة مسطَّحُ عقد أقسامها كلِّها');

// **وهي شريحةٌ حقاً لا مجموعةٌ بثوبٍ آخر**: في رحلة اليوم درسُ علامةٍ في ستٍّ منها
// ومحطةُ مواجهةٍ في اثنتين — فلو رجعت الدرجةُ مجموعةً محضةً احمرَّ هذا السطر.
const has = (type) => list.filter((r) => r.nodes.some((n) => n.type === type)).length;
ok(has('skill') >= 2 && has('contrast') >= 1 && list.some((r) => r.sections.length > 1),
  `وتضمّ ما بين المجموعات: ${has('skill')} شريحةً بدرسِ علامةٍ و${has('contrast')} بمحطة مواجهة`);

// ولا درجةَ بعد أوّل قسمٍ قرآنيّ
const firstQuran = sections.findIndex((s) => s.kind === 'quran');
ok(firstQuran > 0 && at[at.length - 1] < firstQuran,
  `والسلّمُ كلُّه قبل المرحلة القرآنية (آخرُ قسمٍ ${at[at.length - 1]} < ${firstQuran})`);

// **أنواعُ عقد الشريحة معلَنةٌ كلُّها**: نوعٌ خامس يدخل شريحةً غداً بلا مفاتيحَ تُمتحَن
// يُسقِط هذا السطر يومَ يُضاف — فلا يمرّ صامتاً فيُفتح بامتحانٍ لم يمسّه.
const KNOWN = new Set([...pl.MEASURED, ...pl.READ_ONLY]);
const strange = [...new Set(list.flatMap((r) => r.nodes.map((n) => n.type)))]
  .filter((t) => !KNOWN.has(t));
ok(strange.length === 0,
  `وأنواعُ عقدها معلَنةٌ: تُقاس (${[...pl.MEASURED].join('، ')}) أو تُقرأ (${[...pl.READ_ONLY].join('، ')})`
  + (strange.length ? ` — **بلا مفاتيح: ${strange.join('، ')}**` : ''));
ok([...pl.MEASURED].every((t) => !pl.READ_ONLY.has(t)),
  'ولا نوعَ في الجدولين معاً — يُقاس أو يُقرأ لا كلاهما');

// ————— ٢) مفاتيحُ المهارات: من العقد لا من قائمةٍ تُكتب —————

console.log('\n٢. مفاتيحُ الدرجة مشتقّةٌ من عقدها');

for (const rung of list) {
  const keys = pl.skillKeys(rung);
  const letters = rung.group.letters;
  const quiz = keys.filter((k) => k.kind === p.KINDS.QUIZ);
  const haraka = keys.filter((k) => k.kind === p.KINDS.HARAKA);
  const build = keys.filter((k) => k.kind === p.KINDS.BUILD);
  const want = letters.length * HARAKAT.length;
  ok(quiz.length === want && haraka.length === want && build.length > 0,
    `[${rung.id}] ${letters.length} حروفٍ × ${HARAKAT.length} حركات ⇒ `
    + `${quiz.length} تمييزاً و${haraka.length} حركةً و${build.length} مقطعاً`);
  ok(keys.every((k) => new Set(keys.map((x) => p.skillKey(x.letter, x.haraka, x.kind))).size === keys.length),
    `[${rung.id}] ولا مفتاحَ مكرَّر`);
  // **المفكوكية بالبناء**: لا مفتاحَ لحرفٍ من خارج المجموعة (والمقاطعُ من كلماتها،
  // وكلماتُها مفكوكةٌ بحصيلته — يحرسه `check_decodable.py`).
  const own = new Set(letters);
  const alien = [...quiz, ...haraka].filter((k) => !own.has(k.letter));
  ok(alien.length === 0,
    `[${rung.id}] ولا يُمتحَن بحرفٍ من خارجها${alien.length ? ' — ' + alien.map((k) => k.letter).join('،') : ''}`);

  // **ومحطاتُها الأخرى بمفاتيحها هي**: درسُ العلامة نوعَيه بمفتاح `mark-<الدرس>`،
  // ومحطةُ المواجهة حروفَ أزواجها بحركاتها — وهي عينُ ما تكتبه المحطتان في ليتنر
  // (`skill.js` و`contrast.js`)، فلا مفتاحٌ يشبهها ولا يلتقي بها في صندوق.
  const marks = rung.nodes.filter((n) => n.type === 'skill');
  const markKeys = keys.filter((k) => p.isMarkSkill(k));
  const wantMarks = new Set(marks.flatMap((n) =>
    [p.KINDS.MARK_COMPARE, p.KINDS.MARK_QUIZ]
      .map((kind) => p.skillKey(markSkillKey(n.skill.id), null, kind))));
  ok(markKeys.length === wantMarks.size
    && markKeys.every((k) => wantMarks.has(p.skillKey(k.letter, k.haraka, k.kind))),
    `[${rung.id}] ولكل درسِ علامةٍ فيها نوعاه (${marks.length} درساً ⇒ ${markKeys.length} مفتاحاً)`);

  const stations = rung.nodes.filter((n) => n.type === 'contrast');
  const pairLetters = new Set(stations.flatMap((n) => n.contrast.pairs.flatMap((x) => x.letters)));
  const contrast = keys.filter((k) => k.kind === p.KINDS.CONTRAST);
  ok(contrast.length === pairLetters.size * HARAKAT.length
    && contrast.every((k) => pairLetters.has(k.letter)),
    `[${rung.id}] ولحروف أزواج مواجهتها حركاتُها (${pairLetters.size} حرفاً ⇒ ${contrast.length} مفتاحاً)`);
}

// ————— ٣) لا تُفتح محطةٌ لم تُمَسّ — حكمُ المدير أ (الجلسة ل٢) —————
//
// **العلّةُ التي يحرسها هذا الباب**: العيّنةُ خلطٌ من حوضٍ فيه عشراتُ مفاتيح الحروف،
// فلو تُركت مفاتيحُ درسِ العلامة فيه لظهرت نادراً — **فيُفتح درسُ المدّ بامتحانٍ لم
// يذكره**. وهو عينُ الخيانة التي رُدّ بها حكمُ ل١: فتحُ ما لم يُمتحَن فيه. فالمحروسُ
// أن تُمَسّ كلُّ محطةٍ **في كل محاولة** لا في متوسّطها.

console.log('\n٣. كلُّ محطةٍ في الشريحة تُمتحَن في كل محاولة');

const SEEDS = 24;
for (let i = 0; i < list.length; i++) {
  const rung = list[i];
  const marks = rung.nodes.filter((n) => n.type === 'skill');
  const stations = rung.nodes.filter((n) => n.type === 'contrast');
  if (!marks.length && !stations.length) continue;

  let missedMark = null;
  let thinContrast = null;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const items = pl.rungItems(i, rng(seed * 17 + i));
    for (const node of marks) {
      const kinds = new Set(items.filter((it) => it.letter === markSkillKey(node.skill.id))
        .map((it) => it.kind));
      if (kinds.size < pl.PER_STATION) missedMark ??= `${node.skill.id} (${kinds.size})`;
    }
    // **والمقيسُ حروفٌ متمايزة لا أزواج**: التمرينُ يحمل حرفَه ولا يحمل زوجَه (المُنشئُ
    // يختار الزوجَ من الحروف)، والحرفُ قد يقع في زوجين — فالشاهدُ الصادق أن يُمتحَن
    // بحرفين مختلفين من حروف المحطة.
    for (const node of stations) {
      const own = new Set(node.contrast.pairs.flatMap((x) => x.letters));
      const letters = new Set(items
        .filter((it) => it.kind === p.KINDS.CONTRAST && own.has(it.letter)).map((it) => it.letter));
      const want = Math.min(pl.PER_STATION, own.size);
      if (letters.size < want) thinContrast ??= `${node.contrast.id} (${letters.size} من ${want})`;
    }
  }
  ok(!missedMark,
    `[${rung.id}] درسُ العلامة يُمتحَن بنوعيه في كل محاولة${missedMark ? ' — سقط: ' + missedMark : ''}`
    + ` (${marks.length} درساً، ${SEEDS} محاولة)`);
  ok(!thinContrast,
    `[${rung.id}] ومحطةُ المواجهة بحرفين مختلفين من حروفها${thinContrast ? ' — نقص: ' + thinContrast : ''}`
    + ` (${stations.length} محطةً)`);
}

// وحصّةُ المحطات لا تبتلع مجموعةَ الشريحة: أكثرُ الشرائح محطاتٍ يبقى فيها للمجموعة
// نصفُ العيّنة على الأقل — فالحروفُ الجديدة أجدُّ ما يُمتحَن فيه.
const crowded = [];
for (let i = 0; i < list.length; i++) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const items = pl.rungItems(i, rng(seed * 23 + i));
    const groupItems = items.filter((it) =>
      [p.KINDS.QUIZ, p.KINDS.HARAKA, p.KINDS.BUILD].includes(it.kind));
    if (groupItems.length * 2 < pl.SAMPLE) crowded.push(`${list[i].id}/${seed}:${groupItems.length}`);
  }
}
ok(crowded.length === 0,
  `ولمجموعة الشريحة نصفُ العيّنة فأكثر في كل محاولة${crowded.length ? ' — ' + crowded.slice(0, 3).join('، ') : ''}`);

// ————— ٤) العيّنة: ثمانٍ بمُنشئات المراجعة، ومن حصيلة موضعها —————

console.log('\n٤. العيّنة ≤٨ بتمارين قائمة');

const cumulative = (index) => new Set(GROUPS.slice(0, index + 1).flatMap((g) => g.letters));
let sane = true;
let shapes = new Set();
const seen = new Set();
for (let i = 0; i < list.length; i++) {
  const known = cumulative(i);
  for (let seed = 1; seed <= 12; seed++) {
    const items = pl.rungItems(i, rng(seed * 31 + i));
    if (items.length !== pl.SAMPLE) sane = false;
    seen.add(items.map((x) => x.id).join('|'));
    for (const item of items) {
      shapes.add(item.kind);
      if (item.letter && !isLetterlessKey(item.letter) && !known.has(item.letter)) sane = false;
      if (!itemTexts(item).length && item.kind !== p.KINDS.BUILD) sane = false;
    }
  }
}
ok(pl.SAMPLE === 8, `عيّنةُ الدرجة ثمانيةُ تمارين (${pl.SAMPLE} — نصُّ التكليف: ≤٨)`);
ok(pl.PER_STATION === 2 && pl.PER_STATION * 2 <= pl.SAMPLE,
  `وحصّةُ كل محطةٍ سوى المجموعة مفتاحان (${pl.PER_STATION}) — دون نصف العيّنة`);
ok(sane, 'وكلُّ تمرينٍ من حصيلة موضعه: لا حرفَ لم يبلغه، ولكلٍّ نصٌّ يُنطق');
ok(seen.size > 10, `وتتجدّد كلَّ محاولة (${seen.size} تشكيلةً — لا نمطَ يُستظهَر)`);

// **صفرُ شكلِ تمرينٍ جديد**: كلُّ ما تُنتجه من أنواع `KINDS` القائمة، ومن مُنشئات
// المراجعة نفسِها — يُقرأ من الشيفرة نصّاً، فمن نسخ مُنشئاً هنا احمرَّ يومَ يفعل.
const placementSrc = src('placement.js');
ok([...shapes].every((k) => Object.values(p.KINDS).includes(k)),
  `وأنواعُها من KINDS القائمة (${[...shapes].sort().join('، ')})`);
ok(/from '\.\/review\.js'/.test(placementSrc)
  && /buildSession\(/.test(placementSrc) && /renderSession\(/.test(placementSrc),
  'وتُبنى بـ`buildSession` وتُعرض بـ`renderSession` — لا محرّكَ ثانياً');
ok(!/options:\s*\[/.test(placementSrc) && !/board:\s*/.test(placementSrc),
  'ولا تصنع تمريناً بيدها (لا `options` ولا `board` في الملف)');

// ————— ٥) العتبةُ عتبةُ البوابة نفسُها، والوقوفُ عند الشرخ —————

console.log('\n٥. عتبةُ الثمانين والوقوفُ عند الشرخ');

ok(/from '\.\/gate\.js'/.test(placementSrc) && /\bpassed\(/.test(placementSrc),
  'الحكمُ بـ`passed` من `gate.js` — عتبةٌ واحدة لا اثنتان تفترقان');
ok(gate.PASS_RATE === 0.8, `والعتبةُ ٨٠٪ (${gate.PASS_RATE * 100})`);
ok(gate.passed(5, 1) && gate.passed(6, 0) && !gate.passed(4, 2) && !gate.passed(0, 0),
  'خمسٌ من ستّ ⇒ عبور، وأربعٌ ⇒ لا عبور، وجلسةٌ فارغة لا تفتح شيئاً');
ok(gate.passed(7, 1) && !gate.passed(6, 2),
  'وعلى عيّنة الثماني: سبعٌ ⇒ عبور، وستٌّ ⇒ لا عبور');
ok(/أولُ إخفاقٍ يُنهي|أوّلُ إخفاقٍ يُنهي/.test(placementSrc) && !/again\(\)/.test(
  placementSrc.slice(placementSrc.indexOf('if (!open)'), placementSrc.indexOf('const more'))),
  'وشاشةُ الإخفاق بلا زرِّ إعادةٍ — أوّلُ إخفاقٍ يُنهي (والإعادةُ من اللوحة)');

// ————— ٦) حدُّ البوّابة والقرآنية — **مُمتحَنٌ بأقسامٍ مصنوعة** —————
//
// الحدّان صامتان في رحلة اليوم (لا بوّابةَ بين المجموعتين)، فلو امتُحنا بها وحدَها
// لمرّا ولو كانا فاسدَين. فتُحقَن `rungsOf` بأقسامٍ مصنوعة يقع فيها ما لا يقع اليوم.

console.log('\n٦. البواباتُ لا تُقفز، والقرآنيةُ خارج السلّم');

const fake = (kind, id, nodes = []) =>
  ({ kind, id, nodes, group: { id, title: id, letters: [], words: [] } });
const ids = (out) => out.map((r) => r.id).join('،');
const never = () => false;
const always = () => true;

const withGate = [fake('group', 'a'), fake('gate', 'gate:x'), fake('group', 'b')];
ok(ids(pl.rungsOf(withGate, never)) === 'a',
  'بوّابةٌ لم تُجتز تقصُر السلّمَ عندها — «البواباتُ لا تُقفز، تُجتاز بنفسها»');
ok(ids(pl.rungsOf(withGate, always)) === 'a،b',
  'وإن اجتازها بنفسه مضى السلّمُ إلى ما بعدها');
// والمجتازةُ **تُتخطّى ولا تُضمّ**: لو دخلت شريحةَ ما قبلها لفُتحت عقدتُها بامتحانٍ
// ليس امتحانَها — وهي تُجتاز بنفسها لا بشريحةٍ حولها.
ok(pl.rungsOf(withGate, always).every((r) => !r.sections.some((s) => s.kind === 'gate')),
  'ولا تدخل بوّابةٌ مجتازةٌ شريحةً — تُتخطّى ولا تُضمّ');

ok(ids(pl.rungsOf([fake('group', 'a'), fake('quran', 'quran:prep'), fake('group', 'b')], always)) === 'a',
  'والمرحلةُ القرآنية تقطع السلّمَ كلياً — المصحفُ يُتلى لا يُمتحَن');

// **والشريحةُ تضمّ ما بين المجموعتين** (حكمُ المدير أ): محطاتُ العلامة والمواجهة
// والقصة تلحق بشريحةِ مجموعتها لا بالتالية ولا تُترَك خارجَ السلّم.
const between = [
  fake('group', 'a', [{ id: 'a:1', type: 'letter' }]),
  fake('interlude', 'after:a', [{ id: 'skill:x', type: 'skill' }, { id: 'story:y', type: 'story' }]),
  fake('contrast', 'contrast:c', [{ id: 'contrast:c', type: 'contrast' }]),
  fake('group', 'b', [{ id: 'b:1', type: 'letter' }]),
];
const sliced = pl.rungsOf(between, always);
ok(ids(sliced) === 'a،b', 'وما بينهما من مهارةٍ وقصةٍ ومواجهةٍ لا يقطع السلّمَ ولا يزيد درجةً');
ok(sliced[0].sections.map((s) => s.id).join('،') === 'a،after:a،contrast:c'
  && sliced[1].sections.map((s) => s.id).join('،') === 'b',
  `بل يدخل شريحةَ مجموعته قبله (${sliced[0].sections.map((s) => s.id).join(' + ')})`);
ok(sliced[0].nodes.map((n) => n.id).join('،') === 'a:1،skill:x،story:y،contrast:c',
  'وعقدُها عقدُ أقسامها بترتيبها — فيُمتحَن فيها كلُّها ثم تُفتح كلُّها');

// وحدُّ الفتح نفسُه: عقدةُ بوّابةٍ أو قرآنيةٍ لا تُعلَّم منجزةً بحال
const mixed = {
  kind: 'group',
  nodes: [{ id: 'g1:ا', type: 'letter' }, { id: 'g1:words', type: 'words' },
    { id: 'gate:x', type: 'gate' }, { id: 'quran:s1', type: 'quran' },
    { id: 'prophet:p1', type: 'prophet' }],
};
ok(pl.openableNodes(mixed).join('،') === 'g1:ا،g1:words',
  `والفتحُ يستثني البوّابةَ والقرآنيةَ وقصتَها (${pl.openableNodes(mixed).join('،')})`);
ok(pl.rungs().every((r) => pl.openableNodes(r).length === r.nodes.length),
  'وشرائحُ اليوم ليس فيها من هذه الأنواع شيء — فلا شيءَ يُستثنى منها فعلاً');
// **والفتحُ يبلغ آخرَ الشريحة**: درسُ العلامة والقصةُ فيها يُفتحان معها، وهو عينُ ما
// رُدّ به حكمُ ل١ (كان يقف عند عقد المجموعة فيقف الطفلُ عند درسِ مدٍّ لا عند شرخه).
const withMark = pl.rungs().find((r) => r.nodes.some((n) => n.type === 'skill'));
ok(withMark && pl.openableNodes(withMark).some((id) => id.startsWith('skill:')),
  `وما يُفتَح يبلغ درسَ علامتها (${pl.openableNodes(withMark || { nodes: [] }).join('، ')})`);

// ولا عقدةَ قرآنيةٍ ولا بوّابةٍ في السلّم أصلاً (الحدُّ الأول قبل الثاني)
const forbidden = pl.rungs().flatMap((r) => r.nodes)
  .filter((n) => ['gate', 'quran', 'prophet'].includes(n.type));
ok(forbidden.length === 0, `ولا عقدةَ من هذه الأنواع في السلّم (${forbidden.length})`);

// ————— ٧) الفتحُ والكتابة: نجمةٌ واحدة، وسجلٌّ يقرؤه وليُّ الأمر —————

console.log('\n٧. الفتحُ بمصدرٍ مميَّز');

p.reset();
store.clear();
const g1 = pl.rungs()[0];
const opened = p.recordPlacement({
  groups: [g1.id], nodes: pl.openableNodes(g1), stopped: pl.rungs()[1].id, right: 6, tries: 6,
});
ok(opened === g1.nodes.length, `اجتيازُ المجموعة الأولى يفتح عقدَها (${opened})`);
ok(g1.nodes.every((n) => p.getStars(n.id) === p.PLACEMENT_STARS),
  'بنجمةٍ واحدة — تفكّ القفل ولا تدّعي إتقاناً (حكمُ `unlockUpTo` والترحيلِ الرحيم)');
ok(p.placementLog().groups.join('،') === g1.id
  && p.placementLog().nodes.length === g1.nodes.length,
  'وسجلُّه يسمّي المجموعةَ وعقدَها — «فُتح باللحاق» بمصدرٍ مميَّز');

// **الوقوفُ عند الشرخ**: ما بعد الدرجة المُخفَقة لا يُفتح منه شيء
const beyond = pl.rungs().slice(1).flatMap((s) => s.nodes);
ok(beyond.every((n) => !p.isDone(n.id)),
  `وما بعد الشرخ لم يُفتح منه شيء (${beyond.length} عقدةً على حالها)`);
ok(p.nextNode() && p.allNodes().indexOf(p.nextNode()) === g1.nodes.length,
  `و«تابع من هنا» يقف عند أوّل ما لم يُثبته (${p.nextNode()?.id})`);

// **لا قفلَ رجوعاً**: نجمةٌ مكسوبةٌ لا تُنقَص، ومفتوحٌ لا يُغلَق
p.setStars('g1:ا', 3);
p.recordPlacement({ groups: [g1.id], nodes: pl.openableNodes(g1) });
ok(p.getStars('g1:ا') === 3, 'وإعادةُ الامتحان لا تُنقص نجمةً كسبها بلعبه');
ok(p.placementLog().groups.length === 1,
  'وسجلُّه يتّحد مع سابقه لا يحلّ محلّه (لا مجموعةَ تُنسى)');
ok(p.recordPlacement({ nodes: ['لا-وجود-لها'] }) === 0
  && !p.snapshot().stars['لا-وجود-لها'],
  'ولا يُعلَّم معرّفٌ لا موضعَ له في الرحلة');

// **الاستئنافُ من آخر حدّ**: الدرجةُ التالية لا الأولى
ok(pl.startRung() === 1, `والإعادةُ تستأنف من الدرجة التالية (${pl.startRung()})`);
p.reset();
ok(pl.startRung() === 0 && p.placementLog() === null,
  'وطفلٌ جديد يبدأ من أولها بلا سجلّ');

// ————— ٨) ليتنر: كلُّ محاولةٍ قياسٌ حقيقيّ بلا وسمٍ خاصّ —————

console.log('\n٨. ليتنر يقرأ محاولاته كسائرها');

ok(!/recordAttempt/.test(placementSrc.replace(/\/\/[^\n]*/g, '')),
  'الامتحانُ لا يكتب في ليتنر بيده — `renderSession` تكتب كلَّ محاولةٍ كما تكتبها المراجعة');
const reviewSrc = src('review.js');
ok(/progress\.recordAttempt\(letter, haraka, item\.kind, correct\)/.test(reviewSrc),
  'والمحرّكُ يكتب بنوع التمرين نفسِه — لا وسمَ «لحاق» ولا استثناء');
ok(!/markReview\(/.test(placementSrc),
  'ولا يُقيَّد مراجعةَ يوم: امتحانُ موضعٍ لا جلسةُ تثبيت — فلا يقول للوالد «راجَع» ولم يراجع');

// وقواعدُ الخفوت بحالها: الوحدةُ لا تعرف `fade.js` أصلاً (حصانةٌ بنيوية)
ok(!/fade\.js/.test(placementSrc), 'وقواعدُ الخفوت بحالها — الوحدةُ لا تعرف `fade.js`');

// ————— ٩) الصوت: صفرُ إضافة (تمارينٌ لها ملفاتُها) —————

console.log('\n٩. صفرُ إضافةٍ صوتية');

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
const spoken = new Set();
for (let i = 0; i < pl.rungs().length; i++) {
  for (let seed = 1; seed <= 12; seed++) {
    for (const item of pl.rungItems(i, rng(seed * 7 + i))) for (const t of itemTexts(item)) spoken.add(t);
  }
}
const orphan = [...spoken].filter((t) => !have.has(t) && !pending.has(t));
ok(orphan.length === 0,
  `كلُّ ما ينطقه الامتحان له ملفٌّ مولَّد (${spoken.size} نصاً)`
  + (orphan.length ? ` — بلا ملفّ: ${orphan.slice(0, 5).join('، ')}` : ''));

// ————— ١٠) البابُ واحد: لوحةُ وليّ الأمر لا شاشةُ طفل —————

console.log('\n١٠. بابُه لوحةُ وليّ الأمر وحدَها');

const parentSrc = src('parent.js');
ok(/placementSection/.test(parentSrc) && /امتحان اللحاق/.test(parentSrc),
  'قسمُ «امتحان اللحاق» في اللوحة');
ok(/فُتح باللحاق/.test(parentSrc), 'وسجلُّ آخر نتيجةٍ يُقرأ فيها «فُتح باللحاق»');
ok(/placement\.renderPlacement\(/.test(parentSrc) && /examining/.test(parentSrc),
  'والامتحانُ يحلّ محلّ اللوحة خلف بوابتها — لا مسارَ ثانياً يبلغه طفل');
ok(!/https:\/\//.test(parentSrc), 'واللوحةُ تبقى صفرَ عناوينَ خارجية');
ok(!src('main.js').includes('placement'),
  'ولا بابَ له في التوجيه — فلا يفتحه طفلٌ بعنوانٍ يكتبه');

const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
// **رقمُ القشرة مكتوبٌ بيدٍ هنا** فيلزم تحريكُه مع كل حزمةٍ ترفعه (v32 ← v33 في
// الجلسة د١ — وضعُ الدعم): والمحروسُ أنّ `placement.js` في القشرة فيعمل دون إنترنت،
// والرقمُ شاهدُ أنّها قشرةٌ حيّةٌ مرفوعة. وشكلُ الحارس ملكُ صاحبه فلم يُمَسّ.
ok(/'js\/placement\.js'/.test(sw) && /const VERSION = 'v33'/.test(sw),
  'وهو في قشرة v33 فيعمل دون إنترنت');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «بوابة اللحاق» ناجحة');
process.exit(fails ? 1 : 0);
