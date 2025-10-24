/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        // Add your custom colors here
        primary: {
          light: '#4f46e5',
          dark: '#818cf8',
        },
        background: {
          light: '#f9fafb',
          dark: '#111827',
        },
        card: {
          light: '#ffffff',
          dark: '#1f2937',
        },
        text: {
          primary: {
            light: '#111827',
            dark: '#f9fafb',
          },
          secondary: {
            light: '#6b7280',
            dark: '#9ca3af',
          },
        },
      },
    },
  },
}