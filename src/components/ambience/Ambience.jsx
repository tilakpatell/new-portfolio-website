import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { device } from '../../lib/device';
import { familyFor, motifFor, showsOn } from './kinds';
import { useAmbienceSetting } from './setting';
import './motifs.css';

// A background behind the portfolio pages for the theme that's on
// (docs/superpowers/specs/2026-10-05-theme-ambience-design.md). Each fan
// theme's family draws a live scene of its own (scenes/<family>.js, on
// kit.js) in a fixed box under <main> that takes no clicks and is faded
// toward the middle of the screen, where the text is; nothing loads for it
// on a world page, on a weak device or with Data Saver, or with 3D off
// (useScene). The company themes, and each project's on its page, get
// something quieter, in CSS alone (motifs.css). The visitor can switch
// both off in the colour picker.
const Layer = lazy(() => import('./Layer'));

const affordable = () => {
  const d = device();
  return d.tier !== 'low' && !d.saveData;
};

// A quiet motif drawn in CSS. The page's colour moves to <html> while it's
// up, so it shows through <body>.
function MotifBackdrop({ motif }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ambience = 'motif';
    return () => delete root.dataset.ambience;
  }, []);
  return <div className="site-backdrop" data-motif={motif} aria-hidden="true" />;
}

export default function Ambience() {
  const { pathname } = useLocation();
  const { active } = useTheme();
  const [enabled] = useAmbienceSetting();
  const here = enabled && showsOn(pathname);
  const family = here ? familyFor(active) : null;
  const motif = here ? motifFor(active) : null;
  if (motif) return <MotifBackdrop motif={motif} />;
  if (!family || !affordable()) return null;
  // a new family is a new scene; another theme in the same one recolours it
  return (
    <Suspense fallback={null}>
      <Layer key={family} family={family} theme={active} />
    </Suspense>
  );
}
