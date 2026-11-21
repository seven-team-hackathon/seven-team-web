import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/recommend/route"
import { apiErrorSchema } from "@/lib/contracts/api-error"
import {
  recommendRequestFixture,
  recommendationFixture,
} from "@/lib/contracts/fixtures"

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
