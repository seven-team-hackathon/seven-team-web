import { describe, expect, it } from "vitest"

import { apiErrorCodeSchema, apiErrorStatuses } from "@/lib/contracts/api-error"
import {
  recommendRequestFixture,
  recommendationFixture,
  spaceDraftPhotoFixture,
  spaceDraftPlanFixture,
} from "@/lib/contracts/fixtures"
import {
  recommendRequestSchema,
  recommendationResponseSchema,
} from "@/lib/contracts/recommendation"
import { spaceDraftSchema } from "@/lib/contracts/space"

describe("contract fixtures", () => {
  it("matches the space draft schema for a plan", () => {
    expect(spaceDraftSchema.safeParse(spaceDraftPlanFixture).success).toBe(true)
  })

  it("matches the space draft schema for a photo", () => {
    expect(spaceDraftSchema.safeParse(spaceDraftPhotoFixture).success).toBe(true)
  })

  it("detects every room of a multi-room plan with its own bounds", () => {
    const rooms = spaceDraftPlanFixture.rooms ?? []
    expect(rooms.map((room) => room.roomType)).toEqual(["living-room", "bedroom", "hallway"])
    expect(new Set(rooms.map((room) => room.id)).size).toBe(rooms.length)
  })

  it("asks the user for dimensions when the space comes from a photo", () => {
    expect(spaceDraftPhotoFixture.needsUserInput).toContain("dimensions")
  })

  it("matches the recommend request schema", () => {
    expect(recommendRequestSchema.safeParse(recommendRequestFixture).success).toBe(
      true
    )
  })

  it("matches the recommendation response schema", () => {
    expect(
      recommendationResponseSchema.safeParse(recommendationFixture).success
    ).toBe(true)
  })

  it("covers every requested category in the recommendation", () => {
    const recommendedCategories = recommendationFixture.items.map(
      (item) => item.category
    )

    expect(recommendedCategories).toEqual(
      recommendRequestFixture.preferences.categories
    )
  })
})

describe("api error statuses", () => {
  it("defines an http error status for every error code", () => {
    for (const code of apiErrorCodeSchema.options) {
      expect(apiErrorStatuses[code]).toBeGreaterThanOrEqual(400)
    }
  })
})
