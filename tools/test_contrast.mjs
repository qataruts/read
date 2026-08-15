// اختبار محطتَي «ميّز بين» (الحزمة ١٣) بلا متصفّح:
//   node tools/test_contrast.mjs
// المحروس هنا ستّة: بيانات الأزواج ومفكوكيتها عند موضعها من الرحلة، وسلامة الجولات
// (الخياران هما الزوج نفسه بحركة واحدة)، وموضعُ المحطتين وقفلُهما، **وصفرُ إضافةٍ
// صوتية** (كل ما تنطقه له ملف مولَّد لا مكانٌ في قائمة الانتظار)، ودخولُ قياسها
// ليتنر بتمرينٍ يراجعها في المراجعة والبوابة، والترحيلُ الرحيم لمن جاوز موضعها.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GROUPS, HARAKAT, CONTRASTS, contrastById, contrastPairs, contrastTexts,
} = await import(new URL('curriculum.js', APP));
const { buildContrastRounds, contrastRoundTexts, ROUNDS_PER_PAIR } =
  await import(new URL('contrast.js', APP));
const { buildSession, itemTexts, studiedPairs, starsForReview } =
  await import(new URL('review.js', APP));
const p = await import(new URL('progress.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** حصيلة الطفل عند نهاية مجموعة: حروف المجموعات حتى هذه. */
const lettersUpToGroup = (gid) => {
  const out = [];
  for (const g of GROUPS) { out.push(...g.letters); if (g.id === gid) break; }
  return out;
};

// ————— ١. البيانات: محطتان بأزواجهما، ولا زوج قبل حرفه —————

ok(CONTRASTS.length === 2 && CONTRASTS.map((c) => c.after).join('،') === 'g6،g7',
  `محطتا مواجهة: بعد المجموعة ٦ وبعد ٧ (${CONTRASTS.map((c) => c.title).join(' · ')})`);
ok(CONTRASTS.every((c) => c.id && c.title && c.face && c.hint && c.pairs.length),
  'لكل محطة معرّفها وعنوانها ووجهها وسطرُ توجيهها وأزواجها');
// ثلاثةٌ في الأولى وستةٌ في الثانية: أربعةٌ منذ الحزمة ١٣، وزوجا الحلق (ع/ح · غ/خ)
// بالحكم ج٢ — والثانيةُ موضعُهما لأن الغين لا تُدرَّس إلا في السابعة.
ok(CONTRASTS.map((c) => c.pairs.length).join('،') === '3،6',
  `ثلاثة أزواج في الأولى وستة في الثانية (${CONTRASTS.map((c) => c.pairs.length).join('،')})`);
ok(contrastById('alike') && !contrastById('لا-وجود-لها'),
  'والبحث عن محطة مجهولة يعود بلا شيء');

const pairs = contrastPairs();
ok(pairs.length === 9 && pairs.every((p2) => p2.id && p2.letters.length >= 2),
  `تسعة أزواج مسطَّحة (${pairs.map((x) => x.letters.join('/')).join(' · ')})`);
ok(new Set(pairs.map((x) => [...x.letters].sort().join(''))).size === pairs.length,
  'لا زوج مكرَّر بين المحطتين — مواجهةٌ واحدة تكفي');

// المفكوكية: كل حرف في زوجٍ مدروسٌ عند موضع محطته (عيّنة مستقلّة عن الفاحص البايثوني)
const early = [];
for (const c of CONTRASTS) {
  const studied = lettersUpToGroup(c.after);
  for (const pair of c.pairs) {
    for (const ch of pair.letters) if (!studied.includes(ch)) early.push(`${c.id}: ${ch}`);
  }
}
ok(early.length === 0,
  `لا حرف يُواجَه به الطفل قبل درسه${early.length ? ' — ' + early.join('، ') : ''}`);

// المتشابهات التي أعلنها المنهج (METHOD §٢.٥) كلها لها مواجهة
const declared = [['ت', 'ط'], ['س', 'ص'], ['ذ', 'ظ'], ['ك', 'ق'], ['ه', 'ح']];
const uncovered = declared.filter(([a, b]) =>
  !pairs.some((x) => x.letters.includes(a) && x.letters.includes(b)));
ok(uncovered.length === 0,
  `كل متشابهات METHOD §٢.٥ لها زوج مواجهة${uncovered.length ? ' — ينقص: ' + uncovered.map((x) => x.join('/')).join('، ') : ''}`);

// ————— ٢. الجولات: الخيارات هي الزوج نفسه بحركة واحدة —————

let rounds = 0;
let bad = '';
for (let seed = 1; seed <= 60; seed++) {
  const rnd = rng(seed);
  for (const c of CONTRASTS) {
    const built = buildContrastRounds(c, rnd);
    if (built.length !== c.pairs.length * ROUNDS_PER_PAIR) {
      bad ||= `[${c.id}] عدد الجولات ${built.length}`;
    }
    for (const r of built) {
      rounds++;
      const pair = c.pairs.find((x) => x.id === r.pair);
      if (!pair) { bad ||= `[${c.id}] جولة بزوج مجهول`; continue; }
      if (r.options.length !== pair.letters.length) bad ||= `[${c.id}] خيارات ≠ حروف الزوج`;
      if (r.options.some((ch) => !pair.letters.includes(ch))) bad ||= `[${c.id}] خيار من خارج الزوج`;
      if (!r.options.includes(r.letter)) bad ||= `[${c.id}] الهدف ليس بين الخيارات`;
      if (!HARAKAT.some((k) => k.key === r.haraka && k.mark === r.mark)) {
        bad ||= `[${c.id}] حركة مجهولة`;
      }
    }
    // جولتان لكل زوج بحركتين مختلفتين: لا يُحفَظ الجواب بنغمة واحدة
    for (const pair of c.pairs) {
      const mine = built.filter((r) => r.pair === pair.id);
      if (mine.length !== ROUNDS_PER_PAIR) bad ||= `[${c.id}] ${pair.id}: ${mine.length} جولة`;
      if (new Set(mine.map((r) => r.haraka)).size !== mine.length) {
        bad ||= `[${c.id}] ${pair.id}: حركة مكرَّرة في جولتيه`;
      }
    }
  }
}
ok(!bad, `جولات سليمة في ٦٠ بذرة عشوائية (${rounds} جولة)${bad ? ' — ' + bad : ''}`);
ok(buildContrastRounds({ pairs: [] }).length === 0
  && buildContrastRounds(null).length === 0,
  'محطة بلا أزواج ⇒ لا جولات (تفشل مغلقةً)');

// التمييز على الحرف وحده: كل خيارات الجولة بحركة واحدة (نصّ التكليف)
const oneHaraka = buildContrastRounds(CONTRASTS[1], rng(7))
  .every((r) => r.options.every((ch) => (ch + r.mark).slice(1) === r.mark));
ok(oneHaraka, 'حركة واحدة لكل خيارات الجولة — فلا يُفرَّق بينها إلا بالحرف');

// ————— ٣. الصوت: صفرُ إضافة (ملفٌ مولَّد لكل نصّ، لا انتظار) —————

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));

