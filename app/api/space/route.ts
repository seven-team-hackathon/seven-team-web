import { apiErrorResponse } from "@/lib/api/api-error-response"
import { isMockApiEnabled } from "@/lib/api/mock-mode"
import { validateSpaceUploadForm } from "@/lib/api/space-upload-rules"
import { spaceDraftPhotoFixture } from "@/lib/contracts/fixtures"
import { extractSpaceFromPhoto } from "@/lib/space/extract-space"

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

  if (isMockApiEnabled()) {
    return Response.json(spaceDraftPhotoFixture)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiErrorResponse(
      "model_failed",
      "The AI service is not configured on the server."
    )
  }

  const result = await extractSpaceFromPhoto(upload.file)

  if (!result.ok) {
    return apiErrorResponse(result.code, result.message)
  }

  return Response.json(result.draft)
}
