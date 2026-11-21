import { z } from "zod"

import { roomTypeSchema } from "@/lib/contracts/room-type"

export const spaceKindSchema = z.enum(["plan", "photo"])

export const dimensionSourceSchema = z.enum([
  "plan-labels",
  "estimated",
  "unknown",
])

export const openingTypeSchema = z.enum(["door", "window"])

export const wallSchema = z.enum(["north", "east", "south", "west"])

export const dimensionsBasisSchema = z.enum(["user", "estimated"])

export const missingSpaceFieldSchema = z.enum([
  "dimensions",
  "ceiling-height",
  "openings",
  "room-type",
])

const lengthCmSchema = z.number().positive().max(2000)

const roomSizeSchema = z.object({
  widthCm: lengthCmSchema,
  lengthCm: lengthCmSchema,
  ceilingHeightCm: lengthCmSchema.optional(),
})

export const detectedDimensionsSchema = roomSizeSchema.extend({
  source: dimensionSourceSchema,
  confidence: z.number().min(0).max(1),
})

export const openingSchema = z.object({
  type: openingTypeSchema,
  widthCm: lengthCmSchema.optional(),
  wall: wallSchema.optional(),
})

const unitIntervalSchema = z.number().min(0).max(1)

export const imageBoundsSchema = z.object({
  x: unitIntervalSchema,
  y: unitIntervalSchema,
  width: unitIntervalSchema.positive(),
  height: unitIntervalSchema.positive(),
})

export const detectedRoomSchema = z.object({
  id: z.string().min(1),
  roomType: roomTypeSchema.optional(),
  dimensions: detectedDimensionsSchema.optional(),
  bounds: imageBoundsSchema,
})

export const spaceDraftSchema = z.object({
  kind: spaceKindSchema,
  roomType: roomTypeSchema.optional(),
  dimensions: detectedDimensionsSchema.optional(),
  openings: z.array(openingSchema),
  styleHints: z.array(z.string().min(1).max(60)),
  needsUserInput: z.array(missingSpaceFieldSchema),
  rooms: z.array(detectedRoomSchema).optional(),
})

export const confirmedSpaceSchema = z.object({
  roomType: roomTypeSchema,
  dimensions: roomSizeSchema,
  dimensionsBasis: dimensionsBasisSchema.optional(),
  openings: z.array(openingSchema),
  styleHints: z.array(z.string().min(1).max(60)).optional(),
})

export type SpaceKind = z.infer<typeof spaceKindSchema>

export type DimensionSource = z.infer<typeof dimensionSourceSchema>

export type DimensionsBasis = z.infer<typeof dimensionsBasisSchema>

export type Opening = z.infer<typeof openingSchema>

export type MissingSpaceField = z.infer<typeof missingSpaceFieldSchema>

export type ImageBounds = z.infer<typeof imageBoundsSchema>

export type DetectedRoom = z.infer<typeof detectedRoomSchema>

export type SpaceDraft = z.infer<typeof spaceDraftSchema>

export type ConfirmedSpace = z.infer<typeof confirmedSpaceSchema>
