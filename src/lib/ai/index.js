// The AI toolkit the worlds' NPCs share: weighing options, scripting a
// meeting, perceiving and remembering, searching, steering, picking a
// place, reading the battlefield, and acting as a squad. Every module is
// pure (plain numbers, a seeded rand the caller gives), tested in Node, and
// usable alone; the design is docs/superpowers/specs/2026-10-07-npc-intelligence-design.md
// and the research behind it docs/research/2026-10-07-game-ai-npcs.md.
export * as vec from './vec';
export * as utility from './utility';
export * as tree from './tree';
export * as perception from './perception';
export * as search from './search';
export * as steer from './steer';
export * as spatial from './spatial';
export * as influence from './influence';
export * as squad from './squad';
