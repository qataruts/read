// اختبار المرحلة القرآنية (الجلسة ٦) بلا متصفّح:
//   node tools/test_quran.mjs
// المحروس هنا خمسة: موضع المرحلة من الرحلة وقفلها، وسلامة جولاتها،
// وأصالة نصّ المصحف (مطابقة المصدر المرجعي حرفاً بحرف — فحص مستقلّ عن البايثوني)،
// و**حرمة توليد صوت المصحف**: لا آية ولا كلمة عثمانية في الأصوات المولّدة ولا في
// قائمة الانتظار، **ووصلة التلاوة**: لكل آية تسجيلُ قارئ بمفتاح نصّها (وصلة الجلسة ٩).

import { existsSync, readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GROUPS, SKILLS, STORIES, GATES, CONTRASTS, ROOTS, QURAN, quranParts, surahById,
  quranSpokenTexts, quranMushafTexts, quranWordTexts, quranWordItems, surahWords,
  surahWordsPart, surahOfWordsPart, quranWordLevel, bareLetters,
} = await import(new URL('curriculum.js', APP));
const { keyFor } = await import(new URL('audio.js', APP));   // مفتاح النصّ نفسه في كل المشروع
const { buildRasmRounds, buildFindRounds } = await import(new URL('quran.js', APP));
// «اقرأ واختر» انتقلت إلى screens.js في الحزمة ٧ (تشترك فيها المرحلة القرآنية والبساتين)
const { buildReadRounds } = await import(new URL('screens.js', APP));
const { starsForStory } = await import(new URL('story.js', APP));
const { starsForGame } = await import(new URL('words.js', APP));
const p = await import(new URL('progress.js', APP));
const { GARDENS } = await import(new URL('lexicon.js', APP));
const { RUNGS } = await import(new URL('sentences.js', APP));
const { LIBRARY } = await import(new URL('library.js', APP));
const BUNDLES = GARDENS.reduce((s, g) => s + g.bundles.length, 0);

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ————— ١. موضع المرحلة من الرحلة وترتيب درجاتها —————

ok(QURAN.after === GROUPS.at(-1).id, `المرحلة القرآنية بعد المجموعة الأخيرة (${QURAN.after})`);

const parts = quranParts().map((x) => x.part);
ok(parts.join(' ← ') === ('letters words1 words2 words3 rasm muqattaat '
  + 'sw-s1 s1 sw-s112 s112 sw-s113 s113 sw-s114 s114 '
  + 'sw-s108 s108 sw-s103 s103 sw-s106 s106 sw-s111 s111 '
  + 'sw-s105 s105 sw-s94 s94 sw-s107 s107 sw-s101 s101').split(' ').join(' ← '),
  `درجاتها بالترتيب: ${parts.join(' ← ')}`);
ok(parts.indexOf('letters') < parts.indexOf('words1'),
  'درس الحرفين قبل الكلمات (كلماتها تستعملهما)');
ok(parts.indexOf('rasm') < parts.indexOf('muqattaat')
  && parts.indexOf('muqattaat') < parts.indexOf('s1'),
  'ودرس الرسم قبل كل نصّ عثماني — الحروف المقطَّعة ثم السور');
ok(quranParts().every((x) => x.title && x.face), 'ولكل عقدة عنوانها ووجهها على الخريطة');

// ————— ١ب. الجسر القرآني (الحزمة ١٢): لا سورة قبل كلماتها، والكلمات على درجات —————

ok(QURAN.words.levels.length >= 3 && quranWordItems().length >= 24,
  `كلمات القرآن على ${QURAN.words.levels.length} درجات في ${quranWordItems().length} كلمة`
  + ' (كانت ثمانياً في درجة واحدة)');
const sizes = QURAN.words.levels.map((l) => l.size);
ok(sizes.join('<') === [...sizes].sort((a, b) => a - b).join('<')
  && new Set(sizes).size === sizes.length,
  `وحدودها صاعدة بعدد الحروف (${sizes.join(' ← ')})`);
