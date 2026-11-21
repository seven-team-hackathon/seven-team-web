import type { TokenUsage } from "@/lib/anthropic"
import type { DetectedRoom, SpaceDraft } from "@/lib/contracts/space"
import type { ExtractSpaceResult } from "@/lib/space/extract-space"
import { readPhotoImage } from "@/lib/space/extract-space"
import { analyzePlanWithClaude } from "@/lib/space/plan-analysis"
import type { PlanAnalysis, PlanAnalyzer } from "@/lib/space/plan-analysis"

export const MAX_LABELED_CONFIDENCE = 0.9

export const MAX_ESTIMATED_CONFIDENCE = 0.5

export const MIN_ROOM_BOUNDS_SIZE = 0.05

const MAX_LENGTH_CM = 2000

const MAX_ROOMS = 12

type PlanRoom = PlanAnalysis["rooms"][number]

function isUsableLength(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function clampConfidence(value: number, cap: number): number {
  return Math.min(cap, clampUnit(value))
}

function normalizeBounds(bounds: PlanRoom["bounds"]): DetectedRoom["bounds"] | null {
  const x = clampUnit(bounds.x)
  const y = clampUnit(bounds.y)
  const width = Math.min(clampUnit(bounds.width), 1 - x)
  const height = Math.min(clampUnit(bounds.height), 1 - y)

  if (width < MIN_ROOM_BOUNDS_SIZE || height < MIN_ROOM_BOUNDS_SIZE) {
    return null
  }

  return { x, y, width, height }
}

function buildDimensions(room: PlanRoom): DetectedRoom["dimensions"] {
  if (
    room.sizeSource === "unknown" ||
    !isUsableLength(room.widthCm) ||
    !isUsableLength(room.lengthCm)
  ) {
    return undefined
  }

  const labeled = room.sizeSource === "labels"

  return {
    widthCm: Math.min(MAX_LENGTH_CM, room.widthCm),
    lengthCm: Math.min(MAX_LENGTH_CM, room.lengthCm),
    ...(isUsableLength(room.ceilingHeightCm)
      ? { ceilingHeightCm: Math.min(MAX_LENGTH_CM, room.ceilingHeightCm) }
      : {}),
    source: labeled ? "plan-labels" : "estimated",
    confidence: clampConfidence(
      room.sizeConfidence,
      labeled ? MAX_LABELED_CONFIDENCE : MAX_ESTIMATED_CONFIDENCE
    ),
  }
}

export function buildPlanDraft(analysis: PlanAnalysis): SpaceDraft | null {
  if (!analysis.isFloorPlan) {
    return null
  }

  const rooms: DetectedRoom[] = []

  for (const room of analysis.rooms.slice(0, MAX_ROOMS)) {
    const bounds = normalizeBounds(room.bounds)

    if (bounds) {
      const dimensions = buildDimensions(room)
      const roomType =
        room.roomType === "unknown" || room.roomType === "other"
          ? undefined
          : room.roomType

      rooms.push({
        id: `room-${rooms.length + 1}`,
        ...(roomType ? { roomType } : {}),
        ...(dimensions ? { dimensions } : {}),
        bounds,
      })
    }
  }

  const missingDimensions =
    rooms.length === 0 || rooms.some((room) => room.dimensions === undefined)
  const [onlyRoom] = rooms
  const single = rooms.length === 1 ? onlyRoom : undefined

  return {
    kind: "plan",
    ...(single?.roomType ? { roomType: single.roomType } : {}),
    ...(single?.dimensions ? { dimensions: single.dimensions } : {}),
    openings: [],
    styleHints: [],
    needsUserInput: missingDimensions ? ["dimensions"] : [],
    rooms,
  }
}

export async function extractSpaceFromPlan(
  file: File,
  analyze: PlanAnalyzer = analyzePlanWithClaude
): Promise<ExtractSpaceResult> {
  const image = await readPhotoImage(file)

  if (!image) {
    return {
      ok: false,
      code: "unsupported_media_type",
      message: "Only JPEG, PNG and WebP images are supported.",
    }
  }

  const outcome = await analyze(image)

  if (outcome.kind === "failed") {
    return {
      ok: false,
      code: outcome.reason === "timeout" ? "timeout" : "model_failed",
      message: outcome.message,
    }
  }

  const draft = buildPlanDraft(outcome.analysis)

  if (!draft) {
    return {
      ok: false,
      code: "unreadable_space",
      message: "The image does not look like a floor plan.",
    }
  }

  const usage: TokenUsage = outcome.usage

  return { ok: true, draft, usage }
}
