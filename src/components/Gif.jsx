import { useEffect, useRef, useState } from 'react';
import { RiPlayFill, RiVolumeMuteLine, RiVolumeUpLine } from 'react-icons/ri';
import { GIFS, gifPage, gifVideo } from '../data/gifs';
import { prefersReducedMotion } from '../lib/hooks';

// A GIF from a studio's official GIPHY channel, played as a small looping
// video. Nothing is fetched until it is on screen (or `eager`), it shows a
// play button instead of autoplaying for reduced-motion visitors, and clips
// that have sound can be unmuted.
export default function Gif({ name, size = 'small', eager = false, className = '', caption = true, autoPlay = true }) {
  const g = GIFS[name];
  const box = useRef(null);
  const video = useRef(null);
  const [load, setLoad] = useState(eager);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const still = prefersReducedMotion() || !autoPlay;

  useEffect(() => {
    if (load) return undefined;
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setLoad(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLoad(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  // Pause when scrolled away, resume when back.
  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !load || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && playing) v.play().catch(() => {});
      else if (!e.isIntersecting) v.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [load, playing]);

  if (!g) return null;
  const start = () => {
    setPlaying(true);
    video.current?.play().catch(() => {});
  };

  return (
    <figure ref={box} className={`gif m-0 ${className}`}>
      <div className="gif-frame" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
        {load && !failed && (
          <video
            ref={video}
            src={gifVideo(g, size)}
            muted={muted}
            loop
            playsInline
            autoPlay={!still}
            preload="metadata"
            aria-label={g.title}
            onPlay={() => setPlaying(true)}
            onError={() => setFailed(true)}
            className="gif-video"
          />
        )}
        {failed && (
          <a className="gif-fallback" href={gifPage(g.id)} target="_blank" rel="noopener noreferrer">
            Watch “{g.title}” on GIPHY
          </a>
        )}
        {load && !failed && still && !playing && (
          <button type="button" className="gif-play" onClick={start} aria-label={`Play: ${g.title}`}>
            <RiPlayFill className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        {g.sound && load && !failed && (
          <button
            type="button"
            className="gif-sound"
            onClick={() => {
              setMuted((m) => !m);
              start();
            }}
            aria-label={muted ? 'Turn the clip’s sound on' : 'Mute the clip'}
          >
            {muted ? <RiVolumeMuteLine className="h-4 w-4" aria-hidden="true" /> : <RiVolumeUpLine className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {caption && (
        <figcaption className="gif-credit">
          {g.by}, via{' '}
          <a href={gifPage(g.id)} target="_blank" rel="noopener noreferrer">
            GIPHY
          </a>
        </figcaption>
      )}
    </figure>
  );
}
