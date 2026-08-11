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
  TeamMap,
} from "@/components/manager/team-map"

import {
  WorkerCard,
} from "@/components/manager/worker-card"

import {
  createClient,
} from "@/lib/supabase/client"

import type {
  WorkerCardData,
  WorkerStatus,
} from "@/types/operations"

type Props = {
  workers: WorkerCardData[]
  managerName: string
}

type RealtimeTripRow = {
  id: string

  worker_id: string

  customer_name: string

  destination_address: string

  destination_latitude:
    number | null

  destination_longitude:
    number | null

  status:
    | "assigned"
    | "en_route"
    | "arrived"
    | "completed"
    | "cancelled"
}

type TripRealtimeStatus =
  | "connecting"
  | "connected"
  | "error"

export function ManagerDashboard({
  workers,
  managerName,
}: Props) {
  /*
   * Supabase browser client.
   */
  const [supabase] =
    useState(() => createClient())

  /*
   * Local realtime copy of
   * the manager's team.
   */
  const [team, setTeam] =
    useState<WorkerCardData[]>(
      workers
    )

  const [
    newTripOpen,
    setNewTripOpen,
  ] = useState(false)

  const [
    tripRealtimeStatus,
    setTripRealtimeStatus,
  ] =
    useState<TripRealtimeStatus>(
      "connecting"
    )

  /*
   * Subscribe to trip changes.
   *
   * This is what lets the manager
   * see Sarah transition:
   *
   * ASSIGNED
   * -> EN ROUTE
   * -> ARRIVED
   * -> AVAILABLE
   *
   * without refreshing.
   */
  useEffect(() => {
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
          (payload) => {
            const row =
              payload.new as
                | RealtimeTripRow
                | undefined

            /*
             * We don't currently
             * delete trip records,
             * so events without a
             * new worker row can
             * simply be ignored.
             */
            if (
              !row ||
              !row.worker_id
            ) {
              return
            }

            setTeam(
              (currentTeam) =>
                currentTeam.map(
                  (worker) => {
                    if (
                      worker.id !==
                      row.worker_id
                    ) {
                      return worker
                    }

                    /*
                     * Finished trips
                     * mean this worker
                     * becomes available
                     * again.
                     */
                    if (
                      row.status ===
                        "completed" ||
                      row.status ===
                        "cancelled"
                    ) {
                      return {
                        ...worker,

                        status:
                          "available",

                        activeTrip:
                          undefined,

                        /*
                         * Prevent any
                         * server snapshot
                         * location from
                         * appearing stale.
                         */
                        currentLocation:
                          undefined,
                      }
                    }

                    /*
                     * Open trip.
                     */
                    if (
                      row.status ===
                        "assigned" ||
                      row.status ===
                        "en_route" ||
                      row.status ===
                        "arrived"
                    ) {
                      return {
                        ...worker,

                        status:
                          row.status as WorkerStatus,

                        activeTrip: {
                          id:
                            row.id,

                          customerName:
                            row.customer_name,

                          destination:
                            row.destination_address,

                          destinationLatitude:
                            row.destination_latitude,

                          destinationLongitude:
                            row.destination_longitude,
                        },
                      }
                    }

                    return worker
                  }
                )
            )
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
      void supabase.removeChannel(
        channel
      )
    }
  }, [supabase])

  /*
   * Dashboard metrics now use
   * realtime team state instead
   * of the original server props.
   */
  const available =
    team.filter(
      (worker) =>
        worker.status ===
        "available"
    ).length

  const assigned =
    team.filter(
      (worker) =>
        worker.status ===
        "assigned"
    ).length

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
        (name) => name[0]
      )
      .join("")
      .toUpperCase()

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950">
              <NavigationLogo />
            </div>

            <span className="text-lg font-semibold tracking-tight">
              RouteFlow
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Trip realtime status */}
            {tripRealtimeStatus ===
            "connected" ? (
              <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                Live sync
              </div>
            ) : tripRealtimeStatus ===
              "error" ? (
              <div className="hidden items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 sm:flex">
                <span className="h-2 w-2 rounded-full bg-red-500" />

                Sync unavailable
              </div>
            ) : (
              <div className="hidden items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 sm:flex">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />

                Connecting
              </div>
            )}

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold">
              {managerInitials}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Dashboard heading */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Operations
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Your team
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Track availability,
              assignments, active trips,
              and customer ETAs.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setNewTripOpen(true)
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />

            New trip
          </button>
        </div>

        {/* Summary */}
        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Team members"
            value={team.length}
            icon={
              <Users className="h-4 w-4" />
            }
          />

          <SummaryCard
            label="Available"
            value={available}
            icon={
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            }
          />

          <SummaryCard
            label="Assigned"
            value={assigned}
            icon={
              <span className="h-2 w-2 rounded-full bg-violet-500" />
            }
          />

          <SummaryCard
            label="Active"
            value={active}
            icon={
              <Radio className="h-4 w-4" />
            }
          />
        </section>

        {/* Live operations map */}
        <section className="mt-8">
          <TeamMap
            workers={team}
          />
        </section>

        {/* Team */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">
              Team
            </h2>

            <span className="text-sm text-zinc-500">
              {team.length} members
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {team.map(
              (worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                />
              )
            )}
          </div>
        </section>
      </div>

      {/* Create trip */}
      <NewTripModal
        open={newTripOpen}
        workers={team}
        onClose={() =>
          setNewTripOpen(false)
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-zinc-500 sm:text-sm">
        {icon}

        {label}
      </div>

      <p className="mt-3 text-2xl font-semibold">
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
    >
      <path
        d="M5 19 19 5M9 5h10v10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}