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
// look (free: the model as Meshy made it, for judging before the rig), rig
// (5, rigged only), anim (an idle clip, 3), sit (3), fetch (free: download
// and compress), balance. `reroll <step> <name …>` forgets a step's task (and
// everything made from it), so the next run of that step pays for it again.
// `use <name> <png in lab/meshy/rm/> [flip]` makes the model from that
// picture instead of the latest concept: an earlier concept that was better,
// or one mirrored. The image model often draws a lopsided character the
// wrong way round (Space Beth's shaved side, the Amish Cyborg's metal half),
// and when every part is mirrored alike, flipping the picture is surer than
// drawing it again. Concept images, thumbnails and looks go to
// lab/meshy/rm/ (earlier rounds' concepts in round1/ and so on).
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
  spacebeth: { hero: true, sit: true, height: 1.68, prompt: `Space Beth from Rick and Morty: Beth Smith as a space fighter, a woman in her thirties with a lopsided hairstyle: the right side of her head (on the left of the picture) shaved to short blonde stubble, and her shoulder-length blonde hair swept over the top of her head to fall on her left side (on the right of the picture), with a light blue streak in it; on the shaved side (the left of the picture) a silver ring piercing in her right eyebrow and a jagged purple scar running down across her right eye onto her cheek; a long very dark brown leather coat with grey-green lapels over a fitted dark grey-green combat suit with a high dark navy collar and a grey-green chest plate with a small red light in a round dark disc low on its front, a grey device with small red and blue lights on her right forearm (on the left of the picture), a bronze gauntlet on her left forearm (on the right of the picture), black fingerless gloves, a utility belt, black boots. ${BODY}` },
  rickprime: { hero: true, height: 1.85, prompt: `Rick Prime from Rick and Morty: a version of Rick Sanchez with greyer skin and no lab coat, dull pale blue spiky hair sticking up and out like Rick's, a unibrow, half-lidded cold eyes and a closed flat mouth, a dark navy zip-up sci-fi jacket reaching the hips with a high collar, a lighter grey-purple panel running the whole front from collar to hem on both sides of the zip, a short red stripe angled down across each dark outer side of the chest with no red over the zip or the centre panel, lilac cuffs, and a single grey armoured pad on his right shoulder only (on the left of the picture), over a dark red shirt, slim dark navy trousers with a grey strap belt slanting across the hips to an empty thigh holster on his right leg (also on the left of the picture), and dark navy-grey mid-calf boots with a thin red light strip on each. ${BODY}` },
  snuffles: { rig: false, prompt: `Snuffles from Rick and Morty: a small scruffy white dog standing on all fours, with shaggy, wispy white fur that sticks out in little pointed tufts all over, a messy shaggy fringe on top of his head, round black eyes with tiny white highlights and small worried brow lines above them, a small black nose and a small mouth line, floppy shaggy ears, short legs, a thin shaggy white tail held straight up behind him and clearly visible above his back, and a light teal-blue collar with a round pale blue-silver tag hanging at the front. ${PROP}` },
  drwong: { sit: true, height: 1.72, prompt: `Dr. Wong from Rick and Morty: a tall slim middle-aged Chinese-American woman with a fair complexion and a long neck, a smooth black jaw-length bob with the ends curving in under the jaw and a heavy fringe swept across the forehead to one side, large thick grey-rimmed square glasses, a long pale grey-beige knit cardigan reaching below the hips, buttoned from the chest down, with a wide light grey ribbed band running round the neck and down both front edges like a shawl collar, no lapels and no pointed collar, and ribbed cuffs, over a yellow long-sleeved top whose cuffs show at the wrists, a thick smooth white ring necklace close round the neck (one solid band, not beads), a thin dark belt with a square silver buckle cinched over the cardigan at the waist, black trousers and black flat shoes. ${BODY}` },
  nancy: { height: 1.6, prompt: `Nancy from Rick and Morty, Summer's friend: a tall lanky teenage girl with a very long narrow face and a long chin, a long droopy nose with a long curved bridge, a wide mouth with bright red lipstick, long straight dark brown hair with a side-parted fringe of thin strands falling over her forehead and the rest hanging straight down behind her shoulders to mid-back, thin rectangular glasses, a white T-shirt tucked into pale khaki-green trousers with an orange-brown belt with a cream buckle, an open long dusty wine-red cardigan coat reaching mid-thigh with a rolled shawl collar and thick turned-up cuffs, white socks and dark grey flat shoes. ${BODY}` },
  tricia: { height: 1.62, prompt: `Tricia Lange from Rick and Morty: a teenage girl with long, gently wavy warm reddish-brown hair with a side part, hanging behind her shoulders and down her back to mid-back, close to her body so none of it spreads out beside her arms or waist, a narrow nose, long eyelashes and pink lips, a short-sleeved white crop top with a low wide scoop neck, a red-burgundy plaid mini skirt, a small cross necklace on a thin chain, light grey over-the-knee socks with a band near the top, and black flat shoes. ${BODY}` },
  diane: { height: 1.68, prompt: `Diane Sanchez from Rick and Morty: a slim fair-skinned woman with straight pale lemon-blonde hair falling to just past her shoulders and covering her ears, a heart-shaped face with plump cheeks, an upturned nose, punch-pink lips and a few freckles, a very pale mint-turquoise cap-sleeved blouse with a square neckline and a wavy flared hem worn loose over slim white jeans, pale grey pumps with medium cone heels, a silver pendant necklace, a violet bangle on her right wrist (on the left of the picture) and a gold wedding ring on her left hand (on the right of the picture); she stands with her feet planted a shoulder-width apart, so a wide gap of white background shows between her legs all the way from the crotch down to her feet. ${BODY}` },
  pencilvester: { height: 1.6, prompt: `Pencilvester from Rick and Morty: a living yellow wooden pencil standing upright, a pink eraser and a grey ridged metal band at the top, his face on the yellow body just below the band, the yellow paint ending in a scalloped edge above the sharpened tan wooden point with a dark grey graphite tip, which hangs down between his legs; two thin pale yellow stick arms from the upper sides and two thin pale yellow stick legs from the bottom of the yellow part, red sneakers with white toe caps and soles, mismatched round eyes, pink lips and buck teeth. ${BODY}` },
  sleepygary: { height: 1.78, prompt: `Sleepy Gary from Rick and Morty: a slim sleepy man with short neat brown hair, large white oval eyes with tiny black dot pupils half covered by heavy drooping upper eyelids, thin brows and a calm closed-mouth smile, in a pale blue pyjama robe reaching the upper thigh, wrapped closed across his body, with notched periwinkle-blue lapels that meet in a V at mid-chest, periwinkle cuffs and two periwinkle hip pockets, over white pyjama trousers with thin pale blue stripes; a long droopy very pale blue nightcap with thin white stripes running lengthwise along it, pulled down over the whole top of his head with a wide turned-up band straight across his forehead, his brown hair showing only at the sides above his ears; the long floppy tail of the cap curves forward over his left shoulder (on the right of the picture) and hangs flat down the front of his chest beside the lapel, ending in a white cotton ball resting on his chest, well away from his arm and armpit; soft pale blue slippers. ${BODY}` },
  hamurai: { height: 1.8, prompt: `Hamurai from Rick and Morty: a samurai in full armour made of meat: a chest plate of pink steamed ham with wavy pale pink stripes running across it and one fat dark maroon sausage lying diagonally across it; shoulder guards of three stacked tan ham-steak slices with brown grain lines and pale pink fat rims, and smaller tan ham-steak plates on the outside of each upper arm and each wrist, over dark brown sleeves; a belt of fat dark maroon-brown linked sausages round the waist with two short strings of fat dark maroon sausages hanging down the front; a skirt of pink-edged brown marbled steak plates, each with a small round marrow bone, to mid-thigh; baggy knee-length trousers of pink ham with wide pale pink stripes running across them, short pink-edged marbled steak shin guards below them, and bare ankles and feet in thick pink sandals with dark thong straps; a grey metal dome helmet with a bacon-strip headband, a single bacon strip bent into a wide V standing up from the front of it as a crest, and long pink ham flaps hanging down either side of his face to the jaw; a stern face with narrow eyes, long thick black eyebrows that sweep out past the sides of his face, a long drooping black moustache and a long tapering black goatee down to his chest; a bacon-strip sword tucked in the belt at his left hip, its end angled down and out behind him, well clear of his left hand; empty open hands. ${BODY}` },
  amishcyborg: { height: 1.78, prompt: `Amish Cyborg from Rick and Morty: a stocky old Amish man with a big bushy black beard and sideburns and no moustache, dark hair to the nape, a black flat-crowned wide-brimmed hat, a white shirt and olive-brown trousers held up by black suspenders. He is fully human on his right side, which is the left of the picture, and robotic on his left side, which is the right of the picture. On the left of the picture: an ordinary half-closed cartoon eye, white with a small black pupil and not glowing; a human arm with the shirt sleeve rolled up to the elbow and an empty open hand; a human leg in the olive-brown trouser with a rolled cuff and a black shoe. On the right of the picture: that half of his face is grey metal with two small round red lights in metal rings, one above and a little outside the other, where the eye would be; that arm is a grey robot arm with a big rounded shoulder and green lights, ending in the blade of a shovel instead of a hand; that leg is a steel robot leg with bolted joints, green lights and a flat metal foot, coming out of a trouser leg cut off above the knee. A round metal plate with three green light bars covers his mouth. ${BODY}` },
  mrbeauregard: { height: 1.85, prompt: `Mr. Beauregard from Rick and Morty: a heavyset elderly butler with pale skin, a round fleshy face, heavy jowls and a double chin, a big nose and small pursed pink lips, dark grey hair combed straight back with silver-grey sides, thick dark grey brows and heavy-lidded white eyes with tiny pupils, in a black tuxedo dinner jacket, a muted dusty mauve-purple waistcoat, a white dress shirt with small black studs and a black bow tie, black trousers, black shoes, bare empty hands, his arms held well out from his sides at about 35 degrees so that clear white background shows between each sleeve and the side of his jacket all the way from the armpit to the wrist, and a clear gap between his legs. ${BODY}` },
  cousinnicky: { height: 1.8, prompt: `Cousin Nicky from Rick and Morty: a big, hulking, thick-set man from Brooklyn with a boxy barrel chest, broad square shoulders, a wide blocky torso and huge thick upper arms nearly as wide as his head, fairly short sturdy legs, a long face and long chin, a high receding hairline, black hair slicked back into long thick sideburns down to his jaw, clean-shaven, heavy-lidded eyes and a smug half-smile, in a very pale mint-blue sleeveless shirt with a big popped collar, open at the chest showing chest hair, tucked into grey trousers with a black belt and a flat rectangular brass plate buckle, hairy shoulders and forearms, black shoes, his thick arms held out clear of his sides and a clear gap between his legs. ${BODY}` },
  frankenstein: { height: 2.1, prompt: `Frankenstein's monster as drawn in Rick and Morty: a tall heavy monster with pale sage-green skin, very broad square boxy shoulders, a flat-topped square head, black hair with a short jagged fringe, a short stitched scar on one side of his forehead, two grey metal bolts in his neck, heavy-lidded pale yellow eyes with dark grey-blue rings under them and a frowning downturned mouth, in a loose boxy dark charcoal olive-grey jacket reaching the tops of his thighs, buttoned closed down the front with two buttons, with small lapels and a V opening at the neck showing a near-black crew-neck shirt, the jacket's sleeves stopping a little short of the wrists, wide straight very dark green-black trousers falling over big rounded black thick-soled ankle boots, his arms held clear of his sides and a clear gap between his legs. ${BODY}` },
  reversegiraffe: { rig: false, prompt: `Reverse Giraffe from Rick and Morty: a cartoon giraffe standing upright like a person on just two short hind legs with dark brown hooves, its body an extremely long, thin, straight vertical pole of even width, taller than a man, rising straight up from those two hind legs with no belly, no rump and no other legs, pale yellow with soft tan-brown patches and a thin brown mane running down its back, two thin front legs bent at the elbow like arms, with dark brown hooves, sticking out of the front of the pole at the very top just below the head, only four limbs in all, a very short neck and a full-size giraffe head with big ears, two short horns with olive knobs, big round white eyes with tiny black pupils, a few wrinkle lines across the brow and an olive-tan muzzle, the whole tall figure in frame from horns to hooves. ${PROP}` },
  ghostinajar: { rig: false, prompt: `Ghost in a Jar from Rick and Morty: a tall clear glass mason jar with rounded shoulders and a shiny gold screw lid, and inside it, filling most of the jar, a glowing green translucent ghost with a round domed head, dots for eyes, a simple smiling line mouth, two stubby arms each with just a thumb, and a wavy lower edge. ${PROP}` },
  photographyraptor: { rig: false, prompt: `Photography Raptor from Rick and Morty: a velociraptor standing on its two hind legs with a slightly rounded belly, smooth olive-brown skin with dark brown stripes across its back, neck and tail and a few dark brown spots, olive-green patches round the eyes and on the snout, a pale cream lower jaw, throat, chest and belly, big round yellow eyes with a thin green slit pupil, a long tail, long thin arms with clawed hands, its mouth closed in a smug smile curving up along its long pale cream lower jaw, no teeth showing, three-toed clawed feet with a big curved claw, no clothes, standing with one clawed hand resting on an old-fashioned wooden bellows camera with a brass lens on a wooden tripod beside it, the tripod's three legs fully in view and apart from the raptor's legs. ${PROP}` },
  tinkles: { rig: false, prompt: `Tinkles from Rick and Morty: a little fluffy white lamb standing upright on her two hind legs with her front legs held out like little arms, her face looking straight ahead, a unicorn horn of stacked spiral rings in red, orange, yellow and green with blue at the tip in the middle of her forehead, white ears with pink insides, a round light pink muzzle on the front of her face with two nostrils and a small open smiling mouth, huge glossy eyes with teal-blue irises round very large black pupils with white highlights and thick black upper lash lines with long lashes, light pink hooves and a fluffy light pink tail, a fluffy curly very pale pink, almost white tuft of hair on top of her head, a thin gold tiara with a row of small pink beads and a pink gem at the front of the tuft, a pale lavender tutu at her waist, knee socks striped blue, white, green and yellow. ${PROP}` },
  babywizard: { rig: false, prompt: `Baby Wizard from Rick and Morty: a chubby pale baby standing barefoot and bare-chested, wearing only a plain blue cloth diaper with no tabs, covered in yellow stars and crescent moons, and a tall pointed periwinkle-blue wizard's hat with yellow stars and crescent moons and a thick rolled white brim, worn tipped back on his head, its long tapering tip pointing back and drooping to one side, not curled, big round white eyes with small dot pupils, no beard, both hands empty and open at his sides, nothing in his hands. ${PROP}` },
  mrsrefrigerator: { rig: false, prompt: `Mrs. Refrigerator from Rick and Morty: a tall pale lavender two-door refrigerator standing upright, light blue door handles on the left, a woman's face on the top door with big round white eyes with tiny dot pupils, long lashes, pink eyeshadow and full pink lips, no nose, a swept dark mauve hair fringe under a dusty pink headscarf with white polka dots wrapped round the top and knotted in a bow on top, a heart note, a carrot magnet and a blank note on the lower door, a plain straight rectangular coral-pink apron with a waistband and a white band near the hem hanging down the front of the lower door, two thin pale lavender arms sticking out from the left and right sides just above the apron's waistband, both clearly visible and held out a little away from the body, with open hands and a pink and a yellow bangle on the right wrist, and two short legs in blue flat shoes. ${PROP}` },
};
const PHASE6 = {
  'spacebeth-ship': { rig: false, hero: true, prompt: `Space Beth's spaceship from Rick and Morty: a battered rounded saucer-like hull in slate grey-green, a mustard-yellow panel across the front of the nose carrying a pale grey hatch plate and a long row of orange-lit slot lights, a thin vertical cyan light strip down the front beside it, a large clear glass bubble cockpit dome with four empty seats, two rust-red engine pods with dark louvred intakes flanking the dome, a big black ring-shaped turbine standing upright on top at the back with copper coils inside the ring, long straight rust-red wings with olive patches and a tall dark red fin at the left wingtip, a yellow-and-black striped gun barrel under the right wing, two dark grey landing legs under the front of the hull, each ending in a curved hooked claw. The whole ship inside the picture with white space past both wingtips. ${PROP}` }, // (confirm against the sheet)
  'jerry-ship': { rig: false, prompt: `Jerry's car turned into a spaceship by Rick, from Rick and Morty: a long boxy pale green 1980s four-door station wagon with brown wood-grain panels along its sides, a roof rack, square twin headlights, a chrome grille and bumpers and grey hubcaps, with two identical flat grey metal wings held level, one folded out from each side of the body below the doors, both wings in view, and grey rocket thrusters at the back. Seen a little from above so that both wings show, the whole vehicle and both wingtips inside the picture. ${CAR}` },
  'gotron-ferret': { rig: false, hero: true, prompt: `A Gotron ferret robot from Rick and Morty: a giant mecha shaped like a long, low, sleek ferret built like a sports car, about four times as long as it is tall, glossy red armour plates joined by white-silver segmented joints, an angular armoured mecha head like the front of a car rather than an animal face, with a red armoured top, a teal glass cockpit windscreen on top of the head, narrow angular glowing yellow eyes like headlights, small angular ear pods with teal glass, a white-silver lower face and jaw with slanted vents and a zigzag edge, and a small red triangular nose gem, no animal nose, no fur, no whiskers, a raised hatch with small teal lights along its back, big round black wheels with white hubs at its hips and shoulders on four short stubby legs, a long curving white-silver segmented tail. ${PROP}` },
  gotron: { rig: false, hero: true, prompt: `The combined Gotron mecha from Rick and Morty: a towering humanoid super robot assembled from five identical ferret robots, a black boxy torso with a red collar and a gold chevron chest plate holding a red shield with a glowing pale cyan G emblem, a short red pointed panel below the shield, a white segmented waist with a black belt and gold buckle, two long red-and-white wings rising behind the shoulders in a V, a black helmet with a gold brow, glowing yellow eyes and a white faceplate, white segmented upper arms and thighs, each forearm a whole long ferret robot reaching down to mid-thigh with black wheels on its sides, red on the right arm and yellow on the left, the ferret's head at the end in place of the hand, with no robot hand or fist, each shin a whole ferret robot with black wheels on its sides, blue on the right and green on the left, its head forming the foot and facing forwards, every ferret head an angular armoured mecha head like the front of a car, with a teal glass windscreen on top, narrow glowing yellow eyes, a small red nose gem and a white-silver jaw with a zigzag edge, not a furry animal face, standing straight with the arms hanging a little away from the body. ${PROP}` },
  'zigerion-ship': { rig: false, hero: true, prompt: `The Zigerion mothership from Rick and Morty: a huge dark green spaceship shaped like a dumbbell, two giant thick disc-shaped hulls side by side joined by a short boxy central hull, each disc rimmed with large glowing lime-green crescent windows and a ringed hub on its outer face with spiky barrels sticking out, teal light strips all over the hull, a flat top deck with a low boxy deckhouse and tall thin antenna spires tipped with red lights, a stepped underside ending in hanging spires. ${PROP}` }, // (confirm against the sheet "Zigerions")
  storytrain: { rig: false, hero: true, prompt: `The Story Train from Rick and Morty: a long streamlined science-fiction locomotive in gold, amber and copper, its nose sweeping forward and down from the cab roof to a low rounded point, a tall ridged cream prow running down the middle of the sloping nose from just under the windscreen to the tip, a small red-rimmed round lamp at the top of the prow just under the windscreen, a pale cab windscreen on top, one big glowing round headlamp set in a gold ring on each flank of the engine just behind the nose and no other headlamps, a low copper slatted cowcatcher, dark red spoked wheels underneath, hauling exactly three passenger carriages, the first dark red, the second brown and the third black, with warm lit windows and glowing gold couplings, no text. ${PROP}` },
};
// the small props, whose textures the plan keeps to 1024 pixels
const SMALL = new Set(['snuffles', 'ghostinajar', 'tinkles', 'babywizard']);
export const ASSETS = {};
for (const [phase, set] of [
  [2, PHASE2],
  [6, PHASE6],
]) {
  for (const [n, a] of Object.entries(set)) ASSETS[n] = { phase, rig: true, poly: a.hero ? 40000 : 30000, tex: SMALL.has(n) ? 1024 : 2048, ...a };
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
const CHAIN = ['image', 'use', 'model', 'rig', 'idle', 'sit'];

// the picture `use` chose (mirrored left to right if asked), as a data URI
// Meshy takes in place of the image task
async function picked(n) {
  const { file, flip } = tasks[n].use;
  const img = sharp(join(REVIEW, file));
  const png = await (flip ? img.flop() : img).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
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
          ...(tasks[n].use ? { image_url: await picked(n) } : { input_task_id: tasks[n].image }),
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
  // the model as Meshy made it, untouched, for judging from all round
  // (scripts/glb-shot.mjs) before paying for the rig
  async look(names) {
    for (const n of names) {
      if (!tasks[n]?.model) {
        console.error(`! ${n}: no model yet`);
        continue;
      }
      const t = await api('GET', `/v1/image-to-3d/${tasks[n].model}`);
      await download(t.model_urls.glb, join(REVIEW, `${n}-model.glb`));
      console.log(`look     ${n.padEnd(18)} lab/meshy/rm/${n}-model.glb`);
    }
  },
  async use([n, file, how]) {
    if (!file || !existsSync(join(REVIEW, file))) throw new Error(`use <name> <png in lab/meshy/rm/> [flip]`);
    if (tasks[n]?.model) throw new Error(`${n} already has a model: reroll models ${n} first`);
    tasks[n] = { ...tasks[n], use: { file, flip: how === 'flip' } };
    await save();
    console.log(`use      ${n.padEnd(18)} its model will be made from ${file}${how === 'flip' ? ', mirrored' : ''}`);
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...rest] = process.argv.slice(2);
  const forget = step === 'reroll' ? rest.shift() : null;
  if (!steps[step] && !forget) throw new Error(`step: ${Object.keys(steps).join(' | ')} | reroll <step> <name …>`);
  if (step === 'use') {
    if (!ASSETS[rest[0]]) throw new Error(`unknown asset ${rest[0]}`);
    tasks = await json(TASKS);
    return steps.use(rest);
  }
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
