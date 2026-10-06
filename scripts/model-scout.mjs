// The model scout: before Meshy makes a figure (about 55 credits for a hero,
// 30-odd for anything else), see whether somebody has made it already. It
// searches Sketchfab for downloadable models under a licence the site can use
// (CC0, or Attribution without “no derivatives”), ranks them (those named
// for it first, then by likes, then by how near their face count is to the
// 30,000 the figures are made at) and writes a contact sheet to
// lab/meshy/scout/<name>/ (gitignored, like the concept images):
// candidates.json, each candidate’s largest thumbnail as <n>-<uid>.jpg, and
// candidates.md, the list to judge against the wiki’s reference sheet in
// lab/meshy/refs/<slug>/ (scripts/wiki-refs.mjs makes those) the way the
// spec’s accuracy gate judges a Meshy concept. Only when none of them passes
// does the figure go to scripts/meshy.mjs.
//
// One that passes is fetched: downloaded through Sketchfab’s API with the
// site owner’s token (SKETCHFAB_API_TOKEN, sent to Sketchfab’s API on every
// request and nowhere else, never printed), brought to web size by
// scripts/sketchfab-import.mjs (2048 px textures, 40,000 triangles, and
// --keep for a rigged one, so its skeleton stays where its clips expect it),
// and credited in src/data/modelCredits.json for the page that shows it.
//
// --rigged is for a figure that will walk: rigged models come first, and the
// rest stay on the list after them, because a good model with no skeleton is
// still cheaper than a new one (Meshy’s rigging step takes a GLB by URL, for
// 5 credits). Sketchfab matches every word of a query, so a long one can find
// nothing a short one would: give more than one, and their results are
// merged. Meshy’s own community (meshy.ai/discover) has no API to search, so
// it is looked over by hand; the contact sheet says so.
//
//   NODE_USE_ENV_PROXY=1 node scripts/model-scout.mjs <name> "<search query>" ["<another query>" …] [--rigged] [--max 12]
//   NODE_USE_ENV_PROXY=1 node scripts/model-scout.mjs fetch <name> <uid> <out.glb> [--where c-137] [--as "Squanchy"]

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCOUT = join(ROOT, 'lab', 'meshy', 'scout');
const REFS = join(ROOT, 'lab', 'meshy', 'refs');
const CREDITS = join(ROOT, 'src', 'data', 'modelCredits.json');
const API = 'https://api.sketchfab.com/v3';
// pages of a search read (24 to a page, the most Sketchfab gives)
const PAGES = 4;
const USAGE = 'usage: node scripts/model-scout.mjs <name> "<search query>" ["<another query>" …] [--rigged] [--max 12]\n       node scripts/model-scout.mjs fetch <name> <uid> <out.glb> [--where c-137] [--as "<what it is>"]';

// The licences the site can use, as Sketchfab slugs them, and as
// modelCredits.json names them. Never a no-derivatives one (the import
// changes every model), never a store licence.
const LICENCES = { cc0: 'CC0-1.0', by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

export const licenseOk = (slug) => typeof slug === 'string' && Object.hasOwn(LICENCES, slug);

// A name as the wiki’s reference sheets are slugged (“Mr. Poopybutthole” is
// mr-poopybutthole), so a scout and its sheet share a folder name.
export const slugOf = (name) =>
  String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// The most liked first, then the face count nearest the one wanted (a model
// with none counted, last). Before both, when asked: rigged ones, and before
// those, models named for what’s sought (“Bird Person” for birdperson), as
// likes say nothing of whether a model is the thing at all.
export function rank(models, { wantFaces = 30000, rigged = false, named = null } = {}) {
  const bare = (s) => slugOf(s ?? '').replace(/-/g, '');
  const sought = named ? bare(named) : '';
  const isNamed = (m) => Number(Boolean(sought) && bare(m.name).includes(sought));
  const off = (m) => (Number.isFinite(m.faceCount) ? Math.abs(m.faceCount - wantFaces) : Number.MAX_SAFE_INTEGER);
  return [...models].sort(
    (a, b) => isNamed(b) - isNamed(a) || (rigged ? Number(Boolean(b.isRigged)) - Number(Boolean(a.isRigged)) : 0) || (b.likeCount ?? 0) - (a.likeCount ?? 0) || off(a) - off(b),
  );
}

// The command line: a name, then its queries (the name itself if none), with
// the flags anywhere among them.
export function options(argv) {
  const words = [];
  let rigged = false;
  let max = 12;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--rigged') rigged = true;
    else if (argv[i] === '--max') max = Number(argv[++i]);
    else words.push(argv[i]);
  }
  const [name, ...queries] = words;
  return { name, queries: queries.length ? queries : [name], rigged, max };
}

// a model’s widest thumbnail
export const largest = (m) => [...(m.thumbnails?.images ?? [])].sort((a, b) => b.width - a.width)[0]?.url ?? null;

