/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        charcoal: "#1B1F27",
        navy: "#131A2B",
        // Phase 8 UI redesign: retheme the existing "bronze"/"electric-blue"
        // tokens to brighter, more saturated hues rather than renaming them
        // everywhere -- every screen already references these two names for
        // its primary/secondary accent, so brightening the values here
        // recolors the whole app without touching 20+ screen files.
        bronze: "#FFB020",
        silver: "#C9CDD6",
        cream: "#F4EFE6",
        "electric-blue": "#7C5CFC",
        "aurora-pink": "#FF3EA5",
        "aurora-cyan": "#22D3EE",
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      // Rounder corner scale app-wide -- the redesign calls for circles and
      // ellipses over squared-off panels; every `rounded-md`/`rounded-lg`
      // usage across the app (cards, buttons, inputs) picks this up
      // automatically.
      borderRadius: {
        md: "0.75rem",
        lg: "1.25rem",
        xl: "1.75rem",
        "2xl": "2.25rem",
      },
    },
  },
  plugins: [],
};
