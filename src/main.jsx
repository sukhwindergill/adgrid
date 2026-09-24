import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/primitives/Toast.jsx'
import { ConfirmProvider } from './components/primitives/ConfirmModal.jsx'
import { captureUtmParams } from './lib/utm.js'
import { initAnalytics } from './lib/analytics.js'

captureUtmParams()
// No-op unless VITE_POSTHOG_KEY is set and the visitor opted in.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
