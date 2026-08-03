#!/usr/bin/env python3
"""مولّد «مصنع القصص» — الحزمة ٩ (ROADMAP §المرحلة د).

**لا يُكتب في هذا الملف حرفٌ مشكولٌ بيد** — عقدُ الحزمة ٩أ نفسُه، مطبَّقاً على القصة:
كل جملةٍ قائمةُ رموز، كلُّ رمزٍ **كلمةُ أساسٍ معلَنة** (معجم البساتين، أو كلمات المنهج،
أو المعجم المساند، أو معجم المكتبة المعلَن أدناه) **+ دورٌ إعرابيّ**، والصيغة تُشتقّ:

    قُفَّازْ~n يَسْقُطْ~v فَوْقَ عُشْبْ~p   ←   الْقُفَّازُ يَسْقُطُ فَوْقَ الْعُشْبْ

فما لا يُكتب بيد لا يُخطئ فيه الشكل، وكل مفردةٍ تمرّ على الطفل معلَنةٌ في مصدرها.
والاشتقاق **هو اشتقاق ٩أ بعينه** (يُستورَد من `make_sentences.py` لا يُنسَخ)، وقد قِيس
هناك على ٢٢٨ صيغة من مادة الحزمة ٧ حرفاً بحرف — يزيده هذا الملف **دورَي التنوين**:
`~N` تنوينُ الضمّ لاسم العلم مرفوعاً في وسط الجملة («زَيْدٌ يَبْكِي»)، و`~A` تنوينُ النصب
موقوفاً عليه بالألف في آخرها («الزَّمِيلُ يُسَاعِدُ زَيْدَا») — يُكتب ما يُنطق.

**حدود المستويات ليست هنا**: يملكها الفاحص (`check_lexicon.STORY_LEVELS`) ويستوردها
المولّد — فالعقد مكتوبٌ في الحارس، ولا يوسّعه المؤلِّف على نفسه.

خطّ الإنتاج (بند الحزمة ٩/٤ — والبوّابة الثالثة إلزامية):
    تأليف مقيَّد (هنا) → `check_lexicon.py` يرفض ما خالف → **عينُ المدير** في
    `docs/REVIEW_STORIES.md` → ثمّ (وحينئذٍ فقط) قائمةُ الصوت.

الاستعمال:
    python3 tools/make_stories.py              # عرض القصص المولَّدة وإحصاؤها
    python3 tools/make_stories.py --write      # كتابتها في app/data/stories/
    python3 tools/make_stories.py --check      # هل تطابق الملفاتُ خرجَ المولّد؟
    python3 tools/make_stories.py --self-test  # فحص المولّد ومادّته
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_lexicon import (
    STORIES_DIR, STORY_FIELDS, STORY_INDEX, STORY_LEVELS, SUPPORT_FIELD,
    bare, dump_story, load, load_stories, stem, taught_words,
)
from make_sentences import FATHA, all_bases as sentence_bases, render, strip_end

DAMMATAN = "ٌ"
# **يُكتب ما يُنطق** (قاعدة المشروع في الوقف): تنوينُ الضمّ يُنطق في وسط الجملة فيُكتب
# («زَيْدٌ يَبْكِي»)، وتنوينُ النصب يُوقف عليه **ألفاً** في آخرها فيُكتب ألفاً («يُسَاعِدُ
# زَيْدَا») لا «زَيْدًا» — فلا يرى الطفلُ علامةً لا يقرؤها. (حكم المدير في مراجعة الحزمة ٩،
# ويفرضه `waqf_errors` في الفاحص على كل نكرةٍ منصوبة في آخر جملة.)
TANWIN_ROLES = {"N": DAMMATAN, "A": FATHA + "ا"}


# ————— معجم المكتبة المعلَن: ما لزم القصةَ ولم يكن في معجمٍ سابق —————
#
# قاعدة الحزمة ٨ المُقرّة («يُعتمد نمطاً دائماً لكل مادة نصية قادمة — مصنع القصص خاصةً»):
# كل مفردة ليست كلمةَ معجمٍ ولا منهجٍ **تُعلَن** فتُراجَع بالعين، ويرفض الفاحصُ ما لم
# يُعلَن **وما أُعلن ولم تستعمله قصة**. وهذه زيادةُ المكتبة وحدها — والمعجم المساند
# للجمل (١٦٤ مفردة، مُراجَعٌ منذ الحزمة ٨) متاحٌ للقصص كما هو، فلا يُعاد إعلانه.

LIBRARY_SUPPORT = [
    # الشخصيات الثلاث الثابتة (بند الحزمة): **من مادتنا نفسها** — أبطالُ قصص المنهج
    # (`STORIES` في curriculum.js) يعودون في المكتبة، فيلقى الطفل وجوهاً يعرفها.
    "سَامِي", "حَسَنْ", "زَيْدْ",
    # أداةُ الاستفهام في سؤال الفهم (ولا علامةَ استفهام: مادّةُ القراءة كلها بلا ترقيم)
    "مَنْ", "مَاذَا", "أَيْنَ",
    # ظرفُ المعيّة — الخاتمة الطيبة صحبةٌ لا شيء (والملتصقُ ممنوع كما في ٩أ)
    "مَعَ",
    # ما تحتاجه الحبكة: بحثٌ فوقوعٌ فعثورٌ فشكر، وفرحٌ وحزنٌ يقرؤهما الطفل في نفسه
    "يَبْحَثْ", "يَجِدْ", "يَسْقُطْ", "يَشْكُرْ", "تَقْفِزْ",
    "سَعِيدْ", "سَعِيدَةْ", "حَزِينْ",
    # مذكَّرُ فعلين أُعلن مؤنّثهما في معجم الجمل (الفعل يُطابِق فاعله): جارٌ يَحمل، وسامي يَقف
    "يَحْمِلْ", "يَقِفْ",
]


# ————— المادّة المؤلَّفة: عشر قصص على ثلاثة مستويات —————
#
# **قاعدة موضع القصة** (امتداد قاعدة ٩أ): لا تُستعمل في قصةِ بستانٍ كلمةٌ من بستانٍ
# بعده — فتقع القصة في سلّم بستانها ولا تُؤجَّل، ويبقى الحاكمُ قاعدةَ «أوّل موضعٍ
# تكتمل فيه كلماتُها». وكلماتُ المنهج مباحةٌ في كل قصة (درسها الطفل قبل الحديقة كلها).
#
# **والمستوى يرتفع مع الرحلة**: قصصُ الثلاث جملٍ في البساتين الأولى، والثمانِ في
# الأخيرة — فلا يلقى الطفلُ قصةً أطولَ قبل أقصر منها (يفرضه الفاحص).
#
# وخيطُ كل قصة: بدايةٌ ← حدثٌ ← خاتمةٌ طيبة (بند الحزمة ٩/٢).

SPECS = [
    # ————— المستوى ١: ثلاث جمل (٢–٣ كلمات) —————
    {
        "id": "miftah-sami", "level": 1, "garden": "home", "emoji": "🔑",
        "title": "مِفْتَاحْ~u سَامِي",
        "pages": [
            ("سَامِي أَمَامَ بَابْ~p", "🚪"),
            ("مِفْتَاحْ~n تَحْتَ سَرِيرْ~p", "🛏️"),
            ("سَامِي يَفْتَحْ~v بَابْ~p", "🎉"),
        ],
        "ask": ("أَيْنَ مِفْتَاحْ~p", "سَرِيرْ", ["سَلَّةْ", "خِزَانَةْ"]),
    },
    {
        "id": "jaddat-hasan", "level": 1, "garden": "family", "emoji": "👵",
        "title": "جَدَّةْ~u حَسَنْ",
        "pages": [
            ("جَدَّةْ~n فِي حَدِيقَةْ~p", "🏡"),
            ("حَسَنْ~N يُسَاعِدْ~v جَدَّةْ~p", "🤝"),
            ("جَدَّةْ~n سَعِيدَةْ", "😊"),
        ],
        "ask": ("مَنْ فِي حَدِيقَةْ~p", "جَدَّةْ", ["طَبِيبْ", "فَلَّاحْ"]),
    },
    {
        "id": "dirs-zayd", "level": 1, "garden": "body", "emoji": "🦷",
        "title": "ضِرْسْ~u زَيْدْ",
        "pages": [
            ("زَيْدْ~N يَبْكِي", "😢"),
            ("طَبِيبْ~n يُعَالِجْ~v ضِرْسْ~p", "🩺"),
            # («زَيْدٌ سَعِيدْ» ردّها حارسُ التكرار: هي خاتمةُ قصة المنهج «الشَّمْسُ وَالْمَطَرْ»)
            ("زَيْدْ~N يَشْكُرْ~v طَبِيبْ~p", "🤗"),
        ],
        "ask": ("مَنْ يُعَالِجْ~v ضِرْسْ~p", "طَبِيبْ", ["نَجَّارْ", "خَبَّازْ"]),
    },

    # ————— المستوى ٢: خمس أو ست جمل (٢–٤ كلمات) —————
    {
        "id": "shorbat-ummi", "level": 2, "garden": "food", "emoji": "🥣",
        "title": "شُورْبَةْ~u أُمِّي",
        "pages": [
            ("سَامِي فِي مَطْبَخْ~p", "🍳"),
            ("أُمِّي تَطْبُخْ~v شُورْبَةْ~p", "🍲"),
            ("سَامِي يَجْلِسْ~v فَوْقَ مَقْعَدْ~p", "🪑"),
            ("سَامِي يَأْكُلْ~v شُورْبَةْ~p", "😋"),
            ("سَامِي يَشْكُرْ~v أُمِّي", "🤗"),
        ],
        "ask": ("مَاذَا يَأْكُلْ~v سَامِي", "شُورْبَةْ", ["كَعْكْ", "سَمَكْ"]),
    },
    {
        "id": "arnab-alhadiqa", "level": 2, "garden": "animals", "emoji": "🐇",
        "title": "أَرْنَبْ~u حَدِيقَةْ~p",
        "pages": [
            ("فِي حَدِيقَةْ~i أَرْنَبْ", "🏡"),
            ("أَرْنَبْ~n صَغِيرْ~n يَأْكُلْ~v جَزَرْ~p", "🥕"),
            ("قِطَّةْ~n تَنْظُرْ~v مِنَ نَافِذَةْ~p", "🐈"),
            ("أَرْنَبْ~n يَقْفِزْ~v خَلْفَ شَجَرَةْ~p", "🌳"),
            ("قِطَّةْ~n تَنَامْ~v فَوْقَ مَقْعَدْ~p", "😴"),
            ("أَرْنَبْ~n سَعِيدْ", "😀"),
        ],
        "ask": ("مَاذَا يَأْكُلْ~v أَرْنَبْ~p", "جَزَرْ", ["مَوْزْ", "بَيْضْ"]),
    },
    {
        "id": "zahrat-alhaql", "level": 2, "garden": "nature", "emoji": "🌸",
        "title": "زَهْرَةْ~u حَقْلْ~p",
        "pages": [
            ("زَهْرَةْ~n فِي حَقْلْ~p", "🌾"),
            ("سَحَابْ~n فَوْقَ جَبَلْ~p", "☁️"),
            ("رِيحْ~n تَحْمِلْ~v سَحَابْ~p", "🌬️"),
            ("مَطَرْ~n يَنْزِلْ~v فَوْقَ حَقْلْ~p", "🌧️"),
            ("زَهْرَةْ~n تَشْرَبْ~v مَاءْ~p", "💧"),
        ],
        "ask": ("مَاذَا تَحْمِلْ~v رِيحْ~p", "سَحَابْ", ["ثَلْجْ", "رَمْلْ"]),
    },
    {
        "id": "daftar-zayd", "level": 2, "garden": "school", "emoji": "📓",
        "title": "دَفْتَرْ~u زَيْدْ",
        "pages": [
            ("زَيْدْ~N فِي مَدْرَسَةْ~p", "🏫"),
            ("دَفْتَرْ~n فِي بَيْتْ~p", "🏠"),
            ("زَيْدْ~N حَزِينْ", "😟"),
            ("زَمِيلْ~n يُسَاعِدْ~v زَيْدْ~A", "🤝"),
            ("زَيْدْ~N يَكْتُبْ~v وَاجِبْ~p", "✏️"),
            ("مُعَلِّمْ~n سَعِيدْ", "👨‍🏫"),
        ],
        "ask": ("مَنْ يُسَاعِدْ~v زَيْدْ~A", "زَمِيلْ", ["فَلَّاحْ", "تَاجِرْ"]),
    },

    # ————— المستوى ٣: ثماني جمل (٣–٥ كلمات) —————
    {
        "id": "quffaz-hasan", "level": 3, "garden": "clothes", "emoji": "🧤",
        "title": "قُفَّازْ~u حَسَنْ",
        "pages": [
            ("حَسَنْ~N يَلْبَسْ~v مِعْطَفْ~a ثَقِيلْ~p", "🧥"),
            ("قُفَّازْ~n فِي جَيْبْ~k مِعْطَفْ~p", "🧵"),
            ("حَسَنْ~N يَمْشِي فِي حَدِيقَةْ~p", "🚶"),
            ("قُفَّازْ~n يَسْقُطْ~v فَوْقَ عُشْبْ~p", "🌿"),
            ("حَسَنْ~N يَبْحَثْ~v فِي حَدِيقَةْ~p", "🔍"),
            ("قُفَّازْ~n تَحْتَ زَهْرَةْ~i بَيْضَاءْ~p", "🌼"),
            ("حَسَنْ~N يَجِدْ~v قُفَّازْ~p", "🎉"),
            ("حَسَنْ~N يَلْبَسْ~v قُفَّازْ~a نَاعِمْ~p", "🧤"),
        ],
        "ask": ("أَيْنَ يَسْقُطْ~v قُفَّازْ~p", "عُشْبْ", ["رَمْلْ", "ثَلْجْ"]),
    },
    {
        "id": "hafilat-almadrasa", "level": 3, "garden": "city", "emoji": "🚌",
        "title": "حَافِلَةْ~u مَدْرَسَةْ~p",
        "pages": [
            ("سَامِي يَقِفْ~v فِي مَحَطَّةْ~p", "🚉"),
            ("حَافِلَةْ~n تَقِفْ~v أَمَامَ سَامِي", "🚌"),
            ("سَامِي يَرْكَبْ~v حَافِلَةْ~p", "🎫"),
            ("حَافِلَةْ~n تَمْشِي فَوْقَ جِسْرْ~p", "🌉"),
            ("سَامِي يَنْظُرْ~v مِنَ نَافِذَةْ~p", "🪟"),
            ("طَرِيقْ~n طَوِيلْ~n جَمِيلْ", "🛤️"),
            ("حَافِلَةْ~n تَقِفْ~v أَمَامَ مَدْرَسَةْ~p", "🏫"),
            ("مُعَلِّمْ~n يَفْتَحْ~v بَابْ~f مَدْرَسَةْ~p", "🚪"),
        ],
        "ask": ("مَاذَا يَرْكَبْ~v سَامِي", "حَافِلَةْ", ["قَارِبْ", "طَيَّارَةْ"]),
    },
    {
        "id": "kurat-zayd", "level": 3, "garden": "play", "emoji": "⚽",
        "title": "كُرَةْ~u زَيْدْ",
        "pages": [
            ("زَيْدْ~N يَلْعَبْ~v فِي مَلْعَبْ~p", "🏟️"),
            ("كُرَةْ~n حَمْرَاءْ~n جَدِيدَةْ", "🔴"),
            ("كُرَةْ~n تَقْفِزْ~v فَوْقَ جِدَارْ~p", "🧱"),
            ("زَيْدْ~N يَبْحَثْ~v خَلْفَ جِدَارْ~p", "🔍"),
            ("جَارْ~n طَيِّبْ~n يَحْمِلْ~v كُرَةْ~p", "🏘️"),
            ("زَيْدْ~N يَشْكُرْ~v جَارْ~p", "🤗"),
            ("كُرَةْ~n حَمْرَاءْ~n فِي مَلْعَبْ~p", "🥅"),
            ("زَيْدْ~N يَلْعَبْ~v مَعَ سَامِي", "🧒"),
        ],
        "ask": ("أَيْنَ يَلْعَبْ~v زَيْدْ", "مَلْعَبْ", ["مَتْحَفْ", "سُوقْ"]),
    },
]


# ————— البناء —————


def render_token(token: str, bases: dict) -> str:
    """رمزٌ ← صيغتُه. الأدوارُ أدوارُ ٩أ، وزيادةً `~N` تنوينُ الضمّ لاسم العلم."""
    base, _, role = token.partition("~")
    if role in TANWIN_ROLES:
        if base not in bases:
            raise KeyError(base)
        return strip_end(base) + TANWIN_ROLES[role]
    return render(token, bases)


def compose(spec: str, bases: dict, unknown: list) -> str:
    """رموزٌ ← جملةٌ مشكولة. الرمزُ الذي لا أصلَ له يُسجَّل ويُترك كما هو."""
    words = []
    for token in spec.split():
        try:
            words.append(render_token(token, bases))
        except KeyError as e:
            unknown.append((str(e.args[0]), spec))
            words.append(token)
    return " ".join(words)


def all_bases(data: dict) -> dict:
    """كل ما يجوز أن يرد في التأليف: أصول ٩أ + معجم المكتبة المعلَن."""
    out = sentence_bases(data)
    for text in LIBRARY_SUPPORT:
        out[text] = "library"
    return out


def build(data: dict) -> tuple:
    """من الرموز إلى قصصٍ مشكولة — وأي كلمة أساسٍ غير معلَنة توقف البناء."""
    bases = all_bases(data)
    unknown = []
    out = []
    for spec in SPECS:
        story = {
            "id": spec["id"],
            "level": spec["level"],
            "garden": spec["garden"],
            "title": compose(spec["title"], bases, unknown),
            "emoji": spec["emoji"],
            "pages": [{"text": compose(text, bases, unknown), "emoji": emoji}
                      for text, emoji in spec["pages"]],
            "question": {
                "text": compose(spec["ask"][0], bases, unknown),
                "answer": spec["ask"][1],
                "distractors": list(spec["ask"][2]),
            },
        }
        out.append({key: story[key] for key in STORY_FIELDS})
    return out, unknown


def library_support(stories: list) -> list:
    """المعلَن بعد طرح ما لا تستعمله قصة (لا معجم ميت — كما في مساند ٩أ)."""
    used = {stem(word) for story in stories
            for text in [story["title"], story["question"]["text"],
                         *(p["text"] for p in story["pages"])]
            for word in text.split()}
    return [text for text in LIBRARY_SUPPORT if stem(text) in used]


def index_of(stories: list) -> dict:
    return {
        "version": 1,
        "note": "مكتبة «مصنع القصص» (الحزمة ٩) — تُؤلَّف بـtools/make_stories.py "
                "ويفحصها tools/check_lexicon.py، ولا تُحرَّر بيد.",
        SUPPORT_FIELD: library_support(stories),
        "stories": [story["id"] for story in stories],
    }


def dump_index(index: dict) -> str:
    return json.dumps(index, ensure_ascii=False, indent=2) + "\n"


def write(stories: list) -> None:
    STORIES_DIR.mkdir(parents=True, exist_ok=True)
    for story in stories:
        (STORIES_DIR / f"{story['id']}.json").write_text(dump_story(story), encoding="utf-8")
    STORY_INDEX.write_text(dump_index(index_of(stories)), encoding="utf-8")
    keep = {f"{story['id']}.json" for story in stories} | {"index.json"}
    for path in STORIES_DIR.glob("*.json"):
        if path.name not in keep:
            path.unlink()


def report(stories: list, unknown: list) -> int:
    by_level = {}
    for story in stories:
        by_level[story["level"]] = by_level.get(story["level"], 0) + 1
    pages = sum(len(s["pages"]) for s in stories)
    print(f"القصص المؤلَّفة: {len(stories)} في {pages} صفحة | "
          + "، ".join(f"مستوى {lv}: {n}" for lv, n in sorted(by_level.items()))
          + f" | معجم المكتبة: {len(library_support(stories))} مفردة")
    if unknown:
        print(f"\nكلماتُ أساسٍ غير معلَنة ({len(set(u for u, _ in unknown))}):")
        for base in sorted({u for u, _ in unknown}):
            print(f"  ✗ {base}")
        return 1
    return 0


# ————— فحص المولّد ومادّته —————


def self_test(data: dict) -> int:
    fails = 0

    def ok(cond, msg):
        nonlocal fails
        if not cond:
            fails += 1
        print(("  ✓ " if cond else "  ✗ ") + msg)

    stories, unknown = build(data)
    bases = all_bases(data)

    ok(not unknown, "كلُّ رمزٍ في التأليف كلمةُ أساسٍ معلَنة"
       + (f" — مجهول: {sorted({u for u, _ in unknown})[:5]}" if unknown else ""))
    ok(compose("مِفْتَاحْ~n تَحْتَ سَرِيرْ~p", bases, []) == "الْمِفْتَاحُ تَحْتَ السَّرِيرْ",
       "والاشتقاق اشتقاقُ ٩أ نفسُه (قمريّ وشمسيّ ووقفٌ بالسكون)")
    ok(compose("زَيْدْ~N يَبْكِي", bases, []) == "زَيْدٌ يَبْكِي",
       "و`~N` تنوينُ الضمّ لاسم العلم في وسط الجملة (زَيْدْ ← زَيْدٌ)")
    ok(compose("زَمِيلْ~n يُسَاعِدْ~v زَيْدْ~A", bases, []) == "الزَّمِيلُ يُسَاعِدُ زَيْدَا",
       "و`~A` تنوينُ النصب موقوفاً عليه بالألف (زَيْدْ ← زَيْدَا) — يُكتب ما يُنطق")
    ok(stem("زَيْدٌ") == stem("زَيْدْ") == stem("زَيْدَا"),
       "وجذعُها واحدٌ فيعرفها الفاحص من إعلانها الموقوف")

    ok(len(stories) == 10 and [s["level"] for s in stories] == sorted(s["level"] for s in stories),
       f"عشرُ قصص، ومستوياتُها ترتفع مع الرحلة "
       + "(" + "، ".join(str(s["level"]) for s in stories) + ")")

    off = [s["id"] for s in stories
           if not STORY_LEVELS[s["level"]]["pages"][0] <= len(s["pages"])
           <= STORY_LEVELS[s["level"]]["pages"][1]]
    ok(not off, "وعددُ صفحات كل قصة في حدود مستواها (يملكها الفاحص لا المولّد)"
       + (f" — {off}" if off else ""))
    long_ = [f"{s['id']}: {p['text']}" for s in stories for p in s["pages"]
             if not STORY_LEVELS[s["level"]]["words"][0] <= len(p["text"].split())
             <= STORY_LEVELS[s["level"]]["words"][1]]
    ok(not long_, "وطولُ كل جملة كذلك" + (f" — {long_[:3]}" if long_ else ""))

    texts = [p["text"] for s in stories for p in s["pages"]]
    ok(len(set(texts)) == len(texts), f"ولا جملة مكرَّرة في المكتبة ({len(texts)} جملة)")

    lex = {w["word"] for w in data["words"]}
    gardens = [t["id"] for t in data["themes"]]
    place = {w["word"]: gardens.index(w["theme"]) for w in data["words"]}
    late = [f"{s['id']}: {w}" for s in stories for p in s["pages"] for w in p["text"].split()
            if (base := next((b for b in lex if stem(b) == stem(w)), None))
            and place[base] > gardens.index(s["garden"])]
    ok(not late, "ولا كلمةَ بستانٍ لاحقٍ في قصةِ بستانٍ سابق (فلا تُؤجَّل قصة)"
       + (f" — {late[:3]}" if late else ""))

    bad_ask = []
    for story in stories:
        stems = {stem(w) for p in story["pages"] for w in p["text"].split()}
        ask = story["question"]
        if stem(ask["answer"]) not in stems:
            bad_ask.append(f"{story['id']}: جوابٌ خارج النصّ")
        if any(stem(d) in stems for d in ask["distractors"]):
            bad_ask.append(f"{story['id']}: مشتّتٌ في النصّ")
        if {ask["answer"], *ask["distractors"]} - lex:
            bad_ask.append(f"{story['id']}: خيارٌ ليس كلمةَ معجم")
    ok(not bad_ask, "وسؤالُ كل قصة: جوابُه في نصّها ومشتّتاته خارجه"
       + (f" — {bad_ask[:3]}" if bad_ask else ""))

    idle = [t for t in LIBRARY_SUPPORT if t not in library_support(stories)]
    ok(not idle, f"وكلُّ مفردةٍ في معجم المكتبة تستعملها قصة ({len(LIBRARY_SUPPORT)} مفردة)"
       + (f" — معطَّل: {idle}" if idle else ""))
    known, stems = taught_words(), {stem(t) for t in data.get(SUPPORT_FIELD) or []}
    shared = sorted(t for t in LIBRARY_SUPPORT
                    if bare(stem(t)) in known or stem(t) in stems or t in lex)
    ok(not shared, "ولا مفردةَ معلَنةٍ يعرفها الطفل أصلاً — معجمُ المنهج والجمل متاحٌ "
       "للقصص كما هو، والمعلَنُ هنا زيادتُها وحدها"
       + (f" — معروفة سلفاً: {shared}" if shared else ""))

    heroes = {"سَامِي", "حَسَنْ", "زَيْدْ"}
    seen = {t for s in stories for p in s["pages"] for w in p["text"].split()
            for t in heroes if stem(t) == stem(w)}
    ok(seen == heroes, f"وشخصياتُ المكتبة الثلاث من مادتنا كلُّها حاضرة ({'، '.join(sorted(seen))})")

    print(f"\n{fails} فشل" if fails else "\n✓ المولّد ومادّتُه سليمان")
    return 1 if fails else 0


def check_files(stories: list) -> int:
    """هل ما في `app/data/stories/` هو عينُ خرج المولّد؟ (لا تُحرَّر قصةٌ من وراء العقد)"""
    index, on_disk = load_stories()
    want_index = index_of(stories)
    if [s["id"] for s in on_disk] != [s["id"] for s in stories]:
        print("✗ فهرس المكتبة يخالف خرج المولّد — شغّل --write")
        return 1
    for want, have in zip(stories, on_disk):
        if want != have:
            print(f"✗ قصة «{want['id']}» في الملف تخالف خرج المولّد — شغّل --write")
            for key in STORY_FIELDS:
                if want.get(key) != have.get(key):
                    print(f"    [{key}] الملف: {have.get(key)}\n         المولّد: {want.get(key)}")
            return 1
    if {k: index.get(k) for k in want_index} != want_index:
        print("✗ index.json يخالف خرج المولّد (المعجم المعلَن أو الترتيب) — شغّل --write")
        return 1
    print(f"✓ {len(stories)} قصة في app/data/stories مطابقةٌ لخرج المولّد، "
          f"ومعجمُها المعلَن ({len(want_index[SUPPORT_FIELD])} مفردة) كذلك")
    return 0


def main():
    ap = argparse.ArgumentParser(description="مولّد مصنع القصص (الحزمة ٩)")
    ap.add_argument("--write", action="store_true", help="كتابة القصص في app/data/stories/")
    ap.add_argument("--check", action="store_true", help="هل تطابق الملفاتُ خرجَ المولّد؟")
    ap.add_argument("--self-test", action="store_true", help="فحص المولّد ومادّته")
    args = ap.parse_args()

    data = load()
    if args.self_test:
        sys.exit(self_test(data))

    stories, unknown = build(data)
    if args.check:
        sys.exit(check_files(stories) if not unknown else report(stories, unknown))

    status = report(stories, unknown)
    if status:
        sys.exit(status)
    if args.write:
        write(stories)
        print(f"كُتبت في app/data/stories/ ({len(stories)} ملفاً + الفهرس)")
    else:
        for story in stories:
            print(f"\n— {story['title']} {story['emoji']} "
                  f"(مستوى {story['level']} · {story['garden']})")
            for page in story["pages"]:
                print(f"   {page['emoji']} {page['text']}")
            ask = story["question"]
            print(f"   ؟ {ask['text']} → {ask['answer']} "
                  f"(مقابل {'، '.join(ask['distractors'])})")
    sys.exit(0)


if __name__ == "__main__":
    main()
