import { describe, expect, it } from "vitest"
import { spaceDraftPlanFixture } from "@/lib/contracts/fixtures"
import type { SpaceDraft } from "@/lib/contracts/space"
import { applySamplePlanDefaults } from "@/lib/planner/sample-defaults"

const EMPTY_PLAN_DRAFT: SpaceDraft = {
  kind: "plan",
  openings: [],
  styleHints: [],
  needsUserInput: ["dimensions", "room-type"],
  rooms: [{ id: "detected-1", bounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } }],
}

describe("applySamplePlanDefaults", () => {
  it("uses the sample rooms with their types and sizes", () => {
    const draft = applySamplePlanDefaults(EMPTY_PLAN_DRAFT)
    expect(draft.rooms).toEqual(spaceDraftPlanFixture.rooms)
    expect(draft.roomType).toBe(spaceDraftPlanFixture.roomType)
    expect(draft.dimensions).toEqual(spaceDraftPlanFixture.dimensions)
  })

  it("keeps a room type the analysis found", () => {
    expect(applySamplePlanDefaults({ ...EMPTY_PLAN_DRAFT, roomType: "bedroom" }).roomType).toBe("bedroom")
  })
})
