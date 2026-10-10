// The rulebooks' rows, built from the 2017 data dump (see bf2017-ebx.mjs for
// what an asset is). Each builder follows one kind's chain of `$asset`
// pointers and keeps the numbers the game's rules use, each with a
// `<key>_source` naming where it came from (`<asset>#<Type>.<path>`), so a
// value in a rulebook can always be checked against the record it came from.
//
// A link the export lacks (a `$asset` naming a record not there) never throws:
// the row keeps what it could read, leaves the rest out and lists the missing
// links in `_missing`.
//
// The weapon chain, as the A280C reads:
//
//   Ability_Weapon_* (SoldierWeaponPlayerAbilityAsset).Unlock
//   → U_* (SoldierWeaponUnlockAsset).NonStreamedBlueprint
//   → W_* (SoldierWeaponBlueprint): SoldierWeaponData (WeaponFiring, ZoomLevels,
//     MaxRangeMeterDistance), BlasterWeaponData.ProjectileParameters (damage
//     multipliers), WeaponOverheatModifier.HeatPerBullet,
//     OverheatComponentData.OverheatConfig
//   → WeaponFiring_* (WeaponFiringDataAsset).Data → WeaponFiringData (DeployTime,
//     WeaponSway) and its PrimaryFire → FiringFunctionData (FireLogic, Shot,
//     OverHeat, Ammo)
//   → Shot.ProjectileData → BlasterProjectile_* (GameDataContainerAsset).Data →
//     WSBulletEntityData: the damage fields are StartDamage, EndDamage,
//     DamageFalloffStartDistance, DamageFalloffEndDistance; the bolt's colour
//     is in its TrailEffect's name (FX_BlasterBolt_Rifle_Red)
//   → WeaponSway_* (GunSwayData.Dispersion[], CameraRecoilData)
//   → OverheatConfig_* (OverheatConfig: the heat bar and ActiveCooldownSettings)
//
// A weapon's display name is the string `ID_W_<id>` (ID_W_A280C → "A280C").

import { assetRefs, deref, follow, objectsOf, pick, pointee, readIndex, rootOf, shortName } from './bf2017-ebx.mjs';

export { isSequel } from './bf2017-ebx.mjs';

// ── sources ──────────────────────────────────────────────────────────────

const where = (asset, obj, path) => `${asset.name}#${obj.$type}.${path}`;

// Sets row[key] from obj at path with its source, when the value is there.
function take(row, key, asset, obj, path) {
  const v = obj ? pick(obj, path) : undefined;
  if (v === undefined || v === null) return undefined;
  row[key] = v;
  row[`${key}_source`] = where(asset, obj, path);
  return v;
}

export function withSources(row, sources) {
  for (const [k, s] of Object.entries(sources)) row[`${k}_source`] = s;
  return row;
}

