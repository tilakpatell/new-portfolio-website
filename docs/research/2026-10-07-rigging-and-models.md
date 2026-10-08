# Why the galaxy's models and rigs look bad, and what to do about it (2026-10-07)

Checked in the game (headless Chromium on Metal, `lab/look.mjs`) on Kashyyyk, Endor, Tatooine, Hoth, Naboo and Coruscant, and against the web.

## What's wrong, by how much it shows

1. **Riders.** Every ride put its rider's hips at a guessed height and played a car-driving or chair-sitting clip. On the speeder bike the hands held an invisible wheel and the legs hung to the ground; in the landspeeder the driver sat on the bodywork; on the tauntaun and the kaadu the legs went through the beast's neck. The rider also banked the opposite way to the bike and sat where the bike was a frame earlier (half a metre behind at full speed).
2. **Walkers with no legs.** The Kashyyyk AT-RT is one merged Sketchfab mesh with no skeleton and no rider. It glided along its patrol with the sway a person walks with, and talked as if it were someone. That's the "AT-RT as a player".
3. **The rig itself.** Meshy's auto-rig is 24 bones: no fingers, no twist bones. Hands are mittens round a gun, and forearms twist like a sweet wrapper. Every humanoid walks on one borrowed set of clips (Rick's), copied rotation for rotation, so big bodies (the Wookiees, the Gamorrean) hold their arms like a thin man's.
4. **The meshes.** Meshy text-to-3D figures have soft, blobby detail and lighting baked into their colours (the Wookiees' faces and fur most of all).

## Buying a pack: no

- There's no Star Wars asset pack anyone may put on a website. The only official kit is Fortnite's (UEFN islands only), and Fab bans Star Wars fan art.
- Generic sci-fi packs (Synty POLYGON Sci-Fi Space, $150; Military, $300) don't look like Star Wars. Their licences (Synty's EULA, the Unity Asset Store's, Fab's Standard License) want the files kept where players can't extract them, and a GLB a browser downloads is extractable.
- ActorCore motion packs have the same problem (the EULA wants shipped models in formats ordinary software can't open). Mixamo forbids redistributing raw files.

## What does help, cheapest first

1. **Seat the riders properly** (done here: `riders.js`). Each ride's seat, grips and pegs are measured off its model, and the rider's limbs are put on them with two-bone IK over the sat clip.
2. **One procedural walker rig** for the machines on legs (the AT-RT first): split the rigid model into parts at its joints, then step its legs by the ground it covers, with a rider in the saddle.
3. **Per-character clips from Meshy's animation library** (3 credits a clip, up to 10 a call, made on each character's own rig) in place of Rick's for the most-seen heroes. Needs the user's OK to spend.
4. **Re-rig the most-seen heroes** with fingers and twist bones: Mixamo (free, in the browser, 65 joints with fingers) or AccuRIG 2 (free, Windows, the best free weights). Manual, a few minutes a character.
5. **CC0 clips** to fill gaps: Quaternius UAL1 ($9.99 for all 120+) and UAL2 ($14.99, Feb 2026). CC0, so serving the GLBs is fine. Rokoko's 150 free moves allow commercial use.
6. **Better troopers**: rigged CC-BY clones on Sketchfab (Phase I and II, about 33–36k triangles, 2K maps) beat the remaster rips. They're fan art, so CC-BY doesn't clear Lucasfilm's rights; the site already takes that risk.
