# How strong WebGL portfolios are built, and what fits this site

Date: 2026-10-04. Two research passes: the source of 14 open-source portfolios and portfolio-adjacent repos (read with `gh api`), and a catalogue of current techniques from Codrops, studio case studies and shader blogs. Paths are `owner/repo/path`.

## What the best ones have in common

- **Heavy work offline, real-time effort only where the subject asks for it.** Bruno Simon bakes lighting and compresses everything (`brunosimon/folio-2025/scripts/compress.js`: gltf-transform, Draco, KTX2 presets per channel); `brunosimon/my-room-in-3d` is one mesh, one shader, three baked textures mixed for day and night, with lamps recoloured through lightmap channels. Lusion precomputes its simulations; Immersive Garden's David Whyte site uses a watercolour effect only because the subject is watercolour.
- **DOM first.** `bizarro/bruno-arizio` server-renders real HTML and draws over it; the canvas is `aria-hidden` and clicks go to real links. Sites whose headline exists only in WebGL (`mohitvirli/mohitvirli.github.io`) give that up.
- **No pop on reveal.** Keep the poster underneath, wait for fonts, `renderer.compileAsync()` and `renderer.initTexture()`, draw one frame, then fade (`brunosimon/folio-2025/.../PreRenderer.js` warms shaders with a 32 px cube camera; `HamishMW/portfolio/components/model/model.jsx` cross-fades from a placeholder texture).
- **Restraint in post.** One merged final pass at most (bloom 0.25, tilt-shift, grain); MSAA off at pixel ratio 2 or more (`folio-2025/Rendering.js`, `darkroomengineering/satus/components/canvas/webgl.tsx`).
- **Frame-rate independent motion.** `1 - exp(-k * dt)` smoothing, dt clamped; fixed-factor lerps run twice as fast at 120 Hz (`klevron/threejs-toys`, `bruno-arizio/Home/index.js`).
- **Adaptive quality with hysteresis.** Pixel ratio steps of 0.25 between 0.75 and 2 (bizarro's notes), or drei's `PerformanceMonitor` flip-flop detection, rather than one drop.

## Architecture lessons for a site with several lazy scenes

- Separate canvases inside each element's own box (this site's `useScene`) scroll with the page for free, with no lag. A single fixed canvas only stays in step when scrolling runs through JavaScript (Lenis) and the frame loop applies it before rendering (`14islands/r3f-scroll-rig` README; `satus/components/raf/index.ts`), which costs frames on phones.
- The costs of separate canvases: no shared shaders or textures, and Chrome keeps about 16 live contexts per page (about 8 on Android), killing the oldest silently. Dropping scenes that are far away (as `useScene` does) keeps the count low.
- Move to one shared canvas (scissor views, `pmndrs/drei/src/web/View.tsx` style, but with rects cached on resize instead of measured every frame) only when two or more scenes are on screen at once, an effect must cross sections, or one post pass should cover everything. A hybrid suits this site: one-off heavy scenes keep their own context; small repeated ones could share.
- WebGL planes locked to DOM images: cache document rects on resize, subtract scroll each frame, 1 unit = 1 CSS px (`akella/webgl-mouseover-effects/js/scene.js`, `satus/hooks/use-webgl-rect.ts`).

## Techniques, judged for this site (5 = signature fit, 1 = avoid)

