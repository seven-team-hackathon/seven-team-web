import { z } from "zod"

export const DEFAULT_IMAGE_MODEL = "google/gemini-nano-banana-2.1"

export const IMAGES_ENDPOINT = "https://openrouter.ai/api/v1/images"

const GENERATION_TIMEOUT_MS = 110_000

const PRODUCT_IMAGE_TIMEOUT_MS = 10_000

const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024

const ALLOWED_IMAGE_HOST = "https://www.ikea.com/"

const responseSchema = z.object({
  data: z
    .array(z.object({ b64_json: z.string().min(1), media_type: z.string().optional() }))
    .min(1),
  usage: z.object({ cost: z.number().optional() }).optional(),
})

export type GeneratedImage = {
  readonly mediaType: "image/png" | "image/jpeg" | "image/webp"
  readonly imageBase64: string
  readonly model: string
  readonly costUsd?: number
}

export type GenerateOutcome =
  | { readonly kind: "ok"; readonly image: GeneratedImage }
  | {
      readonly kind: "failed"
      readonly reason: "timeout" | "upstream"
      readonly message: string
    }

export type GenerateInput = {
  readonly prompt: string
  readonly roomImageDataUrl: string
  readonly productImageUrls?: readonly string[]
}

export type ImageGenerator = (input: GenerateInput) => Promise<GenerateOutcome>

export function getImageModel(): string {
  const configured = process.env.OPENROUTER_IMAGE_MODEL?.trim()

  return configured ? configured : DEFAULT_IMAGE_MODEL
}

export function toMediaType(
  value: string | undefined
): GeneratedImage["mediaType"] {
  if (value === "image/jpeg" || value === "image/webp") {
    return value
  }

  return "image/png"
}

export async function loadProductImage(url: string): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_HOST)) {
    return url
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PRODUCT_IMAGE_TIMEOUT_MS),
    })
    const contentType = response.headers.get("content-type") ?? ""

    if (!response.ok || !contentType.startsWith("image/")) {
      return url
    }

    const bytes = Buffer.from(await response.arrayBuffer())

    if (bytes.length === 0 || bytes.length > MAX_PRODUCT_IMAGE_BYTES) {
      return url
    }

    return `data:${contentType};base64,${bytes.toString("base64")}`
  } catch {
    return url
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "TimeoutError"
  )
}

export const generateWithOpenRouter: ImageGenerator = async (input) => {
  const model = getImageModel()
  const references = [input.roomImageDataUrl]

  if (input.productImageUrls) {
    references.push(
      ...(await Promise.all(input.productImageUrls.map(loadProductImage)))
    )
  }

  try {
    const response = await fetch(IMAGES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        input_references: references.map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
      }),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(
        `Image generation failed: HTTP ${response.status}`,
        (await response.text()).slice(0, 200)
      )

      return {
        kind: "failed",
        reason: "upstream",
        message: "The image generation failed.",
      }
    }

    const parsed = responseSchema.safeParse(await response.json())

    if (!parsed.success) {
      return {
        kind: "failed",
        reason: "upstream",
        message: "The image generation returned an unexpected response.",
      }
    }

    const [image] = parsed.data.data

    return {
      kind: "ok",
      image: {
        mediaType: toMediaType(image?.media_type),
        imageBase64: image?.b64_json ?? "",
        model,
        ...(parsed.data.usage?.cost !== undefined
          ? { costUsd: parsed.data.usage.cost }
          : {}),
      },
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        kind: "failed",
        reason: "timeout",
        message: "The image generation took too long.",
      }
    }

    console.error(
      "Image generation failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return {
      kind: "failed",
      reason: "upstream",
      message: "The image generation failed.",
    }
  }
}
