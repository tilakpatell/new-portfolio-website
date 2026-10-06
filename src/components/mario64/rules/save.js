// The save: the stars got in each course, the look and the sound, kept as
// `tp-m64` (version 1) through the runtime's saves, or any store with
// getItem and setItem. Storage that throws (a private window) never stops
// the game: it plays on with what it has in memory.

export const SAVE = 'tp-m64';
export const SAVE_VERSION = 1;

export const blank = () => ({ stars: {}, look: 'modern', sound: true });

export const starTotal = (save) => Object.values(save?.stars ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(Boolean).length : 0), 0);

export const hasStar = (save, course, index) => Boolean(save?.stars?.[course]?.[index]);
