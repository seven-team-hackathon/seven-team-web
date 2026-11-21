import { describe, expect, it } from "vitest"

import {
  detectExclusion,
  normalizeItem,
  resolveDimensions,
  summarizeNormalization,
} from "./ingest-catalog.mjs"
import type { Measurement, RawItem } from "./ingest-catalog.mjs"

function measure(label: string, valueCm: number | null = 100): Measurement {
  return { label, rawText: valueCm === null ? "" : `${valueCm} cm`, valueCm }
}

function buildRawItem(overrides: Partial<RawItem>): RawItem {
  return {
    articleNo: "00000001",
    url: "https://www.ikea.com/us/en/p/test-00000001/",
    family: "test",
    categoryGuess: "sofa",
    name: "TEST Sofa",
    description: "Synthetic item used only in tests.",
    priceUsd: 100,
    currency: "USD",
    measurements: [],
    fetchedAt: "2026-11-21T12:00:00.000Z",
    ...overrides,
  }
}

describe("resolveDimensions", () => {
  it("uses width, depth and height labels directly", () => {
    const result = resolveDimensions("sofa", [
      measure("Width", 200),
      measure("Depth", 90),
      measure("Height", 80),
    ])

    expect(result).toEqual({
      widthCm: 200,
      depthCm: 90,
      heightCm: 80,
      rules: [],
    })
  })

  it("maps bed length to depth and headboard height to height", () => {
    const result = resolveDimensions("bed", [
      measure("Length", 200),
      measure("Width", 100),
      measure("Headboard height", 65),
      measure("Footboard height", 30),
    ])

    expect(result.widthCm).toBe(100)
    expect(result.depthCm).toBe(200)
    expect(result.heightCm).toBe(65)
    expect(result.rules).toContain("depth<-length")
    expect(result.rules).toContain("height<-headboard height")
  })

  it("prefers an overall bed height over the headboard height", () => {
    const result = resolveDimensions("bed", [
      measure("Length", 200),
      measure("Width", 100),
      measure("Height", 90),
      measure("Headboard height", 65),
    ])

    expect(result.heightCm).toBe(90)
  })

  it("uses the shortest setup of an extendable bed", () => {
    const result = resolveDimensions("bed", [
      measure("Min. length", 190),
      measure("Max. length", 250),
      measure("Width", 100),
      measure("Headboard height", 70),
    ])

    expect(result.depthCm).toBe(190)
    expect(result.rules).toContain("depth<-min. length")
  })

  it("uses the minimum width of an adjustable bed", () => {
    const result = resolveDimensions("bed", [
      measure("Length", 200),
      measure("Height", 35),
      measure("Min. bed width", 80),
      measure("Max. bed width", 100),
    ])

    expect(result.widthCm).toBe(80)
    expect(result.rules).toContain("width<-min. bed width")
  })

  it("treats table length as width and table width as depth", () => {
    const result = resolveDimensions("coffee-table", [
      measure("Length", 120),
      measure("Width", 60),
      measure("Height", 45),
    ])

    expect(result.widthCm).toBe(120)
    expect(result.depthCm).toBe(60)
    expect(result.heightCm).toBe(45)
  })

  it("uses the closed length for extendable tables", () => {
    const result = resolveDimensions("dining-table", [
      measure("Min. length", 140),
      measure("Max. length", 220),
      measure("Width", 80),
      measure("Height", 75),
    ])

    expect(result.widthCm).toBe(140)
  })

  it("uses the diameter for round items", () => {
    const result = resolveDimensions("dining-table", [
      measure("Diameter", 105),
      measure("Height", 74),
    ])

    expect(result.widthCm).toBe(105)
    expect(result.depthCm).toBe(105)
    expect(result.rules).toContain("width<-diameter")
  })

  it("falls back to the height including back cushions", () => {
    const result = resolveDimensions("sofa", [
      measure("Width", 200),
      measure("Depth", 90),
      measure("Height including back cushions", 85),
      measure("Seat height", 45),
    ])

    expect(result.heightCm).toBe(85)
  })

  it("uses the maximum height for adjustable items", () => {
    const result = resolveDimensions("office-chair", [
      measure("Width", 65),
      measure("Depth", 65),
      measure("Max. height", 110),
      measure("Min. height", 100),
    ])

    expect(result.heightCm).toBe(110)
  })

  it("leaves dimensions empty when labels are ambiguous", () => {
    const result = resolveDimensions("nightstand", [
      measure("Depth", 30),
      measure("Width, standing horizontally", 60),
      measure("Height, standing horizontally", 20),
    ])

    expect(result.widthCm).toBeNull()
    expect(result.heightCm).toBeNull()
  })

  it("ignores measurements without a numeric value", () => {
    const result = resolveDimensions("sofa", [measure("Width", null)])

    expect(result.widthCm).toBeNull()
  })

  it("returns nothing for an item without measurements", () => {
    expect(resolveDimensions("sofa", [])).toEqual({
      widthCm: null,
      depthCm: null,
      heightCm: null,
      rules: [],
    })
  })
})

describe("detectExclusion", () => {
  it("keeps a normal piece of furniture", () => {
    expect(detectExclusion("TEST Sofa, gray", [measure("Width")])).toBeNull()
  })

  it("keeps a sectional sofa", () => {
    expect(detectExclusion("TEST 3-seat sectional, gray", [])).toBeNull()
  })

  it("excludes outdoor items", () => {
    expect(detectExclusion("TEST Armchair, outdoor - beige", [])).toBe("outdoor")
  })

  it("excludes sofa parts", () => {
    expect(detectExclusion("TEST Backrest for modular sofa", [])).toBe(
      "part-or-accessory"
    )
    expect(detectExclusion("TEST Corner section, gray", [])).toBe(
      "part-or-accessory"
    )
  })

  it("excludes covers", () => {
    expect(detectExclusion("TEST Cover for armchair", [])).toBe(
      "part-or-accessory"
    )
  })

  it("excludes lighting by its measurement labels", () => {
    expect(
      detectExclusion("TEST Wardrobe lighting", [
        measure("Cord length"),
        measure("Luminous flux"),
      ])
    ).toBe("lighting")
  })

  it("excludes table and chair sets", () => {
    expect(
      detectExclusion("TEST Table and 4 chairs", [
        measure("Chair width"),
        measure("Table height"),
      ])
    ).toBe("set")
  })
})

describe("normalizeItem", () => {
  it("marks dimensions as complete when all three are resolved", () => {
    const item = normalizeItem(
      buildRawItem({
        measurements: [
          measure("Width", 200),
          measure("Depth", 90),
          measure("Height", 80),
        ],
      })
    )

    expect(item.dimensionsComplete).toBe(true)
    expect(item.exclusion).toBeNull()
  })

  it("marks dimensions as incomplete when one is missing", () => {
    const item = normalizeItem(
      buildRawItem({ measurements: [measure("Width", 200)] })
    )

    expect(item.dimensionsComplete).toBe(false)
  })
})

describe("summarizeNormalization", () => {
  it("reports excluded items and complete dimensions", () => {
    const complete = normalizeItem(
      buildRawItem({
        measurements: [
          measure("Width", 200),
          measure("Depth", 90),
          measure("Height", 80),
        ],
      })
    )
    const outdoor = normalizeItem(
      buildRawItem({ articleNo: "00000002", name: "TEST Chair, outdoor" })
    )

    const summary = summarizeNormalization([complete, outdoor])

    expect(summary).toContain("total: 2")
    expect(summary).toContain("excluded: 1")
    expect(summary).toContain("excluded as outdoor: 1")
    expect(summary).toContain("sofa: 1/1")
  })
})
