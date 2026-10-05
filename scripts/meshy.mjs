// Makes Portal panic's cast, enemies and set pieces, and the Scranton office's
// people, with Meshy (meshy.ai), the site owner's account: a concept image for
// each, then a textured model from the image, then (for the ones that walk on
// two legs) a skeleton with walking and running clips. Output is compressed
// for the web into public/games/meshy/ (the office's people: their skeleton
// and no clips, the browser sits them down, into public/models/office/cast/)
// and credited in public/games/credits.json. The output is committed, so the
// site never calls Meshy.
//
// Roll out's Autobots, Decepticons and bosses are a set of their own
// (realistic, with PBR textures: metalness, roughness and normal maps) into
// public/games/meshy/rollout/, listed in its index.json, which is how the
// game knows what's there; a vehicle that comes out backwards gets
// { "name": …, "yaw": 180 } there in place of its name.
//
// The Avengers HQ games' models are another (photoreal, PBR): Smash Run's
// Hulk, Chitauri, cars, chariot and wall pylon, and Thanos for Titan, into
// public/hq/meshy/ with a manifest.json the games read.
//
// The C-137 world's set: the Smiths (rigged, with clips) go to public/games/meshy/
// beside Rick and Morty; the house, school, arcade and cabinet to public/models/c137/.
//
//   node --env-file=.env.local scripts/meshy.mjs <step> [name … | portal | office | rollout | hq | c137]
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
import { reatlas } from './reatlas.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'meshy');
const OFFICE_OUT = join(ROOT, 'public', 'models', 'office', 'cast');
const ROLLOUT_OUT = join(OUT, 'rollout');
const HQ_OUT = join(ROOT, 'public', 'hq', 'meshy');
const C137_OUT = join(ROOT, 'public', 'models', 'c137');
const REVIEW = join(ROOT, 'lab', 'meshy'); // concept images, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';
const BUILDING = 'The whole building, three-quarter front view from slightly above, centred, no people.';
const CAR = 'The whole vehicle, three-quarter front view, centred, wheels on the ground.';
const REAL = 'A photorealistic hard-surface 3D render in the style of the live-action Transformers films: painted metal armour plates with panel lines and light wear, chrome and dark steel mechanical detail, readable silhouette. Plain white background, no text, no shadow.';
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
  // the C-137 world: the Smiths, their house, the school, Blips and Chitz, Roy's cabinet
  summer: { rig: true, height: 1.6, poly: 12000, tex: 1024, set: 'c137', prompt: `Summer Smith from Rick and Morty: a slim 17-year-old girl with orange hair pulled back into a high ponytail, a hot pink sleeveless tank top, blue jeans and white sneakers. ${BODY}` },
  beth: { rig: true, height: 1.68, poly: 12000, tex: 1024, set: 'c137', prompt: `Beth Smith from Rick and Morty: a woman in her thirties with blonde hair in a short bob, a red long-sleeved top, white trousers and brown flat shoes. ${BODY}` },
  jerry: { rig: true, height: 1.78, poly: 12000, tex: 1024, set: 'c137', prompt: `Jerry Smith from Rick and Morty: a man in his late thirties with short swept brown hair and a sulky look, a dark olive-green polo shirt tucked in with a brown belt, light blue jeans and dark grey shoes. ${BODY}` },
  'smith-house': { rig: false, poly: 18000, tex: 1024, set: 'c137', prompt: `The Smith family's house from Rick and Morty, as seen from the street: a wide, low suburban house with cream stucco walls, a dark red brick base along the bottom of the walls, and brown shingled roofs. From left to right: a single-storey two-car garage wing standing forward of the rest, with a steep front-facing gable roof, a big tan garage door in four panels, and a white basketball backboard with a red hoop on the gable above the door; then a single-storey middle section set back, with a wide window in brown frames and a brown wooden front door under a small pointed gabled porch roof, and a satellite dish on its roof; then a two-storey wing on the right with a hipped brown roof, a wide upstairs window opening onto a small balcony with a wooden railing that sits on a little shingled roof over the wide downstairs window, and a red brick planter of green bushes along its front. A green garden hose reel on the wall to the right of the door, a potted plant to the left of it. ${BUILDING}` },
  school: { rig: false, poly: 18000, tex: 1024, set: 'c137', prompt: `Harry Herpson High School from Rick and Morty: a 1960s American public high school of red-brown brick with a cream band along the top of the walls and flat roofs with grey air-conditioning units on them. In the middle, a taller entrance block of brick with a blank brick panel above a flat cream canopy over glass double doors with tall glass side panels; to the left, a long single-storey wing with big many-paned windows; to the right, a two-storey wing with rows of smaller windows. Green bushes along the front, no text, no flag. ${BUILDING}` },
  arcade: { rig: false, poly: 14000, tex: 1024, set: 'c137', prompt: `Blips and Chitz from Rick and Morty: an alien arcade building on another planet with rounded purple and teal walls, glowing neon tubes, a big arched entrance and a blank sign board over the door. ${BUILDING}` },
  'roy-cabinet': { rig: false, poly: 8000, tex: 1024, set: 'c137', prompt: `The Roy virtual reality arcade machine from Rick and Morty: a sci-fi VR arcade cabinet, a reclining padded chair under a hooded console with a VR headset hanging from a cable and a glowing green screen. ${PROP}` },
  // the President's visit, the Galactic Federation and Shoney's
  president: { rig: true, height: 1.88, poly: 12000, tex: 1024, set: 'c137', prompt: `The President of the United States from Rick and Morty: a tall broad-shouldered Black man in his fifties with short black hair greying and receding at the temples, a stern square face with heavy brows, in a dark navy two-button suit, a white shirt, a red tie and black shoes. ${BODY}` },
  fedagent: { rig: true, height: 1.9, poly: 10000, tex: 1024, set: 'c137', prompt: `A Galactic Federation agent from Rick and Morty: a Gromflomite, a thin insect man with a pale olive-green fly head, two big orange-red compound eyes with a dark grid on them, two short antennae with knobs, a small mouth with little mandibles and wispy tendrils hanging from the chin, thin pale green hands with long fingers, wearing a black suit, a white shirt, a dark teal tie, a small silver triangle pin on the lapel and black shoes. ${BODY}` },
  general: { rig: true, height: 1.82, poly: 10000, tex: 1024, set: 'c137', prompt: `A US Army general from Rick and Morty: a stern bald middle-aged white man with a lined face, in a dark olive-green army dress uniform jacket with brass buttons, rows of coloured medal ribbons on the chest and gold insignia on the collar, a pale green shirt, a black tie, dark green trousers and black shoes. ${BODY}` },
  secretservice: { rig: true, height: 1.84, poly: 10000, tex: 1024, set: 'c137', prompt: `A Secret Service agent from Rick and Morty: a square-jawed man with short dark brown hair, black sunglasses and a curly earpiece wire behind his ear, in a black suit, a white shirt, a black tie and black shoes. ${BODY}` },
  limo: { rig: false, poly: 12000, tex: 1024, set: 'c137', prompt: `The US President's black armoured limousine as drawn in Rick and Morty: a long heavy glossy black stretch car with dark tinted windows, chrome grille and trim, and two small American flags on short poles above the front wheels. ${CAR}` },
  fedship: { rig: false, poly: 14000, tex: 1024, set: 'c137', prompt: `A Galactic Federation patrol ship from Rick and Morty: a big rounded dark green armoured capsule like an upright egg seen front-on, a tall glass canopy strip running up its middle, rows of round glowing green lights along its top, round red lights on each side, two bulging pale green engine pods low on the left and right with glowing green jets underneath, and a black mechanical insect-like snout with mandibles at the front bottom. ${PROP}` },
  shoneys: { rig: false, poly: 16000, tex: 1024, set: 'c137', prompt: `The Shoney's family restaurant from Rick and Morty: a single-storey American roadside diner with pale yellow stucco walls, a dark brown shingled hip roof with a red trim along the eaves and a front gable over the door, glass double doors in the middle, wide windows along the front each under a red and white striped awning, small green shrubs in red planters, and a tall pole sign with a yellow board framed in red. No text. ${BUILDING}` },
};

