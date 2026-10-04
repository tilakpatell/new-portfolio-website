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
// idle clip, 3), fetch (free: download and compress). Each task's id is kept in
// scripts/meshy-tasks.json, so running a step again never pays twice; delete
// a name's entry there to make it again. MESHY_API_KEY comes from .env.local
// (git ignores it); it is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as watlas from 'watlas';
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

// ── A figure on a new atlas ────────────────────────────────────────────────
// Meshy cuts a figure's surface into a thousand islands of a few triangles
// each, packed edge to edge, and splits the vertices along every cut, their
// normals with them: twice the vertices the surface needs, a facet at every
// island, and no room for a mipmap (a mip level mixes each island's rim with
// its neighbour's colour: light seams on a dark suit). `reatlas` welds the
// vertices, cuts the surface again into a few large charts with a gutter
// round each, and paints the texture again in the new layout.

// How far a part of a chart may be scaled, laid flat, from the chart as a
// whole (all but the 3% of it most shrunk and the 3% most stretched).
const STRETCH = [0.75, 1.4];
// The head's texels to the body's, a metre: the faces are what is looked at
// (Meshy's own atlas gives a head about as many).
const HEAD = 1.6;

// The triangle across each edge of each triangle (`face`: their corners,
// three each), or -1 where the surface ends or more than two meet.
function neighbours(face, points) {
  const across = new Int32Array(face.length).fill(-1);
  const edges = new Map();
  for (let h = 0; h < face.length; h++) {
    const a = face[h];
    const b = face[h - (h % 3) + ((h + 1) % 3)];
    const k = a < b ? a * points + b : b * points + a;
    if (edges.has(k)) edges.get(k).push(h);
    else edges.set(k, [h]);
  }
  for (const [g, h, more] of edges.values()) {
    // (a pair run opposite ways along their edge)
    if (h === undefined || more !== undefined || face[g] === face[h]) continue;
    across[g] = Math.floor(h / 3);
    across[h] = Math.floor(g / 3);
  }
  return across;
}

