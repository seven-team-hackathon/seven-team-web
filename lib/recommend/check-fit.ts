import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { FitIssue } from "@/lib/contracts/recommendation"
import type { ConfirmedSpace } from "@/lib/contracts/space"

export const MAX_WALL_FILL_RATIO = 0.9

export const MAX_FLOOR_USAGE_RATIO = 0.4

export const ESTIMATED_DIMENSIONS_SAFETY_FACTOR = 0.85

export type FitItem = Pick<
  CatalogItem,
  "articleNo" | "widthCm" | "depthCm" | "heightCm" | "price"
>

export type FitReport = {
  readonly allFit: boolean
  readonly issues: readonly FitIssue[]
  readonly totalPrice: number
  readonly floorUsagePct: number
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
}

export function effectiveSpace(space: ConfirmedSpace): ConfirmedSpace {
  if (space.dimensionsBasis !== "estimated") {
    return space
  }

  const { widthCm, lengthCm, ceilingHeightCm } = space.dimensions

  return {
    ...space,
    dimensions: {
      widthCm: widthCm * ESTIMATED_DIMENSIONS_SAFETY_FACTOR,
      lengthCm: lengthCm * ESTIMATED_DIMENSIONS_SAFETY_FACTOR,
      ceilingHeightCm:
        ceilingHeightCm === undefined
          ? undefined
          : ceilingHeightCm * ESTIMATED_DIMENSIONS_SAFETY_FACTOR,
    },
  }
}

export function floorAreaCm2(space: ConfirmedSpace): number {
  return space.dimensions.widthCm * space.dimensions.lengthCm
}

export function footprintCm2(item: FitItem): number {
  return item.widthCm * item.depthCm
}

function fitsFloor(item: FitItem, space: ConfirmedSpace): boolean {
  const { widthCm, lengthCm } = space.dimensions
  const longWall = Math.max(widthCm, lengthCm)
  const shortWall = Math.min(widthCm, lengthCm)
  const longSide = Math.max(item.widthCm, item.depthCm)
  const shortSide = Math.min(item.widthCm, item.depthCm)

  return (
    longSide <= longWall * MAX_WALL_FILL_RATIO &&
    shortSide <= shortWall * MAX_WALL_FILL_RATIO
  )
}

function fitsCeiling(item: FitItem, space: ConfirmedSpace): boolean {
  const { ceilingHeightCm } = space.dimensions

  return ceilingHeightCm === undefined || item.heightCm <= ceilingHeightCm
}

export function fitsRoom(item: FitItem, space: ConfirmedSpace): boolean {
  const effective = effectiveSpace(space)

  return fitsFloor(item, effective) && fitsCeiling(item, effective)
}

function describeMisfit(item: FitItem, effective: ConfirmedSpace): string {
  if (!fitsCeiling(item, effective)) {
    return `Item ${item.articleNo} is taller than the ceiling.`
  }

  return `Item ${item.articleNo} is too large for the room.`
}

export function checkFit(
  space: ConfirmedSpace,
  budget: number,
  items: readonly FitItem[]
): FitReport {
  const effective = effectiveSpace(space)
  const issues: FitIssue[] = []

  for (const item of items) {
    if (!fitsFloor(item, effective) || !fitsCeiling(item, effective)) {
      issues.push({
        code: "item-too-wide",
        articleNo: item.articleNo,
        message: describeMisfit(item, effective),
      })
    }
  }

  const totalPrice = roundTo(
    items.reduce((sum, item) => sum + item.price, 0),
    2
  )
  const floorUsage =
    items.reduce((sum, item) => sum + footprintCm2(item), 0) /
    floorAreaCm2(effective)

  if (floorUsage > MAX_FLOOR_USAGE_RATIO) {
    issues.push({
      code: "floor-usage-exceeded",
      message: `Furniture covers ${roundTo(floorUsage * 100, 1)}% of the floor, above the ${MAX_FLOOR_USAGE_RATIO * 100}% limit.`,
    })
  }

  if (totalPrice > budget) {
    issues.push({
      code: "over-budget",
      message: `The total price ${totalPrice} exceeds the budget ${budget}.`,
    })
  }

  return {
    allFit: issues.length === 0,
    issues,
    totalPrice,
    floorUsagePct: roundTo(floorUsage * 100, 1),
  }
}
