import { createTheme } from 'flowbite-react'

/**
 * Overrides Flowbite Button tokens to use `text-sj-control` from `index.css`
 * (clamp; shrinks like pill actions) with `sj-action-pill` / navbar unchanged.
 */
export const brandFlowbiteTheme = createTheme({
  button: {
    base: 'relative flex items-center justify-center rounded-lg text-center font-sans font-semibold focus:outline-none focus:ring-4',
    size: {
      md: 'h-auto min-h-0 px-4 py-1.5 text-sj-control leading-tight',
      xl: 'h-auto min-h-0 px-4 py-1.5 text-sj-control leading-tight',
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
    base: 'h-6 w-6 rounded',
  },
  progress: {
    color: {
      black: 'bg-black',
      sjred: 'bg-sjred',
      sjblue: 'bg-sjblue'
    }
  },
})