// Which of a 2017 figure's cuts is drawn, and when. A kind imported at full
// fidelity (scripts/bf2017-import.mjs --full: its row says `full`) has three
// files: the plain one, the game's LOD0 with its own KTX2 maps at 2048 (in
// the bucket: the stormtrooper's is 25 MB, 48 MB on the GPU), the `.lod1`
// (the game's LOD4 at 1024 and 512, about half a megabyte) and, for the
// kinds the assaults field, the `.far` (the last LOD at 256 and 128, under
// 150 KB). The figure is drawn from its `.lod1` first; within the level's
// `near` the plain one is swapped in when it lands, and past its `mid` the
// far one (lib/net/progressive.js holds those bands). The swap moves only
// the meshes (walrus.js's swapBody, the heroes' too): the three cuts stand
// on the same whole skeleton, so the figure's bones, its animator, its
// sockets and its clips go on as they were.
//
// A full cut costs both ways: its download (a world's models are held to
// 60 MB at high, 240 at ultra: lib/budgets.js) and its GPU memory (the
// texture contract's 256 MB a world). So a page admits full cuts kind by
// kind into a share of each (FULL_SHARE, by level: none on a phone's
// levels), the first kinds a visitor walks up to first, and a kind refused
// keeps its `.lod1`. The share is the knob the owner turns (the hand-off
// says where); a row tells the ledger its kind's `fullMB` (GPU) and
// `fullDL` (download, MB).
//
//   cutWanted(distance, level, { hasLod, hasFar, lowData, admitted }) →
//     'plain' | 'lod1' | 'far'                                   (pure)
//   createLedger({ gpu, download }) → { admit(key, { gpu, download }) →
//     boolean, used() → { gpu, download } }
//   FULL_SHARE: the share by level, MB
//   createCutter(…): one figure's cut kept to its distance (below)

import { firstCut, wantsUpgrade } from '../net/progressive';

export const FULL_SHARE = { low: null, mid: null, high: { gpu: 128, download: 30 }, ultra: { gpu: 448, download: 160 } };
const shareOf = (level) => (level in FULL_SHARE ? FULL_SHARE[level] : FULL_SHARE.high);

export function cutWanted(distance, level, { hasLod = true, hasFar = false, lowData = false, admitted = false } = {}) {
  const first = firstCut(distance, level, { hasLod, hasFar, lowData });
  const upgrade = first === 'plain' || wantsUpgrade(distance, level, { lowData });
  // (the full cut only on a level that upgrades at all: a phone's never does)
  const full = upgrade && Boolean(shareOf(level)) && !lowData;
  if (full && (admitted || !hasLod)) return 'plain';
  if (first === 'plain') return hasLod ? 'lod1' : 'plain';
  return first;
}

export function createLedger(cap) {
  const kinds = new Set();
  const used = { gpu: 0, download: 0 };
  return {
    admit(key, { gpu = 0, download = 0 } = {}) {
      if (kinds.has(key)) return true;
      if (!cap || used.gpu + gpu > cap.gpu || used.download + download > cap.download) return false;
      kinds.add(key);
      used.gpu += gpu;
      used.download += download;
      return true;
    },
    used: () => ({ ...used }),
  };
}

// One page's ledger a level (a world's figures share it; the next world's page starts again).
const ledgers = new Map();
export const ledgerFor = (level) => (ledgers.has(level) ? ledgers : ledgers.set(level, createLedger(shareOf(level)))).get(level);

// A cut's file beside the plain one.
export const cutUrl = (url, cut) => (cut === 'plain' ? url : url.replace(/\.glb$/, `.${cut}.glb`));

// The figure's cut, kept to what its distance wants: `at(d)` each step (or
// less often); a change is asked for only when the distance is past the band
// by a tenth either side, so a figure on the line doesn't flicker, and one
// load at a time. `load(url)` → a glTF (the page's cache), `swap(gltf)` puts
// it on the figure. A cut that won't load is not asked for again.
//   createCutter({ url, cuts: { lod, far, fullMB, fullDL }, level, lowData, ledger, key, start, load, swap })
//     → { at(distance) → Promise | null, current() → cut }
export function createCutter({ url, cuts = {}, level, lowData = false, ledger = ledgerFor(level), key = url, start = 'lod1', load, swap }) {
  let current = start;
  let busy = false;
  const failed = new Set();
  const want = (d) => {
    const admitted = !failed.has('plain') && ledger.admit(key, { gpu: cuts.fullMB ?? 0, download: cuts.fullDL ?? 0 });
    return cutWanted(d, level, { hasLod: Boolean(cuts.lod) && !failed.has('lod1'), hasFar: Boolean(cuts.far) && !failed.has('far'), lowData, admitted });
  };
  return {
    current: () => current,
    at(d) {
      if (busy) return null;
      const near = cutWanted(d * 0.9, level, { hasLod: Boolean(cuts.lod), hasFar: Boolean(cuts.far), lowData, admitted: true });
      const far = cutWanted(d * 1.1, level, { hasLod: Boolean(cuts.lod), hasFar: Boolean(cuts.far), lowData, admitted: true });
      if (near !== far) return null;
      // (the ledger is asked only when the full cut is what the distance wants)
      const next = near === 'plain' ? want(d) : near;
      if (next === current || failed.has(next)) return null;
      busy = true;
      return Promise.resolve(load(cutUrl(url, next)))
        .then((gltf) => {
          if (!gltf) throw new Error('no file');
          swap(gltf);
          current = next;
        })
        .catch(() => failed.add(next))
        .finally(() => (busy = false));
    },
  };
}
