// مود باشگاه: اجرای مرحله‌به‌مرحله، تایمر استراحت، ثبت عملکرد
import { store } from '../store.js';
import { resolveProgram, flattenDay } from '../resolve.js';
import { esc, fa, num, dur, clock, clamp, safeUrl } from '../util.js';
import { toast, sheet, confirmSheet, dismissSheet } from '../ui.js';
import { Countdown, Screen, cue, primeAudio, beep } from '../timer.js';
import { computePlates } from '../plates.js';
import { lastFor, prFor, isPR } from '../history.js';
import { techniqueText } from './program.js';
import { TECH_LABEL } from '../condense.js';
import { weekOf } from './program.js';
import { mountMedia } from '../media.js';

let S = null;          // وضعیت جلسه (پایدار در localStorage)
let steps = [];        // استپ‌های تخت‌شدهٔ روز
let rest = null;       // تایمر استراحت جاری
let work = null;       // تایمر حرکت زمانی/هوازی
let tempo = null;      // شمارندهٔ کششی
const screen = new Screen();

export function gymView({ id, dayId }) {
  const program = store.program(id);
  if (!program) { location.hash = '/'; return; }
  const week = weekOf(id);
  const model = resolveProgram(program, week, store.settings());
  const day = model.days.find(d => d.id === dayId);
  if (!day) { location.hash = `/p/${id}`; return; }

  const live = store.live();
  if (live && live.programId === id && live.dayId === dayId) {
    S = live;
  } else if (live) {
    confirmSheet('جلسهٔ ناتمام', 'یک جلسهٔ ناتمام دیگر باز است. آن را رها کنم و این جلسه را شروع کنم؟',
      { danger: true, okText: 'شروع جلسهٔ جدید' }).then(ok => {
        if (ok) { store.setLive(null); gymView({ id, dayId }); }
        else location.hash = `/gym/${live.programId}/${live.dayId}`;
      });
    return;
  } else {
    S = fresh(id, dayId, week);
  }

  build(day);
  primeAudio();
  screen.on();
  render(program, day);
  return { cleanup };
}

function fresh(programId, dayId, week) {
  return {
    programId, dayId, week, i: 0, startedAt: Date.now(),
    entries: [], subs: {}, skipped: [], extras: {}, phase: 'work',
  };
}

function build(day) {
  let list = flattenDay(day);
  // ست‌های اضافه‌شده در لحظه
  Object.entries(S.extras || {}).forEach(([key, n]) => {
    for (let k = 0; k < n; k++) {
      const src = [...list].reverse().find(s => s.ex.key === key);
      if (!src) continue;
      const at = list.lastIndexOf(src);
      list.splice(at + 1, 0, { ...src, id: `${src.id}-x${k}`, extra: true });
    }
  });
  list = list.filter(s => !(S.skipped || []).includes(s.ex.key));
  steps = list.map((s, i) => ({ ...s, i, total: list.length }));
  S.i = clamp(S.i, 0, Math.max(0, steps.length - 1));
  save();
}

const save = () => store.setLive(S);

function cleanup() {
  rest?.stop(); rest = null;
  work?.stop(); work = null;
  stopTempo();
  screen.off();
}

const nameOf = step => S.subs[step.ex.key] || step.ex.name;

/* ---------- رندر ---------- */

