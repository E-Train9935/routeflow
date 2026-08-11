"use server"

import {
  revalidatePath,
} from "next/cache"

import {
  createClient,
} from "@/lib/supabase/server"

function getTripId(
  formData: FormData
) {
  const tripId = String(
    formData.get("tripId") ?? ""
  )

  if (!tripId) {
    throw new Error(
      "Trip ID is required."
    )
  }

  return tripId
}


/*
 * ASSIGNED -> EN_ROUTE
 */
export async function startTrip(
  formData: FormData
) {
  const tripId =
    getTripId(formData)

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      "start_my_trip",
      {
        p_trip_id:
          tripId,
      }
    )

  if (error) {
    console.error(
      "Start trip failed:",
      error
    )

    throw new Error(
      "Trip could not be started."
    )
  }

  revalidatePath("/worker")
  revalidatePath("/manager")
}


/*
 * EN_ROUTE -> ARRIVED
 */
export async function arriveTrip(
  formData: FormData
) {
  const tripId =
    getTripId(formData)

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      "arrive_my_trip",
      {
        p_trip_id:
          tripId,
      }
    )

  if (error) {
    console.error(
      "Arrive trip failed:",
      error
    )

    throw new Error(
      "Trip could not be marked as arrived."
    )
  }

  revalidatePath("/worker")
  revalidatePath("/manager")
}


/*
 * ARRIVED -> COMPLETED
 */
export async function completeTrip(
  formData: FormData
) {
  const tripId =
    getTripId(formData)

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      "complete_my_trip",
      {
        p_trip_id:
          tripId,
      }
    )

  if (error) {
    console.error(
      "Complete trip failed:",
      error
    )

    throw new Error(
      "Trip could not be completed."
    )
  }

  revalidatePath("/worker")
  revalidatePath("/manager")
}