// Lays charts of a surface flat (P: its points; face: its triangles; across:
// their neighbours). A chart is a list of triangles; the answer is { points,
// u, v }: the points it uses and where each lies, in the surface's own units;
// or null if, flat, the chart folds over, crosses itself or is stretched. The
// map is least-squares conformal (Lévy et al., 2002): every triangle keeps
// its shape as nearly as all can at once, with two far points pinned, solved
// by conjugate gradients.
function flattener(P, face, across) {
  const inside = new Int32Array(face.length / 3); // the chart each triangle was last in
  let chart = 0;
  return (list) => {
    const m = list.length;
    const own = new Map();
    const points = [];
    const tri = new Int32Array(m * 3);
    for (let i = 0; i < m * 3; i++) {
      const p = face[list[Math.floor(i / 3)] * 3 + (i % 3)];
      if (!own.has(p)) own.set(p, points.push(p) - 1);
      tri[i] = own.get(p);
    }
    const n = points.length;
    // each triangle in its own plane: a corner at the origin, the next along x
    const shape = new Float64Array(m * 3); // (how far along, then the third corner's x and y)
    const size = new Float64Array(m);
    let area = 0;
    for (let i = 0; i < m; i++) {
      const [a, b, c] = [points[tri[i * 3]] * 3, points[tri[i * 3 + 1]] * 3, points[tri[i * 3 + 2]] * 3];
      const e = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
      const f = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const l = Math.hypot(...e);
      const x = l > 1e-12 ? (e[0] * f[0] + e[1] * f[1] + e[2] * f[2]) / l : 0;
      const y = Math.sqrt(Math.max(0, f[0] * f[0] + f[1] * f[1] + f[2] * f[2] - x * x));
      shape.set([l, x, y], i * 3);
      size[i] = (l * y) / 2;
      area += size[i];
    }
    const at = new Float64Array(n * 2); // where each point lies: the u's, then the v's
    if (m === 1) {
      at.set([shape[0], shape[1]], 1);
      at[5] = shape[2];
      return { points, u: at.subarray(0, 3), v: at.subarray(3) };
    }
    // Of each triangle the map wants this sum to be nothing: its corners'
    // places (as complex numbers), each times the side facing it. `wr`, `wi`:
    // those sides, over the root of the triangle's area (a sliver counts as
    // a twentieth of the average, not less).
    const least = (area / m) * 0.05;
    const wr = new Float64Array(m * 3);
    const wi = new Float64Array(m * 3);
    for (let i = 0; i < m; i++) {
      const [l, x, y] = shape.subarray(i * 3, i * 3 + 3);
      const s = size[i] > 1e-14 ? 1 / Math.sqrt(Math.max(size[i], least)) : 0;
      wr.set([(x - l) * s, -x * s, l * s], i * 3);
      wi.set([y * s, -y * s, 0], i * 3);
    }
    // two points pinned, as far apart as any
    const far = (from) => {
      let best = 0;
      let reach = -1;
      for (let p = 0; p < n; p++) {
        const d = Math.hypot(P[points[p] * 3] - P[points[from] * 3], P[points[p] * 3 + 1] - P[points[from] * 3 + 1], P[points[p] * 3 + 2] - P[points[from] * 3 + 2]);
        if (d > reach) [best, reach] = [p, d];
      }
      return [best, reach];
    };
    const [pin] = far(0);
    const [other, reach] = far(pin);
    at[other] = reach;
    // (the sums' squares are least where `times` gives nothing for the free points)
    const times = (x, y) => {
      y.fill(0);
      for (let i = 0; i < m * 3; i += 3) {
        let re = 0;
        let im = 0;
        for (let k = i; k < i + 3; k++) {
          re += wr[k] * x[tri[k]] - wi[k] * x[tri[k] + n];
          im += wr[k] * x[tri[k] + n] + wi[k] * x[tri[k]];
        }
        for (let k = i; k < i + 3; k++) {
          y[tri[k]] += wr[k] * re + wi[k] * im;
          y[tri[k] + n] += wr[k] * im - wi[k] * re;
        }
      }
      for (const p of [pin, other]) y[p] = y[p + n] = 0;
    };
    const weight = new Float64Array(n * 2); // (each point's own share of it, to scale the steps by)
    for (let k = 0; k < m * 3; k++) weight[tri[k]] += wr[k] * wr[k] + wi[k] * wi[k];
    for (let p = 0; p < n; p++) weight[p + n] = weight[p] ||= 1;
    const left = new Float64Array(n * 2);
    const way = new Float64Array(n * 2);
    const turn = new Float64Array(n * 2);
    times(at, left);
    let first = 0;
    let drop = 0;
    for (let p = 0; p < n * 2; p++) {
      left[p] = -left[p];
      way[p] = left[p] / weight[p];
      first += left[p] * left[p];
      drop += left[p] * way[p];
    }
    for (let step = 0; step < n * 4 + 200 && first > 0; step++) {
      times(way, turn);
      let slope = 0;
      for (let p = 0; p < n * 2; p++) slope += way[p] * turn[p];
      if (!(slope > 0)) break;
      let now = 0;
      let next = 0;
      for (let p = 0; p < n * 2; p++) {
        at[p] += (drop / slope) * way[p];
        left[p] -= (drop / slope) * turn[p];
        now += left[p] * left[p];
        next += (left[p] * left[p]) / weight[p];
      }
      if (now < first * 1e-10) break;
      for (let p = 0; p < n * 2; p++) way[p] = left[p] / weight[p] + (next / drop) * way[p];
      drop = next;
    }
    // flat, is every triangle the right way up?
    const side = (a, b, c) => (at[b] - at[a]) * (at[c + n] - at[a + n]) - (at[c] - at[a]) * (at[b + n] - at[a + n]);
    const flat = Float64Array.from(size, (_, i) => side(tri[i * 3], tri[i * 3 + 1], tri[i * 3 + 2]) / 2);
    const total = flat.reduce((sum, a) => sum + a, 0);
    if (!(total > 0) || flat.some((a, i) => a <= 0 && size[i] > least * 0.02)) return null;
    // at the surface's own size, is any part of it much smaller or larger than it is?
    for (let p = 0; p < n * 2; p++) at[p] *= Math.sqrt(area / total);
    const scales = [];
    for (let i = 0; i < m; i++) if (size[i] > 1e-14) scales.push([Math.sqrt((Math.max(0, flat[i]) * area) / total / size[i]), size[i]]);
    scales.sort((a, b) => a[0] - b[0]);
    const scale = (part) => {
      let sum = 0;
      return (scales.find(([, a]) => (sum += a) >= area * part) ?? scales.at(-1))[0];
    };
    if (scale(0.03) < STRETCH[0] || scale(0.97) > STRETCH[1]) return null;
    // does its rim cross itself?
    chart++;
    for (const f of list) inside[f] = chart;
    const rim = [];
    for (let i = 0; i < m * 3; i++) {
      const o = across[list[Math.floor(i / 3)] * 3 + (i % 3)];
      if (o < 0 || inside[o] !== chart) rim.push(tri[i], tri[i - (i % 3) + ((i + 1) % 3)]);
    }
    for (let i = 0; i < rim.length; i += 2)
      for (let j = i + 2; j < rim.length; j += 2) {
        const [a, b, c, d] = [rim[i], rim[i + 1], rim[j], rim[j + 1]];
        if (a === c || a === d || b === c || b === d) continue;
        if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return null;
      }
    return { points, u: at.subarray(0, n), v: at.subarray(n) };
  };
}

