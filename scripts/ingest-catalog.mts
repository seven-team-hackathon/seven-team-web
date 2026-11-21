import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"

const SOURCE_DIR = path.resolve(import.meta.dirname, "../catalog-sources/us")
const ITEMS_DIR = path.join(SOURCE_DIR, "items")
const NORMALIZED_FILE = path.join(SOURCE_DIR, "normalized.json")
const CLASSIFIED_FILE = path.join(SOURCE_DIR, "classified.json")

const measurementSchema = z.object({
  label: z.string(),
  rawText: z.string(),
  valueCm: z.number().nullable(),
})

export const rawItemSchema = z.object({
  articleNo: z.string(),
  url: z.string(),
  family: z.string(),
  categoryGuess: z.string(),
  name: z.string(),
  description: z.string(),
  priceUsd: z.number(),
  currency: z.string(),
  measurements: z.array(measurementSchema),
  fetchedAt: z.string(),
})

export type Measurement = z.infer<typeof measurementSchema>

export type RawItem = z.infer<typeof rawItemSchema>

export type ExclusionReason = "outdoor" | "part-or-accessory" | "lighting" | "set"

export type DimensionName = "width" | "depth" | "height"

export type ResolvedDimensions = {
  readonly widthCm: number | null
  readonly depthCm: number | null
  readonly heightCm: number | null
  readonly rules: readonly string[]
}

export type NormalizedItem = {
  readonly articleNo: string
  readonly url: string
  readonly family: string
  readonly categoryGuess: string
  readonly name: string
  readonly description: string
  readonly priceUsd: number
  readonly currency: string
  readonly fetchedAt: string
  readonly measurements: readonly Measurement[]
  readonly widthCm: number | null
  readonly depthCm: number | null
  readonly heightCm: number | null
  readonly dimensionRules: readonly string[]
  readonly dimensionsComplete: boolean
  readonly exclusion: ExclusionReason | null
}

type LabelMatch = {
  readonly value: number
  readonly label: string
}

const OUTDOOR_PATTERN = /\boutdoors?\b/i

const PART_PATTERN =
  /\b(backrests?|armrests?|slipcovers?|table ?tops?|add-on|sections?)\b|\bcovers?\b|\b(legs|cushions?|inserts?)\s+for\b|\bframe only\b/i

const LIGHTING_LABEL_PATTERN = /^(luminous flux|power|cord length)$/i

const CHAIR_LABEL_PATTERN = /^chair /i

const TABLE_LABEL_PATTERN = /^table /i

const WIDTH_LABELS = ["width", "max. width", "frame width"] as const

const DEPTH_LABELS = ["depth", "max. depth", "frame, depth"] as const

const LENGTH_LABELS = ["length", "min. length", "max. length"] as const

const HEIGHT_LABELS = [
  "height",
  "total height",
  "max. height",
  "height including back cushions",
  "headboard height",
  "frame height",
] as const

function buildLookup(measurements: readonly Measurement[]): Map<string, number> {
  const lookup = new Map<string, number>()

  for (const measurement of measurements) {
    const key = measurement.label.trim().toLowerCase()

    if (measurement.valueCm !== null && !lookup.has(key)) {
      lookup.set(key, measurement.valueCm)
    }
  }

  return lookup
}

function pickFirst(
  lookup: ReadonlyMap<string, number>,
  labels: readonly string[]
): LabelMatch | null {
  for (const label of labels) {
    const value = lookup.get(label)

    if (value !== undefined) {
      return { value, label }
    }
  }

  return null
}

function describeRule(dimension: DimensionName, match: LabelMatch): string | null {
  return match.label === dimension ? null : `${dimension}<-${match.label}`
}

function collectRules(
  entries: ReadonlyArray<readonly [DimensionName, LabelMatch | null]>
): string[] {
  const rules: string[] = []

  for (const [dimension, match] of entries) {
    const rule = match ? describeRule(dimension, match) : null

    if (rule) {
      rules.push(rule)
    }
  }

  return rules
}

