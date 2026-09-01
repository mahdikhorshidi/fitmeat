// خلاصه‌سازی: هر چیزی که تکرار می‌شود ادغام یا به هدر منتقل می‌شود
import { fa, num, dur, durShort, clock } from './util.js';

const SIG_KEYS = ['reps', 'weight', 'duration', 'distance', 'speed', 'incline', 'hrZone', 'rpe', 'rir', 'tempo', 'rest'];
const sig = s => SIG_KEYS.map(k => `${k}:${s[k] ?? ''}`).join('|') + `|t:${s.technique ? s.technique.type : ''}`;

/** ست‌های متوالی با پارامتر یکسان را در یک گروه ادغام می‌کند */
export function groupSets(sets) {
  const groups = [];
  sets.forEach(s => {
    const last = groups[groups.length - 1];
    if (last && last.sig === sig(s)) last.n++;
    else groups.push({ sig: sig(s), n: 1, set: s });
  });
  return groups;
}

/** مقدار یک پارامتر برای کل یک حرکت (اگر بین ست‌ها فرق کند، یکتا در نظر گرفته می‌شود) */
function exValue(ex, k) {
  const vals = [...new Set(ex.sets.map(s => s[k] ?? null))];
  return vals.length === 1 ? vals[0] : Symbol.for(`mixed:${k}:${ex.key}`);
}

/**
 * مقدار غالب هر پارامتر در بلوک: اگر بیشتر حرکات یک مقدار مشترک دارند،
 * آن مقدار یک‌بار به هدر می‌رود و فقط استثناها در ردیف‌ها نوشته می‌شوند.
 */
function dominantParams(block) {
  const out = {};
  ['rest', 'tempo', 'rpe', 'rir'].forEach(k => {
    const vals = block.exercises.map(ex => exValue(ex, k)).filter(v => v != null && v !== '');
    if (!vals.length) return;
    const counts = new Map();
    vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    let best = null, n = 0;
    counts.forEach((c, v) => { if (c > n) { best = v; n = c; } });
    if (typeof best === 'symbol') return;
    const all = n === block.exercises.length;
    if (all || (n >= 2 && n / block.exercises.length >= 0.5)) out[k] = { value: best, all };
  });
  return out;
}

/**
 * بلوک‌های «تکی» پشت‌سرهم را در یک جدول ادغام می‌کند تا هدر و ستون‌ها تکرار نشوند.
 * برچسب هر حرکت (A/B/C) از بلوک اصلی خودش می‌آید.
 */
export function mergeBlocks(blocks) {
  const out = [];
  blocks.forEach(b => {
    const exercises = b.exercises.map((e, ei) => ({ ...e, _mark: markOf(b.index, ei, b.type) }));
    const prev = out[out.length - 1];
    if (b.type === 'single' && prev && prev.type === 'single' && !b.note && !prev.note) {
      prev.exercises = prev.exercises.concat(exercises);
      prev.merged = true;
    } else {
      out.push({ ...b, exercises });
    }
  });
  return out;
}

function markOf(blockIndex, exIndex, type) {
  const letter = 'ABCDEFGH'[blockIndex % 8];
  return type === 'single' ? letter : `${letter}${exIndex + 1}`;
}

export function condenseBlock(block) {
  const common = dominantParams(block);
  const def = k => (common[k] ? common[k].value : undefined);
  const pre = k => (common[k] && !common[k].all ? 'پیش‌فرض ' : '');
  const showCount = block.type === 'single';   // در سوپرست تعداد دور در هدر است

  const header = [];
  if (block.type !== 'single') header.push({ text: `${fa(block.rounds)} دور`, cls: 'accent' });
  if (def('rest')) header.push({ text: `${pre('rest')}استراحت ${dur(def('rest'))}`, cls: '' });
  if (block.type !== 'single' && block.restBetweenExercises) {
    header.push({ text: `بین حرکات ${dur(block.restBetweenExercises)}`, cls: '' });
  }
  if (def('tempo')) header.push({ text: `${pre('tempo')}تمپو ${fa(def('tempo'))}`, cls: '' });
  if (def('rpe') != null) header.push({ text: `${pre('rpe')}RPE ${fa(def('rpe'))}`, cls: '' });
  if (def('rir') != null) header.push({ text: `${pre('rir')}RIR ${fa(def('rir'))}`, cls: '' });

  const rows = block.exercises.map((ex, ei) => {
    const groups = groupSets(ex.sets);
    return {
      key: ex.key,
      mark: markFor(block, ei),
      name: ex.name,
      sub: [ex.muscle, ex.equipment].filter(Boolean).join(' · '),
      dose: doseText(ex, groups, showCount),
      rest: exValue(ex, 'rest') === def('rest') ? '' : restText(ex),
      tempo: exValue(ex, 'tempo') === def('tempo') ? '' : (tempoText(ex) && `تمپو ${tempoText(ex)}`),
      effort: effortText(ex, common, def),
      chips: chipsFor(ex),
      alts: ex.alternatives.length ? `${fa(ex.alternatives.length)} جایگزین` : '',
      ex,
    };
  });

  const cols = {
    rest: rows.some(r => r.rest),
    tempo: rows.some(r => r.tempo),
    effort: rows.some(r => r.effort),
  };
  return { header, rows, cols, type: block.type, note: block.note };
}

