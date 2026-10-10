// What the Citadel's people say as you come by (the concourse's in
// ./layout.js, Mortytown's in ./mortytown.js), and in whose voice: every Rick
// in Rick's, every Morty in Morty's, the janitor in a Meeseeks' (he is one).
// CitadelWorld.jsx says each bubble in it (voiceFor); scripts/voices makes them.

import { spoken } from '../../../lib/voiced';
import { CAST } from './layout';
import { CAST as TOWN_CAST, WALKS } from './mortytown';

// the voice each kind of figure talks in
export const VOICE = {
  rick: 'rick',
  cop: 'rick',
  cowboyrick: 'rick',
  factoryrick: 'rick',
  rickd3: 'rick',
  simplerick: 'rick',
  evilrick: 'rick',
  copmorty: 'morty',
  evilmorty: 'morty',
  bigmorty: 'morty',
  slickmorty: 'morty',
  campaignmorty: 'morty',
  meeseeks: 'meeseeks',
};

// Who says a person's line aloud, or null when none of it is said (only a
// bracketed aside, like Evil Rick's stare).
export const voiceFor = (person, line) => (typeof line === 'string' && spoken(line) && VOICE[person?.kind]) || null;

const said = (person, lines) => lines.map((text) => ({ who: voiceFor(person, text), text }));
export const VOICELINES = [...CAST.flatMap((c) => said(c, [...c.lines, ...(c.vote ? [c.vote] : [])])), ...[...TOWN_CAST, ...WALKS].flatMap((c) => said(c, c.lines))].filter((l) => l.who);
