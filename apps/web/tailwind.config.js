/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0D1B2A',
        brand: '#1565C0',
        check: '#43A047',
        pending: '#FF9800',
        reject: '#E53935',
        uigray: '#F5F7FA',
      },
    },
  },
  plugins: [],
};
