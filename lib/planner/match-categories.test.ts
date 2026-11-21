import { describe, expect, it } from "vitest"
import { matchCategories } from "@/lib/planner/match-categories"

describe("matchCategories", () => {
  it("finds categories named in free text", () => {
    expect(matchCategories("A tall wardrobe and a couple of shelves")).toEqual(["wardrobe", "bookshelf"])
  })

  it("recognizes synonyms and plurals", () => {
    expect(matchCategories("Need a couch and two dining chairs")).toEqual(["sofa", "dining-chair"])
  })

  it("does not match parts of other words", () => {
    expect(matchCategories("bedside table")).toEqual(["nightstand"])
  })

  it("returns nothing for unrelated text", () => {
    expect(matchCategories("make it cozy")).toEqual([])
  })
})
