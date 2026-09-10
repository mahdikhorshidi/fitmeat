// اعتبارسنجی فایل برنامه (fitmeat/v1) با پیام فارسی و مسیر دقیق فیلد
import { repRange } from './util.js';

export const MODES = ['reps', 'time', 'cardio'];
export const BLOCK_TYPES = ['single', 'superset', 'circuit'];
export const TECHNIQUES = ['drop', 'restPause', 'cluster'];
export const PROGRESSIONS = ['none', 'linear', 'double', 'percent'];

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isPosInt = v => Number.isInteger(v) && v > 0;

export function validate(data) {
  const errors = [];
  const bad = (path, msg) => errors.push({ path, msg });

  if (!isObj(data)) {
    return { ok: false, errors: [{ path: '', msg: 'ریشهٔ فایل باید یک آبجکت JSON باشد.' }] };
  }
  if (data.schema && !String(data.schema).startsWith('fitmeat/')) {
    bad('schema', 'نسخهٔ اسکیما پشتیبانی نمی‌شود (انتظار: "fitmeat/v1").');
  }
  if (!data.name || typeof data.name !== 'string') bad('name', 'نام برنامه لازم است.');

  checkDefaults(data.defaults, 'defaults', bad);

  if (data.weeks !== undefined) {
    const w = data.weeks;
    if (!isObj(w)) bad('weeks', 'باید آبجکت باشد.');
    else {
      if (w.count !== undefined && !isPosInt(w.count)) bad('weeks.count', 'باید عدد صحیح مثبت باشد.');
      if (w.count > 52) bad('weeks.count', 'حداکثر ۵۲ هفته پشتیبانی می‌شود.');
      if (w.progression !== undefined) {
        const p = w.progression;
        if (!isObj(p)) bad('weeks.progression', 'باید آبجکت باشد.');
        else if (p.type && !PROGRESSIONS.includes(p.type)) {
          bad('weeks.progression.type', `باید یکی از ${PROGRESSIONS.join(' | ')} باشد.`);
        }
      }
      if (w.deload !== undefined && !isObj(w.deload)) bad('weeks.deload', 'باید آبجکت باشد.');
    }
  }

  if (!Array.isArray(data.days) || !data.days.length) {
    bad('days', 'حداقل یک روز تمرینی لازم است.');
    return { ok: false, errors };
  }

  data.days.forEach((day, di) => {
    const dp = `days[${di}]`;
    if (!isObj(day)) return bad(dp, 'باید آبجکت باشد.');
    if (!day.name) bad(`${dp}.name`, 'نام روز لازم است.');
    checkDefaults(day.defaults, `${dp}.defaults`, bad);
    if (!Array.isArray(day.blocks) || !day.blocks.length) {
      return bad(`${dp}.blocks`, 'حداقل یک بلوک تمرینی لازم است.');
    }
    day.blocks.forEach((block, bi) => {
      const bp = `${dp}.blocks[${bi}]`;
      if (!isObj(block)) return bad(bp, 'باید آبجکت باشد.');
      if (block.type && !BLOCK_TYPES.includes(block.type)) {
        bad(`${bp}.type`, `باید یکی از ${BLOCK_TYPES.join(' | ')} باشد.`);
      }
      if (block.rounds !== undefined && !isPosInt(block.rounds)) {
        bad(`${bp}.rounds`, 'تعداد دور باید عدد صحیح مثبت باشد.');
      }
      ['rest', 'restBetweenExercises'].forEach(k => {
        if (block[k] !== undefined && !(isNum(block[k]) && block[k] >= 0)) {
          bad(`${bp}.${k}`, 'باید عدد (ثانیه) و نامنفی باشد.');
        }
      });
      if (!Array.isArray(block.exercises) || !block.exercises.length) {
        return bad(`${bp}.exercises`, 'حداقل یک حرکت لازم است.');
      }
      const type = block.type || 'single';
      if (type !== 'single' && block.exercises.length < 2) {
        bad(`${bp}.exercises`, 'سوپرست/سیرکویت حداقل دو حرکت لازم دارد.');
      }
      block.exercises.forEach((ex, ei) => checkExercise(ex, `${bp}.exercises[${ei}]`, bad));
    });
  });

  return { ok: errors.length === 0, errors };
}

function checkDefaults(d, path, bad) {
  if (d === undefined) return;
  if (!isObj(d)) return bad(path, 'باید آبجکت باشد.');
  if (d.rest !== undefined && !(isNum(d.rest) && d.rest >= 0)) bad(`${path}.rest`, 'باید عدد (ثانیه) باشد.');
  if (d.tempo !== undefined) checkTempo(d.tempo, `${path}.tempo`, bad);
}

