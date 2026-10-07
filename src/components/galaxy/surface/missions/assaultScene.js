// A galactic assault, drawn and run in the surface scene: the soldiers of
// both sides (each kind's figure, as actors.js finds one), placed each
// frame from the rules (./assault.js), with a chevron over each in the
// side's colour; every command post as a column of its owner's light with
// a ring on the ground that fills as it's taken; the soldiers' shots as
// bolts of their side's colour through the surface's blaster, and the ones
// at you as its enemy bolts, which hit if they pass through you. The scene
// hands it the world once the things stand on it (begin), then calls
// update each frame.
//
// createAssaultMission({ parent, world, blaster, mission, emit, say, sounds,
// kit, warm, tier, reduced }) → { begin(), restart(), update(dt, you) →
// { atYou: [{ from, spread, damage, color }] }, targets, hit(target, damage),
// running(), started(), view(), target(x, z), chooseSide(side), deploy(id),
// youDown(), force(how), dispose() }

import * as THREE from 'three';
import { disposeTree } from '../../../../lib/three/renderer';
import { anyFigure } from '../actors';
import { groundAt } from '../walker';
import { RULES, SOLDIERS, battleView, chooseSide as pickSide, deploy as deployAt, endBattle, hitSoldier, newBattle, objectiveFor, stepBattle, youDown as putYouDown } from './assault';
import { sharpen } from '../../../../lib/three/textures';

const EYE = 1.4; // metres: where a soldier's bolt leaves from
const CHEST = 1.0; // metres: where one lands
const FALL = { over: 0.3, gone: 2.5 }; // seconds: a soldier tipping over, and cleared away
const TRACERS = { far: 140, most: 12, hear: 40, every: 0.15 }; // metres a shot is drawn within, drawn a frame at most, heard within, heard apart
const BARK = { first: 14, every: 24, spread: 10 }; // seconds between the sides' shouts
const NEUTRAL = '#d8d8d0';

const COLUMN_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COLUMN_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 1.6) * (1.0 - vUv.y) * (0.5 + 0.2 * sin(uTime * 2.0 - vUv.y * 10.0)) * uAlpha;
  gl_FragColor = vec4(uColor * 2.0, a);
}`;
// a ring that fills round from the top, by uFill (0…1)
const RING_VERT = `
varying float vAng;
void main() { vAng = atan(position.x, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = `
varying float vAng;
uniform vec3 uColor;
uniform float uFill;
void main() {
  float k = (vAng + 3.14159265) / 6.2831853;
  if (k > uFill) discard;
  gl_FragColor = vec4(uColor * 2.4, 0.85);
}`;

// a chevron pointing down, in a side's colour
function chevron(colour) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(10, 10, 14, 0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(12, 14);
  g.lineTo(52, 14);
  g.lineTo(32, 48);
  g.closePath();
  g.stroke();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });
}

