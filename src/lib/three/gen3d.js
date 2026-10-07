// The models made here (scripts/gen3d, public/models/gen3d/) come in three
// cuts, and the one to load follows the device's detail level (lib/budgets'
// `cut`): a phone the 20k-face one with 1024 maps (.lo), a laptop held at
// mid the 60k one, high the 120k one with 4096 maps (.hq). A model asked for
// it (scripts/gen3d --ultra) has a fourth, the raw 300k-face mesh with 8192
// maps (.ultra), loaded at ultra; ultra falls back to .hq for the rest. Which
// models have one is asked once a name (a HEAD request, `gen3dUrlChecked`)
// and remembered: until then `gen3dUrl` gives ultra the .hq cut.

import { device } from '../device';

export const CUTS = { ultra: '.ultra', high: '.hq', mid: '', low: '.lo' };

export const gen3dFile = (name, detail) => `${name}${CUTS[detail] ?? ''}.glb`;

const there = new Map(); // name → whether its .ultra file is there (once asked)
export const forgetUltra = () => there.clear();

const urlOf = (file) => `${import.meta.env?.BASE_URL ?? '/'}models/gen3d/${file}`.replace(/\/\/models/, '/models');

export const gen3dUrl = (name, detail = device().detail) => urlOf(gen3dFile(name, detail === 'ultra' && !there.get(name) ? 'high' : detail));

// The URL once it's known whether the ultra file is there (asked at ultra
// only, once a name; a failed ask counts as not there).
export async function gen3dUrlChecked(name, detail = device().detail, fetchFn = globalThis.fetch) {
  if (detail === 'ultra' && !there.has(name)) {
    let ok = false;
    try {
      ok = Boolean((await fetchFn(urlOf(gen3dFile(name, 'ultra')), { method: 'HEAD' }))?.ok);
    } catch {
      ok = false;
    }
    there.set(name, ok);
  }
  return gen3dUrl(name, detail);
}
