// A concept image to make a model from: one object, front three-quarter
// view, plain white background, even studio light, no text; from a prompt,
// with stable-diffusion.cpp and Z-Image-Turbo on this machine (README.md).
//
//   node scripts/gen3d/picture.mjs "an X-wing starfighter" cache/xwing.png [--model flux|zimage] [--seed 42] [--size 1024] [--steps N]
//   picture(prompt, out, opts) → { out, seconds }

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { live, localDir } from '../desktop/lib.mjs';

const SD = localDir('sdcpp'); // %LOCALAPPDATA%\sdcpp, or the Claude app's boxed copy (scripts/desktop/lib.mjs)
const MODELS = join(SD, 'models');
export const SDCPP = {
  exe: join(SD, 'bin', 'sd-cli.exe'),
  vae: join(MODELS, 'ae.safetensors'), // the Flux VAE, which Z-Image shares
  // Z-Image-Turbo (6B, Apache): quick, good at generic things, weak on famous designs
  zimage: { model: join(MODELS, 'z_image_turbo-Q8_0.gguf'), llm: join(MODELS, 'Qwen3-4B-Instruct-2507-Q8_0.gguf'), steps: 8 },
  // FLUX.1-schnell (12B, Apache): knows far more of the world, four steps
  flux: { model: join(MODELS, 'flux1-schnell-Q8_0.gguf'), clip: join(MODELS, 'clip_l.safetensors'), t5: join(MODELS, 't5-v1_1-xxl-encoder-Q8_0.gguf'), steps: 4 },
};
export const ready = (name) => existsSync(SDCPP.exe) && existsSync(SDCPP[name].model);

// What every concept image needs around the subject, so the 3D model gets a
// clean cut-out: TRELLIS.2 was trained on renders like this.
export const prompt = (subject) => `${subject}, a single object centred on a plain pure white background, front three-quarter view from slightly above, even soft studio lighting, sharp detail, physically based materials, no text, no watermark, no shadow on the ground`;

// GEN3D_PICTURE=fake: the contract tests' stand-in (scripts/ai-e2e/fakes/picture.mjs), a grey box on white marked by the seed
const FAKE = join(dirname(fileURLToPath(import.meta.url)), '..', 'ai-e2e', 'fakes', 'picture.mjs');

export function command(subject, out, { seed = 42, size = 1024, steps, model = ready('flux') ? 'flux' : 'zimage' } = {}) {
  if (process.env.GEN3D_PICTURE === 'fake') return [process.execPath, FAKE, out, '--seed', String(seed), '--size', String(size)];
  if (!ready(model)) return null;
  const m = SDCPP[model];
  const encoders = model === 'flux' ? ['--clip_l', m.clip, '--t5xxl', m.t5] : ['--llm', m.llm];
  // both are distilled: a few steps, no classifier-free guidance
  return [SDCPP.exe, '--diffusion-model', m.model, '--vae', SDCPP.vae, ...encoders, '-p', prompt(subject), '-W', String(size), '-H', String(size), '--steps', String(steps ?? m.steps), '--cfg-scale', '1', '--seed', String(seed), '-o', out];
}

export async function picture(subject, out, opts = {}) {
  const cmd = command(subject, out, opts);
  if (!cmd) throw new Error('stable-diffusion.cpp and Z-Image-Turbo are not set up here: see scripts/gen3d/README.md');
  const started = Date.now();
  await live(cmd[0], cmd.slice(1), { name: 'sd-cli', minutes: Number(process.env.GEN3D_PICTURE_MINUTES ?? 10) });
  if (!existsSync(out)) throw new Error(`sd-cli made no ${out}`);
  return { out, seconds: (Date.now() - started) / 1000 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const opts = { seed: Number(flag('seed', 42)), size: Number(flag('size', 1024)), steps: (() => { const s = flag('steps'); return s && Number(s); })(), model: flag('model', ready('flux') ? 'flux' : 'zimage') };
  const [subject, out] = args;
  if (!subject || !out) throw new Error('usage: node scripts/gen3d/picture.mjs "subject" OUT.png [--seed N] [--size N] [--steps N]');
  const r = await picture(subject, resolve(out), opts);
  console.log(`${r.out} in ${r.seconds.toFixed(0)}s`);
}
