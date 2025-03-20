import { createContext, useContext } from 'react';
import BackgroundEffect from './BackgroundEffect';

const BackgroundContext = createContext(null);

export const useBackground = () => useContext(BackgroundContext);

export const BackgroundProvider = ({ children }) => {
  return (
    <BackgroundContext.Provider value={{}}>
      <div className="relative min-h-screen bg-neutral-950">
        <BackgroundEffect />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </BackgroundContext.Provider>
  );
};
