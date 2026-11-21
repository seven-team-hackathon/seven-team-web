import type { TokenUsage } from "@/lib/anthropic"
import type { ApiErrorCode } from "@/lib/contracts/api-error"
import type { MissingSpaceField, Opening, SpaceDraft } from "@/lib/contracts/space"
import { analyzePhotoWithClaude } from "@/lib/space/photo-analysis"
import type {
  PhotoAnalysis,
  PhotoAnalyzer,
  PhotoImage,
} from "@/lib/space/photo-analysis"
import { toPhotoMediaType } from "@/lib/space/photo-media-types"

export const MAX_PHOTO_DIMENSIONS_CONFIDENCE = 0.7

const MAX_LENGTH_CM = 2000

const MAX_STYLE_HINTS = 5

const MAX_STYLE_HINT_LENGTH = 60

export type ExtractSpaceResult =
  | {
      readonly ok: true
      readonly draft: SpaceDraft
      readonly usage: TokenUsage
    }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

function isUsableLength(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function clampLength(value: number): number {
  return Math.min(MAX_LENGTH_CM, value)
}

function clampConfidence(value: number): number {
  const bounded = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

  return Math.min(bounded, MAX_PHOTO_DIMENSIONS_CONFIDENCE)
}

function buildOpenings(analysis: PhotoAnalysis): Opening[] {
  return analysis.openings.map((opening) =>
    isUsableLength(opening.widthCm)
      ? { type: opening.type, widthCm: clampLength(opening.widthCm) }
      : { type: opening.type }
  )
}

function buildStyleHints(analysis: PhotoAnalysis): string[] {
  const hints = analysis.styleHints
    .map((hint) => hint.trim().slice(0, MAX_STYLE_HINT_LENGTH))
    .filter((hint) => hint.length > 0)

  return [...new Set(hints)].slice(0, MAX_STYLE_HINTS)
}

export function buildSpaceDraft(analysis: PhotoAnalysis): SpaceDraft | null {
  if (!analysis.isRoomPhoto) {
    return null
  }

  const needsUserInput: MissingSpaceField[] = ["dimensions"]
  const hasSize =
    isUsableLength(analysis.estimatedWidthCm) &&
    isUsableLength(analysis.estimatedDepthCm)
  const roomType =
    analysis.roomType === "unknown" ? undefined : analysis.roomType

  if (roomType === undefined) {
    needsUserInput.push("room-type")
  }

  return {
    kind: "photo",
    ...(roomType ? { roomType } : {}),
    ...(hasSize
      ? {
          dimensions: {
            widthCm: clampLength(analysis.estimatedWidthCm),
            lengthCm: clampLength(analysis.estimatedDepthCm),
            ...(isUsableLength(analysis.estimatedCeilingHeightCm)
              ? {
                  ceilingHeightCm: clampLength(
                    analysis.estimatedCeilingHeightCm
                  ),
                }
              : {}),
            source: "estimated" as const,
            confidence: clampConfidence(analysis.dimensionsConfidence),
          },
        }
      : {}),
    openings: buildOpenings(analysis),
    styleHints: buildStyleHints(analysis),
    needsUserInput,
  }
}

export async function readPhotoImage(file: File): Promise<PhotoImage | null> {
  const mediaType = toPhotoMediaType(file.type)

  if (!mediaType) {
    return null
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")

  return { base64, mediaType }
}

export async function extractSpaceFromPhoto(
  file: File,
  analyze: PhotoAnalyzer = analyzePhotoWithClaude
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

  const draft = buildSpaceDraft(outcome.analysis)

  if (!draft) {
    return {
      ok: false,
      code: "unreadable_space",
      message: "The image does not look like a photo of a room.",
    }
  }

  return { ok: true, draft, usage: outcome.usage }
}
