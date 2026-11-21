import type { WallPosition } from "@/lib/contracts/visualization"
import type { WallItem, WallSize } from "@/lib/planner/wall-layout"

const LEFT_LIMIT = 1 / 3

const RIGHT_LIMIT = 2 / 3

export function getWallPosition(
  item: Pick<WallItem, "x" | "widthCm">,
  wall: Pick<WallSize, "widthCm">
): WallPosition {
  const center = (item.x + item.widthCm / 2) / wall.widthCm

  if (center < LEFT_LIMIT) {
    return "left"
  }

  return center > RIGHT_LIMIT ? "right" : "center"
}
