// The other pilots down on the same world (online: universe/online/, each
// one's crew sent as protocol.js's walk): their two walking about where
// they are (or one of them riding what they're riding), eased toward each
// new place as it comes in so they don't jump, with the pilot's callsign
// over the one they're playing. Anyone who's taken off, gone to another
// world or gone quiet goes.
//
// createPeers({ parent, placer, getCast }) → { update(net, siteId, dt),
// dispose() }

import * as THREE from 'three';
import { PARTY, loadPartyFigure } from '../../universe/footScene';
import { readLooks } from '../../rickmorty/wardrobe/looks';
import { METRE } from '../../universe/foot';
import { RIDES } from './rides';
import { buildFigure } from './figures';
import { modelFigure } from './actors';

const CREW_MODELS = { artoo: 'r2d2' }; // (scene.js's)

const QUIET = 3000; // ms with nothing from them: gone
const SPECS = Object.fromEntries(Object.values(PARTY).flat().map((s) => [s.id, s]));

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(6, 8, 14, 0.62)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 10, w, 44, 22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(2.2, 0.55, 1);
  s.renderOrder = 10;
  return s;
}

export function createPeers({ parent, placer, getCast }) {
  const group = new THREE.Group();
  group.name = 'peers';
  parent.add(group);
  const shown = new Map(); // peer id → { walkers: [{ who, holder, fig, st }], ride, tag, name }
  let dead = false;

  // (looks: how that pilot dresses their Rick and Morty; the show's if they've sent none)
  const walker = (who, looks = null) => {
    const holder = new THREE.Group();
    group.add(holder);
    const w = { who, holder, fig: null, st: null };
    const spec = SPECS[who];
    if (spec)
      (async () => {
        const own = CREW_MODELS[who] ? await modelFigure(CREW_MODELS[who]).catch(() => null) : null;
        if (!own && spec.src.meshy) await getCast()?.load(null, [spec.src.meshy]).catch(() => {});
        const fig = own ?? (await loadPartyFigure(spec, getCast(), looks ?? readLooks(null)).catch(() => null));
        if (!fig || dead || !holder.parent) return;
        const inner = new THREE.Group();
        if (!own) inner.scale.setScalar(1 / METRE);
        inner.add(fig.model);
        holder.add(inner);
        w.fig = fig;
      })();
    return w;
  };
  const drop = (id) => {
    const e = shown.get(id);
    if (!e) return;
    for (const w of e.walkers) {
      w.fig?.dispose?.();
      w.holder.removeFromParent();
    }
    e.ride?.holder.removeFromParent();
    e.ride?.fig?.dispose?.();
    e.tag.material.map.dispose();
    e.tag.material.dispose();
    e.tag.removeFromParent();
    shown.delete(id);
  };
  const rideOf = (kind) => {
    const holder = new THREE.Group();
    group.add(holder);
    const r = { kind, holder, fig: null };
    const spec = RIDES[kind];
    if (spec?.figure) {
      r.fig = buildFigure(spec.figure);
      if (r.fig) holder.add(r.fig.model);
    } else
      placer.put({ kind, at: [0, 0], abs: true, solid: false }).then((o) => {
        if (!o || dead || !holder.parent) return;
        o.position.set(0, 0, 0);
        o.rotation.set(0, 0, 0);
        holder.add(o);
      });
    return r;
  };

  const ease = (st, to, dt) => {
    const k = 1 - Math.exp(-dt * 10);
    if (!st.x && st.x !== 0) Object.assign(st, to);
    st.x += (to.x - st.x) * k;
    st.y += (to.y - st.y) * k;
    st.z += (to.z - st.z) * k;
    st.yaw += Math.atan2(Math.sin(to.yaw - st.yaw), Math.cos(to.yaw - st.yaw)) * k;
    st.speed = to.speed;
  };

  return {
    group,
    update(net, siteId, dt) {
      const now = performance.now();
      const live = new Set();
      for (const p of net?.peers?.values?.() ?? []) {
        const w = p.walk;
        if (p.blocked || !w || w.world !== siteId || now - w.at > QUIET) continue;
        live.add(p.id);
        let e = shown.get(p.id);
        if (!e) {
          e = { walkers: [], ride: null, tag: nameTag(p.name ?? 'Pilot'), name: p.name };
          group.add(e.tag);
          shown.set(p.id, e);
        }
        const want = [w.lead, w.mate].filter(Boolean);
        // (a new crew, or a swap: the figures follow who's who)
        want.forEach((s, i) => {
          if (e.walkers[i]?.who !== s.who) {
            if (e.walkers[i]) {
              e.walkers[i].holder.removeFromParent();
              e.walkers[i].fig?.dispose?.();
            }
            e.walkers[i] = walker(s.who, p.looks);
            e.walkers[i].st = { ...s };
          }
          const wk = e.walkers[i];
          ease(wk.st, s, dt);
          wk.holder.position.set(wk.st.x, wk.st.y, wk.st.z);
          wk.holder.rotation.y = wk.st.yaw;
          wk.fig?.update(dt, i === 0 && w.ride ? 0 : Math.min(1, Math.abs(wk.st.speed) / 7.4));
        });
        for (let i = want.length; i < e.walkers.length; i++) {
          e.walkers[i].holder.removeFromParent();
          e.walkers[i].fig?.dispose?.();
        }
        e.walkers.length = want.length;
        // what they're riding, under the one riding it
        if ((e.ride?.kind ?? null) !== w.ride) {
          e.ride?.holder.removeFromParent();
          e.ride = w.ride ? rideOf(w.ride) : null;
        }
        const lead = e.walkers[0];
        if (e.ride && lead) {
          // (riding, where they are is where what they ride is: they sit on it)
          const spec = RIDES[e.ride.kind];
          const { x, y, z, yaw } = lead.st;
          e.ride.holder.position.set(x, y, z);
          e.ride.holder.rotation.y = yaw;
          e.ride.fig?.update(dt, Math.min(1, Math.abs(lead.st.speed) / 6));
          const [sx, sy, sz] = spec.seat;
          lead.holder.position.set(x + sx * Math.cos(yaw) + sz * Math.sin(yaw), y + sy - 0.55, z - sx * Math.sin(yaw) + sz * Math.cos(yaw));
        }
        if (lead) e.tag.position.set(lead.st.x, lead.st.y + 2.45, lead.st.z);
      }
      for (const id of [...shown.keys()]) if (!live.has(id)) drop(id);
    },
    dispose() {
      dead = true;
      for (const id of [...shown.keys()]) drop(id);
      group.removeFromParent();
    },
  };
}
