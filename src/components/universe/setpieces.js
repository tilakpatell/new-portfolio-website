// The director's set pieces (director.js says when): the big moments that
// aren't just traffic.
//
// - A capital ship drops out of hyperspace near you: it comes in long
//   and thin, smeared along its line of flight in a flash of blue-white,
//   and snaps to its own shape, then drifts on, its fighters launching
//   from its belly; a while later it jumps away again, the same in reverse.
//   Which ship is the crew's side's (sides.js's `capitalShip`): a Star
//   Destroyer, a Federation cruiser, a Madrigal freighter.
// - A DEA helicopter for the roadblock (Albuquerque's): it drops in ahead of
//   you and hangs there, nose on, its searchlight on you, while the SUVs
//   hold you; when they're seen off (or after a while) it climbs away.
// - Portals: green portals swirl open where the Council of Ricks comes
//   through (as many as there are of them), and close behind them.
// - A comet: a bright head in a glowing coma, a straight blue ion tail and a
//   broader, curving dust tail, both streaming away from the sun, crossing
//   the sky well away from you.
// - A solar flare: the nearest star swells and blazes over a few seconds,
//   loops of plasma rising off it, then a coronal mass ejection, a cone of
//   glowing filaments, runs out from it at you (cme.js), and through you (the
//   scene takes the shields and scrambles the HUD as it passes: `arrives`).
// - A rift: a tear in space ahead of you and off to one side, a swirling
//   tunnel of blue-white light that opens, holds for a while and closes. Fly
//   into it and the scene takes you out of it somewhere else on the map.
//
// createSetPieces(parent, { small, fleet, solids }) → { destroyer(ship, kind) → { hangar } | null, leave(),
//   roadblock(ship) → boolean, chopperHere,
//   portals(points), comet(ship), flare(star, ship) → { arrives } | null,
//   rift(ship) → boolean, riftAt, riftInside(ship), closeRift(),
//   update(dt, t, camera) → busy, dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { SOLIDS, forward } from './ship';
import { RIFT_R, riftSpot } from './nav';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import { createEjection } from './cme';

export const STAR_DESTROYER = 16; // map units long

// Where a Star Destroyer drops in by a ship ({ x, y, z, heading }): 28 ahead
// and 10 off to `side` (1 or −1), broadside on, a little below; but never
// inside anything solid (parked at a station, 28 ahead is its middle): the
// other side, then further aside, until it's clear of every solid by more
// than its own half-length. [x, y, z] in the map's space.
export function destroyerSpot(ship, side, solids = SOLIDS) {
  const [fx, fz] = forward(ship.heading);
  const at = (aside, s) => [ship.x + fx * 28 - fz * s * aside, ship.y - 0.5, ship.z + fz * 28 + fx * s * aside];
  const clear = (p) => solids.every((o) => Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) > o.r + STAR_DESTROYER * 0.6);
  for (const aside of [10, 30, 60]) {
    for (const s of [side, -side]) {
      const p = at(aside, s);
      if (clear(p)) return p;
    }
  }
  return at(10, side);
}
// how long each capital ship is, in map units (a Star Destroyer's the biggest)
const CAPITAL = { destroyer: STAR_DESTROYER, fedcruiser: 12, madrigal: 8 };
const CHOPPER = { len: 1.6, ahead: 22, above: 0.4, stay: 45, climb: 6 }; // map units long; where it hangs; seconds it stays, and climbing away
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

