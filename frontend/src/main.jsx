import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'flowbite-react'
import './index.css'
import { ThemeInit } from '../.flowbite-react/init.jsx'
import App from './App.jsx'
import { brandFlowbiteTheme } from './flowbiteTheme.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeInit />
    <ThemeProvider theme={brandFlowbiteTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
