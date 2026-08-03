#!/usr/bin/env python3
"""جرد أصول Antura الصوتية العربية ومطابقتها بنواتنا التعليمية — **بلا أي حصة TTS**.

    python3 tools/antura_assets.py --inventory     # تقرير التغطية (بلا تنزيل صوت)
    python3 tools/antura_assets.py --fetch         # تنزيل المطابِق إلى scratch/antura/
    python3 tools/antura_assets.py --audition      # صفحة معاينة: Antura بجوار ملفنا
    python3 tools/antura_assets.py --approve       # نسخ المُجاز إلى مجلد استيراد بمفاتيحه

المصدر: <https://github.com/vgwb/Antura_arabic> — أصوله الرقمية (ومنها التسجيلات)
تحت **CC-BY 4.0**، وشيفرته BSD-2-Clause. الإسناد واجب: انظر `CREDITS.md`.

المطابقة **حرفية لا تخمينية**: قاعدة `LetterData` في المستودع تحمل لكل مدخل حقل
`Isolated` = النصّ العربي المشكول نفسه («بُ»، «بْ»، «بً»)، فيقابَل بنصوصنا مباشرة،
وأسماء الحروف تُقابَل بحرفها لا باسمه الإنجليزي.

الملفات المنزَّلة تُسمّى بمفتاح نصّها (sha1) فيستوردها `tools/import_recordings.py`
كما يستورد أي تسجيل بشري — بلا تغيير سطر واحد في التطبيق.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "app" / "js" / "curriculum.js"
OUT_DIR = ROOT / "app" / "audio"
QUEUE_FILE = ROOT / "tools" / "audio_queue.json"
WORK = ROOT / "scratch" / "antura"
AUDITION = ROOT / "scratch" / "antura_audition"
IMPORT_DIR = ROOT / "scratch" / "antura_import"

REPO = "vgwb/Antura_arabic"
BRANCH = "master"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}"
TREE_URL = f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1"
LETTERDATA = ("Assets/_manage/manage_Database/Datasets/LetterData/"
              "EA4S_Vocabulary_Database - LetterData.json")
AUDIO_DIRS = ("Assets/_app/Audio/Resources/AudioArabic/Letters",
              "Assets/_app/Audio/_not used/Letters Variations")

HARAKAT = {"fatha": "َ", "kasra": "ِ", "damma": "ُ"}
SUKUN = "ْ"
TANWEEN = {"fathah_tanwin": "ً", "dammah_tanwin": "ٌ", "kasrah_tanwin": "ٍ"}

# أنواع ما نحتاجه لكل حرف — عمود في تقرير التغطية وصفٌّ في صفحة المعاينة
KINDS = [
    ("name", "اسم الحرف"),
    ("fatha", "بَ (فتحة)"),
    ("kasra", "بِ (كسرة)"),
    ("damma", "بُ (ضمة)"),
    ("sukun", "بْ (سكون)"),
    ("tanween", "بً بٌ بٍ (تنوين)"),
    ("madd", "بَا بِي بُو (مدّ)"),
]


def key_for(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def get(url: str, dest: Path) -> Path:
    """تنزيل مع تخزين محلي — لا يُعاد طلب ما نُزِّل."""
    if dest.exists() and dest.stat().st_size:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "muallim-antura/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())
    return dest


# ————————————————————————— ما نحتاجه نحن —————————————————————————

def our_letters() -> dict:
    """حرف ← اسمه، من مصدر الحقيقة (curriculum.js)."""
    src = CURRICULUM.read_text(encoding="utf-8")
    return {m.group(1): m.group(2)
            for m in re.finditer(r"'(.)':\s*\{\s*name:\s*'([^']+)'", src)}


def our_texts() -> set:
    """كل نصّ منطوق نملكه أو ننتظره (منهجاً وقائمةَ انتظار) — لمعرفة ما يُستبدل."""
    src = CURRICULUM.read_text(encoding="utf-8")
    texts = set(re.findall(r"say:\s*'([^']+)'", src))
    for m in re.finditer(r"tiles:\s*\[([^\]]+)\]", src):
        texts.update(re.findall(r"'([^']+)'", m.group(1)))
    for ch, name in our_letters().items():
        texts.add(name)
        texts.update(ch + mark for mark in HARAKAT.values())
    if QUEUE_FILE.exists():
        for e in json.loads(QUEUE_FILE.read_text(encoding="utf-8")):
            texts.add(e["text"])
    return texts


def needed() -> dict:
    """(حرف، نوع) ← [النصوص المطلوبة] — نواتنا التعليمية كما وصفها المالك."""
    out = {}
    for ch, name in our_letters().items():
        out[(ch, "name")] = [name]
        out[(ch, "fatha")] = [ch + HARAKAT["fatha"]]
        out[(ch, "kasra")] = [ch + HARAKAT["kasra"]]
        out[(ch, "damma")] = [ch + HARAKAT["damma"]]
        out[(ch, "sukun")] = [ch + SUKUN]
        out[(ch, "tanween")] = [ch + m for m in TANWEEN.values()]
        out[(ch, "madd")] = [ch + HARAKAT["fatha"] + "ا",
                             ch + HARAKAT["kasra"] + "ي",
                             ch + HARAKAT["damma"] + "و"]
    return out


# ————————————————————————— ما يملكه Antura —————————————————————————

# الحركة من معرّفها في Antura — **لا** من حقل Isolated: ذلك الحقل مغلوط في مدخلات
# كثيرة (مثال: `lam_fathah` مكتوب «لً» بتنوين الفتح لا بالفتحة)، ولو صُدِّق لاستُورد
# صوتُ الفتحة مكانَ التنوين فعُلِّم الطفل خطأً. المعرّف والملف متطابقان دائماً.
SYMBOL_CHAR = {
    "fathah": "َ", "kasrah": "ِ", "dammah": "ُ", "sukun": "ْ", "shaddah": "ّ",
    "fathah_tanwin": "ً", "dammah_tanwin": "ٌ", "kasrah_tanwin": "ٍ",
}


def antura_index() -> tuple[dict, list]:
    """نصّ عربي ← مسار ملف صوته، مبنيّاً من (BaseLetter + Symbol) لا من Isolated."""
    tree = json.loads(get(TREE_URL, WORK / "tree.json").read_text(encoding="utf-8"))
    files = {}
    for t in tree["tree"]:
        p = t["path"]
        if p.lower().endswith(".wav") and any(p.startswith(d) for d in AUDIO_DIRS):
            files.setdefault(Path(p).stem, p)          # الأول يفوز: Letters قبل Variations

    data = json.loads(get(f"{RAW}/{urllib.parse.quote(LETTERDATA)}",
                          WORK / "letterdata.json").read_text(encoding="utf-8"))
    rows = data["LetterData"]
    letter_char = {r["Id"]: (r.get("Isolated") or "").strip()
                   for r in rows if r.get("Kind") == "Letter"}

    # الفهرس من **أسماء الملفات** لا من صفوف القاعدة: ٨٨ ملف تنوين موجود ولا صفّ
    # لأكثرها في LetterData، فالاقتصار على الصفوف كان يُسقط ٧٤ تسجيلاً صالحاً.
    # الاصطلاح ثابت: `{الحرف}_{الحركة}.wav` و`{الحرف}__lettername.wav`.
    by_len = sorted(letter_char, key=len, reverse=True)
    index, anomalies = {}, []
    for stem, path in files.items():
        lid = next((i for i in by_len if stem == f"{i}__lettername" or stem.startswith(f"{i}_")),
                   None)
        if not lid:
            continue
        if stem == f"{lid}__lettername":
            index.setdefault(("name", letter_char[lid]), path)
            continue
        sym = stem[len(lid) + 1:]
        if sym in SYMBOL_CHAR:
            index.setdefault(letter_char[lid] + SYMBOL_CHAR[sym], path)

    # عيوب المصدر: صفٌّ معرّفه يقول حركةً وحقلُ Isolated فيه يقول أخرى — يُبلَّغ ولا يُصدَّق
    for r in rows:
        if r.get("Kind") != "DiacriticCombo":
            continue
        base, sym = r.get("BaseLetter"), r.get("Symbol")
        iso = (r.get("Isolated") or "").strip()
        if base in letter_char and sym in SYMBOL_CHAR and iso:
            built = letter_char[base] + SYMBOL_CHAR[sym]
            if iso != built:
                anomalies.append((r["Id"], iso, built))
    return index, anomalies


# ————————————————————————— الجرد —————————————————————————

def inventory():
    index, anomalies = antura_index()
    names = our_letters()
    rows, totals = [], {k: [0, 0] for k, _t in KINDS}
    for ch, name in names.items():
        row = {"letter": ch, "name": name, "kinds": {}}
        for kind, _title in KINDS:
            texts = needed()[(ch, kind)]
            hits = []
            for t in texts:
                path = index.get(("name", ch)) if kind == "name" else index.get(t)
                hits.append((t, path))
            got = sum(1 for _t, p in hits if p)
            row["kinds"][kind] = hits
            totals[kind][0] += got
            totals[kind][1] += len(hits)
        rows.append(row)
    return rows, totals, index, anomalies


def print_inventory(rows, totals):
    print("جرد تغطية Antura مقابل نواتنا (٢٨ حرفاً):\n")
    print(f"  {'النوع':<18} {'مغطّى':>10}")
    for kind, title in KINDS:
        got, need = totals[kind]
        bar = "█" * round(12 * got / need) + "·" * (12 - round(12 * got / need))
        print(f"  {title:<18} {got:>4}/{need:<4} {bar}")
    gaps = {}
    for kind, _title in KINDS:
        missing = [r["letter"] for r in rows
                   if not all(p for _t, p in r["kinds"][kind])]
        if missing:
            gaps[kind] = missing
    if gaps:
        print("\n  الفجوات (حروف ناقصة كلياً أو جزئياً):")
        for kind, chs in gaps.items():
            title = dict(KINDS)[kind]
            print(f"    {title}: {' '.join(chs)}")
    return gaps


# ————————————————————————— التنزيل والمعاينة —————————————————————————

def fetch_matched(rows, index, limit_kinds=None) -> list:
    """ينزّل كل ملف مطابِق ويسمّيه بمفتاح نصّه — جاهزاً لـimport_recordings.py."""
    WORK.mkdir(parents=True, exist_ok=True)
    got = []
    for r in rows:
        for kind, _title in KINDS:
            if limit_kinds and kind not in limit_kinds:
                continue
            for text, path in r["kinds"][kind]:
                if not path:
                    continue
                dest = WORK / "wav" / f"{key_for(text)}.wav"
                try:
                    get(f"{RAW}/{urllib.parse.quote(path)}", dest)
                    got.append({"text": text, "kind": kind, "letter": r["letter"],
                                "source": path, "file": dest.name,
                                "bytes": dest.stat().st_size})
                except Exception as e:  # noqa: BLE001
                    print(f"  ✗ {text}: {e}", file=sys.stderr)
    (WORK / "matched.json").write_text(json.dumps(got, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
    print(f"نُزِّل {len(got)} ملفاً إلى {(WORK / 'wav').relative_to(ROOT)}/")
    return got


def to_mp3(src: Path, dest: Path) -> bool:
    """تحويل wav ← mp3 بنفس معالجة الاستيراد (قصّ وتطبيع) عبر import_recordings."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import import_recordings as imp  # noqa: PLC0415
    try:
        samples, rate = imp.load(src)
        cut = imp.trim_and_normalize(samples, rate)
        if len(cut) < rate * 0.1:
            return False
        imp.gen.pcm_to_mp3(imp.to_bytes(cut), rate, dest)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  ✗ {src.name}: {e}", file=sys.stderr)
        return False


