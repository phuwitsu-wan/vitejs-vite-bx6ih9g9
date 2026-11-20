import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Printer, Copy, X, Check } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { useGeo, assignArea } from '../lib/geo'
import { asset } from '../lib/asset'
import { AMPHOES } from '../lib/constants'
import { cn, formatPhone } from '../lib/utils'
import CatIcon, { ICON_PATHS } from './CatIcon'

const SECTIONS = [
  { key: 'summary', label: 'สรุปตัวเลข' },
  { key: 'map', label: 'แผนที่ตำแหน่ง' },
  { key: 'areaTable', label: 'ตารางรายพื้นที่' },
  { key: 'level', label: 'มาตรฐานศูนย์' },
  { key: 'crops', label: 'พืชหลัก' },
  { key: 'clinic', label: 'ตารางคลินิกพืช' },
  { key: 'list', label: 'รายชื่อศูนย์/จุดบริการ' },
  { key: 'contact', label: 'ช่องทางติดต่อ' },
]
const thaiDate = (d = new Date()) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const mix = (hex, t) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const m = (c) => Math.round(255 + (c - 255) * t)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

// ---------- แผนที่ SVG + พื้นหลังแผนที่ถนนแบบจาง (Web Mercator ให้ตรงกับภาพแผนที่) ----------
const TILE = 256
const merc = (lng, lat, z) => {
  const n = TILE * 2 ** z, r = (lat * Math.PI) / 180
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n]
}

function SvgMap({ features, labels, points, categories, width = 330 }) {
  const view = useMemo(() => {
    if (!features?.length) return null
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
    const rings = (f) => { const g = f.geometry; return (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat() }
    features.forEach((f) => rings(f).forEach((ring) => ring.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) })))
    // เลือกระดับซูมให้ภาพแผนที่คมชัดพอสำหรับพิมพ์ (ประมาณ 2 เท่าของความกว้างที่แสดง)
    let z = 6
    while (z < 15) { const [x1] = merc(w, 0, z + 1), [x2] = merc(e, 0, z + 1); if (x2 - x1 > width * 2.2) break; z++ }
    const [x0, y0] = merc(w, n, z), [x1, y1] = merc(e, s, z)
    const pad = (x1 - x0) * 0.04
    const vb = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
    const P = ([lng, lat]) => merc(lng, lat, z)
    const shapes = features.map((f) => {
      let d = '', best = null
      rings(f).forEach((ring) => {
        d += ring.map((pt, i) => `${i ? 'L' : 'M'}${P(pt).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z'
        if (!best || ring.length > best.length) best = ring
      })
      const c = best.reduce((a, pt) => { const q = P(pt); return [a[0] + q[0], a[1] + q[1]] }, [0, 0]).map((v) => v / best.length)
      return { code: f.properties.code, name: f.properties.name, d, c }
    })
    const tiles = []
    for (let tx = Math.floor(vb.x / TILE); tx <= Math.floor((vb.x + vb.w) / TILE); tx++)
      for (let ty = Math.floor(vb.y / TILE); ty <= Math.floor((vb.y + vb.h) / TILE); ty++)
        tiles.push({ tx, ty, href: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png` })
    return { shapes, tiles, vb, P, k: vb.w / width, allD: shapes.map((x) => x.d).join('') }
  }, [features, width])
  if (!view) return <div className="grid h-60 place-items-center text-xs text-slate-400">กำลังโหลดแผนที่…</div>
  const { vb, k } = view
  const used = categories.filter((c) => points.some((p) => p.category === c.key))
  const R = 5.4 * k // รัศมีสัญลักษณ์
  return (
    <div>
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full overflow-hidden rounded-md ring-1 ring-slate-200">
        <defs>
          <clipPath id="pp-vb"><rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} /></clipPath>
        </defs>
        <g clipPath="url(#pp-vb)">
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#f3f4f1" />
          {/* แผนที่ถนนแบบจาง */}
          <g opacity="0.55" style={{ filter: 'grayscale(35%)' }}>
            {view.tiles.map((t) => <image key={`${t.tx}-${t.ty}`} href={t.href} x={t.tx * TILE} y={t.ty * TILE} width={TILE + 0.5} height={TILE + 0.5} preserveAspectRatio="none" />)}
          </g>
          {/* พื้นที่นอกเขตรายงานให้จางลงอีก */}
          <path d={`M${vb.x},${vb.y}h${vb.w}v${vb.h}h${-vb.w}Z${view.allD}`} fill="#ffffff" fillOpacity="0.6" fillRule="evenodd" />
          {view.shapes.map((sh) => <path key={sh.code} d={sh.d} fill="none" stroke="#1d6b3c" strokeWidth={0.9 * k} strokeDasharray={`${3 * k} ${2 * k}`} opacity="0.75" />)}
          <path d={view.allD} fill="none" stroke="#14532d" strokeWidth={1.8 * k} />
          {/* สัญลักษณ์ศูนย์ */}
          {points.map((p, i) => {
            const [x, y] = view.P([p.lng, p.lat]), c = categories.find((cc) => cc.key === p.category) || {}
            return (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle r={R} fill={c.color || '#64748b'} stroke="#fff" strokeWidth={1.1 * k} />
                <g transform={`translate(${-R * 0.62},${-R * 0.62}) scale(${(R * 1.24) / 24})`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: ICON_PATHS[c.icon] || ICON_PATHS.MapPin }} />
              </g>
            )
          })}
          {labels && view.shapes.map((sh) => (
            <text key={sh.code} x={sh.c[0]} y={sh.c[1]} textAnchor="middle" fontSize={(view.shapes.length > 20 ? 6 : 8.5) * k} fill="#14532d" fontWeight="700"
              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.6 * k }}>{sh.name}</text>
          ))}
        </g>
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-600">
        {used.map((c) => (
          <span key={c.key} className="flex items-center gap-1">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full text-white" style={{ background: c.color }}><CatIcon name={c.icon} size={8} strokeWidth={2.6} /></span>{c.short_name}
          </span>
        ))}
        <span className="ml-auto text-[8px] text-slate-400">แผนที่ฐาน © ผู้ร่วมพัฒนา OpenStreetMap</span>
      </div>
    </div>
  )
}

