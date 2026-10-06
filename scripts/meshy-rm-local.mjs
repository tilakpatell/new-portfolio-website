// Makes this session's slice of the Rick and Morty multiverse plan
// (docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md) with
// Meshy, the site owner's account: Phase 2's people and props (Task 2.1) and
// Phase 6's vehicles (Task 6.1). Another session makes Phase 1 and is writing
// the plan's `rm` set into scripts/meshy.mjs (Task 0.2) at the same time, so
// this is that set's pipeline for these names alone, kept apart so the two
// never edit the same lines. Everything else is the plan's: its prompts (put
// right against the wiki's sheets, as its Step 1 says), concept images on
// nano-banana-pro (A-pose for anything rigged),
// image-to-3D on `latest` with 2k textures at 30,000 faces (heroes 40,000
// with Meshy's 2k geometry), rigged figures to public/games/meshy/ with idle,
// walk and run clips (and a seated one for `sit`), the rest to
// public/models/c137/rm/, credits in public/games/credits.json, and every
// task id in scripts/meshy-tasks.json, so once these names are in
// meshy.mjs's `rm` set it sees them made and never pays again. Fold them in
// then, and delete this.
//
// scripts/rm-models.json is the ledger both sessions read before paying:
// `claim` marks the names `claimed` (push that before any paid step), a paid
// step marks them `meshy`, `fetch` marks them `done`.
//
//   node --env-file=.env.local scripts/meshy-rm-local.mjs <step> [name … | phase2 | phase6]
//
// Steps, in order: claim (free), images (9 credits), models (30, heroes 35),
// rig (5, rigged only), anim (an idle clip, 3), sit (3), fetch (free:
// download and compress), balance. `reroll <step> <name …>` forgets a step's
// task (and everything made from it), so the next run of that step pays for
// it again. Concept images and model thumbnails go to lab/meshy/rm/.
// MESHY_API_KEY comes from .env.local (git ignores it); it is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The sharp that glTF-Transform's ndarray-pixels loads (it brings its own
// version). Loading the project's as well puts two libvips in one process,
// and on Windows every texture then fails ("colourspace: parameter space not
// set"); with one, it doesn't.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'meshy');
const RM_OUT = join(ROOT, 'public', 'models', 'c137', 'rm');
const REVIEW = join(ROOT, 'lab', 'meshy', 'rm'); // concept images and thumbnails, for judging (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const LEDGER = join(ROOT, 'scripts', 'rm-models.json');
const API = 'https://api.meshy.ai/openapi';

// as scripts/meshy.mjs has them
const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';
const CAR = 'The whole vehicle, three-quarter front view, centred, wheels on the ground.';

