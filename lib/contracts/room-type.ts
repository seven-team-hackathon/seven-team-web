import { z } from "zod"

export const roomTypeSchema = z.enum([
  "living-room",
  "bedroom",
  "home-office",
  "dining-room",
  "kids-room",
  "hallway",
])

export type RoomType = z.infer<typeof roomTypeSchema>
