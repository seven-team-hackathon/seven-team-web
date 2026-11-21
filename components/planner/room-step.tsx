"use client"

import { ArrowRightIcon, DoorOpenIcon, InfoIcon, PanelTopIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { roomTypeSchema, type RoomType } from "@/lib/contracts/room-type"
import { confirmedSpaceSchema, type ConfirmedSpace, type Opening, type SpaceDraft } from "@/lib/contracts/space"
import type { DetectedRoom, PlanDraft } from "@/lib/planner/plan-rooms"
import { cn } from "@/lib/utils"
import type { ImageRef } from "@/lib/images/image-size"
import { ROOM_TYPE_META } from "@/lib/planner/options"
import { WHOLE_IMAGE_BOUNDS, isSameBounds, type RoomBounds } from "@/lib/planner/room-bounds"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChoiceGroup, type ChoiceOption } from "@/components/planner/choice-group"
import { NumberField } from "@/components/planner/number-field"
import { RoomSelector } from "@/components/planner/room-selector"
import { RoomZonePicker } from "@/components/planner/room-zone-picker"

const LOW_CONFIDENCE = 0.6
const MAX_LENGTH_CM = 2000

const ROOM_TYPE_OPTIONS: readonly ChoiceOption[] = roomTypeSchema.options.map((roomType) => ({
  value: roomType,
  label: ROOM_TYPE_META[roomType].label,
  icon: ROOM_TYPE_META[roomType].icon,
}))

function toFieldValue(value: number | undefined): string {
  return value === undefined ? "" : String(value)
}

function toOptionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value)
}

function describeOpening(opening: Opening): string {
  const parts = [opening.type === "door" ? "Door" : "Window"]
  if (opening.widthCm) parts.push(`${opening.widthCm} cm`)
  if (opening.wall) parts.push(`${opening.wall} wall`)
  return parts.join(" · ")
}

function shouldCheckDimensions(draft: SpaceDraft, room: DetectedRoom | null): boolean {
  const confidence = (room ?? draft).dimensions?.confidence ?? 0
  return draft.needsUserInput.includes("dimensions") || confidence < LOW_CONFIDENCE
}

function findInitialRoom(rooms: readonly DetectedRoom[], bounds: RoomBounds | null): DetectedRoom | null {
  const matchingRoom = bounds ? rooms.find((room) => isSameBounds(room.bounds, bounds)) : undefined
  return matchingRoom ?? rooms[0] ?? null
}

type RoomStepProps = {
  draft: PlanDraft
  planImage: ImageRef | null
  initialSpace: ConfirmedSpace | null
  initialBounds: RoomBounds | null
  onConfirm: (space: ConfirmedSpace, bounds: RoomBounds) => void
}

export function RoomStep({ draft, planImage, initialSpace, initialBounds, onConfirm }: RoomStepProps) {
  const rooms = draft.rooms ?? []
  const initialRoom = findInitialRoom(rooms, initialBounds)
  const [selectedRoom, setSelectedRoom] = useState<DetectedRoom | null>(initialRoom)
  const [bounds, setBounds] = useState<RoomBounds>(initialBounds ?? initialRoom?.bounds ?? WHOLE_IMAGE_BOUNDS)
  const startingSize = initialSpace?.dimensions ?? initialRoom?.dimensions ?? draft.dimensions
  const [roomType, setRoomType] = useState<RoomType | null>(
    initialSpace?.roomType ?? initialRoom?.roomType ?? draft.roomType ?? null,
  )
  const [width, setWidth] = useState(toFieldValue(startingSize?.widthCm))
  const [length, setLength] = useState(toFieldValue(startingSize?.lengthCm))
  const [ceilingHeight, setCeilingHeight] = useState(toFieldValue(startingSize?.ceilingHeightCm))
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const isCheckNeeded = !initialSpace && shouldCheckDimensions(draft, selectedRoom)

  function handleRoomSelect(room: DetectedRoom) {
    setSelectedRoom(room)
    setBounds(room.bounds)
    setRoomType(room.roomType ?? null)
    setWidth(toFieldValue(room.dimensions?.widthCm))
    setLength(toFieldValue(room.dimensions?.lengthCm))
    setCeilingHeight(toFieldValue(room.dimensions?.ceilingHeightCm))
    setHasSubmitted(false)
  }

  const parsedSpace = confirmedSpaceSchema.safeParse({
    roomType,
    dimensions: {
      widthCm: toOptionalNumber(width),
      lengthCm: toOptionalNumber(length),
      ceilingHeightCm: toOptionalNumber(ceilingHeight),
    },
    dimensionsBasis: "user",
    openings: draft.openings,
    styleHints: draft.styleHints,
  })
  const isInvalid = hasSubmitted && !parsedSpace.success

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasSubmitted(true)
    if (parsedSpace.success) onConfirm(parsedSpace.data, bounds)
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">Check your room</CardTitle>
        <CardDescription className="text-base">
          {planImage ? "Choose your room on the plan, then check its type and size." : "We estimated these from your photo."}
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "mx-auto grid w-full max-w-2xl grid-cols-1 gap-8",
          planImage && "max-w-6xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start",
        )}
      >
        {planImage && rooms.length > 0 && (
          <RoomZonePicker
            image={planImage}
            rooms={rooms}
            selectedRoomId={selectedRoom?.id ?? null}
            onRoomSelect={handleRoomSelect}
          />
        )}
        {planImage && rooms.length === 0 && <RoomSelector image={planImage} bounds={bounds} onBoundsChange={setBounds} />}
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
          {isCheckNeeded && (
            <p className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
              <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              These sizes are approximate. Measure the room and correct them so the furniture really fits.
            </p>
          )}
          <ChoiceGroup
            name="room-type"
            legend="Room type"
            options={ROOM_TYPE_OPTIONS}
            value={roomType}
            onValueChange={(value) => setRoomType(roomTypeSchema.parse(value))}
            columnsClassName="grid-cols-2 sm:grid-cols-3"
          />
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <legend className="sr-only">Room size</legend>
            <NumberField label="Width" unit="cm" value={width} onValueChange={setWidth} min={1} max={MAX_LENGTH_CM} isRequired isInvalid={isInvalid} />
            <NumberField label="Length" unit="cm" value={length} onValueChange={setLength} min={1} max={MAX_LENGTH_CM} isRequired isInvalid={isInvalid} />
            <NumberField label="Ceiling (optional)" unit="cm" value={ceilingHeight} onValueChange={setCeilingHeight} min={1} max={MAX_LENGTH_CM} />
          </fieldset>
          {draft.openings.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Doors and windows</p>
              <ul className="flex flex-wrap gap-2">
                {draft.openings.map((opening, index) => {
                  const Icon = opening.type === "door" ? DoorOpenIcon : PanelTopIcon
                  return (
                    <li
                      key={`${opening.type}-${opening.wall ?? "unknown"}-${index}`}
                      className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium"
                    >
                      <Icon aria-hidden className="size-4 text-primary" />
                      {describeOpening(opening)}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {isInvalid && (
            <p role="alert" className="text-sm text-destructive">
              Choose a room type and enter a width and length between 1 and {MAX_LENGTH_CM} cm.
            </p>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-center">
            Continue
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
