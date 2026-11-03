export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        paper: "#EDF1F4",
        ink: "#12263A",
        teal: { DEFAULT: "#0E7C7B", dark: "#0A5C5B", soft: "#D5ECEB" },
        amber: { DEFAULT: "#C77700", soft: "#FBEBCF" },
      },
    },
  },
  plugins: [],
};
