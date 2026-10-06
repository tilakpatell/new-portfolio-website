// The front: where the crew's war is being fought, on the map (the design:
// docs/superpowers/specs/2026-10-06-fleet-war-design.md). It sits at the
// war's contested sector (war.js) out in deep space, a glow and a name seen
// from far off. Come within sight of it and the battle's there to watch
// (battle.js fights it, battleScene.js draws it); fly into it and you're
// asked which side you'll fly for; pick one and you're in it. Leave and the
// battle waits for you, paused, till you come back. When it's over the war
// moves on (the attacker takes the sector if it won), the visit's save
// remembers it, and a while later the next battle's at the new front.
//
// zoneOf(dist, was) → 'in' | 'near' | 'out' is pure (tested).
// createFront(map, { side, models, small, tier, reduced, storage, emit,
//   makeBattle, makeScene }) → null (the side has no war, or it isn't ready)
//   or { update(dt, t, camera, camLocal, live) → { busy, hurt }, join(team),
//   hit(from, to, damage), targets, inZone, near, joined, info, where(),
//   goal(), win(team), dispose() }
// Points are in `map`'s space.

import * as THREE from 'three';
import { createBattle, perSide } from './battle';
import { createBattleScene } from './battleScene';
import { contested, loadWar, newWar, owner, resolve, saveWar } from './war';
import { warFor } from './wars';
import { DEEP } from './deep';

export const ZONE = {
  near: 900, // within sight: the battle's drawn and fought
  in: 260, // in it: you're asked to pick a side, and the pulse drive's held down
  out: 600, // and you're out of it again past here
  rest: 20, // seconds after a battle's over before the next one's at the front
};

export function zoneOf(dist, was) {
  if (dist < ZONE.in || (was === 'in' && dist < ZONE.out)) return 'in';
  return dist < ZONE.near ? 'near' : 'out';
}

