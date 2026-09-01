// ابزارهای عمومی: escape، فرمت اعداد و زمان
const FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** فقط پروتکل‌های امن؛ برای لینک مدیای فایل غیرقابل‌اعتماد */
export function safeUrl(u) {
  if (typeof u !== 'string') return '';
  try {
    const url = new URL(u, location.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
  } catch { return ''; }
}

/** ارقام فارسی فقط برای نمایش */
export function fa(v) {
  return String(v ?? '').replace(/\d/g, d => FA[+d]);
}

export function num(v, digits = 2) {
  if (v == null || v === '' || Number.isNaN(+v)) return '';
  const n = +v;
  return String(Number.isInteger(n) ? n : +n.toFixed(digits));
}

/** 90 → «۱:۳۰» */
export function clock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return fa(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
}

/** 90 → «۹۰ ثانیه»، 150 → «۲:۳۰ دقیقه» */
export function dur(sec) {
  const s = Math.round(sec || 0);
  return s < 60 ? `${fa(s)} ثانیه` : `${clock(s)} دقیقه`;
}

/** فرم کوتاه برای جدول: ۴۵ث یا ۱:۳۰ */
export function durShort(sec) {
  const s = Math.round(sec || 0);
  return s < 60 ? `${fa(s)}ث` : clock(s);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** «8-10» → {low:8, high:10}؛ «10» → {low:10, high:10} */
export function repRange(reps) {
  if (typeof reps === 'number') return { low: reps, high: reps };
  const m = String(reps ?? '').match(/^\s*(\d+)\s*[-–تا]+\s*(\d+)\s*$/);
  if (m) return { low: +m[1], high: +m[2] };
  const one = String(reps ?? '').match(/^\s*(\d+)\s*$/);
  return one ? { low: +one[1], high: +one[1] } : null;
}

/** «20%» → 0.2 ، 0.2 → 0.2 ، 20 → 0.2 */
export function ratio(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim().endsWith('%')) return parseFloat(v) / 100;
  const n = +v;
  if (Number.isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