// Roll out (Transformers): each Autobot and Vehicon twice, as the vehicle and
// as the robot (the game changes one into the other); the jets; the bosses.
const ROLLOUT = {
  optimus: { rig: true, height: 2.7, poly: 16000, tex: 768, prompt: `Optimus Prime, the Autobot leader from Transformers: a tall heroic robot, his red chest built from a truck cab with two windscreen panels, a chrome grille on his abdomen, blue arms and legs with wheels at the calves, chrome exhaust stacks rising behind his shoulders, a blue helmet with two antennae, a silver faceplate and glowing blue eyes. ${BODY}` },
  'optimus-truck': { rig: false, poly: 12000, tex: 768, prompt: `Optimus Prime's vehicle mode from Transformers: a red and blue cab-over semi truck with no trailer, a tall chrome grille and bumper, two chrome exhaust stacks behind the cab and amber roof lights. ${CAR}` },
  bumblebee: { rig: true, height: 2.55, poly: 14000, tex: 768, prompt: `Bumblebee from Transformers: a compact agile robot in yellow armour with black racing stripes, two car doors on his back like wings, a round black and yellow helmet with two short horns and glowing blue eyes, a blaster on his right forearm. ${BODY}` },
  'bumblebee-car': { rig: false, poly: 12000, tex: 768, prompt: `Bumblebee's vehicle mode from Transformers: a yellow modern muscle car with two black racing stripes over the hood, roof and trunk. ${CAR}` },
  vehicon: { rig: true, height: 2.6, poly: 9000, tex: 512, prompt: `A Vehicon trooper from Transformers Prime: a lean faceless Decepticon soldier robot in dark gunmetal armour with purple trim, one red visor across the face, a blaster on the right arm. ${BODY}` },
  'vehicon-car': { rig: false, poly: 8000, tex: 512, prompt: `A Vehicon's vehicle mode from Transformers Prime: a dark gunmetal four-door sports sedan with purple trim and a purple Decepticon emblem on the hood. ${CAR}` },
  seeker: { rig: false, poly: 8000, tex: 512, prompt: `A Decepticon seeker jet from Transformers: a dark grey fighter jet with swept wings, twin tail fins and purple Decepticon emblems on the wings. ${PROP}` },
  starscream: { rig: false, poly: 12000, tex: 512, prompt: `Starscream's jet mode from Transformers: a silver-grey stealth fighter jet with red and blue markings on the wings and a purple Decepticon emblem. ${PROP}` },
  shockwave: { rig: true, height: 8, poly: 16000, tex: 512, prompt: `Shockwave from Transformers: a towering purple Decepticon robot with one round glowing yellow eye in a smooth helmet with two horn-like antennae, a huge cannon in place of his left hand, dark grey limbs. ${BODY}` },
  megatron: { rig: true, height: 8, poly: 16000, tex: 512, prompt: `Megatron, the Decepticon leader from Transformers Prime: a towering gunmetal-grey robot with jagged spiked armour, a bucket-shaped helm, glowing red eyes and a fusion cannon on his right forearm. ${BODY}` },
};
for (const [n, a] of Object.entries(ROLLOUT)) ASSETS[n] = { ...a, set: 'rollout', style: REAL, pbr: true };

