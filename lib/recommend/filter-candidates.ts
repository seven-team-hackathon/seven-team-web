import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import type { Preferences } from "@/lib/contracts/preferences"
import type { ConfirmedSpace } from "@/lib/contracts/space"
import { fitsRoom } from "@/lib/recommend/check-fit"

export const MAX_CANDIDATES_PER_CATEGORY = 8

export const MAX_VARIANTS_PER_FAMILY = 2

export const MAX_SINGLE_ITEM_BUDGET_SHARE = 0.7

const STYLE_MATCH_SCORE = 4

const ROOM_TYPE_MATCH_SCORE = 2

const NEEDS_REVIEW_PENALTY = 1

export type CandidateGroup = {
  readonly category: FurnitureCategory
  readonly candidates: readonly CatalogItem[]
  readonly eligibleCount: number
}

type ScoredItem = {
  readonly item: CatalogItem
  readonly score: number
  readonly priceDistance: number
}

function scoreItem(
  item: CatalogItem,
  preferences: Preferences,
  space: ConfirmedSpace
): number {
  const roomType = preferences.roomType ?? space.roomType
  const styleScore =
    preferences.style !== undefined && item.styleTags.includes(preferences.style)
      ? STYLE_MATCH_SCORE
      : 0
  const roomScore = item.roomTypes.includes(roomType)
    ? ROOM_TYPE_MATCH_SCORE
    : 0
  const reviewPenalty = item.needsReview ? NEEDS_REVIEW_PENALTY : 0

  return styleScore + roomScore - reviewPenalty
}

function compareScored(first: ScoredItem, second: ScoredItem): number {
  if (first.score !== second.score) {
    return second.score - first.score
  }

  if (first.priceDistance !== second.priceDistance) {
    return first.priceDistance - second.priceDistance
  }

  return first.item.articleNo.localeCompare(second.item.articleNo)
}

function selectDiverse(ranked: readonly ScoredItem[]): CatalogItem[] {
  const selected: CatalogItem[] = []
  const variantsPerFamily = new Map<string, number>()

  for (const { item } of ranked) {
    if (selected.length >= MAX_CANDIDATES_PER_CATEGORY) {
      break
    }

    const family = item.productFamily ?? item.articleNo
    const count = variantsPerFamily.get(family) ?? 0

    if (count < MAX_VARIANTS_PER_FAMILY) {
      selected.push(item)
      variantsPerFamily.set(family, count + 1)
    }
  }

  return selected
}

export function filterCandidates(
  catalog: readonly CatalogItem[],
  space: ConfirmedSpace,
  preferences: Preferences
): readonly CandidateGroup[] {
  const categories = [...new Set(preferences.categories)]
  const priceLimit =
    categories.length > 1
      ? preferences.budget * MAX_SINGLE_ITEM_BUDGET_SHARE
      : preferences.budget
  const fairShare = preferences.budget / categories.length

  return categories.map((category) => {
    const eligible = catalog.filter(
      (item) =>
        item.category === category &&
        item.price <= priceLimit &&
        fitsRoom(item, space)
    )
    const ranked = eligible
      .map((item) => ({
        item,
        score: scoreItem(item, preferences, space),
        priceDistance: Math.abs(item.price - fairShare),
      }))
      .sort(compareScored)

    return {
      category,
      candidates: selectDiverse(ranked),
      eligibleCount: eligible.length,
    }
  })
}
