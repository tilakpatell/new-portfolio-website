// Makes Portal panic's cast, enemies and set pieces, and the Scranton office's
// people, with Meshy (meshy.ai), the site owner's account: a concept image for
// each, then a textured model from the image, then (for the ones that walk on
// two legs) a skeleton with walking and running clips. Output is compressed
// for the web into public/games/meshy/ (the office's people: their skeleton
// and no clips, the browser sits them down, into public/models/office/cast/)
// and credited in public/games/credits.json. The output is committed, so the
// site never calls Meshy.
//
//   node --env-file=.env.local scripts/meshy.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), rig (5), anim (an
// idle clip, 3), sit (a seated clip, 3), fetch (free: download and
// compress). Each task's id is kept in scripts/meshy-tasks.json, so running
// a step again never pays twice; delete a name's entry there to make it
// again. MESHY_API_KEY comes from .env.local (git ignores it); it is never
// printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'meshy');
const OFFICE_OUT = join(ROOT, 'public', 'models', 'office', 'cast');
const REVIEW = join(ROOT, 'lab', 'meshy'); // concept images, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';
// the office's people: figures, not drawings, each as the show dresses them
const OFFICE = 'Stylized 3D animated-film character, slightly caricatured, clean simple shapes, matte colours. Full body, front view, standing straight in an A-pose, arms a little away from the body, empty hands. Plain white background, no text, no shadow.';
// (height: the actor's, as src/components/office/people.js seats them)
const staff = (height, who, looks) => ({ rig: true, clips: false, set: 'office', height, poly: 10000, tex: 1024, aspect: '3:4', style: OFFICE, prompt: `${who} from the TV show The Office: ${looks}.` });

