#!/usr/bin/env python3
"""مهمة «صدق الصورة» — جرد كل أزواج (كلمة، صورة) في المنظومة وحارسُ التباسها.

المبدأ (docs/DESIGN.md §٦): **الصورة تدلّ على الكلمة نفسِها لا مرادفِها ولا جارتِها.**
فحيث تكون الصورة مفتاحَ حكمٍ على القراءة، صورةٌ ملتبسة = حكمٌ ظالم على طفلٍ قرأ صواباً.

يجرد هذا السكربت **كل** زوج (كلمة، صورة) في المنظومة من مصادره الثلاثة —
`app/js/curriculum.js` و`app/data/lexicon.json` و`app/data/stories/` — ويصنّفه
بثلاث درجات صرامة **بحسب استعماله في الشاشات** لا بحسب مصدره:

  أ) **قصوى**  — الصورة إجابةٌ أو خيارٌ أو مِفتاحُ سؤالٍ يُحكَم به على قراءة الطفل:
     «اقرأ واختر» (الصورة سؤال، والكلمات المكتوبة خيارات — `screens.js`)،
     «اقرأ ونفّذ» و«أكمل الجملة» (الصور خيارات — `ladder.js`)،
     وسؤال فهم القصة (الصور خيارات — `story.js`).
     خطأ الصورة هنا يُعاقِب قارئاً مُحسِناً — فلا يُحتمل فيها التباس.
  ب) **عالية** — بطاقةُ تعليم الكلمة: الصورة تُعرَض مع نصّها المشكول وصوتها معاً
     («شاهد واسمع»، صورةُ «ركّب الكلمة»، مثالُ الدرس، نقاطُ الباقة).
     لا حكم عليها، لكن الصورة الملتبسة تُعلّم معنىً خاطئاً — فتُصحَّح ولا تُتساهل.
  ج) **متساهلة** — مشهدُ قصةٍ أو وجهُ عقدةٍ في الخريطة: زينةٌ تُؤنِس ولا تُسأل،
     وفي شاشة القصة هي `aria-hidden` أصلاً. يكفي أن تناسب الجوّ.

ويحرس آلياً ما يقبل الأتمتة (بند ٣ من المهمة): **لا صورتان متشابهتان لكلمتين
مختلفتين داخل خيارات سؤالٍ واحد** — أي داخل أيّ «حوض سؤال» تُسحَب منه الخيارات.
الأحواض معلَنة أدناه بأسمائها ومَواضعها من الشيفرة، فلا يُفلت حوضٌ من الحراسة.

الاستعمال:
    python3 tools/icon_audit.py            # الجرد بالأعداد + حارس الالتباس
    python3 tools/icon_audit.py -q         # الحارس وحده (أخطاء فقط)
    python3 tools/icon_audit.py --list     # كل زوج (كلمة، صورة) بدرجته
    python3 tools/icon_audit.py --table    # جدول markdown لبوابة docs/REVIEW_ICONS.md
    python3 tools/icon_audit.py --self-test  # فحص الفاحص: هل يمسك الالتباس؟

يخرج بـ ١ عند وجود خطأ واحد على الأقل، وبـ ٠ إن مرّ الفحص.
"""

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_decodable as cd          # noqa: E402  (مصدر تحليل المنهج — لا يُعاد كتابته)
import check_lexicon as cl            # noqa: E402  (مصدر المعجم والقصص)

# الدرجات الثلاث: المفتاح، والاسم، وشرحُ ما يُخشى منه
GRADES = {
    "أ": ("قصوى", "الصورة إجابة/خيار/مفتاح سؤال — الالتباس حكمٌ ظالم"),
    "ب": ("عالية", "بطاقة تعليم الكلمة — الالتباس تعليمٌ خاطئ"),
    "ج": ("متساهلة", "مشهد/وجه زينة — يكفي أن يناسب الجوّ"),
}
ORDER = ["أ", "ب", "ج"]

