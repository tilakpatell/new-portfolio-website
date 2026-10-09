// A player for the tests: the input a person at the keys would give for
// the story's step, worked out from the game as it stands, so a story can
// be played start to end through rules/game.js's own step() with nothing
// fed to the story behind the game's back. It walks the way route.js
// gives (riding the lifts), presses E at what the step names, picks the
// lines that lead where the step wants, lies low for a hide, keeps still
// for a still, and shoots (or cuts) whoever a fight or a kill step names.
// Pure: the game is only read; `mem` keeps what it needs between steps.
//
//   autoInput(g, mem = {}) → input   rules/game.js's input for this step
//   steer(g, to, mem = {}) → input   the walk to { x, z, room } by route.js's way, riding the lifts
//   lineTo(talkId, node, want, ctx) → i   the line to pick in a talk's node for the shortest way to
//     `want` (a node), or to its end when want is null

import { TALKS } from '../talk';
import { reachable, talkCtx, KEYPAD } from './act';
import { routeTo, targetOf } from '../route';

const STILL = { dir: { x: 0, z: 0 }, pitch: 0 };
const NEAR = 0.45; // metres: a waypoint this close is passed
const AIM_AT = 1.2; // metres over the feet a shot is aimed at
const SHOOT = 22; // metres: near enough to shoot at
const CUT = 1.6; // metres: near enough to cut with a blade

const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

function stepOf(g) {
  if (!g.plot || g.plot.done) return null;
  return g.plot.story.steps.find((s) => s.id === g.plot.progress.step) ?? null;
}

// a breadth-first way through the talk's nodes, as the choices (with their whens) allow
export function lineTo(id, node, want, ctx) {
  const tree = TALKS[id];
  const ok = (c) => !c.when || Object.entries(c.when).every(([k, v]) => (k === 'flag' ? ctx.flags?.has(v) : k === 'not' ? !ctx.flags?.has(v) : true));
  const first = new Map();
  const seen = new Set([node]);
  const queue = [];
  (tree.nodes[node].choices ?? []).filter(ok).forEach((c, i) => {
    if (!seen.has(c.to)) {
      seen.add(c.to);
      first.set(c.to, i);
      queue.push(c.to);
    }
  });
  while (queue.length) {
    const at = queue.shift();
    const n = tree.nodes[at];
    if ((want && at === want) || (!want && n?.end)) return first.get(at);
    const nexts = n?.next ? [n.next] : (n?.choices ?? []).filter(ok).map((c) => c.to);
    for (const to of nexts) {
      if (seen.has(to)) continue;
      seen.add(to);
      first.set(to, first.get(at));
      queue.push(to);
    }
  }
  return 0;
}

// the walk to a point: at the next waypoint not yet passed; in a car, the ride
export function steer(g, to, mem = {}) {
  const r = routeTo(g, to);
  if (!r) return { ...STILL, yaw: g.you.yaw };
  // at the jump the way goes by (the chute's drop): E
  if (r.next.kind === 'jump' && r.next.room === g.you.room && Math.hypot(r.next.x - g.you.x, r.next.z - g.you.z) < 1) {
    mem.jump = !mem.jump;
    return { ...STILL, yaw: g.you.yaw, use: mem.jump };
  }
  const pts = r.points;
  let i = 1;
  // (a corner passed is passed; a door only once you are through it)
  while (i < pts.length - 1 && !pts[i].door && pts[i].room === g.you.room && Math.hypot(pts[i].x - g.you.x, pts[i].z - g.you.z) < NEAR) i++;
  let p = pts[Math.min(i, pts.length - 1)];
  if (p.door && pts[i + 1] && Math.hypot(p.x - g.you.x, p.z - g.you.z) < NEAR * 2) {
    // at the door: on through it, the way the next leg goes
    const q = pts[i + 1];
    const l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    p = { x: p.x + ((q.x - p.x) / l) * 1.5, z: p.z + ((q.z - p.z) / l) * 1.5, room: q.room };
  }
  const here = g.layout.rooms.get(g.you.room);
  if (p.room !== g.you.room && here?.kind === 'lift' && g.layout.rooms.get(p.room)?.kind === 'lift') {
    // (a press, then let go, so the next press is a press)
    mem.ride = !mem.ride;
    return { ...STILL, yaw: g.you.yaw, use: mem.ride && !g.lift };
  }
  const [dx, dz] = [p.x - g.you.x, p.z - g.you.z];
  const d = Math.hypot(dx, dz) || 1;
  return { ...STILL, dir: { x: dx / d, z: dz / d }, yaw: Math.atan2(dx, -dz) };
}

