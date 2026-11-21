import { apiErrorResponse } from "@/lib/api/api-error-response"
import { isMockApiEnabled } from "@/lib/api/mock-mode"
import {
  guardRateLimit,
  visualizeGlobalRateLimiter,
  visualizeRateLimiter,
} from "@/lib/api/route-rate-limits"
import { validateVisualizeForm } from "@/lib/api/visualize-upload-rules"
import type { VisualizeResponse } from "@/lib/contracts/visualization"
import { toMediaType } from "@/lib/visualize/generate-image"
import { visualizeProduct } from "@/lib/visualize/visualize"
import type { VisualizeResult } from "@/lib/visualize/visualize"

export const maxDuration = 120

async function echoPhoto(file: File): Promise<VisualizeResponse> {
  return {
    mediaType: toMediaType(file.type),
    imageBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    model: "mock",
  }
}

async function runVisualization(
  input: Parameters<typeof visualizeProduct>[0]
): Promise<VisualizeResult> {
  try {
    return await visualizeProduct(input)
  } catch (error) {
    console.error(
      "Visualization failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return {
      ok: false,
      code: "model_failed",
      message: "The image generation failed.",
    }
  }
}

export async function POST(request: Request) {
  const limited = guardRateLimit(
    request,
    visualizeRateLimiter,
    visualizeGlobalRateLimiter
  )

  if (limited) {
    return limited
  }

  const form = await request.formData().catch(() => null)

  if (!form) {
    return apiErrorResponse(
      "invalid_input",
      "The request body must be multipart/form-data."
    )
  }

  const mockMode = isMockApiEnabled()
  const upload = validateVisualizeForm(form, { allowAnyArticleNo: mockMode })

  if (!upload.ok) {
    return apiErrorResponse(upload.code, upload.message)
  }

  if (mockMode) {
    return Response.json(await echoPhoto(upload.file))
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return apiErrorResponse(
      "model_failed",
      "Image generation is not configured on the server."
    )
  }

  const result = await runVisualization(upload)

  if (!result.ok) {
    return apiErrorResponse(result.code, result.message)
  }

  return Response.json(result.response)
}
