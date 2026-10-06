// The timeline of a handover between two worlds: a snapshot of the old
// world's last frame covers the host until the new world is ready, then
// fades over `fade` ms while the new one draws under it.
//
// createHandover({ fade }) → { start(now), frame(now) → { opacity, done }, cancel() }

export function createHandover({ fade = 600 } = {}) {
  let startedAt = null;
  let cancelled = false;
  return {
    start(now) {
      startedAt = now;
    },
    frame(now) {
      if (cancelled) return { opacity: 0, done: true };
      if (startedAt === null) return { opacity: 1, done: false };
      const t = fade > 0 ? Math.min(1, (now - startedAt) / fade) : 1;
      return { opacity: 1 - t, done: t >= 1 };
    },
    cancel() {
      cancelled = true;
    },
  };
}
