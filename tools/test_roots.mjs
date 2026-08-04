// اختبار «شبكات الجذور» بلا متصفّح:
//   node tools/test_roots.mjs
// المحروس هنا سبعة: بنية `ROOTS` وقيودها (عائلةُ معنى مُعلَنة لا مطابقةَ حروف)،
// وموضعُ كل شجرةٍ **محسوباً** عند ثالث عضوٍ مدروس، و**ألّا يظهر غيرُ المدروس أصلاً**،
// وسلامةُ جولات «اجمع العائلة» ومشتّتِ «الحروف بلا المعنى»، و**حصانةُ حوض الخيارات
// من الخفوت بنيوياً**، ودخولُ القياس ليتنر بتمرينٍ يراجعه، والترحيلُ الرحيم.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { ROOTS, rootById, rootOfWord, rootTexts } = await import(new URL('curriculum.js', APP));
const { branchesOf, buildRootRounds, rootScreenTexts, skillKeyOf, nodeIdOf, MIN_BRANCHES, OPTIONS } =
  await import(new URL('roots.js', APP));
const { buildSession, itemTexts } = await import(new URL('review.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ————— ١. البنية: عائلةُ معنى مُعلَنة —————

console.log('\n— بنية العائلات —');
ok(ROOTS.length >= 13, `${ROOTS.length} عائلة معلَنة`);
ok(ROOTS.every((r) => r.id && r.root && r.title && r.sense),
  'لكل عائلة معرّفها وحروفُ جذرها واسمُها **وسطرُ معناها الجامع**');
ok(ROOTS.every((r) => r.members.length >= MIN_BRANCHES),
  `ولا عائلةَ دون ${MIN_BRANCHES} أعضاء (${ROOTS.map((r) => r.members.length).join('،')})`);
ok(new Set(ROOTS.map((r) => r.id)).size === ROOTS.length, 'ولا معرّف مكرَّر');

const all = ROOTS.flatMap((r) => r.members);
ok(new Set(all).size === all.length, `ولا كلمةَ في عائلتين (${all.length} عضواً)`);

// **الأعضاء معلَنون لا مشتقّون**: لو كان الاشتقاق بالحروف لدخلت «رُكْبَة» في «الرُّكوب»
const strangers = ROOTS.filter((r) => r.stranger);
ok(strangers.length >= 2, `ولعائلتين مشتّتُ «الحروف بلا المعنى» (${strangers.map((r) => r.stranger).join('، ')})`);
ok(strangers.every((r) => !r.members.includes(r.stranger)),
  'والمشتّتُ ليس عضواً أبداً — هو عينُ ما أسقطته قاعدة المعنى');

// سطرُ المعنى بنصّه المُقَرّ في ورقة المراجعة حرفاً
const sheet = readFileSync(new URL('../docs/REVIEW_B2.md', import.meta.url), 'utf8');
const offSheet = ROOTS.filter((r) => !sheet.includes(r.sense));
ok(offSheet.length === 0,
  'وكلُّ سطر معنىً منقولٌ من `REVIEW_B2.md` حرفاً (لا يُعاد تحريره هنا)'
  + (offSheet.length ? ` — خارجها: ${offSheet.map((r) => r.id).join('، ')}` : ''));

// ————— ٢. الموضع محسوبٌ لا مكتوب —————

console.log('\n— موضع الشجرة من الرحلة —');
const sections = p.journey();
const rootSections = sections.filter((s) => s.kind === 'roots');
ok(rootSections.length === ROOTS.length,
  `${rootSections.length} شجرةً دخلت الرحلة من ${ROOTS.length}`);

const nodes = p.allNodes();
const indexOf = (id) => nodes.findIndex((n) => n.id === id);

// كلُّ شجرةٍ بعد العقدة التي يكتمل بها ثالثُ عضوٍ مدروس — لا قبلها
const deliver = new Map();
nodes.forEach((node, i) => {
  if (node.type === 'garden') for (const w of node.bundle.words) if (!deliver.has(w.word)) deliver.set(w.word, i);
  else if (node.type === 'group') {
    for (const w of node.group.words || []) {
      const text = (w.tiles || []).join('');
      if (text && !deliver.has(text)) deliver.set(text, i);
    }
  } else if (node.type === 'quran' && node.item?.read && !deliver.has(node.item.read)) {
    deliver.set(node.item.read, i);
  }
});
const early = [];
for (const root of ROOTS) {
  const at = indexOf(nodeIdOf(root.id));
  if (at < 0) continue;
  const places = root.members.map((m) => deliver.get(m)).filter((x) => x !== undefined).sort((a, b) => a - b);
  if (places.length < 3 || places[2] > at) early.push(root.id);
}
ok(early.length === 0,
  'ولا شجرةَ تسبق ثالثَ أعضائها المدروسة (الموضع محسوب لا مكتوب)'
  + (early.length ? ` — سابقة: ${early.join('، ')}` : ''));

// ————— ٣. لا يُعرَض غير المدروس أصلاً —————

console.log('\n— الشجرة لا تعرض غير المدروس —');
const katb = rootById('katb');
ok(branchesOf(katb, []).length === 0, 'طفلٌ لم يدرس شيئاً: شجرةٌ بلا أغصان (لا قفلٌ مرئيّ)');
ok(branchesOf(katb, [katb.members[0], katb.members[1]]).length === 2,
  'ودرس عضوين ⇒ غصنان فقط — والثالثُ لا يظهر أصلاً');
ok(branchesOf(katb, katb.members).length === katb.members.length,
  'ودرسها كلَّها ⇒ الشجرةُ تامّة');
ok(branchesOf(katb, [...katb.members, 'رُكْبَةْ', 'خُبْزْ']).every((b) => katb.members.includes(b)),
  'ولا يتسلّل إلى الأغصان ما ليس عضواً وإن درسه');

// ————— ٤. «اجمع العائلة» ومشتّتُ المعنى —————

console.log('\n— جولات اجمع العائلة —');
const rukub = rootById('rukub');
const outsiders = ['خُبْزْ', 'قَمَرْ', 'بَابْ', 'رُكْبَةْ', 'نَجْمْ'];
const rounds = buildRootRounds(rukub, rukub.members, outsiders, rng(7));
ok(rounds.length > 0 && rounds.every((r) => r.options.length === OPTIONS),
  `${rounds.length} جولة، في كلٍّ ${OPTIONS} خيارات`);
ok(rounds.every((r) => rukub.members.includes(r.target)),
  'وهدفُ كل جولة عضوٌ من العائلة');
ok(rounds.every((r) => r.options.filter((o) => rukub.members.includes(o)).length === 1),
  'وفي الحوض عضوٌ واحد لا اثنان (فللسؤال جوابٌ واحد)');
ok(rounds.some((r) => r.options.includes(rukub.stranger)),
  `ومشتّتُ «الحروف بلا المعنى» «${rukub.stranger}» يدخل الحوض فعلاً`);
ok(buildRootRounds(rukub, rukub.members.slice(0, 2), outsiders, rng(3)).length === 0,
  'وتفشل مغلقةً: أقلُّ من ثلاثة أغصان ⇒ لا جولات');
// عائلةٌ بلا مشتّتٍ ذكيّ وحوضٌ فيه واحد: لا جولةَ ناقصة تُعرض
ok(buildRootRounds(katb, katb.members, ['خُبْزْ'], rng(3)).length === 0,
  'وحوضٌ لا يكفي مشتّتين ⇒ لا جولات (لا سؤالَ ناقص)');

// **حصانةُ الحوض بنيوية**: الملفّ لا يستورد ما يخفت أصلاً في الخيارات
const src = readFileSync(new URL('roots.js', APP), 'utf8');
// يُقاس على **الشيفرة لا التعليق**: تُنزَع الأسطر المشروحة أوّلاً، فما بقي نداءاتٌ
const gameBody = src.slice(src.indexOf('function gameStep'), src.indexOf('return steppedScreen'))
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
ok(!/textWord\s*\(|fadeWord\s*\(/.test(gameBody),
  'وحوضُ الخيارات لا يمرّ بـ`fadeWord` ولا `textWord` — ز١ دائماً بنيوياً');
ok(/fadeWord\(face, text, btn\)/.test(src), 'والأغصانُ وحدَها تخفت (بطاقةٌ كسائر البطاقات)');

// ————— ٥. القياس: ليتنر والمراجعة —————

console.log('\n— القياس —');
ok(p.KINDS.ROOT === 'root', 'نوعُ القياس `root`');
ok(skillKeyOf('katb') === 'root-katb', 'ومفتاحُه `root-<العائلة>` — لا حرفَ وهميّ');

store.clear();
p.recordAttempt(skillKeyOf('katb'), null, p.KINDS.ROOT, true);
p.recordAttempt(skillKeyOf('katb'), null, p.KINDS.ROOT, false);
const skill = p.skills().find((s) => s.kind === p.KINDS.ROOT);
ok(skill && skill.letter === 'root-katb', 'والمحاولةُ تُسجَّل في سجلّ المهارات');
ok(p.letterStats().every((s) => !String(s.letter).startsWith('root-')),
  'ولا تدخل لوحةَ الحروف (لا «حرف» اسمه root-katb في لوحة وليّ الأمر)');

const words = [...katb.members, 'خُبْزْ', 'قَمَرْ', 'بَابْ'].map((t) => ({ text: t }));
const session = buildSession({
  letters: ['ا', 'ب', 'م', 'ل', 'ك', 'ت'],
  words,
  due: [{ kind: p.KINDS.ROOT, letter: 'root-katb', haraka: 'none', box: 0, wrong: 1 }],
  rnd: rng(11),
});
const item = session.find((i) => i.kind === p.KINDS.ROOT);
ok(Boolean(item), 'وللمهارة تمرينُها في جلسة المراجعة (`rootItem`) — فلا مهارةَ بلا مراجعتها');
ok(item && item.options.includes(item.target) && item.options.length === 3,
  'وتمرينُ المراجعة بحوضٍ سليم');
ok(item && itemTexts(item).length > 0, 'ونصوصُه محسوبةٌ للتحميل المسبق ولفحص الصوت');

// ————— ٦. الصوت: الجديدُ أسطرُ المعاني وحدَها —————

console.log('\n— الصوت —');
const { memberSay: say } = await import(new URL('curriculum.js', APP));
const texts = new Set(ROOTS.flatMap((r) => rootTexts(r)));
const senses = new Set(ROOTS.map((r) => r.sense));
const members = new Set(all.map(say));      // بمفاتيح أصواتها لا بنصوصها المعروضة
ok([...texts].every((x) => senses.has(x) || members.has(x)),
  `كلُّ ما تنطقه الشجرة سطرُ معنىً أو مفتاحُ عضوٍ قائم (${texts.size} نصاً)`);
ok(rootScreenTexts(katb, branchesOf(katb, katb.members)).length === 1 + katb.members.length,
  'وشاشةُ الشجرة تنطق معناها وأغصانَها لا غير');

// **المعروضُ شيءٌ ومفتاحُ صوته شيء**: كلمةُ المجموعات تُعرَض مشكولةً ومفتاحُها مجرَّد،
// فلولا `memberSay` لطلبت الشجرةُ صوتاً لا وجودَ له وصمتت على الطفل.
const memberSay = say;
ok(memberSay('دَرَسْ') === 'درس', 'ومفتاحُ صوت كلمة المجموعات نصُّها المجرَّد («دَرَسْ» ← «درس»)');
ok(memberSay('مَكْتَبَةْ') === 'مَكْتَبَةْ', 'وكلمةُ المعجم مفتاحُها نصُّها نفسُه');
ok(rootScreenTexts(katb, katb.members).every((x) => typeof x === 'string' && x.length),
  'وكلُّ ما تنطقه الشجرة له مفتاحٌ مُصمَت');

// ————— ٧. الترحيل الرحيم —————

console.log('\n— الترحيل —');
async function loadWith(stars) {
  store.set('muallim.progress.v1', JSON.stringify({
    v: 2, stars, skills: {}, days: {}, reviews: {}, records: [], mic: false,
    seconds: 0, startedAt: 1, updatedAt: 1,
  }));
  return import(`${new URL('progress.js', APP).href}?t=${Math.random()}`);
}
// حالةُ طفلٍ قائمٍ قبل هذه الحزمة: رحلتُه كاملةٌ بلا أثرٍ لأيّ شجرة
const ids = nodes.map((n) => n.id);
// نجمُ كلَّ ما ليس شجرةً: فالطفل القائم بلغ آخرَ الرحلة قبل أن توجد الأشجار
const legacy = Object.fromEntries(ids.filter((id) => !id.startsWith('roots:')).map((id) => [id, 3]));
const past = await loadWith(legacy);
// الترحيلُ يخصّ ما وقع **خلف جبهته**: شجرةٌ أمامَه ليست حبساً، هي محطتُه التالية.
const frontier = ids.reduce((last, id, i) => (legacy[id] ? i : last), -1);
const behind = ROOTS.filter((r) => ids.indexOf(nodeIdOf(r.id)) < frontier);
const ahead = ROOTS.filter((r) => ids.indexOf(nodeIdOf(r.id)) > frontier);
ok(behind.length > 0 && behind.every((r) => past.getStars(nodeIdOf(r.id)) >= 1),
  `من جاوز موضعَ الشجرة قبل وجودها لا يُحبَس (${behind.length} شجرةً خلف جبهته)`);
ok(behind.every((r) => past.getStars(nodeIdOf(r.id)) < p.MAX_STARS),
  'ونجمتُه واحدةٌ لا ثلاث — تفكّ حبسَه وتبقى تدعوه إلى لعبها');
ok(ahead.every((r) => past.getStars(nodeIdOf(r.id)) === 0),
  `وما كان أمامَ جبهته يبقى محطةً يلعبها لا نجمةً تُهدى (${ahead.length} شجرة)`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات شبكات الجذور ناجحة');
process.exit(fails ? 1 : 0);
