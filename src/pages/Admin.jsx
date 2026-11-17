import { asset } from '../lib/asset'
import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, LogOut, Plus, Search, Pencil, Trash2, Eye, EyeOff, Loader2, Upload, Download, Database, Palette, Settings, MapPinOff, RotateCcw, FileText } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { signIn, signOut, deleteSites, setPublished, bulkInsert, saveCategory, deleteCategory, saveSettings, isDemo, resetDemo } from '../lib/api'
import { AMPHOES, ICON_CHOICES } from '../lib/constants'
import { cn, csvToSites, downloadText, hasCoords, matchesSearch, sitesToCsv } from '../lib/utils'
import CatIcon from '../components/CatIcon'
import SiteForm from '../components/admin/SiteForm'

const inpAuto = 'rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-forest-600'
const inp = 'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-forest-600'

function Login() {
  const { reload } = useData()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const s = await signIn(email, pw)
      if (!s?.isAdmin) { await signOut(); throw new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์แอดมิน') }
      await reload()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <img src={asset("/pp-logo.webp")} alt="" className="mx-auto h-20 w-20 animate-float" />
        <h1 className="mt-3 text-center text-xl font-semibold text-forest-900">เข้าสู่ระบบเจ้าหน้าที่</h1>
        <p className="mb-5 text-center text-sm text-slate-500">สำหรับเจ้าหน้าที่อารักขาพืชเพื่อจัดการข้อมูล</p>
        {isDemo && <p className="mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">โหมดสาธิต: ใช้อีเมลใดก็ได้ รหัสผ่าน <b>demo1234</b></p>}
        <label className="mb-3 block"><span className="mb-1 block text-xs text-slate-600">อีเมล</span><input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label className="mb-4 block"><span className="mb-1 block text-xs text-slate-600">รหัสผ่าน</span><input className={inp} type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" /></label>
        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 py-2.5 font-semibold text-white hover:bg-forest-700 disabled:opacity-60">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} เข้าสู่ระบบ
        </button>
      </motion.form>
    </div>
  )
}

