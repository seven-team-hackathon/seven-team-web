import type { RoomType } from "@/lib/contracts/room-type"
import type { Opening } from "@/lib/contracts/space"

const CANVAS_WIDTH = 1600
const CANVAS_HEIGHT = 1000
const FLOOR_Y = 760
const WALL_TOP = "#EFE7DC"
const WALL_BOTTOM = "#E3D8C8"
const FLOOR_NEAR = "#B08968"
const FLOOR_FAR = "#C9A684"
const BASEBOARD = "#FAF7F2"
const WINDOW_FRAME = "#FAF7F2"
const SKY_TOP = "#BFD4E2"
const SKY_BOTTOM = "#E4EDF2"
const SHADOW = "rgba(43, 42, 40, 0.12)"

export const SAMPLE_PHOTO_SPACE: {
  readonly roomType: RoomType
  readonly dimensions: { readonly widthCm: number; readonly lengthCm: number; readonly ceilingHeightCm: number }
  readonly openings: Opening[]
} = {
  roomType: "living-room",
  dimensions: { widthCm: 420, lengthCm: 380, ceilingHeightCm: 250 },
  openings: [{ type: "window", widthCm: 150 }],
}

function drawWall(context: CanvasRenderingContext2D) {
  const wall = context.createLinearGradient(0, 0, 0, FLOOR_Y)
  wall.addColorStop(0, WALL_TOP)
  wall.addColorStop(1, WALL_BOTTOM)
  context.fillStyle = wall
  context.fillRect(0, 0, CANVAS_WIDTH, FLOOR_Y)
}

function drawFloor(context: CanvasRenderingContext2D) {
  const floor = context.createLinearGradient(0, FLOOR_Y, 0, CANVAS_HEIGHT)
  floor.addColorStop(0, FLOOR_FAR)
  floor.addColorStop(1, FLOOR_NEAR)
  context.fillStyle = floor
  context.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y)

  context.strokeStyle = SHADOW
  context.lineWidth = 2
  for (let x = -400; x < CANVAS_WIDTH + 400; x += 160) {
    context.beginPath()
    context.moveTo(x + (x - CANVAS_WIDTH / 2) * 0.05, FLOOR_Y)
    context.lineTo(x + (x - CANVAS_WIDTH / 2) * 0.6, CANVAS_HEIGHT)
    context.stroke()
  }

  context.fillStyle = BASEBOARD
  context.fillRect(0, FLOOR_Y - 24, CANVAS_WIDTH, 24)
}

function drawWindow(context: CanvasRenderingContext2D) {
  const left = 980
  const top = 170
  const width = 420
  const height = 400

  context.fillStyle = SHADOW
  context.fillRect(left + 12, top + 12, width, height)

  const sky = context.createLinearGradient(0, top, 0, top + height)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(1, SKY_BOTTOM)
  context.fillStyle = sky
  context.fillRect(left, top, width, height)

  context.strokeStyle = WINDOW_FRAME
  context.lineWidth = 22
  context.strokeRect(left, top, width, height)
  context.lineWidth = 12
  context.beginPath()
  context.moveTo(left + width / 2, top)
  context.lineTo(left + width / 2, top + height)
  context.moveTo(left, top + height / 2)
  context.lineTo(left + width, top + height / 2)
  context.stroke()

  context.fillStyle = WINDOW_FRAME
  context.fillRect(left - 30, top + height + 6, width + 60, 22)
}

export function createSamplePhotoFile(): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext("2d")
  if (context) {
    drawWall(context)
    drawFloor(context)
    drawWindow(context)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(new File([blob], "sample-room.jpg", { type: "image/jpeg" }))
        else reject(new Error("Could not create the sample photo"))
      },
      "image/jpeg",
      0.9,
    )
  })
}
