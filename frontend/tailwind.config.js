/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e0f0ff',
          100: '#b3d9ff',
          200: '#80c1ff',
          300: '#4da9ff',
          400: '#1a91ff',
          500: '#0078e6',
          600: '#005eb3',
          700: '#004480',
          800: '#002a4d',
          900: '#00101a',
        },
        dark: {
          50: '#f5f7fa',
          100: '#e4e9f0',
          200: '#c9d3e0',
          300: '#a1b3c7',
          400: '#7a8fa8',
          500: '#5c6f88',
          600: '#4a5a6f',
          700: '#3d495a',
          800: '#2d3748',
          900: '#1a202c',
        }
      }
    },
  },
  plugins: [],
}