# ————— أُسَر الالتباس البصري —————
# الحارس الآلي يمسك **تطابق** الصورتين، وهو نصف المسألة؛ ونصفها الآخر أن صورتين
# مختلفتين تبدوان لعين ابنِ السادسة سواءً (بلاغ المالك: 🛋️ لغرفة و🪑 لمقعد في
# بستانٍ واحد). فالأسر أدناه **إعلانٌ بشريّ مقصود** — لا استنباط آليّ — لكل عنقودٍ
# يلتبس على الطفل، فيُبلَّغ عن اجتماع فردين منه في حوض سؤال واحد.
# وهي **تنبيهات لا أخطاء**: الحكم فيها لعين المالك والمدير في docs/REVIEW_ICONS.md،
# فمنها ما يُقَرّ (الدجاجة والديك فرقٌ حقيقيّ يتعلّمه الطفل) ومنها ما يُصلَح.
FAMILIES = {
    "مقاعد": "🪑 🛋️ 💺",
    "أسرّة": "🛏️ 🛌",
    "مبانٍ سكنية": "🏠 🏡 🏘️ 🏚️",
    "متاجر ومبانٍ": "🏪 🏬 🏢 🏭",
    "أقمار": "🌙 🌕 🌑 🌚 🌛 🌜",
    "أشجار": "🌲 🌳 🌴 🎄",
    "كتب": "📖 📕 📗 📘 📙 📚 📔 📓",
    "أقلام وألوان": "✏️ 🖊️ 🖋️ 🖍️ 🖌️",
    "فقاعات كلام": "💬 🗨️ 🗯️ 💭",
    # المربّع والدائرة أسرةٌ واحدة عمداً: 🟦 «مُكَعَّب» بين ست دوائر ملوّنة يقرؤه
    # الطفل لوناً لا شكلاً — والأسرتان لو فُصلتا لأفلت هذا الالتباسُ بعينه.
    "أشكال ملوّنة": "🟦 🟥 🟩 🟨 🟫 🟪 🟧 ⬛ ⬜ 🔴 🔵 🟢 🟡 ⚪ ⚫ 🟤 🟠 🟣",
    "رياح ودخان": "🌬️ 💨 🌪️ 🌫️",
    "برق ورعد": "⚡ 🌩️ ⛈️",
    "ماء": "🌊 💧 💦 🏞️",
    "طائرات": "✈️ 🛫 🛬 🛩️",
    "قطارات ومحطات": "🚂 🚆 🚇 🚉 🚊",
    "طرق وسكك": "🛣️ 🛤️",
    "وجوه مبتسمة": "😊 😀 😁 😄 😃 🙂 😂 🤣 😬",
    "وجوه باكية": "😢 😭 😰",
    "أغطية رأس": "🧢 🎩 👒 ⛑️",
    "أحذية": "👞 👟 👢 🩴 👠",
    "حقائب وجيوب": "👛 👝 👜 🎒 💼",
    "ملابس سفلية": "👖 🩳 🩲",
    "خيوط": "🧵 🧶",
    "أشخاص بلا سمة": "👤 🧍 🧑 🧔 🧓",
    "صغار": "👶 🧒 👦 👧",
    "دجاج": "🐔 🐓",
}


# أزواجٌ من أسرةٍ واحدة **أقرّها المدير** في حوضها (حكم ٥، ٦ أغسطس ٢٠٢٦): فرقُها
# حقيقيّ يقرؤه طفلٌ، فاجتماعُها ليس التباساً. تُدوَّن نصّاً كي يبقى ما عداها منبَّهاً عليه.
ACCEPTED = [
    ("اللَّعِب وَالأَلْوَان", "أشكال ملوّنة",
     "الألوان الستة صورُها هي أسماؤها — دائرةٌ لكل لون عمداً لا التباساً"),
    ("المَلَابِس", "أحذية", "الجزمة والصندل والنعل فروقٌ حقيقية يتعلّمها الطفل"),
    ("الحَيَوَانَات", "دجاج", "الدجاجة والديك فرقٌ حقيقيّ يتعلّمه الطفل"),
    ("الجِسْم", "وجوه مبتسمة",
     "😁 أسنانٌ بادية والفرقُ هو الأسنان — أقرّه المدير في (😁/😊)، و«وَجْه» خرج "
     "من الحوض بحكم الإخراج فبقي معه 😂 ضَحِك على العلّة نفسِها"),
    ("الأسرة", "صغار",
     "حكم المدير (٦ أغسطس ٢٠٢٦): 👧 أُخْت و👶 طِفْل فرقٌ بيّن (بنتٌ وضيع)؛ "
     "و«حَفِيد» أُخرج بحكم الإخراج — 🧒 لا يفرّق حفيداً من طفل"),
    ("الطبيعة", "رياح وغبار",
     "حكم المدير (٦ أغسطس ٢٠٢٦): 🌬️ رِيح و🌪️ عَاصِفَة و🌫️ ضَبَاب فروقٌ بيّنة؛ "
     "و«دُخَان» أُخرج بحكم الإخراج — 💨 سحابةُ اندفاعٍ لا دخان"),
]


