// A town's game on the side, as it's saved in the browser: whether it's
// ever been won, and the best go so far. The story's progress is kept
// apart from it (./story.js), so nothing here can hold the story up.

// What was saved, if it's fair: { won, best } (best is null for none yet).
export function readSide(saved) {
  const ok = saved && typeof saved === 'object';
  return { won: Boolean(ok && saved.won === true), best: ok && Number.isFinite(saved.best) ? saved.best : null };
}

// After a go: `won` if it was won, and `score` what it came to (or null).
// `low` when less is better (arrows spent, say). Returns the new record,
// and `better` if the score beat the best.
export function recordSide(rec, { won = false, score = null } = {}, { low = false } = {}) {
  const r = readSide(rec);
  const fair = score != null && Number.isFinite(score);
  const better = fair && (r.best == null || (low ? score < r.best : score > r.best));
  return { won: r.won || Boolean(won), best: better ? score : r.best, better };
}
