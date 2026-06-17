import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#3B6D11",
          dark: "#33600e",
          tint: "#EAF3DE",
        },
        orange: {
          DEFAULT: "#FF571F",
          soft: "#FDEADF",
        },
        beige: {
          DEFAULT: "#FAEEDA",
          pr: "#FAECE7",
        },
        page: "#F5F5F5",
        ink: "#1F1B16",
        muted: "#8A8275",
      },
    },
  },
  plugins: [],
};

export default config;
