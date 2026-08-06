#!/usr/bin/env python3
"""الرسمُ الصوتيّ (IPA) من العربية المشكولة — ليقرأ المولّدُ ما لا يحتمل تأويلاً.

    python3 tools/arabic_ipa.py "بَ" "ثِ" "سُكْ كَرْ"    # يطبع رسمَها الصوتيّ
    python3 tools/arabic_ipa.py --self-test              # بلا شبكة ولا ملفات

**العلّة** (أذن المالك، ٤–٥ أغسطس ٢٠٢٦): أخطاءُ المولّد في الحروف والمقاطع أخطاءُ
**هويةِ حرفٍ** لا أداء — «ثِ» تُنطق «خِ»، و«كاف» «تاف»، و«طَ» «كاء». والحرفُ العربيّ
المشكول رمزٌ يحتمل عند نموذجٍ عامّ أكثرَ من قراءة، أمّا `/θi/` فلا يحتمل غيرَ واحدة.

**والمقابلةُ للفصحى المعاصرة** بمخارجها المعروفة: المفخَّمة بعلامة التفخيم (`sˤ`)،
والمدُّ بعلامة الطول (`aː`)، والشدّةُ تضعيفُ الحرف (`bː`) — وهي رموزٌ يفهمها المولّد
لأنها معياريةٌ عالمية، لا اصطلاحٌ خاصّ بنا.

**ولا تُستعمل وحدَها في المصحف** — انظر شرطَ المالك في `docs/AUDIO_QUEUE.md`.
"""

import argparse
import sys

CONS = {
    "ء": "ʔ", "ب": "b", "ت": "t", "ث": "θ", "ج": "d͡ʒ", "ح": "ħ", "خ": "x",
    "د": "d", "ذ": "ð", "ر": "r", "ز": "z", "س": "s", "ش": "ʃ", "ص": "sˤ",
    "ض": "dˤ", "ط": "tˤ", "ظ": "ðˤ", "ع": "ʕ", "غ": "ɣ", "ف": "f", "ق": "q",
    "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "j",
    "ة": "h",                      # في الوقف تُنطق هاءً — وهو ما نُسمعه الطفل
    "أ": "ʔ", "إ": "ʔ", "ؤ": "ʔ", "ئ": "ʔ", "ٱ": "ʔ",
    "ى": "aː",                     # ألفٌ مقصورة
}
SHORT = {"َ": "a", "ُ": "u", "ِ": "i"}
TANWEEN = {"ً": "an", "ٌ": "un", "ٍ": "in"}
SUKUN, SHADDA, DAGGER = "ْ", "ّ", "ٰ"
MARKS = set(SHORT) | set(TANWEEN) | {SUKUN, SHADDA, DAGGER}


def ipa(text: str) -> str:
    """الرسمُ الصوتيّ لنصٍّ عربيّ مشكول — حرفاً حرفاً بحركاته اللاحقة."""
    out, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch in (" ", "‏"):
            out.append(" ")
            i += 1
            continue
        if ch == "آ":                                   # ألفٌ ممدودة = همزةٌ ثم مدّ
            out.append("ʔaː")
            i += 1
            continue
        # ألفُ الوصل في أول الكلمة (بلا حركة): تُنطق «أَ»، ولامُها شمسيةٌ أو قمرية
        if ch == "ا" and (i == 0 or text[i - 1] == " ") and (
                i + 1 >= n or text[i + 1] not in MARKS):
            out.append("ʔa")
            i += 1
            if i < n and text[i] == "ل":
                after = text[i + 1] if i + 1 < n else ""
                if after == SUKUN:                      # قمريّة: اللام تُنطق
                    out.append("l")
                    i += 2
                else:                                   # شمسيّة: اللام تُدغَم فتسقط
                    i += 1
            continue
        if ch not in CONS:
            i += 1                                      # علامةٌ يتيمة أو حرفٌ مجهول
            continue
        # جمعُ العلامات التالية للحرف
        j, marks = i + 1, []
        while j < n and text[j] in MARKS:
            marks.append(text[j])
            j += 1
        base = CONS[ch]
        if ch == "ا":
            base = ""                                   # الألفُ حاملةٌ لا صوتَ لها
        if SHADDA in marks:
            base = base + "ː" if base else base         # الشدّةُ تطويلُ الصامت

        nxt = text[j] if j < n else ""
        vowel = ""
        for m in marks:
            if m in SHORT:
                vowel = SHORT[m]
            elif m in TANWEEN:
                vowel = TANWEEN[m]
            elif m == DAGGER:
                vowel = "aː"
        # المدُّ: حركةٌ قصيرة يتلوها حرفُ مدٍّ ساكنٌ من جنسها
        if nxt in ("ا", "و", "ي", "ى") and vowel in ("a", "u", "i"):
            after = text[j + 1] if j + 1 < n else ""
            homogeneous = ((nxt in ("ا", "ى") and vowel == "a")
                           or (nxt == "و" and vowel == "u")
                           or (nxt == "ي" and vowel == "i"))
            if homogeneous and after not in SHORT and after != SHADDA:
                vowel += "ː"
                j += 1
                while j < n and text[j] in MARKS:        # سكونُ حرف المدّ يُتخطّى
                    j += 1
        out.append(base + vowel)
        i = j
    return "".join(out).strip()


def ipa_of_word(text: str) -> str:
    return " ".join(ipa(w) for w in text.split() if w)


def self_test() -> int:
    ok_n = bad_n = 0

    def eq(text, want):
        nonlocal ok_n, bad_n
        got = ipa(text)
        good = got == want
        print(("  ✓ " if good else "  ✗ ") + f"{text:<14} → /{got}/" +
              ("" if good else f"   والمنتظَر /{want}/"))
        ok_n, bad_n = ok_n + good, bad_n + (not good)

    eq("بَ", "ba")                       # حرفٌ بحركة
    eq("ثِ", "θi")                       # العلّةُ عينُها: «ثِ» لا «خِ»
    eq("قُ", "qu")
    eq("ضْ", "dˤ")                       # ساكنٌ: صامتٌ بلا حركة
    eq("لَا", "laː")                     # مدُّ الألف
    eq("حُو", "ħuː")                     # مدُّ الواو
    eq("حِي", "ħiː")                     # مدُّ الياء
    eq("نَوْ", "naw")                    # لينٌ لا مدّ (فتحةٌ ثم واوٌ ساكنة)
    eq("سَيْ", "saj")
    eq("كَةْ", "kah")                    # التاءُ المربوطة هاءً في الوقف
    eq("بَّ", "bːa")                     # شدّة
    eq("بً", "ban")                      # تنوين
    eq("أَسَدْ", "ʔasad")
    eq("مِفْتَاحْ", "miftaːħ")
    eq("سُكْ كَرْ", "suk kar")           # مقطعان بفراغ
    eq("الصَّخْرَةْ", "ʔasˤːaxrah")      # لامٌ شمسية: تُدغَم فتسقط من النطق
    eq("الْبَيْتْ", "ʔalbajt")            # وقمريّةٌ: اللامُ ساكنةٌ فتُنطق
    eq("الْكَلْبُ", "ʔalkalbu")
    eq("التُّفَّاحَةْ", "ʔatːufːaːħah")
    eq("قِيثَارَةْ", "qiːθaːrah")
    eq("رَاةْ", "raːh")
    print(f"\n{ok_n}/{ok_n + bad_n} تحقّقاً ناجحاً")
    return 1 if bad_n else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="الرسم الصوتيّ من العربية المشكولة")
    ap.add_argument("texts", nargs="*")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    for t in args.texts:
        print(f"{t}\t/{ipa_of_word(t)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
