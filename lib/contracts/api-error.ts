import { z } from "zod"

export const apiErrorCodeSchema = z.enum([
  "invalid_input",
  "file_too_large",
  "unsupported_media_type",
  "unreadable_space",
  "rate_limited",
  "model_failed",
  "timeout",
])

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
  }),
})

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export type ApiErrorBody = z.infer<typeof apiErrorSchema>

export const apiErrorStatuses: Readonly<Record<ApiErrorCode, number>> = {
  invalid_input: 400,
  file_too_large: 413,
  unsupported_media_type: 415,
  unreadable_space: 422,
  rate_limited: 429,
  model_failed: 502,
  timeout: 504,
}