def build_audition(matched: list) -> int:
    """صفحة معاينة: لكل نصّ — تسجيل Antura بجوار ملفنا الحالي (Sulafat/edge)."""
    AUDITION.mkdir(parents=True, exist_ok=True)
    rows = []
    for m in matched:
        text = m["text"]
        ours = OUT_DIR / f"{key_for(text)}.mp3"
        antura_mp3 = AUDITION / f"antura__{key_for(text)}.mp3"
        if not antura_mp3.exists() and not to_mp3(WORK / "wav" / m["file"], antura_mp3):
            continue
        ours_name = ""
        if ours.exists():
            ours_name = f"ours__{key_for(text)}.mp3"
            shutil.copy2(ours, AUDITION / ours_name)
        rows.append({"text": text, "kind": m["kind"], "letter": m["letter"],
                     "antura": antura_mp3.name, "ours": ours_name,
                     "size": antura_mp3.stat().st_size})
    write_audition_page(rows)
    print(f"صفحة المعاينة: {AUDITION / 'index.html'} ({len(rows)} نصاً)")
    print(f"افتحها: .venv/bin/python -m http.server 8040 -d {AUDITION} → http://127.0.0.1:8040/")
    return 0 if rows else 1


def write_audition_page(rows) -> None:
    by_kind = {}
    for r in rows:
        by_kind.setdefault(r["kind"], []).append(r)
    blocks = []
    for kind, title in KINDS:
        items = by_kind.get(kind, [])
        if not items:
            continue
        cells = "".join(
            f'<tr><th>{r["text"]}</th>'
            f'<td><button data-src="{r["antura"]}">▶ Antura</button></td>'
            + (f'<td><button class="ours" data-src="{r["ours"]}">▶ ملفّنا</button></td>'
               if r["ours"] else '<td class="miss">لا ملف عندنا</td>')
            + "</tr>" for r in items)
        blocks.append(f'<h2>{title} <small>({len(items)})</small></h2>'
                      f'<table><tbody>{cells}</tbody></table>')
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة أصوات Antura مقابل أصواتنا</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }} h2 {{ font-size:1.05rem; margin-top:1.6rem }}
 h2 small {{ color:#8a7a66; font-weight:normal }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:54rem; line-height:1.9 }}
 table {{ border-collapse:collapse; margin-top:.5rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.4rem .7rem; background:#fff; text-align:center }}
 th {{ background:#f0e8db; font-size:1.25rem; min-width:5rem }}
 button {{ font-family:inherit; font-size:.95rem; padding:.35rem .8rem; cursor:pointer;
           border:1px solid #c9bba6; border-radius:.45rem; background:#fdfaf4 }}
 button.ours {{ background:#eef3fb; border-color:#a9bcd6 }}
 button.playing {{ background:#2f7d4f; color:#fff }}
 td.miss {{ color:#a1937f; font-size:.85rem }}
</style></head><body>
<h1>أصوات Antura مقابل أصواتنا</h1>
<p class="note">تسجيلات بشرية من لعبة <strong>Antura and the Letters</strong> (رخصة CC-BY 4.0) بجوار ملفاتنا المولّدة.
الحكم لأذنك صفّاً صفّاً: أيّهما أوضح مخرجاً وأنسب لطفل في السادسة؟
<br>لا يُستبدل شيء قبل إجازتك؛ وما لا يغطّيه Antura يبقى على المولّد أو على قائمة التسجيل البشري.</p>
{"".join(blocks)}
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
    (AUDITION / "index.html").write_text(html, encoding="utf-8")


CREDITS = ROOT / "CREDITS.md"
CREDIT_START = "<!-- ANTURA-CREDIT-START -->"
CREDIT_END = "<!-- ANTURA-CREDIT-END -->"


def write_credit(count: int, kinds: list) -> None:
    """يكتب إسناد CC-BY في CREDITS.md — **شرطُ الترخيص، لا يُنسى ولا يُؤجَّل**."""
    titles = "، ".join(dict(KINDS)[k] for k in kinds) if kinds else "كل الأنواع المجرودة"
    block = f"""{CREDIT_START}
## ٣. تسجيلات الحروف من Antura — {count} ملفاً

- **العمل**: *Antura and the Letters* (النسخة العربية) — الفائز بمبادرة EduApp4Syria.
- **المصدر**: <https://github.com/{REPO}> (فرع `{BRANCH}`)، مجلدات الصوت `AudioArabic/Letters`.
- **الترخيص**: أصول المشروع الرقمية (ومنها التسجيلات) تحت
  [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)
  — وشيفرته تحت BSD-2-Clause (لم نأخذ منها شيئاً).
- **حقوق النشر**: © TH Köln / Cologne Game Lab، Video Games Without Borders، Wixel Studios.
- **الأنواع المستوردة**: {titles}.
- **التعديل**: نُسخت التسجيلات كما هي إلى mp3 مع **قصّ الصمت من الطرفين وتطبيع الذروة**
  (`tools/import_recordings.py`) وتسميةٍ بمفتاح نصّها — ولم يُمسّ محتواها الصوتي.
- **قائمة المستورد بالتفصيل**: `scratch/antura/matched.json`.
{CREDIT_END}"""
    text = CREDITS.read_text(encoding="utf-8")
    start, end = text.index(CREDIT_START), text.index(CREDIT_END) + len(CREDIT_END)
    CREDITS.write_text(text[:start] + block + text[end:], encoding="utf-8")
    print(f"حُدِّث الإسناد في {CREDITS.name} (شرط CC-BY).")


def approve(kinds: list) -> int:
    """نسخ المُجاز (بأنواعه) إلى مجلد استيراد — يستورده import_recordings.py."""
    matched = json.loads((WORK / "matched.json").read_text(encoding="utf-8"))
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    for m in matched:
        if kinds and m["kind"] not in kinds:
            continue
        shutil.copy2(WORK / "wav" / m["file"], IMPORT_DIR / m["file"])
        n += 1
    if not n:
        print("لا ملف مطابق للأنواع المطلوبة.", file=sys.stderr)
        return 1
    write_credit(n, kinds)
    print(f"{n} ملفاً في {IMPORT_DIR.relative_to(ROOT)}/ — استوردها:")
    print(f"  .venv/bin/python tools/import_recordings.py {IMPORT_DIR.relative_to(ROOT)}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="أصول Antura الصوتية")
    ap.add_argument("--inventory", action="store_true", help="تقرير التغطية")
    ap.add_argument("--fetch", action="store_true", help="تنزيل المطابِق")
    ap.add_argument("--audition", action="store_true", help="صفحة المعاينة")
    ap.add_argument("--approve", action="store_true", help="تجهيز المُجاز للاستيراد")
    ap.add_argument("--kinds", default="", help="أنواع محدّدة مفصولة بفواصل (name,fatha,…)")
    args = ap.parse_args()

    kinds = [k.strip() for k in args.kinds.split(",") if k.strip()]
    if args.approve:
        return approve(kinds)

    rows, totals, index, anomalies = inventory()
    gaps = print_inventory(rows, totals)
    if anomalies:
        print(f"\n  ⚠ {len(anomalies)} مدخلاً في بيانات Antura حقلُ Isolated فيه مغلوط "
              f"(بُنيت المطابقة من BaseLetter+Symbol فسلِمت): "
              + "، ".join(f"{i}:{iso}→{fix}" for i, iso, fix in anomalies[:5]) + " …")
    (WORK / "coverage.json").parent.mkdir(parents=True, exist_ok=True)
    (WORK / "coverage.json").write_text(json.dumps(
        {"totals": {k: totals[k] for k, _t in KINDS},
         "gaps": gaps,
         "rows": [{"letter": r["letter"], "name": r["name"],
                   "kinds": {k: [[t, p or ""] for t, p in v] for k, v in r["kinds"].items()}}
                  for r in rows]}, ensure_ascii=False, indent=1), encoding="utf-8")

    if args.fetch or args.audition:
        matched = fetch_matched(rows, index, kinds or None)
        if args.audition:
            return build_audition(matched)
    return 0


if __name__ == "__main__":
    sys.exit(main())
