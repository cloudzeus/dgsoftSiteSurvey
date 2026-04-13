"use client"

// Leaflet requires the browser — always import via next/dynamic with ssr:false.
// This file is the actual map implementation; the parent lazy-loads it.

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix default marker icons broken by webpack/turbopack asset hashing
const icon = L.icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
})

// Fly to new coords when they change
function FlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lon], 16, { duration: 1.2 }) }, [lat, lon, map])
  return null
}

export interface AddressMapProps {
  lat: number
  lon: number
  label: string
}

export function AddressMap({ lat, lon, label }: AddressMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={16}
      style={{ width: "100%", height: "100%", borderRadius: "inherit" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo lat={lat} lon={lon} />
      <Marker position={[lat, lon]} icon={icon}>
        <Popup maxWidth={260}>
          <span className="text-[12px] font-medium">{label}</span>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
