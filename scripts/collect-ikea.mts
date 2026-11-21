import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"

const USER_AGENT = "seven-team-hackathon-catalog-builder/0.1"
const MIN_DELAY_MS = 2500
const REQUEST_TIMEOUT_MS = 25000
const RETRY_WAIT_MS = 10000
const DEFAULT_INPUT = "/tmp/ikea-us/all-urls.txt"
const HTML_CACHE_DIR = "/tmp/ikea-us/html-cache"
const SOURCE_DIR = path.resolve(import.meta.dirname, "../catalog-sources/us")
const SELECTED_PATH = path.join(SOURCE_DIR, "selected-urls.json")
const ITEMS_DIR = path.join(SOURCE_DIR, "items")
const TOTAL_MODELS = 250
const TOTAL_URLS = 365
const DEFAULT_SEED = 7

export const CATEGORIES = [
  "sofa",
  "armchair",
  "coffee-table",
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

export type Category = (typeof CATEGORIES)[number]

const SIZE_CRITICAL: readonly Category[] = [
  "sofa",
  "wardrobe",
  "bookshelf",
  "bed",
  "desk",
  "dining-table",
]

const EXCLUDED_TOKENS = new Set([
  "cover",
  "covers",
  "slipcover",
  "leg",
  "legs",
  "cushion",
  "cushions",
  "pillow",
  "pillows",
  "insert",
  "inserts",
  "mattress",
  "mattresses",
  "dog",
  "cat",
  "pet",
  "holder",
  "hanging",
  "gaming",
  "junior",
  "grid",
  "bedding",
  "sheet",
  "sheets",
  "curtain",
  "curtains",
  "rug",
  "rugs",
  "lamp",
  "lamps",
  "mirror",
  "hook",
  "hooks",
  "knob",
  "knobs",
  "handle",
  "handles",
  "organizer",
  "organizers",
  "basket",
  "baskets",
  "box",
  "boxes",
  "interior",
  "pad",
  "pads",
  "protector",
  "topper",
  "duvet",
  "hinge",
  "hinges",
  "wheel",
  "wheels",
  "castor",
  "castors",
  "armrest",
  "armrests",
  "fitting",
  "fittings",
])

const EXCLUDED_SUBSTRINGS = ["door-for", "frame-only", "accessor"]

export const SelectedUrlSchema = z.object({
  url: z.string(),
  articleNo: z.string(),
  family: z.string(),
  categoryGuess: z.string(),
})

export type SelectedUrl = z.infer<typeof SelectedUrlSchema>

export const MeasurementSchema = z.object({
  label: z.string(),
  rawText: z.string(),
  valueCm: z.number().nullable(),
})

export type Measurement = z.infer<typeof MeasurementSchema>

export const ItemSchema = z.object({
  articleNo: z.string(),
  url: z.string(),
  family: z.string(),
  categoryGuess: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  priceUsd: z.number().nullable(),
  currency: z.string().nullable(),
  measurements: z.array(MeasurementSchema),
  widthCm: z.number().nullable(),
  depthCm: z.number().nullable(),
  heightCm: z.number().nullable(),
  fetchedAt: z.string(),
  needsReview: z.boolean(),
  reviewReasons: z.array(z.string()),
})

export type Item = z.infer<typeof ItemSchema>

export type ParsedPage = Omit<
  Item,
  "articleNo" | "url" | "family" | "categoryGuess" | "fetchedAt"
>

export type MeasurementText = {
  parsed: boolean
  inches: number[]
  cm: number[]
}

export function parseFraction(text: string): number | null {
  const value = text.trim()
  const mixed = /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?$/.exec(value)
  if (mixed) {
    const whole = Number(mixed[1])
    if (mixed[2] === undefined) return whole
    const denominator = Number(mixed[3])
    if (denominator === 0) return null
    return whole + Number(mixed[2]) / denominator
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(value)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    return Number(fraction[1]) / denominator
  }
  return null
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
}

export function parseMeasurementText(raw: string): MeasurementText {
  const cleaned = decodeEntities(raw)
    .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (char) => ` ${UNICODE_FRACTIONS[char]}`)
    .replace(/["″”]/g, "")
    .replace(/\binch(es)?\b|\bin\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
  if (cleaned === "") return { parsed: false, inches: [], cm: [] }
  const inches: number[] = []
  for (const part of cleaned.split(/\s*[x×]\s*/i)) {
    const value = parseFraction(part)
    if (value === null) return { parsed: false, inches: [], cm: [] }
    inches.push(value)
  }
  return { parsed: true, inches, cm: inches.map(inchesToCm) }
}

function stripTags(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, "")).trim()
}

export function extractMeasurements(html: string): Measurement[] {
  const rowPattern =
    /pipf-measurements-tab__measurement-name">([\s\S]*?)<\/span>\s*<span class="pipf-measurements-tab__measurement-value">([\s\S]*?)<\/span>/g
  const seen = new Set<string>()
  const measurements: Measurement[] = []
  for (const match of html.matchAll(rowPattern)) {
    const label = stripTags(match[1])
    const rawText = stripTags(match[2])
    const key = `${label}\u0000${rawText}`
    if (label === "" || seen.has(key)) continue
    seen.add(key)
    const parsed = parseMeasurementText(rawText)
    const valueCm = parsed.parsed && parsed.cm.length === 1 ? parsed.cm[0] : null
    measurements.push({ label, rawText, valueCm })
  }
  return measurements
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function findProduct(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProduct(entry)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null
  const type = value["@type"]
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    return value
  }
  return findProduct(value["@graph"])
}

export function extractProduct(html: string): JsonRecord | null {
  const scriptPattern =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const product = findProduct(JSON.parse(match[1]))
      if (product) return product
    } catch {
      continue
    }
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function extractOffer(product: JsonRecord): {
  price: number | null
  currency: string | null
} {
  const offers = product.offers
  const list = Array.isArray(offers) ? offers : [offers]
  const candidates: unknown[] = []
  for (const offer of list) {
    if (!isRecord(offer)) continue
    candidates.push(offer)
    const specs = Array.isArray(offer.priceSpecification)
      ? offer.priceSpecification
      : [offer.priceSpecification]
    for (const spec of specs) {
      if (isRecord(spec) && !/strikethrough/i.test(String(spec.priceType ?? ""))) {
        candidates.push(spec)
      }
    }
  }
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue
    const rawPrice = candidate.price ?? candidate.lowPrice
    const price = Number(rawPrice)
    if (rawPrice !== undefined && rawPrice !== "" && Number.isFinite(price) && price > 0) {
      return { price, currency: asString(candidate.priceCurrency) }
    }
  }
  return { price: null, currency: null }
}

