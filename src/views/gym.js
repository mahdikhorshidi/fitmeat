// مود باشگاه — یک واحد (ست تکی یا کل یک دورِ سوپرست) در هر صفحه،
// با نوار زمان، تمرین دونفره، نقشهٔ کل برنامه، جایگزینی و جابه‌جایی حرکت.
import { store } from '../store.js';
import { resolveProgram, flattenUnits, unitDuration } from '../resolve.js';
import { esc, fa, num, dur, durShort, clock, clockOfDay, safeUrl } from '../util.js';
import { toast, sheet, confirmSheet } from '../ui.js';
import { Countdown, Screen, cue, primeAudio, beep } from '../timer.js';
import { computePlates } from '../plates.js';
import { lastFor, prFor, isPR } from '../history.js';
import { TECH_LABEL } from '../condense.js';
import { weekOf } from './program.js';
import { exerciseSheet, muscleLine } from './exercise.js';
import { lookup, substitutesFor, loadFactor, normalize } from '../exdb.js';
import { demoSvg, patternName } from '../anim.js';

let S = null;        // وضعیت جلسه (پایدار در localStorage)
let units = [];      // واحدهای روز، پس از اعمال جایگزینی/جابه‌جایی/رد کردن
let rest = null;     // تایمر استراحت
let work = null;     // تایمر حرکت زمانی/هوازی
let tempo = null;    // شمارندهٔ تمپو
let ticker = null;   // به‌روزرسانی نوار زمان
const screen = new Screen();

/* ==================== ورود ==================== */

export function gymView({ id, dayId }) {
  const program = store.program(id);
  if (!program) { location.hash = '/'; return; }
  const week = weekOf(id);
  const settings = store.settings();
  const model = resolveProgram(program, week, settings);
  const day = model.days.find(d => d.id === dayId);
  if (!day) { location.hash = `/p/${id}`; return; }

  const live = store.live();
  if (live && live.programId === id && live.dayId === dayId) {
    S = { ...fresh(id, dayId, week, settings), ...live };
  } else if (live) {
    confirmSheet('جلسهٔ ناتمام', 'یک جلسهٔ ناتمام دیگر باز است. آن را رها کنم و این جلسه را شروع کنم؟',
      { danger: true, okText: 'شروع جلسهٔ جدید' }).then(ok => {
        if (ok) { store.setLive(null); gymView({ id, dayId }); }
        else location.hash = `/gym/${live.programId}/${live.dayId}`;
      });
    return;
  } else {
    S = fresh(id, dayId, week, settings);
  }

  build(day);
  primeAudio();
  screen.on();
  render(program, day);
  startTicker();
  return { cleanup };
}

function fresh(programId, dayId, week, settings) {
  const partner = !!settings.partner;
  const athletes = (partner ? settings.athletes.slice(0, 2) : settings.athletes.slice(0, 1))
    .map((a, i) => ({ id: a.id || (i ? 'b' : 'a'), name: a.name || `ورزشکار ${fa(i + 1)}` }));
  return {
    programId, dayId, week, startedAt: Date.now(),
    partner, athletes,
    done: [],          // شناسهٔ اسلات‌های انجام‌شده: "unitKey|itemIndex|athleteId"
    entries: [],
    subs: {},          // exKey → {name, note}
    skipped: [],       // exKey هایی که کلاً رد شده‌اند
    extras: {},        // exKey → تعداد ست اضافه
    order: null,       // ترتیب دلخواه واحدها (جابه‌جایی حرکت)
    restAt: {},        // athleteId → زمان پایان آخرین ست
    restNeed: {},      // athleteId → استراحت لازم پس از آن ست
    phase: 'work',
    restLeft: 0,
  };
}

const save = () => store.setLive(S);

function cleanup() {
  rest?.stop(); rest = null;
  work?.stop(); work = null;
  stopTempo();
  clearInterval(ticker); ticker = null;
  screen.off();
}

/* ==================== ساخت واحدها ==================== */

function build(day) {
  let list = flattenUnits(day);

  // ست‌های اضافه‌شده در لحظه (فقط بلوک‌های تکی)
  Object.entries(S.extras || {}).forEach(([key, n]) => {
    for (let k = 0; k < n; k++) {
      const src = [...list].reverse().find(u => u.items.length === 1 && u.items[0].ex.key === key);
      if (!src) continue;
      const at = list.lastIndexOf(src);
      list.splice(at + 1, 0, { ...src, key: `${src.key}+x${k}`, extra: true });
    }
  });

  // حرکات رد شده
  const skipped = new Set(S.skipped || []);
  list = list
    .map(u => ({ ...u, items: u.items.filter(it => !skipped.has(it.ex.key)) }))
    .filter(u => u.items.length);

  // ترتیب دلخواه
  if (Array.isArray(S.order) && S.order.length) {
    const rank = new Map(S.order.map((k, i) => [k, i]));
    list = list
      .map((u, i) => ({ u, i }))
      .sort((x, y) => (rank.get(x.u.key) ?? 1e6 + x.i) - (rank.get(y.u.key) ?? 1e6 + y.i))
      .map(o => o.u);
  }

  units = list.map((u, i) => ({ ...u, i, total: list.length }));
  save();
}

const nameOf = it => S.subs[it.ex.key]?.name || it.ex.name;
const slotId = (u, itemIdx, athId) => `${u.key}|${itemIdx}|${athId}`;
const isDone = (u, itemIdx, athId) => S.done.includes(slotId(u, itemIdx, athId));

/** ترتیب اسلات‌ها داخل یک واحد: هر حرکت را همهٔ ورزشکارها می‌زنند، بعد حرکت بعد */
function slotsOf(u) {
  const out = [];
  u.items.forEach((it, itemIdx) => {
    S.athletes.forEach((a, ai) => out.push({ u, it, itemIdx, ath: a, athIdx: ai, id: slotId(u, itemIdx, a.id) }));
  });
  return out;
}

