import type { ApiErrorCode } from "@/lib/contracts/api-error"
import { spaceKindSchema } from "@/lib/contracts/space"
import type { SpaceKind } from "@/lib/contracts/space"

export const maxSpaceUploadBytes = 4 * 1024 * 1024

export const allowedSpaceUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type SpaceUploadResult =
  | { readonly ok: true; readonly kind: SpaceKind; readonly file: File }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

function isAllowedType(type: string): boolean {
  return allowedSpaceUploadTypes.some((allowedType) => allowedType === type)
}

export type ImageFileResult =
  | { readonly ok: true; readonly file: File }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

export function validateImageFile(value: FormDataEntryValue | null): ImageFileResult {
  if (!(value instanceof File) || value.size === 0) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Field 'file' must be a non-empty image file.",
    }
  }

  if (!isAllowedType(value.type)) {
    return {
      ok: false,
      code: "unsupported_media_type",
      message: "Only JPEG, PNG and WebP images are supported.",
    }
  }

  if (value.size > maxSpaceUploadBytes) {
    return {
      ok: false,
      code: "file_too_large",
      message: "The image must be 4 MB or smaller.",
    }
  }

  return { ok: true, file: value }
}

export function validateSpaceUploadForm(form: FormData): SpaceUploadResult {
  const kind = spaceKindSchema.safeParse(form.get("kind"))

  if (!kind.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Field 'kind' must be 'plan' or 'photo'.",
    }
  }

  const image = validateImageFile(form.get("file"))

  if (!image.ok) {
    return image
  }

  return { ok: true, kind: kind.data, file: image.file }
}
