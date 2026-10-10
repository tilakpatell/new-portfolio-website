# Testing

**Version** `vitest`, `playwright-core`, `fake-indexeddb` and `yaml`, each at the version its row in [README.md](README.md) gives · **Page owner** `vite.config.js`’s `test` block and `scripts/` · **Decision** none recorded

## What it is, and why it is here

Vitest runs the unit tests beside every file; `playwright-core` drives headless Chromium for the checks that need a real page and a real WebGL canvas; `fake-indexeddb` gives Node tests the browser’s database; `yaml` lets a test read the GitHub workflows. The census counts tests out, so `vitest`, `fake-indexeddb` and `yaml` show no importing files, and every `playwright-core` file is a script.

## Where it is used

- `vite.config.js`’s `test` block: `npm test`, every `*.test.js` beside its file, with the slow tiers and the fixtures left out.
- `vitest.ai.config.js`: `npm run test:ai`, the AI and model tiers (`scripts/ai-e2e/**/*.test.mjs`, the fuzz and scenario tests).
- `vitest.render.config.js`: `npm run test:ai:render`, every model drawn in Chromium.
- `scripts/autopilot-check.mjs`: lint, tests, build, then the routes in headless Chromium with software WebGL, failing on a page error or a blank canvas; with `--shots`, the screenshots for the changes log.
- The other `scripts/*-check.mjs` files: route-by-route checks in Chromium (the census lists every `playwright-core` script).
- `scripts/stream-check.mjs`: Hoth on a phone profile over throttled 3G (CDP `Network.emulateNetworkConditions`, 1.6 Mbit/s, 150 ms) against a built site; fails past the streaming plan’s numbers (first figure within 8 s of the scene mounting, the world up under 4 MB, no URL asked more than three times, no console errors).
- `scripts/assets-check.mjs` (no browser): every entry of `src/data/galaxyAssets.json` and `assets-manifest.json` asked of the public bucket for one byte, its size and year’s cache held to the manifest; the deploy runs it before the build when `ASSET_BASE` is set.
- `scripts/ai-e2e/README.md`: the tiers, from unit to the nightly GPU evals, and where each runs.

## How the site uses it

- **Tests go beside the file**: `x.js` has `x.test.js`, under a second, no network; a fixture lives in a `fixtures/` folder beside the test (`docs/health/RULES.md`).
- **Pure logic is tested in Node**: `rules.js`, `budget.js` and anything under `src/lib` or `src/runtime` that imports neither React nor three (`docs/health/RULES.md`, “Logic apart from drawing”).
- **Three runs, three speeds.** `npm test` stays fast; `npm run test:ai` holds the slower contract, asset, simulation and agent tiers; `npm run test:ai:render` needs a browser. CI runs the first on every pull request and the AI job runs the second and, where a model changed, the third (`.github/workflows/ci.yml`).
- **`playwright-core`, not `@playwright/test`.** The scripts launch Chromium themselves (`chromium.launch` with an `executablePath`), with SwiftShader so WebGL draws without a graphics chip.
- **Docs are tested too.** `docs/stack/stack.test.js` fails a stack page that names a file that no longer exists.

## What the site does not use, and why

- **`@playwright/test` and its runner**: the browser checks are scripts with their own flags (`--routes`, `--before`, `--phone`), run by the autopilot and by hand, not a test suite.
- **Playwright’s browser download**: the scripts use the Chromium already on the machine (`/opt/pw-browsers` in a cloud session, `--chromium` or `CHROMIUM` elsewhere; `scripts/autopilot-check.mjs`).
- **jsdom for 3D**: a scene is checked in a real browser, not a fake DOM.

## Rules

- Skip, quieten or delete a test to get green: never (`docs/health/RULES.md`, Never).
- A change that touches a route runs `node scripts/autopilot-check.mjs` with that route before it merges (the autopilot’s standing rules in `.claude/skills/autopilot/SKILL.md`).
- `npm test` passes on every pull request (`.github/workflows/ci.yml`).

## Upgrading

```
npm install vitest@<v>
npm test
npm run test:ai
```

For `playwright-core`, match the Chromium it expects: CI installs the browser for the version in `package.json` (`.github/workflows/ci.yml`’s AI job), and a cloud session uses the one under `/opt/pw-browsers`. Run `node scripts/autopilot-check.mjs --only smoke` after. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **A slow test is in the wrong run.** A fuzz or scenario test named `*.fuzz.test.js` or `*.scenario.test.js` goes to `npm run test:ai`; `vite.config.js` leaves it out of `npm test`.
- **Fixtures are not tests.** `scripts/health/fixtures/` is excluded from the test run and from lint, so a fixture may hold what a test must never contain.
- **Software WebGL is slow and honest.** SwiftShader draws what a graphics chip would, slowly; a check’s timings say nothing about a visitor’s frame rate (`scripts/perf-probe.mjs` is for that).
