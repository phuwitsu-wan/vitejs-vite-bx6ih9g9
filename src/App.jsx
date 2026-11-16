import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from './components/Layout'
import Home from './pages/Home'
import Spinner from './components/Spinner'

const MapPage = lazy(() => import('./pages/MapPage'))
const Stats = lazy(() => import('./pages/Stats'))
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  const loc = useLocation()
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="h-full"
        >
          <Suspense fallback={<Spinner full />}>
            <Routes location={loc}>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  )
}
