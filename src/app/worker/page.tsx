import {
  CheckCircle2,
  MapPin,
  Navigation,
} from "lucide-react"

import {
  redirect,
} from "next/navigation"

import {
  createClient,
} from "@/lib/supabase/server"

import {
  LocationTracker,
} from "@/components/worker/location-tracker"

import {
  arriveTrip,
  completeTrip,
  startTrip,
} from "./actions"

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

  /*
   * Load worker profile.
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
   * V1 rule:
   * a worker has at most one
   * active/open trip.
   */
  const {
    data: trip,
    error: tripError,
  } =
    await supabase
      .from("trips")
      .select(
        `
          id,
          customer_name,
          destination_address,
          status
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
            false,
        }
      )
      .limit(1)
      .maybeSingle()

  if (tripError) {
    throw new Error(
      tripError.message
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <Navigation className="h-4 w-4" />
          </div>

          <span className="font-semibold">
            RouteFlow
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-8">
        <p className="text-sm font-medium text-zinc-500">
          Welcome,{" "}
          {profile.full_name}
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Your trip
        </h1>

        {/* No active trip */}
        {!trip ? (
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              You&apos;re available
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              You don&apos;t currently
              have an assigned trip.
            </p>
          </div>
        ) : (
          <>
            {/* Trip card */}
            <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              {/* Status */}
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${
                    trip.status ===
                    "assigned"
                      ? "bg-violet-500"
                      : trip.status ===
                          "en_route"
                        ? "bg-blue-500"
                        : "bg-emerald-500"
                  }`}
                />

                {trip.status ===
                "assigned"
                  ? "Assigned"
                  : trip.status ===
                      "en_route"
                    ? "En route"
                    : "Arrived"}
              </div>

              {/* Customer */}
              <p className="mt-6 text-sm text-zinc-500">
                Customer
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                {
                  trip.customer_name
                }
              </h2>

              {/* Destination */}
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                {
                  trip.destination_address
                }
              </div>

              {/* ASSIGNED */}
              {trip.status ===
                "assigned" && (
                <>
                  <div className="mt-6 rounded-xl bg-violet-50 p-4">
                    <p className="text-sm font-medium text-violet-900">
                      Ready when you are
                    </p>

                    <p className="mt-1 text-sm text-violet-700">
                      Starting the trip
                      will begin live
                      location sharing.
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
                        trip.id
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

              {/* EN ROUTE */}
              {trip.status ===
                "en_route" && (
                <>
                  <div className="mt-6 rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      You&apos;re on the
                      way
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Your live location
                      is being shared
                      while this trip is
                      active.
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
                        trip.id
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

              {/* ARRIVED */}
              {trip.status ===
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
                          Live GPS sharing
                          has stopped.
                          Complete the job
                          when you are
                          finished with the
                          customer.
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
                        trip.id
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
            </div>

            {/* GPS tracker only exists
                while actively en route.

                When status becomes arrived,
                React unmounts this component,
                causing clearWatch() to run. */}
            {trip.status ===
              "en_route" && (
              <div className="mt-4">
                <LocationTracker />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}