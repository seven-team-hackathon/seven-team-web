"use client"

import { useState } from "react"
import type { Preferences } from "@/lib/contracts/preferences"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import type { ConfirmedSpace, SpaceDraft, SpaceKind } from "@/lib/contracts/space"
import { autoArrange, type LayoutItem } from "@/lib/planner/layout"
import { FREE_CATEGORY_COUNT } from "@/lib/planner/options"
import { arrangeOnWall, getWallSize, type WallItem, type WallSide } from "@/lib/planner/wall-layout"
import type { ImageRef } from "@/lib/images/image-size"
import { WHOLE_IMAGE_BOUNDS, type RoomBounds } from "@/lib/planner/room-bounds"
import { AnalyzingStep, type AnalyzedImage, type SpaceUpload } from "@/components/planner/analyzing-step"
import { FloorLayoutStep } from "@/components/planner/floor-layout-step"
import { FlowSteps, getFurtherStep, type FlowStep } from "@/components/planner/flow-steps"
import { PreferencesStep, type SpaceInput } from "@/components/planner/preferences-step"
import { ResultsStep } from "@/components/planner/results-step"
import { RoomStep } from "@/components/planner/room-step"
import { UploadStep } from "@/components/planner/upload-step"
import { WallLayoutStep } from "@/components/planner/wall-layout-step"

type FlowState =
  | { readonly step: "upload" }
  | { readonly step: "analyzing"; readonly upload: SpaceUpload }
  | { readonly step: "room"; readonly draft: SpaceDraft }
  | { readonly step: "preferences"; readonly space: SpaceInput; readonly variant: SpaceKind }
  | {
      readonly step: "results" | "layout"
      readonly space: ConfirmedSpace
      readonly recommendation: RecommendationResponse
    }

type LayoutState =
  | { readonly view: "floor"; readonly items: readonly LayoutItem[] }
  | { readonly view: "wall"; readonly wallSide: WallSide; readonly items: readonly WallItem[] }

type SpaceImage = ImageRef & {
  readonly kind: SpaceKind
}

type FlowProgress = {
  readonly furthestStep: FlowStep
  readonly draft: SpaceDraft | null
  readonly image: SpaceImage | null
  readonly roomBounds: RoomBounds | null
  readonly preferencesSpace: SpaceInput | null
  readonly space: ConfirmedSpace | null
  readonly preferences: Preferences | null
  readonly recommendation: RecommendationResponse | null
  readonly layout: LayoutState | null
  readonly isUnlocked: boolean
}

const INITIAL_PROGRESS: FlowProgress = {
  furthestStep: "upload",
  draft: null,
  image: null,
  roomBounds: null,
  preferencesSpace: null,
  space: null,
  preferences: null,
  recommendation: null,
  layout: null,
  isUnlocked: false,
}

function arrangeLayout(
  kind: SpaceKind,
  wallSide: WallSide,
  space: ConfirmedSpace,
  recommendation: RecommendationResponse,
  isUnlocked: boolean,
): LayoutState {
  const visibleItems = isUnlocked ? recommendation.items : recommendation.items.slice(0, FREE_CATEGORY_COUNT)
  if (kind === "photo") {
    return { view: "wall", wallSide, items: arrangeOnWall(getWallSize(space, wallSide), visibleItems) }
  }
  return { view: "floor", items: autoArrange(space.dimensions, visibleItems) }
}

function getPhotoSpace(draft: SpaceDraft): SpaceInput | null {
  if (draft.kind !== "photo" || !draft.dimensions) return null
  const { widthCm, lengthCm, ceilingHeightCm } = draft.dimensions
  return { roomType: draft.roomType ?? null, dimensions: { widthCm, lengthCm, ceilingHeightCm }, openings: draft.openings }
}

