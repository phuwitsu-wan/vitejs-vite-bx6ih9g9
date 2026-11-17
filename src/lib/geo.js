import { useEffect, useState } from 'react'
import { asset } from './asset'

const FILES = { province: 'phetchabun-province.json', amphoe: 'phetchabun-districts.json', tambon: 'phetchabun-tambons.json' }
const cache = {}

export function useGeo(level) {
  const [data, setData] = useState(cache[level] || null)
  useEffect(() => {
    let alive = true
    if (cache[level]) { setData(cache[level]); return }
    setData(null)
    fetch(asset(FILES[level])).then((r) => r.json()).then((j) => { cache[level] = j; if (alive) setData(j) }).catch(() => {})
    return () => { alive = false }
  }, [level])
  return data
}

function inRing(pt, ring) {
  let inside = false
  const [x, y] = pt
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inPoly = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h))

export function pointInFeature(lng, lat, f) {
  const g = f.geometry
  if (g.type === 'Polygon') return inPoly([lng, lat], g.coordinates)
  if (g.type === 'MultiPolygon') return g.coordinates.some((p) => inPoly([lng, lat], p))
  return false
}

// หาพื้นที่ (feature) ที่จุดอยู่ภายใน — ใช้พิกัดก่อน ถ้าไม่มีพิกัดจึงเทียบชื่อ
export function assignArea(site, geo, level) {
  if (!geo) return null
  if (level === 'province') return geo.features[0]?.properties.code
  if (Number.isFinite(site.lat) && Number.isFinite(site.lng)) {
    const f = geo.features.find((ft) => pointInFeature(site.lng, site.lat, ft))
    if (f) return f.properties.code
  }
  const f = geo.features.find((ft) => level === 'amphoe'
    ? ft.properties.name === site.amphoe
    : ft.properties.name === site.tambon && ft.properties.amphoe === site.amphoe)
  return f?.properties.code ?? null
}

// แบ่งช่วงสีตามการกระจายของข้อมูลจริง (quantile) ให้แต่ละสีมีพื้นที่ใกล้เคียงกัน
export function makeBreaks(values) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return [1]
  const uniq = [...new Set(v)]
  if (uniq.length <= 5) return uniq
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return [...new Set([v[0], q(0.25), q(0.5), q(0.75), q(0.9)])]
}
export const classOf = (v, breaks) => (v <= 0 ? -1 : breaks.filter((b) => v >= b).length - 1)
