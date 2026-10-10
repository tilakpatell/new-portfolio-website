// The heroes' abilities as Star Wars Battlefront II (2017) has them, read
// from the game's own gameplay data (the drop's data/ folder: Frostbite
// assets as JSON, an `objects` array with `$ref` indices into it and
// `$asset` names of other assets). Pure: every function takes parsed
// documents, so the tests run on a fixture and scripts/bf2017-abilities.mjs
// does the reading.
//
// How the game holds an ability, and so what this reads:
// - a hero's gameplay asset (GP_Hero_<Hero>) lists its abilities in a
//   PlayerAbilityCollection;
// - each ability (a *PlayerAbilityAsset) has its RechargeTime,
//   ActivationTime and ActiveTime, the button it sits on (`Category`), the
//   prefab that does it (`Blueprint`), and AbilityModifiers: values the
//   prefab reads through a PlayerAbilityPropertyOutputEntityData, named by
//   a hash (OutputHash) and given per ability level (the first is the
//   ability as it comes, the rest are a star card's);
// - the prefab (a LogicPrefabBlueprint) is a graph: entities, and
//   PropertyConnections between their fields, each field named by its
//   hash. Frostbite's field hash is djb2 with xor (fieldHash), so a field
//   whose name we know reads back: an output that feeds a query's
//   `FilterOutAngle` and the cone's `ConeAngle` is the cone; one that feeds
//   a SphereQuery's `Radius` (through the ConditionalFloat a star card
//   switches) is the range;
// - what lands is an affector the prefab applies (AffectorApplyEntityData:
//   the affector asset, its Duration and the Rank of the asset's RankData it
//   uses): a DamageAffectorAsset's InitialDamage, DamageToDealPerSecond and
//   DamageInterval; a DamageMultiplierAffectorAsset's DamageMultiplier; a
//   DamageShieldAffectorAsset's StartValue; a knockback's distance in its
//   name (Affector_ForcePushed_10m);
// - who it lands on: an AffectorQueryFilterEntityData on the heroes'
//   descriptors (the light and dark side affectors every hero spawns with)
//   splits the targets, its first output (HERO_PASS) the heroes and its
//   second (HERO_FAIL) everyone else, so a damage affector fed by the
//   first is the damage to a hero, by the second to a trooper (Anakin's
//   Heroic Impact names its trooper one Affector_Damage_…_Trooper and wires
//   it to the second, which is how the two outputs were told apart).
//
//   fieldHash(name)                 Frostbite's hash of a field name (int32)
//   abilitiesOfKit(gp)              → [asset name…] the hero's kit, in the game's order
//   healthOf(gp)                    → the MaxHealthAffectorAsset the hero spawns with (its hit points), or null
//   readAbility(doc)                → { asset, type, slot, recharge, activation, active, blueprint, outputs: { hash: level-one value } }
//   outputRoles(doc, id)            → { hash: role } what each of ability `id`'s outputs feeds (ROLE_OF_FIELD), in this prefab
//   prefabFacts(doc)                → { applies: [{ affector, duration, rank, vs }], radii, refs, missile }
//   affectorFacts(doc)              → { type, damage: [per rank], perSecond, interval, multiplier, shield, maxHealth }
//   damageOf(applies, affectors)    → { hero?, trooper?, any?, from } the ability's own damage (no star card's)
//   knockOf(applies)                → { metres, from } | null
//   abilityRow({ ability, roles, facts, affectors, kind })   → the row bf2017Abilities.json keeps
//   HEROES_2017                     { folder: site id } the heroes read (none of the sequel era)

const HERO_SIDES = [4161031954, 1555918390]; // Affector_Hero_LightSide, Affector_Hero_DarkSide
const HERO_PASS = 309214835;
const HERO_FAIL = 1495681468;

export function fieldHash(name) {
  let h = 5381;
  for (const c of name) h = Math.imul(h, 33) ^ c.charCodeAt(0);
  return h | 0;
}

