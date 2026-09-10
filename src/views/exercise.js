// برگهٔ کامل یک حرکت: نمایش متحرک فرم، دستور اجرا، خطاهای رایج و نقشهٔ عضلات
import { esc, fa, safeUrl } from '../util.js';
import { sheet } from '../ui.js';
import { lookup, SOURCES } from '../exdb.js';
import { demoSvg, patternName } from '../anim.js';
import { bodyMap, muscleBars, sharesOf, muscleName } from '../muscles.js';
import { TECH_LABEL } from '../condense.js';

const TABS = [
  { id: 'form', label: 'فرم اجرا' },
  { id: 'muscle', label: 'عضلات درگیر' },
  { id: 'more', label: 'جزئیات' },
];

/**
 * @param {object} ex حرکتِ resolve‌شده (name, mode, muscle, equipment, cue, media, …)
 * @param {{title?:string, extra?:string}} opts
 */
export function exerciseSheet(ex, opts = {}) {
  const kb = lookup(ex.name, { muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment });
  const title = opts.title || ex.name;
  let tab = 'form';

  const render = (body) => {
    body.innerHTML = `
      <div class="stack">
        ${mediaBlock(ex, kb)}
        <div class="seg block" role="tablist">
          ${TABS.map(t => `<button data-tab="${t.id}" class="${tab === t.id ? 'on' : ''}">${t.label}</button>`).join('')}
        </div>
        <div>${tab === 'form' ? formTab(ex, kb) : tab === 'muscle' ? muscleTab(kb) : moreTab(ex, kb, opts)}</div>
      </div>`;
    body.querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => { tab = b.dataset.tab; render(body); };
    });
  };

  sheet(title, '<div></div>', (body) => render(body));
}

/* --- تصویر/انیمیشن حرکت --------------------------------------------- */

function mediaBlock(ex, kb) {
  const img = safeUrl(ex.media?.gif || ex.media?.image);
  if (img) {
    return `<div class="demo">
      <span class="demo-tag">${esc(patternName(kb.pattern))}</span>
      <img src="${esc(img)}" alt="نمایش حرکت ${esc(ex.name)}" loading="lazy"
           style="width:100%;border-radius:var(--r-sm);display:block">
    </div>`;
  }
  return demoSvg(kb.pattern, { tag: patternName(kb.pattern), equip: ex.equipment || kb.equip });
}

/* --- تب فرم ---------------------------------------------------------- */

