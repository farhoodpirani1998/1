/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F6F8', // page background, cool near-white
        ink: '#1A2233', // primary text — near-navy-black
        navy: {
          DEFAULT: '#0F1E3D', // header / sidebar / table-head — deep navy
          light: '#1D3766',
          dark: '#0A1529',
        },
        accent: {
          DEFAULT: '#F5C244', // yellow accent (stat highlights, charts)
          dark: '#C79A1E',
        },
        action: {
          DEFAULT: '#2563EB', // blue action buttons
          dark: '#1D4ED8',
        },
        overdue: '#C0392B', // brick red
        paid: '#1F8A55', // green (paid)
        partial: '#C79A1E', // reuse accent-dark
        line: '#E3E6EC', // hairline rule color
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,30,61,0.06), 0 1px 1px rgba(15,30,61,0.04)',
      },
    },
  },
  plugins: [],
};
