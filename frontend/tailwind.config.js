/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral grayscale — page background & primary text
        paper: '#F1F5F9', // page background, cool slate near-white
        ink: '#0F172A', // primary text — deep slate-navy

        // Sidebar / header — deep navy, enterprise SaaS feel
        navy: {
          DEFAULT: '#0F172A', // sidebar / header background
          light: '#1E293B', // hover / active surface on navy
          dark: '#020617', // dark-mode sidebar background
        },

        // Education blue — primary brand / action color
        action: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
          soft: '#EFF6FF', // tinted background for badges/active nav
        },

        // Secondary accent (used sparingly for highlights, not status)
        accent: {
          DEFAULT: '#7C3AED',
          dark: '#6D28D9',
        },

        // Status semantics
        paid: {
          DEFAULT: '#059669', // success green
          soft: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#D97706', // warning orange (pending)
          soft: '#FFFBEB',
        },
        overdue: {
          DEFAULT: '#DC2626', // danger red
          soft: '#FEF2F2',
        },
        partial: {
          DEFAULT: '#D97706', // partial payments share the warning hue
          soft: '#FFFBEB',
        },

        // Hairline / border color
        line: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)',
        'card-hover': '0 8px 24px -8px rgba(15,23,42,0.16), 0 2px 6px -2px rgba(15,23,42,0.08)',
        pop: '0 12px 32px -8px rgba(15,23,42,0.22), 0 4px 10px -4px rgba(15,23,42,0.10)',
        'inner-line': 'inset 0 -1px 0 rgba(15,23,42,0.06)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};
