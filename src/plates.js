// ماشین‌حساب وزنهٔ میله: چه صفحاتی هر طرف میله بگذاریم
export function smallestStep(plates) {
  const min = Math.min(...plates.filter(p => p > 0));
  return Number.isFinite(min) ? min * 2 : 2.5;
}

/** نزدیک‌ترین وزنهٔ قابل‌ساخت با صفحات موجود */
export function roundToAchievable(weight, bar, plates) {
  if (!Number.isFinite(weight)) return weight;
  if (weight <= bar) return Math.max(0, Math.round(weight * 100) / 100);
  const step = smallestStep(plates);
  return Math.max(bar, bar + Math.round((weight - bar) / step) * step);
}

/**
 * @returns {{perSide:{w:number,n:number}[], achieved:number, exact:boolean}|null}
 * null یعنی وزنه از خود میله کمتر است (دمبل/دستگاه) و محاسبه معنا ندارد.
 */
export function computePlates(target, bar, plates) {
  if (!Number.isFinite(target) || target < bar) return null;
  let rest = (target - bar) / 2;
  const sorted = [...plates].filter(p => p > 0).sort((a, b) => b - a);
  const perSide = [];
  for (const p of sorted) {
    const n = Math.floor((rest + 1e-6) / p);
    if (n > 0) { perSide.push({ w: p, n }); rest -= n * p; }
  }
  const achieved = target - rest * 2;
  return { perSide, achieved: Math.round(achieved * 100) / 100, exact: rest < 1e-6 };
}
