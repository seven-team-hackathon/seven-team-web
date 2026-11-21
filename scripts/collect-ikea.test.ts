import { describe, expect, it } from "vitest"

import {
  classifySlug,
  extractMeasurements,
  inchesToCm,
  isExcludedSlug,
  parseFraction,
  parseMeasurementText,
  parsePage,
  parseUrl,
  selectUrls,
} from "./collect-ikea.mjs"

describe("parseFraction", () => {
  it("parses a mixed number", () => {
    expect(parseFraction("28 3/4")).toBe(28.75)
  })

  it("parses a whole number", () => {
    expect(parseFraction("15")).toBe(15)
  })

  it("parses a fraction without a whole part", () => {
    expect(parseFraction("1/2")).toBe(0.5)
  })

  it("rejects text and zero denominators", () => {
    expect(parseFraction("Queen")).toBeNull()
    expect(parseFraction("3 1/0")).toBeNull()
  })
})

describe("inchesToCm", () => {
  it("converts and rounds to one decimal", () => {
    expect(inchesToCm(28.75)).toBe(73)
    expect(inchesToCm(15)).toBe(38.1)
  })
})

describe("parseMeasurementText", () => {
  it("parses a single value with an escaped inch mark", () => {
    expect(parseMeasurementText('28 3/4 &quot;')).toEqual({
      parsed: true,
      inches: [28.75],
      cm: [73],
    })
  })

  it("parses multi-part values", () => {
    const result = parseMeasurementText("70 7/8x16 1/2x15 &quot;")
    expect(result.parsed).toBe(true)
    expect(result.inches).toEqual([70.875, 16.5, 15])
    expect(result.cm).toEqual([180, 41.9, 38.1])
  })

  it("does not parse bed size labels", () => {
    expect(parseMeasurementText("Queen").parsed).toBe(false)
  })
})

describe("extractMeasurements and parsePage", () => {
  const row = (label: string, value: string) =>
    `<li><span class="pipf-measurements-tab__measurement-name">${label}</span><span class="pipf-measurements-tab__measurement-value">${value}</span></li>`

  it("extracts rows and sets width, depth and height", () => {
    const html = [
      '<script type="application/ld+json">{"@type":"Product","name":"TEST sofa","description":"A sofa","offers":{"price":"599","priceCurrency":"USD"}}</script>',
      row("Width", "40 &quot;"),
      row("Depth", "20 &quot;"),
      row("Height", "30 1/2 &quot;"),
      row("Seat width", "30x10 &quot;"),
    ].join("")
    expect(extractMeasurements(html)).toHaveLength(4)
    const page = parsePage(html)
    expect(page.priceUsd).toBe(599)
    expect(page.currency).toBe("USD")
    expect(page.widthCm).toBe(101.6)
    expect(page.heightCm).toBe(77.5)
    expect(page.reviewReasons).toContain("ambiguous-measurements")
  })

  it("flags missing price and dimensions without inventing values", () => {
    const page = parsePage(row("Diameter", "30 &quot;"))
    expect(page.priceUsd).toBeNull()
    expect(page.widthCm).toBeNull()
    expect(page.needsReview).toBe(true)
    expect(page.reviewReasons).toEqual(
      expect.arrayContaining(["missing-price", "missing-dimensions"])
    )
  })
})

describe("url selection", () => {
  it("parses urls and classifies slugs", () => {
    expect(parseUrl("https://www.ikea.com/us/en/p/vedbo-armchair-gray-50424129/")).toEqual({
      slug: "vedbo-armchair-gray",
      articleNo: "50424129",
      family: "vedbo",
    })
    expect(classifySlug("kivik-sofa-gray")).toBe("sofa")
    expect(classifySlug("malm-bed-frame-white")).toBe("bed")
    expect(isExcludedSlug("kivik-cover-gray")).toBe(true)
  })

  it("is deterministic and keeps one primary per model", () => {
    const urls = Array.from({ length: 30 }, (_, i) => [
      `https://www.ikea.com/us/en/p/fam${String.fromCharCode(97 + (i % 10))}-sofa-v${i}-${String(10000000 + i)}/`,
    ]).flat()
    const first = selectUrls(urls, 1, 5, 8)
    expect(selectUrls(urls, 1, 5, 8)).toEqual(first)
    expect(first).toHaveLength(8)
    expect(new Set(first.map((s) => s.articleNo)).size).toBe(8)
  })
})
