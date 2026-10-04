// Albuquerque, the world: the map, what's open, the car and Hank, with no
// drawing in them.
//
// You start on Walt's driveway in his Aztek and drive between the places the
// shows happen: the RV out in the desert, Saul's office, Los Pollos Hermanos,
// the superlab under the laundry, Casa Tranquila. They open as Walt's career
// grows (Metherria's, saved as tp-metherria): two orders and Saul will see
// you, Cap'n Cook and Gus will, the superlab once it's bought, and Casa
// Tranquila once you've met Gus. Hank cruises the middle of town in his SUV;
// stay close to him for long and he pulls you over.
//
// Metres; +x is east, +z is south. A heading (yaw) of 0 faces +z.

export const WORLD_RADIUS = 230;

// Roads: a centre line from a to b, and a width. Dirt is slower than asphalt.
export const ROADS = [
  { id: 'central', name: 'Central Avenue', a: { x: -190, z: 0 }, b: { x: 190, z: 0 }, w: 12 },
  { id: 'fourth', name: '4th Street', a: { x: 0, z: -150 }, b: { x: 0, z: 150 }, w: 10 },
  { id: 'negra', name: 'Negra Arroyo Lane', a: { x: -170, z: -60 }, b: { x: 0, z: -60 }, w: 9 },
  { id: 'juan', name: 'Juan Tabo', a: { x: -120, z: -60 }, b: { x: -120, z: 0 }, w: 10 },
  { id: 'dirt', name: 'the track to To’hajiilee', a: { x: -150, z: 0 }, b: { x: -150, z: 122 }, w: 7, dirt: true },
];

// The places: where the building stands (at, facing yaw), its footprint
// (w across its front, d deep), where you pull up (door), and how near is near.
export const PLACES = [
  { id: 'home', name: 'Walt’s house', sub: '308 Negra Arroyo Lane', at: { x: -100, z: -78 }, yaw: 0, w: 16, d: 12, door: { x: -95, z: -63 }, radius: 8, model: 'house' },
  { id: 'rv', name: 'The RV', sub: 'Out past To’hajiilee', at: { x: -150, z: 128 }, yaw: Math.PI / 2, w: 8.5, d: 3, door: { x: -150, z: 119 }, radius: 8, model: 'rv' },
  { id: 'saul', name: 'Saul Goodman & Associates', sub: 'Attorney at law', at: { x: -60, z: 20 }, yaw: Math.PI, w: 16, d: 10, door: { x: -60, z: 4 }, radius: 8, model: 'office' },
  { id: 'pollos', name: 'Los Pollos Hermanos', sub: 'The finest ingredients', at: { x: 60, z: -20 }, yaw: 0, w: 18, d: 12, door: { x: 60, z: -4 }, radius: 8, model: 'pollos' },
  { id: 'superlab', name: 'Lavandería Brillante', sub: 'The superlab is underneath', at: { x: 155, z: -24 }, yaw: 0, w: 24, d: 14, door: { x: 155, z: -4 }, radius: 9, model: 'laundry' },
  { id: 'casa', name: 'Casa Tranquila', sub: 'Hector has a visitor', at: { x: 24, z: 100 }, yaw: -Math.PI / 2, w: 20, d: 12, door: { x: 4, z: 100 }, radius: 8, model: 'casa' },
];
// how each one opens, and what to do if it hasn't
const OPENS = {
  home: () => true,
  rv: () => true,
  saul: (s) => s.served >= 2,
  pollos: (s) => s.points >= 40,
  superlab: (s) => s.upgrades.includes('superlab'),
  casa: (s) => s.visited.includes('pollos'),
};
const HINT = {
  saul: 'Serve two orders at the RV, and Saul will see you.',
  pollos: 'Make Cap’n Cook at the RV (40 points), and Gus will see you.',
  superlab: 'Buy the superlab at Saul’s office ($150).',
  casa: 'Meet Gus at Los Pollos Hermanos first.',
};
const GO = {
  rv: 'Drive out to the RV in the desert. Jesse’s waiting.',
  saul: 'Saul will see you now. Drive to Saul Goodman & Associates, on Central.',
  pollos: 'Gus will see you. Drive to Los Pollos Hermanos, on Central.',
  superlab: 'The superlab’s yours. Drive to the laundry at the east end of Central.',
  casa: 'Drive to Casa Tranquila, down 4th Street. Hector has a visitor.',
};
const ORDER = ['rv', 'saul', 'pollos', 'superlab', 'casa'];

// Landmarks you can't go into, and the neighbours' houses on Walt's street.
export const LANDMARKS = [{ id: 'carwash', name: 'A1A Car Wash', at: { x: 100, z: 21 }, yaw: Math.PI, w: 18, d: 10, model: 'carwash' }];
export const HOUSES = [-150, -125, -75, -50, -25].map((x, i) => ({ id: `n${i}`, at: { x, z: -78 }, yaw: 0, w: 13, d: 10 })).concat([-150, -125, -100, -75, -50, -25].map((x, i) => ({ id: `s${i}`, at: { x, z: -42 }, yaw: Math.PI, w: 13, d: 10 })));

// What you can drive into: each footprint, turned to its heading.
const box = (o) => {
  const side = Math.abs(Math.sin(o.yaw)) > 0.5;
  return { id: o.id, x: o.at.x, z: o.at.z, w: side ? o.d : o.w, d: side ? o.w : o.d };
};
export const COLLIDERS = [...PLACES, ...LANDMARKS, ...HOUSES].map(box);

