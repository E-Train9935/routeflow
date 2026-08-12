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
  accuracy_meters:
    number | null
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
  Omit<
    RouteInfo,
    "calculatedAt"
  >

type RouteByWorker =
  Record<
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
  const result:
    Record<
      string,
      WorkerLocation
    > = {}

  for (
    const worker of
    workers
  ) {
    if (
      worker.status ===
        "en_route" &&
      worker.currentLocation
    ) {
      result[
        worker.id
      ] =
        worker.currentLocation
    }
  }

  return result
}

function createDestinationMarkerElement(
  minutes:
    number | null
) {
  const wrapper =
    document.createElement(
      "div"
    )

  wrapper.style.display =
    "flex"

  wrapper.style.flexDirection =
    "column"

  wrapper.style.alignItems =
    "center"

  wrapper.style.gap =
    "5px"

  const etaElement =
    document.createElement(
      "div"
    )

  etaElement.textContent =
    minutes !== null
      ? `${minutes} min`
      : "Destination"

  etaElement.style.background =
    "#18181b"

  etaElement.style.color =
    "#ffffff"

  etaElement.style.fontSize =
    "11px"

  etaElement.style.fontWeight =
    "600"

  etaElement.style.padding =
    "4px 8px"

  etaElement.style.borderRadius =
    "9999px"

  etaElement.style.whiteSpace =
    "nowrap"

  etaElement.style.boxShadow =
    "0 2px 8px rgba(0, 0, 0, 0.18)"

  const pin =
    document.createElement(
      "div"
    )

  pin.style.width =
    "18px"

  pin.style.height =
    "18px"

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

  wrapper.appendChild(
    pin
  )

  return {
    wrapper,
    etaElement,
  }
}

