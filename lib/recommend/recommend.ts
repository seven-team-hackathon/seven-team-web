import { estimateCostUsd, getRankingModel } from "@/lib/anthropic"
import type { TokenUsage } from "@/lib/anthropic"
import { loadCatalog } from "@/lib/catalog/load-catalog"
import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import type {
  CategoryRecommendation,
  RecommendRequest,
  RecommendationResponse,
  RecommendedItem,
} from "@/lib/contracts/recommendation"
import { checkFit } from "@/lib/recommend/check-fit"
import { fallbackRankGroup } from "@/lib/recommend/fallback-rank"
import { filterCandidates } from "@/lib/recommend/filter-candidates"
import type { CandidateGroup } from "@/lib/recommend/filter-candidates"
import { rankWithClaude } from "@/lib/recommend/rank-with-claude"
import type {
  RankedCategory,
  Ranker,
} from "@/lib/recommend/rank-with-claude"

const MAX_ALTERNATIVES = 3

export type RecommendDependencies = {
  readonly catalog?: readonly CatalogItem[]
  readonly ranker?: Ranker
}

export type Selection = {
  readonly category: FurnitureCategory
  readonly items: readonly CatalogItem[]
  readonly reasons: ReadonlyMap<string, string>
}

type RankingResult = {
  readonly selections: readonly Selection[]
  readonly usage: TokenUsage
  readonly rankedBy: "claude" | "fallback"
  readonly model: string
}

function toSelection(
  ranked: RankedCategory,
  group: CandidateGroup
): Selection | null {
  const byArticleNo = new Map(
    group.candidates.map((item) => [item.articleNo, item])
  )
  const items: CatalogItem[] = []
  const reasons = new Map<string, string>()

  for (const pick of ranked.picks) {
    const item = byArticleNo.get(pick.articleNo)

    if (item) {
      items.push(item)
      reasons.set(item.articleNo, pick.reason)
    }
  }

  return items.length === 0
    ? null
    : { category: ranked.category, items, reasons }
}

export function enforceBudget(
  selections: readonly Selection[],
  budget: number
): Selection[] {
  const current = selections.map((selection) => ({ ...selection }))
  const total = () =>
    current.reduce((sum, selection) => sum + (selection.items[0]?.price ?? 0), 0)

  while (total() > budget) {
    let bestIndex = -1
    let bestAlternative = -1
    let bestSaving = 0

    current.forEach((selection, index) => {
      const primary = selection.items[0]

      selection.items.forEach((item, position) => {
        const saving = primary ? primary.price - item.price : 0

        if (position > 0 && saving > bestSaving) {
          bestIndex = index
          bestAlternative = position
          bestSaving = saving
        }
      })
    })

    const target = current[bestIndex]

    if (!target) {
      break
    }

    const promoted = target.items[bestAlternative]

    if (!promoted) {
      break
    }

    current[bestIndex] = {
      ...target,
      items: [
        promoted,
        ...target.items.filter((item) => item.articleNo !== promoted.articleNo),
      ],
    }
  }

  return current
}

async function rankGroups(
  request: RecommendRequest,
  groups: readonly CandidateGroup[],
  ranker: Ranker
): Promise<RankingResult> {
  const model = getRankingModel()
  const outcome = await ranker({
    groups,
    space: request.space,
    preferences: request.preferences,
  })
  const rankedByModel = new Map(
    outcome.kind === "ok"
      ? outcome.categories.map((ranked) => [ranked.category, ranked])
      : []
  )
  const selections: Selection[] = []
  let usedFallback = outcome.kind === "failed"

  for (const group of groups) {
    if (group.candidates.length === 0) {
      continue
    }

    const ranked = rankedByModel.get(group.category)
    const fromModel = ranked ? toSelection(ranked, group) : null
    const fallbackRanked = fromModel
      ? null
      : fallbackRankGroup(group, request.preferences)
    const selection =
      fromModel ?? (fallbackRanked ? toSelection(fallbackRanked, group) : null)

    usedFallback = usedFallback || fromModel === null

    if (selection) {
      selections.push(selection)
    }
  }

  return {
    selections,
    usage:
      outcome.kind === "ok"
        ? outcome.usage
        : { inputTokens: 0, outputTokens: 0 },
    rankedBy: usedFallback ? "fallback" : "claude",
    model,
  }
}

function toRecommendedItem(
  item: CatalogItem,
  reasons: ReadonlyMap<string, string>
): RecommendedItem {
  return {
    articleNo: item.articleNo,
    name: item.name,
    typeName: item.typeName,
    category: item.category,
    widthCm: item.widthCm,
    depthCm: item.depthCm,
    heightCm: item.heightCm,
    price: item.price,
    currency: item.currency,
    url: item.url,
    reason: reasons.get(item.articleNo) ?? "Fits the room size and the budget.",
  }
}

function toCategoryRecommendation(
  selection: Selection
): CategoryRecommendation | null {
  const [primary, ...rest] = selection.items

  if (!primary) {
    return null
  }

  return {
    category: selection.category,
    primary: toRecommendedItem(primary, selection.reasons),
    alternatives: rest
      .slice(0, MAX_ALTERNATIVES)
      .map((item) => toRecommendedItem(item, selection.reasons)),
  }
}

export async function recommend(
  request: RecommendRequest,
  dependencies: RecommendDependencies = {}
): Promise<RecommendationResponse> {
  const catalog = dependencies.catalog ?? loadCatalog(request.preferences.market)
  const ranker = dependencies.ranker ?? rankWithClaude
  const groups = filterCandidates(catalog, request.space, request.preferences)
  const unmatched = groups
    .filter((group) => group.candidates.length === 0)
    .map((group) => group.category)
  const hasCandidates = unmatched.length < groups.length
  const ranking: RankingResult = hasCandidates
    ? await rankGroups(request, groups, ranker)
    : {
        selections: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        rankedBy: "fallback",
        model: getRankingModel(),
      }
  const selections = enforceBudget(ranking.selections, request.preferences.budget)
  const items = selections
    .map(toCategoryRecommendation)
    .filter((entry): entry is CategoryRecommendation => entry !== null)
  const report = checkFit(
    request.space,
    request.preferences.budget,
    items.map((entry) => entry.primary)
  )

  return {
    items,
    totals: {
      price: report.totalPrice,
      currency: "USD",
      budget: request.preferences.budget,
      floorUsagePct: report.floorUsagePct,
    },
    fit: { allFit: report.allFit, issues: [...report.issues] },
    usage: {
      ...ranking.usage,
      estimatedCostUsd: estimateCostUsd(ranking.model, ranking.usage) ?? 0,
    },
    meta: {
      rankedBy: ranking.rankedBy,
      dimensionsBasis: request.space.dimensionsBasis ?? "user",
      ...(unmatched.length > 0 ? { unmatchedCategories: unmatched } : {}),
    },
  }
}
