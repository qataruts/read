// كتلة «اقرأ لي» — التقاطُ صوت الطفل وهو يقرأ، ثم إسماعُه نفسَه (الحزمة ١٠).
//
// **لماذا وحدةٌ مستقلّة؟** لأنّ لها موضعين اليوم: القصة (الحزمة ١٠) و**ترديدُ
// السورة** (حزمة «القرآني الموسّع»). ونسخُ تسعين سطراً من شيفرةٍ **تحمل صوت طفل**
// أسوأُ ما يُنسَخ: يوم يُشدَّد قيدٌ في إحدى النسختين تبقى الأخرى على حالها،
// والخصوصيةُ لا تحتمل نسختين تفترقان. فالكتلة هنا واحدة، وحاملُ الصوت واحد.
//
// **وقاعدةُ الخصوصية المطلقة تسري على هذا الملف بحرفها** (CLAUDE.md): صوتُ الطفل
// يُلتقط ويُخزَن ويُسمَع محلياً — لا رفعَ ولا شبكةَ ولا تحليلَ خارجيّ ولا خزنٌ في
// عامل الخدمة. وهذا الملف **لا يعرف الشبكة أصلاً** (لا `fetch` ولا عنوانٌ خارجيّ)،
// ويقرأ `tools/test_recordings.mjs` نصَّه حرفاً بحرف ليثبت ذلك — فهو أحد «الحاملين».
//
// **ولا مؤقّت ولا عدّاد يراه الطفل** (DESIGN §٥.٦): المدّة تُلتقط ضمنياً وتذهب إلى
// لوحة والده وحدها. و«سجّل من جديد» حاضرٌ دائماً بلا حدّ — فالطلاقة تُبنى بإعادة
// قراءة النصّ نفسه مرّاتٍ (repeated reading — ROADMAP §المرحلة و).

import * as progress from './progress.js';
import * as recorder from './recorder.js';
import * as recordings from './recordings.js';
import { gateCard } from './parent.js';
import { h, micIcon, toast } from './ui.js';

/**
 * صفُّ «اقرأ لي» جاهزاً للإلحاق — أو `null` إن كان الجهاز لا يسجّل أو لا يخزن
 * (غيابُهما لا يكسر شيئاً: لا يظهر الزرّ أصلاً — بند الحزمة ١٠/٤).
 *
 * @param {object}   o
 * @param {string}   o.nodeId  عقدةُ ما يُقرأ (تذهب مع التسجيل إلى لوحة وليّ الأمر)
 * @param {string}   o.title   عنوانُ ما يُقرأ كما يراه الوالد في لوحته
 * @param {string}   o.label   نصُّ الزرّ أوّلَ مرة («اقرأ لي» · «رتّل وسجّل»)
 * @param {string}   o.hint    ما يُطمئنه وهو يسجّل («نسمعك… اقرأ القصة بصوتك»)
 * @param {Function} o.stopAll يُسكِت كلَّ صوتٍ للتطبيق قبل أن يبدأ (فلا يدخل تسجيلَه)
 * @param {Function} o.root    عنصرُ الشاشة — تُعلَّق عليه بوابةُ إذن وليّ الأمر
 */
export function recordBlock({ nodeId, title, label, hint, stopAll, root }) {
  if (!recorder.supported() || !recordings.supported()) return null;

  const row = h('div', { class: 'row record' });
  let clip = null;      // آخر تسجيل في هذه الجلسة — يُسمَع من الذاكرة بلا فتح المخزن
  let busy = false;

  function paintIdle() {
    const buttons = [h('button', {
      class: 'btn rec-mic',
      'aria-label': clip ? 'سجّل قراءتك من جديد' : 'سجّل قراءتك بصوتك',
      onclick: begin,
    }, micIcon(), clip ? 'سجّل من جديد' : label)];
    if (clip) {
      buttons.push(h('button', {
        class: 'btn rec-hear',
        'aria-label': 'اسمع صوتك مرة أخرى',
        onclick: hear,
      }, '▶ اسمع صوتك'));
    }
    row.replaceChildren(...buttons);   // لا فراغ ولا `null` — replaceChildren لا يُصفّي كـ`h`
  }

  function paintRecording() {
    row.replaceChildren(
      h('button', {
        class: 'btn rec-mic rec-mic--on',
        'aria-label': 'أوقِف التسجيل',
        onclick: end,
      }, h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), 'أوقِف التسجيل'),
      h('span', { class: 'hint rec-hint' }, hint),
    );
  }

  /** إذنُ وليّ الأمر مرة واحدة (بند الحزمة ١٠/٤) — بالبوابة الحسابية نفسها. */
  function askParent() {
    const overlay = h('div', { class: 'overlay' },
      h('div', { class: 'overlay-card' }, gateCard({
        hint: 'التسجيل يحتاج إذن وليّ الأمر مرة واحدة — أجب لتفتحه لطفلك.',
        onPass: () => { overlay.remove(); progress.allowMic(); begin(); },
        onCancel: () => overlay.remove(),
      })));
    root()?.append(overlay);
    overlay.querySelector('input')?.focus();
  }

  async function begin() {
    if (busy || recorder.isRecording()) return;
    if (!progress.micAllowed()) return askParent();
    busy = true;
    stopAll();                    // لا يدخل صوتُ التطبيق في تسجيل الطفل
    try {
      await recorder.start();
      paintRecording();
    } catch (e) {
      console.warn('[record] تعذّر التسجيل:', e);
      row.replaceChildren();      // يختفي بهدوء — الرفض لا يكسر شيئاً
      toast('لم يُسمح باستعمال الميكروفون');
    }
    busy = false;
  }

  async function end() {
    if (busy) return;
    busy = true;
    const taken = await recorder.stop().catch(() => null);
    busy = false;
    if (!taken) {
      paintIdle();          // لم يُلتقط شيء: يعود الزرّ كما كان بلا شكوى
      return;
    }

    // **يسمع نفسه أولاً** — أحبُّ صوتٍ إلى الطفل صوتُه، فلا يُؤخَّر سماعُه بانتظار
    // كتابة القرص. والصوت في الذاكرة أصلاً، وحفظُه لوليّ أمره يجري خلفه.
    clip = taken.blob;
    paintIdle();
    hear();
    progress.logRecording({ node: nodeId, title, seconds: taken.seconds });
    recordings.saveClip({
      node: nodeId, title, seconds: taken.seconds, blob: taken.blob, day: progress.dayKey(),
    }).catch((e) => console.warn('[record] تعذّر حفظ التسجيل:', e));
  }

  function hear() {
    if (!clip) return;
    stopAll();
    recorder.playClip(clip);
  }

  paintIdle();
  return row;
}
