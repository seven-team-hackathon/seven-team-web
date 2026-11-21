import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import type { CategoryRecommendation } from "@/lib/contracts/recommendation"
import { CATEGORY_META } from "@/lib/planner/options"

export type Rotation = 0 | 90 | 180 | 270

export type RoomSize = {
  readonly widthCm: number
  readonly lengthCm: number
}

export type LayoutItem = {
  readonly id: string
  readonly category: FurnitureCategory
  readonly widthCm: number
  readonly depthCm: number
  readonly x: number
  readonly y: number
  readonly rotation: Rotation
}

export type Rect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type LayoutCheck = {
  readonly conflictingIds: ReadonlySet<string>
  readonly conflicts: readonly string[]
}

export const NEXT_ROTATION: Readonly<Record<Rotation, Rotation>> = { 0: 90, 90: 180, 180: 270, 270: 0 }

const ARRANGE_STEP_CM = 10
const ITEM_GAP_CM = 10
const ARRANGE_ROTATIONS: readonly Rotation[] = [0, 90]

export function getItemSize(item: Pick<LayoutItem, "widthCm" | "depthCm" | "rotation">) {
  const isQuarterTurn = item.rotation === 90 || item.rotation === 270
  return isQuarterTurn ? { width: item.depthCm, depth: item.widthCm } : { width: item.widthCm, depth: item.depthCm }
}

export function getItemRect(item: LayoutItem): Rect {
  const { width, depth } = getItemSize(item)
  return { left: item.x, top: item.y, right: item.x + width, bottom: item.y + depth }
}

export function rectsOverlap(first: Rect, second: Rect): boolean {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
}

export function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function expandRect(rect: Rect, by: number): Rect {
  return { left: rect.left - by, top: rect.top - by, right: rect.right + by, bottom: rect.bottom + by }
}

function isInsideRoom(rect: Rect, room: RoomSize): boolean {
  return rect.left >= 0 && rect.top >= 0 && rect.right <= room.widthCm && rect.bottom <= room.lengthCm
}

function findFreeSpot(room: RoomSize, item: LayoutItem, occupied: readonly Rect[]): LayoutItem | null {
  for (const rotation of ARRANGE_ROTATIONS) {
    const { width, depth } = getItemSize({ ...item, rotation })
    for (let y = 0; y + depth <= room.lengthCm; y += ARRANGE_STEP_CM) {
      for (let x = 0; x + width <= room.widthCm; x += ARRANGE_STEP_CM) {
        const candidate = { ...item, x, y, rotation }
        const rect = expandRect(getItemRect(candidate), ITEM_GAP_CM)
        if (!occupied.some((other) => rectsOverlap(rect, other))) return candidate
      }
    }
  }
  return null
}

export function autoArrange(room: RoomSize, recommendations: readonly CategoryRecommendation[]): LayoutItem[] {
  const byFootprint = [...recommendations].sort(
    (first, second) => second.primary.widthCm * second.primary.depthCm - first.primary.widthCm * first.primary.depthCm,
  )
  const arranged: LayoutItem[] = []

  for (const { category, primary } of byFootprint) {
    const item: LayoutItem = {
      id: primary.articleNo,
      category,
      widthCm: primary.widthCm,
      depthCm: primary.depthCm,
      x: 0,
      y: 0,
      rotation: 0,
    }
    arranged.push(findFreeSpot(room, item, arranged.map(getItemRect)) ?? item)
  }

  return arranged
}

export function checkLayout(room: RoomSize, items: readonly LayoutItem[]): LayoutCheck {
  const conflictingIds = new Set<string>()
  const conflicts = new Set<string>()

  items.forEach((item, index) => {
    const rect = getItemRect(item)
    const label = CATEGORY_META[item.category].label

    if (!isInsideRoom(rect, room)) {
      conflictingIds.add(item.id)
      conflicts.add(`${label} is outside the room`)
    }

    items.slice(index + 1).forEach((other) => {
      if (rectsOverlap(rect, getItemRect(other))) {
        conflictingIds.add(item.id)
        conflictingIds.add(other.id)
        conflicts.add(`${label} overlaps ${CATEGORY_META[other.category].label.toLowerCase()}`)
      }
    })
  })

  return { conflictingIds, conflicts: [...conflicts] }
}