// The numeric leaves that name no source: neither a `<key>_source` beside
// them (or beside the array they sit in), nor an object `_source`, nor a
// `source: 'hand'` on an ancestor. (Copied into src/data/bf2017/rulebook.test.js.)
export function checkSources(json) {
  const bad = [];
  const walk = (v, path, covered) => {
    if (typeof v === 'number') return covered || bad.push(path);
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}.${i}`, covered));
    const all = covered || v.source === 'hand' || typeof v._source === 'string';
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('_source') || k === '_from') continue;
      walk(x, path ? `${path}.${k}` : k, all || typeof v[`${k}_source`] === 'string');
    }
  };
  walk(json, '', false);
  return bad;
}

// ── helpers ──────────────────────────────────────────────────────────────

const indexes = new Map();
export function indexOf(root) {
  if (!indexes.has(root)) indexes.set(root, readIndex(root));
  return indexes.get(root);
}

// The pointee of an `$asset`, or a line in `missing` when the export lacks it.
function reach(root, v, missing, what) {
  if (!v?.$asset) return null;
  const p = pointee(root, v);
  if (!p) missing.push(`${what}: ${v.$asset}`);
  return p;
}

// The first `$asset` an object holds under a key.
const refNamed = (obj, key) => assetRefs(obj).find((r) => r.key === key)?.name ?? null;

const FAMILIES = { Rifles: 'rifle', Pistols: 'pistol', Heavy: 'heavy', LongRange: 'sniper', ShortRange: 'shortRange', Heroes: 'hero', Special: 'special', Specials: 'special', Grenades: 'grenade', Gadgets: 'gadget', Creature: 'creature' };
const familyOf = (name) => {
  const folder = name.split('/')[2] ?? '';
  return FAMILIES[folder] ?? folder.toLowerCase();
};

// `W_BlasterRifle_A280C` → `a280c`.
export const weaponId = (blueprintName) => shortName(blueprintName).split('_').pop().toLowerCase();

const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'white'];
const colourIn = (name) => COLOURS.find((c) => new RegExp(`_${c}(_|$)`, 'i').test(name)) ?? null;

// A weapon's blueprint from its ability, its unlock or itself.
function weaponChain(root, name) {
  const chain = { ability: null, unlock: null, blueprint: null };
  let asset = follow(root, name);
  for (let hops = 0; asset && hops < 3; hops++) {
    const r = rootOf(asset);
    if (r.$type === 'SoldierWeaponBlueprint') {
      chain.blueprint = asset;
      break;
    }
    if (r.$type === 'SoldierWeaponUnlockAsset') {
      chain.unlock = asset;
      asset = follow(root, r.NonStreamedBlueprint);
    } else if (r.Unlock?.$asset) {
      chain.ability = asset;
      asset = follow(root, r.Unlock);
    } else break;
  }
  return chain;
}

const STANCES = ['stand', 'crouch', 'prone', 'moving', 'zoomStand', 'zoomCrouch', 'zoomProne', 'zoomMoving'];

// ── weapons ──────────────────────────────────────────────────────────────

export function weaponRow(root, name) {
  const { blueprint } = weaponChain(root, name);
  if (!blueprint) return null;
  const missing = [];
  const data = objectsOf(blueprint, 'SoldierWeaponData')[0];
  const row = { id: weaponId(blueprint.name), name: `ID_W_${weaponId(blueprint.name).toUpperCase()}`, family: familyOf(blueprint.name), blueprint: blueprint.name };

  const firingName = refNamed(data, 'WeaponFiring');
  const firing = firingName ? follow(root, firingName) : null;
  if (firingName && !firing) missing.push(`firing: ${firingName}`);
  const wfd = firing && deref(firing, rootOf(firing).Data);
  const fn = wfd && deref(firing, wfd.PrimaryFire);
  if (fn) {
    const f = (row.firing = {});
    take(f, 'rof', firing, fn, 'FireLogic.RateOfFire');
    if (fn.FireLogic.FireLogicType === 'fltBurstFire') {
      take(f, 'burst', firing, fn, 'Shot.NumberOfBulletsPerBurst');
      take(f, 'burstsPerMinute', firing, fn, 'FireLogic.BurstsPerMinute');
    }
    take(f, 'speed', firing, fn, 'Shot.InitialSpeed.z');
    take(f, 'bulletsPerShot', firing, fn, 'Shot.NumberOfBulletsPerShot');
    take(f, 'deploy', firing, wfd, 'DeployTime');
    if (fn.FireLogic.FireLogicType === 'fltHoldAndRelease') {
      f.charge = {};
      for (const [k, p] of [['maxHold', 'MaxHoldTime'], ['minPower', 'MinPowerModifier'], ['maxPower', 'MaxPowerModifier'], ['perSecond', 'PowerIncreasePerSecond']]) take(f.charge, k, firing, fn, `FireLogic.HoldAndRelease.${p}`);
    }
    f.mode = fn.FireLogic.FireLogicType.replace(/^flt/, '').replace(/Fire$/, '').toLowerCase();

    const capacity = fn.Ammo?.MagazineCapacity;
    if (capacity === -1) row.heat = heatOf(root, blueprint, firing, fn, missing);
    else {
      row.ammo = {};
      take(row.ammo, 'magazine', firing, fn, 'Ammo.MagazineCapacity');
      take(row.ammo, 'magazines', firing, fn, 'Ammo.NumberOfMagazines');
      take(row.ammo, 'reload', firing, fn, fn.FireLogic.ReloadTimeBulletsLeft > 0 ? 'FireLogic.ReloadTimeBulletsLeft' : 'FireLogic.ReloadTime');
    }

    const bolt = reach(root, fn.Shot?.ProjectileData, missing, 'projectile');
    const bullet = bolt && (deref(bolt.asset, rootOf(bolt.asset).Data) ?? bolt.obj);
    if (bullet) {
      const d = (row.damage = { projectile: bolt.asset.name });
      take(d, 'start', bolt.asset, bullet, 'StartDamage');
      take(d, 'end', bolt.asset, bullet, 'EndDamage');
      take(d, 'startDistance', bolt.asset, bullet, 'DamageFalloffStartDistance');
      take(d, 'endDistance', bolt.asset, bullet, 'DamageFalloffEndDistance');
      take(d, 'timeToLive', bolt.asset, bullet, 'TimeToLive');
      const blaster = objectsOf(blueprint, 'BlasterWeaponData')[0];
      take(d, 'min', blueprint, blaster, 'ProjectileParameters.MinDamageMultiplier');
      take(d, 'max', blueprint, blaster, 'ProjectileParameters.MaxDamageMultiplier');
      const blast = reach(root, bullet.Explosion, missing, 'explosion');
      if (blast) {
        d.blast = {};
        for (const [k, p] of [['damage', 'BlastDamage'], ['inner', 'InnerBlastRadius'], ['radius', 'BlastRadius'], ['shockwave', 'ShockwaveRadius'], ['impulse', 'BlastImpulse']]) take(d.blast, k, blast.asset, blast.obj, p);
      }
      row.colour = colourIn(bullet.TrailEffect3P?.$asset ?? bullet.TrailEffect1P?.$asset ?? '');
    }

    const sway = reach(root, wfd.WeaponSway, missing, 'sway');
    if (sway) {
      const gun = objectsOf(sway.asset, 'GunSwayData')[0];
      row.dispersion = (gun?.Dispersion ?? []).slice(0, STANCES.length).map((d, i) => ({
        stance: STANCES[i],
        min: d.MinAngle,
        max: d.MaxAngle,
        perShot: d.IncreasePerShot,
        decay: d.DecreasePerSecond,
        noFireDelay: d.NoFireTimeThreshold,
        _source: where(sway.asset, gun, `Dispersion.${i}`),
      }));
      const recoil = objectsOf(sway.asset, 'CameraRecoilData')[0];
      row.recoil = {};
      take(row.recoil, 'spring', sway.asset, recoil, 'SpringConstant');
      take(row.recoil, 'damping', sway.asset, recoil, 'SpringDamping');
    }
  }

  row.zoom = (data?.ZoomLevels ?? []).map((ref) => deref(blueprint, ref)).filter(Boolean).map((z) => ({ fov: z.RenderFov, zoomIn: z.AnimationSettings?.ZoomInSpeed, zoomOut: z.AnimationSettings?.ZoomOutSpeed, _source: where(blueprint, z, 'RenderFov') }));
  take(row, 'range', blueprint, data, 'MaxRangeMeterDistance');
  const folder = blueprint.name.slice(0, blueprint.name.lastIndexOf('/') + 1);
  row.mods = [...indexOf(root).keys()].filter((n) => n.startsWith(folder) && /^U_.*_(Barrel|Cell|Scope)$/.test(n.slice(folder.length))).map(shortName);
  row._missing = missing;
  return row;
}

function heatOf(root, blueprint, firing, fn, missing) {
  const heat = {};
  const mod = objectsOf(blueprint, 'WeaponOverheatModifier')[0];
  const conf = reach(root, objectsOf(blueprint, 'OverheatComponentData')[0]?.OverheatConfig, missing, 'overheat config');
  const cfg = conf && (deref(conf.asset, rootOf(conf.asset).Data) ?? conf.obj);
  const or = (key, a, aPath, b, bObj, bPath) => (pick(a.obj, aPath) > 0 ? take(heat, key, a.asset, a.obj, aPath) : bObj && take(heat, key, b, bObj, bPath));
  if (mod?.HeatPerBullet > 0) take(heat, 'perBullet', blueprint, mod, 'HeatPerBullet');
  else if (cfg) take(heat, 'perBullet', conf.asset, cfg, 'HeatPerBullet');
  if (cfg) {
    take(heat, 'dropPerSecond', conf.asset, cfg, 'HeatDropPerSecond');
    take(heat, 'dropDelay', conf.asset, cfg, 'OverheatDropDelay');
  } else take(heat, 'dropPerSecond', firing, fn, 'OverHeat.HeatDropPerSecond');
  // (the firing data's threshold and penalty, the config's when it has none)
  or('threshold', { asset: firing, obj: fn }, 'OverHeat.OverHeatThreshold', conf?.asset, cfg, 'OverHeatThreshold');
  or('penalty', { asset: firing, obj: fn }, 'OverHeat.OverHeatPenaltyTime', conf?.asset, cfg, 'OverHeatPenaltyTime');
  if (!cfg) return heat;
  take(heat, 'overheatedDrop', conf.asset, cfg, 'OverheatedDropMultiplier');
  take(heat, 'warning', conf.asset, cfg, 'HeatWarningThreshold');
  const ac = cfg.ActiveCooldownSettings;
  if (ac?.EnableActiveCooldown) {
    const c = (heat.cooling = {});
    const band = ac.DifficultyInterval?.[0];
    if (band) withSources(Object.assign(c, { window: [band.Start, band.End] }), { window: where(conf.asset, cfg, 'ActiveCooldownSettings.DifficultyInterval.0.{Start,End}') });
    take(c, 'shrink', conf.asset, cfg, 'ActiveCooldownSettings.DifficultyIncrementation.OnSuccess');
    take(c, 'reset', conf.asset, cfg, 'ActiveCooldownSettings.DifficultyIncrementation.OnFailure');
    take(c, 'successPenalty', conf.asset, cfg, 'ActiveCooldownSettings.SuccessPenaltyTime');
    take(c, 'failurePenalty', conf.asset, cfg, 'ActiveCooldownSettings.FailurePenaltyTime');
    take(c, 'minHeat', conf.asset, cfg, 'ActiveCooldownSettings.MinimumTriggerHeat');
    if (cfg.VentingSettings?.EnableVenting) take(c, 'vent', conf.asset, cfg, 'VentingSettings.Duration');
    const sup = band && deref(conf.asset, band.SuperZoneInterval);
    if (sup) withSources(Object.assign(c, { super: [sup.Start, sup.End] }), { super: where(conf.asset, sup, '{Start,End}') });
  }
  return heat;
}
