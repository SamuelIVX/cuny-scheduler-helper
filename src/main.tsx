/**
 * Popup entry — mounts the React `Popup` into the extension's `index.html` root.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Popup from './popup/Popup.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
