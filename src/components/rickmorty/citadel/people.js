// The Citadel's people, every one a Meshy figure (../portal/meshyCast.js,
// scripts/meshy.mjs) in the show's toon look: Rick C-137, the named cast
// about the concourse, the day care's Mortys, the Cop Ricks on red alert,
// the Council on its bench, the workers on Simple Rick's line, and a crowd
// of Ricks and Mortys walking their loops. A figure whose model doesn't
// load is left out; nothing stands in for it.

import * as THREE from 'three';
import { createMeshyCast } from '../portal/meshyCast';
import { CAST, CROWD_LOOPS, RICK, castFor } from './layout';

// kind → the model and how tall it stands, in metres
const SHIRTS = [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0];
export const KINDS = {
  rick: { a: 'rick', h: 1.85 },
  cop: { a: 'cop', h: 1.85 },
  morty: { a: 'morty', h: 1.5 },
  daycare: { a: 'morty', h: 1.5, shirts: SHIRTS },
  evilmorty: { a: 'evilmorty', h: 1.5 },
  copmorty: { a: 'copmorty', h: 1.5 },
  meeseeks: { a: 'meeseeks', h: 1.95 },
  cowboyrick: { a: 'cowboyrick', h: 1.97 },
  factoryrick: { a: 'factoryrick', h: 1.85 },
  constructionrick: { a: 'constructionrick', h: 1.9 },
  sweaterrick: { a: 'sweaterrick', h: 1.85 },
  suitrick: { a: 'suitrick', h: 1.85 },
  detectiverick: { a: 'detectiverick', h: 1.92 },
  councila: { a: 'councilrick-a', h: 1.85 },
  councilb: { a: 'councilrick-b', h: 1.9 },
  councilc: { a: 'councilrick-c', h: 1.82 },
};
const RIGGED = new Set(['rick', 'cop', 'morty', 'evilmorty', 'copmorty', 'meeseeks', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'councilrick-a', 'councilrick-b', 'councilrick-c']);
// those that sit (the Day Care Rick at his desk, the Council in its chairs)
const SITTERS = ['rick', 'councilrick-a', 'councilrick-b', 'councilrick-c'];
const ASSETS = [...new Set(Object.values(KINDS).map((k) => k.a))].filter((a) => !SITTERS.includes(a));
// the walking crowd's kinds, in turn
const WALKERS = ['rick', 'constructionrick', 'daycare', 'suitrick', 'detectiverick', 'daycare', 'sweaterrick'];

const CROWD = { high: 7, mid: 4, low: 2 };
const CROWD_SPEED = 1.3;
// past this far from the camera, a figure's animation steps every third frame
const FAR = 30;

// a walker's heading (+x turned to (cos, -sin)) as a Meshy figure's turn
// (they face +z)
const yawOf = (face) => face + Math.PI / 2;
const turnTo = (a, b, k) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * Math.min(1, k);
};

// a point along a closed loop, `s` metres round it: [x, z, heading]
function along(loop, lengths, total, s) {
  let d = ((s % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    if (d <= lengths[i]) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const k = lengths[i] ? d / lengths[i] : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(-(b[1] - a[1]), b[0] - a[0])];
    }
    d -= lengths[i];
  }
  return [loop[0][0], loop[0][1], 0];
}

