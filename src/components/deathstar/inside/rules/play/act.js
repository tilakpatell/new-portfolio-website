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
//   reachable(g) → { kind: 'step' | 'stand' | 'talk' | 'jump' | 'thing' | 'keypad', … } | null   what E would act on;
//     'step': what the story's use, talk or choose step names (someone, a tagged thing, a place on a
//     wall or a hull by its spot's name, or a thing you carry), which E does the step's work at:
//     its talk opened, or its `used` told; 'stand': up out of the seat you sit in; then someone to
//     talk to, unless a tagged thing is as squarely before you; a jump; a thing (a tagged one before
//     a console that only reads out, readouts.js, or an empty seat)
//   standUp(g) → bool                        out of your seat, stood in front of it
//   KEYPAD                                   the numbers a hatch’s keypad offers
//   SEATS                                    what can be sat in, and what E says there
//   FREE                                     what each tagged thing does where no story is under way;
//     E is offered at a thing only where it does something: a sign, a seat, the saber and the keypad
//     anywhere, the rest where the story's step names them, or in free roam where FREE has a use
//
// g.talk: talk.js’s talk & { npc } | the keypad’s { id: 'keypad', tag, choices, … } | null

import { furnish } from '../furnish';
import { unlock } from '../doors';
import { raise } from '../alarm';
import { assign } from '../brains';
import { choose, openTalk, talkFor, WHO } from '../talk';
import { bringAlong, feedPlot } from './plot';
import { READS, readoutOf } from './readouts';
import { seatedAt } from '../seats';

const TALK_REACH = 2.6; // metres you can talk across
const USE_REACH = 1.9; // metres you can reach a thing from
const FRONT = 0.2; // the cosine: a person or a thing must be roughly in front of you
const CLOSE = 0.8; // metres: this near, it is in front of you whichever way you face
const BODY_R = 0.6; // metres: someone is reached at their body, not their middle
// what E does, said in the prompt, for a step's target by its tag
const NOUNS = {
  'ctl-door': 'override the door’s lock',
  beacon: 'fix the homing beacon to her hull',
  'aa23-intercom': 'answer the intercom',
  'st321-console': 'take the call at the console',
  comlink: 'call Threepio on the comlink',
  dianoga: 'fight free',
};
export const KEYPAD = ['3263827', '1138', '2187', 'Leave it'];
// what a tagged thing tells the eggs when used
const READ = new Set(['exhaust-note', 'plans']);
// what is offered to E whatever the story: a sign read, a seat sat in, a saber pulled, a keypad
const ALWAYS = new Set(['krennic-chair', 'armrest-saber', 'compactor-hatch', ...READ]);
const FIRE_AGAIN = 30; // seconds before the superlaser can be fired again in free roam
// what you can sit in, and what E says it will do there: a seat nobody else is in
export const SEATS = { chair: 'sit down', bench: 'sit on the bench', throne: 'sit on the throne', 'meditation-pod': 'sit in the meditation chamber' };
const SEAT_OUT = 0.45; // metres in front of a seat's edge you stand up to
const TAKEN = 0.6; // metres: someone this near a seat's middle sits in it