function render(program, day) {
  // تایمرهای استپ قبلی نباید به استپ بعد سرایت کنند
  work?.stop(); work = null;
  stopTempo();
  const app = document.getElementById('app');
  if (!steps.length) { finish(program, day); return; }
  const done = S.entries.length;
  const step = steps[S.i];
  const pct = Math.round((S.i / steps.length) * 100);

  app.innerHTML = `
  <section class="gym">
    <div class="gym-top">
      <button class="iconbtn" data-exit aria-label="خروج">✕</button>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <span class="small num muted">${fa(S.i + 1)}/${fa(steps.length)}</span>
      <button class="iconbtn" data-more aria-label="گزینه‌ها">⋯</button>
    </div>
    <div class="gym-body">${S.phase === 'rest' ? restBody(step) : workBody(step)}</div>
    <div class="gym-foot">${S.phase === 'rest' ? restFoot() : workFoot(step)}</div>
  </section>`;

  const $ = sel => app.querySelector(sel);
  const all = sel => app.querySelectorAll(sel);

  $('[data-exit]').onclick = async () => {
    if (await confirmSheet('خروج از تمرین', 'جلسه ذخیره می‌شود و بعداً می‌توانید ادامه دهید.', { okText: 'خروج' })) {
      cleanup(); location.hash = `/p/${program.id}/d/${day.id}`;
    }
  };
  $('[data-more]').onclick = () => moreMenu(program, day);

  if (S.phase === 'rest') {
    $('[data-skip-rest]').onclick = () => { rest?.stop(); nextStep(program, day); };
    all('[data-rest-adj]').forEach(b => b.onclick = () => { rest?.add(+b.dataset.restAdj); });
    startRest(step, program, day);
    return;
  }

  // فاز کار
  all('[data-step]').forEach(b => b.onclick = () => {
    const dir = +b.dataset.step;
    S.i = clamp(S.i + dir, 0, steps.length - 1);
    S.phase = 'work'; save(); render(program, day);
  });
  $('[data-info]')?.addEventListener('click', () => infoSheet(step));
  $('[data-tempo]')?.addEventListener('click', e => toggleTempo(e.currentTarget, step));
  $('[data-plates]')?.addEventListener('click', () => platesSheet(step, valOf('weight')));
  all('[data-inc]').forEach(b => b.onclick = () => {
    const input = app.querySelector(`#f-${b.dataset.field}`);
    const stepSize = +b.dataset.inc;
    const v = (parseFloat(input.value) || 0) + stepSize;
    input.value = num(Math.max(0, Math.round(v * 100) / 100));
  });
  all('[data-micro]').forEach(b => b.onclick = () => { b.classList.toggle('done'); beep(700, 60, 0.04); });
  $('[data-timer]')?.addEventListener('click', e => runWorkTimer(e.currentTarget, step));
  $('[data-done]').onclick = () => complete(program, day);

  function valOf(field) { return parseFloat(app.querySelector(`#f-${field}`)?.value) || null; }
}

function workBody(step) {
  const { ex, set } = step;
  const last = lastFor(nameOf(step));
  const pr = prFor(nameOf(step));
  const unit = ex.unit || 'kg';
  const nextStepEl = steps[step.i + 1];

  return `
  <div class="step-ctx">
    ${esc(step.mark)} · ${step.blockType === 'single' ? 'ست' : 'دور'} ${fa(step.round + 1)} از ${fa(step.rounds)}
    ${step.extra ? ' · ست اضافه' : ''}
  </div>
  <h2 class="step-title">${esc(nameOf(step))}</h2>
  ${S.subs[ex.key] ? `<div class="small muted">جایگزین «${esc(ex.name)}»</div>` : ''}

  <div class="target">
    ${step.kind === 'reps' ? `
      <div class="lbl">هدف</div>
      <div class="big">${fa(set.reps ?? '—')}${set.weight != null ? ` <span style="font-size:22px">× ${fa(num(set.weight))}${esc(unit)}</span>` : ''}</div>`
    : step.kind === 'time' ? `
      <div class="lbl">هدف</div>
      <div class="big">${clock(set.duration)}</div>`
    : `
      <div class="lbl">هوازی</div>
      <div class="big" style="font-size:26px">${esc(cardioTarget(ex, set))}</div>`}
    ${set.rpe != null ? `<div class="small muted">شدت هدف: RPE ${fa(set.rpe)}</div>` : ''}
    ${set.rir != null ? `<div class="small muted">شدت هدف: ${fa(set.rir)} تکرار ذخیره</div>` : ''}
  </div>

  ${last ? `<div class="hint">آخرین بار: <b>${fa(last.reps ?? '—')}${last.weight != null ? ` × ${fa(num(last.weight))}${esc(unit)}` : ''}</b>
    ${pr ? ` · رکورد: ${fa(num(pr.weight))}${esc(unit)}` : ''}</div>` : ''}

  ${set.tempo ? tempoStrip(set.tempo) : ''}
  ${ex.technique ? microList(ex.technique) : ''}
  ${ex.cue ? `<div class="hint"><b>فرم:</b> ${esc(ex.cue)}</div>` : ''}

  ${step.kind === 'reps' ? `
    <div class="grid2">
      <div class="field"><label>تکرار انجام‌شده</label>${stepper('reps', defaultReps(step, last), 1)}</div>
      <div class="field"><label>وزنه (${esc(unit)})</label>${stepper('weight', defaultWeight(step, last), 2.5)}</div>
    </div>
    ${set.weight != null ? `<button class="btn sm" data-plates>🏋️ صفحات میله</button>` : ''}`
  : `<button class="btn block" data-timer data-seconds="${step.kind === 'time' ? (set.duration || 0) : 0}">
      ${step.kind === 'time' ? '▶ شروع تایمر حرکت' : '▶ شروع تایمر هوازی'}
    </button>
    <div id="work-timer" class="center num" style="font-size:36px;font-weight:900"></div>`}

  ${nextStepEl ? `<div class="small muted">بعدی: ${esc(nameOf(nextStepEl))}</div>` : `<div class="small muted">آخرین ست جلسه 💪</div>`}`;
}

