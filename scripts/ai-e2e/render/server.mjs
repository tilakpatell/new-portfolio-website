// What the render tier renders through: a dev server on the repository
// (scripts/preview/glb-shot.html and the models, served as the judge's
// renders are) on a free port, and a Chromium to draw with.
//
//   const s = await serve(root)   → { base, stop }
//   chromium()                    → a browser's path, or null

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { freePort } from '../../lib/noise.mjs';

export async function serve(root, { seconds = 60 } = {}) {
  const port = await freePort();
  // vite found as node finds it: a worktree may borrow another checkout's modules
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
  const p = spawn(process.execPath, [vite, root, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
  let down = null;
  p.on('exit', (code) => (down ??= `the dev server exited with ${code}`));
  const base = `http://127.0.0.1:${port}`;
  const until = Date.now() + seconds * 1000;
  for (;;) {
    try {
      if ((await fetch(`${base}/scripts/preview/glb-shot.html`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (down || Date.now() > until) {
      p.kill();
      throw new Error(down ?? `the dev server did not answer on ${base} in ${seconds} s`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { base, stop: () => p.kill() };
}

// CHROME when set; else the Chromium `npx playwright install chromium` put
// where playwright-core looks; else the sandbox's /opt/pw-browsers; else
// Edge on Windows (what the desktop's judge uses).
export function chromium() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  try {
    const pw = createRequire(import.meta.url)('playwright-core').chromium.executablePath();
    if (pw && existsSync(pw)) return pw;
  } catch {
    /* no browser installed for it */
  }
  const sandbox = existsSync('/opt/pw-browsers') ? readdirSync('/opt/pw-browsers').filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync) : null;
  if (sandbox) return sandbox;
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  return process.platform === 'win32' && existsSync(edge) ? edge : null;
}
