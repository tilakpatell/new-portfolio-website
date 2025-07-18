import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef, memo, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { 
  CodeBracketIcon,
  ServerIcon,
  CloudIcon,
  CommandLineIcon,
  CpuChipIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

const HologramBackground = memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" />
      <video
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover opacity-20 sm:opacity-30"
      >
        <source src="/death_star.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] hidden sm:block" />
    </div>
  );
});

HologramBackground.displayName = 'HologramBackground';

const SkillCard = memo(({ title, icon: Icon, skills, delay }) => {
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="h-full transform-gpu"
    >
      <div className="h-full rounded-2xl p-4 sm:p-6 
                    border border-white/20 hover:border-white/40
                    transition-all duration-500 group relative overflow-hidden
                    bg-white/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 rounded-xl bg-white/10 border border-white/20
                          group-hover:bg-white/20 transition-colors duration-300">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white">{title}</h3>
          </div>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {skills.map((skill, index) => (
              <motion.span
                key={skill}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: delay + (index * 0.05) }}
                className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/10 text-white 
                         rounded-full text-xs sm:text-sm border border-white/20
                         hover:border-white/40 hover:bg-white/20 
                         transition-all duration-300"
              >
                {skill}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

SkillCard.displayName = 'SkillCard';

const categories = [
  {
    title: "Programming Languages",
    icon: CodeBracketIcon,
    skills: ["Python", "Java", "C/C++", "JavaScript", "TypeScript", "Assembly (x86)"]
  },
  {
    title: "AI & Machine Learning",
    icon: BeakerIcon,
    skills: ["PyTorch", "NumPy", "Pandas", "LLMs", "RAG", "NLP", "Hugging Face", "LangChain"]
  },
  {
    title: "Backend Development",
    icon: ServerIcon,
    skills: ["Node.js", "FastAPI", "Flask", "MongoDB", "GraphQL", "REST APIs"]
  },
  {
    title: "Systems & Hardware",
    icon: CpuChipIcon,
    skills: ["Linux", "Operating Systems", "DE1-SoC", "FPGA Design", "Memory Mapping"]
  },
  {
    title: "DevOps & Cloud",
    icon: CloudIcon,
    skills: ["Docker", "AWS (EC2)", "Git", "CI/CD", "HPC Systems"]
  },
  {
    title: "Robotics & Control",
    icon: CommandLineIcon,
    skills: ["ROS2", "Forward/Inverse Kinematics", "Motion Planning", "Servo Motors"]
  },
];

const ParticleField = memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: i * 0.2
    })), []
  );

  return (
    <div className="absolute inset-0 pointer-events-none hidden sm:block">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [-20, -40],
            x: Math.random() * 10
          }}
          transition={{
            duration: 3,
            delay: particle.delay,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: particle.left,
            top: particle.top
          }}
        />
      ))}
    </div>
  );
});

ParticleField.displayName = 'ParticleField';

const TechStack = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });
  
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
 
  return (
    <section ref={containerRef} className="relative min-h-screen py-16 sm:py-24 overflow-hidden bg-black">
      <HologramBackground />
 
      <motion.div
        style={{
          opacity: useTransform(smoothProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
          y: useTransform(smoothProgress, [0, 0.2], [50, 0])
        }}
        className="relative container mx-auto px-4 sm:px-6 lg:px-8 z-20"
      >
        <div className="text-center mb-12 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="inline-block"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6
                         [text-shadow:_0_0_10px_rgba(255,255,255,0.5)]">
              Technical Arsenal
            </h2>
            <div className="h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </motion.div>
          
          <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto mt-4 sm:mt-6 px-4">
            Command center of cutting-edge technologies and tools
          </p>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-20">
          {categories.map((category, index) => (
            <SkillCard
              key={index}
              {...category}
              delay={0.1 * index}
            />
          ))}
        </div>
 
        <ParticleField />
        
        <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/50 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(255,255,255,0.02)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 hidden sm:block" />
      </motion.div>
    </section>
  );
};

export default TechStack;
