import { describe, expect, it } from "vitest"

import {
  addUsage,
  buildClassifyUserMessage,
  classificationBatchSchema,
  estimateCostUsd,
  mergeClassification,
  parseFlags,
  readPositiveInt,
  summarizeClassified,
} from "./ingest-catalog.mjs"
import type {
  Classification,
  ClassifiedFile,
  ClassifiedItem,
  NormalizedItem,
} from "./ingest-catalog.mjs"

function buildNormalizedItem(overrides: Partial<NormalizedItem>): NormalizedItem {
  return {
    articleNo: "00000001",
    url: "https://www.ikea.com/us/en/p/test-00000001/",
    family: "test",
    categoryGuess: "sofa",
    name: "TEST Sofa",
    description: "Synthetic item used only in tests.",
    priceUsd: 100,
    currency: "USD",
    fetchedAt: "2026-11-21T12:00:00.000Z",
    measurements: [
      { label: "Width", rawText: "200 cm", valueCm: 200 },
      { label: "Height", rawText: "80 cm", valueCm: 80 },
      { label: "Seat depth", rawText: "60 cm", valueCm: 60 },
    ],
    widthCm: 200,
    depthCm: null,
    heightCm: 80,
    dimensionRules: [],
    dimensionsComplete: false,
    exclusion: null,
    ...overrides,
  }
}

function buildClassification(
  overrides: Partial<Classification>
): Classification {
  return {
    articleNo: "00000001",
    isStandaloneFurniture: true,
    category: "sofa",
    typeName: "3-seat sofa",
    roomTypes: ["living-room"],
    styleTags: ["scandinavian"],
    colors: ["gray"],
    material: "fabric",
    proposedWidthCm: 0,
    proposedDepthCm: 0,
    proposedHeightCm: 0,
    dimensionsLookWrong: false,
    confidence: 0.9,
    ...overrides,
  }
}

describe("mergeClassification", () => {
  it("keeps rule based dimensions and reports the rules source", () => {
    const item = buildNormalizedItem({ depthCm: 90 })
    const merged = mergeClassification(item, buildClassification({}))

    expect(merged.widthCm).toBe(200)
    expect(merged.depthCm).toBe(90)
    expect(merged.dimensionSource).toBe("rules")
    expect(merged.needsReview).toBe(false)
  })

  it("accepts a proposed dimension that is listed in the measurements", () => {
    const merged = mergeClassification(
      buildNormalizedItem({}),
      buildClassification({ proposedDepthCm: 60 })
    )

    expect(merged.depthCm).toBe(60)
    expect(merged.dimensionSource).toBe("model")
    expect(merged.reviewReasons).toContain("dimensions-from-model")
  })

  it("rejects a proposed dimension that is not listed in the measurements", () => {
    const merged = mergeClassification(
      buildNormalizedItem({}),
      buildClassification({ proposedDepthCm: 55 })
    )

    expect(merged.depthCm).toBeNull()
    expect(merged.dimensionSource).toBe("missing")
    expect(merged.reviewReasons).toContain("missing-dimensions")
  })

  it("ignores a zero proposal", () => {
    const merged = mergeClassification(
      buildNormalizedItem({}),
      buildClassification({ proposedDepthCm: 0 })
    )

    expect(merged.depthCm).toBeNull()
  })

  it("never overrides a rule based dimension with a proposal", () => {
    const merged = mergeClassification(
      buildNormalizedItem({ depthCm: 90 }),
      buildClassification({ proposedDepthCm: 60 })
    )

    expect(merged.depthCm).toBe(90)
  })

  it("flags low confidence", () => {
    const merged = mergeClassification(
      buildNormalizedItem({ depthCm: 90 }),
      buildClassification({ confidence: 0.3 })
    )

    expect(merged.reviewReasons).toContain("low-confidence")
    expect(merged.needsReview).toBe(true)
  })

  it("clamps a confidence above one", () => {
    const merged = mergeClassification(
      buildNormalizedItem({ depthCm: 90 }),
      buildClassification({ confidence: 4 })
    )

    expect(merged.confidence).toBe(1)
  })

  it("flags dimensions that look wrong", () => {
    const merged = mergeClassification(
      buildNormalizedItem({ depthCm: 90 }),
      buildClassification({ dimensionsLookWrong: true })
    )

    expect(merged.reviewReasons).toContain("dimensions-look-wrong")
  })
})

