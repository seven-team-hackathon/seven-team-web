"use client"

import { CheckIcon, LoaderCircleIcon, RotateCcwIcon, ScanLineIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getThrownErrorMessage, getUserErrorMessage } from "@/lib/api/user-error-message"
import { spaceDraftSchema, type SpaceDraft, type SpaceKind } from "@/lib/contracts/space"
import { getImageSize, type ImageSize } from "@/lib/images/image-size"
import { resizeImage } from "@/lib/images/resize-image"
import { createSamplePhotoFile } from "@/lib/planner/sample-photo"
import { createSamplePlanFile } from "@/lib/planner/sample-plan"
import { validateSpaceFileSize } from "@/lib/planner/space-file"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export type SpaceUpload = {
  readonly kind: SpaceKind
  readonly file: File | null
}

const ANALYZING_STAGES = ["Reading the image", "Finding walls and dimensions", "Detecting doors and windows"]
const ANALYZE_ERROR_MESSAGE = "We could not read this image. Please try again."
const STAGE_INTERVAL_MS = 700
const CARD_SPACING_CLASS_NAME = "[--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(10)]"

type StageStatus = "done" | "active" | "pending"

const STAGE_CLASS_NAMES: Readonly<Record<StageStatus, string>> = {
  done: "opacity-100",
  active: "opacity-100",
  pending: "opacity-35",
}

function getStageStatus(index: number, activeIndex: number): StageStatus {
  if (index < activeIndex) return "done"
  if (index === activeIndex) return "active"
  return "pending"
}

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "done":
      return <CheckIcon aria-hidden className="size-4 text-primary" />
    case "active":
      return <LoaderCircleIcon aria-hidden className="size-4 animate-spin text-terracotta motion-reduce:animate-none" />
    case "pending":
      return <span aria-hidden className="size-2 rounded-full bg-muted-foreground" />
  }
}

export type AnalyzedImage = ImageSize & {
  readonly file: File
}

type AnalyzedSpace = {
  readonly draft: SpaceDraft
  readonly image: AnalyzedImage
}

function createSampleFile(kind: SpaceKind): Promise<File> {
  return kind === "photo" ? createSamplePhotoFile() : createSamplePlanFile()
}

async function analyzeSpace(upload: SpaceUpload): Promise<AnalyzedSpace> {
  const originalFile = upload.file ?? (await createSampleFile(upload.kind))
  const file = await resizeImage(originalFile)
  const sizeError = validateSpaceFileSize(file)
  if (sizeError) throw new Error(sizeError)

  const form = new FormData()
  form.set("kind", upload.kind)
  form.set("file", file)

  const response = await fetch("/api/space", { method: "POST", body: form })
  const body: unknown = await response.json()
  if (!response.ok) throw new Error(getUserErrorMessage(body, ANALYZE_ERROR_MESSAGE))
  const draft = spaceDraftSchema.parse(body)
  return { draft, image: { file, ...(await getImageSize(file)) } }
}

type AnalyzingStepProps = {
  upload: SpaceUpload
  onAnalyzed: (draft: SpaceDraft, image: AnalyzedImage) => void
}

export function AnalyzingStep({ upload, onAnalyzed }: AnalyzingStepProps) {
  const [attempt, setAttempt] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    analyzeSpace(upload)
      .then(({ draft, image }) => {
        if (!isCancelled) onAnalyzed(draft, image)
      })
      .catch((error: unknown) => {
        if (!isCancelled) setErrorMessage(getThrownErrorMessage(error, ANALYZE_ERROR_MESSAGE))
      })
    return () => {
      isCancelled = true
    }
  }, [upload, onAnalyzed, attempt])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((index) => Math.min(index + 1, ANALYZING_STAGES.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [attempt])

  function handleRetry() {
    setErrorMessage(null)
    setActiveIndex(0)
    setAttempt((count) => count + 1)
  }

  if (errorMessage) {
    return (
      <Card className={CARD_SPACING_CLASS_NAME}>
        <CardContent role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <TriangleAlertIcon aria-hidden className="size-10 text-destructive" />
          <h2 className="text-xl font-bold">{errorMessage}</h2>
          <Button size="lg" onClick={handleRetry}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={CARD_SPACING_CLASS_NAME}>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-8 py-8 text-center sm:py-14">
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-16 place-items-center rounded-2xl bg-terracotta/15">
            <ScanLineIcon aria-hidden className="size-8 text-terracotta" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Analyzing your room</h2>
        </div>
        <ol role="status" aria-live="polite" className="flex w-fit flex-col gap-3 text-left">
          {ANALYZING_STAGES.map((stage, index) => {
            const status = getStageStatus(index, activeIndex)
            return (
              <li
                key={stage}
                aria-current={status === "active" && "step"}
                className={cn(
                  "flex items-center gap-3 font-semibold transition-opacity duration-500 motion-reduce:transition-none",
                  STAGE_CLASS_NAMES[status],
                )}
              >
                <span className="grid size-5 shrink-0 place-items-center">
                  <StageIcon status={status} />
                </span>
                {stage}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