const last = sizes.at(-1);
const misfit = QURAN.words.levels.flatMap((l) => l.items
  .filter((w) => (l.size === last ? bareLetters(w.read).length < l.size
    : bareLetters(w.read).length !== l.size))
  .map((w) => `${w.read}@${l.id}`));
ok(misfit.length === 0,
  `وكل كلمة في درجتها بعدد حروفها${misfit.length ? ' — ' + misfit.join('، ') : ''}`);
ok(QURAN.words.levels.every((l) => quranWordLevel(l.id) === l)
  && quranWordLevel('words') === null,
  'ودرجةُ الكلمات تُقرأ بمعرّفها وحده (لا يلتبس `words1` بـ`words`)');

for (const surah of QURAN.surahs) {
  const at = parts.indexOf(surahWordsPart(surah.id));
  ok(at >= 0 && parts[at + 1] === surah.id,
    `محطة «كلمات سورة ${surah.name}» تسبق سورتها مباشرةً — لا سورة قبل كلماتها`);
}
ok(QURAN.surahs.every((s) => surahOfWordsPart(surahWordsPart(s.id)) === s)
  && surahOfWordsPart('words1') === null && surahOfWordsPart('s1') === null,
  'ومحطةُ الكلمات تُميَّز عن سورتها وعن درجات الكلمات بمعرّفها');

const nodes = p.allNodes();
const ids = nodes.map((n) => n.id);
ok(ids.filter((id) => id.startsWith('quran:')).length === parts.length,
  `عقد المرحلة في الرحلة (${parts.length} عقدة)`);
const quranStart = ids.indexOf('quran:letters');
ok(ids.slice(quranStart, quranStart + parts.length).join('|') === parts.map((x) => `quran:${x}`).join('|')
  && ids.slice(0, quranStart).every((id) => !id.startsWith('quran:')),
  'وهي متتابعة بعد الرحلة كلها (من درس الحرفين إلى آخر سورة)');
ok(ids.slice(quranStart + parts.length).every((id) => id.startsWith('garden:')
  || id.startsWith('ladder:') || id.startsWith('library:') || id.startsWith('roots:')
  || id === 'gate:gardens'),
  'ولا يليها إلا بوابة الحديقة (١٤) وبساتين الموضوعات (٧) وسلالم جملها (٨) '
  + 'ومكتبة قصصها (٩) وأشجار جذورها (الجذور)');
ok(ids[quranStart - 1] === 'gate:quran',
  'ويسبقها مباشرةً بوابة الإتقان — لا مصحف بحروف هشّة (الحزمة ١٤)');
// عقد التأسيس: حروف المجموعات ولعبها + المهارات + القصص + البوابتان + المرحلة القرآنية
const CORE = GROUPS.reduce((s, g) => s + g.letters.length + 1, 0)
  + SKILLS.length + STORIES.length + CONTRASTS.length + GATES.length + quranParts().length;
ok(p.maxTotalStars() === nodes.length * p.MAX_STARS
  && nodes.length === CORE + BUNDLES + RUNGS.length + LIBRARY.length + ROOTS.length,
  `سقف النجوم يشمل الخاتمة والبوابتين والبساتين والسلالم والمكتبة والأشجار (${nodes.length} عقدة، ${p.maxTotalStars()} نجمة)`);

const upTo = (id) => {
  p.reset();
  for (const n of nodes) {
    if (n.id === id) break;
    p.setStars(n.id, 3);
  }
};

p.reset();
ok(!p.isNodeUnlockedById('quran:letters'), 'المرحلة مقفلة في بداية الرحلة');
upTo('quran:letters');
ok(p.isNodeUnlockedById('quran:letters') && p.nextNode().id === 'quran:letters',
  'وتُفتح بإتمام كل ما قبلها (القصة الثالثة آخره)');
