// The people of the worlds made with Meshy (scripts/meshy-galaxy.mjs:
// public/models/galaxy/crew/), each rigged on a humanoid skeleton and
// walked with Rick's clips, borrowed (universe/footScene.js's
// loadPartyFigure); Jabba stands still, as he was made. A figure kind
// with one of these is that model; one without is built (figures.js).
//
// crewFigure(kind) → { model (in metres), tall, update(dt, move), dispose }
// or null

import * as THREE from 'three';
import { loadPartyFigure } from '../../universe/footScene';
import { METRE } from '../../universe/foot';
import { CREW, fileOf } from './crewList';
import { cloneModel, loadGlb } from './placer';

// (the list itself is crewList.js, plain data a page can read)
export { CREW, fileOf };

export async function crewFigure(kind) {
  const c = CREW[kind];
  if (!c) return null;
  if (c.still) {
    const gltf = await loadGlb(fileOf(c));
    if (!gltf) return null;
    const model = cloneModel(gltf);
    const body = new THREE.Group();
    body.add(model);
    let t = Math.random() * 10;
    return {
      model: body,
      tall: c.tall,
      // (breathing)
      update(dt) {
        t += dt;
        model.scale.set(1 + Math.sin(t * 1.1) * 0.012, 1 + Math.sin(t * 1.1) * 0.018, 1);
      },
      dispose() {},
    };
  }
  const fig = await loadPartyFigure({ id: kind, name: kind, tall: c.tall, src: { url: fileOf(c) } }, null).catch(() => null);
  if (!fig) return null;
  const model = new THREE.Group();
  model.scale.setScalar(1 / METRE);
  model.add(fig.model);
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { model, tall: c.tall, update: (dt, move) => fig.update(dt, move), dispose: () => fig.dispose() };
}
