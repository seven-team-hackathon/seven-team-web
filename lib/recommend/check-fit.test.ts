import { describe, expect, it } from "vitest"

import type { ConfirmedSpace } from "@/lib/contracts/space"
import {
  ESTIMATED_DIMENSIONS_SAFETY_FACTOR,
  checkFit,
  effectiveSpace,
  floorAreaCm2,
  fitsRoom,
  footprintCm2,
} from "@/lib/recommend/check-fit"
import type { FitItem } from "@/lib/recommend/check-fit"

const space: ConfirmedSpace = {
  roomType: "living-room",
  dimensions: { widthCm: 400, lengthCm: 300, ceilingHeightCm: 250 },
  openings: [],
}

const spaceWithoutCeiling: ConfirmedSpace = {
  roomType: "living-room",
  dimensions: { widthCm: 400, lengthCm: 300 },
  openings: [],
}

function buildItem(overrides: Partial<FitItem>): FitItem {
  return {
    articleNo: "00000001",
    widthCm: 200,
    depthCm: 90,
    heightCm: 85,
    price: 500,
    ...overrides,
  }
}

const estimatedSpace: ConfirmedSpace = { ...space, dimensionsBasis: "estimated" }

describe("effectiveSpace", () => {
  it("keeps the dimensions when the user provided them", () => {
    expect(effectiveSpace(space)).toBe(space)
  })

  it("shrinks estimated dimensions by the safety factor", () => {
    const effective = effectiveSpace(estimatedSpace)

    expect(effective.dimensions.widthCm).toBeCloseTo(
      400 * ESTIMATED_DIMENSIONS_SAFETY_FACTOR
    )
    expect(effective.dimensions.lengthCm).toBeCloseTo(
      300 * ESTIMATED_DIMENSIONS_SAFETY_FACTOR
    )
    expect(effective.dimensions.ceilingHeightCm).toBeCloseTo(
      250 * ESTIMATED_DIMENSIONS_SAFETY_FACTOR
    )
  })

  it("keeps an unknown ceiling unknown", () => {
    const effective = effectiveSpace({
      ...spaceWithoutCeiling,
      dimensionsBasis: "estimated",
    })

    expect(effective.dimensions.ceilingHeightCm).toBeUndefined()
  })
})

describe("estimated dimensions", () => {
  it("rejects an item that only fits the full estimate", () => {
    const item = buildItem({ widthCm: 350, depthCm: 80 })

    expect(fitsRoom(item, space)).toBe(true)
    expect(fitsRoom(item, estimatedSpace)).toBe(false)
  })

  it("rejects a tall item against a shrunk ceiling", () => {
    const item = buildItem({ heightCm: 240 })

    expect(fitsRoom(item, space)).toBe(true)
    expect(fitsRoom(item, estimatedSpace)).toBe(false)
  })

  it("measures floor usage against the shrunk area", () => {
    const item = buildItem({ widthCm: 200, depthCm: 90, price: 100 })
    const exact = checkFit(space, 1000, [item])
    const estimated = checkFit(estimatedSpace, 1000, [item])

    expect(estimated.floorUsagePct).toBeGreaterThan(exact.floorUsagePct)
  })
})

describe("geometry helpers", () => {
  it("computes the floor area", () => {
    expect(floorAreaCm2(space)).toBe(120000)
  })

  it("computes the footprint of an item", () => {
    expect(footprintCm2(buildItem({ widthCm: 200, depthCm: 90 }))).toBe(18000)
  })
})

