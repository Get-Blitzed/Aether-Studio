/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Settings > Appearance (light/dark/system): the four surface/text
        // tokens below resolve to CSS variables (defined in index.css for
        // `:root` and overridden under `:root.light`) instead of fixed hex
        // values -- every screen already references these same four names
        // for its background/panel/text colors, so swapping the variables
        // re-themes the whole app without touching 20+ screen files. Accent
        // colors (bronze/electric-blue/aurora-*) stay constant across both
        // themes on purpose -- brand hues, not surface neutrals.
        charcoal: "rgb(var(--c-charcoal) / <alpha-value>)",
        navy: "rgb(var(--c-navy) / <alpha-value>)",
        silver: "rgb(var(--c-silver) / <alpha-value>)",
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        // Was literal `white/NN` everywhere (borders, hover fills) -- also
        // variable-backed so those hairlines/overlays stay visible against
        // a light surface instead of vanishing as white-on-white.
        hairline: "rgb(var(--c-hairline) / <alpha-value>)",
        // Phase 8 UI redesign: retheme the existing "bronze"/"electric-blue"
        // tokens to brighter, more saturated hues rather than renaming them
        // everywhere -- every screen already references these two names for
        // its primary/secondary accent, so brightening the values here
        // recolors the whole app without touching 20+ screen files.
        bronze: "#FFB020",
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
