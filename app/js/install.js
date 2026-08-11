// بابُ التثبيت — شريطٌ داخل التطبيق يقود كلَّ زائرٍ إلى تثبيته (أمر المالك، ١١ أغسطس ٢٠٢٦:
// «اقرأ من المتصفح ليس عملياً — من التطبيق هو ما نريده، فكيف نجعل كلَّ زائرٍ يثبّته؟»).
//
// **لماذا شريطٌ داخل التطبيق لا صفحةُ شرح**: الزائر يصل إلى التطبيق نفسِه (رابطٌ من
// معلم أو مجموعة)، وصفحةُ التعريف — وفيها قسمُ التثبيت المصوَّر — لا يمرّ بها كلُّ أحد.
// فالشريطُ يلقاه حيث هو، **ويقول لكل جهازٍ ما يخصّه**:
//
//   · أندرويد/كروم/إيدج (وحاسوب): النظامُ يعطينا حدثَ `beforeinstallprompt` — نمسكه
//     ونعرض زرَّ «ثبّت الآن» **يفتح نافذةَ التثبيت الحقيقية بنقرة** — صفرُ شرح.
//   · آيباد/آيفون: آبل لا تتيح تثبيتاً برمجياً ألبتّة (لا حدثَ ولا واجهة) — فالشريطُ
//     يشرح الخطوتين بلفظهما («زرُّ المشاركة ← إضافة إلى الشاشة الرئيسية»)، وإن كان
//     المتصفحُ غيرَ سفاري قال أولاً: افتح في سفاري — فالتثبيتُ على iOS منه وحدَه.
//   · **ومن التطبيق المثبَّت لا يظهر أبداً**: وضعُ `standalone` يكشفه فيصمت الشريط —
//     فلا يُطلَب من مثبِّتٍ أن يثبّت.
//
// **ولا إزعاج**: زرُّ إغلاقٍ يُسكِته أسبوعاً (يتذكّره localStorage)، ونجاحُ التثبيت
// (`appinstalled`) يُسكته أبداً. والوحدةُ لا تعرف الشبكة — عرضٌ وقرارٌ محليان صرفان.
//
// وقرارُ العرض دالّةٌ نقيّة (`installState`) تُفحَص في node بجدول حالاتٍ كامل
// (`tools/test_install.mjs`) — فمنطقُ «أيُّ رسالةٍ لأيّ جهاز» محروسٌ لا مظنون.

import { h, toast } from './ui.js';

const KEY = 'muallim.install.v1';
const REST_DAYS = 7;                      // رقادُ الشريط بعد الإغلاق — أسبوعٌ ثم يعود بلطف

let deferredPrompt = null;                // حدثُ التثبيت المُمسَك (كروم/إيدج/أندرويد)
let bar = null;

/** قرارُ العرض — نقيٌّ ليُفحَص: ماذا نُري هذا الجهازَ الآن؟
 *  @returns {'hidden'|'button'|'ios'|'ios-other'} */
export function installState({ standalone, ua, touchPoints, promptReady, memo, now }) {
  if (standalone || memo.installed) return 'hidden';
  if (memo.dismissedAt && now - memo.dismissedAt < REST_DAYS * 86400000) return 'hidden';
  if (promptReady) return 'button';
  // آيباد iPadOS يقدّم نفسَه «Macintosh» — يفضحه تعدّدُ نقاط اللمس
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (!ios) return 'hidden';              // جهازٌ لا نملك له طريقاً (فَيَرفُكس مثلاً): الصمتُ أهدأ
  const safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return safari ? 'ios' : 'ios-other';
}

const memo = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const remember = (patch) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...memo(), ...patch })); } catch { /* تخزينٌ ممتلئ: يظهر الشريط أكثر، ولا يضرّ */ }
};

function state() {
  const standalone = matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
  return installState({
    standalone,
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints || 0,
    promptReady: Boolean(deferredPrompt),
    memo: memo(),
    now: Date.now(),
  });
}

function paint() {
  if (bar) { bar.remove(); bar = null; }
  const mode = state();
  if (mode === 'hidden') return;

  const close = h('button', {
    class: 'install-x',
    'aria-label': 'أغلق شريط التثبيت',
    onclick: () => { remember({ dismissedAt: Date.now() }); paint(); },
  }, '✕');

  let body;
  if (mode === 'button') {
    body = [
      h('span', { class: 'install-text' },
        'ثبّت «اِقْرَأْ» على هذا الجهاز — يفتح من أيقونته ويعمل بلا إنترنت.'),
      h('button', {
        class: 'btn btn--primary install-go',
        onclick: async () => {
          const prompt = deferredPrompt;
          if (!prompt) return;
          deferredPrompt = null;          // الحدثُ يُستهلك مرةً واحدة بحكم المنصة
          prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome !== 'accepted') remember({ dismissedAt: Date.now() });
          paint();                         // نجاحُ التثبيت يصمُت عبر appinstalled
        },
      }, 'ثبّت الآن'),
    ];
  } else if (mode === 'ios') {
    body = [h('span', { class: 'install-text' },
      'ثبّت «اِقْرَأْ» على الجهاز: اضغط زرَّ المشاركة (المربّع الذي يخرج منه سهمٌ إلى أعلى)، ثم «إضافة إلى الشاشة الرئيسية».')];
  } else {
    body = [h('span', { class: 'install-text' },
      'للتثبيت على هذا الجهاز: افتح هذا العنوان في متصفّح سفاري، ثم زرُّ المشاركة ← «إضافة إلى الشاشة الرئيسية».')];
  }

  bar = h('div', { class: 'install-bar' }, ...body, close);
  document.body.prepend(bar);
}

// الحدثان يُلتقطان عند تحميل الوحدة — `beforeinstallprompt` يقع بُعيد التحميل ولا يعاد
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                   // نؤجّل عرضَ النظام إلى زرّنا نحن
    deferredPrompt = e;
    if (document.body) paint();
  });
  window.addEventListener('appinstalled', () => {
    remember({ installed: true });
    deferredPrompt = null;
    if (bar) { bar.remove(); bar = null; }
    toast('ثُبّت التطبيق — افتحه من أيقونته');
  });
}

/** تركيبُ الشريط عند الإقلاع (لا يُنادى في وضع المعاينة — شريطان فوق الشاشة ضجيج). */
export function mount() {
  paint();
}
