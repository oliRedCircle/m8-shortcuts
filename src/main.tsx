import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/style/style.ts'
import './app/style/scrollbars.css'
import { HashRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { DebugMenu, DebugPortalContextProvider } from './components/DebugMenu.tsx'
import { SdkProvider } from './contexts/SdkContext.tsx'

const element = document.getElementById('root')
if (!element) {
  throw new Error('Application error.')
}

createRoot(element).render(
  <StrictMode>
    <SdkProvider>
      <DebugPortalContextProvider>
        <HashRouter>
          <App />
          <DebugMenu />
        </HashRouter>
      </DebugPortalContextProvider>
    </SdkProvider>
  </StrictMode>,
)