function workFoot(step) {
  return `
    <button class="btn" data-step="-1" ${step.i === 0 ? 'disabled' : ''} aria-label="قبلی">‹</button>
    <button class="btn primary" style="flex:1" data-done>ثبت و ادامه ✓</button>
    <button class="btn" data-step="1" ${step.i >= steps.length - 1 ? 'disabled' : ''} aria-label="بعدی">›</button>`;
}

function restBody(step) {
  const next = steps[S.i + 1];
  return `
    <div class="center small muted">استراحت</div>
    <div class="rest" aria-live="polite">
      <svg viewBox="0 0 100 100" width="190" height="190">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
        <circle id="ring" cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="0"/>
      </svg>
      <div><div class="t" id="rest-t">${clock(step.restAfter)}</div><div class="l">تا ست بعد</div></div>
    </div>
    ${next ? `<div class="card center">
      <div class="small muted">بعدی</div>
      <div style="font-weight:800;font-size:17px">${esc(nameOf(next))}</div>
      <div class="small muted">${esc(next.mark)} · ${next.kind === 'reps' ? `${fa(next.set.reps ?? '—')} تکرار` : clock(next.set.duration)}</div>
    </div>` : '<div class="card center">آخرین استراحت — بعد از این، جلسه تمام است.</div>'}`;
}

function restFoot() {
  return `
    <button class="btn" data-rest-adj="-15">−۱۵ث</button>
    <button class="btn primary" style="flex:1" data-skip-rest>رد کردن استراحت</button>
    <button class="btn" data-rest-adj="15">+۱۵ث</button>`;
}

function cardioTarget(ex, set) {
  if (ex.intervals) {
    const iv = ex.intervals;
    return `${fa(iv.rounds)} × (${clock(iv.work?.duration)} تند / ${clock(iv.recover?.duration)} آرام)`;
  }
  return [set.duration && dur(set.duration), set.distance && `${fa(num(set.distance))} متر`,
    set.speed && `${fa(num(set.speed))} km/h`, set.incline && `شیب ${fa(num(set.incline))}٪`,
    set.hrZone && `ضربان ${fa(set.hrZone)}`].filter(Boolean).join(' · ');
}

function stepper(field, value, inc) {
  return `<div class="stepper">
    <button data-inc="-${inc}" data-field="${field}" aria-label="کم">−</button>
    <input id="f-${field}" class="num" type="number" inputmode="decimal" step="any" value="${value ?? ''}">
    <button data-inc="${inc}" data-field="${field}" aria-label="زیاد">+</button>
  </div>`;
}

