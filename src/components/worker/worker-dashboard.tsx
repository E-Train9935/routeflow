"use client"

import {
  useEffect,
  useState,
} from "react"

import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  Navigation,
  Radio,
  Route,
  WifiOff,
} from "lucide-react"

import {
  arriveTrip,
  completeTrip,
  startTrip,
} from "@/app/worker/actions"

import {
  LocationTracker,
} from "@/components/worker/location-tracker"

import {
  createClient,
} from "@/lib/supabase/client"

export type WorkerTripRow = {
  id: string

  customer_name: string

  destination_address:
    string

  status:
    | "assigned"
    | "en_route"
    | "arrived"

  created_at: string

  route_position:
    number | null
}

type Props = {
  workerId: string
  workerName: string

  initialTrips:
    WorkerTripRow[]
}

type RealtimeStatus =
  | "connecting"
  | "connected"
  | "error"

export function WorkerDashboard({
  workerId,
  workerName,
  initialTrips,
}: Props) {
  const [supabase] =
    useState(
      () =>
        createClient()
    )

  const [
    trips,
    setTrips,
  ] =
    useState<
      WorkerTripRow[]
    >(initialTrips)

  const [
    realtimeStatus,
    setRealtimeStatus,
  ] =
    useState<
      RealtimeStatus
    >("connecting")

  /*
   * Realtime assignment and
   * route-order updates.
   */
  useEffect(() => {
    let mounted = true
    let latestRequest = 0

    async function refreshTrips() {
      const requestNumber =
        ++latestRequest

      const {
        data,
        error,
      } =
        await supabase
          .from("trips")
          .select(
            `
              id,
              customer_name,
              destination_address,
              status,
              created_at,
              route_position
            `
          )
          .eq(
            "worker_id",
            workerId
          )
          .in(
            "status",
            [
              "assigned",
              "en_route",
              "arrived",
            ]
          )
          .order(
            "route_position",
            {
              ascending:
                true,

              nullsFirst:
                false,
            }
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            }
          )
          .order(
            "id",
            {
              ascending:
                true,
            }
          )

      if (
        !mounted ||
        requestNumber !==
          latestRequest
      ) {
        return
      }

      if (error) {
        console.error(
          "Could not refresh worker trips:",
          error
        )

        return
      }

      setTrips(
        (
          data ?? []
        ) as WorkerTripRow[]
      )
    }

    const channel =
      supabase
        .channel(
          `worker-trips-${workerId}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "trips",

            filter:
              `worker_id=eq.${workerId}`,
          },
          () => {
            void refreshTrips()
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

              /*
               * Close the small gap
               * between server render
               * and realtime subscribe.
               */
              void refreshTrips()

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
      mounted = false

      void supabase.removeChannel(
        channel
      )
    }
  }, [
    supabase,
    workerId,
  ])

  /*
   * At most one job may be
   * en_route/arrived.
   */
  const activeJourney =
    trips.find(
      (trip) =>
        trip.status ===
          "en_route" ||
        trip.status ===
          "arrived"
    )

  /*
   * Otherwise the first assigned
   * job becomes Up Next.
   */
  const firstAssigned =
    trips.find(
      (trip) =>
        trip.status ===
        "assigned"
    )

  const currentTrip =
    activeJourney ??
    firstAssigned

  const queuedTrips =
    trips.filter(
      (trip) =>
        trip.status ===
          "assigned" &&
        trip.id !==
          currentTrip?.id
    )

  const firstName =
    workerName
      .split(" ")
      .filter(Boolean)[0] ??
    workerName

  const navigationUrl =
    currentTrip
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          currentTrip.destination_address
        )}`
      : null

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-zinc-50 text-zinc-950"
      style={{
        paddingBottom:
          currentTrip
            ? "calc(7.5rem + env(safe-area-inset-bottom))"
            : undefined,
      }}
    >
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Navigation className="h-4 w-4" />
            </div>

            <span className="truncate font-semibold tracking-tight">
              RouteFlow
            </span>
          </div>

          <RealtimeBadge
            status={
              realtimeStatus
            }
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 py-5 sm:px-5 sm:py-8">
        <section>
          <p className="text-sm font-medium text-zinc-500">
            Good morning,{" "}
            {firstName}
          </p>

          <div className="mt-1 flex items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              Your route
            </h1>

            {trips.length >
              0 && (
              <span className="shrink-0 pb-1 text-sm font-medium text-zinc-500">
                {trips.length}{" "}
                {trips.length ===
                1
                  ? "stop"
                  : "stops"}
              </span>
            )}
          </div>
        </section>

        {!currentTrip ? (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Route complete
            </h2>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">
              You have no active
              assignments. New jobs
              will appear here
              automatically.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              Ready for assignment
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {currentTrip.status ===
                  "assigned"
                    ? "Up next"
                    : "Current stop"}
                </p>

                <TripStatus
                  status={
                    currentTrip.status
                  }
                />
              </div>

              <article className="min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
                <div className="p-5 sm:p-6">
                  <p className="text-sm text-zinc-500">
                    Customer
                  </p>

                  <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight">
                    {
                      currentTrip
                        .customer_name
                    }
                  </h2>

                  <div className="mt-5 flex min-w-0 items-start gap-3 rounded-2xl bg-zinc-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-zinc-200">
                      <MapPin className="h-4 w-4 text-zinc-600" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Destination
                      </p>

                      <p className="mt-1 break-words text-sm leading-5 text-zinc-700">
                        {
                          currentTrip
                            .destination_address
                        }
                      </p>
                    </div>
                  </div>

                  {navigationUrl && (
                    <a
                      href={
                        navigationUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition active:scale-[0.99] active:bg-zinc-50"
                    >
                      <Navigation className="h-4 w-4" />

                      Open in Maps

                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                    </a>
                  )}
                </div>

                <CurrentTripMessage
                  status={
                    currentTrip.status
                  }
                />
              </article>
            </section>

            {currentTrip.status ===
              "en_route" && (
              <section className="mt-4">
                <LocationTracker />
              </section>
            )}

            {queuedTrips.length >
              0 && (
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-zinc-500" />

                    <h2 className="font-semibold">
                      Next stops
                    </h2>
                  </div>

                  <span className="text-sm text-zinc-500">
                    {
                      queuedTrips.length
                    }{" "}
                    remaining
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  {queuedTrips.map(
                    (
                      trip,
                      index
                    ) => (
                      <QueuedStop
                        key={
                          trip.id
                        }
                        trip={
                          trip
                        }
                        number={
                          index +
                          2
                        }
                        last={
                          index ===
                          queuedTrips.length -
                            1
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {currentTrip && (
        <WorkerActionBar
          trip={
            currentTrip
          }
        />
      )}
    </main>
  )
}

function RealtimeBadge({
  status,
}: {
  status:
    RealtimeStatus
}) {
  if (
    status ===
    "connected"
  ) {
    return (
      <div
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />

        Live
      </div>
    )
  }

  if (
    status === "error"
  ) {
    return (
      <div
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700"
      >
        <WifiOff className="h-3.5 w-3.5" />

        Offline
      </div>
    )
  }

  return (
    <div
      aria-live="polite"
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-500"
    >
      <Radio className="h-3 w-3 animate-pulse" />

      Connecting
    </div>
  )
}

function TripStatus({
  status,
}: {
  status:
    WorkerTripRow["status"]
}) {
  if (
    status ===
    "en_route"
  ) {
    return (
      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        En route
      </span>
    )
  }

  if (
    status ===
    "arrived"
  ) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Arrived
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
      Assigned
    </span>
  )
}

function CurrentTripMessage({
  status,
}: {
  status:
    WorkerTripRow["status"]
}) {
  if (
    status ===
    "assigned"
  ) {
    return (
      <div className="border-t border-violet-100 bg-violet-50 px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-violet-900">
          Ready when you are
        </p>

        <p className="mt-1 text-sm leading-5 text-violet-700">
          Starting this stop begins
          live location sharing.
        </p>
      </div>
    )
  }

  if (
    status ===
    "en_route"
  ) {
    return (
      <div className="border-t border-blue-100 bg-blue-50 px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-blue-900">
          Location sharing active
        </p>

        <p className="mt-1 text-sm leading-5 text-blue-700">
          Keep RouteFlow open while
          traveling to this customer.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

        <div>
          <p className="text-sm font-medium text-emerald-900">
            Arrival confirmed
          </p>

          <p className="mt-1 text-sm leading-5 text-emerald-700">
            GPS sharing has stopped.
            Complete the job when
            finished.
          </p>
        </div>
      </div>
    </div>
  )
}

function QueuedStop({
  trip,
  number,
  last,
}: {
  trip: WorkerTripRow
  number: number
  last: boolean
}) {
  const navigationUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      trip.destination_address
    )}`

  return (
    <a
      href={
        navigationUrl
      }
      target="_blank"
      rel="noreferrer"
      className={`flex min-w-0 items-center gap-3 px-4 py-4 transition active:bg-zinc-50 ${
        last
          ? ""
          : "border-b border-zinc-100"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
        {number}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {
            trip.customer_name
          }
        </p>

        <div className="mt-1 flex min-w-0 items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />

          <p className="min-w-0 truncate text-sm text-zinc-500">
            {
              trip.destination_address
            }
          </p>
        </div>
      </div>

      <ExternalLink className="h-4 w-4 shrink-0 text-zinc-300" />
    </a>
  )
}

function WorkerActionBar({
  trip,
}: {
  trip: WorkerTripRow
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
      <div
        className="mx-auto w-full max-w-xl px-4 pt-3 sm:px-5"
        style={{
          paddingBottom:
            "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        {trip.status ===
          "assigned" && (
          <form
            action={
              startTrip
            }
          >
            <input
              type="hidden"
              name="tripId"
              value={
                trip.id
              }
            />

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-zinc-800"
            >
              <Navigation className="h-5 w-5" />

              Start trip
            </button>
          </form>
        )}

        {trip.status ===
          "en_route" && (
          <form
            action={
              arriveTrip
            }
          >
            <input
              type="hidden"
              name="tripId"
              value={
                trip.id
              }
            />

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-zinc-800"
            >
              <MapPin className="h-5 w-5" />

              I&apos;ve arrived
            </button>
          </form>
        )}

        {trip.status ===
          "arrived" && (
          <form
            action={
              completeTrip
            }
          >
            <input
              type="hidden"
              name="tripId"
              value={
                trip.id
              }
            />

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-zinc-800"
            >
              <CheckCircle2 className="h-5 w-5" />

              Complete job
            </button>
          </form>
        )}
      </div>
    </div>
  )
}