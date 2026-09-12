// نمای برنامه (انتخاب هفته و روز) و نمای جدولی روز
import { shell, emptyState } from './shell.js';
import { store } from '../store.js';
import { resolveProgram, estimateDuration, countSets } from '../resolve.js';
import { condenseBlock, mergeBlocks, weekDeltas, TECH_LABEL } from '../condense.js';
import { esc, fa, num, dur, safeUrl } from '../util.js';
import { sheet, toast } from '../ui.js';
import { mountMedia } from '../media.js';

const weekState = new Map();
export const weekOf = id => weekState.get(id) || 1;
const setWeek = (id, w) => weekState.set(id, w);

const detail = new Map();   // نمای فشرده/کامل هر روز

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
        <div class="small muted" style="margin-bottom:6px">هفته</div>
        <div class="scroller">
          ${Array.from({ length: model.weeks }, (_, i) => i + 1).map(w => `
            <button class="chip ${w === week ? 'on' : ''}" data-week="${w}">
              هفتهٔ ${fa(w)}${isDeloadWeek(p, w) ? ' · دیلود' : ''}
            </button>`).join('')}
        </div>
      </div>` : ''}

      <div class="stack">
        ${model.days.map(d => dayCard(id, d)).join('')}
      </div>
    </div>`;

  const root = shell({ title: model.name, sub: `هفتهٔ ${fa(week)} از ${fa(model.weeks)}`, back: '/', body });
  root.querySelectorAll('[data-week]').forEach(b => {
    b.onclick = () => { setWeek(id, +b.dataset.week); programView({ id }); };
  });
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
  const mins = Math.round(estimateDuration(d) / 60);
  const muscles = [...new Set(d.blocks.flatMap(b => b.exercises.map(e => e.muscle).filter(Boolean)))];
  return `<div class="card" data-day="${esc(d.id)}" role="button" tabindex="0">
    <div class="row">
      <div style="flex:1;min-width:0">
        <h3 style="font-size:16px">${esc(d.name)}</h3>
        <div class="small muted">${fa(sets)} ست · حدود ${fa(mins)} دقیقه</div>
        ${muscles.length ? `<div class="row wrap" style="gap:6px;margin-top:8px">
          ${muscles.slice(0, 4).map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="btn primary sm" data-gym="${esc(d.id)}">شروع</button>
    </div>
  </div>`;
}

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

  const body = `
    <div class="stack">
      <div class="row wrap">
        <button class="chip ${full ? '' : 'on'}" data-view="0">فشرده</button>
        <button class="chip ${full ? 'on' : ''}" data-view="1">کامل</button>
        <span class="spacer"></span>
        <span class="chip">${fa(countSets(day))} ست</span>
        <span class="chip">${fa(Math.round(estimateDuration(day) / 60))} دقیقه</span>
      </div>
      ${day.note ? `<div class="hint">${esc(day.note)}</div>` : ''}
      ${mergeBlocks(day.blocks).map(b => blockTable(b, deltas, full)).join('')}
      <button class="btn primary block" data-gym>شروع مود باشگاه</button>
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

function blockTable(block, deltas, full) {
  const c = condenseBlock(block);
  const label = block.type === 'single' ? 'تکی' : (block.type === 'superset' ? 'سوپرست' : 'سیرکویت');
  const rows = full ? fullRows(block, deltas) : condensedRows(c, deltas);
  return `<div class="block">
    <div class="block-head">
      <span class="tag ${block.type}">${label}</span>
      ${c.header.map(h => `<span class="meta">${esc(h.text)}</span>`).join('<span class="meta">·</span>')}
    </div>
    ${block.note ? `<div class="small muted" style="padding:8px 14px 0">${esc(block.note)}</div>` : ''}
    <div class="tablewrap">
      <table class="plan">
        <thead><tr>
          <th class="ex">حرکت</th>
          <th>${full ? 'ست' : 'ست‌ها و پارامترها'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function condensedRows(c, deltas) {
  return c.rows.map(r => {
    // هر تکه در bdi تا اعداد/حروف لاتین ترتیب جملهٔ راست‌چین را به‌هم نریزند
    const meta = [r.rest, r.tempo, r.effort, r.alts].filter(Boolean)
      .map(t => `<bdi>${esc(t)}</bdi>`).join(' · ');
    return `<tr>
      <td class="ex">
        <button class="ex-name" data-ex="${esc(r.key)}" style="text-align:start">
          <span class="ex-mark">${esc(r.mark)}</span><span>${esc(r.name)}</span>
        </button>
        ${r.sub ? `<div class="ex-sub">${esc(r.sub)}</div>` : ''}
      </td>
      <td>
        <div class="dose">${esc(r.dose)}${deltaBadge(deltas.get(r.key))}</div>
        ${meta ? `<div class="ex-sub">${meta}</div>` : ''}
        ${r.chips.length ? `<div class="row wrap" style="gap:5px;margin-top:6px">
          ${r.chips.map(ch => `<span class="chip ${ch.cls}">${esc(ch.text)}</span>`).join('')}</div>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function fullRows(block, deltas) {
  return block.exercises.map((ex, ei) => {
    const mark = ex._mark ?? ('ABCDEFGH'[block.index % 8] + (block.type === 'single' ? '' : ei + 1));
    return ex.sets.map((s, si) => `<tr>
      <td class="ex">${si === 0 ? `
        <div class="ex-name"><span class="ex-mark">${esc(mark)}</span><span>${esc(ex.name)}</span></div>
        ${ex.muscle ? `<div class="ex-sub">${esc(ex.muscle)}</div>` : ''}` : '<span class="muted small">↳</span>'}
      </td>
      <td class="dose">${esc(setText(ex, s, si))}${si === 0 ? deltaBadge(deltas.get(ex.key)) : ''}</td>
    </tr>`).join('');
  }).join('');
}

function setText(ex, s, i) {
  const unit = ex.unit || 'kg';
  const core = ex.mode === 'time' ? dur(s.duration)
    : ex.mode === 'cardio' ? [s.duration && dur(s.duration), s.distance && `${fa(num(s.distance))}م`, s.speed && `${fa(num(s.speed))}km/h`].filter(Boolean).join(' · ')
    : fa(s.reps ?? '—');
  const load = s.weight != null ? ` @ ${fa(num(s.weight))}${unit}` : '';
  const rest = s.rest ? ` · استراحت ${dur(s.rest)}` : '';
  return `ست ${fa(i + 1)}: ${core}${load}${rest}`;
}

function deltaBadge(d) {
  if (!d) return '';
  if (d.type === 'weight') {
    const up = d.diff > 0;
    return `<span class="delta ${up ? '' : 'down'}">${up ? '▲' : '▼'} ${fa(num(Math.abs(d.diff)))}</span>`;
  }
  return `<span class="delta">▲ ${fa(d.from)}→${fa(d.to)}</span>`;
}

export function exerciseSheet(ex) {
  const vid = safeUrl(ex.media?.video);
  sheet(ex.name, `
    <div class="stack">
      ${ex.sub || ex.muscle || ex.equipment ? `<div class="row wrap" style="gap:6px">
        ${[ex.muscle, ex.equipment].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
      </div>` : ''}
      <div data-media></div>
      ${ex.cue ? `<div class="hint"><b>فرم اجرا:</b> ${esc(ex.cue)}</div>` : ''}
      ${ex.technique ? `<div class="hint"><b>${esc(TECH_LABEL[ex.technique.type] || ex.technique.type)}:</b> ${esc(techniqueText(ex.technique))}</div>` : ''}
      ${ex.alternatives.length ? `<div>
        <div class="small muted" style="margin-bottom:6px">حرکات جایگزین</div>
        <div class="row wrap" style="gap:6px">${ex.alternatives.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
      </div>` : ''}
      ${vid ? `<a class="btn block" href="${esc(vid)}" target="_blank" rel="noopener noreferrer">تماشای ویدیوی حرکت ↗</a>` : ''}
    </div>`, body => mountMedia(body, ex));
}

export function techniqueText(t) {
  if (!t) return '';
  if (t.type === 'drop') {
    return t.drops.map((d, i) => `مرحلهٔ ${i + 1}: کاهش ${d.reduce ?? '—'} تا ${d.reps ?? 'ناتوانی'}`).join(' ← ');
  }
  if (t.type === 'restPause') return `${fa(t.pauses ?? 2)} وقفهٔ ${fa(t.rest ?? 15)} ثانیه‌ای تا ناتوانی`;
  if (t.type === 'cluster') return `${fa(t.clusters ?? 4)} خوشهٔ ${fa(t.repsPer ?? 2)} تکراری با ${fa(t.rest ?? 20)} ثانیه مکث`;
  return '';
}

function notFound() {
  shell({ title: 'یافت نشد', back: '/', body: emptyState('🤷', 'این صفحه پیدا نشد', 'شاید برنامه حذف شده باشد.') });
}
