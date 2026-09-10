// نمای برنامه (انتخاب هفته و روز) و نمای جدولی روز
import { shell, emptyState } from './shell.js';
import { store } from '../store.js';
import { resolveProgram, estimateDuration, countSets } from '../resolve.js';
import { condenseBlock, mergeBlocks, weekDeltas } from '../condense.js';
import { esc, fa, num, durShort, clockOfDay } from '../util.js';
import { sheet } from '../ui.js';
import { adviceCard } from '../daily.js';
import { exerciseSheet, techniqueText } from './exercise.js';
import { lookup } from '../exdb.js';
import { muscleName } from '../muscles.js';

const weekState = new Map();
export const weekOf = id => weekState.get(id) || 1;
const setWeek = (id, w) => weekState.set(id, w);

const detail = new Map();   // نمای فشرده/کامل هر روز

export { techniqueText };

export function programView({ id }) {
  const p = store.program(id);
  if (!p) return notFound();
  store.setActive(id);

  const week = weekOf(id);
  const model = resolveProgram(p, week, store.settings());
  const totalSets = model.days.reduce((n, d) => n + countSets(d), 0);
  const totalTime = model.days.reduce((n, d) => n + estimateDuration(d), 0);

  const body = `
    <div class="stack">
      <div class="hero">
        <h2>${esc(model.name)}</h2>
        ${model.note ? `<p class="small muted" style="margin-top:6px">${esc(model.note)}</p>` : ''}
        <div class="metrics">
          <div class="metric"><div class="v">${fa(model.days.length)}</div><div class="k">روز</div></div>
          <div class="metric"><div class="v">${fa(totalSets)}</div><div class="k">ست در هفته</div></div>
          <div class="metric"><div class="v">${fa(Math.round(totalTime / 60))}</div><div class="k">دقیقه تخمینی</div></div>
        </div>
      </div>

      ${model.weeks > 1 ? `
      <div>
        <div class="sec-title" style="margin-bottom:6px">هفته</div>
        <div class="scroller">
          ${Array.from({ length: model.weeks }, (_, i) => i + 1).map(w => `
            <button class="chip ${w === week ? 'on' : ''}" data-week="${w}">
              هفتهٔ ${fa(w)}${isDeloadWeek(p, w) ? ' · دیلود' : ''}
            </button>`).join('')}
        </div>
      </div>` : ''}

      <button class="btn block" data-overview>🗺️ نمای کلی هفته — همهٔ روزها در یک جدول</button>

      <div class="stack">
        ${model.days.map(d => dayCard(id, d)).join('')}
      </div>
    </div>`;

  const root = shell({ title: model.name, sub: `هفتهٔ ${fa(week)} از ${fa(model.weeks)}`, back: '/', body });
  root.querySelectorAll('[data-week]').forEach(b => {
    b.onclick = () => { setWeek(id, +b.dataset.week); programView({ id }); };
  });
  root.querySelector('[data-overview]').onclick = () => overviewSheet(model, week);
  root.querySelectorAll('[data-day]').forEach(b => {
    b.onclick = () => { location.hash = `/p/${id}/d/${b.dataset.day}`; };
  });
  root.querySelectorAll('[data-gym]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); location.hash = `/gym/${id}/${b.dataset.gym}`; };
  });
}

function isDeloadWeek(p, w) {
  const d = p?.weeks?.deload;
  if (!d) return false;
  const x = d.week ?? d.weeks;
  return Array.isArray(x) ? x.includes(w) : x === w;
}

function dayCard(pid, d) {
  const sets = countSets(d);
  const secs = estimateDuration(d);
  const muscles = [...new Set(d.blocks.flatMap(b => b.exercises.map(e => e.muscle).filter(Boolean)))];
  const ss = d.blocks.filter(b => b.type !== 'single').length;
  return `<div class="card" data-day="${esc(d.id)}" role="button" tabindex="0">
    <div class="row">
      <div style="flex:1;min-width:0">
        <h3 style="font-size:16px">${esc(d.name)}</h3>
        <div class="small muted">${fa(sets)} ست · حدود ${fa(Math.round(secs / 60))} دقیقه · پایان حدود ${clockOfDay(Date.now() + secs * 1000)}</div>
        <div class="row wrap" style="gap:6px;margin-top:8px">
          ${ss ? `<span class="chip accent">${fa(ss)} بلوک سوپرست</span>` : ''}
          ${muscles.slice(0, 4).map(m => `<span class="chip">${esc(m)}</span>`).join('')}
        </div>
      </div>
      <button class="btn primary sm" data-gym="${esc(d.id)}">شروع</button>
    </div>
  </div>`;
}

