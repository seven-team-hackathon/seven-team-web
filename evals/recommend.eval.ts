import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { loadCatalog } from "@/lib/catalog/load-catalog"
import { filterCandidates } from "@/lib/recommend/filter-candidates"
import { recommend } from "@/lib/recommend/recommend"
import { judgeReasons } from "./judge"
import { evaluateCase, summarize } from "./metrics"
import type { CaseResult, Summary } from "./metrics"
import { recommendCases } from "./recommend-cases"
import type { EvalCase } from "./recommend-cases"

const CONCURRENCY = 4

const RESULTS_DIR = path.resolve(import.meta.dirname, "results")

const catalog = loadCatalog("us")

async function runCase(evalCase: EvalCase): Promise<CaseResult> {
  const started = Date.now()
  const response = await recommend(evalCase.request)
  const latencyMs = Date.now() - started
  const groups = filterCandidates(
    catalog,
    evalCase.request.space,
    evalCase.request.preferences
  )
  const judged = await judgeReasons(evalCase.request, response, catalog, groups)

  return {
    id: evalCase.id,
    tags: evalCase.tags,
    checks: evaluateCase(evalCase.request, response, catalog),
    latencyMs,
    costUsd: response.usage.estimatedCostUsd + judged.costUsd,
    itemCount: response.items.length,
    unmatched: response.meta.unmatchedCategories ?? [],
    groundedReasons: judged.supported,
    totalReasons: judged.total,
    unsupported: judged.unsupported,
  }
}

async function runAll(cases: readonly EvalCase[]): Promise<CaseResult[]> {
  const results: CaseResult[] = []

  for (let start = 0; start < cases.length; start += CONCURRENCY) {
    const batch = cases.slice(start, start + CONCURRENCY)

    results.push(...(await Promise.all(batch.map(runCase))))
  }

  return results
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function renderSummary(summary: Summary, results: readonly CaseResult[]): string {
  const failing = results.filter((result) =>
    Object.values(result.checks).some((passed) => !passed)
  )
  const examples = results
    .flatMap((result) => result.unsupported.map((entry) => ({ id: result.id, ...entry })))
    .slice(0, 5)
  const lines = [
    `# Recommendation evals`,
    ``,
    `Cases: ${summary.cases}, explanations judged: ${summary.totalReasons}`,
    ``,
    `| Metric | Result |`,
    `| --- | --- |`,
    `| Articles that exist in the catalog | ${pct(summary.rates.knownArticles)} |`,
    `| Links match the article | ${pct(summary.rates.validLinks)} |`,
    `| Every requested category accounted for | ${pct(summary.rates.categoriesAccounted)} |`,
    `| No duplicate products in a category | ${pct(summary.rates.noDuplicates)} |`,
    `| Primary picks fit the room | ${pct(summary.rates.primariesFitRoom)} |`,
    `| Budget respected or over-budget reported | ${pct(summary.rates.budgetHonest)} |`,
    `| Ranked by the model (no fallback) | ${pct(summary.rates.usedModel)} |`,
    `| Explanations grounded in data (LLM judge) | ${pct(summary.groundedRate)} |`,
    `| Latency median / p90 | ${(summary.medianLatencyMs / 1000).toFixed(1)} s / ${(summary.p90LatencyMs / 1000).toFixed(1)} s |`,
    `| Cost per request (ranking + judge) | $${summary.meanCostUsd.toFixed(4)} |`,
    ``,
    `Cases with a failed check: ${failing.length === 0 ? "none" : failing.map((result) => result.id).join(", ")}`,
    ``,
    `Unsupported claims found by the judge (examples):`,
    ...(examples.length === 0
      ? ["none"]
      : examples.map((entry) => `- ${entry.id} ${entry.articleNo}: ${entry.claim}`)),
  ]

  return lines.join("\n")
}

describe("recommendation evals", () => {
  it(
    "runs the scenarios and reports metrics",
    async () => {
      const results = await runAll(recommendCases)
      const summary = summarize(results)
      const report = renderSummary(summary, results)

      mkdirSync(RESULTS_DIR, { recursive: true })
      writeFileSync(
        path.join(RESULTS_DIR, "recommend-latest.json"),
        `${JSON.stringify({ summary, results }, null, 2)}\n`
      )
      writeFileSync(path.join(RESULTS_DIR, "recommend-latest.md"), `${report}\n`)
      console.log(`\n${report}\n`)

      expect(summary.rates.knownArticles).toBe(1)
      expect(summary.rates.validLinks).toBe(1)
      expect(summary.rates.categoriesAccounted).toBe(1)
      expect(summary.rates.primariesFitRoom).toBe(1)
      expect(summary.rates.budgetHonest).toBe(1)
    },
    900_000
  )
})
