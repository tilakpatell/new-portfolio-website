// The parity ledger (the galaxy-on-the-game design's decision 8, lane G6):
// for every level × mode the site plays, what of it is the game's, what is a
// person's reading of the game (hand) and what is missing. Pure: the script
// (scripts/bf2017-parity.mjs) reads the files and hands their contents in.
//
//   ledgerRows({ levels, maps, hands, modes, built, hud, widgets, teams,
//                offered, points, packs, pieces, evidence }) → rows
//   totalsOf(rows), ledgerMarkdown(rows, { notes }), statusBlock(totals),
//   checkLedger(prev, rows) → { ok, regressions, removed }
//
// A row's score is 0–8, one a column, each the share of it that is the
// game's: pack (a whole, published level 1; a roam cut 0), layer (the map
// has rows for the mode 1), rules (no hand file needed 1; a hand file 0.5;
// missing 0), sim (the mode built 1), hud (widgets drawn of the mode's
// list, for a built mode), kits (offered of the team record's), prices (read from the record
// 1, hand 0.5), check (a browser shot of the pair 1).

// The layers each mode reads (the spec's decision 5, MODE_LAYERS), by the
// layer's name up to its first underscore part; the first match wins, so
// the Skirmish team-deathmatch layers go to the Arcade before Blast.
const LAYER_MODES = [
  [/^FantasyBattle/, 'galacticAssault'],
  [/^(HeroArena|HeroesVsVillains)/, 'hvv'],
  [/^TeamDeathmatch_Skirmish/, 'arcade'],
  [/^(TeamDeathmatch|Blast)/, 'blast'],
  [/^(PlanetaryMissions|Domination)/, 'strike'],
  [/^(Mode9|ModeDefend)/, 'coop'],
  [/^Mode6/, 'showdown'],
  [/^Mode1(_|$)/, 'supremacy'],
  [/^(Extraction|Mode5|Mode2)/, 'extraction'],
  [/^Mode3/, 'ewokHunt'],
  [/^ModeC/, 'jetpackCargo'],
  [/^SpaceBattle/, 'starfighter'],
];
export const modeOfLayer = (layer, tagged = null) => LAYER_MODES.find(([re]) => re.test(layer ?? ''))?.[1] ?? tagged;

// Modes whose order or rules a person reads from the graph (the spec's mode
// catalogue, last column): their hand file is `maps/<level>.<mode>.json`.
export const NEEDS_HAND = new Set(['galacticAssault', 'blast', 'hvv', 'showdown', 'strike', 'coop', 'supremacy', 'extraction', 'ewokHunt', 'jetpackCargo']);

// What each mode deploys (the spec's mode table: vehicles, heroes).
const ALL = ['class', 'hero', 'reinforcement', 'vehicle'];
export const KIT_KINDS = {
  galacticAssault: ALL,
  coop: ALL,
  supremacy: ALL,
  hvv: ['hero'],
  showdown: ['hero'],
  blast: ['class'],
  strike: ['class'],
  ewokHunt: ['class'],
  jetpackCargo: ['class'],
  extraction: ['class', 'reinforcement'],
  arcade: ['class', 'hero'],
  explore: ['class', 'vehicle'],
};
const TEAM_LIST = { class: 'classes', hero: 'heroes', reinforcement: 'reinforcements', vehicle: 'vehicles' };

