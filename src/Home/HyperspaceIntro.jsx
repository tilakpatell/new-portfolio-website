// HyperspaceIntro.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const HyperspaceIntro = ({ onComplete }) => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete();
    }, 7000); 

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 1.2,
            ease: "easeInOut"
          }} 
          className="fixed inset-0 z-50 bg-black overflow-hidden"
        >
          <video
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ playbackRate: 1.8 }} 
            onLoadedMetadata={(e) => {
              e.target.playbackRate = 1.8; 
            }}
            onEnded={() => {
              setTimeout(() => {
                setIsAnimating(false);
                onComplete();
              }, 300);
            }}
          >
            <source src="/hyperspace.mp4" type="video/mp4" />
          </video>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HyperspaceIntro;
