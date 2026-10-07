// A world's battle (a site's `skirmish`: ./skirmish.js's rules), drawn
// and run in the surface scene: every soldier a figure with its gun
// (./soldier.js), placed each frame where the rules have it, aiming at
// what it's firing at, kneeling behind cover, falling the way it was shot;
// their shots at each other as bolts through the surface's blaster, and
// the ones at you as its enemy bolts, which hit if they pass through you.
// You fight for one side (galaxy/allegiance.js picks it); a small chevron
// in your side's colour marks the soldiers on yours. The scene calls
// update each frame, and hands your hits on to hit().
//
// createSkirmishScene({ parent, world, blaster, spec, side, say, sounds,
//   kit, warm, tier }) → { update(dt, you) → { atYou: [{
//   from, spread, damage, color }], kills: [{ side, kind }] }, targets,
//   hit(target, points, push), side, setSide(side), view(), dispose() }

import * as THREE from 'three';
import { groundAt } from './walker';
import { CHEST, EYE, RULES, SIZE, hitUnit, lineOfSight, newSkirmish, skirmishView, stepSkirmish } from './skirmish';
import { createSoldier, gunOf } from './soldier';
import { GUNS } from '../../universe/gunplay';

const DRAW = 170; // metres: soldiers further off than this aren't drawn
const NEAR = 70; // metres: further off, a soldier's moved three frames at a time
const TRACERS = { far: 150, most: 10, hear: 45, every: 0.12 }; // metres a shot is drawn within, drawn a frame at most, heard within, heard apart
const CORPSE = 7; // seconds a soldier lies where it fell
const AT_YOU = 0.4; // of a kind's damage, a bolt of theirs that hits you
const REACH = 140; // metres: the furthest your bolt can bring one down
const NEAR_HUD = 180; // metres from the front: the HUD shows the battle

function chevron(colour) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(10, 10, 14, 0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(14, 18);
  g.lineTo(50, 18);
  g.lineTo(32, 46);
  g.closePath();
  g.stroke();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity: 0.8 });
}