function shorten(text: string | null, max: number): string | null {
  if (text === null) return null
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

const DIMENSION_LABELS = {
  widthCm: "width",
  depthCm: "depth",
  heightCm: "height",
} as const

export function parsePage(html: string): ParsedPage {
  const product = extractProduct(html)
  const measurements = extractMeasurements(html)
  const reasons: string[] = []
  const offer = product ? extractOffer(product) : { price: null, currency: null }
  if (!product) reasons.push("missing-product-data")
  if (offer.price === null) reasons.push("missing-price")
  if (measurements.length === 0) reasons.push("missing-measurements")

  const dims: Record<keyof typeof DIMENSION_LABELS, number | null> = {
    widthCm: null,
    depthCm: null,
    heightCm: null,
  }
  let ambiguous = false
  for (const [field, label] of Object.entries(DIMENSION_LABELS) as [
    keyof typeof DIMENSION_LABELS,
    string,
  ][]) {
    const rows = measurements.filter((m) => m.label.toLowerCase() === label)
    if (rows.length > 1) ambiguous = true
    if (rows.length === 1) {
      if (rows[0].valueCm === null) ambiguous = true
      else dims[field] = rows[0].valueCm
      continue
    }
    if (rows.length === 0 && product && measurements.length === 0) {
      const parsed = parseMeasurementText(asString(product[label]) ?? "")
      if (parsed.parsed && parsed.cm.length === 1) dims[field] = parsed.cm[0]
    }
  }
  if (measurements.some((m) => m.valueCm === null && /["″]/.test(m.rawText))) {
    ambiguous = true
  }
  if (dims.widthCm === null || dims.depthCm === null || dims.heightCm === null) {
    reasons.push("missing-dimensions")
  }
  if (ambiguous) reasons.push("ambiguous-measurements")

  return {
    name: product ? asString(product.name) : null,
    description: product ? shorten(asString(product.description), 400) : null,
    priceUsd: offer.price,
    currency: offer.currency,
    measurements,
    widthCm: dims.widthCm,
    depthCm: dims.depthCm,
    heightCm: dims.heightCm,
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
  }
}

export function buildItem(
  selected: SelectedUrl,
  html: string,
  fetchedAt: string
): Item {
  return ItemSchema.parse({
    articleNo: selected.articleNo,
    url: selected.url,
    family: selected.family,
    categoryGuess: selected.categoryGuess,
    fetchedAt,
    ...parsePage(html),
  })
}

export function parseUrl(
  url: string
): { slug: string; articleNo: string; family: string } | null {
  const match = /\/p\/(.+)-(s?\d{8})\/?$/.exec(url.trim())
  if (!match) return null
  return {
    slug: match[1],
    articleNo: match[2],
    family: match[1].split("-")[0],
  }
}

export function isExcludedSlug(slug: string): boolean {
  if (EXCLUDED_SUBSTRINGS.some((part) => slug.includes(part))) return true
  return slug.split("-").some((token) => EXCLUDED_TOKENS.has(token))
}

export function classifySlug(slug: string): Category | null {
  const tokens = slug.split("-")
  const has = (...words: string[]) => words.some((w) => tokens.includes(w))
  const includes = (...parts: string[]) => parts.some((p) => slug.includes(p))

  if (includes("office-chair", "desk-chair", "task-chair", "swivel-chair"))
    return "office-chair"
  if (has("armchair", "recliner") || includes("lounge-chair", "accent-chair"))
    return "armchair"
  if (has("chairs")) return null
  if (has("chair") && !has("high", "highchair", "children", "childrens"))
    return "dining-chair"
  if (has("nightstand", "bedside")) return "nightstand"
  if (includes("coffee-table", "sofa-table", "side-table", "nesting")) return "coffee-table"
  if (includes("tv-unit", "tv-bench", "tv-stand", "media-storage")) return "tv-unit"
  if (has("table") && has("dining", "extendable", "gateleg", "drop")) return "dining-table"
  if (has("desk", "desks")) return "desk"
  if (has("bookcase", "bookshelf") || includes("shelf-unit", "shelving-unit"))
    return "bookshelf"
  if (has("wardrobe", "closet", "armoire")) return "wardrobe"
  if (has("sofa", "sectional", "loveseat", "sofas")) return "sofa"
  if (has("bed", "daybed") && !has("bedside")) return "bed"
  if (has("dresser", "chest", "cabinet", "sideboard", "console") || includes("storage"))
    return "storage"
  return null
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = mulberry32(seed)
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function allocateQuotas(
  available: Record<string, number>,
  total: number
): Record<string, number> {
  const keys = Object.keys(available).sort()
  const quotas: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))
  let remaining = total
  let progressed = true
  while (remaining > 0 && progressed) {
    progressed = false
    for (const key of keys) {
      if (remaining === 0) break
      if (quotas[key] < available[key]) {
        quotas[key] += 1
        remaining -= 1
        progressed = true
      }
    }
  }
  return quotas
}

type Candidate = SelectedUrl & { category: Category }

export function selectUrls(
  urls: readonly string[],
  seed: number = DEFAULT_SEED,
  totalModels: number = TOTAL_MODELS,
  totalUrls: number = TOTAL_URLS
): SelectedUrl[] {
  const families = new Map<string, Candidate[]>()
  for (const url of urls) {
    const parsed = parseUrl(url)
    if (!parsed || isExcludedSlug(parsed.slug)) continue
    const category = classifySlug(parsed.slug)
    if (!category) continue
    const key = `${category}/${parsed.family}`
    const list = families.get(key) ?? []
    list.push({
      url: url.trim(),
      articleNo: parsed.articleNo,
      family: parsed.family,
      categoryGuess: category,
      category,
    })
    families.set(key, list)
  }

  const byCategory = new Map<Category, string[]>()
  for (const key of [...families.keys()].sort()) {
    const category = key.split("/")[0] as Category
    byCategory.set(category, [...(byCategory.get(category) ?? []), key])
  }

  const available = Object.fromEntries(
    CATEGORIES.map((c) => [c, byCategory.get(c)?.length ?? 0])
  )
  const quotas = allocateQuotas(available, totalModels)

  const primaries: Candidate[] = []
  const extras: Candidate[][] = []
  CATEGORIES.forEach((category, index) => {
    const keys = seededShuffle(byCategory.get(category) ?? [], seed + index).slice(
      0,
      quotas[category]
    )
    for (const key of keys) {
      const variants = seededShuffle(families.get(key) ?? [], seed + index + 101)
      primaries.push(variants[0])
      if (SIZE_CRITICAL.includes(category)) extras.push(variants.slice(1, 3))
    }
  })

  const selected = [...primaries]
  for (let round = 0; round < 2; round++) {
    for (const variants of extras) {
      if (selected.length >= totalUrls) break
      const variant = variants[round]
      if (variant) selected.push(variant)
    }
  }

  return seededShuffle(selected, seed).map(
    ({ url, articleNo, family, categoryGuess }) => ({
      url,
      articleNo,
      family,
      categoryGuess,
    })
  )
}

export function isBotWall(html: string): boolean {
  if (html.length > 200000) return false
  return /captcha|access denied|unusual traffic|are you a robot|bot detection|request blocked/i.test(
    html
  )
}

class BlockedError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchOnce(url: string): Promise<{ status: number; html: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return { status: response.status, html: await response.text() }
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  let result: { status: number; html: string } | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await fetchOnce(url)
    } catch {
      result = null
    }
    if (result && result.status < 500) break
    if (attempt === 0) {
      console.log("  transient failure, retrying once in 10s")
      await sleep(RETRY_WAIT_MS)
    }
  }
  return result ?? { status: 0, html: "" }
}