function resolveBedDimensions(
  lookup: ReadonlyMap<string, number>
): ResolvedDimensions {
  const width = pickFirst(lookup, ["width", "min. bed width"])
  const depth = pickFirst(lookup, ["length", "min. length"])
  const height = pickFirst(lookup, ["height", "headboard height"])

  return {
    widthCm: width?.value ?? null,
    depthCm: depth?.value ?? null,
    heightCm: height?.value ?? null,
    rules: collectRules([
      ["width", width],
      ["depth", depth],
      ["height", height],
    ]),
  }
}

function resolveHorizontalDimensions(lookup: ReadonlyMap<string, number>): {
  readonly width: LabelMatch | null
  readonly depth: LabelMatch | null
} {
  const explicitDepth = pickFirst(lookup, DEPTH_LABELS)

  if (explicitDepth) {
    return { width: pickFirst(lookup, WIDTH_LABELS), depth: explicitDepth }
  }

  const length = pickFirst(lookup, LENGTH_LABELS)
  const width = pickFirst(lookup, WIDTH_LABELS)

  if (length && width) {
    return { width: length, depth: width }
  }

  const diameter = pickFirst(lookup, ["diameter"])

  if (diameter) {
    return { width: diameter, depth: diameter }
  }

  return { width: length ?? width, depth: null }
}

export function resolveDimensions(
  category: string,
  measurements: readonly Measurement[]
): ResolvedDimensions {
  const lookup = buildLookup(measurements)

  if (category === "bed") {
    return resolveBedDimensions(lookup)
  }

  const { width, depth } = resolveHorizontalDimensions(lookup)
  const height = pickFirst(lookup, HEIGHT_LABELS)

  return {
    widthCm: width?.value ?? null,
    depthCm: depth?.value ?? null,
    heightCm: height?.value ?? null,
    rules: collectRules([
      ["width", width],
      ["depth", depth],
      ["height", height],
    ]),
  }
}

export function detectExclusion(
  name: string,
  measurements: readonly Measurement[]
): ExclusionReason | null {
  const labels = measurements.map((measurement) => measurement.label.trim())

  if (OUTDOOR_PATTERN.test(name)) {
    return "outdoor"
  }

  if (labels.some((label) => LIGHTING_LABEL_PATTERN.test(label))) {
    return "lighting"
  }

  const hasChairLabel = labels.some((label) => CHAIR_LABEL_PATTERN.test(label))
  const hasTableLabel = labels.some((label) => TABLE_LABEL_PATTERN.test(label))

  if (hasChairLabel && hasTableLabel) {
    return "set"
  }

  if (PART_PATTERN.test(name)) {
    return "part-or-accessory"
  }

  return null
}

export function normalizeItem(item: RawItem): NormalizedItem {
  const dimensions = resolveDimensions(item.categoryGuess, item.measurements)

  return {
    articleNo: item.articleNo,
    url: item.url,
    family: item.family,
    categoryGuess: item.categoryGuess,
    name: item.name,
    description: item.description,
    priceUsd: item.priceUsd,
    currency: item.currency,
    fetchedAt: item.fetchedAt,
    measurements: item.measurements,
    widthCm: dimensions.widthCm,
    depthCm: dimensions.depthCm,
    heightCm: dimensions.heightCm,
    dimensionRules: dimensions.rules,
    dimensionsComplete:
      dimensions.widthCm !== null &&
      dimensions.depthCm !== null &&
      dimensions.heightCm !== null,
    exclusion: detectExclusion(item.name, item.measurements),
  }
}

function percent(part: number, total: number): string {
  return total === 0 ? "0%" : `${((100 * part) / total).toFixed(1)}%`
}

