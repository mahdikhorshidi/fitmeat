// دوره‌بندی چندهفته‌ای: هفته‌ها یک‌بار تعریف می‌شوند و تفاوت‌ها محاسبه می‌شود
import { repRange, ratio } from './util.js';
import { roundToAchievable } from './plates.js';

export function weekCount(program) {
  const c = program?.weeks?.count;
  return Number.isInteger(c) && c > 0 ? c : 1;
}

export function isDeload(program, week) {
  const d = program?.weeks?.deload;
  if (!d) return false;
  const w = d.week ?? d.weeks;
  return Array.isArray(w) ? w.includes(week) : w === week;
}

/**
 * وزنه/تکرار پایهٔ یک حرکت را برای هفتهٔ داده‌شده تنظیم می‌کند.
 * @returns {{weight:number|null, reps:*, roundsFactor:number, note:string}}
 */
export function progressFor(ex, week, program, settings) {
  const cfg = { type: 'none', increment: 2.5, ...(program?.weeks?.progression || {}) };
  const rule = ex.progression ? { ...cfg, ...ex.progression } : cfg;
  const idx = Math.max(0, (week || 1) - 1);

  let weight = baseWeight(ex, week, rule, settings);
  let reps = ex.reps;
  let note = '';

  if (rule.type === 'linear' && weight != null && idx > 0) {
    weight += (rule.increment || 2.5) * idx;
    note = 'پیشرفت خطی';
  } else if (rule.type === 'double') {
    const r = repRange(ex.reps);
    if (r) {
      const span = Math.max(1, r.high - r.low + 1);
      reps = r.low + (idx % span);
      if (weight != null) weight += (rule.increment || 2.5) * Math.floor(idx / span);
      note = 'پیشرفت دوگانه (اول تکرار، بعد وزنه)';
    }
  }

  let roundsFactor = 1;
  if (isDeload(program, week)) {
    const d = program.weeks.deload;
    roundsFactor = ratio(d.volume) ?? 1;
    if (weight != null) weight *= (ratio(d.intensity) ?? 1);
    note = 'هفتهٔ دیلود';
  }

  if (weight != null) weight = roundWeight(weight, ex, settings);
  return { weight, reps, roundsFactor, note };
}

function baseWeight(ex, week, rule, settings) {
  if (rule.type === 'percent' && ex.oneRM != null) {
    const list = rule.percents || [];
    const pct = ratio(list[(week || 1) - 1] ?? ex.intensity);
    if (pct) return ex.oneRM * pct;
  }
  if (ex.intensity != null && ex.oneRM != null) {
    const pct = ratio(ex.intensity);
    if (pct) return ex.oneRM * pct;
  }
  return typeof ex.weight === 'number' ? ex.weight : null;
}

function roundWeight(weight, ex, settings) {
  const eq = String(ex.equipment || '');
  const barbell = /هالتر|میله|barbell|smith|اسمیت/i.test(eq);
  if (barbell && settings) return roundToAchievable(weight, settings.bar, settings.plates);
  return Math.round(weight * 4) / 4;
}
