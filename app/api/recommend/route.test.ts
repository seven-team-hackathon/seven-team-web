import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/recommend/route"
import { apiErrorSchema } from "@/lib/contracts/api-error"
import {
  recommendRequestEstimatedFixture,
  recommendRequestFixture,
  recommendationFixture,
} from "@/lib/contracts/fixtures"
import { recommendationResponseSchema } from "@/lib/contracts/recommendation"

function buildRequest(body: string): Request {
  return new Request("http://localhost/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/recommend", () => {
  it("rejects a body that is not valid json", async () => {
    vi.stubEnv("MOCK_API", "true")

    const response = await POST(buildRequest("not json"))
    const payload = apiErrorSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("invalid_input")
  })

  it("rejects a request that does not match the contract", async () => {
    vi.stubEnv("MOCK_API", "true")

    const response = await POST(
      buildRequest(JSON.stringify({ ...recommendRequestFixture, space: null }))
    )

    expect(response.status).toBe(400)
  })

  it("returns the fixture in mock mode", async () => {
    vi.stubEnv("MOCK_API", "true")

    const response = await POST(
      buildRequest(JSON.stringify(recommendRequestFixture))
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(recommendationFixture)
  })

  it("reports estimated dimensions when the request marks them as estimated", async () => {
    vi.stubEnv("MOCK_API", "true")

    const response = await POST(
      buildRequest(JSON.stringify(recommendRequestEstimatedFixture))
    )
    const payload = recommendationResponseSchema.parse(await response.json())

    expect(payload.meta.dimensionsBasis).toBe("estimated")
  })

  it("defaults the dimensions basis to user when the request omits it", async () => {
    vi.stubEnv("MOCK_API", "true")

    const { dimensionsBasis, ...space } = recommendRequestFixture.space
    const response = await POST(
      buildRequest(JSON.stringify({ ...recommendRequestFixture, space }))
    )
    const payload = recommendationResponseSchema.parse(await response.json())

    expect(dimensionsBasis).toBe("user")
    expect(payload.meta.dimensionsBasis).toBe("user")
  })

  it("reports that the pipeline is not ready when mock mode is off", async () => {
    vi.stubEnv("MOCK_API", "false")

    const response = await POST(
      buildRequest(JSON.stringify(recommendRequestFixture))
    )
    const payload = apiErrorSchema.parse(await response.json())

    expect(response.status).toBe(502)
    expect(payload.error.code).toBe("model_failed")
  })
})
