import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/lib/catalog/load-catalog"
import { recommendationResponseSchema } from "@/lib/contracts/recommendation"
import type { RecommendRequest } from "@/lib/contracts/recommendation"
import { enforceBudget, recommend } from "@/lib/recommend/recommend"
import type { Selection } from "@/lib/recommend/recommend"
import type { Ranker } from "@/lib/recommend/rank-with-claude"

function buildItem(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    articleNo: "00000001",
    name: "TEST Sofa",
    typeName: "3-seat sofa",
    category: "sofa",
    roomTypes: ["living-room"],
    widthCm: 200,
    depthCm: 90,
    heightCm: 80,
    styleTags: ["scandinavian"],
    colors: ["gray"],
    description: "Synthetic.",
    aiConfidence: 0.9,
    needsReview: false,
    price: 300,
    currency: "USD",
    priceFetchedAt: "2026-11-21T12:00:00.000Z",
    url: "https://www.ikea.com/us/en/p/-00000001/",
    ...overrides,
  }
}

const catalog: CatalogItem[] = [
  buildItem({ articleNo: "00000001", price: 300 }),
  buildItem({ articleNo: "00000002", price: 500 }),
  buildItem({
    articleNo: "00000003",
    category: "desk",
    typeName: "Desk",
    price: 150,
    widthCm: 120,
    depthCm: 60,
    heightCm: 75,
    url: "https://www.ikea.com/us/en/p/-00000003/",
  }),
]

const request: RecommendRequest = {
  space: {
    roomType: "living-room",
    dimensions: { widthCm: 400, lengthCm: 300, ceilingHeightCm: 250 },
    openings: [],
  },
  preferences: {
    market: "us",
    style: "scandinavian",
    household: { hasChildren: false, hasPets: false },
    budget: 1000,
    categories: ["sofa", "desk"],
  },
}

const okRanker: Ranker = async () => ({
  kind: "ok",
  categories: [
    {
      category: "sofa",
      picks: [
        { articleNo: "00000002", reason: "Best sofa." },
        { articleNo: "00000001", reason: "Cheaper sofa." },
      ],
    },
    { category: "desk", picks: [{ articleNo: "00000003", reason: "Good desk." }] },
  ],
  usage: { inputTokens: 1000, outputTokens: 200 },
})

