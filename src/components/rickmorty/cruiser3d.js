// The Space Cruiser in 3D for the flight down the Rick and Morty page
// (./CruiserFlight.jsx): the Meshy model of it with Rick at the wheel and
// Morty beside him, both breathing with their idle clips, toon-shaded and
// inked like Portal panic, on a small see-through canvas that the page moves
// about. Here it only turns: pose() points the nose the way it's flying
// (swinging round through facing you as it swoops from one side to the
// other), dips it as it drops, banks it and rolls it into a portal.
// Loaded only where 3D is on; null if anything won't start.

import * as THREE from 'three';
import { createMeshyCast } from './portal/meshyCast';

const INK = 0x1b1424;
const SPAN = 2.7; // half the canvas's width, in the cruiser's units (it's 3.9 long)
const GLASS = 0.6;
// how tall Rick and Morty stand in it, and where their feet are (the model's units, nose -x)
const CREW = { rick: 1.4, morty: 1.18, x: -0.3, y: 0.42 }; // the share of the cruiser's height where the hull stops and the dome starts

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

export async function createCruiser3D(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
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

  const cast = createMeshyCast();
  await cast.load(null, ['cruiser', 'rick', 'morty'], { clips: ['idle', 'walk'] });
  const body = cast.prop('cruiser', 1.7);
  if (!body) {
    cast.dispose();
    renderer.dispose();
    return null;
  }
  // the model's nose is along -x and its thruster +x; turned so the nose is
  // +z, centred on the hull
  const hull = new THREE.Group();
  hull.rotation.y = Math.PI / 2;
  hull.position.y = -0.8;
  hull.add(body);
  // Rick at the wheel on the left, Morty on the right, looking ahead
  const crew = [];
  for (const [kind, tall, z] of [
    ['rick', CREW.rick, 0.3],
    ['morty', CREW.morty, -0.3],
  ]) {
    const c = cast.make(kind);
    if (!c) continue;
    c.group.scale.setScalar(tall / c.height);
    c.group.position.set(CREW.x, CREW.y, z);
    c.group.rotation.y = Math.PI / 2;
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
      s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying float vGlassY;\nvoid main() {').replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float glass = smoothstep(${glassY.toFixed(5)} - 0.004, ${glassY.toFixed(5)} + 0.004, vGlassY);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.93, 1.0), glass * 0.45);
          diffuseColor.a *= mix(1.0, 0.26, glass);
        }`,
      );
    };
    m.customProgramCacheKey = () => `glass-${glassY}`;
    o.material = m;
    o.userData.glass = m;
  });
  const inks = [inkHull(body, 0.036, glassY), ...crew.map((c) => inkHull(c.group, 0.026))];
  // the thruster's glow
  const glowTex = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(1.62, 0.75, 0);
  glow.scale.setScalar(1.1);
  hull.add(glow);

  const ship = new THREE.Group();
  ship.rotation.order = 'YXZ';
  ship.add(hull);
  scene.add(ship);

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    const a = h / w;
    camera.top = SPAN * a;
    camera.bottom = -SPAN * a;
    camera.updateProjectionMatrix();
  };
  fit();

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
      for (const c of crew) c.update(t, 0, 0);
      glow.material.opacity = 0.75 + Math.sin(t * 19) * 0.15;
      glow.scale.setScalar(1.05 + Math.sin(t * 13) * 0.08);
      renderer.render(scene, camera);
    },
    fit,
    dispose() {
      cast.dispose();
      for (const m of inks) m.dispose();
      body.traverse((o) => o.userData.glass?.dispose());
      glowTex.dispose();
      glow.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
