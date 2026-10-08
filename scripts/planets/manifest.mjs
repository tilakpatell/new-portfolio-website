// The universe map's planet maps as one manifest, public/textures/universe/index.json,
// which planetMaps.js reads instead of a hand list: every map, the sizes it
// comes in, what kind of map it is. Written by the bake (scripts/planets/bake.mjs:
// sphere.mjs's save() records each map it writes, `--record` the maps other
// pipelines make), never by hand.
//
// One size ladder for every map: `-sm` 512, `''` (std) 1024, `-hq` 2048,
// `-xl` 4096 as KTX2, each the width of a 2:1 map. A baker picks which rungs
// a map ships, never their widths, and never a rung wider than it worked the
// map at (an `-xl` only from a baker that works at 4096 or more).
//
// An entry, by name ('middleearth', 'middleearth-normal', …):
//   { sizes: { sm?: [w, h], std: [w, h], hq?: [w, h], xl?: [w, h] },
//     xl: 'ktx2' | null,                (whether there is an -xl, and its format)
//     kind: 'colour' | 'normal' | 'rough' | 'night' | 'glow' | 'clouds',
//     srgb: boolean,                    (a colour to the loader, or data: normals,
//                                        roughness, a cloud's alpha, Cybertron's packed glow)
//     std2048?: true }                  (the flag: this map's std is 2048, not 1024;
//                                        Earth's and Cybertron's, the two planets
//                                        whose standard file was always 2048)
// Maps another pipeline makes (Earth's, the sun's, the tiling plates' from
// scripts/build-universe-textures.py; the universe sky's from
// scripts/bake-universe-sky.mjs; Music's and Marvel's when they can't be
// fetched) are recorded as they are on disk, ladder or not.
//
// Pure: no files, no three.js (sphere.mjs reads and writes the file).
//
//   LADDER, RUNGS                        the ladder: { sm: 512, std: 1024, hq: 2048, xl: 4096 }
//   kindOf(name) → kind                  by the name's last part ('-normal' → 'normal'; none → 'colour')
//   fileOf(name, rung) → file            'middleearth-xl.ktx2', 'middleearth.webp'…
//   widths(rungs, workW, { std2048 }) → [[rung, width]]   (throws on an upscale)
//   recordSave(manifest, name, sizes, { kind, srgb, std2048, replace }) → a new manifest
//   recordBake(manifest, name, sizes, { seen, partial, …recordSave's }) → a new manifest
//   onLadder(entry) → the rungs off the ladder ([] when it's on)
//   format(manifest) → index.json's text (sorted, an entry a line)

export const LADDER = { sm: 512, std: 1024, hq: 2048, xl: 4096 };
export const RUNGS = ['sm', 'std', 'hq', 'xl'];
const SUFFIX = { sm: '-sm', std: '', hq: '-hq', xl: '-xl' };
const KINDS = ['normal', 'rough', 'night', 'glow', 'clouds'];
// (what the loader takes as a colour unless a baker says otherwise)
const SRGB = { colour: true, night: true, glow: true, normal: false, rough: false, clouds: false };

export const kindOf = (name) => KINDS.find((k) => name.endsWith(`-${k}`)) ?? 'colour';
export const fileOf = (name, rung) => `${name}${SUFFIX[rung]}${rung === 'xl' ? '.ktx2' : '.webp'}`;
const widthOf = (rung, std2048) => (rung === 'std' && std2048 ? 2048 : LADDER[rung]);

// The width of each rung asked for, from a map worked at `workW`: a rung the
// work is too small for is a mistake (it would be an upscale), and so is an
// -hq no finer than a 2048 std.
export function widths(rungs, workW, { std2048 = false } = {}) {
  return rungs.map((rung) => {
    if (!(rung in LADDER)) throw new Error(`no rung '${rung}' (the ladder: ${RUNGS.join(', ')})`);
    if (rung === 'hq' && std2048) throw new Error('an -hq at 2048 is no finer than a 2048 std');
    const w = widthOf(rung, std2048);
    if (w > workW) throw new Error(`-${rung} is ${w} wide, the map was worked at ${workW}: never upscaled`);
    return [rung, w];
  });
}

// The manifest with one map's sizes merged in (a baker may save a map's
// rungs in more than one call: Middle-earth's relief is steeper at -hq, and
// saved first, so a map may be without its std for a moment), or
// with `replace`, put in place of what it had (a map recorded from disk,
// whose files are the whole truth). Its kind, colour space and flag carry
// over from before unless given.
export function recordSave(manifest, name, sizes, { kind, srgb, std2048, replace = false } = {}) {
  const was = manifest[name];
  const all = { ...(replace ? {} : was?.sizes), ...sizes };
  const k = kind ?? was?.kind ?? kindOf(name);
  const flag = std2048 ?? was?.std2048 ?? false;
  const entry = {
    sizes: Object.fromEntries(RUNGS.filter((r) => all[r]).map((r) => [r, [...all[r]]])),
    xl: all.xl ? 'ktx2' : null,
    kind: k,
    srgb: srgb ?? was?.srgb ?? SRGB[k],
    ...(flag ? { std2048: true } : {}),
  };
  return { ...manifest, [name]: entry };
}

// What a bake's save records: the first save of a map in a run (`seen`, the
// names that run has saved) puts its rungs in place of what the manifest had,
// so a rung the baker stopped shipping goes; the run's later saves of that map
// merge (a map saved in more than one call). A partial run (`partial`:
// PLANETS_XL=only or skip, which leave some rungs as they are) only merges.
export function recordBake(manifest, name, sizes, { seen, partial = false, ...opts }) {
  const replace = !partial && !seen.has(name);
  seen.add(name);
  return recordSave(manifest, name, sizes, { ...opts, replace });
}

// The rungs of an entry whose width isn't the ladder's (a map another
// pipeline makes may be; one this bake makes is not).
export function onLadder(entry) {
  return Object.entries(entry.sizes)
    .filter(([rung, [w, h]]) => w !== widthOf(rung, entry.std2048) || h * 2 !== w)
    .map(([rung]) => rung);
}

// index.json: sorted by name so a bake in any order writes the same file,
// an entry a line so a re-bake's diff reads map by map.
export function format(manifest) {
  const names = Object.keys(manifest).sort();
  return `{\n${names.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(manifest[n])}`).join(',\n')}\n}\n`;
}
