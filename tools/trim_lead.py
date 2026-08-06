#!/usr/bin/env python3
"""مِقصُّ الصمت الأول — يحذف التأخّر الصامت في بداية ملفات mp3.

    python3 tools/trim_lead.py --measure          # يقيس التأخّر في البنك كله (بلا تغيير)
    python3 tools/trim_lead.py --try "بَةْ,طَ"    # عيّنة «قبل/بعد» إلى scratch/trim/
    python3 tools/trim_lead.py --apply --min 0.20 # يقصّ ما تأخّرَ أكثر من الحدّ (في app/audio)
    python3 tools/trim_lead.py --self-test        # بلا شبكة ولا ملفات

**العلّة** (أذن المالك، ٥ أغسطس ٢٠٢٦): «بعض الأصوات أطول من المعدّل لكن فيها تأخّرٌ
بدون صوتٍ في بداية الملف». وقياسُ ٢٦٥ ملفاً من الأقسام القصيرة صدّقه: ٥٣ ملفاً
تأخُّرُها ≥٠٫٢٠ث — أي ثُلثُ زمنِ مقطعٍ كامل صمتاً قبل أن ينطق.

**والقصُّ بالإطارات لا بفكّ الترميز**: لا مُفكِّك mp3 في بيئتنا (لا ffmpeg)، وإعادةُ
الترميز تُفقِد جودةً بلا داعٍ. فإطارُ mp3 وحدةٌ مستقلّة بترويسةٍ تُقرأ — فيُحذف من
البداية عددُ إطاراتٍ يُغطّي الصمت، ويبقى **بايتُ الصوت الباقي كما وُلّد حرفاً بحرف**.

**وهامشُ أمانٍ مقصود** (`KEEP`): لا يُقَصّ إلى الصفر — تُترك ثُمنُ ثانيةٍ صامتة، فبَدءٌ
مبتورٌ أسوأ في الأذن من تأخّرٍ يسير، ولأنّ مِزْوَدَ الترميز (bit reservoir) قد يُسنِد
أولَ إطارٍ باقٍ إلى ما قبله.

**والقياسُ من متصفّحٍ حقيقيّ** (`audio_audit.analyze`) لا من تخمين: هو نفسُه الذي
يقيس التكرار — فالمسطرة واحدة.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audio_audit as aa  # noqa: E402
import generate_audio as gen  # noqa: E402

KEEP = 0.125          # صمتٌ يُترك عمداً في البداية (بدءٌ مبتور أسوأ من تأخّرٍ يسير)
DEFAULT_MIN = 0.20    # لا يُمَسّ ملفٌ تأخّرُه دون هذا — الحدّ من قياس ٢٦٥ ملفاً
WORK = gen.ROOT / "scratch" / "trim"

_RATES = {  # (نسخة MPEG, رمز المعدّل) ← المعدّل
    (3, 0): 44100, (3, 1): 48000, (3, 2): 32000,
    (2, 0): 22050, (2, 1): 24000, (2, 2): 16000,
    (0, 0): 11025, (0, 1): 12000, (0, 2): 8000,
}
_BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
_BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]


def frames(data: bytes) -> list:
    """مواضعُ إطارات mp3 وأطوالها ومدّةُ الإطار — قراءةُ تروايس لا فكَّ ترميز."""
    out, i, n = [], 0, len(data)
    if data[:3] == b"ID3":                       # وسمٌ في الرأس: يُتخطّى بطوله المعلَن
        size = 0
        for b in data[6:10]:
            size = (size << 7) | (b & 0x7F)
            i = 10 + size
    while i + 4 <= n:
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        ver = (data[i + 1] >> 3) & 0x03          # 3=MPEG1 · 2=MPEG2 · 0=MPEG2.5
        layer = (data[i + 1] >> 1) & 0x03        # 1 = Layer III (في البايت الأول)
        bidx = (data[i + 2] >> 4) & 0x0F
        ridx = (data[i + 2] >> 2) & 0x03
        pad = (data[i + 2] >> 1) & 0x01
        if layer != 1 or ridx == 3 or bidx in (0, 15) or (ver, ridx) not in _RATES:
            i += 1
            continue
        rate = _RATES[(ver, ridx)]
        kbps = (_BITRATES_V1 if ver == 3 else _BITRATES_V2)[bidx]
        samples = 1152 if ver == 3 else 576
        length = int(samples / 8 * kbps * 1000 / rate) + pad
        if length <= 4:
            i += 1
            continue
        out.append({"at": i, "len": length, "sec": samples / rate})
        i += length
    return out


def trim_bytes(data: bytes, drop_sec: float) -> tuple:
    """يحذف إطاراتِ البداية التي تُغطّي `drop_sec` — يعيد (البايتات، المحذوف فعلاً)."""
    fr = frames(data)
    if not fr or drop_sec <= 0:
        return data, 0.0
    head = fr[0]["at"]                            # ما قبل أول إطار (وسمٌ إن وُجد)
    dropped, cut = 0.0, 0
    for f in fr:
        if dropped + f["sec"] > drop_sec:
            break
        dropped += f["sec"]
        cut += 1
    if cut == 0 or cut >= len(fr):
        return data, 0.0
    return data[:head] + data[fr[cut]["at"]:], dropped


def measure(keys: list, label: dict) -> list:
    """التأخّر الصامت لكل ملف — بالمتصفّح نفسِه الذي يقيس التكرار."""
    res = aa.analyze([f"{k}.mp3" for k in keys])
    out = []
    for a in res:
        segs = a.get("segs") or []
        if not segs:
            continue
        key = a["file"].replace(".mp3", "")
        out.append({"key": key, "text": label.get(key, key),
                    "lead": segs[0][0], "sec": a.get("sec", 0)})
    out.sort(key=lambda r: -r["lead"])
    return out


def rows_of(cats: tuple = ()) -> list:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import audio_panel as ap  # noqa: PLC0415
    return [r for r in ap.rows() if not cats or r["cat"] in cats]


def cmd_measure(args) -> int:
    cats = tuple(args.cats.split(",")) if args.cats else ()
    rows = rows_of(cats)
    rows = [r for r in rows if r["cat"] != "husary"]     # التلاوة لا تُمَسّ أبداً
    print(f"يُقاس {len(rows)} ملفاً…")
    got = measure([r["key"] for r in rows], {r["key"]: r["text"] for r in rows})
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "lead.json").write_text(json.dumps(got, ensure_ascii=False, indent=1),
                                    encoding="utf-8")
    for th in (0.15, 0.20, 0.30, 0.40):
        print(f"  تأخّرٌ ≥{th:.2f}ث: {sum(1 for r in got if r['lead'] >= th):>5} ملفاً")
    print(f"\nأطولُ عشرة:")
    for r in got[:10]:
        print(f"  {r['text'][:22]:<24} صمتٌ {r['lead']:.2f}ث من {r['sec']:.2f}ث")
    print(f"\nالقياس في {WORK / 'lead.json'}")
    return 0


def cmd_try(args) -> int:
    """عيّنةُ «قبل/بعد» إلى scratch — **لا تُمَسّ app/audio**."""
    texts = [t.strip() for t in args.try_texts.split(",") if t.strip()]
    WORK.mkdir(parents=True, exist_ok=True)
    keys = {gen.key_for(t): t for t in texts}
    got = measure(list(keys), keys)
    for r in got:
        src = gen.OUT_DIR / f"{r['key']}.mp3"
        data = src.read_bytes()
        new, dropped = trim_bytes(data, max(0.0, r["lead"] - KEEP))
        shutil.copy2(src, WORK / f"before__{r['key']}.mp3")
        (WORK / f"after__{r['key']}.mp3").write_bytes(new)
        print(f"  {r['text']:<12} صمتٌ {r['lead']:.2f}ث → قُصّ {dropped:.2f}ث "
              f"({len(data)}→{len(new)} بايت)")
    print(f"\nالعيّنة في {WORK} — «قبل» و«بعد» لكلٍّ.")
    return 0


def cmd_apply(args) -> int:
    cats = tuple(args.cats.split(",")) if args.cats else ()
    rows = [r for r in rows_of(cats) if r["cat"] != "husary"]
    got = [r for r in measure([r["key"] for r in rows],
                              {r["key"]: r["text"] for r in rows})
           if r["lead"] >= args.min]
    print(f"يُقَصّ {len(got)} ملفاً (تأخّرُها ≥{args.min}ث)…")
    done = 0
    for r in got:
        p = gen.OUT_DIR / f"{r['key']}.mp3"
        new, dropped = trim_bytes(p.read_bytes(), max(0.0, r["lead"] - KEEP))
        if dropped > 0:
            p.write_bytes(new)
            done += 1
    gen.write_manifest(gen.manifest_map())          # البصمات تتبدّل فيُكسَر الكاش
    print(f"قُصّ {done} ملفاً · وبصماتُها تبدّلت فيجلبها الجهاز وحدَها.")
    return 0


def self_test() -> int:
    """بلا شبكة ولا ملفات — على mp3 مُركَّب من تروايس حقيقية."""
    ok_n = bad_n = 0

    def ok(cond, msg):
        nonlocal ok_n, bad_n
        print(("  ✓ " if cond else "  ✗ ") + msg)
        ok_n, bad_n = ok_n + bool(cond), bad_n + (not cond)

    # إطارُ MPEG2 Layer III · 24kHz · 64kbps ⇒ 576 عيّنة = 0.024ث، طولُه 192 بايت
    head = bytes([0xFF, 0xF3, 0x84, 0xC4])   # 24kHz · 64kbps ⇒ 192 بايت
    frame = head + b"\x00" * 188
    data = frame * 10
    fr = frames(data)
    ok(len(fr) == 10, f"عشرةُ إطارات تُقرأ عشرةً (قُرئ {len(fr)})")
    ok(abs(fr[0]["sec"] - 0.024) < 0.001, f"مدّةُ الإطار ٠٫٠٢٤ث ({fr[0]['sec']:.4f})")
    ok(fr[0]["len"] == 192, f"طولُ الإطار ١٩٢ بايت ({fr[0]['len']})")

    new, dropped = trim_bytes(data, 0.10)
    ok(abs(dropped - 0.096) < 0.001, f"قصُّ ٠٫١٠ث يحذف أربعةَ إطاراتٍ كاملة ({dropped:.3f}ث)")
    ok(len(new) == 6 * 192, f"والباقي ستةُ إطارات ({len(new) // 192})")
    ok(frames(new)[0]["len"] == 192, "والباقي يُقرأ إطاراتٍ صحيحةً بعد القصّ")

    ok(trim_bytes(data, 0)[1] == 0.0, "قصُّ صفرٍ لا يحذف شيئاً")
    ok(trim_bytes(data, 99)[0] == data, "وقصٌّ يبتلع الملفَ كلَّه يُرفض فيبقى كما هو")
    ok(trim_bytes(data, 0.01)[1] == 0.0, "وما دون إطارٍ كامل لا يُقَصّ (لا كسرَ إطار)")

    tagged = b"ID3\x03\x00\x00\x00\x00\x00\x0a" + b"\x00" * 10 + data
    ok(len(frames(tagged)) == 10, "ووسمُ ID3 في الرأس يُتخطّى بطوله المعلَن")
    cut, _d = trim_bytes(tagged, 0.10)
    ok(cut.startswith(b"ID3"), "ويبقى الوسمُ بعد القصّ (لا يُقَصّ إلا الصوت)")

    print(f"\n{ok_n}/{ok_n + bad_n} تحقّقاً ناجحاً")
    return 1 if bad_n else 0


def main() -> int:
    ap_ = argparse.ArgumentParser(description="مِقصُّ الصمت الأول في ملفات mp3")
    ap_.add_argument("--measure", action="store_true")
    ap_.add_argument("--try", dest="try_texts", default="")
    ap_.add_argument("--apply", action="store_true")
    ap_.add_argument("--min", type=float, default=DEFAULT_MIN)
    ap_.add_argument("--cats", default="", help="أقسامٌ بعينها (letter_name,syllable,…)")
    ap_.add_argument("--self-test", action="store_true")
    args = ap_.parse_args()
    if args.self_test:
        return self_test()
    if args.try_texts:
        return cmd_try(args)
    if args.apply:
        return cmd_apply(args)
    return cmd_measure(args)


if __name__ == "__main__":
    sys.exit(main())