function parseFlags(args: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] ?? ""
      i++
    }
  }
  return flags
}

async function readSelected(): Promise<SelectedUrl[]> {
  const raw = await readFile(SELECTED_PATH, "utf8")
  return z.array(SelectedUrlSchema).parse(JSON.parse(raw))
}

async function writeItem(item: Item): Promise<void> {
  await writeFile(
    path.join(ITEMS_DIR, `${item.articleNo}.json`),
    `${JSON.stringify(item, null, 2)}\n`
  )
}

async function runSelect(flags: Record<string, string>): Promise<void> {
  const input = flags.input || DEFAULT_INPUT
  if (!existsSync(input)) {
    console.error(`Input file not found: ${input}`)
    process.exit(1)
  }
  const urls = (await readFile(input, "utf8")).split("\n").filter(Boolean)
  const selected = selectUrls(urls, flags.seed ? Number(flags.seed) : DEFAULT_SEED)
  await mkdir(SOURCE_DIR, { recursive: true })
  await writeFile(SELECTED_PATH, `${JSON.stringify(selected, null, 2)}\n`)
  const counts = new Map<string, number>()
  for (const entry of selected) {
    counts.set(entry.categoryGuess, (counts.get(entry.categoryGuess) ?? 0) + 1)
  }
  const families = new Set(selected.map((s) => `${s.categoryGuess}/${s.family}`))
  for (const category of CATEGORIES) {
    console.log(`${category}: ${counts.get(category) ?? 0}`)
  }
  console.log(`models: ${families.size}, total urls: ${selected.length}`)
}

