import { Navigate, useLocation } from 'react-router-dom';
import { local } from '../lib/hooks';
import Universe from './Universe';

export const START_KEY = 'tp-start'; // 'universe' or 'home', once a visitor has said

// The universe, at the front door (/) and at /universe/:id. Both routes
// render this, so moving between them (a planet picked at /, the wordmark
// from /universe/marvel) keeps the one map instead of building it again.
// At the front door there's a choice over it the first time (fly through
// the site, or go straight to the home page); a visitor who asked to be
// remembered gets their choice from then on: the home page, or the universe
// without asking.
export default function Front() {
  const atRoot = useLocation().pathname === '/';
  const start = local.get(START_KEY, null);
  if (atRoot && start === 'home') return <Navigate to="/home" replace />;
  return <Universe ask={atRoot && start !== 'universe'} />;
}