/** اولین اسلات انجام‌نشده در کل جلسه */
function cursor() {
  for (const u of units) {
    const s = slotsOf(u).find(x => !S.done.includes(x.id));
    if (s) return s;
  }
  return null;
}

/** استراحتی که این اسلات پس از خودش لازم دارد */
function restForSlot(slot) {
  const last = slot.itemIdx === slot.u.items.length - 1;
  return last ? (slot.u.restAfter || 0) : (slot.u.restBetween || 0);
}

/** ثانیهٔ باقی‌ماندهٔ استراحتِ لازمِ یک ورزشکار (منفی یعنی آماده است) */
function restDeficit(athId) {
  const at = S.restAt[athId];
  if (!at) return 0;
  const need = S.restNeed[athId] || 0;
  return Math.max(0, Math.round(need - (Date.now() - at) / 1000));
}

/* ==================== رندر ==================== */

function render(program, day) {
  work?.stop(); work = null;
  stopTempo();

  const app = document.getElementById('app');
  const slot = cursor();
  if (!slot) return finish(program, day);

  const totalSlots = units.reduce((n, u) => n + u.items.length * S.athletes.length, 0);
  const pct = Math.round((S.done.length / Math.max(1, totalSlots)) * 100);

  app.innerHTML = `
  <section class="gym">
    <div class="gym-top">
      <button class="iconbtn" data-exit aria-label="خروج">✕</button>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <span class="small num muted">${fa(S.done.length)}/${fa(totalSlots)}</span>
      <button class="iconbtn" data-map aria-label="نقشهٔ برنامه">🗺️</button>
      <button class="iconbtn" data-more aria-label="گزینه‌ها">⋯</button>
    </div>
    <div class="gym-body">
      ${timelineHtml(slot)}
      ${S.partner ? turnHtml(slot) : ''}
      ${S.phase === 'rest' ? restBody(slot) : unitBody(slot)}
    </div>
    <div class="gym-foot">${S.phase === 'rest' ? restFoot() : workFoot(slot)}</div>
  </section>`;

  const $ = s => app.querySelector(s);
  const all = s => app.querySelectorAll(s);

  $('[data-exit]').onclick = async () => {
    if (await confirmSheet('خروج از تمرین', 'جلسه ذخیره می‌شود و بعداً می‌توانید ادامه دهید.', { okText: 'خروج' })) {
      cleanup(); location.hash = `/p/${program.id}/d/${day.id}`;
    }
  };
  $('[data-map]').onclick = () => mapOverlay(program, day);
  $('[data-more]').onclick = () => moreMenu(program, day, slot);

  if (S.phase === 'rest') {
    $('[data-skip-rest]').onclick = () => { rest?.stop(); S.phase = 'work'; save(); render(program, day); };
    all('[data-rest-adj]').forEach(b => b.onclick = () => rest?.add(+b.dataset.restAdj));
    startRest(program, day);
    return;
  }

  bindWork(app, program, day, slot);
}

/* ---------- نوار زمان ---------- */

function remainingSeconds() {
  const n = S.athletes.length;
  let sum = 0;
  units.forEach(u => {
    const slots = slotsOf(u);
    const left = slots.filter(s => !S.done.includes(s.id));
    if (!left.length) return;
    const per = unitDuration(u, n) / Math.max(1, slots.length);
    sum += per * left.length;
  });
  return Math.round(sum);
}

function timelineHtml(slot) {
  const elapsed = Math.round((Date.now() - S.startedAt) / 1000);
  const left = remainingSeconds();
  const eta = Date.now() + left * 1000;
  const planned = elapsed + left;
  const pct = planned ? Math.min(100, Math.round((elapsed / planned) * 100)) : 0;
  return `
  <div class="timeline" id="tl">
    <div class="t-cell"><div class="v">${clockOfDay(S.startedAt)}</div><div class="k">شروع تمرین</div></div>
    <div class="t-cell t-mid"><div class="v" id="tl-el">${clock(elapsed)}</div><div class="k">زمان تمرین</div></div>
    <div class="t-cell"><div class="v" id="tl-eta">${clockOfDay(eta)}</div><div class="k">پایان تخمینی</div></div>
    <div class="t-bar"><i id="tl-bar" style="width:${pct}%"></i></div>
  </div>`;
}

function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(() => {
    const el = document.getElementById('tl-el');
    if (!el) return;
    const elapsed = Math.round((Date.now() - S.startedAt) / 1000);
    const left = remainingSeconds();
    el.textContent = clock(elapsed);
    const eta = document.getElementById('tl-eta');
    if (eta) eta.textContent = clockOfDay(Date.now() + left * 1000);
    const bar = document.getElementById('tl-bar');
    const planned = elapsed + left;
    if (bar && planned) bar.style.width = `${Math.min(100, Math.round((elapsed / planned) * 100))}%`;
    // شمارندهٔ آمادگی ورزشکارها
    document.querySelectorAll('[data-ready]').forEach(node => {
      const d = restDeficit(node.dataset.ready);
      const need = S.restNeed[node.dataset.ready] || 1;
      node.querySelector('.v').textContent = d ? clock(d) : 'آماده';
      const bar2 = node.querySelector('i');
      if (bar2) bar2.style.width = `${Math.round((1 - d / Math.max(1, need)) * 100)}%`;
      node.classList.toggle('cold', d > 0);
    });
  }, 1000);
}

/* ---------- نوبت ورزشکارها ---------- */

