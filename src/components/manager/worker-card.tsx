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
    label: "Available",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700",
  },

  assigned: {
    label: "Assigned",
    dot: "bg-violet-500",
    badge:
      "bg-violet-50 text-violet-700",
  },

  en_route: {
    label: "En route",
    dot: "bg-blue-500",
    badge:
      "bg-blue-50 text-blue-700",
  },

  arrived: {
    label: "Arrived",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700",
  },
}

export function WorkerCard({
  worker,
}: Props) {
  const status =
    statusStyles[worker.status]

  const [shareLink, setShareLink] =
    useState<string | null>(
      null
    )

  const [sharing, setSharing] =
    useState(false)

  const [copied, setCopied] =
    useState(false)

  const [shareError, setShareError] =
    useState<string | null>(
      null
    )

  async function handleShare() {
    if (!worker.activeTrip) {
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

    const url =
      `${window.location.origin}/live/${result.token}`

    setShareLink(url)
  }

  async function handleCopy() {
    if (!shareLink) {
      return
    }

    await navigator.clipboard.writeText(
      shareLink
    )

    setCopied(true)

    window.setTimeout(
      () => {
        setCopied(false)
      },
      1800
    )
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
            {worker.initials}
          </div>

          <div>
            <h2 className="font-semibold">
              {worker.name}
            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">
              {worker.role}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
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
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {worker.status ===
            "assigned"
              ? "Assigned trip"
              : "Current trip"}
          </p>

          <h3 className="mt-2 font-medium">
            {
              worker.activeTrip
                .customerName
            }
          </h3>

          <div className="mt-1 flex items-start gap-1.5 text-sm text-zinc-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

            {
              worker.activeTrip
                .destination
            }
          </div>

          {worker.status ===
            "assigned" && (
            <div className="mt-5 rounded-xl bg-violet-50 p-4">
              <p className="text-sm font-medium text-violet-900">
                Waiting for worker
                to start
              </p>
            </div>
          )}

          {worker.status ===
            "en_route" && (
            <div className="mt-5 rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Trip in progress
              </p>

              <p className="mt-1 text-sm text-blue-700">
                Live location is
                being tracked.
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium transition hover:bg-zinc-50"
            >
              View trip

              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={
                handleShare
              }
              disabled={sharing}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />

              {sharing
                ? "Creating..."
                : "Share tracking"}
            </button>
          </div>

          {shareLink && (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <Link2 className="h-3.5 w-3.5" />

                Client tracking link
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200">
                  {shareLink}
                </div>

                <button
                  type="button"
                  onClick={
                    handleCopy
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white"
                  aria-label="Copy tracking link"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs text-zinc-500">
                Read-only and
                automatically unavailable
                after the trip ends.
              </p>
            </div>
          )}

          {shareError && (
            <p className="mt-3 text-sm text-red-600">
              {shareError}
            </p>
          )}
        </>
      ) : (
        <div className="flex min-h-28 flex-col justify-between">
          <p className="text-sm text-zinc-500">
            No active trip assigned.
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