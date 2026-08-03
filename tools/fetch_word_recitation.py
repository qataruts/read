#!/usr/bin/env python3
"""جلب تلاوة **الكلمة المفردة** لمحطات «كلمات السورة» — بلا أي مولّد ولا حصة TTS.

    python3 tools/fetch_word_recitation.py --sources             # المصادر وحال ترخيص كلٍّ
    python3 tools/fetch_word_recitation.py --dry-run             # ما سيُجلب ومن أين (بلا شبكة)
    python3 tools/fetch_word_recitation.py --sync-only           # إعادة بناء البيان بلا شبكة
    python3 tools/fetch_word_recitation.py --source <id> --approve-license   # الجلب الفعلي

`METHOD §٥.٦`: صوت نصّ المصحف من تسجيل قارئ متقن لا من مولّد — والكلمةُ المفردة
نصُّ مصحفٍ كالآية (`quranWordTexts()` في المنهج تُعلنها). فهذا السكربت نظيرُ
`tools/fetch_recitation.py` للكلمة: يجلب ملفاً لكل كلمةٍ فريدة في السور الأربع،
باسمِ مفتاح نصّها **موسوماً بـ`wbw-`** في `app/audio/`، ويكتب بيانَه في
`app/data/recitations.json` تحت `words` — **خارج `app/audio/manifest.json` أبداً**.

## بوّابة الترخيص — الجلب مقفلٌ حتى يُقِرّ إنسان

بند الحزمة ١٢/٣ نصّ على «تحقّق ترخيص كل مصدر قبل اعتماده وتوثيقه في CREDITS.md».
فالجلب هنا **لا يعمل** حتى يجتمع شرطان (لا يخمّن السكربت ترخيصاً ولا يفترضه):

1. `--approve-license` صراحةً على سطر الأمر — إقرارُ إنسانٍ قرأ رخصة المصدر.
2. وسمُ المصدر موجودٌ في `CREDITS.md` (`<!-- WBW-CREDIT: <id> -->`) — فالإسناد
   يسبق الاستعمال لا يتبعه.

وحتى ذلك الحين تعمل المحطة صامتةً: `recitation.js` لا ينوب عن القارئ بمولّد ولا
بنطق آلي، وغيابُ الملف صمتٌ (كما كانت شاشات السور قبل جلب تلاوتها).
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "app" / "js" / "curriculum.js"
CREDITS = ROOT / "CREDITS.md"
OUT_DIR = ROOT / "app" / "audio"
RECORD = ROOT / "tools" / "word_recitations.json"
APP_MANIFEST = ROOT / "app" / "data" / "recitations.json"

MIN_BYTES = 800          # الكلمة أقصر من الآية بكثير — لكنّ ملفاً دون هذا ليس صوتاً

# وسمُ ملفات الكلمة (نظيرُه `WORD_PREFIX` في `app/js/recitation.js`): الكلمة المفردة قد
# تطابق حرفياً كلمةً عربية عادية لها ملفٌّ مولَّد بحقّ («مَا» في سلّم الجمل)، والمفتاح من
# النصّ — فلولا الوسم لكتب هذا السكربتُ تلاوةً فوق ملفٍّ مولَّد أو العكس.
WORD_PREFIX = "wbw-"

# المصادر المرشَّحة كما وردت في بند الحزمة ١٢/٣. **`license` حقلُ تحقُّقٍ بشريّ**:
# لا يملؤه السكربت ولا يستنتجه — يملؤه مَن قرأ صفحة الترخيص، ويوثّقه في CREDITS.md.
# و`path(surah, ayah, pos)` يبني اسم الملف عند المصدر (ترقيم سورة_آية_كلمة).
SOURCES = {
    "quranwbw": {
        "name": "QuranWBW",
        "home": "https://quranwbw.com/",
        "base": "https://audios.quranwbw.com/words",
        "path": lambda s, a, w: f"{s:03d}_{a:03d}_{w:03d}.mp3",
        "license": None,     # ← يُملأ بعد قراءة رخصة الموقع/المستودع
        "reciter": "",       # ← اسم قارئ الكلمة كما يعلنه المصدر
    },
    "qurancdn": {
        "name": "Quran Foundation (quran.com)",
        "home": "https://api-docs.quran.foundation/",
        "base": "https://audio.qurancdn.com/wbw",
        "path": lambda s, a, w: f"{s:03d}_{a:03d}_{w:03d}.mp3",
        "license": None,
        "reciter": "",
    },
}


def key_for(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def stem_for(text: str) -> str:
    """اسمُ ملف الكلمة على القرص: المفتاح موسوماً — لا يلتقي بملفّ المولَّد أبداً."""
    return f"{WORD_PREFIX}{key_for(text)}"


def fingerprint(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def surahs_from_curriculum() -> dict:
    """كلمات السور من مصدر الحقيقة نفسه — `surahWords` تشقّها من نصّ الآية.

    لا تُكتب كلمةٌ هنا بيد أحد: ما يجلبه هذا السكربت هو عينُ ما تعرضه الشاشة.
    """
    js = ("import('file://%s').then(m => console.log(JSON.stringify("
          "m.QURAN.surahs.map(s => ({number: s.number, id: s.id, name: s.name, "
          "words: m.surahWords(s)})))))" % CURRICULUM)
    out = subprocess.run(["node", "-e", js], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def plan(surahs: list) -> list:
    """[(نصّ، سورة، آية، موضع الكلمة)] بلا تكرار — أولُ موضعٍ للكلمة يخدم كل مواضعها."""
    items, seen = [], set()
    for surah in surahs:
        for word in surah["words"]:
            if word["text"] in seen:
                continue
            seen.add(word["text"])
            items.append((word["text"], surah["number"], word["ayah"], word["pos"]))
    return items


def credited(source_id: str) -> bool:
    """هل أُسند هذا المصدر في CREDITS.md؟ (الإسناد يسبق الاستعمال)."""
    if not CREDITS.exists():
        return False
    return bool(re.search(rf"<!--\s*WBW-CREDIT:\s*{re.escape(source_id)}\s*-->",
                          CREDITS.read_text(encoding="utf-8")))


def gate(source_id: str, approved: bool) -> str:
    """بوّابة الترخيص: تعيد رسالة المنع، أو سلسلةً فارغة إن جاز الجلب."""
    src = SOURCES.get(source_id)
    if not src:
        return f"مصدر مجهول: «{source_id}» (المعروفة: {'، '.join(SOURCES)})"
    if not src["license"]:
        return (f"[{source_id}] لا ترخيص موثَّقاً في هذا السكربت — اقرأ {src['home']} "
                "واملأ حقل `license` و`reciter`، ثم أسنِدْه في CREDITS.md. "
                "(الغامض مُغلق — سابقة مسح «كنوز الشبكة» في docs/SESSION_AUDIO.md)")
    if not credited(source_id):
        return (f"[{source_id}] لا إسناد في CREDITS.md — أضِف قسمه ووسمَه "
                f"<!-- WBW-CREDIT: {source_id} --> قبل أول جلب.")
    if not approved:
        return (f"[{source_id}] ينقص إقرارُ إنسان: أعِد الأمر بـ--approve-license "
                "بعد قراءتك رخصةَ المصدر بنفسك.")
    return ""


def write_manifest(record: list, source_id: str) -> None:
    """بيانان: الكامل في `tools/` للتتبّع، و`words` داخل بيان التطبيق ليقرأه `recitation.js`.

    **البيان مشترك مع الآيات ولا يُكتب من الصفر**: تُقرأ نسخته الحالية ويُضاف/يُحدَّث
    فيها `words` و`v` وحدهما — فلا يُسقِط جلبُ الكلمات تلاواتِ الآيات المجلوبة قبله.
    """
    RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    data = {}
    if APP_MANIFEST.exists():
        data = json.loads(APP_MANIFEST.read_text(encoding="utf-8"))
    src = SOURCES[source_id]
    data["words"] = {key_for(e["text"]): e["text"] for e in record}
    data["wordSource"] = src["name"]
    data["wordReciter"] = src["reciter"]
    data["wordReciterName"] = src["reciter"]
    tags = dict(data.get("v") or {})
    for stem in list(data.get("ayat") or {}) + [stem_for(e["text"]) for e in record]:
        path = OUT_DIR / f"{stem}.mp3"
        if path.exists():
            tags[stem] = fingerprint(path)
    data["v"] = tags
    APP_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    APP_MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                            encoding="utf-8")
    print(f"البيان: {RECORD.relative_to(ROOT)} ({len(record)} كلمة)")
    print(f"بيان التطبيق: {APP_MANIFEST.relative_to(ROOT)} "
          f"({len(data['words'])} كلمة و{len(data.get('ayat') or {})} آية)")


def fetch(url: str, retries: int = 4) -> bytes:
    delay, last = 2.0, None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "muallim-fetch/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = RuntimeError(f"HTTP {e.code}")
            if e.code in (404, 403):
                raise last
        except Exception as e:  # noqa: BLE001
            last = RuntimeError(f"{type(e).__name__}: {e}")
        if attempt < retries - 1:
            time.sleep(delay)
            delay *= 2
    raise last or RuntimeError("فشل غير معروف")


def is_mp3(data: bytes) -> bool:
    return data[:3] == b"ID3" or (len(data) > 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)


def sync_only(items: list, source_id: str) -> int:
    """إعادة بناء البيان من الملفات الموجودة — بلا شبكة (تستعمله جلسات التطوير)."""
    src = SOURCES[source_id]
    record, missing = [], 0
    for text, surah, ayah, pos in items:
        if not (OUT_DIR / f"{stem_for(text)}.mp3").exists():
            missing += 1
            continue
        record.append({"text": text, "surah": surah, "ayah": ayah, "word": pos,
                       "source": f"{src['base']}/{src['path'](surah, ayah, pos)}",
                       "file": f"{stem_for(text)}.mp3"})
    write_manifest(record, source_id)
    if missing:
        print(f"  ! {missing} كلمة بلا ملف (تُجلب بلا --sync-only)", file=sys.stderr)
    return 0


def main():
    ap = argparse.ArgumentParser(description="جلب تلاوة الكلمة المفردة لكلمات السور")
    ap.add_argument("--source", default="quranwbw", help="معرّف المصدر (--sources للقائمة)")
    ap.add_argument("--sources", action="store_true", help="عرض المصادر وحال ترخيص كلٍّ")
    ap.add_argument("--approve-license", action="store_true",
                    help="إقرارُ إنسانٍ قرأ رخصةَ المصدر — بدونه لا جلب")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sync-only", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.sources:
        for ident, src in SOURCES.items():
            state = src["license"] or "لم يُتحقَّق بعد — مُغلق"
            print(f"{ident}: {src['name']} · {src['home']}\n"
                  f"   الترخيص: {state}\n"
                  f"   الإسناد في CREDITS.md: {'موجود' if credited(ident) else 'غائب'}")
        return 0

    items = plan(surahs_from_curriculum())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.sync_only:
        return sync_only(items, args.source)

    src = SOURCES.get(args.source)
    if args.dry_run and src:
        for text, surah, ayah, pos in items[:10]:
            print(f"  ⟶ {surah:03d}:{ayah:03d}:{pos:03d} «{text}» → {stem_for(text)}.mp3"
                  f"  ({src['base']}/{src['path'](surah, ayah, pos)})")
        print(f"\nسيُجلب: {len(items)} كلمة فريدة (تجربة جافّة — لم يُنزَّل شيء)")
        return 0

    blocked = gate(args.source, args.approve_license)
    if blocked:
        print(blocked, file=sys.stderr)
        return 2

    print(f"المصدر: {src['name']} · {len(items)} كلمة فريدة.")
    record, made, skipped, failed = [], 0, 0, 0
    for text, surah, ayah, pos in items:
        path = OUT_DIR / f"{stem_for(text)}.mp3"
        url = f"{src['base']}/{src['path'](surah, ayah, pos)}"
        entry = {"text": text, "surah": surah, "ayah": ayah, "word": pos,
                 "source": url, "file": path.name}
        if path.exists() and not args.force:
            skipped += 1
            record.append(entry)
            continue
        try:
            blob = fetch(url)
            if not is_mp3(blob) or len(blob) < MIN_BYTES:
                raise RuntimeError(f"ليس mp3 صالحاً ({len(blob)} بايت)")
            path.write_bytes(blob)
            record.append(entry)
            made += 1
            print(f"  ✓ {surah:03d}:{ayah:03d}:{pos:03d} «{text}» {len(blob) // 1024}KB")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ {surah:03d}:{ayah:03d}:{pos:03d} «{text}»: {e}", file=sys.stderr)

    print(f"\nتم: {made} مجلوب، {skipped} موجود مسبقاً، {failed} فشل.")
    write_manifest(record, args.source)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
