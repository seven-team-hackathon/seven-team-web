"use client"

import { CheckIcon, MoveHorizontalIcon, TriangleAlertIcon, WandSparklesIcon, XIcon } from "lucide-react"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { cn } from "@/lib/utils"
import { snapToStep } from "@/lib/planner/layout"
import { CATEGORY_META, TONE_CLASS_NAMES } from "@/lib/planner/options"
import { pluralize } from "@/lib/pluralize"
import { checkWallLayout, sortForDrawing, type WallItem, type WallSide, type WallSize } from "@/lib/planner/wall-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoomVisualization } from "@/components/planner/room-visualization"
import { StatusPill } from "@/components/planner/status-pill"

const CANVAS_WALL_WIDTH_PX = 800
const PADDING_PX = 24
const SNAP_STEP_CM = 5
const ICON_SIZE = 16
const MIN_LABEL_WIDTH_PX = 90

const KEYBOARD_MOVES: Readonly<Record<string, number>> = {
  ArrowLeft: -SNAP_STEP_CM,
  ArrowRight: SNAP_STEP_CM,
}

type DragState = {
  readonly itemId: string
  readonly offsetX: number
}

type WallFurnitureProps = {
  item: WallItem
  scale: number
  floorY: number
  isSelected: boolean
  isConflicting: boolean
  onPointerDown: (event: PointerEvent<SVGGElement>, item: WallItem) => void
  onKeyDown: (event: KeyboardEvent<SVGGElement>, item: WallItem) => void
  onSelect: (itemId: string) => void
}

function getOutlineClassName(isSelected: boolean, isConflicting: boolean): string {
  if (isConflicting) return "stroke-destructive"
  if (isSelected) return "stroke-foreground"
  return "stroke-transparent"
}

