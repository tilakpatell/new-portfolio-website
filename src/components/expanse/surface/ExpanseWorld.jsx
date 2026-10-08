import { useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '../../../lib/hooks';
import { WorldHost, useWorld } from '../../../runtime';
import { wayOut } from '../../worlds/worlds';
import ExpanseHud from './ExpanseHud';
import { screenAngle } from './rules';
import module from './module';
import './surface.css';

// A planet of the Expanse, driven (./module.js): the stage and its HUD.
// The HUD's numbers come in on the world's 'hud' events and are written
// straight into its elements. On touch, the stick drives (the runtime's
// input takes it), and Jump, Boost and Back press the keys they stand for.

const MOMENTS = { sea: 'In the sea', lake: 'In a lake', river: 'In a river' };
const press = (code, down) => globalThis.dispatchEvent?.(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const tap = (code) => {
  press(code, true);
  setTimeout(() => press(code, false), 120);
};

export default function ExpanseWorld({ seed, type = 'temperate', name }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const { pathname } = useLocation();
  const speed = useRef(null);
  const water = useRef(null);
  const arrow = useRef(null);
  const moment = useRef(null);
  const refs = { speed, water, arrow, moment };
  const props = useMemo(() => ({ seed, type, name, small: touch }), [seed, type, name, touch]);
  const onEvent = useCallback(
    (e) => {
      if (e.type !== 'hud') return;
      if (speed.current) speed.current.textContent = String(e.speed);
      if (water.current) water.current.textContent = e.water ? `Water ${Math.round(e.water.distance)} m` : 'No water near';
      if (arrow.current) arrow.current.style.transform = e.water ? `rotate(${screenAngle(e.water.bearing)}deg)` : 'none';
      if (moment.current) moment.current.textContent = MOMENTS[e.moment] ?? '';
    },
    [speed, water, arrow, moment],
  );
  const { host, rt } = useWorld(module, { props, onEvent });
  return (
    <WorldHost world={{ host }} className="expanse-stage">
      <ExpanseHud
        name={name}
        refs={refs}
        touch={touch}
        way={wayOut(pathname)}
        onStick={(x, y) => rt?.input.setStick(x, y)}
        onRespawn={() => tap('KeyR')}
        onJump={() => tap('Space')}
        onBoost={(down) => press('ShiftLeft', down)}
      />
    </WorldHost>
  );
}
