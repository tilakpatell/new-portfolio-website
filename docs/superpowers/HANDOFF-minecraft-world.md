# Hand-off: Minecraft’s world

The design is `specs/2026-10-07-minecraft-world-design.md`; the plan, in seven phases that are each a pull request, is `plans/2026-10-07-minecraft-world.md`. Read both before touching code. The Mario 64 tribute (`src/components/mario64/`, `specs/2026-10-06-mario64-design.md`) is the pattern to follow: a world module on `src/runtime`, pure rules under test, the page and the island’s overlay.

## Done

- The design and the plan (this PR). No code yet.

## Left, in order

1. **Phase 1, blocks and a chunk you can walk on.** Plan Tasks 1.1 to 1.13. Done when `#/dot-matrix/minecraft` draws an infinite seeded landscape with trees from Pixel Perfection’s tiles, the player walks, jumps and swims across it at 60 fps on the high tier, the island’s crafting table opens it, and `scripts/mc-check.mjs` passes. Merged as its own PR.
2. **Phase 2, dig and build.** Tasks 2.1 to 2.5. Done when a tree becomes planks, a table and a pickaxe, a hut stands, and a reload finds it.
3. **Phase 3, light and the day.** Tasks 3.1 to 3.3.
4. **Phase 4, underground.** Tasks 4.1 to 4.4.
5. **Phase 5, mobs.** Tasks 5.1 to 5.3.
6. **Phase 6, biomes and builds.** Tasks 6.1 to 6.4.
7. **Phase 7, polish.** The list in the plan.

## Checking it

- The route: `#/dot-matrix/minecraft`. From the island: `#/dot-matrix`, walk to the crafting table beside the N64 in the square, press B.
- `?quality=low|mid|high` pins the tier (the render distance follows it: 4, 6, 10 chunks).
- In development `window.__RUNTIME__.current.world.game` is the sim; `.world.scene.chunks.stats()` says how many sections are loaded and drawn.
- The browser check: `npx vite --port 5188 --strictPort --host 127.0.0.1`, then `OUT=<folder> node scripts/mc-check.mjs` (headless Chromium draws in software: give it a minute).
- Gates: `npm run lint`, `npm test`, `npx vite build` (not `npm run build`: its prebuild rewrites `public/github.json`), `node scripts/autopilot-check.mjs --routes /dot-matrix/minecraft`.

## Gotchas

- **No Mojang asset in the repo.** The shipped textures are Pixel Perfection (XSSheep, CC BY-SA 4.0), built into `public/mc/` by `scripts/mc-atlas.mjs` from a download kept outside the repo. The visitor’s own pack or jar stays in their browser. If the owner produces a written Mojang permission, the vanilla pack goes through the same script; nothing else changes.
- The rules never import three.js: they run in the worker and in vitest.
- `src/data/modelCredits.json` is Sketchfab-only (its test checks the source URL); the pack is credited in `public/games/credits.json` and `public/cc0/README.md`.
- The Bash tool in the Claude desktop app strips backslashes from heredocs; write files with the Write tool.
- `npm ci` in a worktree needs `--ignore-scripts`.
