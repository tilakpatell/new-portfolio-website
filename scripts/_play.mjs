// A scripted playthrough of a destination through the dev hook: warp to each
// spot, use it, and report what the sim says (near, escape, toast, done).
import { chromium } from 'playwright-core';
const [area, ...steps] = process.argv.slice(2); // steps: "x,z" (warp + act) or "wait:ms"
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { window.localStorage.setItem('tp-intro', '1'); window.localStorage.setItem('tp-start', '"home"'); window.localStorage.setItem('tp-worlds', '"load"'); });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text().slice(0, 300)));
await p.goto('http://127.0.0.1:5197/#/c-137', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__C137__?.goto, null, { timeout: 300000, polling: 1000 });
await p.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
await p.evaluate(([a]) => window.__C137__.goto(a, -400, 900, Math.PI / 2), [area]);
await p.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
await p.waitForTimeout(4000);
const state = () => p.evaluate(() => { const s = window.__C137__.sim; const toast = document.querySelector('.rm-toast, [class*="toast"]')?.textContent?.slice(0, 160) ?? null; return { area: s.area, x: +s.m.x.toFixed(1), z: +s.m.z.toFixed(1), near: s.near?.id ?? null, escape: s.escape ? { task: s.escape.task, left: +(s.escape.s - (s.t - s.escape.at)).toFixed(0) } : null, used: [...(s.used ?? [])], toast, done: JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]') }; });
for (const step of steps) {
  if (step.startsWith('wait:')) { await p.waitForTimeout(Number(step.slice(5))); console.log('waited', JSON.stringify(await state())); continue; }
  const [x, z] = step.split(',').map(Number);
  await p.evaluate(([a, x, z]) => window.__C137__.warp(a, x, z, Math.PI / 2), [area, x, z]);
  await p.waitForTimeout(700);
  const before = await state();
  await p.evaluate(() => window.__C137__.act());
  await p.waitForTimeout(3600);
  const after = await state();
  console.log(`at ${x},${z} near=${before.near} → toast=${JSON.stringify(after.toast)} escape=${JSON.stringify(after.escape)} done=${after.done.join('|')}`);
}
console.log('info', JSON.stringify(await p.evaluate(() => { const i = window.__C137__.api.info(); return { calls: i.calls, triangles: i.triangles }; })));
console.log('npcs', JSON.stringify(await p.evaluate(([a]) => window.__C137__.api.act(a, 'npcs'), [area])));
if (errors.length) console.log('errors', errors.slice(0, 5));
await b.close();