/* ---------- نمای کلی هفته ---------- */

function overviewSheet(model, week) {
  const cols = model.days.map(d => {
    const items = mergeBlocks(d.blocks).flatMap(b => b.exercises.map(ex => {
      const g = groupSize(b);
      return `<li><b>${esc(ex._mark || '')}</b><span style="min-width:0">${esc(ex.name)}
        <span class="muted"> — ${esc(shortDose(b, ex))}</span></span></li>`;
    }));
    return `<td><div class="daycol">
      <div style="font-weight:800;font-size:12.5px;margin-bottom:6px">${esc(d.name)}</div>
      <div class="small muted" style="margin-bottom:6px">${fa(countSets(d))} ست · ${fa(Math.round(estimateDuration(d) / 60))}′</div>
      <ul>${items.join('')}</ul>
    </div></td>`;
  }).join('');

  sheet(`نمای کلی — هفتهٔ ${fa(week)}`, `
    <div class="weekgrid">
      <table><thead><tr>${model.days.map(d => `<th>${esc(d.name)}</th>`).join('')}</tr></thead>
      <tbody><tr>${cols}</tr></tbody></table>
    </div>
    <p class="tiny muted" style="margin-top:10px">برای دیدن جزئیات هر روز، روی کارت آن روز بزن.</p>`);
}

const groupSize = b => (b.type === 'single' ? 1 : b.exercises.length);

function shortDose(block, ex) {
  const n = block.type === 'single' ? ex.sets.length : (block.rounds || 1);
  if (ex.mode === 'cardio') return `${fa(n)}×`;
  const s = ex.sets[0] || {};
  const core = ex.mode === 'time' ? durShort(s.duration) : fa(s.reps ?? '—');
  return `${fa(n)}×${core}${s.weight != null ? `@${fa(num(s.weight))}` : ''}`;
}

/* ---------- نمای روز ---------- */

export function dayView({ id, dayId }) {
  const p = store.program(id);
  if (!p) return notFound();
  const week = weekOf(id);
  const settings = store.settings();
  const model = resolveProgram(p, week, settings);
  const day = model.days.find(d => d.id === dayId);
  if (!day) return notFound();

  const deltas = week > 1 ? weekDeltas(model, resolveProgram(p, week - 1, settings)) : new Map();
  const full = detail.get(dayId) || false;
  const secs = estimateDuration(day);

  const body = `
    <div class="stack">
      <div class="timeline">
        <div class="t-cell"><div class="v">${clockOfDay(Date.now())}</div><div class="k">اگر الان شروع کنی</div></div>
        <div class="t-cell t-mid"><div class="v">${fa(Math.round(secs / 60))}′</div><div class="k">مدت تخمینی</div></div>
        <div class="t-cell"><div class="v">${clockOfDay(Date.now() + secs * 1000)}</div><div class="k">پایان تخمینی</div></div>
      </div>

      ${settings.showAdvice ? adviceCard(day) : ''}

      <div class="row wrap">
        <div class="seg">
          <button data-view="0" class="${full ? '' : 'on'}">فشرده</button>
          <button data-view="1" class="${full ? 'on' : ''}">ست‌به‌ست</button>
        </div>
        <span class="spacer"></span>
        <span class="chip">${fa(countSets(day))} ست</span>
      </div>

      ${day.note ? `<div class="hint">${esc(day.note)}</div>` : ''}
      ${mergeBlocks(day.blocks).map(b => blockTable(b, deltas, full)).join('')}
      <button class="btn primary block lg" data-gym>شروع مود باشگاه</button>
    </div>`;

  const root = shell({ title: day.name, sub: `${model.name} · هفتهٔ ${fa(week)}`, back: `/p/${id}`, body });
  root.querySelector('[data-gym]').onclick = () => { location.hash = `/gym/${id}/${dayId}`; };
  root.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => { detail.set(dayId, b.dataset.view === '1'); dayView({ id, dayId }); };
  });
  root.querySelectorAll('[data-ex]').forEach(b => {
    b.onclick = () => {
      const ex = day.blocks.flatMap(x => x.exercises).find(e => e.key === b.dataset.ex);
      if (ex) exerciseSheet(ex);
    };
  });
}

