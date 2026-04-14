import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const CustomCursor = () => {
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);

  // Fast inner dot
  const dx = useSpring(mx, { stiffness: 2000, damping: 120 });
  const dy = useSpring(my, { stiffness: 2000, damping: 120 });

  // Lagging outer ring
  const rx = useSpring(mx, { stiffness: 280, damping: 36 });
  const ry = useSpring(my, { stiffness: 280, damping: 36 });

  // Trail dots (progressively slower springs)
  const t1x = useSpring(mx, { stiffness: 700, damping: 55 });
  const t1y = useSpring(my, { stiffness: 700, damping: 55 });
  const t2x = useSpring(mx, { stiffness: 350, damping: 42 });
  const t2y = useSpring(my, { stiffness: 350, damping: 42 });
  const t3x = useSpring(mx, { stiffness: 160, damping: 32 });
  const t3y = useSpring(my, { stiffness: 160, damping: 32 });

  useEffect(() => {
    const move = (e) => { mx.set(e.clientX); my.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mx, my]);

  const trail = [
    [t1x, t1y, 0.14, 3],
    [t2x, t2y, 0.08, 2],
    [t3x, t3y, 0.04, 2],
  ];

  return (
    <>
      {/* Trail dots */}
      {trail.map(([tx, ty, opa, sz], i) => (
        <motion.div
          key={`trail-${i}`}
          className="fixed pointer-events-none z-[99996] hidden lg:block"
          style={{ left: tx, top: ty, x: '-50%', y: '-50%' }}
        >
          <div style={{ width: sz, height: sz, backgroundColor: `rgba(255,255,255,${opa})` }} />
        </motion.div>
      ))}

      {/* Inner dot */}
      <motion.div
        className="fixed pointer-events-none z-[99999] hidden lg:block"
        style={{ left: dx, top: dy, x: '-50%', y: '-50%' }}
      >
        <div className="w-[5px] h-[5px] bg-white/70" />
      </motion.div>

      {/* Outer ring with crosshair ticks */}
      <motion.div
        className="fixed pointer-events-none z-[99998] hidden lg:block"
        style={{ left: rx, top: ry, x: '-50%', y: '-50%' }}
      >
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border border-white/22" />
          <div className="absolute top-0 left-1/2 w-px h-2 bg-white/22 -translate-x-1/2 -translate-y-full" />
          <div className="absolute bottom-0 left-1/2 w-px h-2 bg-white/22 -translate-x-1/2 translate-y-full" />
          <div className="absolute top-1/2 left-0 h-px w-2 bg-white/22 -translate-y-1/2 -translate-x-full" />
          <div className="absolute top-1/2 right-0 h-px w-2 bg-white/22 -translate-y-1/2 translate-x-full" />
        </div>
      </motion.div>
    </>
  );
};

export default CustomCursor;
