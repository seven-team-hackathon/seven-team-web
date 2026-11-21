import { describe, expect, it } from "vitest"
import { boundsFromPoints, isUsableBounds } from "@/lib/planner/room-bounds"

describe("boundsFromPoints", () => {
  it("builds bounds from two corners in any order", () => {
    const bounds = boundsFromPoints({ x: 0.8, y: 0.6 }, { x: 0.2, y: 0.1 })
    expect(bounds.x).toBeCloseTo(0.2)
    expect(bounds.y).toBeCloseTo(0.1)
    expect(bounds.width).toBeCloseTo(0.6)
    expect(bounds.height).toBeCloseTo(0.5)
  })

  it("clamps points outside the image", () => {
    expect(boundsFromPoints({ x: -0.5, y: 0.5 }, { x: 1.5, y: 2 })).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 })
  })
})

describe("isUsableBounds", () => {
  it("rejects a selection that is too small", () => {
    expect(isUsableBounds({ x: 0.1, y: 0.1, width: 0.01, height: 0.5 })).toBe(false)
    expect(isUsableBounds({ x: 0.1, y: 0.1, width: 0.3, height: 0.5 })).toBe(true)
  })
})
