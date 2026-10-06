// The beacon over a landing's door (wayin.js's beaconOf): a column of the
// planet's glow standing up out of the ground, a ring round its foot, and
// a label over it (“Enter Albuquerque”), so the way in can be seen from
// where the ship comes down, whatever's in between. Cheap: three meshes
// and a small canvas, no lights. In metres, its foot at the origin, +y up,
// as a landing's things are.
//
// createBeacon({ label, color, tall, small, reduced }) → { object, update(t) }

import * as THREE from 'three';

// the column fades out going up, and is brightest down its middle (the
// view's angle to it: a soft edge, not a cylinder's hard one)
const COLUMN_V = `
varying float vUp;
varying float vFacing;
void main() {
  vUp = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const COLUMN_F = `
uniform vec3 color;
uniform float glow;
varying float vUp;
varying float vFacing;
void main() {
  float a = pow(1.0 - vUp, 1.6) * pow(vFacing, 1.4) * glow;
  gl_FragColor = vec4(color, a);
}`;

// the label: white on the night's dark, edged in the glow, on a canvas of
// its own (drawn once: it never changes)
function labelTexture(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 52px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 120;
  const h = 96;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  const r = h / 2 - 4;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, r);
  ctx.fillStyle = 'rgba(6, 8, 16, 0.82)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  // a little arrow down to the door, then the words
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(38, 36);
  ctx.lineTo(62, 36);
  ctx.lineTo(50, 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

export function createBeacon({ label, color = '#7fe3ff', tall = 9, small = false, reduced = false } = {}) {
  const object = new THREE.Group();
  object.name = 'beacon';
  const glow = new THREE.Color(color);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, tall * 2.2, 24, 1, true).translate(0, tall * 1.1, 0),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: glow }, glow: { value: 0.75 } },
      vertexShader: COLUMN_V,
      fragmentShader: COLUMN_F,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  column.renderOrder = 2;
  column.frustumCulled = false; // (the landing's group is placed by its matrix: the bounds are fine, but it's one draw)
  object.add(column);

  // the ring round its foot (not on a small screen: the column says enough)
  let ring = null;
  if (!small) {
    ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    ring.position.y = 0.06;
    ring.renderOrder = 2;
    object.add(ring);
  }

  const { tex, aspect } = labelTexture(label, `#${glow.getHexString()}`);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  const high = 1.25; // metres: big enough to read from the ship, thirty-odd metres off
  sprite.scale.set(high * aspect, high, 1);
  sprite.position.y = tall;
  sprite.renderOrder = 3; // (over the column, and never hidden behind the door it marks)
  object.add(sprite);

  return {
    object,
    update(t) {
      if (reduced) return;
      // a slow breath, so it reads as a sign and not a part of the scenery
      const k = 0.5 + 0.5 * Math.sin(t * 2.2);
      column.material.uniforms.glow.value = 0.6 + 0.25 * k;
      if (ring) {
        const s = 1 + 0.35 * ((t * 0.6) % 1);
        ring.scale.set(s, 1, s);
        ring.material.opacity = 0.75 * (1 - ((t * 0.6) % 1));
      }
      sprite.position.y = tall + 0.12 * Math.sin(t * 1.4);
    },
  };
}
