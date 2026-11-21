import { loadCatalog } from "@/lib/catalog/load-catalog"
import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { ApiErrorCode } from "@/lib/contracts/api-error"
import type { VisualizeResponse } from "@/lib/contracts/visualization"
import { buildVisualizationPrompt, describeProduct } from "@/lib/visualize/build-prompt"
import { generateWithOpenRouter } from "@/lib/visualize/generate-image"
import type { ImageGenerator } from "@/lib/visualize/generate-image"

export type VisualizeInput = {
  readonly file: File
  readonly articleNos: readonly string[]
}

export type VisualizeResult =
  | { readonly ok: true; readonly response: VisualizeResponse }
  | {
      readonly ok: false
      readonly code: ApiErrorCode
      readonly message: string
    }

export type VisualizeDependencies = {
  readonly catalog?: readonly CatalogItem[]
  readonly generate?: ImageGenerator
}

export async function visualizeProduct(
  input: VisualizeInput,
  dependencies: VisualizeDependencies = {}
): Promise<VisualizeResult> {
  const catalog = dependencies.catalog ?? loadCatalog("us")
  const generate = dependencies.generate ?? generateWithOpenRouter
  const products = input.articleNos.map((articleNo) =>
    catalog.find((item) => item.articleNo === articleNo)
  )
  const found = products.filter((product) => product !== undefined)

  if (found.length === 0 || found.length !== products.length) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Unknown product.",
    }
  }

  const prompt = buildVisualizationPrompt({
    subjects: found.map((product) => ({
      description: describeProduct(product),
      hasImage: product.imageUrl !== undefined,
    })),
  })
  const productImageUrls = found.flatMap((product) =>
    product.imageUrl ? [product.imageUrl] : []
  )
  const roomBase64 = Buffer.from(await input.file.arrayBuffer()).toString("base64")
  const outcome = await generate({
    prompt,
    roomImageDataUrl: `data:${input.file.type};base64,${roomBase64}`,
    productImageUrls,
  })

  if (outcome.kind === "failed") {
    return {
      ok: false,
      code: outcome.reason === "timeout" ? "timeout" : "model_failed",
      message: outcome.message,
    }
  }

  return { ok: true, response: outcome.image }
}
