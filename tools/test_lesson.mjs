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
  buildRounds, harakaTarget, starsForErrors, clusters,
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
      const expected = studied.length < 2 ? 0 : 3;
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
        if (!'َُِ'.includes(r.mark)) {
          fails++;
          console.log(`  ✗ حركة غير معروفة في جولة «${letter}»`);
        }
      }
      if (rounds.length && rounds[0].target !== letter) {
        fails++;
        console.log(`  ✗ الجولة الأولى في درس «${letter}» ليست على الحرف نفسه`);
      }
    }
  }
}
ok(true, `جولات مفكوكة وصحيحة التركيب في ٤٠ بذرة عشوائية (${roundChecks} جولة)`);

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
ok(harakaTarget(0, items).key === 'fatha', 'أولُ سؤالٍ في خطوة الحركات على الفتحة دائماً (§٥.١)');
const rnd = rng(7);
const later = new Set(Array.from({ length: 60 }, (_, i) => harakaTarget(1 + i, items, rnd).key));
ok(later.size === HARAKAT.length,
  `وما بعدها عشوائيّ يبلغ الحركات الثلاث (${[...later].join('، ')})`);

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات درس الحرف ناجحة');
process.exit(fails ? 1 : 0);