// the fields whose names say what a number is, and the roles they give it
const ROLE_OF_FIELD = { FilterOutAngle: 'cone', ConeAngle: 'cone', Angle: 'cone', Radius: 'range', MaxRange: 'range', ChokeDuration: 'hold' };
const FIELD_NAME = new Map(['ValueIfFalse', 'ValueIfTrue', 'Output', ...Object.keys(ROLE_OF_FIELD)].map((n) => [fieldHash(n), n]));
// (an output named outright: the hash of its own name)
const OUTPUT_NAME = new Map(['MaxRange', 'ChokeDuration'].map((n) => [fieldHash(n) >>> 0, n]));

export const HEROES_2017 = {
  Luke: 'luke',
  DarthVader: 'vader',
  ObiWan: 'obiwan',
  Anakin: 'anakin',
  Maul: 'maul',
  Dooku: 'dooku',
  Emperor: 'palpatine',
  HanSolo: 'han',
  Leia: 'leia',
  Lando: 'lando',
  Chewbacca: 'chewie',
  BobaFett: 'bobafett',
  Bossk: 'bossk',
  Yoda: 'yoda',
  Grievous: 'grievous',
  Iden: 'iden',
};

// what each ability is, in a word the site's rules know (abilityRules.js
// plays some; the rest are kept for when it does): the game's own name for
// it is the asset's, so this is the one judgement in the file
export const KIND = {
  Ability_Luke_ForcePush: 'push',
  Ability_Luke_ForceRepulse: 'repulse',
  Ability_Luke_Dash: 'rush',
  Ability_DarthVader_ForceChoke_02: 'choke',
  Ability_DarthVader_SaberThrowCharacterState: 'saberThrow',
  Ability_Vader_FocusRage: 'rage',
  DefaultAbility_ObiWan_AllOutPush: 'push',
  DefaultAbility_ObiWan_DefensiveRush: 'rush',
  Ability_ObiWan_RestrictiveMindTrick: 'mindTrick',
  DefaultAbility_Anakin_ImpassionateStrike: 'strike',
  DefaultAbility_Anakin_HeroicImpact: 'slam',
  DefaultAbility_Anakin_PullDominance: 'pull',
  DefaultAbility_Anakin_Retribution: 'choke',
  Ability_DarthMaul_SpinAttackCharacterState: 'rush',
  Ability_Maul_ForceChoke: 'choke',
  Ability_DarthMaul_SaberThrowCharacterState: 'saberThrow',
  DefaultAbility_Dooku_LightningStun: 'electrocute',
  DefaultAbility_Dooku_Duelist: 'rage',
  DefaultAbility_Dooku_ExposeWeakness: 'weaken',
  Ability_Emperor_ChainLightningCS: 'chainLightning',
  Ability_Emperor_ForceLightning: 'lightning',
  Ability_Emperor_ElectrocuteCS: 'electrocute',
  Ability_Emperor_DarkAura: 'aura',
  Ability_Yoda_ForceAbsorb: 'absorb',
  Ability_Yoda_DashAttack_CharacterState: 'rush',
  Ability_Yoda_ForceBarrier: 'barrier',
  DefaultAbility_Grievous_ClawRush: 'rush',
  DefaultAbility_Grievous_UnrelentingAdvance: 'rage',
  DefaultAbility_Grievous_ThrustSurge: 'rush',
  Ability_HanSolo_ShoulderCharges: 'charge',
  Ability_HanSolo_DemolitionGrenade: 'detonator',
  Ability_HanSolo_Sharpshooterz: 'overcharge',
  Ability_Leia_BubbleShield: 'barrier',
  Ability_Leia_ThermalDetonator_Fake: 'detonator',
  Ability_BlasterRifle_E11_Leia: 'rifle',
  Ability_Lando_SharpShot: 'sharpShot',
  Ability_GrenadeSmoke_Lando: 'smoke',
  Ability_Lando_Disruptor: 'pulse',
  Ability_Chewbacca_GrenadeStun: 'detonator',
  Ability_Weapon_FuriousBowcaster: 'overcharge',
  Ability_Chewbacca_Leap: 'slam',
  Ability_BobaFett_Ping: 'scan',
  Ability_BobaFett_Concussion_Rocket: 'rocket',
  Ability_BobaFett_RocketBarrage: 'barrage',
  Ability_Bossk_GrenadeDioxis: 'detonator',
  Ability_Bossk_ExplosiveTraps_New: 'mine',
  Ability_Bossk_PredatorInstincts: 'scan',
  Ability_Iden_Droid_Shield: 'barrier',
  Ability_Iden_Pulse_Cannon: 'rifle',
  Ability_Iden_Droid_Stun: 'pulse',
};

