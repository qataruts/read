// حارس مهمة «أيقونات لا إيموجي» (أمر المالك، ٧ أغسطس ٢٠٢٦):
//   node tools/test_emoji.mjs
//
// المحروس هنا أربعة، وكلها شروطُ قبولٍ لا زينة:
//   ١) **صفر إيموجي بخطّ النظام في شيفرة التطبيق**: لا محرفَ إيموجي في وحدة
//      جافاسكربت ولا صفحة ولا تنسيق — ولا في تعليقٍ حتى، فالقاعدة إمّا أن تكون
//      قابلةً للفحص آلياً أو لا تكون. والاستثناء الوحيد **ملفات البيانات**
//      (`curriculum.js` و`lexicon.json` و`stories/`): رمزُها بيانٌ يُصيَّر صورةً،
//      لا محرفٌ يُسلَّم إلى خطّ الجهاز.
//   ٢) **كل رمزٍ في البيانات له ملفُّ SVG** في `app/emoji/`، والفهرسُ يطابق القرص
//      (وهو نفسُ ما يفحصه `fetch_twemoji.py --check`، مقروءاً من الجهة الأخرى).
//   ٣) **الجهتان تحكمان حكماً واحداً**: قاعدةُ «ما هو رمزٌ مصوَّر» واسمُ ملفه
//      مكتوبتان مرّتين — في `app/js/ui.js` (تُصيِّر) وفي `tools/fetch_twemoji.py`
//      (تجلب). فتُقابَلان هنا على **كل** رمزٍ في البيانات وعلى محارفَ نصّية
//      متعمَّدة («۞» و«✦» و«★» و«ـَا»): لو انحرفت إحداهما ظهر الفرقُ فوراً.
//   ٤) **مُصيِّرٌ واحد لا مُصيِّرات**: لا شاشةَ تبني صورةَ رمزٍ بيدها — كلُّها تمرّ
//      بـ`faceEl`/`icon`، وكلُّ اسمِ أيقونةٍ تطلبه شاشةٌ موجودٌ في `ICONS`.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('app/', ROOT);
const read = (p, base = APP) => readFileSync(new URL(p, base), 'utf8');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

const { isEmoji, emojiSrc, ICON_NAMES } = await import(new URL('js/ui.js', APP));

// ————— ١. لا محرفَ إيموجي في شيفرة التطبيق —————

// ملفات البيانات: رمزُها بيانٌ مُراجَع في `docs/REVIEW_ICONS.md`، يُصيَّر صورةً.
const DATA = [/^js\/curriculum\.js$/, /^data\/lexicon\.json$/, /^data\/stories\//];
const CODE = /\.(js|html|css|webmanifest|json)$/;

const files = [];
const walk = (dir, prefix = '') => {
  for (const name of readdirSync(new URL(dir, APP))) {
    if (name.startsWith('.') || name === 'audio' || name === 'emoji') continue;
    const path = `${prefix}${name}`;
    try {
      walk(`${path}/`, `${path}/`);
    } catch {
      if (CODE.test(path)) files.push(path);
    }
  }
};
walk('./');

// المقطِّع نفسُه المكتوب في `fetch_twemoji.py`، مبنيّاً من قاعدة `ui.js` —
// فلا ثالثةَ تُصان: نأخذ كل مرشَّحٍ ونسأل `isEmoji` عنه.
const CANDIDATE = /(?:[\u{2190}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{3030}\u{303D}\u{00A9}\u{00AE}]\u{FE0F}?)(?:\u{200D}[\u{2190}-\u{2BFF}\u{1F000}-\u{1FAFF}]\u{FE0F}?)*/gu;
const glyphsIn = (text) => [...text.matchAll(CANDIDATE)].map((m) => m[0]).filter(isEmoji);

const codeFiles = files.filter((p) => !DATA.some((re) => re.test(p)));
const dirty = codeFiles
  .map((p) => [p, [...new Set(glyphsIn(read(p)))]])
  .filter(([, list]) => list.length);
ok(dirty.length === 0,
  `صفر إيموجي بخطّ النظام في شيفرة التطبيق (${codeFiles.length} ملفاً)`
  + (dirty.length ? ' — بقي: ' + dirty.map(([p, g]) => `${p} (${g.join('')})`).join('، ') : ''));

const welcome = read('welcome/index.html');
ok(glyphsIn(welcome).length === 0, 'ولا في الصفحة التعريفية (رموزُها `<img>` من app/emoji/)');
ok(/<img[^>]+src="\.\.\/emoji\//.test(welcome),
  'وهي تصل أيقونات التطبيق نفسِها (لا نسخةً ثانية تفترق عنها)');

// ————— ٢. كل رمزٍ في البيانات له ملفُّ SVG، والفهرس يطابق القرص —————

const dataFiles = files.filter((p) => DATA.some((re) => re.test(p)));
const dataGlyphs = [...new Set(dataFiles.flatMap((p) => glyphsIn(read(p))))];
ok(dataGlyphs.length > 250, `بيانات المنهج فيها ${dataGlyphs.length} رمزاً فريداً`);

const index = JSON.parse(read('emoji/index.json'));
const onDisk = new Set(readdirSync(new URL('emoji/', APP))
  .filter((n) => n.endsWith('.svg')).map((n) => n.slice(0, -4)));

const noFile = dataGlyphs.filter((g) => !existsSync(new URL(emojiSrc(g), APP)));
ok(noFile.length === 0,
  `ولكلٍّ ملفُّ SVG في app/emoji/ (${onDisk.size} ملفاً)`
  + (noFile.length ? ' — بلا ملف: ' + noFile.join('، ') : ''));

const indexed = Object.keys(index.files);
ok(indexed.length === onDisk.size && indexed.every((k) => onDisk.has(k)),
  `والفهرس يطابق القرص حرفاً بحرف (${indexed.length} مدخلاً)`);
ok(index.source === 'twemoji' && /^\d+\.\d+\.\d+$/.test(index.version) && index.license,
  `والفهرس يحمل مصدره ونسخته ورخصته (${index.source} ${index.version} · ${index.license})`);

const credits = read('CREDITS.md', ROOT);
ok(credits.includes('Twemoji') && credits.includes('CC-BY 4.0'),
  'والإسناد في CREDITS.md (رخصة CC-BY تفرضه)');

// كلُّ ملفٍّ على القرص SVG صحيحُ الفتح (تنزيلٌ مقطوع = مربّعٌ فارغ عند الطفل)
const broken = [...onDisk].filter((key) => {
  const svg = read(`emoji/${key}.svg`);
  return !svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>');
});
ok(broken.length === 0,
  `وكلُّها SVG تامّ الفتح والإغلاق${broken.length ? ' — مبتور: ' + broken.join('، ') : ''}`);

// ————— ٣. الجهتان (ui.js وfetch_twemoji.py) تحكمان حكماً واحداً —————

// محارفُ نصّية متعمَّدة في التطبيق: تُرسم بخطّ النصّ ولا تُطلَب من app/emoji/.
const TEXT_GLYPHS = ['۞', '✦', '★', '☆', '✓', '✗', '←', '→', '↻', '⋮', 'ـَا', 'ٱ', 'ب'];
ok(TEXT_GLYPHS.every((g) => !isEmoji(g)),
  `و«المحرف النصّي ليس رمزاً مصوَّراً» يصدق على ${TEXT_GLYPHS.length} محرفاً متعمَّداً`);
ok(dataGlyphs.every((g) => isEmoji(g)), 'و«رمزُ البيانات مصوَّرٌ» يصدق عليها كلها');

const probe = JSON.stringify([...dataGlyphs, ...TEXT_GLYPHS]);
const python = execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, 'tools')
import fetch_twemoji as ft
out = {}
for g in json.loads(sys.argv[1]):
    m = ft.GLYPH.fullmatch(g)
    out[g] = ft.key_of(g) if m else None
