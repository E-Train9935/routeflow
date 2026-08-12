import {
  redirect,
} from "next/navigation"

import {
  WorkerDashboard,
} from "@/components/worker/worker-dashboard"

import type {
  WorkerTripRow,
} from "@/components/worker/worker-dashboard"

import {
  createClient,
} from "@/lib/supabase/server"

export default async function WorkerPage() {
  const supabase =
    await createClient()

  const {
    data: { user },
  } =
    await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

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
          role
        `
      )
      .eq(
        "id",
        user.id
      )
      .single()

  if (
    profileError ||
    !profile
  ) {
    throw new Error(
      "Worker profile could not be loaded."
    )
  }

  if (
    profile.role !==
    "worker"
  ) {
    redirect("/manager")
  }

  /*
   * Load the worker's complete
   * open route.
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
          customer_name,
          destination_address,
          status,
          created_at
        `
      )
      .eq(
        "worker_id",
        user.id
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

  if (tripError) {
    throw new Error(
      tripError.message
    )
  }

  return (
    <WorkerDashboard
      workerId={
        profile.id
      }
      workerName={
        profile.full_name
      }
      initialTrips={
        (
          trips ?? []
        ) as WorkerTripRow[]
      }
    />
  )
}