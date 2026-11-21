import { apiErrorResponse } from "@/lib/api/api-error-response"
import { isMockApiEnabled, pipelineNotReadyMessage } from "@/lib/api/mock-mode"
import { validateSpaceUploadForm } from "@/lib/api/space-upload-rules"
import {
  spaceDraftPhotoFixture,
  spaceDraftPlanFixture,
} from "@/lib/contracts/fixtures"
import type { SpaceDraft, SpaceKind } from "@/lib/contracts/space"

const mockSpaceDrafts: Readonly<Record<SpaceKind, SpaceDraft>> = {
  plan: spaceDraftPlanFixture,
  photo: spaceDraftPhotoFixture,
}

export async function POST(request: Request) {
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

  if (!isMockApiEnabled()) {
    return apiErrorResponse("model_failed", pipelineNotReadyMessage)
  }

  return Response.json(mockSpaceDrafts[upload.kind])
}
