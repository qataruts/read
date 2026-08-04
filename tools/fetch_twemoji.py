#!/usr/bin/env python3
"""مهمة «أيقونات لا إيموجي» — خطُّ أصول Twemoji: جردٌ ثم تنزيلٌ ثم فهرس.

**العلّة** (أمر المالك، ٧ أغسطس ٢٠٢٦): إيموجي خطِّ النظام ليس صورةً واحدة — هو صورةٌ
لكل جهاز. فما راجعه المالك والمدير في `docs/REVIEW_ICONS.md` على أبل يراه طفلٌ آخر
على أندرويد أو ويندوز رسماً مختلفاً، وقد ينقلب الحكمُ الذي بُني على «صدق الصورة»
(DESIGN §٦). والأسوأ: الرموز الحديثة (يونيكود ١٤–١٥ — 🪭 و🫗 و🪕) تظهر مربّعاً
فارغاً في الأجهزة الأقدم، فتصير الإجابةُ المصوَّرة لا صورةَ لها أصلاً.

**العلاج**: رموز بياناتنا نفسُها تُرسَم من مجموعة **Twemoji** (SVG، رخصة CC-BY 4.0)
مخزونةً في `app/emoji/` — صورةٌ واحدة لكل طفل على كل جهاز، وتعمل دون إنترنت.

**والمُنزَّل هو المستعمَل وحده**: لا تُنسخ المجموعة كلها (٣٦٠٠ ملف) بل ما تطلبه
بياناتُنا وصفحاتُنا فعلاً — يجرده هذا السكربت من مصادره، لا من قائمةٍ يدوية تتخلّف
عن المنهج (كما تُخزَن الأصوات من فهرسها والقصصُ من فهرسها).

    python3 tools/fetch_twemoji.py            # جرد + تنزيل الناقص + كتابة الفهرس
    python3 tools/fetch_twemoji.py --check    # بلا شبكة: رمزٌ بلا ملف = فشل
    python3 tools/fetch_twemoji.py --list     # الجرد وحده (رمز، مفتاح، مواضعه)
    python3 tools/fetch_twemoji.py --prune    # حذف ملفٍّ لم يعد له رمزٌ في المصادر
    python3 tools/fetch_twemoji.py --dry-run  # ما سيُنزَّل ومن أين، بلا طلب شبكة

يخرج بـ ١ عند نقصٍ أو خطأ، وبـ ٠ إن تمّ.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
OUT = APP / "emoji"
INDEX = OUT / "index.json"

# نسخةٌ مثبَّتة لا `main`: ما يراجعه المالك اليوم هو ما يراه الطفل غداً.
TWEMOJI_VERSION = "15.1.0"
BASE = f"https://cdn.jsdelivr.net/gh/jdecked/twemoji@{TWEMOJI_VERSION}/assets/svg"

# ————— ما هو «رمزٌ مصوَّر» —————
# ليس كلُّ محرفٍ رمزيّ إيموجي: «✦» و«✓» و«★» و«←» محارف نصّية تُرسم بخطّ النصّ
# نفسِه ولا شأن لها بهذه المهمة. والفارق قاعدةُ يونيكود لا ذوق: الرمز مصوَّرٌ إن
# كان `Emoji_Presentation=Yes` (رسمُه الملوّن هو الأصل) أو أُلحق به مُحدِّدُ
# التصوير `U+FE0F`. وهذه عينُ القاعدة المكتوبة في `emojiSrc` بـ`app/js/ui.js`،
# ويثبت `tools/test_emoji.mjs` أن الجهتين تحكمان على كل رمزٍ حكماً واحداً.
PRESENTATION = (
    "⌚-⌛⏩-⏬⏰⏳◽-◾☔-☕♈-♓"
    "♿⚓⚡⚪-⚫⚽-⚾⛄-⛅⛎⛔⛪"
    "⛲-⛳⛵⛺⛽✅✊-✋✨❌❎❓-❕"
    "❗➕-➗➰➿⬛-⬜⭐⭕"
    "\U0001f004\U0001f0cf\U0001f18e\U0001f191-\U0001f19a\U0001f1e6-\U0001f1ff"
    "\U0001f201-\U0001f202\U0001f21a\U0001f22f\U0001f232-\U0001f236\U0001f238-\U0001f23a"
    "\U0001f250-\U0001f251\U0001f300-\U0001f320\U0001f32d-\U0001f335\U0001f337-\U0001f37c"
    "\U0001f37e-\U0001f393\U0001f3a0-\U0001f3ca\U0001f3cf-\U0001f3d3\U0001f3e0-\U0001f3f0"
    "\U0001f3f4\U0001f3f8-\U0001f43e\U0001f440\U0001f442-\U0001f4fc\U0001f4ff-\U0001f53d"
    "\U0001f54b-\U0001f54e\U0001f550-\U0001f567\U0001f57a\U0001f595-\U0001f596\U0001f5a4"
    "\U0001f5fb-\U0001f64f\U0001f680-\U0001f6c5\U0001f6cc\U0001f6d0-\U0001f6d2"
    "\U0001f6d5-\U0001f6d7\U0001f6dc-\U0001f6df\U0001f6eb-\U0001f6ec\U0001f6f4-\U0001f6fc"
    "\U0001f7e0-\U0001f7eb\U0001f7f0\U0001f90c-\U0001f93a\U0001f93c-\U0001f945"
    "\U0001f947-\U0001f9ff\U0001fa70-\U0001fa7c\U0001fa80-\U0001fa88\U0001fa90-\U0001fabd"
    "\U0001fabf-\U0001fac5\U0001face-\U0001fadb\U0001fae0-\U0001fae8\U0001faf0-\U0001faf8"
)
# القاعدة الأوسع: كل محرفٍ يصلح أن يكون إيموجي — يُقبل هنا **إن أُلحق به U+FE0F**
# أو جاء ذيلاً في تسلسل ZWJ («👨‍⚕️» طبيبٌ: رجلٌ + رابط + عصا أسكليبيوس + مُحدِّد).
BASE_CHARS = (
    "©®‼⁉™ℹ↔-↪⌚-⌛⌨"
    "⏏-⏺Ⓜ▪-◾☀-➿⤴-⤵⬀-⯿"
    "〰〽㊗㊙\U0001f000-\U0001faff"
)
ZWJ, VS16 = "‍", "️"
GLYPH = re.compile(
    f"(?:[{PRESENTATION}]{VS16}?|[{BASE_CHARS}]{VS16})"
    f"(?:{ZWJ}(?:[{PRESENTATION}]|[{BASE_CHARS}]){VS16}?)*"
)

# ————— المصادر: من أين تُجرد الرموز —————
# ثلاثٌ لا رابع: بيانات المنهج، وشيفرة الشاشات، والصفحة التعريفية. وما زاد على
# ذلك ملفٌّ في `app/` لا يُقرأ للطفل. وترتيبها هو ترتيب `docs/REVIEW_ICONS.md`.
SOURCES = [
    ("بيانات المنهج", [APP / "js" / "curriculum.js"]),
    ("معجم الحديقة", [APP / "data" / "lexicon.json"]),
    ("مكتبة القصص", sorted((APP / "data" / "stories").glob("*.json"))),
    ("شاشات التطبيق",
     [p for p in sorted((APP / "js").glob("*.js")) if p.name != "curriculum.js"]
     + [APP / "index.html", APP / "css" / "app.css"]),
    ("الصفحة التعريفية", sorted((APP / "welcome").glob("*.html"))),
]
# الصفحة التعريفية بلا جافاسكربت، فرموزُها مكتوبةٌ فيها `<img src="../emoji/…">`
# لا محارفَ تُصيَّر — فتُجرد بمرجعها كما تُجرد الأخرى بمحرفها.
REF = re.compile(r"emoji/([0-9a-f]+(?:-[0-9a-f]+)*)\.svg")


def key_of(glyph: str) -> str:
    """اسمُ ملف Twemoji للرمز: نقاطُه بالست عشري موصولةً بشرطة.

    وقاعدةُ `U+FE0F` قاعدةُ المجموعة نفسِها: يُحذف المُحدِّد إلا في تسلسل ZWJ
    (فـ«⚖️» ملفُّه `2696.svg` و«👨‍⚕️» ملفُّه `1f468-200d-2695-fe0f.svg`).
    """
    text = glyph if ZWJ in glyph else glyph.replace(VS16, "")
    return "-".join(f"{ord(ch):x}" for ch in text)


def glyph_of(key: str) -> str:
    """عكسُ `key_of` — يُستعمل في الفهرس ليقرأ الإنسانُ ما يقابل كل ملف."""
    return "".join(chr(int(part, 16)) for part in key.split("-"))


def collect() -> dict:
    """يعيد {مفتاح: {"glyph": الرمز, "where": [مواضعه]}} من المصادر كلها."""
    found = {}

    def add(glyph, where):
        entry = found.setdefault(key_of(glyph), {"glyph": glyph, "where": []})
        if where not in entry["where"]:
            entry["where"].append(where)

    for label, paths in SOURCES:
        for path in paths:
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            for glyph in GLYPH.findall(text):
                add(glyph, label)
            for key in REF.findall(text):
                add(glyph_of(key), label)
    return found


def download(key: str) -> bytes:
    url = f"{BASE}/{key}.svg"
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def write_index(found: dict) -> None:
    """فهرس `app/emoji/index.json` — منه يخزّن عاملُ الخدمة (لا قائمة يدوية في sw.js).

    ومعه الرمزُ نفسُه لكل مفتاح: فيقرأ الإنسانُ الفهرس ويراجعه، ويثبت الحارس أن
    ما على القرص هو عينُ ما تطلبه المصادر — لا زيادةَ ولا نقصان.
    """
    INDEX.write_text(json.dumps({
        "source": "twemoji",
        "version": TWEMOJI_VERSION,
        "license": "CC-BY 4.0",
        "url": f"https://github.com/jdecked/twemoji/tree/v{TWEMOJI_VERSION}",
        "files": {key: found[key]["glyph"] for key in sorted(found)},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="جلب أيقونات Twemoji المستعمَلة وحدها")
    parser.add_argument("--check", action="store_true", help="بلا شبكة: رمزٌ بلا ملف = فشل")
    parser.add_argument("--list", action="store_true", help="الجرد وحده")
    parser.add_argument("--prune", action="store_true", help="حذف ملفٍّ بلا رمز")
    parser.add_argument("--dry-run", action="store_true", help="ما سيُنزَّل بلا طلب شبكة")
    args = parser.parse_args()

    found = collect()
    on_disk = {p.stem for p in OUT.glob("*.svg")} if OUT.exists() else set()
    missing = sorted(key for key in found if key not in on_disk)
    extra = sorted(on_disk - set(found))

    if args.list:
        for key in sorted(found, key=lambda k: found[k]["where"]):
            mark = " " if key in on_disk else "✗"
            print(f"{mark} {found[key]['glyph']:4} {key:28} {'، '.join(found[key]['where'])}")
        print(f"\n{len(found)} رمزاً فريداً من {len(SOURCES)} مصادر")
        return 0

    print(f"جرد «أيقونات لا إيموجي»: {len(found)} رمزاً فريداً، "
          f"{len(on_disk)} ملفاً على القرص")

    if args.check:
        ok = True
        if missing:
            print(f"\n✗ {len(missing)} رمزاً بلا ملف: "
                  + "، ".join(f"{found[k]['glyph']} ({k})" for k in missing[:12])
                  + ("…" if len(missing) > 12 else ""), file=sys.stderr)
            ok = False
        if extra:
            print(f"\n✗ {len(extra)} ملفاً بلا رمزٍ في المصادر: {'، '.join(extra[:12])}",
                  file=sys.stderr)
            ok = False
        if not INDEX.exists():
            print("\n✗ لا فهرس (app/emoji/index.json)", file=sys.stderr)
            ok = False
        else:
            indexed = json.loads(INDEX.read_text(encoding="utf-8"))["files"]
            if set(indexed) != set(found):
                print("\n✗ الفهرس لا يطابق المصادر — أعِد تشغيل السكربت", file=sys.stderr)
                ok = False
        if ok:
            print("✓ كل رمزٍ مستعمَل له ملفُّ SVG، والفهرس يطابق القرص.")
        return 0 if ok else 1

    if args.prune:
        for key in extra:
            (OUT / f"{key}.svg").unlink()
        print(f"حُذف {len(extra)} ملفاً بلا رمز.")
        if extra:
            write_index(found)
        return 0

    if args.dry_run:
        for key in missing:
            print(f"  {found[key]['glyph']}  {BASE}/{key}.svg")
        print(f"\nسيُنزَّل {len(missing)} ملفاً" + (f"، ويُهمَل {len(extra)} زائداً" if extra else ""))
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for i, key in enumerate(missing, 1):
        try:
            (OUT / f"{key}.svg").write_bytes(download(key))
            print(f"  [{i}/{len(missing)}] {found[key]['glyph']}  {key}.svg")
        except (urllib.error.URLError, urllib.error.HTTPError) as error:
            failed.append((key, found[key]["glyph"], error))
            print(f"  [{i}/{len(missing)}] ✗ {found[key]['glyph']} ({key}): {error}",
                  file=sys.stderr)

    if failed:
        print(f"\n✗ تعذّر تنزيل {len(failed)} رمزاً — لا فهرسَ ناقصاً يُكتب.", file=sys.stderr)
        return 1

    write_index(found)
    total = sum(p.stat().st_size for p in OUT.glob("*.svg"))
    print(f"\n✓ {len(found)} ملفاً في app/emoji/ ({total // 1024} كيلوبايت)، والفهرس مكتوب.")
    if extra:
        print(f"  (و{len(extra)} ملفاً لم يعد له رمز — احذفها بـ--prune)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
