"use client"

import {
  useEffect,
  useState,
} from "react"

import {
  Plus,
  Radio,
  Users,
} from "lucide-react"

import {
  NewTripModal,
} from "@/components/manager/new-trip-modal"

import {
  RoutePlanner,
} from "@/components/manager/route-planner"

import {
  TeamMap,
} from "@/components/manager/team-map"

import {
  WorkerCard,
} from "@/components/manager/worker-card"

import {
  createClient,
} from "@/lib/supabase/client"

import type {
  TripSummary,
  WorkerCardData,
  WorkerStatus,
} from "@/types/operations"

type Props = {
  workers: WorkerCardData[]
  managerName: string
}

type OpenTripRow = {
  id: string

  worker_id: string

  customer_name: string

  destination_address:
    string

  destination_latitude:
    number | null

  destination_longitude:
    number | null

  status:
    | "assigned"
    | "en_route"
    | "arrived"

  created_at: string

  route_position:
    number | null
}

type TripRealtimeStatus =
  | "connecting"
  | "connected"
  | "error"

function toTripSummary(
  trip: OpenTripRow
): TripSummary {
  return {
    id:
      trip.id,

    customerName:
      trip.customer_name,

    destination:
      trip.destination_address,

    destinationLatitude:
      trip.destination_latitude,

    destinationLongitude:
      trip.destination_longitude,

    createdAt:
      trip.created_at,

    routePosition:
      trip.route_position,
  }
}

function applyTripsToWorker(
  worker: WorkerCardData,
  allTrips: OpenTripRow[]
): WorkerCardData {
  const workerTrips =
    allTrips.filter(
      (trip) =>
        trip.worker_id ===
        worker.id
    )

  /*
   * A trip that is actually being
   * worked always wins.
   *
   * Otherwise the first assigned
   * trip becomes Up Next.
   */
  const currentTrip =
    workerTrips.find(
      (trip) =>
        trip.status ===
          "en_route" ||
        trip.status ===
          "arrived"
    ) ??
    workerTrips.find(
      (trip) =>
        trip.status ===
        "assigned"
    )

  const queuedTrips =
    workerTrips
      .filter(
        (trip) =>
          trip.status ===
            "assigned" &&
          trip.id !==
            currentTrip?.id
      )
      .map(
        toTripSummary
      )

  return {
    ...worker,

    status:
      currentTrip
        ? (
            currentTrip.status as
              WorkerStatus
          )
        : "available",

    activeTrip:
      currentTrip
        ? toTripSummary(
            currentTrip
          )
        : undefined,

    queuedTrips,

    /*
     * TeamMap owns the live location
     * subscription after initial load.
     */
    currentLocation:
      currentTrip?.status ===
        "en_route"
        ? worker.currentLocation
        : undefined,
  }
}

