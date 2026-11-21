import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/lib/catalog/load-catalog"
import { recommendRequestFixture, recommendationFixture } from "@/lib/contracts/fixtures"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import { evaluateCase, summarize } from "./metrics"
import type { CaseResult } from "./metrics"

const catalog: CatalogItem[] = recommendationFixture.items.flatMap((entry) =>
  [entry.primary, ...entry.alternatives].map((item) => ({
    ...item,
    roomTypes: ["living-room" as const],
    styleTags: ["scandinavian" as const],
    colors: [],
    description: "Synthetic.",
    aiConfidence: 0.9,
    needsReview: false,
    priceFetchedAt: "2026-11-21T12:00:00.000Z",
  }))
)

const request = recommendRequestFixture

function withUrls(response: RecommendationResponse): RecommendationResponse {
  return {
    ...response,
    items: response.items.map((entry) => ({
      ...entry,
      primary: { ...entry.primary, url: `https://www.ikea.com/us/en/p/-${entry.primary.articleNo}/` },
      alternatives: entry.alternatives.map((item) => ({
        ...item,
        url: `https://www.ikea.com/us/en/p/-${item.articleNo}/`,
      })),
    })),
  }
}

describe("evaluateCase", () => {
  it("passes a consistent response", () => {
    const checks = evaluateCase(request, withUrls(recommendationFixture), catalog)

    expect(checks.knownArticles).toBe(true)
    expect(checks.validLinks).toBe(true)
    expect(checks.categoriesAccounted).toBe(true)
    expect(checks.budgetHonest).toBe(true)
  })

  it("detects an article that is not in the catalog", () => {
    const response = withUrls(recommendationFixture)
    const first = response.items[0]

    if (!first) throw new Error("missing fixture item")

    const broken: RecommendationResponse = {
      ...response,
      items: [
        { ...first, primary: { ...first.primary, articleNo: "99999999" } },
        ...response.items.slice(1),
      ],
    }

    expect(evaluateCase(request, broken, catalog).knownArticles).toBe(false)
  })

  it("detects a link that does not match the article", () => {
    const response = withUrls(recommendationFixture)
    const first = response.items[0]

    if (!first) throw new Error("missing fixture item")

    const broken: RecommendationResponse = {
      ...response,
      items: [
        { ...first, primary: { ...first.primary, url: "https://www.ikea.com/us/en/" } },
        ...response.items.slice(1),
      ],
    }

    expect(evaluateCase(request, broken, catalog).validLinks).toBe(false)
  })

  it("accepts an unmatched category as accounted for", () => {
    const response: RecommendationResponse = {
      ...withUrls(recommendationFixture),
      items: withUrls(recommendationFixture).items.slice(1),
      meta: { ...recommendationFixture.meta, unmatchedCategories: ["sofa"] },
    }

    expect(evaluateCase(request, response, catalog).categoriesAccounted).toBe(true)
  })

  it("rejects a silently dropped category", () => {
    const response: RecommendationResponse = {
      ...withUrls(recommendationFixture),
      items: withUrls(recommendationFixture).items.slice(1),
    }

    expect(evaluateCase(request, response, catalog).categoriesAccounted).toBe(false)
  })

  it("flags an over budget total that is not reported", () => {
    const response: RecommendationResponse = {
      ...withUrls(recommendationFixture),
      totals: { ...recommendationFixture.totals, price: 9999 },
    }

    expect(evaluateCase(request, response, catalog).budgetHonest).toBe(false)
  })

  it("accepts an over budget total that is reported", () => {
    const response: RecommendationResponse = {
      ...withUrls(recommendationFixture),
      totals: { ...recommendationFixture.totals, price: 9999 },
      fit: { allFit: false, issues: [{ code: "over-budget", message: "x" }] },
    }

    expect(evaluateCase(request, response, catalog).budgetHonest).toBe(true)
  })
})

describe("summarize", () => {
  const checks = {
    knownArticles: true,
    validLinks: true,
    categoriesAccounted: true,
    noDuplicates: true,
    primariesFitRoom: true,
    budgetHonest: true,
    usedModel: true,
  }
  const result = (overrides: Partial<CaseResult>): CaseResult => ({
    id: "a",
    tags: [],
    checks,
    latencyMs: 1000,
    costUsd: 0.01,
    itemCount: 3,
    unmatched: [],
    groundedReasons: 4,
    totalReasons: 4,
    unsupported: [],
    ...overrides,
  })

  it("computes rates, latency and cost", () => {
    const summary = summarize([
      result({ latencyMs: 1000 }),
      result({ latencyMs: 3000, checks: { ...checks, usedModel: false }, groundedReasons: 2 }),
    ])

    expect(summary.cases).toBe(2)
    expect(summary.rates.usedModel).toBe(0.5)
    expect(summary.groundedRate).toBeCloseTo(6 / 8)
    expect(summary.medianLatencyMs).toBe(1000)
    expect(summary.p90LatencyMs).toBe(3000)
    expect(summary.totalCostUsd).toBeCloseTo(0.02)
  })

  it("handles an empty list", () => {
    const summary = summarize([])

    expect(summary.cases).toBe(0)
    expect(summary.groundedRate).toBe(1)
    expect(summary.meanCostUsd).toBe(0)
  })
})
