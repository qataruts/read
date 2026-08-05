#!/usr/bin/env python3
"""توقيتُ كلمات السورة داخل تلاوة آيتها — **بلا ملفِّ صوتٍ جديد واحد**.

    python3 tools/fetch_word_timings.py --dry-run    # ما سيُكتب (بلا شبكة إن وُجد المخبأ)
    python3 tools/fetch_word_timings.py --write      # الجلب والتحقّق والكتابة
    python3 tools/fetch_word_timings.py --self-test  # فحصٌ ذاتيّ بلا شبكة

## لماذا هذا الطريق دون غيره

محطةُ «كلمات السورة» تعمل صامتةً منذ الحزمة ١٢: نقرةُ الكلمة لا تُسمع شيئاً (بلاغ
المالك، ١٣ أغسطس ٢٠٢٦). و`METHOD §٥.٦` يمنع النطق الآلي لنصّ المصحف منعاً باتّاً،
فلا حلَّ إلا تسجيلُ قارئ. وجُرّبت ثلاثة مصادر:

1. **مصادرُ كلمةٍ جاهزة** (QuranWBW · quran.com/wbw): صوتُ قارئٍ **غير الحصري** —
   فتصير المحطةُ الواحدة بصوتين، والطفلُ يميّز. مرفوض.
2. **واجهةُ Quran Foundation** (توقيتاتٌ للحصري، وهي متاحةٌ فيها): **مرفوضةٌ برخصتها
   لا بجودتها** — شروطُ مطوّريها تنصّ: «Cache or store QF Content longer than 1 week
   unless expressly permitted»، وتطبيقُنا يعمل دون إنترنت فيخزّن على جهاز الطفلة
   أبداً لا أسبوعاً؛ ومعها منعُ إعادة النشر، ورخصةٌ قابلةٌ للسحب. والقيدُ يسري على
   المجّانيّ كالتجاريّ. **والإسنادُ لا يشتري إذناً لم يُعطَ.**
3. **`quran-align`** (Collin Fair): توقيتاتٌ مولَّدةٌ آلياً **لملفات everyayah نفسِها**
   — أي لملفّ `Husary_64kbps` الذي نملكه حرفاً — وبياناتُها **CC BY 4.0**: نشرٌ حرّ
   بشرط الإسناد، فتوافق عملَنا (ونظيرُها عندنا Twemoji). **وهذا المختار.**

## والنتيجة: صفرُ تنزيلٍ صوتيّ

لا يُجلب ملفُّ صوتٍ واحد. الآياتُ الـ٦٨ على الجهاز سلفاً، وهذا السكربت يكتب لكل
كلمةٍ **موضعَها داخل آيتها** (مفتاحُ الآية، ومن الملّي ثانية كذا إلى كذا)، فيشغّلها
`recitation.js` من الملف نفسِه. البيانُ كلُّه نحو عشرة كيلوبايت.

## والتحقّقُ شرطُ الكتابة لا زينةٌ بعدها

- بصمةُ ملفِّ التوقيت تُقابَل بالبصمة المعلَنة في `README` الإصدار (SHA-1).
- **كلُّ كلمةٍ يعرضها المنهج يجب أن يكون لها مقطعٌ** — وإلا لم يُكتب شيء.
- ومقطعُها يجب أن يقع **داخل آيةٍ نملك تلاوتها** — وإلا لم يُكتب شيء.
- وترتيبُ الكلمات مأخوذٌ من تقسيم تنزيل بالمسافات، وهو مصدرُ نصِّنا نفسُه
  (`tools/quran_source.txt`) — فالفهرسةُ تتقابل بالبناء لا بالحظّ.
"""

import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "app" / "data" / "recitations.json"
CREDITS = ROOT / "CREDITS.md"
CACHE = ROOT / "tools" / ".cache" / "quran-align-data.zip"

RELEASE = ("https://github.com/cpfair/quran-align/releases/download/"
           "release-2016-11-24/quran-align-data-2016-11-24.zip")
MEMBER = "Husary_64kbps.json"                 # اسمُ قارئنا كما في everyayah حرفاً
MEMBER_SHA1 = "8e7a24f66f98f176dfddf65b434643a6655c694d"   # المعلَنة في README الإصدار
CREDIT_TAG = "<!-- TIMINGS-CREDIT: quran-align -->"


