// تصویر حرکات از منبع بیرونی (wger.de — متن‌باز، تصاویر با مجوز CC)
// نتیجهٔ جست‌وجو در localStorage کش می‌شود تا هر بار به شبکه نرویم.
import { store } from './store.js';
import { esc, safeUrl } from './util.js';

export const SOURCE = { name: 'wger.de', base: 'https://wger.de' };

const CACHE_KEY = 'fitmeat.media.v1';
const TTL_HIT = 30 * 864e5;   // ۳۰ روز
const TTL_MISS = 7 * 864e5;   // ۷ روز

/** نام فارسی حرکت → عبارت جست‌وجوی انگلیسی در منبع */
export const TERMS = {
  'الپتیکال': 'cross trainer',
  'تردمیل': 'treadmill',
  'پلانک': 'plank',
  'پلانک شکم': 'plank',
  'مسگر': 'sit up',
  'شکم پاروئی': 'v-up',
  'شکم کرانچ': 'crunches',
  'زیربغل H موازی': 'seated row',
  'لت دست دوبل': 'lat pulldown',
  'لت دست متوسط': 'lat pulldown',
  'فیله رو زمین': 'superman',
  'دمبل جفت خم': 'bent over dumbbell row',
  'فلای بک دو حالته': 'reverse fly',
  'نشر از جانب': 'lateral raises',
  'پرس دمبل موازی': 'shoulder press dumbbell',
  'نشر رو به رو دمبل': 'front raises',
  'پشت بازو سیم‌کش ایستاده': 'triceps pushdown',
  'پشت بازو هالتر خوابیده': 'skull crusher',
  'کیک بک دمبل پشت بازو': 'triceps kickback',
  'داخل پا': 'hip adduction machine',
  'پل باسن': 'glute bridge',
  'پشت پا تک': 'leg curl',
  'جلو پا': 'leg extension',
  'پرس تک پا': 'leg press',
  'ساق با دستگاه پرس پا': 'calf raises',
  'حرکت اصلاحی کمر — دست و پای مخالف': 'bird dog',
  'پرس سینه دمبل': 'bench press dumbbell',
  'پرس سینه هالتر': 'bench press',
  'زیربغل دمبل تک‌دست': 'one arm dumbbell row',
  'نشر جانب': 'lateral raises',
  'پشت‌بازو دیپ روی نیمکت': 'bench dips',
  'کوهنورد': 'mountain climber',
  'شنا سوئدی': 'push ups',
};

/** «جلو پا — پنجه صاف» → «جلو پا» ؛ «مکث — پای چپ…» → بدون معادل */
export function termFor(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  if (TERMS[n]) return TERMS[n];
  const head = n.split(/\s*[—–-]\s*/)[0].trim();
  return TERMS[head] || '';
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}

function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* سهمیه پر است */ }
}

function fresh(rec) {
  if (!rec) return false;
  return Date.now() - rec.ts < (rec.image ? TTL_HIT : TTL_MISS);
}

function abs(u) {
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : SOURCE.base + (u.startsWith('/') ? u : `/${u}`);
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * عبارت انگلیسی → { image, page } از منبع؛ اگر چیزی پیدا نشد image خالی است.
 * نتیجه (چه مثبت چه منفی) کش می‌شود.
 */
export async function lookup(term) {
  if (!term) return null;
  const cache = readCache();
  if (fresh(cache[term])) return cache[term].image ? cache[term] : null;

  let rec = { image: '', page: '', ts: Date.now() };
  try {
    const q = `${SOURCE.base}/api/v2/exercise/search/?format=json&language=2&term=${encodeURIComponent(term)}`;
    const data = await getJSON(q);
    const hits = (data?.suggestions || []).map(s => s?.data).filter(Boolean);
    const withImg = hits.find(d => d.image) || hits[0];
    if (withImg) {
      const id = withImg.base_id ?? withImg.id;
      let img = withImg.image;
      if (!img && id != null) {
        const list = await getJSON(`${SOURCE.base}/api/v2/exerciseimage/?format=json&limit=1&exercise_base=${id}`);
        img = list?.results?.[0]?.image || '';
      }
      rec = { image: safeUrl(abs(img)), page: id != null ? `${SOURCE.base}/en/exercise/${id}/view/` : '', ts: Date.now() };
    }
  } catch {
    // آفلاین یا خطای شبکه — منفی کوتاه‌مدت کش می‌شود
  }
  cache[term] = rec;
  writeCache(cache);
  return rec.image ? rec : null;
}

/** حرکت → تصویر (اول media.image خود برنامه، بعد منبع بیرونی) */
export async function imageFor(ex) {
  const own = safeUrl(ex?.media?.image);
  if (own) return { image: own, page: safeUrl(ex.media?.video), own: true };
  if (!store.settings().exerciseImages) return null;
  return lookup(termFor(ex?.name));
}

function figureHTML({ image, page, own }, alt) {
  return `<figure class="ex-media">
    <img src="${esc(image)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">
    ${own ? '' : `<figcaption class="small muted">تصویر از
      <a href="${esc(page || SOURCE.base)}" target="_blank" rel="noopener noreferrer">${esc(SOURCE.name)}</a>
      (CC BY-SA)</figcaption>`}
  </figure>`;
}

/**
 * جایگاه تصویر را داخل یک شیت پر می‌کند.
 * slot باید عنصری با data-media باشد؛ اگر تصویری پیدا نشد، حذف می‌شود.
 */
export async function mountMedia(root, ex, alt = ex?.name) {
  const slot = root?.querySelector?.('[data-media]');
  if (!slot) return;
  let found = null;
  try { found = await imageFor(ex); } catch { found = null; }
  if (!slot.isConnected) return;
  if (!found?.image) { slot.remove(); return; }
  slot.innerHTML = figureHTML(found, alt);
  const img = slot.querySelector('img');
  img.onerror = () => slot.remove();
}