function WallFurniture({
  item,
  scale,
  floorY,
  isSelected,
  isConflicting,
  onPointerDown,
  onKeyDown,
  onSelect,
}: WallFurnitureProps) {
  const meta = CATEGORY_META[item.category]
  const tone = TONE_CLASS_NAMES[meta.tone]
  const Icon = meta.icon
  const width = item.widthCm * scale
  const height = item.heightCm * scale
  const hasLabel = width > MIN_LABEL_WIDTH_PX
  const dashArray = isConflicting ? "6 4" : undefined

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${meta.label} ${item.widthCm} cm wide, ${item.heightCm} cm high`}
      aria-pressed={isSelected}
      transform={`translate(${PADDING_PX + item.x * scale}, ${floorY - height})`}
      onPointerDown={(event) => onPointerDown(event, item)}
      onKeyDown={(event) => onKeyDown(event, item)}
      onFocus={() => onSelect(item.id)}
      className={cn("cursor-grab touch-none outline-none active:cursor-grabbing", tone.content)}
    >
      <rect
        width={width}
        height={height}
        rx={6}
        strokeWidth={3}
        strokeDasharray={dashArray}
        className={cn("opacity-80", tone.fill, getOutlineClassName(isSelected, isConflicting))}
      />
      <Icon aria-hidden x={width / 2 - ICON_SIZE / 2} y={height / 2 - ICON_SIZE} size={ICON_SIZE} />
      {hasLabel && (
        <text x={width / 2} y={height / 2 + 14} textAnchor="middle" fontSize={11} fontWeight={700}>
          {meta.label} {item.widthCm}×{item.heightCm}
        </text>
      )}
    </g>
  )
}

type WallLayoutStepProps = {
  wall: WallSize
  wallSide: WallSide
  wallLengths: Readonly<Record<WallSide, number>>
  photoUrl: string
  photoFile: File
  items: readonly WallItem[]
  onItemsChange: (items: readonly WallItem[]) => void
  onWallSideChange: (side: WallSide) => void
  onAutoArrange: () => void
}

export function WallLayoutStep({
  wall,
  wallSide,
  wallLengths,
  photoUrl,
  photoFile,
  items,
  onItemsChange,
  onWallSideChange,
  onAutoArrange,
}: WallLayoutStepProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conflictingIds, conflicts } = checkWallLayout(wall, items)
  const hasConflicts = conflicts.length > 0
  const selectedItem = items.find((item) => item.id === selectedId) ?? (items.length === 1 ? items[0] : null) ?? null
  const scale = CANVAS_WALL_WIDTH_PX / wall.widthCm
  const wallWidth = wall.widthCm * scale
  const wallHeight = wall.heightCm * scale
  const floorY = PADDING_PX + wallHeight
  const canvasWidth = wallWidth + PADDING_PX * 2
  const canvasHeight = wallHeight + PADDING_PX * 2

  function toWallX(event: PointerEvent<Element>): number {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return 0
    const ratio = canvasWidth / bounds.width
    return ((event.clientX - bounds.left) * ratio - PADDING_PX) / scale
  }

  function moveItem(itemId: string, getX: (item: WallItem) => number) {
    onItemsChange(items.map((item) => (item.id === itemId ? { ...item, x: getX(item) } : item)))
  }

  function removeItem(itemId: string) {
    onItemsChange(items.filter((item) => item.id !== itemId))
    setSelectedId(null)
  }

  function handleItemPointerDown(event: PointerEvent<SVGGElement>, item: WallItem) {
    event.stopPropagation()
    dragRef.current = { itemId: item.id, offsetX: toWallX(event) - item.x }
    svgRef.current?.setPointerCapture(event.pointerId)
    setSelectedId(item.id)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const x = snapToStep(toWallX(event) - drag.offsetX, SNAP_STEP_CM)
    moveItem(drag.itemId, () => x)
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleItemKeyDown(event: KeyboardEvent<SVGGElement>, item: WallItem) {
    const step = KEYBOARD_MOVES[event.key]
    if (step) {
      event.preventDefault()
      moveItem(item.id, (current) => current.x + step)
      return
    }
    if (event.key === "Delete" || event.key === "Backspace") removeItem(item.id)
  }

  function handleRemove() {
    if (selectedId) removeItem(selectedId)
  }

  function handleAutoArrange() {
    setSelectedId(null)
    onAutoArrange()
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">See it on your wall</CardTitle>
        <CardDescription className="text-base">
          Move the furniture along the wall from your photo to check that everything fits.
        </CardDescription>
      </CardHeader>
      <CardContent className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Wall in the photo" className="grid grid-cols-2 gap-2 sm:flex">
            {(["width", "length"] as const).map((side) => (
              <Button
                key={side}
                variant={side === wallSide ? "default" : "outline"}
                size="lg"
                aria-pressed={side === wallSide}
                onClick={() => onWallSideChange(side)}
              >
                {wallLengths[side]} cm wall
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" size="lg" disabled={!selectedId} onClick={handleRemove}>
              <XIcon data-icon="inline-start" aria-hidden />
              Remove
            </Button>
            <Button variant="outline" size="lg" onClick={handleAutoArrange}>
              <WandSparklesIcon data-icon="inline-start" aria-hidden />
              Arrange
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill isWarning={false}>
            {wall.widthCm}×{wall.heightCm} cm
          </StatusPill>
          <StatusPill isWarning={hasConflicts}>
            {hasConflicts && <TriangleAlertIcon aria-hidden className="size-3.5" />}
            {!hasConflicts && <CheckIcon aria-hidden className="size-3.5" />}
            {hasConflicts ? pluralize(conflicts.length, "conflict", "conflicts") : "Everything fits"}
          </StatusPill>
        </div>

        <div className="-mx-1 overflow-auto rounded-xl border bg-background p-2 sm:mx-0 sm:p-3">
          <svg
            ref={svgRef}
            role="group"
            aria-label="Wall from the photo with furniture"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onPointerDown={() => setSelectedId(null)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="h-auto w-full min-w-120 select-none"
          >
            <defs>
              <clipPath id="wall-clip">
                <rect x={PADDING_PX} y={PADDING_PX} width={wallWidth} height={wallHeight} />
              </clipPath>
            </defs>
            <image
              href={photoUrl}
              x={PADDING_PX}
              y={PADDING_PX}
              width={wallWidth}
              height={wallHeight}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#wall-clip)"
            />
            <rect
              x={PADDING_PX}
              y={PADDING_PX}
              width={wallWidth}
              height={wallHeight}
              fill="none"
              strokeWidth={2}
              className="stroke-foreground opacity-60"
            />
            <line x1={PADDING_PX} x2={PADDING_PX + wallWidth} y1={floorY} y2={floorY} strokeWidth={4} className="stroke-foreground" />
            {sortForDrawing(items).map((item) => (
              <WallFurniture
                key={item.id}
                item={item}
                scale={scale}
                floorY={floorY}
                isSelected={item.id === selectedId}
                isConflicting={conflictingIds.has(item.id)}
                onPointerDown={handleItemPointerDown}
                onKeyDown={handleItemKeyDown}
                onSelect={setSelectedId}
              />
            ))}
          </svg>
        </div>

        <div aria-live="polite">
          {hasConflicts && (
            <ul className="flex flex-col gap-1 rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
              {conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MoveHorizontalIcon aria-hidden className="size-3.5" />
          Drag furniture along the wall or use the arrow keys. Lower pieces are drawn in front.
        </p>

        <RoomVisualization photo={photoFile} item={selectedItem} wall={wall} />
      </CardContent>
    </Card>
  )
}