// The Avengers HQ games' models: photoreal, like the rest of the HQ. Hulk and
// the Chitauri are described rather than named (Meshy turns down named
// characters).
const HQ_STYLE = 'Photorealistic, like a still from a big-budget live-action film: physically accurate materials and natural light. Plain white background, no text.';
const HQ_BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const HQ_PROP = 'The whole object on its own, three-quarter front view, centred.';
// h: how tall (or long, for a car) the game draws it, in metres
const HQ = {
  hulk: { rig: true, height: 2.6, h: 2.6, poly: 20000, tex: 1024, prompt: `A towering green-skinned giant of a man, about eight and a half feet tall and impossibly muscular: huge shoulders and trapezius rising to his ears, thick arms ending in big fists, a broad deep chest, a short thick neck, a small head with short messy black hair, a heavy brow and an angry scowl. Torn, ragged dark purple trousers cut off below the knee, bare feet, nothing else. ${HQ_BODY}` },
  chitauri: { rig: true, height: 1.95, h: 1.95, poly: 12000, tex: 1024, prompt: `An alien foot soldier of a warlike invading army: grey, wrinkled, leathery skin fused with segmented dark bronze and gunmetal biomechanical armour plates, a narrow armoured head with a jutting jaw and small pale glowing blue eyes, long thin limbs, clawed hands, armoured feet. No weapon. ${HQ_BODY}` },
  taxi: { h: 5.2, poly: 12000, tex: 1024, prompt: `A New York City yellow taxi cab from 2012: a full-size four-door American sedan in taxi yellow with a lit roof sign, dusty and dented after a battle in the street. ${HQ_PROP}` },
  police: { h: 5.2, poly: 12000, tex: 1024, prompt: `A New York police patrol car from 2012: a full-size four-door American sedan, white with blue stripes down the sides and a red and blue lightbar on the roof, dusty and dented. ${HQ_PROP}` },
  sedan: { h: 4.9, poly: 12000, tex: 1024, prompt: `An ordinary dark red four-door American sedan from around 2010, dusty, its windscreen cracked and a door dented. ${HQ_PROP}` },
  suv: { h: 5.1, poly: 12000, tex: 1024, prompt: `A black full-size American SUV from around 2010, dusty, the bonnet dented and a side window shattered. ${HQ_PROP}` },
  chariot: { h: 5.5, poly: 12000, tex: 1024, prompt: `An alien flying war sled: a long narrow armoured hovercraft of segmented dark bronze and gunmetal biomechanical plates, a pointed prow, a small open standing deck with a handrail at the back, two glowing blue jet engines under its tail. No rider. ${HQ_PROP}` },
  // Titan: the warlord himself (the gauntlet stays modelled in code: its sockets are the game's)
  thanos: { rig: true, height: 2.8, h: 2.8, poly: 24000, tex: 2048, prompt: `A towering, massively built alien warlord about nine feet tall, with wrinkled purple-grey skin, a bald head, a heavy brow and a broad chin deeply ridged with vertical grooves, small hard eyes; a dark navy sleeveless armoured tunic with gold shoulder plates, a gold harness crossing his chest and back, and a broad gold belt; bare, heavily muscled purple arms; dark trousers and armoured boots. ${HQ_BODY}` },
  pylon: { h: 4.4, poly: 8000, tex: 512, prompt: `A tall alien biomechanical energy pylon, about four metres high: a tapering column of segmented dark bronze and gunmetal armour plates with fins up its back, clawed feet at its base, and a glowing violet crystal at its top. ${HQ_PROP}` },
};
for (const [n, a] of Object.entries(HQ)) ASSETS[n] = { ...a, set: 'hq', style: HQ_STYLE, pbr: true };

