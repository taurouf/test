/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#082C49",
        accent:  "#4CBEFA",
        success: "#5FC97E",
      },
      boxShadow: {
        card: "0 10px 30px -10px rgba(8,44,73,.25)",
        soft: "0 8px 24px rgba(8,44,73,.12)"
      },
      borderRadius: {
        "2xl": "1rem",
      },
      backgroundImage: {
        "hero-grad": "linear-gradient(90deg, #082C49 0%, #0B3C65 50%, #4CBEFA 100%)",
      }
    },
  },
  plugins: [],
};
