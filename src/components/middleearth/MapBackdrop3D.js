// The map behind the page, in WebGL: the painted sheet (./mapPaint.js) lying
// on a table, seen from a camera that glides over it the way the films open.
// On the hub it shows the whole sheet and leans a little towards the pointer
// and towards the place under it; choosing a place flies the camera down to
// it, and a chapter keeps it there, close. By day the sheet lies in window
// light; at night (dark mode) a candle lights it, and it flickers. In Mordor
// the light turns to fire. It draws only while something is moving, or the
// candle is lit.

import * as THREE from 'three';
import { normalCanvas } from '../../lib/texture';
import { SHEET } from './mapData';
import { mapFont, paintMap, paintRelief } from './mapPaint';

const SCALE = 10; // sheet units to one of the scene's
const at = (x, y) => [(x - SHEET.w / 2) / SCALE, (y - SHEET.h / 2) / SCALE];

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
  // by day, by candle at night, and by Mordor's fire
  const day = { ambient: new THREE.Color(0xfff1dc), candle: new THREE.Color(0xffd6a0), low: new THREE.Color(0xfff0dc) };
  const night = { ambient: new THREE.Color(0x6a7590), candle: new THREE.Color(0xffa458), low: new THREE.Color(0x8fa2c8) };
  const fire = { ambient: new THREE.Color(0x8a5a44), candle: new THREE.Color(0xff8648), low: new THREE.Color(0xff9a66) };
  const tint = new THREE.Color();

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // where the camera is, and where it is going: a point on the sheet, a
  // height (1 is close, about 3 the whole sheet), how far into Mordor, how
  // dark the room is, and the pointer's lean
  const cur = { x: 0, z: 0, zoom: 3.4, m: 0, n: 0, lx: 0, lz: 0 };
  const goal = { x: 0, z: 0, zoom: 2.6, m: 0, n: 0, lx: 0, lz: 0 };
  let wide = 1;
  let first = true;
  let candleLit = false;
  let t = 0;

  // { at: [x, y] on the sheet or null for the whole map, zoom, mordor, dark,
  //   alive: the candle flickers (it keeps drawing), lean: [-1..1, -1..1] the
  //   pointer, hover: [x, y] a place to lean towards }
  const setView = ({ at: spot = null, zoom = null, mordor = false, dark = false, alive = false, lean = [0, 0], hover = null }) => {
    // the whole map is framed a little east of its middle, so Mordor is in
    const [x, z] = at(...(spot || [438, 300]));
    const [hx, hz] = hover ? at(...hover) : [x, z];
    goal.x = x + (hx - x) * 0.12;
    goal.z = z + (hz - z) * 0.12;
    // a tall screen can't hold the whole sheet: show its middle, bigger
    goal.zoom = zoom ?? (spot ? 1.45 : camera.aspect < 1 ? 1.75 : 2.95);
    goal.m = mordor ? 1 : 0;
    goal.n = dark ? 1 : 0;
    goal.lx = lean[0];
    goal.lz = lean[1];
    candleLit = dark && alive;
  };

  // Where a point on the sheet is on the screen, in CSS pixels of the canvas.
  const v = new THREE.Vector3();
  const project = (x, y) => {
    const [px, pz] = at(x, y);
    v.set(px, 0, pz).project(camera);
    return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h, on: v.z < 1 };
  };
  let size = { w: 1, h: 1 };

  const resize = (w, h) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide = Math.max(1, 1.25 / camera.aspect); // a tall screen stands further back
    first = true;
  };

  // Draws one frame, and says whether to keep drawing: the camera is on its
  // way, or the candle is lit.
  const render = (ms = 16, slow = 1) => {
    if (lost) return false;
    const dt = Math.min(0.05, ms / 1000);
    t += dt;
    const k = 1 - Math.exp(-2.4 * slow * dt);
    const kl = 1 - Math.exp(-4 * dt);
    let far = 0;
    for (const key of ['x', 'z', 'zoom', 'm', 'n', 'lx', 'lz']) far += Math.abs(goal[key] - cur[key]) * (key === 'x' || key === 'z' ? 1 : 4);
    const moving = first || far > 0.004;
    if (!moving && !candleLit) return false;
    first = false;
    for (const key of ['x', 'z', 'zoom', 'm', 'n']) cur[key] += (goal[key] - cur[key]) * k;
    cur.lx += (goal.lx - cur.lx) * kl;
    cur.lz += (goal.lz - cur.lz) * kl;
    const z = cur.zoom * wide;
    // the pointer swings the camera a little round the point it looks at
    const sx = cur.lx * 1.6 * z;
    const sz = cur.lz * 1.1 * z;
    camera.position.set(cur.x + 1.5 * z + sx, 17 * z, cur.z + 14 * z + sz);
    camera.lookAt(cur.x + sx * 0.25, 0, cur.z - 1.2 * z + sz * 0.25);
    const flick = candleLit ? 1 + 0.06 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3) + 0.04 * Math.sin(t * 23.7) : 1;
    ambient.color.copy(tint.copy(day.ambient).lerp(night.ambient, cur.n)).lerp(fire.ambient, cur.m);
    ambient.intensity = (0.85 - 0.5 * cur.n) * (1 - 0.45 * cur.m);
    candle.color.copy(tint.copy(day.candle).lerp(night.candle, cur.n)).lerp(fire.candle, cur.m);
    candle.position.set(cur.x - 9 * z, 15 * z, cur.z + 5 * z);
    candle.intensity = (700 + 500 * cur.n) * z * z * flick;
    low.color.copy(tint.copy(day.low).lerp(night.low, cur.n)).lerp(fire.low, cur.m);
    low.intensity = (1.2 - 0.85 * cur.n) * (1 - 0.5 * cur.m);
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
    project,
    render,
    resize,
    dispose,
    renderer,
    get lost() {
      return lost;
    },
  };
}
