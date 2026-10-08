// The story engine: a story is a chain of steps the free roam keeps
// running around, each one thing to do (get somewhere, talk, use
// something, hide, walk someone, fight, choose a line, wait, watch a
// scene, become someone else, keep still). The game hands it every event
// as it happens; it answers with the effects the game should carry out
// (people to spawn, doors to lock, lines to say, a scene to play) and how
// far the story has gone. It knows nothing of the station but the names
// the steps use, so a story is plain data in rules/stories/. Pure.
//
// The steps come in beats, one for each numbered beat of a story, and the
// beat is what a checkpoint holds: fail any step (die, be caught where
// you were to stay hidden, run out of time) and the story goes back to
// the start of its beat, with the beat’s people taken away to be spawned
// afresh and the state put back as the beat found it. A saved story picks
// up the same way, so nobody is ever restored halfway through a scene.
//
//   TYPES                                  every kind of step
//   SCENES                                 the scenes a story may play (Task 3.5’s scene/cinematics.js draws them)
//   MOODS                                  the music a story may ask for (scene/sounds.js plays them)
//   chain(begin, beats) → steps            each beat a list of steps; every step gets its beat’s
//     checkpoint, the state `begin` becomes through every effect and arrival before the beat
//   startStory(story, at?) → { progress, effects }   from the start, or from the beat that holds the
//     saved step `at` (an id it doesn’t know starts from the beginning)
//   storyStep(progress, story, event) → { progress, effects }
//   checkpointOf(story, progress) → checkpoint | null   the step’s, a copy; null once the story is over
//   say(who, text) → effect;  spawn(kind, spot, tag, { role = 'post', squad?, hostile? }?, n = 1) → [effect]
//     for writing stories: a line said, and n people alike brought aboard
//
//   story: { id, station, side, hero, title, steps: [step] }
//   step: { id, type, text, target?, time?, need?, checkpoint, start: [effect], end: [effect], fail?: [effect] }
//     text: the objective the HUD shows; target: { spot } | { room } | { npc } | { tag }, where to go or
//     what to act on (a person by the tag they were spawned with, a thing by its tag); time: seconds
//   checkpoint: { step, spot, hero, armour, helmet, companions: [kind], flags: [name], gun }
//     step: the beat’s first step; flags: the ones the story set (the game keeps its own besides)
//   progress: { story, step, t, n, gone: [tag], done }   t: seconds into the step; n: its count so far;
//     gone: everything put out of action so far, by tag
//
// What finishes each type (any step with a `time` but a hide, a timer or
// a still fails when it runs out, and any step fails when you die):
//   reach    an `at` event at its target spot, or anywhere in its target room;
//            need 'unseen': being caught on the way fails it
//   escort   the same, walking `need` (a tag or a kind) with you; that one killed fails it
//   talk     a `talked` event closing the talk `need.talk` (at the line `need.node`, if it names one);
//            no target: it comes to you (a call, the intercom), so the game opens it at once
//   choose   a `chose` event picking `need.choice` in `need.talk`
//   use      `need` (1 if not said) `used` events for its target’s tag
//   fight    `need` (1) of the people tagged as its target put down while the step is on
//   kill     `need` (1) things put out of action, each counted once, by the target’s tag or as
//            numbered things under it (`aa23-camera` counts `aa23-camera-1`, `-2`), whenever it happened
//   hide     `time` seconds pass; being caught fails it
//   still    a `still` event of at least `time` seconds; being caught fails it
//   timer    `time` seconds pass
//   scene    a `sceneDone` event for `need.scene`
//   swap     nothing: its start and end run at once (who you are changes there)
//
// Events: { type: 'at', room, spot } · { type: 'talked', talk, node } (talk.js’s own, naming the
//   talk) · { type: 'used', tag } · { type: 'killed', kind, tag } (put down: a shot, a blow, a stun;
//   a thing shot out) · { type: 'still', seconds } · { type: 'tick', dt } · { type: 'chose', talk, choice }
//   · { type: 'sceneDone', id } · { type: 'caught' } · { type: 'died' }
//
// Effects: { flag } { unflag } { unlock: door } { lock: door } { spawn: { kind, spot, role, squad?,
//   hostile?, tag } } { despawn: tag } { alarm: { section, how } } { say: { who, text } }
//   { intercom: { section, text } } { scene: id } { hero: kind } { give: item } { take: item }
//   { companion: kind, follow } { to: spot } { achievement: id } { music: mood } { walls: 'close' | 'open' }
//   { bridge: bool } { end: true }, and from the engine itself { checkpoint }: put the state back to it.
//   item: 'armour' | 'helmet' | 'gun:<id>' | 'comlink' | 'beacon' | 'saber'

