import { z } from "zod"

export const wallPositionSchema = z.enum(["left", "center", "right"])

export const visualizeResponseSchema = z.object({
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageBase64: z.string().min(1),
  model: z.string().min(1),
  costUsd: z.number().nonnegative().optional(),
})

export type WallPosition = z.infer<typeof wallPositionSchema>

export type VisualizeResponse = z.infer<typeof visualizeResponseSchema>