function checkTempo(t, path, bad) {
  if (typeof t !== 'string' || !/^\s*[\dxX]+([-/][\dxX]+){3}\s*$/.test(t)) {
    bad(path, 'قالب تمپو باید چهار بخشی باشد، مثل «3-1-1-0».');
  }
}

function checkExercise(ex, p, bad) {
  if (!isObj(ex)) return bad(p, 'باید آبجکت باشد.');
  if (!ex.name || typeof ex.name !== 'string') bad(`${p}.name`, 'نام حرکت لازم است.');

  const mode = ex.mode || 'reps';
  if (!MODES.includes(mode)) bad(`${p}.mode`, `باید یکی از ${MODES.join(' | ')} باشد.`);
  if (ex.tempo !== undefined) checkTempo(ex.tempo, `${p}.tempo`, bad);

  const sets = ex.sets;
  if (sets !== undefined && (!Array.isArray(sets) || !sets.length)) {
    bad(`${p}.sets`, 'اگر آورده شود باید آرایه‌ای غیرخالی از ست‌ها باشد.');
  }
  const anySet = k => Array.isArray(sets) && sets.every(s => isObj(s) && s[k] !== undefined);

  if (mode === 'reps') {
    if (ex.reps === undefined && !anySet('reps')) {
      bad(`${p}.reps`, 'برای حرکت تکراری، «reps» لازم است (عدد یا بازه مثل «8-10»).');
    } else if (ex.reps !== undefined && ex.reps !== 'AMRAP' && !repRange(ex.reps)) {
      bad(`${p}.reps`, 'قالب نامعتبر؛ عدد، بازه مثل «8-10» یا «AMRAP».');
    }
  }
  if (mode === 'time' && ex.duration === undefined && !anySet('duration')) {
    bad(`${p}.duration`, 'برای حرکت زمانی، «duration» (ثانیه) لازم است.');
  }
  if (mode === 'cardio') {
    const has = ['duration', 'distance', 'intervals'].some(k => ex[k] !== undefined);
    if (!has) bad(`${p}`, 'حرکت هوازی باید «duration» یا «distance» یا «intervals» داشته باشد.');
    if (ex.intervals !== undefined) {
      const iv = ex.intervals, ip = `${p}.intervals`;
      if (!isObj(iv)) bad(ip, 'باید آبجکت باشد.');
      else {
        if (!isPosInt(iv.rounds)) bad(`${ip}.rounds`, 'تعداد دور باید عدد صحیح مثبت باشد.');
        ['work', 'recover'].forEach(k => {
          if (!isObj(iv[k])) bad(`${ip}.${k}`, 'باید آبجکت با حداقل «duration» باشد.');
          else if (!(isNum(iv[k].duration) && iv[k].duration > 0)) {
            bad(`${ip}.${k}.duration`, 'باید عدد مثبت (ثانیه) باشد.');
          }
        });
      }
    }
  }

  if (ex.intensity !== undefined && ex.oneRM === undefined) {
    bad(`${p}.oneRM`, 'وقتی «intensity» (درصد ۱RM) داده می‌شود، «oneRM» هم لازم است.');
  }
  if (ex.media !== undefined) {
    if (!isObj(ex.media)) bad(`${p}.media`, 'باید آبجکت با کلیدهای image/gif/video باشد.');
    else {
      ['image', 'gif', 'video'].forEach(k => {
        if (ex.media[k] !== undefined && typeof ex.media[k] !== 'string') {
          bad(`${p}.media.${k}`, 'باید نشانی (URL) متنی باشد.');
        }
      });
    }
  }
  if (ex.alternatives !== undefined && !Array.isArray(ex.alternatives)) {
    bad(`${p}.alternatives`, 'باید آرایه‌ای از نام حرکات جایگزین باشد.');
  }
  if (ex.technique !== undefined) {
    const t = ex.technique, tp = `${p}.technique`;
    if (!isObj(t)) bad(tp, 'باید آبجکت باشد.');
    else if (!TECHNIQUES.includes(t.type)) bad(`${tp}.type`, `باید یکی از ${TECHNIQUES.join(' | ')} باشد.`);
    else if (t.type === 'drop' && (!Array.isArray(t.drops) || !t.drops.length)) {
      bad(`${tp}.drops`, 'دراپ‌ست حداقل یک مرحلهٔ کاهش وزنه لازم دارد.');
    }
  }
}

/** متن JSON را پارس و اعتبارسنجی می‌کند */
export function parseProgram(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ path: 'JSON', msg: `فایل JSON معتبر نیست: ${e.message}` }] };
  }
  const res = validate(data);
  return res.ok ? { ok: true, data, errors: [] } : { ...res, data };
}
