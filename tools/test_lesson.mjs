// اختبار منطق درس الحرف (app/js/lesson.js) ومفكوكيته — بلا متصفّح.
//   node tools/test_lesson.mjs
// القاعدة المحروسة هنا: لا يظهر في أي تمرين أو مثال حرفٌ لم يُدرَّس بعد.

import { readFileSync } from 'node:fs';

const APP = new URL('../app/js/', import.meta.url);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GROUPS, HARAKAT, SUKUN, harakaText, lettersThrough, exampleWordFor, bareLetters,
} = await import(new URL('curriculum.js', APP));
const {
  buildRounds, harakaRounds, starsForErrors, clusters,
} = await import(new URL('lesson.js', APP));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

// مولّد عشوائي محدَّد البذرة كي تكون الاختبارات قابلة للإعادة
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ————— ١. الحروف المدروسة حتى كل درس —————

const cumulative = [];
let missingExample = [];
for (const g of GROUPS) {
  for (const letter of g.letters) {
    cumulative.push(letter);
    const studied = lettersThrough(g.id, letter);
    if (studied.join('') !== cumulative.join('')) {
      fails++;
      console.log(`  ✗ lettersThrough(${g.id}, ${letter}) = ${studied.join('')} ≠ ${cumulative.join('')}`);
    }
    const word = exampleWordFor(g.id, letter);
    if (!word) { missingExample.push(letter); continue; }
    const chars = [...bareLetters(word.tiles.join(''))];
    if (!chars.includes(letter)) {
      fails++;
      console.log(`  ✗ كلمة مثال «${word.say}» للحرف «${letter}» لا تحويه`);
    }
    const unknown = chars.filter((c) => !studied.includes(c));
    if (unknown.length) {
      fails++;
      console.log(`  ✗ كلمة مثال «${word.say}» عند «${letter}» فيها حرف غير مدروس: ${unknown.join('،')}`);
    }
  }
}
ok(true, `lettersThrough تراكمية ومطابقة لترتيب المنهج (${cumulative.length} حرفاً)`);
ok(true, 'كلمات الأمثلة كلها مفكوكة عند درسها');
// الألف وحدها بلا مثال (أول درس في الرحلة — لا كلمة ممكنة أصلاً)؛ التاء عولجت بإضافة «تَمْر» (إقرار المدير، ٢ أغسطس ٢٠٢٦)
ok(missingExample.join('') === 'ا', `بلا كلمة مثال (يُطوى العرض): ${missingExample.join('، ') || 'لا شيء'}`);

// ————— ٢. جولات «ميّز بأذنك» —————

let roundChecks = 0;
for (let seed = 1; seed <= 40; seed++) {
  const rnd = rng(seed);
  const acc = [];
  for (const g of GROUPS) {
    for (const letter of g.letters) {
      acc.push(letter);
      const studied = lettersThrough(g.id, letter);
      const rounds = buildRounds(studied, letter, rnd);
      // جولتان لا ثلاث (بوابةُ تصميم ع٢): سقفُ §٤ خمسُ جولاتٍ، وخطوةُ الحركات تأخذ ثلاثاً
      const expected = studied.length < 2 ? 0 : 2;
      if (rounds.length !== expected) {
        fails++;
        console.log(`  ✗ عدد الجولات عند «${letter}» = ${rounds.length} (المتوقع ${expected})`);
      }
      for (const r of rounds) {
        roundChecks++;
        const outside = r.options.filter((c) => !studied.includes(c));
        if (outside.length) {
          fails++;
          console.log(`  ✗ خيار غير مدروس عند «${letter}»: ${outside.join('،')}`);
        }
        if (!r.options.includes(r.target)) {
          fails++;
          console.log(`  ✗ الهدف «${r.target}» غائب عن خيارات درس «${letter}»`);
        }
        if (new Set(r.options).size !== r.options.length) {
          fails++;
          console.log(`  ✗ خيارات مكرّرة عند «${letter}»: ${r.options.join('،')}`);
        }
        const size = Math.min(3, studied.length);
        if (r.options.length !== size) {
          fails++;
          console.log(`  ✗ عدد الخيارات عند «${letter}» = ${r.options.length} (المتوقع ${size})`);
        }
        // **الفتحةُ وحدَها**: مفتاحُ هذا التمرين في `placement.skillKeys` حرفٌ بالفتحة،
        // فجولةٌ بغيرها تكتب مفتاحاً خارج الجرد المُعلَن (حكمُ المدير في بوابة ع٢).
        if (r.mark !== HARAKAT[0].mark) {
          fails++;
          console.log(`  ✗ جولة «${letter}» بغير الفتحة — مفتاحٌ خارج الجرد`);
        }
      }
      if (rounds.length && rounds[0].target !== letter) {
        fails++;
        console.log(`  ✗ الجولة الأولى في درس «${letter}» ليست على الحرف نفسه`);
      }
      // الثانيةُ **مراجعةٌ لحرفٍ سبقه** لا اقتراعٌ قد يقع على حرف الدرس مرّتين
      if (rounds.length > 1 && rounds[1].target === letter) {
        fails++;
        console.log(`  ✗ الجولة الثانية في درس «${letter}» على الحرف نفسه لا مراجعةً لما سبق`);
      }
    }
  }
}
ok(true, `جولات مفكوكة وصحيحة التركيب في ٤٠ بذرة عشوائية (${roundChecks} جولة)`);

