import { describe, expect, it } from "vitest"

import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit"

function buildClock(start = 1_000) {
  let current = start

  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: buildClock().now })

    expect(limiter.check("a").allowed).toBe(true)
    expect(limiter.check("a").allowed).toBe(true)
  })

  it("blocks the request over the limit and reports when to retry", () => {
    const clock = buildClock()
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, now: clock.now })

    limiter.check("a")
    clock.advance(3_000)
    const decision = limiter.check("a")

    expect(decision.allowed).toBe(false)
    expect(!decision.allowed && decision.retryAfterSeconds).toBe(7)
  })

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: buildClock().now })

    limiter.check("a")

    expect(limiter.check("b").allowed).toBe(true)
  })

  it("allows requests again after the window passes", () => {
    const clock = buildClock()
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now })

    limiter.check("a")
    clock.advance(1001)

    expect(limiter.check("a").allowed).toBe(true)
  })

  it("forgets everything on reset", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: buildClock().now })

    limiter.check("a")
    limiter.reset()

    expect(limiter.check("a").allowed).toBe(true)
  })

  it("prunes expired windows when many keys accumulate", () => {
    const clock = buildClock()
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now })

    for (let index = 0; index < 1100; index += 1) {
      limiter.check(`key-${index}`)
    }

    clock.advance(2000)

    expect(limiter.check("key-0").allowed).toBe(true)
  })
})

describe("getClientIp", () => {
  it("uses the first address of x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    })

    expect(getClientIp(request)).toBe("1.2.3.4")
  })

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "5.6.7.8" },
    })

    expect(getClientIp(request)).toBe("5.6.7.8")
  })

  it("returns unknown when there is no address header", () => {
    expect(getClientIp(new Request("http://localhost"))).toBe("unknown")
  })
})