function turnHtml(slot) {
  const cur = slot.ath;
  const other = S.athletes.find(a => a.id !== cur.id) || cur;
  const d = restDeficit(other.id);
  const need = S.restNeed[other.id] || 0;
  const side = slot.athIdx === 0 ? 'a' : 'b';
  return `
  <div class="turn ${side}">
    <span class="avatar ${side}">${esc(initial(cur.name))}</span>
    <div class="who">
      <div class="k">الان نوبتِ</div>
      <div class="v">${esc(cur.name)}</div>
    </div>
    <div class="readybar ${d > 0 ? 'cold' : ''}" data-ready="${esc(other.id)}">
      <div class="k"><span>${esc(other.name)}</span><span class="v num">${d ? clock(d) : 'آماده'}</span></div>
      <div class="bar"><i style="width:${need ? Math.round((1 - d / need) * 100) : 100}%"></i></div>
    </div>
  </div>
  ${nextTurnHint(slot)}`;
}

function nextTurnHint(slot) {
  const list = flatSlots();
  const at = list.findIndex(s => s.id === slot.id);
  const nxt = list.slice(at + 1).find(s => !S.done.includes(s.id));
  if (!nxt) return '';
  return `<div class="queue">
    <span class="q"><span class="avatar sm ${nxt.athIdx === 0 ? 'a' : 'b'}">${esc(initial(nxt.ath.name))}</span>
      بعدی: ${esc(nameOf(nxt.it))}</span>
    <span class="tiny muted">در همین فاصله ${esc(otherRestNote(slot))}</span>
  </div>`;
}

function otherRestNote(slot) {
  const other = S.athletes.find(a => a.id !== slot.ath.id);
  if (!other) return '';
  const d = restDeficit(other.id);
  return d ? `${other.name} ${clock(d)} دیگر آماده می‌شود` : `${other.name} آمادهٔ ست بعدی است`;
}

const initial = n => String(n || '?').trim().charAt(0) || '?';

function flatSlots() {
  return units.flatMap(u => slotsOf(u));
}

/* ---------- بدنهٔ کار ---------- */

