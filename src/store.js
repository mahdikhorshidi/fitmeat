// لایهٔ ذخیره‌سازی روی localStorage — تنها نقطهٔ read/write داده‌ها
import { uid } from './util.js';

const K = {
  programs: 'fitmeat.programs',
  active: 'fitmeat.activeProgramId',
  sessions: 'fitmeat.sessions',
  settings: 'fitmeat.settings',
  live: 'fitmeat.liveSession',
};

const DEFAULT_SETTINGS = {
  unit: 'kg',
  bar: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  sound: true,
  vibrate: true,
  wakeLock: true,
  tempoCue: true,
  exerciseImages: true,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // حالت private یا پر شدن سهمیه
    return false;
  }
}

export const store = {
  // --- برنامه‌ها ---
  programs: () => read(K.programs, []),
  program(id) { return this.programs().find(p => p.id === id) || null; },
  saveProgram(program) {
    const list = this.programs();
    const rec = { ...program, id: program.id || uid(), updatedAt: Date.now() };
    const i = list.findIndex(p => p.id === rec.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    write(K.programs, list);
    if (!this.activeId()) this.setActive(rec.id);
    return rec;
  },
  deleteProgram(id) {
    write(K.programs, this.programs().filter(p => p.id !== id));
    if (this.activeId() === id) this.setActive(this.programs()[0]?.id || null);
  },
  activeId: () => read(K.active, null),
  setActive: id => write(K.active, id),

  // --- تنظیمات ---
  settings: () => ({ ...DEFAULT_SETTINGS, ...read(K.settings, {}) }),
  saveSettings(patch) {
    const next = { ...this.settings(), ...patch };
    write(K.settings, next);
    return next;
  },

  // --- تاریخچهٔ جلسات ---
  sessions: () => read(K.sessions, []),
  addSession(s) {
    const list = this.sessions();
    list.unshift({ ...s, id: s.id || uid() });
    write(K.sessions, list.slice(0, 400));
  },
  deleteSession(id) { write(K.sessions, this.sessions().filter(s => s.id !== id)); },

  // --- جلسهٔ در جریان (برای بازیابی بعد از رفرش) ---
  live: () => read(K.live, null),
  setLive: s => (s ? write(K.live, s) : localStorage.removeItem(K.live)),

  // --- بکاپ/ریستور ---
  exportAll() {
    return {
      app: 'fitmeat', version: 1, exportedAt: new Date().toISOString(),
      programs: this.programs(), sessions: this.sessions(), settings: this.settings(),
      activeProgramId: this.activeId(),
    };
  },
  importAll(data, { merge = false } = {}) {
    if (!data || data.app !== 'fitmeat' || !Array.isArray(data.programs)) {
      throw new Error('فایل پشتیبان معتبر نیست.');
    }
    const programs = merge
      ? [...data.programs.filter(p => !this.programs().some(q => q.id === p.id)), ...this.programs()]
      : data.programs;
    const sessions = merge
      ? [...data.sessions || [], ...this.sessions()].filter(
          (s, i, a) => a.findIndex(x => x.id === s.id) === i)
      : (data.sessions || []);
    write(K.programs, programs);
    write(K.sessions, sessions);
    if (data.settings) write(K.settings, data.settings);
    if (data.activeProgramId) write(K.active, data.activeProgramId);
    return { programs: programs.length, sessions: sessions.length };
  },
};
