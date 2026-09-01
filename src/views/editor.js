// ویرایشگر داخلی: ساخت/ویرایش برنامه بدون فایل + تب JSON خام
import { shell } from './shell.js';
import { store } from '../store.js';
import { validate, parseProgram, MODES, BLOCK_TYPES, TECHNIQUES, PROGRESSIONS } from '../schema.js';
import { esc, fa, uid } from '../util.js';
import { toast, sheet, confirmSheet, errorList } from '../ui.js';

let draft = null;
let tab = 'form';

const BLANK = () => ({
  schema: 'fitmeat/v1',
  name: 'برنامهٔ من',
  defaults: { rest: 90, unit: 'kg' },
  weeks: { count: 1, progression: { type: 'none', increment: 2.5 } },
  days: [{ id: 'd1', name: 'روز ۱', blocks: [newBlock()] }],
});

const newBlock = () => ({ type: 'single', rounds: 3, exercises: [newExercise()] });
const newExercise = () => ({ name: 'حرکت جدید', mode: 'reps', reps: '8-10' });

export function editorView({ id }) {
  if (id === 'new') draft = draft?.__new ? draft : Object.assign(BLANK(), { __new: true });
  else {
    const p = store.program(id);
    if (!p) { location.hash = '/'; return; }
    if (!draft || draft.id !== p.id) draft = JSON.parse(JSON.stringify(p));
  }
  render(id);
}

function render(id) {
  const body = `
    <div class="stack">
      <div class="row">
        <button class="chip ${tab === 'form' ? 'on' : ''}" data-tab="form">ساختار</button>
        <button class="chip ${tab === 'json' ? 'on' : ''}" data-tab="json">JSON خام</button>
      </div>
      ${tab === 'form' ? formTab() : jsonTab()}
    </div>`;

  const root = shell({
    title: id === 'new' ? 'برنامهٔ جدید' : 'ویرایش برنامه',
    sub: draft.name, back: '/',
    actions: `<button class="btn primary sm" data-save>ذخیره</button>`,
    body,
  });

  document.querySelector('[data-save]').onclick = () => saveDraft();
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(id); });

  if (tab === 'json') {
    const ta = root.querySelector('#raw');
    const out = root.querySelector('#rawmsg');
    const check = () => {
      const res = parseProgram(ta.value);
      out.innerHTML = res.ok
        ? `<div class="hint">✅ ساختار معتبر است — ${fa(res.data.days.length)} روز</div>`
        : errorList(res.errors);
    };
    ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(check, 350); });
    check();
    root.querySelector('#apply').onclick = () => {
      const res = parseProgram(ta.value);
      if (!res.ok) return toast('اول خطاها را رفع کنید', 'bad');
      draft = { ...res.data, id: draft.id, __new: draft.__new };
      tab = 'form'; toast('اعمال شد'); render(id);
    };
    return;
  }

  bindForm(root, id);
}

/* ---------- تب ساختار ---------- */

function formTab() {
  return `
    <div class="card stack">
      <div class="field"><label>نام برنامه</label>
        <input class="input" id="p-name" value="${esc(draft.name || '')}"></div>
      <div class="grid2">
        <div class="field"><label>استراحت پیش‌فرض (ثانیه)</label>
          <input class="input num" id="p-rest" type="number" value="${draft.defaults?.rest ?? 90}"></div>
        <div class="field"><label>تعداد هفته</label>
          <input class="input num" id="p-weeks" type="number" min="1" value="${draft.weeks?.count ?? 1}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>قانون پیشرفت</label>
          <select class="input" id="p-prog">
            ${PROGRESSIONS.map(t => `<option value="${t}" ${(draft.weeks?.progression?.type || 'none') === t ? 'selected' : ''}>${progLabel(t)}</option>`).join('')}
          </select></div>
        <div class="field"><label>گام افزایش وزنه</label>
          <input class="input num" id="p-inc" type="number" step="any" value="${draft.weeks?.progression?.increment ?? 2.5}"></div>
      </div>
      <div class="field"><label>هفتهٔ دیلود (خالی = ندارد)</label>
        <input class="input num" id="p-deload" type="number" min="0" value="${draft.weeks?.deload?.week ?? ''}"></div>
    </div>

    ${(draft.days || []).map((d, di) => dayCard(d, di)).join('')}
    <button class="btn block" data-add-day>➕ افزودن روز</button>`;
}

