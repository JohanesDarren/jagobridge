/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff4ff",
          100: "#dbe6fe",
          200: "#bfd3fe",
          500: "#0d26de",
          600: "#091ea2",
          700: "#05126a",
          DEFAULT: "#0d26de",
          foreground: "#FFFFFF",
          hover: "#091ea2",
        },
        surface: "#F8FAFC",
        border: "#E2E8F0",
        foreground: "#0F172A",
        muted: "#64748B",
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        'brand': '0 10px 25px -5px rgba(13, 38, 222, 0.25), 0 8px 10px -6px rgba(13, 38, 222, 0.2)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
      },
    },
  },
  plugins: [],
};
