/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        charcoal: "#1B1F27",
        navy: "#131A2B",
        bronze: "#B08D57",
        silver: "#C9CDD6",
        cream: "#F4EFE6",
        "electric-blue": "#3E8EF7",
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
