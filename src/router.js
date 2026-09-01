// روتر هش‌محور سبک
const routes = [];
let current = null;

export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ rx, keys, handler });
}

export function go(path, { replace = false } = {}) {
  if (replace) location.replace(`#${path}`);
  else location.hash = path;
}

export function back() {
  if (history.length > 1) history.back(); else go('/');
}

export function startRouter(fallback) {
  const run = () => {
    const path = location.hash.slice(1) || '/';
    for (const r of routes) {
      const m = path.match(r.rx);
      if (m) {
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        current?.cleanup?.();
        current = r.handler(params) || null;
        window.scrollTo(0, 0);
        return;
      }
    }
    current?.cleanup?.();
    current = fallback() || null;
  };
  addEventListener('hashchange', run);
  run();
}
