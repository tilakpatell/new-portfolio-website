// The Minecraft tribute's textures, built from a resource pack:
//
//   node scripts/mc-atlas.mjs <pack folder, .zip or .jar> [--name pixel-perfection]
//                             [--vanilla <minecraft .jar>] [--allow-missing] [--out public/mc]
//
// Reads the pack as the game does (assets/minecraft/textures/…), through the
// same builder the page uses for a visitor's own pack
// (src/components/minecraft/pack/atlas.js), and writes what the world draws:
// blocks.webp (every block tile, a 16-wide strip in TEXTURES' order, lossless),
// items.webp the same for the items once there are any, skins/<mob>.webp,
// sprites/<name>.webp (the sun, moon, clouds and the HUD's pieces), and
// manifest.json (the order, the animation frames, the pack's name and licence).
//
// The shipped pack is Pixel Perfection (XSSheep, continued as Pixel
// Perfection Legacy by Nova_Wostra; CC BY-SA 4.0), downloaded by hand and
// kept outside the repository. Mojang's own textures may not be redistributed:
// `--vanilla` takes the game's jar and fails if any tile written is a copy of
// the game's (90% or more of its pixels the same), so nothing of Mojang's
// slips in where a pack fell back on the original.
//
// Fails when a block tile is missing (it would draw as the magenta checker)
// unless --allow-missing.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { buildAtlas } = await load('src/components/minecraft/pack/atlas.js');
const { SKINS, SPRITES } = await load('src/components/minecraft/pack/aliases.js');
const { TEXTURES } = await load('src/components/minecraft/rules/blocks.js');
const ITEM_TEXTURES = (await load('src/components/minecraft/rules/items.js').catch(() => ({}))).ITEM_TEXTURES ?? [];

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const pack = args.find((a, i) => !a.startsWith('--') && !['--name', '--vanilla', '--out'].includes(args[i - 1]));
if (!pack) {
  console.error('usage: node scripts/mc-atlas.mjs <pack folder, .zip or .jar> [--name pixel-perfection] [--vanilla <jar>] [--allow-missing] [--out public/mc]');
  process.exit(2);
}
const name = option('name', 'pixel-perfection');
const out = join(ROOT, option('out', 'public/mc'));

// what's written into the manifest (and shown on the page) for each pack the script knows
const PACKS = {
  'pixel-perfection': {
    name: 'Pixel Perfection Legacy',
    authors: ['XSSheep', 'Nova_Wostra'],
    source: 'https://modrinth.com/resourcepack/pixel-perfection-legacy',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
};

// a pack as `read(path) → bytes | null`: a folder on disk, or a zip or jar
async function opener(path) {
  if ((await stat(path)).isDirectory()) return async (p) => readFile(join(path, p)).catch(() => null);
  const files = unzipSync(new Uint8Array(await readFile(path)), { filter: (f) => f.name.startsWith('assets/minecraft/textures/') });
  return async (p) => files[p] ?? null;
}

const decode = async (bytes) => {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
};

const atlas = await buildAtlas(await opener(pack), { blocks: TEXTURES, items: ITEM_TEXTURES, skins: SKINS, sprites: SPRITES, decode, source: PACKS[name]?.source ?? name });

const blockMissing = atlas.missing.filter((m) => m.startsWith('block/'));
if (atlas.missing.length) console.log(`missing (${atlas.missing.length}): ${atlas.missing.join(', ')}`);

// ── the game's own, refused ──
const vanilla = option('vanilla', null);
if (vanilla) {
  const read = await opener(vanilla);
  const game = await buildAtlas(read, { blocks: TEXTURES, items: ITEM_TEXTURES, skins: SKINS, sprites: SPRITES, decode });
  const same = (a, b) => {
    if (!a || !b || a.length !== b.length) return 0;
    let n = 0;
    let eq = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] === 0 && b[i + 3] === 0) continue;
      n++;
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) eq++;
    }
    return n ? eq / n : 0;
  };
  const copies = [];
  let most = 0;
  const T = 16 * 16 * 4;
  for (const [kind, list] of [['blocks', TEXTURES], ['items', ITEM_TEXTURES]])
    list.forEach((t, i) => {
      const where = `${kind === 'blocks' ? 'block' : 'item'}/${t}`;
      if (game.missing.includes(where)) return;
      const s = same(atlas[kind].data.subarray(i * T, (i + 1) * T), game[kind].data.subarray(i * T, (i + 1) * T));
      most = Math.max(most, s);
      if (s >= 0.9) copies.push(`${where} (${Math.round(s * 100)}%)`);
    });
  for (const kind of ['skins', 'sprites'])
    for (const k of Object.keys(atlas[kind])) {
      const s = same(atlas[kind][k].data, game[kind][k]?.data);
      most = Math.max(most, s);
      if (s >= 0.9) copies.push(`${kind}/${k} (${Math.round(s * 100)}%)`);
    }
  console.log(`against the game's own: the closest tile shares ${Math.round(most * 100)}% of its pixels`);
  if (copies.length) {
    console.error(`these are the game's own textures and may not ship: ${copies.join(', ')}`);
    process.exit(1);
  }
}

if (blockMissing.length && !flag('allow-missing')) {
  console.error(`${blockMissing.length} block tiles missing: add them to src/components/minecraft/pack/aliases.js, or pass --allow-missing`);
  process.exit(1);
}

// ── written ──
const strip = (s) => sharp(Buffer.from(s.data.buffer, s.data.byteOffset, s.data.length), { raw: { width: s.width, height: s.height * s.layers, channels: 4 } }).webp({ lossless: true, effort: 6 });
await mkdir(join(out, 'skins'), { recursive: true });
await mkdir(join(out, 'sprites'), { recursive: true });
await strip(atlas.blocks).toFile(join(out, 'blocks.webp'));
if (atlas.items.layers) await strip(atlas.items).toFile(join(out, 'items.webp'));
for (const [k, s] of Object.entries(atlas.skins)) await strip({ ...s, layers: 1 }).toFile(join(out, 'skins', `${k}.webp`));
for (const [k, s] of Object.entries(atlas.sprites)) await strip({ ...s, layers: 1 }).toFile(join(out, 'sprites', `${k}.webp`));
const manifest = { ...PACKS[name], id: name, ...atlas.manifest, missing: atlas.missing };
await writeFile(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const kb = async (f) => ((await stat(join(out, f))).size / 1024).toFixed(1);
console.log(`blocks.webp ${atlas.blocks.layers} tiles, ${await kb('blocks.webp')} kB; ${atlas.items.layers} items; ${Object.keys(atlas.skins).length} skins; ${Object.keys(atlas.sprites).length} sprites; frames ${JSON.stringify(atlas.manifest.frames)}`);
