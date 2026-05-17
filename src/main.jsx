import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/primitives/Toast.jsx'
import { ConfirmProvider } from './components/primitives/ConfirmModal.jsx'
import { DisplayPlayer } from './views/display/DisplayPlayer.jsx'

const path = window.location.pathname;
const displayMatch = path.match(/^\/display\/([^/?#]+)/);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {displayMatch ? (
      <DisplayPlayer screenToken={displayMatch[1]} />
    ) : (
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    )}
  </StrictMode>,
)
