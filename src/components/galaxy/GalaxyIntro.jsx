import { useEffect, useRef } from 'react';

// Coming into the galaxy (once a visit): the films' own first words, in
// their blue on black, fading in and out, before you drop out of hyperspace
// into the first system. Any key, click or tap skips it.
const MS = 4200;

export default function GalaxyIntro({ onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), MS);
    const skip = () => done.current();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, []);
  return (
    <div className="galaxy-intro" role="presentation">
      <p>
        A long time ago in a galaxy far,
        <br />
        far away….
      </p>
    </div>
  );
}
