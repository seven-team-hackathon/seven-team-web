import type { RoomType } from "@/lib/contracts/room-type"
import type { ImageSize } from "@/lib/images/image-size"
import type { DetectedRoom } from "@/lib/planner/plan-rooms"

export type EstimatedRoomSize = {
  readonly widthCm: number
  readonly lengthCm: number
  readonly ceilingHeightCm: number
}

type PixelSize = {
  readonly width: number
  readonly height: number
}

const DEFAULT_CEILING_HEIGHT_CM = 250
const ROUNDING_STEP_CM = 5
const DEFAULT_ROOM_SIZE = { widthCm: 350, lengthCm: 300 }
const TYPICAL_ROOM_AREA_CM2 = DEFAULT_ROOM_SIZE.widthCm * DEFAULT_ROOM_SIZE.lengthCm

const TYPICAL_ROOM_SIZES: Readonly<Record<RoomType, { readonly widthCm: number; readonly lengthCm: number }>> = {
  "living-room": { widthCm: 420, lengthCm: 380 },
  bedroom: { widthCm: 350, lengthCm: 300 },
  "home-office": { widthCm: 300, lengthCm: 270 },
  "dining-room": { widthCm: 350, lengthCm: 300 },
  "kids-room": { widthCm: 320, lengthCm: 300 },
  hallway: { widthCm: 300, lengthCm: 150 },
}

function roundToStep(value: number): number {
  return Math.max(ROUNDING_STEP_CM, Math.round(value / ROUNDING_STEP_CM) * ROUNDING_STEP_CM)
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toPixels(room: DetectedRoom, image: ImageSize): PixelSize {
  return { width: room.bounds.width * image.width, height: room.bounds.height * image.height }
}

function getCmPerPixel(rooms: readonly DetectedRoom[], image: ImageSize): number | null {
  const measured = rooms.flatMap((room) => {
    const pixels = toPixels(room, image)
    return room.dimensions ? [(room.dimensions.widthCm / pixels.width + room.dimensions.lengthCm / pixels.height) / 2] : []
  })
  if (measured.length > 0) return average(measured)

  const areas = rooms.map((room) => {
    const pixels = toPixels(room, image)
    return pixels.width * pixels.height
  })
  return areas.length > 0 ? Math.sqrt(TYPICAL_ROOM_AREA_CM2 / average(areas)) : null
}

export function getTypicalRoomSize(roomType: RoomType | null | undefined): EstimatedRoomSize {
  const size = roomType ? TYPICAL_ROOM_SIZES[roomType] : DEFAULT_ROOM_SIZE
  return { ...size, ceilingHeightCm: DEFAULT_CEILING_HEIGHT_CM }
}

export function estimateRoomSize(
  room: DetectedRoom,
  rooms: readonly DetectedRoom[],
  image: ImageSize,
): EstimatedRoomSize {
  if (room.dimensions) {
    return {
      widthCm: room.dimensions.widthCm,
      lengthCm: room.dimensions.lengthCm,
      ceilingHeightCm: room.dimensions.ceilingHeightCm ?? DEFAULT_CEILING_HEIGHT_CM,
    }
  }

  const cmPerPixel = getCmPerPixel(rooms, image)
  if (!cmPerPixel) return getTypicalRoomSize(room.roomType)

  const pixels = toPixels(room, image)
  return {
    widthCm: roundToStep(pixels.width * cmPerPixel),
    lengthCm: roundToStep(pixels.height * cmPerPixel),
    ceilingHeightCm: DEFAULT_CEILING_HEIGHT_CM,
  }
}
