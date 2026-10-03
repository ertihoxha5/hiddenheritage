export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'heritage-yellow': '#E8B931',
        'heritage-dark': '#1F1B16',
        'heritage-tan': '#E9DCC3',
        'heritage-bg': '#FBF7EF',
      },
      fontFamily: { serif: ['"Playfair Display"', 'Georgia', 'serif'], sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