export default function OnePageReport({ onClose }) {
  const { publicSites, publicCategories: categories, settings } = useData()
  const [area, setArea] = useState('')
  const [secs, setSecs] = useState(() => new Set(['summary', 'map', 'areaTable', 'level', 'clinic', 'contact']))
  const [cats, setCats] = useState(() => new Set(categories.map((c) => c.key)))
  const [copied, setCopied] = useState(false)
  const amphoeGeo = useGeo('amphoe'), tambonGeo = useGeo('tambon')

  useEffect(() => {
    document.body.classList.add('pp-report-open')
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.classList.remove('pp-report-open'); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  useEffect(() => { setSecs((p) => { const n = new Set(p); area ? n.add('list') : n.delete('list'); return n }) }, [area])

  const selCats = categories.filter((c) => cats.has(c.key))
  const color = selCats.length === 1 ? selCats[0].color : '#1d6b3c'
  const inArea = useMemo(() => publicSites.filter((s) => !area || s.amphoe === area), [publicSites, area])
  const sites = useMemo(() => inArea.filter((s) => cats.has(s.category)), [inArea, cats])

  // พื้นที่ย่อย: ทั้งจังหวัด → อำเภอ, รายอำเภอ → ตำบล
  const sub = useMemo(() => {
    if (!area) return amphoeGeo ? { level: 'amphoe', geo: amphoeGeo, label: 'อำเภอ' } : null
    if (!tambonGeo) return null
    return { level: 'tambon', geo: { ...tambonGeo, features: tambonGeo.features.filter((f) => f.properties.amphoe === area) }, label: 'ตำบล' }
  }, [area, amphoeGeo, tambonGeo])

  const areaRows = useMemo(() => {
    if (!sub) return []
    const m = Object.fromEntries(sub.geo.features.map((f) => [f.properties.code, { code: f.properties.code, name: f.properties.name, total: 0 }]))
    sites.forEach((s) => { const c = assignArea(s, sub.geo, sub.level); if (c != null && m[c]) { m[c][s.category] = (m[c][s.category] || 0) + 1; m[c].total++ } })
    return Object.values(m).sort((a, b) => (sub.level === 'amphoe' ? AMPHOES.indexOf(a.name) - AMPHOES.indexOf(b.name) : b.total - a.total || a.name.localeCompare(b.name, 'th')))
  }, [sub, sites])
  const values = Object.fromEntries(areaRows.map((r) => [r.code, r.total]))
  const covered = areaRows.filter((r) => r.total > 0).length

  const counts = selCats.map((c) => ({ ...c, n: sites.filter((s) => s.category === c.key).length }))
  const levels = ['A+', 'A', 'B', 'C'].map((l) => ({ l, n: sites.filter((s) => s.level === l).length }))
  const crops = useMemo(() => {
    const m = {}
    sites.forEach((s) => (s.main_crops || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { m[x] = (m[x] || 0) + 1 }))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [sites])
  const clinics = inArea.filter((s) => s.category === 'clinic')
  const outbreak = sites.filter((s) => /ระบาด/.test(s.status || ''))
  const title = area ? `อำเภอ${area}` : 'จังหวัดเพชรบูรณ์'
  const subtitle = area ? `จังหวัดเพชรบูรณ์ · ${sub?.geo.features.length || '–'} ตำบล` : `${AMPHOES.length} อำเภอ ${tambonGeo?.features.length || 116} ตำบล`
  const on = (k) => secs.has(k)
  const toggle = (set, k) => set((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const lineText = () => {
    const L = [`📊 สรุปเครือข่ายอารักขาพืช ${title}`, `ข้อมูล ณ ${thaiDate()}`, '', `รวม ${sites.length} จุด`]
    counts.forEach((c) => L.push(`• ${c.name} ${c.n} จุด`))
    const top = [...areaRows].filter((r) => r.total).sort((a, b) => b.total - a.total).slice(0, 3)
    if (top.length) L.push('', `${sub.label}ที่มีเครือข่ายมากที่สุด: ${top.map((r) => `${r.name} (${r.total})`).join(', ')}`)
    if (outbreak.length) L.push(`⚠️ พบการระบาด/เฝ้าระวัง ${outbreak.length} จุด: ${outbreak.map((s) => s.name.replace('ศูนย์จัดการศัตรูพืชชุมชน', 'ศจช.')).join(', ')}`)
    if (clinics.length) { L.push('', '🩺 คลินิกพืช'); clinics.forEach((c) => L.push(`• ${c.name.replace('คลินิกพืช ', '')}: ${c.service_hours || '-'}`)) }
    L.push('', `ดูแผนที่: ${location.origin}/map${area ? `?amphoe=${encodeURIComponent(area)}` : ''}`)
    if (settings.facebook_url) L.push(`ติดต่อ: ${settings.facebook_url}`)
    return L.join('\n')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(lineText()); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  return createPortal(
    <motion.div id="pp-report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex flex-col bg-[#e8ebe5] print:static print:block print:bg-white">
      {/* ---------- ตัวเลือก ---------- */}
      <div className="pp-report-controls shrink-0 bg-white shadow-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="mr-auto text-lg font-semibold text-forest-900 sm:text-xl">รายงานสรุปหน้าเดียว</h2>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"><Printer size={16} />พิมพ์ / บันทึก PDF</button>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-forest-800 ring-1 ring-forest-700 hover:bg-forest-700/5">
            {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ (LINE)'}
          </button>
          <button onClick={onClose} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"><X size={16} />ปิด</button>
        </div>
        <div className="thin-scroll grid max-h-[34vh] gap-4 overflow-y-auto px-4 py-3 md:grid-cols-[minmax(220px,300px)_1fr]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">พื้นที่</span>
              <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-forest-600">
                <option value="">ทั้งจังหวัด</option>
                {AMPHOES.map((a) => <option key={a} value={a}>อำเภอ{a}</option>)}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-xs text-slate-500">ประเภทข้อมูลในรายงาน</span>
              <div className="flex flex-wrap gap-1.5">
                {SECTIONS.map((s) => (
                  <button key={s.key} onClick={() => toggle(setSecs, s.key)}
                    className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', on(s.key) ? 'bg-forest-800 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-300')}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-3 text-xs">
              <span className="text-slate-500">ประเภทเครือข่าย ({selCats.length} ประเภท)</span>
              <button onClick={() => setCats(new Set(categories.map((c) => c.key)))} className="font-medium text-blue-700">ทั้งหมด</button>
              <button onClick={() => setCats(new Set())} className="font-medium text-blue-700">ล้าง</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const n = inArea.filter((s) => s.category === c.key).length
                return (
                  <button key={c.key} onClick={() => toggle(setCats, c.key)}
                    className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition', cats.has(c.key) ? 'text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-300')}
                    style={cats.has(c.key) ? { background: c.color } : undefined}>
                    <CatIcon name={c.icon} size={13} />{c.name}<span className="opacity-75">({n})</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- กระดาษ A4 ---------- */}
      <div className="thin-scroll min-h-0 flex-1 overflow-auto p-3 sm:p-6 print:overflow-visible print:p-0">
        <article className="pp-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[13mm] text-[11px] leading-snug text-slate-800 shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
          <header className="flex items-end justify-between gap-4 border-b-2 border-forest-800 pb-2">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500">สรุปเครือข่ายด้านอารักขาพืช · ข้อมูล ณ วันที่ {thaiDate()}</div>
              <h1 className="font-display text-[26px] font-semibold leading-tight text-forest-800">{title}</h1>
              <div className="text-[12px] text-slate-600">{subtitle}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <img src={asset('/doae-logo.webp')} alt="" className="h-9" />
              <img src={asset('/pp-logo.webp')} alt="" className="h-11" />
            </div>
          </header>

          {selCats.length === 0 ? (
            <p className="mt-10 text-center text-sm text-slate-400">เลือกประเภทเครือข่ายอย่างน้อย 1 ประเภท</p>
          ) : (
            <>
              {on('summary') && (
                <section className="mt-3 grid gap-2" style={{ gridTemplateColumns: `1.2fr repeat(${counts.length}, 1fr)` }}>
                  <div className="rounded-lg bg-forest-800 p-2 text-white">
                    <div className="text-[9px] text-leaf-300">รวมทั้งหมด</div>
                    <div className="font-display text-[26px] font-semibold leading-none">{sites.length}</div>
                    <div className="text-[9px] text-white/75">จุด · ครอบคลุม {covered}/{areaRows.length} {sub?.label}</div>
                  </div>
                  {counts.map((c) => (
                    <div key={c.key} className="rounded-lg p-2" style={{ background: mix(c.color, 0.1) }}>
                      <div className="flex items-center gap-1 text-[9px] font-medium" style={{ color: c.color }}><CatIcon name={c.icon} size={10} />{c.short_name}</div>
                      <div className="font-display text-[22px] font-semibold leading-none" style={{ color: c.color }}>{c.n}</div>
                      <div className="truncate text-[8.5px] text-slate-500">{c.name}</div>
                    </div>
                  ))}
                </section>
              )}

              {(on('map') || on('level') || on('crops')) && (
                <section className={cn('mt-3 grid gap-4', on('map') && (on('level') || on('crops') || on('areaTable')) ? 'grid-cols-[46%_1fr]' : 'grid-cols-1')}>
                  {on('map') && (
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-forest-800">แผนที่ตำแหน่งเครือข่าย{area ? `ในอำเภอ${area}` : 'ในจังหวัด'}</h3>
                      <SvgMap features={sub?.geo.features} labels categories={categories} points={sites.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)).map((s) => ({ lat: s.lat, lng: s.lng, category: s.category }))} />
                    </div>
                  )}
                  <div className="space-y-3">
                    {on('areaTable') && on('map') && <AreaTable rows={areaRows} cats={selCats} label={sub?.label} compact />}
                    {on('level') && levels.some((x) => x.n) && (
                      <div>
                        <h3 className="mb-1 text-[12px] font-semibold text-forest-800">มาตรฐานศูนย์ (ศดปช./ศจช.)</h3>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          {levels.map((x, i) => (
                            <div key={x.l} className="rounded-md py-1" style={{ background: mix('#1d6b3c', 0.85 - i * 0.2), color: i < 2 ? '#fff' : '#072414' }}>
                              <div className="text-[9px]">ระดับ {x.l}</div><div className="font-display text-[16px] font-semibold leading-tight">{x.n}</div>
                            </div>
                          ))}
                        </div>
                        {outbreak.length > 0 && <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[9.5px] text-amber-800">⚠ พบการระบาด/เฝ้าระวัง {outbreak.length} จุด: {outbreak.map((s) => s.name).join(', ')}</p>}
                      </div>
                    )}
                    {on('crops') && crops.length > 0 && (
                      <div>
                        <h3 className="mb-1 text-[12px] font-semibold text-forest-800">พืชหลักในเครือข่าย</h3>
                        {crops.map(([n, v]) => (
                          <div key={n} className="flex items-center gap-2 py-[1px]">
                            <span className="w-28 truncate">{n}</span>
                            <div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded" style={{ width: `${(v / crops[0][1]) * 100}%`, background: color }} /></div>
                            <span className="w-5 text-right font-semibold">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {on('areaTable') && !on('map') && <div className="mt-3"><AreaTable rows={areaRows} cats={selCats} label={sub?.label} /></div>}

              {on('clinic') && clinics.length > 0 && (
                <section className="mt-3 break-inside-avoid">
                  <h3 className="mb-1 text-[12px] font-semibold text-forest-800">ตารางให้บริการคลินิกพืช</h3>
                  <table className="w-full border-collapse text-[10px]">
                    <thead><tr className="bg-forest-800/10 text-left"><th className="border border-slate-200 px-1.5 py-1">จุดบริการ</th><th className="border border-slate-200 px-1.5 py-1">วัน-เวลาให้บริการ</th><th className="border border-slate-200 px-1.5 py-1">โทร</th></tr></thead>
                    <tbody>{clinics.map((c) => <tr key={c.id}><td className="border border-slate-200 px-1.5 py-0.5">{c.name.replace('คลินิกพืช ', '')}</td><td className="border border-slate-200 px-1.5 py-0.5">{c.service_hours}</td><td className="border border-slate-200 px-1.5 py-0.5">{formatPhone(c.phone) || '–'}</td></tr>)}</tbody>
                  </table>
                </section>
              )}

              {on('list') && (
                <section className="mt-3">
                  <h3 className="mb-1 text-[12px] font-semibold text-forest-800">รายชื่อศูนย์ / จุดบริการ ({sites.length})</h3>
                  <table className="w-full border-collapse text-[9.5px]">
                    <thead><tr className="bg-forest-800/10 text-left">{['ประเภท', 'ชื่อ', 'ตำบล', 'ระดับ', 'พืชหลัก', 'โทร'].map((h) => <th key={h} className="border border-slate-200 px-1.5 py-1">{h}</th>)}</tr></thead>
                    <tbody>
                      {[...sites].sort((a, b) => categories.findIndex((c) => c.key === a.category) - categories.findIndex((c) => c.key === b.category) || (a.tambon || '').localeCompare(b.tambon || '', 'th')).map((s) => {
                        const c = categories.find((x) => x.key === s.category) || {}
                        return (
                          <tr key={s.id} className="break-inside-avoid">
                            <td className="border border-slate-200 px-1.5 py-0.5"><span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.color }} /> {c.short_name}</td>
                            <td className="border border-slate-200 px-1.5 py-0.5">{s.name}</td>
                            <td className="border border-slate-200 px-1.5 py-0.5">{s.tambon || '–'}</td>
                            <td className="border border-slate-200 px-1.5 py-0.5 text-center">{s.level || '–'}</td>
                            <td className="border border-slate-200 px-1.5 py-0.5">{s.main_crops || '–'}</td>
                            <td className="whitespace-nowrap border border-slate-200 px-1.5 py-0.5">{formatPhone(s.phone) || '–'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}

          <footer className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-[9.5px] text-slate-500">
            <span>{settings.office_name} · กรมส่งเสริมการเกษตร</span>
            {on('contact') && <span className="text-right">แผนที่ออนไลน์: {location.host}{settings.office_phone ? ` · โทร ${settings.office_phone}` : ''} · Facebook: อารักขาพืช เพชรบูรณ์</span>}
          </footer>
        </article>
      </div>
    </motion.div>,
    document.body,
  )
}

function AreaTable({ rows, cats, label, compact }) {
  const shown = compact ? rows.filter((r) => r.total > 0) : rows
  return (
    <div>
      <h3 className="mb-1 text-[12px] font-semibold text-forest-800">จำนวนราย{label}{compact && rows.length > shown.length ? ` (แสดงเฉพาะ${label}ที่มีเครือข่าย ${shown.length}/${rows.length})` : ''}</h3>
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="bg-forest-800/10">
            <th className="border border-slate-200 px-1 py-0.5 text-left">{label}</th>
            {cats.map((c) => <th key={c.key} className="border border-slate-200 px-1 py-0.5" style={{ color: c.color }}>{c.short_name}</th>)}
            <th className="border border-slate-200 px-1 py-0.5">รวม</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.code}>
              <td className="border border-slate-200 px-1 py-[1px]">{r.name}</td>
              {cats.map((c) => <td key={c.key} className="border border-slate-200 px-1 py-[1px] text-center" style={{ color: r[c.key] ? undefined : '#cbd5e1' }}>{r[c.key] || '–'}</td>)}
              <td className="border border-slate-200 px-1 py-[1px] text-center font-semibold">{r.total}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-200 px-1 py-0.5">รวม</td>
            {cats.map((c) => <td key={c.key} className="border border-slate-200 px-1 py-0.5 text-center">{rows.reduce((a, r) => a + (r[c.key] || 0), 0)}</td>)}
            <td className="border border-slate-200 px-1 py-0.5 text-center">{rows.reduce((a, r) => a + r.total, 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