ok(!p.isNodeUnlockedById('quran:s1'), 'وسورة الفاتحة تنتظر دروس التهيئة قبلها');
const lastSurah = `quran:${QURAN.surahs.at(-1).id}`;
upTo(lastSurah);
ok(p.isNodeUnlockedById(lastSurah), `وآخر سورة تُفتح بإتمام ما قبلها (${lastSurah})`);
p.setStars(lastSurah, 3);
ok(p.nextNode()?.id === ids[quranStart + parts.length],
  `وبإتمامها يُفتح أول بستان (${p.nextNode()?.id})`);

// ————— ١ج. الشريحة الثانية (حزمة «القرآني الموسّع») —————
//
// **معيارُ الاختيار صار بنيوياً**: أقرّ المدير الشريحة بترتيب الطول التصاعدي، فإن
// أُقحمت سورةٌ طويلة بين قصيرتين يوماً سقط هذا الاختبار — لا يبقى المعيار في ورقةٍ
// وحدها. والطولُ بالرمز (لا بعدد الآيات) فهو ما يراه الطفل على الصفحة.

const SLICE = ['s108', 's103', 's106', 's111', 's105', 's94', 's107', 's101'];
ok(QURAN.surahs.length === 12 && SLICE.every((id) => surahById(id)),
  `اثنتا عشرة سورة: أربعٌ سابقة وثمانٍ أقرّها المدير (${SLICE.join('، ')})`);
const bulk = (s) => s.ayat.join(' ').length;
const slice = SLICE.map((id) => surahById(id));
ok(slice.every((s, i) => i === 0 || bulk(slice[i - 1]) < bulk(s)),
  `وطولُها صاعدٌ بلا قفزةٍ إلى الوراء (${slice.map((s) => bulk(s)).join(' ← ')} رمزاً)`);
ok(bulk(slice[0]) < bulk(surahById('s112')),
  `وأوّلُها (${slice[0].name}، ${bulk(slice[0])}) أقصرُ من الإخلاص — لا يلقى أثقلَ ممّا عرف`);
ok(slice.every((s) => !s.basmalaIsAyah && s.emoji && s.name),
  'ولكلٍّ اسمُها ووجهُها، والبسملةُ سطرٌ مستقلّ فيها كلِّها');

// **التين والقدر مستثناتان بحكمٍ مستقلّ**: بسملتُهما في المصدر `بِّسْمِ` بشدّةٍ على
// الباء — إظهارٌ لإدغام باء آخرِ السورة قبلهما — فلا تُنزَع بمطابقةٍ حرفية.
ok(!QURAN.surahs.some((s) => [95, 97].includes(s.number)),
  'ولا التينُ ولا القدرُ في المنهج — بسملتُهما تخالف بسملتَنا حرفاً (حكمٌ مستقلّ)');

// ————— ٢. جولات «اقرأ واختر» و«ميّز العلامة» —————

const readItems = quranWordItems();
let rounds = 0;
for (let seed = 1; seed <= 60; seed++) {
  const rnd = rng(seed);
  for (const items of [...QURAN.words.levels.map((l) => l.items),
    QURAN.letters.signs.flatMap((s) => s.words)]) {
    for (const r of buildReadRounds(items, rnd)) {
      rounds++;
      if (r.options.length !== 3) { fails++; console.log('  ✗ خيارات ≠ ٣'); }
      if (new Set(r.options.map((o) => o.read)).size !== 3) { fails++; console.log('  ✗ خيار مكرَّر'); }
      if (!r.options.includes(r.target)) { fails++; console.log('  ✗ الهدف ليس بين الخيارات'); }
      if (r.options.some((o) => !items.includes(o))) { fails++; console.log('  ✗ خيار من خارج الشاشة'); }
    }
  }
  for (const r of buildRasmRounds(QURAN.rasm.signs, rnd)) {
    if (!r.options.includes(r.target) || r.options.length !== 3) {
      fails++; console.log('  ✗ جولة رسم معطوبة');
    }
    if (r.options.filter((o) => o.sign === r.target.sign).length !== 1) {
      fails++; console.log('  ✗ علامة الهدف مكرَّرة بين الخيارات');
    }
  }
}
ok(true, `جولات سليمة في ٦٠ بذرة عشوائية (${rounds} جولة قراءة + جولات الرسم)`);
// غيرُ المصوَّرة لا تكون هدفاً وتبقى خياراً مكتوباً («صدق الصورة»، DESIGN §٦)
const level1 = QURAN.words.levels[0].items;
const pictured = level1.filter((w) => w.pictured !== false);
ok(buildReadRounds(level1).length === pictured.length,
  `كل كلمة مصوَّرة تأتي دورها مرة (${pictured.length} من ${level1.length} كلمة في الدرجة الأولى)`);
