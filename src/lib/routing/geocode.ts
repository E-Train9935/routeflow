type NominatimResult = {
  lat: string
  lon: string
  display_name: string
}

export type GeocodedAddress = {
  latitude: number
  longitude: number
  displayName: string
}

export async function geocodeAddress(
  address: string
): Promise<GeocodedAddress | null> {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": "RouteFlow-development/0.1",
      },

      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error(
      `Geocoding failed with status ${response.status}`
    )
  }

  const results =
    (await response.json()) as NominatimResult[]

  if (results.length === 0) {
    return null
  }

  const result = results[0]

  const latitude = Number(result.lat)
  const longitude = Number(result.lon)

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null
  }

  return {
    latitude,
    longitude,
    displayName: result.display_name,
  }
}