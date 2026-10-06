// What flying leaves behind: the vapour cone and the shock rings when he
// goes through the sound barrier, a contrail at speed, a crater where he
// comes down hard (cracks in the street, dust thrown out in a ring, chunks
// of it in the air), the mess when he hits a tower, spray off the water.
// The sparks, smoke, debris and rings are the HQ games' pooled effects
// (avengers/hq/vfx); the cone, the contrail and the craters are drawn here.

import * as THREE from 'three';
import { createVfx } from '../../avengers/hq/vfx';

const Y = new THREE.Vector3(0, 1, 0);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// cracks radiating from a middle, painted once
function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, 'rgba(20,18,16,0.95)');
  g.addColorStop(0.35, 'rgba(40,36,32,0.75)');
  g.addColorStop(0.62, 'rgba(60,55,50,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.strokeStyle = 'rgba(12,10,9,0.95)';
  x.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    let a = (i / 16) * Math.PI * 2 + r() * 0.3;
    let px = 128;
    let py = 128;
    let w = 3.2;
    for (let k = 0; k < 9; k++) {
      const len = 8 + r() * 9;
      a += (r() - 0.5) * 0.7;
      const nx = px + Math.cos(a) * len;
      const ny = py + Math.sin(a) * len;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(nx, ny);
      x.stroke();
      // a branch now and then
      if (r() < 0.3) {
        const b = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5);
        x.lineWidth = w * 0.6;
        x.beginPath();
        x.moveTo(nx, ny);
        x.lineTo(nx + Math.cos(b) * len * 0.8, ny + Math.sin(b) * len * 0.8);
        x.stroke();
      }
      px = nx;
      py = ny;
      w *= 0.84;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the vapour cone: a bell of mist behind him, brightest at its rim
function coneMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: { uFade: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade, uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main() {
        float rim = pow(1.0 - abs(dot(vN, vV)), 1.6);
        float along = vUv.y; // 0 at the open end, 1 at the tip
        float bands = 0.75 + 0.25 * sin(vUv.x * 60.0 + along * 9.0 + uTime * 7.0) * h(floor(vUv * vec2(40.0, 6.0)));
        float a = (0.18 + rim * 0.7) * smoothstep(0.0, 0.35, along) * smoothstep(1.0, 0.8, along) * bands * uFade;
        gl_FragColor = vec4(vec3(0.94, 0.97, 1.0), a);
      }`,
  });
}

export function createFlightFx(scene, { calm = false, small = false } = {}) {
  const vfx = createVfx(scene, { calm, maxSparks: small ? 600 : 1200, maxPuffs: small ? 180 : 320, maxDebris: small ? 120 : 220, debrisMaterial: new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.9 }) });

  // ── the vapour cone ──
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 4, true).translate(0, -0.5, 0), coneMaterial());
  cone.visible = false;
  cone.renderOrder = 6;
  scene.add(cone);
  let coneLife = 0;

  // ── the contrail: a ribbon through where he's been, turned to the camera ──
  const N = 48;
  const trail = { pts: [], acc: 0 };
  const tgeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(N * 2 * 3);
  const talpha = new Float32Array(N * 2);
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage));
  tgeo.setAttribute('alpha', new THREE.BufferAttribute(talpha, 1).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  tgeo.setIndex(idx);
  const ribbon = new THREE.Mesh(
    tgeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * vA, vA); }',
    }),
  );
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 5;
  scene.add(ribbon);

  // ── craters: a pool of decals ──
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: 0xffffff });
  const craters = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), crackMat.clone());
    m.visible = false;
    m.renderOrder = 1;
    scene.add(m);
    return { m, life: 0 };
  });
  let next = 0;

  // ── re-entry: the air in front of him burning, streaming back past him ──
  const sheath = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uBurn: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */ `
        uniform float uBurn, uTime;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float front = smoothstep(-0.6, 1.0, vP.y); // hottest at the leading edge
          float rim = pow(1.0 - abs(dot(vN, vV)), 1.5) * smoothstep(-0.5, 0.7, vP.y); // and gone at the back
          float flick = 0.75 + 0.25 * h(floor(vP * 8.0 + uTime * 30.0));
          vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.92, 0.75), front);
          gl_FragColor = vec4(col * (rim * 1.6 + front * 0.5) * flick * uBurn * 2.2, 1.0);
        }`,
    }),
  );
  sheath.visible = false;
  sheath.renderOrder = 7;
  scene.add(sheath);
  let fireAcc = 0;

  const side = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const seg = new THREE.Vector3();

  return {
    vfx,
    // the sound barrier: a cone of mist and rings of air
    boom(at, dir) {
      const d = V(dir).normalize();
      cone.position.copy(V(at)).addScaledVector(Y, 1);
      cone.quaternion.setFromUnitVectors(Y, d);
      coneLife = 0.75;
      cone.visible = true;
      vfx.ring(V(at).addScaledVector(Y, 1), { color: 0xeaf6ff, from: 2, to: 70, life: 0.9, normal: d, opacity: 0.85 });
      vfx.ring(V(at).addScaledVector(Y, 1), { color: 0xffffff, from: 1, to: 28, life: 0.45, normal: d, opacity: 1 });
      vfx.flash(V(at), { color: 0xdff2ff, intensity: 60, distance: 40, life: 0.2 });
      vfx.sparks(V(at).addScaledVector(Y, 1), { count: 40, speed: 30, color: 0xffffff, to: 0x9fc8ff, life: 0.5, size: 0.18, dir: d.clone().negate(), spread: 0.5, gravity: 0 });
    },
    // a hard landing: a crater, a ring of dust, the street in the air
    slam(at, speed, onWater = false) {
      const k = Math.min(1, speed / 220);
      const p = V(at);
      if (!onWater) {
        const c = craters[next++ % craters.length];
        const r = 4 + k * 14;
        c.m.position.set(p.x, p.y + 0.03, p.z);
        c.m.scale.set(r, 1, r);
        c.m.rotation.y = Math.random() * Math.PI * 2;
        c.m.material.opacity = 1;
        c.m.visible = true;
        c.life = 25;
        vfx.debris(p.clone().addScaledVector(Y, 0.5), { count: Math.round(10 + k * 30), speed: 8 + k * 20, size: 0.18 + k * 0.25, dir: Y, spread: 0.9 });
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const q = p.clone().add(new THREE.Vector3(Math.cos(a) * (1.5 + k * 3), 0.6, Math.sin(a) * (1.5 + k * 3)));
        vfx.smoke(q, { size: 2 + k * 4, count: 2, life: 1.4 + k * 1.6, color: onWater ? 0xe8f2ff : 0x8a8278, to: onWater ? 0xffffff : 0xb3aa9c, rise: 1.5 + k * 3, opacity: 0.42 });
      }
      vfx.ring(p.clone().addScaledVector(Y, 0.4), { color: onWater ? 0xffffff : 0xd9cbb4, from: 1, to: 10 + k * 40, life: 0.7, opacity: 0.8 });
    },
    // hitting a wall at speed
    impact(at, n, speed) {
      const k = Math.min(1, speed / 220);
      const p = V(at);
      const d = V(n);
      vfx.debris(p, { count: Math.round(12 + k * 30), speed: 6 + k * 18, size: 0.2 + k * 0.3, dir: d, spread: 0.8 });
      vfx.sparks(p, { count: 30, speed: 14, dir: d, spread: 0.9 });
      vfx.smoke(p, { size: 3 + k * 4, count: 6, life: 2.5, color: 0x6e6a64, to: 0x9a958c, rise: 0.8, opacity: 0.6 });
      vfx.flash(p, { color: 0xffd9a8, intensity: 30, distance: 25, life: 0.15 });
    },
    // skimming or hitting the water
    splash(at, speed) {
      const p = V(at);
      vfx.sparks(p, { count: Math.round(20 + Math.min(60, speed / 3)), speed: 6 + speed / 20, color: 0xffffff, to: 0xbfe0ff, life: 0.9, size: 0.2, dir: Y, spread: 0.5, gravity: 14 });
      vfx.ring(p.clone().addScaledVector(Y, 0.2), { color: 0xffffff, from: 1, to: 8 + speed / 10, life: 0.8, opacity: 0.7 });
    },
    // how hard the air's burning round him (0…1), where he is, which way he's going
    plasma(k, p, dir) {
      sheath.visible = k > 0.02;
      if (!sheath.visible) return;
      const d = V(dir).normalize();
      sheath.material.uniforms.uBurn.value = k;
      sheath.position.set(p[0], p[1] + 1, p[2]).addScaledVector(d, 0.6);
      sheath.quaternion.setFromUnitVectors(Y, d);
      sheath.scale.set(1.05 + k * 0.4, 2.2 + k * 1.6, 1.05 + k * 0.4);
      fireAcc += 1;
      if (k > 0.3 && fireAcc % 2 === 0) vfx.fire(sheath.position.clone().addScaledVector(d, -2.5), { size: 1.2 + k * 1.6, count: 2, life: 0.5, color: 0xffd08a, to: 0xc2410c, rise: 0 });
    },
    takeoff(at) {
      const p = V(at);
      vfx.ring(p.clone().addScaledVector(Y, 0.15), { color: 0xd9cbb4, from: 0.5, to: 6, life: 0.45, opacity: 0.5 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        vfx.smoke(p.clone().add(new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a))), { size: 1.2, count: 1, life: 1, color: 0x9a9286, to: 0xc8beb0, rise: 0.6, opacity: 0.4 });
      }
    },
    update(dt, camera, viewportHeight, hero, speed) {
      // the cone swells and goes
      if (coneLife > 0) {
        coneLife -= dt;
        const t = 1 - Math.max(0, coneLife) / 0.75;
        const r = 2.2 + t * 4.5;
        cone.scale.set(r, 2.5 + t * 7, r);
        cone.material.uniforms.uFade.value = Math.max(0, 1 - t) ** 1.3;
        cone.material.uniforms.uTime.value += dt;
        cone.visible = coneLife > 0;
      }
      sheath.material.uniforms.uTime.value += dt;
      // the contrail: a point every few hundredths of a second, faster than 70 m/s
      trail.acc += dt;
      const chest = [hero.p[0], hero.p[1] + 1.1, hero.p[2]];
      if (trail.acc > 0.025) {
        trail.acc = 0;
        if (speed > 70) trail.pts.unshift({ p: chest, life: 1 });
        if (trail.pts.length > N) trail.pts.length = N;
      }
      for (const q of trail.pts) q.life -= dt * 1.4;
      while (trail.pts.length && trail.pts[trail.pts.length - 1].life <= 0) trail.pts.pop();
      const pts = [{ p: chest, life: speed > 70 ? 1 : 0 }, ...trail.pts].slice(0, N);
      for (let i = 0; i < N; i++) {
        const q = pts[Math.min(i, pts.length - 1)];
        const nq = pts[Math.min(i + 1, pts.length - 1)];
        seg.set(nq.p[0] - q.p[0], nq.p[1] - q.p[1], nq.p[2] - q.p[2]);
        toCam.set(camera.position.x - q.p[0], camera.position.y - q.p[1], camera.position.z - q.p[2]);
        side.crossVectors(seg, toCam).normalize();
        const along = i / (N - 1);
        const w = 0.35 * (1 - along * 0.6);
        // (faded out near the camera, which flies along it)
        const dc = toCam.length();
        const near = Math.min(1, Math.max(0, (dc - 14) / 30));
        const a = i < pts.length ? Math.max(0, q.life) * (1 - along) * 0.55 * Math.min(1, (speed - 40) / 80) * near : 0;
        tpos.set([q.p[0] + side.x * w, q.p[1] + side.y * w, q.p[2] + side.z * w, q.p[0] - side.x * w, q.p[1] - side.y * w, q.p[2] - side.z * w], i * 6);
        talpha[i * 2] = talpha[i * 2 + 1] = Math.max(0, a);
      }
      tgeo.attributes.position.needsUpdate = true;
      tgeo.attributes.alpha.needsUpdate = true;
      // the craters fade, after a while
      for (const c of craters) {
        if (!c.m.visible) continue;
        c.life -= dt;
        c.m.material.opacity = Math.min(1, c.life / 6);
        if (c.life <= 0) c.m.visible = false;
      }
      vfx.update(dt, camera, viewportHeight);
    },
    dispose() {
      vfx.dispose();
    },
  };
}
