import { describe, expect, it } from "vitest"

import {
  maxSpaceUploadBytes,
  validateSpaceUploadForm,
} from "@/lib/api/space-upload-rules"

function buildForm(fields: { kind?: string; file?: File }): FormData {
  const form = new FormData()

  if (fields.kind !== undefined) {
    form.set("kind", fields.kind)
  }

  if (fields.file) {
    form.set("file", fields.file)
  }

  return form
}

function buildImage(type: string, bytes = 10): File {
  return new File([new Uint8Array(bytes).fill(1)], "space", { type })
}

describe("validateSpaceUploadForm", () => {
  it("accepts a png photo", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "photo", file: buildImage("image/png") })
    )

    expect(result.ok).toBe(true)
  })

  it("rejects a floor plan as not supported yet", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "plan", file: buildImage("image/png") })
    )

    expect(!result.ok && result.code).toBe("invalid_input")
    expect(!result.ok && result.message).toContain("not supported")
  })

  it("accepts a jpeg photo and keeps the kind", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "photo", file: buildImage("image/jpeg") })
    )

    expect(result.ok && result.kind).toBe("photo")
  })

  it("rejects an unknown kind", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "video", file: buildImage("image/png") })
    )

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects a missing file", () => {
    const result = validateSpaceUploadForm(buildForm({ kind: "photo" }))

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects an empty file", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "photo", file: buildImage("image/png", 0) })
    )

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects an unsupported media type", () => {
    const result = validateSpaceUploadForm(
      buildForm({ kind: "photo", file: buildImage("application/pdf") })
    )

    expect(!result.ok && result.code).toBe("unsupported_media_type")
  })

  it("rejects a file larger than the limit", () => {
    const result = validateSpaceUploadForm(
      buildForm({
        kind: "photo",
        file: buildImage("image/png", maxSpaceUploadBytes + 1),
      })
    )

    expect(!result.ok && result.code).toBe("file_too_large")
  })
})
