import { SITE_FIELDS } from './constants'

export const cn = (...a) => a.filter(Boolean).join(' ')

export const hasCoords = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng)

export const directionsUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`

export const telHref = (phone) => `tel:${String(phone).split(',')[0].replace(/[^\d+]/g, '')}`

export const formatPhone = (p) => {
  if (!p) return ''
  return String(p).split(',').map((x) => {
    const d = x.replace(/\D/g, '')
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
    return x.trim()
  }).join(', ')
}

export function distanceKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']
export const todayThai = () => THAI_DAYS[new Date().getDay()]
export const isOpenToday = (s) => !!s.service_hours && s.service_hours.includes(todayThai())

export function matchesSearch(s, q) {
  if (!q) return true
  const hay = [s.name, s.amphoe, s.tambon, s.address, s.main_crops, s.subtype, s.contact_name].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
}

// ---------- CSV ----------
const esc = (v) => {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function sitesToCsv(sites, categories) {
  const catName = Object.fromEntries(categories.map((c) => [c.key, c.name]))
  const head = SITE_FIELDS.map(([, l]) => l).concat('ข้อมูลเพิ่มเติม (JSON)')
  const rows = sites.map((s) => SITE_FIELDS.map(([k]) => (k === 'category' ? catName[s.category] || s.category : s[k])).concat([s.extra]))
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseCsv(text) {
  text = text.replace(/^﻿/, '')
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); rows.push(row); row = []; cur = ''
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

// แปลง CSV (หัวตารางเป็นภาษาไทยหรือชื่อฟิลด์) เป็นรายการจุด
export function csvToSites(text, categories) {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const head = rows[0].map((h) => h.trim())
  const byLabel = Object.fromEntries(SITE_FIELDS.flatMap(([k, l]) => [[l, k], [k, k]]))
  const catByName = Object.fromEntries(categories.flatMap((c) => [[c.name, c.key], [c.short_name, c.key], [c.key, c.key]]))
  return rows.slice(1).map((r) => {
    const o = { extra: {} }
    head.forEach((h, i) => {
      const v = (r[i] ?? '').trim()
      if (h.startsWith('ข้อมูลเพิ่มเติม') || h === 'extra') { try { o.extra = v ? JSON.parse(v) : {} } catch { o.extra = {} } return }
      const k = byLabel[h]
      if (!k) { if (v) o.extra[h] = v; return }
      o[k] = v === '' ? null : v
    })
    if (o.category) o.category = catByName[o.category] || o.category
    for (const k of ['lat', 'lng']) o[k] = o[k] == null ? null : parseFloat(o[k])
    for (const k of ['members', 'established_year']) o[k] = o[k] == null ? null : parseInt(o[k], 10) || null
    o.is_published = o.is_published == null ? true : !/^(false|0|no|ไม่)/i.test(String(o.is_published))
    return o
  }).filter((o) => o.name && o.category)
}