// The Citadel of Ricks' people (src/components/rickmorty/citadel/): three
// of the Council, Cowboy Rick, a Simple Rick's worker and Cop Morty, in the
// show's style like the portal cast, and written beside it.
const RICK = 'Rick Sanchez from Rick and Morty, a tall thin old scientist with spiky pale blue-grey hair and a unibrow';
const CITADEL = {
  'councilrick-a': { height: 1.8, prompt: `A member of the Council of Ricks: ${RICK}, in a long formal white ceremonial robe with a tall stiff high collar, gold trim down the front and a gold chain of office across his shoulders. ${BODY}` },
  'councilrick-b': { height: 1.8, prompt: `A member of the Council of Ricks: ${RICK}, with a long grey beard and his hair in a ponytail, in dark navy blue formal robes with silver trim and silver shoulder plates. ${BODY}` },
  'councilrick-c': { height: 1.8, prompt: `A member of the Council of Ricks: a version of Rick Sanchez from Rick and Morty who is completely bald with a pointed grey goatee and a unibrow, in a white high-collared military dress coat with gold epaulettes, a red sash and dark trousers. ${BODY}` },
  cowboyrick: { height: 1.8, prompt: `Cowboy Rick from the Citadel of Ricks: ${RICK}, wearing a brown cowboy hat, a brown leather vest over a white shirt, a red bandana round his neck, blue jeans, a belt with a big silver buckle and brown cowboy boots. ${BODY}` },
  factoryrick: { height: 1.8, prompt: `A worker at the Simple Rick's wafer factory in the Citadel of Ricks: ${RICK}, with a tired face, a white hairnet over his hair, a pale blue factory jumpsuit with a small name patch, and black work boots. ${BODY}` },
  // and the Ricks of the crowd, as the show's commuter train has them
  constructionrick: { height: 1.8, prompt: `A construction worker from the Citadel of Ricks: ${RICK}, in an orange work jumpsuit with a small name badge and a brown belt, an orange hard hat with a yellow stripe, black work boots. ${BODY}` },
  sweaterrick: { height: 1.8, prompt: `A Rick from the Citadel of Ricks: ${RICK}, in a red cardigan sweater over a yellow collared shirt, a stethoscope round his neck, brown trousers and brown shoes. ${BODY}` },
  suitrick: { height: 1.8, prompt: `An office-worker Rick from the Citadel of Ricks: ${RICK}, in a light blue business suit, a white shirt, a navy blue tie and black shoes. ${BODY}` },
  detectiverick: { height: 1.8, prompt: `A detective Rick from the Citadel of Ricks: ${RICK}, in a long brown checked trench coat, a brown fedora hat, a red scarf, dark trousers and brown shoes. ${BODY}` },
  copmorty: { height: 1.5, prompt: `Cop Morty from the Citadel of Ricks in Rick and Morty: Morty Smith, a 14-year-old boy with short brown hair and a round head, wearing a navy blue police uniform, a navy police cap with a gold badge, a black duty belt and black shoes. Arms hanging down and a little away from the body, hands open and relaxed. ${BODY}` },
};
for (const [n, a] of Object.entries(CITADEL)) ASSETS[n] = { ...a, set: 'citadel', rig: true, poly: 14000, tex: 1024 };

