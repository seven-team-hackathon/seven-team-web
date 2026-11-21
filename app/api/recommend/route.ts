import { apiErrorResponse } from "@/lib/api/api-error-response"
import { describeValidationError } from "@/lib/api/describe-validation-error"
import { isMockApiEnabled } from "@/lib/api/mock-mode"
import { recommendationFixture } from "@/lib/contracts/fixtures"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import { recommendRequestSchema } from "@/lib/contracts/recommendation"
import {
  guardRateLimit,
  recommendRateLimiter,
} from "@/lib/api/route-rate-limits"
import { recommend } from "@/lib/recommend/recommend"

export const maxDuration = 60

export async function POST(request: Request) {
  const limited = guardRateLimit(request, recommendRateLimiter)

  if (limited) {
    return limited
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = recommendRequestSchema.safeParse(body)

  if (!parsed.success) {
    return apiErrorResponse(
      "invalid_input",
      describeValidationError(parsed.error)
    )
  }

  if (isMockApiEnabled()) {
    const response: RecommendationResponse = {
      ...recommendationFixture,
      meta: {
        ...recommendationFixture.meta,
        dimensionsBasis: parsed.data.space.dimensionsBasis ?? "user",
      },
    }

    return Response.json(response)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiErrorResponse(
      "model_failed",
      "The AI service is not configured on the server."
    )
  }

  try {
    return Response.json(await recommend(parsed.data))
  } catch (error) {
    console.error(
      "Recommendation failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return apiErrorResponse("model_failed", "The recommendation failed.")
  }
}