class Entry:
    """زوج (كلمة، صورة) بموضعه من المنظومة ودرجة صرامته."""

    __slots__ = ("word", "emoji", "source", "where", "grade", "uses", "pictured")

    def __init__(self, word, emoji, source, where, grade, uses, pictured=True):
        self.word = word
        self.emoji = emoji
        self.source = source      # الملف الذي فيه البيانات
        self.where = where        # موضعها منه (المجموعة/البستان/القصة…)
        # الكلمةُ المعلَنة `pictured: false` **تنزل من الدرجة أ إلى ب**: خرجت من
        # مواضع الحكم فما بقي إلا بطاقتُها — وهو عينُ ما أراده العلاج الثاني.
        self.grade = grade if pictured else ("ب" if grade == "أ" else grade)
        self.uses = uses          # الشاشات التي تعرضها، بأعلى استعمال أولاً
        self.pictured = pictured


def collect() -> tuple:
    """يجمع كل الأزواج وكل «أحواض الأسئلة». يعيد (entries, pools)."""
    entries = []
    pools = []      # [(اسم الحوض، الشاشة، [entry…])]

    # ————— ١) المنهج: app/js/curriculum.js —————
    src = cd.CURRICULUM.read_text(encoding="utf-8")
    _letters, groups, parts = cd.parse_curriculum(src)
    skills = cd.parse_skills(parts.get("SKILLS", ""))
    stories = cd.parse_stories(parts.get("STORIES", ""))
    quran = cd.parse_quran(parts.get("QURAN", ""))

    for group in groups:
        for word in group["words"]:
            entries.append(Entry(
                word["say"], word["emoji"], "curriculum.js",
                f"المجموعة {group['id']} — {group['title']}", "ب",
                ["words.js «ركّب الكلمة» (صورة تُنقر لتُسمع + نقاط الباقة)",
                 "lesson.js مثال الدرس", "review.js «ركّب الكلمة»"],
            ))

    for skill in skills:
        for text, emoji in skill["words"]:
            entries.append(Entry(
                text, emoji, "curriculum.js",
                f"مهارة {skill['id']} — {skill['title']}", "ب",
                ["skill.js بطاقة كلمة الدرس"],
            ))

    for story in stories:
        for i, sentence in enumerate(story["sentences"], 1):
            entries.append(Entry(
                " ".join(sentence["words"]), sentence["emoji"], "curriculum.js",
                f"قصة {story['id']} — المشهد {i}", "ج",
                ["story.js سطر القصة (aria-hidden)"],
            ))
        entries.append(Entry(
            story["title"], story["emoji"], "curriculum.js",
            f"قصة {story['id']} — الوجه", "ج",
            ["ui.js وجه العقدة في الخريطة", "story.js عنوان القصة"],
        ))

    # المرحلة القرآنية: كلماتها الإملائية أحواضُ «اقرأ واختر» — الصورة سؤالٌ يُحكَم به
    quran_letter_words = []
    for sign in quran["letters"]["signs"]:
        for read, emoji, pictured in sign["words"]:
            entry = Entry(
                read, emoji, "curriculum.js",
                f"القرآنية · {quran['letters']['title']} — {sign['name']}", "أ",
                ["quran.js «اقرأ واختر» (الصورة سؤال)", "quran.js بطاقة الكلمة"],
                pictured,
            )
            entries.append(entry)
            if pictured:
                quran_letter_words.append(entry)
    pools.append((f"القرآنية · {quran['letters']['title']}",
                  "quran.js → screens.js readQuizStep", quran_letter_words))

    # **حوضٌ لكل درجة** (الحزمة ١٢): «اقرأ واختر» تسحب مشتّتاتها من كلمات الدرجة وحدها،
    # فالتطابق داخل الدرجة خطأ، وبين درجتين تعارضٌ عبر الرحلة لا حوضٌ واحد.
    for level in quran["words"]["levels"]:
        level_items = []
        for read, emoji, pictured in level["items"]:
            entry = Entry(
                read, emoji, "curriculum.js",
                f"القرآنية · {level['title']}", "أ",
                ["quran.js «اقرأ واختر» (الصورة سؤال)", "quran.js بطاقة الكلمة"],
                pictured,
            )
            entries.append(entry)
            if pictured:
                level_items.append(entry)
        pools.append((f"القرآنية · {level['title']}",
                      "quran.js → screens.js readQuizStep", level_items))

    for surah in quran["surahs"]:
        entries.append(Entry(
            f"سورة {surah['name']}", surah["emoji"], "curriculum.js",
            "القرآنية · السور", "ج", ["ui.js وجه العقدة في الخريطة"],
        ))

    # ————— ٢) المعجم: app/data/lexicon.json —————
    data = cl.load()
    themes = {t["id"]: t for t in data["themes"]}
    by_theme = defaultdict(list)
    for word in data["words"]:
        theme = themes.get(word["theme"], {})
        pictured = word.get("pictured") is not False
        entry = Entry(
            word["word"], word["emoji"], "lexicon.json",
            f"بستان {word['theme']} — {theme.get('title', '?')}", "أ",
            ["ladder.js «اقرأ ونفّذ» (الصورة خيار)",
             "ladder.js «أكمل الجملة» (الصورة خيار)",
             "garden.js «اقرأ واختر» (الصورة سؤال)",
             "story.js سؤال الفهم (الصورة خيار)",
             "garden.js «شاهد واسمع» + «ركّب الكلمة»"]
            if pictured else ["garden.js «شاهد واسمع» + «ركّب الكلمة» (بطاقةً لا سؤالاً)"],
            pictured,
        )
        entries.append(entry)
        if pictured:
            by_theme[word["theme"]].append(entry)

    for theme in data["themes"]:
        entries.append(Entry(
            theme["title"], theme["emoji"], "lexicon.json",
            "وجه البستان", "ج", ["ui.js وجه العقدة في الخريطة"],
        ))
        # حوضُ خيارات البستان: `pickOptions` في ladder.js تسحب من كلمات البستان كلِّها،
        # وباقاتُ «اقرأ واختر» في garden.js أجزاءٌ منه — فالبستان هو الحوض الأوسع.
        pools.append((f"بستان {theme['id']} — {theme['title']}",
                      "ladder.js pickOptions + garden.js readQuizStep",
                      by_theme[theme["id"]]))

    # ————— ٣) مكتبة القصص: app/data/stories/ —————
    _index, library = cl.load_stories()
    lex_word = {w["word"]: w for w in data["words"]}
    for story in library:
        for i, page in enumerate(story.get("pages", []), 1):
            entries.append(Entry(
                page["text"], page["emoji"], f"stories/{story['id']}.json",
                f"المشهد {i}", "ج", ["story.js سطر القصة (aria-hidden)"],
            ))
        entries.append(Entry(
            story["title"], story["emoji"], f"stories/{story['id']}.json",
            "الوجه", "ج", ["ui.js وجه العقدة في الخريطة", "story.js عنوان القصة"],
        ))
        question = story.get("question") or {}
        options = [question.get("answer"), *(question.get("distractors") or [])]
        pool = []
        for option in options:
            word = lex_word.get(option)
            if not word:
                continue
            pool.append(Entry(
                word["word"], word["emoji"], f"stories/{story['id']}.json",
                "خيارات سؤال الفهم", "أ", ["story.js سؤال الفهم (الصورة خيار)"],
            ))
        pools.append((f"سؤال قصة {story['id']}", "story.js askView", pool))

    return entries, pools