// The rest of the crowd: variants that only ever stand in it, so they're
// modelled standing at ease and never rigged (scripts/crowd.mjs takes them
// as they are). Described, not named: Meshy turns down named characters.
const AT_EASE = 'Full body, front view, standing at ease with the arms hanging down by the sides, empty hands, feet together.';
const MORTY = 'Morty Smith from Rick and Morty, a nervous 14-year-old boy with short brown hair and a round head';
const CROWD_ONLY = {
  wizardrick: `A wizard Rick from the Citadel of Ricks: ${RICK}, with a long grey beard, in long flowing grey robes, a tall pointed grey wizard's hat with a wide brim, a grey scarf, holding nothing. ${AT_EASE}`,
  hazmatrick: `A chemist Rick from the Citadel of Ricks: ${RICK}, in a yellow hazmat coat with a hood down, a small black pork-pie hat, thin glasses and a short grey goatee, dark trousers. ${AT_EASE}`,
  sheriffrick: `A sheriff Rick from the Citadel of Ricks: ${RICK}, with stubble, in a tan sheriff's deputy shirt with a gold star badge, a brown belt with an empty holster, brown trousers and boots, dusty and tired. ${AT_EASE}`,
  retrorick: `A retro-future Rick from the Citadel of Ricks: ${RICK}, with bright orange spiky hair, in a white space-age tunic with black stripes across the chest, blue trousers and white boots. ${AT_EASE}`,
  visorrick: `A cyborg Rick from the Citadel of Ricks: ${RICK}, with a black and green electronic visor across his eyes, in a white high-collared jumpsuit with grey panels. ${AT_EASE}`,
  doofusrick: `Doofus Rick from Rick and Morty: Rick Sanchez with spiky pale blue-grey hair, a goofy friendly smile and a slight underbite, in a white lab coat over a light blue shirt with a brown stain, brown trousers. ${AT_EASE}`,
  hobbitmorty: `A Morty from the Citadel: ${MORTY}, dressed as a little hobbit in a dark green hooded cloak with a leaf brooch, a brown waistcoat over a white shirt, brown breeches, barefoot. ${AT_EASE}`,
  beaniemorty: `A Morty from the Citadel: ${MORTY}, in a grey knitted beanie, a baggy black hoodie over a yellow T-shirt, loose blue jeans and white sneakers. ${AT_EASE}`,
  sheriffmorty: `A Morty from the Citadel: ${MORTY}, in a brown wide-brimmed sheriff's hat, a khaki shirt, a brown vest, blue jeans and brown boots. ${AT_EASE}`,
  overallsmorty: `A Morty from the Citadel: ${MORTY}, in green overalls over a yellow T-shirt, a small green flat cap, and green shoes. ${AT_EASE}`,
  mulletrick: `A Rick from the Citadel of Ricks: ${RICK}, with his hair grown into a long spiky mullet at the back, aviator sunglasses, a sleeveless denim vest over a white tank top, ripped jeans and cowboy boots. ${AT_EASE}`,
  chefrick: `A cook Rick from the Citadel of Ricks: ${RICK}, in white chef's whites with a double row of buttons, a tall white chef's hat, a checked neckerchief, black and white checked trousers. ${AT_EASE}`,
  pilotrick: `A pilot Rick from the Citadel of Ricks: ${RICK}, in an olive green flight suit with patches and many zipped pockets, brown leather aviator goggles pushed up on his forehead, black boots. ${AT_EASE}`,
  punkrick: `A punk Rick from the Citadel of Ricks: ${RICK}, his spiky hair dyed bright pink, in a black leather jacket with studs over a torn band T-shirt, black jeans with chains and heavy black boots. ${AT_EASE}`,
  maskmorty: `A Morty from the Citadel: ${MORTY}, wearing a pale blue surgical face mask, a yellow T-shirt, blue jeans and white sneakers. ${AT_EASE}`,
  glassesmorty: `A Morty from the Citadel: ${MORTY}, with big round thick glasses, in a short-sleeved white shirt with a pocket protector, a red tie, brown trousers and brown shoes. ${AT_EASE}`,
  astronautmorty: `A Morty from the Citadel: ${MORTY}, in a white and orange astronaut suit with a round glass helmet tucked under one arm, white boots. Full body, front view, standing at ease, feet together.`,
  punkmorty: `A Morty from the Citadel: ${MORTY}, his brown hair in a tall green mohawk, in a black sleeveless denim vest covered in badges over a yellow T-shirt, black jeans and red sneakers. ${AT_EASE}`,
};
// (the lighter image model: as good for these, at a fraction of the cost)
for (const [n, prompt] of Object.entries(CROWD_ONLY)) ASSETS[n] = { set: 'citadel', rig: false, poly: 9000, tex: 1024, image: 'nano-banana', prompt };

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

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
// A clip keeps only its skeleton and animation. A figure the browser poses
// (`posed`) loses its clips, and goes onto a new atlas of `tex` pixels. (Its
// triangles are left alone: the simplifier doesn't weigh the texture, and
// pulls the faces about.)
let io = null;
async function squeeze(from, to, { tex = 0, clip = false, posed = false, high = false } = {}) {
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
    await reatlas(doc, tex);
  }
  // (`high`: Roll out's, squeezed harder and without tangents, which three.js
  // works out per pixel for the normal map)
  if (high) for (const m of root.listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('TANGENT', null);
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: posed || high ? 'high' : 'medium' }));
  await io.write(to, doc);
}

