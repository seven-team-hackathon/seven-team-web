import { describe, expect, it } from "vitest"
import { estimateRoomSize, getTypicalRoomSize } from "@/lib/planner/estimate-room-size"
import type { DetectedRoom } from "@/lib/planner/plan-rooms"

const IMAGE = { width: 1000, height: 1000 }

const LABELED_ROOM: DetectedRoom = {
  id: "room-1",
  roomType: "living-room",
  dimensions: { widthCm: 400, lengthCm: 400, source: "plan-labels", confidence: 0.8 },
  bounds: { x: 0, y: 0, width: 0.5, height: 0.5 },
}

const SMALL_ROOM: DetectedRoom = {
  id: "room-2",
  bounds: { x: 0.5, y: 0, width: 0.25, height: 0.5 },
}

const BIG_ROOM: DetectedRoom = {
  id: "room-3",
  bounds: { x: 0, y: 0.5, width: 0.5, height: 0.5 },
}

describe("estimateRoomSize", () => {
  it("keeps the sizes the analysis found", () => {
    expect(estimateRoomSize(LABELED_ROOM, [LABELED_ROOM], IMAGE)).toEqual({
      widthCm: 400,
      lengthCm: 400,
      ceilingHeightCm: 250,
    })
  })

  it("estimates a room from the scale of measured rooms on the same plan", () => {
    expect(estimateRoomSize(SMALL_ROOM, [LABELED_ROOM, SMALL_ROOM], IMAGE)).toEqual({
      widthCm: 200,
      lengthCm: 400,
      ceilingHeightCm: 250,
    })
  })

  it("keeps the proportions between rooms when nothing is measured", () => {
    const rooms = [SMALL_ROOM, BIG_ROOM]
    const small = estimateRoomSize(SMALL_ROOM, rooms, IMAGE)
    const big = estimateRoomSize(BIG_ROOM, rooms, IMAGE)
    expect(Math.abs(big.widthCm - small.widthCm * 2)).toBeLessThanOrEqual(10)
    expect(big.lengthCm).toBe(small.lengthCm)
    expect(big.widthCm * big.lengthCm).toBeGreaterThan(small.widthCm * small.lengthCm)
  })
})

describe("getTypicalRoomSize", () => {
  it("uses a default size when the room type is unknown", () => {
    expect(getTypicalRoomSize(null)).toEqual({ widthCm: 350, lengthCm: 300, ceilingHeightCm: 250 })
  })
})
