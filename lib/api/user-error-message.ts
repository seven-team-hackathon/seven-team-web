import { apiErrorSchema, type ApiErrorCode } from "@/lib/contracts/api-error"

const USER_ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  invalid_input: "Something in the request is not right. Please check your input and try again.",
  file_too_large: "The image must be 4 MB or smaller.",
  unsupported_media_type: "Use a JPG, PNG or WebP image.",
  unreadable_space: "We could not read this image. Try a clearer plan or photo.",
  rate_limited: "Too many requests. Please try again in a minute.",
  model_failed: "Something went wrong on our side. Please try again.",
  timeout: "This took too long. Please try again.",
}

export function getUserErrorMessage(body: unknown, fallbackMessage: string): string {
  const parsed = apiErrorSchema.safeParse(body)
  return parsed.success ? USER_ERROR_MESSAGES[parsed.data.error.code] : fallbackMessage
}

export function getThrownErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage
}
