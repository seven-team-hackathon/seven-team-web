import { describe, expect, it } from "vitest"
import { pluralize } from "@/lib/pluralize"

describe("pluralize", () => {
  it("uses the singular form for one", () => {
    expect(pluralize(1, "product", "products")).toBe("1 product")
  })

  it("uses the plural form otherwise", () => {
    expect(pluralize(0, "product", "products")).toBe("0 products")
    expect(pluralize(5, "product", "products")).toBe("5 products")
  })
})
