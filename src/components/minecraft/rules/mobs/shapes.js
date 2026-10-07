// Minecraft, the mobs' models as the game builds them (1.12's ModelBiped,
// ModelQuadruped and the rest), as data: each part a pivot (rotationPoint)
// and boxes (addBox) in pixels, sixteen to a block, in the game's own model
// space — y down, the ground at y 24, the front toward −z, the mob's right
// toward −x — with the box's texture offset, its inflation and whether it's
// mirrored. Static turns (a quadruped's body lies along z, the spider's legs
// splay) are `rot` [x, y, z] in radians, applied z, then y, then x, as
// ModelRenderer does. A skin from any pack lands on the right faces because
// every one is painted to these nets.
//
// MODELS[kind] = { texture: [w, h], parts: [{ name, pivot, rot?, boxes: [{ tex, at, size, inflate?, mirror? }] }] }

const box = (tex, at, size, more = {}) => ({ tex, at, size, ...more });
const part = (name, pivot, boxes, rot = null) => ({ name, pivot, boxes, ...(rot ? { rot } : {}) });
const HALF_PI = Math.PI / 2;

// ModelBiped: a head with its hat, a body, two arms and two legs
function biped({ tex = [64, 64], y = 0, arms = [4, 12, 4], legs = [4, 12, 4], player = false, hat = true } = {}) {
  const [aw, , ad] = arms;
  const [lw, , ld] = legs;
  const thin = aw === 2;
  const parts = [
    part('head', [0, y, 0], [box([0, 0], [-4, -8, -4], [8, 8, 8]), ...(hat ? [box([32, 0], [-4, -8, -4], [8, 8, 8], { inflate: 0.5 })] : [])]),
    part('body', [0, y, 0], [box([16, 16], [-4, 0, -2], [8, 12, 4]), ...(player ? [box([16, 32], [-4, 0, -2], [8, 12, 4], { inflate: 0.25 })] : [])]),
    part('rightArm', [-5, 2 + y, 0], [box([40, 16], [thin ? -1 : -3, -2, -ad / 2], arms), ...(player ? [box([40, 32], [-3, -2, -2], arms, { inflate: 0.25 })] : [])]),
    part('leftArm', [5, 2 + y, 0], player ? [box([32, 48], [-1, -2, -2], arms), box([48, 48], [-1, -2, -2], arms, { inflate: 0.25 })] : [box([40, 16], [-1, -2, -ad / 2], arms, { mirror: true })]),
    part('rightLeg', [thin ? -2 : -1.9, 12 + y, 0], [box([0, 16], [-lw / 2, 0, -ld / 2], legs), ...(player ? [box([0, 32], [-2, 0, -2], legs, { inflate: 0.25 })] : [])]),
    part('leftLeg', [thin ? 2 : 1.9, 12 + y, 0], player ? [box([16, 48], [-2, 0, -2], legs), box([0, 48], [-2, 0, -2], legs, { inflate: 0.25 })] : [box([0, 16], [-lw / 2, 0, -ld / 2], legs, { mirror: true })]),
  ];
  return { texture: tex, parts };
}

// ModelQuadruped(height): a head, a body lying along z, four legs
function quadruped({ height, head, headAt, body, bodyAt, bodyTex = [28, 8], legs = [4, height, 4], legAt = [3, 7, -5], extra = {} }) {
  const legY = 24 - height;
  const [lx, lz0, lz1] = legAt;
  const leg = (name, x, z) => part(name, [x, legY, z], [box([0, 16], [-2, 0, -2], legs, extra.leg)]);
  return {
    texture: [64, 32],
    parts: [
      part('head', headAt, [box([0, 0], head[0], head[1], extra.head), ...(extra.headBoxes ?? [])]),
      part('body', bodyAt, [box(bodyTex, body[0], body[1], extra.body), ...(extra.bodyBoxes ?? [])], [HALF_PI, 0, 0]),
      leg('leg1', -lx - (extra.legOut ?? 0), lz0),
      leg('leg2', lx + (extra.legOut ?? 0), lz0),
      leg('leg3', -lx - (extra.legOut ?? 0), lz1 - (extra.legIn ?? 0)),
      leg('leg4', lx + (extra.legOut ?? 0), lz1 - (extra.legIn ?? 0)),
    ],
  };
}

const SPIDER_LEG = (n, side, z, rz, ry) => part(`leg${n}`, [side * 4, 15, z], [box([18, 0], [side < 0 ? -15 : -1, -1, -1], [16, 2, 2])], [0, ry, rz]);
const Q = Math.PI / 4;
const E = 0.3926991;

