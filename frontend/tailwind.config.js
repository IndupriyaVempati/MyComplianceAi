/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#00386B',
        secondary: '#2B93D1',
        neutral: '#CFECFB',
        accent: '#FFC20E',
        success: '#059669',
        'text-dark': '#1E293B',
        'text-mid': '#334155',
        'text-light': '#64748B',
        'bg-page': '#F0F4F8',
        'bg-card': '#FFFFFF',
        'status-green': '#16A34A',
        'status-amber': '#D97706',
        'status-red': '#DC2626',
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
