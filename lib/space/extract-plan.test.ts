import { describe, expect, it } from "vitest"

import { spaceDraftSchema } from "@/lib/contracts/space"
import {
  MAX_ESTIMATED_CONFIDENCE,
  MAX_LABELED_CONFIDENCE,
  buildPlanDraft,
  extractSpaceFromPlan,
} from "@/lib/space/extract-plan"
import type { PlanAnalysis, PlanAnalyzer } from "@/lib/space/plan-analysis"

type PlanRoom = PlanAnalysis["rooms"][number]

function buildRoom(overrides: Partial<PlanRoom>): PlanRoom {
  return {
    label: "Living",
    roomType: "living-room",
    bounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
    widthCm: 420,
    lengthCm: 380,
    sizeSource: "labels",
    sizeConfidence: 0.8,
    ceilingHeightCm: 0,
    ...overrides,
  }
}

function buildAnalysis(rooms: PlanRoom[], isFloorPlan = true): PlanAnalysis {
  return { isFloorPlan, rooms }
}

function buildFile(type = "image/png"): File {
  return new File([new Uint8Array([1, 2, 3])], "plan", { type })
}

const usage = { inputTokens: 100, outputTokens: 50 }

describe("buildPlanDraft", () => {
  it("builds rooms that match the contract", () => {
    const draft = buildPlanDraft(
      buildAnalysis([buildRoom({}), buildRoom({ roomType: "bedroom" })])
    )

    expect(spaceDraftSchema.safeParse(draft).success).toBe(true)
    expect(draft?.kind).toBe("plan")
    expect(draft?.rooms?.map((room) => room.id)).toEqual(["room-1", "room-2"])
  })

  it("returns null when the image is not a floor plan", () => {
    expect(buildPlanDraft(buildAnalysis([], false))).toBeNull()
  })

  it("marks sizes read from labels as plan-labels", () => {
    const draft = buildPlanDraft(buildAnalysis([buildRoom({})]))

    expect(draft?.rooms?.[0]?.dimensions).toMatchObject({
      widthCm: 420,
      lengthCm: 380,
      source: "plan-labels",
      confidence: 0.8,
    })
  })

  it("caps the confidence of labeled and estimated sizes", () => {
    const draft = buildPlanDraft(
      buildAnalysis([
        buildRoom({ sizeConfidence: 1 }),
        buildRoom({ sizeSource: "estimated", sizeConfidence: 1 }),
      ])
    )

    expect(draft?.rooms?.[0]?.dimensions?.confidence).toBe(MAX_LABELED_CONFIDENCE)
    expect(draft?.rooms?.[1]?.dimensions?.source).toBe("estimated")
    expect(draft?.rooms?.[1]?.dimensions?.confidence).toBe(MAX_ESTIMATED_CONFIDENCE)
  })

  it("omits dimensions when the size source is unknown", () => {
    const draft = buildPlanDraft(
      buildAnalysis([buildRoom({ sizeSource: "unknown", widthCm: 0, lengthCm: 0 })])
    )

    expect(draft?.rooms?.[0]).not.toHaveProperty("dimensions")
    expect(draft?.needsUserInput).toContain("dimensions")
  })

  it("keeps the ceiling height only when it is stated", () => {
    const draft = buildPlanDraft(
      buildAnalysis([buildRoom({ ceilingHeightCm: 250 }), buildRoom({})])
    )

    expect(draft?.rooms?.[0]?.dimensions?.ceilingHeightCm).toBe(250)
    expect(draft?.rooms?.[1]?.dimensions).not.toHaveProperty("ceilingHeightCm")
  })

  it("drops the room type for other and unknown rooms", () => {
    const draft = buildPlanDraft(
      buildAnalysis([buildRoom({ roomType: "other" }), buildRoom({ roomType: "unknown" })])
    )

    expect(draft?.rooms?.[0]).not.toHaveProperty("roomType")
    expect(draft?.rooms?.[1]).not.toHaveProperty("roomType")
  })

  it("clamps bounds into the image", () => {
    const draft = buildPlanDraft(
      buildAnalysis([buildRoom({ bounds: { x: 0.8, y: -0.2, width: 0.5, height: 0.3 } })])
    )

    const bounds = draft?.rooms?.[0]?.bounds

    expect(bounds?.x).toBe(0.8)
    expect(bounds?.y).toBe(0)
    expect(bounds?.width).toBeCloseTo(0.2)
    expect(bounds?.height).toBeCloseTo(0.3)
  })

  it("drops rooms with unusable bounds", () => {
    const draft = buildPlanDraft(
      buildAnalysis([
        buildRoom({ bounds: { x: 0.1, y: 0.1, width: 0.01, height: 0.4 } }),
        buildRoom({}),
      ])
    )

    expect(draft?.rooms).toHaveLength(1)
    expect(draft?.rooms?.[0]?.id).toBe("room-1")
  })

  it("clamps absurd sizes to the contract maximum", () => {
    const draft = buildPlanDraft(buildAnalysis([buildRoom({ widthCm: 99999 })]))

    expect(draft?.rooms?.[0]?.dimensions?.widthCm).toBe(2000)
    expect(spaceDraftSchema.safeParse(draft).success).toBe(true)
  })

  it("returns an empty room list so the UI can fall back to manual selection", () => {
    const draft = buildPlanDraft(buildAnalysis([]))

    expect(draft?.rooms).toEqual([])
    expect(draft?.needsUserInput).toContain("dimensions")
  })

  it("copies the only room to the top level of the draft", () => {
    const draft = buildPlanDraft(buildAnalysis([buildRoom({})]))

    expect(draft?.roomType).toBe("living-room")
    expect(draft?.dimensions?.widthCm).toBe(420)
  })

  it("does not copy a room to the top level when there are several", () => {
    const draft = buildPlanDraft(buildAnalysis([buildRoom({}), buildRoom({})]))

    expect(draft).not.toHaveProperty("dimensions")
  })

  it("limits the number of rooms", () => {
    const draft = buildPlanDraft(
      buildAnalysis(Array.from({ length: 30 }, () => buildRoom({})))
    )

    expect(draft?.rooms).toHaveLength(12)
  })
})

