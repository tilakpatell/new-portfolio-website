// The Galactic Civil War's battle in the system you're in, flown in (gcw.js
// says what's on where; battles.js lays it out at the planet; universe/
// battle.js fights it; universe/battleScene.js draws it). Not a game you
// start: the war's on, on the clock every pilot shares, and if there's a
// battle in this system when you drop in (or one starts while you're here)
// it's there in front of you, and you're in it, on the Rebellion's side. The
// crew calls it out (crews.js's battle lines); the system's own fleets stand
// aside while it's on (world.js's quiet).
//
// Shared: the damage every pilot here does to its objectives is a tally
// (universe/tally.js, its epoch the battle's id) sent to the others in the
// system (the client's `fight`), so a shield generator one pilot takes down
// goes down for all of them; and what you did counts in the war (warState.js:
// points for each objective and fighter you take down, the battle won once
// for everyone in it), sent to everyone online (`war`).
//
// createWarFront(scene, { models, small, reduced, tier, emit, makeScene,
//   now }) → { enter(sys, world), update(dt, t, camera, live) → { busy, hurt },
//   hit(from, to, damage), targets, solids, setNet(client), onNet(e), battle,
//   info, win(team), dispose() }
// `live`: the ship ({ x, y, z }) while it's flying, or null. `solids`: the
// capital ships' hulls, for the ship to bump into (ship.js's, like the
// world's), changed when a battle starts or ends (onSolids is told).

import { createBattle } from '../universe/battle';
import { createBattleScene } from '../universe/battleScene';
import { createTally } from '../universe/tally';
import { GCW, battleAt, campaignAt, history, seeded } from './gcw';
import { layBattle } from './battles';
import { addPoints, addWin, receiveWar, warMessage, warTally, warVersion } from './warState';

export const FRONT = {
  metres: 53.3, // a map unit in the galaxy
  fightEvery: 0.4, // seconds between your word on the battle's objectives, at most
  fightAgain: 5, // and every this often anyway, while it's on
  warEvery: 2, // seconds between your word on the war, at most
  warAgain: 30, // and every this often anyway
  near: 1.5, // within this many of its radii, you're in it
};
const REBELS = 0;

