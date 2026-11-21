import type { ApiErrorCode } from "@/lib/contracts/api-error"
import { MAX_VISUALIZED_PRODUCTS } from "@/lib/contracts/visualization"
import { validateImageFile } from "@/lib/api/space-upload-rules"

const ARTICLE_NO_PATTERN = /^s?\d{8}$/

export type VisualizeUploadResult =
  | {
      readonly ok: true
      readonly file: File
      readonly articleNos: readonly string[]
    }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

export function validateVisualizeForm(
  form: FormData,
  options: { readonly allowAnyArticleNo?: boolean } = {}
): VisualizeUploadResult {
  const articleNos = form.getAll("articleNo")
  const isValidArticleNo = (articleNo: FormDataEntryValue) =>
    typeof articleNo === "string" &&
    (options.allowAnyArticleNo
      ? articleNo.length > 0
      : ARTICLE_NO_PATTERN.test(articleNo))

  if (
    articleNos.length === 0 ||
    articleNos.length > MAX_VISUALIZED_PRODUCTS ||
    !articleNos.every(isValidArticleNo)
  ) {
    return {
      ok: false,
      code: "invalid_input",
      message: `Send between 1 and ${MAX_VISUALIZED_PRODUCTS} product article numbers in 'articleNo'.`,
    }
  }

  const image = validateImageFile(form.get("file"))

  if (!image.ok) {
    return image
  }

  return { ok: true, file: image.file, articleNos: articleNos as string[] }
}
