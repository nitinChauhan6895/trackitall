import type { Config } from "tailwindcss";

// v5 "gym mode" dark theme.
// Token names are stable across the app — this palette IS the theme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lime accent (primary action / success)
        green: {
          DEFAULT: "#A8E830",
          dark: "#8FCC24",
          tint: "#202A11", // dark lime-cast surface (selected states, chips)
        },
        // Hot accent (secondary action / highlights)
        orange: {
          DEFAULT: "#FF6233",
          soft: "#2E1B13", // dark orange-cast chip surface
        },
        // Warm neutral chips (avatar, PR cards)
        beige: {
          DEFAULT: "#2A2519",
          pr: "#2B211C",
        },
        page: "#0C0D0A", // app background
        surface: "#16180F", // cards
        "surface-2": "#1F2216", // elevated / inputs
        ink: "#F1F3EA", // primary text
        "ink-inverse": "#141807", // text on lime
        muted: "#8D9483",
      },
    },
  },
  plugins: [],
};

export default config;
