// ชั้นข้อมูล: ใช้ Supabase เมื่อมีค่า env ไม่เช่นนั้นใช้ "โหมดสาธิต" (เก็บใน localStorage)
import { createClient } from '@supabase/supabase-js'
import seed from '../data/seed.json'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './constants'

const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isDemo = !URL_ || !KEY || URL_.includes('xxxxxxxx')
export const supabase = isDemo ? null : createClient(URL_, KEY)

const BUCKET = 'site-images'
const SITE_COLUMNS = ['category', 'name', 'subtype', 'level', 'amphoe', 'tambon', 'moo', 'address', 'lat', 'lng', 'phone', 'contact_name',
  'main_crops', 'members', 'established_year', 'service_hours', 'status', 'description', 'extra', 'image_url', 'is_published', 'source']

const clean = (s) => {
  const o = {}
  for (const k of SITE_COLUMNS) if (k in s) o[k] = s[k] === '' ? null : s[k]
  for (const k of ['lat', 'lng']) if (k in o) o[k] = o[k] == null ? null : Number(o[k])
  for (const k of ['members', 'established_year']) if (k in o) o[k] = o[k] == null ? null : parseInt(o[k], 10) || null
  if (!o.extra) o.extra = {}
  return o
}

// ---------------- Demo store ----------------
const LS = { sites: 'ppn_demo_sites_v1', cats: 'ppn_demo_cats_v1', settings: 'ppn_demo_settings_v1', session: 'ppn_demo_session' }
const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full */ } }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

function demoSites() {
  let s = read(LS.sites, null)
  if (!s) { s = seed.map((x) => ({ ...x, id: uid(), updated_at: new Date().toISOString() })); write(LS.sites, s) }
  return s
}
export const DEMO_PASSWORD = 'demo1234'

// ---------------- Public API ----------------
export async function fetchAll({ includeHidden = false } = {}) {
  if (isDemo) {
    const sites = demoSites()
    return {
      sites: includeHidden ? sites : sites.filter((s) => s.is_published !== false),
      categories: read(LS.cats, DEFAULT_CATEGORIES),
      settings: { ...DEFAULT_SETTINGS, ...read(LS.settings, {}) },
    }
  }
  let q = supabase.from('sites').select('*').order('amphoe').order('name').limit(5000)
  if (!includeHidden) q = q.eq('is_published', true)
  const [s, c, st] = await Promise.all([q, supabase.from('categories').select('*').order('sort_order'), supabase.from('settings').select('*')])
  if (s.error) throw s.error
  if (c.error) throw c.error
  const settings = { ...DEFAULT_SETTINGS }
  for (const r of st.data || []) settings[r.key] = r.value
  return { sites: s.data, categories: c.data?.length ? c.data : DEFAULT_CATEGORIES, settings }
}

// ฟังการเปลี่ยนแปลงแบบเรียลไทม์ — แอดมินแก้ข้อมูลแล้วหน้าแผนที่ของทุกคนอัปเดตเอง
export function subscribe(cb) {
  if (isDemo) {
    listeners.add(cb)
    const onStorage = (e) => { if (e.key?.startsWith('ppn_demo')) cb() }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage) }
  }
  const ch = supabase.channel('public-data')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, cb)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

// ---------------- Auth ----------------
export async function getSession() {
  if (isDemo) return read(LS.session, null)
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const { data: ok } = await supabase.rpc('is_admin')
  return { email: data.session.user.email, isAdmin: !!ok }
}

export async function signIn(email, password) {
  if (isDemo) {
    if (password !== DEMO_PASSWORD) throw new Error('รหัสผ่านไม่ถูกต้อง (โหมดสาธิตใช้รหัส demo1234)')
    const s = { email, isAdmin: true }
    write(LS.session, s); return s
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message)
  return getSession()
}

export async function signOut() {
  if (isDemo) { localStorage.removeItem(LS.session); return }
  await supabase.auth.signOut()
}

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
  const res = site.id ? await supabase.from('sites').update(row).eq('id', site.id) : await supabase.from('sites').insert(row)
  if (res.error) throw res.error
}

export async function deleteSites(ids) {
  if (isDemo) { write(LS.sites, demoSites().filter((s) => !ids.includes(s.id))); emit(); return }
  const { error } = await supabase.from('sites').delete().in('id', ids)
  if (error) throw error
}

export async function setPublished(ids, value) {
  if (isDemo) { write(LS.sites, demoSites().map((s) => (ids.includes(s.id) ? { ...s, is_published: value } : s))); emit(); return }
  const { error } = await supabase.from('sites').update({ is_published: value }).in('id', ids)
  if (error) throw error
}

export async function bulkInsert(rows) {
  const data = rows.map(clean)
  if (isDemo) { write(LS.sites, [...data.map((r) => ({ ...r, id: uid(), updated_at: new Date().toISOString() })), ...demoSites()]); emit(); return data.length }
  for (let i = 0; i < data.length; i += 200) {
    const { error } = await supabase.from('sites').insert(data.slice(i, i + 200))
    if (error) throw error
  }
  return data.length
}

export async function saveCategory(cat) {
  if (isDemo) {
    const cats = read(LS.cats, DEFAULT_CATEGORIES)
    const i = cats.findIndex((c) => c.key === cat.key)
    if (i >= 0) cats[i] = cat; else cats.push(cat)
    write(LS.cats, cats); emit(); return
  }
  const { error } = await supabase.from('categories').upsert(cat)
  if (error) throw error
}

export async function deleteCategory(key) {
  if (isDemo) { write(LS.cats, read(LS.cats, DEFAULT_CATEGORIES).filter((c) => c.key !== key)); emit(); return }
  const { error } = await supabase.from('categories').delete().eq('key', key)
  if (error) throw error
}

export async function saveSettings(obj) {
  if (isDemo) { write(LS.settings, { ...read(LS.settings, {}), ...obj }); emit(); return }
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value }))
  const { error } = await supabase.from('settings').upsert(rows)
  if (error) throw error
}

export async function uploadImage(file) {
  const small = await resizeImage(file, 1280)
  if (isDemo) {
    const thumb = await resizeImage(file, 480)
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(thumb) })
  }
  const path = `${new Date().getFullYear()}/${uid()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, small, { contentType: 'image/webp', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function resetDemo() {
  Object.values(LS).forEach((k) => localStorage.removeItem(k)); emit()
}

async function resizeImage(file, max) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((r) => c.toBlob(r, 'image/webp', 0.82))
}
