"use server"

import {
  revalidatePath,
} from "next/cache"

import {
  createClient,
} from "@/lib/supabase/server"

import {
  geocodeAddress,
} from "@/lib/routing/geocode"

export type CreateTripInput = {
  workerId: string
  customerName: string
  destination: string
}

export async function createTrip(
  input: CreateTripInput
) {
  const customerName =
    input.customerName.trim()

  const destination =
    input.destination.trim()

  if (
    !input.workerId ||
    !customerName ||
    !destination
  ) {
    return {
      ok: false,
      error:
        "Please complete all fields.",
    }
  }

  const supabase =
    await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error:
        "You are not signed in.",
    }
  }

  const {
    data: manager,
    error: managerError,
  } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, role"
    )
    .eq("id", user.id)
    .single()

  if (
    managerError ||
    !manager ||
    manager.role !== "manager"
  ) {
    return {
      ok: false,
      error:
        "Manager profile could not be loaded.",
    }
  }

  const {
    data: worker,
    error: workerError,
  } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, role"
    )
    .eq("id", input.workerId)
    .single()

  if (
    workerError ||
    !worker ||
    worker.role !== "worker" ||
    worker.organization_id !==
      manager.organization_id
  ) {
    return {
      ok: false,
      error:
        "That worker is not available to this organization.",
    }
  }

  let geocoded

  try {
    geocoded =
      await geocodeAddress(
        destination
      )
  } catch (error) {
    console.error(
      "Geocoding failed:",
      error
    )

    return {
      ok: false,
      error:
        "RouteFlow could not look up that address.",
    }
  }

  if (!geocoded) {
    return {
      ok: false,
      error:
        "We couldn't find that destination. Try a more complete address.",
    }
  }

  const { error } =
    await supabase
      .from("trips")
      .insert({
        organization_id:
          manager.organization_id,

        worker_id:
          worker.id,

        created_by:
          manager.id,

        customer_name:
          customerName,

        destination_address:
          destination,

        destination_latitude:
          geocoded.latitude,

        destination_longitude:
          geocoded.longitude,

        status:
          "assigned",
      })

  if (error) {
    if (
      error.code === "23505"
    ) {
      return {
        ok: false,
        error:
          "This worker already has an active trip.",
      }
    }

    console.error(error)

    return {
      ok: false,
      error:
        "Trip could not be created.",
    }
  }

  revalidatePath("/manager")
  revalidatePath("/worker")

  return {
    ok: true,
  }
}


/*
 * Generate a secure tracking URL
 * for one specific trip.
 */
export async function createTrackingShare(
  tripId: string
) {
  if (!tripId) {
    return {
      ok: false,
      error:
        "Trip ID is required.",
    }
  }

  const supabase =
    await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error:
        "You are not signed in.",
    }
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "create_trip_share",
    {
      p_trip_id:
        tripId,
    }
  )

  if (error) {
    console.error(
      "Could not create share link:",
      error
    )

    return {
      ok: false,
      error:
        "Tracking link could not be created.",
    }
  }

  return {
    ok: true,
    token:
      data as string,
  }
}