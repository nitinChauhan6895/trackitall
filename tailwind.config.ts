import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#3B6D11",
          dark: "#33600e",
        },
        orange: {
          DEFAULT: "#D85A30",
          soft: "#FAECE7",
        },
        beige: {
          DEFAULT: "#FAEEDA",
          pr: "#FAECE7",
        },
        page: "#F1EEE6",
        ink: "#1F1B16",
        muted: "#8A8275",
      },
    },
  },
  plugins: [],
};

export default config;
