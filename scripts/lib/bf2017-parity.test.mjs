import { describe, expect, it } from 'vitest';
import { checkLedger, ledgerMarkdown, ledgerRows, modeOfLayer, statusBlock, totalsOf } from './bf2017-parity.mjs';

// a level with a Galactic Assault layer, an arena and nothing for Blast
const MAP = {
  spawns: [
    { id: 'FantasyBattle_Logic:1', layer: 'FantasyBattle_Logic', mode: 'galacticAssault' },
    { id: 'FantasyBattle_Logic:2', layer: 'FantasyBattle_Logic', mode: 'galacticAssault' },
    { id: 'HeroArena_Logic:1', layer: 'HeroArena_Logic', mode: 'hvv' },
    // lane F tagged Mode9 as strike; the layer says Co-op
    { id: 'Mode9_Spawns_Team1:1', layer: 'Mode9_Spawns_Team1', mode: 'strike' },
  ],
  polygons: [{ id: 'FantasyBattle_Shapes:1', layer: 'FantasyBattle_Shapes', mode: 'galacticAssault' }],
  volumes: [{ id: 'FantasyBattle_Shapes:2', layer: 'FantasyBattle_Shapes', mode: 'galacticAssault' }],
  spheres: [{ id: 'FantasyBattle_Shapes:3', layer: 'FantasyBattle_Shapes', mode: 'galacticAssault' }],
  boxes: [],
  prefabs: [{ id: 'FantasyBattle_Gameplay:1', layer: 'FantasyBattle_Gameplay', mode: 'galacticAssault', name: 'PF_GameMode_Conquest_Staged' }],
};
const TEAM = {
  light: { classes: ['a', 'b'], heroes: ['luke'], reinforcements: ['wookiee'], vehicles: ['xwing'] },
  dark: { classes: ['c', 'd'], heroes: ['vader'], reinforcements: ['death'], vehicles: ['tie'] },
};
const INPUT = {
  levels: [{ key: 'hoth_01', world: 'hoth', modes: ['galacticAssault', 'hvv', 'blast', 'coop'] }],
  maps: { hoth_01: MAP },
  hands: ['hoth_01.galacticAssault'],
  modes: ['galacticAssault'],
  built: { hoth_01: ['galacticAssault'] },
  hud: { drawn: ['SpawnOverlayScreen', 'PlayerHealth'] },
  widgets: { galacticAssault: ['SpawnOverlayScreen', 'PlayerHealth', 'RadarWidget', 'KillLogScreen'], hvv: ['PlayerHealth'] },
  teams: { hoth_01: TEAM },
  offered: ['class', 'hero', 'reinforcement'],
  points: { source: 'hand' },
  packs: { hoth_01: { kind: 'roam', published: true, pieces: 5815 } },
  pieces: { hoth_01: 24532 },
  evidence: ['hoth_01/galacticAssault'],
};

describe('modeOfLayer', () => {
  it('reads the layer by the spec’s MODE_LAYERS, not lane F’s tag', () => {
    expect(modeOfLayer('FantasyBattle_Logic')).toBe('galacticAssault');
    expect(modeOfLayer('Mode9_Spawns_Team1')).toBe('coop');
    expect(modeOfLayer('ModeDefend_Spawns_Team2')).toBe('coop');
    expect(modeOfLayer('PlanetaryMissions_Logic')).toBe('strike');
    expect(modeOfLayer('TeamDeathmatch_Skirmish_Gameplay')).toBe('arcade');
    expect(modeOfLayer('TeamDeathmatch_Online_Logic')).toBe('blast');
    expect(modeOfLayer('HeroArena_Shapes')).toBe('hvv');
    expect(modeOfLayer('Mode6_Logic')).toBe('showdown');
    expect(modeOfLayer('Mode1_Logic')).toBe('supremacy');
    expect(modeOfLayer('Mode5')).toBe('extraction');
    expect(modeOfLayer('Mode3')).toBe('ewokHunt');
    expect(modeOfLayer('ModeC_Logic')).toBe('jetpackCargo');
    expect(modeOfLayer('Somewhere_Else', 'hvv')).toBe('hvv');
  });
});