export function ManagerDashboard({
  workers,
  managerName,
}: Props) {
  const [supabase] =
    useState(
      () =>
        createClient()
    )

  const [
    team,
    setTeam,
  ] =
    useState<
      WorkerCardData[]
    >(workers)

  const [
    newTripOpen,
    setNewTripOpen,
  ] =
    useState(false)

  const [
    tripRealtimeStatus,
    setTripRealtimeStatus,
  ] =
    useState<
      TripRealtimeStatus
    >("connecting")

  /*
   * Keep the manager's worker queues
   * synchronized with Supabase.
   */
  useEffect(() => {
    let mounted = true
    let latestRequest = 0

    async function refreshTeamTrips() {
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
              worker_id,
              customer_name,
              destination_address,
              destination_latitude,
              destination_longitude,
              status,
              created_at,
              route_position
            `
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
          "Could not refresh trip queues:",
          error
        )

        return
      }

      const openTrips =
        (
          data ?? []
        ) as OpenTripRow[]

      setTeam(
        (
          currentTeam
        ) =>
          currentTeam.map(
            (worker) =>
              applyTripsToWorker(
                worker,
                openTrips
              )
          )
      )
    }

    const channel =
      supabase
        .channel(
          "manager-trip-lifecycle"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "trips",
          },
          () => {
            void refreshTeamTrips()
          }
        )
        .subscribe(
          (status) => {
            if (
              status ===
              "SUBSCRIBED"
            ) {
              setTripRealtimeStatus(
                "connected"
              )

              void refreshTeamTrips()

              return
            }

            if (
              status ===
                "CHANNEL_ERROR" ||
              status ===
                "TIMED_OUT"
            ) {
              setTripRealtimeStatus(
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
  ])

  const available =
    team.filter(
      (worker) =>
        worker.status ===
        "available"
    ).length

  /*
   * This counts waiting jobs,
   * not workers.
   */
  const queuedTripCount =
    team.reduce(
      (
        total,
        worker
      ) =>
        total +
        worker.queuedTrips.length +
        (
          worker.status ===
          "assigned"
            ? 1
            : 0
        ),
      0
    )

  const active =
    team.filter(
      (worker) =>
        worker.status ===
          "en_route" ||
        worker.status ===
          "arrived"
    ).length

  const managerInitials =
    managerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (
          name:
            string
        ) =>
          name[0]
      )
      .join("")
      .toUpperCase()

  return (
    <main className="min-h-dvh overflow-x-hidden bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950">
              <NavigationLogo />
            </div>

            <span className="truncate text-lg font-semibold tracking-tight">
              RouteFlow
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {tripRealtimeStatus ===
            "connected" ? (
              <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 min-[380px]:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                Live sync
              </div>
            ) : tripRealtimeStatus ===
              "error" ? (
              <div className="hidden items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 min-[380px]:flex">
                <span className="h-2 w-2 rounded-full bg-red-500" />

                Offline
              </div>
            ) : (
              <div className="hidden items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 min-[380px]:flex">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />

                Connecting
              </div>
            )}

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold">
              {managerInitials}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-500">
              Operations
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Your team
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Dispatch jobs, organize worker
              routes, and monitor live
              customer ETAs.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setNewTripOpen(
                true
              )
            }
            className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] sm:h-11 sm:w-auto sm:rounded-xl"
          >
            <Plus className="h-4 w-4" />

            New trip
          </button>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 lg:grid-cols-4">
          <SummaryCard
            label="Team members"
            value={
              team.length
            }
            icon={
              <Users className="h-4 w-4" />
            }
          />

          <SummaryCard
            label="Available"
            value={
              available
            }
            icon={
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            }
          />

          <SummaryCard
            label="Queued trips"
            value={
              queuedTripCount
            }
            icon={
              <span className="h-2 w-2 rounded-full bg-violet-500" />
            }
          />

          <SummaryCard
            label="Active"
            value={
              active
            }
            icon={
              <Radio className="h-4 w-4" />
            }
          />
        </section>

        <section className="mt-6 min-w-0 sm:mt-8">
          <TeamMap
            workers={
              team
            }
          />
        </section>

        <section className="mt-6 min-w-0 sm:mt-8">
          <RoutePlanner
            workers={
              team
            }
          />
        </section>

        <section className="mt-8 min-w-0 sm:mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              Team
            </h2>

            <span className="shrink-0 text-sm text-zinc-500">
              {team.length}{" "}
              {team.length ===
              1
                ? "member"
                : "members"}
            </span>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {team.map(
              (worker) => (
                <WorkerCard
                  key={
                    worker.id
                  }
                  worker={
                    worker
                  }
                />
              )
            )}
          </div>
        </section>
      </div>

      <NewTripModal
        open={
          newTripOpen
        }
        workers={
          team
        }
        onClose={() =>
          setNewTripOpen(
            false
          )
        }
      />
    </main>
  )
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 sm:text-sm">
        <span className="shrink-0">
          {icon}
        </span>

        <span className="truncate">
          {label}
        </span>
      </div>

      <p className="mt-2 text-2xl font-semibold sm:mt-3">
        {value}
      </p>
    </div>
  )
}

function NavigationLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M5 19 19 5M9 5h10v10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}