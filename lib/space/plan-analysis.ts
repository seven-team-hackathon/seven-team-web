import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

import { getAnthropicClient, getVisionModel } from "@/lib/anthropic"
import type { TokenUsage } from "@/lib/anthropic"
import type {
  AnalyzeFailureReason,
  PhotoImage,
} from "@/lib/space/photo-analysis"

const PLAN_TIMEOUT_MS = 75_000

export const PLAN_SYSTEM_PROMPT = [
  "You analyze a floor plan of a home or apartment for a furniture shopping assistant. Find every separate room and describe it.",
  "",
  "isFloorPlan: false when the image is not a floor plan or architectural drawing.",
  "",
  "For each room return:",
  "label: the text written in the room on the plan, or an empty string.",
  "roomType: the room type. Use living-room for a living room or lounge, bedroom, home-office, dining-room, kids-room, hallway for a corridor or entrance, or other for kitchens, bathrooms, closets, balconies and anything else. Use unknown when it is not clear.",
  "bounds: the rectangle that contains the room, as fractions of the whole image. x and y are the top-left corner (0 is the left or top edge, 1 the right or bottom edge), width and height are fractions of the image width and height. Cover only that room.",
  "widthCm: the left-right size of the room as drawn on the image, in centimeters. lengthCm: the top-bottom size as drawn, in centimeters.",
  "sizeSource: labels when the sizes come from dimensions written on the plan, estimated when you inferred them from a scale bar or from the proportions of other labeled rooms, unknown when you cannot tell. Use 0 for both sizes when sizeSource is unknown.",
  "Convert feet and inches to centimeters (1 ft = 30.48 cm, 1 in = 2.54 cm). Convert meters and millimeters to centimeters.",
  "sizeConfidence: a number from 0 to 1. Lower when the text is small or unclear or when you had to infer the sizes.",
  "ceilingHeightCm: only when the plan states a ceiling height, otherwise 0.",
  "",
  "Never invent dimensions. Honest uncertainty is better than a confident guess. List rooms in reading order from top-left.",
].join("\n")

export const planAnalysisSchema = z.object({
  isFloorPlan: z.boolean(),
  rooms: z.array(
    z.object({
      label: z.string(),
      roomType: z.enum([
        "living-room",
        "bedroom",
        "home-office",
        "dining-room",
        "kids-room",
        "hallway",
        "other",
        "unknown",
      ]),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      widthCm: z.number(),
      lengthCm: z.number(),
      sizeSource: z.enum(["labels", "estimated", "unknown"]),
      sizeConfidence: z.number(),
      ceilingHeightCm: z.number(),
    })
  ),
})

export type PlanAnalysis = z.infer<typeof planAnalysisSchema>

export type PlanOutcome =
  | {
      readonly kind: "ok"
      readonly analysis: PlanAnalysis
      readonly usage: TokenUsage
    }
  | {
      readonly kind: "failed"
      readonly reason: AnalyzeFailureReason
      readonly message: string
    }

export type PlanAnalyzer = (image: PhotoImage) => Promise<PlanOutcome>

export async function analyzePlanWithClaude(
  image: PhotoImage
): Promise<PlanOutcome> {
  try {
    const response = await getAnthropicClient().messages.parse(
      {
        model: getVisionModel(),
        max_tokens: 16000,
        system: PLAN_SYSTEM_PROMPT,
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
              { type: "text", text: "Analyze this floor plan." },
            ],
          },
        ],
        output_config: {
          effort: "medium",
          format: zodOutputFormat(planAnalysisSchema),
        },
      },
      { timeout: PLAN_TIMEOUT_MS }
    )

    if (response.stop_reason === "refusal") {
      return {
        kind: "failed",
        reason: "refusal",
        message: "The model declined to analyze this plan.",
      }
    }

    if (response.stop_reason === "max_tokens") {
      return {
        kind: "failed",
        reason: "truncated",
        message: "The plan analysis was cut off.",
      }
    }

    if (!response.parsed_output) {
      return {
        kind: "failed",
        reason: "unparsed",
        message: "The plan analysis could not be read.",
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
        message: "The plan analysis took too long.",
      }
    }

    console.error(
      "Plan analysis failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return {
      kind: "failed",
      reason: "upstream",
      message: "The plan analysis failed.",
    }
  }
}
