#!/usr/bin/env python3
"""جرد التكرار الداخلي في أصوات النواة — **بلا حصة TTS وبلا ffmpeg**.

    python3 tools/audio_audit.py --scan       # مدد كل ملفات النواة + الشواذ
    python3 tools/audio_audit.py --analyze    # تحليل النطقات في متصفّح حقيقي
    python3 tools/audio_audit.py --fix        # قصّ المكرر البشري + جدولة المولَّد
    python3 tools/audio_audit.py --page       # صفحة سماع «قبل/بعد» للتصديق

بلاغ المالك (٤ أغسطس ٢٠٢٦): بعض أصوات الحروف تُنطق مرتين داخل الملف الواحد.

طريقتان متكاملتان:
  ١) **المدة** تُقرأ بتحليل إطارات mp3 في بايثون (بلا مكتبات): مدة تتجاوز
     ١٫٧ × وسيط فئتها = مشتبه.
  ٢) **بنية النطقات** تُقاس في متصفّح حقيقي: يُفكّ الملف وتُحسب مغلّفة الطاقة،
     فتُعدّ المقاطع المصوّتة المفصولة بصمت — نطقتان متقاربتان الطول = تكرار.
     المدة وحدها لا تكفي: نصٌّ طويل بطبعه يشبه نصاً مكرراً.
"""

import argparse
import json
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import http.server
import socketserver
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_audio as gen  # noqa: E402

WORK = gen.ROOT / "scratch" / "audio_audit"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CORE_CATEGORIES = ("letter_name", "letter_haraka", "syllable")
SUSPECT_RATIO = 1.7          # مدة > ١٫٧ × وسيط الفئة = مشتبه
GAP_MS = 120                 # صمت بهذا الطول فأكثر يفصل نطقة عن أخرى
SILENCE_DB = 0.06            # عتبة الصمت نسبةً إلى الذروة


# ————————————————————————— مدة mp3 بلا مكتبات —————————————————————————

# قارئ المدة يعيش في generate_audio.py ليستعمله حارس --verify-only أيضاً
mp3_duration = gen.mp3_duration


# ————————————————————————— الجرد بالمدة —————————————————————————

def core_texts() -> dict:
    """نصوص النواة الموجودة على القرص ← (فئتها، مسار ملفها)."""
    texts, pending = gen.expected_texts()
    out = {}
    for text, cat in {**texts, **pending}.items():
        if cat not in CORE_CATEGORIES:
            continue
        p = gen.OUT_DIR / f"{gen.key_for(text)}.mp3"
        if p.exists():
            out[text] = (cat, p)
    return out


