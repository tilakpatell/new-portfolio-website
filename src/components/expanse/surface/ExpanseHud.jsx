import { Hud, Menu, Prompt, Stick, TouchButton } from '../../../runtime/hud';

// The Expanse surface's HUD (the runtime's kit): the planet's name, top
// left; the speed and a compass to the nearest water, top right by the
// Menu; R to come back, at the foot; on touch the stick and two buttons.
// The numbers are written into the elements by the world's events
// (ExpanseWorld.jsx holds the refs), not through React state.
//
//   <ExpanseHud name refs={{ speed, water, arrow, moment }} touch way
//     onStick(x, y) onRespawn onJump onBoost(down) />
// (the compass arrow's angle is rules.js's screenAngle)

export default function ExpanseHud({ name, refs, touch = false, way = null, onStick, onRespawn, onJump, onBoost }) {
  const tools = (
    <div className="expanse-tools">
      <span className="expanse-chip" aria-label="Speed">
        <b ref={refs.speed}>0</b> km/h
      </span>
      <span className="expanse-chip" aria-label="The nearest water">
        <i ref={refs.arrow} className="expanse-arrow" aria-hidden="true">
          ↑
        </i>{' '}
        <span ref={refs.water}>Looking for water</span>
      </span>
      <Menu way={way} />
    </div>
  );
  const foot = (
    <div className="expanse-foot">
      <span ref={refs.moment} className="expanse-moment" aria-live="polite" />
      <Prompt k="R" verb="Back" thing="to dry land" touch={touch} onClick={onRespawn} />
    </div>
  );
  const thumbs = touch ? (
    <div className="expanse-thumbs">
      <Stick onMove={onStick} label="Drive" />
      <div className="expanse-buttons">
        <TouchButton size={64} onPress={onJump} aria-label="Jump">
          Jump
        </TouchButton>
        <TouchButton size={52} onPress={() => onBoost(true)} onRelease={() => onBoost(false)} aria-label="Boost">
          Boost
        </TouchButton>
      </div>
    </div>
  ) : null;
  return (
    <Hud className="expanse-hud" brand={<h1 className="expanse-name">{name}</h1>} tools={tools} foot={foot} touch={touch} thumbs={thumbs} />
  );
}