// places: { council: [{ x, y, z, face }], workers: [...] } in their rooms'
// own frames; parents: the concourse and the two rooms
export async function createPeople({ outdoors, factory, council, places, tier = 'high' }) {
  const meshy = createMeshyCast({ kinds: KINDS, rigged: RIGGED, cull: true });
  await Promise.all([meshy.load(null, SITTERS, { clips: ['idle', 'walk', 'run', 'sit'] }), meshy.load(null, ASSETS, { clips: ['idle', 'walk', 'run'] })]);

  const all = [];
  const make = (kind, parent, variant = 0) => {
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
  // sitting: the seated clip alone, played as it is
  const seat = (f) => {
    if (!f?.act?.sit) return;
    for (const [name, a] of Object.entries(f.act)) a.setEffectiveWeight(name === 'sit' ? 1 : 0);
    f.sitting = true;
  };

  const rick = make('rick', outdoors);
  const cast = new Map();
  for (const c of CAST) {
    const f = make(c.kind, outdoors);
    if (!f) continue;
    f.home = c;
    f.yaw = yawOf(c.face);
    f.group.position.set(c.x, 0, c.z);
    f.group.rotation.y = f.yaw;
    if (c.id === 'daycarerick') seat(f);
    cast.set(c.id, f);
  }
  const mortys = Array.from({ length: 6 }, (_, i) => make('daycare', outdoors, i)).filter(Boolean);
  const cops = Array.from({ length: 4 }, () => make('cop', outdoors)).filter(Boolean);
  const councilFigs = ['councila', 'councilb', 'councilc']
    .map((k, i) => {
      const f = make(k, council);
      const p = places.council[i];
      if (f && p) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
        seat(f);
      }
      return f;
    })
    .filter(Boolean);
  // the clerks at the chamber's consoles
  const clerks = (places.clerks ?? [])
    .map((p, i) => {
      const f = make(i ? 'sweaterrick' : 'suitrick', council);
      if (f) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
      }
      return f;
    })
    .filter(Boolean);
  const workers = places.workers
    .map((p) => {
      const f = make('factoryrick', factory);
      if (f) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
      }
      return f;
    })
    .filter(Boolean);

  // the crowd: Ricks and Mortys in turn, spread over the loops
  const loops = CROWD_LOOPS.map((loop) => {
    const lengths = loop.map((a, i) => Math.hypot(loop[(i + 1) % loop.length][0] - a[0], loop[(i + 1) % loop.length][1] - a[1]));
    return { loop, lengths, total: lengths.reduce((s, l) => s + l, 0) };
  });
  const n = CROWD[tier] ?? CROWD.high;
  const crowd = [];
  for (let i = 0; i < n; i++) {
    const f = make(WALKERS[i % WALKERS.length], outdoors, i);
    if (!f) continue;
    const L = loops[i % loops.length];
    f.loop = L;
    f.s0 = (L.total * (i * 0.37 + 0.11)) % L.total;
    f.dir = i % 3 === 0 ? -1 : 1;
    f.pace = CROWD_SPEED * (0.9 + ((i * 7) % 5) * 0.06);
    crowd.push(f);
  }

  const tmp = new THREE.Vector3();
  // step a figure's animation: every frame near the camera, every third far off
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
  // a figure walking from where it was to (x, z): its pace from how far it went
  const walkTo = (f, x, z, face, t, cam) => {
    const dt = f.lastT == null ? 0 : t - f.lastT;
    const moved = f.lastT == null ? 0 : Math.hypot(x - f.group.position.x, z - f.group.position.z);
    f.lastT = t;
    const speed = dt > 0 ? moved / dt : 0;
    f.pace0 = (f.pace0 ?? 0) + (speed - (f.pace0 ?? 0)) * Math.min(1, dt * 8);
    f.group.position.set(x, 0, z);
    f.group.rotation.y = turnTo(f.group.rotation.y, yawOf(face), Math.min(1, dt * 10));
    animate(f, t, Math.min(1, f.pace0 / RICK.run), cam);
  };

  // state: the world's render state (scene.js); t: seconds; cam: the
  // camera's world position
  const update = (state, t, cam) => {
    const outside = state.mode !== 'inside';
    const red = state.mood === 'red';
    if (rick) {
      rick.group.visible = outside && state.mode !== 'escape';
      if (rick.group.visible) {
        const h = state.rick;
        rick.group.position.set(h.x, 0, h.z);
        rick.group.rotation.y = yawOf(h.face);
        animate(rick, t, Math.min(1, h.speed / RICK.run), null);
      }
    }
    const here = new Set(castFor(state.mood).map((c) => c.id));
    for (const [id, f] of cast) {
      f.group.visible = outside && here.has(id);
      if (!f.group.visible) continue;
      // a look round at Rick when he comes close
      const h = state.rick;
      const near = Math.hypot(h.x - f.home.x, h.z - f.home.z) < 4.5 && !f.sitting;
      const want = near ? Math.atan2(h.x - f.home.x, h.z - f.home.z) : yawOf(f.home.face);
      f.yaw = turnTo(f.yaw, want, 0.08);
      f.group.rotation.y = f.yaw;
      animate(f, t, 0, cam);
    }
    const herd = state.mortys ?? [];
    mortys.forEach((f, i) => {
      const m = herd[i];
      f.group.visible = outside && Boolean(m);
      if (m && outside) walkTo(f, m.x, m.z, m.face, t, cam);
    });
    const watch = state.cops ?? [];
    cops.forEach((f, i) => {
      const w = watch[i];
      f.group.visible = outside && Boolean(w);
      if (w && outside) walkTo(f, w.x, w.z, w.face + (w.look ?? 0), t, cam);
    });
    for (const f of crowd) {
      f.group.visible = outside && !red;
      if (!f.group.visible) continue;
      const [x, z, heading] = along(f.loop.loop, f.loop.lengths, f.loop.total, f.s0 + f.dir * f.pace * t);
      f.group.position.set(x, 0, z);
      f.group.rotation.y = yawOf(f.dir > 0 ? heading : heading + Math.PI);
      animate(f, t, f.pace / RICK.run, cam);
    }
    if (!outside && state.room === 'council') for (const f of [...councilFigs, ...clerks]) animate(f, t, 0, null);
    if (!outside && state.room === 'factory') for (const f of workers) animate(f, t, 0, null);
  };

  // where a person's head is, in the world (for the speech bubble)
  const headOf = (kind, id) => {
    const f = kind === 'cast' ? cast.get(id) : kind === 'council' ? councilFigs[id] : kind === 'rick' ? rick : null;
    if (!f || !f.group.visible) return null;
    return f.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, f.height + 0.3, 0));
  };

  const dispose = () => {
    for (const f of all) f.group.removeFromParent();
    all.length = 0;
    meshy.dispose();
  };

  return { rick, cast, mortys, cops, council: councilFigs, workers, crowd, update, headOf, dispose };
}
