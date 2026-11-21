"use client"

import { HandIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RoomType } from "@/lib/contracts/room-type"
import type { DetectedRoom } from "@/lib/planner/plan-rooms"
import type { ImageRef } from "@/lib/images/image-size"
import { ROOM_TYPE_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"

const PLAN_INK = "oklch(0.285 0.004 84.6)"
const PLAN_PAPER = "oklch(0.977 0.007 80.7)"

export type RoomDetails = {
  readonly roomType: RoomType | null
  readonly widthCm: number | null
  readonly lengthCm: number | null
}

type RoomSummary = {
  readonly label: string
  readonly size: string | null
}

function getDetectedDetails(room: DetectedRoom): RoomDetails {
  return {
    roomType: room.roomType ?? null,
    widthCm: room.dimensions?.widthCm ?? null,
    lengthCm: room.dimensions?.lengthCm ?? null,
  }
}

function summarize({ roomType, widthCm, lengthCm }: RoomDetails): RoomSummary {
  const label = roomType ? ROOM_TYPE_META[roomType].label : "Room"
  const size = widthCm && lengthCm ? `${widthCm} × ${lengthCm} cm` : null
  return { label, size }
}

type RoomZonePickerProps = {
  image: ImageRef
  rooms: readonly DetectedRoom[]
  selectedRoomId: string | null
  selectedDetails: RoomDetails
  onRoomSelect: (room: DetectedRoom) => void
}

export function RoomZonePicker({ image, rooms, selectedRoomId, selectedDetails, onRoomSelect }: RoomZonePickerProps) {
  const longSide = Math.max(image.width, image.height)
  const strokeWidth = longSide / 300
  const labelSize = longSide / 42
  const sizeTextSize = longSide / 50

  function getSummary(room: DetectedRoom): RoomSummary {
    return summarize(room.id === selectedRoomId ? selectedDetails : getDetectedDetails(room))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border bg-background">
        <svg
          role="group"
          aria-label="Rooms found on your plan"
          viewBox={`0 0 ${image.width} ${image.height}`}
          className="block h-auto w-full select-none"
        >
          <image href={image.url} width={image.width} height={image.height} />
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId
            const x = room.bounds.x * image.width
            const y = room.bounds.y * image.height
            const width = room.bounds.width * image.width
            const height = room.bounds.height * image.height
            const summary = getSummary(room)
            return (
              <g key={room.id} aria-hidden onClick={() => onRoomSelect(room)} className="group/zone cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  strokeWidth={strokeWidth}
                  className={cn(
                    "fill-primary/5 stroke-primary/40 transition-colors group-hover/zone:fill-primary/15 motion-reduce:transition-none",
                    isSelected && "fill-primary/25 stroke-primary group-hover/zone:fill-primary/25",
                  )}
                />
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  fill={PLAN_INK}
                  stroke={PLAN_PAPER}
                  strokeWidth={labelSize / 5}
                  paintOrder="stroke"
                >
                  <tspan x={x + width / 2} fontSize={labelSize} fontWeight={700}>
                    {summary.label}
                  </tspan>
                  {summary.size && (
                    <tspan x={x + width / 2} dy={labelSize * 1.3} fontSize={sizeTextSize}>
                      {summary.size}
                    </tspan>
                  )}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <HandIcon aria-hidden className="size-4 shrink-0" />
        We found {rooms.length} rooms. Tap the one you are furnishing.
      </p>
      <div role="group" aria-label="Rooms" className="flex flex-wrap gap-2">
        {rooms.map((room) => {
          const isSelected = room.id === selectedRoomId
          const summary = getSummary(room)
          return (
            <Button
              key={room.id}
              variant="outline"
              size="lg"
              aria-pressed={isSelected}
              onClick={() => onRoomSelect(room)}
              className={cn("rounded-full", isSelected && "border-primary bg-primary/15 text-primary hover:bg-primary/20")}
            >
              {summary.label}
              {summary.size && <span className="font-normal text-muted-foreground">{summary.size}</span>}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
