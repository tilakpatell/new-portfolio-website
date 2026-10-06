// A concept image to make a model from: one object, front three-quarter
// view, plain white background, even studio light, no text; from a prompt,
// with stable-diffusion.cpp and Z-Image-Turbo on this machine (README.md).
//
//   node scripts/gen3d/picture.mjs "an X-wing starfighter" cache/xwing.png [--seed 42] [--size 1024] [--steps 8]
//   picture(prompt, out, opts) → { out, seconds }

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local');
export const SDCPP = {
  exe: join(LOCAL, 'sdcpp', 'bin', 'sd-cli.exe'),
  model: join(LOCAL, 'sdcpp', 'models', 'z_image_turbo-Q8_0.gguf'),
  llm: join(LOCAL, 'sdcpp', 'models', 'Qwen3-4B-Instruct-2507-Q8_0.gguf'),
  vae: join(LOCAL, 'sdcpp', 'models', 'ae.safetensors'),
};

// What every concept image needs around the subject, so the 3D model gets a
// clean cut-out: TRELLIS.2 was trained on renders like this.
export const prompt = (subject) => `${subject}, a single object centred on a plain pure white background, front three-quarter view from slightly above, even soft studio lighting, sharp detail, physically based materials, no text, no watermark, no shadow on the ground`;

export function command(subject, out, { seed = 42, size = 1024, steps = 8 } = {}) {
  if (!existsSync(SDCPP.exe) || !existsSync(SDCPP.model)) return null;
  // Z-Image-Turbo is distilled: a few steps, no classifier-free guidance
  return [SDCPP.exe, '--diffusion-model', SDCPP.model, '--vae', SDCPP.vae, '--llm', SDCPP.llm, '-p', prompt(subject), '-W', String(size), '-H', String(size), '--steps', String(steps), '--cfg-scale', '1', '--seed', String(seed), '-o', out];
}

export async function picture(subject, out, opts = {}) {
  const cmd = command(subject, out, opts);
  if (!cmd) throw new Error('stable-diffusion.cpp and Z-Image-Turbo are not set up here: see scripts/gen3d/README.md');
  const started = Date.now();
  await new Promise((done, fail) => {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`sd-cli exited ${code}`))));
  });
  if (!existsSync(out)) throw new Error(`sd-cli made no ${out}`);
  return { out, seconds: (Date.now() - started) / 1000 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const opts = { seed: Number(flag('seed', 42)), size: Number(flag('size', 1024)), steps: Number(flag('steps', 8)) };
  const [subject, out] = args;
  if (!subject || !out) throw new Error('usage: node scripts/gen3d/picture.mjs "subject" OUT.png [--seed N] [--size N] [--steps N]');
  const r = await picture(subject, resolve(out), opts);
  console.log(`${r.out} in ${r.seconds.toFixed(0)}s`);
}
