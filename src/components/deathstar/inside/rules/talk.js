// Conversations aboard: who will talk to you, and where a talk goes as you
// pick your lines. A talk is a small tree of lines, each said by someone,
// that either runs on to the next line, offers you choices (some only
// under conditions: a flag the story set, your helmet on, who you are) or
// ends. Picking a line may set flags and ask the game to do something (a
// panel shot, a Wookiee breaking loose, Vader’s choke); the tree only
// names it, so the game, the stories and the eggs each act on what
// concerns them. The trees themselves are data in rules/talks/. Pure.
//
//   TALKS: { [id]: { station?, when?, start, nodes: { [id]: node } } }
//     start: a node id, or routes [{ to, when? }] tried in order (the last with no `when`)
//     node: { who, say, next? | choices?: [{ say, to, when?, set? }] | end: true, set?, does? }
//     set: a flag name or a list of them; does: a name the game acts on
//     when: { flag?, not?, helmet?, disguise?, side?, hero?, station?, story?, tk?, passes? }, all must hold
//       passes: whether you pass for one of the garrison (Imperial, or in armour with the helmet on)
//   WHO: { [who]: name } every speaker, as the subtitles name them
//   talkFor(person, ctx) → id | null       the talk this person has for you now
//     person: { kind, mode, tag?, talk? }; ctx: { station, side, disguise, helmet, flags: Set, story, hero, tk }
//   openTalk(id, ctx) → talk | null        talk: { id, node, who, say, choices: [say], end }
//     no choices and not the end: any pick runs on to the next line
//   choose(talk, i, ctx) → { talk, effects }   i: an index into talk.choices; a pick at the end closes it (talk null)
//     effects: { event: { type: 'chose', talk, node, choice } }   node and choice are the line picked’s target
//              { flag: name }  { does: name }  { event: { type: 'talked', talk, node } } on closing
//   validateTalk(tree) → [error]           empty when the tree is sound

import { CREW_TALKS } from './talks/crew';
import { DS1_TALKS } from './talks/ds1';
import { DS2_TALKS } from './talks/ds2';

export const TALKS = Object.freeze({ ...DS1_TALKS, ...DS2_TALKS, ...CREW_TALKS });

export const WHO = Object.freeze({
  you: 'You',
  gantry: 'Gantry officer',
  officer: 'Officer',
  intercom: 'Voice on the intercom',
  han: 'Han',
  leia: 'Leia',
  threepio: 'C-3PO',
  technician: 'Technician',
  trooper: 'Stormtrooper',
  tarkin: 'Governor Tarkin',
  vader: 'Darth Vader',
  motti: 'Admiral Motti',
  librarian: 'Archivist',
  jerjerrod: 'Commander Jerjerrod',
  emperor: 'The Emperor',
  shuttle: 'ST 321',
  controller: 'Shuttle controller',
  // Vader with his mask off, at the end
  anakin: 'Anakin Skywalker',
  gunner: 'Gunner',
  dstrooper: 'Death Star trooper',
  tiepilot: 'TIE pilot',
  royalguard: 'Royal Guard',
  gonk: 'Power droid',
  mouse: 'Mouse droid',
  // what a console or a terminal says when it is worked
  console: 'Console',
  sign: 'Written there',
});

// The garrison talks to you only off duty: a person fighting, searching,
// fleeing, down or dead has nothing to say.
const BUSY = new Set(['fight', 'flee', 'down', 'dead', 'search']);

// The talks a person has by kind alone, tried in order, when the story
// gave them none of their own. A trooper meets Ben with the mind trick,
// anyone else who passes with small talk; so do the rest of the crew
// (talks/crew.js), and the droids talk to anyone. Leia in her cell is
// rescued in free roam as in the story.
const BY_KIND = Object.freeze({
  stormtrooper: ['droids-trick', 'trooper-bark'],
  technician: ['technician'],
  librarian: ['librarian'],
  officer: ['officer-bark'],
  gunner: ['gunner-bark'],
  dstrooper: ['dstrooper-bark'],
  tiepilot: ['pilot-bark'],
  royalguard: ['royalguard-silent'],
  gonk: ['gonk-gonk'],
  mouse: ['mouse-squeal'],
  leia: ['leia-2187'],
});

const passes = (ctx) => ctx.side === 'imperial' || Boolean(ctx.disguise && ctx.helmet);

// Each condition a `when` may name, and how it reads the ctx; anything
// else is a mistake the validator reports, never silently true.
const TESTS = {
  flag: (v, ctx) => Boolean(ctx.flags?.has(v)),
  not: (v, ctx) => !ctx.flags?.has(v),
  helmet: (v, ctx) => Boolean(ctx.helmet) === v,
  disguise: (v, ctx) => Boolean(ctx.disguise) === v,
  side: (v, ctx) => ctx.side === v,
  hero: (v, ctx) => ctx.hero === v,
  station: (v, ctx) => ctx.station === v,
  story: (v, ctx) => ctx.story === v,
  tk: (v, ctx) => ctx.tk === v,
  passes: (v, ctx) => passes(ctx) === v,
};

const holds = (when, ctx) => !when || Object.entries(when).every(([k, v]) => TESTS[k]?.(v, ctx) ?? false);
const fits = (tree, ctx) => Boolean(tree) && (!tree.station || tree.station === ctx.station) && holds(tree.when, ctx);
const routes = (tree) => (Array.isArray(tree.start) ? tree.start : [{ to: tree.start }]);
const flagsOf = (set) => (set == null ? [] : [].concat(set));

export function talkFor(person, ctx) {
  if (!person || BUSY.has(person.mode)) return null;
  const own = person.talk ?? (person.tag && TALKS[person.tag] ? person.tag : null);
  if (own) return fits(TALKS[own], ctx) ? own : null;
  return (BY_KIND[person.kind] ?? []).find((id) => fits(TALKS[id], ctx)) ?? null;
}