// The plan's Task 2.1 and 6.1 assets. Its prompts were checked against each
// one's wiki page and stills on 6 October (the plan's Step 1), and all but
// Snuffles's put right where the show differs: Rick Prime's boots and right
// shoulder pad, Tricia's over-the-knee socks, the Story Train streamlined
// and gold, the Zigerion ship a green dumbbell, and so on. hero: 40,000
// faces and Meshy's 2k geometry; sit: a seated clip too; rig: false for the
// props, creatures and vehicles (everything else is rigged, `height` in
// metres).
const PHASE2 = {
  spacebeth: { hero: true, sit: true, height: 1.68, prompt: `Space Beth from Rick and Morty: Beth Smith as a space fighter, a woman in her thirties with shoulder-length blonde hair swept over to her left, the right side of her head shaved to short blonde stubble and a light blue streak in the hair on the left, a purple scar running down across her right eye onto her cheek and a ring piercing in her right eyebrow, a long dark brown leather coat with grey-green lapels over a fitted dark grey-green combat suit with a high dark navy collar and a grey-green chest plate with a small red light, a grey device with small red and blue lights on her right forearm, a bronze gauntlet on her left forearm, fingerless gloves, a utility belt, black boots. ${BODY}` },
  rickprime: { hero: true, height: 1.85, prompt: `Rick Prime from Rick and Morty: a version of Rick Sanchez with greyer skin and no lab coat, dull pale blue spiky hair sticking up and out like Rick's, a unibrow and half-lidded cold eyes, a short dark navy-purple zip-up sci-fi jacket with a high collar and a lighter grey-purple panel down the front, a grey pad on his right shoulder and a red chevron stripe across the chest, over a dark red shirt, slim dark grey-black trousers with a grey strap belt and an empty thigh holster, and dark grey mid-calf boots. ${BODY}` },
  snuffles: { rig: false, prompt: `Snuffles from Rick and Morty: a small fluffy white dog standing on all fours, small black beady eyes, a little black nose, floppy ears and a blue collar with a round silver tag. ${PROP}` },
  drwong: { sit: true, height: 1.72, prompt: `Dr. Wong from Rick and Morty: a tall slim middle-aged Chinese-American woman with a fair complexion, black hair in a heavy jaw-length bob with a thick fringe swept to one side, large thick grey-rimmed square glasses, in a hip-length beige wool jacket with light grey ribbed edges and cuffs over a yellow long-sleeved shirt, a chunky white necklace, black trousers, a black belt cinched over the jacket at the waist and black flat shoes. ${BODY}` },
  nancy: { height: 1.6, prompt: `Nancy from Rick and Morty, Summer's friend: a teenage girl with a long face and a long droopy nose, long straight dark brown hair parted to one side and hanging past her shoulders to mid-back, thin square glasses, red lipstick, a white T-shirt tucked into pale sage-green trousers with a brown belt, an open thick dark wine-red jacket reaching mid-thigh with turned-up cuffs, white socks and dark grey flat shoes. ${BODY}` },
  tricia: { height: 1.62, prompt: `Tricia Lange from Rick and Morty: a teenage girl with very long, gently wavy dark brown hair parted in the middle and falling to her waist, a narrow nose, a short-sleeved white scoop-neck crop top, a burgundy plaid mini skirt, a small cross necklace on a thin chain, light grey over-the-knee socks with a band near the top, and black flat shoes. ${BODY}` },
  diane: { height: 1.68, prompt: `Diane Sanchez from Rick and Morty: a slim fair-skinned woman with straight light blonde hair falling past her shoulders, a heart-shaped face with plump cheeks, an upturned nose, pink lips and a few freckles, a light turquoise cap-sleeved blouse with a square neckline and a wavy flared hem worn loose over slim white jeans, pale grey pumps with medium cone heels, a silver pendant necklace, a violet bangle on her right wrist, a gold wedding ring on her left hand. ${BODY}` },
  pencilvester: { height: 1.6, prompt: `Pencilvester from Rick and Morty: a living yellow wooden pencil standing upright, a pink eraser and a grey ridged metal band at the top, his face on the yellow body just below the band, the yellow paint ending in a scalloped edge above the sharpened tan wooden point with a dark grey graphite tip, which hangs down between his legs; two thin pale yellow stick arms from the upper sides and two thin pale yellow stick legs from the bottom of the yellow part, red sneakers with white toe caps and soles, mismatched round eyes, pink lips and buck teeth. ${BODY}` },
  sleepygary: { height: 1.78, prompt: `Sleepy Gary from Rick and Morty: a slim sleepy man with short brown hair, heavy half-closed eyelids and a calm smile, in a pale blue pyjama robe reaching the upper thigh, open at the neck, with periwinkle-blue lapels and two periwinkle hip pockets, over white pyjama trousers with thin pale blue stripes; a long droopy pale blue and white striped nightcap with a turned-up band, its tip hanging over his left shoulder to his chest with a white cotton ball at its end, slippers. ${BODY}` },
  hamurai: { height: 1.8, prompt: `Hamurai from Rick and Morty: a samurai in full armour made of meat: a chest plate and baggy trousers of pink steamed ham with pale pink stripes, shoulder guards of stacked ham-steak slices, a belt of linked sausages with strings of sausages hanging down the front, a skirt of marbled steak plates, dark brown sleeves; a grey metal helmet with a bacon headband, a V-shaped bacon crest and pink ham flaps beside the face; a stern face with narrow eyes, thick black eyebrows, a long drooping black moustache and a long thin black goatee down to his chest; a bacon-strip sword tucked in the belt at his left hip, bare feet in pink sandals, empty hands. ${BODY}` },
  amishcyborg: { height: 1.78, prompt: `Amish Cyborg from Rick and Morty: a stocky old Amish man with a big bushy black beard and sideburns and no moustache, dark hair to the nape, a black flat-crowned wide-brimmed hat, a white shirt with the right sleeve rolled up to the elbow, olive-brown trousers held up by black suspenders with a rolled cuff on the right leg, a black shoe on the right foot; the left half of his face is grey metal with two round red lights for the eye and a round metal plate with three green light bars over his mouth, his left arm is a grey robot arm with a big rounded shoulder and green lights, ending in the blade of a shovel instead of a hand, and his left leg is a steel robot leg with bolted joints, green lights and a flat metal foot, coming out of a trouser leg cut off above the knee. ${BODY}` },
  mrbeauregard: { height: 1.85, prompt: `Mr. Beauregard from Rick and Morty: a heavyset elderly butler with a round fleshy face, heavy jowls and a double chin, a big nose and small pursed lips, dark grey hair combed straight back with silver-grey sides, thick dark grey brows and heavy-lidded eyes, in a black tuxedo dinner jacket, a deep plum-purple waistcoat, a white dress shirt with small black studs and a black bow tie, black trousers, black shoes, bare hands. ${BODY}` },
  cousinnicky: { height: 1.8, prompt: `Cousin Nicky from Rick and Morty: a muscular man from Brooklyn with a long face and long chin, a high receding hairline, black hair slicked back into long thick sideburns down to his jaw, clean-shaven, heavy-lidded eyes and a smug half-smile, in a very pale mint-blue sleeveless shirt with a big popped collar, open at the chest showing chest hair, tucked into grey trousers with a black belt and a rectangular brass buckle, hairy shoulders and forearms, black shoes. ${BODY}` },
  frankenstein: { height: 2.1, prompt: `Frankenstein's monster as drawn in Rick and Morty: a tall heavy pale mint-green-skinned monster with a flat-topped square head, black hair with a jagged fringe, a stitched scar across his forehead, two grey metal bolts in his neck, heavy-lidded pale yellow eyes with dark grey-blue rings under them, in a loose boxy dark charcoal-grey jacket whose sleeves stop a little short of the wrists, a near-black crew-neck shirt, black trousers and big black thick-soled boots. ${BODY}` },
  reversegiraffe: { rig: false, prompt: `Reverse Giraffe from Rick and Morty: a cartoon giraffe standing upright on short hind legs, with an extremely long, thin, pole-like vertical body taller than a man, pale yellow with brown patches and a thin brown mane down its back, two thin front legs bent at the elbow like arms, with dark brown hooves, sticking out near the top, a very short neck and a full-size giraffe head with big ears, two short horns with olive knobs, big round white eyes and an olive-tan muzzle. ${PROP}` },
  ghostinajar: { rig: false, prompt: `Ghost in a Jar from Rick and Morty: a tall clear glass mason jar with rounded shoulders and a shiny gold screw lid, and inside it, filling most of the jar, a glowing green translucent ghost with a round domed head, dots for eyes, a simple smiling line mouth, two stubby arms each with just a thumb, and a wavy lower edge. ${PROP}` },
  photographyraptor: { rig: false, prompt: `Photography Raptor from Rick and Morty: a velociraptor standing on its two hind legs, smooth olive-brown skin with dark brown blotches and olive-green patches round the eyes and snout, a pale cream throat, chest and belly, big yellow eyes with slit pupils, a long tail, thin arms with clawed hands, a toothy grinning snout, three-toed clawed feet, no clothes, standing with one clawed hand on an old-fashioned wooden bellows camera with a brass lens on a wooden tripod beside it. ${PROP}` },
  tinkles: { rig: false, prompt: `Tinkles from Rick and Morty: a little fluffy white lamb standing upright on her two hind legs with her front legs held out like little arms, a rainbow-striped unicorn horn, white ears with pink insides, light pink hooves, tail and snout, a fluffy curly pink tuft of hair on top of her head, big blue eyes with long lashes, a lavender tutu at her waist, a pale gold tiara with a magenta gem, pastel yellow, green and blue striped knee socks. ${PROP}` },
  babywizard: { rig: false, prompt: `Baby Wizard from Rick and Morty: a chubby baby standing barefoot and bare-chested, wearing only a blue diaper covered in yellow stars and crescent moons and a tall pointed blue wizard's hat with yellow stars and moons, a rolled white brim and a curled floppy tip, big round eyes, no beard, holding a thin wooden wand tipped with a yellow star. ${PROP}` },
  mrsrefrigerator: { rig: false, prompt: `Mrs. Refrigerator from Rick and Morty: a tall pale lavender two-door refrigerator standing upright, light blue door handles on the left, a woman's face on the top door with big round eyes, long lashes, pink eyeshadow and full pink lips, a dark mauve hair fringe under a pink white-polka-dot headscarf knotted in a bow on top, a heart note, a carrot magnet and a blank note on the lower door, a plain coral-pink apron with a white hem tied round its middle, two thin lavender arms coming out of its sides with a pink and a yellow bangle on one wrist, and two short legs in blue flat shoes. ${PROP}` },
};
const PHASE6 = {
  'spacebeth-ship': { rig: false, hero: true, prompt: `Space Beth's spaceship from Rick and Morty: a battered rounded saucer-like hull in slate grey-green with a mustard-yellow nose panel, a long row of orange-lit slot lights and a cyan light strip across the front, a large clear glass bubble cockpit dome with four empty seats, two rust-red engine pods with dark louvred intakes flanking the dome, a big black ring-shaped turbine on top at the back, long straight rust-red wings with olive patches and a tall dark red fin at a wingtip, a yellow-and-black striped gun barrel under a wing, two curved claw landing legs. ${PROP}` }, // (confirm against the sheet)
  'jerry-ship': { rig: false, prompt: `Jerry's car turned into a spaceship by Rick, from Rick and Morty: a long boxy pale green 1980s four-door station wagon with brown wood-grain panels along its sides, a roof rack, square twin headlights, a chrome grille and bumpers and grey hubcaps, with flat grey metal wings folded out from both sides of the body and grey rocket thrusters at the back. ${CAR}` },
  'gotron-ferret': { rig: false, hero: true, prompt: `A Gotron ferret robot from Rick and Morty: a giant mecha shaped like a long, low, sleek ferret, glossy red armour plates joined by white-silver segmented joints, a rounded ferret head with a white lower jaw, glowing yellow eyes and small round ears with teal glass, a teal glass cockpit canopy on top of its head, a raised hatch with small teal lights along its back, big round black wheel-like hip and shoulder joints on four short stubby legs, a long curving white-silver tail. ${PROP}` },
  gotron: { rig: false, hero: true, prompt: `The combined Gotron mecha from Rick and Morty: a towering humanoid super robot assembled from five identical ferret robots, a black boxy torso with a red collar and a gold chevron chest plate holding a red shield with a glowing G emblem, a white segmented waist with a black belt and gold buckle, two red-and-white wings rising behind the shoulders, a black helmet with a gold brow, glowing yellow eyes and a white faceplate, white segmented upper arms and thighs, a red ferret as the right forearm and a yellow one as the left, a blue ferret as the right shin and a green one as the left, each ferret's head forming the fist or foot, standing straight. ${PROP}` },
  'zigerion-ship': { rig: false, hero: true, prompt: `The Zigerion mothership from Rick and Morty: a huge dark green spaceship shaped like a dumbbell, two giant thick disc-shaped hulls side by side joined by a short boxy central hull, each disc rimmed with large glowing lime-green crescent windows and a ringed hub on its outer face with spiky barrels sticking out, teal light strips all over the hull, a flat top deck with a low boxy deckhouse and tall thin antenna spires tipped with red lights, a stepped underside ending in hanging spires. ${PROP}` }, // (confirm against the sheet "Zigerions")
  storytrain: { rig: false, hero: true, prompt: `The Story Train from Rick and Morty: a long streamlined science-fiction locomotive in gold, amber and copper, its rounded nose split by a tall ridged cream prow with a small red-rimmed round lamp, a pale cab windscreen on top, a big glowing round headlamp on each side, a copper slatted cowcatcher, dark red spoked wheels underneath, hauling three passenger carriages in dark red, brown and black with warm lit windows and glowing gold couplings, no text. ${PROP}` },
};
export const ASSETS = {};
for (const [phase, set] of [
  [2, PHASE2],
  [6, PHASE6],
]) {
  for (const [n, a] of Object.entries(set)) ASSETS[n] = { phase, rig: true, poly: a.hero ? 40000 : 30000, tex: 2048, ...a };
}

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