export function PlannerFlow() {
  const [flow, setFlow] = useState<FlowState>({ step: "upload" })
  const [progress, setProgress] = useState<FlowProgress>(INITIAL_PROGRESS)

  function releaseImage() {
    if (progress.image) URL.revokeObjectURL(progress.image.url)
  }

  function handleUploadSubmit(upload: SpaceUpload) {
    releaseImage()
    setProgress({ ...INITIAL_PROGRESS, furthestStep: "analyzing" })
    setFlow({ step: "analyzing", upload })
  }

  function handleAnalyzed(draft: SpaceDraft, { file, width, height }: AnalyzedImage) {
    releaseImage()
    const image: SpaceImage = { kind: draft.kind, url: URL.createObjectURL(file), width, height }
    const photoSpace = getPhotoSpace(draft)

    if (photoSpace) {
      setProgress((current) => ({ ...current, draft, image, preferencesSpace: photoSpace, furthestStep: "preferences" }))
      setFlow({ step: "preferences", space: photoSpace, variant: "photo" })
      return
    }

    setProgress((current) => ({ ...current, draft, image, furthestStep: getFurtherStep(current.furthestStep, "room") }))
    setFlow({ step: "room", draft })
  }

  function handleRoomConfirmed(space: ConfirmedSpace, roomBounds: RoomBounds) {
    setProgress((current) => ({
      ...current,
      roomBounds,
      preferencesSpace: space,
      space,
      recommendation: null,
      layout: null,
      furthestStep: "preferences",
    }))
    setFlow({ step: "preferences", space, variant: progress.draft?.kind ?? "plan" })
  }

  function handleRecommended(space: ConfirmedSpace, preferences: Preferences, recommendation: RecommendationResponse) {
    setProgress((current) => ({ ...current, space, preferences, recommendation, layout: null, furthestStep: "results" }))
    setFlow({ step: "results", space, recommendation })
  }

  function handleUnlock() {
    setProgress((current) => ({ ...current, isUnlocked: true, layout: null }))
  }

  function arrangeFor(space: ConfirmedSpace, recommendation: RecommendationResponse, wallSide: WallSide): LayoutState {
    return arrangeLayout(progress.image?.kind ?? "plan", wallSide, space, recommendation, progress.isUnlocked)
  }

  function openLayout(space: ConfirmedSpace, recommendation: RecommendationResponse) {
    const layout = progress.layout ?? arrangeFor(space, recommendation, "width")
    setProgress((current) => ({ ...current, layout, furthestStep: "layout" }))
    setFlow({ step: "layout", space, recommendation })
  }

  function setLayout(layout: LayoutState) {
    setProgress((current) => ({ ...current, layout }))
  }

  function handleStepSelect(step: FlowStep) {
    const { draft, preferencesSpace, space, recommendation } = progress
    switch (step) {
      case "upload":
        setFlow({ step: "upload" })
        break
      case "room":
        if (draft) setFlow({ step: "room", draft })
        break
      case "preferences":
        if (preferencesSpace) setFlow({ step: "preferences", space: preferencesSpace, variant: draft?.kind ?? "plan" })
        break
      case "results":
        if (space && recommendation) setFlow({ step: "results", space, recommendation })
        break
      case "layout":
        if (space && recommendation) openLayout(space, recommendation)
        break
      case "analyzing":
        break
    }
  }

  function renderLayout(space: ConfirmedSpace, recommendation: RecommendationResponse) {
    const { layout, image } = progress
    if (!layout || !image) return null

    switch (layout.view) {
      case "floor":
        return (
          <FloorLayoutStep
            room={space.dimensions}
            planImage={image}
            roomBounds={progress.roomBounds ?? WHOLE_IMAGE_BOUNDS}
            items={layout.items}
            onItemsChange={(items) => setLayout({ view: "floor", items })}
            onAutoArrange={() => setLayout(arrangeFor(space, recommendation, "width"))}
          />
        )
      case "wall":
        return (
          <WallLayoutStep
            wall={getWallSize(space, layout.wallSide)}
            wallSide={layout.wallSide}
            wallLengths={{ width: space.dimensions.widthCm, length: space.dimensions.lengthCm }}
            photoUrl={image.url}
            items={layout.items}
            onItemsChange={(items) => setLayout({ ...layout, items })}
            onWallSideChange={(wallSide) => setLayout(arrangeFor(space, recommendation, wallSide))}
            onAutoArrange={() => setLayout(arrangeFor(space, recommendation, layout.wallSide))}
          />
        )
    }
  }

  function renderStep() {
    switch (flow.step) {
      case "upload":
        return <UploadStep onSubmit={handleUploadSubmit} />
      case "analyzing":
        return <AnalyzingStep upload={flow.upload} onAnalyzed={handleAnalyzed} />
      case "room":
        return (
          <RoomStep
            draft={flow.draft}
            planImage={progress.image?.kind === "plan" ? progress.image : null}
            initialSpace={progress.space}
            initialBounds={progress.roomBounds}
            onConfirm={handleRoomConfirmed}
          />
        )
      case "preferences":
        return (
          <PreferencesStep
            space={flow.space}
            variant={flow.variant}
            initialPreferences={progress.preferences}
            onRecommended={handleRecommended}
          />
        )
      case "results":
        return (
          <ResultsStep
            roomType={flow.space.roomType}
            recommendation={flow.recommendation}
            isUnlocked={progress.isUnlocked}
            onUnlock={handleUnlock}
            onOpenLayout={() => openLayout(flow.space, flow.recommendation)}
          />
        )
      case "layout":
        return renderLayout(flow.space, flow.recommendation)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-5">
      <FlowSteps
        currentStep={flow.step}
        furthestStep={progress.furthestStep}
        skippedSteps={progress.draft && getPhotoSpace(progress.draft) ? ["room"] : []}
        onStepSelect={handleStepSelect}
      />
      <div className="flex flex-1 flex-col *:flex-1">{renderStep()}</div>
    </div>
  )
}
