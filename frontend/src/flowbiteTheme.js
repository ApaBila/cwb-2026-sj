import { createTheme } from 'flowbite-react'

export const brandFlowbiteTheme = createTheme({
  table: {
    root: {
      base: 'w-full text-left text-sm text-[var(--text)]',
      shadow: '',
      wrapper: 'relative bg-[var(--bg)]',
    },
    head: {
      base: 'group/head text-xs uppercase tracking-[0.14em] text-[color:var(--text)]/60',
      cell: 'px-6 py-4 text-left font-semibold border-b border-[color:var(--sjblue)]/10',
    },
    body: {
      base: 'group/body',
      cell: 'px-6 py-4 align-middle',
    },
    row: {
      base: 'group/row border-b border-[color:var(--sjblue)]/8 last:border-b-0',
      hovered: 'hover:bg-[color:var(--sjblue)]/[0.03]',
      striped: 'odd:bg-[var(--bg)] even:bg-[color:var(--sjblue)]/[0.015]',
    },
  },
  checkbox: {
    base: 'h-4 w-4 appearance-none rounded border border-[color:var(--sjblue)]/25 bg-[var(--bg)] bg-[length:0.55em_0.55em] bg-center bg-no-repeat checked:border-transparent checked:bg-[var(--sjblue)] checked:bg-check-icon focus:outline-none focus:ring-2 focus:ring-[var(--sjblue)] focus:ring-offset-2',
    color: {
      default: 'text-[var(--sjblue)] focus:ring-[var(--sjblue)]',
    },
    indeterminate: 'border-transparent bg-[var(--sjblue)] bg-dash-icon',
  },
})