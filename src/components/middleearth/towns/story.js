// A town's things to do, as data: each quest has an id, a name, where it is
// and what to do (`go`), and may need another done first (`needs`: an id,
// or a list of them). This is what's done, what's open and what's next;
// the town words the objective.

// `done` is the ids finished, as saved. Only ids the town knows count, and
// a step counts only if what it needs is done too (a save from an older
// version can't skip ahead).
export function progress(quests, done = []) {
  const listed = new Set(Array.isArray(done) ? done : []);
  const ok = new Set();
  const ready = (q) => [].concat(q.needs ?? []).every((n) => ok.has(n));
  for (let grew = true; grew; ) {
    grew = false;
    for (const q of quests) {
      if (!ok.has(q.id) && listed.has(q.id) && ready(q)) {
        ok.add(q.id);
        grew = true;
      }
    }
  }
  const list = quests.map((q) => ({ ...q, done: ok.has(q.id), open: ready(q) }));
  const next = list.find((q) => q.open && !q.done) ?? null;
  return { quests: list, done: quests.filter((q) => ok.has(q.id)).map((q) => q.id), next: next?.id ?? null, finished: list.every((q) => q.done) };
}

// The nearest of a list of { x, z, r? } within its own reach (or `r`).
export function nearest(list, x, z, r = Infinity) {
  let best = null;
  for (const s of list) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < (s.r ?? r) && (!best || d < best.d)) best = { ...s, d };
  }
  return best;
}
