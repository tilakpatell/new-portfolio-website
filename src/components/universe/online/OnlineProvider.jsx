import { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { OnlineContext, useOnlineState } from './useOnline';
import { isFlight, whereOf } from './where';

// Multiplayer for the whole site: the link to the other pilots lives here,
// above the pages, so it stays up as you go from the universe into a world
// and on round the site. Off the universe map and the galaxy's systems
// (which have their own corner and the ships themselves), the other pilots on your page show as live
// pointers (Presence.jsx, unless you've turned them off) and who's online
// sits in the bottom-left corner; both load only once you've gone online.

const Presence = lazy(() => import('./Presence'));
const Online = lazy(() => import('./Online'));

export default function OnlineProvider({ children }) {
  const where = whereOf(useLocation().pathname);
  const online = useOnlineState(where);
  const away = online.on && !isFlight(where);
  return (
    <OnlineContext.Provider value={online}>
      {children}
      {away && (
        <Suspense fallback={null}>
          {online.pointers && <Presence online={online} />}
          <Online online={online} floating />
        </Suspense>
      )}
    </OnlineContext.Provider>
  );
}
