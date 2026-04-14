import { createContext, useContext, Suspense, lazy } from 'react';

const BackgroundEffect = lazy(() => import('./BackgroundEffect'));

const BackgroundContext = createContext(null);
export const useBackground = () => useContext(BackgroundContext);

export const BackgroundProvider = ({ children }) => (
  <BackgroundContext.Provider value={{}}>
    {/* bg-sw-black sets the page base colour; no overflow:hidden here — that kills scroll */}
    <div className="relative min-h-screen bg-sw-black">
      <Suspense fallback={<div className="fixed inset-0 bg-[#050505]" style={{ zIndex: 0 }} />}>
        <BackgroundEffect />
      </Suspense>
      <div className="noise-overlay" />
      {/* z-10 so content sits above the fixed starfield */}
      <div className="relative z-10">{children}</div>
    </div>
  </BackgroundContext.Provider>
);
