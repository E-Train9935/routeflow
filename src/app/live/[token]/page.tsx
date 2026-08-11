import {
  Navigation,
} from "lucide-react"

import {
  PublicTripTracker,
} from "@/components/tracking/public-trip-tracker"

import {
  createClient,
} from "@/lib/supabase/server"

type PublicTrip = {
  trip_id: string

  worker_name: string

  trip_status:
    | "assigned"
    | "en_route"
    | "arrived"

  destination_latitude:
    number | null

  destination_longitude:
    number | null

  worker_latitude:
    number | null

  worker_longitude:
    number | null

  accuracy_meters:
    number | null

  location_updated_at:
    string | null

  expires_at: string
}

type Props = {
  params: Promise<{
    token: string
  }>
}

export default async function LivePage({
  params,
}: Props) {
  const {
    token,
  } = await params

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_public_trip_by_token",
    {
      p_token:
        token,
    }
  )

  if (error) {
    console.error(
      "Could not load public trip:",
      error
    )
  }

  const trip =
    (data?.[0] ??
      null) as PublicTrip | null

  if (!trip) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Navigation className="h-5 w-5 text-zinc-600" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Tracking unavailable
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            This link may have
            expired, the trip may
            have ended, or the link
            is invalid.
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicTripTracker
      token={token}
      initialTrip={trip}
    />
  )
}