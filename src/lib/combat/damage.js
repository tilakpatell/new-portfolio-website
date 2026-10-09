// One resolver for every hit: a blade's sweep, a bolt, a Force push. It
// turns a hit (where, which way) and an attack (how much, what kind) on a
// victim into what the victim takes (the damage, by region), what the
// body does (a knock, along the hit, lifted for a heavy one) and what the
// mind does (a stun, by kind; none for a kill, whose body goes to `dead`;
// none for a block, which takes half the knock and no damage). Pure.
//
//   KNOCK: { light, heavy, lethal } m/s at the chest; STUN: { light, heavy, broken } s (duel.js's stagger numbers);
//   WHERE: { [region]: × damage } (a region not listed counts 1: the body)
//   resolve(hit, attack, victim) → { damage, hp, dir: [x, y, z], force, kind, where, stun }
//     hit: { victim, tag, at, dir } (a strike's or a bolt's); attack: { damage, kind: 'light' | 'heavy' };
//     victim: { hp, blocking? }; kind out: 'light' | 'heavy' | 'lethal' | 'blocked'

export const KNOCK = { light: 2.5, heavy: 6, lethal: 8 };
export const STUN = { light: 0.3, heavy: 1.2, broken: 2 };
export const WHERE = { head: 2, chest: 1, upperArmL: 0.6, upperArmR: 0.6, foreArmL: 0.5, foreArmR: 0.5, thighL: 0.7, thighR: 0.7, shinL: 0.5, shinR: 0.5, whole: 1 };
const LIFT = 0.25;

export function resolve(hit, attack, victim) {
  const where = hit.tag ?? 'whole';
  const share = WHERE[where] ?? 1;
  const blocked = !!victim.blocking;
  const damage = blocked ? 0 : Math.round(attack.damage * share * 10) / 10;
  const hp = victim.hp - damage;
  const kind = blocked ? 'blocked' : hp <= 0 ? 'lethal' : attack.kind === 'heavy' ? 'heavy' : 'light';
  const force = kind === 'blocked' ? KNOCK[attack.kind === 'heavy' ? 'heavy' : 'light'] / 2 : KNOCK[kind];
  const stun = kind === 'lethal' || kind === 'blocked' ? 0 : STUN[kind];
  const d = hit.dir ?? [0, 0, 0];
  const flat = Math.hypot(d[0], d[2]);
  const lift = kind === 'heavy' || kind === 'lethal' ? LIFT : 0;
  const dir = flat > 1e-6 ? [d[0] / flat, lift, d[2] / flat] : [0, 0, 0];
  return { damage, hp, dir, force, kind, where, stun };
}
