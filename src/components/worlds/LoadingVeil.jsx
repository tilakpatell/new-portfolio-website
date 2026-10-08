import { useEffect, useState } from 'react';
import './loadingVeil.css';

// The loading screen over a world while it prepares (useScene's 'preparing'):
// the world's name, a bar for how far along it is, what it's doing in words,
// and a line of the world's own. Everything on it moves in CSS (the bar by a
// transform, the shimmer by an animation), so it keeps moving on the
// compositor while the main thread and the graphics chip are busy. When it's
// no longer shown it fades out over FADE ms and then leaves the page.

export const FADE = 400; // ms the veil takes to fade once the world is ready

// The steps lib/three/gpuWork's prepareScene (and a world's prepare) report.
// eslint-disable-next-line react-refresh/only-export-components
export const STEP_WORDS = {
  pictures: 'Sending pictures to the graphics chip',
  shaders: 'Compiling shaders',
  'first draw': 'Drawing it once',
  bake: 'Baking the light',
  tune: 'Tuning for this screen',
};

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export default function LoadingVeil({ shown, progress = 0, step, title, line }) {
  // still on the page while it fades: it goes FADE ms after it's hidden
  const [mounted, setMounted] = useState(Boolean(shown));
  useEffect(() => {
    if (shown) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), FADE);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown && !mounted) return null;
  const words = (step && STEP_WORDS[step]) || step || 'Getting ready';
  return (
    <div className={`loading-veil${shown ? '' : ' is-leaving'}`} role="status" aria-live="polite">
      <div className="loading-veil-card">
        {title && <p className="loading-veil-title">{title}</p>}
        <div className="loading-veil-track" aria-hidden="true">
          <div className="loading-veil-bar" style={{ transform: `scaleX(${clamp01(progress)})` }} />
        </div>
        <p className="loading-veil-step">{words}</p>
        {line && <p className="loading-veil-line">{line}</p>}
      </div>
    </div>
  );
}
