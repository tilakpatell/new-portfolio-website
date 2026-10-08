// What you do with E, and with the lines you pick: talking to someone,
// using a jump point (the chute’s drop, the swing across the chasm),
// working a tagged thing (a panel, the scomp socket, the tractor beam’s
// controls, a sign, a chair, the saber on the throne’s arm), dialling a
// hatch’s keypad, and what a picked line asks the game to do. Each is
// told to the story (`used`, `talked`, `chose`, `dialled`) and to the
// eggs (`read`, `sat`, `pulled`, `chose`, `dialled`) as plain events the
// game hands on. Pure apart from the game it acts on.
//
//   talkCtx(g) → ctx                         talk.js’s ctx for you as you are now
//   useHere(g) → bool                        E: the first thing within reach, in that order; false: nothing
//   chooseHere(g, i) → bool                  a line picked in the open talk (or a number on a keypad)
//   openStoryTalk(g) → void                  a talk the story’s step brings to you (a call, the intercom)
//   reachable(g) → { kind: 'talk' | 'jump' | 'thing' | 'keypad', … } | null   what E would act on
//   KEYPAD                                   the numbers a hatch’s keypad offers
//
// g.talk: talk.js’s talk & { npc } | the keypad’s { id: 'keypad', tag, choices, … } | null

import { furnish } from '../furnish';
import { unlock } from '../doors';
import { raise } from '../alarm';
import { choose, openTalk, talkFor, WHO } from '../talk';
import { feedPlot } from './plot';

const TALK_REACH = 2.6; // metres you can talk across
const USE_REACH = 1.9; // metres you can reach a thing from
const FRONT = 0.2; // the cosine: a person or a thing must be roughly in front of you
export const KEYPAD = ['3263827', '1138', '2187', 'Leave it'];
// what a tagged thing tells the eggs when used
const READ = new Set(['exhaust-note', 'plans']);

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function ahead(you, at) {
  const [dx, dz] = [at.x - you.x, at.z - you.z];
  const d = Math.hypot(dx, dz) || 1;
  return (Math.sin(you.yaw) * dx - Math.cos(you.yaw) * dz) / d;
}

export const talkCtx = (g) => ({
  station: g.station,
  side: g.side,
  disguise: Boolean(g.you.armour && g.side === 'rebel'),
  helmet: Boolean(g.you.helmet),
  flags: g.flags,
  story: g.plot?.progress.step ?? null,
  hero: g.you.hero,
  tk: g.flags.has('tk421') ? 421 : null,
});

const tell = (g, event) => {
  g.events.push(event);
  feedPlot(g, event);
};

// the things in your room you can reach: furnished props with a tag
function things(g) {
  g.furnished ??= new Map();
  const room = g.layout.rooms.get(g.you.room);
  if (!room) return [];
  if (!g.furnished.has(room.id)) g.furnished.set(room.id, furnish(room, g.layout.station));
  return g.furnished.get(room.id).props.filter((p) => p.tag);
}

const lockOpen = (g, lock) => !lock || (lock.startsWith('flag:') && g.flags.has(lock.slice(5)));

export function reachable(g) {
  const you = g.you;
  const ctx = talkCtx(g);
  let best = null;
  for (const p of g.crew.people) {
    if (p.hp <= 0 || Math.abs(p.y - you.y) > 1.5) continue;
    const d = flat(p, you);
    if (d > TALK_REACH || ahead(you, p) < FRONT || (best && d >= best.d)) continue;
    const id = talkFor(p, ctx);
    if (id) best = { kind: 'talk', d, talk: id, npc: p };
  }
  if (best) return best;
  for (const j of g.layout.jumps ?? []) {
    if (j.from === you.room && flat(j, you) <= (j.r ?? 1.5) && lockOpen(g, j.lock)) return { kind: 'jump', jump: j };
  }
  let near = null;
  for (const t of things(g)) {
    const d = flat(t, you);
    if (d > USE_REACH + Math.max(t.w ?? 0, t.d ?? 0) / 2 || (near && d >= near.d)) continue;
    if (g.broken?.has(t.tag)) continue;
    near = { kind: t.tag === 'compactor-hatch' ? 'keypad' : 'thing', d, thing: t };
  }
  return near;
}

// what E says it will do, for the prompt
export function useText(r) {
  if (!r) return null;
  if (r.kind === 'talk') return `talk to ${r.npc.kind === 'mouse' ? 'the droid' : (WHO[r.npc.tag] ?? 'them')}`;
  if (r.kind === 'jump') return r.jump.prompt ?? 'go';
  if (r.kind === 'keypad') return 'dial the hatch’s keypad';
  return r.thing.text ? `read “${r.thing.text}”` : `use the ${r.thing.kind.replace(/-/g, ' ')}`;
}

