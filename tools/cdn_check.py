#!/usr/bin/env python3
"""أيخدم الوسيطُ صوتَنا من حافّته أم يمرّ كلُّ طلبٍ إلى GitHub؟

    python3 tools/cdn_check.py                 # عيّنةٌ من بنك الصوت + القشرة
    python3 tools/cdn_check.py --sample 40     # عيّنةٌ أوسع
    python3 tools/cdn_check.py --self-test     # فحصٌ ذاتيّ بلا شبكة

## لماذا هذه العدّة

نُقل النطاقُ خلف Cloudflare (٦ أغسطس ٢٠٢٦) لأمرين: معرفةِ الدول، **وتخفيفِ حصة
GitHub Pages** — وهي مئةُ غيغابايت في الشهر، وجهازٌ جديد ينزّل ٤٤٫٧ منها مرّةً
واحدة، فالسقفُ نحو ٢٣٠٠ جهازٍ شهرياً. **فإن خزّن الوسيطُ الصوتَ في حافّته انكمشت
حصةُ GitHub إلى كسرٍ صغير؛ وإن لم يخزّنه فالنقلُ لم يعطنا من ذلك شيئاً.**

**ولا يُعرَف ذلك بالظنّ**: الوسيطُ يقول ما فعل في ترويسة `cf-cache-status`:
  · `HIT` — أُخرِج من حافّة الوسيط، **ولم يُتعَب المصدرُ أصلاً** ← وهو المطلوب
  · `MISS` — لم يكن مخزوناً فجُلب من المصدر، **ويُخزَّن بعدها**
  · `EXPIRED` / `REVALIDATED` — كان مخزوناً وانتهت مدّتُه فأُنعش
  · `DYNAMIC` — **الوسيطُ قرّر ألّا يخزّنه** ← وهذا وحدَه ما يُقلق

فالعدّةُ تطلب كلَّ ملفٍّ **مرّتين**: الأولى تُدفئ الحافّة، والثانية هي الحكم.
والحكمُ على الثانية: `HIT` نجاح، و`DYNAMIC` إخفاق.

**ولا تُقاس الصفحاتُ بالمعيار نفسِه**: HTML يُنعَش سريعاً عمداً كي يصل التحديثُ
إلى الأجهزة، فـ`DYNAMIC` فيها ليست عيباً — والمقيسُ هنا **الصوتُ والرموزُ والخطوط**،
وهي الثقلُ كلُّه (٤٣ ميغابايت من ٥٣).

## قاعدةُ التخزين المضبوطة في Cloudflare (قرار المالك، ٧ أغسطس ٢٠٢٦)

اسمُها `immutable-assets`، وشرطُها **بالامتداد لا بالمجلَّد**:

    URI Path ends with `.mp3`  أو  `.svg`  أو  `.woff2`
    ⇒ Eligible for cache · Edge TTL = شهر · Browser TTL = سنة

**ولماذا بالامتداد**: `/audio/` يحوي `versions.json` و`manifest.json` — **وفيهما
البصماتُ التي بها يطلب التطبيقُ كلَّ صوت**. فلو جُمّد المجلَّد شهراً لجُمّد بيانُ
البصمات معه، فتظلّ الأجهزةُ تطلب القديمَ شهراً **والصوتُ الجديد لا يصل طفلاً واحداً**
— وهو عينُ العطب الذي وُضع نظامُ البصمات لمنعه. فـ`.json` خارج القاعدة أبداً.

**ولماذا شهرٌ لا يوم** (والمالك اختاره لأنّ التطبيق مجّانيّ بلا ميزانية): الكلفةُ
لا تتعلّق بعدد الأطفال بل **بعدد مراكز الحافّة × عدد الدورات**. فبمدّةِ يومٍ وخمسةٍ
وعشرين مركزاً ≈ ٣١ غ.ب شهرياً، وبمدّةِ شهرٍ ≈ **غيغابايتٌ واحد** — من حصةٍ مئةٍ.

**والجدّةُ لا تأتي من المدّة**: رابطُ الصوت يحمل بصمةَ محتواه، فالمبدَّلُ يولّد رابطاً
**لم يره أيُّ مركزٍ في العالم** فيُجلَب طازجاً ولو كانت المدّةُ سنة. فالمدّةُ الطويلة
**أرخصُ وأأمنُ معاً**، والقصيرةُ تكرارٌ بلا فائدة.
"""

import argparse
import json
import random
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://read.mishkat.qa/"
VERSIONS = ROOT / "app" / "audio" / "versions.json"
RECITATIONS = ROOT / "app" / "data" / "recitations.json"

GOOD = {"HIT", "EXPIRED", "REVALIDATED", "UPDATING", "STALE"}
BAD = {"DYNAMIC", "BYPASS"}


# **العنوانُ يُؤخَذ من خوادم الوسيط نفسِها لا من مُحلِّل الجهاز** (٧ أغسطس ٢٠٢٦):
# يوم النقل كان كاشُ حاسوب التطوير ما زال على الخوادم القديمة، فبدا أنّ الحركة لا
# تمرّ بالوسيط بينما هي تمرّ فعلاً على أجهزة الناس (والتحليلاتُ تُظهر زياراتٍ من
# بلدين). فالقياسُ يسأل `mallory.ns.cloudflare.com` مباشرةً — فيصدُق مهما كان كاشُ
# الجهاز، ويصحّ يومَ النقل كما يصحّ بعده.
_EDGE_IP = None


