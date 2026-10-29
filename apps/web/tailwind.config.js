/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0b10",
        surface: "#14141c",
        line: "#272736",
        brand: { DEFAULT: "#8b5cf6", 600: "#7c3aed", 300: "#c4b5fd" },
      },
    },
  },
  plugins: [],
};
