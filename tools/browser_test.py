#!/usr/bin/env python3
"""تشغيل اختبارات الواجهة في متصفّح حقيقي (Chrome بلا واجهة) بلا أي تبعيات.

    python3 tools/browser_test.py              # درس الحرف: يسوق التطبيق ويطبع التقرير
    python3 tools/browser_test.py --words      # لعبة تركيب الكلمات (المجموعات السبع)
    python3 tools/browser_test.py --review     # المراجعة اليومية ولوحة وليّ الأمر
    python3 tools/browser_test.py --story      # دروس المهارات وشاشة قراءة القصص
    python3 tools/browser_test.py --quran      # المرحلة القرآنية والعمل دون إنترنت
    python3 tools/browser_test.py --garden     # بساتين الموضوعات (حديقة الكلمات)
    python3 tools/browser_test.py --sentences  # سلّم الجمل (المرحلة ج)
    python3 tools/browser_test.py --stories    # مكتبة «مصنع القصص» (المرحلة د)
    python3 tools/browser_test.py --record     # «اقرأ لي»: تسجيل صوت الطفل (المرحلة و)
    python3 tools/browser_test.py --gate       # بوابتا الإتقان (الحزمة ١٤)
    python3 tools/browser_test.py --parent     # صلابة التقدّم وتحكّم وليّ الأمر (الحزمة ١١)
    python3 tools/browser_test.py --contrast   # محطتا «ميّز بين» (الحزمة ١٣)
    python3 tools/browser_test.py --roots      # شبكات الجذور (حزمة الجذور)
    python3 tools/browser_test.py --marks      # قياس العلامات (مدّ · سكون · شدّة · تنوين · لام)
    python3 tools/browser_test.py --fade       # خفوت التشكيل ز١→ز٣ (المرحلة ز)
    python3 tools/browser_test.py --voice      # قياس التعاقب الصوتي: لا تراكب ولا قطش مبرمَج
    python3 tools/browser_test.py --map        # الخريطة: الجبهة والطيّ الكسول وقياس سرعتهما
    python3 tools/browser_test.py --welcome    # الصفحة التعريفية (خارج قشرة عامل الخدمة)
    python3 tools/browser_test.py --shots out.png [--words|--review|--story|--quran|--garden|--sentences|--stories|--record|--gate|--map]
    python3 tools/browser_test.py --show       # بمتصفّح مرئي لتتبّع ما يجري

كيف يعمل: خادم صغير يخدم مجلد app/ ويضيف صفحات الاختبار وحدها من هذا المجلد
(/__test.html و/__shots.html و/__words.html و/__words_shots.html و/__review.html
و/__review_shots.html و/__story.html و/__story_shots.html) ويستقبل النتيجة بـPOST /result،
فلا تبقى في app/ صفحة اختبار تُخدَم للطفل. ويخدم /__queue.json (نصوص قائمة الانتظار
الصوتية) كي تستثنيها الصفحات من فحص «لا لجوء للنطق الآلي».

ملاحظة: --dump-dom و--virtual-time-budget غير موثوقين مع fetch والصوت،
لذلك تُرسَل النتائج من الصفحة نفسها ثم يُقتل المتصفّح.
"""