describe('ledgerRows', () => {
  const rows = ledgerRows(INPUT);
  const at = (mode) => rows.find((r) => r.mode === mode);

  it('gives one row per level × mode', () => {
    expect(rows.map((r) => `${r.level}/${r.mode}`)).toEqual(['hoth_01/galacticAssault', 'hoth_01/hvv', 'hoth_01/blast', 'hoth_01/coop']);
  });

  it('scores Galactic Assault column by column', () => {
    const r = at('galacticAssault');
    expect(r.pack).toEqual({ kind: 'roam', published: true, pieces: 5815, of: 24532 });
    expect(r.layer).toEqual({ spawns: 2, areas: 1, volumes: 2, prefabs: 1 });
    expect(r.rules).toBe('hand');
    expect(r.sim).toBe('done');
    expect(r.hud).toEqual({ drawn: 2, of: 4 });
    expect(r.kits).toEqual({ offered: 8, of: 10 });
    expect(r.prices).toBe('hand');
    expect(r.check).toBe('green');
    // pack 0 (a roam cut), layer 1, rules 0.5, sim 1, hud 0.5, kits 0.8, prices 0.5, check 1
    expect(r.score).toBe(5.3);
  });

  it('marks what is missing', () => {
    const b = at('blast');
    expect(b.layer).toBe('none');
    expect(b.rules).toBe('missing');
    expect(b.sim).toBe('missing');
    expect(b.kits).toEqual({ offered: 0, of: 4 });
    expect(b.check).toBe('none');
    expect(at('coop').layer).toEqual({ spawns: 1, areas: 0, volumes: 0, prefabs: 0 });
    // a HUD is drawn only for a mode that runs: HvV's PlayerHealth part exists, its sim does not
    expect(at('hvv').hud).toEqual({ drawn: 0, of: 1 });
    // a mode with no widget list in the table draws 0 of 0 and scores nothing for it
    expect(b.hud).toEqual({ drawn: 0, of: 0 });
  });

  it('counts a mode’s kit kinds only (HvV: heroes)', () => {
    expect(at('hvv').kits).toEqual({ offered: 0, of: 2 });
  });

  it('calls a whole published pack the game’s and prices with every source read the game’s', () => {
    const [r] = ledgerRows({ ...INPUT, levels: [{ key: 'hoth_01', world: 'hoth', modes: ['galacticAssault'] }], packs: { hoth_01: { kind: 'whole', published: true, pieces: 24532 } }, points: { source: 'game' } });
    expect(r.prices).toBe('game');
    expect(r.score).toBe(6.8);
  });

  it('a level with no map, pack or team is all none', () => {
    const [r] = ledgerRows({ ...INPUT, levels: [{ key: 'naboo_01', world: 'naboo', modes: ['blast'] }] });
    expect(r.pack).toEqual({ kind: 'none', published: false, pieces: 0, of: 0 });
    expect(r.layer).toBe('none');
    expect(r.kits).toEqual({ offered: 0, of: 0 });
  });
});

