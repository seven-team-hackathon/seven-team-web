"use client"

import {
  CheckIcon,
  Grid3x3Icon,
  MagnetIcon,
  MoveIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import type { ImageRef } from "@/lib/images/image-size"
import { NEXT_ROTATION, checkLayout, snapToStep, type LayoutItem, type RoomSize } from "@/lib/planner/layout"
import type { RoomBounds } from "@/lib/planner/room-bounds"
import { pluralize } from "@/lib/pluralize"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FurnitureShape } from "@/components/planner/furniture-shape"
import { StatusPill } from "@/components/planner/status-pill"

const CANVAS_ROOM_WIDTH_PX = 800
const PADDING_PX = 24
const GRID_STEP_CM = 50
const SNAP_STEP_CM = 5

const KEYBOARD_MOVES: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  ArrowUp: { dx: 0, dy: -SNAP_STEP_CM },
  ArrowDown: { dx: 0, dy: SNAP_STEP_CM },
  ArrowLeft: { dx: -SNAP_STEP_CM, dy: 0 },
  ArrowRight: { dx: SNAP_STEP_CM, dy: 0 },
}

const LEGEND = [
  { icon: MoveIcon, text: "Drag with the mouse, a finger or the arrow keys" },
  { icon: RotateCwIcon, text: "R rotates, Delete removes" },
  { icon: Grid3x3Icon, text: `Grid = ${GRID_STEP_CM} cm` },
  { icon: MagnetIcon, text: `Snaps to ${SNAP_STEP_CM} cm` },
] as const

type DragState = {
  readonly itemId: string
  readonly offsetX: number
  readonly offsetY: number
}

type FloorLayoutStepProps = {
  room: RoomSize
  planImage: ImageRef
  roomBounds: RoomBounds
  items: readonly LayoutItem[]
  onItemsChange: (items: readonly LayoutItem[]) => void
  onAutoArrange: () => void
}

export function FloorLayoutStep({
  room,
  planImage,
  roomBounds,
  items,
  onItemsChange,
  onAutoArrange,
}: FloorLayoutStepProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conflictingIds, conflicts } = checkLayout(room, items)
  const hasConflicts = conflicts.length > 0
  const scale = CANVAS_ROOM_WIDTH_PX / room.widthCm
  const roomWidth = room.widthCm * scale
  const roomHeight = room.lengthCm * scale
  const canvasWidth = roomWidth + PADDING_PX * 2
  const canvasHeight = roomHeight + PADDING_PX * 2
  const gridSize = GRID_STEP_CM * scale

  function toRoomPoint(event: PointerEvent<Element>) {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    const ratio = canvasWidth / bounds.width
    return {
      x: ((event.clientX - bounds.left) * ratio - PADDING_PX) / scale,
      y: ((event.clientY - bounds.top) * ratio - PADDING_PX) / scale,
    }
  }

  function updateItem(itemId: string, update: (item: LayoutItem) => LayoutItem) {
    onItemsChange(items.map((item) => (item.id === itemId ? update(item) : item)))
  }

  function removeItem(itemId: string) {
    onItemsChange(items.filter((item) => item.id !== itemId))
    setSelectedId(null)
  }

  function handleItemPointerDown(event: PointerEvent<SVGGElement>, item: LayoutItem) {
    event.stopPropagation()
    const point = toRoomPoint(event)
    dragRef.current = { itemId: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y }
    svgRef.current?.setPointerCapture(event.pointerId)
    setSelectedId(item.id)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const point = toRoomPoint(event)
    updateItem(drag.itemId, (item) => ({
      ...item,
      x: snapToStep(point.x - drag.offsetX, SNAP_STEP_CM),
      y: snapToStep(point.y - drag.offsetY, SNAP_STEP_CM),
    }))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleCanvasPointerDown() {
    setSelectedId(null)
  }

  function handleRotate() {
    if (selectedId) updateItem(selectedId, (item) => ({ ...item, rotation: NEXT_ROTATION[item.rotation] }))
  }

  function handleRemove() {
    if (selectedId) removeItem(selectedId)
  }

  function handleAutoArrange() {
    setSelectedId(null)
    onAutoArrange()
  }

  function handleItemKeyDown(event: KeyboardEvent<SVGGElement>, item: LayoutItem) {
    const move = KEYBOARD_MOVES[event.key]
    if (move) {
      event.preventDefault()
      updateItem(item.id, (current) => ({ ...current, x: current.x + move.dx, y: current.y + move.dy }))
      return
    }

    switch (event.key) {
      case "r":
      case "R":
        updateItem(item.id, (current) => ({ ...current, rotation: NEXT_ROTATION[current.rotation] }))
        break
      case "Delete":
      case "Backspace":
        removeItem(item.id)
        break
    }
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">See it in your room</CardTitle>
        <CardDescription className="text-base">
          Move the furniture around your plan to check that everything fits.
        </CardDescription>
      </CardHeader>
      <CardContent className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill isWarning={false}>
              {room.widthCm}×{room.lengthCm} cm
            </StatusPill>
            <StatusPill isWarning={hasConflicts}>
              {hasConflicts && <TriangleAlertIcon aria-hidden className="size-3.5" />}
              {!hasConflicts && <CheckIcon aria-hidden className="size-3.5" />}
              {hasConflicts ? pluralize(conflicts.length, "conflict", "conflicts") : "Everything fits"}
            </StatusPill>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button variant="outline" size="lg" disabled={!selectedId} onClick={handleRotate}>
              <RotateCwIcon data-icon="inline-start" aria-hidden />
              Rotate
            </Button>
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

        <div className="-mx-1 overflow-auto rounded-xl border bg-background p-2 sm:mx-0 sm:p-3">
          <svg
            ref={svgRef}
            role="group"
            aria-label="Room plan with furniture"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="h-auto w-full min-w-120 select-none"
          >
            <defs>
              <pattern id="layout-grid" width={gridSize} height={gridSize} x={PADDING_PX} y={PADDING_PX} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" strokeWidth={1} className="stroke-border" />
              </pattern>
            </defs>
            <svg
              x={PADDING_PX}
              y={PADDING_PX}
              width={roomWidth}
              height={roomHeight}
              viewBox={`${roomBounds.x * planImage.width} ${roomBounds.y * planImage.height} ${roomBounds.width * planImage.width} ${roomBounds.height * planImage.height}`}
              preserveAspectRatio="none"
            >
              <image href={planImage.url} width={planImage.width} height={planImage.height} />
            </svg>
            <rect
              x={PADDING_PX}
              y={PADDING_PX}
              width={roomWidth}
              height={roomHeight}
              fill="url(#layout-grid)"
              strokeWidth={4}
              className="stroke-foreground opacity-60"
            />
            {items.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                scale={scale}
                offset={PADDING_PX}
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

        <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
          {LEGEND.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5">
              <Icon aria-hidden className="size-3.5" />
              {text}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
