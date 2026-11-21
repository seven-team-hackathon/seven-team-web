"use client"

import { LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { getThrownErrorMessage, getUserErrorMessage } from "@/lib/api/user-error-message"
import { visualizeResponseSchema, type VisualizeResponse } from "@/lib/contracts/visualization"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const VISUALIZE_ERROR_MESSAGE = "We could not generate the photo right now. Please try again."

export type PreviewProduct = {
  readonly articleNo: string
  readonly label: string
}

export type RoomPreview = {
  readonly src: string
  readonly labels: readonly string[]
}

type PreviewState =
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly preview: RoomPreview }
  | { readonly status: "error"; readonly message: string }

async function requestVisualization(photo: File, products: readonly PreviewProduct[]): Promise<VisualizeResponse> {
  const form = new FormData()
  form.set("file", photo)
  for (const { articleNo } of products) form.append("articleNo", articleNo)

  const response = await fetch("/api/visualize", { method: "POST", body: form })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(getUserErrorMessage(body, VISUALIZE_ERROR_MESSAGE))

  const parsed = visualizeResponseSchema.safeParse(body)
  if (!parsed.success) throw new Error(VISUALIZE_ERROR_MESSAGE)
  return parsed.data
}

function describeProducts(labels: readonly string[]): string {
  return labels.map((label) => label.toLowerCase()).join(", ")
}

type RoomPreviewStepProps = {
  photo: File
  products: readonly PreviewProduct[]
  initialPreview: RoomPreview | null
  onPreview: (preview: RoomPreview) => void
}

export function RoomPreviewStep({ photo, products, initialPreview, onPreview }: RoomPreviewStepProps) {
  const [state, setState] = useState<PreviewState>(
    initialPreview ? { status: "done", preview: initialPreview } : { status: "loading" },
  )
  const hasStartedRef = useRef(initialPreview !== null)

  async function generate() {
    setState({ status: "loading" })
    try {
      const result = await requestVisualization(photo, products)
      const preview: RoomPreview = {
        src: `data:${result.mediaType};base64,${result.imageBase64}`,
        labels: products.map(({ label }) => label),
      }
      setState({ status: "done", preview })
      onPreview(preview)
    } catch (error) {
      setState({ status: "error", message: getThrownErrorMessage(error, VISUALIZE_ERROR_MESSAGE) })
    }
  }

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generate once when the step opens
  }, [])

  const isLoading = state.status === "loading"

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">See it in your room</CardTitle>
        <CardDescription className="text-base">
          {`Your photo with ${describeProducts(products.map(({ label }) => label))} added.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div aria-live="polite">
          {isLoading && (
            <div role="status" className="flex flex-col gap-3">
              <Skeleton className="aspect-4/3 w-full rounded-xl" />
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
                Generating your photo. This usually takes under a minute.
              </p>
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
                src={state.preview.src}
                alt={`AI-generated photo of your room with ${describeProducts(state.preview.labels)}`}
                width={0}
                height={0}
                sizes="100vw"
                unoptimized
                className="h-auto w-full rounded-xl border"
              />
              <figcaption className="text-xs text-muted-foreground">
                AI illustration. Colors, details and size may differ from the real products, so check the dimensions
                before buying.
              </figcaption>
            </figure>
          )}
        </div>

        {!isLoading && (
          <Button variant="outline" size="lg" onClick={generate} className="w-full sm:w-auto sm:self-center">
            <RefreshCwIcon data-icon="inline-start" aria-hidden />
            {state.status === "error" ? "Try again" : "Generate again"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
