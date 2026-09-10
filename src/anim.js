// نمایش متحرک فرم حرکت — SVG ساخته‌شده در خود اپ (بدون GIF، بدون شبکه)
//
// قرارداد زاویه‌ها (همه بر حسب درجه، چرخش ساعت‌گرد مثبت):
//   t  زاویهٔ تنه؛ ۱۸۰ یعنی شانه دقیقاً بالای لگن (ایستاده)، ۱۲۰ یعنی ۶۰ درجه خم.
//   a  بازو نسبت به تنه؛ ۰ بالای سر، ۹۰ افقی، ۱۸۰ آویزان کنار بدن.
//   f  ساعد نسبت به بازو؛ ۰ یعنی آرنج صاف، منفی یعنی آرنج جمع.
//   k  ران نسبت به بدن؛ ۰ یعنی مستقیم پایین.   s  ساق نسبت به ران.
//   y  جابه‌جایی عمودی لگن (چون فیگور از لگن آویزان است، نشستن باید لگن را پایین ببرد).
//
// فیگور «شماتیک» است نه آناتومیک: هدف این است که کاربر در یک نگاه الگوی
// حرکت و دامنهٔ آن را بفهمد؛ جزئیات فرم در متن کنار همین تصویر می‌آید.

const L = { torso: 44, head: 8, upper: 23, fore: 22, thigh: 27, shin: 26, foot: 9 };

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

/** ژست شروع → ژست پایان */
const move = (from, to) => ({ from, to });

