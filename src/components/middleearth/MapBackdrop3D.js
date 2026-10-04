// The map behind the page, in WebGL: the painted sheet (./mapPaint.js) lying
// on a table under a warm light, seen from a camera that glides over it the
// way the films open. The page tells it how far the reader has come (the
// camera follows the Ring's road from Hobbiton to Mount Doom), whether they
// are in Mordor (the light turns to fire), and when to step back and show
// the whole sheet. It draws only while something is moving.

import * as THREE from 'three';
import { normalCanvas } from '../../lib/texture';
import { SHEET } from './mapData';
import { mapFont, paintMap, paintRelief } from './mapPaint';
import { STOPS } from './road';

const SCALE = 10; // sheet units to one of the scene's
const at = (x, y) => [(x - SHEET.w / 2) / SCALE, (y - SHEET.h / 2) / SCALE];

// The road as one line, to walk a point along by how far down the page we are.
const LEGS = STOPS.slice(1).map((s, i) => Math.hypot(s.x - STOPS[i].x, s.y - STOPS[i].y));
const ROAD = LEGS.reduce((a, b) => a + b, 0);
function along(p) {
  let left = Math.max(0, Math.min(1, p)) * ROAD;
  for (let i = 0; i < LEGS.length; i++) {
    if (left <= LEGS[i] || i === LEGS.length - 1) {
      const k = Math.min(1, left / LEGS[i]);
      return at(STOPS[i].x + (STOPS[i + 1].x - STOPS[i].x) * k, STOPS[i].y + (STOPS[i + 1].y - STOPS[i].y) * k);
    }
    left -= LEGS[i];
  }
  return at(STOPS[0].x, STOPS[0].y);
}

export { mapFont };

export function createMapBackdrop(canvas, { onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d08);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 1, 400);

  const map = new THREE.CanvasTexture(paintMap(2048));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const relief = new THREE.CanvasTexture(normalCanvas(paintRelief(1024), 5));
  relief.anisotropy = map.anisotropy;
  const W = SHEET.w / SCALE;
  const H = SHEET.h / SCALE;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map, normalMap: relief, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.94 }));
  scene.add(sheet);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 }));
  table.position.y = -0.3;
  scene.add(table);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, H + 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0604, transparent: true, opacity: 0.55 }));
  shade.position.set(0.5, -0.12, 0.6);
  scene.add(shade);

  const ambient = new THREE.AmbientLight(0xffe8c8, 0.8);
  const candle = new THREE.PointLight(0xffb870, 900, 0, 2);
  const low = new THREE.DirectionalLight(0xffdcb0, 1.1);
  low.position.set(-40, 13, 12);
  scene.add(ambient, candle, low);
  const day = { ambient: new THREE.Color(0xffe8c8), candle: new THREE.Color(0xffb870) };
  const fire = { ambient: new THREE.Color(0x8a5a44), candle: new THREE.Color(0xff8648) };

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // where the camera is, and where it is going: a point on the sheet, a
  // height, and how far into Mordor
  const start = along(0);
  const cur = { x: 0, z: 0, zoom: 3.1, m: 0 };
  const goal = { x: start[0], z: start[1], zoom: 1.3, m: 0 };
  let wide = 1;
  let first = true;

  const setView = ({ p = 0, after = 0, mordor = false, whole = false }) => {
    const [x, z] = along(p);
    const out = whole ? 1 : after;
    goal.x = x * (1 - out);
    goal.z = z * (1 - out);
    goal.zoom = 1.3 + 1.8 * out;
    goal.m = mordor ? 1 : 0;
  };

  const resize = (w, h) => {
    renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide = Math.max(1, 1.25 / camera.aspect); // a tall screen stands further back
    first = true;
  };

  // Draws one frame, and says whether the camera is still on its way.
  const render = (ms = 16, slow = 1) => {
    if (lost) return false;
    const dt = Math.min(0.05, ms / 1000);
    const k = 1 - Math.exp(-2.4 * slow * dt);
    const dx = goal.x - cur.x;
    const dz = goal.z - cur.z;
    const dzoom = goal.zoom - cur.zoom;
    const dm = goal.m - cur.m;
    const moving = first || Math.abs(dx) + Math.abs(dz) + Math.abs(dzoom) * 4 + Math.abs(dm) * 4 > 0.004;
    if (!moving) return false;
    first = false;
    cur.x += dx * k;
    cur.z += dz * k;
    cur.zoom += dzoom * k;
    cur.m += dm * k;
    const z = cur.zoom * wide;
    camera.position.set(cur.x + 1.5 * z, 17 * z, cur.z + 14 * z);
    camera.lookAt(cur.x, 0, cur.z - 1.2 * z);
    ambient.color.copy(day.ambient).lerp(fire.ambient, cur.m);
    ambient.intensity = 0.8 - 0.42 * cur.m;
    candle.color.copy(day.candle).lerp(fire.candle, cur.m);
    candle.position.set(cur.x - 9 * z, 15 * z, cur.z + 5 * z);
    candle.intensity = 900 * z * z;
    low.intensity = 1.1 - 0.6 * cur.m;
    renderer.render(scene, camera);
    return true;
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    map.dispose();
    relief.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    renderer.dispose();
    renderer.forceContextLoss();
  };

  return {
    setView,
    render,
    resize,
    dispose,
    renderer,
    get lost() {
      return lost;
    },
  };
}