async function runCollect(flags: Record<string, string>): Promise<void> {
  const selected = await readSelected()
  const offset = Number(flags.offset ?? 0)
  const limit = Number(flags.limit ?? selected.length)
  const delayMs = Math.max(MIN_DELAY_MS, Number(flags["delay-ms"] ?? MIN_DELAY_MS))
  const batch = selected.slice(offset, offset + limit)
  await mkdir(ITEMS_DIR, { recursive: true })
  await mkdir(HTML_CACHE_DIR, { recursive: true })

  let lastRequestAt = 0
  let done = 0
  let failed = 0
  for (const [index, entry] of batch.entries()) {
    const label = `[${offset + index + 1}/${selected.length}] ${entry.articleNo}`
    if (existsSync(path.join(ITEMS_DIR, `${entry.articleNo}.json`))) {
      console.log(`${label} skip (exists)`)
      continue
    }
    const cachePath = path.join(HTML_CACHE_DIR, `${entry.articleNo}.html`)
    let html: string
    if (existsSync(cachePath)) {
      html = await readFile(cachePath, "utf8")
    } else {
      const wait = lastRequestAt + delayMs - Date.now()
      if (wait > 0) await sleep(wait)
      const result = await fetchHtml(entry.url)
      lastRequestAt = Date.now()
      if (result.status === 403 || result.status === 429) {
        console.error(`${label} BLOCKED: HTTP ${result.status}. Stopping.`)
        throw new BlockedError(`HTTP ${result.status}`)
      }
      if (result.status === 200 && isBotWall(result.html)) {
        console.error(`${label} BLOCKED: bot wall page. Stopping.`)
        throw new BlockedError("bot wall")
      }
      if (result.status !== 200) {
        failed++
        console.log(`${label} FAILED http=${result.status}`)
        continue
      }
      html = result.html
      await writeFile(cachePath, html)
    }
    const item = buildItem(entry, html, new Date().toISOString())
    await writeItem(item)
    done++
    console.log(
      `${label} ok price=${item.priceUsd ?? "-"} dims=${item.widthCm ?? "-"}x${item.depthCm ?? "-"}x${item.heightCm ?? "-"} m=${item.measurements.length}${item.needsReview ? " review" : ""}`
    )
  }
  console.log(`batch complete: ${done} written, ${failed} failed`)
}

