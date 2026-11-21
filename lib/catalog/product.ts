import { z } from "zod"

import { furnitureCategorySchema } from "@/lib/contracts/furniture-category"
import { styleSchema } from "@/lib/contracts/preferences"
import { roomTypeSchema } from "@/lib/contracts/room-type"

const dimensionCmSchema = z.number().positive().max(1000)

export const articleNoSchema = z.string().regex(/^s?\d{8}$/)

export const productSchema = z.object({
  articleNo: articleNoSchema,
  name: z.string().min(1),
  typeName: z.string().min(1),
  category: furnitureCategorySchema,
  roomTypes: z.array(roomTypeSchema).min(1),
  widthCm: dimensionCmSchema,
  depthCm: dimensionCmSchema,
  heightCm: dimensionCmSchema,
  styleTags: z.array(styleSchema).min(1),
  colors: z.array(z.string().min(1)),
  material: z.string().min(1).optional(),
  description: z.string().min(1),
  productFamily: z.string().min(1).optional(),
  imageUrl: z.url().optional(),
  aiConfidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
})

export type Product = z.infer<typeof productSchema>
