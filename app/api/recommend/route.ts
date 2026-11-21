import { apiErrorResponse } from "@/lib/api/api-error-response"
import { describeValidationError } from "@/lib/api/describe-validation-error"
import { isMockApiEnabled, pipelineNotReadyMessage } from "@/lib/api/mock-mode"
import { recommendationFixture } from "@/lib/contracts/fixtures"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import { recommendRequestSchema } from "@/lib/contracts/recommendation"

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = recommendRequestSchema.safeParse(body)

  if (!parsed.success) {
    return apiErrorResponse(
      "invalid_input",
      describeValidationError(parsed.error)
    )
  }

  if (!isMockApiEnabled()) {
    return apiErrorResponse("model_failed", pipelineNotReadyMessage)
  }

  const response: RecommendationResponse = {
    ...recommendationFixture,
    meta: {
      ...recommendationFixture.meta,
      dimensionsBasis: parsed.data.space.dimensionsBasis ?? "user",
    },
  }

  return Response.json(response)
}
