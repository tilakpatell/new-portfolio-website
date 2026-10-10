import { lazy } from 'react';
const Galaxy = lazy(() => import('./pages/Galaxy'));
const Fly = lazy(() => import('./pages/Fly')); // planet flight (scripts/flight-island.mjs removes this row)
const Music = lazy(() => import('./pages/Music'));

export const routes = (
  <>
    <Route path="/galaxy" element={<Galaxy />} />
    <Route path="/fly/:planet?" element={<Fly />} /> {/* planet flight */}
    <Route path="/music" element={<Music />} />
  </>
);
