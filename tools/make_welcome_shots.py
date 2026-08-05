#!/usr/bin/env python3
"""لقطات «رحلة التعلم» في الصفحة التعريفية — تُلتقط من التطبيق نفسِه بلا أي تبعية.

    python3 tools/make_welcome_shots.py            # يولّد app/welcome/shots/*.png
    python3 tools/make_welcome_shots.py --check    # يتحقّق من وجودها وسلامتها بلا توليد
    python3 tools/make_welcome_shots.py --only map # لقطة واحدة (للتجربة)

لماذا أداة لا يد مصمّم: الصفحة التعريفية تَعِد المعلّمَ بما في التطبيق، فصورتُها يجب أن
تكون التطبيقَ لا رسماً له. الشاشات تُبنى في `tools/welcome_shots.html` باستيراد وحدات
التطبيق كما تُبنى للطفل، وتُلتقط هنا بمقاس آيباد طوليّ حقيقي — فأيّ تغيّرٍ في الشاشة
يظهر في اللقطة بإعادة التوليد، لا بتحرير صورة.

وكل لقطةٍ تُلتقط مرّتين: **قياسٌ** لطول محتواها في نافذةٍ طويلة، ثم **التقاطٌ** بنافذةٍ
بطول محتواه — فلا يبقى في الصورة ورقٌ خاوٍ تحت الشاشة ولا يُقصّ منها شيء. والطول
محصورٌ بين عرضِ الجهاز (كي لا تنقلب النافذة عرضيةً فيتبدّل التصفيف) وطولِ الآيباد
(فالشاشات الطويلة تُعرض كما تُرى على الجهاز: أوّلُها، وبقيّتها بالسحب عند الطفل).

ملاحظة: هذه أصول رسومية لا صوت — قيد «لا تلمس app/audio/» لا يمسّها (كما في make_icons.py).
"""

import argparse
import http.server
import json
import shutil
import socketserver
import struct
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
TOOLS = ROOT / "tools"
OUT = APP / "welcome" / "shots"
PAGE = TOOLS / "welcome_shots.html"
PAGE_PATH = "/__welcome_shots.html"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DEVICE_W, DEVICE_H = 820, 1180        # آيباد ١٠٫٩ طولي (من DEVICE_SIZES في browser_test.py)
MEASURE_H = 4000                      # نافذةُ القياس: أطول من أطول شاشة فلا يُقصّ القياس

# (المعرّف، عنوانُ الشاشة في الصفحة التعريفية) — والمعرّف اسمُ الشاشة في welcome_shots.html
SHOTS = [
    ("map", "درب الرحلة"),
    ("lesson", "درس الحرف"),
    ("words", "ركّب واقرأ"),
    ("story", "قصة مفكوكة"),
    ("quran", "المرحلة القرآنية"),
    ("parent", "لوحة وليّ الأمر"),
    # المرحلة الثانية من «المرجع التعريفي» (إذنُ المدير): لقطةٌ بجوار كل نوع محطة
    ("gate", "بوابة الإتقان"),
    ("contrast", "ميّز بين"),
    ("garden", "باقة البستان"),
    ("ladder", "سلّم الجمل"),
    ("roots", "شجرة الجذر"),
    ("shelf", "قصة الرفّ"),
    ("fade", "خفوت التشكيل"),
]


def png_size(path: Path):
    """(العرض، الارتفاع) من ترويسة PNG — تحقّقٌ بلا مكتبات."""
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", data[16:24])


def make_server(port: int, results: list):
    """خادمُ مجلد app/ ومعه صفحةُ اللقطات وحدها (فلا تبقى صفحةُ عدّةٍ تُخدَم للطفل)."""

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(APP), **kw)

        def do_GET(self):
            if self.path.split("?")[0] == PAGE_PATH:
                body = PAGE.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            try:
                results.extend(json.loads(raw.decode("utf-8")))
            except json.JSONDecodeError:
                pass
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    return socketserver.TCPServer(("127.0.0.1", port), Handler)


