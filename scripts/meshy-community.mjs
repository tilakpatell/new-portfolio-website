// Looks through Meshy's community (meshy.ai/search) for the Rick and Morty
// multiverse's figures, props and vehicles before anyone pays to make them
// (docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md). The
// search is the public one Meshy's own search page calls, so it needs no key;
// every hit carries its licence (the community's are CC0), triangle count and
// a rendered thumbnail.
//
// Downloading a model needs a signed-in browser (the page's Download button),
// so that part is by hand or through Claude in Chrome: the file goes in
// lab/meshy/community/<name>/, and `import` brings it into the site.
//
//   node scripts/meshy-community.mjs search [name … | phase1 … | mine]
//   node scripts/meshy-community.mjs import <name> <file.glb> [--tex 2048] [--poly 30000]
//
// search writes lab/meshy/community/<name>/candidates.json (every hit: page,
// author, licence, triangles, rigged or not) and sheet.jpg (the thumbnails,
// numbered as in the json), for judging against the spec's model standard.
// import squeezes a download as scripts/meshy.mjs does its own (WebP
// textures, meshopt, simplified to --poly if it has more) into the plan's
// place (/models/c137/rm/<name>.glb for a prop or vehicle; a figure still
// needs Meshy's rig, see the plan), and credits it in public/games/credits.json.

// (glTF-Transform is loaded only by `import`: its functions bring
// ndarray-pixels, which loads its own copy of sharp, and two libvips in one
// process break the contact sheets)
import sharp from 'sharp';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'lab', 'meshy', 'community');
const RM_OUT = join(ROOT, 'public', 'models', 'c137', 'rm');
const SEARCH = 'https://www.meshy.ai/meshyd-api/web/public/showcases';

// What the plan wants, by its asset names, with the words to search for: the
// show's names first, then plainer ones a community model might go by.
// `mine`: the local session's slice (Phase 2's people, Phase 6's vehicles);
// the cloud session takes Phase 1. `rig`: a figure, which has to be rigged
// before the cast can play it.
export const WANTED = {
  // everything that names the show, for whatever the words below miss (and
  // for the figures already on the site: Rick, Morty, the cruiser)
  show: { phase: 0, cap: 72, q: ['rick and morty', 'rick sanchez', 'morty smith', 'pickle rick', 'meeseeks', 'portal gun', 'plumbus', 'rick morty'] },
  // Phase 1: the door and four places
  birdperson: { phase: 1, rig: true, q: ['birdperson', 'bird person', 'bird man humanoid'] },
  phoenixperson: { phase: 1, rig: true, q: ['phoenixperson', 'phoenix person', 'cyborg bird man'] },
  squanchy: { phase: 1, rig: true, q: ['squanchy', 'cat person rick and morty'] },
  poopybutthole: { phase: 1, rig: true, q: ['poopybutthole', 'mr poopybutthole', 'poopy butthole'] },
  unity: { phase: 1, rig: true, q: ['unity rick and morty'] },
  marsha: { phase: 1, rig: true, q: ['gazorpian', 'gazorpazorp', 'ma-sha'] },
  mortyjr: { phase: 1, rig: true, q: ['morty jr', 'gazorpian'] },
  krombopulos: { phase: 1, rig: true, q: ['krombopulos', 'gromflomite', 'insect assassin rick and morty'] },
  zigerion: { phase: 1, rig: true, q: ['zigerion'] },
  gearperson: { phase: 1, rig: true, q: ['gear person', 'gearhead rick and morty', 'gear world'] },
  gwendolyn: { phase: 1, q: ['gwendolyn', 'gazorpian robot'] },
  'squanchy-house': { phase: 1, q: ['squanch', 'cat tree house'] },
  'birdperson-house': { phase: 1, q: ['bird world', 'bird nest house'] },
  // Phase 2: the house, the rest of the family, Total Rickall
  spacebeth: { phase: 2, mine: true, rig: true, q: ['space beth', 'beth smith', 'beth rick and morty'] },
  rickprime: { phase: 2, mine: true, rig: true, q: ['rick prime', 'evil rick', 'rick sanchez'] },
  snuffles: { phase: 2, mine: true, q: ['snuffles', 'snowball rick and morty', 'white fluffy dog cartoon'] },
  drwong: { phase: 2, mine: true, rig: true, q: ['dr wong', 'therapist rick and morty'] },
  nancy: { phase: 2, mine: true, rig: true, q: ['nancy rick and morty'] },
  tricia: { phase: 2, mine: true, rig: true, q: ['tricia lange', 'tricia rick and morty'] },
  diane: { phase: 2, mine: true, rig: true, q: ['diane sanchez', 'diane rick and morty'] },
  pencilvester: { phase: 2, mine: true, rig: true, q: ['pencilvester', 'pencil character', 'living pencil'] },
  sleepygary: { phase: 2, mine: true, rig: true, q: ['sleepy gary', 'man in nightcap'] },
  hamurai: { phase: 2, mine: true, rig: true, q: ['hamurai', 'meat samurai', 'ham samurai'] },
  amishcyborg: { phase: 2, mine: true, rig: true, q: ['amish cyborg', 'amish robot'] },
  mrbeauregard: { phase: 2, mine: true, rig: true, q: ['beauregard', 'cartoon butler'] },
  cousinnicky: { phase: 2, mine: true, rig: true, q: ['cousin nicky'] },
  frankenstein: { phase: 2, mine: true, rig: true, q: ['frankenstein rick and morty', 'frankenstein monster cartoon', 'frankenstein'] },
  reversegiraffe: { phase: 2, mine: true, q: ['reverse giraffe', 'short neck giraffe', 'cartoon giraffe'] },
  ghostinajar: { phase: 2, mine: true, q: ['ghost in a jar', 'ghost jar'] },
  photographyraptor: { phase: 2, mine: true, q: ['photography raptor', 'raptor camera', 'velociraptor cartoon'] },
  tinkles: { phase: 2, mine: true, q: ['tinkles', 'unicorn lamb', 'unicorn sheep'] },
  babywizard: { phase: 2, mine: true, q: ['baby wizard'] },
  mrsrefrigerator: { phase: 2, mine: true, q: ['mrs refrigerator', 'refrigerator character', 'cartoon fridge'] },
  // Phase 6: the vehicles
  'spacebeth-ship': { phase: 6, mine: true, q: ['space beth ship', 'rick and morty ship', 'battered starfighter'] },
  'jerry-ship': { phase: 6, mine: true, q: ['jerry car', 'flying car rockets', 'car with rocket thrusters'] },
  'gotron-ferret': { phase: 6, mine: true, q: ['gotron', 'ferret robot', 'ferret mecha'] },
  gotron: { phase: 6, mine: true, q: ['gotron', 'voltron', 'combining super robot'] },
  'zigerion-ship': { phase: 6, mine: true, q: ['zigerion ship', 'purple mothership', 'purple alien spaceship'] },
  storytrain: { phase: 6, mine: true, q: ['story train', 'cartoon steam locomotive', 'steam train carriages'] },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function search(q) {
  const url = `${SEARCH}?${new URLSearchParams({ sortBy: '-public_popularity', pageSize: '40', pageNum: '1', search: q, phaseFilter: 'textured_only' })}`;
  // (the search gives the odd 500 when asked quickly: three tries, slower each time)
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'tilakverse/1.0 (model search)' } });
    if (r.ok) return (await r.json()).result ?? [];
    if (i === 2) throw new Error(`search "${q}": ${r.status}`);
    await sleep(2000 * (i + 1));
  }
}

