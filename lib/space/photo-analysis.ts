import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

import { getAnthropicClient, getVisionModel } from "@/lib/anthropic"
import type { TokenUsage } from "@/lib/anthropic"
import type { PhotoMediaType } from "@/lib/space/photo-media-types"

const VISION_TIMEOUT_MS = 60_000

export const PHOTO_SYSTEM_PROMPT = [
  "You analyze a photo of a room, or of part of a room, for a furniture shopping assistant.",
  "",
  "isRoomPhoto: false when the image does not show an interior space where furniture could be placed.",
  "roomType: the room shown, or unknown when it is not clear.",
  "",
  "Estimate the size of the visible floor area in centimeters. Use objects of known size when they are visible: a standard US interior door is about 203 cm high and 76 to 81 cm wide, ceilings are typically about 244 cm, a kitchen counter is about 91 cm high, a wall outlet cover plate is about 11.5 cm high.",
  "estimatedWidthCm: the width of the area along the main wall facing the camera.",
  "estimatedDepthCm: how far the area extends from that wall toward the camera.",
  "estimatedCeilingHeightCm: only when the ceiling is visible, otherwise 0.",
  "dimensionsConfidence: a number from 0 to 1. Higher when several reference objects are visible and the photo is taken straight on. Lower for wide-angle or tilted photos, or when no reference object is visible.",
  "Use 0 for the sizes when you cannot estimate them. Honest uncertainty is better than a confident guess.",
  "referenceObjects: the visible objects you used to estimate the size.",
  "",
  "openings: visible doors and windows with an estimated width in centimeters, 0 when unknown.",
  "styleHints: up to five short phrases about colors, materials and style, for example light walls or wooden floor.",
].join("\n")

export const photoAnalysisSchema = z.object({
  isRoomPhoto: z.boolean(),
  roomType: z.enum([
    "living-room",
    "bedroom",
    "home-office",
    "dining-room",
    "kids-room",
    "hallway",
    "unknown",
  ]),
  estimatedWidthCm: z.number(),
  estimatedDepthCm: z.number(),
  estimatedCeilingHeightCm: z.number(),
  dimensionsConfidence: z.number(),
  referenceObjects: z.array(z.string()),
  openings: z.array(
    z.object({
      type: z.enum(["door", "window"]),
      widthCm: z.number(),
    })
  ),
  styleHints: z.array(z.string()),
})

export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>

export type PhotoImage = {
  readonly base64: string
  readonly mediaType: PhotoMediaType
}

export type AnalyzeFailureReason =
  | "refusal"
  | "truncated"
  | "unparsed"
  | "timeout"
  | "upstream"

export type AnalyzeOutcome =
  | {
      readonly kind: "ok"
      readonly analysis: PhotoAnalysis
      readonly usage: TokenUsage
    }
  | {
      readonly kind: "failed"
      readonly reason: AnalyzeFailureReason
      readonly message: string
    }

export type PhotoAnalyzer = (image: PhotoImage) => Promise<AnalyzeOutcome>

export async function analyzePhotoWithClaude(
  image: PhotoImage
): Promise<AnalyzeOutcome> {
  try {
    const response = await getAnthropicClient().messages.parse(
      {
        model: getVisionModel(),
        max_tokens: 16000,
        system: PHOTO_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.base64,
                },
              },
              { type: "text", text: "Analyze this room photo." },
            ],
          },
        ],
        output_config: {
          effort: "medium",
          format: zodOutputFormat(photoAnalysisSchema),
        },
      },
      { timeout: VISION_TIMEOUT_MS }
    )

    if (response.stop_reason === "refusal") {
      return {
        kind: "failed",
        reason: "refusal",
        message: "The model declined to analyze this photo.",
      }
    }

    if (response.stop_reason === "max_tokens") {
      return {
        kind: "failed",
        reason: "truncated",
        message: "The photo analysis was cut off.",
      }
    }

    if (!response.parsed_output) {
      return {
        kind: "failed",
        reason: "unparsed",
        message: "The photo analysis could not be read.",
      }
    }

    return {
      kind: "ok",
      analysis: response.parsed_output,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    }
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return {
        kind: "failed",
        reason: "timeout",
        message: "The photo analysis took too long.",
      }
    }

    console.error(
      "Photo analysis failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return {
      kind: "failed",
      reason: "upstream",
      message: "The photo analysis failed.",
    }
  }
}
