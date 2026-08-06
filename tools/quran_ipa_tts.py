#!/usr/bin/env python3
"""تجربةُ صوتِ كلمات الآيات من **الرسم الصوتيّ** (أمر المالك، ٥ أغسطس ٢٠٢٦).

    python3 tools/quran_ipa_tts.py --plan          # المطابقة والتغطية (بلا شبكة)
    python3 tools/quran_ipa_tts.py --generate      # يولّد إلى scratch/quran_ipa/wbw
    python3 tools/quran_ipa_tts.py --page          # صفحةُ سماعٍ للمالك
    python3 tools/quran_ipa_tts.py --install       # ينسخها إلى app/audio بوسم wbw-
    python3 tools/quran_ipa_tts.py --uninstall     # وينزعها فتعود المحطة صامتة
    python3 tools/quran_ipa_tts.py --self-test     # بلا شبكة ولا ملفات

**الغرض**: محطةُ «كلمات السورة» تعمل صامتةً منذ أن أُغلقت بوّابةُ ترخيص تلاوة
الكلمة (`fetch_word_recitation.py`) — لا نصَّ ترخيصٍ منشوراً في المصدرين. فأمر
المالك بتجربةِ توليدها من **الرسم الصوتيّ** الذي حلّله مشروعُ `quran/`.

**وحكمُ المالك عليها (٧ أغسطس ٢٠٢٦): جيدةٌ ولا تُنشر** — محفوظةٌ في
`archive/quran_ipa_words/` لجلسةٍ تُفرد لها، و`--install` بابُها متى أُذن.

**وهي تعبر قاعدتين قائمتين، فتُبنى معزولةً بأمرَي تركيبٍ ونزع**:
1. «نصُّ المصحف لا يُنطق آلياً أبداً» (METHOD §٥.٦) — ويخفّفها أنّ المولّد **لا يرى
   رسمَ المصحف**: يُرسَل إليه `/ʔalːaːh/` لا نصٌّ قرآنيّ، فهو نُطقُ نسخٍ صوتيّ.
2. «ثلاثةُ أنسابٍ لا رابعَ لها» — وUmbriel صوتٌ رابع.
لذلك **لا تدخل `app/audio` إلا بأمر `--install` بعد سماع المالك**، و`--uninstall`
يعيد الحال كما كان بلا أثر. والحكمُ حكمُه لا حكمَ هذه الأداة.

**والمطابقةُ بالموضع لا بالرسم** — انظر `ipa_table()`: الرسمُ أسقط ١٧ كلمة لاختلاف
طبعات المصحف في محارف الوقف، والموضعُ لا يحتمل خلافاً. ويبقى الرسمُ شاهدَ تحقّقٍ
يُطبع اختلافُه، وكلمةٌ بلا رسمٍ صوتيّ تُطبع ولا تُولَّد صامتةً.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_audio as gen  # noqa: E402

IPA_TSV = Path("/Volumes/data/new-projects/quran/build/ipa/quran-words.tsv")
WORK = gen.ROOT / "scratch" / "quran_ipa"
# **المخزنُ في `archive/` لا في `scratch/`** (قرار المالك، ٧ أغسطس ٢٠٢٦): سمع الـ٢٠٨
# فاستحسنها ووجد فيها ما ليس دقيقاً — «لا ننشر، نحتفظ بها لجلسةٍ خاصة بها». وكلاهما
# خارج المستودع، لكنّ `scratch/` يُمسح والأرشيفُ يبقى. انظر `archive/…/README.md`.
STORE = gen.ROOT / "archive" / "quran_ipa_words" / "wbw"
VOICE = "Umbriel"                 # اختيارُ المالك لهذه التجربة وحدَها
PREFIX = "wbw-"                   # نظيرُ `WORD_PREFIX` في `app/js/recitation.js`
SUKUN_VARIANTS = {"ۡ": "ْ", "۟": "", "۠": ""}

AYAT_TSV = IPA_TSV.parent / "quran-ayat.tsv"
TAJWEED = Path("/Volumes/data/new-projects/quran/research/qpc-hafs-tajweed.json")

# أسماءُ أحكام التجويد بالعربية — تُرسَل مسمّاةً لا برموزها
RULES_AR = {
    "ham_wasl": "همزةُ وصل", "hamzat_wasl": "همزةُ وصل",
    "laam_shamsiyah": "لامٌ شمسية تُدغَم",
    "madda_normal": "مدٌّ طبيعيّ حركتان", "madda_permissible": "مدٌّ جائز",
    "madda_necessary": "مدٌّ لازم ستُّ حركات", "madda_obligatory": "مدٌّ واجب أربعُ حركات",
    "ghunnah": "غنّة حركتان", "qalaqah": "قلقلة", "qalqalah": "قلقلة",
    "idgham_shafawi": "إدغامٌ شفويّ", "ikhafa": "إخفاء", "ikhafa_shafawi": "إخفاءٌ شفويّ",
    "idgham_ghunnah": "إدغامٌ بغنّة", "idgham_wo_ghunnah": "إدغامٌ بلا غنّة",
    "iqlab": "إقلاب", "idgham_mutajanisayn": "إدغامُ متجانسين",
    "idgham_mutaqaribayn": "إدغامُ متقاربين", "slnt": "حرفٌ لا يُنطق",
}


TAG = re.compile(r"<rule class=([a-z_]+)>(.*?)</rule>|([^<]+)", re.S)


def strip_marks(text: str) -> str:
    return "".join(c for c in normalize(text) if c not in "ًٌٍَُِّْٰۢۥۦ ")


def ayah_ipa() -> dict:
    """«سورة:آية» ← كلماتُ رسمِها الصوتيّ **موصولةً معربة**.

    **علّةُ «الله»** (أذن المالك، ٧ أغسطس ٢٠٢٦): جدولُ الكلمات يعطي الصورةَ
    **الموقوفة** (`bism` · `ʔalːaːh`) فلا إعرابَ فيها — وهو ما سمعه المالك «بلا
    تشكيل». وجدولُ الآيات يعطيها موصولةً معربة (`bismi` · `lːaːhi`)، وهي المطلوبة.
    """
    out = {}
    for line in AYAT_TSV.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            out[parts[0]] = parts[2].split()
    return out


def tajweed_rules() -> dict:
    """«سورة:آية» ← (رسمٌ مجرَّد ← أحكامُه) من بيان حفص الموسوم.

    **يُتتبَّع الحكمُ حرفاً حرفاً ثم يُقسَّم كلماتٍ**: الوسمُ يحمل فراغاً داخله
    (`<rule class=…>`) فالقسمةُ على الفراغ تمزّقه فتزيغ النسبة — كانت تُلصق «إخفاء»
    بـ«خَلَقَ» وحقُّها قلقلة.
    """
    if not TAJWEED.exists():
        return {}
    data = json.loads(TAJWEED.read_text(encoding="utf-8"))
    out = {}
    for key, rec in data.items():
        clean, cover = [], []
        for m in TAG.finditer(rec.get("text", "")):
            rule, inner, plain = m.group(1), m.group(2), m.group(3)
            chunk = inner if rule else (plain or "")
            clean.append(chunk)
            cover.extend([rule] * len(chunk))
        words, i, per = "".join(clean).split(" "), 0, {}
        for w in words:
            names = {cover[j] for j in range(i, min(i + len(w), len(cover))) if cover[j]}
            i += len(w) + 1
            bare = strip_marks(w)
            if bare and names:
                per.setdefault(bare, set()).update(names)
        out[key] = per
    return out


def isolated(word: str, connected: str) -> str:
    """الصورةُ المفردة: تُردّ همزةُ الوصل التي تسقط في الوصل.

    **علّةُ «الله» عينُها**: `ٱللَّهِ` في الوصل `/lːaːhi/` — تسقط همزتُها لأنّ ما قبلها
    يصلها («بِسمِ لّاهِ»). وكلمتُنا **تُعلَّم مفردةً** فتُبتدأ بها، والابتداءُ بساكنٍ
    محال. فتُردّ `ʔa` — والإعرابُ يبقى كما هو.
    """
    if word and word[0] in ("ٱ", "ا") and not connected.startswith("ʔ"):
        return "ʔa" + connected
    return connected


def style_for(word: str, drawn: str, rules: list) -> str:
    """تعليمةُ الكلمة القرآنية — رسمٌ وإعرابٌ وتجويدٌ معاً (حكم المالك، ٧ أغسطس)."""
    line = (f"رتّل هذه الكلمةَ القرآنية وحدَها، متأنّياً واضحَ المخارج، خاشعَ الصوت. "
            f"رسمُها {word}، ونطقُها /{drawn}/")
    if rules:
        line += f"، وأحكامُها: {' · '.join(rules)}"
    return line + ". لا تقرأ هذا الوصفَ ولا تذكر الأحكام — انطقِ الكلمةَ وحدَها: "


def normalize(text: str) -> str:
    """تطبيعُ محارف الوقف كي يلتقي رسمُ منهجنا برسم جدول الرسم الصوتيّ."""
    for a, b in SUKUN_VARIANTS.items():
        text = text.replace(a, b)
    return text


def our_words() -> list:
    """كلماتُ سور المرحلة من المنهج نفسِه — بـ`surahWords` لا بشقٍّ مستقلّ."""
    js = ("import { QURAN, surahWords } from './app/js/curriculum.js';"
          "const out=[];for(const s of QURAN.surahs)for(const w of surahWords(s))"
          "out.push({surah:s.number,ayah:w.ayah,pos:w.pos,text:w.text});"
          "console.log(JSON.stringify(out));")
    res = subprocess.run(["node", "--input-type=module", "-e", js],
                         cwd=gen.ROOT, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def ipa_table() -> dict:
    """(سورة، آية، ترتيب) ← (رسمُ الجدول، رسمُه الصوتيّ).

    **المطابقةُ بالموضع لا بالرسم**: جُرّب الرسمُ أولاً فسقطت به ١٧ كلمة — طبعاتُ
    المصحف تختلف في محارف الوقف والألف الخنجرية (`ٱلصِّرَٰطَ` · `ءَامَنُوا۟`)، وتطبيعُها
    مطاردةُ حالاتٍ لا تنتهي. أمّا الموضعُ فلا يحتمل خلافاً — ويبقى الرسمُ **شاهدَ
    تحقّقٍ** يُطبع اختلافُه ولا يُبنى عليه.
    """
    out = {}
    for line in IPA_TSV.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 4 and ":" in parts[0]:
            surah, ayah = parts[0].split(":")
            out[(int(surah), int(ayah), int(parts[1]) + 1)] = (parts[2], parts[3])
    return out


def plan() -> tuple:
    words, table = our_words(), ipa_table()
    ayat, taj = ayah_ipa(), tajweed_rules()
    seen, rows, missing, differ = set(), [], [], []
    for w in words:
        hit = table.get((w["surah"], w["ayah"], w["pos"]))
        if not hit:
            missing.append(w)
            continue
        theirs, pausal = hit
        if normalize(theirs) != normalize(w["text"]):
            differ.append((w, theirs))          # شاهدُ تحقّقٍ: يُطبع ولا يمنع
        if w["text"] in seen:
            continue
        seen.add(w["text"])
        key = f'{w["surah"]}:{w["ayah"]}'
        conn = ayat.get(key, [])
        drawn = isolated(w["text"], conn[w["pos"] - 1]) if w["pos"] <= len(conn) else pausal
        rules = sorted({RULES_AR.get(n, n)
                        for n in taj.get(key, {}).get(strip_marks(w["text"]), set())})
        rows.append({"text": w["text"], "ipa": drawn, "pausal": pausal, "rules": rules,
                     "key": PREFIX + gen.key_for(w["text"]),
                     "ref": f'{w["surah"]}:{w["ayah"]}:{w["pos"]}'})
    return rows, missing, len(words), differ


def cmd_plan(_args) -> int:
    rows, missing, total, differ = plan()
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "plan.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1),
                                    encoding="utf-8")
    print(f"كلماتُ سور المرحلة: {total} · فريدةٌ بالرسم: {len(rows)}")
    print(f"بلا رسمٍ صوتيّ: {len(missing)} · رسمُه يخالف رسمَ الجدول: {len(differ)}")
    for w, theirs in differ[:6]:
        print(f"   ≠ {w['surah']}:{w['ayah']}:{w['pos']} لنا «{w['text']}» ولهم «{theirs}»")
    for w in missing[:10]:
        print(f"   {w['surah']}:{w['ayah']}:{w['pos']} «{w['text']}»")
    for r in rows[:5]:
        print(f"   {r['text']:<16} /{r['ipa']}/  → {r['key']}.mp3")
    print(f"\nالخطة في {WORK / 'plan.json'}")
    return 1 if missing else 0


def cmd_generate(args) -> int:
    rows = plan()[0]
    STORE.mkdir(parents=True, exist_ok=True)
    todo = [r for r in rows if not (STORE / f"{r['key']}.mp3").exists()]
    print(f"يُولَّد {len(todo)} من {len(rows)} (الباقي موجود) · الصوت {VOICE}")
    gen.set_rpm(args.rpm)
    pool = gen.KeyPool(gen.read_keys(), VOICE)
    made = failed = 0
    for i, r in enumerate(todo, 1):
        for attempt in range(3):
            try:
                pcm, rate, _k = pool.call(
                    r["ipa"], style_for(r["text"], r["ipa"], r["rules"]), gen.MODEL_SENTENCE)
                p = STORE / f"{r['key']}.mp3"
                gen.pcm_to_mp3(pcm, rate, p)
                # حارسُ «قرأ الوصفَ بدل الكلمة»: كلمةٌ مفردةٌ لا تبلغ ثلاثَ ثوانٍ
                if gen.mp3_duration(p) > 3.2 and attempt < 2:
                    print(f"  ↻ {r['text']}: {gen.mp3_duration(p):.1f}ث — يُعاد")
                    continue
                made += 1
                print(f"  ✓ [{i}/{len(todo)}] {r['text']:<16} /{r['ipa']:<16}/ "
                      f"{gen.mp3_duration(p):.2f}ث")
                break
            except gen.QuotaExhausted:
                print("  ⏹ نفدت الحصة — يُستأنف لاحقاً")
                return 2
            except Exception as e:                       # noqa: BLE001
                # «حاول توليد نصّ» خطأٌ عارض في وضع الرسم الصوتيّ — يُعاد لا يُسقَط
                if attempt == 2:
                    failed += 1
                    print(f"  ✗ {r['text']}: {str(e)[:80]}", file=sys.stderr)
    print(f"\nوُلّد {made} · أخفق {failed} · المصروف {gen.usd_spent():.4f}$")
    return 0


def cmd_install(args) -> int:
    """نسخُ المولَّد إلى `app/audio` بوسم `wbw-` — **بأمر المالك بعد سماعه**."""
    files = sorted(STORE.glob(f"{PREFIX}*.mp3"))
    if not files:
        sys.exit("لا ملفات مولَّدة — شغّل --generate أولاً")
    for f in files:
        shutil.copy2(f, gen.OUT_DIR / f.name)
    print(f"رُكّب {len(files)} ملفاً في app/audio — والمحطةُ تنطق الآن.")
    print("للنزع: python3 tools/quran_ipa_tts.py --uninstall")
    return 0


def cmd_uninstall(_args) -> int:
    n = 0
    for f in sorted(gen.OUT_DIR.glob(f"{PREFIX}*.mp3")):
        f.unlink()
        n += 1
    print(f"نُزع {n} ملفاً — والمحطة عادت صامتةً كما كانت.")
    return 0


def cmd_page(_args) -> int:
    rows = [r for r in plan()[0] if (STORE / f"{r['key']}.mp3").exists()]
    cards = "".join(
        f'<tr><td class="w">{r["text"]}</td><td class="ipa">/{r["ipa"]}/</td>'
        f'<td class="ref">{r["ref"]}</td>'
        f'<td><button data-f="wbw/{r["key"]}.mp3">▶</button></td>'
        f'<td><button class="flag" data-t="{r["text"]}">⚑</button></td></tr>'
        for r in rows)
    html = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>كلمات الآيات من الرسم الصوتيّ</title><style>
body{font-family:"Noto Naskh Arabic","Geeza Pro",serif;background:#faf7f2;color:#241f1a;margin:0;padding:1.5rem}
h1{font-size:1.25rem} p{max-width:46rem;line-height:1.9;color:#5a4d3d;font-size:.9rem}
table{border-collapse:collapse;width:100%;max-width:46rem;background:#fff;border:1px solid #ddd2c2;border-radius:.6rem}
td{padding:.35rem .6rem;border-bottom:1px solid #eee6da}
.w{font-size:1.3rem} .ipa{font-family:system-ui;font-size:.8rem;color:#a07a4a}
.ref{font-family:system-ui;font-size:.7rem;color:#8a7a66}
button{font-family:inherit;cursor:pointer;border:1px solid #ddd2c2;border-radius:.45rem;background:#fdfaf4;padding:.2rem .6rem}
.flag.on{background:#c0392b;color:#fff} tr.playing{background:#eaf3ec}
footer{position:sticky;bottom:0;background:#241f1a;color:#fdfaf4;padding:.7rem 1.1rem;border-radius:.5rem;
 margin-top:1rem;max-width:46rem;font-family:system-ui;font-size:.85rem;display:flex;gap:1rem;align-items:center}
footer button{background:#fdfaf4}
</style></head><body>
<h1>كلمات الآيات — مولَّدةً من الرسم الصوتيّ (تجربة)</h1>
<p>الصوت <b>Umbriel</b> على <b>2.5-pro</b>، والمولّد <b>لا يرى رسمَ المصحف</b>: يُرسَل إليه
الرسمُ الصوتيّ وحدَه. <b>هذه ليست تلاوة</b> — بل نطقُ كلمةٍ مفردة لتعليم القراءة، ولا تدخل
التطبيقَ إلا بأمرك. اسمعْ وضَعْ ⚑ على ما لا يصلح.</p>
ROWS_TABLE
<footer><span id="n">لا بلاغات</span><button id="copy">انسخ البلاغات</button>
<button id="auto">▶ بالتتابع</button><span style="flex:1"></span><span id="c"></span></footer>
<script>
const bad=new Set(); let cur=null,auto=false,rowsEls=[];
const upd=()=>{document.getElementById('n').textContent=bad.size?bad.size+' بلاغاً':'لا بلاغات';};
function play(btn,then){const tr=btn.closest('tr');
 document.querySelectorAll('tr').forEach(x=>x.classList.remove('playing'));tr.classList.add('playing');
 if(cur)cur.pause();cur=new Audio(btn.dataset.f);cur.onended=()=>then&&then();cur.onerror=()=>then&&then();cur.play();}
document.addEventListener('click',(e)=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.f){auto=false;play(b);return;}
 if(b.dataset.t){bad.has(b.dataset.t)?bad.delete(b.dataset.t):bad.add(b.dataset.t);
  b.classList.toggle('on');upd();return;}
 if(b.id==='copy'){navigator.clipboard.writeText(JSON.stringify([...bad],null,1));
  b.textContent='نُسخت ✓';setTimeout(()=>b.textContent='انسخ البلاغات',1500);return;}
 if(b.id==='auto'){auto=!auto;b.textContent=auto?'⏸ أوقف':'▶ بالتتابع';
  rowsEls=[...document.querySelectorAll('button[data-f]')];
  const step=(i)=>{if(!auto||i>=rowsEls.length){auto=false;b.textContent='▶ بالتتابع';return;}
   play(rowsEls[i],()=>setTimeout(()=>step(i+1),250));};if(auto)step(0);}});
document.getElementById('c').textContent=document.querySelectorAll('button[data-f]').length+' كلمة';
</script></body></html>"""
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "index.html").write_text(
        html.replace("ROWS_TABLE", f"<table>{cards}</table>"), encoding="utf-8")
    print(f"الصفحة: {WORK / 'index.html'}  ({len(rows)} كلمة)")
    return 0


