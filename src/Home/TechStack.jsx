// TechStack.jsx
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { 
  CodeBracketIcon,
  ServerIcon,
  CloudIcon,
  CommandLineIcon,
  CpuChipIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  WindowIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline';

const HologramBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" />
      <video
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover opacity-30"
      >
        <source src="/death_star.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />
    </div>
  );
};

const SkillCard = ({ title, icon: Icon, skills, delay }) => {
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
      className="h-full"
    >
      <div className="h-full rounded-2xl p-6 
                    border border-white/20 hover:border-white/40
                    transition-all duration-500 group relative overflow-hidden
                    bg-white/10">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-white/10 border border-white/20
                          group-hover:bg-white/20 transition-colors duration-300">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <motion.span
                key={skill}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay + (index * 0.1) }}
                className="px-3 py-1.5 bg-white/10 text-white 
                         rounded-full text-sm border border-white/20
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
};

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

const FloatingParticle = ({ delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0, 1, 0],
        y: [-20, -40],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 2
      }}
      className="absolute w-1 h-1 bg-white/20 rounded-full"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`
      }}
    />
  );
};

const TechStack = () => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
 
  return (
    <section className="relative min-h-screen py-24 overflow-hidden bg-black">
      <HologramBackground />
 
      <motion.div
        style={{
          opacity: smoothProgress,
          y: useTransform(smoothProgress, [0, 1], [100, 0])
        }}
        className="relative container mx-auto px-4 z-20"
      >
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-block"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6
                         [text-shadow:_0_0_10px_rgba(255,255,255,0.5)]">
              Technical Arsenal
            </h2>
            <div className="h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </motion.div>
          
          <p className="text-xl text-white/90 max-w-3xl mx-auto mt-6">
            Command center of cutting-edge technologies and tools
          </p>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-20">
          {categories.map((category, index) => (
            <SkillCard
              key={index}
              {...category}
              delay={0.1 * index}
            />
          ))}
        </div>
 
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 0],
                y: [-20, -40],
                x: Math.random() * 10
              }}
              transition={{
                duration: 2,
                delay: i * 0.1,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/50 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(255,255,255,0.02)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
      </motion.div>
       <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 pointer-events-none"
        whileHover={{ opacity: 0.1 }}
        transition={{ duration: 0.3 }}
      />
    </section>
  );
};

export default TechStack;