const texts = contrastTexts();
const orphan = texts.filter((t) => !have.has(t));
ok(orphan.length === 0,
  `كل ما تنطقه المحطتان له ملف مولَّد جاهز (${texts.length} نصاً)${orphan.length ? ' — ناقص: ' + orphan.join('،') : ''}`);
ok(texts.every((t) => !pending.has(t)),
  'ولا نصّ منها في قائمة الانتظار الصوتية — صفرُ إضافة كما نصّ التكليف');
ok(CONTRASTS.every((c) => contrastRoundTexts(c).every((t) => texts.includes(t))),
  'ونصوص كل محطة على حدة (للتحميل المسبق) من القائمة نفسها');

// ————— ٤. الرحلة: موضع المحطتين وقفلهما —————

const nodes = p.allNodes();
const ids = nodes.map((n) => n.id);
ok(ids.filter((id) => id.startsWith('contrast:')).length === 2,
  'عقدتان في الرحلة بمعرّف «contrast:…»');
ok(ids[ids.indexOf('story:st3') + 1] === 'contrast:alike'
  && ids[ids.indexOf('contrast:alike') + 1] === 'g7:ث',
  'محطة المتشابهات بعد قصة المجموعة السادسة وقبل السابعة');
ok(ids[ids.indexOf('g7:words') + 1] === 'contrast:alike-hard'
  && ids[ids.indexOf('contrast:alike-hard') + 1] === 'gate:quran',
  'ومحطة الأصعب بعد لعبة كلمات السابعة وقبل بوابة المصحف');
ok(nodes.filter((n) => n.type === 'contrast').every((n) => n.contrast && n.groupId === n.contrast.after),
  'ولكل عقدة محطتُها ومجموعتُها');

const upTo = (id) => {
  p.reset();
  for (const n of nodes) {
    if (n.id === id) break;
    p.setStars(n.id, 3);
  }
};

upTo('contrast:alike');
ok(p.isNodeUnlockedById('contrast:alike'), 'المحطة تُفتح بإتمام كل ما قبلها');
ok(!p.isGroupUnlocked('g7'), 'والمجموعة السابعة مقفلة حتى يُتمّها');
ok(p.nextNode().id === 'contrast:alike', '«تابع من هنا» يشير إليها');
p.setStars('contrast:alike', 2);
ok(p.isGroupUnlocked('g7'), 'وبإتمامها تُفتح المجموعة السابعة');

upTo('contrast:alike-hard');
ok(p.isNodeUnlockedById('contrast:alike-hard') && !p.isNodeUnlockedById('gate:quran'),
  'ومحطة الأصعب تقف قبل بوابة المصحف');

