// What Aboard the Death Star keeps on this device, as `tp-deathstar-inside`
// (version 1, through the runtime’s saves): the settings, and for each
// station how far each side’s story has gone, the rooms seen (the map
// fills in from them) and the Easter eggs found. Whatever is read is
// cleaned into exactly this shape, keeping only what still makes sense,
// so an old, partial or tampered save never reaches the game as it was.
// Pure.
//
//   SAVE, SAVE_VERSION
//   blank() → { settings: { view: 'third' | 'first', sound, subtitles, guide, tips },
//               ds1: { story: { rebel: step, imperial: step }, seen: [roomId], eggs: [eggId] }, ds2: { … } }
//     step: the id of the story step to pick up at, or null when that story isn’t under way
//   clean(old) → blank()’s shape, with whatever of `old` fits it (old may be anything, wrapped
//     as the runtime stores it, { v, data }, or not)

export const SAVE = 'tp-deathstar-inside';
export const SAVE_VERSION = 1;

// both stations have a place in the save, built or not, so a save outlives the second one arriving
const STATIONS = ['ds1', 'ds2'];
const SIDES = ['rebel', 'imperial'];
const VIEWS = ['third', 'first'];
// a room, step or egg id as the station files write them; anything else isn’t one
const NAME = /^[\w-]{1,40}$/;
// more than any station has rooms: a list longer than this is not a list of rooms
const MOST = 400;

const station = () => ({ story: { rebel: null, imperial: null }, seen: [], eggs: [] });

export const blank = () => ({ settings: { view: 'third', sound: true, subtitles: true, guide: true, tips: true }, ds1: station(), ds2: station() });

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isName = (v) => typeof v === 'string' && NAME.test(v);
const names = (list) => (Array.isArray(list) ? [...new Set(list.filter(isName))].slice(0, MOST) : []);

export function clean(old) {
  const s = blank();
  const data = isObject(old) && 'v' in old && 'data' in old ? old.data : old;
  if (!isObject(data)) return s;
  const settings = isObject(data.settings) ? data.settings : {};
  if (VIEWS.includes(settings.view)) s.settings.view = settings.view;
  if (typeof settings.sound === 'boolean') s.settings.sound = settings.sound;
  if (typeof settings.subtitles === 'boolean') s.settings.subtitles = settings.subtitles;
  if (typeof settings.guide === 'boolean') s.settings.guide = settings.guide;
  if (typeof settings.tips === 'boolean') s.settings.tips = settings.tips;
  for (const id of STATIONS) {
    const was = data[id];
    if (!isObject(was)) continue;
    const story = isObject(was.story) ? was.story : {};
    for (const side of SIDES) if (isName(story[side])) s[id].story[side] = story[side];
    s[id].seen = names(was.seen);
    s[id].eggs = names(was.eggs);
  }
  return s;
}
