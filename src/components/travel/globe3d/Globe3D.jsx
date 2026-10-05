import { useEffect, useRef } from 'react';
import { PLACES } from '../../../data/places';
import { useScene } from '../../../lib/three/useScene';
import './globe3d.css';
import '../../../styles/lazy/travel.css';

// The travel globe in WebGL, laid over the 2D one. It stays hidden until it
// has drawn a frame, then fades in, and tells the page its status so the 2D
// globe can step aside (or come back if 3D is lost, fails or runs slow).
const load = () => import('./scene');

export default function Globe3D({ selected, onSelect, onHover, label, onStatus }) {
  const tip = useRef(null);
  const pin = useRef(null);
  // where the globe was looking, kept across a scene being let go and remade
  const memory = useRef({}).current;
  const { wrap, status, on, view } = useScene(load, {
    id: 'globe',
    props: { selected, onSelect, onHover, label, tip, pin, memory },
  });

  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  const selectedPlace = PLACES.find((p) => p.id === selected);

  return (
    <div ref={wrap} className="globe3d" data-on={on || undefined}>
      <span ref={tip} className="globe-tip" aria-hidden="true" />
      <span ref={pin} className="globe-pin" aria-hidden="true">
        {selectedPlace?.name}
      </span>
      <div className="globe-controls">
        <button type="button" className="globe-btn" onClick={() => view.current?.zoom(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="globe-btn" onClick={() => view.current?.zoom(-1)} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="globe-btn globe-btn-wide"
          onClick={() => {
            onSelect?.(null);
            view.current?.reset();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