describe("extractSpaceFromPlan", () => {
  it("returns the draft and usage on success", async () => {
    const analyze: PlanAnalyzer = async () => ({
      kind: "ok",
      analysis: buildAnalysis([buildRoom({})]),
      usage,
    })

    const result = await extractSpaceFromPlan(buildFile(), analyze)

    expect(result.ok && result.draft.kind).toBe("plan")
    expect(result.ok && result.usage).toEqual(usage)
  })

  it("rejects an unsupported media type without calling the model", async () => {
    let called = false
    const analyze: PlanAnalyzer = async () => {
      called = true

      return { kind: "ok", analysis: buildAnalysis([]), usage }
    }

    const result = await extractSpaceFromPlan(buildFile("application/pdf"), analyze)

    expect(!result.ok && result.code).toBe("unsupported_media_type")
    expect(called).toBe(false)
  })

  it("reports an unreadable space when the image is not a plan", async () => {
    const analyze: PlanAnalyzer = async () => ({
      kind: "ok",
      analysis: buildAnalysis([], false),
      usage,
    })

    const result = await extractSpaceFromPlan(buildFile(), analyze)

    expect(!result.ok && result.code).toBe("unreadable_space")
  })

  it("maps a timeout and other failures to api errors", async () => {
    const timeout: PlanAnalyzer = async () => ({ kind: "failed", reason: "timeout", message: "slow" })
    const upstream: PlanAnalyzer = async () => ({ kind: "failed", reason: "upstream", message: "down" })

    expect((await extractSpaceFromPlan(buildFile(), timeout)).ok).toBe(false)
    const timed = await extractSpaceFromPlan(buildFile(), timeout)
    const failed = await extractSpaceFromPlan(buildFile(), upstream)

    expect(!timed.ok && timed.code).toBe("timeout")
    expect(!failed.ok && failed.code).toBe("model_failed")
  })
})
