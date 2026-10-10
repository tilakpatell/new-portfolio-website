// Which of a level pack's files are fetched, in what order, and when a cell
// goes (lane L, "How a level draws"). The far list first, so the world is
// whole (and walkable: the HUD's gate lifts) before any cell has come; then
// the near cells nearest first; then the ring to the mid band; the horizon
// last. A cell outside the bands is handed back (onDrop) and its bytes kept,
// so walking back is free. Every fetch shares one AbortController, aborted at
// dispose; nothing arriving after that is handed on.
//
// A cell that cannot be had is asked again after 10 s, then 20, 40 … (a
// missing file is not asked for every frame), and holds back nothing else.
//
//   createLevelStream({ pack, fetch, wanted, tier, onFar, onHorizon, onCell, onDrop, signal, parallel, now })
//     → { update(position, tier), ready(), progress(), dispose() }
//
// fetch(path, { signal }) → Promise<ArrayBuffer> (index.js: the asset base's)

import { bandOf } from './levelPack.js';

const RETRY_MS = 10000;

export function createLevelStream({ pack, fetch, wanted, tier: tier0 = 'high', onFar, onHorizon = () => {}, onCell, onDrop = () => {}, signal = null, parallel = 4, now = () => performance.now() }) {
  const ctl = new AbortController();
  signal?.addEventListener('abort', () => ctl.abort());
  let tier = tier0;
  let farDone = false;
  let farAsked = false;
  let horizonAsked = false;
  const bins = new Map(); // key → ArrayBuffer (kept while the page is up: a few KB a cell)
  const inFlight = new Set();
  const failed = new Map(); // key → { tries, until }
  const shown = new Map(); // key → band handed on
  let want = { near: [], mid: [] };
  let at = null;

  const alive = () => !ctl.signal.aborted;
  const get = (path) => fetch(path, { signal: ctl.signal });

  function show() {
    if (!alive() || !farDone) return;
    for (const key of shown.keys()) {
      if (bandOf(want, key)) continue;
      shown.delete(key);
      onDrop(key);
    }
    for (const key of [...want.near, ...want.mid]) {
      const band = bandOf(want, key);
      if (bins.has(key) && shown.get(key) !== band) {
        shown.set(key, band);
        onCell(key, bins.get(key), band);
      }
    }
  }

  function pump() {
    if (!alive() || !farDone) return;
    const t = now();
    const queue = [...want.near, ...want.mid].filter((k) => !bins.has(k) && !inFlight.has(k) && !(failed.get(k)?.until > t));
    while (inFlight.size < parallel && queue.length) {
      const key = queue.shift();
      inFlight.add(key);
      get(pack.cells[key].bin)
        .then((bin) => {
          inFlight.delete(key);
          if (!alive()) return;
          bins.set(key, bin);
          show();
          pump();
        })
        .catch(() => {
          // (a cell that cannot be had: the far list keeps standing in for it)
          inFlight.delete(key);
          const tries = (failed.get(key)?.tries ?? 0) + 1;
          failed.set(key, { tries, until: now() + RETRY_MS * 2 ** (tries - 1) });
          pump();
        });
    }
    if (!inFlight.size && !queue.length && !horizonAsked && pack.horizon?.bin && pack.horizon.draws?.length !== 0) {
      horizonAsked = true;
      get(pack.horizon.bin)
        .then((bin) => alive() && onHorizon(bin))
        .catch(() => {});
    }
  }

  return {
    update(position, t = tier) {
      if (!alive()) return;
      tier = t;
      at = position;
      want = wanted(pack, at, tier);
      if (!farAsked) {
        farAsked = true;
        get(pack.far.bin)
          .then((bin) => {
            if (!alive()) return;
            onFar(bin);
            farDone = true;
            show();
            pump();
          })
          .catch(() => {
            // (no far list: the cells alone, as they come)
            farDone = true;
            pump();
          });
        return;
      }
      show();
      pump();
    },
    ready: () => farDone,
    progress() {
      const all = [...want.near, ...want.mid];
      return all.length ? all.filter((k) => shown.has(k)).length / all.length : farDone ? 1 : 0;
    },
    dispose() {
      ctl.abort();
      shown.clear();
    },
  };
}
