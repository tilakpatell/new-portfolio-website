import { Navigate, useLocation } from 'react-router-dom';
import { readStart } from '../lib/view';
import Universe from './Universe';

// The universe, at the front door (/) and at /universe/:id. Both routes
// render this, so moving between them (a planet picked at /, the wordmark
// from /universe/marvel) keeps the one map instead of building it again.
// At the front door there's a choice over it the first time (fly through
// the site, or go straight to the home page); a visitor who asked to be
// remembered gets their choice from then on: the home page, or the universe
// without asking. The view switch in the nav changes it from anywhere.
export default function Front() {
  const atRoot = useLocation().pathname === '/';
  const start = readStart();
  if (atRoot && start === 'home') return <Navigate to="/home" replace />;
  return <Universe ask={atRoot && start !== 'universe'} />;
}
