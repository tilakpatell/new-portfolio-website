// Who's about on a world: Jawas round their sandcrawler, banthas grazing,
// stormtroopers on patrol, Ewoks in their village, Gamorreans at a Hutt's gate.
// Each wanders near its home (stopping, looking about, going on), or walks
// its beat (a patrol's path, round and round), or stands where it was put;
// someone with something to say turns to you as you come up, and says it
// when you ask (the scene shows it).
//
// A kind with a model (catalog/*.js) is that model (walking with its own
// clips, if it came rigged); otherwise figures.js builds it, or props/*.js
// does (a walker: an AT-AT, an AT-ST, its legs going as it goes). `model:
// false` builds it even where there's a model (a walker that should walk).
//
// site.life: [{ kind, n, at: [x, z], spread, roam, speed, path, still,
//   face, y (hovering: a probe droid), name, says: [line…] (a line: text,
//   or [who, text]), voice (the voice their own lines are said in, where it
//   isn't their name's: voicelines.js; `says` can be talk.js's tree, by
//   the state of things), scale, solid, id (a quest's name for them), quest (the
//   quest they give: quests.js's), reach (talked to from this far: a Hutt
//   on his dais), level (the height of the floor they're on, where there
//   are floors over floors), hidden (not there till a quest says), dive
//   (over the sea, a glide that dives into it now and then: an aiwha;
//   floats.js's diveAt options, its heights over the water), needs
//   (needs.js: the kinds of the site's `wants` it goes to), fears / chases
//   (actor kinds it runs from, or goes after, when it has seen them) }]
// site.wants: [{ id, kind, at: [x, z], pause? }] (where the people go)

import * as THREE from 'three';
import { SURFACE_MODELS, surfaceUrl } from './catalog';
import { buildFigure } from './figures';
import { crewFigure } from './crew';
import { PROPS } from './props';
import { cloneModel, loadGlb } from './placer';
import { rng } from './noise';
import { groundAt, lineClear, turnToward } from './walker';
import { pickWant, relate } from './needs';
import { talkFor } from './talk';
import { zoneVisibility } from './near';
import { diveAt } from './floats';
import { heldBlade } from './heldBlade';

const TALK = 4.5; // metres: close enough to turn to you

// a brain: where it's going and what it's doing (pure)
export function brain(spec, home, r) {
  return {
    x: home[0],
    z: home[1],
    yaw: spec.face ?? r() * Math.PI * 2,
    home,
    speed: 0,
    to: null,
    wait: r() * 4,
    leg: 0, // the path point it's walking to
    visited: {}, // when it was last at each want (needs.js)
    last: null,
  };
}

// a step of it: on to where it's going, or a pause, or somewhere new
export function think(b, spec, dt, r, { avoid = null, wants = null, t = 0 } = {}) {
  let pace = spec.speed ?? 1.2;
  if (spec.still) {
    b.speed = 0;
    return;
  }
  // someone it fears in sight: away from them, at a run; someone it goes
  // after: toward them (needs.js's relate set these)
  if (b.flee && t < b.flee.until) {
    const a = Math.atan2(b.x - b.flee.from[0], b.z - b.flee.from[1]);
    b.to = [b.x + Math.sin(a) * 8, b.z + Math.cos(a) * 8];
    b.wait = 0;
    pace *= 1.6;
  } else if (b.flee) b.flee = null;
  else if (b.chase && t < b.chase.until) {
    b.to = [...b.chase.to];
    b.wait = 0;
    pace *= 1.3;
  } else if (b.chase) b.chase = null;
  if (!b.to) {
    b.wait -= dt;
    b.speed = Math.max(0, b.speed - dt * 3);
    if (b.wait > 0) return;
    const want = spec.needs ? pickWant(spec, wants, b, t, r) : null;
    if (want) {
      b.to = [want.at[0], want.at[1]];
      b.want = want;
    } else if (spec.path) {
      const p = spec.path[b.leg % spec.path.length];
      b.leg += 1;
      b.to = [p[0], p[1]];
    } else {
      const a = r() * Math.PI * 2;
      const d = (0.3 + r() * 0.7) * (spec.roam ?? 12);
      b.to = [b.home[0] + Math.cos(a) * d, b.home[1] + Math.sin(a) * d];
    }
  }
  const dx = b.to[0] - b.x;
  const dz = b.to[1] - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.6) {
    b.to = null;
    b.wait = spec.path ? (spec.pause ?? 0.5) : 2 + r() * 6;
    if (b.want) {
      // (there: it stays a while, and remembers)
      b.wait = b.want.pause ?? 6;
      (b.visited ??= {})[b.want.id] = t;
      b.last = b.want.id;
      b.want = null;
    }
    return;
  }
  b.yaw = turnToward(b.yaw, Math.atan2(dx, dz), 3 * dt);
  b.speed = Math.min(pace, b.speed + dt * 2);
  // (it only goes the way it's facing, so it turns before it sets off)
  const ahead = Math.cos(b.yaw - Math.atan2(dx, dz));
  const step = b.speed * Math.max(0, ahead) * dt;
  let nx = b.x + Math.sin(b.yaw) * step;
  let nz = b.z + Math.cos(b.yaw) * step;
  if (avoid?.(nx, nz)) {
    // something in the way: somewhere else (a want it can't get to, not again next)
    b.to = null;
    b.wait = 0.5 + r();
    if (b.want) {
      b.last = b.want.id;
      b.want = null;
    }
    nx = b.x;
    nz = b.z;
  }
  b.x = nx;
  b.z = nz;
}

