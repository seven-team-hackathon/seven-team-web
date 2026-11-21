import { describe, expect, it } from "vitest"
import { MAX_SPACE_FILE_SIZE_MB, validateSpaceFileSize, validateSpaceFileType } from "@/lib/planner/space-file"

function createFile(type: string, sizeInBytes: number): File {
  return new File([new Uint8Array(sizeInBytes)], "room", { type })
}

describe("validateSpaceFileType", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(validateSpaceFileType(createFile("image/jpeg", 10))).toBeNull()
    expect(validateSpaceFileType(createFile("image/png", 10))).toBeNull()
    expect(validateSpaceFileType(createFile("image/webp", 10))).toBeNull()
  })

  it("rejects other types", () => {
    expect(validateSpaceFileType(createFile("application/pdf", 10))).toBe("Use a JPG, PNG or WebP image")
  })
})

describe("validateSpaceFileSize", () => {
  it("rejects files over the limit", () => {
    const tooLarge = createFile("image/png", MAX_SPACE_FILE_SIZE_MB * 1024 * 1024 + 1)
    expect(validateSpaceFileSize(tooLarge)).toBe(`The image must be ${MAX_SPACE_FILE_SIZE_MB} MB or smaller`)
  })
})
