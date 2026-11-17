// ชั้นข้อมูล: ใช้ Google Sheets (ผ่าน Apps Script) เมื่อมี VITE_GAS_URL ไม่เช่นนั้นใช้ "โหมดสาธิต" (เก็บใน localStorage)
import seed from '../data/seed.json'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './constants'

const GAS = (import.meta.env.VITE_GAS_URL || '').trim()
export const isDemo = !GAS || !GAS.includes('script.google.com')

const SITE_COLUMNS = ['id', 'category', 'name', 'subtype', 'level', 'amphoe', 'tambon', 'moo', 'address', 'lat', 'lng', 'phone', 'contact_name',
  'main_crops', 'members', 'established_year', 'service_hours', 'status', 'description', 'extra', 'documents', 'image_url', 'is_published', 'source']

const clean = (s) => {
  const o = {}
  for (const k of SITE_COLUMNS) if (k in s) o[k] = s[k] === '' ? null : s[k]
  for (const k of ['lat', 'lng']) if (k in o) o[k] = o[k] == null ? null : Number(o[k])
  for (const k of ['members', 'established_year']) if (k in o) o[k] = o[k] == null ? null : parseInt(o[k], 10) || null
  if (!o.extra) o.extra = {}
  if (!Array.isArray(o.documents)) o.documents = []
  return o
}
const normSite = (s) => ({ ...s, lat: s.lat == null || s.lat === '' ? null : Number(s.lat), lng: s.lng == null || s.lng === '' ? null : Number(s.lng),
  documents: Array.isArray(s.documents) ? s.documents : [], extra: s.extra && typeof s.extra === 'object' ? s.extra : {}, is_published: s.is_published !== false })

// ---------------- local storage helpers ----------------
const LS = { sites: 'ppn_demo_sites_v2', cats: 'ppn_demo_cats_v2', settings: 'ppn_demo_settings_v2', session: 'ppn_session_v2', cache: 'ppn_cache_v2' }
const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full */ } }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

function demoSites() {
  let s = read(LS.sites, null)
  if (!s) { s = seed.map((x) => ({ ...x, documents: [], id: uid(), updated_at: new Date().toISOString() })); write(LS.sites, s) }
  return s
}
export const DEMO_PASSWORD = 'demo1234'

// ---------------- Apps Script transport ----------------
async function gasGet(action) {
  const r = await fetch(`${GAS}?action=${action}&_=${Date.now()}`)
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j
}
async function gasPost(action, payload = {}) {
  const token = read(LS.session, null)?.token
  // ส่งเป็น text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight (Apps Script ไม่รองรับ)
  const r = await fetch(GAS, { method: 'POST', body: JSON.stringify({ action, token, ...payload }) })
  const j = await r.json()
  if (j.error === 'AUTH') { localStorage.removeItem(LS.session); emit(); throw new Error(j.message || 'กรุณาเข้าสู่ระบบใหม่') }
  if (j.error) throw new Error(j.error)
  return j
}

// ---------------- Public API ----------------
export function cachedData() {
  if (isDemo) return null
  return read(LS.cache, null)
}

export async function fetchAll({ includeHidden = false } = {}) {
  if (isDemo) {
    const sites = demoSites().map(normSite)
    const cats = read(LS.cats, DEFAULT_CATEGORIES)
    const visible = new Set(cats.filter((c) => c.is_visible !== false).map((c) => c.key))
    return {
      sites: includeHidden ? sites : sites.filter((s) => s.is_published !== false && visible.has(s.category)),
      categories: includeHidden ? cats : cats.filter((c) => c.is_visible !== false),
      settings: { ...DEFAULT_SETTINGS, ...read(LS.settings, {}) },
    }
  }
  const d = includeHidden ? await gasPost('adminData') : await gasGet('data')
  const out = {
    sites: (d.sites || []).filter((s) => s.id && s.name).map(normSite),
    categories: d.categories?.length ? d.categories : DEFAULT_CATEGORIES,
    settings: { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(d.settings || {}).filter(([, v]) => v !== '' && v != null)) },
    version: d.version,
  }
  if (!includeHidden) write(LS.cache, out)
  return out
}

// ตรวจการเปลี่ยนแปลงทุก 30 วินาที และเมื่อกลับมาที่แท็บ — แก้ในชีตหรือหน้าแอดมินแล้วหน้าเว็บอัปเดตเอง
export function subscribe(cb) {
  listeners.add(cb)
  if (isDemo) {
    const onStorage = (e) => { if (e.key?.startsWith('ppn_demo')) cb() }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage) }
  }
  let last = null
  const check = async () => {
    if (document.hidden) return
    try { const { version } = await gasGet('version'); if (last && version !== last) cb(); last = version } catch { /* offline */ }
  }
  check()
  const t = setInterval(check, 30000)
  const onVis = () => { if (!document.hidden) check() }
  document.addEventListener('visibilitychange', onVis)
  return () => { listeners.delete(cb); clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
}

