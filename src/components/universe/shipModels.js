// The ships you can fly round the universe map, built from simple shapes
// the way the planets are: Luke's X-wing (four wings in an X, the red stripes,
// four engines), the Millennium Falcon (the saucer, the two mandibles, the
// cockpit off to the right, the blue glow across the back) and Rick's
// space cruiser, whose model from Portal panic takes over once it loads.
// Each part of one colour is merged into one mesh, so a ship is a handful of
// draws.
//
// buildShip(kind) → { group, setThrottle(0…1), mount(model) }
// Every ship points along −z, centred, about LENGTH long.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LENGTH = 0.36;

// Geometries placed by [position, rotation, scale], merged into one.
function parts(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const glowMat = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });

// along z: CylinderGeometry stands on y, so lay it down with its top forward
const tube = (rTop, rBottom, len, seg = 12) => new THREE.CylinderGeometry(rTop, rBottom, len, seg);
const LAY = [-Math.PI / 2, 0, 0];

function xwing() {
  const group = new THREE.Group();
  const wingSpan = 0.17;
  const wings = [];
  const stripes = [];
  const cannons = [];
  const engines = [];
  const glows = [];
  const lift = Math.sin(0.22); // the X: each wing climbs this much per unit out
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const tilt = sx * sy * 0.22;
      // a wing's height at a fraction `f` of the way from its root to its tip
      const at = (f) => [sx * (0.03 + wingSpan * f), sy * (0.012 + lift * wingSpan * f)];
      const [cx, cy] = at(0.5);
      const [stx, sty] = at(0.72);
      const [tx, ty] = at(1);
      wings.push([new THREE.BoxGeometry(wingSpan, 0.005, 0.075), [cx, cy, 0.06], [0, 0, tilt]]);
      stripes.push([new THREE.BoxGeometry(0.05, 0.0062, 0.022), [stx, sty, 0.045], [0, 0, tilt]]);
      cannons.push([tube(0.0035, 0.005, 0.2, 6), [tx, ty, 0.0], LAY]);
      engines.push([tube(0.018, 0.018, 0.1, 12), [sx * 0.045, sy * 0.028, 0.09], LAY]);
      glows.push([new THREE.CircleGeometry(0.014, 14), [sx * 0.045, sy * 0.028, 0.1405], [0, 0, 0]]);
    }
  }
  const white = new THREE.Mesh(
    parts([
      [tube(0.008, 0.032, 0.3, 4), [0, 0, -0.06], [-Math.PI / 2, Math.PI / 4, 0]], // the long nose
      [new THREE.BoxGeometry(0.075, 0.052, 0.1), [0, 0, 0.1]],
      ...wings,
      ...engines,
    ]),
    lambert('#dcd8cf'),
  );
  const red = new THREE.Mesh(parts([...stripes, [new THREE.BoxGeometry(0.03, 0.054, 0.02), [0, 0, 0.03]]]), lambert('#c0392b'));
  const dark = new THREE.Mesh(
    parts([
      ...cannons,
      [new THREE.SphereGeometry(0.022, 12, 8), [0, 0.024, -0.005], [0, 0, 0], [0.8, 0.55, 1.6]], // the canopy
      [new THREE.SphereGeometry(0.012, 10, 8), [0, 0.03, 0.06]], // Artoo's dome
    ]),
    lambert('#2a2f38'),
  );
  const glowM = glowMat('#ff7a4a');
  const glow = new THREE.Mesh(parts(glows), glowM);
  group.add(white, red, dark, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#ff7a4a') }] };
}

