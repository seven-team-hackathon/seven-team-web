import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { Preferences } from "@/lib/contracts/preferences"
import type { ConfirmedSpace } from "@/lib/contracts/space"
import {
  MAX_CANDIDATES_PER_CATEGORY,
  MAX_VARIANTS_PER_FAMILY,
  filterCandidates,
} from "@/lib/recommend/filter-candidates"

const space: ConfirmedSpace = {
  roomType: "living-room",
  dimensions: { widthCm: 400, lengthCm: 300, ceilingHeightCm: 250 },
  openings: [],
}

const preferences: Preferences = {
  market: "us",
  roomType: "living-room",
  style: "scandinavian",
  household: { hasChildren: false, hasPets: false },
  budget: 1000,
  categories: ["sofa"],
}

function buildItem(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    articleNo: "00000001",
    name: "TEST Sofa",
    typeName: "3-seat sofa",
    category: "sofa",
    roomTypes: ["living-room"],
    widthCm: 200,
    depthCm: 90,
    heightCm: 85,
    styleTags: ["scandinavian"],
    colors: ["gray"],
    description: "Synthetic item used only in tests.",
    aiConfidence: 0.9,
    needsReview: false,
    price: 400,
    currency: "USD",
    priceFetchedAt: "2026-11-21T12:00:00.000Z",
    url: "https://www.ikea.com/us/en/p/-00000001/",
    ...overrides,
  }
}

function buildNumberedItems(count: number, overrides: Partial<CatalogItem> = {}) {
  return Array.from({ length: count }, (_, index) =>
    buildItem({
      articleNo: String(index + 1).padStart(8, "0"),
      productFamily: `family-${index}`,
      ...overrides,
    })
  )
}

function articleNos(candidates: readonly CatalogItem[]): string[] {
  return candidates.map((candidate) => candidate.articleNo)
}

describe("filterCandidates", () => {
  it("returns only items of the requested category", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", category: "sofa" }),
      buildItem({ articleNo: "00000002", category: "desk" }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual(["00000001"])
  })

  it("excludes items that do not fit the room", () => {
    const catalog = [
      buildItem({ articleNo: "00000001" }),
      buildItem({ articleNo: "00000002", widthCm: 500, depthCm: 100 }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual(["00000001"])
  })

  it("excludes items above the budget share when several categories share it", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", price: 400 }),
      buildItem({ articleNo: "00000002", price: 800 }),
    ]
    const groups = filterCandidates(catalog, space, {
      ...preferences,
      categories: ["sofa", "coffee-table"],
    })

    expect(articleNos(groups[0]?.candidates ?? [])).toEqual(["00000001"])
  })

  it("allows an expensive item when it is the only category", () => {
    const catalog = [buildItem({ articleNo: "00000002", price: 900 })]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual(["00000002"])
  })

  it("excludes items above the whole budget", () => {
    const catalog = [buildItem({ articleNo: "00000001", price: 1200 })]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(group?.candidates).toEqual([])
  })

  it("ranks a style match above a non-match", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", styleTags: ["modern"] }),
      buildItem({ articleNo: "00000002", styleTags: ["scandinavian"] }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("prefers a matching room type when styles are equal", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", roomTypes: ["bedroom"] }),
      buildItem({ articleNo: "00000002", roomTypes: ["living-room"] }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("ranks items that need review below equal items", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", needsReview: true }),
      buildItem({ articleNo: "00000002", needsReview: false }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("prefers the price closest to the fair budget share on equal scores", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", price: 100 }),
      buildItem({ articleNo: "00000002", price: 450 }),
    ]
    const groups = filterCandidates(catalog, space, {
      ...preferences,
      categories: ["sofa", "coffee-table"],
    })

    expect(articleNos(groups[0]?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("breaks full ties by article number for a stable order", () => {
    const catalog = [
      buildItem({ articleNo: "00000003" }),
      buildItem({ articleNo: "00000001" }),
      buildItem({ articleNo: "00000002" }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000001",
      "00000002",
      "00000003",
    ])
  })

  it("limits the number of candidates per category", () => {
    const catalog = buildNumberedItems(20)

    const [group] = filterCandidates(catalog, space, preferences)

    expect(group?.candidates).toHaveLength(MAX_CANDIDATES_PER_CATEGORY)
    expect(group?.eligibleCount).toBe(20)
  })

  it("limits the variants taken from one product family", () => {
    const catalog = Array.from({ length: 6 }, (_, index) =>
      buildItem({
        articleNo: String(index + 1).padStart(8, "0"),
        productFamily: "same-family",
      })
    )

    const [group] = filterCandidates(catalog, space, preferences)

    expect(group?.candidates).toHaveLength(MAX_VARIANTS_PER_FAMILY)
    expect(group?.eligibleCount).toBe(6)
  })

  it("treats items without a family as separate families", () => {
    const catalog = [
      buildItem({ articleNo: "00000001" }),
      buildItem({ articleNo: "00000002" }),
      buildItem({ articleNo: "00000003" }),
    ]

    const [group] = filterCandidates(catalog, space, preferences)

    expect(group?.candidates).toHaveLength(3)
  })

  it("ranks without a style preference using the room type and price", () => {
    const catalog = [
      buildItem({
        articleNo: "00000001",
        styleTags: ["modern"],
        roomTypes: ["bedroom"],
      }),
      buildItem({
        articleNo: "00000002",
        styleTags: ["industrial"],
        roomTypes: ["living-room"],
      }),
    ]

    const [group] = filterCandidates(catalog, space, {
      ...preferences,
      style: undefined,
    })

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("falls back to the room type of the space when the preferences omit it", () => {
    const catalog = [
      buildItem({ articleNo: "00000001", roomTypes: ["bedroom"] }),
      buildItem({ articleNo: "00000002", roomTypes: ["living-room"] }),
    ]

    const [group] = filterCandidates(catalog, space, {
      ...preferences,
      roomType: undefined,
    })

    expect(articleNos(group?.candidates ?? [])).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("is more conservative when the dimensions are only estimated", () => {
    const catalog = [buildItem({ articleNo: "00000001", widthCm: 350, depthCm: 80 })]
    const estimatedSpace: ConfirmedSpace = {
      ...space,
      dimensionsBasis: "estimated",
    }

    const [exact] = filterCandidates(catalog, space, preferences)
    const [estimated] = filterCandidates(catalog, estimatedSpace, preferences)

    expect(exact?.candidates).toHaveLength(1)
    expect(estimated?.candidates).toHaveLength(0)
  })

  it("returns one group per distinct requested category", () => {
    const groups = filterCandidates([], space, {
      ...preferences,
      categories: ["sofa", "desk", "sofa"],
    })

    expect(groups.map((group) => group.category)).toEqual(["sofa", "desk"])
  })

  it("returns an empty group when no item is eligible", () => {
    const [group] = filterCandidates([], space, preferences)

    expect(group).toEqual({
      category: "sofa",
      candidates: [],
      eligibleCount: 0,
    })
  })
})
