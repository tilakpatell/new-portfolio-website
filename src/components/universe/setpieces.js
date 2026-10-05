// The director's set pieces (director.js says when): the big moments that
// aren't just traffic.
//
// - A Star Destroyer drops out of hyperspace near you: it comes in long
//   and thin, smeared along its line of flight in a flash of blue-white,
//   and snaps to its own shape, then drifts on, its TIE fighters launching
//   from its belly; a while later it jumps away again, the same in reverse.
// - Portals: green portals swirl open where the Council of Ricks comes
//   through (as many as there are of them), and close behind them.
// - A comet: a bright head in a glowing coma, a straight blue ion tail and a
//   broader, curving dust tail, both streaming away from the sun, crossing
//   the sky well away from you.
// - A solar flare: the nearest star swells and blazes over a few seconds,
//   then a shell of light runs out from it across the map, through you (the
//   scene takes the shields and scrambles the HUD as it passes: `arrives`).
// - A rift: a tear in space ahead of you and off to one side, a swirling
//   tunnel of blue-white light that opens, holds for a while and closes. Fly
//   into it and the scene takes you out of it somewhere else on the map.
//
// createSetPieces(parent, { small }) → { destroyer(ship) → { hangar } | null, leave(),
//   portals(points), comet(ship), flare(star, ship) → { arrives } | null,
//   rift(ship) → boolean, riftAt, riftInside(ship), closeRift(),
//   update(dt, t, camera) → busy, dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { forward } from './ship';
import { RIFT_R, riftSpot } from './nav';
import { SWIRL_GLSL } from '../rickmorty/swirl';

const STAR_DESTROYER = 16; // map units long
const STAY = 55; // seconds it stays before jumping away
const JUMP = 0.7; // seconds to come out of (or go into) hyperspace
const FLARE_RISE = 3; // seconds the star swells before the shell leaves it
const FLARE_SPEED = 150; // map units a second the shell runs out at
const RIFT = { r: RIFT_R, open: 0.6, life: 20 }; // its radius (nav.js picks where it opens), how long it takes to open (and close), and how long it holds

const PORTAL_FRAG = `
uniform float uT;
uniform float uOpen;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, uT, uOpen, 7.0);
  if (c.a < 0.004) discard;
  gl_FragColor = vec4(c.rgb * 1.6, c.a);
}`;
const UV_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// the rift: the portal's swirl, its greens turned blue-white and hotter
const RIFT_FRAG = `
uniform float uT;
uniform float uOpen;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, uT, uOpen, 11.0);
  if (c.a < 0.004) discard;
  vec3 col = vec3(c.g * 0.55 + c.r * 0.3, c.g * 0.8, c.g * 1.25 + c.b * 0.4) * 1.5;
  gl_FragColor = vec4(col, c.a);
}`;

// the comet's tails: a long strip that turns to face the camera about its
// own length, bright at the head, fading and widening along it, the edges
// soft. aAlong: 0 at the head, 1 at the tail's end; aSide: −1…1 across
const TAIL_VERT = `
attribute float aAlong;
attribute float aSide;
uniform vec3 uHead;
uniform vec3 uDir;
uniform vec3 uBend;
uniform vec3 uCam;
uniform float uLength;
uniform float uWidth;
varying float vAlong;
varying float vSide;
void main() {
  vAlong = aAlong;
  vSide = aSide;
  // along the tail (the dust tail curves off to one side as it goes)
  vec3 p = uHead + uDir * aAlong * uLength + uBend * aAlong * aAlong * uLength;
  vec3 toCam = uCam - p;
  vec3 across = cross(uDir, toCam);
  float l = length(across);
  across = l > 1e-5 ? across / l : vec3(0.0, 1.0, 0.0);
  p += across * aSide * uWidth * (0.15 + 0.85 * sqrt(clamp(aAlong, 0.0, 1.0)));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const TAIL_FRAG = `