// A kind's model (catalog/*.js) as a figure that walks: with its own clips
// where it came rigged (an idle and a walk, or only one of them), or a bob
// in its step where it didn't; null without a model
export async function modelFigure(kind) {
  if (!SURFACE_MODELS[kind]) return null;
  const gltf = await loadGlb(surfaceUrl(kind));
  if (!gltf) return null;
  const model = cloneModel(gltf);
  const anim = SURFACE_MODELS[kind].anim;
  let mixer = null;
  const act = {};
  if (anim && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    for (const [name, clipName] of Object.entries(anim)) {
      const clip = gltf.animations.find((c) => c.name === clipName);
      if (!clip) continue;
      act[name] = mixer.clipAction(clip);
      act[name].play();
      act[name].setEffectiveWeight(name === 'idle' ? 1 : 0);
      act[name].time = Math.random() * clip.duration;
    }
  }
  let t = Math.random() * 10;
  const box = new THREE.Box3().setFromObject(model);
  const tall = box.max.y - box.min.y;
  return {
    model,
    tall,
    update(dt, move) {
      if (mixer && act.idle && act.walk) {
        const walkW = Math.min(1, move * 3);
        act.idle.setEffectiveWeight(1 - walkW);
        act.walk.setEffectiveWeight(walkW * (act.run ? 1 - Math.max(0, move - 0.6) * 2.5 : 1));
        act.run?.setEffectiveWeight(Math.max(0, move - 0.6) * 2.5);
        mixer.update(dt);
      } else if (mixer && act.walk) {
        // a walk and nothing else: it walks while it's going, and
        // stands where its stride stopped
        act.walk.setEffectiveWeight(1);
        act.walk.timeScale = move > 0.05 ? 0.5 + move : 0;
        mixer.update(dt);
      } else if (mixer) {
        // an idle and nothing else: it idles, and the bob walks it
        mixer.update(dt);
        t += dt * (2 + move * 7);
        model.position.y = Math.abs(Math.sin(t)) * 0.03 * move * tall;
      } else {
        // a model that doesn't move its legs: a bob in its step, a sway
        t += dt * (2 + move * 7);
        model.position.y = Math.abs(Math.sin(t)) * 0.04 * move * tall;
        model.rotation.z = Math.sin(t) * 0.03 * move;
      }
    },
    dispose() {
      mixer?.stopAllAction();
    },
  };
}

// one of props/*.js's, walking: its update(t, dt, move) swings its legs
function propFigure(kind, spec, kit) {
  const make = PROPS[kind];
  if (!make || !kit) return null;
  const made = make(kit, spec.opts ?? {});
  // (it walks: its scans go with it, kit.js's twins)
  kit.moving?.(made.object);
  let t = Math.random() * 10;
  const box = new THREE.Box3().setFromObject(made.object);
  return {
    model: made.object,
    tall: box.max.y - box.min.y,
    update(dt, move) {
      t += dt;
      made.update?.(t, dt, move);
    },
    dispose() {},
  };
}
// A figure for any kind there is one of, by name: a crew model (crew.js), a
// catalogue model walking with its clips or a bob (modelFigure), a built
// figure (figures.js) or a humanoid prop (props/*.js, given the kit); null
// for a kind that's none of those. `spec.model: false` builds it even where
// there's a model; i is which of the entry's figures (a crew kind's face).
export async function anyFigure(kind, spec = {}, kit = null, i = 0) {
  if (spec.model === false) return buildFigure(kind) ?? propFigure(kind, spec, kit);
  return (await crewFigure(kind, i)) ?? (await modelFigure(kind)) ?? buildFigure(kind) ?? propFigure(kind, spec, kit);
}

// How far off the fog has someone all but gone (97% fog, FogExp2's
// 1 − e^−(density·d)²): past it a person isn't drawn or moved about in.
export const fogCutoff = (density) => (density > 0 ? Math.sqrt(-Math.log(0.03)) / density : Infinity);
const FAR = 60; // metres: past it, a person's legs are moved four frames at a time

