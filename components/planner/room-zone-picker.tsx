"use client"

import { HandIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DetectedRoom } from "@/lib/contracts/space"
import type { ImageRef } from "@/lib/images/image-size"
import { ROOM_TYPE_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"

function getRoomLabel(room: DetectedRoom): string {
  return room.roomType ? ROOM_TYPE_META[room.roomType].label : "Room"
}

type RoomZonePickerProps = {
  image: ImageRef
  rooms: readonly DetectedRoom[]
  selectedRoomId: string | null
  onRoomSelect: (room: DetectedRoom) => void
}

export function RoomZonePicker({ image, rooms, selectedRoomId, onRoomSelect }: RoomZonePickerProps) {
  const strokeWidth = Math.max(image.width, image.height) / 300
  const fontSize = Math.max(image.width, image.height) / 40

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
            return (
              <g
                key={room.id}
                aria-hidden
                onClick={() => onRoomSelect(room)}
                className="group/zone cursor-pointer"
              >
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
                {isSelected && (
                  <text
                    x={x + width / 2}
                    y={y + fontSize * 1.6}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight={800}
                    className="fill-primary"
                  >
                    Selected
                  </text>
                )}
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
          return (
            <Button
              key={room.id}
              variant="outline"
              size="lg"
              aria-pressed={isSelected}
              onClick={() => onRoomSelect(room)}
              className={cn("rounded-full", isSelected && "border-primary bg-primary/15 text-primary hover:bg-primary/20")}
            >
              {getRoomLabel(room)}
              {room.dimensions && (
                <span className="font-normal text-muted-foreground">
                  {room.dimensions.widthCm}×{room.dimensions.lengthCm}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