// The HUD widgets of ui.json each mode shows in the game (hand: ui.json has
// no per-mode list; read from the widgets' names and the spec's decision 5).
const SOLDIER = ['SpawnOverlayScreen', 'PlayerHealth', 'HealthBar', 'WeaponHeatBar', 'AbilityRecharge', 'AbilityState', 'DamageIndicator', 'KillLogScreen', 'KillMessage', 'RadarWidget', 'InworldMarkerDisplayScreen', 'ScoreboardWidget', 'OutcomeDeclarationHudWidget', 'DeathBattlepoints', 'SquadMemberList', 'ScoreLogWidget'];
const HERO = ['SpawnOverlayScreen', 'PlayerHealth', 'HealthBar', 'StaminaBar_Above', 'AbilityRecharge', 'AbilityState', 'DamageIndicator', 'KillLogScreen', 'RadarWidget', 'InworldMarkerDisplayScreen', 'ScoreboardWidget', 'OutcomeDeclarationHudWidget'];
export const MODE_WIDGETS = {
  galacticAssault: [...SOLDIER, 'TopLevelObjective', 'SubLevelWidget', 'VehicleHealth'],
  blast: SOLDIER,
  strike: [...SOLDIER, 'TopLevelObjective', 'ObjectiveSpecificContent'],
  hvv: [...HERO, 'TopLevelObjective'],
  showdown: [...HERO, 'PlayerRoundWidget', 'RoundOutcomeDeclarationScreenWidget'],
  coop: [...SOLDIER, 'TopLevelObjective', 'ScoreboardMode9Widget', 'VehicleHealth'],
  supremacy: [...SOLDIER, 'RadarObjectiveMode1Widget', 'TopLevelObjective', 'VehicleHealth'],
  extraction: [...SOLDIER, 'TopLevelObjective'],
  ewokHunt: [...SOLDIER, 'TopLevelObjective'],
  jetpackCargo: [...SOLDIER, 'TopLevelObjective'],
  arcade: [...SOLDIER.filter((w) => w !== 'ScoreboardWidget'), 'ScoreboardWidget_Skirmish', 'ScoreboardList_Skirmish'],
  explore: ['PlayerHealth', 'RadarWidget', 'WeaponHeatBar', 'VehicleHealth'],
};

const round = (n) => Math.round(n * 100) / 100;
const share = (n, of) => (of ? n / of : 0);

function layerOf(map, mode) {
  if (!map) return 'none';
  const count = (...keys) => keys.reduce((n, k) => n + (map[k] ?? []).filter((r) => modeOfLayer(r.layer, r.mode) === mode).length, 0);
  const out = { spawns: count('spawns'), areas: count('polygons'), volumes: count('volumes', 'spheres', 'boxes'), prefabs: count('prefabs') };
  return Object.values(out).some(Boolean) ? out : 'none';
}

function kitsOf(team, mode, offered, done) {
  if (!team) return { offered: 0, of: 0 };
  const kinds = KIT_KINDS[mode] ?? ALL;
  let of = 0;
  let given = 0;
  for (const side of [team.light, team.dark]) {
    for (const kind of kinds) {
      const n = (side?.[TEAM_LIST[kind]] ?? []).length;
      of += n;
      if (done && offered.includes(kind)) given += n;
    }
  }
  return { offered: given, of };
}

export function ledgerRows({ levels = [], maps = {}, hands = [], modes = [], built = {}, hud = {}, widgets = MODE_WIDGETS, teams = {}, offered = [], points = {}, packs = {}, pieces = {}, evidence = [] }) {
  const drawn = new Set(hud.drawn ?? []);
  const prices = points.source === 'game' ? 'game' : 'hand';
  const rows = [];
  for (const lv of levels) {
    const p = packs[lv.key];
    const pack = { kind: p?.kind ?? 'none', published: Boolean(p?.published), pieces: p?.pieces ?? 0, of: pieces[lv.key] ?? 0 };
    for (const mode of lv.modes) {
      const layer = layerOf(maps[lv.key], mode);
      const rules = !NEEDS_HAND.has(mode) ? 'game' : hands.includes(`${lv.key}.${mode}`) ? 'hand' : 'missing';
      const sim = modes.includes(mode) && (built[lv.key] ?? []).includes(mode) ? 'done' : 'missing';
      const list = widgets[mode] ?? [];
      // (a HUD part counts only for a mode that runs: the part is there, the mode's view is not)
      const h = { drawn: sim === 'done' ? list.filter((w) => drawn.has(w)).length : 0, of: list.length };
      const kits = kitsOf(teams[lv.key], mode, offered, sim === 'done');
      const check = evidence.includes(`${lv.key}/${mode}`) ? 'green' : 'none';
      const score =
        (pack.kind === 'whole' && pack.published ? 1 : 0) +
        (layer === 'none' ? 0 : 1) +
        { game: 1, hand: 0.5, missing: 0 }[rules] +
        (sim === 'done' ? 1 : 0) +
        share(h.drawn, h.of) +
        share(kits.offered, kits.of) +
        (prices === 'game' ? 1 : 0.5) +
        (check === 'green' ? 1 : 0);
      rows.push({ level: lv.key, world: lv.world, mode, pack, layer, rules, sim, hud: h, kits, prices, check, score: round(score) });
    }
  }
  return rows;
}

