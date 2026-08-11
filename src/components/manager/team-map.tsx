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
  LocateFixed,
  Radio,
} from "lucide-react"

import {
  createClient,
} from "@/lib/supabase/client"

import type {
  WorkerCardData,
  WorkerLocation,
} from "@/types/operations"

type Props = {
  workers: WorkerCardData[]
}

type RealtimeLocationRow = {
  worker_id: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  updated_at: string
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

type RouteByWorker = Record<
  string,
  RouteInfo
>

type RealtimeStatus =
  | "connecting"
  | "connected"
  | "error"

function getInitialLocations(
  workers: WorkerCardData[]
) {
  const result: Record<
    string,
    WorkerLocation
  > = {}

  for (const worker of workers) {
    if (
      worker.status === "en_route" &&
      worker.currentLocation
    ) {
      result[worker.id] =
        worker.currentLocation
    }
  }

  return result
}

function createDestinationMarkerElement(
  minutes: number | null
) {
  const wrapper =
    document.createElement("div")

  wrapper.style.display = "flex"
  wrapper.style.flexDirection = "column"
  wrapper.style.alignItems = "center"
  wrapper.style.gap = "5px"

  const etaElement =
    document.createElement("div")

  etaElement.textContent =
    minutes !== null
      ? `${minutes} min`
      : "Destination"

  etaElement.style.background =
    "#18181b"

  etaElement.style.color =
    "#ffffff"

  etaElement.style.fontSize =
    "12px"

  etaElement.style.fontWeight =
    "600"

  etaElement.style.padding =
    "5px 9px"

  etaElement.style.borderRadius =
    "9999px"

  etaElement.style.whiteSpace =
    "nowrap"

  etaElement.style.boxShadow =
    "0 2px 8px rgba(0, 0, 0, 0.18)"

  const pin =
    document.createElement("div")

  pin.style.width = "20px"
  pin.style.height = "20px"

  pin.style.borderRadius =
    "50% 50% 50% 0"

  pin.style.background =
    "#18181b"

  pin.style.transform =
    "rotate(-45deg)"

  pin.style.border =
    "3px solid white"

  pin.style.boxShadow =
    "0 2px 6px rgba(0, 0, 0, 0.25)"

  wrapper.appendChild(
    etaElement
  )

  wrapper.appendChild(pin)

  return {
    wrapper,
    etaElement,
  }
}

export function TeamMap({
  workers,
}: Props) {
  /*
   * STATE
   */

  const [supabase] =
    useState(() => createClient())

  const [locations, setLocations] =
    useState<
      Record<string, WorkerLocation>
    >(() =>
      getInitialLocations(workers)
    )

  const [routes, setRoutes] =
    useState<RouteByWorker>({})

  const [mapReady, setMapReady] =
    useState(false)

  const [
    realtimeStatus,
    setRealtimeStatus,
  ] = useState<RealtimeStatus>(
    "connecting"
  )

  /*
   * REFS
   */

  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const mapRef =
    useRef<MapLibreMap | null>(
      null
    )

  const workerMarkersRef =
    useRef<Map<string, Marker>>(
      new Map()
    )

  const destinationMarkersRef =
    useRef<Map<string, Marker>>(
      new Map()
    )

  const destinationEtaElementsRef =
    useRef<
      Map<string, HTMLDivElement>
    >(new Map())

  const lastRouteRequestRef =
    useRef<Record<string, number>>(
      {}
    )

  const initialLocationsRef =
    useRef(locations)

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

    const initialLocations =
      Object.values(
        initialLocationsRef.current
      )

    const firstLocation =
      initialLocations[0]

    const map =
      new MapLibreMap({
        container:
          mapContainerRef.current,

        style:
          "https://tiles.openfreemap.org/styles/positron",

        center: firstLocation
          ? [
              firstLocation.longitude,
              firstLocation.latitude,
            ]
          : [
              -117.1611,
              32.7157,
            ],

        zoom: firstLocation
          ? 12
          : 10,

        attributionControl: {},
      })

    map.addControl(
      new NavigationControl({
        showCompass: false,
      }),
      "top-right"
    )

    map.on("load", () => {
      console.log(
        "RouteFlow map loaded successfully"
      )

      setMapReady(true)
    })

    map.on(
      "error",
      (event) => {
        console.error(
          "RouteFlow map error:",
          event.error
        )
      }
    )

    mapRef.current = map

        const workerMarkers =
      workerMarkersRef.current

    const destinationMarkers =
      destinationMarkersRef.current

    const destinationEtaElements =
      destinationEtaElementsRef.current

    return () => {
      for (
        const marker of
        workerMarkers.values()
      ) {
        marker.remove()
      }

      workerMarkers.clear()

      for (
        const marker of
        destinationMarkers.values()
      ) {
        marker.remove()
      }

      destinationMarkers.clear()

      destinationEtaElements.clear()

      map.remove()

      mapRef.current = null
    }
  }, [])

  /*
   * EFFECT 3
   *
   * Create and move worker markers.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    const workerById =
      new Map(
        workers.map((worker) => [
          worker.id,
          worker,
        ])
      )

    /*
     * Only workers who are actively
     * en route should appear as live
     * markers.
     */
    const activeWorkerIds =
      new Set(
        workers
          .filter(
            (worker) =>
              worker.status ===
                "en_route" &&
              locations[worker.id]
          )
          .map(
            (worker) =>
              worker.id
          )
      )

    /*
     * Remove obsolete markers.
     */
    for (
      const [
        workerId,
        marker,
      ] of workerMarkersRef.current
    ) {
      if (
        !activeWorkerIds.has(
          workerId
        )
      ) {
        marker.remove()

        workerMarkersRef.current.delete(
          workerId
        )
      }
    }

    /*
     * Create or move current
     * worker markers.
     */
    for (
      const workerId of
      activeWorkerIds
    ) {
      const worker =
        workerById.get(workerId)

      const location =
        locations[workerId]

      if (
        !worker ||
        !location
      ) {
        continue
      }

      const coordinates:
        [number, number] = [
          location.longitude,
          location.latitude,
        ]

      const existingMarker =
        workerMarkersRef.current.get(
          workerId
        )

      if (existingMarker) {
        existingMarker.setLngLat(
          coordinates
        )

        continue
      }

      const popup =
        new Popup({
          offset: 25,
        }).setText(worker.name)

      const marker =
        new Marker()
          .setLngLat(
            coordinates
          )
          .setPopup(popup)
          .addTo(map)

      workerMarkersRef.current.set(
        workerId,
        marker
      )
    }
  }, [
    locations,
    workers,
  ])

  /*
   * EFFECT 4
   *
   * Subscribe to worker GPS updates
   * through Supabase Realtime.
   */
  useEffect(() => {
    const channel =
      supabase
        .channel(
          "manager-live-locations"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "current_locations",
          },
          (payload) => {
            const row =
              payload.new as
                | RealtimeLocationRow
                | undefined

            if (
              !row ||
              !row.worker_id
            ) {
              return
            }

            setLocations(
              (current) => ({
                ...current,

                [row.worker_id]: {
                  latitude:
                    row.latitude,

                  longitude:
                    row.longitude,

                  accuracyMeters:
                    row.accuracy_meters,

                  updatedAt:
                    row.updated_at,
                },
              })
            )
          }
        )
        .subscribe(
          (status) => {
            if (
              status ===
              "SUBSCRIBED"
            ) {
              setRealtimeStatus(
                "connected"
              )

              return
            }

            if (
              status ===
                "CHANNEL_ERROR" ||
              status ===
                "TIMED_OUT"
            ) {
              setRealtimeStatus(
                "error"
              )
            }
          }
        )

    return () => {
      void supabase.removeChannel(
        channel
      )
    }
  }, [supabase])

    /*
   * EFFECT 5
   *
   * Request road routes.
   *
   * GPS can update every few
   * seconds, but routing is limited
   * to approximately once every
   * 30 seconds per driver.
   */
  useEffect(() => {
    async function updateRoutes() {
      const now = Date.now()

      for (const worker of workers) {
        if (worker.status !== "en_route") {
          continue
        }

        const location =
          locations[worker.id]

        const trip =
          worker.activeTrip

        if (
          !location ||
          !trip ||
          trip.destinationLatitude === null ||
          trip.destinationLongitude === null
        ) {
          continue
        }

        const lastRequest =
          lastRouteRequestRef.current[
            worker.id
          ] ?? 0

        if (
          now - lastRequest <
          30_000
        ) {
          continue
        }

        lastRouteRequestRef.current[
          worker.id
        ] = now

        const params =
          new URLSearchParams({
            originLat: String(
              location.latitude
            ),

            originLng: String(
              location.longitude
            ),

            destinationLat: String(
              trip.destinationLatitude
            ),

            destinationLng: String(
              trip.destinationLongitude
            ),
          })

        try {
          const response =
            await fetch(
              `/api/route?${params.toString()}`
            )

          if (!response.ok) {
            console.error(
              `Could not route ${worker.name}`
            )

            continue
          }

          const routeData =
            (await response.json()) as RouteApiResponse

          const route: RouteInfo = {
            ...routeData,
            calculatedAt: Date.now(),
          }

          setRoutes(
            (current) => ({
              ...current,
              [worker.id]: route,
            })
          )
        } catch (error) {
          console.error(
            "Route request failed:",
            error
          )
        }
      }
    }

    void updateRoutes()
  }, [
    locations,
    workers,
  ])

  /*
   * EFFECT 6
   *
   * Draw or update road route
   * lines on the map.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady
    ) {
      return
    }

    for (
      const worker of workers
    ) {
      const sourceId =
        `route-${worker.id}`

      const layerId =
        `route-line-${worker.id}`

      const route =
        routes[worker.id]

      /*
       * Remove route graphics when
       * the worker is no longer
       * actively travelling.
       */
      if (
        worker.status !==
          "en_route" ||
        !route
      ) {
        if (
          map.getLayer(layerId)
        ) {
          map.removeLayer(
            layerId
          )
        }

        if (
          map.getSource(
            sourceId
          )
        ) {
          map.removeSource(
            sourceId
          )
        }

        continue
      }

      const geoJson = {
        type:
          "Feature" as const,

        properties: {},

        geometry: {
          type:
            "LineString" as const,

          coordinates:
            route.geometry
              .coordinates,
        },
      }

      const existingSource =
        map.getSource(
          sourceId
        )

      if (existingSource) {
        (
          existingSource as GeoJSONSource
        ).setData(geoJson)

        continue
      }

      map.addSource(
        sourceId,
        {
          type: "geojson",
          data: geoJson,
        }
      )

      map.addLayer({
        id: layerId,

        type: "line",

        source: sourceId,

        layout: {
          "line-cap":
            "round",

          "line-join":
            "round",
        },

        paint: {
          "line-width": 5,

          "line-opacity":
            0.75,

          "line-color":
            "#18181b",
        },
      })
    }
  }, [
    mapReady,
    routes,
    workers,
  ])

  /*
   * EFFECT 7
   *
   * Create destination markers.
   *
   * Each destination marker has
   * the current ETA displayed
   * directly above it.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    const neededWorkerIds =
      new Set<string>()

    for (
      const worker of workers
    ) {
      const trip =
        worker.activeTrip

      const route =
        routes[worker.id]

      if (
        worker.status !==
          "en_route" ||
        !trip ||
        trip.destinationLatitude ===
          null ||
        trip.destinationLongitude ===
          null
      ) {
        continue
      }

      neededWorkerIds.add(
        worker.id
      )

      const coordinates:
        [number, number] = [
          trip.destinationLongitude,
          trip.destinationLatitude,
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

      const existingMarker =
        destinationMarkersRef.current.get(
          worker.id
        )

      if (existingMarker) {
        existingMarker.setLngLat(
          coordinates
        )

        const etaElement =
          destinationEtaElementsRef.current.get(
            worker.id
          )

        if (etaElement) {
          etaElement.textContent =
            minutes !== null
              ? `${minutes} min`
              : "Destination"
        }

        const popup =
          existingMarker.getPopup()

        if (popup) {
          popup.setText(
            `${trip.customerName} · ${trip.destination}`
          )
        }

        continue
      }

      const {
        wrapper,
        etaElement,
      } =
        createDestinationMarkerElement(
          minutes
        )

      const popup =
        new Popup({
          offset: 30,
        }).setText(
          `${trip.customerName} · ${trip.destination}`
        )

      const marker =
        new Marker({
          element:
            wrapper,

          anchor:
            "bottom",
        })
          .setLngLat(
            coordinates
          )
          .setPopup(popup)
          .addTo(map)

      destinationMarkersRef.current.set(
        worker.id,
        marker
      )

      destinationEtaElementsRef.current.set(
        worker.id,
        etaElement
      )
    }

    /*
     * Remove destinations that are
     * no longer active.
     */
    for (
      const [
        workerId,
        marker,
      ] of destinationMarkersRef.current
    ) {
      if (
        !neededWorkerIds.has(
          workerId
        )
      ) {
        marker.remove()

        destinationMarkersRef.current.delete(
          workerId
        )

        destinationEtaElementsRef.current.delete(
          workerId
        )
      }
    }
  }, [
    routes,
    workers,
  ])

  /*
   * EFFECT 8
   *
   * Automatically frame both
   * driver and destination.
   *
   * As the driver approaches the
   * destination, the geographic
   * bounds shrink, causing MapLibre
   * to zoom in automatically.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady
    ) {
      return
    }

    /*
     * For V1, follow the first
     * active en-route worker.
     *
     * Later this will use whichever
     * worker the manager selects.
     */
    const worker =
      workers.find(
        (candidate) => {
          const trip =
            candidate.activeTrip

          return (
            candidate.status ===
              "en_route" &&
            Boolean(
              locations[
                candidate.id
              ]
            ) &&
            Boolean(trip) &&
            trip
              ?.destinationLatitude !==
              null &&
            trip
              ?.destinationLongitude !==
              null
          )
        }
      )

    if (
      !worker ||
      !worker.activeTrip
    ) {
      return
    }

    const location =
      locations[worker.id]

    const trip =
      worker.activeTrip

    if (
      !location ||
      trip.destinationLatitude ===
        null ||
      trip.destinationLongitude ===
        null
    ) {
      return
    }

    const bounds =
      new LngLatBounds()

    /*
     * Driver
     */
    bounds.extend([
      location.longitude,
      location.latitude,
    ])

    /*
     * Destination
     */
    bounds.extend([
      trip.destinationLongitude,
      trip.destinationLatitude,
    ])

    map.fitBounds(
      bounds,
      {
        padding: {
          top: 110,
          right: 90,
          bottom: 90,
          left: 90,
        },

        maxZoom: 16,

        duration: 700,
      }
    )
  }, [
    locations,
    mapReady,
    workers,
  ])

  /*
   * RENDER DATA
   */

  const liveWorkers =
    workers.filter(
      (worker) =>
        worker.status ===
          "en_route" &&
        Boolean(
          locations[worker.id]
        )
    )

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LocateFixed className="h-4 w-4 text-zinc-500" />

            <h2 className="font-semibold">
              Live operations
            </h2>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            Current locations from workers
            sharing their GPS.
          </p>
        </div>

        {realtimeStatus ===
        "connected" ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <Radio className="h-3.5 w-3.5" />

            Realtime connected
          </div>
        ) : realtimeStatus ===
          "error" ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />

            Realtime unavailable
          </div>
        ) : (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />

            Connecting
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="h-[440px] w-full"
        />

        {liveWorkers.length ===
          0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-white/95 px-5 py-4 text-center shadow-lg ring-1 ring-zinc-200">
              <p className="font-medium text-zinc-900">
                Waiting for a live
                worker
              </p>

              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                Start a worker&apos;s
                trip and allow location
                access to see them here.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Worker summary cards */}
      {liveWorkers.length >
        0 && (
        <div className="grid gap-3 border-t border-zinc-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveWorkers.map(
            (worker) => {
              const location =
                locations[worker.id]

              const route =
                routes[worker.id]

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

              return (
                <div
                  key={worker.id}
                  className="rounded-2xl bg-zinc-50 px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-6">
                    {/* Driver identity */}
                    <div>
                      <p className="font-medium text-zinc-950">
                        {worker.name}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {location
                          .accuracyMeters !==
                        null
                          ? `Accuracy ±${Math.round(
                              location
                                .accuracyMeters
                            )} m`
                          : "Location active"}
                      </p>
                    </div>

                    {/* ETA + Live */}
                    {route ? (
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <p className="text-2xl font-semibold tracking-tight text-zinc-950">
                            {minutes} min
                          </p>

                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />

                            Live
                          </div>
                        </div>

                        <p className="mt-1 text-xs text-zinc-500">
                          ETA
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />

                        Live
                      </div>
                    )}
                  </div>

                  {/* Distance + arrival */}
                  {route && (
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm">
                      <span className="font-medium text-zinc-700">
                        {miles} mi away
                      </span>

                      <span className="text-zinc-500">
                        Arrive{" "}
                        {arrival?.toLocaleTimeString(
                          [],
                          {
                            hour:
                              "numeric",

                            minute:
                              "2-digit",
                          }
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            }
          )}
        </div>
      )}
    </section>
  )
}