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

// The edge of the world: a ranch fence right round, out in the dunes, where
// you can see it. (The town itself is flat; the dunes start at DUNES.)
export const WORLD_RADIUS = 420;
export const DUNES = 250;

// How high the ground is at a point: flat through town, then low dunes that
// level off before the mesas. The scene builds the desert from this, and the
// car rides it.
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= DUNES) return 0;
  const out = Math.min(1.25, (r - DUNES) / 250);
  return out * out * (6 + 5 * Math.sin(x * 0.013) * Math.cos(z * 0.017) + 3 * Math.sin((x + z) * 0.031)) - 0.05;
}

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
  { id: 'home', name: 'Walt’s house', sub: '308 Negra Arroyo Lane', at: { x: -100, z: -78 }, yaw: 0, w: 16, d: 12, foot: { w: 15.4, d: 12 }, door: { x: -95, z: -63 }, radius: 8, model: 'house' },
  { id: 'rv', name: 'The RV', sub: 'Out past To’hajiilee', at: { x: -150, z: 128 }, yaw: Math.PI / 2, w: 8.5, d: 3, foot: { w: 8.4, d: 2.7 }, door: { x: -150, z: 119 }, radius: 8, model: 'rv' },
  { id: 'saul', name: 'Saul Goodman & Associates', sub: 'Attorney at law', at: { x: -60, z: 20 }, yaw: Math.PI, w: 16, d: 10, foot: { w: 15.4, d: 15.2 }, door: { x: -60, z: 4 }, radius: 8, model: 'office' },
  { id: 'pollos', name: 'Los Pollos Hermanos', sub: 'The finest ingredients', at: { x: 60, z: -20 }, yaw: 0, w: 18, d: 12, foot: { w: 17.4, d: 17 }, door: { x: 60, z: -4 }, radius: 8, model: 'pollos' },
  { id: 'superlab', name: 'Lavandería Brillante', sub: 'The superlab is underneath', at: { x: 155, z: -24 }, yaw: 0, w: 24, d: 14, foot: { w: 23.4, d: 12 }, door: { x: 155, z: -4 }, radius: 9, model: 'laundry' },
  { id: 'casa', name: 'Casa Tranquila', sub: 'Hector has a visitor', at: { x: 24, z: 100 }, yaw: -Math.PI / 2, w: 20, d: 12, foot: { w: 17, d: 19.4 }, door: { x: 4, z: 100 }, radius: 8, model: 'casa' },
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
export const LANDMARKS = [{ id: 'carwash', name: 'A1A Car Wash', at: { x: 100, z: 21 }, yaw: Math.PI, w: 18, d: 10, foot: { w: 14.8, d: 17.4 }, model: 'carwash' }];
export const HOUSES = [-150, -125, -75, -50, -25].map((x, i) => ({ id: `n${i}`, at: { x, z: -78 }, yaw: 0, w: 13, d: 10 })).concat([-150, -125, -100, -75, -50, -25].map((x, i) => ({ id: `s${i}`, at: { x, z: -42 }, yaw: Math.PI, w: 13, d: 10 })));

