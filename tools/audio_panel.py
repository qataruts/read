#!/usr/bin/env python3
"""لوحة فحص الأصوات — يسمع بها المالك بنفسه ويُبلّغ عن الخطأ بضغطة.

    python3 tools/audio_panel.py            # يبني scratch/panel/index.html
    python3 tools/audio_panel.py --serve    # ويشغّل خادماً على 8110

العلّة التي تعالجها: عيبُ **المخرج** (نطق «سَجَّادَةْ» سَجَّابَة) لا يكشفه حارسٌ
آليّ — أدواتُنا تقيس المدد والنطقات والتكرار والنسب، ولا تسمع الحروف. فالأذن
هي الكاشف الوحيد، ولوحةٌ تُسمِع بالتتابع وتُبلّغ بضغطة تجعل مسحَ ٢٧٠٠ ملفٍ
ممكناً بدل أن يكون نظرياً.

الصفحة تحفظ ما سمعتَه وما بلّغتَ عنه في المتصفّح (localStorage)، فيمكن المسح
على دفعات. والبلاغات تُنسخ JSON ويُطبّقها:
    python3 tools/generate_audio.py --requeue "<نص>,<نص>" --requeue-reason "بلاغ سماع"
"""

import argparse
import http.server
import json
import socketserver
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_audio as gen  # noqa: E402

PANEL = gen.ROOT / "scratch" / "panel"
GROUP_AR = {
    "letter_name": "أسماء الحروف",
    "letter_haraka": "الحرف بحركته",
    "syllable": "المقاطع",
    "word": "الكلمات",
    "story_word": "كلمات القصص",
    "sentence": "الجمل",
    "husary": "تلاوة الحصري (المصحف)",
}


