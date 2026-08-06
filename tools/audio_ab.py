#!/usr/bin/env python3
"""صفحةُ «قبل/بعد» — يقابل المالكُ الصوتَ القديمَ بالجديد ويردُّ ما لا يعجبه.

    python3 tools/audio_ab.py              # يبني scratch/ab/index.html
    python3 tools/audio_ab.py --serve       # ويشغّل خادماً
    python3 tools/audio_ab.py --self-test   # بلا شبكة ولا ملفات

**سؤالُ المالك** (٥ أغسطس ٢٠٢٦): «هل تحتفظ بالأصوات القديمة إلى اعتماد الجديدة؟»
كان الجواب «لا، إلا في git» — فصار الحفظ بنيوياً في `scratch/prev` (انظر
`archive_prev` في المولّد)، وهذه الصفحةُ ثمرتُه: **لا اعتمادَ بلا مقابلة**.

**والردُّ لا يُنفَّذ من الصفحة** — تُنسخ منها قائمةُ ما رُدّ، ويُنفّذها أمرٌ واحد:
    .venv/bin/python tools/generate_audio.py --revert "<نص>,<نص>"
لأنّ صفحةً تكتب في `app/audio` بضغطةٍ بابُ خطأٍ لا يُغلق، والفصلُ بين العين واليد
هو نفسُه عرفُنا في «صدق الصورة»: **الأداةُ تعرض والإنسانُ يقرّر والأمرُ ينفّذ**.
"""

import argparse
import http.server
import json
import socketserver
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_audio as gen  # noqa: E402

OUT = gen.ROOT / "scratch" / "ab"


