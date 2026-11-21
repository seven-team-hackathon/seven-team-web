import { z } from "zod"

export const furnitureCategorySchema = z.enum([
  "sofa",
  "armchair",
  "coffee-table",
  "side-table",
  "tv-unit",
  "bed",
  "wardrobe",
  "nightstand",
  "desk",
  "office-chair",
  "bookshelf",
  "dining-table",
  "dining-chair",
  "storage",
])

export type FurnitureCategory = z.infer<typeof furnitureCategorySchema>