export const MODELS = {
  // the player (ModelPlayer, wide arms) with its outer layers
  player: biped({ player: true }),
  zombie: biped(),
  skeleton: biped({ tex: [64, 32], arms: [2, 12, 2], legs: [2, 12, 2] }),
  creeper: {
    texture: [64, 32],
    parts: [
      part('head', [0, 6, 0], [box([0, 0], [-4, -8, -4], [8, 8, 8])]),
      part('body', [0, 6, 0], [box([16, 16], [-4, 0, -2], [8, 12, 4])]),
      ...[
        ['leg1', -2, 4],
        ['leg2', 2, 4],
        ['leg3', -2, -4],
        ['leg4', 2, -4],
      ].map(([n, x, z]) => part(n, [x, 18, z], [box([0, 16], [-2, 0, -2], [4, 6, 4])])),
    ],
  },
  pig: quadruped({ height: 6, head: [[-4, -4, -8], [8, 8, 8]], headAt: [0, 12, -6], body: [[-5, -10, -7], [10, 16, 8]], bodyAt: [0, 11, 2], extra: { headBoxes: [box([16, 16], [-2, 0, -9], [4, 3, 1])] } }),
  cow: quadruped({
    height: 12,
    head: [[-4, -4, -6], [8, 8, 6]],
    headAt: [0, 4, -8],
    body: [[-6, -10, -7], [12, 18, 10]],
    bodyAt: [0, 5, 2],
    bodyTex: [18, 4],
    extra: {
      headBoxes: [box([22, 0], [-5, -5, -4], [1, 3, 1]), box([22, 0], [4, -5, -4], [1, 3, 1])],
      bodyBoxes: [box([52, 0], [-2, 2, -8], [4, 6, 1])],
      legOut: 1,
      legIn: 1,
    },
  }),
  sheep: quadruped({ height: 12, head: [[-3, -4, -6], [6, 6, 8]], headAt: [0, 6, -8], body: [[-4, -10, -7], [8, 16, 6]], bodyAt: [0, 5, 2] }),
  // the fleece over the sheep (its own texture), inflated as ModelSheep1's
  sheep_wool: quadruped({
    height: 12,
    head: [[-3, -4, -4], [6, 6, 6]],
    headAt: [0, 6, -8],
    body: [[-4, -10, -7], [8, 16, 6]],
    bodyAt: [0, 5, 2],
    legs: [4, 6, 4],
    extra: { head: { inflate: 0.6 }, body: { inflate: 1.75 }, leg: { inflate: 0.5 } },
  }),
  chicken: {
    texture: [64, 32],
    parts: [
      part('head', [0, 15, -4], [box([0, 0], [-2, -6, -2], [4, 6, 3]), box([14, 0], [-2, -4, -4], [4, 2, 2]), box([14, 4], [-1, -2, -3], [2, 2, 2])]),
      part('body', [0, 16, 0], [box([0, 9], [-3, -4, -3], [6, 8, 6])], [HALF_PI, 0, 0]),
      part('rightLeg', [-2, 19, 1], [box([26, 0], [-1, 0, -3], [3, 5, 3])]),
      part('leftLeg', [1, 19, 1], [box([26, 0], [-1, 0, -3], [3, 5, 3])]),
      part('rightWing', [-4, 13, 0], [box([24, 13], [0, 0, -3], [1, 4, 6])]),
      part('leftWing', [4, 13, 0], [box([24, 13], [-1, 0, -3], [1, 4, 6])]),
    ],
  },
  spider: {
    texture: [64, 32],
    parts: [
      part('head', [0, 15, -3], [box([32, 4], [-4, -4, -8], [8, 8, 8])]),
      part('neck', [0, 15, 0], [box([0, 0], [-3, -3, -3], [6, 6, 6])]),
      part('body', [0, 15, 9], [box([0, 12], [-5, -4, -6], [10, 8, 12])]),
      SPIDER_LEG(1, -1, 2, -Q, 2 * E),
      SPIDER_LEG(2, 1, 2, Q, -2 * E),
      SPIDER_LEG(3, -1, 1, -Q * 0.74, E),
      SPIDER_LEG(4, 1, 1, Q * 0.74, -E),
      SPIDER_LEG(5, -1, 0, -Q * 0.74, -E),
      SPIDER_LEG(6, 1, 0, Q * 0.74, E),
      SPIDER_LEG(7, -1, -1, -Q, -2 * E),
      SPIDER_LEG(8, 1, -1, Q, 2 * E),
    ],
  },
  enderman: {
    texture: [64, 32],
    parts: [
      part('head', [0, -14, 0], [box([0, 0], [-4, -8, -4], [8, 8, 8]), box([0, 16], [-4, -8, -4], [8, 8, 8], { inflate: -0.5 })]),
      part('body', [0, -14, 0], [box([32, 16], [-4, 0, -2], [8, 12, 4])]),
      part('rightArm', [-5, -12, 0], [box([56, 0], [-1, -2, -1], [2, 30, 2])]),
      part('leftArm', [5, -12, 0], [box([56, 0], [-1, -2, -1], [2, 30, 2], { mirror: true })]),
      part('rightLeg', [-2, -5, 0], [box([56, 0], [-1, 0, -1], [2, 30, 2])]),
      part('leftLeg', [2, -5, 0], [box([56, 0], [-1, 0, -1], [2, 30, 2], { mirror: true })]),
    ],
  },
  villager: {
    texture: [64, 64],
    parts: [
      part('head', [0, 0, 0], [box([0, 0], [-4, -10, -4], [8, 10, 8]), box([24, 0], [-1, -3, -6], [2, 4, 2])]),
      part('body', [0, 0, 0], [box([16, 20], [-4, 0, -3], [8, 12, 6]), box([0, 38], [-4, 0, -3], [8, 18, 6], { inflate: 0.5 })]),
      part('arms', [0, 3, -1], [box([44, 22], [-8, -2, -2], [4, 8, 4]), box([44, 22], [4, -2, -2], [4, 8, 4], { mirror: true }), box([40, 38], [-4, 2, -2], [8, 4, 4])], [-0.75, 0, 0]),
      part('rightLeg', [-2, 12, 0], [box([0, 22], [-2, 0, -2], [4, 12, 4])]),
      part('leftLeg', [2, 12, 0], [box([0, 22], [-2, 0, -2], [4, 12, 4], { mirror: true })]),
    ],
  },
};

