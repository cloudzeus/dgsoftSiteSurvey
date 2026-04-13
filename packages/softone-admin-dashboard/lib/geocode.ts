// Geocoding helper — powered by geocode.maps.co
// Reads API key from the active GEOCODE_MAPS connection in the DB.
//
// Usage (server-side only):
//   import { forwardGeocode, reverseGeocode } from "@/lib/geocode"
//
//   const [result] = await forwardGeocode("Ερμού 10, Αθήνα")
//   // result.lat, result.lon, result.displayName
//
//   const address = await reverseGeocode(37.9755, 23.7348)
//   // address.displayName, address.road, address.city, ...

import { db } from "@/lib/db"

const BASE_URL = "https://geocode.maps.co"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ForwardGeocodeResult {
  placeId: number
  lat: number
  lon: number
  displayName: string
  /** e.g. "road", "suburb", "city", "country" */
  type: string
  boundingBox: [number, number, number, number] | null
}

export interface ReverseGeocodeResult {
  placeId: number
  lat: number
  lon: number
  displayName: string
  address: {
    road?: string
    houseNumber?: string
    suburb?: string
    city?: string
    municipality?: string
    county?: string
    stateDistrict?: string
    state?: string
    postcode?: string
    country?: string
    countryCode?: string
  }
}

// ─── Internals ─────────────────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
  const conn = await db.connection.findFirst({
    where: { type: "GEOCODE_MAPS", isActive: true },
  })
  if (!conn) throw new Error("No active GEOCODE_MAPS connection found. Add one via the Connections page.")
  const creds = conn.credentials as Record<string, unknown>
  if (typeof creds.apiKey !== "string" || !creds.apiKey) {
    throw new Error("GEOCODE_MAPS connection is missing 'apiKey' in credentials.")
  }
  return creds.apiKey
}

async function geocodeFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const apiKey = await getApiKey()
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set("api_key", apiKey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) throw new Error(`geocode.maps.co ${endpoint} failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type RawResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
  boundingbox?: [string, string, string, string]
}[]

function normaliseResults(raw: RawResult): ForwardGeocodeResult[] {
  return raw.map((r) => ({
    placeId: r.place_id,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    type: r.type,
    boundingBox: r.boundingbox
      ? (r.boundingbox.map(parseFloat) as [number, number, number, number])
      : null,
  }))
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Forward geocoding — address string → array of candidate locations.
 * Returns an empty array when nothing is found.
 */
export async function forwardGeocode(address: string): Promise<ForwardGeocodeResult[]> {
  type Raw = {
    place_id: number
    lat: string
    lon: string
    display_name: string
    type: string
    boundingbox?: [string, string, string, string]
  }[]

  const raw = await geocodeFetch<RawResult>("search", { q: address })
  return normaliseResults(raw)
}

export interface StructuredAddress {
  street?: string      // road name only
  houseNumber?: string
  postalCode?: string
  city?: string
  country?: string     // defaults to "Greece"
}

/**
 * Structured geocoding — uses individual address fields for higher accuracy.
 * Especially useful for AEEDE addresses which are uppercase and may be abbreviated.
 * Falls back through progressively looser queries until a result is found.
 */
export async function structuredGeocode(addr: StructuredAddress): Promise<ForwardGeocodeResult[]> {
  const country = addr.country ?? "Greece"

  // AEEDE returns ALL-CAPS Greek. Title-case helps Nominatim match place names.
  function titleCase(s: string): string {
    return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
  }

  const city    = addr.city    ? titleCase(addr.city)    : undefined
  const street  = addr.street  ? titleCase(addr.street)  : undefined

  // Helper: run one attempt with given params
  async function attempt(params: Record<string, string>): Promise<ForwardGeocodeResult[]> {
    try {
      const raw = await geocodeFetch<RawResult>("search", { ...params, countrycodes: "gr" })
      return normaliseResults(raw)
    } catch {
      return []
    }
  }

  // 1. Full structured: street + house number + postcode + city
  if (street && addr.houseNumber && addr.postalCode && city) {
    const results = await attempt({
      street: `${addr.houseNumber} ${street}`,
      postalcode: addr.postalCode,
      city,
      country,
    })
    if (results.length) return results
  }

  // 2. Street + city (drop postcode — AEEDE postcodes are sometimes wrong)
  if (street && city) {
    const streetFull = addr.houseNumber ? `${addr.houseNumber} ${street}` : street
    const results = await attempt({ street: streetFull, city, country })
    if (results.length) return results
  }

  // 3. Postcode + city (street may be abbreviated)
  if (addr.postalCode && city) {
    const results = await attempt({ postalcode: addr.postalCode, city, country })
    if (results.length) return results
  }

  // 4. City only — structured
  if (city) {
    const results = await attempt({ city, country })
    if (results.length) return results
  }

  // 5. Free-text fallback — build a query string from whatever we have
  const parts = [
    addr.houseNumber && street ? `${street} ${addr.houseNumber}` : street,
    addr.postalCode,
    city ?? (addr.city ? titleCase(addr.city) : undefined),
    "Ελλάδα",
  ].filter(Boolean) as string[]

  if (parts.length) {
    const results = await forwardGeocode(parts.join(", "))
    if (results.length) return results
  }

  return []
}

/**
 * Reverse geocoding — coordinates → address details.
 * Throws when the API returns no result for the given coordinates.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  type Raw = {
    place_id: number
    lat: string
    lon: string
    display_name: string
    address: {
      road?: string
      house_number?: string
      suburb?: string
      city?: string
      municipality?: string
      county?: string
      state_district?: string
      state?: string
      postcode?: string
      country?: string
      country_code?: string
    }
  }

  const raw = await geocodeFetch<Raw>("reverse", {
    lat: String(lat),
    lon: String(lon),
  })

  if (!raw.display_name) throw new Error(`reverseGeocode: no result for (${lat}, ${lon})`)

  return {
    placeId: raw.place_id,
    lat: parseFloat(raw.lat),
    lon: parseFloat(raw.lon),
    displayName: raw.display_name,
    address: {
      road: raw.address.road,
      houseNumber: raw.address.house_number,
      suburb: raw.address.suburb,
      city: raw.address.city,
      municipality: raw.address.municipality,
      county: raw.address.county,
      stateDistrict: raw.address.state_district,
      state: raw.address.state,
      postcode: raw.address.postcode,
      country: raw.address.country,
      countryCode: raw.address.country_code,
    },
  }
}