| Technique | Fit | Notes and where |
|---|---|---|
| Line and edge rendering: `Line2` fat lines with animated dashes, `EdgesGeometry`, a `fwidth` blueprint grid (`folio-2025/.../MeshGridMaterial.js`) | 5 | The site's own language. Experience diagrams: lines draw first, faces fill in behind. |
| Time-of-day grading: per-photo colour statistics or 3D LUTs, blended in linear light (three's 3D LUT example; GPU Gems 3 ch. 24) | 5 | Akshardham day: the light changes before the photo does. |
| Brightness- or noise-ordered dissolves (gl-transitions; Codrops 2025 shader image transitions) | 4 | Akshardham: night arrives in the dark areas first, lamps last. |
| Depth-map 2.5D parallax (Depth Anything, 512 px 8-bit depth, ~1.5% shift, dilated edges; Codrops "fake 3D image") | 4 | Travel hero and photo bands; fog can sit in the valleys. Needs depth maps made offline. |
| Ordered dithering and halftone (Maxime Heckel's dithering and halftone posts; Codrops Bayer backgrounds) | 4 | A printed edge on transitions, photos developing while they load. |
| Screen-space reveal masks (Codrops on-scroll reveals; "The Sleepers", 2026) | 4 | Role banners arriving in a stepped grid that echoes the brackets. |
| Matcap or baked shading, contact shadows | 4 | Cheap "rendered" look for the diagrams. |
| SDF text (troika-three-text) | 3 | Labels inside 3D only; headings stay in the DOM. |
| Hover distortion and ripple | 2 | Dated and absent on phones. One exception: a single ring when "Ring the bell" is pressed. |
| Water and caustics inside a still photo | 2 | Uncanny unless extremely subtle. |
| Shader gradient backgrounds | 2 | Only as one accent at under 6% contrast, dithered, moving with scroll. |
| GPU particle morphing | 2 | Heavy on phones; the globe and hyperspace already cover "spectacle". |
| Persistent-canvas page transitions | 2 | Lots of architecture; View Transitions can move a photo into the lightbox without WebGL. |
| Sound-reactive visuals | 2 | Only for a sound the visitor chose to play. |
| Glass and refraction (`MeshTransmissionMaterial`) | 1 | Extra render per material; the stock "3D website" look since 2023. |
| Scroll-velocity bends | 1 | Motion without a reason; fights skimming recruiters. |
| Fluid cursor trails | 1 | Copied everywhere since 2017, full-screen simulation every frame, nothing on touch. |
| Gaussian splats | 2 | Needs a capture and 10 to 50 MB files. |

## Sources

- Repos: `brunosimon/folio-2019`, `brunosimon/folio-2025`, `brunosimon/my-room-in-3d`, `henryjeff/portfolio-website`, `14islands/r3f-scroll-rig`, `pmndrs/drei`, `darkroomengineering/satus`, `darkroomengineering/lenis`, `bizarro/bruno-arizio`, `HamishMW/portfolio`, `oframe/ogl`, `akella/webgl-mouseover-effects`, `klevron/threejs-toys`, `mohitvirli/mohitvirli.github.io`, `Giats2498/giats-portfolio`.
- Write-ups: [Bruno's portfolio case study](https://www.awwwards.com/brunos-portfolio-case-study.html), [Lusion case study](https://www.awwwards.com/case-study-for-lusion-by-lusion-winner-of-site-of-the-month-may.html), [Igloo Inc case study](https://www.awwwards.com/igloo-inc-case-study.html), [David Whyte experience](https://www.awwwards.com/case-study-david-whyte-experience-by-immersive-garden.html), [Joyco on WebGL scroll sync](https://hub.joyco.studio/logs/08-webgl-scroll-sync), [Maxime Heckel on dithering](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/), [Heckel on Moebius-style post](https://blog.maximeheckel.com/posts/moebius-style-post-processing/), [gl-transitions](https://github.com/gl-transitions/gl-transitions), [Codrops shader image transitions (2025)](https://tympanus.net/codrops/2025/01/22/webgl-shader-techniques-for-dynamic-image-transitions/), [Codrops on-scroll reveals](https://tympanus.net/codrops/2024/02/07/on-scroll-revealing-webgl-image-explorations/), [Codrops fake 3D image](https://tympanus.net/codrops/2019/02/20/how-to-create-a-fake-3d-image-effect-with-webgl/), [three.js 3D LUT example](https://threejs.org/examples/#webgl_postprocessing_3dlut), [GPU Gems 3: The Importance of Being Linear](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-24-importance-being-linear), [IQ on domain warping](https://iquilezles.org/articles/warp/), [awesome-casestudy](https://github.com/luruke/awesome-casestudy).