const short = (name) => String(name).split('/').pop();
const rootOf = (doc) => doc.objects[doc.root ?? 0];
const obj = (doc, r) => (r && r.$ref != null ? doc.objects[r.$ref] : null);

// the abilities a kit lists that are the hero's own (not the shared jump,
// dodge, block, emotes, poses and voice lines, nor the weapon itself)
const SHARED = /Emote|VictoryPose|VoiceLine|Evade|Jump|Deflect|LightSaber|Lightsaber|Melee|\/Ability_hero_|\/Ability_Hero_|DefaultAbility_Hero_|Altfire|StarCard/;
export function abilitiesOfKit(gp) {
  const col = gp.objects.find((o) => o.$type === 'PlayerAbilityCollection');
  return (col?.Abilities ?? []).map((a) => a.$asset).filter((n) => n && !SHARED.test(n));
}

// the hero's hit points come from an affector it spawns with
export function healthOf(gp) {
  const a = rootOf(gp).AffectorsAppliedOnSpawn ?? [];
  return a.find((x) => x?.$assetType === 'MaxHealthAffectorAsset')?.$asset ?? null;
}

// (the button: Left, Middle and Right are the game's three, Bottom Anakin's fourth)
const SLOT = { PlayerAbilityCategory_Left: 'left', PlayerAbilityCategory_Middle: 'middle', PlayerAbilityCategory_Right: 'right', PlayerAbilityCategory_Bottom: 'bottom' };
export function readAbility(doc) {
  const a = rootOf(doc);
  const outputs = {};
  for (const r of a.AbilityModifiers ?? []) {
    const m = obj(doc, r);
    if (m?.OutputHash == null) continue;
    const v = obj(doc, m.Values?.[0]);
    if (typeof v?.Value === 'number') outputs[m.OutputHash >>> 0] = v.Value;
  }
  return {
    asset: a.Name ?? doc.name,
    type: a.$type,
    id: a.Identifier ?? null,
    slot: SLOT[a.Category] ?? null,
    recharge: a.RechargeTime ?? null,
    activation: a.ActivationTime ?? null,
    active: a.ActiveTime ?? null,
    blueprint: a.Blueprint?.$asset ?? null,
    outputs,
  };
}

const conns = (doc) => rootOf(doc).PropertyConnections ?? [];

// where each of an ability's outputs goes in its prefab, as roles: straight
// into a named field, or through the ConditionalFloat a star card switches
// (its ValueIfFalse, out of its Output); an output named by its own hash
// keeps that name's role
export function outputRoles(doc, abilityId) {
  const roles = {};
  const all = conns(doc);
  const from = (ref, field) => all.filter((c) => c.Source?.$ref === ref && (field == null || (c.SourceFieldId | 0) === (field | 0)));
  doc.objects.forEach((o, i) => {
    if (o.$type !== 'PlayerAbilityPropertyOutputEntityData' || (abilityId != null && o.PlayerAbilityIdentifier !== abilityId)) return;
    for (const c of from(i, null)) {
      const hash = c.SourceFieldId >>> 0;
      if (roles[hash]) continue;
      const own = OUTPUT_NAME.get(hash);
      if (own) {
        roles[hash] = { role: ROLE_OF_FIELD[own], via: own };
        continue;
      }
      const hit = roleOf(doc, c, from);
      if (hit) roles[hash] = hit;
    }
  });
  return roles;
}