def scan() -> dict:
    rows = []
    for text, (cat, path) in core_texts().items():
        rows.append({"text": text, "cat": cat, "file": path.name,
                     "sec": round(mp3_duration(path), 3)})
    medians = {}
    for cat in CORE_CATEGORIES:
        secs = [r["sec"] for r in rows if r["cat"] == cat]
        if secs:
            medians[cat] = round(statistics.median(secs), 3)
    for r in rows:
        med = medians.get(r["cat"], 0)
        r["ratio"] = round(r["sec"] / med, 2) if med else 0
        r["suspect"] = bool(med and r["sec"] > SUSPECT_RATIO * med)

    print(f"جرد مدد النواة: {len(rows)} ملفاً")
    for cat in CORE_CATEGORIES:
        part = [r for r in rows if r["cat"] == cat]
        if not part:
            continue
        sus = [r for r in part if r["suspect"]]
        print(f"  {gen.CATEGORY_AR[cat]:<12} {len(part):>4} ملفاً · وسيط "
              f"{medians[cat]:.2f}ث · حدّ الاشتباه {SUSPECT_RATIO * medians[cat]:.2f}ث "
              f"· مشتبه {len(sus)}")
    suspects = sorted((r for r in rows if r["suspect"]), key=lambda r: -r["ratio"])
    if suspects:
        print("\n  المشتبهات (الأطول أولاً):")
        for r in suspects[:25]:
            print(f"    {r['text']:<6} {r['sec']:>5.2f}ث  ×{r['ratio']:<5} {r['file']}")
        if len(suspects) > 25:
            print(f"    … و{len(suspects) - 25} غيرها")
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "scan.json").write_text(json.dumps(
        {"medians": medians, "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"medians": medians, "rows": rows}


# ————————————————————————— تحليل النطقات في متصفّح حقيقي —————————————————————————

PAGE = """<!doctype html><meta charset=utf-8><body><script>
(async () => {
  const files = %s, out = [];
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  for (const f of files) {
    try {
      const buf = await (await fetch('%s' + f)).arrayBuffer();
      const a = await ctx.decodeAudioData(buf);
      const d = a.getChannelData(0), sr = a.sampleRate;
      const win = Math.round(sr * 0.02);           // نافذة ٢٠ مِلّي ثانية
      const env = [];
      for (let i = 0; i < d.length; i += win) {
        let s = 0, n = 0;
        for (let j = i; j < Math.min(i + win, d.length); j++) { s += d[j] * d[j]; n++; }
        env.push(Math.sqrt(s / Math.max(n, 1)));
      }
      const peak = Math.max(...env), thr = peak * %f;
      const minGap = Math.round(%d / 20);          // نوافذ الصمت الفاصل
      const segs = [];
      let start = -1, quiet = 0;
      for (let i = 0; i < env.length; i++) {
        if (env[i] >= thr) {
          if (start < 0) start = i;
          quiet = 0;
        } else if (start >= 0 && ++quiet >= minGap) {
          segs.push([start * 0.02, (i - quiet) * 0.02]); start = -1;
        }
      }
      if (start >= 0) segs.push([start * 0.02, env.length * 0.02]);
      out.push({file: f, sec: +a.duration.toFixed(3), peak: +peak.toFixed(4),
                segs: segs.map(s => s.map(x => +x.toFixed(2)))});
    } catch (e) { out.push({file: f, error: String(e)}); }
  }
  await fetch('/result', {method: 'POST', body: JSON.stringify(out)});
})();
</script>"""


def analyze(files: list, serve_dir: Path | None = None, prefix: str = "audio/") -> list:
    """يعيد لكل ملف مقاطعه المصوّتة (بداية، نهاية) — يقيسها متصفّح حقيقي."""
    results = []
    root = serve_dir or (gen.ROOT / "app")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def do_GET(self):
            if self.path.startswith("/__audit"):
                body = (PAGE % (json.dumps(files), prefix, SILENCE_DB, GAP_MS)).encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def do_POST(self):
            results[:] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as srv:
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        with tempfile.TemporaryDirectory() as prof:
            p = subprocess.Popen(
                [CHROME, "--headless=new", f"--user-data-dir={prof}", "--no-first-run",
                 "--autoplay-policy=no-user-gesture-required",
                 f"http://127.0.0.1:{port}/__audit"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(int(len(files) * 3 + 120)):
                if results:
                    break
                time.sleep(0.25)
            p.kill()
    return results


def classify(rows: list, analysis: list) -> list:
    """يصنّف: تكرارٌ فعليّ أم طول طبيعي — بعدد النطقات المتوقَّع لا بأول مقطعين.

    درسان من ٤ أغسطس ٢٠٢٦:
      ١) الشظايا (نَفَسٌ أو انفجار ٠٫٠٢–٠٫١ث) ليست نطقات، فتُطرح قبل الحكم —
         ولولا ذلك لأفلتت «عَةْ» (٠٫٦٨ + شظية + ٠٫٦٨) بحجّة «مقاطع متفاوتة».
      ٢) النصّ ذو الكلمتين («سُكْ كَرْ») نطقتاه **متوقّعتان**، فالمعيار عدد
         الكلمات: نطقاتٌ أكثر من كلماته = تكرار، وبقدرها = طبيعي.
      ٣) والفاصل هو الفيصل: «مَقْعَدْ» تنقطع ٠٫١٨ث عند سكون القاف وهذا نطقٌ سليم،
         أمّا «عَةْ» ففاصلها ٢٫٨٦ث — صمتٌ لا يقع داخل كلمة، فهي إعادة نطق.
    """
    MIN_SEG = 0.18                       # أقصر ما يُعدّ نطقةً لا شظية
    REPEAT_GAP = 0.5                     # الفاصل الذي يميّز إعادة النطق من وقفةٍ داخلية
    by_file = {a["file"]: a for a in analysis}
    out = []
    for r in rows:
        a = by_file.get(r["file"])
        if not a or a.get("error"):
            continue
        segs = a.get("segs", [])
        big = [(s, e) for s, e in segs if e - s >= MIN_SEG]
        lens = [round(e - s, 2) for s, e in big]
        expected = max(1, len(str(r["text"]).split()))
        verdict, why = "طول طبيعي", f"{len(lens)} نطقة لـ{expected} كلمة: {lens}"
        gaps = [round(big[i + 1][0] - big[i][1], 2) for i in range(len(big) - 1)]
        wide = [g for g in gaps if g >= REPEAT_GAP]
        if len(big) > expected and wide:
            verdict = "تكرار"
            why = (f"{len(big)} نطقات ({lens}) والمتوقَّع {expected} — "
                   f"وبينها صمتٌ {max(wide)}ث")
        elif len(big) > expected:
            why = (f"{len(big)} نطقات لـ{expected} كلمة بفواصل قصيرة {gaps} — "
                   "وقفةٌ داخلية (سكون أو شدّة) لا إعادة")
        out.append({**r, "segs": segs, "lens": lens, "verdict": verdict, "why": why})
    return out


# ————————————————————————— صفحة السماع —————————————————————————

def write_page(rows: list, note: str) -> Path:
    """صفحة تصديق: الأطول أولاً، وزرّ سماع لكل ملف، وبنية نطقاته مكتوبة."""
    WORK.mkdir(parents=True, exist_ok=True)
    audio_dir = WORK / "audio"
    audio_dir.mkdir(exist_ok=True)
    cells = []
    for r in sorted(rows, key=lambda r: -r["sec"])[:60]:
        src = gen.OUT_DIR / r["file"]
        if src.exists():
            shutil.copy2(src, audio_dir / r["file"])
        cells.append(
            f'<tr><th>{r["text"]}</th>'
            f'<td>{gen.CATEGORY_AR.get(r.get("cat"), "—")}</td>'
            f'<td>{r["sec"]:.2f}ث</td>'
            f'<td>{r.get("verdict", "—")}</td>'
            f'<td class="why">{r.get("why", "")}</td>'
            f'<td><button data-src="audio/{r["file"]}">▶</button></td></tr>')
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>جرد التكرار الداخلي — تصديق بالأذن</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:56rem; line-height:1.9 }}
 table {{ border-collapse:collapse; margin-top:1rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.4rem .7rem; background:#fff; text-align:center }}
 th {{ background:#f0e8db; font-size:1.2rem; min-width:4.5rem }}
 td.why {{ font-family:system-ui; font-size:.75rem; color:#6b5f4f; max-width:20rem }}
 button {{ font-family:inherit; font-size:1rem; padding:.3rem .9rem; cursor:pointer;
           border:1px solid #c9bba6; border-radius:.45rem; background:#fdfaf4 }}
 button.playing {{ background:#2f7d4f; color:#fff }}
</style></head><body>
<h1>جرد التكرار الداخلي — أطول ملفات النواة</h1>
<p class="note">{note}</p>
<table><thead><tr><th>النص</th><th>الفئة</th><th>المدة</th><th>الحكم الآلي</th>
<th>التفصيل</th><th>سماع</th></tr></thead><tbody>{"".join(cells)}</tbody></table>
<script>
let cur = null, btn = null;
document.addEventListener('click', (e) => {{
  const b = e.target.closest('button[data-src]'); if (!b) return;
  if (cur) cur.pause();
  if (btn) btn.classList.remove('playing');
  cur = new Audio(b.dataset.src); btn = b; b.classList.add('playing');
  cur.onended = () => b.classList.remove('playing');
  cur.play();
}});
</script></body></html>"""
    out = WORK / "index.html"
    out.write_text(html, encoding="utf-8")
    return out


def main():
    ap = argparse.ArgumentParser(description="جرد التكرار الداخلي")
    ap.add_argument("--scan", action="store_true", help="مدد النواة وشواذها")
    ap.add_argument("--analyze", action="store_true", help="تحليل النطقات في متصفّح حقيقي")
    ap.add_argument("--page", action="store_true", help="صفحة سماع للتصديق")
    ap.add_argument("--all", action="store_true", help="على كل الفهرس لا النواة وحدها")
    ap.add_argument("--repair", action="store_true",
                    help="إصلاح ذاتي: يعيد توليد المكرَّر حتى تخرج نطقةٌ واحدة")
    ap.add_argument("--orphans", action="store_true",
                    help="اليتيم الدلاليّ: ملفٌ في الفهرس لم تعد بيانات التطبيق تطلبه")
    args = ap.parse_args()

    if args.repair:
        sys.exit(repair(args.dry_run if hasattr(args, "dry_run") else False))

    if args.orphans:
        rows = semantic_orphans()
        print(f"اليتيم الدلاليّ: {len(rows)} ملفاً")
        for r in rows:
            print(f"  «{r['text'][:60]}» · {r['key']}.mp3 · {r['bytes'] // 1024}KB "
                  f"· طلبته {r['requestedBy']}")
        if not rows:
            print("  ✓ كل ملف في الفهرس تطلبه بيانات التطبيق.")
        return 0

    data = scan()
    rows = data["rows"]
    if args.all:
        man = json.loads((gen.OUT_DIR / "manifest.json").read_text(encoding="utf-8"))
        known = {r["file"] for r in rows}
        for key, text in man.items():
            if f"{key}.mp3" not in known and (gen.OUT_DIR / f"{key}.mp3").exists():
                rows.append({"text": text, "cat": "?", "file": f"{key}.mp3",
                             "sec": round(mp3_duration(gen.OUT_DIR / f"{key}.mp3"), 3),
                             "ratio": 0, "suspect": False})

    if args.analyze or args.page:
        analysis = analyze([r["file"] for r in rows])
        (WORK / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=1),
                                            encoding="utf-8")
        rows = classify(rows, analysis)
        dup = [r for r in rows if r["verdict"] == "تكرار"]
        print(f"\nتحليل النطقات: {len(rows)} ملفاً · مصنَّف تكراراً: {len(dup)}")
        for r in dup:
            print(f"  ✗ {r['text']} ({r['sec']:.2f}ث): {r['why']}")
        if not dup:
            print("  ✓ لا ملف فيه نطقتان متقاربتان — لا تكرار داخلياً.")
        (WORK / "classified.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1),
                                              encoding="utf-8")

    if args.page:
        dup = [r for r in rows if r.get("verdict") == "تكرار"]
        note = ("لا ملف مصنَّفاً تكراراً — هذه أطول ملفات النواة للتصديق بالأذن. "
                "إن سمعتَ نطقاً مكرراً في أحدها فبلّغ نصَّه ليُعالَج." if not dup else
                f"{len(dup)} ملفاً مصنَّفاً تكراراً — استمع وصدِّق قبل المعالجة.")
        out = write_page(rows, note)
        print(f"\nصفحة التصديق: {out}")
        print(f"افتحها: .venv/bin/python -m http.server 8070 -d {WORK} → http://127.0.0.1:8070/")
    return 0


# ————————————————————————— اليتيم الدلاليّ —————————————————————————

def wanted_texts() -> set:
    """ما تطلبه بيانات التطبيق اليوم (من مستخرِج القائمة نفسه — لا نكرّر منطقه)."""
    out = subprocess.run(["node", "tools/queue_texts.mjs", "--wanted-json"],
                         cwd=gen.ROOT, capture_output=True, text=True, check=True).stdout
    return {row[0] for row in json.loads(out.strip().splitlines()[-1])}


def semantic_orphans() -> list:
    """ملفٌ في الفهرس لم تعد بيانات التطبيق تطلبه — لا يراه `--verify-only`.

    مثاله المكتشَف (٤ أغسطس ٢٠٢٦): جملة المدّ القديمة بقيت ملفاً ومدخلاً `done`
    بعدما أعادت الجلسةُ ٤ صياغتَها؛ فالمدقّق يعدّها سليمة (لها نصّ في القائمة)
    والتطبيق لا يشغّلها أبداً — وزنٌ ميت يُشحن إلى جهاز الطفل ويُخزَّن فيه.
    """
    man = json.loads((gen.OUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    curriculum = set(gen.parse_curriculum(gen.CURRICULUM.read_text(encoding="utf-8")))
    keep = wanted_texts() | curriculum | set(gen.recitation_texts())
    queue = {e["text"]: e for e in gen.load_queue()}
    out = []
    for key, text in man.items():
        if text in keep:
            continue
        p = gen.OUT_DIR / f"{key}.mp3"
        e = queue.get(text, {})
        out.append({"text": text, "key": key, "requestedBy": e.get("requestedBy", "منهج"),
                    "model": e.get("model", ""), "bytes": p.stat().st_size if p.exists() else 0})
    return out

# ————————————————————————— حلقة الإصلاح الذاتي —————————————————————————

NO_REPEAT = ("انطق هذا النصّ **مرة واحدة فقط** بلا إعادة ولا تكرار، "
             "بتأنٍّ ووضوح لطفل يتعلم القراءة: ")
REPAIR_TRIES = 3


def repair(dry_run: bool = False) -> int:
    """يعيد توليد كل ملفٍ ثبت تكرارُه، ويقبل أول محاولة تخرج بنطقةٍ واحدة.

    الأذن للجودة، والمحلّل للعيب: التكرار عيبٌ يُقاس فيُصلَح بلا انتظار سماع.
    وإن عاندت ثلاثُ محاولات أُبقي الأقلّ نطقاتٍ ورُفع النصّ للمالك.
    """
    dupes = [r for r in current_classification() if r["verdict"] == "تكرار"]
    if not dupes:
        print("لا ملف مكرَّراً — لا شيء يُصلَح.")
        return 0
    print(f"مكرَّر: {len(dupes)} ملفاً" + (" (تجربة جافّة)" if dry_run else ""))
    if dry_run:
        for r in dupes:
            print(f"  ⟶ {r['text'][:30]} ({r['sec']}ث)")
        return 0

    gen.set_rpm(8)
    pool = gen.KeyPool(gen.read_keys(), gen.DEFAULT_VOICE)
    work = WORK / "repair"
    work.mkdir(parents=True, exist_ok=True)
    fixed = stubborn = 0
    for r in dupes:
        text = r["text"]
        best = None
        for attempt in range(1, REPAIR_TRIES + 1):
            try:
                pcm, rate, _key = pool.call(text, NO_REPEAT, gen.MODEL_CORE)
            except Exception as e:  # noqa: BLE001
                print(f"  ✗ {text}: {str(e)[:60]}", file=sys.stderr)
                break
            cand = work / f"{gen.key_for(text)}__{attempt}.mp3"
            gen.pcm_to_mp3(pcm, rate, cand)
            row = {"text": text, "cat": r.get("cat", "?"), "file": cand.name,
                   "sec": round(gen.mp3_duration(cand), 2)}
            res = classify([row], analyze([cand.name], serve_dir=work, prefix=""))
            if not res:
                continue
            n_utt = len(res[0]["lens"])
            if best is None or n_utt < best[0]:
                best = (n_utt, cand, res[0])
            if res[0]["verdict"] != "تكرار":
                shutil.copy2(cand, gen.OUT_DIR / f"{gen.key_for(text)}.mp3")
                gen.mark_done(text, f"{gen.MODEL_CORE}#no-repeat")
                fixed += 1
                print(f"  ✓ {text}: صحّت في المحاولة {attempt} ({row['sec']}ث، نطقة واحدة)")
                break
        else:
            stubborn += 1
            print(f"  ⚠ {text}: عاندت {REPAIR_TRIES} محاولات — أقلّها {best[0]} نطقات، "
                  f"تُرفع للمالك", file=sys.stderr)
    if fixed:
        gen.write_manifest(gen.manifest_map())
    print(f"\nأُصلح {fixed} · عاند {stubborn}")
    return stubborn


def current_classification() -> list:
    """تصنيف كل ملفات الفهرس الآن (يقيسه متصفّح حقيقي)."""
    man = json.loads((gen.OUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    texts, pending = gen.expected_texts()
    cats = {**texts, **pending}
    rows = [{"text": t, "cat": cats.get(t, "?"), "file": f"{k}.mp3",
             "sec": round(gen.mp3_duration(gen.OUT_DIR / f"{k}.mp3"), 2)}
            for k, t in man.items() if (gen.OUT_DIR / f"{k}.mp3").exists()]
    return classify(rows, analyze([r["file"] for r in rows]))


if __name__ == "__main__":
    sys.exit(main())