// A surface in charts, each laid flat (P: its points; N: their normals; face:
// its triangles). Gives { ref, uv, index }: the vertices (the point each is,
// and its place in its chart, in the surface's own units, the charts well
// apart) and every triangle's three. xatlas cuts the charts; but it ends one
// wherever the surface turns far from the chart's facing (an arm takes three
// or four), which makes hundreds on a figure, so they are then joined two at
// a time, the two with the longest border first, wherever the pair lies flat
// as one.
function chartsOf(P, N, face) {
  const across = neighbours(face, P.length / 3);
  const flatten = flattener(P, face, across);
  const atlas = new watlas.Atlas();
  atlas.addMesh({ vertexCount: P.length / 3, vertexPositionData: P, vertexPositionStride: 12, vertexNormalData: N, vertexNormalStride: 12, indexData: face, indexCount: face.length });
  atlas.generate({}, {});
  const mesh = atlas.getMesh(0);
  const of = new Int32Array(face.length / 3).fill(-1); // each triangle's chart
  const charts = new Map(); // each chart's triangles
  let next = 0;
  for (; next < mesh.chartCount; next++) {
    const list = new Uint32Array(mesh.getChart(next).faceCount);
    mesh.getChart(next).getFaceArray(list);
    for (const f of list) of[f] = next;
    charts.set(next, [...list]);
  }
  // (a triangle xatlas left out is a chart of its own)
  for (let f = 0; f < of.length; f++) if (of[f] < 0) charts.set((of[f] = next++), [f]);
  // xatlas's own layout, for a chart that won't lie flat here
  const theirs = new Uint32Array(face.length);
  mesh.getIndexArray(theirs);
  const laid = Array.from({ length: mesh.vertexCount }, (_, j) => mesh.getVertex(j).uv.map((x) => x / atlas.texelsPerUnit));
  atlas.delete();

  // two that won't join aren't tried again, nor is what either grows into
  const apart = new Map(); // a chart -> those it won't join
  const part = (a, b) => {
    for (const [x, y] of [[a, b], [b, a]]) apart.set(x, (apart.get(x) ?? new Set()).add(y));
  };
  for (;;) {
    const border = new Map(); // how many edges each two charts share
    for (let h = 0; h < face.length; h++) {
      const [a, b] = [of[Math.floor(h / 3)], across[h] < 0 ? -1 : of[across[h]]];
      if (b > a) border.set(a * next + b, (border.get(a * next + b) ?? 0) + 1);
    }
    let pick = -1;
    let most = 0;
    for (const [k, edges] of border) if (edges > most && !apart.get(Math.floor(k / next))?.has(k % next)) [pick, most] = [k, edges];
    if (pick < 0) break;
    const [a, b] = [Math.floor(pick / next), pick % next];
    const list = charts.get(a).concat(charts.get(b));
    if (!flatten(list)) {
      part(a, b);
      continue;
    }
    for (const f of list) of[f] = next;
    for (const was of [a, b]) {
      for (const other of apart.get(was) ?? []) part(next, other);
      charts.delete(was);
    }
    charts.set(next++, list);
  }

  const ref = [];
  const uv = [];
  const index = new Uint32Array(face.length);
  let k = 0;
  for (const list of charts.values()) {
    const flat = flatten(list);
    const own = new Map(); // a point -> its vertex in this chart
    const [x, y] = [(k % 16) * 8, Math.floor(k++ / 16) * 8]; // (a chart is a metre or two across)
    flat?.points.forEach((p, i) => {
      own.set(p, ref.push(p) - 1);
      uv.push(flat.u[i] + x, flat.v[i] + y);
    });
    for (const f of list)
      for (let h = f * 3; h < f * 3 + 3; h++) {
        if (!own.has(face[h])) {
          own.set(face[h], ref.push(face[h]) - 1);
          uv.push(laid[theirs[h]][0] + x, laid[theirs[h]][1] + y);
        }
        index[h] = own.get(face[h]);
      }
  }
  return { ref: Uint32Array.from(ref), uv: Float32Array.from(uv), index };
}

