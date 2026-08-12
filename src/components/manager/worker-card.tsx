"use client"

import {
  useState,
} from "react"

import {
  Check,
  ChevronRight,
  Copy,
  Link2,
  MapPin,
  Share2,
} from "lucide-react"

import {
  createTrackingShare,
} from "@/app/manager/actions"

import type {
  WorkerCardData,
} from "@/types/operations"

type Props = {
  worker: WorkerCardData
}

const statusStyles = {
  available: {
    label:
      "Available",

    dot:
      "bg-emerald-500",

    badge:
      "bg-emerald-50 text-emerald-700",
  },

  assigned: {
    label:
      "Assigned",

    dot:
      "bg-violet-500",

    badge:
      "bg-violet-50 text-violet-700",
  },

  en_route: {
    label:
      "En route",

    dot:
      "bg-blue-500",

    badge:
      "bg-blue-50 text-blue-700",
  },

  arrived: {
    label:
      "Arrived",

    dot:
      "bg-amber-500",

    badge:
      "bg-amber-50 text-amber-700",
  },
}

export function WorkerCard({
  worker,
}: Props) {
  const status =
    statusStyles[
      worker.status
    ]

  const [
    shareLink,
    setShareLink,
  ] =
    useState<
      string | null
    >(null)

  const [
    sharing,
    setSharing,
  ] =
    useState(false)

  const [
    copied,
    setCopied,
  ] =
    useState(false)

  const [
    shareError,
    setShareError,
  ] =
    useState<
      string | null
    >(null)

  const totalAssigned =
    worker.queuedTrips.length +
    (
      worker.status ===
      "assigned"
        ? 1
        : 0
    )

  async function handleShare() {
    if (
      !worker.activeTrip
    ) {
      return
    }

    setSharing(true)
    setShareError(null)

    const result =
      await createTrackingShare(
        worker.activeTrip.id
      )

    setSharing(false)

    if (
      !result.ok ||
      !result.token
    ) {
      setShareError(
        result.error ??
          "Could not create tracking link."
      )

      return
    }

    setShareLink(
      `${window.location.origin}/live/${result.token}`
    )
  }

  async function handleCopy() {
    if (!shareLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        shareLink
      )

      setCopied(true)

      window.setTimeout(
        () =>
          setCopied(false),
        1800
      )
    } catch (error) {
      console.error(
        "Could not copy tracking link:",
        error
      )

      setShareError(
        "Could not copy the tracking link."
      )
    }
  }

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
            {worker.initials}
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {worker.name}
            </h2>

            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {worker.role}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
          />

          {status.label}
        </div>
      </div>

      <div className="my-5 border-t border-zinc-100" />

      {worker.activeTrip ? (
        <>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-xs font-medium uppercase tracking-wider text-zinc-400">
              {worker.status ===
              "assigned"
                ? "Up next"
                : "Current trip"}
            </p>

            {totalAssigned >
              0 && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                {totalAssigned} queued
              </span>
            )}
          </div>

          <h3 className="mt-2 break-words font-medium">
            {
              worker.activeTrip
                .customerName
            }
          </h3>

          <div className="mt-1 flex min-w-0 items-start gap-1.5 text-sm text-zinc-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

            <span className="min-w-0 break-words leading-5">
              {
                worker.activeTrip
                  .destination
              }
            </span>
          </div>

          {worker.status ===
            "assigned" && (
            <div className="mt-5 rounded-xl bg-violet-50 p-4">
              <p className="text-sm font-medium text-violet-900">
                Waiting for worker
                to start
              </p>

              {worker
                .queuedTrips
                .length > 0 && (
                <p className="mt-1 text-sm leading-5 text-violet-700">
                  {
                    worker
                      .queuedTrips
                      .length
                  }{" "}
                  additional{" "}
                  {worker
                    .queuedTrips
                    .length ===
                  1
                    ? "trip is"
                    : "trips are"}{" "}
                  queued after this
                  stop.
                </p>
              )}
            </div>
          )}

          {worker.status ===
            "en_route" && (
            <div className="mt-5 rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Trip in progress
              </p>

              <p className="mt-1 text-sm leading-5 text-blue-700">
                Live location is
                being tracked.
                {worker
                  .queuedTrips
                  .length > 0
                  ? ` ${worker.queuedTrips.length} more ${
                      worker
                        .queuedTrips
                        .length ===
                      1
                        ? "trip"
                        : "trips"
                    } queued.`
                  : ""}
              </p>
            </div>
          )}

          {worker.status ===
            "arrived" && (
            <div className="mt-5 rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Worker has arrived
              </p>

              <p className="mt-1 text-sm leading-5 text-amber-700">
                Location sharing has
                stopped until the next
                trip begins.
              </p>
            </div>
          )}

          <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="flex min-w-0 items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium transition active:bg-zinc-50 sm:hover:bg-zinc-50"
            >
              <span className="truncate">
                View trip
              </span>

              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={
                handleShare
              }
              disabled={
                sharing
              }
              className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition active:bg-zinc-800 disabled:opacity-50 sm:hover:bg-zinc-800"
            >
              <Share2 className="h-4 w-4 shrink-0" />

              <span className="truncate">
                {sharing
                  ? "Creating..."
                  : "Share tracking"}
              </span>
            </button>
          </div>

          {shareLink && (
            <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-500">
                <Link2 className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  Client tracking link
                </span>
              </div>

              <div className="mt-2 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="min-w-0 overflow-hidden rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                  <p className="truncate text-xs text-zinc-600">
                    {shareLink}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleCopy
                  }
                  aria-label={
                    copied
                      ? "Tracking link copied"
                      : "Copy tracking link"
                  }
                  className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-2.5 text-xs font-medium text-white transition active:bg-zinc-800 min-[360px]:px-3"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 shrink-0" />

                      <span className="hidden min-[360px]:inline">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 shrink-0" />

                      <span className="hidden min-[360px]:inline">
                        Copy
                      </span>
                    </>
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Read-only and
                automatically unavailable
                after the trip ends.
              </p>
            </div>
          )}

          {shareError && (
            <p className="mt-3 break-words text-sm text-red-600">
              {shareError}
            </p>
          )}
        </>
      ) : (
        <div className="flex min-h-28 flex-col justify-between">
          <p className="text-sm text-zinc-500">
            No trips currently
            assigned.
          </p>

          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            Ready for assignment
          </div>
        </div>
      )}
    </article>
  )
}