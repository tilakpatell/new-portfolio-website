// App.jsx
import { useState, Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ParallaxProvider } from 'react-scroll-parallax';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { BackgroundProvider } from './Home/BackgroundContext';
import HyperspaceIntro from './Home/HyperspaceIntro';
import Navigation from './Home/Navbar';

// Lazy load pages
const HomePage = lazy(() => import("./Home/HomePage"));
const ProjectsPage = lazy(() => import("./Projects/ProjectsPage"));
const ExperiencePage = lazy(() => import("./Experience/ExperiencePage"));
const ContactPage = lazy(() => import("./Contact/ContactPage"));

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-imperial-black flex items-center justify-center">
    <div className="animate-pulse text-white">Loading...</div>
  </div>
);

// Error fallback
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen bg-imperial-black flex items-center justify-center">
    <div className="text-white text-center">
      <h2 className="text-2xl mb-4">Something went wrong</h2>
      <pre className="text-sm mb-4">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-saber-500 rounded-lg hover:bg-saber-600"
      >
        Try again
      </button>
    </div>
  </div>
);

function App() {
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ParallaxProvider>
        <HashRouter>
          <BackgroundProvider>
            <HyperspaceIntro onComplete={() => setIsIntroComplete(true)} />
            
            <AnimatePresence mode="wait">
              {isIntroComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="min-h-screen bg-imperial-black"
                >
                  <Navigation isScrolled={isScrolled} />
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/projects" element={<ProjectsPage />} />
                      <Route path="/experience" element={<ExperiencePage />} />
                      <Route path="/contact" element={<ContactPage />} />
                    </Routes>
                  </Suspense>
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