// rig: a two-legged character to give a skeleton and walk/run clips
// height: metres, for the rig; poly: target faces; tex: texture size in the game
export const ASSETS = {
  // the heroes
  rick: { rig: true, height: 1.8, poly: 14000, tex: 1024, prompt: `Rick Sanchez from Rick and Morty: a tall thin old scientist with spiky pale blue-grey hair, a unibrow, a long white lab coat open over a light blue shirt, brown trousers and brown shoes. ${BODY}` },
  morty: { rig: true, height: 1.5, poly: 14000, tex: 1024, prompt: `Morty Smith from Rick and Morty: a nervous 14-year-old boy with short brown hair and a round head, in a yellow T-shirt, blue jeans and white sneakers. ${BODY}` },
  pickle: { rig: false, poly: 9000, tex: 1024, prompt: `Pickle Rick from Rick and Morty: a green pickle standing upright with Rick's face on it (a unibrow, wide eyes, a big grin). ${PROP}` },
  // the enemies
  meeseeks: { rig: true, height: 1.9, poly: 8000, tex: 512, prompt: `Mr. Meeseeks from Rick and Morty: a tall thin pale blue creature with a big round head, a wide happy open-mouthed smile and long thin arms, wearing nothing. ${BODY}` },
  gromflomite: { rig: true, height: 1.9, poly: 8000, tex: 512, prompt: `A Gromflomite soldier of the Galactic Federation from Rick and Morty: an insect man with a big grey-green fly head and red compound eyes, in a dark grey military uniform with a belt. ${BODY}` },
  cronenberg: { rig: false, poly: 9000, tex: 512, prompt: `A Cronenberg monster from Rick and Morty: a mutated pink fleshy creature, a lumpy body with several mismatched eyes, a wide toothy mouth and stubby tentacle legs. ${PROP}` },
  gazorpian: { rig: true, height: 2.4, poly: 9000, tex: 512, prompt: `A male Gazorpian from Rick and Morty: a hulking orange-brown brute with a huge hunched muscular body, long heavy arms, a small head with a big mouth of teeth and tiny eyes. ${BODY}` },
  cop: { rig: true, height: 1.8, poly: 8000, tex: 512, prompt: `A Cop Rick from the Citadel of Ricks in Rick and Morty: Rick Sanchez with spiky pale blue-grey hair and a unibrow, in a navy blue police uniform with a police cap and a badge. ${BODY}` },
  // the bosses
  snowball: { rig: false, poly: 14000, tex: 1024, prompt: `Snowball from Rick and Morty: a small white fluffy dog standing upright on two legs inside a sleek white and grey mechanical exoskeleton suit, a glowing translucent helmet over its head. ${PROP}` },
  cromulon: { rig: false, poly: 12000, tex: 1024, prompt: `The Cromulon from Rick and Morty: a giant floating disembodied head, bald and pinkish beige, with big round staring eyes and huge lips, no body. ${PROP}` },
  evilmorty: { rig: true, height: 1.5, poly: 14000, tex: 1024, prompt: `Evil Morty from Rick and Morty: Morty Smith with a black eyepatch over his right eye and a cold confident look, short brown hair, a yellow T-shirt, blue jeans and white sneakers. ${BODY}` },
  // set pieces
  cruiser: { rig: false, poly: 12000, tex: 1024, prompt: `Rick's space cruiser from Rick and Morty: a small grey flying car shaped like a flattened saucer with an open cockpit, a clear bubble windscreen, two seats and a green glowing energy core at the back. ${PROP}` },
  // the classic one, as in the show's first seasons
  saucer: { rig: false, poly: 16000, tex: 1024, prompt: `Rick's space cruiser from Rick and Morty, the classic one: a small round flying saucer car with a grey metal hull, wide and flat, a big clear see-through glass bubble dome over two empty seats and a steering wheel, two orange-yellow stripes painted down the front of the hull, two round headlights on short stalks at the front rim, a big grey cylindrical exhaust can at the back with a ribbed hose, small bolts round the rim, no people. ${PROP}` },
  garage: { rig: false, poly: 10000, tex: 1024, prompt: `The Smith family's garage from Rick and Morty: a small detached suburban garage with pale grey wooden siding, a big white roll-up door, a grey shingled roof and a side door. ${PROP}` },
  // the Scranton branch
  michael: staff(1.75, 'Michael Scott', 'a middle-aged office manager with short neat dark brown hair parted to the side, clean-shaven, a pleased self-satisfied smile, in a charcoal grey suit, a light blue dress shirt, a dark red tie, black dress shoes'),
  dwight: staff(1.88, 'Dwight Schrute', 'a tall pale stern man with flat brown hair parted in the centre and combed down to the sides, thin wire-rimmed glasses, in a mustard-yellow short-sleeved dress shirt, a brown striped tie, olive-brown trousers with a belt and a pager on it, brown shoes'),
  jim: staff(1.91, 'Jim Halpert', 'a tall lanky young man with shaggy tousled brown hair and a wry half-smile, in a white dress shirt with the sleeves rolled to the elbows, a loosened navy blue tie, grey slacks, dark brown shoes'),
  pam: staff(1.63, 'Pam Beesly', 'a young woman with wavy auburn-brown hair to the shoulders, half pulled back, and a gentle smile, in a pink cardigan over a white collared blouse, a grey knee-length pencil skirt, flat brown shoes'),
  andy: staff(1.83, 'Andy Bernard', 'a preppy man with neat side-parted brown hair and a big toothy grin, in a navy blue blazer, a pink dress shirt, a red striped tie, khaki trousers, brown loafers'),
  phyllis: staff(1.6, 'Phyllis Vance', 'a heavyset motherly woman in her fifties with short wavy reddish-brown hair and a soft smile, in a purple cardigan jacket over a cream blouse, a string of pearls, dark grey slacks, flat black shoes'),
  stanley: staff(1.8, 'Stanley Hudson', 'a heavyset older Black man, bald, with a grey moustache, reading glasses low on his nose and a bored unimpressed look, in a tan-brown suit jacket, a cream shirt, a dark red tie, dark brown trousers, black shoes'),
  erin: staff(1.65, 'Erin Hannon', 'a cheerful young woman with long straight auburn-red hair and a bright smile, in a light blue cardigan over a white blouse, a dark grey knee-length skirt, flat black shoes'),
  kevin: staff(1.75, 'Kevin Malone', 'a very large heavyset man with a round face, balding with short brown hair at the sides, a sleepy grin, in a light blue dress shirt, a dark red tie, dark grey suit trousers, black shoes'),
  angela: staff(1.55, 'Angela Martin', 'a petite prim stern woman with blonde hair pulled tightly back into a bun, in a lavender cardigan over a white high-collared blouse, a small cross necklace, a long grey skirt below the knee, flat grey shoes'),
  oscar: staff(1.73, 'Oscar Martinez', 'a neat Latino man with short black hair and a calm knowing look, clean-shaven, in a light blue dress shirt, a dark grey tie, charcoal slacks, black shoes'),
  creed: staff(1.78, 'Creed Bratton', 'a wiry old man with short swept-back white-grey hair and an odd sly grin, in a dark olive-green suit jacket, a grey shirt, a dark green tie, dark grey trousers, black shoes'),
  meredith: staff(1.65, 'Meredith Palmer', 'a middle-aged woman with short tousled red-auburn hair and a tired smirk, in a blue short-sleeved blouse, dark navy slacks, flat black shoes'),
  darryl: staff(1.85, 'Darryl Philbin', 'a tall broad Black man with very short black hair and a goatee, a calm deadpan look, in a navy blue polo shirt, dark jeans, black shoes'),
  ryan: staff(1.76, 'Ryan Howard', 'a slim young man with dark tousled hair and stubble, a smug look, in a slim black suit, a white shirt, a thin black tie, black shoes'),
  toby: staff(1.78, 'Toby Flenderson', 'a meek sad-looking man with thinning sandy-brown hair parted to the side, in a grey suit jacket, a pale blue-grey shirt, a muted plum tie, grey trousers, brown shoes'),
  kelly: staff(1.6, 'Kelly Kapoor', 'a young Indian-American woman with long glossy black hair and a bright excited smile, in a hot pink knee-length dress with a thin dark belt, dark heels'),
};

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// wait for a task to finish; returns the task
async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(5000);
  }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

