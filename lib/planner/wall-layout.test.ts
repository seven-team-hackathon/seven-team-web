import { describe, expect, it } from "vitest"
import { recommendationFixture, recommendRequestFixture } from "@/lib/contracts/fixtures"
import { arrangeOnWall, checkWallLayout, getWallSize, type WallItem } from "@/lib/planner/wall-layout"

const WALL = { widthCm: 420, heightCm: 250 }

function createItem(overrides: Partial<WallItem>): WallItem {
  return { id: "sofa", category: "sofa", widthCm: 220, heightCm: 85, x: 0, ...overrides }
}

describe("getWallSize", () => {
  it("uses the chosen side and the ceiling height", () => {
    expect(getWallSize(recommendRequestFixture.space, "length")).toEqual({ widthCm: 380, heightCm: 250 })
  })
})

describe("arrangeOnWall", () => {
  it("places items side by side and starts again from the left when the wall is full", () => {
    const items = arrangeOnWall(WALL, recommendationFixture.items)
    expect(items.map((item) => item.x)).toEqual([0, 230, 0])
    expect(checkWallLayout(WALL, items).conflicts).toEqual([])
  })
})

describe("checkWallLayout", () => {
  it("accepts items that fit along the wall", () => {
    expect(checkWallLayout(WALL, [createItem({ x: 100 })]).conflicts).toEqual([])
  })

  it("reports items past the end of the wall and taller than the ceiling", () => {
    const items = [createItem({ x: 300 }), createItem({ id: "wardrobe", category: "wardrobe", widthCm: 100, heightCm: 260 })]
    expect(checkWallLayout(WALL, items).conflicts).toEqual([
      "Sofa does not fit along the wall",
      "Wardrobe is taller than the ceiling",
    ])
  })
})
