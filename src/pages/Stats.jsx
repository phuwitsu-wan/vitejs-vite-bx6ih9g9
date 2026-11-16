import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts'
import { useData } from '../lib/DataContext'
import { AMPHOES } from '../lib/constants'
import { downloadText, sitesToCsv } from '../lib/utils'
import CatIcon from '../components/CatIcon'

const Card = ({ title, children, className = '', delay = 0 }) => (
  <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }}
    className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 ${className}`}>
    <h2 className="mb-3 text-base font-semibold text-forest-900 sm:text-lg">{title}</h2>
    {children}
  </motion.section>
)

export default function Stats() {
  const { publicSites, categories } = useData()

  const byAmphoe = useMemo(() => AMPHOES.map((a) => {
    const row = { amphoe: a.replace('เมืองเพชรบูรณ์', 'เมืองฯ') , full: a, total: 0 }
    categories.forEach((c) => { row[c.key] = 0 })
    publicSites.forEach((s) => { if (s.amphoe === a && row[s.category] != null) { row[s.category]++; row.total++ } })
    return row
  }), [publicSites, categories])

  const byCat = useMemo(() => categories.map((c) => ({ ...c, value: publicSites.filter((s) => s.category === c.key).length })), [publicSites, categories])

  const byLevel = useMemo(() => {
    const m = {}
    publicSites.filter((s) => s.level).forEach((s) => { const k = `${s.category}|${s.level}`; m[k] = (m[k] || 0) + 1 })
    return m
  }, [publicSites])

  const crops = useMemo(() => {
    const m = {}
    publicSites.forEach((s) => (s.main_crops || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).forEach((x) => { m[x] = (m[x] || 0) + 1 }))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))
  }, [publicSites])

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-forest-900 sm:text-3xl">สถิติเครือข่ายอารักขาพืช</h1>
          <p className="text-sm text-slate-500">ข้อมูลเปลี่ยนตามที่เจ้าหน้าที่ปรับปรุงโดยอัตโนมัติ</p>
        </div>
        <button onClick={() => downloadText(sitesToCsv(publicSites, categories), `เครือข่ายอารักขาพืช-เพชรบูรณ์-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="flex items-center gap-2 rounded-full bg-forest-800 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700">
          <Download size={16} /> ดาวน์โหลด Excel (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-forest-900 p-4 text-white">
          <div className="text-xs text-leaf-300">รวมทั้งหมด</div>
          <div className="font-display text-3xl font-semibold">{publicSites.length}</div>
          <div className="text-xs text-white/70">จุด</div>
        </motion.div>
        {byCat.map((c, i) => (
          <motion.div key={c.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * (i + 1) }} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><span style={{ color: c.color }}><CatIcon name={c.icon} size={14} /></span>{c.short_name}</div>
            <div className="font-display text-3xl font-semibold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-slate-400">จุด</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="จำนวนจุดรายอำเภอ" className="lg:col-span-2">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={byAmphoe} margin={{ left: -20, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="amphoe" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontFamily: 'Anuphan' }} labelFormatter={(l, p) => `อ.${p?.[0]?.payload?.full || l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {categories.map((c, i) => <Bar key={c.key} dataKey={c.key} name={c.short_name} stackId="a" fill={c.color} radius={i === categories.length - 1 ? [4, 4, 0, 0] : 0} animationDuration={900} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="สัดส่วนตามประเภท" delay={0.1}>
          <div className="h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat.filter((c) => c.value)} dataKey="value" nameKey="short_name" innerRadius="55%" outerRadius="85%" paddingAngle={2} animationDuration={900}>
                  {byCat.filter((c) => c.value).map((c) => <Cell key={c.key} fill={c.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontFamily: 'Anuphan' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ตารางสรุปรายอำเภอ">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2">อำเภอ</th>{categories.map((c) => <th key={c.key} className="px-1 py-2 text-center">{c.short_name}</th>)}<th className="py-2 text-center">รวม</th>
              </tr></thead>
              <tbody>
                {byAmphoe.map((r) => (
                  <tr key={r.full} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 pr-2 font-medium">{r.full}</td>
                    {categories.map((c) => <td key={c.key} className="px-1 text-center" style={{ color: r[c.key] ? c.color : '#cbd5e1' }}>{r[c.key] || '–'}</td>)}
                    <td className="text-center font-semibold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="พืชหลักที่พบมากที่สุด 10 อันดับ">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={crops} layout="vertical" margin={{ left: 10, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontFamily: 'Anuphan' }} />
                <Bar dataKey="value" name="จำนวนจุด" fill="#2f7d47" radius={[0, 6, 6, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {Object.keys(byLevel).length > 0 && (
        <Card title="ระดับศูนย์ (A+ / A / B / C)">
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.filter((c) => ['A+', 'A', 'B', 'C'].some((l) => byLevel[`${c.key}|${l}`])).map((c) => (
              <div key={c.key}>
                <div className="mb-1 text-sm font-medium" style={{ color: c.color }}>{c.name}</div>
                <div className="flex h-8 overflow-hidden rounded-lg">
                  {['A+', 'A', 'B', 'C'].map((l, i) => {
                    const n = byLevel[`${c.key}|${l}`] || 0
                    return n ? <div key={l} className="grid place-items-center text-xs font-medium text-white" style={{ flex: n, background: c.color, opacity: 1 - i * 0.2 }}>{l}: {n}</div> : null
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