function unitBody(slot) {
  const u = slot.u;
  const grouped = u.blockType !== 'single';
  const label = u.blockType === 'superset' ? 'سوپرست' : u.blockType === 'circuit' ? 'سیرکویت' : 'ست';

  const ctx = grouped
    ? `${label} ${esc(u.items.map(i => i.mark).join(' + '))} · دور ${fa(u.round + 1)} از ${fa(u.rounds)}`
    : `${esc(slot.it.mark)} · ست ${fa(u.round + 1)} از ${fa(u.rounds)}${u.extra ? ' · ست اضافه' : ''}`;

  if (!grouped) {
    return `<div class="step-ctx">${ctx}</div>${itemPanel(slot, slot.it, slot.itemIdx, true)}`;
  }

  // سوپرست: همهٔ حرکات دور، روی یک صفحه
  return `
    <div class="step-ctx">${ctx}</div>
    ${u.blockNote ? `<div class="hint">${esc(u.blockNote)}</div>` : ''}
    <div class="hint"><b>در این دور:</b> ${esc(u.items.map((it, i) => `${it.mark} ${nameOf(it)}`).join('  ←  '))}
      ${u.restBetween ? ` — بین حرکات ${esc(dur(u.restBetween))} استراحت` : ' — بدون استراحت بین حرکات'}</div>
    <div class="ss">
      ${u.items.map((it, idx) => {
        const done = S.athletes.every(a => isDone(u, idx, a.id));
        const active = idx === slot.itemIdx;
        return `
        ${idx ? `<div class="ss-arrow">↓ ${u.restBetween ? esc(durShort(u.restBetween)) : 'بدون استراحت'}</div>` : ''}
        <div class="ss-item ${active ? 'on' : ''} ${done ? 'done' : ''}">
          <button class="ss-head" data-jump="${idx}">
            <span class="mk">${done ? '✓' : esc(it.mark)}</span>
            <span class="nm">${esc(nameOf(it))}</span>
            <span class="tg">${esc(targetShort(it))}</span>
          </button>
          ${active ? `<div class="ss-body">${itemPanel(slot, it, idx, false)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

function targetShort(it) {
  if (it.kind === 'reps') {
    return `${fa(it.set.reps ?? '—')}${it.set.weight != null ? `×${fa(num(it.set.weight))}` : ''}`;
  }
  if (it.kind === 'time') return clock(it.set.duration);
  return cardioTarget(it.ex, it.set);
}

/** پنل یک حرکت: هدف، فرم، ورودی‌ها */
function itemPanel(slot, it, idx, standalone) {
  const ex = it.ex;
  const athId = slot.ath.id;
  const last = lastFor(nameOf(it), S.partner ? athId : undefined);
  const pr = prFor(nameOf(it), S.partner ? athId : undefined);
  const unit = ex.unit || 'kg';
  const sub = S.subs[ex.key];

  return `
  ${standalone ? `<h2 class="step-title">${esc(nameOf(it))}</h2>` : ''}
  ${sub ? `<div class="small muted">جایگزین «${esc(ex.name)}»${sub.note ? ` — ${esc(sub.note)}` : ''}</div>` : ''}

  <div class="target">
    ${it.kind === 'reps' ? `
      <div class="lbl">هدف</div>
      <div class="big">${fa(it.set.reps ?? '—')}${it.set.weight != null ? ` <span style="font-size:22px">× ${fa(num(it.set.weight))}${esc(unit)}</span>` : ''}</div>`
    : it.kind === 'time' ? `
      <div class="lbl">هدف</div><div class="big">${clock(it.set.duration)}</div>`
    : `<div class="lbl">هوازی</div>
       <div class="big" style="font-size:24px">${esc(cardioTarget(ex, it.set))}</div>`}
    ${it.set.rpe != null ? `<div class="small muted">شدت هدف: RPE ${fa(it.set.rpe)}</div>` : ''}
    ${it.set.rir != null ? `<div class="small muted">شدت هدف: ${fa(it.set.rir)} تکرار ذخیره</div>` : ''}
  </div>

  ${last ? `<div class="hint">آخرین بار${S.partner ? ` (${esc(slot.ath.name)})` : ''}:
    <b>${fa(last.reps ?? '—')}${last.weight != null ? ` × ${fa(num(last.weight))}${esc(unit)}` : ''}</b>
    ${pr ? ` · رکورد: ${fa(num(pr.weight))}${esc(unit)}` : ''}</div>` : ''}

  ${formCard(ex, it)}
  ${muscleLine(ex)}

  ${it.set.tempo ? tempoStrip(it.set.tempo) : ''}
  ${ex.technique ? microList(ex.technique) : ''}

  ${it.kind === 'reps' ? `
    <div class="grid2">
      <div class="field"><label>تکرار انجام‌شده</label>${stepper(`reps-${idx}`, defaultReps(it, last), 1)}</div>
      <div class="field"><label>وزنه (${esc(unit)})</label>${stepper(`weight-${idx}`, defaultWeight(it, last), 2.5)}</div>
    </div>
    ${it.set.weight != null ? `<button class="btn sm" data-plates="${idx}">🏋️ صفحات میله</button>` : ''}`
  : `<button class="btn block" data-timer="${idx}">
      ${it.kind === 'time' ? '▶ شروع تایمر حرکت' : '▶ شروع تایمر هوازی'}
    </button>
    <div id="work-timer" class="center num" style="font-size:34px;font-weight:900"></div>`}`;
}

/** کارت فرم: انیمیشن کنار توضیح — دقیقاً چیزی که حین ست لازم است */
function formCard(ex, it) {
  const kb = lookup(ex.name, { muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment });
  const img = safeUrl(ex.media?.gif || ex.media?.image);
  const cues = [ex.cue, ...(kb.exec || [])].filter(Boolean).slice(0, 3);
  if (!cues.length && kb.match === 'guess' && !img) return '';

  const visual = img
    ? `<div class="demo"><span class="demo-tag">${esc(patternName(kb.pattern))}</span>
        <img src="${esc(img)}" alt="نمایش حرکت ${esc(ex.name)}" loading="lazy" style="width:100%;border-radius:var(--r-sm);display:block"></div>`
    : demoSvg(kb.pattern, { tag: patternName(kb.pattern), height: 150, equip: ex.equipment || kb.equip });

  return `<div class="card flat" style="padding:10px">
    <div class="row" style="align-items:flex-start;gap:10px">
      <div style="flex:0 0 42%;max-width:170px">${visual}</div>
      <div style="flex:1;min-width:0">
        <div class="sec-title" style="margin-bottom:5px">فرم درست</div>
        <ul class="steps-list">${cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <button class="btn sm" style="margin-top:8px" data-info>توضیح کامل و عضلات</button>
      </div>
    </div>
  </div>`;
}

function workFoot(slot) {
  const list = flatSlots();
  const at = list.findIndex(s => s.id === slot.id);
  const prev = list.slice(0, at).reverse().find(s => S.done.includes(s.id));
  return `
    <button class="btn" data-undo ${prev ? '' : 'disabled'} aria-label="برگشت">‹</button>
    <button class="btn primary" style="flex:1" data-done>
      ${S.partner ? `ثبت ${esc(slot.ath.name)} ✓` : 'ثبت و ادامه ✓'}
    </button>
    <button class="btn" data-skip-slot aria-label="رد کردن">›</button>`;
}

/* ---------- استراحت ---------- */

function restBody(slot) {
  const secs = S.restLeft || 0;
  const other = S.athletes.find(a => a.id !== slot.ath.id);
  return `
    <div class="center small muted">استراحت${S.partner ? ` — تا آمادگی ${esc(slot.ath.name)}` : ''}</div>
    <div class="rest" aria-live="polite">
      <svg viewBox="0 0 100 100" width="190" height="190">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
        <circle id="ring" cx="50" cy="50" r="45" fill="none" stroke="var(--brand)" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="0"/>
      </svg>
      <div><div class="t" id="rest-t">${clock(secs)}</div><div class="l">تا ست بعد</div></div>
    </div>
    <div class="card center">
      <div class="small muted">بعدی</div>
      <div style="font-weight:800;font-size:17px">${esc(nameOf(slot.it))}</div>
      <div class="small muted">${esc(slot.it.mark)} · ${esc(targetShort(slot.it))}${S.partner ? ` · ${esc(slot.ath.name)}` : ''}</div>
    </div>
    ${S.partner && other ? `<div class="hint">
      تمرین دونفره: معمولاً لازم نیست اینجا منتظر بمانی — همین که نفر دیگر ست خودش را می‌زند،
      استراحت تو حساب می‌شود. این شمارش فقط وقتی می‌آید که هنوز به استراحت لازم نرسیده‌ای.
    </div>` : ''}`;
}

function restFoot() {
  return `
    <button class="btn" data-rest-adj="-15">−۱۵ث</button>
    <button class="btn primary" style="flex:1" data-skip-rest>رد کردن استراحت</button>
    <button class="btn" data-rest-adj="15">+۱۵ث</button>`;
}

function startRest(program, day) {
  rest?.stop();
  const seconds = S.restLeft || 0;
  if (seconds <= 0) { S.phase = 'work'; save(); return render(program, day); }
  const t = document.getElementById('rest-t');
  const ring = document.getElementById('ring');
  rest = new Countdown({
    seconds,
    onTick: (left, total) => {
      if (t) t.textContent = clock(left);
      if (ring) ring.style.strokeDashoffset = String(283 * (1 - left / total));
      S.restLeft = Math.ceil(left);
    },
    onEnd: () => { cue.go(); S.phase = 'work'; S.restLeft = 0; save(); render(program, day); },
  });
}

/* ---------- تعامل فاز کار ---------- */

function bindWork(app, program, day, slot) {
  const all = s => app.querySelectorAll(s);
  const $ = s => app.querySelector(s);

  all('[data-jump]').forEach(b => b.onclick = () => {
    const idx = +b.dataset.jump;
    // به اولین اسلات انجام‌نشدهٔ آن حرکت برو
    const target = slotsOf(slot.u).find(s => s.itemIdx === idx && !S.done.includes(s.id));
    if (!target) return toast('این حرکت در این دور کامل شده است');
    // اسلات‌های قبلیِ انجام‌نشده را نگه می‌داریم؛ فقط نمایش را جابه‌جا می‌کنیم
    reorderWithinUnit(slot.u, idx);
    render(program, day);
  });

  $('[data-info]')?.addEventListener('click', () => exerciseSheet(slot.it.ex, {
    title: nameOf(slot.it),
    extra: `<div class="hint">هدف این ست: <b>${esc(targetShort(slot.it))}</b>
      ${slot.u.restAfter ? ` · استراحت بعد از دور: ${esc(dur(slot.u.restAfter))}` : ''}</div>`,
  }));
  $('[data-tempo]')?.addEventListener('click', e => toggleTempo(e.currentTarget, slot.it));
  $('[data-plates]')?.addEventListener('click', e => {
    const idx = e.currentTarget.dataset.plates;
    platesSheet(slot.it, parseFloat(app.querySelector(`#f-weight-${idx}`)?.value) || null);
  });
  all('[data-inc]').forEach(b => b.onclick = () => {
    const input = app.querySelector(`#f-${b.dataset.field}`);
    const v = (parseFloat(input.value) || 0) + (+b.dataset.inc);
    input.value = num(Math.max(0, Math.round(v * 100) / 100));
  });
  all('[data-micro]').forEach(b => b.onclick = () => { b.classList.toggle('done'); beep(700, 60, 0.04); });
  $('[data-timer]')?.addEventListener('click', e => runWorkTimer(e.currentTarget, slot.it));

  $('[data-done]').onclick = () => complete(program, day, slot);
  $('[data-skip-slot]').onclick = () => {
    S.done = [...S.done, slot.id];
    save(); render(program, day);
  };
  $('[data-undo]').onclick = () => {
    const list = flatSlots();
    const at = list.findIndex(s => s.id === slot.id);
    const prev = list.slice(0, at).reverse().find(s => S.done.includes(s.id));
    if (!prev) return;
    S.done = S.done.filter(x => x !== prev.id);
    S.entries = S.entries.filter(e => e.slot !== prev.id);
    S.phase = 'work'; S.restLeft = 0;
    rest?.stop(); rest = null;
    save(); render(program, day);
  };
}

