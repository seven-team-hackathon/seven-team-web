import type { ConfirmedSpace } from "@/lib/contracts/space"
import { ROOM_TYPE_META } from "@/lib/planner/options"

export function getRoomSizeLabel(space: ConfirmedSpace): string {
  const prefix = space.dimensionsBasis === "estimated" ? "≈ " : ""
  return `${prefix}${space.dimensions.widthCm}×${space.dimensions.lengthCm} cm`
}

export function getRoomLabel(space: ConfirmedSpace): string {
  return `${ROOM_TYPE_META[space.roomType].label} · ${getRoomSizeLabel(space)}`
}
