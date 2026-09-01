// تاریخچهٔ جلسات و رکوردهای شخصی
import { shell, emptyState } from './shell.js';
import { store } from '../store.js';
import { esc, fa, num } from '../util.js';
import { sheet, confirmSheet, toast } from '../ui.js';
import { prFor, est1RM } from '../history.js';

export function historyView() {
  const sessions = store.sessions();
  const prs = personalRecords(sessions);

  const body = sessions.length ? `
    <div class="stack">
      ${prs.length ? `<div class="card">
        <h3 style="font-size:15px;margin-bottom:10px">رکوردهای شخصی</h3>
        <div class="tablewrap"><table class="plan">
          <thead><tr><th class="ex">حرکت</th><th>بهترین ست</th><th>۱RM تخمینی</th></tr></thead>
          <tbody>${prs.slice(0, 12).map(p => `<tr>
            <td class="ex">${esc(p.name)}</td>
            <td class="dose">${fa(num(p.weight))}kg × ${fa(p.reps ?? '—')}</td>
            <td class="dose">${fa(p.e1rm)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}
      ${sessions.map(sessionCard).join('')}
    </div>`
    : emptyState('📈', 'هنوز جلسه‌ای ثبت نشده', 'بعد از اولین تمرین در مود باشگاه، اینجا پر می‌شود.');

  const root = shell({ title: 'تاریخچه', sub: `${fa(sessions.length)} جلسه`, body });
  root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => detail(b.dataset.s));
}

function sessionCard(s) {
  const mins = Math.max(1, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000));
  const volume = (s.entries || []).reduce((n, e) => n + (e.weight || 0) * (e.reps || 0), 0);
  return `<div class="card" data-s="${esc(s.id)}" role="button" tabindex="0">
    <div class="row">
      <div style="flex:1;min-width:0">
        <h3 style="font-size:15px">${esc(s.dayName || 'جلسه')}</h3>
        <div class="small muted">${esc(new Date(s.startedAt).toLocaleDateString('fa-IR'))} · ${esc(s.programName || '')}</div>
      </div>
      <div class="row" style="gap:6px">
        <span class="chip">${fa((s.entries || []).length)} ست</span>
        <span class="chip">${fa(mins)}′</span>
        ${volume ? `<span class="chip accent">${fa(Math.round(volume))}kg</span>` : ''}
      </div>
    </div>
  </div>`;
}

function detail(id) {
  const s = store.sessions().find(x => x.id === id);
  if (!s) return;
  const rows = (s.entries || []).map(e => `<tr>
    <td class="ex">${esc(e.exercise)}</td>
    <td class="dose">${e.reps != null ? fa(e.reps) : '—'}${e.weight != null ? ` × ${fa(num(e.weight))}` : ''}</td>
  </tr>`).join('');
  sheet(s.dayName || 'جلسه', `
    <div class="tablewrap"><table class="plan">
      <thead><tr><th class="ex">حرکت</th><th>ثبت‌شده</th></tr></thead><tbody>${rows}</tbody>
    </table></div>
    <button class="btn block danger" style="margin-top:14px" data-del>حذف این جلسه</button>`,
    (b, close) => {
      b.querySelector('[data-del]').onclick = async () => {
        close();
        if (await confirmSheet('حذف جلسه', 'این جلسه از تاریخچه حذف شود؟', { danger: true, okText: 'حذف' })) {
          store.deleteSession(id); toast('حذف شد'); historyView();
        }
      };
    });
}

function personalRecords(sessions) {
  const names = [...new Set(sessions.flatMap(s => (s.entries || []).map(e => e.exercise)))];
  return names.map(name => ({ name, ...(prFor(name) || {}) }))
    .filter(p => p.weight != null)
    .sort((a, b) => b.e1rm - a.e1rm);
}
