// Mortytown's people, every one a Meshy figure (../portal/meshyCast.js) in
// the show's toon look: the cast where ./mortytown.js stands them (Big Morty
// on a stool by The Creepy Morty's door, Slick Morty on his corner, the
// campaign manager, Rick D. Sanchez III and Simple Rick at the factory's back
// door, Cop Morty and his partner outside Morty Mart), Evil Rick walking the
// middle of the road, the street's Mortys round their loops, and the three
// Locos where ./locos.js has them. They're loaded the first time the lift
// comes down, not with the Citadel; a figure whose model doesn't load is
// left out, nothing stands in for it.
//
// createTownsfolk({ parent, tier }) → Promise<{ update(state, t, cam),
//   headOf(id), movers, dispose }>

import * as THREE from 'three';
import { createMeshyCast } from '../portal/meshyCast';
import { CAST, LOOPS, WALKS } from './mortytown';
import { RICK } from './layout';
import { along, turnTo, yawOf } from './people';

// kind → the model and how tall it stands, hat and all, in metres
const SHIRTS = [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0];
export const KINDS = {
  bigmorty: { a: 'bigmorty', h: 1.56 },
  slickmorty: { a: 'slickmorty', h: 1.52 },
  campaignmorty: { a: 'campaignmorty', h: 1.5 },
  rickd3: { a: 'rickd3', h: 2.15 },
  simplerick: { a: 'simplerick', h: 1.85 },
  evilrick: { a: 'evilrick', h: 1.85 },
  copmorty: { a: 'copmorty', h: 1.5 },
  cop: { a: 'cop', h: 1.85 },
  'loco-a': { a: 'loco-a', h: 1.5 },
  'loco-b': { a: 'loco-b', h: 1.5 },
  'loco-c': { a: 'loco-c', h: 1.5 },
  morty: { a: 'morty', h: 1.5, shirts: SHIRTS },
};
const RIGGED = new Set(Object.values(KINDS).map((k) => k.a));
// the street's Mortys, by the device
const STREET = { high: 8, mid: 4, low: 2 };
const PACE = 1.25;
// past this far from the camera, a figure's animation steps every third frame
const FAR = 30;

