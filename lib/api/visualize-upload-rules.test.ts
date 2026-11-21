import { describe, expect, it } from "vitest"

import { validateVisualizeForm } from "@/lib/api/visualize-upload-rules"

function buildForm(fields: { articleNo?: string; position?: string; file?: File }): FormData {
  const form = new FormData()

  if (fields.articleNo !== undefined) form.set("articleNo", fields.articleNo)
  if (fields.position !== undefined) form.set("position", fields.position)
  if (fields.file) form.set("file", fields.file)

  return form
}

const image = new File([new Uint8Array([1])], "room", { type: "image/jpeg" })

describe("validateVisualizeForm", () => {
  it("accepts a valid request", () => {
    const result = validateVisualizeForm(buildForm({ articleNo: "00575451", position: "left", file: image }))

    expect(result.ok && result.position).toBe("left")
  })

  it("accepts an s-prefixed article number", () => {
    expect(validateVisualizeForm(buildForm({ articleNo: "s29533309", position: "center", file: image })).ok).toBe(true)
  })

  it("rejects a malformed article number", () => {
    const result = validateVisualizeForm(buildForm({ articleNo: "abc; drop", position: "left", file: image }))

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects an unknown position", () => {
    const result = validateVisualizeForm(buildForm({ articleNo: "00575451", position: "top", file: image }))

    expect(!result.ok && result.message).toContain("position")
  })

  it("rejects a missing file and an unsupported type", () => {
    expect(!validateVisualizeForm(buildForm({ articleNo: "00575451", position: "left" })).ok).toBe(true)

    const pdf = new File([new Uint8Array([1])], "x", { type: "application/pdf" })
    const result = validateVisualizeForm(buildForm({ articleNo: "00575451", position: "left", file: pdf }))

    expect(!result.ok && result.code).toBe("unsupported_media_type")
  })
})
