import { asset } from '../lib/asset'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Map, BarChart3, ShieldCheck } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { isDemo } from '../lib/api'
import { cn } from '../lib/utils'

const NAV = [
  { to: '/', label: 'หน้าแรก', icon: Home, end: true },
  { to: '/map', label: 'แผนที่', icon: Map },
  { to: '/stats', label: 'สถิติ', icon: BarChart3 },
  { to: '/admin', label: 'เจ้าหน้าที่', icon: ShieldCheck },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const { session } = useData()
  const isMap = pathname.startsWith('/map')

  return (
    <div className="flex h-full flex-col">
      {isDemo && (
        <div className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
          โหมดสาธิต — ยังไม่ได้เชื่อม Supabase ข้อมูลที่แก้จะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น
        </div>
      )}
      <header className="sticky top-0 z-[1100] border-b border-forest-900/10 bg-forest-900 text-white shadow-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:h-16 sm:px-5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <motion.img
              src={asset("/pp-logo.webp")} alt="โลโก้อารักขาพืชเพชรบูรณ์"
              className="h-10 w-10 shrink-0 rounded-full ring-2 ring-leaf-400/60 sm:h-11 sm:w-11"
              whileHover={{ rotate: 12, scale: 1.08 }}
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-[15px] font-semibold sm:text-lg">เครือข่ายอารักขาพืช</div>
              <div className="truncate text-[11px] text-leaf-300 sm:text-xs">จังหวัดเพชรบูรณ์</div>
            </div>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('relative rounded-full px-4 py-2 text-sm font-medium transition-colors', isActive ? 'text-forest-950' : 'text-white/85 hover:text-white')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-leaf-400" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                    <span className="relative flex items-center gap-1.5"><n.icon size={16} />{n.to === '/admin' && session?.isAdmin ? 'จัดการข้อมูล' : n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <img src={asset("/doae-logo.webp")} alt="กรมส่งเสริมการเกษตร" className="ml-auto h-8 rounded bg-white/95 px-1.5 py-0.5 md:ml-3 md:h-9" />
        </div>
      </header>

      <main className={cn('relative flex-1', isMap ? 'min-h-0 overflow-hidden' : 'pb-20 md:pb-0')}>{children}</main>

      {/* แถบเมนูล่างสำหรับมือถือ */}
      <nav className={cn('safe-bottom fixed inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white/95 backdrop-blur md:hidden')}>
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-forest-800' : 'text-slate-500')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="mnav" className="absolute top-0 h-1 w-10 rounded-b-full bg-forest-700" />}
                  <motion.span animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }}><n.icon size={21} /></motion.span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