def run_chrome(url: str, profile: Path, extra: list):
    if not Path(CHROME).exists():
        sys.exit(f"لم يُعثر على Chrome في {CHROME}")
    cmd = [CHROME, f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
           "--headless=new", "--disable-gpu", "--hide-scrollbars"] + extra + [url]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait(proc, until, timeout: int) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline and not until():
        time.sleep(0.4)
    proc.kill()
    return until()


def capture(base: str, profile: Path, results: list, screen: str, timeout: int) -> Path:
    """قياسُ طول الشاشة ثم التقاطُها بنافذةٍ بطوله."""
    results.clear()
    proc = run_chrome(f"{base}{PAGE_PATH}?screen={screen}&measure=1", profile,
                      [f"--window-size={DEVICE_W},{MEASURE_H}"])
    if not wait(proc, lambda: bool(results), timeout):
        sys.exit(f"لم يصل قياسُ طول الشاشة «{screen}»")
    height = max(DEVICE_W + 1, min(DEVICE_H, int(results[0]["height"])))

    out = OUT / f"{screen}.png"
    out.unlink(missing_ok=True)
    proc = run_chrome(f"{base}{PAGE_PATH}?screen={screen}", profile,
                      [f"--screenshot={out}", f"--window-size={DEVICE_W},{height}"])
    if not wait(proc, out.exists, timeout):
        sys.exit(f"تعذّرت لقطة «{screen}»")
    return out


def generate(args) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    server = make_server(args.port, results)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = Path(tempfile.mkdtemp(prefix="muallim-shots-"))
    base = f"http://127.0.0.1:{args.port}"
    try:
        for screen, title in SHOTS:
            if args.only and screen != args.only:
                continue
            out = capture(base, profile, results, screen, args.timeout)
            w, h = png_size(out)
            print(f"  ✓ {out.relative_to(ROOT)} — {title} ({w}×{h})")
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    print(f"\n{len(SHOTS) if not args.only else 1} لقطة في {OUT.relative_to(ROOT)}")
    return 0


def check() -> int:
    """لا لقطةَ ناقصة ولا معطوبة ولا بمقاسٍ غريب — ولا لقطةَ يتيمة لا تعرضها صفحة.

    و**المقروءُ صفحاتُ `welcome/` كلُّها** لا الرئيسةَ وحدَها (المرجع صار موقعاً من
    أربع صفحات): لقطةٌ تعرضها صفحةُ المنهج مذكورةٌ، ولقطةٌ لا تعرضها صفحةٌ يتيمة.
    """
    fails = 0
    pages = sorted((APP / "welcome").glob("*.html"))
    html = "\n".join(p.read_text(encoding="utf-8") for p in pages)
    for screen, title in SHOTS:
        path = OUT / f"{screen}.png"
        size = png_size(path) if path.exists() else None
        if not size:
            print(f"  ✗ {screen}.png: مفقودة أو ليست PNG")
            fails += 1
            continue
        w, h = size
        if w != DEVICE_W or not (DEVICE_W < h <= DEVICE_H):
            print(f"  ✗ {screen}.png: مقاس {w}×{h} خارج مقاس الجهاز")
            fails += 1
            continue
        if f"shots/{screen}.png" not in html:
            print(f"  ✗ {screen}.png: لا تعرضها صفحةٌ من صفحات المرجع")
            fails += 1
            continue
        print(f"  ✓ {screen}.png ({w}×{h}) — {title}")

    extra = [p.name for p in sorted(OUT.glob("*.png"))
             if p.stem not in {s for s, _ in SHOTS}]
    if extra:
        print(f"  ✗ لقطات يتيمة لا تعرفها الأداة: {'، '.join(extra)}")
        fails += len(extra)
    print(f"\n{fails} إخفاق" if fails else "\nكل لقطات الصفحة التعريفية سليمة")
    return 1 if fails else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="تحقّق بلا توليد")
    ap.add_argument("--only", help="لقطة واحدة بمعرّفها")
    ap.add_argument("--port", type=int, default=8796)
    ap.add_argument("--timeout", type=int, default=60)
    args = ap.parse_args()
    return check() if args.check else generate(args)


if __name__ == "__main__":
    sys.exit(main())