uniform vec3 uColor;
uniform float uFade;
varying float vAlong;
varying float vSide;
void main() {
  float across = clamp(1.0 - abs(vSide), 0.0, 1.0);
  float along = clamp(1.0 - vAlong, 0.0, 1.0);
  gl_FragColor = vec4(uColor * across * across * along * along * uFade, 1.0);
}`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tail(color, width, length) {
  const SEG = 40;
  const along = [];
  const side = [];
  const index = [];
  for (let i = 0; i <= SEG; i++) {
    along.push(i / SEG, i / SEG);
    side.push(-1, 1);
    if (i < SEG) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TAIL_VERT,
    fragmentShader: TAIL_FRAG,
    uniforms: {
      uHead: { value: new THREE.Vector3() },
      uDir: { value: new THREE.Vector3(1, 0, 0) },
      uBend: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
      uLength: { value: length },
      uWidth: { value: width },
      uColor: { value: new THREE.Color(...color) },
      uFade: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function createSetPieces(parent, { small = false, fleet = createFleet() } = {}) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const glow = keep(glowTexture());

  // the Star Destroyer, built the first time it's wanted
  let sd = null;
  const sdFlash = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.4, 3.2, 5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  sdFlash.visible = false;
  parent.add(sdFlash);
  const piece = { state: null, age: 0, heading: 0, at: new THREE.Vector3(), drift: new THREE.Vector3() };

  // portals, a few at once
  const portalGeo = keep(new THREE.PlaneGeometry(1, 1));
  const portals = Array.from({ length: 4 }, () => {
    const mat = keep(new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: PORTAL_FRAG, uniforms: { uT: { value: 0 }, uOpen: { value: 0 } }, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(portalGeo, mat);
    m.visible = false;
    m.userData.age = 0;
    parent.add(m);
    return m;
  });

  // the comet
  const comet = new THREE.Group();
  const head = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(4, 4.2, 4.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  const coma = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.5, 0.9, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  const ion = tail([0.45, 0.85, 2.2], 1.6, small ? 70 : 90);
  const dust = tail([1.6, 1.25, 0.8], 4.2, small ? 50 : 65);
  for (const t of [ion, dust]) made.push(t.geometry, t.material);
  comet.add(ion, dust, coma, head);
  comet.visible = false;
  parent.add(comet);
  const flight = { age: 0, life: 0, from: new THREE.Vector3(), vel: new THREE.Vector3() };

  // the flare: the star's glare, and the shell running out from it
  const flareGlow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 1, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  flareGlow.visible = false;
  parent.add(flareGlow);
  const flareShell = new THREE.Mesh(keep(new THREE.SphereGeometry(1, small ? 32 : 48, small ? 20 : 32)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  flareShell.visible = false;
  flareShell.frustumCulled = false;
  parent.add(flareShell);
  const fl = { age: -1, star: null, arrives: 0, reach: 0 };

  // the rift
  const riftMat = keep(new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: RIFT_FRAG, uniforms: { uT: { value: 0 }, uOpen: { value: 0 } }, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide }));
  const rift = new THREE.Mesh(portalGeo, riftMat);
  rift.visible = false;
  rift.userData.age = -1;
  parent.add(rift);
  const riftOpen = (age) => (age < RIFT.open ? age / RIFT.open : age < RIFT.life - RIFT.open ? 1 : Math.max(0, (RIFT.life - age) / RIFT.open));

  const q = new THREE.Quaternion();
  const cam = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const face = (obj, camera) => {
    parent.getWorldQuaternion(q);
    obj.quaternion.copy(q.invert()).multiply(camera.quaternion);
  };

  return {
    // a Star Destroyer drops out of hyperspace ahead of you and off to one
    // side, broadside on. Returns where its TIEs launch from (its belly), or
    // null if one's already here
    destroyer(ship) {
      if (piece.state) return null;
      // (the built one until the model's here)
      if (sd && !sd.model && fleet.loaded('destroyer')) {
        sd.group.removeFromParent();
        sd.dispose();
        sd = null;
      }
      if (!sd) {
        fleet.want(['destroyer']);
        sd = fleet.make('destroyer');
        sd.group.visible = false;
        parent.add(sd.group);
      }
      const [fx, fz] = forward(ship.heading);
      const side = Math.random() < 0.5 ? -1 : 1;
      piece.at.set(ship.x + fx * 28 - fz * side * 10, ship.y - 0.5, ship.z + fz * 28 + fx * side * 10);
      // crossing your path, slowly
      piece.heading = ship.heading + side * (Math.PI / 2 + 0.3);
      const [dx, dz] = forward(piece.heading);
      piece.drift.set(dx, 0, dz).multiplyScalar(1.4);
      piece.state = 'in';
      piece.age = 0;
      sd.group.visible = true;
      sdFlash.visible = true;
      sdFlash.position.copy(piece.at);
      return { hangar: piece.at.clone().add(new THREE.Vector3(0, -2.2, 0)), heading: piece.heading };
    },
    // and it jumps away (early: the TIEs are all down)
    leave() {
      if (piece.state === 'here') piece.age = Math.max(piece.age, STAY);
    },
    // where the comet's head is, for checking from a browser
    get cometAt() {
      return comet.visible ? head.position.clone() : null;
    },
    get destroyerHere() {
      return piece.state === 'here' || piece.state === 'in';
    },

    // portals opening at these points (the Council coming through)
    portals(points) {
      points.slice(0, portals.length).forEach((p, i) => {
        const m = portals[i];
        m.position.copy(p);
        m.userData.age = 0;
        m.visible = true;
      });
    },

    // the star flares: its glare swells for FLARE_RISE seconds, then a shell
    // of light runs out from it at FLARE_SPEED. Returns when the shell
    // reaches the ship (seconds from now), or null while one's still going
    flare(star, ship) {
      if (fl.age >= 0) return null;
      const dist = Math.hypot(ship.x - star.at[0], ship.y - star.at[1], ship.z - star.at[2]);
      fl.star = star;
      fl.arrives = Math.max(FLARE_RISE, FLARE_RISE + (dist - star.r) / FLARE_SPEED);
      fl.reach = Math.max(dist * 1.3, star.r * 6);
      fl.age = 0;
      const c = new THREE.Color(star.color);
      flareGlow.material.color.copy(c).multiplyScalar(2.5);
      flareGlow.position.set(...star.at);
      flareGlow.material.opacity = 0;
      flareGlow.visible = true;
      flareShell.material.color.copy(c).multiplyScalar(1.6);
      flareShell.material.opacity = 0;
      flareShell.position.set(...star.at);
      flareShell.visible = false;
      return { arrives: fl.arrives };
    },
    get flareGoing() {
      return fl.age >= 0;
    },

    // a rift tears open ahead of you and to one side, at your height, if
    // there's room for it clear of anything solid; false if not (or if one's
    // already open)
    rift(ship) {
      if (rift.userData.age >= 0) return false;
      const spot = riftSpot(ship);
      if (!spot) return false;
      rift.position.set(...spot);
      rift.userData.age = 0;
      rift.scale.setScalar(0.01);
      rift.visible = true;
      return true;
    },
    // where the rift is while it's open, or null
    get riftAt() {
      return rift.visible && rift.userData.age >= 0 ? rift.position : null;
    },
    // the ship's in it (it's open enough, and the ship's inside its ring)
    riftInside(ship) {
      if (!rift.visible || riftOpen(rift.userData.age) < 0.9) return false;
      return Math.hypot(ship.x - rift.position.x, ship.y - rift.position.y, ship.z - rift.position.z) < RIFT.r * 0.8;
    },
    // close it now (the ship's been through)
    closeRift() {
      if (rift.visible) rift.userData.age = Math.max(rift.userData.age, RIFT.life - RIFT.open);
    },

    // a comet across the sky, well away from you, crossing your view
    comet(ship) {
      const [fx, fz] = forward(ship.heading);
      const side = Math.random() < 0.5 ? -1 : 1;
      const ahead = 120 + Math.random() * 60;
      flight.from.set(ship.x + fx * ahead + fz * side * 40, ship.y + 4 + Math.random() * 8, ship.z + fz * ahead - fx * side * 40);
      flight.vel.set(-fz * side, -0.1, fx * side).normalize().multiplyScalar(9 + Math.random() * 4);
      flight.age = 0;
      flight.life = 28;
      comet.visible = true;
    },

    update(dt, t, camera) {
      let busy = false;
      camera.getWorldPosition(cam);
      parent.worldToLocal(cam);

      if (piece.state) {
        busy = true;
        piece.age += dt;
        const g = sd.group;
        piece.at.addScaledVector(piece.drift, dt);
        g.position.copy(piece.at);
        g.rotation.set(0, piece.heading + Math.PI, 0); // (its nose is +z; forward() is −z at heading 0)
        // smeared along its line of flight while it comes out of hyperspace (or goes in)
        let stretch = 1;
        let shift = 0;
        if (piece.state === 'in') {
          const k = Math.min(1, piece.age / JUMP);
          stretch = 1 + (1 - k) ** 3 * 14;
          shift = -((1 - k) ** 3) * STAR_DESTROYER * 4;
          if (k >= 1) piece.state = 'here';
        } else if (piece.state === 'here' && piece.age > STAY) {
          piece.state = 'out';
          piece.age = 0;
          sdFlash.visible = true;
          sdFlash.position.copy(piece.at);
        } else if (piece.state === 'out') {
          const k = Math.min(1, piece.age / JUMP);
          stretch = 1 + k * k * 18;
          shift = k * k * STAR_DESTROYER * 6;
          if (k >= 1) {
            piece.state = null;
            g.visible = false;
          }
        }
        g.scale.set(STAR_DESTROYER, STAR_DESTROYER, STAR_DESTROYER * stretch);
        g.translateZ(shift);
        sd.update(t);
        if (sdFlash.visible) {
          const a = piece.state === 'in' || piece.state === 'out' ? piece.age : JUMP + 1;
          const k = a < 0.15 ? a / 0.15 : Math.exp(-(a - 0.15) * 4);
          sdFlash.scale.setScalar(STAR_DESTROYER * (0.6 + k));
          sdFlash.material.opacity = k;
          if (a > 1.2) sdFlash.visible = false;
        }
      }

      for (const m of portals) {
        if (!m.visible) continue;
        busy = true;
        m.userData.age += dt;
        const a = m.userData.age;
        const open = a < 0.5 ? a / 0.5 : a < 1.6 ? 1 : Math.max(0, 1 - (a - 1.6) / 0.5);
        m.material.uniforms.uOpen.value = open;
        m.material.uniforms.uT.value = t;
        m.scale.setScalar(1.3 * (0.3 + 0.7 * open));
        face(m, camera);
        if (a > 2.1) m.visible = false;
      }

      if (fl.age >= 0) {
        busy = true;
        fl.age += dt;
        const age = fl.age;
        const star = fl.star;
        if (age < FLARE_RISE) {
          const k = age / FLARE_RISE;
          flareGlow.scale.setScalar(star.r * (1.2 + 2.3 * k * k) * 2);
          flareGlow.material.opacity = Math.min(1, age / 0.6);
        } else {
          flareGlow.material.opacity = Math.exp(-(age - FLARE_RISE) * 0.8);
          flareGlow.scale.setScalar(star.r * 3.5 * 2);
          const radius = star.r + (age - FLARE_RISE) * FLARE_SPEED;
          if (radius >= fl.reach) {
            fl.age = -1;
            flareGlow.visible = false;
            flareShell.visible = false;
          } else {
            flareShell.visible = true;
            flareShell.scale.setScalar(radius);
            flareShell.material.opacity = 0.22 * (1 - radius / fl.reach);
          }
        }
      }

      if (rift.visible) {
        busy = true;
        rift.userData.age += dt;
        const age = rift.userData.age;
        const open = riftOpen(age);
        riftMat.uniforms.uOpen.value = open;
        riftMat.uniforms.uT.value = t;
        rift.scale.setScalar(RIFT.r * 2 * (0.3 + 0.7 * open));
        face(rift, camera);
        if (age > RIFT.life) {
          rift.visible = false;
          rift.userData.age = -1;
        }
      }

      if (comet.visible) {
        busy = true;
        flight.age += dt;
        const k = flight.age / flight.life;
        const fade = Math.min(1, flight.age / 3, (flight.life - flight.age) / 3);
        tmp.copy(flight.from).addScaledVector(flight.vel, flight.age);
        head.position.copy(tmp);
        coma.position.copy(tmp);
        head.scale.setScalar(2.2);
        coma.scale.setScalar(9);
        head.material.opacity = fade;
        coma.material.opacity = fade * 0.8;
        // the tails stream away from the sun (the origin); the dust tail lags,
        // curving back along the comet's path
        const away = tmp.clone().normalize();
        const back = flight.vel.clone().normalize().negate();
        for (const [mesh, bend] of [
          [ion, 0],
          [dust, 0.35],
        ]) {
          const u = mesh.material.uniforms;
          u.uHead.value.copy(tmp);
          u.uDir.value.copy(away);
          u.uBend.value.copy(back).multiplyScalar(bend);
          u.uCam.value.copy(cam);
          u.uFade.value = fade;
        }
        if (k >= 1) comet.visible = false;
      }
      return busy;
    },

    dispose() {
      sd?.dispose();
      for (const x of made) x.dispose();
    },
  };
}
