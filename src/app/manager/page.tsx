import { redirect } from "next/navigation"

import {
  ManagerDashboard,
} from "@/components/manager/manager-dashboard"

import {
  createClient,
} from "@/lib/supabase/server"

import type {
  WorkerCardData,
  WorkerStatus,
} from "@/types/operations"

export default async function ManagerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
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

  if (profileError || !profile) {
    throw new Error(
      "RouteFlow profile could not be loaded."
    )
  }

  if (profile.role !== "manager") {
    redirect("/worker")
  }

  const {
    data: workerProfiles,
    error: workerError,
  } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "worker")
    .order("full_name")

  if (workerError) {
    throw new Error(workerError.message)
  }

  const {
    data: trips,
    error: tripError,
  } = await supabase
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
    created_at
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
    .order("created_at", {
      ascending: false,
    })

  if (tripError) {
    throw new Error(tripError.message)
  }

  const {
    data: locations,
    error: locationError,
  } = await supabase
    .from("current_locations")
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
    throw new Error(locationError.message)
  }

  const activeTripByWorker = new Map<
    string,
    NonNullable<typeof trips>[number]
  >()

  for (const trip of trips ?? []) {
    if (!activeTripByWorker.has(trip.worker_id)) {
      activeTripByWorker.set(
        trip.worker_id,
        trip
      )
    }
  }

  const locationByWorker = new Map<
    string,
    NonNullable<typeof locations>[number]
  >()

  for (const location of locations ?? []) {
    locationByWorker.set(
      location.worker_id,
      location
    )
  }

  const workers: WorkerCardData[] =
    (workerProfiles ?? []).map(
      (worker) => {
        const trip =
          activeTripByWorker.get(worker.id)

        const location =
          locationByWorker.get(worker.id)

        const names =
          worker.full_name
            .split(" ")
            .filter(Boolean)

        const initials = names
          .slice(0, 2)
          .map((name: string) => name[0])
          .join("")
          .toUpperCase()

        return {
          id: worker.id,

          name: worker.full_name,

          initials,

          role: "Field Technician",

          status: trip
            ? (trip.status as WorkerStatus)
            : "available",

          activeTrip: trip
            ? {
                id: trip.id,

                customerName:
                    trip.customer_name,

                destination:
                    trip.destination_address,

                destinationLatitude:
                    trip.destination_latitude,

                destinationLongitude:
                    trip.destination_longitude,
                }
            : undefined,

          currentLocation:
            trip?.status === "en_route" &&
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
      managerName={profile.full_name}
    />
  )
}