/* ---------- جدول بلوک ---------- */

function blockTable(block, deltas, full) {
  const c = condenseBlock(block);
  const label = block.type === 'single' ? 'تکی' : (block.type === 'superset' ? 'سوپرست' : 'سیرکویت');
  const grouped = block.type !== 'single';

  return `<div class="block">
    <div class="block-head">
      <span class="tag ${block.type}">${label}</span>
      ${grouped ? `<span class="meta">${esc(groupLabel(block))}</span>` : ''}
      ${c.header.map(h => `<span class="meta">${esc(h.text)}</span>`).join('<span class="meta">·</span>')}
    </div>
    ${block.note ? `<div class="small muted" style="padding:8px 14px 0">${esc(block.note)}</div>` : ''}
    <div class="tablewrap">
      <table class="plan">
        <thead><tr>
          ${grouped ? '<th class="rail"><span class="sr">گروه</span></th>' : ''}
          <th class="ex">حرکت</th>
          <th>ست</th>
          <th>تکرار</th>
          <th>وزنه</th>
          <th>استراحت</th>
        </tr></thead>
        <tbody>${full ? fullRows(block, deltas, grouped) : condensedRows(block, c, deltas, grouped)}</tbody>
      </table>
    </div>
  </div>`;
}

/** «A1+A2+A3 با هم، ۴ دور» — تا کاربر بفهمد دقیقاً چه چیزی با چه چیزی جفت است */
function groupLabel(block) {
  const marks = block.exercises.map((e, i) => e._mark || `${'ABCDEFGH'[block.index % 8]}${i + 1}`);
  return `${marks.join(' + ')} با هم · ${fa(block.rounds || block.exercises[0]?.sets.length || 1)} دور`;
}

function railCell(i, n) {
  const cls = n < 2 ? '' : i === 0 ? 'g-start' : i === n - 1 ? 'g-end' : 'g-mid';
  return { cls, cell: '<td class="rail"><i></i></td>' };
}

function condensedRows(block, c, deltas, grouped) {
  const n = block.exercises.length;
  return c.rows.map((r, i) => {
    const rail = railCell(i, grouped ? n : 1);
    const ex = r.ex;
    const s = ex.sets[0] || {};
    const setsTxt = block.type === 'single' ? fa(ex.sets.length) : `${fa(block.rounds || 1)} دور`;
    return `<tr class="${grouped ? (block.type === 'circuit' ? rail.cls.replace('g-', 'c-') : rail.cls) : ''} ${i % 2 ? 'alt' : ''}">
      ${grouped ? rail.cell : ''}
      <td class="ex">
        <button class="ex-name" data-ex="${esc(r.key)}">
          <span class="ex-mark ${grouped ? (block.type === 'circuit' ? 'circuit' : 'grouped') : ''}">${esc(r.mark)}</span>
          <span>${esc(r.name)}</span>
        </button>
        <div class="ex-sub">${esc(subLine(ex))}</div>
        ${tags(r)}
      </td>
      <td class="n">${setsTxt}</td>
      <td class="n">${esc(repsCell(ex))}${deltaBadge(deltas.get(r.key))}</td>
      <td class="n">${esc(weightCell(ex))}</td>
      <td class="n">${esc(restCell(block, ex))}</td>
    </tr>`;
  }).join('');
}

