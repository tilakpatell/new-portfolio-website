// The ships you can fly round the universe map: Luke's X-wing, the
// Millennium Falcon and Walt and Jesse's RV with its home-made wings, the
// site owner's Meshy models of them once they load (until then, or without
// them, ones built from simple shapes: four wings in an X, the red stripes,
// four engines; the saucer, the two mandibles, the cockpit off to the right;
// a camper with a wing each side and a jet under each); and Rick's space
// cruiser, the classic saucer from the C-137 page with Rick at the wheel and
// Morty beside him (rickmorty/cruiser3d.js), once it loads.
// Each part of one colour is merged into one mesh, so a ship is a handful of
// draws.
//
// buildShip(kind, textures) → { group, setThrottle(0…1), mount(model, extra), update(t), dispose() }
// Every ship points along −z, centred, about LENGTH long (they're built at
// BUILT long and scaled down as a whole).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiled } from './kit';

export const LENGTH = 0.26; // small against the planets
export const BUILT = 0.36; // the length the ships below are built at

// Geometries placed by [position, rotation, scale], merged into one.
function parts(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

const lambert = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
// a hull of real plates (or plain, if the textures didn't come)
const plated = (T, color, which, repeat, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    map: which === 'hull' ? tiled(T.hull, repeat, repeat) : null,
    normalMap: tiled(T[`${which}-normal`], repeat, repeat),
    roughnessMap: tiled(T[`${which}-rough`], repeat, repeat),
    roughness: 1,
    metalness: 0.2,
    ...extra,
  });
const glowMat = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });

// along z: CylinderGeometry stands on y, so lay it down with its top forward
const tube = (rTop, rBottom, len, seg = 12) => new THREE.CylinderGeometry(rTop, rBottom, len, seg);
const LAY = [-Math.PI / 2, 0, 0];

function xwing(T) {
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
      glows.push([new THREE.CircleGeometry(0.014, 14), [sx * 0.045, sy * 0.028, 0], [0, 0, 0]]);
    }
  }
  const white = new THREE.Mesh(
    parts([
      [tube(0.008, 0.032, 0.3, 4), [0, 0, -0.06], [-Math.PI / 2, Math.PI / 4, 0]], // the long nose
      [new THREE.BoxGeometry(0.075, 0.052, 0.1), [0, 0, 0.1]],
      ...wings,
      ...engines,
    ]),
    plated(T, '#e2ded5', 'plates', 3),
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
  glow.position.z = 0.1405;
  const stand = new THREE.Group();
  stand.add(white, red, dark);
  group.add(stand, glow);
  // the model's nose is +z, and its engines sit a little closer in than these
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#ff7a4a') }], stand, glowMesh: glow, nose: Math.PI, glowOnModel: [0.78, 0.96] };
}

function falcon(T) {
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
    plated(T, '#d6d1c6', 'hull', 2),
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
  // the sublight engines: a blue band across the back of the saucer (the
  // model has its own, painted on)
  const glowM = glowMat('#8fd8ff');
  const band = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.009, 6, 32, 1.7), glowM);
  band.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.85);
  const stand = new THREE.Group();
  stand.add(hull, dark, band);
  group.add(stand);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#8fd8ff') }], stand, nose: FALCON_NOSE };
}

// Until the C-137 page's cruiser arrives: a little saucer car with a glass
// dome, the same size.
function cruiser(T) {
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const body = new THREE.Mesh(
    parts([
      [new THREE.SphereGeometry(0.1, 20, 12), [0, 0, 0], [0, 0, 0], [1, 0.38, 1.6]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [-0.08, 0.015, 0.1], [0, 0, 0.4]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [0.08, 0.015, 0.1], [0, 0, -0.4]],
    ]),
    plated(T, '#b4bfc3', 'plates', 1),
  );
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.6 }));
  dome.position.set(0, 0.025, -0.02);
  stand.add(body, dome);
  const glowM = glowMat('#9df06b');
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glowM);
  glow.position.set(0, 0, 0.162);
  group.add(stand, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#9df06b') }], stand, glowMesh: glow, nose: Math.PI }; // its model's nose (the headlights) is +z
}

// where the RV model's jets end (either side, low, a little ahead of the
// middle), measured from the model in the frame it's built in
const POD = [0.098, -0.0505, -0.029];