// The rest of town: the buildings you drive past. Real Albuquerque (the KiMo
// Theatre, the Dog House, Loyola's diner) and the shows' own (the DEA's field
// office, the Crossroads Motel, a house under Vamonos Pest's tent, Jesse's
// place, Hank and Marie's, Old Joe's junkyard). `w` runs east-west and `d`
// north-south as each one stands; `face` is the side its front is on; `h`
// its height. scene's ./buildings.js builds each to exactly this footprint
// (the ones Meshy made have their model's own proportions here).
export const TOWN = [
  { id: 'kimo', kind: 'deco', name: 'KiMo Theatre', at: { x: -24, z: -20 }, w: 16.5, d: 17, h: 16, face: 's' },
  { id: 'doghouse', kind: 'hotdog', name: 'The Dog House', at: { x: -70, z: -18 }, w: 8.25, d: 7, h: 3.6, face: 's' },
  { id: 'gas', kind: 'gas', name: 'Big Chief', at: { x: 25, z: -21 }, w: 12, d: 8, h: 4, face: 's' },
  { id: 'motel', kind: 'motel', name: 'Crossroads Motel', at: { x: 105, z: -22 }, w: 34, d: 9.7, h: 4, face: 's' },
  { id: 'diner', kind: 'diner', name: 'Loyola’s', at: { x: -105, z: 20 }, w: 16, d: 11, h: 4.2, face: 'n' },
  { id: 'bank', kind: 'brick', name: 'Mesa Credit Union', at: { x: -25, z: 22 }, w: 18, d: 14, h: 9, face: 'n' },
  { id: 'dea', kind: 'office', name: 'DEA', at: { x: 40, z: 25 }, w: 24.2, d: 18, h: 24, face: 'n' },
  { id: 'pest', kind: 'tent', name: 'Vamonos Pest', at: { x: 150, z: 24 }, w: 11.2, d: 13, h: 6, face: 'n' },
  { id: 'tuco', kind: 'brick', name: 'Tampico Furniture', at: { x: 22, z: -62 }, w: 14, d: 18, h: 8, face: 'w' },
  { id: 'hank', kind: 'adobe', name: 'The Schraders’', at: { x: 26, z: -115 }, w: 12, d: 14.85, h: 4.4, face: 'w' },
  { id: 'jesse', kind: 'spanish', name: 'Jesse’s house', at: { x: -22, z: 60 }, w: 13, d: 13.75, h: 7.4, face: 'e' },
  { id: 'junkyard', kind: 'junkyard', name: 'Old Joe’s', at: { x: -40, z: 125 }, w: 26, d: 20, h: 3, face: 'e' },
  { id: 'tower', kind: 'tower', name: 'the water tower', at: { x: 70, z: 82 }, w: 7, d: 7, h: 19, face: 'n' },
  { id: 'beneke', kind: 'warehouse', name: 'Beneke Fabricators', at: { x: 122, z: 88 }, w: 30, d: 18, h: 8, face: 'n' },
  // Saul's yellow Suzuki Esteem, parked beside his office, and the water tank out where one of the drops is
  { id: 'esteem', kind: 'car', name: 'Saul’s Esteem', at: { x: -74, z: 12 }, w: 1.94, d: 4.2, h: 1.47, face: 'n' },
  { id: 'watertank', kind: 'tower', name: 'the water tank', at: { x: -246, z: -150 }, w: 7, d: 6.23, h: 13.6, face: 's' },
];
// The tracks north of town, and the freight that comes down them.
export const RAIL = { z: -182, from: -700, to: 700 };

// What you can drive into. A building's `foot` is what its model really
// covers on the ground (across x, then z, as it stands, measured off the
// model), so the car stops at the wall it can see and nowhere else; without
// one, its w and d turned to its heading.
const box = (o) => {
  if (o.foot) return { id: o.id, x: o.at.x, z: o.at.z, w: o.foot.w, d: o.foot.d };
  const side = Math.abs(Math.sin(o.yaw)) > 0.5;
  return { id: o.id, x: o.at.x, z: o.at.z, w: side ? o.d : o.w, d: side ? o.w : o.d };
};
export const COLLIDERS = [...PLACES, ...LANDMARKS, ...HOUSES].map(box).concat(TOWN.map((t) => ({ id: t.id, x: t.at.x, z: t.at.z, w: t.w, d: t.d })));

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

