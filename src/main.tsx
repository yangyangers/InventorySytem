import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/ui/Toast'
import './index.css'
import { initTheme } from './store/theme'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ToastProvider><App /></ToastProvider></React.StrictMode>
)
