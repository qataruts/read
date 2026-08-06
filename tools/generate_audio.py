#!/usr/bin/env python3
"""توليد ملفات الصوت للتطبيق — محرّكان: Gemini TTS (الافتراضي) و edge-tts (احتياط).

الاستعمال:
    python3 tools/generate_audio.py                    # الناقص فقط بمحرّك gemini
    python3 tools/generate_audio.py --force            # إعادة توليد الكل
    python3 tools/generate_audio.py --engine edge      # المحرّك القديم (مايكروسوفت)
    python3 tools/generate_audio.py --audition         # صفحة مفاضلة أصوات في scratch/audition/
    python3 tools/generate_audio.py --archive-current  # نسخ أصوات app/audio الحالية إلى archive/

يستخرج النصوص من app/js/curriculum.js (أسماء الحروف، الحرف مع كل حركة، مقاطع
التهجّي، الكلمات كاملة) وينتج app/audio/<key>.mp3 والفهرس app/audio/manifest.json.

أسماء الملفات مفاتيح ثابتة (sha1 للنص العربي، أول ١٢ خانة) — استبدال أي ملف
بتسجيل بشري لاحقاً لا يتطلب أي تغيير في الشيفرة.

المفتاح: GEMINI_API_KEY من البيئة أو من ملف .env (غير مُتَتبَّع في git) — لا يُطبع أبداً.
"""

import argparse
import array
import asyncio
import base64
import collections
import datetime
import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "app" / "js" / "curriculum.js"
OUT_DIR = ROOT / "app" / "audio"
ENV_FILE = ROOT / ".env"
QUEUE_FILE = ROOT / "tools" / "audio_queue.json"
RECITATIONS_FILE = ROOT / "tools" / "recitations.json"   # يكتبه tools/fetch_recitation.py
TODAY = datetime.date.today().isoformat()

SUKUN_MARK = "ْ"
HARAKAT = {"fatha": "َ", "kasra": "ِ", "damma": "ُ"}

GEMINI_HOST = "https://generativelanguage.googleapis.com"
DEFAULT_MODEL = "gemini-3.1-flash-tts-preview"
DEFAULT_VOICE = "Sulafat"          # اختيار المالك بالأذن (٢ أغسطس ٢٠٢٦) بعد صفحة المفاضلة

# ————— سياسة النماذج الثلاثة (docs/AUDIO_QUEUE.md — قرار المالك ٤ أغسطس ٢٠٢٦) —————
# ثلاث حصص مستقلة بنفس الصوت Sulafat، والتقسيم **بالمحتوى** كي لا يقع اختلاف مسحة
# صوتية داخل التمرين الواحد. نفاد حصة نموذج لا يوقف النموذجين الآخرين.
MODEL_CORE = "gemini-3.1-flash-tts-preview"      # نواة المرحلة أ + العاجل (١٠٠/يوم)
MODEL_LEXICON = "gemini-2.5-flash-preview-tts"   # كلمات المعجم ومقاطعها (١٠٠/يوم)
MODEL_SENTENCE = "gemini-2.5-pro-preview-tts"    # الجمل الطويلة وحدها (٥٠/يوم)
LEXICON_SOURCES = {"session-7"}                  # الجلسات التي مادتها معجم «حديقة الكلمات»
URGENT_PRIORITY = 10                             # إصلاح عيب مسموع: يذهب للنموذج الأمتن
EMPTY_STREAK_LIMIT = 3                           # استجابات متتابعة بلا صوت ← تنحية النموذج
# «2.5 جيد للكلمات، ولا يعطي مقاطع» (حكم المالك السمعي ٤ أغسطس ٢٠٢٦):
# كل نصّ قصير على نموذج النواة أياً كان مصدره، والكلمة الكاملة وحدها تذهب لـ2.5-flash.
SHORT_CATEGORIES = ("syllable", "letter_haraka", "letter_name")
APPROVAL_FILE = ROOT / "tools" / "model_approval.json"

# تعليمة الأداء تُكتب قبل النص فتوجّه الأداء ولا تُنطق (سلوك مثبَّت في Gemini TTS).
STYLE = {
    "letter_name": ("انطق اسم هذا الحرف العربي كاملاً — الاسمَ لا صوتَ الحرف — "
                    "بوضوح وتأنٍّ معتدل، كما ينطقه معلم لطفل في السادسة، مرة واحدة: "),
    "letter_haraka": "انطق بتأنٍّ شديد ووضوح تام، بمخرج صحيح، كمعلم قرآن يعلّم طفلاً في السادسة: ",
    "syllable": "انطق هذا المقطع بتأنٍّ ووضوح لطفل يتعلم التهجئة: ",
    # حكم المالك (٥ أغسطس ٢٠٢٦): خمسٌ من خمس اختار صيغةً فيها تعليمة إظهار
    # الحرف الأخير — بلاغُه أن الآخر يُبدَل (ل←ن · ب←د · ت←ك).
    "word": "انطق الكلمة بوضوح وودّ لطفل، وأظهرْ آخرَ كل كلمة نطقاً بيّناً بلا إبدال ولا ابتلاع، مرة واحدة: ",
    # فئتان تخصّان قائمة الانتظار (docs/AUDIO_QUEUE.md)
    "sentence": ("اقرأ هذه الجملة بتأنٍّ ووضوح وودّ، كمعلم يقرأ لطفل في السادسة، "
                 "وأظهرْ آخرَ كل كلمة نطقاً بيّناً بلا إبدال ولا ابتلاع، مرة واحدة: "),
    "story_word": "انطق الكلمة بوضوح وودّ لطفل يتابع قصة، وأظهرْ آخرَ كل كلمة نطقاً بيّناً بلا إبدال ولا ابتلاع، مرة واحدة: ",
}
CATEGORY_AR = {
    "letter_name": "اسم حرف",
    "letter_haraka": "حرف بحركة",
    "syllable": "مقطع",
    "word": "كلمة",
    "sentence": "جملة",
    "story_word": "كلمة قصة",
}
# الأدقّ أولاً: نصّ ورد في موضعين يأخذ فئته الأضيق.
CATEGORY_ORDER = ["letter_name", "letter_haraka", "syllable", "word"]


# ————————————————————————— المنهج —————————————————————————

