import { describe, expect, it } from 'vitest';
import { createSim } from './sim';

const still = { moveX: 0, moveZ: 0, run: false, jump: false, throttle: 0, steer: 0, boost: false, fire: false, transform: false, use: false, aimYaw: 0, aimPitch: 0 };
const tick = (sim, input = {}, seconds = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...sim.step({ ...still, ...input }, 1 / 60));
  return out;
};
const goTo = (sim, x, z) => {
  sim.player.x = x;
  sim.player.z = z;
  tick(sim);
};

describe('the world, played', () => {
  it('starts in Iacon with nobody hostile about', () => {
    const sim = createSim();
    expect(sim.area.id).toBe('iacon');
    expect(sim.enemies).toHaveLength(0);
    expect(sim.hud().offers.length).toBeGreaterThan(0);
  });

  it('hands out a mission when you talk to its giver, and its Decepticons come', () => {
    const sim = createSim();
    const grim = sim.area.people.find((p) => p.id === 'grimlock');
    goTo(sim, grim.x - 4, grim.z);
    const out = sim.use();
    expect(out).toContainEqual(expect.objectContaining({ type: 'start', id: 'hold-gates' }));
    expect(sim.talk.name).toBe('Grimlock');
    // the first step was talking to him: on to the barricades
    expect(sim.missions.step).toBe(1);
    goTo(sim, 0, 300);
    expect(sim.missions.step).toBe(2);
    expect(sim.enemies.length).toBe(4);
  });

  it('counts the kills toward the wave', () => {
    const sim = createSim();
    const grim = sim.area.people.find((p) => p.id === 'grimlock');
    goTo(sim, grim.x - 4, grim.z);
    sim.use();
    goTo(sim, 0, 300);
    for (const e of sim.enemies) {
      e.hp = 1;
      e.x = sim.player.x;
      e.z = sim.player.z + 30;
    }
    let out = [];
    for (let k = 0; k < 200 && sim.missions.step === 2; k++) out = out.concat(tick(sim, { fire: true, aimYaw: 0, aimPitch: -0.05 }, 1 / 30));
    expect(out.some((e) => e.type === 'kill')).toBe(true);
    expect(sim.missions.step).toBe(3);
  });

  it('takes you through the space bridge and keeps the mission going', () => {
    const sim = createSim();
    const bee = sim.area.people.find((p) => p.id === 'bumblebee');
    goTo(sim, bee.x - 4, bee.z);
    sim.use();
    expect(sim.missions.active).toBe('energon-run');
    const bridge = sim.area.exits[0];
    goTo(sim, bridge.x + 3, bridge.z);
    const out = sim.use();
    expect(out).toContainEqual(expect.objectContaining({ type: 'exit', to: 'base' }));
    sim.enter(sim.exit.to, sim.exit.at);
    expect(sim.area.id).toBe('base');
    expect(sim.missions.active).toBe('energon-run');
    // the way back is shown
    expect(sim.hud().target.label).toMatch(/Iacon/);
  });

  it('picks energon up and counts it', () => {
    const sim = createSim();
    const k = sim.pickups[0];
    goTo(sim, k.x, k.z);
    expect(sim.player.energon).toBe(1);
    expect(sim.pickups[0].taken).toBe(true);
  });

  it('gets Optimus back up after he goes down', () => {
    const sim = createSim();
    sim.player.hp = 1;
    sim.enemies.push({ id: 'x', kind: 'trooper', x: 0, y: 0, z: 0, hp: 40, r: 1, h: 7, dead: false, state: 'advance', t: 0, cooldown: 0, dir: 1, yaw: 0 });
    sim.shots.push({ from: 'enemy', x: sim.player.x, y: sim.player.y + 5, z: sim.player.z - 3, vx: 0, vy: 0, vz: 60, ttl: 1, damage: 20 });
    const out = tick(sim, {}, 0.2);
    expect(out.some((e) => e.type === 'dead')).toBe(true);
    const back = tick(sim, {}, 3.2);
    expect(back.some((e) => e.type === 'respawn')).toBe(true);
    expect(sim.player.hp).toBe(100);
  });
});
