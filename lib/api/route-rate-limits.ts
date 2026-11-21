import { apiErrorResponse } from "@/lib/api/api-error-response"
import { isMockApiEnabled } from "@/lib/api/mock-mode"
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit"
import type { RateLimiter } from "@/lib/api/rate-limit"

const MINUTE_MS = 60_000

export const spaceRateLimiter = createRateLimiter({
  limit: 10,
  windowMs: MINUTE_MS,
})

export const recommendRateLimiter = createRateLimiter({
  limit: 20,
  windowMs: MINUTE_MS,
})

export const visualizeRateLimiter = createRateLimiter({
  limit: 4,
  windowMs: MINUTE_MS,
})

export const visualizeGlobalRateLimiter = createRateLimiter({
  limit: 60,
  windowMs: 60 * MINUTE_MS,
})

export const globalRateLimiter = createRateLimiter({
  limit: 300,
  windowMs: 60 * MINUTE_MS,
})

export function resetRouteRateLimits(): void {
  spaceRateLimiter.reset()
  recommendRateLimiter.reset()
  globalRateLimiter.reset()
  visualizeRateLimiter.reset()
  visualizeGlobalRateLimiter.reset()
}

export function guardRateLimit(
  request: Request,
  routeLimiter: RateLimiter,
  sharedLimiter: RateLimiter = globalRateLimiter
): Response | null {
  if (isMockApiEnabled()) {
    return null
  }

  const decisions = [
    routeLimiter.check(getClientIp(request)),
    sharedLimiter.check("all"),
  ]
  const blocked = decisions.find((decision) => !decision.allowed)

  if (!blocked || blocked.allowed) {
    return null
  }

  return apiErrorResponse(
    "rate_limited",
    "Too many requests. Please try again later.",
    { "retry-after": String(blocked.retryAfterSeconds) }
  )
}
