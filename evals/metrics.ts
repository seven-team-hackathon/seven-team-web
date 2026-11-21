import type { CatalogItem } from "@/lib/catalog/load-catalog"
import { buildIkeaUrl } from "@/lib/catalog/build-ikea-url"
import type {
  RecommendRequest,
  RecommendationResponse,
  RecommendedItem,
} from "@/lib/contracts/recommendation"
import { fitsRoom } from "@/lib/recommend/check-fit"

export type CaseChecks = {
  readonly knownArticles: boolean
  readonly validLinks: boolean
  readonly categoriesAccounted: boolean
  readonly noDuplicates: boolean
  readonly primariesFitRoom: boolean
  readonly budgetHonest: boolean
  readonly usedModel: boolean
}

export type CaseResult = {
  readonly id: string
  readonly tags: readonly string[]
  readonly checks: CaseChecks
  readonly latencyMs: number
  readonly costUsd: number
  readonly itemCount: number
  readonly unmatched: readonly string[]
  readonly groundedReasons: number
  readonly totalReasons: number
  readonly unsupported: readonly { readonly articleNo: string; readonly claim: string }[]
}

function allItems(response: RecommendationResponse): RecommendedItem[] {
  return response.items.flatMap((entry) => [entry.primary, ...entry.alternatives])
}

export function evaluateCase(
  request: RecommendRequest,
  response: RecommendationResponse,
  catalog: readonly CatalogItem[]
): CaseChecks {
  const byArticleNo = new Map(catalog.map((item) => [item.articleNo, item]))
  const items = allItems(response)
  const unmatched = response.meta.unmatchedCategories ?? []
  const returnedCategories = new Set(response.items.map((entry) => entry.category))
  const primaries = response.items.map((entry) => entry.primary)

  return {
    knownArticles: items.every((item) => byArticleNo.has(item.articleNo)),
    validLinks: items.every(
      (item) => item.url === buildIkeaUrl("us", item.articleNo)
    ),
    categoriesAccounted: request.preferences.categories.every(
      (category) => returnedCategories.has(category) || unmatched.includes(category)
    ),
    noDuplicates: response.items.every((entry) => {
      const ids = [entry.primary, ...entry.alternatives].map((item) => item.articleNo)

      return new Set(ids).size === ids.length
    }),
    primariesFitRoom: primaries.every((item) => fitsRoom(item, request.space)),
    budgetHonest:
      response.totals.price <= request.preferences.budget ||
      response.fit.issues.some((issue) => issue.code === "over-budget"),
    usedModel:
      response.items.length === 0 || response.meta.rankedBy === "claude",
  }
}

export type Summary = {
  readonly cases: number
  readonly rates: Readonly<Record<keyof CaseChecks, number>>
  readonly groundedRate: number
  readonly totalReasons: number
  readonly medianLatencyMs: number
  readonly p90LatencyMs: number
  readonly totalCostUsd: number
  readonly meanCostUsd: number
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((first, second) => first - second)
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)

  return sorted[Math.max(0, index)] ?? 0
}

function rate(results: readonly CaseResult[], key: keyof CaseChecks): number {
  return results.length === 0
    ? 0
    : results.filter((result) => result.checks[key]).length / results.length
}

export function summarize(results: readonly CaseResult[]): Summary {
  const totalReasons = results.reduce((sum, result) => sum + result.totalReasons, 0)
  const grounded = results.reduce((sum, result) => sum + result.groundedReasons, 0)
  const totalCost = results.reduce((sum, result) => sum + result.costUsd, 0)
  const latencies = results.map((result) => result.latencyMs)

  return {
    cases: results.length,
    rates: {
      knownArticles: rate(results, "knownArticles"),
      validLinks: rate(results, "validLinks"),
      categoriesAccounted: rate(results, "categoriesAccounted"),
      noDuplicates: rate(results, "noDuplicates"),
      primariesFitRoom: rate(results, "primariesFitRoom"),
      budgetHonest: rate(results, "budgetHonest"),
      usedModel: rate(results, "usedModel"),
    },
    groundedRate: totalReasons === 0 ? 1 : grounded / totalReasons,
    totalReasons,
    medianLatencyMs: percentile(latencies, 0.5),
    p90LatencyMs: percentile(latencies, 0.9),
    totalCostUsd: totalCost,
    meanCostUsd: results.length === 0 ? 0 : totalCost / results.length,
  }
}
