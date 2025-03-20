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
      xs: "475px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
        display: ["Star Jedi", "system-ui", "sans-serif"],
        starwars: ["Star Jedi Hollow", "Star Jedi", "system-ui", "sans-serif"],
      },
      colors: {
        imperial: {
          white: "#FFFFFF",
          black: "#000000",
          space: "#121212",
          gray: "#2A2A2A",
        },
        saber: {
          50: "#E6F6FF",
          100: "#BAE3FF",
          200: "#7CC4FA",
          300: "#47A3F3",
          400: "#2186EB",
          500: "#0967D2",
          600: "#0552B5",
          700: "#03449E",
          800: "#01337D",
          900: "#002159",
        },
        force: {
          50: "#FFE6E6",
          100: "#FFCCCC",
          200: "#FF9999",
          300: "#FF6666",
          400: "#FF3333",
          500: "#DC2626",
          600: "#B91C1C",
          700: "#991B1B",
          800: "#7F1D1D",
          900: "#661919",
        },
      },
      spacing: {
        128: "32rem",
        144: "36rem",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
        "6xl": "3rem",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
        "6xl": ["3.75rem", { lineHeight: "1" }],
        "7xl": ["4.5rem", { lineHeight: "1" }],
        "8xl": ["6rem", { lineHeight: "1" }],
        "9xl": ["8rem", { lineHeight: "1" }],
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        "inner-soft": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
        "blue-saber": "0 0 15px rgba(9, 103, 210, 0.8), 0 0 30px rgba(9, 103, 210, 0.6)",
        "red-saber": "0 0 15px rgba(220, 38, 38, 0.8), 0 0 30px rgba(220, 38, 38, 0.6)",
        hologram: "0 0 15px rgba(255, 255, 255, 0.3)",
        "elevation-1": "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
        "elevation-2": "0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)",
        "elevation-3": "0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)",
        "elevation-4": "0 15px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)",
      },
      animation: {
        'twinkle': 'twinkle var(--duration, 3s) infinite',
        float: "float 6s ease-in-out infinite",
        "gradient-x": "gradient-x 15s ease infinite",
        "gradient-y": "gradient-y 15s ease infinite",
        "gradient-xy": "gradient-xy 15s ease infinite",
        "spin-slow": "spin 20s linear infinite",
        ripple: "ripple 3s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "bounce-slow": "bounce 3s infinite",
        "slide-in-right": "slideInRight 0.5s ease-out",
        "slide-in-left": "slideInLeft 0.5s ease-out",
        "slide-in-up": "slideInUp 0.5s ease-out",
        "slide-in-down": "slideInDown 0.5s ease-out",
        hologram: "hologram 4s ease-in-out infinite",
        hyperspace: "hyperspace 3s linear forwards",
        "hyperspace-stars": "hyperspace-stars 3s linear infinite",
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: 0.2 },
          '50%': { opacity: 1 },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "gradient-y": {
          "0%, 100%": {
            "background-size": "400% 400%",
            "background-position": "center top",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "center center",
          },
        },
        "gradient-x": {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        "gradient-xy": {
          "0%, 100%": {
            "background-size": "400% 400%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        ripple: {
          "0%": { transform: "scale(0.95)", opacity: "0.5" },
          "50%": { transform: "scale(1)", opacity: "0.3" },
          "100%": { transform: "scale(0.95)", opacity: "0.5" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInDown: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        hyperspace: {
          "0%": { transform: "translateZ(0)", opacity: 0 },
          "30%": { opacity: 1 },
          "100%": { transform: "translateZ(1000px)", opacity: 0 },
        },
        "hyperspace-stars": {
          "0%": { transform: "translateZ(0) rotateY(0)" },
          "100%": { transform: "translateZ(1000px) rotateY(360deg)" },
        },
        hologram: {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-spotlight": "radial-gradient(circle at var(--x, 50%) var(--y, 50%), var(--tw-gradient-stops))",
        shimmer: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
        "hyperspace-grid": "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        2000: "2000ms",
        3000: "3000ms",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "65ch",
            color: "inherit",
            a: {
              color: "inherit",
              textDecoration: "none",
              fontWeight: "500",
            },
            strong: {
              fontWeight: "600",
            },
            h1: {
              fontWeight: "800",
            },
            h2: {
              fontWeight: "700",
            },
            h3: {
              fontWeight: "600",
            },
            h4: {
              fontWeight: "600",
            },
            code: {
              color: "inherit",
              fontWeight: "400",
            },
            pre: {
              backgroundColor: "inherit",
              color: "inherit",
            },
          },
        },
      },
    },
  },
  plugins: [
    typography,
    forms({
      strategy: "class",
    }),
    aspectRatio,
    containerQueries,
  ],
};