// at the person or thing a step names: face it, and E every other step
function pressAt(g, step, mem) {
  const t = targetOf(g);
  // (something you carry is used where you stand)
  if (!t && g.items?.has(step.target?.tag)) {
    mem.press = !mem.press;
    return { ...STILL, yaw: g.you.yaw, use: mem.press };
  }
  if (!t) return { ...STILL, yaw: g.you.yaw };
  const r = reachable(g);
  const tag = step.target?.npc ?? step.target?.tag;
  const yaw = yawTo(g.you, t);
  const ours = r && ((r.kind === 'talk' && (r.npc.tag === tag || r.npc.id === tag)) || (r.kind !== 'talk' && (r.thing?.tag === tag || r.jump?.id === tag)) || r.kind === 'step' || r.kind === 'keypad');
  if (ours || Math.hypot(t.x - g.you.x, t.z - g.you.z) < 1.1) {
    mem.press = !mem.press;
    return { ...STILL, yaw, use: mem.press };
  }
  return steer(g, t, mem);
}

// the nearest standing one the step names: shot at from range, cut from up close, walked to otherwise
function attack(g, step, mem) {
  const tag = step.target?.tag ?? step.target?.npc;
  const foes = g.crew.people.filter((p) => p.hp > 0 && (p.tag === tag || p.tag?.startsWith(`${tag}-`)));
  const you = g.you;
  const foe = foes.sort((a, b) => Math.hypot(a.x - you.x, a.z - you.z) - Math.hypot(b.x - you.x, b.z - you.z))[0];
  if (!foe) {
    // a thing to shoot out (a camera): from where you stand in its room, up at it
    const t = targetOf(g);
    if (!t || t.what !== 'thing') return { ...STILL, yaw: you.yaw };
    if (t.room !== you.room) return steer(g, t, mem);
    const d = Math.hypot(t.x - you.x, t.z - you.z);
    return { ...STILL, yaw: yawTo(you, t), pitch: Math.atan2((t.at ?? you.y + 1.4) + 0.15 - (you.y + 1.45), d), aim: true, fire: (mem.shot = !mem.shot) };
  }
  const d = Math.hypot(foe.x - you.x, foe.z - you.z);
  const yaw = yawTo(you, foe);
  const pitch = Math.atan2(foe.y + AIM_AT - (you.y + 1.45), d);
  const blade = !you.gun && you.blade;
  if (foe.room === you.room && d <= (blade ? CUT : SHOOT)) return { ...STILL, yaw, pitch, aim: !blade, fire: true };
  return steer(g, { x: foe.x, y: foe.y, z: foe.z, room: foe.room }, mem);
}

function fightBack(g) {
  const you = g.you;
  if (!you.gun) return null;
  const foe = g.crew.people
    .filter((p) => p.hp > 0 && p.mode === 'fight' && p.mind?.fight?.target === 'you' && p.room === you.room && Math.hypot(p.x - you.x, p.z - you.z) < SHOOT)
    .sort((a, b) => Math.hypot(a.x - you.x, a.z - you.z) - Math.hypot(b.x - you.x, b.z - you.z))[0];
  if (!foe) return null;
  const d = Math.hypot(foe.x - you.x, foe.z - you.z);
  return { ...STILL, yaw: yawTo(you, foe), pitch: Math.atan2(foe.y + AIM_AT - (you.y + 1.45), d), aim: true, fire: true };
}

export function autoInput(g, mem = {}) {
  const step = stepOf(g);
  if (g.talk) {
    if (g.talk.id === 'keypad') return { ...STILL, yaw: g.you.yaw, choice: Math.max(0, KEYPAD.indexOf(String(step?.need?.code ?? ''))) };
    const want = step?.need?.choice ?? step?.need?.node ?? null;
    const node = TALKS[g.talk.id]?.nodes[g.talk.node];
    const i = node?.choices?.length ? lineTo(g.talk.id, g.talk.node, want, talkCtx(g)) : 0;
    return { ...STILL, yaw: g.you.yaw, choice: i };
  }
  if (!step || g.scene) return { ...STILL, yaw: g.you.yaw };
  // (anyone shooting at you in your room is shot back at first, as a player would, but not while lying low)
  if (step.type !== 'hide' && step.type !== 'still') {
    const back = fightBack(g);
    if (back) return back;
  }
  switch (step.type) {
    case 'hide':
    case 'still':
      return { ...STILL, yaw: g.you.yaw, crouch: step.type === 'hide' };
    case 'reach':
    case 'escort': {
      const t = targetOf(g);
      return t ? steer(g, t, mem) : { ...STILL, yaw: g.you.yaw };
    }
    case 'use':
    case 'talk':
    case 'choose':
      return step.target ? pressAt(g, step, mem) : { ...STILL, yaw: g.you.yaw };
    case 'kill':
    case 'fight':
      return attack(g, step, mem);
    default:
      return { ...STILL, yaw: g.you.yaw };
  }
}
