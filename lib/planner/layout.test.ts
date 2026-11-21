import { describe, expect, it } from "vitest"
import { recommendationFixture } from "@/lib/contracts/fixtures"
import { autoArrange, checkLayout, getItemSize, type LayoutItem } from "@/lib/planner/layout"

const ROOM = { widthCm: 420, lengthCm: 380 }

function createItem(overrides: Partial<LayoutItem>): LayoutItem {
  return { id: "item", category: "sofa", widthCm: 200, depthCm: 90, x: 0, y: 0, rotation: 0, ...overrides }
}

describe("getItemSize", () => {
  it("swaps width and depth for a quarter turn", () => {
    expect(getItemSize(createItem({ rotation: 90 }))).toEqual({ width: 90, depth: 200 })
  })
})

describe("autoArrange", () => {
  it("places every recommended item inside the room without conflicts", () => {
    const items = autoArrange(ROOM, recommendationFixture.items)
    expect(items).toHaveLength(recommendationFixture.items.length)
    expect(checkLayout(ROOM, items).conflicts).toEqual([])
  })
})

describe("checkLayout", () => {
  it("reports overlapping items", () => {
    const items = [
      createItem({ id: "sofa" }),
      createItem({ id: "table", category: "coffee-table", widthCm: 90, depthCm: 55, x: 50, y: 20 }),
    ]
    expect(checkLayout(ROOM, items).conflicts).toEqual(["Sofa overlaps coffee table"])
  })

  it("reports items outside the room", () => {
    expect(checkLayout(ROOM, [createItem({ x: 300 })]).conflicts).toEqual(["Sofa is outside the room"])
  })
})