function fullRows(block, deltas, grouped) {
  const n = block.exercises.length;
  return block.exercises.map((ex, ei) => {
    const rail = railCell(ei, grouped ? n : 1);
    const mark = ex._mark ?? ('ABCDEFGH'[block.index % 8] + (block.type === 'single' ? '' : ei + 1));
    return ex.sets.map((s, si) => `<tr class="${si === 0 ? (grouped ? (block.type === 'circuit' ? rail.cls.replace('g-', 'c-') : rail.cls) : '') : ''} ${ei % 2 ? 'alt' : ''}">
      ${grouped ? (si === 0 ? rail.cell : '<td class="rail"><i></i></td>') : ''}
      <td class="ex">${si === 0 ? `
        <button class="ex-name" data-ex="${esc(ex.key)}">
          <span class="ex-mark ${grouped ? (block.type === 'circuit' ? 'circuit' : 'grouped') : ''}">${esc(mark)}</span>
          <span>${esc(ex.name)}</span>
        </button>
        <div class="ex-sub">${esc(subLine(ex))}</div>` : '<span class="muted small">↳</span>'}
      </td>
      <td class="n">${fa(si + 1)}</td>
      <td class="n">${esc(setCore(ex, s))}${si === 0 ? deltaBadge(deltas.get(ex.key)) : ''}</td>
      <td class="n">${s.weight != null ? `${fa(num(s.weight))}${esc(ex.unit || 'kg')}` : '—'}</td>
      <td class="n">${s.rest ? esc(durShort(s.rest)) : '—'}</td>
    </tr>`).join('');
  }).join('');
}

/** چیپ‌های حرکت (تکنیک، شدت، تمپو، جایگزین) — داخل ستون حرکت تا جدول باریک بماند */
function tags(r) {
  const list = [
    ...(r.effort ? [{ text: r.effort, cls: '' }] : []),
    ...(r.tempo ? [{ text: r.tempo, cls: '' }] : []),
    ...r.chips,
    ...(r.alts ? [{ text: r.alts, cls: '' }] : []),
  ];
  if (!list.length) return '';
  return `<div class="row wrap" style="gap:4px;margin-top:5px">
    ${list.map(c => `<span class="chip" style="padding:2px 8px;font-size:10.5px">${esc(c.text)}</span>`).join('')}
  </div>`;
}

/** زیرنویس حرکت: عضلهٔ اصلی از دانش‌نامه، وگرنه فیلد muscle خود برنامه */
function subLine(ex) {
  const kb = lookup(ex.name, { muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment });
  const top = Object.entries(kb.primary || {}).sort((a, b) => b[1] - a[1])[0];
  const m = top ? muscleName(top[0]) : ex.muscle;
  return [m, ex.equipment || kb.equip].filter(Boolean).join(' · ');
}

function setCore(ex, s) {
  if (ex.mode === 'time') return durShort(s.duration);
  if (ex.mode === 'cardio') {
    return [s.duration && durShort(s.duration), s.distance && `${fa(num(s.distance))}م`,
      s.speed && `${fa(num(s.speed))}km/h`].filter(Boolean).join(' · ') || '—';
  }
  return fa(s.reps ?? '—');
}

/** اگر همهٔ ست‌ها یکسان‌اند یک مقدار، وگرنه «۱۲/۱۰/۸» */
function uniq(ex, get) {
  const vals = ex.sets.map(get);
  const set = [...new Set(vals.map(v => String(v ?? '')))];
  return set.length === 1 ? set[0] : vals.map(v => (v ?? '—')).join('/');
}

function repsCell(ex) {
  if (ex.mode === 'cardio') return setCore(ex, ex.sets[0] || {});
  if (ex.mode === 'time') return uniq(ex, s => durShort(s.duration));
  return fa(uniq(ex, s => s.reps ?? '—'));
}

function weightCell(ex) {
  if (ex.sets.every(s => s.weight == null)) return '—';
  return `${fa(uniq(ex, s => (s.weight != null ? num(s.weight) : '—')))}${ex.unit || 'kg'}`;
}

function restCell(block, ex) {
  const v = [...new Set(ex.sets.map(s => s.rest).filter(Boolean))];
  if (!v.length) return block.rest ? durShort(block.rest) : '—';
  return v.map(durShort).join('/');
}

function deltaBadge(d) {
  if (!d) return '';
  if (d.type === 'weight') {
    const up = d.diff > 0;
    return `<span class="delta ${up ? '' : 'down'}">${up ? '▲' : '▼'} ${fa(num(Math.abs(d.diff)))}</span>`;
  }
  return `<span class="delta">▲ ${fa(d.from)}→${fa(d.to)}</span>`;
}

function notFound() {
  shell({ title: 'یافت نشد', back: '/', body: emptyState('🤷', 'این صفحه پیدا نشد', 'شاید برنامه حذف شده باشد.') });
}
