import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/space/route"
import { apiErrorSchema } from "@/lib/contracts/api-error"

describe("POST /api/space", () => {
  it("rejects a body that is not multipart form data", async () => {
    const response = await POST(
      new Request("http://localhost/api/space", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not a form",
      })
    )
    const payload = apiErrorSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("invalid_input")
  })
})
