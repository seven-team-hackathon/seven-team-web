import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { buildSpaceDraft } from "@/lib/space/extract-space"
import { analyzePhotoWithClaude } from "@/lib/space/photo-analysis"
import { toPhotoMediaType } from "@/lib/space/photo-media-types"

const CASES_DIR = path.resolve(import.meta.dirname, "space-cases")

const casesSchema = z.array(
  z.object({
    file: z.string(),
    widthCm: z.number(),
    lengthCm: z.number(),
    roomType: z.string().optional(),
  })
)

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second)

  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const casesFile = path.join(CASES_DIR, "cases.json")

describe.skipIf(!existsSync(casesFile))("photo dimension evals", () => {
  it(
    "estimates the room size from photos with known dimensions",
    async () => {
      const cases = casesSchema.parse(JSON.parse(readFileSync(casesFile, "utf8")))
      const rows: {
        file: string
        widthError: number
        lengthError: number
        confidence: number
        roomTypeMatch: boolean | null
      }[] = []

      for (const entry of cases) {
        const mediaType = toPhotoMediaType(MEDIA_TYPES[path.extname(entry.file).toLowerCase()] ?? "")

        if (!mediaType) continue

        const base64 = readFileSync(path.join(CASES_DIR, entry.file)).toString("base64")
        const outcome = await analyzePhotoWithClaude({ base64, mediaType })

        if (outcome.kind !== "ok") continue

        const draft = buildSpaceDraft(outcome.analysis)

        if (!draft?.dimensions) continue

        rows.push({
          file: entry.file,
          widthError: Math.abs(draft.dimensions.widthCm - entry.widthCm) / entry.widthCm,
          lengthError: Math.abs(draft.dimensions.lengthCm - entry.lengthCm) / entry.lengthCm,
          confidence: draft.dimensions.confidence,
          roomTypeMatch: entry.roomType ? draft.roomType === entry.roomType : null,
        })
      }

      const errors = rows.flatMap((row) => [row.widthError, row.lengthError])
      const report = {
        photos: cases.length,
        estimated: rows.length,
        medianRelativeError: median(errors),
        within25Percent: errors.length === 0 ? 0 : errors.filter((value) => value <= 0.25).length / errors.length,
        rows,
      }

      writeFileSync(
        path.resolve(import.meta.dirname, "results/space-latest.json"),
        `${JSON.stringify(report, null, 2)}\n`
      )
      console.log(`\nPhoto dimension evals: ${JSON.stringify({ ...report, rows: undefined })}\n`)

      expect(rows.length).toBeGreaterThan(0)
    },
    900_000
  )
})