ok(buildReadRounds(level1).every((r) => r.target.pictured !== false),
  'ولا غيرَ مصوَّرةٍ هدفاً — الصورة هي السؤال كلُّه في «اقرأ واختر»');
ok(buildReadRounds([{ read: 'أ', emoji: '' }]).length === 0
  && buildRasmRounds([QURAN.rasm.signs[0]]).length === 0,
  'ومادةٌ أقلّ من ثلاثة خيارات ⇒ لا جولات (يفشل مغلقاً)');

// ————— ٣. المفكوكية: مادة القراءة الإملائية داخل حصيلة الطفل —————

const taught = new Set(GROUPS.flatMap((g) => g.letters));
const newSigns = new Set(QURAN.letters.signs.flatMap((s) => [s.sign, ...s.shapes.join('')]));
const known = new Set([...taught, ...newSigns].filter((c) => c !== 'ـ'));
const imla = [...QURAN.letters.signs.flatMap((s) => s.words), ...quranWordItems()].map((w) => w.read);
const outside = imla.flatMap((t) => [...bareLetters(t)].filter((c) => !known.has(c)).map((c) => `${c} في «${t}»`));
ok(outside.length === 0,
  `كلمات المرحلة الإملائية (${imla.length}) كلها بحروف مدروسة${outside.length ? ' — ' + outside.join('، ') : ''}`);
ok(QURAN.muqattaat.items.every((m) => m.parts.every((x) => taught.has(x.ch))),
  'وحروف المقطَّعة كلها مدروسة في المجموعات السبع');

// صورتان متطابقتان في شاشة واحدة تجعلان «اقرأ واختر» بلا جواب صحيح
for (const [where, items] of [
  ['درس الحرفين', QURAN.letters.signs.flatMap((s) => s.words)],
  ...QURAN.words.levels.map((l) => [l.title, l.items]),
]) {
  const seen = items.map((w) => w.emoji);
  const dup = seen.filter((e, i) => seen.indexOf(e) !== i);
  ok(dup.length === 0 && seen.every(Boolean),
    `${where}: لكل كلمة صورتها وحدها${dup.length ? ' — مكرَّرة: ' + dup.join('،') : ''}`);
}

// ————— ٤. أصالة النصّ العثماني: مطابقة المصدر المرجعي حرفاً بحرف —————

const source = new Map();
for (const line of readFileSync(new URL('quran_source.txt', import.meta.url), 'utf8').split('\n')) {
  if (line.startsWith('#') || !line.includes('|')) continue;
  const [ref, text] = [line.slice(0, line.indexOf('|')), line.slice(line.indexOf('|') + 1)];
  source.set(ref.trim(), text);
}
ok(source.size >= 22, `المصدر المرجعي (مشروع تنزيل) مقروء: ${source.size} آية`);
ok(QURAN.basmala === source.get('1:1'), 'البسملة تطابق المصدر');

let ayat = 0;
const mismatch = [];
for (const surah of QURAN.surahs) {
  surah.ayat.forEach((ayah, i) => {
    ayat++;
    const expected = source.get(`${surah.number}:${i + 1}`);
    const actual = (i === 0 && !surah.basmalaIsAyah) ? `${QURAN.basmala} ${ayah}` : ayah;
    if (actual !== expected) mismatch.push(`${surah.number}:${i + 1}`);
  });
}
ok(mismatch.length === 0,
  `${QURAN.surahs.length} سور و${ayat} آية تطابق المصدر حرفاً بحرف${mismatch.length ? ' — ' + mismatch.join('، ') : ''}`);