def self_test() -> int:
    ok_n = bad_n = 0

    def ok(cond, msg):
        nonlocal ok_n, bad_n
        print(("  ✓ " if cond else "  ✗ ") + msg)
        ok_n, bad_n = ok_n + bool(cond), bad_n + (not cond)

    ok(normalize("بِسۡمِ") == "بِسْمِ", "تطبيعُ سكون الجدول (U+06E1) إلى سكوننا (U+0652)")
    ok(normalize("بِسْمِ") == "بِسْمِ", "وسكونُنا يبقى كما هو")
    ok(PREFIX == "wbw-", "الوسمُ نظيرُ WORD_PREFIX في recitation.js")
    ok(VOICE == "Umbriel", "الصوتُ اختيارُ المالك لهذه التجربة")
    ok(not STORE.is_relative_to(gen.OUT_DIR) and "archive" in str(STORE),
       "والمخزنُ في archive خارج المستودع — لا يدخل التطبيق إلا بـ--install")
    ok(isolated("ٱللَّهِ", "lːaːhi") == "ʔalːaːhi",
       "همزةُ الوصل تُردّ في الكلمة المفردة (علّةُ «الله»)")
    ok(isolated("مَـٰلِكِ", "maːliki") == "maːliki",
       "وما لا همزةَ وصلٍ فيه يبقى كما هو")
    ok(AYAT_TSV.exists() and TAJWEED.exists(),
       "وجدولا الرسمِ الموصول وأحكامِ التجويد موجودان")
    ok(IPA_TSV.exists(), f"جدولُ الرسم الصوتيّ موجود ({IPA_TSV.name})")
    print(f"\n{ok_n}/{ok_n + bad_n} تحقّقاً ناجحاً")
    return 1 if bad_n else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="كلمات الآيات من الرسم الصوتيّ")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--page", action="store_true")
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--uninstall", action="store_true")
    ap.add_argument("--rpm", type=int, default=8)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if args.generate:
        return cmd_generate(args)
    if args.page:
        return cmd_page(args)
    if args.install:
        return cmd_install(args)
    if args.uninstall:
        return cmd_uninstall(args)
    return cmd_plan(args)


if __name__ == "__main__":
    sys.exit(main())
