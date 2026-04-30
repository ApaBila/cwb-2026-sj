import { createTheme } from 'flowbite-react'

export const brandFlowbiteTheme = createTheme({
  table: {
    root: {
      base: 'w-full text-left text-[var(--text)]'
    },
    head: {
      base: 'group/head uppercase text-[24px] text-[color:var(--text)]',
    },
    body: {
      base: 'group/body text-[20px]',
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