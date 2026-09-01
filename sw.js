// کش کردن فایل‌های اپ برای کار آفلاین در باشگاه
const VERSION = 'fitmeat-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/styles.css',
  './src/app.js', './src/router.js', './src/store.js', './src/schema.js', './src/util.js',
  './src/resolve.js', './src/progression.js', './src/condense.js', './src/plates.js',
  './src/history.js', './src/timer.js', './src/ui.js',
  './src/views/shell.js', './src/views/library.js', './src/views/program.js',
  './src/views/gym.js', './src/views/editor.js', './src/views/history.js', './src/views/settings.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './samples/push-pull-legs.json', './samples/superset-core.json', './samples/cardio-intervals.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
