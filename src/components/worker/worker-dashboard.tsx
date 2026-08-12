"use client"

import {
  useEffect,
  useState,
} from "react"

import {
  CheckCircle2,
  MapPin,
  Navigation,
  Radio,
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
   * Sarah receives new assignments
   * without refreshing the page.
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
              created_at
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
               * Catch assignments made
               * during initial page load.
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
   * Only one en-route/arrived trip
   * can exist.
   *
   * Otherwise the oldest assigned
   * trip becomes Up Next.
   */
  const activeJourney =
    trips.find(
      (trip) =>
        trip.status ===
          "en_route" ||
        trip.status ===
          "arrived"
    )

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Navigation className="h-4 w-4" />
            </div>

            <span className="font-semibold">
              RouteFlow
            </span>
          </div>

          {realtimeStatus ===
          "connected" ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              Live
            </div>
          ) : realtimeStatus ===
            "error" ? (
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />

              Offline
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
              <Radio className="h-3 w-3" />

              Connecting
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-6 sm:px-5 sm:py-8">
        <p className="text-sm font-medium text-zinc-500">
          Welcome,{" "}
          {workerName}
        </p>

        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Your route
          </h1>

          {trips.length >
            0 && (
            <span className="shrink-0 text-sm font-medium text-zinc-500">
              {trips.length}{" "}
              {trips.length ===
              1
                ? "stop"
                : "stops"}
            </span>
          )}
        </div>

        {!currentTrip ? (
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              You&apos;re available
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              New assignments will
              appear here automatically.
              No refresh needed.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      currentTrip.status ===
                      "assigned"
                        ? "bg-violet-500"
                        : currentTrip.status ===
                            "en_route"
                          ? "bg-blue-500"
                          : "bg-emerald-500"
                    }`}
                  />

                  {currentTrip.status ===
                  "assigned"
                    ? "Up next"
                    : currentTrip.status ===
                        "en_route"
                      ? "En route"
                      : "Arrived"}
                </div>

                {queuedTrips.length >
                  0 && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    +
                    {
                      queuedTrips.length
                    }{" "}
                    next
                  </span>
                )}
              </div>

              <p className="mt-6 text-sm text-zinc-500">
                Customer
              </p>

              <h2 className="mt-1 break-words text-2xl font-semibold">
                {
                  currentTrip
                    .customer_name
                }
              </h2>

              <div className="mt-4 flex min-w-0 items-start gap-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                <span className="min-w-0 break-words">
                  {
                    currentTrip
                      .destination_address
                  }
                </span>
              </div>

              {currentTrip.status ===
                "assigned" && (
                <>
                  <div className="mt-6 rounded-xl bg-violet-50 p-4">
                    <p className="text-sm font-medium text-violet-900">
                      Ready when you are
                    </p>

                    <p className="mt-1 text-sm text-violet-700">
                      Starting this stop
                      begins live location
                      sharing.
                    </p>
                  </div>

                  <form
                    action={
                      startTrip
                    }
                    className="mt-5"
                  >
                    <input
                      type="hidden"
                      name="tripId"
                      value={
                        currentTrip.id
                      }
                    />

                    <button
                      type="submit"
                      className="h-12 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Start trip
                    </button>
                  </form>
                </>
              )}

              {currentTrip.status ===
                "en_route" && (
                <>
                  <div className="mt-6 rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      You&apos;re on the
                      way
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Your live location
                      is being shared.
                    </p>
                  </div>

                  <form
                    action={
                      arriveTrip
                    }
                    className="mt-5"
                  >
                    <input
                      type="hidden"
                      name="tripId"
                      value={
                        currentTrip.id
                      }
                    />

                    <button
                      type="submit"
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      <MapPin className="h-4 w-4" />

                      I&apos;ve arrived
                    </button>
                  </form>
                </>
              )}

              {currentTrip.status ===
                "arrived" && (
                <>
                  <div className="mt-6 rounded-xl bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                      <div>
                        <p className="text-sm font-medium text-emerald-900">
                          Arrival confirmed
                        </p>

                        <p className="mt-1 text-sm text-emerald-700">
                          GPS sharing has
                          stopped. Complete
                          the job when
                          finished.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form
                    action={
                      completeTrip
                    }
                    className="mt-5"
                  >
                    <input
                      type="hidden"
                      name="tripId"
                      value={
                        currentTrip.id
                      }
                    />

                    <button
                      type="submit"
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      <CheckCircle2 className="h-4 w-4" />

                      Complete job
                    </button>
                  </form>
                </>
              )}
            </section>

            {currentTrip.status ===
              "en_route" && (
              <div className="mt-4">
                <LocationTracker />
              </div>
            )}

            {queuedTrips.length >
              0 && (
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">
                    Next stops
                  </h2>

                  <span className="text-sm text-zinc-500">
                    {
                      queuedTrips.length
                    }{" "}
                    remaining
                  </span>
                </div>

                <div className="space-y-3">
                  {queuedTrips.map(
                    (
                      trip,
                      index
                    ) => (
                      <div
                        key={
                          trip.id
                        }
                        className="flex min-w-0 gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                          {index +
                            2}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {
                              trip.customer_name
                            }
                          </p>

                          <div className="mt-1 flex min-w-0 items-start gap-1.5 text-sm text-zinc-500">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                            <span className="min-w-0 break-words">
                              {
                                trip.destination_address
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}