import argparse
import http.server
import json
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
TOOLS = Path(__file__).resolve().parent
PAGES = {
    "/__test.html": TOOLS / "browser_test.html",
    "/__shots.html": TOOLS / "browser_shots.html",
    "/__covers_shots.html": TOOLS / "browser_covers_shots.html",
    "/__words.html": TOOLS / "browser_words.html",
    "/__words_shots.html": TOOLS / "browser_words_shots.html",
    "/__review.html": TOOLS / "browser_review.html",
    "/__review_shots.html": TOOLS / "browser_review_shots.html",
    "/__story.html": TOOLS / "browser_story.html",
    "/__story_shots.html": TOOLS / "browser_story_shots.html",
    "/__quran.html": TOOLS / "browser_quran.html",
    "/__quran_shots.html": TOOLS / "browser_quran_shots.html",
    "/__garden.html": TOOLS / "browser_garden.html",
    "/__garden_shots.html": TOOLS / "browser_garden_shots.html",
    "/__sentences.html": TOOLS / "browser_sentences.html",
    "/__sentences_shots.html": TOOLS / "browser_sentences_shots.html",
    "/__stories.html": TOOLS / "browser_stories.html",
    "/__stories_shots.html": TOOLS / "browser_stories_shots.html",
    "/__record.html": TOOLS / "browser_record.html",
    "/__record_shots.html": TOOLS / "browser_record_shots.html",
    "/__map.html": TOOLS / "browser_map.html",
    "/__map_shots.html": TOOLS / "browser_map_shots.html",
    "/__gate.html": TOOLS / "browser_gate.html",
    "/__gate_shots.html": TOOLS / "browser_gate_shots.html",
    "/__contrast.html": TOOLS / "browser_contrast.html",
    "/__roots.html": TOOLS / "browser_roots.html",
    "/__marks.html": TOOLS / "browser_marks.html",
    "/__contrast_shots.html": TOOLS / "browser_contrast_shots.html",
    "/__device.html": TOOLS / "browser_device.html",
    "/__welcome.html": TOOLS / "browser_welcome.html",
    "/__parent.html": TOOLS / "browser_parent.html",
    "/__fade.html": TOOLS / "browser_fade.html",
    "/__voice.html": TOOLS / "browser_voice.html",
    "/__parent_shots.html": TOOLS / "browser_parent_shots.html",
}
# نافذة Chrome بلا واجهة تحجز ٨٧ بكسلاً لإطارٍ وهميّ فوق المنظور — فلولا تعويضها لقِسنا
# جهازاً أقصر من الجهاز. والصفحة تعيد منظورها الحقيقي، والعدّاء يرفض أي انحرافٍ عن المطلوب.
VIEWPORT_PAD = 87
# مقاسات الجهاز الحقيقية (بكسل CSS) — بلاغ المالك عن الآيباد جاء من هذه الأرقام لا من نافذة سطح مكتب
DEVICE_SIZES = [
    ("آيباد ٩٫٧ طولي", "768,1024"),
    ("آيباد ١٠٫٩ طولي", "820,1180"),
    ("آيباد ٩٫٧ عرضي", "1024,768"),
    ("آيباد ١٠٫٩ عرضي", "1180,820"),
    ("آيباد ميني عرضي", "1133,744"),
]
# أعلامُ جهازٍ وهميّ للميكروفون (اختبار «اقرأ لي»): مجرى صوتٍ مولَّد من Chrome نفسه
# وقبولٌ تلقائيّ للإذن — فتُختبر دورةُ التسجيل كاملةً بلا ميكروفون حقيقي ولا تفاعل بشري.
FAKE_MEDIA = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
QUEUE_FILE = ROOT / "tools" / "audio_queue.json"


def pending_texts() -> list:
    """النصوص المنتظِرة في قائمة الانتظار الصوتية (docs/AUDIO_QUEUE.md).

    صفحات الاختبار تستثنيها من فحص «لا لجوء للنطق الآلي»: لا ملف لها بعدُ لأن
    جلسة الصوتيات لم تصرّفها، فاحتياط النطق هو السلوك الصحيح مؤقتاً — وبعد التصريف
    تفرغ القائمة فيعود الفحص صارماً على كل نصّ بلا تعديل في الصفحات.
    """
    if not QUEUE_FILE.exists():
        return []
    try:
        data = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [e["text"] for e in data
            if isinstance(e, dict) and e.get("text") and e.get("status", "pending") != "done"]


