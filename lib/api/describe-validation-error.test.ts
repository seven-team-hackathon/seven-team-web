import { describe, expect, it } from "vitest"
import { z } from "zod"

import { describeValidationError } from "@/lib/api/describe-validation-error"

describe("describeValidationError", () => {
  it("includes the path of the first invalid field", () => {
    const schema = z.object({ preferences: z.object({ budget: z.number() }) })
    const result = schema.safeParse({ preferences: { budget: "cheap" } })

    expect(!result.success && describeValidationError(result.error)).toContain(
      "preferences.budget"
    )
  })

  it("returns only the message when there is no path", () => {
    const error = z.string().safeParse(1).error

    expect(error && describeValidationError(error)).toBe(
      error?.issues[0]?.message
    )
  })
})