ok(surahById('s1').ayat.length === 7 && surahById('s1').basmalaIsAyah,
  'والبسملة آيةٌ في الفاتحة وحدها');
ok(QURAN.surahs.slice(1).every((s) => !s.basmalaIsAyah),
  'وتُعرض سطراً مستقلاً في السور الثلاث');

const joined = [...source.values()].join('\n');
const quoted = [...QURAN.rasm.signs.map((s) => s.read), ...QURAN.muqattaat.items.map((m) => m.read)];
ok(quoted.every((t) => joined.includes(t)),
  `وأمثلة الرسم والمقطَّعة (${quoted.length}) منقولة من المصحف لا مكتوبة بأيدينا`);
ok(QURAN.rasm.signs.every((s) => s.read.includes(s.sign.replace('ـ', ''))),
  'وكل علامة رسم ظاهرة فعلاً في مثالها');

// ————— ٤ب. محطات «كلمات السورة»: مشتقّةٌ من الآية، وجولاتُها موزَّعة (الحزمة ١٢) —————

let stationWords = 0;
for (const surah of QURAN.surahs) {
  const words = surahWords(surah);
  stationWords += words.length;
  const strayed = words.filter((w) => surah.ayat[w.ayah - 1].split(' ')[w.pos - 1] !== w.text);
  ok(strayed.length === 0 && words.length >= 3,
    `كلمات سورة ${surah.name} (${words.length}) كلٌّ في موضعها من آيتها`
    + `${strayed.length ? ' — ' + strayed.map((w) => w.text).join('، ') : ''}`);
  // إعادةُ الوصل تعيد الآية حرفاً بحرف: الشقُّ عرضٌ لا تعديل في نصّ المصحف
  const rebuilt = surah.ayat.map((a) => a.split(' ').join(' ')).join('|');
  ok(rebuilt === surah.ayat.join('|'),
    `ووصلُ كلمات ${surah.name} يعيد آياتها حرفاً بحرف (لا فراغ مزدوج ولا حذف)`);
  ok(new Set(words.map((w) => w.text)).size === words.length,
    `ولا بطاقةَ كلمةٍ مكرَّرة في ${surah.name}`);
}
ok(stationWords === quranWordTexts().length,
  `وجملةُ ما تعرضه المحطات ${stationWords} كلمة (بلا تكرارٍ داخل السورة)`);

let findRounds = 0;
for (let seed = 1; seed <= 60; seed++) {
  const rnd = rng(seed);
  for (const surah of QURAN.surahs) {
    const words = surahWords(surah);
    const built = buildFindRounds(words, 6, rnd);
    findRounds += built.length;
    if (built.length !== Math.min(6, words.length)) { fails++; console.log('  ✗ عدد جولات غير متوقَّع'); }
    if (new Set(built).size !== built.length) { fails++; console.log('  ✗ هدف مكرَّر في المحطة'); }
    if (built.some((w) => !words.includes(w))) { fails++; console.log('  ✗ هدف من خارج السورة'); }
    // التوزيع: ما دامت آياتُ السورة تكفي، فلا جولتان من آيةٍ واحدة
    const ayat = built.map((w) => w.ayah);
    if (surah.ayat.length >= built.length && new Set(ayat).size !== ayat.length) {
      fails++; console.log(`  ✗ جولتان من آيةٍ واحدة في ${surah.name}`);
    }
  }
}
ok(true, `وجولات «جِدْها في الآية» سليمة في ٦٠ بذرة (${findRounds} جولة)`);
ok(buildFindRounds([]).length === 0, 'ومحطةٌ بلا كلمات ⇒ لا جولات (تفشل مغلقةً)');

