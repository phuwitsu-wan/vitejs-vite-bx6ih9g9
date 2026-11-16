import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, LocateFixed, X, ChevronUp, SlidersHorizontal, Loader2, AlertTriangle } from 'lucide-react'
import L from 'leaflet'
import { useData } from '../lib/DataContext'
import MapView from '../components/MapView'
import SiteDetail from '../components/SiteDetail'
import CatIcon from '../components/CatIcon'
import { AMPHOES } from '../lib/constants'
import { cn, distanceKm, hasCoords, matchesSearch } from '../lib/utils'

export default function MapPage() {
  const { publicSites, categories, catMap, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cats, setCats] = useState(() => new Set(params.get('cat') ? [params.get('cat')] : []))
  const [amphoe, setAmphoe] = useState(params.get('amphoe') || '')
  const [selectedId, setSelectedId] = useState(params.get('id'))
  const [me, setMe] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [flyBounds, setFlyBounds] = useState(null)

  const filtered = useMemo(() => {
    let r = publicSites.filter((s) => (cats.size === 0 || cats.has(s.category)) && (!amphoe || s.amphoe === amphoe) && matchesSearch(s, q))
    if (me) r = r.map((s) => ({ ...s, _d: hasCoords(s) ? distanceKm(me, s) : Infinity })).sort((a, b) => a._d - b._d)
    return r
  }, [publicSites, cats, amphoe, q, me])

  const counts = useMemo(() => {
    const c = {}; publicSites.forEach((s) => { if ((!amphoe || s.amphoe === amphoe) && matchesSearch(s, q)) c[s.category] = (c[s.category] || 0) + 1 }); return c
  }, [publicSites, amphoe, q])

  const selected = publicSites.find((s) => s.id === selectedId)

  // ซูมไปยังผลลัพธ์เมื่อเปลี่ยนตัวกรอง
  useEffect(() => {
    if (selectedId || me) return
    const pts = filtered.filter(hasCoords)
    if (!pts.length || (cats.size === 0 && !amphoe && !q)) return
    setFlyBounds(L.latLngBounds(pts.map((s) => [s.lat, s.lng])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, amphoe, q])

  useEffect(() => { if (params.get('near')) locate() /* eslint-disable-next-line */ }, [])

  const select = (id) => {
    setSelectedId(id); setSheetOpen(false)
    const p = new URLSearchParams(params); if (id) p.set('id', id); else p.delete('id'); setParams(p, { replace: true })
  }
  const toggleCat = (k) => setCats((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  function locate() {
    if (!navigator.geolocation) return alert('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); setSheetOpen(true) },
      () => { setLocating(false); alert('ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const clearAll = () => { setCats(new Set()); setAmphoe(''); setQ(''); setMe(null) }
  const hasFilter = cats.size || amphoe || q || me

  const Filters = (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ ตำบล พืช…"
          className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-9 text-sm shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-forest-600" />
        {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"><X size={16} /></button>}
      </div>
      <div className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
        {categories.map((c) => {
          const on = cats.has(c.key)
          return (
            <motion.button key={c.key} whileTap={{ scale: 0.94 }} onClick={() => toggleCat(c.key)}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ring-1 transition', on ? 'text-white ring-transparent' : 'bg-white text-slate-700 ring-slate-200')}
              style={on ? { background: c.color } : undefined}>
              <span className={cn('grid h-5 w-5 place-items-center rounded-full', on ? 'bg-white/25' : 'text-white')} style={on ? undefined : { background: c.color }}><CatIcon name={c.icon} size={12} /></span>
              {c.short_name || c.name}<span className={cn('rounded-full px-1.5', on ? 'bg-white/25' : 'bg-slate-100')}>{counts[c.key] || 0}</span>
            </motion.button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <select value={amphoe} onChange={(e) => setAmphoe(e.target.value)} className="flex-1 rounded-xl border-0 bg-white py-2 pl-3 text-sm shadow-sm ring-1 ring-slate-200">
          <option value="">ทุกอำเภอ</option>
          {AMPHOES.map((a) => <option key={a} value={a}>อ.{a}</option>)}
        </select>
        <button onClick={locate} className={cn('flex items-center gap-1.5 rounded-xl px-3 text-sm font-medium shadow-sm ring-1', me ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-blue-700 ring-slate-200')}>
          {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />} ใกล้ฉัน
        </button>
      </div>
      {hasFilter ? <button onClick={clearAll} className="text-xs font-medium text-forest-700 underline">ล้างตัวกรองทั้งหมด</button> : null}
    </div>
  )

  const List = (
    <ul className="divide-y divide-slate-100">
      {filtered.slice(0, 300).map((s, i) => {
        const c = catMap[s.category] || {}
        return (
          <motion.li key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
            <button onClick={() => select(s.id)} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50', s.id === selectedId && 'bg-leaf-300/30')}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: c.color }}><CatIcon name={c.icon} size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-medium text-slate-800">{s.name}</span>
                <span className="line-clamp-1 text-xs text-slate-500">{[s.tambon && `ต.${s.tambon}`, s.amphoe && `อ.${s.amphoe}`, s.main_crops].filter(Boolean).join(' · ')}</span>
              </span>
              {/ระบาด/.test(s.status || '') && <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
              {s._d != null && Number.isFinite(s._d) && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{s._d.toFixed(1)} กม.</span>}
            </button>
          </motion.li>
        )
      })}
      {filtered.length === 0 && <li className="p-6 text-center text-sm text-slate-500">ไม่พบข้อมูลตามเงื่อนไข</li>}
    </ul>
  )

  return (
    <div className="flex h-full pb-[58px] md:pb-0">
      {/* แผงด้านซ้าย (เดสก์ท็อป) */}
      <aside className="hidden w-[380px] shrink-0 flex-col border-r border-slate-200 bg-cream md:flex">
        <div className="border-b border-slate-200 p-4">{Filters}</div>
        <div className="px-4 pt-3 text-xs text-slate-500">พบ {filtered.length.toLocaleString('th-TH')} จุด{me && ' · เรียงตามระยะทาง'}</div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{List}</div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <MapView sites={filtered} catMap={catMap} selectedId={selectedId} onSelect={select} me={me}
          districtFilter={amphoe} onDistrictClick={(n) => setAmphoe((p) => (p === n ? '' : n))} flyBounds={flyBounds} />

        {loading && <div className="absolute inset-0 z-[500] grid place-items-center bg-white/50"><Loader2 className="animate-spin text-forest-700" size={32} /></div>}

        {/* ตัวกรองลอยบนแผนที่ (มือถือ) */}
        <div className="absolute inset-x-0 top-0 z-[600] p-3 pr-14 md:hidden">{Filters}</div>

        {/* คำอธิบายสัญลักษณ์ (เดสก์ท็อป) */}
        <div className="absolute bottom-6 left-3 z-[500] hidden rounded-xl bg-white/95 p-3 text-xs shadow-lg ring-1 ring-slate-200 backdrop-blur md:block">
          <div className="mb-1.5 font-semibold text-slate-700">สัญลักษณ์</div>
          {categories.map((c) => (
            <div key={c.key} className="flex items-center gap-2 py-0.5"><span className="pp-dot" style={{ background: c.color }} />{c.name}</div>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-1.5"><AlertTriangle size={13} className="text-amber-500" />พบการระบาด/เฝ้าระวัง (กะพริบ)</div>
        </div>

        {/* รายละเอียด: เดสก์ท็อปเป็นการ์ดลอย มือถือเป็น bottom sheet */}
        <AnimatePresence>
          {selected && (
            <div key="detail" className="absolute inset-x-0 bottom-0 z-[1050] max-h-[78%] md:inset-x-auto md:bottom-auto md:right-14 md:top-3 md:max-h-[calc(100%-24px)] md:w-[380px]">
              <SiteDetail site={selected} onClose={() => select(null)} />
            </div>
          )}
        </AnimatePresence>

        {/* รายการ (มือถือ) */}
        {!selected && (
          <motion.div className="absolute inset-x-0 bottom-0 z-[1040] flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.15)] md:hidden"
            animate={{ height: sheetOpen ? '62%' : 64 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
            <button onClick={() => setSheetOpen((v) => !v)} className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2">
              <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300" />
              <SlidersHorizontal size={16} className="mt-2 text-forest-700" />
              <span className="mt-2 text-sm font-semibold text-slate-800">พบ {filtered.length.toLocaleString('th-TH')} จุด</span>
              {me && <span className="mt-2 text-xs text-blue-700">เรียงจากใกล้สุด</span>}
              <motion.span animate={{ rotate: sheetOpen ? 180 : 0 }} className="ml-auto mt-2 text-slate-500"><ChevronUp size={20} /></motion.span>
            </button>
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{List}</div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