p.reset();
ok(!p.isNodeUnlockedById('contrast:alike') && !p.isNodeUnlockedById('contrast:alike-hard'),
  'والمحطتان مقفلتان في البداية');

// ————— ٥. القياس: يدخل ليتنر، وله تمرينٌ يراجعه —————

ok(p.KINDS.CONTRAST === 'contrast', 'نوع التمرين المقيس معلَن في KINDS');

upTo('contrast:alike-hard');                      // حصيلته كل الحروف
const letters = p.studiedLetters();
const words = p.studiedWords(letters);
const ready = studiedPairs(letters);
ok(ready.length === pairs.length, `كل الأزواج صارت في يده عند المحطة الثانية (${ready.length})`);
ok(studiedPairs(['س', 'ص']).length === 1 && studiedPairs(['س']).length === 0,
  'وزوجٌ ينقص أحد حرفيه لا يُسأل عنه (المفكوكية في المراجعة أيضاً)');

const today = p.dayNumber();
for (let i = 0; i < 3; i++) p.recordAttempt('ض', 'fatha', p.KINDS.CONTRAST, false, today);
const skill = p.skills().find((s) => s.kind === p.KINDS.CONTRAST);
ok(skill && skill.letter === 'ض' && skill.box === 0 && skill.due === today,
  'خطأ المواجهة يُسجَّل مهارةً في صندوق اليوم (حرف × حركة × مواجهة)');

const session = buildSession({
  letters, words, sentences: [], pairs: ready, due: p.weakestSkills(), size: 6, rnd: rng(3),
});
const item = session.find((x) => x.kind === p.KINDS.CONTRAST);
ok(!!item && item.letter === 'ض',
  'وجلسة المراجعة تبني له تمرين مواجهة — فلا مهارةَ تُقاس بلا تمرينٍ يراجعها');
ok(item && item.options.includes('ض') && item.options.every((ch) => letters.includes(ch))
  && item.options.length >= 2,
  `وخياراته زوجُه من حصيلته (${item?.options.join('/')})`);
ok(item && itemTexts(item).length === item.options.length
  && itemTexts(item).every((t) => have.has(t)),
  'ونصوصه كلها لها ملفات مولَّدة');

// بلا أزواج محقونة لا يُبنى تمرين مواجهة أصلاً (الدالّة خالصة: كل ما تحتاجه يُحقَن)
const noPairs = buildSession({
  letters, words, sentences: [], pairs: [], due: p.weakestSkills(), size: 6, rnd: rng(3),
});
ok(noPairs.every((x) => x.kind !== p.KINDS.CONTRAST),
  'وجلسةٌ بلا أزواج محقونة لا تبني مواجهةً (الدالّة خالصة)');

ok(starsForReview(0, 6) === 3 && starsForReview(4, 6) === 2 && starsForReview(7, 6) === 1,
  'ونجوم المحطة بعتبة متناسبة مع طولها (٣ بلا خطأ، ٢ ما دام الخطأ ≤ عدد الجولات)');

// ————— ٦. الترحيل الرحيم: مَن جاوز موضعها قبل وجودها —————

async function loadWith(stars) {
  store.set('muallim.progress.v1', JSON.stringify({
    v: 2, stars, skills: {}, days: {}, reviews: {}, records: [], mic: false,
    seconds: 0, startedAt: Date.now(), updatedAt: Date.now(),
  }));
  return import(`${new URL('progress.js', APP).href}?t=${Math.random()}`);
}

// حالة طفلٍ قائم قبل الحزمة ١٣: رحلتُه كاملة حتى المصحف بلا أثرٍ للمحطتين
const legacy = Object.fromEntries(ids.slice(0, ids.indexOf('quran:letters'))
  .filter((id) => !id.startsWith('contrast:'))
  .map((id) => [id, 3]));
const past = await loadWith({ ...legacy, 'quran:letters': 2 });
ok(past.getStars('contrast:alike') === 1 && past.getStars('contrast:alike-hard') === 1,
  'محطةٌ استحدثناها خلف موضع الطفل تُفتح بنجمةِ إتمامٍ واحدة (لا يُحبَس رجعياً)');
ok(past.getStars('gate:quran') === 3,
  'والبوابة تبقى على نجومها — لكلِّ نوعٍ ترحيلُه');
ok(past.isNodeUnlockedById('quran:letters'),
  'ورحلتُه تكمل من حيث وقف: المحطة المستحدثة لا تصير سدّاً أمام ما بعدها');

const beforeIt = await loadWith({ 'g1:ا': 3, 'g1:ب': 2 });
ok(beforeIt.getStars('contrast:alike') === 0,
  'ومَن لم يبلغها لا تُفتح له ولا تُعطى نجمة');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «ميّز بين» ناجحة');
process.exit(fails ? 1 : 0);