export function createSkirmishScene({ parent, world, blaster, spec, side, say = () => {}, sounds = {}, kit = null, warm = (o) => Promise.resolve(o), tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'skirmish';
  parent.add(group);
  const ground = (x, z) => groundAt(world, x, z);
  const env = { solids: world.solids, ground, water: world.water ?? null };
  const size = SIZE[tier] ?? SIZE.mid;
  let you = side ?? Object.keys(spec.sides)[0];
  let seed = 1;
  let b = newSkirmish({ ...spec, you }, { size, seed, env });
  let t = 0;
  let near = false; // (you're close enough to the fighting for the HUD to show it)
  let heardAt = -1;
  let mark = chevron(spec.sides[you].colour ?? '#9fd0ff');
  const colourOf = (s) => spec.sides[s]?.colour ?? '#ffffff';
  const boltOf = (u) => GUNS[gunOf(u.kind)]?.bolt ?? colourOf(u.side);

  // ── the soldiers' bodies: one a soldier, by id, made once ──
  const bodies = b.units.map((u) => {
    const s = createSoldier({ parent: group, kind: u.kind, variant: u.id, kit, warm, scale: u.kind === 'wookiee' ? 0.94 + ((u.id * 37) % 13) / 100 : 1 });
    const chev = new THREE.Sprite(mark);
    chev.scale.setScalar(0.018);
    chev.renderOrder = 8;
    chev.visible = false;
    s.holder.add(chev);
    return { s, chev, acc: 0, skip: u.id % 3 };
  });
  const markAll = () => {
    for (const [i, body] of bodies.entries()) {
      body.chev.material = mark;
      body.chev.position.y = (body.s.tall ?? 1.8) + 0.45;
      body.chev.userData.mine = b.units[i].side === you;
    }
  };
  markAll();
  Promise.all(bodies.map((x) => x.s.ready)).then(markAll);

  // each soldier as your weapons see it (scene.js's targets: holder, fig.tall, spec, hp)
  const handles = bodies.map((body, i) => ({
    skirmish: true,
    id: i,
    holder: body.s.holder,
    fig: { tall: 1.8 },
    spec: { kind: b.units[i].kind, hp: 1 },
    shield: 0,
    get hp() {
      const u = b.units[i];
      return u.up ? u.hp / RULES.yours : 0;
    },
  }));
  const chestOf = (T) => [T.x, ground(T.x, T.z) + CHEST[T.stance], T.z];
  const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);

  // what a hit of yours did: the kills, for the quest and the HUD
  const tally = (events, kills) => {
    for (const e of events) {
      if (e.type === 'hurt') bodies[e.id]?.s.flinch();
      else if (e.type === 'down') bodies[e.id]?.s.fall(e.clip);
      else if (e.type === 'kill' && e.by === 'you') kills.push({ side: e.side, kind: e.kind });
    }
  };

  return {
    get side() {
      return you;
    },
    // for your side now (the HUD's switch): the battle starts over, you with them
    setSide(next) {
      if (!spec.sides[next] || next === you) return;
      you = next;
      seed += 1;
      b = newSkirmish({ ...spec, you }, { size, seed, env });
      mark.map.dispose();
      mark.dispose();
      mark = chevron(colourOf(you));
      for (const body of bodies) body.s.rise();
      markAll();
    },
    update(dt, me, at = me) {
      t += dt;
      near = at ? Math.hypot(at.x - spec.front[0], at.z - spec.front[1]) < NEAR_HUD : false;
      const atYou = [];
      const kills = [];
      const events = stepSkirmish(b, dt, me ? { x: me.x, y: me.y, z: me.z } : null);
      let drawn = 0;
      for (const e of events) {
        if (e.type === 'shot') {
          const u = b.units[e.id];
          const near = at ? dist(u, at.x, at.z) : Infinity;
          const body = bodies[e.id];
          const from = (near < DRAW ? body.s.muzzle() : null) ?? [u.x, ground(u.x, u.z) + EYE[u.stance], u.z];
          if (e.target === 'you') atYou.push({ from, spread: 0.035 + 0.04 * u.suppress, damage: Math.max(3, Math.round(u.u.damage * AT_YOU)), color: boltOf(u) });
          else if (near < TRACERS.far && drawn < TRACERS.most) {
            drawn += 1;
            const T = b.units[e.target];
            const c = chestOf(T);
            // (a miss goes by them, high or wide)
            if (!e.hit) {
              c[0] += (Math.random() - 0.5) * 2.4;
              c[1] += Math.random() * 1.2 - 0.3;
              c[2] += (Math.random() - 0.5) * 2.4;
            }
            blaster.tracer(from, c, boltOf(u));
          }
          if (near < TRACERS.hear && t - heardAt > TRACERS.every) {
            heardAt = t;
            sounds.blast?.();
          }
        } else if (e.type === 'melee' || e.type === 'taunt') {
          const u = b.units[e.id];
          if (at && dist(u, at.x, at.z) < TRACERS.hear) sounds.roar?.();
        } else if (e.type === 'wave') {
          if (spec.lines?.wave && Math.random() < 0.5) say(spec.lines.wave[Math.floor(Math.random() * spec.lines.wave.length)]);
        } else if (e.type === 'spawn') bodies[e.id]?.s.rise();
      }
      tally(events, kills);
      // the bodies, where the rules have them
      for (const [i, u] of b.units.entries()) {
        const body = bodies[i];
        const s = body.s;
        const d = at ? dist(u, at.x, at.z) : 0;
        const gone = !u.up && s.dead && s.down > CORPSE;
        const show = s.loaded && d < DRAW && !gone && (u.up || s.dead);
        s.holder.visible = show;
        if (!show) continue;
        body.chev.visible = body.chev.userData.mine && u.up;
        // (the far ones three frames at a time, three frames' worth)
        body.acc += dt;
        if (d > NEAR && ++body.skip % 3) continue;
        const step = body.acc;
        body.acc = 0;
        const T = u.target === 'you' ? (me ? { x: me.x, z: me.z, y: me.y + 1.1, you: true } : null) : u.target != null ? b.units[u.target] : null;
        const aimAt = T ? (T.you ? [T.x, T.y, T.z] : T.up ? chestOf(T) : null) : null;
        s.update(step, { x: u.x, y: ground(u.x, u.z), z: u.z, yaw: u.yaw, move: u.up ? u.move : 0, speed: u.up ? u.move * u.u.speed : 0, kneel: u.up && u.stance === 'kneel', taunt: u.up && u.mode === 'taunt', aim: u.up && u.aim ? 1 : 0, at: aimAt });
      }
      return { atYou, kills };
    },
    // what your blaster can hit: the other side's soldiers standing, that you can see
    // (the same object a soldier every frame, so a saber stroke counts it once)
    targets(me) {
      const out = [];
      const eye = me ? [me.x, me.y + 1.6, me.z] : null;
      for (const [i, u] of b.units.entries()) {
        if (!u.up || u.side === you) continue;
        const body = bodies[i];
        if (!body.s.holder.visible) continue;
        if (eye && (dist(u, me.x, me.z) > REACH || !lineOfSight(env.solids, eye, chestOf(u)))) continue;
        const tg = handles[i];
        tg.fig.tall = body.s.tall * (u.stance === 'kneel' ? 0.62 : 1);
        tg.spec.kind = u.kind;
        tg.spec.hp = u.u.hp / RULES.yours;
        out.push(tg);
      }
      return out;
    },
    // one of yours landed: `points` of your weapon's damage, pushed along
    // `push` ({ x, z }), `breaks` a blast (they're thrown); the kills
    hit(target, points = 1, push = null, { breaks = false } = {}) {
      const kills = [];
      const u = b.units[target.id];
      if (!u?.up) return kills;
      const p = push ? [push.x, push.z] : [Math.sin(u.yaw + Math.PI), Math.cos(u.yaw + Math.PI)];
      tally(hitUnit(b, target.id, points * RULES.yours, p, 'you', { blown: breaks }), kills);
      return kills;
    },
    view: () => ({ ...skirmishView(b), near, side: you, comes: b.spec.comes, name: spec.name, sides: Object.fromEntries(Object.entries(spec.sides).map(([id, s]) => [id, { name: s.name, short: s.short, colour: s.colour, allegiance: s.allegiance }])) }),
    // (for tests)
    battle: () => b,
    dispose() {
      for (const body of bodies) body.s.dispose();
      mark.map.dispose();
      mark.dispose();
      group.removeFromParent();
    },
  };
}