describe("recommend", () => {
  it("builds a response that matches the contract", async () => {
    const response = await recommend(request, { catalog, ranker: okRanker })

    expect(recommendationResponseSchema.safeParse(response).success).toBe(true)
    expect(response.meta.rankedBy).toBe("claude")
  })

  it("uses the model picks and reasons, with links from the catalog", async () => {
    const response = await recommend(request, { catalog, ranker: okRanker })
    const sofa = response.items.find((entry) => entry.category === "sofa")

    expect(sofa?.primary.articleNo).toBe("00000002")
    expect(sofa?.primary.reason).toBe("Best sofa.")
    expect(sofa?.primary.url).toBe(
      catalog.find((item) => item.articleNo === "00000002")?.url
    )
    expect(sofa?.alternatives.map((item) => item.articleNo)).toEqual([
      "00000001",
    ])
  })

  it("reports usage and totals", async () => {
    const response = await recommend(request, { catalog, ranker: okRanker })

    expect(response.usage.inputTokens).toBe(1000)
    expect(response.totals.price).toBe(650)
    expect(response.totals.budget).toBe(1000)
  })

  it("falls back to deterministic picks when the ranker fails", async () => {
    const response = await recommend(request, {
      catalog,
      ranker: async () => ({ kind: "failed", message: "down" }),
    })

    expect(response.meta.rankedBy).toBe("fallback")
    expect(response.items).toHaveLength(2)
    expect(response.items[0]?.primary.reason.length).toBeGreaterThan(0)
    expect(response.usage.inputTokens).toBe(0)
  })

  it("falls back for a category the model skipped", async () => {
    const response = await recommend(request, {
      catalog,
      ranker: async () => ({
        kind: "ok",
        categories: [
          {
            category: "sofa",
            picks: [{ articleNo: "00000001", reason: "Sofa." }],
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
    })

    expect(response.items.map((entry) => entry.category)).toEqual([
      "sofa",
      "desk",
    ])
    expect(response.meta.rankedBy).toBe("fallback")
  })

  it("never returns an article that was not a candidate", async () => {
    const response = await recommend(request, {
      catalog,
      ranker: async () => ({
        kind: "ok",
        categories: [
          {
            category: "sofa",
            picks: [{ articleNo: "99999999", reason: "Invented." }],
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    })
    const known = new Set(catalog.map((item) => item.articleNo))

    for (const entry of response.items) {
      expect(known.has(entry.primary.articleNo)).toBe(true)
    }
  })

  it("lists categories without candidates and skips the model when none match", async () => {
    let called = false
    const response = await recommend(
      {
        ...request,
        preferences: { ...request.preferences, categories: ["wardrobe"] },
      },
      {
        catalog,
        ranker: async () => {
          called = true

          return { kind: "failed", message: "unused" }
        },
      }
    )

    expect(called).toBe(false)
    expect(response.items).toEqual([])
    expect(response.meta.unmatchedCategories).toEqual(["wardrobe"])
  })

  it("keeps the total within the budget by swapping to cheaper picks", async () => {
    const response = await recommend(
      {
        ...request,
        preferences: { ...request.preferences, budget: 500 },
      },
      { catalog, ranker: okRanker }
    )

    expect(response.totals.price).toBeLessThanOrEqual(500)
    expect(response.items[0]?.primary.articleNo).toBe("00000001")
  })

  it("flags an over budget result when nothing cheaper exists", async () => {
    const pricey: CatalogItem[] = [
      buildItem({ articleNo: "00000011", price: 250 }),
      buildItem({
        articleNo: "00000012",
        category: "desk",
        typeName: "Desk",
        price: 250,
      }),
    ]
    const response = await recommend(
      { ...request, preferences: { ...request.preferences, budget: 400 } },
      {
        catalog: pricey,
        ranker: async () => ({
          kind: "ok",
          categories: [
            { category: "sofa", picks: [{ articleNo: "00000011", reason: "Sofa." }] },
            { category: "desk", picks: [{ articleNo: "00000012", reason: "Desk." }] },
          ],
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      }
    )

    expect(response.fit.issues.map((issue) => issue.code)).toContain(
      "over-budget"
    )
  })

  it("treats categories with no affordable item as unmatched", async () => {
    const response = await recommend(
      { ...request, preferences: { ...request.preferences, budget: 200 } },
      { catalog, ranker: okRanker }
    )

    expect(response.items).toEqual([])
    expect(response.meta.unmatchedCategories).toEqual(["sofa", "desk"])
  })

  it("reports the dimensions basis of the request", async () => {
    const response = await recommend(
      { ...request, space: { ...request.space, dimensionsBasis: "estimated" } },
      { catalog, ranker: okRanker }
    )

    expect(response.meta.dimensionsBasis).toBe("estimated")
  })
})

describe("enforceBudget", () => {
  const sofa = (articleNo: string, price: number) =>
    buildItem({ articleNo, price })
  const selection = (items: CatalogItem[]): Selection => ({
    category: "sofa",
    items,
    reasons: new Map(),
  })

  it("leaves a selection within the budget unchanged", () => {
    const input = [selection([sofa("00000001", 100), sofa("00000002", 50)])]

    expect(enforceBudget(input, 500)[0]?.items[0]?.articleNo).toBe("00000001")
  })

  it("promotes the alternative with the biggest saving first", () => {
    const first = selection([sofa("00000001", 400), sofa("00000002", 300)])
    const second = selection([sofa("00000003", 400), sofa("00000004", 100)])

    const result = enforceBudget([first, second], 700)

    expect(result[1]?.items[0]?.articleNo).toBe("00000004")
    expect(result[0]?.items[0]?.articleNo).toBe("00000001")
  })

  it("keeps the replaced item as an alternative", () => {
    const result = enforceBudget(
      [selection([sofa("00000001", 400), sofa("00000002", 100)])],
      200
    )

    expect(result[0]?.items.map((item) => item.articleNo)).toEqual([
      "00000002",
      "00000001",
    ])
  })

  it("stops when no cheaper alternative exists", () => {
    const result = enforceBudget([selection([sofa("00000001", 400)])], 100)

    expect(result[0]?.items[0]?.articleNo).toBe("00000001")
  })
})
