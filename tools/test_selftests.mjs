// حارسُ الحرّاس — «فحصٌ لا يُشغَّل ليس حارساً» (أمر المالك، ١٢ أغسطس ٢٠٢٦):
//   node tools/test_selftests.mjs
//
// **العلّة، وقد تكرّرت ثلاثاً**: الأداةُ تُكتب ومعها `--self-test` يفحص نفسَه، ثم
// لا يُشغّله أحد — فيرثّ صامتاً كلما تحرّكت البيانات تحته، ولا يُفشِل شيئاً.
//   • `make_stories.py` — كشفته حزمةُ الأنبياء (١١ أغسطس): كلمةٌ معلَنةٌ مرّتين
//     عاشت حمراءَ من `52fae70` حتى صادفتها الجلسة.
//   • `check_lexicon.py` — كشفته حزمةُ المكتبة (١٢ أغسطس): **تسع عشرة شكوى**،
//     لأنّ حدودَ حجم المنظومة أُضيفت إليه بعد كتابته.
//   • `check_decodable.py` — كشفه هذا الحارسُ نفسُه ساعةَ كُتب: `== 4` سورةً
//     مكتوبةً بيد، انكسرت يومَ صارت السورُ اثنتي عشرة.
//
// فالعلاجُ **يقلب القاعدة**: لا يُنتظَر أن يصادف أحدٌ الحمرة، بل **يُجرَد كلُّ ما
// في `tools/` من `--self-test` ويُشغَّل هنا** — وهذا الملفُّ من السَّوقة، فما وُجد
// بالجرد دخلها. وأداةٌ جديدة تُكتب غداً بفحصٍ ذاتيّ رثٍّ **تُسقِط هذا الحارسَ يومَ
// تُكتب** لا بعد ثلاث حزم — بلا سطرٍ يُضاف ولا انتباهٍ يُرجى.
//
// **ومُجرَّبٌ ساعةَ كُتب**: أمسك ثلاثةً خارج السَّوقة، وفيها `check_decodable.py`
// أحمرُ بحقّ (ثبَّتُّه على `HEAD~1` قبل أن أنسبه لنفسي) — فأُصلح وصار الخمسةُ خضراً.
//
// وهو نظيرُ `test_measure.mjs` في بابه: ذاك يسأل «أيّ محطةٍ تُدرَّس بلا قياس؟»
// وهذا يسأل «أيّ فحصٍ يملكه المشروع ولا يراه أحد؟» — وكلاهما يحرس **الغياب**.

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOLS = new URL('./', import.meta.url);
const src = (name) => readFileSync(new URL(name, TOOLS), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const files = readdirSync(TOOLS).filter((f) => f.endsWith('.py') || f.endsWith('.mjs')).sort();
const SUITE = files.filter((f) => f.startsWith('test_') && f.endsWith('.mjs'));

// ————— ١) الجرد: أيُّ أداةٍ تُعلن `--self-test`؟ —————
//
// **الإعلانُ لا الذِّكر**: البحثُ عن `add_argument("--self-test")` في بايثون و
// `argv.includes('--self-test')` في جافاسكربت — لا عن السلسلة أينما وقعت، وإلا
// عُدّت كلُّ وثيقةٍ تذكر الراية أداةً (`review_b2.mjs` يذكرها في نصّ ورقة).
const DECLARES = [
  /add_argument\(\s*["']--self-test["']/,          // argparse
  /argv\.includes\(\s*['"]--self-test['"]\s*\)/,   // node
];
const tools = files.filter((f) => !f.startsWith('test_') && DECLARES.some((re) => re.test(src(f))));

console.log('\n— الجرد: أدواتٌ تُعلن فحصاً ذاتياً —');
ok(tools.length > 0, `أدواتٌ لها \`--self-test\`: ${tools.length} (${tools.join('، ')})`);

// ————— ٢) تغطيةُ الحارس المختصّ — تقريرٌ لا مطالبة —————
//
// **ولِمَ تقريرٌ لا مطالبة؟** لأنّ المطالبةَ استوفاها §٣ أدناه: هذا الملفُّ نفسُه من
// السَّوقة (`tools/test_*.mjs`)، وهو **يشغّل الفحوصَ كلَّها**، فما عاد فحصٌ ذاتيّ
// يُمكن أن يرثّ صامتاً. وما يُذكَر هنا زيادةُ إحسان: أن يشغّله **حارسُ بابه** كذلك
// (`test_stories.mjs` يشغّل مولّدَ القصص) فيُقرأ إخفاقُه في سياقه لا مفرداً.
// وإلزامُ ذلك على كل أداةٍ تكلُّفٌ لم يُطلَب — والغرضُ أن تُشغَّل، وقد شُغِّلت.
console.log('\n— تغطيةُ الحارس المختصّ (تقريرٌ لا مطالبة: §٣ هو الإلزام) —');
const runners = new Map();
for (const suite of SUITE) {
  const text = src(suite);
  for (const tool of tools) {
    // الاستدعاء: اسمُ الأداة والرايةُ في المدى نفسِه من النصّ (جدولُ استدعاءٍ أو سطر)
    const hit = [...text.matchAll(new RegExp(tool.replace('.', '\\.'), 'g'))].some((m) => {
      const around = text.slice(Math.max(0, m.index - 200), m.index + 200);
      return around.includes('--self-test') && /spawnSync|execFileSync|spawn\(/.test(text);
    });
    if (hit) runners.set(tool, [...(runners.get(tool) || []), suite]);
  }
}
const SELF = 'test_selftests.mjs';   // لا يُعدّ نفسَه تغطيةً مختصّة
for (const tool of tools) {
  const where = (runners.get(tool) || []).filter((f) => f !== SELF);
  console.log(where.length
    ? `  · ${tool} — يشغّله أيضاً ${where.join('، ')}`
    : `  · ${tool} — لا حارسَ مختصّ يشغّله (يكفيه هذا الحارس)`);
}

// ————— ٣) الإلزام: كلُّ فحصٍ ذاتيّ يُشغَّل هنا، ويلزمه الأخضر —————
//
// **وهذا هو موضعُ العهد**: بجرد `tools/` وتشغيلِ ما وُجد، تدخل الأداةُ الجديدة
// السَّوقةَ **يومَ تُكتب** بلا سطرٍ يُضاف ولا انتباهٍ يُرجى — فالجردُ يجدها.
console.log('\n— الإلزام: تُشغَّل كلُّها، ويلزمها الأخضر —');
for (const tool of tools) {
  const isPy = tool.endsWith('.py');
  const run = spawnSync(isPy ? 'python3' : 'node',
    [fileURLToPath(new URL(tool, TOOLS)), '--self-test'], { encoding: 'utf8' });
  const bad = (run.stdout || '').split('\n').filter((l) => l.includes('✗')).slice(0, 3);
  ok(run.status === 0, `\`${tool} --self-test\` أخضر`
    + (run.status === 0 ? '' : `\n${bad.join('\n') || (run.stderr || '').slice(0, 300)}`));
}

console.log(fails ? `\n${fails} فشل` : '\nكل الفحوص الذاتية مجرودةٌ ومُشغَّلةٌ وخضراء');
process.exit(fails ? 1 : 0);
