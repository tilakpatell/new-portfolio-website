// The service worker's switch (public/sw.js serves installed worlds' packs).
// It is registered only for a visitor who has a world installed, or is
// installing one (src/runtime/install.js), and goes again with the last
// pack, so everyone else's visits are as they were. Never in development.
//
// createWorkerSwitch({ nav, caches, prod }) → { start(), need(), tidy() };
// registerWorker() is start() on the browser's.

const URL_ = '/sw.js';
const PREFIX = 'tp-pack-';

export function createWorkerSwitch({ nav, caches, prod }) {
  let registering = null;
  const ok = () => prod && Boolean(nav?.serviceWorker);
  const any = async () => ((await caches?.keys().catch(() => [])) ?? []).some((n) => n.startsWith(PREFIX));
  const need = () => {
    if (!ok()) return Promise.resolve(null);
    registering ??= nav.serviceWorker.register(URL_, { scope: '/' }).catch(() => {
      registering = null;
      return null;
    });
    return registering;
  };
  return {
    // at start: back on for a visitor with a world installed
    start: async () => (ok() && (await any()) ? need() : null),
    need,
    // after an uninstall: off once nothing is installed
    async tidy() {
      if (!ok() || (await any())) return;
      registering = null;
      const regs = await nav.serviceWorker.getRegistrations?.().catch(() => []);
      for (const r of regs ?? []) if ((r.active ?? r.waiting ?? r.installing)?.scriptURL?.endsWith(URL_)) await r.unregister().catch(() => {});
    },
  };
}

let one = null;
export function workerSwitch() {
  if (one) return one;
  if (typeof window === 'undefined') return null;
  let caches = null;
  try {
    caches = window.caches ?? null;
  } catch {
    /* (storage blocked) */
  }
  one = createWorkerSwitch({ nav: window.navigator, caches, prod: import.meta.env.PROD });
  return one;
}

export const registerWorker = () => workerSwitch()?.start() ?? Promise.resolve(null);