def edge_ip() -> str:
    global _EDGE_IP
    if _EDGE_IP is None:
        host = SITE.split("//")[1].strip("/")
        out = subprocess.run(["dig", "@mallory.ns.cloudflare.com", "+short", host],
                             capture_output=True, text=True).stdout
        ips = [l for l in out.split() if l and l[0].isdigit()]
        _EDGE_IP = ips[0] if ips else ""
    return _EDGE_IP


def head(url: str) -> dict:
    """طلبُ ترويسةٍ **من الحافّة بعينها** — بـ`curl --resolve` لتجاوز كاش الجهاز."""
    host = SITE.split("//")[1].strip("/")
    cmd = ["curl", "-sI", "--max-time", "25", "-A", "muallim-cdn-check/1.0"]
    if edge_ip():
        cmd += ["--resolve", f"{host}:443:{edge_ip()}"]
    cmd.append(url)
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    if not out.strip():
        return {"code": 0, "headers": {}}
    lines = out.splitlines()
    code = int(lines[0].split()[1]) if len(lines[0].split()) > 1 else 0
    headers = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return {"code": code, "headers": headers}


def behind_proxy() -> tuple[bool, str]:
    """أوصلت الحركةُ إلى الوسيط بعد؟ — الترويسةُ تقول، لا الظنّ."""
    r = head(SITE)
    server = r["headers"].get("server", "—")
    return "cloudflare" in server.lower(), server


def audio_sample(n: int) -> list:
    """عيّنةٌ من بنك الصوت **بروابطها الموسومة** — كما يطلبها التطبيق حرفاً."""
    tags = json.loads(VERSIONS.read_text(encoding="utf-8"))
    rec = json.loads(RECITATIONS.read_text(encoding="utf-8"))
    urls = [f"{SITE}audio/{k}.mp3?v={v}" for k, v in tags.items()]
    urls += [f"{SITE}audio/{k}.mp3?v={v}" for k, v in (rec.get("v") or {}).items()]
    return random.Random(7).sample(urls, min(n, len(urls)))


def shell_sample() -> list:
    return [f"{SITE}{p}" for p in (
        "css/app.css", "js/main.js", "js/curriculum.js",
        "fonts/NotoNaskhArabic-arabic.woff2", "emoji/index.json",
        "icons/icon-192.png", "audio/versions.json",
    )]


def measure(urls: list, label: str) -> tuple[int, int, int]:
    print(f"\n{label} ({len(urls)}):")
    good = bad = other = 0
    for url in urls:
        head(url)                                   # الأولى تُدفئ الحافّة
        r = head(url)                               # والثانية هي الحكم
        status = (r["headers"].get("cf-cache-status") or "—").upper()
        age = r["headers"].get("age", "0")
        if status in GOOD:
            good += 1
        elif status in BAD:
            bad += 1
            print(f"   ✗ {status:<10} {url.split('/')[-1][:44]}")
        else:
            other += 1
            print(f"   ? {status:<10} {url.split('/')[-1][:44]} (عمر {age})")
    print(f"   مخزونٌ في الحافّة: {good} · غيرُ مخزون: {bad} · غيرُ معروف: {other}")
    return good, bad, other


def self_test() -> int:
    checks = [
        (VERSIONS.exists(), "بيانُ بصمات الصوت موجود"),
        (RECITATIONS.exists(), "وبيانُ التلاوة كذلك"),
        ("HIT" in GOOD and "DYNAMIC" in BAD, "وتصنيفُ حالات الحافّة معلَن"),
        (len(shell_sample()) >= 5, f"وعيّنةُ القشرة {len(shell_sample())} ملفات"),
    ]
    bad = [m for ok, m in checks if not ok]
    for ok, m in checks:
        print(("  ✓ " if ok else "  ✗ ") + m)
    print("\n" + ("عدّةُ فحص الحافّة سليمة (بلا شبكة)."
                  if not bad else f"{len(bad)} فشل"))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="أيخدم الوسيطُ صوتَنا من حافّته؟")
    ap.add_argument("--sample", type=int, default=12, help="كم ملفَّ صوتٍ يُفحَص")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    proxied, server = behind_proxy()
    print(f"خادمُ الموقع الآن: {server}")
    if not proxied:
        print("\n⚠️ الحركةُ لم تمرّ بالوسيط بعد — فلا معنى لقياس حافّته.\n"
              "   انتظر انتهاءَ انتشار خوادم الأسماء ثم أعِد التشغيل.")
        return 1

    ag, ab, ao = measure(audio_sample(args.sample), "الصوت — وهو الثقلُ كلُّه")
    sg, sb, so = measure(shell_sample(), "القشرةُ والرموزُ والخطوط")

    print("\n" + "—" * 46)
    if ab == 0 and sb == 0:
        print("✅ الوسيطُ يخدم ملفاتنا من حافّته — حصةُ GitHub محميّة.")
        return 0
    print(f"⚠️ ملفاتٌ لا يخزّنها الوسيط: صوت {ab} · قشرة {sb}")
    print("   العلاجُ قاعدةُ تخزينٍ في Cloudflare (Caching ← Cache Rules) تشمل"
          " `/audio/*` و`/emoji/*` و`/fonts/*`.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