// Walt and Jesse's RV, until its model comes: a boxy camper (the cab under
// the cab-over, a dark band of windows, the brown stripe, the wheels) with
// a straight wing bolted on each side at floor height and a jet hanging
// under each. Built to the model's own proportions (it's the wingspan that's
// BUILT across), so the jets' glow sits where the model's exhausts are too
// and stays put when the model comes.
function rv() {
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const pods = [];
  const wingStripes = [];
  const wheels = [];
  const glows = [];
  for (const sx of [-1, 1]) {
    pods.push([tube(0.0105, 0.0085, 0.05), [sx * POD[0], POD[1] - 0.0025, -0.055], LAY]); // the intake forward
    pods.push([new THREE.BoxGeometry(0.004, 0.012, 0.02), [sx * POD[0], -0.041, -0.055]]); // the pylon
    wingStripes.push([new THREE.BoxGeometry(0.014, 0.008, 0.0535), [sx * 0.14, -0.038, -0.05]]);
    for (const z of [-0.085, 0.062]) wheels.push([tube(0.015, 0.015, 0.014, 12), [sx * 0.048, -0.055, z], [0, 0, Math.PI / 2]]);
    glows.push([new THREE.CircleGeometry(0.0095, 14), [sx * POD[0], POD[1], POD[2]]]);
  }
  const body = new THREE.Mesh(
    parts([
      [new THREE.BoxGeometry(0.11, 0.115, 0.19), [0, 0.008, 0.025]], // the living box
      [new THREE.BoxGeometry(0.106, 0.04, 0.034), [0, 0.042, -0.084]], // the cab-over
      [new THREE.BoxGeometry(0.104, 0.072, 0.052), [0, -0.014, -0.094]], // the cab
      [new THREE.BoxGeometry(0.36, 0.007, 0.052), [0, -0.038, -0.05]], // the wings, one plank right across
    ]),
    lambert('#ebe2cc'),
  );
  const brown = new THREE.Mesh(parts([[new THREE.BoxGeometry(0.1126, 0.009, 0.1926), [0, 0, 0.025]], [new THREE.BoxGeometry(0.1066, 0.009, 0.052), [0, 0, -0.094]], ...wingStripes]), lambert('#8a5a34'));
  const dark = new THREE.Mesh(
    parts([
      [new THREE.BoxGeometry(0.1124, 0.02, 0.15), [0, 0.034, 0.035]], // the side windows
      [new THREE.BoxGeometry(0.1064, 0.022, 0.03), [0, 0.005, -0.1]], // the cab's
      [new THREE.BoxGeometry(0.09, 0.024, 0.004), [0, 0.005, -0.12]], // the windscreen
      [new THREE.BoxGeometry(0.044, 0.02, 0.004), [0, 0.034, 0.12]], // the back window
      [new THREE.BoxGeometry(0.112, 0.01, 0.006), [0, -0.047, 0.12]], // the bumper
      ...wheels,
    ]),
    lambert('#2b2d33'),
  );
  const grey = new THREE.Mesh(parts([...pods, [new THREE.BoxGeometry(0.04, 0.012, 0.04), [0, 0.07, 0.04]]]), lambert('#8d9097', { metalness: 0.3 }));
  stand.add(body, brown, dark, grey);
  const glowM = glowMat('#ffa04a');
  group.add(stand, new THREE.Mesh(parts(glows), glowM));
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#ffa04a') }], stand, nose: -Math.PI / 2 }; // its model's cab is −x
}

// Where each ship's engines are, inside its pivot (in BUILT units, nose −z):
// the plumes leave from here (trail.js). The cruiser's are its exhaust cans,
// read off its model once it's mounted (see scene.js); these stand in.
export const ENGINES = {
  xwing: [
    [-0.035, 0.027, 0.18],
    [0.035, 0.027, 0.18],
    [-0.035, -0.027, 0.18],
    [0.035, -0.027, 0.18],
  ],
  falcon: [
    [-0.06, 0.004, 0.142],
    [0, 0.004, 0.148],
    [0.06, 0.004, 0.142],
  ],
  cruiser: [
    [-0.115, 0, 0.17],
    [0.115, 0, 0.17],
  ],
  // the RV's two jets, one under each wing
  rv: [
    [-POD[0], POD[1], POD[2]],
    [POD[0], POD[1], POD[2]],
  ],
};

// which way the Falcon model's nose points, as a turn about y (see buildShip)
const FALCON_NOSE = Math.PI / 2;

const BUILD = { xwing, falcon, cruiser, rv };

// the models that take over from the built ships, when they load (the
// cruiser is built by the C-137 page's own code instead; see scene.js)
// (the X-wing is the trench run's own, so a visitor who's flown one has it already)
export const SHIP_MODELS = { falcon: '/models/universe/falcon.glb', xwing: '/models/meshy/x-wing-fighter.glb', rv: '/models/universe/rv-wings.glb' };

export function buildShip(kind, T = {}) {
  const ship = (BUILD[kind] ?? cruiser)(T);
  const pivot = new THREE.Group(); // banks and bobs inside the group the scene moves
  pivot.scale.setScalar(LENGTH / BUILT);
  pivot.add(ship.group);
  const group = new THREE.Group();
  group.add(pivot);
  let mounted = null;
  return {
    update(t) {
      mounted?.update?.(t);
    },
    dispose() {
      mounted?.dispose?.();
    },
    group,
    pivot,
    setThrottle(k) {
      for (const g of ship.glow) g.mat.color.copy(g.color).multiplyScalar(0.5 + 2.8 * k); // past 1 at speed, so it blooms
    },
    // the ship's model, when it comes: sized to the stand-in, which goes.
    // `extra` is what a built model brings: update(t) each frame, dispose(),
    // and whether it has its own engine glow
    mount(model, extra = {}) {
      if (!ship.stand || !model) return false;
      mounted = extra;
      const box = new THREE.Box3().setFromObject(model);
      const dims = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      const holder = new THREE.Group();
      holder.add(model);
      holder.scale.setScalar(BUILT / Math.max(dims.x, dims.z, 1e-6));
      holder.rotation.y = ship.nose ?? 0; // turned so its nose points along −z
      // painted metal: a little of the space round it reflects in the hull,
      // its maps sharp at a grazing angle (the chase camera's)
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('metalness' in m) m.metalness = 0.22;
          if ('roughness' in m) m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.42), 0.68);
          if ('envMapIntensity' in m) m.envMapIntensity = 0.9;
          for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.emissiveMap]) if (tex) tex.anisotropy = 8;
        }
      });
      ship.stand.visible = false;
      ship.group.add(holder);
      if (extra.ownGlow && ship.glowMesh) ship.glowMesh.visible = false;
      // the engines' glow at its tail, where the ship has one of its own
      // (its length runs along x if it was turned a quarter)
      if (ship.glowMesh) {
        const along = Math.abs(Math.sin(holder.rotation.y)) > 0.5 ? dims.x : dims.z;
        ship.glowMesh.position.z = (along / Math.max(dims.x, dims.z)) * (BUILT / 2) + 0.004;
        if (ship.glowOnModel) ship.glowMesh.scale.set(...ship.glowOnModel, 1);
      }
      return true;
    },
  };
}