function SitesTab() {
  const { sites, categories, catMap } = useData()
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [amp, setAmp] = useState(''); const [onlyIssues, setOnlyIssues] = useState(false)
  const [editing, setEditing] = useState(null)
  const [sel, setSel] = useState(new Set())
  const [page, setPage] = useState(0)
  const PER = 50

  const rows = useMemo(() => sites.filter((s) => (!cat || s.category === cat) && (!amp || s.amphoe === amp) && matchesSearch(s, q) && (!onlyIssues || !hasCoords(s) || s.is_published === false)), [sites, cat, amp, q, onlyIssues])
  const pageRows = rows.slice(page * PER, page * PER + PER)
  const noCoords = sites.filter((s) => !hasCoords(s)).length
  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const ids = [...sel]

  const del = async (list) => {
    if (!confirm(`ลบ ${list.length} รายการ? การลบนี้ย้อนกลับไม่ได้`)) return
    await deleteSites(list); setSel(new Set())
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={cn(inp, 'pl-9')} placeholder="ค้นหา…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        </div>
        <select className={inpAuto} value={cat} onChange={(e) => { setCat(e.target.value); setPage(0) }}><option value="">ทุกประเภท</option>{categories.map((c) => <option key={c.key} value={c.key}>{c.short_name}</option>)}</select>
        <select className={inpAuto} value={amp} onChange={(e) => { setAmp(e.target.value); setPage(0) }}><option value="">ทุกอำเภอ</option>{AMPHOES.map((a) => <option key={a}>{a}</option>)}</select>
        <button onClick={() => setEditing({})} className="flex items-center gap-1.5 rounded-lg bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"><Plus size={16} />เพิ่มข้อมูล</button>
      </div>

      {noCoords > 0 && (
        <button onClick={() => setOnlyIssues((v) => !v)} className={cn('mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs', onlyIssues ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 text-amber-800')}>
          <MapPinOff size={14} /> มี {noCoords} รายการที่ยังไม่มีพิกัด (ไม่แสดงบนแผนที่) — {onlyIssues ? 'แสดงทั้งหมด' : 'กดเพื่อดู'}
        </button>
      )}

      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-forest-900 px-3 py-2 text-sm text-white">
            เลือก {sel.size} รายการ
            <button onClick={() => setPublished(ids, true).then(() => setSel(new Set()))} className="ml-auto flex items-center gap-1 rounded bg-white/15 px-2 py-1"><Eye size={14} />แสดง</button>
            <button onClick={() => setPublished(ids, false).then(() => setSel(new Set()))} className="flex items-center gap-1 rounded bg-white/15 px-2 py-1"><EyeOff size={14} />ซ่อน</button>
            <button onClick={() => del(ids)} className="flex items-center gap-1 rounded bg-red-500 px-2 py-1"><Trash2 size={14} />ลบ</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="w-10 p-2"><input type="checkbox" className="accent-forest-700" checked={pageRows.length > 0 && pageRows.every((r) => sel.has(r.id))}
                  onChange={(e) => setSel((p) => { const n = new Set(p); pageRows.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); return n })} /></th>
                <th className="p-2">ชื่อ</th><th className="p-2">ประเภท</th><th className="p-2">อำเภอ</th><th className="p-2">พิกัด</th><th className="p-2">เอกสาร</th><th className="p-2">แสดงบนเว็บ</th><th className="w-24 p-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const c = catMap[s.category] || {}
                return (
                  <tr key={s.id} className={cn('border-t border-slate-100 hover:bg-slate-50', s.is_published === false && 'opacity-55')}>
                    <td className="p-2"><input type="checkbox" className="accent-forest-700" checked={sel.has(s.id)} onChange={() => toggle(s.id)} /></td>
                    <td className="max-w-[280px] p-2"><button onClick={() => setEditing(s)} className="line-clamp-2 text-left font-medium text-slate-800 hover:text-forest-700">{s.name}</button></td>
                    <td className="p-2"><span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-white" style={{ background: c.color }}><CatIcon name={c.icon} size={11} />{c.short_name}</span></td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{s.amphoe}</td>
                    <td className="p-2">{hasCoords(s) ? <span className="text-xs text-emerald-700">✓</span> : <span className="text-xs text-amber-600">ไม่มี</span>}</td>
                    <td className="p-2 text-xs text-slate-500">{s.documents?.length ? <span className="inline-flex items-center gap-1"><FileText size={13} />{s.documents.length}</span> : '–'}</td>
                    <td className="p-2">
                      <EyeToggle on={s.is_published !== false} onChange={(v) => setPublished([s.id], v)} />
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => setEditing(s)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-forest-700" aria-label="แก้ไข"><Pencil size={16} /></button>
                      <button onClick={() => del([s.id])} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="ลบ"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          ทั้งหมด {rows.length} รายการ
          <div className="ml-auto flex items-center gap-1">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">‹ ก่อนหน้า</button>
            <span>{page + 1}/{Math.max(1, Math.ceil(rows.length / PER))}</span>
            <button disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">ถัดไป ›</button>
          </div>
        </div>
      </div>

      <AnimatePresence>{editing && <SiteForm key={editing.id || 'new'} initial={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  )
}

function CategoriesTab() {
  const { categories, sites } = useData()
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const save = async () => {
    if (!draft.key || !draft.name) return setMsg('กรุณากรอกรหัสและชื่อ')
    await saveCategory({ ...draft, sort_order: Number(draft.sort_order) || 0 }); setDraft(null); setMsg('บันทึกแล้ว')
  }
  const remove = async (c) => {
    const n = sites.filter((s) => s.category === c.key).length
    if (n) return alert(`ยังมีข้อมูล ${n} รายการในประเภทนี้ ย้ายหรือลบข้อมูลก่อน`)
    if (confirm(`ลบประเภท "${c.name}"?`)) await deleteCategory(c.key)
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">แก้ชื่อ สี และไอคอนของแต่ละประเภทได้ทันที แผนที่และสถิติจะเปลี่ยนตามโดยไม่ต้องแก้โค้ด หรือเพิ่มประเภทใหม่ได้</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <motion.div layout key={c.key} className={cn('flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 transition', c.is_visible === false && 'opacity-60')}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: c.color }}><CatIcon name={c.icon} size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500">{c.short_name} · รหัส {c.key} · {sites.filter((s) => s.category === c.key).length} รายการ</div>
              <div className={cn('mt-1 text-xs font-medium', c.is_visible === false ? 'text-slate-500' : 'text-emerald-700')}>{c.is_visible === false ? 'ซ่อนทั้งประเภทจากหน้าเว็บ' : 'แสดงบนหน้าเว็บ'}</div>
            </div>
            <EyeToggle on={c.is_visible !== false} onChange={(v) => saveCategory({ ...c, is_visible: v })} />
            <button onClick={() => setDraft({ ...c })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button>
            <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
          </motion.div>
        ))}
        <button onClick={() => setDraft({ key: '', name: '', short_name: '', color: '#16a34a', icon: 'MapPin', sort_order: categories.length + 1, description: '', _new: true })}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 hover:border-forest-600 hover:text-forest-700"><Plus size={18} />เพิ่มประเภทใหม่</button>
      </div>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <AnimatePresence>
        {draft && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 rounded-xl bg-white p-4 ring-2 ring-forest-600">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block"><span className="text-xs text-slate-600">รหัส (ภาษาอังกฤษ)</span><input className={inp} value={draft.key} disabled={!draft._new} onChange={(e) => setDraft({ ...draft, key: e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase() })} /></label>
              <label className="block sm:col-span-2"><span className="text-xs text-slate-600">ชื่อเต็ม</span><input className={inp} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label className="block"><span className="text-xs text-slate-600">ชื่อย่อ</span><input className={inp} value={draft.short_name || ''} onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} /></label>
            </div>
            <label className="block"><span className="text-xs text-slate-600">คำอธิบาย</span><input className={inp} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="flex flex-wrap items-end gap-4">
              <label className="block"><span className="block text-xs text-slate-600">สี</span><input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-16 cursor-pointer rounded" /></label>
              <label className="block w-24"><span className="text-xs text-slate-600">ลำดับ</span><input className={inp} type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} /></label>
              <div>
                <span className="block text-xs text-slate-600">ไอคอน</span>
                <div className="flex flex-wrap gap-1">
                  {ICON_CHOICES.map((i) => (
                    <button type="button" key={i} onClick={() => setDraft({ ...draft, icon: i })} className={cn('grid h-9 w-9 place-items-center rounded-lg ring-1', draft.icon === i ? 'text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200')} style={draft.icon === i ? { background: draft.color } : undefined}><CatIcon name={i} size={17} /></button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</button>
              <button onClick={save} className="rounded-lg bg-forest-800 px-5 py-2 text-sm font-semibold text-white">บันทึก</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SettingsTab() {
  const { settings } = useData()
  const [d, setD] = useState(settings)
  const [ok, setOk] = useState(false)
  const F = [['hero_subtitle', 'ข้อความแนะนำหน้าแรก', true], ['office_name', 'ชื่อหน่วยงาน'], ['office_phone', 'เบอร์โทรหน่วยงาน'], ['facebook_url', 'ลิงก์ Facebook'], ['risk_map_url', 'ลิงก์แผนที่เฝ้าระวังโรคและแมลง'], ['calendar_url', 'ลิงก์ปฏิทินเพาะปลูกเท่าทันภูมิอากาศ'], ['calendar_manual_url', 'ลิงก์คู่มือปฏิทินเพาะปลูก (PDF)'], ['ghg_url', 'ลิงก์เว็บบันทึกการปล่อยก๊าซเรือนกระจก']]
  return (
    <div className="max-w-2xl space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      {F.map(([k, l, area]) => (
        <label key={k} className="block"><span className="mb-1 block text-xs text-slate-600">{l}</span>
          {area ? <textarea rows={3} className={inp} value={d[k] || ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} /> : <input className={inp} value={d[k] || ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} />}
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={async () => { await saveSettings(Object.fromEntries(F.map(([k]) => [k, d[k] ?? '']))); setOk(true); setTimeout(() => setOk(false), 2000) }} className="rounded-lg bg-forest-800 px-5 py-2 text-sm font-semibold text-white">บันทึก</button>
        {ok && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
      </div>
    </div>
  )
}

function ImportTab() {
  const { sites, categories } = useData()
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const rows = csvToSites(await f.text(), categories)
    setPreview(rows); setMsg(rows.length ? '' : 'ไม่พบข้อมูลที่ใช้ได้ (ต้องมีคอลัมน์ "ประเภท" และ "ชื่อ")')
    e.target.value = ''
  }
  const template = () => downloadText(sitesToCsv([{ category: 'ffs', name: 'โรงเรียนเกษตรกร(ตัวอย่าง)', amphoe: 'หล่มสัก', tambon: 'ปากช่อง', lat: 16.7, lng: 101.28, main_crops: 'ข้าว', is_published: true, extra: {} }], categories), 'แม่แบบนำเข้าข้อมูล.csv')
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="flex items-center gap-2 font-semibold"><Upload size={18} />นำเข้าจาก Excel (CSV)</h3>
        <p className="text-sm text-slate-600">บันทึกไฟล์ Excel เป็น <b>CSV UTF-8</b> แล้วอัปโหลด หัวตารางใช้ชื่อเดียวกับไฟล์แม่แบบ คอลัมน์ที่ไม่รู้จักจะเก็บเป็น "ข้อมูลเพิ่มเติม"</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={template} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">ดาวน์โหลดแม่แบบ</button>
          <button onClick={() => fileRef.current.click()} className="rounded-lg bg-forest-800 px-3 py-2 text-sm font-semibold text-white">เลือกไฟล์ CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </div>
        {preview?.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            พบ {preview.length} รายการ: {Object.entries(preview.reduce((a, r) => ({ ...a, [r.category]: (a[r.category] || 0) + 1 }), {})).map(([k, n]) => `${categories.find((c) => c.key === k)?.short_name || k} ${n}`).join(', ')}
            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={async () => { setBusy(true); try { const n = await bulkInsert(preview); setMsg(`นำเข้าแล้ว ${n} รายการ`); setPreview(null) } catch (e) { setMsg(e.message) } finally { setBusy(false) } }}
                className="flex items-center gap-1.5 rounded-lg bg-forest-800 px-3 py-1.5 text-white">{busy && <Loader2 size={14} className="animate-spin" />}ยืนยันนำเข้า</button>
              <button onClick={() => setPreview(null)} className="rounded-lg px-3 py-1.5 text-slate-600">ยกเลิก</button>
            </div>
          </div>
        )}
        {msg && <p className="text-sm text-forest-700">{msg}</p>}
      </div>
      <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="flex items-center gap-2 font-semibold"><Download size={18} />ส่งออก / สำรองข้อมูล</h3>
        <p className="text-sm text-slate-600">ดาวน์โหลดข้อมูลทั้งหมด {sites.length} รายการ (รวมรายการที่ซ่อน) เปิดด้วย Excel ได้</p>
        <button onClick={() => downloadText(sitesToCsv(sites, categories), `backup-${new Date().toISOString().slice(0, 10)}.csv`)} className="rounded-lg bg-forest-800 px-3 py-2 text-sm font-semibold text-white">ดาวน์โหลด CSV</button>
        {isDemo && (
          <div className="border-t border-slate-100 pt-3">
            <button onClick={() => confirm('ล้างข้อมูลโหมดสาธิตกลับเป็นค่าเริ่มต้น?') && resetDemo()} className="flex items-center gap-1.5 text-sm text-amber-700"><RotateCcw size={14} />รีเซ็ตข้อมูลสาธิต</button>
          </div>
        )}
      </div>
    </div>
  )
}

function EyeToggle({ on, onChange }) {
  const [busy, setBusy] = useState(false)
  const click = async () => { setBusy(true); try { await onChange(!on) } catch (e) { alert(e.message) } finally { setBusy(false) } }
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={click} disabled={busy} title={on ? 'กำลังแสดง — กดเพื่อซ่อน' : 'ซ่อนอยู่ — กดเพื่อแสดง'}
      className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full transition', on ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200')}>
      {busy ? <Loader2 size={17} className="animate-spin" /> : on ? <Eye size={18} /> : <EyeOff size={18} />}
    </motion.button>
  )
}

const TABS = [
  { key: 'sites', label: 'ข้อมูลจุด', icon: Database, C: SitesTab },
  { key: 'cats', label: 'ประเภทข้อมูล', icon: Palette, C: CategoriesTab },
  { key: 'import', label: 'นำเข้า/ส่งออก', icon: Upload, C: ImportTab },
  { key: 'settings', label: 'ตั้งค่าเว็บ', icon: Settings, C: SettingsTab },
]

export default function Admin() {
  const { session, reload, loading } = useData()
  const [tab, setTab] = useState('sites')
  if (loading && !session) return null
  if (!session?.isAdmin) return <Login />
  const T = TABS.find((t) => t.key === tab).C
  return (
    <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-forest-900">จัดการข้อมูล</h1>
          <p className="text-xs text-slate-500">เข้าสู่ระบบเป็น {session.email} · การแก้ไขแสดงผลบนเว็บภายในไม่กี่วินาที{!isDemo && ' · แก้ใน Google Sheet โดยตรงก็ได้'}</p>
        </div>
        <button onClick={async () => { await signOut(); reload() }} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-300 hover:bg-white"><LogOut size={16} />ออกจากระบบ</button>
      </div>
      <div className="thin-scroll mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('relative flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium', tab === t.key ? 'text-white' : 'text-slate-600 hover:bg-slate-50')}>
            {tab === t.key && <motion.span layoutId="admintab" className="absolute inset-0 rounded-lg bg-forest-800" />}
            <span className="relative flex items-center gap-1.5"><t.icon size={16} />{t.label}</span>
          </button>
        ))}
      </div>
      <T />
    </div>
  )
}
