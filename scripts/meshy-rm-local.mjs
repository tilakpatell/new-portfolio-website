// Makes the local session's slice of the Rick and Morty multiverse plan
// (docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md) with
// Meshy, the site owner's account: Phase 2's people and props (Task 2.1) and
// Phase 6's vehicles (Task 6.1); and Phase 3's (Task 3.1), made the same way
// by the cloud session. Another session makes Phase 1 and is writing
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
//   node --env-file=.env.local scripts/meshy-rm-local.mjs <step> [name … | phase2 | phase3 | phase4 | phase6]
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
import { dedup, flatten, getBounds, meshopt, prune, resample, textureCompress, transformMesh } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4 } from 'three';
import { creditOf, slugOf } from './model-scout.mjs';

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
const FULL = join(ROOT, 'node_modules', '.cache', 'meshy-full'); // crowd-only figures, full size, for scripts/crowd.mjs
const TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const LEDGER = join(ROOT, 'scripts', 'rm-models.json');
const API = 'https://api.meshy.ai/openapi';

// as scripts/meshy.mjs has them
const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';
const BUILDING = 'The whole building, three-quarter front view from slightly above, centred, no people.';
const AT_EASE = 'Full body, front view, standing at ease with the arms hanging down by the sides, empty hands, feet together.';
const RICK = 'Rick Sanchez from Rick and Morty, a tall thin old scientist with spiky pale blue-grey hair and a unibrow';
const MORTY = 'Morty Smith from Rick and Morty, a nervous 14-year-old boy with short brown hair and a round head';
const CAR = 'The whole vehicle, three-quarter front view, centred, wheels on the ground.';

// The plan's Task 1.1 assets, made on the account in ~/.tilakverse.env (a
// task id only works on the account that made it). The prompts were put
// right against the wiki's sheets on 6 October: Birdperson's hood is dark
// olive with pale green spots over a cream ruff, his wings cream with olive
// tips, his boots ridged yellow; Squanchy is golden with a cream streak and
// heavy lids; Mar-Sha's extra arms grow from the sides of her head; Morty
// Jr.'s face is pale and only his arms are red; Unity has three antennae and
// three dots on her forehead; the Zigerions wear red with yellow collars.
// Gwendolyn is left out (the show's is a sex robot). Krombopulos Michael is a
// Sketchfab model (`uid`, CC BY, scouted and judged by the gate), rigged by
// Meshy: `bake` makes it ready, `rig` sends it.
const PHASE1 = {
  squanchy: { hero: true, height: 1.15, prompt: `Squanchy from Rick and Morty: a short scruffy cat-person standing upright on two legs, golden orange fur with spiky messy tufts on top of his head and a cream streak on his forehead, big pointed ears with cream insides, heavy half-closed droopy yellow eyes, a tiny blue nose, a cream muzzle with long scraggly whiskers, two small fangs and a little brown goatee tuft under his lip, a cream chest and cream paw tips, a bare thin tail with a brown tuft at its tip, wearing nothing but a small black bow tie. ${BODY}` },
  birdperson: { hero: true, height: 2.0, prompt: `Birdperson from Rick and Morty: a tall thin humanoid bird-man with pale peach skin and a bare chest and belly, a dark olive-grey feathered hood with pale green spots framing a long stern human face with a big hooked nose and heavy dark brows, a tuft of feathers on top of the hood, a ruff of pale cream feathers round his neck under a dark olive feathered mantle across the shoulders, a small yellow feather clasp at the chest, two huge pale cream eagle wings with dark olive tips folded down his back like a long cape to his ankles, yellow feathered gloves with white feather cuffs, a jagged brown loincloth skirt with a brown belt and an oval pale blue buckle, bare legs, ridged yellow-orange bird-foot boots with white feather tops. ${BODY}` },
  phoenixperson: { height: 2.05, prompt: `Phoenixperson from Rick and Morty: Birdperson rebuilt as a cyborg, a tall thin bird-man with his pale peach human face, a big hooked nose and heavy dark brows, one glowing red mechanical eye, a dark gunmetal plate shaped like three tall feathers on his head, huge wings of dark gunmetal steel blades folded down his back like a long cape, his chest, arms and legs rebuilt as dark grey robot armour with small red lights, a jagged brown loincloth skirt with a belt and an oval buckle, metal bird-foot boots. ${BODY}` },
  unity: { height: 1.75, prompt: `Unity from Rick and Morty, in her main host body: a slim woman with light blue skin, dark plum-purple hair swept to one side and back into a low ponytail, three thin light blue antenna stalks with round yellow tips standing up from the top of her head, three small teal dots on her forehead, thin rimless rectangular glasses over yellow eyes, coral pink lips, a pale pink pearl necklace, a raspberry-red blazer with pink lapels and pink cuffs over a cream top, a dark purple pencil skirt to the knee, dark magenta high heels. ${BODY}` },
  marsha: { height: 2.3, pose: false, prompt: `Mar-Sha, queen of the Gazorpian women from Rick and Morty: a tall stately woman with tan skin, a single dark blue unibrow, long straight dark blue hair with a straight fringe, a gold and yellow Egyptian-style headband with a red stripe at the front, two extra long thin tan arms growing out of the sides of her head where her ears would be and raised up beside it, two normal arms, a long white robe with long sleeves and a wide collar of yellow, gold and green segments, bare feet. ${BODY}` },
  mortyjr: { height: 2.0, pose: false, prompt: `Morty Jr. grown up, from Rick and Morty: a huge heavy-set half-alien man with a pale peach face, a unibrow, small grumpy eyes, an underbite with two big lower fangs, two huge muscular bright red arms growing out of the sides of his head, bright red hands, a small grey flat cap, a long dark charcoal overcoat with brown elbow patches over a dark olive-green shirt and a dark blue tie, dark grey trousers, white and brown shoes. ${BODY}` },
  krombopulos: { uid: '4d65b1da2fe54c5590aa8abc7c64bf83', turn: -Math.PI / 2, height: 1.9, as: 'Krombopulos Michael at Interdimensional Customs' },
  zigerion: { crowd: true, prompt: `A Zigerion from Rick and Morty: a tall thin bald alien with pink-purple skin, a big bulbous head swelling up and back with a few small spikes and two thin antennae on top, droopy-lidded yellow eyes, a long wide nose, a long neck, four arms, in a red spacefleet uniform tunic with a yellow collar and a small black triangle badge on the chest, black trousers, white boots. ${AT_EASE}` },
  'squanchy-house': { rig: false, hero: true, prompt: `Squanchy's house on Planet Squanch from Rick and Morty: a house built like a giant cat tree, three round carpeted platforms in beige and brown stacked on thick sisal-rope-wrapped posts, little ladders between them, a round carpeted den with a round door at the top, toy mice and balls hanging on strings, on a patch of red grass. ${BUILDING}` },
  'birdperson-house': { rig: false, hero: true, prompt: `Birdperson's home on Bird World from Rick and Morty: a tall tower house of smooth tan clay grown round a twisting tree trunk, round and oval windows, small balconies, a little wooden ladder, vines hanging down, and a wide flat umbrella-shaped canopy of pale green leaves on top like an acacia tree, no people. ${BUILDING}` },
};

