import { motion } from 'framer-motion'
import { X, Phone, Navigation, MapPin, Users, Calendar, Sprout, Clock, Award, Share2, AlertTriangle } from 'lucide-react'
import CatIcon from './CatIcon'
import Facebook from './FacebookIcon'
import { directionsUrl, formatPhone, hasCoords, telHref, isOpenToday } from '../lib/utils'
import { useData } from '../lib/DataContext'

const Row = ({ icon: I, label, children }) => children ? (
  <div className="flex gap-3 py-2">
    <I size={18} className="mt-0.5 shrink-0 text-slate-400" />
    <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="text-sm text-slate-800">{children}</div></div>
  </div>
) : null

export default function SiteDetail({ site, onClose }) {
  const { catMap, settings } = useData()
  const cat = catMap[site.category] || {}
  const extras = Object.entries(site.extra || {}).filter(([k, v]) => v != null && v !== '' && !/รหัส/.test(k))
  const share = async () => {
    const url = `${location.origin}/map?id=${site.id}`
    try { if (navigator.share) await navigator.share({ title: site.name, url }); else { await navigator.clipboard.writeText(url); alert('คัดลอกลิงก์แล้ว') } } catch { /* cancelled */ }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex max-h-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-2xl">
      <div className="relative shrink-0 p-4 pb-3 text-white" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}>
        {site.image_url && <img src={site.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30"><CatIcon name={cat.icon} size={22} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white/85">{cat.name}{site.subtype ? ` · ${site.subtype}` : ''}</div>
            <h3 className="font-display text-lg font-semibold leading-snug">{site.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-black/15 p-1.5 hover:bg-black/25" aria-label="ปิด"><X size={18} /></button>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5 text-xs">
          {site.level && <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5"><Award size={12} />ระดับ {site.level}</span>}
          {site.amphoe && <span className="rounded-full bg-white/20 px-2.5 py-0.5">อ.{site.amphoe}</span>}
          {site.status && <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 ${/ระบาด/.test(site.status) ? 'bg-amber-300 text-amber-950' : 'bg-white/20'}`}>{/ระบาด/.test(site.status) && <AlertTriangle size={12} />}{site.status}</span>}
          {site.category === 'clinic' && isOpenToday(site) && <span className="rounded-full bg-leaf-400 px-2.5 py-0.5 font-medium text-forest-950">เปิดบริการวันนี้</span>}
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {site.image_url && <img src={site.image_url} alt={site.name} className="mb-2 mt-2 max-h-52 w-full rounded-xl object-cover" />}
        <div className="divide-y divide-slate-100">
          <Row icon={MapPin} label="ที่ตั้ง">{site.address || [site.moo && `หมู่ ${site.moo}`, site.tambon && `ต.${site.tambon}`, site.amphoe && `อ.${site.amphoe}`].filter(Boolean).join(' ')}</Row>
          <Row icon={Clock} label="วัน-เวลาให้บริการ">{site.service_hours}</Row>
          <Row icon={Sprout} label="พืชหลัก">{site.main_crops}</Row>
          <Row icon={Users} label="ผู้ประสานงาน / สมาชิก">{[site.contact_name, site.members && `สมาชิก ${site.members} ราย`].filter(Boolean).join(' · ')}</Row>
          <Row icon={Calendar} label="ปีที่จัดตั้ง">{site.established_year && `พ.ศ. ${site.established_year}`}</Row>
          <Row icon={Phone} label="โทรศัพท์">{site.phone && formatPhone(site.phone)}</Row>
        </div>
        {site.description && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{site.description}</p>}
        {extras.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {extras.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{String(v)}</dd></div>
            ))}
          </dl>
        )}
        {site.source && <p className="mt-3 text-[11px] text-slate-400">แหล่งข้อมูล: {site.source}</p>}
      </div>

      <div className="safe-bottom grid shrink-0 grid-cols-4 gap-2 border-t border-slate-100 p-3">
        {hasCoords(site) && <a href={directionsUrl(site)} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-forest-800 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"><Navigation size={17} />นำทาง</a>}
        {site.phone ? <a href={telHref(site.phone)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"><Phone size={16} />โทร</a>
          : <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-700 ring-1 ring-blue-200"><Facebook size={16} />ติดต่อ</a>}
        <button onClick={share} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700"><Share2 size={16} />แชร์</button>
      </div>
    </motion.div>
  )
}
