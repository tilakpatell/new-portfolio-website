// The Dunder Mifflin theme's background: the paper company's own product,
// sheets drifting down the sides of the page with a sticky note or two,
// fluttering away from the pointer, over the faint rules and red margin of
// a legal pad. Every so often a paper airplane glides across (and now and
// then loops the loop). A click on empty page throws a handful of confetti
// and a line from the office.

import { ambience, backdrop, bursts, field, label, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';

const PAD = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uScroll;
uniform vec3 uRule;
uniform vec3 uMargin;
uniform float uAlpha;
void main() {
  vec2 px = vUv * uRes;
  // ruled every 30px, drifting up a little as the page scrolls
  float y = px.y + uScroll * 0.15;
  float rule = smoothstep(0.9, 0.0, abs(mod(y, 30.0) - 15.0) - 14.4);
  float margin = smoothstep(1.5, 0.0, abs(px.x - 64.0)) + smoothstep(1.5, 0.0, abs(px.x - 70.0)) * 0.6;
  // only at the sides, where the text isn't
  float side = smoothstep(0.24, 0.06, vUv.x) + smoothstep(0.76, 0.94, vUv.x);
  vec3 col = mix(uRule, uMargin, clamp(margin, 0.0, 1.0));
  float a = max(rule * side, margin * smoothstep(0.3, 0.0, vUv.x));
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

const LINES = [
  'That’s what she said',
  'Bears. Beets. Battlestar Galactica.',
  'Identity theft is not a joke',
  'I declare bankruptcy!',
  'Limitless paper in a paperless world',
  'Fact: bears eat beets',
  'Assistant to the regional manager',
  'It is your birthday.',
];

// A paper dart, side on, nose to the right: the near wing and the far one.
const NEAR = [[42, 0], [-30, 14], [-18, 1]];
const FAR = [[42, 0], [-18, 1], [-30, -9]];

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const pad = backdrop(k, PAD, { uRule: { value: new THREE.Color() }, uMargin: { value: new THREE.Color() }, uAlpha: { value: 0.2 } });
    const sheets = field(k, { count: 48, shape: 'paper', dir: [0.12, -1], speed: [14, 30], size: [16, 30], sway: 46, spin: 0.7, repel: 80, parallax: 0.1 });
    const notes = field(k, { count: 12, shape: 'pixel', dir: [-0.1, -1], speed: [10, 22], size: [10, 16], sway: 30, spin: 0.4, repel: 70, parallax: 0.12 });
    const confetti = bursts(k, { shape: 'paper', size: 10, glow: false });

    const plane = new THREE.Group();
    const near = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(NEAR.map(([x, y]) => new THREE.Vector2(x, y)))), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    const far = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(FAR.map(([x, y]) => new THREE.Vector2(x, y)))), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    far.renderOrder = 6;
    near.renderOrder = 7;
    plane.add(far, near);
    plane.visible = false;
    k.scene.add(plane);
    // the trail it leaves: a dotted line, as on the scroll bar
    const trail = bursts(k, { shape: 'dot', size: 4, glow: false, max: 90 });

    const flight = { on: false, t: 0, wait: rand(3, 6), dir: 1, y: 0, loop: false };
    const start = () => {
      flight.on = true;
      flight.t = 0;
      flight.dir = Math.random() < 0.5 ? 1 : -1;
      flight.y = rand(0.1, 0.36) * k.size.h * (Math.random() < 0.5 ? 1 : -1);
      flight.loop = Math.random() < 0.45;
      plane.visible = true;
    };
    const speed = 230;
    // where the plane is at time t, and which way it points
    const at = (t) => {
      const span = k.size.w + 240;
      let x = -flight.dir * span / 2 + flight.dir * t * speed;
      let y = flight.y + Math.sin(t * 1.1) * 30 - t * 6;
      // the loop: a circle of radius 70 two-fifths of the way across
      const lt = (span * 0.4) / speed;
      if (flight.loop && t > lt && t < lt + 2.2) {
        const a = ((t - lt) / 2.2) * Math.PI * 2;
        x = -flight.dir * span / 2 + flight.dir * (lt * speed + Math.sin(a) * 70);
        y += (1 - Math.cos(a)) * 70;
      } else if (flight.loop && t >= lt + 2.2) x -= flight.dir * 2.2 * speed;
      return [x, y];
    };
    const quotes = [];

    return {
      step(dt, t) {
        pad.step(t);
        sheets.step(t);
        notes.step(t);
        confetti.step(dt);
        trail.step(dt);
        if (!flight.on) {
          flight.wait -= dt;
          if (flight.wait <= 0 && dt > 0) start();
        } else {
          flight.t += dt;
          const [x, y] = at(flight.t);
          const [nx, ny] = at(flight.t + 0.05);
          plane.position.set(x, y, 0);
          plane.rotation.z = Math.atan2(ny - y, (nx - x) * flight.dir) * flight.dir;
          plane.scale.set(flight.dir, 1, 1);
          if (Math.random() < dt * 14) trail.emit(x - flight.dir * 30, y, { count: 1, speed: [0, 4], life: [1.4, 1.8], colors: [this.ink], gravity: 0, size: 4 });
          if (Math.abs(x) > k.size.w / 2 + 160 && flight.t > 2.5) {
            flight.on = false;
            plane.visible = false;
            flight.wait = rand(10, 16);
          }
        }
        for (let i = quotes.length - 1; i >= 0; i--) {
          const q = quotes[i];
          q.t += dt;
          q.mesh.position.y += dt * 26;
          q.mesh.scale.setScalar(Math.min(1, 0.6 + q.t * 3));
          q.mesh.material.opacity = Math.max(0, Math.min(1, (2.4 - q.t) / 0.6));
          if (q.t > 2.4) {
            q.mesh.parent.remove(q.mesh);
            q.mesh.geometry.dispose();
            q.mesh.material.map.dispose();
            q.mesh.material.dispose();
            quotes.splice(i, 1);
          }
        }
        // reduced motion: one still frame with the plane in it
        if (k.reduced && !flight.on) {
          start();
          flight.loop = false;
          flight.t = ((k.size.w + 240) * 0.7) / speed;
          this.step(0, t);
        }
      },
      recolor(c) {
        const paper = c.dark ? [222, 226, 232] : [255, 255, 255];
        const edge = c.dark ? [170, 178, 190] : [196, 204, 218];
        sheets.colors(paper, mix(paper, edge, 0.4));
        sheets.uniforms.uOpacity.value = c.dark ? 0.55 : 1;
        notes.colors([250, 224, 110], [255, 196, 120]);
        notes.uniforms.uOpacity.value = c.dark ? 0.5 : 0.75;
        rgb(c.dark ? [120, 150, 200] : [150, 175, 215], pad.uniforms.uRule.value);
        rgb([220, 90, 90], pad.uniforms.uMargin.value);
        pad.uniforms.uAlpha.value = c.dark ? 0.16 : 0.2;
        rgb(c.dark ? [235, 238, 242] : [255, 255, 255], near.material.color);
        rgb(c.dark ? [170, 178, 190] : [205, 212, 224], far.material.color);
        near.material.opacity = far.material.opacity = c.dark ? 0.85 : 1;
        this.ink = c.dark ? [150, 165, 190] : mix(c.accent, c.bg, 0.35);
        this.dark = c.dark;
        this.accent = c.accent;
      },
      burst(x, y) {
        confetti.emit(x, y, { count: 18, colors: [[255, 255, 255], [250, 224, 110], [143, 182, 255], this.accent], speed: [80, 260], gravity: -180, size: 11 });
        const line = LINES[(Math.random() * LINES.length) | 0];
        const tag = label(line, { font: '700 18px "Courier Prime", ui-monospace, monospace', color: this.dark ? '#e8edf5' : '#1f4e8c' });
        // kept inside the screen
        const half = tag.geometry.parameters.width / 2;
        tag.position.set(Math.max(-k.size.w / 2 + half + 8, Math.min(k.size.w / 2 - half - 8, x)), y + 30, 0);
        tag.renderOrder = 12;
        k.scene.add(tag);
        quotes.push({ mesh: tag, t: 0 });
      },
      dispose() {
        for (const q of quotes) q.mesh.material.map.dispose();
      },
    };
  });
}