// The plan's Task 5.1 assets, the Vindicators, on the ~/.tilakverse.env
// account. Put right against the wiki's stills on 6 October: Vance's
// emblem is orange on a pale blue chest plate, Supernova's helmet is silver
// with a crescent moon, Crocubot's tan crocodile head sticks out of a boxy
// robot body with a small robot head of its own on top, Noob-Noob's head is
// pale. The Sketchfab scout found none of them.
const PHASE5 = {
  vance: { hero: true, height: 1.85, prompt: `Vance Maximus, Renegade Starsoldier of the Vindicators from Rick and Morty: a lean man with spiky swept-up auburn-red hair, red stubble, a long chin and a cocky grin, in a fitted blue armoured battlesuit with dark blue panels and red stripes on the shoulders, a pale blue and white chest plate with an orange Vindicators emblem (a stylised V in a circle), armoured gauntlets and boots, a small jetpack on his back. ${BODY}` },
  supernova: { hero: true, height: 1.85, prompt: `Supernova of the Vindicators from Rick and Morty: a tall slim cosmic woman with lavender-purple skin, long flowing dark purple hair, glowing pale pink eyes with no pupils, a silver helmet-tiara with a crescent moon on top holding a small glowing orb, a skin-tight dark purple bodysuit patterned like a galaxy with tiny stars and swirls, short sleeves, bare lavender arms, dark purple boots. ${BODY}` },
  alanrails: { height: 2.0, prompt: `Alan Rails of the Vindicators from Rick and Morty: a big muscular Black man with a short black beard and a stern face, an old-fashioned grey train conductor's cap, a dirty black sleeveless greatcoat open over a dark green shirt, grey overalls with straps, grey work gloves, and a heavy glowing green chain with a train whistle hanging round his neck. ${BODY}` },
  millionants: { height: 1.9, prompt: `Million Ants of the Vindicators from Rick and Morty: a slim humanoid figure made entirely of a swarm of tiny dark red ants packed together into the shape of a man, a rough grainy dark red-brown surface with a few ants crawling off it, two dark hollow round eyes and a small hollow mouth, no clothes. ${BODY}` },
  crocubot: { height: 1.9, prompt: `Crocubot of the Vindicators from Rick and Morty: a cyborg crocodile standing upright, a tan-yellow crocodile head with a long toothy snout and a yellow eye sticking forward out of a boxy grey and pale blue robot body, a small grey cylindrical robot head with a red light and a camera lens on top of the body, a blue screen panel on the chest, grey robot arms and legs with round joints, one clamp hand, one scaly tan clawed arm, a short tan crocodile tail. ${BODY}` },
  noobnoob: { height: 1.1, prompt: `Noob-Noob of the Vindicators from Rick and Morty: a small skinny man with a tall narrow bullet-shaped pale peach head, a pink superhero mask round his big eyes, a wide open happy mouth with a few teeth, a pale pink short-sleeved top with lavender shoulders, pink briefs with a small white letter n on them over pale tights, a long purple cape, dark purple boots, pale skinny arms and legs. ${BODY}` },
  'vindicators-ship': { rig: false, hero: true, prompt: `The Vindicators' ship from Rick and Morty: a sleek superhero team's spaceship, a long white and dark blue hull with red and orange trim, swept-back wings, a domed cockpit at the front, a big circular orange Vindicators emblem on the side, twin blue-glowing engines at the back. ${PROP}` },
};

