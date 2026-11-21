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
  it("numbers the product photos after the room photo", () => {
    const prompt = buildVisualizationPrompt({
      subjects: [
        { description: "a sofa", hasImage: true },
        { description: "a table", hasImage: true },
      ],
    })

    expect(prompt).toContain("a sofa (product photo: image 2)")
    expect(prompt).toContain("a table (product photo: image 3)")
  })

  it("uses the plain prompt without product photos", () => {
    const prompt = buildVisualizationPrompt({
      subjects: [{ description: "a sofa", hasImage: false }],
    })

    expect(prompt).not.toContain("product photo")
    expect(prompt).toContain("1. a sofa.")
  })

  it("always keeps the room unchanged and the size realistic", () => {
    const prompt = buildVisualizationPrompt({
      subjects: [{ description: "a sofa", hasImage: true }],
    })

    expect(prompt).toContain("Keep the room exactly as it is")
    expect(prompt).toContain("realistic size")
  })
})

const second: CatalogItem = {
  ...item,
  articleNo: "00000002",
  name: "TEST Table",
  imageUrl: "https://www.ikea.com/us/en/images/products/table.jpg",
}

describe("visualizeProduct", () => {
  it("returns a response that matches the contract", async () => {
    const result = await visualizeProduct(
      { file, articleNos: ["00000001"] },
      { catalog: [item], generate: okGenerator() }
    )

    expect(result.ok && visualizeResponseSchema.safeParse(result.response).success).toBe(true)
  })

  it("sends the room photo and every product photo from the catalog", async () => {
    const received: GenerateInput[] = []

    await visualizeProduct(
      { file, articleNos: ["00000001", "00000002"] },
      { catalog: [item, second], generate: okGenerator(received) }
    )

    expect(received[0]?.roomImageDataUrl).toBe("data:image/jpeg;base64,AQID")
    expect(received[0]?.productImageUrls).toEqual([item.imageUrl, second.imageUrl])
    expect(received[0]?.prompt).toContain("TEST Table")
  })

  it("does not take the product from the client", async () => {
    const result = await visualizeProduct(
      { file, articleNos: ["99999999"] },
      { catalog: [item], generate: okGenerator() }
    )

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("rejects the request when any product is unknown", async () => {
    const result = await visualizeProduct(
      { file, articleNos: ["00000001", "99999999"] },
      { catalog: [item], generate: okGenerator() }
    )

    expect(!result.ok && result.code).toBe("invalid_input")
  })

  it("works for a product without a photo", async () => {
    const received: GenerateInput[] = []
    const { imageUrl, ...withoutImage } = item

    await visualizeProduct(
      { file, articleNos: ["00000001"] },
      { catalog: [withoutImage], generate: okGenerator(received) }
    )

    expect(imageUrl).toBeDefined()
    expect(received[0]?.productImageUrls).toEqual([])
    expect(received[0]?.prompt).not.toContain("product photo")
  })

  it("maps a timeout and other failures to api errors", async () => {
    const timeout: ImageGenerator = async () => ({ kind: "failed", reason: "timeout", message: "slow" })
    const upstream: ImageGenerator = async () => ({ kind: "failed", reason: "upstream", message: "down" })
    const input = { file, articleNos: ["00000001"] }

    const timed = await visualizeProduct(input, { catalog: [item], generate: timeout })
    const failed = await visualizeProduct(input, { catalog: [item], generate: upstream })

    expect(!timed.ok && timed.code).toBe("timeout")
    expect(!failed.ok && failed.code).toBe("model_failed")
  })
})