function defaultReps(step, last) {
  const r = step.set.reps;
  if (typeof r === 'number') return r;
  const m = String(r ?? '').match(/(\d+)\s*$/);
  return m ? +m[1] : (last?.reps ?? '');
}
function defaultWeight(step, last) {
  return step.set.weight != null ? num(step.set.weight) : (last?.weight != null ? num(last.weight) : '');
}

function tempoStrip(t) {
  const parts = String(t).split(/[-/]/);
  const labels = ['پایین', 'مکث', 'بالا', 'مکث'];
  return `<button data-tempo class="tempo-strip" style="width:100%;border:0;padding:0;background:none" aria-label="شمارندهٔ تمپو">
    ${parts.map((p, i) => `<div data-phase="${i}"><span class="n">${fa(p)}</span>${labels[i]}</div>`).join('')}
  </button>`;
}

function microList(t) {
  const items = t.type === 'drop'
    ? t.drops.map((d, i) => `دراپ ${fa(i + 1)}: کاهش ${esc(String(d.reduce ?? ''))} تا ${esc(String(d.reps ?? 'ناتوانی'))}`)
    : t.type === 'restPause'
      ? Array.from({ length: (t.pauses ?? 2) }, (_, i) => `وقفهٔ ${fa(i + 1)}: ${fa(t.rest ?? 15)} ثانیه مکث، سپس تا ناتوانی`)
      : Array.from({ length: (t.clusters ?? 4) }, (_, i) => `خوشهٔ ${fa(i + 1)}: ${fa(t.repsPer ?? 2)} تکرار`);
  return `<div>
    <div class="small muted" style="margin-bottom:6px">${esc(TECH_LABEL[t.type] || t.type)}</div>
    <div class="micro">${items.map(x => `<button data-micro><span class="bx">✓</span><span>${x}</span></button>`).join('')}</div>
  </div>`;
}

/* ---------- تعامل ---------- */

function startRest(step, program, day) {
  rest?.stop();
  const seconds = step.restAfter || 0;
  if (!seconds) return nextStep(program, day);
  const t = document.getElementById('rest-t');
  const ring = document.getElementById('ring');
  rest = new Countdown({
    seconds,
    onTick: (left, total) => {
      if (t) t.textContent = clock(left);
      if (ring) ring.style.strokeDashoffset = String(283 * (1 - left / total));
    },
    onEnd: () => { cue.go(); nextStep(program, day); },
  });
}

function nextStep(program, day) {
  rest?.stop(); rest = null;
  if (S.i >= steps.length - 1) return finish(program, day);
  S.i += 1; S.phase = 'work'; save();
  render(program, day);
}

function complete(program, day) {
  const step = steps[S.i];
  const app = document.getElementById('app');
  const reps = parseFloat(app.querySelector('#f-reps')?.value);
  const weight = parseFloat(app.querySelector('#f-weight')?.value);
  const name = nameOf(step);

  const entry = {
    exercise: name, mode: step.kind, stepId: step.id, at: Date.now(),
    reps: Number.isFinite(reps) ? reps : null,
    weight: Number.isFinite(weight) ? weight : null,
    duration: step.kind !== 'reps' ? (step.set.duration || null) : null,
  };
  if (entry.weight != null && isPR(name, entry.weight, entry.reps)) {
    toast('🏆 رکورد شخصی جدید!');
  }
  S.entries = S.entries.filter(e => e.stepId !== step.id).concat(entry);
  stopTempo(); work?.stop(); work = null;

  if (step.i >= steps.length - 1) return finish(program, day);
  S.phase = step.restAfter ? 'rest' : 'work';
  if (S.phase === 'work') S.i += 1;
  save();
  render(program, day);
}