print(json.dumps(out, ensure_ascii=False))
`, probe], { cwd: new URL('.', ROOT), encoding: 'utf8' });
const fromPython = JSON.parse(python);

const split = Object.entries(fromPython).filter(([glyph, key]) => {
  const mine = isEmoji(glyph) ? emojiSrc(glyph).slice('emoji/'.length, -'.svg'.length) : null;
  return mine !== key;
});
ok(split.length === 0,
  `وحكمُ ui.js عينُ حكم fetch_twemoji.py على ${Object.keys(fromPython).length} رمزاً — `
  + 'صورةً كان أو نصّاً، وباسم الملف نفسِه'
  + (split.length ? ` — افترقا في: ${split.map(([g]) => g).join('، ')}` : ''));

// ————— ٤. مُصيِّرٌ واحد، وكلُّ اسمِ أيقونةٍ له رسمُه —————

const screens = files.filter((p) => p.startsWith('js/') && p !== 'js/curriculum.js'
  && p !== 'js/ui.js');
const handmade = screens.filter((p) => /emoji\/[^'"`]+\.svg|<img[^>]+emoji/.test(read(p)));
ok(handmade.length === 0,
  `لا شاشةَ تبني صورةَ رمزٍ بيدها — كلُّها تمرّ بـfaceEl (${screens.length} وحدة)`
  + (handmade.length ? ' — بنت: ' + handmade.join('، ') : ''));

const asked = [...new Set(screens.concat('js/ui.js')
  .flatMap((p) => [...read(p).matchAll(/\bicon\('([a-z]+)'/g)].map((m) => m[1])))];
const unknown = asked.filter((name) => !ICON_NAMES.includes(name));
ok(unknown.length === 0,
  `وكلُّ أيقونةٍ تطلبها شاشةٌ لها رسمُها في ICONS (${asked.length} من ${ICON_NAMES.length})`
  + (unknown.length ? ' — مجهولة: ' + unknown.join('، ') : ''));

const idle = ICON_NAMES.filter((name) => !asked.includes(name));
ok(idle.length === 0,
  `ولا رسمَ ميتاً في ICONS${idle.length ? ' — لا تطلبه شاشة: ' + idle.join('، ') : ''}`);

const ui = read('js/ui.js');
ok(/stroke="currentColor"/.test(ui) && !/fill="#/.test(ui.slice(ui.indexOf('const ICONS'))),
  'وأيقونات الواجهة خطٌّ يتبع لون نصّه (لا لونَ مكتوباً بقيمته — DESIGN §٢)');

console.log(fails ? `\n${fails} فشل` : '\nكل اختبارات «أيقونات لا إيموجي» ناجحة');
process.exit(fails ? 1 : 0);
