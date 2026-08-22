/** @type {import('tailwindcss').Config} */
export default {
  content: ["./web/index.html", "./web/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        page: "#fafafa",
        "card-light": "#ffffff",
        subtle: "#e5e5e8",
        primary: "#16161a",
        muted: "#6b6b76",
        "panel-dark": "#0a0a0c",
        "panel-inner": "#1c1c22",
        "terminal-black": "#050506",
        "on-dark": "#f5f5f7",
        "muted-on-dark": "#9a9aa5",
        "accent-blue": "#6ea8ff",
        "accent-green": "#5fd98a",
        "accent-red": "#d9736b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel:
          "0 24px 80px -24px rgba(16, 16, 20, 0.45), 0 8px 24px -12px rgba(16, 16, 20, 0.28)",
      },
    },
  },
  plugins: [],
};
