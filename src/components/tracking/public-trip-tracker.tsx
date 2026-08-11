"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl"

import {
  Clock3,
  Navigation,
} from "lucide-react"

import {
  createClient,
} from "@/lib/supabase/client"

type PublicTrip = {
  trip_id: string

  worker_name: string

  trip_status:
    | "assigned"
    | "en_route"
    | "arrived"

  destination_latitude:
    number | null

  destination_longitude:
    number | null

  worker_latitude:
    number | null

  worker_longitude:
    number | null

  accuracy_meters:
    number | null

  location_updated_at:
    string | null

  expires_at: string
}

type RouteInfo = {
  distanceMeters: number
  durationSeconds: number
  calculatedAt: number

  geometry: {
    type: "LineString"
    coordinates: number[][]
  }
}

type RouteApiResponse =
  Omit<RouteInfo, "calculatedAt">

type Props = {
  token: string
  initialTrip: PublicTrip
}

export function PublicTripTracker({
  token,
  initialTrip,
}: Props) {
  /*
   * STATE
   */

  const [supabase] =
    useState(() => createClient())

  const [trip, setTrip] =
    useState<PublicTrip>(
      initialTrip
    )

  const [route, setRoute] =
    useState<RouteInfo | null>(
      null
    )

  const [ended, setEnded] =
    useState(false)

  const [mapReady, setMapReady] =
    useState(false)

  /*
   * REFS
   */

  const initialTripRef =
  useRef(initialTrip)

  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const mapRef =
    useRef<MapLibreMap | null>(
      null
    )

  const workerMarkerRef =
    useRef<Marker | null>(
      null
    )

  const destinationMarkerRef =
    useRef<Marker | null>(
      null
    )

  const lastRouteRequestRef =
    useRef(0)

  /*
   * EFFECT 1
   *
   * Refresh the public trip data
   * every five seconds.
   */
  useEffect(() => {
    let active = true

    async function refreshTrip() {
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_public_trip_by_token",
        {
          p_token: token,
        }
      )

      if (!active) {
        return
      }

      if (error) {
        console.error(
          "Public tracking refresh failed:",
          error
        )

        return
      }

      const latest =
        (data?.[0] ??
          null) as PublicTrip | null

      /*
       * No result means the share
       * expired, was revoked, or the
       * trip ended.
       */
      if (!latest) {
        setEnded(true)
        return
      }

      setTrip(latest)
    }

    const interval =
      window.setInterval(
        () => {
          void refreshTrip()
        },
        5000
      )

    return () => {
      active = false

      window.clearInterval(
        interval
      )
    }
  }, [
    supabase,
    token,
  ])

  /*
   * EFFECT 2
   *
   * Create the MapLibre map.
   */
  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return
    }

    const initialMapTrip =
  initialTripRef.current

    let initialCenter:
      [number, number]

    if (
      initialMapTrip.worker_latitude !==
        null &&
      initialMapTrip.worker_longitude !==
        null
    ) {
      initialCenter = [
        initialMapTrip.worker_longitude,
        initialMapTrip.worker_latitude,
      ]
    } else if (
      initialMapTrip.destination_latitude !==
        null &&
      initialMapTrip.destination_longitude !==
        null
    ) {
      initialCenter = [
        initialMapTrip.destination_longitude,
        initialMapTrip.destination_latitude,
      ]
    } else {
      initialCenter = [
        -117.1611,
        32.7157,
      ]
    }

    const map =
      new MapLibreMap({
        container:
          mapContainerRef.current,

        style:
          "https://tiles.openfreemap.org/styles/positron",

        center:
          initialCenter,

        zoom:
          12,

        attributionControl: {},
      })

    map.addControl(
      new NavigationControl({
        showCompass: false,
      }),
      "top-right"
    )

    map.on(
      "load",
      () => {
        console.log(
          "Public RouteFlow map loaded"
        )

        setMapReady(true)
      }
    )

    map.on(
      "error",
      (event) => {
        console.error(
          "Public RouteFlow map error:",
          event.error
        )
      }
    )

    mapRef.current = map

    return () => {
      workerMarkerRef.current?.remove()

      destinationMarkerRef.current?.remove()

      workerMarkerRef.current =
        null

      destinationMarkerRef.current =
        null

      map.remove()

      mapRef.current =
        null
    }
  }, [])

  /*
   * EFFECT 3
   *
   * Create or move the worker pin.
   *
   * Blue = worker.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      trip.worker_latitude ===
        null ||
      trip.worker_longitude ===
        null
    ) {
      return
    }

    const coordinates:
      [number, number] = [
        trip.worker_longitude,
        trip.worker_latitude,
      ]

    /*
     * If the marker already exists,
     * just move it.
     */
    if (
      workerMarkerRef.current
    ) {
      workerMarkerRef.current.setLngLat(
        coordinates
      )

      return
    }

    const popup =
      new Popup({
        offset: 30,
      }).setText(
        `${trip.worker_name} · Live location`
      )

    const marker =
      new Marker({
        color: "#2563eb",
        scale: 1.2,
      })
        .setLngLat(
          coordinates
        )
        .setPopup(popup)
        .addTo(map)

    workerMarkerRef.current =
      marker
  }, [
    mapReady,
    trip,
  ])

  /*
   * EFFECT 4
   *
   * Create or move the
   * destination pin.
   *
   * Dark = customer destination.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      trip.destination_latitude ===
        null ||
      trip.destination_longitude ===
        null
    ) {
      return
    }

    const coordinates:
      [number, number] = [
        trip.destination_longitude,
        trip.destination_latitude,
      ]

    const minutes =
      route
        ? Math.max(
            1,
            Math.round(
              route.durationSeconds /
                60
            )
          )
        : null

    /*
     * Existing destination:
     * update its location and popup.
     */
    if (
      destinationMarkerRef.current
    ) {
      destinationMarkerRef.current.setLngLat(
        coordinates
      )

      const popup =
        destinationMarkerRef.current.getPopup()

      if (popup) {
        popup.setText(
          minutes !== null
            ? `Destination · ${minutes} min away`
            : "Destination"
        )
      }

      return
    }

    const popup =
      new Popup({
        offset: 30,
      }).setText(
        minutes !== null
          ? `Destination · ${minutes} min away`
          : "Destination"
      )

    const marker =
      new Marker({
        color: "#18181b",
        scale: 1.2,
      })
        .setLngLat(
          coordinates
        )
        .setPopup(popup)
        .addTo(map)

    destinationMarkerRef.current =
      marker
  }, [
    mapReady,
    route,
    trip,
  ])

  /*
   * EFFECT 5
   *
   * Calculate / refresh the road
   * route.
   *
   * GPS updates every few seconds,
   * but routing only refreshes about
   * once every thirty seconds.
   */
  useEffect(() => {
    async function updateRoute() {
      if (
        trip.trip_status !==
          "en_route" ||
        trip.worker_latitude ===
          null ||
        trip.worker_longitude ===
          null ||
        trip.destination_latitude ===
          null ||
        trip.destination_longitude ===
          null
      ) {
        return
      }

      const now =
        Date.now()

      if (
        now -
          lastRouteRequestRef.current <
        30_000
      ) {
        return
      }

      lastRouteRequestRef.current =
        now

      const params =
        new URLSearchParams({
          originLat:
            String(
              trip.worker_latitude
            ),

          originLng:
            String(
              trip.worker_longitude
            ),

          destinationLat:
            String(
              trip.destination_latitude
            ),

          destinationLng:
            String(
              trip.destination_longitude
            ),
        })

      try {
        const response =
          await fetch(
            `/api/route?${params.toString()}`
          )

        if (
          !response.ok
        ) {
          console.error(
            "Could not load public route."
          )

          return
        }

        const routeData =
        (await response.json()) as RouteApiResponse

        setRoute({
        ...routeData,
        calculatedAt: Date.now(),
        })

      } catch (error) {
        console.error(
          "Public route request failed:",
          error
        )
      }
    }

    void updateRoute()
  }, [trip])

  /*
   * EFFECT 6
   *
   * Draw or update the route line.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      !route
    ) {
      return
    }

    const sourceId =
      "public-route"

    const layerId =
      "public-route-line"

    const geoJson = {
      type:
        "Feature" as const,

      properties: {},

      geometry: {
        type:
          "LineString" as const,

        coordinates:
          route.geometry.coordinates,
      },
    }

    const existingSource =
      map.getSource(
        sourceId
      )

    /*
     * Route already drawn:
     * replace its geometry.
     */
    if (existingSource) {
      (
        existingSource as GeoJSONSource
      ).setData(
        geoJson
      )

      return
    }

    map.addSource(
      sourceId,
      {
        type: "geojson",
        data: geoJson,
      }
    )

    map.addLayer({
      id:
        layerId,

      type:
        "line",

      source:
        sourceId,

      layout: {
        "line-cap":
          "round",

        "line-join":
          "round",
      },

      paint: {
        "line-color":
          "#18181b",

        "line-width":
          5,

        "line-opacity":
          0.75,
      },
    })
  }, [
    mapReady,
    route,
  ])

  /*
   * EFFECT 7
   *
   * Automatically keep BOTH the
   * worker and destination visible.
   *
   * As the worker gets closer,
   * the bounds get smaller and
   * MapLibre naturally zooms in.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      trip.worker_latitude ===
        null ||
      trip.worker_longitude ===
        null ||
      trip.destination_latitude ===
        null ||
      trip.destination_longitude ===
        null
    ) {
      return
    }

    const bounds =
      new LngLatBounds()

    /*
     * Worker position.
     */
    bounds.extend([
      trip.worker_longitude,
      trip.worker_latitude,
    ])

    /*
     * Customer destination.
     */
    bounds.extend([
      trip.destination_longitude,
      trip.destination_latitude,
    ])

    map.fitBounds(
      bounds,
      {
        padding: {
          top: 95,
          right: 75,
          bottom: 75,
          left: 75,
        },

        maxZoom:
          16,

        duration:
          700,
      }
    )
  }, [
    mapReady,
    trip,
  ])

  /*
   * PAGE STATE:
   * TRACKING ENDED
   */

  if (ended) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Navigation className="h-5 w-5 text-zinc-600" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Tracking has ended
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            This trip is complete or
            the tracking link is no
            longer active.
          </p>
        </div>
      </main>
    )
  }

  /*
   * DERIVED DISPLAY VALUES
   */

  const minutes =
    route
      ? Math.max(
          1,
          Math.round(
            route.durationSeconds /
              60
          )
        )
      : null

  const miles =
    route
      ? (
          route.distanceMeters /
          1609.344
        ).toFixed(1)
      : null

  const arrival =
    route
        ? new Date(
            route.calculatedAt +
            route.durationSeconds *
                1000
        )
        : null

  /*
   * PAGE
   */

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="mb-6 text-center">
          <p className="text-sm font-semibold tracking-wide text-zinc-400">
            ROUTEFLOW
          </p>

          {trip.trip_status ===
          "assigned" ? (
            <>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {trip.worker_name} is
                preparing
              </h1>

              <p className="mt-2 text-zinc-500">
                Live tracking will
                begin when the trip
                starts.
              </p>
            </>
          ) : trip.trip_status ===
            "arrived" ? (
            <>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {trip.worker_name} has
                arrived
              </h1>

              <p className="mt-2 text-zinc-500">
                Your service professional
                is at the destination.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {trip.worker_name} is
                on the way
              </h1>

              {minutes !== null && (
                <div className="mt-5">
                  <p className="text-5xl font-semibold tracking-tight">
                    {minutes}
                  </p>

                  <p className="mt-1 text-sm font-medium uppercase tracking-wider text-zinc-400">
                    minutes
                  </p>
                </div>
              )}
            </>
          )}
        </header>

        {/* Map card */}
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div
            ref={
              mapContainerRef
            }
            className="h-[480px] w-full"
          />

          {/* Trip metrics */}
          {route && (
            <div className="grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100">
              <div className="p-5 text-center">
                <p className="text-xs text-zinc-500">
                  Distance
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {miles} mi
                </p>
              </div>

              <div className="p-5 text-center">
                <p className="text-xs text-zinc-500">
                  Expected arrival
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {arrival?.toLocaleTimeString(
                    [],
                    {
                      hour:
                        "numeric",

                      minute:
                        "2-digit",
                    }
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Live indicator */}
        {trip.trip_status ===
          "en_route" && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Clock3 className="h-3.5 w-3.5" />

            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            Live tracking active
          </div>
        )}
      </div>
    </main>
  )
}