export function totalsOf(rows) {
  const rules = { game: 0, hand: 0, missing: 0 };
  for (const r of rows) rules[r.rules]++;
  return {
    rows: rows.length,
    levels: new Set(rows.map((r) => r.level)).size,
    score: round(rows.reduce((n, r) => n + r.score, 0)),
    max: rows.length * 8,
    packWhole: rows.filter((r) => r.pack.kind === 'whole' && r.pack.published).length,
    layerFound: rows.filter((r) => r.layer !== 'none').length,
    rules,
    simDone: rows.filter((r) => r.sim === 'done').length,
    hudFull: rows.filter((r) => r.hud.of && r.hud.drawn === r.hud.of).length,
    kitsFull: rows.filter((r) => r.kits.of && r.kits.offered === r.kits.of).length,
    pricesGame: rows.filter((r) => r.prices === 'game').length,
    checkGreen: rows.filter((r) => r.check === 'green').length,
  };
}

const packCell = (p) => (p.kind === 'none' ? 'none' : `${p.kind}, ${p.published ? 'published' : 'not published'}, ${p.pieces} of ${p.of || '?'}`);
const layerCell = (l) => (l === 'none' ? 'none' : `${l.spawns} spawns, ${l.areas} areas, ${l.volumes} volumes, ${l.prefabs} prefabs`);

