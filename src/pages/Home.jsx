import { asset } from '../lib/asset'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, animate } from 'framer-motion'
import { MapPinned, ArrowRight, AlertTriangle, CalendarClock, Phone, Navigation, CalendarDays, BookOpen, ExternalLink, Leaf, Check } from 'lucide-react'
import { useData } from '../lib/DataContext'
import Facebook from '../components/FacebookIcon'
import CatIcon from '../components/CatIcon'
import { isOpenToday, todayThai, directionsUrl, hasCoords } from '../lib/utils'

function Counter({ to }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 1.4, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [inView, to])
  return <span ref={ref}>{v.toLocaleString('th-TH')}</span>
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }
const fileUrl = (u) => (u && u.startsWith('/') ? asset(u) : u)

function ToolCard({ href, icon: I, color, title, desc }) {
  return (
    <motion.a variants={fadeUp} href={href} target="_blank" rel="noreferrer" whileHover={{ y: -4 }}
      className="group flex items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg">
      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${color}`}><I size={28} /></div>
      <div className="min-w-0">
        <div className="font-display text-lg font-semibold text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{desc}</div>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest-700">เปิดใช้งาน <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
      </div>
    </motion.a>
  )
}

export default function Home() {
  const { publicSites, publicCategories: categories, settings } = useData()
  const counts = useMemo(() => {
    const c = {}; publicSites.forEach((s) => { c[s.category] = (c[s.category] || 0) + 1 }); return c
  }, [publicSites])
  const amphoeCount = useMemo(() => new Set(publicSites.map((s) => s.amphoe).filter(Boolean)).size, [publicSites])
  const openToday = useMemo(() => publicSites.filter((s) => s.category === 'clinic' && isOpenToday(s)), [publicSites])
  const clinics = useMemo(() => publicSites.filter((s) => s.category === 'clinic'), [publicSites])

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden bg-forest-900 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-leaf-400/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
            <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#fff" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
          {/* แมลงเต่าทองบินไปมา */}
          <span className="absolute right-[8%] top-[6%] text-2xl opacity-80" style={{ animation: 'flutter 9s ease-in-out infinite' }}>🐞</span>
          <span className="absolute bottom-[14%] left-[6%] text-xl opacity-80" style={{ animation: 'flutter 11s ease-in-out infinite reverse' }}>🦋</span>
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 md:grid-cols-[1.25fr_1fr] md:py-20">
          <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.12 }}>
            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-leaf-300 ring-1 ring-white/15">
              <span className="h-2 w-2 animate-pulse rounded-full bg-leaf-400" /> ข้อมูลอัปเดตโดยเจ้าหน้าที่อารักขาพืช
            </motion.span>
            <motion.h1 variants={fadeUp} className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              แผนที่เครือข่าย<br /><span className="text-leaf-400">อารักขาพืช</span> จังหวัดเพชรบูรณ์
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">{settings.hero_subtitle}</motion.p>
            <motion.div variants={fadeUp} className="mt-7 flex flex-wrap gap-3">
              <Link to="/map" className="group inline-flex items-center gap-2 rounded-full bg-leaf-400 px-6 py-3 font-semibold text-forest-950 shadow-lg shadow-black/20 transition hover:bg-leaf-300">
                <MapPinned size={20} /> เปิดแผนที่ <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </Link>
              <Link to="/map?near=1" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-medium ring-1 ring-white/25 transition hover:bg-white/20">
                <Navigation size={18} /> ค้นหาจุดใกล้ฉัน
              </Link>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.85, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.2 }}
            className="relative mx-auto w-56 sm:w-72 lg:w-80">
            <div className="absolute inset-0 rounded-full bg-leaf-400/30 blur-2xl" />
            <img src={asset("/pp-logo.webp")} alt="Plant Protection Phetchabun" className="relative animate-float drop-shadow-2xl" />
          </motion.div>
        </div>

        <svg viewBox="0 0 1440 60" className="relative block h-8 w-full text-cream sm:h-12" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,40 C240,10 480,60 720,36 C960,12 1200,52 1440,28 L1440,60 L0,60 Z" />
        </svg>
      </section>

      {/* ---------- STATS / CATEGORIES ---------- */}
      <section className="mx-auto -mt-2 max-w-7xl px-4 sm:px-5">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-forest-900">เครือข่ายของเรา</h2>
            <p className="text-sm text-slate-500">ครอบคลุม {amphoeCount} อำเภอ · รวม {publicSites.length.toLocaleString('th-TH')} จุด</p>
          </div>
          <Link to="/stats" className="hidden text-sm font-medium text-forest-700 hover:underline sm:block">ดูสถิติทั้งหมด →</Link>
        </div>
        <motion.div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} transition={{ staggerChildren: 0.08 }}>
          {categories.map((c) => (
            <motion.div key={c.key} variants={fadeUp} whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }}>
              <Link to={`/map?cat=${c.key}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-xl">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 transition group-hover:scale-150" style={{ background: c.color }} />
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-md" style={{ background: c.color }}>
                  <CatIcon name={c.icon} size={22} />
                </div>
                <div className="mt-3 font-display text-3xl font-semibold" style={{ color: c.color }}><Counter to={counts[c.key] || 0} /></div>
                <div className="text-sm font-semibold leading-snug text-slate-800">{c.name}</div>
                <p className="mt-1 line-clamp-3 hidden text-xs text-slate-500 sm:block">{c.description}</p>
                <span className="mt-auto pt-2 text-xs font-medium text-forest-700 opacity-0 transition group-hover:opacity-100">ดูบนแผนที่ →</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------- CLINIC SCHEDULE ---------- */}
      {clinics.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-5">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-forest-800 p-5 text-white shadow-xl sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <CalendarClock size={26} className="text-leaf-300" />
              <h2 className="text-xl font-semibold sm:text-2xl">คลินิกพืช เปิดบริการวัน{todayThai()}นี้</h2>
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-sm">{openToday.length} จุด</span>
            </div>
            {openToday.length === 0 ? (
              <p className="mt-3 text-white/80">วันนี้ไม่มีจุดบริการตามตาราง ดูตารางทั้งหมดด้านล่าง</p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {openToday.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                    <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-leaf-400" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name.replace('คลินิกพืช ', '')}</div>
                      <div className="text-xs text-white/75">{s.service_hours}</div>
                    </div>
                    {hasCoords(s) && <a href={directionsUrl(s)} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="นำทาง"><Navigation size={16} /></a>}
                  </div>
                ))}
              </div>
            )}
            <details className="group mt-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-leaf-300">ดูตารางคลินิกพืชทั้งหมด ({clinics.length} จุด) <span className="inline-block transition group-open:rotate-90">›</span></summary>
              <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {clinics.map((s) => (
                  <div key={s.id} className="flex justify-between gap-3 border-b border-white/10 py-1.5">
                    <span className="truncate">{s.name.replace('คลินิกพืช ', '')}</span><span className="shrink-0 text-white/75">{s.service_hours}</span>
                  </div>
                ))}
              </div>
            </details>
          </motion.div>
        </section>
      )}

      {/* ---------- ONLINE TOOLS ---------- */}
      <section className="mx-auto mt-12 max-w-7xl px-4 pb-12 sm:px-5">
        <h2 className="text-2xl font-semibold text-forest-900">บริการและเครื่องมือออนไลน์</h2>
        <p className="mb-5 text-sm text-slate-500">เครื่องมือช่วยตัดสินใจสำหรับเกษตรกรและเจ้าหน้าที่ส่งเสริมการเกษตร</p>
        <motion.div className="grid gap-4 md:grid-cols-2" initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} transition={{ staggerChildren: 0.1 }}>
          {/* ปฏิทินเพาะปลูก + คู่มือ */}
          <motion.div variants={fadeUp} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#06C755] to-forest-700 p-5 text-white shadow-lg md:row-span-2 sm:p-6">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30"><CalendarDays size={28} /></div>
              <h3 className="mt-4 font-display text-2xl font-semibold">ปฏิทินเพาะปลูกเท่าทันภูมิอากาศ</h3>
              <p className="mt-2 text-white/90">สร้างปฏิทินการผลิตเฉพาะแปลงจากชนิดพืช วันปลูก และพิกัดแปลง บอกระยะการเจริญเติบโต การให้น้ำ แผนปุ๋ย และแจ้งเตือนโรคแมลงตามสภาพอากาศจริง</p>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-white/90">
                {['ระยะพืชจากความร้อนสะสม (GDD)', 'แจ้งเตือนโรค-แมลงล่วงหน้า', 'แผนปุ๋ยและชีวภัณฑ์', 'ปฏิทินหน้าเดียว (A4)'].map((t) => <li key={t} className="flex items-start gap-1.5"><Check size={16} className="mt-0.5 shrink-0" />{t}</li>)}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={settings.calendar_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-forest-900 shadow hover:bg-leaf-300">
                  <ExternalLink size={17} /> เปิดใช้งานปฏิทิน
                </a>
                <a href={fileUrl(settings.calendar_manual_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-medium ring-1 ring-white/40 hover:bg-white/25">
                  <BookOpen size={17} /> คู่มือการใช้งาน (PDF)
                </a>
              </div>
            </div>
          </motion.div>

          <ToolCard href={settings.ghg_url} icon={Leaf} color="bg-sky-100 text-sky-700" title="บันทึกการปล่อยก๊าซเรือนกระจกภาคการเกษตร"
            desc="คำนวณการปล่อยก๊าซเรือนกระจกรายแปลง ตามแนวทาง MRV, IPCC และ T-VER สำหรับเจ้าหน้าที่ส่งเสริมการเกษตร" />
          <ToolCard href={settings.risk_map_url} icon={AlertTriangle} color="bg-orange-100 text-orange-600" title="แผนที่เฝ้าระวังโรคและแมลงระบาด"
            desc="พยากรณ์ความเสี่ยงการระบาดรายตำบลจากข้อมูลพยากรณ์อากาศ 7 วัน" />
        </motion.div>

        <motion.a href={settings.facebook_url} target="_blank" rel="noreferrer" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: 1.01 }}
          className="mt-4 flex items-center gap-4 rounded-2xl bg-[#1877f2] p-5 text-white shadow-sm transition hover:shadow-lg">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Facebook size={26} /></div>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">ติดต่อ / สอบถาม ผ่าน Facebook</div>
            <div className="truncate text-sm text-white/85">{settings.office_name}</div>
          </div>
          <ArrowRight className="ml-auto shrink-0 text-white/70" />
        </motion.a>
        {settings.office_phone && (
          <a href={`tel:${settings.office_phone}`} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-forest-800 ring-1 ring-slate-200">
            <Phone size={20} /> โทร {settings.office_phone}
          </a>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mb-2 flex items-center justify-center gap-3">
          <img src={asset("/doae-logo.webp")} alt="กรมส่งเสริมการเกษตร" className="h-8" />
          <img src={asset("/pp-logo.webp")} alt="อารักขาพืชเพชรบูรณ์" className="h-9" />
        </div>
        {settings.office_name} · กรมส่งเสริมการเกษตร
        <div className="mt-1">แหล่งข้อมูล: ทำเนียบ ศดปช. ปี 2567 · ระบบสารสนเทศอารักขาพืชและจัดการดินปุ๋ย · ขอบเขตอำเภอ OpenGISData-Thailand (CC BY 4.0)</div>
      </footer>
    </div>
  )
}