/** وقتی دستگاهِ یک حرکتِ سوپرست اشغال است: ترتیب حرکات همان دور را عوض کن */
function reorderWithinUnit(u, idx) {
  const target = units.find(x => x.key === u.key);
  if (!target || idx <= 0) return;
  const items = target.items.slice();
  const [picked] = items.splice(idx, 1);
  // اولین حرکت انجام‌نشده را پیدا کن و حرکتِ انتخابی را جای آن بگذار
  const firstOpen = items.findIndex((_, i) => S.athletes.some(a => !isDone(target, i, a.id)));
  items.splice(Math.max(0, firstOpen), 0, picked);
  target.items = items;
  toast('ترتیب این دور عوض شد — حجم و استراحت دست‌نخورده است');
}

function complete(program, day, slot) {
  const app = document.getElementById('app');
  const idx = slot.itemIdx;
  const reps = parseFloat(app.querySelector(`#f-reps-${idx}`)?.value);
  const weight = parseFloat(app.querySelector(`#f-weight-${idx}`)?.value);
  const name = nameOf(slot.it);
  const athId = slot.ath.id;

  const entry = {
    exercise: name, mode: slot.it.kind, slot: slot.id, at: Date.now(),
    athlete: athId, athleteName: slot.ath.name,
    reps: Number.isFinite(reps) ? reps : null,
    weight: Number.isFinite(weight) ? weight : null,
    duration: slot.it.kind !== 'reps' ? (slot.it.set.duration || null) : null,
  };
  if (entry.weight != null && isPR(name, entry.weight, entry.reps, S.partner ? athId : undefined)) {
    toast(`🏆 رکورد جدید${S.partner ? ` برای ${slot.ath.name}` : ''}!`, 'good');
  }

  S.entries = S.entries.filter(e => e.slot !== slot.id).concat(entry);
  S.done = [...new Set([...S.done, slot.id])];
  S.restAt[athId] = Date.now();
  S.restNeed[athId] = restForSlot(slot);
  stopTempo(); work?.stop(); work = null;

  const next = cursor();
  if (!next) return finish(program, day);

  const deficit = restDeficit(next.ath.id);
  if (deficit > 5) { S.phase = 'rest'; S.restLeft = deficit; }
  else { S.phase = 'work'; S.restLeft = 0; if (S.partner) cue.switch(); }
  save();
  render(program, day);
}

/* ---------- تایمرها ---------- */