// run one step for several names at a time (Meshy queues only so many tasks)
async function each(names, fn, at = 4) {
  const queue = [...names];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) await fn(n).catch((e) => console.error(`! ${n}: ${e.message}`));
  };
  await Promise.all(Array.from({ length: at }, worker));
}

// A texture down to `size` pixels without its islands running together.
// Meshy packs an atlas's islands edge to edge, so a plain resize (and a
// mipmap) mixes each island's rim with its neighbour's colour: light seams
// on a dark suit. Here a texel averages only the texels the mesh uses, and
// what the mesh doesn't use is filled outward from what it does.
async function shrinkAtlas(doc, size) {
  const root = doc.getRoot();
  for (const texture of root.listTextures()) {
    const { data, info } = await sharp(texture.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const f = Math.round(W / size);
    if (info.height !== W || f < 2 || W !== f * size) continue; // (textureCompress resizes it)
    // the texels the mesh uses: any whose centre is in or just by a triangle
    const used = new Uint8Array(W * W);
    const a = [];
    const b = [];
    const c = [];
    for (const mesh of root.listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const uv = prim.getAttribute('TEXCOORD_0');
        const idx = prim.getIndices();
        if (!uv || !idx) continue;
        for (let t = 0; t < idx.getCount(); t += 3) {
          uv.getElement(idx.getScalar(t), a);
          uv.getElement(idx.getScalar(t + 1), b);
          uv.getElement(idx.getScalar(t + 2), c);
          const x = [a[0] * W - 0.5, b[0] * W - 0.5, c[0] * W - 0.5];
          const y = [a[1] * W - 0.5, b[1] * W - 0.5, c[1] * W - 0.5];
          const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
          const sign = area < 0 ? -1 : 1;
          const x0 = Math.max(0, Math.floor(Math.min(...x)) - 1);
          const x1 = Math.min(W - 1, Math.ceil(Math.max(...x)) + 1);
          const y0 = Math.max(0, Math.floor(Math.min(...y)) - 1);
          const y1 = Math.min(W - 1, Math.ceil(Math.max(...y)) + 1);
          for (let py = y0; py <= y1; py++)
            for (let px = x0; px <= x1; px++) {
              let inside = true;
              for (let e = 0; e < 3 && inside; e++) {
                const n = (e + 1) % 3;
                const ex = x[n] - x[e];
                const ey = y[n] - y[e];
                const len = Math.hypot(ex, ey);
                // how far inside this edge, in texels (a sliver counts by its box)
                if (len > 1e-6 && (sign * (ex * (py - y[e]) - ey * (px - x[e]))) / len < -0.75) inside = false;
              }
              if (inside) used[py * W + px] = 1;
            }
        }
      }
    const out = new Uint8Array(size * size * 3);
    const got = new Uint8Array(size * size);
    for (let ty = 0; ty < size; ty++)
      for (let tx = 0; tx < size; tx++) {
        let r = 0;
        let g = 0;
        let bl = 0;
        let n = 0;
        for (let sy = ty * f; sy < ty * f + f; sy++)
          for (let sx = tx * f; sx < tx * f + f; sx++) {
            if (!used[sy * W + sx]) continue;
            const i = (sy * W + sx) * 3;
            r += data[i];
            g += data[i + 1];
            bl += data[i + 2];
            n++;
          }
        if (!n) continue;
        const o = (ty * size + tx) * 3;
        out[o] = r / n;
        out[o + 1] = g / n;
        out[o + 2] = bl / n;
        got[ty * size + tx] = 1;
      }
    // the rest, a ring at a time, from the filled texels round them
    for (let left = true; left; ) {
      left = false;
      const add = [];
      for (let ty = 0; ty < size; ty++)
        for (let tx = 0; tx < size; tx++) {
          if (got[ty * size + tx]) continue;
          let r = 0;
          let g = 0;
          let bl = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size || !got[ny * size + nx]) continue;
              const i = (ny * size + nx) * 3;
              r += out[i];
              g += out[i + 1];
              bl += out[i + 2];
              n++;
            }
          if (n) add.push(ty * size + tx, r / n, g / n, bl / n);
        }
      for (let i = 0; i < add.length; i += 4) {
        out.set([add[i + 1], add[i + 2], add[i + 3]], add[i] * 3);
        got[add[i]] = 1;
        left = true;
      }
    }
    texture.setImage(await sharp(out, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
  }
}

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
// A clip keeps only its skeleton and animation. A figure the browser poses
// (`posed`) loses its clips, and its texture is shrunk island by island. (Its
// triangles are left alone: the simplifier doesn't weigh the texture, and
// pulls the faces about.)
let io = null;
async function squeeze(from, to, { tex = 0, clip = false, posed = false } = {}) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  const root = doc.getRoot();
  if (clip) {
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const m of root.listMeshes()) m.dispose();
    for (const m of root.listMaterials()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
  }
  if (posed) {
    for (const a of root.listAnimations()) {
      for (const part of [...a.listChannels(), ...a.listSamplers()]) part.dispose();
      a.dispose();
    }
    await shrinkAtlas(doc, tex);
  }
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: posed ? 'high' : 'medium' }));
  await io.write(to, doc);
}