// Meshy's search matches any one word ("bird person" brings every person),
// so a hit is kept only if its prompt or tags have every word of the query
const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'with']);
const about = (h, q) => {
  const text = new Set(words(`${h.objectPrompt ?? ''} ${(h.tags ?? []).join(' ')} ${h.title ?? ''}`));
  return words(q).filter((w) => !STOP.has(w)).every((w) => text.has(w) || text.has(`${w}s`));
};
const onShow = (c) => Number(/rick|morty/i.test(`${c.prompt} ${c.tags.join(' ')}`));

// what's worth keeping of a hit; the page opens with any slug before the id
const hit = (h, q) => ({
  id: h.id,
  task: h.resultId,
  page: `https://www.meshy.ai/3d-models/${slug(h.objectPrompt || 'model')}-${h.resultId}`,
  prompt: (h.objectPrompt ?? '').trim().slice(0, 300),
  author: h.author,
  license: h.license,
  triangles: h.triangleCount,
  rigged: Boolean(h.animationId),
  categories: h.categories ?? [],
  tags: h.tags ?? [],
  thumb: h.thumbnailUrl,
  downloads: h.downloads,
  views: h.views,
  made: new Date(h.createdAt).toISOString().slice(0, 10),
  query: q,
});

const raster = (svg) => sharp(Buffer.from(svg)).flatten({ background: '#000000' }).jpeg({ quality: 90 }).toBuffer();