function view(id, key, ctx) {
  const node = TALKS[id].nodes[key];
  const choices = (node.choices ?? []).filter((c) => holds(c.when, ctx)).map((c) => c.say);
  return { id, node: key, who: node.who, say: node.say, choices, end: Boolean(node.end) };
}

export function openTalk(id, ctx) {
  const tree = TALKS[id];
  if (!tree) return null;
  const route = routes(tree).find((r) => holds(r.when, ctx));
  return route ? view(id, route.to, ctx) : null;
}

export function choose(talk, i, ctx) {
  if (!talk) return { talk: null, effects: [] };
  const { id } = talk;
  const node = TALKS[id].nodes[talk.node];
  if (node.end) return { talk: null, effects: [{ event: { type: 'talked', talk: id, node: talk.node } }] };

  const effects = [];
  let to = node.next;
  if (!to) {
    const picked = node.choices.filter((c) => holds(c.when, ctx))[i];
    if (!picked) return { talk, effects };
    to = picked.to;
    // `choice` repeats the target under the name the stories listen for; the eggs read `node`
    effects.push({ event: { type: 'chose', talk: id, node: to, choice: to } });
    for (const flag of flagsOf(picked.set)) effects.push({ flag });
  }
  const next = TALKS[id].nodes[to];
  for (const flag of flagsOf(next.set)) effects.push({ flag });
  if (next.does) effects.push({ does: next.does });
  return { talk: view(id, to, ctx), effects };
}

// Copy on screen keeps the house style: curly quotes and a real ellipsis.
function copyErrors(text, where) {
  if (typeof text !== 'string' || !/\S/.test(text)) return [`${where}: says nothing`];
  const errors = [];
  if (/['"]/.test(text)) errors.push(`${where}: straight quotes in “${text}”`);
  if (/\.\.\./.test(text)) errors.push(`${where}: three dots for an ellipsis in “${text}”`);
  if (/!{2,}/.test(text)) errors.push(`${where}: an exclamation run in “${text}”`);
  return errors;
}

function whenErrors(when, where) {
  if (when == null) return [];
  if (typeof when !== 'object') return [`${where}: a when that is not an object`];
  return Object.keys(when)
    .filter((k) => !TESTS[k])
    .map((k) => `${where}: no such condition as ${k}`);
}

function setErrors(set, where) {
  return flagsOf(set).every((f) => typeof f === 'string' && f) ? [] : [`${where}: a flag that is not a name`];
}

export function validateTalk(tree) {
  if (!tree || typeof tree.nodes !== 'object' || !Object.keys(tree.nodes).length) return ['a talk with no lines'];
  const { nodes } = tree;
  const errors = [];
  const say = (e) => errors.push(e);
  const exists = (to, where) => (nodes[to] ? true : (say(`${where}: goes to ${to}, which is not a line here`), false));

  if (tree.station && !['ds1', 'ds2'].includes(tree.station)) say(`no such station as ${tree.station}`);
  errors.push(...whenErrors(tree.when, 'the talk'));
  const starts = routes(tree);
  starts.forEach((r, k) => {
    errors.push(...whenErrors(r.when, `start ${k}`));
    if (!exists(r.to, `start ${k}`)) return;
    if (nodes[r.to].set || nodes[r.to].does) say(`start ${r.to}: sets or does something, but opening a talk has no effects`);
  });
  if (starts.at(-1)?.when) say('start: every route is conditional, so the talk may not open');

  // the lines each line can lead to, for the reach and the way out below
  const links = {};
  for (const [key, node] of Object.entries(nodes)) {
    const where = `line ${key}`;
    links[key] = [];
    if (!WHO[node.who]) say(`${where}: no such speaker as ${node.who}`);
    errors.push(...copyErrors(node.say, where), ...setErrors(node.set, where));
    if (node.does != null && (typeof node.does !== 'string' || !node.does)) say(`${where}: does something unnamed`);
    const kinds = [node.next != null, node.choices != null, node.end === true].filter(Boolean).length;
    if (kinds !== 1) say(`${where}: must run on, offer choices or end, and only one of them`);
    if (node.next != null && exists(node.next, where)) links[key].push(node.next);
    if (node.choices != null) {
      if (!Array.isArray(node.choices) || !node.choices.length) {
        say(`${where}: offers no choices`);
        continue;
      }
      if (node.choices.every((c) => c.when)) say(`${where}: every choice is conditional, so the talk could stick`);
      node.choices.forEach((c, k) => {
        const at = `${where} choice ${k}`;
        errors.push(...copyErrors(c.say, at), ...whenErrors(c.when, at), ...setErrors(c.set, at));
        if (exists(c.to, at)) links[key].push(c.to);
      });
    }
  }

  const reached = new Set();
  const walk = (key) => {
    if (reached.has(key) || !nodes[key]) return;
    reached.add(key);
    links[key].forEach(walk);
  };
  starts.forEach((r) => walk(r.to));
  for (const key of Object.keys(nodes)) if (!reached.has(key)) say(`line ${key}: nothing can reach it`);

  // grow the set of lines that can come to an end, backwards from the ends
  const ending = new Set(Object.keys(nodes).filter((k) => nodes[k].end === true));
  for (let grew = true; grew; ) {
    grew = false;
    for (const key of Object.keys(nodes)) {
      if (!ending.has(key) && links[key].some((to) => ending.has(to))) {
        ending.add(key);
        grew = true;
      }
    }
  }
  for (const key of reached) if (!ending.has(key)) say(`line ${key}: never ends`);
  return errors;
}
