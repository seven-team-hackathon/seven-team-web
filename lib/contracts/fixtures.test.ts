import { describe, expect, it } from "vitest"

import { apiErrorCodeSchema, apiErrorStatuses } from "@/lib/contracts/api-error"
import {
  recommendRequestEstimatedFixture,
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
  it("matches the space draft schema for a photo", () => {
    expect(spaceDraftSchema.safeParse(spaceDraftPhotoFixture).success).toBe(true)
  })

  it("matches the space draft schema for a plan with rooms", () => {
    expect(spaceDraftSchema.safeParse(spaceDraftPlanFixture).success).toBe(true)
    expect(spaceDraftPlanFixture.rooms).toHaveLength(3)
  })

  it("keeps the rooms when a plan draft is parsed", () => {
    const parsed = spaceDraftSchema.parse(spaceDraftPlanFixture)

    expect(parsed.rooms?.[0]?.bounds.width).toBeGreaterThan(0)
  })

  it("asks the user to confirm dimensions estimated from a photo", () => {
    expect(spaceDraftPhotoFixture.needsUserInput).toContain("dimensions")
    expect(spaceDraftPhotoFixture.dimensions?.source).toBe("estimated")
  })

  it("matches the recommend request schema", () => {
    expect(recommendRequestSchema.safeParse(recommendRequestFixture).success).toBe(
      true
    )
  })

  it("matches the recommend request schema without room type and style", () => {
    const result = recommendRequestSchema.safeParse(
      recommendRequestEstimatedFixture
    )

    expect(result.success).toBe(true)
    expect(recommendRequestEstimatedFixture.preferences.roomType).toBeUndefined()
    expect(recommendRequestEstimatedFixture.preferences.style).toBeUndefined()
  })

  it("marks the free text request as estimated", () => {
    expect(recommendRequestEstimatedFixture.space.dimensionsBasis).toBe(
      "estimated"
    )
  })

  it("accepts a request without a dimensions basis", () => {
    const { dimensionsBasis, ...space } = recommendRequestFixture.space
    const result = recommendRequestSchema.safeParse({
      ...recommendRequestFixture,
      space,
    })

    expect(dimensionsBasis).toBe("user")
    expect(result.success).toBe(true)
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
