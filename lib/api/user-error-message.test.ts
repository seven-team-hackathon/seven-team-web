import { describe, expect, it } from "vitest"
import { getUserErrorMessage } from "@/lib/api/user-error-message"

describe("getUserErrorMessage", () => {
  it("maps an API error code to a user-facing message", () => {
    const body = { error: { code: "file_too_large", message: "The image must be 4 MB or smaller." } }
    expect(getUserErrorMessage(body, "Fallback")).toBe("The image must be 4 MB or smaller.")
  })

  it("hides technical messages behind the code", () => {
    const body = { error: { code: "model_failed", message: "Set MOCK_API=true to receive fixture responses." } }
    expect(getUserErrorMessage(body, "Fallback")).toBe("Something went wrong on our side. Please try again.")
  })

  it("returns the fallback for an unknown body", () => {
    expect(getUserErrorMessage({ message: "oops" }, "Fallback")).toBe("Fallback")
  })
})
