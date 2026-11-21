import type { KeyboardEvent, PointerEvent } from "react"
import { cn } from "@/lib/utils"
import { getItemSize, type LayoutItem } from "@/lib/planner/layout"
import { CATEGORY_META, TONE_CLASS_NAMES } from "@/lib/planner/options"

const ICON_SIZE = 16
const MIN_LABEL_WIDTH = 90

type FurnitureShapeProps = {
  item: LayoutItem
  scale: number
  offset: number
  isSelected: boolean
  isConflicting: boolean
  onPointerDown: (event: PointerEvent<SVGGElement>, item: LayoutItem) => void
  onKeyDown: (event: KeyboardEvent<SVGGElement>, item: LayoutItem) => void
  onSelect: (itemId: string) => void
}

function getOutlineClassName(isSelected: boolean, isConflicting: boolean): string {
  if (isConflicting) return "stroke-destructive"
  if (isSelected) return "stroke-foreground"
  return "stroke-transparent"
}

export function FurnitureShape({
  item,
  scale,
  offset,
  isSelected,
  isConflicting,
  onPointerDown,
  onKeyDown,
  onSelect,
}: FurnitureShapeProps) {
  const meta = CATEGORY_META[item.category]
  const tone = TONE_CLASS_NAMES[meta.tone]
  const Icon = meta.icon
  const size = getItemSize(item)
  const width = size.width * scale
  const depth = size.depth * scale
  const hasLabel = width > MIN_LABEL_WIDTH
  const iconY = hasLabel ? depth / 2 - ICON_SIZE : depth / 2 - ICON_SIZE / 2
  const dashArray = isConflicting ? "6 4" : undefined

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${meta.label} ${size.width}×${size.depth} cm`}
      aria-pressed={isSelected}
      transform={`translate(${offset + item.x * scale}, ${offset + item.y * scale})`}
      onPointerDown={(event) => onPointerDown(event, item)}
      onKeyDown={(event) => onKeyDown(event, item)}
      onFocus={() => onSelect(item.id)}
      className={cn("cursor-grab touch-none outline-none active:cursor-grabbing", tone.content)}
    >
      <rect
        width={width}
        height={depth}
        rx={6}
        strokeWidth={3}
        strokeDasharray={dashArray}
        className={cn("opacity-90", tone.fill, getOutlineClassName(isSelected, isConflicting), isConflicting && "opacity-60")}
      />
      <Icon aria-hidden x={width / 2 - ICON_SIZE / 2} y={iconY} size={ICON_SIZE} />
      {hasLabel && (
        <text x={width / 2} y={depth / 2 + 14} textAnchor="middle" fontSize={11} fontWeight={700}>
          {meta.label} {size.width}×{size.depth}
        </text>
      )}
    </g>
  )
}