def plan_words():
    """كلماتُ السور كما يشقّها المنهج — من عدّة الكلمة نفسِها (مصدرُ حقيقةٍ واحد)."""
    spec = importlib.util.spec_from_file_location(
        "fwr", ROOT / "tools" / "fetch_word_recitation.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, mod.plan(mod.surahs_from_curriculum())


def timing_data(offline: bool) -> dict:
    """`(سورة، آية) ← مقاطع` من بيان `quran-align`، ببصمةٍ مُتحقَّقة."""
    if CACHE.exists():
        blob = CACHE.read_bytes()
    elif offline:
        raise SystemExit(f"✗ لا مخبأ في {CACHE.relative_to(ROOT)} — شغّل بلا `--offline`")
    else:
        blob = urllib.request.urlopen(RELEASE, timeout=180).read()
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_bytes(blob)

    raw = zipfile.ZipFile(BytesIO(blob)).read(MEMBER)
    got = hashlib.sha1(raw).hexdigest()
    if got != MEMBER_SHA1:
        raise SystemExit(f"✗ بصمةُ {MEMBER} لا تطابق المعلَنة\n   جاءت {got}\n   والمعلَنة {MEMBER_SHA1}")
    return {(d["surah"], d["ayah"]): d["segments"] for d in json.loads(raw)}


def build(items, segments, ayah_key) -> tuple[dict, list]:
    """لكل كلمة: مفتاحُ آيتها وحدّا مقطعها. والنقصُ يُجمَع ولا يُتجاوَز."""
    spans, missing = {}, []
    for text, surah, ayah, pos in items:
        segs = segments.get((surah, ayah))
        key = ayah_key(surah, ayah)
        if segs is None or key is None:
            missing.append(f"{surah}:{ayah} «{text}» — لا توقيتَ لهذه الآية أو لا تلاوةَ عندنا")
            continue
        # فهرسةُ المصدر صفريّة ونصفُ مفتوحة [بداية، نهاية)؛ وموضعُنا واحديّ
        hit = [s for s in segs if s[0] <= pos - 1 < s[1]]
        if not hit:
            missing.append(f"{surah}:{ayah}:{pos} «{text}» — لا مقطعَ يخصّها")
            continue
        start, end = hit[0][2], hit[0][3]
        if end <= start:
            missing.append(f"{surah}:{ayah}:{pos} «{text}» — مقطعٌ غيرُ صالح ({start}→{end})")
            continue
        spans[key_of(text)] = {"a": key, "s": start, "e": end}
    return spans, missing


def key_of(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def ayah_key_map(manifest: dict):
    """مفتاحُ الآية عندنا = sha1 نصّها — يُقرأ من المنهج نفسِه لا يُكتب بيد.

    **والبسملةُ تُعَدّ آيةً في الفاتحة وحدها** (`basmalaIsAyah`)، وترقيمُ التوقيت
    يتبع المصحف — فلولا مراعاتُها لانزاح ترقيمُ آيات الفاتحة كلِّها بواحد.
    """
    js = ("import('file://%s').then(m => console.log(JSON.stringify("
          "m.QURAN.surahs.map(s => ({number: s.number, basmala: !!s.basmalaIsAyah, "
          "ayat: s.ayat})))))" % (ROOT / "app" / "js" / "curriculum.js"))
    out = subprocess.run(["node", "-e", js], check=True, capture_output=True, text=True).stdout
    index = {}
    for surah in json.loads(out):
        for i, ayah_text in enumerate(surah["ayat"], 1):
            index[(surah["number"], i)] = key_of(ayah_text)
    have = set(manifest.get("ayat") or {})
    return lambda s, a: index.get((s, a)) if index.get((s, a)) in have else None


def credited() -> bool:
    return CREDITS.exists() and CREDIT_TAG in CREDITS.read_text(encoding="utf-8")


def self_test() -> int:
    checks = [
        (MANIFEST.exists(), "بيانُ التلاوة موجود"),
        (MEMBER_SHA1 and len(MEMBER_SHA1) == 40, "بصمةُ ملفّ التوقيت معلَنةٌ في السكربت"),
        ("everyayah" in (ROOT / "tools" / "fetch_recitation.py").read_text(encoding="utf-8"),
         "وقارئُ الآيات من everyayah — وهو مصدرُ التوقيت نفسُه"),
        (credited(), f"والإسنادُ في CREDITS.md ({CREDIT_TAG})"),
    ]
    bad = [m for ok, m in checks if not ok]
    for ok, m in checks:
        print(("  ✓ " if ok else "  ✗ ") + m)
    print("\n" + ("عدّةُ توقيت الكلمات سليمة (بلا شبكة)." if not bad else f"{len(bad)} فشل"))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="توقيت كلمات السورة داخل تلاوة آيتها")
    ap.add_argument("--write", action="store_true", help="الكتابة في بيان التلاوة")
    ap.add_argument("--dry-run", action="store_true", help="العرض بلا كتابة")
    ap.add_argument("--offline", action="store_true", help="من المخبأ فقط")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    if args.write and not credited():
        print(f"✗ الإسنادُ يسبق الاستعمال: أضف {CREDIT_TAG} إلى CREDITS.md أولاً")
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    mod, items = plan_words()
    spans, missing = build(items, timing_data(args.offline), ayah_key_map(manifest))

    print(f"كلماتُ السور: {len(items)} · لها توقيتٌ صالح: {len(spans)} · ناقص: {len(missing)}")
    for m in missing[:8]:
        print("   ✗", m)
    if missing:
        print("\n✗ لم يُكتب شيء: كلمةٌ بلا توقيتٍ تعني نقرةً صامتة، ونصفُ إصلاحٍ أسوأ من لا شيء")
        return 1

    dur = sorted(v["e"] - v["s"] for v in spans.values())
    print(f"مدّةُ الكلمة: أقصر {dur[0]} م.ث · الوسيط {dur[len(dur)//2]} · أطول {dur[-1]}")

    if not args.write:
        print("\n(تجربةٌ جافّة — لم يُكتب شيء)")
        return 0

    manifest["spans"] = dict(sorted(spans.items()))
    manifest["spansSource"] = "quran-align (Collin Fair) — CC BY 4.0"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n✓ كُتب {len(spans)} توقيتاً في {MANIFEST.relative_to(ROOT)} — وصفرُ ملفِّ صوتٍ جديد")
    return 0


if __name__ == "__main__":
    sys.exit(main())
