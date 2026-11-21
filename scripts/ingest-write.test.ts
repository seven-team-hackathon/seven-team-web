import { describe, expect, it } from "vitest"

import { buildCatalogRecords, summarizeCatalogRecords } from "./ingest-catalog.mjs"
import type { ClassifiedItem, NormalizedItem } from "./ingest-catalog.mjs"

function buildNormalizedItem(overrides: Partial<NormalizedItem>): NormalizedItem {
  return {
    articleNo: "00000001",
    url: "https://www.ikea.com/us/en/p/test-00000001/",
    family: "test",
    categoryGuess: "sofa",
    name: "TEST Sofa",
    description: "Synthetic item used only in tests.",
    priceUsd: 499,
    currency: "USD",
    fetchedAt: "2026-11-21T12:00:00.000Z",
    measurements: [],
    widthCm: 200,
    depthCm: 90,
    heightCm: 80,
    dimensionRules: [],
    dimensionsComplete: true,
    exclusion: null,
    ...overrides,
  }
}

function buildClassifiedItem(overrides: Partial<ClassifiedItem>): ClassifiedItem {
  return {
    isStandaloneFurniture: true,
    category: "sofa",
    typeName: "3-seat sofa",
    roomTypes: ["living-room"],
    styleTags: ["scandinavian"],
    colors: ["Gray"],
    material: "fabric",
    widthCm: 200,
    depthCm: 90,
    heightCm: 80,
    dimensionSource: "rules",
    confidence: 0.9,
    needsReview: false,
    reviewReasons: [],
    ...overrides,
  }
}

function buildRecords(
  entryOverrides: Partial<ClassifiedItem>,
  itemOverrides: Partial<NormalizedItem> = {}
) {
  return buildCatalogRecords([buildNormalizedItem(itemOverrides)], {
    "00000001": buildClassifiedItem(entryOverrides),
  })
}

describe("buildCatalogRecords", () => {
  it("builds a product and a listing for a valid item", () => {
    const records = buildRecords({})

    expect(records.skipped).toEqual([])
    expect(records.products[0]).toMatchObject({
      articleNo: "00000001",
      name: "TEST Sofa",
      typeName: "3-seat sofa",
      category: "sofa",
      widthCm: 200,
      depthCm: 90,
      heightCm: 80,
      productFamily: "test",
      aiConfidence: 0.9,
      needsReview: false,
    })
    expect(records.listings[0]).toEqual({
      articleNo: "00000001",
      market: "us",
      available: true,
      price: 499,
      currency: "USD",
      priceFetchedAt: "2026-11-21T12:00:00.000Z",
    })
  })

  it("skips items that are not furniture", () => {
    const records = buildRecords({ isStandaloneFurniture: false })

    expect(records.products).toHaveLength(0)
    expect(records.skipped[0]?.reason).toBe("not-furniture")
  })

  it("skips furniture without a category", () => {
    const records = buildRecords({ category: "none" })

    expect(records.skipped[0]?.reason).toBe("no-category")
  })

  it("skips items without a valid price", () => {
    const records = buildRecords({}, { priceUsd: 0 })

    expect(records.skipped[0]?.reason).toBe("invalid-price")
  })

  it("skips items with missing dimensions", () => {
    const records = buildRecords({ depthCm: null })

    expect(records.skipped[0]?.reason).toBe("missing-dimensions")
  })

  it("skips items whose dimensions look wrong", () => {
    const records = buildRecords({
      needsReview: true,
      reviewReasons: ["dimensions-look-wrong"],
    })

    expect(records.skipped[0]?.reason).toBe("dimensions-look-wrong")
  })

  it("skips items with low confidence", () => {
    const records = buildRecords({
      needsReview: true,
      reviewReasons: ["low-confidence"],
    })

    expect(records.skipped[0]?.reason).toBe("low-confidence")
  })

  it("skips items without room types", () => {
    const records = buildRecords({ roomTypes: [] })

    expect(records.skipped[0]?.reason).toBe("no-room-types")
  })

  it("skips items without style tags", () => {
    const records = buildRecords({ styleTags: [] })

    expect(records.skipped[0]?.reason).toBe("no-style-tags")
  })

  it("keeps items whose dimensions came from the model and flags them", () => {
    const records = buildRecords({
      dimensionSource: "model",
      needsReview: true,
      reviewReasons: ["dimensions-from-model"],
    })

    expect(records.products).toHaveLength(1)
    expect(records.products[0]?.needsReview).toBe(true)
  })

  it("omits an empty material", () => {
    const records = buildRecords({ material: "  " })

    expect(records.products[0]).not.toHaveProperty("material")
  })

  it("lowercases and dedupes colors", () => {
    const records = buildRecords({ colors: ["Gray", "gray", " ", "White"] })

    expect(records.products[0]?.colors).toEqual(["gray", "white"])
  })

  it("falls back to the name when the description is empty", () => {
    const records = buildRecords({}, { description: "" })

    expect(records.products[0]?.description).toBe("TEST Sofa")
  })

  it("adds the image url when one is known", () => {
    const records = buildCatalogRecords(
      [buildNormalizedItem({})],
      { "00000001": buildClassifiedItem({}) },
      { "00000001": "https://www.ikea.com/us/en/images/products/test.jpg" }
    )

    expect(records.products[0]?.imageUrl).toBe(
      "https://www.ikea.com/us/en/images/products/test.jpg"
    )
  })

  it("leaves the image url out when it is unknown", () => {
    const records = buildRecords({})

    expect(records.products[0]).not.toHaveProperty("imageUrl")
  })

  it("ignores items that were not classified", () => {
    const records = buildCatalogRecords(
      [buildNormalizedItem({ articleNo: "00000009" })],
      {}
    )

    expect(records.products).toHaveLength(0)
    expect(records.skipped).toHaveLength(0)
  })

  it("sorts products by article number", () => {
    const records = buildCatalogRecords(
      [
        buildNormalizedItem({ articleNo: "00000002" }),
        buildNormalizedItem({ articleNo: "00000001" }),
      ],
      {
        "00000001": buildClassifiedItem({}),
        "00000002": buildClassifiedItem({}),
      }
    )

    expect(records.products.map((product) => product.articleNo)).toEqual([
      "00000001",
      "00000002",
    ])
  })
})

describe("summarizeCatalogRecords", () => {
  it("reports written products, skipped reasons and categories", () => {
    const records = buildCatalogRecords(
      [
        buildNormalizedItem({ articleNo: "00000001" }),
        buildNormalizedItem({ articleNo: "00000002" }),
      ],
      {
        "00000001": buildClassifiedItem({}),
        "00000002": buildClassifiedItem({ depthCm: null }),
      }
    )

    const summary = summarizeCatalogRecords(records)

    expect(summary).toContain("products written: 1")
    expect(summary).toContain("skipped: 1")
    expect(summary).toContain("skipped as missing-dimensions: 1")
    expect(summary).toContain("sofa: 1")
  })
})
