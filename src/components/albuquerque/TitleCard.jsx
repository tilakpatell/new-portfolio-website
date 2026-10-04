import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { splitWord } from './elements';

// Any name as a Breaking Bad title card, one element from the periodic table
// at a time; "Say my name", and the opening.
function Tile({ el }) {
  return (
    <span className="bb-tile">
      <span className="bb-num">{el.n}</span>
      <span className="bb-sym">{el.sym}</span>
      <span className="bb-mass">{el.mass}</span>
      <span className="bb-name">{el.name}</span>
    </span>
  );
}

export default function TitleCard({ id = 'abq-name' }) {
  const [name, setName] = useState('Tilak Patel');
  const music = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => music.current?.stop(), []);
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 3);

  const say = () => {
    audioContext();
    import('../../lib/clips').then((c) => c.playClip('sayMyName'));
  };
  const opening = async () => {
    if (!audioContext()) return;
    if (music.current) {
      music.current.stop();
      music.current = null;
      setPlaying(false);
      return;
    }
    const c = await import('../../lib/clips');
    const clip = await c.playClip('bbIntro');
    if (!clip) return;
    music.current = clip;
    setPlaying(true);
    clip.ended.then(() => {
      if (music.current !== clip) return;
      music.current = null;
      setPlaying(false);
    });
  };

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <figure className="abq-card m-0">
        <span className="bb-smoke bb-smoke-a" aria-hidden="true" />
        <span className="bb-smoke bb-smoke-b" aria-hidden="true" />
        <p className="bb-title abq-title-card" aria-label={name || 'Your name'}>
          {words.length ? (
            words.map((w, i) => {
              const { before, el, after } = splitWord(w);
              return (
                <span key={`${w}-${i}`} className="bb-line" aria-hidden="true">
                  {before && <span className="bb-rest">{before.toLowerCase()}</span>}
                  {el && <Tile el={el} />}
                  {after && <span className="bb-rest">{after.toLowerCase()}</span>}
                </span>
              );
            })
          ) : (
            <span className="bb-line" aria-hidden="true">
              <span className="bb-rest">your name</span>
            </span>
          )}
        </p>
      </figure>
      <div>
        <p className="lead max-w-[46ch]">Type a name and it becomes a title card, one element from the periodic table at a time.</p>
        <div className="mt-6 max-w-md">
          <label htmlFor={id} className="label">
            A name
          </label>
          <input id={id} className="fun-input mt-2" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={say}>
            Say my name
          </button>
          <button type="button" className="btn btn-ghost" onClick={opening} aria-pressed={playing}>
            {playing ? 'Stop the opening' : 'Play the opening'}
          </button>
        </div>
      </div>
    </div>
  );
}
