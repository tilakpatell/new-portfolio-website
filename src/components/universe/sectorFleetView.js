// The Rick and Morty sector's standing ships, drawn (sectorFleet.js has
// where they are): the wars' Meshy flagships (galaxy/models.js's
// `fedbattleship` and `councildread`), each in a slot of the scene's battle
// models, so the files are the ones the fleet war already loads. Nothing is
// loaded till the ship's first in the sector (`update`'s `here`).
//
// createSectorFleet(parent, models: () => createModels()) → { update(t, here), solids
//   (sectorFleet.js's sectorSolids while the ship's in the sector, else none), dispose() }

import * as THREE from 'three';
import { sectorShips, sectorSolids } from './sectorFleet';

export function createSectorFleet(parent, models) {
  const group = new THREE.Group();
  group.name = 'sector-fleet';
  group.visible = false;
  parent.add(group);
  let slots = null;
  let now = 0;
  let inSector = false;
  return {
    update(t, here) {
      now = t;
      inSector = here;
      group.visible = here;
      if (!here && !slots) return;
      if (!slots) {
        const m = models();
        slots = sectorShips(0).map((s) => {
          const slot = m.slot(s.kind, s.size);
          group.add(slot.holder);
          return slot;
        });
      }
      if (!here) return;
      models().update?.(t); // (a stand-in's moving parts, till the model's here)
      const ships = sectorShips(t);
      for (let i = 0; i < ships.length; i++) {
        const s = ships[i];
        slots[i].holder.position.set(s.at[0], s.at[1], s.at[2]);
        // (a slot's model points its nose along +z; ship.js's heading 0 is −z)
        slots[i].holder.rotation.set(0, s.heading + Math.PI, 0);
      }
    },
    get solids() {
      return inSector ? sectorSolids(now) : [];
    },
    dispose() {
      parent.remove(group);
    },
  };
}
