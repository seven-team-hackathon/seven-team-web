import { z } from "zod"

import { furnitureCategorySchema } from "@/lib/contracts/furniture-category"
import { marketSchema } from "@/lib/contracts/markets"
import { roomTypeSchema } from "@/lib/contracts/room-type"

export const styleSchema = z.enum([
  "scandinavian",
  "modern",
  "minimal",
  "cozy",
  "industrial",
  "classic",
])

export const householdSchema = z.object({
  hasChildren: z.boolean(),
  hasPets: z.boolean(),
})

export const preferencesSchema = z.object({
  market: marketSchema,
  roomType: roomTypeSchema,
  style: styleSchema,
  household: householdSchema,
  budget: z.number().positive().max(1_000_000),
  categories: z.array(furnitureCategorySchema).min(1),
  note: z.string().trim().max(500).optional(),
})

export type FurnitureStyle = z.infer<typeof styleSchema>

export type Household = z.infer<typeof householdSchema>

export type Preferences = z.infer<typeof preferencesSchema>