const steps = {
  async images(names, s) {
    await each(names, async (n) => {
      const a = ASSETS[n];
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: a.image || 'nano-banana-pro', prompt: `${a.prompt} ${a.style ?? STYLE}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}), ...(a.aspect ? { aspect_ratio: a.aspect } : {}) });
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
          enable_pbr: Boolean(a.pbr),
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
    const fetched = new Set();
    // the HQ games' list of what's there
    const manifestFile = join(HQ_OUT, 'manifest.json');
    const made = existsSync(manifestFile) ? JSON.parse(await readFile(manifestFile, 'utf8')) : {};
    for (const n of names) {
      const a = ASSETS[n];
      const files = []; // [url, file, texture size, clip only, posed in the browser]
      const out = { office: OFFICE_OUT, rollout: ROLLOUT_OUT, hq: HQ_OUT, c137: a.rig ? OUT : C137_OUT }[a.set] ?? OUT;
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
        await squeeze(raw, join(out, file), { tex, clip, posed, high: a.set === 'rollout' && !clip });
      }
      if (a.set === 'rollout') fetched.add(n);
      if (a.set === 'hq') made[n] = { rig: !!a.rig, h: a.h };
      credits[a.set === 'hq' ? `hq/meshy/${n}` : `meshy/${a.set === 'rollout' ? 'rollout/' : a.set === 'c137' && !a.rig ? 'c137/' : ''}${n}`] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(12)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    if (names.some((n) => ASSETS[n].set === 'hq')) await writeFile(manifestFile, `${JSON.stringify(made, null, 2)}\n`);
    // Roll out's list of what's there
    if (fetched.size) {
      const index = join(ROLLOUT_OUT, 'index.json');
      const had = existsSync(index) ? JSON.parse(await readFile(index, 'utf8')) : [];
      const named = (e) => e?.name ?? e;
      const list = [...had, ...[...fetched].filter((n) => !had.some((e) => named(e) === n))];
      await writeFile(index, `${JSON.stringify(list.sort((x, y) => named(x).localeCompare(named(y))), null, 2)}\n`);
    }
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  // a set's name stands for its assets
  const sets = { portal: Object.keys(ASSETS).filter((n) => !ASSETS[n].set), office: Object.keys(ASSETS).filter((n) => ASSETS[n].set === 'office'), rollout: Object.keys(ROLLOUT), hq: Object.keys(HQ), c137: Object.keys(ASSETS).filter((n) => ASSETS[n].set === 'c137'), citadel: Object.keys(CITADEL), crowd: Object.keys(CROWD_ONLY) };
  const names = only.length ? only.flatMap((n) => sets[n] ?? [n]) : Object.keys(ASSETS);
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
