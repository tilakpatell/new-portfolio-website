// Takes the CC0 Kenney models Portal panic uses (kenney.nl: City Kit
// Suburban, Nature Kit, Space Kit, all Creative Commons Zero) from the kits
// as downloaded and unzipped, and writes them, compressed, to
// public/games/kenney/. Stylised low-poly, to sit with the game's toon
// shading; the realistic Poly Haven scans stay with Roll out.
//
//   KENNEY=/path/to/unzipped/kits npm run kenney
//
// where the folder holds kenney_city-kit-suburban_20, kenney_nature-kit,
// kenney_space-kit and kenney_space-station-kit. The output is committed, so the site never needs them.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'kenney');

const KITS = {
  suburban: { dir: 'kenney_city-kit-suburban_20/Models/GLB format', name: 'City Kit (Suburban)', url: 'https://kenney.nl/assets/city-kit-suburban' },
  nature: { dir: 'kenney_nature-kit/Models/GLTF format', name: 'Nature Kit', url: 'https://kenney.nl/assets/nature-kit' },
  space: { dir: 'kenney_space-kit/Models/GLTF format', name: 'Space Kit', url: 'https://kenney.nl/assets/space-kit' },
  station: { dir: 'kenney_space-station-kit/Models/GLB format', name: 'Space Station Kit', url: 'https://kenney.nl/assets/space-station-kit' },
};

// name in the game → [kit, model]
export const MODELS = {
  // the Smiths' backyard
  'house-a': ['suburban', 'building-type-a'],
  'house-c': ['suburban', 'building-type-c'],
  'house-f': ['suburban', 'building-type-f'],
  'house-k': ['suburban', 'building-type-k'],
  fence: ['suburban', 'fence'],
  'tree-large': ['suburban', 'tree-large'],
  'tree-small': ['suburban', 'tree-small'],
  oak: ['nature', 'tree_oak'],
  bush: ['nature', 'plant_bushLarge'],
  rock: ['nature', 'rock_largeA'],
  flowers: ['nature', 'flower_redA'],
  // Cronenberg World
  'dead-tree': ['nature', 'tree_thin_dark'],
  stump: ['nature', 'stump_old'],
  mushroom: ['nature', 'mushroom_redTall'],
  'rock-tall': ['nature', 'rock_tallA'],
  // Gazorpazorp
  spire: ['nature', 'stone_tallA'],
  cliff: ['nature', 'cliff_large_rock'],
  cactus: ['nature', 'cactus_tall'],
  crystal: ['space', 'rock_crystalsLargeA'],
  meteor: ['space', 'meteor_detailed'],
  crater: ['space', 'craterLarge'],
  // the Citadel of Ricks
  console: ['space', 'machine_generatorLarge'],
  computer: ['space', 'desk_computer'],
  pillar: ['space', 'supports_high'],
  barrels: ['space', 'machine_barrelLarge'],
  dish: ['space', 'satelliteDish_detailed'],
  hangar: ['space', 'hangar_roundGlass'],
  turret: ['space', 'turret_double'],
  // inside the Citadel (rickmorty/citadel): Simple Rick's and the Council's chamber
  'station-chair': ['station', 'chair-cushion'],
  'station-table': ['station', 'table-large'],
  'station-computer': ['station', 'computer-system'],
  'station-computer-wide': ['station', 'computer-wide'],
  'station-container': ['station', 'container-flat'],
  'station-container-tall': ['station', 'container-tall'],
  'station-rail': ['station', 'rail'],
  'station-pipe': ['station', 'pipe'],
  'station-banner': ['station', 'wall-banner'],
  'station-display': ['station', 'display-wall-wide'],
};

async function main() {
  const from = process.env.KENNEY;
  if (!from) throw new Error('Set KENNEY to the folder holding the unzipped Kenney kits.');
  const only = process.argv.slice(2);
  await mkdir(OUT, { recursive: true });
  const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
  const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  for (const [name, [kit, model]] of Object.entries(MODELS)) {
    if (only.length && !only.includes(name)) continue;
    const src = join(from, KITS[kit].dir, `${model}.glb`);
    if (!existsSync(src)) throw new Error(`missing ${src}`);
    const out = join(OUT, `${name}.glb`);
    execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', '@gltf-transform/cli@4', 'optimize', src, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '256', '--simplify', 'false'], { stdio: 'ignore' });
    credits[`kenney/${name}`] = { source: KITS[kit].url, id: model, name: `${KITS[kit].name}: ${model}`, authors: ['Kenney'], license: 'CC0 1.0' };
    console.log(`kenney   ${name.padEnd(12)} ${kit}/${model}`);
  }
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
