import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, animate, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Printer, Download, MapPinned, Layers3, CalendarClock, X, Award } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { asset } from '../lib/asset'
import { useGeo, assignArea, makeBreaks, classOf } from '../lib/geo'
import { downloadText, sitesToCsv, cn, todayThai } from '../lib/utils'
import { AMPHOES } from '../lib/constants'
import CatIcon from '../components/CatIcon'

const LEVELS = [
  { key: 'province', label: 'จังหวัด' },
  { key: 'amphoe', label: 'อำเภอ' },
  { key: 'tambon', label: 'ตำบล' },
]
const ALL = { key: 'all', name: 'ทุกประเภท', short_name: 'ทั้งหมด', color: '#1d6b3c', icon: 'Layers' }
const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์']

function Counter({ to, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 1.3, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [inView, to])
  return <span ref={ref} className={className}>{v.toLocaleString('th-TH')}</span>
}

const thaiDate = () => new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
const mix = (hex, t) => { // ผสมสีกับขาว t=0 ขาว, 1 สีเต็ม
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const m = (c) => Math.round(255 + (c - 255) * t)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

function FitBounds({ geo }) {
  const map = useMap()
  useEffect(() => {
    if (!geo) return
    const b = L.geoJSON(geo).getBounds()
    if (b.isValid()) map.fitBounds(b, { padding: [10, 10] })
    const ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [geo, map])
  return null
}

function Donut({ data, total }) {
  let acc = 0
  const R = 52, C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2ea" strokeWidth="18" />
      {data.filter((d) => d.value).map((d, i) => {
        const len = (d.value / total) * C
        const el = (
          <motion.circle key={d.key} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="18"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}
            initial={{ opacity: 0, strokeDasharray: `0 ${C}` }} whileInView={{ opacity: 1, strokeDasharray: `${len} ${C - len}` }} viewport={{ once: true }}
            transition={{ duration: 0.8, delay: i * 0.12 }} />
        )
        acc += len
        return el
      })}
    </svg>
  )
}

