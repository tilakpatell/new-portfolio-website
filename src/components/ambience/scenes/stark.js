// The Stark theme's background: the inside of the helmet. A holographic
// grid runs to the horizon along the bottom of the screen, telemetry ticks
// rise up the sides, an arc reactor turns in the corner, and a scan line
// sweeps across now and then. The pointer is tracked by a targeting
// reticle that eases after it and locks on when it stops. A click on empty
// page is a repulsor blast.

import { ambience, backdrop, bursts, field, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';

const HUD = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uScan;
uniform vec3 uLine;
uniform float uAlpha;
void main() {
  // a floor of grid lines in perspective, below the horizon at 22% up
  float h = 0.22;
  float a = 0.0;
  if (vUv.y < h) {
    float d = (h - vUv.y) / h;            // 0 at the horizon, 1 at the bottom
    float z = 1.0 / max(d, 0.02);         // depth
    vec2 g = vec2((vUv.x - 0.5) * uRes.x / uRes.y * z * 2.0, z * 0.8 - uTime * 0.25);
    vec2 w = fwidth(g);
    vec2 l = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
    float lines = (1.0 - min(min(l.x, l.y), 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(w.x, w.y)));
    a = lines * d * 0.9;
  }
  // the horizon line itself
  a += smoothstep(0.004, 0.0, abs(vUv.y - h)) * 0.4;
  // softer in the middle, where the text runs
  a *= mix(0.3, 1.0, smoothstep(0.12, 0.42, abs(vUv.x - 0.5)));
  // corner brackets of the visor
  vec2 c = abs(vUv - 0.5) * uRes;
  vec2 e = uRes * 0.5 - c;
  float corner = (step(e.x, 26.0) * step(e.y, 120.0) * step(18.0, e.x) + step(e.y, 26.0) * step(e.x, 120.0) * step(18.0, e.y));
  a += corner * 0.8;
  // the scan: a soft band crossing left to right
  float s = exp(-pow((vUv.x - uScan) * uRes.x / 40.0, 2.0));
  a += s * 0.35;
  gl_FragColor = vec4(uLine, clamp(a, 0.0, 1.0) * uAlpha);
}
`;

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const hud = backdrop(k, HUD, { uScan: { value: -1 }, uLine: { value: new THREE.Color() }, uAlpha: { value: 0.5 } });
    const ticks = field(k, { count: 90, shape: 'pixel', dir: [0, 1], speed: [12, 40], size: [2, 4], twinkle: 0.7, repel: 30, parallax: 0.05 });
    const sparks = bursts(k, { shape: 'spark', size: 12 });
    const line = (opacity = 1) => new THREE.MeshBasicMaterial({ transparent: true, opacity, depthTest: false, depthWrite: false });
    const mats = [];
    const mat = (o) => {
      const m = line(o);
      m.userData.base = o;
      mats.push(m);
      return m;
    };

    // the arc reactor: a glowing core, rings of segments turning against each other
    const reactor = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CircleGeometry(16, 32), mat(0.9));
    reactor.add(core);
    const rings = [];
    for (const [r, w, n, gap, speed] of [[26, 3, 1, 0, 0], [36, 6, 10, 0.18, 0.4], [50, 2, 3, 0.6, -0.25], [62, 4, 24, 0.12, 0.12]]) {
      const ring = new THREE.Group();
      const step = (Math.PI * 2) / n;
      for (let i = 0; i < n; i++) ring.add(new THREE.Mesh(new THREE.RingGeometry(r, r + w, 12, 1, i * step, step * (1 - gap)), mat(0.7)));
      ring.userData.speed = speed;
      rings.push(ring);
      reactor.add(ring);
    }
    k.scene.add(reactor);

    // the reticle: four brackets round a cross
    const reticle = new THREE.Group();
    const brackets = new THREE.Group();
    for (let i = 0; i < 4; i++) brackets.add(new THREE.Mesh(new THREE.RingGeometry(30, 33, 8, 1, i * (Math.PI / 2) + 0.25, Math.PI / 2 - 0.5), mat(0.9)));
    reticle.add(brackets);
    for (const [w, h] of [[22, 1.5], [1.5, 22]]) reticle.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0.7)));
    const inner = new THREE.Mesh(new THREE.RingGeometry(8, 9.5, 24), mat(0.8));
    reticle.add(inner);
    k.scene.add(reticle);

    // repulsor blasts: rings that open out and fade
    const blastGeo = new THREE.RingGeometry(0.85, 1, 48);
    const blasts = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(blastGeo, line(0));
      m.visible = false;
      m.userData.t = 0;
      k.scene.add(m);
      return m;
    });

    const lock = { still: 0, last: [0, 0], amount: 0 };
    let scan = { on: false, t: 0, wait: rand(4, 8) };

    return {
      resize(w, h) {
        // the reactor peeks in from the bottom-left corner, half off the screen
        reactor.position.set(-w / 2 + 36, -h / 2 + 64, 0);
        reactor.scale.setScalar(w < 768 ? 1 : 1.7);
      },
      step(dt, t) {
        hud.step(t);
        ticks.step(t);
        sparks.step(dt);
        const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
        core.material.opacity = core.material.userData.base * pulse;
        for (const r of rings) r.rotation.z += r.userData.speed * dt;
        if (k.reduced) for (const r of rings) r.rotation.z = r.userData.speed * 4;

        // the reticle follows the pointer and locks on when it holds still
        const [lx, ly] = lock.last;
        const moved = Math.hypot(k.pointer.x - lx, k.pointer.y - ly);
        lock.last = [k.pointer.x, k.pointer.y];
        lock.still = moved < 0.6 ? lock.still + dt : 0;
        const want = lock.still > 0.6 ? 1 : 0;
        lock.amount += (want - lock.amount) * Math.min(1, dt * 6);
        reticle.position.set(k.pointer.x, k.pointer.y, 0);
        reticle.visible = k.pointer.near > 0.05 || k.reduced;
        if (k.reduced) reticle.position.set(k.size.w * 0.32, k.size.h * 0.18, 0);
        brackets.rotation.z += dt * (1.6 - lock.amount * 1.4);
        brackets.scale.setScalar(1.25 - lock.amount * 0.45);
        inner.scale.setScalar(1 + lock.amount * 0.4 + Math.sin(t * 8) * 0.05 * lock.amount);
        for (const m of reticle.children) if (m.material) m.material.opacity = m.material.userData.base * k.pointer.near;
        for (const b of brackets.children) b.material.opacity = b.material.userData.base * Math.max(k.pointer.near, k.reduced ? 1 : 0);
        for (const b of brackets.children) rgb(lock.amount > 0.5 ? this.locked : this.glow, b.material.color);

        // the scan line, every so often
        if (!scan.on) {
          scan.wait -= dt;
          if (scan.wait <= 0 && dt > 0) scan = { on: true, t: 0, wait: 0 };
          hud.uniforms.uScan.value = -1;
        } else {
          scan.t += dt;
          hud.uniforms.uScan.value = scan.t / 2.4 - 0.1;
          if (scan.t > 2.9) scan = { on: false, t: 0, wait: rand(12, 18) };
        }

        for (const b of blasts) {
          if (!b.visible) continue;
          b.userData.t += dt;
          const p = b.userData.t / 0.9;
          b.scale.setScalar(10 + p * 160);
          b.material.opacity = Math.max(0, 1 - p) * 0.9;
          if (p >= 1) b.visible = false;
        }
      },
      recolor(c) {
        // cyan light in the dark; Stark red ink on a white page
        this.glow = c.dark ? c.saber : mix(c.accent, c.text, 0.25);
        this.locked = c.dark ? [255, 92, 92] : c.accent;
        rgb(c.dark ? c.saber : mix(c.accent, c.bg, 0.2), hud.uniforms.uLine.value);
        hud.uniforms.uAlpha.value = c.dark ? 0.32 : 0.22;
        ticks.colors(c.dark ? c.saber : mix(c.accent, c.bg, 0.3), c.dark ? [255, 255, 255] : mix(c.text, c.bg, 0.4));
        ticks.glow(c.dark);
        sparks.glow(c.dark);
        const blend = c.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        for (const m of mats) {
          rgb(this.glow, m.color);
          m.blending = blend;
          m.needsUpdate = true;
        }
        rgb(c.dark ? [220, 248, 255] : c.accent, core.material.color);
        for (const b of blasts) {
          rgb(c.dark ? c.saber : c.accent, b.material.color);
          b.material.blending = blend;
          b.material.needsUpdate = true;
        }
        for (const r of rings) for (const m of r.children) m.material.opacity = m.material.userData.base * (c.dark ? 1 : 0.6);
      },
      burst(x, y) {
        const b = blasts.find((m) => !m.visible) ?? blasts[0];
        b.position.set(x, y, 0);
        b.userData.t = 0;
        b.visible = true;
        sparks.emit(x, y, { count: 16, colors: [this.glow, [255, 255, 255]], speed: [120, 340], gravity: 0 });
      },
    };
  });
}