// The hand files NOTES.md lists: its `## \`file\`` sections and their lines.
export function handFiles(notes = '') {
  const out = [];
  let cur = null;
  for (const line of notes.split('\n')) {
    const h = line.match(/^## (`[^`]+`.*)$/);
    if (h) out.push((cur = { file: h[1], lines: 0 }));
    else if (/^## /.test(line)) cur = null;
    else if (cur && /^- /.test(line)) cur.lines++;
  }
  return out;
}

export function ledgerMarkdown(rows, { notes = '', date = '' } = {}) {
  const t = totalsOf(rows);
  const out = [
    '# Parity with the game: the ledger',
    '',
    `Written by \`node scripts/bf2017-parity.mjs\`${date ? ` on ${date}` : ''}; do not edit by hand. The spec: \`docs/superpowers/specs/2026-10-10-bf2017-galaxy-on-the-game-design.md\`, decision 8. A row's score is 0–8, one a column, each the share of it that is the game's (a hand reading counts half; \`scripts/lib/bf2017-parity.mjs\` says how each is read). \`--check\` fails when a row's score falls or a done sim goes missing.`,
    '',
    `Totals: ${t.rows} rows on ${t.levels} level${t.levels === 1 ? '' : 's'}, score ${t.score} of ${t.max}; packs whole ${t.packWhole}, layers found ${t.layerFound}, rules game ${t.rules.game} / hand ${t.rules.hand} / missing ${t.rules.missing}, sims done ${t.simDone}, HUD whole ${t.hudFull}, kits whole ${t.kitsFull}, prices from the record ${t.pricesGame}, browser checks ${t.checkGreen}.`,
  ];
  for (const level of [...new Set(rows.map((r) => r.level))]) {
    out.push('', `## ${level}`, '', '| mode | pack | layer | rules | sim | HUD | kits | prices | check | score |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --: |');
    for (const r of rows.filter((x) => x.level === level)) out.push(`| ${r.mode} | ${packCell(r.pack)} | ${layerCell(r.layer)} | ${r.rules} | ${r.sim} | ${r.hud.drawn} of ${r.hud.of} | ${r.kits.offered} of ${r.kits.of} | ${r.prices} | ${r.check} | ${r.score} |`);
  }
  const hand = handFiles(notes);
  if (hand.length) {
    out.push('', '## The hand values (src/data/bf2017/NOTES.md)', '');
    for (const h of hand) out.push(`- ${h.file}: ${h.lines} lines`);
  }
  return `${out.join('\n')}\n`;
}

export function statusBlock(t) {
  return [
    '| the ledger | now |',
    '| --- | --- |',
    `| level × mode rows | ${t.rows} on ${t.levels} levels |`,
    `| score | ${t.score} of ${t.max} |`,
    `| packs whole and published | ${t.packWhole} of ${t.rows} |`,
    `| mode layers found in the map | ${t.layerFound} of ${t.rows} |`,
    `| rules (game / hand / missing) | ${t.rules.game} / ${t.rules.hand} / ${t.rules.missing} |`,
    `| sim modes done | ${t.simDone} of ${t.rows} |`,
    `| HUD widget lists whole | ${t.hudFull} of ${t.rows} |`,
    `| kits whole | ${t.kitsFull} of ${t.rows} |`,
    `| prices from the record | ${t.pricesGame} of ${t.rows} |`,
    `| browser checks green | ${t.checkGreen} of ${t.rows} |`,
  ].join('\n');
}

export function checkLedger(prev, rows) {
  const key = (r) => `${r.level}/${r.mode}`;
  const now = new Map(rows.map((r) => [key(r), r]));
  const regressions = [];
  const removed = [];
  for (const was of prev?.rows ?? []) {
    const r = now.get(key(was));
    if (!r) {
      removed.push(key(was));
      continue;
    }
    if (r.score < was.score) regressions.push(`${key(r)}: score ${was.score} → ${r.score}`);
    if (was.sim === 'done' && r.sim !== 'done') regressions.push(`${key(r)}: sim done → ${r.sim}`);
  }
  return { ok: regressions.length === 0, regressions, removed };
}

// The map's placed pieces (web_opt/maps/index.json, measured by the spec's
// survey; hand until a pack's README carries the map's own count).
export const MAP_PIECES = {
  hoth_01: 24532,
  endor_01: 18530,
  tatooine_01: 20321,
  yavin_01: 15428,
  deathstar02_01: 21722,
  kashyyyk_01: 15827,
  kamino_01: 14330,
  naboo_01: 18720,
  geonosis_01: 9580,
  naboo_03: 36507,
  kashyyyk_02: 34010,
  kamino_03: 32337,
  felucia_01: 33133,
};

// 'Levels/MP/Hoth_01/Hoth_01' or 'levels/mp/hoth_01' → 'hoth_01'
export const levelKey = (path) => String(path).split('/').filter(Boolean).pop().toLowerCase();

// A level as a route names it (the game's key, or a short name like `hoth`
// that stands for the planet's first level) → the game's key.
const resolve = (name, keys) => (keys.includes(name) ? name : (keys.find((k) => k.startsWith(`${name}_`)) ?? null));

// A browser check's route → 'level/mode': `/battlefront/<level>/<mode>` or
// G1's `/galaxy/<system>/surface?level=<key>&mode=<id>`.
export function routeOf(route, keys) {
  const [path, query = ''] = String(route).split('?');
  const bf = path.match(/^\/battlefront\/([^/]+)\/([^/]+)/);
  if (bf) {
    const level = resolve(bf[1], keys);
    return level ? `${level}/${bf[2]}` : null;
  }
  const q = new URLSearchParams(query);
  const gx = path.match(/^\/galaxy\/([^/]+)\/surface/);
  if (gx && q.get('mode')) {
    const level = resolve(q.get('level') ?? gx[1], keys);
    return level ? `${level}/${q.get('mode')}` : null;
  }
  return null;
}

// green: a leg came up with its shots and no console error, and no leg that
// gates failed (a software-GL WebGPU leg says gates: false)
export function checkGreen(check) {
  const rs = check?.results ?? [];
  if (rs.some((r) => (r.failed && r.gates !== false) || r.errors?.length)) return false;
  return rs.some((r) => r.shots && Object.keys(r.shots).length);
}

// the pieces a pack draws: its cells' instances and the horizon's
export const packPieces = (pack) => Object.values(pack.cells ?? {}).reduce((n, c) => n + (c.count ?? 0), 0) + (pack.horizon?.draws ?? []).reduce((n, d) => n + (d.count ?? 0), 0);

// ---- the compare page (scripts/bf2017-compare.mjs) ----

// A level's cameras for the modes asked, by layer: the deploy screen's
// CameraEntityData rows, and with `locators` the EOR and outro locators
// (no pitch in the row: level). `file` is the id safe as a file name.
export function camerasFor(map, modes, { locators = false } = {}) {
  const want = new Set(modes);
  const rows = [...(map.cameras ?? []).map((r) => ({ r, kind: 'camera' })), ...(locators ? (map.locators ?? []).map((r) => ({ r, kind: 'locator' })) : [])];
  return rows
    .filter(({ r }) => want.has(modeOfLayer(r.layer, r.mode)))
    .map(({ r, kind }) => ({ id: r.id, file: r.id.replace(/[^A-Za-z0-9_-]/g, '-'), mode: modeOfLayer(r.layer, r.mode), kind, at: r.at, yaw: r.yaw ?? 0, pitch: r.pitch ?? 0, fov: r.fov ?? 0 }));
}

// the mean absolute difference over every channel, 0 (the same) to 1;
// both pictures raw, the same size (the script scales both to 256 wide)
export function meanError(a, b) {
  if (a.data.length !== b.data.length || a.channels !== b.channels) throw new Error('the two pictures differ in sizes');
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / a.data.length / 255;
}

// notes.md: `- <camera file>: the note` a line
export function notesOf(md = '') {
  const out = {};
  for (const m of md.matchAll(/^- ([A-Za-z0-9_-]+): (.+)$/gm)) out[m[1]] = m[2].trim();
  return out;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// levels: [{ level, shots: [{ id, file, mode, site, game, error, note }] }]
// (paths relative to the page). Static: no script, opened from the folder.
export function comparePage(levels) {
  const rows = levels.flatMap(({ level, shots }) => [
    `<h2>${esc(level)}</h2>`,
    ...shots.map((s) => {
      const game = s.game ? `<img src="${esc(s.game)}" alt="the game, ${esc(s.id)}">` : `<div class="empty">Capture game/${esc(level)}/${esc(s.file)}.jpg: the game's deploy screen (${esc(s.mode)}) from camera ${esc(s.id)}</div>`;
      const diff = s.error == null ? '—' : `${(s.error * 100).toFixed(1)}%`;
      return `<section><header><b>${esc(s.id)}</b> <span>${esc(s.mode)}</span> <span>difference ${diff}</span></header><div class="pair"><figure><img src="${esc(s.site)}" alt="the site, ${esc(s.id)}"><figcaption>the site</figcaption></figure><figure>${game}<figcaption>the game</figcaption></figure></div>${s.note ? `<p>${esc(s.note)}</p>` : ''}</section>`;
    }),
  ]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Parity shots</title>
<style>
:root { color-scheme: light dark; --bg: #f6f6f4; --fg: #1d1d1b; --line: #d4d4cf; --muted: #6b6b66; }
@media (prefers-color-scheme: dark) { :root { --bg: #141413; --fg: #ecece8; --line: #3a3a37; --muted: #a0a09a; } }
body { margin: 0 auto; max-width: 1200px; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
section { border-top: 1px solid var(--line); padding: 12px 0; }
header { display: flex; gap: 16px; flex-wrap: wrap; } header span { color: var(--muted); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } @media (max-width: 640px) { .pair { grid-template-columns: 1fr; } }
figure { margin: 0; } img { width: 100%; display: block; aspect-ratio: 16 / 9; object-fit: cover; background: var(--line); }
figcaption { color: var(--muted); font-size: 13px; }
.empty { aspect-ratio: 16 / 9; display: grid; place-items: center; padding: 12px; border: 1px dashed var(--line); color: var(--muted); text-align: center; }
</style></head><body>
<h1>Parity shots: the site beside the game</h1>
<p>Written by <code>node scripts/bf2017-compare.mjs</code>. Each row is one of the level's own cameras: the site's shot from it, and the owner's screenshot of the real game from the same camera (the README says how to take it). The difference is the mean absolute difference of the two at 256 pixels wide.</p>
${rows.join('\n')}
</body></html>
`;
}