function formTab(ex, kb) {
  const setup = kb.setup?.length ? kb.setup : null;
  const exec = kb.exec?.length ? kb.exec : null;

  return `<div class="stack">
    ${ex.cue ? `<div class="hint"><b>نکتهٔ برنامه:</b> ${esc(ex.cue)}</div>` : ''}

    ${setup ? section('آماده‌سازی', `<ul class="steps-list">${setup.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`) : ''}
    ${exec ? section('اجرای صحیح', `<ul class="steps-list">${exec.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`) : ''}
    ${kb.breath ? `<div class="hint"><b>تنفس:</b> ${esc(kb.breath)}</div>` : ''}
    ${kb.mistakes?.length ? section('خطاهای رایج',
      `<ul class="dont">${kb.mistakes.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`) : ''}
    ${kb.safety ? `<div class="hint warn"><b>ایمنی:</b> ${esc(kb.safety)}</div>` : ''}

    ${kb.match === 'guess' ? `<div class="hint warn">
      این حرکت در دانش‌نامهٔ اپ ثبت نشده است. آنچه می‌بینی بر پایهٔ الگوی حرکتی
      «${esc(patternName(kb.pattern))}» تخمین زده شده${kb.guessedFrom ? ` (نزدیک‌ترین نمونه: ${esc(kb.guessedFrom)})` : ''}.
      برای فرم دقیق، توضیح حرکت را در فایل برنامه در فیلد <code>cue</code> بنویس.
    </div>` : ''}

    ${sourceBox(kb)}
  </div>`;
}

/* --- تب عضلات -------------------------------------------------------- */

function muscleTab(kb) {
  const p = kb.primary || {}, s = kb.secondary || {};
  const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
  const hasAny = Object.keys(p).length || Object.keys(s).length;

  if (!hasAny) {
    return `<div class="hint">برای این حرکت سهم عضلانی ثبت نشده است — معمولاً حرکات کششی و تحرکی
      بار مشخصی روی یک عضله نمی‌گذارند.</div>`;
  }

  return `<div class="stack">
    <div class="hint">
      اگر این حرکت را <b>درست</b> اجرا کنی، بیشترین فشار روی
      <b>${esc(muscleName(top[0]))}</b> می‌آید${top[1] ? ` (حدود ${fa(top[1])}٪ بار)` : ''}.
      اگر جای دیگری را بیشتر حس می‌کنی، معمولاً یکی از «خطاهای رایج» تب فرم در حال رخ دادن است.
    </div>
    ${bodyMap(sharesOf(kb))}
    <div class="mlist">${muscleBars(p, s, kb.stabil || [])}</div>
    <p class="tiny muted" style="line-height:1.8">
      درصدها سهم <b>تقریبی</b> بار بر پایهٔ کارکرد مفصلی و جمع‌بندی مطالعات EMG در منابع زیرند،
      نه اندازه‌گیری روی بدن شما. برای «کجا باید فشار را حس کنم» مفیدند، نه برای محاسبهٔ دقیق حجم تمرین.
    </p>
    ${sourceBox(kb)}
  </div>`;
}

/* --- تب جزئیات ------------------------------------------------------- */

function moreTab(ex, kb, opts) {
  const vid = safeUrl(ex.media?.video);
  return `<div class="stack">
    <div class="row wrap" style="gap:6px">
      ${[ex.muscle, ex.equipment || kb.equip].filter(Boolean)
        .map(t => `<span class="chip">${esc(t)}</span>`).join('')}
      <span class="chip info">الگو: ${esc(patternName(kb.pattern))}</span>
      ${ex.mode === 'cardio' ? '<span class="chip info">هوازی</span>' : ''}
      ${ex.mode === 'time' ? '<span class="chip info">زمانی</span>' : ''}
    </div>
    ${opts.extra || ''}
    ${ex.technique ? `<div class="hint"><b>${esc(TECH_LABEL[ex.technique.type] || '')}:</b>
      ${esc(techniqueText(ex.technique))}</div>` : ''}
    ${ex.alternatives?.length ? section('حرکات جایگزین اعلام‌شده در برنامه',
      `<div class="row wrap" style="gap:6px">${ex.alternatives.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>`) : ''}
    ${vid ? `<a class="btn block" href="${esc(vid)}" target="_blank" rel="noopener noreferrer">تماشای ویدیوی حرکت ↗</a>` : ''}
  </div>`;
}

/* --- کمکی‌ها --------------------------------------------------------- */

function section(title, html) {
  return `<div><div class="sec-title" style="margin-bottom:6px">${esc(title)}</div>${html}</div>`;
}

function sourceBox(kb) {
  return `<div class="sourcebox">
    <b>منابع محتوای فرم و عضلات:</b><br>
    ${SOURCES.map(s => esc(s)).join('<br>')}
  </div>`;
}

export function techniqueText(t) {
  if (!t) return '';
  if (t.type === 'drop') {
    return t.drops.map((d, i) => `مرحلهٔ ${fa(i + 1)}: کاهش ${d.reduce ?? '—'} تا ${d.reps ?? 'ناتوانی'}`).join(' ← ');
  }
  if (t.type === 'restPause') return `${fa(t.pauses ?? 2)} وقفهٔ ${fa(t.rest ?? 15)} ثانیه‌ای تا ناتوانی`;
  if (t.type === 'cluster') return `${fa(t.clusters ?? 4)} خوشهٔ ${fa(t.repsPer ?? 2)} تکراری با ${fa(t.rest ?? 20)} ثانیه مکث`;
  return '';
}

/** خلاصهٔ یک‌خطی «کجا فشار می‌آید» برای نمایش داخل صفحهٔ تمرین */
export function muscleLine(ex) {
  const kb = lookup(ex.name, { muscle: ex.muscle, mode: ex.mode, equipment: ex.equipment });
  const list = Object.entries(kb.primary || {}).sort((a, b) => b[1] - a[1]);
  if (!list.length) return '';
  const main = list.map(([k, v]) => `${muscleName(k)} ${fa(v)}٪`).join(' · ');
  const sec = Object.entries(kb.secondary || {}).sort((a, b) => b[1] - a[1])
    .slice(0, 2).map(([k]) => muscleName(k));
  return `<div class="hint"><b>فشار روی:</b> <bdi>${esc(main)}</bdi>${sec.length ? ` — کمکی: ${esc(sec.join('، '))}` : ''}</div>`;
}
