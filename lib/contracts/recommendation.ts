import { z } from "zod"

import { furnitureCategorySchema } from "@/lib/contracts/furniture-category"
import { currencySchema } from "@/lib/contracts/markets"
import { preferencesSchema } from "@/lib/contracts/preferences"
import { confirmedSpaceSchema, dimensionsBasisSchema } from "@/lib/contracts/space"

export const recommendRequestSchema = z.object({
  space: confirmedSpaceSchema,
  preferences: preferencesSchema,
})

export const recommendedItemSchema = z.object({
  articleNo: z.string().min(1),
  name: z.string().min(1),
  typeName: z.string().min(1),
  category: furnitureCategorySchema,
  widthCm: z.number().positive(),
  depthCm: z.number().positive(),
  heightCm: z.number().positive(),
  price: z.number().nonnegative(),
  currency: currencySchema,
  url: z.url(),
  reason: z.string().min(1).max(400),
})

export const categoryRecommendationSchema = z.object({
  category: furnitureCategorySchema,
  primary: recommendedItemSchema,
  alternatives: z.array(recommendedItemSchema).max(3),
})

export const fitIssueCodeSchema = z.enum([
  "item-too-wide",
  "floor-usage-exceeded",
  "over-budget",
])

export const fitIssueSchema = z.object({
  code: fitIssueCodeSchema,
  articleNo: z.string().min(1).optional(),
  message: z.string().min(1),
})

export const totalsSchema = z.object({
  price: z.number().nonnegative(),
  currency: currencySchema,
  budget: z.number().positive(),
  floorUsagePct: z.number().nonnegative(),
})

export const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
})

export const rankedBySchema = z.enum(["claude", "fallback"])

export const recommendationResponseSchema = z.object({
  items: z.array(categoryRecommendationSchema),
  totals: totalsSchema,
  fit: z.object({
    allFit: z.boolean(),
    issues: z.array(fitIssueSchema),
  }),
  usage: usageSchema,
  meta: z.object({
    rankedBy: rankedBySchema,
    dimensionsBasis: dimensionsBasisSchema,
  }),
})

export type RecommendRequest = z.infer<typeof recommendRequestSchema>

export type RecommendedItem = z.infer<typeof recommendedItemSchema>

export type CategoryRecommendation = z.infer<typeof categoryRecommendationSchema>

export type FitIssue = z.infer<typeof fitIssueSchema>

export type RecommendationUsage = z.infer<typeof usageSchema>

export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>
