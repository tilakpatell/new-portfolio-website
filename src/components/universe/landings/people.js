// People standing about a landing (a thing of kind 'figure' in landings.js):
// the site's own figures, standing where they are, facing the ship as it
// comes down. A Meshy figure of the site's own (`url`: Albuquerque's people,
// the office's, Jack, Mark, Bumblebee) stands as Albuquerque's town stands
// the very same figures (office/people.js's 'stand': the arms down by the
// sides, breathing, the head looking round now and then), not on the crews'
// borrowed idle, which is Meshy's restless one: it swings the hips most of a
// right angle and stoops, which on someone who's waiting to say a line reads
// as turning away. One of Portal panic's cast (`meshy`: Beth, Jerry, Summer,
// the President…) idles on its own clips, as it does in its own world. A
// soft dark spot under each, as the crews have, so they stand on the ground
// rather than over it.
//
// They know you're there (footLife.js's greetStep): within a few metres
// they turn to face you and look at you; the first time you come within
// their say radius they wave (Jesse cheers: "Yeah, science!"), and while
// their line's shown they talk with their hands (the cast on the library's
// talk clip, the site's own with a nod and a shrug). The player's head
// comes in through furnish's update(t, dt, ctx): ctx.me, in the world.
//
// figure(kit, { url | meshy, tall, reach, line }) → { object (in metres), solids, update } | null

import * as THREE from 'three';
import { loadPartyFigure } from '../footScene';
import { createMeshyCast } from '../../rickmorty/portal/meshyCast';
import { loadPeople } from '../../office/people';
import { sharpenMaterial } from '../../../lib/three/textures';
import { METRE } from '../foot';
import { greetStep } from '../footLife';
import { faceStep } from './face';
import { budgetClock, createAnimBudget } from '../../../lib/three/animBudget';

// a soft dark spot on the ground under someone (as footScene's crews have),
// one texture for the landing's people, freed with the kit
function spotUnder(k, tall) {
  k.blob ??= k.own(
    (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.26)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })(),
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: k.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.name = 'spot';
  mesh.position.y = 0.01;
  mesh.scale.setScalar(tall * 0.5);
  mesh.renderOrder = 1;
  return mesh;
}

// how often a landing's people are stepped (lib/three/animBudget): every
// frame within a dozen metres of you, every second out to forty, every
// fourth past that (or with no one about: on the way down). One budget a
// landing, its round begun again each frame (by the frame's clock, which
// every one of them is handed); it's asked how far off each is as you at
// the middle and it along x, as far as faceStep finds it.
const ME = { position: { x: 0, y: 0, z: 0 } };
let stood = 0; // (each one's place in the budget's round)
function budgetOf(k, t) {
  const b = (k.anim ??= { budget: createAnimBudget({ near: 12, far: 40 }), t: null });
  if (b.t !== t) {
    b.t = t;
    b.budget.frame();
  }
  return b.budget;
}

// one of the site's figures, stood as the town stands it
async function standing(k, url, tall) {
  const spec = { id: url, model: url, height: tall };
  const cast = await loadPeople([spec]).catch(() => null);
  const p = cast?.person(spec, { pose: 'stand', idle: true });
  if (!p) {
    cast?.dispose();
    return null;
  }
  k.own(cast);
  // (the cloth's print sharp at a slant: the tier's anisotropy)
  p.group.traverse((o) => o.isMesh && sharpenMaterial(o.material));
  const cheers = /\/jesse\.glb$/.test(url); // ("Yeah, science!")
  return {
    object: p.group,
    // what it does as you come and go (the outer `figure` turns it to face you)
    life(ctx, { wave, talk, look, t }) {
      p.look(look ? ctx.me : null);
      if (wave) cheers ? p.cheer() : p.wave();
      if (talk) return { nod: t + 1.7, shrug: talk > 3 ? t + 3.3 : null };
      return null;
    },
    said(st, t) {
      if (st.nod != null && t >= st.nod) {
        p.gesture('nod');
        st.nod = null;
      }
      if (st.shrug != null && t >= st.shrug) {
        p.gesture('shrug');
        st.shrug = null;
      }
    },
    update: (t, dt) => p.update(t, dt),
  };
}

// one of Portal panic's cast, on its own clips
async function idling(k, meshy, tall) {
  // (one cast a landing, freed with the kit)
  const cast = (k.cast ??= k.own(createMeshyCast()));
  await cast.load(null, [meshy]).catch(() => {});
  const fig = await loadPartyFigure({ id: meshy, name: meshy, tall, src: { meshy } }, cast).catch(() => null);
  if (!fig) return null;
  const inner = new THREE.Group();
  inner.scale.setScalar(1 / METRE); // (the party's figures are in the map's units)
  inner.add(fig.model);
  // a little out of step with each other
  let lag = Math.random() * 2;
  const settle = (r) => r?.catch?.(() => {});
  return {
    object: inner,
    life(ctx, { wave, talk, look, t }) {
      fig.look?.(look ? ctx.me : null);
      if (wave) settle(fig.play?.('wave', { layer: 'upper' }));
      // (the talk after the wave's had its moment, on the arms, for the line's length)
      if (talk) return { talkAt: t + 1.6, talkFor: talk };
      return null;
    },
    said(st, t) {
      if (st.talkAt != null && t >= st.talkAt) {
        settle(fig.play?.('talk', { layer: 'upper', loop: true, lasts: st.talkFor }));
        st.talkAt = null;
      }
    },
    update(t, dt) {
      if (lag > 0) {
        lag -= dt;
        fig.update(Math.max(0, -lag), 0);
        return;
      }
      fig.update(dt, 0);
    },
  };
}

export async function figure(k, { url = null, meshy = null, tall = 1.8, reach = 3, line = null } = {}) {
  const made = meshy ? await idling(k, meshy, tall) : url ? await standing(k, url, tall) : null;
  if (!made) return null;
  const object = new THREE.Group();
  object.name = 'figure';
  // (turned on the spot to face you, as a person would, inside where it stands)
  const turn = new THREE.Group();
  turn.add(made.object);
  object.add(turn);
  made.object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  object.add(spotUnder(k, tall));
  const face = {};
  let greet = {};
  let saying = null;
  // (its own place in the budget's round, so they aren't all stepped on the same frame)
  const clock = budgetClock((stood += 1));
  const at = { x: 0, y: 0, z: 0 };
  return {
    object,
    solids: [{ circle: [0, 0, 0.35] }],
    update(t, dt, ctx) {
      const { d, seen } = faceStep(face, object, turn, ctx, dt);
      const g = greetStep(greet, { d, r: reach, t, line });
      greet = g.st;
      const next = made.life?.(ctx, { wave: g.wave, talk: g.talk, look: seen, t });
      if (next) saying = next;
      if (saying) made.said?.(saying, t);
      at.x = d;
      const step = clock(budgetOf(k, t).rate(at, ME), dt);
      if (step > 0) made.update(t, step);
    },
  };
}