export const TYPES = ['reach', 'talk', 'use', 'hide', 'escort', 'fight', 'kill', 'choose', 'timer', 'scene', 'swap', 'still'];
export const SCENES = ['tractor', 'duel', 'swing', 'escape'];
export const MOODS = ['quiet', 'calm', 'alert'];

// time on these is how long the step lasts; on any other it is a deadline
const LASTS = new Set(['hide', 'timer', 'still']);
const EPS = 1e-9; // thirty steps of 1/30 s add up to a hair under a second

// ── checkpoints ──

const copy = (cp) => ({ ...cp, companions: [...cp.companions], flags: [...cp.flags] });
const plus = (list, x) => (list.includes(x) ? list : [...list, x]);
const minus = (list, x) => list.filter((y) => y !== x);
const either = (on, list, x) => (on ? plus(list, x) : minus(list, x));

// What an effect does to the state a checkpoint keeps; the rest is the world’s.
function fold(state, effect) {
  if ('hero' in effect) state.hero = effect.hero;
  if ('to' in effect) state.spot = effect.to;
  if ('flag' in effect) state.flags = plus(state.flags, effect.flag);
  if ('unflag' in effect) state.flags = minus(state.flags, effect.unflag);
  // the chasm’s bridge is a floor there only while the flag of its name is set (layout.offTags)
  if ('bridge' in effect) state.flags = either(effect.bridge, state.flags, 'bridge');
  if ('companion' in effect) state.companions = either(effect.follow, state.companions, effect.companion);
  const item = effect.give ?? effect.take;
  if (typeof item !== 'string') return;
  const has = 'give' in effect;
  if (item === 'armour' || item === 'helmet') state[item] = has;
  else if (item.startsWith('gun:')) state.gun = has ? item.slice(4) : null;
}

export function chain(begin, beats) {
  const state = copy(begin);
  const steps = [];
  for (const beat of beats) {
    const checkpoint = { step: beat[0].id, ...copy(state) };
    for (const raw of beat) {
      const step = { start: [], end: [], ...raw, checkpoint: copy(checkpoint) };
      steps.push(step);
      step.start.forEach((e) => fold(state, e));
      // you are wherever the step took you
      if ((step.type === 'reach' || step.type === 'escort') && step.target?.spot) state.spot = step.target.spot;
      step.end.forEach((e) => fold(state, e));
    }
  }
  return steps;
}

export function checkpointOf(story, progress) {
  if (!progress || progress.done) return null;
  const step = story.steps.find((s) => s.id === progress.step);
  return step ? copy(step.checkpoint) : null;
}

// ── running ──

const indexOf = (story, id) => story.steps.findIndex((s) => s.id === id);
const goneUnder = (gone, tag) => gone.filter((g) => g === tag || g.startsWith(`${tag}-`)).length;
const needed = (step) => (Number.isFinite(step.need) ? step.need : 1);

// a step that is already over as it begins: a swap, or things to put out of action that already are
const over = (step, p) => step.type === 'swap' || (step.type === 'kill' && goneUnder(p.gone, step.target.tag ?? step.target.npc) >= needed(step));

// Begins step i, pushing its start; a step over as it begins runs its end
// at once and the next begins, until one waits or the story is over.
function enter(story, i, effects, p) {
  for (let k = i; k < story.steps.length; k++) {
    const step = story.steps[k];
    const now = { ...p, step: step.id, t: 0, n: 0 };
    effects.push(...step.start);
    if (!over(step, now)) return { progress: now, effects };
    effects.push(...step.end);
    p = now;
  }
  return { progress: { ...p, done: true }, effects };
}