async function runReparse(): Promise<void> {
  const selected = await readSelected()
  await mkdir(ITEMS_DIR, { recursive: true })
  let count = 0
  for (const entry of selected) {
    const cachePath = path.join(HTML_CACHE_DIR, `${entry.articleNo}.html`)
    if (!existsSync(cachePath)) continue
    let fetchedAt = new Date().toISOString()
    const itemPath = path.join(ITEMS_DIR, `${entry.articleNo}.json`)
    if (existsSync(itemPath)) {
      const previous = ItemSchema.safeParse(JSON.parse(await readFile(itemPath, "utf8")))
      if (previous.success) fetchedAt = previous.data.fetchedAt
    }
    await writeItem(buildItem(entry, await readFile(cachePath, "utf8"), fetchedAt))
    count++
  }
  console.log(`reparsed ${count} items`)
}

function percent(part: number, total: number): string {
  return total === 0 ? "n/a" : `${((part / total) * 100).toFixed(1)}%`
}

export function summarize(items: readonly Item[]): string {
  const hasDims = (i: Item) =>
    i.widthCm !== null && i.depthCm !== null && i.heightCm !== null
  const line = (name: string, group: readonly Item[]) =>
    `${name.padEnd(14)} n=${String(group.length).padStart(3)} price=${percent(group.filter((i) => i.priceUsd !== null).length, group.length)} whd=${percent(group.filter(hasDims).length, group.length)} anyMeasurement=${percent(group.filter((i) => i.measurements.length > 0).length, group.length)} review=${group.filter((i) => i.needsReview).length}`
  const lines = [line("ALL", items)]
  for (const category of CATEGORIES) {
    const group = items.filter((i) => i.categoryGuess === category)
    if (group.length > 0) lines.push(line(category, group))
  }
  const review = items.filter((i) => i.needsReview)
  lines.push(`needs review (${review.length}):`)
  for (const item of review) {
    lines.push(`  ${item.articleNo} ${item.reviewReasons.join(",")}`)
  }
  return lines.join("\n")
}

async function runStats(): Promise<void> {
  const files = existsSync(ITEMS_DIR) ? await readdir(ITEMS_DIR) : []
  const items: Item[] = []
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    items.push(
      ItemSchema.parse(JSON.parse(await readFile(path.join(ITEMS_DIR, file), "utf8")))
    )
  }
  console.log(summarize(items))
}

export async function main(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv
  const flags = parseFlags(rest)
  try {
    if (command === "select") await runSelect(flags)
    else if (command === "collect") await runCollect(flags)
    else if (command === "reparse") await runReparse()
    else if (command === "stats") await runStats()
    else {
      console.error("Usage: collect-ikea.mts <select|collect|reparse|stats> [flags]")
      process.exit(2)
    }
  } catch (error) {
    if (error instanceof BlockedError) process.exit(1)
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2))
}