// The plan's Task 2.1 and 6.1 assets. Its prompts were checked against each
// one's wiki page and stills on 6 October (the plan's Step 1), and all but
// Snuffles's put right where the show differs: Rick Prime's boots and right
// shoulder pad, Tricia's over-the-knee socks, the Story Train streamlined
// and gold, the Zigerion ship a green dumbbell, and so on. hero: 40,000
// faces and Meshy's 2k geometry; sit: a seated clip too; rig: false for the
// props, creatures and vehicles (everything else is rigged, `height` in
// metres).
const PHASE2 = {
  // a Phase 1 figure Total Rickall needs (Task 2.3); the other session had not claimed him
  poopybutthole: { hero: true, sit: true, ankles: 'legs', height: 1.3, prompt: `Mr. Poopybutthole from Rick and Morty: a small thin pale yellow creature whose very tall sausage-shaped head, rounded at the top, is as long as all the rest of him below it; two big round white eyes with tiny black dot pupils, a long curved nose and a small smiling mouth; a tiny dark grey-blue top hat with a teal band perched on top of his head; a tight pale aqua short-sleeved T-shirt with stretch lines round the neck, dark grey-green shorts, long thin pale yellow arms and legs, white socks and burgundy-brown shoes, empty hands. ${BODY}` },
  spacebeth: { hero: true, sit: true, height: 1.68, prompt: `Space Beth from Rick and Morty: Beth Smith as a space fighter, a woman in her thirties with a lopsided hairstyle: the right side of her head (on the left of the picture) shaved to short blonde stubble, and her blonde hair swept over the top of her head to fall to her left shoulder (on the right of the picture), with a light blue streak in it; on the shaved side (the left of the picture) a silver ring piercing in her right eyebrow and a jagged purple scar running down across her right eye onto her cheek; a short very dark brown leather coat worn open, with grey-green lapels and grey-green turned-back cuffs on its sleeves, whose front ends at the top of her thighs and whose back ends at mid-thigh, well above the knees; under it a fitted dark grey-green combat suit with a high dark navy collar and a grey-green chest plate with a small red light in a round dark disc low on its front, just below the bust; a dark belt with a small orange light on the buckle, a dark strap round each thigh, and a small empty grey holster strapped to her right thigh (on the left of the picture); a grey device with small red and blue lights on her right forearm (also on the left of the picture), a bronze gauntlet on her left forearm (on the right of the picture), black fingerless gloves, and black boots reaching just below the knee with a pale grey turned-down cuff at the top. Last time the coat was drawn as a long duster hanging to her shins, with its back panel filling the gap between her legs. That was wrong: the coat stops at mid-thigh, so from the knees down only her grey-green suit and the boots show, with white background between her legs. ${BODY}` },
  rickprime: { hero: true, ankles: true, height: 1.85, prompt: `Rick Prime from Rick and Morty: a version of Rick Sanchez with greyer skin and no lab coat, dull pale blue spiky hair sticking up and out like Rick's, a unibrow, half-lidded cold eyes and a closed flat mouth, a dark navy zip-up sci-fi jacket reaching the hips with a high collar and a dark navy band at the hem, a lighter grey-purple panel running the whole front from collar to hem on both sides of the zip and edged with thin pale blue-grey piping, one short red stripe angled across each dark outer side of the chest and no other red anywhere on the jacket (no red slits or pockets lower down), lilac cuffs, over a dark red shirt, slim dark navy trousers and dark navy-grey mid-calf boots with a grey ankle strap and a thin red light strip on each. He has exactly two one-sided parts and BOTH are on the LEFT side of the picture (his right side), one above the other: a single grey armoured pad on his right shoulder (on the left of the picture), and below it an empty grey holster strapped to his right thigh (also on the left of the picture), hung from a grey strap belt that slants down to it from his left hip (on the right of the picture). His left shoulder (on the right of the picture) is plain navy jacket with no pad. Last time the shoulder pad was wrongly drawn on the right of the picture, on the opposite side from the holster; the pad and the holster must both be on the left of the picture. ${BODY}` },
  snuffles: { rig: false, prompt: `Snuffles from Rick and Morty: a small fluffy pure-white lap dog like a Maltese, standing on all four short legs, with a compact rounded body and a big round fluffy head almost as wide as his body; his white fur is soft and fluffy, its outline broken into a few little wispy pointed tufts on top of his head, on his big hanging shaggy ears, on his chest and down his legs, but his face is clean and smooth, with no beard, no moustache and no tufts or whisker strokes across his muzzle or cheeks; two big round black eyes set wide apart, each with one small white highlight, with two short worried brow lines above them; a tiny black button nose and under it a tiny closed mouth, just a short line down from the nose and a small curved line under it, the mouth not open; a thin wispy white tail held straight up behind him and clearly visible above his back; a light teal-blue collar with a round pale blue-silver tag hanging at the front. All of his fur, every leg included, is the same pure white, not cream, not grey and not blue-tinted, with no darker shading on the far legs. Last time the image model drew a scraggly cream-grey terrier with a bearded muzzle, a big nose, an open frowning mouth and a small head on a long body, and the time before a smooth plush dog with no tail; this time keep him pure white with a clean, cute face, a big round head, wispy tufts round his outline and his tail standing up. ${PROP}` },
  drwong: { sit: true, height: 1.72, prompt: `Dr. Wong from Rick and Morty: a tall slim middle-aged Chinese-American woman with a fair complexion and a long neck, a smooth black jaw-length bob with the ends curving in under the jaw and a heavy fringe swept from the left of the picture across her forehead to a side part on the right of the picture, large thick grey-rimmed square glasses, a short pale grey-beige knit cardigan of ordinary hip length that ends level with her crotch, at the very top of her thighs, buttoned from the chest down to its hem, with a wide light grey ribbed band running round the neck and down both front edges like a shawl collar, no lapels and no pointed collar, and ribbed cuffs, over a yellow long-sleeved top whose cuffs show at the wrists, a thick smooth white ring necklace close round the neck (one solid band, not beads), a thin dark belt with a square silver buckle cinched over the cardigan at the waist, black trousers and black flat shoes. Last time the cardigan was drawn knee-length like an overcoat, which is wrong. It must be short: both thighs and both knees show in black trousers below its hem, with white background between her legs from the crotch down. ${BODY}` },
  nancy: { sit: true, height: 1.6, prompt: `Nancy from Rick and Morty, face to the front: a tall lanky teenage girl with a very long narrow face, a long droopy nose, bright red lipstick and thin rectangular glasses. Long straight dark brown hair with a short thick fringe on the left of the picture ending in a few pointed strands; the rest hangs straight down her back, hidden behind her, so from the front no hair shows below her shoulders. White T-shirt tucked into pale khaki-green trousers, orange-brown belt with a cream buckle, open wine-red cardigan to mid-thigh with a shawl collar and thick turned-up cuffs, white socks, dark grey flats. Clear white space between each sleeve and her body, right up into the armpits. ${BODY}` },
  tricia: { sit: true, height: 1.62, prompt: `Tricia Lange from Rick and Morty: a teenage girl with long, softly wavy dark chocolate-brown hair with a side part, all of it swept back behind her shoulders so it falls down her back out of sight. From the front her hair frames her face and stops at the tops of her shoulders: no hair below her shoulders, none beside her ribs and none under her arms. Large eyes with long upper lashes, a narrow nose, pink lips. A white short-sleeved crop top with a low wide scoop neck and a bare midriff, a small cross on a thin chain, a burgundy plaid mini skirt, light grey over-the-knee socks with a band near the top, black flat shoes. Full body, front view, standing straight, arms straight and held out 45 degrees from her sides, with plain white background between each arm and her body from the armpit to the hand. Last time her hair hung down past her shoulders and filled the space under each arm; that space must be plain white.` },
  diane: { height: 1.68, prompt: `Diane Sanchez from Rick and Morty: a slim fair-skinned woman with straight pale lemon-blonde hair falling to just past her shoulders and covering her ears, a heart-shaped face with plump cheeks, an upturned nose, punch-pink lips and a few freckles, a very pale mint-turquoise cap-sleeved blouse with a square neckline and a wavy flared hem worn loose over slim white jeans, pale grey pumps with medium cone heels, a silver pendant necklace, a violet bangle on her right wrist (on the left of the picture) and a gold wedding ring on her left hand (on the right of the picture); she stands with her feet planted a shoulder-width apart, so a wide gap of white background shows between her legs all the way from the crotch down to her feet. ${BODY}` },
  pencilvester: { height: 1.6, prompt: `Pencilvester from Rick and Morty: a living yellow wooden pencil standing upright, a pink eraser and a grey ridged metal band at the top, his face on the yellow body just below the band, the yellow paint ending in a scalloped edge above the sharpened tan wooden point with a dark grey graphite tip, which hangs down between his legs; two thin pale yellow stick arms from the upper sides and two thin pale yellow stick legs from the bottom of the yellow part, red sneakers with white toe caps and soles, mismatched round eyes, pink lips and buck teeth. ${BODY}` },
  sleepygary: { height: 1.78, prompt: `Sleepy Gary from Rick and Morty: a slim sleepy man with short neat brown hair, large white oval eyes with tiny black dot pupils half covered by heavy drooping upper eyelids, thin brows and a calm closed-mouth smile, in a pale blue pyjama robe reaching the upper thigh, wrapped closed across his body, with notched periwinkle-blue lapels that meet in a V at mid-chest, periwinkle cuffs and two periwinkle hip pockets, over white pyjama trousers with thin pale blue stripes, and soft pale blue slippers. On his head is a long droopy very pale blue nightcap with thin white stripes running lengthwise along it, pulled down over the whole top of his head with a wide turned-up band straight across his forehead; his brown hair shows only at the sides above his ears. The cap's long floppy tail flops over to the RIGHT side of the picture (his left). It runs down behind the ear on the right of the picture, crosses the top of that shoulder right beside his neck, and lies flat against the front of his chest just to the right of the robe's V opening. It ends in a white cotton ball resting on his upper chest, inside the outline of his torso and a hand's width away from his arm. The last picture got this wrong: the tail hung straight down off the left side of his head over the front of his arm, and its cotton ball dangled in the gap between his arm and his body. This time no part of the cap hangs on the left of the picture, over either arm, or beside either arm. Clear white background shows between each sleeve and the sides of his robe, right up into the armpits, and between his legs. ${BODY}` },
  hamurai: { height: 1.8, prompt: `Hamurai from Rick and Morty: a samurai in full armour made of meat. Head: a grey metal dome helmet with a bacon-strip headband and a single bacon strip bent into a wide V standing up from the front of it as a crest. A hood of pink ham, with a small round marrow-bone mark on each side, frames his face and hangs down either side to the jaw. There are no other flaps, horns or wings on the helmet. Face: calm and self-assured, with narrow eyes. Very long, thick black eyebrows, each one bold curving stroke that sweeps out well past the sides of his face like a handlebar. A long, thick, drooping black moustache that curls out from under his nose, its two ends hanging down past his chin like ropes. A long, thick, tapering black goatee hanging down the middle of his chest almost to his belt. Body: a chest plate of pink steamed ham with wavy pale pink stripes running across it, and one fat dark maroon sausage lying diagonally across it, its upper end beside the beard and its lower end toward the right of the picture. Shoulder guards of three stacked tan ham-steak slices with brown grain lines and pale pink fat rims, and smaller tan ham-steak plates on the outside of each upper arm and each wrist, over dark brown sleeves. A belt of fat dark maroon-brown linked sausages round the waist; from the middle of the belt, two short strings of fat dark maroon sausages, two sausages each, hang side by side down the front of the skirt and end above its bottom edge. A skirt of pink-edged brown marbled steak plates to mid-thigh, each plate with a small round marrow-bone ring. Baggy knee-length trousers of pink ham with wide pale pink stripes running across them sideways (horizontal bands, not up and down). Just below the knees, short pink-edged reddish marbled steak shin guards; below them, bare skin shins and ankles, and bare feet in thick pink sandals with dark thong straps. A bacon-strip sword tucked in the belt at his left hip (on the right of the picture), its end angled down and out behind him, well clear of his hand. Empty open hands, and a gap of white background between his legs. The last picture got these wrong, so take care: its eyebrows were short and angry, its moustache and goatee were short, rope ties hung from the belt instead of sausages, the trouser stripes ran up and down, and its shin guards were long and brown. ${BODY}` },
  amishcyborg: { height: 1.78, prompt: `Amish Cyborg from Rick and Morty: a stocky old Amish man with a big bushy black beard and sideburns and no moustache, dark hair to the nape, a black flat-crowned wide-brimmed hat, a white shirt, and olive-brown trousers held up by black suspenders. One side of him is human and the other robot: everything on the LEFT half of the picture is human, and everything on the RIGHT half of the picture is robot. The last picture drew all the robot parts on the left of the picture, so put every one of them on the right, all on the same side. Left of the picture (human): an ordinary half-closed cartoon eye, white with a small black pupil, a heavy lid and a scruffy brow, not glowing; a human arm with the white shirt sleeve rolled up to the elbow and an empty open hand; a human leg in the olive-brown trouser with a rolled cuff and a black shoe. Right of the picture (robot): a grey metal plate over that side of his forehead, eye and cheek. In place of the eye are TWO separate big round red lenses, each in its own thick grey metal ring, set close together diagonally: one high at brow level near the nose, the other just below it and further out toward the edge of his face. Do not draw one ring with dots in it. That arm is a grey robot arm with a big rounded shoulder dome and green lights, ending in the blade of a shovel instead of a hand. That leg is a steel robot leg with bolted joints, green lights and a flat metal foot, coming out of a trouser leg cut off above the knee. Over his mouth, in the middle of the beard, is a ROUND grey metal disc with three short green light bars standing upright side by side and a small bolt on each side of it. It is not a rectangular plate, and its bars are not horizontal. ${BODY}` },
  mrbeauregard: { height: 1.85, prompt: `Mr. Beauregard from Rick and Morty: a heavyset elderly butler with pale skin, a round fleshy face, heavy jowls and a double chin, a big nose and small pursed pink lips, dark grey hair combed straight back with silver-grey sides, thick dark grey brows and heavy-lidded white eyes with tiny pupils, in a black tuxedo dinner jacket, a muted dusty mauve-purple waistcoat, a white dress shirt with small black studs and a black bow tie, black trousers, black shoes, bare empty hands, his arms held well out from his sides at about 35 degrees so that clear white background shows between each sleeve and the side of his jacket all the way from the armpit to the wrist, and a clear gap between his legs. ${BODY}` },
  cousinnicky: { height: 1.8, prompt: `Cousin Nicky from Rick and Morty: a tall, burly, broad-shouldered man with a wide square chest, a flat stomach and thick muscular hairy arms. Long face, long chin, high receding hairline, black hair slicked straight back to the nape, long black sideburns to the jaw, heavy-lidded eyes, a smug closed smile. Pale mint sleeveless shirt, collar popped straight up, open at the chest with a little chest hair, tucked into grey trousers; black belt with a plain brass plate buckle; black shoes. Arms straight and held out 45 degrees from his sides, with white background between each arm and his shirt from armpit to hand. Feet shoulder-width apart, with a wide gap between the legs.` },
  frankenstein: { height: 2.1, prompt: `Frankenstein's monster as drawn in Rick and Morty: a tall heavy monster with pale sage-green skin, very broad square boxy shoulders, a flat-topped square head, black hair with a short jagged fringe, a short stitched scar on one side of his forehead, two grey metal bolts in his neck, heavy-lidded pale yellow eyes with dark grey-blue rings under them and a frowning downturned mouth, in a loose boxy dark charcoal olive-grey jacket reaching the tops of his thighs, buttoned closed down the front with two buttons, with small lapels and a V opening at the neck showing a near-black crew-neck shirt, the jacket's sleeves stopping a little short of the wrists, wide straight very dark green-black trousers falling over big rounded black thick-soled ankle boots, his arms held clear of his sides and a clear gap between his legs. ${BODY}` },
  reversegiraffe: { rig: false, prompt: `Reverse Giraffe from Rick and Morty: a cartoon giraffe standing upright like a person on just two short hind legs with dark brown hooves, its body an extremely long, thin, straight vertical pole of even width, taller than a man, rising straight up from those two hind legs with no belly, no rump and no other legs, pale yellow with soft tan-brown patches and a thin brown mane running down its back, two thin front legs bent at the elbow like arms, with dark brown hooves, sticking out of the front of the pole at the very top just below the head, only four limbs in all, a very short neck and a full-size giraffe head with big ears, two short horns with olive knobs, big round white eyes with tiny black pupils, a few wrinkle lines across the brow and an olive-tan muzzle, the whole tall figure in frame from horns to hooves. ${PROP}` },
  ghostinajar: { rig: false, prompt: `Ghost in a Jar from Rick and Morty, out of his jar: a small ghost in soft pale mint green (light minty green, not lime, not yellow-green), flat colour with no shine, floating upright on his own and shaped like a simple sheet ghost. His head and body are one smooth tall dome, a single continuous shape with no neck and no waist, widening slightly toward the bottom and ending in a short wavy scalloped hem of four or five small rounded points, with nothing below the hem: no tail, no tendrils, no swirl. Two black dot eyes and a simple smiling line mouth high on the dome; two short stubby arms from the sides of the dome, each a rounded stub with just a thumb. No jar, no lid, nothing above his head. Last time he had a mushroom-shaped head on a narrower body and two long curling tails under the hem; leave both out. ${PROP}` },
  photographyraptor: { rig: false, prompt: `Photography Raptor from Rick and Morty: a velociraptor standing on its two hind legs with a slightly rounded belly, smooth olive-brown skin with dark brown stripes across its back, neck and tail and a few dark brown spots, olive-green patches round the eyes and on the snout, a pale cream lower jaw, throat, chest and belly, big round yellow eyes with a thin green slit pupil, a long tail, long thin arms with clawed hands, its mouth closed in a smug smile curving up along its long pale cream lower jaw, no teeth showing, three-toed clawed feet with a big curved claw, no clothes, standing with one clawed hand resting on an old-fashioned wooden bellows camera with a brass lens on a wooden tripod beside it, the tripod's three legs fully in view and apart from the raptor's legs. ${PROP}` },
  tinkles: { rig: false, prompt: `Tinkles from Rick and Morty: a little fluffy white lamb standing upright on her two hind legs with her front legs held out like little arms, her face looking straight ahead, a unicorn horn of stacked spiral rings in red, orange, yellow and green with blue at the tip in the middle of her forehead, white ears with pink insides, a round light pink muzzle on the front of her face with two nostrils and a small open smiling mouth, huge glossy eyes with teal-blue irises round very large black pupils with white highlights and thick black upper lash lines with long lashes, light pink hooves and a fluffy light pink tail, a fluffy curly very pale pink, almost white tuft of hair on top of her head, a thin gold tiara with a row of small pink beads and a pink gem at the front of the tuft, a pale lavender tutu at her waist, knee socks striped blue, white, green and yellow. ${PROP}` },
  babywizard: { rig: false, prompt: `Baby Wizard from Rick and Morty: a chubby pale baby standing barefoot and bare-chested, wearing only a plain blue cloth diaper with no tabs, covered in yellow stars and crescent moons, and a tall pointed periwinkle-blue wizard's hat with yellow stars and crescent moons and a thick rolled white brim, worn tipped back on his head, its long tapering tip pointing back and drooping to one side, not curled, big round white eyes with small dot pupils, no beard, both hands empty and open at his sides, nothing in his hands. ${PROP}` },
  mrsrefrigerator: { rig: false, prompt: `Mrs. Refrigerator from Rick and Morty: a tall pale lavender two-door refrigerator standing upright, seen from the front and turned only a little, light blue door handles down the left edge of both doors. Her face fills the front of the top door and is ONLY eyes and lips: two very large round white eyes, together almost as wide as the door, with tiny black dot pupils, long upper lashes and lilac eyeshadow, and big wide full pink lips just below them. She has NO nose and NO eyebrows: the door between the eyes and the lips is plain and blank (the last picture wrongly added a small nose line and arched eyebrows and made the eyes and lips too small, so leave the nose and brows out and draw the eyes and lips big). A broad swept dark mauve hair fringe runs across the whole top of the door, under a rose-pink headscarf with cream-white polka dots that wraps round the top of the fridge and is knotted in a bow on top. On the lower door: a small white paper note with a pink heart drawn on it (a paper note, not a heart-shaped magnet), an orange carrot magnet with a green top, and a blank pale blue note. A plain straight rectangular coral-pink apron hangs down the front of the lower door, tied with a coral-pink waistband (not white) that wraps round the fridge, with a white band at its hem. Two pale lavender arms stick out from the left and right sides of the lower door just above the apron's waistband, both clearly visible and held out a little away from the body, with open pale lavender hands, and a pink bangle and a yellow bangle on the wrist of the arm on the right of the picture. Two short pale lavender legs in blue flat shoes. ${PROP}` },
};
const PHASE6 = {
  'spacebeth-ship': { rig: false, hero: true, prompt: `Space Beth's spaceship from Rick and Morty, seen almost from the front and turned only a little, the whole ship drawn small in the middle of the picture with wide white margins on every side: a battered rounded saucer-like hull in slate grey-green with a dark rounded belly underneath, a mustard-yellow panel across the front of the nose carrying a pale grey hatch plate and a long row of orange-lit slot lights, a thin vertical cyan light strip down the front just to the right of the yellow panel, a large clear glass bubble cockpit dome with four empty seats, two rust-red engine pods with dark louvred intakes flanking the dome, a big black ring-shaped turbine with a notched rim standing upright on top at the back with copper coils lining the inside of the ring, two long straight rust-red wings with olive patches reaching out level to the left and right, a tall dark red kite-shaped fin standing upright across the tip of the wing on the left of the picture that reaches well above AND well below that wing, the wing on the right of the picture ending in a plain squared tip with no fin, a yellow-and-black striped gun barrel under the wing on the right of the picture, two dark grey landing legs under the front of the hull, each ending in a curved hooked claw. Last time the right wing ran off the edge of the picture and the fin only rose above the wing: this time both wingtips, the whole fin and the gun end well inside the picture with white space past them. ${PROP}` }, // (confirm against the sheet)
  'jerry-ship': { rig: false, prompt: `Jerry's car turned into a spaceship by Rick, from Rick and Morty: a long boxy pale green 1980s four-door station wagon with brown wood-grain panels along its sides, a roof rack, square twin headlights, a chrome grille and bumpers and grey hubcaps, with two identical flat grey metal wings held level, one folded out from each side of the body below the doors, both wings in view, and grey rocket thrusters at the back. Seen a little from above so that both wings show, the whole vehicle and both wingtips inside the picture. ${CAR}` },
  'gotron-ferret': { rig: false, hero: true, prompt: `A Gotron ferret robot from Rick and Morty: a giant mecha ferret shaped like a long, low sports car, its body very long and slinky, about four times as long as it is tall, its belly only just above the ground, built from glossy red armour sections: a rounded rear haunch, a white-silver segmented joint, a long middle body with a raised hatch and a row of small teal lights on its back, a second white-silver segmented joint, and a chest. A big round black wheel with a white hub is set into each side of the rear haunch and each side of the chest, like a car's wheels, and four short stubby legs are folded under the body, almost hidden beneath it. A long white-silver segmented tail curves up behind. The head is an angular armoured mecha head like the front of a sports car: a red armoured top, a teal glass cockpit windscreen across the top, small angular ear pods with teal glass, narrow angular glowing yellow eyes like headlights, a small red triangular nose gem, and a white-silver lower face and jaw with slanted vents and a zigzag edge. No animal nose, no muzzle, no fur, no whiskers, no round ears. The first picture drew a cute animal face with a white muzzle and a brown nose. The second drew a short car body standing high on four tall stilt legs with a wheel for each foot. The body must be long and low like a ferret, the wheels must be on the sides of the body and not under the feet, and the head must be the angular mecha head. ${PROP}` },
  gotron: { rig: false, hero: true, fix: 'shin', prompt: `The combined Gotron mecha from Rick and Morty: a towering super robot built from five ferret robots. It has a wide black torso with a red collar and a gold chevron chest plate holding a red shield with a glowing pale cyan G emblem, a short red pointed panel on the torso just below the shield, a white segmented waist, and black hips with a black belt and a gold buckle, with no flap hanging between the legs. Two long red-and-white wings rise behind the shoulders in a V. The helmet is black with a gold brow, glowing yellow eyes and a white faceplate. Each arm is one whole ferret robot, all red on the right arm (viewer's left) and all yellow on the left arm (viewer's right): a plain rounded shoulder block in that same colour with one black wheel on its outer side and nothing on top of it, a white segmented elbow, then the ferret's body as the forearm, with black wheels on its sides, reaching to mid-thigh with its head in place of the hand, and no robot hand or fist. Each leg is a white segmented thigh over a shin that is one whole ferret robot with black wheels on its sides, blue on the right leg (viewer's left) and green on the left (viewer's right), its head forming the foot and pointing straight forwards at the viewer. There are exactly four ferret heads: the two hands and the two feet. Each is an angular mecha ferret head with small pointed ear pods with teal glass, a teal glass windscreen on top, narrow glowing yellow eyes, a small red nose gem and a white-silver jaw with slanted vents and a zigzag edge, not a car bonnet with headlights and not a furry face. Last time the picture wrongly put a whole yellow car and a whole red car with teeth on top of the shoulders, drew the feet as plain cars with headlights, and hung a red flap over the crotch. Nothing sits on the shoulders, the feet are ferret heads, and the hips are plain black. Standing straight, the arms a little away from the body with white background between each forearm and the thigh. ${PROP}` },
  'zigerion-ship': { rig: false, hero: true, prompt: `The Zigerion mothership from Rick and Morty: a huge dark green spaceship shaped like a dumbbell, two giant thick disc-shaped hulls side by side joined by a short boxy central hull, each disc rimmed with large glowing lime-green crescent windows and a ringed hub on its outer face with spiky barrels sticking out, teal light strips all over the hull, a flat top deck with a low boxy deckhouse and tall thin antenna spires tipped with red lights, a stepped underside ending in hanging spires. ${PROP}` }, // (confirm against the sheet "Zigerions")
  storytrain: { rig: false, hero: true, prompt: `The Story Train from Rick and Morty: a long streamlined science-fiction steam locomotive in gold, amber and copper. Its front is a long, low, tapering snout like a shark's nose. It slopes steeply down from a pale curved cab windscreen to a narrow tip almost at rail level, with a small round copper buffer at the tip, and the snout is longer than it is tall, not a blunt or upright rounded face. A narrow ridged cream strip runs down the middle of the snout from just under the windscreen to the tip, with a small red-rimmed round lamp at its top. One big glowing round headlamp in a thick gold ring is set flush into each side of the engine just behind the snout, not on a stalk, and there are no other headlamps. Along each lower side, below the headlamp, runs a copper skirt with three dark rectangular slots, and there is no cowcatcher, bumper or grille across the front. Behind them are red piston cylinders and big dark red spoked driving wheels. It hauls exactly three passenger carriages, the first dark red, the second brown and the third black, with warm lit windows and glowing gold couplings, no text or numbers. Last time the picture drew a blunt, bulbous diesel-style front with a wide bumper, headlamps sticking out on stalks at the front corners and a slatted cowcatcher across the front. The snout must be long, low and pointed, and the headlamps flush on the sides. ${PROP}` },
};
// The plan's Task 3.1: Mortytown's people and buildings, two Ricks for the
// Citadel's crowd, the Citadel from space and the NX-5. The plan's prompts
// were checked against the wiki on 6 October and put right where the show
// differs: the Locos are three tattooed Mortys in grubby T-shirts and a tank
// top (not purple bandanas), and rigged (the quest walks them to Cop Morty);
// the Supreme Guards wear gold armour and red capes; Garment District Rick a
// fur-collared brown coat and no hat; the campaign manager a white
// short-sleeved shirt, red tie and lanyard; Slick Morty a yellow T-shirt with
// rolled sleeves; Morty Mart is a grimy slate-green shopfront under a neon
// sign; the Citadel a brass disc with a teal dome and three arms ending in
// saucers; the NX-5 a crimson ship with a hexagon-plated teal bulb and a
// green ring cannon. `crowd`: only ever stands in the Citadel's crowd, so it
// is drawn standing at ease on the lighter image model, never rigged, about
// 9,000 faces, and kept full-size in node_modules/.cache/meshy-full/ for
// scripts/crowd.mjs to bake.
const PHASE3 = {
  bigmorty: { sit: true, height: 1.5, prompt: `Big Morty from Rick and Morty: ${MORTY}, with a scowl, a dark teal-grey knitted beanie pulled down over his hair, big yellow-tinted aviator sunglasses, a thin wispy moustache, two thin gold chain necklaces, a dark magenta-pink jacket worn open over a red T-shirt, dark maroon-brown trousers and dark shoes. ${BODY}` },
  slickmorty: { height: 1.5, prompt: `Slick Morty from Rick and Morty: ${MORTY}, with one curl of hair sticking up at the front and a thin shaved line on one side of his scalp, a plain pale yellow T-shirt with its sleeves rolled up to the shoulders, two metal dog tags on a ball chain round his neck, blue jeans and white sneakers. ${BODY}` },
  campaignmorty: { height: 1.5, prompt: `Campaign Manager Morty from Rick and Morty: ${MORTY}, with a pleased open smile, in a white short-sleeved collared dress shirt tucked in, a long red tie, a lanyard round his neck with a white ID card hanging from it, a black belt, dark charcoal grey trousers and black shoes. ${BODY}` },
  rickd3: { height: 1.85, prompt: `Rick D. Sanchez III from Rick and Morty: ${RICK}, dressed like a showman chocolatier: a tall purple top hat with a wide gold band, a purple tailcoat with wide lapels over a green waistcoat with gold buttons, a green shirt with a green tie, purple trousers and black shoes, empty hands. ${BODY}` },
  simplerick: { height: 1.85, prompt: `Simple Rick from Rick and Morty: ${RICK}, with a gentle contented smile and no lab coat, in a plain pale sky-blue long-sleeved collared shirt tucked into dark navy blue trousers, a brown belt and brown shoes. ${BODY}` },
  evilrick: { height: 1.85, prompt: `Evil Rick from Rick and Morty: ${RICK}, with a cold blank stare, dark shadowy circles under his eyes and a thin scar across his lips, in a long white lab coat open over a plain black shirt, brown trousers, a black belt and dark grey shoes. ${BODY}` },
  'loco-a': { height: 1.5, prompt: `A Mortytown Loco from Rick and Morty, a Morty gang member: ${MORTY}, with a big dark blue-grey flame-shaped tattoo over one side of his face and forehead and three small ring tattoos beside his mouth, a grubby dark mauve-brown T-shirt, faded dark blue jeans and scuffed grey sneakers. ${BODY}` },
  'loco-b': { height: 1.5, prompt: `A Mortytown Loco from Rick and Morty, a Morty gang member: ${MORTY}, with a small dark blue-grey swirl tattoo over one eyebrow and a few small ring tattoos on his cheek beside his mouth, a dirty off-white T-shirt, baggy dark grey jeans and scuffed white sneakers. ${BODY}` },
  'loco-c': { height: 1.5, prompt: `A Mortytown Loco from Rick and Morty, a Morty gang member: ${MORTY}, with a small dark blue-grey swirl tattoo at one temple and small ring tattoos beside his mouth, a stained olive-grey sleeveless tank top, baggy brown cargo trousers and scuffed dark sneakers. ${BODY}` },
  supremeguard: { crowd: true, prompt: `A Supreme Guard Rick of the Citadel from Rick and Morty: ${RICK}, a stern soldier in ornate gold armour: a gold breastplate, big rounded gold shoulder plates, gold gauntlets and gold shin guards, a long dark red cape hanging from his shoulders to his calves, dark olive trousers and dark boots. ${AT_EASE}` },
  garmentrick: { crowd: true, prompt: `Garment District Rick from Rick and Morty: ${RICK}, but with his pale blue-grey hair swept back into a low rounded puffy pompadour, only a little taller than Rick's own spiky hair and not a tall bouffant, long grey sideburns and a grey moustache, in a long double-breasted brown winter coat with a thick cream fur collar and cream fur cuffs, dark trousers and dark shoes. ${AT_EASE}` },
  mortymart: { rig: false, hero: true, prompt: `Morty Mart from Rick and Morty, a small corner convenience store in a grimy science-fiction city: a boxy single-storey shop of dark slate grey-green metal panels with rust streaks and rivets, a flat roof with pipes and a vent; across the front a long blank sign board edged with an unlit red neon tube, under it a wide shop window and an open doorway showing tall glass fridges full of green bottles inside, a curved metal air-conditioning cylinder over the door, a cyan neon bottle-shaped sign on the left corner, a green neon palm-tree sign and a small yellow neon sign in the window with no letters, torn paper posters on the wall. ${BUILDING}` },
  creepymorty: { rig: false, hero: true, prompt: `The Creepy Morty, a seedy nightclub in the Mortytown district of the Citadel from Rick and Morty: a two-storey building of dark purple-grey metal panels with grimy streaks, a flat roof with pipes, a tall vertical blank sign board edged with pink and violet neon tubes on the front corner, a recessed doorway lit purple under a short black awning, a red velvet rope on two brass posts by the door, small round porthole windows glowing magenta, no letters anywhere. ${BUILDING}` },
  'citadel-exterior': { rig: false, hero: true, prompt: `The Citadel of Ricks from Rick and Morty, a huge space station seen from the side and a little above: a wide flattened central disc of brass-gold and olive metal plating with rows of small lit windows, a large dome of pale teal glass on top of the disc with a tall thin spire rising from its centre, three long thin straight arms reaching out level from the disc at equal angles, each ending in a smaller flattened saucer of teal glass ringed in brass, and under the central disc a long downward-pointing tapering cluster of metal plates and fins with glowing cyan crystal panels. ${PROP}` },
  nx5: { rig: false, hero: true, prompt: `The NX-5 Planet Remover from Rick and Morty, a Galactic Federation capital warship: a huge organic-looking battleship of dark crimson red armour, its long body reaching forward like a thick arm and ending in a huge round planet-killer cannon at the front, a ring of rounded pale green glowing pods round a big glowing green lens; behind it a spiky armoured command head with glowing orange windows; the back half of the ship is a huge rounded bulb covered in pale teal hexagonal armour plating held by dark red rib-like straps, round glowing cyan lights and red glowing orbs dotted along the hull. ${PROP}` },
};
// The plan's Phase 4: eight more destinations' people and places (its
// prompts as written, from each one's wiki page).
const PHASE4 = {
  stairgoblin: { rig: false, prompt: `A Stair Goblin from Rick and Morty: a living flight of three steps, a blocky pink body shaped like a small staircase with a grumpy face on the top step, two stubby arms and two short legs. ${PROP}` },
  kingjellybean: { height: 2.2, prompt: `King Jellybean from Rick and Morty: a tall pale blue jellybean-shaped creature with a droopy tired face, half-closed eyes and a frown, a small gold crown on top, a magenta royal robe with white fur trim over his shoulders, a gold medallion on a chain, thin bare bluish arms and legs, bare feet. ${BODY}` },
  thirstystep: { rig: false, hero: true, prompt: `The Thirsty Step tavern from Rick and Morty: a medieval fantasy tavern of dark timber and cream plaster with a steep brown shingled roof, a big round wooden door, small leaded windows glowing warm, a hanging wooden sign with a tankard on it, a stone chimney, no text. ${BUILDING}` },
  giant: { rig: false, prompt: `A giant from the giants' village in Rick and Morty: a huge bearded man in a simple brown peasant tunic with a rope belt, brown trousers and big leather boots, bushy brown hair and beard, a kindly face, standing with his arms at his sides. ${PROP}` },
  zeep: { hero: true, height: 1.8, prompt: `Zeep Xanflorp from Rick and Morty: a thin alien scientist with a green head that is tall and wide at the top and tapers to the chin, three blue stripes across his big forehead, a single blue unibrow, yellow eyes with blue pupils and dark circles under them, blue lips and blue fingertips, in a green lab coat with gold trim at the collar and cuffs over a grey shirt, grey trousers and dark shoes. ${BODY}` },
  kyle: { height: 1.7, prompt: `Kyle, the scientist of the Miniverse from Rick and Morty: a slim alien with pale blue-grey skin, a tall oval head with a high brow, big sad dark eyes, two small antennae, in a white lab coat over a teal tunic, grey trousers, boots. ${BODY}` },
  xenonbloom: { height: 1.9, prompt: `Dr. Xenon Bloom from Rick and Morty: a translucent pale teal-green amoeba in the shape of a tall thin man, with lighter blobs floating inside his body, a drawn-on face with round black glasses, a grey moustache and a wide mouth of square teeth, no clothes, empty hands. ${BODY}` },
  poncho: { height: 1.75, prompt: `Poncho from Rick and Morty: a stocky middle-aged man with grey hair and a grey moustache and an angry face, in a brown sleeveless vest over a bare chest, dark green trousers, boots, and a clear round bubble helmet with a blue collar ring over his head, empty hands. ${BODY}` },
  annie: { height: 1.62, prompt: `Annie from Rick and Morty: a teenage girl with long blonde hair in a high ponytail with a teal bow, big eyes with long lashes, a few freckles, a white short-sleeved blouse under a dark green theme-park apron with a name tag, a dark green skirt, white sneakers. ${BODY}` },
  hepatitis: { rig: false, prompt: `Hepatitis A as a monster in Rick and Morty: a huge hulking green-brown blob creature with a lumpy wet body, a wide mouth of jagged teeth, small yellow eyes and two thick arms. ${PROP}` },
  gonorrhoea: { rig: false, prompt: `Gonorrhea as a monster in Rick and Morty: a towering pale yellow-green creature of lumpy jelly with many thin tentacles, a cluster of red eyes and a round sucker mouth. ${PROP}` },
  tuberculosis: { rig: false, prompt: `Tuberculosis as a monster in Rick and Morty: a tall gaunt pale grey creature with long thin arms, a hunched back, a skull-like face with sunken eyes and a wide coughing mouth. ${PROP}` },
  plague: { rig: false, prompt: `Bubonic plague as a monster in Rick and Morty: a swollen black and purple creature covered in bulging boils, short legs, a huge toothy mouth and small glowing eyes. ${PROP}` },
  ecoli: { rig: false, prompt: `E. coli as a monster in Rick and Morty: a long dark brown rod-shaped creature covered in wriggling hairs, a mouth of needle teeth at one end, many small legs. ${PROP}` },
  needful: { height: 1.85, prompt: `Mr. Needful from Rick and Morty: a thin man of Rick's height with very angular features, a long nose, a pointed chin and bags under his eyes, red hair pointed up at the sides like horns, a thin pencil moustache and a matching goatee, thick eyebrows, in a three-piece suit of a drab purple-and-green blazer over a green waistcoat, dark purple trousers, a string tie, white gloves, red dress shoes and a large black top hat, empty hands. ${BODY}` },
  'needful-shop': { rig: false, hero: true, prompt: `Needful Things, the curiosity shop from Rick and Morty: a small old-fashioned shop of dark red brick with a black-painted wooden shopfront, a big bay window full of odd antiques, a glass door with a bell, a hanging blank sign, a lamp either side of the door, no text. ${BUILDING}` },
  'jerry-robe': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a brown bathrobe over pyjamas and slippers. ${AT_EASE}` },
  'jerry-golf': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a green polo shirt, khaki shorts, a white sun visor and white trainers. ${AT_EASE}` },
  'jerry-tux': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a black tuxedo with a bow tie. ${AT_EASE}` },
  'jerry-track': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a red tracksuit with white stripes and a sweatband. ${AT_EASE}` },
  'jerry-gown': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a pale blue hospital gown and socks. ${AT_EASE}` },
  'jerry-cardigan': { crowd: true, prompt: `A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair, a weak chin and a sulky look, in a beige cardigan over a checked shirt, with a flat cap. ${AT_EASE}` },
  arthricia: { height: 1.6, prompt: `Arthricia from Rick and Morty: a teenage cat-girl with light brown fur, a cat's face with a small pink nose and pointed ears, long flowing darker brown hair worn down, in a light blue peasant dress with a white apron and long black boots. ${BODY}` },
  'magdalian-a': { crowd: true, prompt: `A Magdalian villager from the Purge Planet in Rick and Morty: a cat-person with orange fur, a cat's face with a small nose and pointed ears, in a brown peasant tunic with a rope belt, bare furry feet. ${AT_EASE}` },
  'magdalian-b': { crowd: true, prompt: `A Magdalian villager from the Purge Planet in Rick and Morty: a cat-person with grey fur, a cat's face with a small nose and pointed ears, in a blue dress with a white apron, bare furry feet. ${AT_EASE}` },
  'magdalian-c': { crowd: true, prompt: `A Magdalian villager from the Purge Planet in Rick and Morty: a cat-person with cream fur, a cat's face with a small nose and pointed ears, in a green jerkin over a white shirt and brown trousers, bare furry feet. ${AT_EASE}` },
  flippynips: { height: 1.5, prompt: `A Plutonian king from Rick and Morty: a round plump alien with orange skin and a pale yellow front, three tall yellow-green antennae standing up on top of his head like a crown, red frilled fins at the sides of his head, round glasses with X-shaped eyes, a wide grin of white teeth, a dark red royal cape fastened with a round blue gem, gold bracelets on his wrists, three-toed orange feet. ${BODY}` },
  scroopy: { height: 1.4, prompt: `Scroopy Noopers, a Plutonian from Rick and Morty: a round plump alien with orange skin and a pale yellow belly, three short red antennae on his head, red frilled fins at the sides of his head, round glasses with X-shaped eyes, a wide mouth of white teeth, in a white short-sleeved collared shirt with a pocket of pens, three-toed orange feet. ${BODY}` },
  'plutonian-a': { crowd: true, prompt: `A Plutonian from Rick and Morty: a round plump alien with orange skin and a pale yellow belly, three short antennae on the head, frilled fins at the sides of the head, round eyes with X-shaped pupils, a wide mouth of white teeth, in a blue tunic, three-toed orange feet. ${AT_EASE}` },
  'plutonian-b': { crowd: true, prompt: `A Plutonian from Rick and Morty: a round plump alien with orange skin and a pale yellow belly, three short antennae on the head, frilled fins at the sides of the head, round eyes with X-shaped pupils, a wide mouth of white teeth, in grey overalls, three-toed orange feet. ${AT_EASE}` },
  gearhead: { height: 1.8, prompt: `Gearhead (Revolio Clockberg Jr.) from Rick and Morty: a thick-set gear-person, bald, with forehead wrinkles above a large purple unibrow, yellow-tinted eyes with heavy bags under them, a round nose, yellow and orange gears where his ears and mouth would be, a transparent pink torso with brass gears turning inside it and pink windows on his shoulders, grey metal arms and legs, in a brown waistcoat and dark trousers. ${BODY}` },
  'gearperson-a': { crowd: true, prompt: `A gear-person of Gear World from Rick and Morty: a thick-set humanoid made of brass and grey metal with a round head, gears turning where the ears are, a transparent pink torso with brass gears inside, grey metal arms and legs, in a brown leather apron. ${AT_EASE}` },
  'gearperson-b': { crowd: true, prompt: `A gear-person of Gear World from Rick and Morty: a thick-set humanoid made of brass and grey metal with a round head, gears turning where the ears are, a transparent pink torso with brass gears inside, grey metal arms and legs, in a grey suit jacket and trousers. ${AT_EASE}` },
};
// the small props, whose textures the plan keeps to 1024 pixels
const SMALL = new Set(['snuffles', 'ghostinajar', 'tinkles', 'babywizard', 'stairgoblin', 'hepatitis', 'gonorrhoea', 'tuberculosis', 'plague', 'ecoli']);
export const ASSETS = {};
for (const [phase, set] of [
  [1, PHASE1],
  [2, PHASE2],
  [3, PHASE3],
  [4, PHASE4],
  [5, PHASE5],
  [6, PHASE6],
]) {
  for (const [n, a] of Object.entries(set)) ASSETS[n] = { phase, rig: !a.crowd, poly: a.crowd ? 9000 : a.hero ? 40000 : 30000, tex: a.crowd || SMALL.has(n) ? 1024 : 2048, ...a };
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
// has them all; and what another run of this has saved since this one
// read the file is kept, so two steps can run side by side: a name's
// entries are merged, this run's winning. A reroll forgets on purpose, so
// it writes what it has.)
let tasks = null;
const save = async ({ merge = true } = {}) => {
  const disk = merge ? await json(TASKS) : {};
  for (const [n, v] of Object.entries(tasks)) disk[n] = { ...disk[n], ...v };
  tasks = disk;
  await put(TASKS, tasks);
};
async function mark(names, status) {
  const ledger = await json(LEDGER);
  for (const n of names) if (ledger[n]?.status !== 'done' || status === 'done') ledger[n] = { status, by: ASSETS[n]?.phase === 3 ? 'cloud' : 'local' };
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

// Meshy's auto-rig spills weight from one leg onto the other where the feet
// stand close: Rick Prime's boot shafts had 3-5% of the other leg, Mr.
// Poopybutthole's shoes up to 23%, so when the legs part in a stride the
// inside of each boot or shoe is pulled across the gap into a fin or a spike
// off the heel. `ankles: 'legs'`: below the knees, where the legs stand
// apart, a vertex keeps only its own leg's bones (not above: the thighs and
// the crotch need the blend, and lose it as a notch). `ankles: true` also
// moves the foot's and toes' share above an ankle to the shin, eased in over
// the first 5 cm so the ankle itself still bends: a tall boot's shaft then
// stops hinging with the foot (Rick Prime's tore on three rigs, two models).
// Positions are in the skin's bind space, where the joints' inverse bind
// matrices put the knees and ankles.
export function stiffenAnkles(doc, { shafts = true, ease = 0.05 } = {}) {
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) return 0;
  const names = skin.listJoints().map((j) => j.getName());
  const ibm = skin.getInverseBindMatrices();
  const at = (name) => new Matrix4().fromArray(ibm.getElement(names.indexOf(name), [])).invert().elements;
  const sides = [
    ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'],
    ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
  ].map(([up, leg, foot, toe]) => ({
    leg: names.indexOf(leg),
    off: [names.indexOf(foot), names.indexOf(toe)].filter((i) => i >= 0),
    chain: [up, leg, foot, toe].map((n) => names.indexOf(n)).filter((i) => i >= 0),
    x: at(leg)[12],
    y: at(foot)[13],
    knee: at(leg)[13],
  }));
  if (sides.some((s) => s.leg < 0 || !s.off.length)) return 0;
  // (which leg a vertex is on: the nearer knee, across)
  const mid = (sides[0].x + sides[1].x) / 2;
  const own = (x) => (sides[0].x > mid === x > mid ? 0 : 1);
  let moved = 0;
  const p = [0, 0, 0];
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const J = prim.getAttribute('JOINTS_0');
      const Wt = prim.getAttribute('WEIGHTS_0');
      if (!pos || !J || !Wt) continue;
      for (let v = 0; v < pos.getCount(); v++) {
        pos.getElement(v, p);
        J.getElement(v, j);
        Wt.getElement(v, w);
        let changed = false;
        const mine = own(p[0]);
        const other = sides[1 - mine];
        if (p[1] < sides[mine].knee - ease) {
          for (let k = 0; k < 4; k++) {
            if (w[k] > 0 && other.chain.includes(j[k])) {
              w[k] = 0;
              changed = true;
            }
          }
        }
        const s = sides[mine];
        const f = shafts ? Math.min(1, Math.max(0, (p[1] - s.y) / ease)) : 0;
        let take = 0;
        for (let k = 0; k < 4; k++) {
          if (f && w[k] > 0 && s.off.includes(j[k])) {
            take += w[k] * f;
            w[k] *= 1 - f;
          }
        }
        if (take) {
          // into the shin's slot, else a freed or empty one, else the lightest
          let k = j.findIndex((x, i) => x === s.leg && w[i] > 0);
          if (k < 0) k = w.findIndex((x) => x === 0);
          if (k < 0) k = w.indexOf(Math.min(...w));
          if (j[k] !== s.leg) {
            take += w[k];
            w[k] = 0;
            j[k] = s.leg;
          }
          w[k] += take;
          changed = true;
        }
        const sum = w.reduce((a, b) => a + b, 0);
        if (changed && sum > 0) {
          for (let k = 0; k < 4; k++) w[k] /= sum;
          J.setElement(v, j);
          Wt.setElement(v, w);
          moved++;
        }
      }
    }
  }
  return moved;
}

