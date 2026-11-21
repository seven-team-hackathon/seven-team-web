import { describe, expect, it } from "vitest"

import { validateVisualizeForm } from "@/lib/api/visualize-upload-rules"

function buildForm(fields: { articleNos?: readonly string[]; file?: File }): FormData {
  const form = new FormData()

  for (const articleNo of fields.articleNos ?? []) form.append("articleNo", articleNo)
  if (fields.file) form.set("file", fields.file)

  return form
}

const image = new File([new Uint8Array([1])], "room", { type: "image/jpeg" })

describe("validateVisualizeForm", () => {
  it("accepts one or several products", () => {
    const result = validateVisualizeForm(buildForm({ articleNos: ["00575451", "s29533309"], file: image }))

    expect(result.ok && result.articleNos).toEqual(["00575451", "s29533309"])
  })

  it("rejects a malformed article number", () => {
    const result = validateVisualizeForm(buildForm({ articleNos: ["abc; drop"], file: image }))

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects no products and too many products", () => {
    const many = ["00000001", "00000002", "00000003", "00000004", "00000005"]

    expect(validateVisualizeForm(buildForm({ articleNos: [], file: image })).ok).toBe(false)
    expect(validateVisualizeForm(buildForm({ articleNos: many, file: image })).ok).toBe(false)
  })

  it("rejects a missing file and an unsupported type", () => {
    expect(validateVisualizeForm(buildForm({ articleNos: ["00575451"] })).ok).toBe(false)

    const pdf = new File([new Uint8Array([1])], "x", { type: "application/pdf" })
    const result = validateVisualizeForm(buildForm({ articleNos: ["00575451"], file: pdf }))

    expect(!result.ok && result.code).toBe("unsupported_media_type")
  })

  it("accepts mock article numbers when any article number is allowed", () => {
    const form = buildForm({ articleNos: ["mock-sofa-1"], file: image })

    expect(validateVisualizeForm(form).ok).toBe(false)
    expect(validateVisualizeForm(form, { allowAnyArticleNo: true }).ok).toBe(true)
  })
})
