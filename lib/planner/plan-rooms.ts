import { spaceDraftPlanFixture } from "@/lib/contracts/fixtures"
import {
  detectedRoomSchema,
  imageBoundsSchema,
  type DetectedRoom,
  type SpaceDraft,
} from "@/lib/contracts/space"

export { detectedRoomSchema, imageBoundsSchema }

export type { DetectedRoom }

export type PlanDraft = SpaceDraft

export const SAMPLE_PLAN_ROOMS: readonly DetectedRoom[] = spaceDraftPlanFixture.rooms ?? []
