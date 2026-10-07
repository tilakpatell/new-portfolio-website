import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RiCompass3Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { local } from '../../lib/hooks';
import { TOUR_EVENT, TOUR_KEY, offerHere, openTour, tourFor } from '../../lib/tour';
import './offer.css';

// Always in the shell, and small: starts the tour of the site when asked
// (openTour: ⌘K, the guide, the terminal), and offers it on a first arrival.
// The tour (Tour.jsx) loads the first time it's offered or started.
const loadTour = () => import('./Tour');
const Tour = lazy(loadTour);

export default function TourHost() {
  const { pathname } = useLocation();
  const { unlock } = useAchievements();
  const [tour, setTour] = useState(null); // the tour running: 'universe' or 'classic'
  const [offer, setOffer] = useState(false);
  const where = useRef(pathname);
  where.current = pathname;

  useEffect(() => {
    const onStart = () => {
      setOffer(false);
      setTour(tourFor(where.current));
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  // a page with another tour (back to the map from the feed) ends it; the
  // feed moving the address as you scroll doesn't
  const kind = tourFor(pathname);
  useEffect(() => setTour((t) => (t && t !== kind ? null : t)), [kind]);

  // The offer, on a first arrival at the map or the feed: once nothing's
  // covering the page (the intro, the front door's choice, the phone menu,
  // any dialog) for two checks running. Made once: it's remembered as soon
  // as it shows. Choosing a place on the map, or scrolling the feed on to
  // its next page, keeps it up; leaving for a world takes it down.
  const here = offerHere(pathname, null) ? kind : null;
  useEffect(() => {
    setOffer(false);
    if (!here || local.get(TOUR_KEY, null) != null) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      const html = document.documentElement;
      const busy = ['covered', 'intro', 'menu', 'touring'].some((k) => k in html.dataset) || document.querySelector('[aria-modal="true"]');
      calm = busy ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(TOUR_KEY, 'offered');
      loadTour(); // (it's likely to be started next)
      setOffer(true);
    }, 1200);
    return () => clearInterval(check);
  }, [here]);

  const end = (how) => {
    setTour(null);
    local.set(TOUR_KEY, how);
    if (how === 'done') unlock('tour');
  };
  const notNow = () => {
    setOffer(false);
    local.set(TOUR_KEY, 'skipped');
  };

  return (
    <>
      {offer && !tour && (
        <div className="tour-offer card" role="status">
          <RiCompass3Line className="tour-offer-icon" aria-hidden="true" />
          <div>
            <p className="tour-offer-title">New here?</p>
            <p className="tour-offer-text">A quick look round: where everything is, in under a minute.</p>
            <div className="tour-offer-buttons">
              <button type="button" className="btn btn-primary btn-sm" onClick={openTour}>
                Take the tour
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={notNow}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {tour && (
        <Suspense fallback={null}>
          <Tour name={tour} onEnd={end} />
        </Suspense>
      )}
    </>
  );
}
