import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'

const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'
import { DataProvider } from './lib/DataContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <DataProvider>
        <App />
      </DataProvider>
    </Router>
  </StrictMode>,
)
