import {
  redirect,
} from "next/navigation"

import {
  ManagerDashboard,
} from "@/components/manager/manager-dashboard"

import {
  createClient,
} from "@/lib/supabase/server"

import type {
  TripSummary,
  WorkerCardData,
  WorkerStatus,
} from "@/types/operations"

export default async function ManagerPage() {
  const supabase =
    await createClient()

  const {
    data: { user },
  } =
    await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  /*
   * Manager profile.
   */
  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          organization_id,
          role
        `
      )
      .eq("id", user.id)
      .single()

  if (
    profileError ||
    !profile
  ) {
    throw new Error(
      "RouteFlow profile could not be loaded."
    )
  }

  if (
    profile.role !==
    "manager"
  ) {
    redirect("/worker")
  }

  /*
   * Workers.
   */
  const {
    data: workerProfiles,
    error: workerError,
  } =
    await supabase
      .from("profiles")
      .select(
        "id, full_name"
      )
      .eq(
        "role",
        "worker"
      )
      .order(
        "full_name"
      )

  if (workerError) {
    throw new Error(
      workerError.message
    )
  }

  /*
   * All OPEN trips.
   *
   * Old RouteFlow loaded only one
   * effective trip per worker.
   *
   * We now need the whole queue.
   */
  const {
    data: trips,
    error: tripError,
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
            ascending: true,
            nullsFirst: false,
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

  if (tripError) {
    throw new Error(
      tripError.message
    )
  }

  /*
   * Current locations.
   */
  const {
    data: locations,
    error: locationError,
  } =
    await supabase
      .from(
        "current_locations"
      )
      .select(
        `
          worker_id,
          latitude,
          longitude,
          accuracy_meters,
          updated_at
        `
      )

  if (locationError) {
    throw new Error(
      locationError.message
    )
  }

  type TripRow =
    NonNullable<
      typeof trips
    >[number]

  type LocationRow =
    NonNullable<
      typeof locations
    >[number]

  /*
   * Group trips by worker.
   */
  const tripsByWorker =
    new Map<
      string,
      TripRow[]
    >()

  for (
    const trip of
    trips ?? []
  ) {
    const existing =
      tripsByWorker.get(
        trip.worker_id
      ) ?? []

    existing.push(trip)

    tripsByWorker.set(
      trip.worker_id,
      existing
    )
  }

  /*
   * Group location rows.
   */
  const locationByWorker =
    new Map<
      string,
      LocationRow
    >()

  for (
    const location of
    locations ?? []
  ) {
    locationByWorker.set(
      location.worker_id,
      location
    )
  }

  function toTripSummary(
    trip: TripRow
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

  const workers:
    WorkerCardData[] =
    (
      workerProfiles ?? []
    ).map(
      (worker) => {
        const workerTrips =
          tripsByWorker.get(
            worker.id
          ) ?? []

        /*
         * Actual active work always
         * wins over queued assignments.
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

        /*
         * Every remaining assigned
         * trip becomes part of the
         * worker's queue.
         */
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

        const location =
          locationByWorker.get(
            worker.id
          )

        const names =
          worker.full_name
            .split(" ")
            .filter(Boolean)

        const initials =
          names
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

        return {
          id:
            worker.id,

          name:
            worker.full_name,

          initials,

          role:
            "Field Technician",

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

          currentLocation:
            currentTrip?.status ===
              "en_route" &&
            location
              ? {
                  latitude:
                    location.latitude,

                  longitude:
                    location.longitude,

                  accuracyMeters:
                    location.accuracy_meters,

                  updatedAt:
                    location.updated_at,
                }
              : undefined,
        }
      }
    )

  return (
    <ManagerDashboard
      workers={workers}
      managerName={
        profile.full_name
      }
    />
  )
}