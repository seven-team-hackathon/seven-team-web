import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { Preferences } from "@/lib/contracts/preferences"
import type { CandidateGroup } from "@/lib/recommend/filter-candidates"
import type {
  RankedCategory,
  RankedPick,
} from "@/lib/recommend/rank-with-claude"

const FALLBACK_PICKS = 4

export function describeFallbackReason(
  item: CatalogItem,
  preferences: Preferences
): string {
  const parts = ["Fits the room size and the budget"]

  if (preferences.style && item.styleTags.includes(preferences.style)) {
    parts.push(`matches the ${preferences.style} style`)
  }

  if (preferences.roomType && item.roomTypes.includes(preferences.roomType)) {
    parts.push(`suits a ${preferences.roomType.replace("-", " ")}`)
  }

  return `${parts.join(", ")}.`
}

export function fallbackRankGroup(
  group: CandidateGroup,
  preferences: Preferences
): RankedCategory | null {
  const picks: RankedPick[] = group.candidates
    .slice(0, FALLBACK_PICKS)
    .map((item) => ({
      articleNo: item.articleNo,
      reason: describeFallbackReason(item, preferences),
    }))

  return picks.length === 0 ? null : { category: group.category, picks }
}
