# Hand-off: Minecraft itself, behind a password (Eaglercraft)

On 2026-10-07 the owner asked for the real game at the island's crafting table, password-protected, the newest version that genuinely runs in a browser. The from-scratch tribute (`HANDOFF-minecraft-world.md`) is frozen at Phase 4 and stays behind "Walk the tribute". The code is in `src/components/eagler/`; `docs/architecture.md` has a paragraph under *Minecraft's world*.

## Done

- **The lock.** GitHub Pages has no server, so the game files are sealed with the password (`crypt.js`: PBKDF2-SHA-256, 600,000 rounds, into an AES-GCM key and an HMAC key; each file's nonce is the HMAC of what it holds, so an unchanged file seals to the same bytes and a rebuild adds nothing to git). The repository has only the sealed files, the salt and a sealed check line (`public/eagler/manifest.json`), never the password. "Remember on this device" keeps the derived key in localStorage (or for the visit, in sessionStorage); "Lock" forgets it.
- **The clients** (`clients.js`, newest first):
  - **1.12.2**: PeytonPlayz585's port, update 3 (`Eaglercraft_1.12.2_u3_Offline.zip`, cdn.eaglercraft.net). The offline HTML is 83.4 MB; gzipped and sealed it's 23.3 MB.
  - **1.8.8**: lax1dude's signed EaglercraftX 1.8 u53 (`EaglercraftX_1.8_u53_Offline_Signed.zip`, cdn.eaglercraft.net). 18.0 MB, 13.5 MB sealed. Its options are "hints"; it has no countdown to remove.
  - Each keeps its own worlds database and settings namespace (`tp_worlds_1_12`, `tp_1_12`, …).
- **The page** (`Eaglercraft.jsx`): password, then a play button and a note for each version, a progress bar (with Cancel), the game, full screen, and Leave (which asks once: a world is only safe after Save and Quit). It also offers each shared world to download (see below). A failed manifest offers Try again and the tribute.
- **The player, walled off.** The game runs in a frame on an origin of its own: `public/eagler-player/index.html`, published by `node scripts/eagler-player-publish.mjs` to the public repository tilakpatell/minecraft-player (GitHub Pages, https://tilakpatell.github.io/minecraft-player/). It holds no game file and no secret. It says it's ready; the site sends it, by `postMessage` to that origin only, the stretched key and the sealed file's address; it fetches the file from the site (GitHub Pages allows it), opens it with the site's own `crypt.js` and `load.js`, and becomes the game. So the game's code can't reach tilakpatell.com's page or storage (the Dickansh page keeps its password in sessionStorage for the visit), and the game's saves live on github.io. In development the site runs at 127.0.0.1 and the player at localhost: two origins on one dev server. **Republish the player whenever `public/eagler-player/`, `crypt.js` or `load.js` changes.** Wired to `/dot-matrix/minecraft` (`src/pages/Minecraft.jsx`) and to the island's overlay (`DotMatrixWorld.jsx`, `'minecraft'`, with the tribute as `'mc-tribute'`).
- **Checks.** `scripts/eagler-check.mjs` (below) tries a wrong password, unlocks, plays a client, proves from inside the game's frame that it's walled off (its own origin, no reach into the site's page, none of the site's storage), and screenshots it. Both versions start with no page errors. A public LAN relay that's down (relay.deev.is was answering 502) is reported as a note, not a failure.
- **A shared world, "The Plaza"** (1.12.2, `public/eagler/worlds/the-plaza-1-12-2.bin`, 2.0 MB sealed). Made on 2026-10-07 with Mojang's vanilla 1.12.2 server (seed `tilakpatell.com`, plains at spawn), not exported from Eaglercraft: at the spawn, an 11 × 11 stone-brick and oak plaza at y 63 (x −17 to −7, z 251 to 261), torches on fence posts at the corners, a crafting table and a chest of stone tools, bread, torches, logs and a bed, and a sign reading "Welcome to tilakpatell.com / Have fun!". The world spawn is set on the plaza (−12, 64, 252) with `spawnRadius` 0, and `LevelName` in `level.dat` is "The Plaza" so it imports under that name. Zipped as `world/…` (no `level.dat_old` or `session.lock`) and sealed with `--world "1.12.2:The Plaza=<world.zip>"`. Checked in headless Chromium: the page's "Get the world" hands over the zip byte for byte, and Singleplayer → Create New World → Import Vanilla World → Continue imports it; playing it spawns on the plaza facing the sign, with no page errors (headless refuses pointer lock without a click; that's the browser, not the world). To replace it, seal another world under the same name (or a new one beside it). **1.8.8 has The Plaza too** (`public/eagler/worlds/the-plaza-1-8-8.bin`, 3.0 MB sealed), made the same way with the vanilla 1.8.8 server (same seed, same spot, same plaza). 1.8.8 has no `spawnRadius` and scatters a survival spawn up to 10 blocks, so its paving runs the whole 21 × 21 around the spawn (x −22 to −2, z 242 to 262, grass and flowers cleared) and a player always lands on stone. The 1.8.8 importer names the world after the zip's file name, which the page hands over as "The Plaza.zip". Checked the same way: byte-for-byte download, all 625 chunks import, and play lands on the paving beside the plaza. (Headless at a few frames a second, the game misses instant clicks: press, hold 300 ms, release.)
- **Reviewed.** An adversarial review (4 lenses, each finding checked by 3 skeptics) confirmed 18 findings, all fixed:
  - the lock stretches the password once and expands it with HKDF;
  - Cancel and Leave stop everything;
  - a typo'd password can't re-key the site (`--new-password`);
  - the packer writes nothing until all of it has succeeded, and seals the same bytes on every machine;
  - worlds and their arguments are checked first;
  - the game is walled off.

## Left

1. **The 1.21.11 beta** (only ever in the walled-off player). Syntaxsavy's "Eaglercraft 1.21.11 (u1-beta)" is a genuine port: its WASM holds real 1.21.11 classes (the nautilus and copper golem models, the spear advancement) and the vanilla 1.21.11 lang. It has no source, though, and is spread anonymously (Mediafire `Eaglercraft_1.21.11_WASM_Offline_Download (7) (1).html`, 46.58 MB, re-shared from Discord). It needs WebAssembly GC with JSPI (Chrome and Edge 137+), players report it heavy and laggy, and it has no world import/export and no LAN. The assistant won't download an anonymous binary itself; the owner fetches it. Then:
   1. Save it to `C:/Users/tilak/Downloads/eagler/`.
   2. Inspect it as text before shipping: version strings, external hosts, no miners.
   3. Check that its `worldsDB: "worlds",` patch matches (`CLIENTS['1.21.11']`; the build fails loudly if not).
   4. Seal it with `--client "1.21.11=<file>"` alongside the other two.
   5. The page greys it out where `WebAssembly.Suspending` is missing.
2. **More shared worlds.** Export one from the game (Singleplayer → select it → Backup → Export as EPK; or zip a vanilla world) and seal it with `--world "<client>:<Name>=<file.epk or .zip>"` beside The Plaza; a 1.8.8 world shows under 1.8.8. Each player gets their own copy; a world everyone plays at once needs the server (3).
3. **A live shared server** (ask the owner first: it runs on their machine). EaglerXServer (lax1dude, github.com/lax1dude/eaglerxserver) on Velocity, in front of a 1.12.2 Paper server (the 1.21.11 beta speaks the Eagler V5 handshake and would want a 1.21.11 backend). Expose it with a tunnel (Cloudflare Tunnel or playit.gg) as `wss://…`, add it to each client's `servers` option through a patch, and back the world up to GitHub on a schedule (the desktop's self-hosted runner can do that).
4. **Open to LAN** already works in 1.12.2 and 1.8.8 through Eaglercraft's public relays (lax1dude's and ayunami's). Nothing to build.

## Rebuilding

The offline clients stay outside the repository (the session put them in its scratchpad). Get them again from cdn.eaglercraft.net (`objects/dl/1.12.2/Eaglercraft_1.12.2_u3_Offline.zip`, `objects/dl/1.8.8/EaglercraftX_1.8_u53_Offline_Signed.zip`), unzip, then:

    EAGLER_PASSWORD=<the password> node scripts/eagler-pack.mjs --client 1.12.2=<…/Eaglercraft_1.12.2_u3_Offline.html> --client 1.8.8=<…/EaglercraftX_1.8_u53_Offline_Signed.html>

The password must open the manifest that's there (a typo is refused). Unchanged clients keep their sealed bytes. To change the password (or after the lock's format changes), add `--new-password` and name every client and world. `EAGLER_OUT=<folder>` seals somewhere else for a trial. Nothing is written unless the whole run succeeds.

Check it with the dev server up:

    EAGLER_PASSWORD=<…> BASE=http://127.0.0.1:5191 OUT=<folder> GPU=1 CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/eagler-check.mjs [1.12.2|1.8.8]

## Gotchas

- **The owner's decisions:** they say the textures and the game are used with Mojang's permission, and they want no credit lines on the site. The clients' own built-in credits screens stay as they ship.
- **Newer versions:** nothing newer than 1.12.2 is complete. "26.2 zeus" and most "1.21" pages are relabelled older clients; "EaglercraftX 1.19" is a relabelled 1.8.8 u27 with a red-flag server repo; rikky1111/Eaglercraft_1.21.11 is a README. The genuine 1.21.11 port is the beta above. A from-scratch port of modern Minecraft is years of work (the 2026-10-07 spike session measured it: see the shared notes folder, `port-1.21-spike.md`).
- **The Bash tool strips backslashes in heredocs:** write files with the Write or Edit tool.
- **The game takes the keyboard** while its frame has focus: Leave and full screen are buttons, top right.
