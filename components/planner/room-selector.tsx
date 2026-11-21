"use client"

import { MousePointerSquareDashedIcon, ScanIcon } from "lucide-react"
import { useRef, useState, type PointerEvent } from "react"
import type { ImageRef } from "@/lib/images/image-size"
import {
  WHOLE_IMAGE_BOUNDS,
  boundsFromPoints,
  isUsableBounds,
  type Point,
  type RoomBounds,
} from "@/lib/planner/room-bounds"
import { Button } from "@/components/ui/button"

type RoomSelectorProps = {
  image: ImageRef
  bounds: RoomBounds
  onBoundsChange: (bounds: RoomBounds) => void
}

export function RoomSelector({ image, bounds, onBoundsChange }: RoomSelectorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const startRef = useRef<Point | null>(null)
  const [draftBounds, setDraftBounds] = useState<RoomBounds | null>(null)
  const shownBounds = draftBounds ?? bounds
  const strokeWidth = Math.max(image.width, image.height) / 250
  const selection = {
    x: shownBounds.x * image.width,
    y: shownBounds.y * image.height,
    width: shownBounds.width * image.width,
    height: shownBounds.height * image.height,
  }

  function toImagePoint(event: PointerEvent<SVGSVGElement>): Point {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    startRef.current = toImagePoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = startRef.current
    if (start) setDraftBounds(boundsFromPoints(start, toImagePoint(event)))
  }

  function handlePointerUp() {
    if (draftBounds && isUsableBounds(draftBounds)) onBoundsChange(draftBounds)
    startRef.current = null
    setDraftBounds(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border bg-background">
        <svg
          ref={svgRef}
          role="img"
          aria-label="Your plan with the selected room"
          viewBox={`0 0 ${image.width} ${image.height}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block h-auto w-full cursor-crosshair touch-none select-none"
        >
          <image href={image.url} width={image.width} height={image.height} />
          <path
            d={`M0 0H${image.width}V${image.height}H0Z M${selection.x} ${selection.y}h${selection.width}v${selection.height}h${-selection.width}Z`}
            fillRule="evenodd"
            className="fill-background opacity-60"
          />
          <rect {...selection} fill="none" strokeWidth={strokeWidth} strokeDasharray={`${strokeWidth * 3} ${strokeWidth * 2}`} className="stroke-primary" />
        </svg>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MousePointerSquareDashedIcon aria-hidden className="size-4 shrink-0" />
          Drag over the plan to outline your room
        </p>
        <Button variant="outline" size="lg" onClick={() => onBoundsChange(WHOLE_IMAGE_BOUNDS)}>
          <ScanIcon data-icon="inline-start" aria-hidden />
          Whole plan
        </Button>
      </div>
    </div>
  )
}
