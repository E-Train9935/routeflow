import { Navigation } from "lucide-react"

import { login } from "./actions"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <Navigation className="h-5 w-5" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Sign in to RouteFlow.
          </p>
        </div>

        <form action={login} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
            />
          </div>

          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}