export function summarizeNormalization(
  items: readonly NormalizedItem[]
): string {
  const excluded = items.filter((item) => item.exclusion !== null)
  const kept = items.filter((item) => item.exclusion === null)
  const complete = kept.filter((item) => item.dimensionsComplete)
  const lines = [
    `total: ${items.length}`,
    `excluded: ${excluded.length}`,
    `kept: ${kept.length}`,
    `kept with width, depth and height: ${complete.length} (${percent(complete.length, kept.length)})`,
  ]

  const exclusionCounts = new Map<string, number>()

  for (const item of excluded) {
    const reason = item.exclusion ?? "unknown"
    exclusionCounts.set(reason, (exclusionCounts.get(reason) ?? 0) + 1)
  }

  for (const [reason, count] of exclusionCounts) {
    lines.push(`  excluded as ${reason}: ${count}`)
  }

  const categories = new Map<string, { kept: number; complete: number }>()

  for (const item of kept) {
    const entry = categories.get(item.categoryGuess) ?? { kept: 0, complete: 0 }
    entry.kept += 1
    entry.complete += item.dimensionsComplete ? 1 : 0
    categories.set(item.categoryGuess, entry)
  }

  lines.push("complete dimensions by category:")

  for (const [category, entry] of [...categories].sort()) {
    lines.push(`  ${category}: ${entry.complete}/${entry.kept}`)
  }

  return lines.join("\n")
}

export async function readRawItems(): Promise<{
  readonly items: readonly RawItem[]
  readonly invalidFiles: readonly string[]
}> {
  const files = (await readdir(ITEMS_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort()
  const items: RawItem[] = []
  const invalidFiles: string[] = []

  for (const file of files) {
    const parsed = rawItemSchema.safeParse(
      JSON.parse(await readFile(path.join(ITEMS_DIR, file), "utf8"))
    )

    if (parsed.success) {
      items.push(parsed.data)
    } else {
      invalidFiles.push(file)
    }
  }

  return { items, invalidFiles }
}

async function runNormalize(): Promise<void> {
  const { items, invalidFiles } = await readRawItems()
  const normalized = items.map(normalizeItem)

  await mkdir(SOURCE_DIR, { recursive: true })
  await writeFile(NORMALIZED_FILE, `${JSON.stringify(normalized, null, 2)}\n`)

  console.log(summarizeNormalization(normalized))

  if (invalidFiles.length > 0) {
    console.log(`invalid raw files skipped: ${invalidFiles.join(", ")}`)
  }
}

export const FURNITURE_CATEGORIES = [
  "sofa",
  "armchair",
  "coffee-table",
  "side-table",
  "tv-unit",
  "bed",
  "wardrobe",
  "nightstand",
  "desk",
  "office-chair",
  "bookshelf",
  "dining-table",
  "dining-chair",
  "storage",
] as const

export const ROOM_TYPES = [
  "living-room",
  "bedroom",
  "home-office",
  "dining-room",
  "kids-room",
  "hallway",
] as const

export const STYLE_TAGS = [
  "scandinavian",
  "modern",
  "minimal",
  "cozy",
  "industrial",
  "classic",
] as const

const CATEGORY_OPTIONS = [...FURNITURE_CATEGORIES, "none"] as const

export const DEFAULT_CLASSIFY_MODEL = "claude-haiku-5-5"

export const DEFAULT_BATCH_SIZE = 10

const LOW_CONFIDENCE_THRESHOLD = 0.6

const DIMENSION_MATCH_TOLERANCE_CM = 0.15

const MODEL_PRICES_USD_PER_MILLION: Readonly<
  Record<string, { readonly input: number; readonly output: number }>
> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
}

export const CLASSIFY_SYSTEM_PROMPT = [
  "You curate a furniture catalog for an interior planning app. You receive IKEA US products as JSON and return one result per product, echoing its articleNo.",
  "",
  "isStandaloneFurniture: true only for a complete piece of furniture a person places in a room (sofa, bed frame, desk, wardrobe, shelf unit, table, chair). False for parts, add-ons, covers, organizers, boxes, bags, shelves for cabinets, lighting, textiles, decor, tool or desk accessories, kits of parts, and outdoor items.",
  "category: the best fitting allowed category, or none when the product is not furniture or no category fits. coffee-table is a low table placed in front of a sofa, usually 35 to 55 cm high. side-table is a small table next to a sofa, armchair or bed, or a nesting or end table. A bedside table is a nightstand.",
  "typeName: a short English product type such as Bed frame, 3-seat sofa, Wardrobe combination.",
  "roomTypes: rooms where the product is typically used (at least one when it is furniture, otherwise an empty list).",
  "styleTags: one to three styles that fit. scandinavian: light wood, white or neutral, simple and functional. modern: clean lines, contemporary. minimal: very simple and uncluttered. cozy: soft, warm, upholstered, rounded. industrial: metal, raw or dark wood, utilitarian. classic: traditional shapes and details. Empty list when the product is not furniture.",
  "colors: simple lowercase color or finish names taken from the product name or description, for example white, black, gray, beige, oak, walnut, natural wood.",
  "material: the main material in a few words, or an empty string when unknown.",
  "",
  "Dimensions: resolvedDimensionsCm holds values already computed in centimeters (null when unknown). Only fill proposedWidthCm, proposedDepthCm, proposedHeightCm for dimensions that are null, and only by copying a value exactly as listed in measurementsCm. Width is the longer side along a wall, depth is the front-to-back size, height is the overall height. Use 0 when no listed measurement fits. Never estimate or invent a number.",
  "dimensionsLookWrong: true when the resolved dimensions contradict the product, for example a sofa only 20 cm wide.",
  "confidence: a number from 0 to 1 for how sure you are about the classification.",
].join("\n")

export const classificationSchema = z.object({
  articleNo: z.string(),
  isStandaloneFurniture: z.boolean(),
  category: z.enum(CATEGORY_OPTIONS),
  typeName: z.string(),
  roomTypes: z.array(z.enum(ROOM_TYPES)),
  styleTags: z.array(z.enum(STYLE_TAGS)),
  colors: z.array(z.string()),
  material: z.string(),
  proposedWidthCm: z.number(),
  proposedDepthCm: z.number(),
  proposedHeightCm: z.number(),
  dimensionsLookWrong: z.boolean(),
  confidence: z.number(),
})

export const classificationBatchSchema = z.object({
  items: z.array(classificationSchema),
})

const classifiedItemSchema = z.object({
  isStandaloneFurniture: z.boolean(),
  category: z.enum(CATEGORY_OPTIONS),
  typeName: z.string(),
  roomTypes: z.array(z.enum(ROOM_TYPES)),
  styleTags: z.array(z.enum(STYLE_TAGS)),
  colors: z.array(z.string()),
  material: z.string(),
  widthCm: z.number().nullable(),
  depthCm: z.number().nullable(),
  heightCm: z.number().nullable(),
  dimensionSource: z.enum(["rules", "model", "missing"]),
  confidence: z.number(),
  needsReview: z.boolean(),
  reviewReasons: z.array(z.string()),
})

const tokenUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  requests: z.number(),
})

