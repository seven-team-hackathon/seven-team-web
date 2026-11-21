import { SAMPLE_PLAN_ROOMS, type DetectedRoom } from "@/lib/planner/plan-rooms"

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 1000
const WALL_WIDTH = 12
const DOOR_WIDTH = 70
const INK = "#2B2A28"
const PAPER = "#FAF7F2"
const WINDOW = "#3F5B4E"

type CanvasRect = {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

function toCanvasRect(room: DetectedRoom): CanvasRect {
  return {
    left: room.bounds.x * CANVAS_WIDTH,
    top: room.bounds.y * CANVAS_HEIGHT,
    width: room.bounds.width * CANVAS_WIDTH,
    height: room.bounds.height * CANVAS_HEIGHT,
  }
}

function drawRoom(context: CanvasRenderingContext2D, room: DetectedRoom) {
  const rect = toCanvasRect(room)
  context.strokeStyle = INK
  context.lineWidth = WALL_WIDTH
  context.strokeRect(rect.left, rect.top, rect.width, rect.height)
}

function drawDoor(context: CanvasRenderingContext2D, room: DetectedRoom) {
  const rect = toCanvasRect(room)
  const hingeX = rect.left + rect.width / 2 - DOOR_WIDTH / 2
  const wallY = rect.top + rect.height

  context.strokeStyle = PAPER
  context.lineWidth = WALL_WIDTH + 2
  context.beginPath()
  context.moveTo(hingeX, wallY)
  context.lineTo(hingeX + DOOR_WIDTH, wallY)
  context.stroke()

  context.strokeStyle = INK
  context.lineWidth = 2
  context.setLineDash([8, 6])
  context.beginPath()
  context.arc(hingeX, wallY, DOOR_WIDTH, -Math.PI / 2, 0)
  context.stroke()
  context.setLineDash([])
}

function drawWindow(context: CanvasRenderingContext2D, room: DetectedRoom) {
  const rect = toCanvasRect(room)
  context.strokeStyle = WINDOW
  context.lineWidth = WALL_WIDTH + 4
  context.beginPath()
  context.moveTo(rect.left + rect.width * 0.3, rect.top)
  context.lineTo(rect.left + rect.width * 0.7, rect.top)
  context.stroke()
}

function drawPlan(context: CanvasRenderingContext2D) {
  const rooms = SAMPLE_PLAN_ROOMS
  context.fillStyle = PAPER
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  rooms.forEach((room) => drawRoom(context, room))
  rooms.filter((room) => room.roomType !== "hallway").forEach((room) => {
    drawDoor(context, room)
    drawWindow(context, room)
  })
}

export function createSamplePlanFile(): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext("2d")
  if (context) drawPlan(context)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], "sample-plan.png", { type: "image/png" }))
      else reject(new Error("Could not create the sample plan"))
    }, "image/png")
  })
}