export function useHere(g) {
  if (g.talk) return chooseHere(g, 0);
  const r = reachable(g);
  if (!r) return false;
  if (r.kind === 'talk') {
    const t = openTalk(r.talk, talkCtx(g));
    if (!t) return false;
    g.talk = { ...t, npc: r.npc.id };
    g.events.push({ type: 'say', who: t.who, name: WHO[t.who] ?? t.who, text: t.say });
    return true;
  }
  if (r.kind === 'jump') {
    tell(g, { type: 'used', tag: r.jump.id });
    g.teleport(r.jump.to);
    return true;
  }
  if (r.kind === 'keypad') {
    g.talk = { id: 'keypad', tag: r.thing.tag, who: 'keypad', say: 'The hatch’s keypad asks for the unit’s number.', choices: KEYPAD, end: false, npc: null };
    return true;
  }
  const tag = r.thing.tag;
  tell(g, { type: 'used', tag });
  if (READ.has(tag)) g.events.push({ type: 'read', tag });
  if (tag === 'krennic-chair') g.events.push({ type: 'sat', tag });
  if (tag === 'armrest-saber') does(g, 'pull-saber');
  return true;
}

export function openStoryTalk(g) {
  if (g.talk || !g.plot || g.plot.done) return;
  const step = g.plot.story.steps.find((s) => s.id === g.plot.progress.step);
  if (step?.type !== 'talk' || step.target || !step.need?.talk) return;
  const t = openTalk(step.need.talk, talkCtx(g));
  if (!t) return;
  g.talk = { ...t, npc: null };
  g.events.push({ type: 'say', who: t.who, name: WHO[t.who] ?? t.who, text: t.say });
}

function dial(g, i) {
  const pick = KEYPAD[i];
  g.talk = null;
  if (!pick || !/^\d+$/.test(pick)) return true;
  tell(g, { type: 'dialled', code: pick });
  for (const door of g.layout.doors.values()) if (door.lock === `code:${pick}`) unlock(g.doors, g.layout, door.id, { code: pick });
  return true;
}

export function chooseHere(g, i) {
  if (!g.talk) return false;
  if (g.talk.id === 'keypad') return dial(g, i);
  const npc = g.talk.npc;
  const { talk, effects } = choose(g.talk, i, talkCtx(g));
  g.talk = talk ? { ...talk, npc } : null;
  if (talk) g.events.push({ type: 'say', who: talk.who, name: WHO[talk.who] ?? talk.who, text: talk.say });
  for (const e of effects) {
    if (e.flag) g.flags.add(e.flag);
    if (e.event) tell(g, e.event);
    if (e.does) does(g, e.does, npc);
  }
  return true;
}

// What a picked line asks the game to do.
function does(g, name, npc = null) {
  const crew = g.crew;
  const section = g.layout.rooms.get(g.you.room)?.section;
  const at = { x: g.you.x, y: g.you.y, z: g.you.z };
  if (name === 'shoot-panel') {
    g.broken ??= new Set();
    g.broken.add('aa23-intercom');
    tell(g, { type: 'killed', kind: 'intercom', tag: 'aa23-intercom' });
    g.events.push({ type: 'blast', at, by: 'you' });
  } else if (name === 'chewie-loose') {
    for (const p of crew.people) if (p.room === g.you.room && p.side === 'imperial' && p.hp > 0) p.hostile = true;
    if (section) raise(g.alarm, section, 'seen', at, g.time);
    g.events.push({ type: 'roar', at });
  } else if (name === 'choke') {
    g.you.hp = Math.max(1, g.you.hp - 25);
    g.events.push({ type: 'choked', by: 'vader' });
  } else if (name === 'leia-joins') {
    feedPlot(g, { type: 'used', tag: 'leia' });
  } else if (name === 'officer-comes') {
    const p = crew.byId.get(npc);
    if (p) p.hostile = true;
  } else if (name === 'pull-saber') {
    g.items.add('saber');
    g.you.blade = 'green';
    tell(g, { type: 'pulled', tag: 'armrest-saber' });
  } else if (name === 'trick') {
    const near = crew.people.filter((p) => p.hp > 0 && p.side === 'imperial' && flat(p, g.you) < 4);
    for (const p of near) p.hostile = false;
    g.events.push({ type: 'trick', count: near.length });
  } else if (name === 'walls-stop') {
    g.flags.delete('walls-closing');
    g.flags.add('walls-stopped');
  }
}
