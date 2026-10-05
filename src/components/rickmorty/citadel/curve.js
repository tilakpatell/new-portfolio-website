// The Central Finite Curve, as the Citadel shows it to itself: a hologram
// ringing the portal-fluid core, a walled band of universes (every one
// where Rick is the smartest man there is) between two gold walls, open at
// one end, because it is finite. It turns slowly over the concourse,
// above everyone's heads.
//
// curveHologram({ radius, height, tier }) → { group, update(t), setMood(m), dispose() }

import * as THREE from 'three';

const ARC = Math.PI * 2 * 0.84;
const W = 4096;
const H = 128;
// universes are drawn in these, the portal's greens most of all
const HUES = ['#7dff6a', '#b8ff7a', '#5ff0e0', '#ffe27a', '#ff9ad8', '#9ab8ff', '#7dff6a', '#d8ff9a'];

const hash = (i, k = 0) => (((Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1) + 1) % 1;

// the band's picture: the top half its walls and universes, the bottom half
// a mask of its words (drawn only on the side facing out, so they read)
function paintBand() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H * 2);
  // a faint gold haze between the walls
  const haze = g.createLinearGradient(0, 0, 0, H);
  haze.addColorStop(0, 'rgba(255,214,120,0.0)');
  haze.addColorStop(0.5, 'rgba(255,214,120,0.24)');
  haze.addColorStop(1, 'rgba(255,214,120,0.0)');
  g.fillStyle = haze;
  g.fillRect(0, 10, W, H - 20);
  // the universes, as bubbles in a few rows, packed in
  let i = 0;
  for (let row = 0; row < 3; row++) {
    const y = 34 + row * 30;
    for (let x = 6 + row * 9; x < W - 6; x += 17 + hash(i, 1) * 12) {
      i++;
      if (hash(i, 2) < 0.12) continue;
      const r = 6 + hash(i, 3) * 8;
      const hue = HUES[Math.floor(hash(i, 4) * HUES.length)];
      const yy = y + (hash(i, 5) - 0.5) * 10;
      const b = g.createRadialGradient(x - r * 0.3, yy - r * 0.3, 0, x, yy, r);
      b.addColorStop(0, '#ffffff');
      b.addColorStop(0.35, hue);
      b.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = b;
      g.beginPath();
      g.arc(x, yy, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hue;
      g.globalAlpha = 0.7;
      g.lineWidth = 1.2;
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  // the walls: gold, bright, with a ribbing of struts
  for (const y of [7, H - 7]) {
    g.fillStyle = '#ffd77a';
    g.fillRect(0, y - 3, W, 6);
    g.fillStyle = '#fff6d8';
    g.fillRect(0, y - 1, W, 2);
  }
  g.fillStyle = 'rgba(255,215,122,0.55)';
  for (let x = 0; x < W; x += 64) {
    g.fillRect(x, 4, 3, 12);
    g.fillRect(x, H - 16, 3, 12);
  }
  // the words, three times round
  g.fillStyle = '#fff';
  g.font = '700 54px Orbitron, "Arial Black", sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  for (let k = 0; k < 3; k++) g.fillText('CENTRAL FINITE CURVE', ((k + 0.5) * W) / 3, H + H / 2);
  return c;
}

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `
uniform sampler2D uMap;
uniform float uTime, uRed;
varying vec2 vUv;
void main() {
  // the words only on the side facing out: from inside they'd read backwards
  vec3 band = texture2D(uMap, vec2(vUv.x, 0.5 + vUv.y * 0.5)).rgb;
  float words = gl_FrontFacing ? texture2D(uMap, vec2(vUv.x, vUv.y * 0.5)).r : 0.0;
  // a pulse running along it, and a scan line climbing it
  float pulse = 0.75 + 0.25 * sin(vUv.x * 60.0 - uTime * 2.2);
  float scan = 0.85 + 0.15 * step(0.5, fract(vUv.y * 40.0 + uTime * 0.6));
  // fading out at its two open ends
  float ends = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
  // on red alert it stutters
  float flick = mix(1.0, step(0.25, fract(sin(floor(uTime * 9.0 + vUv.x * 14.0) * 12.9898) * 43758.5453)), uRed);
  vec3 c = band * pulse * scan * 1.7 + vec3(0.8, 1.0, 0.85) * words * 1.35;
  c *= ends * flick * (gl_FrontFacing ? 1.0 : 0.45);
  gl_FragColor = vec4(c, 1.0);
}`;

export function curveHologram({ radius = 7.4, height = 2.4 } = {}) {
  const canvas = paintBand();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uRed: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const group = new THREE.Group();
  group.name = 'central-finite-curve';
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 180, 1, true, 0, ARC), mat);
  // tilted, as the hologram hangs a little off true
  band.rotation.set(0.08, 0, 0.05);
  group.add(band);
  // its light: two thin gold rings where its walls are, from end to end
  const wallMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd77a).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const wallGeo = new THREE.TorusGeometry(radius, 0.035, 4, 180, ARC);
  // the torus lies in xy from +x towards +y; the cylinder runs from +z
  // towards +x: x to z, y to x (and z to y) turns the one onto the other
  const onto = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  for (const y of [-height / 2 + height * 0.055, height / 2 - height * 0.055]) {
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.quaternion.copy(onto);
    w.position.y = y;
    band.add(w);
  }
  const update = (t) => {
    mat.uniforms.uTime.value = t;
    group.rotation.y = -t * 0.05;
  };
  const setMood = (m) => {
    mat.uniforms.uRed.value = m === 'red' ? 1 : 0;
  };
  const dispose = () => {
    map.dispose();
    mat.dispose();
    band.geometry.dispose();
    wallGeo.dispose();
    wallMat.dispose();
  };
  return { group, update, setMood, dispose };
}
