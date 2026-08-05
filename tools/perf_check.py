#!/usr/bin/env python3
"""عدّة قياس السرعة — تشغّل `app/welcome/perf-check.html` وتجمع أرقامها نصّاً.

    python3 tools/perf_check.py              # قياسٌ محليّ في Chrome (وضع `#auto`)
    python3 tools/perf_check.py --serve      # خادمٌ للشبكة المحلية: يُفتح على الآيباد
    python3 tools/perf_check.py --self-test  # فحصٌ ذاتيّ بلا شبكة ولا متصفّح

**لماذا نصّاً لا صورة** (١٣ أغسطس ٢٠٢٦): لقطةُ Chrome بلا رأسٍ تخرج بيضاء متى صُوّرت
قبل الطلاء، وقد خرجت كذلك أولَ مرة. فالصفحةُ في وضع `#auto` تُرسل أرقامَها إلى
`/__perf` وهذه العدّةُ تطبعها — كما يفعل `browser_test.py` سواءً بسواء.

**ولا تمسّ تقدّمَ الطفل**: الصفحةُ نفسُها تصوّر الذاكرة المحلّية قبل القياس وتعيدها
بعده، ولا تنقر جواباً — تتنقّل وتُسمِع فحسب.
"""

import argparse
import http.server
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'app'
PAGE = APP / 'welcome' / 'perf-check.html'

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

collected: list[str] = []


class Handler(http.server.SimpleHTTPRequestHandler):
    """يخدم `app/` ويستقبل أرقام القياس على `/__perf`."""

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP), **kw)

    def do_POST(self):                                    # noqa: N802 (واجهة المكتبة)
        if self.path != '/__perf':
            return self.send_error(404)
        size = int(self.headers.get('content-length') or 0)
        collected.append(self.rfile.read(size).decode('utf-8'))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):                            # صمتاً: الطباعةُ للأرقام وحدها
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def lan_address() -> str:
    """عنوانُ هذا الحاسوب على الشبكة المحلية — به يُفتَح القياسُ من الآيباد."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(('8.8.8.8', 80))                     # لا يُرسل شيئاً — لاختيار الواجهة
        return sock.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        sock.close()


def serve(port: int) -> Server:
    server = Server(('0.0.0.0', port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def measure(port: int, timeout: int) -> int:
    """قياسٌ محليّ: Chrome بلا رأس يفتح الصفحة في وضع `#auto` وينتظر أرقامَها."""
    if not Path(CHROME).exists():
        print('✗ لم أجد Chrome — استعمل `--serve` وافتح الصفحة بيدك')
        return 1
    server = serve(port)
    profile = tempfile.mkdtemp(prefix='perf-')
    url = f'http://127.0.0.1:{port}/welcome/perf-check.html#auto'
    chrome = subprocess.Popen(
        [CHROME, '--headless=new', '--disable-gpu', '--no-first-run',
         f'--user-data-dir={profile}', '--autoplay-policy=no-user-gesture-required', url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + timeout
    while not collected and time.time() < deadline:
        time.sleep(0.25)
    chrome.terminate()
    server.shutdown()
    if not collected:
        print(f'✗ لم تصل أرقامٌ خلال {timeout} ثانية — جرّب `--serve` وافتحها بيدك')
        return 1
    print('\nقياسُ السرعة (هذا الحاسوب — لا الآيباد):\n')
    print(collected[0])
    return 0


def self_test() -> int:
    """بلا شبكة ولا متصفّح: صفحةُ القياس موجودةٌ وفيها ما تَعِد به."""
    checks = []
    text = PAGE.read_text(encoding='utf-8') if PAGE.exists() else ''
    checks.append((PAGE.exists(), f'صفحةُ القياس موجودة ({PAGE.relative_to(ROOT)})'))
    checks.append(('snapshot()' in text and 'restore(keep)' in text,
                   'وتصوّر تقدّمَ الطفل قبل القياس وتعيده بعده'))
    checks.append(('localStorage.clear()' not in text,
                   '**ولا تمسح مخزنَه** — تحذف ما استُحدث وتعيد ما تبدّل (فانقطاعُ القياس لا يُضيع تقدّماً)'))
    checks.append(("location.hash === '#auto'" in text,
                   'ولها وضعٌ آليّ تُقاد به بلا يد'))
    checks.append(("fetch('/__perf'" in text,
                   'وترسل أرقامَها نصّاً (لا لقطةً قد تخرج بيضاء)'))
    checks.append(('<script' in text and 'welcome' in str(PAGE),
                   'وهي في `welcome/` — خارج اعتراض عامل الخدمة'))
    bad = [msg for good, msg in checks if not good]
    for good, msg in checks:
        print(('  ✓ ' if good else '  ✗ ') + msg)
    print('\n' + ('عدّةُ قياس السرعة سليمة (بلا شبكة).' if not bad else f'{len(bad)} فشل'))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description='قياس سرعة التطبيق على الجهاز')
    ap.add_argument('--serve', action='store_true', help='خادمٌ للشبكة المحلية (للآيباد)')
    ap.add_argument('--port', type=int, default=8899)
    ap.add_argument('--timeout', type=int, default=90, help='ثوانٍ قبل الاستسلام')
    ap.add_argument('--self-test', action='store_true', help='فحصٌ ذاتيّ بلا شبكة')
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    if args.serve:
        serve(args.port)
        print(f'\nافتح على الآيباد:  http://{lan_address()}:{args.port}/welcome/perf-check.html')
        print('واضغط «ابدأ القياس». (Ctrl+C للإيقاف)\n')
        try:
            while True:
                time.sleep(0.5)
                while collected:
                    print('—— وصلت أرقامٌ من جهاز ——\n')
                    print(collected.pop(0))
        except KeyboardInterrupt:
            return 0

    return measure(args.port, args.timeout)


if __name__ == '__main__':
    sys.exit(main())
