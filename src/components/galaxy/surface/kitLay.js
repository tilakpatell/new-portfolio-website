// A kit of the game's modular pieces (scripts/bf2017-kit.mjs: one file, a
// node a piece by its name, each at the origin the game gave it) laid out
// as a world's layout says, and dressed. Every copy shares the kit's
// geometry and materials, so a hangar of six pieces is the kit's few
// materials and their maps, however many times a piece is laid.
//
// layKit(kit, [{ piece, at: [x, y, z], yaw, mirror, stretch }], { skip }) →
//   a Group of the pieces (userData.missing: the names the kit hasn't got),
//   each `stretch` times as wide (a run of wall rarely a whole number of
//   panels), its parts in the materials named in `skip` left out (the wall
//   system's floor strips, where a world lays its own floor)
// dressKit(kit, { [material name]: { color, roughness, role } }, { wear })
//   → how many materials it dressed: for the pieces whose maps the drop
//   hasn't got (Echo Base's hangar shells come bare), the world's own
//   colour and its scan (`role`, the kit.js LOOKS the world's built
//   props wear), so the world keeps one look; `wear(material, role)` lays
//   the scan on (placer.js's, by default).

import * as THREE from 'three';

export function layKit(kit, layout, { skip = [] } = {}) {
  const byName = new Map(kit.children.map((c) => [c.name, c]));
  const group = new THREE.Group();
  group.userData.missing = [];
  for (const p of layout) {
    const src = byName.get(p.piece);
    if (!src) {
      group.userData.missing.push(p.piece);
      continue;
    }
    const o = src.clone();
    if (skip.length) {
      const drop = [];
      o.traverse((m) => m.isMesh && skip.includes(m.material?.name) && drop.push(m));
      for (const m of drop) m.removeFromParent();
    }
    o.position.set(...p.at);
    o.rotation.set(0, p.yaw ?? 0, 0);
    // (a mirror is a negative scale: three turns the faces round for it)
    o.scale.set((p.mirror ? -1 : 1) * (p.stretch ?? 1), 1, 1);
    group.add(o);
  }
  return group;
}

export async function dressKit(kit, dress, { wear }) {
  const seen = new Set();
  kit.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && dress[m.name]) seen.add(m);
  });
  for (const m of seen) {
    const d = dress[m.name];
    if (d.color) m.color.set(d.color);
    if (d.roughness != null) m.roughness = d.roughness;
  }
  await Promise.all([...seen].map((m) => dress[m.name].role && wear(m, dress[m.name].role)));
  return seen.size;
}
