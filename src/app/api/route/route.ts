import {
  NextRequest,
  NextResponse,
} from "next/server"

type OSRMRouteResponse = {
  code: string

  routes?: Array<{
    distance: number
    duration: number

    geometry: {
      type: "LineString"
      coordinates: number[][]
    }
  }>
}

export async function GET(
  request: NextRequest
) {
  const searchParams =
    request.nextUrl.searchParams

  const originLat = Number(
    searchParams.get("originLat")
  )

  const originLng = Number(
    searchParams.get("originLng")
  )

  const destinationLat = Number(
    searchParams.get(
      "destinationLat"
    )
  )

  const destinationLng = Number(
    searchParams.get(
      "destinationLng"
    )
  )

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(
      destinationLat
    ) ||
    !Number.isFinite(
      destinationLng
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid route coordinates.",
      },
      {
        status: 400,
      }
    )
  }

  if (
    originLat < -90 ||
    originLat > 90 ||
    destinationLat < -90 ||
    destinationLat > 90 ||
    originLng < -180 ||
    originLng > 180 ||
    destinationLng < -180 ||
    destinationLng > 180
  ) {
    return NextResponse.json(
      {
        error:
          "Coordinates are outside valid ranges.",
      },
      {
        status: 400,
      }
    )
  }

  const coordinates =
    `${originLng},${originLat};` +
    `${destinationLng},${destinationLat}`

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?overview=full&geometries=geojson&steps=false"

  try {
    const response = await fetch(
      url,
      {
        cache: "no-store",
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "Routing service unavailable.",
        },
        {
          status: 502,
        }
      )
    }

    const data =
      (await response.json()) as OSRMRouteResponse

    const route =
      data.routes?.[0]

    if (
      data.code !== "Ok" ||
      !route
    ) {
      return NextResponse.json(
        {
          error:
            "No driving route was found.",
        },
        {
          status: 404,
        }
      )
    }

    return NextResponse.json({
      distanceMeters:
        route.distance,

      durationSeconds:
        route.duration,

      geometry:
        route.geometry,
    })
  } catch (error) {
    console.error(
      "OSRM request failed:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Routing service unavailable.",
      },
      {
        status: 502,
      }
    )
  }
}