const classifiedFileSchema = z.object({
  model: z.string(),
  items: z.record(z.string(), classifiedItemSchema),
  usage: tokenUsageSchema,
})

const normalizedItemSchema = z.object({
  articleNo: z.string(),
  url: z.string(),
  family: z.string(),
  categoryGuess: z.string(),
  name: z.string(),
  description: z.string(),
  priceUsd: z.number(),
  currency: z.string(),
  fetchedAt: z.string(),
  measurements: z.array(measurementSchema),
  widthCm: z.number().nullable(),
  depthCm: z.number().nullable(),
  heightCm: z.number().nullable(),
  dimensionRules: z.array(z.string()),
  dimensionsComplete: z.boolean(),
  exclusion: z
    .enum(["outdoor", "part-or-accessory", "lighting", "set"])
    .nullable(),
})

export type Classification = z.infer<typeof classificationSchema>

export type ClassifiedItem = z.infer<typeof classifiedItemSchema>

export type TokenUsage = z.infer<typeof tokenUsageSchema>

export type ClassifiedFile = z.infer<typeof classifiedFileSchema>

type ChosenDimension = {
  readonly value: number | null
  readonly fromModel: boolean
}

type BatchOutcome =
  | {
      readonly kind: "ok"
      readonly results: readonly Classification[]
      readonly usage: TokenUsage
    }
  | { readonly kind: "failed"; readonly message: string; readonly usage: TokenUsage }
  | { readonly kind: "fatal"; readonly message: string }