function finish(story, i, p, effects = []) {
  effects.push(...story.steps[i].end);
  return i + 1 < story.steps.length ? enter(story, i + 1, effects, p) : { progress: { ...p, done: true }, effects };
}

// Back to the start of the beat: the people the beat has spawned so far
// go (they come again with its steps, fresh), and so does any record of
// putting them down; what was shot out of the world stays shot.
function fail(story, i, p) {
  const step = story.steps[i];
  const k = indexOf(story, step.checkpoint.step);
  const tags = [];
  for (let j = k; j <= i; j++) {
    const ran = j < i ? [...story.steps[j].start, ...story.steps[j].end] : story.steps[j].start;
    for (const e of ran) if (e.spawn && !tags.includes(e.spawn.tag)) tags.push(e.spawn.tag);
  }
  const effects = [...(step.fail ?? []), ...tags.map((despawn) => ({ despawn })), { checkpoint: copy(step.checkpoint) }];
  return enter(story, k, effects, { ...p, gone: p.gone.filter((g) => !tags.includes(g)) });
}

function fails(step, p, e) {
  if (e.type === 'died') return true;
  if (e.type === 'caught') return step.type === 'hide' || step.type === 'still' || step.need === 'unseen';
  if (e.type === 'killed') return step.type === 'escort' && step.need != null && (e.tag === step.need || e.kind === step.need);
  if (e.type === 'tick') return Number.isFinite(step.time) && !LASTS.has(step.type) && p.t + e.dt >= step.time - EPS;
  return false;
}

const there = (target, e) => (target.spot ? e.spot === target.spot : e.room === target.room);

// The progress after an event that doesn’t fail the step, and whether the step is done.
function advance(step, p, e) {
  const { type, target, need } = step;
  if (e.type === 'tick') {
    const t = p.t + e.dt;
    return { p: { ...p, t }, done: (type === 'hide' || type === 'timer') && t >= step.time - EPS };
  }
  if (type === 'use' || type === 'fight') {
    const hit = (type === 'use' ? e.type === 'used' : e.type === 'killed') && e.tag === target.tag;
    if (!hit) return { p, done: false };
    const n = p.n + 1;
    return { p: { ...p, n }, done: n >= needed(step) };
  }
  const done =
    (type === 'reach' || type === 'escort' ? e.type === 'at' && there(target, e) : false) ||
    (type === 'talk' && e.type === 'talked' && e.talk === need.talk && (!need.node || e.node === need.node)) ||
    (type === 'choose' && e.type === 'chose' && e.talk === need.talk && e.choice === need.choice) ||
    (type === 'kill' && over(step, p)) ||
    (type === 'scene' && e.type === 'sceneDone' && e.id === need.scene) ||
    (type === 'still' && e.type === 'still' && e.seconds >= step.time - EPS);
  return { p, done };
}

// ── writing one ──

export const say = (who, text) => ({ say: { who, text } });

// n people alike, each an effect of its own so nothing downstream shares one
export const spawn = (kind, spot, tag, { role = 'post', ...more } = {}, n = 1) => Array.from({ length: n }, () => ({ spawn: { kind, spot, role, ...more, tag } }));

export function startStory(story, at) {
  const k = indexOf(story, at);
  const first = k < 0 ? 0 : indexOf(story, story.steps[k].checkpoint.step);
  const p = { story: story.id, step: story.steps[first].id, t: 0, n: 0, gone: [], done: false };
  return enter(story, first, [{ checkpoint: copy(story.steps[first].checkpoint) }], p);
}

export function storyStep(progress, story, event) {
  if (!progress || progress.done || !event) return { progress, effects: [] };
  const i = indexOf(story, progress.step);
  if (i < 0) return { progress, effects: [] };
  const step = story.steps[i];
  let p = progress;
  // whatever is put out of action is remembered, for a kill step now or to come
  if (event.type === 'killed' && event.tag && !p.gone.includes(event.tag)) p = { ...p, gone: [...p.gone, event.tag] };
  if (fails(step, p, event)) return fail(story, i, p);
  const { p: next, done } = advance(step, p, event);
  return done ? finish(story, i, next) : { progress: next, effects: [] };
}