export function TeamMap({
  workers,
}: Props) {
  const [supabase] =
    useState(
      () =>
        createClient()
    )

  const [
    locations,
    setLocations,
  ] =
    useState<
      Record<
        string,
        WorkerLocation
      >
    >(
      () =>
        getInitialLocations(
          workers
        )
    )

  const [
    routes,
    setRoutes,
  ] =
    useState<
      RouteByWorker
    >({})

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false)

  const [
    realtimeStatus,
    setRealtimeStatus,
  ] =
    useState<
      RealtimeStatus
    >("connecting")

  const mapContainerRef =
    useRef<
      HTMLDivElement | null
    >(null)

  const mapRef =
    useRef<
      MapLibreMap | null
    >(null)

  const workerMarkersRef =
    useRef<
      Map<
        string,
        Marker
      >
    >(
      new Map()
    )

  const destinationMarkersRef =
    useRef<
      Map<
        string,
        Marker
      >
    >(
      new Map()
    )

  const destinationEtaElementsRef =
    useRef<
      Map<
        string,
        HTMLDivElement
      >
    >(
      new Map()
    )

  const lastRouteRequestRef =
    useRef<
      Record<
        string,
        number
      >
    >({})

  const initialLocationsRef =
    useRef(
      locations
    )

  /*
   * Create the map once.
   */
  useEffect(() => {
    if (
      !mapContainerRef
        .current ||
      mapRef.current
    ) {
      return
    }

    const initialLocations =
      Object.values(
        initialLocationsRef
          .current
      )

    const firstLocation =
      initialLocations[0]

    const map =
      new MapLibreMap({
        container:
          mapContainerRef
            .current,

        style:
          "https://tiles.openfreemap.org/styles/positron",

        center:
          firstLocation
            ? [
                firstLocation
                  .longitude,

                firstLocation
                  .latitude,
              ]
            : [
                -117.1611,
                32.7157,
              ],

        zoom:
          firstLocation
            ? 12
            : 10,

        attributionControl:
          {},
      })

    map.addControl(
      new NavigationControl({
        showCompass:
          false,
      }),
      "top-right"
    )

    map.on(
      "load",
      () => {
        setMapReady(
          true
        )
      }
    )

    map.on(
      "error",
      (event) => {
        console.error(
          "RouteFlow map error:",
          event.error
        )
      }
    )

    mapRef.current =
      map

    const workerMarkers =
      workerMarkersRef
        .current

    const destinationMarkers =
      destinationMarkersRef
        .current

    const destinationEtaElements =
      destinationEtaElementsRef
        .current

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

      mapRef.current =
        null
    }
  }, [])

  /*
   * Create / move worker markers.
   */
  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    const workerById =
      new Map(
        workers.map(
          (worker) => [
            worker.id,
            worker,
          ]
        )
      )

    const activeWorkerIds =
      new Set(
        workers
          .filter(
            (worker) =>
              worker.status ===
                "en_route" &&
              Boolean(
                locations[
                  worker.id
                ]
              )
          )
          .map(
            (worker) =>
              worker.id
          )
      )

    /*
     * Remove markers for workers
     * who are no longer travelling.
     */
    for (
      const [
        workerId,
        marker,
      ] of
      workerMarkersRef
        .current
    ) {
      if (
        !activeWorkerIds.has(
          workerId
        )
      ) {
        marker.remove()

        workerMarkersRef
          .current
          .delete(
            workerId
          )
      }
    }

    /*
     * Create or move live
     * worker markers.
     */
    for (
      const workerId of
      activeWorkerIds
    ) {
      const worker =
        workerById.get(
          workerId
        )

      const location =
        locations[
          workerId
        ]

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
        workerMarkersRef
          .current
          .get(
            workerId
          )

      if (
        existingMarker
      ) {
        existingMarker
          .setLngLat(
            coordinates
          )

        continue
      }

      const popup =
        new Popup({
          offset: 25,
        })
          .setText(
            worker.name
          )

      const marker =
        new Marker({
          color:
            "#2563eb",

          scale:
            1.05,
        })
          .setLngLat(
            coordinates
          )
          .setPopup(
            popup
          )
          .addTo(
            map
          )

      workerMarkersRef
        .current
        .set(
          workerId,
          marker
        )
    }
  }, [
    locations,
    workers,
  ])

  /*
   * Subscribe to worker GPS.
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

            schema:
              "public",

            table:
              "current_locations",
          },
          (
            payload
          ) => {
            /*
             * DELETE events have no
             * new location row.
             */
            if (
              payload.eventType ===
              "DELETE"
            ) {
              const oldRow =
                payload.old as
                  | {
                      worker_id?:
                        string
                    }
                  | undefined

              if (
                !oldRow
                  ?.worker_id
              ) {
                return
              }

              setLocations(
                (
                  current
                ) => {
                  const next =
                    {
                      ...current,
                    }

                  delete next[
                    oldRow.worker_id!
                  ]

                  return next
                }
              )

              return
            }

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
              (
                current
              ) => ({
                ...current,

                [
                  row.worker_id
                ]: {
                  latitude:
                    row.latitude,

                  longitude:
                    row.longitude,

                  accuracyMeters:
                    row
                      .accuracy_meters,

                  updatedAt:
                    row.updated_at,
                },
              })
            )
          }
        )
        .subscribe(
          (
            status
          ) => {
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
      void supabase
        .removeChannel(
          channel
        )
    }
  }, [
    supabase,
  ])

  /*
   * Fetch OSRM route data.
   *
   * GPS may update much more
   * frequently, but routing is
   * throttled to roughly every
   * 30 seconds per worker.
   */
  useEffect(() => {
    async function updateRoutes() {
      const now =
        Date.now()

      for (
        const worker of
        workers
      ) {
        if (
          worker.status !==
          "en_route"
        ) {
          continue
        }

        const location =
          locations[
            worker.id
          ]

        const trip =
          worker.activeTrip

        if (
          !location ||
          !trip ||
          trip
            .destinationLatitude ===
            null ||
          trip
            .destinationLongitude ===
            null
        ) {
          continue
        }

        const lastRequest =
          lastRouteRequestRef
            .current[
            worker.id
          ] ?? 0

        if (
          now -
            lastRequest <
          30_000
        ) {
          continue
        }

        lastRouteRequestRef
          .current[
          worker.id
        ] =
          now

        const params =
          new URLSearchParams({
            originLat:
              String(
                location.latitude
              ),

            originLng:
              String(
                location.longitude
              ),

            destinationLat:
              String(
                trip.destinationLatitude
              ),

            destinationLng:
              String(
                trip.destinationLongitude
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
              `Could not route ${worker.name}`
            )

            continue
          }

          const routeData =
            (
              await response
                .json()
            ) as
              RouteApiResponse

          const route:
            RouteInfo = {
            ...routeData,

            calculatedAt:
              Date.now(),
          }

          setRoutes(
            (
              current
            ) => ({
              ...current,

              [
                worker.id
              ]:
                route,
            })
          )
        } catch (
          error
        ) {
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
   * Draw route lines.
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
      const worker of
      workers
    ) {
      const sourceId =
        `route-${worker.id}`

      const layerId =
        `route-line-${worker.id}`

      const route =
        routes[
          worker.id
        ]

      if (
        worker.status !==
          "en_route" ||
        !route
      ) {
        if (
          map.getLayer(
            layerId
          )
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

        properties:
          {},

        geometry: {
          type:
            "LineString" as const,

          coordinates:
            route
              .geometry
              .coordinates,
        },
      }

      const existingSource =
        map.getSource(
          sourceId
        )

      if (
        existingSource
      ) {
        (
          existingSource as
            GeoJSONSource
        ).setData(
          geoJson
        )

        continue
      }

      map.addSource(
        sourceId,
        {
          type:
            "geojson",

          data:
            geoJson,
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
          "line-width":
            5,

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
   * Destination markers and
   * their ETA pills.
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
      const worker of
      workers
    ) {
      const trip =
        worker.activeTrip

      const route =
        routes[
          worker.id
        ]

      if (
        worker.status !==
          "en_route" ||
        !trip ||
        trip
          .destinationLatitude ===
          null ||
        trip
          .destinationLongitude ===
          null
      ) {
        continue
      }

      neededWorkerIds.add(
        worker.id
      )

      const coordinates:
        [number, number] = [
          trip
            .destinationLongitude,

          trip
            .destinationLatitude,
        ]

      const minutes =
        route
          ? Math.max(
              1,
              Math.round(
                route
                  .durationSeconds /
                  60
              )
            )
          : null

      const existingMarker =
        destinationMarkersRef
          .current
          .get(
            worker.id
          )

      if (
        existingMarker
      ) {
        existingMarker
          .setLngLat(
            coordinates
          )

        const etaElement =
          destinationEtaElementsRef
            .current
            .get(
              worker.id
            )

        if (
          etaElement
        ) {
          etaElement.textContent =
            minutes !==
            null
              ? `${minutes} min`
              : "Destination"
        }

        const popup =
          existingMarker
            .getPopup()

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
        })
          .setText(
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
          .setPopup(
            popup
          )
          .addTo(
            map
          )

      destinationMarkersRef
        .current
        .set(
          worker.id,
          marker
        )

      destinationEtaElementsRef
        .current
        .set(
          worker.id,
          etaElement
        )
    }

    /*
     * Remove old destinations.
     */
    for (
      const [
        workerId,
        marker,
      ] of
      destinationMarkersRef
        .current
    ) {
      if (
        !neededWorkerIds.has(
          workerId
        )
      ) {
        marker.remove()

        destinationMarkersRef
          .current
          .delete(
            workerId
          )

        destinationEtaElementsRef
          .current
          .delete(
            workerId
          )
      }
    }
  }, [
    routes,
    workers,
  ])

  /*
   * Fit the active worker and
   * destination into the map.
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

    const worker =
      workers.find(
        (
          candidate
        ) => {
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
            Boolean(
              trip
            ) &&
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
      locations[
        worker.id
      ]

    const trip =
      worker.activeTrip

    if (
      !location ||
      trip
        .destinationLatitude ===
        null ||
      trip
        .destinationLongitude ===
        null
    ) {
      return
    }

    const bounds =
      new LngLatBounds()

    bounds.extend([
      location.longitude,
      location.latitude,
    ])

    bounds.extend([
      trip
        .destinationLongitude,

      trip
        .destinationLatitude,
    ])

    /*
     * Use tighter framing on
     * phones so route endpoints
     * remain visible without
     * wasting map space.
     */
    const mapWidth =
      mapContainerRef
        .current
        ?.clientWidth ??
      1000

    const mobile =
      mapWidth < 640

    map.fitBounds(
      bounds,
      {
        padding:
          mobile
            ? {
                top:
                  65,

                right:
                  45,

                bottom:
                  55,

                left:
                  45,
              }
            : {
                top:
                  110,

                right:
                  90,

                bottom:
                  90,

                left:
                  90,
              },

        maxZoom:
          mobile
            ? 15
            : 16,

        duration:
          700,
      }
    )
  }, [
    locations,
    mapReady,
    workers,
  ])

  const liveWorkers =
    workers.filter(
      (worker) =>
        worker.status ===
          "en_route" &&
        Boolean(
          locations[
            worker.id
          ]
        )
    )

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LocateFixed className="h-4 w-4 shrink-0 text-zinc-500" />

            <h2 className="font-semibold">
              Live operations
            </h2>
          </div>

          <p className="mt-1 text-sm leading-5 text-zinc-500">
            Current locations from
            workers sharing their
            GPS.
          </p>
        </div>

        {realtimeStatus ===
        "connected" ? (
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <Radio className="h-3.5 w-3.5" />

            Realtime connected
          </div>
        ) : realtimeStatus ===
          "error" ? (
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />

            Realtime unavailable
          </div>
        ) : (
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />

            Connecting
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative min-w-0 overflow-hidden">
        <div
          ref={
            mapContainerRef
          }
          className="h-[300px] w-full sm:h-[380px] lg:h-[440px]"
        />

        {liveWorkers.length ===
          0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-[280px] rounded-2xl bg-white/95 px-4 py-4 text-center shadow-lg ring-1 ring-zinc-200 sm:max-w-xs sm:px-5">
              <p className="font-medium text-zinc-900">
                Waiting for a live
                worker
              </p>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Start a worker&apos;s
                trip and allow
                location access to
                see them here.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Live worker summaries */}
      {liveWorkers.length >
        0 && (
        <div className="grid min-w-0 gap-3 border-t border-zinc-100 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {liveWorkers.map(
            (
              worker
            ) => {
              const location =
                locations[
                  worker.id
                ]

              const route =
                routes[
                  worker.id
                ]

              const minutes =
                route
                  ? Math.max(
                      1,
                      Math.round(
                        route
                          .durationSeconds /
                          60
                      )
                    )
                  : null

              const miles =
                route
                  ? (
                      route
                        .distanceMeters /
                      1609.344
                    ).toFixed(
                      1
                    )
                  : null

              const arrival =
                route
                  ? new Date(
                      route
                        .calculatedAt +
                        route
                          .durationSeconds *
                          1000
                    )
                  : null

              return (
                <div
                  key={
                    worker.id
                  }
                  className="min-w-0 overflow-hidden rounded-2xl bg-zinc-50 p-4 sm:px-5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-zinc-950">
                          {
                            worker.name
                          }
                        </p>

                        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />

                          Live
                        </div>
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-500">
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

                    {route && (
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                          {minutes} min
                        </p>

                        <p className="text-[11px] text-zinc-500">
                          ETA
                        </p>
                      </div>
                    )}
                  </div>

                  {worker
                    .activeTrip && (
                    <div className="mt-3 min-w-0 rounded-xl bg-white px-3 py-2.5 ring-1 ring-zinc-200">
                      <p className="truncate text-xs font-medium text-zinc-700">
                        {
                          worker
                            .activeTrip
                            .customerName
                        }
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">
                        {
                          worker
                            .activeTrip
                            .destination
                        }
                      </p>
                    </div>
                  )}

                  {route && (
                    <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-xs sm:text-sm">
                      <span className="shrink-0 font-medium text-zinc-700">
                        {miles} mi away
                      </span>

                      <span className="min-w-0 truncate text-right text-zinc-500">
                        Arrive{" "}
                        {arrival
                          ?.toLocaleTimeString(
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