const progLabel = t => ({ none: 'بدون پیشرفت', linear: 'خطی', double: 'دوگانه (تکرار سپس وزنه)', percent: 'درصدی از ۱RM' }[t] || t);
const typeLabel = t => ({ single: 'تکی', superset: 'سوپرست', circuit: 'سیرکویت' }[t] || t);
const modeLabel = m => ({ reps: 'تکراری', time: 'زمانی', cardio: 'هوازی' }[m] || m);

function dayCard(d, di) {
  return `<div class="card stack">
    <div class="row">
      <input class="input" data-day-name="${di}" value="${esc(d.name || '')}" style="flex:1">
      <button class="iconbtn" data-day-up="${di}" aria-label="بالا">↑</button>
      <button class="iconbtn" data-day-del="${di}" aria-label="حذف">🗑</button>
    </div>
    ${(d.blocks || []).map((b, bi) => blockCard(b, di, bi)).join('')}
    <button class="btn sm block" data-add-block="${di}">➕ بلوک</button>
  </div>`;
}

function blockCard(b, di, bi) {
  return `<div class="block">
    <div class="block-head">
      <select class="chip" data-block-type="${di}.${bi}" style="min-height:32px">
        ${BLOCK_TYPES.map(t => `<option value="${t}" ${(b.type || 'single') === t ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}
      </select>
      <label class="meta">دور <input class="num" data-block-rounds="${di}.${bi}" type="number" min="1"
        value="${b.rounds ?? 3}" style="width:46px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:2px 6px"></label>
      <label class="meta">استراحت <input class="num" data-block-rest="${di}.${bi}" type="number" min="0"
        value="${b.rest ?? ''}" style="width:56px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:2px 6px"></label>
      <span class="spacer"></span>
      <button class="iconbtn" data-block-del="${di}.${bi}" aria-label="حذف بلوک">🗑</button>
    </div>
    <div style="padding:10px 12px" class="stack">
      ${(b.exercises || []).map((e, ei) => `
        <div class="row">
          <button class="btn sm" style="flex:1;justify-content:flex-start" data-ex="${di}.${bi}.${ei}">
            ${esc(e.name)} <span class="muted small">· ${modeLabel(e.mode || 'reps')}</span>
          </button>
          <button class="iconbtn" data-ex-up="${di}.${bi}.${ei}" aria-label="بالا">↑</button>
          <button class="iconbtn" data-ex-del="${di}.${bi}.${ei}" aria-label="حذف">🗑</button>
        </div>`).join('')}
      <button class="btn sm block" data-add-ex="${di}.${bi}">➕ حرکت</button>
    </div>
  </div>`;
}

function bindForm(root, id) {
  const re = () => render(id);
  const idx = s => s.split('.').map(Number);

  root.querySelector('#p-name').oninput = e => { draft.name = e.target.value; };
  root.querySelector('#p-rest').onchange = e => {
    draft.defaults = { ...draft.defaults, rest: +e.target.value || 0 };
  };
  root.querySelector('#p-weeks').onchange = e => {
    draft.weeks = { ...draft.weeks, count: Math.max(1, +e.target.value || 1) };
  };
  root.querySelector('#p-prog').onchange = e => {
    draft.weeks = { ...draft.weeks, progression: { ...draft.weeks?.progression, type: e.target.value } };
  };
  root.querySelector('#p-inc').onchange = e => {
    draft.weeks = { ...draft.weeks, progression: { ...draft.weeks?.progression, increment: +e.target.value || 2.5 } };
  };
  root.querySelector('#p-deload').onchange = e => {
    const w = +e.target.value;
    draft.weeks = { ...draft.weeks };
    if (w > 0) draft.weeks.deload = { week: w, volume: 0.6, intensity: 0.9 };
    else delete draft.weeks.deload;
  };

  root.querySelector('[data-add-day]').onclick = () => {
    draft.days.push({ id: `d${draft.days.length + 1}-${uid().slice(0, 3)}`, name: `روز ${fa(draft.days.length + 1)}`, blocks: [newBlock()] });
    re();
  };
  root.querySelectorAll('[data-day-name]').forEach(el => el.oninput = e => { draft.days[+el.dataset.dayName].name = e.target.value; });
  root.querySelectorAll('[data-day-up]').forEach(el => el.onclick = () => {
    const i = +el.dataset.dayUp; if (i > 0) { const [d] = draft.days.splice(i, 1); draft.days.splice(i - 1, 0, d); re(); }
  });
  root.querySelectorAll('[data-day-del]').forEach(el => el.onclick = async () => {
    const i = +el.dataset.dayDel;
    if (await confirmSheet('حذف روز', `«${draft.days[i].name}» حذف شود؟`, { danger: true, okText: 'حذف' })) {
      draft.days.splice(i, 1); if (!draft.days.length) draft.days.push(BLANK().days[0]); re();
    }
  });

  root.querySelectorAll('[data-add-block]').forEach(el => el.onclick = () => {
    draft.days[+el.dataset.addBlock].blocks.push(newBlock()); re();
  });
  root.querySelectorAll('[data-block-type]').forEach(el => el.onchange = e => {
    const [di, bi] = idx(el.dataset.blockType);
    const b = draft.days[di].blocks[bi];
    b.type = e.target.value;
    if (b.type !== 'single' && b.exercises.length < 2) b.exercises.push(newExercise());
    re();
  });
  root.querySelectorAll('[data-block-rounds]').forEach(el => el.onchange = e => {
    const [di, bi] = idx(el.dataset.blockRounds);
    draft.days[di].blocks[bi].rounds = Math.max(1, +e.target.value || 1);
  });
  root.querySelectorAll('[data-block-rest]').forEach(el => el.onchange = e => {
    const [di, bi] = idx(el.dataset.blockRest);
    const v = e.target.value === '' ? undefined : +e.target.value;
    if (v === undefined) delete draft.days[di].blocks[bi].rest; else draft.days[di].blocks[bi].rest = v;
  });
  root.querySelectorAll('[data-block-del]').forEach(el => el.onclick = () => {
    const [di, bi] = idx(el.dataset.blockDel);
    draft.days[di].blocks.splice(bi, 1);
    if (!draft.days[di].blocks.length) draft.days[di].blocks.push(newBlock());
    re();
  });

  root.querySelectorAll('[data-add-ex]').forEach(el => el.onclick = () => {
    const [di, bi] = idx(el.dataset.addEx);
    draft.days[di].blocks[bi].exercises.push(newExercise()); re();
  });
  root.querySelectorAll('[data-ex]').forEach(el => el.onclick = () => exerciseForm(idx(el.dataset.ex), re));
  root.querySelectorAll('[data-ex-up]').forEach(el => el.onclick = () => {
    const [di, bi, ei] = idx(el.dataset.exUp);
    const list = draft.days[di].blocks[bi].exercises;
    if (ei > 0) { const [x] = list.splice(ei, 1); list.splice(ei - 1, 0, x); re(); }
  });
  root.querySelectorAll('[data-ex-del]').forEach(el => el.onclick = () => {
    const [di, bi, ei] = idx(el.dataset.exDel);
    const list = draft.days[di].blocks[bi].exercises;
    list.splice(ei, 1); if (!list.length) list.push(newExercise()); re();
  });
}

function exerciseForm([di, bi, ei], done) {
  const ex = draft.days[di].blocks[bi].exercises[ei];
  const f = (label, key, attrs = '', val = ex[key]) =>
    `<div class="field"><label>${esc(label)}</label>
      <input class="input" data-k="${key}" ${attrs} value="${val == null ? '' : esc(val)}"></div>`;

  sheet('ویرایش حرکت', `
    <div class="stack">
      ${f('نام حرکت', 'name')}
      <div class="field"><label>نوع</label>
        <select class="input" data-k="mode">
          ${MODES.map(m => `<option value="${m}" ${(ex.mode || 'reps') === m ? 'selected' : ''}>${modeLabel(m)}</option>`).join('')}
        </select></div>
      <div class="grid2">${f('عضله', 'muscle')}${f('وسیله', 'equipment')}</div>
      <div class="grid2">
        ${f('تکرار (عدد یا 8-10)', 'reps')}
        ${f('وزنه', 'weight', 'type="number" step="any" inputmode="decimal"')}
      </div>
      <div class="grid2">
        ${f('مدت (ثانیه)', 'duration', 'type="number" inputmode="numeric"')}
        ${f('استراحت (ثانیه)', 'rest', 'type="number" inputmode="numeric"')}
      </div>
      <div class="grid2">${f('تمپو مثل 3-1-1-0', 'tempo')}${f('RPE', 'rpe', 'type="number" step="any"')}</div>
      <div class="grid2">${f('درصد ۱RM مثل 75%', 'intensity')}${f('۱RM', 'oneRM', 'type="number" step="any"')}</div>
      <div class="grid3">
        ${f('مسافت (متر)', 'distance', 'type="number" step="any"')}
        ${f('سرعت km/h', 'speed', 'type="number" step="any"')}
        ${f('شیب ٪', 'incline', 'type="number" step="any"')}
      </div>
      <div class="field"><label>تکنیک شدت</label>
        <select class="input" data-k="__tech">
          <option value="">ندارد</option>
          ${TECHNIQUES.map(t => `<option value="${t}" ${ex.technique?.type === t ? 'selected' : ''}>${t === 'drop' ? 'دراپ‌ست' : t === 'restPause' ? 'رست‌پاز' : 'کلاستر'}</option>`).join('')}
        </select></div>
      ${f('جایگزین‌ها (با ویرگول)', '__alts', '', (ex.alternatives || []).join('، '))}
      ${f('نکتهٔ فرم اجرا', 'cue')}
      ${f('لینک تصویر', '__img', '', ex.media?.image || '')}
      ${f('لینک ویدیو', '__vid', '', ex.media?.video || '')}
      <button class="btn primary block" data-ok>ثبت</button>
    </div>`, (b, close) => {
    b.querySelector('[data-ok]').onclick = () => {
      const get = k => b.querySelector(`[data-k="${k}"]`)?.value.trim() ?? '';
      const numOrNull = v => (v === '' ? undefined : (Number.isNaN(+v) ? v : +v));

      ex.name = get('name') || 'حرکت';
      ex.mode = get('mode');
      ['muscle', 'equipment', 'cue', 'tempo', 'intensity'].forEach(k => {
        const v = get(k); if (v) ex[k] = v; else delete ex[k];
      });
      const reps = get('reps');
      if (reps) ex.reps = /^\d+$/.test(reps) ? +reps : reps; else delete ex.reps;
      ['weight', 'duration', 'rest', 'rpe', 'oneRM', 'distance', 'speed', 'incline'].forEach(k => {
        const v = numOrNull(get(k)); if (v === undefined) delete ex[k]; else ex[k] = v;
      });
      const tech = get('__tech');
      if (!tech) delete ex.technique;
      else if (ex.technique?.type !== tech) {
        ex.technique = tech === 'drop' ? { type: 'drop', drops: [{ reduce: '20%', reps: 'AMRAP' }] }
          : tech === 'restPause' ? { type: 'restPause', pauses: 2, rest: 15 }
          : { type: 'cluster', clusters: 4, repsPer: 2, rest: 20 };
      }
      const alts = get('__alts').split(/[،,]/).map(s => s.trim()).filter(Boolean);
      if (alts.length) ex.alternatives = alts; else delete ex.alternatives;
      const img = get('__img'), vid = get('__vid');
      if (img || vid) ex.media = { ...(img && { image: img }), ...(vid && { video: vid }) };
      else delete ex.media;

      close(); done();
    };
  });
}

/* ---------- تب JSON ---------- */

function jsonTab() {
  const { id, __new, updatedAt, ...clean } = draft;
  return `<div class="stack">
    <textarea class="input" id="raw" spellcheck="false">${esc(JSON.stringify(clean, null, 2))}</textarea>
    <div id="rawmsg"></div>
    <button class="btn block" id="apply">اعمال روی برنامه</button>
  </div>`;
}

function saveDraft() {
  const { __new, ...clean } = draft;
  const res = validate(clean);
  if (!res.ok) {
    sheet('ذخیره نشد', errorList(res.errors));
    return;
  }
  const saved = store.saveProgram(clean);
  draft = null;
  toast('ذخیره شد');
  location.hash = `/p/${saved.id}`;
}
