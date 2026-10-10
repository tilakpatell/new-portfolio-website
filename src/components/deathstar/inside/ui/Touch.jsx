import { useEffect, useRef, useState } from 'react';
import { capturePointer } from '../../../../lib/pointer';
import './touch.css';

// The touch controls over the station on a phone: a stick on the left
// (pushed all the way, you run), a look pad over the rest (drag to turn
// your head), and on the right Fire, Aim (held), Use, Jump and Crouch (a
// tap to crouch, another to stand). They send what the keys and the mouse
// send (press(name, down), stick(x, y), look(dx, dy)), so the world never
// knows which it was. Every press is let go on lift, cancel or a lost
// capture, so nothing sticks down. The buttons stand clear of the corner
// the guide’s button keeps (bottom right).
//
//   <Touch api />   api() → the world, or null while it isn’t up

const LOOK = 1.6; // a finger’s drag turns the head this much more than the same mouse move
const REACH = 46; // pixels the stick’s knob travels

export default function Touch({ api }) {
  const stickRef = useRef(null);
  const stickId = useRef(null);
  const lookId = useRef(null);
  const lookAt = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [crouch, setCrouch] = useState(false);

  // put away (a pause, a conversation): the stick back in the middle and a
  // held crouch let go, so the world isn’t left walking or crouched
  useEffect(
    () => () => {
      api()?.stick?.(0, 0);
      api()?.press?.('crouch', false);
    },
    [api],
  );

  const moveStick = (e) => {
    const el = stickRef.current;
    if (!el || e.pointerId !== stickId.current) return;
    const r = el.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setKnob({ x, y });
    // (up the screen is forward)
    api()?.stick?.(x, -y);
  };
  const stickDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    stickId.current = e.pointerId;
    capturePointer(e);
    moveStick(e);
  };
  const stickUp = (e) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    api()?.stick?.(0, 0);
  };

  const lookDown = (e) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookAt.current = { x: e.clientX, y: e.clientY };
    capturePointer(e);
  };
  const lookMove = (e) => {
    if (e.pointerId !== lookId.current) return;
    api()?.look?.((e.clientX - lookAt.current.x) * LOOK, (e.clientY - lookAt.current.y) * LOOK);
    lookAt.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e) => {
    if (e.pointerId === lookId.current) lookId.current = null;
  };

  const hold = (name) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e);
      api()?.press?.(name, true);
    },
    onPointerUp: () => api()?.press?.(name, false),
    onPointerCancel: () => api()?.press?.(name, false),
    onLostPointerCapture: () => api()?.press?.(name, false),
    onContextMenu: (e) => e.preventDefault(),
  });
  // crouching is held down by the world as long as the key is, so a thumb
  // needn’t stay on it: one tap holds it, the next lets go
  const toggleCrouch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const on = !crouch;
    setCrouch(on);
    api()?.press?.('crouch', on);
  };

  return (
    <div className="ds-touch">
      <div className="ds-look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} onLostPointerCapture={lookUp} aria-hidden="true" />
      <div ref={stickRef} className="ds-stick" onPointerDown={stickDown} onPointerMove={moveStick} onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp} role="presentation">
        <span style={{ transform: `translate(${knob.x * REACH}px, ${knob.y * REACH}px)` }} />
      </div>
      <div className="ds-buttons">
        <button type="button" className="ds-tbtn ds-tbtn-fire" {...hold('fire')}>
          Fire
        </button>
        <button type="button" className="ds-tbtn" {...hold('aim')}>
          Aim
        </button>
        <button type="button" className="ds-tbtn" {...hold('use')}>
          Use
        </button>
        <button type="button" className="ds-tbtn" {...hold('jump')}>
          Jump
        </button>
        <button type="button" className="ds-tbtn" aria-pressed={crouch} onPointerDown={toggleCrouch} onContextMenu={(e) => e.preventDefault()}>
          Crouch
        </button>
      </div>
    </div>
  );
}