describe('totals, the markdown and the check', () => {
  const rows = ledgerRows(INPUT);
  const totals = totalsOf(rows);

  it('sums the columns', () => {
    expect(totals).toMatchObject({ rows: 4, levels: 1, score: 8.8, max: 32, simDone: 1, layerFound: 3, rules: { game: 0, hand: 1, missing: 3 }, packWhole: 0, checkGreen: 1 });
  });

  it('writes a table by level, the totals and the hand files', () => {
    const md = ledgerMarkdown(rows, { notes: '## `maps/hoth.stages.json`\n\n- a\n- b\n\n## Read, not by hand\n' });
    expect(md).toMatch(/## hoth_01/);
    expect(md).toMatch(/\| galacticAssault \| roam, published, 5815 of 24532 \|/);
    expect(md).toMatch(/Totals: 4 rows on 1 level, score 8\.8 of 32/);
    expect(md).toMatch(/`maps\/hoth\.stages\.json`: 2 lines/);
    expect(md).not.toMatch(/Read, not by hand/);
  });

  it('prints the hand-off’s block', () => {
    expect(statusBlock(totals)).toMatch(/\| sim modes done \| 1 of 4 \|/);
  });

  it('fails on a fallen score or a done sim gone missing, and lets a rise or a new row pass', () => {
    const prev = { rows };
    expect(checkLedger(prev, rows)).toEqual({ ok: true, regressions: [], removed: [] });
    const worse = rows.map((r) => (r.mode === 'galacticAssault' ? { ...r, sim: 'missing', score: r.score - 1 } : r));
    const c = checkLedger(prev, worse);
    expect(c.ok).toBe(false);
    expect(c.regressions).toEqual(['hoth_01/galacticAssault: score 5.3 → 4.3', 'hoth_01/galacticAssault: sim done → missing']);
    const better = [...rows.map((r) => ({ ...r, score: r.score + 1 })), { ...rows[0], mode: 'strike', score: 0 }];
    expect(checkLedger(prev, better).ok).toBe(true);
    const fewer = rows.slice(1);
    expect(checkLedger(prev, fewer)).toEqual({ ok: true, regressions: [], removed: ['hoth_01/galacticAssault'] });
  });
});

describe('the readers the script uses', () => {
  it('reads a check’s route as its level and mode, aliases to the game’s key', async () => {
    const { routeOf, checkGreen, packPieces, levelKey } = await import('./bf2017-parity.mjs');
    const keys = ['hoth_01', 'hoth_02', 'endor_01'];
    expect(routeOf('/battlefront/hoth/galacticAssault', keys)).toBe('hoth_01/galacticAssault');
    expect(routeOf('/galaxy/hoth/surface?level=hoth_02&mode=blast', keys)).toBe('hoth_02/blast');
    expect(routeOf('/galaxy/hoth', keys)).toBe(null);
    expect(levelKey('Levels/MP/Hoth_01/Hoth_01')).toBe('hoth_01');
    expect(levelKey('levels/mp/hoth_01')).toBe('hoth_01');
    // a webgpu leg that does not gate (software GL) does not spoil a green webgl one
    expect(checkGreen({ results: [{ leg: 'webgl', errors: [], shots: { a: 'x' } }, { leg: 'webgpu', failed: 'lost', gates: false }] })).toBe(true);
    expect(checkGreen({ results: [{ leg: 'webgl', errors: ['boom'], shots: { a: 'x' } }] })).toBe(false);
    expect(checkGreen({ results: [{ leg: 'webgl', failed: 'never came up', gates: true }] })).toBe(false);
    expect(checkGreen({ results: [] })).toBe(false);
    expect(packPieces({ cells: { a: { count: 3 }, b: { count: 4 } }, horizon: { draws: [{ count: 2 }, { count: 1 }] } })).toBe(10);
  });
});

describe('the compare page’s parts', () => {
  const map = {
    cameras: [
      { id: 'FantasyBattle_Logic:328', layer: 'FantasyBattle_Logic', mode: 'galacticAssault', at: [1, 2, 3], yaw: 0.4, pitch: 0.2, fov: 0 },
      { id: 'Mode9_Logic:26', layer: 'Mode9_Logic', mode: 'strike', at: [4, 5, 6], yaw: 0, pitch: 0, fov: 0 },
    ],
    locators: [{ id: 'FantasyBattle_Logic:37', layer: 'FantasyBattle_Logic', mode: 'galacticAssault', at: [7, 8, 9], yaw: -0.7 }],
  };

  it('lists a mode’s cameras by its layer, locators only when asked, with a file name safe on Windows', async () => {
    const { camerasFor } = await import('./bf2017-parity.mjs');
    expect(camerasFor(map, ['galacticAssault'])).toEqual([{ id: 'FantasyBattle_Logic:328', file: 'FantasyBattle_Logic-328', mode: 'galacticAssault', kind: 'camera', at: [1, 2, 3], yaw: 0.4, pitch: 0.2, fov: 0 }]);
    expect(camerasFor(map, ['coop']).map((c) => c.id)).toEqual(['Mode9_Logic:26']);
    expect(camerasFor(map, ['galacticAssault'], { locators: true }).map((c) => [c.file, c.kind, c.pitch])).toEqual([
      ['FantasyBattle_Logic-328', 'camera', 0.2],
      ['FantasyBattle_Logic-37', 'locator', 0],
    ]);
  });

  it('measures the mean absolute difference of two same-sized pictures, 0 to 1', async () => {
    const { meanError } = await import('./bf2017-parity.mjs');
    const a = { data: new Uint8Array([0, 0, 0, 255, 255, 255]), channels: 3 };
    expect(meanError(a, a)).toBe(0);
    expect(meanError(a, { data: new Uint8Array([255, 255, 255, 255, 255, 255]), channels: 3 })).toBe(0.5);
    expect(() => meanError(a, { data: new Uint8Array(3), channels: 3 })).toThrow(/sizes/);
  });

  it('reads notes as a line a camera and writes a row a camera, an empty frame where the game’s shot is missing', async () => {
    const { notesOf, comparePage } = await import('./bf2017-parity.mjs');
    const notes = notesOf('# notes\n\n- FantasyBattle_Logic-328: the snowbank is the game’s\n- other: x\n');
    expect(notes['FantasyBattle_Logic-328']).toBe('the snowbank is the game’s');
    const html = comparePage([{ level: 'hoth_01', shots: [
      { id: 'FantasyBattle_Logic:328', file: 'FantasyBattle_Logic-328', mode: 'galacticAssault', site: 'site/hoth_01/FantasyBattle_Logic-328.thumb.jpg', game: 'game/hoth_01/FantasyBattle_Logic-328.jpg', error: 0.1234, note: notes['FantasyBattle_Logic-328'] },
      { id: 'Mode9_Logic:26', file: 'Mode9_Logic-26', mode: 'coop', site: 'site/hoth_01/Mode9_Logic-26.thumb.jpg', game: null, error: null, note: '' },
    ] }]);
    expect(html).toMatch(/<title>Parity shots<\/title>/);
    expect(html).toMatch(/src="game\/hoth_01\/FantasyBattle_Logic-328\.jpg"/);
    expect(html).toMatch(/12\.3%/);
    expect(html).toMatch(/Capture game\/hoth_01\/Mode9_Logic-26\.jpg/);
    expect(html).toMatch(/the snowbank is the game’s/);
    expect(html).not.toMatch(/<script/);
  });
});

describe('the overlay and the ledger read layers the same way', () => {
  it('agrees on every layer of every map rulebook', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { modeOfLayer: overlay } = await import('../../src/components/battlefront/gizmos.js');
    const dir = new URL('../../src/data/bf2017/maps/', import.meta.url);
    const layers = new Set();
    for (const f of readdirSync(dir).filter((n) => /^[a-z0-9_]+\.json$/.test(n))) {
      const rows = JSON.parse(readFileSync(new URL(f, dir), 'utf8')).rows ?? {};
      for (const v of Object.values(rows)) if (Array.isArray(v)) for (const r of v) if (r?.layer) layers.add(r.layer);
    }
    expect(layers.size).toBeGreaterThan(20);
    for (const l of layers) expect([l, overlay(l)]).toEqual([l, modeOfLayer(l)]);
  });
});