export function createAssaultMission({ parent, world, blaster, mission, emit, say, sounds, kit = null, warm = (o) => Promise.resolve(o), tier = 'high', reduced = false }) {
  const group = new THREE.Group();
  group.name = 'assault';
  parent.add(group);
  const n = SOLDIERS[tier] ?? SOLDIERS.mid;
  const colourOf = (side) => (side ? mission.sides[side].colour : NEUTRAL);
  const marks = { attack: chevron(colourOf('attack')), defend: chevron(colourOf('defend')) };
  let battle = null;
  let seed = 1;
  let dead = false;
  let t = 0;
  let heardAt = -1;
  let barkAt = BARK.first;
  const env = { solids: world.solids, reach: world.reach };
  const view = () => (battle ? battleView(battle) : null);
  const tell = (event = null) => emit({ type: 'mission', event, view: view() });

  // ── the soldiers' bodies: one a soldier, by id, made once ──
  const bodies = [];
  function makeBodies() {
    for (const s of battle.soldiers) {
      const holder = new THREE.Group();
      holder.visible = false;
      group.add(holder);
      const mark = new THREE.Sprite(marks[s.side]);
      mark.scale.setScalar(0.02);
      mark.position.y = 2.4;
      mark.renderOrder = 8;
      holder.add(mark);
      const body = { holder, mark, fig: null, kind: s.kind, down: 0, flinch: 0, ready: false };
      bodies.push(body);
      anyFigure(s.kind, {}, kit)
        .then((fig) => {
          if (!fig || dead) return;
          holder.add(fig.model);
          body.fig = fig;
          mark.position.y = (fig.tall ?? 1.8) + 0.6;
          return warm(holder).then(() => (body.ready = true));
        })
        .catch(() => {});
    }
  }

  // ── the posts: a column of light and the rings ──
  const columnGeo = new THREE.CylinderGeometry(0.7, 0.7, 36, 16, 1, true).translate(0, 18, 0);
  const posts = [];
  function makePosts() {
    for (const p of battle.posts) {
      const g = new THREE.Group();
      const y = groundAt(world, p.at[0], p.at[1]);
      g.position.set(p.at[0], y + 0.05, p.at[1]);
      group.add(g);
      const column = new THREE.Mesh(columnGeo, new THREE.ShaderMaterial({ vertexShader: COLUMN_VERT, fragmentShader: COLUMN_FRAG, uniforms: { uColor: { value: new THREE.Color(colourOf(p.owner)) }, uTime: { value: 0 }, uAlpha: { value: p.fixed ? 0.45 : 0.8 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      column.renderOrder = 6;
      g.add(column);
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.r - 0.5, p.r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(colourOf(p.owner)).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(ring);
      const meter = new THREE.Mesh(new THREE.RingGeometry(p.r - 1.6, p.r - 0.7, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uColor: { value: new THREE.Color(colourOf(p.owner)) }, uFill: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      meter.visible = !p.fixed;
      g.add(meter);
      posts.push({ id: p.id, g, column, ring, meter, colour: new THREE.Color(colourOf(p.owner)) });
    }
  }
  const tmpColour = new THREE.Color();
  function paintPosts(dt) {
    for (const v of posts) {
      const p = battle.posts.find((q) => q.id === v.id);
      // the owner's colour, eased (neutral: the side taking it, faintly)
      tmpColour.set(colourOf(p.owner ?? p.taking));
      if (!p.owner) tmpColour.lerp(new THREE.Color(NEUTRAL), 0.5);
      v.colour.lerp(tmpColour, Math.min(1, dt * 3));
      v.column.material.uniforms.uColor.value.copy(v.colour);
      v.column.material.uniforms.uTime.value = t;
      v.ring.material.color.copy(v.colour).multiplyScalar(2);
      v.meter.material.uniforms.uColor.value.set(colourOf(p.owner ?? p.taking));
      v.meter.material.uniforms.uFill.value = p.owner || p.taking ? p.meter : 0;
    }
  }

  function reset() {
    for (const b of bodies) {
      b.down = 0;
      b.flinch = 0;
      b.holder.rotation.set(0, 0, 0);
      b.holder.visible = false;
    }
    barkAt = t + BARK.first;
  }

  function begin() {
    battle = newBattle(mission, { n, seed });
    if (!bodies.length) makeBodies();
    if (!posts.length) makePosts();
    reset();
    tell();
  }

  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const bodyOf = (id) => bodies[id];
  const fell = (id) => {
    const b = bodyOf(id);
    if (b && !b.down) b.down = 0.001;
  };

  return {
    begin,
    restart() {
      seed += 1;
      begin();
    },
    // the battle moved on; what's fired at you is for the scene to shoot
    update(dt, you) {
      t += dt;
      const atYou = [];
      if (!battle) return { atYou };
      const events = stepBattle(battle, dt, you ? { x: you.x, z: you.z } : null, env);
      let drawn = 0;
      for (const e of events) {
        if (e.type === 'shot') {
          const from = [e.from[0], groundAt(world, e.from[0], e.from[1]) + EYE, e.from[1]];
          if (e.atYou) atYou.push({ from, spread: 0.05, damage: RULES.atYou, color: colourOf(e.side) });
          else if (you && drawn < TRACERS.most && dist(e.from[0], e.from[1], you.x, you.z) < TRACERS.far) {
            drawn += 1;
            // (a miss lands off to one side of them)
            const off = e.hit ? 0 : 1.2;
            const to = [e.to[0] + (Math.random() - 0.5) * 2 * off, groundAt(world, e.to[0], e.to[1]) + CHEST + (Math.random() - 0.5) * off, e.to[1] + (Math.random() - 0.5) * 2 * off];
            blaster.tracer(from, to, colourOf(e.side));
          }
          if (you && t - heardAt > TRACERS.every && dist(e.from[0], e.from[1], you.x, you.z) < TRACERS.hear) {
            heardAt = t;
            sounds.blast?.();
          }
        } else if (e.type === 'down') fell(e.id);
        else if (e.type === 'spawn') {
          const b = bodyOf(e.id);
          if (b) {
            b.down = 0;
            b.holder.rotation.set(0, 0, 0);
            b.holder.visible = b.ready;
          }
        } else if (e.type === 'capture' || e.type === 'neutral' || e.type === 'phase') tell(e);
        else if (e.type === 'end') {
          say(mission.lines?.[e.won ? 'won' : 'lost']);
          tell({ type: e.won ? 'won' : 'lost' });
        }
      }
      // a shout from your side, now and then
      if (battle.phase === 'run' && !battle.result && battle.you.side && t > barkAt) {
        barkAt = t + BARK.every + (Math.random() - 0.5) * BARK.spread;
        const list = mission.barks?.[battle.you.side] ?? [];
        if (list.length) say([list[Math.floor(Math.random() * list.length)]]);
      }
      // the bodies, where the rules have them
      for (const s of battle.soldiers) {
        const b = bodies[s.id];
        if (!b) continue;
        if (!s.up && !b.down && b.holder.visible) b.down = 0.001;
        if (b.down) {
          b.down += dt;
          b.holder.rotation.x = -Math.min(Math.PI / 2, (b.down / FALL.over) * (Math.PI / 2));
          b.mark.visible = false;
          if (b.down > FALL.gone) b.holder.visible = false;
          continue;
        }
        if (!s.up) continue;
        if (!b.holder.visible && b.ready) b.holder.visible = true;
        b.mark.visible = true;
        b.holder.position.set(s.x, groundAt(world, s.x, s.z), s.z);
        b.holder.rotation.y = s.yaw;
        if (b.flinch > 0) {
          b.flinch -= dt;
          b.holder.rotation.z = Math.sin(b.flinch * 60) * b.flinch * 0.3;
        } else b.holder.rotation.z = 0;
        // (its head down under fire, or behind its cover: leaning in)
        const crouch = s.inCover || s.suppress > RULES.suppressed ? 0.16 : 0;
        b.holder.rotation.x += (crouch - b.holder.rotation.x) * Math.min(1, dt * 4);
        // (the far ones' legs aren't seen: their figures rest)
        if (b.fig && (!you || dist(s.x, s.z, you.x, you.z) < 120)) b.fig.update(dt, s.move * (reduced ? 0.5 : 1));
      }
      paintPosts(dt);
      return { atYou };
    },
    // what the blaster can hit: the enemy's soldiers standing
    get targets() {
      if (!battle || !battle.you.side) return [];
      const out = [];
      for (const s of battle.soldiers) {
        if (!s.up || s.side === battle.you.side) continue;
        const b = bodies[s.id];
        if (!b?.holder.visible) continue;
        out.push({ id: s.id, holder: b.holder, fig: { tall: b.fig?.tall ?? 1.8 } });
      }
      return out;
    },
    // one of yours landed
    hit(target, damage = RULES.yours) {
      const ev = hitSoldier(battle, target.id, damage, 'you');
      const b = bodies[target.id];
      if (b) b.flinch = 0.25;
      if (ev) {
        fell(ev.id);
        tell(ev);
      }
    },
    running: () => Boolean(battle && battle.phase === 'run' && !battle.result),
    started: () => Boolean(battle && battle.phase !== 'choose'),
    view,
    // where your side is wanted, for the compass
    target(x, z) {
      if (!battle || !battle.you.side || battle.result) return null;
      return objectiveFor(battle, battle.you.side, x, z);
    },
    chooseSide(side) {
      if (!battle || battle.phase !== 'choose') return;
      pickSide(battle, side);
      say(mission.lines?.start);
      tell({ type: 'start', side });
    },
    deploy(id) {
      if (!battle) return null;
      const at = deployAt(battle, id);
      if (at) tell({ type: 'deploy', id });
      return at;
    },
    youDown() {
      if (!battle) return;
      putYouDown(battle);
      tell({ type: 'youDown' });
    },
    // (for tests: the end, 'win' or 'lose')
    force(how) {
      if (!battle || battle.result) return;
      endBattle(battle, how === 'win', 'posts');
      say(mission.lines?.[how === 'win' ? 'won' : 'lost']);
      tell({ type: how === 'win' ? 'won' : 'lost' });
    },
    dispose() {
      dead = true;
      for (const b of bodies) b.fig?.dispose?.();
      for (const m of Object.values(marks)) {
        m.map.dispose();
        m.dispose();
      }
      columnGeo.dispose();
      disposeTree(group);
      group.removeFromParent();
    },
  };
}
