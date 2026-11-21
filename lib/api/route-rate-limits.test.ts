import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiErrorSchema } from "@/lib/contracts/api-error"
import { guardRateLimit, recommendRateLimiter, resetRouteRateLimits } from "@/lib/api/route-rate-limits"

function buildRequest(ip: string): Request {
  return new Request("http://localhost/api/recommend", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  })
}

beforeEach(() => {
  resetRouteRateLimits()
  vi.stubEnv("MOCK_API", "false")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("guardRateLimit", () => {
  it("lets requests through under the limit", () => {
    expect(guardRateLimit(buildRequest("1.1.1.1"), recommendRateLimiter)).toBeNull()
  })

  it("returns a 429 error with retry-after once the limit is exceeded", async () => {
    let response: Response | null = null

    for (let index = 0; index < 21; index += 1) {
      response = guardRateLimit(buildRequest("2.2.2.2"), recommendRateLimiter)
    }

    expect(response?.status).toBe(429)
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(apiErrorSchema.parse(await response?.json()).error.code).toBe(
      "rate_limited"
    )
  })

  it("does not block a different client", () => {
    for (let index = 0; index < 25; index += 1) {
      guardRateLimit(buildRequest("3.3.3.3"), recommendRateLimiter)
    }

    expect(guardRateLimit(buildRequest("4.4.4.4"), recommendRateLimiter)).toBeNull()
  })

  it("does nothing in mock mode", () => {
    vi.stubEnv("MOCK_API", "true")

    for (let index = 0; index < 50; index += 1) {
      expect(guardRateLimit(buildRequest("5.5.5.5"), recommendRateLimiter)).toBeNull()
    }
  })
})