def clashes(pools) -> list:
    """التباسٌ داخل حوضِ سؤال: صورةٌ واحدة لكلمتين مختلفتين تُسحبان خيارين معاً."""
    out = []
    for name, screen, pool in pools:
        seen = defaultdict(list)
        for entry in pool:
            if entry.word not in seen[entry.emoji]:
                seen[entry.emoji].append(entry.word)
        for emoji, words in seen.items():
            if len(words) > 1:
                out.append(f"حوض «{name}» ({screen}): الصورة {emoji} "
                           f"لـ{len(words)} كلمات — {'، '.join(words)}")
    return out


def accepted(pool: str, family: str) -> str:
    """علّةُ إقرار المدير لهذا الزوج في هذا الحوض — أو "" إن لم يُقَرّ."""
    for where, kin, why in ACCEPTED:
        if kin == family and where in pool:
            return why
    return ""


def kin_clashes(pools) -> list:
    """التباسٌ مُتبادَل: صورتان من أُسرةٍ واحدة تجتمعان خيارين في حوضٍ واحد.

    تنبيهٌ لا خطأ — الحكم فيه لعين المالك والمدير (docs/REVIEW_ICONS.md)،
    وما حكم فيه المدير بالقبول (`ACCEPTED`) لا يُنبَّه عليه مرّةً أخرى.
    """
    family_of = {}
    for name, glyphs in FAMILIES.items():
        for glyph in glyphs.split():
            family_of[glyph] = name

    out = []
    for name, screen, pool in pools:
        seen = defaultdict(dict)          # أسرة ← {صورة: كلمة}
        for entry in pool:
            family = family_of.get(entry.emoji)
            if family:
                seen[family].setdefault(entry.emoji, entry.word)
        for family, members in seen.items():
            if len(members) > 1 and not accepted(name, family):
                pairs = "، ".join(f"{e} {w}" for e, w in members.items())
                out.append(f"حوض «{name}»: أسرة «{family}» — {pairs}")
    return out


