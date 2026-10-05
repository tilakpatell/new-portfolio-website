// The Space Cruiser in 3D for the flight down the Rick and Morty page
// (./CruiserFlight.jsx): the Meshy model of the classic saucer with Rick at
// the wheel and Morty beside him, both sat in their seats (Meshy's seated
// clip) under the glass dome, toon-shaded and
// inked like Portal panic, on a small see-through canvas that the page moves
// about. Here it only turns: pose() points the nose the way it's flying
// (swinging round through facing you as it swoops from one side to the
// other), dips it as it drops, banks it and rolls it into a portal.
// Loaded only where 3D is on; null if anything won't start.

import * as THREE from 'three';
import { createMeshyCast } from './portal/meshyCast';
import { pixelRatio } from '../../lib/device';
import { precompile, quiet, releaseContext } from '../../lib/three/renderer';

const INK = 0x1b1424;
const TALL = 1.7; // the saucer's height, in the scene's units (it's 2.7 across)
const SPAN = 2.4; // half the canvas's width, in the same units
const GLASS = 0.69; // the share of the saucer's height where the hull stops and the dome starts
// how tall Rick and Morty would stand, and where they sit: across (Rick on
// the right as you look at the nose, as in the show), forward, and the
// height of their feet, sat (the saucer's units, nose +z)
const CREW = { rick: [1.1, 0.27], morty: [0.92, -0.29], z: 0.05, y: 0.82 };
// the backs of the two exhaust cans
const CANS = [[0.87, 1.0, -1.3], [-0.87, 1.0, -1.3]];

// an ink line round a mesh, skinned or not: its back faces drawn flat,
// pushed out along the normals once posed, in view space (so `width` is in
// the scene's units whatever scale the model or its skeleton has)
// (none above `clipY`, in the mesh's own units: the cruiser's glass)
function inkHull(root, width, clipY = null) {
  const mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('void main() {', 'varying float vInkY;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vInkY = position.y;
          #ifdef USE_SKINNING
            vec3 inkN = normalize(transformedNormal);
          #else
            vec3 inkN = normalize(normalMatrix * normal);
          #endif
          mvPosition.xyz += inkN * ${width.toFixed(4)};
          gl_Position = projectionMatrix * mvPosition;
        }`,
      );
    s.fragmentShader = s.fragmentShader.replace('void main() {', `varying float vInkY;\nvoid main() {\n${clipY == null ? '' : `if (vInkY > ${clipY.toFixed(5)}) discard;`}`);
  };
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink) meshes.push(o);
  });
  for (const o of meshes) {
    let h;
    if (o.isSkinnedMesh) {
      h = new THREE.SkinnedMesh(o.geometry, mat);
      h.bind(o.skeleton, o.bindMatrix);
      h.bindMode = o.bindMode;
    } else h = new THREE.Mesh(o.geometry, mat);
    h.userData.ink = true;
    h.frustumCulled = false;
    h.position.copy(o.position);
    h.quaternion.copy(o.quaternion);
    h.scale.copy(o.scale);
    o.parent.add(h);
  }
  return mat;
}

// a soft round glow, for the thruster
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(235, 255, 200, 1)');
  g.addColorStop(0.3, 'rgba(150, 255, 110, 0.7)');
  g.addColorStop(1, 'rgba(90, 230, 70, 0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The cruiser itself, crew aboard: the saucer (its nose, the headlights,
// +z) TALL high and centred, Rick at the wheel and Morty beside him in their
// seated clips, the glass dome, the ink round everything and the exhaust
// cans' glow. Shared by the flight down this page and the universe map's
// cruiser. `ink` scales the outline's width, which is in the scene's units:
// a scene that draws the cruiser smaller passes its scale. update(t) breathes
// the crew and flickers the glow. Null if the saucer won't load.
export async function buildCruiser({ ink = 1 } = {}) {
  const cast = createMeshyCast();
  // the walk only to turn the seated clip to face ahead (see meshyCast)
  await cast.load(null, ['saucer', 'rick', 'morty'], { clips: ['sit', 'walk'] });
  const body = cast.prop('saucer', TALL);
  if (!body) {
    cast.dispose();
    return null;
  }
  // the nose (its headlights) is +z; centred on the hull
  const hull = new THREE.Group();
  hull.position.y = -TALL / 2;
  hull.add(body);
  // Rick at the wheel, Morty beside him, sat looking ahead
  const crew = [];
  for (const kind of ['rick', 'morty']) {
    const c = cast.make(kind);
    if (!c) continue;
    const [tall, x] = CREW[kind];
    c.group.scale.setScalar(tall / c.height);
    c.group.position.set(x, CREW.y, CREW.z);
    for (const [n, a] of Object.entries(c.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    hull.add(c.group);
    crew.push(c);
  }
  // the dome is glass: everything above the rim, in the mesh's own units
  let glassY = null;
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const { min, max } = o.geometry.boundingBox;
    glassY = min.y + (max.y - min.y) * GLASS;
    const m = o.material.clone();
    m.transparent = true;
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('void main() {', 'varying float vGlassY;\nvoid main() {\nvGlassY = position.y;');
      // see-through face on, thicker towards its edges, so it reads as a bubble
      s.fragmentShader = s.fragmentShader
        .replace('void main() {', 'varying float vGlassY;\nvoid main() {\nfloat glass = 0.0;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          glass = smoothstep(${glassY.toFixed(5)} - 0.004, ${glassY.toFixed(5)} + 0.004, vGlassY);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.95, 0.96), glass * 0.6);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            float rim = 1.0 - abs(normal.z);
            diffuseColor.a *= mix(1.0, 0.16 + 0.6 * rim * rim, glass);
          }`,
        );
    };
    m.customProgramCacheKey = () => `glass-${glassY}`;
    o.material = m;
    o.userData.glass = m;
  });
  const inks = [inkHull(body, 0.036 * ink, glassY), ...crew.map((c) => inkHull(c.group, 0.026 * ink))];
  // the exhaust cans' glow
  const glowTex = glowTexture();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = CANS.map((p) => {
    const g = new THREE.Sprite(glowMat);
    g.position.set(...p);
    hull.add(g);
    return g;
  });

  const ship = new THREE.Group();
  ship.rotation.order = 'YXZ';
  ship.add(hull);
  return {
    group: ship,
    engines: glows, // the exhaust cans, for a scene that draws their exhaust
    update(t) {
      for (const c of crew) {
        c.mixer?.update(c.last == null ? 0 : Math.min(0.1, Math.max(0, t - c.last)));
        c.last = t;
      }
      glowMat.opacity = 0.75 + Math.sin(t * 19) * 0.15;
      glows.forEach((g, i) => g.scale.setScalar(0.7 + Math.sin(t * 13 + i * 2) * 0.06));
    },
    dispose() {
      cast.dispose();
      for (const m of inks) m.dispose();
      body.traverse((o) => o.userData.glass?.dispose());
      glowTex.dispose();
      glowMat.dispose();
    },
  };
}