def rows(since: float = 0.0) -> list:
    man = json.loads((gen.OUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    texts, pending = gen.expected_texts()
    cats = {**texts, **pending}
    queue = {e["text"]: e for e in gen.load_queue()}
    lineage = {}
    ledger = gen.ROOT / "tools" / "audio_lineage.json"
    if ledger.exists():
        try:
            lineage = {v["text"]: v["lineage"]
                       for v in json.loads(ledger.read_text(encoding="utf-8"))["files"].values()}
        except (json.JSONDecodeError, KeyError):
            lineage = {}
    recit = gen.recitation_texts()

    out = []
    for key, text in man.items():
        path = gen.OUT_DIR / f"{key}.mp3"
        if not path.exists():
            continue
        if since and path.stat().st_mtime < since:
            continue                      # «الجديد فقط»: ما كُتب بعد لحظةٍ بعينها
        e = queue.get(text, {})
        lin = lineage.get(text, "")
        model = str(e.get("model", "")).split("#")[0]
        src = ("Antura بشريّ" if lin == "antura" else
               gen.short_model(model) if model else "سُلافات")
        say = gen.speech_form(text)
        out.append({"key": key, "text": text,
                    "say": "" if say == text else say,   # ما أُرسل فعلاً إن خالف المكتوب
                    "cat": cats.get(text, "word"),
                    "sec": round(gen.mp3_duration(path), 2),
                    "src": src, "by": e.get("requestedBy", "منهج")})
    for text, ref in recit.items():
        key = gen.key_for(text)
        path = gen.OUT_DIR / f"{key}.mp3"
        if path.exists() and not (since and path.stat().st_mtime < since):
            out.append({"key": key, "text": text, "say": "", "cat": "husary",
                        "sec": round(gen.mp3_duration(path), 2),
                        "src": "الحصري", "by": ref})
    order = list(GROUP_AR)
    out.sort(key=lambda r: (order.index(r["cat"]) if r["cat"] in order else 9, r["text"]))
    return out


def build(since: float = 0.0, title: str = "") -> Path:
    data = rows(since)
    PANEL.mkdir(parents=True, exist_ok=True)
    groups = {}
    for r in data:
        groups.setdefault(r["cat"], []).append(r)
    tabs = "".join(
        f'<button class="tab" data-cat="{cat}">{GROUP_AR.get(cat, cat)}'
        f'<small>{len(items)}</small></button>' for cat, items in groups.items())
    payload = json.dumps(data, ensure_ascii=False)
    html = """<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة فحص الأصوات</title>
<style>
 :root { --ink:#241f1a; --paper:#faf7f2; --line:#ddd2c2; --gold:#f0e8db; --green:#2f7d4f; }
 body { font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:0; background:var(--paper);
        color:var(--ink) }
 header { position:sticky; top:0; background:var(--paper); border-bottom:1px solid var(--line);
          padding:1rem 1.5rem .6rem; z-index:5 }
 h1 { font-size:1.25rem; margin:0 0 .5rem }
 .tabs { display:flex; flex-wrap:wrap; gap:.35rem; margin-bottom:.5rem }
 button { font-family:inherit; cursor:pointer; border:1px solid var(--line);
          border-radius:.5rem; background:#fdfaf4; padding:.35rem .8rem; font-size:.95rem }

 button.tab.on { background:var(--gold); font-weight:700 }
 button small { display:block; font-size:.62rem; color:#8a7a66; font-family:system-ui }
 .bar { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; font-family:system-ui;
        font-size:.85rem }
 input[type=search] { font-family:inherit; padding:.4rem .7rem; border:1px solid var(--line);
                      border-radius:.5rem; min-width:12rem }
 #list { padding:.5rem 1.5rem 6rem }
 .row { display:grid; grid-template-columns:2.6rem 1fr 5rem 7rem 5.5rem; align-items:center;
        gap:.6rem; padding:.4rem .5rem; border-bottom:1px solid #eee6da }
 .row:hover { background:#fff }
 .row.playing { background:#eaf3ec }
 .row.done { opacity:.55 }
 .row.bad { background:#fbeee8 }
 .t { font-size:1.15rem; line-height:1.8 }
 .say { font-size:.72rem; color:#a07a4a; margin-inline-start:.6rem; font-family:system-ui }
 .prog { height:4px; background:#e8ddcc; border-radius:2px; overflow:hidden; min-width:8rem }
 .prog i { display:block; height:100%; background:var(--green); width:0 }
 .meta { font-family:system-ui; font-size:.72rem; color:#8a7a66 }
 .play { font-size:1rem; padding:.25rem .6rem }
 .flag { font-size:.78rem; background:#fbeee8; border-color:#d6a9a0 }
 .flag.on { background:#c0392b; color:#fff }
 footer { position:fixed; bottom:0; inset-inline:0; background:var(--ink); color:#fdfaf4;
          padding:.7rem 1.5rem; font-family:system-ui; font-size:.85rem; display:flex;
          gap:1rem; align-items:center; flex-wrap:wrap }
 footer button { background:#fdfaf4 }
 .grow { flex:1 }
</style></head><body>
<header>
  <h1>TITLE</h1>
  <div class="tabs">TABS</div>
  <div class="bar">
    <input type="search" id="q" placeholder="ابحث عن نصّ…">
    <button id="auto">▶ شغّل بالتتابع</button>
    <label>السرعة <select id="rate">
      <option value="0.85">٠٫٨٥×</option><option value="1" selected>١×</option>
      <option value="1.25">١٫٢٥×</option><option value="1.5">١٫٥×</option></select></label>
    <label><input type="checkbox" id="hideDone"> أخفِ ما سمعتُه</label>
    <span class="grow"></span>
    <span class="prog"><i id="bar"></i></span>
    <span id="stat"></span>
  </div>
</header>
<div id="list"></div>
<footer>
  <span id="badcount">لا بلاغات</span>
  <button id="copy">انسخ البلاغات</button>
  <button id="reset">امسح سجلّ السماع</button>
  <button id="clearbad">امسح البلاغات</button>
  <span class="grow"></span>
  <span>الملف يُشغَّل من <code>app/audio</code> — والصفحة لا تغيّر شيئاً</span>
</footer>
<script>
const DATA = PAYLOAD;
const KEY_DONE = 'panel.done', KEY_BAD = 'panel.bad';
const done = new Set(JSON.parse(localStorage.getItem(KEY_DONE) || '[]'));
const bad = new Set(JSON.parse(localStorage.getItem(KEY_BAD) || '[]'));
let cat = DATA.length ? DATA[0].cat : '', auto = false, cur = null, curRow = null;

const $ = (s) => document.querySelector(s);
const save = () => {
  localStorage.setItem(KEY_DONE, JSON.stringify([...done]));
  localStorage.setItem(KEY_BAD, JSON.stringify([...bad]));
};

function visible() {
  const q = $('#q').value.trim();
  return DATA.filter((r) => r.cat === cat
    && (!q || r.text.includes(q))
    && !($('#hideDone').checked && done.has(r.key)));
}

function render() {
  const items = visible();
  $('#list').innerHTML = items.map((r) => `
    <div class="row ${done.has(r.key) ? 'done' : ''} ${bad.has(r.key) ? 'bad' : ''}" data-key="${r.key}">
      <button class="play" data-key="${r.key}">▶</button>
      <div class="t">${r.text}${r.say ? `<span class="say">أُرسل: ${r.say}</span>` : ''}</div>
      <div class="meta">${r.sec}ث</div>
      <div class="meta">${r.src} · ${r.by}</div>
      <button class="flag ${bad.has(r.key) ? 'on' : ''}" data-flag="${r.key}">⚑ خطأ</button>
    </div>`).join('');
  const heard = items.filter((r) => done.has(r.key)).length;
  $('#stat').textContent = `${heard}/${items.length} سُمعت في هذا القسم · ${done.size}/${DATA.length} إجمالاً`;
  $('#badcount').textContent = bad.size ? `${bad.size} بلاغاً` : 'لا بلاغات';
  $('#bar').style.width = `${Math.round(100 * done.size / (DATA.length || 1))}%`;
}

function play(key, then) {
  const r = DATA.find((x) => x.key === key);
  if (!r) return;
  if (cur) cur.pause();
  if (curRow) curRow.classList.remove('playing');
  curRow = document.querySelector(`.row[data-key="${key}"]`);
  if (curRow) curRow.classList.add('playing');
  cur = new Audio(`../../app/audio/${key}.mp3`);
  cur.playbackRate = +$('#rate').value;
  cur.onended = () => { done.add(key); save(); render(); if (then) then(); };
  cur.onerror = () => { if (then) then(); };
  cur.play();
}

function playFrom(i) {
  const items = visible();
  if (!auto || i >= items.length) { auto = false; $('#auto').textContent = '▶ شغّل بالتتابع'; return; }
  play(items[i].key, () => setTimeout(() => playFrom(i + 1), 350));
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.classList.contains('tab')) {
    cat = t.dataset.cat;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === t));
    render(); return;
  }
  if (t.dataset.key) { auto = false; play(t.dataset.key); return; }
  if (t.dataset.flag) {
    const k = t.dataset.flag;
    bad.has(k) ? bad.delete(k) : bad.add(k);
    save(); render(); return;
  }
  if (t.id === 'auto') {
    auto = !auto;
    t.textContent = auto ? '⏸ أوقف' : '▶ شغّل بالتتابع';
    if (auto) {
      const items = visible();
      const start = items.findIndex((r) => !done.has(r.key));
      playFrom(start < 0 ? 0 : start);
    } else if (cur) cur.pause();
    return;
  }
  if (t.id === 'copy') {
    const texts = DATA.filter((r) => bad.has(r.key)).map((r) => r.text);
    navigator.clipboard.writeText(JSON.stringify(texts, null, 1));
    t.textContent = 'نُسخت ✓'; setTimeout(() => t.textContent = 'انسخ البلاغات', 1500); return;
  }
  if (t.id === 'clearbad') {
    if (confirm('تُمسح البلاغات وحدها (لا سجلّ السماع). أتمضي؟')) { bad.clear(); save(); render(); }
    return;
  }
  if (t.id === 'reset') {
    if (confirm('يُمسح سجلّ ما سمعتَه (لا البلاغات). أتمضي؟')) { done.clear(); save(); render(); }
  }
});
$('#q').addEventListener('input', render);
$('#hideDone').addEventListener('change', render);
$('#rate').addEventListener('change', () => { if (cur) cur.playbackRate = +$('#rate').value; });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' && curRow) { e.preventDefault(); play(curRow.dataset.key); }
  if (e.key === 'x' && curRow) { const k = curRow.dataset.key;
    bad.has(k) ? bad.delete(k) : bad.add(k); save(); render(); }
});
document.querySelector('.tab')?.classList.add('on');
render();
</script></body></html>"""
    html = (html.replace("TABS", tabs).replace("PAYLOAD", payload)
            .replace("TITLE", title or "لوحة فحص الأصوات — اسمع بنفسك"))
    out = PANEL / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"اللوحة: {out}  ({len(data)} ملفاً في {len(groups)} أقسام)")
    return out


def serve(port: int = 8110) -> None:
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(gen.ROOT), **kw)

        def log_message(self, *a):
            pass

    with socketserver.TCPServer(("127.0.0.1", port), H) as srv:
        print(f"افتح: http://127.0.0.1:{port}/scratch/panel/index.html   (Ctrl+C للإيقاف)")
        srv.serve_forever()


def main():
    ap = argparse.ArgumentParser(description="لوحة فحص الأصوات")
    ap.add_argument("--serve", action="store_true")
    ap.add_argument("--since", default="",
                    help="لا تُدرج إلا ما كُتب بعد هذا الملف الشاهد (أو طابع زمني)")
    ap.add_argument("--title", default="")
    ap.add_argument("--port", type=int, default=8110)
    args = ap.parse_args()
    since = 0.0
    if args.since:
        marker = Path(args.since)
        since = marker.stat().st_mtime if marker.exists() else float(args.since)
    build(since, args.title)
    if args.serve:
        serve(args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
