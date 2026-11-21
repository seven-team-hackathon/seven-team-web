import type { ApiErrorCode } from "@/lib/contracts/api-error"
import { wallPositionSchema } from "@/lib/contracts/visualization"
import type { WallPosition } from "@/lib/contracts/visualization"
import { validateImageFile } from "@/lib/api/space-upload-rules"

const ARTICLE_NO_PATTERN = /^s?\d{8}$/

export type VisualizeUploadResult =
  | {
      readonly ok: true
      readonly file: File
      readonly articleNo: string
      readonly position: WallPosition
    }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

export function validateVisualizeForm(form: FormData): VisualizeUploadResult {
  const articleNo = form.get("articleNo")

  if (typeof articleNo !== "string" || !ARTICLE_NO_PATTERN.test(articleNo)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Field 'articleNo' must be a product article number.",
    }
  }

  const position = wallPositionSchema.safeParse(form.get("position"))

  if (!position.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Field 'position' must be 'left', 'center' or 'right'.",
    }
  }

  const image = validateImageFile(form.get("file"))

  if (!image.ok) {
    return image
  }

  return { ok: true, file: image.file, articleNo, position: position.data }
}
