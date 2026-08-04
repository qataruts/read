// حارس العلامة «اِقْرَأْ» (جلسة «الاسم والشعار»، ٨ أغسطس ٢٠٢٦):
//   node tools/test_brand.mjs
//
// المحروس خمسة، وكلها قراراتُ مالكٍ لا أذواق:
//   ١) **رسمُ العلامة واحدٌ ومشكولٌ بالكامل**، ومكتوبٌ في موضعين اثنين لا غير
//      (`BRAND` في `ui.js` تُصيِّر، و`icon.html` تلتقط) — ولا شاشةَ تكتبه بيدها.
//      والصفحةُ التعريفية ثالثةٌ معلَنة: بلا جافاسكربت، فتكتب علامتها نصّاً.
//   ٢) **الاسمُ القديم لا يظهر لمستعمِل**: صفر «المُعلِّم» في كل ما يقرؤه أحد على
//      شاشة (الشيفرة والبيان والصفحة) — ويبقى في السجلات (`docs/`، `CLAUDE.md`).
//   ٣) **خطُّ العلامة للعلامة وحدَها**: مضمَّنٌ محلياً، في قشرة عامل الخدمة،
//      ولا يطلبه في التنسيق إلا `.brand-word` — لا نصَّ قراءةٍ يُكتب به.
//   ٤) **الأيقونة مشكولةٌ في كل مقاس** (حكم المالك) وبخطّ العلامة نفسِه.
//   ٥) **الاستثناء المعلَن**: تسميةُ أيقونة الشاشة الرئيسة (`short_name` وأختُها
//      في `index.html`) **بلا شكل** — نصُّ نظامٍ لا علامتُنا (DESIGN §٦).

import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('app/', ROOT);
const read = (p, base = ROOT) => readFileSync(new URL(p, base), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const { BRAND } = await import(new URL('js/ui.js', APP));
const ui = read('js/ui.js', APP);   // بنيةُ المُصيِّر تُقرأ من مصدره: لا DOM في node

const MARK = 'اِقْرَأْ';          // الرسم المعتمد حرفاً حرفاً (قرار المالك ٧ أغسطس ٢٠٢٦)
const PLAIN = 'اقرأ';
const OLD = 'المُعلِّم';
const HARAKAT = /[ً-ْ]/;

// ————— ١. رسمُ العلامة: واحدٌ، مشكولٌ، ولا يُكتب في شاشة —————

console.log('\n١. رسم العلامة');
ok(BRAND === MARK, `BRAND هو الرسم المشكول «${MARK}» (وجد: «${BRAND}»)`);
ok([...BRAND].filter((c) => HARAKAT.test(c)).length === 4,
  'العلامة مشكولةٌ بالكامل: أربع حركات (كسرة · سكون · فتحة · سكون)');
ok(BRAND.replace(HARAKAT, '').replace(/[ً-ْ]/g, '') === PLAIN,
  'ونزعُ حركاتها يعطي الاسم «اقرأ» بعينه — لا حرفَ زائد ولا ناقص');

const maker = ui.slice(ui.indexOf('export function brandMark'));
ok(/export function brandMark\(tag = 'span'\)/.test(maker), 'brandMark(tag) — ووسمُه يُطلب من نداءه');
ok(/h\(tag, \{ class: 'brand' \}/.test(maker), 'يبني صندوق `.brand`');
ok(/class: 'brand-word' \}, BRAND\)/.test(maker), 'وفيه الكلمةُ من `BRAND` لا مكتوبةً ثانيةً');
ok(/mascot\('brand-bird'\)/.test(maker), 'ونوري معها (التركيب ١ — «نوري على الألف»)');

// الشاشات لا تكتب الرسم بيدها — كما لا تكتب صورةَ رمزٍ بيدها (test_emoji §٤).
// و**المحروس رسمُ العلامة لا ذكرُ الاسم**: جملةٌ تسمّي التطبيق ليست علامةً تُرسَم،
// فلها موضعان معلَنان أدناه — وما عداهما يجب أن يمرّ بالمُصيِّر.
const SCREENS = ['js/main.js', 'js/lesson.js', 'js/review.js', 'js/parent.js', 'js/quran.js',
  'js/words.js', 'js/story.js', 'js/garden.js', 'js/ladder.js', 'js/skill.js', 'js/gate.js',
  'js/contrast.js', 'js/screens.js', 'js/library.js', 'js/progress.js', 'index.html'];