function matchesMeasurement(
  measurements: readonly Measurement[],
  value: number
): boolean {
  return measurements.some(
    (measurement) =>
      measurement.valueCm !== null &&
      Math.abs(measurement.valueCm - value) <= DIMENSION_MATCH_TOLERANCE_CM
  )
}

function chooseDimension(
  measurements: readonly Measurement[],
  ruleValue: number | null,
  proposed: number
): ChosenDimension {
  if (ruleValue !== null) {
    return { value: ruleValue, fromModel: false }
  }

  if (proposed > 0 && matchesMeasurement(measurements, proposed)) {
    return { value: proposed, fromModel: true }
  }

  return { value: null, fromModel: false }
}

function describeDimensionSource(
  dimensions: readonly ChosenDimension[]
): ClassifiedItem["dimensionSource"] {
  if (dimensions.some((dimension) => dimension.value === null)) {
    return "missing"
  }

  if (dimensions.some((dimension) => dimension.fromModel)) {
    return "model"
  }

  return "rules"
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function mergeClassification(
  item: NormalizedItem,
  result: Classification
): ClassifiedItem {
  const width = chooseDimension(
    item.measurements,
    item.widthCm,
    result.proposedWidthCm
  )
  const depth = chooseDimension(
    item.measurements,
    item.depthCm,
    result.proposedDepthCm
  )
  const height = chooseDimension(
    item.measurements,
    item.heightCm,
    result.proposedHeightCm
  )
  const dimensionSource = describeDimensionSource([width, depth, height])
  const confidence = clamp(result.confidence, 0, 1)
  const reviewReasons: string[] = []

  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    reviewReasons.push("low-confidence")
  }

  if (result.dimensionsLookWrong) {
    reviewReasons.push("dimensions-look-wrong")
  }

  if (dimensionSource === "missing") {
    reviewReasons.push("missing-dimensions")
  }

  if (dimensionSource === "model") {
    reviewReasons.push("dimensions-from-model")
  }

  return {
    isStandaloneFurniture: result.isStandaloneFurniture,
    category: result.category,
    typeName: result.typeName,
    roomTypes: result.roomTypes,
    styleTags: result.styleTags,
    colors: result.colors,
    material: result.material,
    widthCm: width.value,
    depthCm: depth.value,
    heightCm: height.value,
    dimensionSource,
    confidence,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  }
}

export function buildClassifyUserMessage(
  items: readonly NormalizedItem[]
): string {
  const products = items.map((item) => ({
    articleNo: item.articleNo,
    name: item.name,
    roughCategory: item.categoryGuess,
    description: item.description.slice(0, 240),
    measurementsCm: item.measurements
      .filter((measurement) => measurement.valueCm !== null)
      .map((measurement) => ({
        label: measurement.label,
        valueCm: measurement.valueCm,
      })),
    resolvedDimensionsCm: {
      width: item.widthCm,
      depth: item.depthCm,
      height: item.heightCm,
    },
  }))

  return JSON.stringify({ products })
}

export function estimateCostUsd(
  model: string,
  usage: TokenUsage
): number | null {
  const price = MODEL_PRICES_USD_PER_MILLION[model]

  if (!price) {
    return null
  }

  return (
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    1_000_000
  )
}

export function addUsage(first: TokenUsage, second: TokenUsage): TokenUsage {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    requests: first.requests + second.requests,
  }
}

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

