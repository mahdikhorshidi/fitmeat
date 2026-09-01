// کامپوننت‌های کوچک مشترک: توست، شیت پایین، تأیید
import { esc } from './util.js';

export function toast(msg, kind = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

let closeSheet = null;

/** شیت پایین؛ html رشتهٔ آمادهٔ escape‌شده است */
export function sheet(title, html, onMount) {
  dismissSheet();
  const root = document.getElementById('sheet-root');
  root.innerHTML = `
    <div class="sheet-back" role="dialog" aria-modal="true">
      <div class="sheet">
        <div class="grab"></div>
        ${title ? `<h3>${esc(title)}</h3>` : ''}
        <div class="sheet-body">${html}</div>
      </div>
    </div>`;
  const back = root.firstElementChild;
  back.addEventListener('click', e => { if (e.target === back) dismissSheet(); });
  closeSheet = () => { root.innerHTML = ''; closeSheet = null; };
  onMount?.(root.querySelector('.sheet-body'), dismissSheet);
}

export function dismissSheet() { closeSheet?.(); }

export function confirmSheet(title, message, { danger = false, okText = 'تأیید' } = {}) {
  return new Promise(resolve => {
    sheet(title, `
      <p class="muted small" style="margin-bottom:14px">${esc(message)}</p>
      <div class="row" style="gap:10px">
        <button class="btn block ${danger ? 'danger' : 'primary'}" data-ok>${esc(okText)}</button>
        <button class="btn block ghost" data-no>انصراف</button>
      </div>`, (body, close) => {
      body.querySelector('[data-ok]').onclick = () => { close(); resolve(true); };
      body.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
    });
  });
}

/** ورودی فایل موقتی برای انتخاب JSON */
export function pickFile(accept = 'application/json,.json') {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve({ name: f.name, text: String(r.result) });
      r.onerror = () => resolve(null);
      r.readAsText(f);
    };
    input.click();
  });
}

export function errorList(errors) {
  return `<ul class="err-list">${errors.slice(0, 12).map(e =>
    `<li>${e.path ? `<code>${esc(e.path)}</code> — ` : ''}${esc(e.msg)}</li>`).join('')}
    ${errors.length > 12 ? `<li class="muted">و ${errors.length - 12} خطای دیگر…</li>` : ''}</ul>`;
}
