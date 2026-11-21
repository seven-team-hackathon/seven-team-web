import { describe, expect, it } from "vitest"

import { spaceDraftSchema } from "@/lib/contracts/space"
import {
  MAX_PHOTO_DIMENSIONS_CONFIDENCE,
  buildSpaceDraft,
  extractSpaceFromPhoto,
} from "@/lib/space/extract-space"
import type { PhotoAnalysis, PhotoAnalyzer } from "@/lib/space/photo-analysis"

function buildAnalysis(overrides: Partial<PhotoAnalysis>): PhotoAnalysis {
  return {
    isRoomPhoto: true,
    roomType: "living-room",
    estimatedWidthCm: 400,
    estimatedDepthCm: 350,
    estimatedCeilingHeightCm: 250,
    dimensionsConfidence: 0.5,
    referenceObjects: ["door"],
    openings: [{ type: "door", widthCm: 80 }],
    styleHints: ["light walls"],
    ...overrides,
  }
}

function buildFile(type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], "room", { type })
}

const usage = { inputTokens: 100, outputTokens: 50 }

describe("buildSpaceDraft", () => {
  it("builds a draft that matches the contract", () => {
    const draft = buildSpaceDraft(buildAnalysis({}))

    expect(spaceDraftSchema.safeParse(draft).success).toBe(true)
    expect(draft).toMatchObject({
      kind: "photo",
      roomType: "living-room",
      dimensions: {
        widthCm: 400,
        lengthCm: 350,
        ceilingHeightCm: 250,
        source: "estimated",
        confidence: 0.5,
      },
    })
  })

  it("always asks the user to confirm dimensions", () => {
    expect(buildSpaceDraft(buildAnalysis({}))?.needsUserInput).toContain(
      "dimensions"
    )
  })

  it("returns null when the image is not a room", () => {
    expect(buildSpaceDraft(buildAnalysis({ isRoomPhoto: false }))).toBeNull()
  })

  it("omits dimensions when the model could not estimate them", () => {
    const draft = buildSpaceDraft(
      buildAnalysis({ estimatedWidthCm: 0, estimatedDepthCm: 0 })
    )

    expect(draft?.dimensions).toBeUndefined()
    expect(draft?.needsUserInput).toContain("dimensions")
  })

  it("omits the ceiling when it is not visible", () => {
    const draft = buildSpaceDraft(
      buildAnalysis({ estimatedCeilingHeightCm: 0 })
    )

    expect(draft?.dimensions).not.toHaveProperty("ceilingHeightCm")
  })

  it("caps the confidence of estimates from a photo", () => {
    const draft = buildSpaceDraft(buildAnalysis({ dimensionsConfidence: 0.99 }))

    expect(draft?.dimensions?.confidence).toBe(MAX_PHOTO_DIMENSIONS_CONFIDENCE)
  })

  it("bounds an invalid confidence", () => {
    expect(
      buildSpaceDraft(buildAnalysis({ dimensionsConfidence: -3 }))?.dimensions
        ?.confidence
    ).toBe(0)
    expect(
      buildSpaceDraft(buildAnalysis({ dimensionsConfidence: Number.NaN }))
        ?.dimensions?.confidence
    ).toBe(0)
  })

  it("clamps absurd sizes to the contract maximum", () => {
    const draft = buildSpaceDraft(buildAnalysis({ estimatedWidthCm: 99999 }))

    expect(draft?.dimensions?.widthCm).toBe(2000)
    expect(spaceDraftSchema.safeParse(draft).success).toBe(true)
  })

  it("asks for the room type when it is unknown", () => {
    const draft = buildSpaceDraft(buildAnalysis({ roomType: "unknown" }))

    expect(draft).not.toHaveProperty("roomType")
    expect(draft?.needsUserInput).toContain("room-type")
  })

  it("keeps openings and drops unknown widths", () => {
    const draft = buildSpaceDraft(
      buildAnalysis({
        openings: [
          { type: "door", widthCm: 90 },
          { type: "window", widthCm: 0 },
        ],
      })
    )

    expect(draft?.openings).toEqual([
      { type: "door", widthCm: 90 },
      { type: "window" },
    ])
  })

  it("cleans, dedupes and limits style hints", () => {
    const draft = buildSpaceDraft(
      buildAnalysis({
        styleHints: [" light walls ", "light walls", "", "a", "b", "c", "d", "e"],
      })
    )

    expect(draft?.styleHints).toEqual(["light walls", "a", "b", "c", "d"])
  })

  it("truncates a very long style hint", () => {
    const draft = buildSpaceDraft(buildAnalysis({ styleHints: ["x".repeat(200)] }))

    expect(draft?.styleHints[0]).toHaveLength(60)
    expect(spaceDraftSchema.safeParse(draft).success).toBe(true)
  })
})

describe("extractSpaceFromPhoto", () => {
  it("returns the draft and the usage on success", async () => {
    const analyze: PhotoAnalyzer = async () => ({
      kind: "ok",
      analysis: buildAnalysis({}),
      usage,
    })

    const result = await extractSpaceFromPhoto(buildFile(), analyze)

    expect(result.ok && result.draft.kind).toBe("photo")
    expect(result.ok && result.usage).toEqual(usage)
  })

  it("sends the image as base64 with its media type", async () => {
    let received: { base64: string; mediaType: string } | null = null
    const analyze: PhotoAnalyzer = async (image) => {
      received = { base64: image.base64, mediaType: image.mediaType }

      return { kind: "ok", analysis: buildAnalysis({}), usage }
    }

    await extractSpaceFromPhoto(buildFile("image/png"), analyze)

    expect(received).toEqual({ base64: "AQID", mediaType: "image/png" })
  })

  it("rejects an unsupported media type without calling the model", async () => {
    let called = false
    const analyze: PhotoAnalyzer = async () => {
      called = true

      return { kind: "ok", analysis: buildAnalysis({}), usage }
    }

    const result = await extractSpaceFromPhoto(buildFile("image/gif"), analyze)

    expect(!result.ok && result.code).toBe("unsupported_media_type")
    expect(called).toBe(false)
  })

  it("reports an unreadable space when the image is not a room", async () => {
    const analyze: PhotoAnalyzer = async () => ({
      kind: "ok",
      analysis: buildAnalysis({ isRoomPhoto: false }),
      usage,
    })

    const result = await extractSpaceFromPhoto(buildFile(), analyze)

    expect(!result.ok && result.code).toBe("unreadable_space")
  })

  it("maps a timeout to the timeout error", async () => {
    const analyze: PhotoAnalyzer = async () => ({
      kind: "failed",
      reason: "timeout",
      message: "slow",
    })

    const result = await extractSpaceFromPhoto(buildFile(), analyze)

    expect(!result.ok && result.code).toBe("timeout")
  })

  it.each(["refusal", "truncated", "unparsed", "upstream"] as const)(
    "maps a %s failure to model_failed",
    async (reason) => {
      const analyze: PhotoAnalyzer = async () => ({
        kind: "failed",
        reason,
        message: "failed",
      })

      const result = await extractSpaceFromPhoto(buildFile(), analyze)

      expect(!result.ok && result.code).toBe("model_failed")
    }
  )
})
