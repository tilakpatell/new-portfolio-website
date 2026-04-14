import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const DeathStarPage = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4">
      <div ref={ref} className="text-center space-y-8 max-w-lg">

        {/* Death Star schematic */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="relative w-56 h-56 sm:w-72 sm:h-72 mx-auto"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Outer hull */}
            <circle cx={100} cy={100} r={92} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
            <circle cx={100} cy={100} r={88} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />

            {/* Surface panels — horizontal lines */}
            {[30, 50, 70, 130, 150, 170].map(y => {
              const dx = Math.sqrt(Math.max(0, 92 * 92 - (y - 100) * (y - 100)));
              return <line key={y} x1={100 - dx} y1={y} x2={100 + dx} y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth={0.4} />;
            })}

            {/* Equator trench */}
            <line x1={8} y1={100} x2={192} y2={100} stroke="rgba(255,255,255,0.14)" strokeWidth={0.6} />

            {/* Meridian arcs */}
            <path d="M 100 8 Q 145 100 100 192" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.4} />
            <path d="M 100 8 Q 55 100 100 192" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.4} />

            {/* Superlaser focus dish */}
            <circle cx={72} cy={62} r={22} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.16)" strokeWidth={0.7} />
            <circle cx={72} cy={62} r={10} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.4} />
            <circle cx={72} cy={62} r={3} fill="rgba(255,255,255,0.20)" />

            {/* Pulse ring */}
            <motion.circle
              cx={72} cy={62} r={10} fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.5}
              initial={{ r: 10, opacity: 0.4 }}
              animate={{ r: 30, opacity: 0 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
            />

            {/* Status indicator lights */}
            {[
              [150, 75], [160, 90], [155, 115], [145, 130],
              [50, 130], [42, 115], [45, 90],
            ].map(([x, y], i) => (
              <motion.circle key={i} cx={x} cy={y} r={1.2}
                fill="rgba(255,255,255,0.35)"
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 1.5 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </svg>

          {/* Rotating scanner */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-1/2 left-1/2 h-px w-1/2 origin-left
                            bg-gradient-to-r from-white/15 to-transparent" />
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <span className="font-mono text-[0.50rem] tracking-[0.24em] text-white/22 uppercase">
            ◈ Project Stardust · Classified
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white/85 uppercase tracking-wide">
            DS-1 Orbital Battle Station
          </h1>
          <p className="font-mono text-[0.56rem] tracking-[0.14em] text-white/25 uppercase">
            Diameter: 120km · Crew: 1,186,295 · Status: Fully Operational
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
          className="space-y-4"
        >
          <p className="text-sm text-white/40 italic max-w-sm mx-auto leading-relaxed">
            "That's no moon. It's a space station."
          </p>
          <p className="font-mono text-[0.52rem] text-white/20">— Obi-Wan Kenobi</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9 }}
        >
          <a href="/#/" className="btn-imperial px-6 py-2.5 text-xs inline-flex items-center gap-2">
            Return to Base
          </a>
        </motion.div>

        {/* Classification footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 1.1 }}
          className="pt-6"
        >
          <span className="font-mono text-[0.40rem] tracking-[0.30em] text-white/10 uppercase">
            Imperial Department of Military Research · Access Level: Moff
          </span>
        </motion.div>
      </div>
    </main>
  );
};

export default DeathStarPage;
