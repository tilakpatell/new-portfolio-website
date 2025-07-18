import { useState, Suspense, lazy, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ParallaxProvider } from 'react-scroll-parallax';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { BackgroundProvider } from './Home/BackgroundContext';
import Navigation from './Home/Navbar';

// Lazy load components
const HyperspaceIntro = lazy(() => import('./Home/HyperspaceIntro'));
const HomePage = lazy(() => import("./Home/HomePage"));
const ProjectsPage = lazy(() => import("./Projects/ProjectsPage"));
const ExperiencePage = lazy(() => import("./Experience/ExperiencePage"));
const ContactPage = lazy(() => import("./Contact/ContactPage"));

// Prefetch other routes after initial load
const prefetchComponents = () => {
  const timer = setTimeout(() => {
    import("./Projects/ProjectsPage");
    import("./Experience/ExperiencePage");
    import("./Contact/ContactPage");
  }, 2000);
  return () => clearTimeout(timer);
};

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-imperial-black flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 sm:w-16 sm:h-16 border-3 border-saber-400/30 border-t-saber-400 
                    rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white/60 text-sm sm:text-base animate-pulse">Loading...</p>
    </div>
  </div>
);

// Error fallback
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen bg-imperial-black flex items-center justify-center px-4">
    <div className="text-white text-center max-w-md">
      <h2 className="text-xl sm:text-2xl mb-4 font-bold">Something went wrong</h2>
      <pre className="text-xs sm:text-sm mb-4 text-white/60 whitespace-pre-wrap">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 sm:px-6 py-2 sm:py-3 bg-saber-500 rounded-lg hover:bg-saber-600 
                 transition-colors text-sm sm:text-base font-medium"
      >
        Try again
      </button>
    </div>
  </div>
);

function App() {
  // Use sessionStorage to check if this is the first visit in this session
  const hasSeenIntroThisSession = sessionStorage.getItem('hasSeenIntro') === 'true';
  const [isIntroComplete, setIsIntroComplete] = useState(hasSeenIntroThisSession);
  const [showIntro, setShowIntro] = useState(!hasSeenIntroThisSession);
  const [isScrolled, setIsScrolled] = useState(false);
  const rafRef = useRef(null);
  const lastScrollY = useRef(0);

  // Lock body scroll while intro is playing
  useEffect(() => {
    if (showIntro) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [showIntro]);

  // Optimized scroll handler
  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY.current) > 5) {
        setIsScrolled(currentScrollY > 50);
        lastScrollY.current = currentScrollY;
      }
      rafRef.current = null;
    });
  }, []);

  // Handle intro completion
  const handleIntroComplete = useCallback(() => {
    setIsIntroComplete(true);
    setShowIntro(false);
    sessionStorage.setItem('hasSeenIntro', 'true');
  }, []);

  // Scroll listener with cleanup
  useEffect(() => {
    if (!showIntro) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }
  }, [handleScroll, showIntro]);

  // Prefetch components after intro
  useEffect(() => {
    if (isIntroComplete) {
      return prefetchComponents();
    }
  }, [isIntroComplete]);

  // Handle reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Skip intro if reduced motion is preferred
  useEffect(() => {
    if (prefersReducedMotion && showIntro) {
      handleIntroComplete();
    }
  }, [prefersReducedMotion, showIntro, handleIntroComplete]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ParallaxProvider>
        <HashRouter>
          <BackgroundProvider>
            {/* Show intro only on first visit this session */}
            {showIntro && !prefersReducedMotion && (
              <Suspense fallback={
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                  <div className="text-white animate-pulse">Loading hyperspace...</div>
                </div>
              }>
                <HyperspaceIntro onComplete={handleIntroComplete} />
              </Suspense>
            )}
            
            {/* Main app content */}
            <AnimatePresence mode="wait">
              {isIntroComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ 
                    duration: 0.8,
                    ease: "easeOut"
                  }}
                  className="min-h-screen bg-imperial-black"
                >
                  <Navigation isScrolled={isScrolled} />
                  
                  <main className="relative">
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route path="/experience" element={<ExperiencePage />} />
                        <Route path="/contact" element={<ContactPage />} />
                      </Routes>
                    </Suspense>
                  </main>
                </motion.div>
              )}
            </AnimatePresence>
          </BackgroundProvider>
        </HashRouter>
      </ParallaxProvider>
    </ErrorBoundary>
  );
}

export default App;
