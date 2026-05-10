import { createTheme } from 'flowbite-react'

/**
 * Flowbite React theme overrides (see https://flowbite-react.com/)
 */
export const brandFlowbiteTheme = createTheme({
  navbar: {
    link: {
      base: 'block w-full font-sans text-sj-body',
      active: {
        on: 'bg-transparent text-sjblue md:bg-transparent',
        off: 'bg-transparent text-black hover:bg-transparent hover:text-sjblue',
      },
    },
  },
  button: {
    base:
      'relative flex items-center justify-center rounded-xl text-center font-sans font-semibold focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sjblue/60',
    size: {
      md: 'h-auto min-h-0 px-4 py-2 text-sj-control leading-tight',
      xl: 'h-auto min-h-0 px-4 py-2 text-sj-control leading-tight',
    },
  },
  spinner: {
    base: 'inline animate-spin text-gray-200',
    color: {
      default: 'fill-sjblue',
    },
  },
  checkbox: {
    base: 'h-7 w-7 rounded-xl',
  }
})