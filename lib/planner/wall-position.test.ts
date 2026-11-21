import { describe, expect, it } from "vitest"

import { getWallPosition } from "@/lib/planner/wall-position"

const wall = { widthCm: 300 }

describe("getWallPosition", () => {
  it("returns left for an item in the left third", () => {
    expect(getWallPosition({ x: 0, widthCm: 100 }, wall)).toBe("left")
  })

  it("returns center for an item in the middle", () => {
    expect(getWallPosition({ x: 100, widthCm: 100 }, wall)).toBe("center")
  })

  it("returns right for an item in the right third", () => {
    expect(getWallPosition({ x: 200, widthCm: 100 }, wall)).toBe("right")
  })

  it("uses the center of the item, not its left edge", () => {
    expect(getWallPosition({ x: 90, widthCm: 200 }, wall)).toBe("center")
  })

  it("treats an item beyond the wall as right", () => {
    expect(getWallPosition({ x: 400, widthCm: 100 }, wall)).toBe("right")
  })
})
