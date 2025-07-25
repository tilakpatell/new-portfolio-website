import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { RiGithubLine, RiExternalLinkLine, RiStarLine } from "react-icons/ri";
import { useSpring, animated } from "@react-spring/web";
import { Parallax } from "react-scroll-parallax";

const VideoBackground = () => {
  return (
    <div className="fixed inset-0 z-5">
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40"
        >
          <source src="/spaceship.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
};

const LivePreview = () => {
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');
  const iframeRef = useRef(null);
  
  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash || '#/';
      setCurrentPath(newPath);
      
      // Update iframe URL when hash changes
      if (iframeRef.current) {
        const baseUrl = window.location.origin;
        iframeRef.current.src = `${baseUrl}/${newPath}`;
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Determine if we're in development or production
  const isDevelopment = window.location.hostname === 'localhost';
  const displayUrl = isDevelopment 
    ? `localhost:5173${currentPath}` 
    : `tilakpatell.com${currentPath}`;
  
  const iframeUrl = `${window.location.origin}/${currentPath}`;

  return (
    <div className="relative w-full h-full bg-imperial-black overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-6 bg-gray-800 flex items-center px-2 gap-1 z-20">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </div>
        <div className="flex-1 mx-2 h-3 bg-gray-700 rounded-sm flex items-center px-2">
          <span className="text-[6px] text-gray-400 truncate">{displayUrl}</span>
        </div>
      </div>
      
      <div className="absolute top-6 left-0 right-0 bottom-0 overflow-hidden">
        <div className="w-full h-full transform scale-[0.25] origin-top-left">
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            className="w-[400%] h-[400%] border-0"
            style={{
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
            title="Portfolio Live Preview"
          />
        </div>
        
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600/80 px-2 py-0.5 rounded-full z-20">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          <span className="text-[8px] text-white font-medium">LIVE</span>
        </div>
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10"></div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isPortfolioProject = project.title === "Personal Portfolio";

  const imageSpring = useSpring({
    scale: isHovered ? 1.05 : 1,
    config: { mass: 1, tension: 200, friction: 26 },
  });

  const cardSpring = useSpring({
    borderColor: isHovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
    boxShadow: isHovered
      ? "0 0 25px rgba(59, 130, 246, 0.15)"
      : "0 0 0px rgba(59, 130, 246, 0)",
    config: { mass: 1, tension: 170, friction: 26 },
  });

  return (
    <Parallax speed={3} translateY={[0, -15]}>
      <animated.div
        style={cardSpring}
        className="h-full overflow-hidden rounded-xl bg-black/40 
                border border-white/10 transition-all duration-300 backdrop-blur-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.08 }}
        >
          <div className="relative h-48 overflow-hidden bg-black/50 flex items-center justify-center">
            {isPortfolioProject ? (
              <div className="w-full h-full">
                <LivePreview />
              </div>
            ) : (
              <animated.img
                style={imageSpring}
                src={project.image}
                alt={project.title}
                className="w-auto h-auto max-w-[85%] max-h-[85%] object-contain"
              />
            )}
            
            {!isPortfolioProject && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
            )}

            <animated.div
              style={{
                opacity: isHovered ? 1 : 0,
              }}
              className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent transition-opacity duration-500"
            />
          </div>

          <div className="p-6 space-y-4">
            <motion.div
              className="flex items-center gap-2"
              animate={{ x: isHovered ? 2 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <RiStarLine className="w-5 h-5 text-blue-400" />
              <h3 className="text-xl font-bold text-white">{project.title}</h3>
            </motion.div>

            <p className="text-white/70 text-sm line-clamp-3">
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {project.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-xs rounded-full bg-white/5 text-white/70
                           border border-white/10 hover:border-blue-400/30 hover:bg-white/10
                           transition-colors duration-300"
                >
                  {tech}
                </span>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              {project.link && (
                <motion.a
                  href={project.link}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/10 hover:border-blue-400/30
                           transition-all duration-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <RiGithubLine className="w-4 h-4" />
                  <span className="text-sm">View Project</span>
                </motion.a>
              )}
            </div>
          </div>
        </motion.div>
      </animated.div>
    </Parallax>
  );
};

const projects = [
  {
    id: 1,
    title: "Personal Portfolio",
    description:
      "A modern, responsive portfolio website built to showcase my projects and skills, emphasizing performance and user experience.",
    image: "/website.png",
    technologies: ["React", "Vite", "Framer Motion", "Tailwind CSS", "Git"],
    link: "https://github.com/tilakpatell/Portfolio-Website",
  },
  {
    id: 2,
    title: "DevSpace",
    description:
      "A real-time collaborative GPU-accelerated development environment with AI-assisted coding, integrated Docker containerization, and multi-language support.",
    image: "/devspace.jpeg",
    technologies: [
      "React",
      "Java Spring",
      "MongoDB",
      "CUDA",
      "Docker",
      "WebSockets",
      "Monaco Editor",
    ],
    link: "https://github.com/shreyaanpathak/devspace",
  },
  {
    id: 3,
    title: "Interactive AI Tutor",
    description:
      "An advanced tutoring system leveraging LLMs to provide personalized learning support and guided problem-solving.",
    image: "/langchain-openai.jpg",
    technologies: [
      "Python",
      "LangChain",
      "Gradio",
      "Tavily API",
      "Llama 3",
      "OpenAI API",
    ],
    link: "https://github.com/vishyka/LLM-tutor",
  },
  {
    id: 4,
    title: "FUSE File System",
    description:
      "A custom implementation of a file system using FUSE, featuring comprehensive file operations and memory management.",
    image: "/C-Logo.png",
    technologies: ["C", "FUSE", "Linux", "Memory Mapping"],
    link: "https://github.com/tilakpatell/File-System-Project",
  },
  {
    id: 5,
    title: "Finance Platform",
    description:
      "A comprehensive financial platform featuring real-time stock data analysis and AI-powered portfolio recommendations.",
    image: "/mongodb.png",
    technologies: [
      "React",
      "TypeScript",
      "Python FastAPI",
      "MongoDB",
      "TailwindCSS",
      "Framer Motion",
    ],
    link: "https://github.com/tilakpatell/webdev-final-backend",
  },
  {
    id: 6,
    title: "Unix Shell",
    description:
      "A custom Unix shell implementation featuring built-in commands, process management, and inter-process communication.",
    image: "/C-Logo.png",
    technologies: ["C", "Unix System Calls", "Process Management", "IPC"],
    link: "https://github.com/tilakpatell/Shell-Project",
  },
  {
    id: 7,
    title: "Smart Summarization Tool",
    description:
      "An advanced NLP tool that utilizes BERT for efficient and accurate text summarization, optimized for performance and scalability.",
    image: "/pytorch.png",
    technologies: [
      "Python",
      "PyTorch",
      "BERT",
      "Transformers",
      "Google Colab",
      "Seaborn",
      "Matplotlib",
    ],
    link: "https://github.com/tilakpatell/smart-summarizer-bert",
  },
];

const ProjectsPage = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.2]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <main className="relative min-h-screen bg-black">
      <VideoBackground />

      <div ref={containerRef} className="relative pt-24 pb-16">
        <motion.div
          style={{ opacity, scale }}
          className="container mx-auto px-4 text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          ></motion.div>

          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6
                     [text-shadow:_0_0_30px_rgba(59,130,246,0.3)]"
          >
            My Projects
          </h1>

          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-[120px] h-0.5 bg-gradient-to-r from-saber-500/30 via-saber-400/50 to-saber-500/30 mx-auto mb-4"
          />

          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Explore my latest work in AI, systems development, and web
            applications
          </p>
        </motion.div>

        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {projects.map((project, index) => (
              <ProjectCard key={index} project={project} index={index} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ProjectsPage;