// Gotron's green left shin came out blue down its back and heel (seen only
// from behind; his second model, and the gate allows no third). `fix:
// 'shin'`: the texels his left shin's triangles cover that are blue take the
// shin's own green, their light and shade kept. His left is +x (a figure faces
// +z), and his shin is the leg below the knee, under half his height.
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx / 255];
};
const rgb = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
};
export async function greenShin(doc) {
  let moved = 0;
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const pos = prim.getAttribute('POSITION');
    const uv = prim.getAttribute('TEXCOORD_0');
    const tex = prim.getMaterial()?.getBaseColorTexture();
    if (!pos || !uv || !tex) continue;
    const lo = pos.getMin([]);
    const hi = pos.getMax([]);
    const cx = (lo[0] + hi[0]) / 2;
    const H = hi[1] - lo[1];
    // (between the middle and the arm, below the knee)
    const shin = (p) => p[0] > cx + 0.04 * (hi[0] - lo[0]) && p[0] < cx + 0.28 * (hi[0] - lo[0]) && p[1] < lo[1] + 0.45 * H;
    const { data, info } = await sharp(tex.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const Ht = info.height;
    const mask = new Uint8Array(W * Ht);
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    const p = [0, 0, 0];
    const t = [0, 0];
    for (let i = 0; i < n; i += 3) {
      const vs = [0, 1, 2].map((k) => (idx ? idx.getScalar(i + k) : i + k));
      if (!vs.every((v) => shin(pos.getElement(v, p)))) continue;
      const q = vs.map((v) => {
        uv.getElement(v, t);
        return [t[0] * W, t[1] * Ht];
      });
      const [x0, x1] = [Math.floor(Math.min(...q.map((a) => a[0]))), Math.ceil(Math.max(...q.map((a) => a[0])))];
      const [y0, y1] = [Math.floor(Math.min(...q.map((a) => a[1]))), Math.ceil(Math.max(...q.map((a) => a[1])))];
      const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
      if (!area) continue;
      for (let y = Math.max(0, y0); y <= Math.min(Ht - 1, y1); y++) {
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          const [px, py] = [x + 0.5, y + 0.5];
          const a = ((q[1][0] - px) * (q[2][1] - py) - (q[2][0] - px) * (q[1][1] - py)) / area;
          const b = ((q[2][0] - px) * (q[0][1] - py) - (q[0][0] - px) * (q[2][1] - py)) / area;
          if (a >= -0.02 && b >= -0.02 && a + b <= 1.02) mask[y * W + x] = 1;
        }
      }
    }
    // the shin's own green: the mean hue of its green texels
    let sum = 0;
    let count = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const [h, s, v] = hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (h > 80 && h < 165 && s > 0.3 && v > 0.2) {
        sum += h;
        count++;
      }
    }
    if (!count) continue;
    const green = sum / count;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const [h, s, v] = hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (h > 190 && h < 260 && s > 0.25) {
        const [r, g, b] = rgb(green, s, v);
        data.set([r, g, b], i * 4);
        moved++;
      }
    }
    tex.setImage(await sharp(data, { raw: { width: W, height: Ht, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
  }
  return moved;
}
const FIXES = { shin: greenShin };

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed;
// a clip keeps only its skeleton and animation.
let io = null;
async function squeeze(from, to, { tex = 0, clip = false, ankles = false, fix = null } = {}) {
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
  if (ankles) console.log(`  ankles: ${stiffenAnkles(doc, { shafts: ankles !== 'legs' })} vertices mended`);
  if (fix) console.log(`  ${fix}: ${await FIXES[fix](doc)} texels mended`);
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(to, doc);
}

// a found model's entry in src/data/modelCredits.json, as the scout's fetch writes it
async function creditFound(n, m, a) {
  const file = join(ROOT, 'src', 'data', 'modelCredits.json');
  const all = JSON.parse(await readFile(file, 'utf8'));
  all[`c-137-${slugOf(m.name)}`] = creditOf(m, { where: 'c-137', as: `${a.as}, rigged by Meshy`, file: `/games/meshy/${n}.glb` });
  await put(file, Object.fromEntries(Object.entries(all).sort(([x], [y]) => x.localeCompare(y))));
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
    names = names.filter((n) => !ASSETS[n].uid);
    await mark(names, 'meshy');
    await each(names, async (n) => {
      const a = ASSETS[n];
      tasks[n] ??= {};
      if (!tasks[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: a.crowd ? 'nano-banana' : 'nano-banana-pro', prompt: `${a.prompt} ${STYLE}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}) });
        tasks[n].image = result;
        await save();
      }
      const t = await wait('/v1/text-to-image', tasks[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(18)} ${t.consumed_credits} credits`);
    });
  },
  async models(names) {
    await each(names.filter((n) => !ASSETS[n].uid), async (n) => {
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
          // (`pose: false`: the concept's own pose kept, for a figure whose
          // extra limbs Meshy's A-pose pass drops, as Mar-Sha's and Morty
          // Jr.'s arms on their heads)
          ...(a.rig && a.pose !== false ? { pose_mode: 'a-pose' } : {}),
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
  // a Sketchfab model (an asset with a `uid`) made ready for Meshy's rigger:
  // downloaded (SKETCHFAB_API_TOKEN), its transforms baked into the vertices,
  // turned to face +z (`turn`), stood on y = 0 at the middle, its maps JPEGs at 1024 and no meshopt
  // (Meshy can't read it), into lab/meshy/rm/in/<name>.glb; its page kept
  // for the credit (src/data/modelCredits.json, written by fetch)
  async bake(names) {
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) throw new Error('Set SKETCHFAB_API_TOKEN (it is in ~/.tilakverse.env).');
    const sf = async (path) => {
      const r = await fetch(`https://api.sketchfab.com/v3${path}`, { headers: { Authorization: `Token ${token}` } });
      if (!r.ok) throw new Error(`sketchfab ${path}: ${r.status}`);
      return r.json();
    };
    for (const n of names.filter((k) => ASSETS[k].uid)) {
      const { uid } = ASSETS[n];
      const raw = join(REVIEW, 'in', `${n}-sketchfab.glb`);
      if (!existsSync(raw)) await download((await sf(`/models/${uid}/download`)).glb.url, raw);
      tasks[n] = { ...tasks[n], sketchfab: await sf(`/models/${uid}`).then((m) => ({ name: m.name, user: m.user, license: m.license, viewerUrl: m.viewerUrl })) };
      await save();
      const plain = new NodeIO().registerExtensions(ALL_EXTENSIONS);
      const doc = await plain.read(raw);
      await doc.transform(flatten());
      for (const node of doc.getRoot().listNodes()) {
        if (!node.getMesh()) continue;
        transformMesh(node.getMesh(), node.getWorldMatrix());
        node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      // (`turn`: radians about y, for a model that doesn't face +z)
      if (ASSETS[n].turn) for (const m of doc.getRoot().listMeshes()) transformMesh(m, new Matrix4().makeRotationY(ASSETS[n].turn).elements);
      const b = getBounds(doc.getRoot().listScenes()[0]);
      const shift = new Matrix4().makeTranslation(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2).elements;
      for (const m of doc.getRoot().listMeshes()) transformMesh(m, shift);
      await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 92 }));
      await plain.write(join(REVIEW, 'in', `${n}.glb`), doc);
      const c = getBounds(doc.getRoot().listScenes()[0]);
      console.log(`bake     ${n.padEnd(18)} ${(c.max[1] - c.min[1]).toFixed(2)} tall, x ${c.min[0].toFixed(2)}…${c.max[0].toFixed(2)}, z ${c.min[2].toFixed(2)}…${c.max[2].toFixed(2)}`);
    }
  },
  async rig(names) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        const a = ASSETS[n];
        const baked = join(REVIEW, 'in', `${n}.glb`);
        if (a.uid ? !existsSync(baked) : !tasks[n]?.model) throw new Error(a.uid ? 'bake it first' : 'no model yet');
        if (!tasks[n]?.rig) {
          // a found model goes to the rigger as a data: URI (nothing public needed)
          const from = a.uid ? { model_url: `data:application/octet-stream;base64,${(await readFile(baked)).toString('base64')}` } : { input_task_id: tasks[n].model };
          tasks[n] ??= {};
          const { result } = await api('POST', '/v1/rigging', { ...from, height_meters: a.height });
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
      const out = a.rig ? OUT : a.crowd ? FULL : RM_OUT;
      await mkdir(out, { recursive: true });
      for (const [url, file, tex, clip] of files) {
        const raw = join(tmp, `${s.rig ?? s.model}-${file}`);
        if (!existsSync(raw)) await download(url, raw);
        await squeeze(raw, join(out, file), { tex, clip, ankles: clip ? false : (a.ankles ?? false), fix: clip ? null : (a.fix ?? null) });
      }
      if (a.uid) await creditFound(n, s.sketchfab, a);
      else credits[`meshy/${a.rig || a.crowd ? '' : 'rm/'}${n}`] = { source: 'https://www.meshy.ai', id: s.model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
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
    await save({ merge: false });
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
