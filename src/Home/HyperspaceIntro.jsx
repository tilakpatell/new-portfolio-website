import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

const HyperspaceIntro = ({ onComplete }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showFallback, setShowFallback] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    // fallback loading if video doesn't load within 2 seconds
    fallbackTimerRef.current = setTimeout(() => {
      setShowFallback(true);
    }, 2000);

    timerRef.current = setTimeout(() => {
      handleComplete();
    }, 7000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  const handleComplete = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setIsAnimating(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleVideoCanPlay = () => {
    // Clear fallback timer since video is ready
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      setShowFallback(false);
    }
    
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.8;
      videoRef.current.play().catch(err => {
        console.error('Video play failed:', err);
        handleComplete();
      });
    }
  };

  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.8,
            ease: "easeInOut"
          }} 
          className="fixed inset-0 z-[100] bg-black overflow-hidden"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ 
              width: '100%', 
              height: '100%',
              objectFit: 'cover'
            }}
            onCanPlayThrough={handleVideoCanPlay}
            onEnded={handleComplete}
            onError={handleComplete}
          >
            <source src="/hyperspace.mp4" type="video/mp4" />
          </video>
          
          <AnimatePresence>
            {showFallback && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50"
              >
                <div className="w-12 h-12 border-3 border-saber-400/30 border-t-saber-400 
                              rounded-full animate-spin"></div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            onClick={handleComplete}
            className="absolute bottom-8 right-8 px-4 py-2 bg-white/10 backdrop-blur-sm
                     text-white text-sm rounded-lg border border-white/20
                     hover:bg-white/20 transition-all duration-300 z-10"
          >
            Skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HyperspaceIntro;