def key_for(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def parse_curriculum(src: str) -> dict:
    """نصوص المنهج ← فئتها، دون تشغيل جافاسكربت. (dict مرتّب أبجدياً)"""
    found = {c: set() for c in CATEGORY_ORDER}

    # الحروف وأسماؤها:  'ب': { name: 'باء', ...
    for m in re.finditer(r"'(.)':\s*\{\s*name:\s*'([^']+)'", src):
        letter, name = m.group(1), m.group(2)
        found["letter_name"].add(name)
        for mark in HARAKAT.values():
            found["letter_haraka"].add(letter + mark)

    # مقاطع التهجّي ثم الكلمات كاملة
    for m in re.finditer(r"tiles:\s*\[([^\]]+)\]", src):
        for t in re.findall(r"'([^']+)'", m.group(1)):
            found["syllable"].add(t)
    for m in re.finditer(r"say:\s*'([^']+)'", src):
        found["word"].add(m.group(1))

    texts = {}
    for cat in CATEGORY_ORDER:
        for t in found[cat]:
            texts.setdefault(t, cat)
    return {t: texts[t] for t in sorted(texts)}


# ————————————————————————— المفتاح والبيئة —————————————————————————

KEY_NAMES = ("GEMINI_API_KEY", "GEMINI_API_KEY_PRO")
INDEPENDENCE_FILE = ROOT / "scratch" / "key_independence.json"


class VertexRafid:
    """مغلِّفُ رافد Vertex بواجهة `synth` — يُحمَّل كسولاً ولا يُطبع مفتاحه."""

    def __init__(self):
        sys.path.insert(0, str(ROOT / "tools"))
        import vertex_tts as vx  # noqa: PLC0415
        self._vx = vx
        self._auth = vx.VertexAuth()

    def synth(self, text: str, style: str, model: str, voice: str):
        return self._vx.synth(self._auth, text, style,
                              self._vx.VERTEX_NAMES.get(model, model), voice)


def vertex_enabled() -> bool:
    """مُفعَّلٌ متى وُجد ملفُّ حساب الخدمة وأُقِرّ الرافد (قرار الإدارة ٥ أغسطس ٢٠٢٦)."""
    return (ROOT / "tools" / "gcloud-sa.json").exists() and is_approved("vertex")


def read_keys() -> list:
    """[(اسم المفتاح، قيمته)] بالترتيب — القيم لا تُطبع في أي مخرَج أبداً."""
    out = []
    if vertex_enabled():
        try:
            out.append((VERTEX_KEY, VertexRafid()))    # الرافد الأول: بلا حصة يومية
        except Exception as e:  # noqa: BLE001
            print(f"  ! تعذّر رافد Vertex: {str(e)[:80]}", file=sys.stderr)
    for name in KEY_NAMES:
        val = read_env_key(name)
        if val and all(val != v for _n, v in out):     # مفتاح مكرر لا يفيد
            out.append((name, val))
    return out


def note_independence(model: str, blocked: str, worked: str, seconds: dict) -> None:
    """يسجّل نتيجة اختبار الاستقلال متى وقع طبيعياً (بلا طلب مهدور).

    الحصص نوافذ متدحرجة، فحالة «مستنفَد» لا تُطلب عند الحاجة؛ ولذلك يُجرى الاختبار
    حيث يقع وحده: أول 429 يوميّ لمفتاحٍ على نموذج، يُعاد الطلب بالمفتاح الآخر.
    """
    INDEPENDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if INDEPENDENCE_FILE.exists():
        try:
            data = json.loads(INDEPENDENCE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    # حكمٌ واحدٌ قاطع: **نجاحُ الثاني بعد نفاد الأول**. أمّا نفادُهما معاً بنافذتين
    # متقاربتين فغيرُ قاطع البتّة — المفتاحان يُستهلكان في الفترة نفسها فتتقارب
    # نافذتاهما ولو كانا مشروعين. (وقع ٤ أغسطس: 2.5-pro أثبت الاستقلال، ثم أوهم
    # 3.1-flash بالعكس لأن الحصتين أُنفقتا معاً.) فلا يُنسخ الإثبات بشبهة.
    verdict = "مستقلّان" if worked else "كلاهما نفد — غير قاطع"
    if not worked and data.get(model, {}).get("verdict") == "مستقلّان":
        return                                  # إثباتٌ سابق لا تنقضه ملاحظةٌ ضعيفة
    data[model] = {"testedAt": TODAY, "blockedKey": blocked, "otherKey": worked or "—",
                   "verdict": verdict, "retrySeconds": seconds}
    INDEPENDENCE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                                 encoding="utf-8")
    print(f"  🔑 اختبار الاستقلال على {short_model(model)}: {verdict}"
          + (f" — يواصل بـ{worked}" if worked else ""))


class KeyPool:
    """مفاتيح متعددة بحساب حصةٍ مستقلٍّ لكل (مفتاح × نموذج).

    نفاد حصة نموذجٍ على مفتاح لا يوقفه على الآخر، ولا يوقف بقية النماذج على الأول.
    """

    def __init__(self, keys: list, voice: str):
        self.keys = keys
        self.voice = voice
        self.exhausted = {}                 # (اسم المفتاح، نموذج) ← ثوانٍ حتى التجدد
        self.used = collections.Counter()   # (اسم المفتاح، نموذج) ← عدد ما وُلِّد

    def available(self, model: str) -> list:
        """المتاح لهذا النموذج، **الأقدمُ استعمالاً أولاً**.

        بلا هذا الترتيب يُستنزف المفتاح الأول وحده فيقيّدنا إيقاعُه (٨/دقيقة)،
        والثاني نائم. وبالتناوب يصير سقفُ النموذج ١٦/دقيقة — ولكلّ مفتاح إيقاعُه
        كما هو، فلا تجاوز لحدٍّ ولا خطر 429.
        """
        free = [(n, v) for n, v in self.keys
                if (n, model) not in self.exhausted and spend_left(n, model) > 0]
        return sorted(free, key=lambda kv: _LAST_REQUEST.get(f"{kv[0]}:{model}", 0.0))

    def all_exhausted(self, model: str) -> bool:
        return not self.available(model)

    def capped(self, model: str) -> list:
        """مفاتيحُ بلغت سقفَنا الذاتي اليوم (لا سقف الخادم)."""
        return [n for n, _v in self.keys
                if (n, model) not in self.exhausted and spend_left(n, model) <= 0]

    def retry_seconds(self, model: str) -> int:
        secs = [s for (n, m), s in self.exhausted.items() if m == model]
        return min(secs) if secs else 3600

    def call(self, text: str, style: str, model: str) -> tuple[bytes, int, str]:
        """يجرّب المفاتيح المتاحة لهذا النموذج بالترتيب؛ يرفع QuotaExhausted متى نفدت كلها.

        الرافدان: مفاتيح AI Studio (حصة يومية بالعدد) و**Vertex** (فوترة بالدولار).
        وVertex يُقدَّم متى كان متاحاً — لا حصة تحبسه، وقد أثبت مخرجاً من نصوصٍ
        عاندت AI Studio («رَاةْ»). وسقفُه ٥$/يوم يوقفه ويستدعي مراجعةً بشرية.
        """
        blocked = None
        for name, value in self.available(model):
            try:
                if name == VERTEX_KEY:
                    _pace(f"{name}:{model}")
                    pcm, rate = value.synth(speech_form(text), style, model, self.voice)
                    bump_usd(model, len(style + text) // 3 + 8, len(pcm) / 2 / rate)
                    if usd_left() <= 0:
                        print(f"  🛑 Vertex: بلغ سقف اليوم {VERTEX_DAILY_USD}$ — "
                              f"يتوقّف ويستدعي مراجعةً بشرية", file=sys.stderr)
                else:
                    pcm, rate = gemini_pcm(speech_form(text), style, model, self.voice, value,
                                           pace_key=f"{name}:{model}")
                if blocked and blocked != VERTEX_KEY:   # نجاح الثاني بعد نفاد الأول
                    note_independence(model, blocked, name,
                                      {blocked: self.exhausted[(blocked, model)]})
                self.used[(name, model)] += 1
                return pcm, rate, name
            except QuotaExhausted as e:
                self.exhausted[(name, model)] = e.seconds
                print(f"  ⏸ {short_model(model)} · {name}: {e}", file=sys.stderr)
                if blocked:                 # نفد الاثنان: قارن نافذتَي التجدد
                    first = self.exhausted[(blocked, model)]
                    if abs(first - e.seconds) < 300:
                        note_independence(model, blocked, "", {blocked: first, name: e.seconds})
                blocked = blocked or name
        if self.capped(model):
            print(f"  🛑 {short_model(model)}: بلغ سقفَنا الذاتي اليومي "
                  f"({DAILY_CAPS.get(model)} لكل مفتاح) — يتوقّف حزامَ أمان",
                  file=sys.stderr)
        raise QuotaExhausted(self.retry_seconds(model))


def read_env_key(name: str = "GEMINI_API_KEY") -> str | None:
    """المفتاح من البيئة أو .env بمحلّل بسيط (لا حزم جديدة، ولا طباعة للقيمة)."""
    val = os.environ.get(name)
    if val:
        return val.strip()
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == name:
            return v.strip().strip("'\"") or None
    return None


# ————————————————————————— PCM ← Gemini —————————————————————————

class TTSError(RuntimeError):
    pass


class QuotaExhausted(TTSError):
    """الحصة اليومية (RPD) للنموذج نفدت — لا تُعاد المحاولة، يُنتظر التجدد."""

    def __init__(self, seconds: int, detail: str = ""):
        super().__init__(f"الحصة اليومية نفدت — التجدد بعد {seconds} ثانية. {detail}".strip())
        self.seconds = seconds


_MIN_INTERVAL = 0.0        # ثوانٍ بين طلبين لنفس النموذج (يضبطها --rpm)
# إيقاعٌ لكل رافد: AI Studio محدودٌ بـ١٠/دقيقة للنموذج فنبقى دونه، وVertex لا حدّ
# دقيقيّ له بل فوترة — فخنقُه بإيقاع AI Studio يضيّع أهمّ ما جاء به: السرعة.
RPM_BY_KEY = {"VERTEX": 60.0}
_LAST_REQUEST = {}         # نموذج ← وقت آخر طلب له (حدّ الدقيقة لكل نموذج على حدة)


def set_rpm(rpm: float) -> None:
    """سقف الطلبات في الدقيقة **لكل نموذج** — دون حدّه كي لا تُحرق محاولات على 429."""
    global _MIN_INTERVAL
    _MIN_INTERVAL = 60.0 / rpm if rpm > 0 else 0.0


def _pace(model: str = "") -> None:
    """مَخنَقُ كل طلب: يباعد بالإيقاع **ويقيّد الإنفاق** — فلا طلبَ بلا عدّ."""
    rpm = RPM_BY_KEY.get(model.split(":")[0]) if ":" in model else None
    interval = 60.0 / rpm if rpm else _MIN_INTERVAL
    if interval:
        wait = _LAST_REQUEST.get(model, 0.0) + interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
    _LAST_REQUEST[model] = time.monotonic()
    if ":" in model:                    # مفتاح:نموذج — لا نعدّ نداءات بلا مفتاح
        bump_spend(model)


def parse_429(body: str) -> tuple[bool, int]:
    """يفكّ جسم خطأ 429: (أهي حصة يومية؟، ثوانٍ حتى التجدد)."""
    per_day, seconds = False, 0
    try:
        err = json.loads(body).get("error", {})
    except json.JSONDecodeError:
        return "per_day" in body or "PerDay" in body, 0
    for det in err.get("details", []):
        for v in det.get("violations", []):
            qid = f'{v.get("quotaId", "")} {v.get("quotaMetric", "")}'
            if "PerDay" in qid or "per_day" in qid:
                per_day = True
        if det.get("@type", "").endswith("RetryInfo"):
            m = re.match(r"(\d+)", str(det.get("retryDelay", "")))
            if m:
                seconds = int(m.group(1))
    if not per_day:
        msg = err.get("message", "")
        per_day = "per_day" in msg or "per day" in msg
    return per_day, seconds


class EmptyAudio(TTSError):
    """استجابة ٢٠٠ بلا صوت (finishReason: OTHER) — عيب النموذج في نصّ بعينه."""


def gemini_pcm(text: str, style: str, model: str, voice: str, api_key: str,
               retries: int = 5, empty_retries: int = 2, pace_key: str = "") -> tuple[bytes, int]:
    """يعيد (PCM خام 16-bit little-endian، معدّل العيّنات). يعيد المحاولة عند 429/5xx.

    `style` تعليمة الأداء التي تسبق النص (لا تُنطق) — انظر STYLE.
    """
    body = json.dumps({
        "contents": [{"parts": [{"text": style + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }, ensure_ascii=False).encode("utf-8")

    url = f"{GEMINI_HOST}/v1beta/models/{model}:generateContent"
    delay = 2.0
    last = None
    empty = 0
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        })
        # حزامٌ للعيب النادر «POST data should be bytes» (مرّتان في ~٢٦٠٠ طلب،
        # ولم يُفسَّر بالقراءة): إن صار الجسمُ نصّاً بأي سبيل يُرمَّز ويُبلَّغ بدل
        # أن يسقط النصّ ويُترك منتظِراً.
        if isinstance(req.data, str):
            print(f"  ! جسم الطلب صار نصّاً — رُمِّز تلقائياً ({text[:20]}…)", file=sys.stderr)
            req.data = req.data.encode("utf-8")
        try:
            _pace(pace_key or model)
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return extract_audio(payload)
        except urllib.error.HTTPError as e:
            code = e.code
            body = e.read().decode("utf-8", "replace")
            detail = body[:300]
            # لا نطبع الرابط (يخلو من المفتاح أصلاً) ولا الترويسات.
            last = TTSError(f"HTTP {code}: {detail}")
            if code == 429:
                per_day, seconds = parse_429(body)
                if per_day:                     # لا فائدة من إعادة المحاولة قبل التجدد
                    raise QuotaExhausted(seconds or 3600)
                if seconds:                     # حدّ الدقيقة: انتظر ما يطلبه الخادم
                    delay = max(delay, min(seconds + 1, 120))
            if code not in (408, 429, 500, 502, 503, 504):
                raise last
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = TTSError(f"{type(e).__name__}: {e}")
        except EmptyAudio as e:
            # استجابة ٢٠٠ بلا صوت: غير حتمية فتُعاد المحاولة — لكن **مرّتين فقط**،
            # لأن كل محاولة طلبٌ يُخصم من حصة اليوم (تُحرق ٥ محاولات على نصّ عصيّ
            # فتضيع عشرات الطلبات كما وقع في تصريف ٣ أغسطس).
            last = e
            empty += 1
            if empty >= empty_retries:
                raise
        except TTSError as e:
            last = e
        if attempt < retries - 1:
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise last or TTSError("فشل غير معروف")


def extract_audio(payload: dict) -> tuple[bytes, int]:
    """يجمع كل أجزاء inlineData الصوتية ويستخرج معدّل العيّنات من mimeType."""
    chunks, rate = [], 24000
    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if not inline:
                continue
            mime = inline.get("mimeType") or inline.get("mime_type") or ""
            if not mime.startswith("audio/"):
                continue
            m = re.search(r"rate=(\d+)", mime)
            if m:
                rate = int(m.group(1))
            chunks.append(base64.b64decode(inline["data"]))
    if not chunks:
        reason = payload.get("promptFeedback") or payload.get("candidates") or payload
        raise EmptyAudio(f"لا صوت في الاستجابة: {json.dumps(reason, ensure_ascii=False)[:200]}")
    return b"".join(chunks), rate


# ————————————————————————— PCM → MP3 —————————————————————————

_HAVE_FFMPEG = shutil.which("ffmpeg")
_ENCODER = None


SILENCE_RATIO = 0.02        # ٢٪ من الذروة يُعدّ صمتاً
SILENCE_PAD_MS = 60         # هامش يبقى قبل الصوت وبعده


def trim_pcm(pcm: bytes, rate: int) -> bytes:
    """قصّ صمت الطرفين من PCM خام (١٦ بت أحادي) قبل الترميز.

    المولّد يعيد أحياناً صمتاً طويلاً قبل النطق (بلغ ١٫٢٨ث في «عَا») — والطفل
    ينقر فينتظر. القصّ هنا في الأنبوب: بلا حصة، وينفع كل ملف يُولَّد بعده.
    """
    samples = array.array("h")
    samples.frombytes(pcm[:len(pcm) - len(pcm) % 2])
    if sys.byteorder == "big":
        samples.byteswap()
    if not samples:
        return pcm
    peak = max(max(samples), -min(samples))
    if peak == 0:
        return pcm
    thr = peak * SILENCE_RATIO
    start, end = 0, len(samples) - 1
    while start < len(samples) and abs(samples[start]) < thr:
        start += 1
    while end > start and abs(samples[end]) < thr:
        end -= 1
    pad = int(rate * SILENCE_PAD_MS / 1000)
    cut = samples[max(0, start - pad):min(len(samples), end + pad + 1)]
    if len(cut) < rate * 0.1:          # لا تقصّ إلى لا شيء (نصّ صامت غالباً عيب آخر)
        return pcm
    if sys.byteorder == "big":
        cut.byteswap()
    return cut.tobytes()


def pcm_to_mp3(pcm: bytes, rate: int, path: Path, trim: bool = True) -> None:
    """تحويل PCM (l16 mono) إلى mp3 — ffmpeg إن وُجد، وإلا lameenc داخل بايثون."""
    if trim:
        pcm = trim_pcm(pcm, rate)
    path.parent.mkdir(parents=True, exist_ok=True)
    if _HAVE_FFMPEG:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(rate),
             "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "64k", str(path)],
            input=pcm, check=True,
        )
        return

    global _ENCODER
    if _ENCODER is None:
        try:
            import lameenc  # noqa: PLC0415
        except ImportError:
            sys.exit("يلزم ffmpeg أو الحزمة lameenc:  .venv/bin/pip install lameenc")
        _ENCODER = lameenc
    enc = _ENCODER.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)          # ٠ الأبطأ/الأجود … ٩ الأسرع
    enc.silence()
    path.write_bytes(enc.encode(pcm) + enc.flush())


# ————————————————————————— مدة mp3 (بلا مكتبات ولا ffmpeg) —————————————————————————

BITRATES_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BITRATES_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def mp3_duration(path: Path) -> float:
    """مدة الملف بالثواني من إطاراته (يتخطّى ID3 ويعدّ الإطارات فعلياً)."""
    data = path.read_bytes()
    i = 0
    if data[:3] == b"ID3":
        size = ((data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14
                | (data[8] & 0x7F) << 7 | (data[9] & 0x7F))
        i = 10 + size
    total = 0.0
    n = len(data)
    while i + 4 <= n:
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        ver = (data[i + 1] >> 3) & 0x03          # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
        layer = (data[i + 1] >> 1) & 0x03        # 1 = Layer III
        bidx = (data[i + 2] >> 4) & 0x0F
        ridx = (data[i + 2] >> 2) & 0x03
        pad = (data[i + 2] >> 1) & 0x01
        if layer != 1 or ver == 1 or bidx in (0, 15) or ridx == 3:
            i += 1
            continue
        rate = RATES[ver][ridx]
        kbps = (BITRATES_V1L3 if ver == 3 else BITRATES_V2L3)[bidx]
        spf = 1152 if ver == 3 else 576
        length = (spf // 8 * kbps * 1000) // rate + pad
        if length <= 4:
            i += 1
            continue
        total += spf / rate
        i += length
    return total



# ————————————————————————— التوليد —————————————————————————

def is_same_as(path: Path, ref_dir: Path) -> bool:
    """هل الملف ما زال نسخته القديمة في مجلد المرجع؟ (لم يُعَد توليده بعد)"""
    ref = ref_dir / path.name
    return ref.exists() and ref.read_bytes() == path.read_bytes()


def synthesize_gemini(texts: dict, model: str, voice: str, force: bool, api_key,
                      replace_same_as: Path | None = None, dry_run: bool = False) -> int:
    pool = api_key if isinstance(api_key, KeyPool) else KeyPool([("GEMINI_API_KEY", api_key)], voice)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # الفهرس يُبنى كاملاً قبل التوليد كي يبقى صحيحاً حتى لو توقّف التوليد في منتصفه،
    # ويضمّ منجَز قائمة الانتظار كي لا يسقط منه ما صُرِّف سابقاً.
    manifest = manifest_map()
    made = skipped = failed = 0
    total = len(texts)

    for i, (text, cat) in enumerate(texts.items(), 1):
        checkpoint_pause()
        path = OUT_DIR / f"{key_for(text)}.mp3"
        stale = replace_same_as is not None and path.exists() and is_same_as(path, replace_same_as)
        if path.exists() and not force and not stale:
            skipped += 1
            continue
        if dry_run:
            made += 1
            print(f"  [{i}/{total}] ⟶ {text} ({CATEGORY_AR[cat]}) → {path.name}")
            continue
        try:
            pcm, rate, _key = pool.call(text, STYLE[cat], model)
            pcm_to_mp3(pcm, rate, path)
            made += 1
            print(f"  [{i}/{total}] ✓ {text} ({CATEGORY_AR[cat]}) → {path.name} "
                  f"{path.stat().st_size // 1024}KB")
        except QuotaExhausted as e:
            print(f"\n  ⏸ {e}  (توقّف عند {i}/{total} بلا إحراق محاولات)", file=sys.stderr)
            print(f"RETRY_AFTER_SECONDS={e.seconds}")
            break
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  [{i}/{total}] ✗ {text}: {e}", file=sys.stderr)

    if dry_run:
        print(f"\nسيولَّد: {made}، ويُترك: {skipped}. (تجربة جافّة — لم يُطلب شيء)")
        return 0
    write_manifest(manifest)
    print(f"\nتم: {made} مولّد، {skipped} موجود مسبقاً، {failed} فشل.")
    return failed


async def synthesize_edge(texts: dict, voice: str, force: bool) -> int:
    import edge_tts

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = manifest_map()
    made = skipped = failed = 0

    for text in texts:
        path = OUT_DIR / f"{key_for(text)}.mp3"
        if path.exists() and not force:
            skipped += 1
            continue
        try:
            # rate أبطأ قليلاً يناسب أذن الطفل المتعلم
            tts = edge_tts.Communicate(text, voice=voice, rate="-20%")
            await tts.save(str(path))
            made += 1
            print(f"  ✓ {text}  →  {path.name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ {text}: {e}", file=sys.stderr)

    write_manifest(manifest)
    print(f"\nتم: {made} مولّد، {skipped} موجود مسبقاً، {failed} فشل.")
    return failed


def write_manifest(manifest: dict) -> None:
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"الفهرس: {OUT_DIR / 'manifest.json'} ({len(manifest)} نصاً)")
    write_versions(manifest)


# ————————————————————— بصمات المحتوى (كسر كاش الصوت) —————————————————————
#
# **العيب الذي تعالجه**: اسم الملف مشتقّ من **نصّه** لا من محتواه، فاستبدال
# صوتٍ تحت المفتاح نفسه (edge ← Sulafat، وانتقاء المدود…) لا يغيّر الرابط —
# والجهاز الذي خزّن النسخة القديمة في عامل الخدمة يبقى عليها إلى الأبد، فيُسمع
# الحرفُ الواحد بصوتين مختلفين بحسب تاريخ أول طلبٍ لكل جهاز.
#
# **الحلّ**: بصمة **البايتات** (أول ٨ من sha1) في بيانٍ مجاور، يطلب بها التطبيق
# `<key>.mp3?v=<بصمة>` — فتبديل المحتوى يكسر كاش ذلك الملف وحده، ويبقى ما لم
# يُبدَّل مخزوناً كما هو (لا إعادة تنزيل ٢٥٥ ملفاً على كل تبديل).
#
# **ولماذا بيانٌ مجاور لا حقلٌ في الفهرس؟** الفهرس «مفتاح ← نصّ» يقرؤه ستة
# فاحصين وأدوات، وتغيير شكله يكسرها جميعاً ويجعل كتابةً واحدة بشيفرة قديمة
# (والمصرِّف عمليةٌ حيّة) تُسقِط الجميع. الملف المجاور يتحمّل الغياب: بلا بصمة
# يعمل كل شيء كما كان — بلا وسمٍ فقط.
#
# **ولا تُبنى البصمات تراكمياً أبداً**: كل كتابةٍ تعيد اشتقاق البيان كلِّه من
# بايتات القرص، فأيّ استبدالٍ سبق بشيفرةٍ قديمة يُشفى من تلقائه في التصريف
# التالي — ولا يُترك ملفٌ ببصمةٍ كاذبة (وهي أخطر من غيابها).

def fingerprint(path: Path) -> str:
    """بصمة محتوى الملف — أول ٨ خانات من sha1 بايتاته."""
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def versions_map(manifest: dict) -> dict:
    """مفتاح ← بصمة محتواه، مشتقّاً من القرص (ما لا ملف له لا بصمة له)."""
    out = {}
    for key in sorted(manifest):
        path = OUT_DIR / f"{key}.mp3"
        if path.exists():
            out[key] = fingerprint(path)
    return out


def write_versions(manifest: dict) -> dict:
    """كتابة `versions.json` **ذرّياً** (ملف مؤقت فاستبدال): المصرِّف عملية حيّة،
    فلا يقرأ التطبيقُ ولا فاحصٌ بياناً نصفَ مكتوب."""
    versions = versions_map(manifest)
    path = OUT_DIR / "versions.json"
    tmp = path.with_suffix(f".{os.getpid()}.tmp")   # اسمٌ خاصّ بالعملية
    tmp.write_text(json.dumps(versions, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(path)
    print(f"البصمات: {path} ({len(versions)} ملفاً)")
    return versions


def stale_versions(manifest: dict) -> list:
    """مفاتيح بصمتُها في البيان تخالف بايتات ملفها (أو غائبة) — عيب الخلط عائداً."""
    if not (OUT_DIR / "versions.json").exists():
        return sorted(k for k in manifest if (OUT_DIR / f"{k}.mp3").exists())
    have = json.loads((OUT_DIR / "versions.json").read_text(encoding="utf-8"))
    return sorted(k for k, v in versions_map(manifest).items() if have.get(k) != v)


def recitation_texts() -> dict:
    """تلاوات قارئ متقن جلبها tools/fetch_recitation.py — ملفات لا يولّدها المولّد.

    بيانها مستقل عن `manifest.json` عمداً: الفهرس بيان الأصوات المولّدة، ونصّ
    المصحف ممنوع منه (METHOD §٥.٦ و`docs/AUDIO_QUEUE.md`).
    """
    if not RECITATIONS_FILE.exists():
        return {}
    try:
        data = json.loads(RECITATIONS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {e["text"]: f"{e['surah']:03d}:{e['ayah']:03d}" for e in data if e.get("text")}


CORE_CATEGORIES = ("letter_name", "letter_haraka", "syllable")
DURATION_RATIO = 1.7        # مدة تتجاوز هذا × وسيط فئتها = شذوذ يُبلَّغ
DURATION_SHORT = 0.55       # ومدة دونه × الوسيط = مبتورة (نطقٌ ناقص أو مقصوص)


def shape_class(text: str, cat: str) -> str:
    """طبقة المقارنة: الشكل الصوتيّ لا الفئة الإدارية.

    فئة «مقطع» تخلط أربعة أطوالٍ مختلفة طبعاً — الساكن المفرد («بْ» ~٠٫٥ث)،
    والمقطع البسيط («بَ»)، والمدّ («بَا» ~١٫٥ث)، والمركّب ذي الكلمتين
    («سُكْ كَرْ» ~٢٫٥ث). فمقارنةُ الساكن بوسيطها كان يتّهم السليمَ بالبتر.
    """
    if cat != "syllable":
        return cat
    if " " in text:
        return "syllable:مركّب"
    if len(text) == 2 and text.endswith(SUKUN_MARK):
        return "syllable:ساكن"
    if len(text) == 3 and text[1] in HARAKAT.values() and text[2] in "اوي":
        return "syllable:مدّ"
    # «كَةْ» و«وَةْ» و«عَةْ»: تاءٌ مربوطة ساكنة تُقفل المقطع، فيقصر بطبعه عن
    # نظيره المفتوح («كَا»). كان الحارس يقيسها بوسيط المقاطع البسيطة فيتّهمها
    # بالبتر — والمعايرة بالبنية لا بإسكات ملفٍ بعينه (إذن المدير ٥ أغسطس ٢٠٢٦).
    if text.endswith("ةْ"):
        return "syllable:مقفل بالتاء"
    return "syllable:بسيط"


LINEAGE_LEDGER = ROOT / "tools" / "audio_lineage.json"
VERDICTS = ROOT / "tools" / "audio_verdicts.json"   # ما سمعه المالك وحكم فيه


def load_verdicts() -> dict:
    """أحكامُ أذنِ المالك: نصّ ← (التاريخ، الحكم). التنبيه بعدها خبرٌ لا مطالبة."""
    if not VERDICTS.exists():
        return {}
    try:
        return json.loads(VERDICTS.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def record_verdict(text: str, verdict: str) -> None:
    data = load_verdicts()
    data[text] = {"verdict": verdict, "at": TODAY}
    VERDICTS.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def human_texts() -> set:
    """نصوصٌ صوتُها **بشريّ** (Antura أو تلاوة) — لا يُقاس بمسطرة المولَّد.

    خطأ ٥ أغسطس ٢٠٢٦: اتُّهم «طاء» بالبتر (٠٫٤٢ث مقابل وسيط ٠٫٩١ث) فاستُبدل
    بمولَّد — وهو تسجيلٌ بشريّ من Antura أُجيز بأذن المالك. والوسيط نفسه يغلب
    عليه المولَّد، فقياس البشريّ به ظلمٌ بنيويّ: الإنسان أوجزُ من الآلة.
    """
    out = {e["text"] for e in load_queue()
           if "antura" in str(e.get("model", "")).lower()}
    out |= set(recitation_texts())
    if LINEAGE_LEDGER.exists():
        try:
            for row in json.loads(LINEAGE_LEDGER.read_text(encoding="utf-8")).get("files", {}).values():
                if row.get("lineage") in ("antura", "husary"):
                    out.add(row.get("text", ""))
        except json.JSONDecodeError:
            pass
    return out


def duration_outliers(texts: dict) -> list:
    """شواذ المدة في فئات النواة — حارسٌ دائم ضد التكرار الداخلي في الملف.

    بلاغ المالك (٤ أغسطس ٢٠٢٦): «بعض أصوات الحروف منطوقة مرتين». الملف المكرر
    يطول عن نظائره، فالمدة كاشفٌ رخيص يُشغَّل مع كل تحقّق. (التصنيف القاطع
    — نطقتان أم طول طبيعي — في `tools/audio_audit.py --analyze`.)
    """
    human = human_texts()
    by_cat = {}
    for text, cat in texts.items():
        if cat not in CORE_CATEGORIES or text in human:   # البشريّ خارج المسطرة
            continue
        p = OUT_DIR / f"{key_for(text)}.mp3"
        if p.exists():
            by_cat.setdefault(shape_class(text, cat), []).append((text, mp3_duration(p)))
    out = []
    for cat, items in by_cat.items():
        if len(items) < 4:                  # طبقةٌ صغيرة لا وسيط لها يُعتدّ به
            continue
        med = statistics.median(s for _t, s in items)
        if not med:
            continue
        out += [(t, cat, s, med) for t, s in items
                if s > DURATION_RATIO * med or s < DURATION_SHORT * med]
    return sorted(out, key=lambda r: -r[2] / r[3])


def verify(texts: dict, pending: dict | None = None, min_bytes: int = 1500) -> int:
    """تحقّق ختامي: لكل نص متوقَّع ملف، ولا ملف يتيم، ولا ملف أصغر من الحد المعقول.

    `pending` = نصوص قائمة الانتظار التي لم تُصرَّف بعد: غيابها متوقَّع لا خطأ.
    """
    pending = pending or {}
    recitations = recitation_texts()
    problems = []
    keys = {key_for(t) for t in texts}
    on_disk = {p.stem for p in OUT_DIR.glob("*.mp3")}
    for t in texts:
        p = OUT_DIR / f"{key_for(t)}.mp3"
        if not p.exists():
            problems.append(f"ناقص: {t}")
        elif p.stat().st_size < min_bytes:
            problems.append(f"صغير جداً ({p.stat().st_size}B): {t}")
    for t, ref in recitations.items():
        p = OUT_DIR / f"{key_for(t)}.mp3"
        if not p.exists():
            problems.append(f"تلاوة ناقصة ({ref})")
    known = keys | {key_for(t) for t in pending} | {key_for(t) for t in recitations}
    for orphan in sorted(on_disk - known):
        problems.append(f"يتيم (لا نصّ له في المنهج ولا في القائمة): {orphan}.mp3")
    # بصمةٌ تخالف بايتاتِ ملفها = رابطٌ لا يتغيّر باستبدال المحتوى = عيب الخلط عائداً
    for key in stale_versions({key_for(t): t for t in texts}):
        problems.append(f"بصمة قديمة ({key}.mp3) — أصلحها بـ`--sync-versions` قبل النشر")

    long_ones = duration_outliers(texts)

    print(f"\nالتحقّق الختامي: {len(texts)} نصاً متوقَّعاً، {len(on_disk)} ملفاً على القرص.")
    verdicts = load_verdicts()
    for text, cat, sec, med in long_ones:
        kind = "أطول" if sec > med else "أقصر"
        why = "تكرار داخلي" if sec > med else "نطقٌ مبتور"
        label = CATEGORY_AR.get(cat, cat).replace("syllable:", "مقطع ")
        if text in verdicts:                    # سمعه المالك وحكم — خبرٌ لا مطالبة
            print(f"  ℹ شذوذ مدة معلوم ({label}): «{text}» {sec:.2f}ث — "
                  f"بحكم المالك ({verdicts[text]['at']}): {verdicts[text]['verdict']}")
            continue
        print(f"  ⚠ شذوذ مدة ({label}): «{text}» {sec:.2f}ث "
              f"= {sec / med:.1f}× وسيط فئته ({med:.2f}ث) — {kind} من نظائره، يُسمَع لاحتمال {why}")
    if recitations:
        print(f"  🎧 {len(recitations)} تلاوةً بصوت قارئ (خارج الفهرس عمداً — لا تولَّد).")
    if pending:
        print(f"  ⏳ {len(pending)} نصاً في قائمة الانتظار لم يُصرَّف بعد (غيابها متوقَّع).")
    for p in problems:
        print(f"  ✗ {p}", file=sys.stderr)
    if not problems:
        print("  ✓ كل نصّ متوقَّع له ملفه، ولا يتيم، ولا ملف مبتور.")
    return len(problems)


def archive_current(dest: Path) -> None:
    """نسخة احتياطية من أصوات app/audio الحالية خارج app/ قبل الاستبدال."""
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(OUT_DIR.glob("*.mp3")) + [OUT_DIR / "manifest.json"]:
        if f.exists():
            shutil.copy2(f, dest / f.name)
            n += 1
    print(f"حُفظت نسخة من {n} ملفاً في {dest.relative_to(ROOT)}/")


# ————————————————————————— قائمة الانتظار (docs/AUDIO_QUEUE.md) —————————————————————————

def load_queue() -> list:
    """قائمة النصوص المطلوبة من جلسات التطوير — تُنشأ فارغة إن لم تكن موجودة."""
    if not QUEUE_FILE.exists():
        return []
    try:
        data = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"{QUEUE_FILE.name} ليس JSON صالحاً: {e}")
    if not isinstance(data, list):
        sys.exit(f"{QUEUE_FILE.name} يجب أن يكون مصفوفة JSON")
    for i, entry in enumerate(data):
        if not isinstance(entry, dict) or not entry.get("text"):
            sys.exit(f"مدخل {i} في {QUEUE_FILE.name} بلا نصّ")
        cat = entry.get("category", "word")
        if cat not in STYLE:
            sys.exit(f"مدخل {i}: فئة غير معروفة «{cat}» — المتاح: {'، '.join(STYLE)}")
    return data


def save_queue(queue: list) -> None:
    """كتابة ذرّية: ملف مؤقت ثم استبدال — فلا يقرأ أحدٌ ملفاً نصفَ مكتوب.

    واسمُ المؤقت **يحمل رقم العملية**: عمليتان تكتبان معاً (مصرِّفٌ وإصلاحٌ ذاتيّ)
    كانتا تتنازعان اسماً واحداً، فيستبدل أحدهما ملفَ الآخر ويسقط الثاني بـ
    FileNotFoundError — وقع فعلاً ٥ أغسطس ٢٠٢٦ في `versions.json`.
    """
    tmp = QUEUE_FILE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, QUEUE_FILE)


def mark_done(text: str, model: str) -> None:
    """تسجيل نصّ مُصرَّفاً **بدمج** لا باستبدال.

    التصريف يستغرق دقائق، وجلسة تطوير قد تُضيف مئات النصوص أثناءه؛ فكتابة اللقطة
    القديمة كاملةً كانت تمحو إضافاتها. لذلك تُعاد قراءة الملف عند كل تسجيل ويُعدَّل
    فيه المدخل المطابق وحده (بنصّه)، ويبقى كل جديد على حاله.
    """
    disk = load_queue()
    changed = False
    for e in disk:
        if e.get("text") == text and e.get("status", "pending") != "done":
            e.update(status="done", doneAt=TODAY, model=model)
            changed = True
    if changed:
        save_queue(disk)
    return changed


# ————— سقف الإنفاق اليومي الذاتي (أمر المدير ٤ أغسطس ٢٠٢٦) —————
# حزامُ أمانٍ لا يعتمد على الخادم: نحاسب أنفسنا لكل (مفتاح × نموذج) ونرفض
# التجاوز ولو سمح الخادم — فأيّ مستهلكٍ خارجي أو خللِ عدٍّ لا يُفاجئنا بنفادٍ
# مبكّر يوقف عمل يومٍ كامل. الأرقام هي حدود الخطة المعلومة لكل مفتاح.
DAILY_CAPS = {
    "gemini-3.1-flash-tts-preview": 100,
    "gemini-2.5-flash-preview-tts": 100,
    "gemini-2.5-pro-preview-tts": 50,
}
SPEND_FILE = ROOT / "scratch" / "spend.json"
# رافد Vertex: بلا حصة يومية بل بفوترة — فحدُّه **إنفاقٌ بالدولار** لا عدد طلبات.
# سقفُ الإدارة (٥ أغسطس ٢٠٢٦): ٥$ يومياً، وبلوغُه يوقف التصريف ويستدعي مراجعة بشرية.
VERTEX_KEY = "VERTEX"
VERTEX_DAILY_USD = 5.0
# مقيسٌ من usageMetadata: ٢٥ رمز صوت لكل ثانية، ورموز الإدخال ~٢٠ للنصّ القصير.
PRICE_PER_M = {                       # (إدخال، خرج صوتي) بالدولار لكل مليون رمز
    "gemini-3.1-flash-tts-preview": (0.50, 10.0),
    "gemini-2.5-flash-preview-tts": (0.50, 10.0),
    "gemini-2.5-pro-preview-tts": (1.00, 20.0),
}
AUDIO_TOKENS_PER_SEC = 25
STATUS_FILE = ROOT / "scratch" / "monitor_status.json"


def load_spend() -> dict:
    """{"مفتاح:نموذج": عدد} ليوم اليوم — يُنسى ما قبله."""
    if not SPEND_FILE.exists():
        return {}
    try:
        data = json.loads(SPEND_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data.get(TODAY, {}) if isinstance(data, dict) else {}


def bump_spend(pace_key: str) -> None:
    """يُزاد عند كل طلبٍ فعليّ (من `_pace`، وهو مَخنَق كل الطلبات)."""
    SPEND_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if SPEND_FILE.exists():
        try:
            data = json.loads(SPEND_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    day = data.setdefault(TODAY, {})
    day[pace_key] = day.get(pace_key, 0) + 1
    for old in [k for k in data if k != TODAY]:
        data.pop(old)
    tmp = SPEND_FILE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, SPEND_FILE)


def spend_left(key_name: str, model: str) -> int:
    if key_name == VERTEX_KEY:                     # Vertex يُحاسَب بالمال لا بالعدد
        return 10 ** 6 if usd_left() > 0 else 0
    cap = DAILY_CAPS.get(model, 100)
    return max(0, cap - load_spend().get(f"{key_name}:{model}", 0))


def bump_usd(model: str, in_tokens: int, audio_sec: float) -> None:
    """يقيّد كلفة طلبٍ على Vertex بالدولار (من عدّاد الرموز المقيس)."""
    pi, po = PRICE_PER_M.get(model, (0.5, 10.0))
    usd = in_tokens / 1e6 * pi + audio_sec * AUDIO_TOKENS_PER_SEC / 1e6 * po
    data = {}
    if SPEND_FILE.exists():
        try:
            data = json.loads(SPEND_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    day = data.setdefault(TODAY, {})
    day["VERTEX_USD"] = round(day.get("VERTEX_USD", 0.0) + usd, 6)
    tmp = SPEND_FILE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, SPEND_FILE)


def usd_spent() -> float:
    return float(load_spend().get("VERTEX_USD", 0.0))


def usd_left() -> float:
    return max(0.0, VERTEX_DAILY_USD - usd_spent())


COMMIT_LOCK = ROOT / "scratch" / "commit.lock"
LOCK_POLL_SEC = 5.0


def write_status(events: list | None = None) -> dict:
    """`scratch/monitor_status.json`: المصروف والباقي وموعد التجدد وآخر الأحداث.

    غايتُه أن تصير مراقبةُ المصرِّف **نظرةً لا تحقيقاً** (أمر المدير ٤ أغسطس).
    """
    spend = load_spend()
    keys = [n for n, _v in read_keys()]
    quotas = []
    for model, cap in DAILY_CAPS.items():
        for k in keys:
            used = spend.get(f"{k}:{model}", 0)
            quotas.append({"model": short_model(model), "key": k, "used": used,
                           "cap": cap, "left": max(0, cap - used)})
    queue = load_queue()
    plan = plan_queue(queue)
    left = collections.Counter(short_model(m) or "محبوس" for _i, _e, m in plan)
    prev = {}
    if STATUS_FILE.exists():
        try:
            prev = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = {}
    log = (events or []) + prev.get("events", [])
    status = {
        "updatedAt": TODAY,
        "quotas": quotas,
        "queueLeft": dict(left),
        "queueTotal": len(plan),
        "doneToday": sum(1 for e in queue if e.get("doneAt") == TODAY),
        "resetHint": prev.get("resetHint"),
        "events": log[:5],
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
    return status


def checkpoint_pause() -> None:
    """قفل نقطة التفتيش: يُدعى قبل بدء كل ملف — فيتمّ الجاري ثم ينتظر رفع القفل.

    النشر يقرأ من git وطفلة المالك على النسخة المنشورة، فيلتزم المدير لقطةً كل يوم
    بلا إيقاف التصريف. وكي تكون اللقطة **صحيحة** لا ساكنة فقط، يُكتب الفهرس
    والبصمات قبل الانتظار: فلا تُلتقط ملفاتٌ لا يعرفها الفهرس.
    """
    if not COMMIT_LOCK.exists():
        return
    print("  ⏸ نقطة تفتيش: وُجد قفل الالتزام — يُغلق الفهرس ثم ينتظر رفعه…",
          file=sys.stderr)
    write_manifest(manifest_map())
    waited = 0.0
    while COMMIT_LOCK.exists():
        time.sleep(LOCK_POLL_SEC)
        waited += LOCK_POLL_SEC
    print(f"  ▶ رُفع القفل بعد {waited:.0f}ث — يستأنف التوليد", file=sys.stderr)


def mark_hold(text: str, reason: str) -> None:
    """يحجز نصّاً عن التوليد بعلّة مذكورة — دمجاً كـ`mark_done`."""
    disk = load_queue()
    changed = False
    for e in disk:
        if e.get("text") == text and not e.get("hold"):
            e["hold"] = reason
            changed = True
    if changed:
        save_queue(disk)


def mark_failed(text: str, model: str) -> None:
    """يقيّد إخفاق نصٍّ على نموذج — دمجاً لا استبدالاً كـ`mark_done`.

    به يُنفَّذ بند `docs/AUDIO_QUEUE.md`: «وما فشل في أي نموذج يعود تلقائياً لـ3.1»؛
    وبلا هذا القيد يعود التصريف كل يوم إلى النصّ العصيّ نفسه فيحرق محاولتين عليه.
    """
    disk = load_queue()
    changed = False
    for e in disk:
        if e.get("text") == text and e.get("status", "pending") != "done":
            e["failCount"] = e.get("failCount", 0) + 1
            e["lastFailModel"] = model
            changed = True
    if changed:
        save_queue(disk)


def requeue(texts: list, reason: str) -> int:
    """يعيد نصّاً مُصرَّفاً إلى الانتظار بأولوية العيوب المسموعة (١٠).

    سياسة `docs/AUDIO_QUEUE.md`: «المولَّد المكرر يعاد توليده بأولوية ١٠». وهذا
    ليس مسّاً بالسجل التاريخي: الحالة تعود `pending` ويبقى `doneAt` و`model`
    السابقان مقيَّدين في `fixHistory` — فيُعرف ما كان ولماذا أُعيد.
    """
    disk = load_queue()
    n = 0
    for e in disk:
        if e.get("text") in texts:
            e.setdefault("fixHistory", []).append(
                {"was": e.get("model", ""), "doneAt": e.get("doneAt"), "reason": reason,
                 "requeuedAt": TODAY})
            e.update(status="pending", priority=min(e.get("priority", 100), URGENT_PRIORITY))
            e.pop("failCount", None)
            e.pop("lastFailModel", None)
            e.pop("model", None)              # السجلّ في fixHistory، فلا يُوجّه
            n += 1
    if n:
        save_queue(disk)
    return n
    

def queue_pending(queue: list) -> list:
    """المصفوفون بالأولوية (الأصغر أسبق) ثم بالأقدمية (ترتيب الإضافة)."""
    # المتقاعد (`retired`) خرج من حاجة التطبيق فلا يُخطَّط له توليد — كان يُعدّ
    # منتظِراً أبداً فيُبقي القائمةَ على رقمٍ كاذب لا عملَ خلفه.
    pending = [(i, e) for i, e in enumerate(queue)
               if e.get("status", "pending") != "done" and not e.get("retired")]
    pending.sort(key=lambda p: (p[1].get("priority", 100), p[0]))
    return pending


def queue_texts(queue: list, status: str) -> dict:
    """نصوص القائمة بحالة معيّنة ← فئتها (والمتقاعد خارجها).

    `retired`: مدخلٌ `done` حُذف ملفه عمداً (يتيمٌ دلاليّ لم تعد بياناتُ التطبيق
    تطلبه). يبقى سجلّه التاريخيّ ولا يُنتظر له ملفٌ بعد، وإلا لأنذر التحقّقُ
    الختاميّ عنه في كل دورة ولَطمَس تنبيهاتِه الحقيقية.
    """
    return {e["text"]: e.get("category", "word")
            for e in queue if e.get("status", "pending") == status and not e.get("retired")}


def manifest_map() -> dict:
    """مفتاح ← نصّ **لكل ملفٍ موجود فعلاً** من المنهج ومنجَز القائمة.

    الشرط «موجود على القرص» مقصود (حكم المدير ٤ أغسطس ٢٠٢٦ في يتيم جملة المدّ):
    بحذف ملفٍ يخرج نصُّه من الفهرس ولا يعود إليه، ويبقى مدخلُ القائمة `done`
    سجلاً تاريخياً لا يُمَسّ. وبه أيضاً لا يَعِد الفهرسُ بملفٍ غير موجود فيُهدر
    طلبُ شبكةٍ فاشل قبل النطق الآلي.
    """
    texts, _ = expected_texts()
    return {key_for(t): t for t in texts if (OUT_DIR / f"{key_for(t)}.mp3").exists()}


def expected_texts() -> tuple[dict, dict]:
    """(المتوقع أن له ملف = المنهج + منجَز القائمة، المصفوف انتظاراً)."""
    texts = parse_curriculum(CURRICULUM.read_text(encoding="utf-8"))
    queue = load_queue()
    texts.update(queue_texts(queue, "done"))
    return texts, queue_texts(queue, "pending")


def load_approval() -> dict:
    """حالة إجازة النماذج بالأذن (يقرّها المالك) — نموذج ← معلومات الإجازة."""
    if not APPROVAL_FILE.exists():
        return {}
    try:
        return json.loads(APPROVAL_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def set_approval(model: str, approved: bool, note: str = "") -> None:
    data = load_approval()
    data[model] = {"approved": approved, "decidedAt": TODAY, "note": note}
    APPROVAL_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    print(f"{'أُجيز' if approved else 'رُفض'} {model} (بتاريخ {TODAY}).")


def is_approved(model: str) -> bool:
    return bool(load_approval().get(model, {}).get("approved"))


def route_model(entry: dict, lexicon_ok: bool | None = None) -> str:
    """أي نموذج يولّد هذا المدخل؟ (سياسة النماذج الثلاثة — حكم المالك ٤ أغسطس ٢٠٢٦)

    «2.5 جيد للكلمات، ولا يعطي مقاطع»: فكل قصير (مقطع/حرف بحركة/اسم حرف) على 3.1
    **أياً كان مصدره**، والكلمة الكاملة المفردة على 2.5-flash، والجملة على 2.5-pro.
    والذرّية بصيغتها المعدَّلة: المقاطع موحّدة كلها على نموذج واحد (3.1) فلا تتجاور
    مسحتان داخل صفّ البلاطات نفسه، والكلمة الكاملة تنفرد بنموذجها.
    """
    forced = entry.get("model")
    # `model` سجلٌّ لما أنتج الملف، وكان يُقرأ أيضاً أمرَ توجيه — فمدخلٌ أُعيد
    # يُوجَّه قسراً إلى منتجه (ومنه «antura-cc-by» وليس نموذجاً). فلا يُقبل أمراً
    # إلا إن كان اسمَ نموذجٍ نعرفه.
    if forced and forced in PRICE_PER_M:
        return forced
    if lexicon_ok is None:
        lexicon_ok = is_approved(MODEL_LEXICON)
    if entry.get("category") in SHORT_CATEGORIES:
        return MODEL_CORE                        # القصير كله على 3.1 — بلا استثناء
    if entry.get("failCount") and entry.get("lastFailModel") != MODEL_CORE:
        return MODEL_CORE                        # «ما فشل في نموذج يعود لـ3.1» (السياسة)
    if entry.get("priority", 100) <= URGENT_PRIORITY:
        return MODEL_CORE                        # إصلاح عيب مسموع: الأمتن المجرَّب
    if entry.get("category") == "sentence":
        return MODEL_SENTENCE                    # الجمل الطويلة وحدها
    # كلمة كاملة مفردة: 2.5-flash بعد إجازة المالك، وقبلها تبقى محبوسة
    return MODEL_LEXICON if lexicon_ok else ""


def plan_queue(queue: list, lexicon_ok: bool | None = None) -> list:
    """[(الفهرس، المدخل، النموذج)] بترتيب التصريف — والمحبوس نموذجه ''."""
    if lexicon_ok is None:
        lexicon_ok = is_approved(MODEL_LEXICON)
    return [(i, e, route_model(e, lexicon_ok)) for i, e in queue_pending(queue)]


QUOTE_PAIRS = (("«", "»"), ("\u201c", "\u201d"), ('"', '"'), ("'", "'"))


def quoted_symbols(text: str) -> list:
    """رموزٌ مفردة مقتبسة داخل نصّ منطوق — «ء» و«أ» ونحوها.

    قاعدة المالك (٥ أغسطس ٢٠٢٦): **الصوت يسمّي ولا يقرأ الرمز**. ردَّ قاعدةَ
    الهمزة لأن المولّد نطق «ء» «ها»: الرمزُ يُرى في الشاشة ويُسمّى في الصوت
    («الهمزة تُكتب وحدها») لا يُقتبس فيُقرأ. فمنعُه في المصدر أوفرُ من ردّه
    بعد التوليد — طلبٌ لا يُنفَق، وأذنٌ لا تُتعب.
    """
    found = []
    for open_q, close_q in QUOTE_PAIRS:
        i = 0
        while True:
            a = text.find(open_q, i)
            if a < 0:
                break
            b = text.find(close_q, a + 1)
            if b < 0:
                break
            inner = text[a + 1:b].strip()
            if 0 < len(inner) <= 2 and not inner.isascii():
                found.append(inner)
            i = b + 1
    return found


HARAKA_DESC = {"َ": "مفتوحاً", "ِ": "مكسوراً", "ُ": "مضموماً", "ْ": "ساكناً",
               "ً": "منوّناً بالفتح", "ٌ": "منوّناً بالضم", "ٍ": "منوّناً بالكسر"}
TANWEEN_SOUND = {"ً": "َنْ", "ٌ": "ُنْ", "ٍ": "ِنْ"}
_LETTER_NAMES = None


def letter_name(ch: str) -> str:
    global _LETTER_NAMES
    if _LETTER_NAMES is None:
        src = CURRICULUM.read_text(encoding="utf-8")
        _LETTER_NAMES = {m.group(1): m.group(2)
                         for m in re.finditer(r"'(.)':\s*\{\s*name:\s*'([^']+)'", src)}
    return _LETTER_NAMES.get(ch, ch)


def letter_haraka_style(text: str) -> str:
    """تعليمةٌ **تسمّي الحرف وحركته** — لا نصّاً مجرّداً يُخمَّن.

    بلاغ المالك (٥ أغسطس ٢٠٢٦): «كاف» تُلفظ «تاف»، و«طَ» تُلفظ «كا»، و«بِ» تُلفظ
    «با» لا «بي»، و«قُ» تُلفظ «ق» بلا ضمّة. الحرفُ المفرد بحركته نصٌّ غامض على
    المولّد — حرفان بلا سياق — فيُخمِّن. وتسميةُ الحرف («حرف الطاء») وحركته
    («مفتوحاً») ترفع الغموض من أصله.
    """
    if len(text) != 2 or text[1] not in HARAKA_DESC:
        return ""
    return (f"انطق حرف {letter_name(text[0])} {HARAKA_DESC[text[1]]}، "
            f"صوتاً واحداً قصيراً بمخرج صحيح، لطفل يتعلم القراءة: ")


PREV_DIR = ROOT / "scratch" / "prev"    # سلفُ كل ملفٍ استُبدل — بابُ الرجوع

HARAKA_MARKS = "ًٌٍَُِّْٰ"
PROSE_MAX_RATIO = 0.35      # الفاصل مقيس: القصة ٠٫٧٧–٠٫٩١ والنثر الإرشادي ٠٫٠٢–٠٫٠٦
PROSE_DIR = ROOT / "scratch" / "prose"


def archive_prev(path) -> bool:
    """يحفظ الملفَّ القائم قبل استبداله — **سؤالُ المالك: أتحتفظ بالقديم؟**

    كان الجواب «لا، إلا في git» — وهو حفظٌ يشترط التزاماً وقع قبل الاستبدال.
    فصار الحفظ بنيوياً: كلُّ استبدالٍ يودع سلفَه في `scratch/prev` أولاً، فالرجوع
    عن صوتٍ بعينه أمرٌ واحد (`--revert`) لا نبشُ تاريخ. والمجلَّدُ خارج المستودع
    (`scratch/` في `.gitignore`) فلا يثقل الشجرة.
    """
    import shutil  # noqa: PLC0415
    if not path.exists():
        return False
    PREV_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, PREV_DIR / path.name)
    return True


def revert_prev(texts: list) -> tuple:
    """يعيد نصّاً إلى سلفه المحفوظ — ويعيد (ما رُدّ، ما لا سلفَ له)."""
    import shutil  # noqa: PLC0415
    back, none = [], []
    for t in texts:
        src = PREV_DIR / f"{key_for(t)}.mp3"
        if src.exists():
            shutil.copy2(src, OUT_DIR / src.name)
            back.append(t)
        else:
            none.append(t)
    if back:
        write_manifest(manifest_map())
    return back, none


def vowel_ratio(text: str) -> float:
    letters = sum(1 for c in text if "ء" <= c <= "ي")
    marks = sum(1 for c in text if c in HARAKA_MARKS)
    return marks / max(letters, 1)


def is_prose(entry: dict) -> bool:
    """جملةٌ إرشادية (نثرٌ بلا شكلٍ كامل) — عرفُها: لا تُعتمد حتى تُسمَع بأذن.

    القياس بنيويّ لا بمصدر الطلب: جملُ القصص مشكولةٌ بالكامل والنثرُ الإرشادي
    يشكّل الملتبس وحده. فالعرف يُفرَض بالبنية ولا يعتمد على تذكّر أحد.
    """
    return (entry.get("category") == "sentence"
            and vowel_ratio(entry.get("text", "")) < PROSE_MAX_RATIO)


def speech_form(text: str) -> str:
    """صورةُ النصّ **كما تُنطق** — تُرسل للمولّد، ولا تمسّ المفتاح ولا البيانات.

    بلاغا المالك (٥ أغسطس ٢٠٢٦): التاءُ المربوطة الساكنة تُنطق تاءً والعربُ تقف
    عليها هاءً؛ والتنوينُ يُبتلع فيُسمع حركةً قصيرة («بً» كـ«با»). فتُكتب في
    **الطلب** بصورتها المنطوقة، ويبقى النصّ في المنهج والمعجم والمفتاح كما هو.
    """
    if len(text) == 2 and text[1] in TANWEEN_SOUND:
        return text[0] + TANWEEN_SOUND[text[1]]
    if text.endswith("ةْ"):
        text = text[:-2] + "هْ"
    elif text.endswith("ة"):
        text = text[:-1] + "هْ"
    # **سكونُ الوقف يبقى** (رجوعٌ عن إسقاطه، ٥ أغسطس ٢٠٢٦): جُرّب إسقاطُه فاختاره
    # المالك في ٣ عيّنات من ٤، ثم كشفت دفعةُ المكتبة (١٩٠ نصاً) أنه **يُحرّك
    # الحرفَ الأخير** في عشرين نصاً — «الْوَلَدْ» تُنطق «الولدُ». فالسكونُ الصريح
    # هو علامةُ الوقف، وحذفُه يترك الآخر بلا حكمٍ فيُشكِّله المولّد.
    # ويبقى معه في التعليمة «أظهرْ آخرَ كل كلمة» — إظهارٌ بلا تحريك.
    return text


def ipa_clause(text: str) -> str:
    """جملةُ الرسم الصوتيّ تُلحَق بالتعليمة — **حكمُ أذن المالك، ٥ أغسطس ٢٠٢٦**.

    عُرضت ثلاثُ صيغٍ على ستة نصوص (النصّ وحدَه · النصّ ومعه رسمُه · الرسمُ وحدَه)
    فاختار **«النصّ ومعه رسمُه»** في خمسٍ من ستّ. والعلّة أنّ أخطاء المولّد أخطاءُ
    **هويةِ حرف** («ثِ» تُنطق «خِ»)، والحرفُ المشكول يحتمل عند نموذجٍ عامّ أكثرَ من
    قراءة، أمّا `/θi/` فلا يحتمل غيرَ واحدة. والعربيةُ تبقى معه فلا يضيع الأداء.

    **وشرطُه بنيويّ لا بالفئة**: لا يُشتقّ رسمٌ صحيح من نصٍّ غيرِ مشكول — فما نسبةُ
    تشكيله دون عتبة النثر (الجملُ الإرشادية) لا رسمَ له، وهو عينُ ميزان `is_prose`.
    ويُشتقّ من **صورة النطق** لا من المكتوب، فيتّفق مع ما يُرسَل فعلاً.
    """
    if vowel_ratio(text) < PROSE_MAX_RATIO:
        return ""
    try:
        import arabic_ipa  # noqa: PLC0415
    except ImportError:
        return ""
    drawn = arabic_ipa.ipa(speech_form(text))
    if not drawn:
        return ""
    return f"والنطقُ المطلوب بالرسم الصوتيّ الدوليّ: /{drawn}/ — التزمْه حرفاً بحرف. النصّ: "


def style_for(entry: dict) -> str:
    text = entry.get("text", "")
    hint = (entry.get("style_hint") or "").strip()
    if hint:
        return hint.rstrip(":：").rstrip() + ": "
    named = letter_haraka_style(text)
    base = named if named else STYLE[entry.get("category", "word")]
    return base.rstrip() + " " + ipa_clause(text) if ipa_clause(text) else base


def short_model(model: str) -> str:
    return model.replace("gemini-", "").replace("-preview", "").replace("-tts", "")


def drain_queue(model: str | None, voice: str, api_key, dry_run: bool = False,
                only_model: str = "") -> int:
    """تصريف القائمة بالترتيب على حصص اليوم الثلاث (سياسة النماذج الثلاثة).

    `model` غير الفارغ يفرض نموذجاً واحداً على كل المدخلات (تجاوز يدوي).
    `only_model` يقصر التصريف على ما يوجَّه إلى نموذج بعينه.
    نفاد حصة نموذج يوقفه وحده ويمضي التصريف ببقية النماذج.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    queue = load_queue()
    lexicon_ok = is_approved(MODEL_LEXICON)
    plan = plan_queue(queue, lexicon_ok)
    if model:                                   # تجاوز صريح: نموذج واحد للكل
        plan = [(i, e, model) for i, e, _m in plan]
    if only_model:
        plan = [(i, e, m) for i, e, m in plan if m == only_model]

    if not plan:
        print("قائمة الانتظار فارغة — لا شيء يُصرَّف.")
        return 0

    held = [p for p in plan if not p[2]]
    plan = [p for p in plan if p[2]]
    by_model = collections.Counter(m for _i, _e, m in plan)
    print(f"قائمة الانتظار: {len(queue_pending(queue))} منتظِراً من {len(queue)}.")
    for m, n in by_model.most_common():
        print(f"  · {short_model(m)}: {n} نصاً")
    if held:
        print(f"  · محبوس حتى إجازة المالك ({short_model(MODEL_LEXICON)}): {len(held)} نصاً")

    pool = api_key if isinstance(api_key, KeyPool) else KeyPool([("GEMINI_API_KEY", api_key)], voice)
    made = failed = 0
    done_by_model = collections.Counter()
    exhausted = {}                              # نموذج ← ثوانٍ حتى تجدد حصص مفاتيحه كلها
    empty_streak = collections.Counter()        # إخفاقات «بلا صوت» متتابعة لكل نموذج
    for n, (_idx, entry, m) in enumerate(plan, 1):
        checkpoint_pause()                      # قفل الالتزام: يتمّ الجاري ثم ينتظر
        if m in exhausted:                      # حصته نفدت أو تدهورت — لا طلب آخر عليها
            continue
        if entry.get("hold"):
            continue                            # محجوزٌ بحكمٍ سابق (مردودٌ بعلّة)
        syms = quoted_symbols(entry["text"])
        if syms and entry.get("category") == "sentence":
            print(f"  ⛔ رمزٌ مقتبس في نصّ منطوق ({'، '.join(syms)}): "
                  f"«{entry['text'][:40]}…» — الصوت يسمّي ولا يقرأ الرمز، فيُحجَز",
                  file=sys.stderr)
            mark_hold(entry["text"], f"رمز مقتبس: {'، '.join(syms)}")
            continue
        text = entry["text"]
        cat = entry.get("category", "word")
        path = OUT_DIR / f"{key_for(text)}.mp3"
        label = (f"[{n}/{len(plan)}] {text} ({CATEGORY_AR[cat]}، أولوية "
                 f"{entry.get('priority', 100)}) · {short_model(m)}")
        if dry_run:
            print(f"  ⟶ {label} → {path.name}")
            made += 1
            continue
        try:
            pcm, rate, used_key = pool.call(text, style_for(entry), m)
            archive_prev(path)          # السلفُ يُحفظ قبل الكتابة فوقَه
            if is_prose(entry):
                # عرف النثر: يُولَّد إلى scratch ولا يدخل التطبيق حتى يُسمع
                PROSE_DIR.mkdir(parents=True, exist_ok=True)
                pcm_to_mp3(pcm, rate, PROSE_DIR / f"{key_for(text)}.mp3")
                mark_hold(text, "جملة إرشادية: تنتظر سماع المالك (عرف النثر)")
                made += 1
                print(f"  ⏸ {label} → scratch/prose (لا تُعتمد حتى تُسمع)")
                continue
            pcm_to_mp3(pcm, rate, path)
            mark_done(text, m)                  # دمجاً لا استبدالاً — وبعد كل نصّ
            made += 1
            done_by_model[m] += 1
            empty_streak[m] = 0
            print(f"  ✓ {label} → {path.name} {path.stat().st_size // 1024}KB")
        except QuotaExhausted as e:
            exhausted[m] = e.seconds
            print(f"\n  ⏸ {short_model(m)}: {e}", file=sys.stderr)
            if len(exhausted) >= len(by_model):
                print("  كل الحصص نفدت — يتوقف التصريف.", file=sys.stderr)
                break
            print(f"  يواصل ببقية النماذج ({len(by_model) - len(exhausted)} باقية).",
                  file=sys.stderr)
        except EmptyAudio as e:
            failed += 1
            mark_failed(text, m)
            empty_streak[m] += 1
            print(f"  ✗ {label}: {e}", file=sys.stderr)
            if empty_streak[m] >= EMPTY_STREAK_LIMIT:
                # نموذج بدأ يردّ بلا صوت متتابعاً: يُنحّى هذه الجولة بدل حرق بقية حصته.
                exhausted[m] = 3600
                print(f"  ⏸ {short_model(m)}: {EMPTY_STREAK_LIMIT} استجابات متتابعة بلا صوت "
                      f"— يُنحّى هذه الجولة صوناً لحصته.", file=sys.stderr)
                if len(exhausted) >= len(by_model):
                    break
        except Exception as e:  # noqa: BLE001
            failed += 1
            mark_failed(text, m)
            print(f"  ✗ {label}: [{type(e).__name__}] {e}", file=sys.stderr)

    if dry_run:
        print(f"\nسيُصرَّف: {made} (تجربة جافّة — لم يُطلب شيء)")
        return 0

    write_manifest(manifest_map())
    if exhausted:
        print(f"RETRY_AFTER_SECONDS={min(exhausted.values())}")
    left = plan_queue(load_queue(), lexicon_ok)
    left_by_model = collections.Counter(short_model(m) or "محبوس" for _i, _e, m in left)
    print(f"\nتم التصريف: {made} مولّد، {failed} فشل، {len(left)} ما زال منتظِراً.")
    if done_by_model:
        print("  المولَّد: " + "، ".join(f"{short_model(m)}: {n}"
                                          for m, n in done_by_model.most_common()))
    if pool.used:
        print("  بالمفاتيح: " + "، ".join(f"{n}·{short_model(m)}: {c}"
                                            for (n, m), c in pool.used.most_common()))
    if left_by_model:
        print("  المتبقي: " + "، ".join(f"{m}: {n}" for m, n in left_by_model.most_common()))
    return failed


# ————————————————————————— إجازة نموذج (مفاضلة مصغّرة) —————————————————————————

# ٣ نصوص من جنس ما سيولّده المرشَّح فعلاً (كلمة، مقطع، كلمة أطول) — وتُختار من
# النصوص التي لها ملف 3.1 جاهز، فلا تُنفَق حصة النواة على المقارنة.
AUDITION_TRIO = [("بابا", "word"), ("بَا", "syllable"), ("حليب", "word")]


def run_model_audition(out_dir: Path, api_key: str, candidate: str, voice: str,
                       force: bool) -> int:
    """٣ طلبات على المرشَّح، ويُقابَل بملفات النواة الجاهزة + صفحة مقارنة بالأذن."""
    out_dir.mkdir(parents=True, exist_ok=True)
    models = [candidate, MODEL_CORE]
    rows, failed = [], 0
    archive = ROOT / "archive" / "audio-edge"
    for text, cat in AUDITION_TRIO:
        # جانب النواة: الملف الموجود في app/audio إن كان قد بُدِّل فعلاً إلى Sulafat
        core_src = OUT_DIR / f"{key_for(text)}.mp3"
        core_name = f"{short_model(MODEL_CORE)}__{key_for(text)}.mp3"
        if core_src.exists() and not is_same_as(core_src, archive):
            shutil.copy2(core_src, out_dir / core_name)
            rows.append((MODEL_CORE, text, cat, core_name, core_src.stat().st_size))
        else:
            print(f"  ! لا ملف نواة مبدَّل لـ«{text}» — يُعرض عمود المرشَّح وحده",
                  file=sys.stderr)

        # جانب المرشَّح: الطلب الوحيد لكل نصّ
        name = f"{short_model(candidate)}__{key_for(text)}.mp3"
        path = out_dir / name
        if path.exists() and not force:
            rows.append((candidate, text, cat, name, path.stat().st_size))
            continue
        try:
            pcm, rate = gemini_pcm(text, STYLE[cat], candidate, voice, api_key)
            pcm_to_mp3(pcm, rate, path)
            rows.append((candidate, text, cat, name, path.stat().st_size))
            print(f"  ✓ {short_model(candidate)} · {text}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ {short_model(candidate)} · {text}: {e}", file=sys.stderr)

    write_model_audition_page(out_dir, rows, models, candidate, voice)
    print(f"\nالمفاضلة المصغّرة: {len(rows)} ملفاً، {failed} فشل.")
    print(f"افتحها: .venv/bin/python -m http.server 8020 -d {out_dir} → http://127.0.0.1:8020/")
    print(f"وبعد سماع المالك:  .venv/bin/python tools/generate_audio.py "
          f"--approve-model {candidate}   (أو --reject-model)")
    return failed


def write_model_audition_page(out_dir: Path, rows, models, candidate: str, voice: str) -> None:
    by = {(m, t): (n, s) for m, t, _c, n, s in rows}
    body = []
    for text, cat in AUDITION_TRIO:
        cells = []
        for model in models:
            hit = by.get((model, text))
            cells.append(f'<td><button data-src="{hit[0]}">▶ {short_model(model)}</button>'
                         f'<small>{hit[1] // 1024}KB</small></td>' if hit
                         else '<td class="miss">—</td>')
        body.append(f'<tr><th>{text}<small>{CATEGORY_AR[cat]}</small></th>{"".join(cells)}</tr>')
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>إجازة نموذج — {short_model(candidate)} مقابل {short_model(MODEL_CORE)}</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:52rem; line-height:1.9 }}
 table {{ border-collapse:collapse; margin-top:1rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.6rem .9rem; text-align:center; background:#fff }}
 th {{ background:#f0e8db; font-size:1.15rem }}
 th small {{ display:block; font-weight:normal; color:#8a7a66; font-size:.72rem }}
 button {{ font-size:1rem; padding:.4rem .9rem; cursor:pointer; border:1px solid #c9bba6;
           border-radius:.45rem; background:#fdfaf4; font-family:inherit }}
 button.playing {{ background:#2f7d4f; color:#fff }}
 td small {{ display:block; color:#a1937f; font-size:.65rem; font-family:system-ui }}
 code {{ background:#efe7da; padding:.15rem .4rem; border-radius:.3rem; font-size:.85rem }}
</style></head><body>
<h1>إجازة نموذج: {short_model(candidate)} مقابل {short_model(MODEL_CORE)}</h1>
<p class="note">الصوت واحد في الاثنين ({voice}) والنصّ واحد — الفرق في النموذج وحده.
اسمع كل صفّ مرّتين: هل تختلف المسحة الصوتية اختلافاً يُسمَع لو تجاورت الكلمة ومقطعها في اللعبة؟
<br>إن أجزتَه صُرِّفت به كلمات المعجم (٣٤٠ نصاً) على حصته المستقلة، وإلا بقي للجُمل الفائضة فقط.
<br>القرار يُسجَّل بـ<code>--approve-model</code> أو <code>--reject-model</code>.</p>
<table><thead><tr><th>النص</th><th>المرشَّح</th><th>النواة</th></tr></thead>
<tbody>{"".join(body)}</tbody></table>
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
    (out_dir / "index.html").write_text(html, encoding="utf-8")


# ————————————————————————— احتياط المدود (أفضل من ثلاث) —————————————————————————

MADD_DIR = ROOT / "scratch" / "madd_pick"
MADD_STYLE = ("انطق الحرف ممدوداً مدّاً طبيعياً حركتين، صوتاً واحداً متصلاً، "
              "بتأنٍّ ووضوح لطفل يتعلم القراءة: ")
MADD_VARIANTS = 3
MADD_IDEAL_SEC = 1.5     # طول المدّ المثالي بأذن المالك (٤ أغسطس ٢٠٢٦)
MADD_APPLIED = ROOT / "scratch" / "madd_pick" / "applied.json"   # ما حُسم ومَن حسمه


def madd_targets(include_existing: bool = False) -> list:
    """مدودٌ يستعملها التطبيق فعلاً ولا ملف لها — لا التوسعة الآلية ٢٨×٣.

    التوسعة الميكانيكية تُنتج مستحيلاً («اَا» والألف نفسها حرف مدّ)، فيؤخذ من
    النصوص التي يستعملها المنهج أو قائمة الانتظار فقط.
    """
    texts, pending = expected_texts()
    known = {**texts, **pending}
    out = []
    for text, cat in known.items():
        if cat not in ("syllable", "letter_haraka"):
            continue
        if len(text) == 3 and text[1] in HARAKAT.values() and text[2] in "اوي":
            # `include_existing`: المدّ قد يكون وُلِّد ضمن القائمة بالتعليمة العامة،
            # وأمرُ المدير أن يُعاد بتعليمة المدّ المشددة ثلاثَ مرات لينتقي المالك.
            if include_existing or not (OUT_DIR / f"{key_for(text)}.mp3").exists():
                out.append(text)

    # الأبعد عن الطول المثالي أولاً: المبتور («لَا» ٠٫٦٥ث) قبل السليم، فإن نفدت
    # الحصة في منتصف الدفعة كان ما أُنجز هو الأحوج.
    def deviation(t: str) -> float:
        p = OUT_DIR / f"{key_for(t)}.mp3"
        return 99.0 if not p.exists() else abs(mp3_duration(p) - MADD_IDEAL_SEC)
    return sorted(out, key=lambda t: (-deviation(t), t))


def madd_batch(api_key, voice: str, variants: int = MADD_VARIANTS,
               dry_run: bool = False, include_existing: bool = False) -> int:
    """ثلاث محاولات لكل مدّ ناقص على نموذج النواة وحده (2.5-pro موثَّق فشلُه في «بَا»).

    المخرجات في `scratch/madd_pick/` وصفحة انتقاء — لا يدخل `app/audio` شيء حتى
    يختار المالك بأذنه (`--apply-madd-pick`).
    """
    targets = madd_targets(include_existing)
    if not targets:
        print("لا مدّ ناقصاً — لا حاجة للاحتياط التوليدي.")
        return 0
    MADD_DIR.mkdir(parents=True, exist_ok=True)
    todo = [(t, v) for t in targets for v in range(1, variants + 1)
            if not (MADD_DIR / f"{key_for(t)}__{v}.mp3").exists()]
    print(f"احتياط المدود: {len(targets)} نصاً × {variants} محاولات "
          f"= {len(targets) * variants} ملفاً ({len(todo)} باقٍ) · {short_model(MODEL_CORE)} حصراً")
    if dry_run:
        print("  " + " ".join(targets))
        return 0

    pool = api_key if isinstance(api_key, KeyPool) else KeyPool([("GEMINI_API_KEY", api_key)], voice)
    made = failed = 0
    for text, v in todo:
        checkpoint_pause()
        path = MADD_DIR / f"{key_for(text)}__{v}.mp3"
        try:
            pcm, rate, _key = pool.call(text, MADD_STYLE, MODEL_CORE)
            pcm_to_mp3(pcm, rate, path)
            made += 1
            print(f"  ✓ {text} [{v}/{variants}] → {path.name} {path.stat().st_size // 1024}KB")
        except QuotaExhausted as e:
            print(f"\n  ⏸ {short_model(MODEL_CORE)}: {e} (وُلِّد {made})", file=sys.stderr)
            print(f"RETRY_AFTER_SECONDS={e.seconds}")
            break
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ {text} [{v}]: {e}", file=sys.stderr)

    write_madd_page(targets, variants)
    left = sum(1 for t in targets for v in range(1, variants + 1)
               if not (MADD_DIR / f"{key_for(t)}__{v}.mp3").exists())
    print(f"\nتم: {made} مولّد، {failed} فشل، {left} باقٍ لحصة الغد.")
    print(f"صفحة الانتقاء: {MADD_DIR}/index.html "
          f"(.venv/bin/python -m http.server 8060 -d {MADD_DIR})")
    return failed


def write_madd_page(targets: list, variants: int) -> None:
    rows = []
    for text in targets:
        have = [(v, f"{key_for(text)}__{v}.mp3") for v in range(1, variants + 1)
                if (MADD_DIR / f"{key_for(text)}__{v}.mp3").exists()]
        if not have:
            continue
        durs = {v: mp3_duration(MADD_DIR / f) for v, f in have}
        best = min(durs, key=lambda v: abs(durs[v] - MADD_IDEAL_SEC))   # الأقرب للمثالي
        btns = "".join(
            f'<button data-src="{f}"{" class=\"near\"" if v == best else ""}>▶ {v}'
            f'<small>{durs[v]:.2f}ث{" ★" if v == best else ""}</small></button>'
            f'<button class="pick" data-text="{text}" data-variant="{v}">اختر {v}</button>'
            for v, f in have)
        rows.append(f'<tr data-text="{text}"><th>{text}</th><td>{btns}</td>'
                    f'<td class="chosen"></td></tr>')
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>انتقاء المدود — أفضل من ثلاث</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:54rem; line-height:1.9 }}
 table {{ border-collapse:collapse; margin-top:1rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.45rem .7rem; background:#fff; text-align:center }}
 th {{ background:#f0e8db; font-size:1.4rem; min-width:4.5rem }}
 button {{ font-family:inherit; font-size:.95rem; padding:.3rem .7rem; margin:0 .15rem; cursor:pointer;
           border:1px solid #c9bba6; border-radius:.45rem; background:#fdfaf4 }}
 button.pick {{ background:#eef3fb; border-color:#a9bcd6; font-size:.8rem }}
 button small {{ display:block; font-size:.6rem; color:#8a7a66; font-family:system-ui }}
 button.near {{ border-color:#2f7d4f; border-width:2px }}
 button.playing {{ background:#2f7d4f; color:#fff }}
 td.chosen {{ font-family:system-ui; font-size:.9rem; color:#2f7d4f; min-width:5rem }}
 #out {{ position:sticky; bottom:0; background:#241f1a; color:#fdfaf4; padding:.8rem 1rem;
         border-radius:.6rem; margin-top:1.5rem; font-family:system-ui; font-size:.85rem }}
 #out button {{ background:#fdfaf4 }}
</style></head><body>
<h1>انتقاء المدود — ثلاث محاولات لكل نصّ</h1>
<p class="note">اسمع الثلاث واختر أوضحها مدّاً (حركتان، صوت واحد متصل بلا قطع).
المعلَّم بـ★ هو الأقرب إلى الطول المثالي ({MADD_IDEAL_SEC}ث بأذن المالك) — دلالةٌ لا حكم، والأذن تقدَّم عليه.
ما لم تختر له شيئاً يبقى بلا ملف ويُعاد توليده.
<br>بعد الفراغ: اضغط «انسخ الاختيارات» وأعطِني النصّ المنسوخ لأطبّقه.</p>
<table><tbody>{"".join(rows)}</tbody></table>
<div id="out">لم تُختر بعد — <button id="copy">انسخ الاختيارات</button>
  <span id="count"></span></div>
<script>
const picks = {{}};
let cur = null, btn = null;
document.addEventListener('click', (e) => {{
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'copy') {{
    navigator.clipboard.writeText(JSON.stringify(picks, null, 1));
    b.textContent = 'نُسخت ✓'; setTimeout(() => b.textContent = 'انسخ الاختيارات', 1500);
    return;
  }}
  if (b.dataset.src) {{
    if (cur) cur.pause();
    if (btn) btn.classList.remove('playing');
    cur = new Audio(b.dataset.src); btn = b; b.classList.add('playing');
    cur.onended = () => b.classList.remove('playing');
    cur.play(); return;
  }}
  if (b.classList.contains('pick')) {{
    picks[b.dataset.text] = +b.dataset.variant;
    b.closest('tr').querySelector('.chosen').textContent = `المحاولة ${{b.dataset.variant}}`;
    document.getElementById('count').textContent =
      `(${{Object.keys(picks).length}} اختياراً)`;
  }}
}});
</script></body></html>"""
    (MADD_DIR / "index.html").write_text(html, encoding="utf-8")


def load_applied() -> dict:
    if not MADD_APPLIED.exists():
        return {}
    try:
        return json.loads(MADD_APPLIED.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def record_applied(text: str, variant: int, by: str) -> None:
    """يقيّد ما حُسم ومَن حسمه — فلا يدهس المعيارُ اختياراً بالأذن."""
    data = load_applied()
    data[text] = {"variant": int(variant), "by": by, "at": TODAY}
    MADD_APPLIED.parent.mkdir(parents=True, exist_ok=True)
    MADD_APPLIED.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def apply_madd_auto() -> int:
    """يطبّق معيار المالك (الأقرب إلى MADD_IDEAL_SEC) على ما لم يُحسم بالأذن بعد.

    إذنُ المالك (٤ أغسطس ٢٠٢٦): «طبّق بالمعيار». وما اختاره بأذنه لا يُمَسّ.
    """
    applied = load_applied()
    picks = {}
    for text in madd_targets(include_existing=True):
        if text in applied:
            continue
        variants = {v: MADD_DIR / f"{key_for(text)}__{v}.mp3"
                    for v in range(1, MADD_VARIANTS + 1)}
        variants = {v: p for v, p in variants.items() if p.exists()}
        if not variants:
            continue
        durs = {v: mp3_duration(p) for v, p in variants.items()}
        best = min(durs, key=lambda v: abs(durs[v] - MADD_IDEAL_SEC))
        picks[text] = best
        print(f"  ★ «{text}» ← المحاولة {best} ({durs[best]:.2f}ث، "
              f"الأقرب إلى {MADD_IDEAL_SEC}ث من {len(durs)} محاولات)")
    if not picks:
        print("لا مدّ جديداً يحتاج تطبيق المعيار.")
        return 0
    return apply_madd_pick(json.dumps(picks, ensure_ascii=False), by="criterion")


def apply_madd_pick(spec: str, by: str = "ear") -> int:
    """يطبّق اختيار المالك: {"بَا": 2, …} — ملفاً أو نصّاً JSON."""
    raw = Path(spec).read_text(encoding="utf-8") if Path(spec).exists() else spec
    picks = json.loads(raw)
    n = 0
    for text, variant in picks.items():
        src = MADD_DIR / f"{key_for(text)}__{int(variant)}.mp3"
        if not src.exists():
            print(f"  ✗ «{text}»: لا محاولة رقم {variant}", file=sys.stderr)
            continue
        shutil.copy2(src, OUT_DIR / f"{key_for(text)}.mp3")
        mark_done(text, f"{MODEL_CORE}#madd-{variant}")
        record_applied(text, variant, by)
        n += 1
        print(f"  ✓ «{text}» ← المحاولة {variant}"
              + ("" if by == "ear" else " (بالمعيار)"))
    if n:
        write_manifest(manifest_map())
    print(f"\nطُبِّق {n} اختياراً.")
    return 0 if n else 1


# ————————————————————————— فحص الصمام (تجاور النموذجين) —————————————————————————

LEXICON_FILE = ROOT / "app" / "data" / "lexicon.json"


def seam_bundles() -> list:
    """كلمات المعجم مع مقاطعها من مصدر الحقيقة (لا تُكتب هنا)."""
    if not LEXICON_FILE.exists():
        return []
    data = json.loads(LEXICON_FILE.read_text(encoding="utf-8"))
    words = data.get("words") or [w for t in data.get("themes", []) for w in t.get("words", [])]
    return [w for w in words if w.get("word") and w.get("tiles")]


def run_seam_audition(out_dir: Path, size: int = 5) -> int:
    """صمام أمان السياسة: باقة كاملة تُسمع كما تُسمع في اللعبة — مقاطع 3.1 ثم كلمة 2.5.

    لا يطلب شيئاً من الشبكة: ينسخ الملفات المولّدة فعلاً ويبني صفحة تشغيل متتابع،
    فإن نشز الفرق بين المسحتين أُوقف المعجم على 2.5 فوراً.
    """
    queue = load_queue()
    model_of = {e["text"]: e.get("model") for e in queue if e.get("status") == "done"}
    ready = []
    for w in seam_bundles():
        parts = [w["word"], *w["tiles"]]
        if all((OUT_DIR / f"{key_for(t)}.mp3").exists() for t in parts):
            ready.append(w)
        if len(ready) >= size:
            break
    if not ready:
        print("لا باقة مكتملة الأصوات بعد — يُعاد الفحص بعد أول يوم تصريف.", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for w in ready:
        parts = []
        for text in [*w["tiles"], w["word"]]:
            name = f"{key_for(text)}.mp3"
            shutil.copy2(OUT_DIR / name, out_dir / name)
            parts.append({"text": text, "file": name,
                          "model": short_model(model_of.get(text) or MODEL_CORE),
                          "kind": "word" if text == w["word"] else "tile"})
        rows.append({"word": w["word"], "emoji": w.get("emoji", ""), "parts": parts})

    write_seam_page(out_dir, rows)
    print(f"فحص الصمام: {len(rows)} باقة → {out_dir}/index.html")
    print(f"افتحه: .venv/bin/python -m http.server 8030 -d {out_dir} → http://127.0.0.1:8030/")
    return 0


def write_seam_page(out_dir: Path, rows) -> None:
    cards = []
    for r in rows:
        chips = "".join(
            f'<button class="chip {p["kind"]}" data-src="{p["file"]}">{p["text"]}'
            f'<small>{p["model"]}</small></button>' for p in r["parts"])
        seq = json.dumps([p["file"] for p in r["parts"]], ensure_ascii=False)
        cards.append(
            f'<div class="card"><div class="head"><span class="emoji">{r["emoji"]}</span>'
            f'<span class="w">{r["word"]}</span>'
            f'<button class="play" data-seq=\'{seq}\'>▶ اسمعها كما في اللعبة</button></div>'
            f'<div class="chips">{chips}</div></div>')
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>فحص الصمام — تجاور مقاطع 3.1 مع كلمة 2.5</title>
<style>
 body {{ font-family:"Noto Naskh Arabic","Geeza Pro",serif; margin:2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size:1.35rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:54rem; line-height:1.9 }}
 .card {{ background:#fff; border:1px solid #ddd2c2; border-radius:.8rem; padding:1rem 1.2rem;
          margin:1rem 0; max-width:54rem }}
 .head {{ display:flex; align-items:center; gap:1rem; margin-bottom:.7rem }}
 .emoji {{ font-size:1.8rem }}
 .w {{ font-size:1.6rem; flex:1 }}
 .chips {{ display:flex; gap:.5rem; flex-wrap:wrap; direction:rtl }}
 button {{ font-family:inherit; cursor:pointer; border:1px solid #c9bba6; border-radius:.5rem;
           background:#fdfaf4; padding:.5rem .9rem; font-size:1.15rem }}
 .chip.word {{ background:#e8f1ea; border-color:#8fb79d }}
 .chip small, .play small {{ display:block; font-size:.62rem; color:#8a7a66; font-family:system-ui }}
 .play {{ font-size:.95rem }}
 button.playing {{ background:#2f7d4f; color:#fff }}
</style></head><body>
<h1>فحص الصمام: هل تنشز المسحتان متجاورتين؟</h1>
<p class="note">كل باقة تُسمع كما يسمعها الطفل في لعبة التركيب: <strong>المقاطع أولاً (3.1) ثم الكلمة كاملة (2.5-flash)</strong>.
المطلوب حكمٌ واحد: هل يُحسّ الانتقال من المقاطع إلى الكلمة كأنه صوتان مختلفان؟
<br>إن نشز — يُوقف المعجم على 2.5-flash فوراً ويُعاد إلى 3.1 على مهل الحصص.</p>
{"".join(cards)}
<script>
let cur = null, btn = null;
function one(src) {{
  return new Promise((r) => {{ cur = new Audio(src); cur.onended = r; cur.onerror = r; cur.play(); }});
}}
document.addEventListener('click', async (e) => {{
  const b = e.target.closest('button'); if (!b) return;
  if (cur) cur.pause();
  if (btn) btn.classList.remove('playing');
  btn = b; b.classList.add('playing');
  if (b.dataset.seq) {{
    for (const f of JSON.parse(b.dataset.seq)) {{ await one(f); await new Promise(r => setTimeout(r, 200)); }}
  }} else {{ await one(b.dataset.src); }}
  b.classList.remove('playing');
}});
</script></body></html>"""
    (out_dir / "index.html").write_text(html, encoding="utf-8")


# ————————————————————————— المفاضلة —————————————————————————

AUDITION_TEXTS = [
    ("باء", "letter_name"),
    ("عَين", "letter_name"),
    ("بَ", "letter_haraka"),
    ("سِ", "letter_haraka"),
    ("بَا", "syllable"),
    ("سلام", "word"),
]
AUDITION_MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-pro-preview-tts"]
AUDITION_VOICES = ["Kore", "Leda", "Aoede", "Charon", "Sulafat", "Iapetus"]


def run_audition(out_dir: Path, api_key: str, models, voices, force: bool,
                 page_only: bool = False) -> int:
    """يولّد نفس النصوص بكل (نموذج × صوت) وصفحة HTML للمفاضلة بالأذن."""
    out_dir.mkdir(parents=True, exist_ok=True)
    rows, failed = [], 0
    total = len(models) * len(voices) * len(AUDITION_TEXTS)
    i = 0
    for model in models:
        short = model.replace("-preview", "").replace("gemini-", "")
        for voice in voices:
            for text, cat in AUDITION_TEXTS:
                i += 1
                name = f"{short}__{voice}__{key_for(text)}.mp3"
                path = out_dir / name
                if path.exists() and not force:
                    rows.append((model, voice, text, cat, name, path.stat().st_size))
                    continue
                if page_only:                       # إعادة بناء الصفحة مما على القرص فقط
                    continue
                try:
                    pcm, rate = gemini_pcm(text, STYLE[cat], model, voice, api_key)
                    pcm_to_mp3(pcm, rate, path)
                    rows.append((model, voice, text, cat, name, path.stat().st_size))
                    print(f"  [{i}/{total}] ✓ {model} · {voice} · {text}")
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    print(f"  [{i}/{total}] ✗ {model} · {voice} · {text}: {e}", file=sys.stderr)
    write_audition_page(out_dir, rows, models, voices)
    print(f"\nالمفاضلة: {len(rows)} ملفاً، {failed} فشل.")
    print(f"افتحها: python3 -m http.server 8010 -d {out_dir} → http://127.0.0.1:8010/")
    return failed


def write_audition_page(out_dir: Path, rows, models, voices) -> None:
    by = {(m, v, t): (n, s) for m, v, t, _c, n, s in rows}
    head = "".join(f"<th>{t}<small>{CATEGORY_AR[c]}</small></th>" for t, c in AUDITION_TEXTS)
    body = []
    for model in models:
        for voice in voices:
            cells = []
            for text, _cat in AUDITION_TEXTS:
                hit = by.get((model, voice, text))
                cells.append(
                    f'<td><button data-src="{hit[0]}">▶</button>'
                    f'<small>{hit[1] // 1024}KB</small></td>' if hit
                    else '<td class="miss">—</td>'
                )
            body.append(
                f'<tr data-voice="{voice}"><th class="v">{voice}</th>'
                f'<td class="m">{model.replace("gemini-", "").replace("-preview", "")}</td>'
                f'{"".join(cells)}'
                f'<td><button class="all" data-voice="{voice}" data-model="{model}">▶ الكل</button></td></tr>'
            )
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>مفاضلة أصوات Gemini TTS — مشروع المُعلِّم</title>
<style>
 body {{ font-family: "Noto Naskh Arabic", "Geeza Pro", serif; margin: 2rem; background:#faf7f2; color:#241f1a }}
 h1 {{ font-size: 1.4rem }}
 p.note {{ background:#fff3d6; padding:.8rem 1rem; border-radius:.6rem; max-width:52rem; line-height:1.9 }}
 table {{ border-collapse: collapse; margin-top:1rem }}
 th, td {{ border:1px solid #ddd2c2; padding:.45rem .6rem; text-align:center; background:#fff }}
 th.v {{ background:#f0e8db; font-size:1.05rem }}
 td.m {{ font-size:.8rem; color:#6b5f4f; font-family: system-ui }}
 th small {{ display:block; font-weight:normal; color:#8a7a66; font-size:.72rem }}
 button {{ font-size:1.1rem; padding:.35rem .8rem; cursor:pointer; border:1px solid #c9bba6;
           border-radius:.45rem; background:#fdfaf4 }}
 button.playing {{ background:#2f7d4f; color:#fff }}
 td small {{ display:block; color:#a1937f; font-size:.65rem; font-family: system-ui }}
 td.miss {{ color:#c0392b }}
</style></head><body>
<h1>مفاضلة أصوات Gemini TTS</h1>
<p class="note">اسمع الصفوف وقارن: أيّ صوت أوضح مخرجاً وأهدأ إيقاعاً لطفل في السادسة؟
الحكم بالأذن للمالك — ثم يُبلَّغ الاختيار (النموذج + الصوت) ليُولَّد المنهج كله به.
<br>«▶ الكل» يشغّل النصوص الستة للصف بالتتابع.</p>
<table><thead><tr><th>الصوت</th><th>النموذج</th>{head}<th></th></tr></thead>
<tbody>{"".join(body)}</tbody></table>
<script>
let cur = null, btn = null;
function play(src, b) {{
  if (cur) {{ cur.pause(); }}
  if (btn) btn.classList.remove('playing');
  cur = new Audio(src); btn = b; b && b.classList.add('playing');
  cur.play();
  return new Promise((r) => {{ cur.onended = r; cur.onerror = r; }});
}}
document.addEventListener('click', async (e) => {{
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('all')) {{
    const row = b.closest('tr');
    for (const one of row.querySelectorAll('button[data-src]')) {{
      await play(one.dataset.src, one);
      await new Promise((r) => setTimeout(r, 250));
    }}
    if (btn) btn.classList.remove('playing');
    return;
  }}
  if (b.dataset.src) play(b.dataset.src, b);
}});
</script></body></html>"""
    (out_dir / "index.html").write_text(html, encoding="utf-8")


# ————————————————————————— main —————————————————————————

def main():
    ap = argparse.ArgumentParser(description="توليد أصوات المنهج")
    ap.add_argument("--engine", choices=["gemini", "edge"], default=None,
                    help="الافتراضي gemini إن وُجد GEMINI_API_KEY، وإلا edge")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="نموذج Gemini TTS")
    ap.add_argument("--tts-voice", default=DEFAULT_VOICE, help="صوت Gemini (مثل Kore)")
    ap.add_argument("--voice", default="ar-SA-HamedNeural", help="صوت edge-tts")
    ap.add_argument("--force", action="store_true", help="إعادة توليد الموجود")
    ap.add_argument("--replace-same-as", metavar="DIR", nargs="?", const="archive/audio-edge",
                    help="إكمال تبديل الصوت: يعيد توليد كل ملف ما زال مطابقاً لنسخته في DIR "
                         "(أي لم يُبدَّل بعد) ويترك ما بُدِّل — يستأنف بعد انقطاع الحصة")
    ap.add_argument("--dry-run", action="store_true", help="عرض ما سيُولَّد بلا أي طلب")
    ap.add_argument("--rpm", type=float, default=8.0,
                    help="سقف الطلبات في الدقيقة (افتراضي ٨ — دون حدّ النموذج ١٠)")
    ap.add_argument("--from-queue", action="store_true",
                    help="تصريف tools/audio_queue.json بالأولوية فالأقدمية (docs/AUDIO_QUEUE.md)")
    ap.add_argument("--only-model", default="",
                    help="مع --from-queue: اقتصر على ما يوجَّه إلى هذا النموذج")
    ap.add_argument("--route-report", action="store_true",
                    help="خريطة توجيه القائمة على النماذج الثلاثة بلا أي طلب")
    ap.add_argument("--madd-batch", action="store_true",
                    help="احتياط المدود: ٣ محاولات لكل مدّ ناقص على نموذج النواة")
    ap.add_argument("--madd-variants", type=int, default=MADD_VARIANTS)
    ap.add_argument("--madd-force", action="store_true",
                    help="مع --madd-batch: اشمل المدود التي لها ملف (أُنتجت بتعليمة عامة)")
    ap.add_argument("--apply-madd-auto", action="store_true",
                    help="تطبيق معيار الطول المثالي على ما لم يُحسم بالأذن (إذن المالك)")
    ap.add_argument("--apply-madd-pick", metavar="JSON",
                    help="تطبيق اختيار المالك: ملف أو نصّ JSON {\"بَا\": 2}")
    ap.add_argument("--seam-audition", action="store_true",
                    help="صمام السياسة: باقة كاملة (مقاطع 3.1 + كلمة 2.5) للسماع — بلا شبكة")
    ap.add_argument("--model-audition", action="store_true",
                    help="إجازة نموذج: ٣ نصوص متطابقة عليه وعلى نموذج النواة + صفحة مقارنة")
    ap.add_argument("--candidate-model", default=MODEL_LEXICON, help="النموذج المرشَّح للإجازة")
    ap.add_argument("--approve-model", metavar="MODEL", nargs="?", const=MODEL_LEXICON,
                    help="تسجيل إجازة المالك لنموذج (بعد سماعه)")
    ap.add_argument("--reject-model", metavar="MODEL", nargs="?", const=MODEL_LEXICON,
                    help="تسجيل رفض المالك لنموذج")
    ap.add_argument("--style-hint", default="",
                    help="مع --only-texts: تعليمة أداء تحلّ محلّ افتراضي الفئة")
    ap.add_argument("--only-texts", metavar="TEXTS",
                    help="إعادة توليد نصوص منهجٍ بعينها (مفصولة بفاصلة) — لإصلاح عيب مسموع")
    ap.add_argument("--status", metavar="EVENT", nargs="?", const="",
                    help="تحديث scratch/monitor_status.json (مع حدثٍ اختياري)")
    ap.add_argument("--retire", metavar="TEXTS",
                    help="تقاعد نصوص: حذف ملفاتها ووسمُ مدخلاتها (يتيمٌ لم يعد يُطلب)")
    ap.add_argument("--requeue", metavar="TEXTS",
                    help="إعادة نصوص (مفصولة بفاصلة) إلى الانتظار بأولوية ١٠ لعيبٍ مسموع")
    ap.add_argument("--revert", metavar="TEXTS",
                    help="ردُّ نصوصٍ إلى سلفها المحفوظ في scratch/prev (رجوعٌ عن استبدال)")
    ap.add_argument("--requeue-reason", default="عيب مسموع",
                    help="سبب الإعادة كما يُقيَّد في سجل المدخل")
    ap.add_argument("--queue-status", action="store_true",
                    help="عرض حالة القائمة ونصوصها المنتظِرة (JSON) بلا أي طلب")
    ap.add_argument("--verify-only", action="store_true", help="تحقّق ختامي بلا توليد")
    ap.add_argument("--sync-versions", action="store_true",
                    help="إعادة اشتقاق بصمات المحتوى من ملفات القرص — بلا شبكة ولا توليد")
    ap.add_argument("--archive-current", metavar="DIR", nargs="?", const="archive/audio-edge",
                    help="نسخ أصوات app/audio الحالية إلى مجلد أرشيف ثم الخروج")
    ap.add_argument("--audition", action="store_true", help="توليد صفحة مفاضلة الأصوات")
    ap.add_argument("--page-only", action="store_true",
                    help="مع --audition: إعادة بناء الصفحة من الملفات الموجودة بلا طلبات")
    ap.add_argument("--audition-dir", default="scratch/audition")
    ap.add_argument("--audition-voices", default=",".join(AUDITION_VOICES))
    ap.add_argument("--audition-models", default=",".join(AUDITION_MODELS))
    args = ap.parse_args()

    if args.archive_current:
        archive_current(ROOT / args.archive_current)
        return

    if args.apply_madd_auto:
        sys.exit(apply_madd_auto())

    if args.apply_madd_pick:
        sys.exit(apply_madd_pick(args.apply_madd_pick))

    if args.status is not None:
        st = write_status([f"{TODAY} · {args.status}"] if args.status else None)
        print(f"الحالة: {st['queueTotal']} منتظِراً · صُرِّف اليوم {st['doneToday']} · "
              + "، ".join(f"{q['key'][-3:]}·{q['model']}: {q['left']}/{q['cap']}"
                          for q in st["quotas"]))
        sys.exit(0)

    if args.retire:
        wanted = [t.strip() for t in args.retire.split(",") if t.strip()]
        disk = load_queue()
        n = 0
        for e in disk:
            if e.get("text") in wanted:
                e["retired"] = True
                e.setdefault("fixHistory", []).append(
                    {"reason": "تقاعد: لم تعد بيانات التطبيق تطلبه", "at": TODAY})
                n += 1
        if n:
            save_queue(disk)
        for t in wanted:
            f = OUT_DIR / f"{key_for(t)}.mp3"
            if f.exists():
                f.unlink()
        write_manifest(manifest_map())
        print(f"تقاعد {n} نصاً (حُذفت ملفاتها وبقيت سجلاتها).")
        sys.exit(0)

    if args.revert:
        wanted = [t.strip() for t in args.revert.split(",") if t.strip()]
        back, none = revert_prev(wanted)
        print(f"رُدّ {len(back)} نصاً إلى سلفه المحفوظ.")
        for t in none:
            print(f"  ✗ لا سلفَ محفوظ لـ«{t}»", file=sys.stderr)
        sys.exit(0 if back else 1)

    if args.requeue:
        wanted = [t.strip() for t in args.requeue.split(",") if t.strip()]
        n = requeue(wanted, args.requeue_reason)
        print(f"أُعيد {n} نصاً إلى الانتظار بأولوية {URGENT_PRIORITY} ({args.requeue_reason}).")
        sys.exit(0 if n else 1)

    if args.seam_audition:
        sys.exit(run_seam_audition(ROOT / "scratch" / "seam_audition"))

    if args.approve_model or args.reject_model:
        set_approval(args.approve_model or args.reject_model, bool(args.approve_model))
        return

    texts, pending = expected_texts()
    if args.route_report:
        queue = load_queue()
        lexicon_ok = is_approved(MODEL_LEXICON)
        plan = plan_queue(queue, lexicon_ok)
        counts = collections.Counter(short_model(m) or "محبوس حتى الإجازة" for _i, _e, m in plan)
        print(f"توجيه {len(plan)} نصاً منتظِراً "
              f"({short_model(MODEL_LEXICON)}: {'مُجاز' if lexicon_ok else 'غير مُجاز بعد'}):")
        for m, n in counts.most_common():
            print(f"  · {m}: {n}")
        by_cat = collections.Counter(
            (short_model(m) or "محبوس", e.get("category", "word")) for _i, e, m in plan)
        for (m, cat), n in sorted(by_cat.items()):
            print(f"      {m} ← {CATEGORY_AR[cat]}: {n}")
        return

    if args.queue_status:
        queue = load_queue()
        waiting = queue_pending(queue)
        print(f"قائمة الانتظار ({QUEUE_FILE.relative_to(ROOT)}): "
              f"{len(waiting)} منتظِراً، {len(queue) - len(waiting)} مُصرَّفاً.")
        print(json.dumps([e["text"] for _i, e in waiting], ensure_ascii=False))
        return
    if args.sync_versions:
        # بلا شبكة ولا توليد: يقرأ البايتات ويكتب البصمات — لجلسات التطوير أيضاً
        # (نظير `fetch_recitation.py --sync-only`)، ولا يمسّ الفهرس ولا أي mp3.
        write_versions(manifest_map())
        return
    if args.verify_only:
        sys.exit(1 if verify(texts, pending) else 0)

    keys = read_keys()
    api_key = keys[0][1] if keys else None
    pool = KeyPool(keys, args.tts_voice) if keys else None
    engine = args.engine or ("gemini" if api_key else "edge")

    if args.madd_batch:
        if not api_key and not args.dry_run:
            sys.exit("الاحتياط التوليدي يحتاج GEMINI_API_KEY")
        set_rpm(args.rpm)
        sys.exit(1 if madd_batch(pool, args.tts_voice, args.madd_variants,
                                 args.dry_run, args.madd_force) else 0)

    if args.model_audition:
        if not api_key:
            sys.exit("المفاضلة تحتاج GEMINI_API_KEY في البيئة أو .env")
        set_rpm(args.rpm)
        sys.exit(1 if run_model_audition(ROOT / "scratch" / "model_audition", api_key,
                                         args.candidate_model, args.tts_voice, args.force) else 0)

    if args.from_queue:
        if not api_key:
            sys.exit("التصريف يحتاج GEMINI_API_KEY في البيئة أو .env")
        set_rpm(args.rpm)
        # بلا --model صريح: التوجيه بالمحتوى (سياسة النماذج الثلاثة)
        forced = args.model if args.model != DEFAULT_MODEL else None
        print(f"تصريف القائمة · {'النموذج ' + forced if forced else 'توجيه بالمحتوى'} "
              f"· الصوت {args.tts_voice} · ≤{args.rpm:g} طلب/دقيقة لكل مفتاح ونموذج "
              f"· مفاتيح: {'، '.join(n for n, _v in keys)}")
        failed = drain_queue(forced, args.tts_voice, pool, args.dry_run, args.only_model)
        if args.dry_run:
            return
        texts, pending = expected_texts()
        sys.exit(1 if (failed or verify(texts, pending)) else 0)

    if args.audition:
        if not api_key and not args.page_only:
            sys.exit("المفاضلة تحتاج GEMINI_API_KEY في البيئة أو .env")
        failed = run_audition(
            ROOT / args.audition_dir, api_key or "",
            [m.strip() for m in args.audition_models.split(",") if m.strip()],
            [v.strip() for v in args.audition_voices.split(",") if v.strip()],
            args.force, args.page_only,
        )
        sys.exit(1 if failed else 0)

    # التوليد العام على نصوص المنهج وحدها؛ نصوص القائمة يصرّفها --from-queue.
    curriculum = parse_curriculum(CURRICULUM.read_text(encoding="utf-8"))
    counts = {}
    for cat in curriculum.values():
        counts[cat] = counts.get(cat, 0) + 1
    print(f"عدد النصوص المستخرجة من المنهج: {len(curriculum)}  "
          + "، ".join(f"{CATEGORY_AR[c]}: {n}" for c, n in counts.items()))

    if engine == "gemini":
        if not api_key:
            sys.exit("لا مفتاح GEMINI_API_KEY (البيئة أو .env) — استعمل --engine edge")
        set_rpm(args.rpm)
        print(f"المحرّك: Gemini · النموذج {args.model} · الصوت {args.tts_voice} "
              f"· ≤{args.rpm:g} طلب/دقيقة")
        ref = None
        if args.replace_same_as:
            ref = ROOT / args.replace_same_as
            if not ref.is_dir():
                sys.exit(f"مجلد المرجع غير موجود: {ref}")
        if args.only_texts:
            wanted = {t.strip() for t in args.only_texts.split(",") if t.strip()}
            unknown = wanted - set(curriculum)
            if unknown:
                sys.exit("ليست نصوص منهج: " + "، ".join(unknown))
            curriculum = {t: c for t, c in curriculum.items() if t in wanted}
            args.force = True               # الإصلاح يعيد التوليد فوق الموجود
            if args.style_hint:
                hint = args.style_hint.rstrip(":：").rstrip() + ": "
                for cat in set(curriculum.values()):
                    STYLE[cat] = hint       # تعليمةٌ موجَّهة لهذه الدفعة وحدها
            print(f"إصلاح موجَّه: {len(curriculum)} نصاً"
                  + (" بتعليمة خاصة" if args.style_hint else ""))
        failed = synthesize_gemini(curriculum, args.model, args.tts_voice, args.force, pool,
                                   ref, args.dry_run)
        if args.dry_run:
            return
    else:
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            sys.exit("ثبّت الحزمة أولاً:  pip install edge-tts")
        print(f"المحرّك: edge-tts · الصوت {args.voice}")
        failed = asyncio.run(synthesize_edge(curriculum, args.voice, args.force))

    problems = verify(texts, pending)
    sys.exit(1 if (failed or problems) else 0)


if __name__ == "__main__":
    main()