export async function createCruiser3D(canvas) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const aspect = (canvas.clientHeight || 190) / (canvas.clientWidth || 260);
  const camera = new THREE.OrthographicCamera(-SPAN, SPAN, SPAN * aspect, -SPAN * aspect, 0.1, 60);
  // a little above it, so you see into the cockpit
  camera.position.set(0, 3.6, 12);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x8a94a8, 2.1));
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.3);
  sun.position.set(-4, 9, 7);
  scene.add(sun);

  const cruiser = await buildCruiser();
  if (!cruiser) {
    renderer.dispose();
    return null;
  }
  const ship = cruiser.group;
  scene.add(ship);

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatio(2)); // lib/device: lower on a phone or a weak device
    renderer.setSize(w, h, false);
    const a = h / w;
    camera.top = SPAN * a;
    camera.bottom = -SPAN * a;
    camera.updateProjectionMatrix();
  };
  fit();
  // its shaders linked in the background before its first frame (the flat
  // drawing flies meanwhile), so drawing it doesn't stop the page
  await precompile(renderer, scene, camera);

  return {
    // h: how much it's heading right (-1 left … 1 right), v: down (0 … 1),
    // bank and roll in radians
    pose({ h = 1, v = 0, bank = 0, roll = 0 }) {
      // the nose's angle from screen-right round towards you: always a little
      // towards you, so you see who's flying
      const a = 0.4 + ((1 - h) / 2) * (Math.PI - 0.8);
      ship.rotation.set(v * 0.26, Math.PI / 2 - a, bank + roll);
    },
    render(t) {
      cruiser.update(t);
      renderer.render(scene, camera);
    },
    fit,
    dispose() {
      cruiser.dispose();
      renderer.dispose();
      releaseContext(renderer); // (lib/three/renderer: once nothing is compiling)
    },
  };
}
