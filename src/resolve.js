// ارث‌بری پارامترها و تخت‌کردن برنامه به «استپ»های قابل اجرا در باشگاه
import { progressFor, weekCount } from './progression.js';

const INHERIT = ['rest', 'tempo', 'rpe', 'rir', 'unit'];

function inherit(...layers) {
  const out = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const k of INHERIT) if (layer[k] !== undefined) out[k] = layer[k];
  }
  return out;
}

/**
 * برنامهٔ خام + شمارهٔ هفته → مدل نرمال‌شده که همهٔ پارامترها در آن نهایی‌اند.
 */
export function resolveProgram(program, week = 1, settings = {}) {
  const base = inherit(program.defaults);
  const days = (program.days || []).map((day, di) => {
    const dayBase = { ...base, ...inherit(day.defaults) };
    const blocks = (day.blocks || []).map((block, bi) => {
      const type = block.type || 'single';
      const blockBase = { ...dayBase, ...inherit(block) };
      const exercises = (block.exercises || []).map((ex, ei) =>
        resolveExercise(ex, { block, type, blockBase, week, program, settings, di, bi, ei }));
      const roundsFor = exercises[0]?.setCount ?? 1;
      return {
        index: bi, type,
        rounds: type === 'single' ? null : roundsFor,
        rest: block.rest ?? blockBase.rest ?? null,
        restBetweenExercises: block.restBetweenExercises ?? (type === 'single' ? null : 15),
        note: block.note || '',
        exercises,
      };
    });
    return { index: di, id: day.id || `d${di + 1}`, name: day.name, note: day.note || '', blocks };
  });
  return { name: program.name, note: program.note || '', week, weeks: weekCount(program), days };
}

function resolveExercise(ex, ctx) {
  const { block, type, blockBase, week, program, settings } = ctx;
  const own = inherit(ex);
  const merged = { ...blockBase, ...own };
  const prog = progressFor(ex, week, program, settings);

  let count = Array.isArray(ex.sets) ? ex.sets.length : (block.rounds ?? 1);
  count = Math.max(1, Math.round(count * (prog.roundsFactor || 1)));

  const sets = [];
  for (let i = 0; i < count; i++) {
    const raw = Array.isArray(ex.sets) ? (ex.sets[i] || ex.sets[ex.sets.length - 1]) : {};
    const s = { ...merged, ...inherit(raw) };
    sets.push({
      index: i,
      reps: raw.reps ?? prog.reps ?? ex.reps ?? null,
      weight: raw.weight ?? prog.weight ?? null,
      duration: raw.duration ?? ex.duration ?? null,
      distance: raw.distance ?? ex.distance ?? null,
      speed: raw.speed ?? ex.speed ?? null,
      incline: raw.incline ?? ex.incline ?? null,
      hrZone: raw.hrZone ?? ex.hrZone ?? null,
      rpe: s.rpe ?? null,
      rir: s.rir ?? null,
      // تمپو فقط برای حرکات تکراری معنا دارد
      tempo: (ex.mode || 'reps') === 'reps' ? (s.tempo ?? null) : null,
      rest: raw.rest ?? (type === 'single' ? (block.rest ?? merged.rest ?? null) : (block.rest ?? null)),
      technique: raw.technique ?? ex.technique ?? null,
      note: raw.note ?? null,
    });
  }

  return {
    key: `${ctx.di}-${ctx.bi}-${ctx.ei}`,
    name: ex.name,
    mode: ex.mode || 'reps',
    muscle: ex.muscle || '',
    equipment: ex.equipment || '',
    unit: merged.unit || 'kg',
    cue: ex.cue || '',
    media: ex.media || null,
    alternatives: Array.isArray(ex.alternatives) ? ex.alternatives : [],
    intervals: ex.intervals || null,
    technique: ex.technique || null,
    progressNote: prog.note,
    setCount: count,
    sets,
  };
}

const MARK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** برچسب A1/A2 برای سوپرست، A برای بلوک تکی */
export function markOf(blockIndex, exIndex, type) {
  const letter = MARK[blockIndex % MARK.length];
  return type === 'single' ? letter : `${letter}${exIndex + 1}`;
}

/**
 * روز نرمال‌شده → لیست خطی استپ‌ها به ترتیب اجرای واقعی در باشگاه.
 * سوپرست: A1 → A2 → استراحت → دور بعد.
 */
export function flattenDay(day) {
  const steps = [];
  day.blocks.forEach(block => {
    if (block.type === 'single') {
      block.exercises.forEach((ex, ei) => {
        ex.sets.forEach((set, si) => {
          steps.push(makeStep(block, ex, ei, set, si, ex.sets.length, set.rest));
        });
      });
    } else {
      const rounds = block.rounds || 1;
      for (let r = 0; r < rounds; r++) {
        block.exercises.forEach((ex, ei) => {
          const set = ex.sets[Math.min(r, ex.sets.length - 1)];
          const last = ei === block.exercises.length - 1;
          const rest = last ? (block.rest ?? set.rest) : block.restBetweenExercises;
          steps.push(makeStep(block, ex, ei, set, r, rounds, rest));
        });
      }
    }
  });
  return steps.map((s, i) => ({ ...s, i, total: steps.length }));
}

function makeStep(block, ex, ei, set, round, rounds, rest) {
  return {
    id: `${ex.key}-${round}`,
    blockIndex: block.index,
    blockType: block.type,
    mark: markOf(block.index, ei, block.type),
    ex, set, round, rounds,
    restAfter: rest ?? 0,
    kind: ex.mode === 'cardio' ? 'cardio' : (ex.mode === 'time' ? 'time' : 'reps'),
  };
}

/** تخمین مدت جلسه بر حسب ثانیه */
export function estimateDuration(day) {
  return flattenDay(day).reduce((sum, s) => {
    const work = s.kind === 'reps'
      ? Math.max(20, (Number(String(s.set.reps).split('-').pop()) || 10) * 4)
      : (s.set.duration || (s.ex.intervals
          ? s.ex.intervals.rounds * ((s.ex.intervals.work?.duration || 0) + (s.ex.intervals.recover?.duration || 0))
          : 60));
    return sum + work + (s.restAfter || 0);
  }, 0);
}

export function countSets(day) {
  return day.blocks.reduce((n, b) => n + b.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
}
