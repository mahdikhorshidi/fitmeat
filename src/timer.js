// تایمرها با performance.now (بدون دریفت) + صدا و ویبره
import { store } from './store.js';

let ctx = null;
/** AudioContext فقط بعد از اولین تعامل کاربر (محدودیت iOS) */
export function primeAudio() {
  if (!store.settings().sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

export function beep(freq = 880, ms = 140, gain = 0.07) {
  if (!store.settings().sound || !ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* بی‌صدا رد شو */ }
}

export function vibrate(pattern) {
  if (!store.settings().vibrate) return;
  try { navigator.vibrate?.(pattern); } catch { /* پشتیبانی نمی‌شود */ }
}

export const cue = {
  tick: () => beep(660, 70, 0.04),
  go: () => { beep(1046, 180, 0.09); vibrate([120, 60, 120]); },
  done: () => { beep(784, 120); setTimeout(() => beep(1046, 200), 130); vibrate([90, 50, 90, 50, 180]); },
  switch: () => { beep(523, 150, 0.08); vibrate(60); },
};

/** شمارش معکوس مقاوم در برابر پس‌زمینه رفتن تب */
export class Countdown {
  constructor({ seconds, onTick, onEnd }) {
    this.total = seconds;
    this.endAt = performance.now() + seconds * 1000;
    this.onTick = onTick; this.onEnd = onEnd;
    this.lastWhole = Math.ceil(seconds);
    this.timer = setInterval(() => this.step(), 200);
    this.step();
  }
  get left() { return Math.max(0, (this.endAt - performance.now()) / 1000); }
  step() {
    const left = this.left;
    const whole = Math.ceil(left);
    if (whole !== this.lastWhole) {
      this.lastWhole = whole;
      if (whole > 0 && whole <= 3) cue.tick();
    }
    this.onTick?.(left, this.total);
    if (left <= 0) { this.stop(); this.onEnd?.(); }
  }
  add(sec) { this.endAt += sec * 1000; this.total += sec; this.step(); }
  stop() { clearInterval(this.timer); this.timer = null; }
}

/** روشن نگه‌داشتن صفحه در باشگاه */
export class Screen {
  constructor() { this.lock = null; this.onVis = () => this.reacquire(); }
  async on() {
    if (!store.settings().wakeLock || !('wakeLock' in navigator)) return;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', this.onVis);
    } catch { this.lock = null; }
  }
  async reacquire() {
    if (document.visibilityState === 'visible' && !this.lock?.released) return;
    if (document.visibilityState === 'visible') { this.lock = null; await this.on(); }
  }
  off() {
    document.removeEventListener('visibilitychange', this.onVis);
    try { this.lock?.release(); } catch { /* بی‌اهمیت */ }
    this.lock = null;
  }
}