// ————— ٢أ. تغطيةُ المفاتيح المضمونة: العددُ لا يكفي —————
//
// **المحروسُ أن يبلغ كلُّ حرفٍ في الرحلة مفتاحَه المُعلَن** (الحرفُ بالفتحة) في درسٍ من
// دروسها، **في كل بذرةٍ على حدة** لا في مجموعها — فعشوائيةٌ تُضيّع مفتاحاً تُسقِط هذا
// السطر. وأوّلُ حروف الرحلة لا جولةَ في درسه (حرفٌ واحدٌ مدروس لا مشتّتَ له)، فيبلغه
// درسُ ثانيها بجولة المراجعة. وهو نظيرُ `test_measure` في بابه: يحرس **الغياب**.
const wanted = GROUPS.flatMap((g) => g.letters);
let worst = '';
for (let seed = 1; seed <= 40 && !worst; seed++) {
  const rnd = rng(seed);
  const covered = new Set();
  for (const g of GROUPS) {
    for (const letter of g.letters) {
      for (const r of buildRounds(lettersThrough(g.id, letter), letter, rnd)) {
        if (r.mark === HARAKAT[0].mark) covered.add(r.target);
      }
    }
  }
  const missed = wanted.filter((l) => !covered.has(l));
  if (missed.length) worst = `[بذرة ${seed}] بلا قياس: ${missed.join('، ')}`;
}
ok(!worst, `وكلُّ حروف الرحلة (${wanted.length}) تبلغ مفتاحَها المُعلَن في كل بذرة${worst ? ' — ' + worst : ''}`);

// الحالة الحدّية: أول درس في الرحلة (حرف واحد مدروس) تُطوى فيه خطوة التمييز
ok(buildRounds(['ا'], 'ا').length === 0, 'أول درس: لا جولات تمييز (لا مشتّت مدروس بعد)');
ok(buildRounds(['ا', 'ب'], 'ب').every((r) => r.options.length === 2), 'حرفان مدروسان ⇒ خياران لا ثلاثة');

// ————— ٣. النجوم والتلوين —————

ok(starsForErrors(0) === 3 && starsForErrors(1) === 2 && starsForErrors(2) === 1 && starsForErrors(9) === 1,
  'النجوم: ٣ بلا خطأ، ٢ بخطأ، ١ بأكثر');

ok(clusters('بَابْ').join('|') === 'بَ|ا|بْ', 'تقطيع الحروف بحركاتها لتلوين الحرف داخل الكلمة');
ok(clusters('مَا').filter((c) => c[0] === 'م').length === 1, 'الحرف المستهدف يُلتقط مرة واحدة في «مَا»');

// ————— ٤. رسمُ الحرف مع حركته: الألفُ بالهمزة (الحكم ب٩) —————

const alef = HARAKAT.map((k) => harakaText('ا', k.mark));
ok(alef.join(' ') === 'أَ إِ أُ', `بطاقاتُ الألف تُرسم بالهمزة: ${alef.join(' ')}`);
ok(HARAKAT.every((k) => harakaText('ب', k.mark) === 'ب' + k.mark)
  && harakaText('ا', SUKUN) === 'ا' + SUKUN,
  'ولا يمسّ الرسمُ سواها — ولا الألفَ الساكنة (حرفُ مدٍّ لا نطقَ له مفرداً)');

// **صفرُ إضافةٍ صوتية**: النصوص الثلاثة لها ملفاتُها المولَّدة (المفتاح نصُّه).
const manifest = JSON.parse(readFileSync(new URL('../app/audio/manifest.json', import.meta.url), 'utf8'));
const queue = JSON.parse(readFileSync(new URL('audio_queue.json', import.meta.url), 'utf8'));
const have = new Set(Object.values(manifest));
const waiting = new Set(queue.filter((e) => e.status !== 'done').map((e) => e.text));
ok(alef.every((t) => have.has(t)),
  `ولكلٍّ ملفُّه الجاهز — لا توليدَ ولا نسخ (${alef.filter((t) => !have.has(t)).join('،') || 'الثلاثة'})`);
ok(alef.every((t) => !waiting.has(t)), 'ولا واحدٌ منها في قائمة الانتظار الصوتية');

// ————— ٥. خطوة الحركات: الفتحةُ أولاً ثم عشوائية (الحكم ج٨) —————

const items = HARAKAT.map((k) => ({ ...k, text: harakaText('ب', k.mark) }));
const rnd = rng(7);
const orders = Array.from({ length: 60 }, () => harakaRounds(items, rnd));
ok(orders.every((o) => o[0].key === 'fatha'),
  'أولُ سؤالٍ في خطوة الحركات على الفتحة دائماً (§٥.١)');
// **والثلاثُ مضمونةٌ في كل تشغيل** لا في مجموع التشغيلات (حكمُ المدير على تسليم ع١):
// درسُ الحرف يُعلن مفاتيحَه الثلاثة وتمتحن بها بوابةُ اللحاق، فاقتراعٌ يُضيّع واحدةً
// يفتح ما لا يُقاس — وهو عينُ العيب الذي أمسكه حارسُ الوعد (٥٦ مفتاحاً).
ok(orders.every((o) => new Set(o.map((k) => k.key)).size === HARAKAT.length),
  `والحركاتُ الثلاث مضمونةٌ في كل سؤالٍ من ${HARAKAT.length} (${orders.length} تشغيلاً)`);
ok(new Set(orders.map((o) => o.map((k) => k.key).join('|'))).size > 1,
  'وترتيبُ الأخريين مقترَعٌ فلا يُحفَظ الجوابُ بالترتيب («ثم عشوائية» — الحكم ج٨)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات درس الحرف ناجحة');
process.exit(fails ? 1 : 0);