def report(entries, pools, quiet=False) -> int:
    errors = clashes(pools)
    warnings = kin_clashes(pools)

    if not quiet:
        total = len(entries)
        print(f"جرد «صدق الصورة»: {total} زوج (كلمة، صورة) في المنظومة\n")
        counts = Counter(entry.grade for entry in entries)
        for grade in ORDER:
            name, why = GRADES[grade]
            print(f"  ({grade}) {name:9} {counts.get(grade, 0):4}  — {why}")
        print()
        by_source = Counter(entry.source for entry in entries)
        print("  المصادر: " + " · ".join(f"{k}: {v}" for k, v in sorted(by_source.items())))
        print(f"  أحواض الأسئلة المحروسة: {len(pools)} "
              f"({sum(len(p) for _, _, p in pools)} خياراً)")
        print(f"  أُسَر الالتباس المعلَنة: {len(FAMILIES)} "
              f"({sum(len(g.split()) for g in FAMILIES.values())} صورة)")

        # الصورة الواحدة لأكثر من كلمة عبر المنظومة: ليست خطأً بذاتها — حوضان
        # متباعدان لا يلتقيان في سؤال، ومشهدُ القصة يحسُن أن يستعير صورةَ كلمته.
        # لكنّ اجتماعها على **كلمتين مُعلَّمتين** (درجة أ أو ب) تعارضٌ عبر الرحلة:
        # الطفل تعلّم الصورةَ لكلمةٍ ثم سُئل بها عن أخرى.
        # المطابقة بالجذع المجرَّد: «بَابٌ» و«باب» و«الشَّمْسْ» و«شمس» كلمةٌ واحدة
        # عُرضت مرّتين، لا تعارضَ فيها — فلا تُثقِل البوابة بضجيج.
        shared = defaultdict(set)
        taught = defaultdict(dict)
        for entry in entries:
            shared[entry.emoji].add(entry.word)
            if entry.grade in ("أ", "ب"):
                bucket = taught[entry.emoji]
                stem = cd.bare(cl.stem(entry.word))
                # يُحتفظ بأشدّ الدرجتين: موضعُ الحكم هو ما يُقاس عليه التعارض
                if (stem not in bucket
                        or ORDER.index(entry.grade) < ORDER.index(bucket[stem][1])):
                    bucket[stem] = (entry.word, entry.grade)
        repeated = {e: w for e, w in shared.items() if len(w) > 1}
        conflicts = {e: set(w.values()) for e, w in taught.items() if len(w) > 1}
        print(f"  صورٌ تخدم أكثر من كلمة: {len(repeated)} "
              f"(منها {len(conflicts)} على كلمتين مُعلَّمتين فأكثر)")
        if conflicts:
            print("\n  تعارضٌ عبر الرحلة (صورةٌ واحدة لكلمتين مُعلَّمتين):")
            for emoji, words in sorted(conflicts.items(), key=lambda kv: -len(kv[1])):
                shown = "، ".join(f"{w} ({g})" for w, g in sorted(words))
                print(f"    {emoji}  ←  {shown}")
        print()

    if not quiet and warnings:
        print(f"تنبيهُ التباسٍ متبادَل — لعين البوابة لا للآلة ({len(warnings)}):")
        for line in warnings:
            print(f"  ⚠ {line}")
        print()

    if errors:
        print(f"التباسٌ داخل حوض سؤال ({len(errors)}):", file=sys.stderr)
        for line in errors:
            print(f"  ✗ {line}", file=sys.stderr)
        return 1
    if not quiet:
        print("✓ لا صورتان متطابقتان لكلمتين داخل حوض سؤال واحد.")
    return 0


