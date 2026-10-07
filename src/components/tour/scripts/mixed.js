import { RECRUITER } from './recruiter';
import { PLAYER } from './player';

// The mixed tour: the recruiter's spine (home, a role, projects, the résumé,
// contact) and then a taste of the player's side, the stops of the player's
// tour tagged 'taste', in the player's order; the recruiter's look at the
// universe folds into the player's universe leg. About three minutes. Built
// from the other two, so a change to either carries here.

const taste = (leg) => ({ ...leg, stops: leg.stops.filter((s) => s.tags?.includes('taste')) });
const spine = RECRUITER.legs.filter((l) => l.id !== 'universe');
const look = RECRUITER.legs.find((l) => l.id === 'universe').stops;
const play = PLAYER.legs.map(taste)
  .filter((l) => l.stops.length)
  .map((l) => ({ ...l, id: `play-${l.id}`, stops: (l.id === 'universe' ? [...l.stops, ...look] : l.stops).map((s) => ({ ...s, id: `play-${s.id}` })) }));

export const MIXED = {
  id: 'mixed',
  title: 'Both',
  minutes: 3,
  achievement: 'tour-mixed',
  legs: [
    ...spine.map((l, n) => (n ? l : { ...l, stops: [{ ...l.stops[0], title: 'Both sides', text: 'I’m Tilak Patel: a technical program manager intern at AWS, studying computer science at Northeastern. The work first, then a taste of the worlds and games the site is built as. About three minutes. Next or → goes on; Esc ends it.' }, ...l.stops.slice(1)] })),
    ...play,
  ],
  end: {
    id: 'done',
    title: 'That’s both',
    text: ({ key }) => `Thanks for your time. The full tours, the recruiter’s and the player’s, are a ${key} away, or in the guide’s “The site” tab.`,
  },
};
