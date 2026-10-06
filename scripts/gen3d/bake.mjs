// The high-poly raw model baked onto a low-poly one, through Blender in the
// background (bake.py has the how and why).
//
//   node scripts/gen3d/bake.mjs RAW.glb OUT.glb [--faces 24000] [--tex 2048]
//   bake(raw, out, opts) → { out, seconds }

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local');

// Blender: $BLENDER, a portable copy under %LOCALAPPDATA%\blender, or an installed one.
export function blender() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
  for (const root of [join(LOCAL, 'blender'), 'C:\\Program Files\\Blender Foundation']) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => /^blender/i.test(d)).sort().reverse();
    for (const d of dirs) {
      const exe = join(root, d, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

export function command(raw, out, { faces = 24000, tex = 2048 } = {}) {
  const exe = blender();
  return exe && [exe, '--background', '--python', join(HERE, 'bake.py'), '--', raw, out, '--faces', String(faces), '--tex', String(tex)];
}

export async function bake(raw, out, opts = {}) {
  const cmd = command(raw, out, opts);
  if (!cmd) throw new Error('Blender is not set up here: see scripts/gen3d/README.md');
  const started = Date.now();
  await new Promise((done, fail) => {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`blender exited ${code}`))));
  });
  if (!existsSync(out)) throw new Error(`blender made no ${out}`);
  return { out, seconds: (Date.now() - started) / 1000 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const opts = { faces: Number(flag('faces', 24000)), tex: Number(flag('tex', 2048)) };
  const [raw, out] = args;
  if (!raw || !out) throw new Error('usage: node scripts/gen3d/bake.mjs RAW.glb OUT.glb [--faces N] [--tex N]');
  const r = await bake(resolve(raw), resolve(out), opts);
  console.log(`${r.out} in ${r.seconds.toFixed(0)}s`);
}
