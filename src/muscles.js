// نقشهٔ عضلات: فهرست عضلات + بدنِ SVG با ناحیه‌های رنگ‌شونده
// نام‌ها فارسیِ رایج باشگاه است، با معادل علمی برای صحت.

export const MUSCLES = {
  chest:    { fa: 'سینه',            sci: 'Pectoralis major',      side: 'front' },
  delt_ant: { fa: 'سرشانهٔ جلو',      sci: 'Deltoid (anterior)',    side: 'front' },
  delt_lat: { fa: 'سرشانهٔ میانی',    sci: 'Deltoid (lateral)',     side: 'front' },
  delt_post:{ fa: 'سرشانهٔ پشتی',     sci: 'Deltoid (posterior)',   side: 'back'  },
  biceps:   { fa: 'جلوبازو',          sci: 'Biceps brachii',        side: 'front' },
  triceps:  { fa: 'پشت‌بازو',         sci: 'Triceps brachii',       side: 'back'  },
  forearm:  { fa: 'ساعد',             sci: 'Forearm flexors',       side: 'front' },
  traps_up: { fa: 'کول',              sci: 'Upper trapezius',       side: 'back'  },
  traps_mid:{ fa: 'میان‌پشتی',        sci: 'Mid-traps & rhomboids', side: 'back'  },
  lats:     { fa: 'زیربغل',           sci: 'Latissimus dorsi',      side: 'back'  },
  erector:  { fa: 'فیلهٔ کمر',        sci: 'Erector spinae',        side: 'back'  },
  abs:      { fa: 'شکم',              sci: 'Rectus abdominis',      side: 'front' },
  oblique:  { fa: 'مورب شکم',         sci: 'Obliques',              side: 'front' },
  serratus: { fa: 'دندانه‌ای',        sci: 'Serratus anterior',     side: 'front' },
  glute:    { fa: 'سرینی (باسن)',     sci: 'Gluteus maximus',       side: 'back'  },
  abductor: { fa: 'سرینی میانی',      sci: 'Gluteus medius',        side: 'back'  },
  quad:     { fa: 'چهارسر ران',       sci: 'Quadriceps',            side: 'front' },
  ham:      { fa: 'همسترینگ',         sci: 'Hamstrings',            side: 'back'  },
  adductor: { fa: 'داخل ران',         sci: 'Hip adductors',         side: 'front' },
  hipflex:  { fa: 'خم‌کنندهٔ ران',    sci: 'Iliopsoas',             side: 'front' },
  calf:     { fa: 'ساق',              sci: 'Gastrocnemius & soleus',side: 'back'  },
  rotator:  { fa: 'چرخانندهٔ شانه',   sci: 'Rotator cuff',          side: 'back'  },
  neck:     { fa: 'گردن',             sci: 'Cervical extensors',    side: 'back'  },
};

export const muscleName = k => MUSCLES[k]?.fa || k;

/* --- هندسهٔ بدن ---------------------------------------------------------
   دو فیگور ساده در viewBox 100×210. اسکلت پایه با خط و مسیر کشیده می‌شود و
   هر ناحیهٔ عضلانی یک شکل سادهٔ روی آن است. شکل‌هایی که `m` دارند قرینه هم
   می‌شوند (چپ و راست بدن).                                                */

const el = (cx, cy, rx, ry, rot = 0, m = false) => ({ t: 'e', cx, cy, rx, ry, rot, m });
const rc = (x, y, w, h, r = 4, m = false) => ({ t: 'r', x, y, w, h, r, m });
const pt = (d, m = false) => ({ t: 'p', d, m });

/** اسکلت پایه: سر، تنه و اندام‌ها */
const SKELETON = `
  <circle cx="50" cy="16" r="9" class="body-base"/>
  <path class="body-base" d="M50 25c-4 0-6 2-7 6l-14 4c-2 1-3 2-3 4v14l-2 22 4 1 3-20 1 32 2 18h32l2-18 1-32 3 20 4-1-2-22V39c0-2-1-3-3-4l-14-4c-1-4-3-6-7-6z"/>
  <path class="body-base" d="M36 100h28l-1 16-2 32-2 30-2 22h-7l-1-22-2-30v-14l-1 14-2 30-1 22h-7l-2-22-2-30-2-32z"/>
  <g class="body-limb">
    <path d="M27 40 21 72 17 104"/><path d="M73 40 79 72 83 104"/>
  </g>`;

const FRONT = [
  ['traps_up', el(50, 33, 19, 5)],
  ['delt_ant', el(28, 42, 7.5, 8.5, -14, true)],
  ['delt_lat', el(24, 47, 5, 7.5, -8, true)],
  ['chest', el(43, 51, 9, 8.5, 8, true)],
  ['serratus', el(37, 65, 3.5, 6.5, 0, true)],
  ['abs', rc(44, 57, 12, 33, 5)],
  ['oblique', el(39.5, 74, 4, 12, 0, true)],
  ['biceps', el(23, 59, 5, 10.5, -8, true)],
  ['forearm', el(19, 86, 4.5, 13, -6, true)],
  ['hipflex', el(45, 99, 5, 5.5, 0, true)],
  ['quad', el(44, 128, 7.5, 22, 2, true)],
  ['adductor', el(50, 122, 3.6, 15)],
  ['calf', el(42.5, 176, 5, 13, 0, true)],
];