function runWorkTimer(btn, it) {
  const out = document.getElementById('work-timer');
  if (work) { work.stop(); work = null; btn.textContent = '▶ شروع دوباره'; return; }
  primeAudio();
  if (it.ex.intervals) return runIntervals(btn, out, it.ex.intervals);
  const seconds = it.set.duration || 60;
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

function tempoStrip(t) {
  const parts = String(t).split(/[-/]/);
  const labels = ['پایین', 'مکث', 'بالا', 'مکث'];
  return `<button data-tempo class="tempo-strip" style="width:100%;border:0;padding:0;background:none" aria-label="شمارندهٔ تمپو">
    ${parts.map((p, i) => `<div data-phase="${i}"><span class="n">${fa(p)}</span>${labels[i]}</div>`).join('')}
  </button>`;
}

function toggleTempo(el, it) {
  if (tempo) return stopTempo();
  primeAudio();
  const parts = String(it.set.tempo).split(/[-/]/).map(p => (/^\d+$/.test(p) ? +p : 1));
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

function microList(t) {
  const items = t.type === 'drop'
    ? t.drops.map((d, i) => `دراپ ${fa(i + 1)}: کاهش ${String(d.reduce ?? '')} تا ${String(d.reps ?? 'ناتوانی')}`)
    : t.type === 'restPause'
      ? Array.from({ length: (t.pauses ?? 2) }, (_, i) => `وقفهٔ ${fa(i + 1)}: ${fa(t.rest ?? 15)} ثانیه مکث، سپس تا ناتوانی`)
      : Array.from({ length: (t.clusters ?? 4) }, (_, i) => `خوشهٔ ${fa(i + 1)}: ${fa(t.repsPer ?? 2)} تکرار`);
  return `<div>
    <div class="sec-title" style="margin-bottom:6px">${esc(TECH_LABEL[t.type] || t.type)}</div>
    <div class="micro">${items.map(x => `<button data-micro><span class="bx">✓</span><span>${esc(x)}</span></button>`).join('')}</div>
  </div>`;
}

function stepper(field, value, inc) {
  return `<div class="stepper">
    <button data-inc="-${inc}" data-field="${field}" aria-label="کم">−</button>
    <input id="f-${field}" class="num" type="number" inputmode="decimal" step="any" value="${value ?? ''}">
    <button data-inc="${inc}" data-field="${field}" aria-label="زیاد">+</button>
  </div>`;
}

function defaultReps(it, last) {
  const r = it.set.reps;
  if (typeof r === 'number') return r;
  const m = String(r ?? '').match(/(\d+)\s*$/);
  return m ? +m[1] : (last?.reps ?? '');
}
function defaultWeight(it, last) {
  if (it.set.weight != null) return num(it.set.weight);
  return last?.weight != null ? num(last.weight) : '';
}

function cardioTarget(ex, set) {
  if (ex.intervals) {
    const iv = ex.intervals;
    return `${fa(iv.rounds)} × (${clock(iv.work?.duration)} تند / ${clock(iv.recover?.duration)} آرام)`;
  }
  return [set.duration && dur(set.duration), set.distance && `${fa(num(set.distance))} متر`,
    set.speed && `${fa(num(set.speed))} km/h`, set.incline && `شیب ${fa(num(set.incline))}٪`,
    set.hrZone && `ضربان ${fa(set.hrZone)}`].filter(Boolean).join(' · ') || '—';
}

/* ==================== نقشهٔ کل برنامه ==================== */

function mapOverlay(program, day) {
  const root = document.getElementById('sheet-root');
  const cur = cursor();
  const byBlock = new Map();
  units.forEach(u => {
    if (!byBlock.has(u.blockIndex)) byBlock.set(u.blockIndex, []);
    byBlock.get(u.blockIndex).push(u);
  });

  const blocks = [...byBlock.entries()].map(([bi, us]) => {
    const first = us[0];
    const label = first.blockType === 'single' ? 'تکی'
      : first.blockType === 'superset' ? 'سوپرست' : 'سیرکویت';
    const exes = first.items.map((it, idx) => {
      const pips = us.map(u => {
        const slots = slotsOf(u).filter(s => s.itemIdx === idx);
        const allDone = slots.length && slots.every(s => S.done.includes(s.id));
        const isCur = cur && cur.u.key === u.key && cur.itemIdx === idx;
        return `<i class="${allDone ? 'd' : isCur ? 'c' : ''}"></i>`;
      }).join('');
      const isNow = cur && cur.u.blockIndex === bi && cur.itemIdx === idx;
      const past = us.every(u => slotsOf(u).filter(s => s.itemIdx === idx).every(s => S.done.includes(s.id)));
      return `<button class="mrowx ${isNow ? 'now' : past ? 'past' : ''}" data-goto="${bi}:${idx}">
        <span class="mk">${esc(it.mark)}</span>
        <span class="nm">${esc(nameOf(it))}</span>
        <span class="dz">${esc(targetShort(it))}</span>
        <span class="pips">${pips}</span>
      </button>`;
    }).join('');
    return `<div class="mblock">
      <div class="mblock-h"><span>${label}</span><span>${fa(us.length)} ${first.blockType === 'single' ? 'ست' : 'دور'}</span></div>
      ${exes}
    </div>`;
  }).join('');

  const doneCount = S.done.length;
  const total = units.reduce((n, u) => n + u.items.length * S.athletes.length, 0);

  root.innerHTML = `
    <div class="map" role="dialog" aria-modal="true">
      <div class="map-panel">
        <div class="map-head">
          <div style="flex:1;min-width:0">
            <h3 style="font-size:17px">${esc(day.name)}</h3>
            <div class="small muted">${esc(program.name)} · هفتهٔ ${fa(S.week)} ·
              ${fa(doneCount)} از ${fa(total)} ست انجام شده · ${clock(remainingSeconds())} باقی‌مانده</div>
          </div>
          <button class="iconbtn" data-close aria-label="بستن">✕</button>
        </div>
        <div class="map-body">
          <div class="row wrap">
            <span class="chip"><span class="pips"><i class="d"></i></span> انجام‌شده</span>
            <span class="chip"><span class="pips"><i class="c"></i></span> همین حالا</span>
            <span class="chip"><span class="pips"><i></i></span> مانده</span>
          </div>
          ${blocks}
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  root.querySelector('[data-close]').onclick = close;
  root.querySelector('.map').addEventListener('click', e => {
    if (e.target === root.querySelector('.map')) close();
  });
  root.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => {
    const [bi, idx] = b.dataset.goto.split(':').map(Number);
    jumpTo(bi, idx);
    close();
    render(program, day);
  });
}

/** پرش به یک حرکت: واحدهای آن بلوک را جلو می‌آورد بدون حذف چیزی */
function jumpTo(blockIndex, itemIdx) {
  const target = units.filter(u => u.blockIndex === blockIndex);
  const open = target.find(u => slotsOf(u).some(s => s.itemIdx === itemIdx && !S.done.includes(s.id)));
  if (!open) return toast('همهٔ ست‌های این حرکت انجام شده است');
  const others = units.filter(u => u.key !== open.key);
  const ordered = [open, ...others.filter(u => !isUnitDone(u)), ...others.filter(isUnitDone)];
  S.order = ordered.map(u => u.key);
  units = ordered.map((u, i) => ({ ...u, i, total: ordered.length }));
  if (itemIdx > 0) reorderWithinUnit(open, itemIdx);
  S.phase = 'work'; S.restLeft = 0;
  rest2Stop();
  save();
}

const isUnitDone = u => slotsOf(u).every(s => S.done.includes(s.id));
function rest2Stop() { rest?.stop(); rest = null; }

/* ==================== منوها ==================== */

function moreMenu(program, day, slot) {
  sheet('گزینه‌های تمرین', `
    <div class="stack" style="gap:8px">
      <button class="btn block" data-a="swap">🔁 جایگزینی حرکت (دستگاه اشغال است)</button>
      <button class="btn block" data-a="move">↕️ جابه‌جایی ترتیب حرکت</button>
      <button class="btn block" data-a="add">➕ یک ست اضافه</button>
      <button class="btn block" data-a="skip">⏭ رد کردن این حرکت</button>
      <button class="btn block" data-a="info">📋 فرم اجرا و عضلات</button>
      <button class="btn block" data-a="map">🗺️ نقشهٔ کل برنامه</button>
      <button class="btn block danger" data-a="end">🏁 پایان جلسه</button>
    </div>`, (b, close) => {
    const on = (k, fn) => b.querySelector(`[data-a="${k}"]`)?.addEventListener('click', () => { close(); fn(); });
    on('swap', () => swapSheet(slot, program, day));
    on('move', () => moveSheet(slot, program, day));
    on('add', () => {
      if (slot.u.blockType !== 'single') return toast('ست اضافه فقط برای بلوک‌های تکی است', 'bad');
      S.extras[slot.it.ex.key] = (S.extras[slot.it.ex.key] || 0) + 1;
      build(day); toast('یک ست اضافه شد'); render(program, day);
    });
    on('skip', async () => {
      if (await confirmSheet('رد کردن حرکت',
        `همهٔ ست‌های «${nameOf(slot.it)}» از این جلسه حذف شود؟ حجم این عضله در جلسه کم می‌شود.`,
        { danger: true, okText: 'رد کن' })) {
        S.skipped = [...(S.skipped || []), slot.it.ex.key];
        build(day); render(program, day);
      }
    });
    on('info', () => exerciseSheet(slot.it.ex, { title: nameOf(slot.it) }));
    on('map', () => mapOverlay(program, day));
    on('end', async () => {
      if (await confirmSheet('پایان جلسه', 'جلسه با همین مقدار ثبت‌شده بسته شود؟', { okText: 'پایان' })) {
        finish(program, day);
      }
    });
  });
}

/* ---------- جایگزینی حرکت ---------- */

function swapSheet(slot, program, day) {
  const ex = slot.it.ex;
  const kb = lookup(ex.name, { muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment });
  const declared = (ex.alternatives || []).map(n => ({ fa: n, why: 'جایگزین اعلام‌شده در خود برنامه', declared: true }));
  // آنچه خود برنامه اعلام کرده دوباره در پیشنهادها تکرار نشود
  const taken = new Set([ex.name, ...(ex.alternatives || [])].map(normalize));
  const suggested = substitutesFor({ name: ex.name, muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment },
    { excludeName: ex.name }).filter(o => !taken.has(normalize(o.fa))).slice(0, 6);

  const card = (o, i, kind) => {
    const lf = o.declared ? null : loadFactor(kb, o);
    return `<button class="btn block" data-alt="${kind}:${i}" style="flex-direction:column;align-items:flex-start;gap:2px;min-height:auto;padding:11px 14px;text-align:start">
      <span style="font-weight:800">${esc(o.fa)}</span>
      <span class="tiny muted" style="font-weight:500">${esc(o.why)}${lf && lf.note ? ` — ${lf.note}` : ''}</span>
    </button>`;
  };

  sheet('جایگزینی حرکت', `
    <div class="stack">
      <div class="hint">
        جایگزین‌ها هم‌الگو با <b>${esc(kb.fa)}</b> (${esc(patternName(kb.pattern))}) انتخاب شده‌اند،
        پس عضلهٔ هدف و جای این حرکت در برنامه عوض نمی‌شود — فقط ابزارش فرق می‌کند.
        وزنه را با یک ست سبکِ تست تنظیم کن، نه با حدس.
      </div>
      ${S.subs[ex.key] ? `<button class="btn block ghost" data-reset>بازگشت به «${esc(ex.name)}»</button>` : ''}
      ${declared.length ? `<div class="sec-title">جایگزین‌های خود برنامه</div>
        ${declared.map((o, i) => card(o, i, 'd')).join('')}` : ''}
      ${suggested.length ? `<div class="sec-title">پیشنهاد دانش‌نامه (هم‌الگو)</div>
        ${suggested.map((o, i) => card(o, i, 's')).join('')}` : ''}
    </div>`, (b, close) => {
    b.querySelector('[data-reset]')?.addEventListener('click', () => {
      delete S.subs[ex.key]; save(); close(); render(program, day);
    });
    b.querySelectorAll('[data-alt]').forEach(btn => btn.onclick = () => {
      const [kind, i] = btn.dataset.alt.split(':');
      const o = kind === 'd' ? declared[+i] : suggested[+i];
      const lf = o.declared ? null : loadFactor(kb, o);
      S.subs[ex.key] = { name: o.fa, note: lf?.note || '' };
      save(); close();
      toast('حرکت جایگزین شد — برنامه دست‌نخورده می‌ماند', 'good');
      render(program, day);
    });
  });
}

/* ---------- جابه‌جایی ترتیب ---------- */

function moveSheet(slot, program, day) {
  const upcoming = [];
  const seen = new Set();
  units.forEach(u => {
    if (isUnitDone(u)) return;
    u.items.forEach((it, idx) => {
      const k = `${u.blockIndex}:${it.ex.key}`;
      if (seen.has(k) || it.ex.key === slot.it.ex.key) return;
      seen.add(k);
      upcoming.push({ u, idx, it });
    });
  });

  sheet('جابه‌جایی حرکت', `
    <div class="stack">
      <div class="hint">
        جابه‌جایی فقط <b>ترتیب</b> را عوض می‌کند: تعداد ست، وزنه و استراحت دست‌نخورده می‌ماند،
        پس حجم جلسه و پیشرفت برنامه تغییری نمی‌کند.
      </div>
      <div class="hint warn">
        دو نکتهٔ ایمنی: حرکات چندمفصلی و سنگین را تا حد امکان <b>قبل</b> از حرکات تک‌مفصلی همان عضله بزن،
        و اگر حرکتی را جلو انداختی، همان عضله را دوباره گرم کن — سرد رفتن سراغ وزنهٔ سنگین بیشترین ریسک آسیب را دارد.
      </div>
      <button class="btn block" data-a="later">این حرکت را به آخر جلسه ببر</button>
      ${upcoming.length ? `<div class="sec-title">به‌جایش الان این را بزن</div>
        ${upcoming.slice(0, 8).map((o, i) => `<button class="btn block" data-pull="${i}"
          style="flex-direction:column;align-items:flex-start;gap:2px;min-height:auto;padding:11px 14px;text-align:start">
          <span style="font-weight:800">${esc(o.it.mark)} — ${esc(nameOf(o.it))}</span>
          <span class="tiny muted" style="font-weight:500">${esc(targetShort(o.it))}</span>
        </button>`).join('')}` : ''}
    </div>`, (b, close) => {
    b.querySelector('[data-a="later"]').onclick = () => {
      const key = slot.it.ex.key;
      const mine = units.filter(u => u.items.some(it => it.ex.key === key) && !isUnitDone(u));
      const others = units.filter(u => !mine.includes(u));
      const ordered = [...others, ...mine];
      S.order = ordered.map(u => u.key);
      units = ordered.map((u, i) => ({ ...u, i, total: ordered.length }));
      S.phase = 'work'; S.restLeft = 0; rest2Stop(); save(); close();
      toast('به آخر جلسه منتقل شد');
      render(program, day);
    };
    b.querySelectorAll('[data-pull]').forEach(btn => btn.onclick = () => {
      const o = upcoming[+btn.dataset.pull];
      close();
      jumpTo(o.u.blockIndex, o.idx);
      render(program, day);
    });
  });
}

/* ---------- صفحات میله ---------- */

function platesSheet(it, override) {
  const st = store.settings();
  const target = override ?? it.set.weight;
  const res = computePlates(target, st.bar, st.plates);
  const body = !res
    ? `<p class="small muted">وزنهٔ هدف از وزن میله (${fa(st.bar)}${esc(st.unit)}) کمتر است — احتمالاً دمبل یا دستگاه است.</p>`
    : `<div class="target"><div class="lbl">هر طرف میله</div>
        <div class="big" style="font-size:28px">${res.perSide.length
          ? res.perSide.map(p => `${fa(num(p.w))}${p.n > 1 ? `×${fa(p.n)}` : ''}`).join(' + ')
          : 'فقط میله'}</div></div>
       <p class="small muted" style="margin-top:10px">میله ${fa(st.bar)} + صفحات = <b>${fa(num(res.achieved))}${esc(st.unit)}</b>
       ${res.exact ? '' : ' (نزدیک‌ترین ترکیب ممکن)'}</p>`;
  sheet('محاسبهٔ صفحات', body);
}

/* ==================== پایان ==================== */

function finish(program, day) {
  cleanup();
  const minutes = Math.max(1, Math.round((Date.now() - S.startedAt) / 60000));
  const setsDone = S.entries.length;
  const athletes = S.athletes;
  store.addSession({
    programId: S.programId, dayId: S.dayId, dayName: day.name, programName: program.name,
    week: S.week, startedAt: S.startedAt, endedAt: Date.now(), entries: S.entries,
    athletes: athletes.map(a => a.name), partner: S.partner,
  });
  store.setLive(null);

  const perAthlete = athletes.map(a => ({
    name: a.name,
    sets: S.entries.filter(e => (e.athlete || 'a') === a.id).length,
    volume: S.entries.filter(e => (e.athlete || 'a') === a.id)
      .reduce((n, e) => n + (e.weight || 0) * (e.reps || 0), 0),
  }));

  const pid = program.id, did = day.id;
  const partner = S.partner;
  S = null; units = [];
  location.hash = `/p/${pid}/d/${did}`;
  setTimeout(() => sheet('جلسه تمام شد 💪', `
    <div class="metrics">
      <div class="metric"><div class="v">${fa(setsDone)}</div><div class="k">ست ثبت‌شده</div></div>
      <div class="metric"><div class="v">${fa(minutes)}</div><div class="k">دقیقه</div></div>
      <div class="metric"><div class="v">${clockOfDay(Date.now())}</div><div class="k">ساعت پایان</div></div>
    </div>
    ${partner ? `<div class="stack" style="margin-top:12px">
      ${perAthlete.map((a, i) => `<div class="row">
        <span class="avatar sm ${i ? 'b' : 'a'}">${esc(initial(a.name))}</span>
        <span style="flex:1">${esc(a.name)}</span>
        <span class="chip">${fa(a.sets)} ست</span>
        ${a.volume ? `<span class="chip accent">${fa(Math.round(a.volume))}kg</span>` : ''}
      </div>`).join('')}
    </div>` : ''}
    <button class="btn primary block" style="margin-top:14px" data-ok>عالی</button>`,
    (b, close) => { b.querySelector('[data-ok]').onclick = close; }), 60);
}
