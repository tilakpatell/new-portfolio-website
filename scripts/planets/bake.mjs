// The one bake for the universe map's planet maps: every baker here in
// scripts/planets/ (one a planet, on sphere.mjs's shared kit), each saving
// through sphere.mjs's save() on the one size ladder and recording what it
// wrote in public/textures/universe/index.json (manifest.mjs), which is how
// planetMaps.js knows the maps and their sizes. Maps another pipeline makes
// are recorded from their files on disk (--record): Earth's, the sun's and
// the stations' plates (scripts/build-universe-textures.py calls it when it
// has written them), the universe's sky (scripts/bake-universe-sky.mjs).
//
//   node scripts/planets/bake.mjs --all                 every baker (a quarter of an hour on 4 cores)
//   node scripts/planets/bake.mjs --only office,giants  just those (or: bake.mjs office giants)
//   node --max-old-space-size=12288 scripts/planets/bake.mjs --ultra [--only …]
//                                                       the 8192 colour maps (-8k.ktx2)
//                                                       worn near at ultra (the bakers
//                                                       whose maps have an -xl)
//   node scripts/planets/bake.mjs --record earth,sun    maps made elsewhere, as they are on disk
//
// All but 'giants' (Music's and Marvel's, recoloured from Solar System
// Scope's maps, fetched once into node_modules/.cache/universe) are made
// from nothing but code.

const BAKERS = ['middleearth', 'breakingbad', 'caribbean', 'rickmorty', 'office', 'giants', 'transformers', 'invincible'];
// (Cybertron's is worked at 4096 but ships no -xl, Invincible's at 2048:
// neither has anything for --ultra)
const ULTRA_BAKERS = BAKERS.filter((b) => b !== 'transformers' && b !== 'invincible');

const args = process.argv.slice(2);
const list = (flag) => {
  const at = args.indexOf(flag);
  return at < 0 ? null : (args[at + 1] ?? '').split(',').filter(Boolean);
};
const named = args.filter((a, i) => !a.startsWith('--') && !['--only', '--record'].includes(args[i - 1]));

if (args.includes('--record')) {
  const names = [...(list('--record') ?? []), ...named];
  if (!names.length) throw new Error('--record needs the maps to record: --record earth,earth-night');
  const { recordFiles } = await import('./sphere.mjs');
  await recordFiles(names);
} else {
  // (--ultra: sphere.mjs reads it before any baker is loaded)
  if (args.includes('--ultra')) process.env.PLANETS_8K = '1';
  const pool = args.includes('--ultra') ? ULTRA_BAKERS : BAKERS;
  const want = args.includes('--all') ? pool : [...(list('--only') ?? []), ...named];
  if (!want.length) {
    console.log('node scripts/planets/bake.mjs --all | --only <bakers> | --record <maps> (the header says more)');
    process.exit(1);
  }
  for (const id of want) if (!pool.includes(id)) throw new Error(`no baker for ${id}${args.includes('--ultra') ? ' at --ultra' : ''} (there are: ${pool.join(', ')})`);
  for (const id of want) {
    const t = Date.now();
    const { bake } = await import(`./${id}.mjs`);
    await bake();
    console.log(`${id}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
}
