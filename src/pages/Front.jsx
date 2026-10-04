import { Navigate } from 'react-router-dom';
import { local } from '../lib/hooks';
import Universe from './Universe';

export const START_KEY = 'tp-start'; // 'universe' or 'home', once a visitor has said

// The front door (/): the universe, with a choice over it the first time
// (fly through the site, or go straight to the home page). A visitor who
// asked to be remembered gets their choice from then on: the home page, or
// the universe without asking.
export default function Front() {
  const start = local.get(START_KEY, null);
  if (start === 'home') return <Navigate to="/home" replace />;
  return <Universe ask={start !== 'universe'} />;
}
