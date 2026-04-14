import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

const PLAYBACK_RATE = 2.5;
const MAX_DURATION = 15000; // safety timeout (ms)

const HyperspaceIntro = ({ onComplete }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const doneRef = useRef(false);

  const handleComplete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsAnimating(false);
    setTimeout(onComplete, 600);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = PLAYBACK_RATE;
    }
    timerRef.current = setTimeout(handleComplete, MAX_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] bg-black overflow-hidden"
        >
          <video
            ref={videoRef}
            autoPlay muted playsInline
            className="absolute inset-0 w-full h-full object-contain border-0 outline-none"
            style={{ border: 'none', background: '#000' }}
            onEnded={handleComplete}
            onError={handleComplete}
          >
            <source src="/hyperspace.mp4" type="video/mp4" />
          </video>

          {/* Vignette to blend edges into the background */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)' }}
          />

          {/* Skip button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleComplete}
            className="absolute bottom-6 right-6 z-20 px-4 py-2
                       text-xs font-medium tracking-wider uppercase
                       text-white/40 hover:text-white/72
                       border border-white/15 hover:border-white/28
                       bg-black/40 backdrop-blur-sm transition-all duration-300"
          >
            Skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HyperspaceIntro;
