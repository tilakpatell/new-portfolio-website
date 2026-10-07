// Each side's crest on the holotable (Emblem.jsx draws them): on its fleets,
// in the war's strength strip and in the key. Simple geometric marks, one
// shape apiece so they're told apart at a glance and small, drawn in the
// side's colour (currentColor): stand-ins of our own, not the films'
// insignia. A crest is SVG paths in EMBLEM_BOX, each filled, `evenodd` where
// a path cuts a hole in itself. Tested: one for every side in sides.js.

export const EMBLEM_BOX = '0 0 24 24';

export const EMBLEMS = {
  // the Republic: a compass star in a ring
  republic: [
    { d: 'M1 12a11 11 0 1 0 22 0a11 11 0 1 0 -22 0Z M3.4 12a8.6 8.6 0 1 1 17.2 0a8.6 8.6 0 1 1 -17.2 0Z', evenodd: true },
    { d: 'M12 4.6L13.9 10.1L19.4 12L13.9 13.9L12 19.4L10.1 13.9L4.6 12L10.1 10.1Z' },
  ],
  // the Separatists: a hexagon, a droid's eye in it
  separatists: [
    { d: 'M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5Z M12 3.7L19.2 7.85V16.15L12 20.3L4.8 16.15V7.85Z', evenodd: true },
    { d: 'M8.4 12a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0Z' },
  ],
  // the Rebellion: a dart, climbing
  rebel: [{ d: 'M12 1.5L21.5 21.5L12 16.2L2.5 21.5Z' }],
  // the Empire: a diamond in a diamond
  empire: [
    { d: 'M12 1L23 12L12 23L1 12Z M12 4.3L19.7 12L12 19.7L4.3 12Z', evenodd: true },
    { d: 'M12 8L16 12L12 16L8 12Z' },
  ],
  // the New Republic: a dawn over the horizon
  newrepublic: [{ d: 'M3 15.5a9 9 0 0 1 18 0Z' }, { d: 'M1.5 17.8H22.5V20.4H1.5Z' }],
  // the Remnant: a shield, barred
  remnant: [
    { d: 'M3.5 2.5H20.5V12C20.5 17 16.8 20.6 12 22.5C7.2 20.6 3.5 17 3.5 12Z M6 5H18V12C18 15.6 15.5 18.3 12 19.8C8.5 18.3 6 15.6 6 12Z', evenodd: true },
    { d: 'M8.5 9.8H15.5V12.4H8.5Z' },
  ],
  // the Hutts: a cut gem
  hutt: [{ d: 'M6 3.5H18L22.5 9L12 21.5L1.5 9Z M7.6 10.6H16.4L12 16.8Z', evenodd: true }],
};
