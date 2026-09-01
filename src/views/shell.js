// اسکلت مشترک صفحات: تاپ‌بار + تب‌بار
import { esc } from '../util.js';

const TABS = [
  { href: '#/', ic: '🏋️', label: 'برنامه‌ها', match: p => p === '/' || p.startsWith('/p/') },
  { href: '#/history', ic: '📈', label: 'تاریخچه', match: p => p.startsWith('/history') },
  { href: '#/editor/new', ic: '✏️', label: 'ویرایشگر', match: p => p.startsWith('/editor') },
  { href: '#/settings', ic: '⚙️', label: 'تنظیمات', match: p => p.startsWith('/settings') },
];

export function shell({ title, sub = '', back = null, actions = '', body }) {
  const path = location.hash.slice(1) || '/';
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="topbar">
      ${back ? `<button class="iconbtn" data-back aria-label="بازگشت">→</button>` : ''}
      <div style="flex:1;min-width:0">
        <h1>${esc(title)}</h1>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
      </div>
      ${actions}
    </header>
    <main class="screen">${body}</main>
    <nav class="tabbar">
      ${TABS.map(t => `<a href="${t.href}" class="${t.match(path) ? 'on' : ''}">
        <span class="ic">${t.ic}</span><span>${t.label}</span></a>`).join('')}
    </nav>`;
  app.querySelector('[data-back]')?.addEventListener('click', () => {
    location.hash = typeof back === 'string' ? back : '/';
  });
  return app.querySelector('.screen');
}

export function emptyState(icon, title, hint, action = '') {
  return `<div class="empty">
    <div class="big">${icon}</div>
    <h3>${esc(title)}</h3>
    <p class="small" style="margin-top:6px">${esc(hint)}</p>
    ${action ? `<div style="margin-top:18px">${action}</div>` : ''}
  </div>`;
}
