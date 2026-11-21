export type Point = {
  readonly x: number
  readonly y: number
}

export type RoomBounds = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const WHOLE_IMAGE_BOUNDS: RoomBounds = { x: 0, y: 0, width: 1, height: 1 }

const MIN_BOUNDS_SIZE = 0.05

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function boundsFromPoints(start: Point, end: Point): RoomBounds {
  const left = clampUnit(Math.min(start.x, end.x))
  const top = clampUnit(Math.min(start.y, end.y))
  const right = clampUnit(Math.max(start.x, end.x))
  const bottom = clampUnit(Math.max(start.y, end.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function isSameBounds(first: RoomBounds, second: RoomBounds): boolean {
  return (
    first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height
  )
}

export function isUsableBounds(bounds: RoomBounds): boolean {
  return bounds.width >= MIN_BOUNDS_SIZE && bounds.height >= MIN_BOUNDS_SIZE
}
