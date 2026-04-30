import { createTheme } from 'flowbite-react'

export const brandFlowbiteTheme = createTheme({
  table: {
    root: {
      base: 'w-full text-left text-[var(--text)] font-sans'
    },
    head: {
      base: 'group/head normal-case md:text-3xl text-[color:var(--text)] font-semibold',
    },
    body: {
      base: 'group/body text-lg md:text-xl',
    },
    row: {
      base: 'group/row',
      hovered: 'hover:bg-[color:var(--sjblue)]/[0.05]',
    },
  },
  checkbox: {
    base: 'h-8 w-8 rounded'
  },
})