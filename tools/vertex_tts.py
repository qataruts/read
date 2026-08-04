#!/usr/bin/env python3
"""رافد Vertex AI للتوليد الصوتي — **بجوار مفتاحَي AI Studio لا بديلاً عنهما**.

    python3 tools/vertex_tts.py --probe          # توفّر النماذج والصوت (طلب لكلٍّ)
    python3 tools/vertex_tts.py --sample         # عيّنة خمسة نصوص إلى scratch/

التوثيق: حساب خدمة في `tools/gcloud-sa.json` (خارج git، صلاحيته ٦٠٠) — يُسَكّ منه
رمزُ وصولٍ قصير الأجل ويُجدَّد قبل انقضائه. **لا يُطبع المفتاح ولا يُقتبس محتواه**
في أي مخرَج أو تقرير؛ ولا يُطبع الرمز أيضاً.

الفرق عن AI Studio: نقطة النداء إقليمية بالمشروع، والنموذج يُسمّى باسمه هناك.
وما لا يتوفّر من النماذج على Vertex يبقى صنفُ محتواه على رافد AI Studio.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_audio as gen  # noqa: E402

SA_FILE = gen.ROOT / "tools" / "gcloud-sa.json"
REGION = "us-central1"
SCOPE = "https://www.googleapis.com/auth/cloud-platform"
TOKEN_SKEW = 120          # يُجدَّد الرمز قبل انقضائه بهذا الهامش

# أسماء النماذج على Vertex (قد تخالف AI Studio) ← اسمها عندنا
VERTEX_NAMES = {
    gen.MODEL_CORE: "gemini-3.1-flash-tts-preview",
    gen.MODEL_LEXICON: "gemini-2.5-flash-preview-tts",
    gen.MODEL_SENTENCE: "gemini-2.5-pro-preview-tts",
}
AVAILABILITY = gen.ROOT / "scratch" / "vertex_models.json"


class VertexAuth:
    """رمز وصولٍ من حساب الخدمة، يُسَكّ عند الحاجة ويُجدَّد قبل انقضائه."""

    def __init__(self, sa_path: Path = SA_FILE):
        if not sa_path.exists():
            sys.exit(f"لا ملف حساب خدمة: {sa_path}")
        self.info = json.loads(sa_path.read_text(encoding="utf-8"))
        self.project = self.info["project_id"]
        self._token = None
        self._expires = 0.0

    def token(self) -> str:
        if self._token and time.time() < self._expires - TOKEN_SKEW:
            return self._token
        from google.auth import crypt, jwt  # noqa: PLC0415

        signer = crypt.RSASigner.from_service_account_info(self.info)
        now = int(time.time())
        assertion = jwt.encode(signer, {
            "iss": self.info["client_email"], "scope": SCOPE,
            "aud": self.info["token_uri"], "iat": now, "exp": now + 3600,
        })
        body = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion.decode() if isinstance(assertion, bytes) else assertion,
        }).encode()
        req = urllib.request.Request(self.info["token_uri"], data=body, method="POST",
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        self._token = data["access_token"]
        self._expires = time.time() + int(data.get("expires_in", 3600))
        return self._token


def endpoint(project: str, model: str, region: str = REGION) -> str:
    return (f"https://{region}-aiplatform.googleapis.com/v1/projects/{project}"
            f"/locations/{region}/publishers/google/models/{model}:generateContent")


def synth(auth: VertexAuth, text: str, style: str, model: str, voice: str,
          region: str = REGION, retries: int = 3) -> tuple[bytes, int]:
    """نداء الصوت على Vertex — يعيد (PCM، معدّل العيّنات) كنظيره في AI Studio."""
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": style + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }, ensure_ascii=False).encode("utf-8")
    url = endpoint(auth.project, model, region)
    delay, last = 2.0, None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {auth.token()}",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return gen.extract_audio(json.loads(r.read().decode("utf-8")))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            last = gen.TTSError(f"HTTP {e.code}: {detail}")
            if e.code == 429:
                per_day, secs = gen.parse_429(detail)
                if per_day:
                    raise gen.QuotaExhausted(secs or 3600)
            elif e.code not in (408, 500, 502, 503, 504):
                raise last
        except gen.EmptyAudio:
            raise
        except Exception as e:  # noqa: BLE001
            last = gen.TTSError(f"{type(e).__name__}: {e}")
        if attempt < retries - 1:
            time.sleep(delay)
            delay *= 2
    raise last or gen.TTSError("فشل غير معروف")


def probe(auth: VertexAuth, voice: str, region: str) -> dict:
    """طلبٌ واحد لكل نموذج: أمتوفّرٌ هو والصوت على Vertex؟ (٣ طلبات لا أكثر)"""
    out = {}
    for ours, there in VERTEX_NAMES.items():
        label = gen.short_model(ours)
        try:
            pcm, rate = synth(auth, "بَا", gen.STYLE["syllable"], there, voice, region, retries=1)
            out[ours] = {"vertexName": there, "available": True,
                         "sampleBytes": len(pcm), "rate": rate}
            print(f"  ✓ {label} → «{there}» متوفّر · صوت {voice} يعمل "
                  f"({len(pcm) // 1024}KB PCM @ {rate}Hz)")
        except Exception as e:  # noqa: BLE001
            msg = str(e)[:160].replace("\n", " ")
            out[ours] = {"vertexName": there, "available": False, "error": msg}
            print(f"  ✗ {label} → «{there}»: {msg}", file=sys.stderr)
    AVAILABILITY.parent.mkdir(parents=True, exist_ok=True)
    AVAILABILITY.write_text(json.dumps(
        {"project": auth.project, "region": region, "voice": voice,
         "checkedAt": gen.TODAY, "models": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


SAMPLE = [("بَ", "letter_haraka"), ("لَا", "syllable"), ("غُرْفَةْ", "word"),
          ("مِفْتَاحْ", "word"), ("الْبَيْتُ كَبِيرْ", "sentence")]


def sample(auth: VertexAuth, voice: str, region: str) -> int:
    """خمسة نصوص متنوّعة إلى `scratch/vertex_sample/` — **لا إلى app/audio**."""
    avail = json.loads(AVAILABILITY.read_text(encoding="utf-8"))["models"] \
        if AVAILABILITY.exists() else {}
    out = gen.ROOT / "scratch" / "vertex_sample"
    out.mkdir(parents=True, exist_ok=True)
    rows, failed = [], 0
    for text, cat in SAMPLE:
        ours = gen.route_model({"text": text, "category": cat}, True)
        info = avail.get(ours, {})
        if not info.get("available"):
            print(f"  ⏭ {text}: {gen.short_model(ours)} غير متوفّر على Vertex — يبقى على AI Studio")
            continue
        try:
            pcm, rate = synth(auth, text, gen.STYLE[cat], info["vertexName"], voice, region)
            p = out / f"vertex__{gen.key_for(text)}.mp3"
            gen.pcm_to_mp3(pcm, rate, p)
            ours_file = gen.OUT_DIR / f"{gen.key_for(text)}.mp3"
            if ours_file.exists():
                import shutil  # noqa: PLC0415
                shutil.copy2(ours_file, out / f"studio__{gen.key_for(text)}.mp3")
            rows.append({"text": text, "cat": cat, "model": gen.short_model(ours),
                         "vertex": p.name, "sec": round(gen.mp3_duration(p), 2),
                         "studio": f"studio__{gen.key_for(text)}.mp3" if ours_file.exists() else ""})
            print(f"  ✓ {text} ({gen.CATEGORY_AR[cat]}) · {gen.short_model(ours)} "
                  f"→ {p.name} {rows[-1]['sec']}ث")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ {text}: {str(e)[:120]}", file=sys.stderr)
    write_sample_page(out, rows)
    print(f"\nالعيّنة: {len(rows)} نصاً، {failed} فشل → {out}/index.html")
    return failed


def write_sample_page(out: Path, rows: list) -> None:
    cells = "".join(
        f'<tr><th>{r["text"]}</th><td>{gen.CATEGORY_AR[r["cat"]]}</td><td>{r["model"]}</td>'
        f'<td><button data-src="{r["vertex"]}">▶ Vertex</button><small>{r["sec"]}ث</small></td>'
        + (f'<td><button class="s" data-src="{r["studio"]}">▶ AI Studio</button></td>'
           if r["studio"] else '<td class="miss">لا نظير</td>')
        + "</tr>" for r in rows)
    (out / "index.html").write_text(f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>عيّنة Vertex مقابل AI Studio</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:54rem; line-height:1.9 }}
 table {{ border-collapse:collapse; margin-top:1rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.45rem .8rem; background:#fff; text-align:center }}
 th {{ background:#f0e8db; font-size:1.15rem }}
 button {{ font-family:inherit; font-size:.95rem; padding:.35rem .9rem; cursor:pointer;
           border:1px solid #c9bba6; border-radius:.45rem; background:#fdfaf4 }}
 button.s {{ background:#eef3fb; border-color:#a9bcd6 }}
 button.playing {{ background:#2f7d4f; color:#fff }}
 small {{ display:block; font-size:.62rem; color:#8a7a66; font-family:system-ui }}
 td.miss {{ color:#a1937f; font-size:.85rem }}
</style></head><body>
<h1>عيّنة رافد Vertex مقابل AI Studio</h1>
<p class="note">النصّ واحد والصوت واحد (Sulafat) والتعليمة واحدة — الفرق في الرافد وحده.
<br>الحكم لأذنك: أيصلح Vertex رافداً ثانياً بجوار AI Studio؟ لا إطلاق جماعي قبل إذنك،
ولم يدخل <code>app/audio</code> ملفٌ من هذه العيّنة.</p>
<table><thead><tr><th>النص</th><th>الفئة</th><th>النموذج</th><th>Vertex</th><th>الحالي</th></tr></thead>
<tbody>{cells}</tbody></table>
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
</script></body></html>""", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="رافد Vertex AI")
    ap.add_argument("--probe", action="store_true", help="فحص توفّر النماذج والصوت")
    ap.add_argument("--sample", action="store_true", help="عيّنة خمسة نصوص إلى scratch/")
    ap.add_argument("--region", default=REGION)
    ap.add_argument("--voice", default=gen.DEFAULT_VOICE)
    args = ap.parse_args()

    auth = VertexAuth()
    print(f"المشروع: {auth.project} · الإقليم: {args.region} · الصوت: {args.voice}")
    if args.probe:
        avail = probe(auth, args.voice, args.region)
        n = sum(1 for v in avail.values() if v["available"])
        print(f"\nمتوفّر: {n}/{len(avail)} — البيان: {AVAILABILITY.relative_to(gen.ROOT)}")
        return 0 if n else 1
    if args.sample:
        return sample(auth, args.voice, args.region)
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
