"use client"

import {
  FormEvent,
  useState,
} from "react"

import {
  MapPin,
  UserRound,
  X,
} from "lucide-react"

import {
  createTrip,
} from "@/app/manager/actions"

import type {
  WorkerCardData,
} from "@/types/operations"

type NewTripModalProps = {
  open: boolean
  workers: WorkerCardData[]
  onClose: () => void
}

function getQueuedCount(
  worker: WorkerCardData
) {
  return (
    worker.queuedTrips.length +
    (
      worker.status ===
      "assigned"
        ? 1
        : 0
    )
  )
}

export function NewTripModal({
  open,
  workers,
  onClose,
}: NewTripModalProps) {
  const [
    workerId,
    setWorkerId,
  ] =
    useState("")

  const [
    customerName,
    setCustomerName,
  ] =
    useState("")

  const [
    destination,
    setDestination,
  ] =
    useState("")

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState("")

  const selectedWorkerId =
    workers.some(
      (worker) =>
        worker.id ===
        workerId
    )
      ? workerId
      : workers[0]?.id ?? ""

  function closeModal() {
    if (loading) {
      return
    }

    setError("")
    onClose()
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !selectedWorkerId ||
      !customerName.trim() ||
      !destination.trim()
    ) {
      return
    }

    setLoading(true)
    setError("")

    const result =
      await createTrip({
        workerId:
          selectedWorkerId,

        customerName,

        destination,
      })

    setLoading(false)

    if (!result.ok) {
      setError(
        result.error ??
          "Something went wrong."
      )

      return
    }

    setCustomerName("")
    setDestination("")
    setError("")

    /*
     * No router.refresh().
     *
     * ManagerDashboard receives the
     * INSERT through Supabase Realtime.
     */
    onClose()
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={
          closeModal
        }
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-5 sm:px-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Dispatch
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Add trip to route
            </h2>
          </div>

          <button
            type="button"
            onClick={
              closeModal
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {workers.length > 0 ? (
          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="space-y-5 px-5 py-6 sm:px-6">
              <div>
                <label
                  htmlFor="worker"
                  className="mb-2 block text-sm font-medium"
                >
                  Worker
                </label>

                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

                  <select
                    id="worker"
                    value={
                      selectedWorkerId
                    }
                    onChange={(
                      event
                    ) =>
                      setWorkerId(
                        event.target
                          .value
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-zinc-400"
                  >
                    {workers.map(
                      (worker) => {
                        const queued =
                          getQueuedCount(
                            worker
                          )

                        return (
                          <option
                            key={
                              worker.id
                            }
                            value={
                              worker.id
                            }
                          >
                            {
                              worker.name
                            }
                            {queued >
                            0
                              ? ` · ${queued} queued`
                              : ""}
                          </option>
                        )
                      }
                    )}
                  </select>
                </div>

                <p className="mt-2 text-xs text-zinc-500">
                  Workers can receive
                  additional jobs while
                  they already have
                  assignments or an
                  active trip.
                </p>
              </div>

              <div>
                <label
                  htmlFor="customer"
                  className="mb-2 block text-sm font-medium"
                >
                  Customer
                </label>

                <input
                  id="customer"
                  value={
                    customerName
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomerName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Maria Garcia"
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label
                  htmlFor="destination"
                  className="mb-2 block text-sm font-medium"
                >
                  Destination
                </label>

                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />

                  <input
                    id="destination"
                    value={
                      destination
                    }
                    onChange={(
                      event
                    ) =>
                      setDestination(
                        event.target
                          .value
                      )
                    }
                    placeholder="123 Main St, San Diego, CA"
                    className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  loading
                }
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  !selectedWorkerId ||
                  !customerName.trim() ||
                  !destination.trim()
                }
                className="w-full rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 sm:w-auto"
              >
                {loading
                  ? "Adding..."
                  : "Add to route"}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-10 text-center">
            <p className="font-medium">
              No workers found
            </p>
          </div>
        )}
      </div>
    </div>
  )
}