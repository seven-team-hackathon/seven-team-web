export type RateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number }

export type RateLimiter = {
  readonly check: (key: string) => RateLimitDecision
  readonly reset: () => void
}

type Window = {
  count: number
  resetAt: number
}

export function createRateLimiter(options: {
  readonly limit: number
  readonly windowMs: number
  readonly now?: () => number
}): RateLimiter {
  const windows = new Map<string, Window>()
  const now = options.now ?? Date.now

  function prune(current: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= current) {
        windows.delete(key)
      }
    }
  }

  return {
    check(key) {
      const current = now()

      if (windows.size > 1000) {
        prune(current)
      }

      const existing = windows.get(key)

      if (!existing || existing.resetAt <= current) {
        windows.set(key, { count: 1, resetAt: current + options.windowMs })

        return { allowed: true }
      }

      if (existing.count >= options.limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAt - current) / 1000)
          ),
        }
      }

      existing.count += 1

      return { allowed: true }
    },
    reset() {
      windows.clear()
    },
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
}