function runWorkTimer(btn, step) {
  const out = document.getElementById('work-timer');
  if (work) { work.stop(); work = null; btn.textContent = '▶ شروع دوباره'; return; }
  primeAudio();
  if (step.ex.intervals) return runIntervals(btn, out, step.ex.intervals);
  const seconds = step.set.duration || 60;
  btn.textContent = '⏸ توقف';
  work = new Countdown({
    seconds,
    onTick: left => { out.textContent = clock(left); },
    onEnd: () => { cue.done(); work = null; btn.textContent = '▶ شروع دوباره'; },
  });
}

function runIntervals(btn, out, iv) {
  let round = 0, phase = 'work';
  btn.textContent = '⏸ توقف';
  const leg = () => {
    const conf = phase === 'work' ? iv.work : iv.recover;
    const label = phase === 'work' ? 'تند' : 'آرام';
    work = new Countdown({
      seconds: conf?.duration || 30,
      onTick: left => {
        out.textContent = `${clock(left)} — ${label} · دور ${fa(round + 1)}/${fa(iv.rounds)}`
          + (conf?.speed ? ` · ${fa(num(conf.speed))}km/h` : '');
      },
      onEnd: () => {
        if (phase === 'work') { phase = 'recover'; cue.switch(); leg(); }
        else {
          round += 1; phase = 'work';
          if (round >= iv.rounds) { cue.done(); out.textContent = 'پایان اینتروال ✓'; work = null; btn.textContent = '▶ شروع دوباره'; }
          else { cue.switch(); leg(); }
        }
      },
    });
  };
  leg();
}

function toggleTempo(el, step) {
  if (tempo) return stopTempo();
  primeAudio();
  const parts = String(step.set.tempo).split(/[-/]/).map(p => (/^\d+$/.test(p) ? +p : 1));
  let phase = 0, left = parts[0];
  const boxes = el.querySelectorAll('[data-phase]');
  const paint = () => boxes.forEach((b, i) => b.classList.toggle('on', i === phase));
  paint(); beep(880, 70, 0.05);
  tempo = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      phase = (phase + 1) % parts.length;
      left = parts[phase] || 1;
      paint();
      beep(phase === 0 ? 990 : 700, 70, 0.05);
    }
  }, 1000);
}

function stopTempo() {
  if (tempo) { clearInterval(tempo); tempo = null; }
  document.querySelectorAll('.tempo-strip [data-phase]').forEach(b => b.classList.remove('on'));
}

/* ---------- منوها ---------- */

function moreMenu(program, day) {
  const step = steps[S.i];
  sheet('گزینه‌های تمرین', `
    <div class="stack" style="gap:8px">
      ${step.ex.alternatives.length ? `<button class="btn block" data-a="sub">🔁 حرکت جایگزین</button>` : ''}
      <button class="btn block" data-a="add">➕ یک ست اضافه</button>
      <button class="btn block" data-a="skip">⏭ رد کردن این حرکت</button>
      <button class="btn block" data-a="info">📋 فرم اجرا و جزئیات</button>
      <button class="btn block danger" data-a="end">🏁 پایان جلسه</button>
    </div>`, (b, close) => {
    const on = (k, fn) => b.querySelector(`[data-a="${k}"]`)?.addEventListener('click', () => { close(); fn(); });
    on('sub', () => subSheet(step, program, day));
    on('add', () => {
      S.extras[step.ex.key] = (S.extras[step.ex.key] || 0) + 1;
      build(day); toast('یک ست اضافه شد'); render(program, day);
    });
    on('skip', async () => {
      if (await confirmSheet('رد کردن حرکت', `همهٔ ست‌های «${nameOf(step)}» از این جلسه حذف شود؟`, { danger: true, okText: 'رد کن' })) {
        S.skipped = [...(S.skipped || []), step.ex.key];
        build(day); render(program, day);
      }
    });
    on('info', () => infoSheet(step));
    on('end', async () => {
      if (await confirmSheet('پایان جلسه', 'جلسه با همین مقدار ثبت‌شده بسته شود؟', { okText: 'پایان' })) {
        finish(program, day);
      }
    });
  });
}

