import { Suspense, lazy, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const HeroSection = lazy(() => import('./HeroSection'));
const AboutSection = lazy(() => import('./AboutSection'));
const TechStack = lazy(() => import('./TechStack'));

const SectionFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-imperial-black">
    <div className="animate-pulse text-white/60">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
    </div>
  </div>
);

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen flex items-center justify-center bg-imperial-black">
    <div className="text-center px-4">
      <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
      <p className="text-white/60 mb-4">{error.message}</p>
      <button 
        onClick={resetErrorBoundary}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  </div>
);

const HomePage = () => {
  // Prefetch other sections after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./AboutSection');
      import('./TechStack');
    }, 1000);
    
    // Simple overscroll prevention
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    return () => {
      clearTimeout(timer);
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  return (
    <div 
      className="relative bg-imperial-black min-h-screen overflow-hidden"
      style={{ overscrollBehavior: 'none' }}
    >
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<SectionFallback />}>
          <HeroSection />
        </Suspense>
        
        <Suspense fallback={<SectionFallback />}>
          <AboutSection />
        </Suspense>
        
        <Suspense fallback={<SectionFallback />}>
          <TechStack />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default HomePage;
