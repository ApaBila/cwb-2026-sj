import { createTheme } from 'flowbite-react'

/**
 * Overrides Flowbite default Button tokens so `text-sm` / `font-medium` from
 * `size="md"` (default) do not fight `.sj-action-pill` and match `index.css`
 * heading scale (`text-2xl md:text-3xl`).
 */
export const brandFlowbiteTheme = createTheme({
  button: {
    base: 'relative flex items-center justify-center rounded-lg text-center font-sans font-semibold focus:outline-none focus:ring-4',
    size: {
      md: 'h-auto min-h-0 px-6 py-2 text-2xl leading-none md:text-3xl',
      xl: 'h-auto min-h-0 px-6 py-2 text-2xl leading-none md:text-3xl',
    },
  },
  // table: {
  //   root: {
  //     base: 'w-full text-left font-sans',
  //     shadow: 'hidden',
  //   },
  //   head: {
  //     base: 'group/head normal-case font-sans text-lg md:text-xl font-semibold',
  //   },
  //   body: {
  //     base: 'group/body text-lg md:text-xl',
  //   },
  //   row: {
  //     base: 'group/row',
  //     hovered: 'hover:bg-sjblue/[0.05]',
  //   },
  // },
  checkbox: {
    base: 'h-8 w-8 rounded'
  },
  progress: {
    color: {
      black: 'bg-black',
      sjred: 'bg-sjred',
      sjblue: 'bg-sjblue'
    }
  },
})