describe("buildClassifyUserMessage", () => {
  it("includes the article number and resolved dimensions", () => {
    const message = JSON.parse(
      buildClassifyUserMessage([buildNormalizedItem({})])
    )

    expect(message.products[0].articleNo).toBe("00000001")
    expect(message.products[0].resolvedDimensionsCm).toEqual({
      width: 200,
      depth: null,
      height: 80,
    })
  })

  it("trims long descriptions", () => {
    const message = JSON.parse(
      buildClassifyUserMessage([
        buildNormalizedItem({ description: "x".repeat(1000) }),
      ])
    )

    expect(message.products[0].description).toHaveLength(240)
  })

  it("omits measurements without a numeric value", () => {
    const message = JSON.parse(
      buildClassifyUserMessage([
        buildNormalizedItem({
          measurements: [{ label: "Size", rawText: "Full", valueCm: null }],
        }),
      ])
    )

    expect(message.products[0].measurementsCm).toEqual([])
  })
})

describe("classificationBatchSchema", () => {
  it("accepts a valid result", () => {
    const result = classificationBatchSchema.safeParse({
      items: [buildClassification({})],
    })

    expect(result.success).toBe(true)
  })

  it("rejects an unknown category", () => {
    const result = classificationBatchSchema.safeParse({
      items: [{ ...buildClassification({}), category: "lamp" }],
    })

    expect(result.success).toBe(false)
  })

  it("accepts none for items that are not furniture", () => {
    const result = classificationBatchSchema.safeParse({
      items: [
        buildClassification({ isStandaloneFurniture: false, category: "none" }),
      ],
    })

    expect(result.success).toBe(true)
  })
})

describe("estimateCostUsd", () => {
  it("prices a known model per million tokens", () => {
    const cost = estimateCostUsd("claude-haiku-5-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      requests: 1,
    })

    expect(cost).toBeCloseTo(0.6)
  })

  it("returns null for an unknown model", () => {
    expect(
      estimateCostUsd("unknown-model", {
        inputTokens: 1,
        outputTokens: 1,
        requests: 1,
      })
    ).toBeNull()
  })
})

describe("addUsage", () => {
  it("sums tokens and requests", () => {
    expect(
      addUsage(
        { inputTokens: 1, outputTokens: 2, requests: 1 },
        { inputTokens: 10, outputTokens: 20, requests: 2 }
      )
    ).toEqual({ inputTokens: 11, outputTokens: 22, requests: 3 })
  })
})

describe("parseFlags and readPositiveInt", () => {
  it("reads flag values", () => {
    const flags = parseFlags(["--limit", "20", "--model", "claude-haiku-5-5"])

    expect(flags.get("limit")).toBe("20")
    expect(flags.get("model")).toBe("claude-haiku-5-5")
  })

  it("uses the fallback for a missing or invalid number", () => {
    expect(readPositiveInt(parseFlags([]), "limit", 5)).toBe(5)
    expect(readPositiveInt(parseFlags(["--limit", "abc"]), "limit", 5)).toBe(5)
    expect(readPositiveInt(parseFlags(["--limit", "0"]), "limit", 5)).toBe(5)
  })

  it("reads a valid positive number", () => {
    expect(readPositiveInt(parseFlags(["--limit", "20"]), "limit", 5)).toBe(20)
  })
})

describe("summarizeClassified", () => {
  it("counts furniture, review items and dimension sources", () => {
    const furniture: ClassifiedItem = mergeClassification(
      buildNormalizedItem({ depthCm: 90 }),
      buildClassification({})
    )
    const notFurniture: ClassifiedItem = mergeClassification(
      buildNormalizedItem({ articleNo: "00000002", depthCm: 90 }),
      buildClassification({
        articleNo: "00000002",
        isStandaloneFurniture: false,
        category: "none",
      })
    )
    const file: ClassifiedFile = {
      model: "claude-haiku-5-5",
      items: { "00000001": furniture, "00000002": notFurniture },
      usage: { inputTokens: 1000, outputTokens: 500, requests: 2 },
    }

    const summary = summarizeClassified(file)

    expect(summary).toContain("classified: 2")
    expect(summary).toContain("standalone furniture: 1")
    expect(summary).toContain("not furniture: 1")
    expect(summary).toContain("sofa: 1")
    expect(summary).toContain("rules: 1")
  })
})
