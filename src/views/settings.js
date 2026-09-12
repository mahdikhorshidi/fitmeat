// تنظیمات: میله و صفحات، صدا/ویبره، بکاپ و ریستور
import { shell } from './shell.js';
import { store } from '../store.js';
import { esc, fa, download } from '../util.js';
import { toast, pickFile, confirmSheet } from '../ui.js';

export function settingsView() {
  const s = store.settings();
  const body = `
    <div class="stack">
      <div class="card stack">
        <h3 style="font-size:15px">وزنه‌ها</h3>
        <div class="grid2">
          <div class="field"><label>وزن میله</label>
            <input class="input num" id="bar" type="number" step="any" value="${s.bar}"></div>
          <div class="field"><label>واحد</label>
            <select class="input" id="unit">
              <option value="kg" ${s.unit === 'kg' ? 'selected' : ''}>کیلوگرم</option>
              <option value="lb" ${s.unit === 'lb' ? 'selected' : ''}>پوند</option>
            </select></div>
        </div>
        <div class="field"><label>صفحات موجود (با ویرگول)</label>
          <input class="input num" id="plates" value="${esc(s.plates.join(', '))}"></div>
      </div>

      <div class="card">
        <h3 style="font-size:15px;margin-bottom:6px">حین تمرین</h3>
        ${toggle('sound', 'صدای تایمر', s.sound)}
        ${toggle('vibrate', 'ویبره', s.vibrate)}
        ${toggle('wakeLock', 'روشن ماندن صفحه', s.wakeLock)}
        ${toggle('tempoCue', 'شمارندهٔ صوتی تمپو', s.tempoCue)}
      </div>

      <div class="card">
        <h3 style="font-size:15px;margin-bottom:6px">تصویر حرکات</h3>
        ${toggle('exerciseImages', 'بارگذاری تصویر از wger.de', s.exerciseImages)}
        <p class="small muted" style="margin-top:8px">وقتی روشن باشد، تصویر هر حرکت مستقیم از
          <a href="https://wger.de" target="_blank" rel="noopener noreferrer">wger.de</a>
          (منبع متن‌باز، تصاویر CC BY-SA) گرفته و نمایش داده می‌شود؛ فقط نام انگلیسی حرکت به آن سایت فرستاده می‌شود.
          خاموش کنید تا اپ هیچ درخواستی به بیرون نفرستد.</p>
        <button class="btn block" id="clear-media" style="margin-top:10px">پاک‌کردن کش تصاویر</button>
      </div>

      <div class="card stack">
        <h3 style="font-size:15px">پشتیبان‌گیری</h3>
        <p class="small muted">همهٔ داده‌ها فقط در همین مرورگر ذخیره می‌شوند؛ پاک‌کردن داده‌های سایت آن‌ها را حذف می‌کند.</p>
        <button class="btn block" id="export">📤 خروجی کامل (JSON)</button>
        <button class="btn block" id="import">📥 بازیابی از فایل</button>
        <button class="btn block danger" id="wipe">🗑 پاک‌کردن همهٔ داده‌ها</button>
      </div>

      <p class="small muted center">فیت‌میت — بدون سرور، بدون حساب کاربری.</p>
    </div>`;

  const root = shell({ title: 'تنظیمات', body });
  const $ = q => root.querySelector(q);

  $('#bar').onchange = e => store.saveSettings({ bar: +e.target.value || 20 });
  $('#unit').onchange = e => store.saveSettings({ unit: e.target.value });
  $('#plates').onchange = e => {
    const list = e.target.value.split(/[،,\s]+/).map(Number).filter(n => n > 0).sort((a, b) => b - a);
    store.saveSettings({ plates: list.length ? list : [25, 20, 15, 10, 5, 2.5, 1.25] });
    toast('صفحات ذخیره شد');
  };
  root.querySelectorAll('[data-toggle]').forEach(el => el.onchange = e => {
    store.saveSettings({ [el.dataset.toggle]: e.target.checked });
  });

  $('#clear-media').onclick = () => {
    localStorage.removeItem('fitmeat.media.v1');
    toast('کش تصاویر پاک شد');
  };

  $('#export').onclick = () => {
    download(`fitmeat-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(store.exportAll(), null, 2));
  };
  $('#import').onclick = async () => {
    const f = await pickFile();
    if (!f) return;
    try {
      const res = store.importAll(JSON.parse(f.text));
      toast(`${fa(res.programs)} برنامه و ${fa(res.sessions)} جلسه بازیابی شد`);
      settingsView();
    } catch (e) {
      toast(e.message || 'فایل معتبر نیست', 'bad');
    }
  };
  $('#wipe').onclick = async () => {
    if (await confirmSheet('پاک‌کردن همه‌چیز', 'برنامه‌ها، تاریخچه و تنظیمات حذف می‌شوند. اول خروجی بگیرید.', { danger: true, okText: 'پاک کن' })) {
      ['fitmeat.programs', 'fitmeat.sessions', 'fitmeat.settings', 'fitmeat.activeProgramId',
       'fitmeat.liveSession', 'fitmeat.media.v1']
        .forEach(k => localStorage.removeItem(k));
      location.hash = '/'; location.reload();
    }
  };
}

function toggle(key, label, on) {
  return `<label class="switch"><span>${esc(label)}</span>
    <input type="checkbox" data-toggle="${key}" ${on ? 'checked' : ''}></label>`;
}