export function createActors({ parent, world, life = [], wants = [], talk = null, seed = 5, warm = (o) => Promise.resolve(o), small = false, kit = null, fog = () => 0, water = null }) {
  const group = new THREE.Group();
  group.name = 'life';
  parent.add(group);
  // (the people inside the zones: drawn only while you're in one)
  const rooms = new THREE.Group();
  rooms.name = 'life-inside';
  rooms.visible = false;
  parent.add(rooms);
  const r = rng(seed);
  const actors = [];
  let dead = false;

  const figureOf = (kind, spec, i) => anyFigure(kind, spec, kit, i);
  // (has something to say: a list with lines, or a tree)
  const talks = (spec) => (Array.isArray(spec.says) ? spec.says.length > 0 : Boolean(spec.says));

  for (const spec of life) {
    const n = spec.n ?? 1;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (spec.spread ?? 0);
      const home = spec.path ? [...spec.path[i % spec.path.length]] : [spec.at[0] + Math.cos(a) * d, spec.at[1] + Math.sin(a) * d];
      const b = brain(spec, home, r);
      if (spec.path) b.leg = (i + 1) % spec.path.length;
      const holder = new THREE.Group();
      holder.visible = false;
      (spec.zone ? rooms : group).add(holder);
      const actor = { spec, b, holder, fig: null, said: 0, near: false, i, hidden: Boolean(spec.hidden), culled: false, skip: i % 4 };
      actors.push(actor);
      figureOf(spec.kind, spec, i)
        .then((fig) => {
          if (dead || !fig) return;
          fig.model.scale.multiplyScalar(spec.scale ?? 1);
          holder.add(fig.model);
          actor.fig = fig;
          // a standing Jedi's or Sith's lit blade (`blade`: { color, hilt? }),
          // held as the figures built in code held theirs
          if (spec.blade) {
            actor.saber = heldBlade(spec.blade, (fig.tall ?? 1.8) * (spec.scale ?? 1));
            holder.add(actor.saber.arm);
          }
          return warm(holder).then(() => (holder.visible = !actor.hidden && !actor.culled));
        })
        .catch(() => {});
    }
  }
  // whom the people see: the others out and about, as needs.js's relate reads them, and the walls between
  let clock = 0;
  const seesThrough = (a, c) => lineClear(world.solids, a, c);
  const others = (self) => actors.filter((o) => o !== self && !o.hidden && !o.culled && o.fig).map((o) => ({ kind: o.spec.kind, x: o.b.x, z: o.b.z }));
  // not into each other, or walls and trees
  const avoider = (self) => (x, z) => {
    if (world.solids) for (const s of world.solids.near(x, z, 0.6)) if (!s.off && s.type === 'circle' ? Math.hypot(x - s.x, z - s.z) < s.r + 0.4 : false) return true;
    for (const o of actors) if (o !== self && Math.hypot(x - o.b.x, z - o.b.z) < 0.9 * (o.spec.scale ?? 1) && Math.hypot(self.b.x - o.b.x, self.b.z - o.b.z) > Math.hypot(x - o.b.x, z - o.b.z)) return true;
    // (inside somewhere, the floor's flat and the world's edge is far off)
    if (self.spec.zone) return false;
    return world.normalAt?.(x, z)[1] < 0.75 || Math.hypot(x, z) > (world.reach ?? 600);
  };

  return {
    group,
    // in a zone, its people and not the world's; out, the other way round
    setZone(inZone) {
      const v = zoneVisibility(inZone);
      group.visible = v.outdoors;
      rooms.visible = v.zones;
    },
    actors,
    // each frame: on with what they're doing; the ones near `you` turn to you
    // (`at`: where the fog is measured from, you even when you're riding or flying)
    update(dt, you, at = you) {
      clock += dt;
      const cut = fogCutoff(fog());
      for (const a of actors) {
        const { b, spec } = a;
        if (a.hidden) continue;
        // (lost in the fog: not drawn, and not walked about; they pick up
        // where they were when you come near)
        const d = at ? Math.hypot(at.x - b.x, at.z - b.z) : 0;
        const culled = d > cut;
        if (culled !== a.culled) {
          a.culled = culled;
          a.holder.visible = !culled && Boolean(a.fig);
        }
        if (culled) continue;
        const near = you && Math.hypot(you.x - b.x, you.z - b.z) < Math.max(TALK, spec.reach ?? 0) && Math.abs(you.y - a.holder.position.y) < 4 && (talks(spec) || spec.turn || spec.quest || spec.id);
        if (near) {
          b.speed = Math.max(0, b.speed - dt * 4);
          b.yaw = turnToward(b.yaw, Math.atan2(you.x - b.x, you.z - b.z), 4 * dt);
        } else {
          // (whom it knows, looked for every half second: the others of the kinds it fears or chases, in its sight)
          if ((spec.fears || spec.chases) && (a.looked = (a.looked ?? r()) + dt) > 0.5) {
            a.looked = 0;
            relate(b, spec, others(a), clock, { seesThrough });
          }
          think(b, spec, dt, r, (a.avoiding ??= { avoid: avoider(a), wants, t: 0 })); // (made once a person, not every frame)
          a.avoiding.t = clock;
        }
        a.near = Boolean(near);
        const g = groundAt(world, b.x, b.z, spec.level ?? Infinity);
        let y = spec.y != null ? g + spec.y + Math.sin(performance.now() / 700 + a.i) * 0.15 : g;
        let pitch = 0;
        if (spec.dive && water?.height) {
          // (down into the sea and out, a splash each way)
          const dv = diveAt(performance.now() / 1000, (a.i * 0.37) % 1, spec.dive);
          y = water.height(b.x, b.z) + dv.y;
          pitch = dv.pitch;
          if (a.under != null && a.under !== dv.y < 0 && d < 500) water.splash(b.x, b.z, 1.4);
          a.under = dv.y < 0;
        }
        a.holder.position.set(b.x, y, b.z);
        a.holder.rotation.set(pitch, b.yaw, 0, 'YXZ');
        // (far ones: still on a small device, every fourth frame elsewhere,
        // four frames' worth at once: nobody sees their legs)
        if (!a.fig) continue;
        if (d < FAR) a.fig.update(dt, Math.min(1, b.speed / 2.4));
        else if (!small) {
          a.acc = (a.acc ?? 0) + dt;
          if (++a.skip % 4 === 0) {
            a.fig.update(a.acc, Math.min(1, b.speed / 2.4));
            a.acc = 0;
          }
        }
      }
    },
    // (for tests: who's about, where, and what each wants)
    debug: () => actors.filter((a) => !a.hidden).map((a) => ({ kind: a.spec.kind, id: a.spec.id ?? null, at: [+a.b.x.toFixed(1), +a.b.z.toFixed(1)], want: a.b.want?.id ?? null, last: a.b.last, flee: Boolean(a.b.flee), chase: Boolean(a.b.chase), culled: a.culled })),
    // one by its id (a quest's), where it is now
    find(id) {
      return actors.find((a) => a.spec.id === id && !a.hidden) ?? null;
    },
    // gone for now (someone a quest takes away: Greedo, out of his booth
    // and at you), or back
    hide(id, hidden = true) {
      for (const a of actors)
        if (a.spec.id === id) {
          a.hidden = hidden;
          a.holder.visible = !hidden && !a.culled && Boolean(a.fig);
        }
    },
    // everyone of some kinds gone for now (the troopers standing about a
    // world while a battle's fought over it), or back
    hideKinds(kinds, hidden = true) {
      for (const a of actors)
        if (kinds.includes(a.spec.kind)) {
          a.hidden = hidden;
          a.holder.visible = !hidden && !a.culled && Boolean(a.fig);
        }
    },
    // the nearest one with something to say, within reach of (x, z)
    talker(x, z, reach = 3, y = null) {
      let best = null;
      let bestD = Infinity;
      for (const a of actors) {
        if (!(talks(a.spec) || a.spec.quest || a.spec.id) || !a.fig || a.hidden) continue;
        if (y != null && Math.abs(y - a.holder.position.y) > 3) continue;
        // (someone big, a Hutt on his dais, can be talked to from further off)
        const d = Math.hypot(x - a.b.x, z - a.b.z);
        if (d < (a.spec.reach ?? reach) && d < bestD) {
          best = a;
          bestD = d;
        }
      }
      return best;
    },
    // what they say next (round and round their lines), and in whose voice
    // where it isn't their name's (voicelines.js)
    say(a) {
      const lines = talkFor(a.spec.says, talk?.() ?? null);
      if (!lines.length) return null;
      const line = lines[a.said % lines.length];
      a.said += 1;
      return Array.isArray(line) ? { who: line[0], text: line[1] } : { who: a.spec.name ?? a.spec.kind, text: line, voice: a.spec.voice ?? null };
    },
    // keep `you` out of everyone (they're solid, but they move)
    shove(you, radius) {
      for (const a of actors) {
        if (a.spec.solid === false || !a.fig || a.hidden) continue;
        const rr = (a.spec.r ?? 0.4) * (a.spec.scale ?? 1) + radius;
        const dx = you.x - a.b.x;
        const dz = you.z - a.b.z;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-6) {
          you.x = a.b.x + (dx / d) * rr;
          you.z = a.b.z + (dz / d) * rr;
        }
      }
    },
    dispose() {
      dead = true;
      for (const a of actors) {
        a.fig?.dispose();
        a.saber?.owned.forEach((o) => o.dispose?.());
      }
      group.removeFromParent();
      rooms.removeFromParent();
    },
  };
}