// the thumbnails in a grid, each numbered as its place in candidates.json
async function sheet(name, hits, file) {
  const W = 240, H = 300, COLS = 6;
  const rows = Math.max(1, Math.ceil(hits.length / COLS));
  const tiles = [];
  for (const [i, h] of hits.entries()) {
    let img;
    try {
      const r = await fetch(h.thumb);
      // (some covers are PNGs with alpha: every tile goes in flat)
      img = await sharp(Buffer.from(await r.arrayBuffer())).resize(W, H - 40, { fit: 'contain', background: '#202020' }).flatten({ background: '#202020' }).jpeg().toBuffer();
    } catch {
      img = await sharp({ create: { width: W, height: H - 40, channels: 3, background: { r: 68, g: 0, b: 0 } } }).jpeg().toBuffer();
    }
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    // (rendered here: libvips trips over many SVGs in one composite)
    const label = await raster(`<svg width="${W}" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="6" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#c6ff4a">${i} · ${Math.round(h.triangles / 1000)}k${h.rigged ? ' · rigged' : ''} · ${esc(h.license ?? '?')}</text><text x="6" y="33" font-family="Arial" font-size="11" fill="#ddd">${esc(h.prompt.slice(0, 38))}</text></svg>`);
    const x = (i % COLS) * W, y = Math.floor(i / COLS) * H;
    tiles.push({ input: img, left: x, top: y }, { input: label, left: x, top: y + H - 40 });
  }
  const title = await raster(`<svg width="${COLS * W}" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000"/><text x="10" y="25" font-family="Arial" font-size="20" font-weight="bold" fill="#fff">${name}: ${hits.length} candidates</text></svg>`);
  await sharp({ create: { width: COLS * W, height: rows * H + 36, channels: 3, background: '#000' } })
    .composite([{ input: title, left: 0, top: 0 }, ...tiles.map((t) => ({ ...t, top: t.top + 36 }))])
    .jpeg({ quality: 82 })
    .toFile(file);
}

const steps = {
  async search(names) {
    const seen = new Map(); // query → hits, so a word two assets share is asked once
    for (const name of names) {
      const hits = new Map();
      for (const q of WANTED[name].q) {
        if (!seen.has(q)) {
          seen.set(q, await search(q));
          await sleep(400);
        }
        for (const h of seen.get(q)) if (!hits.has(h.id) && !h.isNSFW && about(h, q)) hits.set(h.id, hit(h, q));
      }
      // the ones that name the show first, then in the order Meshy ranked them
      const list = [...hits.values()].sort((x, y) => onShow(y) - onShow(x)).slice(0, WANTED[name].cap ?? 36);
      const dir = join(LAB, name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'candidates.json'), `${JSON.stringify({ name, ...WANTED[name], searched: new Date().toISOString().slice(0, 10), candidates: list }, null, 2)}\n`);
      if (list.length) await sheet(name, list, join(dir, 'sheet.jpg'));
      else await rm(join(dir, 'sheet.jpg'), { force: true });
      console.log(`search   ${name.padEnd(18)} ${String(list.length).padStart(2)} candidates`);
    }
  },
  async import(names, opts) {
    const [name, from] = names;
    if (!WANTED[name] || !from) throw new Error('import <name> <file.glb>');
    if (WANTED[name].rig) throw new Error(`${name} is a figure: it needs Meshy's rig first (the plan's Task 1.1 steps), not a plain import`);
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { dedup, meshopt, prune, simplify, textureCompress, weld } = await import('@gltf-transform/functions');
    const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import('meshoptimizer');
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    await MeshoptSimplifier.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(from);
    const count = () => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
    const before = count();
    const poly = Number(opts.poly ?? 30000);
    // Community models come out of Meshy at hundreds of thousands of
    // triangles; the plan's props are 30,000. Simplify only what's over.
    const ratio = Math.min(1, poly / before);
    await doc.transform(
      dedup(),
      prune(),
      ...(ratio < 1 ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: true })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(opts.tex ?? 2048), Number(opts.tex ?? 2048)] }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    await mkdir(RM_OUT, { recursive: true });
    const to = join(RM_OUT, `${name}.glb`);
    await io.write(to, doc);
    // the credit, from the hit it was picked from
    const cands = JSON.parse(await readFile(join(LAB, name, 'candidates.json'), 'utf8'));
    const picked = cands.candidates.find((c) => c.task === opts.task || c.id === opts.task) ?? (opts.task ? null : cands.picked);
    if (!picked) throw new Error(`--task <the hit's task id> (from lab/meshy/community/${name}/candidates.json)`);
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    credits[`meshy/rm/${name}`] = { source: picked.page, id: picked.task, name: `${picked.prompt.slice(0, 80)} (Meshy community)`, authors: [picked.author], license: picked.license === 'cc0' ? 'CC0 1.0' : picked.license };
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    console.log(`import   ${name.padEnd(18)} ${Math.round(before)} → ${Math.round(count())} triangles → ${to}`);
  },
};

async function main() {
  const [step, ...rest] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const opts = {};
  const args = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i];
    else args.push(rest[i]);
  }
  if (step === 'import') return steps.import(args, opts);
  // a phase's name, or `mine`, stands for its assets
  const all = Object.keys(WANTED);
  const names = args.length ? args.flatMap((a) => (a === 'mine' ? all.filter((n) => WANTED[n].mine) : /^phase\d$/.test(a) ? all.filter((n) => WANTED[n].phase === Number(a.slice(5))) : [a])) : all;
  for (const n of names) if (!WANTED[n]) throw new Error(`unknown asset ${n}`);
  await steps.search(names);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
