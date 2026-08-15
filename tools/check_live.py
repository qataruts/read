#!/usr/bin/env python3
"""فحصُ الموقع الحيّ — هل ما في الشجرة هو ما يُخدَم فعلاً على `read.mishkat.qa`؟

    python3 tools/check_live.py              # يجلب الصفحات والأصول ويطبع الحصيلة
    python3 tools/check_live.py --base URL   # على نطاقٍ آخر (معاينة، أو خادم محلّي)
    python3 tools/check_live.py --self-test  # بلا شبكة: يتحقّق من العدّة نفسِها

**لماذا أداةٌ لا اطمئنان**: يوم ١٢ أغسطس ٢٠٢٦ ردّت `method.html` و`guide.html`
**٤٠٤** على الموقع الحيّ بينما الرئيسةُ والمنهجُ ٢٠٠ — فبدت البوّابةُ منشورةً نصفَها
أمام معلّم. ولم يكن العيبُ في الشيفرة ولا في اسمٍ ولا في عامل الخدمة: **الملفّان
كانا في الشجرة وفي التزامٍ محلّيّ ولم يبلغا `origin/main` بعد**، و`pages.yml` ينشر
عند الدفع لا عند الالتزام. فالفجوةُ صنفٌ لا يمسكه فحصٌ على القرص أبداً — «مُلتزَمٌ»
ليست «منشورة» — ولا يُغلق إلا **بجلبٍ فعليّ بعد النشر**.

**وقائمةُ الصفحات مشتقّةٌ من الشجرة لا مكتوبةً بيد**: كلُّ `app/welcome/*.html` يدخل
الفحص، فصفحةٌ خامسة تُكتب غداً تُفحَص حيّةً **يوم تُكتب** بلا سطرٍ يُعدَّل هنا. ومعها
أصولٌ مُشتقّة كذلك (التنسيق والخطوط ولقطةٌ وأيقونة) — فالصفحةُ بلا أصولها ورقةٌ عارية.

**وهي خارج السَّوقة القياسية عمداً**: تحتاج شبكةً ونشراً، والسَّوقةُ تعمل بلا إنترنت.
و`--self-test` فيها **بلا شبكة** (يفحص العدّةَ لا الموقع) فتدخل جردَ `test_selftests`
كأخواتها — «فحصٌ لا يُشغَّل ليس حارساً».
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
WELCOME = APP / "welcome"
BASE = "https://read.mishkat.qa/"
TIMEOUT = 25


def pages() -> list[tuple[str, str]]:
    """(المسار، العنوان المتوقَّع) لكل صفحةٍ في `app/welcome/` — مشتقٌّ من القرص."""
    out = []
    for path in sorted(WELCOME.glob("*.html")):
        title = re.search(r"<title>([^<]+)</title>", path.read_text(encoding="utf-8"))
        url = "welcome/" if path.name == "index.html" else f"welcome/{path.name}"
        out.append((url, title.group(1).strip() if title else ""))
    return out


def assets() -> list[str]:
    """أصولٌ تُثبت أن المنشور كاملٌ لا هيكلاً: التنسيق والخطّان ولقطةٌ وأيقونة والتطبيق."""
    shot = sorted((WELCOME / "shots").glob("*.png"))
    font = sorted((WELCOME / "fonts").glob("*.woff2"))
    out = ["", "welcome/welcome.css", "css/app.css", "manifest.webmanifest", "sw.js"]
    if shot:
        out.append(f"welcome/shots/{shot[0].name}")
    if font:
        out.append(f"welcome/fonts/{font[0].name}")
    return out


def fetch(url: str) -> tuple[int, str]:
    """(الرمز، أولُ الجسم) — و٤٠٤ خبرٌ لا عطب، فتُقرأ كما تُقرأ ٢٠٠."""
    request = urllib.request.Request(url, headers={"User-Agent": "iqra-live-check"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return response.status, response.read(4096).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, ""
    except Exception as error:                       # شبكةٌ لا تُجيب: عطبٌ يُقال
        return 0, str(error)


def check(base: str) -> int:
    base = base if base.endswith("/") else base + "/"
    fails = 0
    print(f"الموقع الحيّ: {base}\n")

    print("— الصفحات —")
    for url, title in pages():
        code, body = fetch(base + url)
        got = re.search(r"<title>([^<]+)</title>", body)
        got = got.group(1).strip() if got else ""
        good = code == 200 and got == title
        fails += 0 if good else 1
        mark = "✓" if good else "✗"
        note = f"{code}" + (f" — «{got}»" if got else "")
        if code == 200 and got != title:
            note += f" ✗ والمنتظَر «{title}»"
        print(f"  {mark} /{url:<26} {note}")

    print("\n— الأصول —")
    for url in assets():
        code, _ = fetch(base + url)
        fails += 0 if code == 200 else 1
        print(f"  {'✓' if code == 200 else '✗'} /{url or '(جذر التطبيق)':<26} {code}")

    # **الأصلُ متخلّفٌ أم الحافّةُ متلكئة؟** (بلاغ اكتب `sw-edge-cache-lag`، ١٥ أغسطس
    # ٢٠٢٦): قشرةُ الحيّ إن خالفت الشجرةَ فالمتَّهمان اثنان — نشرٌ لم يبلغ الأصل
    # (عيبٌ حقيقي)، أو حافّةُ Cloudflare تخدم قديماً (`cf-cache-status: HIT` + عمر).
    # فيُقال الحالُ باسمه بدل حُمرةٍ تُتَّهم بها الشجرة. (وقاعدةُ المنطقة `sw-bypass`
    # أُنشئت — فالمنتظَر DYNAMIC دائماً، وHIT هنا يعني سقوطَ القاعدة.)
    local_v = re.search(r"VERSION = '(v\d+)'", (APP / "sw.js").read_text(encoding="utf-8"))
    request = urllib.request.Request(base + "sw.js", headers={"User-Agent": "iqra-live-check"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            body = response.read(8192).decode("utf-8", "replace")
            live_v = re.search(r"VERSION = '(v\d+)'", body)
            cf = response.headers.get("cf-cache-status", "؟")
            age = response.headers.get("age", "٠")
        same = local_v and live_v and local_v.group(1) == live_v.group(1)
        if same:
            print(f"  ✓ قشرة الحيّ {live_v.group(1)} تطابق الشجرة (الحافّة: {cf})")
        else:
            fails += 1
            who = ("الحافّةُ متلكئة — cf-cache-status: " + cf + f"، العمر {age}ث؛ "
                   "قاعدةُ sw-bypass سقطت؟" if cf.upper() == "HIT"
                   else "الأصلُ متخلّف — النشرُ لم يبلغ GitHub Pages")
            print(f"  ✗ قشرة الحيّ {live_v.group(1) if live_v else '؟'} والشجرة "
                  f"{local_v.group(1) if local_v else '؟'} — {who}")
    except Exception as error:
        fails += 1
        print(f"  ✗ تعذّر فحص قشرة الحيّ: {error}")

    print(f"\n{fails} إخفاق — المنشورُ ليس ما في الشجرة" if fails
          else "\nالمنشورُ هو ما في الشجرة: كلُّ صفحةٍ وأصلٍ يردّ ٢٠٠ بعنوانه.")
    return 1 if fails else 0


def self_test() -> int:
    """بلا شبكة: العدّةُ نفسُها — القائمةُ مشتقّةٌ، ولكل صفحةٍ عنوانٌ يُقابَل به."""
    fails = 0
    found = pages()
    on_disk = {p.name for p in WELCOME.glob("*.html")}
    listed = {("index.html" if u == "welcome/" else u.split("/")[-1]) for u, _ in found}
    if listed != on_disk:
        print(f"  ✗ القائمةُ لا تطابق الشجرة: {sorted(on_disk ^ listed)}")
        fails += 1
    else:
        print(f"  ✓ قائمةُ الصفحات مشتقّةٌ من الشجرة ({len(found)} صفحات)")

    empty = [u for u, t in found if not t]
    if empty:
        print(f"  ✗ صفحةٌ بلا عنوان تُقابَل به: {'، '.join(empty)}")
        fails += 1
    else:
        print("  ✓ ولكلٍّ عنوانٌ في ترويستها يُقابَل به المنشور")

    needed = assets()
    missing = [a for a in needed if a and not (APP / a).exists()]
    if missing:
        print(f"  ✗ أصلٌ مطلوبٌ ليس في الشجرة: {'، '.join(missing)}")
        fails += 1
    else:
        print(f"  ✓ وأصولُها الستّة موجودةٌ في الشجرة ({len(needed)} مسارات)")

    workflow = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
    # علّةُ وجود هذه الأداة: النشرُ **عند الدفع** لا عند الالتزام، وينسخ `app/` كلَّه.
    if "branches: [main]" in workflow and "path: app" in workflow:
        print("  ✓ والنشرُ عند الدفع إلى main ينسخ `app/` كلَّه (فالفجوةُ دفعٌ لا ملفّ)")
    else:
        print("  ✗ سيرُ النشر تغيّر — يُراجَع نصُّ هذه الأداة")
        fails += 1

    print(f"\n{fails} إخفاق" if fails else "\nعدّةُ الفحص الحيّ سليمة (بلا شبكة).")
    return 1 if fails else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="فحصُ الموقع الحيّ بعد النشر")
    parser.add_argument("--base", default=BASE, help=f"عنوان الموقع (افتراضه {BASE})")
    parser.add_argument("--self-test", action="store_true", help="فحصُ العدّة بلا شبكة")
    parser.add_argument("--json", action="store_true", help="الحصيلة بيانات لا نصّاً")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if args.json:
        base = args.base if args.base.endswith("/") else args.base + "/"
        out = {u: fetch(base + u)[0] for u, _ in pages()}
        out.update({a: fetch(base + a)[0] for a in assets()})
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0 if all(v == 200 for v in out.values()) else 1
    return check(args.base)


if __name__ == "__main__":
    sys.exit(main())
