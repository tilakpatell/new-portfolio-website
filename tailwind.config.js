import typography from "@tailwindcss/typography";
import forms from "@tailwindcss/forms";
import aspectRatio from "@tailwindcss/aspect-ratio";
import containerQueries from "@tailwindcss/container-queries";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "475px", sm: "640px", md: "768px",
      lg: "1024px", xl: "1280px", "2xl": "1536px",
    },
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
    },
    extend: {
      fontFamily: {
        sans:     ["Barlow", "system-ui", "sans-serif"],
        display:  ["Rajdhani", "system-ui", "sans-serif"],
        mono:     ["JetBrains Mono", "monospace"],
        orbitron: ["Orbitron", "monospace"],
        aurebesh: ["Aurebesh", "sans-serif"],
      },
      colors: {
        sw: {
          black:  "#050505",
          void:   "#050505",
          dark:   "#0c0c0c",
          panel:  "#111111",
          gray:   "#1a1a1a",
          mid:    "#242424",
          silver: "#888888",
          light:  "#cccccc",
          white:  "#f5f5f5",
          gold:   "#ffffff",  /* repurposed — now pure white */
          red:    "#ef4444",
          blue:   "#ffffff",  /* repurposed — now pure white */
        },
      },
      boxShadow: {
        panel:        "0 4px 32px rgba(0,0,0,0.9)",
        "glow-white": "0 0 24px rgba(255,255,255,0.08)",
        "glow-subtle":"0 2px 16px rgba(0,0,0,0.6)",
      },
      animation: {
        drift:      "drift 80s linear infinite",
        "pulse-dim":"pulse-dim 3s ease-in-out infinite",
        float:      "float 6s ease-in-out infinite",
      },
      keyframes: {
        drift:      { from: { transform: "translateY(0)" }, to: { transform: "translateY(-50%)" } },
        "pulse-dim":{ "0%,100%": { opacity: "0.2" }, "50%": { opacity: "0.7" } },
        float:      { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
    },
  },
  plugins: [typography, forms({ strategy: "class" }), aspectRatio, containerQueries],
};
