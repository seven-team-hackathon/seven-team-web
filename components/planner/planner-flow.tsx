"use client"

import { useState } from "react"
import type { Preferences } from "@/lib/contracts/preferences"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import type { ConfirmedSpace, SpaceDraft, SpaceKind } from "@/lib/contracts/space"
import { MAX_VISUALIZED_PRODUCTS } from "@/lib/contracts/visualization"
import { CATEGORY_META, FREE_CATEGORY_COUNT } from "@/lib/planner/options"
import type { ImageRef } from "@/lib/images/image-size"
import type { RoomBounds } from "@/lib/planner/room-bounds"
import { SAMPLE_PHOTO_SPACE } from "@/lib/planner/sample-photo"
import { AnalyzingStep, type AnalyzedImage, type SpaceUpload } from "@/components/planner/analyzing-step"
import { FlowSteps, getFurtherStep, type FlowStep } from "@/components/planner/flow-steps"
import { PreferencesStep, type SpaceInput } from "@/components/planner/preferences-step"
import { ResultsStep } from "@/components/planner/results-step"
import { RoomPreviewStep, type PreviewProduct, type RoomPreview } from "@/components/planner/room-preview-step"
import { RoomStep } from "@/components/planner/room-step"
import { UploadStep } from "@/components/planner/upload-step"

type FlowState =
  | { readonly step: "upload" }
  | { readonly step: "analyzing"; readonly upload: SpaceUpload }
  | { readonly step: "room"; readonly draft: SpaceDraft }
  | { readonly step: "preferences"; readonly space: SpaceInput; readonly variant: SpaceKind }
  | {
      readonly step: "results" | "preview"
      readonly space: ConfirmedSpace
      readonly recommendation: RecommendationResponse
    }

type SpaceImage = ImageRef & {
  readonly kind: SpaceKind
  readonly file: File
}

type FlowProgress = {
  readonly furthestStep: FlowStep
  readonly draft: SpaceDraft | null
  readonly isRoomSkipped: boolean
  readonly image: SpaceImage | null
  readonly roomBounds: RoomBounds | null
  readonly preferencesSpace: SpaceInput | null
  readonly space: ConfirmedSpace | null
  readonly preferences: Preferences | null
  readonly recommendation: RecommendationResponse | null
  readonly preview: RoomPreview | null
  readonly isUnlocked: boolean
}

const INITIAL_PROGRESS: FlowProgress = {
  furthestStep: "upload",
  draft: null,
  isRoomSkipped: false,
  image: null,
  roomBounds: null,
  preferencesSpace: null,
  space: null,
  preferences: null,
  recommendation: null,
  preview: null,
  isUnlocked: false,
}

function getPreviewProducts(recommendation: RecommendationResponse, isUnlocked: boolean): PreviewProduct[] {
  const visibleItems = isUnlocked ? recommendation.items : recommendation.items.slice(0, FREE_CATEGORY_COUNT)
  return visibleItems
    .slice(0, MAX_VISUALIZED_PRODUCTS)
    .map(({ category, primary }) => ({ articleNo: primary.articleNo, label: CATEGORY_META[category].label }))
}

function getPhotoSpace(draft: SpaceDraft, isSample: boolean): SpaceInput | null {
  if (draft.kind !== "photo") return null
  const dimensions = draft.dimensions ?? (isSample ? SAMPLE_PHOTO_SPACE.dimensions : null)
  if (!dimensions) return null
  const { widthCm, lengthCm, ceilingHeightCm } = dimensions
  return {
    roomType: draft.roomType ?? (isSample ? SAMPLE_PHOTO_SPACE.roomType : null),
    dimensions: { widthCm, lengthCm, ceilingHeightCm },
    dimensionsBasis: "estimated",
    openings: draft.openings.length === 0 && isSample ? SAMPLE_PHOTO_SPACE.openings : draft.openings,
    styleHints: draft.styleHints,
  }
}

function getSkippedSteps({ isRoomSkipped, image }: FlowProgress): FlowStep[] {
  const skipped: FlowStep[] = []
  if (isRoomSkipped) skipped.push("room")
  if (image?.kind !== "photo") skipped.push("preview")
  return skipped
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
    const image: SpaceImage = { kind: draft.kind, file, url: URL.createObjectURL(file), width, height }
    const isSample = flow.step === "analyzing" && flow.upload.file === null
    const photoSpace = getPhotoSpace(draft, isSample)

    if (photoSpace) {
      setProgress((current) => ({
        ...current,
        draft,
        isRoomSkipped: true,
        image,
        preferencesSpace: photoSpace,
        furthestStep: "preferences",
      }))
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
      preview: null,
      furthestStep: "preferences",
    }))
    setFlow({ step: "preferences", space, variant: progress.draft?.kind ?? "plan" })
  }

  function handleRecommended(space: ConfirmedSpace, preferences: Preferences, recommendation: RecommendationResponse) {
    setProgress((current) => ({ ...current, space, preferences, recommendation, preview: null, furthestStep: "results" }))
    setFlow({ step: "results", space, recommendation })
  }

  function handleUnlock() {
    setProgress((current) => ({ ...current, isUnlocked: true, preview: null }))
  }

  function openPreview(space: ConfirmedSpace, recommendation: RecommendationResponse) {
    setProgress((current) => ({ ...current, furthestStep: "preview" }))
    setFlow({ step: "preview", space, recommendation })
  }

  function handlePreview(preview: RoomPreview) {
    setProgress((current) => ({ ...current, preview }))
  }

  function handleStepSelect(step: FlowStep) {
    const { draft, preferencesSpace, space, recommendation } = progress
    const canPreview = progress.image?.kind === "photo"
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
      case "preview":
        if (space && recommendation && canPreview) openPreview(space, recommendation)
        break
      case "analyzing":
        break
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
            canPreview={progress.image?.kind === "photo"}
            onOpenPreview={() => openPreview(flow.space, flow.recommendation)}
          />
        )
      case "preview":
        return progress.image ? (
          <RoomPreviewStep
            photo={progress.image.file}
            products={getPreviewProducts(flow.recommendation, progress.isUnlocked)}
            initialPreview={progress.preview}
            onPreview={handlePreview}
          />
        ) : null
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-5">
      <FlowSteps
        currentStep={flow.step}
        furthestStep={progress.furthestStep}
        skippedSteps={getSkippedSteps(progress)}
        onStepSelect={handleStepSelect}
      />
      <div className="flex flex-1 flex-col *:flex-1">{renderStep()}</div>
    </div>
  )
}