export function readPositiveInt(
  flags: ReadonlyMap<string, string>,
  name: string,
  fallback: number
): number {
  const parsed = Number.parseInt(flags.get(name) ?? "", 10)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function summarizeClassified(file: ClassifiedFile): string {
  const entries = Object.values(file.items)
  const furniture = entries.filter((entry) => entry.isStandaloneFurniture)
  const review = furniture.filter((entry) => entry.needsReview)
  const categories = new Map<string, number>()
  const sources = new Map<string, number>()

  for (const entry of furniture) {
    categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1)
    sources.set(
      entry.dimensionSource,
      (sources.get(entry.dimensionSource) ?? 0) + 1
    )
  }

  const cost = estimateCostUsd(file.model, file.usage)
  const lines = [
    `model: ${file.model}`,
    `classified: ${entries.length}`,
    `standalone furniture: ${furniture.length}`,
    `not furniture: ${entries.length - furniture.length}`,
    `furniture needing review: ${review.length}`,
    `tokens: ${file.usage.inputTokens} in, ${file.usage.outputTokens} out, ${file.usage.requests} requests`,
    `estimated cost: ${cost === null ? "unknown" : `$${cost.toFixed(4)}`}`,
    "furniture by category:",
  ]

  for (const [category, count] of [...categories].sort()) {
    lines.push(`  ${category}: ${count}`)
  }

  lines.push("furniture by dimension source:")

  for (const [source, count] of [...sources].sort()) {
    lines.push(`  ${source}: ${count}`)
  }

  return lines.join("\n")
}

async function readNormalizedItems(): Promise<readonly NormalizedItem[]> {
  const data: unknown = JSON.parse(await readFile(NORMALIZED_FILE, "utf8"))

  return z.array(normalizedItemSchema).parse(data)
}

async function readClassifiedFile(model: string): Promise<ClassifiedFile> {
  if (!existsSync(CLASSIFIED_FILE)) {
    return {
      model,
      items: {},
      usage: { inputTokens: 0, outputTokens: 0, requests: 0 },
    }
  }

  const data: unknown = JSON.parse(await readFile(CLASSIFIED_FILE, "utf8"))

  return classifiedFileSchema.parse(data)
}

async function writeClassifiedFile(file: ClassifiedFile): Promise<void> {
  await mkdir(SOURCE_DIR, { recursive: true })
  await writeFile(CLASSIFIED_FILE, `${JSON.stringify(file, null, 2)}\n`)
}

async function classifyBatch(
  client: Anthropic,
  model: string,
  batch: readonly NormalizedItem[]
): Promise<BatchOutcome> {
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildClassifyUserMessage(batch) }],
      output_config: {
        effort: "low",
        format: zodOutputFormat(classificationBatchSchema),
      },
    })
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      requests: 1,
    }

    if (response.stop_reason === "refusal") {
      return { kind: "failed", message: "the model refused", usage }
    }

    if (response.stop_reason === "max_tokens") {
      return { kind: "failed", message: "the response was cut off", usage }
    }

    if (!response.parsed_output) {
      return { kind: "failed", message: "the response did not parse", usage }
    }

    return { kind: "ok", results: response.parsed_output.items, usage }
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.BadRequestError
    ) {
      return { kind: "fatal", message: `${error.status}: ${error.message}` }
    }

    if (error instanceof Anthropic.APIError) {
      return {
        kind: "failed",
        message: `${error.status}: ${error.message}`,
        usage: { inputTokens: 0, outputTokens: 0, requests: 1 },
      }
    }

    throw error
  }
}

