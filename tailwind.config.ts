import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F2A4A",
          50: "#EAF0F7",
          100: "#CBDAEB",
          600: "#16375E",
          700: "#0F2A4A",
          900: "#081A2E"
        },
        slate: {
          50: "#F5F6F8",
          100: "#E7E9ED",
          400: "#94A0AE",
          600: "#4A5568",
          700: "#333F4F"
        },
        teal: {
          50: "#E7F7F3",
          500: "#12866F",
          600: "#0E6F5C"
        },
        amber: {
          50: "#FFF6E5",
          500: "#C97A0C",
          600: "#A6640A"
        },
        danger: {
          50: "#FDECEC",
          500: "#B4232C",
          600: "#951C24"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
