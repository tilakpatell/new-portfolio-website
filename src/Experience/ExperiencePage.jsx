import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  RiSwordLine,
  RiTimeLine,
  RiStarLine,
} from "react-icons/ri";
import { useState, useRef, memo, useMemo, useCallback } from "react";

const ParticleEffect = memo(() => {
  const particles = useMemo(() => {
    const count = window.innerWidth < 640 ? 5 : 10;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 3 + Math.random() * 2,
      delay: i * 0.5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-force-400/30 rounded-full animate-twinkle"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
});

ParticleEffect.displayName = "ParticleEffect";

const CompanyLogo = memo(({ company }) => {
  const logoMap = {
    "Northeastern High Performance Computing Lab": "/hpclogo.jpg",
    Later: "/later.png",
    "Empowerreg AI": "/empower.png",
    "SRC" : "/src-logo.png"
  };

  return (
    <div className="relative flex-shrink-0">
      <div
        className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-force-500/10 to-saber-500/10 
                  border border-white/10 backdrop-blur-xs
                  group-hover:border-force-400/30 
                  transition-all duration-300 transform-gpu"
      >
        {logoMap[company] ? (
          <img
            src={logoMap[company]}
            alt={`${company} logo`}
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
          />
        ) : (
          <RiSwordLine className="w-5 h-5 sm:w-6 sm:h-6 text-force-400" />
        )}
      </div>
    </div>
  );
});

CompanyLogo.displayName = "CompanyLogo";

const ExperienceCard = memo(({ experience, index, isSelected, onClick }) => {
  const cardRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rafId = useRef(null);
  
  const handleMouseMove = useCallback((e) => {
    if (rafId.current) return;
    
    rafId.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
      rafId.current = null;
    });
  }, [mouseX, mouseY]);

  const backgroundX = useTransform(mouseX, [0, 1], [0, 100]);
  const backgroundY = useTransform(mouseY, [0, 1], [0, 100]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.08,
        ease: "easeOut"
      }}
      className="group relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseX.set(0.5);
        mouseY.set(0.5);
      }}
    >
      <div
        onClick={onClick}
        className={`relative rounded-2xl border backdrop-blur-sm cursor-pointer
                   overflow-hidden transition-all duration-300 transform-gpu
                   ${
                     isSelected
                       ? "p-6 sm:p-8 border-force-400/40 bg-black/70 shadow-red-saber"
                       : "p-4 sm:p-6 border-white/10 bg-black/50 hover:border-force-500/30"
                   }`}
      >
        {/* Simplified gradient background */}
        <motion.div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${backgroundX}% ${backgroundY}%, rgba(220, 38, 38, 0.2), transparent 60%)`,
          }}
        />

        {/* Static hologram effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent pointer-events-none" />

        {index !== 0 && (
          <div
            className="absolute -top-8 left-8 sm:left-12 w-0.5 h-8 
                       bg-gradient-to-b from-transparent via-force-400/40 to-force-400/20"
          />
        )}

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 relative z-10">
          <CompanyLogo company={experience.company} />
          <div className="flex-1 space-y-3 sm:space-y-4">
            <div>
              <h3
                className="text-xl sm:text-2xl font-bold text-white group-hover:text-force-300 
                         transition-colors duration-300"
              >
                {experience.title}
              </h3>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-2">
                <span className="text-base sm:text-lg text-white/70">
                  {experience.company}
                </span>
                <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-force-400/50" />
                <span className="flex items-center gap-2 text-sm sm:text-base text-white/60">
                  <RiTimeLine className="w-3 h-3 sm:w-4 sm:h-4" />
                  {experience.period}
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base text-white/80 leading-relaxed">
              {experience.description}
            </p>

            <AnimatePresence>
              {isSelected && experience.achievements && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeInOut"
                  }}
                >
                  <ul className="space-y-2 sm:space-y-3 pt-3 border-t border-white/10">
                    {experience.achievements.map((achievement, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ 
                          delay: i * 0.05,
                          duration: 0.2
                        }}
                        className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-white/70"
                      >
                        <RiStarLine className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-force-400 flex-shrink-0" />
                        <span>{achievement}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-3">
              {experience.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full 
                           bg-gradient-to-r from-white/5 to-white/10 text-white/90
                           border border-white/10 hover:border-force-400/40
                           transition-colors duration-200
                           backdrop-blur-xs"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ExperienceCard.displayName = "ExperienceCard";

const experiences = [
  {
    title: "Machine Learning Engineer Intern",
    company: "SRC",
    period: "Apr 2025 - Jul 2025",
    description:
      "Building intelligent document processing systems for radar analysis, leveraging LLMs and knowledge graphs to automate technical document extraction and analysis workflows.",
    achievements: [
      "Enabled knowledge graph population by extracting structured facts and triplets from technical documents using a LangGraph-Pydantic-based system with 90% accuracy",
      "Reduced manual analysis time by 70% by automating document metadata and fact extraction from radar documents, improving speed and consistency for radar analysts",
      "Extracted document metadata (title, author, date, etc.) with 80% accuracy using regex and document libraries, while designing modular components to avoid LLM overhead",
    ],
    skills: [
      "LangGraph",
      "Pydantic",
      "Knowledge Graphs",
      "Document Processing",
      "LLMs",
      "Python",
      "Regex",
      "NLP",
    ],
  },
  {
    title: "Researcher",
    company: "Northeastern High Performance Computing Lab",
    period: "Jan 2025 - Present",
    description:
      "Optimizing MPI checkpointing systems for large-scale supercomputing applications through MANA/DMTCP framework, focusing on improving communication and synchronization between processes.",
    achievements: [
      "Conducting performance analysis on Northeastern's Discovery cluster using flame graphs to identify and reduce checkpoint/restart overhead in HPC workloads",
      "Leveraging Discovery's distributed computing cluster to do checkpoint analysis across 50,000+ CPU cores, enabling large-scale performance benchmarking and optimization",
      "Utilizing Discovery's advanced computing infrastructure at the Massachusetts Green HPC Center for distributed computing research",
    ],
    skills: [
      "MPI",
      "MANA/DMTCP",
      "Performance Analysis",
      "HPC",
      "Distributed Computing",
    ],
  },
  {
    title: "R&D Software Engineer",
    company: "Later",
    period: "Sept 2024 - Dec 2024",
    description:
      "Led a team of four in collaboration between Northeastern's Data Initiative and Later to build a scalable vision-language system on AWS EC2, processing 1M+ images efficiently.",
    achievements: [
      "Architected vision-language system (CLIP, BLIP, Llama), processing 1M+ images with speed and modularity",
      "Engineered optimized CLIP-BLIP pipeline combining embedding generation and image captioning, achieving dynamic labeling and improved performance",
      "Developed FAISS indexing with KMeans clustering enabling similarity search across a million-scale image dataset",
    ],
    skills: [
      "Computer Vision",
      "NLP",
      "AWS",
      "CLIP",
      "BLIP",
      "LLaMA",
      "FAISS",
      "KMeans",
    ],
  },
  {
    title: "Generative AI Intern",
    company: "Empowerreg AI",
    period: "July 2024 - Sept 2024",
    description:
      "Developed AI-driven visualization systems for medical device risk assessment and regulatory compliance.",
    achievements: [
      "Engineered production-ready visualizations for Risk Annotation Matrix Product, enhancing data interpretation",
      "Developed visualizations for multi-dimensional risk and complaint data analysis of medical devices from LLMs",
      "Optimized processing of 1,000+ lines of JSON medical device data using FastAPI, reducing transmission time",
    ],
    skills: [
      "Data Visualization",
      "FastAPI",
      "LLMs",
      "JSON Processing",
      "Risk Analysis",
    ],
  },
];

const ExperiencePage = () => {
  const [selectedCard, setSelectedCard] = useState(null);

  return (
    <section className="relative min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 bg-imperial-black overflow-hidden">
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40 sm:opacity-60"
        >
          <source src="/spaceclonewars.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 bg-gradient-to-b from-imperial-black/90 
                     via-imperial-black/70 to-imperial-black/90"
        />
        <ParticleEffect />
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-20"
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6
                     [text-shadow:_0_0_30px_rgba(220,38,38,0.3)]"
          >
            Professional Experience
          </h2>

          <div
            className="w-32 h-0.5 bg-gradient-to-r from-force-500/0 via-force-400 to-force-500/0 
                     mx-auto shadow-red-saber"
          />

          <p
            className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mx-auto mt-4 sm:mt-6 px-4"
          >
            A timeline of my professional journey and technical accomplishments
          </p>
        </motion.div>

        <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
          {experiences.map((experience, index) => (
            <ExperienceCard
              key={index}
              experience={experience}
              index={index}
              isSelected={selectedCard === index}
              onClick={() =>
                setSelectedCard(selectedCard === index ? null : index)
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExperiencePage;
