import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  RiSwordLine,
  RiTimeLine,
  RiStarLine,
  RiMedalLine,
} from "react-icons/ri";
import { useState, useRef } from "react";

const ParticleEffect = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [-20, -100],
            x: Math.random() * 20 - 10,
          }}
          transition={{
            duration: 3,
            delay: i * 0.2,
            repeat: Infinity,
            repeatType: "loop",
          }}
          className="absolute w-1 h-1 bg-force-500/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
};

const CompanyLogo = ({ company }) => {
  const logoMap = {
    "Northeastern High Performance Computing Lab": "/hpclogo.jpg",
    Later: "/later.png",
    "Empowerreg AI": "/empower.png",
  };

  return (
    <div className="relative flex-shrink-0">
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="p-4 rounded-lg bg-force-500/10 border border-force-500/20
                  group-hover:border-force-500/50 transition-all duration-500"
      >
        {logoMap[company] ? (
          <img
            src={logoMap[company]}
            alt={`${company} logo`}
            className="w-12 h-12 object-contain"
          />
        ) : (
          <RiSwordLine className="w-6 h-6 text-force-400" />
        )}
      </motion.div>
      <div
        className="absolute inset-0 bg-force-500/20 blur-xl 
                     opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
    </div>
  );
};

const ExperienceCard = ({ experience, index, isSelected, onClick }) => {
  const cardRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5], [0.98, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0.6, 1]);

  return (
    <motion.div
      ref={cardRef}
      style={{ scale, opacity }}
      className={`group relative ${isSelected ? "z-20" : "z-10"}`}
      layout
    >
      <motion.div
        onClick={onClick}
        className={`relative rounded-xl border backdrop-blur-lg cursor-pointer
                   transition-all duration-500 hover:border-force-500/50
                   ${
                     isSelected
                       ? "p-8 border-force-500/30 bg-black/80"
                       : "p-6 border-white/10 bg-black/60"
                   }`}
      >
        <div
          className="absolute inset-0 rounded-xl bg-force-500/5 filter blur-xl 
                       opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />

        {index !== 0 && (
          <div
            className="absolute -top-8 left-12 w-0.5 h-8 
                         bg-gradient-to-b from-transparent to-force-500/30"
          />
        )}

        <div className="flex items-start gap-6 relative z-10">
          <CompanyLogo company={experience.company} />
          <div className="flex-1 space-y-4">
            <div>
              <h3
                className="text-2xl font-bold text-white group-hover:text-force-400 
                           transition-colors duration-300"
              >
                {experience.title}
              </h3>

              <div className="flex items-center gap-3 mt-2">
                <span className="text-lg text-white/70">
                  {experience.company}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-force-500/50" />
                <span className="flex items-center gap-2 text-white/70">
                  <RiTimeLine className="w-4 h-4" />
                  {experience.period}
                </span>
              </div>
            </div>

            <p className="text-white/80 leading-relaxed">
              {experience.description}
            </p>

            {isSelected && experience.achievements && (
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-3 pt-2"
              >
                {experience.achievements.map((achievement, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-start gap-3 text-white/70"
                  >
                    <RiStarLine className="w-5 h-5 mt-1 text-force-400" />
                    <span>{achievement}</span>
                  </motion.li>
                ))}
              </motion.ul>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {experience.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 text-sm rounded-full bg-white/5 text-white/90
                           border border-white/10 group-hover:border-force-500/30
                           transition-all duration-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const experiences = [
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
    <section className="relative min-h-screen pt-24 pb-16 bg-black overflow-hidden">
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-70"
        >
          <source src="/spaceclonewars.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/90 
                       via-black/70 to-black/90"
        />
        <ParticleEffect />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-block"
          >
            <h2
              className="text-5xl md:text-6xl font-bold text-white mb-6
               [text-shadow:_0_0_30px_rgba(220,38,38,0.3)]"
            >
              Professional Experience
            </h2>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "120px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-0.5 bg-gradient-to-r from-force-500/30 via-force-400/50 to-force-500/30 mx-auto"
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/80 max-w-2xl mx-auto mt-6"
          >
            A timeline of my professional journey and technical accomplishments
          </motion.p>
        </motion.div>

        <div className="space-y-12 max-w-4xl mx-auto">
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