// Whether a GLB has a skeleton, read off its JSON chunk alone.
export function hasSkin(glb) {
  const b = Buffer.isBuffer(glb) ? glb : Buffer.from(glb);
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'glTF' || b.toString('ascii', 16, 20) !== 'JSON') return false;
  try {
    return (JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))).skins?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// A model’s entry in modelCredits.json, from its page in Sketchfab’s API.
export const creditOf = (m, { where, as, file }) => ({
  title: m.name,
  author: m.user?.displayName || m.user?.username,
  authorUrl: m.user?.profileUrl ?? `https://sketchfab.com/${m.user?.username}`,
  license: LICENCES[m.license?.slug],
  licenseUrl: m.license?.url,
  source: m.viewerUrl,
  where,
  as,
  file,
});

const token = process.env.SKETCHFAB_API_TOKEN;

// Sketchfab’s API, with the token; a request refused with it is asked again
// without, as the public would ask it.
async function api(url) {
  let r = await fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} });
  if (token && (r.status === 401 || r.status === 403)) r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// every licence Sketchfab has, by its id (a search gives only the id and the label)
async function licences() {
  const { results } = await api(`${API}/licenses`);
  return new Map(results.map((l) => [l.uri.split('/').pop(), l]));
}

// one query’s downloadable models, the most liked first, a few pages of them
async function search(q, rigged) {
  const found = [];
  let url = `${API}/search?${new URLSearchParams({ type: 'models', downloadable: 'true', q, count: '24', sort_by: '-likeCount', ...(rigged ? { rigged: 'true' } : {}) })}`;
  for (let page = 0; url && page < PAGES; page++) {
    const { results, next } = await api(url);
    found.push(...results);
    url = next;
  }
  return found;
}

// a thumbnail, as a JPEG (they come as JPEGs; anything else is turned into one)
async function save(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  let bytes = Buffer.from(await r.arrayBuffer());
  if (!/jpe?g/.test(r.headers.get('content-type') ?? '')) {
    const { default: sharp } = await import('sharp');
    bytes = await sharp(bytes).jpeg({ quality: 88 }).toBuffer();
  }
  await writeFile(file, bytes);
}

const quoted = (qs) => qs.map((q) => `“${q}”`).join(', ');
const faces = (n) => (Number.isFinite(n) ? `${n.toLocaleString('en-GB')} faces` : 'faces not counted');

function contactSheet({ name, slug, queries, rigged, found, candidates }) {
  const sheet = existsSync(join(REFS, slug, 'ref.png'));
  const lines = [
    `# Scouting for ${name}`,
    '',
    `Sketchfab, searched on ${new Date().toISOString().slice(0, 10)} for ${quoted(queries)}: downloadable models under CC0 or an Attribution licence without “no derivatives”. Those named for it come first${rigged ? ', rigged ones next' : ''}, then the most liked, then the face count nearest 30,000. ${found} found${found > candidates.length ? `; the first ${candidates.length} are here` : ''}.`,
    '',
    'Judge each against the wiki’s reference sheet as the accuracy gate judges a Meshy concept: the silhouette, the six main colours, every garment there, the face (brow, eyes, mouth), nothing melted or fused to the body. Then open the one that passes on Sketchfab and turn it round: the back and the feet count too.',
    '',
    sheet ? `![The wiki’s reference sheet](../../refs/${slug}/ref.png)\n\nWhat the wiki says it looks like: [ref.md](../../refs/${slug}/ref.md)` : `No reference sheet yet: \`node scripts/wiki-refs.mjs "<its wiki title>"\` makes one in lab/meshy/refs/${slug}/.`,
    '',
  ];
  for (const c of candidates) {
    lines.push(
      `## ${c.n}. ${c.name}`,
      '',
      c.image ? `![${c.name}](${c.image})` : '(no thumbnail)',
      '',
      `By [${c.author}](${c.authorUrl}) under [${c.license}](${c.licenseUrl}). ${faces(c.faces)}, ${c.isRigged ? 'rigged' : 'not rigged'}, ${c.animationCount} ${c.animationCount === 1 ? 'clip' : 'clips'}, ${c.likes} ${c.likes === 1 ? 'like' : 'likes'}. [On Sketchfab](${c.viewerUrl})`,
      '',
      'If it passes:',
      '',
      `    node scripts/model-scout.mjs fetch ${slug} ${c.uid} public/models/c137/rm/${slug}.glb`,
      '',
    );
  }
  lines.push(
    '## If none passes',
    '',
    `Look over Meshy’s community by hand (https://www.meshy.ai/discover: it has no API to search), and only then make it with \`scripts/meshy.mjs\`.${rigged ? ' A model here that is right but not rigged can be rigged by Meshy for 5 credits instead.' : ''}`,
    '',
  );
  return lines.join('\n');
}

