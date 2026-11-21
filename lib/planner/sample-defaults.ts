import { spaceDraftPlanFixture } from "@/lib/contracts/fixtures"
import type { SpaceDraft } from "@/lib/contracts/space"

export function applySamplePlanDefaults(draft: SpaceDraft): SpaceDraft {
  return {
    ...draft,
    roomType: draft.roomType ?? spaceDraftPlanFixture.roomType,
    dimensions: draft.dimensions ?? spaceDraftPlanFixture.dimensions,
    rooms: spaceDraftPlanFixture.rooms ?? draft.rooms,
  }
}
