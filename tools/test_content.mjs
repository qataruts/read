// اختبار محتوى الجلسة ٤ (المهارات والقصص) وموضعه من الرحلة — بلا متصفّح.
//   node tools/test_content.mjs
// المحروس هنا: ترتيب §٥، وقفل العقد الجديدة، وسلامة جولات التمييز،
// وأن كل نصّ منطوق له ملف مولَّد أو مكان في قائمة الانتظار الصوتية.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GROUPS, SKILLS, STORIES, GATES, CONTRASTS, quranParts, skillById, storyById, skillExamples,
  storyAsk,
  skillTexts, storyTexts, sentenceText, bareLetters,
} = await import(new URL('curriculum.js', APP));
const { buildSkillRounds } = await import(new URL('skill.js', APP));
const { starsForStory, starsForTale } = await import(new URL('story.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ————— ١. الترتيب والمواضع (METHOD §٥) —————

ok(SKILLS.map((s) => s.id).join('،') === 'madd-alif،sukun،madd-waw-ya،shadda،tanween،lam',
  `المهارات بترتيب §٥: ${SKILLS.map((s) => s.title).join(' ← ')}`);
// الحزمة ١٤ (قرار المالك على و٢): مدّ الألف بعد ١ (يُشرَح ساعة أول استعماله في «بَابَا»)،
// والسكون بعد ٢ (أمثلته بْ مْ دْ رْ مدروسة حينها)، ومدّ الواو والياء بعد ٣ (بها يكتملان).
ok(SKILLS.map((s) => s.after).join('،') === 'g1،g2،g3،g4،g5،g6',
  'مواضعها: مدّ الألف بعد ١، السكون بعد ٢، مدّ الواو والياء بعد ٣، ثم الشدّة والتنوين واللام');
ok(SKILLS.every((s) => s.compare.pairs.every(([a, b]) => a && b && a !== b)),
  'ولكل درس أزواج مقارنة سليمة الطرفين');
ok(STORIES.length === 3 && STORIES.every((s) => s.sentences.length >= 3 && s.sentences.length <= 5),
  `ثلاث قصص، كل واحدة ٣–٥ جمل (${STORIES.map((s) => s.sentences.length).join('،')})`);
ok(STORIES.every((s) => s.sentences.every((x) => x.words.length <= 6)),
  'لا جملة تتجاوز ست كلمات (المبتدئ يقرأ القصير)');

// كل قصة تأتي بعد المهارة التي تُوظّفها: القصة الأولى بعد الشدّة… إلخ
const order = [];
for (const g of GROUPS) {
  order.push(...SKILLS.filter((s) => s.after === g.id).map((s) => `مهارة:${s.id}`));
  order.push(...STORIES.filter((s) => s.after === g.id).map((s) => `قصة:${s.id}`));
}
ok(order.join(' ← ') === 'مهارة:madd-alif ← مهارة:sukun ← مهارة:madd-waw-ya ← مهارة:shadda ← قصة:st1 ← مهارة:tanween ← قصة:st2 ← مهارة:lam ← قصة:st3',
  `كل قصة تلي المهارة التي تُوظّفها (${order.join(' ← ')})`);

// ————— ٢. الأمثلة: الإحالات تُحلّ، والجديد كامل —————

const badRefs = SKILLS.flatMap((s) => (s.wordRefs || []).filter((say) =>
  !GROUPS.flatMap((g) => g.words).some((w) => w.say === say)));
ok(badRefs.length === 0, `كل إحالات الكلمات تُصيب كلمةً في المنهج${badRefs.length ? ': ' + badRefs : ''}`);
// العدد الأدنى كلمتان لا ثلاث منذ الحزمة ١٤: «مدّ الواو والياء» بعد المجموعة ٣ ورصيد
// الطفل عندها فيه كلمتان بهذا المدّ لا ثالثة لهما (توت، تين) — والزيادة تعني كلمةً
// مؤلَّفة لا يملكها، أو تأخيرَ الدرس عن موضعه. وما زاد رصيدُه فثلاثٌ فأكثر.
ok(SKILLS.every((s) => skillExamples(s).length >= 2
  && skillExamples(s).every((w) => w.text && w.say && w.emoji)),
  `لكل مهارة كلمتان مصوَّرتان على الأقل بنصّ ونطق وصورة (${SKILLS.map((s) => skillExamples(s).length).join('،')})`);
ok(skillExamples(skillById('madd-alif'))[0].text === 'بَابَا'
  && skillExamples(skillById('madd-alif'))[0].say === 'بابا',
  'الكلمة المُحال إليها تُعرض بمقاطعها المركّبة وتُنطق بنصّ المنهج (صوتها موجود)');

// ————— ٣. جولات «ميّز بأذنك» في درس المهارة —————

let rounds = 0;
for (let seed = 1; seed <= 60; seed++) {
  const rnd = rng(seed);
  for (const skill of SKILLS) {
    const pool = skill.compare.pairs.flat();
    for (const r of buildSkillRounds(skill, rnd)) {
      rounds++;
      if (r.options.length !== 3) { fails++; console.log(`  ✗ [${skill.id}] خيارات ≠ ٣`); }
      if (new Set(r.options).size !== r.options.length) {
        fails++; console.log(`  ✗ [${skill.id}] خيار مكرَّر: ${r.options.join('،')}`);
      }
      if (!r.options.includes(r.target)) {
        fails++; console.log(`  ✗ [${skill.id}] الهدف «${r.target}» ليس بين الخيارات`);
      }
      if (r.options.some((t) => !pool.includes(t))) {
        fails++; console.log(`  ✗ [${skill.id}] خيار من خارج مادة الدرس: ${r.options.join('،')}`);
      }
      // الزوج نفسه حاضر دائماً: التمييز يقع على العلامة لا على الحرف
      const pair = skill.compare.pairs.find((x) => x.includes(r.target));
      if (!pair.every((t) => r.options.includes(t))) {
        fails++; console.log(`  ✗ [${skill.id}] طرفا الزوج ليسا معاً في الخيارات`);
      }
    }
  }
}
ok(true, `جولات تمييز سليمة في ٦٠ بذرة عشوائية (${rounds} جولة)`);
ok(buildSkillRounds({ compare: { pairs: [['بَ', 'بَا']] } }).length === 0,
  'درس بزوج واحد ⇒ لا خطوة تمييز (يفشل مغلقاً)');

// ————— ٤. الرحلة: العقد الجديدة وقفلها —————

const nodes = p.allNodes();
const ids = nodes.map((n) => n.id);
const { GARDENS } = await import(new URL('lexicon.js', APP));
const { RUNGS } = await import(new URL('sentences.js', APP));
const { LIBRARY } = await import(new URL('library.js', APP));
const BUNDLES = GARDENS.reduce((s, g) => s + g.bundles.length, 0);
const { ROOTS } = await import(new URL('curriculum.js', APP));
ok(nodes.length === GROUPS.reduce((s, g) => s + g.letters.length + 1, 0)
  + SKILLS.length + STORIES.length + CONTRASTS.length + GATES.length + quranParts().length
  + BUNDLES + RUNGS.length + LIBRARY.length + ROOTS.length,
  `عقد الرحلة = عقد المجموعات + ${SKILLS.length} مهارات + ٣ قصص + ${CONTRASTS.length} محطة «ميّز بين»`
  + ` + بوابتان + خاتمة قرآنية + ${BUNDLES} باقة + ${RUNGS.length} درجة جمل`
  + ` + ${LIBRARY.length} قصة مكتبة (${nodes.length} عقدة)`);
ok(ids.indexOf('skill:madd-alif') === ids.indexOf('g1:words') + 1
  && ids.indexOf('g2:ن') === ids.indexOf('skill:madd-alif') + 1,
  'مدّ الألف يدخل الخريطة بين المجموعتين ١ و٢');
ok(ids.indexOf('skill:sukun') === ids.indexOf('g2:words') + 1
  && ids.indexOf('g3:ت') === ids.indexOf('skill:sukun') + 1,
  'والسكون بين ٢ و٣');
// أولُ حرفٍ في المجموعة **مشتقٌّ لا مكتوب**: ترتيبُ المجموعة ٤ صار `ك ع ف ق`
// (الحكم ب٥) — والمحروسُ هنا موضعُ المهارة من المجموعة لا هويّةُ الحرف.
const firstOf = (gid) => `${gid}:${GROUPS.find((g) => g.id === gid).letters[0]}`;
ok(ids.indexOf('skill:madd-waw-ya') === ids.indexOf('g3:words') + 1
  && ids.indexOf(firstOf('g4')) === ids.indexOf('skill:madd-waw-ya') + 1,
  'ومدّ الواو والياء بين ٣ و٤');
ok(ids.indexOf('story:st1') === ids.indexOf('skill:shadda') + 1,
  'والقصة تلي مهارتها مباشرة');
ok(p.maxTotalStars() === nodes.length * p.MAX_STARS, 'سقف النجوم يشمل العقد الجديدة');

p.reset();
const upTo = (id) => {                       // إنجاز كل ما قبل عقدة بعينها
  p.reset();
  for (const n of nodes) {
    if (n.id === id) break;
    p.setStars(n.id, 3);
  }
};

upTo('skill:madd-alif');
ok(p.isNodeUnlockedById('skill:madd-alif'), 'درس مدّ الألف يُفتح بإتمام المجموعة الأولى');
ok(!p.isGroupUnlocked('g2'), 'والمجموعة الثانية مقفلة حتى يُتمّه');
ok(p.nextNode().id === 'skill:madd-alif', '«تابع من هنا» يشير إليه');

p.setStars('skill:madd-alif', 3);
ok(p.isGroupUnlocked('g2'), 'وبإتمامه تُفتح المجموعة الثانية');

upTo('skill:madd-waw-ya');
ok(p.isNodeUnlockedById('skill:madd-waw-ya'), 'ومدّ الواو والياء يُفتح بإتمام المجموعة الثالثة');
ok(!p.isGroupUnlocked('g4'), 'والمجموعة الرابعة مقفلة حتى يُتمّه');
p.setStars('skill:madd-waw-ya', 2);
ok(p.isGroupUnlocked('g4'), 'وبإتمامه تُفتح المجموعة الرابعة');

upTo('story:st1');
ok(p.isNodeUnlockedById('story:st1') && p.nextNode().id === 'story:st1',
  'القصة الأولى تُفتح بإتمام درس الشدّة');
ok(!p.isGroupUnlocked('g5'), 'والمجموعة الخامسة تنتظر قراءتها');

p.reset();
ok(!p.isNodeUnlockedById('skill:madd-alif') && !p.isNodeUnlockedById('story:st3'),
  'كل عقد المهارات والقصص مقفلة في البداية');
ok(p.findNode('skill:lam') && !p.findNode('skill:لا-وجود-له'), 'البحث عن عقدة مجهولة يعود بلا شيء');

// ————— ٥. نجوم القراءة —————

ok(starsForStory(5, 5) === 3, 'من سمع الجمل كلها ⇒ ثلاث نجوم');
ok(starsForStory(3, 5) === 2 && starsForStory(2, 4) === 2, 'ومن سمع نصفها فأكثر ⇒ نجمتان');
ok(starsForStory(1, 5) === 1 && starsForStory(0, 5) === 1, 'ومن مرّ مروراً ⇒ نجمة');

// ————— ٥ب. قصصُ المنهج: قراءةٌ مقيسة وسؤالُ فهم (الحكم ب٤، جلسة وز٢) —————
//
// كانت ثلاثُ نجومٍ تُنال بنقرةٍ واحدة على «اسمع القصة كاملة»: أعلى تقديرٍ في المحطة
// بلا قراءةٍ ولا سؤال. والمحروسُ هنا ثلاثة: أنّ السماعَ وحده **لا يبلغ الثلاث**، وأنّ
// لكل قصةٍ سؤالَ فهمٍ بخياراتٍ مصوَّرة، وأنّ نصَّ السؤال **معروضٌ لا منطوق** (صفرُ
// إضافةٍ صوتية: لا يدخل جردَ المنطوق فلا يُطلب له ملف).
console.log('\n— قصص المنهج: تُقاس بما قرأ لا بما سمع —');
ok(starsForTale(5, 5, true) === 3 && starsForTale(5, 5, false) === 2,
  'من قرأ الجمل كلها: ثلاثٌ بسؤالٍ أصابه من أوّله، ونجمتان بدونه');
ok(starsForTale(0, 5, false) === 1 && starsForTale(0, 5, true) === 1,
  'ومن لم يقرأ جملةً: نجمةٌ واحدة — والقراءةُ بالعين لا تُحرَم');
ok(starsForTale(3, 5, true) === 2, 'ومن قرأ نصفها وأصاب: نجمتان');

const asks = STORIES.map((s) => ({ story: s, ask: storyAsk(s) }));
ok(asks.every(({ ask }) => ask && ask.options.length === 3 && ask.options.every((o) => o.emoji)),
  `ولكل قصةٍ سؤالُ فهمٍ بثلاث صور (${asks.map(({ ask }) => ask?.text || '—').join(' · ')})`);
ok(asks.every(({ ask }) => ask.options.includes(ask.answer)
  && new Set(ask.options.map((o) => o.emoji)).size === 3),
  'وجوابُه بين خياراته، ولا صورتان متطابقتان في حوضٍ واحد («صدق الصورة»)');
ok(asks.every(({ story, ask }) => !storyTexts(story).includes(ask.text)),
  'ونصُّ السؤال معروضٌ لا منطوق — فلا ملفَّ صوتٍ جديداً يطلبه الحكم');

// ————— ٦. الصوت: ملف مولَّد أو مكان في قائمة الانتظار —————

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));