const json = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {});
const put = (file, v) => writeFile(file, `${JSON.stringify(v, null, 2)}\n`);
// (several tasks finish at once: each save writes what's in memory, which
// has them all)
let tasks = null;
const save = () => put(TASKS, tasks);
async function mark(names, status) {
  const ledger = await json(LEDGER);
  for (const n of names) if (ledger[n]?.status !== 'done' || status === 'done') ledger[n] = { status, by: 'local' };
  await put(LEDGER, ledger);
}

// run one step for several names at a time (Meshy queues only so many tasks)
async function each(names, fn, at = 4) {
  const queue = [...names];
  const failed = [];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      await fn(n).catch((e) => {
        failed.push(n);
        console.error(`! ${n}: ${e.message}`);
      });
    }
  };
  await Promise.all(Array.from({ length: at }, worker));
  if (failed.length) console.error(`failed: ${failed.join(' ')}`);
}

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed;
// a clip keeps only its skeleton and animation.
let io = null;
async function squeeze(from, to, { tex = 0, clip = false } = {}) {
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
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(to, doc);
}

// what each step leaves, in order: rerolling one forgets it and those after
const CHAIN = ['image', 'model', 'rig', 'idle', 'sit'];
const LEAVES = { images: 'image', models: 'model', rig: 'rig', anim: 'idle', sit: 'sit' };