export async function createTownsfolk({ parent, tier = 'high' }) {
  const meshy = createMeshyCast({ kinds: KINDS, rigged: RIGGED, cull: true });
  const assets = [...RIGGED];
  await Promise.all([meshy.load(null, assets.filter((a) => a !== 'bigmorty'), { clips: ['idle', 'walk', 'run'] }), meshy.load(null, ['bigmorty'], { clips: ['idle', 'walk', 'run', 'sit'] })]);

  const all = [];
  const make = (kind, variant = 0) => {
    const f = meshy.make(kind, variant);
    if (!f) return null;
    f.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    parent.add(f.group);
    f.tick = Math.floor(Math.random() * 3);
    all.push(f);
    return f;
  };
  const seat = (f) => {
    if (!f?.act?.sit) return;
    for (const [name, a] of Object.entries(f.act)) a.setEffectiveWeight(name === 'sit' ? 1 : 0);
    f.sitting = true;
  };

  // the cast, where they stand (Big Morty sat on his stool)
  const cast = new Map();
  for (const c of CAST) {
    const f = make(c.kind);
    if (!f) continue;
    f.home = c;
    f.yaw = yawOf(c.face);
    f.group.position.set(c.x, c.id === 'bigmorty' ? 0.02 : 0, c.z);
    f.group.rotation.y = f.yaw;
    if (c.id === 'bigmorty') seat(f);
    cast.set(c.id, f);
  }
  // who walks: Evil Rick, and the street's Mortys
  const loops = LOOPS.map((loop) => {
    const lengths = loop.map((a, i) => Math.hypot(loop[(i + 1) % loop.length][0] - a[0], loop[(i + 1) % loop.length][1] - a[1]));
    return { loop, lengths, total: lengths.reduce((s, l) => s + l, 0) };
  });
  const walkers = [];
  for (const w of WALKS) {
    const f = make(w.kind);
    if (!f) continue;
    Object.assign(f, { id: w.id, home: w, loop: loops[w.loop], s0: 0, dir: 1, pace: PACE * 0.85 });
    walkers.push(f);
  }
  const n = STREET[tier] ?? STREET.high;
  for (let i = 0; i < n; i++) {
    const f = make('morty', i);
    if (!f) continue;
    const L = loops[1 + (i % (loops.length - 1))];
    Object.assign(f, { loop: L, s0: (L.total * (i * 0.29 + 0.07)) % L.total, dir: i % 2 ? -1 : 1, pace: PACE * (0.92 + ((i * 7) % 5) * 0.05) });
    walkers.push(f);
  }
  // the Locos, wherever the hunt has them
  const locos = new Map(['loco-a', 'loco-b', 'loco-c'].map((id) => [id, make(id)]).filter(([, f]) => f));

  const tmp = new THREE.Vector3();
  const animate = (f, t, move, cam) => {
    f.group.getWorldPosition(tmp);
    const far = cam && tmp.distanceTo(cam) > FAR;
    f.tick = (f.tick + 1) % 3;
    if (far && f.tick) return;
    if (f.sitting) {
      const dt = f.last == null ? 0 : Math.min(0.1, Math.max(0, t - f.last));
      f.last = t;
      f.mixer.update(dt);
    } else f.update(t, move, 0);
  };

  // state: the world's (./scene.js), with Rick's spot in the district's frame
  // and the hunt's Locos; t: seconds; cam: the camera, in the world
  const update = (state, t, cam) => {
    const h = state.rick;
    for (const f of cast.values()) {
      // a look round at Rick when he comes close
      const near = Math.hypot(h.x - f.home.x, h.z - f.home.z) < 4.5 && !f.sitting;
      const want = near ? Math.atan2(h.x - f.home.x, h.z - f.home.z) : yawOf(f.home.face);
      f.yaw = turnTo(f.yaw, want, 0.08);
      f.group.rotation.y = f.yaw;
      animate(f, t, 0, cam);
    }
    for (const f of walkers) {
      const [x, z, heading] = along(f.loop.loop, f.loop.lengths, f.loop.total, f.s0 + f.dir * f.pace * t);
      f.group.position.set(x, 0, z);
      f.group.rotation.y = yawOf(f.dir > 0 ? heading : heading + Math.PI);
      animate(f, t, f.pace / RICK.run, cam);
    }
    // (only the hunt's Locos are out: none before it's open, none once they're handed over)
    const out = new Set((state.locos ?? []).map((l) => l.id));
    for (const [id, f] of locos) f.group.visible = out.has(id);
    for (const l of state.locos ?? []) {
      const f = locos.get(l.id);
      if (!f) continue;
      const dt = f.lastT == null ? 0 : t - f.lastT;
      f.lastT = t;
      f.group.position.set(l.x, 0, l.z);
      f.group.rotation.y = turnTo(f.group.rotation.y, yawOf(l.face), Math.min(1, dt * 10));
      // (a Loco in hiding crouches out of sight: he stands still, facing the alley's mouth)
      animate(f, t, Math.min(1, (l.speed ?? 0) / RICK.run), cam);
    }
  };

  // where someone's head is, in the world (for the speech bubble)
  const head = new THREE.Vector3();
  const headOf = (id) => {
    const f = cast.get(id) ?? walkers.find((w) => w.id === id) ?? locos.get(id);
    if (!f || !f.group.visible) return null;
    f.group.getWorldPosition(head);
    head.y += (f.sitting ? f.height * 0.72 : f.height) + 0.3;
    return head;
  };
  // where a walker is now, in the district's frame (Evil Rick, to talk to)
  const at = (id) => {
    const f = walkers.find((w) => w.id === id);
    return f ? { x: f.group.position.x, z: f.group.position.z } : null;
  };

  const dispose = () => {
    for (const f of all) {
      f.mixer?.stopAllAction();
      f.group.removeFromParent();
    }
    all.length = 0;
    meshy.dispose();
  };

  return { update, headOf, at, movers: all, dispose };
}
