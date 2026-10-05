// The places on the map that open a chapter of the page, in the road's
// order. `at` is on the 800×560 sheet (./mapData.js), `stop` the stop on the
// road (./road.js) Frodo walks to, `lift` how high over the sheet its pin
// floats in 3D (over its landmark); `seals` are the achievements that
// chapter can earn, shown as wax seals on the map once won.
import { STOPS } from './road';

export const CHAPTERS = [
  {
    id: 'shire',
    stop: 'hobbiton',
    lift: 2.4,
    name: 'The Shire',
    title: 'Hobbiton, on the day of the party',
    blurb: 'Walk about the Shire: Maggot’s mushrooms, smoke rings with Gandalf, the fireworks, and the Ring.',
    at: [186, 196],
    theme: 'shire',
    seals: ['mushrooms', 'smokerings', 'fireworks', 'secretsafe', 'getoffroad'],
  },
  {
    id: 'bree',
    stop: 'bree',
    lift: 2.4,
    name: 'Bree',
    title: 'The Prancing Pony, on a wet night',
    blurb: 'In at the West Gate in the rain: Butterbur, pints for Pippin, a Ranger called Strider, and the Nazgûl in the lanes at night. Then the Pony’s kitchen, co-op with friends online.',
    at: [262, 200],
    theme: 'shire',
    seals: ['breegate', 'underhill', 'pints', 'strider', 'slipaway'],
  },
  {
    id: 'weathertop',
    stop: 'weathertop',
    lift: 2.8,
    name: 'Weathertop',
    title: 'Amon Sûl, by night',
    blurb: 'The ruined watchtower on its hill: Sam’s supper, five Nazgûl on the summit, kingsfoil by lantern, and the ride with Arwen to the Ford.',
    at: [312, 192],
    theme: 'shire',
    seals: ['amonsul', 'putitout', 'weathertop', 'kingsfoil', 'bruinen'],
  },
  {
    id: 'rivendell',
    stop: 'rivendell',
    lift: 2.8,
    name: 'Rivendell',
    title: 'From the films',
    blurb: 'Elrond’s house keeps the old tales. A few of them, as the films told them.',
    at: [388, 176],
    theme: 'shire',
    seals: [],
  },
  {
    id: 'moria',
    stop: 'moria',
    lift: 3.8,
    name: 'Moria',
    title: 'The Doors of Durin and the Bridge',
    blurb: 'Speak, friend, and enter. Something is waiting at the bridge of Khazad-dûm.',
    at: [380, 262],
    theme: 'shire',
    seals: ['mellon', 'balrog'],
  },
  {
    id: 'lorien',
    stop: 'lorien',
    lift: 3.8,
    name: 'Lothlórien',
    title: 'The Mirror of Galadriel',
    blurb: 'It shows things that were, and things that are: the places it was filmed.',
    at: [440, 286],
    theme: 'shire',
    seals: [],
  },
  {
    id: 'mordor',
    stop: 'mount-doom',
    lift: 4.2,
    name: 'Mordor',
    title: 'Gorgoroth and Mount Doom',
    blurb: 'Across the plain under the Eye, to the fire the Ring was made in.',
    at: [660, 420],
    theme: 'mordor',
    seals: ['gorgoroth', 'ringbearer'],
  },
];

export const chapter = (id) => CHAPTERS.find((c) => c.id === id) || null;

// the next and the one before, along the road
export function neighbours(id) {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return { prev: i > 0 ? CHAPTERS[i - 1] : null, next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : null };
}

// where on the road a place is, as the index of its stop
export const stopOf = (id) => Math.max(0, STOPS.findIndex((s) => s.id === chapter(id)?.stop));
