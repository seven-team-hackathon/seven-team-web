import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

import { estimateCostUsd, getAnthropicClient } from "@/lib/anthropic"
import type { CatalogItem } from "@/lib/catalog/load-catalog"
import type { CandidateGroup } from "@/lib/recommend/filter-candidates"
import type {
  RecommendRequest,
  RecommendationResponse,
} from "@/lib/contracts/recommendation"

export const JUDGE_MODEL = "claude-sonnet-5-5"

const JUDGE_SYSTEM_PROMPT = [
  "You audit product recommendation explanations for factual grounding.",
  "For each explanation decide whether every factual claim in it is supported by the product data, the customer preferences or the space data provided.",
  "Supported: sizes, prices, styles, colors, materials, room types, descriptions that appear in the data, correct arithmetic or comparisons based on them, and hedges or opinions that do not assert a new fact.",
  "Unsupported: any product feature, material, quality, comfort or capability that is not in the data, and any wrong number or comparison.",
  "candidateLists holds every product the assistant could choose from in each category. Comparisons with other options (cheapest, widest, tallest, smaller than) are supported when they are true against that list.",
  "Return one verdict per explanation, echoing its articleNo. Set supported to false only when you can quote a specific claim that is not supported, and put that quote in unsupportedClaim. When supported is true, leave unsupportedClaim empty.",
].join("\n")

const verdictSchema = z.object({
  verdicts: z.array(
    z.object({
      articleNo: z.string(),
      supported: z.boolean(),
      unsupportedClaim: z.string(),
    })
  ),
})

export type JudgeResult = {
  readonly supported: number
  readonly total: number
  readonly unsupported: readonly { readonly articleNo: string; readonly claim: string }[]
  readonly costUsd: number
}

export async function judgeReasons(
  request: RecommendRequest,
  response: RecommendationResponse,
  catalog: readonly CatalogItem[],
  groups: readonly CandidateGroup[]
): Promise<JudgeResult> {
  const byArticleNo = new Map(catalog.map((item) => [item.articleNo, item]))
  const explanations = response.items.flatMap((entry) =>
    [entry.primary, ...entry.alternatives].map((item) => {
      const facts = byArticleNo.get(item.articleNo)

      return {
        articleNo: item.articleNo,
        explanation: item.reason,
        productData: facts
          ? {
              name: facts.name,
              type: facts.typeName,
              priceUsd: facts.price,
              sizeCm: { width: facts.widthCm, depth: facts.depthCm, height: facts.heightCm },
              styles: facts.styleTags,
              colors: facts.colors,
              material: facts.material ?? null,
              rooms: facts.roomTypes,
              description: facts.description.slice(0, 200),
            }
          : null,
      }
    })
  )

  if (explanations.length === 0) {
    return { supported: 0, total: 0, unsupported: [], costUsd: 0 }
  }

  const parsed = await getAnthropicClient().messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 8000,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          customer: {
            budgetUsd: request.preferences.budget,
            style: request.preferences.style ?? null,
            household: request.preferences.household,
            note: request.preferences.note ?? null,
          },
          space: request.space,
          candidateLists: groups.map((group) => ({
            category: group.category,
            candidates: group.candidates.map((item) => ({
              articleNo: item.articleNo,
              priceUsd: item.price,
              sizeCm: { width: item.widthCm, depth: item.depthCm, height: item.heightCm },
              styles: item.styleTags,
              colors: item.colors,
            })),
          })),
          explanations,
        }),
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(verdictSchema) },
  })
  const verdicts = parsed.parsed_output?.verdicts ?? []
  const byVerdict = new Map(verdicts.map((verdict) => [verdict.articleNo, verdict]))
  const unsupported = explanations.flatMap((entry) => {
    const verdict = byVerdict.get(entry.articleNo)

    return verdict && !verdict.supported && verdict.unsupportedClaim.trim().length > 0
      ? [{ articleNo: entry.articleNo, claim: verdict.unsupportedClaim }]
      : []
  })
  const costUsd =
    estimateCostUsd(JUDGE_MODEL, {
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
    }) ?? 0

  return {
    supported: explanations.length - unsupported.length,
    total: explanations.length,
    unsupported,
    costUsd,
  }
}
