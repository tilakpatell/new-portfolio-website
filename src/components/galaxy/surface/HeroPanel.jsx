import { useState } from 'react';
import { HEROES, HILTS, SABER_COLORS, heroById } from '../heroes';

// Who you play as down here, and your lightsaber: the roster (heroes.js)
// as cards, and for a saber hero the blade's colour and the hilt. The
// choice is kept (pages/GalaxySurface.jsx writes it) and the world
// rebuilds with the new lead on Play.

export default function HeroPanel({ hero, onChange, onClose }) {
  const [pick, setPick] = useState(hero);
  const h = heroById(pick.id);
  const saber = h?.weapon === 'saber';
  const choose = (id) => {
    const next = heroById(id);
    setPick({ id, color: next?.saber?.color ?? pick.color, hilt: next?.saber?.hilt ?? pick.hilt });
  };
  const changed = pick.id !== hero.id || pick.color !== hero.color || pick.hilt !== hero.hilt;
  return (
    <div className="surface-list surface-heroes" role="dialog" aria-label="Play as">
      <p className="surface-list-title">Play as</p>
      <ul className="surface-hero-cards">
        {HEROES.map((x) => (
          <li key={x.id}>
            <button type="button" className={x.id === pick.id ? 'surface-hero is-picked' : 'surface-hero'} onClick={() => choose(x.id)} aria-pressed={x.id === pick.id}>
              <span className="surface-hero-name">{x.name}</span>
              <span className="surface-hero-arm">{x.weapon === 'saber' ? 'Lightsaber' : x.weapon === 'bowcaster' ? 'Bowcaster' : x.weapon === 'rifle' ? 'Blaster rifle' : 'Blaster'}</span>
              <span className="surface-hero-blurb">{x.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      {saber && (
        <div className="surface-saber">
          <p className="surface-list-title">Blade</p>
          <div className="surface-swatches" role="radiogroup" aria-label="Blade colour">
            {SABER_COLORS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === pick.color} aria-label={c.name} title={c.name} className={c.id === pick.color ? 'surface-swatch is-picked' : 'surface-swatch'} style={{ '--blade': c.hex }} onClick={() => setPick({ ...pick, color: c.id })} />
            ))}
          </div>
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
          <p className="surface-hero-keys">F swings (three in a row chain), hold C to block bolts, R throws it and it comes back.</p>
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
