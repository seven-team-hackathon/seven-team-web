"use client"

import { LoaderCircleIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react"
import Image from "next/image"
import { useId, useState } from "react"
import { getThrownErrorMessage, getUserErrorMessage } from "@/lib/api/user-error-message"
import { visualizeResponseSchema, type VisualizeResponse, type WallPosition } from "@/lib/contracts/visualization"
import { CATEGORY_META } from "@/lib/planner/options"
import { getWallPosition } from "@/lib/planner/wall-position"
import type { WallItem, WallSize } from "@/lib/planner/wall-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const VISUALIZE_ERROR_MESSAGE = "We could not generate the photo right now. Please try again."

type VisualizationState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly src: string; readonly label: string }
  | { readonly status: "error"; readonly message: string }

async function requestVisualization(photo: File, articleNo: string, position: WallPosition): Promise<VisualizeResponse> {
  const form = new FormData()
  form.set("file", photo)
  form.set("articleNo", articleNo)
  form.set("position", position)

  const response = await fetch("/api/visualize", { method: "POST", body: form })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(getUserErrorMessage(body, VISUALIZE_ERROR_MESSAGE))

  const parsed = visualizeResponseSchema.safeParse(body)
  if (!parsed.success) throw new Error(VISUALIZE_ERROR_MESSAGE)
  return parsed.data
}

type RoomVisualizationProps = {
  photo: File
  item: WallItem | null
  wall: WallSize
}

export function RoomVisualization({ photo, item, wall }: RoomVisualizationProps) {
  const headingId = useId()
  const [state, setState] = useState<VisualizationState>({ status: "idle" })
  const isLoading = state.status === "loading"
  const itemLabel = item ? CATEGORY_META[item.category].label : null

  async function handleGenerate() {
    if (!item || !itemLabel) return
    setState({ status: "loading" })
    try {
      const result = await requestVisualization(photo, item.id, getWallPosition(item, wall))
      setState({ status: "done", src: `data:${result.mediaType};base64,${result.imageBase64}`, label: itemLabel })
    } catch (error) {
      setState({ status: "error", message: getThrownErrorMessage(error, VISUALIZE_ERROR_MESSAGE) })
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="text-lg font-bold tracking-tight">
            See it as a photo
          </h3>
          <p className="text-sm text-muted-foreground">
            {item
              ? `We will add your ${itemLabel?.toLowerCase()} to your photo where you placed it on the wall.`
              : "Select a piece of furniture on the wall, then generate a photo of your room with it."}
          </p>
        </div>
        <Button size="lg" disabled={!item || isLoading} onClick={handleGenerate}>
          {isLoading ? (
            <LoaderCircleIcon data-icon="inline-start" aria-hidden className="animate-spin" />
          ) : (
            <SparklesIcon data-icon="inline-start" aria-hidden />
          )}
          {state.status === "done" ? "Generate again" : "Generate photo"}
        </Button>
      </div>

      <div aria-live="polite">
        {isLoading && (
          <div role="status" className="flex flex-col gap-3">
            <Skeleton className="aspect-4/3 w-full rounded-xl" />
            <p className="text-sm text-muted-foreground">Generating your photo. This usually takes under a minute.</p>
          </div>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive"
          >
            <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
            {state.message}
          </p>
        )}

        {state.status === "done" && (
          <figure className="flex flex-col gap-2">
            <Image
              src={state.src}
              alt={`AI-generated photo of your room with a ${state.label.toLowerCase()}`}
              width={0}
              height={0}
              sizes="100vw"
              unoptimized
              className="h-auto w-full rounded-xl border"
            />
            <figcaption className="text-xs text-muted-foreground">
              AI illustration of your {state.label.toLowerCase()}. Colors, details and size may differ from the real
              product, so check the dimensions before buying.
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  )
}
