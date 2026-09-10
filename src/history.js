// تاریخچهٔ جلسات: «آخرین بار» و رکورد شخصی هر حرکت
import { store } from './store.js';

export const est1RM = (w, r) => (w && r ? w * (1 + r / 30) : 0);

/** @param {string} [athlete] وقتی داده شود فقط رکوردهای همان ورزشکار برمی‌گردد */
function entriesOf(name, athlete) {
  const out = [];
  store.sessions().forEach(s => {
    (s.entries || []).forEach(e => {
      if (e.exercise !== name) return;
      if (athlete && (e.athlete || 'a') !== athlete) return;
      out.push({ ...e, sessionAt: s.startedAt, sessionId: s.id });
    });
  });
  return out;
}

/** بهترین ست آخرین جلسه‌ای که این حرکت در آن انجام شده */
export function lastFor(name, athlete) {
  const all = entriesOf(name, athlete);
  if (!all.length) return null;
  const latest = Math.max(...all.map(e => e.sessionAt || 0));
  const sameDay = all.filter(e => e.sessionAt === latest);
  const best = sameDay.reduce((a, b) =>
    (est1RM(b.weight, b.reps) > est1RM(a.weight, a.reps) ? b : a), sameDay[0]);
  return { ...best, sets: sameDay.length, at: latest };
}

/** رکورد شخصی: بیشترین وزنه و بیشترین ۱RM تخمینی */
export function prFor(name, athlete) {
  const all = entriesOf(name, athlete).filter(e => e.weight != null);
  if (!all.length) return null;
  const byWeight = all.reduce((a, b) => (b.weight > a.weight ? b : a));
  const by1RM = all.reduce((a, b) => (est1RM(b.weight, b.reps) > est1RM(a.weight, a.reps) ? b : a));
  return { weight: byWeight.weight, reps: byWeight.reps, e1rm: Math.round(est1RM(by1RM.weight, by1RM.reps)) };
}

/** آیا این ست رکورد جدید است؟ */
export function isPR(name, weight, reps, athlete) {
  if (weight == null) return false;
  const pr = prFor(name, athlete);
  if (!pr) return true;
  return weight > pr.weight || est1RM(weight, reps) > pr.e1rm + 0.01;
}
