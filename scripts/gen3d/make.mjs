// A model for the site from a picture or a prompt, in one go:
//   picture (if a prompt)  →  raw 3D (TRELLIS.2 or, for a picture to follow
//   closely, Pixal3D)  →  baked low-poly (Blender)  →  web GLB  →  judging sheet.
//
//   node scripts/gen3d/make.mjs x-wing --image photo.png --faithful --what "an X-wing starfighter"
//   node scripts/gen3d/make.mjs x-wing --prompt "an X-wing starfighter" --what "an X-wing starfighter"
//   options: --faces 24000 --tex 2048 --seed 42 --res 1024 --fov 49 --engine trelliscpp|trellis2 --no-bake
//
// Everything on the way lands in scripts/gen3d/cache/<name>/; the result in
// public/models/gen3d/<name>.glb, credited in public/games/credits.json.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bake, blender } from './bake.mjs';
import { generate, pixal3dReady } from './generate.mjs';
import { sheet } from './judge.mjs';
import { picture } from './picture.mjs';
import { prepare } from './prepare.mjs';
import { publish } from './web.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'cache');

export async function make(name, { image, prompt, what, faces = 24000, tex = 2048, seed = 42, res = 1024, fov, engine, faithful = Boolean(image), noBake = false }) {
  const dir = join(CACHE, name);
  mkdirSync(dir, { recursive: true });
  const log = (m) => console.log(`[${name}] ${m}`);
  let source = join(dir, 'concept.png');
  if (image) {
    copyFileSync(image, join(dir, 'given.png'));
    await prepare(image, source); // trimmed, squared, 1024: the frame the model expects
  } else if (prompt) {
    const r = await picture(prompt, source, { seed });
    log(`concept picture in ${r.seconds.toFixed(0)}s`);
  } else throw new Error('--image or --prompt');
  if (faithful && !pixal3dReady()) {
    log('Pixal3D weights are not here, so TRELLIS.2 (README.md says how to add them)');
    faithful = false;
  }
  const raw = join(dir, 'raw.glb');
  const g = await generate(source, raw, { seed, res, engine, faithful, fov });
  log(`raw model with ${g.engine}${faithful ? ' (Pixal3D)' : ''} in ${g.seconds.toFixed(0)}s`);
  let low = raw;
  if (!noBake && blender()) {
    low = join(dir, 'baked.glb');
    const b = await bake(raw, low, { faces, tex });
    log(`baked to ${faces} faces in ${b.seconds.toFixed(0)}s`);
  } else log(noBake ? 'no bake: the web cut simplifies the raw mesh' : 'no Blender here: the web cut simplifies the raw mesh');
  const made = g.engine === 'trellis2' ? 'TRELLIS.2' : faithful ? 'Pixal3D (trellis.cpp)' : 'TRELLIS.2 (trellis.cpp)';
  const w = await publish(low, name, { tris: faces, tex, what: what ?? name, engine: low === raw ? made : `${made}, baked in Blender` });
  log(`${Math.round(w.before)} → ${Math.round(w.after)} triangles, ${(w.bytes / 1024).toFixed(0)} KB → ${w.out}`);
  if (process.env.CHROME) {
    const out = join(dir, 'sheet.png');
    await sheet(out, [raw, w.out]);
    log(`judge: ${out}`);
  }
  return { source, raw, low, out: w.out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const on = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args.splice(i, 1).length > 0;
  };
  const faithful = on('faithful');
  const noBake = on('no-bake');
  const opts = { image: flag('image') && resolve(flag('image')), prompt: flag('prompt'), what: flag('what'), faces: Number(flag('faces', 24000)), tex: Number(flag('tex', 2048)), seed: Number(flag('seed', 42)), res: Number(flag('res', 1024)), fov: flag('fov') && Number(flag('fov')), engine: flag('engine'), noBake };
  const [name] = args;
  const usage = 'usage: node scripts/gen3d/make.mjs NAME (--image FILE | --prompt "…") [--faithful] [--what "…"] [--faces N] [--tex N]';
  if (!name || !(opts.image || opts.prompt)) throw new Error(usage);
  if (opts.image && !existsSync(opts.image)) throw new Error(`no ${opts.image}\n${usage}`);
  await make(name, { ...opts, faithful: faithful || Boolean(opts.image) });
}
