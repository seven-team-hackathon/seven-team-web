import type { FurnitureCategory } from "@/lib/contracts/furniture-category"

const CATEGORY_KEYWORDS: Readonly<Record<FurnitureCategory, readonly string[]>> = {
  sofa: ["sofa", "couch", "settee"],
  armchair: ["armchair"],
  "coffee-table": ["coffee table"],
  "side-table": ["side table", "end table"],
  "tv-unit": ["tv", "tv unit", "tv stand", "media unit"],
  bed: ["bed"],
  wardrobe: ["wardrobe", "closet"],
  nightstand: ["nightstand", "bedside table"],
  desk: ["desk"],
  "office-chair": ["office chair", "desk chair"],
  bookshelf: ["bookshelf", "bookcase", "shelf", "shelves"],
  "dining-table": ["dining table", "kitchen table"],
  "dining-chair": ["dining chair", "kitchen chair"],
  storage: ["storage", "dresser", "cabinet", "chest of drawers"],
}

const CATEGORY_PATTERNS = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => ({
  category,
  pattern: new RegExp(`\\b(${keywords.join("|")})s?\\b`, "i"),
}))

export function matchCategories(text: string): string[] {
  return CATEGORY_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ category }) => category)
}