// ---------------- Auth ----------------
export async function getSession() {
  const s = read(LS.session, null)
  if (!s) return null
  if (s.expires && s.expires < Date.now()) { localStorage.removeItem(LS.session); return null }
  return { email: s.email, isAdmin: true }
}

export async function signIn(email, password) {
  if (isDemo) {
    if (password !== DEMO_PASSWORD) throw new Error('รหัสผ่านไม่ถูกต้อง (โหมดสาธิตใช้รหัส demo1234)')
    const s = { email, token: 'demo', expires: Date.now() + 7 * 864e5 }
    write(LS.session, s); return { email, isAdmin: true }
  }
  const r = await gasPost('login', { email, password })
  write(LS.session, { email: r.email, token: r.token, expires: r.expires })
  return { email: r.email, isAdmin: true }
}

export async function signOut() { localStorage.removeItem(LS.session) }

// ---------------- Admin CRUD ----------------
export async function saveSite(site) {
  const row = clean(site)
  if (isDemo) {
    const all = demoSites()
    const now = new Date().toISOString()
    if (site.id) { const i = all.findIndex((x) => x.id === site.id); all[i] = { ...all[i], ...row, updated_at: now } }
    else all.unshift({ ...row, id: uid(), updated_at: now })
    write(LS.sites, all); emit(); return
  }
  await gasPost('saveSite', { site: row }); emit()
}

export async function deleteSites(ids) {
  if (isDemo) { write(LS.sites, demoSites().filter((s) => !ids.includes(s.id))); emit(); return }
  await gasPost('deleteSites', { ids }); emit()
}

export async function setPublished(ids, value) {
  if (isDemo) { write(LS.sites, demoSites().map((s) => (ids.includes(s.id) ? { ...s, is_published: value } : s))); emit(); return }
  await gasPost('setPublished', { ids, value }); emit()
}

export async function bulkInsert(rows) {
  const data = rows.map(clean)
  if (isDemo) { write(LS.sites, [...data.map((r) => ({ ...r, id: uid(), updated_at: new Date().toISOString() })), ...demoSites()]); emit(); return data.length }
  for (let i = 0; i < data.length; i += 300) await gasPost('bulkInsert', { rows: data.slice(i, i + 300) })
  emit(); return data.length
}

export async function saveCategory(cat) {
  const c = { key: cat.key, name: cat.name, short_name: cat.short_name, color: cat.color, icon: cat.icon, description: cat.description, sort_order: Number(cat.sort_order) || 0, is_visible: cat.is_visible !== false }
  if (isDemo) {
    const cats = read(LS.cats, DEFAULT_CATEGORIES)
    const i = cats.findIndex((x) => x.key === c.key)
    if (i >= 0) cats[i] = c; else cats.push(c)
    write(LS.cats, cats); emit(); return
  }
  await gasPost('saveCategory', { category: c }); emit()
}

export async function deleteCategory(key) {
  if (isDemo) { write(LS.cats, read(LS.cats, DEFAULT_CATEGORIES).filter((c) => c.key !== key)); emit(); return }
  await gasPost('deleteCategory', { key }); emit()
}

export async function saveSettings(obj) {
  if (isDemo) { write(LS.settings, { ...read(LS.settings, {}), ...obj }); emit(); return }
  await gasPost('saveSettings', { settings: obj }); emit()
}

// อัปโหลดไฟล์ไปเก็บใน Google Drive — คืนค่า { id, name, url, download, image, size, mime }
export async function uploadFile(file, { image = false } = {}) {
  let blob = file, name = file.name, mime = file.type || 'application/octet-stream'
  if (image) { blob = await resizeImage(file, isDemo ? 640 : 1600); mime = 'image/webp'; name = name.replace(/\.\w+$/, '') + '.webp' }
  const limit = isDemo ? 2 : 20
  if (blob.size > limit * 1024 * 1024) throw new Error(`ไฟล์ใหญ่เกิน ${limit} MB${isDemo ? ' (โหมดสาธิต)' : ''}`)
  const dataUrl = await new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = j; f.readAsDataURL(blob) })
  if (isDemo) return { id: uid(), name, url: dataUrl, download: dataUrl, image: dataUrl, size: blob.size, mime }
  return gasPost('uploadFile', { name, mimeType: mime, data: String(dataUrl).split(',')[1] })
}

export async function trashFile(id) {
  if (isDemo || !id) return
  try { await gasPost('trashFile', { id }) } catch { /* ignore */ }
}

export function resetDemo() {
  [LS.sites, LS.cats, LS.settings].forEach((k) => localStorage.removeItem(k)); emit()
}

async function resizeImage(file, max) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((r) => c.toBlob(r, 'image/webp', 0.82))
}
