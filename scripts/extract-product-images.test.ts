import { describe, expect, it } from "vitest"

import { extractOgImage } from "./extract-product-images.mjs"

describe("extractOgImage", () => {
  it("reads the og:image url of an ikea page", () => {
    const html =
      '<head><meta property="og:image" content="https://www.ikea.com/us/en/images/products/test__1_s5.jpg"/></head>'

    expect(extractOgImage(html)).toBe(
      "https://www.ikea.com/us/en/images/products/test__1_s5.jpg"
    )
  })

  it("returns null when there is no og:image", () => {
    expect(extractOgImage("<head></head>")).toBeNull()
  })

  it("rejects an image that is not hosted by ikea", () => {
    const html = '<meta property="og:image" content="https://example.com/a.jpg"/>'

    expect(extractOgImage(html)).toBeNull()
  })
})