// The six faces of a box as ModelBox makes them: in its order (+x, −x, top,
// bottom, front −z, back +z), each four corners (model space, pixels) with
// the texel each takes (pixels on the skin). Mirrored, the box's x ends swap
// (so the texture flips) and each face's corners reverse (so it still faces out).
export function boxFaces({ tex: [u, v], at: [x, y, z], size: [w, h, d], inflate = 0, mirror = false }) {
  let x1 = x - inflate;
  let x2 = x + w + inflate;
  const y1 = y - inflate;
  const y2 = y + h + inflate;
  const z1 = z - inflate;
  const z2 = z + d + inflate;
  if (mirror) [x1, x2] = [x2, x1];
  const P = [
    [x1, y1, z1],
    [x2, y1, z1],
    [x2, y2, z1],
    [x1, y2, z1],
    [x1, y1, z2],
    [x2, y1, z2],
    [x2, y2, z2],
    [x1, y2, z2],
  ];
  // TexturedQuad: corners 0..3 take (u2, v1), (u1, v1), (u1, v2), (u2, v2)
  const quad = (ids, u1, v1, u2, v2) => {
    const uv = [
      [u2, v1],
      [u1, v1],
      [u1, v2],
      [u2, v2],
    ];
    const out = ids.map((i, k) => ({ p: P[i], uv: uv[k] }));
    return mirror ? out.reverse() : out;
  };
  return [
    quad([5, 1, 2, 6], u + d + w, v + d, u + d + w + d, v + d + h),
    quad([0, 4, 7, 3], u, v + d, u + d, v + d + h),
    quad([5, 4, 0, 1], u + d, v, u + d + w, v + d),
    quad([2, 3, 7, 6], u + d + w, v + d, u + d + w + w, v),
    quad([1, 0, 3, 2], u + d, v + d, u + d + w, v + d + h),
    quad([4, 5, 6, 7], u + d + d + w, v + d, u + d + d + w + w, v + d + h),
  ];
}

// the texels of a box's 24 corners, as fractions of the skin (u across, v down)
export function uvFor(b, [tw, th]) {
  const out = new Float32Array(48);
  boxFaces(b).forEach((face, f) => face.forEach(({ uv }, k) => out.set([uv[0] / tw, uv[1] / th], (f * 4 + k) * 2)));
  return out;
}