// كلمةٌ متكرّرة في آيتها: كلُّ موضعٍ لها صواب — لا جولةَ بلا جواب
const repeated = QURAN.surahs.flatMap((s) => s.ayat)
  .filter((a) => new Set(a.split(' ')).size !== a.split(' ').length);
ok(repeated.length > 0, `وفي المصحف آياتٌ تتكرّر فيها الكلمة (${repeated.length}) — تُقبل بكل مواضعها`);

// ————— ٥. الصوت: مولَّدٌ له ملف أو مكان في القائمة، وعثمانيٌّ لا يُولَّد أبداً —————

const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const pending = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
// نصٌّ صُرِّف للتوّ: ملفُّه على القرص قبل أن يُكتب الفهرس (المصرِّف عمليةٌ حيّة) — فالقرص
// شاهدٌ ثالث مع الفهرس والقائمة، وإلا احمرّ فحصٌ لا علاقة له بما نغيّر.
const onDisk = (t) => existsSync(new URL(`../app/audio/${keyFor(t)}.mp3`, import.meta.url));

const spoken = [...new Set(quranSpokenTexts())];
const orphan = spoken.filter((t) => !have.has(t) && !pending.has(t) && !onDisk(t));
ok(orphan.length === 0,
  `كل منطوق له ملف أو مكان في القائمة (${spoken.length} نصاً: ${spoken.filter((t) => have.has(t)).length} جاهز، ${spoken.filter((t) => pending.has(t)).length} منتظِر)${orphan.length ? ' — ' + orphan.join('،') : ''}`);

const mushaf = [...new Set(quranMushafTexts())];
const voiced = mushaf.filter((t) => have.has(t) || pending.has(t));
ok(mushaf.length >= 30 && voiced.length === 0,
  `ولا نصّ من المصحف (${mushaf.length} نصاً) له صوت مولَّد ولا مكان في القائمة`
  + `${voiced.length ? ' — ' + voiced.join('،') : ''} (METHOD §٥.٦)`);
ok(mushaf.every((t) => !spoken.includes(t)),
  'والقائمتان منفصلتان تماماً: ما يُعرض من المصحف لا يُولَّد صوتُه');

// ————— ٥ب. وصلة التلاوة: تسجيل قارئ متقن بمفتاح نصّ الآية —————

const recitations = JSON.parse(
  readFileSync(new URL('../app/data/recitations.json', import.meta.url), 'utf8'));
const recited = new Map(Object.entries(recitations.ayat));

ok(!!recitations.reciter && !!recitations.reciterName,
  `بيان التلاوة يسمّي قارئه (${recitations.reciterName})`);
const wanted = [...new Set([QURAN.basmala, ...QURAN.surahs.flatMap((s) => s.ayat)])];
const unrecited = wanted.filter((t) => ![...recited.values()].includes(t));
ok(unrecited.length === 0,
  `وكل آيةٍ لها تلاوة (${wanted.length} نصاً، منها البسملة)`
  + `${unrecited.length ? ' — ناقص: ' + unrecited.length : ''}`);
ok([...recited].every(([key, text]) => key === keyFor(text)),
  'ومفتاح كل تلاوة sha1 نصّها — فلا يسمع الطفل آيةً وهو ينظر إلى أخرى');
ok([...recited.values()].every((t) => mushaf.includes(t)),
  'ولا تلاوة إلا لنصّ مصحفٍ من المنهج');
ok([...recited.keys()].every((key) => existsSync(new URL(`../app/audio/${key}.mp3`, import.meta.url))),
  `وملفاتها كلها على القرص (${recited.size} تلاوة في app/audio/)`);
ok([...recited.keys()].every((key) => !(key in manifest)),
  'وليست في فهرس الأصوات المولّدة — بيانان منفصلان عمداً');