// Walt's car pulls out of his driveway, facing up the street.
export const SPAWN = { x: -95, z: -62, yaw: Math.PI / 2 };

// The Aztek: m/s and seconds.
export const CAR = { radius: 1.7, top: 24, dirt: 16, sand: 11, reverse: 7, accel: 11, brake: 26, coast: 4, turn: 1.8 };

const toSegment = (x, z, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
};
// the road you're on, if any (asphalt before dirt)
const roadAt = (x, z, roads = ROADS) => roads.find((r) => !r.dirt && toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? roads.find((r) => toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? null;
export const onRoad = (x, z, roads = ROADS) => roadAt(x, z, roads) !== null;

// One step of driving. input: { throttle -1..1, steer -1..1 }. Returns the
// car and how hard it bumped into something (m/s, 0 if it didn't).
export function stepCar(car, { throttle = 0, steer = 0 }, dt) {
  const road = roadAt(car.x, car.z);
  const top = road ? (road.dirt ? CAR.dirt : CAR.top) : CAR.sand;
  let speed = car.speed;
  if (throttle > 0) speed += (speed < 0 ? CAR.brake : CAR.accel) * throttle * dt;
  else if (throttle < 0) speed += (speed > 0 ? CAR.brake : CAR.accel * 0.6) * throttle * dt;
  else speed -= Math.sign(speed) * Math.min(Math.abs(speed), CAR.coast * dt);
  // over the limit (onto the sand at speed), it bleeds off rather than stops
  if (speed > top) speed = Math.max(top, speed - CAR.brake * dt);
  speed = Math.max(-CAR.reverse, speed);
  // it turns as it rolls, and less at speed
  const grip = Math.min(1, Math.abs(speed) / 4) / (1 + Math.abs(speed) / 30);
  const yaw = car.yaw + steer * CAR.turn * grip * Math.sign(speed) * dt;
  let x = car.x + Math.sin(yaw) * speed * dt;
  let z = car.z + Math.cos(yaw) * speed * dt;
  let bump = 0;
  // the buildings: the car is a circle, pushed out of any footprint it's in
  for (const c of COLLIDERS) {
    const px = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
    const pz = Math.max(c.z - c.d / 2, Math.min(z, c.z + c.d / 2));
    const dx = x - px;
    const dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= CAR.radius) continue;
    if (d > 1e-6) {
      x = px + (dx / d) * CAR.radius;
      z = pz + (dz / d) * CAR.radius;
    } else {
      // inside it: out the way it came
      x = car.x;
      z = car.z;
    }
    bump = Math.max(bump, Math.abs(speed));
    speed *= -0.2;
  }
  // the edge of the world
  const r = Math.hypot(x, z);
  if (r > WORLD_RADIUS) {
    x *= WORLD_RADIUS / r;
    z *= WORLD_RADIUS / r;
    bump = Math.max(bump, Math.abs(speed));
    speed *= 0.3;
  }
  return { car: { x, z, yaw, speed }, bump };
}

// The place you've pulled up at, if any.
export function nearPlace(x, z) {
  let best = null;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.door.x, z - p.door.z);
    if (d < p.radius && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}

// What's open, and what to do next. snap: { served, points, upgrades, visited }.
export function progress(snap) {
  const s = { served: 0, points: 0, upgrades: [], visited: [], ...snap };
  const places = PLACES.map((p) => ({ ...p, open: OPENS[p.id](s), visited: s.visited.includes(p.id), hint: HINT[p.id] ?? '' }));
  const at = Object.fromEntries(places.map((p) => [p.id, p]));
  for (const id of ORDER) {
    if (!at[id].open) return { places, next: id, objective: HINT[id], done: false };
    if (!at[id].visited) return { places, next: id, objective: GO[id], done: false };
  }
  return { places, next: null, objective: 'Albuquerque’s yours. Say my name.', done: true };
}

// Hank, in his SUV: round the block between Central, 4th, Negra Arroyo and Juan Tabo.
const LOOP = [
  { x: 0, z: 0 },
  { x: -120, z: 0 },
  { x: -120, z: -60 },
  { x: 0, z: -60 },
];
const HANK_SPEED = 11;
const LEGS = LOOP.map((p, i) => ({ a: p, b: LOOP[(i + 1) % LOOP.length], len: Math.hypot(LOOP[(i + 1) % LOOP.length].x - p.x, LOOP[(i + 1) % LOOP.length].z - p.z) }));
const LAP = LEGS.reduce((n, l) => n + l.len, 0);
export function hankAt(t) {
  let s = (((t * HANK_SPEED) % LAP) + LAP) % LAP;
  for (const l of LEGS) {
    if (s <= l.len) {
      const k = s / l.len;
      return { x: l.a.x + (l.b.x - l.a.x) * k, z: l.a.z + (l.b.z - l.a.z) * k, yaw: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) };
    }
    s -= l.len;
  }
  return { ...LOOP[0], yaw: 0 };
}

// Heat: it builds while Hank's close (faster the closer), and cools once
// you're well clear. At the top, he pulls you over.
export const HEAT = { near: 18, far: 30 };
export function stepHeat(heat, dist, dt) {
  let h = heat;
  if (dist < HEAT.near) h += dt * 0.45 * (1.5 - dist / HEAT.near);
  else if (dist > HEAT.far) h -= dt * 0.25;
  else h -= dt * 0.08;
  h = Math.max(0, Math.min(1, h));
  return { heat: h, caught: h >= 1 };
}