function roleOf(doc, c, from) {
  const name = FIELD_NAME.get(c.TargetFieldId | 0);
  const target = obj(doc, c.Target);
  const where = (n) => `${(target?.$type ?? '').replace(/EntityData$/, '')}${target?.Blueprint?.$asset ? ` (${short(target.Blueprint.$asset)})` : ''}.${n}`;
  if (name && ROLE_OF_FIELD[name]) return { role: ROLE_OF_FIELD[name], via: where(name) };
  if (target?.$type === 'ConditionalFloatEntityData' && name === 'ValueIfFalse') {
    for (const next of from(c.Target.$ref, fieldHash('Output'))) {
      const hit = roleOf(doc, next, from);
      if (hit) return { role: hit.role, via: `ConditionalFloat → ${hit.via}` };
    }
  }
  return null;
}

// An output's hash is its name, the same name in every ability (Luke's,
// Maul's and the Emperor's cones are all 1697178449), so an output one
// prefab feeds through arithmetic the trace can't follow (Obi-Wan's push
// range, into a MathEntity) takes the role another prefab gives it
// plainly. Fills each entry's `roles` in place; returns them.
export function shareRoles(entries) {
  const known = new Map();
  for (const e of entries) for (const [hash, r] of Object.entries(e.roles)) if (!r.shared && !known.has(hash)) known.set(hash, { ...r, asset: short(e.ability.asset) });
  for (const e of entries)
    for (const hash of Object.keys(e.ability.outputs)) {
      const k = known.get(hash);
      if (e.roles[hash] || !k) continue;
      e.roles[hash] = { role: k.role, via: `the output ${k.asset} feeds to ${k.via}`, shared: true };
    }
  return entries.map((e) => e.roles);
}

// which way an applied affector's targets come: a hero filter's first output is the heroes
function vsOf(doc, applyIndex) {
  for (const c of conns(doc)) {
    if (c.Target?.$ref !== applyIndex) continue;
    const src = obj(doc, c.Source);
    if (src?.$type !== 'AffectorQueryFilterEntityData' || !(src.DescriptorIds ?? []).some((d) => HERO_SIDES.includes(d >>> 0))) continue;
    if ((c.SourceFieldId >>> 0) === HERO_PASS) return 'hero';
    if ((c.SourceFieldId >>> 0) === HERO_FAIL) return 'trooper';
  }
  return null;
}

// (the prefabs an ability's own prefab hands work to: its hero's, the shared hero ones, and projectiles)
const FOLLOW = /^Gameplay\/Kits\/Hero\/(?!PF_AOE_)|Projectile/i;
export function prefabFacts(doc) {
  const applies = [];
  const radii = new Set();
  const refs = new Set();
  let missile = null;
  doc.objects.forEach((o, i) => {
    if (o.$type === 'AffectorApplyEntityData' && o.Affector?.$asset) applies.push({ affector: o.Affector.$asset, duration: o.Duration ?? 0, rank: o.Rank ?? 0, vs: vsOf(doc, i) });
    if (o.$type === 'SphereQueryEntityData' && o.Radius > 0) radii.add(o.Radius);
    if (i > 0 && o.Blueprint?.$asset && FOLLOW.test(o.Blueprint.$asset)) refs.add(o.Blueprint.$asset);
    const proj = o.FireProjectileData?.ProjectileBlueprint?.$asset;
    if (proj) refs.add(proj);
    if (o.$type === 'WSMissileEntityData') missile = { speed: o.MaxSpeed ?? null };
  });
  return { applies, radii: [...radii].sort((a, b) => a - b), refs: [...refs], missile };
}

export function affectorFacts(doc) {
  const a = rootOf(doc);
  const ranks = a.RankData ?? [];
  const col = (k) => (ranks.some((r) => typeof r[k] === 'number' && r[k] !== 0) ? ranks.map((r) => r[k] ?? 0) : null);
  return {
    type: a.$type,
    damage: col('InitialDamage'),
    perSecond: col('DamageToDealPerSecond'),
    interval: ranks.length && col('InitialDamage') ? (ranks[0].DamageInterval ?? null) : null,
    multiplier: col('DamageMultiplier'),
    shield: col('StartValue'),
    maxHealth: typeof a.MaxHealth === 'number' ? a.MaxHealth : null,
  };
}