def list_all(entries) -> None:
    for grade in ORDER:
        name, _ = GRADES[grade]
        rows = [e for e in entries if e.grade == grade]
        print(f"\n———— ({grade}) {name} — {len(rows)} ————")
        for entry in rows:
            print(f"  {entry.emoji}  {entry.word:20} · {entry.source} · {entry.where}"
                  f"\n{'':6}↳ {entry.uses[0]}")


def table(entries) -> None:
    """جدول البوابة: كلمة | الحالية | المقترحة | الدرجة | العلة — للعين لا للآلة."""
    print("| الكلمة | الحالية | المقترحة | الدرجة | الموضع |")
    print("| --- | --- | --- | --- | --- |")
    for grade in ORDER:
        for entry in (e for e in entries if e.grade == grade):
            print(f"| {entry.word} | {entry.emoji} |  | {grade} | "
                  f"{entry.source} · {entry.where} |")


def self_test() -> int:
    """فحص الفاحص: يُصطنع التباسٌ فيُتوقَّع أن يمسكه، ثم يُرفع فيمرّ."""
    ok = fail = 0

    def check(label, got, want):
        nonlocal ok, fail
        if got == want:
            ok += 1
        else:
            fail += 1
            print(f"  ✗ {label}: جاء {got!r} والمنتظر {want!r}", file=sys.stderr)

    def entry(word, emoji):
        return Entry(word, emoji, "اختبار", "اختبار", "أ", [])

    clean = [("حوض", "شاشة", [entry("بَابْ", "🚪"), entry("مَالْ", "💰")])]
    check("حوض نظيف يمرّ", clashes(clean), [])

    dirty = [("حوض", "شاشة", [entry("بَابْ", "🚪"), entry("غُرْفَةْ", "🚪")])]
    check("صورتان متشابهتان تُمسَكان", len(clashes(dirty)), 1)

    same = [("حوض", "شاشة", [entry("بَابْ", "🚪"), entry("بَابْ", "🚪")])]
    check("الكلمة نفسها مرتين ليست التباساً", clashes(same), [])

    three = [("حوض", "شاشة", [entry("أ", "🚪"), entry("ب", "🚪"), entry("ج", "🚪")])]
    check("ثلاث كلمات بصورة واحدة بلاغٌ واحد", len(clashes(three)), 1)

    kin = [("حوض", "شاشة", [entry("غُرْفَةْ", "🛋️"), entry("مَقْعَدْ", "🪑")])]
    check("بلاغ المالك: الأريكة والكرسي في حوضٍ واحد تنبيهٌ", len(kin_clashes(kin)), 1)
    check("ولا يُحسب خطأً (الحكم للعين)", clashes(kin), [])

    far = [("حوض", "شاشة", [entry("غُرْفَةْ", "🛋️"), entry("نَمْلْ", "🐜")])]
    check("صورتان من أسرتين لا تنبيه فيهما", kin_clashes(far), [])

    split = [("حوضٌ", "شاشة", [entry("غُرْفَةْ", "🛋️")]),
             ("حوضٌ آخر", "شاشة", [entry("مَقْعَدْ", "🪑")])]
    check("الأسرة الواحدة في حوضين متباعدين لا تُنبِّه", kin_clashes(split), [])

    check("لا صورةَ في أسرتين", max(Counter(
        g for glyphs in FAMILIES.values() for g in glyphs.split()).values()), 1)

    entries, pools = collect()
    check("الجرد يغطي المصادر الثلاثة",
          len({e.source.split("/")[0] for e in entries}), 3)
    check("لا زوجَ بلا صورة", [e.word for e in entries if not e.emoji.strip()], [])
    check("لا زوجَ بلا كلمة", [e.emoji for e in entries if not e.word.strip()], [])
    check("كل حوضٍ له خيارات", [n for n, _, p in pools if not p], [])

    print(f"\nفحص الفاحص: {ok} نجح، {fail} فشل")
    return 1 if fail else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="جرد الأيقونات وحارس التباسها")
    parser.add_argument("-q", "--quiet", action="store_true", help="الأخطاء فقط")
    parser.add_argument("--list", action="store_true", help="كل زوج بدرجته")
    parser.add_argument("--table", action="store_true", help="جدول markdown للبوابة")
    parser.add_argument("--self-test", action="store_true", help="فحص الفاحص")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    entries, pools = collect()
    if args.table:
        table(entries)
        return 0
    if args.list:
        list_all(entries)
        return 0
    return report(entries, pools, quiet=args.quiet)


if __name__ == "__main__":
    sys.exit(main())