def rows() -> list:
    """كلُّ نصٍّ له سلفٌ محفوظ وخلَفٌ قائم — مرتَّبةً بالفئة ثم النصّ.

    **تُبنى من خزانة السلف لا من الفهرس**: الفهرسُ لا يحمل النصَّ المنتظِر، وأكثرُ
    ما يُقابَل هنا نصٌّ أُعيد توليدُه للتوّ — فبناؤها من الفهرس يُسقِط أكثرَها.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import audio_panel as ap  # noqa: PLC0415
    texts, pending = gen.expected_texts()
    cats = {**texts, **pending}
    queue = {e["text"]: e for e in gen.load_queue()}
    # **مفتاحٌ ← نصّ من الفهرس أيضاً**: `expected_texts` لا تعرف إلا المنهجَ والمنتظِر،
    # فما صُرّف للتوّ يسقط منها — وهو عينُ ما يُقابَل هنا.
    man = json.loads((gen.OUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    bykey = {gen.key_for(t): t for t in cats}
    bykey.update(man)
    for t in queue:
        bykey.setdefault(gen.key_for(t), t)
    out = []
    for prev in sorted(gen.PREV_DIR.glob("*.mp3")):
        key = prev.stem
        text = bykey.get(key)
        new = gen.OUT_DIR / f"{key}.mp3"
        if not text or not new.exists():
            continue
        e = queue.get(text, {})
        model = str(e.get("model", "")).split("#")[0]
        say = gen.speech_form(text)
        out.append({"key": key, "text": text, "say": "" if say == text else say,
                    "cat": cats.get(text, gen.category_of(text) if hasattr(gen, "category_of")
                                    else queue.get(text, {}).get("category", "word")),
                    "sec": round(gen.mp3_duration(new), 2),
                    "prevSec": round(gen.mp3_duration(prev), 2),
                    "src": gen.short_model(model) if model else "سُلافات",
                    "by": e.get("requestedBy", "منهج")})
    order = list(ap.GROUP_AR)
    out.sort(key=lambda r: (order.index(r["cat"]) if r["cat"] in order else 9, r["text"]))
    return out


def build() -> Path:
    data = rows()
    OUT.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import audio_panel as ap  # noqa: PLC0415
    groups = {}
    for r in data:
        groups.setdefault(r["cat"], []).append(r)
    tabs = "".join(f'<button class="tab" data-cat="{c}">{ap.GROUP_AR.get(c, c)}'
                   f'<small>{len(v)}</small></button>' for c, v in groups.items())
    html = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>قبل / بعد — مقابلةُ الصوت القديم بالجديد</title><style>
:root{--ink:#241f1a;--paper:#faf7f2;--line:#ddd2c2;--gold:#f0e8db;--green:#2f7d4f;--red:#c0392b}
body{font-family:"Noto Naskh Arabic","Geeza Pro",serif;margin:0;background:var(--paper);color:var(--ink)}
header{position:sticky;top:0;background:var(--paper);border-bottom:1px solid var(--line);padding:1rem 1.5rem .6rem;z-index:5}
h1{font-size:1.2rem;margin:0 0 .4rem}
p.lead{margin:.2rem 0 .6rem;max-width:48rem;font-size:.85rem;line-height:1.8;color:#5a4d3d;font-family:system-ui}
.tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.5rem}
button{font-family:inherit;cursor:pointer;border:1px solid var(--line);border-radius:.5rem;background:#fdfaf4;padding:.3rem .75rem;font-size:.9rem}
button.tab.on{background:var(--gold);font-weight:700}
button small{display:block;font-size:.6rem;color:#8a7a66;font-family:system-ui}
.bar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;font-family:system-ui;font-size:.83rem}
#list{padding:.5rem 1.5rem 6rem}
.row{display:grid;grid-template-columns:1fr 8.5rem 8.5rem 6.5rem;align-items:center;gap:.6rem;
     padding:.45rem .5rem;border-bottom:1px solid #eee6da}
.row.playing{background:#eaf3ec} .row.kept{background:#fdf3ee} .row.done{opacity:.6}
.t{font-size:1.15rem;line-height:1.7}
.say{font-size:.7rem;color:#a07a4a;margin-inline-start:.5rem;font-family:system-ui}
.old,.new{display:flex;align-items:center;gap:.35rem;font-family:system-ui;font-size:.72rem;color:#8a7a66}
.old button{background:#f4efe6} .new button{background:#eaf3ec;border-color:#a9c9b5}
.keep{font-size:.75rem;background:#fdf3ee;border-color:#d6a9a0}
.keep.on{background:var(--red);color:#fff;border-color:var(--red)}
footer{position:fixed;bottom:0;inset-inline:0;background:var(--ink);color:#fdfaf4;padding:.7rem 1.5rem;
 font-family:system-ui;font-size:.85rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
footer button{background:#fdfaf4} .grow{flex:1} code{font-size:.78rem}
</style></head><body>
<header><h1>قبل / بعد — مقابلةُ الصوت القديم بالجديد</h1>
<p class="lead">لكل سطرٍ زرّان: <b>القديم</b> (سلفُه المحفوظ) و<b>الجديد</b>. اسمعْهما،
فإن كان القديمُ أفضلَ اضغط <b>«أبقِ القديم»</b> — والصفحة <b>لا تغيّر شيئاً بنفسها</b>،
بل تعطيك قائمةً ينفّذها أمرُ الردّ.
&nbsp;<b>ط</b> يشغّل القديم، <b>ج</b> الجديد، <b>X</b> يُبقي القديم.</p>
<div class="tabs">TABS</div>
<div class="bar">
 <input type="search" id="q" placeholder="ابحث…" style="font-family:inherit;padding:.35rem .6rem;border:1px solid var(--line);border-radius:.5rem">
 <button id="auto">▶ شغّل بالتتابع (قديم ثم جديد)</button>
 <label><input type="checkbox" id="hideDone"> أخفِ ما سمعتُه</label>
 <span class="grow"></span><span id="stat"></span></div></header>
<div id="list"></div>
<footer><span id="n">لا ردّ</span><button id="copy">انسخ أمرَ الردّ</button>
<button id="reset">امسح السجلّ</button><span class="grow"></span>
<span>القديم من <code>scratch/prev</code> · الجديد من <code>app/audio</code></span></footer>
<script>
const DATA = PAYLOAD;
const KD='ab.done', KK='ab.keep';
const done=new Set(JSON.parse(localStorage.getItem(KD)||'[]'));
const keep=new Set(JSON.parse(localStorage.getItem(KK)||'[]'));
let cat=DATA.length?DATA[0].cat:'',cur=null,curRow=null,auto=false;
const $=(s)=>document.querySelector(s);
const save=()=>{localStorage.setItem(KD,JSON.stringify([...done]));
                localStorage.setItem(KK,JSON.stringify([...keep]));};
function visible(){const q=$('#q').value.trim();
 return DATA.filter(r=>r.cat===cat&&(!q||r.text.includes(q))&&!($('#hideDone').checked&&done.has(r.key)));}
function render(){const items=visible();
 $('#list').innerHTML=items.map(r=>`
  <div class="row ${done.has(r.key)?'done':''} ${keep.has(r.key)?'kept':''}" data-key="${r.key}">
   <div class="t">${r.text}${r.say?`<span class="say">أُرسل: ${r.say}</span>`:''}</div>
   <div class="old"><button data-old="${r.key}">▶ القديم</button>${r.prevSec}ث</div>
   <div class="new"><button data-new="${r.key}">▶ الجديد</button>${r.sec}ث</div>
   <button class="keep ${keep.has(r.key)?'on':''}" data-keep="${r.key}">أبقِ القديم</button>
  </div>`).join('');
 $('#stat').textContent=`${items.filter(r=>done.has(r.key)).length}/${items.length} في القسم · ${done.size}/${DATA.length} إجمالاً`;
 $('#n').textContent=keep.size?`${keep.size} صوتاً يُردّ إلى القديم`:'لا ردّ';}
function play(key,which,then){const r=DATA.find(x=>x.key===key);if(!r)return;
 if(cur)cur.pause();
 document.querySelectorAll('.row').forEach(x=>x.classList.remove('playing'));
 curRow=document.querySelector(`.row[data-key="${key}"]`);if(curRow)curRow.classList.add('playing');
 cur=new Audio(which==='old'?`../prev/${key}.mp3`:`../../app/audio/${key}.mp3`);
 cur.onended=()=>{if(which==='new'){done.add(key);save();render();}if(then)then();};
 cur.onerror=()=>then&&then();cur.play();}
function chain(i){const items=visible();
 if(!auto||i>=items.length){auto=false;$('#auto').textContent='▶ شغّل بالتتابع (قديم ثم جديد)';return;}
 play(items[i].key,'old',()=>setTimeout(()=>play(items[i].key,'new',()=>setTimeout(()=>chain(i+1),320)),260));}
document.addEventListener('click',(e)=>{const b=e.target.closest('button');if(!b)return;
 if(b.classList.contains('tab')){cat=b.dataset.cat;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));render();return;}
 if(b.dataset.old){auto=false;play(b.dataset.old,'old');return;}
 if(b.dataset.new){auto=false;play(b.dataset.new,'new');return;}
 if(b.dataset.keep){const k=b.dataset.keep;keep.has(k)?keep.delete(k):keep.add(k);save();render();return;}
 if(b.id==='auto'){auto=!auto;b.textContent=auto?'⏸ أوقف':'▶ شغّل بالتتابع (قديم ثم جديد)';
  if(auto){const items=visible();const s=items.findIndex(r=>!done.has(r.key));chain(s<0?0:s);}
  else if(cur)cur.pause();return;}
 if(b.id==='copy'){const texts=DATA.filter(r=>keep.has(r.key)).map(r=>r.text);
  const cmd='.venv/bin/python tools/generate_audio.py --revert "'+texts.join(',')+'"';
  navigator.clipboard.writeText(texts.length?cmd:'[]');
  b.textContent='نُسخ ✓';setTimeout(()=>b.textContent='انسخ أمرَ الردّ',1500);return;}
 if(b.id==='reset'){if(confirm('يُمسح سجلُّ السماع والردّ. أتمضي؟')){done.clear();keep.clear();save();render();}}});
$('#q').addEventListener('input',render);$('#hideDone').addEventListener('change',render);
document.addEventListener('keydown',(e)=>{if(e.target.tagName==='INPUT')return;
 if(!curRow)return;const k=curRow.dataset.key;
 if(e.key==='ط'||e.key==='a'){e.preventDefault();play(k,'old');}
 if(e.key==='ج'||e.key==='b'){e.preventDefault();play(k,'new');}
 if(e.key==='x'){keep.has(k)?keep.delete(k):keep.add(k);save();render();}});
document.querySelector('.tab')?.classList.add('on');render();
</script></body></html>"""
    out = OUT / "index.html"
    out.write_text(html.replace("TABS", tabs)
                   .replace("PAYLOAD", json.dumps(data, ensure_ascii=False)), encoding="utf-8")
    print(f"الصفحة: {out}  ({len(data)} مقابلةً في {len(groups)} أقسام)")
    return out