// the front's name card, seen from far off (the wonders' names are in deep
// space's own atlas; this one's a canvas of its own)
function nameCard(title, sub) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.fillStyle = '#ffd9a8';
  g.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(title.toUpperCase().split('').join(' '), 256, 38);
  g.fillStyle = 'rgba(255,217,168,0.6)';
  g.fillRect(156, 50, 200, 1.5);
  g.fillStyle = 'rgba(235,240,255,0.85)';
  g.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(sub, 256, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFront(map, { side, models, small = false, tier = 'high', reduced = false, storage = null, emit = () => {}, makeBattle = createBattle, makeScene = createBattleScene }) {
  const war = warFor(side?.id);
  if (!war || !war.ready) return null;
  let state = loadWar(storage, war);
  const draw = makeScene(map, { models, small, reduced });
  let battle = null;
  let zone = 'out';
  let joined = null;
  let asked = false;
  let rest = 0; // seconds till the next battle, once one's over
  let shown = false;
  let battleAt = null; // where the battle on now is (the front may have moved on since)

  // the corridor's way (from the first side's home to the second's)
  const first = war.sectors[0].at;
  const last = war.sectors[war.sectors.length - 1].at;
  const axis = (() => {
    const dx = last[0] - first[0];
    const dz = last[2] - first[2];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  })();
  const sector = () => war.sectors[Math.max(0, Math.min(war.sectors.length - 1, contested(state)))];

  // the glow and the name, seen from far off
  const beacon = new THREE.Group();
  map.add(beacon);
  const glowTex = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.4, 1.4, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  glow.scale.setScalar(70);
  beacon.add(glow);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, toneMapped: false }));
  label.center.set(0.5, -0.4);
  label.scale.set(0.3, 0.056, 1);
  label.renderOrder = 9;
  beacon.add(label);
  let labelFor = '';
  const placeBeacon = () => {
    const s = sector();
    beacon.position.set(...s.at);
    const name = war.battleName(s);
    if (name !== labelFor) {
      labelFor = name;
      label.material.map?.dispose();
      label.material.map = nameCard('The front', name);
      label.material.needsUpdate = true;
    }
  };
  placeBeacon();

  const say = (sub) => emit({ type: 'event', id: 'battle', sub });

  // a battle at the front as it is now
  const start = () => {
    if (state.won !== null) {
      state = newWar(war); // (the war was won: it starts again from the middle)
      saveWar(storage, war, state);
      placeBeacon();
    }
    battleAt = sector().at;
    battle = makeBattle({ war, attacker: state.attacker, at: battleAt, axis, perSide: perSide(tier) });
    joined = null;
    asked = false;
    shown = false;
  };

  // the end of a battle: the war moves on, saved, and the card says so
  const ended = (over) => {
    const s = sector();
    const before = state;
    state = resolve(state, war, over.winner);
    saveWar(storage, war, state);
    const [a, b] = war.sides;
    const winner = war.sides[over.winner];
    const took = over.winner === before.attacker;
    let text = took ? `${winner.name} takes ${s.name}.` : `${winner.name} holds ${s.name}.`;
    if (state.won !== null) text += ` ${winner.name} has won ${war.name.replace(/^The /, 'the ')}. It starts again from the middle.`;
    else text += ` The front is at ${sector().name} now.`;
    const word = joined === null ? 'Battle over' : over.winner === joined ? 'Victory' : 'Defeat';
    emit({
      type: 'battle',
      what: 'over',
      over: { word, text, colours: [a.colour, b.colour], sectors: war.sectors.map((sec, i) => ({ name: sec.name, owner: owner(state, i), front: i === contested(state) })) },
    });
    if (joined !== null) say(state.won !== null ? (state.won === joined ? 'warWon' : 'warLost') : over.winner === joined ? 'won' : 'lost');
    rest = ZONE.rest;
    placeBeacon();
  };

  const front = {
    update(dt, t, camera, camLocal, live) {
      const at = battle ? battleAt : sector().at;
      const p = live ?? camLocal;
      const dist = Math.hypot(p.x - at[0], p.y - at[1], p.z - at[2]);
      const was = zone;
      zone = zoneOf(dist, was);
      let hurt = 0;
      // the beacon, from far off (not from inside the fight)
      beacon.visible = zone !== 'in';
      // (the name only out of the home system, as the wonders' are, and not on top of the fight)
      label.visible = dist > 160 && Math.hypot(p.x, p.z) > DEEP.system;
      glow.material.opacity = reduced ? 0.6 : 0.45 + 0.35 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7));
      if (zone === 'out') {
        if (shown) {
          draw.hide();
          shown = false;
        }
        return { busy: false, hurt: 0 };
      }
      // a battle's over and its rest is up: the next one, at the new front
      if (battle?.over && rest > 0) {
        rest -= dt;
        if (rest <= 0) {
          draw.hide();
          battle = null;
          shown = false;
        }
      }
      if (!battle) {
        start();
        models?.want?.([...new Set(war.sides.flatMap((s) => [...s.capitals.map((c) => c.kind), ...s.fighters.map((f) => f.kind)]))]);
      }
      if (!shown) {
        draw.show(battle, war);
        shown = true;
      }
      // arriving in it: which side will you fly for?
      if (zone === 'in' && was !== 'in' && !battle.over) {
        if (joined === null && !asked) {
          asked = true;
          const s = sector();
          emit({ type: 'battle', what: 'ask', ask: { battle: war.battleName(s), war: war.name, sector: s.name, attacker: state.attacker, sides: war.sides.map((o) => ({ name: o.name, colour: o.colour })) } });
          say('front');
        }
      }
      if (zone !== 'in' && was === 'in' && joined === null) emit({ type: 'battle', what: 'left' });
      const events = battle.update(dt, live ? { x: live.x, y: live.y, z: live.z, alive: true } : null);
      for (const e of events) {
        if (e.type === 'hurt') hurt += e.damage;
        else if (e.type === 'shield' && joined !== null) say('gens');
        else if (e.type === 'sub' && e.kind === 'bridge' && joined !== null) say('bridge');
        else if (e.type === 'sub' && e.kind === 'reactor' && joined !== null) say('reactor');
        else if (e.type === 'over') ended(e);
      }
      draw.update(dt, t, camera, camLocal, events, joined);
      return { busy: true, hurt };
    },

    // fly for a side (0 or 1), or stay out of it (null)
    join(team) {
      if (!battle || battle.over) return;
      if (team !== 0 && team !== 1) {
        emit({ type: 'battle', what: 'left' });
        return;
      }
      joined = team;
      battle.setYou(team);
      emit({ type: 'battle', what: 'joined', team });
      say('join');
    },

    hit: (from, to, damage) => (battle && joined !== null && !battle.over ? battle.hit(from, to, damage) : null),
    get targets() {
      return battle && joined !== null && zone !== 'out' ? battle.targets : [];
    },
    // in the fight (the pulse drive's held down, and the director waits)
    get inZone() {
      return zone === 'in';
    },
    // within sight of it
    get near() {
      return zone !== 'out';
    },
    get joined() {
      return joined;
    },
    get battle() {
      return battle;
    },
    get info() {
      return { war: war.id, state: { ...state }, zone, joined, battle: battle?.info ?? null };
    },
    // the war, for the nav map and the holotable
    where() {
      const s = sector();
      return { war: war.name, name: war.battleName(s), sector: s.name, at: s.at, contested: contested(state), sectors: war.sectors.map((sec, i) => ({ id: sec.id, name: sec.name, at: sec.at, owner: owner(state, i) })), colours: war.sides.map((o) => o.colour), sides: war.sides.map((o) => o.short) };
    },
    // where the autopilot takes you: just short of the fight, on your side of it
    goal() {
      return { id: 'front', at: sector().at, r: 30, reach: ZONE.in * 0.8 };
    },
    // (a dev hook: end the battle now, `team` the winner)
    win(team) {
      battle?.end?.(team);
    },
    dispose() {
      draw.dispose();
      beacon.removeFromParent();
      glow.material.dispose();
      glowTex?.dispose();
      label.material.map?.dispose();
      label.material.dispose();
    },
  };
  return front;
}