// Blue Sky: twelve crystals left out in the desert, off the roads. Drive
// over one and it's yours (kept as tp-abq-blue); find all twelve and the
// night sky has something to say about it.
export const CRYSTALS = [
  { id: 'b1', x: -136, z: 140 },
  { id: 'b2', x: -186, z: 62 },
  { id: 'b3', x: -62, z: 72 },
  { id: 'b4', x: 72, z: 60 },
  { id: 'b5', x: 112, z: 132 },
  { id: 'b6', x: 192, z: 70 },
  { id: 'b7', x: 170, z: -112 },
  { id: 'b8', x: 60, z: -112 },
  { id: 'b9', x: -42, z: -126 },
  { id: 'b10', x: -202, z: -40 },
  { id: 'b11', x: 42, z: 152 },
  { id: 'b12', x: 136, z: 46 },
];
export const CRYSTAL_REACH = 3.4;
// the crystal the car is on, if it hasn't been taken
export function crystalAt(x, z, got = []) {
  for (const c of CRYSTALS) if (!got.includes(c.id) && Math.hypot(x - c.x, z - c.z) < CRYSTAL_REACH) return c;
  return null;
}

// The times of day the HUD's clock steps through. 0 is midnight, 0.25
// sunrise, 0.5 noon, 0.75 sunset; the day also turns slowly on its own.
export const TIMES = [
  { id: 'golden', name: 'Golden hour', tod: 0.71 },
  { id: 'night', name: 'Night', tod: 0.93 },
  { id: 'dawn', name: 'Dawn', tod: 0.262 },
  { id: 'noon', name: 'High noon', tod: 0.5 },
];
// the named time the clock is in (each one runs until the next begins)
export function timeName(tod) {
  const t = ((tod % 1) + 1) % 1;
  if (t < 0.2 || t >= 0.82) return TIMES[1];
  if (t < 0.36) return TIMES[2];
  if (t < 0.62) return TIMES[3];
  return TIMES[0];
}

// ── things to do ──

// Deliveries: a drop somewhere out in the desert and a clock. Get there in
// time and the buyer pays, more for a long run and for time left over; the
// money is the career's (Saul's office spends it).
export const DROPS = [
  { id: 'd1', name: 'the cow house', x: -205, z: 150 },
  { id: 'd2', name: 'the wash under the mesa', x: 160, z: 196 },
  { id: 'd3', name: 'the junkyard gate', x: 232, z: -58 },
  { id: 'd4', name: 'the water tank', x: -230, z: -150 },
  { id: 'd5', name: 'the arroyo', x: 70, z: -214 },
  { id: 'd6', name: 'the dunes past To’hajiilee', x: -300, z: 250 },
  { id: 'd7', name: 'the old billboard', x: 310, z: 120 },
  { id: 'd8', name: 'the dry lake', x: -80, z: 330 },
];
export const RUN = { reach: 6, pace: 12, slack: 9, far: 110 };
// A run from where the car is: the `pick`th of the drops far enough away.
export function startRun(car, pick = 0) {
  const far = DROPS.filter((d) => Math.hypot(d.x - car.x, d.z - car.z) >= RUN.far);
  const d = far[((Math.floor(pick) % far.length) + far.length) % far.length];
  const dist = Math.hypot(d.x - car.x, d.z - car.z);
  return { ...d, dist, time: dist / RUN.pace + RUN.slack };
}
// One step of a run: 'on' (with what's left), 'made' (with the pay) or 'late'.
export function stepRun(run, car, left, dt) {
  const d = Math.hypot(run.x - car.x, run.z - car.z);
  if (d < RUN.reach) return { state: 'made', left, pay: runPay(run, left) };
  const t = left - dt;
  return t <= 0 ? { state: 'late', left: 0 } : { state: 'on', left: t, away: d };
}
export const runPay = (run, left) => Math.round(15 + run.dist / 8 + Math.max(0, left) * 2);

// The A1A Car Wash: pull up on its forecourt and the Aztek gets a wash.
export const WASH = { x: 100, z: 7.5, radius: 6, seconds: 3.2 };
export const atWash = (x, z) => Math.hypot(x - WASH.x, z - WASH.z) < WASH.radius;