// What a tagged thing does where no story is under way (free roam, or a story played out): a lever
// thrown, a bridge run out, the station's plans read off a socket. Anything not here, and not
// always offered, is the story's alone, and E isn't offered at it unless the story's step names it.
const line = (g, who, text) => g.events.push({ type: 'say', who, name: who === 'you' ? (WHO[g.you.hero] ?? 'You') : (WHO[who] ?? who), text });
function toggle(g, flag, on, off) {
  const now = !g.flags.has(flag);
  if (now) g.flags.add(flag);
  else g.flags.delete(flag);
  return now ? on : off;
}
export const FREE = {
  'ambush-panel': (g) => line(g, 'console', 'A smuggler’s catch: the compartment opens from in here, and from nowhere else.'),
  scomp: (g) => {
    for (const id of g.layout.rooms.keys()) g.seen.add(id);
    // (and to a Rebel, as to Artoo plugged in, the Empire's own doors: the way off the bay's deck in free roam)
    const rebel = g.you.side === 'rebel' && !(g.you.armour && g.you.helmet);
    if (rebel) for (const d of g.layout.doors.values()) if (d.lock === 'side:imperial') unlock(g.doors, g.layout, d.id, { scomp: true });
    line(g, 'console', rebel ? 'The scomp link gives up the station’s plans, and opens the Empire’s doors to you.' : 'The scomp link gives up the station’s plans: every section is on your map now.');
  },
  'chute-grate': (g) => {
    // (down the garbage chute: the grate's hatch opened, and you and those with you through it)
    g.flags.add('grate');
    g.teleport('chute-slide');
    bringAlong(g);
  },
  'tractor-terminal': (g) => line(g, 'console', g.flags.has('tractor-off') ? 'Tractor beam: power off at both couplings.' : 'Tractor beam: holding. Power is cut at the two couplings on the levers.'),
  'tractor-power-1': (g) => tractorLever(g, 1),
  'tractor-power-2': (g) => tractorLever(g, 2),
  'bridge-control': (g) => line(g, 'console', toggle(g, 'bridge', 'The bridge slides out across the chasm.', 'The bridge draws back into the wall.')),
  grapple: (g) => {
    g.flags.add('grapple');
    line(g, 'you', 'The grapple’s line catches on the pipe overhead.');
  },
  'st321-console': (g) => {
    const t = openTalk('st321', talkCtx(g));
    if (t) {
      g.talk = { ...t, npc: null };
      g.events.push({ type: 'say', who: t.who, name: WHO[t.who] ?? t.who, text: t.say });
    } else line(g, 'console', 'No shuttle is calling.');
  },
  'firing-switch': (g) => {
    if (g.time - (g.firedAt ?? -Infinity) < FIRE_AGAIN) return line(g, 'console', 'Main reactor recharging.');
    g.firedAt = g.time;
    g.scene = { id: 'cruiser', t: 0 };
  },
};
function tractorLever(g, n) {
  const off = toggle(g, `tractor-power-${n}-off`, true, false);
  const both = g.flags.has('tractor-power-1-off') && g.flags.has('tractor-power-2-off');
  if (both) g.flags.add('tractor-off');
  else g.flags.delete('tractor-off');
  line(g, 'console', both ? 'Tractor beam: power off. Nothing holds the bay now.' : off ? 'One coupling down. The other still holds.' : 'Coupling restored.');
}

// what E says it will do at a thing, where saying “use the …” would tell you nothing
const DOES = {
  'ambush-panel': 'try the compartment’s catch',
  scomp: 'read the station’s plans off the scomp link',
  'chute-grate': 'drop down the garbage chute',
  'tractor-terminal': 'read the tractor beam’s status',
  'tractor-power-1': 'throw the power coupling',
  'tractor-power-2': 'throw the power coupling',
  'bridge-control': 'work the bridge controls',
  grapple: 'throw the grapple over the pipe',
  'st321-console': 'answer the shuttle’s call',
  'firing-switch': 'fire the superlaser',
  'krennic-chair': 'sit in the empty chair',
  'armrest-saber': 'take the lightsaber',
  plans: 'open the station’s plans',
};

// who E says you will talk to, of the crew nobody names
const CREW_AS = {
  stormtrooper: 'the stormtrooper',
  officer: 'the officer',
  gunner: 'the gunner',
  dstrooper: 'the Death Star trooper',
  tiepilot: 'the TIE pilot',
  royalguard: 'the Royal Guard',
  technician: 'the technician',
  mouse: 'the droid',
  gonk: 'the droid',
};

// what E says at a console that reads out, where its kind's name wouldn't say it
const READS_AS = {
  intercom: 'call on the intercom',
  'door-panel': 'read the cell door’s panel',
  station: 'read the crew station',
  'fire-console': 'read the fire control console',
  'pentagon-screen': 'read the screen',
  'button-bank': 'read the console',
  bank: 'read the console',
  desk: 'read the desk’s screen',
};

const storyOn = (g) => Boolean(g.plot && !g.plot.done);
// whether E is offered at a tagged thing: what the story's step names, what is always offered, and in
// free roam whatever has a use there
function offered(g, t) {
  if (!t.tag) return READS.has(t.kind) || (Object.hasOwn(SEATS, t.kind) && free(g, t));
  // (the saber off the armrest once: it is yours now)
  if (t.tag === 'armrest-saber' && g.items.has('saber')) return false;
  if (ALWAYS.has(t.tag) || t.text) return true;
  if (!storyOn(g)) return Boolean(FREE[t.tag]);
  const step = g.plot.story.steps.find((q) => q.id === g.plot.progress.step);
  const tag = step?.target?.tag;
  return Boolean(tag && (t.tag === tag || t.tag.startsWith(`${tag}-`)));
}

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const free = (g, seat) => !g.crew.people.some((p) => p.hp > 0 && p.room === g.you.room && flat(p, seat) < TAKEN);
// how squarely before you something is, along where you look (the camera's way: standing, a glance
// doesn't turn your body), 1 dead ahead
function ahead(you, at) {
  const [dx, dz] = [at.x - you.x, at.z - you.z];
  const d = Math.hypot(dx, dz) || 1;
  const yaw = you.look ?? you.yaw;
  return (Math.sin(yaw) * dx - Math.cos(yaw) * dz) / d;
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
  // (the tagged things, the consoles and intercoms that read out (readouts.js), and the seats)
  return g.furnished.get(room.id).props.filter((p) => p.tag || READS.has(p.kind) || Object.hasOwn(SEATS, p.kind));
}