describe("fitsRoom", () => {
  it("accepts an item that fits comfortably", () => {
    expect(fitsRoom(buildItem({}), space)).toBe(true)
  })

  it("accepts an item that fits only when rotated", () => {
    expect(
      fitsRoom(buildItem({ widthCm: 60, depthCm: 350, heightCm: 80 }), space)
    ).toBe(true)
  })

  it("rejects an item longer than the wall margin allows", () => {
    expect(fitsRoom(buildItem({ widthCm: 380, depthCm: 60 }), space)).toBe(
      false
    )
  })

  it("rejects an item whose short side is too large for the room", () => {
    expect(fitsRoom(buildItem({ widthCm: 280, depthCm: 280 }), space)).toBe(
      false
    )
  })

  it("rejects an item taller than the ceiling", () => {
    expect(fitsRoom(buildItem({ heightCm: 260 }), space)).toBe(false)
  })

  it("ignores the ceiling when it is unknown", () => {
    expect(fitsRoom(buildItem({ heightCm: 400 }), spaceWithoutCeiling)).toBe(
      true
    )
  })
})

describe("checkFit", () => {
  it("reports no issues for a fitting set", () => {
    const report = checkFit(space, 1000, [
      buildItem({ articleNo: "00000001", price: 500 }),
      buildItem({
        articleNo: "00000002",
        widthCm: 100,
        depthCm: 50,
        heightCm: 45,
        price: 100,
      }),
    ])

    expect(report.allFit).toBe(true)
    expect(report.issues).toEqual([])
    expect(report.totalPrice).toBe(600)
    expect(report.floorUsagePct).toBe(19.2)
  })

  it("flags an item that does not fit the room", () => {
    const report = checkFit(space, 1000, [
      buildItem({ articleNo: "00000009", widthCm: 380, depthCm: 60 }),
    ])

    expect(report.allFit).toBe(false)
    expect(report.issues).toHaveLength(1)
    expect(report.issues[0]).toMatchObject({
      code: "item-too-wide",
      articleNo: "00000009",
    })
  })

  it("explains when an item is taller than the ceiling", () => {
    const report = checkFit(space, 1000, [buildItem({ heightCm: 260 })])

    expect(report.issues[0]?.message).toContain("taller")
  })

  it("flags furniture covering too much of the floor", () => {
    const report = checkFit(space, 10000, [
      buildItem({ articleNo: "00000001", widthCm: 200, depthCm: 200 }),
      buildItem({ articleNo: "00000002", widthCm: 200, depthCm: 200 }),
      buildItem({ articleNo: "00000003", widthCm: 200, depthCm: 200 }),
    ])

    expect(report.issues.map((issue) => issue.code)).toContain(
      "floor-usage-exceeded"
    )
    expect(report.floorUsagePct).toBe(100)
  })

  it("allows floor usage exactly at the limit", () => {
    const report = checkFit(space, 1000, [
      buildItem({ widthCm: 240, depthCm: 200, price: 100 }),
    ])

    expect(report.floorUsagePct).toBe(40)
    expect(report.issues).toEqual([])
  })

  it("flags a total price above the budget", () => {
    const report = checkFit(space, 1000, [
      buildItem({ articleNo: "00000001", price: 700 }),
      buildItem({
        articleNo: "00000002",
        widthCm: 100,
        depthCm: 50,
        price: 500,
      }),
    ])

    expect(report.totalPrice).toBe(1200)
    expect(report.issues.map((issue) => issue.code)).toContain("over-budget")
  })

  it("allows a total price equal to the budget", () => {
    const report = checkFit(space, 500, [buildItem({ price: 500 })])

    expect(report.issues).toEqual([])
  })

  it("reports several issues at once", () => {
    const report = checkFit(space, 100, [
      buildItem({ widthCm: 380, depthCm: 60, price: 500 }),
    ])

    expect(report.issues.map((issue) => issue.code)).toEqual([
      "item-too-wide",
      "over-budget",
    ])
  })

  it("rounds the total price to cents", () => {
    const report = checkFit(space, 1000, [
      buildItem({ articleNo: "00000001", price: 0.1 }),
      buildItem({ articleNo: "00000002", price: 0.2 }),
    ])

    expect(report.totalPrice).toBe(0.3)
  })

  it("handles an empty selection", () => {
    const report = checkFit(space, 1000, [])

    expect(report.allFit).toBe(true)
    expect(report.totalPrice).toBe(0)
    expect(report.floorUsagePct).toBe(0)
  })
})
