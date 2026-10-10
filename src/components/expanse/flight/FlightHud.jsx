import { Hud, Menu, MenuItem, Stick, Toast, TouchButton } from '../../../runtime/hud';
import FlightMap from './FlightMap';

// The flight's HUD, from the kit: the planet's name top left, the one Menu
// top right (the way out, and the planets to fly to next), the toast under
// the top row, and at the foot the speed and the height over the ground,
// written by the page into the refs it holds (numbers through refs, not
// state). On touch, the kit's stick flies it and two buttons work the
// throttle. `map`: { spec, source } for the planet map (./FlightMap).
//
//   <FlightHud name way planets onPlanet toast numbers touch onStick onThrottle map />
export default function FlightHud({ name, way, planets = [], onPlanet, toast, numbers, touch = false, onStick, onThrottle, map = null }) {
  return (
    <Hud
      className="fly-hud"
      touch={touch}
      brand={
        <div className="fly-brand">
          <p className="fly-eyebrow">Planet flight</p>
          <h1 className="fly-title">{name}</h1>
        </div>
      }
      tools={
        <Menu className="fly-menu" way={way}>
          {planets.map((p) => (
            <MenuItem key={p.id} onClick={() => onPlanet(p.id)}>
              Fly over <b>{p.name}</b>
            </MenuItem>
          ))}
        </Menu>
      }
      foot={
        <p className="fly-gauge" aria-hidden="true">
          <span ref={(el) => (numbers.current.speed = el)}>0</span>
          <small>m/s</small>
          <span ref={(el) => (numbers.current.alt = el)}>0</span>
          <small>m up</small>
        </p>
      }
      thumbs={
        <div className="fly-thumbs">
          <Stick className="fly-stick" label="Fly" onMove={onStick} />
          <div className="fly-throttle">
            <TouchButton size={52} onPress={() => onThrottle(1)} onRelease={() => onThrottle(0)} aria-label="Faster">
              +
            </TouchButton>
            <TouchButton size={52} onPress={() => onThrottle(-1)} onRelease={() => onThrottle(0)} aria-label="Slower">
              −
            </TouchButton>
          </div>
        </div>
      }
    >
      <Toast toast={toast} className="fly-toast" />
      {map && <FlightMap {...map} touch={touch} />}
    </Hud>
  );
}
