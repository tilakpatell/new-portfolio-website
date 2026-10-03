// The site's other languages. Language mode writes every word on the page in
// the active theme's own script: Aurebesh for Star Wars (and the house themes),
// the Aligned Cybertronian alphabet for the Transformers, and runes for
// Middle-earth, the way Tolkien wrote the Dwarves' in The Hobbit. The text stays
// real text, so screen readers, search and copy still get English.

export const SCRIPTS = {
  aurebesh: { name: 'Aurebesh', back: 'Back to Basic', font: "'Basic Script'" },
  cybertronian: { name: 'Cybertronian', back: 'Back to English', font: "'Cybertron Script'" },
  runes: { name: 'Dwarf runes', back: 'Back to the Common Speech', font: "'Durin Runes'" },
};

const BY_THEME = {
  optimus: 'cybertronian',
  megatron: 'cybertronian',
  bumblebee: 'cybertronian',
  shockwave: 'cybertronian',
  soundwave: 'cybertronian',
  shire: 'runes',
  mordor: 'runes',
};

export const scriptFor = (theme) => BY_THEME[theme] ?? 'aurebesh';
