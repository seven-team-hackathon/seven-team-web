import { apiErrorResponse } from "@/lib/api/api-error-response"
import { isMockApiEnabled } from "@/lib/api/mock-mode"
import {
  guardRateLimit,
  spaceRateLimiter,
} from "@/lib/api/route-rate-limits"
import { validateSpaceUploadForm } from "@/lib/api/space-upload-rules"
import {
  spaceDraftPhotoFixture,
  spaceDraftPlanFixture,
} from "@/lib/contracts/fixtures"
import type { SpaceKind } from "@/lib/contracts/space"
import { extractSpaceFromPhoto } from "@/lib/space/extract-space"
import { extractSpaceFromPlan } from "@/lib/space/extract-plan"

const mockDrafts = {
  plan: spaceDraftPlanFixture,
  photo: spaceDraftPhotoFixture,
} satisfies Record<SpaceKind, unknown>

export const maxDuration = 90

export async function POST(request: Request) {
  const limited = guardRateLimit(request, spaceRateLimiter)

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

  const upload = validateSpaceUploadForm(form)

  if (!upload.ok) {
    return apiErrorResponse(upload.code, upload.message)
  }

  if (isMockApiEnabled()) {
    return Response.json(mockDrafts[upload.kind])
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiErrorResponse(
      "model_failed",
      "The AI service is not configured on the server."
    )
  }

  const result =
    upload.kind === "plan"
      ? await extractSpaceFromPlan(upload.file)
      : await extractSpaceFromPhoto(upload.file)

  if (!result.ok) {
    return apiErrorResponse(result.code, result.message)
  }

  return Response.json(result.draft)
}