export const PATTERNS = {
  hpress: {
    fa: 'پرس افقی', prop: 'bench', load: 'bar', rot: -90,
    torso: move(180, 180), arm: move({ a: 112, f: -92 }, { a: 92, f: -4 }),
    leg: move({ k: -12, s: 96 }, { k: -12, s: 96 }), y: move(0, 0),
  },
  ipress: {
    fa: 'پرس بالاسینه', prop: 'incline', load: 'db', rot: -32,
    torso: move(180, 180), arm: move({ a: 116, f: -86 }, { a: 88, f: -6 }),
    leg: move({ k: 34, s: -40 }, { k: 34, s: -40 }), y: move(0, 0),
  },
  vpress: {
    fa: 'پرس سرشانه', prop: 'floor', load: 'bar',
    torso: move(180, 178), arm: move({ a: 104, f: -104 }, { a: 8, f: -4 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(0, 0),
  },
  fly: {
    fa: 'قفسه', prop: 'bench', load: 'db', rot: -90,
    torso: move(180, 180), arm: move({ a: 134, f: -14 }, { a: 92, f: -12 }),
    leg: move({ k: -12, s: 96 }, { k: -12, s: 96 }), y: move(0, 0),
  },
  hrow: {
    fa: 'پارویی (کشش افقی)', prop: 'floor', load: 'bar',
    torso: move(118, 118), arm: move({ a: 180, f: -6 }, { a: 152, f: -98 }),
    leg: move({ k: 14, s: -18 }, { k: 14, s: -18 }), y: move(6, 6),
  },
  vpull: {
    fa: 'کشش عمودی', prop: 'seat', load: 'bar',
    torso: move(174, 168), arm: move({ a: 14, f: -6 }, { a: 46, f: -84 }),
    leg: move({ k: 84, s: -84 }, { k: 84, s: -84 }), y: move(0, 0),
  },
  curl: {
    fa: 'جلوبازو', prop: 'floor', load: 'db',
    torso: move(180, 180), arm: move({ a: 178, f: -4 }, { a: 170, f: -142 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(0, 0),
  },
  ext: {
    fa: 'پشت‌بازو', prop: 'floor', load: 'rope',
    torso: move(178, 178), arm: move({ a: 174, f: -102 }, { a: 178, f: -6 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(0, 0),
  },
  raise: {
    fa: 'نشر', prop: 'floor', load: 'db',
    torso: move(180, 180), arm: move({ a: 176, f: -8 }, { a: 92, f: -8 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(0, 0),
  },
  shrug: {
    fa: 'کول', prop: 'floor', load: 'bar',
    torso: move(180, 180), arm: move({ a: 179, f: -2 }, { a: 179, f: -2 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(4, -4),
  },
  squat: {
    fa: 'اسکات', prop: 'floor', load: 'backbar',
    torso: move(180, 160), arm: move({ a: 46, f: -126 }, { a: 46, f: -126 }),
    leg: move({ k: 0, s: 0 }, { k: 48, s: -72 }), y: move(0, 14),
  },
  legpress: {
    fa: 'پرس پا', prop: 'sled', load: 'sled', rot: -90,
    torso: move(180, 180), arm: move({ a: 150, f: -30 }, { a: 150, f: -30 }),
    leg: move({ k: -6, s: -8 }, { k: 40, s: -92 }), y: move(0, 0),
  },
  hinge: {
    fa: 'لولای لگن / ددلیفت', prop: 'floor', load: 'bar',
    torso: move(176, 110), arm: move({ a: 180, f: -3 }, { a: 180, f: -3 }),
    leg: move({ k: 2, s: -4 }, { k: 16, s: -20 }), y: move(0, 4),
  },
  lunge: {
    fa: 'لانج', prop: 'floor', load: 'db',
    torso: move(179, 176), arm: move({ a: 179, f: -3 }, { a: 179, f: -3 }),
    leg: move({ k: 14, s: -10 }, { k: 40, s: -84 }), y: move(0, 15),
  },
  legext: {
    fa: 'جلو پا', prop: 'seat', load: 'pad',
    torso: move(178, 178), arm: move({ a: 148, f: -56 }, { a: 148, f: -56 }),
    leg: move({ k: 86, s: -88 }, { k: 86, s: -4 }), y: move(0, 0),
  },
  legcurl: {
    fa: 'پشت پا', prop: 'proneb', load: 'pad', rot: 90,
    torso: move(180, 180), arm: move({ a: 26, f: -12 }, { a: 26, f: -12 }),
    leg: move({ k: 0, s: -6 }, { k: 0, s: -112 }), y: move(0, 0),
  },
  calf: {
    fa: 'ساق پا', prop: 'floor', load: 'db',
    torso: move(180, 180), arm: move({ a: 179, f: -3 }, { a: 179, f: -3 }),
    leg: move({ k: 0, s: 0 }, { k: 0, s: 0 }), y: move(6, -7),
  },
  plank: {
    fa: 'پلانک', prop: 'floor', load: 'none', rot: -76,
    torso: move(180, 180), arm: move({ a: 92, f: -96 }, { a: 92, f: -92 }),
    leg: move({ k: 2, s: -2 }, { k: 2, s: -2 }), y: move(0, 1),
  },
  crunch: {
    fa: 'شکم', prop: 'floor', load: 'none', rot: -90,
    torso: move(178, 142), arm: move({ a: 24, f: -128 }, { a: 24, f: -128 }),
    leg: move({ k: -50, s: 104 }, { k: -50, s: 104 }), y: move(0, 0),
  },
  cardio: {
    fa: 'هوازی', prop: 'floor', load: 'none', split: true,
    torso: move(174, 174), arm: move({ a: 148, f: -66 }, { a: 208, f: -66 }),
    leg: move({ k: -26, s: -22 }, { k: 24, s: -74 }), y: move(2, -2),
  },
  stretch: {
    fa: 'کشش', prop: 'floor', load: 'none',
    torso: move(176, 138), arm: move({ a: 10, f: -6 }, { a: 24, f: -10 }),
    leg: move({ k: 2, s: -4 }, { k: 10, s: -12 }), y: move(0, 4),
  },
  generic: {
    fa: 'حرکت عمومی', prop: 'floor', load: 'db',
    torso: move(180, 180), arm: move({ a: 176, f: -10 }, { a: 96, f: -64 }),
    leg: move({ k: 0, s: 0 }, { k: 8, s: -14 }), y: move(0, 3),
  },
};

/** «دمبل» → شکل دمبل، «هالتر» → میله، «بدن» → بدون وسیله … */
function equipLoad(equip, fallback) {
  const q = String(equip || '');
  if (fallback === 'backbar' || fallback === 'sled' || fallback === 'pad') return fallback;
  if (/بدن|bodyweight/i.test(q)) return 'none';
  if (/دمبل|کتل|dumbbell/i.test(q)) return 'db';
  if (/هالتر|میله|barbell|اسمیت/i.test(q)) return 'bar';
  if (/سیم|کابل|قرقره|طناب|cable/i.test(q)) return 'rope';
  if (/دستگاه|machine/i.test(q)) return fallback === 'bar' ? 'rope' : fallback;
  return fallback;
}

let seq = 0;

function rotAnim(from, to, dur, flip) {
  if (reduced()) return '';
  const [x, y] = flip ? [to, from] : [from, to];
  return `<animateTransform attributeName="transform" type="rotate"
    values="${x} 0 0;${y} 0 0;${x} 0 0" keyTimes="0;0.5;1" dur="${dur}s"
    calcMode="spline" keySplines="0.45 0.05 0.35 1;0.45 0.05 0.35 1" repeatCount="indefinite"/>`;
}

function moveAnim(from, to, dur, flip) {
  if (reduced()) return '';
  const [x, y] = flip ? [to, from] : [from, to];
  return `<animateTransform attributeName="transform" type="translate"
    values="0 ${x};0 ${y};0 ${x}" keyTimes="0;0.5;1" dur="${dur}s"
    calcMode="spline" keySplines="0.45 0.05 0.35 1;0.45 0.05 0.35 1" repeatCount="indefinite"/>`;
}

/** وقتی انیمیشن خاموش است، میانهٔ دامنه را نشان بده تا حرکت قابل تشخیص بماند */
const still = (a, b) => (a + b) / 2;

function segment(len, w) {
  return `<line x1="0" y1="0" x2="0" y2="${len}" class="fig-line" stroke-width="${w}"/>`;
}

function loadShape(kind) {
  switch (kind) {
    case 'bar': return `<g class="fig-load"><rect x="-28" y="-3" width="56" height="6" rx="3"/>
      <rect x="-33" y="-10" width="7" height="20" rx="2"/><rect x="26" y="-10" width="7" height="20" rx="2"/></g>`;
    case 'db': return `<g class="fig-load"><rect x="-10" y="-3.5" width="20" height="7" rx="3"/>
      <rect x="-14" y="-8" width="5" height="16" rx="2"/><rect x="9" y="-8" width="5" height="16" rx="2"/></g>`;
    case 'rope': return `<g class="fig-load"><rect x="-9" y="-3" width="18" height="6" rx="3"/></g>`;
    case 'pad': return `<g class="fig-load"><rect x="-7" y="-6" width="14" height="12" rx="4"/></g>`;
    case 'sled': return `<g class="fig-load"><rect x="-4" y="-24" width="8" height="48" rx="4"/></g>`;
    default: return '';
  }
}

function propShapes(kind) {
  const pr = 'class="fig-prop" stroke-width="1.5"';
  switch (kind) {
    case 'bench': return `<rect x="26" y="118" width="132" height="11" rx="5" ${pr}/>
      <rect x="36" y="129" width="6" height="38" rx="3" ${pr}/><rect x="142" y="129" width="6" height="38" rx="3" ${pr}/>`;
    case 'incline': return `<g transform="rotate(-30 100 130)">
      <rect x="40" y="126" width="126" height="11" rx="5" ${pr}/></g>
      <rect x="150" y="132" width="6" height="36" rx="3" ${pr}/>`;
    case 'seat': return `<rect x="74" y="122" width="60" height="10" rx="5" ${pr}/>
      <rect x="126" y="78" width="9" height="46" rx="4" ${pr}/>
      <rect x="96" y="132" width="7" height="34" rx="3" ${pr}/>`;
    case 'proneb': return `<rect x="30" y="120" width="132" height="11" rx="5" ${pr}/>
      <rect x="40" y="131" width="6" height="36" rx="3" ${pr}/><rect x="146" y="131" width="6" height="36" rx="3" ${pr}/>`;
    case 'sled': return `<rect x="24" y="118" width="120" height="11" rx="5" ${pr}/>
      <rect x="164" y="56" width="12" height="104" rx="5" ${pr}/>`;
    default: return '';
  }
}

/**
 * @param {string} key کلید PATTERNS
 * @param {{speed?:number, tag?:string, height?:number, equip?:string}} opts
 */
export function demoSvg(key, opts = {}) {
  const spec = PATTERNS[key] || PATTERNS.generic;
  // وسیله از خودِ حرکت می‌آید، نه از الگو: پرس سینه با دمبل باید دمبل نشان دهد
  const p = opts.equip ? { ...spec, load: equipLoad(opts.equip, spec.load) } : spec;
  const dur = opts.speed || 3;
  const st = reduced();

  const rot = p.rot || 0;
  const ground = 170;
  const hipY = p.rot ? 116 : ground - L.thigh - L.shin - 6;
  const hipX = p.rot === -90 || p.rot === 90 ? 74 : 100;

  /**
   * یک فیگور کامل.
   * mode: 'anim' فیگور متحرک | 'ghost' سایهٔ ثابت در انتهای دامنه
   * flip: اندام مقابل (فقط برای لانج و دویدن که چپ و راست متفاوت‌اند)
   */
  const figure = (mode, flip = false) => {
    const ghost = mode === 'ghost';
    // ژست ثابتی که وقتی انیمیشن اجرا نمی‌شود دیده می‌شود
    const at = (from, to) => (ghost ? to : st ? (from + to) / 2 : from);
    const A = flip ? { from: p.arm.to, to: p.arm.from } : p.arm;
    const K = flip ? { from: p.leg.to, to: p.leg.from } : p.leg;
    const anim = (from, to, kind = 'rot') => {
      if (ghost || st) return '';
      return kind === 'rot' ? rotAnim(from, to, dur, false) : moveAnim(from, to, dur, false);
    };
    const legChain = () => `
      <g transform="rotate(${at(K.from.k, K.to.k)} 0 0)">
        ${anim(K.from.k, K.to.k)}
        ${segment(L.thigh, 8)}
        <g transform="translate(0,${L.thigh})">
          <g transform="rotate(${at(K.from.s, K.to.s)} 0 0)">
            ${anim(K.from.s, K.to.s)}
            ${segment(L.shin, 7)}
            <g transform="translate(0,${L.shin})">
              <line x1="0" y1="0" x2="${L.foot}" y2="0" class="fig-line" stroke-width="6"/>
            </g>
          </g>
        </g>
      </g>`;

    const armChain = () => `
      <g transform="rotate(${at(A.from.a, A.to.a)} 0 0)">
        ${anim(A.from.a, A.to.a)}
        ${segment(L.upper, 6.5)}
        <g transform="translate(0,${L.upper})">
          <g transform="rotate(${at(A.from.f, A.to.f)} 0 0)">
            ${anim(A.from.f, A.to.f)}
            ${segment(L.fore, 6)}
            <g transform="translate(0,${L.fore})">${loadShape(p.load)}</g>
          </g>
        </g>
      </g>`;

    return `
    <g class="${ghost ? 'fig-ghost' : ''}" transform="translate(${hipX},${hipY}) rotate(${rot})">
      <g transform="translate(0,${at(p.y.from, p.y.to)})">
        ${anim(p.y.from, p.y.to, 'mv')}
        ${legChain()}
        <g transform="rotate(${at(p.torso.from, p.torso.to)} 0 0)">
          ${anim(p.torso.from, p.torso.to)}
          ${segment(L.torso, 11)}
          <g transform="translate(0,${L.torso})">
            <circle cx="0" cy="${L.head + 4}" r="${L.head}" class="fig-head"/>
            ${p.load === 'backbar' ? `<g class="fig-load"><rect x="-28" y="-3" width="56" height="6" rx="3"/>
              <rect x="-33" y="-9" width="6" height="18" rx="2"/><rect x="27" y="-9" width="6" height="18" rx="2"/></g>` : ''}
            ${armChain()}
          </g>
        </g>
      </g>
    </g>`;
  };

  return `<div class="demo">
    ${opts.tag ? `<span class="demo-tag">${esc(opts.tag)}</span>` : ''}
    <svg viewBox="0 0 200 190" width="100%" height="${opts.height || 186}" role="img"
         aria-label="نمایش الگوی حرکتی ${esc(p.fa)} — سایهٔ کم‌رنگ، انتهای دامنهٔ حرکت است">
      <line x1="14" y1="${ground + 6}" x2="186" y2="${ground + 6}" class="fig-ground"/>
      ${propShapes(p.prop)}
      ${figure('ghost')}
      ${p.split ? figure('anim', true) : ''}
      ${figure('anim')}
    </svg>
  </div>`;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const patternName = k => (PATTERNS[k] || PATTERNS.generic).fa;