// solids: what's solid where this flies (the map's, as it comes; a star
// system's, in the galaxy), so a capital ship never drops in inside a planet
export function createSetPieces(parent, { small = false, fleet = createFleet(), solids = () => SOLIDS } = {}) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const glow = keep(glowTexture());

  // the Star Destroyer, built the first time it's wanted
  let sd = null;
  let sdKind = null; // (which capital ship sd is)
  // the roadblock's helicopter: hanging ahead of you ('here'), then climbing away ('out')
  let chopper = null;
  const hover = { state: null, age: 0, at: new THREE.Vector3(), heading: 0 };
  const sdFlash = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.4, 3.2, 5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  sdFlash.visible = false;
  parent.add(sdFlash);
  const piece = { state: null, age: 0, heading: 0, at: new THREE.Vector3(), drift: new THREE.Vector3(), len: CAPITAL.destroyer };

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

  // the flare: the star's glare, its prominences and the ejection running
  // out from it (cme.js)
  const ejection = createEjection(parent, { small, glow });

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
    destroyer(ship, kind = 'destroyer') {
      if (piece.state) return null;
      // (the built one until the model's here; another side's ship, made again as this one)
      if (sd && ((!sd.model && fleet.loaded(kind)) || sdKind !== kind)) {
        sd.group.removeFromParent();
        sd.dispose();
        sd = null;
      }
      if (!sd) {
        fleet.want([kind]);
        sd = fleet.make(kind);
        sdKind = kind;
        sd.group.visible = false;
        parent.add(sd.group);
      }
      piece.len = CAPITAL[kind] ?? CAPITAL.destroyer;
      const side = Math.random() < 0.5 ? -1 : 1;
      piece.at.set(...destroyerSpot(ship, side, solids()));
      // crossing your path, slowly
      piece.heading = ship.heading + side * (Math.PI / 2 + 0.3);
      const [dx, dz] = forward(piece.heading);
      piece.drift.set(dx, 0, dz).multiplyScalar(1.4);
      piece.state = 'in';
      piece.age = 0;
      sd.group.visible = true;
      sdFlash.visible = true;
      sdFlash.position.copy(piece.at);
      return { hangar: piece.at.clone().add(new THREE.Vector3(0, -2.2 * (piece.len / CAPITAL.destroyer), 0)), heading: piece.heading };
    },
    // and it jumps away (early: the TIEs are all down)
    leave() {
      if (piece.state === 'here') piece.age = Math.max(piece.age, STAY);
      if (hover.state === 'here') hover.age = Math.max(hover.age, CHOPPER.stay);
    },
    // the DEA's helicopter over the roadblock, ahead of you and facing you
    roadblock(ship) {
      if (hover.state) return false;
      if (!chopper) {
        chopper = fleet.make('deachopper');
        parent.add(chopper.group);
      }
      const [fx, fz] = forward(ship.heading);
      hover.at.set(ship.x + fx * CHOPPER.ahead, ship.y + CHOPPER.above, ship.z + fz * CHOPPER.ahead);
      hover.heading = ship.heading + Math.PI; // (nose on to you)
      hover.state = 'here';
      hover.age = 0;
      chopper.group.visible = true;
      return true;
    },
    get chopperHere() {
      return hover.state === 'here';
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
      if (ejection.busy) return null;
      const dist = Math.hypot(ship.x - star.at[0], ship.y - star.at[1], ship.z - star.at[2]);
      const arrives = Math.max(FLARE_RISE, FLARE_RISE + (dist - star.r) / FLARE_SPEED);
      ejection.launch(star, ship, { rise: FLARE_RISE, speed: FLARE_SPEED, reach: Math.max(dist * 1.3, star.r * 6) });
      return { arrives };
    },
    get flareGoing() {
      return ejection.busy;
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
          shift = -((1 - k) ** 3) * piece.len * 4;
          if (k >= 1) piece.state = 'here';
        } else if (piece.state === 'here' && piece.age > STAY) {
          piece.state = 'out';
          piece.age = 0;
          sdFlash.visible = true;
          sdFlash.position.copy(piece.at);
        } else if (piece.state === 'out') {
          const k = Math.min(1, piece.age / JUMP);
          stretch = 1 + k * k * 18;
          shift = k * k * piece.len * 6;
          if (k >= 1) {
            piece.state = null;
            g.visible = false;
          }
        }
        g.scale.set(piece.len, piece.len, piece.len * stretch);
        g.translateZ(shift);
        sd.update(t);
        if (sdFlash.visible) {
          const a = piece.state === 'in' || piece.state === 'out' ? piece.age : JUMP + 1;
          const k = a < 0.15 ? a / 0.15 : Math.exp(-(a - 0.15) * 4);
          sdFlash.scale.setScalar(piece.len * (0.6 + k));
          sdFlash.material.opacity = k;
          if (a > 1.2) sdFlash.visible = false;
        }
      }

      if (hover.state) {
        busy = true;
        hover.age += dt;
        if (hover.state === 'here' && hover.age > CHOPPER.stay) {
          hover.state = 'out';
          hover.age = 0;
        }
        const g = chopper.group;
        // hanging there, a little unsteady; then up and away, nose down, gone
        const up = hover.state === 'out' ? hover.age * hover.age * 1.6 : 0;
        g.position.set(hover.at.x + Math.sin(t * 0.7) * 0.25, hover.at.y + Math.sin(t * 1.3) * 0.12 + up, hover.at.z + Math.cos(t * 0.6) * 0.25);
        g.rotation.set(hover.state === 'out' ? Math.min(0.4, hover.age * 0.2) : 0.12, hover.heading + Math.PI + Math.sin(t * 0.4) * 0.08, Math.sin(t * 0.9) * 0.05);
        g.scale.setScalar(CHOPPER.len);
        chopper.update(t);
        if (hover.state === 'out' && hover.age > CHOPPER.climb) {
          hover.state = null;
          g.visible = false;
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

      if (ejection.update(dt, t, camera)) busy = true;

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
      chopper?.dispose();
      ejection.dispose();
      for (const x of made) x.dispose();
    },
  };
}
