/**
 * 应用入口
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './locales'
import './styles/index.css'

/**
 * 初始化主题（防止闪烁）
 */
const initTheme = () => {
  const stored = localStorage.getItem('aimultibox-theme')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      const theme = state?.theme || 'system'
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark')
      }
    } catch {}
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
}
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
