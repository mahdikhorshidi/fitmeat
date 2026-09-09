// کتابخانهٔ برنامه‌ها: بارگذاری فایل JSON، نمونه‌ها، حذف و خروجی
import { shell, emptyState } from './shell.js';
import { store } from '../store.js';
import { parseProgram } from '../schema.js';
import { esc, fa, uid, download } from '../util.js';
import { toast, sheet, confirmSheet, pickFile, errorList } from '../ui.js';
import { resolveProgram, countSets } from '../resolve.js';

const SAMPLES = [
  { file: 'samples/push-pull-legs.json', name: 'پوش/پول/پا — ۴ هفته' },
  { file: 'samples/superset-core.json', name: 'سوپرست بالاتنه + شکم و کشش' },
  { file: 'samples/cardio-intervals.json', name: 'روز هوازی و اینتروال' },
  { file: 'samples/chest-biceps-day1.json', name: 'سینه و جلوبازو — روز ۱' },
];

export function libraryView() {
  const programs = store.programs();
  const body = `
    <div class="stack">
      <div class="dropzone" id="drop">
        <div style="font-size:30px">📥</div>
        <div style="font-weight:700;color:var(--txt)">فایل برنامه را اینجا رها کنید</div>
        <div class="small">یا از دکمه‌های زیر استفاده کنید — فایل در حافظهٔ مرورگر ذخیره می‌شود</div>
        <div class="row wrap" style="justify-content:center;margin-top:14px">
          <button class="btn primary sm" id="pick">انتخاب فایل JSON</button>
          <button class="btn sm" id="paste">چسباندن متن JSON</button>
        </div>
      </div>

      ${programs.length ? `<div class="stack">${programs.map(card).join('')}</div>`
        : emptyState('🗂️', 'هنوز برنامه‌ای ندارید', 'یک فایل JSON بارگذاری کنید، یکی از نمونه‌ها را باز کنید یا با ویرایشگر برنامه بسازید.')}

      <div class="card">
        <h3 style="font-size:15px;margin-bottom:10px">نمونه‌های آماده</h3>
        <div class="stack" style="gap:8px">
          ${SAMPLES.map(s => `<button class="btn sm block" data-sample="${esc(s.file)}">${esc(s.name)}</button>`).join('')}
        </div>
      </div>
    </div>`;

  const root = shell({ title: 'فیت‌میت', sub: 'برنامهٔ تمرین در جیب شما', body });

  root.querySelector('#pick').onclick = async () => {
    const f = await pickFile();
    if (f) accept(f.text, f.name);
  };
  root.querySelector('#paste').onclick = () => pasteSheet();
  root.querySelectorAll('[data-sample]').forEach(b => {
    b.onclick = async () => {
      try {
        const res = await fetch(b.dataset.sample);
        accept(await res.text(), b.textContent);
      } catch { toast('نمونه بارگذاری نشد. برای نمونه‌ها باید اپ روی یک سرور باز شود.', 'bad'); }
    };
  });
  root.querySelectorAll('[data-open]').forEach(b => {
    b.onclick = () => { location.hash = `/p/${b.dataset.open}`; };
  });
  root.querySelectorAll('[data-menu]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); programMenu(b.dataset.menu); };
  });

  const drop = root.querySelector('#drop');
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { stop(e); drop.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { stop(e); drop.classList.remove('hot'); }));
  drop.addEventListener('drop', async e => {
    const f = e.dataTransfer?.files?.[0];
    if (f) accept(await f.text(), f.name);
  });
}

function card(p) {
  const model = safeResolve(p);
  const days = model ? model.days.length : 0;
  const sets = model ? model.days.reduce((n, d) => n + countSets(d), 0) : 0;
  return `<div class="card" data-open="${esc(p.id)}" role="button" tabindex="0">
    <div class="row">
      <div style="flex:1;min-width:0">
        <h3 style="font-size:16px">${esc(p.name)}</h3>
        <div class="small muted">${fa(days)} روز · ${fa(sets)} ست · ${fa(model?.weeks || 1)} هفته</div>
      </div>
      <button class="iconbtn" data-menu="${esc(p.id)}" aria-label="گزینه‌ها">⋯</button>
    </div>
  </div>`;
}

function safeResolve(p) {
  try { return resolveProgram(p, 1, store.settings()); } catch { return null; }
}

function accept(text, sourceName) {
  const res = parseProgram(text);
  if (!res.ok) {
    sheet('فایل پذیرفته نشد', `
      <p class="small muted" style="margin-bottom:10px">${esc(sourceName || '')}</p>
      ${errorList(res.errors)}
      <button class="btn block ghost" style="margin-top:14px" data-close>بستن</button>`,
      (b, close) => { b.querySelector('[data-close]').onclick = close; });
    return;
  }
  const saved = store.saveProgram({ ...res.data, id: res.data.id || uid() });
  store.setActive(saved.id);
  toast('برنامه ذخیره شد');
  location.hash = `/p/${saved.id}`;
}

function pasteSheet() {
  sheet('چسباندن JSON', `
    <textarea class="input" id="txt" placeholder='{"schema":"fitmeat/v1", ...}'></textarea>
    <button class="btn primary block" style="margin-top:12px" id="ok">بارگذاری</button>`,
    (b, close) => {
      b.querySelector('#ok').onclick = () => {
        const t = b.querySelector('#txt').value.trim();
        if (!t) return toast('متنی وارد نشده', 'bad');
        close(); accept(t, 'متن چسبانده‌شده');
      };
    });
}

function programMenu(id) {
  const p = store.program(id);
  if (!p) return;
  sheet(p.name, `
    <div class="stack" style="gap:8px">
      <button class="btn block" data-act="open">باز کردن</button>
      <button class="btn block" data-act="edit">ویرایش</button>
      <button class="btn block" data-act="export">خروجی JSON</button>
      <button class="btn block danger" data-act="del">حذف برنامه</button>
    </div>`, (b, close) => {
    b.querySelector('[data-act="open"]').onclick = () => { close(); location.hash = `/p/${id}`; };
    b.querySelector('[data-act="edit"]').onclick = () => { close(); location.hash = `/editor/${id}`; };
    b.querySelector('[data-act="export"]').onclick = () => {
      close();
      const { id: _, updatedAt, ...clean } = p;
      download(`${p.name || 'program'}.json`, JSON.stringify(clean, null, 2));
    };
    b.querySelector('[data-act="del"]').onclick = async () => {
      close();
      if (await confirmSheet('حذف برنامه', `«${p.name}» حذف شود؟ این کار برگشت‌پذیر نیست.`, { danger: true, okText: 'حذف' })) {
        store.deleteProgram(id);
        toast('حذف شد');
        libraryView();
      }
    };
  });
}
