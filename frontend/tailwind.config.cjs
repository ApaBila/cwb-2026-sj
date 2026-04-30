const plugin = require('flowbite-react/plugin/tailwindcss')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Metropolis', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [plugin],
}