const lockOpen = (g, lock) => !lock || (lock.startsWith('flag:') && g.flags.has(lock.slice(5)));

// What E does the story's step at, if you are at it: the step's use, talk or choose names someone (by
// tag), a tagged thing, a place by its spot's name (a door's panel, a hull, an intercom), or a thing
// you carry (the comlink, anywhere). A jump the step names is the jump's own, and a keypad's code is
// the keypad's, so neither is the step's here.
const NAMED = new Set(['use', 'talk', 'choose']);
export function stepAt(g) {
  const step = g.plot && !g.plot.done ? g.plot.story.steps.find((q) => q.id === g.plot.progress.step) : null;
  if (!step || !NAMED.has(step.type) || !step.target || step.target.spot || step.need?.code != null) return null;
  const tag = step.target.npc ?? step.target.tag;
  if (g.layout.jumps?.some((j) => j.id === tag)) return null;
  const you = g.you;
  if (g.items?.has(tag)) return { kind: 'step', step, tag, d: 0 };
  const p = g.crew.people.find((q) => (q.tag === tag || q.id === tag) && q.hp > 0);
  if (p) {
    const d = flat(p, you);
    const reach = step.type === 'use' ? USE_REACH + BODY_R : TALK_REACH;
    return p.room === you.room && Math.abs(p.y - you.y) <= 1.5 && d <= reach && (d < CLOSE || ahead(you, p) >= FRONT) ? { kind: 'step', step, tag, d, npc: p } : null;
  }
  const t = things(g).find((q) => q.tag === tag);
  if (t) {
    const d = flat(t, you);
    return d <= USE_REACH + Math.max(t.w ?? 0, t.d ?? 0) / 2 && (d < CLOSE || ahead(you, t) >= FRONT) ? { kind: 'step', step, tag, d, thing: t } : null;
  }
  const s = g.layout.station.spots?.[tag];
  if (s && s.room === you.room) {
    const d = flat(s, you);
    return d <= USE_REACH && (d < CLOSE || ahead(you, s) >= FRONT) ? { kind: 'step', step, tag, d } : null;
  }
  return null;
}

export function reachable(g) {
  const you = g.you;
  // (what the story's step names comes first, so the comlink in your hand isn't lost to the hatch's keypad)
  const named = stepAt(g);
  if (named) return named;
  // (sat down, E stands you up)
  if (you.seat) return { kind: 'stand' };
  const ctx = talkCtx(g);
  let best = null;
  for (const p of g.crew.people) {
    if (p.hp <= 0 || Math.abs(p.y - you.y) > 1.5) continue;
    const d = flat(p, you);
    if (d > TALK_REACH || ahead(you, p) < FRONT || (best && d >= best.d)) continue;
    const id = talkFor(p, ctx);
    if (id) best = { kind: 'talk', d, talk: id, npc: p };
  }
  // (a thing with a use of its own before a console that only reads out or a seat: the superlaser's
  // switch, not the crew station beside it)
  let near = null;
  for (const t of things(g)) {
    const d = flat(t, you);
    if (d > USE_REACH + Math.max(t.w ?? 0, t.d ?? 0) / 2 || g.broken?.has(t.tag) || !offered(g, t)) continue;
    // (and of those, one before you before one behind, then the nearest)
    const it = { kind: t.tag === 'compactor-hatch' ? 'keypad' : 'thing', d, thing: t, front: d < CLOSE || ahead(you, t) >= FRONT };
    if (!near || (Boolean(t.tag) !== Boolean(near.thing.tag) ? Boolean(t.tag) : it.front !== near.front ? it.front : d < near.d)) near = it;
  }
  // someone to talk to before a thing, unless it is a thing with a use of its own and you face it
  // as squarely as them (the superlaser's switch, its operator before it)
  const facing = (q) => (q.d < CLOSE ? 1 : ahead(you, q.npc ?? q.thing));
  if (best && !(near?.thing.tag && facing(near) >= facing(best) - 0.02)) return best;
  for (const j of g.layout.jumps ?? []) {
    if (j.from === you.room && flat(j, you) <= (j.r ?? 1.5) && lockOpen(g, j.lock)) return { kind: 'jump', jump: j };
  }
  return near;
}

