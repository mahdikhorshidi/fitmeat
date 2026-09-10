// تم روشن/تیره/خودکار — تنها جایی که رنگ تم اعمال می‌شود
import { store } from './store.js';

export const THEMES = [
  { id: 'auto', label: 'خودکار', hint: 'هم‌راستا با تنظیمات سیستم' },
  { id: 'light', label: 'روشن', hint: 'برای باشگاه پرنور و کنار پنجره' },
  { id: 'dark', label: 'تیره', hint: 'کم‌نور، شب و صرفه‌جویی در باتری' },
];

const META = { dark: '#0B0F14', light: '#F5F7FA' };

const mql = window.matchMedia?.('(prefers-color-scheme: dark)');

/** تم مؤثر (وقتی «خودکار» است، از سیستم می‌پرسد) */
export function effectiveTheme(mode = store.settings().theme) {
  if (mode === 'light' || mode === 'dark') return mode;
  return mql?.matches === false ? 'light' : 'dark';
}

export function applyTheme(mode = store.settings().theme) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode;
  else delete root.dataset.theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META[effectiveTheme(mode)]);
  return effectiveTheme(mode);
}

/** در حالت خودکار، تغییر تم سیستم باید بلافاصله دیده شود */
export function watchSystemTheme() {
  mql?.addEventListener?.('change', () => {
    if ((store.settings().theme || 'auto') === 'auto') applyTheme('auto');
  });
}
