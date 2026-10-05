# A better Captain America? (cap-hd)

**Verdict: nothing clears the bar. No model is delivered.** None of the Sketchfab Captain Americas that are downloadable under a free licence look clearly better than the current `cap.glb` and also hold up next to the HD Spider-Man while walking and running. The realistic ones are the same mobile-game class as the current Cap and have no skeleton. The ones with real fidelity are Marvel Rivals rips, with a bulky, stylised build that's further from the MCU than what we have and clashes with Spider-Man. Following the brief, I'm not swapping in another mediocre Cap: until something better turns up, the player stays Spider-Man.

## How I looked

- I searched the Sketchfab Data API v3 (`downloadable=true`) in two rounds. The first round ran 25 queries, each with and without `sort_by=-likeCount`, `animated=true` and `rigged=true`: "captain america", "steve rogers", "cap mcu", "endgame captain america", "captain america rigged", "first avenger", "winter soldier captain", "civil war", "infinity war", "marvel rivals", "mixamo" and others. The second round paged through "captain america", "steve rogers" and "captain america rigged" to the end (15 pages each), then ran 33 more queries: "capitan america", "capitão américa", "chris evans", "steve rogers endgame", "super soldier", "brave new world", "Marvel's Avengers / MUA / Strike Force / Contest of Champions captain america", "captain america unreal / pbr / high poly / hd", and so on. That came to roughly 230 unique hits. After dropping shields, helmets, toys, busts, prints and the NC, ND and Standard licences, about 60 were character models (`field-round1.jpg`, `field-round2.jpg`).
- I downloaded 19 and rendered them with three.js r180 in headless Chromium (SwiftShader). The setup matched the world: its own sky `public/hq/sky/airfield/env.hdr` as the environment, Neutral tone mapping, a sun with soft shadows, and every model scaled to 1.9 m (Spider-Man to his 1.72 m). The views were the **world's own chase camera** (fov 52, 7.5 m back, pitch 0.2, aimed at y = 1.85, cropped at true 720p pixel size), a three-quarter close-up, and front, side and back.
- The strongest rigged candidate went through the real pipeline (`scripts/sketchfab-avengers.mjs`: retargeted idle, walk, run and jump; simplified to 61k triangles; 2048 textures) and was judged in motion against the current Cap.

## The sheets

| file | what |
| --- | --- |
| `stills-realistic.jpg` | the current Cap, Spider-Man and the three most realistic Caps (all unrigged) |
| `stills-hd-rivals.jpg` | the current Cap, Spider-Man and the high-fidelity Marvel Rivals Caps, including YEEZY_YE's *Infinity War* **after processing** (61k) |
| `motion-current-cap.jpg` | the current Cap's walk and run, 6 frames each, from the side and from behind |
| `motion-yeezy-iw.jpg` | the same for YEEZY_YE's *Infinity War* Cap, retargeted |
| `field-round1.jpg`, `field-round2.jpg` | Sketchfab thumbnails of everything shortlisted |

## What the sheets show

**The current Cap is not the weak link it seemed.** Rendered under the world's sky, alexseagle2004's *Age of Ultron* Cap is a clean, recognisable MCU Cap: the star, the stripes, the A helmet and the harness. Its retargeted walk and run (`motion-current-cap.jpg`) have no twisted shoulders and no pinched knees. The run is a little hunched. At the chase camera, every candidate is a 170-pixel figure, and the differences between the realistic ones disappear. So if Cap looks "horrible" in the world, the cause is probably the world's treatment of him (his lighting and materials in the scene, texture size after import, or the hunched run) rather than the mesh. A replacement from Sketchfab wouldn't fix that.

**Best near-misses:**

1. **YEEZY_YE, [Captain America – Infinity War](https://sketchfab.com/3d-models/captain-america-infinity-war-177493bced404e6caa890748023410e7)** (CC BY 4.0; 149k → 61.5k triangles; 30 textures, at most 1024; Unreal rig with 615 bones). This is the one the brief suggested revisiting, and the only candidate with real fidelity *and* a rig. It processes cleanly: 3.3 MB, all four clips retargeted, and the walk and run look sound (`motion-yeezy-iw.jpg`). Decimating to 61k costs nothing visible. **But it is the Marvel Rivals *Infinity War* skin, not the film's.** It has a hugely inflated torso and shoulders, a small head, a stylised painterly face, and a bulky silhouette. From the chase camera it reads as a dark, blocky figure with less "Cap" in it (no stripes, no star from behind) than the current model, and next to the slim, clean Spider-Man it looks like it's from another game. It's better made but not a better Cap for this world. It's still the near-miss to take if Tilak decides he wants the Rivals look. In that case, the script entry is one line: `'cap-hd': { file: 'cap-hd.glb', h: 1.9, anims: ['basic', 'puppet'], tex: 2048, tris: 60000, as: … }`, with the download saved as `cap-hd.glb` next to the anim files.
2. **Shivam.Yadav, [Captain America](https://sketchfab.com/3d-models/captain-america-6fb3a130736a450fa13fec269f5611b4)** (CC BY 4.0; 15.7k triangles; *Infinity War* suit and beard). It has the best realistic face of the lot, but it's the same Future Fight class as the current Cap: not clearly better, only different. It also has **no skeleton** (it faces +x in an A-pose), so it would need rigging by hand.
3. **Oknerd, [Captain America – Marvel Cinematic Universe](https://sketchfab.com/3d-models/captain-america-marvel-cinematic-universe-49c831cb04a544cfabf40bf943da782e)** (CC BY 4.0; 6.7k triangles; *Endgame* suit). It's a nice suit, but it has fewer triangles than the current Cap, no skeleton, and the download includes a shield and Mjolnir. It also needs spec-gloss → metal-rough conversion, because three r180 no longer reads `KHR_materials_pbrSpecularGlossiness`. Its own metadata credits **MakeEz**, so it's a re-upload of the MakeEz Cap that the first round rejected for having no skeleton.

**Also rejected:**
- **YEEZY_YE's Season 4 and Rivals default Caps, and Personb718's Rivals Cap**: the same bulky Rivals build, and comic-classic or sci-fi rather than MCU. The Season 4 Cap also needs spec-gloss conversion.
- **hreedbgomes's Cap** (18k): a good *Winter Soldier*-era face, but one mesh with the shield fused to the arm, and no rig.
- **joencesimpson's** (26k): a good face, but frozen in a fighting stance with the shield attached, and no rig.
- **Barbados's "Capitan America"** (Mixamo, with its own walk and idle): the bright classic comic suit, glossy and toy-like.
- **yongtun's** (158k): a comic-book classic.
- **erlan.aripbay's** (51k): a faceless, plastic look.
- **3dworldz's rigged Cap**: a steampunk Future Fight variant.
- **moktadir's** (35k): a T-pose game rip, no better than the current one.
- **Fortnite**, **Disney Infinity**, **Fall Guys** and the voxel, Funko and toy variants.
- **hwk10037's two "AOU" Caps**: re-uploads of the current mesh (12,929 triangles).

## What would actually clear the bar

There's nothing on Sketchfab under CC BY or CC0 today. A realistic, film-accurate Cap with a game-ready rig would have to come from somewhere else. One option is a paid or commissioned model. Another is a hand-rigged Shivam or Oknerd mesh, but those are the same tier as the current Cap. Both are outside this search. If the current Cap looked "horrible" in the world, it's worth checking its material and lighting there first: in neutral light, the mesh itself holds up.

Nothing in `public/`, `src/` or `scripts/` changes.