// what E says it will do, for the prompt
export function useText(r) {
  if (!r) return null;
  if (r.kind === 'step') return NOUNS[r.tag] ?? (r.npc ? `talk to ${WHO[r.npc.kind] ?? r.npc.kind}` : `use the ${r.tag.replace(/-/g, ' ')}`);
  if (r.kind === 'talk') return `talk to ${WHO[r.npc.tag] ?? CREW_AS[r.npc.kind] ?? 'them'}`;
  if (r.kind === 'jump') return r.jump.prompt ?? 'go';
  if (r.kind === 'keypad') return 'dial the hatch’s keypad';
  if (r.kind === 'stand') return 'stand up';
  if (!r.thing.tag && SEATS[r.thing.kind]) return SEATS[r.thing.kind];
  if (!r.thing.tag) return READS_AS[r.thing.kind] ?? `read the ${r.thing.kind.replace(/-/g, ' ')}`;
  return r.thing.text ? `read “${r.thing.text}”` : (DOES[r.thing.tag] ?? `use the ${r.thing.kind.replace(/-/g, ' ')}`);
}

export function useHere(g) {
  if (g.talk) return chooseHere(g, 0);
  const r = reachable(g);
  if (!r) return false;
  if (r.kind === 'step') {
    // a talk or a choice opens the step's talk, there with whoever it names; a use is told
    if (r.step.type === 'use') {
      tell(g, { type: 'used', tag: r.tag });
      return true;
    }
    const t = openTalk(r.step.need.talk, talkCtx(g));
    if (!t) return false;
    g.talk = { ...t, npc: r.npc?.id ?? null };
    g.events.push({ type: 'say', who: t.who, name: WHO[t.who] ?? t.who, text: t.say });
    return true;
  }
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
    // (and those with you after you: down the chute, across the chasm)
    bringAlong(g);
    return true;
  }
  if (r.kind === 'stand') return standUp(g);
  if (r.kind === 'keypad') {
    g.talk = { id: 'keypad', tag: r.thing.tag, who: 'keypad', say: 'The hatch’s keypad asks for the unit’s number.', choices: KEYPAD, end: false, npc: null };
    return true;
  }
  const tag = r.thing.tag;
  if (!tag && SEATS[r.thing.kind]) return sit(g, r.thing);
  if (!tag) {
    // (a console with nothing else to do reads out what it shows)
    const out = readoutOf(g, r.thing, g.you.room);
    line(g, out.who, out.text);
    return true;
  }
  tell(g, { type: 'used', tag });
  if (READ.has(tag)) g.events.push({ type: 'read', tag });
  // (what is written on it, read out in the subtitles, however long)
  if (r.thing.text) line(g, 'sign', r.thing.text);
  if (tag === 'krennic-chair') {
    g.events.push({ type: 'sat', tag });
    sit(g, r.thing);
  }
  if (tag === 'armrest-saber') does(g, 'pull-saber');
  if (!storyOn(g)) FREE[tag]?.(g);
  return true;
}

// Sat down: held in the seat, facing the way it faces, until E, or a key that walks, aims or fires,
// stands you up in front of it (game.js). The seat's middle is in its solid, so you are put there and
// taken out again, not walked.
function sit(g, t) {
  const you = g.you;
  const out = t.d / 2 + SEAT_OUT;
  // (where you are: put so that the sit clip has you on the seat, not in it: seats.js)
  you.seat = { ...seatedAt(t, you), kind: t.kind, hp: you.hp, out: { x: t.x + Math.sin(t.yaw) * out, z: t.z - Math.cos(t.yaw) * out } };
  g.events.push({ type: 'sit', kind: t.kind });
  return true;
}

export function standUp(g) {
  const s = g.you.seat;
  if (!s) return false;
  g.you.seat = null;
  g.teleport(g.you.room, s.out.x, s.out.z, s.yaw);
  g.events.push({ type: 'stood', kind: s.kind });
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
    // (in free roam, as in the story, she walks with you from her cell)
    if (!storyOn(g) && npc && crew.byId.has(npc)) {
      assign(crew, npc, { type: 'follow', who: 'you' });
      crew.byId.get(npc).tag = 'with:leia';
    }
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
