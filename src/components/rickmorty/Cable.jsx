import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';
import { useVoiced } from '../../lib/useVoiced';
import { CHANNELS } from './toys';

// Interdimensional cable: an old set with rabbit ears, a channel number, and
// static between channels. Each channel is a little scene in CSS shapes and
// a line from the show's improvised ads and shows (./toys.js), said once the
// static clears, in its speaker's voice where it's been made.

function Static({ on }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!on) return undefined;
    const c = ref.current;
    const x = c.getContext('2d');
    const img = x.createImageData(c.width, c.height);
    let raf = 0;
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return <canvas ref={ref} width="160" height="120" className="rm-static" data-on={on || undefined} aria-hidden="true" />;
}

function Scene({ id }) {
  // simple shapes, one set per channel
  if (id === 'doors')
    return (
      <div className="rm-scene rm-doors">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ '--i': i }}>
            <i />
          </span>
        ))}
      </div>
    );
  if (id === 'balls')
    return (
      <div className="rm-scene rm-balls">
        <span className="rm-boom" />
        <b>BALL FONDLERS</b>
      </div>
    );
  if (id === 'van')
    return (
      <div className="rm-scene rm-van">
        <span className="rm-van-body">
          <i />
          <i />
        </span>
        <span className="rm-road" />
      </div>
    );
  if (id === 'field')
    return (
      <div className="rm-scene rm-field">
        <span className="rm-cat">
          <i />
          <i />
        </span>
      </div>
    );
  if (id === 'legs')
    return (
      <div className="rm-scene rm-legs">
        <span className="rm-detective">
          <i />
        </span>
      </div>
    );
  return (
    <div className="rm-scene rm-plumbus">
      <span className="rm-plumbus-thing">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export default function Cable() {
  const [ch, setCh] = useState(0);
  const [fuzz, setFuzz] = useState(false);
  const [flipped, setFlipped] = useState(false); // (the first channel waits to be tuned in, rather than talking as the page opens)
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flip = (dir) => {
    audioContext();
    import('../games/gameAudio').then((m) => m.portalHop?.());
    clearTimeout(timer.current);
    setFuzz(true);
    setFlipped(true);
    setCh((c) => (c + dir + CHANNELS.length) % CHANNELS.length);
    timer.current = setTimeout(() => setFuzz(false), prefersReducedMotion() ? 60 : 320);
  };
  const c = CHANNELS[ch];
  useVoiced(flipped && !fuzz ? c.who : null, c.line);
  return (
    <div className="rm-cable">
      <div className="rm-tv">
        <span className="rm-ears" aria-hidden="true" />
        <div className="rm-screen" aria-live="polite">
          <Scene id={c.id} />
          <p className="rm-caption">
            <strong>{c.title}</strong>
            {c.line}
          </p>
          <span className="rm-channel">CH {String(ch + 2).padStart(2, '0')}</span>
          <Static on={fuzz} />
        </div>
        <div className="rm-dials">
          <button type="button" className="rm-dial" onClick={() => flip(-1)} aria-label="Channel down">
            ◀
          </button>
          <button type="button" className="rm-dial" onClick={() => flip(1)} aria-label="Channel up">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