function subSheet(step, program, day) {
  const opts = [step.ex.name, ...step.ex.alternatives];
  sheet('حرکت جایگزین', `<div class="stack" style="gap:8px">
    ${opts.map((o, i) => `<button class="btn block ${nameOf(step) === o ? 'primary' : ''}" data-alt="${i}">${esc(o)}</button>`).join('')}
  </div>`, (b, close) => {
    b.querySelectorAll('[data-alt]').forEach(btn => btn.onclick = () => {
      const name = opts[+btn.dataset.alt];
      if (name === step.ex.name) delete S.subs[step.ex.key];
      else S.subs[step.ex.key] = name;
      save(); close(); render(program, day);
    });
  });
}

function infoSheet(step) {
  const ex = step.ex;
  const vid = safeUrl(ex.media?.video);
  sheet(nameOf(step), `<div class="stack">
    <div class="row wrap" style="gap:6px">
      ${[ex.muscle, ex.equipment].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
      ${step.set.tempo ? `<span class="chip">تمپو ${fa(step.set.tempo)}</span>` : ''}
      ${step.restAfter ? `<span class="chip">استراحت ${esc(dur(step.restAfter))}</span>` : ''}
    </div>
    <div data-media></div>
    ${ex.cue ? `<div class="hint"><b>فرم اجرا:</b> ${esc(ex.cue)}</div>` : ''}
    ${ex.technique ? `<div class="hint"><b>${esc(TECH_LABEL[ex.technique.type] || '')}:</b> ${esc(techniqueText(ex.technique))}</div>` : ''}
    ${vid ? `<a class="btn block" href="${esc(vid)}" target="_blank" rel="noopener noreferrer">تماشای ویدیو ↗</a>` : ''}
  </div>`, body => mountMedia(body, ex, nameOf(step)));
}

function platesSheet(step, override) {
  const st = store.settings();
  const target = override ?? step.set.weight;
  const res = computePlates(target, st.bar, st.plates);
  const body = !res
    ? `<p class="small muted">وزنهٔ هدف از وزن میله (${fa(st.bar)}${esc(st.unit)}) کمتر است — احتمالاً دمبل یا دستگاه است.</p>`
    : `<div class="target"><div class="lbl">هر طرف میله</div>
        <div class="big" style="font-size:28px">${res.perSide.length
          ? res.perSide.map(p => `${fa(num(p.w))}${p.n > 1 ? `×${fa(p.n)}` : ''}`).join(' + ')
          : 'فقط میله'}</div>
       </div>
       <p class="small muted" style="margin-top:10px">میله ${fa(st.bar)} + صفحات = <b>${fa(num(res.achieved))}${esc(st.unit)}</b>
       ${res.exact ? '' : ' (نزدیک‌ترین ترکیب ممکن)'}</p>`;
  sheet('محاسبهٔ صفحات', body);
}

/* ---------- پایان ---------- */

function finish(program, day) {
  cleanup();
  const minutes = Math.max(1, Math.round((Date.now() - S.startedAt) / 60000));
  const setsDone = S.entries.length;
  store.addSession({
    programId: S.programId, dayId: S.dayId, dayName: day.name, programName: program.name,
    week: S.week, startedAt: S.startedAt, endedAt: Date.now(), entries: S.entries,
  });
  store.setLive(null);
  const pid = program.id, did = day.id;
  S = null; steps = [];
  location.hash = `/p/${pid}/d/${did}`;
  setTimeout(() => sheet('جلسه تمام شد 💪', `
    <div class="metrics">
      <div class="metric"><div class="v">${fa(setsDone)}</div><div class="k">ست ثبت‌شده</div></div>
      <div class="metric"><div class="v">${fa(minutes)}</div><div class="k">دقیقه</div></div>
      <div class="metric"><div class="v">${fa(new Date().toLocaleDateString('fa-IR').split('/').slice(1).join('/'))}</div><div class="k">تاریخ</div></div>
    </div>
    <button class="btn primary block" style="margin-top:14px" data-ok>عالی</button>`,
    (b, close) => { b.querySelector('[data-ok]').onclick = close; }), 60);
}