export default function Stats() {
  const { publicSites, publicCategories: categories, catMap, settings } = useData()
  const [level, setLevel] = useState('amphoe')
  const [cat, setCat] = useState('all')
  const [selected, setSelected] = useState(null)
  const geo = useGeo(level)
  const tambonGeo = useGeo('tambon')

  const sites = useMemo(() => (cat === 'all' ? publicSites : publicSites.filter((s) => s.category === cat)), [publicSites, cat])
  const curCat = cat === 'all' ? ALL : catMap[cat] || ALL

  // นับจำนวนต่อพื้นที่
  const byArea = useMemo(() => {
    const m = {}
    if (!geo) return m
    publicSites.forEach((s) => {
      const code = assignArea(s, geo, level)
      if (code == null) return
      m[code] ||= { total: 0 }
      m[code][s.category] = (m[code][s.category] || 0) + 1
      m[code].total++
    })
    return m
  }, [publicSites, geo, level])

  const valueOf = (code) => (cat === 'all' ? byArea[code]?.total : byArea[code]?.[cat]) || 0
  const values = useMemo(() => (geo?.features || []).map((f) => valueOf(f.properties.code)), [geo, byArea, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(0, ...values)
  const breaks = useMemo(() => makeBreaks(values), [values])
  const shades = breaks.map((_, i) => mix(curCat.color, 0.25 + (0.75 * (i + 1)) / breaks.length))

  const ranking = useMemo(() => (geo?.features || [])
    .map((f) => ({ code: f.properties.code, name: f.properties.name, amphoe: f.properties.amphoe, value: valueOf(f.properties.code) }))
    .filter((r) => r.value > 0).sort((a, b) => b.value - a.value), [geo, byArea, cat]) // eslint-disable-line react-hooks/exhaustive-deps

  // ความครอบคลุม
  const coverage = useMemo(() => {
    const amp = new Set(sites.map((s) => s.amphoe).filter(Boolean))
    const tam = new Set()
    if (tambonGeo) sites.forEach((s) => { const c = assignArea(s, tambonGeo, 'tambon'); if (c) tam.add(c) })
    return { amp: amp.size, tam: tam.size, tamTotal: tambonGeo?.features.length || 116 }
  }, [sites, tambonGeo])

  const counts = useMemo(() => categories.map((c) => ({ ...c, value: publicSites.filter((s) => s.category === c.key).length })), [publicSites, categories])
  const levelsDist = useMemo(() => {
    const m = {}; publicSites.forEach((s) => { if (s.level) m[s.level] = (m[s.level] || 0) + 1 }); return m
  }, [publicSites])
  const clinics = publicSites.filter((s) => s.category === 'clinic')
  const outbreak = publicSites.filter((s) => /ระบาด/.test(s.status || '')).length

  const sel = selected && geo?.features.find((f) => f.properties.code === selected)
  const selData = sel ? byArea[selected] || { total: 0 } : null

  const styleFn = (f) => {
    const v = valueOf(f.properties.code), k = classOf(v, breaks)
    const on = f.properties.code === selected
    return { color: on ? '#072414' : '#ffffff', weight: on ? 3 : level === 'tambon' ? 0.6 : 1.4, fillColor: k < 0 ? '#e5e7eb' : shades[k], fillOpacity: 0.88 }
  }
  const onEach = (f, layer) => {
    const v = valueOf(f.properties.code)
    const label = level === 'tambon' ? `ต.${f.properties.name} อ.${f.properties.amphoe}` : level === 'amphoe' ? `อ.${f.properties.name}` : `จ.${f.properties.name}`
    if (level === 'tambon') layer.bindTooltip(`<b>${label}</b><br/>${curCat.short_name}: ${v.toLocaleString('th-TH')} จุด`, { sticky: true, direction: 'top' })
    else layer.bindTooltip(`<div class="pp-area-label"><span>${f.properties.name}</span><b>${v.toLocaleString('th-TH')}</b></div>`, { permanent: true, direction: 'center', className: 'pp-district-label' })
    layer.on({
      click: () => setSelected((p) => (p === f.properties.code ? null : f.properties.code)),
      mouseover: (e) => e.target.setStyle({ weight: 3, color: '#072414' }),
      mouseout: (e) => e.target.setStyle(styleFn(f)),
    })
  }

  return (
    <div className="pb-6 print:pb-0">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden bg-forest-900 text-white print:bg-forest-900">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-leaf-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10">
          <div className="flex flex-wrap items-center gap-4">
            <img src={asset('/pp-logo.webp')} alt="" className="h-16 w-16 animate-float sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wider text-leaf-300">Plant Protection Network · Phetchabun</div>
              <h1 className="text-2xl font-semibold leading-tight sm:text-4xl">ภาพรวมเครือข่ายอารักขาพืช จังหวัดเพชรบูรณ์</h1>
              <div className="mt-1 text-sm text-white/70">ข้อมูล ณ วันที่ {thaiDate()}</div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm ring-1 ring-white/25 hover:bg-white/20"><Printer size={16} />พิมพ์ / PDF</button>
              <button onClick={() => downloadText(sitesToCsv(publicSites, categories), `เครือข่ายอารักขาพืช-${new Date().toISOString().slice(0, 10)}.csv`)} className="hidden items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm ring-1 ring-white/25 hover:bg-white/20 sm:flex"><Download size={16} />CSV</button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 rounded-2xl bg-leaf-400 p-4 text-forest-950 sm:col-span-1">
              <div className="text-xs font-semibold">เครือข่ายทั้งหมด</div>
              <Counter to={publicSites.length} className="font-display text-5xl font-semibold leading-none" />
              <div className="mt-1 text-xs">จุด ใน {coverage.amp} อำเภอ</div>
            </motion.div>
            {counts.map((c, i) => (
              <motion.div key={c.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * (i + 1) }}
                className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: c.color }}><CatIcon name={c.icon} size={13} /></span>{c.short_name}
                </div>
                <Counter to={c.value} className="mt-1 block font-display text-4xl font-semibold leading-none" />
                <div className="mt-1 line-clamp-1 text-[11px] text-white/60">{c.name}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-5 sm:px-5">
        {/* ---------- MAP ---------- */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 print:break-inside-avoid">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2"><Layers3 size={20} className="text-forest-700" /><h2 className="text-lg font-semibold text-forest-900">แผนที่การกระจายตัวของเครือข่าย</h2></div>
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              ระดับรายงาน
              <div className="flex rounded-full bg-slate-100 p-1">
                {LEVELS.map((l) => (
                  <button key={l.key} onClick={() => { setLevel(l.key); setSelected(null) }}
                    className={cn('relative rounded-full px-3.5 py-1.5 text-sm font-medium transition', level === l.key ? 'text-white' : 'text-slate-600')}>
                    {level === l.key && <motion.span layoutId="lvl" className="absolute inset-0 rounded-full bg-forest-800" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span className="relative">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="thin-scroll flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
            {[ALL, ...categories].map((c) => (
              <button key={c.key} onClick={() => setCat(c.key)}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition', cat === c.key ? 'text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
                style={cat === c.key ? { background: c.color } : undefined}>
                <CatIcon name={c.icon} size={13} />{c.short_name}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_340px]">
            <div className="relative h-[420px] sm:h-[520px]">
              <MapContainer center={[16.25, 101.1]} zoom={8} zoomSnap={0.25} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#f1f5ee' }}>
                <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" opacity={0.6} />
                {geo && <GeoJSON key={`${level}-${cat}-${selected}-${max}`} data={geo} style={styleFn} onEachFeature={onEach} />}
                <FitBounds geo={geo} />
              </MapContainer>
              {!geo && <div className="absolute inset-0 grid place-items-center bg-white/60 text-sm text-slate-500">กำลังโหลดขอบเขต…</div>}
              {/* legend */}
              <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 p-3 text-xs shadow-lg ring-1 ring-slate-200">
                <div className="mb-1.5 font-semibold text-slate-700">{curCat.short_name} (จุด)</div>
                <div className="flex items-center gap-1.5 py-0.5"><span className="h-3.5 w-6 rounded bg-gray-200" />ไม่มี</div>
                {breaks.map((b, i) => (
                  <div key={b} className="flex items-center gap-1.5 py-0.5">
                    <span className="h-3.5 w-6 rounded" style={{ background: shades[i] }} />
                    {i === breaks.length - 1 ? `${b}${b < max ? `–${max}` : ''}` : breaks[i + 1] - 1 > b ? `${b}–${breaks[i + 1] - 1}` : b}
                  </div>
                ))}
              </div>
            </div>

            {/* side panel */}
            <div className="border-t border-slate-100 p-4 lg:border-l lg:border-t-0">
              <AnimatePresence mode="wait">
                {sel ? (
                  <motion.div key={selected} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-500">{level === 'tambon' ? `อำเภอ${sel.properties.amphoe}` : level === 'amphoe' ? 'อำเภอ' : 'จังหวัด'}</div>
                        <h3 className="font-display text-2xl font-semibold text-forest-900">{level === 'tambon' ? 'ต.' : level === 'amphoe' ? 'อ.' : 'จ.'}{sel.properties.name}</h3>
                      </div>
                      <button onClick={() => setSelected(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                    </div>
                    <div className="mt-2 font-display text-5xl font-semibold text-forest-800">{selData.total}<span className="ml-1 text-base font-normal text-slate-500">จุด</span></div>
                    <div className="mt-4 space-y-2.5">
                      {categories.map((c) => {
                        const v = selData[c.key] || 0
                        return (
                          <div key={c.key}>
                            <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.short_name}</span><b>{v}</b></div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                              <motion.div className="h-full rounded-full" style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${selData.total ? (v / selData.total) * 100 : 0}%` }} transition={{ duration: 0.6 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Link to={level === 'amphoe' ? `/map?amphoe=${sel.properties.name}` : '/map'} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-forest-800 py-2.5 text-sm font-semibold text-white print:hidden"><MapPinned size={16} />ดูจุดบนแผนที่</Link>
                  </motion.div>
                ) : (
                  <motion.div key="rank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h3 className="font-semibold text-slate-800">{level === 'province' ? 'สรุประดับจังหวัด' : `${level === 'amphoe' ? 'อำเภอ' : 'ตำบล'}ที่มี${curCat.short_name}มากที่สุด`}</h3>
                    <p className="mb-3 text-xs text-slate-500">แตะพื้นที่บนแผนที่เพื่อดูรายละเอียด</p>
                    <ol className="space-y-2">
                      {ranking.slice(0, 8).map((r, i) => (
                        <motion.li key={r.code} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                          <button onClick={() => setSelected(r.code)} className="w-full text-left">
                            <div className="flex items-center gap-2 text-sm">
                              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold', i < 3 ? 'bg-leaf-400 text-forest-950' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
                              <span className="min-w-0 flex-1 truncate">{level === 'tambon' ? `ต.${r.name} (อ.${r.amphoe})` : level === 'amphoe' ? `อ.${r.name}` : `จ.${r.name}`}</span>
                              <b style={{ color: curCat.color }}>{r.value}</b>
                            </div>
                            <div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <motion.div className="h-full rounded-full" style={{ background: curCat.color }} initial={{ width: 0 }} animate={{ width: `${(r.value / (ranking[0]?.value || 1)) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.04 }} />
                            </div>
                          </button>
                        </motion.li>
                      ))}
                      {ranking.length === 0 && <li className="text-sm text-slate-400">ยังไม่มีข้อมูล</li>}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ---------- INSIGHT CARDS ---------- */}
        <div className="grid gap-5 md:grid-cols-3">
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:break-inside-avoid">
            <h3 className="font-semibold text-forest-900">สัดส่วนตามประเภท</h3>
            <div className="mt-2 flex items-center gap-4">
              <div className="relative shrink-0">
                <Donut data={counts} total={publicSites.length || 1} />
                <div className="absolute inset-0 grid place-items-center text-center"><div><div className="font-display text-3xl font-semibold text-forest-900">{publicSites.length}</div><div className="text-[11px] text-slate-500">จุด</div></div></div>
              </div>
              <ul className="min-w-0 space-y-1.5 text-sm">
                {counts.map((c) => (
                  <li key={c.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate">{c.short_name}</span><b className="ml-auto pl-2">{publicSites.length ? Math.round((c.value / publicSites.length) * 100) : 0}%</b></li>
                ))}
              </ul>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:break-inside-avoid">
            <h3 className="font-semibold text-forest-900">ความครอบคลุมพื้นที่ <span className="text-xs font-normal text-slate-500">({curCat.short_name})</span></h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              {[['อำเภอ', coverage.amp, AMPHOES.length], ['ตำบล', coverage.tam, coverage.tamTotal]].map(([l, v, t]) => {
                const pct = t ? v / t : 0, R = 34, C = 2 * Math.PI * R
                return (
                  <div key={l}>
                    <div className="relative mx-auto h-24 w-24">
                      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                        <circle cx="40" cy="40" r={R} fill="none" stroke="#eef2ea" strokeWidth="8" />
                        <motion.circle cx="40" cy="40" r={R} fill="none" stroke={curCat.color} strokeWidth="8" strokeLinecap="round"
                          initial={{ strokeDasharray: `0 ${C}` }} whileInView={{ strokeDasharray: `${pct * C} ${C}` }} viewport={{ once: true }} transition={{ duration: 1 }} />
                      </svg>
                      <div className="absolute inset-0 grid place-items-center font-display text-xl font-semibold" style={{ color: curCat.color }}>{Math.round(pct * 100)}%</div>
                    </div>
                    <div className="mt-1 text-sm font-medium">{v}/{t} {l}</div>
                  </div>
                )
              })}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.16 }} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:break-inside-avoid">
            <h3 className="flex items-center gap-1.5 font-semibold text-forest-900"><Award size={18} />มาตรฐานศูนย์ (ศดปช. / ศจช.)</h3>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {['A+', 'A', 'B', 'C'].map((l, i) => (
                <motion.div key={l} initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, type: 'spring' }}
                  className="rounded-2xl py-3" style={{ background: mix('#1d6b3c', 0.9 - i * 0.2), color: i < 2 ? '#fff' : '#072414' }}>
                  <div className="text-xs opacity-80">ระดับ</div>
                  <div className="font-display text-xl font-semibold">{l}</div>
                  <div className="font-display text-2xl font-semibold">{levelsDist[l] || 0}</div>
                </motion.div>
              ))}
            </div>
            {outbreak > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">⚠ มี {outbreak} ศูนย์รายงานพบการระบาด/เฝ้าระวัง</p>}
          </motion.section>
        </div>

        {/* ---------- CLINIC WEEK ---------- */}
        {clinics.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-br from-teal-700 to-forest-900 p-5 text-white shadow-lg print:break-inside-avoid sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock size={22} className="text-leaf-300" />ตารางให้บริการคลินิกพืชประจำสัปดาห์</h3>
            <div className="thin-scroll mt-4 grid min-w-0 grid-cols-5 gap-2 overflow-x-auto">
              {DAYS.map((d) => {
                const list = clinics.filter((c) => (c.service_hours || '').includes(d))
                const today = todayThai() === d
                return (
                  <div key={d} className={cn('min-w-[110px] rounded-2xl p-3', today ? 'bg-leaf-400 text-forest-950' : 'bg-white/10 ring-1 ring-white/15')}>
                    <div className="flex items-center justify-between font-semibold">{d}{today && <span className="rounded-full bg-forest-900 px-2 text-[10px] text-white">วันนี้</span>}</div>
                    <div className="font-display text-3xl font-semibold">{list.length}</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] leading-snug opacity-90">
                      {list.map((c) => <li key={c.id} className="truncate">{c.amphoe === 'เมืองเพชรบูรณ์' && /จังหวัด/.test(c.name) ? 'สนง.กษจ.' : c.amphoe}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        <footer className="flex flex-wrap items-center justify-center gap-4 rounded-3xl bg-white p-5 text-center text-xs text-slate-500 ring-1 ring-slate-200">
          <img src={asset('/doae-logo.webp')} alt="กรมส่งเสริมการเกษตร" className="h-10" />
          <img src={asset('/pp-logo.webp')} alt="" className="h-12" />
          <div className="text-left">
            <div className="font-semibold text-slate-700">{settings.office_name}</div>
            <div>กรมส่งเสริมการเกษตร · ข้อมูลอัปเดตอัตโนมัติจากระบบจัดการข้อมูล</div>
          </div>
        </footer>
      </div>
    </div>
  )
}
