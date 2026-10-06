import { useState } from 'react';
import { HEROES, HILTS, SABER_COLORS, heroById } from '../heroes';
import { STANCES, STANCE_IDS } from './combatRules';
import { MAX_MODS, MODS, MOD_IDS, PICKABLE, WEAPONS, withMods } from './weaponRules';

// Who you play as down here, and what's in your hand: the roster
// (heroes.js) as cards; for a Jedi the blade's colour, the hilt and the
// stance (combatRules.js); for the others the gun (weaponRules.js, the
// galaxy's and the ones from elsewhere, with their numbers) and up to two
// mods on it. The choice is kept (pages/GalaxySurface.jsx writes it) and the
// world rebuilds with the new lead on Play.

const ARM = { saber: 'Lightsaber', bowcaster: 'Bowcaster', rifle: 'Blaster rifle', blaster: 'Blaster' };
const num = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toString();

export default function HeroPanel({ hero, onChange, onClose }) {
  const [pick, setPick] = useState(hero);
  const [tab, setTab] = useState('hero');
  const h = heroById(pick.id);
  const saber = h?.weapon === 'saber';
  const choose = (id) => {
    const next = heroById(id);
    setPick({ ...pick, id, color: next?.saber?.color ?? pick.color, hilt: next?.saber?.hilt ?? pick.hilt, stance: next?.saber?.stance ?? pick.stance ?? 'single', gun: next?.weapon === 'saber' ? 'saber' : next?.weapon, mods: [] });
  };
  const toggleMod = (id) => {
    const has = pick.mods?.includes(id);
    const mods = has ? pick.mods.filter((m) => m !== id) : [...(pick.mods ?? []), id].slice(-MAX_MODS);
    setPick({ ...pick, mods });
  };
  const changed = JSON.stringify(pick) !== JSON.stringify(hero);
  const guns = [h?.weapon, ...PICKABLE].filter((g, i, a) => g && g !== 'saber' && a.indexOf(g) === i);
  const stats = !saber && pick.gun ? withMods(pick.gun, pick.mods) : null;
  return (
    <div className="surface-list surface-heroes" role="dialog" aria-label="Play as">
      <ul className="surface-tabs" role="tablist">
        {[
          ['hero', 'Hero'],
          [saber ? 'saber' : 'weapon', saber ? 'Lightsaber' : 'Weapon'],
        ].map(([id, name]) => (
          <li key={id} role="presentation">
            <button type="button" role="tab" aria-selected={tab === id || (tab !== 'hero' && id !== 'hero')} onClick={() => setTab(id)}>
              {name}
            </button>
          </li>
        ))}
      </ul>
      {tab === 'hero' && (
        <>
          <p className="surface-list-title">Play as</p>
          <ul className="surface-hero-cards">
            {HEROES.map((x) => (
              <li key={x.id}>
                <button type="button" className={x.id === pick.id ? 'surface-hero is-picked' : 'surface-hero'} onClick={() => choose(x.id)} aria-pressed={x.id === pick.id}>
                  <span className="surface-hero-name">{x.name}</span>
                  <span className="surface-hero-arm">{ARM[x.weapon] ?? 'Blaster'}</span>
                  <span className="surface-hero-blurb">{x.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {tab !== 'hero' && saber && (
        <div className="surface-saber">
          <p className="surface-list-title">Blade</p>
          <div className="surface-swatches" role="radiogroup" aria-label="Blade colour">
            {SABER_COLORS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === pick.color} aria-label={c.name} title={c.name} className={c.id === pick.color ? 'surface-swatch is-picked' : 'surface-swatch'} style={{ '--blade': c.hex }} onClick={() => setPick({ ...pick, color: c.id })} />
            ))}
          </div>
          <p className="surface-list-title">Stance</p>
          <ul className="surface-hilts">
            {STANCE_IDS.map((id) => (
              <li key={id}>
                <button type="button" className={id === pick.stance ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, stance: id })} aria-pressed={id === pick.stance}>
                  <span className="surface-hero-name">{STANCES[id].name}</span>
                  <span className="surface-hero-blurb">{STANCES[id].about}</span>
                  <span className="surface-stats">
                    <i>{STANCES[id].swings.length} strokes</i>
                    <i>reach {num(STANCES[id].reach, 1)} m</i>
                    <i>{STANCES[id].swings.reduce((a, s) => a + s.damage, 0)} hits a combo</i>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="surface-list-title">Hilt</p>
          <ul className="surface-hilts">
            {HILTS.map((x) => (
              <li key={x.id}>
                <button type="button" className={x.id === pick.hilt ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, hilt: x.id })} aria-pressed={x.id === pick.hilt}>
                  <span className="surface-hero-name">{x.name}</span>
                  <span className="surface-hero-blurb">{x.about}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="surface-hero-keys">F a stroke (strokes chain; hold F for the heavy one, which breaks shields), hold C to block (a block as a swipe lands is a parry), X to dodge, R to throw, G the Force push, V the pull.</p>
        </div>
      )}
      {tab !== 'hero' && !saber && (
        <div className="surface-saber">
          {['galaxy', 'elsewhere'].map((side) => (
            <div key={side}>
              <p className="surface-weapon-side">{side === 'galaxy' ? 'From the galaxy' : 'From elsewhere'}</p>
              <ul className="surface-hilts">
                {guns
                  .filter((g) => WEAPONS[g]?.side === side)
                  .map((g) => {
                    const w = WEAPONS[g];
                    return (
                      <li key={g}>
                        <button type="button" className={g === pick.gun ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, gun: g })} aria-pressed={g === pick.gun}>
                          <span className="surface-hero-name">
                            {w.name}
                            {g === h?.weapon ? ' · their own' : ''}
                          </span>
                          <span className="surface-hero-blurb">{w.about}</span>
                          <span className="surface-stats">
                            <i>{w.damage}{w.pellets ? `×${w.pellets}` : w.burst ? `×${w.burst}` : ''} dmg</i>
                            <i>{num(60 / w.every)} /min</i>
                            <i>{num(w.range)} m</i>
                            <i>{num(w.zoom, 1)}× sights</i>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          <p className="surface-list-title">Mods (up to {MAX_MODS})</p>
          <ul className="surface-mods">
            {MOD_IDS.map((id) => (
              <li key={id}>
                <button type="button" className={pick.mods?.includes(id) ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => toggleMod(id)} aria-pressed={Boolean(pick.mods?.includes(id))}>
                  <span className="surface-hero-name">{MODS[id].name}</span>
                  <span className="surface-hero-blurb">{MODS[id].about}</span>
                </button>
              </li>
            ))}
          </ul>
          {stats && (
            <p className="surface-stats">
              <i>With mods:</i>
              <i>{stats.damage} dmg</i>
              <i>{num(60 / stats.every)} /min</i>
              <i>{num(stats.range)} m</i>
              <i>{num(stats.zoom, 1)}× sights</i>
              <i>heat {num(stats.heat * 100)}% a shot</i>
            </p>
          )}
          <p className="surface-hero-keys">F fires (bursts and pellets as the gun has them), hold the right button to aim down the sights, R vents the heat (overheated, hit the blue band for a perfect vent), X to dodge, G a thermal detonator, V the overcharge.</p>
        </div>
      )}
      <div className="surface-hero-actions">
        <button type="button" className="surface-help-btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="surface-help-btn surface-hero-play" onClick={() => onChange(pick)} disabled={!changed}>
          Play
        </button>
      </div>
    </div>
  );
}
