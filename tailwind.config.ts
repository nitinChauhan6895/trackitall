import type { Config } from "tailwindcss";

// C2 Lagoon dark theme: #111111 background, #F2F2F2 text, #22C55E green,
// #FFC95C gold. Token names are stable across the app — this palette IS the
// theme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Green accent (primary action / success)
        green: {
          DEFAULT: "#22C55E",
          dark: "#16A34A",
          tint: "#132A1C", // dark green-cast surface (selected states, chips)
        },
        // Gold accent (secondary action / highlights, streaks)
        gold: {
          DEFAULT: "#FFC95C",
          soft: "#322B1C", // dark gold-cast chip surface
        },
        // Neutral chips (avatar, PR cards)
        beige: {
          DEFAULT: "#262626",
          pr: "#2C2C2C",
        },
        page: "#111111", // app background
        surface: "#1C1C1C", // cards
        "surface-2": "#262626", // elevated / inputs
        ink: "#F2F2F2", // primary text
        "ink-inverse": "#111111", // text on green / gold
        muted: "#A6A6A6",
        subtle: "#8C8C8C", // tertiary text (weekday labels, chevrons)
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
