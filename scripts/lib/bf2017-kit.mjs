// A kit from the 2017 drop (EA DICE's Battlefront II): the pieces of one of
// a level's modular systems (Echo Base's hangar, its corridors, its walls)
// in one file, so a world loads the system once and lays its pieces where
// it likes. Each piece stays one node under its own name (the placement
// picks it by name) at the origin the game gave it, a corner or an edge (a
// piece's name carries its size, hangarlargewall_01_3072x2048: the level
// layouts place them, lane L's plan).
// A piece's own parts are joined, one primitive per material, and the
// pieces share the system's materials: a hangar of a hundred pieces is a
// few materials and their maps, not a few hundred (the texture contract is
// 60 a world).
//
// mergeKit([{ name, doc }]) → one Document (each piece's scene under a node
//   named `name`); kitIndex(doc) → { name: { min, max } } in metres, each
//   piece's box in its own frame; pieceName(manifest name) → what the kit
//   calls a piece (the name's last part, without the drop's `_mesh`).

import { Document } from '@gltf-transform/core';
import { dedup, flatten, join, mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
import { bounds } from './surface-model.mjs';

export const pieceName = (name) => name.split('/').pop().replace(/_mesh$/, '');

export async function mergeKit(pieces) {
  const out = new Document();
  const scene = out.createScene('kit');
  out.getRoot().setDefaultScene(scene);
  for (const { name, doc } of pieces) {
    // (the piece's parts made one, by material, before it joins the rest:
    // once among the others, its node's name keeps it apart)
    await doc.transform(flatten(), join({ keepNamed: false }));
    const map = mergeDocuments(out, doc);
    const holder = out.createNode(name);
    for (const s of doc.getRoot().listScenes()) {
      const theirs = map.get(s);
      for (const child of theirs.listChildren()) holder.addChild(child);
      theirs.dispose();
    }
    scene.addChild(holder);
  }
  // (by name too: the hangar's M_Wall and M_Floor are alike in everything
  // but the name, and a world dresses its walls and floors apart)
  await out.transform(unpartition(), dedup({ keepUniqueNames: true }), prune({ keepLeaves: true }));
  return out;
}

export function kitIndex(doc) {
  const out = {};
  for (const node of doc.getRoot().getDefaultScene().listChildren()) {
    const { min, max } = bounds(doc, node);
    const round = (v) => v.map((x) => Math.round(x * 1000) / 1000 + 0);
    out[node.getName()] = { min: round(min), max: round(max) };
  }
  return out;
}
