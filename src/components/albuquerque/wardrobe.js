// Albuquerque's people, dressed as the shows dress them. Each has a figure
// of their own, made with Meshy (FIGURES, below); until it loads, or if it
// can't, they stand in from the same Quaternius packs as the Scranton office
// (see office/people.js): Jesse's
// hoodie, Tuco's shaved head, Mike's tan jacket, Gus's grey suit and glasses,
// Lydia's camel blazer, Saul's loud shirt and tie, Hank's polo, Hector's
// white hair, and Walt and Jesse in hazmat yellow at the bench.

const SKIN = { light: 0xe0b598, fair: 0xeac4a8, olive: 0xb88566, tan: 0xa8744f, brown: 0x6e4630 };

export const HAZMAT = 0xe8c21a;
const GLOVES = 0x1a1a1a;

const men = (id, head, body, legs, height, colors, extra = {}) => ({ id, pack: 'men', parts: [head, body, legs, 'feet_shoes'], height, colors, ...extra });
const women = (id, head, body, legs, height, colors, extra = {}) => ({ id, pack: 'women', parts: [head, body, legs, 'feet_shoes'], height, colors, ...extra });

// Who wears what: the packs' parts and colour slots, as in office/people.js.
export const ABQ = {
  jesse: men('jesse', 'head_short', 'body_hoodie', 'legs_jeans', 1.73, { skin: SKIN.fair, hair: 0x7a6248, top: 0xd2542a, legs: 0x3d4a66 }),
  badger: men('badger', 'head_messy', 'body_tee', 'legs_jeans', 1.8, { skin: SKIN.light, hair: 0x5a4632, top: 0x6b6f5a, legs: 0x39404c }),
  pete: men('pete', 'head_swept', 'body_tee', 'legs_jeans', 1.88, { skin: SKIN.light, hair: 0x3a2c22, top: 0x2b2d33, legs: 0x2e3440 }),
  tuco: men('tuco', 'head_bald', 'body_tee', 'legs_jeans', 1.73, { skin: SKIN.tan, brows: 0x1c1714, top: 0xeeeae2, legs: 0x3a4a63 }),
  mike: men('mike', 'head_bald', 'body_suit', 'legs_slacks', 1.8, { skin: SKIN.light, brows: 0x8a8278, top: 0xb39b74, shirt: 0x8e9590, tie: 0x8e9590, legs: 0x6e6252 }),
  gus: men('gus', 'head_short', 'body_suit', 'legs_slacks', 1.78, { skin: SKIN.brown, hair: 0x1a1512, top: 0x5f6368, shirt: 0xe9edf2, tie: 0x3c4048, legs: 0x5f6368 }, { glasses: 0x2a2a2a }),
  lydia: women('lydia', 'head_long', 'body_blazer', 'legs_slacks', 1.7, { skin: SKIN.fair, hair: 0x6e4a2e, brows: 0x4a3220, top: 0xb7966a, shirt: 0xf2ede2, legs: 0x2f3036 }),
  declan: men('declan', 'head_beard', 'body_suit', 'legs_slacks', 1.83, { skin: SKIN.light, hair: 0x4a3626, top: 0x2c3442, shirt: 0xe4e7ea, tie: 0xe4e7ea, legs: 0x2c3442 }),
  saul: men('saul', 'head_parted', 'body_suit', 'legs_slacks', 1.78, { skin: SKIN.light, hair: 0x8a6a4c, top: 0x8f9aa6, shirt: 0xe3a93c, tie: 0x7a2a5e, legs: 0x8f9aa6 }),
  hank: men('hank', 'head_bald', 'body_tee', 'legs_slacks', 1.85, { skin: SKIN.light, brows: 0x9a8a72, top: 0x6f7f62, legs: 0x9c8a6a }, { belly: 1.18 }),
  hector: men('hector', 'head_swept', 'body_tee', 'legs_slacks', 1.73, { skin: SKIN.olive, hair: 0xe8e6e0, brows: 0xd8d6d0, top: 0x9aa4ad, legs: 0x5a5e66 }),
  nurse: women('nurse', 'head_short', 'body_tee', 'legs_slacks', 1.65, { skin: SKIN.olive, hair: 0x2a1e18, top: 0x7fb3c8, legs: 0x7fb3c8, shoes: 0xe8e8e8 }),
  // at the bench: hazmat over everything, black gloves
  walt: men('walt', 'head_bald_moustache', 'body_suit', 'legs_slacks', 1.79, { skin: SKIN.light, moustache: 0x7a6a58, brows: 0x6a5a48, top: HAZMAT, shirt: HAZMAT, tie: HAZMAT, legs: HAZMAT }, { glasses: 0x2a2a2a, gloves: GLOVES }),
  jesseLab: men('jesseLab', 'head_short', 'body_suit', 'legs_slacks', 1.73, { skin: SKIN.fair, hair: 0x7a6248, top: HAZMAT, shirt: HAZMAT, tie: HAZMAT, legs: HAZMAT }, { gloves: GLOVES }),
};

// Their own figures, made for the site with Meshy AI
// (scripts/meshy-albuquerque.mjs): textured and rigged, posed by
// office/people.js like the rest. The packs' parts above stand in until a
// figure loads, or if it can't.
const FIGURES = { walt: 'walt', badger: 'badger' };
for (const [id, file] of Object.entries(FIGURES)) ABQ[id].model = `/models/albuquerque/${file}.glb`;

// How they take an order, by the mood it left them in.
const REACT = { great: 'cheer', good: 'nod', okay: 'shrug', bad: 'shake', restless: 'fold' };
export const moodGesture = (mood) => REACT[mood] ?? null;
