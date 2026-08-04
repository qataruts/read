// اختبار حزمة «قياس العلامات» بلا متصفّح:
//   node tools/test_marks.mjs
//
// المحروس هنا ستّة:
//   ١) **المفتاح**: `mark-<الدرس>` — علامةٌ لا حرف، ومفتاحٌ لكل درسٍ لا لكل علامة
//      (المدُّ درسان متباعدان، ودمجُهما يكسر المفكوكية).
//   ٢) **جولات الدرس**: القراءة الصامتة (`buildMarkRounds`) وسلامةُ خياراتها.
//   ٣) **دخولُ ليتنر**: تُسجَّل بعقد ليتنر نفسِه، **ولا تدخل لوحةَ الحروف**.
//   ٤) **تمرينُ المراجعة**: لكل نوعٍ تمرينُه (`markItem`) — فلا مهارةَ بلا مراجعتها،
//      ودخولُها المراجعةَ اليومية والبوابتين بمادّة **درسها وحدَه** (المفكوكية بالبناء).
//   ٥) **صفُّ اللوحة**: `markStats` يجمع مفتاحَي الدرس في بطاقةٍ بأدنى الصندوقين.
//   ٦) **صفر إضافة صوتية**: كلُّ ما ينطقه التمرينان من أزواج الدرس القائمة.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  SKILLS, MARK_PREFIX, markLabel, markSkillKey, isMarkKey, skillByMarkKey, skillById, skillTexts,
} = await import(new URL('curriculum.js', APP));
const { buildMarkRounds } = await import(new URL('skill.js', APP));
const { buildSession, itemTexts } = await import(new URL('review.js', APP));
const { gateItems } = await import(new URL('gate.js', APP));
const { markStats } = await import(new URL('parent.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const src = (name) => readFileSync(new URL(name, APP), 'utf8');

// ————— ١. المفتاح: علامةٌ لا حرف، ودرسٌ لا علامة —————

console.log('\n— مفتاح قياس العلامة —');
ok(markSkillKey('shadda') === 'mark-shadda', 'المفتاح `mark-<الدرس>` — لا حرفَ وهميّ');
ok(isMarkKey(markSkillKey('lam')) && !isMarkKey('ب') && !isMarkKey('root-katb'),
  'ويُميَّز بسابقته عن الحرف وعن مفتاح العائلة');
ok(skillByMarkKey(markSkillKey('tanween'))?.id === 'tanween'
  && skillByMarkKey('ب') === null && skillByMarkKey('mark-nope') === null,
  'ويعود منه درسُه — ومفتاحُ درسٍ ساقطٍ لا يعود بشيء');

const keys = SKILLS.map((s) => markSkillKey(s.id));
ok(new Set(keys).size === SKILLS.length && SKILLS.length === 6,
  `${SKILLS.length} دروسٍ لكلٍّ مفتاحُه (${keys.join('، ')})`);
// **المفتاح لكل درسٍ لا لكل علامة**: درسا المدّ متباعدان بمجموعتين
const madd = SKILLS.filter((s) => s.id.startsWith('madd'));
ok(madd.length === 2 && madd[0].after !== madd[1].after
  && markSkillKey(madd[0].id) !== markSkillKey(madd[1].id),
  `ودرسا المدّ مفتاحان لا واحد (بعد ${madd.map((s) => s.after).join(' و')}) — فلا تُسأل`
  + ' المراجعةُ عن مدّ الواو من لم يبلغ درسه');

console.log('\n— وسمُ طرفَي المقارنة —');
ok(markLabel('ممدود') === 'ممدود' && markLabel('قمرية: تُنطق اللام') === 'قمرية',
  'ما بعد النقطتين شرحُ عرضٍ لا اسمٌ يُسأل به («قمرية: تُنطق اللام» ← «قمرية»)');
ok(SKILLS.every((s) => s.compare.labels.every((l) => markLabel(l).length > 0)),
  'ولكل درسٍ وسمان صالحان لطرفيه');

// ————— ٢. جولات «انظر واختر»: القراءة الصامتة —————

console.log('\n— جولات القراءة الصامتة —');
for (const skill of SKILLS) {
  const rounds = buildMarkRounds(skill, rng(5));
  const good = rounds.length > 0
    && rounds.every((r) => r.options.length === 2
      && r.options.includes(r.target)
      && skill.compare.pairs.some((pair) => pair.every((t) => r.options.includes(t)))
      && r.label && !r.label.includes(':'));
  ok(good, `[${skill.id}] ${rounds.length} جولاتٍ، خياراها طرفا زوجٍ واحد وفيهما الهدف`);
}
const sides = buildMarkRounds(SKILLS[0], rng(9));
ok(new Set(sides.map((r) => r.label)).size === 2,
  'ويُسأل عن الطرفين كليهما — فمعرفةُ الخالي من العلامة معرفةٌ بها');
ok(buildMarkRounds({ compare: { pairs: [], labels: ['أ', 'ب'] } }).length === 0
  && buildMarkRounds({}).length === 0,
  'وتفشل مغلقةً: درسٌ بلا أزواج ⇒ لا جولات (ولا قياسَ يُدَّعى)');

// ————— ٣. القياس يدخل ليتنر ولا يدخل لوحة الحروف —————

console.log('\n— دخول ليتنر —');
ok(p.KINDS.MARK_COMPARE === 'mark-compare' && p.KINDS.MARK_QUIZ === 'mark-quiz',
  'نوعا القياس `mark-compare` (قراءةً) و`mark-quiz` (سماعاً)');

store.clear();
p.reset();
p.recordAttempt(markSkillKey('shadda'), null, p.KINDS.MARK_COMPARE, true);
p.recordAttempt(markSkillKey('shadda'), null, p.KINDS.MARK_QUIZ, false);
const written = p.skills().filter((s) => p.isMarkSkill(s));
ok(written.length === 2, 'المحاولتان تُسجَّلان مهارتين مستقلّتين (قراءةً وسماعاً)');
ok(written.every((s) => s.letter === 'mark-shadda' && s.haraka === 'none'),
  'ومفتاحُهما `mark-shadda` بلا حركة');
ok(written.find((s) => s.kind === p.KINDS.MARK_COMPARE).box === 1
  && written.find((s) => s.kind === p.KINDS.MARK_QUIZ).box === 0,
  'وبعقد ليتنر نفسِه: الصوابُ يرفع الصندوق والخطأ يعيده إلى الصفر');
ok(p.dueSkills().some((s) => p.isMarkSkill(s)), 'وتدخل المستحقَّ للمراجعة اليوم');
ok(p.weakestSkills()[0] && p.isMarkSkill(p.weakestSkills()[0]),
  'وأضعفُها يتصدّر مادّةَ البوابة (`weakestSkills`)');

ok(p.letterStats().every((s) => !String(s.letter).startsWith(MARK_PREFIX)),
  'ولا تدخل لوحةَ الحروف — لا «حرف» اسمه mark-shadda في لوحة وليّ الأمر');
ok(p.letterStats().length === 0, 'ولا حرفَ وهميّ البتّة (سجلٌّ فيه علاماتٌ وحدها ⇒ لوحةُ حروفٍ فارغة)');
ok(!p.isLetterSkill(written[0]) && p.isLetterSkill({ kind: p.KINDS.QUIZ }),
  'و«وحدتُها حرفٌ × حركة» تُنكَر عليها وتُثبَت لغيرها');

// ————— ٤. لكل نوعٍ تمرينُه في المراجعة والبوابة —————

console.log('\n— تمرين المراجعة (لا مهارةَ بلا مراجعتها) —');
const shadda = skillById('shadda');
const asDue = (kind) => ({ kind, letter: markSkillKey('shadda'), haraka: 'none', box: 0, wrong: 1 });

for (const kind of [p.KINDS.MARK_COMPARE, p.KINDS.MARK_QUIZ]) {
  const session = buildSession({
    letters: ['ا', 'ب', 'م', 'ل'], marks: [shadda], due: [asDue(kind)], rnd: rng(3),
  });
  const item = session.find((i) => i.kind === kind);
  ok(Boolean(item), `[${kind}] للمهارة تمرينُها في الجلسة`);
  ok(item && item.options.includes(item.target) && item.options.length >= 2,
    `[${kind}] وحوضُه سليم (الهدف فيه)`);
  ok(item && item.letter === markSkillKey('shadda') && item.haraka === null,
    `[${kind}] ويُسجَّل بمفتاح العلامة لا بحرف`);
  const pool = shadda.compare.pairs.flat();
  ok(item && item.options.every((t) => pool.includes(t)),
    `[${kind}] ومادّتُه أزواجُ درسه وحدَه — المفكوكية بالبناء`);
}

// **المفكوكية**: درسٌ لم يبلغه الطفل لا يُبنى منه تمرين وإن كان في سجلّه
const unstudied = buildSession({
  letters: ['ا', 'ب', 'م', 'ل'], marks: [], due: [asDue(p.KINDS.MARK_QUIZ)], rnd: rng(3),
});
ok(!unstudied.some((i) => p.isMarkSkill(i)),
  'ودرسٌ لم يُتمّه الطفل لا تُبنى منه جولةٌ أبداً (حصيلةٌ لا نيّة)');

// التنويع: العلاماتُ تدخل جلسةً ليس فيها مستحقٌّ أصلاً
const fillerSession = buildSession({
  letters: ['ا', 'ب', 'م', 'ل'], marks: SKILLS, due: [], size: 6, rnd: rng(17),
});
ok(fillerSession.some((i) => p.isMarkSkill(i)),
  'وتدخل تنويعَ الجلسة حين لا مستحقَّ (لا تنتظر خطأً لتُرى)');

// البوابة: مادّتُها أضعفُ ما في يده — والعلامةُ منها
store.clear();
p.reset();
for (const node of ['g1:ا', 'g1:ب', 'g1:م', 'g1:ل', 'g1:words', 'skill:madd-alif']) {
  p.setStars(node, 3);
}
p.recordAttempt(markSkillKey('madd-alif'), null, p.KINDS.MARK_COMPARE, false);
ok(p.studiedMarks().some((s) => s.id === 'madd-alif'),
  'ومَن أتمّ درسَ علامةٍ دخل درسُه حصيلتَه (`studiedMarks`)');
ok(gateItems(rng(23)).some((i) => p.isMarkSkill(i)),
  'وتظهر العلامةُ في تمارين البوابة (مادّتُها أضعفُ ما في يده)');

// ————— ٥. صفُّ «العلامات» في لوحة وليّ الأمر —————

console.log('\n— صفّ اللوحة —');
const stats = markStats([
  { letter: 'mark-shadda', kind: p.KINDS.MARK_COMPARE, right: 4, wrong: 0, box: 4 },
  { letter: 'mark-shadda', kind: p.KINDS.MARK_QUIZ, right: 1, wrong: 2, box: 1 },
  { letter: 'mark-lam', kind: p.KINDS.MARK_QUIZ, right: 3, wrong: 0, box: 3 },
  { letter: 'ب', kind: p.KINDS.QUIZ, right: 9, wrong: 0, box: 5 },
  { letter: 'root-katb', kind: p.KINDS.ROOT, right: 2, wrong: 0, box: 2 },
]);
ok(stats.length === 2, 'المفتاحان يُجمعان في بطاقةٍ واحدة للدرس (لا بطاقتان لعلامةٍ واحدة)');
ok(stats[0].title === skillById('shadda').title && stats[0].right === 5 && stats[0].wrong === 2,
  'وتحمل اسمَ الدرس ومجموعَ محاولاته');
ok(stats[0].box === 1,
  '**وأدنى الصندوقين**: من أتقن السماع وحده لم يتقن العلامة (٤ و١ ⇒ ١)');
ok(stats.every((s) => !String(s.title).startsWith('mark-')),
  'ولا يقرأ وليُّ الأمر مفتاحاً خاماً — «الشَّدّة» لا «mark-shadda»');
ok(SKILLS.map((s) => s.id).indexOf(stats[0].id) < SKILLS.map((s) => s.id).indexOf(stats[1].id),
  'وترتيبُها ترتيبُ المنهج');
ok(markStats([{ letter: 'mark-ghost', kind: p.KINDS.MARK_QUIZ, right: 1, wrong: 0, box: 1 }]).length === 0,
  'ودرسٌ سقط من المنهج لا يترك بطاقةً وهمية في اللوحة');

// ————— ٦. صفر إضافة صوتية —————

console.log('\n— صفر إضافة صوتية —');
const spoken = new Set(SKILLS.flatMap(skillTexts));
const missing = [];
for (const skill of SKILLS) {
  for (const kind of [p.KINDS.MARK_COMPARE, p.KINDS.MARK_QUIZ]) {
    const session = buildSession({
      letters: ['ا', 'ب', 'م', 'ل'], marks: [skill],
      due: [{ kind, letter: markSkillKey(skill.id), haraka: 'none', box: 0, wrong: 1 }],
      rnd: rng(31),
    });
    const item = session.find((i) => i.kind === kind);
    if (!item) { missing.push(`${skill.id}/${kind}`); continue; }
    for (const text of itemTexts(item)) if (!spoken.has(text)) missing.push(text);
  }
}
ok(missing.length === 0,
  `كلُّ ما ينطقه تمرينا العلامة نصٌّ ينطقه درسُها أصلاً (${spoken.size} نصاً) — صفرُ إضافة`
  + (missing.length ? ` — خارجها: ${missing.slice(0, 4).join('، ')}` : ''));

// نصُّ السؤال نصُّ واجهةٍ معروض لا منطوق: لا يمرّ بـ`audio.play` في الشاشتين
const skillSrc = src('skill.js');
const reviewSrc = src('review.js');
ok(!/audio\.play\(\s*`?أيُّهما/.test(skillSrc) && !/audio\.play\(\s*`?أيُّهما/.test(reviewSrc)
  && !/audio\.play\((r|item)\.label\)/.test(skillSrc + reviewSrc),
  'ووسمُ السؤال («أيُّهما ممدود؟») نصُّ واجهةٍ معروض لا يُنطق');

// **لا صوتَ قبل الاختيار** في تمرين القراءة: المقيسُ القراءةُ لا السماع
const compareBody = skillSrc.slice(skillSrc.indexOf('function readPart'),
  skillSrc.indexOf('paintPart(listenPart())'))
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
ok(!/setTimeout\(\s*play/.test(compareBody) && !/startRound\(\)[\s\S]{0,80}audio\.play/.test(compareBody),
  'ولا صوتَ يُشغَّل قبل الاختيار في جولة القراءة (القراءة هي المقيسة)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «قياس العلامات» ناجحة');
process.exit(fails ? 1 : 0);
