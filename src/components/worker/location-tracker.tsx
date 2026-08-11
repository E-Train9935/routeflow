"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  CheckCircle2,
  LocateFixed,
  MapPinOff,
  RefreshCw,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type TrackingStatus =
  | "requesting"
  | "sharing"
  | "denied"
  | "unavailable"
  | "error"

export function LocationTracker() {
  const [supabase] = useState(() => createClient())

  const [status, setStatus] =
    useState<TrackingStatus>("requesting")

  const [accuracy, setAccuracy] =
    useState<number | null>(null)

  const [lastSentAt, setLastSentAt] =
    useState<Date | null>(null)

  const [uploadError, setUploadError] =
    useState<string | null>(null)

  const watchIdRef =
    useRef<number | null>(null)

  const lastUploadAtRef = useRef(0)

  const uploadInFlightRef = useRef(false)

  const stopTracking = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      )

      watchIdRef.current = null
    }
  }, [])

  const startTracking = useCallback(() => {
    stopTracking()

    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setStatus("unavailable")
      return
    }

    setStatus("requesting")
    setUploadError(null)

    const watchId =
      navigator.geolocation.watchPosition(
        async (position) => {
          const {
            latitude,
            longitude,
            accuracy,
          } = position.coords

          setStatus("sharing")
          setAccuracy(accuracy)

          const now = Date.now()

          // Do not hammer the database if the
          // browser sends GPS readings very quickly.
          if (
            now - lastUploadAtRef.current < 5000 ||
            uploadInFlightRef.current
          ) {
            return
          }

          uploadInFlightRef.current = true

          const { error } =
            await supabase.rpc(
              "update_my_location",
              {
                p_latitude: latitude,
                p_longitude: longitude,
                p_accuracy_meters:
                  Number.isFinite(accuracy)
                    ? accuracy
                    : null,
              }
            )

          uploadInFlightRef.current = false

          if (error) {
            console.error(
              "Location upload failed:",
              error
            )

            setUploadError(
              "Your device has a location, but RouteFlow could not upload it."
            )

            return
          }

          lastUploadAtRef.current =
            Date.now()

          setLastSentAt(new Date())
          setUploadError(null)
        },

        (error) => {
          if (
            error.code ===
            GeolocationPositionError.PERMISSION_DENIED
          ) {
            setStatus("denied")
            return
          }

          if (
            error.code ===
            GeolocationPositionError.POSITION_UNAVAILABLE
          ) {
            setStatus("unavailable")
            return
          }

          setStatus("error")
        },

        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      )

    watchIdRef.current = watchId
  }, [stopTracking, supabase])

  useEffect(() => {
  const startTimer =
    window.setTimeout(
      () => {
        startTracking()
      },
      0
    )

  return () => {
    window.clearTimeout(
      startTimer
    )

    stopTracking()
  }
}, [
  startTracking,
  stopTracking,
])

  if (status === "requesting") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <LocateFixed className="h-5 w-5 animate-pulse" />
          </div>

          <div>
            <p className="font-medium">
              Requesting your location
            </p>

            <p className="mt-0.5 text-sm text-zinc-500">
              Allow location access when your
              browser asks.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (
    status === "denied" ||
    status === "unavailable" ||
    status === "error"
  ) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-600">
            <MapPinOff className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <p className="font-medium text-red-950">
              Live location is unavailable
            </p>

            <p className="mt-1 text-sm text-red-700">
              {status === "denied"
                ? "RouteFlow does not have permission to access your location. Enable location permission in your browser and try again."
                : "RouteFlow could not determine your current location."}
            </p>

            <button
              type="button"
              onClick={startTracking}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-red-800 shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-emerald-950">
              Live location active
            </p>

            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>

          <p className="mt-1 text-sm text-emerald-700">
            Your location is being shared for
            this trip.
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-emerald-800">
            {accuracy !== null && (
              <span>
                Accuracy ±
                {Math.round(accuracy)} m
              </span>
            )}

            {lastSentAt && (
              <span>
                Updated{" "}
                {lastSentAt.toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  }
                )}
              </span>
            )}
          </div>

          {uploadError && (
            <p className="mt-3 text-xs font-medium text-red-700">
              {uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}