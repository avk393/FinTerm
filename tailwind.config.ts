import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Robinhood-inspired palette
        rh: {
          bg: "#000000",
          surface: "#0a0a0a",
          elevated: "#1c1c1e",
          border: "#1f1f1f",
          green: "#00c805",
          "green-dim": "#00990440",
          red: "#ff5000",
          "red-dim": "#ff500040",
          text: "#ffffff",
          muted: "#9b9b9b",
          gold: "#f5c518",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["56px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
};

export default config;
