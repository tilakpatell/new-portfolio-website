import { describe, expect, it } from 'vitest';
import { GATE, MOUNT, PILLARS, POST, REDS, TOWER, spiralAt } from '../courses/bobomb';
import { enterCourse, newGame } from './game';
import { flat, fly, toward } from './pilot';
import { angleDiff } from './vec';

const NONE = { sx: 0, sy: 0, a: false, ap: false, b: false, bp: false, z: false, zp: false };
const PI = Math.PI;

const course = () => {
  const g = newGame();
  enterCourse(g, 'bobomb');
  return g;
};

// across the bridge to the mountain's foot
const toFoot = [{ go: [0, 4300] }, { go: [0, 3700], tol: 80 }, { go: [0, 2500], tol: 80 }];
// up the path from turn ψ0 to ψ1, keeping to its inner side, out of the iron balls' way
function climb(psi0, psi1, off = -230) {
  const out = [];
  for (let psi = psi0; psi < psi1; psi += 0.2) {
    const p = spiralAt(psi, off);
    out.push({ go: [p.x, p.z], tol: 170 });
  }
  return out;
}

// King Bob-omb: round to his back, pick him up, carry him to the middle,
// throw; until his star is out
const kingFight = {
  fn(g, mem) {
    const m = g.mario;
    const k = g.actors.find((a) => a.type === 'king');
    if (!k) return g.actors.some((a) => a.type === 'star' && a.index === 0) ? 'done' : NONE;
    const ar = k.def.arena;
    if (m.held === k) {
      if (flat(g, ar.x, ar.z) > 220) return toward(g, ar.x, ar.z, 0.7);
      mem.b = !mem.b;
      return mem.b ? { ...NONE, b: true, bp: true } : NONE;
    }
    if (k.state !== 'walk' || m.action === 'throw' || m.action === 'knockback') return NONE;
    const back = k.yaw + PI;
    const at = Math.atan2(m.pos.x - k.pos.x, m.pos.z - k.pos.z);
    const off = angleDiff(back, at);
    if (Math.abs(off) > 0.35) {
      // round him, wide of his front
      const next = at + Math.sign(off) * 0.7;
      return toward(g, k.pos.x + Math.sin(next) * 430, k.pos.z + Math.cos(next) * 430);
    }
    const bx = k.pos.x + Math.sin(back) * 240, bz = k.pos.z + Math.cos(back) * 240;
    if (flat(g, bx, bz) > 70) return toward(g, bx, bz, 0.8);
    // at his back: face the way he faces, and grab
    if (Math.abs(angleDiff(m.yaw, k.yaw)) > 0.5) return toward(g, k.pos.x, k.pos.z, 0.25);
    mem.b = !mem.b;
    return mem.b ? { ...toward(g, k.pos.x, k.pos.z, 0.2), b: true, bp: true } : toward(g, k.pos.x, k.pos.z, 0.2);
  },
};

// the Chain Chomp's post: wait out of reach for a lunge to be spent, then
// onto the post, one pound, and back out of reach; three times
const SAFE = [POST.x + 1250, POST.z]; // out of the chain's reach (1087), close enough that it lunges
const poundPost = {
  fn(g, mem) {
    const m = g.mario;
    const post = g.actors.find((a) => a.type === 'post');
    const chomp = g.actors.find((a) => a.type === 'chomp');
    if (!post || post.hits >= 3) return 'done';
    if (mem.hits !== post.hits) {
      // a pound landed: again while it's safe, else back off and wait
      mem.hits = post.hits;
      if (!(chomp?.state === 'idle' && chomp.next > 40)) mem.go = false;
    }
    const onPost = !m.airborne && m.floor?.owner === post.collider;
    if (onPost && mem.go && m.action !== 'poundland') return { ...NONE, a: true, ap: true };
    if (m.action === 'knockback') mem.go = false;
    const d = flat(g, post.pos.x, post.pos.z);
    if (m.airborne) {
      if (!mem.go) return NONE;
      if (d < 70 && m.vel.y < 10 && m.action !== 'pound') return { ...NONE, z: true, zp: true };
      return { ...(d < 90 ? NONE : toward(g, post.pos.x, post.pos.z, 0.6)), a: true };
    }
    if (m.action === 'poundland') return NONE;
    if (!mem.go) {
      if (flat(g, ...SAFE) > 100) return toward(g, ...SAFE);
      // it's back by its post, with a while before the next lunge
      if (chomp?.state === 'idle' && chomp.next > 55) mem.go = true;
      return NONE;
    }
    // run in, slow down, and hop up with little speed
    if (d > 500) return toward(g, post.pos.x, post.pos.z);
    if (d > 170) return toward(g, post.pos.x, post.pos.z, 0.35);
    return { ...toward(g, post.pos.x, post.pos.z, 0.3), a: true, ap: true };
  },
};

describe('the pilot plays Bob-omb Ridge', () => {
  it('to the summit, and beats King Bob-omb for his star', () => {
    const g = course();
    const r = fly(g, [...toFoot, ...climb(0.15, 4 * PI - 0.4), { go: [MOUNT.x, MOUNT.z + 500], tol: 150 }, kingFight, { star: 0 }]);
    expect(r.why).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(g.save.stars.bobomb?.[0]).toBe(true);
  });

  it('round all eight red coins, to the red coin star', () => {
    const g = course();
    const red = (i) => [REDS[i].x, REDS[i].z];
    const [p1, p2, p3, p4, p5] = PILLARS.map((p) => [p.x, p.z]);
    const r = fly(g, [
      { go: red(6), tol: 60 },
      { go: [0, 4000] },
      { go: red(0), tol: 60 },
      { go: [0, 2500], tol: 80 },
      ...climb(0.15, PI),
      { go: red(3), tol: 60 },
      ...climb(PI + 0.1, 3 * PI),
      { go: red(4), tol: 60 },
      // off the top turn (pounding the fall), then off the bottom one
      { drop: [0, MOUNT.z - 2500] },
      { go: [0, MOUNT.z - 3100] },
      { go: red(5), tol: 60 },
      { go: [TOWER.x - 400, TOWER.z - 2000], tol: 150 },
      { jump: [TOWER.x, TOWER.z], at: 1650, kind: 'double', top: TOWER.top, brake: 260 },
      { go: red(7), tol: 60, mag: 0.4 },
      { go: [p1[0] - 700, p1[1] + 300], tol: 120 },
      { jump: p1, at: 420, top: PILLARS[0].top, brake: 200 },
      { jump: p2, at: 330, top: PILLARS[1].top, brake: 200 },
      { go: red(1), tol: 50, mag: 0.4 },
      { jump: p3, at: 330, top: PILLARS[2].top, brake: 200 },
      { jump: p4, at: 330, top: PILLARS[3].top, brake: 200 },
      { go: red(2), tol: 50, mag: 0.4 },
      { jump: p5, at: 560, top: PILLARS[4].top, brake: 250 },
      { star: 1 },
    ]);
    expect(r.why).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(g.save.stars.bobomb?.[1]).toBe(true);
  });

  it('to the Chain Chomp\'s post, which it pounds free, and through the gate to the star', () => {
    const g = course();
    const r = fly(g, [...toFoot, { go: [POST.x + 1350, 2300] }, poundPost, { wait: 240 }, { go: [GATE.x + 600, GATE.z] }, { star: 2 }]);
    expect(r.why).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(g.save.stars.bobomb?.[2]).toBe(true);
  });
});