function markFor(block, ei) {
  return block.exercises[ei]?._mark ?? markOf(block.index, ei, block.type);
}

function restText(ex) {
  const vals = [...new Set(ex.sets.map(s => s.rest).filter(v => v))];
  if (!vals.length) return '';
  return `استراحت ${vals.length === 1 ? durShort(vals[0]) : vals.map(durShort).join('/')}`;
}

function tempoText(ex) {
  const vals = [...new Set(ex.sets.map(s => s.tempo).filter(Boolean))];
  return vals.map(fa).join('/');
}

function effortText(ex, common, def) {
  if (exValue(ex, 'rpe') === def('rpe') && exValue(ex, 'rir') === def('rir')) return '';
  const rpe = [...new Set(ex.sets.map(s => s.rpe).filter(v => v != null))];
  if (rpe.length) return `RPE ${rpe.map(fa).join('/')}`;
  const rir = [...new Set(ex.sets.map(s => s.rir).filter(v => v != null))];
  if (rir.length) return `RIR ${rir.map(fa).join('/')}`;
  return '';
}

function chipsFor(ex) {
  const out = [];
  const t = ex.technique;
  if (t) out.push({ text: TECH_LABEL[t.type] || t.type, cls: 'warm' });
  if (ex.mode === 'cardio') out.push({ text: 'هوازی', cls: 'info' });
  if (ex.mode === 'time') out.push({ text: 'زمانی', cls: 'info' });
  return out;
}

export const TECH_LABEL = { drop: 'دراپ‌ست', restPause: 'رست‌پاز', cluster: 'کلاستر' };

/** متن فشردهٔ ست‌ها: «۴ × ۸-۱۰ @ ۶۰kg» یا «۱۲/۱۰/۸ @ ۴۰/۵۰/۶۰» */
export function doseText(ex, groups, showCount) {
  if (ex.mode === 'cardio') return cardioText(ex);
  const uniform = groups.length === 1;
  const unit = ex.unit || 'kg';

  if (uniform) {
    const s = groups[0].set;
    const core = ex.mode === 'time' ? dur(s.duration) : fa(s.reps ?? '—');
    const load = s.weight != null ? ` @ ${fa(num(s.weight))}${unit}` : '';
    return showCount && groups[0].n > 1 ? `${fa(groups[0].n)} × ${core}${load}` : `${core}${load}`;
  }

  const parts = groups.map(g => (ex.mode === 'time'
    ? fa(g.set.duration)
    : fa(g.set.reps ?? '—')) + (g.n > 1 ? `×${fa(g.n)}` : ''));
  const weights = groups.map(g => (g.set.weight != null ? fa(num(g.set.weight)) : '—'));
  const sameW = new Set(weights).size === 1;
  const load = weights[0] === '—' ? ''
    : ` @ ${sameW ? weights[0] : weights.join('/')}${unit}`;
  return parts.join('/') + load;
}

function cardioText(ex) {
  const iv = ex.intervals;
  if (iv) {
    const w = iv.work || {}, r = iv.recover || {};
    return `${fa(iv.rounds)} × (${clock(w.duration)} تند / ${clock(r.duration)} آرام)`;
  }
  const s = ex.sets[0] || {};
  const bits = [];
  if (s.duration) bits.push(dur(s.duration));
  if (s.distance) bits.push(`${fa(num(s.distance))} متر`);
  if (s.speed) bits.push(`${fa(num(s.speed))} km/h`);
  if (s.incline) bits.push(`شیب ${fa(num(s.incline))}٪`);
  if (s.hrZone) bits.push(`ضربان ${fa(s.hrZone)}`);
  return bits.join(' · ') || '—';
}

/** اختلاف وزنهٔ هفتهٔ جاری با هفتهٔ قبل، برای نمایش دلتا به‌جای تکرار جدول */
export function weekDeltas(current, previous) {
  const map = new Map();
  if (!previous) return map;
  const flat = p => {
    const m = new Map();
    p.days.forEach(d => d.blocks.forEach(b => b.exercises.forEach(e => m.set(e.key, e.sets[0]))));
    return m;
  };
  const prev = flat(previous);
  flat(current).forEach((set, key) => {
    const old = prev.get(key);
    if (!old) return;
    if (set.weight != null && old.weight != null && set.weight !== old.weight) {
      map.set(key, { type: 'weight', diff: +(set.weight - old.weight).toFixed(2) });
    } else if (String(set.reps) !== String(old.reps)) {
      map.set(key, { type: 'reps', from: old.reps, to: set.reps });
    }
  });
  return map;
}