const steps = {
  async claim(names) {
    await mark(names, 'claimed');
    console.log(`claim    ${names.length} names in scripts/rm-models.json: commit and push it before paying`);
  },
  async images(names) {
    await mark(names, 'meshy');
    await each(names, async (n) => {
      const a = ASSETS[n];
      tasks[n] ??= {};
      if (!tasks[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${STYLE}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}) });
        tasks[n].image = result;
        await save();
      }
      const t = await wait('/v1/text-to-image', tasks[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(18)} ${t.consumed_credits} credits`);
    });
  },
  async models(names) {
    await each(names, async (n) => {
      const a = ASSETS[n];
      if (!tasks[n]?.image) throw new Error('no image yet');
      if (!tasks[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: tasks[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: a.poly,
          texture_resolution: '2k',
          ...(a.hero ? { geometry_resolution: '2k' } : {}),
          ...(a.rig ? { pose_mode: 'a-pose' } : {}),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        tasks[n].model = result;
        await save();
      }
      const t = await wait('/v1/image-to-3d', tasks[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(18)} ${t.consumed_credits} credits`);
    });
  },
  async rig(names) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!tasks[n]?.model) throw new Error('no model yet');
        if (!tasks[n].rig) {
          const { result } = await api('POST', '/v1/rigging', { input_task_id: tasks[n].model, height_meters: ASSETS[n].height });
          tasks[n].rig = result;
          await save();
        }
        const t = await wait('/v1/rigging', tasks[n].rig, `${n} rig`);
        console.log(`rig      ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  // an idle clip (Meshy's animation library, action 0), on the bare skeleton
  async anim(names) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!tasks[n]?.rig) throw new Error('not rigged yet');
        if (!tasks[n].idle) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: tasks[n].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } });
          tasks[n].idle = result;
          await save();
        }
        const t = await wait('/v1/animations', tasks[n].idle, `${n} idle`);
        console.log(`anim     ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  // sitting: Chair_Sit_Idle_M from Meshy's animation library
  async sit(names) {
    await each(
      names.filter((n) => ASSETS[n].rig && ASSETS[n].sit),
      async (n) => {
        if (!tasks[n]?.rig) throw new Error('not rigged yet');
        if (!tasks[n].sit) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: tasks[n].rig, action_id: 33, post_process: { operation_type: 'extract_armature' } });
          tasks[n].sit = result;
          await save();
        }
        const t = await wait('/v1/animations', tasks[n].sit, `${n} sit`);
        console.log(`sit      ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  async fetch(names) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    await mkdir(tmp, { recursive: true });
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    const done = [];
    for (const n of names) {
      const a = ASSETS[n];
      const s = tasks[n] ?? {};
      const files = []; // [url, file, texture size, clip only]
      if (a.rig) {
        if (!s.rig || !s.idle || (a.sit && !s.sit)) {
          console.error(`! ${n}: rig, anim${a.sit ? ' and sit' : ''} first`);
          continue;
        }
        const r = (await api('GET', `/v1/rigging/${s.rig}`)).result;
        const idle = (await api('GET', `/v1/animations/${s.idle}`)).result;
        files.push([r.rigged_character_glb_url, `${n}.glb`, a.tex, false]);
        // the clips on their own: the cast plays them on the figure
        files.push([r.basic_animations.walking_armature_glb_url, `${n}-walk.glb`, 0, true]);
        files.push([r.basic_animations.running_armature_glb_url, `${n}-run.glb`, 0, true]);
        files.push([idle.animation_glb_url, `${n}-idle.glb`, 0, true]);
        if (s.sit) files.push([(await api('GET', `/v1/animations/${s.sit}`)).result.animation_glb_url, `${n}-sit.glb`, 0, true]);
      } else {
        if (!s.model) {
          console.error(`! ${n}: no model yet`);
          continue;
        }
        const t = await api('GET', `/v1/image-to-3d/${s.model}`);
        files.push([t.model_urls.glb, `${n}.glb`, a.tex, false]);
      }
      const out = a.rig ? OUT : RM_OUT;
      await mkdir(out, { recursive: true });
      for (const [url, file, tex, clip] of files) {
        const raw = join(tmp, `${s.rig ?? s.model}-${file}`);
        if (!existsSync(raw)) await download(url, raw);
        await squeeze(raw, join(out, file), { tex, clip });
      }
      credits[`meshy/${a.rig ? '' : 'rm/'}${n}`] = { source: 'https://www.meshy.ai', id: s.model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      done.push(n);
      console.log(`fetch    ${n.padEnd(18)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await put(creditsFile, credits);
    if (done.length) await mark(done, 'done');
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...rest] = process.argv.slice(2);
  const forget = step === 'reroll' ? rest.shift() : null;
  if (!steps[step] && !forget) throw new Error(`step: ${Object.keys(steps).join(' | ')} | reroll <step> <name …>`);
  // a phase's name stands for its assets
  const names = (rest.length ? rest : Object.keys(ASSETS)).flatMap((n) => (/^phase\d$/.test(n) ? Object.keys(ASSETS).filter((k) => ASSETS[k].phase === Number(n.slice(5))) : [n]));
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  tasks = await json(TASKS);
  if (forget) {
    const from = CHAIN.indexOf(LEAVES[forget]);
    if (from < 0 || !rest.length) throw new Error(`reroll <${Object.keys(LEAVES).join(' | ')}> <name …>`);
    for (const n of names) for (const k of CHAIN.slice(from)) if (tasks[n]) delete tasks[n][k];
    await save();
    console.log(`reroll   ${forget} forgotten for ${names.join(' ')}`);
    return;
  }
  await steps[step](names);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
