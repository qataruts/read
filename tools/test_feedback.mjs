// حارسُ «بلِّغنا» (أمر المالك، ١٥ أغسطس ٢٠٢٦):
//   node tools/test_feedback.mjs
// المحروسُ ثلاثة: البابُ في قسم وليّ الأمر وحدَه (لا زرَّ في شاشة طفل)،
// والقناتان واتساب بالرقم المعتمد وبريدُ العائلة المرجع، وصفرُ شبكةٍ من
// التطبيق نفسِه (روابطُ `<a>` تُفتح ولا تُجلَب — لا fetch جديد).

import { readFileSync, readdirSync } from 'node:fs';
const APP = new URL('../app/', import.meta.url);
const read = (p) => readFileSync(new URL(p, APP), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };

const parent = read('js/parent.js');
ok(parent.includes('wa.me/97433882806'), 'واتساب بالرقم المعتمد (+974 3388 2806)');
ok(parent.includes('mailto:info@mishkat.qa'), 'والبريدُ المرجع info@mishkat.qa');
ok(/feedbackSection/.test(parent) && parent.includes('بلِّغنا'), 'وقسمُ «بلِّغنا» في اللوحة');
ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(parent.slice(parent.indexOf('function feedbackSection'))
  .split('\nexport ')[0]), 'والقسمُ لا يعرف الشبكة — روابطُ فتحٍ لا جلب');

// لا ذكرَ لواتساب في وحدات شاشات الطفل — البابُ للراشد وحدَه
for (const mod of readdirSync(new URL('js/', APP))) {
  if (mod === 'parent.js') continue;
  ok(!read(`js/${mod}`).includes('wa.me'), `js/${mod}: لا بابَ بلاغٍ في شاشة طفل`);
}
console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «بلِّغنا» ناجحة');
process.exit(fails ? 1 : 0);
