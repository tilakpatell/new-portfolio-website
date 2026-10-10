/* global window */
// A browser check of your standing (universe/standing.js) and the staged
// aces (hunterRules.js's stages) in the scene. With the dev server up
// (npx vite --port 5173) and Chrome at $CHROME:
//   OUT=/tmp/shots node scripts/standing-check.mjs [cruiser|xwing|falcon|rv]
// It notes deeds through the scene's own hook and checks the levels, the
// HUD's note and the crew's lines come; brings a wanted pilot an inspector
// and sees the scan find them; brings an ace, hurts it into its stage and
// sees it change its ways and call its friends in; and checks the standing
// is kept in storage.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const crew = process.argv[2] ?? 'rv';
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
  window.localStorage.setItem('tp-universe-drive', '"super"');
  window.localStorage.removeItem('tp:universe-standing');
}, crew);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);
const dbg = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });

// 1. deeds move the standing, and a level reached is said and noted
const start = await dbg(() => window.__universeDebug.standing.state());
console.log('start:', JSON.stringify(start));
check(start && start.law === 0 && start.civil === 0, 'a clean slate');
await dbg(() => {
  const d = window.__universeDebug;
  for (let i = 0; i < 3; i++) d.deed('killCivil');
});
await page.waitForTimeout(800);
const feared = await dbg(() => ({ ...window.__universeDebug.standing.state(), note: window.__universeDebug.state.note?.text ?? null }));
console.log('after shooting freighters:', JSON.stringify(feared));
check(feared.levels.civil === 'feared', 'the ordinary ships fear you');
check(feared.levels.law === 'suspect', 'and the law has you as a suspect');
check(/fear you/.test(feared.note ?? ''), `the HUD notes it (${feared.note})`);
await shot('standing-feared');
await dbg(() => {
  const d = window.__universeDebug;
  for (let i = 0; i < 4; i++) d.deed('killHunter');
});
await page.waitForTimeout(800);
const wanted = await dbg(() => ({ ...window.__universeDebug.standing.state(), wanted: window.__universeDebug.standing.wanted }));
check(wanted.wanted === true && wanted.levels.law === 'wanted', `the law wants you (${JSON.stringify(wanted.levels)})`);
// kept in storage
const stored = await dbg(() => JSON.parse(window.localStorage.getItem('tp:universe-standing') ?? 'null'));
check(stored && Object.values(stored).some((v) => v.law <= -4), `kept in storage: ${JSON.stringify(stored)}`);

// 2. a wanted pilot: the inspector's scan finds you (the brains run on by hand, standing still)
const inspector = await dbg(() => Object.values(window.__universeDebug.NPCS).find((c) => c.brain === 'inspector' && c.side === window.__universeDebug.standing.sideId)?.id ?? null);
check(Boolean(inspector), `the side has an inspector: ${inspector}`);
if (inspector) {
  await dbg(() => {
    window.__universeDebug.npcs.clear();
    window.__universeDebug.hunters.clear();
    window.__universeDebug.state.heat = 0;
  });
  await dbg((id) => window.__universeDebug.meetNpc(id), inspector);
  await dbg(() => {
    const d = window.__universeDebug;
    const world = { you: d.state.ship, hunters: [], stations: [], solids: [], next: null, heat: 0, shield: 100, wanted: d.standing.wanted, feared: d.standing.feared, friend: d.standing.friend };
    for (let t = 0; t < 16; t += 0.1) d.npcs.update(0.1, t, world);
  });
  const scanned = await dbg(() => {
    const m = window.__universeDebug.npcs.live[0];
    return m ? [...m.said] : null;
  });
  check((scanned ?? []).includes('busted'), `a wanted pilot is found on the scan, heat or no (${JSON.stringify(scanned)})`);
  await dbg(() => window.__universeDebug.npcs.clear());
}

// 3. an ace with stages: hurt into its stage, the scene hears of it (the
// crew's line) and, if it summons, its friends come as a pack of their own
const staged = await dbg(() => {
  const d = window.__universeDebug;
  d.hunters.clear();
  const sideId = d.standing.sideId;
  const want = { starwars: ['empire', 'tieadvanced'], rickmorty: ['mortys', 'evilmortyship'], breakingbad: ['dea', 'suvace'] }[sideId];
  if (!want) return null;
  d.hunters.pack(want[0], d.state.ship, { size: 2, ace: true, heat: 6 });
  const t = d.hunters.targets.find((c) => c.kind === want[1]);
  return t ? { id: t.id, kind: t.kind, hp: t.hp, hpMax: t.hpMax, packs: d.hunters.packs.length, faction: want[0] } : { none: true, kinds: d.hunters.targets.map((c) => c.kind) };
});
console.log('ace:', JSON.stringify(staged));
check(staged && !staged.none, 'the side’s ace came');
if (staged && !staged.none) {
  const after = await dbg((id) => {
    const d = window.__universeDebug;
    const t = d.hunters.targets.find((c) => c.id === id);
    const toStage = t.hp - Math.floor(t.hpMax * 0.5);
    for (let i = 0; i < toStage; i++) d.hunters.damage(id, 1);
    return { hp: d.hunters.targets.find((c) => c.id === id)?.hp ?? 0 };
  }, staged.id);
  console.log('hurt into its stage:', JSON.stringify(after));
  check(after.hp > 0 && after.hp <= staged.hpMax * 0.5, 'it is at half and still flying');
  // the scene hears of it on the next frame: a summons brings a pack of its own
  await page.waitForTimeout(3000);
  const packs = await dbg(() => window.__universeDebug.hunters.packs.filter((p) => !p.gone).map((p) => p.faction));
  console.log('packs:', JSON.stringify(packs));
  const summons = { suvace: 'dea', evilmortyship: 'mortys', tieadvanced: null }[staged.kind];
  if (summons) check(packs.length === staged.packs + 1 && packs.includes(summons), `its friends came as a pack of their own: ${summons}`);
  else check(packs.length === staged.packs, 'no summons for this one: no extra pack');
  await shot('standing-stage');
}

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
check(errors.length === 0, 'no page errors');
await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
