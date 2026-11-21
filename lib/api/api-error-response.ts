import { apiErrorStatuses } from "@/lib/contracts/api-error"
import type { ApiErrorBody, ApiErrorCode } from "@/lib/contracts/api-error"

export function apiErrorResponse(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } }

  return Response.json(body, { status: apiErrorStatuses[code] })
}
