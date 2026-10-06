/* global window, document */
// A browser check of the fleet war's battle at the front (front.js, battle.js,
// battleScene.js, BattleHud.jsx). With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/battle-check.mjs [xwing|falcon] [quality]
// It puts the ship at the front, picks the attacking side when it's asked,
// lets the fight run, takes the shield generators, the bridge and the reactor
// down with the battle's own hit() (as your shots would), watches the
// flagship break in two, and checks the end card and the war's save, taking
// screenshots as it goes (battle-<n>-<what>.png).
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const crew = process.argv[2] ?? 'xwing';
const quality = process.argv[3] ?? 'mid';
const URL = `http://localhost:5173/?quality=${quality}#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
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
  window.localStorage.removeItem('tp-war-starwars');
}, crew);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader/i.test(m.text()) && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.addStyleTag({ content: '.universe-panel { display: none !important; }' });
let shot = 0;
const snap = async (what) => page.screenshot({ path: `${out}/battle-${shot++}-${what}.png` });
const dbg = (fn, arg) => page.evaluate(fn, arg);

// at the front: on the attacker's side of it, nose toward the defender's line
const w = await dbg(() => {
  const d = window.__universeDebug;
  const f = d.front();
  if (!f) return null;
  const at = f.where().at;
  const s = d.state;
  s.auto = null;
  s.safeUntil = 1e9; // (nothing hurts the ship while this looks round)
  s.shield = 100;
  // (heading −π/2 flies along +x, the corridor's way: toward the defender's line)
  s.ship = { ...s.ship, x: at[0] - 40, y: at[1] + 6, z: at[2] + 4, heading: -Math.PI / 2, pitch: -0.03, bank: 0, speed: 3, vy: 0 };
  return f.where();
});
check(Boolean(w), 'the crew has a front');
if (!w) {
  await browser.close();
  process.exit(1);
}
console.log('front:', w.name, w.at);
await page.waitForSelector('.battle-ask', { timeout: 60000 }).catch(() => {});
check(await page.locator('.battle-ask').isVisible().catch(() => false), 'arriving, it asks which side to fly for');
await snap('ask');
await page.locator('.battle-ask-side').first().click();
await page.waitForTimeout(500);
const joined = await dbg(() => window.__universeDebug.front().joined);
check(joined === 0, 'picking the first side joins it');
// the fight, a while in
await page.waitForTimeout(12000);
const info = await dbg(() => window.__universeDebug.front().info);
console.log('battle:', JSON.stringify(info.battle));
check(info.battle.fighters[0] > 0 && info.battle.fighters[1] > 0, 'both sides have fighters up');
check(await page.locator('.battle-hud[data-on]').count(), 'the battle bar is up');
await snap('fight');
// the whole of it: up and behind the attacker's line, looking across at the defender's
await dbg(() => {
  const d = window.__universeDebug;
  const b = d.front().battle;
  const own = b.capitals.find((c) => c.team === b.attacker && c.role === 'flagship');
  const s = d.state;
  s.ship = { ...s.ship, x: own.pos.x - 30, y: own.pos.y + 34, z: own.pos.z + 10, heading: -Math.PI / 2, pitch: -0.22, speed: 0 };
});
await page.waitForTimeout(6000);
await snap('panorama');
// looking along the line at the Star Destroyer
await dbg(() => {
  const d = window.__universeDebug;
  const b = d.front().battle;
  const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
  const s = d.state;
  s.ship = { ...s.ship, x: flag.pos.x - 70, y: flag.pos.y + 14, z: flag.pos.z + 18, heading: -Math.PI / 2 + 0.2, pitch: -0.1, speed: 2 };
});
await page.waitForTimeout(6000);
await snap('destroyer');
// the shield generators, from your guns
const hitAll = (phase) =>
  dbg((p) => {
    const b = window.__universeDebug.front().battle;
    const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    for (const s of flag.subs.filter((o) => o.phase === p)) for (let i = 0; i < 200 && s.alive; i++) b.hit({ x: s.pos.x, y: s.pos.y + 2, z: s.pos.z }, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 3);
    return flag.subs.map((s) => s.alive);
  }, phase);
await hitAll(1);
await page.waitForTimeout(4000);
const p2 = await dbg(() => window.__universeDebug.front().battle.phase);
check(p2 === 2, 'with both generators down it’s phase 2');
await snap('shield-down');
await hitAll(2);
await page.waitForTimeout(3000);
await hitAll(3);
await page.waitForTimeout(3500);
await snap('breaking');
// (software GL runs the battle at a tenth of its pace: the break-up's six seconds take a minute or more)
await page.waitForFunction(() => window.__universeDebug.front().battle?.over, null, { timeout: 300000 }).catch(() => {});
await page.waitForTimeout(4000);
await snap('broken');
const end = await dbg(() => ({ over: window.__universeDebug.front().battle?.over ?? null, state: window.__universeDebug.front().info.state, card: document.querySelector('.battle-over-word')?.textContent ?? null }));
console.log('end:', JSON.stringify(end));
check(end.over?.winner === 0 && end.over?.why === 'flagship', 'the reactor gone, the attacker wins');
check(end.card === 'Victory', 'the end card says Victory');
check(end.state.front === 4, 'the front moved on a sector');
const saved = await dbg(() => window.localStorage.getItem('tp-war-starwars'));
check(Boolean(saved) && JSON.parse(saved).front === 4, 'the war is saved');
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