const steps = {
  async images(names, s) {
    await each(names, async (n) => {
      const a = ASSETS[n];
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${a.style ?? STYLE}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}), ...(a.aspect ? { aspect_ratio: a.aspect } : {}) });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, a.set ?? '', `${n}.png`));
      console.log(`image    ${n.padEnd(12)} ${t.consumed_credits} credits`);
    });
  },
  async models(names, s) {
    await each(names, async (n) => {
      const a = ASSETS[n];
      if (!s[n]?.image) throw new Error('no image yet');
      if (!s[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: a.poly,
          texture_resolution: '2k',
          ...(a.rig ? { pose_mode: 'a-pose' } : {}),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, a.set ?? '', `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(12)} ${t.consumed_credits} credits`);
    });
  },
  async rig(names, s) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!s[n]?.model) throw new Error('no model yet');
        if (!s[n].rig) {
          const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
          s[n].rig = result;
          await save(s);
        }
        const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
        console.log(`rig      ${n.padEnd(12)} ${t.consumed_credits} credits`);
      },
    );
  },
  // an idle clip (Meshy's animation library, action 0), on the bare skeleton
  async anim(names, s) {
    await each(
      names.filter((n) => ASSETS[n].rig && ASSETS[n].clips !== false),
      async (n) => {
        if (!s[n]?.rig) throw new Error('not rigged yet');
        if (!s[n].idle) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: s[n].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } });
          s[n].idle = result;
          await save(s);
        }
        const t = await wait('/v1/animations', s[n].idle, `${n} idle`);
        console.log(`anim     ${n.padEnd(12)} ${t.consumed_credits} credits ${JSON.stringify(Object.keys(t.result ?? {}))}`);
      },
    );
  },
  // sitting in the cruiser: Chair_Sit_Idle_M from Meshy's animation library
  async sit(names, s) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!s[n]?.rig) throw new Error('not rigged yet');
        if (!s[n].sit) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: s[n].rig, action_id: 33, post_process: { operation_type: 'extract_armature' } });
          s[n].sit = result;
          await save(s);
        }
        const t = await wait('/v1/animations', s[n].sit, `${n} sit`);
        console.log(`sit      ${n.padEnd(12)} ${t.consumed_credits} credits`);
      },
    );
  },
  async fetch(names, s) {
    await mkdir(OUT, { recursive: true });
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    await mkdir(tmp, { recursive: true });
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    for (const n of names) {
      const a = ASSETS[n];
      const files = []; // [url, file, texture size, clip only, posed in the browser]
      const out = a.set === 'office' ? OFFICE_OUT : OUT;
      if (a.rig && a.clips === false) {
        // the skinned figure on its skeleton, nothing else
        if (!s[n]?.rig) throw new Error(`${n}: rig first`);
        const r = (await api('GET', `/v1/rigging/${s[n].rig}`)).result;
        files.push([r.rigged_character_glb_url, `${n}.glb`, a.tex, false, true]);
      } else if (a.rig) {
        if (!s[n]?.rig || !s[n]?.idle) throw new Error(`${n}: rig and anim first`);
        const r = (await api('GET', `/v1/rigging/${s[n].rig}`)).result;
        const idle = (await api('GET', `/v1/animations/${s[n].idle}`)).result;
        files.push([r.rigged_character_glb_url, `${n}.glb`, a.tex, false]);
        // the clips on their own: the game plays them on the character
        files.push([r.basic_animations.walking_armature_glb_url, `${n}-walk.glb`, 0, true]);
        files.push([r.basic_animations.running_armature_glb_url, `${n}-run.glb`, 0, true]);
        files.push([idle.animation_glb_url, `${n}-idle.glb`, 0, true]);
        if (s[n].sit) files.push([(await api('GET', `/v1/animations/${s[n].sit}`)).result.animation_glb_url, `${n}-sit.glb`, 0, true]);
      } else {
        if (!s[n]?.model) throw new Error(`${n}: no model yet`);
        const t = await api('GET', `/v1/image-to-3d/${s[n].model}`);
        files.push([t.model_urls.glb, `${n}.glb`, a.tex, false]);
      }
      for (const [url, file, tex, clip, posed] of files) {
        const raw = join(tmp, `${s[n].rig ?? s[n].model}-${file}`);
        if (!existsSync(raw)) await download(url, raw);
        await mkdir(out, { recursive: true });
        await squeeze(raw, join(out, file), { tex, clip, posed });
      }
      credits[`meshy/${n}`] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(12)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