// وحدة التلاوة نفسها: لا تعرف النطق الآلي أصلاً (لا يسدّ مسدَّ القارئ شيء)
const recitationSrc = readFileSync(new URL('../app/js/recitation.js', import.meta.url), 'utf8');
ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(recitationSrc),
  'ووحدة التلاوة لا تعرف النطق الآلي البتّة (غياب الملف صمتٌ لا نطقُ مولّد)');
const quranSrc = readFileSync(new URL('../app/js/quran.js', import.meta.url), 'utf8');
ok(/recitation\.play|recitation\.playSequence/.test(quranSrc),
  'وشاشة السورة تتلو من `recitation.js` لا من `audio.js`');

// محطة كلمات السورة: كلُّ ما تنطقه نصُّ مصحف — فلا يمرّ منها شيء على `audio.js` البتّة
const stationSrc = quranSrc.slice(quranSrc.indexOf('function renderSurahWords'),
  quranSrc.indexOf('// ————— ٦)'));
ok(stationSrc.length > 500 && !/audio\.play/.test(stationSrc)
  && /recitation\.play/.test(stationSrc),
  'ومحطة كلمات السورة لا تمرّ بـ`audio.play` أصلاً — كلُّ ما تنطقه تلاوةُ قارئ');

// وسمُ ملف الكلمة: يمنع أن يلتقي نصُّ مصحفٍ بملفٍّ مولَّد له المفتاح نفسه («مَا» و«مِنَ»)
const clash = quranWordTexts().filter((t) => have.has(t) || pending.has(t));
ok(/WORD_PREFIX/.test(recitationSrc) && /wbw-/.test(recitationSrc),
  `ووسمُ \`wbw-\` يفصل ملفَّ الكلمة عن المولَّد — ${clash.length} كلمةَ مصحفٍ لها نظيرٌ مولَّد`
  + `${clash.length ? ' (' + clash.join('، ') + ')' : ''}`);
ok(clash.length > 0,
  'وهو ليس احتياطاً نظرياً: في السور كلماتٌ نصُّها نصُّ كلمةٍ عربية عادية في التطبيق');

// ————— ٥ج. خطوةُ الترديد (حزمة «القرآني الموسّع») —————
//
// المحروسُ فيها أربعة: **لا مؤقّت** (قانونُنا في كل الرحلة)، و**لا صوتَ مولَّداً**
// لآيةٍ تُردَّد، و**خصوصيةُ صوت الطفل** بنيويّةً، و**صفرُ إضافةٍ صوتية**.

const surahSrc = quranSrc.slice(quranSrc.indexOf('let at = 0;'),
  quranSrc.indexOf('function finish()'));