def make_server(port: int, results: list):
    # عدّادُ طلبات الصوت **عند الخادم** (حزمة «خفّة التخزين»): الشاهدُ الوحيد على أن
    # ترقيةَ نسخةٍ لا تعيد تنزيل الصوت — فجلبُ عامل الخدمة لا يمرّ بالصفحة فلا تراه،
    # وأثرُه هنا لا يُخفيه شيء. تقرؤه صفحةُ الاختبار على `/__audio_hits.json`.
    hits = {"mp3": 0}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(APP), **kw)

        def do_GET(self):
            path, _, query = self.path.partition("?")
            if path.startswith("/audio/") and path.endswith(".mp3"):
                hits["mp3"] += 1
            if path == "/__audio_hits.json":
                body = json.dumps(hits).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            # ترقيةُ نسخةِ عامل الخدمة في بيئة الاختبار (الحزمة ١١): `app/sw.js` **نفسُه**
            # برقم نسخةٍ مرفوع — فتقع الترقية كما تقع على جهاز الطفل (تركيبٌ ثم تفعيلٌ
            # يمحو مخزون السابقة)، ويُقاس عندها بقاءُ التقدّم. لا نسخةَ ثانية من الملف.
            if path == "/sw.js" and "bump=" in query:
                tag = re.sub(r"[^0-9A-Za-z-]", "", query.split("bump=")[1].split("&")[0])
                src = (APP / "sw.js").read_text(encoding="utf-8")
                body = re.sub(r"(const VERSION = '[^']*)'", rf"\1-bump{tag}'", src, count=1)
                raw = body.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
            if path == "/__queue.json":
                body = json.dumps(pending_texts(), ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            page = PAGES.get(path)
            if page:
                body = page.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def do_POST(self):
            # **بصمةُ المصدر** (بلاغا العائلة، ١٢ أغسطس ٢٠٢٦ — «تقريرُ متصفّحِ الجار
            # قُرئ تقريرَنا»): لا يُقبل تقريرٌ إلا من صفحاتنا (`?from=read`) — فأسوأُ
            # ما يقع عند أي التباسٍ «لم تصل نتيجة» الصادقة، لا خضرةُ جارٍ تُنسب لنا.
            path, _, query = self.path.partition("?")
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if "from=read" not in query:
                print(f"⚠ تقريرٌ غريب رُفض (المسار {self.path}) — ليس من صفحات اقرأ")
            else:
                try:
                    results[:] = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    pass
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    # **خادمٌ خيطيّ لا أحاديّ** (١٥ أغسطس ٢٠٢٦ — التشخيص اكتمل): تفعيلُ عامل الخدمة
    # ينتظر خزنَ التثبيت كلَّه (~٢٩٧٦ صوتاً بدفعات ١٦ + القشرة والقصص والأيقونات)،
    # وعلى خيطٍ واحد يقف ذلك على حافة مهلة الستين ثانية — فيقلبه أيُّ حملٍ حُمرةً
    # كاذبة («انتظار طويل: تفعيل عامل الخدمة»). التوازي يعيد الهامش.
    class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True
        daemon_threads = True
    try:
        return Server(("127.0.0.1", port), Handler)
    except OSError as err:
        sys.exit(f"المنفذ {port} مشغول ({err}) — أعدّةُ جارٍ من العائلة تعمل الآن؟ "
                 f"(منافذ العائلة: اقرأ 8790 · احسب 8791 · اكتب 8792) جرّب --port آخر.")


def sweep_orphans():
    """قتلُ نسخ كروم الخفية **العالقة من جولاتنا نحن** قبل إطلاق جولةٍ جديدة.

    بلاغُ اكتب العائليّ (١٢ أغسطس ٢٠٢٦): يتيمُ فحصٍ ميت يخطف نقرةَ أيقونة كروم
    عند المالك فيبدو المتصفح معطّلاً. التنظيفُ عند الإقلاع لا عند الخروج وحده —
    فالجلسة تُقتل والفحص يُقاطَع ويبقى اليتيم. ولا نقرب إلا ما يحمل سابقتَنا
    (muallim-chrome-) — نسخُ الجيران ومتصفحُ المالك الحي خارج المرمى بالبناء."""
    subprocess.run(["pkill", "-f", "user-data-dir=[^ ]*muallim-chrome-"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


def run_chrome(url: str, profile: Path, extra: list, show: bool):
    sweep_orphans()
    if not Path(CHROME).exists():
        sys.exit(f"لم يُعثر على Chrome في {CHROME}")
    cmd = [CHROME, f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check"]
    if not show:
        cmd += ["--headless=new", "--disable-gpu"]
    cmd += extra + [url]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# الشاشات التي **يجب** أن تسع الوضع العرضي بلا سحب: خطوات الدرس والمهارة والبوابة —
# بطلاتُ «الصندوق الكبير» وشقيقاتُها. وما عداها (قصة، مراجعة، بستان) قوائمُ تطول بطبعها
# فالسحب فيها أصلٌ لا عطب.
LANDSCAPE_MUST_FIT = {
    "lesson-listen", "lesson-harakat", "lesson-trace", "lesson-quiz",
    "skill-rule", "skill-compare", "skill-quiz", "gate", "contrast-compare", "contrast-quiz",
    # شاشةُ الحكم في «كلمات السورة» (الحزمة ١٢): الآيةُ والخياراتُ في نظرةٍ واحدة —
    # طفلٌ يسحب ليرى بقيّة الآية يفقد سياقَ الكلمة التي يبحث عنها.
    "surah-find",
}


# الحروف الممثِّلة لأصناف الأجرام (بلاغ المهمة): ألفٌ طويلة، باءٌ منقوطة تحت، ميمٌ نازلة،
# عينٌ وسطى، غينٌ منقوطة فوق — عليها تُحكَّم المعايرة بالعين بعد أن يحكم عليها العدد.
SAMPLE_LETTERS = "ابمعغ"
# أقصى بقيّةٍ مقبولة بعد الرفعة (بكسل، عند ١٤٤ بكسل حجم خط الصندوق) — تدوير الوحدات لا أكثر.
LIFT_TOLERANCE = 1.0


def report_metrics(results) -> int:
    """معايرة توسيط الحرف: انزياح مركز الحبر عن مركز الصندوق، حرفاً حرفاً."""
    if not results:
        print("لم تصل نتيجة المعايرة من المتصفّح.")
        return 1
    m = results[0]
    rows = m["rows"]
    print(f"الخط: {m['font']}")
    print(f"مقاييسه: صعود {m['asc']:.1f} · هبوط {m['desc']:.1f}"
          f" → خط الأساس تحت مركز السطر بـ{m['base']:.1f}px\n")
    print("الحروف الممثِّلة — انزياح الحبر قبل الرفعة / الرفعة المطبَّقة / ما بقي:")
    for ch in SAMPLE_LETTERS:
        r = next((x for x in rows if x["ch"] == ch), None)
        if r:
            print(f"  {ch}: {r['off']:+7.1f}px → رفعة {r['ty']:+7.1f}px → بقي {r['rest']:+5.1f}px")
    worst = max(rows, key=lambda r: abs(r["rest"]))
    print(f"\nأسوأ بقيّةٍ في {len(rows)} حرفاً: {worst['ch']} بـ{worst['rest']:+.1f}px")
    ok = abs(worst["rest"]) <= LIFT_TOLERANCE
    print(("✓ " if ok else "✗ ") + f"حبر كل حرفٍ في مركز صندوقه ضمن السماح {LIFT_TOLERANCE}px"
          if ok else f"✗ البقيّة تتجاوز السماح {LIFT_TOLERANCE}px — راجع giantInk في ui.js")
    return 0 if ok else 1


def window_of(size: str) -> str:
    """مقاس نافذةٍ يعطي منظوراً بمقاس الجهاز المطلوب تماماً."""
    w, h = (int(x) for x in size.split(","))
    return f"{w},{h + VIEWPORT_PAD}"


def device_main(args):
    """صفحة الجهاز: قياس الفائض الرأسي بمقاسات آيباد حقيقية، أو لقطة شاشةٍ واحدة."""
    results = []
    server = make_server(args.port, results)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = Path(tempfile.mkdtemp(prefix="muallim-chrome-"))
    base = f"http://127.0.0.1:{args.port}"

    try:
        if args.shots:
            out = Path(args.shots).resolve()
            out.unlink(missing_ok=True)
            url = (f"{base}/__device.html?screen={args.screen or 'lesson-listen'}"
                   + ("&flat=1" if args.flat else ""))
            proc = run_chrome(url, profile,
                              [f"--screenshot={out}", f"--window-size={window_of(args.size or '1180,820')}",
                               "--hide-scrollbars"],
                              args.show)
            deadline = time.time() + args.timeout
            while time.time() < deadline and not out.exists():
                time.sleep(0.4)
            proc.kill()
            print(f"اللقطة: {out}" if out.exists() else "تعذّرت اللقطة")
            return 0 if out.exists() else 1

        if args.metrics:
            proc = run_chrome(f"{base}/__device.html?metrics=1", profile,
                              [f"--window-size={window_of(args.size or '1180,820')}", "--hide-scrollbars"],
                              args.show)
            deadline = time.time() + args.timeout
            while time.time() < deadline and not results:
                time.sleep(0.4)
            proc.kill()
            return report_metrics(results)

        sizes = [("مقاس مطلوب", args.size)] if args.size else DEVICE_SIZES
        runs = []
        for label, size in sizes:
            results.clear()
            proc = run_chrome(f"{base}/__device.html", profile,
                              [f"--window-size={window_of(size)}", "--hide-scrollbars"], args.show)
            deadline = time.time() + args.timeout
            while time.time() < deadline and not results:
                time.sleep(0.4)
            proc.kill()
            if not results:
                print(f"لم تصل نتيجة من المقاس {label} ({size})")
                return 1
            runs.append((label, size, list(results)))
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    bad = []
    for label, size, rows in runs:
        vw, vh = (int(x) for x in size.split(","))
        wide = vw > vh
        got = f"{rows[0]['vw']}×{rows[0]['vh']}"
        print(f"\n— {label} ({vw}×{vh}) {'عرضي' if wide else 'طولي'} —")
        if (rows[0]["vw"], rows[0]["vh"]) != (vw, vh):
            print(f"  ✗ المنظور الفعليّ {got} لا يطابق المطلوب — عايِر VIEWPORT_PAD")
            bad.append((label, "المنظور", f"جاء {got}"))
        for r in rows:
            if r.get("error"):
                print(f"  ✗ {r['label']}: عطب — {r['error']}")
                bad.append((label, r["id"], r["error"]))
                continue
            if r.get("emoji"):
                print(f"  ✗ {r['label']}: إيموجي بخطّ النظام في الشاشة — {r['emoji']}")
                bad.append((label, r["id"], f"إيموجي نصّاً: {r['emoji']}"))
            over, over_x = r["over"], r["overX"]
            must = wide and r["id"] in LANDSCAPE_MUST_FIT
            fail = over_x > 0 or (must and over > 0)
            if fail:
                bad.append((label, r["id"], f"فائض رأسي {over}px" if over else f"فائض أفقي {over_x}px"))
            mark = "✗" if fail else ("·" if over else "✓")
            # صفحاتُ المرجع مستنداتٌ تُسحَب رأسياً بطبعها — فطولُها ليس عيباً،
            # والمقيسُ فيها الأفقيُّ وحدَه (حكم المدير: `--device` يمتدّ إلى welcome/).
            if r["id"].startswith("welcome-"):
                note = f"الطول {r['h']}px — مستندٌ يُسحَب رأسياً، والمقيسُ الأفقيّ"
            else:
                note = f"الطول {r['h']}px" + (f" — فائض رأسي {over}px" if over else " — يسع الشاشة")
            print(f"  {mark} {r['label']}: {note}"
                  + (f" — فائض أفقي {over_x}px" if over_x else ""))

    if bad:
        print(f"\n{len(bad)} إخفاق:")
        for label, sid, why in bad:
            print(f"  ✗ {label} · {sid}: {why}")
        return 1
    print("\nكل الشاشات المحروسة تسع الوضع العرضي بلا سحب، ولا فائض أفقي في أي مقاس،"
          "\nولا إيموجي بخطّ النظام في أيّ شاشة (مهمة «أيقونات لا إيموجي»).")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8790)
    ap.add_argument("--timeout", type=int, default=140, help="ثوانٍ قبل الاستسلام")
    # عدّةُ التعاقب أصواتُها بمدد حقيقية فمشوارُها أطول من إخوتها
    ap.add_argument("--shots", metavar="PNG", help="لقطة للمراجعة البصرية بدل تشغيل الاختبارات")
    ap.add_argument("--words", action="store_true", help="لعبة تركيب الكلمات بدل درس الحرف")
    ap.add_argument("--review", action="store_true", help="المراجعة اليومية ولوحة وليّ الأمر")
    ap.add_argument("--story", action="store_true", help="دروس المهارات وشاشة قراءة القصص")
    ap.add_argument("--quran", action="store_true", help="المرحلة القرآنية والعمل دون إنترنت")
    ap.add_argument("--garden", action="store_true", help="بساتين الموضوعات (حديقة الكلمات)")
    ap.add_argument("--sentences", action="store_true", help="سلّم الجمل (المرحلة ج)")
    ap.add_argument("--stories", action="store_true", help="مكتبة «مصنع القصص» (المرحلة د)")
    ap.add_argument("--record", action="store_true", help="«اقرأ لي»: تسجيل صوت الطفل (المرحلة و)")
    ap.add_argument("--gate", action="store_true", help="بوابتا الإتقان: العبور والإخفاق والإعادة والترحيل")
    ap.add_argument("--parent", action="store_true",
                    help="صلابة التقدّم وتحكّم وليّ الأمر: ترقية عامل الخدمة والنسخة الاحتياطية (الحزمة ١١)")
    ap.add_argument("--roots", action="store_true",
                    help="شبكات الجذور: الشجرة و«اجمع العائلة» وقياسُها")
    ap.add_argument("--marks", action="store_true",
                    help="قياس العلامات: الدرس يقيس، والمراجعة والبوابة واللوحة تقرؤه")
    ap.add_argument("--contrast", action="store_true",
                    help="محطتا «ميّز بين»: مواجهة المتشابهات و«اسمع الفرق» (الحزمة ١٣)")
    ap.add_argument("--fade", action="store_true",
                    help="خفوت التشكيل ز١→ز٣: العتبة والكشف عند الطلب وحصانة التهجّي والمصحف")
    ap.add_argument("--voice", action="store_true",
                    help="قياس التعاقب الصوتي: أصوات بمدة حقيقية، لا تراكب ولا قطش مبرمَج (بلاغ احسب)")
    ap.add_argument("--map", action="store_true", help="الخريطة: جبهة الفتح والطيّ الكسول وقياسهما")
    ap.add_argument("--welcome", action="store_true",
                    help="الصفحة التعريفية: لا طلب خارجي، ولا يبتلعها عامل الخدمة (ومع --shots لقطتها)")
    ap.add_argument("--device", action="store_true",
                    help="قياس الفائض الرأسي بمقاسات جهاز حقيقي في الوضعين (ومعه --shots --screen للقطة)")
    ap.add_argument("--screen", help="اسم شاشةٍ واحدة في صفحة الجهاز (مع --device --shots)")
    ap.add_argument("--metrics", action="store_true",
                    help="معايرة توسيط الحرف البطل في صندوقه (مع --device)")
    ap.add_argument("--flat", action="store_true",
                    help="لقطةٌ بلا رفعة الحرف — صورة «قبل» للمقارنة (مع --device --shots)")
    ap.add_argument("--size", help="مقاس النافذة W,H لصفحة الجهاز (مع --device)")
    ap.add_argument("--show", action="store_true", help="متصفّح مرئي")
    args = ap.parse_args()
    if args.voice and args.timeout == 140:
        args.timeout = 165
    if args.welcome and args.timeout == 140:
        args.timeout = 300   # مهلةُ التفعيل الموسّعة (خزنُ التثبيت الكامل تحت حمل)

    if args.device:
        return device_main(args)

    results = []
    server = make_server(args.port, results)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = Path(tempfile.mkdtemp(prefix="muallim-chrome-"))
    base = f"http://127.0.0.1:{args.port}"

    try:
        if args.shots:
            out = Path(args.shots).resolve()
            out.unlink(missing_ok=True)   # وإلا لعُدَّت لقطةُ تشغيلٍ سابق نجاحاً فوريّاً
            # الصفحة التعريفية تُلتقط **كما تُنشَر** (لا صفحةَ قيادةٍ لها: لا جافاسكربت فيها)
            page, size = (("welcome/", "1100,7900") if args.welcome
                          else ("__parent_shots.html", "1100,6400") if args.parent
                          else ("__contrast_shots.html", "1100,2600") if args.contrast
                          else ("__gate_shots.html", "1100,2400") if args.gate
                          else ("__map_shots.html", "1100,2600") if args.map
                          else ("__record_shots.html", "1100,3200") if args.record
                          else ("__stories_shots.html", "1100,4200") if args.stories
                          else ("__sentences_shots.html", "1100,3400") if args.sentences
                          else ("__review_shots.html", "1100,3050") if args.review
                          else ("__garden_shots.html", "1100,5200") if args.garden
                          else ("__quran_shots.html", "1100,9400") if args.quran
                          else ("__story_shots.html", "1100,5400") if args.story
                          else ("__words_shots.html", "980,2100") if args.words
                          else ("__shots.html", "980,2650"))
            proc = run_chrome(f"{base}/{page}?dev=1", profile,
                              [f"--screenshot={out}", f"--window-size={size}", "--hide-scrollbars"]
                              + (FAKE_MEDIA if args.record else []),
                              args.show)
            deadline = time.time() + args.timeout
            while time.time() < deadline and not out.exists():
                time.sleep(0.5)
            proc.kill()
            print(f"اللقطة: {out}" if out.exists() else "تعذّرت اللقطة")
            return 0 if out.exists() else 1

        page = ("__welcome.html" if args.welcome
                else "__voice.html" if args.voice
                else "__fade.html" if args.fade
                else "__parent.html" if args.parent
                else "__roots.html" if args.roots
                else "__marks.html" if args.marks
                else "__contrast.html" if args.contrast
                else "__gate.html" if args.gate
                else "__map.html" if args.map
                else "__review.html" if args.review else "__story.html" if args.story
                else "__quran.html" if args.quran else "__garden.html" if args.garden
                else "__sentences.html" if args.sentences
                else "__stories.html" if args.stories
                else "__record.html" if args.record
                else "__words.html" if args.words else "__test.html")
        proc = run_chrome(f"{base}/{page}", profile,
                          ["--hide-scrollbars"] + (FAKE_MEDIA if args.record else []), args.show)
        deadline = time.time() + args.timeout
        while time.time() < deadline:
            time.sleep(0.5)
            if results and results[-1].get("msg", "").startswith(("لا أخطاء جافاسكربت", "استثناء", "انتهت المهلة", "اكتمل القياس", "تعطّل القياس")):
                break
        proc.kill()
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    if not results:
        print("لم تصل أي نتيجة من المتصفّح (تحقّق من تشغيل Chrome).")
        return 1

    failed = [r for r in results if not r["ok"]]
    for r in results:
        print(("  ✓ " if r["ok"] else "  ✗ ") + r["msg"])
    print(f"\n{len(results) - len(failed)}/{len(results)} تحقّقاً ناجحاً"
          + (f" — {len(failed)} إخفاق" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
