// تنظیمات: ظاهر، تمرین دونفره، وزنه‌ها، حین تمرین، پشتیبان‌گیری
import { shell } from './shell.js';
import { store } from '../store.js';
import { esc, fa, download } from '../util.js';
import { toast, pickFile, confirmSheet } from '../ui.js';
import { THEMES, applyTheme, effectiveTheme } from '../theme.js';

export function settingsView() {
  const s = store.settings();
  const body = `
    <div class="stack">

      <div class="card stack">
        <h3 style="font-size:15px">ظاهر</h3>
        <p class="small muted">تم روی رنگ همهٔ صفحه‌ها اثر می‌گذارد. «خودکار» با تنظیم روشن/تیرهٔ خود گوشی هماهنگ می‌شود.</p>
        <div class="seg block" id="theme">
          ${THEMES.map(t => `<button data-theme="${t.id}" class="${(s.theme || 'auto') === t.id ? 'on' : ''}">${t.label}</button>`).join('')}
        </div>
        <p class="tiny muted" id="theme-hint">${esc(THEMES.find(t => t.id === (s.theme || 'auto'))?.hint || '')}</p>
        ${toggle('showAdvice', 'توصیهٔ روزانهٔ پزشکی و غذایی', 'در بالای هر روز تمرین نمایش داده می‌شود.', s.showAdvice)}
      </div>

      <div class="card stack">
        <h3 style="font-size:15px">تمرین دونفره</h3>
        <p class="small muted">
          یک گوشی، دو ورزشکار. اپ نوبت هر نفر را نشان می‌دهد و استراحت هرکس را با ست نفر دیگر هماهنگ می‌کند
          تا وقت باشگاه هدر نرود.
        </p>
        ${toggle('partner', 'حالت دونفره', 'در مود باشگاه فعال می‌شود.', s.partner)}
        <div class="grid2">
          <div class="field"><label>نام ورزشکار ۱</label>
            <input class="input" id="ath0" value="${esc(s.athletes?.[0]?.name || '')}" maxlength="18"></div>
          <div class="field"><label>نام ورزشکار ۲</label>
            <input class="input" id="ath1" value="${esc(s.athletes?.[1]?.name || '')}" maxlength="18"></div>
        </div>
        <p class="tiny muted">نام‌ها فقط روی همین گوشی ذخیره می‌شوند و رکورد هر نفر جدا نگه داشته می‌شود.</p>
      </div>

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
        ${toggle('sound', 'صدای تایمر', '', s.sound)}
        ${toggle('vibrate', 'ویبره', '', s.vibrate)}
        ${toggle('wakeLock', 'روشن ماندن صفحه', 'تا وسط ست خاموش نشود.', s.wakeLock)}
        ${toggle('tempoCue', 'شمارندهٔ صوتی تمپو', '', s.tempoCue)}
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

  root.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => {
    const mode = b.dataset.theme;
    store.saveSettings({ theme: mode });
    applyTheme(mode);
    root.querySelectorAll('[data-theme]').forEach(x => x.classList.toggle('on', x === b));
    $('#theme-hint').textContent = THEMES.find(t => t.id === mode)?.hint || '';
    toast(`تم: ${THEMES.find(t => t.id === mode)?.label} (${effectiveTheme(mode) === 'dark' ? 'تیره' : 'روشن'})`);
  });

  const saveAthletes = () => {
    const names = [$('#ath0').value.trim(), $('#ath1').value.trim()];
    store.saveSettings({
      athletes: [
        { id: 'a', name: names[0] || 'ورزشکار ۱' },
        { id: 'b', name: names[1] || 'ورزشکار ۲' },
      ],
    });
  };
  $('#ath0').onchange = saveAthletes;
  $('#ath1').onchange = saveAthletes;

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
      applyTheme();
      settingsView();
    } catch (e) {
      toast(e.message || 'فایل معتبر نیست', 'bad');
    }
  };
  $('#wipe').onclick = async () => {
    if (await confirmSheet('پاک‌کردن همه‌چیز', 'برنامه‌ها، تاریخچه و تنظیمات حذف می‌شوند. اول خروجی بگیرید.', { danger: true, okText: 'پاک کن' })) {
      ['fitmeat.programs', 'fitmeat.sessions', 'fitmeat.settings', 'fitmeat.activeProgramId', 'fitmeat.liveSession']
        .forEach(k => localStorage.removeItem(k));
      location.hash = '/'; location.reload();
    }
  };
}

function toggle(key, label, hint, on) {
  return `<label class="switch">
    <span class="lbl"><b>${esc(label)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</span>
    <input type="checkbox" data-toggle="${key}" ${on ? 'checked' : ''}></label>`;
}
