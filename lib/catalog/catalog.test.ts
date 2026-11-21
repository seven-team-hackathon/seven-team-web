import { describe, expect, it } from "vitest"

import { buildIkeaUrl } from "@/lib/catalog/build-ikea-url"
import {
  buildCatalog,
  loadCatalog,
  parseCatalogData,
} from "@/lib/catalog/load-catalog"
import type { MarketListing } from "@/lib/catalog/market-listing"
import type { Product } from "@/lib/catalog/product"

const testProduct: Product = {
  articleNo: "00000001",
  name: "TEST sofa",
  typeName: "3-seat sofa",
  category: "sofa",
  roomTypes: ["living-room"],
  widthCm: 220,
  depthCm: 90,
  heightCm: 85,
  styleTags: ["scandinavian"],
  colors: ["gray"],
  description: "Synthetic product used only in tests.",
  aiConfidence: 0.9,
  needsReview: false,
}

const testListing: MarketListing = {
  articleNo: "00000001",
  market: "us",
  available: true,
  price: 499,
  currency: "USD",
  priceFetchedAt: "2026-11-21T12:00:00.000Z",
}

describe("buildIkeaUrl", () => {
  it("builds a locale prefixed article url for the us market", () => {
    expect(buildIkeaUrl("us", "s29533309")).toBe(
      "https://www.ikea.com/us/en/p/-s29533309/"
    )
  })

  it("keeps leading zeros of the article number", () => {
    expect(buildIkeaUrl("us", "00395252")).toBe(
      "https://www.ikea.com/us/en/p/-00395252/"
    )
  })
})

describe("parseCatalogData", () => {
  it("accepts valid products and listings", () => {
    const data = parseCatalogData([testProduct], [testListing])

    expect(data.products).toHaveLength(1)
    expect(data.listings).toHaveLength(1)
  })

  it("accepts an s-prefixed article number", () => {
    const data = parseCatalogData(
      [{ ...testProduct, articleNo: "s29533309" }],
      []
    )

    expect(data.products[0]?.articleNo).toBe("s29533309")
  })

  it("rejects a product with a malformed article number", () => {
    expect(() =>
      parseCatalogData([{ ...testProduct, articleNo: "abc" }], [])
    ).toThrow()
  })

  it("rejects a product without any style tag", () => {
    expect(() =>
      parseCatalogData([{ ...testProduct, styleTags: [] }], [])
    ).toThrow()
  })

  it("rejects a listing with an invalid timestamp", () => {
    expect(() =>
      parseCatalogData([], [{ ...testListing, priceFetchedAt: "yesterday" }])
    ).toThrow()
  })
})

describe("buildCatalog", () => {
  it("joins a product with its listing and builds the url", () => {
    const catalog = buildCatalog(
      { products: [testProduct], listings: [testListing] },
      "us"
    )

    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({
      articleNo: "00000001",
      price: 499,
      currency: "USD",
      url: "https://www.ikea.com/us/en/p/-00000001/",
    })
  })

  it("skips listings that are not available", () => {
    const catalog = buildCatalog(
      {
        products: [testProduct],
        listings: [{ ...testListing, available: false }],
      },
      "us"
    )

    expect(catalog).toHaveLength(0)
  })

  it("skips listings without a matching product", () => {
    const catalog = buildCatalog(
      {
        products: [testProduct],
        listings: [{ ...testListing, articleNo: "00000002" }],
      },
      "us"
    )

    expect(catalog).toHaveLength(0)
  })
})

describe("loadCatalog", () => {
  it("returns only valid items for the us market", () => {
    const catalog = loadCatalog("us")

    for (const item of catalog) {
      expect(item.url.startsWith("https://www.ikea.com/us/")).toBe(true)
      expect(item.price).toBeGreaterThanOrEqual(0)
    }
  })
})
