import { createTheme } from 'flowbite-react'

export const brandFlowbiteTheme = createTheme({
  table: {
    root: {
      base: 'w-full text-left font-sans',
      shadow: 'hidden',
    },
    head: {
      base: 'group/head normal-case font-sans text-lg md:text-xl font-semibold',
    },
    body: {
      base: 'group/body text-lg md:text-xl',
    },
    row: {
      base: 'group/row',
      hovered: 'hover:bg-sjblue/[0.05]',
    },
  },
  checkbox: {
    base: 'h-8 w-8 rounded'
  },
})