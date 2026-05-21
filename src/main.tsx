import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/errorCapture' // Initialize error capture system
import './utils/api' // Register global axios interceptors (incl. JAFAR impersonation header)

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <App />
  // </StrictMode>,
)