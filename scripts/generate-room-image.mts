import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"

const PRODUCTS_FILE = path.resolve(
  import.meta.dirname,
  "../lib/catalog/products.json"
)

const DEFAULT_OUT_DIR = path.resolve(import.meta.dirname, "../experiments/out")

const IMAGES_URL = "https://openrouter.ai/api/v1/images"

export const DEFAULT_MODEL = "google/gemini-nano-banana-2.1"

const REQUEST_TIMEOUT_MS = 180_000

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

const productSchema = z.object({
  articleNo: z.string(),
  name: z.string(),
  typeName: z.string(),
  widthCm: z.number(),
  depthCm: z.number(),
  heightCm: z.number(),
  colors: z.array(z.string()),
  material: z.string().optional(),
  styleTags: z.array(z.string()),
  imageUrl: z.string().optional(),
})

const responseSchema = z.object({
  data: z.array(
    z.object({ b64_json: z.string(), media_type: z.string().optional() })
  ),
  usage: z.object({ cost: z.number().optional() }).optional(),
})

export type ProductInfo = z.infer<typeof productSchema>

export function parseFlags(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg?.startsWith("--") && next !== undefined && !next.startsWith("--")) {
      flags.set(arg.slice(2), next)
      index += 1
    }
  }

  return flags
}

export function describeProduct(product: ProductInfo): string {
  const parts = [`a ${product.name.replace(/\s+/g, " ").trim()}`]

  if (product.colors.length > 0) {
    parts.push(`in ${product.colors.join(" and ")}`)
  }

  if (product.material) {
    parts.push(`made of ${product.material}`)
  }

  parts.push(
    `real size: ${Math.round(product.widthCm)} cm wide, ${Math.round(product.depthCm)} cm deep, ${Math.round(product.heightCm)} cm high`
  )

  return parts.join(", ")
}

export function buildPrompt(input: {
  readonly subject: string
  readonly placement: string
  readonly hasProductImage?: boolean
}): string {
  const intro = input.hasProductImage
    ? `The first image is a photo of a room and the second image is a product photo of a piece of furniture. Edit the room photo: add exactly this furniture from the second image (${input.subject}) ${input.placement}. Keep the furniture's shape, color, fabric and details exactly as in the product photo.`
    : `Edit this photo of a room: add ${input.subject} ${input.placement}.`

  return [
    intro,
    "Keep the room exactly as it is: same walls, floor, windows, lighting, camera angle and every other object. Change only by adding the furniture.",
    "The furniture must have a realistic size for its stated real dimensions compared with doors, windows, outlets and other objects in the photo. Do not make it larger or smaller than its real size.",
    "Photorealistic, natural lighting that matches the room, correct perspective and a soft contact shadow on the floor.",
  ].join(" ")
}

export function mediaTypeOf(filePath: string): string | null {
  return MEDIA_TYPES[path.extname(filePath).toLowerCase()] ?? null
}

export function extensionOf(mediaType: string | undefined): string {
  switch (mediaType) {
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    default:
      return "png"
  }
}

async function findProduct(articleNo: string): Promise<ProductInfo | null> {
  const raw: unknown = JSON.parse(await readFile(PRODUCTS_FILE, "utf8"))
  const products = z.array(productSchema).parse(raw)

  return products.find((product) => product.articleNo === articleNo) ?? null
}

async function generate(
  model: string,
  prompt: string,
  references: readonly string[],
  outDir: string,
  label: string
): Promise<void> {
  const started = Date.now()
  const response = await fetch(IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      input_references: references.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  if (!response.ok) {
    const text = (await response.text()).slice(0, 300)

    console.error(`${model}: HTTP ${response.status} after ${seconds}s: ${text}`)
    return
  }

  const parsed = responseSchema.safeParse(await response.json())
  const image = parsed.success ? parsed.data.data[0] : undefined

  if (!parsed.success || !image) {
    console.error(`${model}: unexpected response shape`)
    return
  }

  const fileName = `${label}-${model.replace(/[^a-z0-9]+/gi, "_")}.${extensionOf(image.media_type)}`
  const filePath = path.join(outDir, fileName)

  await writeFile(filePath, Buffer.from(image.b64_json, "base64"))
  console.log(
    `${model}: saved ${filePath} in ${seconds}s, cost ${parsed.data.usage?.cost ?? "unknown"} USD`
  )
}

export async function main(argv: readonly string[]): Promise<void> {
  const flags = parseFlags(argv)
  const roomPath = flags.get("room")
  const articleNo = flags.get("article")
  const text = flags.get("text")
  const placement = flags.get("placement") ?? "against the main free wall"
  const models = (flags.get("model") ?? DEFAULT_MODEL).split(",").map((m) => m.trim())
  const outDir = flags.get("out") ?? DEFAULT_OUT_DIR

  if (!roomPath || (!articleNo && !text)) {
    console.error(
      'Usage: node --env-file=.env.local scripts/generate-room-image.mts --room photo.jpg (--article 00395252 | --text "a gray 3-seat sofa") [--placement "next to the window"] [--model id1,id2] [--out dir]'
    )
    process.exitCode = 1
    return
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set (add it to .env.local).")
    process.exitCode = 1
    return
  }

  const mediaType = mediaTypeOf(roomPath)

  if (!mediaType || !existsSync(roomPath)) {
    console.error("The room photo must exist and be a jpg, png or webp file.")
    process.exitCode = 1
    return
  }

  const product = articleNo ? await findProduct(articleNo) : null

  if (articleNo && !product) {
    console.error(`Article ${articleNo} was not found in the catalog.`)
    process.exitCode = 1
    return
  }

  const subject = product ? describeProduct(product) : (text ?? "")
  const productImage = flags.get("no-product-image") === undefined ? product?.imageUrl : undefined
  const prompt = buildPrompt({
    subject,
    placement,
    hasProductImage: productImage !== undefined,
  })
  const roomDataUrl = `data:${mediaType};base64,${(await readFile(roomPath)).toString("base64")}`

  await mkdir(outDir, { recursive: true })
  console.log(`Prompt: ${prompt}\n`)

  for (const model of models) {
    await generate(
      model,
      prompt,
      productImage ? [roomDataUrl, productImage] : [roomDataUrl],
      outDir,
      `${articleNo ?? "custom"}${productImage ? "-ref" : ""}`
    )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2))
}
