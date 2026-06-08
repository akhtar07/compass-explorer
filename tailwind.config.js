/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
      colors: {
        iso: '#2ca02c',
        partial: '#ff7f0e',
        immis: '#d62728',
        inter: '#1f77b4',
      },
    },
  },
  plugins: [],
}