export function createWarFront(scene, { models, small = false, reduced = false, tier = 'high', emit = () => {}, makeScene = createBattleScene, now = () => Date.now(), onSolids = () => {} } = {}) {
  const draw = makeScene(scene, { models, small, reduced, metres: FRONT.metres });
  let sys = null;
  let world = null;
  let battle = null; // battle.js's
  let on = null; // gcw.js's battleAt: which battle it is, and its clock
  let laid = null; // battles.js's layBattle
  let shown = false;
  let joined = false; // in among it (said once a battle)
  let tookPart = false; // you were in it at some point (a win's yours too)
  let ended = false; // its end's been counted
  let state = null; // gcw.js's history, worked out once a step (or when the war's tally changes)
  let stateKey = '';
  let solids = [];
  const fight = createTally('none', { cap: 4000 });
  let net = null;
  let fightDirty = false;
  let fightSent = -1e9;
  let warDirty = false;
  let warSent = -1e9;
  let clock = 0;

  const say = (sub) => emit({ type: 'event', id: 'battle', sub });

  const hulls = () => {
    const out = [];
    for (const cap of battle?.capitals ?? [])
      cap.spheres.forEach((sp, i) => out.push({ id: `war-${cap.id}-${i}`, at: [sp.c.x, sp.c.y, sp.c.z], r: sp.r, reach: sp.r, hull: `war-${cap.id}`, cap }));
    return out;
  };

  const stop = () => {
    if (shown) draw.hide();
    shown = false;
    battle = null;
    on = null;
    laid = null;
    joined = false;
    tookPart = false;
    ended = false;
    world?.quiet?.(false);
    if (solids.length) {
      solids = [];
      onSolids(solids);
    }
  };

  const start = (b, ms) => {
    laid = layBattle(sys, b, { now: ms, tier });
    fight.reset(b.id);
    on = b;
    battle = createBattle({
      ...laid,
      rand: seeded(b.id),
      // what the other pilots here did to an objective (the tally's, less your own share of it)
      shared: (id) => Math.max(0, fight.value(id) - fight.mine(id)),
      onMine: (id, damage) => {
        fight.add(id, damage);
        fightDirty = true;
      },
    });
    battle.setYou(REBELS);
    draw.show(battle, laid.war);
    shown = true;
    world?.quiet?.(true);
    solids = hulls();
    onSolids(solids);
    say('front');
  };

  // the war as it stands (a step's worth at a time, or when what the players did changes)
  const warState = (ms) => {
    const c = campaignAt(ms);
    const key = `${c.n}:${c.step}:${warVersion()}`;
    if (key !== stateKey) {
      const t = warTally(ms);
      state = history(c.n, ms, (k) => t.value(k));
      stateKey = key;
    }
    return state;
  };

  const sendNet = (dt) => {
    clock += dt;
    if (!net) return;
    if (battle && !battle.over && (fightDirty ? clock - fightSent > FRONT.fightEvery : clock - fightSent > FRONT.fightAgain)) {
      net.fight?.(fight.message());
      fightSent = clock;
      fightDirty = false;
    }
    if (warDirty ? clock - warSent > FRONT.warEvery : clock - warSent > FRONT.warAgain && warTally(now()).keys().length) {
      net.war?.(warMessage(now()));
      warSent = clock;
      warDirty = false;
    }
  };

  const front = {
    // a system entered (and its world), or left (null)
    enter(next, w = null) {
      stop();
      sys = next;
      world = w;
    },

    update(dt, t, camera, live) {
      sendNet(dt);
      if (!sys) return { busy: false, hurt: 0 };
      const ms = now();
      const b = battleAt(warState(ms), sys.id, ms);
      if (b?.id !== on?.id) {
        stop();
        // (not in its lull: the next one's along when the step's up)
        if (b?.fighting) start(b, ms);
      }
      if (!battle) return { busy: false, hurt: 0 };
      let hurt = 0;
      const events = battle.update(dt, live ? { x: live.x, y: live.y, z: live.z, alive: true } : null);
      if (live) {
        const d = Math.hypot(live.x - laid.at[0], live.y - laid.at[1], live.z - laid.at[2]);
        if (d < laid.radius * FRONT.near) {
          tookPart = true;
          if (!joined && !battle.over) {
            joined = true;
            say('join');
          }
        }
      }
      for (const e of events) {
        if (e.type === 'hurt') hurt += e.damage;
        else if (e.type === 'down' && e.mine) {
          addPoints(sys.id, on.step, GCW.points.kill, ms);
          warDirty = true;
        } else if (e.type === 'sub') {
          if (e.mine) {
            addPoints(sys.id, on.step, GCW.points.objective, ms);
            warDirty = true;
          }
          if (tookPart && e.kind === 'bridge') say('bridge');
          else if (tookPart && e.kind === 'reactor') say('reactor');
        } else if (e.type === 'shield' && tookPart) say('gens');
        else if (e.type === 'capital') {
          // a capital ship gone: its hull's not there to hit any more
          for (const o of solids) if (o.cap.id === e.id) o.r = o.reach = 0;
        } else if (e.type === 'over' && !ended) {
          ended = true;
          if (e.winner === REBELS && tookPart) {
            addWin(sys.id, on.step, ms);
            warDirty = true;
          }
          if (tookPart) say(e.winner === REBELS ? 'won' : 'lost');
        }
      }
      draw.update(dt, t, camera, camera?.position ?? { x: 0, y: 0, z: 0 }, events, REBELS);
      return { busy: true, hurt };
    },

    hit: (from, to, damage) => (battle && !battle.over ? battle.hit(from, to, damage) : null),
    get targets() {
      return battle && !battle.over ? battle.targets : [];
    },
    get solids() {
      return solids;
    },
    get battle() {
      return battle;
    },
    get on() {
      return on;
    },
    get info() {
      return { sys: sys?.id ?? null, on, laid: laid ? { at: laid.at, axis: laid.axis, lines: laid.lines, radius: laid.radius, name: laid.war.name, attacker: laid.attacker } : null, battle: battle?.info ?? null, joined, tookPart };
    },

    setNet(client) {
      net = client ?? null;
    },
    // what the other pilots say: the war (from anywhere), the battle here
    onNet(e) {
      if (e.type === 'war') receiveWar(e.from, e.msg, now());
      else if (e.type === 'fight' && battle && e.msg.e === fight.epoch) fight.receive(e.from, e.msg);
    },

    // (a dev hook: end the battle now, `team` the winner)
    win(team) {
      battle?.end?.(team);
    },
    dispose() {
      stop();
      draw.dispose();
    },
  };
  return front;
}
