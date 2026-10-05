import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { device } from '../../lib/device';
import { familyFor, showsOn } from './kinds';
import { useAmbienceSetting } from './setting';

// A live background behind the portfolio pages for the theme that's on
// (docs/superpowers/specs/2026-10-05-theme-ambience-design.md): each fan
// theme's family draws its own scene (scenes/<family>.js, on kit.js) in a
// fixed box under <main> that takes no clicks and is faded toward the middle
// of the screen, where the text is. Nothing loads for a theme without one,
// on a world page, on a weak device or with Data Saver, with 3D off
// (useScene), or when the visitor has switched it off in the colour picker.
const Layer = lazy(() => import('./Layer'));

const affordable = () => {
  const d = device();
  return d.tier !== 'low' && !d.saveData;
};

export default function Ambience() {
  const { pathname } = useLocation();
  const { active } = useTheme();
  const [enabled] = useAmbienceSetting();
  const family = enabled && showsOn(pathname) ? familyFor(active) : null;
  if (!family || !affordable()) return null;
  // a new family is a new scene; another theme in the same one recolours it
  return (
    <Suspense fallback={null}>
      <Layer key={family} family={family} theme={active} />
    </Suspense>
  );
}
