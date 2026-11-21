import { describe, expect, it } from "vitest"
import { recommendRequestEstimatedFixture, recommendRequestFixture } from "@/lib/contracts/fixtures"
import { getRoomLabel } from "@/lib/planner/room-label"

describe("getRoomLabel", () => {
  it("shows the room type and its size", () => {
    expect(getRoomLabel(recommendRequestFixture.space)).toBe("Living room · 420×380 cm")
  })

  it("marks a size estimated from a photo as approximate", () => {
    expect(getRoomLabel(recommendRequestEstimatedFixture.space)).toBe("Living room · ≈ 420×380 cm")
  })
})
