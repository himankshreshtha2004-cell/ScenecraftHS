/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#101116", surface: "#191B22", panel: "#232630", raise: "#2B2F3A",
        ink: "#F6F4F0", mute: "#A7AAB7", faint: "#6F7383", line: "#343742",
        amber: { DEFAULT: "#E8AF79", soft: "#E8AF7922", deep: "#C98B52" },
        ai: { DEFAULT: "#A99CF4", soft: "#A99CF41F" },
        ok: { DEFAULT: "#8BC5A2", soft: "#8BC5A21F" },
        warn: { DEFAULT: "#E9C46A", soft: "#E9C46A1F" },
        bad: { DEFAULT: "#EE8A84", soft: "#EE8A841F" },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "Georgia", "serif"],
      },
      boxShadow: { card: "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 30px -18px rgba(0,0,0,.7)", pop: "0 24px 60px -20px rgba(0,0,0,.75)" },
    },
  },
  plugins: [],
};
