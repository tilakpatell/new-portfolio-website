import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { byId } from '../components/universe/universes';
import { parseId } from '../components/universe/layout';
import { enterPlan } from '../components/universe/flight';
import UniverseMap from '../components/universe/UniverseMap';
import UniversePanel from '../components/universe/UniversePanel';

// The universe map: every fandom on the site is a planet, and you travel
// between them. The URL is the selection (/universe/marvel), swapped in place
// so a link shares the view and Back leaves the map in one press. The page
// accent follows the selected universe, so the panel recolours as you go.
export default function Universe() {
  useDocumentTitle('The universe');
  const navigate = useNavigate();
  const selected = parseId(useParams().id);
  const universe = byId(selected);
  const reduced = useReducedMotion();
  const map = useRef({ live: false, dive: () => 0 }); // the 3D map, while it's drawing
  const [leaving, setLeaving] = useState(null); // { id, mode } once Enter is pressed
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const select = useCallback((id) => navigate(id ? `/universe/${id}` : '/universe', { replace: true }), [navigate]);

  const enter = () => {
    if (!universe || leaving) return;
    const plan = enterPlan(universe, { reduced, three: map.current.live });
    if (plan.mode === 'now') {
      navigate(universe.to);
      return;
    }
    if (plan.mode === 'jump') {
      audioContext(); // inside the press, so the jump can sound
      window.dispatchEvent(new Event('tp:hyperspace'));
    } else map.current.dive(universe.id);
    setLeaving({ id: universe.id, mode: plan.mode });
    timer.current = setTimeout(() => navigate(universe.to), plan.delay);
  };

  // Escape flies back out, unless something inside took it or a dialog is open
  const onKeyDown = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !selected || leaving) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    e.preventDefault();
    select(null);
  };

  const accent = universe ? { '--accent': universe.accent, '--accent-text': universe.accent, '--btn-bg': universe.accent } : undefined;

  return (
    // Escape is heard from anywhere inside the map or the panel
    <div className="dark-scope universe-page" style={accent} onKeyDown={onKeyDown} data-leaving={leaving?.mode}>
      <h1 className="sr-only">The universe map</h1>
      <p className="sr-only" aria-live="polite">
        {universe ? `${universe.label}: selected` : ''}
      </p>
      <UniverseMap selected={selected} onSelect={select} handle={map} frozen={Boolean(leaving)} />
      <UniversePanel universe={universe} onSelect={select} onEnter={enter} leaving={Boolean(leaving)} />
      <div className="universe-fade" aria-hidden="true" style={{ background: leaving?.mode === 'dive' ? byId(leaving.id).palette.base : undefined }} />
    </div>
  );
}
