// A level's placed decals (lane E0): the map extras' `decals[]` (a volume
// decal is the unit cube scaled by `scale`, a box projector; a projected
// one a quad on its shader), each with its colour map from its template's
// shader's textures (`decalTemplates`, `shaderTextures`, `textureFiles`), in
// the pack's frame and by cell. A decal with no colour (normal-only dents)
// or whose map the bucket lacks is skipped and counted. Pure; the CLI cuts
// the maps into the pack (src/lib/three/decals.js draws them).
//
//   decalTexture(extras, decal) → the web build's KTX2 path | null
//   decalsJson(extras, pack, { listing, subworlds, subs }) → { decals: [{ kind,
//     position, quaternion, scale, tex, alpha, cell }], skipped: { why: n }, missing: [path] }

// (a colour, not a ramp, a noise, a mask, a normal or the engine's default)
const COLOUR = /_(C|CS|RGB|RGBA|D|CA)$/i;
const NOT = /Default|Perlin|BlackBody|_N$|_NS$|_M$|_MASK$/i;

export function decalTexture(extras, d) {
  const shader = d.shader ?? extras.decalTemplates?.[d.template]?.Shader?.Shader;
  const names = extras.shaderTextures?.[shader] ?? [];
  const name = names.find((n) => COLOUR.test(n) && !NOT.test(n));
  return name ? (extras.textureFiles?.[name] ?? null) : null;
}

const r2 = (v) => Math.round(v * 1000) / 1000;
const lastName = (s) => String(s?.name ?? s).split('/').pop().toLowerCase();

export function decalsJson(extras, pack, { listing, subworlds, subs }) {
  const want = new Set(subs.map((s) => s.toLowerCase()));
  const [ox, oy, oz] = pack.origin;
  const yaw = pack.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const cell = pack.cell ?? 128;
  const arena = pack.arena ?? Infinity;
  const decals = [];
  const skipped = {};
  const missing = new Set();
  const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
  for (const d of extras.decals ?? []) {
    if (!want.has(lastName(subworlds[d.sub]))) {
      skip('another sub-level');
      continue;
    }
    const tex = decalTexture(extras, d);
    if (!tex) {
      skip('normal only');
      continue;
    }
    if (!listing.has(`web/${tex}`)) {
      missing.add(tex);
      skip('not in the bucket');
      continue;
    }
    const x = d.position[0] - ox;
    const z = d.position[2] - oz;
    const at = [r2(x * c + z * s), r2(d.position[1] - oy), r2(-x * s + z * c)];
    if (Math.abs(at[0]) > arena || Math.abs(at[2]) > arena) {
      skip('beyond the arena');
      continue;
    }
    const [qx, qy, qz, qw] = d.quaternion ?? [0, 0, 0, 1];
    const q = [hw * qx + hy * qz, hw * qy + hy * qw, hw * qz - hy * qx, hw * qw - hy * qy].map(r2);
    decals.push({ kind: d.type === 'projected' ? 'projected' : 'volume', position: at, quaternion: q, scale: d.scale.map(r2), tex, alpha: d.alpha ?? 1, cell: `${Math.floor(at[0] / cell)},${Math.floor(at[2] / cell)}` });
  }
  return { decals, skipped, missing: [...missing].sort() };
}
