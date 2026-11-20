import { asset } from '../lib/asset'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, useMap, LayersControl, ZoomControl, Tooltip } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import { iconSvg } from './CatIcon'
import { hasCoords } from '../lib/utils'
import { PROVINCE_CENTER } from '../lib/constants'

const iconCache = new Map()
function pinIcon(cat, { active, alert }) {
  const k = `${cat?.key}|${cat?.color}|${cat?.icon}|${active}|${alert}`
  if (!iconCache.has(k)) {
    const color = cat?.color || '#16a34a'
    iconCache.set(k, L.divIcon({
      className: 'pp-marker',
      html: `<div class="pp-pin${active ? ' is-active' : ''}" style="background:${color}">${alert ? `<span class="pp-pulse" style="background:${color}"></span>` : ''}${iconSvg(cat?.icon)}</div>`,
      iconSize: [34, 34], iconAnchor: [5, 34], popupAnchor: [12, -30],
    }))
  }
  return iconCache.get(k)
}

const clusterIcon = (cluster) => {
  const n = cluster.getChildCount()
  const size = n < 10 ? 36 : n < 50 ? 44 : 52
  return L.divIcon({ html: `<div class="pp-cluster" style="width:${size}px;height:${size}px">${n}</div>`, className: 'pp-marker', iconSize: [size, size] })
}

const meIcon = L.divIcon({ className: 'pp-marker', html: '<div class="pp-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

function Controller({ focus, bounds, me }) {
  const map = useMap()
  useEffect(() => {
    if (focus && hasCoords(focus)) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 14), { duration: 0.8 })
  }, [focus, map])
  useEffect(() => {
    if (bounds?.isValid?.()) map.flyToBounds(bounds, { padding: [30, 30], duration: 0.8, maxZoom: 12 })
  }, [bounds, map])
  useEffect(() => { if (me) map.flyTo([me.lat, me.lng], 12, { duration: 0.8 }) }, [me, map])
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer()); return () => ro.disconnect()
  }, [map])
  return null
}

export default function MapView({ sites, catMap, selectedId, onSelect, me, districtFilter, onDistrictClick, flyBounds, picker, onPick }) {
  const [districts, setDistricts] = useState(null)
  useEffect(() => { fetch(asset('/phetchabun-districts.json')).then((r) => r.json()).then(setDistricts).catch(() => {}) }, [])

  const selected = useMemo(() => sites.find((s) => s.id === selectedId), [sites, selectedId])
  const districtStyle = (f) => {
    const on = districtFilter && f.properties.name === districtFilter
    return { color: '#14532d', weight: on ? 3 : 1.2, opacity: on ? 1 : 0.55, fillColor: on ? '#c5e17a' : '#ffffff', fillOpacity: on ? 0.25 : 0.04, dashArray: on ? null : '4 4' }
  }

  return (
    <MapContainer center={PROVINCE_CENTER} zoom={8} minZoom={7} zoomControl={false} className="h-full w-full" maxBounds={[[13.5, 98.5], [19, 104]]}>
      <ZoomControl position="bottomright" />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="แผนที่ถนน">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="ภาพถ่ายดาวเทียม">
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="แผนที่โทนอ่อน">
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
        </LayersControl.BaseLayer>
      </LayersControl>

      {districts && (
        <GeoJSON key={districtFilter || 'all'} data={districts} style={districtStyle}
          onEachFeature={(f, layer) => {
            layer.bindTooltip(`อ.${f.properties.name}`, { permanent: true, direction: 'center', className: 'pp-district-label' })
            if (onDistrictClick && !picker) layer.on('click', () => onDistrictClick(f.properties.name))
          }} />
      )}

      {picker ? (
        picker.lat != null && <Marker position={[picker.lat, picker.lng]} icon={pinIcon(catMap[picker.category], { active: true })} draggable
          eventHandlers={{ dragend: (e) => onPick?.(e.target.getLatLng()) }} />
      ) : (
        <MarkerClusterGroup chunkedLoading iconCreateFunction={clusterIcon} maxClusterRadius={45} showCoverageOnHover={false} spiderfyOnMaxZoom>
          {sites.filter(hasCoords).map((s) => (
            <Marker key={s.id} position={[s.lat, s.lng]}
              icon={pinIcon(catMap[s.category], { active: s.id === selectedId, alert: /ระบาด/.test(s.status || '') })}
              eventHandlers={{ click: () => onSelect?.(s.id) }}>
              <Tooltip direction="top" offset={[12, -30]} opacity={0.95}>{s.name}</Tooltip>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}

      {me && <Marker position={[me.lat, me.lng]} icon={meIcon}><Tooltip permanent direction="top" offset={[0, -10]}>ตำแหน่งของคุณ</Tooltip></Marker>}
      <Controller focus={selected} bounds={flyBounds} me={me} />
      {picker && <PickHandler onPick={onPick} start={picker} />}
    </MapContainer>
  )
}

function PickHandler({ onPick, start }) {
  const map = useMap()
  useEffect(() => {
    if (start?.lat != null) map.setView([start.lat, start.lng], 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  useEffect(() => {
    const h = (e) => onPick(e.latlng)
    map.on('click', h); return () => map.off('click', h)
  }, [map, onPick])
  return null
}
