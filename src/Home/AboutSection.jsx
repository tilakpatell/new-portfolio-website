import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

const AboutSection = () => {
  const navigate = useNavigate(); 
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);

  const handleDownloadCV = () => {
    const link = document.createElement('a');
    link.href = '/Resume.pdf';
    link.download = 'Tilak_Patel_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-imperial-black"
    >
      <motion.div style={{ scale }} className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="/star-destroyer.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-imperial-black/30 via-imperial-black/50 to-imperial-black/90" />
      </motion.div>

      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

      <div className="relative z-10 flex items-center justify-center min-h-screen py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.5fr] gap-8 sm:gap-12 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative group mx-auto w-full max-w-sm lg:max-w-none"
              >
                <div
                  className="relative aspect-square w-full max-w-[280px] sm:max-w-[320px] md:max-w-[384px] mx-auto
                             rounded-2xl overflow-hidden 
                             border-2 border-white/20
                             z-10 group-hover:border-white/40 
                             transition-all duration-500 transform
                             group-hover:translate-y-[-8px]"
                >
                  <img
                    src="/profile-pic.jpeg"
                    alt="Profile"
                    className="w-full h-full object-cover 
                             transition-transform duration-700
                             group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>
                <div
                  className="absolute inset-0 bg-white/10 blur-2xl 
                             opacity-0 scale-110 group-hover:opacity-30 
                             transition-all duration-700"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-center lg:text-left space-y-6 sm:space-y-8"
              >
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full 
                           bg-white/5 backdrop-blur-sm border border-white/10"
                >
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs sm:text-sm text-white/80">
                    Available for Work
                  </span>
                </motion.div>

                <h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r 
                             from-white via-white/90 to-white/80 
                             bg-clip-text text-transparent"
                >
                  About Me
                </h2>

                <div className="space-y-4 sm:space-y-6">
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/80 leading-relaxed">
                    I'm a dedicated software engineer with expertise in AI,
                    machine learning, and high-performance computing. With a
                    strong background in full-stack development, embedded
                    systems, and distributed computing, I enjoy tackling complex
                    challenges and building cutting-edge solutions.
                  </p>
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/80 leading-relaxed">
                    My work spans HPC research, artificial intelligence, and
                    robotics. I develop intelligent, high-performance
                    applications using Python, C, and modern frameworks like
                    React and CUDA, pushing the boundaries of innovation in
                    software and hardware integration.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-4 sm:pt-6 justify-center lg:justify-start">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDownloadCV} 
                    className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-white text-black font-medium 
                             hover:bg-white/90 transition-colors duration-200 shadow-lg"
                  >
                    Download CV
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/contact')} 
                    className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg border-2 border-white text-white 
                             hover:bg-white/10 transition-colors duration-200 shadow-lg"
                  >
                    Contact Me
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
