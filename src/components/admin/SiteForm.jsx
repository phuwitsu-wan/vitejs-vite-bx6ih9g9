import { useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Loader2, ImagePlus, Trash2, Plus, Crosshair, FilePlus2, ChevronUp } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { AMPHOES, LEVELS } from '../../lib/constants'
import { saveSite, uploadFile, trashFile } from '../../lib/api'
import { ext, fmtSize, fileColor } from '../SiteDetail'

const MapView = lazy(() => import('../MapView'))

const Field = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}</label>
)
const inp = 'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-forest-600'

export default function SiteForm({ initial, onClose }) {
  const { categories, catMap } = useData()
  const [s, setS] = useState(() => ({ category: categories[0]?.key, is_published: true, extra: {}, ...initial, documents: initial?.documents || [] }))
  const [extraRows, setExtraRows] = useState(() => Object.entries(initial?.extra || {}).map(([k, v]) => [k, String(v ?? '')]))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setS((p) => ({ ...p, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!s.name?.trim()) return setErr('กรุณากรอกชื่อ')
    setSaving(true)
    try {
      const extra = Object.fromEntries(extraRows.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), isFinite(v) && v.trim() !== '' ? Number(v) : v]))
      await saveSite({ ...s, extra })
      removed.forEach((id) => trashFile(id))
      onClose(true)
    } catch (e2) { setErr(e2.message || String(e2)) } finally { setSaving(false) }
  }

  const onImage = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { const r = await uploadFile(f, { image: true }); setS((p) => ({ ...p, image_url: r.image || r.url })) } catch (e2) { setErr('อัปโหลดรูปไม่สำเร็จ: ' + e2.message) } finally { setUploading(false) }
  }

  const [docBusy, setDocBusy] = useState(0)
  const [removed, setRemoved] = useState([])
  const onDocs = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = ''
    for (const f of files) {
      setDocBusy((n) => n + 1)
      try {
        const r = await uploadFile(f)
        setS((p) => ({ ...p, documents: [...(p.documents || []), { id: r.id, name: r.name || f.name, title: f.name.replace(/\.\w+$/, ''), url: r.url, download: r.download, size: r.size || f.size, mime: f.type }] }))
      } catch (e2) { setErr(`อัปโหลด ${f.name} ไม่สำเร็จ: ${e2.message}`) } finally { setDocBusy((n) => n - 1) }
    }
  }
  const setDoc = (i, patch) => setS((p) => ({ ...p, documents: p.documents.map((d, j) => (j === i ? { ...d, ...patch } : d)) }))
  const removeDoc = (i) => setS((p) => { const d = p.documents[i]; if (d?.id) setRemoved((r) => [...r, d.id]); return { ...p, documents: p.documents.filter((_, j) => j !== i) } })
  const moveDoc = (i, dir) => setS((p) => { const a = [...p.documents]; const j = i + dir; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, documents: a } })

  const useMyLocation = () => navigator.geolocation?.getCurrentPosition((p) => setS((x) => ({ ...x, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) })))

  const cat = catMap[s.category]
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => onClose(false)}>
      <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <span className="h-3 w-3 rounded-full" style={{ background: cat?.color }} />
          <h2 className="font-display text-lg font-semibold text-forest-900">{s.id ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}</h2>
          <button type="button" onClick={() => onClose(false)} className="ml-auto rounded-full p-1.5 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="thin-scroll grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ประเภท *">
                <select className={inp} value={s.category} onChange={set('category')}>{categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
              </Field>
              <Field label="ประเภทย่อย / สถานะอื่น"><input className={inp} value={s.subtype || ''} onChange={set('subtype')} placeholder="เช่น ศูนย์หลัก, แปลง ศจช." /></Field>
            </div>
            <Field label="ชื่อ *"><input className={inp} value={s.name || ''} onChange={set('name')} required /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="อำเภอ">
                <select className={inp} value={s.amphoe || ''} onChange={set('amphoe')}><option value="">–</option>{AMPHOES.map((a) => <option key={a}>{a}</option>)}</select>
              </Field>
              <Field label="ตำบล"><input className={inp} value={s.tambon || ''} onChange={set('tambon')} /></Field>
              <Field label="หมู่"><input className={inp} value={s.moo || ''} onChange={set('moo')} /></Field>
            </div>
            <Field label="ที่ตั้ง / ที่อยู่"><input className={inp} value={s.address || ''} onChange={set('address')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ผู้ประสานงาน / ประธาน"><input className={inp} value={s.contact_name || ''} onChange={set('contact_name')} /></Field>
              <Field label="เบอร์โทร"><input className={inp} value={s.phone || ''} onChange={set('phone')} inputMode="tel" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="ระดับ">
                <select className={inp} value={s.level || ''} onChange={set('level')}><option value="">–</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
              </Field>
              <Field label="ปีที่จัดตั้ง (พ.ศ.)"><input className={inp} type="number" value={s.established_year ?? ''} onChange={set('established_year')} /></Field>
              <Field label="สมาชิก (ราย)"><input className={inp} type="number" value={s.members ?? ''} onChange={set('members')} /></Field>
            </div>
            <Field label="พืชหลัก (คั่นด้วย ,)"><input className={inp} value={s.main_crops || ''} onChange={set('main_crops')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วัน-เวลาให้บริการ"><input className={inp} value={s.service_hours || ''} onChange={set('service_hours')} placeholder="ทุกวันพุธ 09.00–12.00 น." /></Field>
              <Field label="สถานะ"><input className={inp} value={s.status || ''} onChange={set('status')} list="status-list" /></Field>
              <datalist id="status-list"><option value="ปกติ" /><option value="พบการระบาด/เฝ้าระวัง" /><option value="กำลังติดตาม" /><option value="พักแปลง" /></datalist>
            </div>
            <Field label="รายละเอียด"><textarea className={inp} rows={3} value={s.description || ''} onChange={set('description')} /></Field>
            <Field label="แหล่งข้อมูล"><input className={inp} value={s.source || ''} onChange={set('source')} /></Field>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">ตำแหน่งบนแผนที่ — แตะแผนที่หรือลากหมุดเพื่อปรับ</span>
                <button type="button" onClick={useMyLocation} className="flex items-center gap-1 text-xs font-medium text-blue-700"><Crosshair size={14} />ตำแหน่งปัจจุบัน</button>
              </div>
              <div className="h-64 overflow-hidden rounded-xl ring-1 ring-slate-300">
                <Suspense fallback={null}>
                  <MapView sites={[]} catMap={catMap} picker={{ lat: s.lat ?? null, lng: s.lng ?? null, category: s.category }}
                    onPick={(ll) => setS((p) => ({ ...p, lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }))} />
                </Suspense>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="ละติจูด"><input className={inp} type="number" step="any" value={s.lat ?? ''} onChange={(e) => setS((p) => ({ ...p, lat: e.target.value === '' ? null : +e.target.value }))} /></Field>
                <Field label="ลองจิจูด"><input className={inp} type="number" step="any" value={s.lng ?? ''} onChange={(e) => setS((p) => ({ ...p, lng: e.target.value === '' ? null : +e.target.value }))} /></Field>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-slate-600">รูปภาพ</span>
              <div className="flex items-center gap-3">
                {s.image_url ? <img src={s.image_url} alt="" className="h-20 w-28 rounded-lg object-cover ring-1 ring-slate-200" /> : <div className="grid h-20 w-28 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">ไม่มีรูป</div>}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300 hover:bg-slate-50">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} อัปโหลด
                  <input type="file" accept="image/*" hidden onChange={onImage} />
                </label>
                {s.image_url && <button type="button" onClick={() => setS((p) => ({ ...p, image_url: null }))} className="text-xs text-red-600">ลบรูป</button>}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">เอกสารให้ดาวน์โหลด ({(s.documents || []).length})</span>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-700">
                  {docBusy ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} {docBusy ? `กำลังอัปโหลด (${docBusy})` : 'อัปโหลดเอกสาร'}
                  <input type="file" multiple hidden onChange={onDocs} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.jpg,.jpeg,.png,.zip" />
                </label>
              </div>
              {(s.documents || []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">ยังไม่มีเอกสาร — รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ (ไม่เกิน 20 MB ต่อไฟล์)</p>
              ) : (
                <ul className="space-y-1.5">
                  {s.documents.map((d, i) => (
                    <li key={d.id || i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-1.5">
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveDoc(i, -1)} className="text-slate-400 hover:text-slate-700" aria-label="เลื่อนขึ้น"><ChevronUp size={12} /></button>
                      </div>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[9px] font-bold uppercase text-white" style={{ background: fileColor(d.name) }}>{ext(d.name)}</span>
                      <input className="min-w-0 flex-1 rounded-md border-0 bg-white px-2 py-1 text-sm ring-1 ring-slate-200" value={d.title || ''} placeholder={d.name} onChange={(e) => setDoc(i, { title: e.target.value })} />
                      <span className="hidden text-[11px] text-slate-400 sm:inline">{d.size ? fmtSize(d.size) : ''}</span>
                      <button type="button" onClick={() => removeDoc(i)} className="px-1 text-slate-400 hover:text-red-600" aria-label="ลบเอกสาร"><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">ข้อมูลเพิ่มเติม (เพิ่มหัวข้อเองได้ จะแสดงในหน้ารายละเอียด)</span>
                <button type="button" onClick={() => setExtraRows((r) => [...r, ['', '']])} className="flex items-center gap-1 text-xs font-medium text-forest-700"><Plus size={14} />เพิ่มหัวข้อ</button>
              </div>
              <div className="space-y-2">
                {extraRows.map(([k, v], i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inp} placeholder="หัวข้อ" value={k} onChange={(e) => setExtraRows((r) => r.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
                    <input className={inp} placeholder="ค่า" value={v} onChange={(e) => setExtraRows((r) => r.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
                    <button type="button" onClick={() => setExtraRows((r) => r.filter((_, j) => j !== i))} className="px-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
              <input type="checkbox" checked={s.is_published !== false} onChange={set('is_published')} className="h-4 w-4 accent-forest-700" />
              แสดงข้อมูลนี้บนเว็บไซต์สาธารณะ
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
          {err && <span className="text-sm text-red-600">{err}</span>}
          <button type="button" onClick={() => onClose(false)} className="ml-auto rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</button>
          <button disabled={saving} className="flex items-center gap-2 rounded-lg bg-forest-800 px-5 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึก
          </button>
        </div>
      </motion.form>
    </div>
  )
}
