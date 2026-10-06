// One concept image in, one raw textured GLB out, from a local engine:
//   trelliscpp  trellis.cpp (TRELLIS.2-4B in GGML, f16 weights), CUDA, on Windows
//   trellis2    the reference microsoft/TRELLIS.2 (bf16, PyTorch), in WSL
// Both are installed as scripts/gen3d/README.md says. The raw GLB is big
// (hundreds of thousands of triangles, a 2k–4k PBR atlas); web.mjs cuts it
// to the site's budget.
//
//   node scripts/gen3d/generate.mjs IMAGE OUT.glb [--engine trelliscpp|trellis2] [--seed 42] [--res 1024] [--faithful [--fov 49]]
//   generate(image, out, opts) → { engine, seconds, out }

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local');
export const TRELLISCPP = { exe: join(LOCAL, 'trellis-studio', 'runtime', 'trellis-cli.exe'), models: join(LOCAL, 'trellis-studio', 'models') };
export const WSL = { distro: process.env.GEN3D_WSL_DISTRO ?? 'Ubuntu-24.04', conda: '~/miniforge3', env: 'trellis2' };
export const ENGINES = ['trelliscpp', 'trellis2'];

// A Windows path as WSL sees it (C:\x\y → /mnt/c/x/y).
export const wslPath = (p) => (/^[A-Za-z]:[\\/]/.test(p) ? `/mnt/${p[0].toLowerCase()}/${p.slice(3).replace(/\\/g, '/')}` : p);

// The command line for an engine, as [exe, ...args]; null if it isn't set up here.
// Pixal3D: a TRELLIS.2 fine-tune that projects each 3D cell into the picture and
// samples it there (pixel-aligned), so a photo or a drawing is followed more
// closely; its own flow weights sit beside TRELLIS.2's as pixal3d_*.gguf.
export const pixal3dReady = () => existsSync(join(TRELLISCPP.models, 'pixal3d_shape_flow_1024.gguf'));

export function command(engine, image, out, { seed = 42, res = 1024, faces, tex, faithful = false, fov } = {}) {
  if (engine === 'trelliscpp') {
    if (!existsSync(TRELLISCPP.exe)) return null;
    // the default quadric simplify (300K faces @1024) and atlas (2048 @1024); PBR WebP textures
    const model = faithful ? ['--model', 'pixal3d', ...(fov ? ['--fov', String(fov)] : [])] : [];
    return [TRELLISCPP.exe, image, out, '--models', TRELLISCPP.models, '--seed', String(seed), '--res', String(res), '--require-gpu', ...model, ...(tex ? ['--atlas', String(tex)] : [])];
  }
  if (engine === 'trellis2') {
    const script = wslPath(join(HERE, 'engines', 'trellis2.py'));
    const run = `source ${WSL.conda}/bin/activate ${WSL.env} && cd ~/TRELLIS.2 && python ${q(script)} ${q(wslPath(image))} ${q(wslPath(out))} --seed ${seed} --faces ${faces ?? 1000000} --tex ${tex ?? 4096}`;
    return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
  }
  throw new Error(`no engine ${engine} (${ENGINES.join(', ')})`);
}

const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export async function generate(image, out, opts = {}) {
  const engine = opts.engine ?? ENGINES.find((e) => command(e, image, out, opts)) ?? null;
  const cmd = engine && command(engine, image, out, opts);
  if (!cmd) throw new Error(`${opts.engine ?? 'no engine'} isn't set up here: see scripts/gen3d/README.md`);
  const started = Date.now();
  await new Promise((done, fail) => {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${engine} exited ${code}`))));
  });
  if (!existsSync(out)) throw new Error(`${engine} made no ${out}`);
  return { engine, seconds: (Date.now() - started) / 1000, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args.splice(i, 2)[1] : dflt;
  };
  const faithful = args.includes('--faithful') && args.splice(args.indexOf('--faithful'), 1).length > 0;
  const opts = { engine: flag('engine'), seed: Number(flag('seed', 42)), res: Number(flag('res', 1024)), tex: flag('tex') && Number(flag('tex')), faces: flag('faces') && Number(flag('faces')), faithful, fov: flag('fov') && Number(flag('fov')) };
  const [image, out] = args;
  if (!image || !out) throw new Error('usage: node scripts/gen3d/generate.mjs IMAGE OUT.glb [--engine trelliscpp|trellis2] [--seed N] [--res 512|1024|1536]');
  const r = await generate(resolve(image), resolve(out), opts);
  console.log(`${r.engine}: ${r.out} in ${r.seconds.toFixed(0)}s`);
}
