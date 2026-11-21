import { describe, expect, it } from "vitest"

import {
  buildPrompt,
  describeProduct,
  extensionOf,
  mediaTypeOf,
  parseFlags,
} from "./generate-room-image.mjs"
import type { ProductInfo } from "./generate-room-image.mjs"

const product: ProductInfo = {
  articleNo: "00000001",
  name: "TEST  Sofa",
  typeName: "3-seat sofa",
  widthCm: 199.6,
  depthCm: 90,
  heightCm: 85.2,
  colors: ["gray", "white"],
  material: "fabric",
  styleTags: ["scandinavian"],
}

describe("describeProduct", () => {
  it("includes the name, colors, material and rounded real size", () => {
    const text = describeProduct(product)

    expect(text).toContain("a TEST Sofa")
    expect(text).toContain("in gray and white")
    expect(text).toContain("made of fabric")
    expect(text).toContain("200 cm wide, 90 cm deep, 85 cm high")
  })

  it("omits colors and material when unknown", () => {
    const text = describeProduct({ ...product, colors: [], material: undefined })

    expect(text).not.toContain(" in ")
    expect(text).not.toContain("made of")
  })
})

describe("buildPrompt", () => {
  it("states the product, the placement and the realism rules", () => {
    const prompt = buildPrompt({ subject: "a gray sofa", placement: "next to the window" })

    expect(prompt).toContain("add a gray sofa next to the window")
    expect(prompt).toContain("Keep the room exactly as it is")
    expect(prompt).toContain("realistic size")
  })
})

describe("helpers", () => {
  it("parses flags with values", () => {
    const flags = parseFlags(["--room", "a.jpg", "--model", "x,y"])

    expect(flags.get("room")).toBe("a.jpg")
    expect(flags.get("model")).toBe("x,y")
  })

  it("detects image media types by extension", () => {
    expect(mediaTypeOf("room.JPG")).toBe("image/jpeg")
    expect(mediaTypeOf("room.png")).toBe("image/png")
    expect(mediaTypeOf("room.gif")).toBeNull()
  })

  it("maps media types to file extensions", () => {
    expect(extensionOf("image/jpeg")).toBe("jpg")
    expect(extensionOf("image/webp")).toBe("webp")
    expect(extensionOf(undefined)).toBe("png")
  })
})
