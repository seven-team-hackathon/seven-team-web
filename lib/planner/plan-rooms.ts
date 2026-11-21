import {
  detectedRoomSchema,
  imageBoundsSchema,
  type DetectedRoom,
  type SpaceDraft,
} from "@/lib/contracts/space"

export { detectedRoomSchema, imageBoundsSchema }

export type { DetectedRoom }

export type PlanDraft = SpaceDraft

export const SAMPLE_PLAN_ROOMS: readonly DetectedRoom[] = [
  {
    id: "room-1",
    roomType: "living-room",
    dimensions: { widthCm: 420, lengthCm: 380, ceilingHeightCm: 250, source: "plan-labels", confidence: 0.9 },
    bounds: { x: 0.083, y: 0.15, width: 0.455, height: 0.493 },
  },
  {
    id: "room-2",
    roomType: "bedroom",
    dimensions: { widthCm: 350, lengthCm: 380, ceilingHeightCm: 250, source: "plan-labels", confidence: 0.85 },
    bounds: { x: 0.538, y: 0.15, width: 0.379, height: 0.493 },
  },
  {
    id: "room-3",
    roomType: "hallway",
    dimensions: { widthCm: 770, lengthCm: 160, ceilingHeightCm: 250, source: "plan-labels", confidence: 0.8 },
    bounds: { x: 0.083, y: 0.643, width: 0.834, height: 0.208 },
  },
]
