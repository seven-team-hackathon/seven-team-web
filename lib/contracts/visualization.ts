import { z } from "zod"

export const MAX_VISUALIZED_PRODUCTS = 4

export const visualizeResponseSchema = z.object({
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageBase64: z.string().min(1),
  model: z.string().min(1),
  costUsd: z.number().nonnegative().optional(),
})

export type VisualizeResponse = z.infer<typeof visualizeResponseSchema>