const BACK = [
  ['neck', rc(46, 25, 8, 8, 3)],
  ['traps_up', pt('M50 27 30 38l3 16 17 4 17-4 3-16z')],
  ['traps_mid', rc(38, 54, 24, 18, 5)],
  ['delt_post', el(28, 42, 7.5, 8.5, -14, true)],
  ['rotator', el(33, 45, 4, 4.5, 0, true)],
  ['lats', pt('M36 60 34 86c0 6 7 10 16 10s16-4 16-10l-2-26-14 5z')],
  ['triceps', el(23, 59, 5, 10.5, -8, true)],
  ['forearm', el(19, 86, 4.5, 13, -6, true)],
  ['erector', rc(45, 62, 10, 32, 4)],
  ['glute', el(44, 106, 8.5, 8, 0, true)],
  ['abductor', el(36, 101, 4, 5, 0, true)],
  ['ham', el(44, 134, 7.5, 20, 0, true)],
  ['calf', el(42.5, 172, 5.5, 14, 0, true)],
];

function shape(sp, cls, label, flip = false) {
  const mx = v => (flip ? 100 - v : v);
  const title = `<title>${label}</title>`;
  if (sp.t === 'e') {
    const cx = mx(sp.cx);
    const rot = flip ? -sp.rot : sp.rot;
    return `<ellipse class="body-m ${cls}" cx="${cx}" cy="${sp.cy}" rx="${sp.rx}" ry="${sp.ry}"
      transform="rotate(${rot} ${cx} ${sp.cy})">${title}</ellipse>`;
  }
  if (sp.t === 'r') {
    return `<rect class="body-m ${cls}" x="${mx(sp.x + sp.w) - sp.w}" y="${sp.y}" width="${sp.w}"
      height="${sp.h}" rx="${sp.r}">${title}</rect>`;
  }
  return `<path class="body-m ${cls}" d="${sp.d}" ${flip ? 'transform="translate(100,0) scale(-1,1)"' : ''}>${title}</path>`;
}

/**
 * نقشهٔ بدن با ناحیه‌های رنگ‌شده.
 * @param {Record<string,number>} shares سهم تقریبی هر عضله (۰..۱۰۰)
 */
export function bodyMap(shares = {}) {
  const cls = k => {
    const v = shares[k] || 0;
    return v >= 30 ? 'p1' : v >= 12 ? 'p2' : v > 0 ? 'p3' : '';
  };
  const figure = (parts, label) => `
    <figure>
      <svg viewBox="0 0 100 210" width="100%" height="196" role="img" aria-label="${label}">
        ${SKELETON}
        ${parts.map(([k, sp]) => {
          const c = cls(k), name = MUSCLES[k]?.fa || k;
          return shape(sp, c, name) + (sp.m ? shape(sp, c, name, true) : '');
        }).join('')}
      </svg>
      <figcaption>${label}</figcaption>
    </figure>`;
  return `<div class="bodymap">
    ${figure(FRONT, 'نمای جلو')}
    ${figure(BACK, 'نمای پشت')}
  </div>`;
}

/** فهرست میله‌ای سهم عضلات، مرتب از بیشترین */
export function muscleBars(primary = {}, secondary = {}, stabil = []) {
  const rows = [
    ...Object.entries(primary).map(([k, v]) => ({ k, v, s: 1 })),
    ...Object.entries(secondary).map(([k, v]) => ({ k, v, s: 2 })),
  ].sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...rows.map(r => r.v));
  return rows.map(r => `
    <div class="mrow s${r.s}">
      <span style="min-width:78px">${muscleName(r.k)}</span>
      <span class="bar"><i style="width:${Math.round((r.v / max) * 100)}%"></i></span>
      <span class="pc">${r.v}٪</span>
    </div>`).join('')
    + (stabil.length ? `<div class="mrow s3">
        <span style="min-width:78px">تثبیت‌کننده</span>
        <span class="bar"><i style="width:22%"></i></span>
        <span class="pc" style="min-width:0">${stabil.map(muscleName).join('، ')}</span>
      </div>` : '');
}

/** همهٔ سهم‌ها در یک آبجکت، برای رنگ‌کردن بدن */
export function sharesOf(ex) {
  const out = { ...(ex?.primary || {}) };
  Object.entries(ex?.secondary || {}).forEach(([k, v]) => { out[k] = Math.max(out[k] || 0, v); });
  (ex?.stabil || []).forEach(k => { out[k] = Math.max(out[k] || 0, 6); });
  return out;
}
