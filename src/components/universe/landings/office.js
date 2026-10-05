// Down on the Office's planet: the lot out back of Dunder Mifflin, in the
// Scranton Business Park. The building's back, the parked cars (Andy's red
// Trans Am among them), the light poles, the trees, the dumpster and the
// park's sign are the Office world's own lot (office/world/outside.js),
// without its sky and its ground: the planet's are here instead. And paper
// blows about it.

import * as THREE from 'three';
import { box, part } from '../../galaxy/surface/kit';
import { buildOutside } from '../../office/world/outside';
import { CARS, DUMPSTER, LIGHT_POLES, LOT, PARK_SIGN, TREES } from '../../office/world/layout';

export const PROPS = {
  // the lot, its middle at the origin: the building along its back (−x),
  // the cars in their bays, the sign at its front (+x)
  lot() {
    const made = buildOutside();
    const cx = LOT.x + LOT.w / 2;
    const cz = LOT.z + LOT.d / 2;
    // (not its sky, its grass or its asphalt: the planet has its own)
    for (const o of [...made.group.children]) {
      const p = o.geometry?.parameters;
      if (!p) continue;
      if (o.geometry.type === 'SphereGeometry' && p.radius > 100) made.group.remove(o);
      else if (o.geometry.type === 'PlaneGeometry' && (p.width >= 300 || (p.width === LOT.w && p.height === LOT.d))) made.group.remove(o);
    }
    made.group.position.set(-cx, 0, -cz);
    const object = new THREE.Group();
    object.name = 'lot';
    object.add(made.group);
    const at = (x, z) => [x - cx, z - cz];
    const solids = [
      { box: [LOT.x - cx - 0.2, 0, 0.5, LOT.d / 2 + 6] }, // the building
      ...CARS.map(([x, z, turn, , kind]) => ({ box: [...at(x, z), kind === 'suv' ? 0.95 : 0.9, kind === 'suv' ? 2.35 : 2.2, turn] })),
      ...LIGHT_POLES.map(([x, z]) => ({ circle: [...at(x, z), 0.4] })),
      ...TREES.map(([x, z]) => ({ circle: [...at(x, z), 0.3] })),
      { box: [...at(DUMPSTER.x, DUMPSTER.z), DUMPSTER.w / 2, DUMPSTER.d / 2] },
      { box: [...at(PARK_SIGN.x, PARK_SIGN.z), 1.8, 0.4, PARK_SIGN.turn] },
    ];
    return { object, solids };
  },
};

export const SCATTER = {
  // sheets of paper, blown out across the lot
  paper(k) {
    const g = new THREE.PlaneGeometry(0.21, 0.297).rotateX(-Math.PI / 2).translate(0, 0.01, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#f4f2ea', to: 'cloth' })]), material: k.mats.cloth }], radius: null };
  },
  // a box of reams, dropped off the dock
  reams(k) {
    const parts = [part(box(0.45, 0.28, 0.3), { color: '#d9cfb8', to: 'paint' }), part(box(0.46, 0.04, 0.31), { at: [0, 0.27, 0], color: '#3a5a8a', to: 'paint' })];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.paint }], radius: null };
  },
};
