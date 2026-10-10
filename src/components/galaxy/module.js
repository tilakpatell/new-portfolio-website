// The galaxy, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene. It draws
// with the runtime's renderer, at 1.5× at most as it always has, and
// softens through its post chain when frames run late, as the universe map
// does, so the canvas is never resized for it (`sharpness: 'own'`); what it
// tells the page comes out as rt.events; the page reaches the scene's own
// calls (jump, goTo, fire…) as rt.current.world.scene. Landing on a planet
// is a handover to ./surface/module.js (pages/Galaxy.jsx), and taking off
// is one back (pages/GalaxySurface.jsx).

import { fromScene } from '../../runtime/module';

export default fromScene('galaxy', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  mb: 18, // (WORLD_MB['/galaxy']: the galaxy and its worlds' surfaces)
  ratio: 1.5,
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
});
