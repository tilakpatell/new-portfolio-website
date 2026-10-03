// One shared IntersectionObserver for every one-shot reveal on the page,
// instead of one observer per element.
const callbacks = new Map();
let io = null;

function observer() {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        io.unobserve(entry.target);
        cb?.();
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  return io;
}

// Calls `cb` once, the first time `el` scrolls into view. Returns a cleanup.
export function onceVisible(el, cb) {
  const o = observer();
  if (!o) {
    cb();
    return () => {};
  }
  callbacks.set(el, cb);
  o.observe(el);
  return () => {
    callbacks.delete(el);
    o.unobserve(el);
  };
}