// a star card's (or a choked, doubled or added) variant, not the ability as it comes
const UPGRADE = /StarCard|Card\d|_Extra|Addition|Double|Choked|_SP$/i;
export function damageOf(applies, affectors) {
  const out = {};
  const from = [];
  for (const ap of applies) {
    const name = short(ap.affector);
    const f = affectors[ap.affector];
    const ranks = f?.damage ?? f?.perSecond;
    if (!ranks || UPGRADE.test(name)) continue;
    const at = Math.min(ap.rank, ranks.length - 1);
    const value = f.damage?.[at] ?? 0;
    const per = f.perSecond?.[at] ?? 0;
    const vs = /Trooper/i.test(name) ? 'trooper' : ap.vs;
    const key = vs ?? 'any';
    if (out[key] != null) continue;
    // (a choke's one point up front is a token: its damage is by the second)
    out[key] = per ? { perSecond: per, for: ap.duration } : value;
    from.push(`${name}${ranks.length > 1 ? ` rank ${at}` : ''}${vs ? ` (to a ${vs})` : ''}`);
  }
  return Object.keys(out).length ? { ...out, from: from.join('; ') } : null;
}

export function knockOf(applies) {
  const ms = applies.map((a) => short(a.affector).match(/ForcePushed_(\d+(?:\.\d+)?)m$/)).filter(Boolean);
  if (!ms.length) return null;
  const least = ms.reduce((a, b) => (+a[1] <= +b[1] ? a : b));
  return { metres: +least[1], from: `${least[0]}${ms.length > 1 ? ' (the least of the prefab’s; the rest are a star card’s)' : ''}` };
}

const r2 = (v) => Math.round(v * 100) / 100;

// the row the site keeps for one ability: its times, and each number the
// data gives with where it came from
export function abilityRow({ ability, roles = {}, facts, affectors = {}, kind }) {
  const row = { asset: short(ability.asset), kind, slot: ability.slot, recharge: ability.recharge, activation: ability.activation, active: ability.active };
  const from = { times: `${short(ability.asset)} (RechargeTime, ActivationTime, ActiveTime)` };
  for (const [hash, value] of Object.entries(ability.outputs)) {
    const r = roles[hash];
    if (!r || row[r.role] != null) continue;
    row[r.role] = value;
    from[r.role] = `${short(ability.asset)} modifier ${hash} → ${r.via}`;
  }
  const dmg = damageOf(facts.applies, affectors);
  if (dmg) {
    const { from: f, ...d } = dmg;
    row.damage = Object.keys(d).length === 1 && d.any != null ? d.any : d;
    from.damage = f;
  }
  const knock = knockOf(facts.applies);
  if (knock) {
    row.knock = knock.metres;
    from.knock = knock.from;
  }
  // (the hit's reach where no output set one: the prefab's own sphere)
  if (row.range == null && facts.radii.length) {
    row.reach = facts.radii[0];
    from.reach = `the prefab’s SphereQuery Radius${facts.radii.length > 1 ? ` (the least of ${facts.radii.join(', ')})` : ''}`;
  }
  // what it does to its user: a damage multiplier taken, a shield's hit points
  for (const ap of facts.applies) {
    const f = affectors[ap.affector];
    const name = short(ap.affector);
    if (UPGRADE.test(name)) continue;
    if (f?.multiplier && row.taken == null) {
      row.taken = r2(f.multiplier[Math.min(ap.rank, f.multiplier.length - 1)]);
      from.taken = `${name} DamageMultiplier`;
    }
    if (f?.shield && row.shield == null) {
      row.shield = f.shield[0];
      from.shield = `${name} StartValue`;
    }
  }
  if (facts.missile?.speed) {
    row.speed = facts.missile.speed;
    from.speed = 'the projectile’s MaxSpeed';
  }
  return { ...row, from };
}