async function runClassify(argv: readonly string[]): Promise<void> {
  const flags = parseFlags(argv)
  const model = flags.get("model") ?? DEFAULT_CLASSIFY_MODEL
  const batchSize = readPositiveInt(flags, "batch-size", DEFAULT_BATCH_SIZE)
  const limit = readPositiveInt(flags, "limit", Number.MAX_SAFE_INTEGER)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Run: node --env-file=.env.local scripts/ingest-catalog.mts classify"
    )
    process.exitCode = 1
    return
  }

  const normalized = await readNormalizedItems()
  const existing = await readClassifiedFile(model)
  const pending = normalized
    .filter((item) => item.exclusion === null)
    .filter((item) => !(item.articleNo in existing.items))
    .sort((first, second) => first.articleNo.localeCompare(second.articleNo))
    .slice(0, limit)

  console.log(
    `model ${model}: ${pending.length} items to classify, batch size ${batchSize}`
  )

  const client = new Anthropic()
  const items: Record<string, ClassifiedItem> = { ...existing.items }
  let usage = existing.usage
  let classifiedNow = 0
  let failedBatches = 0
  let missingResults = 0

  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize)
    const outcome = await classifyBatch(client, model, batch)

    if (outcome.kind === "fatal") {
      console.error(`stopping: ${outcome.message}`)
      process.exitCode = 1
      break
    }

    usage = addUsage(usage, outcome.usage)

    if (outcome.kind === "failed") {
      failedBatches += 1
      console.error(
        `batch starting at ${start} failed: ${outcome.message} (rerun to retry)`
      )
      continue
    }

    for (const item of batch) {
      const result = outcome.results.find(
        (candidate) => candidate.articleNo === item.articleNo
      )

      if (result) {
        items[item.articleNo] = mergeClassification(item, result)
        classifiedNow += 1
      } else {
        missingResults += 1
      }
    }

    await writeClassifiedFile({ model, items, usage })
    console.log(`classified ${Math.min(start + batchSize, pending.length)}/${pending.length}`)
  }

  await writeClassifiedFile({ model, items, usage })

  console.log(
    `done: ${classifiedNow} classified, ${failedBatches} failed batches, ${missingResults} missing results`
  )
  console.log(summarizeClassified({ model, items, usage }))
}

const PRODUCTS_FILE = path.resolve(
  import.meta.dirname,
  "../lib/catalog/products.json"
)

const LISTINGS_FILE = path.resolve(
  import.meta.dirname,
  "../lib/catalog/listings/us.json"
)

export type SkipReason =
  | "not-furniture"
  | "no-category"
  | "invalid-price"
  | "missing-dimensions"
  | "dimensions-look-wrong"
  | "low-confidence"
  | "no-room-types"
  | "no-style-tags"

export type CatalogProduct = {
  readonly articleNo: string
  readonly name: string
  readonly typeName: string
  readonly category: Exclude<ClassifiedItem["category"], "none">
  readonly roomTypes: ClassifiedItem["roomTypes"]
  readonly widthCm: number
  readonly depthCm: number
  readonly heightCm: number
  readonly styleTags: ClassifiedItem["styleTags"]
  readonly colors: readonly string[]
  readonly material?: string
  readonly description: string
  readonly productFamily?: string
  readonly aiConfidence: number
  readonly needsReview: boolean
}

export type CatalogListing = {
  readonly articleNo: string
  readonly market: "us"
  readonly available: true
  readonly price: number
  readonly currency: "USD"
  readonly priceFetchedAt: string
}

export type SkippedItem = {
  readonly articleNo: string
  readonly reason: SkipReason
}

export type CatalogRecords = {
  readonly products: readonly CatalogProduct[]
  readonly listings: readonly CatalogListing[]
  readonly skipped: readonly SkippedItem[]
}

function detectSkipReason(
  item: NormalizedItem,
  entry: ClassifiedItem
): SkipReason | null {
  if (!entry.isStandaloneFurniture) {
    return "not-furniture"
  }

  if (entry.category === "none") {
    return "no-category"
  }

  if (item.priceUsd <= 0) {
    return "invalid-price"
  }

  if (
    entry.widthCm === null ||
    entry.depthCm === null ||
    entry.heightCm === null
  ) {
    return "missing-dimensions"
  }

  if (entry.reviewReasons.includes("dimensions-look-wrong")) {
    return "dimensions-look-wrong"
  }

  if (entry.reviewReasons.includes("low-confidence")) {
    return "low-confidence"
  }

  if (entry.roomTypes.length === 0) {
    return "no-room-types"
  }

  if (entry.styleTags.length === 0) {
    return "no-style-tags"
  }

  return null
}

function cleanColors(colors: readonly string[]): string[] {
  const cleaned = colors
    .map((color) => color.trim().toLowerCase())
    .filter((color) => color.length > 0)

  return [...new Set(cleaned)]
}

