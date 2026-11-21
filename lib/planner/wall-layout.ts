import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import type { CategoryRecommendation } from "@/lib/contracts/recommendation"
import type { ConfirmedSpace } from "@/lib/contracts/space"
import type { LayoutCheck } from "@/lib/planner/layout"
import { CATEGORY_META } from "@/lib/planner/options"

export type WallSide = "width" | "length"

export type WallSize = {
  readonly widthCm: number
  readonly heightCm: number
}

export type WallItem = {
  readonly id: string
  readonly category: FurnitureCategory
  readonly widthCm: number
  readonly heightCm: number
  readonly x: number
}

export const DEFAULT_CEILING_HEIGHT_CM = 250

const WALL_ITEM_GAP_CM = 10

export function getWallSize(space: ConfirmedSpace, side: WallSide): WallSize {
  const { widthCm, lengthCm, ceilingHeightCm } = space.dimensions
  return {
    widthCm: side === "width" ? widthCm : lengthCm,
    heightCm: ceilingHeightCm ?? DEFAULT_CEILING_HEIGHT_CM,
  }
}

export function arrangeOnWall(wall: WallSize, recommendations: readonly CategoryRecommendation[]): WallItem[] {
  let nextX = 0
  return recommendations.map(({ category, primary }) => {
    const x = nextX + primary.widthCm > wall.widthCm ? 0 : nextX
    nextX = x + primary.widthCm + WALL_ITEM_GAP_CM
    return { id: primary.articleNo, category, widthCm: primary.widthCm, heightCm: primary.heightCm, x }
  })
}

export function sortForDrawing(items: readonly WallItem[]): WallItem[] {
  return [...items].sort((first, second) => second.heightCm - first.heightCm)
}

export function checkWallLayout(wall: WallSize, items: readonly WallItem[]): LayoutCheck {
  const conflictingIds = new Set<string>()
  const conflicts = new Set<string>()

  for (const item of items) {
    const label = CATEGORY_META[item.category].label
    if (item.x < 0 || item.x + item.widthCm > wall.widthCm) {
      conflictingIds.add(item.id)
      conflicts.add(`${label} does not fit along the wall`)
    }
    if (item.heightCm > wall.heightCm) {
      conflictingIds.add(item.id)
      conflicts.add(`${label} is taller than the ceiling`)
    }
  }

  return { conflictingIds, conflicts: [...conflicts] }
}