const NAMED = {
  'js/progress.js': 'رسالةُ استيراد نسخةٍ ليست منّا — جملةٌ تسمّي التطبيق',
  'index.html': 'عنوانُ الصفحة ووصفُها — نصُّ ترويسةٍ يقرؤه محرّكُ بحث',
  // **مُشاكَلةٌ لا تسميةٌ** (حزمة المكتبة، ١٢ أغسطس ٢٠٢٦): وسمُ زرّ التسجيل في
  // رفّ المكتبة «اِقْرَأْ لِأُمِّكْ» — **فعلُ أمرٍ** رسمُه رسمُ العلامة ومعناه غيرُه.
  // ولا يُصيَّر بـ`brandMark()` لأنه ليس علامةً تُرسَم بل خطابٌ للطفل، ولا يُبدَّل
  // شكلُه لأنّ المدير أقرّه بحرفه. فيُعلَن هنا بعلّته لا يُستثنى صامتاً.
  'js/story.js': 'وسمُ «اِقْرَأْ لِأُمِّكْ» — فعلُ أمرٍ يُشاكل رسمَ العلامة ولا يسمّي التطبيق',
};
for (const f of SCREENS) {
  const has = read(f, APP).includes(MARK);
  ok(!has || f in NAMED, has
    ? `${f}: يذكر الاسم بموضعٍ معلَن — ${NAMED[f] ?? '؟'}`
    : `${f}: لا يكتب رسمَ العلامة بيده — يستورد brandMark()`);
}
ok(read('js/main.js', APP).includes('brandMark'), 'ترويسةُ الخريطة تستورد المُصيِّر');

// ————— ٢. الاسمُ القديم لا يظهر لمستعمِل —————

console.log('\n٢. الاسم على الشاشة');
const FACING = ['index.html', 'manifest.webmanifest', 'welcome/index.html',
  ...SCREENS.filter((f) => f.endsWith('.js'))];
for (const f of FACING) ok(!read(f, APP).includes(OLD), `${f}: صفر «${OLD}»`);

const manifest = JSON.parse(read('manifest.webmanifest', APP));
ok(manifest.name.startsWith(MARK), 'البيان: name يبدأ بالعلامة المشكولة');
ok(manifest.description.startsWith(`${MARK} — يعلّم طفلك قراءة العربية، من الحرف الأول إلى القرآن`),
  'والوصفُ نصُّ المالك حرفاً بحرف');
ok(read('index.html', APP).includes(`<title>${MARK}`), 'عنوان الصفحة بالعلامة المشكولة');

// ————— ٣. خطُّ العلامة للعلامة وحدَها —————

console.log('\n٣. خطّ العلامة');
const css = read('css/app.css', APP);
const sw = read('sw.js', APP);
ok(/@font-face\s*{[^}]*Marhey[^}]*Marhey-arabic\.woff2/s.test(css), 'مضمَّنٌ محلياً في app.css (لا شبكة)');
ok(sw.includes("'fonts/Marhey-arabic.woff2'"), 'وفي قشرة عامل الخدمة — فيعمل دون إنترنت');
ok(/--font-brand:\s*'Marhey'/.test(css), 'و`--font-brand` معرَّفٌ في اللوح');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // بلا تعليقات: المطلوب المُنتقي لا شرحُه
const users = [...bare.matchAll(/([^{}]+)\{[^}]*var\(--font-brand\)[^}]*\}/g)]
  .map((m) => m[1].trim()).filter((s) => !s.startsWith(':root'));
ok(users.length === 1 && users[0] === '.brand-word',
  `ولا يطلبه إلا \`.brand-word\` (وجد: ${users.join(' · ') || 'لا أحد'})`);
ok(!/--font-letter:[^;]*Marhey/.test(css) && !/--font-ui:[^;]*Marhey/.test(css),
  'ولا يتسرّب إلى خطّ القراءة ولا خطّ الواجهة');
ok(/\.brand-word\s*{[^}]*letter-spacing:\s*normal/s.test(css),
  'وتباعدُ الحروف `normal` على الكلمة نفسِها — التباعد في العربية يكسر الوصل');

// ————— ٤. الأيقونة: مشكولةٌ في كل مقاس، بخطّ العلامة —————

console.log('\n٤. الأيقونة');
const icon = read('tools/icon.html');
ok(icon.includes(`textContent: '${MARK}'`), 'أيقونة PWA تُرسم بالعلامة المشكولة (حكم المالك)');
ok(icon.includes('Marhey-arabic.woff2') && /font-display:\s*block/.test(icon),
  'بخطّ العلامة نفسِه، و`font-display: block` فلا تُلتقط بخطٍّ احتياطيّ');
ok(icon.includes('fontBoundingBoxAscent') && icon.includes('--ink-lift'),
  'ورفعةُ حبرها مقيسةٌ لا مقدَّرة (نظير inkLift — DESIGN §٤)');
ok(read('tools/make_icons.py').includes('--virtual-time-budget'),
  'واللقطةُ تنتظر وصولَ الخطّ وإعادةَ القياس');

// ————— ٥. الاستثناء المعلَن: تسميةُ أيقونة الشاشة بلا شكل —————

console.log('\n٥. الاستثناء المعلَن');
ok(manifest.short_name === PLAIN, `short_name بلا شكل («${PLAIN}») — نصُّ نظامٍ لا علامتُنا`);
ok(read('index.html', APP).includes(`apple-mobile-web-app-title" content="${PLAIN}"`),
  'وتسميةُ أبل مثلُها');
ok(read('docs/DESIGN.md').includes('واستثناءٌ واحد معلَن'),
  'والاستثناءُ مكتوبٌ في الدستور لا في نيّة أحد');

console.log(fails ? `\n${fails} إخفاق` : '\nكل اختبارات العلامة «اِقْرَأْ» ناجحة');
process.exit(fails ? 1 : 0);