async function scout({ name, queries, rigged, max }) {
  const slug = slugOf(name);
  const dir = join(SCOUT, slug);
  const byId = await licences();
  const licence = (m) => (m.license?.slug ? m.license : byId.get(m.license?.uid)) ?? {};
  const usable = (m) => m.isDownloadable !== false && !m.isAgeRestricted && licenseOk(licence(m).slug);
  // each query searched twice, the second time for rigged models only, which
  // is how a model is known to be rigged (a search doesn’t say)
  const pool = new Map();
  for (const q of queries) {
    for (const m of await search(q, true)) pool.set(m.uid, { ...m, isRigged: true });
    for (const m of await search(q, false)) if (!pool.has(m.uid)) pool.set(m.uid, { ...m, isRigged: false });
  }
  const kept = [...pool.values()].filter(usable);
  const ranked = rank(kept, { rigged, named: name }).slice(0, max);

  await mkdir(dir, { recursive: true });
  // (the last scout’s thumbnails; a fetched model’s download stays)
  for (const f of await readdir(dir)) if (/^\d+-[0-9a-f]{32}\.jpg$/.test(f)) await rm(join(dir, f));
  const candidates = [];
  for (const [i, m] of ranked.entries()) {
    const l = licence(m);
    const thumbnail = largest(m);
    const image = `${i + 1}-${m.uid}.jpg`;
    let saved = false;
    if (thumbnail)
      saved = await save(thumbnail, join(dir, image)).then(
        () => true,
        (e) => {
          console.warn(`  (no thumbnail for ${m.uid}: ${e.message})`);
          return false;
        },
      );
    candidates.push({
      n: i + 1,
      uid: m.uid,
      name: m.name,
      author: m.user?.displayName || m.user?.username,
      authorUrl: m.user?.profileUrl,
      license: l.label,
      licenseSlug: l.slug,
      licenseUrl: l.url,
      faces: m.faceCount,
      isRigged: m.isRigged,
      animationCount: m.animationCount ?? 0,
      likes: m.likeCount ?? 0,
      viewerUrl: m.viewerUrl,
      thumbnail,
      image: saved ? image : null,
    });
  }
  await writeFile(join(dir, 'candidates.json'), `${JSON.stringify(candidates, null, 2)}\n`);
  await writeFile(join(dir, 'candidates.md'), contactSheet({ name, slug, queries, rigged, found: kept.length, candidates }));

  console.log(`${name}: ${kept.length} usable on Sketchfab for ${quoted(queries)}${rigged ? ', rigged first' : ''}`);
  for (const c of candidates) console.log(`  ${String(c.n).padStart(2)}. ${c.name} (${c.license}; ${c.likes} ${c.likes === 1 ? 'like' : 'likes'}, ${faces(c.faces)}, ${c.isRigged ? 'rigged' : 'not rigged'}) by ${c.author}  ${c.uid}`);
  if (kept.length < 3) console.log('  (Sketchfab matches every word of a query: a shorter one, or a second one, may find more)');
  console.log(`  → ${relative(ROOT, dir)}/candidates.md`);
}

// one candidate brought in: its download kept beside the contact sheet, the
// import, the credit
async function fetchModel([name, uid, out, ...rest]) {
  if (!name || !/^[0-9a-f]{32}$/.test(uid ?? '') || !out) throw new Error(USAGE);
  const flag = (k, d) => (rest.includes(`--${k}`) ? rest[rest.indexOf(`--${k}`) + 1] : d);
  const slug = slugOf(name);
  const dir = join(SCOUT, slug);
  const m = await api(`${API}/models/${uid}`);
  if (!licenseOk(m.license?.slug)) throw new Error(`${m.name}: its licence (${m.license?.label}) isn’t one the site can use`);
  if (m.isDownloadable === false) throw new Error(`${m.name}: not downloadable`);
  await mkdir(dir, { recursive: true });
  const src = join(dir, `${uid}.glb`);
  if (!existsSync(src)) {
    const { glb } = await api(`${API}/models/${uid}/download`);
    if (!glb?.url) throw new Error(`${m.name}: no .glb to download`);
    // (a signed link to the file: no token)
    const r = await fetch(glb.url);
    if (!r.ok) throw new Error(`${m.name}: download ${r.status}`);
    await writeFile(src, Buffer.from(await r.arrayBuffer()));
  }
  const rigged = hasSkin(await readFile(src));
  const to = resolve(out);
  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sketchfab-import.mjs'), src, to, '--tex', '2048', '--tris', '40000', ...(rigged ? ['--keep'] : [])], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`sketchfab-import.mjs stopped (${run.status ?? run.signal})`);

  const pub = relative(join(ROOT, 'public'), to);
  const file = pub.startsWith('..') ? relative(ROOT, to).split(sep).join('/') : `/${pub.split(sep).join('/')}`;
  const where = flag('where', 'c-137');
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  credits[`${where}-${slug}`] = creditOf(m, { where, as: flag('as', name), file });
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`${m.name} by ${credits[`${where}-${slug}`].author} (${m.license.label}) → ${file}${rigged ? ', rigged' : ''}; credited as ${where}-${slug}`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'fetch') return fetchModel(argv.slice(1));
  const o = options(argv);
  if (!o.name || !Number.isInteger(o.max) || o.max < 1) throw new Error(USAGE);
  await scout(o);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
