"use client"

import {
  useState,
} from "react"

import {
  GripVertical,
  MapPin,
  Route,
} from "lucide-react"

import {
  DragDropProvider,
} from "@dnd-kit/react"

import {
  isSortable,
  useSortable,
} from "@dnd-kit/react/sortable"

import {
  createClient,
} from "@/lib/supabase/client"

import type {
  TripSummary,
  WorkerCardData,
} from "@/types/operations"

type Props = {
  workers: WorkerCardData[]
}

export function RoutePlanner({
  workers,
}: Props) {
  const routeWorkers =
    workers.filter(
      (worker) => {
        const assignedTrips =
          getAssignedTrips(
            worker
          )

        return (
          assignedTrips.length >
          0
        )
      }
    )

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 shrink-0" />

            <h2 className="font-semibold">
              Route planner
            </h2>
          </div>

          <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-500">
            Drag queued stops to change
            the order workers will visit
            them.
          </p>
        </div>

        <div className="shrink-0 text-xs text-zinc-400">
          Changes save automatically
        </div>
      </div>

      {routeWorkers.length ===
      0 ? (
        <div className="mt-6 rounded-2xl bg-zinc-50 px-5 py-8 text-center">
          <p className="text-sm font-medium">
            No routes to plan
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Assign trips to a worker
            and they will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {routeWorkers.map(
            (worker) => (
              <WorkerRoute
                key={
                  getWorkerRouteKey(
                    worker
                  )
                }
                worker={
                  worker
                }
              />
            )
          )}
        </div>
      )}
    </section>
  )
}

function getAssignedTrips(
  worker: WorkerCardData
): TripSummary[] {
  /*
   * Before work starts,
   * activeTrip represents the
   * first ASSIGNED job.
   */
  if (
    worker.status ===
      "assigned" &&
    worker.activeTrip
  ) {
    return [
      worker.activeTrip,
      ...worker.queuedTrips,
    ]
  }

  /*
   * Once a worker starts driving
   * or arrives, the current trip
   * is locked. Only future stops
   * are reorderable.
   */
  return worker.queuedTrips
}

function getWorkerRouteKey(
  worker: WorkerCardData
) {
  const assignedTrips =
    getAssignedTrips(
      worker
    )

  const queueSignature =
    assignedTrips
      .map(
        (trip) =>
          `${trip.id}:${trip.routePosition ?? "null"}`
      )
      .join("|")

  return [
    worker.id,
    worker.status,
    worker.activeTrip?.id ??
      "none",
    queueSignature,
  ].join(":")
}

function WorkerRoute({
  worker,
}: {
  worker: WorkerCardData
}) {
  const [supabase] =
    useState(
      () =>
        createClient()
    )

  const incomingTrips =
    getAssignedTrips(
      worker
    )

  const [
    trips,
    setTrips,
  ] =
    useState<
      TripSummary[]
    >(incomingTrips)

  const [
    saving,
    setSaving,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  async function saveOrder(
    nextTrips:
      TripSummary[]
  ) {
    setSaving(true)
    setError(null)

    const {
      error:
        reorderError,
    } =
      await supabase.rpc(
        "reorder_worker_trips",
        {
          p_worker_id:
            worker.id,

          p_trip_ids:
            nextTrips.map(
              (trip) =>
                trip.id
            ),
        }
      )

    if (reorderError) {
      console.error(
        "Could not reorder worker trips:",
        {
          message:
            reorderError.message,

          code:
            reorderError.code,

          details:
            reorderError.details,

          hint:
            reorderError.hint,
        }
      )

      setTrips(
        incomingTrips
      )

      setError(
        reorderError.message ||
          "Could not save the new route order."
      )
    }

    setSaving(false)
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
            {worker.initials}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {worker.name}
            </p>

            <p className="text-xs text-zinc-500">
              {trips.length}{" "}
              {trips.length ===
              1
                ? "queued stop"
                : "queued stops"}
            </p>
          </div>
        </div>

        {saving && (
          <span className="shrink-0 text-xs font-medium text-zinc-400">
            Saving...
          </span>
        )}
      </div>

      {worker.status ===
        "en_route" &&
        worker.activeTrip && (
          <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              Current stop
            </p>

            <p className="mt-1 truncate text-sm font-medium text-blue-950">
              {
                worker
                  .activeTrip
                  .customerName
              }
            </p>

            <p className="mt-1 line-clamp-2 break-words text-xs leading-4 text-blue-700">
              {
                worker
                  .activeTrip
                  .destination
              }
            </p>
          </div>
        )}

      {worker.status ===
        "arrived" &&
        worker.activeTrip && (
          <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              At customer
            </p>

            <p className="mt-1 truncate text-sm font-medium text-emerald-950">
              {
                worker
                  .activeTrip
                  .customerName
              }
            </p>
          </div>
        )}

      <div className="mt-4 min-w-0">
        <DragDropProvider
          onDragEnd={(
            event
          ) => {
            if (
              event.canceled
            ) {
              return
            }

            const {
              source,
            } =
              event.operation

            if (
              !isSortable(
                source
              )
            ) {
              return
            }

            const {
              initialIndex,
              index,
            } =
              source

            if (
              initialIndex ===
              index
            ) {
              return
            }

            const nextTrips =
              [...trips]

            const [
              movedTrip,
            ] =
              nextTrips.splice(
                initialIndex,
                1
              )

            if (!movedTrip) {
              return
            }

            nextTrips.splice(
              index,
              0,
              movedTrip
            )

            /*
             * Optimistic UI update.
             */
            setTrips(
              nextTrips
            )

            /*
             * Persist the full
             * worker queue.
             */
            void saveOrder(
              nextTrips
            )
          }}
        >
          <div className="min-w-0 space-y-2">
            {trips.map(
              (
                trip,
                index
              ) => (
                <SortableTrip
                  key={
                    trip.id
                  }
                  trip={
                    trip
                  }
                  index={
                    index
                  }
                />
              )
            )}
          </div>
        </DragDropProvider>
      </div>

      {trips.length >
        1 && (
        <p className="mt-3 text-center text-[11px] text-zinc-400">
          Drag the handle to reorder
          stops
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

function SortableTrip({
  trip,
  index,
}: {
  trip: TripSummary
  index: number
}) {
  const {
    ref,
    handleRef,
    isDragging,
  } =
    useSortable({
      id:
        trip.id,

      index,
    })

  return (
    <div
      ref={
        ref
      }
      className={`flex min-w-0 items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm transition sm:gap-3 sm:p-3 ${
        isDragging
          ? "z-20 border-zinc-400 opacity-80 shadow-lg"
          : "border-zinc-200"
      }`}
    >
      <button
        ref={
          handleRef
        }
        type="button"
        aria-label={`Move ${trip.customerName}`}
        className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing active:bg-zinc-100"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {
            trip.customerName
          }
        </p>

        <div className="mt-1 flex min-w-0 items-start gap-1">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />

          <span className="line-clamp-2 min-w-0 break-words text-xs leading-4 text-zinc-500">
            {
              trip.destination
            }
          </span>
        </div>
      </div>
    </div>
  )
}