export function buildCatalogRecords(
  items: readonly NormalizedItem[],
  classified: Readonly<Record<string, ClassifiedItem>>
): CatalogRecords {
  const products: CatalogProduct[] = []
  const listings: CatalogListing[] = []
  const skipped: SkippedItem[] = []
  const sorted = [...items].sort((first, second) =>
    first.articleNo.localeCompare(second.articleNo)
  )

  for (const item of sorted) {
    const entry = classified[item.articleNo]

    if (!entry) {
      continue
    }

    const reason = detectSkipReason(item, entry)

    if (
      reason !== null ||
      entry.category === "none" ||
      entry.widthCm === null ||
      entry.depthCm === null ||
      entry.heightCm === null
    ) {
      skipped.push({ articleNo: item.articleNo, reason: reason ?? "no-category" })
      continue
    }

    const material = entry.material.trim()

    products.push({
      articleNo: item.articleNo,
      name: item.name,
      typeName: entry.typeName,
      category: entry.category,
      roomTypes: entry.roomTypes,
      widthCm: entry.widthCm,
      depthCm: entry.depthCm,
      heightCm: entry.heightCm,
      styleTags: entry.styleTags,
      colors: cleanColors(entry.colors),
      ...(material ? { material } : {}),
      description: item.description || item.name,
      ...(item.family ? { productFamily: item.family } : {}),
      aiConfidence: entry.confidence,
      needsReview: entry.needsReview,
    })

    listings.push({
      articleNo: item.articleNo,
      market: "us",
      available: true,
      price: item.priceUsd,
      currency: "USD",
      priceFetchedAt: item.fetchedAt,
    })
  }

  return { products, listings, skipped }
}

export function summarizeCatalogRecords(records: CatalogRecords): string {
  const categories = new Map<string, number>()
  const reasons = new Map<string, number>()

  for (const product of records.products) {
    categories.set(product.category, (categories.get(product.category) ?? 0) + 1)
  }

  for (const skipped of records.skipped) {
    reasons.set(skipped.reason, (reasons.get(skipped.reason) ?? 0) + 1)
  }

  const review = records.products.filter((product) => product.needsReview)
  const lines = [
    `products written: ${records.products.length}`,
    `  flagged needsReview: ${review.length}`,
    `skipped: ${records.skipped.length}`,
  ]

  for (const [reason, count] of [...reasons].sort()) {
    lines.push(`  skipped as ${reason}: ${count}`)
  }

  lines.push("products by category:")

  for (const [category, count] of [...categories].sort()) {
    lines.push(`  ${category}: ${count}`)
  }

  return lines.join("\n")
}

async function runWrite(): Promise<void> {
  if (!existsSync(CLASSIFIED_FILE)) {
    console.error("No classified.json yet. Run the classify command first.")
    process.exitCode = 1
    return
  }

  const normalized = await readNormalizedItems()
  const data: unknown = JSON.parse(await readFile(CLASSIFIED_FILE, "utf8"))
  const classified = classifiedFileSchema.parse(data)
  const records = buildCatalogRecords(normalized, classified.items)

  await mkdir(path.dirname(LISTINGS_FILE), { recursive: true })
  await writeFile(PRODUCTS_FILE, `${JSON.stringify(records.products, null, 2)}\n`)
  await writeFile(LISTINGS_FILE, `${JSON.stringify(records.listings, null, 2)}\n`)

  console.log(summarizeCatalogRecords(records))
}

async function runClassifyStats(): Promise<void> {
  if (!existsSync(CLASSIFIED_FILE)) {
    console.error("No classified.json yet. Run the classify command first.")
    process.exitCode = 1
    return
  }

  const data: unknown = JSON.parse(await readFile(CLASSIFIED_FILE, "utf8"))

  console.log(summarizeClassified(classifiedFileSchema.parse(data)))
}

export async function main(argv: readonly string[]): Promise<void> {
  const command = argv[0]

  if (command === "normalize") {
    await runNormalize()
    return
  }

  if (command === "classify") {
    await runClassify(argv.slice(1))
    return
  }

  if (command === "classify-stats") {
    await runClassifyStats()
    return
  }

  if (command === "write") {
    await runWrite()
    return
  }

  console.error(
    "Usage: node scripts/ingest-catalog.mts <normalize | classify [--limit N] [--batch-size N] [--model ID] | classify-stats | write>"
  )
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2))
}