// A figure (one mesh, one texture, as Meshy makes them: unquantized) onto a
// new atlas of `size` pixels.
async function reatlas(doc, size) {
  const [prim, more] = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const texture = prim?.getMaterial()?.getBaseColorTexture();
  if (!texture || more) throw new Error('reatlas: a figure is one mesh with one texture');
  const { data: paint, info } = await sharp(texture.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [W, H] = [info.width, info.height];
  const at = prim.getAttribute('POSITION').getArray();
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const corner = prim.getIndices().getArray();

  // ── weld: one point wherever several vertices are at one place ──
  const places = new Map();
  const point = new Uint32Array(at.length / 3); // each vertex's point
  const first = []; // each point's first vertex
  for (let i = 0; i < point.length; i++) {
    const k = `${at[i * 3]},${at[i * 3 + 1]},${at[i * 3 + 2]}`;
    if (!places.has(k)) places.set(k, first.push(i) - 1);
    point[i] = places.get(k);
  }
  const P = Float32Array.from({ length: first.length * 3 }, (_, i) => at[first[Math.floor(i / 3)] * 3 + (i % 3)]);
  // the triangles, less any with two corners at one place: `was`, their
  // vertices as Meshy has them (for its texture); `face`, their points
  const was = corner.filter((_, h) => new Set([0, 1, 2].map((c) => point[corner[h - (h % 3) + c]])).size === 3);
  const face = Uint32Array.from(was, (i) => point[i]);
  // smooth normals: each triangle's facing, weighed by its area and its angle at the point
  const N = new Float32Array(P.length);
  for (let t = 0; t < face.length; t += 3) {
    const side = [0, 1, 2].map((c) => [0, 1, 2].map((k) => P[face[t + ((c + 1) % 3)] * 3 + k] - P[face[t + c] * 3 + k]));
    const [a, b] = side;
    const facing = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // (twice its area long)
    for (let c = 0; c < 3; c++) {
      const [e, f] = [side[c], side[(c + 2) % 3]];
      const cos = -(e[0] * f[0] + e[1] * f[1] + e[2] * f[2]) / (Math.hypot(...e) * Math.hypot(...f) || 1);
      const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
      for (let k = 0; k < 3; k++) N[face[t + c] * 3 + k] += facing[k] * angle;
    }
  }
  for (let p = 0; p < N.length; p += 3) {
    const l = Math.hypot(N[p], N[p + 1], N[p + 2]) || 1;
    for (let k = 0; k < 3; k++) N[p + k] /= l;
  }

  // ── Meshy's islands, and the island each texel of its texture is in ──
  const isle = Int32Array.from(point.keys());
  const top = (i) => {
    while (isle[i] !== i) i = isle[i] = isle[isle[i]];
    return i;
  };
  for (let t = 0; t < corner.length; t += 3) for (const c of [1, 2]) isle[top(corner[t + c])] = top(corner[t]);
  const owner = new Int32Array(W * H).fill(-1);
  for (let t = 0; t < corner.length; t += 3) {
    const x = [0, 1, 2].map((c) => uv[corner[t + c] * 2] * W - 0.5);
    const y = [0, 1, 2].map((c) => uv[corner[t + c] * 2 + 1] * H - 0.5);
    const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
    if (!area) continue;
    for (let py = Math.max(0, Math.ceil(Math.min(...y))); py <= Math.min(H - 1, Math.max(...y)); py++)
      for (let px = Math.max(0, Math.ceil(Math.min(...x))); px <= Math.min(W - 1, Math.max(...x)); px++)
        if ([0, 1, 2].every((c) => ((x[(c + 1) % 3] - x[c]) * (py - y[c]) - (y[(c + 1) % 3] - y[c]) * (px - x[c])) * area >= 0)) owner[py * W + px] = top(corner[t]);
  }
  // Meshy's texture at (u, v), from the texels of one island (and of none:
  // the fill between islands), so a neighbour's colour never comes with it
  const rgb = [0, 0, 0];
  const colour = (u, v, island) => {
    const x = Math.min(W - 1, Math.max(0, u * W - 0.5));
    const y = Math.min(H - 1, Math.max(0, v * H - 0.5));
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    let sum = 0;
    rgb.fill(0);
    for (let k = 0; k < 4; k++) {
      const i = Math.min(H - 1, y0 + (k >> 1)) * W + Math.min(W - 1, x0 + (k & 1));
      if (owner[i] !== island && owner[i] !== -1) continue;
      const w = (k & 1 ? x - x0 : 1 - x + x0) * (k >> 1 ? y - y0 : 1 - y + y0);
      for (let c = 0; c < 3; c++) rgb[c] += paint[i * 3 + c] * w;
      sum += w;
    }
    // (a sliver no texel's centre is in: the nearest texel, whoever's)
    if (sum < 1e-4) for (let c = 0; c < 3; c++) rgb[c] = paint[(Math.round(y) * W + Math.round(x)) * 3 + c];
    else for (let c = 0; c < 3; c++) rgb[c] /= sum;
    return rgb;
  };

  // ── new charts, packed as large as all fit, a gutter between them ──
  // (laid out with the head drawn larger: a chart's texels go by its size)
  const heads = new Set(doc.getRoot().listSkins()[0]?.listJoints().flatMap((j, i) => (/^head/i.test(j.getName()) ? [i] : [])));
  const joints = prim.getAttribute('JOINTS_0')?.getArray();
  const weights = prim.getAttribute('WEIGHTS_0')?.getArray();
  const head = first.map((v) => [0, 1, 2, 3].reduce((sum, k) => sum + (heads.has(joints?.[v * 4 + k]) ? weights[v * 4 + k] : 0), 0)); // how much of each point is head
  const middle = [0, 1, 2].map((k) => head.reduce((sum, w, p) => sum + w * P[p * 3 + k], 0) / (head.reduce((sum, w) => sum + w, 0) || 1));
  const drawn = P.map((x, i) => middle[i % 3] + (x - middle[i % 3]) * (1 + (HEAD - 1) * head[Math.floor(i / 3)]));
  const { ref, uv: flat, index } = chartsOf(drawn, N, face);
  let surface = 0;
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 2, index[t + 1] * 2, index[t + 2] * 2];
    surface += Math.abs((flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) - (flat[c] - flat[a]) * (flat[b + 1] - flat[a + 1])) / 2;
  }
  const atlas = new watlas.Atlas();
  atlas.addUvMesh({ vertexUvData: flat, vertexCount: ref.length, vertexStride: 8, indexData: index, indexCount: index.length });
  atlas.computeCharts({});
  const gutter = size >> 7; // (8 texels in 1024: a chart's colours keep to themselves two mip levels down, and mix little below)
  const pack = (texelsPerUnit) => {
    atlas.packCharts({ texelsPerUnit, resolution: size, padding: gutter, bilinear: true, blockAlign: false, bruteForce: false, rotateCharts: true, rotateChartsToAxis: true });
    return atlas.atlasCount === 1;
  };
  let fits = 0;
  let over = size / Math.sqrt(surface); // (were there no space between them)
  for (let i = 0; i < 10; i++) {
    const scale = (fits + over) / 2;
    if (pack(scale)) fits = scale;
    else over = scale;
  }
  const packed = pack(fits) && atlas.getMesh(0);
  if (!packed || packed.vertexCount !== ref.length) throw new Error('reatlas: the charts would not pack');
  const st = new Float32Array(ref.length * 2);
  for (let j = 0; j < ref.length; j++) {
    const vertex = packed.getVertex(j);
    // (a chart with no area is given no place: any will do)
    st.set(vertex.atlasIndex < 0 ? [0.5 / size, 0.5 / size] : [vertex.uv[0] / atlas.width, vertex.uv[1] / atlas.height], j * 2);
  }
  atlas.delete();

  // ── the texture painted again: each triangle in its new place, from its old ──
  const out = new Float32Array(size * size * 3);
  const got = new Float32Array(size * size);
  const fine = 4; // samples across a texel
  for (let t = 0; t < index.length; t += 3) {
    const x = [0, 1, 2].map((c) => st[index[t + c] * 2] * size);
    const y = [0, 1, 2].map((c) => st[index[t + c] * 2 + 1] * size);
    const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
    if (Math.abs(area) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...y))); py <= Math.min(size - 1, Math.max(...y)); py++)
      for (let px = Math.max(0, Math.floor(Math.min(...x))); px <= Math.min(size - 1, Math.max(...x)); px++)
        for (let s = 0; s < fine * fine; s++) {
          const sx = px + ((s % fine) + 0.5) / fine;
          const sy = py + (Math.floor(s / fine) + 0.5) / fine;
          // how much of each corner there is at this sample
          const a = ((x[1] - sx) * (y[2] - sy) - (x[2] - sx) * (y[1] - sy)) / area;
          const b = ((x[2] - sx) * (y[0] - sy) - (x[0] - sx) * (y[2] - sy)) / area;
          const c = 1 - a - b;
          if (a < 0 || b < 0 || c < 0) continue;
          const [i, j, k] = [was[t] * 2, was[t + 1] * 2, was[t + 2] * 2];
          const from = colour(a * uv[i] + b * uv[j] + c * uv[k], a * uv[i + 1] + b * uv[j + 1] + c * uv[k + 1], top(was[t]));
          const o = py * size + px;
          for (let ch = 0; ch < 3; ch++) out[o * 3 + ch] += from[ch];
          got[o]++;
        }
  }
  for (let o = 0; o < got.length; o++) {
    if (!got[o]) continue;
    for (let ch = 0; ch < 3; ch++) out[o * 3 + ch] /= got[o];
    got[o] = 1;
  }
  // the gutters, a ring at a time, from the painted texels round them
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
  texture.setImage(await sharp(Uint8Array.from(out, Math.round), { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
  prim.getMaterial().getBaseColorTextureInfo().setWrapS(33071).setWrapT(33071); // (an atlas: clamped to its edge)

  // ── the mesh on its new vertices ──
  const pick = (from, width, of) => from.constructor.from({ length: ref.length * width }, (_, i) => from[of[Math.floor(i / width)] * width + (i % width)]);
  const vertex = ref.map((p) => first[p]); // (one of Meshy's, for each)
  for (const semantic of prim.listSemantics()) {
    const old = prim.getAttribute(semantic);
    // (the tangents went with the old layout, and nothing here reads them)
    const array = semantic === 'TANGENT' ? null : semantic === 'POSITION' ? pick(P, 3, ref) : semantic === 'NORMAL' ? pick(N, 3, ref) : semantic === 'TEXCOORD_0' ? st : pick(old.getArray(), old.getElementSize(), vertex);
    prim.setAttribute(semantic, array && old.clone().setArray(array));
    old.dispose();
  }
  prim.getIndices().setArray(ref.length > 65535 ? index : Uint16Array.from(index));
}

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
// A clip keeps only its skeleton and animation. A figure the browser poses
// (`posed`) loses its clips, and goes onto a new atlas of `tex` pixels. (Its
// triangles are left alone: the simplifier doesn't weigh the texture, and
// pulls the faces about.)
let io = null;
async function squeeze(from, to, { tex = 0, clip = false, posed = false } = {}) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    await watlas.Initialize();
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
    await reatlas(doc, tex);
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
