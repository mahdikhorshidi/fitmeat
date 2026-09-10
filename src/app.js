// بوت‌استرپ: روتر، پیشنهاد ادامهٔ جلسه و ثبت service worker
import { route, startRouter, go } from './router.js';
import { libraryView } from './views/library.js';
import { programView, dayView } from './views/program.js';
import { gymView } from './views/gym.js';
import { editorView } from './views/editor.js';
import { historyView } from './views/history.js';
import { settingsView } from './views/settings.js';
import { store } from './store.js';
import { confirmSheet } from './ui.js';
import { primeAudio } from './timer.js';
import { applyTheme, watchSystemTheme } from './theme.js';

// تم را پیش از اولین رندر اعمال کن تا صفحه یک‌بار سفید/سیاه پرش نکند
applyTheme();
watchSystemTheme();

route('/', libraryView);
route('/p/:id', programView);
route('/p/:id/d/:dayId', dayView);
route('/gym/:id/:dayId', gymView);
route('/editor/:id', editorView);
route('/history', historyView);
route('/settings', settingsView);

startRouter(() => go('/', { replace: true }));

// اولین تعامل کاربر: آماده‌سازی صدا (محدودیت مرورگرهای موبایل)
addEventListener('pointerdown', () => primeAudio(), { once: true });

// پیشنهاد ادامهٔ جلسهٔ ناتمام
const live = store.live();
if (live && !location.hash.startsWith('#/gym/')) {
  const p = store.program(live.programId);
  if (p) {
    confirmSheet('جلسهٔ ناتمام', `«${p.name}» نیمه‌کاره مانده است. ادامه می‌دهید؟`, { okText: 'ادامهٔ جلسه' })
      .then(ok => { if (ok) go(`/gym/${live.programId}/${live.dayId}`); else store.setLive(null); });
  } else {
    store.setLive(null);
  }
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