const spoken = [...new Set([...SKILLS.flatMap(skillTexts), ...STORIES.flatMap(storyTexts)])];
const orphan = spoken.filter((t) => !have.has(t) && !pending.has(t));
ok(orphan.length === 0,
  `كل نصّ منطوق له ملف أو مكان في القائمة (${spoken.length} نصاً: ${spoken.filter((t) => have.has(t)).length} جاهز، ${spoken.filter((t) => pending.has(t)).length} منتظِر)${orphan.length ? ' — بلا شيء: ' + orphan.join('،') : ''}`);

// نصّ الجملة المنطوق = كلماتها المعروضة نفسها (لا مصدر ثانٍ يفترق عنه)
const mismatch = STORIES.flatMap((s) => s.sentences)
  .filter((s) => sentenceText(s) !== s.words.join(' '));
ok(mismatch.length === 0, 'نصّ كل جملة مبنيّ من كلماتها المعروضة حرفياً');

// ————— ٧. المفكوكية: عيّنة مستقلّة عن الفاحص البايثوني —————

const lettersUpToGroup = (gid) => {
  const out = [];
  for (const g of GROUPS) { out.push(...g.letters); if (g.id === gid) break; }
  return out;
};
const outside = [];
for (const item of [...SKILLS, ...STORIES]) {
  const studied = lettersUpToGroup(item.after);
  const texts = item.sentences
    ? [item.title, ...item.sentences.flatMap((s) => s.words)]
    : [...item.compare.pairs.flat(), ...skillExamples(item).map((w) => w.text)];
  for (const text of texts) {
    for (const c of bareLetters(text)) if (!studied.includes(c)) outside.push(`${item.id}: ${c} في «${text}»`);
  }
}
ok(outside.length === 0, `لا حرف خارج حصيلة موضعه${outside.length ? ' — ' + outside.join('، ') : ''}`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات المهارات والقصص ناجحة');
process.exit(fails ? 1 : 0);
