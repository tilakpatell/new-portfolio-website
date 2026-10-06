// Bakes the universe map's fandom planets' maps into public/textures/universe/
// (scripts/planets/: one baker a planet, on the shared kit in sphere.mjs).
// Everything is made here, from the planets' own data and seeded noise:
// nothing is downloaded.
//
//   node scripts/build-fandom-planets.mjs               every planet
//   node scripts/build-fandom-planets.mjs middleearth   just the ones named

const ALL = ['middleearth', 'breakingbad'];
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
for (const id of want) {
  if (!ALL.includes(id)) throw new Error(`no baker for ${id} (there are: ${ALL.join(', ')})`);
  const t = Date.now();
  const { bake } = await import(`./planets/${id}.mjs`);
  await bake();
  console.log(`${id}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