ok(surahSrc.length > 500 && /recordBlock\(/.test(surahSrc),
  `خطوةُ الترديد قائمة في شاشة السورة (${surahSrc.length} حرفاً) وفيها «رتّل وسجّل»`);
ok(!/setTimeout|setInterval|requestAnimationFrame/.test(surahSrc),
  'ولا مؤقّتَ فيها البتّة — لا عدّادَ تنازليّ ولا انتقالَ آليّ بعد سكوت (DESIGN §٥.٦)');
ok(!/audio\.play/.test(surahSrc) && /recitation\.play/.test(surahSrc),
  'وما يُسمَع فيها تلاوةُ قارئ لا صوتٌ مولَّد — لا تمرّ بـ`audio.play` أصلاً');

// **حاملُ صوت الطفل ملفٌّ واحد**: `record.js` تشترك فيه القصةُ والترديد، فلا تفترق
// نسختان في شيفرةٍ تحمل صوت طفل (ويقرأ `test_recordings.mjs` نصَّه ليثبت أنه بلا شبكة).
const recordSrc = readFileSync(new URL('../app/js/record.js', import.meta.url), 'utf8');
const storySrc = readFileSync(new URL('../app/js/story.js', import.meta.url), 'utf8');
// الشيفرةُ وحدها بلا تعليقات — وإلا لأمسك الحارسُ توثيقَ القاعدة نفسِها (كما في test_recordings)
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
ok(/blob/i.test(codeOf(recordSrc))
  && !/blob/i.test(codeOf(quranSrc)) && !/blob/i.test(codeOf(storySrc)),
  'وصوتُ الطفل لا يمرّ بـ`quran.js` ولا `story.js` — كتلتُه الواحدة في `record.js`');
ok(/recordBlock\(/.test(storySrc) && /from '\.\/record\.js'/.test(storySrc),
  'والقصةُ تستعمل الكتلةَ نفسَها — لا نسخةً ثانية تشيخ وحدها');

// **إعفاءُ القياس منصوصٌ** حيث يطالب به حارسُ «لا تدريسَ بلا قياس»
const measureSrc = readFileSync(new URL('test_measure.mjs', import.meta.url), 'utf8');
ok(/الترديد/.test(measureSrc) && !/progress\.recordAttempt\s*\(/.test(quranSrc),
  'وإعفاءُ الترديد من القياس مكتوبٌ بسببه في `test_measure.mjs`، ولا مهارةَ تُسجَّل هنا');

// ————— ٥د. الترحيلُ الرحيم: امتدادُ الدرسين لا يقفل على أحدٍ شيئاً —————
//
// درسا الرسم والهمزة اتّسعا (٦←٩ علامات، ٣←٥ صور) — **وهما عقدتان قائمتان لا
// جديدتان**، فنجومُ مَن تجاوزهما محفوظةٌ ولا يُعاد قفلُ ما بعدهما؛ والامتدادُ يُرى
// بالعودة إليهما. والسورُ الثماني عقدٌ **مستحدَثة خلف موضع مَن أتمّ الرحلة**،
// فيرحّلها `migrateJourney` بنجمة إتمامٍ واحدة (لا تدّعي إتقاناً وتدعوه إلى لعبها).

ok(QURAN.rasm.signs.length === 9 && QURAN.letters.signs[0].shapes.length === 5,
  `درسُ الرسم ${QURAN.rasm.signs.length} علامات ودرسُ الهمزة `
  + `${QURAN.letters.signs[0].shapes.length} صور`);

// حالةُ طفلٍ أتمّ الرحلة **قبل هذه الحزمة**: نجومٌ لكل عقدةٍ إلا الستّ عشرة الجديدة
const fresh = SLICE.flatMap((s) => [`quran:${s}`, `quran:sw-${s}`]);
store.set('muallim.progress.v1', JSON.stringify({
  v: p.VERSION,
  stars: Object.fromEntries(nodes.map((n) => [n.id, 3]).filter(([id]) => !fresh.includes(id))),
  skills: {}, days: {}, reviews: {},
}));
const after = await import(new URL('progress.js?slice=1', APP));   // الترحيل يجري عند الاستيراد

ok(after.getStars('quran:rasm') === 3 && after.getStars('quran:letters') === 3,
  'مَن تجاوز درسَي الرسم والهمزة: نجومُه الثلاث كما هي — الامتدادُ لا يمسّها');
ok(fresh.every((id) => after.getStars(id) === 1),
  `والسورُ الثماني المستحدَثة خلفه تُرحَّل بنجمةِ إتمامٍ واحدة (${fresh.length} عقدة)`);
ok(after.isNodeUnlockedById('gate:gardens') && after.isNodeUnlockedById(nodes.at(-1).id),
  'فلا يُحبَس مَن كان في البساتين بسورٍ استُحدثت خلفه — البوابةُ وآخرُ الرحلة مفتوحان');
store.clear();

// ————— ٦. النجوم —————

ok(starsForStory(7, 7) === 3 && starsForStory(4, 7) === 2 && starsForStory(1, 7) === 1,
  'نجوم السورة متابعةً لا إصابةً (كما نجوم القصة)');
ok(starsForGame(0, 8) === 3 && starsForGame(8, 8) === 2 && starsForGame(9, 8) === 1,
  'ونجوم «اقرأ واختر» بعتبة متناسبة مع طول النشاط');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات المرحلة القرآنية ناجحة');
process.exit(fails ? 1 : 0);