def serve(port: int = 8111) -> None:
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(gen.ROOT), **kw)

        def log_message(self, *a):
            pass

    with socketserver.TCPServer(("127.0.0.1", port), H) as srv:
        print(f"افتح: http://127.0.0.1:{port}/scratch/ab/index.html")
        srv.serve_forever()


def self_test() -> int:
    ok_n = bad_n = 0

    def ok(cond, msg):
        nonlocal ok_n, bad_n
        print(("  ✓ " if cond else "  ✗ ") + msg)
        ok_n, bad_n = ok_n + bool(cond), bad_n + (not cond)

    src = Path(__file__).read_text(encoding="utf-8")
    ok("../prev/" in src and "../../app/audio/" in src,
       "الجديدُ يُقرأ من app/audio والقديمُ من scratch/prev")
    ok("--revert" in src, "والصفحةُ تُخرج أمرَ الردّ لا تنفّذه")
    # يُفحص **الصفحةُ المبنية** لا مصدرُ الأداة: المصدر يحمل اسمَ ما يمنعه فيتّهم نفسَه
    page = OUT / "index.html"
    body = page.read_text(encoding="utf-8") if page.exists() else build().read_text(encoding="utf-8")
    ok("fetch(" not in body and "XMLHttpRequest" not in body,
       "والصفحةُ لا ترسل شيئاً ولا تكتب في القرص (لا fetch ولا XHR)")
    ok(gen.PREV_DIR.name == "prev" and "scratch" in str(gen.PREV_DIR),
       "وخزانةُ السلف في scratch — خارج المستودع")
    ok(hasattr(gen, "archive_prev") and hasattr(gen, "revert_prev"),
       "والمولّد يملك الحفظَ والردَّ معاً")
    print(f"\n{ok_n}/{ok_n + bad_n} تحقّقاً ناجحاً")
    return 1 if bad_n else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="مقابلةُ الصوت القديم بالجديد")
    ap.add_argument("--serve", action="store_true")
    ap.add_argument("--port", type=int, default=8111)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    build()
    if args.serve:
        serve(args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
