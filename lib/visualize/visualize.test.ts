import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/lib/catalog/load-catalog"
import { visualizeResponseSchema } from "@/lib/contracts/visualization"
import { buildVisualizationPrompt, describeProduct } from "@/lib/visualize/build-prompt"
import type { GenerateInput, ImageGenerator } from "@/lib/visualize/generate-image"
import { visualizeProduct } from "@/lib/visualize/visualize"

const item: CatalogItem = {
  articleNo: "00000001",
  name: "TEST Sofa - yellow",
  typeName: "3-seat sofa",
  category: "sofa",
  roomTypes: ["living-room"],
  widthCm: 199.6,
  depthCm: 90,
  heightCm: 85.2,
  styleTags: ["scandinavian"],
  colors: ["yellow", "wood"],
  material: "fabric",
  description: "Synthetic.",
  imageUrl: "https://www.ikea.com/us/en/images/products/test.jpg",
  aiConfidence: 0.9,
  needsReview: false,
  price: 400,
  currency: "USD",
  priceFetchedAt: "2026-11-21T12:00:00.000Z",
  url: "https://www.ikea.com/us/en/p/-00000001/",
}

const file = new File([new Uint8Array([1, 2, 3])], "room", { type: "image/jpeg" })

function okGenerator(received: GenerateInput[] = []): ImageGenerator {
  return async (input) => {
    received.push(input)

    return {
      kind: "ok",
      image: { mediaType: "image/png", imageBase64: "AAAA", model: "m", costUsd: 0.05 },
    }
  }
}

describe("describeProduct", () => {
  it("includes the real size and skips colors already in the name", () => {
    const text = describeProduct(item)

    expect(text).toContain("200 cm wide, 90 cm deep, 85 cm high")
    expect(text).toContain("in wood")
    expect(text).not.toContain("yellow and")
    expect(text).toContain("made of fabric")
  })
})

describe("buildVisualizationPrompt", () => {
  it("mentions the second image when a product photo is used", () => {
    const prompt = buildVisualizationPrompt({ subject: "a sofa", position: "left", hasProductImage: true })

    expect(prompt).toContain("second image")
    expect(prompt).toContain("on its left part")
  })

  it("uses the plain prompt without a product photo", () => {
    const prompt = buildVisualizationPrompt({ subject: "a sofa", position: "center", hasProductImage: false })

    expect(prompt).not.toContain("second image")
    expect(prompt).toContain("in the middle of it")
  })

  it("always keeps the room unchanged and the size realistic", () => {
    const prompt = buildVisualizationPrompt({ subject: "a sofa", position: "right", hasProductImage: true })

    expect(prompt).toContain("Keep the room exactly as it is")
    expect(prompt).toContain("realistic size")
  })
})

describe("visualizeProduct", () => {
  it("returns a response that matches the contract", async () => {
    const result = await visualizeProduct(
      { file, articleNo: "00000001", position: "right" },
      { catalog: [item], generate: okGenerator() }
    )

    expect(result.ok && visualizeResponseSchema.safeParse(result.response).success).toBe(true)
  })

  it("sends the room photo and the product photo from the catalog", async () => {
    const received: GenerateInput[] = []

    await visualizeProduct(
      { file, articleNo: "00000001", position: "left" },
      { catalog: [item], generate: okGenerator(received) }
    )

    expect(received[0]?.roomImageDataUrl).toBe("data:image/jpeg;base64,AQID")
    expect(received[0]?.productImageUrl).toBe(item.imageUrl)
    expect(received[0]?.prompt).toContain("second image")
  })

  it("does not take the product from the client", async () => {
    const result = await visualizeProduct(
      { file, articleNo: "99999999", position: "left" },
      { catalog: [item], generate: okGenerator() }
    )

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("works for a product without a photo", async () => {
    const received: GenerateInput[] = []
    const { imageUrl, ...withoutImage } = item

    await visualizeProduct(
      { file, articleNo: "00000001", position: "left" },
      { catalog: [withoutImage], generate: okGenerator(received) }
    )

    expect(imageUrl).toBeDefined()
    expect(received[0]?.productImageUrl).toBeUndefined()
    expect(received[0]?.prompt).not.toContain("second image")
  })

  it("maps a timeout and other failures to api errors", async () => {
    const timeout: ImageGenerator = async () => ({ kind: "failed", reason: "timeout", message: "slow" })
    const upstream: ImageGenerator = async () => ({ kind: "failed", reason: "upstream", message: "down" })
    const input = { file, articleNo: "00000001", position: "left" as const }

    const timed = await visualizeProduct(input, { catalog: [item], generate: timeout })
    const failed = await visualizeProduct(input, { catalog: [item], generate: upstream })

    expect(!timed.ok && timed.code).toBe("timeout")
    expect(!failed.ok && failed.code).toBe("model_failed")
  })
})
