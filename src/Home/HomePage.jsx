import { Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const HeroSection = lazy(() => import('./HeroSection'));
const AboutSection = lazy(() => import('./AboutSection'));
const TechStack = lazy(() => import('./TechStack'));

const SectionFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-white">Loading section...</div>
  </div>
);

const HomePage = () => {
  return (
    <div className="relative">
      <ErrorBoundary FallbackComponent={({ error }) => (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white">{error.message}</div>
        </div>
      )}>
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