function falcon() {
  const group = new THREE.Group();
  const R = 0.165;
  const profile = [
    [0, 0.032],
    [0.05, 0.03],
    [0.12, 0.02],
    [R, 0.006],
    [R, -0.006],
    [0.12, -0.02],
    [0.05, -0.028],
    [0, -0.03],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hull = new THREE.Mesh(
    parts([
      [new THREE.LatheGeometry(profile, 44)],
      [new THREE.BoxGeometry(0.05, 0.024, 0.12), [-0.042, 0, -0.19]], // the mandibles
      [new THREE.BoxGeometry(0.05, 0.024, 0.12), [0.042, 0, -0.19]],
      [tube(0.016, 0.02, 0.09, 12), [0.15, 0.004, -0.08], [-Math.PI / 2, 0, 0.35]], // the cockpit tube
      [new THREE.SphereGeometry(0.02, 14, 10), [0.165, 0.004, -0.122]],
      [new THREE.CylinderGeometry(0.03, 0.034, 0.012, 16), [0, 0.034, 0.01]], // the top turret
    ]),
    lambert('#bdb9b0'),
  );
  const dark = new THREE.Mesh(
    parts([
      [new THREE.TorusGeometry(0.085, 0.004, 4, 40), [0, 0.027, 0], [Math.PI / 2, 0, 0]],
      [new THREE.TorusGeometry(0.135, 0.003, 4, 48), [0, 0.016, 0], [Math.PI / 2, 0, 0]],
      [new THREE.SphereGeometry(0.012, 10, 8), [0.172, 0.01, -0.135]], // the cockpit's windows
      [new THREE.CylinderGeometry(0.012, 0.02, 0.008, 12), [0.06, 0.04, -0.04]], // the dish
      [new THREE.BoxGeometry(0.03, 0.01, 0.03), [-0.08, 0.026, 0.05]],
      [new THREE.BoxGeometry(0.04, 0.01, 0.02), [0.07, 0.024, 0.07]],
    ]),
    lambert('#5d5f63'),
  );
  // the sublight engines: a blue band across the back of the saucer
  const glowM = glowMat('#8fd8ff');
  const band = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.009, 6, 32, 1.7), glowM);
  band.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.85);
  group.add(hull, dark, band);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#8fd8ff') }] };
}

// Until Portal panic's model of the cruiser arrives: a little saucer car
// with a glass dome, the same size.
function cruiser() {
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const body = new THREE.Mesh(
    parts([
      [new THREE.SphereGeometry(0.1, 20, 12), [0, 0, 0], [0, 0, 0], [1, 0.38, 1.6]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [-0.08, 0.015, 0.1], [0, 0, 0.4]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [0.08, 0.015, 0.1], [0, 0, -0.4]],
    ]),
    lambert('#a9b4b8'),
  );
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.6 }));
  dome.position.set(0, 0.025, -0.02);
  stand.add(body, dome);
  const glowM = glowMat('#9df06b');
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glowM);
  glow.position.set(0, 0, 0.162);
  group.add(stand, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#9df06b') }], stand, glowMesh: glow };
}

const BUILD = { xwing, falcon, cruiser };

export function buildShip(kind) {
  const ship = (BUILD[kind] ?? cruiser)();
  const pivot = new THREE.Group(); // banks and bobs inside the group the scene moves
  pivot.add(ship.group);
  const group = new THREE.Group();
  group.add(pivot);
  return {
    group,
    pivot,
    setThrottle(k) {
      for (const g of ship.glow) g.mat.color.copy(g.color).multiplyScalar(0.35 + 0.65 * k);
    },
    // the cruiser's model, when it comes: sized to the stand-in, which goes
    mount(model) {
      if (!ship.stand || !model) return false;
      const box = new THREE.Box3().setFromObject(model);
      const dims = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      const holder = new THREE.Group();
      holder.add(model);
      holder.scale.setScalar(LENGTH / Math.max(dims.x, dims.z, 1e-6));
      holder.rotation.y = Math.PI; // its nose is +z
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('metalness' in m) m.metalness = 0;
          if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.7);
        }
      });
      ship.stand.visible = false;
      ship.group.add(holder);
      ship.glowMesh.position.z = (dims.z / Math.max(dims.x, dims.z)) * (LENGTH / 2) + 0.004;
      return true;
    },
  };
}
