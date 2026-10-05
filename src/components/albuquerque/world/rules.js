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

// The Aztek: metres, seconds and radians. How fast it goes on each surface,
// how hard it pulls, brakes and coasts down, and how it turns: `lock` is the
// front wheels' full lock and `wheelbase` the distance between its axles (a
// turning circle under eight metres across at parking speed); `grip` is the
// sideways pull its tyres hold on each surface (m/s²) before they slide, and
// `bite` how far past that a full turn of the wheel asks at speed (nothing
// on the road, where flat out it corners as hard as it grips and no harder;
// more on dirt and sand, where it drifts). The handbrake locks the back wheels: it slows the
// car (`handbrake`), leaves the tail a fraction of its grip (`loose`) and
// swings it round (`swing` times the turn, up to `spin` rad/s), for a
// handbrake turn. `response` is how quickly it takes up a turn (per second;
// `responseLoose` with the tail loose, and `carry` how slowly a spin dies
// away while the handbrake's still on), `align` how hard it straightens
// itself out of a small slide, and `power` how much of a sliding tyre's grip
// full throttle takes away (a slide is held on the throttle). `pivot` is the
// tightest it can turn about itself, sliding (metres): however it's
// spinning, it turns no faster than its speed over that.
export const CAR = {
  radius: 1.7,
  top: 24,
  dirt: 16,
  sand: 11,
  reverse: 9,
  accel: 13,
  taper: 0.5,
  brake: 28,
  coast: 3.5,
  handbrake: 6.5,
  wheelbase: 2.7,
  lock: 0.62,
  grip: { road: 19, dirt: 10.5, sand: 8.5 },
  bite: { road: 1, dirt: 1.25, sand: 1.3 },
  loose: 0.3,
  swing: 2.6,
  spin: 3.2,
  response: 10,
  responseLoose: 6,
  carry: 0.8,
  align: 2.2,
  power: 0.4,
  pivot: 0.9,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const toSegment = (x, z, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
};
// the road you're on, if any (asphalt before dirt)
const roadAt = (x, z, roads = ROADS) => roads.find((r) => !r.dirt && toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? roads.find((r) => toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? null;
export const onRoad = (x, z, roads = ROADS) => roadAt(x, z, roads) !== null;
// what's under the wheels: 'road', 'dirt' or 'sand'
export const surfaceAt = (x, z) => {
  const road = roadAt(x, z);
  return road ? (road.dirt ? 'dirt' : 'road') : 'sand';
};
const TOP = { road: CAR.top, dirt: CAR.dirt, sand: CAR.sand };

// How hard the tyres are sliding, 0 (gripping) to 1: for the smoke, the
// marks on the road and the squeal.
const SLIDING = 4.5; // m/s sideways that counts as flat out sideways
export const slipOf = (car) => clamp(Math.abs(car.slide ?? 0) / SLIDING, 0, 1);

// The car is { x, z, yaw, speed, slide, yawRate }: `speed` is along the way
// it points (negative backwards) and `slide` across it, toward the side a
// positive turn of the wheel swings the nose to (so a car whose tail has come
// out to the left is sliding one way, and to the right the other); `yawRate`
// is how fast it's turning. A car without the last two is one that grips
// and isn't turning (one parked before it could slide).
//
// One step of driving. input: { throttle −1…1, steer −1…1, handbrake,
// assist 0…2 (how much it straightens itself out of a slide; 1 as it comes) }.
// Returns the car, how hard it bumped into something (m/s into it, 0 if it
// didn't), how hard its tyres are sliding (0…1) and what it's on. However
// long the step, it's worked out in slices no longer than STEP, so the car
// drives the same at any frame rate.
const STEP = 1 / 120;
const LONGEST = 0.25;
const BOUNCE = 0.15;
export function stepCar(car, input = {}, dt) {
  const c = { x: car.x, z: car.z, yaw: car.yaw, speed: car.speed ?? 0, slide: car.slide ?? 0, yawRate: car.yawRate ?? 0 };
  const out = { car: c, bump: 0, slip: 0, surface: surfaceAt(c.x, c.z) };
  if (!(dt > 0)) return out;
  // (a frame that long is a stall, not driving; and nothing that isn't a
  // number gets as far as the car)
  const span = Math.min(dt, LONGEST);
  const num = (v, a, b, or = 0) => (Number.isFinite(v) ? clamp(v, a, b) : or);
  const ask = { throttle: num(input.throttle, -1, 1), steer: num(input.steer, -1, 1), handbrake: !!input.handbrake, assist: num(input.assist, 0, 2, 1) };
  const n = Math.max(1, Math.ceil(span / STEP - 1e-9));
  const h = span / n;
  for (let i = 0; i < n; i++) slice(c, ask, h, out);
  return out;
}

// what's left of a velocity (vx, vz) that has run into something whose face
// looks along (nx, nz): out of it with a little bounce, and scrubbed along it
// the harder it hit. Returns how hard that was.
const hitV = { x: 0, z: 0 };
function strike(vx, vz, nx, nz) {
  const vn = vx * nx + vz * nz;
  hitV.x = vx;
  hitV.z = vz;
  if (vn >= 0) return 0;
  const tx = vx - vn * nx;
  const tz = vz - vn * nz;
  const keep = 1 - Math.min(0.35, 0.05 * -vn);
  hitV.x = tx * keep - BOUNCE * vn * nx;
  hitV.z = tz * keep - BOUNCE * vn * nz;
  return -vn;
}

function slice(c, { throttle, steer, handbrake, assist }, h, out) {
  const surface = surfaceAt(c.x, c.z);
  const top = TOP[surface];
  let f = c.speed;
  let s = c.slide;
  let w = c.yawRate;

  // ── along: the engine, the brakes, the handbrake, and coasting down ──
  // (against the handbrake the engine gets a third of its pull to the road,
  // less than the handbrake holds: it's a brake, either way)
  const pull = handbrake ? 0.35 : 1;
  if (throttle > 0) f += (f < 0 ? CAR.brake : CAR.accel * (1 - CAR.taper * clamp(f / top, 0, 1)) * pull) * throttle * h;
  else if (throttle < 0) f += (f > 0 ? CAR.brake : f > -CAR.reverse ? CAR.accel * 0.6 * pull : 0) * throttle * h;
  else f -= Math.sign(f) * Math.min(Math.abs(f), CAR.coast * h);
  if (handbrake) f -= Math.sign(f) * Math.min(Math.abs(f), CAR.handbrake * h);
  // over the limit (onto the sand at speed; backwards out of a spin, faster
  // than reverse goes), it bleeds off rather than stops
  if (f > top) f = Math.max(top, f - CAR.brake * 0.6 * h);
  if (f < -CAR.reverse) f = Math.min(-CAR.reverse, f + CAR.brake * 0.6 * h);

  // ── round: the wheel, as far as it goes at this speed ──
  const v = Math.abs(f);
  const lock = Math.min(CAR.lock, Math.atan((CAR.wheelbase * CAR.grip[surface] * CAR.bite[surface]) / Math.max(v * v, 1e-6)));
  const turn = steer;
  let want = (f * Math.tan(lock * turn)) / CAR.wheelbase;
  let response = CAR.response;
  if (handbrake) {
    // the tail comes round the way the wheel is turned, and once it's
    // swinging its own weight carries it on (past sideways, where the front
    // wheels would steer it back): it's letting go that stops a spin
    const going = Math.hypot(f, s);
    want = Math.sign(f || 1) * turn * Math.min(CAR.spin, (CAR.swing * going * Math.tan(lock)) / CAR.wheelbase);
    response = CAR.responseLoose;
    if (want * w < 0) {
      want = 0;
      response = CAR.carry;
    } else if (Math.abs(want) < Math.abs(w)) response = CAR.carry;
  } else if (f > 1) {
    // gripping, it straightens itself out of a small slide, toward the way
    // it's going; a big one (the tail well out, off the handbrake) is left
    // alone, and the tyres pull the car round to where it points instead
    const off = Math.atan2(s, f);
    const big = clamp((Math.abs(off) - 0.3) / 0.6, 0, 1);
    want += CAR.align * clamp(assist, 0, 2) * off * (1 - big * big * (3 - 2 * big));
  }
  w += (want - w) * (1 - Math.exp(-h * response));
  // (it can't turn faster than it's moving: a spin stops with the car)
  const most = Math.hypot(f, s) / CAR.pivot;
  w = clamp(w, -most, most);
  const turned = w * h;
  const yaw = c.yaw + turned;
  // the car has turned under the way it was going
  const cs = Math.cos(turned);
  const sn = Math.sin(turned);
  const f1 = f * cs + s * sn;
  s = s * cs - f * sn;
  f = f1;

  // ── across: the tyres pull it back into line, as hard as they can hold ──
  // (a tyre that's sliding holds a little less than one that's gripping,
  // and less again with the power on: a slide is held on the throttle and
  // ended by lifting off)
  const sliding = clamp((Math.abs(s) - 0.5) / 2, 0, 1);
  const grip = CAR.grip[surface] * (handbrake ? CAR.loose : 1) * (1 - sliding * (0.15 + CAR.power * Math.max(0, throttle)));
  s = Math.abs(s) <= grip * h ? 0 : s - Math.sign(s) * grip * h;

  // ── where that takes it ──
  const hx = Math.sin(yaw);
  const hz = Math.cos(yaw);
  let vx = hx * f + hz * s;
  let vz = hz * f - hx * s;
  let x = c.x + vx * h;
  let z = c.z + vz * h;
  let hit = 0;
  // the buildings: the car is a circle, pushed out of any footprint it's in
  for (const b of COLLIDERS) {
    const px = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const pz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
    const dx = x - px;
    const dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= CAR.radius) continue;
    if (d > 1e-6) {
      x = px + (dx / d) * CAR.radius;
      z = pz + (dz / d) * CAR.radius;
      hit = Math.max(hit, strike(vx, vz, dx / d, dz / d));
      vx = hitV.x;
      vz = hitV.z;
    } else {
      // inside it: out the way it came
      x = c.x;
      z = c.z;
      hit = Math.max(hit, Math.hypot(vx, vz));
      vx *= -0.2;
      vz *= -0.2;
    }
  }
  // the edge of the world
  const r = Math.hypot(x, z);
  if (r > WORLD_RADIUS) {
    x *= WORLD_RADIUS / r;
    z *= WORLD_RADIUS / r;
    hit = Math.max(hit, strike(vx, vz, -x / WORLD_RADIUS, -z / WORLD_RADIUS));
    vx = hitV.x;
    vz = hitV.z;
  }
  if (hit > 0) {
    f = vx * hx + vz * hz;
    s = vx * hz - vz * hx;
    w *= 0.6;
    out.bump = Math.max(out.bump, hit);
  }
  c.x = x;
  c.z = z;
  c.yaw = yaw;
  c.speed = f;
  c.slide = s;
  c.yawRate = w;
  out.slip = Math.max(slipOf(c), handbrake && Math.hypot(f, s) > 3 ? 0.55 : 0);
  out.surface = surface;
}

// ── the wheel in your hands ──

// The driving settings, kept between visits (the universe map's flying
// settings, for the road): how quickly the wheel goes over, how much the
// car straightens itself out of a slide (none, and a slide is yours to
// catch), and how tightly the camera swings round behind.
export const DRIVING_KEY = 'tp-abq-driving';
export const DRIVING = {
  steer: { min: 0.5, max: 2, step: 0.05, label: 'Steering', hint: 'How quickly the wheel goes over' },
  assist: { min: 0, max: 2, step: 0.1, label: 'Stability', hint: 'How much the car straightens itself out of a slide' },
  camera: { min: 0.5, max: 2, step: 0.05, label: 'Camera follow', hint: 'How tightly it swings round behind' },
};
export const DRIVING_DEFAULTS = { steer: 1, assist: 1, camera: 1 };
// whatever was kept (or nothing), as settings that can be used
export function readDriving(raw) {
  const d = { ...DRIVING_DEFAULTS };
  if (!raw || typeof raw !== 'object') return d;
  for (const [k, r] of Object.entries(DRIVING)) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) d[k] = clamp(raw[k], r.min, r.max);
  return d;
}

// The wheel, turned toward where the keys or the stick ask (−1…1), one step
// on. Keys are all or nothing, so the wheel goes over at a rate: quickly at
// parking speed, slower the faster the car is going (a twitch at speed is a
// swerve), and back to the middle quicker than it left. A stick (`analog`)
// says how far itself, with fine control near its middle, and the wheel
// follows it almost at once. `steer` is the setting above.
export function stepSteer(wheel, target, speed, dt, { steer = 1, analog = false } = {}) {
  let to = Number.isFinite(target) ? clamp(target, -1, 1) : 0;
  if (analog) to = Math.sign(to) * Math.abs(to) ** 1.7;
  const k = clamp(Math.abs(speed) / CAR.top, 0, 1);
  const away = Math.abs(to) > Math.abs(wheel) && to * wheel >= 0;
  const rate = (analog ? 12 : away ? 8 - 4.6 * k : 10) * steer;
  const d = to - wheel;
  const step = rate * dt;
  return Math.abs(d) <= step ? to : wheel + Math.sign(d) * step;
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
